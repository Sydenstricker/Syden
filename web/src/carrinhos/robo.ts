import { FOLGA, pilotoAutomatico, querTrocar, trechoEm, TROCA, type Carro, type Trecho } from './sim';
import type { Dificuldade } from '../corrida/robos';

/**
 * A HABILIDADE DOS ROBÔS POR DIFICULDADE (20/11/2026), um número por robô (o primeiro, o segundo e o terceiro). O médio é o de
 * antes. Medido em 20/11/2026 nas cinco pistas prontas, 24 corridas por valor, contra o tempo do piloto quase perfeito (margem
 * 0,15): 0,35–0,5 ficam 9–16% atrás; o médio de antes, 3–9%; 1,1–1,2 ficam a 0,3–1,8%, ou seja, À FRENTE do piloto dos testes
 * (margem 0,3: 1,4–2,1% atrás), errando menos de uma vez por corrida. Acima de 1, a margem fica perto de zero (às vezes um
 * pouco negativa, dentro da folga: o carro treme, mas não sai).
 */
export const HABILIDADE_DOS_ROBOS: Record<Dificuldade, number[]> = {
  facil: [0.5, 0.42, 0.35],
  medio: [0.92, 0.8, 0.68],
  dificil: [1.2, 1.15, 1.1],
};

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
    const t = trechoEm(c.pista, c.faixa, c.s);
    if (t !== trecho) {
      trecho = t;
      const erro = aleatorio() < 0.03 * (1.3 - habilidade);
      margem = erro ? -(FOLGA + 0.3 + aleatorio() * 0.6) : 0.15 + (1 - habilidade) * 0.9 + aleatorio() * 0.35;
    }
    // na pista com agulha, o robô troca de faixa como o piloto automático (24/11/2026)
    return pilotoAutomatico(c, margem) + (querTrocar(c) !== c.armado ? TROCA : 0);
  };
}
