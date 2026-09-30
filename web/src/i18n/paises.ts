/**
 * Onde cada idioma do Syden é oficial, e o mundo inteiro como pano de fundo.
 *
 * ---------------------------------------------------------------------------------------------------
 * POR QUE OS 193 MEMBROS DA ONU, e não "os países do mundo".
 *
 * "País" não é um conjunto com borda definida: Taiwan, Palestina, Kosovo e Saara Ocidental entram ou
 * saem conforme quem conta. Qualquer lista que a gente inventasse seria uma opinião nossa, publicada
 * numa loja de aplicativos em dezenas de países.
 *
 * Os membros da ONU são um conjunto OBJETIVO e citável: ou o país está na Assembleia Geral, ou não
 * está. A grade não desenha território nem fronteira — ela conta cadeiras. É o que permite mostrar o
 * alcance de um idioma sem tomar posição sobre Caxemira, Crimeia ou Saara Ocidental, que foi
 * exatamente o que fez a gente desistir do mapa-múndi (ver imagem/Sugestao/alternativas-ao-mapa.png).
 *
 * O AGRUPAMENTO é o geoscheme da própria ONU: África 54, Américas 35, Ásia 47, Europa 43, Oceania 14.
 * Soma 193, e o teste confere isso — se alguém mexer numa lista, a conta acusa na hora.
 * ---------------------------------------------------------------------------------------------------
 *
 * OS NOMES DOS PAÍSES NÃO ESTÃO AQUI, DE PROPÓSITO. Eles saem do `Intl.DisplayNames` do navegador, que
 * já sabe dizer "Brasil", "Brazil", "البرازيل" e "Brasilien". Traduzi-los à mão seriam 193 nomes vezes
 * cada idioma — quase dois mil textos para manter, quando o navegador faz de graça e melhor.
 */

export type Regiao = 'africa' | 'americas' | 'asia' | 'europa' | 'oceania';

/** A ordem em que as regiões aparecem na tela: da que tem mais países para a que tem menos. */
/**
 * O CÓDIGO M49 de cada região, que é como a ONU as numera. Fica guardado por ser o identificador
 * oficial — mas NÃO serve para mostrar o nome na tela, e isso custou uma medição.
 *
 * No Node, `new Intl.DisplayNames(['ar'], { type: 'region' }).of('002')` devolve "أفريقيا". NO
 * NAVEGADOR, NÃO: o Chrome só conhece códigos de duas letras (BR, TZ) e devolve o próprio "002" para
 * os numéricos. A tela ficou com "002 · 23/54" escrito nela, em todos os idiomas, e só apareceu
 * quando alguém abriu a página de verdade — o Node tem ICU completo e o teste passou feliz.
 *
 * Por isso os nomes das cinco regiões são tradução normal — e eles NÃO MORAM AQUI, moram em
 * GradeDePaises.tsx. O motivo é a ferramenta: scripts/lib/textos-cravados.mjs pula a pasta i18n
 * inteira, para não acusar os dicionários (onde o português É a chave). Um chave() escrito aqui
 * dentro é invisível para a contagem, e o idioma novo nasceria com esses cinco textos faltando sem
 * ninguém ser avisado.
 */
export const REGIOES: { id: Regiao; m49: string; paises: string[] }[] = [
  {
    id: 'africa',
    m49: '002',
    paises: [
      'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET',
      'GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW',
      'ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW',
    ],
  },
  {
    id: 'asia',
    m49: '142',
    paises: [
      'AF','AM','AZ','BH','BD','BT','BN','KH','CN','CY','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW',
      'KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PH','QA','SA','SG','KR','LK','SY','TJ','TH',
      'TL','TR','TM','AE','UZ','VN','YE',
    ],
  },
  {
    id: 'europa',
    m49: '150',
    paises: [
      'AL','AD','AT','BY','BE','BA','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV',
      'LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE',
      'CH','UA','GB',
    ],
  },
  {
    id: 'americas',
    m49: '019',
    paises: [
      'AG','AR','BS','BB','BZ','BO','BR','CA','CL','CO','CR','CU','DM','DO','EC','SV','GD','GT','GY','HT',
      'HN','JM','MX','NI','PA','PY','PE','KN','LC','VC','SR','TT','US','UY','VE',
    ],
  },
  {
    id: 'oceania',
    m49: '009',
    paises: ['AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU'],
  },
];

/**
 * Onde cada idioma é oficial.
 *
 * O CRITÉRIO, escrito porque ele decide casos difíceis e porque alguém vai perguntar: entra o país em
 * que o idioma é oficial POR LEI, mais aquele em que ele é a língua de fato do governo nacional sem
 * estar escrita em lugar nenhum. É o segundo caso que põe Estados Unidos e Austrália no inglês — os
 * dois não têm idioma oficial no nível federal, e fingir que o inglês não os alcança seria absurdo.
 *
 * Fora ficam os idiomas oficiais só de uma região dentro do país (o suaíli no Congo, o italiano na
 * Croácia): a grade conta países, e um idioma regional não faz o país inteiro falar.
 *
 * SÓ EXISTEM AQUI OS IDIOMAS JÁ TRADUZIDOS. Os outros 63 do idiomas.ts continuam com a estimativa
 * escrita à mão, que basta para ordenar a lista. Quando um deles for traduzido, ganha a lista aqui — e
 * o teste exige que ela bata com o número.
 */
export const OFICIAL: Record<string, string[]> = {
  'pt-BR': ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
  en: [
    // África (23)
    'BW','CM','SZ','ER','GH','GM','KE','LS','LR','MW','MU','NA','NG','RW','SC','SL','ZA','SS','SD','TZ','UG','ZM','ZW',
    // Américas (14)
    'AG','BS','BB','BZ','CA','DM','GD','GY','JM','KN','LC','VC','TT','US',
    // Ásia (4)
    'IN','PK','PH','SG',
    // Europa (3)
    'IE','MT','GB',
    // Oceania (14)
    'AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU',
  ],
  fr: [
    'BJ','BF','BI','CM','CF','TD','KM','CG','CD','CI','DJ','GQ','GA','GN','MG','ML','NE','RW','SN','SC','TG',
    'BE','FR','LU','MC','CH',
    'CA','HT',
    'VU',
  ],
  ar: [
    'DZ','TD','KM','DJ','EG','ER','LY','MR','MA','SO','SD','TN',
    'BH','IQ','JO','KW','LB','OM','QA','SA','SY','AE','YE',
  ],
  es: ['AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','GT','HN','MX','NI','PA','PY','PE','ES','UY','VE'],
  de: ['AT', 'BE', 'DE', 'LI', 'LU', 'CH'],
  ru: ['BY', 'KZ', 'KG', 'RU'],
  sw: ['KE', 'TZ', 'UG', 'RW'],
  it: ['IT', 'SM', 'CH'],
  nl: ['BE', 'NL', 'SR'],
  ms: ['MY', 'BN', 'SG'],
  'zh-CN': ['CN', 'SG'],
  tr: ['TR', 'CY'],
  id: ['ID'],
  hi: ['IN'],
  bn: ['BD'],
};

/**
 * Quantas pessoas falam cada idioma, em MILHÕES — somando quem o tem como língua materna e quem o
 * aprendeu depois.
 *
 * ---------------------------------------------------------------------------------------------------
 * ESTES NÚMEROS SÃO APROXIMADOS, E A TELA PRECISA DIZER ISSO.
 *
 * Não existe contagem exata de falantes de língua nenhuma. Ninguém entrevista o planeta: o que há são
 * estimativas de censos nacionais (que perguntam de jeitos diferentes), do Ethnologue e da Britannica,
 * e elas DISCORDAM entre si em dezenas de milhões. O inglês aparece como 1,1 bilhão ou 1,5 bilhão
 * conforme quem conta e conforme o que se aceita como "falar inglês".
 *
 * A maior parte da diferença está em quem aprendeu depois: falante nativo se conta por censo, falante
 * de segunda língua se estima por escolaridade. O inglês tem quatro vezes mais gente na segunda
 * coluna do que na primeira — ou seja, o número dele é quase todo estimativa.
 *
 * POR ISSO OS VALORES SÃO REDONDOS. 1500, e não 1456: fingir precisão em cima de estimativa é mentir
 * com casa decimal, e a tela do Syden não afirma o que não sabe. A curiosidade continua boa; o que
 * não pode é ela se passar por medição.
 *
 * Ordem de grandeza conferida contra as fontes públicas usuais, em 2026.
 * ---------------------------------------------------------------------------------------------------
 */
export const FALANTES_EM_MILHOES: Record<string, number> = {
  en: 1500,
  'zh-CN': 1200,
  es: 560,
  ar: 420,
  'pt-BR': 260,
  ru: 250,
  fr: 310,
  de: 130,
  sw: 200,
  it: 65,
  nl: 25,
  ms: 300,
  tr: 90,
  id: 200,
  hi: 600,
  bn: 280,
};

/** Quantos falantes tem este idioma, em milhões. Zero quando ainda não estimamos. */
export function falantesDoIdioma(codigo: string): number {
  return FALANTES_EM_MILHOES[codigo] ?? 0;
}

/** Todos os 193, numa lista só. */
export const TODOS_OS_PAISES: string[] = REGIOES.flatMap((r) => r.paises);

/** Onde este idioma é oficial. Idioma sem lista devolve vazio — a grade simplesmente não aparece. */
export function paisesDoIdioma(codigo: string): string[] {
  return OFICIAL[codigo] ?? [];
}

/**
 * Quantos países cada região tem, e quantos deles falam este idioma. É o que a grade desenha.
 */
export function porRegiao(codigo: string): { id: Regiao; m49: string; paises: string[]; marcados: Set<string> }[] {
  const doIdioma = new Set(paisesDoIdioma(codigo));
  return REGIOES.map((r) => ({
    ...r,
    marcados: new Set(r.paises.filter((p) => doIdioma.has(p))),
  }));
}

/**
 * Quantos países da ONU o Syden alcança somando os idiomas que recebe.
 *
 * É UMA UNIÃO, e não uma soma — e a diferença é grande. Suíça fala alemão, francês e italiano;
 * Ruanda fala inglês, francês e suaíli. Somar as listas contaria os mesmos países várias vezes e
 * daria um número inflado, que é o tipo de número que a gente não publica.
 */
export function cobertosPor(codigos: string[]): number {
  const juntos = new Set<string>();
  for (const codigo of codigos) for (const pais of paisesDoIdioma(codigo)) juntos.add(pais);
  return juntos.size;
}

/**
 * O nome do país na língua de quem está lendo, pelo navegador.
 *
 * Cai no próprio código (`BR`) quando o navegador não souber — melhor um código do que um buraco, e
 * ninguém fica sem saber o que é o quadradinho.
 */
export function nomeDoPais(pais: string, idioma: string): string {
  try {
    return new Intl.DisplayNames([idioma], { type: 'region' }).of(pais) ?? pais;
  } catch {
    return pais;
  }
}

