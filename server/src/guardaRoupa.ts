/**
 * O guarda-roupa do Syden: os cosméticos. **Tudo o que está nela é de graça, para todo mundo.**
 *
 * Isso não é um detalhe de implementação, é o modelo do produto: a filosofia é a do WinRAR — o programa
 * funciona inteiro, sem cobrar, sem travar, sem "versão pro". E não existe cosmético de pagante: quem
 * contribui **já tinha acesso a tudo** antes de contribuir, e continua tendo depois. A contribuição é
 * doação para ajudar a pagar o servidor, e não compra de enfeite.
 *
 * Isso é decisão do dono do projeto, tomada de propósito, e vale a pena registrar por quê: no instante
 * em que um enfeite passa a ser exclusivo de quem paga, o dinheiro deixa de ser doação e vira venda de
 * bem digital — o que muda o tratamento fiscal, aciona a regra de compra dentro do app das lojas de
 * celular, e transforma o guarda-roupa num catálogo de coisas que a maioria não pode ter. Nada disso é o que se
 * quer aqui.
 *
 * **O SERVIDOR SÓ CONHECE CÓDIGOS E COMO SE GANHA CADA UM.** A arte, o nome bonito e a descrição moram
 * no app (web/src/guardaRoupa.ts), pela mesma razão das insígnias e das cores de nome: dá para trocar um
 * degradê publicando o site, sem tocar no servidor nem migrar banco. O que o servidor precisa saber é
 * só o que ele é o único capaz de garantir — quem tem direito a quê.
 */

export type TipoDeItem = 'cor' | 'fundo' | 'moldura' | 'insignia' | 'efeito';

/**
 * Como se põe a mão num item. São só dois jeitos, e nenhum deles é pagando.
 *
 * - `livre`: qualquer pessoa usa, sem pedir nada a ninguém. É o guarda-roupa inteiro.
 * - `conquista`: veio de ter feito alguma coisa (estar entre os 25 primeiros, ter uma ideia acolhida).
 *    Não se escolhe e não se compra: aparece no inventário quando acontece. É a única coisa que alguém
 *    pode ter e outro não — e é assim de propósito, porque significa uma história, não um pagamento.
 */
export type ComoSeGanha = 'livre' | 'conquista';

export interface ItemDoGuardaRoupa {
  codigo: string;
  tipo: TipoDeItem;
  comoSeGanha: ComoSeGanha;
}

function livres(tipo: TipoDeItem, codigos: string[]): ItemDoGuardaRoupa[] {
  return codigos.map((codigo) => ({ codigo, tipo, comoSeGanha: 'livre' as const }));
}

export const CATALOGO: ItemDoGuardaRoupa[] = [
  // As cores e os fundos que já existiam continuam livres, e é de propósito: ninguém perde o que já
  // estava usando porque o guarda-roupa abriu. Seria a pior estreia possível.
  ...livres('cor', ['padrao', 'carmim', 'laranja', 'ouro', 'limao', 'menta', 'ceu', 'anil', 'lavanda', 'rosa']),
  ...livres('fundo', ['nenhum', 'vila', 'poente', 'floresta', 'aurora', 'brasa', 'oceano', 'estrelas']),
  ...livres('moldura', ['nenhuma', 'prata', 'bronze', 'folha', 'mar', 'brasa-moldura']),

  // Os mais chamativos. Chegaram junto com o guarda-roupa e são livres como todo o resto: a graça deles é serem
  // bonitos, não serem difíceis.
  ...livres('cor', ['cobre', 'jade', 'ametista', 'prisma']),
  ...livres('fundo', ['nebulosa', 'vitral', 'cosmos']),
  ...livres('moldura', ['ouro-moldura', 'esmeralda-moldura', 'rubi', 'prisma-moldura']),

  // O EFEITO DO NOME, que é o 'mesmo nome, novo visual'. Como todo o resto: livre.
  //
  // O servidor não sabe o que nenhum destes códigos faz, e é assim de propósito — o desenho mora em
  // web/src/guardaRoupa.ts e no CSS, então acrescentar um efeito novo é publicar o site, sem migrar banco.
  //
  // E NENHUM DELES BAIXA FONTE. Os tipográficos usam pilhas que todo sistema já tem (serifa,
  // monoespaçada) ou mexem no que já está desenhado (caixa alta, espaçamento). Uma fonte decorativa
  // custaria um download por pessoa, e um nome bonito não vale meio segundo de tela vazia.
  // O CÓDIGO É ÚNICO NO CATÁLOGO INTEIRO, e não por tipo — `PORCODIGO` é um mapa só. Por isso o
  // 'sem-efeito' não é 'nenhum': esse já é o fundo liso, e repetir faria o mapa resolver para o tipo
  // errado. É a mesma razão de 'brasa-moldura' existir ao lado de 'brasa'.
  ...livres('efeito', ['sem-efeito', 'brilho', 'pulso', 'arco-iris', 'sombra', 'serifa', 'mono', 'versalete']),

  { codigo: 'primeiros-25', tipo: 'insignia', comoSeGanha: 'conquista' },
  { codigo: 'ideia-acolhida', tipo: 'insignia', comoSeGanha: 'conquista' },
];

const PORCODIGO = new Map(CATALOGO.map((item) => [item.codigo, item]));

export function acharItem(codigo: string): ItemDoGuardaRoupa | undefined {
  return PORCODIGO.get(codigo);
}

/**
 * Esta pessoa pode VESTIR este item?
 *
 * `tem` é a lista de códigos que ela já ganhou (o inventário). Um código que o servidor não conhece é
 * recusado: é assim que um app adulterado não consegue vestir "moldura-de-administrador".
 *
 * Item livre não precisa de inventário nenhum — pedir que a pessoa "pegue" uma cor grátis antes de usar
 * seria burocracia sem função, e ainda quebraria quem já estava usando a cor antes de o guarda-roupa existir.
 */
export function podeVestir(codigo: string | null, tipo: TipoDeItem, tem: readonly string[]): boolean {
  if (codigo === null) return true;
  const item = PORCODIGO.get(codigo);
  if (!item || item.tipo !== tipo) return false;
  return item.comoSeGanha === 'livre' || tem.includes(codigo);
}
