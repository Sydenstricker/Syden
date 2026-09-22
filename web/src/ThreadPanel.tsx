import { Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { Composer, type ComposerHandle } from './Composer';
import { ConfirmDialog } from './ConfirmDialog';
import { MessageItem } from './MessageItem';
import { applyReactionUpdate, applyTally, replacePoll, replaceReactions, type PollTally, type ReactionUpdate } from './messageState';
import type { Message, Reaction, Role, ThreadSummary, User } from './types';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * O painel do tópico, à direita da conversa: a mensagem que deu origem a ele no topo e, embaixo,
 * as respostas — que não aparecem no meio do canal.
 */
export function ThreadPanel({
  thread,
  parent,
  socket,
  user,
  role,
  onClose,
  onDeleteMessage,
  onParentReactionsChange,
}: {
  thread: ThreadSummary;
  /** A mensagem que originou o tópico, quando ela está carregada na tela. */
  parent?: Message;
  socket: Socket;
  user: User;
  role: Role;
  onClose: () => void;
  onDeleteMessage: (message: Message, skipConfirm: boolean) => void;
  /** Reagir à mensagem-mãe também atualiza ela lá no canal. */
  onParentReactionsChange: (messageId: number, reactions: Reaction[]) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const stick = useRef(true);

  useEffect(() => {
    setMessages([]);
    api<Message[]>(`/api/threads/${thread.id}/messages`).then(setMessages, (e: Error) => setError(e.message));
  }, [thread.id]);

  useEffect(() => {
    const onMessage = (message: Message) => {
      if (message.threadId === thread.id) setMessages((list) => [...list, message]);
    };
    const onDeleted = ({ id }: { id: number }) => setMessages((list) => list.filter((m) => m.id !== id));
    const onUserDeleted = ({ id }: { id: number }) => setMessages((list) => list.filter((m) => m.author.id !== id));
    const onTally = (tally: PollTally) => setMessages((list) => applyTally(list, tally));
    const onReaction = (update: ReactionUpdate) => setMessages((list) => applyReactionUpdate(list, update));
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onDeleted);
    socket.on('user:deleted', onUserDeleted);
    socket.on('poll:tally', onTally);
    socket.on('reaction:updated', onReaction);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onDeleted);
      socket.off('user:deleted', onUserDeleted);
      socket.off('poll:tally', onTally);
      socket.off('reaction:updated', onReaction);
    };
  }, [socket, thread.id]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const canManage = (message: Message) => message.author.id === user.id || role === 'owner' || role === 'admin';
  const canDeleteThread = role === 'owner' || role === 'admin' || parent?.author.id === user.id;

  async function deleteThread() {
    try {
      await api(`/api/threads/${thread.id}`, { method: 'DELETE' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <aside
      className="thread-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const files = [...e.dataTransfer.files];
        if (files.length === 0) return;
        e.preventDefault();
        composerRef.current?.addFiles(files);
      }}
    >
      <header className="main-header thread-header">
        <span className="thread-header-title" title={thread.title}>
          Tópico · {thread.title}
        </span>
        {canDeleteThread && (
          <button className="icon-plain" title="Apagar tópico" aria-label="Apagar tópico" onClick={() => setDeleting(true)}>
            <Trash2 size={18} />
          </button>
        )}
        <button className="icon-plain" title="Fechar tópico" aria-label="Fechar tópico" onClick={onClose}>
          <X size={20} />
        </button>
      </header>

      <div
        className="messages thread-messages"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {parent && (
          <div className="thread-parent">
            <MessageItem
              message={parent}
              grouped={false}
              canDelete={false}
              canManagePoll={false}
              onDelete={() => {}}
              onPollChange={() => {}}
              onReactionsChange={onParentReactionsChange}
            />
            <div className="thread-parent-line">Respostas</div>
          </div>
        )}

        {error && <p className="form-error small">{error}</p>}
        {messages.length === 0 && !error && <p className="thread-empty">Ninguém respondeu neste tópico ainda.</p>}

        {messages.map((message, i) => {
          const previous = messages[i - 1];
          const grouped =
            previous?.author.id === message.author.id &&
            Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_WINDOW_MS;
          return (
            <MessageItem
              key={message.id}
              message={message}
              grouped={grouped}
              canDelete={canManage(message)}
              canManagePoll={canManage(message)}
              onDelete={onDeleteMessage}
              onPollChange={(poll) => setMessages((list) => replacePoll(list, poll))}
              onReactionsChange={(id, reactions) => setMessages((list) => replaceReactions(list, id, reactions))}
            />
          );
        })}
      </div>

      <Composer
        ref={composerRef}
        channelId={thread.channelId}
        threadId={thread.id}
        socket={socket}
        placeholder="Responder no tópico"
        onSent={() => (stick.current = true)}
      />

      {deleting && (
        <ConfirmDialog
          title="Apagar tópico"
          confirmLabel="Apagar"
          onConfirm={() => void deleteThread()}
          onCancel={() => setDeleting(false)}
        >
          Apagar o tópico <strong>{thread.title}</strong> apaga também todas as respostas dele. A mensagem original continua no
          canal.
        </ConfirmDialog>
      )}
    </aside>
  );
}
