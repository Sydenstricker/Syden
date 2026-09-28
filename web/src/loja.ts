// O lado bonito da loja: o nome, a descrição e o desenho de cada cosmético.
//
// O servidor conhece só os CÓDIGOS e quem tem direito a cada um (server/src/loja.ts). A arte mora aqui,
// pela mesma razão das insígnias: dá para trocar um degradê, renomear um fundo ou mexer num texto
// publicando o site, sem tocar no servidor nem migrar banco.
//
// Um código que o servidor manda e este arquivo não conhece é IGNORADO, e não desenhado como quadrado
// vazio: é o que acontece quando o servidor é mais novo que o site que a pessoa tem aberto.

import type { ComoSeGanha, TipoDeItem } from './types';

export interface ItemVisual {
  nome: string;
  descricao: string;
}

/** As molduras do avatar. São anéis de CSS (ver styles.css), e não imagens: não pesam nada. */
export const MOLDURAS: Record<string, ItemVisual> = {
  nenhuma: { nome: 'Sem moldura', descricao: 'O avatar limpo, como sempre foi.' },
  prata: { nome: 'Prata', descricao: 'Um anel claro e discreto.' },
  bronze: { nome: 'Bronze', descricao: 'Um anel quente, cor de cobre velho.' },
  folha: { nome: 'Folha', descricao: 'Verde de mato, como a vila.' },
  mar: { nome: 'Mar', descricao: 'Azul que escurece de um lado para o outro.' },
  'brasa-moldura': { nome: 'Brasa', descricao: 'Do laranja ao vermelho, como carvão aceso.' },
  'ouro-moldura': { nome: 'Ouro', descricao: 'Dourado com brilho que passa devagar.' },
  'esmeralda-moldura': { nome: 'Esmeralda', descricao: 'Verde fundo com reflexo.' },
  rubi: { nome: 'Rubi', descricao: 'Vermelho profundo, com pulso.' },
  'prisma-moldura': { nome: 'Prisma', descricao: 'Todas as cores girando devagar. A mais chamativa de todas.' },
};

/** Descrições das cores de nome, para a loja. O desenho continua vindo do CSS, por `data-cor`. */
export const CORES: Record<string, ItemVisual> = {
  padrao: { nome: 'Padrão', descricao: 'A cor do seu cargo na comunidade.' },
  carmim: { nome: 'Carmim', descricao: 'Vermelho fechado.' },
  laranja: { nome: 'Laranja', descricao: 'Quente, mas sem gritar.' },
  ouro: { nome: 'Ouro', descricao: 'Amarelo escurecido, legível nos dois temas.' },
  limao: { nome: 'Limão', descricao: 'Verde claro.' },
  menta: { nome: 'Menta', descricao: 'Verde-água.' },
  ceu: { nome: 'Céu', descricao: 'Azul claro.' },
  anil: { nome: 'Anil', descricao: 'Azul fechado, quase roxo.' },
  lavanda: { nome: 'Lavanda', descricao: 'Roxo claro.' },
  rosa: { nome: 'Rosa', descricao: 'Rosa forte.' },
  cobre: { nome: 'Cobre', descricao: 'Metálico morno.' },
  jade: { nome: 'Jade', descricao: 'Verde de pedra.' },
  ametista: { nome: 'Ametista', descricao: 'Roxo de pedra.' },
  prisma: { nome: 'Prisma', descricao: 'O nome muda de cor devagar.' },
};

export const FUNDOS_LOJA: Record<string, ItemVisual> = {
  nenhum: { nome: 'Sem fundo', descricao: 'O cartão liso.' },
  vila: { nome: 'Vila', descricao: 'A vila do Syden ao fundo.' },
  poente: { nome: 'Poente', descricao: 'Céu de fim de tarde.' },
  floresta: { nome: 'Floresta', descricao: 'Verde escuro.' },
  aurora: { nome: 'Aurora', descricao: 'Luzes que se movem devagar.' },
  brasa: { nome: 'Brasa', descricao: 'Laranja que pulsa.' },
  oceano: { nome: 'Oceano', descricao: 'Azul em movimento.' },
  estrelas: { nome: 'Noite estrelada', descricao: 'Pontinhos piscando.' },
  nebulosa: { nome: 'Nebulosa', descricao: 'Poeira de estrelas, roxa e azul.' },
  vitral: { nome: 'Vitral', descricao: 'Vidro colorido com a luz passando.' },
  cosmos: { nome: 'Cosmos', descricao: 'O céu inteiro girando bem devagar.' },
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
  livre: 'De graça, para qualquer pessoa',
  conquista: 'Ganha fazendo alguma coisa no Syden',
};
