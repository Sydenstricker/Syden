/**
 * O MODO ELIMINAÇÃO DOS COELHOS A JATO (20/11/2026, a segunda auditoria; só no Solo e só no site): ao fim de cada volta, menos a
 * última, a última nave a passar pela linha sai da corrida. A conta mora aqui, sem desenho, para o teste: o laço (laco.ts) a
 * chama a cada passo com quem ainda corre.
 */
export interface NaCorrida {
  /** −1 a pessoa, −100 − i os robôs (os ids da ordem do laço). */
  id: number;
  /** Quantas voltas já fechou. */
  voltas: number;
  /** O quanto andou (voltas com a fração), para desempatar quem passa no mesmo passo. */
  andou: number;
}

export function criarEliminacao(voltasDaCorrida: number) {
  /** Os que saíram, na ordem em que saíram. */
  const fora: number[] = [];
  let volta = 1;
  const passou = new Map<number, number>();
  return {
    fora,
    /** A volta em que a próxima saída vai acontecer. */
    get volta() {
      return volta;
    },
    /**
     * No passo `n`, com `vivos` (quem ainda corre, sem os que já saíram): devolve quem sai agora (ou null). Sai quem passou
     * por último pela linha da volta; no mesmo passo, quem andou menos. A última volta não elimina ninguém (é a chegada).
     */
    passo(n: number, vivos: NaCorrida[]): NaCorrida | null {
      if (volta >= voltasDaCorrida || vivos.length <= 1) return null;
      for (const v of vivos) if (v.voltas >= volta && !passou.has(v.id)) passou.set(v.id, n);
      if (!vivos.every((v) => passou.has(v.id))) return null;
      const ultima = vivos.reduce((a, b) => {
        const pa = passou.get(a.id)!, pb = passou.get(b.id)!;
        return pb > pa || (pb === pa && b.andou < a.andou) ? b : a;
      });
      fora.push(ultima.id);
      passou.clear();
      volta++;
      return ultima;
    },
  };
}
