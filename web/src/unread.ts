import { api } from './api';

// Mensagens não lidas das conversas privadas.
//
// ===================================================================================================
// ANTES ISTO FICAVA SÓ NO NAVEGADOR, E ERA O DEFEITO.
//
// O comentário antigo dizia: "fica no computador de cada um (localStorage) […] é o bastante para a
// bolinha vermelha e não custa nada ao servidor". Está certo para quem usa um lugar só — e o relato
// veio de quem usa dois: lê no navegador, abre o app de desktop, e TUDO aparece como novo.
//
// Não era um defeito de sincronização. NUNCA HOUVE NADA PARA SINCRONIZAR: o app de desktop tem
// armazenamento próprio, separado do navegador por construção, então os dois marcadores jamais se
// encontraram.
//
// Agora quem manda é o servidor (`channel_members.last_read_id`), que é o mesmo para todos os
// aparelhos da pessoa.
//
// O LOCAL CONTINUA AQUI, E NÃO É REDUNDÂNCIA. Ele é o que faz a bolinha sumir NO MESMO INSTANTE do
// clique, sem esperar a ida e a volta da rede; e é o que segura o estado quando a rede falha. As duas
// fontes se combinam pelo MAIOR número lido — nunca pelo mais recente —, então nenhuma delas pode
// desfazer o que a outra já marcou.
// ===================================================================================================

const KEY = 'syden.lidas';

type Lidas = Record<number, number>;

function load(): Lidas {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Lidas;
  } catch {
    return {};
  }
}

let seen: Lidas = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // sem armazenamento: vale só até fechar o app
  }
  for (const listener of listeners) listener();
}

/** Até onde esta pessoa leu, juntando o que o servidor sabe com o que este aparelho acabou de fazer. */
function lidoAte(channel: { id: number; lastReadId?: number | null }): number {
  return Math.max(channel.lastReadId ?? 0, seen[channel.id] ?? 0);
}

/**
 * Marca a conversa como lida até a mensagem informada.
 *
 * Grava local PRIMEIRO e avisa o servidor depois, sem esperar: a bolinha não pode piscar enquanto a
 * rede responde. Se o aviso falhar, o local segura até a próxima leitura — o pior caso é a bolinha
 * voltar no OUTRO aparelho, que é exatamente o que acontecia antes em todos eles.
 */
export function markRead(channelId: number, lastMessageId: number | null) {
  if (lastMessageId === null) return;
  if ((seen[channelId] ?? 0) >= lastMessageId) return;
  seen = { ...seen, [channelId]: lastMessageId };
  save();
  void api(`/api/direct/${channelId}/lido`, { method: 'PUT', body: { lastMessageId } }).catch(() => {});
}

/** Tem mensagem nova nesta conversa? */
export function isUnread(channel: { id: number; lastMessageId: number | null; lastReadId?: number | null }): boolean {
  return channel.lastMessageId !== null && channel.lastMessageId > lidoAte(channel);
}

/** Quantas conversas têm mensagem nova. */
export function countUnread(channels: { id: number; lastMessageId: number | null; lastReadId?: number | null }[]): number {
  return channels.filter(isUnread).length;
}

/** Esquece as conversas que não existem mais, para o armazenamento não crescer à toa. */
export function forgetMissing(existing: number[]) {
  const vivos = new Set(existing);
  const limpo = Object.fromEntries(Object.entries(seen).filter(([id]) => vivos.has(Number(id))));
  if (Object.keys(limpo).length !== Object.keys(seen).length) {
    seen = limpo as Lidas;
    save();
  }
}

export function subscribeUnread(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
