/** A conta da alavanca virtual (toqueDosJogos.tsx), à parte para o teste a importar sem o CSS. */

export interface Direcoes {
  cima: boolean;
  baixo: boolean;
  esquerda: boolean;
  direita: boolean;
}

/**
 * As oito direções da alavanca: dentro da zona morta, nenhuma; fora dela, o setor de 45° em que o dedo está (as diagonais ligam
 * as duas direções vizinhas).
 */
export function direcoesDaAlavanca(x: number, y: number, zona = 0.3): Direcoes {
  const nada = { cima: false, baixo: false, esquerda: false, direita: false };
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < zona) return nada;
  // o ângulo em graus, 0 à direita e 90 para cima (o y da tela desce)
  const g = (Math.atan2(-y, x) * 180) / Math.PI;
  return {
    direita: g > -67.5 && g < 67.5,
    esquerda: g > 112.5 || g < -112.5,
    cima: g > 22.5 && g < 157.5,
    baixo: g < -22.5 && g > -157.5,
  };
}
