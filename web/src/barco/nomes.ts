import { chave } from '../i18n';

/** Os nomes das pistas da Regata da toca, marcados para traduzir (o id é o do servidor: server/src/barco.ts). */
export const NOMES_DAS_PISTAS_DO_BARCO: Record<string, string> = {
  'lago-1': chave('Lago da horta'),
  'riacho-1': chave('Riacho'),
  'mangue-1': chave('Mangue'),
};

export const nomeDaPistaDoBarco = (t: (texto: string) => string, id: string) => t(NOMES_DAS_PISTAS_DO_BARCO[id] ?? id);
