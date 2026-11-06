import { chave } from '../i18n';
import { COPA } from './pista';

/** Os nomes das pistas e da copa, marcados para traduzir (o id é o do servidor: server/src/corrida.ts). */
export const NOMES_DAS_PISTAS: Record<string, string> = {
  'horta-1': chave('Horta'),
  'pomar-1': chave('Pomar'),
  'praia-1': chave('Praia'),
  'bosque-1': chave('Bosque'),
  'neve-1': chave('Neve'),
  'canion-1': chave('Cânion'),
  [COPA]: chave('Copa da Cenoura'),
  'copa-do-repolho': chave('Copa do Repolho'),
  // o pódio da Festa dos coelhos mora na mesma estante (server/src/minijogo-festa.ts)
  festa: chave('Festa dos coelhos'),
  // o pódio da Briga na horta, com a fase vencida (server/src/minijogo-briga.ts)
  briga: chave('Briga na horta'),
  // e o da Horta em cascata (server/src/minijogo-blocos.ts)
  blocos: chave('Horta em cascata'),
  // as fases e a copa do Pulo do coelho (server/src/plataforma.ts), que também dão troféu na sala
  'prado-1': chave('Prado'),
  'toca-1': chave('Toca'),
  'copas-1': chave('Galhos'),
  'copa-do-pulo': chave('Copa do Pulo'),
  // e o do Minigolfe da toca (server/src/minijogo-golfe.ts): os pontos são o total de tacadas, e MENOS é melhor
  golfe: chave('Minigolfe da toca'),
  // e o da Caça às pragas da horta (server/src/minijogo-caca.ts): os pontos, e MAIS é melhor
  caca: chave('Caça às pragas da horta'),
  // e o do Tabuleiro da turma (server/src/minijogo-tabuleiro-da-turma.ts)
  tabuleiro: chave('Tabuleiro da turma'),
  // e o de Capitais, o antigo Cidades à venda (server/src/minijogo-cidades.ts): os pontos são o patrimônio
  cidades: chave('Capitais'),
  // e o do Estoura-balão (server/src/minijogo-balao.ts): os pontos são os balões que sobraram
  balao: chave('Estoura-balão'),
  // e o dos Coelhos a jato (server/src/minijogo-jato.ts)
  jato: chave('Coelhos a jato'),
  // e o da Regata da toca (server/src/minijogo-barco.ts)
  barco: chave('Regata da toca'),
  // e o do Chefe da turma (server/src/minijogo-chefe.ts): os pontos são o dano dado
  chefe: chave('O chefe da turma'),
};

export const nomeDaPista = (id: string) => NOMES_DAS_PISTAS[id] ?? id;

/**
 * O nome da pista JÁ TRADUZIDO. "Praia" e "Neve" são também palavras do Desenha e adivinha, e lá a tradução guarda as
 * alternativas aceitas separadas por "|" ("ビーチ|浜辺|砂浜"): o nome da pista é a primeira.
 */
export const nomeDaPistaEm = (t: (texto: string) => string, id: string) => t(nomeDaPista(id)).split('|')[0];
