/**
 * A loja de cosméticos do Syden. **Tudo o que está nela é de graça.**
 *
 * Isso não é um detalhe de implementação, é o modelo do produto: a filosofia é a do WinRAR — o programa
 * funciona inteiro, sem cobrar, sem travar, sem "versão pro". Quem quiser ajudar a pagar o servidor
 * contribui porque quis, e ganha enfeites exclusivos por isso. Nada do que se paga aqui compra vantagem:
 * é cor de nome e fundo de perfil.
 *
 * **O SERVIDOR SÓ CONHECE CÓDIGOS E COMO SE GANHA CADA UM.** A arte, o nome bonito e a descrição moram
 * no app (web/src/loja.ts), pela mesma razão das insígnias e das cores de nome: dá para trocar um
 * degradê publicando o site, sem tocar no servidor nem migrar banco. O que o servidor precisa saber é
 * só o que ele é o único capaz de garantir — quem tem direito a quê.
 */

export type TipoDeItem = 'cor' | 'fundo' | 'moldura' | 'insignia';

/**
 * Como se põe a mão num item.
 *
 * - `livre`: qualquer pessoa usa, sem pedir nada a ninguém. É a maior parte da loja.
 * - `conquista`: veio de ter feito alguma coisa (estar entre os 25 primeiros, ter uma ideia acolhida).
 *    Não se escolhe: aparece no inventário quando acontece.
 * - `contribuinte`: reservado a quem ajuda a pagar o servidor, por nível. **Ainda não dá para obter** —
 *    aparece na loja marcado, mostrando o que existe, e é honesto sobre isso.
 */
export type ComoSeGanha = 'livre' | 'conquista' | 'contribuinte';

export interface ItemDaLoja {
  codigo: string;
  tipo: TipoDeItem;
  comoSeGanha: ComoSeGanha;
  /** Só para os de contribuinte: 1 é o nível mais barato, 4 o mais alto. */
  nivel?: 1 | 2 | 3 | 4;
}

function livres(tipo: TipoDeItem, codigos: string[]): ItemDaLoja[] {
  return codigos.map((codigo) => ({ codigo, tipo, comoSeGanha: 'livre' as const }));
}

function deContribuinte(tipo: TipoDeItem, pares: [string, 1 | 2 | 3 | 4][]): ItemDaLoja[] {
  return pares.map(([codigo, nivel]) => ({ codigo, tipo, comoSeGanha: 'contribuinte' as const, nivel }));
}

export const CATALOGO: ItemDaLoja[] = [
  // As cores e os fundos que já existiam continuam livres, e é de propósito: ninguém perde o que já
  // estava usando porque uma loja foi aberta. Seria a pior estreia possível.
  ...livres('cor', ['padrao', 'carmim', 'laranja', 'ouro', 'limao', 'menta', 'ceu', 'anil', 'lavanda', 'rosa']),
  ...livres('fundo', ['nenhum', 'vila', 'poente', 'floresta', 'aurora', 'brasa', 'oceano', 'estrelas']),
  ...livres('moldura', ['nenhuma', 'prata', 'bronze', 'folha', 'mar', 'brasa-moldura']),

  // Exclusivos de quem contribui. Existem no catálogo desde já, marcados, para a loja poder mostrar o
  // que se ganha antes de a contribuição existir — e para ninguém achar que apareceram do nada depois.
  ...deContribuinte('cor', [
    ['cobre', 1],
    ['jade', 2],
    ['ametista', 3],
    ['prisma', 4],
  ]),
  ...deContribuinte('fundo', [
    ['nebulosa', 2],
    ['vitral', 3],
    ['cosmos', 4],
  ]),
  ...deContribuinte('moldura', [
    ['ouro-moldura', 1],
    ['esmeralda-moldura', 2],
    ['rubi', 3],
    ['prisma-moldura', 4],
  ]),

  { codigo: 'primeiros-25', tipo: 'insignia', comoSeGanha: 'conquista' },
  { codigo: 'ideia-acolhida', tipo: 'insignia', comoSeGanha: 'conquista' },
];

const PORCODIGO = new Map(CATALOGO.map((item) => [item.codigo, item]));

export function acharItem(codigo: string): ItemDaLoja | undefined {
  return PORCODIGO.get(codigo);
}

/**
 * Esta pessoa pode VESTIR este item?
 *
 * `tem` é a lista de códigos que ela já ganhou (o inventário). Um código que o servidor não conhece é
 * recusado: é assim que um app adulterado não consegue vestir "moldura-de-administrador".
 *
 * Item livre não precisa de inventário nenhum — pedir que a pessoa "pegue" uma cor grátis antes de usar
 * seria burocracia sem função, e ainda quebraria quem já estava usando a cor antes da loja existir.
 */
export function podeVestir(codigo: string | null, tipo: TipoDeItem, tem: readonly string[]): boolean {
  if (codigo === null) return true;
  const item = PORCODIGO.get(codigo);
  if (!item || item.tipo !== tipo) return false;
  return item.comoSeGanha === 'livre' || tem.includes(codigo);
}

/** Os níveis de contribuição, como aparecem na loja. Os valores em reais moram no app. */
export const NIVEIS: { nivel: 1 | 2 | 3 | 4; nome: string }[] = [
  { nivel: 1, nome: 'Apoio' },
  { nivel: 2, nome: 'Apoio prata' },
  { nivel: 3, nome: 'Apoio ouro' },
  { nivel: 4, nome: 'Mecenas' },
];
