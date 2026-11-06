import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { carregarCoelho, CORES_DO_MASCOTE, copiarCoelho, type CoelhoCopiado, type CoresDoCoelho } from '../coelho3d';

/**
 * O QUARTO EM 3D LOW POLY NO APP (06/11/2026, pedido dele: "quero esse quarto 3D low poly como PILOTO da nossa
 * funcionalidade de variação estética para o usuário"). É o piloto de e2e/3D/quarto/main.ts trazido para o app, com o que o
 * quarto de pixel art faz na home:
 *
 * - AS FUNÇÕES NOS OBJETOS, as mesmas do quarto de pixel art (o id é o de `AcoesDoQuarto`, em Home.tsx): o guarda-roupa →
 *   Guarda-roupa ('gavetas'), a mesa com o computador → Mini-games ('computador'), o fone no abajur da mesa → Salas ('fone'),
 *   o quadro de fotos → Amigos ('quadro'), a cortiça → ideias ('cortica'), a janela → Explorar ('janela'), o abajur do
 *   criado-mudo → Dia e noite ('abajur') e a estante, com um troféu em cima → Troféus ('trofeu'). A ANIMAÇÃO VEM ANTES DA
 *   FUNÇÃO: o coelho anda até o objeto (na mesa, senta ao computador), e só então ela abre. Passar o mouse realça o objeto.
 * - O COELHO é o de coelho3d.ts, com as cores do avatar, e segue o ESTADO DE VERDADE: ausente dorme na cama, em chamada senta
 *   ao computador, senão fica à toa. Depois de usar uma função, ele volta ao lugar do estado.
 * - DIA E NOITE são os do app (o mesmo relógio e o mesmo abajur do quarto de pixel art); as SOMBRAS, a opção de Gráficos.
 * - SEM FOCO OU ESCONDIDA, NÃO DESENHA (a regra de janelaComFoco.ts). Com a janela à vista, no máximo 30 quadros por segundo.
 * - A ARRUMAÇÃO é a de fábrica do piloto: no 3D, por ora, não se edita (o Editar é do quarto de pixel art).
 *
 * Os móveis são do KayKit (Furniture Bits e Restaurant Bits, do Bits Bundle 1, Kay Lousberg) e do Kenney Furniture Kit, todos
 * CC0, em web/public/quarto3d/ com as licenças. O que nenhum dos dois tem (o chão, a cortiça, as fotos do quadro, as luzinhas, o
 * troféu) é feito aqui por código.
 */

const MODELOS = `${import.meta.env.BASE_URL}quarto3d/`;
const N = 8;
/** O tamanho dos móveis do KayKit na grade (a mesa dele tem 2 de lado; aqui, uma casa e pouco). */
const S = 0.75;
/** O tamanho das peças do Kenney: com 2, a mesa, a cadeira e a cama dele ficam da altura das do KayKit. */
const K = 2;
/** As cores do Kenney trocadas pelas do KayKit, pelo nome do material (o vermelho-vivo e o verde-menta dele brigavam). */
const PALETA_KENNEY: Record<string, string> = {
  wood: '#c47c4a',
  woodDark: '#8a5233',
  carpet: '#e8b452',
  carpetDarker: '#c98c3c',
  carpetWhite: '#efe5d2',
  carpetBlue: '#93c1d0',
  plant: '#78b04a',
  metal: '#cfd2c8',
  metalLight: '#eceee6',
  metalMedium: '#7d8984',
  metalDark: '#4b5451',
  fur: '#c99566',
  lamp: '#ffe2a0',
  _defaultMat: '#ecdcc4',
};
const ehKenney = (nome: string) => nome.startsWith('kenney/');
const ALTURA_DO_COELHO = 1.1;
const ALTURA_DA_PAREDE = 3;
/** Onde o coelho fica nos móveis, em fração da altura do móvel (acertado pelas fotos do piloto). */
const DEITADO_ALTURA = 0.45;
const DEITADO_AVANCO = 0.55;
const ASSENTO_POLTRONA = 0.36;
const ASSENTO_CADEIRA = 0.37;
/** Depois de usar uma função, o coelho volta ao lugar do estado (a cama, o computador) em tanto tempo. */
const VOLTA_AO_ESTADO_MS = 8000;
/** O realce de quem está sob o mouse: uma luz própria, morna, por cima da cor. */
const REALCE = new THREE.Color('#4a3418');
/** No máximo 30 quadros por segundo: o quarto é calmo, e o resto do tempo é de quem joga. */
const INTERVALO_MS = 1000 / 31;

type Lado = 0 | 1 | 2 | 3;
interface DeCima {
  arquivo: string;
  dx: number;
  dz: number;
  dy?: number;
  giro?: number;
  escala?: number;
  cores?: Record<string, string>;
  /** A função deste objeto, e não a do móvel (o fone no abajur da mesa). */
  funcao?: string;
}
interface Movel {
  id: string;
  arquivo: string;
  x: number;
  z: number;
  lado: Lado;
  cima?: DeCima[];
  /** Não ocupa a casa (o tapete): o coelho pisa. */
  chao?: boolean;
  uso?: 'deitar' | 'sentar' | 'luz';
  /** O id da função do quarto (o de AcoesDoQuarto). */
  funcao?: string;
  cores?: Record<string, string>;
  escala?: number;
}

const TERRACOTA = { carpet: '#c9714f', carpetDarker: '#a5573b' };

/** A arrumação de fábrica do piloto (e2e/3D/quarto/main.ts, terceira rodada). */
const ARRUMACAO: Movel[] = [
  { id: 'cama', arquivo: 'bed_double_B', x: 0, z: 0, lado: 0, uso: 'deitar' },
  {
    id: 'criado',
    arquivo: 'cabinet_small',
    x: 2,
    z: 0,
    lado: 0,
    cima: [
      { arquivo: 'lamp_table', dx: -0.12, dz: 0 },
      { arquivo: 'pictureframe_standing_A', dx: 0.2, dz: 0.05 },
    ],
    uso: 'luz',
    funcao: 'abajur',
  },
  {
    id: 'capacho',
    arquivo: 'kenney/rugDoormat',
    x: 3.5,
    z: 0.15,
    lado: 0,
    chao: true,
    cores: { wood: '#a9774a' },
  },
  {
    id: 'estante',
    arquivo: 'kenney/bookcaseClosedWide',
    x: 5,
    z: 0,
    lado: 0,
    funcao: 'trofeu',
    cima: [
      {
        arquivo: 'kenney/books',
        dx: -0.45,
        dz: 0,
        dy: 0.14,
        escala: 1.4,
        cores: { carpetDarker: '#b8574a', plant: '#5f9a8c' },
      },
      {
        arquivo: 'kenney/books',
        dx: -0.02,
        dz: 0,
        dy: 0.14,
        escala: 1.4,
        giro: Math.PI,
        cores: { carpetDarker: '#6f8fb5' },
      },
      { arquivo: 'kenney/radio', dx: 0.42, dz: 0.02, dy: 0.62, escala: 0.9 },
      {
        arquivo: 'kenney/books',
        dx: -0.42,
        dz: 0,
        dy: 0.62,
        escala: 1.4,
        cores: { carpetDarker: '#d29a3e' },
      },
      { arquivo: 'book_set', dx: 0.25, dz: 0, dy: 1.1 },
      { arquivo: 'kenney/plantSmall2', dx: -0.45, dz: 0, dy: 1.1 },
      { arquivo: 'kenney/plantSmall1', dx: 0.5, dz: 0, dy: 1.58 },
      {
        arquivo: 'kenney/books',
        dx: -0.15,
        dz: 0,
        dy: 1.58,
        escala: 1.2,
        giro: 1.2,
        cores: { carpetDarker: '#7d9a5a' },
      },
    ],
  },
  {
    id: 'guarda-roupa',
    arquivo: 'kenney/bookcaseClosedDoors',
    x: 7,
    z: 0,
    lado: 0,
    funcao: 'gavetas',
  },
  { id: 'tapete', arquivo: 'rug_oval_B', x: 1, z: 2, lado: 1, chao: true },
  { id: 'sofa', arquivo: 'couch_pillows', x: 0, z: 2, lado: 3, uso: 'sentar' },
  {
    id: 'mesinha',
    arquivo: 'table_low',
    x: 2,
    z: 2,
    lado: 3,
    cima: [
      { arquivo: 'gameconsole_handheld', dx: 0.15, dz: 0.1, giro: 0.4 },
      { arquivo: 'mug_A', dx: -0.4, dz: -0.05 },
    ],
  },
  {
    id: 'planta',
    arquivo: 'kenney/pottedPlant',
    x: 0,
    z: 4,
    lado: 1,
    cores: { wood: '#c9714f' },
  },
  // A MESA EM L COM TRÊS MONITORES (pedido dele, 06/11/2026, pela imagem do pacote): o braço comprido (desk_large) na parede
  // da janela, com dois monitores, e o curto (desk) saindo dela, com o terceiro virado para a câmera; a cadeira no canto de
  // dentro do L. As duas abrem o computador.
  {
    id: 'mesa',
    arquivo: 'desk_large',
    x: 0,
    z: 5,
    lado: 3,
    funcao: 'computador',
    cima: [
      { arquivo: 'monitor', dx: -0.55, dz: -0.28, giro: 0.12 },
      { arquivo: 'monitor', dx: 0.55, dz: -0.28, giro: -0.12 },
      { arquivo: 'keyboard', dx: -0.05, dz: 0.12 },
      { arquivo: 'mousepad_A', dx: 0.5, dz: 0.16 },
      { arquivo: 'mouse', dx: 0.5, dz: 0.16 },
      { arquivo: 'lamp_desk_headphones', dx: 1.15, dz: -0.15, funcao: 'fone' },
      { arquivo: 'mug_A', dx: -1.15, dz: 0.05 },
    ],
  },
  {
    id: 'mesa2',
    arquivo: 'desk',
    x: 1,
    z: 5,
    lado: 0,
    funcao: 'computador',
    cima: [
      { arquivo: 'monitor', dx: -0.1, dz: -0.28 },
      { arquivo: 'cup_pencils', dx: 0.62, dz: -0.2 },
      { arquivo: 'book_set', dx: 0.6, dz: 0.18, giro: 0.3 },
    ],
  },
  {
    id: 'cadeira',
    arquivo: 'chair_desk_A',
    x: 1,
    z: 6,
    lado: 1,
    uso: 'sentar',
  },
  {
    id: 'tapete2',
    arquivo: 'kenney/rugRound',
    x: 4.5,
    z: 4.3,
    lado: 0,
    chao: true,
    cores: TERRACOTA,
  },
  {
    id: 'pufe',
    arquivo: 'kenney/loungeSofaOttoman',
    x: 5,
    z: 5,
    lado: 0,
    escala: 0.75,
  },
  {
    id: 'poltrona',
    arquivo: 'armchair_pillows',
    x: 5,
    z: 4,
    lado: 0,
    uso: 'sentar',
  },
  {
    id: 'banquinho',
    arquivo: 'table_small',
    x: 6,
    z: 4,
    lado: 0,
    cima: [
      { arquivo: 'book_set', dx: 0, dz: 0 },
      { arquivo: 'kenney/plantSmall3', dx: 0.22, dz: -0.2 },
    ],
  },
  {
    id: 'luminaria',
    arquivo: 'lamp_standing',
    x: 4,
    z: 4,
    lado: 0,
    uso: 'luz',
  },
  { id: 'caixa', arquivo: 'kenney/cardboardBoxOpen', x: 7, z: 2, lado: 3 },
  { id: 'cacto2', arquivo: 'cactus_small_B', x: 1, z: 7, lado: 0 },
  { id: 'cacto', arquivo: 'cactus_medium_B', x: 7, z: 6, lado: 0 },
];

/** O que se pendura: na parede do fundo (z = 0) ou na da esquerda (x = 0), u casas ao longo dela e y de altura. */
const NA_PAREDE: {
  arquivo: string;
  parede: 'fundo' | 'esquerda';
  u: number;
  y: number;
  funcao?: string;
  fotos?: boolean;
}[] = [
  {
    arquivo: 'pictureframe_large_B',
    parede: 'fundo',
    u: 1.0,
    y: 1.85,
    funcao: 'quadro',
    fotos: true,
  },
  { arquivo: 'pictureframe_small_A', parede: 'fundo', u: 5.5, y: 2.2 },
  { arquivo: 'pictureframe_small_B', parede: 'fundo', u: 6.3, y: 2.35 },
  {
    arquivo: 'cortica',
    parede: 'esquerda',
    u: 1.15,
    y: 1.35,
    funcao: 'cortica',
  },
  { arquivo: 'shelf_A_big', parede: 'esquerda', u: 7.0, y: 1.95 },
  { arquivo: 'kenney/plantSmall3', parede: 'esquerda', u: 7.45, y: 2.03 },
  { arquivo: 'kenney/books', parede: 'esquerda', u: 6.75, y: 2.03 },
  { arquivo: 'kenney/books', parede: 'esquerda', u: 6.45, y: 2.03 },
  { arquivo: 'pictureframe_small_C', parede: 'esquerda', u: 1.75, y: 2.45 },
];

/** As paredes do Restaurant Bits: peças de 4 × 4 com o rodapé verde-água, 3 por parede. */
const PAREDES: { arquivo: string; parede: 'fundo' | 'esquerda'; i: number }[] = [
  { arquivo: 'restaurante/wall', parede: 'fundo', i: 0 },
  { arquivo: 'restaurante/wall_doorway', parede: 'fundo', i: 1 },
  { arquivo: 'restaurante/wall', parede: 'fundo', i: 2 },
  { arquivo: 'restaurante/wall', parede: 'esquerda', i: 0 },
  {
    arquivo: 'restaurante/wall_window_closed_curtains_green',
    parede: 'esquerda',
    i: 1,
  },
  { arquivo: 'restaurante/wall', parede: 'esquerda', i: 2 },
];

// Os modelos, uma vez por página: abrir o quarto de novo não baixa nada (a geometria e as texturas ficam no cache).
const carregador = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const modelo = (nome: string) => {
  let p = cache.get(nome);
  if (!p) {
    p = carregador.loadAsync(`${MODELOS}${nome}${ehKenney(nome) ? '.glb' : '.gltf'}`);
    p.catch(() => cache.delete(nome));
    cache.set(nome, p);
  }
  return p;
};

interface Pronto {
  m: Movel;
  raiz: THREE.Group;
  giro: THREE.Group;
  w: number;
  d: number;
  altura: number;
  luz?: THREE.PointLight;
  /** A luz foi apagada ou acesa à mão (a luminária): vale até o dia e a noite do app mudarem. */
  luzAMao?: boolean;
}

export type EstadoDoCoelho = 'atoa' | 'call' | 'ausente';

export interface OpcoesDoQuarto3D {
  /** A função de um objeto (o id de AcoesDoQuarto), DEPOIS de o coelho chegar a ele. */
  aoFuncao(id: string): void;
  /** O que está sob o mouse (para a etiqueta com o nome), em pixels da caixa; null, nada. */
  aoPassar(alvo: { id: string; x: number; y: number } | null): void;
  /** Esta função existe aqui? (Na visita, só a dos troféus.) */
  temFuncao(id: string): boolean;
}

interface Coelho {
  copia: CoelhoCopiado;
  raiz: THREE.Group;
  corpo: THREE.Group;
  casa: [number, number];
  caminho: [number, number][];
  de: THREE.Vector3;
  para: THREE.Vector3;
  inicio: number;
  duracao: number;
  arco: number;
  rumo: number;
  pose: 'pe' | 'deitado' | 'sentado';
  /** O móvel em que está (deitado ou sentado). */
  em: Pronto | null;
  depois: (() => void) | null;
  tocando: string;
}

/** Um alvo sob o ponteiro: o objeto com função, ou o móvel de usar, ou o chão. */
interface Alvo {
  funcao?: string;
  movel?: Pronto;
  /** O que se realça (o objeto da função, ou o móvel). */
  realce?: THREE.Object3D;
  ponto: THREE.Vector3;
}

export class CenaDoQuarto3D {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private ceu = new THREE.HemisphereLight('#fffaf0', '#c9a88a', 1.7);
  private sol = new THREE.DirectionalLight('#fff0d8', 2.3);
  private preenche = new THREE.DirectionalLight('#dfe8ff', 0.7);
  private fora!: THREE.Mesh;
  private morro!: THREE.Mesh;
  private moveis: Pronto[] = [];
  private daParede: THREE.Object3D[] = [];
  private arandelas: THREE.PointLight[] = [];
  private lampadinhas: THREE.MeshStandardMaterial[] = [];
  private lampadas: THREE.MeshStandardMaterial[] = [];
  private coelho: Coelho | null = null;
  private noite = false;
  private estado: EstadoDoCoelho = 'atoa';
  private sombras: boolean;
  private calmo: boolean;
  private raio = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();
  private planoDoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private observador: ResizeObserver;
  private relogio = new THREE.Timer();
  private ultimoQuadro = 0;
  private morta = false;
  private descartaveis: { dispose(): void }[] = [];
  private realcado: THREE.Object3D | null = null;
  private emissivos = new Map<THREE.MeshStandardMaterial, { cor: THREE.Color; intensidade: number }>();
  private apertou: { x: number; y: number } | null = null;
  private passou: PointerEvent | null = null;
  /** Quando o coelho volta ao lugar do estado (depois de usar uma função); 0, não volta. */
  private voltarEm = 0;
  /** O medidor: o tempo de cada quadro desenhado (os últimos 60) e quantos foram desenhados. */
  private tempos: number[] = [];
  desenhados = 0;

  constructor(
    private caixa: HTMLElement,
    private opcoes: OpcoesDoQuarto3D,
    private cores: CoresDoCoelho = CORES_DO_MASCOTE,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.sombras = lerSombras();
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'quarto3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    canvas.addEventListener('pointerdown', this.aoApertar);
    canvas.addEventListener('pointerup', this.aoSoltar);
    canvas.addEventListener('pointermove', this.aoMover);
    canvas.addEventListener('pointerleave', this.aoSair);
    window.addEventListener('syden:graficos', this.aoMudarGraficos);
    window.addEventListener('storage', this.aoMudarGraficos);

    const centro = new THREE.Vector3(N / 2 - 0.3, 0.9, N / 2 - 0.3);
    this.camera.position.copy(centro).add(new THREE.Vector3(12, 10.5, 12));
    this.camera.lookAt(centro);
    this.medir();

    // o sol do alto, do lado aberto do quarto: as sombras caem para as paredes
    this.sol.position.set(6, 12, 9);
    this.sol.target.position.set(3.5, 0, 3.5);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sol.shadow.camera, {
      left: -8,
      right: 8,
      top: 8,
      bottom: -8,
      near: 1,
      far: 30,
    });
    this.sol.shadow.bias = -0.0006;
    this.sol.shadow.normalBias = 0.03;
    this.preenche.position.set(10, 8, 10);
    this.cena.add(this.ceu, this.sol, this.sol.target, this.preenche);
    if (import.meta.env.DEV) (window as unknown as { quarto3dDoTeste?: CenaDoQuarto3D }).quarto3dDoTeste = this;
  }

  /** Carrega os modelos e monta o quarto. Rejeita se algo falhar (quem mostra volta ao pixel art). */
  async montar(): Promise<void> {
    // tudo em paralelo (o cache junta os repetidos)
    const nomes = new Set<string>(['restaurante/door_A']);
    for (const m of ARRUMACAO) {
      nomes.add(m.arquivo);
      for (const c of m.cima ?? []) nomes.add(c.arquivo);
    }
    for (const q of NA_PAREDE) if (q.arquivo !== 'cortica') nomes.add(q.arquivo);
    for (const q of PAREDES) nomes.add(q.arquivo);
    const [g] = await Promise.all([carregarCoelho(), ...[...nomes].map(modelo)]);
    if (this.morta) return;
    this.montarChao();
    for (const m of ARRUMACAO) this.moveis.push(await this.montarMovel({ ...m, cima: m.cima?.map((c) => ({ ...c })) }));
    await this.montarParedes();
    this.luzinhas();
    if (this.morta) return;
    this.montarCoelho(g);
    this.aplicarHora();
    this.aplicarEstado(true);
    this.renderer.setAnimationLoop(this.desenhar);
  }

  // ---- o que vem de fora ----

  definirNoite(noite: boolean) {
    if (noite === this.noite) return;
    this.noite = noite;
    for (const p of this.moveis) p.luzAMao = false;
    // antes de montar, só guarda (montar aplica a hora)
    if (this.coelho) this.aplicarHora();
  }

  definirEstado(estado: EstadoDoCoelho) {
    if (estado === this.estado) return;
    this.estado = estado;
    if (this.coelho) this.aplicarEstado(false);
  }

  definirCores(cores: CoresDoCoelho) {
    this.cores = cores;
    this.coelho?.copia.material.pintar(cores);
  }

  /** A função pelo teclado ou pelo leitor de tela: o mesmo caminho do clique (o coelho vai, e então ela abre). */
  usarFuncao(id: string) {
    const alvo = this.alvoDaFuncao(id);
    if (alvo) this.agir(alvo);
    else this.opcoes.aoFuncao(id);
  }

  /** Onde o objeto de uma função aparece na caixa, em pixels (o teste de tela clica ali). */
  pontoDaFuncao(id: string): { x: number; y: number } | null {
    const alvo = this.alvoDaFuncao(id);
    if (!alvo?.realce) return null;
    const c = new THREE.Box3().setFromObject(alvo.realce).getCenter(new THREE.Vector3()).project(this.camera);
    return { x: ((c.x + 1) / 2) * this.caixa.clientWidth, y: ((1 - c.y) / 2) * this.caixa.clientHeight };
  }

  /** O medidor (o teste de tela): a média dos últimos quadros, e o que o último desenhou. */
  medida() {
    const i = this.renderer.info.render;
    const ms = this.tempos.length ? this.tempos.reduce((a, b) => a + b, 0) / this.tempos.length : 0;
    return {
      ms,
      chamadas: i.calls,
      triangulos: i.triangles,
      desenhados: this.desenhados,
      pose: this.coelho?.pose,
      animacao: this.coelho?.tocando,
    };
  }

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.aoApertar);
    canvas.removeEventListener('pointerup', this.aoSoltar);
    canvas.removeEventListener('pointermove', this.aoMover);
    canvas.removeEventListener('pointerleave', this.aoSair);
    window.removeEventListener('syden:graficos', this.aoMudarGraficos);
    window.removeEventListener('storage', this.aoMudarGraficos);
    this.coelho?.copia.descartar();
    // os materiais são cópias (os de cada peça); a geometria e as texturas dos modelos ficam no cache
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
    });
    for (const d of this.descartaveis) d.dispose();
    if (import.meta.env.DEV) {
      const w = window as unknown as { quarto3dDoTeste?: CenaDoQuarto3D };
      if (w.quarto3dDoTeste === this) delete w.quarto3dDoTeste;
    }
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---- a montagem ----

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    const a = w / h;
    // o quarto inteiro (o chão e as duas paredes) cabendo na caixa quadrada da home
    const meia = a >= 1 ? 6.1 : 6.1 / a;
    Object.assign(this.camera, {
      left: -meia * a,
      right: meia * a,
      top: meia + 0.35,
      bottom: -meia + 0.35,
    });
    this.camera.updateProjectionMatrix();
    this.ultimoQuadro = 0;
  }

  private textura(desenhar: (g: CanvasRenderingContext2D, L: number) => void, L = 512, repetir = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = L;
    desenhar(c.getContext('2d')!, L);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetir, repetir);
    t.anisotropy = 8;
    this.descartaveis.push(t);
    return t;
  }

  private montarChao() {
    const tabuas = this.textura(
      (g, L) => {
        const cores = ['#b9845a', '#b07c53', '#c08d62', '#a9764f'];
        const n = 8;
        for (let i = 0; i < n; i++) {
          g.fillStyle = cores[i % cores.length];
          g.fillRect(0, (i * L) / n, L, L / n);
          g.fillStyle = 'rgba(70,40,25,0.35)';
          g.fillRect(0, ((i + 1) * L) / n - 3, L, 3);
          const corte = ((i * 197) % 5) * (L / 5);
          g.fillRect(corte, (i * L) / n, 3, L / n);
        }
      },
      512,
      2,
    );
    const geo = new THREE.BoxGeometry(N, 0.2, N);
    this.descartaveis.push(geo);
    const chao = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tabuas, roughness: 0.85 }));
    chao.position.set(N / 2, -0.1, N / 2);
    chao.receiveShadow = true;
    this.cena.add(chao);
    // lá fora: um céu e um morro atrás da janela da esquerda
    const planoFora = new THREE.PlaneGeometry(2.2, 1.5);
    const bola = new THREE.SphereGeometry(1, 24, 12);
    this.descartaveis.push(planoFora, bola);
    this.fora = new THREE.Mesh(planoFora, new THREE.MeshBasicMaterial({ color: '#a8dcf5' }));
    this.fora.rotation.y = Math.PI / 2;
    this.fora.position.set(-0.7, 1.75, N / 2);
    this.morro = new THREE.Mesh(bola, new THREE.MeshBasicMaterial({ color: '#86c06a' }));
    this.morro.scale.set(0.05, 0.6, 1.4);
    this.morro.position.set(-0.6, 0.85, N / 2 + 0.4);
    this.cena.add(this.fora, this.morro);
  }

  /** Uma cópia com materiais próprios (para realçar só esta). No Kenney, as cores viram as do KayKit. */
  private copia(g: GLTF, nome = '', cores: Record<string, string> = {}) {
    const o = g.scene.clone(true);
    const kenney = ehKenney(nome);
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (kenney) {
        const cor = cores[mat.name] ?? PALETA_KENNEY[mat.name];
        if (cor) mat.color.set(cor);
        mat.metalness = 0;
        mat.roughness = 0.9;
        if (mat.name === 'lamp') this.lampadas.push(mat);
      }
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return o;
  }

  /** A peça no tamanho do pacote, centrada na própria pegada e com a base em y = 0. */
  private async peca(nome: string, cores?: Record<string, string>, escala = 1) {
    const o = this.copia(await modelo(nome), nome, cores);
    o.scale.setScalar((ehKenney(nome) ? K : S) * escala);
    const caixa = new THREE.Box3().setFromObject(o);
    const tam = caixa.getSize(new THREE.Vector3());
    const c = caixa.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -caixa.min.y, -c.z);
    return { g: new THREE.Group().add(o), tam };
  }

  private async montarMovel(m: Movel): Promise<Pronto> {
    const { g: o, tam } = await this.peca(m.arquivo, m.cores, m.escala);
    const giro = new THREE.Group().add(o);
    const raiz = new THREE.Group().add(giro);
    raiz.userData.movel = m.id;
    if (m.funcao) raiz.userData.funcao = m.funcao;
    const p: Pronto = {
      m,
      raiz,
      giro,
      w: Math.max(1, Math.round(tam.x)),
      d: Math.max(1, Math.round(tam.z)),
      altura: tam.y,
    };
    for (const c of m.cima ?? []) {
      const x = await this.peca(c.arquivo, c.cores, c.escala);
      const item = x.g;
      item.position.set(c.dx, c.dy ?? tam.y, c.dz);
      item.rotation.y = c.giro ?? 0;
      if (c.funcao) item.userData.funcao = c.funcao;
      giro.add(item);
      if (c.arquivo === 'lamp_table') {
        // sem sombra: a de luz pontual são seis desenhos a mais por quadro (medido no piloto: 20 ms de noite)
        p.luz = new THREE.PointLight('#ffc477', 0, 5, 1.6);
        p.luz.position.set(c.dx, tam.y + 0.42, c.dz);
        giro.add(p.luz);
      }
    }
    if (m.id === 'estante') giro.add(this.trofeu(tam.y));
    if (m.arquivo === 'lamp_standing') {
      p.luz = new THREE.PointLight('#ffcf8a', 0, 6, 1.5);
      p.luz.position.set(0, tam.y - 0.15, 0);
      giro.add(p.luz);
    }
    this.cena.add(raiz);
    const { w, d } = this.pegada(p);
    raiz.position.set(m.x + w / 2, 0, m.z + d / 2);
    giro.rotation.y = -m.lado * (Math.PI / 2);
    return p;
  }

  private pegada(p: Pronto) {
    return p.m.lado % 2 ? { w: p.d, d: p.w } : { w: p.w, d: p.d };
  }

  private async montarParedes() {
    for (const q of PAREDES) {
      const o = this.copia(await modelo(q.arquivo));
      // um tico mais largas: as pontas arredondadas se sobrepõem e a emenda some
      o.scale.set(S * (8 / 9) * 1.06, S, S);
      const g = new THREE.Group().add(o);
      const meio = (q.i + 0.5) * (N / 3);
      if (q.parede === 'fundo') g.position.set(meio, 0, -0.19);
      else {
        g.rotation.y = Math.PI / 2;
        g.position.set(-0.19, 0, meio);
      }
      if (q.arquivo.includes('window')) {
        g.userData.funcao = 'janela';
        this.daParede.push(g);
      }
      this.cena.add(g);
    }
    const porta = this.copia(await modelo('restaurante/door_A'));
    porta.scale.set(S * (8 / 9), S, S);
    porta.position.set(N / 2 - 0.71, 0, -0.17);
    this.cena.add(porta);
    for (const q of NA_PAREDE) {
      let g: THREE.Group;
      if (q.arquivo === 'cortica') g = this.cortica();
      else if (ehKenney(q.arquivo)) {
        const x = await this.peca(q.arquivo);
        x.g.children[0].position.z += x.tam.z / 2;
        g = x.g;
      } else {
        const o = this.copia(await modelo(q.arquivo));
        o.scale.setScalar(S);
        g = new THREE.Group().add(o);
        if (q.fotos) g.add(this.fotosDoQuadro());
      }
      const quadro = new THREE.Group().add(g);
      if (q.parede === 'fundo') quadro.position.set(q.u, q.y, 0.01);
      else {
        quadro.rotation.y = Math.PI / 2;
        quadro.position.set(0.01, q.y, q.u);
      }
      if (q.funcao) {
        quadro.userData.funcao = q.funcao;
        this.daParede.push(quadro);
      }
      this.cena.add(quadro);
    }
  }

  /** A cortiça (Caixa de ideias), feita por código: moldura, a cortiça pontilhada, quatro bilhetes e as tachinhas. */
  private cortica() {
    const L = 1.15;
    const A = 0.8;
    const g = new THREE.Group();
    const madeira = new THREE.MeshStandardMaterial({
      color: '#9a5d36',
      roughness: 0.85,
    });
    const pontos = this.textura((c, t) => {
      c.fillStyle = '#c99a63';
      c.fillRect(0, 0, t, t);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = i % 3 ? 'rgba(120,80,40,0.25)' : 'rgba(240,210,160,0.3)';
        c.fillRect((i * 97) % t, (i * 61 + (i >> 3) * 13) % t, 3, 3);
      }
    }, 128);
    const caixa = (w: number, h: number, d: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.descartaveis.push(geo);
      return geo;
    };
    const fundo = new THREE.Mesh(caixa(L, A, 0.04), new THREE.MeshStandardMaterial({ map: pontos, roughness: 1 }));
    fundo.position.set(0, A / 2, 0.02);
    g.add(fundo);
    const ripa = (w: number, h: number, x: number, y: number) => {
      const r = new THREE.Mesh(caixa(w, h, 0.07), madeira);
      r.position.set(x, y, 0.035);
      g.add(r);
    };
    ripa(L + 0.08, 0.06, 0, 0);
    ripa(L + 0.08, 0.06, 0, A);
    ripa(0.06, A, -L / 2, A / 2);
    ripa(0.06, A, L / 2, A / 2);
    const bolinha = new THREE.SphereGeometry(0.022, 8, 6);
    this.descartaveis.push(bolinha);
    const vermelho = new THREE.MeshStandardMaterial({
      color: '#c9473d',
      roughness: 0.5,
    });
    const bilhetes: [string, number, number, number, number][] = [
      ['#f4e1a1', -0.3, 0.52, 0.28, -0.08],
      ['#9cc8d6', 0.12, 0.55, 0.24, 0.1],
      ['#efe5d2', 0.36, 0.3, 0.22, -0.05],
      ['#e9a38a', -0.12, 0.24, 0.3, 0.06],
    ];
    for (const [cor, x, y, t, giro] of bilhetes) {
      const b = new THREE.Mesh(caixa(t, t * 0.85, 0.008), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.95 }));
      b.position.set(x, y, 0.045);
      b.rotation.z = giro;
      b.castShadow = true;
      g.add(b);
      const tacha = new THREE.Mesh(bolinha, vermelho);
      tacha.position.set(x, y + t * 0.33, 0.055);
      g.add(tacha);
    }
    g.traverse((o) => ((o as THREE.Mesh).receiveShadow = true));
    return g;
  }

  /** As fotos do quadro de Amigos: quatro fotos de papel desenhadas (um morro, o mar, o pôr do sol), sem foto de ninguém. */
  private fotosDoQuadro() {
    const t = this.textura((c, L) => {
      c.clearRect(0, 0, L, L);
      const cenas: [number, number, number, string, string][] = [
        [0.2, 0.3, -0.08, '#a8dcf5', '#86c06a'],
        [0.47, 0.62, 0.06, '#f2b27a', '#d0705a'],
        [0.74, 0.32, 0.1, '#9cc8d6', '#3f8fb0'],
        [0.83, 0.7, -0.05, '#f3ead8', '#c99566'],
      ];
      for (const [x, y, giro, ceu, chao] of cenas) {
        c.save();
        c.translate(x * L, y * L);
        c.rotate(giro);
        c.fillStyle = 'rgba(60,40,30,0.25)';
        c.fillRect(-L * 0.12 + 4, -L * 0.15 + 5, L * 0.24, L * 0.3);
        c.fillStyle = '#fbf6ea';
        c.fillRect(-L * 0.12, -L * 0.15, L * 0.24, L * 0.3);
        c.fillStyle = ceu;
        c.fillRect(-L * 0.1, -L * 0.13, L * 0.2, L * 0.2);
        c.fillStyle = chao;
        c.beginPath();
        c.ellipse(0, L * 0.07, L * 0.12, L * 0.07, 0, Math.PI, 0);
        c.fill();
        c.restore();
      }
    }, 256);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const geo = new THREE.PlaneGeometry(1.25, 0.68);
    this.descartaveis.push(geo);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: t,
        transparent: true,
        roughness: 0.9,
      }),
    );
    m.position.set(0, 0, 0.118);
    return m;
  }

  /** O troféu em cima da estante (a estante é a dos Troféus): uma taça dourada feita por código, nenhum pacote tem uma. */
  private trofeu(alturaDaEstante: number) {
    const ouro = new THREE.MeshStandardMaterial({
      color: '#e2b53e',
      roughness: 0.35,
      metalness: 0.3,
    });
    const base = new THREE.MeshStandardMaterial({
      color: '#6b4430',
      roughness: 0.8,
    });
    const g = new THREE.Group();
    const partes: [THREE.BufferGeometry, THREE.Material, number][] = [
      [new THREE.BoxGeometry(0.2, 0.07, 0.2), base, 0.035],
      [new THREE.CylinderGeometry(0.025, 0.04, 0.12, 10), ouro, 0.13],
      [new THREE.CylinderGeometry(0.11, 0.04, 0.16, 14), ouro, 0.27],
    ];
    for (const [geo, mat, y] of partes) {
      this.descartaveis.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true;
      g.add(m);
    }
    const alca = new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI);
    this.descartaveis.push(alca);
    for (const lado of [-1, 1]) {
      const a = new THREE.Mesh(alca, ouro);
      a.position.set(lado * 0.11, 0.28, 0);
      a.rotation.z = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(a);
    }
    g.position.set(0.05, alturaDaEstante, 0);
    return g;
  }

  /** As luzinhas do alto das duas paredes: o fio em arcos e as lâmpadas, acesas à noite (uma luz por parede, sem sombra). */
  private luzinhas() {
    const fio = new THREE.LineBasicMaterial({ color: '#4a3a30' });
    this.descartaveis.push(fio);
    const tons = ['#ffcf7a', '#ffb070', '#ffe3a8'].map((c) => {
      const m = new THREE.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      });
      this.lampadinhas.push(m);
      return m;
    });
    const bolinha = new THREE.SphereGeometry(0.045, 8, 6);
    this.descartaveis.push(bolinha);
    const Y = ALTURA_DA_PAREDE - 0.32;
    for (const parede of ['fundo', 'esquerda'] as const) {
      const ponto = (u: number) => {
        const f = (u / N) * 3;
        const y = Y - Math.sin(Math.PI * (f - Math.floor(f))) * 0.18;
        return parede === 'fundo' ? new THREE.Vector3(u, y, 0.06) : new THREE.Vector3(0.06, y, u);
      };
      const pontos: THREE.Vector3[] = [];
      for (let u = 0.15; u <= N - 0.05; u += 0.05) pontos.push(ponto(u));
      const geo = new THREE.BufferGeometry().setFromPoints(pontos);
      this.descartaveis.push(geo);
      this.cena.add(new THREE.Line(geo, fio));
      const porTom: THREE.Vector3[][] = tons.map(() => []);
      let i = 0;
      for (let u = 0.35; u < N - 0.1; u += 0.4) porTom[i++ % tons.length].push(ponto(u).add(new THREE.Vector3(0, -0.05, 0)));
      porTom.forEach((lugares, t) => {
        const inst = new THREE.InstancedMesh(bolinha, tons[t], lugares.length);
        lugares.forEach((p, k) => inst.setMatrixAt(k, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
        this.cena.add(inst);
      });
      const l = new THREE.PointLight('#ffc37a', 0, 5, 1.6);
      l.position.copy(ponto(N * 0.5)).add(parede === 'fundo' ? new THREE.Vector3(0, -0.2, 0.5) : new THREE.Vector3(0.5, -0.2, 0));
      this.cena.add(l);
      this.arandelas.push(l);
    }
  }

  private montarCoelho(g: GLTF) {
    const copia = copiarCoelho(g, {
      altura: ALTURA_DO_COELHO,
      sombras: true,
      cores: this.cores,
    });
    const corpo = new THREE.Group().add(copia.corpo);
    const raiz = new THREE.Group().add(corpo);
    const casa: [number, number] = [3, 6];
    raiz.position.set(casa[0] + 0.5, 0, casa[1] + 0.5);
    this.cena.add(raiz);
    this.coelho = {
      copia,
      raiz,
      corpo,
      casa,
      caminho: [],
      de: raiz.position.clone(),
      para: raiz.position.clone(),
      inicio: 0,
      duracao: 0,
      arco: 0,
      rumo: 0,
      pose: 'pe',
      em: null,
      depois: null,
      tocando: '',
    };
    this.tocar('parado');
  }

  // ---- dia e noite, sombras ----

  private aplicarHora() {
    this.realcar(null);
    const noite = this.noite;
    this.ceu.intensity = noite ? 0.28 : 1.1;
    this.ceu.color.set(noite ? '#7d86c8' : '#fff3e0');
    this.sol.color.set(noite ? '#9fb4ff' : '#ffe2b8');
    this.sol.intensity = noite ? 0.7 : 3.2;
    this.preenche.intensity = noite ? 0.12 : 0.5;
    (this.fora.material as THREE.MeshBasicMaterial).color.set(noite ? '#1f2850' : '#a8dcf5');
    (this.morro.material as THREE.MeshBasicMaterial).color.set(noite ? '#243a32' : '#86c06a');
    for (const p of this.moveis) if (p.luz && !p.luzAMao) p.luz.intensity = noite ? 6 : 0;
    for (const l of this.arandelas) l.intensity = noite ? 1.6 : 0;
    for (const m of this.lampadinhas) m.emissiveIntensity = noite ? 2.2 : 0.35;
    for (const m of this.lampadas) {
      m.emissive.set('#ffcf7a');
      m.emissiveIntensity = noite ? 1.6 : 0;
    }
    this.renderer.toneMappingExposure = noite ? 1.25 : 1.0;
    this.ultimoQuadro = 0;
  }

  private aoMudarGraficos = () => {
    const sombras = lerSombras();
    if (sombras === this.sombras) return;
    this.sombras = sombras;
    this.renderer.shadowMap.enabled = sombras;
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.needsUpdate = true;
    });
  };

  // ---- o coelho ----

  private tocar(nome: string) {
    const c = this.coelho!;
    if (c.tocando === nome) return;
    const nova = c.copia.acoes.get(nome);
    if (!nova) return;
    const velha = c.copia.acoes.get(c.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.25, false);
    c.tocando = nome;
  }

  private ocupadas(): Set<string> {
    const s = new Set<string>();
    for (const p of this.moveis) {
      if (p.m.chao) continue;
      const { w, d } = this.pegada(p);
      for (let x = p.m.x; x < p.m.x + w; x++) for (let z = p.m.z; z < p.m.z + d; z++) s.add(`${Math.floor(x)},${Math.floor(z)}`);
    }
    return s;
  }

  /** O caminho pela grade, desviando dos móveis (busca em largura). */
  private caminho(de: [number, number], ate: [number, number], cheias: Set<string>): [number, number][] | null {
    const chave = (c: [number, number]) => `${c[0]},${c[1]}`;
    const veio = new Map<string, string | null>([[chave(de), null]]);
    const fila: [number, number][] = [de];
    while (fila.length) {
      const c = fila.shift()!;
      if (c[0] === ate[0] && c[1] === ate[1]) {
        const r: [number, number][] = [];
        let k: string | null = chave(c);
        while (k) {
          const [x, z] = k.split(',').map(Number);
          r.unshift([x, z]);
          k = veio.get(k) ?? null;
        }
        return r.slice(1);
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n: [number, number] = [c[0] + dx, c[1] + dz];
        if (n[0] < 0 || n[1] < 0 || n[0] >= N || n[1] >= N || veio.has(chave(n)) || cheias.has(chave(n))) continue;
        veio.set(chave(n), chave(c));
        fila.push(n);
      }
    }
    return null;
  }

  private livreMaisPerto(x: number, z: number, cheias: Set<string>): [number, number] | null {
    let melhor: [number, number] | null = null;
    let dist = Infinity;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        if (cheias.has(`${i},${j}`)) continue;
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
        if (d < dist) [dist, melhor] = [d, [i, j]];
      }
    return melhor;
  }

  private pular(para: THREE.Vector3, duracao: number, arco: number) {
    const c = this.coelho!;
    c.de.copy(c.raiz.position);
    c.para.copy(para);
    c.inicio = performance.now();
    // quem prefere menos movimento vê o coelho já no lugar
    c.duracao = this.calmo ? 0 : duracao;
    c.arco = arco;
    if (c.de.distanceTo(para) > 0.05) c.rumo = Math.atan2(para.x - c.de.x, para.z - c.de.z);
    if (!c.duracao) c.raiz.position.copy(para);
  }

  /** Anda até a casa e, chegando, faz `depois`. Se estava deitado ou sentado, desce primeiro. `imediato`: já está lá. */
  private irPara(alvo: [number, number], depois: (() => void) | null, imediato = false) {
    const c = this.coelho!;
    const cheias = this.ocupadas();
    if (c.pose !== 'pe') {
      c.pose = 'pe';
      c.em = null;
      const sai = this.livreMaisPerto(c.raiz.position.x, c.raiz.position.z, cheias)!;
      c.casa = sai;
      this.pular(new THREE.Vector3(sai[0] + 0.5, 0, sai[1] + 0.5), 420, 0.35);
      this.tocar('parado');
    }
    if (imediato || this.calmo) {
      c.casa = alvo;
      c.caminho = [];
      c.duracao = 0;
      c.raiz.position.set(alvo[0] + 0.5, 0, alvo[1] + 0.5);
      c.depois = null;
      depois?.();
      return;
    }
    const r = this.caminho(c.casa, alvo, cheias);
    c.caminho = r ?? [];
    c.depois = depois;
    // sem caminho (a casa fechada por móveis), a função abre assim mesmo: o desenho não pode segurar a função
    if (!r && depois) {
      c.depois = null;
      depois();
    }
  }

  /** A frente de um móvel, pelo lado (0 olha para +z), e o centro dele. */
  private frenteDe(p: Pronto) {
    const { w, d } = this.pegada(p);
    const frente = (
      [
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 0],
      ] as const
    )[p.m.lado];
    const cx = p.m.x + w / 2;
    const cz = p.m.z + d / 2;
    return { frente, cx, cz, w, d };
  }

  /** Vai até a frente do móvel; chegando, olha para ele e faz `depois`. */
  private irAoMovel(p: Pronto, depois: () => void, imediato = false) {
    const c = this.coelho!;
    const { frente, cx, cz, w, d } = this.frenteDe(p);
    const chegada = this.livreMaisPerto(cx + frente[0] * (w / 2 + 0.5), cz + frente[1] * (d / 2 + 0.5), this.ocupadas());
    if (!chegada) return depois();
    this.irPara(
      chegada,
      () => {
        c.rumo = Math.atan2(cx - c.raiz.position.x, cz - c.raiz.position.z);
        depois();
      },
      imediato,
    );
  }

  /** Deita na cama ou senta (poltrona, sofá, cadeira); `depois`, já sentado. */
  private usar(p: Pronto, depois: (() => void) | null = null, imediato = false) {
    const c = this.coelho!;
    if (c.em === p) return depois?.();
    this.irAoMovel(
      p,
      () => {
        const { frente, cx, cz } = this.frenteDe(p);
        const rumo = -p.m.lado * (Math.PI / 2);
        const instantaneo = imediato || this.calmo;
        if (p.m.uso === 'deitar') {
          const ponto = new THREE.Vector3(cx, p.altura * DEITADO_ALTURA, cz).add(new THREE.Vector3(frente[0], 0, frente[1]).multiplyScalar(DEITADO_AVANCO));
          this.pular(ponto, instantaneo ? 0 : 520, 0.45);
          this.tocar('dormindo');
          c.pose = 'deitado';
        } else {
          const poltrona = p.m.arquivo.startsWith('armchair') || p.m.arquivo.startsWith('couch');
          const pose = p.m.arquivo.startsWith('armchair')
            ? 'poltrona'
            : p.m.arquivo.startsWith('couch')
              ? 'sentado-sofa'
              : p.m.arquivo.startsWith('chair_desk')
                ? 'computador'
                : 'sentado';
          const ponto = new THREE.Vector3(cx, p.altura * (poltrona ? ASSENTO_POLTRONA : ASSENTO_CADEIRA), cz).add(
            new THREE.Vector3(frente[0], 0, frente[1]).multiplyScalar(poltrona ? 0.08 : 0.02),
          );
          this.pular(ponto, instantaneo ? 0 : 420, 0.3);
          this.tocar(pose);
          c.pose = 'sentado';
        }
        c.em = p;
        c.rumo = rumo;
        if (instantaneo) c.corpo.rotation.y = rumo;
        if (depois) {
          // a função abre quando ele já sentou (o pulo para o assento leva ~0,4 s)
          if (instantaneo) depois();
          else c.depois = depois;
        }
      },
      imediato,
    );
  }

  /** O coelho no lugar do estado de verdade: ausente, dorme na cama; em chamada, ao computador; à toa, de pé no quarto. */
  private aplicarEstado(imediato: boolean) {
    const c = this.coelho;
    if (!c) return;
    this.voltarEm = 0;
    const movel = (id: string) => this.moveis.find((p) => p.m.id === id);
    if (this.estado === 'ausente') {
      const cama = movel('cama');
      if (cama) this.usar(cama, null, imediato);
    } else if (this.estado === 'call') {
      const cadeira = movel('cadeira');
      if (cadeira) this.usar(cadeira, null, imediato);
    } else if (c.pose !== 'pe' && (c.em?.m.id === 'cama' || c.em?.m.id === 'cadeira')) {
      // acordou ou saiu da chamada: levanta e fica de pé ali perto
      const sai = this.livreMaisPerto(c.raiz.position.x, c.raiz.position.z, this.ocupadas());
      if (sai) this.irPara(sai, null, imediato);
    }
  }

  // ---- os cliques ----

  private alvoDaFuncao(id: string): Alvo | null {
    const p = this.moveis.find((m) => m.m.funcao === id);
    if (p)
      return {
        funcao: id,
        movel: p,
        realce: p.raiz,
        ponto: p.raiz.position.clone(),
      };
    for (const p2 of this.moveis)
      for (const filho of p2.giro.children)
        if (filho.userData.funcao === id)
          return {
            funcao: id,
            movel: p2,
            realce: filho,
            ponto: new THREE.Vector3().setFromMatrixPosition(filho.matrixWorld),
          };
    const naParede = this.daParede.find((o) => o.userData.funcao === id);
    if (naParede)
      return {
        funcao: id,
        realce: naParede,
        ponto: new THREE.Vector3().setFromMatrixPosition(naParede.matrixWorld),
      };
    return null;
  }

  private mirar(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(this.ponteiro, this.camera);
  }

  /** O que está sob o ponteiro: o primeiro objeto com função (que exista aqui) ou móvel de usar. */
  private alvoNoPonto(): Alvo | null {
    const hits = this.raio.intersectObjects([...this.moveis.map((p) => p.raiz), ...this.daParede], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      let funcao: THREE.Object3D | null = null;
      let raiz: THREE.Object3D | null = null;
      while (o) {
        if (!funcao && o.userData.funcao && this.opcoes.temFuncao(o.userData.funcao)) funcao = o;
        if (o.userData.movel) raiz = o;
        o = o.parent;
      }
      const movel = raiz ? this.moveis.find((p) => p.raiz === raiz) : undefined;
      if (funcao)
        return {
          funcao: funcao.userData.funcao,
          movel,
          realce: funcao,
          ponto: h.point,
        };
      if (movel?.m.uso) return { movel, realce: movel.raiz, ponto: h.point };
      // um móvel sem nada (a mesinha, a caixa) fica na frente do que está atrás: o clique para nele
      if (movel) return null;
    }
    return null;
  }

  private casaNoChao(): [number, number] | null {
    const p = new THREE.Vector3();
    if (!this.raio.ray.intersectPlane(this.planoDoChao, p)) return null;
    const x = Math.floor(p.x);
    const z = Math.floor(p.z);
    return x >= 0 && z >= 0 && x < N && z < N ? [x, z] : null;
  }

  /** O que o clique (ou o teclado) faz com um alvo: a animação primeiro, a função depois. */
  private agir(alvo: Alvo) {
    const c = this.coelho;
    if (!c) return;
    const id = alvo.funcao;
    const abrir = () => {
      if (!id) return;
      this.opcoes.aoFuncao(id);
      if (this.estado !== 'atoa') this.voltarEm = performance.now() + VOLTA_AO_ESTADO_MS;
    };
    this.voltarEm = 0;
    if (id === 'computador') {
      // senta ao computador, e então os Mini-games
      const cadeira = this.moveis.find((p) => p.m.id === 'cadeira');
      if (cadeira) return this.usar(cadeira, abrir);
    }
    if (alvo.movel && (id || alvo.movel.m.uso === 'luz')) {
      return this.irAoMovel(alvo.movel, () => {
        if (!id) {
          // a luminária: acende e apaga só ela, à mão
          const p = alvo.movel!;
          if (p.luz) {
            p.luz.intensity = p.luz.intensity > 0 ? 0 : this.noite ? 6 : 2.5;
            p.luzAMao = true;
            this.ultimoQuadro = 0;
          }
          return;
        }
        abrir();
      });
    }
    if (alvo.movel?.m.uso) return this.usar(alvo.movel);
    if (id) {
      // o que está na parede (o quadro, a cortiça, a janela): ele vai até a parede, olha para ela, e a função abre
      const ponto = alvo.ponto;
      const casa = this.livreMaisPerto(Math.max(0.5, ponto.x), Math.max(0.5, ponto.z), this.ocupadas());
      if (!casa) return abrir();
      this.irPara(casa, () => {
        c.rumo = Math.atan2(ponto.x - c.raiz.position.x, ponto.z - c.raiz.position.z);
        abrir();
      });
    }
  }

  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };

  private aoSoltar = (e: PointerEvent) => {
    const a = this.apertou;
    this.apertou = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 8 || e.button !== 0 || !this.coelho) return;
    this.mirar(e);
    const alvo = this.alvoNoPonto();
    if (alvo) return this.agir(alvo);
    const casa = this.casaNoChao();
    if (!casa) return;
    this.voltarEm = 0;
    const cheias = this.ocupadas();
    const ate = cheias.has(`${casa[0]},${casa[1]}`) ? this.livreMaisPerto(casa[0] + 0.5, casa[1] + 0.5, cheias) : casa;
    if (ate) {
      this.irPara(ate, null);
      if (this.estado !== 'atoa') this.voltarEm = performance.now() + VOLTA_AO_ESTADO_MS;
    }
  };

  private aoMover = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.passou = e;
  };

  private aoSair = () => {
    this.passou = null;
    this.realcar(null);
    this.opcoes.aoPassar(null);
  };

  /** O realce: uma luz morna nos materiais do objeto sob o mouse (a cor própria de cada um volta ao sair). */
  private realcar(o: THREE.Object3D | null) {
    if (o === this.realcado) return;
    for (const [m, antes] of this.emissivos) {
      m.emissive.copy(antes.cor);
      m.emissiveIntensity = antes.intensidade;
    }
    this.emissivos.clear();
    this.realcado = o;
    o?.traverse((x) => {
      const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!(x as THREE.Mesh).isMesh || !m?.emissive || this.emissivos.has(m)) return;
      // o que já brilha (as lâmpadas à noite) continua brilhando; o resto ganha o realce
      if (m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return;
      this.emissivos.set(m, {
        cor: m.emissive.clone(),
        intensidade: m.emissiveIntensity,
      });
      m.emissive.copy(REALCE);
      m.emissiveIntensity = 1;
    });
    this.renderer.domElement.style.cursor = o ? 'pointer' : '';
    this.ultimoQuadro = 0;
  }

  private passarAgora() {
    const e = this.passou;
    if (!e) return;
    this.passou = null;
    this.mirar(e);
    const alvo = this.alvoNoPonto();
    this.realcar(alvo?.realce ?? null);
    const r = this.renderer.domElement.getBoundingClientRect();
    this.opcoes.aoPassar(alvo?.funcao ? { id: alvo.funcao, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  }

  // ---- o laço ----

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, não desenha nada
    if (document.hidden || !document.hasFocus()) {
      this.relogio.update();
      return;
    }
    const agora = performance.now();
    if (agora - this.ultimoQuadro < INTERVALO_MS) return;
    this.ultimoQuadro = agora;
    this.relogio.update();
    const dt = Math.min(0.1, this.relogio.getDelta());
    this.passarAgora();
    const c = this.coelho;
    if (c) {
      if (this.voltarEm && agora >= this.voltarEm && !c.caminho.length && !c.depois) this.aplicarEstado(false);
      const f = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
      if (f >= 1 && c.caminho.length) {
        const [x, z] = c.caminho.shift()!;
        c.casa = [x, z];
        this.pular(new THREE.Vector3(x + 0.5, 0, z + 0.5), 360, 0);
        this.tocar('andando');
      } else if (f >= 1 && c.depois) {
        const d = c.depois;
        c.depois = null;
        d();
      } else if (f >= 1 && c.pose === 'pe' && c.tocando === 'andando') this.tocar('parado');
      const g = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
      const e = c.arco > 0 ? g * g * (3 - 2 * g) : g;
      c.raiz.position.lerpVectors(c.de, c.para, e);
      c.raiz.position.y += g < 1 ? Math.sin(Math.PI * g) * c.arco : 0;
      let delta = c.rumo - c.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      c.corpo.rotation.y += delta * 0.4;
      if (!this.calmo) c.copia.mixer.update(dt);
      else if (c.copia.mixer.time === 0) c.copia.mixer.update(0.01);
    }
    this.renderer.render(this.cena, this.camera);
    this.desenhados++;
    this.tempos.push(performance.now() - agora);
    if (this.tempos.length > 60) this.tempos.shift();
  };
}

function lerSombras(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem('syden:graficos') ?? '{}').sombras;
  } catch {
    return false;
  }
}

// O que a caixa React (Quarto3D.tsx) pede desta parte: as cores vêm junto do three.js, no mesmo pedaço.
export { coresDoAvatar, minhasCoresDoCoelho } from '../coelho3d';
