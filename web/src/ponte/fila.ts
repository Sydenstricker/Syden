/**
 * A FILA DO TRÁFEGO, SÓ PARA O DESENHO (06/11/2026, relato dele: "o jogador não sabe qual veículo precisa passar"). Desde a
 * montagem, os veículos da fase esperam na margem de partida, NA ORDEM em que vão passar (o primeiro mais perto da ponte), e cada
 * um com o selo do peso.
 *
 * A regra (sim.ts) põe todos os que esperam no mesmo ponto (SAIDA) e solta um de cada vez; aqui, quem ainda não saiu aparece
 * atrás do da frente, encostado, e vai andando até a SAIDA na velocidade dele quando a fila anda. Por isso nada pula: quando a regra
 * solta o veículo, ele já está na SAIDA. Quem saiu é desenhado onde a regra diz. Nada daqui volta à regra.
 */
import { ESPERANDO, PAROU, SAIDA, VEICULOS, type Fase, type IdDoVeiculo, type Sim } from './sim';

/** A folga entre um veículo e o de trás, na fila (em casas). */
const FOLGA = 0.35;

/**
 * Quanto cada veículo ocupa NA TELA atrás e na frente do ponto em que a regra o apoia (em casas): a carroça tem o coelho que a puxa
 * lá na frente, na ponta do cabo.
 */
export const TAMANHO_NA_TELA: Record<IdDoVeiculo, { tras: number; frente: number }> = {
  carroca: { tras: 0.75, frente: 1.6 },
  carro: { tras: 0.85, frente: 0.85 },
  caminhao: { tras: 1.35, frente: 1.35 },
};

/** O centro do veículo `i` encostado atrás do `i − 1` (que está em `x`). */
const atras = (t: readonly IdDoVeiculo[], i: number, x: number) => x - TAMANHO_NA_TELA[t[i - 1]].tras - TAMANHO_NA_TELA[t[i]].frente - FOLGA;

/** Onde cada veículo espera antes de tudo começar (o centro dele; o primeiro na SAIDA). */
export function filaInicial(f: Fase): number[] {
  const x: number[] = [];
  f.trafego.forEach((_, i) => {
    x.push(i === 0 ? SAIDA : atras(f.trafego, i, x[i - 1]));
  });
  return x;
}

/** Até onde a fila vai para trás (a traseira do último), para o enquadramento. */
export function fimDaFila(f: Fase): number {
  const x = filaInicial(f);
  const n = x.length - 1;
  return n < 0 ? SAIDA : x[n] - TAMANHO_NA_TELA[f.trafego[n]].tras;
}

/** Ainda não saiu da margem (esperando, ou parado lá porque alguém caiu). */
export function naFila(s: Sim, i: number): boolean {
  const v = s.veiculos[i];
  return (v.estado === ESPERANDO || v.estado === PAROU) && v.x <= SAIDA + 1e-6;
}

/** As posições do desenho, para uma simulação (uma por veículo), que andam com `atualizar`. */
export class Fila {
  private sim: Sim | null = null;
  x: number[];

  constructor(private fase: Fase) {
    this.x = filaInicial(fase);
  }

  /** A fila parada da montagem. */
  parada(): number[] {
    this.sim = null;
    this.x = filaInicial(this.fase);
    return this.x;
  }

  atualizar(s: Sim, dt: number): number[] {
    if (s !== this.sim) {
      this.sim = s;
      this.x = filaInicial(this.fase);
    }
    const t = this.fase.trafego;
    for (let i = 0; i < s.veiculos.length; i++) {
      if (!naFila(s, i)) {
        this.x[i] = s.veiculos[i].x;
        continue;
      }
      const alvo = i === 0 ? SAIDA : Math.min(SAIDA, atras(t, i, this.x[i - 1]));
      // a fila "encosta" um pouco mais depressa que a velocidade de cada um, para ninguém ficar para trás do da frente
      if (alvo > this.x[i]) this.x[i] = Math.min(alvo, this.x[i] + 1.6 * VEICULOS[t[i]].velocidade * dt);
    }
    return this.x;
  }
}

/** O peso do veículo como se escreve no idioma da página ("2,5", "4", "8"). */
export function pesoEscrito(t: IdDoVeiculo): string {
  try {
    return new Intl.NumberFormat(document.documentElement.lang || undefined, { maximumFractionDigits: 1 }).format(VEICULOS[t].massa);
  } catch {
    return String(VEICULOS[t].massa);
  }
}
