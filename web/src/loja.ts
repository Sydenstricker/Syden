// O lado bonito da loja: o nome, a descrição e o desenho de cada cosmético.
//
// O servidor conhece só os CÓDIGOS e quem tem direito a cada um (server/src/loja.ts). A arte mora aqui,
// pela mesma razão das insígnias: dá para trocar um degradê, renomear um fundo ou mexer num texto
// publicando o site, sem tocar no servidor nem migrar banco.
//
// Um código que o servidor manda e este arquivo não conhece é IGNORADO, e não desenhado como quadrado
// vazio: é o que acontece quando o servidor é mais novo que o site que a pessoa tem aberto.

import { chave } from './i18n';
import type { ComoSeGanha, TipoDeItem } from './types';

export interface ItemVisual {
  nome: string;
  descricao: string;
}

/** As molduras do avatar. São anéis de CSS (ver styles.css), e não imagens: não pesam nada. */
export const MOLDURAS: Record<string, ItemVisual> = {
  nenhuma: { nome: chave('Sem moldura'), descricao: chave('O avatar limpo, como sempre foi.') },
  prata: { nome: chave('Prata'), descricao: chave('Um anel claro e discreto.') },
  bronze: { nome: chave('Bronze'), descricao: chave('Um anel quente, cor de cobre velho.') },
  folha: { nome: chave('Folha'), descricao: chave('Verde de mato, como a vila.') },
  mar: { nome: chave('Mar'), descricao: chave('Azul que escurece de um lado para o outro.') },
  'brasa-moldura': { nome: chave('Brasa'), descricao: chave('Do laranja ao vermelho, como carvão aceso.') },
  'ouro-moldura': { nome: chave('Ouro'), descricao: chave('Dourado com brilho que passa devagar.') },
  'esmeralda-moldura': { nome: chave('Esmeralda'), descricao: chave('Verde fundo com reflexo.') },
  rubi: { nome: chave('Rubi'), descricao: chave('Vermelho profundo, com pulso.') },
  'prisma-moldura': { nome: chave('Prisma'), descricao: chave('Todas as cores girando devagar. A mais chamativa de todas.') },
};

/** Descrições das cores de nome, para a loja. O desenho continua vindo do CSS, por `data-cor`. */
export const CORES: Record<string, ItemVisual> = {
  padrao: { nome: chave('Padrão'), descricao: chave('A cor do seu cargo na comunidade.') },
  carmim: { nome: chave('Carmim'), descricao: chave('Vermelho fechado.') },
  laranja: { nome: chave('Laranja'), descricao: chave('Quente, mas sem gritar.') },
  ouro: { nome: chave('Ouro'), descricao: chave('Amarelo escurecido, legível nos dois temas.') },
  limao: { nome: chave('Limão'), descricao: chave('Verde claro.') },
  menta: { nome: chave('Menta'), descricao: chave('Verde-água.') },
  ceu: { nome: chave('Céu'), descricao: chave('Azul claro.') },
  anil: { nome: chave('Anil'), descricao: chave('Azul fechado, quase roxo.') },
  lavanda: { nome: chave('Lavanda'), descricao: chave('Roxo claro.') },
  rosa: { nome: chave('Rosa'), descricao: chave('Rosa forte.') },
  cobre: { nome: chave('Cobre'), descricao: chave('Metálico morno.') },
  jade: { nome: chave('Jade'), descricao: chave('Verde de pedra.') },
  ametista: { nome: chave('Ametista'), descricao: chave('Roxo de pedra.') },
  prisma: { nome: chave('Prisma'), descricao: chave('O nome muda de cor devagar.') },
};

export const FUNDOS_LOJA: Record<string, ItemVisual> = {
  nenhum: { nome: chave('Sem fundo'), descricao: chave('O cartão liso.') },
  vila: { nome: chave('Vila'), descricao: chave('A vila do Syden ao fundo.') },
  poente: { nome: chave('Poente'), descricao: chave('Céu de fim de tarde.') },
  floresta: { nome: chave('Floresta'), descricao: chave('Verde escuro.') },
  aurora: { nome: chave('Aurora'), descricao: chave('Luzes que se movem devagar.') },
  brasa: { nome: chave('Brasa'), descricao: chave('Laranja que pulsa.') },
  oceano: { nome: chave('Oceano'), descricao: chave('Azul em movimento.') },
  estrelas: { nome: chave('Noite estrelada'), descricao: chave('Pontinhos piscando.') },
  nebulosa: { nome: chave('Nebulosa'), descricao: chave('Poeira de estrelas, roxa e azul.') },
  vitral: { nome: chave('Vitral'), descricao: chave('Vidro colorido com a luz passando.') },
  cosmos: { nome: chave('Cosmos'), descricao: chave('O céu inteiro girando bem devagar.') },
};

/** Onde procurar a arte de cada tipo. As insígnias têm catálogo próprio, com moldura e frase. */
export function acharVisual(tipo: TipoDeItem, codigo: string): ItemVisual | undefined {
  if (tipo === 'cor') return CORES[codigo];
  if (tipo === 'fundo') return FUNDOS_LOJA[codigo];
  if (tipo === 'moldura') return MOLDURAS[codigo];
  return undefined;
}

// OS VALORES DE CONTRIBUIÇÃO NÃO MORAM MAIS AQUI.
//
// Eles saíram junto com o bloco de contribuição da loja: agora existem numa aba do site
// (web/site/contribuir.html) e em nenhum outro lugar. Deixar a lista aqui seria guardar o mesmo número
// em dois arquivos, e um dia mudar só um dos dois.

export const COMO_SE_GANHA: Record<ComoSeGanha, string> = {
  livre: chave('De graça, para qualquer pessoa'),
  conquista: chave('Ganha fazendo alguma coisa no Syden'),
};
