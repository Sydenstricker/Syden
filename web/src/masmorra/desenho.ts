/**
 * O DESENHO DA MASMORRA DA TOCA (16/11/2026): tudo por código, em "pixels" de 2 px (o quadro é 680 × 440 e o coelho e os bichos
 * são as folhas da Briga na horta, em tamanho natural). A paleta é a de pedra morna do quarto, sem preto puro. Nada aqui é de
 * jogo nenhum: as salas, as portas, o baú, o cristal e a cenoura que vai e volta são desenhos daqui.
 */
import { casasDe, COLS, fogoAceso, LARGURA, LINHAS, PORTA, SALAS, TILE, type Lado, type Mundo, type Sala } from './regras';

export const W = LARGURA;
export const H = LINHAS * TILE;

const COR = {
  chao: '#5e4e46',
  chao2: '#65544b',
  junta: '#4c3e38',
  topo: '#8d7768',
  topoClaro: '#9c8574',
  face: '#4f3f39',
  contorno: '#2b211d',
  agua: '#3d6f8e',
  aguaClara: '#5b8fae',
  tabua: '#9a6b42',
  tabuaEscura: '#6e4a2c',
  ouro: '#e2b84f',
  ouroEscuro: '#9a7428',
  madeira: '#7b4f2e',
};

/** As cores dos avisos antes do golpe (piscando entre as duas) e do fundo do HUD. */
export const AVISOS = {
  mira: ['rgba(255, 120, 90, 0.8)', 'rgba(255, 220, 160, 0.6)'],
  pulo: ['rgba(255, 120, 90, 0.9)', 'rgba(255, 230, 170, 0.7)'],
  investida: ['rgba(255, 110, 80, 0.45)', 'rgba(255, 220, 160, 0.3)'],
  fundo: 'rgba(30, 20, 18, 0.55)',
};

/** Um retângulo nos "pixels" de 2 px. */
const px = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cor: string) => {
  g.fillStyle = cor;
  g.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, Math.max(2, Math.round(w / 2) * 2), Math.max(2, Math.round(h / 2) * 2));
};

const parede = (s: Sala, c: number, l: number) => c < 0 || l < 0 || c >= COLS || l >= LINHAS || s.grade[l][c] === '#' || s.grade[l][c] === 'T';

// ---------------- O CENÁRIO DO TINY DUNGEON (20/11/2026) ----------------
/**
 * O CENÁRIO EM PIXEL ART DE VERDADE: as peças do Tiny Dungeon da Kenney (CC0, 16 × 16; web/public/masmorra/cenario.png, montada
 * por web/scripts/masmorra-cenario.mjs), ampliadas em 2× — o mesmo "pixel" de 2 px do resto do desenho e das folhas da Briga.
 * Do pacote só o cenário e os objetos: o coelho e os bichos continuam os nossos. A casa da regra tem 40 px e a peça 32, então
 * o chão e o tijolo são TEXTURA presa ao quadro (corre por baixo da grade), e as bordas de pedra são desenhadas aqui, nas cores
 * do pacote. Enquanto a tira carrega (ou se falhar), o desenho por código de antes.
 */
const KIT = {
  areia: '#eaa56c',
  terra: '#763b36',
  contorno: '#3f2631',
  noite: '#262b44',
  pedra: '#c0cbdc',
  pedraMeio: '#8b9bb4',
  pedraEscura: '#52607c',
  telha: '#bd6c4a',
};
const PECAS = {
  chao: 0,
  chaoPintas: 1,
  chaoPedras: 2,
  tijolo: 3,
  tijoloGrade: 4,
  tabua: 5,
  tabuaBeira: 6,
  portaAberta: 7,
  porta: 8,
  bau: 9,
  bauAberto: 10,
  barril: 11,
  bloco: 12,
} as const;
const P = 32;
let kit: HTMLCanvasElement[] | null = null;
let kitPedido = false;
/** As peças já ampliadas em 2× (um canvas cada, para servirem também de textura). Null enquanto a tira não chegou. */
function pecas(): HTMLCanvasElement[] | null {
  if (kit || kitPedido || typeof document === 'undefined') return kit;
  kitPedido = true;
  const img = new Image();
  img.onload = () => {
    const n = Math.floor(img.width / 16);
    const lista: HTMLCanvasElement[] = [];
    for (let k = 0; k < n; k++) {
      const c = document.createElement('canvas');
      c.width = P;
      c.height = P;
      const g = c.getContext('2d');
      if (!g) return;
      g.imageSmoothingEnabled = false;
      g.drawImage(img, k * 16, 0, 16, 16, 0, 0, P, P);
      lista.push(c);
    }
    kit = lista;
  };
  img.src = `${import.meta.env.BASE_URL}masmorra/cenario.png`;
  return null;
}
const peca = (g: CanvasRenderingContext2D, k: number, x: number, y: number) => kit && g.drawImage(kit[k], Math.round(x), Math.round(y));

/** O fundo parado de cada sala (o chão, as paredes, a ponte), feito uma vez: muda só com a ponte. */
const fundos = new Map<string, HTMLCanvasElement>();
const aberto = (s: Sala, c: number, l: number) => c >= 0 && l >= 0 && c < COLS && l < LINHAS && !parede(s, c, l);
/** Um número de 0 a 1 que não muda de quadro para quadro (a variação do chão). */
const sorteio = (a: number, b: number, sal: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + sal * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

function fundoDaSala(s: Sala, ponteLevantada: boolean): HTMLCanvasElement | null {
  const k = pecas();
  if (!k) return null;
  const chave = `${s.id}|${ponteLevantada ? 1 : 0}`;
  const pronto = fundos.get(chave);
  if (pronto) return pronto;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  g.imageSmoothingEnabled = false;
  const mina = s.id >= 8;
  // o chão: a areia numa grade própria de 32 px, com pintas e pedrinhas aqui e ali (mais na mina)
  for (let y = 0; y < H; y += P) {
    for (let x = 0; x < W; x += P) {
      const r = sorteio(x / P, y / P, s.id);
      const qual = r < (mina ? 0.07 : 0.025) ? PECAS.chaoPedras : r < 0.3 ? PECAS.chaoPintas : PECAS.chao;
      g.drawImage(k[qual], x, y);
    }
  }
  // a sombra das paredes no chão (de cima e da esquerda)
  for (let l = 0; l < LINHAS; l++) {
    for (let col = 0; col < COLS; col++) {
      if (parede(s, col, l)) continue;
      if (parede(s, col, l - 1)) {
        g.fillStyle = 'rgba(63, 38, 49, 0.28)';
        g.fillRect(col * TILE, l * TILE, TILE, 6);
      }
      if (parede(s, col - 1, l)) {
        g.fillStyle = 'rgba(63, 38, 49, 0.18)';
        g.fillRect(col * TILE, l * TILE + (parede(s, col, l - 1) ? 6 : 0), 4, TILE - (parede(s, col, l - 1) ? 6 : 0));
      }
    }
  }
  // a ponte de tábuas (levantada pelo cristal): a textura das tábuas e a beira de pedra dos dois lados
  if (ponteLevantada) {
    const casas = casasDe(s, '=');
    if (casas.length) {
      const x0 = Math.min(...casas.map(([cc]) => cc)) * TILE;
      const x1 = (Math.max(...casas.map(([cc]) => cc)) + 1) * TILE;
      const y0 = Math.min(...casas.map(([, ll]) => ll)) * TILE;
      const y1 = (Math.max(...casas.map(([, ll]) => ll)) + 1) * TILE;
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip();
      for (let y = y0; y < y1; y += P) for (let x = x0; x < x1; x += P) g.drawImage(k[PECAS.tabua], x, y);
      for (let y = y0; y < y1; y += P) {
        g.drawImage(k[PECAS.tabuaBeira], 0, 0, 8, P, x0, y, 8, P);
        g.save();
        g.translate(x1, y);
        g.scale(-1, 1);
        g.drawImage(k[PECAS.tabuaBeira], 0, 0, 8, P, 0, 0, 8, P);
        g.restore();
      }
      g.restore();
    }
  }
  // a fornalha (24/11/2026): o chão esquentado, um tom de brasa por cima da areia
  if (s.id >= 14) {
    g.fillStyle = 'rgba(190, 70, 40, 0.13)';
    g.fillRect(0, 0, W, H);
  }
  // as paredes
  for (let l = 0; l < LINHAS; l++) for (let col = 0; col < COLS; col++) if (parede(s, col, l)) paredeDoKit(g, k, s, col, l);
  fundos.set(chave, c);
  return c;
}

/**
 * A parede vista de cima e um pouco de frente, como no pacote: o topo de terra com a beira de pedra para o lado do chão e, onde
 * dá para o chão embaixo, a cornija e a face de tijolo (a textura da peça, presa ao quadro).
 */
function paredeDoKit(g: CanvasRenderingContext2D, k: HTMLCanvasElement[], s: Sala, c: number, l: number) {
  const x = c * TILE;
  const y = l * TILE;
  const N = aberto(s, c, l - 1);
  const S = aberto(s, c, l + 1);
  const O = aberto(s, c - 1, l);
  const L = aberto(s, c + 1, l);
  const FACE = 22;
  const CORNIJA = 10;
  const fimDoTopo = S ? TILE - FACE - CORNIJA : TILE;
  g.fillStyle = KIT.terra;
  g.fillRect(x, y, TILE, TILE);
  // os blocos DENTRO da sala têm o alto de pedra (com a terra, o topo leria como buraco): lajes presas ao quadro, desencontradas
  if (c > 0 && l > 0 && c < COLS - 1 && l < LINHAS - 1) {
    g.save();
    g.beginPath();
    g.rect(x, y, TILE, fimDoTopo);
    g.clip();
    g.fillStyle = KIT.pedraMeio;
    g.fillRect(x, y, TILE, fimDoTopo);
    for (let yy = Math.floor(y / 16) * 16; yy < y + fimDoTopo; yy += 16) {
      const desvio = (yy / 16) % 2 ? 8 : 0;
      for (let xx = Math.floor(x / 16) * 16 - 16 + desvio; xx < x + TILE; xx += 16) {
        g.fillStyle = KIT.pedra;
        g.fillRect(xx + 2, yy + 2, 14, 12);
        g.fillStyle = '#a4b0c6';
        g.fillRect(xx + 2, yy + 12, 14, 2);
      }
    }
    g.restore();
  }
  if (S) {
    // a face de tijolo: a textura presa ao quadro, com a grade de vez em quando
    g.save();
    g.beginPath();
    g.rect(x, y + TILE - FACE, TILE, FACE);
    g.clip();
    const comGrade = sorteio(c, l, s.id + 3) < (s.id >= 8 ? 0.22 : 0.1) && c % 2 === 1;
    for (let yy = Math.floor((y + TILE - FACE) / P) * P; yy < y + TILE; yy += P) {
      for (let xx = Math.floor(x / P) * P; xx < x + TILE; xx += P) g.drawImage(k[PECAS.tijolo], xx, yy);
    }
    if (comGrade) g.drawImage(k[PECAS.tijoloGrade], 0, 8, 32, 14, x + 4, y + TILE - FACE + 4, 32, 14);
    g.restore();
    // a cornija: a pedra clara com as juntas, a meia sombra e a linha escura
    const yc = y + fimDoTopo;
    g.fillStyle = KIT.contorno;
    g.fillRect(x, yc, TILE, 2);
    g.fillStyle = KIT.pedra;
    g.fillRect(x, yc + 2, TILE, 4);
    g.fillStyle = KIT.pedraMeio;
    g.fillRect(x, yc + 6, TILE, 2);
    g.fillStyle = KIT.pedraEscura;
    g.fillRect(x, yc + 8, TILE, 2);
    g.fillStyle = KIT.pedraMeio;
    for (let xx = Math.ceil(x / 16) * 16; xx < x + TILE; xx += 16) g.fillRect(xx, yc + 2, 2, 4);
    // a base do tijolo encostada no chão
    g.fillStyle = 'rgba(38, 43, 68, 0.35)';
    g.fillRect(x, y + TILE - 2, TILE, 2);
    if (O) {
      g.fillStyle = KIT.contorno;
      g.fillRect(x, yc, 2, TILE - fimDoTopo);
    }
    if (L) {
      g.fillStyle = KIT.contorno;
      g.fillRect(x + TILE - 2, yc, 2, TILE - fimDoTopo);
    }
  }
  // a beira de pedra no topo, para cada lado que dá para o chão: contorno, pedra, contorno
  const beira = (bx: number, by: number, bw: number, bh: number, vertical: boolean) => {
    g.fillStyle = KIT.contorno;
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = KIT.pedra;
    if (vertical) g.fillRect(bx + 2, by, bw - 4, bh);
    else g.fillRect(bx, by + 2, bw, bh - 4);
  };
  if (N) beira(x, y, TILE, 8, false);
  if (O) beira(x, y, 8, fimDoTopo, true);
  if (L) beira(x + TILE - 8, y, 8, fimDoTopo, true);
  if (N && O) beira(x, y, 8, 8, false);
  if (N && L) beira(x + TILE - 8, y, 8, 8, false);
  // os cantos de dentro: a parede dos dois lados e o chão na diagonal
  const canto = (bx: number, by: number) => {
    g.fillStyle = KIT.contorno;
    g.fillRect(bx, by, 8, 8);
    g.fillStyle = KIT.pedra;
    g.fillRect(bx + 2, by + 2, 4, 4);
  };
  if (!N && !O && aberto(s, c - 1, l - 1)) canto(x, y);
  if (!N && !L && aberto(s, c + 1, l - 1)) canto(x + TILE - 8, y);
  if (!S && !O && aberto(s, c - 1, l + 1)) canto(x, y + TILE - 8);
  if (!S && !L && aberto(s, c + 1, l + 1)) canto(x + TILE - 8, y + TILE - 8);
}

/** O chão de pedra: lajes desencontradas, um pouco diferentes de casa para casa. */
function chao(g: CanvasRenderingContext2D, s: Sala, c: number, l: number) {
  const x = c * TILE;
  const y = l * TILE;
  px(g, x, y, TILE, TILE, (c + l) % 2 ? COR.chao : COR.chao2);
  px(g, x, y + 18, TILE, 2, COR.junta);
  px(g, x, y + 38, TILE, 2, COR.junta);
  px(g, x + (l % 2 ? 12 : 28), y, 2, 18, COR.junta);
  px(g, x + (l % 2 ? 30 : 8), y + 20, 2, 18, COR.junta);
  // uma pedrinha aqui e ali
  if ((c * 7 + l * 13) % 5 === 0) px(g, x + 22, y + 8, 4, 2, COR.junta);
  // a sombra da parede de cima e da da esquerda
  if (parede(s, c, l - 1)) px(g, x, y, TILE, 8, 'rgba(30, 20, 18, 0.35)');
  if (parede(s, c - 1, l)) px(g, x, y, 6, TILE, 'rgba(30, 20, 18, 0.25)');
}

/** A parede: o topo de tijolos e, onde dá para o chão embaixo, a face mais escura. */
function blocoDeParede(g: CanvasRenderingContext2D, s: Sala, c: number, l: number) {
  const x = c * TILE;
  const y = l * TILE;
  px(g, x, y, TILE, TILE, COR.topo);
  for (let k = 0; k < 4; k++) {
    px(g, x, y + k * 10 + 8, TILE, 2, COR.face);
    px(g, x + ((k + c) % 2 ? 10 : 30), y + k * 10, 2, 8, COR.face);
  }
  px(g, x, y, TILE, 2, COR.topoClaro);
  if (!parede(s, c, l + 1) && l + 1 < LINHAS) {
    // a face que dá para o chão
    px(g, x, y + 26, TILE, 14, COR.face);
    px(g, x, y + 38, TILE, 2, COR.contorno);
    px(g, x + 12, y + 28, 2, 10, COR.contorno);
    px(g, x + 30, y + 28, 2, 10, COR.contorno);
  }
}

function agua(g: CanvasRenderingContext2D, c: number, l: number, tempo: number) {
  const x = c * TILE;
  const y = l * TILE;
  px(g, x, y, TILE, TILE, COR.agua);
  const f = Math.floor(tempo / 400 + c + l * 3) % 4;
  px(g, x + 4 + f * 6, y + 10, 10, 2, COR.aguaClara);
  px(g, x + 22 - f * 4, y + 28, 12, 2, COR.aguaClara);
  // a beira de pedra em cima
  px(g, x, y, TILE, 2, COR.contorno);
}

/** A água no cenário do pacote (que não traz água): o fundo e as marolas por código, nas cores dele, com a beira escura. */
function aguaDoKit(g: CanvasRenderingContext2D, s: Sala, m: Mundo, c: number, l: number, tempo: number) {
  const x = c * TILE;
  const y = l * TILE;
  const molhada = (cc: number, ll: number) => {
    if (cc < 0 || ll < 0 || cc >= COLS || ll >= LINHAS) return true;
    const ch = s.grade[ll][cc];
    return ch === '~' || (ch === '=' && !m.ponte);
  };
  g.fillStyle = '#3a6a94';
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = '#335d85';
  g.fillRect(x + ((c * 13 + l * 7) % 3) * 8, y + 18 + ((c + l) % 2) * 8, 16, 2);
  const f = Math.floor(tempo / 400 + c + l * 3) % 4;
  g.fillStyle = '#5f93bd';
  g.fillRect(x + 4 + f * 6, y + 12, 10, 2);
  g.fillRect(x + 22 - f * 4, y + 28, 12, 2);
  g.fillStyle = '#8fc0e0';
  if (f === 1) g.fillRect(x + 10, y + 12, 2, 2);
  // a beira: a sombra da margem de cima dentro da água, e o contorno do pacote em volta
  if (!molhada(c, l - 1)) {
    g.fillStyle = KIT.noite;
    g.fillRect(x, y, TILE, 6);
    g.fillStyle = '#2c4f74';
    g.fillRect(x, y + 6, TILE, 4);
  }
  g.fillStyle = KIT.contorno;
  if (!molhada(c, l + 1)) g.fillRect(x, y + TILE - 2, TILE, 2);
  if (!molhada(c - 1, l)) g.fillRect(x, y, 2, TILE);
  if (!molhada(c + 1, l)) g.fillRect(x + TILE - 2, y, 2, TILE);
}

function ponte(g: CanvasRenderingContext2D, c: number, l: number) {
  const x = c * TILE;
  const y = l * TILE;
  px(g, x, y, TILE, TILE, COR.tabuaEscura);
  for (let k = 0; k < 4; k++) px(g, x + 2, y + k * 10 + 1, TILE - 4, 7, COR.tabua);
  px(g, x, y, 4, TILE, COR.contorno);
  px(g, x + TILE - 4, y, 4, TILE, COR.contorno);
}

function tocha(g: CanvasRenderingContext2D, c: number, l: number, tempo: number) {
  const x = c * TILE + 20;
  const y = l * TILE + 26;
  px(g, x - 4, y, 8, 8, '#5a4030');
  const f = Math.floor(tempo / 120 + c) % 3;
  px(g, x - 6, y - 10 + f, 12, 10, '#e8743a');
  px(g, x - 4, y - 14 + f, 8, 8, '#f5b04a');
  px(g, x - 2, y - 16 + f, 4, 6, '#fde7a0');
  // a luz no chão em volta
  g.fillStyle = 'rgba(255, 190, 110, 0.10)';
  g.beginPath();
  g.arc(x, y + 20, 46 + f * 2, 0, Math.PI * 2);
  g.fill();
}

function placa(g: CanvasRenderingContext2D, c: number, l: number, apertada: boolean) {
  const x = c * TILE;
  const y = l * TILE;
  if (kit) {
    // o botão de pedra nas cores do pacote (o dele tem 10 px, pequeno demais para a casa): apertado, afunda e acende verde
    px(g, x + 6, y + 6, 28, 28, KIT.contorno);
    px(g, x + 8, y + 8, 24, 24, KIT.pedraEscura);
    if (apertada) {
      px(g, x + 10, y + 12, 20, 18, KIT.pedraMeio);
      px(g, x + 14, y + 16, 12, 10, '#6fbf6a');
      px(g, x + 16, y + 18, 4, 2, '#b8f0a0');
    } else {
      px(g, x + 10, y + 8, 20, 20, KIT.pedra);
      px(g, x + 10, y + 26, 20, 4, KIT.pedraMeio);
      px(g, x + 14, y + 12, 12, 10, KIT.telha);
      px(g, x + 16, y + 14, 8, 6, KIT.areia);
    }
    return;
  }
  px(g, x + 4, y + 4, 32, 32, COR.contorno);
  px(g, x + 6, y + (apertada ? 8 : 6), 28, apertada ? 26 : 26, apertada ? '#7fb06a' : COR.ouroEscuro);
  px(g, x + 10, y + (apertada ? 12 : 10), 20, 18, apertada ? '#a6d48a' : COR.ouro);
  if (!apertada) px(g, x + 6, y + 32, 28, 2, '#5e4418');
}

export function desenharBloco(g: CanvasRenderingContext2D, x: number, y: number) {
  if (pecas()) {
    sombra(g, x, y + 14, 34);
    peca(g, PECAS.bloco, x - 16, y - 18);
    return;
  }
  // o cubo de pedra visto de cima e um pouco de frente
  px(g, x - 20, y - 26, 40, 46, COR.contorno);
  px(g, x - 18, y - 24, 36, 28, '#a8907d');
  px(g, x - 18, y + 4, 36, 14, '#6d5a4e');
  px(g, x - 14, y - 20, 28, 4, '#bea592');
  px(g, x - 2, y - 16, 4, 14, '#8f7867');
}

export function desenharBau(g: CanvasRenderingContext2D, c: number, l: number, aberto: boolean) {
  const x = c * TILE;
  const y = l * TILE;
  if (pecas()) {
    sombra(g, x + 20, y + 36, 32);
    peca(g, aberto ? PECAS.bauAberto : PECAS.bau, x + 4, y + 6);
    return;
  }
  px(g, x + 2, y + 6, 36, 32, COR.contorno);
  px(g, x + 4, y + 18, 32, 18, COR.madeira);
  px(g, x + 4, y + 22, 32, 2, COR.ouroEscuro);
  if (aberto) {
    // a tampa aberta, para trás, e o fundo vazio
    px(g, x + 4, y + 2, 32, 10, '#93633b');
    px(g, x + 6, y + 12, 28, 6, '#2e1f17');
  } else {
    px(g, x + 4, y + 8, 32, 12, '#93633b');
    px(g, x + 4, y + 8, 32, 2, '#b07b4c');
    px(g, x + 4, y + 18, 32, 2, COR.ouro);
    px(g, x + 16, y + 16, 8, 10, COR.ouro);
    px(g, x + 18, y + 20, 4, 4, COR.contorno);
  }
  px(g, x + 4, y + 8, 2, 28, COR.ouroEscuro);
  px(g, x + 34, y + 8, 2, 28, COR.ouroEscuro);
}

export function desenharCristal(g: CanvasRenderingContext2D, c: number, l: number, aceso: boolean, tempo: number) {
  const x = c * TILE + 20;
  const y = l * TILE + 20;
  px(g, x - 12, y + 10, 24, 8, COR.face);
  const brilho = aceso ? 0 : Math.floor(tempo / 300) % 2;
  const [cor, claro] = aceso ? ['#e88a3a', '#ffd08a'] : ['#7a62c8', brilho ? '#d4c6ff' : '#b6a4f0'];
  g.fillStyle = COR.contorno;
  g.beginPath();
  g.moveTo(x, y - 22);
  g.lineTo(x + 14, y - 2);
  g.lineTo(x, y + 14);
  g.lineTo(x - 14, y - 2);
  g.closePath();
  g.fill();
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x, y - 18);
  g.lineTo(x + 10, y - 2);
  g.lineTo(x, y + 10);
  g.lineTo(x - 10, y - 2);
  g.closePath();
  g.fill();
  px(g, x - 4, y - 12, 4, 10, claro);
}

/** A porta: aberta é a passagem escura; fechada, de tábuas; trancada, com o cadeado. */
function desenharPorta(g: CanvasRenderingContext2D, lado: Lado, estado: number) {
  const [c, l] = PORTA[lado];
  const x = c * TILE;
  const y = l * TILE;
  const vertical = lado === 'n' || lado === 's';
  g.save();
  g.translate(x + 20, y + 20);
  if (!vertical) g.rotate(lado === 'o' ? -Math.PI / 2 : Math.PI / 2);
  else if (lado === 's') g.rotate(Math.PI);
  // daqui para baixo, a porta "de cima" (norte): o vão vai de -20 a 20, a parte de dentro fica embaixo (y = 20)
  if (kit) {
    if (estado === 4) {
      // a parede rachada: a parede do fundo já está desenhada, só as rachaduras por cima
      px(g, -2, -4, 4, 8, KIT.contorno);
      px(g, -6, 2, 6, 4, KIT.contorno);
      px(g, 2, 4, 4, 8, KIT.contorno);
      px(g, -10, 8, 8, 4, KIT.contorno);
      px(g, 4, 12, 8, 2, KIT.contorno);
      px(g, -12, 12, 4, 6, KIT.contorno);
      px(g, -4, 0, 2, 2, KIT.pedra);
      px(g, 6, 10, 2, 2, KIT.pedra);
    } else {
      peca(g, estado === 1 ? PECAS.portaAberta : PECAS.porta, -16, -12);
      if (estado === 3) {
        // o cadeado na porta trancada
        px(g, -8, 0, 16, 14, KIT.contorno);
        px(g, -6, 2, 12, 10, '#feae34');
        px(g, -6, -6, 12, 8, KIT.contorno);
        px(g, -4, -4, 8, 6, KIT.pedraMeio);
        px(g, -2, -2, 4, 4, KIT.contorno);
        px(g, -2, 4, 4, 6, KIT.contorno);
      }
    }
    g.restore();
    return;
  }
  if (estado === 4) {
    // a parede rachada (19/11/2026): a parede de sempre, com as rachaduras (a bomba de semente abre)
    px(g, -18, -16, 36, 36, COR.topo);
    px(g, -2, -16, 4, 10, COR.contorno);
    px(g, -6, -8, 6, 4, COR.contorno);
    px(g, 2, -6, 4, 12, COR.contorno);
    px(g, -10, 2, 10, 4, COR.contorno);
    px(g, 4, 6, 8, 4, COR.contorno);
    px(g, -12, 8, 4, 8, COR.contorno);
    g.restore();
    return;
  }
  px(g, -24, -20, 48, 40, COR.contorno);
  if (estado === 1) {
    px(g, -18, -20, 36, 40, '#1d1512');
    px(g, -18, 12, 36, 8, '#3a2b25');
  } else {
    px(g, -18, -16, 36, 36, COR.tabuaEscura);
    for (let k = -16; k < 18; k += 9) px(g, k, -14, 7, 32, COR.tabua);
    px(g, -18, -6, 36, 2, '#4a301c');
    px(g, -18, 10, 36, 2, '#4a301c');
    if (estado === 3) {
      px(g, -8, -4, 16, 14, COR.ouro);
      px(g, -6, -10, 12, 6, COR.ouroEscuro);
      px(g, -2, 0, 4, 6, COR.contorno);
    }
  }
  g.restore();
}

/** A sala inteira, do fundo: chão, água, ponte, paredes, tochas, botões, portas e o baú. */
export function desenharSala(g: CanvasRenderingContext2D, s: Sala, m: Mundo, portas: number[], placas: number[], bau: number, tempo: number, coracaoGrandePego = false) {
  const fundo = fundoDaSala(s, m.ponte);
  if (fundo) {
    // o cenário do Tiny Dungeon: o fundo parado de uma vez, e por cima só a água, que mexe
    g.drawImage(fundo, 0, 0);
    for (let l = 0; l < LINHAS; l++) {
      for (let c = 0; c < COLS; c++) {
        const ch = s.grade[l][c];
        if (ch === '~' || (ch === '=' && !m.ponte)) aguaDoKit(g, s, m, c, l, tempo);
      }
    }
  } else {
    for (let l = 0; l < LINHAS; l++) {
      for (let c = 0; c < COLS; c++) {
        const ch = s.grade[l][c];
        if (ch === '#' || ch === 'T') blocoDeParede(g, s, c, l);
        else if (ch === '~' || (ch === '=' && !m.ponte)) agua(g, c, l, tempo);
        else if (ch === '=') ponte(g, c, l);
        else chao(g, s, c, l);
      }
    }
  }
  casasDe(s, 'T').forEach(([c, l]) => tocha(g, c, l, tempo));
  casasDe(s, 'P').forEach(([c, l], k) => placa(g, c, l, placas[k] === 1));
  (['n', 's', 'o', 'l'] as Lado[]).forEach((lado, k) => portas[k] && desenharPorta(g, lado, portas[k]));
  const b = casasDe(s, 'C')[0];
  if (b && bau) desenharBau(g, b[0], b[1], bau === 2);
  const k = casasDe(s, 'K')[0];
  if (k) desenharCristal(g, k[0], k[1], m.ponte, tempo);
  // os vasos e as moitas que ainda estão na sala, e o coração grande (19/11/2026)
  const fora = new Set((m.fora ?? []).map(([c, l]) => `${c},${l}`));
  casasDe(s, 'M').forEach(([c, l]) => !fora.has(`${c},${l}`) && desenharMoita(g, c * TILE + 20, l * TILE + 20, tempo));
  casasDe(s, 'V').forEach(([c, l]) => !fora.has(`${c},${l}`) && desenharVaso(g, c * TILE + 20, l * TILE + 22));
  casasDe(s, 'E').forEach(([c, l]) => desenharPoste(g, c, l));
  // a fornalha (24/11/2026): o fogo do chão (ou a cinza molhada) e os braseiros
  casasDe(s, 'F').forEach(([c, l]) => (fogoAceso(s, m, c, l) ? desenharFogo(g, c, l, tempo) : desenharCinza(g, c, l)));
  casasDe(s, 'A').forEach(([c, l]) => desenharBraseiro(g, c, l, fogoAceso(s, m, c, l), tempo));
  const h = casasDe(s, 'H')[0];
  if (h && !coracaoGrandePego) desenharCoracaoGrande(g, h[0] * TILE + 20, h[1] * TILE + 18 + Math.sin(tempo / 260) * 2);
}

/** O poste da mina (19/11/2026): a estaca de madeira com a argola de ferro, onde o gancho pega. */
export function desenharPoste(g: CanvasRenderingContext2D, c: number, l: number) {
  const x = c * TILE + 20;
  const y = l * TILE + 20;
  if (kit) {
    // a mesma estaca, nas cores do pacote: a madeira, o contorno e a argola de ferro
    px(g, x - 14, y + 10, 28, 8, 'rgba(63, 38, 49, 0.35)');
    px(g, x - 8, y - 20, 16, 36, KIT.contorno);
    px(g, x - 6, y - 16, 12, 30, KIT.telha);
    px(g, x - 6, y - 16, 4, 30, KIT.areia);
    px(g, x + 2, y - 16, 4, 30, KIT.terra);
    px(g, x - 10, y - 22, 20, 8, KIT.contorno);
    px(g, x - 8, y - 20, 16, 4, KIT.pedraMeio);
    px(g, x - 12, y - 8, 24, 8, KIT.contorno);
    px(g, x - 10, y - 6, 20, 4, KIT.pedra);
    px(g, x - 4, y - 6, 8, 4, KIT.pedraEscura);
    return;
  }
  px(g, x - 14, y + 8, 28, 8, 'rgba(30, 20, 18, 0.35)');
  px(g, x - 8, y - 18, 16, 32, COR.contorno);
  px(g, x - 6, y - 16, 12, 28, COR.madeira);
  px(g, x - 6, y - 16, 4, 28, '#9a6b42');
  px(g, x - 10, y - 20, 20, 6, COR.tabuaEscura);
  px(g, x - 8, y - 8, 16, 2, '#8d96a3');
  px(g, x - 10, y - 10, 4, 6, '#8d96a3');
  px(g, x + 6, y - 10, 4, 6, '#8d96a3');
}

// ---------------- A FORNALHA (24/11/2026) ----------------
/** O fogo do chão: as labaredas que mexem (parede até o regador o apagar). */
export function desenharFogo(g: CanvasRenderingContext2D, c: number, l: number, tempo: number) {
  const x = c * TILE;
  const y = l * TILE;
  px(g, x + 2, y + 26, TILE - 4, 12, '#5a2a1e');
  for (let k = 0; k < 3; k++) {
    const f = Math.floor(tempo / 110 + c * 3 + l * 5 + k * 2) % 4;
    const bx = x + 4 + k * 12;
    px(g, bx, y + 14 - f, 10, 24 + f, '#d8542e');
    px(g, bx + 2, y + 20 - f, 6, 16 + f, '#f0923a');
    px(g, bx + 4, y + 28 - f, 2, 8, '#fde7a0');
  }
  g.fillStyle = 'rgba(255, 140, 70, 0.12)';
  g.beginPath();
  g.arc(x + 20, y + 26, 36, 0, Math.PI * 2);
  g.fill();
}

/** O fogo apagado: a cinza molhada no chão, por onde se passa. */
export function desenharCinza(g: CanvasRenderingContext2D, c: number, l: number) {
  const x = c * TILE;
  const y = l * TILE;
  px(g, x + 4, y + 10, TILE - 8, TILE - 18, 'rgba(60, 48, 46, 0.55)');
  px(g, x + 8, y + 14, 8, 4, '#6d6560');
  px(g, x + 22, y + 22, 10, 4, '#6d6560');
  px(g, x + 14, y + 26, 4, 2, '#5b8fae');
}

/** O braseiro: a bacia de pedra com o fogo (aceso) ou a fumaça (apagado, até acender de novo). */
export function desenharBraseiro(g: CanvasRenderingContext2D, c: number, l: number, aceso: boolean, tempo: number) {
  const x = c * TILE + 20;
  const y = l * TILE + 24;
  px(g, x - 16, y + 6, 32, 8, 'rgba(63, 38, 49, 0.35)');
  px(g, x - 6, y, 12, 10, KIT.contorno);
  px(g, x - 4, y, 8, 8, KIT.pedraEscura);
  px(g, x - 16, y - 10, 32, 12, KIT.contorno);
  px(g, x - 14, y - 8, 28, 8, KIT.pedraMeio);
  px(g, x - 14, y - 8, 28, 2, KIT.pedra);
  if (aceso) {
    const f = Math.floor(tempo / 110 + c) % 3;
    px(g, x - 10, y - 22 + f, 20, 14, '#d8542e');
    px(g, x - 6, y - 26 + f, 12, 14, '#f0923a');
    px(g, x - 2, y - 28 + f, 4, 8, '#fde7a0');
    g.fillStyle = 'rgba(255, 170, 90, 0.12)';
    g.beginPath();
    g.arc(x, y - 6, 44, 0, Math.PI * 2);
    g.fill();
  } else {
    const s = Math.floor(tempo / 200 + c) % 3;
    px(g, x - 4, y - 18 - s * 2, 6, 6, 'rgba(200, 200, 210, 0.45)');
    px(g, x + 2, y - 26 - s * 2, 6, 6, 'rgba(200, 200, 210, 0.3)');
  }
}

/** O regador (o item da fornalha): o bico comprido, a alça e a água. */
export function desenharRegador(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x - 10, y - 8, 16, 16, COR.contorno);
  px(g, x - 8, y - 6, 12, 12, '#5b8fae');
  px(g, x - 8, y - 6, 12, 2, '#9cc6dc');
  px(g, x + 4, y - 4, 4, 4, COR.contorno);
  px(g, x + 6, y - 8, 4, 4, COR.contorno);
  px(g, x + 8, y - 12, 4, 4, '#5b8fae');
  px(g, x - 12, y - 12, 4, 10, COR.contorno);
  px(g, x - 10, y - 14, 8, 4, COR.contorno);
}

/** O jato do regador: a água de quem rega até onde o jato para, um instante. */
export function desenharJato(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, tempo: number) {
  g.strokeStyle = 'rgba(120, 190, 230, 0.85)';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = 'rgba(220, 240, 255, 0.8)';
  g.lineWidth = 2;
  g.stroke();
  g.lineWidth = 1;
  // os pingos na ponta
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + tempo / 90;
    px(g, x1 + Math.cos(a) * 10, y1 + Math.sin(a) * 8, 4, 4, '#9cc6dc');
  }
}

/** O gancho (o item da mina): a corda enrolada com a garra de ferro. */
export function desenharGancho(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x - 10, y - 4, 14, 14, COR.contorno);
  px(g, x - 8, y - 2, 10, 10, '#c8a26a');
  px(g, x - 6, y, 6, 6, '#8a6a3c');
  px(g, x + 2, y - 10, 4, 12, '#8d96a3');
  px(g, x + 2, y - 12, 10, 4, '#8d96a3');
  px(g, x + 10, y - 10, 4, 6, '#8d96a3');
}

/** A corda do gancho, do poste até quem foi puxado (um instante). */
export function desenharCorda(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.strokeStyle = '#c8a26a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.lineWidth = 1;
}

/** O vaso de barro (19/11/2026): levanta-se e joga-se. (x, y) é o meio dele. */
export function desenharVaso(g: CanvasRenderingContext2D, x: number, y: number) {
  if (pecas()) {
    // o barril do pacote faz o papel do vaso (levanta-se e joga-se do mesmo jeito)
    peca(g, PECAS.barril, x - 16, y - 18);
    return;
  }
  px(g, x - 14, y - 14, 28, 30, COR.contorno);
  px(g, x - 12, y - 8, 24, 22, '#b86a3e');
  px(g, x - 8, y - 14, 16, 6, '#b86a3e');
  px(g, x - 10, y - 12, 20, 2, '#7a4226');
  px(g, x - 8, y - 4, 4, 12, '#d88a58');
  px(g, x - 12, y + 4, 24, 2, '#7a4226');
}

/** A moita: a pá corta. */
export function desenharMoita(g: CanvasRenderingContext2D, x: number, y: number, tempo: number) {
  const b = Math.floor(tempo / 500 + x) % 2;
  px(g, x - 18, y - 12, 36, 28, '#2f4a26');
  px(g, x - 16, y - 14 + b, 14, 14, '#4f7a3a');
  px(g, x, y - 16 + b, 16, 16, '#5e8c44');
  px(g, x - 14, y - 2, 28, 14, '#4f7a3a');
  px(g, x - 8, y - 10 + b, 4, 4, '#86b25e');
  px(g, x + 6, y - 12 + b, 4, 4, '#86b25e');
}

/** O coração grande da sala secreta: um coração a mais. */
export function desenharCoracaoGrande(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.scale(1.8, 1.8);
  desenharCoracao(g, 0, 0, true);
  g.restore();
  px(g, x - 2, y - 26, 4, 6, '#fde7a0');
  px(g, x + 18, y - 16, 4, 4, '#fde7a0');
}

/** A bomba de semente: a semente grande, com o pavio que pisca mais depressa no fim. */
export function desenharBomba(g: CanvasRenderingContext2D, x: number, y: number, falta: number) {
  const pisca = Math.floor(falta / (falta < 500 ? 60 : 160)) % 2 === 0;
  px(g, x - 12, y - 10, 24, 22, COR.contorno);
  px(g, x - 10, y - 8, 20, 18, pisca ? '#c94a3a' : '#7a5a2e');
  px(g, x - 6, y - 6, 6, 4, '#e8c08a');
  px(g, x - 2, y - 16, 4, 6, '#6fb04a');
}

/** A semente no chão (a turma pega e usa como bomba). */
export function desenharSemente(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x - 8, y - 6, 16, 14, COR.contorno);
  px(g, x - 6, y - 4, 12, 10, '#7a5a2e');
  px(g, x - 4, y - 2, 4, 2, '#e8c08a');
  px(g, x - 2, y - 10, 4, 4, '#6fb04a');
}

// ---------------- OS ITENS E OS EFEITOS ----------------
/** A cenoura (no chão do HUD, ou girando no ar). */
export function desenharCenoura(g: CanvasRenderingContext2D, x: number, y: number, giro: number, tam = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(giro);
  g.scale(tam, tam);
  g.fillStyle = COR.contorno;
  g.beginPath();
  g.moveTo(-12, -4);
  g.lineTo(10, -1);
  g.lineTo(10, 3);
  g.lineTo(-12, 6);
  g.closePath();
  g.fill();
  g.fillStyle = '#ef8a2e';
  g.beginPath();
  g.moveTo(-10, -2);
  g.lineTo(8, 0);
  g.lineTo(8, 2);
  g.lineTo(-10, 4);
  g.closePath();
  g.fill();
  g.fillStyle = '#6fb04a';
  g.fillRect(8, -5, 6, 3);
  g.fillRect(8, 3, 6, 3);
  g.fillRect(10, -1, 6, 3);
  g.restore();
}

export function desenharChave(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x - 10, y - 8, 12, 12, COR.contorno);
  px(g, x - 8, y - 6, 8, 8, COR.ouro);
  px(g, x - 6, y - 4, 4, 4, COR.contorno);
  px(g, x, y - 4, 14, 4, COR.ouro);
  px(g, x + 8, y, 2, 4, COR.ouro);
  px(g, x + 12, y, 2, 6, COR.ouro);
}

export function desenharCoracao(g: CanvasRenderingContext2D, x: number, y: number, cheio: boolean) {
  const cor = cheio ? '#e2574a' : '#4d3a36';
  px(g, x - 8, y - 6, 6, 4, cor);
  px(g, x + 2, y - 6, 6, 4, cor);
  px(g, x - 10, y - 4, 20, 6, cor);
  px(g, x - 8, y + 2, 16, 2, cor);
  px(g, x - 6, y + 4, 12, 2, cor);
  px(g, x - 2, y + 6, 4, 2, cor);
  if (cheio) px(g, x - 6, y - 4, 4, 2, '#f7a69c');
}

/** O golpe da pá: um arco claro na frente do coelho. */
export function desenharGolpe(g: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number) {
  const ang = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][dir];
  const k = Math.max(0, Math.min(1, (t - 40) / 180));
  g.save();
  g.translate(x, y);
  g.strokeStyle = `rgba(255, 244, 214, ${0.85 - k * 0.6})`;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 30, ang - 1.1 + k * 0.6, ang + 1.1 * k);
  g.stroke();
  // a pá na ponta
  const a = ang - 1.1 + k * 2.2;
  const ex = Math.cos(a) * 30;
  const ey = Math.sin(a) * 30;
  g.fillStyle = '#7b5634';
  g.fillRect(Math.cos(a) * 12 - 2, Math.sin(a) * 12 - 2, 4, 4);
  g.fillStyle = '#c8cdd2';
  g.fillRect(ex - 5, ey - 5, 10, 10);
  g.fillStyle = '#8c949b';
  g.fillRect(ex - 3, ey - 3, 6, 6);
  g.restore();
}

export interface Efeito {
  tipo: 'faisca' | 'puf' | 'item' | 'estrelas';
  x: number;
  y: number;
  em: number;
  /** No 'item': qual. */
  item?: 'cenoura' | 'chave' | 'gancho' | 'regador';
}

/** Desenha um efeito; devolve false quando ele acabou. */
export function desenharEfeito(g: CanvasRenderingContext2D, e: Efeito, tempo: number): boolean {
  const t = tempo - e.em;
  if (t < 0) return true;
  if (e.tipo === 'faisca') {
    if (t > 180) return false;
    const r = 6 + t / 20;
    g.fillStyle = '#fff4d6';
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      px(g, e.x + Math.cos(a) * r - 2, e.y + Math.sin(a) * r - 2, 4, 4, '#fff4d6');
    }
    return true;
  }
  if (e.tipo === 'puf') {
    // a fumacinha do bicho que sumiu (desenho, sem sangue: ele vira poeira e some)
    if (t > 500) return false;
    const k = t / 500;
    g.fillStyle = `rgba(240, 232, 220, ${0.9 - k * 0.9})`;
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      g.beginPath();
      g.arc(e.x + Math.cos(a) * (8 + k * 20), e.y - 14 + Math.sin(a) * (6 + k * 14), 8 - k * 4, 0, Math.PI * 2);
      g.fill();
    }
    return true;
  }
  if (e.tipo === 'estrelas') {
    if (t > 1500) return false;
    for (let n = 0; n < 3; n++) {
      const a = tempo / 200 + (n * Math.PI * 2) / 3;
      px(g, e.x + Math.cos(a) * 12 - 2, e.y - 36 + Math.sin(a) * 4, 4, 4, '#ffe27a');
    }
    return true;
  }
  // o item que saiu do baú: sobe em cima de quem abriu e fica um instante
  if (t > 1800) return false;
  const y = e.y - 50 - Math.min(16, t / 20);
  g.fillStyle = 'rgba(255, 236, 170, 0.35)';
  g.beginPath();
  g.arc(e.x, y, 16, 0, Math.PI * 2);
  g.fill();
  if (e.item === 'chave') desenharChave(g, e.x, y);
  else if (e.item === 'gancho') desenharGancho(g, e.x, y);
  else if (e.item === 'regador') desenharRegador(g, e.x, y);
  else desenharCenoura(g, e.x, y, -0.6, 1.3);
  return true;
}

export function sombra(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  g.fillStyle = 'rgba(30, 20, 18, 0.35)';
  g.beginPath();
  g.ellipse(x, y, w / 2, w / 5, 0, 0, Math.PI * 2);
  g.fill();
}

/** O tiro do cacto e do rei: uma semente que pulsa. */
export function desenharTiro(g: CanvasRenderingContext2D, x: number, y: number, tempo: number) {
  const r = Math.floor(tempo / 80) % 2;
  px(g, x - 6 - r, y - 6 - r, 12 + 2 * r, 12 + 2 * r, '#5a8a2a');
  px(g, x - 4, y - 4, 8, 8, '#b8e070');
  px(g, x - 2, y - 4, 2, 2, '#e8f8c8');
}

/**
 * O MAPA DO CANTO (melhorado em 19/11/2026): as salas vistas e os corredores entre elas, a de agora acesa, a do chefe com a
 * coroa depois de vista, e os pontinhos da turma DENTRO da sala de agora (onde cada um está).
 */
export function desenharMapa(g: CanvasRenderingContext2D, atual: number, vistas: number[], turma: { x: number; y: number; eu: boolean }[] = [], chefe = -1) {
  const T = 14;
  const x0 = W - 4 * T - 10;
  const y0 = 8;
  g.fillStyle = 'rgba(30, 20, 18, 0.55)';
  g.fillRect(x0 - 4, y0 - 4, 4 * T + 8, 7 * T + 8);
  const meio = (s: Sala) => [x0 + s.mapa[0] * T + T / 2, y0 + (s.mapa[1] - 1) * T + T / 2];
  // os corredores: entre duas salas vistas ligadas por uma porta
  g.fillStyle = '#7a6656';
  for (const s of SALAS) {
    if (!vistas.includes(s.id)) continue;
    for (const p of Object.values(s.portas)) {
      if (!p || !vistas.includes(p.para)) continue;
      const [ax, ay] = meio(s);
      const [bx, by] = meio(SALAS[p.para]);
      g.fillRect(Math.min(ax, bx) - 1, Math.min(ay, by) - 1, Math.abs(bx - ax) + 2, Math.abs(by - ay) + 2);
    }
  }
  for (const s of SALAS) {
    if (!vistas.includes(s.id)) continue;
    const [c, l] = s.mapa;
    g.fillStyle = s.id === atual ? '#ffd27a' : '#9c8574';
    g.fillRect(x0 + c * T + 1, y0 + (l - 1) * T + 1, T - 2, T - 2);
    if (s.id === chefe) {
      g.fillStyle = '#c94a3a';
      g.fillRect(x0 + c * T + 4, y0 + (l - 1) * T + 4, T - 8, 3);
      g.fillRect(x0 + c * T + 4, y0 + (l - 1) * T + 2, 2, 2);
      g.fillRect(x0 + c * T + T - 6, y0 + (l - 1) * T + 2, 2, 2);
    }
  }
  // onde a turma está, dentro da sala de agora
  const s = SALAS[atual];
  if (!s) return;
  for (const p of turma) {
    g.fillStyle = p.eu ? '#ffffff' : '#5fb0e8';
    g.fillRect(Math.round(x0 + s.mapa[0] * T + 1 + (p.x / W) * (T - 4)), Math.round(y0 + (s.mapa[1] - 1) * T + 1 + (p.y / H) * (T - 4)), 2, 2);
  }
}
