import { Download, FileText, MessageSquarePlus, MessagesSquare, SmilePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, mediaUrl } from './api';
import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import { EmojiPicker } from './EmojiPicker';
import { PollCard } from './PollCard';
import { formatBytes } from './upload';
import type { Attachment, Message, Poll, Reaction, ThreadSummary } from './types';

/** Caixa máxima de uma imagem no chat; o resto encolhe proporcionalmente. */
const IMAGE_BOX = { width: 400, height: 300 };

function imageSize(file: Attachment) {
  if (!file.width || !file.height) return { width: undefined, height: undefined };
  const scale = Math.min(1, IMAGE_BOX.width / file.width, IMAGE_BOX.height / file.height);
  return { width: Math.round(file.width * scale), height: Math.round(file.height * scale) };
}

function Attachments({ files }: { files: Attachment[] }) {
  return (
    <div className="attachments">
      {files.map((file) => {
        const url = mediaUrl.attachment(file.id, file.key);
        if (file.mime.startsWith('image/')) {
          const size = imageSize(file);
          return (
            <a key={file.id} className="attachment-image" href={url} target="_blank" rel="noreferrer noopener" title={file.name}>
              <img src={url} alt={file.name} width={size.width} height={size.height} loading="lazy" />
            </a>
          );
        }
        if (file.mime.startsWith('video/')) {
          return <video key={file.id} className="attachment-video" src={url} controls preload="metadata" />;
        }
        if (file.mime.startsWith('audio/')) {
          return (
            <div key={file.id} className="attachment-audio">
              <span className="attachment-name">{file.name}</span>
              <audio src={url} controls preload="metadata" />
            </div>
          );
        }
        return (
          <a key={file.id} className="attachment-file" href={url} download={file.name}>
            <FileText size={28} />
            <span className="attachment-info">
              <span className="attachment-name">{file.name}</span>
              <span className="attachment-size">{formatBytes(file.size)}</span>
            </span>
            <Download size={18} />
          </a>
        );
      })}
    </div>
  );
}

/** Uma reação, com a imagem do emoji da comunidade quando é o caso. */
function ReactionGlyph({ emoji }: { emoji: string }) {
  const { emojisByName } = useDirectory();
  const custom = /^:([a-z0-9_]{2,32}):$/.exec(emoji);
  const found = custom && emojisByName.get(custom[1]);
  if (found) return <img className="reaction-emoji" src={mediaUrl.emoji(found.id)} alt={emoji} />;
  return <span className="reaction-emoji">{emoji}</span>;
}

/** As reações embaixo da mensagem: cada pílula mostra quantos marcaram; a sua fica destacada. */
function ReactionBar({ reactions, onToggle }: { reactions: Reaction[]; onToggle: (emoji: string) => void }) {
  if (reactions.length === 0) return null;
  return (
    <div className="reactions">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          className={`reaction-pill${reaction.mine ? ' mine' : ''}`}
          title={reaction.emoji}
          onClick={() => onToggle(reaction.emoji)}
        >
          <ReactionGlyph emoji={reaction.emoji} />
          <span className="reaction-count">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}

/** Botão de "+" que abre o painel de emojis para escolher a reação nova. */
function AddReactionButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      setPos(rect ? { x: rect.left, y: rect.bottom + 6 } : null);
    }
    setOpen(!open);
  }

  return (
    <>
      <button ref={buttonRef} className="message-action" title="Reagir" aria-label="Reagir" onClick={toggle}>
        <SmilePlus size={16} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="reaction-picker-anchor"
            style={{ position: 'fixed', top: pos.y, left: Math.min(pos.x, window.innerWidth - 356) }}
          >
            <EmojiPicker
              onPick={(emoji) => {
                setOpen(false);
                onPick(emoji);
              }}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function ThreadChip({ thread, onOpen }: { thread: ThreadSummary; onOpen: () => void }) {
  return (
    <button className="thread-chip" onClick={onOpen}>
      <MessagesSquare size={16} />
      <span className="thread-chip-title">{thread.title}</span>
      <span className="thread-chip-count">
        {thread.replyCount === 1 ? '1 mensagem' : `${thread.replyCount} mensagens`}
      </span>
      <span className="thread-chip-open">Ver tópico</span>
    </button>
  );
}

/**
 * Uma mensagem na conversa, com tudo que ela pode carregar: texto, arquivos, enquete e o tópico
 * pendurado nela. O mesmo componente desenha as mensagens do canal e as respostas de um tópico.
 */
export function MessageItem({
  message,
  grouped,
  canDelete,
  canManagePoll,
  onDelete,
  onPollChange,
  onReactionsChange,
  onOpenThread,
  onCreateThread,
}: {
  message: Message;
  grouped: boolean;
  canDelete: boolean;
  canManagePoll: boolean;
  onDelete: (message: Message, skipConfirm: boolean) => void;
  onPollChange: (poll: Poll) => void;
  onReactionsChange: (messageId: number, reactions: Reaction[]) => void;
  /** Ausente dentro do painel do tópico: lá não há tópico de tópico. */
  onOpenThread?: (thread: ThreadSummary) => void;
  onCreateThread?: (message: Message) => void;
}) {
  async function reactWith(emoji: string) {
    try {
      const reactions = await api<Reaction[]>(`/api/messages/${message.id}/reactions`, { method: 'POST', body: { emoji } });
      onReactionsChange(message.id, reactions);
    } catch {
      // Reagir é secundário: se falhar (mensagem apagada nesse meio-tempo etc.), não interrompe a leitura.
    }
  }

  const body = (
    <>
      {message.content && <MessageText content={message.content} />}
      {message.attachments.length > 0 && <Attachments files={message.attachments} />}
      {message.poll && <PollCard poll={message.poll} canClose={canManagePoll} onChange={onPollChange} />}
      {message.thread && onOpenThread && <ThreadChip thread={message.thread} onOpen={() => onOpenThread(message.thread!)} />}
      <ReactionBar reactions={message.reactions} onToggle={(emoji) => void reactWith(emoji)} />
    </>
  );

  const actions = (
    <div className="message-actions">
      <AddReactionButton onPick={(emoji) => void reactWith(emoji)} />
      {onCreateThread && !message.thread && (
        <button
          className="message-action"
          title="Criar tópico a partir desta mensagem"
          aria-label="Criar tópico"
          onClick={() => onCreateThread(message)}
        >
          <MessageSquarePlus size={16} />
        </button>
      )}
      {canDelete && (
        <button
          className="message-action danger"
          title="Apagar mensagem (Shift + clique apaga direto)"
          aria-label="Apagar mensagem"
          onClick={(e) => onDelete(message, e.shiftKey)}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  if (grouped) {
    return (
      <div className="message grouped">
        <div className="message-body">{body}</div>
        {actions}
      </div>
    );
  }

  return (
    <div className="message">
      <Avatar name={message.author.username} userId={message.author.id} size={40} />
      <div className="message-body">
        <div className="message-meta">
          <span className="message-author">{message.author.username}</span>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>
        {body}
      </div>
      {actions}
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;
const EMOJI_TOKEN_RE = /:([a-z0-9_]{2,32}):/g;
// Caracteres que não contam como "texto" para decidir se a mensagem é só de emojis.
const UNICODE_EMOJI_RE = /[\p{Extended_Pictographic}‍️\s]/gu;
const JUMBO_LIMIT = 27; // como no Discord: até 27 emojis sem texto aparecem grandes

export function MessageText({ content }: { content: string }) {
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

export function formatTime(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Hoje às ${time}`;
  return `${date.toLocaleDateString('pt-BR')} ${time}`;
}
