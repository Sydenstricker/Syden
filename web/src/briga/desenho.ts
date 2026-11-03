/**
 * O DESENHO DA BRIGA NA HORTA (03/11/2026): tudo por código, numa tela de 320 × 180 ampliada com os pixels nítidos — a horta
 * (céu, morros, cerca e canteiros em camadas que correm em velocidades diferentes), as raposas, os corvos, o texugo, as
 * faíscas e a poeira. Só o coelho é imagem: o mascote 3D de lado (web/public/briga/coelho.png, do briga.py), com as cores do
 * avatar de cada um por troca de paleta, como o kart.
 *
 * Nada aqui é de outro jogo: os bichos são formas simples, com a preparação de cada golpe bem visível (é ela que paga os
 * 200 ms de internet).
 */
import { CORES_DOS_AVATARES, MOLETOM_DO_MASCOTE, PELO_DO_MASCOTE } from '../corrida/coresDosAvatares';
import type { Acao, EstadoDoInimigo, TipoDeInimigo } from './regras';

export const W = 320;
export const H = 180;
/** Onde fica o fundo da faixa do chão na tela (y = 0); a frente é CHAO + PROF. */
export const CHAO = 110;

/** Da posição no mundo à tela. */
export const naTela = (camX: number, x: number, y: number, z: number) => ({ sx: Math.round(x - camX), sy: Math.round(CHAO + y - z) });

// ---------------- A HORTA ----------------
const CEU = ['#f3d9b8', '#ecc9a8', '#e3b99c'];

export function desenharFundo(g: CanvasRenderingContext2D, camX: number, fim: number) {
  // o céu em faixas (sem gradiente: pixel art)
  CEU.forEach((c, k) => {
    g.fillStyle = c;
    g.fillRect(0, k * 22, W, 22);
  });
  g.fillStyle = '#dcae92';
  g.fillRect(0, 66, W, 20);
  // o sol baixo
  g.fillStyle = '#f7e6c4';
  g.beginPath();
  g.arc(250 - camX * 0.05, 34, 12, 0, Math.PI * 2);
  g.fill();
  // os morros de longe (correm devagar)
  morros(g, camX * 0.2, 70, 18, '#a6a083', 0.011);
  morros(g, camX * 0.35, 82, 14, '#8e9a6c', 0.017);
  // a cerca (corre na metade)
  const cx = camX * 0.6;
  g.fillStyle = '#7a8f58';
  g.fillRect(0, 92, W, CHAO - 92);
  g.fillStyle = '#b08a62';
  g.fillRect(0, 96, W, 2);
  g.fillRect(0, 102, W, 2);
  g.fillStyle = '#9a7652';
  for (let x = -((cx % 18) + 18); x < W + 18; x += 18) g.fillRect(Math.round(x), 93, 3, 15);
  g.fillStyle = '#c69c72';
  for (let x = -((cx % 18) + 18); x < W + 18; x += 18) g.fillRect(Math.round(x), 93, 1, 15);
  // o chão da horta: terra, com os canteiros em fileiras (correm junto com o mundo)
  g.fillStyle = '#8a6a4c';
  g.fillRect(0, CHAO - 2, W, H - CHAO + 2);
  for (let k = 0; k < 4; k++) {
    const y = CHAO + 4 + k * 17;
    g.fillStyle = k % 2 ? '#7e5f44' : '#94735a';
    g.fillRect(0, y, W, 8);
  }
  // as plantas dos canteiros (cenoura e repolho), presas ao mundo
  for (let k = 0; k < 4; k++) {
    const y = CHAO + 6 + k * 17;
    const passo = 26 + k * 3;
    const inicio = Math.floor((camX - 20) / passo) * passo;
    for (let x = inicio; x < camX + W + 20; x += passo) {
      const h = (Math.sin(x * 12.9898 + k * 78.233) * 43758.5453) % 1;
      if (Math.abs(h) < 0.35) continue;
      const sx = Math.round(x - camX + (k % 2) * 9);
      if (Math.abs(h) > 0.7) repolho(g, sx, y);
      else cenoura(g, sx, y);
    }
  }
  // o fim da fase: o portão da horta
  if (fim - camX < W + 30) {
    const sx = Math.round(fim - camX);
    g.fillStyle = '#6e5038';
    g.fillRect(sx, 84, 6, CHAO - 80);
    g.fillRect(sx + 34, 84, 6, CHAO - 80);
    g.fillStyle = '#b08a62';
    g.fillRect(sx, 84, 40, 4);
  }
}

function morros(g: CanvasRenderingContext2D, desloc: number, base: number, alto: number, cor: string, f: number) {
  g.fillStyle = cor;
  for (let x = 0; x < W; x += 2) {
    const h = alto * (0.55 + 0.45 * Math.sin((x + desloc) * f) * Math.sin((x + desloc) * f * 0.37 + 1));
    g.fillRect(x, Math.round(base - h), 2, Math.round(h) + 30);
  }
}

function cenoura(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#6f9a4e';
  g.fillRect(x - 1, y - 4, 1, 4);
  g.fillRect(x + 1, y - 5, 1, 5);
  g.fillRect(x + 3, y - 4, 1, 4);
  g.fillStyle = '#d98a3e';
  g.fillRect(x, y, 3, 2);
}

function repolho(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#6f9a4e';
  g.fillRect(x - 3, y - 3, 8, 5);
  g.fillStyle = '#9cc072';
  g.fillRect(x - 1, y - 4, 4, 4);
  g.fillStyle = '#c4dd98';
  g.fillRect(x, y - 3, 2, 2);
}

/** A sombra no chão, embaixo de tudo o que anda (no alto, menor). */
export function sombra(g: CanvasRenderingContext2D, sx: number, chao: number, largura: number, z: number) {
  const w = Math.max(4, largura - z * 0.25);
  g.fillStyle = '#5c4434';
  g.fillRect(Math.round(sx - w / 2), chao - 1, Math.round(w), 2);
  g.fillRect(Math.round(sx - w / 2 + 2), chao - 2, Math.round(w - 4), 1);
}

// ---------------- O COELHO (a folha do Blender, com as cores do avatar) ----------------
/** A ordem e o tamanho das animações na folha (o briga-pos.py tem a mesma). */
export const FOLHA = { lado: 80, peX: 42, peY: 69 };
const ANIMS: [Acao | 'parado', number][] = [
  ['parado', 4], ['andando', 8], ['soco1', 2], ['soco2', 2], ['soco3', 3], ['pulo', 2], ['voadora', 1], ['dor', 2], ['caido', 2],
  ['levantando', 2], ['especial', 4],
];
const INICIO: Record<string, number> = {};
{
  let k = 0;
  for (const [nome, n] of ANIMS) {
    INICIO[nome] = k;
    k += n;
  }
}

/** Qual desenho da folha, pela ação e o tempo dela (ms). O ritmo é "em dois", 12 por segundo. */
export function desenhoDoCoelho(acao: Acao, t: number, subindo: boolean): number {
  const q = (n: number, ms = 83) => Math.floor(t / ms) % n;
  switch (acao) {
    case 'parado':
      return INICIO.parado + q(4, 160);
    case 'andando':
      return INICIO.andando + q(8);
    case 'soco1':
    case 'soco2':
      return INICIO[acao] + (t < 70 ? 0 : 1);
    case 'soco3':
      return INICIO.soco3 + (t < 110 ? 0 : t < 200 ? 1 : 2);
    case 'pulo':
      return INICIO.pulo + (subindo ? 0 : 1);
    case 'voadora':
      return INICIO.voadora;
    case 'dor':
      return INICIO.dor + (t < 150 ? 0 : 1);
    case 'caido':
      return INICIO.caido + (t < 180 ? 0 : 1);
    case 'levantando':
      return INICIO.levantando + (t < 220 ? 0 : 1);
    case 'especial':
      return INICIO.especial + q(4, 70);
  }
}

/** A folha com as cores do avatar (a troca de paleta do kart, a mesma tabela). Guardada por avatar. */
const folhas = new Map<number, HTMLCanvasElement>();
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
export function folhaDe(base: HTMLImageElement, avatar: number | null): CanvasImageSource | null {
  if (!base.complete || !base.naturalWidth) return null;
  const cores = avatar ? CORES_DOS_AVATARES[avatar] : undefined;
  if (!cores) return base;
  const pronta = folhas.get(avatar!);
  if (pronta) return pronta;
  const c = document.createElement('canvas');
  c.width = base.naturalWidth;
  c.height = base.naturalHeight;
  const g = c.getContext('2d')!;
  g.drawImage(base, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const chave = (r: number, gg: number, b: number) => (r << 16) | (gg << 8) | b;
  const pelo = new Set(PELO_DO_MASCOTE.map(([r, gg, b]) => chave(r, gg, b)));
  const moletom = new Set(MOLETOM_DO_MASCOTE.map(([r, gg, b]) => chave(r, gg, b)));
  const peloBase = lum(227, 205, 227), moletomBase = lum(61, 43, 54);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const k = chave(px[i], px[i + 1], px[i + 2]);
    let alvo: [number, number, number] | null = null;
    let f = 1;
    if (pelo.has(k)) {
      alvo = cores.pelo;
      f = lum(px[i], px[i + 1], px[i + 2]) / peloBase;
    } else if (moletom.has(k)) {
      alvo = cores.roupa;
      f = 0.72 + (0.28 * lum(px[i], px[i + 1], px[i + 2])) / moletomBase;
    }
    if (!alvo) continue;
    px[i] = Math.min(255, Math.round(alvo[0] * f));
    px[i + 1] = Math.min(255, Math.round(alvo[1] * f));
    px[i + 2] = Math.min(255, Math.round(alvo[2] * f));
  }
  g.putImageData(img, 0, 0);
  folhas.set(avatar!, c);
  return c;
}

export function desenharCoelho(
  g: CanvasRenderingContext2D,
  folha: CanvasImageSource | null,
  sx: number,
  sy: number,
  lado: number,
  quadro: number,
  opcoes: { piscando?: boolean; nome?: string; eu?: boolean },
) {
  if (opcoes.piscando && Math.floor(performance.now() / 80) % 2 === 0) return;
  const { lado: L, peX, peY } = FOLHA;
  if (folha) {
    g.save();
    g.translate(sx, sy);
    if (lado < 0) g.scale(-1, 1);
    g.drawImage(folha, quadro * L, 0, L, L, -peX, -peY, L, L);
    g.restore();
  } else {
    // a folha ainda não chegou: um coelho de blocos no lugar, para a tela não mentir que ninguém está ali
    g.fillStyle = '#e8dcec';
    g.fillRect(sx - 8, sy - 34, 16, 20);
    g.fillRect(sx - 5, sy - 48, 4, 14);
    g.fillStyle = '#3d2b36';
    g.fillRect(sx - 9, sy - 16, 18, 16);
  }
  if (opcoes.nome) {
    g.font = '7px sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#1e1822';
    g.fillText(opcoes.nome, sx + 1, sy - 54);
    g.fillStyle = opcoes.eu ? '#ffe7a0' : '#fbf3e4';
    g.fillText(opcoes.nome, sx, sy - 55);
  }
}

// ---------------- OS BICHOS ----------------
interface Bicho {
  tipo: TipoDeInimigo;
  estado: EstadoDoInimigo;
  lado: number;
  /** Passos no estado (o servidor manda): a preparação anda junto com a do servidor. */
  passos: number;
  hp: number;
  piscando: boolean;
}

/** Um retângulo espelhado pelo lado: x é para a frente do bicho. */
const ret = (g: CanvasRenderingContext2D, sx: number, sy: number, lado: number, x: number, y: number, w: number, h: number) =>
  g.fillRect(lado > 0 ? sx + x : sx - x - w, sy + y, w, h);

export function desenharBicho(g: CanvasRenderingContext2D, b: Bicho, sx: number, sy: number, tempo: number) {
  if (b.estado === 'morto' && Math.floor(tempo / 90) % 2 === 0) return;
  if (b.tipo === 'raposa') raposa(g, b, sx, sy, tempo);
  else if (b.tipo === 'corvo') corvo(g, b, sx, sy, tempo);
  else texugo(g, b, sx, sy, tempo);
}

function raposa(g: CanvasRenderingContext2D, b: Bicho, sx: number, sy: number, tempo: number) {
  const L = b.lado;
  const cor = b.piscando ? '#fff4e0' : '#cf7440';
  const escura = b.piscando ? '#f4dcc0' : '#a85a32';
  if (b.estado === 'caido' || b.estado === 'morto') {
    // deitada de lado
    g.fillStyle = escura;
    ret(g, sx, sy, L, -16, -8, 30, 7);
    g.fillStyle = cor;
    ret(g, sx, sy, L, -14, -10, 24, 6);
    ret(g, sx, sy, L, 8, -12, 9, 8);
    g.fillStyle = '#f3e6d4';
    ret(g, sx, sy, L, -20, -9, 6, 4);
    return;
  }
  const passo = b.estado === 'andando' || b.estado === 'entrando' ? Math.floor(tempo / 120) % 2 : 0;
  const recua = b.estado === 'preparando' ? -3 : b.estado === 'atacando' ? 3 : 0;
  // o rabo
  g.fillStyle = escura;
  ret(g, sx, sy, L, -16 + recua, -22, 8, 5);
  g.fillStyle = '#f3e6d4';
  ret(g, sx, sy, L, -19 + recua, -23, 4, 4);
  // as pernas
  g.fillStyle = '#4e3428';
  ret(g, sx, sy, L, -6 + passo * 2, -8, 3, 8);
  ret(g, sx, sy, L, 3 - passo * 2, -8, 3, 8);
  // o corpo, de pé
  g.fillStyle = cor;
  ret(g, sx, sy, L, -8 + recua, -30, 15, 22);
  g.fillStyle = '#f3e6d4';
  ret(g, sx, sy, L, 1 + recua, -26, 6, 14);
  // a cabeça e as orelhas pontudas
  g.fillStyle = cor;
  ret(g, sx, sy, L, -6 + recua, -42, 14, 12);
  ret(g, sx, sy, L, 7 + recua, -37, 6, 5);
  g.fillStyle = escura;
  ret(g, sx, sy, L, -5 + recua, -47, 4, 5);
  ret(g, sx, sy, L, 2 + recua, -47, 4, 5);
  g.fillStyle = '#2a1e1a';
  ret(g, sx, sy, L, 4 + recua, -39, 2, 2);
  ret(g, sx, sy, L, 12 + recua, -36, 2, 2);
  // o braço: na preparação vai para trás (com o brilho que avisa), no ataque vai para a frente
  g.fillStyle = escura;
  if (b.estado === 'preparando') {
    ret(g, sx, sy, L, -12, -27, 6, 4);
    if (Math.floor(tempo / 100) % 2 === 0) {
      g.fillStyle = '#fff6c8';
      ret(g, sx, sy, L, -15, -30, 3, 3);
    }
  } else if (b.estado === 'atacando') {
    ret(g, sx, sy, L, 7, -26, 16, 4);
    g.fillStyle = '#4e3428';
    ret(g, sx, sy, L, 22, -27, 4, 6);
  } else {
    ret(g, sx, sy, L, 3 + recua, -24, 6, 4);
  }
  if (b.estado === 'dor') {
    g.fillStyle = '#fff6c8';
    ret(g, sx, sy, L, -2, -50, 2, 2);
    ret(g, sx, sy, L, 6, -52, 2, 2);
  }
}

function corvo(g: CanvasRenderingContext2D, b: Bicho, sx: number, sy: number, tempo: number) {
  const L = b.lado;
  const cor = b.piscando ? '#e8e0ec' : '#3a3444';
  const asa = b.piscando ? '#d0c8d8' : '#2a2532';
  if (b.estado === 'caido' || b.estado === 'morto') {
    g.fillStyle = asa;
    ret(g, sx, sy, L, -10, -5, 20, 4);
    g.fillStyle = cor;
    ret(g, sx, sy, L, -6, -7, 12, 4);
    g.fillStyle = '#d9a640';
    ret(g, sx, sy, L, 6, -6, 4, 2);
    return;
  }
  const bate = b.estado === 'mergulhando' ? 0 : Math.floor(tempo / (b.estado === 'mirando' ? 60 : 110)) % 2;
  g.fillStyle = cor;
  ret(g, sx, sy, L, -7, -8, 14, 7);
  ret(g, sx, sy, L, 4, -11, 6, 5);
  g.fillStyle = '#d9a640';
  ret(g, sx, sy, L, 10, -9, 4, 2);
  g.fillStyle = '#f6efe0';
  ret(g, sx, sy, L, 7, -10, 1, 1);
  g.fillStyle = asa;
  if (b.estado === 'mergulhando') ret(g, sx, sy, L, -12, -7, 14, 3);
  else if (bate) ret(g, sx, sy, L, -6, -18, 9, 10);
  else ret(g, sx, sy, L, -8, -3, 10, 5);
  ret(g, sx, sy, L, -11, -7, 5, 3);
}

function texugo(g: CanvasRenderingContext2D, b: Bicho, sx: number, sy: number, tempo: number) {
  const L = b.lado;
  const cor = b.piscando ? '#f2ecf0' : '#6e6a72';
  const escura = b.piscando ? '#dcd6da' : '#4a4650';
  const prep = b.estado === 'prep-investida' || b.estado === 'prep-pancada';
  const treme = prep && Math.floor(tempo / 50) % 2 ? 1 : 0;
  const x0 = treme;
  if (b.estado === 'caido' || b.estado === 'morto') {
    g.fillStyle = escura;
    ret(g, sx, sy, L, -26, -12, 50, 11);
    g.fillStyle = cor;
    ret(g, sx, sy, L, -22, -16, 40, 8);
    g.fillStyle = '#f0ebe0';
    ret(g, sx, sy, L, 14, -15, 10, 3);
    return;
  }
  const agachado = b.estado === 'investida' || b.estado === 'prep-investida' ? 8 : 0;
  const bracoAlto = b.estado === 'prep-pancada';
  // as pernas
  g.fillStyle = '#2e2a32';
  const passo = b.estado === 'andando' ? Math.floor(tempo / 160) % 2 : 0;
  ret(g, sx, sy, L, -12 + x0 + passo * 2, -10, 7, 10);
  ret(g, sx, sy, L, 5 + x0 - passo * 2, -10, 7, 10);
  // o corpo grande
  g.fillStyle = cor;
  ret(g, sx, sy, L, -18 + x0, -44 + agachado, 36, 36 - agachado);
  g.fillStyle = escura;
  ret(g, sx, sy, L, -18 + x0, -18, 36, 8);
  // a cabeça listrada
  g.fillStyle = '#f0ebe0';
  ret(g, sx, sy, L, 4 + x0, -54 + agachado * 1.5, 18, 14);
  g.fillStyle = '#2e2a32';
  ret(g, sx, sy, L, 4 + x0, -50 + agachado * 1.5, 18, 3);
  ret(g, sx, sy, L, 4 + x0, -45 + agachado * 1.5, 18, 2);
  g.fillStyle = '#1a161c';
  ret(g, sx, sy, L, 19 + x0, -48 + agachado * 1.5, 3, 3);
  // os braços
  g.fillStyle = escura;
  if (bracoAlto) {
    ret(g, sx, sy, L, -10 + x0, -66, 7, 24);
    ret(g, sx, sy, L, 8 + x0, -66, 7, 24);
  } else if (b.estado === 'pancada') {
    ret(g, sx, sy, L, -12, -14, 9, 14);
    ret(g, sx, sy, L, 12, -14, 9, 14);
  } else {
    ret(g, sx, sy, L, 12 + x0, -34 + agachado, 12, 7);
  }
  if (b.estado === 'cansado' && Math.floor(tempo / 300) % 2) {
    g.fillStyle = '#fff6c8';
    ret(g, sx, sy, L, 0, -62, 2, 2);
    ret(g, sx, sy, L, 8, -64, 2, 2);
    ret(g, sx, sy, L, 16, -62, 2, 2);
  }
}

/** O AVISO DE CADA GOLPE INIMIGO no chão: a linha do mergulho, a linha da investida, o círculo da pancada. */
export function desenharAviso(
  g: CanvasRenderingContext2D,
  tipo: TipoDeInimigo,
  estado: EstadoDoInimigo,
  sx: number,
  faixaSy: number,
  lado: number,
  tempo: number,
  sy: number,
) {
  const pisca = Math.floor(tempo / 120) % 2 === 0;
  if ((tipo === 'corvo' && estado === 'mirando') || (tipo === 'texugo' && estado === 'prep-investida')) {
    g.fillStyle = pisca ? '#e2574a' : '#f0a070';
    const ate = lado > 0 ? W : 0;
    for (let x = sx; lado > 0 ? x < ate : x > ate; x += lado * 8) g.fillRect(Math.round(x), faixaSy, 4, 1);
  } else if (tipo === 'texugo' && estado === 'prep-pancada') {
    g.strokeStyle = pisca ? '#e2574a' : '#f0a070';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(sx, sy, 54, 9, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

// ---------------- AS FAÍSCAS E A POEIRA ----------------
export interface Efeito {
  tipo: 'faisca' | 'poeira' | 'giro';
  x: number;
  y: number;
  z: number;
  em: number;
}

export function desenharEfeito(g: CanvasRenderingContext2D, e: Efeito, camX: number, tempo: number): boolean {
  const idade = tempo - e.em;
  const { sx, sy } = naTela(camX, e.x, e.y, e.z);
  if (e.tipo === 'faisca') {
    if (idade > 220) return false;
    const r = 3 + idade / 30;
    g.fillStyle = idade < 90 ? '#fff6c8' : '#ffb04a';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      g.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy - 22 + Math.sin(a) * r), 2, 2);
    }
    if (idade < 70) g.fillRect(sx - 2, sy - 24, 5, 5);
    return true;
  }
  if (e.tipo === 'giro') {
    if (idade > 450) return false;
    g.strokeStyle = '#fff6c8';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(sx, sy - 18, 30 + idade / 40, 10, 0, idade / 60, idade / 60 + Math.PI * 1.3);
    g.stroke();
    return true;
  }
  if (idade > 400) return false;
  g.fillStyle = '#c4a888';
  const r = 2 + idade / 60;
  g.fillRect(Math.round(sx - r * 3), sy - 2, 3, 2);
  g.fillRect(Math.round(sx + r * 3), sy - 2, 3, 2);
  g.fillRect(Math.round(sx - r), sy - 4, 2, 2);
  return true;
}

/**
 * O RASTRO DO GOLPE: o braço do coelho chibi é curto, e o soco sozinho mal se lê na tela pequena; um risco claro na altura
 * do punho (e do pé, na voadora) mostra onde o golpe pega, como o "smear" decidido para as animações.
 */
export function desenharRastro(g: CanvasRenderingContext2D, sx: number, sy: number, lado: number, acao: Acao) {
  g.fillStyle = '#fff6c8';
  const x = (d: number, w: number) => (lado > 0 ? sx + d : sx - d - w);
  if (acao === 'soco1' || acao === 'soco2') {
    const y = sy - (acao === 'soco1' ? 30 : 27);
    g.fillRect(x(14, 12), y, 12, 1);
    g.fillRect(x(18, 9), y - 2, 9, 1);
    g.fillRect(x(18, 9), y + 2, 9, 1);
  } else if (acao === 'soco3') {
    for (let k = 0; k < 4; k++) g.fillRect(x(12 + k * 3, 2), sy - 26 - k * 6, 2, 5);
  } else if (acao === 'voadora') {
    g.fillRect(x(8, 14), sy - 12, 14, 1);
    g.fillRect(x(4, 10), sy - 9, 10, 1);
  }
}

/** A seta de "vamos!" no canto direito, piscando, quando a onda acabou. Sem texto (a seta diz). */
export function desenharSeta(g: CanvasRenderingContext2D, tempo: number) {
  if (Math.floor(tempo / 350) % 2) return;
  g.fillStyle = '#2a1e1a';
  g.fillRect(272, 61, 22, 10);
  g.beginPath();
  g.moveTo(291, 54);
  g.lineTo(306, 66);
  g.lineTo(291, 78);
  g.fill();
  g.fillStyle = '#ffd36a';
  g.fillRect(273, 62, 19, 8);
  g.beginPath();
  g.moveTo(292, 57);
  g.lineTo(303, 66);
  g.lineTo(292, 75);
  g.fill();
}

/** A barra de vida do chefe, embaixo da tela, e os pontinhos das ondas em cima. */
export function desenharBarraDoChefe(g: CanvasRenderingContext2D, pct: number) {
  g.fillStyle = '#2a1e1a';
  g.fillRect(80, 170, 160, 6);
  g.fillStyle = '#7a4a3a';
  g.fillRect(81, 171, 158, 4);
  g.fillStyle = '#e2574a';
  g.fillRect(81, 171, Math.round(158 * Math.max(0, pct) / 100), 4);
}

export function desenharOndas(g: CanvasRenderingContext2D, onda: number, total: number) {
  for (let k = 0; k < total; k++) {
    g.fillStyle = '#2a1e1a';
    g.fillRect(W / 2 - total * 5 + k * 10, 4, 7, 7);
    g.fillStyle = k < onda ? '#ffd36a' : k === onda ? '#f7e6c4' : '#8a6a4c';
    g.fillRect(W / 2 - total * 5 + k * 10 + 1, 5, 5, 5);
  }
}
