import { useSyncExternalStore } from 'react';

/**
 * QUEM ESTÁ NA SALA DE VOZ EM QUE EU ESTOU, para a janela dos dados (DadosDialog.tsx) oferecer "quem começa?" e "times"
 * com essa gente, sem passar a lista por todas as telas do meio. A Shell publica; a janela lê. Só nomes, só da sala em que a
 * própria pessoa está conectada, e só na memória.
 */
let nomes: string[] = [];
const ouvintes = new Set<() => void>();

export function definirPessoasNaSala(novos: string[]) {
  if (novos.length === nomes.length && novos.every((n, i) => n === nomes[i])) return;
  nomes = novos;
  for (const f of ouvintes) f();
}

export function usePessoasNaSala(): string[] {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => nomes,
  );
}
