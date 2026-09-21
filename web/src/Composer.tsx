import { BarChart3, FileText, ImageUp, Plus, Smile, X } from 'lucide-react';
import {
  type ClipboardEvent,
  type KeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { EmojiPicker } from './EmojiPicker';
import { PollDialog } from './PollDialog';
import { MAX_ATTACHMENT_BYTES, formatBytes, prepareAttachment, type PreparedFile } from './upload';
import type { Message } from './types';

const MAX_FILES = 5;

interface Staged extends PreparedFile {
  key: number;
}

export interface ComposerHandle {
  /** Usado quando a pessoa arrasta arquivos para cima da conversa. */
  addFiles: (files: File[]) => void;
}

/**
 * O campo de escrever: texto, emojis, arquivos e enquetes. O mesmo componente serve para o canal
 * e para um tópico — a única diferença é o `threadId` que vai junto com a mensagem.
 */
export const Composer = forwardRef<ComposerHandle, {
  channelId: number;
  threadId?: number | null;
  socket: Socket;
  placeholder: string;
  onSent?: () => void;
}>(function Composer({ channelId, threadId = null, socket, placeholder, onSent }, ref) {
  const [draft, setDraft] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const room = MAX_FILES - staged.length;
    if (room <= 0) return setError(`Dá para mandar até ${MAX_FILES} arquivos por mensagem.`);
    for (const file of files.slice(0, room)) {
      try {
        const prepared = await prepareAttachment(file);
        setStaged((list) => [...list, { ...prepared, key: nextKey.current++ }]);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    if (files.length > room) setError(`Só cabem ${MAX_FILES} arquivos por mensagem; o resto ficou de fora.`);
    inputRef.current?.focus();
  }

  useImperativeHandle(ref, () => ({ addFiles: (files) => void addFiles(files) }));

  async function send() {
    const content = draft.trim();
    if (sending) return;
    if (staged.length === 0) {
      if (!content) return;
      socket.emit('message:send', { channelId, content, threadId }, (result: { ok: boolean; error?: string }) => {
        setError(result.ok ? null : (result.error ?? 'Falha ao enviar.'));
      });
      setDraft('');
      onSent?.();
      return;
    }

    setSending(true);
    try {
      await api<Message>(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: {
          content,
          threadId,
          files: staged.map(({ name, data, width, height }) => ({ name, data, width, height })),
        },
      });
      setDraft('');
      setStaged([]);
      setError(null);
      onSent?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
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

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  /** Ctrl+V com uma imagem copiada manda a imagem, não o caminho dela. */
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length > 0) {
      event.preventDefault();
      void addFiles(files);
    }
  }

  return (
    <div className="composer">
      {error && (
        <p className="form-error small" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {staged.length > 0 && (
        <div className="composer-files">
          {staged.map((file) => (
            <div key={file.key} className="composer-file">
              {file.mime.startsWith('image/') ? (
                <img src={file.data} alt={file.name} />
              ) : (
                <div className="composer-file-icon">
                  <FileText size={28} />
                </div>
              )}
              <div className="composer-file-name" title={file.name}>
                {file.name}
              </div>
              <div className="composer-file-size">{formatBytes(file.size)}</div>
              <button
                className="composer-file-remove"
                aria-label={`Tirar ${file.name}`}
                title="Tirar da mensagem"
                onClick={() => setStaged((list) => list.filter((f) => f.key !== file.key))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer-box">
        <div className="composer-plus">
          <button
            className={`icon-plain composer-plus-button${menuOpen ? ' active' : ''}`}
            title="Enviar arquivo ou fazer enquete"
            aria-label="Enviar arquivo ou fazer enquete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Plus size={20} />
          </button>
          {menuOpen && (
            <div className="composer-menu" role="menu" onPointerDown={(e) => e.stopPropagation()}>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  fileRef.current?.click();
                }}
              >
                <ImageUp size={18} /> Enviar arquivo ou imagem
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setPollOpen(true);
                }}
              >
                <BarChart3 size={18} /> Criar enquete
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            aria-label="Escolher arquivo"
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </div>

        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={2000}
          placeholder={sending ? 'Enviando…' : placeholder}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
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

      <p className="composer-hint">
        {staged.length > 0
          ? `${staged.length} de ${MAX_FILES} arquivos · até ${formatBytes(MAX_ATTACHMENT_BYTES)} cada · Enter envia`
          : ''}
      </p>

      {pollOpen && (
        <PollDialog channelId={channelId} threadId={threadId} onClose={() => setPollOpen(false)} onCreated={() => onSent?.()} />
      )}
    </div>
  );
});
