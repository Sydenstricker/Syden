import { arte, L, ladrilhoNo, pintarChaoDeLadrilhos } from './arte';
import type { Mundo } from './mundo';
import { ALTURA, LARGURA, LOOP_DURA, posicaoBala, posicaoInimigo, posicaoItem, posicaoTiro, type FaseDaNave, type Inimigo } from './sim';

/**
 * O DESENHO DA ESQUADRILHA DA TOCA (05/11/2026), todo por código, numa tela de 180 × 240 ampliada em pixels inteiros: a horta
 * vista de cima rolando, as nuvens passando por cima, os aviõezinhos de cenoura, a praga e o espantalho mecânico. As figuras
 * são mapas de pixels escritos aqui (uma letra, uma cor). Nada de imagem de ninguém.
 */

const CORES: Record<string, string> = {
  o: '#f08a24',
  O: '#c4601a',
  g: '#6cbf4f',
  G: '#3f7f34',
  w: '#f7f2e8',
  p: '#f2a3b3',
  b: '#e0b06a',
  k: '#2b2633',
  K: '#4a4458',
  y: '#f5c542',
  c: '#cfe8f5',
  e: '#fff7e0',
  v: '#3f8f6f',
  V: '#2a6650',
  l: '#8fd4b0',
  r: '#e2483d',
};

const NAVE = [
  '.......O.......',
  '......OoO......',
  '......ooo......',
  '......oOo......',
  '.....owwwo.....',
  '.....wwwww.....',
  '.....owwwo.....',
  'xbbbbowpwobbbbx',
  'xbbbbowowobbbbx',
  '.bbbbooOoobbbb.',
  '......ooo......',
  '......oOo......',
  '.....GgogG.....',
  '....Gg.g.gG....',
  '...G...g...G...',
];
const CORVO_A = ['k...........k', 'kk.........kk', '.kkk.....kkk.', '..kkkKKKkkk..', '...kkKKKkk...', '.....KKK.....', '....kkkkk....', '....krkrk....', '......y......'];
const CORVO_B = ['.............', '.............', 'kkkk.....kkkk', '.kkkkKKKkkkk.', '...kkKKKkk...', '.....KKK.....', '....kkkkk....', '....krkrk....', '......y......'];
const VESPA_A = ['....k....', 'c..kyk..c', 'cc.yyy.cc', '.cckkkcc.', '..yyyyy..', '..kkkkk..', '..yyyyy..', '...kkk...', '..kyyyk..', '..ekkke..', '...k.k...'];
const VESPA_B = VESPA_A.map((l, i) => (i <= 3 ? l.replace(/c/g, '.') : l)).map((l, i) => (i === 3 ? '..ckkkc..' : i === 4 ? '.cyyyyyc.' : l));
const BESOURO = [
  '..k.........k..',
  '...k.VVVVV.k...',
  '....VvvVvvV....',
  '.kkVvvvVvvvVkk.',
  '...VvlvVvvvV...',
  '..VvlvvVvvvvV..',
  'kkVvvvvVvvvvVkk',
  '..VvvvvVvvvvV..',
  '..VvvvvVvvvvV..',
  'kkVvvvvVvvvvVkk',
  '...VvvvVvvvV...',
  '....VVVVVVV....',
  '.k...KKKKK...k.',
  '....kKeKeKk....',
  '.....k...k.....',
];

/** As cores dos aviões dos outros (a ponta das asas), na ordem do placar. */
export const CORES_DA_ESQUADRILHA = ['#e2483d', '#4aa3df', '#9b6bd6', '#f5c542', '#5cbf8a', '#f08ab0', '#ffffff', '#3c3c8a'];

const cacheDeFiguras = new Map<string, HTMLCanvasElement>();
function figura(mapa: string[], ponta = '#e2483d'): HTMLCanvasElement {
  const chave = mapa.join('|') + ponta;
  const pronta = cacheDeFiguras.get(chave);
  if (pronta) return pronta;
  const c = document.createElement('canvas');
  c.width = mapa[0].length;
  c.height = mapa.length;
  const ctx = c.getContext('2d')!;
  mapa.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const letra = linha[x];
      if (letra === '.') continue;
      ctx.fillStyle = letra === 'x' ? ponta : (CORES[letra] ?? '#ff00ff');
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cacheDeFiguras.set(chave, c);
  return c;
}
const no = (ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number) =>
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));

/** Um sorteio só para o enfeite (não precisa bater com o servidor, só ficar igual de um quadro para o outro). */
function enfeite(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/** A HORTA VISTA DE CIMA, num rolo mais alto que a tela, que se repete: canteiros, trilhas, o lago e as árvores. */
export const ALTURA_DO_ROLO = 480;
export function pintarHorta(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LARGURA;
  c.height = ALTURA_DO_ROLO;
  const ctx = c.getContext('2d')!;
  const r = enfeite(7);
  ctx.fillStyle = '#86b25f';
  ctx.fillRect(0, 0, LARGURA, ALTURA_DO_ROLO);
  // o capim, em tufos
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = r() < 0.5 ? '#7aa654' : '#94c06b';
    ctx.fillRect(Math.floor(r() * LARGURA), Math.floor(r() * ALTURA_DO_ROLO), 1, 1 + Math.floor(r() * 2));
  }
  // as trilhas de terra batida, atravessando
  for (const y of [70, 250, 400]) {
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(0, y, LARGURA, 9);
    ctx.fillStyle = '#b8935a';
    for (let x = 0; x < LARGURA; x += 3) if (r() < 0.4) ctx.fillRect(x, y + Math.floor(r() * 9), 1, 1);
  }
  // os canteiros: terra arada com fileiras de plantas
  const plantas = ['#4f9a3c', '#7ccf5a', '#e07a2f', '#5aa64a'];
  const canteiro = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#6e4a30';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#80583a';
    ctx.fillRect(x, y, w, h);
    const cor = plantas[Math.floor(r() * plantas.length)];
    for (let fx = x + 3; fx < x + w - 2; fx += 6) {
      ctx.fillStyle = '#6a4630';
      ctx.fillRect(fx - 1, y + 1, 1, h - 2);
      for (let fy = y + 4; fy < y + h - 3; fy += 6) {
        ctx.fillStyle = '#2f6b2a';
        ctx.fillRect(fx, fy + 1, 3, 2);
        ctx.fillStyle = cor;
        ctx.fillRect(fx, fy, 3, 2);
        ctx.fillRect(fx + 1, fy - 1, 1, 1);
      }
    }
  };
  canteiro(14, 92, 38, 60);
  canteiro(64, 92, 50, 44);
  canteiro(126, 100, 40, 70);
  canteiro(20, 270, 60, 40);
  canteiro(96, 280, 30, 90);
  canteiro(20, 330, 50, 50);
  canteiro(10, 10, 46, 48);
  canteiro(140, 280, 30, 60);
  canteiro(120, 420, 50, 50);
  canteiro(20, 420, 70, 42);
  // o lago
  ctx.fillStyle = '#5d8f9e';
  ctx.beginPath();
  ctx.ellipse(132, 32, 26, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7fb3c4';
  ctx.beginPath();
  ctx.ellipse(130, 30, 22, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b6dbe6';
  ctx.fillRect(120, 26, 6, 1);
  ctx.fillRect(136, 33, 4, 1);
  // árvores (copas redondas, com sombra)
  for (const [x, y, raio] of [
    [80, 190, 11],
    [160, 210, 9],
    [30, 205, 8],
    [70, 470, 10],
    [170, 380, 8],
    [90, 30, 7],
  ]) {
    ctx.fillStyle = 'rgba(30,50,20,0.35)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 3, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7f34';
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5aa64a';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, raio - 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // a cerca da horta
  ctx.fillStyle = '#a77b4f';
  for (let y = 0; y < ALTURA_DO_ROLO; y += 10) ctx.fillRect(2, y, 2, 6);
  for (let y = 5; y < ALTURA_DO_ROLO; y += 10) ctx.fillRect(LARGURA - 4, y, 2, 6);
  return c;
}

/**
 * O chão da fase: em ladrilhos do Pixel Shmup quando a folha já chegou (`arte.ts`), senão a horta por código de sempre (a
 * reserva, igual nas três fases).
 */
export function pintarChao(fase: FaseDaNave): HTMLCanvasElement {
  const f = arte();
  return f ? pintarChaoDeLadrilhos(f, fase, LARGURA, ALTURA_DO_ROLO) : pintarHorta();
}

/** As nuvens: passam mais depressa que o chão, com a sombra delas na horta. */
const NUVENS = [
  [20, 0, 1],
  [130, 170, 0.8],
  [70, 330, 1.2],
  [150, 470, 0.9],
  [40, 610, 1],
];
const ALTURA_DAS_NUVENS = 720;
/**
 * A nuvem em pixels de borda dura (20/11/2026: antes eram arcos com a borda borrada, que destoavam dos ladrilhos), feita uma vez
 * por tamanho e cor. Cada pixel é pintado uma vez só, então a transparência fica igual onde os círculos se cruzam.
 */
const cacheDeNuvens = new Map<string, HTMLCanvasElement>();
const BOLOS = [
  [0, 0, 10],
  [11, 2, 8],
  [-10, 3, 7],
  [4, -5, 7],
];
function nuvem(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, cor: string) {
  const chave = `${k}|${cor}`;
  let c = cacheDeNuvens.get(chave);
  if (!c) {
    const m = Math.ceil(24 * k);
    c = document.createElement('canvas');
    c.width = c.height = m * 2;
    const g = c.getContext('2d')!;
    g.fillStyle = cor;
    for (let py = 0; py < m * 2; py++)
      for (let px = 0; px < m * 2; px++) {
        const ux = px + 0.5 - m;
        const uy = py + 0.5 - m;
        if (BOLOS.some(([dx, dy, r]) => (ux - dx * k) ** 2 + (uy - dy * k) ** 2 <= (r * k) ** 2)) g.fillRect(px, py, 1, 1);
      }
    cacheDeNuvens.set(chave, c);
  }
  ctx.drawImage(c, Math.round(x) - c.width / 2, Math.round(y) - c.height / 2);
}

export interface Outro {
  x: number;
  y: number;
  cor: string;
  nome: string;
  vivo: boolean;
}

export interface Desenho {
  horta: HTMLCanvasElement;
  /** O passo que está na tela (pode estar entre dois passos, para a rolagem ficar lisa). */
  passo: number;
  mundo: Mundo;
  outros: Outro[];
  /** A cor da ponta das asas de quem joga. */
  minhaCor: string;
  /** Menos movimento: sem tremer a tela, sem clarão. */
  calmo: boolean;
  /** O inimigo que pisca branco agora (acabou de levar um tiro: só desenho). */
  piscando?: (i: number) => boolean;
}

function desenharInimigo(ctx: CanvasRenderingContext2D, e: Inimigo, x: number, y: number, n: number, dano: number) {
  const bate = Math.floor(n / 8) % 2 === 0;
  if (e.tipo === 'corvo') no(ctx, figura(bate ? CORVO_A : CORVO_B), x, y);
  else if (e.tipo === 'vespa') no(ctx, figura(Math.floor(n / 3) % 2 ? VESPA_A : VESPA_B), x, y);
  else if (e.tipo === 'besouro') no(ctx, figura(BESOURO), x, y);
  else if (e.rota[0] === 1) desenharVespeiro(ctx, x, y, n, dano / e.vida);
  else if (e.rota[0] === 2) desenharTrator(ctx, x, y, n, dano / e.vida);
  else desenharChefe(ctx, x, y, n, dano / e.vida);
}

/** O VESPEIRO (19/11/2026, o chefe do pomar): a colmeia de papel, listrada, com as vespas zunindo em volta. */
function desenharVespeiro(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, ferido: number) {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const r = (cor: string, dx: number, dy: number, w: number, h: number) => {
    ctx.fillStyle = cor;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  r('#6a4a2a', -2, -26, 4, 6);
  const larg = [10, 14, 17, 19, 20, 19, 17, 14, 10];
  larg.forEach((w, k) => {
    r(k % 2 ? '#b8862e' : '#e0b450', -w, -20 + k * 4, w * 2, 4);
    r('#8a6020', -w, -20 + k * 4 + 3, w * 2, 1);
  });
  const pisca = ferido > 0.6 && Math.floor(n / 6) % 2 === 0;
  r('#2b2633', -4, 6, 8, 6);
  r(pisca ? '#ffe08a' : '#e2483d', -2, 8, 4, 2);
  for (let k = 0; k < 4; k++) {
    const a = (n / 20 + k / 4) * Math.PI * 2;
    const vx = Math.round(Math.cos(a) * 26);
    const vy = Math.round(Math.sin(a) * 18);
    r('#f5c542', vx - 2, vy - 1, 4, 3);
    r('#2b2633', vx, vy - 1, 1, 3);
  }
}

/** O TRATOR (19/11/2026, o chefe do celeiro): o trator velho com a grade de ferro na frente e a fumaça da chaminé. */
function desenharTrator(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, ferido: number) {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const r = (cor: string, dx: number, dy: number, w: number, h: number) => {
    ctx.fillStyle = cor;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  r('#2b2633', -26, -12, 10, 24);
  r('#2b2633', 16, -12, 10, 24);
  for (let k = 0; k < 4; k++) {
    const d = (Math.floor(n / 4) + k * 2) % 8;
    r('#5a5058', -26, -12 + d * 3, 10, 1);
    r('#5a5058', 16, -12 + d * 3, 10, 1);
  }
  r('#a83a2e', -16, -16, 32, 28);
  r('#d4553f', -15, -15, 30, 6);
  r('#5c6470', -12, 6, 24, 8);
  for (let dx = -10; dx <= 8; dx += 4) r('#8d96a3', dx, 7, 2, 6);
  const pisca = ferido > 0.6 && Math.floor(n / 6) % 2 === 0;
  r(pisca ? '#ffe08a' : '#f5c542', -10, -6, 5, 4);
  r(pisca ? '#ffe08a' : '#f5c542', 5, -6, 5, 4);
  r('#3a3f47', 8, -26, 4, 10);
  const f = Math.floor(n / 10) % 3;
  r('rgba(140,130,130,0.7)', 7 - f, -32 - f * 3, 6 + f, 4);
}

/** O ESPANTALHO MECÂNICO: chapéu de palha, cara de saco com olhos acesos, a camisa remendada e os braços de cano com hélices. */
function desenharChefe(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, ferido: number) {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const r = (cor: string, dx: number, dy: number, w: number, h: number) => {
    ctx.fillStyle = cor;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  // as hélices, girando nas pontas dos braços
  const gira = Math.floor(n / 3) % 2;
  for (const lado of [-1, 1]) {
    const hx = lado * 24;
    r('#5c6470', hx - 1, -6, 3, 6);
    if (gira) r('rgba(220,230,240,0.8)', hx - 8, -8, 17, 2);
    else r('rgba(220,230,240,0.8)', hx - 1, -14, 3, 14);
  }
  // o braço de cano, com os parafusos
  r('#5c6470', -25, -2, 50, 5);
  r('#8d96a3', -25, -2, 50, 3);
  for (const dx of [-20, -12, 10, 18]) r('#3a3f47', dx, -1, 2, 2);
  // a palha saindo das mangas e de baixo
  for (const dx of [-27, -26, 25, 26]) r('#e8c860', dx, -4 + (dx % 3), 2, 8);
  for (let dx = -8; dx <= 6; dx += 3) r('#e8c860', dx, 13, 2, 4 + (dx & 1) * 2);
  // a camisa remendada
  r('#3f63a0', -10, -6, 20, 20);
  r('#4f7bbf', -9, -5, 18, 18);
  r('#c9a66b', 2, 2, 6, 6);
  r('#8a6a3c', 2, 2, 6, 1);
  r('#8a6a3c', 2, 7, 6, 1);
  r('#2b2633', -1, -5, 2, 18);
  // a cara de saco
  r('#cdb27a', -8, -19, 16, 14);
  r('#e8d3a0', -7, -18, 14, 12);
  const pisca = ferido > 0.6 && Math.floor(n / 6) % 2 === 0;
  r(pisca ? '#ffe08a' : '#e2483d', -5, -15, 3, 3);
  r(pisca ? '#ffe08a' : '#e2483d', 2, -15, 3, 3);
  r('#2b2633', -5, -10, 10, 1);
  for (let dx = -4; dx <= 4; dx += 2) r('#2b2633', dx, -11, 1, 3);
  // o chapéu de palha
  r('#b8893e', -13, -22, 26, 4);
  r('#d9b45a', -7, -30, 14, 9);
  r('#e2483d', -7, -24, 14, 2);
  r('#efd38a', -5, -29, 4, 2);
}

function desenharItem(ctx: CanvasRenderingContext2D, item: string, x: number, y: number, n: number) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const f = arte();
  if (f) {
    // o selo do pacote (dois tiros, o leque, o escudo), com o brilho piscando por trás para chamar o olho
    if (Math.floor(n / 10) % 2) {
      ctx.fillStyle = 'rgba(255,247,224,0.85)';
      ctx.fillRect(cx - 7, cy - 6, 14, 12);
      ctx.fillRect(cx - 6, cy - 7, 12, 14);
    }
    ladrilhoNo(ctx, f, item === 'duplo' ? L.itemDuplo : item === 'espalhado' ? L.itemEspalhado : L.itemEscudo, cx, cy);
    return;
  }
  const cor = item === 'duplo' ? '#f08a24' : item === 'espalhado' ? '#9b6bd6' : '#4aa3df';
  ctx.fillStyle = Math.floor(n / 10) % 2 ? '#fff7e0' : '#2b2633';
  ctx.fillRect(cx - 6, cy - 5, 12, 10);
  ctx.fillRect(cx - 5, cy - 6, 10, 12);
  ctx.fillStyle = cor;
  ctx.fillRect(cx - 5, cy - 4, 10, 8);
  ctx.fillRect(cx - 4, cy - 5, 8, 10);
  ctx.fillStyle = '#fff7e0';
  if (item === 'duplo') {
    ctx.fillRect(cx - 3, cy - 3, 2, 6);
    ctx.fillRect(cx + 1, cy - 3, 2, 6);
  } else if (item === 'espalhado') {
    ctx.fillRect(cx - 1, cy - 3, 2, 6);
    ctx.fillRect(cx - 4, cy - 1, 2, 3);
    ctx.fillRect(cx - 3, cy - 3, 1, 2);
    ctx.fillRect(cx + 2, cy - 1, 2, 3);
    ctx.fillRect(cx + 2, cy - 3, 1, 2);
  } else {
    ctx.fillRect(cx - 3, cy - 3, 6, 1);
    ctx.fillRect(cx - 3, cy + 2, 6, 1);
    ctx.fillRect(cx - 3, cy - 3, 1, 6);
    ctx.fillRect(cx + 2, cy - 3, 1, 6);
  }
}

export function desenhar(ctx: CanvasRenderingContext2D, d: Desenho) {
  const { mundo: m, passo } = d;
  const n = Math.max(0, Math.floor(passo));
  // o chão rolando (a nave voa para cima, então a horta desce)
  const rolo = (passo * 0.5) % ALTURA_DO_ROLO;
  const y0 = Math.floor(rolo);
  ctx.drawImage(d.horta, 0, y0 - ALTURA_DO_ROLO);
  ctx.drawImage(d.horta, 0, y0);
  if (y0 + ALTURA_DO_ROLO < ALTURA) ctx.drawImage(d.horta, 0, y0 + ALTURA_DO_ROLO);

  // a sombra das nuvens no chão
  const nuvemY = (base: number) => ((base + passo * 1.1) % ALTURA_DAS_NUVENS) - 60;
  for (const [x, base, k] of NUVENS) nuvem(ctx, x + 14, nuvemY(base) + 18, k, 'rgba(30,50,20,0.13)');

  // os itens caindo
  for (const [i, q] of m.soltos) {
    const e = m.inimigos[i];
    const p = posicaoItem(e, q, n);
    if (p && e.item) desenharItem(ctx, e.item, p.x, p.y, n);
  }

  // a praga
  for (const i of m.ativos) {
    if (m.mortoEm(i) !== null) continue;
    const e = m.inimigos[i];
    const p = posicaoInimigo(e, n);
    if (!p) continue;
    // o piscar branco do acerto (só desenho)
    const branco = d.piscando?.(i) ?? false;
    if (branco) ctx.filter = 'brightness(4)';
    desenharInimigo(ctx, e, p.x, p.y, n, m.ficha.dano.get(i) ?? 0);
    if (branco) ctx.filter = 'none';
  }

  // os outros da esquadrilha, meio transparentes, com o nome
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const o of d.outros) {
    ctx.globalAlpha = o.vivo ? 0.45 : 0.18;
    no(ctx, figura(NAVE, o.cor), o.x, o.y);
    ctx.globalAlpha = o.vivo ? 0.85 : 0.3;
    const nome = o.nome.slice(0, 12);
    ctx.strokeStyle = '#2b2633';
    ctx.lineWidth = 2;
    ctx.strokeText(nome, Math.round(o.x), Math.round(o.y) + 16);
    ctx.fillStyle = o.cor;
    ctx.fillText(nome, Math.round(o.x), Math.round(o.y) + 16);
  }
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;

  // as balas da nave: cenourinhas
  for (const b of m.balas) {
    const p = posicaoBala(b.p, b.x, b.y, b.arma, b.b, n);
    if (!p) continue;
    // o nível da arma (19/11/2026): a bala do 2 é mais larga, a do 3 também mais comprida e com brilho
    const larga = b.nivel >= 2 ? 3 : 2;
    const longa = b.nivel >= 3 ? 7 : 5;
    ctx.fillStyle = b.nivel >= 3 ? '#ff8a3a' : '#ffb347';
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 2, larga, longa);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 3, larga, 1);
  }

  // a nave de quem joga (pisca enquanto está protegida)
  const f = m.ficha;
  if (m.pilotando) {
    const piscando = n < f.invulAte && Math.floor(n / 4) % 2 === 0;
    // o loop de esquiva (19/11/2026): a nave vira de cabeça para baixo e volta, um pouco maior no meio (mais perto da câmera)
    const loop = f.loopEm(n);
    if (loop !== null && !piscando) {
      const u = (n - loop) / LOOP_DURA;
      const vira = Math.cos(u * Math.PI * 2);
      const perto = 1 + 0.35 * Math.sin(u * Math.PI);
      ctx.save();
      ctx.translate(Math.round(m.nave.x), Math.round(m.nave.y));
      ctx.scale(perto, Math.max(0.15, Math.abs(vira)) * perto);
      ctx.translate(-Math.round(m.nave.x), -Math.round(m.nave.y));
      if (f.invulNoLoop(n)) ctx.globalAlpha = 0.75;
      no(ctx, figura(NAVE, d.minhaCor), m.nave.x, m.nave.y);
      ctx.restore();
    } else if (!piscando) no(ctx, figura(NAVE, d.minhaCor), m.nave.x, m.nave.y);
    if (f.escudo) {
      ctx.strokeStyle = Math.floor(n / 6) % 2 ? 'rgba(120,200,255,0.9)' : 'rgba(200,235,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(m.nave.x) + 0.5, Math.round(m.nave.y) + 0.5, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // as nuvens, por cima de tudo menos dos tiros (um tiro escondido seria injusto)
  for (const [x, base, k] of NUVENS) nuvem(ctx, x, nuvemY(base), k, 'rgba(255,255,255,0.55)');

  // os tiros da praga: sementes roxas
  for (const t of m.tirosAtivos) {
    const p = posicaoTiro(t, n);
    if (!p) continue;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    ctx.fillStyle = '#7a1f4f';
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillStyle = '#e04f9a';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#ffd1e6';
    ctx.fillRect(x, y - 1, 1, 1);
  }

  // as explosões e as faíscas
  const folha = arte();
  for (const e of m.efeitos) {
    const idade = n - e.em;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    if (e.tipo === 'raspao') {
      // O RASPÃO (20/11/2026): uma faísca azul-clara entre a nave e o tiro, que abre e some depressa
      if (idade > 8) continue;
      ctx.fillStyle = idade < 3 ? '#ffffff' : '#bfe6ff';
      ctx.fillRect(x, y, 1, 1);
      const r = 1 + idade;
      ctx.fillRect(x - r, y - 1, 1, 1);
      ctx.fillRect(x + r, y + 1, 1, 1);
      ctx.fillRect(x - 1, y - r, 1, 1);
      ctx.fillRect(x + 1, y + r, 1, 1);
      continue;
    }
    if (folha && e.tipo === 'faisca') {
      if (idade <= 4) ladrilhoNo(ctx, folha, L.faisca, x, y);
    } else if (folha && (e.tipo === 'explosao' || e.tipo === 'perdeu')) {
      // os quadros do pacote (clarão, estrela, estouro, faísca) e a fumaça, em 2× nas grandes
      const k = e.grande ? 2 : 1;
      if (idade < 20) ladrilhoNo(ctx, folha, L.explosao[Math.floor(idade / 5)], x, y, k);
      else if (idade < 34) {
        ctx.globalAlpha = 1 - (idade - 20) / 14;
        ladrilhoNo(ctx, folha, L.fumaca, x, y - Math.floor((idade - 20) / 4), k);
        ctx.globalAlpha = 1;
      }
    } else if (e.tipo === 'faisca') {
      if (idade > 6) continue;
      ctx.fillStyle = '#fff7e0';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillRect(x - 3 - idade, y, 2, 1);
      ctx.fillRect(x + 2 + idade, y, 2, 1);
    } else if (e.tipo === 'explosao' || e.tipo === 'perdeu') {
      const raio = Math.min(idade, 16) * (e.grande ? 1.4 : 0.8);
      const cores = ['#fff3c4', '#f5c542', '#f08a24', '#8a7f78'];
      ctx.fillStyle = cores[Math.min(3, Math.floor(idade / 6))];
      for (let k = 0; k < 8; k++) {
        const ax = [1, 0.7, 0, -0.7, -1, -0.7, 0, 0.7][k];
        const ay = [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7][k];
        const tam = idade < 20 ? 3 : 2;
        ctx.fillRect(Math.round(x + ax * raio) - 1, Math.round(y + ay * raio) - 1, tam, tam);
      }
      if (idade < 8) {
        ctx.fillStyle = '#fff7e0';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    } else if (e.tipo === 'bomba') {
      const raio = idade * 9;
      ctx.strokeStyle = `rgba(255,247,224,${Math.max(0, 1 - idade / 30)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, raio, 0, Math.PI * 2);
      ctx.stroke();
      if (!d.calmo && idade < 6) {
        ctx.fillStyle = `rgba(255,247,224,${0.5 - idade / 12})`;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
      }
    } else if (e.tipo === 'pegou' || e.tipo === 'escudo') {
      if (idade > 16) continue;
      ctx.strokeStyle = e.tipo === 'pegou' ? 'rgba(255,243,196,0.9)' : 'rgba(120,200,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 6 + idade, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // a vida do chefe, no alto (a desta tela)
  const chefe = m.inimigos.length - 1;
  if (m.ativos.includes(chefe) && m.mortoEm(chefe) === null) {
    const e = m.inimigos[chefe];
    const resta = Math.max(0, 1 - (m.ficha.dano.get(chefe) ?? 0) / e.vida);
    ctx.fillStyle = '#2b2633';
    ctx.fillRect(29, 4, 122, 5);
    ctx.fillStyle = '#e2483d';
    ctx.fillRect(30, 5, Math.round(120 * resta), 3);
  }
}
