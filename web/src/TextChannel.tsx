import { Hash } from 'lucide-react';
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { Avatar } from './Shell';
import type { Channel, Message } from './types';

const PAGE_SIZE = 50;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function TextChannel({ channel, socket }: { channel: Channel; socket: Socket }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
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
            </div>
          ) : (
            <div key={message.id} className="message">
              <Avatar name={message.author.username} size={40} />
              <div className="message-body">
                <div className="message-meta">
                  <span className="message-author">{message.author.username}</span>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                </div>
                <MessageText content={message.content} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="composer">
        {error && <p className="form-error small">{error}</p>}
        <textarea
          rows={1}
          value={draft}
          maxLength={2000}
          placeholder={`Conversar em #${channel.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;

function MessageText({ content }: { content: string }) {
  return (
    <p className="message-text">
      {content.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener">
            {part}
          </a>
        ) : (
          part
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
