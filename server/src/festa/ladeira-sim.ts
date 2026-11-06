/**
 * A LADEIRA DAS ABÓBORAS, A CONTA (lote 6, 05/11/2026): quem sobe, por onde, e quem a abóbora derruba. DUAS CÓPIAS IGUAIS
 * BYTE A BYTE: server/src/festa/ladeira-sim.ts e web/src/festa/ladeira-sim.ts (server/test/festa-ladeira.test.ts confere).
 *
 * Tudo em inteiros, num passo fixo de PASSO_MS: a mesma lista de abóboras e as mesmas trocas de faixa dão a mesma subida nos
 * dois lados, sem depender de quem mandou o quê primeiro. O servidor é o juiz; a tela faz a mesma conta para mostrar na hora.
 */

/** O passo da conta (ms). */
export const PASSO_MS = 10;
export const FAIXAS = 3;
/** A chegada lá em cima, e de onde a abóbora sai (acima da chegada: a abóbora nunca nasce em cima de ninguém). */
export const META = 120_000;
export const TOPO = 150_000;
/** Quanto o coelho sobe por passo (a ladeira inteira em 12 s). */
export const SUBIDA = 100;
/** Quanto a abóbora desce por passo (do topo ao pé em ~1,9 s). */
export const DESCIDA = 800;
/** A abóbora aparece erguida por isto antes de rolar (todos a veem antes de ela vir). */
export const ERGUIDA_MS = 500;
/** A abóbora pega quem está a menos disto dela, na mesma faixa. */
export const RAIO = 7_500;
/** Derrubado: fica tonto (não sobe nem troca de faixa) e protegido (nenhuma abóbora o pega) por um tempo. */
export const TONTO_MS = 900;
export const PROTEGIDO_MS = 1_400;
/** Trocar de faixa leva isto, e no meio do caminho o coelho está nas duas (a abóbora das duas o pega). */
export const TROCA_MS = 120;
/** Quanto a abóbora derruba, pelo tamanho do grupo (com menos gente subindo, cada batida pesa menos). */
export const tombo = (grupo: number) => (grupo <= 1 ? 12_000 : grupo === 2 ? 13_000 : 14_000);

export interface Abobora {
  /** Quando foi erguida (ms desde o começo, relógio do servidor). */
  l: number;
  faixa: number;
}
export interface Troca {
  /** Quando (ms desde o começo, na tela de quem trocou). */
  t: number;
  faixa: number;
}
export interface Subida {
  /** A altura (0 no pé, META na chegada). */
  y: number;
  faixa: number;
  /** Trocando de faixa: de onde veio, e até quando está no meio do caminho (ms). */
  veio: number;
  trocaAte: number;
  /** Tonto até, e protegido até (ms). */
  tonto: number;
  protegido: number;
  /** Quando chegou lá em cima (ms), ou null. */
  chegou: number | null;
  batidas: number;
}

/** O passo em que a abóbora começa a rolar. */
export const rolaEm = (a: Abobora) => Math.floor((a.l + ERGUIDA_MS) / PASSO_MS);
/** A altura da abóbora no passo `s` (TOPO antes de rolar). */
export const alturaDaAbobora = (a: Abobora, s: number) => TOPO - DESCIDA * Math.max(0, s - rolaEm(a));

/** A subida de um coelho até `ate` (ms), com as abóboras e as trocas de faixa dele, começando na faixa `faixa`. */
export function subir(aboboras: Abobora[], trocas: Troca[], ate: number, faixa: number, grupo: number): Subida {
  const c: Subida = { y: 0, faixa, veio: faixa, trocaAte: -1, tonto: -1, protegido: -1, chegou: null, batidas: 0 };
  const pegou = new Set<number>();
  let k = 0;
  const fim = Math.floor(ate / PASSO_MS);
  for (let s = 1; s <= fim; s++) {
    const t = s * PASSO_MS;
    // as trocas até aqui (a de quem está tonto, ou ainda no meio de outra troca, não vale; só para a faixa do lado)
    while (k < trocas.length && trocas[k].t <= t) {
      const f = trocas[k].faixa;
      if (t >= c.tonto && t >= c.trocaAte && Math.abs(f - c.faixa) === 1) {
        c.veio = c.faixa;
        c.faixa = f;
        c.trocaAte = trocas[k].t + TROCA_MS;
      }
      k++;
    }
    const nasDuas = t < c.trocaAte;
    if (c.chegou !== null) continue;
    if (t >= c.tonto) c.y += SUBIDA;
    if (c.y >= META) {
      c.y = META;
      c.chegou = t;
      continue;
    }
    if (t < c.protegido) continue;
    for (let i = 0; i < aboboras.length; i++) {
      const a = aboboras[i];
      if ((a.faixa !== c.faixa && !(nasDuas && a.faixa === c.veio)) || s < rolaEm(a) || pegou.has(i)) continue;
      const ya = alturaDaAbobora(a, s);
      if (ya < -RAIO || Math.abs(ya - c.y) >= RAIO) continue;
      pegou.add(i);
      c.y = Math.max(0, c.y - tombo(grupo));
      c.tonto = t + TONTO_MS;
      c.protegido = t + PROTEGIDO_MS;
      c.batidas++;
      break;
    }
  }
  return c;
}

/** A faixa em que cada um do grupo começa: espalhados (o do meio, e os outros dos lados). */
export const faixaInicial = (k: number) => [1, 0, 2][k % FAIXAS];
