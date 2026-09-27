import { useSyncExternalStore } from 'react';
import { api } from './api';

/**
 * Quem está bloqueado, do ponto de vista de quem está usando o Syden agora.
 *
 * A lista vive num lugar só e todas as telas leem dela. O motivo é a natureza da coisa: bloqueio que
 * vale em alguns cantos e não em outros não é bloqueio — é inconveniência. Se cada tela buscasse a
 * sua cópia, uma delas ficaria para trás depois de um bloqueio novo, e seria justamente a que mostra
 * a mensagem que a pessoa não quer ver.
 *
 * A lista inclui OS DOIS SENTIDOS: quem eu bloqueei e quem me bloqueou. Do lado de quem usa a tela,
 * o efeito é o mesmo — aquela pessoa some —, e quem me bloqueou não deve ser distinguível de quem eu
 * bloqueei, senão a tela contaria que fui bloqueado.
 */

let bloqueados = new Set<number>();
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function estaBloqueado(userId: number): boolean {
  return bloqueados.has(userId);
}

export function idsBloqueados(): ReadonlySet<number> {
  return bloqueados;
}

export function guardarBloqueados(ids: number[]) {
  bloqueados = new Set(ids);
  avisar();
}

/** Busca a lista no servidor. Chamado ao entrar e a cada aviso de mudança. */
export async function carregarBloqueios() {
  try {
    const lista = await api<{ userId: number }[]>('/api/me/bloqueios');
    // A rota devolve só quem EU bloqueei. Quem me bloqueou chega junto com o diretório de pessoas,
    // porque o servidor já esconde essas conversas — aqui basta o que a tela precisa esconder.
    guardarBloqueados(lista.map((b) => b.userId));
  } catch {
    // Sem rede, vale a lista que já está em memória: melhor manter escondido do que revelar por erro.
  }
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** O conjunto de bloqueados, acompanhando as mudanças. */
export function useBloqueados(): ReadonlySet<number> {
  return useSyncExternalStore(assinar, idsBloqueados);
}
