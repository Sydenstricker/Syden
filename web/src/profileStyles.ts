// Os enfeites de perfil: a cor do nome e o fundo do cartão.
//
// O servidor guarda só o NOME da escolha ('carmim', 'aurora'…). As cores de verdade ficam aqui e no CSS,
// em duas versões — uma para o tema escuro e outra para o claro —, senão um amarelo bonito no escuro
// vira invisível no claro. Por isso a cor não vai em `style`: vai num `data-cor`, e o CSS escolhe.
import { chave } from './i18n';

export interface CorDeNome {
  id: string;
  label: string;
  /** Só para o quadradinho de escolha; quem pinta o nome de verdade é o CSS. */
  amostra: string;
}

export const CORES_DE_NOME: CorDeNome[] = [
  { id: 'padrao', label: chave('Padrão'), amostra: 'currentColor' },
  { id: 'carmim', label: chave('Carmim'), amostra: '#e2574c' },
  { id: 'laranja', label: chave('Laranja'), amostra: '#e0822f' },
  { id: 'ouro', label: chave('Ouro'), amostra: '#c79a1e' },
  { id: 'limao', label: chave('Limão'), amostra: '#77a93a' },
  { id: 'menta', label: chave('Menta'), amostra: '#2fa88c' },
  { id: 'ceu', label: chave('Céu'), amostra: '#3d97cc' },
  { id: 'anil', label: chave('Anil'), amostra: '#5b6fd6' },
  { id: 'lavanda', label: chave('Lavanda'), amostra: '#8f6fd6' },
  { id: 'rosa', label: chave('Rosa'), amostra: '#d45f95' },
  // As quatro de baixo vinham do catálogo da loja e não existiam nesta lista: dava para vesti-las na
  // loja e não dava para escolhê-las aqui, e a tela não tinha o que desenhar de nenhuma das duas
  // formas. Catálogo e arte agora batem.
  { id: 'cobre', label: chave('Cobre'), amostra: '#d98f5a' },
  { id: 'jade', label: chave('Jade'), amostra: '#4fc99a' },
  { id: 'ametista', label: chave('Ametista'), amostra: '#b57ae0' },
  { id: 'prisma', label: chave('Prisma'), amostra: 'currentColor' },
];

export interface Fundo {
  id: string;
  label: string;
  animado: boolean;
}

// Mesma razão do voiceEffects: lista de módulo, marcada com chave(), traduzida na hora de desenhar.
export const FUNDOS: Fundo[] = [
  { id: 'nenhum', label: chave('Sem fundo'), animado: false },
  { id: 'vila', label: chave('Vila'), animado: false },
  { id: 'poente', label: chave('Poente'), animado: false },
  { id: 'floresta', label: chave('Floresta'), animado: false },
  { id: 'aurora', label: chave('Aurora'), animado: true },
  { id: 'brasa', label: chave('Brasa'), animado: true },
  { id: 'oceano', label: chave('Oceano'), animado: true },
  { id: 'estrelas', label: chave('Noite estrelada'), animado: true },
  { id: 'nebulosa', label: chave('Nebulosa'), animado: true },
  { id: 'vitral', label: chave('Vitral'), animado: true },
  { id: 'cosmos', label: chave('Cosmos'), animado: true },
];

const CORES = new Set(CORES_DE_NOME.map((c) => c.id));
const IDS_FUNDO = new Set(FUNDOS.map((f) => f.id));

/** O que colocar no `data-cor` de um nome. Escolha desconhecida (ou antiga) volta para o padrão. */
export function corDoNome(escolha: string | null | undefined): string | undefined {
  return escolha && escolha !== 'padrao' && CORES.has(escolha) ? escolha : undefined;
}

/**
 * O EFEITO DO NOME — o 'mesmo nome, novo visual'.
 *
 * Mesma regra da cor: o servidor guarda só o código, e quem desenha é o CSS, por `data-efeito`. Assim
 * um efeito novo é publicar o site, e cada um pode ter versão diferente no tema claro e no escuro.
 *
 * NENHUM DELES BAIXA FONTE, de propósito. 'serifa' e 'mono' usam pilhas que todo sistema já tem, e
 * 'versalete' mexe no que já está desenhado. Uma fonte decorativa custaria um download por pessoa,
 * e o nome apareceria errado até ela chegar — numa lista de membros, isso é a tela inteira pulando.
 */
export const EFEITOS_DE_NOME: { id: string; label: string }[] = [
  { id: 'sem-efeito', label: chave('Sem efeito') },
  { id: 'brilho', label: chave('Brilho') },
  { id: 'pulso', label: chave('Pulso') },
  { id: 'arco-iris', label: chave('Arco-íris') },
  { id: 'sombra', label: chave('Sombra') },
  { id: 'serifa', label: chave('Com serifa') },
  { id: 'mono', label: chave('Máquina de escrever') },
  { id: 'versalete', label: chave('Versalete') },
];

const IDS_EFEITO = new Set(EFEITOS_DE_NOME.map((e) => e.id));

/** O efeito a pôr no `data-efeito` do nome; undefined quando não há nenhum. */
export function efeitoDoNome(escolha: string | null | undefined): string | undefined {
  return escolha && escolha !== 'sem-efeito' && IDS_EFEITO.has(escolha) ? escolha : undefined;
}

/** A classe do fundo do cartão de perfil. */
export function classeDoFundo(escolha: string | null | undefined): string {
  return escolha && escolha !== 'nenhum' && IDS_FUNDO.has(escolha) ? `fundo-${escolha}` : 'fundo-nenhum';
}
