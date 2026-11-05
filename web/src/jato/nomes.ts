import { chave } from '../i18n';

/** Os nomes das pistas dos Coelhos a jato, marcados para traduzir (o id é o do servidor: server/src/jato.ts). */
export const NOMES_DAS_PISTAS_DO_JATO: Record<string, string> = {
  'cidade-1': chave('Cidade à noite'),
  'orbita-1': chave('Órbita'),
  'nuvens-1': chave('Mar de nuvens'),
};

export const nomeDaPistaDoJato = (t: (texto: string) => string, id: string) => t(NOMES_DAS_PISTAS_DO_JATO[id] ?? id);
