// A arte do espaço de boas-vindas de cada comunidade.
//
// O servidor guarda só um CÓDIGO ('aurora', 'brasa'); o desenho mora aqui, pelo mesmo acordo das
// molduras da loja: acrescentar uma arte nova é publicar o site, sem tocar no servidor nem migrar
// banco. Um código que o servidor manda e este arquivo não conhece cai no padrão, em vez de virar um
// retângulo vazio — é o que acontece quando o servidor é mais novo que o site aberto na tela.
//
// POR QUE DEGRADÊ E NÃO IMAGEM. Uma foto de fundo por comunidade significaria armazenamento, limite de
// tamanho, recorte, moderação de imagem e banda — cinco problemas para um enfeite. O degradê animado
// pesa zero, carrega instantâneo e nunca precisa ser moderado.

export interface ArteDeBoasVindas {
  nome: string;
  /** O fundo do painel grande. */
  fundo: string;
  /** A cor de destaque: borda dos blocos, títulos, brilho. Tem de ler bem sobre o fundo. */
  destaque: string;
  /** Clara ou escura? Decide a cor do texto por cima — e errar isso deixa o título ilegível. */
  tom: 'escuro' | 'claro';
}

export const ARTES: Record<string, ArteDeBoasVindas> = {
  aurora: {
    nome: 'Aurora',
    fundo: 'linear-gradient(135deg, #0f2027 0%, #203a43 45%, #2c5364 100%)',
    destaque: '#5ee7df',
    tom: 'escuro',
  },
  brasa: {
    nome: 'Brasa',
    fundo: 'linear-gradient(135deg, #1a0b05 0%, #7a2f0d 55%, #d95204 100%)',
    destaque: '#ffb56b',
    tom: 'escuro',
  },
  vinho: {
    nome: 'Vinho',
    fundo: 'linear-gradient(135deg, #11030a 0%, #4a0d2e 50%, #8d1046 100%)',
    destaque: '#ff8fb1',
    tom: 'escuro',
  },
  mata: {
    nome: 'Mata',
    fundo: 'linear-gradient(135deg, #07170f 0%, #14432a 50%, #1f7a4d 100%)',
    destaque: '#7ce0a4',
    tom: 'escuro',
  },
  cosmos: {
    nome: 'Cosmos',
    fundo: 'linear-gradient(135deg, #0b0524 0%, #2b1055 45%, #7597de 100%)',
    destaque: '#c7a7ff',
    tom: 'escuro',
  },
  aco: {
    nome: 'Aço',
    fundo: 'linear-gradient(135deg, #14161a 0%, #2b3038 50%, #4a525e 100%)',
    destaque: '#9fb3c8',
    tom: 'escuro',
  },
  ouro: {
    nome: 'Ouro velho',
    fundo: 'linear-gradient(135deg, #1b1402 0%, #5c4410 50%, #a9822a 100%)',
    destaque: '#ffd98a',
    tom: 'escuro',
  },
  gelo: {
    nome: 'Gelo',
    fundo: 'linear-gradient(135deg, #dfeaf5 0%, #a9c6e0 50%, #6f9ec4 100%)',
    destaque: '#0d3b5c',
    tom: 'claro',
  },
};

export const ARTE_PADRAO = 'aurora';

/** A arte de um código, ou a padrão. Nunca devolve indefinido: a tela sempre tem o que desenhar. */
export function acharArte(codigo: string | null | undefined): ArteDeBoasVindas {
  return (codigo && ARTES[codigo]) || ARTES[ARTE_PADRAO];
}
