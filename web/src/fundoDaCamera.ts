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
import { Ajustador, ajusteAtivo, entradaDaCamera } from './ajusteDaCamera';
import type { Track, TrackProcessor, VideoProcessorOptions } from 'livekit-client';
import { desktopBridge } from './desktop';
import { getSettings } from './settings';

export type EfeitoDoFundo = 'nenhum' | 'desfocar' | 'apagar' | 'imagem';

/** O modelo da vez no processo do app: o modesto (no processador) ou o refinado (pela placa). Ver desktop/src/fundo-camera. */
export type NivelDoFundo = 'modesto' | 'refinado';

/** Por que o refinado desceu ao modesto, para a linha do diário de saúde: um jogo na frente, a placa apertada, ou pouca luz. */
export interface DescidaDoFundo {
  motivo: 'jogo' | 'aperto' | 'escuro';
  exe?: string;
}

/**
 * O que o teste do app lê (e2e/fundo-da-camera-no-app.mjs): o modelo da vez e o tamanho da máscara. Com `medir` ligado pelo
 * teste, a montagem alterna com e sem o filtro guiado, quadro a quadro, e guarda quanto cada uma levou na placa (com uma
 * leitura de 1 pixel no fim, que obriga a placa a terminar; fora do teste, nada disso roda).
 */
type EstadoDoFundo = {
  nivel: NivelDoFundo | null;
  /** o Completo não roda neste computador (sem placa capaz): quem o escolheu recebe o Leve, e a tela diz */
  semRefinado: boolean;
  mascara: [number, number] | null;
  quadros: number;
  /** a última descida do refinado ao modesto, como o processo contou */
  descida: DescidaDoFundo | null;
  medir: boolean;
  montagem: { com: number[]; sem: number[] };
};
const estadoDoFundo: EstadoDoFundo = { nivel: null, semRefinado: false, mascara: null, quadros: 0, descida: null, medir: false, montagem: { com: [], sem: [] } };
(globalThis as { sydenFundoDaCamera?: EstadoDoFundo }).sydenFundoDaCamera = estadoDoFundo;

/**
 * Qual modelo está tirando o fundo AGORA, para a linha das Configurações ("Automático · Completo", "Completo indisponível neste
 * computador"): avisa só quando muda. null = nenhuma câmera com o efeito.
 */
export type ModeloDoFundoAgora = { nivel: NivelDoFundo; semRefinado: boolean } | null;
const ouvintesDoModelo = new Set<(m: ModeloDoFundoAgora) => void>();
let modeloAgora: ModeloDoFundoAgora = null;
function avisarModelo(m: ModeloDoFundoAgora) {
  if (m?.nivel === modeloAgora?.nivel && m?.semRefinado === modeloAgora?.semRefinado) return;
  modeloAgora = m;
  for (const ouvir of ouvintesDoModelo) ouvir(m);
}
export function ouvirModeloDoFundo(ouvir: (m: ModeloDoFundoAgora) => void): () => void {
  ouvintesDoModelo.add(ouvir);
  ouvir(modeloAgora);
  return () => ouvintesDoModelo.delete(ouvir);
}

/** O tamanho do quadro do modesto, o primeiro a ser mandado; depois, o processo diz o tamanho do próximo (`pedir`). */
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

/**
 * A imagem escolhida nesta sessão. O efeito a lê DAQUI primeiro: até 23/11/2026 ele lia só do localStorage, e quando a imagem
 * não cabia lá (o limite é de uns 5 MB por site, dividido com o resto do Syden) a gravação falhava calada e o fundo saía
 * cinza, igual ao "Apagado" (relato de quem usa).
 */
let imagemNaMemoria: string | null = null;

/** A imagem escolhida para o fundo (já reduzida): a desta sessão, ou a guardada neste aparelho. */
export function imagemDoFundo(): string | null {
  if (imagemNaMemoria) return imagemNaMemoria;
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
  imagemNaMemoria = dados;
  // Guardar para a próxima vez: se não couber, tenta uma versão mais leve; se nem ela couber, vale só até fechar o app.
  for (const versao of [dados, canvas.toDataURL('image/jpeg', 0.6)]) {
    try {
      localStorage.setItem(CHAVE_DA_IMAGEM, versao);
      break;
    } catch {
      // sem espaço
    }
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

/**
 * O FILTRO GUIADO NA PLACA (He, Sun e Tang, 2010; a versão "rápida", 17/11/2026, relato dele: "não fica tão refinado quanto o
 * do NVIDIA Broadcast", a franja clara em volta do cabelo). A máscara do modelo é pequena (192 × 192 no modesto) e, ampliada,
 * a borda dela é um borrão que não sabe onde o cabelo acaba: a parede atrás vazava pela borda. O filtro olha o BRILHO do
 * próprio quadro da câmera: perto da borda, a máscara passa a ser uma função linear do brilho (q = a·I + b), e a borda dela
 * cola na borda da imagem. A conta é feita num quadro de até 320 px de largura (os coeficientes são lisos) e ampliada; o
 * brilho da saída é o do quadro cheio. Medida, os parâmetros e a mesma conta em JavaScript: e2e/fundo-da-camera/guiado.mjs.
 */
const GUIADO = { largura: 320, raio: 4, eps: 0.004 };

/** I (o brilho), p (a máscara) e os produtos I·p e I·I, no quadro pequeno; 4 amostras para cobrir a câmera de 1280 também. */
const MOMENTOS = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D img;
uniform sampler2D mascara;
uniform vec2 passo; // meio pixel do quadro pequeno
out vec4 cor;
float brilho(vec2 p) { return dot(texture(img, p).rgb, vec3(0.299, 0.587, 0.114)); }
void main() {
  float i = 0.25 * (brilho(uv + passo * vec2(-0.5, -0.5)) + brilho(uv + passo * vec2(0.5, -0.5)) + brilho(uv + passo * vec2(-0.5, 0.5)) + brilho(uv + passo * vec2(0.5, 0.5)));
  float p = texture(mascara, uv).r;
  cor = vec4(i, p, i * p, i * i);
}`;

/** A média numa janela de 2·raio + 1, numa direção, pixel a pixel (texelFetch: as texturas de 32 bits não filtram). */
const CAIXA = `#version 300 es
precision highp float;
uniform highp sampler2D img;
uniform ivec2 direcao;
uniform int raio;
out vec4 cor;
void main() {
  ivec2 t = ivec2(gl_FragCoord.xy);
  ivec2 lim = textureSize(img, 0) - 1;
  vec4 s = vec4(0.0);
  for (int k = -raio; k <= raio; k++) s += texelFetch(img, clamp(t + direcao * k, ivec2(0), lim), 0);
  cor = s / float(2 * raio + 1);
}`;

/** a = cov(I, p) / (var(I) + eps), b = média(p) − a · média(I). */
const COEFICIENTES = `#version 300 es
precision highp float;
uniform highp sampler2D img;
uniform float eps;
out vec4 cor;
void main() {
  vec4 m = texelFetch(img, ivec2(gl_FragCoord.xy), 0);
  float a = (m.z - m.x * m.y) / (m.w - m.x * m.x + eps);
  cor = vec4(a, m.y - a * m.x, 0.0, 0.0);
}`;

const FINAL = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D camera;
uniform sampler2D mascara;
uniform sampler2D fundo;
uniform highp sampler2D coef; // a e b do filtro guiado, no quadro pequeno
uniform int guiado;
uniform int modo; // 0 = cor, 1 = a imagem, 2 = o desfocado (dividido pelo peso do fundo)
uniform vec3 corDoFundo;
uniform vec2 escalaDoFundo; // a imagem cobrindo o quadro sem esticar
out vec4 cor;
// bilinear à mão: a textura de 32 bits não filtra em toda placa
vec2 coeficientes(vec2 p) {
  vec2 tam = vec2(textureSize(coef, 0));
  vec2 f = clamp(p * tam - 0.5, vec2(0.0), tam - 1.0);
  ivec2 i0 = ivec2(floor(f));
  ivec2 i1 = min(i0 + 1, ivec2(tam) - 1);
  vec2 t = f - vec2(i0);
  vec2 a = mix(texelFetch(coef, i0, 0).xy, texelFetch(coef, ivec2(i1.x, i0.y), 0).xy, t.x);
  vec2 b = mix(texelFetch(coef, ivec2(i0.x, i1.y), 0).xy, texelFetch(coef, i1, 0).xy, t.x);
  return mix(a, b, t.y);
}
void main() {
  vec4 c = texture(camera, uv);
  float m;
  if (guiado == 1) {
    vec2 ab = coeficientes(uv);
    m = clamp(ab.x * dot(c.rgb, vec3(0.299, 0.587, 0.114)) + ab.y, 0.0, 1.0);
  } else m = texture(mascara, uv).r;
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
  /** o filtro guiado: null quando a placa não desenha em textura de 32 bits (EXT_color_buffer_float); aí vai sem ele */
  private guiado: { momentos: WebGLProgram; caixa: WebGLProgram; coef: WebGLProgram; texs: { tex: WebGLTexture; fb: WebGLFramebuffer }[] } | null = null;
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
    if (gl.getExtension('EXT_color_buffer_float')) {
      try {
        this.guiado = { momentos: this.programa(MOMENTOS), caixa: this.programa(CAIXA), coef: this.programa(COEFICIENTES), texs: [] };
      } catch (e) {
        console.warn('[syden] fundo da câmera: a placa recusou o filtro guiado; a borda vai sem ele.', e);
        this.guiado = null;
      }
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const prog of [this.desfoque, this.soOFundo, this.final, ...(this.guiado ? [this.guiado.momentos, this.guiado.caixa, this.guiado.coef] : [])]) {
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
    if (this.guiado) {
      for (const p of this.guiado.texs) {
        gl.deleteTexture(p.tex);
        gl.deleteFramebuffer(p.fb);
      }
      const [gw, gh] = this.tamanhoDoGuiado();
      this.guiado.texs = [0, 1].map(() => {
        const tex = this.textura();
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gw, gh, 0, gl.RGBA, gl.FLOAT, null);
        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fb };
      });
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.warn('[syden] fundo da câmera: a placa não desenha em 32 bits; a borda vai sem o filtro guiado.');
        this.guiado = null;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** O quadro pequeno do filtro guiado: até 320 px de largura, na proporção da câmera. */
  private tamanhoDoGuiado(): [number, number] {
    const gw = Math.min(this.largura, GUIADO.largura);
    return [gw, Math.max(1, Math.round((this.altura * gw) / this.largura))];
  }

  /** A máscara que o processo mandou: do tamanho que o modelo da vez faz (192 × 192 no modesto; maior no refinado). */
  mascara(m: Uint8Array, largura = LADO, altura = LADO) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texMascara);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, largura, altura, 0, gl.RED, gl.UNSIGNED_BYTE, m);
    this.temMascara = true;
  }

  /** Desliga o filtro guiado (só a medida o usa, para comparar com e sem no mesmo quadro). */
  semGuiado = false;

  /** O filtro guiado: os momentos, as médias, os coeficientes e as médias deles. Devolve a textura de a e b. */
  private filtrar(): WebGLTexture | null {
    const g = this.guiado;
    if (!g || this.semGuiado || g.texs.length < 2) return null;
    const gl = this.gl;
    const [gw, gh] = this.tamanhoDoGuiado();
    const [x, y] = g.texs;
    gl.viewport(0, 0, gw, gh);
    // os momentos, do quadro da câmera e da máscara
    gl.useProgram(g.momentos);
    gl.bindFramebuffer(gl.FRAMEBUFFER, x.fb);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texCamera);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texMascara);
    gl.uniform1i(gl.getUniformLocation(g.momentos, 'img'), 0);
    gl.uniform1i(gl.getUniformLocation(g.momentos, 'mascara'), 1);
    gl.uniform2f(gl.getUniformLocation(g.momentos, 'passo'), 0.5 / gw, 0.5 / gh);
    gl.uniform1f(gl.getUniformLocation(g.momentos, 'naTela'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const caixa = (de: WebGLTexture, para: WebGLFramebuffer, dx: number, dy: number) => {
      gl.useProgram(g.caixa);
      gl.bindFramebuffer(gl.FRAMEBUFFER, para);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, de);
      gl.uniform1i(gl.getUniformLocation(g.caixa, 'img'), 0);
      gl.uniform2i(gl.getUniformLocation(g.caixa, 'direcao'), dx, dy);
      gl.uniform1i(gl.getUniformLocation(g.caixa, 'raio'), GUIADO.raio);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    caixa(x.tex, y.fb, 1, 0);
    caixa(y.tex, x.fb, 0, 1);
    gl.useProgram(g.coef);
    gl.bindFramebuffer(gl.FRAMEBUFFER, y.fb);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, x.tex);
    gl.uniform1i(gl.getUniformLocation(g.coef, 'img'), 0);
    gl.uniform1f(gl.getUniformLocation(g.coef, 'eps'), GUIADO.eps);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    caixa(y.tex, x.fb, 1, 0);
    caixa(x.tex, y.fb, 0, 1);
    return y.tex;
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

    const coef = this.filtrar();
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
    gl.activeTexture(gl.TEXTURE3);
    // sem o filtro, a unidade 3 recebe a máscara (8 bits): o shader não a lê, mas um sampler highp sem textura do tipo dele
    // em algumas placas recusa o desenho
    gl.bindTexture(gl.TEXTURE_2D, coef ?? this.texMascara);
    gl.uniform1i(gl.getUniformLocation(p, 'coef'), 3);
    gl.uniform1i(gl.getUniformLocation(p, 'guiado'), coef ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(p, 'camera'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'mascara'), 1);
    gl.uniform1i(gl.getUniformLocation(p, 'fundo'), 2);
    gl.uniform1i(gl.getUniformLocation(p, 'modo'), modo);
    gl.uniform3f(gl.getUniformLocation(p, 'corDoFundo'), ...COR_APAGADA);
    gl.uniform2f(gl.getUniformLocation(p, 'escalaDoFundo'), escala[0], escala[1]);
    gl.uniform1f(gl.getUniformLocation(p, 'naTela'), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Só na medida: lê 1 pixel, o que obriga a placa a terminar o quadro. */
  esperarAPlaca() {
    this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(4));
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
  /** Chamado quando o refinado desce ao modesto (cada descida uma vez); quem usa decide o que vai ao diário. */
  aoDescer: ((d: DescidaDoFundo) => void) | null = null;
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
      // SEM fetch: no site no ar, a política de segurança (connect-src) não deixa buscar um endereço data:, e o fetch falhava
      // calado (o fundo saía cinza, 23/11/2026). O base64 é aberto aqui mesmo.
      const [cabeca, base64] = dados.split(',', 2);
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: /^data:([^;]+)/.exec(cabeca)?.[1] ?? 'image/jpeg' }));
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

    // A conversa com o processo do modelo, aberta SÓ QUANDO UM EFEITO DE FUNDO PEDE (23/11/2026): o processador também serve
    // aos ajustes da imagem (ajusteDaCamera.ts), no navegador inclusive, e ali não há modelo nenhum. Até a porta abrir, o
    // quadro passa só ajustado.
    let porta: MessagePort | null = null;
    let pedindoPorta = false;
    const ajustador = new Ajustador();
    const reduzido = new OffscreenCanvas(LADO, LADO);
    const ctx2d = reduzido.getContext('2d', { willReadFrequently: true });
    let esperando = false;
    let ultimoEnvio = 0;
    let vivo = true;
    let descidas = 0;
    type Resposta = {
      mascara?: Uint8Array;
      largura?: number;
      altura?: number;
      pedir?: [number, number];
      nivel?: NivelDoFundo;
      descida?: (DescidaDoFundo & { n: number }) | null;
      semRefinado?: boolean;
      erro?: string;
    };
    const ligarPorta = (p: MessagePort) => {
      p.onmessage = (ev: MessageEvent<Resposta>) => {
        esperando = false;
        const r = ev.data;
        if (r.mascara && this.montador) {
          const largura = r.largura ?? LADO;
          const altura = r.altura ?? LADO;
          this.montador.mascara(r.mascara, largura, altura);
          estadoDoFundo.nivel = r.nivel ?? 'modesto';
          estadoDoFundo.semRefinado = Boolean(r.semRefinado);
          avisarModelo({ nivel: estadoDoFundo.nivel, semRefinado: estadoDoFundo.semRefinado });
          estadoDoFundo.mascara = [largura, altura];
          estadoDoFundo.quadros++;
          // o processo diz o tamanho do próximo quadro: o do modelo da vez (o app de antes não diz, e fica o de 192)
          const [pw, ph] = r.pedir ?? [LADO, LADO];
          if (pw !== reduzido.width || ph !== reduzido.height) {
            reduzido.width = pw;
            reduzido.height = ph;
          }
          if (r.descida && r.descida.n > descidas) {
            descidas = r.descida.n;
            estadoDoFundo.descida = { motivo: r.descida.motivo, exe: r.descida.exe };
            this.aoDescer?.(estadoDoFundo.descida);
          }
        } else if (r.erro) console.warn('[syden] fundo da câmera:', r.erro);
      };
      p.onmessageerror = () => {
        vivo = false;
      };
      p.start();
    };
    const pedirPorta = () => {
      pedindoPorta = true;
      // sem o app (no navegador), não há modelo: o efeito de fundo não vale, e o quadro segue só ajustado
      if (!this.montador || !desktopBridge?.fundoCamera) {
        vivo = false;
        return;
      }
      void abrirPorta().then((p) => {
        if (!p || !ativo) {
          p?.close();
          vivo = false;
          return;
        }
        porta = p;
        ligarPorta(p);
      });
    };

    let ativo = true;
    this.parar = () => {
      ativo = false;
      avisarModelo(null);
      porta?.close();
      void leitor.cancel().catch(() => {});
      void escritor.close().catch(() => {});
      this.montador?.destruir();
      this.montador = null;
    };

    const laco = async () => {
      while (ativo) {
        const { value: chegou, done } = await leitor.read().catch(() => ({ value: undefined, done: true }));
        if (done || !chegou) break;
        // os AJUSTES DA IMAGEM primeiro (enquadrar, formato, espelho, luz): o modelo do fundo já recebe o quadro enquadrado
        let quadro: VideoFrame = chegou;
        entradaDaCamera.largura = chegou.displayWidth;
        entradaDaCamera.altura = chegou.displayHeight;
        const ajuste = getSettings().ajusteDaCamera;
        if (ajusteAtivo(ajuste)) {
          try {
            const ajustado = ajustador.ajustar(chegou, ajuste);
            if (ajustado) {
              chegou.close();
              quadro = ajustado;
            }
          } catch (e) {
            console.warn('[syden] ajuste da câmera: falhou; o quadro segue como veio.', e);
          }
        }
        const efeito = this.efeito;
        const m = this.montador;
        if (efeito !== 'nenhum' && !pedindoPorta) pedirPorta();
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
          const { width: largura, height: altura } = reduzido;
          ctx2d.drawImage(quadro, 0, 0, largura, altura);
          const pixels = new Uint8Array(ctx2d.getImageData(0, 0, largura, altura).data.buffer);
          esperando = true;
          ultimoEnvio = agora;
          // sem lista de transferência: a porta do Electron (MessagePortMain) não recebe ArrayBuffer transferido, e o quadro
          // chegava inválido; copiar 147 KB (o modesto) a 1,6 MB (o refinado) 15 vezes por segundo não pesa
          // a escolha da pessoa vai em todo quadro: muda na hora, também com a câmera ligada
          porta.postMessage({ pixels, largura, altura, preferencia: getSettings().qualidadeDoFundo });
        }
        // até a primeira máscara chegar, o quadro passa como veio (uns 20 ms ao ligar a câmera)
        if (!m.temMascara) {
          await escritor.write(quadro).catch(() => quadro.close());
          continue;
        }
        let saida: VideoFrame | null = null;
        try {
          if (estadoDoFundo.medir) {
            m.semGuiado = !m.semGuiado;
            const t0 = performance.now();
            m.montar(quadro, efeito);
            m.esperarAPlaca();
            (m.semGuiado ? estadoDoFundo.montagem.sem : estadoDoFundo.montagem.com).push(performance.now() - t0);
          } else {
            m.semGuiado = false;
            m.montar(quadro, efeito);
          }
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

/** Este navegador sabe mexer nos quadros da câmera (Chrome, Edge e o app): é o que os ajustes da imagem pedem. */
export function ajusteDaImagemDisponivel(): boolean {
  const g = globalThis as ComProcessador;
  return Boolean(g.MediaStreamTrackProcessor && g.MediaStreamTrackGenerator && typeof OffscreenCanvas !== 'undefined');
}
