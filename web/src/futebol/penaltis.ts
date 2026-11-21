/**
 * OS PÊNALTIS DA MINI-COPA (20/11/2026, a segunda auditoria): a copa do Solo virou mata-mata, e o empate se decide nos pênaltis.
 * Moram só no site, como a copa (o servidor recebe só o placar do último jogo). Simples e honesto, sem nada escondido:
 *
 * - CHUTAR: escolhe-se o canto (esquerda, meio, direita) e a força, numa barra que vai e volta. Fraca demais (abaixo de
 *   FRACA), o goleiro pega sempre; forte demais (acima de ALTA), vai por cima. No meio da barra, o goleiro só pega se for
 *   para o mesmo lado; e no CANTO com força de verdade (de FORTE até ALTA), nem assim.
 * - O GOLEIRO ROBÔ adivinha o lado pelo sorteio, com mais acerto a cada jogo da copa (`acertoDoGoleiro`).
 * - DEFENDER: o robô chuta num canto sorteado (e às vezes para fora); quem joga escolhe para onde pular.
 * - Cinco para cada lado, alternando (quem joga começa); acaba antes se não há mais como virar; empatou, um para cada até
 *   alguém errar (as "alternadas").
 */

export type Canto = 0 | 1 | 2;
export type Saida = 'gol' | 'defesa' | 'fora';

export const COBRANCAS = 5;
export const FRACA = 0.25;
export const FORTE = 0.72;
export const ALTA = 0.92;
/** O robô que cobra erra o gol (para fora) nesta chance. */
export const FORA_DO_ROBO = 0.1;

/** A chance de o goleiro robô pular para o lado certo, pelo jogo da copa (0, 1, 2): um terço é o chute puro. */
export const acertoDoGoleiro = (nivel: number) => [0.3, 0.38, 0.46][Math.max(0, Math.min(2, nivel))];

/** O chute de quem joga: o canto, a força (0 a 1) e para onde o goleiro pulou. */
export function chute(canto: Canto, forca: number, mergulho: Canto): Saida {
  if (forca > ALTA) return 'fora';
  if (forca < FRACA) return 'defesa';
  if (mergulho !== canto) return 'gol';
  return canto !== 1 && forca >= FORTE ? 'gol' : 'defesa';
}

/** Para onde o goleiro robô pula: o canto certo com a chance do nível, senão um dos outros dois. */
export function mergulhoDoGoleiro(canto: Canto, nivel: number, aleatorio = Math.random): Canto {
  if (aleatorio() < acertoDoGoleiro(nivel)) return canto;
  const outros = ([0, 1, 2] as Canto[]).filter((c) => c !== canto);
  return outros[aleatorio() < 0.5 ? 0 : 1];
}

/** O chute do robô: o canto sorteado, e se vai para fora. */
export function chuteDoRobo(aleatorio = Math.random): { canto: Canto; fora: boolean } {
  return { canto: Math.min(2, Math.floor(aleatorio() * 3)) as Canto, fora: aleatorio() < FORA_DO_ROBO };
}

/** A defesa de quem joga: pulou para o canto do chute do robô. */
export const defesa = (robo: { canto: Canto; fora: boolean }, pulo: Canto): Saida => (robo.fora ? 'fora' : robo.canto === pulo ? 'defesa' : 'gol');

/**
 * Quem ganhou, se já está decidido: 0 quem joga, 1 o robô, null segue. `meus` e `deles` são as cobranças feitas (true: gol),
 * na ordem; quem joga cobra primeiro em cada par.
 */
export function decidido(meus: boolean[], deles: boolean[]): 0 | 1 | null {
  const g = (l: boolean[]) => l.filter(Boolean).length;
  const a = g(meus);
  const b = g(deles);
  if (meus.length <= COBRANCAS && deles.length <= COBRANCAS) {
    // nas cinco: acaba quando um não alcança mais o outro com o que falta
    const faltaMeus = COBRANCAS - meus.length;
    const faltaDeles = COBRANCAS - deles.length;
    if (a + faltaMeus < b) return 1;
    if (b + faltaDeles < a) return 0;
    if (faltaMeus === 0 && faltaDeles === 0 && a !== b) return a > b ? 0 : 1;
    return null;
  }
  // as alternadas: depois de cada par, quem fez mais ganha
  if (meus.length === deles.length && a !== b) return a > b ? 0 : 1;
  return null;
}
