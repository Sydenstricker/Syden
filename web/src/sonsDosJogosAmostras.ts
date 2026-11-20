import type { Efeito } from './somDosJogos';

/**
 * AS AMOSTRAS DOS EFEITOS DOS MINI-GAMES (20/11/2026): que arquivo de web/public/sons/ toca cada efeito. São gravações dos
 * pacotes de áudio da Kenney (CC0; a origem de cada uma em web/public/sons/FONTES.txt, as licenças ao lado), tiradas por
 * web/scripts/sons-dos-jogos.mjs, que também tira o silêncio do começo e leva o pico a −1 dB.
 *
 * `n` é quantas versões o efeito tem (`<efeito>-1.ogg` … `<efeito>-n.ogg`; cada toque sorteia uma, para o mesmo golpe não
 * soar sempre igual), `vol` o volume relativo (as gravações têm o mesmo pico, mas um baralho é bem mais baixo que um bipe), e
 * `variar: false` tira a variação de altura (as vinhetas são música: desafinar soaria errado).
 *
 * O efeito que NÃO está aqui continua sintetizado (água, derrapagem, serra, chiado da chapa e torcida: nenhum dos pacotes tem um
 * que sirva), e todo efeito cai no sintetizado enquanto a amostra não chegou, ou se ela falhar. Isto fica num arquivo à parte, sem
 * nada de navegador, para o teste conferir a tabela sem abrir um contexto de áudio.
 */
export interface Amostra {
  n: number;
  vol: number;
  variar?: false;
}

export const AMOSTRAS: Partial<Record<Efeito, Amostra>> = {
  clique: { n: 3, vol: 0.7 },
  vez: { n: 1, vol: 0.9 },
  pulo: { n: 2, vol: 0.5 },
  mola: { n: 1, vol: 0.6 },
  queda: { n: 1, vol: 0.6 },
  moeda: { n: 1, vol: 0.55 },
  acerto: { n: 2, vol: 0.7 },
  erro: { n: 2, vol: 0.75 },
  dado: { n: 3, vol: 1.6 },
  carta: { n: 3, vol: 1.6 },
  tacada: { n: 3, vol: 1.2 },
  buraco: { n: 1, vol: 0.9, variar: false },
  tiro: { n: 3, vol: 0.9 },
  soco: { n: 3, vol: 1 },
  combo: { n: 1, vol: 0.55 },
  chegada: { n: 1, vol: 0.85, variar: false },
  empurrao: { n: 2, vol: 0.9 },
  bandeira: { n: 1, vol: 0.7 },
  encaixe: { n: 3, vol: 1.2 },
  rangido: { n: 3, vol: 1.2 },
  quebra: { n: 2, vol: 1.2 },
  impacto: { n: 3, vol: 1 },
  derrota: { n: 1, vol: 0.65 },
  dano: { n: 2, vol: 1.2 },
  explosao: { n: 3, vol: 0.8 },
  turbo: { n: 1, vol: 0.9 },
  item: { n: 2, vol: 0.65 },
  cura: { n: 1, vol: 0.65 },
  largada: { n: 1, vol: 0.7 },
  alarme: { n: 1, vol: 0.7 },
  medalha: { n: 1, vol: 0.85, variar: false },
  desliza: { n: 3, vol: 1.4 },
  fim: { n: 1, vol: 0.85, variar: false },
};

/** Os nomes dos arquivos de um efeito, relativos a web/public/ (vazio: o efeito é só sintetizado). */
export function arquivosDoEfeito(efeito: Efeito): string[] {
  const a = AMOSTRAS[efeito];
  return a ? Array.from({ length: a.n }, (_, i) => `sons/${efeito}-${i + 1}.ogg`) : [];
}
