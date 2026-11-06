/** SIGA O COELHO: a sequência de setas aparece, repete-se, e cresce uma seta a cada acerto. */
import { FOLGA_ACIMA, invalido, microjogo, numero } from './comum.js';

export const SIGA_MS = 40000;
export const SIGA_SETAS = 12;
/** Cada seta mostrada fica isto na tela (com o intervalo): o mínimo que uma sequência leva para ser vista. */
export const SIGA_PASSO_MS = 600;
/** A pausa da tela entre um nível e o próximo (web/src/festa/siga.tsx). */
export const SIGA_PAUSA_MS = 400;

export interface DadosSiga {
  /** 0 cima, 1 direita, 2 baixo, 3 esquerda. */
  setas: number[];
}

/** O mínimo que leva ver as sequências de 1 a n setas (sem contar o tempo de repetir). */
export const minimoDaSiga = (n: number) => ((n * (n + 1)) / 2) * SIGA_PASSO_MS + Math.max(0, n - 1) * SIGA_PAUSA_MS;

export default microjogo<DadosSiga>({
  id: 'siga',
  gerar: (aleatorio) => ({ setas: Array.from({ length: SIGA_SETAS }, () => Math.floor(aleatorio() * 4)) }),
  duracao: () => SIGA_MS + 1500,
  avaliar({ dados, corpo, passou, abaixo }) {
    const setas = dados.setas;
    const n = corpo.acertos;
    const digitadas = corpo.setas;
    if (!numero(n) || !Number.isInteger(n) || n < 0 || n > setas.length || !Array.isArray(digitadas)) return invalido();
    if (digitadas.length < n || digitadas.length > n + 1) return invalido();
    // a última sequência completa bate com a do servidor
    for (let i = 0; i < n; i++) if (digitadas[i] !== setas[i]) return invalido();
    // e houve tempo de ver todas as sequências até ela
    if (passou + FOLGA_ACIMA < minimoDaSiga(n)) return invalido();
    if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
    // o tempo (que só desempata) não fica abaixo do mínimo de ver as setas, nem fora do que o servidor viu passar
    const minimo = Math.max(minimoDaSiga(n), passou - abaixo);
    const ms = numero(corpo.ms) ? Math.round(Math.min(Math.max(corpo.ms, minimo), passou + FOLGA_ACIMA)) : passou;
    return { motivo: null, valor: n, chave: [-n, ms] };
  },
  robo(_d, aleatorio, passouMs) {
    // nunca mais sequências do que dava para repetir no tempo que a rodada durou (revisão independente, 05/11/2026: a pessoa
    // que responde logo revela a rodada, e o robô dizia ter feito 9 em 30 s)
    let n = 3 + Math.floor(aleatorio() * 7);
    while (n > 0 && minimoDaSiga(n) + 1500 > passouMs) n--;
    if (n === 0) return { motivo: null, valor: 0, chave: [0, Math.round(passouMs)] };
    const ms = Math.round(Math.min(passouMs, minimoDaSiga(n) + 1500 + aleatorio() * 3000));
    return { motivo: null, valor: n, chave: [-n, ms] };
  },
});
