import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { caixa, carregar, copia, FACE_PARA_CIMA, juntar, textura, type Bloco } from '../cidades3d/cena';
import { carregarCoelho, copiarCoelho, CORES_DO_MASCOTE, type MaterialDoCoelho } from '../coelho3d';
import { carregarModelo as carregarDaMesa } from '../mesa3d/base';
import type { CenaDeMesa } from '../mesa3d/useCena3D';
import {
  ANEL,
  CASAS_DA_VOLTA,
  CURVA_DA_VOLTA,
  HORTA,
  lotesDaCidade,
  PRACA,
  RAIO_DA_CASA,
  retanguloCurvo,
  RUAS_PARA_FORA,
  TOCA,
  TRILHO,
} from './volta';

/**
 * O TABULEIRO DA TURMA EM 3D (05/11/2026, pedido dele: "os elementos de tabuleiro usados no Capitais, e uma mini cidade no
 * cenário, como existe nos tabuleiros de festa; cada jogador vê a sua câmera"). Só a TELA: o servidor decide tudo, e o desenho
 * em SVG de JogoTabuleiro.tsx fica de reserva (estilo 2D, sem WebGL, ou enquanto isto carrega) e para o leitor de tela.
 *
 * - A VOLTA serpenteia no meio de uma cidadezinha (volta.ts): 30 discos com a cara do tipo (+3 verde, −3 vermelho, o evento roxo,
 *   a largada quadriculada com a bandeira). A ordem e o número são os do servidor; o lugar é só desenho.
 * - A CENOURA DOURADA é peça: gira em cima da barraca dela, ao lado da casa onde está, e quando muda de casa voa até a nova.
 * - Cada pessoa é o NOSSO coelho 3D (coelho3d.ts), com as cores do avatar, e pula casa a casa no ritmo do servidor (a casa de
 *   agora vem de fora, contada como no 2D).
 * - A CIDADE é enfeite: casas e lojas da Kenney (CC0, as mesmas do Capitais), em MALHAS INSTANCIADAS (uma chamada de desenho
 *   por modelo), o anel dos carros, o trem por fora, árvores, a praça com o chafariz, a horta e a toca no meio. Com "menos
 *   movimento" no sistema, nada disso se mexe.
 * - A CÂMERA É DE CADA UM (nada vai à rede): na vista geral, a volta inteira; enquanto alguém anda, ela acompanha a peça; arrastar
 *   gira, a roda (ou a pinça) aproxima, e "Ver tudo" volta à vista geral. Ela só olha o que o estado diz: a peça seguida é a que
 *   o servidor mandou andar, no passo que a página contou.
 * - Sem foco na janela, nada é desenhado; as sombras de verdade só com "Sombras" em Gráficos.
 */

export interface PecaDoTabuleiro3D {
  userId: number;
  /** A casa onde a peça está AGORA na tela (o andar casa a casa vem contado de fora). */
  pos: number;
  /** null: o pelo do mascote. */
  pelo: string | null;
  roupa: string;
  vez: boolean;
  presente: boolean;
}
export interface DadosDoTabuleiro3D {
  casas: string[];
  pecas: PecaDoTabuleiro3D[];
  dourada: number;
  /** O andar desta jogada (de quando o dado saiu até a próxima vez): a câmera segue a peça, e o dado flutua em cima dela. */
  andando: { id: number; userId: number; dado: number } | null;
  /** O que a casa fez, ao chegar: um número que sobe da peça. */
  efeitos: { id: string; userId: number; texto: string; bom: boolean }[];
  /** Muda quando a pessoa aperta "Ver tudo". */
  verTudo: number;
}

/** O que a cena avisa à página pelo `aoClicar`: a câmera saiu da vista geral (1) ou voltou a ela (0). */
export const CAMERA_LIVRE = 1;
export const CAMERA_GERAL = 0;

const ALTURA_DO_COELHO = 0.64;
const ALTURA_DA_CASA = 0.09;
const PULO_MS = 230;
const PULO_LONGE_MS = 650;
const ELEVACAO = 0.95;
const DISTANCIA_SEGUINDO = 5.0;
/** A barraca da cenoura dourada fica ao lado da casa, por fora da volta, a esta distância do centro. */
const BARRACA_FORA = 0.66;
const VOO_DA_DOURADA_MS = 1400;
const ESCALA_DO_DADO = 0.38;
const GIRO_DO_DADO_MS = 650;

const CASAS_DO_SUBURBIO = ['a', 'c', 'e', 'g', 'j', 'm', 'p', 's'].map((l) => `suburbio/building-type-${l}.glb`);
const LOJAS = ['comercio/building-j.glb', 'comercio/building-l.glb'];
const ARVORES = ['suburbio/tree-large.glb', 'suburbio/tree-small.glb'];
const CARROS = ['carros/taxi.glb', 'carros/sedan.glb', 'carros/delivery.glb', 'carros/suv.glb', 'carros/van.glb', 'carros/sedan.glb'];
const TREM = ['trem/train-locomotive-a.glb', 'trem/train-carriage-box.glb', 'trem/train-carriage-container-red.glb'];
const TODOS = [...new Set([...CASAS_DO_SUBURBIO, ...LOJAS, ...ARVORES, ...CARROS, ...TREM, 'suburbio/planter.glb', 'comercio/detail-parasol-a.glb', 'comercio/detail-parasol-b.glb'])];

/** O mundo pintado no chão vai de -MUNDO_X a MUNDO_X e de -MUNDO_Z a MUNDO_Z. */
const MUNDO_X = 15;
const MUNDO_Z = 13;
const PPU_DO_CHAO = 64;

/** As cores de cada tipo de casa: a face de cima e o lado. */
const COR_DO_TIPO: Record<string, [string, string]> = {
  i: ['#f3ead8', '#b8a284'],
  '+': ['#74c160', '#4f8f3f'],
  '-': ['#de6a52', '#a3443a'],
  '?': ['#9a86d0', '#6a5a9e'],
};

interface Peca {
  raiz: THREE.Group;
  corpo: THREE.Group;
  sombra: THREE.Mesh;
  marca: THREE.Mesh;
  mat: MaterialDoCoelho;
  descartar: () => void;
  mixer: THREE.AnimationMixer;
  acoes: Map<string, THREE.AnimationAction>;
  tocando: string;
  casa: number;
  de: THREE.Vector3;
  para: THREE.Vector3;
  inicio: number;
  duracao: number;
  rumo: number;
  pelo: string | null;
  roupa: string;
  vez: boolean;
}

interface Arvore {
  malhas: THREE.InstancedMesh[];
  base: THREE.Matrix4[];
  locais: THREE.Matrix4[];
  fase: number[];
}

/** Um círculo pintado: o fundo da cor do tipo, a borda clara e o desenho do tipo por cima. */
function pintarTopo(tipo: string): THREE.CanvasTexture {
  const L = 128;
  const c = document.createElement('canvas');
  c.width = c.height = L;
  const g = c.getContext('2d')!;
  const [cor] = COR_DO_TIPO[tipo] ?? COR_DO_TIPO.i;
  g.fillStyle = cor;
  g.fillRect(0, 0, L, L);
  if (tipo === 'i') {
    // a largada: o quadriculado
    const t = 16;
    for (let y = 0; y < L / t; y++)
      for (let x = 0; x < L / t; x++) {
        g.fillStyle = (x + y) % 2 ? '#fffaf0' : '#3a3434';
        g.fillRect(x * t, y * t, t, t);
      }
  }
  const brilho = g.createRadialGradient(L * 0.4, L * 0.35, 4, L / 2, L / 2, L * 0.55);
  brilho.addColorStop(0, 'rgba(255,255,255,0.28)');
  brilho.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = brilho;
  g.fillRect(0, 0, L, L);
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(255,250,235,0.85)';
  g.beginPath();
  g.arc(L / 2, L / 2, L / 2 - 8, 0, Math.PI * 2);
  g.stroke();
  g.lineJoin = 'round';
  const contorno = 'rgba(40,30,30,0.55)';
  const sinal = (rets: [number, number, number, number][]) => {
    g.fillStyle = contorno;
    for (const [x, y, w, h] of rets) g.fillRect(x - 5, y - 5, w + 10, h + 10);
    g.fillStyle = '#fffaf0';
    for (const [x, y, w, h] of rets) g.fillRect(x, y, w, h);
  };
  if (tipo === '+')
    sinal([
      [L / 2 - 30, L / 2 - 9, 60, 18],
      [L / 2 - 9, L / 2 - 30, 18, 60],
    ]);
  else if (tipo === '-') sinal([[L / 2 - 30, L / 2 - 9, 60, 18]]);
  else if (tipo === '?') {
    g.font = '900 78px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = contorno;
    g.strokeText('?', L / 2, L / 2 + 4);
    g.fillStyle = '#ffe9a0';
    g.fillText('?', L / 2, L / 2 + 4);
  }
  return textura(c);
}

/** O brilho redondo (no chão, por baixo da peça da vez e da casa da dourada). */
function pintarBrilho(cor: string): THREE.CanvasTexture {
  const L = 128;
  const c = document.createElement('canvas');
  c.width = c.height = L;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(L / 2, L / 2, L * 0.12, L / 2, L / 2, L * 0.5);
  grad.addColorStop(0, cor);
  grad.addColorStop(1, 'rgba(255,230,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, L, L);
  return textura(c);
}

/** O texto que sobe da peça ("+3 🥕"). */
function pintarEfeito(texto: string, bom: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '900 64px system-ui, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(40,30,30,0.75)';
  g.strokeText(texto, 128, 50);
  g.fillStyle = bom ? '#c8f59a' : '#ffb3a0';
  g.fillText(texto, 128, 50);
  return textura(c);
}

/** Cópias instanciadas de um modelo (uma por malha dele), com a base no chão e `largura` no maior lado. */
function instanciar(g: GLTF, largura: number, matrizes: THREE.Matrix4[], sombra: boolean): { malhas: THREE.InstancedMesh[]; locais: THREE.Matrix4[] } {
  const raiz = g.scene;
  raiz.updateMatrixWorld(true);
  const cx = new THREE.Box3().setFromObject(raiz);
  const tam = cx.getSize(new THREE.Vector3());
  const centro = cx.getCenter(new THREE.Vector3());
  const s = largura / Math.max(tam.x, tam.z, 1e-6);
  const norm = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-centro.x, -cx.min.y, -centro.z));
  const malhas: THREE.InstancedMesh[] = [];
  const locais: THREE.Matrix4[] = [];
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, matrizes.length);
    const local = norm.clone().multiply(m.matrixWorld);
    matrizes.forEach((mt, k) => im.setMatrixAt(k, mt.clone().multiply(local)));
    im.castShadow = sombra;
    im.receiveShadow = sombra;
    im.frustumCulled = false;
    malhas.push(im);
    locais.push(local);
  });
  return { malhas, locais };
}

const matriz = (x: number, y: number, z: number, rumo = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rumo), new THREE.Vector3(s, s, s));

/** O centro da casa `i` da volta, no chão. */
export function centroDaCasa(i: number): THREE.Vector3 {
  const c = CASAS_DA_VOLTA[((i % 30) + 30) % 30];
  return new THREE.Vector3(c.x, ALTURA_DA_CASA, c.z);
}
/** Onde fica a barraca da dourada quando ela está na casa `i`. */
function lugarDaBarraca(i: number): THREE.Vector3 {
  const c = CASAS_DA_VOLTA[((i % 30) + 30) % 30];
  return new THREE.Vector3(c.x + c.fora[0] * BARRACA_FORA, 0, c.z + c.fora[1] * BARRACA_FORA);
}

export class CenaDoTabuleiro implements CenaDeMesa<DadosDoTabuleiro3D> {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 120);
  private modelos = new Map<string, GLTF>();
  private coelho: GLTF | null = null;
  private pecas = new Map<number, Peca>();
  private dados: DadosDoTabuleiro3D | null = null;
  private pronta = false;
  private morta = false;
  private sombras: boolean;
  private calmo: boolean;
  private relogio = new THREE.Timer();
  private observador: ResizeObserver;
  private descartaveis: { dispose(): void }[] = [];
  private instancias: THREE.InstancedMesh[] = [];
  /** A cor em cada vértice, das peças feitas por código. */
  private matCor = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  private quadro = 0;

  // as casas da volta
  private corpos: THREE.InstancedMesh | null = null;
  private topos = new Map<string, THREE.InstancedMesh>();
  private tiposVistos = '';

  // a cenoura dourada e a barraca dela
  private dourada = new THREE.Group();
  private cenoura = new THREE.Group();
  private barraca = new THREE.Group();
  private brilhoDaDourada: THREE.Mesh | null = null;
  private casaDaDourada = -1;
  private vooDaDourada: { de: THREE.Vector3; para: THREE.Vector3; inicio: number } | null = null;

  // o dado em cima de quem anda
  private dado: THREE.Object3D | null = null;
  private giro: { id: number; inicio: number; eixo: THREE.Vector3 } | null = null;
  private dadoVisto: number | null = null;

  // os efeitos que sobem
  private efeitosVistos = new Set<string>();
  private primeiroEstado = true;
  private subindo: { sprite: THREE.Sprite; userId: number; inicio: number }[] = [];

  // o brilho da vez
  private brilhoDaVez: THREE.Mesh | null = null;

  // o enfeite que se mexe
  private carros: { obj: THREE.Object3D; curva: THREE.CatmullRomCurve3; u: number; vel: number }[] = [];
  private trem: THREE.Object3D[] = [];
  private trilho = retanguloCurvo(TRILHO.rx, TRILHO.rz, TRILHO.canto, 0.06);
  private arvores: Arvore[] = [];
  private agua: THREE.Mesh | null = null;

  // a câmera de cada um
  private azimute = 0;
  private elevacao = ELEVACAO;
  private zoom = 1;
  private forcarGeral = false;
  private andandoVisto: number | null = null;
  private verTudoVisto = 0;
  private livreAvisado = false;
  private alvo = new THREE.Vector3();
  private distAtual = 10;
  private ponteiros = new Map<number, { x: number; y: number }>();
  private pinca = 0;

  /** O medidor do teste: ms de CPU por quadro e o intervalo entre quadros (os últimos 240). */
  private tempos: number[] = [];
  private intervalos: number[] = [];
  private ultimoQuadro = 0;

  constructor(
    private caixaDaTela: HTMLElement,
    private avisar: (alvo: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    let sombras = false;
    try {
      sombras = !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
    } catch {
      /* sem */
    }
    this.sombras = sombras;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const tela = this.renderer.domElement;
    tela.className = 'tab3d-tela';
    caixaDaTela.appendChild(tela);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixaDaTela);
    this.medir();
    tela.addEventListener('pointerdown', this.aoApertar);
    tela.addEventListener('pointermove', this.aoMover);
    tela.addEventListener('pointerup', this.aoSoltar);
    tela.addEventListener('pointercancel', this.aoSoltar);
    tela.addEventListener('wheel', this.aoRolar, { passive: false });
    this.descartaveis.push(this.matCor);
    if (import.meta.env.DEV) (window as unknown as { cenaDoTabuleiro?: CenaDoTabuleiro }).cenaDoTabuleiro = this;
  }

  async montar(): Promise<void> {
    const [lista, coelho, dado] = await Promise.all([
      Promise.all(TODOS.map((a) => carregar(a).then((g) => [a, g] as const))),
      carregarCoelho(),
      carregarDaMesa('D6_A'),
    ]);
    if (this.morta) return;
    for (const [a, g] of lista) this.modelos.set(a, g);
    this.coelho = coelho;
    this.montarFixo();
    const d = dado.scene.clone(true);
    d.scale.setScalar(ESCALA_DO_DADO);
    d.visible = false;
    d.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = this.sombras;
    });
    this.cena.add(d);
    this.dado = d;
    this.pronta = true;
    if (this.dados) this.aplicar(this.dados);
    this.renderer.setAnimationLoop(this.desenhar);
  }

  atualizar(d: DadosDoTabuleiro3D) {
    this.dados = d;
    if (!this.pronta || this.morta) return;
    this.aplicar(d);
  }

  private medir() {
    const w = Math.max(1, this.caixaDaTela.clientWidth);
    const h = Math.max(1, this.caixaDaTela.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ———————————————————————————— o que não muda ————————————————————————————

  private montarFixo() {
    const c = this.cena;
    c.background = new THREE.Color('#bfe4f2');
    c.fog = new THREE.Fog('#bfe4f2', 20, 40);
    c.add(new THREE.HemisphereLight('#fff6e8', '#7fae6a', 1.6));
    const sol = new THREE.DirectionalLight('#fff1d6', 2.2);
    sol.position.set(-6, 13, 7);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -12;
      s.right = 12;
      s.top = 10;
      s.bottom = -10;
      s.near = 1;
      s.far = 40;
      sol.shadow.bias = -0.0008;
      sol.shadow.normalBias = 0.02;
    }
    c.add(sol);
    this.montarChao();
    this.montarCasasDaVolta();
    this.montarCidade();
    this.montarMiolo();
    this.montarDourada();
    // o brilho de quem está na vez
    {
      const t = pintarBrilho('rgba(255,240,180,0.9)');
      const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const geo = new THREE.PlaneGeometry(1.25, 1.25).rotateX(-Math.PI / 2);
      this.brilhoDaVez = new THREE.Mesh(geo, m);
      this.brilhoDaVez.renderOrder = 2;
      this.brilhoDaVez.visible = false;
      c.add(this.brilhoDaVez);
      this.descartaveis.push(t, m, geo);
    }
  }

  /** O chão inteiro numa imagem só: a grama, as ruas, o caminho da volta, a horta, a praça e os quintais. */
  private montarChao() {
    const P = PPU_DO_CHAO;
    const cv = document.createElement('canvas');
    cv.width = MUNDO_X * 2 * P;
    cv.height = MUNDO_Z * 2 * P;
    const g = cv.getContext('2d')!;
    const X = (x: number) => (x + MUNDO_X) * P;
    const Z = (z: number) => (z + MUNDO_Z) * P;
    g.fillStyle = '#8fcf6f';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < cv.height; y += 36) g.fillRect(0, y, cv.width, 18);
    const ret = (rx: number, rz: number, r: number) => {
      const x = X(-rx);
      const y = Z(-rz);
      const w = rx * 2 * P;
      const h = rz * 2 * P;
      const rr = r * P;
      g.beginPath();
      g.moveTo(x + rr, y);
      g.arcTo(x + w, y, x + w, y + h, rr);
      g.arcTo(x + w, y + h, x, y + h, rr);
      g.arcTo(x, y + h, x, y, rr);
      g.arcTo(x, y, x + w, y, rr);
      g.closePath();
    };
    // o leito do trem
    g.lineWidth = 0.55 * P;
    g.strokeStyle = '#cdb994';
    ret(TRILHO.rx, TRILHO.rz, TRILHO.canto);
    g.stroke();
    // os quintais das casas (um gramado mais claro) e o caminho até a rua
    for (const l of lotesDaCidade()) {
      g.save();
      g.translate(X(l.x), Z(l.z));
      g.rotate(-l.rumo);
      g.fillStyle = l.tipo === 'comercio' ? '#e3d8c4' : '#a3da84';
      g.fillRect(-0.8 * P, -0.7 * P, 1.6 * P, 1.45 * P);
      g.fillStyle = '#e6dccb';
      g.fillRect(-0.12 * P, 0.4 * P, 0.24 * P, 0.75 * P);
      g.restore();
    }
    // as ruas: a calçada, o asfalto e a faixa
    const ruas = (largura: number, cor: string, tracejado = false) => {
      g.lineWidth = largura * P;
      g.strokeStyle = cor;
      if (tracejado) g.setLineDash([16, 14]);
      ret(ANEL.rx, ANEL.rz, ANEL.canto);
      g.stroke();
      for (const r of RUAS_PARA_FORA) {
        const vertical = r.x1 - r.x0 < r.z1 - r.z0;
        g.beginPath();
        if (vertical) {
          g.moveTo(X((r.x0 + r.x1) / 2), Z(r.z0));
          g.lineTo(X((r.x0 + r.x1) / 2), Z(r.z1));
        } else {
          g.moveTo(X(r.x0), Z((r.z0 + r.z1) / 2));
          g.lineTo(X(r.x1), Z((r.z0 + r.z1) / 2));
        }
        g.stroke();
      }
      g.setLineDash([]);
    };
    ruas(ANEL.largura + 0.22, '#e3d8c4');
    ruas(ANEL.largura, '#7b7f88');
    g.lineWidth = 3;
    ruas(0.04, 'rgba(255,236,170,0.85)', true);
    // o caminho da volta: pedra clara com a borda
    const pts = CURVA_DA_VOLTA.getSpacedPoints(240);
    const caminho = (largura: number, cor: string) => {
      g.lineWidth = largura * P;
      g.strokeStyle = cor;
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach((p, k) => (k ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
      g.closePath();
      g.stroke();
    };
    caminho(0.98, '#c9b48f');
    caminho(0.86, '#ecdfc2');
    // a horta: a terra e os sulcos
    g.fillStyle = '#9a7556';
    g.fillRect(X(HORTA.x0), Z(HORTA.z0), (HORTA.x1 - HORTA.x0) * P, (HORTA.z1 - HORTA.z0) * P);
    g.strokeStyle = '#c9b48f';
    g.lineWidth = 0.08 * P;
    g.strokeRect(X(HORTA.x0), Z(HORTA.z0), (HORTA.x1 - HORTA.x0) * P, (HORTA.z1 - HORTA.z0) * P);
    // a praça: o calçamento em anéis
    g.fillStyle = '#e8dcc6';
    g.beginPath();
    g.arc(X(PRACA.x), Z(PRACA.z), PRACA.raio * P, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(160,140,110,0.35)';
    g.lineWidth = 2;
    for (let r = 0.3; r < PRACA.raio; r += 0.22) {
      g.beginPath();
      g.arc(X(PRACA.x), Z(PRACA.z), r * P, 0, Math.PI * 2);
      g.stroke();
    }
    // a terra batida em volta da toca
    const toca = g.createRadialGradient(X(TOCA.x), Z(TOCA.z), 0, X(TOCA.x), Z(TOCA.z), TOCA.raio * 1.5 * P);
    toca.addColorStop(0, '#b58d62');
    toca.addColorStop(1, 'rgba(181,141,98,0)');
    g.fillStyle = toca;
    g.fillRect(X(TOCA.x - 1), Z(TOCA.z - 1), 2 * P, 2 * P);

    const t = textura(cv);
    t.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(MUNDO_X * 2, MUNDO_Z * 2).rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    const chao = new THREE.Mesh(geo, m);
    chao.receiveShadow = this.sombras;
    this.cena.add(chao);
    // e a grama até o horizonte
    const geoLonge = new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2);
    const mLonge = new THREE.MeshStandardMaterial({ color: '#8fcf6f', roughness: 1 });
    const longe = new THREE.Mesh(geoLonge, mLonge);
    longe.position.y = -0.01;
    this.cena.add(longe);
    this.descartaveis.push(t, geo, m, geoLonge, mLonge);
  }

  /** As 30 casas da volta: um corpo instanciado (a cor de cada uma na instância) e uma face por tipo; a bandeira da largada. */
  private montarCasasDaVolta() {
    const geoCorpo = new THREE.CylinderGeometry(RAIO_DA_CASA, RAIO_DA_CASA + 0.025, ALTURA_DA_CASA, 32);
    geoCorpo.translate(0, ALTURA_DA_CASA / 2, 0);
    const matCorpo = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    this.corpos = new THREE.InstancedMesh(geoCorpo, matCorpo, 30);
    this.corpos.receiveShadow = this.sombras;
    this.corpos.castShadow = this.sombras;
    CASAS_DA_VOLTA.forEach((p, i) => this.corpos!.setMatrixAt(i, matriz(p.x, 0, p.z)));
    this.cena.add(this.corpos);
    this.descartaveis.push(geoCorpo, matCorpo);
    const geoTopo = new THREE.CircleGeometry(RAIO_DA_CASA - 0.02, 32).rotateX(-Math.PI / 2);
    this.descartaveis.push(geoTopo);
    for (const tipo of Object.keys(COR_DO_TIPO)) {
      const t = pintarTopo(tipo);
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
      const im = new THREE.InstancedMesh(geoTopo, m, 30);
      im.count = 0;
      im.receiveShadow = this.sombras;
      im.frustumCulled = false;
      this.cena.add(im);
      this.topos.set(tipo, im);
      this.descartaveis.push(t, m);
      this.instancias.push(im);
    }
    this.instancias.push(this.corpos);
    // a bandeira quadriculada da largada, por dentro da casa 0 (por fora, ficaria entre a câmera e as peças)
    const c0 = CASAS_DA_VOLTA[0];
    const bx = c0.x + c0.fora[0] * -0.5;
    const bz = c0.z + c0.fora[1] * -0.5;
    const blocos: Bloco[] = [caixa(0.03, 0.78, 0.03, bx, 0, bz, '#f4efe6'), caixa(0.05, 0.05, 0.05, bx, 0.78, bz, '#e0b04a')];
    const n = 5;
    for (let k = 0; k < n; k++) for (let j = 0; j < 3; j++) blocos.push(caixa(0.06, 0.06, 0.012, bx + 0.045 + k * 0.06, 0.52 + j * 0.06, bz, (k + j) % 2 ? '#fffaf0' : '#3a3434'));
    const geo = juntar(blocos);
    const bandeira = new THREE.Mesh(geo, this.matCor);
    bandeira.castShadow = this.sombras;
    this.cena.add(bandeira);
    this.descartaveis.push(geo);
  }

  /** As casas e as lojas em volta (instanciadas por modelo), os carros no anel, o trem, as árvores e os vasos. */
  private montarCidade() {
    const lotes = lotesDaCidade();
    const porModelo = new Map<string, { matrizes: THREE.Matrix4[]; largura: number }>();
    for (const l of lotes) {
      const arq = l.tipo === 'casa' ? CASAS_DO_SUBURBIO[l.modelo] : LOJAS[l.modelo];
      const e = porModelo.get(arq) ?? { matrizes: [], largura: l.largura };
      e.matrizes.push(matriz(l.x, 0, l.z, l.rumo, l.largura / e.largura));
      porModelo.set(arq, e);
    }
    for (const [arq, e] of porModelo) {
      const g = this.modelos.get(arq);
      if (!g) continue;
      const { malhas } = instanciar(g, e.largura, e.matrizes, this.sombras);
      for (const m of malhas) this.cena.add(m);
      this.instancias.push(...malhas);
    }

    // as árvores: no lado de fora da volta (longe das casas dela e das barracas), atrás das casas e no miolo
    let semente = 5;
    const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    const pontos: [number, number, number][] = [];
    const livre = (x: number, z: number, folga: number) => pontos.every(([a, b]) => Math.hypot(a - x, b - z) > folga);
    const longeDaVolta = (x: number, z: number, d: number) => CASAS_DA_VOLTA.every((c) => Math.hypot(c.x - x, c.z - z) > d);
    // entre a volta e o anel
    for (let k = 0; k < 400 && pontos.length < 26; k++) {
      const x = (sorte() * 2 - 1) * (ANEL.rx - ANEL.largura / 2 - 0.25);
      const z = (sorte() * 2 - 1) * (ANEL.rz - ANEL.largura / 2 - 0.25);
      // por fora do retângulo que a volta ocupa por dentro (o miolo tem a sua lista)
      // (e não nas reentrâncias da volta, onde a árvore ficaria entre a câmera e a largada)
      const dentro = (Math.abs(x) < 4.3 && Math.abs(z) < 2.2) || (Math.abs(z) > 1.9 && Math.abs(x) < 2.7);
      // e por dentro da rua do anel, com folga (os cantos dela são redondos)
      const qx = Math.abs(x) - (ANEL.rx - ANEL.canto);
      const qz = Math.abs(z) - (ANEL.rz - ANEL.canto);
      const doAnel = ANEL.canto - Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - Math.min(Math.max(qx, qz), 0);
      if (dentro || doAnel < ANEL.largura / 2 + 0.3 || !longeDaVolta(x, z, 1.15) || !livre(x, z, 0.55)) continue;
      pontos.push([x, z, 0.32 + sorte() * 0.14]);
    }
    // no miolo, nos cantos livres
    for (const [x, z] of [
      [-0.85, -1.05],
      [0.9, 1.05],
      [-0.95, 1.0],
      [0.95, -1.0],
      [3.85, -1.2],
      [3.85, 1.25],
      [-4.05, 0.0],
    ])
      if (longeDaVolta(x, z, 0.62)) pontos.push([x, z, 0.3]);
    // atrás das casas, até a névoa
    for (const l of lotesDaCidade())
      for (const lado of [-1, 1]) {
        const ax = l.x + Math.cos(l.rumo) * 0.85 * lado - Math.sin(l.rumo) * 0.85;
        const az = l.z - Math.sin(l.rumo) * 0.85 * lado - Math.cos(l.rumo) * 0.85;
        if (sorte() < 0.55 && livre(ax, az, 0.6)) pontos.push([ax, az, 0.36 + sorte() * 0.2]);
      }
    for (let k = 0; k < 160 && pontos.length < 150; k++) {
      const x = (sorte() * 2 - 1) * 17;
      const z = (sorte() * 2 - 1) * 14;
      const naCidade = Math.abs(x) < TRILHO.rx + 0.6 && Math.abs(z) < TRILHO.rz + 0.6;
      if (naCidade || !livre(x, z, 0.8)) continue;
      pontos.push([x, z, 0.45 + sorte() * 0.3]);
    }
    for (const [k, arq] of ARVORES.entries()) {
      const g = this.modelos.get(arq);
      if (!g) continue;
      const meus = pontos.filter((_, j) => j % 2 === k);
      const base = meus.map(([x, z, s]) => matriz(x, 0, z, sorte() * Math.PI * 2, s / 0.24));
      const { malhas, locais } = instanciar(g, 0.24, base, this.sombras);
      for (const m of malhas) this.cena.add(m);
      this.instancias.push(...malhas);
      this.arvores.push({ malhas, base, locais, fase: meus.map(() => sorte() * 6) });
    }

    // os carros: três em cada mão do anel
    const faixas = [
      retanguloCurvo(ANEL.rx + 0.18, ANEL.rz + 0.18, ANEL.canto + 0.18, 0.01),
      retanguloCurvo(ANEL.rx - 0.18, ANEL.rz - 0.18, ANEL.canto - 0.18, 0.01, true),
    ];
    CARROS.forEach((arq, k) => {
      const g = this.modelos.get(arq);
      if (!g) return;
      const obj = copia(g, 0.34, this.sombras);
      const r = new THREE.Group();
      r.add(obj);
      this.cena.add(r);
      this.carros.push({ obj: r, curva: faixas[k % 2], u: k * 0.17 + (k % 2) * 0.08, vel: 0.009 + (k % 3) * 0.0015 });
    });

    // o trem: os trilhos instanciados e os vagões
    {
      const n = 260;
      const comp = this.trilho.getLength() / n;
      const dormente = new THREE.BoxGeometry(0.34, 0.03, 0.07);
      const madeira = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.9 });
      const dormentes = new THREE.InstancedMesh(dormente, madeira, n);
      const geoTrilho = new THREE.BoxGeometry(0.035, 0.035, 1);
      const aco = new THREE.MeshStandardMaterial({ color: '#b9b4ae', metalness: 0.4, roughness: 0.4 });
      const trilhos = new THREE.InstancedMesh(geoTrilho, aco, n * 2);
      const q = new THREE.Quaternion();
      const m = new THREE.Matrix4();
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const p = this.trilho.getPointAt(u);
        const t = this.trilho.getTangentAt(u);
        const rumo = Math.atan2(t.x, t.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rumo);
        m.compose(p, q, new THREE.Vector3(1, 1, 1));
        dormentes.setMatrixAt(k, m);
        const lado = new THREE.Vector3(Math.cos(rumo), 0, -Math.sin(rumo)).multiplyScalar(0.11);
        for (const [j, s] of [
          [0, 1],
          [1, -1],
        ]) {
          m.compose(p.clone().addScaledVector(lado, s).setY(0.09), q, new THREE.Vector3(1, 1, comp * 1.05));
          trilhos.setMatrixAt(k * 2 + j, m);
        }
      }
      dormentes.receiveShadow = this.sombras;
      dormentes.frustumCulled = trilhos.frustumCulled = false;
      this.cena.add(dormentes, trilhos);
      this.descartaveis.push(dormente, madeira, geoTrilho, aco);
      this.instancias.push(dormentes, trilhos);
      for (const arq of TREM) {
        const g = this.modelos.get(arq);
        if (!g) continue;
        const v = copia(g, 0.62, this.sombras);
        const r = new THREE.Group();
        r.add(v);
        this.cena.add(r);
        this.trem.push(r);
      }
    }
  }

  /** O miolo: a horta com os canteiros de cenoura, a toca e a praça com o chafariz, os bancos, os vasos e os guarda-sóis. */
  private montarMiolo() {
    const blocos: Bloco[] = [];
    // os canteiros (terra levantada) e as cenouras, instanciadas
    const fileiras = 4;
    const cenouras: THREE.Matrix4[] = [];
    let semente = 3;
    const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let f = 0; f < fileiras; f++) {
      const z = HORTA.z0 + 0.3 + f * ((HORTA.z1 - HORTA.z0 - 0.6) / (fileiras - 1));
      blocos.push(caixa(HORTA.x1 - HORTA.x0 - 0.35, 0.07, 0.26, (HORTA.x0 + HORTA.x1) / 2, 0, z, '#7d5a40'));
      for (let x = HORTA.x0 + 0.32; x < HORTA.x1 - 0.25; x += 0.24) cenouras.push(matriz(x + (sorte() - 0.5) * 0.04, 0.07, z + (sorte() - 0.5) * 0.06, sorte() * 6, 0.85 + sorte() * 0.3));
    }
    // uma cerquinha baixa em volta da horta
    const cerca = '#f1e6cf';
    const { x0, x1, z0, z1 } = HORTA;
    for (const [ax, az, bx, bz] of [
      [x0, z0, x1, z0],
      [x0, z1, x1, z1],
      [x0, z0, x0, z1],
      [x1, z0, x1, z1],
    ] as const) {
      const comp = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      blocos.push({ geo: new THREE.BoxGeometry(0.02, 0.02, comp), x: (ax + bx) / 2, y: 0.1, z: (az + bz) / 2, cor: cerca, ry: ang });
      const n = Math.round(comp / 0.25);
      for (let k = 0; k <= n; k++) blocos.push(caixa(0.03, 0.13, 0.03, ax + ((bx - ax) * k) / n, 0, az + ((bz - az) * k) / n, cerca));
    }
    // a toca: o morrinho de grama com a porta redonda virada para a câmera
    {
      const morro = new THREE.SphereGeometry(TOCA.raio, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      morro.scale(1, 0.62, 1);
      blocos.push({ geo: morro, x: TOCA.x, y: 0, z: TOCA.z, cor: '#7fbf5f' });
      const porta = new THREE.CircleGeometry(0.21, 20, 0, Math.PI);
      blocos.push({ geo: porta, x: TOCA.x, y: 0.02, z: TOCA.z + TOCA.raio + 0.01, cor: '#3a2c22', rx: -0.25 });
      const moldura = new THREE.TorusGeometry(0.22, 0.035, 6, 16, Math.PI);
      blocos.push({ geo: moldura, x: TOCA.x, y: 0.02, z: TOCA.z + TOCA.raio + 0.02, cor: '#a07a52', rx: -0.25 });
      blocos.push(caixa(0.02, 0.18, 0.02, TOCA.x + 0.28, 0, TOCA.z + 0.45, '#8a6a4c'), caixa(0.2, 0.1, 0.015, TOCA.x + 0.28, 0.14, TOCA.z + 0.46, '#e0b04a'));
    }
    // a praça: o chafariz (a bacia, a coluna, a taça) e os bancos virados para ele
    {
      const { x, z } = PRACA;
      blocos.push({ geo: new THREE.CylinderGeometry(0.42, 0.45, 0.14, 24), x, y: 0.07, z, cor: '#d9cdb6' });
      blocos.push({ geo: new THREE.CylinderGeometry(0.06, 0.08, 0.38, 10), x, y: 0.19, z, cor: '#d9cdb6' });
      blocos.push({ geo: new THREE.CylinderGeometry(0.16, 0.08, 0.06, 16), x, y: 0.4, z, cor: '#e7dcc6' });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const bx = x + Math.cos(a) * 0.82;
        const bz = z + Math.sin(a) * 0.82;
        const ry = Math.atan2(x - bx, z - bz) + Math.PI / 2;
        blocos.push({ geo: new THREE.BoxGeometry(0.34, 0.03, 0.12), x: bx, y: 0.12, z: bz, cor: '#b0784c', ry });
        blocos.push({ geo: new THREE.BoxGeometry(0.3, 0.1, 0.02), x: bx - Math.cos(ry + Math.PI / 2) * 0.0, y: 0.06, z: bz, cor: '#6a5a4c', ry });
      }
    }
    const geo = juntar(blocos);
    const miolo = new THREE.Mesh(geo, this.matCor);
    miolo.castShadow = this.sombras;
    miolo.receiveShadow = this.sombras;
    this.cena.add(miolo);
    this.descartaveis.push(geo);
    // a água do chafariz (o brilho dela anda devagar)
    {
      const geoAgua = new THREE.CircleGeometry(0.38, 24).rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ color: '#7cc6e0', roughness: 0.15, metalness: 0.1, emissive: '#2a6a8a', emissiveIntensity: 0.25 });
      this.agua = new THREE.Mesh(geoAgua, m);
      this.agua.position.set(PRACA.x, 0.13, PRACA.z);
      this.cena.add(this.agua);
      this.descartaveis.push(geoAgua, m);
    }
    // as cenouras da horta: um desenho só, instanciado
    {
      const pecas: Bloco[] = [
        { geo: new THREE.ConeGeometry(0.035, 0.07, 8).rotateX(Math.PI), x: 0, y: 0.03, z: 0, cor: '#e07a2e' },
        { geo: new THREE.ConeGeometry(0.02, 0.1, 5), x: -0.015, y: 0.1, z: 0, cor: '#6fae4a', rz: 0.3 },
        { geo: new THREE.ConeGeometry(0.02, 0.11, 5), x: 0.015, y: 0.1, z: 0, cor: '#7fbe5a', rz: -0.3 },
      ];
      const g = juntar(pecas);
      const im = new THREE.InstancedMesh(g, this.matCor, cenouras.length);
      cenouras.forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = this.sombras;
      im.frustumCulled = false;
      this.cena.add(im);
      this.instancias.push(im);
      this.descartaveis.push(g);
    }
    // os guarda-sóis e os vasos da praça
    const enfeite = (arq: string, largura: number, lugares: [number, number, number][]) => {
      const g = this.modelos.get(arq);
      if (!g) return;
      const { malhas } = instanciar(g, largura, lugares.map(([x, z, r]) => matriz(x, 0, z, r)), this.sombras);
      for (const m of malhas) this.cena.add(m);
      this.instancias.push(...malhas);
    };
    enfeite('comercio/detail-parasol-a.glb', 0.32, [[PRACA.x + 0.5, PRACA.z - 0.95, 0.4]]);
    enfeite('comercio/detail-parasol-b.glb', 0.32, [[PRACA.x - 0.62, PRACA.z + 0.85, -0.3]]);
    enfeite('suburbio/planter.glb', 0.3, [
      [PRACA.x + 1.05, PRACA.z + 0.45, 0],
      [PRACA.x + 1.05, PRACA.z - 0.45, 0],
      [HORTA.x1 + 0.22, HORTA.z0 + 0.1, Math.PI / 2],
      [HORTA.x1 + 0.22, HORTA.z1 - 0.1, Math.PI / 2],
    ]);
  }

  /** A cenoura dourada (feita por código, dourada de verdade) em cima da barraca dela, e o brilho na casa. */
  private montarDourada() {
    const ouro = new THREE.MeshStandardMaterial({ color: '#f2c046', metalness: 0.65, roughness: 0.28, emissive: '#7a5200', emissiveIntensity: 0.45 });
    const folha = new THREE.MeshStandardMaterial({ color: '#8fd06a', metalness: 0.2, roughness: 0.4, emissive: '#2e5a12', emissiveIntensity: 0.3 });
    const corpo = new THREE.ConeGeometry(0.085, 0.32, 14).rotateX(Math.PI);
    const folhas = mergeGeometries([
      new THREE.ConeGeometry(0.03, 0.13, 6).rotateZ(0.35).translate(-0.03, 0.2, 0),
      new THREE.ConeGeometry(0.03, 0.15, 6).translate(0, 0.21, 0),
      new THREE.ConeGeometry(0.03, 0.13, 6).rotateZ(-0.35).translate(0.03, 0.2, 0),
    ])!;
    const c = new THREE.Mesh(corpo, ouro);
    const f = new THREE.Mesh(folhas, folha);
    c.castShadow = f.castShadow = this.sombras;
    this.cenoura.add(c, f);
    this.cenoura.scale.setScalar(1.05);
    this.cenoura.rotation.z = 0.25;
    this.descartaveis.push(ouro, folha, corpo, folhas);
    // a barraca: o balcão de madeira, dois postes e o toldo listrado
    // (a cenoura flutua acima do toldo, para a câmera de cima a ver sempre)
    const blocos: Bloco[] = [caixa(0.36, 0.18, 0.2, 0, 0, 0, '#b0784c'), caixa(0.38, 0.03, 0.22, 0, 0.18, 0, '#d7a06a')];
    for (const s of [-1, 1]) blocos.push(caixa(0.025, 0.3, 0.025, s * 0.17, 0.18, -0.08, '#f4efe6'));
    for (let k = 0; k < 6; k++) blocos.push({ geo: new THREE.BoxGeometry(0.07, 0.02, 0.28), x: -0.175 + k * 0.07, y: 0.5, z: 0.0, cor: k % 2 ? '#fffaf0' : '#e2a33a', rx: 0.3 });
    const geo = juntar(blocos);
    const b = new THREE.Mesh(geo, this.matCor);
    b.castShadow = this.sombras;
    this.barraca.add(b);
    this.descartaveis.push(geo);
    this.dourada.add(this.barraca, this.cenoura);
    this.cena.add(this.dourada);
    const t = pintarBrilho('rgba(255,214,90,0.95)');
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const geoB = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.brilhoDaDourada = new THREE.Mesh(geoB, m);
    this.brilhoDaDourada.renderOrder = 2;
    this.cena.add(this.brilhoDaDourada);
    this.descartaveis.push(t, m, geoB);
  }

  // ———————————————————————————— o estado ————————————————————————————

  private aplicar(d: DadosDoTabuleiro3D) {
    // as casas: a face de cada tipo
    const chave = d.casas.join('');
    if (chave !== this.tiposVistos) {
      this.tiposVistos = chave;
      const cor = new THREE.Color();
      const n = new Map<string, number>();
      for (const im of this.topos.values()) im.count = 0;
      d.casas.forEach((tipo, i) => {
        if (i >= 30) return;
        const [, lado] = COR_DO_TIPO[tipo] ?? COR_DO_TIPO.i;
        this.corpos?.setColorAt(i, cor.set(lado));
        const im = this.topos.get(tipo) ?? this.topos.get('i')!;
        const k = n.get(tipo) ?? 0;
        n.set(tipo, k + 1);
        const p = CASAS_DA_VOLTA[i];
        // o quadriculado da largada segue o caminho; os sinais ficam de pé para a câmera de fábrica
        im.setMatrixAt(k, matriz(p.x, ALTURA_DA_CASA + 0.002, p.z, tipo === 'i' ? p.rumo : 0));
        im.count = k + 1;
        im.instanceMatrix.needsUpdate = true;
      });
      if (this.corpos?.instanceColor) this.corpos.instanceColor.needsUpdate = true;
    }
    // a dourada: na primeira vez, já no lugar; depois, voa
    if (d.dourada !== this.casaDaDourada) {
      const para = lugarDaBarraca(d.dourada);
      if (this.casaDaDourada < 0 || this.calmo) {
        this.dourada.position.copy(para);
        this.vooDaDourada = null;
      } else this.vooDaDourada = { de: this.dourada.position.clone(), para, inicio: performance.now() };
      this.casaDaDourada = d.dourada;
      const c = CASAS_DA_VOLTA[d.dourada];
      // a barraca olha para a casa
      this.barraca.rotation.y = Math.atan2(-c.fora[0], -c.fora[1]);
      this.brilhoDaDourada?.position.set(c.x, ALTURA_DA_CASA + 0.004, c.z);
    }
    this.atualizarPecas(d);
    // o dado: um andar novo gira em cima de quem anda
    const id = d.andando?.id ?? null;
    if (id !== this.dadoVisto) {
      const primeira = this.primeiroEstado;
      this.dadoVisto = id;
      if (d.andando && this.dado) {
        this.giro = primeira || this.calmo ? null : { id: d.andando.id, inicio: performance.now(), eixo: new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize() };
      } else this.giro = null;
    }
    if (d.andando && d.andando.id !== this.andandoVisto) {
      this.andandoVisto = d.andando.id;
      this.forcarGeral = false;
    }
    if (d.verTudo !== this.verTudoVisto) {
      this.verTudoVisto = d.verTudo;
      this.azimute = 0;
      this.elevacao = ELEVACAO;
      this.zoom = 1;
      this.forcarGeral = true;
    }
    // os efeitos: os de agora sobem uma vez; os que já estavam quando a cena abriu, não
    for (const e of d.efeitos) {
      if (this.efeitosVistos.has(e.id)) continue;
      this.efeitosVistos.add(e.id);
      if (this.primeiroEstado || !this.coelho) continue;
      const t = pintarEfeito(e.texto, e.bom);
      const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false });
      const s = new THREE.Sprite(m);
      s.scale.set(0.8, 0.3, 1);
      s.renderOrder = 5;
      this.cena.add(s);
      this.subindo.push({ sprite: s, userId: e.userId, inicio: performance.now() });
    }
    this.primeiroEstado = false;
  }

  private atualizarPecas(d: DadosDoTabuleiro3D) {
    const g = this.coelho;
    if (!g) return;
    const vivos = new Set(d.pecas.map((p) => p.userId));
    for (const [id, p] of this.pecas)
      if (!vivos.has(id)) {
        this.removerPeca(p);
        this.pecas.delete(id);
      }
    const porCasa = new Map<number, number[]>();
    for (const p of d.pecas) porCasa.set(p.pos, [...(porCasa.get(p.pos) ?? []), p.userId]);
    const agora = performance.now();
    for (const info of d.pecas) {
      let p = this.pecas.get(info.userId);
      if (!p || p.pelo !== info.pelo || p.roupa !== info.roupa) {
        if (p) this.removerPeca(p);
        p = this.novaPeca(g, info);
        this.pecas.set(info.userId, p);
      }
      // várias na mesma casa: em roda, dentro do disco
      const ids = porCasa.get(info.pos) ?? [info.userId];
      const k = ids.indexOf(info.userId);
      const n = ids.length;
      const c = centroDaCasa(info.pos);
      if (n > 1) {
        const a = (k / n) * Math.PI * 2 + Math.PI / 2;
        const r = n > 4 ? 0.2 : 0.16;
        c.x += Math.cos(a) * r;
        c.z += Math.sin(a) * r;
      }
      if (p.casa !== info.pos || p.para.distanceTo(c) > 1e-3) {
        const pulo = p.casa !== info.pos;
        p.de.copy(p.raiz.position);
        p.para.copy(c);
        p.inicio = agora;
        const longe = p.de.distanceTo(c);
        p.duracao = !pulo ? 160 : longe > 1.4 ? PULO_LONGE_MS : PULO_MS;
        if (longe > 0.05) p.rumo = Math.atan2(c.x - p.de.x, c.z - p.de.z);
        p.casa = info.pos;
      }
      p.mat.uOpaco.value = info.presente ? 1 : 0.45;
      p.vez = info.vez;
      p.marca.visible = info.vez;
      (p.marca.material as THREE.MeshStandardMaterial).color.set(info.roupa);
    }
  }

  private novaPeca(g: GLTF, info: PecaDoTabuleiro3D): Peca {
    const cores = { pelo: info.pelo, roupa: info.roupa ?? CORES_DO_MASCOTE.roupa };
    const { corpo, mixer, acoes, material, descartar } = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: this.sombras, cores });
    const raiz = new THREE.Group();
    const pulo = new THREE.Group();
    pulo.add(corpo);
    raiz.add(pulo);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.14, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a3a2a', transparent: true, opacity: 0.3, depthWrite: false }));
    sombra.position.y = 0.006;
    raiz.add(sombra);
    const marca = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshStandardMaterial({ color: info.roupa, emissive: '#ffffff', emissiveIntensity: 0.25 }));
    raiz.add(marca);
    const c = centroDaCasa(info.pos);
    raiz.position.copy(c);
    this.cena.add(raiz);
    return { raiz, corpo: pulo, sombra, marca, mat: material, descartar, mixer, acoes, tocando: '', casa: info.pos, de: c.clone(), para: c.clone(), inicio: 0, duracao: 0, rumo: 0, pelo: info.pelo, roupa: info.roupa, vez: info.vez };
  }

  private removerPeca(p: Peca) {
    this.cena.remove(p.raiz);
    p.descartar();
    p.sombra.geometry.dispose();
    (p.sombra.material as THREE.Material).dispose();
    p.marca.geometry.dispose();
    (p.marca.material as THREE.Material).dispose();
  }

  private tocar(p: Peca, nome: string) {
    if (p.tocando === nome) return;
    const nova = p.acoes.get(nome);
    if (!nova) return;
    const velha = p.acoes.get(p.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.2, false);
    p.tocando = nome;
  }

  // ———————————————————————————— a câmera ————————————————————————————

  /** A distância que mostra a volta inteira (e um pouco da cidade) no giro de agora. */
  private distanciaGeral(): number {
    const cosA = Math.cos(this.azimute);
    const sinA = Math.sin(this.azimute);
    let largura = 0;
    let fundo = 0;
    for (const c of CASAS_DA_VOLTA) {
      largura = Math.max(largura, Math.abs(c.x * cosA - c.z * sinA));
      fundo = Math.max(fundo, Math.abs(c.x * sinA + c.z * cosA));
    }
    largura += 1.2;
    fundo += 1.1;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanH = tanV * this.camera.aspect;
    const precisaV = (fundo * Math.sin(this.elevacao) + 0.5 * Math.cos(this.elevacao)) / tanV;
    const precisaH = largura / tanH;
    // a perspectiva aumenta o lado de perto: uma folga
    return Math.max(precisaV, precisaH) * 1.08 + fundo * Math.cos(this.elevacao) * 0.35;
  }

  /** Quem a câmera segue agora, ou null (a vista geral). */
  private seguido(): Peca | null {
    const a = this.dados?.andando;
    if (!a || this.forcarGeral || this.calmo) return null;
    return this.pecas.get(a.userId) ?? null;
  }

  private posicionarCamera(dt: number) {
    const quem = this.seguido();
    const foco = quem ? new THREE.Vector3(quem.raiz.position.x, 0.25, quem.raiz.position.z) : new THREE.Vector3(0, 0, 0.1);
    const dist = (quem ? DISTANCIA_SEGUINDO : this.distanciaGeral()) * this.zoom;
    const k = this.quadro < 3 ? 1 : 1 - Math.exp(-dt * (quem ? 4 : 2.4));
    this.alvo.lerp(foco, k);
    this.distAtual += (dist - this.distAtual) * k;
    const ce = Math.cos(this.elevacao);
    this.camera.position.set(
      this.alvo.x + Math.sin(this.azimute) * ce * this.distAtual,
      this.alvo.y + Math.sin(this.elevacao) * this.distAtual,
      this.alvo.z + Math.cos(this.azimute) * ce * this.distAtual,
    );
    this.camera.lookAt(this.alvo);
    const livre = !!quem || Math.abs(this.azimute) > 1e-3 || Math.abs(this.elevacao - ELEVACAO) > 1e-3 || Math.abs(this.zoom - 1) > 1e-3;
    if (livre !== this.livreAvisado) {
      this.livreAvisado = livre;
      this.avisar(livre ? CAMERA_LIVRE : CAMERA_GERAL);
    }
  }

  private aoApertar = (e: PointerEvent) => {
    this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (this.ponteiros.size === 2) {
      const [a, b] = [...this.ponteiros.values()];
      this.pinca = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  private aoMover = (e: PointerEvent) => {
    const antes = this.ponteiros.get(e.pointerId);
    if (!antes) return;
    const agora = { x: e.clientX, y: e.clientY };
    this.ponteiros.set(e.pointerId, agora);
    if (this.ponteiros.size >= 2) {
      const [a, b] = [...this.ponteiros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinca > 0) this.zoom = THREE.MathUtils.clamp(this.zoom * (this.pinca / Math.max(1, d)), 0.4, 1.7);
      this.pinca = d;
      return;
    }
    this.azimute -= (agora.x - antes.x) * 0.008;
    // de volta a -π..π (o "girou" do botão compara com zero)
    this.azimute = Math.atan2(Math.sin(this.azimute), Math.cos(this.azimute));
    this.elevacao = THREE.MathUtils.clamp(this.elevacao + (agora.y - antes.y) * 0.005, 0.45, 1.35);
  };
  private aoSoltar = (e: PointerEvent) => {
    this.ponteiros.delete(e.pointerId);
    if (this.ponteiros.size < 2) this.pinca = 0;
  };
  private aoRolar = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(e.deltaY * 0.0012), 0.4, 1.7);
  };

  // ———————————————————————————— o quadro ————————————————————————————

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, não desenha
    if (document.hidden || !document.hasFocus()) {
      this.relogio.update();
      this.ultimoQuadro = 0;
      return;
    }
    const t0 = performance.now();
    if (this.ultimoQuadro) {
      this.intervalos.push(t0 - this.ultimoQuadro);
      if (this.intervalos.length > 240) this.intervalos.shift();
    }
    this.ultimoQuadro = t0;
    this.relogio.update();
    const dt = Math.min(0.05, this.relogio.getDelta());
    const tempo = this.relogio.getElapsed();
    const agora = performance.now();
    const vivo = !this.calmo;
    this.quadro++;

    // as peças
    let casaDaVez: Peca | null = null;
    for (const p of this.pecas.values()) {
      const f = p.duracao ? Math.min(1, (agora - p.inicio) / p.duracao) : 1;
      const e = f < 1 ? f * f * (3 - 2 * f) : 1;
      p.raiz.position.lerpVectors(p.de, p.para, e);
      const longe = p.de.distanceTo(p.para);
      const altura = f < 1 && longe > 0.3 ? Math.sin(Math.PI * f) * (longe > 1.4 ? 0.85 : 0.26) : 0;
      const pouso = f >= 1 ? Math.max(0, 1 - (agora - p.inicio - p.duracao) / 140) : 0;
      const respira = vivo ? Math.sin(tempo * 2.4 + p.raiz.id) * 0.015 : 0;
      const pulinho = p.vez && vivo && f >= 1 ? Math.abs(Math.sin(tempo * 4)) * 0.04 : 0;
      p.corpo.position.y = altura + pulinho;
      const estica = f < 1 && altura > 0 ? 0.1 * Math.sin(Math.PI * f) : -0.16 * pouso + respira;
      p.corpo.scale.set(1 - estica * 0.5, 1 + estica, 1 - estica * 0.5);
      (p.sombra.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - Math.min(0.6, altura));
      // olha para onde vai; parado, vira devagar para a câmera
      const paraCamera = Math.atan2(this.camera.position.x - p.raiz.position.x, this.camera.position.z - p.raiz.position.z);
      const quer = f < 1 && longe > 0.05 ? p.rumo : paraCamera;
      let delta = quer - p.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      p.corpo.rotation.y += delta * Math.min(1, dt * (f < 1 ? 18 : 4));
      p.marca.rotation.y = vivo ? tempo * 2 : 0;
      p.marca.position.y = ALTURA_DO_COELHO + 0.18 + altura + (vivo ? Math.sin(tempo * 3) * 0.03 : 0);
      if (p.vez && f >= 1) casaDaVez = p;
      this.tocar(p, !vivo ? 'parado' : f < 1 && longe > 0.3 ? 'andando' : p.vez ? 'falando' : 'parado');
      p.mixer.update(vivo ? dt : 0);
    }
    if (this.brilhoDaVez) {
      this.brilhoDaVez.visible = !!casaDaVez;
      if (casaDaVez) {
        const c = centroDaCasa(casaDaVez.casa);
        this.brilhoDaVez.position.set(c.x, ALTURA_DA_CASA + 0.006, c.z);
        (this.brilhoDaVez.material as THREE.MeshBasicMaterial).opacity = vivo ? 0.6 + Math.sin(tempo * 3.2) * 0.25 : 0.75;
      }
    }

    // o dado, em cima de quem anda: gira e para com o número de frente para a câmera
    const a = this.dados?.andando;
    const quemAnda = a ? this.pecas.get(a.userId) : undefined;
    if (this.dado) {
      this.dado.visible = !!(a && quemAnda);
      if (a && quemAnda) {
        const p = quemAnda.raiz.position;
        this.dado.position.set(p.x, p.y + quemAnda.corpo.position.y + ALTURA_DO_COELHO + 0.42, p.z);
        const praCamera = new THREE.Vector3().subVectors(this.camera.position, this.dado.position).normalize();
        const fim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), praCamera).multiply(FACE_PARA_CIMA[a.dado] ?? new THREE.Quaternion());
        const g = this.giro && this.giro.id === a.id ? Math.min(1, (agora - this.giro.inicio) / GIRO_DO_DADO_MS) : 1;
        if (g < 1 && this.giro) {
          const resto = (1 - g) * (1 - g);
          this.dado.quaternion.setFromAxisAngle(this.giro.eixo, resto * Math.PI * 6).multiply(fim);
          this.dado.position.y += Math.sin(Math.PI * g) * 0.25;
          this.dado.scale.setScalar(ESCALA_DO_DADO * (0.6 + 0.4 * Math.min(1, g * 3)));
        } else {
          this.dado.quaternion.copy(fim);
          this.dado.scale.setScalar(ESCALA_DO_DADO);
        }
      }
    }

    // os números que sobem
    for (let k = this.subindo.length - 1; k >= 0; k--) {
      const s = this.subindo[k];
      const f = (agora - s.inicio) / 1700;
      const p = this.pecas.get(s.userId);
      if (f >= 1 || !p) {
        this.cena.remove(s.sprite);
        s.sprite.material.map?.dispose();
        s.sprite.material.dispose();
        this.subindo.splice(k, 1);
        continue;
      }
      s.sprite.position.set(p.raiz.position.x, ALTURA_DO_COELHO + 0.45 + (vivo ? f * 0.45 : 0.2), p.raiz.position.z);
      s.sprite.material.opacity = f < 0.75 ? 1 : 1 - (f - 0.75) / 0.25;
    }

    // a dourada: o voo até a casa nova, a barraca que encolhe e cresce, o giro e o brilho
    if (this.vooDaDourada) {
      const v = this.vooDaDourada;
      const f = Math.min(1, (agora - v.inicio) / VOO_DA_DOURADA_MS);
      const e = f * f * (3 - 2 * f);
      this.dourada.position.lerpVectors(v.de, v.para, e);
      this.dourada.position.y = Math.sin(Math.PI * f) * 2.2;
      this.barraca.scale.setScalar(Math.max(0.001, Math.abs(1 - 2 * f)));
      if (f >= 1) {
        this.vooDaDourada = null;
        this.barraca.scale.setScalar(1);
        this.dourada.position.y = 0;
      }
    }
    this.cenoura.position.y = 0.86 + (vivo ? Math.sin(tempo * 2.2) * 0.05 : 0);
    if (vivo) this.cenoura.rotation.y = tempo * 1.6;
    if (this.brilhoDaDourada) {
      this.brilhoDaDourada.visible = !this.vooDaDourada;
      (this.brilhoDaDourada.material as THREE.MeshBasicMaterial).opacity = vivo ? 0.55 + Math.sin(tempo * 2.6) * 0.2 : 0.65;
    }

    // o enfeite: o trem, os carros, as árvores e a água
    if (this.trem.length) {
      const u0 = vivo ? (tempo * 0.012) % 1 : 0.62;
      this.trem.forEach((v, k) => {
        const u = (u0 - k * 0.012 + 1) % 1;
        const p = this.trilho.getPointAt(u);
        const t = this.trilho.getTangentAt(u);
        v.position.set(p.x, 0.1, p.z);
        v.rotation.y = Math.atan2(t.x, t.z);
      });
    }
    for (const c of this.carros) {
      const u = vivo ? (c.u + tempo * c.vel) % 1 : c.u % 1;
      const p = c.curva.getPointAt(u);
      const t = c.curva.getTangentAt(u);
      c.obj.position.set(p.x, 0.01, p.z);
      c.obj.rotation.y = Math.atan2(t.x, t.z);
    }
    if (vivo && this.quadro % 2 === 0) {
      const m = new THREE.Matrix4();
      const r = new THREE.Matrix4();
      for (const arv of this.arvores)
        arv.base.forEach((b, k) => {
          r.makeRotationFromEuler(new THREE.Euler(Math.sin(tempo * 0.8 + arv.fase[k] * 1.3) * 0.025, 0, Math.sin(tempo * 1.1 + arv.fase[k]) * 0.035));
          arv.malhas.forEach((im, j) => {
            m.copy(b).multiply(r).multiply(arv.locais[j]);
            im.setMatrixAt(k, m);
            im.instanceMatrix.needsUpdate = true;
          });
        });
    }
    if (this.agua && vivo) (this.agua.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.22 + Math.sin(tempo * 1.7) * 0.08;

    this.posicionarCamera(dt);
    this.renderer.render(this.cena, this.camera);
    if (import.meta.env.DEV) {
      this.tempos.push(performance.now() - t0);
      if (this.tempos.length > 240) this.tempos.shift();
    }
  };

  /** Só no site de desenvolvimento: o que o teste mede. */
  medidaDoTeste() {
    const ordem = [...this.tempos].sort((a, b) => a - b);
    const iv = [...this.intervalos].sort((a, b) => a - b);
    const medioIv = iv.reduce((s, x) => s + x, 0) / Math.max(1, iv.length);
    return {
      msMedio: ordem.reduce((s, x) => s + x, 0) / Math.max(1, ordem.length),
      msP95: ordem[Math.floor(ordem.length * 0.95)] ?? 0,
      qps: medioIv ? 1000 / medioIv : 0,
      chamadas: this.renderer.info.render.calls,
      triangulos: this.renderer.info.render.triangles,
      geometrias: this.renderer.info.memory.geometries,
      texturas: this.renderer.info.memory.textures,
    };
  }
  /** Só para o teste: a câmera como a pessoa a deixaria (arrastando e rolando). */
  cameraDoTeste(azimute: number, elevacao: number, zoom: number) {
    this.azimute = azimute;
    this.elevacao = elevacao;
    this.zoom = zoom;
  }

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const tela = this.renderer.domElement;
    tela.removeEventListener('pointerdown', this.aoApertar);
    tela.removeEventListener('pointermove', this.aoMover);
    tela.removeEventListener('pointerup', this.aoSoltar);
    tela.removeEventListener('pointercancel', this.aoSoltar);
    tela.removeEventListener('wheel', this.aoRolar);
    for (const p of this.pecas.values()) this.removerPeca(p);
    for (const s of this.subindo) {
      s.sprite.material.map?.dispose();
      s.sprite.material.dispose();
    }
    // a geometria e as texturas dos modelos são do cache (servem à próxima partida e ao Capitais); as nossas vão embora
    for (const im of this.instancias) im.dispose();
    for (const d of this.descartaveis) d.dispose();
    if (import.meta.env.DEV) {
      const w = window as unknown as { cenaDoTabuleiro?: CenaDoTabuleiro };
      if (w.cenaDoTabuleiro === this) delete w.cenaDoTabuleiro;
    }
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    tela.remove();
  }
}

export function criarCenaDoTabuleiro(caixa: HTMLElement, avisar: (alvo: number) => void): CenaDoTabuleiro {
  return new CenaDoTabuleiro(caixa, avisar);
}
