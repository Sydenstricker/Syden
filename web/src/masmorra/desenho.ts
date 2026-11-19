/**
 * O DESENHO DA MASMORRA DA TOCA (16/11/2026): tudo por código, em "pixels" de 2 px (o quadro é 680 × 440 e o coelho e os bichos
 * são as folhas da Briga na horta, em tamanho natural). A paleta é a de pedra morna do quarto, sem preto puro. Nada aqui é de
 * jogo nenhum: as salas, as portas, o baú, o cristal e a cenoura que vai e volta são desenhos daqui.
 */
import { casasDe, COLS, LARGURA, LINHAS, PORTA, SALAS, TILE, type Lado, type Mundo, type Sala } from './regras';

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
  px(g, x + 4, y + 4, 32, 32, COR.contorno);
  px(g, x + 6, y + (apertada ? 8 : 6), 28, apertada ? 26 : 26, apertada ? '#7fb06a' : COR.ouroEscuro);
  px(g, x + 10, y + (apertada ? 12 : 10), 20, 18, apertada ? '#a6d48a' : COR.ouro);
  if (!apertada) px(g, x + 6, y + 32, 28, 2, '#5e4418');
}

export function desenharBloco(g: CanvasRenderingContext2D, x: number, y: number) {
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
  for (let l = 0; l < LINHAS; l++) {
    for (let c = 0; c < COLS; c++) {
      const ch = s.grade[l][c];
      if (ch === '#' || ch === 'T') blocoDeParede(g, s, c, l);
      else if (ch === '~' || (ch === '=' && !m.ponte)) agua(g, c, l, tempo);
      else if (ch === '=') ponte(g, c, l);
      else chao(g, s, c, l);
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
  const h = casasDe(s, 'H')[0];
  if (h && !coracaoGrandePego) desenharCoracaoGrande(g, h[0] * TILE + 20, h[1] * TILE + 18 + Math.sin(tempo / 260) * 2);
}

/** O poste da mina (19/11/2026): a estaca de madeira com a argola de ferro, onde o gancho pega. */
export function desenharPoste(g: CanvasRenderingContext2D, c: number, l: number) {
  const x = c * TILE + 20;
  const y = l * TILE + 20;
  px(g, x - 14, y + 8, 28, 8, 'rgba(30, 20, 18, 0.35)');
  px(g, x - 8, y - 18, 16, 32, COR.contorno);
  px(g, x - 6, y - 16, 12, 28, COR.madeira);
  px(g, x - 6, y - 16, 4, 28, '#9a6b42');
  px(g, x - 10, y - 20, 20, 6, COR.tabuaEscura);
  px(g, x - 8, y - 8, 16, 2, '#8d96a3');
  px(g, x - 10, y - 10, 4, 6, '#8d96a3');
  px(g, x + 6, y - 10, 4, 6, '#8d96a3');
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
  item?: 'cenoura' | 'chave' | 'gancho';
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
