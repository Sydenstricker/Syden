import { Check, Download, Play, Plus, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { reloadSounds } from './directory';
import { playSoundboard, stopAllSounds } from './soundboard';
import type { Pack, Sound, User } from './types';
import { MAX_SOUND_SECONDS, prepareSound } from './upload';

// Catálogo de pacotes de sons: os que vêm com o Syden e os que as pessoas montam. Cada um instala os que
// quiser no próprio soundboard e dá de uma a cinco estrelas, como nas extensões do VS Code.

const MAX_SOUNDS = 40;

/** Estrelas do pacote: mostra a média e, ao clicar, guarda a sua nota. */
function Stars({ pack, onRate }: { pack: Pack; onRate: (stars: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || pack.myStars || Math.round(pack.stars ?? 0);

  return (
    <div className="pack-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={`pack-star${n <= shown ? ' on' : ''}${pack.myStars ? ' mine' : ''}`}
          title={pack.myStars === n ? 'Tirar a sua nota' : `Dar ${n} de 5`}
          aria-label={`Dar ${n} de 5 estrelas para ${pack.name}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onRate(pack.myStars === n ? 0 : n)}
        >
          <Star size={15} />
        </button>
      ))}
      <span className="pack-stars-count">
        {pack.stars === null ? 'sem notas ainda' : `${pack.stars.toFixed(1)} (${pack.ratings})`}
      </span>
    </div>
  );
}

function PackCard({ pack, user, onChange }: { pack: Pack; user: User; onChange: (pack: Pack | null) => void }) {
  const [sounds, setSounds] = useState<Sound[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = pack.createdBy === user.id;

  async function act<T>(run: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      return await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const install = () =>
    act(async () => {
      const updated = await api<Pack>(`/api/packs/${pack.id}/install`, { method: pack.installed ? 'DELETE' : 'POST' });
      onChange(updated);
      await reloadSounds();
    });

  const rate = (stars: number) => act(async () => onChange(await api<Pack>(`/api/packs/${pack.id}/rating`, { method: 'PUT', body: { stars } })));

  const remove = () =>
    act(async () => {
      await api(`/api/packs/${pack.id}`, { method: 'DELETE' });
      onChange(null);
      await reloadSounds();
    });

  async function toggleSounds() {
    if (sounds) return setSounds(null);
    setSounds(await api<Sound[]>(`/api/packs/${pack.id}/sounds`));
  }

  return (
    <div className="pack-card">
      <div className="pack-icon">{pack.icon}</div>
      <div className="pack-body">
        <div className="pack-head">
          <h4>{pack.name}</h4>
          {pack.installed && (
            <span className="pack-badge">
              <Check size={12} /> no seu soundboard
            </span>
          )}
        </div>
        <p className="pack-description">{pack.description || 'Sem descrição.'}</p>
        <p className="pack-meta">
          {pack.builtin ? 'Vem com o Syden' : `Feito por ${pack.authorName ?? 'alguém que saiu'}`} · {pack.soundCount} sons ·{' '}
          {pack.installs} {pack.installs === 1 ? 'pessoa baixou' : 'pessoas baixaram'}
        </p>
        <Stars pack={pack} onRate={(stars) => void rate(stars)} />
        {error && <p className="form-error small">{error}</p>}

        {sounds && (
          <div className="pack-sounds">
            {sounds.map((sound) => (
              <button key={sound.id} className="pack-sound" onClick={() => playSoundboard(sound.id)} title="Ouvir">
                <span>{sound.icon}</span> {sound.name} <Play size={11} />
              </button>
            ))}
            <button className="link-button" onClick={stopAllSounds}>
              Parar
            </button>
          </div>
        )}
      </div>
      <div className="pack-actions">
        <button className={pack.installed ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={() => void install()}>
          {pack.installed ? (
            <>
              <X size={14} /> Tirar
            </>
          ) : (
            <>
              <Download size={14} /> Instalar
            </>
          )}
        </button>
        <button className="link-button" onClick={() => void toggleSounds()}>
          {sounds ? 'Esconder sons' : 'Ouvir os sons'}
        </button>
        {(mine || user.isAdmin) && !pack.builtin && (
          <button className="link-button danger" disabled={busy} onClick={() => void remove()}>
            <Trash2 size={14} /> Apagar pacote
          </button>
        )}
      </div>
    </div>
  );
}

/** Monta um pacote novo: escolhe vários áudios de uma vez e dá nome a cada um. */
function NewPackForm({ onDone }: { onDone: (created: Pack) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📦');
  const [sounds, setSounds] = useState<{ name: string; icon: string; audio: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: File[]) {
    setError(null);
    const added: { name: string; icon: string; audio: string }[] = [];
    for (const file of files.slice(0, MAX_SOUNDS)) {
      try {
        added.push({
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 32),
          icon: '🔊',
          audio: await prepareSound(file, 1024 * 1024),
        });
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
    setSounds((list) => [...list, ...added].slice(0, MAX_SOUNDS));
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const pack = await api<Pack>('/api/packs', { method: 'POST', body: { name, description, icon, sounds } });
      await reloadSounds();
      onDone(pack);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="settings-card pack-form">
      <div className="upload-row">
        <label className="settings-field icon-field">
          Ícone
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
        </label>
        <label className="settings-field">
          Nome do pacote
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Zoeira da turma" maxLength={32} />
        </label>
      </div>
      <label className="settings-field">
        Descrição
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que tem dentro do pacote"
          maxLength={200}
        />
      </label>

      <label className="file-picker btn-secondary">
        <Plus size={16} /> Escolher áudios
        <input
          type="file"
          accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp3,.ogg,.wav"
          multiple
          hidden
          onChange={(e) => e.target.files && void addFiles([...e.target.files])}
        />
      </label>
      <p className="settings-hint">
        MP3, OGG ou WAV, até {MAX_SOUND_SECONDS} segundos e 1 MB cada; no máximo {MAX_SOUNDS} sons por pacote.
      </p>

      {sounds.map((sound, index) => (
        <div key={index} className="pack-sound-row">
          <input
            className="soundboard-add-icon"
            value={sound.icon}
            maxLength={8}
            aria-label={`Ícone do som ${index + 1}`}
            onChange={(e) => setSounds((list) => list.map((s, i) => (i === index ? { ...s, icon: e.target.value } : s)))}
          />
          <input
            value={sound.name}
            maxLength={32}
            aria-label={`Nome do som ${index + 1}`}
            onChange={(e) => setSounds((list) => list.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)))}
          />
          <button className="icon-plain" aria-label={`Tirar ${sound.name}`} onClick={() => setSounds((list) => list.filter((_, i) => i !== index))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      {error && <p className="form-error">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy || name.trim().length < 2 || sounds.length === 0 || sounds.some((s) => !s.name.trim())}
        onClick={() => void create()}
      >
        {busy ? 'Enviando…' : `Criar pacote com ${sounds.length} ${sounds.length === 1 ? 'som' : 'sons'}`}
      </button>
    </div>
  );
}

export function PackCatalog({ user }: { user: User }) {
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Pack[]>('/api/packs').then(setPacks, (e) => setError((e as Error).message));
  }, []);

  const replace = (id: number) => (pack: Pack | null) =>
    setPacks((list) => (list ?? []).flatMap((p) => (p.id === id ? (pack ? [pack] : []) : [p])));

  return (
    <>
      <div className="section-head">
        <h3>{packs ? `${packs.length} pacotes` : 'Pacotes'}</h3>
        <button className="btn-secondary" onClick={() => setCreating(!creating)}>
          <Plus size={16} /> {creating ? 'Cancelar' : 'Criar pacote'}
        </button>
      </div>
      <p className="settings-hint">
        Instale os pacotes que quiser: os sons deles entram no seu soundboard, e só no seu. As estrelas ajudam a turma a
        achar os melhores.
      </p>

      {creating && (
        <NewPackForm
          onDone={(created) => {
            setPacks((list) => [created, ...(list ?? [])]);
            setCreating(false);
          }}
        />
      )}

      {error && <p className="form-error">{error}</p>}
      {!packs && !error && <p className="settings-hint">Carregando…</p>}

      <div className="pack-list">
        {packs?.map((pack) => (
          <PackCard key={pack.id} pack={pack} user={user} onChange={replace(pack.id)} />
        ))}
      </div>
    </>
  );
}
