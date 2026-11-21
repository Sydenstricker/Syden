import type { FaseBase } from './sim';

/**
 * A ARTE DA ESQUADRILHA (20/11/2026): o chão de cada fase em ladrilhos, as explosões e os itens vêm do Pixel Shmup da Kenney
 * (CC0, `public/nave/`, com a licença ao lado). Só a folha de ladrilhos de 16 px: os aviões do pacote não entram (a praga é de
 * bichos, e a nave é a do coelho). Tudo em pixels inteiros, na escala 1 (ou 2 nas explosões grandes).
 *
 * Enquanto a folha não chega (ou se ela falhar), o desenho por código de sempre continua (`desenho.ts`): nada aqui é preciso
 * para jogar, e nada muda a conta (as figuras são só o desenho, as distâncias são as de `sim.ts`).
 */

export const LADO = 16;
const COLUNAS = 12;

/** Os ladrilhos usados (o número é a posição na folha, 12 por linha). */
export const L = {
  explosao: [5, 4, 6, 7] as const,
  fumaca: 8,
  faisca: 7,
  itemDuplo: 13,
  itemEspalhado: 15,
  itemEscudo: 26,
} as const;

let folha: HTMLCanvasElement | null = null;
let pedido: Promise<HTMLCanvasElement | null> | null = null;

/** A folha pronta (null enquanto carrega ou se falhou). */
export const arte = () => folha;

/**
 * Os ladrilhos do celeiro com o telhado e a bandeira AZUIS do pacote, recoloridos para o vermelho do celeiro (as duas cores do
 * telhado vermelho do próprio pacote, troca exata de cor: a pixel art não borra). Ficam numa linha a mais da folha.
 */
const RECOLORIR: [number, number][] = [
  [78, 120],
  [90, 121],
  [102, 122],
];
const TROCA: Record<string, [number, number, number]> = {
  '44,197,246': [252, 104, 59],
  '17,165,212': [222, 75, 30],
};

export function carregarArte(): Promise<HTMLCanvasElement | null> {
  if (pedido) return pedido;
  pedido = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height + LADO;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        for (const [de, para] of RECOLORIR) {
          const d = ctx.getImageData((de % COLUNAS) * LADO, Math.floor(de / COLUNAS) * LADO, LADO, LADO);
          for (let i = 0; i < d.data.length; i += 4) {
            const nova = TROCA[`${d.data[i]},${d.data[i + 1]},${d.data[i + 2]}`];
            if (nova) [d.data[i], d.data[i + 1], d.data[i + 2]] = nova;
          }
          ctx.putImageData(d, (para % COLUNAS) * LADO, Math.floor(para / COLUNAS) * LADO);
        }
        folha = c;
      } catch {
        folha = null;
      }
      resolve(folha);
    };
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}nave/kenney-pixel-shmup.png`;
  });
  return pedido;
}

/** Um ladrilho com o canto em (x, y), na escala inteira `k`. */
export function ladrilho(ctx: CanvasRenderingContext2D, f: HTMLCanvasElement, t: number, x: number, y: number, k = 1) {
  ctx.drawImage(f, (t % COLUNAS) * LADO, Math.floor(t / COLUNAS) * LADO, LADO, LADO, Math.round(x), Math.round(y), LADO * k, LADO * k);
}

/** Um ladrilho centrado em (x, y). */
export function ladrilhoNo(ctx: CanvasRenderingContext2D, f: HTMLCanvasElement, t: number, x: number, y: number, k = 1) {
  ladrilho(ctx, f, t, Math.round(x) - (LADO * k) / 2, Math.round(y) - (LADO * k) / 2, k);
}

/*
 * O CHÃO DE CADA FASE: 12 colunas × 30 linhas de 16 px (o rolo de 480, que se repete: a linha 29 encosta na 0, e o caminho que
 * atravessa a emenda fica na mesma coluna). A tela tem 180 de largura: a grade começa 6 px para fora, e as bordas cortam igual.
 */
const GRAMA: Record<string, number> = {
  '.': 110,
  ',': 50,
  s: 36,
  c: 109,
  t: 48,
  T: 60,
  o: 111,
  H: 84,
  h: 72,
  f: 96,
  '1': 40,
  '2': 41,
  '3': 52,
  '4': 53,
  w: 42,
  n: 62,
  u: 38,
  '[': 51,
  ']': 49,
  '-': 74,
  '|': 85,
  r: 73,
  '7': 75,
  L: 97,
  J: 99,
};
const TERRA: Record<string, number> = {
  '.': 116,
  c: 115,
  t: 54,
  T: 66,
  o: 117,
  H: 121,
  h: 120,
  f: 122,
  '1': 46,
  '2': 47,
  '3': 58,
  '4': 59,
  w: 42,
  n: 68,
  u: 44,
  '[': 57,
  ']': 55,
  '-': 80,
  '|': 91,
  r: 79,
  '7': 81,
  L: 103,
  J: 105,
};

const MAPAS: Record<FaseBase, { pecas: Record<string, number>; linhas: string[] }> = {
  // a horta: canteiros de brotos, fileiras de plantio, o laguinho, a casa com a bandeira e a trilha de terra
  horta: {
    pecas: GRAMA,
    linhas: [
      'T..|....ss.t',
      '...|.c..ss..',
      't..|.c..ss..',
      '...|.c.....T',
      '...L----7...',
      '.ss.....|...',
      '.ss1nn2.|.t.',
      '.ss[ww].|...',
      '.ss3uu4.|...',
      't.......|.cc',
      '..r-----J.cc',
      '..|.......cc',
      '..|.Hf..t...',
      'T.|.........',
      '..|..sss..ss',
      '..|..sss..ss',
      '..|.......ss',
      '..L---7....t',
      't.....|.....',
      '.cc...|1nn2.',
      '.cc...|[ww].',
      '.cc...|3uu4.',
      '......|..ss.',
      '.t.r--J..ss.',
      '...|.....ss.',
      '...|..t.....',
      'ss.|.....cc.',
      'ss.|..T..cc.',
      '...|.....cc.',
      '.t.|.......t',
    ],
  },
  // o pomar: as árvores em fileiras, a trilha entre elas, o laguinho e a casa do pomar
  pomar: {
    pecas: GRAMA,
    linhas: [
      '.t.t.|.t.t.t',
      '.....|......',
      '.T.T.|.T.T.T',
      '.....|......',
      '.t.t.L-7.t.t',
      '.......|....',
      '.T1nn2.|.T.T',
      '..[ww].|....',
      '.t3uu4.|.t.t',
      '.....r-J....',
      '.T.T.|..H.T.',
      '.....|..f...',
      '.t.t.|.t.t.t',
      '.....|......',
      'ccc..|.T.T.T',
      'ccc..|......',
      '.....|.t.t.t',
      '.T.T.L---7..',
      '.........|..',
      '.t.t.t.t.|.t',
      '.........|..',
      '.T.T.T.T.|.T',
      '......r--J..',
      '.t.t..|1nn2.',
      '......|[ww].',
      '.T.T..|3uu4.',
      '......|.t.t.',
      '.t.t..|.....',
      '.....rJ.T.T.',
      '.T.T.|......',
    ],
  },
  // o celeiro: o terreiro de terra, os celeiros vermelhos, o feno, o açude e o rego d'água
  celeiro: {
    pecas: TERRA,
    linhas: [
      '..t..|...cc.',
      '.....|...cc.',
      '.HH..|.o.cc.',
      '.....|......',
      'T....L--7..t',
      '.cc.....|...',
      '.cc1nn2.|.H.',
      '.cc[ww].|...',
      '...3uu4.|..T',
      '.t.r----J...',
      '...|...ccc..',
      '.H.|...ccc..',
      '...|.o......',
      'T..|....t.H.',
      '...L--7.....',
      '......|.cc..',
      '.cc...|.cc.T',
      '.cc...|1nn2.',
      '......|[ww].',
      '.H..r-J3uu4.',
      '....|......t',
      'T...|.ccc...',
      '....|.ccc.H.',
      '.o..|.......',
      '....L-7..T..',
      '.cc...|.....',
      '.cc..rJ..cc.',
      '.....|...cc.',
      '.t...|.H....',
      '.....|....t.',
    ],
  },
};

/** O rolo do chão da fase, em ladrilhos (`largura` × 480). */
export function pintarChaoDeLadrilhos(f: HTMLCanvasElement, fase: FaseBase, largura: number, altura: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  const ctx = c.getContext('2d')!;
  const { pecas, linhas } = MAPAS[fase];
  const x0 = Math.floor((largura - COLUNAS * LADO) / 2);
  linhas.forEach((linha, l) => {
    for (let k = 0; k < COLUNAS; k++) {
      // o fundo de baixo (as peças com coisa em cima já trazem o chão desenhado)
      ladrilho(ctx, f, pecas[linha[k]] ?? pecas['.'], x0 + k * LADO, l * LADO);
    }
  });
  return c;
}

export const MAPAS_DA_NAVE = MAPAS;
