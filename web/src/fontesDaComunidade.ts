import { FONTES_EMBUTIDAS } from './fontes.gerado';
import { chave } from './i18n';

/**
 * A LETRA DO NOME DA COMUNIDADE.
 *
 * ===================================================================================================
 * NENHUMA DELAS BAIXA FONTE, E ISSO É A DECISÃO, NÃO UMA LIMITAÇÃO.
 *
 * O caminho fácil seria o Google Fonts, e o Syden até já o usa — mas só para a Noto, e só quando a
 * PESSOA escolhe um idioma de escrita não latina. Ou seja: é a escolha dela, sobre o aparelho dela,
 * e quem só usa português nunca fala com o Google.
 *
 * Uma fonte de comunidade inverte isso. Quem administra escolheria, e o navegador de TODO MUNDO que
 * abrisse a comunidade iria buscar o arquivo — gente que hoje nunca encosta no Google passaria a
 * encostar, por decisão de outra pessoa. É a mesma forma do problema que fechou os GIFs numa lista
 * de domínios e que fez a capa ser baixada pelo servidor em vez de apontada.
 *
 * Então são PILHAS QUE TODO SISTEMA JÁ TEM, exatamente como os efeitos de nome (ver profileStyles.ts).
 * Nada para baixar, nada que falhe sem internet, e nada nos termos ou na política de privacidade.
 *
 * E TEM UM GANHO QUE NÃO É ÓBVIO: pilha de sistema não quebra escrita nenhuma. Uma fonte decorativa
 * baixada costuma ter só o alfabeto latino, e o nome de uma comunidade grega, tailandesa ou árabe
 * viraria quadradinho PARA TODO MUNDO — porque o nome é o mesmo para todos, escrito uma vez por quem
 * criou. A pilha termina em `inherit`, então o que o sistema não tiver cai na fonte do idioma.
 * ===================================================================================================
 *
 * As famílias são escolhidas por CONTRASTE entre si: lado a lado, as cinco têm de ser reconhecíveis
 * à primeira vista. Duas variações da mesma ideia seriam duas opções que ninguém sabe diferenciar.
 */
export interface FonteDaComunidade {
  id: string;
  nome: string;
  /** O que entra no `font-family`. Termina sempre numa família genérica, nunca num nome só. */
  pilha: string;
  /**
   * Os caracteres que a fonte tem, quando ela é embutida. As pilhas de sistema não têm: o sistema
   * completa o que faltar, letra a letra, e o nome nunca vira quadradinho.
   */
  faixas?: string;
}

/*
 * AS VINTE EMBUTIDAS, e a regra que as acompanha: SÓ SE OFERECE A FONTE QUE TEM AS LETRAS DO NOME.
 *
 * Quem decide não é o idioma da tela, é o TEXTO: um brasileiro pode se chamar さくら, e um japonês
 * pode ter nome em letras latinas. Fonte decorativa costuma ter só o latino; oferecer a Lobster para
 * um nome em grego seria oferecer quadradinhos — ou, pior, uma mistura de duas letras na mesma
 * palavra, porque o navegador completa o que falta com outra família.
 *
 * Os arquivos são baixados pelo script e saem do nosso domínio (ver CLAUDE.md, "Fonte de terceiro").
 * Cada fonte vem em um arquivo por escrita, com `unicode-range`: quem só escreve em português nunca
 * baixa o cirílico, e quem nunca vê uma comunidade com letra própria não baixa nada.
 */
const GENERICA: Record<string, string> = {
  serif: 'serif',
  'sans-serif': 'sans-serif',
  monospace: 'monospace',
  handwriting: 'cursive',
  display: 'sans-serif',
};

/** "U+0000-00FF,U+0131" → [[0, 255], [305, 305]] */
function lerFaixas(faixas: string): [number, number][] {
  return faixas.split(',').map((parte) => {
    const [de, ate] = parte.trim().replace(/^U\+/i, '').split('-');
    const inicio = parseInt(de, 16);
    return [inicio, ate ? parseInt(ate, 16) : inicio];
  });
}

const FAIXAS_LIDAS = new Map<string, [number, number][]>();

/**
 * A fonte tem todas as letras deste texto? Espaço, emoji e símbolo não contam: eles vêm de outra
 * família em qualquer caso, e um emoji no nome não deveria esconder as vinte fontes.
 */
export function fonteCobre(fonte: FonteDaComunidade, texto: string): boolean {
  if (!fonte.faixas) return true;
  let faixas = FAIXAS_LIDAS.get(fonte.id);
  if (!faixas) {
    faixas = lerFaixas(fonte.faixas);
    FAIXAS_LIDAS.set(fonte.id, faixas);
  }
  for (const letra of texto) {
    if (!/[\p{L}\p{M}\p{N}]/u.test(letra)) continue;
    const ponto = letra.codePointAt(0)!;
    if (!faixas.some(([de, ate]) => ponto >= de && ponto <= ate)) return false;
  }
  return true;
}

export const FONTES_DA_COMUNIDADE: FonteDaComunidade[] = [
  { id: 'padrao', nome: chave('Padrão'), pilha: '' },
  {
    id: 'serifa',
    nome: chave('Com serifa'),
    pilha: "Georgia, 'Times New Roman', 'Noto Serif', serif",
  },
  {
    id: 'mono',
    nome: chave('Máquina de escrever'),
    pilha: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', monospace",
  },
  // AS EMBUTIDAS VÊM DEPOIS, e a lista delas é GERADA (scripts/baixar-fontes.mjs → fontes.gerado.ts).
  ...FONTES_EMBUTIDAS.map((fonte) => ({
    id: fonte.id,
    // Nome próprio de fonte não se traduz: "Lobster" é Lobster em qualquer língua.
    nome: fonte.nome,
    pilha: `'${fonte.familia}', ${GENERICA[fonte.categoria] ?? 'sans-serif'}`,
    faixas: fonte.faixas,
  })),
];

/**
 * O EFEITO DO NOME DA COMUNIDADE — brilho, pulso, arco-íris.
 *
 * SÃO OS MESMOS CÓDIGOS DOS EFEITOS DE NOME DE PESSOA (ver profileStyles.ts), e isso é de propósito:
 * o desenho já existe em `[data-efeito='…']`, no CSS, e as cinco etiquetas já estão traduzidas nos
 * 28 idiomas. Uma lista paralela com nomes próprios seria desenho repetido e tradução repetida.
 *
 * O QUE NÃO ENTRA SÃO OS TIPOGRÁFICOS. 'serifa', 'mono' e 'versalete' existem para o nome de pessoa
 * porque lá não há escolha de fonte; aqui há, logo acima. Oferecer os dois seria dar duas maneiras
 * de fazer a mesma coisa, que acabam brigando entre si.
 */
export const EFEITOS_DA_COMUNIDADE: { id: string; nome: string }[] = [
  { id: 'sem-efeito', nome: chave('Sem efeito') },
  { id: 'brilho', nome: chave('Brilho') },
  { id: 'pulso', nome: chave('Pulso') },
  { id: 'arco-iris', nome: chave('Arco-íris') },
  { id: 'sombra', nome: chave('Sombra') },
];

const IDS_EFEITO = new Set(EFEITOS_DA_COMUNIDADE.map((e) => e.id));

/** O que vai no `data-efeito`; `undefined` quando não há efeito ou o código é desconhecido. */
export function efeitoDaComunidade(escolha: string | null | undefined): string | undefined {
  return escolha && escolha !== 'sem-efeito' && IDS_EFEITO.has(escolha) ? escolha : undefined;
}

const PORID = new Map(FONTES_DA_COMUNIDADE.map((f) => [f.id, f]));

/**
 * A pilha de uma escolha, ou vazio para a fonte de sempre.
 *
 * Escolha que este site não conhece vira a padrão, e não um `font-family` inventado: o servidor pode
 * ser mais novo que o site que a pessoa tem aberto.
 */
export function pilhaDaFonte(escolha: string | null | undefined): string {
  return (escolha && PORID.get(escolha)?.pilha) || '';
}
