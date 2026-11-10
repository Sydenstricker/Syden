import type { Receita } from './receita';

/**
 * O COELHO MONTADO NA HORA (10/11/2026): as tiras de cada corpo (public/coelho/, geradas por web/scripts/coelho-camadas.py),
 * com a troca de paleta do criador. Cada pixel tem a sua classe no mapa (pelo = 1, roupa = 2, o resto = 3: olhos, contorno,
 * orelha por dentro); o tom de cada pixel em relação ao tom do meio da classe vira o mesmo tom da cor escolhida. O tom de
 * referência é o do quadro 0 da direção, FIXO (recalcular por quadro fazia a roupa piscar: a auditoria das camadas).
 * Depois os acessórios: a camada pintada uma vez por direção, no lugar medido em cada quadro (null: o quadro fica sem ele).
 */

export const DIRECOES = ['south-east', 'south-west', 'north-west', 'north-east'] as const;
export type Direcao = (typeof DIRECOES)[number];
export type Animacao = 'parado' | 'acenando';

interface EntradaDaAnimacao {
  n: number;
  ref: Record<string, number>;
  acessorios: Record<string, ([number, number] | null)[]>;
}
interface Dados {
  lado: number;
  versao: string;
  corpos: Record<string, { animacoes: Record<string, Record<string, EntradaDaAnimacao>>; camadas: Record<string, string[]> }>;
}

const BASE = `${import.meta.env.BASE_URL}coelho/`;
let dadosP: Promise<Dados> | null = null;
export function carregarDados(): Promise<Dados> {
  dadosP ??= fetch(`${BASE}dados.json`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`coelho/dados.json: ${r.status}`);
    return r.json() as Promise<Dados>;
  });
  dadosP.catch(() => (dadosP = null));
  return dadosP;
}

const imagens = new Map<string, Promise<ImageData>>();
function pixelsDe(arquivo: string, versao: string): Promise<ImageData> {
  let p = imagens.get(arquivo);
  if (!p) {
    p = new Promise<ImageData>((ok, falhou) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0);
        ok(g.getImageData(0, 0, c.width, c.height));
      };
      img.onerror = () => falhou(new Error(`não carregou ${arquivo}`));
      img.src = `${BASE}${arquivo}?v=${versao}`;
    });
    p.catch(() => imagens.delete(arquivo));
    imagens.set(arquivo, p);
  }
  return p;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** O tom k (1 = o do meio) da cor alvo: abaixo de 1 escurece até 25%, acima clareia em direção ao branco. */
function rampa(alvo: [number, number, number], k: number): [number, number, number] {
  if (k <= 1) return alvo.map((c) => c * (0.25 + 0.75 * k)) as [number, number, number];
  const t = Math.min(1, (k - 1) * 1.1);
  return alvo.map((c) => c + (255 - c) * t) as [number, number, number];
}

function recolorir(d: Uint8ClampedArray, sel: (j: number) => boolean, alvo: string, refFixa?: number) {
  let ref = refFixa;
  if (!ref) {
    const ls: number[] = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20 && sel(i >> 2)) ls.push(lum(d[i], d[i + 1], d[i + 2]));
    ls.sort((a, b) => a - b);
    ref = ls[ls.length >> 1] || 1;
  }
  const a = rgb(alvo);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 20 || !sel(i >> 2)) continue;
    const [r, g, b] = rampa(a, lum(d[i], d[i + 1], d[i + 2]) / ref);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

/** Quantos quadros a animação tem nessa direção (0 se o corpo não a tem). */
export async function quadrosDe(corpo: string, anim: Animacao, dir: Direcao): Promise<number> {
  const dados = await carregarDados();
  return dados.corpos[corpo]?.animacoes[anim]?.[dir]?.n ?? 0;
}

const prontos = new Map<string, Promise<HTMLCanvasElement>>();

/** Um quadro do coelho da receita, num quadrado de LADO px (144), já com as cores e os acessórios. */
export function quadroDoCoelho(receita: Receita, anim: Animacao, dir: Direcao, k: number): Promise<HTMLCanvasElement> {
  const chave = JSON.stringify([receita, anim, dir, k]);
  let p = prontos.get(chave);
  if (p) return p;
  p = montar(receita, anim, dir, k);
  p.catch(() => prontos.delete(chave));
  prontos.set(chave, p);
  // um teto, para o criador não guardar todo coelho que a pessoa experimentou
  if (prontos.size > 400) prontos.delete(prontos.keys().next().value!);
  return p;
}

async function montar(receita: Receita, anim: Animacao, dir: Direcao, k: number): Promise<HTMLCanvasElement> {
  const dados = await carregarDados();
  const L = dados.lado;
  const corpo = dados.corpos[receita.corpo] ?? dados.corpos.mascote;
  const nomeDoCorpo = dados.corpos[receita.corpo] ? receita.corpo : 'mascote';
  const e = corpo.animacoes[anim]?.[dir];
  if (!e) throw new Error(`o corpo ${nomeDoCorpo} não tem ${anim} ${dir}`);
  const q = ((k % e.n) + e.n) % e.n;
  const [tira, mapa] = await Promise.all([pixelsDe(`${nomeDoCorpo}/${anim}-${dir}.png`, dados.versao), pixelsDe(`${nomeDoCorpo}/${anim}-${dir}-mapa.png`, dados.versao)]);
  // o quadro q da tira
  const quadro = new ImageData(L, L);
  const classe = new Uint8Array(L * L);
  for (let y = 0; y < L; y++) {
    const de = (y * tira.width + q * L) * 4;
    quadro.data.set(tira.data.subarray(de, de + L * 4), y * L * 4);
    for (let x = 0; x < L; x++) classe[y * L + x] = Math.round(mapa.data[de + x * 4] / 80);
  }
  if (receita.pelo) recolorir(quadro.data, (j) => classe[j] === 1, receita.pelo, e.ref['1']);
  if (receita.roupa) recolorir(quadro.data, (j) => classe[j] === 2, receita.roupa, e.ref['2']);

  const c = document.createElement('canvas');
  c.width = c.height = L;
  const g = c.getContext('2d')!;
  g.putImageData(quadro, 0, 0);
  // a bandana antes do boné (o boné fica por cima, como no criador)
  for (const [acc, cor] of [
    [receita.pescoco, receita.pescocoCor],
    [receita.cabeca, receita.cabecaCor],
  ] as const) {
    if (!acc) continue;
    const onde = e.acessorios[acc]?.[q];
    if (!onde) continue;
    const camada = await pixelsDe(`${nomeDoCorpo}/${acc}-${dir}.png`, dados.versao);
    const px = new ImageData(new Uint8ClampedArray(camada.data), camada.width, camada.height);
    if (cor) recolorir(px.data, () => true, cor);
    const t = document.createElement('canvas');
    t.width = px.width;
    t.height = px.height;
    t.getContext('2d')!.putImageData(px, 0, 0);
    g.drawImage(t, onde[0], onde[1]);
  }
  return c;
}

const bustos = new Map<string, Promise<string>>();

/**
 * O BUSTO DO COELHO PARA O AVATAR (a lista, as mensagens): o quadro 0 do parado, de frente (sudeste), cortado num quadrado
 * da cabeça aos ombros e ampliado sem borrar. Uma imagem por receita, guardada enquanto a página vive.
 */
export function bustoDoCoelho(receita: Receita): Promise<string> {
  const chave = JSON.stringify(receita);
  let p = bustos.get(chave);
  if (!p) {
    p = quadroDoCoelho(receita, 'parado', 'south-east', 0).then((c) => {
      const g = c.getContext('2d', { willReadFrequently: true })!;
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let topo = c.height, base = 0, esq = c.width, dir = 0;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++)
          if (d[(y * c.width + x) * 4 + 3] > 20) {
            topo = Math.min(topo, y);
            base = Math.max(base, y);
            esq = Math.min(esq, x);
            dir = Math.max(dir, x);
          }
      // um quadrado de 70% da altura, a partir do alto (com uma folga), centrado no meio do desenho
      const lado = Math.round((base - topo) * 0.7);
      const cx = Math.round((esq + dir) / 2);
      const x0 = cx - lado / 2;
      const y0 = topo - 2;
      const ESCALA = 4;
      const s = document.createElement('canvas');
      s.width = s.height = lado * ESCALA;
      const sg = s.getContext('2d')!;
      sg.imageSmoothingEnabled = false;
      sg.drawImage(c, x0, y0, lado, lado, 0, 0, s.width, s.height);
      return s.toDataURL('image/png');
    });
    p.catch(() => bustos.delete(chave));
    bustos.set(chave, p);
    // o mesmo teto dos quadros: experimentar cores no criador não acumula uma imagem por cor
    if (bustos.size > 200) bustos.delete(bustos.keys().next().value!);
  }
  return p;
}
