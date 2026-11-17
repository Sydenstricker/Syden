/**
 * O COELHO DE CADA UM NA ARENA (17/11/2026): o coelho em camadas do criador (web/src/coelho/montar.ts), com a receita de cada
 * pessoa, nas direções que o desenho tem. Hoje são as quatro DIAGONAIS (parado, andando e o aceno, que vira o golpe; o aceno
 * só de frente); a mira em 360° mostra a direção mais perto entre as que existem. Quando houver as quatro retas (norte, sul,
 * leste, oeste), basta o coelho-camadas.py exportá-las: a escolha já olha as oito.
 *
 * Os quadros são montados uma vez (a troca de paleta) e guardados; enquanto um não fica pronto, a tela desenha o anterior.
 */
import { carregarDados, quadroDoCoelho, type Animacao, type Direcao } from '../coelho/montar';
import { lerCodigo, PRESETS, RECEITA_DO_MASCOTE, type Receita } from '../coelho/receita';
import { direcaoDoDesenho, OITO } from './direcao';

export { direcaoDoDesenho, OITO };

/** A receita do coelho de alguém nos jogos: a do criador, a do pronto que usa, ou o mascote. */
export function receitaDoAvatar(avatar: number | string | null | undefined): Receita {
  if (typeof avatar === 'string') return lerCodigo(avatar) ?? RECEITA_DO_MASCOTE;
  if (typeof avatar === 'number') return PRESETS[avatar] ?? RECEITA_DO_MASCOTE;
  return RECEITA_DO_MASCOTE;
}

type Dados = Awaited<ReturnType<typeof carregarDados>>;
let dados: Dados | null = null;
/** As receitas pedidas antes de os dados chegarem: preparadas quando eles chegam. */
const esperando = new Map<string, Receita>();
export function carregarCoelhos() {
  if (!dados)
    void carregarDados().then(
      (d) => {
        dados = d;
        for (const r of esperando.values()) prepararCoelho(r);
        esperando.clear();
      },
      () => {},
    );
}

/** As direções que o corpo tem nesta animação (o corpo que não existe é o mascote, como em montar.ts). */
function direcoesDe(corpo: string, anim: Animacao): Map<string, number> {
  const c = dados?.corpos[corpo] ?? dados?.corpos.mascote;
  const m = new Map<string, number>();
  for (const [d, e] of Object.entries(c?.animacoes[anim] ?? {})) m.set(d, e.n);
  return m;
}

const prontos = new Map<string, { c: HTMLCanvasElement; pe: [number, number] } | null>();
/** O último quadro pronto de cada receita. */
const ultimos = new Map<string, { c: HTMLCanvasElement; pe: [number, number] }>();

/** O pé (x do meio, y do chão) do desenho, medido no quadro. */
function medirPe(c: HTMLCanvasElement): [number, number] {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let base = 0, esq = c.width, dir = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 20) {
        base = Math.max(base, y);
        esq = Math.min(esq, x);
        dir = Math.max(dir, x);
      }
  return [Math.round((esq + dir) / 2), base];
}

const ancoras = new Map<string, [number, number]>();

/**
 * Um quadro do coelho, já pronto, ou null (pedido agora; vem no próximo desenho). `anim` cai no parado quando o corpo não a tem
 * naquela direção (o aceno de costas). Devolve também o pé, para pôr o desenho no lugar.
 */
export function quadroDaArena(receita: Receita, anim: Animacao, mx: number, my: number, ms: number): { c: HTMLCanvasElement; pe: [number, number] } | null {
  if (!dados) {
    carregarCoelhos();
    return null;
  }
  const paradas = direcoesDe(receita.corpo, 'parado');
  const dirParado = direcaoDoDesenho(mx, my, paradas.keys());
  if (!dirParado) return null;
  let a = anim;
  let d: string | null = dirParado;
  if (a !== 'parado') {
    const tem = direcoesDe(receita.corpo, a);
    // a animação na mesma direção do parado; se não existe nela, o parado (o coelho não se vira para acenar)
    d = tem.has(dirParado) ? dirParado : null;
    if (!d) {
      a = 'parado';
      d = dirParado;
    }
  }
  const n = direcoesDe(receita.corpo, a).get(d) ?? 1;
  // o ritmo "em dois" (12 desenhos por segundo); parado, mais devagar
  const k = Math.floor(ms / (a === 'parado' ? 125 : 83)) % n;
  const chave = JSON.stringify([receita, a, d, k]);
  const pronto = prontos.get(chave);
  const daReceita = JSON.stringify(receita);
  if (pronto) {
    ultimos.set(daReceita, pronto);
    return pronto;
  }
  if (pronto === undefined) {
    prontos.set(chave, null);
    const chaveDaAncora = JSON.stringify([receita, a, d]);
    quadroDoCoelho(receita, a, d as Direcao, k).then(
      (c) => {
        // o pé é o do quadro 0 da animação nessa direção (para o desenho não tremer quando o braço abre)
        let pe = ancoras.get(chaveDaAncora);
        if (!pe && k === 0) ancoras.set(chaveDaAncora, (pe = medirPe(c)));
        prontos.set(chave, { c, pe: pe ?? medirPe(c) });
        if (prontos.size > 900) prontos.delete(prontos.keys().next().value!);
      },
      () => prontos.delete(chave),
    );
  }
  // enquanto este não vem, o quadro 0 do parado nessa direção, ou o último que este coelho mostrou (nunca some da tela)
  return prontos.get(JSON.stringify([receita, 'parado', dirParado, 0])) ?? ultimos.get(daReceita) ?? null;
}

/** Pede de antemão os quadros de uma receita (para a primeira vez não piscar). */
export function prepararCoelho(receita: Receita) {
  carregarCoelhos();
  if (!dados) {
    esperando.set(JSON.stringify(receita), receita);
    return;
  }
  for (const anim of ['parado', 'andando', 'acenando'] as Animacao[]) {
    for (const [d, n] of direcoesDe(receita.corpo, anim)) {
      for (let k = 0; k < n; k++) quadroDaArena(receita, anim, OITO.find((o) => o[0] === d)![1], OITO.find((o) => o[0] === d)![2], k * (anim === 'parado' ? 125 : 83));
    }
  }
}
