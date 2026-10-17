import { primeiraForma } from './minijogos';

/**
 * OS NOMES DO QUE SE PÕE NO QUARTO E NO SALÃO (16/10/2026, decisão dele: "nomes traduzidos nos 80"). O catálogo do Editar
 * tem busca e dica ao passar o mouse, e para isso cada móvel, objeto da parede, objeto de cima, janela e cor de tapete
 * precisa de um nome na língua de quem lê. A página da cena só conhece os códigos ("planta-baixa", "poster"); o nome
 * mora aqui, cada um numa chave t() própria (é por ela que a tradução acha o texto).
 *
 * Alguns nomes já existiam no dicionário com variantes ("Sofa|Couch", do jogo de desenhar): mostra-se a primeira, e a
 * busca acha por qualquer uma.
 */
type T = (texto: string) => string;
export type GrupoDaCena = 'm' | 'p' | 'o' | 'j' | 'c';

const MOVEIS: Record<string, (t: T) => string> = {
  pufe: (t) => t('Pufe'),
  poltrona: (t) => t('Poltrona'),
  cama: (t) => t('Cama'),
  abajur: (t) => t('Criado-mudo'),
  'guarda-roupa': (t) => t('Guarda-roupa'),
  tapete: (t) => t('Tapete'),
  mesa: (t) => t('Mesa'),
  'planta-alta': (t) => t('Planta alta'),
  'planta-baixa': (t) => t('Samambaia'),
  tv: (t) => t('TV'),
  sofa: (t) => t('Sofá'),
  mesinha: (t) => t('Mesinha'),
  fliperama: (t) => t('Fliperama'),
  estante: (t) => t('Estante'),
  balcao: (t) => t('Balcão'),
  banqueta: (t) => t('Banqueta'),
  jukebox: (t) => t('Jukebox'),
  microfone: (t) => t('Microfone'),
  'mesa-jogo': (t) => t('Mesa de jogos'),
  cadeira: (t) => t('Cadeira'),
  geladeira: (t) => t('Geladeira'),
  ilha: (t) => t('Ilha da cozinha'),
  pufao: (t) => t('Pufão'),
};

const DA_PAREDE: Record<string, (t: T) => string> = {
  fone: (t) => t('Fone'),
  quadro: (t) => t('Quadro de fotos'),
  cortica: (t) => t('Cortiça'),
  prateleira: (t) => t('Prateleira'),
  pintura: (t) => t('Pintura'),
  'prateleira-bar': (t) => t('Prateleira do bar'),
  'prateleira-snacks': (t) => t('Prateleira de snacks'),
  trofeus: (t) => t('Troféus'),
  neon: (t) => t('Neon'),
  relogio: (t) => t('Relógio'),
  violao: (t) => t('Violão'),
  porta: (t) => t('Porta do banheiro'),
  poster: (t) => t('Pôster do karaokê'),
  cafe: (t) => t('Pôster do café'),
};

const DE_CIMA: Record<string, (t: T) => string> = {
  caneca: (t) => t('Caneca'),
  suco: (t) => t('Suco'),
  refrigerante: (t) => t('Refrigerante'),
  plantinha: (t) => t('Plantinha'),
  livros: (t) => t('Livros'),
  videogame: (t) => t('Videogame'),
  pipoca: (t) => t('Pipoca'),
  retrato: (t) => t('Porta-retrato'),
  pizza: (t) => t('Pizza'),
  salgadinho: (t) => t('Salgadinho'),
  bolo: (t) => t('Bolo'),
};

const JANELAS: Record<string, (t: T) => string> = {
  original: (t) => t('Grande, com cortinas'),
  arco: (t) => t('Em arco'),
  redonda: (t) => t('Redonda'),
  floreira: (t) => t('Com floreira'),
  cortinas: (t) => t('Com cortinas'),
  tijolo: (t) => t('De tijolo'),
};

const CORES: Record<string, (t: T) => string> = {
  salvia: (t) => t('Sálvia'),
  terracota: (t) => t('Terracota'),
  azul: (t) => t('Azul'),
  mostarda: (t) => t('Mostarda'),
  rosa: (t) => t('Rosa'),
  cinza: (t) => t('Cinza'),
};

const TABELAS: Record<GrupoDaCena, Record<string, (t: T) => string>> = { m: MOVEIS, p: DA_PAREDE, o: DE_CIMA, j: JANELAS, c: CORES };

/** O texto inteiro do nome (com as variantes "a|b", se houver), ou o código, para o que ainda não tem nome. */
function nomeCru(t: T, grupo: GrupoDaCena, id: string): string {
  // os iguais com número no salão ("cadeira-2", "sofa-2") e as cópias ("cama~2") têm o nome do tipo
  const tipo = id.split('~')[0];
  const f = TABELAS[grupo][tipo] ?? TABELAS[grupo][tipo.replace(/-\d+$/, '')];
  return f ? f(t) : tipo;
}

export function nomeDaPeca(t: T, grupo: GrupoDaCena, id: string): string {
  return primeiraForma(nomeCru(t, grupo, id));
}

/** Sem acento e sem maiúscula, para a busca achar "balcao" em "Balcão". */
const simples = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** A peça casa com o que se digitou na busca? (por qualquer variante do nome) */
export function casaComABusca(t: T, grupo: GrupoDaCena, id: string, busca: string): boolean {
  const q = simples(busca.trim());
  if (!q) return true;
  return nomeCru(t, grupo, id)
    .split('|')
    .some((forma) => simples(forma).includes(q));
}
