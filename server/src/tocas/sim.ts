/**
 * TOCAS E TORRES: A SIMULAÇÃO (05/11/2026). Estratégia em tempo real, SÓ A MECÂNICA do gênero (coletar, construir, treinar,
 * avançar de era, atacar): nada de nome, arte ou texto de jogo nenhum.
 *
 * DETERMINÍSTICA, EM PASSO FIXO, E SEPARADA DA TELA. Dez passos por segundo; o mesmo começo (a semente) e os mesmos comandos, no
 * mesmo passo, dão a mesma partida, em qualquer computador. É isso que deixa o servidor REFAZER a partida do Solo e a sala de
 * duas pessoas andar em "lockstep" (19/11/2026): só os COMANDOS andam pela rede, e cada computador simula a partida inteira. Este
 * arquivo e o ia.ts são IGUAIS BYTE A BYTE aos de server/src/tocas/ (o teste confere): mudou um, copie para o outro. Por isso:
 *  - nada de Math.random (o sorteio é o da semente, `aleatorio`), nem de relógio, nem de seno e cosseno: só + − × ÷ e raiz,
 *    que dão o mesmo número em qualquer navegador;
 *  - tudo anda em ordem fixa (as listas na ordem dos ids), e o que muda o jogo só entra por `comandar` (a pessoa, o computador
 *    e o piloto automático usam o mesmo caminho);
 *  - a tela só LÊ (as posições de antes, `ax`/`ay`, servem para ela desenhar entre um passo e outro).
 *
 * O MAPA é uma grade de TAMANHO × TAMANHO casas, espelhada pelo centro (o lado de cada um é igual ao do outro). Prédios,
 * árvores, ouro e pedras ocupam casas (`grade`); as unidades andam livres por cima, com o caminho achado por A* na grade (8
 * direções, sem cortar quina). O portão é passagem só para quem é dono dele.
 */

export const PASSOS_POR_SEGUNDO = 10;
export const PASSO = 1 / PASSOS_POR_SEGUNDO;
export const TAMANHO = 44;
/**
 * OS 20 MINUTOS SÃO UMA SUGESTÃO, NÃO UM LIMITE (24/11/2026, decisão dele). Chegando neles, a partida NÃO acaba sozinha: aparece a
 * opção "Terminar pelos pontos" (ganha quem tem mais, `pontos`). Ela acaba assim quando TODAS as pessoas que ainda jogam aceitam
 * (o comando 'pontos', pelo lockstep): no Solo, quem joga decide sozinha; na sala, qualquer uma propõe e a recusa de uma desfaz a
 * proposta. Os robôs e quem largou não votam; SEM NINGUÉM QUE VOTE (o computador contra o computador), ela acaba aos 20 minutos,
 * como sempre acabou, número por número.
 */
export const PASSOS_SUGERIDOS = 20 * 60 * PASSOS_POR_SEGUNDO;
/** O TETO DE SEGURANÇA: 90 minutos de jogo, e a partida acaba pelos pontos de qualquer jeito (nenhuma sala fica presa para sempre). */
export const PASSOS_MAX = 90 * 60 * PASSOS_POR_SEGUNDO;
/** A Maravilha pronta e de pé por 2 minutos ganha a partida. */
export const PASSOS_DA_MARAVILHA = 2 * 60 * PASSOS_POR_SEGUNDO;
export const POP_MAX = 60;
/** Quanto um trabalhador leva de uma vez. */
export const CARGA = 10;
/**
 * A CAPACIDADE DE CADA LUGAR DE COLETA (06/11/2026, pedido dele: "Fazenda 0/1, mina 0/5"): quantos trabalhadores de UM dono
 * cabem nele ao mesmo tempo. A fazenda é de um só; a MINA é o bloco de ouro inteiro (as casas de ouro encostadas, `minaDe`), e
 * cabem 5 de cada lado. A árvore não tem limite (o bosque já se limita pelas casas livres em volta). Quem passa do limite vai a
 * outro lugar igual com vaga, perto; sem nenhum, fica parado ao lado (e aparece como trabalhador parado).
 */
export const CAPACIDADE = { fazenda: 1, mina: 5 } as const;
/** O sino com gente dentro: o centro solta uma flecha a mais a cada 2 abrigados, até 5 a mais. */
export const FLECHAS_DO_SINO = { cada: 2, max: 5 } as const;

/**
 * O DONO de cada coisa: 0 e 1 no Solo e no 1×1; de 0 a 3 no 2×2 da sala (20/11/2026). A EQUIPE é o bit de baixo (0 e 2 contra
 * 1 e 3): no 1×1, equipe e dono são o mesmo número, e por isso tudo o que pergunta "é aliado?" dá o mesmo de antes.
 */
export type Dono = 0 | 1 | 2 | 3;
export const equipeDe = (d: number): 0 | 1 => (d & 1) as 0 | 1;
/** Da mesma equipe (o próprio dono incluído): não se atacam, dividem a visão e passam pelo portão um do outro. */
export const aliados = (a: number, b: number): boolean => (a & 1) === (b & 1);
export type Recurso = 'comida' | 'madeira' | 'ouro';
export type TipoUnidade = 'trabalhador' | 'lanceiro' | 'arqueiro' | 'cavaleiro' | 'catapulta' | 'guarda' | 'canhao';
export type TipoPredio = 'centro' | 'casa' | 'fazenda' | 'quartel' | 'arquearia' | 'torre' | 'muralha' | 'portao' | 'maravilha' | 'ferreiro' | 'mercado' | 'oficina' | 'bastiao';
export type Era = 1 | 2 | 3;
export type Custo = Partial<Record<Recurso, number>>;
export const RECURSOS: Recurso[] = ['comida', 'madeira', 'ouro'];

/**
 * OS TIPOS DE MAPA (19/11/2026): o de sempre ('campo'), a 'floresta' (bosques fechados e um corredor entre as bases), o 'ouro' no
 * meio (a mina grande no centro do mapa, cercada de pedras, e a de casa menor) e os 'lagos' (água que não se atravessa). A base de
 * cada um (o centro, a mina de casa e os bosques de perto) é IGUAL nos quatro, e tudo é espelhado: ninguém nasce com vantagem.
 */
export type TipoDoMapa = 'campo' | 'floresta' | 'ouro' | 'lagos';
export const MAPAS: TipoDoMapa[] = ['campo', 'floresta', 'ouro', 'lagos'];

/**
 * O FERREIRO (19/11/2026): as melhorias, uma vez cada, por linha de tropa (o ataque e a armadura dos lanceiros, dos cavaleiros e
 * dos arqueiros) e de coleta (madeira, ouro, comida). A ORDEM desta lista é a dos bits em `Jogador.melhorias`: nova vai no fim.
 */
export type Melhoria =
  | 'ataqueLanceiro'
  | 'armaduraLanceiro'
  | 'ataqueCavaleiro'
  | 'armaduraCavaleiro'
  | 'ataqueArqueiro'
  | 'armaduraArqueiro'
  | 'machado'
  | 'picareta'
  | 'arado'
  // as da era 3 (24/11/2026): valem para todas as tropas, ou para a carga do trabalhador
  | 'forja'
  | 'cota'
  | 'carrinho';
export const ORDEM_DAS_MELHORIAS: Melhoria[] = ['ataqueLanceiro', 'armaduraLanceiro', 'ataqueCavaleiro', 'armaduraCavaleiro', 'ataqueArqueiro', 'armaduraArqueiro', 'machado', 'picareta', 'arado', 'forja', 'cota', 'carrinho'];
export interface DadosDaMelhoria {
  custo: Custo;
  /** Passos de estudo no ferreiro. */
  tempo: number;
  /** A tropa que ela melhora (ataque ou armadura), ou o recurso que se colhe mais depressa. */
  linha?: TipoUnidade;
  tipo: 'ataque' | 'armadura' | 'coleta' | 'ataqueGeral' | 'armaduraGeral' | 'carga';
  recurso?: Recurso;
  /** A era que ela pede (sem: a 1). */
  era?: 3;
}
export const MELHORIAS: Record<Melhoria, DadosDaMelhoria> = {
  ataqueLanceiro: { custo: { comida: 100, ouro: 50 }, tempo: 300, linha: 'lanceiro', tipo: 'ataque' },
  armaduraLanceiro: { custo: { comida: 100, ouro: 50 }, tempo: 300, linha: 'lanceiro', tipo: 'armadura' },
  ataqueCavaleiro: { custo: { comida: 120, ouro: 80 }, tempo: 300, linha: 'cavaleiro', tipo: 'ataque' },
  armaduraCavaleiro: { custo: { comida: 120, ouro: 80 }, tempo: 300, linha: 'cavaleiro', tipo: 'armadura' },
  ataqueArqueiro: { custo: { madeira: 100, ouro: 60 }, tempo: 300, linha: 'arqueiro', tipo: 'ataque' },
  armaduraArqueiro: { custo: { comida: 80, ouro: 60 }, tempo: 300, linha: 'arqueiro', tipo: 'armadura' },
  machado: { custo: { comida: 100, madeira: 50 }, tempo: 250, tipo: 'coleta', recurso: 'madeira' },
  picareta: { custo: { comida: 100, madeira: 75 }, tempo: 250, tipo: 'coleta', recurso: 'ouro' },
  arado: { custo: { madeira: 125 }, tempo: 250, tipo: 'coleta', recurso: 'comida' },
  forja: { custo: { comida: 250, ouro: 150 }, tempo: 400, tipo: 'ataqueGeral', era: 3 },
  cota: { custo: { comida: 250, ouro: 150 }, tempo: 400, tipo: 'armaduraGeral', era: 3 },
  carrinho: { custo: { comida: 100, madeira: 250 }, tempo: 350, tipo: 'carga', era: 3 },
};
/**
 * O que cada melhoria faz: o golpe da linha ×1,25, o golpe que a linha leva ×0,75, e 3 passos a menos por unidade colhida. As da
 * era 3 (24/11/2026): o golpe de TODA tropa ×1,15 (a forja), o golpe que toda tropa leva ×0,85 (a cota de malha), e o trabalhador
 * carrega 15 de uma vez (o carrinho).
 */
export const EFEITO_DAS_MELHORIAS = { ataque: 1.25, armadura: 0.75, coleta: 3, ataqueGeral: 1.15, armaduraGeral: 0.85, carga: 15 } as const;
/** O MERCADO (a era 2): 100 de um recurso por outro, ao preço de quem troca (o que se vende barateia, o que se compra encarece). */
export const MERCADO = { lote: 100, taxa: 70, passo: 6, min: 40, max: 250 } as const;
/** De quanto em quanto tempo a partida guarda o gráfico do fim (recursos colhidos e o tamanho do exército): 15 s. */
export const AMOSTRA_DO_HISTORICO = 15 * 10;

export interface DadosDaUnidade {
  vida: number;
  ataque: number;
  /** O golpe contra prédio (a catapulta é forte aqui; quem bate de perto, fraco). */
  contraPredio: number;
  /** Em casas, de centro a centro (contra prédio, até a borda dele). */
  alcance: number;
  /** Mais perto que isto, não atira (a catapulta). */
  alcanceMin: number;
  /** Passos entre um golpe e outro. */
  recarga: number;
  /** Casas por passo. */
  velocidade: number;
  visao: number;
  custo: Custo;
  /** Passos para treinar. */
  tempo: number;
  de: TipoPredio;
  era: Era;
  /** A linha do ferreiro (as melhorias de ataque e armadura que ela usa); sem: a dela mesma. A guarda é da linha do lanceiro. */
  linha?: TipoUnidade;
  /** A pedra-papel-tesoura: o golpe contra este tipo vale `vezes` mais. */
  bonus?: { contra: TipoUnidade; vezes: number };
  combate: boolean;
}

/** Lanceiro > cavaleiro > arqueiro > lanceiro; a catapulta derruba prédio e muralha, e de perto não faz nada. */
export const UNIDADES: Record<TipoUnidade, DadosDaUnidade> = {
  trabalhador: { vida: 30, ataque: 3, contraPredio: 2, alcance: 0.9, alcanceMin: 0, recarga: 15, velocidade: 0.13, visao: 4.5, custo: { comida: 50 }, tempo: 100, de: 'centro', era: 1, combate: false },
  lanceiro: { vida: 55, ataque: 5, contraPredio: 3, alcance: 0.95, alcanceMin: 0, recarga: 15, velocidade: 0.12, visao: 5, custo: { comida: 35, madeira: 25 }, tempo: 110, de: 'quartel', era: 1, bonus: { contra: 'cavaleiro', vezes: 3 }, combate: true },
  cavaleiro: { vida: 100, ataque: 8, contraPredio: 4, alcance: 1.05, alcanceMin: 0, recarga: 18, velocidade: 0.2, visao: 6, custo: { comida: 70, ouro: 60 }, tempo: 140, de: 'quartel', era: 1, bonus: { contra: 'arqueiro', vezes: 2.5 }, combate: true },
  arqueiro: { vida: 35, ataque: 4, contraPredio: 1, alcance: 5, alcanceMin: 0, recarga: 20, velocidade: 0.12, visao: 7, custo: { madeira: 25, ouro: 40 }, tempo: 110, de: 'arquearia', era: 1, bonus: { contra: 'lanceiro', vezes: 2.5 }, combate: true },
  catapulta: { vida: 90, ataque: 6, contraPredio: 50, alcance: 7, alcanceMin: 2.5, recarga: 50, velocidade: 0.07, visao: 8, custo: { madeira: 180, ouro: 120 }, tempo: 200, de: 'quartel', era: 2, combate: true },
  // A ERA 3 (24/11/2026): a guarda (a lança com escudo, o lanceiro veterano: a mesma linha no ferreiro) e o canhão (de longe, o que
  // mais derruba prédio, e acerta gente melhor que a catapulta), feito na oficina
  guarda: { vida: 110, ataque: 8, contraPredio: 4, alcance: 0.95, alcanceMin: 0, recarga: 15, velocidade: 0.125, visao: 5, custo: { comida: 60, madeira: 30, ouro: 35 }, tempo: 130, de: 'quartel', era: 3, linha: 'lanceiro', bonus: { contra: 'cavaleiro', vezes: 3 }, combate: true },
  canhao: { vida: 130, ataque: 12, contraPredio: 80, alcance: 8, alcanceMin: 2.5, recarga: 60, velocidade: 0.06, visao: 9, custo: { madeira: 225, ouro: 125 }, tempo: 240, de: 'oficina', era: 3, combate: true },
};
/** Quem é de cerco (prefere prédio, e de perto não atira): a catapulta e o canhão. */
export const ehCerco = (t: TipoUnidade): boolean => t === 'catapulta' || t === 'canhao';

export interface DadosDoPredio {
  tam: number;
  vida: number;
  custo: Custo;
  /** Passos de trabalho (com um trabalhador; dois fazem na metade). */
  tempo: number;
  era: Era;
  pop?: number;
  ataque?: number;
  alcance?: number;
  recarga?: number;
  visao: number;
  /** Quem dá para construir (o centro já vem, e não se faz outro). */
  construivel: boolean;
}

export const PREDIOS: Record<TipoPredio, DadosDoPredio> = {
  centro: { tam: 3, vida: 2000, custo: {}, tempo: 1, era: 1, pop: 5, ataque: 4, alcance: 6, recarga: 15, visao: 8, construivel: false },
  casa: { tam: 2, vida: 350, custo: { madeira: 30 }, tempo: 150, era: 1, pop: 5, visao: 3, construivel: true },
  fazenda: { tam: 2, vida: 200, custo: { madeira: 60 }, tempo: 120, era: 1, visao: 2, construivel: true },
  quartel: { tam: 3, vida: 800, custo: { madeira: 150 }, tempo: 300, era: 1, visao: 4, construivel: true },
  arquearia: { tam: 3, vida: 800, custo: { madeira: 150 }, tempo: 300, era: 1, visao: 4, construivel: true },
  torre: { tam: 1, vida: 600, custo: { madeira: 100, ouro: 60 }, tempo: 350, era: 1, ataque: 5, alcance: 6.5, recarga: 15, visao: 8, construivel: true },
  muralha: { tam: 1, vida: 500, custo: { madeira: 6 }, tempo: 40, era: 1, visao: 2, construivel: true },
  portao: { tam: 1, vida: 600, custo: { madeira: 25 }, tempo: 80, era: 1, visao: 2, construivel: true },
  maravilha: { tam: 4, vida: 2400, custo: { comida: 400, madeira: 600, ouro: 500 }, tempo: 1500, era: 2, visao: 6, construivel: true },
  ferreiro: { tam: 2, vida: 600, custo: { madeira: 120 }, tempo: 250, era: 1, visao: 3, construivel: true },
  mercado: { tam: 3, vida: 800, custo: { madeira: 175 }, tempo: 300, era: 2, visao: 4, construivel: true },
  // a era 3: a oficina (onde se faz o canhão) e o bastião (a torre do canhão: mais vida, mais longe e golpe maior, mais devagar)
  oficina: { tam: 3, vida: 900, custo: { madeira: 250 }, tempo: 320, era: 3, visao: 4, construivel: true },
  bastiao: { tam: 1, vida: 1000, custo: { madeira: 175, ouro: 75 }, tempo: 400, era: 3, ataque: 10, alcance: 7.5, recarga: 22, visao: 9, construivel: true },
};

/** Avançar de era: no centro da vila, com o custo e o tempo; a era 2 deixa a vida e o golpe maiores, e abre a catapulta e a Maravilha. */
export const ERA2 = { custo: { comida: 400, ouro: 200 } as Custo, tempo: 400, vidaUnidade: 1.2, ataque: 1.25, vidaPredio: 1.5 };
/**
 * A ERA 3 (24/11/2026, a segunda auditoria, lote E): da era 2, com um MERCADO pronto (a novidade da era 2 é o degrau para a 3).
 * Vida e golpe maiores ainda, e abre a guarda, a oficina com o canhão, o bastião e as três melhorias gerais do ferreiro. Quem não
 * chega a ela joga a partida de antes, número por número (o teste confere contra a versão anterior).
 */
export const ERA3 = { custo: { comida: 500, ouro: 300 } as Custo, tempo: 500, vidaUnidade: 1.4, ataque: 1.5, vidaPredio: 1.8 };
/** Os multiplicadores de cada era (na 1, nenhum). */
const FATOR_DA_ERA: Record<Era, { vidaUnidade: number; ataque: number; vidaPredio: number }> = {
  1: { vidaUnidade: 1, ataque: 1, vidaPredio: 1 },
  2: ERA2,
  3: ERA3,
};
/** O avanço que sai da era `de` (o custo e o tempo); null na última. */
export function proximaEra(de: Era): { custo: Custo; tempo: number } | null {
  return de === 1 ? ERA2 : de === 2 ? ERA3 : null;
}
/** Dá para pedir o avanço de era agora? Da 1, sempre; da 2, só com um mercado pronto. */
export function podeAvancarEra(sim: Sim, dono: Dono): boolean {
  const era = sim.jogadores[dono].era;
  if (era === 1) return true;
  if (era === 2) return sim.predios.some((p) => p.dono === dono && p.tipo === 'mercado' && p.pronto);
  return false;
}

/** Passos de trabalho por unidade de recurso. */
const RITMO: Record<Recurso, number> = { comida: 13, madeira: 12, ouro: 14 };
const MADEIRA_DA_ARVORE = 100;
const OURO_DA_PEDRA = 350;
const DIAG = 1.4142135623730951;

export interface Ordem {
  tipo: 'parado' | 'mover' | 'atacar' | 'coletar' | 'entregar' | 'construir' | 'abrigar';
  x?: number;
  y?: number;
  /** Mover atacando quem aparecer no caminho. */
  atacando?: boolean;
  alvo?: number;
  /** De onde voltar depois de entregar (a fonte ou a fazenda). */
  volta?: number;
  /** A ordem a retomar depois de um ataque que apareceu no caminho. */
  depois?: Ordem;
}

export interface Unidade {
  id: number;
  tipo: TipoUnidade;
  dono: Dono;
  x: number;
  y: number;
  /** Onde estava no passo de antes (a tela desenha entre um e outro). */
  ax: number;
  ay: number;
  /** Para onde olha (um vetor, sem ângulo). */
  rx: number;
  ry: number;
  vida: number;
  vidaMax: number;
  ordem: Ordem;
  caminho: number[];
  /** O passo em que o caminho foi achado (ataque a quem anda: acha de novo de tempos em tempos). */
  achouEm: number;
  recarga: number;
  carga: { rec: Recurso; qtd: number } | null;
  /** Os passos de trabalho na unidade de recurso em andamento. */
  trabalho: number;
  /** O que a tela mostra: a animação. */
  acao: 'parado' | 'andando' | 'trabalhando' | 'atacando';
  /** Quem bateu por último (para revidar), e quando. */
  atacadoPor: number;
  /** O SINO: o id do centro onde está abrigado (0 fora). Abrigado, não aparece, não se mexe, não apanha e não recebe ordem. */
  abrigado: number;
  /** O que fazia quando o sino tocou (o segundo toque devolve). */
  antesDoSino: Ordem | null;
}

export interface Predio {
  id: number;
  tipo: TipoPredio;
  dono: Dono;
  gx: number;
  gy: number;
  tam: number;
  vida: number;
  vidaMax: number;
  progresso: number;
  pronto: boolean;
  fila: TipoUnidade[];
  treino: number;
  /** O avanço de era em andamento (no centro), em passos; 0 sem pesquisa. */
  pesquisa: number;
  recarga: number;
  /** A era em que ficou pronto (a tela escolhe o modelo). */
  era: Era;
  /**
   * O PONTO DE REUNIÃO (05/11/2026, pedido dele: "clicar com o direito deveria alterar o local de geração da unidade"): quem
   * nasce aqui vai para lá sozinho. Com `alvo` (uma fonte, a fazenda, um inimigo), quem nasce recebe o mesmo clique direito
   * sobre ele (o trabalhador vai coletar, o soldado atacar). Null: fica na porta.
   */
  reuniao: { x: number; y: number; alvo?: number } | null;
  /** O SINO do centro (06/11/2026, pedido dele): tocado, todos os trabalhadores do dono vão para dentro; tocado de novo, voltam. */
  sino: boolean;
  /** A melhoria em estudo no ferreiro (uma por vez), e quantos passos já andou. */
  estudo: Melhoria | null;
  estudoPassos: number;
}

export interface Fonte {
  id: number;
  tipo: 'arvore' | 'ouro';
  gx: number;
  gy: number;
  qtd: number;
  variante: number;
}

export interface Jogador {
  recursos: Record<Recurso, number>;
  era: Era;
  /** Passos com a Maravilha pronta e de pé. */
  maravilha: number;
  visivel: Uint8Array;
  explorado: Uint8Array;
  /** As melhorias do ferreiro já feitas: um bit por melhoria, na ordem de ORDEM_DAS_MELHORIAS. */
  melhorias: number;
  /** O preço de cada recurso no mercado de quem troca (100 no começo). */
  precos: Record<Recurso, number>;
}

export type Evento =
  | { t: 'golpe'; de: number; alvo: number; dono: Dono; arma: 'corpo' | 'flecha' | 'pedra' | 'bala'; x0: number; y0: number; x1: number; y1: number }
  | { t: 'morte'; id: number; dono: Dono; tipo: TipoUnidade | TipoPredio; predio: boolean; x: number; y: number }
  | { t: 'pronto'; id: number; dono: Dono; tipo: TipoPredio }
  | { t: 'treinou'; id: number; dono: Dono; tipo: TipoUnidade }
  | { t: 'entregou'; dono: Dono; rec: Recurso; qtd: number }
  | { t: 'esgotou'; id: number }
  | { t: 'era'; dono: Dono }
  | { t: 'maravilha'; dono: Dono }
  | { t: 'atacado'; dono: Dono; x: number; y: number }
  /** Mandou trabalhador a um lugar cheio (a fazenda, a mina) e não havia outro com vaga perto. */
  | { t: 'cheio'; dono: Dono; id: number }
  | { t: 'sino'; dono: Dono; tocado: boolean }
  | { t: 'melhoria'; dono: Dono; m: Melhoria }
  | { t: 'troca'; dono: Dono; de: Recurso; para: Recurso; ganho: number }
  /** Alguém aceitou (ou propôs) terminar pelos pontos, ou recusou (e a proposta se desfez). */
  | { t: 'pontos'; dono: Dono; aceita: boolean }
  | { t: 'fim'; vencedor: Dono; motivo: Motivo };

/** 'tempo': os 20 minutos sem ninguém que vote, ou o teto de segurança; 'pontos': todas as pessoas aceitaram terminar pelos pontos. */
export type Motivo = 'centro' | 'maravilha' | 'tempo' | 'desafio' | 'pontos';

/**
 * OS DESAFIOS DO SOLO (21/11/2026, a segunda auditoria, lote D): cenários curtos, cada um com um objetivo e um recorde próprio
 * (a tabela comum do Solo, variante `desafio-<id>`). Só no Solo (o 1×1 contra o computador); sem desafio, a partida é a de
 * sempre (o lockstep da sala não muda).
 *  - cerco: aguentar 10 minutos contra um computador que ataca cedo e sem parar (o recorde são os pontos no fim);
 *  - maravilha: a Maravilha já de pé, e um exército chegando; ela precisa ficar de pé 5 minutos (o recorde é a vida dela, em %);
 *  - relampago: um exército pronto, e derrubar o centro do computador fácil em até 8 minutos (o recorde é o tempo);
 *  - colheita: colher `meta` recursos, sem ninguém atacar, em até 15 minutos (o recorde é o tempo).
 */
export type Desafio = 'cerco' | 'maravilha' | 'relampago' | 'colheita';
export const LISTA_DE_DESAFIOS: Desafio[] = ['cerco', 'maravilha', 'relampago', 'colheita'];
export const DESAFIOS: Record<Desafio, { limite: number; meta?: number; menorMelhor: boolean }> = {
  cerco: { limite: 10 * 60 * PASSOS_POR_SEGUNDO, menorMelhor: false },
  maravilha: { limite: 5 * 60 * PASSOS_POR_SEGUNDO, menorMelhor: false },
  relampago: { limite: 8 * 60 * PASSOS_POR_SEGUNDO, menorMelhor: true },
  colheita: { limite: 15 * 60 * PASSOS_POR_SEGUNDO, meta: 2500, menorMelhor: true },
};
export const ehDesafio = (v: unknown): v is Desafio => typeof v === 'string' && (LISTA_DE_DESAFIOS as string[]).includes(v);

export type Comando =
  | { t: 'mover'; ids: number[]; x: number; y: number; atacando?: boolean }
  /** O clique direito em alguém ou em algo: atacar o inimigo, coletar a fonte ou a fazenda, ajudar a construir. */
  | { t: 'alvo'; ids: number[]; alvo: number }
  | { t: 'construir'; ids: number[]; tipo: TipoPredio; gx: number; gy: number }
  /** Uma linha reta de muralha (na horizontal ou na vertical), de uma casa a outra. */
  | { t: 'muralha'; ids: number[]; gx0: number; gy0: number; gx1: number; gy1: number }
  | { t: 'treinar'; predio: number; unidade: TipoUnidade }
  | { t: 'cancelar'; predio: number }
  /** O ponto de reunião do prédio: no chão, ou em cima de algo (`alvo`). */
  | { t: 'reuniao'; predio: number; x: number; y: number; alvo?: number }
  | { t: 'era'; predio: number }
  /** O sino do centro: o primeiro toque abriga todos os trabalhadores, o segundo os devolve ao que faziam. */
  | { t: 'sino'; predio: number }
  /** Estudar uma melhoria no ferreiro. */
  | { t: 'melhorar'; predio: number; m: Melhoria }
  /** Trocar no mercado: um lote de `de` por `para`. */
  | { t: 'trocar'; predio: number; de: Recurso; para: Recurso }
  | { t: 'parar'; ids: number[] }
  /** Depois dos 20 minutos: aceitar (ou propor) terminar pelos pontos, ou recusar a proposta. */
  | { t: 'pontos'; aceita: boolean }
  /** Quem largou o 2×2 deixa de votar (o servidor põe este comando no turno, pela pessoa). */
  | { t: 'largar' };

/** Uma amostra do gráfico do fim: o passo, o que cada um já colheu e quantos soldados cada um tinha. */
export interface Amostra {
  passo: number;
  colhido: number[];
  exercito: number[];
}

export interface Sim {
  passo: number;
  semente: number;
  /** Dois (o Solo e o 1×1) ou quatro (o 2×2). */
  jogadores: Jogador[];
  unidades: Unidade[];
  predios: Predio[];
  fontes: Fonte[];
  /** Quem ocupa cada casa: o id do prédio ou da fonte, -1 pedra, 0 livre. */
  grade: Int32Array;
  pedras: { gx: number; gy: number }[];
  proximoId: number;
  eventos: Evento[];
  fila: { dono: Dono; c: Comando }[];
  vencedor: Dono | null;
  motivo: Motivo | null;
  porId: Map<number, Unidade | Predio | Fonte>;
  /** O último aviso de ataque, por dono (para não repetir a cada golpe). */
  avisoEm: number[];
  rnd: () => number;
  /** O que era cada fonte que acabou (quem voltava a ela acha uma parecida perto). */
  acabadas: Map<number, { tipo: Fonte['tipo']; gx: number; gy: number }>;
  /** A mina (o bloco de ouro encostado) de cada casa de ouro, pelo id da fonte; não se apaga quando a casa acaba. */
  minaDe: Map<number, number>;
  mapa: TipoDoMapa;
  /** As casas de água (o mapa de lagos): como a pedra, ninguém passa nem constrói. */
  agua: { gx: number; gy: number }[];
  /** Tudo o que cada um já levou ao estoque (o gráfico do fim). */
  colhido: number[];
  historico: Amostra[];
  /** O 2×2: quatro bases, uma em cada canto, e o mapa espelhado nos dois eixos. */
  quatro: boolean;
  /** Onde nasceu o centro da vila de cada dono. */
  centros: { gx: number; gy: number }[];
  /** O desafio do Solo (null: a partida de sempre). */
  desafio: Desafio | null;
  /** Quem vota para terminar pelos pontos (as pessoas que jogam; não os robôs, nem quem largou). */
  votam: boolean[];
  /** Quem já aceitou terminar pelos pontos (um bit por dono); a recusa zera. */
  votos: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// O sorteio da semente e o mapa
// ---------------------------------------------------------------------------------------------------------------------

/** mulberry32: o mesmo número em qualquer lugar (só inteiros de 32 bits). */
export function aleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ind = (x: number, y: number) => y * TAMANHO + x;
const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < TAMANHO && y < TAMANHO;

/** O canto do centro da vila de cada um (o do computador é o espelho). */
export const CENTRO_DE: [{ gx: number; gy: number }, { gx: number; gy: number }] = [
  { gx: 6, gy: 34 },
  { gx: TAMANHO - 6 - 3, gy: TAMANHO - 34 - 3 },
];

/**
 * O 2×2 (20/11/2026): uma base em cada canto, e os ALIADOS EM CANTOS OPOSTOS: a equipe 0 (os donos 0 e 2) embaixo à esquerda
 * e em cima à direita, a 1 (1 e 3) nos outros dois. O mapa é espelhado nos dois eixos, então as quatro bases são iguais; e com a
 * aliança na diagonal, cada equipe tem uma base de cada lado e de cada altura. Medido com quatro computadores: com os aliados
 * lado a lado, a equipe da direita ganhava 8 de 10 (a ordem em que a simulação varre as casas não é simétrica); na diagonal,
 * 12 a 16 em 28 partidas.
 */
export const CENTROS_DO_2X2: { gx: number; gy: number }[] = [
  { gx: 6, gy: 34 },
  { gx: 6, gy: TAMANHO - 34 - 3 },
  { gx: TAMANHO - 6 - 3, gy: TAMANHO - 34 - 3 },
  { gx: TAMANHO - 6 - 3, gy: 34 },
];

export function novaPartida(semente: number, opcoes: { mapa?: TipoDoMapa; quatro?: boolean; desafio?: Desafio | null; votam?: boolean[] } = {}): Sim {
  const vazio = () => new Uint8Array(TAMANHO * TAMANHO);
  const jog = (): Jogador => ({
    recursos: { comida: 200, madeira: 200, ouro: 100 },
    era: 1,
    maravilha: 0,
    visivel: vazio(),
    explorado: vazio(),
    melhorias: 0,
    precos: { comida: 100, madeira: 100, ouro: 100 },
  });
  const mapa: TipoDoMapa = opcoes.mapa && MAPAS.includes(opcoes.mapa) ? opcoes.mapa : 'campo';
  const quatro = opcoes.quatro === true;
  const n = quatro ? 4 : 2;
  const sim: Sim = {
    passo: 0,
    semente,
    jogadores: Array.from({ length: n }, jog),
    unidades: [],
    predios: [],
    fontes: [],
    grade: new Int32Array(TAMANHO * TAMANHO),
    pedras: [],
    proximoId: 1,
    eventos: [],
    fila: [],
    vencedor: null,
    motivo: null,
    porId: new Map(),
    avisoEm: Array.from({ length: n }, () => -999),
    rnd: aleatorio(semente),
    acabadas: new Map(),
    minaDe: new Map(),
    mapa,
    agua: [],
    colhido: Array.from({ length: n }, () => 0),
    historico: [],
    quatro,
    centros: quatro ? CENTROS_DO_2X2 : CENTRO_DE,
    desafio: !quatro && ehDesafio(opcoes.desafio) ? opcoes.desafio : null,
    votam: Array.from({ length: n }, (_, d) => opcoes.votam?.[d] === true),
    votos: 0,
  };
  if (quatro) gerarMapaDe4(sim);
  else gerarMapa(sim);
  juntarMinas(sim);
  for (const d of donos(sim)) {
    const c = sim.centros[d];
    const p = novoPredio(sim, d, 'centro', c.gx, c.gy);
    p.pronto = true;
    p.progresso = PREDIOS.centro.tempo;
    p.vida = p.vidaMax;
    for (let i = 0; i < 3; i++) {
      const lugar = casaLivrePerto(sim, p.gx, p.gy, p.tam, d, d === 0 ? i + 10 : i + 10);
      novaUnidade(sim, d, 'trabalhador', lugar.x + 0.5, lugar.y + 0.5);
    }
  }
  if (sim.desafio) montarDesafio(sim, sim.desafio);
  verNevoa(sim);
  amostrar(sim);
  return sim;
}

/** O que cada desafio põe na partida antes do primeiro passo (a Maravilha e o relâmpago mudam o começo). */
function montarDesafio(sim: Sim, desafio: Desafio) {
  const somar = (r: Record<Recurso, number>, c: Custo) => {
    for (const k of RECURSOS) r[k] += c[k] ?? 0;
  };
  if (desafio === 'relampago') {
    // um exército da era 2 já pronto, ao lado do centro
    sim.jogadores[0].era = 2;
    const c = sim.centros[0];
    const tropa: TipoUnidade[] = ['lanceiro', 'lanceiro', 'lanceiro', 'lanceiro', 'arqueiro', 'arqueiro', 'arqueiro', 'arqueiro', 'cavaleiro', 'cavaleiro', 'catapulta', 'catapulta'];
    tropa.forEach((t, i) => {
      const k = casaLivrePerto(sim, c.gx, c.gy, PREDIOS.centro.tam, 0, i * 2 + 1);
      novaUnidade(sim, 0, t, k.x + 0.5, k.y + 0.5);
    });
    return;
  }
  if (desafio !== 'maravilha') return;
  // a Maravilha de pé, perto do centro, na era 2, com uma guarda pequena e um troco para reforçar
  const eu = sim.jogadores[0];
  eu.era = 2;
  somar(eu.recursos, { comida: 300, madeira: 400, ouro: 250 });
  const c = sim.centros[0];
  // atrás do centro (do lado de longe do meio do mapa), para o exército chegar primeiro na vila
  const meio = TAMANHO / 2;
  const lugar = lugarLivre(sim, c.gx - Math.sign(meio - c.gx) * 5, c.gy - Math.sign(meio - c.gy) * 5, PREDIOS.maravilha.tam)
    ?? lugarLivre(sim, c.gx - Math.sign(meio - c.gx) * 5, c.gy - Math.sign(meio - c.gy) * 5, PREDIOS.maravilha.tam, 0)
    ?? lugarLivre(sim, c.gx, c.gy, PREDIOS.maravilha.tam);
  if (lugar) {
    const m = novoPredio(sim, 0, 'maravilha', lugar.x, lugar.y);
    m.pronto = true;
    m.progresso = PREDIOS.maravilha.tempo;
    m.vida = m.vidaMax;
    const guarda: TipoUnidade[] = ['lanceiro', 'lanceiro', 'lanceiro', 'lanceiro', 'arqueiro', 'arqueiro', 'arqueiro', 'arqueiro', 'cavaleiro', 'cavaleiro'];
    guarda.forEach((t, i) => {
      const k = casaLivrePerto(sim, m.gx, m.gy, m.tam, 0, i * 3);
      novaUnidade(sim, 0, t, k.x + 0.5, k.y + 0.5);
    });
  }
  // o computador já chega com o exército pronto
  const ele = sim.jogadores[1];
  ele.era = 2;
  somar(ele.recursos, { comida: 800, madeira: 800, ouro: 600 });
  const o = sim.centros[1];
  const exercito: TipoUnidade[] = ['lanceiro', 'lanceiro', 'lanceiro', 'lanceiro', 'arqueiro', 'arqueiro', 'arqueiro', 'arqueiro', 'cavaleiro', 'cavaleiro', 'catapulta', 'catapulta'];
  exercito.forEach((t, i) => {
    const k = casaLivrePerto(sim, o.gx, o.gy, PREDIOS.centro.tam, 1, i * 2 + 1);
    novaUnidade(sim, 1, t, k.x + 0.5, k.y + 0.5);
  });
}

/** O canto de um retângulo livre de `tam` × `tam` (com uma casa de folga em volta) mais perto de (gx, gy), em anéis. */
function lugarLivre(sim: Sim, gx: number, gy: number, tam: number, folga = 1): { x: number; y: number } | null {
  for (let anel = 0; anel < 16; anel++) {
    for (let dy = -anel; dy <= anel; dy++)
      for (let dx = -anel; dx <= anel; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== anel) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 1 || y < 1 || x + tam > TAMANHO - 1 || y + tam > TAMANHO - 1) continue;
        let livre = true;
        for (let yy = y - folga; yy < y + tam + folga && livre; yy++) for (let xx = x - folga; xx < x + tam + folga && livre; xx++) if (sim.grade[ind(xx, yy)] !== 0) livre = false;
        if (livre) return { x, y };
      }
  }
  return null;
}

/** Quanto tempo (em passos) a Maravilha precisa ficar de pé para vencer (no desafio da Maravilha, o limite dele). */
export function passosDaMaravilha(sim: Sim): number {
  return sim.desafio === 'maravilha' ? DESAFIOS.maravilha.limite : PASSOS_DA_MARAVILHA;
}

/** O número do recorde de um desafio vencido: os pontos (cerco), a vida da Maravilha em % (maravilha), ou o tempo em ms. */
export function valorDoDesafio(sim: Sim): number {
  if (sim.desafio === 'cerco') return pontos(sim, 0);
  if (sim.desafio === 'maravilha') {
    const m = sim.predios.find((p) => p.dono === 0 && p.tipo === 'maravilha');
    return m ? Math.round((m.vida / m.vidaMax) * 100) : 0;
  }
  return sim.passo * 100;
}

/** Uma amostra do gráfico do fim (o que cada um já colheu e o tamanho do exército). */
function amostrar(sim: Sim) {
  const exercito = sim.jogadores.map(() => 0);
  for (const u of sim.unidades) if (UNIDADES[u.tipo].combate) exercito[u.dono]++;
  sim.historico.push({ passo: sim.passo, colhido: [...sim.colhido], exercito });
}

/** Os donos da partida, em ordem: [0, 1] ou [0, 1, 2, 3]. */
export function donos(sim: Sim): Dono[] {
  return sim.jogadores.map((_, d) => d as Dono);
}

/**
 * O CORREDOR dos mapas fechados (floresta, lagos): as casas a até 2,5 da reta entre os dois centros, no trecho do meio. Nada
 * nasce nelas, e por isso sempre há um caminho de uma base à outra (o teste confere em muitas sementes).
 */
function noCorredor(x: number, y: number): boolean {
  return noCorredorEntre(x, y, CENTRO_DE[0], CENTRO_DE[1]);
}
function noCorredorEntre(x: number, y: number, a: { gx: number; gy: number }, b: { gx: number; gy: number }): boolean {
  const ax = a.gx + 1.5;
  const ay = a.gy + 1.5;
  const dx = b.gx + 1.5 - ax;
  const dy = b.gy + 1.5 - ay;
  const px = x + 0.5 - ax;
  const py = y + 0.5 - ay;
  const q = dx * dx + dy * dy;
  const t = (px * dx + py * dy) / q;
  if (t < 0.12 || t > 0.88) return false;
  const cruz = px * dy - py * dx;
  return (cruz * cruz) / q <= 2.5 * 2.5;
}

/** Põe na casa e no espelho dela, só se as duas estiverem livres e longe dos centros. */
function gerarMapa(sim: Sim) {
  const r = sim.rnd;
  const longeDosCentros = (x: number, y: number, folga: number) =>
    CENTRO_DE.every((c) => x < c.gx - folga || x >= c.gx + 3 + folga || y < c.gy - folga || y >= c.gy + 3 + folga);
  /** Nos mapas novos, o que se sorteia não entra no corredor nem perto dos centros (a base fica com espaço para crescer). */
  let reservar = false;
  const reservada = (x: number, y: number) => reservar && (noCorredor(x, y) || !longeDosCentros(x, y, 6));
  const par = (x: number, y: number, por: (x: number, y: number) => void, folga = 4) => {
    const mx = TAMANHO - 1 - x;
    const my = TAMANHO - 1 - y;
    if (!dentro(x, y) || sim.grade[ind(x, y)] !== 0 || sim.grade[ind(mx, my)] !== 0) return false;
    if (!longeDosCentros(x, y, folga) || !longeDosCentros(mx, my, folga)) return false;
    if (reservada(x, y) || reservada(mx, my)) return false;
    por(x, y);
    if (mx !== x || my !== y) por(mx, my);
    return true;
  };
  const arvore = (x: number, y: number) => {
    const f: Fonte = { id: sim.proximoId++, tipo: 'arvore', gx: x, gy: y, qtd: MADEIRA_DA_ARVORE, variante: Math.floor(r() * 3) };
    sim.fontes.push(f);
    sim.porId.set(f.id, f);
    sim.grade[ind(x, y)] = f.id;
  };
  const ouro = (x: number, y: number) => {
    const f: Fonte = { id: sim.proximoId++, tipo: 'ouro', gx: x, gy: y, qtd: OURO_DA_PEDRA, variante: 0 };
    sim.fontes.push(f);
    sim.porId.set(f.id, f);
    sim.grade[ind(x, y)] = f.id;
  };
  const pedra = (x: number, y: number) => {
    sim.grade[ind(x, y)] = -1;
    sim.pedras.push({ gx: x, gy: y });
  };
  /** Um bosque: começa numa casa e cresce para as vizinhas, sorteando. */
  const bosque = (cx: number, cy: number, n: number) => {
    const lista: [number, number][] = [[cx, cy]];
    let feitas = 0;
    for (let tent = 0; tent < n * 8 && feitas < n; tent++) {
      const [bx, by] = lista[Math.floor(r() * lista.length)];
      const dx = Math.floor(r() * 3) - 1;
      const dy = Math.floor(r() * 3) - 1;
      const x = bx + dx;
      const y = by + dy;
      if (par(x, y, arvore)) {
        lista.push([x, y]);
        feitas++;
      }
    }
  };
  const agua = (x: number, y: number) => {
    sim.grade[ind(x, y)] = -2;
    sim.agua.push({ gx: x, gy: y });
  };
  /** Um lago: cresce como o bosque, mas de água. */
  const lagoa = (cx: number, cy: number, n: number) => {
    const lista: [number, number][] = [];
    if (par(cx, cy, agua, 6)) lista.push([cx, cy]);
    let feitas = lista.length;
    for (let tent = 0; tent < n * 10 && feitas < n && lista.length; tent++) {
      const [bx, by] = lista[Math.floor(r() * lista.length)];
      const x = bx + Math.floor(r() * 3) - 1;
      const y = by + Math.floor(r() * 3) - 1;
      if (par(x, y, agua, 6)) {
        lista.push([x, y]);
        feitas++;
      }
    }
  };
  /** Um ponto sorteado na metade de baixo (a da base 0; a outra é o espelho), longe das bordas. */
  const sorteado = () => ({ x: 2 + Math.floor(r() * (TAMANHO - 4)), y: Math.floor(TAMANHO / 2) + Math.floor(r() * (TAMANHO / 2 - 2)) });

  if (sim.mapa === 'campo') {
    // o ouro de cada base (um bloco de 2 × 3), e o do meio, que é de quem chegar
    for (let x = 13; x <= 14; x++) for (let y = 29; y <= 31; y++) par(x, y, ouro);
    for (const [x, y] of [[21, 21], [21, 22]] as [number, number][]) par(x, y, ouro, 0);
    // as pedras (montanhas): obstáculos que desenham o caminho
    for (const [x, y] of [[16, 16], [17, 16], [16, 17], [17, 17], [26, 12], [27, 12], [26, 13], [27, 13], [9, 22], [10, 22], [9, 23], [10, 23]] as [number, number][]) par(x, y, pedra, 2);
    // os bosques: um perto de cada base, um na borda, e os do meio, que fecham as passagens pela metade
    bosque(16, 39, 26);
    bosque(3, 26, 22);
    bosque(11, 41, 10);
    bosque(22, 32, 14);
    bosque(13, 10, 18);
    bosque(31, 22, 10);
    bosque(4, 14, 12);
    for (let i = 0; i < 26; i++) par(Math.floor(r() * TAMANHO), Math.floor(r() * TAMANHO), arvore, 5);
    return;
  }

  // OS MAPAS NOVOS: a base é a de sempre (o ouro de casa, menor no mapa do ouro, e os bosques de perto)...
  if (sim.mapa === 'ouro') for (let x = 13; x <= 14; x++) for (let y = 30; y <= 31; y++) par(x, y, ouro);
  else for (let x = 13; x <= 14; x++) for (let y = 29; y <= 31; y++) par(x, y, ouro);
  bosque(16, 39, 26);
  bosque(3, 26, 22);
  bosque(11, 41, 10);
  // ... e o resto muda com o tipo, longe das bases e fora do corredor
  if (sim.mapa === 'ouro') {
    // a mina grande do meio (4 × 4), com as quinas fechadas por pedras e os lados abertos
    for (let x = 20; x <= 23; x++) for (let y = 20; y <= 23; y++) par(x, y, ouro, 0);
    for (const [x, y] of [[18, 18], [19, 18], [18, 19], [24, 18], [25, 18], [25, 19]] as [number, number][]) par(x, y, pedra, 2);
    reservar = true;
    bosque(22, 34, 14);
    bosque(4, 14, 12);
    bosque(30, 26, 10);
    for (let i = 0; i < 30; i++) par(Math.floor(r() * TAMANHO), Math.floor(r() * TAMANHO), arvore, 5);
    return;
  }
  for (const [x, y] of [[21, 21], [21, 22]] as [number, number][]) par(x, y, ouro, 0);
  reservar = true;
  if (sim.mapa === 'floresta') {
    // bosques grandes e fechados por todo lado: o caminho é o corredor e o que se abrir no machado
    for (let i = 0; i < 9; i++) {
      const p = sorteado();
      bosque(p.x, p.y, 18 + Math.floor(r() * 16));
    }
    for (let i = 0; i < 70; i++) par(Math.floor(r() * TAMANHO), Math.floor(r() * TAMANHO), arvore, 5);
    return;
  }
  // os lagos: três de cada lado, e menos árvores
  lagoa(14, 16, 18 + Math.floor(r() * 8));
  lagoa(27, 34, 12 + Math.floor(r() * 8));
  const p = sorteado();
  lagoa(p.x, p.y, 10 + Math.floor(r() * 8));
  for (let i = 0; i < 4; i++) {
    const q = sorteado();
    bosque(q.x, q.y, 10 + Math.floor(r() * 8));
  }
  for (let i = 0; i < 26; i++) par(Math.floor(r() * TAMANHO), Math.floor(r() * TAMANHO), arvore, 5);
}

/**
 * O MAPA DO 2×2 (20/11/2026): tudo o que se põe vai para a casa e as três imagens dela (o espelho nos dois eixos), então as
 * quatro bases são iguais. A base de cada um é a do 1×1 (o ouro de casa e os bosques de perto); os CORREDORES ligam cada base à
 * do canto oposto (o X pelo meio) e à da aliada (pela borda), e nada do que se sorteia nasce neles.
 */
function gerarMapaDe4(sim: Sim) {
  const r = sim.rnd;
  const M = TAMANHO - 1;
  const C = sim.centros;
  const longeDosCentros = (x: number, y: number, folga: number) =>
    C.every((c) => x < c.gx - folga || x >= c.gx + 3 + folga || y < c.gy - folga || y >= c.gy + 3 + folga);
  const noCorredor4 = (x: number, y: number) =>
    noCorredorEntre(x, y, C[0], C[1]) || noCorredorEntre(x, y, C[2], C[3]) || noCorredorEntre(x, y, C[0], C[2]) || noCorredorEntre(x, y, C[1], C[3]);
  let reservar = false;
  /** Põe na casa e nas três imagens dela, só se todas estiverem livres (e fora do que está reservado). */
  const nas4 = (x: number, y: number, por: (x: number, y: number) => void, folga = 4) => {
    const casas: [number, number][] = [];
    for (const [a, b] of [[x, y], [M - x, y], [x, M - y], [M - x, M - y]] as [number, number][]) if (!casas.some(([c, d]) => c === a && d === b)) casas.push([a, b]);
    for (const [a, b] of casas) {
      if (!dentro(a, b) || sim.grade[ind(a, b)] !== 0 || !longeDosCentros(a, b, folga)) return false;
      if (reservar && (noCorredor4(a, b) || !longeDosCentros(a, b, 6))) return false;
    }
    for (const [a, b] of casas) por(a, b);
    return true;
  };
  const arvore = (x: number, y: number) => {
    const f: Fonte = { id: sim.proximoId++, tipo: 'arvore', gx: x, gy: y, qtd: MADEIRA_DA_ARVORE, variante: Math.floor(r() * 3) };
    sim.fontes.push(f);
    sim.porId.set(f.id, f);
    sim.grade[ind(x, y)] = f.id;
  };
  const ouro = (x: number, y: number) => {
    const f: Fonte = { id: sim.proximoId++, tipo: 'ouro', gx: x, gy: y, qtd: OURO_DA_PEDRA, variante: 0 };
    sim.fontes.push(f);
    sim.porId.set(f.id, f);
    sim.grade[ind(x, y)] = f.id;
  };
  const pedra = (x: number, y: number) => {
    sim.grade[ind(x, y)] = -1;
    sim.pedras.push({ gx: x, gy: y });
  };
  const agua = (x: number, y: number) => {
    sim.grade[ind(x, y)] = -2;
    sim.agua.push({ gx: x, gy: y });
  };
  /** Um bosque (ou um lago): começa numa casa e cresce para as vizinhas, sorteando. */
  const crescer = (cx: number, cy: number, n: number, por: (x: number, y: number) => void, folga: number) => {
    const lista: [number, number][] = [[cx, cy]];
    let feitas = 0;
    for (let tent = 0; tent < n * 8 && feitas < n; tent++) {
      const [bx, by] = lista[Math.floor(r() * lista.length)];
      const x = bx + Math.floor(r() * 3) - 1;
      const y = by + Math.floor(r() * 3) - 1;
      if (nas4(x, y, por, folga)) {
        lista.push([x, y]);
        feitas++;
      }
    }
  };
  /** Um ponto sorteado no quarto de baixo e da esquerda (o da base 0; os outros são o espelho). */
  const sorteado = () => ({ x: 2 + Math.floor(r() * (TAMANHO / 2 - 2)), y: Math.floor(TAMANHO / 2) + Math.floor(r() * (TAMANHO / 2 - 2)) });

  // a base de cada um: o ouro de casa (menor no mapa do ouro) e os bosques de perto
  for (let x = 13; x <= 14; x++) for (let y = sim.mapa === 'ouro' ? 30 : 29; y <= 31; y++) nas4(x, y, ouro);
  crescer(16, 39, 26, arvore, 4);
  crescer(11, 41, 10, arvore, 4);
  // o meio: a mina de quem chegar (maior, e cercada de pedras, no mapa do ouro)
  if (sim.mapa === 'ouro') {
    for (let x = 20; x <= 21; x++) for (let y = 20; y <= 21; y++) nas4(x, y, ouro, 0);
    for (const [x, y] of [[18, 18], [19, 18], [18, 19]] as [number, number][]) nas4(x, y, pedra, 2);
  } else {
    nas4(21, 21, ouro, 0);
    for (const [x, y] of [[16, 16], [17, 16], [16, 17], [17, 17]] as [number, number][]) nas4(x, y, pedra, 2);
  }
  reservar = true;
  const bosques = sim.mapa === 'floresta' ? 6 : sim.mapa === 'lagos' ? 2 : 3;
  const soltas = sim.mapa === 'floresta' ? 40 : sim.mapa === 'lagos' ? 12 : 16;
  if (sim.mapa === 'lagos')
    for (let i = 0; i < 2; i++) {
      const p = sorteado();
      crescer(p.x, p.y, 8 + Math.floor(r() * 8), agua, 6);
    }
  for (let i = 0; i < bosques; i++) {
    const p = sorteado();
    crescer(p.x, p.y, (sim.mapa === 'floresta' ? 14 : 8) + Math.floor(r() * 10), arvore, 4);
  }
  for (let i = 0; i < soltas; i++) nas4(Math.floor(r() * TAMANHO), Math.floor(r() * TAMANHO), arvore, 5);
}

/** As casas de ouro encostadas (nas 8 direções) viram uma mina só, numerada de 1 na ordem das fontes. */
function juntarMinas(sim: Sim) {
  const ouros = sim.fontes.filter((f) => f.tipo === 'ouro');
  const porCasa = new Map(ouros.map((f) => [ind(f.gx, f.gy), f]));
  let n = 0;
  for (const f of ouros) {
    if (sim.minaDe.has(f.id)) continue;
    n++;
    const pilha = [f];
    sim.minaDe.set(f.id, n);
    while (pilha.length) {
      const a = pilha.pop()!;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dentro(a.gx + dx, a.gy + dy)) continue;
          const b = porCasa.get(ind(a.gx + dx, a.gy + dy));
          if (!b || sim.minaDe.has(b.id)) continue;
          sim.minaDe.set(b.id, n);
          pilha.push(b);
        }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Criar e achar
// ---------------------------------------------------------------------------------------------------------------------

function novaUnidade(sim: Sim, dono: Dono, tipo: TipoUnidade, x: number, y: number): Unidade {
  const d = UNIDADES[tipo];
  const vida = Math.round(d.vida * FATOR_DA_ERA[sim.jogadores[dono].era].vidaUnidade);
  const u: Unidade = {
    id: sim.proximoId++,
    tipo,
    dono,
    x,
    y,
    ax: x,
    ay: y,
    rx: 0,
    ry: equipeDe(dono) === 0 ? -1 : 1,
    vida,
    vidaMax: vida,
    ordem: { tipo: 'parado' },
    caminho: [],
    achouEm: -99,
    recarga: 0,
    carga: null,
    trabalho: 0,
    acao: 'parado',
    atacadoPor: 0,
    abrigado: 0,
    antesDoSino: null,
  };
  sim.unidades.push(u);
  sim.porId.set(u.id, u);
  return u;
}

function novoPredio(sim: Sim, dono: Dono, tipo: TipoPredio, gx: number, gy: number): Predio {
  const d = PREDIOS[tipo];
  const era = sim.jogadores[dono].era;
  const vidaMax = Math.round(d.vida * FATOR_DA_ERA[era].vidaPredio);
  const p: Predio = {
    id: sim.proximoId++,
    tipo,
    dono,
    gx,
    gy,
    tam: d.tam,
    vida: Math.max(1, Math.round(vidaMax * 0.1)),
    vidaMax,
    progresso: 0,
    pronto: false,
    fila: [],
    treino: 0,
    pesquisa: 0,
    recarga: 0,
    era,
    reuniao: null,
    sino: false,
    estudo: null,
    estudoPassos: 0,
  };
  sim.predios.push(p);
  sim.porId.set(p.id, p);
  for (let y = gy; y < gy + d.tam; y++) for (let x = gx; x < gx + d.tam; x++) sim.grade[ind(x, y)] = p.id;
  // quem estava em cima sai para a casa livre mais perto
  for (const u of sim.unidades) {
    if (u.x >= gx && u.x < gx + d.tam && u.y >= gy && u.y < gy + d.tam) {
      const c = casaLivrePerto(sim, gx, gy, d.tam, u.dono, u.id);
      u.x = u.ax = c.x + 0.5;
      u.y = u.ay = c.y + 0.5;
      u.caminho = [];
    }
  }
  return p;
}

export function eUnidade(e: Unidade | Predio | Fonte | undefined): e is Unidade {
  return !!e && 'ordem' in e;
}
export function ePredio(e: Unidade | Predio | Fonte | undefined): e is Predio {
  return !!e && 'fila' in e;
}
export function eFonte(e: Unidade | Predio | Fonte | undefined): e is Fonte {
  return !!e && 'qtd' in e;
}

/** A casa livre (e passável para `dono`) mais perto da borda de um retângulo; `salto` espalha quem sai junto. */
function casaLivrePerto(sim: Sim, gx: number, gy: number, tam: number, dono: Dono, salto = 0): { x: number; y: number } {
  const cand: { x: number; y: number }[] = [];
  for (let anel = 1; anel < 12 && cand.length === 0; anel++) {
    for (let y = gy - anel; y < gy + tam + anel; y++) {
      for (let x = gx - anel; x < gx + tam + anel; x++) {
        const borda = x === gx - anel || x === gx + tam + anel - 1 || y === gy - anel || y === gy + tam + anel - 1;
        if (!borda || !dentro(x, y) || !passavel(sim, ind(x, y), dono)) continue;
        cand.push({ x, y });
      }
    }
  }
  if (!cand.length) return { x: gx, y: gy };
  // o lado de baixo (para quem está no canto de cima) primeiro, e um salto pelo número para não sair todo mundo no mesmo lugar
  return cand[salto % cand.length];
}

export function passavel(sim: Sim, i: number, dono: Dono): boolean {
  const g = sim.grade[i];
  if (g === 0) return true;
  if (g < 0) return false;
  const e = sim.porId.get(g);
  return ePredio(e) && e.tipo === 'portao' && aliados(e.dono, dono);
}

export function populacao(sim: Sim, dono: Dono): { usada: number; max: number } {
  let usada = 0;
  for (const u of sim.unidades) if (u.dono === dono) usada++;
  for (const p of sim.predios) if (p.dono === dono && p.fila.length) usada += 0; // a fila não reserva lugar: espera na porta
  let max = 0;
  for (const p of sim.predios) if (p.dono === dono && p.pronto) max += PREDIOS[p.tipo].pop ?? 0;
  return { usada, max: Math.min(POP_MAX, max) };
}

/**
 * O LUGAR DE COLETA de um alvo: a chave (o id da fazenda, ou o número da mina com o sinal trocado) e quantos cabem; null para o
 * que não tem limite (a árvore) ou não é lugar de coleta.
 */
export function lugarDeColeta(sim: Sim, id: number): { chave: number; cap: number } | null {
  const mina = sim.minaDe.get(id);
  if (mina !== undefined) return { chave: -mina, cap: CAPACIDADE.mina };
  const e = sim.porId.get(id);
  if (ePredio(e) && e.tipo === 'fazenda') return { chave: e.id, cap: CAPACIDADE.fazenda };
  return null;
}

/** A chave do lugar em que o trabalhador está colhendo (indo, colhendo ou levando a carga para voltar), ou null. */
function chaveDoTrabalho(sim: Sim, u: Unidade): number | null {
  if (u.tipo !== 'trabalhador' || u.abrigado || u.vida <= 0) return null;
  const o = u.ordem;
  const id = o.tipo === 'coletar' ? o.alvo : o.tipo === 'entregar' ? o.volta : undefined;
  if (id === undefined) return null;
  return lugarDeColeta(sim, id)?.chave ?? null;
}

/** Quantos trabalhadores do dono estão no lugar de coleta (a chave de `lugarDeColeta`), sem contar `fora`. */
export function ocupantes(sim: Sim, dono: Dono, chave: number, fora = 0): number {
  let n = 0;
  for (const u of sim.unidades) if (u.dono === dono && u.id !== fora && chaveDoTrabalho(sim, u) === chave) n++;
  return n;
}

/** Cabe mais este trabalhador (`quem`) no lugar do alvo? Sem limite, sempre. */
export function temVaga(sim: Sim, dono: Dono, alvo: number, quem = 0): boolean {
  const l = lugarDeColeta(sim, alvo);
  return !l || ocupantes(sim, dono, l.chave, quem) < l.cap;
}

/** Outro lugar igual com vaga, perto do alvo cheio: outra fazenda pronta do dono, ou uma casa de ouro de outra mina. */
function vagaPerto(sim: Sim, u: Unidade, alvo: number): number {
  const e = sim.porId.get(alvo);
  if (!e) return 0;
  const c = centroDe(e);
  let melhor = 0;
  let dist = 12 * 12;
  const ver = (id: number, x: number, y: number) => {
    const q = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y);
    if (q < dist && temVaga(sim, u.dono, id, u.id)) {
      dist = q;
      melhor = id;
    }
  };
  if (ePredio(e) && e.tipo === 'fazenda') {
    for (const p of sim.predios) if (p.dono === u.dono && p.tipo === 'fazenda' && p.pronto && p.id !== e.id) ver(p.id, p.gx + 1, p.gy + 1);
  } else if (eFonte(e) && e.tipo === 'ouro') {
    for (const f of sim.fontes) if (f.tipo === 'ouro' && acessivel(sim, f, u.dono)) ver(f.id, f.gx + 0.5, f.gy + 0.5);
  }
  return melhor;
}

/** Manda colher no alvo respeitando a capacidade (ou noutro igual com vaga, perto); sem nenhum, false e nada muda. */
function irColetar(sim: Sim, u: Unidade, alvo: number): boolean {
  const onde = temVaga(sim, u.dono, alvo, u.id) ? alvo : vagaPerto(sim, u, alvo);
  if (!onde) return false;
  u.ordem = { tipo: 'coletar', alvo: onde, volta: onde };
  return true;
}

export function podePagar(sim: Sim, dono: Dono, custo: Custo): boolean {
  const r = sim.jogadores[dono].recursos;
  return RECURSOS.every((k) => r[k] >= (custo[k] ?? 0));
}
function pagar(sim: Sim, dono: Dono, custo: Custo, vezes = 1) {
  const r = sim.jogadores[dono].recursos;
  for (const k of RECURSOS) r[k] -= (custo[k] ?? 0) * vezes;
}

/** Dá para pôr este prédio aqui? Dentro do mapa, nas casas livres, onde o dono já viu, e com a era certa. */
export function podeConstruir(sim: Sim, dono: Dono, tipo: TipoPredio, gx: number, gy: number): boolean {
  const d = PREDIOS[tipo];
  if (!d.construivel || sim.jogadores[dono].era < d.era) return false;
  if (gx < 0 || gy < 0 || gx + d.tam > TAMANHO || gy + d.tam > TAMANHO) return false;
  const j = sim.jogadores[dono];
  for (let y = gy; y < gy + d.tam; y++)
    for (let x = gx; x < gx + d.tam; x++) {
      const i = ind(x, y);
      if (sim.grade[i] !== 0 || !j.explorado[i]) return false;
    }
  if (tipo === 'maravilha' && sim.predios.some((p) => p.dono === dono && p.tipo === 'maravilha')) return false;
  return true;
}

/** As casas de uma linha reta de muralha (a direção que mais anda manda; a outra é a da primeira casa). */
export function casasDaMuralha(gx0: number, gy0: number, gx1: number, gy1: number): { x: number; y: number }[] {
  const lista: { x: number; y: number }[] = [];
  if (Math.abs(gx1 - gx0) >= Math.abs(gy1 - gy0)) {
    const passo = gx1 >= gx0 ? 1 : -1;
    for (let x = gx0; x !== gx1 + passo && lista.length < 24; x += passo) lista.push({ x, y: gy0 });
  } else {
    const passo = gy1 >= gy0 ? 1 : -1;
    for (let y = gy0; y !== gy1 + passo && lista.length < 24; y += passo) lista.push({ x: gx0, y });
  }
  return lista;
}

/** A distância de um ponto até a borda de um prédio (0 dentro), ou até o centro de uma unidade. */
export function distancia(x: number, y: number, e: Unidade | Predio | Fonte): number {
  if (eUnidade(e)) {
    const dx = e.x - x;
    const dy = e.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const tam = ePredio(e) ? e.tam : 1;
  const dx = Math.max(e.gx - x, 0, x - (e.gx + tam));
  const dy = Math.max(e.gy - y, 0, y - (e.gy + tam));
  return Math.sqrt(dx * dx + dy * dy);
}

export function centroDe(e: Unidade | Predio | Fonte): { x: number; y: number } {
  if (eUnidade(e)) return { x: e.x, y: e.y };
  const tam = ePredio(e) ? e.tam : 1;
  return { x: e.gx + tam / 2, y: e.gy + tam / 2 };
}

// ---------------------------------------------------------------------------------------------------------------------
// O caminho: A* na grade, 8 direções, sem cortar quina
// ---------------------------------------------------------------------------------------------------------------------

const N = TAMANHO * TAMANHO;
const custoG = new Float64Array(N);
const veio = new Int32Array(N);
const marca = new Int32Array(N);
const fechado = new Int32Array(N);
let rodada = 0;
const heap: number[] = [];
const prioridade = new Float64Array(N);
function empurrar(i: number) {
  heap.push(i);
  let k = heap.length - 1;
  while (k > 0) {
    const pai = (k - 1) >> 1;
    if (prioridade[heap[pai]] < prioridade[heap[k]] || (prioridade[heap[pai]] === prioridade[heap[k]] && heap[pai] < heap[k])) break;
    [heap[pai], heap[k]] = [heap[k], heap[pai]];
    k = pai;
  }
}
function tirar(): number {
  const topo = heap[0];
  const ult = heap.pop()!;
  if (heap.length) {
    heap[0] = ult;
    let k = 0;
    for (;;) {
      const a = 2 * k + 1;
      const b = a + 1;
      let m = k;
      const menor = (p: number, q: number) => prioridade[heap[p]] < prioridade[heap[q]] || (prioridade[heap[p]] === prioridade[heap[q]] && heap[p] < heap[q]);
      if (a < heap.length && menor(a, m)) m = a;
      if (b < heap.length && menor(b, m)) m = b;
      if (m === k) break;
      [heap[m], heap[k]] = [heap[k], heap[m]];
      k = m;
    }
  }
  return topo;
}

const VIZ: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAG],
  [1, -1, DIAG],
  [-1, 1, DIAG],
  [-1, -1, DIAG],
];

/**
 * O caminho (as casas, sem a de saída) de (x, y) até o retângulo [x0, x1] × [y0, y1] (inclusive). `encostar`: basta chegar a
 * uma casa vizinha dele (para o prédio, a árvore, quem se ataca); senão, entrar nele. Sem caminho, vai até onde chegou mais perto.
 */
export function acharCaminho(sim: Sim, dono: Dono, x: number, y: number, x0: number, y0: number, x1: number, y1: number, encostar: boolean): number[] {
  rodada++;
  heap.length = 0;
  const sx = Math.min(TAMANHO - 1, Math.max(0, Math.floor(x)));
  const sy = Math.min(TAMANHO - 1, Math.max(0, Math.floor(y)));
  const inicio = ind(sx, sy);
  const h = (cx: number, cy: number) => {
    const dx = Math.max(x0 - cx, 0, cx - x1);
    const dy = Math.max(y0 - cy, 0, cy - y1);
    const a = Math.max(dx, dy);
    const b = Math.min(dx, dy);
    return a - b + b * DIAG;
  };
  const chegou = (cx: number, cy: number) => {
    const dx = Math.max(x0 - cx, 0, cx - x1);
    const dy = Math.max(y0 - cy, 0, cy - y1);
    return encostar ? dx <= 1 && dy <= 1 : dx === 0 && dy === 0;
  };
  custoG[inicio] = 0;
  veio[inicio] = -1;
  marca[inicio] = rodada;
  prioridade[inicio] = h(sx, sy);
  empurrar(inicio);
  let melhor = inicio;
  let melhorH = h(sx, sy);
  let achou = -1;
  let expandidas = 0;
  while (heap.length && expandidas < 2500) {
    const i = tirar();
    if (fechado[i] === rodada) continue;
    fechado[i] = rodada;
    expandidas++;
    const cx = i % TAMANHO;
    const cy = (i - cx) / TAMANHO;
    if (chegou(cx, cy)) {
      achou = i;
      break;
    }
    const hi = h(cx, cy);
    if (hi < melhorH) {
      melhorH = hi;
      melhor = i;
    }
    for (const [dx, dy, c] of VIZ) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!dentro(nx, ny)) continue;
      const ni = ind(nx, ny);
      if (fechado[ni] === rodada || !passavel(sim, ni, dono)) continue;
      if (dx && dy && (!passavel(sim, ind(cx + dx, cy), dono) || !passavel(sim, ind(cx, cy + dy), dono))) continue;
      const g = custoG[i] + c;
      if (marca[ni] === rodada && g >= custoG[ni]) continue;
      marca[ni] = rodada;
      custoG[ni] = g;
      veio[ni] = i;
      prioridade[ni] = g + h(nx, ny);
      empurrar(ni);
    }
  }
  let fim = achou >= 0 ? achou : melhor;
  const lista: number[] = [];
  while (fim !== inicio && fim >= 0) {
    lista.push(fim);
    fim = veio[fim];
  }
  return lista.reverse();
}

// ---------------------------------------------------------------------------------------------------------------------
// Os comandos
// ---------------------------------------------------------------------------------------------------------------------

/** Põe um comando na fila: ele vale no próximo passo (o mesmo para todo mundo, no lockstep). */
export function comandar(sim: Sim, dono: Dono, c: Comando) {
  sim.fila.push({ dono, c });
}

function minhas(sim: Sim, dono: Dono, ids: number[]): Unidade[] {
  const lista: Unidade[] = [];
  const vistos = new Set<number>();
  for (const id of ids.slice(0, 80)) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const u = sim.porId.get(id);
    if (eUnidade(u) && u.dono === dono && !u.abrigado) lista.push(u);
  }
  return lista;
}

/** Espalha quem vai junto em volta do ponto, em anéis, para não brigarem pela mesma casa. */
function espalhar(n: number, k: number): { dx: number; dy: number } {
  if (k === 0 || n === 1) return { dx: 0, dy: 0 };
  let anel = 1;
  let antes = 1;
  while (k >= antes + anel * 6) {
    antes += anel * 6;
    anel++;
  }
  const pos = k - antes;
  const total = anel * 6;
  // os pontos do anel sem seno: num quadrado de lado 2·anel, andando pela borda
  const lado = anel * 2;
  const perimetro = lado * 4;
  const t = (pos / total) * perimetro;
  let dx: number;
  let dy: number;
  if (t < lado) {
    dx = -anel + t;
    dy = -anel;
  } else if (t < 2 * lado) {
    dx = anel;
    dy = -anel + (t - lado);
  } else if (t < 3 * lado) {
    dx = anel - (t - 2 * lado);
    dy = anel;
  } else {
    dx = -anel;
    dy = anel - (t - 3 * lado);
  }
  return { dx: dx * 0.75, dy: dy * 0.75 };
}

function aplicar(sim: Sim, dono: Dono, c: Comando) {
  const j = sim.jogadores[dono];
  switch (c.t) {
    case 'mover': {
      if (typeof c.x !== 'number' || typeof c.y !== 'number' || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      const us = minhas(sim, dono, c.ids);
      us.forEach((u, k) => {
        const e = espalhar(us.length, k);
        const x = Math.min(TAMANHO - 0.5, Math.max(0.5, c.x + e.dx));
        const y = Math.min(TAMANHO - 0.5, Math.max(0.5, c.y + e.dy));
        u.ordem = { tipo: 'mover', x, y, atacando: !!c.atacando && UNIDADES[u.tipo].combate };
        u.caminho = [];
        u.achouEm = -99;
      });
      return;
    }
    case 'parar':
      for (const u of minhas(sim, dono, c.ids)) {
        u.ordem = { tipo: 'parado' };
        u.caminho = [];
      }
      return;
    case 'alvo': {
      const alvo = sim.porId.get(c.alvo);
      if (!alvo || (eUnidade(alvo) && alvo.abrigado)) return;
      let cheio = false;
      for (const u of minhas(sim, dono, c.ids)) {
        u.caminho = [];
        u.achouEm = -99;
        if (eFonte(alvo)) {
          if (u.tipo !== 'trabalhador') u.ordem = { tipo: 'mover', x: alvo.gx + 0.5, y: alvo.gy + 0.5 };
          else if (!irColetar(sim, u, alvo.id)) {
            // a mina cheia, e nenhuma com vaga perto: vai até ela e fica parado ao lado
            u.ordem = { tipo: 'mover', x: alvo.gx + 0.5, y: alvo.gy + 0.5 };
            cheio = true;
          }
        } else if (!aliados(alvo.dono, dono)) {
          u.ordem = { tipo: 'atacar', alvo: alvo.id };
        } else if (ePredio(alvo) && u.tipo === 'trabalhador' && alvo.dono === dono) {
          if (!alvo.pronto) u.ordem = { tipo: 'construir', alvo: alvo.id };
          else if (alvo.tipo === 'fazenda') {
            if (!irColetar(sim, u, alvo.id)) {
              u.ordem = { tipo: 'mover', x: centroDe(alvo).x, y: alvo.gy + alvo.tam + 0.5 };
              cheio = true;
            }
          }
          else if (alvo.tipo === 'centro' && u.carga) u.ordem = { tipo: 'entregar' };
          else u.ordem = { tipo: 'mover', x: centroDe(alvo).x, y: alvo.gy + alvo.tam + 0.5 };
        } else {
          const p = centroDe(alvo);
          u.ordem = { tipo: 'mover', x: p.x, y: p.y };
        }
      }
      if (cheio) sim.eventos.push({ t: 'cheio', dono, id: alvo.id });
      return;
    }
    case 'sino': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono || p.tipo !== 'centro' || !p.pronto) return;
      if (!p.sino) {
        p.sino = true;
        for (const u of sim.unidades) {
          if (u.dono !== dono || u.tipo !== 'trabalhador' || u.abrigado || u.vida <= 0) continue;
          if (u.ordem.tipo !== 'abrigar') u.antesDoSino = u.ordem;
          u.ordem = { tipo: 'abrigar', alvo: p.id };
          u.caminho = [];
          u.achouEm = -99;
        }
      } else soltarDoSino(sim, p);
      sim.eventos.push({ t: 'sino', dono, tocado: p.sino });
      return;
    }
    case 'construir': {
      const d = PREDIOS[c.tipo];
      if (!d || !Number.isInteger(c.gx) || !Number.isInteger(c.gy)) return;
      const us = minhas(sim, dono, c.ids).filter((u) => u.tipo === 'trabalhador');
      if (!us.length || !podeConstruir(sim, dono, c.tipo, c.gx, c.gy) || !podePagar(sim, dono, d.custo)) return;
      pagar(sim, dono, d.custo);
      const p = novoPredio(sim, dono, c.tipo, c.gx, c.gy);
      for (const u of us) {
        u.ordem = { tipo: 'construir', alvo: p.id };
        u.caminho = [];
        u.achouEm = -99;
      }
      return;
    }
    case 'muralha': {
      if (![c.gx0, c.gy0, c.gx1, c.gy1].every(Number.isInteger)) return;
      const us = minhas(sim, dono, c.ids).filter((u) => u.tipo === 'trabalhador');
      if (!us.length) return;
      let primeira: Predio | null = null;
      for (const casa of casasDaMuralha(c.gx0, c.gy0, c.gx1, c.gy1)) {
        if (!podeConstruir(sim, dono, 'muralha', casa.x, casa.y) || !podePagar(sim, dono, PREDIOS.muralha.custo)) continue;
        pagar(sim, dono, PREDIOS.muralha.custo);
        const p = novoPredio(sim, dono, 'muralha', casa.x, casa.y);
        primeira ??= p;
      }
      if (!primeira) return;
      for (const u of us) {
        u.ordem = { tipo: 'construir', alvo: primeira.id };
        u.caminho = [];
        u.achouEm = -99;
      }
      return;
    }
    case 'treinar': {
      const p = sim.porId.get(c.predio);
      const d = UNIDADES[c.unidade];
      if (!ePredio(p) || !d || p.dono !== dono || !p.pronto || d.de !== p.tipo || j.era < d.era || p.fila.length >= 5) return;
      if (!podePagar(sim, dono, d.custo)) return;
      pagar(sim, dono, d.custo);
      p.fila.push(c.unidade);
      return;
    }
    case 'reuniao': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono || typeof c.x !== 'number' || typeof c.y !== 'number' || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      const x = Math.min(TAMANHO - 0.5, Math.max(0.5, c.x));
      const y = Math.min(TAMANHO - 0.5, Math.max(0.5, c.y));
      const alvo = typeof c.alvo === 'number' && sim.porId.has(c.alvo) && c.alvo !== p.id ? c.alvo : undefined;
      p.reuniao = alvo === undefined ? { x, y } : { x, y, alvo };
      return;
    }
    case 'cancelar': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono) return;
      if (p.pesquisa > 0) {
        pagar(sim, dono, proximaEra(j.era)!.custo, -1);
        p.pesquisa = 0;
        return;
      }
      if (p.estudo) {
        pagar(sim, dono, MELHORIAS[p.estudo].custo, -1);
        p.estudo = null;
        p.estudoPassos = 0;
        return;
      }
      const tipo = p.fila.pop();
      if (!tipo) return;
      pagar(sim, dono, UNIDADES[tipo].custo, -1);
      if (!p.fila.length) p.treino = 0;
      return;
    }
    case 'era': {
      const p = sim.porId.get(c.predio);
      const prox = proximaEra(j.era);
      if (!ePredio(p) || p.dono !== dono || p.tipo !== 'centro' || !p.pronto || !prox || p.pesquisa > 0) return;
      // a era 3 pede um mercado pronto; e um avanço por vez, mesmo com dois centros
      if (!podeAvancarEra(sim, dono) || sim.predios.some((q) => q.dono === dono && q.pesquisa > 0)) return;
      if (!podePagar(sim, dono, prox.custo)) return;
      pagar(sim, dono, prox.custo);
      p.pesquisa = 1;
      return;
    }
    case 'melhorar': {
      const p = sim.porId.get(c.predio);
      const d = MELHORIAS[c.m];
      if (!ePredio(p) || p.dono !== dono || p.tipo !== 'ferreiro' || !p.pronto || p.estudo || !d || (d.era ?? 1) > j.era) return;
      // a mesma melhoria em dois ferreiros ao mesmo tempo também não
      if (temMelhoria(sim, dono, c.m) || sim.predios.some((q) => q.dono === dono && q.estudo === c.m)) return;
      if (!podePagar(sim, dono, d.custo)) return;
      pagar(sim, dono, d.custo);
      p.estudo = c.m;
      p.estudoPassos = 0;
      return;
    }
    case 'pontos': {
      // só depois dos 20 minutos, e só de quem vota
      if (sim.passo + 1 < PASSOS_SUGERIDOS || !sim.votam[dono]) return;
      if (c.aceita) sim.votos |= 1 << dono;
      else sim.votos = 0;
      sim.eventos.push({ t: 'pontos', dono, aceita: !!c.aceita });
      return;
    }
    case 'largar':
      sim.votam[dono] = false;
      sim.votos &= ~(1 << dono);
      return;
    case 'trocar': {
      const p = sim.porId.get(c.predio);
      if (!ePredio(p) || p.dono !== dono || p.tipo !== 'mercado' || !p.pronto || c.de === c.para) return;
      if (!RECURSOS.includes(c.de) || !RECURSOS.includes(c.para) || j.recursos[c.de] < MERCADO.lote) return;
      const ganho = precoDaTroca(sim, dono, c.de, c.para);
      j.recursos[c.de] -= MERCADO.lote;
      j.recursos[c.para] += ganho;
      j.precos[c.de] = Math.max(MERCADO.min, j.precos[c.de] - MERCADO.passo);
      j.precos[c.para] = Math.min(MERCADO.max, j.precos[c.para] + MERCADO.passo);
      sim.eventos.push({ t: 'troca', dono, de: c.de, para: c.para, ganho });
      return;
    }
  }
}

/** Quanto de `para` um lote de `de` dá no mercado agora (sempre inteiro). */
export function precoDaTroca(sim: Sim, dono: Dono, de: Recurso, para: Recurso): number {
  const j = sim.jogadores[dono];
  return Math.floor((MERCADO.taxa * j.precos[de]) / j.precos[para]);
}

export function temMelhoria(sim: Sim, dono: Dono, m: Melhoria): boolean {
  return (sim.jogadores[dono].melhorias & (1 << ORDEM_DAS_MELHORIAS.indexOf(m))) !== 0;
}

/** A melhoria de ataque ou armadura da linha de `tipo`, se o dono já a tem. */
function comMelhoria(sim: Sim, dono: Dono, tipo: TipoUnidade, qual: 'ataque' | 'armadura'): boolean {
  const linha = UNIDADES[tipo].linha ?? tipo;
  for (const m of ORDEM_DAS_MELHORIAS) {
    const d = MELHORIAS[m];
    if (d.linha === linha && d.tipo === qual && temMelhoria(sim, dono, m)) return true;
  }
  return false;
}

/** Quanto o trabalhador leva de uma vez (o carrinho da era 3 leva mais). */
export function cargaDe(sim: Sim, dono: Dono): number {
  return temMelhoria(sim, dono, 'carrinho') ? EFEITO_DAS_MELHORIAS.carga : CARGA;
}

/** Os passos de trabalho para colher uma unidade do recurso (a melhoria de coleta tira alguns). */
export function ritmoDe(sim: Sim, dono: Dono, rec: Recurso): number {
  for (const m of ORDEM_DAS_MELHORIAS) {
    const d = MELHORIAS[m];
    if (d.tipo === 'coleta' && d.recurso === rec && temMelhoria(sim, dono, m)) return RITMO[rec] - EFEITO_DAS_MELHORIAS.coleta;
  }
  return RITMO[rec];
}

/**
 * O COMANDO QUE VEIO DE FORA (a rede: o servidor refaz a partida do Solo e a sala troca comandos), limpo: só os campos que a
 * simulação lê, com os tipos certos. Qualquer coisa estranha vira null e não entra.
 */
export function limparComando(c: unknown): Comando | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;
  const int = (v: unknown) => Number.isInteger(v) && Math.abs(v as number) < 1e9;
  const ids = (v: unknown) => (Array.isArray(v) && v.length <= 80 && v.every(int) ? (v as number[]).slice() : null);
  const de = <K extends string>(v: unknown, lista: Record<K, unknown>) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(lista, v) ? (v as K) : null);
  const rec = (v: unknown) => (typeof v === 'string' && (RECURSOS as string[]).includes(v) ? (v as Recurso) : null);
  switch (o.t) {
    case 'mover': {
      const l = ids(o.ids);
      if (!l || !num(o.x) || !num(o.y)) return null;
      return o.atacando ? { t: 'mover', ids: l, x: o.x as number, y: o.y as number, atacando: true } : { t: 'mover', ids: l, x: o.x as number, y: o.y as number };
    }
    case 'alvo': {
      const l = ids(o.ids);
      return l && int(o.alvo) ? { t: 'alvo', ids: l, alvo: o.alvo as number } : null;
    }
    case 'parar': {
      const l = ids(o.ids);
      return l ? { t: 'parar', ids: l } : null;
    }
    case 'pontos':
      return { t: 'pontos', aceita: o.aceita === true };
    case 'largar':
      return { t: 'largar' };
    case 'construir': {
      const l = ids(o.ids);
      const tipo = de(o.tipo, PREDIOS);
      return l && tipo && int(o.gx) && int(o.gy) ? { t: 'construir', ids: l, tipo, gx: o.gx as number, gy: o.gy as number } : null;
    }
    case 'muralha': {
      const l = ids(o.ids);
      return l && int(o.gx0) && int(o.gy0) && int(o.gx1) && int(o.gy1)
        ? { t: 'muralha', ids: l, gx0: o.gx0 as number, gy0: o.gy0 as number, gx1: o.gx1 as number, gy1: o.gy1 as number }
        : null;
    }
    case 'treinar': {
      const u = de(o.unidade, UNIDADES);
      return int(o.predio) && u ? { t: 'treinar', predio: o.predio as number, unidade: u } : null;
    }
    case 'cancelar':
    case 'era':
    case 'sino':
      return int(o.predio) ? { t: o.t, predio: o.predio as number } : null;
    case 'reuniao': {
      if (!int(o.predio) || !num(o.x) || !num(o.y)) return null;
      const base = { t: 'reuniao' as const, predio: o.predio as number, x: o.x as number, y: o.y as number };
      return int(o.alvo) ? { ...base, alvo: o.alvo as number } : base;
    }
    case 'melhorar': {
      const m = de(o.m, MELHORIAS);
      return int(o.predio) && m ? { t: 'melhorar', predio: o.predio as number, m } : null;
    }
    case 'trocar': {
      const a = rec(o.de);
      const b = rec(o.para);
      return int(o.predio) && a && b ? { t: 'trocar', predio: o.predio as number, de: a, para: b } : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// O passo
// ---------------------------------------------------------------------------------------------------------------------

export function passo(sim: Sim) {
  sim.eventos = [];
  if (sim.vencedor !== null) return;
  const fila = sim.fila;
  sim.fila = [];
  for (const { dono, c } of fila) aplicar(sim, dono, c);
  for (const u of sim.unidades) {
    u.ax = u.x;
    u.ay = u.y;
  }
  for (const u of sim.unidades) if (u.vida > 0) pensar(sim, u);
  separar(sim);
  for (const p of sim.predios) if (p.vida > 0) predioPensa(sim, p);
  limparMortos(sim);
  if (sim.passo % 5 === 0) verNevoa(sim);
  conferirFim(sim);
  sim.passo++;
  if (sim.passo % AMOSTRA_DO_HISTORICO === 0 || sim.vencedor !== null) amostrar(sim);
}

function predioPensa(sim: Sim, p: Predio) {
  const j = sim.jogadores[p.dono];
  if (!p.pronto) return;
  const d = PREDIOS[p.tipo];
  // o avanço de era segura a fila do centro
  if (p.pesquisa > 0) {
    p.pesquisa++;
    if (p.pesquisa >= proximaEra(j.era)!.tempo) {
      p.pesquisa = 0;
      avancarEra(sim, p.dono);
    }
  } else if (p.fila.length) {
    const tipo = p.fila[0];
    if (p.treino < UNIDADES[tipo].tempo) p.treino++;
    if (p.treino >= UNIDADES[tipo].tempo) {
      const pop = populacao(sim, p.dono);
      if (pop.usada < pop.max) {
        const c = casaLivrePerto(sim, p.gx, p.gy, p.tam, p.dono, sim.passo);
        const u = novaUnidade(sim, p.dono, tipo, c.x + 0.5, c.y + 0.5);
        p.fila.shift();
        p.treino = 0;
        sim.eventos.push({ t: 'treinou', id: u.id, dono: p.dono, tipo });
        // quem nasce vai ao ponto de reunião (o alvo que sumiu vira só o lugar)
        const r = p.reuniao;
        if (r) {
          if (r.alvo !== undefined && sim.porId.has(r.alvo)) aplicar(sim, p.dono, { t: 'alvo', ids: [u.id], alvo: r.alvo });
          else aplicar(sim, p.dono, { t: 'mover', ids: [u.id], x: r.x, y: r.y });
        }
      }
    }
  }
  // o ferreiro estuda
  if (p.estudo) {
    p.estudoPassos++;
    if (p.estudoPassos >= MELHORIAS[p.estudo].tempo) {
      j.melhorias |= 1 << ORDEM_DAS_MELHORIAS.indexOf(p.estudo);
      sim.eventos.push({ t: 'melhoria', dono: p.dono, m: p.estudo });
      p.estudo = null;
      p.estudoPassos = 0;
    }
  }
  // quem atira: a torre e o centro
  if (d.ataque) {
    if (p.recarga > 0) p.recarga--;
    else {
      const c = centroDe(p);
      const perto: { u: Unidade; dist: number }[] = [];
      for (const u of sim.unidades) {
        if (aliados(u.dono, p.dono) || u.vida <= 0 || u.abrigado) continue;
        const dist = distancia(u.x, u.y, p);
        if (dist <= d.alcance!) perto.push({ u, dist });
      }
      if (perto.length) {
        perto.sort((a, b) => a.dist - b.dist || a.u.id - b.u.id);
        // o sino: quem está abrigado no centro atira junto (uma flecha a mais a cada 2, até 5 a mais), nos mais perto, em roda
        let dentro = 0;
        if (p.tipo === 'centro') for (const u of sim.unidades) if (u.abrigado === p.id) dentro++;
        const flechas = 1 + Math.min(FLECHAS_DO_SINO.max, Math.floor(dentro / FLECHAS_DO_SINO.cada));
        const dano = d.ataque * FATOR_DA_ERA[j.era].ataque;
        for (let k = 0; k < flechas; k++) {
          const alvo = perto[k % perto.length].u;
          ferir(sim, alvo, dano, p.id);
          sim.eventos.push({ t: 'golpe', de: p.id, alvo: alvo.id, dono: p.dono, arma: p.tipo === 'bastiao' ? 'bala' : 'flecha', x0: c.x, y0: c.y, x1: alvo.x, y1: alvo.y });
        }
        p.recarga = d.recarga!;
      }
    }
  }
}

/** O segundo toque do sino (ou o centro que caiu): quem está dentro sai pela porta e volta ao que fazia; quem ia, também. */
function soltarDoSino(sim: Sim, p: Predio) {
  p.sino = false;
  let k = 0;
  for (const u of sim.unidades) {
    const dentro = u.abrigado === p.id;
    const indo = u.ordem.tipo === 'abrigar' && u.ordem.alvo === p.id;
    if (!dentro && !indo) continue;
    if (dentro) {
      u.abrigado = 0;
      const c = casaLivrePerto(sim, p.gx, p.gy, p.tam, u.dono, u.id + k++);
      u.x = u.ax = c.x + 0.5;
      u.y = u.ay = c.y + 0.5;
    }
    const antes = u.antesDoSino;
    u.antesDoSino = null;
    u.ordem = antes && antes.tipo !== 'abrigar' ? antes : { tipo: 'parado' };
    u.caminho = [];
    u.achouEm = -99;
  }
}

function avancarEra(sim: Sim, dono: Dono) {
  const j = sim.jogadores[dono];
  j.era = (j.era + 1) as Era;
  for (const u of sim.unidades)
    if (u.dono === dono) {
      const novo = Math.round(UNIDADES[u.tipo].vida * FATOR_DA_ERA[j.era].vidaUnidade);
      u.vida += novo - u.vidaMax;
      u.vidaMax = novo;
    }
  for (const p of sim.predios)
    if (p.dono === dono) {
      const novo = Math.round(PREDIOS[p.tipo].vida * FATOR_DA_ERA[j.era].vidaPredio);
      p.vida = Math.round((p.vida * novo) / p.vidaMax);
      p.vidaMax = novo;
      p.era = j.era;
    }
  sim.eventos.push({ t: 'era', dono });
}

function ferir(sim: Sim, alvo: Unidade | Predio, dano: number, de: number) {
  if (eUnidade(alvo) && comMelhoria(sim, alvo.dono, alvo.tipo, 'armadura')) dano *= EFEITO_DAS_MELHORIAS.armadura;
  // a cota de malha (era 3): toda tropa leva menos
  if (eUnidade(alvo) && UNIDADES[alvo.tipo].combate && temMelhoria(sim, alvo.dono, 'cota')) dano *= EFEITO_DAS_MELHORIAS.armaduraGeral;
  alvo.vida -= dano;
  if (eUnidade(alvo)) {
    alvo.atacadoPor = de;
    // quem estava parado revida (o trabalhador também)
    if (alvo.ordem.tipo === 'parado' && alvo.vida > 0) {
      const quem = sim.porId.get(de);
      if (eUnidade(quem)) alvo.ordem = { tipo: 'atacar', alvo: de };
    }
  }
  const dono = alvo.dono;
  if (sim.passo - sim.avisoEm[dono] > 150) {
    sim.avisoEm[dono] = sim.passo;
    const c = centroDe(alvo);
    sim.eventos.push({ t: 'atacado', dono, x: c.x, y: c.y });
  }
}

function danoDe(sim: Sim, u: Unidade, alvo: Unidade | Predio): number {
  const d = UNIDADES[u.tipo];
  let dano = ePredio(alvo) ? d.contraPredio : d.ataque;
  if (eUnidade(alvo) && d.bonus && d.bonus.contra === (UNIDADES[alvo.tipo].linha ?? alvo.tipo)) dano *= d.bonus.vezes;
  if (sim.jogadores[u.dono].era >= 2) dano *= FATOR_DA_ERA[sim.jogadores[u.dono].era].ataque;
  if (comMelhoria(sim, u.dono, u.tipo, 'ataque')) dano *= EFEITO_DAS_MELHORIAS.ataque;
  // a forja (era 3): toda tropa bate mais
  if (d.combate && temMelhoria(sim, u.dono, 'forja')) dano *= EFEITO_DAS_MELHORIAS.ataqueGeral;
  return dano;
}

/** O inimigo mais perto que `u` enxerga (unidades primeiro; a catapulta prefere prédio). */
function procurarInimigo(sim: Sim, u: Unidade, raio: number): number {
  const d = UNIDADES[u.tipo];
  let melhorU = 0;
  let distU = Infinity;
  let melhorP = 0;
  let distP = Infinity;
  for (const o of sim.unidades) {
    if (aliados(o.dono, u.dono) || o.vida <= 0 || o.abrigado) continue;
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    const q = dx * dx + dy * dy;
    if (q <= raio * raio && q < distU) {
      distU = q;
      melhorU = o.id;
    }
  }
  if (melhorU && !ehCerco(u.tipo)) return melhorU;
  for (const p of sim.predios) {
    if (aliados(p.dono, u.dono) || p.vida <= 0) continue;
    const dist = distancia(u.x, u.y, p);
    if (dist <= raio + (ehCerco(u.tipo) ? 2 : 0) && dist < distP) {
      distP = dist;
      melhorP = p.id;
    }
  }
  if (ehCerco(u.tipo)) return melhorP || (d.alcanceMin < Math.sqrt(distU) ? melhorU : 0);
  return melhorP;
}

/**
 * Vai até encostar em `alvo`: pelo caminho do A* (achado de novo a cada `refazerCada` passos, para quem persegue quem anda) e,
 * quando o caminho acaba sem encostar (a casa vizinha é grande: o alvo pode estar a uma casa e meia), em linha reta até a borda.
 */
function seguir(sim: Sim, u: Unidade, alvo: Unidade | Predio | Fonte, refazerCada = 0) {
  const [x0, y0, x1, y1] = retangulo(alvo);
  if (!u.caminho.length || (refazerCada && sim.passo - u.achouEm >= refazerCada)) {
    if (sim.passo - u.achouEm >= 3 || u.caminho.length) {
      u.caminho = acharCaminho(sim, u.dono, u.x, u.y, x0, y0, x1, y1, true);
      // sem caminho (cercado, ou já ao lado): só tenta de novo daqui a 2 s, e vai em linha reta enquanto isso
      u.achouEm = u.caminho.length ? sim.passo : sim.passo + 17;
    }
  }
  if (u.caminho.length) {
    andar(sim, u);
    return;
  }
  // o último pedaço, em linha reta até o ponto mais perto do alvo
  let px: number;
  let py: number;
  if (eUnidade(alvo)) {
    px = alvo.x;
    py = alvo.y;
  } else {
    const tam = ePredio(alvo) ? alvo.tam : 1;
    px = Math.min(Math.max(u.x, alvo.gx), alvo.gx + tam);
    py = Math.min(Math.max(u.y, alvo.gy), alvo.gy + tam);
  }
  const dx = px - u.x;
  const dy = py - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.0001) return;
  const v = Math.min(UNIDADES[u.tipo].velocidade, Math.max(0, d - 0.5));
  if (v <= 0) return;
  const nx = u.x + (dx / d) * v;
  const ny = u.y + (dy / d) * v;
  u.rx = dx / d;
  u.ry = dy / d;
  if (!passavel(sim, ind(Math.floor(nx), Math.floor(ny)), u.dono)) return;
  u.x = nx;
  u.y = ny;
  u.acao = 'andando';
}

/** Anda pelo caminho. Devolve true quando não há mais o que andar. */
function andar(sim: Sim, u: Unidade, destino?: { x: number; y: number }): boolean {
  if (!u.caminho.length) return true;
  const prox = u.caminho[0];
  if (!passavel(sim, prox, u.dono)) {
    u.caminho = [];
    u.achouEm = -99;
    return false;
  }
  const px = prox % TAMANHO;
  let tx = px + 0.5;
  let ty = (prox - px) / TAMANHO + 0.5;
  if (destino && u.caminho.length === 1) {
    tx = destino.x;
    ty = destino.y;
  }
  const dx = tx - u.x;
  const dy = ty - u.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const v = UNIDADES[u.tipo].velocidade;
  u.acao = 'andando';
  if (dist <= v) {
    u.x = tx;
    u.y = ty;
    u.caminho.shift();
  } else {
    u.x += (dx / dist) * v;
    u.y += (dy / dist) * v;
  }
  if (dist > 0.0001) {
    u.rx = dx / dist;
    u.ry = dy / dist;
  }
  return u.caminho.length === 0;
}

function olhar(u: Unidade, x: number, y: number) {
  const dx = x - u.x;
  const dy = y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.0001) {
    u.rx = dx / d;
    u.ry = dy / d;
  }
}

function retangulo(e: Unidade | Predio | Fonte): [number, number, number, number] {
  if (eUnidade(e)) {
    const x = Math.floor(e.x);
    const y = Math.floor(e.y);
    return [x, y, x, y];
  }
  const tam = ePredio(e) ? e.tam : 1;
  return [e.gx, e.gy, e.gx + tam - 1, e.gy + tam - 1];
}

function pensar(sim: Sim, u: Unidade) {
  const d = UNIDADES[u.tipo];
  if (u.abrigado) {
    u.acao = 'parado';
    return;
  }
  if (u.recarga > 0) u.recarga--;
  const o = u.ordem;
  u.acao = 'parado';
  switch (o.tipo) {
    case 'parado': {
      u.caminho = [];
      if ((u.id + sim.passo) % 5 === 0 && d.combate) {
        const alvo = procurarInimigo(sim, u, d.visao);
        if (alvo) u.ordem = { tipo: 'atacar', alvo, depois: { tipo: 'mover', x: u.x, y: u.y } };
      }
      return;
    }
    case 'mover': {
      if (o.atacando && (u.id + sim.passo) % 5 === 0) {
        const alvo = procurarInimigo(sim, u, d.visao);
        if (alvo) {
          u.ordem = { tipo: 'atacar', alvo, depois: o };
          u.caminho = [];
          return;
        }
      }
      const tx = Math.floor(o.x!);
      const ty = Math.floor(o.y!);
      let alvoX = tx;
      let alvoY = ty;
      let encostar = false;
      if (!passavel(sim, ind(Math.min(TAMANHO - 1, tx), Math.min(TAMANHO - 1, ty)), u.dono)) encostar = true;
      if (!u.caminho.length) {
        const fx = u.x - o.x!;
        const fy = u.y - o.y!;
        if (fx * fx + fy * fy < 0.04) {
          u.ordem = { tipo: 'parado' };
          return;
        }
        if (Math.floor(u.x) === tx && Math.floor(u.y) === ty) {
          // já na casa: o último pedaço, direto
          u.caminho = [ind(tx, ty)];
        } else if (sim.passo - u.achouEm >= 3) {
          u.caminho = acharCaminho(sim, u.dono, u.x, u.y, alvoX, alvoY, alvoX, alvoY, encostar);
          u.achouEm = sim.passo;
          if (!u.caminho.length) {
            u.ordem = { tipo: 'parado' };
            return;
          }
        } else return;
      }
      const ultima = u.caminho[u.caminho.length - 1];
      const fim = ultima === ind(tx, ty) ? { x: o.x!, y: o.y! } : undefined;
      if (andar(sim, u, fim) && !fim) {
        u.ordem = { tipo: 'parado' };
      }
      return;
    }
    case 'atacar': {
      const alvo = sim.porId.get(o.alvo!);
      if (!alvo || eFonte(alvo) || alvo.vida <= 0 || aliados(alvo.dono, u.dono) || (eUnidade(alvo) && alvo.abrigado)) {
        u.ordem = o.depois ?? { tipo: 'parado' };
        u.caminho = [];
        return;
      }
      // o inimigo que fugiu para longe demais: desiste (quem anda atacando volta ao caminho)
      const dist = distancia(u.x, u.y, alvo);
      if (eUnidade(alvo) && dist > d.visao + 6) {
        u.ordem = o.depois ?? { tipo: 'parado' };
        u.caminho = [];
        return;
      }
      const alcance = d.alcance + (ePredio(alvo) ? 0.15 : 0);
      if (dist <= alcance) {
        u.caminho = [];
        const c = centroDe(alvo);
        olhar(u, c.x, c.y);
        if (dist < d.alcanceMin) return;
        u.acao = 'atacando';
        if (u.recarga <= 0) {
          ferir(sim, alvo, danoDe(sim, u, alvo), u.id);
          u.recarga = d.recarga;
          sim.eventos.push({ t: 'golpe', de: u.id, alvo: alvo.id, dono: u.dono, arma: u.tipo === 'arqueiro' ? 'flecha' : u.tipo === 'catapulta' ? 'pedra' : u.tipo === 'canhao' ? 'bala' : 'corpo', x0: u.x, y0: u.y, x1: c.x, y1: c.y });
        }
        return;
      }
      seguir(sim, u, alvo, eUnidade(alvo) ? 8 : 0);
      return;
    }
    case 'coletar': {
      if (u.tipo !== 'trabalhador') {
        u.ordem = { tipo: 'parado' };
        return;
      }
      let alvo = sim.porId.get(o.alvo!);
      const rec: Recurso | null = eFonte(alvo) ? (alvo.tipo === 'arvore' ? 'madeira' : 'ouro') : ePredio(alvo) && alvo.tipo === 'fazenda' && alvo.dono === u.dono && alvo.pronto ? 'comida' : null;
      if (!alvo || !rec) {
        // a fonte acabou: a mais perto do mesmo tipo
        const outra = o.volta !== undefined ? fonteParecida(sim, u, o.volta) : 0;
        if (outra) {
          u.ordem = { tipo: 'coletar', alvo: outra };
          u.caminho = [];
        } else u.ordem = u.carga ? { tipo: 'entregar' } : { tipo: 'parado' };
        return;
      }
      if (u.carga && u.carga.rec !== rec) u.carga = null;
      if (u.carga && u.carga.qtd >= cargaDe(sim, u.dono)) {
        u.ordem = { tipo: 'entregar', volta: alvo.id };
        u.caminho = [];
        return;
      }
      if (distancia(u.x, u.y, alvo) <= 0.8) {
        u.caminho = [];
        const c = centroDe(alvo);
        olhar(u, c.x, c.y);
        u.acao = 'trabalhando';
        u.trabalho++;
        if (u.trabalho >= ritmoDe(sim, u.dono, rec)) {
          u.trabalho = 0;
          u.carga = { rec, qtd: (u.carga?.qtd ?? 0) + 1 };
          if (eFonte(alvo)) {
            alvo.qtd--;
            if (alvo.qtd <= 0) esgotar(sim, alvo);
          }
        }
        return;
      }
      seguir(sim, u, alvo);
      // guarda o tipo, para achar outra igual se esta acabar no caminho
      u.ordem.volta = alvo.id;
      return;
    }
    case 'entregar': {
      const deposito = depositoPerto(sim, u);
      if (!deposito || !u.carga) {
        u.ordem = o.volta !== undefined ? { tipo: 'coletar', alvo: o.volta, volta: o.volta } : { tipo: 'parado' };
        return;
      }
      if (distancia(u.x, u.y, deposito) <= 0.8) {
        sim.jogadores[u.dono].recursos[u.carga.rec] += u.carga.qtd;
        sim.colhido[u.dono] += u.carga.qtd;
        sim.eventos.push({ t: 'entregou', dono: u.dono, rec: u.carga.rec, qtd: u.carga.qtd });
        u.carga = null;
        u.caminho = [];
        u.ordem = o.volta !== undefined ? { tipo: 'coletar', alvo: o.volta, volta: o.volta } : { tipo: 'parado' };
        return;
      }
      seguir(sim, u, deposito);
      return;
    }
    case 'construir': {
      const alvo = sim.porId.get(o.alvo!);
      if (!ePredio(alvo) || alvo.dono !== u.dono || alvo.vida <= 0) {
        u.ordem = { tipo: 'parado' };
        return;
      }
      if (alvo.pronto) {
        // a fazenda que acabou de ficar pronta: quem a fez já começa a colher; senão, a próxima obra perto
        // (a fazenda é de um só: quem ajudou a construir e chegou depois vai a outra com vaga, ou à próxima obra)
        if (alvo.tipo !== 'fazenda' || !irColetar(sim, u, alvo.id)) {
          const prox = obraPerto(sim, u);
          u.ordem = prox ? { tipo: 'construir', alvo: prox } : { tipo: 'parado' };
        }
        u.caminho = [];
        return;
      }
      if (distancia(u.x, u.y, alvo) <= 0.8) {
        u.caminho = [];
        const c = centroDe(alvo);
        olhar(u, c.x, c.y);
        u.acao = 'trabalhando';
        const dp = PREDIOS[alvo.tipo];
        alvo.progresso++;
        alvo.vida = Math.min(alvo.vidaMax, alvo.vida + (alvo.vidaMax * 0.9) / dp.tempo);
        if (alvo.progresso >= dp.tempo) {
          alvo.pronto = true;
          alvo.vida = Math.max(alvo.vida, Math.round(alvo.vidaMax * 0.999));
          alvo.era = sim.jogadores[alvo.dono].era;
          sim.eventos.push({ t: 'pronto', id: alvo.id, dono: alvo.dono, tipo: alvo.tipo });
          if (alvo.tipo === 'maravilha') sim.eventos.push({ t: 'maravilha', dono: alvo.dono });
        }
        return;
      }
      seguir(sim, u, alvo);
      return;
    }
    case 'abrigar': {
      const alvo = sim.porId.get(o.alvo!);
      if (!ePredio(alvo) || alvo.dono !== u.dono || alvo.vida <= 0 || !alvo.sino) {
        u.ordem = u.antesDoSino ?? { tipo: 'parado' };
        u.antesDoSino = null;
        return;
      }
      if (distancia(u.x, u.y, alvo) <= 0.8) {
        // entra: a carga vai para o estoque, e ele some do mapa
        if (u.carga) {
          sim.jogadores[u.dono].recursos[u.carga.rec] += u.carga.qtd;
        sim.colhido[u.dono] += u.carga.qtd;
          sim.eventos.push({ t: 'entregou', dono: u.dono, rec: u.carga.rec, qtd: u.carga.qtd });
          u.carga = null;
        }
        const c = centroDe(alvo);
        u.x = u.ax = c.x;
        u.y = u.ay = c.y;
        u.caminho = [];
        u.trabalho = 0;
        u.abrigado = alvo.id;
        return;
      }
      seguir(sim, u, alvo);
      return;
    }
  }
}

function esgotar(sim: Sim, f: Fonte) {
  f.qtd = 0;
  sim.grade[ind(f.gx, f.gy)] = 0;
  sim.porId.delete(f.id);
  sim.fontes = sim.fontes.filter((x) => x !== f);
  sim.eventos.push({ t: 'esgotou', id: f.id });
  sim.acabadas.set(f.id, { tipo: f.tipo, gx: f.gx, gy: f.gy });
}

/** Uma fonte com uma casa livre do lado (a árvore do meio do bosque só se alcança quando a da borda cai). */
export function acessivel(sim: Sim, f: Fonte, dono: Dono): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = f.gx + dx;
    const y = f.gy + dy;
    if (dentro(x, y) && passavel(sim, ind(x, y), dono)) return true;
  }
  return false;
}

function fonteParecida(sim: Sim, u: Unidade, id: number): number {
  const e = sim.porId.get(id);
  const antes = sim.acabadas.get(id) ?? (eFonte(e) ? e : null);
  if (!antes) return 0;
  let melhor = 0;
  let dist = 10 * 10;
  for (const f of sim.fontes) {
    if (f.tipo !== antes.tipo || !acessivel(sim, f, u.dono) || !temVaga(sim, u.dono, f.id, u.id)) continue;
    const dx = f.gx - antes.gx;
    const dy = f.gy - antes.gy;
    const q = dx * dx + dy * dy;
    if (q < dist) {
      dist = q;
      melhor = f.id;
    }
  }
  return melhor;
}

function depositoPerto(sim: Sim, u: Unidade): Predio | null {
  let melhor: Predio | null = null;
  let dist = Infinity;
  for (const p of sim.predios) {
    if (p.dono !== u.dono || p.tipo !== 'centro' || !p.pronto) continue;
    const d = distancia(u.x, u.y, p);
    if (d < dist) {
      dist = d;
      melhor = p;
    }
  }
  return melhor;
}

function obraPerto(sim: Sim, u: Unidade): number {
  let melhor = 0;
  let dist = 8;
  for (const p of sim.predios) {
    if (p.dono !== u.dono || p.pronto || p.vida <= 0) continue;
    const d = distancia(u.x, u.y, p);
    if (d < dist) {
      dist = d;
      melhor = p.id;
    }
  }
  return melhor;
}

/** Quem está em cima de quem é empurrado de leve (na ordem dos ids), sem entrar em casa ocupada. */
function separar(sim: Sim) {
  const us = sim.unidades;
  const R = 0.42;
  for (let a = 0; a < us.length; a++) {
    const u = us[a];
    if (u.abrigado) continue;
    for (let b = a + 1; b < us.length; b++) {
      const v = us[b];
      if (v.abrigado) continue;
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      if (dx > R || dx < -R || dy > R || dy < -R) continue;
      const q = dx * dx + dy * dy;
      if (q >= R * R) continue;
      let d = Math.sqrt(q);
      let nx: number;
      let ny: number;
      if (d < 0.0001) {
        nx = (u.id % 2 ? 1 : -1) * 0.7071;
        ny = 0.7071;
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      const empurra = (R - d) * 0.25;
      // quem trabalha parado empurra mais do que é empurrado
      const pu = u.acao === 'trabalhando' || u.acao === 'atacando' ? 0.2 : 1;
      const pv = v.acao === 'trabalhando' || v.acao === 'atacando' ? 0.2 : 1;
      mexer(sim, u, -nx * empurra * pu, -ny * empurra * pu);
      mexer(sim, v, nx * empurra * pv, ny * empurra * pv);
    }
  }
}
function mexer(sim: Sim, u: Unidade, dx: number, dy: number) {
  const x = u.x + dx;
  const y = u.y + dy;
  if (x < 0.05 || y < 0.05 || x > TAMANHO - 0.05 || y > TAMANHO - 0.05) return;
  if (!passavel(sim, ind(Math.floor(x), Math.floor(y)), u.dono)) return;
  u.x = x;
  u.y = y;
}

function limparMortos(sim: Sim) {
  if (sim.unidades.some((u) => u.vida <= 0)) {
    for (const u of sim.unidades)
      if (u.vida <= 0) {
        sim.porId.delete(u.id);
        sim.eventos.push({ t: 'morte', id: u.id, dono: u.dono, tipo: u.tipo, predio: false, x: u.x, y: u.y });
      }
    sim.unidades = sim.unidades.filter((u) => u.vida > 0);
  }
  if (sim.predios.some((p) => p.vida <= 0)) {
    for (const p of sim.predios)
      if (p.vida <= 0) {
        sim.porId.delete(p.id);
        for (let y = p.gy; y < p.gy + p.tam; y++) for (let x = p.gx; x < p.gx + p.tam; x++) sim.grade[ind(x, y)] = 0;
        const c = centroDe(p);
        sim.eventos.push({ t: 'morte', id: p.id, dono: p.dono, tipo: p.tipo, predio: true, x: c.x, y: c.y });
        // quem estava nele perde o que fazia
        if (p.pesquisa > 0) p.pesquisa = 0;
        // quem estava abrigado no centro que caiu sai pela porta
        if (p.tipo === 'centro') soltarDoSino(sim, p);
      }
    sim.predios = sim.predios.filter((p) => p.vida > 0);
  }
}

/** O que cada um vê agora (e o que já viu): unidades e prédios iluminam um círculo. No 2×2, a equipe divide a visão. */
export function verNevoa(sim: Sim) {
  for (const d of donos(sim)) {
    const j = sim.jogadores[d];
    j.visivel.fill(0);
    const luz = (cx: number, cy: number, r: number) => {
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(TAMANHO - 1, Math.floor(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(TAMANHO - 1, Math.floor(cy + r));
      const r2 = r * r;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r2) {
            const i = ind(x, y);
            j.visivel[i] = 1;
            j.explorado[i] = 1;
          }
        }
    };
    for (const u of sim.unidades) if (aliados(u.dono, d)) luz(u.x, u.y, UNIDADES[u.tipo].visao);
    for (const p of sim.predios) if (aliados(p.dono, d)) luz(p.gx + p.tam / 2, p.gy + p.tam / 2, PREDIOS[p.tipo].visao + p.tam / 2);
  }
}

/** O que cada um "vale" (para o teto de tempo): o que custou o que está de pé. */
export function pontos(sim: Sim, dono: Dono): number {
  const soma = (c: Custo) => (c.comida ?? 0) + (c.madeira ?? 0) + (c.ouro ?? 0);
  let p = 0;
  for (const u of sim.unidades) if (u.dono === dono) p += soma(UNIDADES[u.tipo].custo);
  for (const q of sim.predios) if (q.dono === dono && q.pronto) p += soma(PREDIOS[q.tipo].custo) + (q.tipo === 'centro' ? 500 : 0);
  if (sim.jogadores[dono].era >= 2) p += 600;
  // a era 3 vale mais (24/11/2026): o que custou chegar lá
  if (sim.jogadores[dono].era === 3) p += 1300;
  return p;
}

/** Os pontos da equipe (no 1×1, os do dono). */
export function pontosDaEquipe(sim: Sim, equipe: 0 | 1): number {
  let p = 0;
  for (const d of donos(sim)) if (equipeDe(d) === equipe) p += pontos(sim, d);
  return p;
}

/**
 * O FIM. `vencedor` é a EQUIPE que ganhou (no 1×1, o próprio dono). No 2×2, quem perde o centro da vila fica sem base, mas a
 * equipe só perde quando os dois centros caíram; a Maravilha de um vale para a equipe, e no tempo contam os pontos somados.
 */
function conferirFim(sim: Sim) {
  const terminar = (vencedor: Dono, motivo: Motivo) => {
    sim.vencedor = vencedor;
    sim.motivo = motivo;
    sim.eventos.push({ t: 'fim', vencedor, motivo });
  };
  for (const e of [0, 1] as Dono[]) {
    if (!sim.predios.some((p) => equipeDe(p.dono) === e && p.tipo === 'centro')) return terminar((1 - e) as Dono, 'centro');
  }
  for (const d of donos(sim)) {
    const j = sim.jogadores[d];
    if (sim.predios.some((p) => p.dono === d && p.tipo === 'maravilha' && p.pronto)) {
      j.maravilha++;
      if (j.maravilha >= passosDaMaravilha(sim)) return terminar(equipeDe(d), 'maravilha');
    } else j.maravilha = 0;
  }
  const des = sim.desafio;
  if (des) {
    if (des === 'maravilha' && !sim.predios.some((p) => p.dono === 0 && p.tipo === 'maravilha')) return terminar(1, 'desafio');
    if (des === 'colheita' && sim.colhido[0] >= DESAFIOS.colheita.meta!) return terminar(0, 'desafio');
    // (a Maravilha vence pelo contador dela, logo acima)
    if (des !== 'maravilha' && sim.passo + 1 >= DESAFIOS[des].limite) return terminar(des === 'cerco' ? 0 : 1, 'desafio');
  }
  // os 20 minutos: sem ninguém que vote, acaba como sempre; com gente, só com todas aceitando. E o teto de segurança, sempre.
  const votantes = sim.votam.some((v) => v);
  if ((sim.passo + 1 >= PASSOS_SUGERIDOS && todosAceitaram(sim)) || sim.passo + 1 >= PASSOS_MAX) {
    const a = pontosDaEquipe(sim, 0);
    const b = pontosDaEquipe(sim, 1);
    return terminar(a >= b ? 0 : 1, votantes && sim.passo + 1 < PASSOS_MAX ? 'pontos' : 'tempo');
  }
}

/** Todas as pessoas que votam aceitaram terminar pelos pontos (sem ninguém que vote: sim). */
export function todosAceitaram(sim: Sim): boolean {
  return sim.votam.every((v, d) => !v || (sim.votos & (1 << d)) !== 0);
}

/** Já passou dos 20 minutos, e a partida pode terminar pelos pontos (a tela mostra a opção). */
export function podeTerminarPelosPontos(sim: Sim): boolean {
  return sim.vencedor === null && sim.passo >= PASSOS_SUGERIDOS;
}

/** Um resumo que muda com qualquer diferença na partida (o teste de determinismo compara dois). */
export function assinatura(sim: Sim): string {
  let h = 2166136261;
  const mais = (n: number) => {
    h = Math.imul(h ^ (Math.round(n * 1000) | 0), 16777619);
  };
  mais(sim.passo);
  for (const u of sim.unidades) {
    mais(u.id);
    mais(u.x);
    mais(u.y);
    mais(u.vida);
    mais(u.abrigado);
  }
  for (const p of sim.predios) {
    mais(p.id);
    mais(p.vida);
    mais(p.progresso);
    mais(p.estudoPassos);
  }
  for (const j of sim.jogadores) {
    for (const k of RECURSOS) {
      mais(j.recursos[k]);
      mais(j.precos[k]);
    }
    mais(j.melhorias);
    mais(j.era);
  }
  // a votação (só depois dos 20 minutos: antes ela é sempre zero, e a assinatura de antes não muda)
  if (sim.votos) mais(sim.votos);
  return (h >>> 0).toString(16);
}

/** Dá para chegar a encostar no retângulo, saindo de (x, y)? (O computador confere antes de pôr um prédio.) */
export function alcancavel(sim: Sim, dono: Dono, x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const c = acharCaminho(sim, dono, x, y, x0, y0, x1, y1, true);
  const fim = c.length ? c[c.length - 1] : ind(Math.floor(x), Math.floor(y));
  const fx = fim % TAMANHO;
  const fy = (fim - fx) / TAMANHO;
  return Math.max(x0 - fx, 0, fx - x1) <= 1 && Math.max(y0 - fy, 0, fy - y1) <= 1;
}
