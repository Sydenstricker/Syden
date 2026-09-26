import { useSyncExternalStore } from 'react';
import ourUrl from './assets/logo.png';
import bigUrl from './assets/logo-big.png';

// Qual coelho é o SEU Syden.
//
// São dois: o OurBunny, esguio, que é o padrão, e o BigChunkus, o gordinho. A escolha vale para o ícone
// na barra lateral, para a tela de entrada e para a estátua da praça na tela inicial — é sempre o mesmo
// bicho, para o app não ficar com duas caras ao mesmo tempo. Fica só neste computador.

export type Coelho = 'our' | 'big';

export const COELHOS: { id: Coelho; nome: string; sobre: string; url: string }[] = [
  { id: 'our', nome: 'OurBunny', sobre: 'O coelho de sempre do Syden', url: ourUrl },
  { id: 'big', nome: 'BigChunkus', sobre: 'O gordinho, para quem gosta de bochecha', url: bigUrl },
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

export function urlDoCoelho(id: Coelho = atual): string {
  return COELHOS.find((c) => c.id === id)?.url ?? ourUrl;
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
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** O coelho escolhido, acompanhando as mudanças (o ícone troca na hora, sem recarregar). */
export function useCoelho(): Coelho {
  return useSyncExternalStore(assinar, coelhoAtual);
}
