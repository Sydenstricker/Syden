// O GRAVADOR DE CLIPES SEM RECODIFICAR, do lado da página (16/11/2026). Mesma cara do gravarEmRolagem de clips.ts
// (GravacaoEmRolagem), e por isso o botão, o editor e o envio não mudam. A diferença é o que roda enquanto ninguém pede
// clipe: nada além da cópia dos quadros no worker de cifra (ganchoDaCifra.ts). A montagem do arquivo (montar.ts) só
// acontece no "pegar".
//
// AS VOZES DA SALA continuam num MediaRecorder só de áudio (48 kbps em Opus: barato), fechado e recomeçado a cada 30 s
// como hoje. Como o clipe agora começa num quadro-chave que não coincide com o começo da gravação das vozes, as duas
// últimas gravações são decodificadas e postas na MESMA régua do vídeo, num WAV do tamanho exato do clipe: o editor
// (montarClipe) continua contando que o segundo N das vozes é o segundo N do vídeo.
//
// LIGADO DE FÁBRICA no app e no site (decisão dele, 16/11/2026). No APP a cifra vai pelo RTCRtpScriptTransform (o desvio
// de vite.config.ts) e o quadro-chave é PEDIDO quando o último passa de 20 s; no navegador não há como pedir, e o clipe
// abre no quadro-chave que chegou sozinho (o anel guarda até 2 min para trás). Só vale com a chamada cifrada (a de
// fábrica); sem ela, o gravador de antes. Para voltar ao gravador de antes: localStorage 'syden.clipeCru' = 'nao'.
import type { Clipe, GravacaoEmRolagem } from '../clips';
import type { QuadroCru } from './ganchoDaCifra';
import { escolherJanela, montarArquivo } from './montar';

const CANAL = 'syden-clipe-cru';
const SEGUNDOS = 30;
/** Quadro-chave mais velho que isto, e o worker sabe pedir um (só no caminho do RTCRtpScriptTransform): pede. */
const CHAVE_VELHA_MS = 20_000;

export function clipeCruLigado(): boolean {
  try {
    return localStorage.getItem('syden.clipeCru') !== 'nao';
  } catch {
    return true;
  }
}

const agora = () => performance.timeOrigin + performance.now();

/** Pergunta ao worker que tem as faixas. Null se ninguém respondeu no prazo. */
function perguntar<T>(pergunta: string, faixas: string[], prazo = 4000): Promise<T | null> {
  return new Promise((pronto) => {
    const canal = new BroadcastChannel(CANAL);
    const id = Math.random().toString(36).slice(2);
    const fim = setTimeout(() => {
      canal.close();
      pronto(null);
    }, prazo);
    canal.onmessage = (ev) => {
      if (ev.data?.resposta !== id) return;
      clearTimeout(fim);
      canal.close();
      pronto(ev.data as T);
    };
    canal.postMessage({ pergunta, id, faixas });
  });
}

interface Estado {
  agora: number;
  faixas: { id: string; video: boolean; quadros: number; desde: number; ultimaChave: number; podePedirChave: boolean }[];
}

interface GravacaoDeVoz {
  blob: Blob;
  comeco: number;
}

/** As vozes da janela [inicio, fim] (ms na régua da página), num WAV. */
async function vozesAlinhadas(gravacoes: GravacaoDeVoz[], inicio: number, fim: number): Promise<Blob | null> {
  if (!gravacoes.length) return null;
  const TAXA = 48_000;
  const mesa = new OfflineAudioContext(2, Math.max(1, Math.ceil(((fim - inicio) / 1000) * TAXA)), TAXA);
  let alguma = false;
  for (const g of gravacoes) {
    try {
      const buffer = await mesa.decodeAudioData(await g.blob.arrayBuffer());
      const fonte = mesa.createBufferSource();
      fonte.buffer = buffer;
      fonte.connect(mesa.destination);
      const quando = (g.comeco - inicio) / 1000;
      if (quando >= 0) fonte.start(quando);
      else if (-quando < buffer.duration) fonte.start(0, -quando);
      else continue;
      alguma = true;
    } catch {
      // A VOZ NÃO DERRUBA O CLIPE (a regra de clips.ts)
    }
  }
  if (!alguma) return null;
  return wav(await mesa.startRendering());
}

function wav(b: AudioBuffer): Blob {
  const canais = b.numberOfChannels, n = b.length, bytes = n * canais * 2;
  const dv = new DataView(new ArrayBuffer(44 + bytes));
  const txt = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF');
  dv.setUint32(4, 36 + bytes, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, canais, true);
  dv.setUint32(24, b.sampleRate, true);
  dv.setUint32(28, b.sampleRate * canais * 2, true);
  dv.setUint16(32, canais * 2, true);
  dv.setUint16(34, 16, true);
  txt(36, 'data');
  dv.setUint32(40, bytes, true);
  const dados = Array.from({ length: canais }, (_, c) => b.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < canais; c++) {
      const v = Math.max(-1, Math.min(1, dados[c][i]));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}

/** As vozes em rolagem: a gravação em curso e a anterior, cada uma com a hora em que começou. */
function vozesEmRolagem(vozes: MediaStream | null | undefined) {
  const tipo = ['audio/webm;codecs=opus', 'audio/webm'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
  if (!vozes || !tipo || !vozes.getAudioTracks().length) return null;
  let atual: { gravador: MediaRecorder; pedacos: Blob[]; comeco: number } | null = null;
  let anterior: GravacaoDeVoz | null = null;
  let parado = false;
  const comecar = () => {
    try {
      const gravador = new MediaRecorder(vozes, { mimeType: tipo, audioBitsPerSecond: 48_000 });
      const g = { gravador, pedacos: [] as Blob[], comeco: agora() };
      gravador.ondataavailable = (e) => e.data.size > 0 && g.pedacos.push(e.data);
      gravador.start();
      atual = g;
    } catch {
      atual = null;
    }
  };
  const fechar = (): Promise<GravacaoDeVoz | null> =>
    new Promise((pronto) => {
      const g = atual;
      atual = null;
      if (!g || g.gravador.state === 'inactive') return pronto(null);
      g.gravador.onstop = () => pronto(g.pedacos.length ? { blob: new Blob(g.pedacos, { type: 'audio/webm' }), comeco: g.comeco } : null);
      try {
        g.gravador.stop();
      } catch {
        pronto(null);
      }
    });
  comecar();
  const relogio = setInterval(() => {
    if (parado) return;
    void fechar().then((g) => {
      if (g) anterior = g;
      if (!parado) comecar();
    });
  }, SEGUNDOS * 1000);
  return {
    async pegar(): Promise<GravacaoDeVoz[]> {
      const fechada = await fechar();
      const lista = [anterior, fechada].filter((g): g is GravacaoDeVoz => !!g);
      if (fechada) anterior = fechada;
      if (!parado) comecar();
      return lista;
    },
    parar() {
      parado = true;
      clearInterval(relogio);
      void fechar();
    },
  };
}

/**
 * Começa a guardar os quadros das faixas `faixas` (o mediaStreamID de cada RemoteTrack do LiveKit: é por ele que o
 * worker de cifra as conhece). Devolve null quando não há faixa de vídeo para guardar.
 */
export function gravarSemRecodificar(
  faixas: { video: string; audio?: string | null },
  vozes: MediaStream | null,
  reserva: () => GravacaoEmRolagem | null,
): GravacaoEmRolagem | null {
  if (!faixas.video) return reserva();
  const proprio = gravarCru(faixas, vozes);
  // SEM A CIFRA DE PONTA A PONTA (o servidor a desliga numa emergência, ou o navegador não a tem) o gancho nunca vê os
  // quadros: nenhum worker confirma o "gravar", e em 6 s entra o gravador de antes, para o botão não ficar sem clipe.
  let atual: GravacaoEmRolagem = proprio;
  let parado = false;
  const prazo = setTimeout(() => {
    if (parado || proprio.confirmado()) return;
    proprio.parar();
    const outro = reserva();
    if (outro) atual = outro;
  }, 6000);
  return {
    pegar: () => atual.pegar(),
    segundosProntos: () => atual.segundosProntos(),
    parar() {
      parado = true;
      clearTimeout(prazo);
      atual.parar();
    },
  };
}

function gravarCru(faixas: { video: string; audio?: string | null }, vozes: MediaStream | null): GravacaoEmRolagem & { confirmado: () => boolean } {
  const ids = [faixas.video, ...(faixas.audio ? [faixas.audio] : [])];
  let parado = false;
  let gravando = false;
  let prontos = 0;
  let ultimoPedido = 0;
  const daVoz = vozesEmRolagem(vozes);

  const olhar = async () => {
    if (parado) return;
    // a faixa pode chegar ao worker depois de a transmissão aparecer: insiste até ele responder
    if (!gravando) gravando = !!(await perguntar('gravar', ids, 2000));
    if (!gravando || parado) return;
    const e = await perguntar<Estado>('estado', ids, 2000);
    const v = e?.faixas.find((f) => f.video) ?? e?.faixas.find((f) => f.id === faixas.video);
    if (!e || !v) return;
    prontos = Math.min(SEGUNDOS, Math.round((e.agora - v.desde) / 1000));
    if (v.podePedirChave && e.agora - v.ultimaChave > CHAVE_VELHA_MS && e.agora - ultimoPedido > 10_000) {
      ultimoPedido = e.agora;
      void perguntar('pedirChave', [faixas.video], 2000);
    }
  };
  void olhar();
  const relogio = setInterval(() => void olhar(), 1000);

  return {
    async pegar(): Promise<Clipe | null> {
      if (parado) return null;
      const [r, gravacoesDeVoz] = await Promise.all([
        perguntar<{ faixas: { id: string; video: boolean; quadros: QuadroCru[] }[] }>('quadros', ids, 8000),
        daVoz ? daVoz.pegar() : Promise.resolve([]),
      ]);
      if (!r) return null;
      const video = r.faixas.find((f) => f.id === faixas.video)?.quadros ?? [];
      const audio = faixas.audio ? (r.faixas.find((f) => f.id === faixas.audio)?.quadros ?? []) : [];
      const janela = escolherJanela(video, audio, SEGUNDOS);
      if (!janela) return null;
      const arquivo = await montarArquivo(janela);
      const vozesDoClipe = await vozesAlinhadas(gravacoesDeVoz, janela.inicio, janela.fim);
      // o quadro-chave ficou bem antes dos 30 s (no navegador, sem como pedir um): o editor abre nos últimos 30
      const longo = arquivo.segundos > SEGUNDOS + 8;
      return { blob: arquivo.blob, segundos: longo ? SEGUNDOS : Math.round(arquivo.segundos), inicio: longo ? arquivo.segundos - SEGUNDOS : undefined, vozes: vozesDoClipe };
    },
    segundosProntos: () => (parado ? 0 : prontos),
    confirmado: () => gravando,
    parar() {
      if (parado) return;
      parado = true;
      clearInterval(relogio);
      daVoz?.parar();
      void perguntar('parar', ids, 2000);
    },
  };
}
