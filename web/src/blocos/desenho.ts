import { CAIXA, COLUNAS, LIMPANDO, LINHAS, VAZIO, VIRANDO, type Estado } from './sim';

/**
 * O DESENHO DA HORTA EM CASCATA, todo por código (nenhuma arte de fora): cada peça é um quadrado de 16 × 16 com um legume
 * em pixel art, nas cores quentes e pouco saturadas do quarto. A tela pequena (96 × 192) é ampliada com os pixels nítidos.
 */
export const PECA = 16;
export const LARGURA = COLUNAS * PECA;
export const ALTURA = LINHAS * PECA;

/** As cores de fundo de cada legume (também as do tabuleiro pequeno dos outros). */
export const FUNDOS = ['#e9b48a', '#a9c99a', '#e39a8e', '#b9a3c9', '#ecd58a', '#e8d6e0'];
const BORDAS = ['#b9794e', '#6f9a5e', '#b2604f', '#7f6a96', '#bfa04c', '#b39aa8'];
export const COR_DA_CAIXA = '#9a6b45';

/** Os legumes, em 12 × 12: cada letra uma cor da paleta de cada um, '.' transparente. */
const LEGUMES: { mapa: string[]; cores: Record<string, string> }[] = [
  {
    // cenoura
    mapa: [
      '........g.g.',
      '.......gGg..',
      '........Gg..',
      '......ooG...',
      '.....oooo...',
      '....ooOoo...',
      '...oooOo....',
      '...ooOo.....',
      '..oOoo......',
      '..ooo.......',
      '.oo.........',
      '.o..........',
    ],
    cores: { o: '#e07a2e', O: '#a9531d', g: '#6fa356', G: '#4f7d3c' },
  },
  {
    // repolho
    mapa: [
      '....CCCC....',
      '..CCccccCC..',
      '.CccvccvccC.',
      '.ccvccccvcc.',
      'Cccvccccvccc',
      'Cccvcvvcvccc',
      'Cccvvccvvccc',
      '.ccvccccvcc.',
      '.CccvccvccC.',
      '..CCccccCC..',
      '....CCCC....',
      '............',
    ],
    cores: { c: '#8fbf6e', C: '#4f7d3c', v: '#d6e8c0' },
  },
  {
    // tomate
    mapa: [
      '.....gg.....',
      '...ggggggg..',
      '..rrrggrrr..',
      '.rrhrrrrrrr.',
      'rrhhrrrrrrrr',
      'rrhrrrrrrrRr',
      'rrrrrrrrrrRr',
      'rrrrrrrrrRRr',
      '.rrrrrrrRRr.',
      '.RrrrrrRRrR.',
      '..RRRRRRRR..',
      '....RRRR....',
    ],
    cores: { r: '#d0503c', R: '#93362a', h: '#f2a796', g: '#5f9447' },
  },
  {
    // berinjela
    mapa: [
      '........gg..',
      '.......gGg..',
      '......GGgg..',
      '.....pPGg...',
      '....ppppP...',
      '...phpppP...',
      '..phppppP...',
      '.phpppppP...',
      '.ppppppPP...',
      '.pppppPPP...',
      '..pppPPP....',
      '...PPP......',
    ],
    cores: { p: '#7a5296', P: '#4e3364', h: '#b394c9', g: '#6fa356', G: '#4f7d3c' },
  },
  {
    // milho
    mapa: [
      '.....yy.....',
      '....yYyy....',
      '....yyYy....',
      '...LyYyyL...',
      '...LyyYyL...',
      '..lLyYyyLl..',
      '..lLyyYyLl..',
      '..llLyyLll..',
      '...llLLll...',
      '....llll....',
      '.....ll.....',
      '......l.....',
    ],
    cores: { y: '#f0cf5a', Y: '#c49a2e', l: '#8fbf6a', L: '#4f7d3c' },
  },
  {
    // nabo
    mapa: [
      '....g..g....',
      '....gg.g....',
      '.....ggg....',
      '...mmmmmm...',
      '..mmmmmmMm..',
      '.wmmmmmmmMw.',
      '.wwwwwwwwwW.',
      '.wwwwwwwwWW.',
      '..wwwwwwWW..',
      '...wwwwWW...',
      '.....wW.....',
      '.....W......',
    ],
    cores: { w: '#f6ece2', W: '#c7b0a4', m: '#b05a8a', M: '#7e3c62', g: '#6fa356' },
  },
];

/** Os algarismos e o "×" em 3 × 5, para a contagem e a cadeia (sem palavra nenhuma). */
const FONTE: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  x: ['...', '#.#', '.#.', '#.#', '...'],
};

/** Escreve com a fonte de pixels, com contorno escuro. `escala` em pixels da tela pequena. */
export function escrever(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, escala: number, cor: string) {
  const largura = texto.length * 4 * escala - escala;
  const cx = Math.round(x - largura / 2);
  const cy = Math.round(y - (5 * escala) / 2);
  const pintar = (dx: number, dy: number, c: string) => {
    ctx.fillStyle = c;
    let px = cx;
    for (const ch of texto) {
      const g = FONTE[ch];
      if (g) for (let l = 0; l < 5; l++) for (let k = 0; k < 3; k++) if (g[l][k] === '#') ctx.fillRect(px + k * escala + dx, cy + l * escala + dy, escala, escala);
      px += 4 * escala;
    }
  };
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pintar(dx, dy, '#2a2026');
  pintar(0, 0, cor);
}

/** As peças prontas (cada uma pintada uma vez numa tela à parte). */
let pecas: HTMLCanvasElement[] | null = null;
function pecasProntas(): HTMLCanvasElement[] {
  if (pecas) return pecas;
  const feitas: HTMLCanvasElement[] = [];
  for (let t = 0; t <= CAIXA; t++) {
    const tela = document.createElement('canvas');
    tela.width = PECA;
    tela.height = PECA;
    const g = tela.getContext('2d')!;
    if (t === CAIXA) {
      // o caixote: tábuas e a cruz
      g.fillStyle = '#6e4a2f';
      g.fillRect(0, 0, PECA, PECA);
      g.fillStyle = COR_DA_CAIXA;
      g.fillRect(1, 1, PECA - 2, PECA - 2);
      g.fillStyle = '#b5845a';
      g.fillRect(1, 1, PECA - 2, 1);
      g.fillStyle = '#7d5536';
      for (const y of [5, 10]) g.fillRect(1, y, PECA - 2, 1);
      g.fillStyle = '#c99a6a';
      for (let k = 2; k < 14; k++) {
        g.fillRect(k, k, 1, 1);
        g.fillRect(15 - k, k, 1, 1);
      }
    } else {
      // o fundo, de cantos cortados, com a borda mais escura e um brilho em cima
      g.fillStyle = BORDAS[t];
      g.fillRect(1, 0, PECA - 2, PECA);
      g.fillRect(0, 1, PECA, PECA - 2);
      g.fillStyle = FUNDOS[t];
      g.fillRect(1, 1, PECA - 2, PECA - 2);
      g.fillStyle = '#fbf3e4';
      g.globalAlpha = 0.35;
      g.fillRect(2, 1, PECA - 4, 1);
      g.globalAlpha = 1;
      const { mapa, cores } = LEGUMES[t];
      for (let l = 0; l < 12; l++) {
        for (let k = 0; k < 12; k++) {
          const cor = cores[mapa[l][k]];
          if (!cor) continue;
          g.fillStyle = cor;
          g.fillRect(2 + k, 2 + l, 1, 1);
        }
      }
    }
    feitas.push(tela);
  }
  pecas = feitas;
  return feitas;
}

export interface Enfeites {
  /** O cursor (as duas casas da troca), ou null. */
  cursor: { l: number; c: number } | null;
  /** A casa escolhida pelo toque. */
  escolhida: { l: number; c: number } | null;
  /** Os números da cadeia que sobem e somem. */
  avisos: { texto: string; x: number; y: number; idade: number }[];
  /** A contagem da largada (3, 2, 1), ou null. */
  contagem: number | null;
  /** Acabou: a pilha fica apagada. */
  apagado: boolean;
}

/** Desenha o tabuleiro inteiro (a tela pequena de 96 × 192). */
export function desenharTabuleiro(ctx: CanvasRenderingContext2D, e: Estado, enfeites: Enfeites) {
  const p = pecasProntas();
  const s = e.subida;
  ctx.fillStyle = '#2e2630';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  // as colunas, de leve
  ctx.fillStyle = '#352c38';
  for (let c = 0; c < COLUNAS; c += 2) ctx.fillRect(c * PECA, 0, PECA, ALTURA);
  // o perigo: a pilha no teto, o alto pisca em vermelho
  let topo = false;
  for (let c = 0; c < COLUNAS; c++) if (e.tipo[c] !== VAZIO) topo = true;
  if (topo && !enfeites.apagado && Math.floor(e.passo / 8) % 2 === 0) {
    ctx.fillStyle = '#8a3a34';
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, 0, LARGURA, PECA * 2);
    ctx.globalAlpha = 1;
  }
  for (let l = 0; l < LINHAS; l++) {
    for (let c = 0; c < COLUNAS; c++) {
      const i = l * COLUNAS + c;
      const t = e.tipo[i];
      if (t === VAZIO) continue;
      const x = c * PECA;
      const y = l * PECA - s;
      const st = e.estado[i];
      if (st === LIMPANDO && e.timer[i] < 10) {
        // o fim do brilho: a peça encolhe e some
        const k = Math.max(2, Math.round((e.timer[i] / 10) * PECA));
        ctx.drawImage(p[t], x + (PECA - k) / 2, y + (PECA - k) / 2, k, k);
        continue;
      }
      ctx.drawImage(p[t], x, y);
      if ((st === LIMPANDO || st === VIRANDO) && Math.floor(e.timer[i] / 4) % 2 === 0) {
        ctx.fillStyle = '#fbf3e4';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, y, PECA, PECA);
        ctx.globalAlpha = 1;
      }
    }
  }
  // a linha que vem por baixo, apagada
  for (let c = 0; c < COLUNAS; c++) {
    const t = e.proxima[c];
    if (t === undefined) continue;
    ctx.drawImage(p[t], c * PECA, ALTURA - s);
  }
  if (s > 0) {
    ctx.fillStyle = '#1e1822';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, ALTURA - s, LARGURA, s);
    ctx.globalAlpha = 1;
  }
  if (enfeites.escolhida) {
    const { l, c } = enfeites.escolhida;
    ctx.strokeStyle = '#fbf3e4';
    ctx.lineWidth = 1;
    ctx.strokeRect(c * PECA + 0.5, l * PECA - s + 0.5, PECA - 1, PECA - 1);
  }
  if (enfeites.cursor && !enfeites.apagado) {
    const { l, c } = enfeites.cursor;
    const x = c * PECA;
    const y = l * PECA - s;
    const a = Math.floor(e.passo / 20) % 2 === 0 ? 0 : 1;
    ctx.fillStyle = '#fbf3e4';
    const w = PECA * 2;
    for (const [cx, cy, dx, dy] of [
      [x - 1 - a, y - 1 - a, 1, 1],
      [x + w + a, y - 1 - a, -1, 1],
      [x - 1 - a, y + PECA + a, 1, -1],
      [x + w + a, y + PECA + a, -1, -1],
    ]) {
      ctx.fillRect(dx > 0 ? cx : cx - 4, cy, 5, 1);
      ctx.fillRect(cx, dy > 0 ? cy : cy - 4, 1, 5);
    }
  }
  if (enfeites.apagado) {
    ctx.fillStyle = '#1e1822';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    ctx.globalAlpha = 1;
  }
  for (const a of enfeites.avisos) escrever(ctx, a.texto, a.x, a.y - a.idade / 4, 2, '#f0cf5a');
  if (enfeites.contagem !== null) escrever(ctx, String(enfeites.contagem), LARGURA / 2, ALTURA / 2, 6, '#fbf3e4');
}

/** O tabuleiro pequeno de um adversário, pelas 72 letras que o servidor manda. */
export function desenharMiniatura(ctx: CanvasRenderingContext2D, grade: string, vivo: boolean) {
  const k = 4;
  ctx.fillStyle = '#2e2630';
  ctx.fillRect(0, 0, COLUNAS * k, LINHAS * k);
  for (let i = 0; i < grade.length && i < COLUNAS * LINHAS; i++) {
    const ch = grade[i];
    if (ch === '.') continue;
    ctx.fillStyle = ch === 'x' ? COR_DA_CAIXA : (FUNDOS[Number(ch)] ?? '#888888');
    ctx.fillRect((i % COLUNAS) * k, Math.floor(i / COLUNAS) * k, k - 1, k - 1);
  }
  if (!vivo) {
    ctx.fillStyle = '#1e1822';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, COLUNAS * k, LINHAS * k);
    ctx.globalAlpha = 1;
  }
}
