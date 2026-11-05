import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * O PILOTO DO QUARTO EM LOW POLY (05/11/2026, pedido dele: "crie uma versão piloto do quarto em low poly e use o coelho 3D
 * para testar"). Uma página de teste, fora do app, para comparar com o quarto de pixel art (`e2e/pixel-art/quarto/novo/`).
 *
 * - Os móveis são do KayKit Furniture Bits, de Kay Lousberg (versão grátis, CC0: `modelos/LICENCA-KayKit.txt`). O que o
 *   pacote não tem — paredes, chão, janela, computador — é feito aqui por código, nas mesmas cores chapadas.
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
const ALTURA_DO_COELHO = 1.1;
const ALTURA_DA_PAREDE = 3;

type Lado = 0 | 1 | 2 | 3;
interface Movel {
  id: string;
  arquivo: string;
  x: number;
  z: number;
  lado: Lado;
  /** O que vai em cima (anda e gira junto): arquivo, ou 'monitor' (feito aqui), e o lugar no tampo, em casas. */
  cima?: { arquivo: string; dx: number; dz: number; giro?: number }[];
  /** Não ocupa a casa (o tapete): o coelho pisa. */
  chao?: boolean;
  /** Onde o coelho fica quando usa: deitar na cama, sentar na poltrona. */
  uso?: 'deitar' | 'sentar' | 'luz';
}

const ARRUMACAO: Movel[] = [
  { id: 'cama', arquivo: 'bed_double_A', x: 0, z: 0, lado: 0, uso: 'deitar' },
  { id: 'criado', arquivo: 'cabinet_small', x: 2, z: 0, lado: 0, cima: [{ arquivo: 'lamp_table', dx: 0, dz: 0 }], uso: 'luz' },
  { id: 'tapete', arquivo: 'rug_rectangle_stripes_A', x: 3, z: 3, lado: 0, chao: true },
  {
    id: 'mesa',
    arquivo: 'table_medium',
    x: 0,
    z: 5,
    lado: 1,
    cima: [
      { arquivo: 'monitor', dx: -0.15, dz: 0 },
      { arquivo: 'cactus_small_A', dx: 0.28, dz: 0.3 },
    ],
  },
  { id: 'cadeira', arquivo: 'chair_A', x: 2, z: 5, lado: 3, uso: 'sentar' },
  { id: 'armario', arquivo: 'cabinet_medium_decorated', x: 5, z: 0, lado: 0 },
  { id: 'poltrona', arquivo: 'armchair_pillows', x: 6, z: 5, lado: 3, uso: 'sentar' },
  { id: 'mesinha', arquivo: 'table_low', x: 4, z: 6, lado: 0, cima: [{ arquivo: 'book_set', dx: 0, dz: 0 }] },
  { id: 'luminaria', arquivo: 'lamp_standing', x: 7, z: 3, lado: 0, uso: 'luz' },
  { id: 'cacto', arquivo: 'cactus_medium_A', x: 7, z: 0, lado: 0 },
];

/** O que se pendura: na parede do fundo (z = 0) ou na da esquerda (x = 0), em `u` casas ao longo dela e `y` de altura. */
const NA_PAREDE: { arquivo: string; parede: 'fundo' | 'esquerda'; u: number; y: number }[] = [
  { arquivo: 'shelf_B_large_decorated', parede: 'esquerda', u: 5.4, y: 1.55 },
  { arquivo: 'pictureframe_large_A', parede: 'fundo', u: 1.1, y: 1.75 },
  { arquivo: 'pictureframe_small_A', parede: 'fundo', u: 2.0, y: 1.95 },
  { arquivo: 'pictureframe_small_B', parede: 'fundo', u: 2.05, y: 1.45 },
  { arquivo: 'pictureframe_medium', parede: 'fundo', u: 6.3, y: 1.8 },
  { arquivo: 'shelf_A_big', parede: 'esquerda', u: 1.4, y: 1.7 },
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
const ceu = new THREE.HemisphereLight('#fff3e0', '#8a6a55', 1.1);
const sol = new THREE.DirectionalLight('#ffe2b8', 3.2);
sol.position.set(-9, 7, 3.2);
sol.target.position.set(3, 0, 3.4);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
sol.shadow.bias = -0.0006;
sol.shadow.normalBias = 0.03;
cena.add(ceu, sol, sol.target);
const preenche = new THREE.DirectionalLight('#d8e4ff', 0.5);
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

const corDaParede = new THREE.MeshStandardMaterial({ color: '#e9d2b4', roughness: 0.95 });
const corDoLambri = new THREE.MeshStandardMaterial({ color: '#a8735a', roughness: 0.8 });
const corDoRodape = new THREE.MeshStandardMaterial({ color: '#7a5040', roughness: 0.8 });
function bloco(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = sombra;
  m.receiveShadow = true;
  cena.add(m);
  return m;
}
const E = 0.2; // espessura
// a parede do fundo (z = 0), inteira
bloco(N + E, ALTURA_DA_PAREDE, E, corDaParede, N / 2 - E / 2, ALTURA_DA_PAREDE / 2, -E / 2);
bloco(N, 0.9, 0.04, corDoLambri, N / 2, 0.45, 0.02, false);
bloco(N, 0.08, 0.06, corDoRodape, N / 2, 0.92, 0.03, false);
// a parede da esquerda (x = 0), com o VÃO da janela: o sol entra por ele
const J = { z0: 2.6, z1: 4.2, y0: 1.05, y1: 2.35 };
bloco(E, ALTURA_DA_PAREDE, J.z0, corDaParede, -E / 2, ALTURA_DA_PAREDE / 2, J.z0 / 2);
bloco(E, ALTURA_DA_PAREDE, N - J.z1, corDaParede, -E / 2, ALTURA_DA_PAREDE / 2, (J.z1 + N) / 2);
bloco(E, J.y0, J.z1 - J.z0, corDaParede, -E / 2, J.y0 / 2, (J.z0 + J.z1) / 2);
bloco(E, ALTURA_DA_PAREDE - J.y1, J.z1 - J.z0, corDaParede, -E / 2, (J.y1 + ALTURA_DA_PAREDE) / 2, (J.z0 + J.z1) / 2);
bloco(0.04, 0.9, J.z0, corDoLambri, 0.02, 0.45, J.z0 / 2, false);
bloco(0.04, 0.9, N - J.z1, corDoLambri, 0.02, 0.45, (J.z1 + N) / 2, false);
bloco(0.04, 0.9, J.z1 - J.z0, corDoLambri, 0.02, 0.45, (J.z0 + J.z1) / 2, false);
bloco(0.06, 0.08, N, corDoRodape, 0.03, 0.92, N / 2, false);
// a janela: moldura, cruz, peitoril, e o vidro (o céu lá fora)
const madeira = new THREE.MeshStandardMaterial({ color: '#f1e6d2', roughness: 0.7 });
const meioZ = (J.z0 + J.z1) / 2;
const meioY = (J.y0 + J.y1) / 2;
bloco(0.16, 0.08, J.z1 - J.z0 + 0.16, madeira, 0, J.y1 + 0.04, meioZ);
bloco(0.24, 0.07, J.z1 - J.z0 + 0.3, madeira, 0.04, J.y0 - 0.035, meioZ);
bloco(0.16, J.y1 - J.y0, 0.08, madeira, 0, meioY, J.z0 - 0.04);
bloco(0.16, J.y1 - J.y0, 0.08, madeira, 0, meioY, J.z1 + 0.04);
bloco(0.06, J.y1 - J.y0, 0.05, madeira, -0.02, meioY, meioZ);
bloco(0.06, 0.05, J.z1 - J.z0, madeira, -0.02, meioY, meioZ);
const vidro = new THREE.Mesh(
  new THREE.PlaneGeometry(J.z1 - J.z0, J.y1 - J.y0),
  new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.25, depthWrite: false }),
);
vidro.rotation.y = Math.PI / 2;
vidro.position.set(-0.03, meioY, meioZ);
cena.add(vidro);
// lá fora: um céu e um morro, atrás da janela
const fora = new THREE.Mesh(new THREE.PlaneGeometry(J.z1 - J.z0 + 0.6, J.y1 - J.y0 + 0.6), new THREE.MeshBasicMaterial({ color: '#a8dcf5' }));
fora.rotation.y = Math.PI / 2;
fora.position.set(-0.6, meioY, meioZ);
cena.add(fora);
const morro = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: '#86c06a' }));
morro.scale.set(0.05, 0.55, 1.1);
morro.position.set(-0.5, J.y0 - 0.1, meioZ + 0.3);
cena.add(morro);

// ---- os modelos ----
const carregador = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const modelo = (nome: string) => {
  if (!cache.has(nome)) cache.set(nome, carregador.loadAsync(`${MODELOS}${nome}${nome.endsWith('.glb') ? '' : '.gltf'}`));
  return cache.get(nome)!;
};

/** O monitor do computador, que o pacote não tem: caixas na cor dele. */
function monitor(): THREE.Object3D {
  const g = new THREE.Group();
  const escuro = new THREE.MeshStandardMaterial({ color: '#3d3540', roughness: 0.6 });
  const tela = new THREE.MeshStandardMaterial({ color: '#2a3550', emissive: '#6fb6ff', emissiveIntensity: 0.15 });
  const pe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), escuro);
  const haste = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), escuro);
  haste.position.set(0, 0.09, -0.03);
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.04), escuro);
  caixa.position.set(0, 0.3, -0.02);
  const vidro = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), tela);
  vidro.position.set(0, 0.3, 0.001);
  vidro.userData.tela = true;
  const teclado = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.1), new THREE.MeshStandardMaterial({ color: '#e8e0d4' }));
  teclado.position.set(0, 0.01, 0.17);
  g.add(pe, haste, caixa, vidro, teclado);
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

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

function caber(o: THREE.Object3D) {
  const caixa = new THREE.Box3().setFromObject(o);
  return { caixa, tam: caixa.getSize(new THREE.Vector3()) };
}
/** Uma cópia com materiais próprios (para destacar só este). */
function copia(g: GLTF) {
  const o = g.scene.clone(true);
  const mats: THREE.MeshStandardMaterial[] = [];
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh) return;
    m.material = (m.material as THREE.MeshStandardMaterial).clone();
    mats.push(m.material as THREE.MeshStandardMaterial);
    m.castShadow = true;
    m.receiveShadow = true;
  });
  return { o, mats };
}

async function montarMovel(m: Movel): Promise<Pronto> {
  const { o, mats } = copia(await modelo(m.arquivo));
  o.scale.setScalar(S);
  const { caixa, tam } = caber(o);
  // centrado na própria pegada, com a base no chão
  const c = caixa.getCenter(new THREE.Vector3());
  o.position.set(-c.x, -caixa.min.y, -c.z);
  const giro = new THREE.Group();
  giro.add(o);
  const raiz = new THREE.Group();
  raiz.add(giro);
  raiz.userData.movel = m.id;
  const w = Math.max(1, Math.round(tam.x));
  const d = Math.max(1, Math.round(tam.z));
  const p: Pronto = { m, raiz, giro, w, d, altura: tam.y, materiais: mats };
  for (const c2 of m.cima ?? []) {
    let peca: THREE.Object3D;
    if (c2.arquivo === 'monitor') peca = monitor();
    else {
      const x = copia(await modelo(c2.arquivo));
      x.o.scale.setScalar(S);
      const b = caber(x.o);
      const cc = b.caixa.getCenter(new THREE.Vector3());
      x.o.position.set(-cc.x, -b.caixa.min.y, -cc.z);
      peca = new THREE.Group().add(x.o);
      p.materiais.push(...x.mats);
    }
    peca.position.set(c2.dx, tam.y, c2.dz);
    peca.rotation.y = c2.giro ?? 0;
    giro.add(peca);
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
}
let coelho: Coelho | null = null;

async function montarCoelho() {
  const g = await modelo('coelho.glb');
  const o = g.scene.clone(true);
  const { caixa, tam } = caber(o);
  o.scale.setScalar(ALTURA_DO_COELHO / tam.y);
  const c = caixa.getCenter(new THREE.Vector3()).multiplyScalar(ALTURA_DO_COELHO / tam.y);
  o.position.set(-c.x, -caixa.min.y * (ALTURA_DO_COELHO / tam.y), -c.z);
  o.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) x.castShadow = x.receiveShadow = true;
  });
  const corpo = new THREE.Group().add(o);
  const raiz = new THREE.Group().add(corpo);
  const casa: [number, number] = [3, 6];
  raiz.position.set(casa[0] + 0.5, 0, casa[1] + 0.5);
  cena.add(raiz);
  coelho = { raiz, corpo, casa, caminho: [], de: raiz.position.clone(), para: raiz.position.clone(), inicio: 0, duracao: 0, arco: 0, rumo: 0, pose: 'pe', depois: null };
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
    c.corpo.rotation.set(0, 0, 0);
    const sai = livreMaisPerto(c.raiz.position.x, c.raiz.position.z, cheias)!;
    c.casa = sai;
    pular(new THREE.Vector3(sai[0] + 0.5, 0, sai[1] + 0.5), 420, 0.5);
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
      situacao(p.luz && p.luz.intensity > 0 ? 'Acendeu.' : 'Apagou.');
      c.rumo = Math.atan2(cx - c.raiz.position.x, cz - c.raiz.position.z);
      return;
    }
    const rumo = -p.m.lado * (Math.PI / 2);
    if (p.m.uso === 'deitar') {
      // em cima do colchão, de barriga para cima, a cabeça no travesseiro (a cabeceira é o fundo do móvel)
      const alto = p.altura * 0.62;
      const ponto = new THREE.Vector3(cx, alto, cz).add(new THREE.Vector3(frente[0], 0, frente[1]).multiplyScalar(0.42));
      pular(ponto, 520, 0.6);
      c.pose = 'deitado';
      // de costas: o pé para o lado da frente da cama, a cabeça cai para a cabeceira
      c.rumo = rumo;
      situacao('Deitou.');
    } else {
      const assento = p.m.arquivo.startsWith('armchair') ? 0.33 : 0.4;
      const ponto = new THREE.Vector3(cx, assento * S * 1.55, cz).add(new THREE.Vector3(frente[0], 0, frente[1]).multiplyScalar(0.05));
      pular(ponto, 420, 0.4);
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
  if (p && p.m.uso) return usar(p);
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
  situacao('Toque no chão para andar; na cama, na cadeira ou na poltrona para usar; no abajur e na luminária para acender.');
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
  const t = relogio.getElapsed();
  const agora = performance.now();
  const c = coelho;
  if (c) {
    const f = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
    if (f >= 1 && c.caminho.length) {
      const [x, z] = c.caminho.shift()!;
      c.casa = [x, z];
      pular(new THREE.Vector3(x + 0.5, 0, z + 0.5), 230, 0.16);
    } else if (f >= 1 && c.depois) {
      const d = c.depois;
      c.depois = null;
      d();
    }
    const g = c.duracao ? Math.min(1, (agora - c.inicio) / c.duracao) : 1;
    const e = g * g * (3 - 2 * g);
    c.raiz.position.lerpVectors(c.de, c.para, e);
    const alt = g < 1 ? Math.sin(Math.PI * g) * c.arco : 0;
    c.raiz.position.y += alt;
    const pouso = g >= 1 ? Math.max(0, 1 - (agora - c.inicio - c.duracao) / 150) : 0;
    const respira = Math.sin(t * 2.2) * 0.015;
    const estica = g < 1 && c.arco > 0 ? 0.1 * Math.sin(Math.PI * g) : -0.14 * pouso + respira;
    c.corpo.scale.set(1 - estica * 0.5, 1 + estica, 1 - estica * 0.5);
    let delta = c.rumo - c.corpo.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    c.corpo.rotation.y += delta * 0.25;
    // deitado: o corpo inteiro de costas, a cabeça para o fundo do móvel
    const quer = c.pose === 'deitado' && g > 0.6 ? -Math.PI / 2 : c.pose === 'sentado' && g > 0.6 ? -0.12 : 0;
    c.corpo.rotation.x += (quer - c.corpo.rotation.x) * 0.2;
    c.corpo.rotation.order = 'YXZ';
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

// ---- montar ----
(async () => {
  situacao('Carregando…');
  for (const m of ARRUMACAO) moveis.push(await montarMovel(m));
  for (const q of NA_PAREDE) {
    const { o } = copia(await modelo(q.arquivo));
    o.scale.setScalar(S);
    const g = new THREE.Group().add(o);
    if (q.parede === 'fundo') g.position.set(q.u, q.y, 0.01);
    else {
      g.rotation.y = Math.PI / 2;
      g.position.set(0.01, q.y, q.u);
    }
    cena.add(g);
  }
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
