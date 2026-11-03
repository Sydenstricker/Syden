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
  // e o do Tabuleiro da turma (server/src/minijogo-tabuleiro-da-turma.ts)
  tabuleiro: chave('Tabuleiro da turma'),
};

export const nomeDaPista = (id: string) => NOMES_DAS_PISTAS[id] ?? id;

/**
 * O nome da pista JÁ TRADUZIDO. "Praia" e "Neve" são também palavras do Desenha e adivinha, e lá a tradução guarda as
 * alternativas aceitas separadas por "|" ("ビーチ|浜辺|砂浜"): o nome da pista é a primeira.
 */
export const nomeDaPistaEm = (t: (texto: string) => string, id: string) => t(nomeDaPista(id)).split('|')[0];
