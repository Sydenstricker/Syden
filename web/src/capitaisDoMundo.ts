import { chave } from './i18n';

/**
 * AS CAPITAIS DO MUNDO (21/11/2026, decisão dele: "mostre também o nome da capital"): o nome da capital de cada país do terceiro
 * tabuleiro das Capitais (PAISES_DO_MUNDO em server/src/minijogo-cidades.ts), pelo código do país. O Intl traduz o país, mas não
 * a cidade: a capital passa pela tradução como os outros textos. País novo no tabuleiro pede a linha dele aqui (o teste cobra).
 */
export const CAPITAL_DO_PAIS: Record<string, string> = {
  NZ: chave('Wellington'),
  AU: chave('Camberra'),
  EG: chave('Cairo'),
  KE: chave('Nairóbi'),
  ZA: chave('Pretória'),
  PE: chave('Lima'),
  AR: chave('Buenos Aires'),
  BR: chave('Brasília'),
  TR: chave('Ancara'),
  IN: chave('Nova Délhi'),
  ID: chave('Jacarta'),
  CN: chave('Pequim'),
  KR: chave('Seul'),
  JP: chave('Tóquio'),
  ES: chave('Madri'),
  IT: chave('Roma'),
  FR: chave('Paris'),
  MX: chave('Cidade do México'),
  CA: chave('Ottawa'),
  US: chave('Washington'),
};
