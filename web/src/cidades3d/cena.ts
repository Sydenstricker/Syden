import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { carregarModelo as carregarDaMesa } from '../mesa3d/base';
import { copiarCoelho, type MaterialDoCoelho } from '../coelho3d';

/**
 * O TABULEIRO 3D DO CIDADES À VENDA (05/11/2026, pedido dele: "3D cartoon fofo, similar ao Mario Party, com os assets da
 * pasta assets; o nosso coelho 3D como personagem jogável"). Só a TELA: o servidor continua decidindo tudo, e o desenho em
 * SVG de JogoCidades.tsx fica de reserva (sem WebGL, ou enquanto isto carrega).
 *
 * CADA CASA É UM LOTE VIVO (05/11/2026, pedido dele: "quadros mais dinâmicos e representativos, com mais vida"):
 * - O lote tem a CALÇADA (o lugar dos coelhos, com o meio-fio na cor do grupo) e o QUINTAL, e o que está no quintal conta a
 *   casa: à venda, o terreno demarcado e a placa com o preço; comprada, a cerca e a bandeira na cor do dono; de 1 a 3
 *   prédios, 1 a 3 casinhas (uma solta fumaça); com 4, o hotel. Os transportes têm o veículo (a van na rodoviária, o
 *   rebocador no porto, o avião no aeroporto, o trem na ferrovia), e as outras casas um objeto que diga o que são (a banca
 *   da notícia, a cancela do pedágio, os carros parados do engarrafamento, a praia do feriado, o pórtico da largada).
 * - Nas fileiras de cima e de baixo a calçada fica ao SUL do quintal (do lado da câmera), e a placa no fundo, inclinada
 *   para a câmera: nada fica entre a câmera e os coelhos, e a sigla e o preço continuam legíveis (pintados por código:
 *   nomes próprios e números, nada a traduzir).
 * - A vida é barata: a bandeira ondula no shader (um material por cor de dono), a fumaça é uma malha instanciada, os
 *   carros dão a volta na rua do miolo, as árvores balançam, o prédio novo nasce com um pulo e o lote de quem está na vez
 *   acende. Com "menos movimento" no sistema, tudo parado.
 * - Os modelos são da Kenney (CC0, web/public/cidades3d/<kit>/License.txt; o crédito nos termos, seção 10).
 * - No meio, um trem dá a volta numa linha, e a rua dos carros em volta dele.
 * - Cada pessoa é o MASCOTE 3D com o NOSSO esqueleto (coelho-animado.glb, de e2e/pixel-art/personagem/blender/meshy/glb.py),
 *   com o pelo e o moletom trocados pelas cores dela — a troca de paleta do kart, aqui no shader. Ele PULA casa a casa.
 * - A câmera mostra o tabuleiro inteiro e chega perto de quem anda. Sem foco na janela, nada é desenhado (o uso principal é
 *   com um jogo aberto); as sombras de verdade só com "Sombras" ligado em Gráficos, e senão uma sombra redonda por coelho.
 */

export interface CasaDaCena {
  tipo: string;
  nome?: string;
  uf?: string;
  grupo?: number;
  preco?: number;
}
export interface PosseDaCena {
  casa: number;
  dono: number;
  predios: number;
  hipotecada: boolean;
}
export interface PecaDaCena {
  userId: number;
  /** A casa onde a peça está AGORA na tela (o andar casa a casa já vem contado de fora). */
  pos: number;
  pelo: string;
  roupa: string;
  vez: boolean;
  presente: boolean;
}
export interface DadosDaCena {
  casas: CasaDaCena[];
  posses: PosseDaCena[];
  pecas: PecaDaCena[];
  escolhida: number | null;
  /** A cor de cada dono (a roupa dele). */
  corDe: (userId: number) => string;
  cores: string[];
  icones: Record<string, string>;
  /** Os dados da última jogada (o id troca a cada jogada: o mesmo par duas vezes rola de novo), ou null. */
  dados?: { id: number; valores: [number, number] } | null;
}

const BASE = `${import.meta.env.BASE_URL}cidades3d/`;
const COLUNAS = 10;
const LINHAS = 8;
/** A largura de uma casa do meio, ao longo da volta. */
const LARGURA = 0.95;
/** A profundidade de todo lote (da beira para dentro), que é também o lado de uma casa do canto. */
const FUNDO = 1.5;
/** A calçada, a faixa do lote onde ficam os coelhos. */
const CALCADA = 0.46;
const X0 = ((COLUNAS - 2) * LARGURA + 2 * FUNDO) / 2;
const Z0 = ((LINHAS - 2) * LARGURA + 2 * FUNDO) / 2;
const ALTURA_DO_LOTE = 0.12;
const ALTURA_DO_COELHO = 0.74;
/** Quantos pixels por unidade no chão pintado de cada lote. */
const PPU = 128;
/**
 * A placa, quase deitada (uns 20° do chão): a câmera olha a uns 49° de cima, então ela continua de frente para quem olha, e baixa
 * o bastante para não tampar o lote de trás (nas colunas, um lote fica atrás do outro na direção da câmera).
 */
const LARGURA_DA_PLACA = 0.66;
const ALTURA_DA_PLACA = 0.38;
const INCLINACAO_DA_PLACA = 1.2;

const CASAS_DO_SUBURBIO = ['a', 'c', 'e', 'g', 'j', 'm', 'p', 's'].map((l) => `suburbio/building-type-${l}.glb`);
const HOTEIS = ['comercio/building-l.glb', 'comercio/building-j.glb'];
const ARVORES = ['suburbio/tree-large.glb', 'suburbio/tree-small.glb'];
const CARROS = ['carros/sedan.glb', 'carros/taxi.glb', 'carros/suv.glb', 'carros/van.glb', 'carros/delivery.glb'];
const TODOS = [
  'coelho-animado.glb',
  ...CASAS_DO_SUBURBIO,
  ...HOTEIS,
  ...ARVORES,
  ...CARROS,
  'carros/cone.glb',
  'barcos/boat-tug-a.glb',
  'barcos/buoy-flag.glb',
  'suburbio/planter.glb',
  'comercio/detail-parasol-a.glb',
  'comercio/detail-parasol-b.glb',
  'comercio/detail-awning.glb',
  'trem/railroad-straight.glb',
  'trem/train-locomotive-a.glb',
  'trem/train-carriage-box.glb',
  'trem/train-carriage-container-red.glb',
];

const carregados = new Map<string, Promise<GLTF>>();
export function carregar(arquivo: string): Promise<GLTF> {
  let p = carregados.get(arquivo);
  if (!p) {
    p = new GLTFLoader().loadAsync(BASE + arquivo);
    carregados.set(arquivo, p);
    p.catch(() => carregados.delete(arquivo));
  }
  return p;
}

/** A casa `i` (0 a 31) na grade: a mesma volta de lugarDaCasaDasCidades. */
function colunaLinha(i: number): [number, number] {
  if (i <= 9) return [i, 0];
  if (i <= 16) return [9, i - 9];
  if (i <= 25) return [25 - i, 7];
  return [0, 32 - i];
}
function centroNaLinha(k: number, n: number, metade: number) {
  if (k === 0) return -metade + FUNDO / 2;
  if (k === n - 1) return metade - FUNDO / 2;
  return -metade + FUNDO + (k - 0.5) * LARGURA;
}

interface Ret {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
/** A planta de um lote, nas coordenadas dele (o centro do lote é a origem). */
interface Planta {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  canto: boolean;
  calcada: Ret;
  /** O que a cerca cerca. */
  quintal: Ret;
  /** Onde fica o que se constrói: o quintal, menos a faixa da placa. */
  area: Ret;
  placa: [number, number];
  /** Para onde o que se constrói olha (a rua). */
  rumo: number;
  /** O lado do quintal que dá para a calçada (o portão). */
  portao: 'x0' | 'x1' | 'z1';
}
function plantaDoLote(i: number): Planta {
  const [c, l] = colunaLinha(i);
  const pontaC = c === 0 || c === COLUNAS - 1;
  const pontaL = l === 0 || l === LINHAS - 1;
  const hx = (pontaC ? FUNDO : LARGURA) / 2;
  const hz = (pontaL ? FUNDO : LARGURA) / 2;
  const canto = pontaC && pontaL;
  const S = CALCADA;
  let calcada: Ret;
  let quintal: Ret;
  let rumo = 0;
  let portao: Planta['portao'];
  if (pontaL && !canto) {
    // as fileiras de cima e de baixo: a calçada ao sul (o lado da câmera), o quintal ao norte
    calcada = { x0: -hx, x1: hx, z0: hz - S, z1: hz };
    quintal = { x0: -hx, x1: hx, z0: -hz, z1: hz - S };
    portao = 'z1';
  } else {
    // as colunas e os cantos: a calçada do lado de dentro da volta (no canto, só o quadrado de dentro, ao sul)
    const leste = c === 0;
    calcada = leste ? { x0: hx - S, x1: hx, z0: canto ? hz - S : -hz, z1: hz } : { x0: -hx, x1: -hx + S, z0: canto ? hz - S : -hz, z1: hz };
    quintal = leste ? { x0: -hx, x1: hx - S, z0: -hz, z1: hz } : { x0: -hx + S, x1: hx, z0: -hz, z1: hz };
    if (!canto) rumo = leste ? Math.PI / 2 : -Math.PI / 2;
    portao = leste ? 'x1' : 'x0';
  }
  // nas colunas, uma folga ao sul: ali começa a placa do lote da frente
  const area = { x0: quintal.x0, x1: quintal.x1, z0: -hz + 0.42, z1: quintal.z1 - (pontaL ? 0 : 0.07) };
  return {
    cx: centroNaLinha(c, COLUNAS, X0),
    cz: centroNaLinha(l, LINHAS, Z0),
    hx,
    hz,
    canto,
    calcada,
    quintal,
    area,
    placa: [(quintal.x0 + quintal.x1) / 2, -hz + 0.21],
    rumo,
    portao,
  };
}
const PLANTAS = Array.from({ length: 32 }, (_, i) => plantaDoLote(i));

/** O lugar dos coelhos na casa `i`: o meio da calçada. */
export function centroDaCasa(i: number): THREE.Vector3 {
  const p = PLANTAS[i];
  return new THREE.Vector3(p.cx + (p.calcada.x0 + p.calcada.x1) / 2, ALTURA_DO_LOTE, p.cz + (p.calcada.z0 + p.calcada.z1) / 2);
}

/** Uma cópia do modelo com a base no chão, centrada, com `largura` no maior lado do chão (e no máximo `altura` de alto). */
export function copia(g: GLTF, largura: number, sombra: boolean, altura = Infinity): THREE.Object3D {
  const o = g.scene.clone(true);
  const caixa = new THREE.Box3().setFromObject(o);
  const tam = caixa.getSize(new THREE.Vector3());
  const s = Math.min(largura / Math.max(tam.x, tam.z, 1e-6), altura / Math.max(tam.y, 1e-6));
  const centro = caixa.getCenter(new THREE.Vector3());
  const raiz = new THREE.Group();
  o.position.set(-centro.x, -caixa.min.y, -centro.z);
  raiz.add(o);
  raiz.scale.setScalar(s);
  raiz.userData.altura = tam.y * s;
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = sombra;
      m.receiveShadow = sombra;
    }
  });
  return raiz;
}

/** Peças feitas por código, juntas numa geometria só, com a cor em cada vértice: um objeto, uma chamada de desenho. */
export type Bloco = { geo: THREE.BufferGeometry; x: number; y: number; z: number; cor: string; rx?: number; ry?: number; rz?: number };
export function juntar(blocos: Bloco[]): THREE.BufferGeometry {
  const partes = blocos.map((b) => {
    const g = b.geo.clone();
    if (b.rx) g.rotateX(b.rx);
    if (b.rz) g.rotateZ(b.rz);
    if (b.ry) g.rotateY(b.ry);
    g.translate(b.x, b.y, b.z);
    const c = new THREE.Color(b.cor);
    const n = g.attributes.position.count;
    const cores = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) cores.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    for (const nome of Object.keys(g.attributes)) if (nome !== 'position' && nome !== 'normal' && nome !== 'color') g.deleteAttribute(nome);
    return g.index ? g.toNonIndexed() : g;
  });
  const junta = mergeGeometries(partes) ?? new THREE.BufferGeometry();
  for (const p of partes) p.dispose();
  for (const b of blocos) b.geo.dispose();
  return junta;
}
export const caixa = (w: number, h: number, d: number, x: number, y: number, z: number, cor: string, ry = 0): Bloco => ({ geo: new THREE.BoxGeometry(w, h, d), x, y: y + h / 2, z, cor, ry });

const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};
export function textura(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** O chão de cada tipo de quintal. */
function chaoDe(casa: CasaDaCena): string {
  if (casa.tipo === 'cidade') return '#93d36f';
  if (casa.tipo === 'transporte') return casa.nome === 'porto' ? '#5fb6d6' : casa.nome === 'ferrovia' ? '#c9b48f' : '#7f838c';
  if (casa.tipo === 'feriado') return '#f1d796';
  if (casa.tipo === 'pedagio' || casa.tipo === 'engarrafamento') return '#7f838c';
  if (casa.tipo === 'noticia') return '#e9d8b8';
  return '#93d36f';
}

/** O chão do lote, pintado: o quintal do tipo, a calçada, o meio-fio na cor do grupo; a borda na cor do dono. */
function pintarChao(pl: Planta, casa: CasaDaCena, posse: PosseDaCena | undefined, d: DadosDaCena, escolhida: boolean): THREE.CanvasTexture {
  const W = Math.round(pl.hx * 2 * PPU);
  const H = Math.round(pl.hz * 2 * PPU);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const X = (x: number) => (x + pl.hx) * PPU;
  const Z = (z: number) => (z + pl.hz) * PPU;
  const chao = chaoDe(casa);
  g.fillStyle = chao;
  g.fillRect(0, 0, W, H);
  const q = pl.quintal;
  const qx = X(q.x0);
  const qz = Z(q.z0);
  const qw = (q.x1 - q.x0) * PPU;
  const qh = (q.z1 - q.z0) * PPU;
  if (chao === '#93d36f') {
    // a grama cortada em faixas
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 12);
  } else if (casa.nome === 'porto') {
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const x = qx + ((k * 37) % Math.max(1, qw - 20)) + 6;
      const y = qz + ((k * 53) % Math.max(1, qh - 10)) + 5;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 7, y - 5, x + 14, y);
      g.stroke();
    }
  } else if (chao === '#7f838c') {
    // o asfalto: a faixa do meio, tracejada
    g.strokeStyle = 'rgba(255,240,200,0.75)';
    g.lineWidth = 4;
    g.setLineDash([12, 10]);
    g.beginPath();
    if (casa.nome === 'aeroporto' || pl.portao === 'z1') {
      g.moveTo(qx + 6, qz + qh * 0.62);
      g.lineTo(qx + qw - 6, qz + qh * 0.62);
    } else {
      g.moveTo(qx + qw / 2, qz + 6);
      g.lineTo(qx + qw / 2, qz + qh - 6);
    }
    g.stroke();
    g.setLineDash([]);
  } else if (casa.nome === 'ferrovia') {
    g.fillStyle = 'rgba(90,70,50,0.18)';
    for (let k = 0; k < 60; k++) g.fillRect(qx + ((k * 29) % qw), qz + ((k * 47) % qh), 4, 4);
  } else if (casa.tipo === 'feriado') {
    // a areia, e a água na ponta
    g.fillStyle = '#7cc6dc';
    g.beginPath();
    g.ellipse(qx + qw, qz, qw * 0.55, qh * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(qx + qw, qz, qw * 0.57, qh * 0.42, 0, Math.PI * 0.5, Math.PI);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.stroke();
  }
  if (casa.tipo === 'largada') {
    // a faixa quadriculada da largada, no quintal
    const t = 12;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x * t < qw; x++) {
        g.fillStyle = (x + y) % 2 ? '#fffaf0' : '#3a3434';
        g.fillRect(qx + x * t, qz + qh * 0.62 + y * t, t, t);
      }
  }
  // a calçada, com as juntas
  const k = pl.calcada;
  const kx = X(k.x0);
  const kz = Z(k.z0);
  const kw = (k.x1 - k.x0) * PPU;
  const kh = (k.z1 - k.z0) * PPU;
  g.fillStyle = '#efe5d2';
  g.fillRect(kx, kz, kw, kh);
  g.strokeStyle = 'rgba(160,140,110,0.28)';
  g.lineWidth = 2;
  for (let x = kx + 30; x < kx + kw; x += 30) {
    g.beginPath();
    g.moveTo(x, kz);
    g.lineTo(x, kz + kh);
    g.stroke();
  }
  for (let y = kz + 30; y < kz + kh; y += 30) {
    g.beginPath();
    g.moveTo(kx, y);
    g.lineTo(kx + kw, y);
    g.stroke();
  }
  // o meio-fio, na cor do grupo, do lado do quintal (no canto, também o de cima)
  const meioFio = casa.tipo === 'cidade' ? d.cores[casa.grupo ?? 0] : '#cbbda3';
  const largura = casa.tipo === 'cidade' ? 16 : 7;
  g.fillStyle = meioFio;
  if (pl.portao === 'z1') g.fillRect(kx, kz, kw, largura);
  else if (pl.portao === 'x1') g.fillRect(kx, kz, largura, kh);
  else g.fillRect(kx + kw - largura, kz, largura, kh);
  if (pl.canto) g.fillRect(kx, kz, kw, largura);
  if (posse) {
    g.lineWidth = 9;
    g.strokeStyle = d.corDe(posse.dono);
    g.strokeRect(5, 5, W - 10, H - 10);
  }
  if (escolhida) {
    g.lineWidth = 7;
    g.strokeStyle = '#fff7e0';
    g.strokeRect(14, 14, W - 28, H - 28);
  }
  if (posse?.hipotecada) {
    g.fillStyle = 'rgba(110,104,100,0.5)';
    g.fillRect(0, 0, W, H);
  }
  return textura(c);
}

/** A placa: a sigla e o preço da cidade (ou o ícone da casa), com a moldura na cor do dono. */
function pintarPlaca(casa: CasaDaCena, posse: PosseDaCena | undefined, d: DadosDaCena): THREE.CanvasTexture {
  const L = 264;
  const A = 152;
  const c = document.createElement('canvas');
  c.width = L;
  c.height = A;
  const g = c.getContext('2d')!;
  const cidade = casa.tipo === 'cidade';
  g.fillStyle = cidade ? d.cores[casa.grupo ?? 0] : '#fbf3e2';
  roundRect(g, 4, 4, L - 8, A - 8, 22);
  g.fill();
  const brilho = g.createLinearGradient(0, 0, 0, A);
  brilho.addColorStop(0, 'rgba(255,255,255,0.3)');
  brilho.addColorStop(0.6, 'rgba(255,255,255,0)');
  g.fillStyle = brilho;
  g.fill();
  g.lineWidth = posse ? 14 : 6;
  g.strokeStyle = posse ? d.corDe(posse.dono) : 'rgba(80,60,40,0.45)';
  roundRect(g, posse ? 9 : 5, posse ? 9 : 5, L - (posse ? 18 : 10), A - (posse ? 18 : 10), 18);
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const preco = casa.preco !== undefined && !posse ? String(casa.preco) : '';
  if (cidade) {
    g.font = '900 84px system-ui, sans-serif';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(40,30,30,0.55)';
    const y = preco || (posse && posse.predios) ? A * 0.4 : A * 0.52;
    g.strokeText(casa.uf ?? '', L / 2, y);
    g.fillStyle = '#fffaf0';
    g.fillText(casa.uf ?? '', L / 2, y);
  } else {
    const icone = d.icones[casa.tipo === 'transporte' ? (casa.nome ?? '') : casa.tipo] ?? '';
    // a seta da largada não é emoji: vai na letra comum, grossa
    const emoji = /\p{Extended_Pictographic}/u.test(icone);
    g.font = emoji ? '76px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' : '900 92px system-ui, sans-serif';
    g.fillStyle = '#5a4a3a';
    g.fillText(icone, L / 2, preco ? A * 0.4 : A * 0.52);
  }
  if (preco) {
    g.font = '800 38px system-ui, sans-serif';
    const w = g.measureText(preco).width + 30;
    g.fillStyle = 'rgba(255,250,240,0.92)';
    roundRect(g, L / 2 - w / 2, A * 0.66, w, 42, 21);
    g.fill();
    g.fillStyle = '#3a2e26';
    g.fillText(preco, L / 2, A * 0.66 + 22);
  } else if (posse && posse.predios > 0) {
    // os prédios, em quadradinhos (o quarto é o hotel: maior)
    const n = posse.predios;
    for (let k = 0; k < n; k++) {
      const s = n >= 4 ? 30 : 24;
      const x = L / 2 - (n * (s + 8)) / 2 + k * (s + 8) + 4;
      g.fillStyle = '#fffaf0';
      g.strokeStyle = 'rgba(40,30,30,0.7)';
      g.lineWidth = 4;
      g.fillRect(x, A * 0.68, s, s);
      g.strokeRect(x, A * 0.68, s, s);
    }
  }
  if (posse?.hipotecada) {
    g.fillStyle = 'rgba(110,104,100,0.6)';
    roundRect(g, 4, 4, L - 8, A - 8, 22);
    g.fill();
  }
  return textura(c);
}


/** O dado do KayKit tem 0,75 de lado; no meio do tabuleiro, um pouco menor que uma casa. */
const ESCALA_DO_DADO = 0.6;
const DURACAO_DO_DADO = 950;
const PARADA_DO_DADO = [new THREE.Vector3(-0.3, 0.03 + 0.375 * ESCALA_DO_DADO, 0.2), new THREE.Vector3(0.34, 0.03 + 0.375 * ESCALA_DO_DADO, 0.08)];
/**
 * O giro que põe cada número para cima (o +y). Medido no modelo D6_A (foto de conferência das seis faces): o 6 está no +y, o 1
 * no -y, o 2 no +x, o 5 no -x, o 3 no +z e o 4 no -z.
 */
export const FACE_PARA_CIMA: Record<number, THREE.Quaternion> = {
  1: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
  2: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
  3: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
  4: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
  5: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
  6: new THREE.Quaternion(),
};

/** O pulo de quem nasce: de nada a um pouco maior, e de volta ao tamanho (o "easeOutBack"). */
const PULO_MS = 650;
function crescer(f: number) {
  const c1 = 2.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(f - 1, 3) + c1 * Math.pow(f - 1, 2);
}

interface Peca {
  raiz: THREE.Group;
  corpo: THREE.Object3D;
  sombra: THREE.Mesh;
  marca: THREE.Mesh;
  mat: MaterialDoCoelho;
  descartar: () => void;
  casa: number;
  de: THREE.Vector3;
  para: THREE.Vector3;
  inicio: number;
  duracao: number;
  rumo: number;
  pelo: string;
  roupa: string;
  mixer: THREE.AnimationMixer;
  acoes: Map<string, THREE.AnimationAction>;
  tocando: string;
}

/** O que mora num lote e se refaz quando a casa muda. */
interface Conteudo {
  grupo: THREE.Group;
  descartar: { dispose(): void }[];
  /** As animações baratas do lote (a cancela, o barco, os carros parados), pelo tempo da cena. */
  animar: ((t: number) => void)[];
  /** De onde sai fumaça (nas coordenadas do lote). */
  fumaca: THREE.Vector3[];
}
interface Lote {
  i: number;
  pl: Planta;
  grupo: THREE.Group;
  matChao: THREE.MeshStandardMaterial;
  matPlaca: THREE.MeshBasicMaterial;
  chaveChao: string;
  chavePlaca: string;
  chaveConteudo: string;
  conteudo: Conteudo | null;
  /** Quando o que se construiu apareceu (para o pulo), ou 0. */
  nasceu: number;
  subida: number;
}

export class CenaDasCidades {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1.25, 0.1, 200);
  private alvo = new THREE.Vector3(0, 0, 0.25);
  private olhando = new THREE.Vector3(0, 0, 0.25);
  private distancia = 1;
  private modelos = new Map<string, GLTF>();
  private lotes: Lote[] = [];
  private pecas = new Map<number, Peca>();
  private trem: THREE.Object3D[] = [];
  private trilho: THREE.CatmullRomCurve3 | null = null;
  private carros: { obj: THREE.Object3D; curva: THREE.CatmullRomCurve3; u: number; vel: number }[] = [];
  private arvores: { obj: THREE.Object3D; fase: number }[] = [];
  private fumaca: THREE.InstancedMesh | null = null;
  private brilho: THREE.Mesh | null = null;
  private dados: DadosDaCena | null = null;
  private quadro = 0;
  private relogio = new THREE.Timer();
  private observador: ResizeObserver;
  private sombras: boolean;
  private calmo: boolean;
  private raio = new THREE.Raycaster();
  private apertou: { x: number; y: number } | null = null;
  private descartaveis: { dispose(): void }[] = [];
  private morta = false;
  private dadosNaMesa: THREE.Object3D[] = [];
  private rolagem: { id: number; inicio: number; de: THREE.Vector3[]; qFim: THREE.Quaternion[]; eixo: THREE.Vector3[] } | null = null;
  private dadoVisto: number | null | undefined = undefined;
  /** A cor em cada vértice, das peças feitas por código. */
  private matCor = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  private uTempo = { value: 0 };
  private panos = new Map<string, THREE.MeshStandardMaterial>();
  private geoPano = new THREE.PlaneGeometry(0.2, 0.12, 8, 2).translate(0.1, 0, 0);
  private geoPlaca = new THREE.PlaneGeometry(LARGURA_DA_PLACA, ALTURA_DA_PLACA);
  private geoPernas = juntar([caixa(0.03, 0.17, 0.03, -0.27, 0, -0.13, '#8a6a4c'), caixa(0.03, 0.17, 0.03, 0.27, 0, -0.13, '#8a6a4c')]);
  private geosDoLote = new Map<string, { laje: THREE.BufferGeometry; chao: THREE.BufferGeometry }>();
  private matLaje = new THREE.MeshStandardMaterial({ color: '#e7d8bb', roughness: 0.8 });
  /** O medidor do teste: quanto tempo cada quadro leva, em ms (os últimos 120). */
  private tempos: number[] = [];
  private congelada = false;
  /** Para a foto de conferência: olhar de perto um ponto do tabuleiro (x, z) a uma fração da distância. */
  focoDeTeste: { x: number; z: number; perto: number } | null = null;

  constructor(
    private caixa: HTMLElement,
    private aoEscolher: (i: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    let graficos: { sombras?: boolean } = {};
    try {
      graficos = JSON.parse(localStorage.getItem('syden:graficos') ?? '{}');
    } catch {
      /* fica sem */
    }
    this.sombras = !!graficos.sombras;
    this.calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer.shadowMap.enabled = this.sombras;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'cid-tabuleiro-3d-tela';
    caixa.appendChild(canvas);
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(caixa);
    this.medir();
    canvas.addEventListener('pointerdown', this.aoApertar);
    canvas.addEventListener('pointerup', this.aoSoltar);
    canvas.addEventListener('pointermove', this.aoPassar);
    this.descartaveis.push(this.matCor, this.geoPano, this.geoPlaca, this.geoPernas, this.matLaje);
    if (import.meta.env.DEV) (window as unknown as { cenaDasCidades?: CenaDasCidades }).cenaDasCidades = this;
  }

  /** Carrega os modelos e monta o que não muda. Rejeita se algo falhar (a tela fica no desenho de reserva). */
  async montar(): Promise<void> {
    const [lista, dado] = await Promise.all([Promise.all(TODOS.map((a) => carregar(a).then((g) => [a, g] as const))), carregarDaMesa('D6_A')]);
    if (this.morta) return;
    for (const [a, g] of lista) this.modelos.set(a, g);
    this.montarFixo();
    // os dois dados do meio (KayKit Board Game Bits, CC0, em web/public/mesa3d/)
    for (let k = 0; k < 2; k++) {
      const o = dado.scene.clone(true);
      o.scale.setScalar(ESCALA_DO_DADO);
      o.visible = false;
      o.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) m.castShadow = this.sombras;
      });
      this.cena.add(o);
      this.dadosNaMesa.push(o);
    }
    this.renderer.setAnimationLoop(this.desenhar);
  }

  private medir() {
    const w = Math.max(1, this.caixa.clientWidth);
    const h = Math.max(1, this.caixa.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // de longe o bastante para caber o tabuleiro inteiro, na largura e na altura
    this.distancia = Math.max(1, 1.25 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  private montarFixo() {
    const c = this.cena;
    c.background = new THREE.Color('#bfe4f2');
    c.fog = new THREE.Fog('#bfe4f2', 22, 42);
    const ceu = new THREE.HemisphereLight('#fff6e8', '#7fae6a', 1.6);
    c.add(ceu);
    const sol = new THREE.DirectionalLight('#fff1d6', 2.2);
    sol.position.set(-5, 11, 6);
    if (this.sombras) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      const s = sol.shadow.camera;
      s.left = -8;
      s.right = 8;
      s.top = 7;
      s.bottom = -7;
      s.near = 1;
      s.far = 30;
      sol.shadow.bias = -0.0008;
      sol.shadow.normalBias = 0.02;
    }
    c.add(sol);

    // a água e a ilha
    const agua = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: '#7cc6dc', roughness: 0.35 }));
    agua.rotation.x = -Math.PI / 2;
    agua.position.y = -0.55;
    c.add(agua);
    const ilha = new THREE.Mesh(
      new RoundedBoxGeometry(COLUNAS + 3.2, 0.9, LINHAS + 3.2, 6, 0.45),
      new THREE.MeshStandardMaterial({ color: '#8fcf6f', roughness: 0.95 }),
    );
    ilha.position.y = -0.45;
    ilha.receiveShadow = this.sombras;
    c.add(ilha);
    const terra = new THREE.Mesh(
      new RoundedBoxGeometry(COLUNAS + 3.0, 0.7, LINHAS + 3.0, 6, 0.4),
      new THREE.MeshStandardMaterial({ color: '#c99a6b', roughness: 1 }),
    );
    terra.position.y = -0.75;
    c.add(terra);
    this.montarMiolo();

    // os 32 lotes
    for (let i = 0; i < 32; i++) {
      const pl = PLANTAS[i];
      const chave = `${pl.hx}x${pl.hz}`;
      let geos = this.geosDoLote.get(chave);
      if (!geos) {
        geos = {
          laje: new RoundedBoxGeometry(pl.hx * 2 - 0.04, ALTURA_DO_LOTE, pl.hz * 2 - 0.04, 2, 0.035),
          chao: new THREE.PlaneGeometry(pl.hx * 2 - 0.07, pl.hz * 2 - 0.07),
        };
        this.geosDoLote.set(chave, geos);
        this.descartaveis.push(geos.laje, geos.chao);
      }
      const grupo = new THREE.Group();
      grupo.position.set(pl.cx, 0, pl.cz);
      grupo.userData.casa = i;
      const laje = new THREE.Mesh(geos.laje, this.matLaje);
      laje.position.y = ALTURA_DO_LOTE / 2;
      laje.castShadow = this.sombras;
      laje.receiveShadow = this.sombras;
      const matChao = new THREE.MeshStandardMaterial({ roughness: 0.85 });
      const chao = new THREE.Mesh(geos.chao, matChao);
      chao.rotation.x = -Math.PI / 2;
      chao.position.y = ALTURA_DO_LOTE + 0.001;
      chao.receiveShadow = this.sombras;
      // a placa de pé, no fundo do quintal, inclinada para a câmera
      const matPlaca = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      const placa = new THREE.Group();
      placa.position.set(pl.placa[0], ALTURA_DO_LOTE, pl.placa[1]);
      const tabua = new THREE.Mesh(this.geoPlaca, matPlaca);
      tabua.rotation.x = -INCLINACAO_DA_PLACA;
      tabua.position.y = 0.04 + (ALTURA_DA_PLACA / 2) * Math.cos(INCLINACAO_DA_PLACA);
      const pernas = new THREE.Mesh(this.geoPernas, this.matCor);
      pernas.castShadow = this.sombras;
      placa.add(pernas, tabua);
      grupo.add(laje, chao, placa);
      c.add(grupo);
      this.descartaveis.push(matChao, matPlaca);
      this.lotes.push({ i, pl, grupo, matChao, matPlaca, chaveChao: '', chavePlaca: '', chaveConteudo: '', conteudo: null, nasceu: 0, subida: 0 });
    }

    // o brilho do lote de quem está na vez
    {
      const L = 128;
      const cv = document.createElement('canvas');
      cv.width = cv.height = L;
      const g = cv.getContext('2d')!;
      const grad = g.createRadialGradient(L / 2, L / 2, L * 0.15, L / 2, L / 2, L * 0.5);
      grad.addColorStop(0, 'rgba(255,240,180,0.85)');
      grad.addColorStop(0.7, 'rgba(255,230,150,0.35)');
      grad.addColorStop(1, 'rgba(255,230,150,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, L, L);
      const t = textura(cv);
      const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const geo = new THREE.PlaneGeometry(1, 1);
      this.brilho = new THREE.Mesh(geo, m);
      this.brilho.rotation.x = -Math.PI / 2;
      this.brilho.visible = false;
      this.brilho.renderOrder = 2;
      c.add(this.brilho);
      this.descartaveis.push(t, m, geo);
    }

    // a fumaça das chaminés: uma malha instanciada só
    {
      const geo = new THREE.IcosahedronGeometry(0.03, 0);
      const m = new THREE.MeshStandardMaterial({ color: '#f7f3ec', roughness: 1, transparent: true, opacity: 0.85, flatShading: true });
      this.fumaca = new THREE.InstancedMesh(geo, m, 32 * 3);
      this.fumaca.count = 0;
      this.fumaca.frustumCulled = false;
      c.add(this.fumaca);
      this.descartaveis.push(geo, m);
    }

    // as árvores em volta, entre a beira dos lotes e a da ilha (sorteadas sempre do mesmo jeito)
    let semente = 7;
    const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    const plantar = (x: number, z: number, tamanho: number) => {
      const g = this.modelos.get(ARVORES[sorte() < 0.5 ? 0 : 1]);
      if (!g) return;
      const a = copia(g, tamanho, this.sombras);
      a.position.set(x, 0, z);
      a.rotation.y = sorte() * Math.PI * 2;
      c.add(a);
      this.arvores.push({ obj: a, fase: sorte() * 6 });
    };
    for (let k = 0; k < 30; k++) {
      const lado = k % 4;
      const u = sorte() * 2 - 1;
      // na frente (o lado da câmera), mais longe e menores: não tampam a fileira de baixo
      const x = lado < 2 ? u * (X0 + 0.7) : (lado === 2 ? -1 : 1) * (X0 + 0.45 + sorte() * 0.75);
      const z = lado === 0 ? -(Z0 + 0.4 + sorte() * 0.7) : lado === 1 ? Z0 + 0.75 + sorte() * 0.4 : u * (Z0 + 0.6);
      plantar(x, z, lado === 1 ? 0.26 + sorte() * 0.1 : 0.32 + sorte() * 0.18);
    }
    // o miolo: árvores e canteiros dentro da linha do trem
    for (const [x, z] of [
      [-1.9, -0.75],
      [1.95, 0.7],
      [-1.35, 0.85],
      [1.3, -0.85],
      [-3.55, -2.6],
      [3.55, -2.6],
      [-3.55, 2.6],
      [3.55, 2.6],
    ])
      plantar(x, z, Math.abs(x) > 3 ? 0.24 : 0.32);
    const vaso = this.modelos.get('suburbio/planter.glb');
    if (vaso)
      for (const [x, z] of [
        [-2.05, 0.15],
        [2.05, -0.2],
      ]) {
        const v = copia(vaso, 0.36, this.sombras);
        v.position.set(x, 0.01, z);
        c.add(v);
      }
  }

  /** Um retângulo de cantos redondos, no sentido horário visto de cima. */
  private retanguloCurvo(rx: number, rz: number, canto: number, y: number, contrario = false) {
    const pts: THREE.Vector3[] = [];
    const cantos: [number, number, number][] = [
      [rx - canto, -(rz - canto), -Math.PI / 2],
      [rx - canto, rz - canto, 0],
      [-(rx - canto), rz - canto, Math.PI / 2],
      [-(rx - canto), -(rz - canto), Math.PI],
    ];
    for (const [cx, cz, a0] of cantos)
      for (let k = 0; k <= 6; k++) {
        const a = a0 + (k / 6) * (Math.PI / 2);
        pts.push(new THREE.Vector3(cx + Math.cos(a) * canto, y, cz + Math.sin(a) * canto));
      }
    if (contrario) pts.reverse();
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  }

  /** O miolo: a grama, a rua dos carros, a linha do trem, o trem e os carros. */
  private montarMiolo() {
    const mx = X0 - FUNDO - 0.04;
    const mz = Z0 - FUNDO - 0.04;
    const RUA = { rx: 3.3, rz: 2.36, canto: 0.55, largura: 0.44 };
    {
      const P = 96;
      const cv = document.createElement('canvas');
      cv.width = Math.round(mx * 2 * P);
      cv.height = Math.round(mz * 2 * P);
      const g = cv.getContext('2d')!;
      g.fillStyle = '#80c364';
      g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 0; y < cv.height; y += 28) g.fillRect(0, y, cv.width, 14);
      const ret = (rx: number, rz: number, r: number) => roundRect(g, (mx - rx) * P, (mz - rz) * P, rx * 2 * P, rz * 2 * P, r * P);
      // a guia, o asfalto e a faixa do meio
      g.lineWidth = (RUA.largura + 0.06) * P;
      g.strokeStyle = '#d8ccb4';
      ret(RUA.rx, RUA.rz, RUA.canto);
      g.stroke();
      g.lineWidth = RUA.largura * P;
      g.strokeStyle = '#7b7f88';
      ret(RUA.rx, RUA.rz, RUA.canto);
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,236,170,0.85)';
      g.setLineDash([14, 12]);
      ret(RUA.rx, RUA.rz, RUA.canto);
      g.stroke();
      g.setLineDash([]);
      const t = textura(cv);
      const geo = new THREE.PlaneGeometry(mx * 2, mz * 2);
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
      const miolo = new THREE.Mesh(geo, m);
      miolo.rotation.x = -Math.PI / 2;
      miolo.position.y = 0.012;
      miolo.receiveShadow = this.sombras;
      this.cena.add(miolo);
      this.descartaveis.push(t, geo, m);
    }
    // os carros: dois em cada mão
    const faixas = [this.retanguloCurvo(RUA.rx + 0.1, RUA.rz + 0.1, RUA.canto + 0.1, 0.012), this.retanguloCurvo(RUA.rx - 0.1, RUA.rz - 0.1, RUA.canto - 0.1, 0.012, true)];
    ['carros/taxi.glb', 'carros/sedan.glb', 'carros/delivery.glb', 'carros/suv.glb'].forEach((arq, k) => {
      const g = this.modelos.get(arq);
      if (!g) return;
      const obj = copia(g, 0.27, this.sombras);
      const r = new THREE.Group();
      r.add(obj);
      this.cena.add(r);
      this.carros.push({ obj: r, curva: faixas[k % 2], u: k * 0.27 + (k % 2) * 0.1, vel: 0.016 + (k % 3) * 0.002 });
    });
    this.montarTrem();
  }

  private montarTrem() {
    const curva = this.retanguloCurvo(2.55, 1.5, 0.75, 0.06);
    this.trilho = curva;
    const n = 180;
    const dormente = new THREE.BoxGeometry(0.3, 0.03, 0.065);
    const madeira = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.9 });
    const dormentes = new THREE.InstancedMesh(dormente, madeira, n);
    const trilhoGeo = new THREE.BoxGeometry(0.032, 0.032, 1);
    const aco = new THREE.MeshStandardMaterial({ color: '#b9b4ae', metalness: 0.4, roughness: 0.4 });
    const trilhos = new THREE.InstancedMesh(trilhoGeo, aco, n * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const comp = curva.getLength() / n;
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const p = curva.getPointAt(u);
      const t = curva.getTangentAt(u);
      const rumo = Math.atan2(t.x, t.z);
      q.setFromEuler(new THREE.Euler(0, rumo, 0));
      m.compose(p, q, s);
      dormentes.setMatrixAt(k, m);
      const lado = new THREE.Vector3(Math.cos(rumo), 0, -Math.sin(rumo)).multiplyScalar(0.1);
      for (const [j, sinal] of [
        [0, 1],
        [1, -1],
      ]) {
        const pp = p.clone().addScaledVector(lado, sinal).setY(0.09);
        m.compose(pp, q, new THREE.Vector3(1, 1, comp * 1.05));
        trilhos.setMatrixAt(k * 2 + j, m);
      }
    }
    dormentes.receiveShadow = this.sombras;
    this.cena.add(dormentes, trilhos);
    this.descartaveis.push(dormente, madeira, trilhoGeo, aco);
    for (const arq of ['trem/train-locomotive-a.glb', 'trem/train-carriage-box.glb', 'trem/train-carriage-container-red.glb']) {
      const g = this.modelos.get(arq);
      if (!g) continue;
      const v = copia(g, 0.56, this.sombras);
      const r = new THREE.Group();
      r.add(v);
      this.cena.add(r);
      this.trem.push(r);
    }
  }

  /** O estado novo do jogo: os lotes e as peças. (No teste congelado, o estado de fora espera.) */
  atualizar(d: DadosDaCena) {
    if (this.congelada) return;
    this.aplicar(d);
  }

  private aplicar(d: DadosDaCena) {
    const primeira = this.dados === null;
    this.dados = d;
    if (!this.lotes.length) return;
    const posse = new Map(d.posses.map((p) => [p.casa, p]));
    d.casas.forEach((casa, i) => {
      if (i >= 32) return;
      const p = posse.get(i);
      const lote = this.lotes[i];
      const dono = p ? d.corDe(p.dono) : '';
      const base = [casa.tipo, casa.uf, casa.preco, casa.grupo, casa.nome, dono, p?.predios, p?.hipotecada];
      const chaveChao = JSON.stringify([base, d.escolhida === i, d.cores[casa.grupo ?? 0]]);
      if (lote.chaveChao !== chaveChao) {
        lote.chaveChao = chaveChao;
        lote.matChao.map?.dispose();
        lote.matChao.map = pintarChao(lote.pl, casa, p, d, d.escolhida === i);
        lote.matChao.needsUpdate = true;
      }
      const chavePlaca = JSON.stringify([base, d.cores[casa.grupo ?? 0], d.icones[casa.tipo === 'transporte' ? (casa.nome ?? '') : casa.tipo]]);
      if (lote.chavePlaca !== chavePlaca) {
        lote.chavePlaca = chavePlaca;
        lote.matPlaca.map?.dispose();
        lote.matPlaca.map = pintarPlaca(casa, p, d);
        lote.matPlaca.needsUpdate = true;
      }
      const chaveConteudo = JSON.stringify([casa.tipo, casa.nome, dono, p?.predios ?? -1, p?.hipotecada]);
      if (lote.chaveConteudo !== chaveConteudo) {
        const antes = lote.chaveConteudo;
        lote.chaveConteudo = chaveConteudo;
        this.desfazer(lote);
        lote.conteudo = this.montarConteudo(lote, casa, p, d);
        lote.grupo.add(lote.conteudo.grupo);
        // o que acabou de ser construído nasce com um pulo (não na primeira montagem)
        lote.nasceu = !primeira && antes && !this.calmo ? performance.now() : 0;
        if (lote.nasceu) lote.conteudo.grupo.scale.setScalar(0.001);
      }
      lote.subida = d.escolhida === i ? 0.06 : 0;
    });
    this.atualizarPecas(d);
    this.atualizarDados(d);
  }

  private desfazer(lote: Lote) {
    const c = lote.conteudo;
    if (!c) return;
    lote.grupo.remove(c.grupo);
    for (const x of c.descartar) x.dispose();
    lote.conteudo = null;
  }

  /** O pano da bandeira na cor do dono: um material por cor, todos com a mesma onda (o tempo da cena) no shader. */
  private panoDe(cor: string) {
    let m = this.panos.get(cor);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: cor, side: THREE.DoubleSide, roughness: 0.6 });
      m.onBeforeCompile = (s) => {
        s.uniforms.uTempo = this.uTempo;
        s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTempo;').replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            float fase = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 2.3;
            float ponta = position.x / 0.2;
            transformed.z += sin(uTempo * 5.0 - position.x * 30.0 + fase) * 0.024 * ponta;
            transformed.y += sin(uTempo * 3.1 - position.x * 18.0 + fase) * 0.006 * ponta;
          }`,
        );
      };
      m.customProgramCacheKey = () => 'pano-das-cidades';
      this.panos.set(cor, m);
    }
    return m;
  }

  /** O que mora no lote: monta do zero (é barato: são poucas peças, e só quando a casa muda). */
  private montarConteudo(lote: Lote, casa: CasaDaCena, p: PosseDaCena | undefined, d: DadosDaCena): Conteudo {
    const pl = lote.pl;
    const grupo = new THREE.Group();
    grupo.position.y = ALTURA_DO_LOTE;
    const c: Conteudo = { grupo, descartar: [], animar: [], fumaca: [] };
    const a = pl.area;
    // o miolo da área, num grupo virado para a rua: x é a largura, +z é o lado da calçada
    const meio = new THREE.Group();
    meio.position.set((a.x0 + a.x1) / 2, 0, (a.z0 + a.z1) / 2);
    meio.rotation.y = pl.rumo;
    grupo.add(meio);
    const deitado = Math.abs(Math.sin(pl.rumo)) > 0.5;
    const aw = deitado ? a.z1 - a.z0 : a.x1 - a.x0;
    const ad = deitado ? a.x1 - a.x0 : a.z1 - a.z0;
    const sombra = this.sombras;
    const por = (arquivo: string, largura: number, x: number, z: number, rumo = 0, altura = Infinity, onde: THREE.Object3D = meio) => {
      const g = this.modelos.get(arquivo);
      if (!g) return null;
      const o = copia(g, largura, sombra, altura);
      o.position.set(x, 0, z);
      o.rotation.y = rumo;
      onde.add(o);
      return o;
    };
    const feito = (blocos: Bloco[], onde: THREE.Object3D = meio) => {
      const geo = juntar(blocos);
      const m = new THREE.Mesh(geo, this.matCor);
      m.castShadow = sombra;
      m.receiveShadow = sombra;
      onde.add(m);
      c.descartar.push(geo);
      return m;
    };

    if (p) this.cercar(c, pl, d.corDe(p.dono));

    if (casa.tipo === 'cidade') {
      const n = p ? p.predios : -1;
      if (n < 0) {
        // à venda: o terreno demarcado (as estacas e a fita), e a placa com o preço
        const w = aw * 0.8;
        const h = ad * 0.72;
        const estacas: Bloco[] = [];
        for (const [x, z] of [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [-w / 2, h / 2],
          [w / 2, h / 2],
        ])
          estacas.push(caixa(0.025, 0.09, 0.025, x, 0, z, '#b07a4a'));
        estacas.push(caixa(w, 0.012, 0.008, 0, 0.065, -h / 2, '#f3c44a'), caixa(w, 0.012, 0.008, 0, 0.065, h / 2, '#f3c44a'));
        estacas.push(caixa(0.008, 0.012, h, -w / 2, 0.065, 0, '#f3c44a'), caixa(0.008, 0.012, h, w / 2, 0.065, 0, '#f3c44a'));
        feito(estacas);
      } else if (n === 0) {
        // comprada, ainda sem prédio: uma árvore e o canteiro
        por(ARVORES[lote.i % 2], 0.26, -aw * 0.18, 0, 0);
        por('suburbio/planter.glb', 0.22, aw * 0.2, ad * 0.1, 0);
      } else if (n <= 3) {
        // de 1 a 3 casinhas, lado a lado na largura (nas colunas, uma atrás da outra)
        const aoLongo = aw >= ad * 1.2;
        const passo = (aoLongo ? aw : ad) / n;
        const largura = n === 1 ? Math.min(aw, ad) * 0.92 : Math.min(passo * 0.9, aoLongo ? ad * 0.95 : aw * 0.95);
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * passo;
          const x = aoLongo ? off : 0;
          const z = aoLongo ? (k % 2) * 0.04 : off;
          const casinha = por(CASAS_DO_SUBURBIO[(lote.i * 3 + k) % CASAS_DO_SUBURBIO.length], largura, x, z, 0, 0.5);
          if (casinha && k === 0) {
            // a fumaça sai do alto da primeira, de um lado (onde as da Kenney têm a chaminé)
            const ponto = new THREE.Vector3(x + largura * 0.22, (casinha.userData.altura as number) * 0.95, z - largura * 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), pl.rumo);
            c.fumaca.push(ponto.add(meio.position).setY(ponto.y + ALTURA_DO_LOTE));
          }
        }
      } else {
        // com 4: o hotel, e o guarda-sol da piscina
        const hotel = por(HOTEIS[lote.i % HOTEIS.length], Math.min(aw * 0.62, ad * 1.0), -aw * 0.13, 0, 0, 0.62);
        // os prédios da Kenney saem cinza-escuros com esta luz: o hotel ganha um brilho quente próprio (o material é só dele)
        hotel?.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.emissive.set('#fff0d8');
          mat.emissiveIntensity = 0.22;
          m.material = mat;
          c.descartar.push(mat);
        });
        por('comercio/detail-parasol-b.glb', 0.17, aw * 0.36, ad * 0.12, 0);
      }
    } else if (casa.tipo === 'transporte') {
      if (casa.nome === 'rodoviaria') {
        // o ponto de ônibus (a cobertura) e a van parada
        por('comercio/detail-awning.glb', 0.36, -aw * 0.24, -ad * 0.05, 0);
        feito([caixa(0.3, 0.035, 0.07, -aw * 0.24, 0.07, -ad * 0.12, '#8a6a4c'), caixa(0.03, 0.07, 0.05, -aw * 0.24 - 0.12, 0, -ad * 0.12, '#5a4a3a'), caixa(0.03, 0.07, 0.05, -aw * 0.24 + 0.12, 0, -ad * 0.12, '#5a4a3a')]);
        por('carros/van.glb', 0.34, aw * 0.22, ad * 0.02, Math.PI / 2);
      } else if (casa.nome === 'porto') {
        // o cais e o rebocador, que balança na água
        feito([caixa(aw * 0.9, 0.03, 0.12, 0, 0.0, -ad * 0.32, '#a77a52'), caixa(0.04, 0.06, 0.04, -aw * 0.35, -0.02, -ad * 0.32, '#7a5536'), caixa(0.04, 0.06, 0.04, aw * 0.35, -0.02, -ad * 0.32, '#7a5536')]);
        const barco = por('barcos/boat-tug-a.glb', Math.min(aw, ad) * 0.78, 0, ad * 0.08, Math.PI / 2);
        const boia = por('barcos/buoy-flag.glb', 0.1, aw * 0.36, ad * 0.3, 0, 0.16);
        c.animar.push((t) => {
          if (barco) {
            barco.position.y = -0.012 + Math.sin(t * 1.6 + lote.i) * 0.01;
            barco.rotation.z = Math.sin(t * 1.3 + lote.i) * 0.05;
          }
          if (boia) boia.rotation.z = Math.sin(t * 2.1) * 0.12;
        });
      } else if (casa.nome === 'aeroporto') {
        // o avião (feito por código: a Kenney não tem) e a biruta
        const aviao = new THREE.Group();
        aviao.position.set(0, 0.04, -ad * 0.02);
        aviao.rotation.y = Math.PI / 2;
        meio.add(aviao);
        const fus = new THREE.CapsuleGeometry(0.045, 0.3, 4, 10);
        feito(
          [
            { geo: fus, x: 0, y: 0.06, z: 0, cor: '#f6f2ea', rx: Math.PI / 2 },
            { geo: new THREE.BoxGeometry(0.5, 0.016, 0.1), x: 0, y: 0.055, z: 0.02, cor: '#e0684a' },
            { geo: new THREE.BoxGeometry(0.18, 0.012, 0.055), x: 0, y: 0.07, z: -0.17, cor: '#e0684a' },
            { geo: new THREE.BoxGeometry(0.012, 0.09, 0.07), x: 0, y: 0.11, z: -0.17, cor: '#3f6fb0' },
            { geo: new THREE.BoxGeometry(0.06, 0.03, 0.03), x: 0, y: 0.075, z: 0.12, cor: '#4f86c6' },
            { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), x: -0.1, y: 0.02, z: 0.02, cor: '#3a3434' },
            { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), x: 0.1, y: 0.02, z: 0.02, cor: '#3a3434' },
          ],
          aviao,
        );
        aviao.position.y = 0;
        const biruta = new THREE.Group();
        biruta.position.set(aw * 0.42, 0, -ad * 0.32);
        meio.add(biruta);
        feito([caixa(0.016, 0.3, 0.016, 0, 0, 0, '#e8e2d6')], biruta);
        const manga = new THREE.Group();
        manga.position.y = 0.28;
        biruta.add(manga);
        feito([{ geo: new THREE.ConeGeometry(0.03, 0.12, 8, 1, true), x: 0.06, y: 0, z: 0, cor: '#ee8a3a', rz: Math.PI / 2 }], manga);
        c.animar.push((t) => {
          manga.rotation.y = Math.sin(t * 0.7) * 0.6;
          manga.rotation.z = -0.15 + Math.sin(t * 3.3) * 0.06;
        });
      } else {
        // a ferrovia: os trilhos e a locomotiva com um vagão
        por('trem/railroad-straight.glb', ad * 0.5, 0, -ad * 0.25, 0);
        por('trem/railroad-straight.glb', ad * 0.5, 0, ad * 0.25, 0);
        por('trem/train-locomotive-a.glb', ad * 0.45, 0, ad * 0.2, 0);
        por('trem/train-carriage-box.glb', ad * 0.45, 0, -ad * 0.24, 0);
      }
    } else if (casa.tipo === 'noticia') {
      // a banca de jornal
      feito([
        caixa(0.34, 0.24, 0.2, 0, 0, -0.04, '#3f8a72'),
        caixa(0.42, 0.035, 0.3, 0, 0.24, -0.01, '#e0b04a'),
        caixa(0.36, 0.06, 0.09, 0, 0.0, 0.1, '#2f6b58'),
        caixa(0.1, 0.012, 0.07, -0.1, 0.06, 0.1, '#fbf6ea'),
        caixa(0.1, 0.02, 0.07, 0.01, 0.06, 0.1, '#f4ecd8'),
        caixa(0.08, 0.016, 0.06, 0.11, 0.06, 0.1, '#e46a5a'),
        caixa(0.22, 0.12, 0.012, 0, 0.08, 0.061, '#fbf6ea'),
        caixa(0.18, 0.016, 0.014, 0, 0.17, 0.061, '#3a3434'),
        caixa(0.14, 0.012, 0.014, 0, 0.13, 0.061, '#8a8a8a'),
      ]);
      por('suburbio/planter.glb', 0.16, aw * 0.38, ad * 0.1, 0);
    } else if (casa.tipo === 'pedagio') {
      // a cabine e a cancela, que sobe de vez em quando
      feito([
        caixa(0.17, 0.24, 0.17, -aw * 0.3, 0, 0, '#f4efe6'),
        caixa(0.21, 0.03, 0.21, -aw * 0.3, 0.24, 0, '#3f6fb0'),
        caixa(0.12, 0.08, 0.012, -aw * 0.3, 0.12, 0.086, '#7fb4d8'),
        caixa(0.04, 0.13, 0.04, -aw * 0.17, 0, 0.0, '#3a3434'),
      ]);
      const braco = new THREE.Group();
      braco.position.set(-aw * 0.17, 0.12, 0);
      meio.add(braco);
      const listras: Bloco[] = [];
      for (let k = 0; k < 6; k++) listras.push(caixa(0.075, 0.025, 0.025, 0.04 + k * 0.075, -0.012, 0, k % 2 ? '#f4efe6' : '#d9463c'));
      feito(listras, braco);
      por('carros/cone.glb', 0.06, aw * 0.4, ad * 0.28, 0);
      por('carros/cone.glb', 0.06, aw * 0.4, -ad * 0.28, 0);
      c.animar.push((t) => {
        // a cada 7 s: sobe, espera e desce
        const f = (t + lote.i * 1.7) % 7;
        const s = f < 0.5 ? f / 0.5 : f < 2.2 ? 1 : f < 2.7 ? 1 - (f - 2.2) / 0.5 : 0;
        braco.rotation.z = s * s * (3 - 2 * s) * 1.25;
      });
    } else if (casa.tipo === 'engarrafamento') {
      // os carros parados, um atrás do outro, tremendo de motor ligado
      const fila = ['carros/sedan.glb', 'carros/taxi.glb', 'carros/suv.glb'];
      const carros = fila.map((arq, k) => por(arq, 0.26, (k % 2) * 0.05 - 0.04, (k - 1) * 0.3, Math.PI)).filter((o): o is THREE.Object3D => !!o);
      por('carros/cone.glb', 0.07, aw * 0.38, -ad * 0.38, 0);
      por('carros/cone.glb', 0.07, aw * 0.38, ad * 0.0, 0);
      por('carros/cone.glb', 0.07, aw * 0.38, ad * 0.38, 0);
      c.animar.push((t) => {
        carros.forEach((o, k) => {
          o.position.y = Math.abs(Math.sin(t * 22 + k * 2)) * 0.004;
          o.rotation.z = Math.sin(t * 17 + k) * 0.01;
        });
      });
    } else if (casa.tipo === 'feriado') {
      // a praia: guarda-sóis, as toalhas e o coqueiro
      por('comercio/detail-parasol-a.glb', 0.3, -aw * 0.22, -ad * 0.05, 0);
      por('comercio/detail-parasol-b.glb', 0.28, aw * 0.18, ad * 0.22, 0);
      feito([caixa(0.12, 0.006, 0.22, -aw * 0.02, 0, ad * 0.1, '#e46a8a', 0.3), caixa(0.12, 0.006, 0.22, aw * 0.32, 0, -ad * 0.18, '#4f9fd6', -0.4)]);
      por(ARVORES[0], 0.28, -aw * 0.38, ad * 0.36, 0);
    } else if (casa.tipo === 'largada') {
      // o pórtico da largada, com a faixa quadriculada
      const cel: Bloco[] = [caixa(0.035, 0.42, 0.035, -aw * 0.36, 0, 0, '#f4efe6'), caixa(0.035, 0.42, 0.035, aw * 0.36, 0, 0, '#f4efe6')];
      const n = 10;
      const w = (aw * 0.72) / n;
      for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) cel.push(caixa(w, 0.05, 0.02, -aw * 0.36 + w * (k + 0.5), 0.34 + j * 0.05, 0, (k + j) % 2 ? '#fffaf0' : '#3a3434'));
      feito(cel);
      for (const s of [-1, 1]) {
        const o = new THREE.Mesh(this.geoPano, this.panoDe(s < 0 ? '#e0684a' : '#3f8a72'));
        o.position.set(s * aw * 0.36, 0.5, 0);
        o.rotation.y = s < 0 ? Math.PI : 0;
        meio.add(o);
      }
      feito([caixa(0.012, 0.1, 0.012, -aw * 0.36, 0.42, 0, '#f4efe6'), caixa(0.012, 0.1, 0.012, aw * 0.36, 0.42, 0, '#f4efe6')]);
    }

    if (p?.hipotecada) {
      // hipotecada: tudo mais escuro (o material é só desta construção)
      grupo.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.color.multiplyScalar(0.55);
        m.material = mat;
        c.descartar.push(mat);
      });
    }
    return c;
  }

  /** A cerca na cor do dono, em volta do quintal, com o portão aberto para a calçada; e a bandeira no canto do fundo. */
  private cercar(c: Conteudo, pl: Planta, cor: string) {
    const q = pl.quintal;
    const m = 0.04;
    const r = { x0: q.x0 + m, x1: q.x1 - m, z0: q.z0 + m, z1: q.z1 - m };
    const blocos: Bloco[] = [];
    const claro = new THREE.Color(cor).lerp(new THREE.Color('#ffffff'), 0.35).getStyle();
    const lado = (ax: number, az: number, bx: number, bz: number, portao: boolean) => {
      const comp = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      const trechos: [number, number][] = portao
        ? [
            [0, 0.36],
            [0.64, 1],
          ]
        : [[0, 1]];
      for (const [f0, f1] of trechos) {
        const l = (f1 - f0) * comp;
        const cx = ax + (bx - ax) * ((f0 + f1) / 2);
        const cz = az + (bz - az) * ((f0 + f1) / 2);
        for (const y of [0.035, 0.075]) blocos.push({ geo: new THREE.BoxGeometry(0.014, 0.016, l), x: cx, y, z: cz, cor: claro, ry: ang });
        const postes = Math.max(2, Math.round(l / 0.14) + 1);
        for (let k = 0; k < postes; k++) {
          const f = f0 + ((f1 - f0) * k) / (postes - 1);
          blocos.push(caixa(0.022, 0.1, 0.022, ax + (bx - ax) * f, 0, az + (bz - az) * f, cor));
        }
      }
    };
    lado(r.x0, r.z0, r.x1, r.z0, false);
    lado(r.x0, r.z1, r.x1, r.z1, pl.portao === 'z1');
    lado(r.x0, r.z0, r.x0, r.z1, pl.portao === 'x0');
    lado(r.x1, r.z0, r.x1, r.z1, pl.portao === 'x1');
    // o mastro da bandeira, no canto do fundo do lado de fora da placa
    const mx = pl.portao === 'x1' ? r.x0 + 0.03 : pl.portao === 'x0' ? r.x1 - 0.03 : r.x0 + 0.03;
    const mz = r.z0 + 0.03;
    blocos.push(caixa(0.016, 0.52, 0.016, mx, 0, mz, '#f4efe6'), caixa(0.03, 0.03, 0.03, mx, 0.52, mz, '#e0b04a'));
    const geo = juntar(blocos);
    const cerca = new THREE.Mesh(geo, this.matCor);
    cerca.castShadow = this.sombras;
    c.grupo.add(cerca);
    c.descartar.push(geo);
    const pano = new THREE.Mesh(this.geoPano, this.panoDe(cor));
    pano.position.set(mx, 0.45, mz);
    // o pano aponta para o lado de dentro do lote
    pano.rotation.y = pl.portao === 'x0' ? Math.PI : 0;
    pano.castShadow = this.sombras;
    c.grupo.add(pano);
  }

  /** Os dados: na jogada nova, rolam do lado da câmera e param com a face do servidor para cima; senão, ficam onde pararam. */
  private atualizarDados(d: DadosDaCena) {
    if (this.dadosNaMesa.length < 2) return;
    const id = d.dados ? d.dados.id : null;
    if (id === this.dadoVisto) return;
    const primeira = this.dadoVisto === undefined;
    this.dadoVisto = id;
    if (!d.dados) {
      this.rolagem = null;
      for (const o of this.dadosNaMesa) o.visible = false;
      return;
    }
    const valores = d.dados.valores;
    const qFim = valores.map((v, k) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2 + k * 0.5).multiply(FACE_PARA_CIMA[v] ?? new THREE.Quaternion()));
    this.dadosNaMesa.forEach((o, k) => {
      o.visible = true;
      o.position.copy(PARADA_DO_DADO[k]);
      o.quaternion.copy(qFim[k]);
    });
    if (primeira || this.calmo) {
      this.rolagem = null;
      return;
    }
    this.rolagem = {
      id: d.dados.id,
      inicio: performance.now(),
      de: PARADA_DO_DADO.map((p, k) => p.clone().add(new THREE.Vector3(-1.4 + k * 0.5, 0, 2.3))),
      qFim,
      eixo: [0, 1].map(() => new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize()),
    };
  }

  private rolarDados(agora: number) {
    const r = this.rolagem;
    if (!r) return;
    const f = Math.min(1, (agora - r.inicio) / DURACAO_DO_DADO);
    const e = 1 - (1 - f) * (1 - f);
    this.dadosNaMesa.forEach((o, k) => {
      const f2 = Math.min(1, f * (1 + k * 0.08));
      const e2 = 1 - (1 - f2) * (1 - f2);
      o.position.lerpVectors(r.de[k], PARADA_DO_DADO[k], e2);
      // dois quiques e o pouso
      o.position.y += 1.6 * Math.pow(1 - f2, 1.5) * Math.abs(Math.cos(Math.PI * 2.5 * f2));
      o.quaternion.setFromAxisAngle(r.eixo[k], (1 - e) * Math.PI * 5).multiply(r.qFim[k]);
    });
    if (f >= 1) this.rolagem = null;
  }

  private atualizarPecas(d: DadosDaCena) {
    const coelho = this.modelos.get('coelho-animado.glb');
    if (!coelho) return;
    const vivos = new Set(d.pecas.map((p) => p.userId));
    for (const [id, p] of this.pecas)
      if (!vivos.has(id)) {
        this.cena.remove(p.raiz);
        p.descartar();
        this.pecas.delete(id);
      }
    // quantas peças por casa, para dividir a calçada
    const porCasa = new Map<number, number[]>();
    for (const p of d.pecas) porCasa.set(p.pos, [...(porCasa.get(p.pos) ?? []), p.userId]);
    const agora = performance.now();
    for (const info of d.pecas) {
      let p = this.pecas.get(info.userId);
      if (!p || p.pelo !== info.pelo || p.roupa !== info.roupa) {
        if (p) {
          this.cena.remove(p.raiz);
          p.descartar();
        }
        p = this.novaPeca(coelho, info);
        this.pecas.set(info.userId, p);
      }
      const ids = porCasa.get(info.pos) ?? [info.userId];
      const k = ids.indexOf(info.userId);
      const n = ids.length;
      const centro = centroDaCasa(info.pos);
      const k2 = PLANTAS[info.pos].calcada;
      // ao longo da calçada (o lado comprido dela), um pouco desencontrados na profundidade
      const aoLongoX = k2.x1 - k2.x0 >= k2.z1 - k2.z0;
      const espaco = Math.min(0.2, ((aoLongoX ? k2.x1 - k2.x0 : k2.z1 - k2.z0) - 0.2) / Math.max(1, n - 1));
      const off = n > 1 ? (k - (n - 1) / 2) * espaco : 0;
      const fundo = n > 1 ? (k % 2 ? 0.06 : -0.06) : 0;
      const destino = new THREE.Vector3(centro.x + (aoLongoX ? off : fundo), centro.y, centro.z + (aoLongoX ? fundo : off));
      if (p.casa !== info.pos || p.para.distanceTo(destino) > 1e-3) {
        const pulo = p.casa !== info.pos;
        p.de.copy(p.raiz.position);
        p.para.copy(destino);
        p.inicio = agora;
        const longe = p.de.distanceTo(destino);
        p.duracao = !pulo ? 180 : longe > 1.6 ? 650 : 210;
        if (longe > 0.05) p.rumo = Math.atan2(destino.x - p.de.x, destino.z - p.de.z);
        p.casa = info.pos;
      }
      p.mat.uOpaco.value = info.presente ? 1 : 0.45;
      p.marca.visible = info.vez;
      (p.marca.material as THREE.MeshStandardMaterial).color.set(info.roupa);
      p.raiz.userData.vez = info.vez;
    }
  }

  private novaPeca(g: GLTF, info: PecaDaCena): Peca {
    // o coelho com o NOSSO esqueleto e a textura dele, nas cores de quem joga, com o contorno (o módulo comum, coelho3d.ts)
    const { corpo, mixer, acoes, material: mat, descartar } = copiarCoelho(g, { altura: ALTURA_DO_COELHO, sombras: this.sombras, cores: { pelo: info.pelo, roupa: info.roupa } });
    const raiz = new THREE.Group();
    const pulo = new THREE.Group();
    pulo.add(corpo);
    raiz.add(pulo);
    const sombra = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 20),
      new THREE.MeshBasicMaterial({ color: '#2a3a2a', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.004;
    raiz.add(sombra);
    const marca = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({ color: info.roupa, emissive: '#ffffff', emissiveIntensity: 0.25 }));
    marca.position.y = ALTURA_DO_COELHO + 0.2;
    marca.castShadow = false;
    raiz.add(marca);
    const c = centroDaCasa(info.pos);
    raiz.position.copy(c);
    this.cena.add(raiz);
    return { raiz, corpo: pulo, sombra, marca, mat, descartar, casa: info.pos, de: c.clone(), para: c.clone(), inicio: 0, duracao: 0, rumo: 0, pelo: info.pelo, roupa: info.roupa, mixer, acoes, tocando: '' };
  }

  /** Troca de animação com uma passagem curta. */
  private tocar(p: Peca, nome: string) {
    if (p.tocando === nome) return;
    const nova = p.acoes.get(nome);
    if (!nova) return;
    const velha = p.acoes.get(p.tocando);
    nova.reset().play();
    if (velha) velha.crossFadeTo(nova, 0.2, false);
    p.tocando = nome;
  }

  private desenhar = () => {
    if (this.morta) return;
    // sem foco na janela (o jogo de verdade aberto) ou escondida, não desenha
    if (document.hidden || !document.hasFocus()) {
      this.relogio.update();
      return;
    }
    const t0 = performance.now();
    this.relogio.update();
    const dt = Math.min(0.05, this.relogio.getDelta());
    const tempo = this.relogio.getElapsed();
    const agora = performance.now();
    this.quadro++;
    const vivo = !this.calmo;
    if (vivo) this.uTempo.value = tempo;

    let andando: THREE.Vector3 | null = null;
    let casaDaVez: number | null = null;
    for (const p of this.pecas.values()) {
      const f = p.duracao ? Math.min(1, (agora - p.inicio) / p.duracao) : 1;
      const e = f < 1 ? f * f * (3 - 2 * f) : 1;
      p.raiz.position.lerpVectors(p.de, p.para, e);
      const longe = p.de.distanceTo(p.para);
      const altura = f < 1 && longe > 0.3 ? Math.sin(Math.PI * f) * (longe > 1.6 ? 0.9 : 0.32) : 0;
      p.corpo.position.y = altura;
      // o achatar e esticar de desenho: estica no ar, achata ao pousar
      const pouso = f >= 1 ? Math.max(0, 1 - (agora - p.inicio - p.duracao) / 140) : 0;
      const respira = this.calmo ? 0 : Math.sin(tempo * 2.4 + p.raiz.id) * 0.015;
      const vez = p.raiz.userData.vez && !this.calmo && f >= 1 ? Math.abs(Math.sin(tempo * 4)) * 0.05 : 0;
      p.corpo.position.y += vez;
      const estica = f < 1 && altura > 0 ? 0.1 * Math.sin(Math.PI * f) : -0.16 * pouso + respira;
      p.corpo.scale.set(1 - estica * 0.5, 1 + estica, 1 - estica * 0.5);
      (p.sombra.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - Math.min(0.6, altura));
      p.sombra.scale.setScalar(1 - Math.min(0.4, altura * 0.5));
      // olha para onde vai; parado, vira devagar para a câmera
      const quer = f < 1 && longe > 0.05 ? p.rumo : 0;
      let delta = quer - p.corpo.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      p.corpo.rotation.y += delta * Math.min(1, dt * (f < 1 ? 18 : 4));
      p.marca.rotation.y = tempo * 2;
      p.marca.position.y = ALTURA_DO_COELHO + 0.2 + altura + (this.calmo ? 0 : Math.sin(tempo * 3) * 0.04);
      if (f < 1 && longe > 0.3) andando = p.raiz.position;
      if (p.raiz.userData.vez && f >= 1) casaDaVez = p.casa;
      // andando entre as casas; na vez, gesticulando; à toa, parado (com menos movimento, sempre parado)
      this.tocar(p, this.calmo ? 'parado' : f < 1 && longe > 0.3 ? 'andando' : p.raiz.userData.vez ? 'falando' : 'parado');
      p.mixer.update(this.calmo ? 0 : dt);
    }

    this.rolarDados(agora);

    // os lotes: a subida do escolhido, o pulo de quem nasceu e as animações de cada um
    const fontes: THREE.Vector3[] = [];
    for (const l of this.lotes) {
      const y = l.grupo.position.y;
      if (Math.abs(y - l.subida) > 1e-4) l.grupo.position.y = y + (l.subida - y) * Math.min(1, dt * 14);
      const c = l.conteudo;
      if (!c) continue;
      if (l.nasceu) {
        const f = Math.min(1, (agora - l.nasceu) / PULO_MS);
        c.grupo.scale.setScalar(Math.max(0.001, crescer(f)));
        c.grupo.position.y = ALTURA_DO_LOTE + Math.sin(Math.PI * Math.min(1, f * 1.4)) * 0.12;
        if (f >= 1) {
          l.nasceu = 0;
          c.grupo.scale.setScalar(1);
          c.grupo.position.y = ALTURA_DO_LOTE;
        }
      }
      if (vivo) for (const a of c.animar) a(tempo);
      for (const f of c.fumaca) fontes.push(new THREE.Vector3(f.x + l.pl.cx, f.y + l.grupo.position.y, f.z + l.pl.cz));
    }
    // a fumaça: três bolinhas por chaminé, subindo, crescendo e sumindo
    if (this.fumaca) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let n = 0;
      for (const [k, f] of fontes.entries())
        for (let j = 0; j < 3 && n < 96; j++) {
          const u = vivo ? (tempo * 0.32 + j / 3 + k * 0.17) % 1 : j / 3;
          const s = Math.sin(Math.PI * u) * (0.55 + u * 0.9);
          m.compose(new THREE.Vector3(f.x + Math.sin(u * 5 + k) * 0.025 + u * 0.05, f.y + u * 0.32, f.z + u * 0.02), q, new THREE.Vector3(s, s, s));
          this.fumaca.setMatrixAt(n++, m);
        }
      this.fumaca.count = n;
      this.fumaca.instanceMatrix.needsUpdate = true;
    }
    // o lote de quem está na vez acende, pulsando
    if (this.brilho) {
      this.brilho.visible = casaDaVez !== null;
      if (casaDaVez !== null) {
        const l = this.lotes[casaDaVez];
        this.brilho.position.set(l.pl.cx, l.grupo.position.y + ALTURA_DO_LOTE + 0.004, l.pl.cz);
        this.brilho.scale.set(l.pl.hx * 2.3, l.pl.hz * 2.3, 1);
        (this.brilho.material as THREE.MeshBasicMaterial).opacity = this.calmo ? 0.7 : 0.55 + Math.sin(tempo * 3.2) * 0.25;
      }
    }

    // o trem
    if (this.trilho && this.trem.length) {
      const u0 = this.calmo ? 0.1 : (tempo * 0.022) % 1;
      this.trem.forEach((v, k) => {
        const u = (u0 - k * 0.04 + 1) % 1;
        const p = this.trilho!.getPointAt(u);
        const t = this.trilho!.getTangentAt(u);
        v.position.set(p.x, 0.1, p.z);
        v.rotation.y = Math.atan2(t.x, t.z);
      });
    }
    // os carros, na rua do miolo
    for (const c of this.carros) {
      const u = this.calmo ? c.u % 1 : (c.u + tempo * c.vel) % 1;
      const p = c.curva.getPointAt(u);
      const t = c.curva.getTangentAt(u);
      c.obj.position.set(p.x, 0.012, p.z);
      c.obj.rotation.y = Math.atan2(t.x, t.z);
    }
    // as árvores balançam de leve
    if (vivo)
      for (const a of this.arvores) {
        a.obj.rotation.z = Math.sin(tempo * 1.1 + a.fase) * 0.035;
        a.obj.rotation.x = Math.sin(tempo * 0.8 + a.fase * 1.3) * 0.025;
      }

    // a câmera: o tabuleiro inteiro; chega perto de quem anda
    const longe = this.focoDeTeste ? this.focoDeTeste.perto : andando ? 0.78 : 1;
    const foco = this.focoDeTeste ? new THREE.Vector3(this.focoDeTeste.x, 0, this.focoDeTeste.z) : andando ? new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0.25), andando, 0.45) : new THREE.Vector3(0, 0, 0.25);
    const k = 1 - Math.exp(-dt * 2.2);
    this.alvo.lerp(foco, k);
    this.olhando.lerp(this.alvo, k);
    const d = 16.2 * this.distancia * longe;
    const balanco = this.calmo ? 0 : Math.sin(tempo * 0.25) * 0.35;
    const pos = new THREE.Vector3(this.olhando.x + balanco, d * 0.8, this.olhando.z + d * 0.7);
    this.camera.position.lerp(pos, this.quadro < 3 ? 1 : k);
    this.camera.lookAt(this.olhando);
    this.renderer.render(this.cena, this.camera);
    if (import.meta.env.DEV) {
      this.tempos.push(performance.now() - t0);
      if (this.tempos.length > 120) this.tempos.shift();
    }
  };

  /** Só no site de desenvolvimento: o que o teste mede (ms por quadro na CPU, chamadas de desenho, triângulos). */
  medidaDoTeste() {
    const ordem = [...this.tempos].sort((a, b) => a - b);
    return {
      msMedio: ordem.reduce((s, x) => s + x, 0) / Math.max(1, ordem.length),
      msP95: ordem[Math.floor(ordem.length * 0.95)] ?? 0,
      chamadas: this.renderer.info.render.calls,
      triangulos: this.renderer.info.render.triangles,
      geometrias: this.renderer.info.memory.geometries,
      texturas: this.renderer.info.memory.textures,
    };
  }
  /**
   * Só para o teste: mostra os lotes com estas posses (todas as situações de uma vez, para a foto), e congela a cena para o
   * estado de verdade não desfazer. `null` descongela.
   */
  posseDoTeste(posses: PosseDaCena[] | null, vez?: number) {
    if (!this.dados) return;
    if (posses === null) {
      this.congelada = false;
      return;
    }
    this.congelada = true;
    const pecas = this.dados.pecas.map((p, k) => (vez === undefined ? p : { ...p, vez: k === 0, pos: k === 0 ? vez : p.pos }));
    this.aplicar({ ...this.dados, posses, pecas });
  }

  private casaNoPonto(e: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raio.setFromCamera(v, this.camera);
    const hit = this.raio.intersectObjects(
      this.lotes.map((l) => l.grupo),
      true,
    )[0];
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) if (o.userData.casa !== undefined) return o.userData.casa as number;
    return null;
  }
  private aoApertar = (e: PointerEvent) => {
    this.apertou = { x: e.clientX, y: e.clientY };
  };
  private aoSoltar = (e: PointerEvent) => {
    if (!this.apertou || Math.hypot(e.clientX - this.apertou.x, e.clientY - this.apertou.y) > 6) return;
    this.apertou = null;
    const i = this.casaNoPonto(e);
    if (i !== null) this.aoEscolher(i);
  };
  private aoPassar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.quadro % 2) return;
    this.renderer.domElement.style.cursor = this.casaNoPonto(e) !== null ? 'pointer' : '';
  };

  destruir() {
    this.morta = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.aoApertar);
    canvas.removeEventListener('pointerup', this.aoSoltar);
    canvas.removeEventListener('pointermove', this.aoPassar);
    // a geometria e as texturas dos modelos são do cache (servem à próxima partida); as nossas vão embora
    for (const l of this.lotes) {
      this.desfazer(l);
      l.matChao.map?.dispose();
      l.matPlaca.map?.dispose();
    }
    for (const m of this.panos.values()) m.dispose();
    for (const d of this.descartaveis) d.dispose();
    for (const p of this.pecas.values()) {
      p.descartar();
      p.sombra.geometry.dispose();
      (p.sombra.material as THREE.Material).dispose();
      p.marca.geometry.dispose();
      (p.marca.material as THREE.Material).dispose();
    }
    if (import.meta.env.DEV) {
      const w = window as unknown as { cenaDasCidades?: CenaDasCidades };
      if (w.cenaDasCidades === this) delete w.cenaDasCidades;
    }
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    canvas.remove();
  }
}
