// Pequenas transformações da lista de mensagens, usadas tanto pelo canal quanto pelo painel de tópico.
import type { Message, Poll, ThreadSummary } from './types';

/** O que o servidor manda quando alguém vota: só a contagem — quem votou no quê é de cada um. */
export interface PollTally {
  pollId: number;
  channelId: number;
  closed: boolean;
  voters: number;
  options: { id: number; votes: number }[];
}

/** Aplica os votos que chegaram de outra pessoa sem mexer no "você votou aqui". */
export function applyTally(list: Message[], tally: PollTally): Message[] {
  return list.map((message) => {
    if (message.poll?.id !== tally.pollId) return message;
    const votes = new Map(tally.options.map((o) => [o.id, o.votes]));
    const poll: Poll = {
      ...message.poll,
      closed: tally.closed,
      voters: tally.voters,
      options: message.poll.options.map((option) => ({ ...option, votes: votes.get(option.id) ?? option.votes })),
    };
    return { ...message, poll };
  });
}

export function replacePoll(list: Message[], poll: Poll): Message[] {
  return list.map((message) => (message.poll?.id === poll.id ? { ...message, poll } : message));
}

/** Um tópico nasceu ou ganhou respostas: a mensagem-mãe mostra o aviso novo. */
export function applyThread(list: Message[], thread: ThreadSummary): Message[] {
  return list.map((message) => (message.id === thread.parentMessageId ? { ...message, thread } : message));
}

export function removeThread(list: Message[], threadId: number): Message[] {
  return list.map((message) => (message.thread?.id === threadId ? { ...message, thread: null } : message));
}
