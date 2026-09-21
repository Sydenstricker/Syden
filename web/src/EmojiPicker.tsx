import { useEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl } from './api';
import { useDirectory } from './directory';
import { EMOJI_GROUPS, emojiLabel, searchEmojis } from './emojiData';

const RECENT_KEY = 'syden.recentEmojis';
const MAX_RECENT = 16;

function loadRecent(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function rememberRecent(char: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([char, ...loadRecent().filter((c) => c !== char)].slice(0, MAX_RECENT)));
  } catch {
    // navegador sem armazenamento: só não lembra
  }
}

/**
 * Painel de emojis acima do campo de mensagem: os do servidor entram como :nome: e os comuns como o
 * próprio caractere. A busca é em português ("bolo", "coração", "risada").
 */
export function EmojiPicker({ onPick, onClose }: { onPick: (text: string) => void; onClose: () => void }) {
  const { emojis } = useDirectory();
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(loadRecent);
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const search = query.trim();
  const found = useMemo(() => searchEmojis(search), [search]);
  const serverMatches = useMemo(
    () => (search ? emojis.filter((emoji) => emoji.name.includes(search.toLowerCase().replace(/[^a-z0-9_]/g, ''))) : emojis),
    [emojis, search],
  );

  function pick(text: string, unicode: string | null) {
    if (unicode) {
      rememberRecent(unicode);
      setRecent(loadRecent());
    }
    onPick(text);
  }

  const unicodeButton = (char: string, key: string) => (
    <button
      key={key}
      className="emoji-picker-item unicode"
      aria-label={char}
      title={emojiLabel(char)}
      onMouseEnter={() => setHovered(`${char}  ${emojiLabel(char)}`)}
      onClick={() => pick(char, char)}
    >
      {char}
    </button>
  );

  /** Rola até o começo de um grupo quando a pessoa clica no atalho da barra de cima. */
  function jumpTo(name: string) {
    setQuery('');
    requestAnimationFrame(() => {
      const target = scrollRef.current?.querySelector(`[data-group="${name}"]`);
      target?.scrollIntoView({ block: 'start' });
    });
  }

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Escolher emoji">
      <div className="emoji-picker-search">
        <input
          autoFocus
          value={query}
          placeholder="Procurar emoji"
          aria-label="Procurar emoji"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!search && (
        <div className="emoji-picker-tabs">
          {EMOJI_GROUPS.map((group) => (
            <button key={group.name} title={group.name} aria-label={group.name} onClick={() => jumpTo(group.name)}>
              {group.icon}
            </button>
          ))}
        </div>
      )}

      <div className="emoji-picker-scroll" ref={scrollRef}>
        {serverMatches.length > 0 && (
          <>
            <div className="emoji-picker-section">Deste servidor</div>
            <div className="emoji-picker-grid">
              {serverMatches.map((emoji) => (
                <button
                  key={emoji.id}
                  className="emoji-picker-item"
                  aria-label={`:${emoji.name}:`}
                  onMouseEnter={() => setHovered(`:${emoji.name}:`)}
                  onClick={() => pick(`:${emoji.name}:`, null)}
                >
                  <img src={mediaUrl.emoji(emoji.id)} alt="" draggable={false} />
                </button>
              ))}
            </div>
          </>
        )}

        {search ? (
          found.length > 0 ? (
            <>
              <div className="emoji-picker-section">Resultados</div>
              <div className="emoji-picker-grid">{found.map((char) => unicodeButton(char, char))}</div>
            </>
          ) : (
            serverMatches.length === 0 && <p className="emoji-picker-empty">Nenhum emoji com "{search}".</p>
          )
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <div className="emoji-picker-section">Usados recentemente</div>
                <div className="emoji-picker-grid">{recent.map((char) => unicodeButton(char, `recent-${char}`))}</div>
              </>
            )}
            {EMOJI_GROUPS.map((group) => (
              <div key={group.name} data-group={group.name}>
                <div className="emoji-picker-section">{group.name}</div>
                <div className="emoji-picker-grid">{group.emojis.map(([char]) => unicodeButton(char, char))}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="emoji-picker-footer">{hovered ?? 'Passe o mouse sobre um emoji'}</div>
    </div>
  );
}
