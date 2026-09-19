import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from './api';
import { useDirectory } from './directory';

// Emojis comuns (Unicode), para quem quer um 😂 sem procurar no teclado.
const COMMON = [
  '😀', '😂', '🤣', '😅', '😊', '😍', '😎', '🤔', '😴', '😭', '😡', '🥳', '😱', '🙄', '😬', '🤯',
  '👍', '👎', '👏', '🙏', '💪', '👀', '🔥', '💀', '❤️', '💔', '✨', '🎉', '🎮', '🍕', '🍺', '⚽',
];

/**
 * Painel de emojis acima do campo de mensagem. Emojis do servidor entram como :nome:;
 * os comuns entram como o próprio caractere.
 */
export function EmojiPicker({ onPick, onClose }: { onPick: (text: string) => void; onClose: () => void }) {
  const { emojis } = useDirectory();
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Escolher emoji">
      <div className="emoji-picker-scroll">
        {emojis.length > 0 && (
          <>
            <div className="emoji-picker-section">Deste servidor</div>
            <div className="emoji-picker-grid">
              {emojis.map((emoji) => (
                <button
                  key={emoji.id}
                  className="emoji-picker-item"
                  aria-label={`:${emoji.name}:`}
                  onMouseEnter={() => setHovered(`:${emoji.name}:`)}
                  onClick={() => onPick(`:${emoji.name}:`)}
                >
                  <img src={mediaUrl.emoji(emoji.id)} alt="" draggable={false} />
                </button>
              ))}
            </div>
          </>
        )}
        <div className="emoji-picker-section">Comuns</div>
        <div className="emoji-picker-grid">
          {COMMON.map((char) => (
            <button
              key={char}
              className="emoji-picker-item unicode"
              aria-label={char}
              onMouseEnter={() => setHovered(char)}
              onClick={() => onPick(char)}
            >
              {char}
            </button>
          ))}
        </div>
      </div>
      <div className="emoji-picker-footer">{hovered ?? 'Passe o mouse sobre um emoji'}</div>
    </div>
  );
}
