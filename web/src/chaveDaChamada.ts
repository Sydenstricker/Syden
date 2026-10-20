/**
 * A CHAMADA DE PONTA A PONTA (degrau 2 da criptografia, decisão dele em 20/10/2026; ver CLAUDE.md, "Criptografia").
 *
 * O LiveKit cifra cada quadro de voz, vídeo e tela no aparelho de quem manda e decifra no de quem recebe; o servidor
 * de mídia só repassa ruído. O que ele NÃO faz é dizer a cada um qual é a chave dos outros — e é aí que mora a
 * diferença entre ponta a ponta de verdade e de fachada. Se o servidor do Syden entregasse as chaves, ele as
 * conheceria. Por isso:
 *
 * 1. Cada aparelho, ao entrar, cria um par de chaves ECDH (P-256) só para esta chamada e uma chave de mídia SUA,
 *    aleatória. Nada disso sai do aparelho sem embrulho, e nada fica guardado depois de sair da sala.
 * 2. Quem entra manda a sua chave PÚBLICA a cada um que já está na sala ("ola"); quem recebe responde com a dele.
 *    Com as duas públicas, os dois chegam ao MESMO segredo sem que ele passe pela rede (ECDH), e dele sai, por HKDF,
 *    a chave que embrulha (AES-GCM) a chave de mídia de cada um para o outro ("chave").
 * 3. Tudo isso passa pelo socket do Syden (`e2ee:chave`), que só repassa entre duas pessoas da mesma sala e não
 *    consegue abrir o embrulho.
 * 4. Quando alguém SAI, cada um que ficou troca a própria chave de mídia e manda a nova só a quem ficou: quem saiu não
 *    entende mais nada do que vier depois.
 * 5. O que o servidor ainda poderia fazer é trocar as chaves públicas no meio do caminho (fingir ser o outro para
 *    cada um). É contra isso o CÓDIGO DE SEGURANÇA: ele sai de todas as chaves públicas da sala, e se todo mundo vê o
 *    mesmo código, ninguém está no meio. É o mesmo recurso do Zoom e do WhatsApp.
 *
 * As peças são primitivas padrão do navegador (ECDH, HKDF, AES-GCM, pela WebCrypto) e a cifra dos quadros é a do
 * LiveKit; nada de cripto feita em casa. O protocolo que junta as peças é nosso, e é este arquivo: mudou aqui, vale
 * pedir a alguém de fora que releia.
 */
import { BaseKeyProvider, createKeyMaterialFromBuffer } from 'livekit-client';

/** O provedor de chaves que o LiveKit consulta: uma chave POR PESSOA (sharedKey: false), entregue por nós. */
export class ChavesDaChamada extends BaseKeyProvider {
  constructor() {
    // Sem catraca (ratchetWindowSize 0): a chave só muda quando a gente manda. E sem desistir de uma chave por
    // falhas seguidas (failureTolerance -1): ao entrar, os primeiros quadros de alguém chegam antes da chave dele, e
    // falhar ali é o normal, não sinal de chave ruim.
    super({ sharedKey: false, ratchetWindowSize: 0, failureTolerance: -1 });
  }

  definir(material: CryptoKey, identidade: string, indice: number) {
    this.onSetEncryptionKey(material, identidade, indice);
  }
}

type Mensagem = { v: 1; t: 'ola'; pub: string; resposta?: boolean } | { v: 1; t: 'chave'; idx: number; iv: string; ct: string };

const TEXTO = new TextEncoder();
const SAL = TEXTO.encode('syden-chamada-e2ee-v1');
/** O LiveKit guarda 16 chaves por pessoa (keyringSize); o índice dá a volta. */
const ANEL = 16;

const paraB64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

interface Outro {
  pub: Uint8Array<ArrayBuffer>;
  embrulho: CryptoKey;
}

/**
 * Uma chamada: as chaves desta pessoa nesta sala, e o que ela sabe dos outros. Nasce ao entrar e morre ao sair.
 */
export class ChamadaCifrada {
  private outros = new Map<string, Outro>();
  private parDeChaves!: CryptoKeyPair;
  private minhaPub!: Uint8Array<ArrayBuffer>;
  private chaveDeMidia!: Uint8Array<ArrayBuffer>;
  private indice = 0;
  private encerrada = false;
  /**
   * UMA MENSAGEM DE CADA VEZ. O socket entrega em ordem, mas cada mensagem leva um tempo de cripto para ser tratada:
   * sem a fila, a "chave" de alguém começava a ser lida antes de o "ola" dele (que traz a chave pública para abri-la)
   * terminar, e era descartada. O teste pegou isso.
   */
  private fila: Promise<void> = Promise.resolve();

  private constructor(
    private chaves: ChavesDaChamada,
    private eu: string,
    private sala: string,
    private enviar: (para: string, dados: string) => void,
    /** Avisado sempre que o código de segurança pode ter mudado. */
    private aoMudar: () => void,
  ) {}

  static async iniciar(chaves: ChavesDaChamada, eu: string, sala: string, enviar: (para: string, dados: string) => void, aoMudar: () => void) {
    const chamada = new ChamadaCifrada(chaves, eu, sala, enviar, aoMudar);
    chamada.parDeChaves = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    chamada.minhaPub = new Uint8Array(await crypto.subtle.exportKey('raw', chamada.parDeChaves.publicKey));
    // O índice começa num ponto qualquer do anel: um quadro velho, de outra chamada, nunca acerta a chave de agora.
    chamada.indice = crypto.getRandomValues(new Uint8Array(1))[0] % ANEL;
    await chamada.novaChaveDeMidia();
    return chamada;
  }

  /** Quem já está na sala, ao entrar: manda a cada um a chave pública. Quem chega depois é quem manda para nós. */
  apresentarA(identidades: string[]) {
    for (const id of identidades) this.mandar(id, { v: 1, t: 'ola', pub: paraB64(this.minhaPub) });
  }

  /** Uma mensagem de `de`, repassada pelo servidor. Mensagem que não se entende é ignorada, sem derrubar nada. */
  receber(de: string, dados: string) {
    return this.emFila(() => this.tratar(de, dados));
  }

  private emFila(tarefa: () => Promise<void>) {
    this.fila = this.fila.then(tarefa).catch(() => {});
    return this.fila;
  }

  private async tratar(de: string, dados: string) {
    if (this.encerrada || de === this.eu) return;
    let msg: Mensagem;
    try {
      msg = JSON.parse(dados);
    } catch {
      return;
    }
    if (msg?.v !== 1) return;
    if (msg.t === 'ola' && typeof msg.pub === 'string') {
      const pub = deB64(msg.pub);
      const conhecido = this.outros.get(de);
      // A mesma chave de novo (a apresentação repetida, depois de uma reconexão): só reenviar a nossa de mídia.
      if (!conhecido || !iguais(conhecido.pub, pub)) {
        try {
          this.outros.set(de, { pub, embrulho: await this.combinar(de, pub) });
        } catch {
          return; // chave pública inválida
        }
        this.aoMudar();
      }
      if (!msg.resposta) this.mandar(de, { v: 1, t: 'ola', pub: paraB64(this.minhaPub), resposta: true });
      await this.mandarChaveDeMidia(de);
    } else if (msg.t === 'chave' && Number.isInteger(msg.idx) && msg.idx >= 0 && msg.idx < ANEL) {
      const outro = this.outros.get(de);
      if (!outro) return;
      try {
        const aberta = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: deB64(msg.iv), additionalData: TEXTO.encode(`${de}>${this.eu}|${this.sala}|${msg.idx}`) },
          outro.embrulho,
          deB64(msg.ct),
        );
        this.chaves.definir(await createKeyMaterialFromBuffer(aberta), de, msg.idx);
      } catch {
        // Embrulho que não abre: não veio de quem diz, ou foi mexido no caminho. Fica sem a chave, e o quadro dele
        // continua ilegível — o que é o certo.
      }
    }
  }

  /** Alguém saiu: esquece a chave dele e troca a nossa, mandando a nova só a quem ficou. */
  saiu(identidade: string) {
    return this.emFila(() => this.trocarChaveSem(identidade));
  }

  private async trocarChaveSem(identidade: string) {
    if (this.encerrada || !this.outros.delete(identidade)) return;
    this.aoMudar();
    this.indice = (this.indice + 1) % ANEL;
    await this.novaChaveDeMidia();
    await Promise.all([...this.outros.keys()].map((id) => this.mandarChaveDeMidia(id)));
  }

  /** Já temos a chave pública desta pessoa? (Sem ela, o que ela manda ainda não se decifra.) */
  conhece(identidade: string) {
    return this.outros.has(identidade);
  }

  /**
   * O CÓDIGO DE SEGURANÇA: 12 algarismos tirados de todas as chaves públicas da sala, a nossa junto, em ordem de
   * identidade. Todo mundo que tem as mesmas chaves chega ao mesmo código; quem tiver recebido uma chave trocada, não.
   */
  async codigo(): Promise<string> {
    const todos = [[this.eu, this.minhaPub] as const, ...[...this.outros].map(([id, o]) => [id, o.pub] as const)];
    todos.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const resumo = new Uint8Array(await crypto.subtle.digest('SHA-256', TEXTO.encode(todos.map(([id, pub]) => `${id}:${paraB64(pub)}`).join('\n'))));
    // 5 bytes = 40 bits, o bastante para comparar de viva voz: ninguém acerta um código desses por acaso.
    const numero = resumo.slice(0, 5).reduce((n, b) => n * 256 + b, 0) % 1e12;
    return String(numero).padStart(12, '0').replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  encerrar() {
    this.encerrada = true;
    this.outros.clear();
  }

  private async novaChaveDeMidia() {
    this.chaveDeMidia = crypto.getRandomValues(new Uint8Array(32));
    this.chaves.definir(await createKeyMaterialFromBuffer(this.chaveDeMidia.buffer), this.eu, this.indice);
  }

  private async mandarChaveDeMidia(para: string) {
    const outro = this.outros.get(para);
    if (!outro || this.encerrada) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: TEXTO.encode(`${this.eu}>${para}|${this.sala}|${this.indice}`) },
      outro.embrulho,
      this.chaveDeMidia,
    );
    this.mandar(para, { v: 1, t: 'chave', idx: this.indice, iv: paraB64(iv), ct: paraB64(ct) });
  }

  /** ECDH com a pública do outro, e HKDF amarrado à sala e às duas identidades: o mesmo segredo dos dois lados. */
  private async combinar(outro: string, pub: Uint8Array<ArrayBuffer>) {
    const publica = await crypto.subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const segredo = await crypto.subtle.deriveBits({ name: 'ECDH', public: publica }, this.parDeChaves.privateKey, 256);
    const base = await crypto.subtle.importKey('raw', segredo, 'HKDF', false, ['deriveKey']);
    const [a, b] = [this.eu, outro].sort();
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: SAL, info: TEXTO.encode(`${this.sala}|${a}|${b}`) },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private mandar(para: string, msg: Mensagem) {
    if (!this.encerrada) this.enviar(para, JSON.stringify(msg));
  }
}

function iguais(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
