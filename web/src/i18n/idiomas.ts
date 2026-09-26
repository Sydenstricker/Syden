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
  { codigo: 'en', nativo: 'English', nome: 'Inglês', escrita: 'latina', paises: 57 },
  { codigo: 'fr', nativo: 'Français', nome: 'Francês', escrita: 'latina', paises: 29 },
  { codigo: 'ar', nativo: 'العربية', nome: 'Árabe', escrita: 'arabe', rtl: true, paises: 24 },
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
  { codigo: 'uz', nativo: "O'zbek", nome: 'Uzbeque', escrita: 'latina', paises: 1 },
  { codigo: 'mn', nativo: 'Монгол', nome: 'Mongol', escrita: 'cirilica', paises: 1 },
  { codigo: 'ne', nativo: 'नेपाली', nome: 'Nepalês', escrita: 'devanagari', paises: 1 },
  { codigo: 'si', nativo: 'සිංහල', nome: 'Cingalês', escrita: 'sinhala', paises: 1 },
  { codigo: 'ta', nativo: 'தமிழ்', nome: 'Tâmil', escrita: 'tamil', paises: 2 },
  { codigo: 'te', nativo: 'తెలుగు', nome: 'Télugo', escrita: 'telugu', paises: 1 },
  { codigo: 'km', nativo: 'ភាសាខ្មែរ', nome: 'Khmer', escrita: 'khmer', paises: 1 },
  { codigo: 'lo', nativo: 'ລາວ', nome: 'Laosiano', escrita: 'lao', paises: 1 },
  { codigo: 'my', nativo: 'မြန်မာ', nome: 'Birmanês', escrita: 'birmanesa', paises: 1 },
  { codigo: 'dv', nativo: 'ދިވެހި', nome: 'Divehi', escrita: 'thaana', rtl: true, paises: 1 },
  { codigo: 'am', nativo: 'አማርኛ', nome: 'Amárico', escrita: 'etiope', paises: 1 },
  { codigo: 'so', nativo: 'Soomaali', nome: 'Somali', escrita: 'latina', paises: 1 },
  { codigo: 'ha', nativo: 'Hausa', nome: 'Hauçá', escrita: 'latina', paises: 1 },
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
};

export const idiomaPorCodigo = (codigo: string) => IDIOMAS.find((i) => i.codigo === codigo);

/** Quantos países da ONU já estão cobertos pelos idiomas traduzidos (conta para a tela de configurações). */
export function paisesCobertos(): number {
  const prontos = [PADRAO, ...Object.keys(TRADUCOES)];
  return IDIOMAS.filter((i) => prontos.includes(i.codigo)).reduce((soma, i) => soma + i.paises, 0);
}
