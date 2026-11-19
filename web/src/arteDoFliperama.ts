/**
 * A ARTE DAS INSÍGNIAS DO FLIPERAMA (19/11/2026), em pixel art feita por código: uma grade de letras vira um SVG de
 * quadradinhos, servido como `data:` para caber no <img> da Insignia (Medalha.tsx). Nada de PixelLab: são três desenhos
 * pequenos (16 × 16), um por degrau, e a moldura (bronze, prata, ouro) é que diz qual é qual.
 *
 * - 5 jogos: o controle.
 * - 15 jogos: a alavanca e os botões do fliperama.
 * - 30 jogos: o gabinete do fliperama, com a tela acesa.
 */

const CORES: Record<string, string> = {
  k: '#1b1626', // contorno
  c: '#5b4a8a', // corpo do controle e do gabinete
  C: '#7d68b8', // brilho do corpo
  d: '#3a2f5c', // sombra do corpo
  r: '#e0455a', // botão vermelho
  R: '#ff8a8a', // brilho do vermelho
  y: '#f2c744', // botão amarelo
  b: '#48a7e0', // botão azul
  g: '#5fd18a', // botão verde e tela
  G: '#b6f5c8', // brilho da tela
  w: '#f4efe6', // branco quente
  s: '#2a2340', // tela apagada
  m: '#9aa3ad', // metal da alavanca
};

const CONTROLE = [
  '................',
  '................',
  '................',
  '..kkkkk..kkkkk..',
  '.kCCCCCkkCCCCCk.',
  'kCcckccccccrRcck',
  'kcckwkcccccrrcck',
  'kckwwwkcccyccbck',
  'kcckwkcccccggcck',
  'kccckccccccggcck',
  'kcccccdkkdccccck',
  'kcccccdk.kdccck.',
  '.kcccdk...kdcck.',
  '..kkkk.....kkk..',
  '................',
  '................',
];

const ALAVANCA = [
  '................',
  '....kkk.........',
  '...krRrk........',
  '...krrrk........',
  '....kkk.........',
  '.....km.........',
  '.....km.........',
  '.....km...kk.kk.',
  '.....km..kyykbbk',
  '..kkkkmkkkyykbbk',
  '.kCCCCCCCCkkCkkk',
  'kCccccccccccgg.k',
  'kcckrrkcckyykggk',
  'kddkrrkddkyykddk',
  'kddddddddddddddk',
  '.kkkkkkkkkkkkkk.',
];

const GABINETE = [
  '...kkkkkkkkkk...',
  '...kCCCCCCCCk...',
  '...kryrbrgryk...',
  '...kkkkkkkkkk...',
  '...kcksssskck...',
  '...kckGgggkck...',
  '...kckgwgGkck...',
  '...kckggggkck...',
  '...kckkkkkkck...',
  '..kCCCCCCCCCCk..',
  '..kcmkcrkykbck..',
  '..kcccccccccck..',
  '...kccddddcck...',
  '...kccdddddck...',
  '...kccddddcck...',
  '...kkkkkkkkkk...',
];

function svgDe(grade: string[]): string {
  const quadrados: string[] = [];
  grade.forEach((linha, y) => {
    [...linha].forEach((letra, x) => {
      const cor = CORES[letra];
      if (cor) quadrados.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${cor}"/>`);
    });
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${quadrados.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const ARTE_DO_FLIPERAMA = {
  controle: svgDe(CONTROLE),
  alavanca: svgDe(ALAVANCA),
  gabinete: svgDe(GABINETE),
};

/** Para o teste: as grades, que precisam ter 16 × 16 e só letras da paleta. */
export const _GRADES = { CONTROLE, ALAVANCA, GABINETE, CORES };
