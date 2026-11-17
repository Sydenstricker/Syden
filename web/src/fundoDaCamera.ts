/**
 * O FUNDO DA CÂMERA, como o NVIDIA Broadcast (pedido dele, 14/11/2026; "pode construir", 16/11/2026): desfocar, apagar ou
 * trocar por uma imagem o que está atrás da pessoa. SÓ NO APP: a rede neural (o PP-HumanSeg) roda nativa num processo à
 * parte (desktop/src/fundo-camera/), porque no site ela pediria WebAssembly e o 'wasm-unsafe-eval' que ele decidiu não dar.
 *
 * O CAMINHO DE CADA QUADRO, todo dentro do computador:
 * 1. a câmera entrega o quadro (MediaStreamTrackProcessor);
 * 2. no máximo 15 vezes por segundo, e só com a resposta anterior já de volta, o quadro reduzido a 192 × 192 vai por uma
 *    porta direta ao processo, que devolve a máscara da pessoa já suavizada no tempo (a média que se adapta);
 * 3. a PLACA monta a saída (WebGL2): a máscara ampliada, e atrás dela o próprio quadro desfocado, uma cor ou a imagem
 *    escolhida; todo quadro da câmera sai montado, com a máscara mais recente;
 * 4. o quadro montado vai para a chamada (MediaStreamTrackGenerator), pelo processador de faixa do LiveKit.
 *
 * Se o processo cair, ou a placa recusar, o quadro passa como veio: a câmera nunca fica preta por causa do efeito.
 * Custo medido em 14–15/11/2026 (e2e/fundo-da-camera/README.md): ~0,17 de um núcleo no processo, a 15 por segundo.
 */
import type { Track, TrackProcessor, VideoProcessorOptions } from 'livekit-client';
import { desktopBridge } from './desktop';

export type EfeitoDoFundo = 'nenhum' | 'desfocar' | 'apagar' | 'imagem';

const LADO = 192;
/** O intervalo mínimo entre dois quadros mandados ao modelo (15 por segundo). */
const INTERVALO_DO_MODELO_MS = 66;
/** A cor do fundo apagado: um cinza escuro neutro, que não briga com nenhum dos temas. */
const COR_APAGADA: [number, number, number] = [0.16, 0.17, 0.19];
const CHAVE_DA_IMAGEM = 'syden.fundoDaCamera.imagem';

type ComProcessador = typeof globalThis & {
  MediaStreamTrackProcessor?: new (o: { track: MediaStreamTrack }) => { readable: ReadableStream<VideoFrame> };
  MediaStreamTrackGenerator?: new (o: { kind: 'video' }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> };
};

/** O app sabe rodar o modelo, e este navegador sabe mexer nos quadros da câmera. */
export async function fundoDaCameraDisponivel(): Promise<boolean> {
  const g = globalThis as ComProcessador;
  if (!desktopBridge?.fundoCamera || !g.MediaStreamTrackProcessor || !g.MediaStreamTrackGenerator) return false;
  try {
    return await desktopBridge.fundoCamera.disponivel();
  } catch {
    return false;
  }
}

/** A imagem escolhida para o fundo, guardada neste aparelho (já reduzida). */
export function imagemDoFundo(): string | null {
  try {
    return localStorage.getItem(CHAVE_DA_IMAGEM);
  } catch {
    return null;
  }
}

/** Reduz a imagem escolhida a 1280 × 720 (cortando para caber, como o fundo vai ser mostrado) e a guarda neste aparelho. */
export async function guardarImagemDoFundo(arquivo: Blob): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const escala = Math.max(1280 / bitmap.width, 720 / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (1280 - w) / 2, (720 - h) / 2, w, h);
  bitmap.close();
  const dados = canvas.toDataURL('image/jpeg', 0.85);
  try {
    localStorage.setItem(CHAVE_DA_IMAGEM, dados);
  } catch {
    // sem espaço no aparelho: vale só até fechar o app
  }
  return dados;
}

/** Pede ao app uma porta para o processo do modelo. Chega por window.postMessage (ver desktop/src/preload.js). */
function abrirPorta(): Promise<MessagePort | null> {
  return new Promise((pronto) => {
    const fim = setTimeout(() => {
      window.removeEventListener('message', ouvir);
      pronto(null);
    }, 5000);
    function ouvir(evento: MessageEvent) {
      if (evento.source !== window || evento.data !== 'syden-fundo-camera-porta' || !evento.ports[0]) return;
      clearTimeout(fim);
      window.removeEventListener('message', ouvir);
      pronto(evento.ports[0]);
    }
    window.addEventListener('message', ouvir);
    desktopBridge?.fundoCamera?.abrir();
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// A montagem pela placa
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Toda textura guarda a imagem com a linha 0 EM CIMA (como o quadro da câmera chega). Desenhando na tela, o alto do quadro é o
 * y = +1; desenhando num quadro auxiliar (o desfoque), a linha 0 do quadro é o y = −1. Sem esta diferença, cada passada do
 * desfoque virava a imagem de cabeça para baixo, e o fundo desfocado saía invertido (as almofadas no teto).
 */
const VERTICE = `#version 300 es
in vec2 p;
uniform float naTela;
out vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, naTela > 0.5 ? 0.5 - p.y * 0.5 : 0.5 + p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

/** Copia (reduzindo) ou desfoca numa direção: 9 amostras gaussianas espaçadas pelo passo. */
const DESFOQUE = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D img;
uniform vec2 passo;
out vec4 cor;
void main() {
  float w[5] = float[](0.227, 0.195, 0.122, 0.054, 0.016);
  vec4 s = texture(img, uv) * w[0];
  for (int i = 1; i < 5; i++) {
    s += texture(img, uv + passo * float(i)) * w[i];
    s += texture(img, uv - passo * float(i)) * w[i];
  }
  cor = s;
}`;

/**
 * A primeira passada do desfoque: reduz o quadro guardando SÓ O FUNDO, pesado por quanto cada pixel é fundo (o peso vai no
 * alfa). Desfocado assim e dividido pelo peso no fim, o fundo não puxa a pessoa para dentro dele: sem isso, o cabelo e a
 * roupa escura viravam uma sombra em volta da cabeça.
 */
const SO_O_FUNDO = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D img;
uniform sampler2D mascara;
uniform vec2 passo;
out vec4 cor;
void main() {
  float peso = 1.0 - smoothstep(0.2, 0.6, texture(mascara, uv).r);
  cor = vec4(texture(img, uv).rgb * peso, peso);
}`;

const FINAL = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D camera;
uniform sampler2D mascara;
uniform sampler2D fundo;
uniform int modo; // 0 = cor, 1 = a imagem, 2 = o desfocado (dividido pelo peso do fundo)
uniform vec3 corDoFundo;
uniform vec2 escalaDoFundo; // a imagem cobrindo o quadro sem esticar
out vec4 cor;
void main() {
  vec4 c = texture(camera, uv);
  float m = texture(mascara, uv).r;
  float a = smoothstep(0.3, 0.7, m);
  vec4 f = texture(fundo, (uv - 0.5) * escalaDoFundo + 0.5);
  vec3 atras = modo == 0 ? corDoFundo : modo == 1 ? f.rgb : (f.a > 0.02 ? f.rgb / f.a : c.rgb);
  cor = vec4(mix(atras, c.rgb, a), 1.0);
}`;

class Montador {
  readonly canvas: OffscreenCanvas;
  private gl: WebGL2RenderingContext;
  private desfoque: WebGLProgram;
  private soOFundo: WebGLProgram;
  private final: WebGLProgram;
  private texCamera: WebGLTexture;
  private texMascara: WebGLTexture;
  private texImagem: WebGLTexture | null = null;
  private proporcaoDaImagem = 16 / 9;
  /** os dois quadros pequenos do desfoque (ida e volta) */
  private pequenos: { tex: WebGLTexture; fb: WebGLFramebuffer }[] = [];
  private largura = 0;
  private altura = 0;
  temMascara = false;

  constructor() {
    this.canvas = new OffscreenCanvas(2, 2);
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, desynchronized: true });
    if (!gl) throw new Error('sem WebGL2');
    this.gl = gl;
    this.desfoque = this.programa(DESFOQUE);
    this.soOFundo = this.programa(SO_O_FUNDO);
    this.final = this.programa(FINAL);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const prog of [this.desfoque, this.soOFundo, this.final]) {
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.texCamera = this.textura();
    this.texMascara = this.textura();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  get perdido() {
    return this.gl.isContextLost();
  }

  private programa(fragmento: string): WebGLProgram {
    const gl = this.gl;
    const prog = gl.createProgram()!;
    for (const [tipo, fonte] of [
      [gl.VERTEX_SHADER, VERTICE],
      [gl.FRAGMENT_SHADER, fragmento],
    ] as const) {
      const s = gl.createShader(tipo)!;
      gl.shaderSource(s, fonte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.bindAttribLocation(prog, 0, 'p');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('programa: ' + gl.getProgramInfoLog(prog));
    return prog;
  }

  private textura(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private tamanho(w: number, h: number) {
    if (w === this.largura && h === this.altura) return;
    const gl = this.gl;
    this.largura = this.canvas.width = w;
    this.altura = this.canvas.height = h;
    for (const p of this.pequenos) {
      gl.deleteTexture(p.tex);
      gl.deleteFramebuffer(p.fb);
    }
    // o desfoque roda num quadro de 1/4 do lado: mais forte e 16 vezes mais barato
    const pw = Math.max(1, Math.round(w / 4));
    const ph = Math.max(1, Math.round(h / 4));
    this.pequenos = [0, 1].map(() => {
      const tex = this.textura();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  mascara(m: Uint8Array) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texMascara);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, LADO, LADO, 0, gl.RED, gl.UNSIGNED_BYTE, m);
    this.temMascara = true;
  }

  imagem(img: ImageBitmap | null) {
    const gl = this.gl;
    if (!img) {
      if (this.texImagem) gl.deleteTexture(this.texImagem);
      this.texImagem = null;
      return;
    }
    this.texImagem ??= this.textura();
    gl.bindTexture(gl.TEXTURE_2D, this.texImagem);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    this.proporcaoDaImagem = img.width / img.height;
  }

  private passe(prog: WebGLProgram, origem: WebGLTexture, destino: WebGLFramebuffer | null, w: number, h: number, passo: [number, number]) {
    const gl = this.gl;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, destino);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, origem);
    gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0);
    gl.uniform2f(gl.getUniformLocation(prog, 'passo'), passo[0], passo[1]);
    gl.uniform1f(gl.getUniformLocation(prog, 'naTela'), destino ? 0 : 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Monta o quadro com o efeito. O canvas fica com o resultado. */
  montar(quadro: VideoFrame, efeito: Exclude<EfeitoDoFundo, 'nenhum'>) {
    const gl = this.gl;
    const w = quadro.displayWidth;
    const h = quadro.displayHeight;
    this.tamanho(w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.texCamera);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, quadro);

    let fundo: WebGLTexture | null = null;
    let modo = 0;
    let escala: [number, number] = [1, 1];
    if (efeito === 'desfocar') {
      const [a, b] = this.pequenos;
      const pw = Math.max(1, Math.round(w / 4));
      const ph = Math.max(1, Math.round(h / 4));
      // reduz guardando só o fundo, e depois três idas e voltas: um desfoque forte, que não deixa ler o que está atrás
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texMascara);
      gl.useProgram(this.soOFundo);
      gl.uniform1i(gl.getUniformLocation(this.soOFundo, 'mascara'), 1);
      this.passe(this.soOFundo, this.texCamera, a.fb, pw, ph, [0, 0]);
      for (let i = 0; i < 3; i++) {
        this.passe(this.desfoque, a.tex, b.fb, pw, ph, [2 / pw, 0]);
        this.passe(this.desfoque, b.tex, a.fb, pw, ph, [0, 2 / ph]);
      }
      fundo = a.tex;
      modo = 2;
    } else if (efeito === 'imagem' && this.texImagem) {
      fundo = this.texImagem;
      modo = 1;
      // cobrir o quadro sem esticar: a imagem mais larga que o quadro corta dos lados, e vice-versa
      const q = w / h;
      escala = q > this.proporcaoDaImagem ? [1, this.proporcaoDaImagem / q] : [q / this.proporcaoDaImagem, 1];
    }

    const p = this.final;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texCamera);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texMascara);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, fundo ?? this.texCamera);
    gl.uniform1i(gl.getUniformLocation(p, 'camera'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'mascara'), 1);
    gl.uniform1i(gl.getUniformLocation(p, 'fundo'), 2);
    gl.uniform1i(gl.getUniformLocation(p, 'modo'), modo);
    gl.uniform3f(gl.getUniformLocation(p, 'corDoFundo'), ...COR_APAGADA);
    gl.uniform2f(gl.getUniformLocation(p, 'escalaDoFundo'), escala[0], escala[1]);
    gl.uniform1f(gl.getUniformLocation(p, 'naTela'), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destruir() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// O processador da faixa
// ---------------------------------------------------------------------------------------------------------------------

export class ProcessadorDoFundo implements TrackProcessor<Track.Kind.Video, VideoProcessorOptions> {
  name = 'syden-fundo-da-camera';
  processedTrack?: MediaStreamTrack;
  private efeito: EfeitoDoFundo;
  private parar: (() => void) | null = null;
  private montador: Montador | null = null;
  private imagemPendente: string | null;

  constructor(efeito: EfeitoDoFundo) {
    this.efeito = efeito;
    this.imagemPendente = efeito === 'imagem' ? imagemDoFundo() : null;
  }

  /** Troca o efeito sem reabrir a câmera. */
  async trocar(efeito: EfeitoDoFundo) {
    this.efeito = efeito;
    if (efeito === 'imagem') await this.carregarImagem(imagemDoFundo());
  }

  private async carregarImagem(dados: string | null) {
    this.imagemPendente = dados;
    if (!this.montador) return;
    if (!dados) return this.montador.imagem(null);
    try {
      const bitmap = await createImageBitmap(await (await fetch(dados)).blob());
      this.montador?.imagem(bitmap);
      bitmap.close();
    } catch {
      this.montador?.imagem(null);
    }
  }

  async init({ track }: VideoProcessorOptions) {
    const g = globalThis as ComProcessador;
    const leitor = new g.MediaStreamTrackProcessor!({ track }).readable.getReader();
    const gerador = new g.MediaStreamTrackGenerator!({ kind: 'video' });
    const escritor = gerador.writable.getWriter();
    this.processedTrack = gerador;

    try {
      this.montador = new Montador();
    } catch (e) {
      console.warn('[syden] fundo da câmera: a placa recusou o efeito; a câmera vai como veio.', e);
      this.montador = null;
    }
    if (this.imagemPendente) void this.carregarImagem(this.imagemPendente);

    // a conversa com o processo do modelo
    const porta = this.montador ? await abrirPorta() : null;
    const reduzido = new OffscreenCanvas(LADO, LADO);
    const ctx2d = reduzido.getContext('2d', { willReadFrequently: true });
    let esperando = false;
    let ultimoEnvio = 0;
    let vivo = !!porta;
    if (porta) {
      porta.onmessage = (ev: MessageEvent<{ mascara?: Uint8Array; erro?: string }>) => {
        esperando = false;
        if (ev.data.mascara && this.montador) this.montador.mascara(ev.data.mascara);
        else if (ev.data.erro) console.warn('[syden] fundo da câmera:', ev.data.erro);
      };
      porta.onmessageerror = () => {
        vivo = false;
      };
      porta.start();
    }

    let ativo = true;
    this.parar = () => {
      ativo = false;
      porta?.close();
      void leitor.cancel().catch(() => {});
      void escritor.close().catch(() => {});
      this.montador?.destruir();
      this.montador = null;
    };

    const laco = async () => {
      while (ativo) {
        const { value: quadro, done } = await leitor.read().catch(() => ({ value: undefined, done: true }));
        if (done || !quadro) break;
        const efeito = this.efeito;
        const m = this.montador;
        if (efeito === 'nenhum' || !m || !vivo || m.perdido) {
          await escritor.write(quadro).catch(() => quadro.close());
          continue;
        }
        const agora = performance.now();
        // o processo calado por 2 s caiu (ele responde em ~12 ms): a câmera segue como veio, sem a máscara velha parada
        if (esperando && agora - ultimoEnvio > 2000) {
          console.warn('[syden] fundo da câmera: o processo do modelo não respondeu; a câmera segue como veio.');
          vivo = false;
          await escritor.write(quadro).catch(() => quadro.close());
          continue;
        }
        if (porta && ctx2d && !esperando && agora - ultimoEnvio >= INTERVALO_DO_MODELO_MS) {
          ctx2d.drawImage(quadro, 0, 0, LADO, LADO);
          const pixels = new Uint8Array(ctx2d.getImageData(0, 0, LADO, LADO).data.buffer);
          esperando = true;
          ultimoEnvio = agora;
          // sem lista de transferência: a porta do Electron (MessagePortMain) não recebe ArrayBuffer transferido, e o quadro
          // chegava inválido; copiar 147 KB 15 vezes por segundo não pesa
          porta.postMessage({ pixels });
        }
        // até a primeira máscara chegar, o quadro passa como veio (uns 20 ms ao ligar a câmera)
        if (!m.temMascara) {
          await escritor.write(quadro).catch(() => quadro.close());
          continue;
        }
        let saida: VideoFrame | null = null;
        try {
          m.montar(quadro, efeito);
          saida = new VideoFrame(m.canvas, { timestamp: quadro.timestamp, duration: quadro.duration ?? undefined });
        } catch (e) {
          console.warn('[syden] fundo da câmera: a montagem falhou; a câmera segue como veio.', e);
          vivo = false;
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
