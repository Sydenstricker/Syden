/**
 * O que os Coelhos a jato usam igual à Corrida dos coelhos, COPIADO dela (corrida/pista.ts, corrida/fisica.ts e
 * corrida/laco.ts) para um jogo não depender do outro enquanto cada um muda: o sorteio com semente, o fantasma, o tempo
 * legível e a posição de um rival entre duas que chegaram pela rede.
 */

/** Um sorteio que sai sempre igual para a mesma semente (mulberry32). */
export function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Um ângulo entre −π e π: a diferença entre dois ângulos pelo lado mais curto (o kart interpolava pelo lado longo na virada de π). */
const volta = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

/** De quantos em quantos passos o fantasma guarda uma posição (15 por segundo). */
const AMOSTRA = 4;

/** Onde o fantasma estava no passo `n` (entre duas amostras, no meio do caminho). Null depois do fim. */
export function fantasmaEm(amostras: number[], n: number): { x: number; y: number; angulo: number } | null {
  const total = amostras.length / 3;
  const f = n / AMOSTRA;
  const i = Math.floor(f);
  if (i >= total - 1) return null;
  const t = f - i;
  const a = i * 3, b = a + 3;
  return {
    x: (amostras[a] + (amostras[b] - amostras[a]) * t) / 10,
    y: (amostras[a + 1] + (amostras[b + 1] - amostras[a + 1]) * t) / 10,
    angulo: amostras[a + 2] / 1000 + volta((amostras[b + 2] - amostras[a + 2]) / 1000) * t,
  };
}

/** Passos em milissegundos, e o tempo como se lê: 1:05.43. */
export const passosEmMs = (passos: number) => Math.round((passos * 1000) / 60);
export function tempoLegivel(ms: number): string {
  const min = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${min}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export interface PosicaoDoRival {
  n: number;
  x: number;
  y: number;
  a: number;
  andou: number;
}

/** Onde um rival estava no passo `n`, entre duas posições; depois da última, um pouco à frente dela (no máximo 1/4 s). */
export function rivalEm<P extends PosicaoDoRival>(posicoes: P[], n: number): PosicaoDoRival | null {
  if (posicoes.length === 0) return null;
  let i = posicoes.length - 1;
  while (i > 0 && posicoes[i].n > n) i--;
  const a = posicoes[i];
  const b = posicoes[i + 1];
  if (b && b.n > a.n) {
    const t = Math.max(0, Math.min(1, (n - a.n) / (b.n - a.n)));
    return { n, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: a.a + volta(b.a - a.a) * t, andou: a.andou + (b.andou - a.andou) * t };
  }
  const antes = posicoes[i - 1];
  if (!antes || a.n <= antes.n || n <= a.n) return a;
  const passos = Math.min(n - a.n, 15) / (a.n - antes.n);
  return { n, x: a.x + (a.x - antes.x) * passos, y: a.y + (a.y - antes.y) * passos, a: a.a, andou: a.andou };
}
