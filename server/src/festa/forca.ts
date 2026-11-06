/** MEDIDOR DE FORÇA: a barra sobe e desce, e para no aperto; vale o mais perto de 100%. */
import { invalido, microjogo, numero } from './comum.js';

export const FORCA_MS = 8000;

export interface DadosForca {
  /** Uma ida e volta da barra (0 → 100 → 0), em ms. */
  periodoMs: number;
}

/** O valor da barra de força no tempo t (ms desde o começo): uma onda triangular de 0 a 100. */
export function valorDaForca(periodoMs: number, t: number): number {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 100 * (1 - Math.abs(fase * 2 - 1));
}

export default microjogo<DadosForca>({
  id: 'forca',
  gerar: (aleatorio) => ({ periodoMs: 1100 + Math.floor(aleatorio() * 600) }),
  // a mesma folga da siga e do alvo (revisão independente, 03/11/2026): sem ela, o aperto honesto no fim da barra, que a
  // tela deu como feito, chegava depois da revelação e não contava
  duracao: () => FORCA_MS + 1500,
  avaliar({ dados, corpo, cabe }) {
    const t = corpo.t;
    // o tempo dito tem de ser o de agora (com a folga da rede): não vale calcular o perfeito e mandar depois
    if (!numero(t) || t < 0 || t > FORCA_MS || !cabe(t)) return invalido();
    const v = Math.round(valorDaForca(dados.periodoMs, t) * 10) / 10;
    return { motivo: null, valor: v, chave: [100 - v] };
  },
  robo(_d, aleatorio) {
    const v = Math.round((60 + aleatorio() * 38) * 10) / 10;
    return { motivo: null, valor: v, chave: [100 - v] };
  },
});
