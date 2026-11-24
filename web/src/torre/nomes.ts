import { chave } from '../i18n';

/** Os nomes das torres, marcados para traduzir (o id é o do servidor: server/src/torre.ts). */
export const NOMES_DAS_TORRES: Record<string, string> = {
  'celeiro-1': chave('Celeiro'),
  'paiol-1': chave('Paiol'),
  'silo-1': chave('Silo'),
  'moinho-1': chave('Moinho'),
  'pombal-1': chave('Pombal'),
  'copa-do-celeiro': chave('Copa do Celeiro'),
  // a subida sem fim (24/11/2026)
  'sem-fim': chave('Sem fim'),
};

export const nomeDaTorre = (t: (texto: string) => string, id: string) => t(NOMES_DAS_TORRES[id] ?? id);
