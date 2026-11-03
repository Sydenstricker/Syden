import { chave } from '../i18n';
import { COPA } from './pista';

/** Os nomes das pistas e da copa, marcados para traduzir (o id é o do servidor: server/src/corrida.ts). */
export const NOMES_DAS_PISTAS: Record<string, string> = {
  'horta-1': chave('Horta'),
  'pomar-1': chave('Pomar'),
  'praia-1': chave('Praia'),
  [COPA]: chave('Copa da Cenoura'),
  // o pódio da Festa dos coelhos mora na mesma estante (server/src/minijogo-festa.ts)
  festa: chave('Festa dos coelhos'),
};

export const nomeDaPista = (id: string) => NOMES_DAS_PISTAS[id] ?? id;
