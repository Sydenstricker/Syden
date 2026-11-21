import { chave } from '../i18n';

/** Os nomes das pistas dos Coelhos a jato, marcados para traduzir (o id é o do servidor: server/src/jato.ts). */
export const NOMES_DAS_PISTAS_DO_JATO: Record<string, string> = {
  'cidade-1': chave('Cidade à noite'),
  'orbita-1': chave('Órbita'),
  'nuvens-1': chave('Mar de nuvens'),
  'aurora-1': chave('Aurora'),
  'tempestade-1': chave('Tempestade'),
  // as duas com perigos (21/11/2026)
  'asteroides-1': chave('Asteroides'),
  'avenida-1': chave('Avenida neon'),
  // as copas do Solo contra o computador (jato/pista.ts, COPAS_DO_JATO)
  'copa-estelar': chave('Copa estelar'),
  'copa-da-tempestade': chave('Copa da tempestade'),
  'copa-dos-perigos': chave('Copa dos perigos'),
};

export const nomeDaPistaDoJato = (t: (texto: string) => string, id: string) => t(NOMES_DAS_PISTAS_DO_JATO[id] ?? id);
