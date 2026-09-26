import { useSyncExternalStore } from 'react';

// Notas sobre as pessoas: "é o irmão do Léo", "joga de suporte", "me deve 20 pratas". Ficam SÓ neste
// computador e SÓ para quem escreveu — nada vai para o servidor, ninguém mais vê. É a mesma ideia da
// anotação do Discord, e serve para quem tem dez amigos com nome de guerra impossível de decorar.

const CHAVE = 'syden.notas';
const LIMITE = 240;

type Notas = Record<string, string>;

function ler(): Notas {
  try {
    const cru = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    return cru && typeof cru === 'object' ? (cru as Notas) : {};
  } catch {
    return {};
  }
}

let atual = ler();
const ouvintes = new Set<() => void>();

export function notaDe(userId: number): string {
  return atual[String(userId)] ?? '';
}

/** Guarda (ou apaga, se vier vazia) a nota de alguém. */
export function guardarNota(userId: number, texto: string) {
  const limpo = texto.trim().slice(0, LIMITE);
  const proximo = { ...atual };
  if (limpo) proximo[String(userId)] = limpo;
  else delete proximo[String(userId)];
  atual = proximo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    // Sem armazenamento: a nota vale só até fechar o app.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** A nota de alguém, acompanhando as mudanças (o cartão de perfil e o menu usam a mesma). */
export function useNota(userId: number): string {
  return useSyncExternalStore(assinar, () => atual[String(userId)] ?? '');
}

export const LIMITE_DA_NOTA = LIMITE;
