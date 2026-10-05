import { useSyncExternalStore } from 'react';
import { guardarEmBreve } from './preferencias';

// Qual coelho fica na estátua da praça.
//
// São dois: o OurBunny, esguio, que é o padrão, e o BigChunkus, o gordinho. Até o rebrand de 05/10/2026
// a escolha trocava também o ícone e a tela de entrada; hoje troca SÓ o coelho. Ícone e logo são o D4,
// fixo (ver Logo.tsx). A escolha sobe para o servidor, então segue com a pessoa ao trocar de navegador
// ou ir do site para o aplicativo.

export type Coelho = 'our' | 'big';

export const COELHOS: { id: Coelho; nome: string; sobre: string }[] = [
  { id: 'our', nome: 'OurBunny', sobre: 'O coelho de sempre do Syden' },
  { id: 'big', nome: 'BigChunkus', sobre: 'O gordinho, para quem gosta de bochecha' },
];

const CHAVE = 'syden.coelho';
/** A escolha morava aqui quando só a estátua trocava de coelho; quem já tinha escolhido não perde nada. */
const CHAVE_ANTIGA = 'syden.estatua';

function ler(): Coelho {
  try {
    const guardado = localStorage.getItem(CHAVE);
    if (guardado === 'our' || guardado === 'big') return guardado;
    if (localStorage.getItem(CHAVE_ANTIGA) === 'big') return 'big';
  } catch {
    // sem armazenamento: vale o padrão
  }
  return 'our';
}

let atual = ler();
const ouvintes = new Set<() => void>();

export function coelhoAtual(): Coelho {
  return atual;
}

export function escolherCoelho(id: Coelho) {
  if (id === atual) return;
  atual = id;
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // sem armazenamento: vale até fechar
  }
  for (const ouvinte of ouvintes) ouvinte();
  guardarEmBreve();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** O coelho escolhido, acompanhando as mudanças (a estátua troca na hora, sem recarregar). */
export function useCoelho(): Coelho {
  return useSyncExternalStore(assinar, coelhoAtual);
}
