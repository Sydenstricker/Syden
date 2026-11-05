import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * O PILOTO DO QUARTO EM LOW POLY (05/11/2026, pedido dele: "crie uma versão piloto do quarto em low poly e use o coelho 3D
 * para testar"). Uma página de teste, fora do app, para comparar com o quarto de pixel art (`e2e/pixel-art/quarto/novo/`).
 *
 * - Os móveis são do KayKit Bits Bundle 1 (Kay Lousberg, CC0) e, desde a terceira rodada, do Kenney Furniture Kit (CC0,
 *   `modelos/kenney/`: a estante com livros, o guarda-roupa, a planta grande, o pufe, os tapetes, a caixa), com as cores trocadas
 *   pelas do KayKit. O que nenhum dos dois tem — o chão, a cortiça, as fotos do quadro, as luzinhas — é feito aqui por código.
 * - O quarto é a grade 8 × 8 do de pixel art, com as duas paredes do fundo. Os móveis andam pela grade e GIRAM nas 4
 *   posições sem desenho nenhum a mais: é a vantagem que se quer medir.
 * - A luz é de verdade: de dia o sol entra PELA JANELA (a parede tem o vão), à noite acendem o abajur, a luminária e o
 *   monitor. As sombras são caras; o botão desliga, para medir.
 * - O coelho é o mascote 3D (o mesmo do tabuleiro do Cidades). Ele não tem esqueleto aqui: anda pulando, e deitar e sentar
 *   são o corpo inteiro posto no lugar. É justamente o que o piloto precisa mostrar, para decidir se basta.
 */

const MODELOS = './modelos/';
const N = 8;
/** O tamanho dos móveis do KayKit na grade (a mesa dele tem 2 de lado; aqui, uma casa e pouco). */
const S = 0.75;
/**
 * O tamanho das peças do Kenney Furniture Kit (CC0, `modelos/kenney/`, terceira rodada): a mesa dele tem 0,38 de altura e a do
 * KayKit, já em S, 0,75. Com 2, as duas mesas, as duas cadeiras e as duas camas ficam da mesma altura.
 */
const K = 2;
/**
 * As cores do Kenney trocadas pelas do KayKit, pelo nome do material. O Kenney vem com o tapete e o estofado VERMELHO-vivo e o
 * verde-menta, que brigavam com o amarelo e o azul-claro do KayKit; a madeira dele é mais clara e rosada. Cada peça ainda pode
 * trocar uma cor sua (`cores`, no móvel).
 */
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
/** Cada material do Kenney vira um desses, de uma vez: a mesma cor dá o mesmo material (menos chamadas de desenho). */
const ehKenney = (nome: string) => nome.startsWith('kenney/');
const ALTURA_DO_COELHO = 1.1;
const ALTURA_DA_PAREDE = 3;
/** Onde o coelho fica nos móveis, em fração da altura do móvel (acertado pelas fotos, 05/11/2026). */
const DEITADO_ALTURA = 0.45;
const DEITADO_AVANCO = 0.55;
const ASSENTO_POLTRONA = 0.36;
const ASSENTO_CADEIRA = 0.37;

type Lado = 0 | 1 | 2 | 3;
interface Movel {
  id: string;
  arquivo: string;
  x: number;
  z: number;
  lado: Lado;
  /**
   * O que vai em cima (anda e gira junto): arquivo e o lugar no tampo, em casas. `dy` põe numa altura própria (a prateleira da
   * estante, o colchão), em vez do tampo; `escala` multiplica o tamanho do pacote.
   */
  cima?: { arquivo: string; dx: number; dz: number; dy?: number; giro?: number; escala?: number; cores?: Record<string, string> }[];
  /** Não ocupa a casa (o tapete): o coelho pisa. */
  chao?: boolean;
  /** Onde o coelho fica quando usa: deitar na cama, sentar na poltrona. */
  uso?: 'deitar' | 'sentar' | 'luz';
  /** A função que o móvel tem no quarto do app (o coelho vai até ele e a página diz qual seria). */
  funcao?: string;
  /** As cores do Kenney trocadas só nesta peça, pelo nome do material. */
  cores?: Record<string, string>;
  /** Multiplica o tamanho do pacote (o pufe do Kenney é maior que o assento da poltrona do KayKit). */
  escala?: number;
}

/** O vermelho-telha do tapete redondo do canto (as cores do tapete do quarto: sálvia, terracota, azul, mostarda…). */
const TERRACOTA = { carpet: '#c9714f', carpetDarker: '#a5573b' };

const ARRUMACAO: Movel[] = [
  // a parede do fundo: a cama com a cabeceira nela, o criado-mudo, a porta (livre, com o capacho), a estante e o guarda-roupa
  {
    id: 'cama',
    arquivo: 'bed_double_B',
    x: 0,
    z: 0,
    lado: 0,
    uso: 'deitar',
  },
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
    funcao: 'O abajur: Dia e noite.',
  },
  { id: 'capacho', arquivo: 'kenney/rugDoormat', x: 3.5, z: 0.15, lado: 0, chao: true, cores: { wood: '#a9774a' } },
  {
    id: 'estante',
    arquivo: 'kenney/bookcaseClosedWide',
    x: 5,
    z: 0,
    lado: 0,
    cima: [
      // as prateleiras do pacote estão a 0,07, 0,31 e 0,55 (× K): os livros em pé nelas, e o rádio e uma plantinha
      { arquivo: 'kenney/books', dx: -0.45, dz: 0, dy: 0.14, escala: 1.4, cores: { carpetDarker: '#b8574a', plant: '#5f9a8c' } },
      { arquivo: 'kenney/books', dx: -0.02, dz: 0, dy: 0.14, escala: 1.4, giro: Math.PI, cores: { carpetDarker: '#6f8fb5' } },
      { arquivo: 'kenney/radio', dx: 0.42, dz: 0.02, dy: 0.62, escala: 0.9 },
      { arquivo: 'kenney/books', dx: -0.42, dz: 0, dy: 0.62, escala: 1.4, cores: { carpetDarker: '#d29a3e' } },
      { arquivo: 'book_set', dx: 0.25, dz: 0, dy: 1.1 },
      { arquivo: 'kenney/plantSmall2', dx: -0.45, dz: 0, dy: 1.1 },
      { arquivo: 'kenney/plantSmall1', dx: 0.5, dz: 0, dy: 1.58 },
      { arquivo: 'kenney/books', dx: -0.15, dz: 0, dy: 1.58, escala: 1.2, giro: 1.2, cores: { carpetDarker: '#7d9a5a' } },
    ],
  },
  { id: 'guarda-roupa', arquivo: 'kenney/bookcaseClosedDoors', x: 7, z: 0, lado: 0, funcao: 'O guarda-roupa: Guarda-roupa.' },
  // a parede da esquerda: o sofá debaixo da janela, a planta grande, e o computador no canto
  { id: 'tapete', arquivo: 'rug_oval_B', x: 1, z: 2, lado: 1, chao: true },
  { id: 'sofa', arquivo: 'couch_pillows', x: 0, z: 2, lado: 3, uso: 'sentar' },
  { id: 'mesinha', arquivo: 'table_low', x: 2, z: 2, lado: 3, cima: [{ arquivo: 'gameconsole_handheld', dx: 0.15, dz: 0.1, giro: 0.4 }, { arquivo: 'mug_A', dx: -0.4, dz: -0.05 }] },
  { id: 'planta', arquivo: 'kenney/pottedPlant', x: 0, z: 4, lado: 1, cores: { wood: '#c9714f' } },
  {
    id: 'mesa',
    arquivo: 'desk',
    x: 0,
    z: 6,
    lado: 3,
    funcao: 'A mesa com o computador: Mini-games. O fone no abajur dela: Salas de voz.',
    cima: [
      { arquivo: 'monitor', dx: 0, dz: -0.28 },
      { arquivo: 'keyboard', dx: -0.05, dz: 0.12 },
      { arquivo: 'mousepad_A', dx: 0.45, dz: 0.14 },
      { arquivo: 'mouse', dx: 0.45, dz: 0.14 },
      { arquivo: 'lamp_desk_headphones', dx: -0.78, dz: -0.15 },
      { arquivo: 'cup_pencils', dx: 0.82, dz: -0.25 },
    ],
  },
  { id: 'cadeira', arquivo: 'chair_desk_A', x: 1, z: 6, lado: 1, uso: 'sentar' },
  // o canto da leitura, do outro lado
  { id: 'tapete2', arquivo: 'kenney/rugRound', x: 4.5, z: 4.3, lado: 0, chao: true, cores: TERRACOTA },
  // o pufe da poltrona, para os pés: o 'ottoman' do Kenney, no mostarda do estofado do KayKit
  { id: 'pufe', arquivo: 'kenney/loungeSofaOttoman', x: 5, z: 5, lado: 0, escala: 0.75 },
  {
    id: 'poltrona',
    arquivo: 'armchair_pillows',
    // virada para a frente da câmera: de costas (como na primeira rodada), a poltrona escondia o coelho sentado
    x: 5,
    z: 4,
    lado: 0,
    uso: 'sentar',
  },
  { id: 'banquinho', arquivo: 'table_small', x: 6, z: 4, lado: 0, cima: [{ arquivo: 'book_set', dx: 0, dz: 0 }, { arquivo: 'kenney/plantSmall3', dx: 0.22, dz: -0.2 }] },
  { id: 'luminaria', arquivo: 'lamp_standing', x: 4, z: 4, lado: 0, uso: 'luz' },
  { id: 'caixa', arquivo: 'kenney/cardboardBoxOpen', x: 7, z: 2, lado: 3 },
  { id: 'cacto2', arquivo: 'cactus_small_B', x: 1, z: 7, lado: 0 },
  { id: 'cacto', arquivo: 'cactus_medium_B', x: 7, z: 6, lado: 0 },
];

/**
 * O que se pendura: na parede do fundo (z = 0) ou na da esquerda (x = 0), em u casas ao longo dela e y de altura (o Kenney e a
 * cortiça: y é a base da peça). 'cortica' é feita aqui por código (nenhum dos dois pacotes tem uma).
 */
const NA_PAREDE: { arquivo: string; parede: 'fundo' | 'esquerda'; u: number; y: number; funcao?: string; fotos?: boolean }[] = [
  { arquivo: 'pictureframe_large_B', parede: 'fundo', u: 1.0, y: 1.85, funcao: 'O quadro de fotos: Amigos.', fotos: true },
  { arquivo: 'pictureframe_small_A', parede: 'fundo', u: 5.5, y: 2.2 },
  { arquivo: 'pictureframe_small_B', parede: 'fundo', u: 6.3, y: 2.35 },
  { arquivo: 'cortica', parede: 'esquerda', u: 1.15, y: 1.35, funcao: 'A cortiça: Caixa de ideias.' },
  { arquivo: 'shelf_A_big', parede: 'esquerda', u: 7.0, y: 1.95 },
  // o que está em cima da prateleira da mesa (o tampo dela fica a 2,03)
  { arquivo: 'kenney/plantSmall3', parede: 'esquerda', u: 7.45, y: 2.03 },
  { arquivo: 'kenney/books', parede: 'esquerda', u: 6.75, y: 2.03 },
  { arquivo: 'kenney/books', parede: 'esquerda', u: 6.45, y: 2.03 },
  { arquivo: 'pictureframe_small_C', parede: 'esquerda', u: 1.75, y: 2.45 },
];

/**
 * AS PAREDES do KayKit Restaurant Bits (CC0): peças de 4 × 4 com o rodapé verde-água, 3 por parede. A grade é a de 8 do
 * quarto de pixel art, então cada peça fica um pouco mais estreita (8/12 na largura, 3/4 na altura).
 */
const PAREDES: { arquivo: string; parede: 'fundo' | 'esquerda'; i: number }[] = [
  { arquivo: 'restaurante/wall', parede: 'fundo', i: 0 },
  { arquivo: 'restaurante/wall_doorway', parede: 'fundo', i: 1 },
  { arquivo: 'restaurante/wall', parede: 'fundo', i: 2 },
  { arquivo: 'restaurante/wall', parede: 'esquerda', i: 0 },
  { arquivo: 'restaurante/wall_window_closed_curtains_green', parede: 'esquerda', i: 1 },
  { arquivo: 'restaurante/wall', parede: 'esquerda', i: 2 },
];

// ---- a cena ----
const tela = document.getElementById('tela')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
tela.appendChild(renderer.domElement);
const cena = new THREE.Scene();
// o fundo atrás do quarto: o mesmo roxo escuro e quente da barra (o preto puro destoava do tom aconchegante)
cena.background = new THREE.Color('#2b2430');
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const centro = new THREE.Vector3(N / 2 - 0.3, 0.9, N / 2 - 0.3);
camera.position.copy(centro).add(new THREE.Vector3(12, 10.5, 12));
camera.lookAt(centro);

function medir() {
  const w = tela.clientWidth;
  const h = tela.clientHeight;
  renderer.setSize(w, h, false);
  const a = w / h;
  const meia = a > 1.2 ? 5.6 : 5.6 * (1.2 / a);
  camera.left = -meia * a;
  camera.right = meia * a;
  camera.top = meia;
  camera.bottom = -meia;
  camera.updateProjectionMatrix();
}
new ResizeObserver(medir).observe(tela);
medir();

// as luzes
const ceu = new THREE.HemisphereLight('#fffaf0', '#c9a88a', 1.7);
const sol = new THREE.DirectionalLight('#fff0d8', 2.3);
// do alto, do lado aberto do quarto: as sombras caem para as paredes, como nas fotos do KayKit
sol.position.set(6, 12, 9);
sol.target.position.set(3.5, 0, 3.5);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
sol.shadow.bias = -0.0006;
sol.shadow.normalBias = 0.03;
cena.add(ceu, sol, sol.target);
const preenche = new THREE.DirectionalLight('#dfe8ff', 0.7);
preenche.position.set(10, 8, 10);
cena.add(preenche);

// ---- o quarto: chão, paredes, janela ----
function textura(desenhar: (g: CanvasRenderingContext2D, L: number) => void, L = 512, repetir = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = L;
  desenhar(c.getContext('2d')!, L);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repetir, repetir);
  t.anisotropy = 8;
  return t;
}
const tabuas = textura((g, L) => {
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
}, 512, 2);
const chao = new THREE.Mesh(new THREE.BoxGeometry(N, 0.2, N), new THREE.MeshStandardMaterial({ map: tabuas, roughness: 0.85 }));
chao.position.set(N / 2, -0.1, N / 2);
chao.receiveShadow = true;
chao.userData.chao = true;
cena.add(chao);

// lá fora: um céu atrás da janela da esquerda
const JANELA = { z: N / 2, y: 1.75 };
const fora = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), new THREE.MeshBasicMaterial({ color: '#a8dcf5' }));
fora.rotation.y = Math.PI / 2;
fora.position.set(-0.7, JANELA.y, JANELA.z);
cena.add(fora);
const morro = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: '#86c06a' }));
morro.scale.set(0.05, 0.6, 1.4);
morro.position.set(-0.6, JANELA.y - 0.9, JANELA.z + 0.4);
cena.add(morro);

// ---- os modelos ----
const carregador = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const modelo = (nome: string) => {
  if (!cache.has(nome)) cache.set(nome, carregador.loadAsync(`${MODELOS}${nome}${nome.endsWith('.glb') ? '' : ehKenney(nome) ? '.glb' : '.gltf'}`));
  return cache.get(nome)!;
};

interface Pronto {
  m: Movel;
  raiz: THREE.Group;
  /** O modelo, já no tamanho, girado pelo `lado` dentro da raiz. */
  giro: THREE.Group;
  w: number;
  d: number;
  altura: number;
  luz?: THREE.PointLight;
  materiais: THREE.MeshStandardMaterial[];
}
const moveis: Pronto[] = [];
/** O que está na parede e tem função (o quadro, a cortiça, a janela): o clique procura aqui. */
const daParede: THREE.Object3D[] = [];
/** As luzinhas do alto das paredes: duas luzes por parede, sem sombra, acesas à noite. */
const arandelas: THREE.PointLight[] = [];
const lampadinhas: THREE.MeshStandardMaterial[] = [];

function caber(o: THREE.Object3D) {
  const caixa = new THREE.Box3().setFromObject(o);
  return { caixa, tam: caixa.getSize(new THREE.Vector3()) };
}
/** As lâmpadas do Kenney (o material 'lamp'): acendem à noite. */
const lampadas: THREE.MeshStandardMaterial[] = [];

/**
 * Uma cópia com materiais próprios (para destacar só este). No Kenney, as cores viram as do KayKit (`PALETA_KENNEY` e as
 * `cores` da peça), e o brilho de metal sai (o KayKit é todo fosco).
 * A frente dos dois pacotes olha para +z, então não há giro a acertar.
 */
function copia(g: GLTF, nome = '', cores: Record<string, string> = {}) {
  const o = g.scene.clone(true);
  const mats: THREE.MeshStandardMaterial[] = [];
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
      if (mat.name === 'lamp') lampadas.push(mat);
    }
    m.material = mat;
    mats.push(mat);
    m.castShadow = true;
    m.receiveShadow = true;
  });
  return { o, mats };
}

/** A peça no tamanho do pacote, centrada na própria pegada e com a base em y = 0. */
async function peca(nome: string, cores?: Record<string, string>, escala = 1) {
  const x = copia(await modelo(nome), nome, cores);
  x.o.scale.setScalar((ehKenney(nome) ? K : S) * escala);
  const { caixa, tam } = caber(x.o);
  const c = caixa.getCenter(new THREE.Vector3());
  x.o.position.set(-c.x, -caixa.min.y, -c.z);
  return { g: new THREE.Group().add(x.o), mats: x.mats, tam };
}

async function montarMovel(m: Movel): Promise<Pronto> {
  const { g: o, mats, tam } = await peca(m.arquivo, m.cores, m.escala);
  const giro = new THREE.Group();
  giro.add(o);
  const raiz = new THREE.Group();
  raiz.add(giro);
  raiz.userData.movel = m.id;
  const w = Math.max(1, Math.round(tam.x));
  const d = Math.max(1, Math.round(tam.z));
  const p: Pronto = { m, raiz, giro, w, d, altura: tam.y, materiais: mats };
  for (const c2 of m.cima ?? []) {
    const x = await peca(c2.arquivo, c2.cores, c2.escala);
    p.materiais.push(...x.mats);
    const item = x.g;
    item.position.set(c2.dx, c2.dy ?? tam.y, c2.dz);
    item.rotation.y = c2.giro ?? 0;
    giro.add(item);
    if (c2.arquivo === 'lamp_table') {
      p.luz = new THREE.PointLight('#ffc477', 0, 5, 1.6);
      p.luz.position.set(c2.dx, tam.y + 0.42, c2.dz);
      // sem sombra: a de luz pontual são seis desenhos a mais por quadro (medido: 0,9 ms de dia, 20 ms de noite)
      giro.add(p.luz);
    }
  }
  if (m.arquivo === 'lamp_standing') {
    p.luz = new THREE.PointLight('#ffcf8a', 0, 6, 1.5);
    p.luz.position.set(0, tam.y - 0.15, 0);
    giro.add(p.luz);
  }
  cena.add(raiz);
  posicionar(p);
  return p;
}

/** A pegada na grade pelo lado (girar troca largura e fundo). */
const pegada = (p: Pronto) => (p.m.lado % 2 ? { w: p.d, d: p.w } : { w: p.w, d: p.d });
function posicionar(p: Pronto) {
  const { w, d } = pegada(p);
  p.m.x = Math.max(0, Math.min(N - w, p.m.x));
  p.m.z = Math.max(0, Math.min(N - d, p.m.z));
  p.raiz.position.set(p.m.x + w / 2, 0, p.m.z + d / 2);
  p.giro.rotation.y = -p.m.lado * (Math.PI / 2);
}

// ---- o coelho ----
interface Coelho {
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
  depois: (() => void) | null;
  mixer: THREE.AnimationMixer;
  acoes: Map<string, THREE.AnimationAction>;
  tocando: string;
}
let coelho: Coelho | null = null;

/**
 * O coelho COM O NOSSO ESQUELETO (web/public/cidades3d/coelho-animado.glb, de e2e/pixel-art/personagem/blender/meshy/glb.py):
 * as poses do motor do quarto de pixel art, as mesmas, como animações. Andar, sentar e deitar são de verdade.
 */
async function montarCoelho() {
  const g = await modelo('coelho-animado.glb');
  const o = SkeletonUtils.clone(g.scene);
  const { caixa, tam } = caber(o);
  const k = ALTURA_DO_COELHO / tam.y;
  o.scale.setScalar(k);
  o.position.set(0, -caixa.min.y * k, 0);
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  const corpo = new THREE.Group().add(o);
  const raiz = new THREE.Group().add(corpo);
  const casa: [number, number] = [3, 6];
  raiz.position.set(casa[0] + 0.5, 0, casa[1] + 0.5);
  cena.add(raiz);
  const mixer = new THREE.AnimationMixer(o);
  const acoes = new Map(g.animations.map((a) => [a.name, mixer.clipAction(a)]));
  coelho = { raiz, corpo, casa, caminho: [], de: raiz.position.clone(), para: raiz.position.clone(), inicio: 0, duracao: 0, arco: 0, rumo: 0, pose: 'pe', depois: null, mixer, acoes, tocando: '' };
  tocar('parado');
}
/** Troca de animação com uma passagem curta (as poses de um quadro só ficam paradas nele). */
function tocar(nome: string) {
  const c = coelho!;
  if (c.tocando === nome) return;
  const nova = c.acoes.get(nome);
  if (!nova) return;
  const velha = c.acoes.get(c.tocando);
  nova.reset().play();
  if (velha) velha.crossFadeTo(nova, 0.25, false);
  c.tocando = nome;
}

/** As casas ocupadas (o tapete não conta). */
function ocupadas(): Set<string> {
  const s = new Set<string>();
  for (const p of moveis) {
    if (p.m.chao) continue;
    const { w, d } = pegada(p);
    for (let x = p.m.x; x < p.m.x + w; x++) for (let z = p.m.z; z < p.m.z + d; z++) s.add(`${x},${z}`);
  }
  return s;
}
/** O caminho pela grade, desviando dos móveis (busca em largura). */
function caminho(de: [number, number], ate: [number, number], cheias: Set<string>): [number, number][] | null {
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
/** A casa livre mais perto de um ponto (para chegar a um móvel). */
function livreMaisPerto(x: number, z: number, cheias: Set<string>): [number, number] | null {
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

function pular(para: THREE.Vector3, duracao: number, arco: number) {
  const c = coelho!;
  c.de.copy(c.raiz.position);
  c.para.copy(para);
  c.inicio = performance.now();
  c.duracao = duracao;
  c.arco = arco;
  if (c.de.distanceTo(para) > 0.05) c.rumo = Math.atan2(para.x - c.de.x, para.z - c.de.z);
}
/** Anda até a casa e, chegando, faz `depois`. Se estava deitado ou sentado, desce primeiro. */
function irPara(alvo: [number, number], depois: (() => void) | null) {
  const c = coelho!;
  const cheias = ocupadas();
  if (c.pose !== 'pe') {
    c.pose = 'pe';
    const sai = livreMaisPerto(c.raiz.position.x, c.raiz.position.z, cheias)!;
    c.casa = sai;
    pular(new THREE.Vector3(sai[0] + 0.5, 0, sai[1] + 0.5), 420, 0.35);
    tocar('parado');
  }
  const r = caminho(c.casa, alvo, cheias);
  c.caminho = r ?? [];
  c.depois = depois;
  if (!r) situacao('Não dá para chegar lá.');
}

function usar(p: Pronto) {
  const c = coelho!;
  const cheias = ocupadas();
  const { w, d } = pegada(p);
  // a frente do móvel, pelo lado: 0 olha para +z
  const frente = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ][p.m.lado];
  const cx = p.m.x + w / 2;
  const cz = p.m.z + d / 2;
  const chegada = livreMaisPerto(cx + frente[0] * (w / 2 + 0.5), cz + frente[1] * (d / 2 + 0.5), cheias);
  if (!chegada) return;
  irPara(chegada, () => {
    if (p.m.uso === 'luz') {
      if (p.luz) p.luz.intensity = p.luz.intensity > 0 ? 0 : noite ? 6 : 2.5;
      situacao(`${p.luz && p.luz.intensity > 0 ? 'Acendeu.' : 'Apagou.'}${p.m.funcao ? ` No app: ${p.m.funcao}` : ''}`);
      c.rumo = Math.atan2(cx - c.raiz.position.x, cz - c.raiz.position.z);
      return;
    }
    if (!p.m.uso) {
      // só a função: ele para diante do móvel, virado para ele (no app, a função abriria aqui)
      c.rumo = Math.atan2(cx - c.raiz.position.x, cz - c.raiz.position.z);
      situacao(`No app: ${p.m.funcao}`);
      return;
    }
    const rumo = -p.m.lado * (Math.PI / 2);
    if (p.m.uso === 'deitar') {
      // em cima do colchão, de barriga para cima, a cabeça no travesseiro (a cabeceira é o fundo do móvel)
      const ponto = new THREE.Vector3(cx, p.altura * DEITADO_ALTURA, cz).add(new THREE.Vector3(frente[0], 0, frente[1]).multiplyScalar(DEITADO_AVANCO));
      pular(ponto, 520, 0.45);
      tocar('dormindo');
      c.pose = 'deitado';
      // de costas: o pé para o lado da frente da cama, a cabeça cai para a cabeceira
      c.rumo = rumo;
      situacao('Deitou.');
    } else {
      // a pose pelo móvel: afundado na poltrona, as pernas penduradas no sofá, as mãos no teclado na cadeira da mesa
      const poltrona = p.m.arquivo.startsWith('armchair') || p.m.arquivo.startsWith('couch');
      const pose = p.m.arquivo.startsWith('armchair') ? 'poltrona' : p.m.arquivo.startsWith('couch') ? 'sentado-sofa' : p.m.arquivo.startsWith('chair_desk') ? 'computador' : 'sentado';
      const ponto = new THREE.Vector3(cx, p.altura * (poltrona ? ASSENTO_POLTRONA : ASSENTO_CADEIRA), cz).add(new THREE.Vector3(frente[0], 0, frente[1]).multiplyScalar(poltrona ? 0.08 : 0.02));
      pular(ponto, 420, 0.3);
      tocar(pose);
      c.pose = 'sentado';
      c.rumo = rumo;
      situacao('Sentou.');
    }
  });
}

// ---- dia e noite ----
let noite = false;
function aplicarHora() {
  ceu.intensity = noite ? 0.28 : 1.1;
  ceu.color.set(noite ? '#7d86c8' : '#fff3e0');
  sol.color.set(noite ? '#9fb4ff' : '#ffe2b8');
  sol.intensity = noite ? 0.7 : 3.2;
  preenche.intensity = noite ? 0.12 : 0.5;
  (fora.material as THREE.MeshBasicMaterial).color.set(noite ? '#1f2850' : '#a8dcf5');
  (morro.material as THREE.MeshBasicMaterial).color.set(noite ? '#243a32' : '#86c06a');
  for (const p of moveis) if (p.luz) p.luz.intensity = noite ? 6 : 0;
  for (const l of arandelas) l.intensity = noite ? 1.6 : 0;
  for (const m of lampadinhas) m.emissiveIntensity = noite ? 2.2 : 0.35;
  for (const m of lampadas) {
    m.emissive.set('#ffcf7a');
    m.emissiveIntensity = noite ? 1.6 : 0;
  }
  cena.traverse((o) => {
    if (o.userData.tela) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = noite ? 1.4 : 0.15;
  });
  renderer.toneMappingExposure = noite ? 1.25 : 1.0;
  document.getElementById('noite')!.classList.toggle('ativo', noite);
}

// ---- a interação ----
let modo: 'passear' | 'arrumar' = 'passear';
let escolhido: Pronto | null = null;
let arrastando = false;
const raio = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
const planoDoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function mirar(e: PointerEvent) {
  const r = renderer.domElement.getBoundingClientRect();
  ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raio.setFromCamera(ponteiro, camera);
}
function movelNoPonto(): Pronto | null {
  const hits = raio.intersectObjects(
    moveis.map((p) => p.raiz),
    true,
  );
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o && !o.userData.movel) o = o.parent;
    if (o) return moveis.find((p) => p.m.id === o!.userData.movel) ?? null;
  }
  return null;
}
function casaNoChao(): [number, number] | null {
  const p = new THREE.Vector3();
  if (!raio.ray.intersectPlane(planoDoChao, p)) return null;
  const x = Math.floor(p.x);
  const z = Math.floor(p.z);
  return x >= 0 && z >= 0 && x < N && z < N ? [x, z] : null;
}
function destacar(p: Pronto | null) {
  for (const q of moveis) for (const m of q.materiais) m.emissive?.set(q === p ? '#5a3a18' : '#000000');
}
let pegou: { dx: number; dz: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  mirar(e);
  const p = movelNoPonto();
  if (modo === 'arrumar') {
    escolhido = p;
    destacar(p);
    if (p) {
      const casa = casaNoChao();
      pegou = casa ? { dx: casa[0] - p.m.x, dz: casa[1] - p.m.z } : { dx: 0, dz: 0 };
      arrastando = true;
      renderer.domElement.setPointerCapture(e.pointerId);
      situacao(`${p.m.id}: arraste para mudar de lugar, R para girar.`);
    } else situacao('Toque num móvel.');
    return;
  }
  if (!coelho) return;
  if (p && (p.m.uso || p.m.funcao)) return usar(p);
  // o que está na parede e tem função (o quadro, a cortiça, a janela): ele vai até a parede, e a página diz a função
  const naParede = raio.intersectObjects(daParede, true)[0];
  if (naParede) {
    let o: THREE.Object3D | null = naParede.object;
    while (o && !o.userData.funcao) o = o.parent;
    if (o) {
      const ponto = naParede.point;
      const cheias = ocupadas();
      const alvo = livreMaisPerto(Math.max(0.5, ponto.x), Math.max(0.5, ponto.z), cheias);
      const funcao = o.userData.funcao as string;
      if (alvo)
        irPara(alvo, () => {
          coelho!.rumo = Math.atan2(ponto.x - coelho!.raiz.position.x, ponto.z - coelho!.raiz.position.z);
          situacao(`No app: ${funcao}`);
        });
      return;
    }
  }
  const casa = casaNoChao();
  if (casa) {
    const cheias = ocupadas();
    const alvo = cheias.has(`${casa[0]},${casa[1]}`) ? livreMaisPerto(casa[0] + 0.5, casa[1] + 0.5, cheias) : casa;
    if (alvo) irPara(alvo, null);
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!arrastando || !escolhido || !pegou) return;
  mirar(e);
  const casa = casaNoChao();
  if (!casa) return;
  escolhido.m.x = casa[0] - pegou.dx;
  escolhido.m.z = casa[1] - pegou.dz;
  posicionar(escolhido);
});
renderer.domElement.addEventListener('pointerup', () => (arrastando = false));

function girar() {
  if (!escolhido) return situacao('Escolha um móvel no Arrumar.');
  escolhido.m.lado = ((escolhido.m.lado + 1) % 4) as Lado;
  posicionar(escolhido);
}
addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') girar();
});
const botao = (id: string) => document.getElementById(id)!;
botao('passear').onclick = () => {
  modo = 'passear';
  escolhido = null;
  destacar(null);
  botao('passear').classList.add('ativo');
  botao('arrumar').classList.remove('ativo');
  situacao('Toque no chão para andar; na cama, nas cadeiras e no sofá para usar; no abajur e na luminária para acender; no guarda-roupa, na mesa, no quadro, na cortiça e na janela para ver a função.');
};
botao('arrumar').onclick = () => {
  modo = 'arrumar';
  botao('arrumar').classList.add('ativo');
  botao('passear').classList.remove('ativo');
  situacao('Toque num móvel: arraste para mudar de lugar, R para girar.');
};
botao('girar').onclick = girar;
botao('noite').onclick = () => {
  noite = !noite;
  aplicarHora();
};
botao('sombras').onclick = () => {
  renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
  cena.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.needsUpdate = true;
  });
  botao('sombras').classList.toggle('ativo', renderer.shadowMap.enabled);
};
function situacao(t: string) {
  document.getElementById('situacao')!.textContent = t;
}

// ---- o laço ----
const relogio = new THREE.Timer();
let medias = 0;
let quadros = 0;
function quadro() {
  relogio.update();
  const agora = performance.now();
  const c = coelho;
  if (c) {
    const f = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
    if (f >= 1 && c.caminho.length) {
      const [x, z] = c.caminho.shift()!;
      c.casa = [x, z];
      pular(new THREE.Vector3(x + 0.5, 0, z + 0.5), 360, 0);
      tocar('andando');
    } else if (f >= 1 && c.depois) {
      const d = c.depois;
      c.depois = null;
      d();
    } else if (f >= 1 && c.pose === 'pe' && c.tocando === 'andando') tocar('parado');
    const g = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
    // andando é em linha reta e com velocidade igual; o pulo (subir na cama, na poltrona) amacia
    const e = c.arco > 0 ? g * g * (3 - 2 * g) : g;
    c.raiz.position.lerpVectors(c.de, c.para, e);
    c.raiz.position.y += g < 1 ? Math.sin(Math.PI * g) * c.arco : 0;
    let delta = c.rumo - c.corpo.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    c.corpo.rotation.y += delta * 0.25;
    c.mixer.update(relogio.getDelta());
  }
  if (!document.hidden) renderer.render(cena, camera);
  const ms = performance.now() - agora;
  medias += ms;
  if (++quadros % 30 === 0) {
    const i = renderer.info.render;
    document.getElementById('medida')!.textContent = `${(medias / 30).toFixed(1)} ms por quadro · ${i.calls} chamadas · ${i.triangles} triângulos`;
    medias = 0;
  }
}

/**
 * A CORTIÇA (a Caixa de ideias), feita aqui: nem o KayKit nem o Kenney têm uma. Moldura de madeira, a cortiça pontilhada por
 * canvas, quatro bilhetes e as tachinhas, nas cores dos dois pacotes. As costas em z = 0, a base em y = 0.
 */
function cortica() {
  const L = 1.15;
  const A = 0.8;
  const g = new THREE.Group();
  const madeira = new THREE.MeshStandardMaterial({ color: '#9a5d36', roughness: 0.85 });
  const pontos = textura((c, t) => {
    c.fillStyle = '#c99a63';
    c.fillRect(0, 0, t, t);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = i % 3 ? 'rgba(120,80,40,0.25)' : 'rgba(240,210,160,0.3)';
      c.fillRect((i * 97) % t, (i * 61 + (i >> 3) * 13) % t, 3, 3);
    }
  }, 128);
  const fundo = new THREE.Mesh(new THREE.BoxGeometry(L, A, 0.04), new THREE.MeshStandardMaterial({ map: pontos, roughness: 1 }));
  fundo.position.set(0, A / 2, 0.02);
  g.add(fundo);
  const ripa = (w: number, h: number, x: number, y: number) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), madeira);
    r.position.set(x, y, 0.035);
    g.add(r);
  };
  ripa(L + 0.08, 0.06, 0, 0);
  ripa(L + 0.08, 0.06, 0, A);
  ripa(0.06, A, -L / 2, A / 2);
  ripa(0.06, A, L / 2, A / 2);
  const bilhetes: [string, number, number, number, number][] = [
    ['#f4e1a1', -0.3, 0.52, 0.28, -0.08],
    ['#9cc8d6', 0.12, 0.55, 0.24, 0.1],
    ['#efe5d2', 0.36, 0.3, 0.22, -0.05],
    ['#e9a38a', -0.12, 0.24, 0.3, 0.06],
  ];
  for (const [cor, x, y, t, giro] of bilhetes) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(t, t * 0.85, 0.008), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.95 }));
    b.position.set(x, y, 0.045);
    b.rotation.z = giro;
    b.castShadow = true;
    g.add(b);
    const tacha = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: '#c9473d', roughness: 0.5 }));
    tacha.position.set(x, y + t * 0.33, 0.055);
    g.add(tacha);
  }
  g.traverse((o) => ((o as THREE.Mesh).receiveShadow = true));
  return g;
}

/**
 * As fotos do quadro de AMIGOS (no app, a função Amigos): quatro fotos de papel tortas por cima do branco da moldura do KayKit,
 * desenhadas por canvas (um morro, o mar, o pôr do sol, dois coelhos), sem foto de ninguém.
 */
function fotosDoQuadro() {
  const t = textura((c, L) => {
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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.68), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9 }));
  // a tela branca da moldura está a 0,113 (medido no arquivo); a borda, a 0,15
  m.position.set(0, 0, 0.118);
  return m;
}

/**
 * AS LUZINHAS do alto das duas paredes (o fio do salão de pixel art, aqui em 3D): um fio caindo em arcos e as lâmpadas em três
 * tons quentes. De dia, apagadas; à noite, acesas, com duas luzes por parede (sem sombra: cada sombra pontual são seis desenhos).
 */
function luzinhas() {
  const fio = new THREE.LineBasicMaterial({ color: '#4a3a30' });
  const tons = ['#ffcf7a', '#ffb070', '#ffe3a8'].map((c) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 });
    lampadinhas.push(m);
    return m;
  });
  const bolinha = new THREE.SphereGeometry(0.045, 8, 6);
  const Y = ALTURA_DA_PAREDE - 0.32;
  for (const parede of ['fundo', 'esquerda'] as const) {
    const pontos: THREE.Vector3[] = [];
    const ponto = (u: number) => {
      // três arcos por parede, cada um caindo 0,18 no meio
      const f = (u / N) * 3;
      const y = Y - Math.sin(Math.PI * (f - Math.floor(f))) * 0.18;
      return parede === 'fundo' ? new THREE.Vector3(u, y, 0.06) : new THREE.Vector3(0.06, y, u);
    };
    for (let u = 0.15; u <= N - 0.05; u += 0.05) pontos.push(ponto(u));
    cena.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pontos), fio));
    // uma malha instanciada por tom: as ~60 lâmpadas da parede são 3 desenhos, e não 60
    const porTom: THREE.Vector3[][] = tons.map(() => []);
    let i = 0;
    for (let u = 0.35; u < N - 0.1; u += 0.4) porTom[i++ % tons.length].push(ponto(u).add(new THREE.Vector3(0, -0.05, 0)));
    porTom.forEach((lugares, t) => {
      const inst = new THREE.InstancedMesh(bolinha, tons[t], lugares.length);
      lugares.forEach((p, k) => inst.setMatrixAt(k, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
      cena.add(inst);
    });
    // uma luz por parede, no meio: cada luz pontual a mais pesa em todo pixel do quarto
    // ?sem-luz-das-luzinhas: as lâmpadas brilham, mas não iluminam (para medir o custo das duas luzes)
    for (const u of new URLSearchParams(location.search).has('sem-luz-das-luzinhas') ? [] : [N * 0.5]) {
      const l = new THREE.PointLight('#ffc37a', 0, 5, 1.6);
      l.position.copy(ponto(u)).add(parede === 'fundo' ? new THREE.Vector3(0, -0.2, 0.5) : new THREE.Vector3(0.5, -0.2, 0));
      cena.add(l);
      arandelas.push(l);
    }
  }
}

// ---- montar ----
(async () => {
  situacao('Carregando…');
  for (const m of ARRUMACAO) moveis.push(await montarMovel(m));
  for (const q of PAREDES) {
    const { o } = copia(await modelo(q.arquivo));
    // um tico mais largas: as pontas arredondadas se sobrepõem e a emenda some
    o.scale.set(S * (8 / 9) * 1.06, S, S);
    const g = new THREE.Group().add(o);
    const meio = (q.i + 0.5) * (N / 3);
    // a face de dentro rente à grade: a peça tem 0,5 de espessura (0,375 aqui), centrada
    if (q.parede === 'fundo') g.position.set(meio, 0, -0.19);
    else {
      g.rotation.y = Math.PI / 2;
      g.position.set(-0.19, 0, meio);
    }
    if (q.arquivo.includes('window')) {
      g.userData.funcao = 'A janela: Explorar.';
      daParede.push(g);
    }
    cena.add(g);
  }
  // a porta, fechada, no vão da parede do fundo (a dobradiça é a ponta x = 0 da peça)
  {
    const { o } = copia(await modelo('restaurante/door_A'));
    o.scale.set(S * (8 / 9), S, S);
    o.position.set(N / 2 - 0.71, 0, -0.17);
    cena.add(o);
  }
  for (const q of NA_PAREDE) {
    let g: THREE.Group;
    if (q.arquivo === 'cortica') g = cortica();
    else if (ehKenney(q.arquivo)) {
      // o Kenney centrado, com as costas na parede e a base em y
      const x = await peca(q.arquivo);
      x.g.children[0].position.z += x.tam.z / 2;
      g = x.g;
    } else {
      const { o } = copia(await modelo(q.arquivo));
      o.scale.setScalar(S);
      g = new THREE.Group().add(o);
      if (q.fotos) g.add(fotosDoQuadro());
    }
    const quadro = new THREE.Group().add(g);
    if (q.parede === 'fundo') quadro.position.set(q.u, q.y, 0.01);
    else {
      quadro.rotation.y = Math.PI / 2;
      quadro.position.set(0.01, q.y, q.u);
    }
    if (q.funcao) {
      quadro.userData.funcao = q.funcao;
      daParede.push(quadro);
    }
    cena.add(quadro);
  }
  luzinhas();
  await montarCoelho();
  aplicarHora();
  botao('passear').click();
  renderer.setAnimationLoop(quadro);
  (window as unknown as Record<string, unknown>).quartoPronto = true;
  Object.assign(window as unknown as Record<string, unknown>, { moveisDoTeste: moveis, usarDoTeste: (id: string) => usar(moveis.find((p) => p.m.id === id)!), noiteDoTeste: (v: boolean) => ((noite = v), aplicarHora()) });
})().catch((e) => {
  situacao(`Falhou: ${e}`);
  console.error(e);
});
