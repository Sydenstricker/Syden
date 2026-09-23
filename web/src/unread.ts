// Mensagens não lidas das conversas privadas. Fica no computador de cada um (localStorage): guardamos o
// número da última mensagem que a pessoa viu em cada conversa, e o que passar disso conta como novo.
// É o bastante para a bolinha vermelha e não custa nada ao servidor.

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

/** Marca a conversa como lida até a mensagem informada. */
export function markRead(channelId: number, lastMessageId: number | null) {
  if (lastMessageId === null) return;
  if ((seen[channelId] ?? 0) >= lastMessageId) return;
  seen = { ...seen, [channelId]: lastMessageId };
  save();
}

/** Tem mensagem nova nesta conversa? */
export function isUnread(channel: { id: number; lastMessageId: number | null }): boolean {
  return channel.lastMessageId !== null && channel.lastMessageId > (seen[channel.id] ?? 0);
}

/** Quantas conversas têm mensagem nova. */
export function countUnread(channels: { id: number; lastMessageId: number | null }[]): number {
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
