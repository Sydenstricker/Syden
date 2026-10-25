import { chave, idiomaAtual } from './i18n';
import { type LinhaDoPlacar, primeiraForma } from './minijogos';

/**
 * OS QUIZZES DE ADIVINHAR (ver server/src/minijogo-quiz.ts): o mesmo motor, um tema por jogo da estante. O servidor manda
 * os valores CRUS de cada coluna ("dragon", 4, ["walk","fly"]); aqui eles viram texto traduzido. Tema novo: o id em
 * QUIZZES, os rótulos em ROTULOS e, se a fonte pedir, o crédito em CREDITOS.
 */
export const QUIZZES = ['monstros', 'mitologia', 'paises'] as const;
export type IdDoQuiz = (typeof QUIZZES)[number];
export const ehQuiz = (jogo: string): jogo is IdDoQuiz => (QUIZZES as readonly string[]).includes(jogo);

export interface Veredito {
  /** 2 bate, 1 bate em parte, 0 não bate. */
  cor: 0 | 1 | 2;
  /** O secreto tem mais (1) ou menos (-1). */
  seta?: 1 | -1;
  /** Na coluna de distância: os km até o secreto e o rumo (graus, 0 = norte). */
  km?: number;
  rumo?: number;
}

/**
 * As categorias que quem começa escolhe, por tema (o servidor as conhece pelo mesmo id: minijogo-quiz.ts). O nome é o
 * mesmo texto das regiões da grade de países e da categoria "Tudo" do "Qual é o tamanho?".
 */
export const CATEGORIAS_DO_QUIZ: Partial<Record<IdDoQuiz, { id: string; nome: string }[]>> = {
  mitologia: [
    { id: 'tudo', nome: chave('Tudo') },
    { id: 'americas', nome: chave('Américas') },
    { id: 'asia', nome: chave('Ásia') },
    { id: 'africa', nome: chave('África') },
    { id: 'europa', nome: chave('Europa') },
  ],
};

export interface EstadoQuiz {
  rodada: number;
  /** A categoria escolhida ao começar (null num tema sem categorias). */
  categoria?: string | null;
  rodadas: number;
  fase: 'chutando' | 'revelando' | 'fim';
  colunas: { id: string; tipo: string }[];
  meu: { id: string; vereditos: Veredito[]; valores: Record<string, unknown> }[];
  acertei: boolean;
  resposta: { id: string; valores: Record<string, unknown> } | null;
  outros: { userId: number; username: string; cores: number[][]; acertou: boolean; chutes: string[] | null }[];
  placar: LinhaDoPlacar[];
}

interface Rotulos {
  /** O nome de cada coluna, na ordem do servidor. */
  colunas: Record<string, string>;
  /** Como cada valor aparece (a chave do texto, para o t()). Número sem rótulo aparece como número. */
  valores: Record<string, Record<string, string>>;
  /** Para colunas de número que não se mostram cruas (o nível de desafio 0,125 é "1/8"). */
  numero?: Record<string, (valor: number) => string>;
}

const FRACOES: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };

export const ROTULOS: Record<IdDoQuiz, Rotulos> = {
  monstros: {
    colunas: {
      tipo: chave('Tipo'),
      tamanho: chave('Tamanho'),
      nd: chave('Nível'),
      alinhamento: chave('Alinhamento'),
      deslocamento: chave('Deslocamento'),
    },
    valores: {
      // Os nomes da edição em português do jogo, quando são claros para quem nunca jogou ("Gosma", e não "Limo").
      tipo: {
        aberration: chave('Aberração'),
        beast: chave('Fera'),
        celestial: chave('Celestial'),
        construct: chave('Constructo'),
        dragon: chave('Dragão'),
        elemental: chave('Elemental'),
        fey: chave('Fada'),
        fiend: chave('Demônio'),
        giant: chave('Gigante'),
        humanoid: chave('Humanoide'),
        monstrosity: chave('Monstruosidade'),
        ooze: chave('Gosma'),
        plant: chave('Planta'),
        undead: chave('Morto-vivo'),
      },
      tamanho: {
        0: chave('Miúdo'),
        1: chave('Pequeno'),
        2: chave('Médio'),
        3: chave('Grande'),
        4: chave('Enorme'),
        5: chave('Imenso'),
      },
      alinhamento: {
        'lawful good': chave('Leal e bom'),
        'neutral good': chave('Neutro e bom'),
        'chaotic good': chave('Caótico e bom'),
        'lawful neutral': chave('Leal e neutro'),
        neutral: chave('Neutro'),
        'chaotic neutral': chave('Caótico e neutro'),
        'lawful evil': chave('Leal e mau'),
        'neutral evil': chave('Neutro e mau'),
        'chaotic evil': chave('Caótico e mau'),
        evil: chave('Mau'),
        unaligned: chave('Sem alinhamento'),
        any: chave('Qualquer'),
      },
      deslocamento: {
        walk: chave('A pé'),
        fly: chave('Voo'),
        swim: chave('Nado'),
        climb: chave('Escalada'),
        burrow: chave('Escavação'),
        '': chave('Imóvel'),
      },
    },
    numero: { nd: (v) => FRACOES[v] ?? String(v) },
  },
  mitologia: {
    colunas: {
      mitologia: chave('Mitologia'),
      tipo: chave('Tipo'),
      forma: chave('Forma'),
      dominios: chave('Domínios'),
    },
    valores: {
      // O valor guarda o continente depois da mitologia ("grega europa"), para o amarelo; a tela mostra só a mitologia.
      mitologia: {
        'grega europa': chave('Grega'),
        'nordica europa': chave('Nórdica'),
        'celta europa': chave('Celta'),
        'egipcia africa': chave('Egípcia'),
        'ioruba africa': chave('Iorubá'),
        'hindu asia': chave('Hindu'),
        'japonesa asia': chave('Japonesa'),
        'chinesa asia': chave('Chinesa'),
        'mesopotamica asia': chave('Mesopotâmica'),
        'asteca americas': chave('Asteca'),
        'brasileira americas': chave('Brasileira'),
      },
      tipo: {
        divindade: chave('Divindade'),
        heroi: chave('Herói ou heroína'),
        criatura: chave('Criatura'),
      },
      forma: {
        humana: chave('Humana'),
        hibrida: chave('Parte bicho'),
        animal: chave('Animal'),
      },
      dominios: {
        // "Céus", e não "Céu": "Céu" já é o nome de uma cor do guarda-roupa, e em várias línguas virou "azul-céu".
        ceu: chave('Céus'),
        trovao: chave('Trovão'),
        agua: chave('Águas'),
        vento: chave('Vento'),
        terra: chave('Terra'),
        sol: chave('Sol'),
        lua: chave('Lua'),
        fogo: chave('Fogo'),
        submundo: chave('Submundo'),
        morte: chave('Morte'),
        guerra: chave('Guerra'),
        forca: chave('Força'),
        sabedoria: chave('Sabedoria'),
        magia: chave('Magia'),
        trapaca: chave('Trapaça'),
        amor: chave('Amor'),
        familia: chave('Família'),
        fertilidade: chave('Fertilidade'),
        colheita: chave('Colheita'),
        caca: chave('Caça'),
        animais: chave('Animais'),
        cura: chave('Cura'),
        artes: chave('Artes'),
        oficios: chave('Ofícios'),
        viagem: chave('Viagens'),
        justica: chave('Justiça'),
        protecao: chave('Proteção'),
        festa: chave('Festa'),
        riqueza: chave('Riqueza'),
        criacao: chave('Criação'),
        tempo: chave('Tempo'),
        caos: chave('Caos'),
      },
    },
  },
  paises: {
    colunas: {
      local: chave('Distância'),
      regiao: chave('Região'),
      subregiao: chave('Sub-região'),
      populacao: chave('População'),
    },
    valores: {
      // As cinco regiões da ONU: os mesmos textos da grade de países (GradeDePaises.tsx).
      regiao: {
        africa: chave('África'),
        americas: chave('Américas'),
        asia: chave('Ásia'),
        europa: chave('Europa'),
        oceania: chave('Oceania'),
      },
      // As sub-regiões do geoscheme da ONU, como a Natural Earth as escreve.
      subregiao: {
        'Northern Africa': chave('Norte da África'),
        'Western Africa': chave('África Ocidental'),
        'Middle Africa': chave('África Central'),
        'Eastern Africa': chave('África Oriental'),
        'Southern Africa': chave('África Austral'),
        'Northern America': chave('América do Norte'),
        'Central America': chave('América Central'),
        Caribbean: chave('Caribe'),
        'South America': chave('América do Sul'),
        'Central Asia': chave('Ásia Central'),
        'Eastern Asia': chave('Ásia Oriental'),
        'South-Eastern Asia': chave('Sudeste Asiático'),
        'Southern Asia': chave('Sul da Ásia'),
        'Western Asia': chave('Ásia Ocidental'),
        'Northern Europe': chave('Norte da Europa'),
        'Western Europe': chave('Europa Ocidental'),
        'Eastern Europe': chave('Europa Oriental'),
        'Southern Europe': chave('Sul da Europa'),
        'Australia and New Zealand': chave('Austrália e Nova Zelândia'),
        Melanesia: chave('Melanésia'),
        Micronesia: chave('Micronésia'),
        Polynesia: chave('Polinésia'),
      },
    },
    // "214 mi", "38 mil": o número compacto do próprio idioma.
    numero: { populacao: (v) => new Intl.NumberFormat(idiomaAtual(), { notation: 'compact', maximumFractionDigits: 1 }).format(v) },
  },
};

/**
 * O crédito que a fonte pede, na tela do jogo. O do SRD vai nas palavras exatas da Wizards of the Coast (por isso em
 * inglês, em todo idioma): é a condição da licença CC BY 4.0.
 */
export const CREDITOS: Partial<Record<IdDoQuiz, string>> = {
  monstros:
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
};

/** O texto de um valor, já traduzido. Lista vira "A pé, Voo"; lista vazia, o rótulo de ''. */
export function textoDoValor(tema: IdDoQuiz, coluna: string, valor: unknown, traduzir: (chave: string) => string): string {
  // Algumas chaves ("Dragão", "Sol") são também palavras do desenha e adivinha, que guardam as formas aceitas no chute
  // separadas por "|" ("ドラゴン|竜|龍"): aqui só se mostra, e vale a primeira.
  const t = (chave: string) => primeiraForma(traduzir(chave));
  const rotulos = ROTULOS[tema];
  const mapa = rotulos.valores[coluna];
  if (Array.isArray(valor)) {
    if (valor.length === 0) return mapa?.[''] ? t(mapa['']) : '—';
    return valor.map((v) => (mapa?.[String(v)] ? t(mapa[String(v)]) : String(v))).join(', ');
  }
  if (mapa?.[String(valor)]) return t(mapa[String(valor)]);
  if (typeof valor === 'number' && rotulos.numero?.[coluna]) return rotulos.numero[coluna](valor);
  return String(valor);
}

/** Sem acento e em minúscula: é assim que a busca da lista compara o que se escreve com os nomes. */
export const paraBusca = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Os nomes que aparecem para o que se escreveu: primeiro os que começam assim, depois os que contêm; sem os já chutados. */
export function sugestoes(itens: { id: string; nome: string }[], escrito: string, jaChutados: ReadonlySet<string>, limite = 8) {
  const busca = paraBusca(escrito.trim());
  if (!busca) return [];
  const livres = itens.filter((i) => !jaChutados.has(i.id));
  const comeca = livres.filter((i) => paraBusca(i.nome).startsWith(busca));
  const contem = livres.filter((i) => !paraBusca(i.nome).startsWith(busca) && paraBusca(i.nome).includes(busca));
  return [...comeca, ...contem].slice(0, limite);
}
