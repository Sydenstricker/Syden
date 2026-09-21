import { Hash, Smile, Trash2 } from 'lucide-react';
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api, mediaUrl } from './api';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { useDirectory } from './directory';
import { EmojiPicker } from './EmojiPicker';
import type { Channel, Message, Role, User } from './types';

const PAGE_SIZE = 50;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function TextChannel({ channel, socket, user, role }: { channel: Channel; socket: Socket; user: User; role: Role }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    api<Message[]>(`/api/channels/${channel.id}/messages`).then((page) => {
      // Preserva mensagens que chegaram pelo socket enquanto o histórico carregava.
      const lastId = page.at(-1)?.id ?? 0;
      setMessages((live) => [...page, ...live.filter((m) => m.id > lastId)]);
      setHasMore(page.length === PAGE_SIZE);
    }, console.error);

    const onMessage = (message: Message) => {
      if (message.channelId === channel.id) setMessages((list) => [...list, message]);
    };
    const onDeleted = ({ id }: { id: number }) => setMessages((list) => list.filter((m) => m.id !== id));
    // Conta excluída: as mensagens dela somem da tela também.
    const onUserDeleted = ({ id }: { id: number }) => setMessages((list) => list.filter((m) => m.author.id !== id));
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onDeleted);
    socket.on('user:deleted', onUserDeleted);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onDeleted);
      socket.off('user:deleted', onUserDeleted);
    };
  }, [channel.id, socket]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

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

  function send() {
    const content = draft.trim();
    if (!content) return;
    stickToBottom.current = true;
    socket.emit('message:send', { channelId: channel.id, content }, (result: { ok: boolean; error?: string }) => {
      setError(result.ok ? null : (result.error ?? 'Falha ao enviar.'));
    });
    setDraft('');
  }

  /** Insere o emoji onde está o cursor, com espaço antes quando precisa. */
  function insertAtCursor(text: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const insert = (before && !/\s$/.test(before) ? ' ' : '') + text + ' ';
    setDraft(before + insert + draft.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      const caret = start + insert.length;
      input?.setSelectionRange(caret, caret);
    });
  }

  const canDelete = (message: Message) => message.author.id === user.id || role === 'owner' || role === 'admin';

  /** Shift + clique apaga sem perguntar. */
  function requestDelete(message: Message, skipConfirm: boolean) {
    if (skipConfirm) void api(`/api/messages/${message.id}`, { method: 'DELETE' }).catch((e) => setError((e as Error).message));
    else setDeleting(message);
  }

  const deleteButton = (message: Message) =>
    canDelete(message) && (
      <button
        className="message-action"
        title="Apagar mensagem (Shift + clique apaga direto)"
        aria-label="Apagar mensagem"
        onClick={(e) => requestDelete(message, e.shiftKey)}
      >
        <Trash2 size={16} />
      </button>
    );

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="text-channel">
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
            Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_WINDOW_MS;
          return grouped ? (
            <div key={message.id} className="message grouped">
              <MessageText content={message.content} />
              {deleteButton(message)}
            </div>
          ) : (
            <div key={message.id} className="message">
              <Avatar name={message.author.username} userId={message.author.id} size={40} />
              <div className="message-body">
                <div className="message-meta">
                  <span className="message-author">{message.author.username}</span>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                </div>
                <MessageText content={message.content} />
              </div>
              {deleteButton(message)}
            </div>
          );
        })}
      </div>

      {deleting && (
        <DeleteMessageDialog message={deleting} onClose={() => setDeleting(null)} />
      )}

      <div className="composer">
        {error && <p className="form-error small">{error}</p>}
        <div className="composer-box">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={2000}
            placeholder={`Conversar em #${channel.name}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-emoji">
            <button
              className={`icon-plain composer-emoji-button${pickerOpen ? ' active' : ''}`}
              title="Emojis"
              aria-label="Emojis"
              onClick={() => setPickerOpen(!pickerOpen)}
            >
              <Smile size={22} />
            </button>
            {pickerOpen && <EmojiPicker onPick={insertAtCursor} onClose={() => setPickerOpen(false)} />}
          </div>
        </div>
      </div>
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

  return (
    <ConfirmDialog title="Apagar mensagem" confirmLabel="Apagar" busy={busy} error={error} onConfirm={confirm} onCancel={onClose}>
      Tem certeza que quer apagar esta mensagem de <strong>{message.author.username}</strong>? Ela some para todos.
      <blockquote className="dialog-quote">{message.content}</blockquote>
    </ConfirmDialog>
  );
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;
const EMOJI_TOKEN_RE = /:([a-z0-9_]{2,32}):/g;
// Caracteres que não contam como "texto" para decidir se a mensagem é só de emojis.
const UNICODE_EMOJI_RE = /[\p{Extended_Pictographic}‍️\s]/gu;
const JUMBO_LIMIT = 27; // como no Discord: até 27 emojis sem texto aparecem grandes

function MessageText({ content }: { content: string }) {
  const { emojisByName } = useDirectory();

  // Troca :nome: pela imagem quando o emoji existe; nomes desconhecidos ficam como texto.
  const withEmojis = (text: string, keyPrefix: string) =>
    text.split(EMOJI_TOKEN_RE).map((part, i) => {
      const emoji = i % 2 === 1 ? emojisByName.get(part) : undefined;
      if (i % 2 === 1 && !emoji) return `:${part}:`;
      return emoji ? (
        <img key={`${keyPrefix}-${i}`} className="emoji" src={mediaUrl.emoji(emoji.id)} alt={`:${part}:`} title={`:${part}:`} />
      ) : (
        part
      );
    });

  const customCount = [...content.matchAll(EMOJI_TOKEN_RE)].filter((m) => emojisByName.has(m[1])).length;
  const rest = content.replace(EMOJI_TOKEN_RE, (token, name) => (emojisByName.has(name) ? '' : token)).replace(UNICODE_EMOJI_RE, '');
  const unicodeCount = [...content.matchAll(/\p{Extended_Pictographic}/gu)].length;
  const jumbo = rest === '' && customCount + unicodeCount > 0 && customCount + unicodeCount <= JUMBO_LIMIT;

  return (
    <p className={`message-text${jumbo ? ' jumbo' : ''}`}>
      {content.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener">
            {part}
          </a>
        ) : (
          withEmojis(part, String(i))
        ),
      )}
    </p>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Hoje às ${time}`;
  return `${date.toLocaleDateString('pt-BR')} ${time}`;
}
