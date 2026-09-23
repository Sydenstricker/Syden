// Os enfeites de perfil: a cor do nome e o fundo do cartão.
//
// O servidor guarda só o NOME da escolha ('carmim', 'aurora'…). As cores de verdade ficam aqui e no CSS,
// em duas versões — uma para o tema escuro e outra para o claro —, senão um amarelo bonito no escuro
// vira invisível no claro. Por isso a cor não vai em `style`: vai num `data-cor`, e o CSS escolhe.

export interface CorDeNome {
  id: string;
  label: string;
  /** Só para o quadradinho de escolha; quem pinta o nome de verdade é o CSS. */
  amostra: string;
}

export const CORES_DE_NOME: CorDeNome[] = [
  { id: 'padrao', label: 'Padrão', amostra: 'currentColor' },
  { id: 'carmim', label: 'Carmim', amostra: '#e2574c' },
  { id: 'laranja', label: 'Laranja', amostra: '#e0822f' },
  { id: 'ouro', label: 'Ouro', amostra: '#c79a1e' },
  { id: 'limao', label: 'Limão', amostra: '#77a93a' },
  { id: 'menta', label: 'Menta', amostra: '#2fa88c' },
  { id: 'ceu', label: 'Céu', amostra: '#3d97cc' },
  { id: 'anil', label: 'Anil', amostra: '#5b6fd6' },
  { id: 'lavanda', label: 'Lavanda', amostra: '#8f6fd6' },
  { id: 'rosa', label: 'Rosa', amostra: '#d45f95' },
];

export interface Fundo {
  id: string;
  label: string;
  animado: boolean;
}

export const FUNDOS: Fundo[] = [
  { id: 'nenhum', label: 'Sem fundo', animado: false },
  { id: 'vila', label: 'Vila', animado: false },
  { id: 'poente', label: 'Poente', animado: false },
  { id: 'floresta', label: 'Floresta', animado: false },
  { id: 'aurora', label: 'Aurora', animado: true },
  { id: 'brasa', label: 'Brasa', animado: true },
  { id: 'oceano', label: 'Oceano', animado: true },
  { id: 'estrelas', label: 'Noite estrelada', animado: true },
];

const CORES = new Set(CORES_DE_NOME.map((c) => c.id));
const IDS_FUNDO = new Set(FUNDOS.map((f) => f.id));

/** O que colocar no `data-cor` de um nome. Escolha desconhecida (ou antiga) volta para o padrão. */
export function corDoNome(escolha: string | null | undefined): string | undefined {
  return escolha && escolha !== 'padrao' && CORES.has(escolha) ? escolha : undefined;
}

/** A classe do fundo do cartão de perfil. */
export function classeDoFundo(escolha: string | null | undefined): string {
  return escolha && escolha !== 'nenhum' && IDS_FUNDO.has(escolha) ? `fundo-${escolha}` : 'fundo-nenhum';
}
