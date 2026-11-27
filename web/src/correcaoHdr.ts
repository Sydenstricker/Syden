/**
 * A CORREÇÃO DE HDR DA TRANSMISSÃO (27/11/2026, pedido dele; opcional, desligada de fábrica).
 *
 * O PROBLEMA, medido numa transmissão de verdade com o HDR do Windows ligado (duas capturas do mesmo jogo, a tela de quem
 * jogava e a imagem que chegou a quem assistia): a imagem chega mais clara e estourada. A luminância média subiu de 159 para
 * 216, 16,6% dos pixels viraram branco (contra 1%), e as cores saturadas foram puxadas para ciano, amarelo e magenta (a quadra
 * azul, matiz 210°, chegou em 184°; o laranja chegou amarelo). O Syden recebe a captura já convertida pelo Windows, sem os
 * dados HDR: o que foi cortado no teto não volta.
 *
 * O QUE ESTE FILTRO FAZ, e só isso: reduz a exposição em LUZ LINEAR (divide o pixel por um ganho k), deixando em paz o que já é
 * quase branco (as nuvens, o texto branco, a interface). Com os pares de cor medidos (rosa, laranja e amarelo do HUD, mais a
 * quadra; ver web/test/correcaoHdr.test.ts), a distância de cor até a tela original cai de ~53 para ~42 (cerca de 20%), com o
 * melhor ganho em k ≈ 1,4. NÃO restaura o matiz: o azul que virou ciano continua ciano, só menos estourado, porque o canal que
 * foi ao teto perdeu a informação. Restaurar de verdade pede capturar em ponto flutuante, antes do corte (uma obra à parte).
 *
 * POR ISSO É UM CONTROLE, E NÃO UMA CERTEZA: a "Intensidade" vai de 0 a 100% (k de 1,0 a 2,2) e o padrão é 40% (k = 1,48, o
 * melhor ajuste). Calibrado numa só cena de um só jogo: quem tem HDR e vê outra coisa ajusta.
 *
 * COMO RODA: um processador da faixa de tela (como o fundo da câmera, fundoDaCamera.ts): o quadro entra, a PLACA aplica a conta
 * num shader de WebGL2 e o quadro sai para o codificador. Só onde o navegador deixa mexer nos quadros (o app, Chrome e Edge).
 * Se a placa recusar, o quadro passa como veio: a transmissão nunca fica preta por causa do filtro.
 */
import type { Track, TrackProcessor, VideoProcessorOptions } from 'livekit-client';

/** O ganho, em luz linear, com a intensidade em 100%. */
export const K_MAXIMO = 2.2;
/** A intensidade de fábrica: k = 1,48, o melhor ajuste aos pares medidos. */
export const INTENSIDADE_PADRAO = 0.4;
/** O quase-branco que o filtro protege: abaixo de `PROTEGE_DE` (do menor canal, de 0 a 1) corrige inteiro, acima de `PROTEGE_ATE` não mexe. */
export const PROTEGE_DE = 0.7;
export const PROTEGE_ATE = 0.95;

export interface FiltroHdr {
  ligado: boolean;
  /** De 0 a 1. */
  intensidade: number;
}

export const FILTRO_HDR_PADRAO: FiltroHdr = { ligado: false, intensidade: INTENSIDADE_PADRAO };

/** Lê o que veio do disco ou do servidor sem confiar: qualquer coisa fora do formato volta ao padrão. */
export function filtroHdrValido(v: unknown): FiltroHdr {
  const x = (v ?? {}) as Partial<FiltroHdr>;
  const i = typeof x.intensidade === 'number' && Number.isFinite(x.intensidade) ? Math.min(1, Math.max(0, x.intensidade)) : INTENSIDADE_PADRAO;
  return { ligado: x.ligado === true, intensidade: i };
}

/** O ganho em luz linear para uma intensidade. */
export function kDaIntensidade(intensidade: number): number {
  return 1 + (K_MAXIMO - 1) * Math.min(1, Math.max(0, intensidade));
}

// ---------- A conta (a mesma do shader, para testar sem placa) ----------

const decodifica = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const codifica = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Corrige um pixel de 8 bits (R, G, B de 0 a 255) com o ganho `k`. É o que o shader faz. */
export function corrigirPixel(rgb: readonly [number, number, number], k: number): [number, number, number] {
  const protegido = suave(PROTEGE_DE, PROTEGE_ATE, Math.min(rgb[0], rgb[1], rgb[2]) / 255);
  const fator = (1 - protegido) / k + protegido;
  return rgb.map((v) => Math.round(255 * codifica(decodifica(v / 255) * fator))) as [number, number, number];
}

// ---------- O shader ----------

const VERTICE = `#version 300 es
out vec2 uv;
void main() {
  // um triângulo que cobre a tela; o quadro entra de cabeça para cima na textura, então o eixo y desce
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENTO = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D quadro;
uniform float k;
out vec4 saida;
vec3 decodifica(vec3 v) { return mix(v / 12.92, pow((v + 0.055) / 1.055, vec3(2.4)), step(0.04045, v)); }
vec3 codifica(vec3 x) { return mix(x * 12.92, 1.055 * pow(x, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, x)); }
void main() {
  vec3 c = texture(quadro, uv).rgb;
  float protegido = smoothstep(${PROTEGE_DE.toFixed(2)}, ${PROTEGE_ATE.toFixed(2)}, min(c.r, min(c.g, c.b)));
  float fator = (1.0 - protegido) / k + protegido;
  saida = vec4(codifica(decodifica(c) * fator), 1.0);
}`;

// ---------- O processador da faixa ----------

type ComProcessador = typeof globalThis & {
  MediaStreamTrackProcessor?: new (o: { track: MediaStreamTrack }) => { readable: ReadableStream<VideoFrame> };
  MediaStreamTrackGenerator?: new (o: { kind: 'video' }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> };
};

/** Este navegador sabe mexer nos quadros da transmissão (o app, Chrome e Edge)? */
export function correcaoHdrDisponivel(): boolean {
  const g = globalThis as ComProcessador;
  return Boolean(g.MediaStreamTrackProcessor && g.MediaStreamTrackGenerator && typeof OffscreenCanvas !== 'undefined');
}

/** A tela está em HDR agora? (A consulta de CSS `dynamic-range: high`; serve para a tela dizer "o seu monitor está em HDR".) */
export function monitorEmHdr(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(dynamic-range: high)').matches;
}

class Placa {
  readonly canvas = new OffscreenCanvas(2, 2);
  private readonly gl: WebGL2RenderingContext;
  private readonly uQuadro: WebGLUniformLocation;
  private readonly uK: WebGLUniformLocation;
  perdida = false;

  constructor() {
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
    if (!gl) throw new Error('sem WebGL2');
    this.gl = gl;
    const compila = (tipo: number, fonte: string) => {
      const s = gl.createShader(tipo)!;
      gl.shaderSource(s, fonte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader recusado');
      return s;
    };
    const programa = gl.createProgram()!;
    gl.attachShader(programa, compila(gl.VERTEX_SHADER, VERTICE));
    gl.attachShader(programa, compila(gl.FRAGMENT_SHADER, FRAGMENTO));
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programa) ?? 'programa recusado');
    gl.useProgram(programa);
    this.uQuadro = gl.getUniformLocation(programa, 'quadro')!;
    this.uK = gl.getUniformLocation(programa, 'k')!;
    const textura = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.uQuadro, 0);
    this.canvas.addEventListener('webglcontextlost', () => {
      this.perdida = true;
    });
  }

  /** Desenha o quadro corrigido no canvas, do tamanho dele. */
  desenhar(quadro: VideoFrame, k: number) {
    const gl = this.gl;
    const largura = quadro.displayWidth;
    const altura = quadro.displayHeight;
    if (this.canvas.width !== largura || this.canvas.height !== altura) {
      this.canvas.width = largura;
      this.canvas.height = altura;
    }
    gl.viewport(0, 0, largura, altura);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, quadro as unknown as TexImageSource);
    gl.uniform1f(this.uK, k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destruir() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export class ProcessadorDoHdr implements TrackProcessor<Track.Kind.Video, VideoProcessorOptions> {
  name = 'syden-correcao-hdr';
  processedTrack?: MediaStreamTrack;
  private parar: (() => void) | null = null;

  /** `lerFiltro` devolve as preferências de agora: o laço a pergunta a cada quadro, e a intensidade muda na hora. */
  constructor(private readonly lerFiltro: () => FiltroHdr) {}

  async init({ track }: VideoProcessorOptions) {
    const g = globalThis as ComProcessador;
    const leitor = new g.MediaStreamTrackProcessor!({ track }).readable.getReader();
    const gerador = new g.MediaStreamTrackGenerator!({ kind: 'video' });
    const escritor = gerador.writable.getWriter();
    this.processedTrack = gerador;
    // O codificador lê a dica de conteúdo (movimento ou detalhe) da faixa que SAI do processador, e a otimização da
    // transmissão (useVoice.ts) a muda na faixa de ORIGEM: o laço a copia, para a escolha continuar valendo.
    gerador.contentHint = track.contentHint;

    let placa: Placa | null = null;
    try {
      placa = new Placa();
    } catch (e) {
      console.warn('[syden] correção de HDR: a placa recusou o filtro; a transmissão vai como veio.', e);
    }

    let ativo = true;
    this.parar = () => {
      ativo = false;
      void leitor.cancel().catch(() => {});
      void escritor.close().catch(() => {});
      placa?.destruir();
      placa = null;
    };

    const laco = async () => {
      while (ativo) {
        const { value: quadro, done } = await leitor.read().catch(() => ({ value: undefined, done: true }));
        if (done || !quadro) break;
        if (gerador.contentHint !== track.contentHint) gerador.contentHint = track.contentHint;
        const filtro = filtroHdrValido(this.lerFiltro());
        const k = kDaIntensidade(filtro.intensidade);
        if (!placa || placa.perdida || !filtro.ligado || k <= 1.001) {
          await escritor.write(quadro).catch(() => quadro.close());
          continue;
        }
        let saida: VideoFrame | null = null;
        try {
          placa.desenhar(quadro, k);
          saida = new VideoFrame(placa.canvas, { timestamp: quadro.timestamp, duration: quadro.duration ?? undefined });
        } catch (e) {
          console.warn('[syden] correção de HDR: falhou; a transmissão segue como veio.', e);
          placa.perdida = true;
        }
        if (saida) {
          quadro.close();
          await escritor.write(saida).catch(() => saida!.close());
        } else await escritor.write(quadro).catch(() => quadro.close());
      }
    };
    void laco();
  }

  async restart(opts: VideoProcessorOptions) {
    await this.destroy();
    await this.init(opts);
  }

  async destroy() {
    this.parar?.();
    this.parar = null;
    this.processedTrack?.stop();
    this.processedTrack = undefined;
  }
}
