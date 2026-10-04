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
  ko: ['KR', 'KP'],
  vi: ['VN'],
  ur: ['PK'],
  // Irã (persa) e Afeganistão (dari, que é persa em escrita árabe e é língua oficial do Estado).
  // O Tajiquistão NÃO entra: lá a língua oficial é o tadjique, escrito em cirílico e com código
  // próprio (tg) — mesma família, outro padrão e outro alfabeto.
  fa: ['IR', 'AF'],
  ja: ['JP'],
  te: ['IN'],
  // Sri Lanka e Singapura, onde é língua oficial do Estado, mais a Índia — pelo mesmo
  // critério do híndi e do télugo, que é contar o país onde a língua é oficial em algum nível.
  ta: ['LK', 'SG', 'IN'],
  // PRIMEIRO CASO EM QUE O IDIOMA NÃO É A LÍNGUA OFICIAL DO ESTADO EM NENHUM DOS DOIS PAÍSES, e
  // mesmo assim entra. Na Nigéria a Constituição de 1999 nomeia o hauçá no artigo 55, entre as
  // línguas em que a Assembleia Nacional trabalha; no Níger a lei o lista entre as línguas
  // nacionais, ao lado do francês, que é a oficial. Nos dois é status NACIONAL escrito em lei, não
  // regional — e é isso que o critério deste arquivo pede.
  //
  // A estimativa à mão em idiomas.ts dizia 1 país. Eram 2, e quem manda é esta lista.
  ha: ['NG', 'NE'],
  th: ['TH'],
  am: ['ET'],

  // O iorubá entra pelo MESMO artigo 55 da Constituição nigeriana que trouxe o hauçá: a frase nomeia
  // três línguas — hauçá, ibo e iorubá — como aquelas em que a Assembleia Nacional trabalha, ao lado
  // do inglês. É status nacional escrito em lei. Fora da Nigéria ele é muito falado no Benim e no
  // Togo, mas ali sem status oficial, e este arquivo pede status.
  yo: ['NG'],

  // Grécia e Chipre. No Chipre o grego divide o posto oficial com o turco, pela Constituição de
  // 1960 — a divisão da ilha não mudou o texto dela.
  el: ['GR', 'CY'],

  // Romênia e Moldávia. Na Moldávia a língua oficial é a MESMA, e o nome dela foi briga
  // constitucional: a Constituição dizia 'moldavo' até a corte constitucional decidir, em 2013, que
  // vale a Declaração de Independência, que diz 'romeno'. Em 2023 o texto foi corrigido por lei.
  ro: ['RO', 'MD'],

  // Só a Polônia. A língua tem status de minoria em partes da Lituânia, da Bielorrússia e da
  // Ucrânia, mas não de oficial do Estado, e este arquivo pede status.
  pl: ['PL'],

  // Mianmar. A Constituição de 2008 (art. 450) diz que a língua oficial é o birmanês.
  my: ['MM'],

  // Só a Ucrânia. A Constituição (art. 10) diz que a língua do Estado é o ucraniano.
  uk: ['UA'],

  // Israel. Desde a Lei Básica de 2018 o hebraico é a única língua do Estado; o árabe passou a ter
  // "status especial", que não é oficial — e por isso Israel não está na lista do árabe.
  he: ['IL'],

  // Etiópia. O oromo é língua de trabalho federal desde 2020, ao lado do amárico, do tigrínia, do
  // somali e do afar. A Etiópia já está na lista do amárico; um país pode ter mais de uma língua.
  om: ['ET'],

  // Azerbaijão. A Constituição (art. 21) diz que a língua do Estado é o azerbaijano.
  az: ['AZ'],

  // Uzbequistão. A Constituição (art. 4) diz que a língua do Estado é o uzbeque. No Afeganistão ele é
  // língua regional (Constituição de 2004, art. 16), e regional não faz o país inteiro falar.
  uz: ['UZ'],

  // Nepal. A Constituição de 2015 (art. 6 e 7) faz do nepalês em devanágari a língua oficial. Na Índia
  // ele está na 8ª Lista e é oficial em Sikkim — língua de estado, que não faz o país inteiro falar.
  ne: ['NP'],

  // Laos. A Constituição (art. 89) faz da língua e da escrita lao as oficiais. Na Tailândia o isan é
  // parente próximo e se escreve em letra tailandesa: não é o laosiano.
  lo: ['LA'],

  // África do Sul. A Constituição (art. 6) lista onze línguas oficiais, o zulu entre elas — e é a
  // língua materna mais falada do país.
  zu: ['ZA'],

  // Madagascar. A Constituição de 2010 (art. 4) faz do malgaxe a língua nacional, e oficial ao lado do
  // francês.
  mg: ['MG'],

  // Somália. A Constituição provisória de 2012 (art. 5) faz do somali a língua oficial, ao lado do árabe.
  // Na Etiópia, no Djibuti e no Quênia ele é língua regional, que não faz o país inteiro falar.
  so: ['SO'],

  // África do Sul (art. 6 da Constituição, entre as onze oficiais). Na Namíbia o africâner é língua
  // nacional reconhecida, mas a única oficial é o inglês (art. 3).
  af: ['ZA'],

  // Sri Lanka. A Constituição (art. 18) faz do cingalês e do tâmil as línguas oficiais.
  si: ['LK'],

  // Camboja. A Constituição (art. 5) faz do khmer a língua e a escrita oficiais.
  km: ['KH'],

  // Cazaquistão. A Constituição (art. 7) faz do cazaque a língua do Estado; o russo é usado
  // oficialmente ao lado dele, e já está na lista do russo.
  kk: ['KZ'],

  // Suécia (Lei da Língua de 2009, §4: o sueco é a língua principal) e Finlândia, onde a Constituição
  // (§17) faz do finlandês e do sueco as duas línguas nacionais.
  sv: ['SE', 'FI'],

  // Hungria. A Lei Fundamental de 2011 (art. H) faz do húngaro a língua oficial.
  hu: ['HU'],

  // Sérvia (Constituição, art. 10: a língua sérvia e a escrita cirílica) e Bósnia e Herzegovina, onde o
  // sérvio é oficial ao lado do bósnio e do croata. No Montenegro ele é "de uso oficial", não oficial.
  sr: ['RS', 'BA'],

  // Tchéquia. A língua oficial é o tcheco (Lei de Procedimento Administrativo, §16; a Constituição não
  // a nomeia, mas toda a legislação a pressupõe).
  cs: ['CZ'],

  // Bulgária. A Constituição (art. 3) faz do búlgaro a língua oficial.
  bg: ['BG'],

  // Albânia (Constituição, art. 14) e Macedônia do Norte, onde a Lei das Línguas de 2019 faz do albanês
  // língua oficial em todo o país, ao lado do macedônio. Kosovo não é membro da ONU.
  sq: ['AL', 'MK'],

  // Croácia. A Constituição (art. 13) faz do croata e da escrita latina os oficiais. Na Bósnia e
  // Herzegovina ele também é oficial, mas a lista de idiomas.ts conta um país só para o croata.
  hr: ['HR'],

  // Dinamarca. Nenhuma lei declara o dinamarquês oficial — ele é a língua do Estado de fato. Também vale nas
  // Ilhas Faroé e na Groenlândia, ao lado da língua local, mas elas não são países da ONU.
  da: ['DK'],

  // Eslováquia. A Constituição (art. 6) e a lei da língua do Estado (270/1995) fazem do eslovaco o oficial.
  sk: ['SK'],

  // Finlândia. A Constituição (seção 17) faz do finlandês e do sueco as línguas nacionais; o sueco já
  // conta a Finlândia no sv.
  fi: ['FI'],

  // Noruega. A lei da língua (språkloven, 2021) faz do norueguês — bokmål e nynorsk — a língua principal do país.
  no: ['NO'],

  // Eslovênia. A Constituição (art. 11) faz do esloveno a língua oficial.
  sl: ['SI'],

  // Lituânia. A Constituição (art. 14) faz do lituano a língua do Estado.
  lt: ['LT'],

  // Macedônia do Norte. A Constituição (art. 7) faz do macedônio, em alfabeto cirílico, a língua oficial.
  mk: ['MK'],
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
  ko: 82,
  vi: 85,
  ur: 230,
  fa: 130,
  ja: 125,
  te: 95,
  ta: 85,

  // ---------------------------------------------------------------------------------------------------
  // DAQUI PARA BAIXO SÃO OS QUE AINDA NÃO TÊM DICIONÁRIO, e eles estão aqui por um motivo só: é este
  // número que ordena a FILA de tradução (scripts/fila-de-idiomas.mjs). Ordenar por número de países
  // punha o albanês (7 milhões de falantes, 2 países) na frente do urdu (230 milhões, 1 país), e a
  // pergunta que a fila responde não é "onde é oficial" — é "quanta gente passa a poder usar o Syden
  // na língua dela".
  //
  // NÃO APARECEM NA TELA. A grade de países só é desenhada para idioma que tem lista em OFICIAL, e
  // estes não têm. Moram aqui, e não no script, porque este é o lugar onde o projeto guarda "quantas
  // pessoas falam cada idioma" — guardar metade num arquivo e metade noutro é como as duas listas
  // começam a discordar.
  //
  // Valores redondos, pelas mesmas razões escritas acima: estimativa com casa decimal é mentira com
  // aparência de medição.
  // ---------------------------------------------------------------------------------------------------
  ha: 80,
  th: 70,
  am: 57,
  yo: 47,
  om: 37,
  ig: 31,
  ff: 35,
  bm: 15,
  pl: 45,
  my: 43,
  uk: 40,
  az: 35,
  uz: 35,
  ne: 32,
  lo: 30,
  zu: 28,
  mg: 25,
  ro: 25,
  so: 25,
  si: 17,
  af: 17,
  km: 17,
  kk: 16,
  rw: 15,
  el: 13,
  hu: 13,
  sv: 13,
  ht: 12,
  sr: 12,
  cs: 11,
  he: 9,
  bg: 8,
  hr: 7,
  sq: 7,
  da: 6,
  hy: 6,
  mn: 6,
  fi: 5,
  no: 5,
  sk: 5,
  ka: 4,
  lt: 3,
  mk: 3,
  sl: 3,
  ga: 2,
  lv: 2,
  dv: 1,
  et: 1,
  fj: 1,
  is: 1,
  mt: 1,
  sm: 1,
  tet: 1,
  to: 1,
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

