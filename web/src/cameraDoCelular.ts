/**
 * O CELULAR COMO CÂMERA (23/11/2026; o servidor em server/src/camera-do-celular.ts, que explica o desenho).
 *
 * O computador mostra um QR code com o endereço `…#celular=<id>.<token>.<segredo>`. O celular abre, manda a câmera dele
 * DIRETO ao computador (WebRTC de aparelho para aparelho), e o computador a publica na chamada como a câmera da pessoa.
 *
 * O SEGREDO vai depois do #, que o navegador nunca manda a servidor nenhum, e cada mensagem do aperto de mão vai
 * assinada com ele (HMAC-SHA-256), com o sentido e um número que só sobe. O servidor repassa as mensagens, mas não
 * consegue forjar nem trocar nenhuma: a impressão digital da conexão (DTLS) está dentro da oferta assinada, e quem se
 * pusesse no meio teria de trocá-la. A imagem viaja cifrada pela própria conexão WebRTC, de um aparelho ao outro.
 *
 * SEM SERVIDOR DE STUN OU TURN (nada de terceiro sabendo o endereço de ninguém): os dois se acham pela rede de casa. Por
 * isso o celular e o computador precisam estar na MESMA REDE, e a tela diz isso quando a conexão não sai.
 */
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

type Sentido = 'pc' | 'cel';
type Sinal = { t: 'oferta'; sdp: string } | { t: 'resposta'; sdp: string } | { t: 'ice'; c: RTCIceCandidateInit } | { t: 'fim' };
interface Envelope {
  de: Sentido;
  n: number;
  c: string;
  m: string;
}

const TEXTO = new TextEncoder();
const paraB64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Quanto se espera a conexão sair depois de o celular se apresentar, antes de dizer que não deu. */
export const ESPERA_DA_CONEXAO_MS = 20_000;
/** A imagem que o celular manda: boa para uma câmera de chamada, sem pesar na rede de casa. */
const VIDEO_DO_CELULAR: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
const TAXA_MAXIMA = 2_500_000;

/**
 * As duas pontas assinam e conferem do mesmo jeito: a mensagem de um sentido só é aceita pelo outro, e o número dela
 * tem de ser maior que o da última aceita (uma mensagem velha repetida pelo servidor é ignorada).
 */
class Canal {
  private n = 0;
  private ultimoRecebido = 0;
  private constructor(
    private chave: CryptoKey,
    private eu: Sentido,
  ) {}

  static async criar(segredo: string, eu: Sentido) {
    const chave = await crypto.subtle.importKey('raw', deB64(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    return new Canal(chave, eu);
  }

  async selar(sinal: Sinal): Promise<string> {
    const n = ++this.n;
    const c = JSON.stringify(sinal);
    const m = paraB64(await crypto.subtle.sign('HMAC', this.chave, TEXTO.encode(`${this.eu}|${n}|${c}`)));
    return JSON.stringify({ de: this.eu, n, c, m } satisfies Envelope);
  }

  async abrir(dados: string): Promise<Sinal | null> {
    try {
      const e = JSON.parse(dados) as Envelope;
      if (e.de === this.eu || !Number.isInteger(e.n) || e.n <= this.ultimoRecebido || typeof e.c !== 'string') return null;
      const ok = await crypto.subtle.verify('HMAC', this.chave, deB64(e.m), TEXTO.encode(`${e.de}|${e.n}|${e.c}`));
      if (!ok) return null;
      this.ultimoRecebido = e.n;
      return JSON.parse(e.c) as Sinal;
    } catch {
      return null;
    }
  }
}

/** O endereço que o QR code leva. É a mesma origem do site (no app, o site é o mesmo do navegador). */
export function enderecoDoCelular(id: string, token: string, segredo: string, origem = window.location.origin): string {
  const raiz = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
  return `${origem}${raiz}#celular=${id}.${token}.${segredo}`;
}

/** O par que veio no endereço do celular, ou null se não é esse endereço. */
export function parDoEndereco(hash = window.location.hash): { id: string; token: string; segredo: string } | null {
  const m = /^#celular=([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(hash);
  return m ? { id: m[1], token: m[2], segredo: m[3] } : null;
}

export type EstadoDoReceptor =
  | { fase: 'esperando'; endereco: string }
  | { fase: 'conectando' }
  | { fase: 'ao-vivo' }
  | { fase: 'falhou'; motivo: 'rede' | 'servidor' }
  /** O celular saiu sem avisar (a conexão caiu, a página fechou de repente). */
  | { fase: 'fechado' }
  /** O celular apertou Parar: de propósito, então a tela só apaga a câmera, sem aviso. */
  | { fase: 'parou' };

/**
 * O lado do COMPUTADOR: abre o par, espera o celular e entrega a faixa de vídeo dele. `aoMudar` recebe cada passo; a faixa
 * chega por `aoChegarFaixa` e deixa de valer quando o estado sai de 'ao-vivo'.
 */
export class ReceptorDoCelular {
  private pc: RTCPeerConnection | null = null;
  private canal: Canal | null = null;
  private id = '';
  private fechado = false;
  private relogio: ReturnType<typeof setTimeout> | null = null;
  private pendentes: RTCIceCandidateInit[] = [];
  private desligar: (() => void)[] = [];

  constructor(
    private socket: Socket,
    private aoMudar: (estado: EstadoDoReceptor) => void,
    private aoChegarFaixa: (faixa: MediaStreamTrack) => void,
  ) {}

  async abrir() {
    const segredo = paraB64(crypto.getRandomValues(new Uint8Array(32)));
    this.canal = await Canal.criar(segredo, 'pc');
    const r = await new Promise<{ id: string; token: string } | { erro: true } | null>((ok) => {
      const t = setTimeout(() => ok(null), 8000);
      this.socket.emit('celular:abrir', null, (resposta: { id: string; token: string } | { erro: true }) => {
        clearTimeout(t);
        ok(resposta);
      });
    });
    if (this.fechado) return;
    if (!r || 'erro' in r) return this.aoMudar({ fase: 'falhou', motivo: 'servidor' });
    this.id = r.id;
    const ouvir = <T>(evento: string, f: (dados: T) => void) => {
      this.socket.on(evento, f);
      this.desligar.push(() => this.socket.off(evento, f));
    };
    ouvir<{ id: string }>('celular:chegou', ({ id }) => {
      if (id !== this.id) return;
      this.aoMudar({ fase: 'conectando' });
      this.relogio = setTimeout(() => this.falhar('rede'), ESPERA_DA_CONEXAO_MS);
    });
    ouvir<{ id: string; dados: string }>('celular:sinal', ({ id, dados }) => {
      if (id === this.id) void this.receber(dados);
    });
    ouvir<{ id: string; motivo: string }>('celular:saiu', ({ id }) => {
      if (id !== this.id || this.fechado) return;
      this.limparConexao();
      this.aoMudar({ fase: 'fechado' });
    });
    this.aoMudar({ fase: 'esperando', endereco: enderecoDoCelular(r.id, r.token, segredo) });
  }

  private async receber(dados: string) {
    const sinal = await this.canal?.abrir(dados);
    if (!sinal || this.fechado) return;
    if (sinal.t === 'oferta') {
      this.limparConexao();
      const pc = new RTCPeerConnection({ iceServers: [] });
      this.pc = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate) void this.mandar({ t: 'ice', c: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        if (e.track.kind !== 'video') return;
        if (this.relogio) clearTimeout(this.relogio);
        this.aoChegarFaixa(e.track);
        this.aoMudar({ fase: 'ao-vivo' });
      };
      pc.onconnectionstatechange = () => {
        if (pc !== this.pc) return;
        if (pc.connectionState === 'failed') this.falhar('rede');
      };
      await pc.setRemoteDescription({ type: 'offer', sdp: sinal.sdp });
      for (const c of this.pendentes.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      const resposta = await pc.createAnswer();
      await pc.setLocalDescription(resposta);
      await this.mandar({ t: 'resposta', sdp: resposta.sdp ?? '' });
    } else if (sinal.t === 'ice') {
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(sinal.c).catch(() => {});
      else this.pendentes.push(sinal.c);
    } else if (sinal.t === 'fim') {
      this.limparConexao();
      this.aoMudar({ fase: 'parou' });
    }
  }

  private async mandar(sinal: Sinal) {
    if (!this.canal || this.fechado) return;
    this.socket.emit('celular:sinal', { id: this.id, dados: await this.canal.selar(sinal) });
  }

  private falhar(motivo: 'rede' | 'servidor') {
    if (this.fechado) return;
    this.limparConexao();
    this.aoMudar({ fase: 'falhou', motivo });
  }

  private limparConexao() {
    if (this.relogio) clearTimeout(this.relogio);
    this.relogio = null;
    this.pc?.close();
    this.pc = null;
    this.pendentes = [];
  }

  fechar() {
    if (this.fechado) return;
    void this.mandar({ t: 'fim' });
    this.fechado = true;
    this.limparConexao();
    if (this.id) this.socket.emit('celular:fechar', { id: this.id });
    for (const f of this.desligar.splice(0)) f();
  }
}

export type EstadoDoEmissor =
  | { fase: 'ligando' }
  | { fase: 'conectando' }
  | { fase: 'ao-vivo' }
  | { fase: 'sem-camera' }
  | { fase: 'recusado' }
  | { fase: 'falhou' }
  | { fase: 'fechado' };

/**
 * O lado do CELULAR: abre a câmera, apresenta-se ao servidor com o par e manda a imagem ao computador. `virar` troca entre
 * a câmera da frente e a de trás sem refazer a conexão (replaceTrack).
 */
export class EmissorDoCelular {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private canal: Canal | null = null;
  private faixa: MediaStreamTrack | null = null;
  private emissor: RTCRtpSender | null = null;
  private fechado = false;
  private pendentes: RTCIceCandidateInit[] = [];
  frente = false;

  constructor(
    private par: { id: string; token: string; segredo: string },
    private aoMudar: (estado: EstadoDoEmissor) => void,
    private aoTerImagem: (stream: MediaStream) => void,
  ) {}

  async iniciar() {
    this.aoMudar({ fase: 'ligando' });
    try {
      this.faixa = await this.abrirCamera();
    } catch {
      return this.aoMudar({ fase: 'sem-camera' });
    }
    if (this.fechado) return this.faixa.stop();
    this.canal = await Canal.criar(this.par.segredo, 'cel');
    const socket = io(`${API_URL}/celular`, { auth: { id: this.par.id, token: this.par.token }, transports: ['websocket'], reconnection: false });
    this.socket = socket;
    socket.on('connect_error', () => this.aoMudar({ fase: 'recusado' }));
    socket.on('disconnect', () => {
      if (!this.fechado) this.encerrar('fechado');
    });
    socket.on('sinal', (dados: string) => void this.receber(dados));
    socket.on('connect', () => void this.oferecer());
  }

  private async abrirCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { ...VIDEO_DO_CELULAR, facingMode: this.frente ? 'user' : 'environment' },
      audio: false,
    });
    this.aoTerImagem(stream);
    return stream.getVideoTracks()[0];
  }

  private async oferecer() {
    if (!this.faixa || this.fechado) return;
    this.aoMudar({ fase: 'conectando' });
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    this.faixa.contentHint = 'motion';
    this.emissor = pc.addTrack(this.faixa, new MediaStream([this.faixa]));
    pc.onicecandidate = (e) => {
      if (e.candidate) void this.mandar({ t: 'ice', c: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.aoMudar({ fase: 'ao-vivo' });
        void this.limitarTaxa();
      } else if (pc.connectionState === 'failed') this.encerrar('falhou');
    };
    const oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);
    await this.mandar({ t: 'oferta', sdp: oferta.sdp ?? '' });
  }

  private async limitarTaxa() {
    if (!this.emissor) return;
    const p = this.emissor.getParameters();
    if (!p.encodings?.length) p.encodings = [{}];
    p.encodings[0].maxBitrate = TAXA_MAXIMA;
    await this.emissor.setParameters(p).catch(() => {});
  }

  private async receber(dados: string) {
    const sinal = await this.canal?.abrir(dados);
    if (!sinal || this.fechado || !this.pc) return;
    if (sinal.t === 'resposta') {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: sinal.sdp });
      for (const c of this.pendentes.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
    } else if (sinal.t === 'ice') {
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(sinal.c).catch(() => {});
      else this.pendentes.push(sinal.c);
    } else if (sinal.t === 'fim') {
      this.encerrar('fechado');
    }
  }

  private async mandar(sinal: Sinal) {
    if (!this.canal || !this.socket) return;
    this.socket.emit('sinal', await this.canal.selar(sinal));
  }

  /** A câmera da frente ou a de trás. */
  async virar() {
    if (!this.faixa || this.fechado) return;
    this.frente = !this.frente;
    const antiga = this.faixa;
    // No celular, duas câmeras abertas ao mesmo tempo costumam falhar: solta a antiga antes de abrir a nova.
    antiga.stop();
    try {
      this.faixa = await this.abrirCamera();
    } catch {
      this.frente = !this.frente;
      this.faixa = await this.abrirCamera().catch(() => null);
      if (!this.faixa) return this.encerrar('sem-camera');
    }
    await this.emissor?.replaceTrack(this.faixa);
  }

  parar() {
    void this.mandar({ t: 'fim' }).finally(() => this.encerrar('fechado'));
  }

  private encerrar(fase: 'fechado' | 'falhou' | 'sem-camera') {
    if (this.fechado) return;
    this.fechado = true;
    this.faixa?.stop();
    this.pc?.close();
    this.socket?.disconnect();
    this.aoMudar({ fase });
  }
}
