import { Hash } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { Composer, type ComposerHandle } from './Composer';
import { ConfirmDialog } from './ConfirmDialog';
import { MessageItem, MessageText } from './MessageItem';
import { applyTally, applyThread, removeThread, replacePoll, type PollTally } from './messageState';
import { ThreadPanel } from './ThreadPanel';
import type { Channel, Message, Role, ThreadSummary, User } from './types';

const PAGE_SIZE = 50;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function TextChannel({ channel, socket, user, role }: { channel: Channel; socket: Socket; user: User; role: Role }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [threadFor, setThreadFor] = useState<Message | null>(null);
  const [openThread, setOpenThread] = useState<ThreadSummary | null>(null);
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    api<Message[]>(`/api/channels/${channel.id}/messages`).then((page) => {
      // Preserva mensagens que chegaram pelo socket enquanto o histórico carregava.
      const lastId = page.at(-1)?.id ?? 0;
      setMessages((live) => [...page, ...live.filter((m) => m.id > lastId)]);
      setHasMore(page.length === PAGE_SIZE);
    }, console.error);

    const onMessage = (message: Message) => {
      // Respostas de tópico ficam no painel do tópico, não no meio do canal.
      if (message.channelId === channel.id && message.threadId === null) setMessages((list) => [...list, message]);
    };
    const onDeleted = ({ id }: { id: number }) => setMessages((list) => list.filter((m) => m.id !== id));
    // Conta excluída: as mensagens dela somem da tela também.
    const onUserDeleted = ({ id }: { id: number }) => setMessages((list) => list.filter((m) => m.author.id !== id));
    const onTally = (tally: PollTally) => setMessages((list) => applyTally(list, tally));
    const onThread = (thread: ThreadSummary) => {
      if (thread.channelId === channel.id) setMessages((list) => applyThread(list, thread));
    };
    const onThreadDeleted = ({ id }: { id: number }) => {
      setMessages((list) => removeThread(list, id));
      setOpenThread((current) => (current?.id === id ? null : current));
    };
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onDeleted);
    socket.on('user:deleted', onUserDeleted);
    socket.on('poll:tally', onTally);
    socket.on('thread:created', onThread);
    socket.on('thread:updated', onThread);
    socket.on('thread:deleted', onThreadDeleted);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onDeleted);
      socket.off('user:deleted', onUserDeleted);
      socket.off('poll:tally', onTally);
      socket.off('thread:created', onThread);
      socket.off('thread:updated', onThread);
      socket.off('thread:deleted', onThreadDeleted);
    };
  }, [channel.id, socket]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // A mensagem que abriu o tópico some (foi apagada): o painel fecha junto.
  useEffect(() => {
    if (openThread && messages.length > 0 && !messages.some((m) => m.id === openThread.parentMessageId)) {
      setOpenThread(null);
    }
  }, [messages, openThread]);

  async function loadOlder() {
    const el = listRef.current;
    const previousHeight = el?.scrollHeight ?? 0;
    const page = await api<Message[]>(`/api/channels/${channel.id}/messages?before=${messages[0]?.id}`);
    stickToBottom.current = false;
    setHasMore(page.length === PAGE_SIZE);
    setMessages((list) => [...page, ...list]);
    // Mantém a posição de leitura depois de inserir mensagens acima.
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - previousHeight;
    });
  }

  const canManage = (message: Message) => message.author.id === user.id || role === 'owner' || role === 'admin';

  /** Shift + clique apaga sem perguntar. */
  function requestDelete(message: Message, skipConfirm: boolean) {
    if (skipConfirm) void api(`/api/messages/${message.id}`, { method: 'DELETE' }).catch((e) => setError((e as Error).message));
    else setDeleting(message);
  }

  return (
    <div className="channel-layout">
      <div
        className="text-channel"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget as Node) || setDragging(false)}
        onDrop={(e) => {
          const files = [...e.dataTransfer.files];
          setDragging(false);
          if (files.length === 0) return;
          e.preventDefault();
          composerRef.current?.addFiles(files);
        }}
      >
        <header className="main-header">
          <Hash size={22} className="muted-icon" /> {channel.name}
        </header>

        <div
          className="messages"
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {hasMore ? (
            <button className="load-older" onClick={loadOlder}>
              Carregar mensagens anteriores
            </button>
          ) : (
            <div className="channel-intro">
              <div className="channel-intro-icon">
                <Hash size={36} />
              </div>
              <h2>Bem-vindo a #{channel.name}!</h2>
              <p>Este é o começo do canal.</p>
            </div>
          )}

          {messages.map((message, i) => {
            const previous = messages[i - 1];
            const grouped =
              previous?.author.id === message.author.id &&
              !message.poll &&
              !previous.thread &&
              Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_WINDOW_MS;
            return (
              <MessageItem
                key={message.id}
                message={message}
                grouped={grouped}
                canDelete={canManage(message)}
                canManagePoll={canManage(message)}
                onDelete={requestDelete}
                onPollChange={(poll) => setMessages((list) => replacePoll(list, poll))}
                onOpenThread={setOpenThread}
                onCreateThread={setThreadFor}
              />
            );
          })}
        </div>

        {error && (
          <p className="form-error small" onClick={() => setError(null)}>
            {error}
          </p>
        )}

        <Composer
          ref={composerRef}
          channelId={channel.id}
          socket={socket}
          placeholder={`Conversar em #${channel.name}`}
          onSent={() => (stickToBottom.current = true)}
        />

        {dragging && <div className="drop-overlay">Solte para enviar o arquivo</div>}
      </div>

      {openThread && (
        <ThreadPanel
          key={openThread.id}
          thread={openThread}
          parent={messages.find((m) => m.id === openThread.parentMessageId)}
          socket={socket}
          user={user}
          role={role}
          onClose={() => setOpenThread(null)}
          onDeleteMessage={requestDelete}
        />
      )}

      {deleting && <DeleteMessageDialog message={deleting} onClose={() => setDeleting(null)} />}
      {threadFor && (
        <NewThreadDialog
          message={threadFor}
          onClose={() => setThreadFor(null)}
          onCreated={(thread) => {
            setMessages((list) => applyThread(list, thread));
            setOpenThread(thread);
            setThreadFor(null);
          }}
        />
      )}
    </div>
  );
}

function DeleteMessageDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/messages/${message.id}`, { method: 'DELETE' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const preview = message.content || (message.poll ? `Enquete: ${message.poll.question}` : `${message.attachments.length} arquivo(s)`);

  return (
    <ConfirmDialog title="Apagar mensagem" confirmLabel="Apagar" busy={busy} error={error} onConfirm={confirm} onCancel={onClose}>
      Tem certeza que quer apagar esta mensagem de <strong>{message.author.username}</strong>? Ela some para todos.
      <blockquote className="dialog-quote">{preview}</blockquote>
    </ConfirmDialog>
  );
}

/** Nome do tópico: já vem preenchido com o começo da mensagem, como o Discord sugere. */
function NewThreadDialog({
  message,
  onClose,
  onCreated,
}: {
  message: Message;
  onClose: () => void;
  onCreated: (thread: ThreadSummary) => void;
}) {
  const [title, setTitle] = useState(() => (message.content || message.poll?.question || 'Novo tópico').slice(0, 60));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function create() {
    setBusy(true);
    try {
      onCreated(await api<ThreadSummary>(`/api/messages/${message.id}/thread`, { method: 'POST', body: { title: title.trim() } }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="thread-dialog-title">
        <h2 id="thread-dialog-title">Criar tópico</h2>
        <div className="dialog-body">
          <label>
            Nome do tópico
            <input
              autoFocus
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && title.trim() && void create()}
            />
          </label>
          <p className="dialog-note">A conversa do tópico fica separada, pendurada nesta mensagem:</p>
          <blockquote className="dialog-quote">
            <MessageText content={message.content || (message.poll ? `Enquete: ${message.poll.question}` : 'Arquivo')} />
          </blockquote>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="link-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy || !title.trim()} onClick={() => void create()}>
            {busy ? 'Criando…' : 'Criar tópico'}
          </button>
        </div>
      </div>
    </div>
  );
}
