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

/**
 * A FRASE DO CARTÃO DE CADA PEÇA (pedido dele, 17/10/2026: "uma frase curta por peça, sempre algo pertinente ao objeto").
 * Aparece no cartão que abre ao clicar numa peça sem função (CartaoDaPeca.tsx). Escrita olhando o desenho de cada uma: peça
 * nova pede a frase dela aqui, nos 80 idiomas. Quando houver peça ganha por conquista, o cartão diz também de onde veio.
 */
const DESCRICOES: Partial<Record<GrupoDaCena, Record<string, (t: T) => string>>> = {
  m: {
    pufe: (t) => t('Macio e baixinho, fácil de puxar para perto da conversa.'),
    poltrona: (t) => t('Funda e confortável, boa para ler ou ver alguém jogar.'),
    cama: (t) => t('É aqui que o coelho dorme quando você está ausente.'),
    abajur: (t) => t('Com o abajur em cima, que acende o quarto à noite.'),
    'guarda-roupa': (t) => t('Onde moram as roupas e os enfeites do coelho.'),
    tapete: (t) => t('São seis cores: escolha a dele no Editar.'),
    mesa: (t) => t('O coelho senta aqui quando você entra numa call.'),
    'planta-alta': (t) => t('Folhas grandes para encher um canto de verde.'),
    'planta-baixa': (t) => t('Pequena e cheia, num cesto de palha.'),
    tv: (t) => t('Mostra quem está transmitindo agora.'),
    sofa: (t) => t('Cabe a turma inteira na frente da TV.'),
    mesinha: (t) => t('Baixinha, perto do sofá, para a pipoca e o refrigerante.'),
    fliperama: (t) => t('Abre os mini-games para jogar com a turma.'),
    estante: (t) => t('Cada prateleira guarda os canais da comunidade.'),
    balcao: (t) => t('Onde o coelho do recado espera quem chega.'),
    banqueta: (t) => t('Alta, para sentar no balcão e conversar.'),
    jukebox: (t) => t('Uma máquina de música antiga, com luzes que acendem à noite.'),
    microfone: (t) => t('Com caixa de som, pronto para o karaokê.'),
    'mesa-jogo': (t) => t('Redonda, para cartas, tabuleiro e conversa.'),
    cadeira: (t) => t('De madeira, com o assento estofado.'),
    geladeira: (t) => t('Suco, refrigerante e água sempre gelados.'),
    ilha: (t) => t('A cozinha da turma. O botão direito acende e apaga o fogão.'),
    pufao: (t) => t('Um pufe enorme, para afundar e ficar.'),
  },
  p: {
    fone: (t) => t('Pendurado no gancho, esperando a próxima call.'),
    quadro: (t) => t('Fotos dos amigos presas num varal.'),
    cortica: (t) => t('Recados e ideias presos com alfinete.'),
    prateleira: (t) => t('Livros, uma plantinha e um vaso.'),
    pintura: (t) => t('Um pôr do sol sobre os campos.'),
    'prateleira-bar': (t) => t('Xícaras, potes e garrafas de suco.'),
    'prateleira-snacks': (t) => t('Potes de biscoito e pipoca para dividir.'),
    trofeus: (t) => t('As taças das vitórias da turma.'),
    neon: (t) => t('Um coelho de neon que brilha no escuro.'),
    relogio: (t) => t('Um relógio de madeira para ninguém perder a hora.'),
    violao: (t) => t('Para quem quiser puxar uma música.'),
    porta: (t) => t('Dá no banheiro. Bata antes de entrar.'),
    poster: (t) => t('O cartaz do karaokê, em três versões: palco, neon e fogo.'),
    cafe: (t) => t('Dois coelhos, um café e a fofoca do dia.'),
  },
  o: {
    caneca: (t) => t('Café quentinho, ainda soltando fumaça.'),
    suco: (t) => t('Suco de laranja com canudinho.'),
    refrigerante: (t) => t('Uma lata gelada.'),
    plantinha: (t) => t('Uma suculenta pequena, que quase não pede água.'),
    livros: (t) => t('Uma pilha de livros para ler depois.'),
    videogame: (t) => t('O console da turma, com o controle ao lado.'),
    pipoca: (t) => t('Um balde de pipoca para ver a transmissão.'),
    retrato: (t) => t('Uma lembrança num porta-retrato.'),
    pizza: (t) => t('Uma pizza inteira para dividir.'),
    salgadinho: (t) => t('Um pacote de salgadinho aberto.'),
    bolo: (t) => t('Um bolo de chocolate com uma cereja em cima.'),
  },
};

/** A frase da peça, ou nada (a peça sem frase mostra só a figura e o nome). */
export function descricaoDaPeca(t: T, grupo: GrupoDaCena, id: string): string | null {
  const tipo = id.split('~')[0];
  const f = DESCRICOES[grupo]?.[tipo] ?? DESCRICOES[grupo]?.[tipo.replace(/-\d+$/, '')];
  return f ? f(t) : null;
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
