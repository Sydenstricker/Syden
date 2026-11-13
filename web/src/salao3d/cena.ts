import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { carregarCoelho, CORES_DO_MASCOTE, copiarCoelho, type CoelhoCopiado, type CoresDoCoelho } from '../coelho3d';
import type { Epoca } from './epocas';
import { elementoAVista } from '../CenaGuardada';

/**
 * O SALÃO DA COMUNIDADE EM 3D LOW POLY (06/11/2026, pedido dele: o Natal "no salão, em 3D"). É a versão 3D do salão isométrico de
 * pixel art (e2e/pixel-art/salao/), como o quarto 3D (quarto3d/cena.ts) é a do quarto, e segue as regras dele:
 *
 * - AS MESMAS FUNÇÕES NOS MESMOS OBJETOS (o id é o de `AcoesDoSalao`, em Salao.tsx): a TV → entrar na voz ou assistir quem
 *   transmite (com o Ao vivo na tela), o fliperama → Mini-games, a estante → a conversa, o balcão e o coelho dele → o recado, o
 *   quadro → a capa da comunidade (e, para quem administra, montar a tela), a prateleira com o troféu → Conquistas, a jukebox e o
 *   microfone → o karaokê. A janela é ambientação (decisão dele, 18/10/2026). Clicar abre na hora: no salão o coelho de cada um não
 *   anda até lá, porque o salão não é de uma pessoa só.
 * - QUEM ESTÁ NA CALL de verdade, cada um com as cores do avatar: o sofá primeiro, depois as poltronas, as banquetas, a mesa de
 *   jogos e de pé; quem transmite fica na frente da TV, quem está numa partida, no fliperama. Sem ninguém, o salão fica vazio (a
 *   tela não finge movimento). O coelho do recado está sempre lá, atrás do balcão.
 * - AS ÉPOCAS (epocas.ts): no Natal, a árvore com os presentes, o trenzinho dando a volta nela, a casinha de gengibre, o boneco de
 *   neve, o poste com as bolas de neve e a poltrona vermelha com o pufe e o leite com biscoitos — e o coelho do recado RECEBE ALI,
 *   sentado na poltrona, em vez do balcão. A mesa de jogos sai para dar lugar.
 * - A arrumação é a de fábrica: o Editar continua no pixel art (a do servidor é de pixel e não serve ao 3D).
 * - SEM FOCO OU ESCONDIDA, NÃO DESENHA; no máximo 30 quadros por segundo; com "menos movimento", o trem para e as luzes ficam acesas.
 *
 * Os modelos: KayKit (Furniture Bits e Restaurant Bits, já em web/public/quarto3d/; Holiday Bits em web/public/salao3d/natal/) e o
 * Furniture Kit do Kenney e o banheiro do Tiny Treats (Bubbly Bathroom, de Isa Lousberg, em web/public/salao3d/banheiro/), todos
 * CC0, com as licenças ao lado. O que nenhum tem (as paredes de tijolo, o fliperama, a jukebox, o
 * microfone, o troféu, a janela, as telas) é feito aqui por código.
 */

const BASE = import.meta.env.BASE_URL;
/** O salão tem 12 × 12 casas (o de pixel tem 16 × 16 com câmera; aqui ele cabe inteiro na caixa, sem câmera que anda). */
const N = 12;
const ALTURA_DA_PAREDE = 3.4;
/** O tamanho das peças do KayKit (o mesmo do quarto 3D) e do Kenney (com 2, da altura das do KayKit). */
const S = 0.75;
const K = 2;
const ALTURA_DO_COELHO = 1.1;
const INTERVALO_MS = 1000 / 31;
const REALCE = new THREE.Color('#4a3418');

/** As cores do Kenney trocadas pelas do KayKit (as mesmas do quarto 3D). */
const PALETA_KENNEY: Record<string, string> = {
  wood: '#c47c4a',
  woodDark: '#8a5233',
  carpet: '#c9714f',
  carpetDarker: '#a5573b',
  carpetWhite: '#efe5d2',
  metal: '#cfd2c8',
  metalLight: '#eceee6',
  metalMedium: '#7d8984',
  metalDark: '#4b5451',
};

/**
 * O endereço de um modelo pelo prefixo: q (quarto3d, KayKit), qk (quarto3d, Kenney), r (Restaurant Bits), k (salao3d, Kenney),
 * b (o banheiro, Tiny Treats), n (o Natal).
 */
function urlDe(nome: string) {
  const [p, arq] = nome.split(':') as [string, string];
  if (p === 'b') return `${BASE}salao3d/banheiro/${arq}.gltf`;
  if (p === 'q') return `${BASE}quarto3d/${arq}.gltf`;
  if (p === 'qk') return `${BASE}quarto3d/kenney/${arq}.glb`;
  if (p === 'r') return `${BASE}quarto3d/restaurante/${arq}.gltf`;
  if (p === 'k') return `${BASE}salao3d/kenney/${arq}.glb`;
  return `${BASE}salao3d/natal/${arq}.gltf`;
}
const ehKenney = (nome: string) => nome.startsWith('k:') || nome.startsWith('qk:');

const carregador = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
function modelo(nome: string) {
  let p = cache.get(nome);
  if (!p) {
    p = carregador.loadAsync(urlDe(nome));
    p.catch(() => cache.delete(nome));
    cache.set(nome, p);
  }
  return p;
}

type Uso = 'sofa' | 'poltrona' | 'banqueta' | 'cadeira' | 'trono';
interface Item {
  id?: string;
  /** Um modelo (com o prefixo) ou uma peça feita por código ('@fliperama', '@jukebox', '@microfone'). */
  arquivo: string;
  x: number;
  z: number;
  /** O giro (rotation.y): 0 olha para +z (a sala), π/2 para +x. */
  giro?: number;
  escala?: number;
  y?: number;
  cores?: Record<string, string>;
  funcao?: string;
  uso?: Uso;
  /** 'so': só na época; 'fora': some na época (a mesa de jogos, no Natal). */
  natal?: 'so' | 'fora';
}

const PI = Math.PI;
/** A arrumação de fábrica, pelo layout do salão de pixel art (o canto da TV, o bar no fundo, o fliperama e o karaokê). */
const ARRUMACAO: Item[] = [
  // o canto da TV: a TV na parede da esquerda, o sofá de frente, a mesinha no meio e as poltronas dos lados
  { id: 'tapete', arquivo: 'q:rug_oval_B', x: 3.0, z: 4.6, giro: PI / 2, escala: 1.35 },
  { id: 'rack', arquivo: 'k:cabinetTelevision', x: 0.35, z: 4.6, giro: PI / 2, escala: 1.25 },
  { id: 'tv', arquivo: 'k:televisionModern', x: 0.42, z: 4.6, giro: PI / 2, escala: 1.55, funcao: 'tv' },
  { id: 'sofa', arquivo: 'q:couch_pillows', x: 4.7, z: 4.6, giro: -PI / 2, uso: 'sofa' },
  { id: 'mesinha', arquivo: 'q:table_low', x: 2.75, z: 4.6, giro: PI / 2, escala: 0.8 },
  { arquivo: 'q:mug_A', x: 2.6, z: 4.3, y: 0.3 },
  { id: 'poltrona-1', arquivo: 'q:armchair_pillows', x: 2.9, z: 2.3, giro: 0, uso: 'poltrona' },
  { id: 'poltrona-2', arquivo: 'q:armchair_pillows', x: 2.9, z: 6.9, giro: PI, uso: 'poltrona' },
  // o fundo: a planta, a estante (os canais), o quadro, a janela, o bar com as banquetas e a geladeira
  { arquivo: 'qk:pottedPlant', x: 0.45, z: 0.45, escala: 1.5 },
  { id: 'estante', arquivo: 'qk:bookcaseClosedWide', x: 1.85, z: 0.3, funcao: 'estante', escala: 1.1 },
  { arquivo: 'qk:books', x: 1.45, z: 0.3, y: 1.74, escala: 1.4 },
  { arquivo: 'qk:plantSmall2', x: 2.35, z: 0.3, y: 1.74 },
  { id: 'balcao', arquivo: '@balcao', x: 8.6, z: 1.9, funcao: 'balcao' },
  { arquivo: 'k:kitchenCoffeeMachine', x: 7.5, z: 1.85, y: 0.86 },
  { id: 'banqueta-1', arquivo: 'k:stoolBar', x: 7.5, z: 2.85, giro: PI, uso: 'banqueta' },
  { id: 'banqueta-2', arquivo: 'k:stoolBar', x: 8.6, z: 2.85, giro: PI, uso: 'banqueta' },
  { id: 'banqueta-3', arquivo: 'k:stoolBar', x: 9.7, z: 2.85, giro: PI, uso: 'banqueta' },
  { arquivo: 'k:kitchenFridgeLarge', x: 11.3, z: 0.45 },
  { arquivo: 'q:lamp_standing', x: 5.15, z: 0.55 },
  // o canto do fliperama e do karaokê, na parede da TV
  { id: 'fliperama', arquivo: '@fliperama', x: 0.5, z: 8.0, giro: PI / 2, funcao: 'fliperama' },
  { id: 'jukebox', arquivo: '@jukebox', x: 0.45, z: 9.7, giro: PI / 2, funcao: 'jukebox' },
  { id: 'microfone', arquivo: '@microfone', x: 1.7, z: 10.6, giro: PI / 2, funcao: 'microfone' },
  { arquivo: 'k:speaker', x: 0.35, z: 10.9, giro: PI / 2 },
  // a mesa de jogos na frente (no Natal, ela dá lugar à árvore)
  { id: 'mesa-jogo', arquivo: 'k:tableRound', x: 9.6, z: 6.4, natal: 'fora' },
  { id: 'cadeira-1', arquivo: 'k:chairCushion', x: 8.55, z: 6.4, giro: PI / 2, uso: 'cadeira', natal: 'fora' },
  { id: 'cadeira-2', arquivo: 'k:chairCushion', x: 10.65, z: 6.4, giro: -PI / 2, uso: 'cadeira', natal: 'fora' },
  { id: 'cadeira-3', arquivo: 'k:chairCushion', x: 9.6, z: 5.35, giro: 0, uso: 'cadeira', natal: 'fora' },
  { id: 'cadeira-4', arquivo: 'k:chairCushion', x: 9.6, z: 7.45, giro: PI, uso: 'cadeira', natal: 'fora' },
  { arquivo: 'qk:pottedPlant', x: 11.5, z: 11.4, escala: 1.3, natal: 'fora' },
];

/** O Natal (06/11/2026, a montagem dele): tudo do Holiday Bits. O trilho e o trem são montados à parte (`montarTrem`). */
const CENTRO_DA_ARVORE: [number, number] = [9.9, 6.4];
const NATAL: Item[] = [
  { id: 'arvore', arquivo: 'n:christmas_tree_decorated', x: CENTRO_DA_ARVORE[0], z: CENTRO_DA_ARVORE[1], escala: 0.8, natal: 'so' },
  // os presentes em volta do pé da árvore, dentro do trilho
  ...(
    [
      ['present_A_red', 0.95, 0.3, 0.4],
      ['present_B_yellow', -0.9, 0.45, -0.3],
      ['present_C_green', 0.2, 1.0, 0.9],
      ['present_D_blue', -0.4, -1.0, 0.2],
      ['present_sphere_A_red', 0.75, -0.75, 0],
      ['present_E_red', -0.15, 1.5, -0.5],
      ['present_A_green', 0.45, -1.55, 0.7],
      ['present_sphere_B_blue', -0.55, 1.15, 0],
      ['present_F_yellow', 0.15, -1.45, 1.2],
    ] as const
  ).map(([a, dx, dz, giro]): Item => ({ arquivo: 'n:' + a, x: CENTRO_DA_ARVORE[0] + dx, z: CENTRO_DA_ARVORE[1] + dz, giro, natal: 'so' })),
  // o canto de quem recebe: o tapete redondo, a poltrona vermelha virada para quem chega, o pufe e o leite com biscoitos
  { arquivo: 'n:carpet_round_large', x: 6.9, z: 9.6, escala: 0.85, natal: 'so' },
  { id: 'trono', arquivo: 'n:chair_large_red', x: 6.7, z: 9.3, giro: PI / 4, uso: 'trono', funcao: 'balcao', natal: 'so' },
  { arquivo: 'n:footstool_red', x: 7.55, z: 10.25, giro: PI / 4, natal: 'so' },
  { id: 'banquinho', arquivo: 'n:stool', x: 5.65, z: 10.2, escala: 0.7, natal: 'so' },
  { arquivo: 'n:plate_small_white', x: 5.75, z: 10.3, y: 0.37, escala: 0.6, natal: 'so' },
  { arquivo: 'n:cookie', x: 5.72, z: 10.36, y: 0.42, escala: 0.6, natal: 'so' },
  { arquivo: 'n:cookie', x: 5.86, z: 10.22, y: 0.44, escala: 0.55, giro: 0.7, natal: 'so' },
  { arquivo: 'n:milk', x: 5.5, z: 10.05, y: 0.37, escala: 0.75, natal: 'so' },
  // a casinha de gengibre, o boneco de neve, o poste com neve e as bolas
  { arquivo: 'n:gingerbread_house_decorated', x: 11.3, z: 9.9, giro: -PI / 4, natal: 'so' },
  { arquivo: 'n:candycane_large', x: 11.45, z: 11.35, giro: -0.4, escala: 0.6, natal: 'so' },
  { arquivo: 'n:gingerbread_man', x: 10.6, z: 9.4, giro: -PI / 4, escala: 0.8, natal: 'so' },
  { arquivo: 'n:snowman_B', x: 4.7, z: 11.2, giro: PI / 4, escala: 0.75, natal: 'so' },
  { arquivo: 'n:lantern_decorated', x: 3.3, z: 9.7, giro: PI / 4, escala: 0.7, natal: 'so' },
  { arquivo: 'n:snowball_pile', x: 3.2, z: 10.75, giro: PI / 4, escala: 0.7, natal: 'so' },
  { arquivo: 'n:candycane_small', x: 7.9, z: 8.2, giro: 0.6, natal: 'so' },
];

/** O que se pendura nas paredes (u ao longo dela, y de altura). */
interface DaParede {
  arquivo: string;
  parede: 'fundo' | 'esquerda';
  u: number;
  y: number;
  funcao?: string;
  natal?: 'so';
  escala?: number;
}
const NA_PAREDE: DaParede[] = [
  { arquivo: 'q:pictureframe_large_B', parede: 'fundo', u: 4.1, y: 1.95, funcao: 'quadro' },
  { arquivo: '@trofeu', parede: 'fundo', u: 8.6, y: 2.35, funcao: 'trofeu' },
  { arquivo: 'n:wreath', parede: 'esquerda', u: 11.05, y: 2.75, natal: 'so', escala: 0.6 },
  { arquivo: 'n:bell_decorated', parede: 'fundo', u: 6.35, y: 2.85, natal: 'so', escala: 0.5 },
  { arquivo: 'n:wreath', parede: 'fundo', u: 1.85, y: 2.65, natal: 'so', escala: 0.45 },
];
/** A janela do fundo (ambientação): de fora, o céu da hora. */
const JANELA = { u: 6.35, y: 1.75, w: 1.5, h: 1.3 };
/** A porta, na parede da esquerda, perto da frente (por onde a turma chega). */
const PORTA_U = 11.05;

/**
 * A PORTA DO BANHEIRO, na parede da esquerda, entre o canto da planta e o da TV (do Tiny Treats, fechada, com a moldura e a
 * plaquinha do patinho em cima, feitas aqui): clicar abre o banheiro. A porta vai de `z` para o fundo.
 */
const PORTA_DO_BANHEIRO = { z: 2.6, largura: 1.2, altura: 2.1 };

/**
 * O BANHEIRO (06/11/2026, pedido dele, pela foto do Bubbly Bathroom do Tiny Treats) É UM CÔMODO À PARTE, ATRÁS DA PORTA: a primeira
 * versão era um canto do salão com muretas, e "o banheiro é para ficar atrás da porta" (correção dele, no mesmo dia). Ele mora
 * longe do salão na mesma cena (`origem`, fora da vista dele), e a câmera passa para lá quando a porta abre: o cômodo sozinho na
 * caixa, como casa de boneca (as duas paredes do fundo inteiras, de azulejo, e as da frente cortadas em muretas baixas), com a
 * porta de dentro e o botão de voltar. Ninguém da call aparece nele.
 * É ambientação: só as duas portas têm função (entrar e voltar). As peças paradas viram UMA malha só (todas usam a mesma textura
 * do pacote): uma chamada de desenho para o banheiro inteiro; só o patinho, que boia, e a porta de dentro, que abre, ficam à parte.
 */
const BANHEIRO = { origem: 40, largura: 4.2, fundo: 3.3, espessura: 0.12, mureta: 0.5, piso: 0.03, parede: 0.2 };
interface DoBanheiro {
  arquivo: string;
  x: number;
  z: number;
  y?: number;
  giro?: number;
  escala?: number;
  /** Da parede: a origem do pacote fica onde está (a peça já nasce com as costas em z = 0), sem centrar a pegada. */
  parede?: boolean;
}
const B = BANHEIRO;
const PECAS_DO_BANHEIRO: DoBanheiro[] = [
  // a pia no balcão azul, com o espelho em cima, e o que fica nela
  { arquivo: 'b:cabinet_bathroom', x: 0.8, z: 0.6 },
  { arquivo: 'b:mirror', x: 0.8, z: 0.01, y: 2.3, parede: true },
  { arquivo: 'b:container_bathroom_D_blue', x: 1.32, z: 0.32, y: 0.98, giro: -0.4 },
  { arquivo: 'b:soap_dish_blue', x: 1.3, z: 0.75, y: 0.98, giro: 0.3 },
  { arquivo: 'b:toothbrush_cup_decorated', x: 0.25, z: 0.3, y: 0.98 },
  { arquivo: 'b:container_bathroom_C_yellow', x: 0.28, z: 0.72, y: 0.98 },
  // a banheira com a espuma (o patinho é à parte), e a prateleira de madeira em cima, com a vela, a planta e as toalhas
  { arquivo: 'b:bath', x: 2.85, z: 0.8, giro: PI / 2 },
  { arquivo: 'b:wall_shelf', x: 2.85, z: 0.01, y: 2.15, parede: true },
  { arquivo: 'b:candle', x: 2.3, z: 0.25, y: 2.15 },
  { arquivo: 'b:plant', x: 2.95, z: 0.26, y: 2.15, escala: 0.8 },
  { arquivo: 'b:container_bathroom_A_blue', x: 3.45, z: 0.24, y: 2.15 },
  { arquivo: 'b:container_bathroom_B_pink', x: 3.68, z: 0.26, y: 2.15 },
  // o vaso encostado na mureta do lado, o papel e o lixinho
  { arquivo: 'b:toilet', x: 3.7, z: 1.98, giro: -PI / 2 },
  { arquivo: 'b:toilet_roll_holder', x: B.largura - B.espessura / 2, z: 2.5, y: 0.2, giro: -PI / 2, parede: true },
  { arquivo: 'b:toilet_roll_stack', x: 3.85, z: 2.52, giro: -0.3 },
  { arquivo: 'b:bin', x: 3.2, z: 2.48 },
  // o tapete rosa na frente da banheira, com os chinelos, e a pilha de toalhas
  { arquivo: 'b:mat', x: 2.45, z: 1.95 },
  { arquivo: 'b:slippers', x: 2.3, z: 2.0, y: 0.075, giro: 0.35 },
  { arquivo: 'b:towel_stacked', x: 1.42, z: 1.62, escala: 0.8, giro: 0.2 },
];

export interface PessoaNoSalao3D {
  id: number;
  nome: string;
  papel: 'call' | 'transmitindo' | 'jogando';
  cores: CoresDoCoelho;
}

export interface OpcoesDoSalao3D {
  aoFuncao(id: string): void;
  aoPassar(alvo: { id: string; x: number; y: number } | null): void;
  temFuncao(id: string): boolean;
  /** Os nomes em cima de quem está na call mudaram de lugar (gente nova, a caixa mudou de tamanho). */
  aoMudarRotulos(): void;
  /** A câmera passou para o banheiro (a porta abriu) ou voltou ao salão. */
  aoMudarVista(vista: VistaDoSalao3D): void;
}

/** Onde a câmera está: no salão, ou dentro do banheiro (atrás da porta). */
export type VistaDoSalao3D = 'salao' | 'banheiro';
/** As funções que são da própria cena (as duas portas do banheiro), e não do salão de fora. */
const DA_CENA = new Set(['banheiro', 'sair-do-banheiro']);

interface Pronto {
  item: Item;
  raiz: THREE.Group;
  tam: THREE.Vector3;
}

interface Lugar {
  pos: THREE.Vector3;
  giro: number;
  anim: string;
}

interface Coelho {
  copia: CoelhoCopiado;
  raiz: THREE.Group;
  tocando: string;
}

export class CenaDoSalao3D {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private ceu = new THREE.HemisphereLight('#fffaf0', '#c9a88a', 1.7);
  private sol = new THREE.DirectionalLight('#fff0d8', 2.3);
  private preenche = new THREE.DirectionalLight('#dfe8ff', 0.7);
  private moveis: Pronto[] = [];
  private clicaveis: THREE.Object3D[] = [];
  private lampadinhas: THREE.MeshStandardMaterial[] = [];
  private brilhos: THREE.MeshStandardMaterial[] = [];
  private luzes: THREE.PointLight[] = [];
  private luzDaArvore: THREE.PointLight | null = null;
  private fora: THREE.MeshBasicMaterial | null = null;
  private telaDaTv: { tex: THREE.CanvasTexture; c: HTMLCanvasElement } | null = null;
  private quadro: THREE.MeshStandardMaterial | null = null;
  private recado: Coelho | null = null;
  private recadoAberto = false;
  private pessoas = new Map<number, Coelho & { p: PessoaNoSalao3D }>();
  private listaDePessoas: PessoaNoSalao3D[] = [];
  private gltfDoCoelho: GLTF | null = null;
  private trem: { carros: THREE.Object3D[]; s: number; perimetro: number; ponto: (s: number) => { x: number; z: number; giro: number } } | null = null;
  private neve: THREE.Points | null = null;
  private patinho: { g: THREE.Group; x: number; y: number; z: number } | null = null;
  private vista: VistaDoSalao3D = 'salao';
  /** A porta que está abrindo (ao fim, a câmera passa para o outro cômodo e ela fecha de novo). */
  private abrindo: { porta: THREE.Object3D; desde: number; ir: VistaDoSalao3D } | null = null;
  private noite = false;
  private sombras: boolean;
  private particulas: boolean;
  private calmo: boolean;
  private raio = new THREE.Raycaster();
  private ponteiro = new THREE.Vector2();
  private observador: ResizeObserver;
  private relogio = new THREE.Timer();
  private ultimoQuadro = 0;
  private morta = false;
  private montada = false;
  private descartaveis: { dispose(): void }[] = [];
  private realcado: THREE.Object3D | null = null;
  private emissivos = new Map<THREE.MeshStandardMaterial, { cor: THREE.Color; intensidade: number }>();
  private apertou: { x: number; y: number } | null = null;
  private passou: PointerEvent | null = null;
  private tempos: number[] = [];
  private t = 0;
  desenhados = 0;

  constructor(
    private caixa: HTMLElement,
    private opcoes: OpcoesDoSalao3D,
    private epoca: Epoca | null,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const g = lerGraficos();
    this.sombras = g.sombras;
    this.particulas = g.particulas;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'salao3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    canvas.addEventListener('pointerdown', this.aoApertar);
    canvas.addEventListener('pointerup', this.aoSoltar);
    canvas.addEventListener('pointermove', this.aoMover);
    canvas.addEventListener('pointerleave', this.aoSair);
    window.addEventListener('syden:graficos', this.aoMudarGraficos);
    window.addEventListener('storage', this.aoMudarGraficos);

    this.medir();

    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sol.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
    this.sol.shadow.bias = -0.0006;
    this.sol.shadow.normalBias = 0.03;
    this.enquadrar();
    this.cena.add(this.ceu, this.sol, this.sol.target, this.preenche);
    if (import.meta.env.DEV) (window as unknown as { salao3dDoTeste?: CenaDoSalao3D }).salao3dDoTeste = this;
  }

  private get natal() {
    return this.epoca === 'natal';
  }

  private vale(i: { natal?: 'so' | 'fora' }) {
    return i.natal === 'so' ? this.natal : i.natal === 'fora' ? !this.natal : true;
  }

  /** Carrega os modelos e monta o salão. Rejeita se algo falhar (quem mostra volta ao pixel art). */
  async montar(): Promise<void> {
    const itens = [...ARRUMACAO, ...NATAL].filter((i) => this.vale(i));
    const nomes = new Set<string>(['r:door_A', 'b:floor_tiled', 'b:ducky', ...PECAS_DO_BANHEIRO.map((p) => p.arquivo)]);
    for (const i of itens) if (!i.arquivo.startsWith('@')) nomes.add(i.arquivo);
    for (const q of NA_PAREDE) if (this.vale(q) && !q.arquivo.startsWith('@')) nomes.add(q.arquivo);
    if (this.natal)
      for (const n of ['tracks_straight', 'tracks_curve', 'train_locomotive', 'train_tender_coal', 'train_wagon', 'train_tender_presents_A'])
        nomes.add('n:' + n);
    const [g] = await Promise.all([carregarCoelho(), ...[...nomes].map(modelo)]);
    if (this.morta) return;
    this.gltfDoCoelho = g;
    this.montarCasca();
    for (const i of itens) this.moveis.push(await this.montarItem(i));
    await this.montarParede();
    await this.montarBanheiro();
    this.luzinhas();
    if (this.natal) {
      await this.montarTrem();
      this.montarNeve();
    }
    if (this.morta) return;
    this.montarRecado();
    this.montada = true;
    this.arrumarPessoas();
    this.aplicarHora();
    this.renderer.setAnimationLoop(this.desenhar);
  }

  // ---- o que vem de fora ----

  definirNoite(noite: boolean) {
    if (noite === this.noite) return;
    this.noite = noite;
    if (this.montada) this.aplicarHora();
  }

  /** Quem está na call agora (até 12, na ordem da lista). */
  definirPessoas(lista: PessoaNoSalao3D[]) {
    this.listaDePessoas = lista.slice(0, 12);
    if (this.montada) this.arrumarPessoas();
  }

  /** A TV: com alguém transmitindo, o Ao vivo e quem é; sem, o desenho calmo. */
  definirTv(aoVivo: { rotulo: string; nome: string; sub: string } | null) {
    this.tvAgora = aoVivo;
    if (this.telaDaTv) this.pintarTv();
  }
  private tvAgora: { rotulo: string; nome: string; sub: string } | null = null;

  /** A capa (ou o ícone) da comunidade no quadro. */
  definirImagem(imagem: { url: string; encaixe: string } | null) {
    this.imagemAgora = imagem;
    if (this.quadro) this.pintarQuadro();
  }
  private imagemAgora: { url: string; encaixe: string } | null = null;

  /** O balão do recado aberto: o coelho fala. */
  definirRecadoAberto(aberto: boolean) {
    this.recadoAberto = aberto;
    if (this.recado) this.tocar(this.recado, this.natal ? 'poltrona' : aberto ? 'falando' : 'parado');
  }

  usarFuncao(id: string) {
    if (id === 'banheiro') this.abrirPorta('banheiro');
    else if (id === 'sair-do-banheiro') this.abrirPorta('salao');
    else this.opcoes.aoFuncao(id);
  }

  /** Abre a porta do cômodo em que a câmera está e passa para o outro (com "menos movimento", passa na hora). */
  private abrirPorta(ir: VistaDoSalao3D) {
    if (ir === this.vista || this.abrindo) return;
    const porta = this.clicaveis.find((c) => c.userData.funcao === (ir === 'banheiro' ? 'banheiro' : 'sair-do-banheiro'));
    if (!porta || this.calmo) return this.mostrar(ir);
    this.abrindo = { porta: porta.userData.folha as THREE.Object3D, desde: this.t, ir };
    this.ultimoQuadro = 0;
  }

  /** A câmera no salão ou no banheiro. */
  private mostrar(vista: VistaDoSalao3D) {
    this.vista = vista;
    this.realcar(null);
    // os coelhos não passam pelo corte da câmera (o esqueleto mexe, e o three.js os desenha sempre): fora do salão, escondidos
    this.coelhosVisiveis();
    this.opcoes.aoPassar(null);
    this.enquadrar();
    this.medir();
    this.opcoes.aoMudarVista(vista);
  }

  private coelhosVisiveis() {
    const ver = this.vista === 'salao';
    if (this.recado) this.recado.raiz.visible = ver;
    for (const c of this.pessoas.values()) c.raiz.visible = ver;
  }

  /** A câmera e o sol olhando para o cômodo da vista: o salão inteiro, ou o banheiro sozinho. */
  private enquadrar() {
    const centro =
      this.vista === 'salao'
        ? new THREE.Vector3(N / 2 - 0.2, 1.0, N / 2 - 0.2)
        : new THREE.Vector3(B.origem + B.largura / 2, 1.0, B.fundo / 2);
    this.camera.position.copy(centro).add(new THREE.Vector3(14, 12, 14));
    this.camera.lookAt(centro);
    this.camera.updateMatrixWorld();
    // o sol e a luz de preencher vão junto (a sombra do sol cobre só ±11 em volta do alvo)
    const alvo = this.vista === 'salao' ? new THREE.Vector3(5.5, 0, 5.5) : centro.clone().setY(0);
    this.sol.target.position.copy(alvo);
    this.sol.position.copy(alvo).add(new THREE.Vector3(3.5, 16, 7.5));
    this.sol.target.updateMatrixWorld();
    this.preenche.position.copy(alvo).add(new THREE.Vector3(8.5, 9, 6.5));
    this.ultimoQuadro = 0;
  }

  /** Onde aparece o objeto de uma função, em pixels da caixa ('balcao' é a cabeça do coelho do recado). */
  pontoDaFuncao(id: string): { x: number; y: number } | null {
    if (id === 'balcao' && this.recado)
      return this.naTela(new THREE.Vector3().setFromMatrixPosition(this.recado.raiz.matrixWorld).add(new THREE.Vector3(0, ALTURA_DO_COELHO + 0.15, 0)));
    const o = this.clicaveis.find((c) => c.userData.funcao === id);
    if (!o || (o.userData.vista ?? 'salao') !== this.vista) return null;
    return this.naTela(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));
  }

  /** Os nomes de quem está na call, em pixels da caixa, em cima da cabeça. */
  rotulos(): { id: number; nome: string; x: number; y: number }[] {
    const r: { id: number; nome: string; x: number; y: number }[] = [];
    if (this.vista !== 'salao') return r;
    for (const [id, c] of this.pessoas) {
      c.raiz.updateMatrixWorld();
      const p = this.naTela(new THREE.Vector3().setFromMatrixPosition(c.raiz.matrixWorld).add(new THREE.Vector3(0, ALTURA_DO_COELHO + 0.12, 0)));
      r.push({ id, nome: c.p.nome, ...p });
    }
    return r;
  }

  medida() {
    const i = this.renderer.info.render;
    const ms = this.tempos.length ? this.tempos.reduce((a, b) => a + b, 0) / this.tempos.length : 0;
    return {
      ms,
      chamadas: i.calls,
      triangulos: i.triangles,
      desenhados: this.desenhados,
      natal: this.natal,
      pessoas: [...this.pessoas.values()].map((c) => ({ nome: c.p.nome, anim: c.tocando, roupa: c.p.cores.roupa, x: c.raiz.position.x, z: c.raiz.position.z })),
      recado: this.recado?.tocando,
      trem: this.trem ? this.trem.s : null,
      patinho: this.patinho ? this.patinho.g.position.x : null,
      vista: this.vista,
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
    this.recado?.copia.descartar();
    for (const c of this.pessoas.values()) c.copia.descartar();
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Points).isPoints) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
    });
    for (const d of this.descartaveis) d.dispose();
    if (import.meta.env.DEV) {
      const w = window as unknown as { salao3dDoTeste?: CenaDoSalao3D };
      if (w.salao3dDoTeste === this) delete w.salao3dDoTeste;
    }
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---- a montagem ----

  private naTela(v: THREE.Vector3) {
    const c = v.project(this.camera);
    return { x: ((c.x + 1) / 2) * this.caixa.clientWidth, y: ((1 - c.y) / 2) * this.caixa.clientHeight };
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    const a = w / h;
    // o salão inteiro (o chão e as duas paredes) na caixa 4:3 do início da comunidade; o banheiro, de mais perto
    const [k, l, sobe] = this.vista === 'salao' ? [6.1, 8.4, 0.2] : [3.25, 3.4, 0.45];
    const meia = Math.max(k, l / a);
    Object.assign(this.camera, { left: -meia * a, right: meia * a, top: meia + sobe, bottom: -meia + sobe });
    this.camera.updateProjectionMatrix();
    this.ultimoQuadro = 0;
    if (this.montada) this.opcoes.aoMudarRotulos();
  }

  private textura(desenhar: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = w, repetir: [number, number] = [1, 1]) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    desenhar(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repetir);
    t.anisotropy = 8;
    this.descartaveis.push(t);
    return t;
  }

  private caixaGeo(w: number, h: number, d: number) {
    const g = new THREE.BoxGeometry(w, h, d);
    this.descartaveis.push(g);
    return g;
  }

  /** O chão de tábuas e as duas paredes de tijolo (como as do salão de pixel art), com o rodapé. */
  private montarCasca() {
    const tabuas = this.textura(
      (g, L) => {
        const cores = ['#8f5f3f', '#9a6845', '#86583a', '#a06f4a'];
        const n = 8;
        for (let i = 0; i < n; i++) {
          g.fillStyle = cores[i % cores.length];
          g.fillRect(0, (i * L) / n, L, L / n);
          g.fillStyle = 'rgba(50,28,18,0.4)';
          g.fillRect(0, ((i + 1) * L) / n - 3, L, 3);
          const corte = ((i * 197) % 5) * (L / 5);
          g.fillRect(corte, (i * L) / n, 3, L / n);
        }
      },
      512,
      512,
      [3, 3],
    );
    const chao = new THREE.Mesh(this.caixaGeo(N, 0.2, N), new THREE.MeshStandardMaterial({ map: tabuas, roughness: 0.85 }));
    chao.position.set(N / 2, -0.1, N / 2);
    chao.receiveShadow = true;
    this.cena.add(chao);
    const tijolo = (repetir: [number, number]) =>
      this.textura(
        (g, L) => {
          g.fillStyle = '#6e3f31';
          g.fillRect(0, 0, L, L);
          const fiadas = 8;
          const alto = L / fiadas;
          const tons = ['#9b5442', '#a35d48', '#8f4c3c', '#a8634c', '#94503f'];
          for (let f = 0; f < fiadas; f++) {
            const desloca = f % 2 ? alto : 0;
            for (let x = -alto * 2; x < L; x += alto * 2) {
              g.fillStyle = tons[(f * 7 + Math.round(x / alto)) % tons.length];
              g.fillRect(x + desloca + 3, f * alto + 3, alto * 2 - 6, alto - 6);
            }
          }
        },
        256,
        256,
        repetir,
      );
    const alturaTex = ALTURA_DA_PAREDE / 1.7;
    const fundo = new THREE.Mesh(
      this.caixaGeo(N + 0.3, ALTURA_DA_PAREDE, 0.3),
      new THREE.MeshStandardMaterial({ map: tijolo([N / 1.7, alturaTex]), roughness: 0.95 }),
    );
    fundo.position.set(N / 2 - 0.15, ALTURA_DA_PAREDE / 2, -0.15);
    const esquerda = new THREE.Mesh(
      this.caixaGeo(0.3, ALTURA_DA_PAREDE, N),
      new THREE.MeshStandardMaterial({ map: tijolo([N / 1.7, alturaTex]), roughness: 0.95 }),
    );
    esquerda.position.set(-0.15, ALTURA_DA_PAREDE / 2, N / 2);
    for (const p of [fundo, esquerda]) {
      p.receiveShadow = true;
      this.cena.add(p);
    }
    const madeira = new THREE.MeshStandardMaterial({ color: '#5e3a27', roughness: 0.8 });
    const r1 = new THREE.Mesh(this.caixaGeo(N, 0.16, 0.06), madeira);
    r1.position.set(N / 2, 0.08, 0.03);
    const r2 = new THREE.Mesh(this.caixaGeo(0.06, 0.16, N), madeira);
    r2.position.set(0.03, 0.08, N / 2);
    this.cena.add(r1, r2);
  }

  /** Uma cópia com materiais próprios (para realçar só esta). No Kenney, as cores viram as do KayKit. */
  private copia(g: GLTF, nome: string, cores: Record<string, string> = {}) {
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
      }
      // as luzinhas do Holiday Bits (a árvore, o poste): um material à parte, que acende e pisca
      if (mat.name === 'holiday_glow') {
        mat.emissive.set('#ffe2a0');
        mat.emissiveMap = mat.map;
        this.brilhos.push(mat);
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

  private async montarItem(i: Item): Promise<Pronto> {
    let g: THREE.Group;
    let tam: THREE.Vector3;
    if (i.arquivo.startsWith('@')) {
      g = await this.feitoAqui(i.arquivo);
      tam = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    } else ({ g, tam } = await this.peca(i.arquivo, i.cores, i.escala));
    const raiz = new THREE.Group().add(g);
    raiz.position.set(i.x, i.y ?? 0, i.z);
    raiz.rotation.y = i.giro ?? 0;
    if (i.id === 'tv') {
      // em cima do rack
      const rack = this.moveis.find((m) => m.item.id === 'rack');
      if (rack) raiz.position.y = rack.tam.y;
      this.telaNaTv(g, tam);
    }
    if (i.funcao) {
      raiz.userData.funcao = i.funcao;
      this.clicaveis.push(raiz);
    }
    if (i.id === 'arvore') {
      this.luzDaArvore = new THREE.PointLight('#ffc477', 0, 6, 1.4);
      this.luzDaArvore.position.set(0, tam.y * 0.45, 0);
      raiz.add(this.luzDaArvore);
    }
    if (i.arquivo === 'q:lamp_standing' || i.arquivo === 'n:lantern_decorated') {
      const l = new THREE.PointLight('#ffcf8a', 0, 6, 1.5);
      l.position.set(0, tam.y - 0.2, 0);
      raiz.add(l);
      this.luzes.push(l);
    }
    this.cena.add(raiz);
    return { item: i, raiz, tam };
  }

  /** A tela da TV por cima do vidro do modelo: o Ao vivo, ou o desenho calmo. */
  private telaNaTv(g: THREE.Group, tam: THREE.Vector3) {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 192;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.descartaveis.push(tex);
    this.telaDaTv = { tex, c };
    const geo = new THREE.PlaneGeometry(tam.x * 0.9, tam.x * 0.9 * (c.height / c.width));
    this.descartaveis.push(geo);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.set(0, tam.y * 0.6, tam.z / 2 + 0.012);
    g.add(m);
    this.pintarTv();
  }

  private pintarTv() {
    const t = this.telaDaTv!;
    const g = t.c.getContext('2d')!;
    const { width: w, height: h } = t.c;
    if (this.tvAgora) {
      g.fillStyle = '#141019';
      g.fillRect(0, 0, w, h);
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(120,90,200,0.35)');
      grad.addColorStop(1, 'rgba(230,110,90,0.25)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.font = 'bold 22px system-ui, sans-serif';
      g.fillStyle = '#d9463b';
      g.beginPath();
      g.roundRect(14, 16, 34 + g.measureText('● ' + this.tvAgora.rotulo).width, 36, 10);
      g.fill();
      g.fillStyle = '#fff';
      g.textBaseline = 'middle';
      g.fillText('● ' + this.tvAgora.rotulo, 26, 34);
      g.font = 'bold 30px system-ui, sans-serif';
      g.fillText(cortar(g, this.tvAgora.nome, w - 40), 20, h - 70);
      g.font = '20px system-ui, sans-serif';
      g.fillStyle = '#d8d0e8';
      g.fillText(cortar(g, this.tvAgora.sub, w - 40), 20, h - 34);
    } else {
      // o desenho calmo: o céu, o sol e os morros (a TV à toa, como a do salão de pixel art)
      const ceu = g.createLinearGradient(0, 0, 0, h);
      ceu.addColorStop(0, '#7fb6e0');
      ceu.addColorStop(1, '#f3d9a8');
      g.fillStyle = ceu;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe08a';
      g.beginPath();
      g.arc(w * 0.72, h * 0.35, 26, 0, PI * 2);
      g.fill();
      for (const [cor, y, a] of [
        ['#7fb36a', 0.72, 0.5],
        ['#5f9a58', 0.82, 0.62],
      ] as const) {
        g.fillStyle = cor;
        g.beginPath();
        g.ellipse(w * a, h * (y + 0.25), w * 0.6, h * 0.35, 0, PI, 0);
        g.fill();
      }
    }
    t.tex.needsUpdate = true;
    this.ultimoQuadro = 0;
  }

  /** As peças que nenhum pacote tem: o balcão do bar (Kenney, em fileira), o fliperama, a jukebox e o microfone. */
  private async feitoAqui(qual: string): Promise<THREE.Group> {
    const g = new THREE.Group();
    const mat = (cor: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75, ...extra });
    const bloco = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(this.caixaGeo(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      return b;
    };
    if (qual === '@balcao') {
      // quatro módulos de bar do Kenney lado a lado e as pontas
      const { g: m1, tam } = await this.peca('k:kitchenBar');
      const n = 4;
      for (let i = 0; i < n; i++) {
        const m = i ? (await this.peca('k:kitchenBar')).g : m1;
        m.position.x = (i - (n - 1) / 2) * tam.x;
        g.add(m);
      }
      for (const lado of [-1, 1]) {
        const { g: ponta, tam: tp } = await this.peca('k:kitchenBarEnd');
        ponta.position.x = lado * ((n / 2) * tam.x + tp.x / 2);
        g.add(ponta);
      }
    } else if (qual === '@fliperama') {
      // o gabinete de fliperama: a caixa, o painel inclinado com os botões e a tela acesa
      const roxo = mat('#5b3f8c');
      const escuro = mat('#2b2238');
      bloco(0.82, 1.55, 0.7, roxo, 0, 0.775, 0);
      bloco(0.86, 0.22, 0.74, mat('#e0a23e'), 0, 1.66, 0.0);
      const painel = bloco(0.82, 0.08, 0.36, escuro, 0, 0.98, 0.42);
      painel.rotation.x = 0.35;
      for (const [x, cor] of [
        [-0.18, '#d9463b'],
        [0.05, '#4fb0d9'],
        [0.2, '#f2c94c'],
      ] as const) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10), mat(cor));
        this.descartaveis.push(b.geometry);
        b.position.set(x, 1.04, 0.43);
        g.add(b);
      }
      const tela = this.textura((c, w, h) => {
        c.fillStyle = '#10131f';
        c.fillRect(0, 0, w, h);
        const cores = ['#f2c94c', '#4fb0d9', '#d9463b', '#7ed37e'];
        for (let i = 0; i < 26; i++) {
          c.fillStyle = cores[i % cores.length];
          c.fillRect(((i * 37) % 14) * 9 + 4, ((i * 53) % 10) * 9 + 6, 7, 7);
        }
        c.fillStyle = '#fff';
        c.fillRect(56, 98, 18, 8);
      }, 128);
      tela.wrapS = tela.wrapT = THREE.ClampToEdgeWrapping;
      const vidro = new THREE.Mesh(this.caixaGeo(0.62, 0.48, 0.02), new THREE.MeshBasicMaterial({ map: tela, toneMapped: false }));
      vidro.position.set(0, 1.3, 0.355);
      g.add(vidro);
    } else if (qual === '@jukebox') {
      const madeira = mat('#8a4b2b');
      bloco(0.8, 1.05, 0.55, madeira, 0, 0.525, 0);
      // o alto arredondado: meio cilindro deitado (o eixo em z), a metade de cima
      const arco = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.55, 20, 1, false, PI / 2, PI), madeira);
      this.descartaveis.push(arco.geometry);
      arco.rotation.x = PI / 2;
      arco.position.set(0, 1.05, 0);
      arco.castShadow = true;
      g.add(arco);
      const luz = mat('#ffb347', { emissive: '#ff9a3c', emissiveIntensity: 0.6 });
      this.lampadinhas.push(luz);
      bloco(0.6, 0.5, 0.04, mat('#3b2a40'), 0, 0.6, 0.28);
      bloco(0.08, 0.95, 0.06, luz, -0.34, 0.6, 0.27);
      bloco(0.08, 0.95, 0.06, luz, 0.34, 0.6, 0.27);
    } else if (qual === '@microfone') {
      const metal = mat('#3a3a42', { roughness: 0.4, metalness: 0.4 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 16), metal);
      const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8), metal);
      const mic = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat('#9aa0a8', { roughness: 0.5 }));
      this.descartaveis.push(base.geometry, haste.geometry, mic.geometry);
      base.position.y = 0.02;
      haste.position.y = 0.645;
      mic.position.y = 1.32;
      for (const m of [base, haste, mic]) {
        m.castShadow = true;
        g.add(m);
      }
    }
    return g;
  }

  /** O quadro (a capa da comunidade), o troféu na prateleira, a janela, a porta e o que é da época. */
  private async montarParede() {
    const naParede = (o: THREE.Object3D, parede: 'fundo' | 'esquerda', u: number, y: number) => {
      const q = new THREE.Group().add(o);
      if (parede === 'fundo') q.position.set(u, y, 0.01);
      else {
        q.rotation.y = PI / 2;
        q.position.set(0.01, y, u);
      }
      this.cena.add(q);
      return q;
    };
    for (const d of NA_PAREDE) {
      if (!this.vale(d)) continue;
      let o: THREE.Object3D;
      if (d.arquivo === '@trofeu') o = await this.prateleiraComTrofeu();
      else {
        o = this.copia(await modelo(d.arquivo), d.arquivo);
        o.scale.setScalar(S * (d.escala ?? 1));
        if (d.arquivo === 'q:pictureframe_large_B') o = this.comCapa(o);
      }
      const q = naParede(o, d.parede, d.u, d.y);
      if (d.funcao) {
        q.userData.funcao = d.funcao;
        this.clicaveis.push(q);
      }
    }
    // a janela: o caixilho de madeira e o lado de fora (o céu da hora; no Natal, com neve no peitoril)
    const j = new THREE.Group();
    this.fora = new THREE.MeshBasicMaterial({ color: '#a8dcf5' });
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(JANELA.w, JANELA.h), this.fora);
    this.descartaveis.push(vidro.geometry);
    vidro.position.z = 0.02;
    j.add(vidro);
    const madeira = new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 0.8 });
    const ripa = (w: number, h: number, x: number, y: number, d = 0.1) => {
      const r = new THREE.Mesh(this.caixaGeo(w, h, d), madeira);
      r.position.set(x, y, d / 2);
      r.castShadow = true;
      j.add(r);
    };
    ripa(JANELA.w + 0.16, 0.1, 0, JANELA.h / 2);
    ripa(JANELA.w + 0.3, 0.12, 0, -JANELA.h / 2, 0.22);
    ripa(0.1, JANELA.h, -JANELA.w / 2, 0);
    ripa(0.1, JANELA.h, JANELA.w / 2, 0);
    ripa(0.05, JANELA.h, 0, 0, 0.06);
    ripa(JANELA.w, 0.05, 0, 0, 0.06);
    if (this.natal) {
      const neve = new THREE.Mesh(this.caixaGeo(JANELA.w + 0.3, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: '#f4f7fb', roughness: 0.9 }));
      neve.position.set(0, -JANELA.h / 2 + 0.09, 0.11);
      j.add(neve);
    }
    naParede(j, 'fundo', JANELA.u, JANELA.y);
    const porta = this.copia(await modelo('r:door_A'), 'r:door_A');
    porta.scale.setScalar(S);
    const p = new THREE.Group().add(porta);
    p.rotation.y = PI / 2;
    p.position.set(0.17, 0, PORTA_U + 0.6);
    this.cena.add(p);
  }

  /** A imagem da comunidade dentro da moldura (o plano por cima do quadro do KayKit). */
  private comCapa(moldura: THREE.Object3D) {
    const g = new THREE.Group().add(moldura);
    const geo = new THREE.PlaneGeometry(2 * S * 0.86, 1.2 * S * 0.8);
    this.descartaveis.push(geo);
    this.quadro = new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 0.9 });
    const m = new THREE.Mesh(geo, this.quadro);
    m.position.set(0, 0, 0.2 * S + 0.004);
    g.add(m);
    this.pintarQuadro();
    return g;
  }

  private pintarQuadro() {
    const q = this.quadro!;
    const img = this.imagemAgora;
    const padrao = () => {
      q.map = this.textura(
        (c, w, h) => {
          const grad = c.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#f2c27a');
          grad.addColorStop(1, '#c9714f');
          c.fillStyle = grad;
          c.fillRect(0, 0, w, h);
          c.fillStyle = 'rgba(255,248,230,0.85)';
          for (const [x, y] of [
            [0.35, 0.55],
            [0.62, 0.48],
          ])
            for (const [dx, dy, r] of [
              [-0.05, -0.2, 0.05],
              [0.05, -0.2, 0.05],
              [0, 0, 0.13],
            ]) {
              c.beginPath();
              c.ellipse((x + dx) * w, (y + dy) * h, r * w * 0.6, (r + (dy ? 0.12 : 0)) * h * 0.6, 0, 0, PI * 2);
              c.fill();
            }
        },
        256,
        160,
      );
      q.color.set('#ffffff');
      q.needsUpdate = true;
      this.ultimoQuadro = 0;
    };
    if (!img) return padrao();
    new THREE.TextureLoader()
      .setCrossOrigin('anonymous')
      .loadAsync(img.url)
      .then((t) => {
        if (this.morta) return t.dispose();
        t.colorSpace = THREE.SRGBColorSpace;
        const im = t.image as { width: number; height: number };
        const alvo = 0.86 / 0.8 / (1.2 / 2);
        const prop = im.width / im.height;
        // a capa ENCHE o quadro (corta as sobras); o ícone fica inteiro no meio, sobre o fundo claro
        if (img.encaixe === 'cobrir') {
          if (prop > alvo) {
            t.repeat.set(alvo / prop, 1);
            t.offset.set((1 - alvo / prop) / 2, 0);
          } else {
            t.repeat.set(1, prop / alvo);
            t.offset.set(0, (1 - prop / alvo) / 2);
          }
        } else {
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
          const k = 1.25;
          t.repeat.set((alvo / prop) * k, k);
          t.offset.set(-(t.repeat.x - 1) / 2, -(t.repeat.y - 1) / 2);
        }
        this.descartaveis.push(t);
        q.map = t;
        q.color.set('#ffffff');
        q.needsUpdate = true;
        this.ultimoQuadro = 0;
      })
      .catch(padrao);
  }

  /** A prateleira (Furniture Bits) com o troféu dourado feito por código: as Conquistas da turma. */
  private async prateleiraComTrofeu() {
    const g = new THREE.Group();
    const prat = this.copia(await modelo('q:shelf_A_big'), 'q:shelf_A_big');
    prat.scale.setScalar(S);
    g.add(prat);
    const ouro = new THREE.MeshStandardMaterial({ color: '#e2b53e', roughness: 0.35, metalness: 0.3 });
    const base = new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 0.8 });
    const taca = new THREE.Group();
    const partes: [THREE.BufferGeometry, THREE.Material, number][] = [
      [new THREE.BoxGeometry(0.22, 0.08, 0.22), base, 0.04],
      [new THREE.CylinderGeometry(0.028, 0.045, 0.14, 10), ouro, 0.15],
      [new THREE.CylinderGeometry(0.13, 0.045, 0.19, 14), ouro, 0.31],
    ];
    for (const [geo, m, y] of partes) {
      this.descartaveis.push(geo);
      const p = new THREE.Mesh(geo, m);
      p.position.y = y;
      p.castShadow = true;
      taca.add(p);
    }
    const alca = new THREE.TorusGeometry(0.06, 0.014, 6, 12, PI);
    this.descartaveis.push(alca);
    for (const lado of [-1, 1]) {
      const a = new THREE.Mesh(alca, ouro);
      a.position.set(lado * 0.13, 0.33, 0);
      a.rotation.z = lado > 0 ? -PI / 2 : PI / 2;
      taca.add(a);
    }
    taca.position.set(0, 0.1 * S, 0.22);
    g.add(taca);
    // e dois troféus menores (a turma tem mais de um), em prata e bronze
    for (const [x, cor, k] of [
      [-0.45, '#c9ccd4', 0.75],
      [0.45, '#c98a4b', 0.65],
    ] as const) {
      const t2 = taca.clone();
      t2.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material === ouro) m.material = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.35, metalness: 0.3 });
      });
      t2.scale.setScalar(k);
      t2.position.x = x;
      g.add(t2);
    }
    return g;
  }

  /**
   * Uma porta do banheiro numa parede da esquerda (x = 0 de quem a recebe), de `z` para trás: a folha do Tiny Treats, a
   * moldura, o vão atrás dela (a cor do outro cômodo: o verde-água do banheiro, as tábuas do salão) e a plaquinha do patinho em cima, sem texto.
   * `userData.folha` é o que gira ao abrir.
   */
  private async portaDoBanheiro(pai: THREE.Object3D, z: number, funcao: string, vista: VistaDoSalao3D, corDoVao: string) {
    const { largura: w, altura: h } = PORTA_DO_BANHEIRO;
    const raiz = new THREE.Group();
    raiz.rotation.y = PI / 2;
    raiz.position.set(0, 0, z);
    // a dobradiça no lado mais perto do fundo (a folha espelhada): aberta, ela fica de quina para a câmera e mostra o vão
    const porta = this.copia(await modelo('b:door_modular'), 'b:door_modular');
    porta.scale.set(-S, S, S);
    const folha = new THREE.Group().add(porta);
    folha.position.set(w, 0, 0.02);
    raiz.add(folha);
    const moldura = new THREE.MeshStandardMaterial({ color: '#efe3cc', roughness: 0.8 });
    const ripa = (lw: number, lh: number, x: number, y: number) => {
      const r = new THREE.Mesh(this.caixaGeo(lw, lh, 0.1), moldura);
      r.position.set(x, y, 0.05);
      r.castShadow = r.receiveShadow = true;
      raiz.add(r);
    };
    ripa(0.1, h + 0.1, -0.05, (h + 0.1) / 2);
    ripa(0.1, h + 0.1, w + 0.05, (h + 0.1) / 2);
    ripa(w + 0.2, 0.1, w / 2, h + 0.05);
    const vao = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: corDoVao }));
    this.descartaveis.push(vao.geometry);
    vao.position.set(w / 2, h / 2, 0.03);
    raiz.add(vao);
    // a plaquinha: o patinho amarelo e as bolhas, pintados (quem lê qualquer língua entende)
    const placa = this.textura(
      (g, W, H) => {
        const bola = (x: number, y: number, rx: number, ry = rx) => {
          g.beginPath();
          g.ellipse(x * W, y * H, rx * W, ry * W, 0, 0, PI * 2);
          g.fill();
        };
        g.fillStyle = '#7a5236';
        g.beginPath();
        g.roundRect(0, 0, W, H, 22);
        g.fill();
        g.fillStyle = '#fbf3df';
        g.beginPath();
        g.roundRect(9, 9, W - 18, H - 18, 16);
        g.fill();
        g.fillStyle = '#9fd3c7';
        bola(0.2, 0.32, 0.07);
        bola(0.31, 0.2, 0.045);
        bola(0.84, 0.3, 0.055);
        g.fillStyle = '#f2c94c';
        bola(0.47, 0.68, 0.23, 0.11);
        bola(0.62, 0.42, 0.11);
        g.fillStyle = '#e8873a';
        bola(0.74, 0.45, 0.06, 0.025);
        g.fillStyle = '#3a2a22';
        bola(0.64, 0.38, 0.02);
      },
      256,
      180,
    );
    placa.wrapS = placa.wrapT = THREE.ClampToEdgeWrapping;
    const plaquinha = new THREE.Mesh(this.caixaGeo(0.46, 0.32, 0.03), new THREE.MeshStandardMaterial({ map: placa, roughness: 0.8 }));
    plaquinha.position.set(w / 2, h + 0.36, 0.03);
    raiz.add(plaquinha);
    raiz.userData = { funcao, folha, vista };
    this.clicaveis.push(raiz);
    pai.add(raiz);
  }

  /**
   * O banheiro (BANHEIRO, lá em cima), longe do salão: a base, as paredes do fundo de azulejo, as muretas da frente, as peças numa
   * malha só, o patinho e a porta de dentro. E a porta do lado do salão.
   */
  private async montarBanheiro() {
    await this.portaDoBanheiro(this.cena, PORTA_DO_BANHEIRO.z, 'banheiro', 'salao', '#9fd3c7');
    const { largura: L, fundo: P, espessura: E, mureta: H, piso, parede: W } = BANHEIRO;
    const sala = new THREE.Group();
    sala.position.x = B.origem;
    this.cena.add(sala);
    // a base (como a laje do salão) e as duas paredes do fundo, por fora; por dentro, os azulejos e a pintura (mais abaixo)
    const fora = new THREE.MeshStandardMaterial({ color: '#e6d6b8', roughness: 0.9 });
    const bloco = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(this.caixaGeo(w, h, d), fora);
      b.position.set(x, y, z);
      b.receiveShadow = true;
      sala.add(b);
    };
    bloco(L + E + W, 0.2, P + E + W, (L + E - W) / 2, -0.1, (P + E - W) / 2);
    bloco(L + E + W, ALTURA_DA_PAREDE, W, (L + E - W) / 2, ALTURA_DA_PAREDE / 2, -W / 2);
    bloco(W, ALTURA_DA_PAREDE, P + E, -W / 2, ALTURA_DA_PAREDE / 2, (P + E) / 2);
    // o piso de ladrilho verde-água do pacote (3 × 3 placas, esticadas um tanto para cobrir o banheiro)
    const pecas: { nome: string; o: THREE.Object3D }[] = [];
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3; k++) {
        const o = (await modelo('b:floor_tiled')).scene.clone(true);
        o.scale.set(L / 3 / 2, 0.2, P / 3 / 2);
        o.position.set((L / 3) * (i + 0.5), piso, (P / 3) * (k + 0.5));
        pecas.push({ nome: 'b:floor_tiled', o });
      }
    for (const d of PECAS_DO_BANHEIRO) {
      const o = (await modelo(d.arquivo)).scene.clone(true);
      o.scale.setScalar(S * (d.escala ?? 1));
      const g = new THREE.Group().add(o);
      if (!d.parede) {
        const caixa = new THREE.Box3().setFromObject(o);
        const c = caixa.getCenter(new THREE.Vector3());
        o.position.set(-c.x, -caixa.min.y, -c.z);
      }
      g.position.set(d.x, (d.y ?? 0) + piso, d.z);
      g.rotation.y = d.giro ?? 0;
      pecas.push({ nome: d.arquivo, o: g });
    }
    // tudo numa malha só: as peças usam o mesmo material (a textura de paleta do pacote)
    let material: THREE.MeshStandardMaterial | null = null;
    const geos: THREE.BufferGeometry[] = [];
    for (const { o } of pecas) {
      o.updateMatrixWorld(true);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        if (!m.isMesh) return;
        material ??= (m.material as THREE.MeshStandardMaterial).clone();
        geos.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
      });
    }
    const junta = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!junta || !material) throw new Error('o banheiro não juntou');
    this.descartaveis.push(junta);
    const mat = material as THREE.MeshStandardMaterial;
    mat.roughness = 0.75;
    const banheiro = new THREE.Mesh(junta, mat);
    banheiro.castShadow = banheiro.receiveShadow = true;
    sala.add(banheiro);
    // o patinho, boiando na espuma da banheira (anda no laço, devagar)
    const banheira = PECAS_DO_BANHEIRO.find((p) => p.arquivo === 'b:bath')!;
    const pato = this.copia(await modelo('b:ducky'), 'b:ducky');
    pato.scale.setScalar(S * 0.9);
    const caixaDoPato = new THREE.Box3().setFromObject(pato);
    const centro = caixaDoPato.getCenter(new THREE.Vector3());
    pato.position.set(-centro.x, -caixaDoPato.min.y, -centro.z);
    this.patinho = { g: new THREE.Group().add(pato), x: banheira.x + 0.35, y: piso + 0.62, z: banheira.z - 0.05 };
    this.patinho.g.position.set(this.patinho.x, this.patinho.y, this.patinho.z);
    this.patinho.g.rotation.y = 0.6;
    sala.add(this.patinho.g);

    // os azulejos por dentro das paredes do fundo (brancos até 1,5, a pintura em cima) e as muretas da frente (o corte da casa de boneca)
    const lado = 0.3;
    const azulejo = this.textura(
      (g, T) => {
        g.fillStyle = '#cfd8d6';
        g.fillRect(0, 0, T, T);
        const n = 4;
        const t = T / n;
        for (let i = 0; i < n; i++)
          for (let k = 0; k < n; k++) {
            const grad = g.createLinearGradient(i * t, k * t, (i + 1) * t, (k + 1) * t);
            grad.addColorStop(0, '#fbfaf5');
            grad.addColorStop(1, '#e9ebe6');
            g.fillStyle = grad;
            g.fillRect(i * t + 3, k * t + 3, t - 6, t - 6);
          }
      },
      256,
    );
    const azul = (w: number, h: number) => {
      const t = azulejo.clone();
      t.repeat.set(w / (lado * 4), h / (lado * 4));
      this.descartaveis.push(t);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
    };
    const pintura = new THREE.MeshStandardMaterial({ color: '#f0d48c', roughness: 0.9 });
    const tampo = new THREE.MeshStandardMaterial({ color: '#e7ecec', roughness: 0.6 });
    const BAIXO = 1.5;
    const placa = (w: number, h: number, m: THREE.Material, x: number, y: number, z: number, giro: number) => {
      const p = new THREE.Mesh(this.caixaGeo(w, h, 0.02), m);
      p.position.set(x, y, z);
      p.rotation.y = giro;
      p.receiveShadow = true;
      sala.add(p);
    };
    placa(L, BAIXO, azul(L, BAIXO), L / 2, BAIXO / 2, 0.011, 0);
    placa(L, ALTURA_DA_PAREDE - BAIXO, pintura, L / 2, (ALTURA_DA_PAREDE + BAIXO) / 2, 0.011, 0);
    placa(P, BAIXO, azul(P, BAIXO), 0.011, BAIXO / 2, P / 2, PI / 2);
    placa(P, ALTURA_DA_PAREDE - BAIXO, pintura, 0.011, (ALTURA_DA_PAREDE + BAIXO) / 2, P / 2, PI / 2);
    const mureta = (w: number, x: number, z: number, giro: number) => {
      // um material só (uma chamada): as pontas, estreitas, levam o mesmo azulejo, e o tampo cobre o alto
      const m = new THREE.Mesh(this.caixaGeo(w, H, E), azul(w, H));
      m.position.set(x, H / 2, z);
      m.rotation.y = giro;
      m.castShadow = m.receiveShadow = true;
      sala.add(m);
      const t = new THREE.Mesh(this.caixaGeo(w + 0.04, 0.05, E + 0.06), tampo);
      t.position.set(x, H + 0.025, z);
      t.rotation.y = giro;
      t.castShadow = true;
      sala.add(t);
    };
    mureta(P + E, L + E / 2, (P + E) / 2, PI / 2);
    mureta(L, L / 2, P + E / 2, 0);
    // a porta de dentro, na parede da esquerda, perto da frente: por ela se volta ao salão
    await this.portaDoBanheiro(sala, P - 0.2, 'sair-do-banheiro', 'banheiro', '#a06f4a');
    // de noite, a vela da prateleira acende uma luz morna no banheiro
    const vela = new THREE.PointLight('#ffc27a', 0, 4.5, 1.6);
    vela.position.set(2.3, 2.6, 0.55);
    sala.add(vela);
    this.luzes.push(vela);
  }

  /** O patinho boia: sobe e desce um tico e gira devagar (com "menos movimento" ou sem foco, para; o laço nem desenha). */
  private boiarPatinho() {
    const p = this.patinho!;
    p.g.position.y = p.y + Math.sin(this.t * 1.7) * 0.018;
    p.g.position.x = p.x + Math.sin(this.t * 0.35) * 0.22;
    p.g.position.z = p.z + Math.sin(this.t * 0.5) * 0.12;
    p.g.rotation.y = 0.6 + Math.sin(this.t * 0.3) * 0.5;
    p.g.rotation.z = Math.sin(this.t * 1.7 + 0.8) * 0.06;
  }

  /** As luzinhas do alto das duas paredes (como as do salão de pixel art). */
  private luzinhas() {
    const fio = new THREE.LineBasicMaterial({ color: '#3a2a22' });
    this.descartaveis.push(fio);
    const tons = (this.natal ? ['#ff6b5a', '#7ed37e', '#ffd166', '#6fb7ff'] : ['#ffcf7a', '#ffb070', '#ffe3a8']).map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 });
      this.lampadinhas.push(m);
      return m;
    });
    const bolinha = new THREE.SphereGeometry(0.05, 8, 6);
    this.descartaveis.push(bolinha);
    const Y = ALTURA_DA_PAREDE - 0.3;
    for (const parede of ['fundo', 'esquerda'] as const) {
      const ponto = (u: number) => {
        const f = (u / N) * 4;
        const y = Y - Math.sin(PI * (f - Math.floor(f))) * 0.22;
        return parede === 'fundo' ? new THREE.Vector3(u, y, 0.07) : new THREE.Vector3(0.07, y, u);
      };
      const pontos: THREE.Vector3[] = [];
      for (let u = 0.15; u <= N - 0.05; u += 0.05) pontos.push(ponto(u));
      const geo = new THREE.BufferGeometry().setFromPoints(pontos);
      this.descartaveis.push(geo);
      this.cena.add(new THREE.Line(geo, fio));
      const porTom: THREE.Vector3[][] = tons.map(() => []);
      let i = 0;
      for (let u = 0.35; u < N - 0.1; u += 0.42) porTom[i++ % tons.length].push(ponto(u).add(new THREE.Vector3(0, -0.06, 0)));
      porTom.forEach((lugares, t) => {
        const inst = new THREE.InstancedMesh(bolinha, tons[t], lugares.length);
        lugares.forEach((p, k) => inst.setMatrixAt(k, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
        this.cena.add(inst);
      });
      const l = new THREE.PointLight('#ffc37a', 0, 7, 1.5);
      l.position.copy(ponto(N * 0.5)).add(parede === 'fundo' ? new THREE.Vector3(0, -0.3, 0.8) : new THREE.Vector3(0.8, -0.3, 0));
      this.cena.add(l);
      this.luzes.push(l);
    }
  }

  /**
   * O TRENZINHO em volta da árvore: um oval de trilhos do Holiday Bits (quatro curvas de 90° e duas retas de cada lado) e a
   * locomotiva com três vagões, andando pelo meio do trilho (as contas do oval abaixo, as mesmas que puseram as peças).
   */
  private async montarTrem() {
    const [cx, cz] = CENTRO_DA_ARVORE;
    const R = 2 * S; // o meio da curva do pacote tem raio 2
    const passo = 1 * S; // a reta do pacote tem 1 de comprimento
    const L = 2 * passo;
    const trilhos = new THREE.Group();
    const curvas: [number, number][] = [
      [cz + L / 2, 0],
      [cz + L / 2, -PI / 2],
      [cz - L / 2, PI / 2],
      [cz - L / 2, PI],
    ];
    for (const [z, giro] of curvas) {
      const o = this.copia(await modelo('n:tracks_curve'), 'n:tracks_curve');
      o.scale.setScalar(S);
      o.rotation.y = giro;
      o.position.set(cx, 0, z);
      trilhos.add(o);
    }
    for (const lado of [-1, 1])
      for (let i = 0; i < 2; i++) {
        const o = this.copia(await modelo('n:tracks_straight'), 'n:tracks_straight');
        o.scale.setScalar(S);
        o.position.set(cx + lado * R, 0, cz - L / 2 + passo / 2 + i * passo);
        trilhos.add(o);
      }
    trilhos.traverse((o) => (o.castShadow = false));
    this.cena.add(trilhos);
    const perimetro = 2 * L + 2 * PI * R;
    // o ponto do meio do trilho a s do começo (a reta da direita, subindo em z), e o rumo do trem ali
    const ponto = (s0: number) => {
      let s = ((s0 % perimetro) + perimetro) % perimetro;
      if (s < L) return { x: cx + R, z: cz - L / 2 + s, giro: 0 };
      s -= L;
      if (s < PI * R) {
        const a = s / R;
        return { x: cx + R * Math.cos(a), z: cz + L / 2 + R * Math.sin(a), giro: Math.atan2(-Math.sin(a), Math.cos(a)) };
      }
      s -= PI * R;
      if (s < L) return { x: cx - R, z: cz + L / 2 - s, giro: PI };
      s -= L;
      const a = PI + s / R;
      return { x: cx + R * Math.cos(a), z: cz - L / 2 + R * Math.sin(a), giro: Math.atan2(-Math.sin(a), Math.cos(a)) };
    };
    const carros: THREE.Object3D[] = [];
    for (const nome of ['train_locomotive', 'train_tender_coal', 'train_wagon', 'train_tender_presents_A']) {
      const o = this.copia(await modelo('n:' + nome), 'n:' + nome);
      o.scale.setScalar(S);
      const g = new THREE.Group().add(o);
      g.position.y = 0.05 * S;
      this.cena.add(g);
      carros.push(g);
    }
    this.trem = { carros, s: 0, perimetro, ponto };
    this.andarTrem(0);
  }

  private andarTrem(dt: number) {
    const t = this.trem!;
    t.s = (t.s + dt * 0.55) % t.perimetro;
    const espaco = [0, 0.62, 1.3, 1.98];
    t.carros.forEach((c, i) => {
      const p = t.ponto(t.s - espaco[i]);
      c.position.x = p.x;
      c.position.z = p.z;
      c.rotation.y = p.giro;
    });
  }

  /** A neve leve, só com "Partículas" ligado em Gráficos (e sem "menos movimento"): flocos caindo devagar pelo salão. */
  private montarNeve() {
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * N;
      pos[i * 3 + 1] = Math.random() * ALTURA_DA_PAREDE;
      pos[i * 3 + 2] = Math.random() * N;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.descartaveis.push(geo);
    this.neve = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.neve.visible = this.particulas && !this.calmo;
    this.cena.add(this.neve);
  }

  // ---- os coelhos ----

  private novoCoelho(cores: CoresDoCoelho): Coelho {
    const copia = copiarCoelho(this.gltfDoCoelho!, { altura: ALTURA_DO_COELHO, sombras: true, cores });
    const raiz = new THREE.Group().add(copia.corpo);
    this.cena.add(raiz);
    return { copia, raiz, tocando: '' };
  }

  private tocar(c: Coelho, nome: string) {
    if (c.tocando === nome) return;
    const nova = c.copia.acoes.get(nome);
    if (!nova) return;
    const velha = c.copia.acoes.get(c.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.25, false);
    c.tocando = nome;
    // com "menos movimento", a pose parada já aparece
    if (this.calmo) c.copia.mixer.update(0.01);
  }

  private pousar(c: Coelho, l: Lugar) {
    c.raiz.position.copy(l.pos);
    c.raiz.rotation.y = l.giro;
    this.tocar(c, l.anim);
  }

  /** O lugar de sentar num móvel: o centro, um tanto para a frente, na altura do assento. */
  private assento(p: Pronto, dx = 0): Lugar {
    const f = p.item.giro ?? 0;
    const frente = new THREE.Vector3(Math.sin(f), 0, Math.cos(f));
    const lado = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));
    const k: Record<Uso, { y: number; av: number; anim: string }> = {
      sofa: { y: 0.36, av: 0.08, anim: 'sentado-sofa' },
      poltrona: { y: 0.36, av: 0.08, anim: 'poltrona' },
      banqueta: { y: 0.62, av: 0, anim: 'banqueta' },
      cadeira: { y: 0.4, av: 0.02, anim: 'sentado' },
      trono: { y: 0.3, av: 0.16, anim: 'poltrona' },
    };
    const u = k[p.item.uso!];
    const pos = p.raiz.position
      .clone()
      .setY(p.tam.y * u.y)
      .addScaledVector(frente, u.av)
      .addScaledVector(lado, dx);
    return { pos, giro: f, anim: u.anim };
  }

  /** O coelho do recado: atrás do balcão, de frente para a sala; no Natal, sentado na poltrona vermelha. */
  private montarRecado() {
    const c = this.novoCoelho(CORES_DO_MASCOTE);
    c.raiz.userData.funcao = 'balcao';
    // o alvo do clique: uma caixa invisível do tamanho dele (a malha animada mexe, e o contorno não conta)
    const alvo = new THREE.Mesh(
      this.caixaGeo(0.55, ALTURA_DO_COELHO, 0.55),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    alvo.position.y = ALTURA_DO_COELHO / 2;
    c.raiz.add(alvo);
    this.clicaveis.push(c.raiz);
    this.recado = c;
    const trono = this.moveis.find((m) => m.item.id === 'trono');
    if (trono) this.pousar(c, this.assento(trono));
    else this.pousar(c, { pos: new THREE.Vector3(8.6, 0, 1.05), giro: 0, anim: 'parado' });
  }

  /** Quem está na call nos lugares, na ordem: transmitindo na frente da TV, jogando no fliperama, o resto senta. */
  private arrumarPessoas() {
    const vivos = new Set(this.listaDePessoas.map((p) => p.id));
    for (const [id, c] of this.pessoas)
      if (!vivos.has(id)) {
        c.copia.descartar();
        this.cena.remove(c.raiz);
        this.pessoas.delete(id);
      }
    const movel = (id: string) => this.moveis.find((m) => m.item.id === id);
    const sentar: Lugar[] = [];
    const sofa = movel('sofa');
    if (sofa) for (const dx of [0, -0.72, 0.72]) sentar.push(this.assento(sofa, dx));
    for (const id of ['poltrona-1', 'poltrona-2', 'banqueta-1', 'banqueta-2', 'banqueta-3', 'cadeira-1', 'cadeira-2', 'cadeira-3', 'cadeira-4']) {
      const p = movel(id);
      if (p) sentar.push(this.assento(p));
    }
    // de pé, quando os lugares acabam: em volta do tapete, virados para a TV
    for (const [x, z] of [
      [5.9, 3.6],
      [5.9, 5.6],
      [4.6, 7.4],
      [4.6, 1.9],
    ])
      sentar.push({ pos: new THREE.Vector3(x, 0, z), giro: -PI / 2, anim: 'parado' });
    const frenteDaTv: Lugar[] = [
      { pos: new THREE.Vector3(1.55, 0, 3.35), giro: PI / 2, anim: 'falando' },
      { pos: new THREE.Vector3(1.55, 0, 5.85), giro: PI / 2, anim: 'falando' },
    ];
    const fliperama: Lugar[] = [
      { pos: new THREE.Vector3(1.45, 0, 8.0), giro: -PI / 2, anim: 'parado' },
      { pos: new THREE.Vector3(1.55, 0, 7.15), giro: -PI / 2 - 0.5, anim: 'parado' },
      { pos: new THREE.Vector3(1.55, 0, 8.85), giro: -PI / 2 + 0.5, anim: 'parado' },
    ];
    for (const p of this.listaDePessoas) {
      let c = this.pessoas.get(p.id);
      if (!c) {
        c = { ...this.novoCoelho(p.cores), p };
        this.pessoas.set(p.id, c);
      } else if (c.p.cores.pelo !== p.cores.pelo || c.p.cores.roupa !== p.cores.roupa) c.copia.material.pintar(p.cores);
      c.p = p;
      const fila = p.papel === 'transmitindo' ? frenteDaTv : p.papel === 'jogando' ? fliperama : sentar;
      const l = fila.shift() ?? sentar.shift() ?? { pos: new THREE.Vector3(6 + Math.random() * 2, 0, 9), giro: -PI / 4, anim: 'parado' };
      this.pousar(c, l);
    }
    this.coelhosVisiveis();
    this.ultimoQuadro = 0;
    this.opcoes.aoMudarRotulos();
  }

  // ---- dia e noite ----

  private aplicarHora() {
    this.realcar(null);
    const noite = this.noite;
    this.ceu.intensity = noite ? 0.3 : 1.1;
    this.ceu.color.set(noite ? '#7d86c8' : '#fff3e0');
    this.sol.color.set(noite ? '#9fb4ff' : '#ffe2b8');
    this.sol.intensity = noite ? 0.7 : 3.0;
    this.preenche.intensity = noite ? 0.15 : 0.5;
    this.fora?.color.set(noite ? '#1f2850' : this.natal ? '#cfe3f2' : '#a8dcf5');
    for (const l of this.luzes) l.intensity = noite ? 3 : 0;
    if (this.luzDaArvore) this.luzDaArvore.intensity = noite ? 4 : 0.8;
    for (const m of this.lampadinhas) m.emissiveIntensity = noite ? 2.2 : 0.4;
    for (const m of this.brilhos) m.emissiveIntensity = noite ? 1.6 : 0.8;
    this.renderer.toneMappingExposure = noite ? 1.25 : 1.0;
    this.ultimoQuadro = 0;
  }

  private aoMudarGraficos = () => {
    const g = lerGraficos();
    this.particulas = g.particulas;
    if (this.neve) this.neve.visible = g.particulas && !this.calmo;
    this.ultimoQuadro = 0;
    if (g.sombras === this.sombras) return;
    this.sombras = g.sombras;
    this.renderer.shadowMap.enabled = g.sombras;
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.needsUpdate = true;
    });
  };

  // ---- os cliques ----

  private mirar(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(this.ponteiro, this.camera);
  }

  /** O primeiro objeto com função (que exista aqui) sob o ponteiro; um móvel sem função na frente segura o clique. */
  private alvoNoPonto(): THREE.Object3D | null {
    // só o que é do cômodo à vista (no banheiro, a porta de dentro; no salão, todo o resto)
    const alvos = [
      ...this.clicaveis.filter((c) => (c.userData.vista ?? 'salao') === this.vista),
      ...(this.vista === 'salao'
        ? this.moveis.filter((m) => !m.item.funcao && !m.item.arquivo.includes('rug') && !m.item.arquivo.includes('carpet')).map((m) => m.raiz)
        : []),
    ];
    for (const h of this.raio.intersectObjects(alvos, true)) {
      if ((h.object as THREE.Mesh).userData.contornoDoCoelho) continue;
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.funcao) return DA_CENA.has(o.userData.funcao) || this.opcoes.temFuncao(o.userData.funcao) ? o : null;
        if (alvos.includes(o)) return null;
        o = o.parent;
      }
    }
    return null;
  }

  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };

  private aoSoltar = (e: PointerEvent) => {
    const a = this.apertou;
    this.apertou = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 8 || e.button !== 0) return;
    this.mirar(e);
    const o = this.alvoNoPonto();
    if (o) this.usarFuncao(o.userData.funcao);
  };

  private aoMover = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.passou = e;
  };

  private aoSair = () => {
    this.passou = null;
    this.realcar(null);
    this.opcoes.aoPassar(null);
  };

  /** O realce: uma luz morna nos materiais do objeto sob o mouse (o coelho do recado, não: o material dele é de paleta). */
  private realcar(o: THREE.Object3D | null) {
    if (o === this.realcado) return;
    for (const [m, antes] of this.emissivos) {
      m.emissive.copy(antes.cor);
      m.emissiveIntensity = antes.intensidade;
    }
    this.emissivos.clear();
    this.realcado = o;
    const ehCoelho = o === this.recado?.raiz;
    // o coelho e o móvel dele (o balcão; no Natal, a poltrona) são o mesmo recado: realça o móvel
    const alvo = ehCoelho ? (this.clicaveis.find((c) => c.userData.funcao === 'balcao' && c !== o) ?? null) : o;
    alvo?.traverse((x) => {
      const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!(x as THREE.Mesh).isMesh || !m?.emissive || this.emissivos.has(m) || this.brilhos.includes(m)) return;
      if (m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return;
      this.emissivos.set(m, { cor: m.emissive.clone(), intensidade: m.emissiveIntensity });
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
    const o = this.alvoNoPonto();
    this.realcar(o);
    const r = this.renderer.domElement.getBoundingClientRect();
    this.opcoes.aoPassar(o ? { id: o.userData.funcao, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  }

  // ---- o laço ----

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, não desenha nada (e o trem não anda)
    if (document.hidden || !document.hasFocus() || !elementoAVista(this.caixa)) {
      this.relogio.update();
      return;
    }
    const agora = performance.now();
    if (agora - this.ultimoQuadro < INTERVALO_MS) return;
    this.ultimoQuadro = agora;
    this.relogio.update();
    const dt = Math.min(0.1, this.relogio.getDelta());
    this.t += dt;
    this.passarAgora();
    // a porta abrindo (uns 0,4 s); aberta, a câmera passa para o outro cômodo e ela fecha atrás
    if (this.abrindo) {
      const k = Math.min(1, (this.t - this.abrindo.desde) / 0.4);
      this.abrindo.porta.rotation.y = 1.25 * (1 - (1 - k) * (1 - k));
      if (k >= 1) {
        this.abrindo.porta.rotation.y = 0;
        const ir = this.abrindo.ir;
        this.abrindo = null;
        this.mostrar(ir);
      }
    }
    if (!this.calmo) {
      if (this.trem) this.andarTrem(dt);
      if (this.patinho) this.boiarPatinho();
      // as luzes da árvore e do poste piscam DEVAGAR (um ciclo de ~5 s), nunca apagam
      if (this.brilhos.length) {
        const base = this.noite ? 1.6 : 0.8;
        const k = 0.72 + 0.28 * Math.sin(this.t * 1.25);
        for (const m of this.brilhos) m.emissiveIntensity = base * k;
      }
      if (this.neve?.visible) {
        const p = this.neve.geometry.getAttribute('position') as THREE.BufferAttribute;
        const a = p.array as Float32Array;
        for (let i = 0; i < p.count; i++) {
          a[i * 3 + 1] -= dt * (0.25 + (i % 5) * 0.04);
          a[i * 3] += Math.sin(this.t + i) * dt * 0.06;
          if (a[i * 3 + 1] < 0) a[i * 3 + 1] = ALTURA_DA_PAREDE;
        }
        p.needsUpdate = true;
      }
      if (this.vista === 'salao') {
        this.recado?.copia.mixer.update(dt);
        for (const c of this.pessoas.values()) c.copia.mixer.update(dt);
      }
    }
    this.renderer.render(this.cena, this.camera);
    this.desenhados++;
    this.tempos.push(performance.now() - agora);
    if (this.tempos.length > 60) this.tempos.shift();
  };
}

function cortar(g: CanvasRenderingContext2D, texto: string, max: number) {
  if (g.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function lerGraficos(): { sombras: boolean; particulas: boolean } {
  try {
    const g = JSON.parse(localStorage.getItem('syden:graficos') ?? '{}');
    return { sombras: !!g.sombras, particulas: !!g.particulas };
  } catch {
    return { sombras: false, particulas: false };
  }
}

export { coresDoAvatar } from '../coelho3d';
