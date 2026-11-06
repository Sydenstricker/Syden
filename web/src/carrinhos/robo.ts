import { FOLGA, pilotoAutomatico, trechoEm, type Carro, type Trecho } from './sim';

/**
 * OS ROBÔS DAS OUTRAS FAIXAS (no Solo): o piloto automático de sim.ts, com uma MARGEM sorteada a cada trecho da pista (quanto
 * abaixo da velocidade da curva ele mira) e, de vez em quando, um ERRO: a margem negativa, maior que a folga, e o carro sai.
 * A `habilidade` (0 a 1) aproxima a margem do limite e erra menos. É só do site: o servidor não vê os robôs.
 */
export function criarRobo(semente: number, habilidade: number) {
  let s = semente >>> 0 || 1;
  const aleatorio = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let trecho: Trecho | null = null;
  let margem = 0.5;
  return (c: Carro): number => {
    const t = trechoEm(c.faixa, c.s);
    if (t !== trecho) {
      trecho = t;
      const erro = aleatorio() < 0.03 * (1.3 - habilidade);
      margem = erro ? -(FOLGA + 0.3 + aleatorio() * 0.6) : 0.15 + (1 - habilidade) * 0.9 + aleatorio() * 0.35;
    }
    return pilotoAutomatico(c, margem);
  };
}
