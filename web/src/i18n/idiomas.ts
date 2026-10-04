// Os idiomas do Syden.
//
// A pergunta que originou este arquivo foi "quantos idiomas eu preciso para atender todos os países da
// ONU?". A resposta curta: não existe um número mágico, porque há mais de 190 países e muitos deles têm
// vários idiomas oficiais — mas a conta fica pequena rápido. Com INGLÊS, FRANCÊS, ÁRABE, ESPANHOL e
// PORTUGUÊS já se cobre um idioma oficial de mais de 130 países. O resto da lista abaixo é o que falta
// para chegar perto de todos, em ordem de quanto cada um acrescenta.
//
// Nem todos estão traduzidos, e tudo bem: o que não tem tradução aparece em português (ver i18n/index).
// Acrescentar um idioma é escrever um arquivo de dicionário e apontar aqui em TRADUCOES — nada mais.
import { cobertosPor } from './paises';

/** A escrita decide a fonte de reserva (as letras de cada uma vêm de uma família Noto diferente). */
export type Escrita =
  | 'latina'
  | 'cirilica'
  | 'grega'
  | 'arabe'
  | 'hebraica'
  | 'devanagari'
  | 'bengali'
  | 'tamil'
  | 'telugu'
  | 'sinhala'
  | 'tailandesa'
  | 'khmer'
  | 'lao'
  | 'birmanesa'
  | 'chinesa'
  | 'japonesa'
  | 'coreana'
  | 'etiope'
  | 'georgiana'
  | 'armenia'
  | 'thaana';

/**
 * A família do Google que desenha cada escrita. A fonte do Syden desenha o alfabeto latino; para o resto
 * do mundo, entra a Noto — que existe justamente para não deixar ninguém vendo quadradinhos.
 */
export const FONTE_DA_ESCRITA: Record<Escrita, string> = {
  latina: 'Noto Sans',
  cirilica: 'Noto Sans',
  grega: 'Noto Sans',
  arabe: 'Noto Sans Arabic',
  hebraica: 'Noto Sans Hebrew',
  devanagari: 'Noto Sans Devanagari',
  bengali: 'Noto Sans Bengali',
  tamil: 'Noto Sans Tamil',
  telugu: 'Noto Sans Telugu',
  sinhala: 'Noto Sans Sinhala',
  tailandesa: 'Noto Sans Thai',
  khmer: 'Noto Sans Khmer',
  lao: 'Noto Sans Lao',
  birmanesa: 'Noto Sans Myanmar',
  chinesa: 'Noto Sans SC',
  japonesa: 'Noto Sans JP',
  coreana: 'Noto Sans KR',
  etiope: 'Noto Sans Ethiopic',
  georgiana: 'Noto Sans Georgian',
  armenia: 'Noto Sans Armenian',
  thaana: 'Noto Sans Thaana',
};

export interface Idioma {
  /** Código do idioma, como o navegador usa: "pt-BR", "en", "ar". */
  codigo: string;
  /** O nome do idioma NA PRÓPRIA LÍNGUA: é assim que a pessoa reconhece o dela na lista. */
  nativo: string;
  /** O nome em português, para as listas nossas. */
  nome: string;
  escrita: Escrita;
  /** Escrito da direita para a esquerda. */
  rtl?: boolean;
  /** Em quantos países da ONU ele é idioma oficial — é o que dá a ordem desta lista. */
  paises: number;
}

/**
 * A lista, da maior cobertura para a menor. Os cinco primeiros já alcançam a maioria do planeta; daí
 * para baixo é ir fechando as lacunas país a país.
 */
export const IDIOMAS: Idioma[] = [
  { codigo: 'pt-BR', nativo: 'Português (Brasil)', nome: 'Português (Brasil)', escrita: 'latina', paises: 9 },
  // 58, e não 57: o número era estimativa escrita à mão, e a lista de países em paises.ts o corrigiu.
  // A diferença mora na Oceania, onde os catorze membros da ONU têm o inglês como oficial ou como
  // língua de fato do governo — Nauru e Tonga escapavam da conta antiga.
  { codigo: 'en', nativo: 'English', nome: 'Inglês', escrita: 'latina', paises: 58 },
  { codigo: 'fr', nativo: 'Français', nome: 'Francês', escrita: 'latina', paises: 29 },
  // 23, e não 24: Israel tirou o árabe da condição de idioma oficial em 2018 (virou "status especial"),
  // e a Palestina não é membro da ONU — que é o conjunto que a grade conta.
  { codigo: 'ar', nativo: 'العربية', nome: 'Árabe', escrita: 'arabe', rtl: true, paises: 23 },
  { codigo: 'es', nativo: 'Español', nome: 'Espanhol', escrita: 'latina', paises: 20 },
  { codigo: 'de', nativo: 'Deutsch', nome: 'Alemão', escrita: 'latina', paises: 6 },
  { codigo: 'ru', nativo: 'Русский', nome: 'Russo', escrita: 'cirilica', paises: 4 },
  { codigo: 'sw', nativo: 'Kiswahili', nome: 'Suaíli', escrita: 'latina', paises: 4 },
  { codigo: 'it', nativo: 'Italiano', nome: 'Italiano', escrita: 'latina', paises: 3 },
  { codigo: 'nl', nativo: 'Nederlands', nome: 'Neerlandês', escrita: 'latina', paises: 3 },
  { codigo: 'ms', nativo: 'Bahasa Melayu', nome: 'Malaio', escrita: 'latina', paises: 3 },
  { codigo: 'zh-CN', nativo: '简体中文', nome: 'Chinês (simplificado)', escrita: 'chinesa', paises: 2 },
  { codigo: 'tr', nativo: 'Türkçe', nome: 'Turco', escrita: 'latina', paises: 2 },
  { codigo: 'el', nativo: 'Ελληνικά', nome: 'Grego', escrita: 'grega', paises: 2 },
  { codigo: 'ro', nativo: 'Română', nome: 'Romeno', escrita: 'latina', paises: 2 },
  { codigo: 'ko', nativo: '한국어', nome: 'Coreano', escrita: 'coreana', paises: 2 },
  { codigo: 'fa', nativo: 'فارسی', nome: 'Persa', escrita: 'arabe', rtl: true, paises: 2 },
  { codigo: 'sr', nativo: 'Српски', nome: 'Sérvio', escrita: 'cirilica', paises: 2 },
  { codigo: 'id', nativo: 'Bahasa Indonesia', nome: 'Indonésio', escrita: 'latina', paises: 1 },
  { codigo: 'hi', nativo: 'हिन्दी', nome: 'Híndi', escrita: 'devanagari', paises: 1 },
  { codigo: 'bn', nativo: 'বাংলা', nome: 'Bengali', escrita: 'bengali', paises: 1 },
  { codigo: 'ur', nativo: 'اردو', nome: 'Urdu', escrita: 'arabe', rtl: true, paises: 1 },
  { codigo: 'ja', nativo: '日本語', nome: 'Japonês', escrita: 'japonesa', paises: 1 },
  { codigo: 'vi', nativo: 'Tiếng Việt', nome: 'Vietnamita', escrita: 'latina', paises: 1 },
  { codigo: 'th', nativo: 'ไทย', nome: 'Tailandês', escrita: 'tailandesa', paises: 1 },
  { codigo: 'pl', nativo: 'Polski', nome: 'Polonês', escrita: 'latina', paises: 1 },
  { codigo: 'uk', nativo: 'Українська', nome: 'Ucraniano', escrita: 'cirilica', paises: 1 },
  { codigo: 'he', nativo: 'עברית', nome: 'Hebraico', escrita: 'hebraica', rtl: true, paises: 1 },
  { codigo: 'sv', nativo: 'Svenska', nome: 'Sueco', escrita: 'latina', paises: 2 },
  { codigo: 'no', nativo: 'Norsk', nome: 'Norueguês', escrita: 'latina', paises: 1 },
  { codigo: 'da', nativo: 'Dansk', nome: 'Dinamarquês', escrita: 'latina', paises: 1 },
  { codigo: 'fi', nativo: 'Suomi', nome: 'Finlandês', escrita: 'latina', paises: 1 },
  { codigo: 'cs', nativo: 'Čeština', nome: 'Tcheco', escrita: 'latina', paises: 1 },
  { codigo: 'sk', nativo: 'Slovenčina', nome: 'Eslovaco', escrita: 'latina', paises: 1 },
  { codigo: 'hu', nativo: 'Magyar', nome: 'Húngaro', escrita: 'latina', paises: 1 },
  { codigo: 'bg', nativo: 'Български', nome: 'Búlgaro', escrita: 'cirilica', paises: 1 },
  { codigo: 'hr', nativo: 'Hrvatski', nome: 'Croata', escrita: 'latina', paises: 1 },
  { codigo: 'sl', nativo: 'Slovenščina', nome: 'Esloveno', escrita: 'latina', paises: 1 },
  { codigo: 'sq', nativo: 'Shqip', nome: 'Albanês', escrita: 'latina', paises: 2 },
  { codigo: 'mk', nativo: 'Македонски', nome: 'Macedônio', escrita: 'cirilica', paises: 1 },
  { codigo: 'lt', nativo: 'Lietuvių', nome: 'Lituano', escrita: 'latina', paises: 1 },
  { codigo: 'lv', nativo: 'Latviešu', nome: 'Letão', escrita: 'latina', paises: 1 },
  { codigo: 'et', nativo: 'Eesti', nome: 'Estoniano', escrita: 'latina', paises: 1 },
  { codigo: 'is', nativo: 'Íslenska', nome: 'Islandês', escrita: 'latina', paises: 1 },
  { codigo: 'ga', nativo: 'Gaeilge', nome: 'Irlandês', escrita: 'latina', paises: 1 },
  { codigo: 'mt', nativo: 'Malti', nome: 'Maltês', escrita: 'latina', paises: 1 },
  { codigo: 'ka', nativo: 'ქართული', nome: 'Georgiano', escrita: 'georgiana', paises: 1 },
  { codigo: 'hy', nativo: 'Հայերեն', nome: 'Armênio', escrita: 'armenia', paises: 1 },
  { codigo: 'az', nativo: 'Azərbaycan', nome: 'Azerbaijano', escrita: 'latina', paises: 1 },
  { codigo: 'kk', nativo: 'Қазақша', nome: 'Cazaque', escrita: 'cirilica', paises: 1 },
  { codigo: 'uz', nativo: 'Oʻzbek', nome: 'Uzbeque', escrita: 'latina', paises: 1 },
  { codigo: 'mn', nativo: 'Монгол', nome: 'Mongol', escrita: 'cirilica', paises: 1 },
  { codigo: 'ne', nativo: 'नेपाली', nome: 'Nepalês', escrita: 'devanagari', paises: 1 },
  { codigo: 'si', nativo: 'සිංහල', nome: 'Cingalês', escrita: 'sinhala', paises: 1 },
  { codigo: 'ta', nativo: 'தமிழ்', nome: 'Tâmil', escrita: 'tamil', paises: 3 },
  { codigo: 'te', nativo: 'తెలుగు', nome: 'Télugo', escrita: 'telugu', paises: 1 },
  { codigo: 'km', nativo: 'ភាសាខ្មែរ', nome: 'Khmer', escrita: 'khmer', paises: 1 },
  { codigo: 'lo', nativo: 'ລາວ', nome: 'Laosiano', escrita: 'lao', paises: 1 },
  { codigo: 'my', nativo: 'မြန်မာ', nome: 'Birmanês', escrita: 'birmanesa', paises: 1 },
  { codigo: 'dv', nativo: 'ދިވެހި', nome: 'Divehi', escrita: 'thaana', rtl: true, paises: 1 },
  { codigo: 'am', nativo: 'አማርኛ', nome: 'Amárico', escrita: 'etiope', paises: 1 },
  // ---------------------------------------------------------------------------------------------
  // AS TRÊS QUE FALTAVAM, e a falta era INCOERÊNCIA NOSSA, não critério.
  //
  // O hauçá entrou nesta lista porque a Constituição da Nigéria de 1999 o nomeia no artigo 55. Só
  // que esse artigo nomeia TRÊS línguas na mesma frase — hauçá, ibo e iorubá — e só uma delas estava
  // aqui. O oromo é o caso irmão: a Etiópia o tornou língua de trabalho do governo federal em 2020,
  // ao lado do amárico, que já estava na lista.
  //
  // Nenhuma das três é a língua oficial do Estado em lugar nenhum. Nem o hauçá é, e isso não o
  // impediu de entrar: o critério deste arquivo é alcance, e são 110 milhões de pessoas somadas.
  // ---------------------------------------------------------------------------------------------
  { codigo: 'yo', nativo: 'Yorùbá', nome: 'Iorubá', escrita: 'latina', paises: 1 },
  { codigo: 'om', nativo: 'Afaan Oromoo', nome: 'Oromo', escrita: 'latina', paises: 1 },
  { codigo: 'ig', nativo: 'Igbo', nome: 'Ibo', escrita: 'latina', paises: 1 },
  // O FULA É UMA LÍNGUA SÓ COM MUITOS NOMES — pulaar no Senegal, pular na Guiné, fulfulde no Mali e
  // na Nigéria. São variedades da mesma, e o código ISO é um só: ff. Escreve-se em latino com os
  // MESMOS ganchos do hauçá (ɓ ɗ ŋ ƴ), então a fonte e o teste de escrita já estão prontos.
  { codigo: 'ff', nativo: 'Pulaar', nome: 'Fula', escrita: 'latina', paises: 4 },
  // "MANDINGA" NÃO É UMA LÍNGUA, É UM GRUPO (bambara, malinquê, dioula, mandinga), e por isso não
  // tem código próprio. Quem entra é o BAMBARA, que é o de mais falantes e o que o Mali reconhece em
  // lei — traduzir "mandinga" seria escolher uma das quatro sem dizer qual.
  { codigo: 'bm', nativo: 'Bamanankan', nome: 'Bambara', escrita: 'latina', paises: 1 },
  { codigo: 'so', nativo: 'Soomaali', nome: 'Somali', escrita: 'latina', paises: 1 },
  { codigo: 'ha', nativo: 'Hausa', nome: 'Hauçá', escrita: 'latina', paises: 2 },
  { codigo: 'rw', nativo: 'Kinyarwanda', nome: 'Quiniaruanda', escrita: 'latina', paises: 1 },
  { codigo: 'mg', nativo: 'Malagasy', nome: 'Malgaxe', escrita: 'latina', paises: 1 },
  { codigo: 'af', nativo: 'Afrikaans', nome: 'Africâner', escrita: 'latina', paises: 1 },
  { codigo: 'zu', nativo: 'isiZulu', nome: 'Zulu', escrita: 'latina', paises: 1 },
  { codigo: 'ht', nativo: 'Kreyòl ayisyen', nome: 'Crioulo haitiano', escrita: 'latina', paises: 1 },
  { codigo: 'sm', nativo: 'Gagana Sāmoa', nome: 'Samoano', escrita: 'latina', paises: 1 },
  { codigo: 'fj', nativo: 'Na Vosa Vakaviti', nome: 'Fijiano', escrita: 'latina', paises: 1 },
  { codigo: 'to', nativo: 'Lea faka-Tonga', nome: 'Tonganês', escrita: 'latina', paises: 1 },
  { codigo: 'tet', nativo: 'Tetun', nome: 'Tétum', escrita: 'latina', paises: 1 },
];

export const PADRAO = 'pt-BR';

/**
 * Os dicionários que existem hoje. Cada um é carregado só quando a pessoa escolhe aquele idioma — nada
 * de mandar setenta traduções para quem vai usar uma.
 */
export const TRADUCOES: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import('./en'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  ar: () => import('./ar'),
  de: () => import('./de'),
  ru: () => import('./ru'),
  sw: () => import('./sw'),
  it: () => import('./it'),
  nl: () => import('./nl'),
  ms: () => import('./ms'),
  'zh-CN': () => import('./zh-CN'),
  tr: () => import('./tr'),
  id: () => import('./id'),
  hi: () => import('./hi'),
  bn: () => import('./bn'),
  ko: () => import('./ko'),
  vi: () => import('./vi'),
  ur: () => import('./ur'),
  fa: () => import('./fa'),
  ja: () => import('./ja'),
  te: () => import('./te'),
  ta: () => import('./ta'),
  ha: () => import('./ha'),
  th: () => import('./th'),
  am: () => import('./am'),
  yo: () => import('./yo'),
  el: () => import('./el'),
  ro: () => import('./ro'),
  pl: () => import('./pl'),
  my: () => import('./my'),
  uk: () => import('./uk'),
  he: () => import('./he'),
  om: () => import('./om'),
  az: () => import('./az'),
  uz: () => import('./uz'),
  ne: () => import('./ne'),
  lo: () => import('./lo'),
  zu: () => import('./zu'),
  mg: () => import('./mg'),
  so: () => import('./so'),
  af: () => import('./af'),
  si: () => import('./si'),
  km: () => import('./km'),
  kk: () => import('./kk'),
  sv: () => import('./sv'),
  hu: () => import('./hu'),
};

export const idiomaPorCodigo = (codigo: string) => IDIOMAS.find((i) => i.codigo === codigo);

/**
 * Quantos países da ONU o Syden já alcança com os idiomas traduzidos.
 *
 * ERA UMA SOMA, E ESTAVA ERRADO. Somar os números de cada idioma conta o mesmo país várias vezes: a
 * Suíça fala alemão, francês e italiano; Ruanda fala inglês, francês e suaíli; a Bélgica, francês,
 * alemão e neerlandês. Com nove idiomas a soma dava 159 e a verdade é menor — e esse número aparece
 * na tela, para qualquer pessoa, como afirmação do alcance do Syden.
 *
 * Agora é a UNIÃO das listas de países (ver paises.ts), que é a conta certa e não tem como inflar.
 */
export function paisesCobertos(): number {
  return cobertosPor([PADRAO, ...Object.keys(TRADUCOES)]);
}
