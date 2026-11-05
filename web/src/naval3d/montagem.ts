/**
 * A REGRA DA MONTAGEM da Batalha naval na tela (as mesmas contas de server/src/minijogo-naval.ts: `casasDoNavio` e `encosta`),
 * para o fantasma dizer na hora se o navio cabe. Quem decide continua sendo o servidor.
 */

export const LADO_DO_MAR = 10;
/** Os navios, na ordem em que o servidor os guarda: 5, 4, 3, 3 e 2 casas. */
export const FROTA = [5, 4, 3, 3, 2] as const;

/** As casas de um navio de `tamanho` que começa em `casa` (a de cima, ou a da esquerda), ou null se ele sai do mar. */
export function casasDoNavio(casa: number, tamanho: number, deitado: boolean): number[] | null {
  const n = LADO_DO_MAR;
  if (!Number.isInteger(casa) || casa < 0 || casa >= n * n) return null;
  const l = Math.floor(casa / n);
  const c = casa % n;
  if (deitado ? c + tamanho > n : l + tamanho > n) return null;
  return Array.from({ length: tamanho }, (_, k) => (deitado ? casa + k : casa + k * n));
}

/** Se as casas encostam (ou caem em cima) de algum dos outros navios, também na diagonal. */
export function encosta(casas: number[], outros: (number[] | null)[]): boolean {
  const n = LADO_DO_MAR;
  const ocupadas = new Set(outros.flatMap((x) => x ?? []));
  return casas.some((c) => {
    const l = Math.floor(c / n);
    const col = c % n;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        const ll = l + dl;
        const cc = col + dc;
        if (ll >= 0 && ll < n && cc >= 0 && cc < n && ocupadas.has(ll * n + cc)) return true;
      }
    }
    return false;
  });
}

/**
 * A primeira casa do navio de `tamanho` quando a casa `pega` dele (0: a primeira) fica sobre `casa`, empurrado para dentro do
 * mar: tocar perto da borda põe o navio encostado nela, em vez de recusar.
 */
export function inicioDoNavio(casa: number, pega: number, tamanho: number, deitado: boolean): number {
  const n = LADO_DO_MAR;
  const l = Math.floor(casa / n);
  const c = casa % n;
  const limitar = (v: number) => Math.max(0, Math.min(n - tamanho, v));
  return deitado ? l * n + limitar(c - pega) : limitar(l - pega) * n + c;
}
