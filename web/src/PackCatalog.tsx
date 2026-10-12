import { Check, Download, Pencil, Play, Plus, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { reloadSounds } from './directory';
import { playSoundboard, stopAllSounds } from './soundboard';
import type { Pack, Sound, User } from './types';
import { MAX_SOUND_SECONDS, prepareSound } from './upload';
import { useT } from './i18n';

// Catálogo de pacotes de sons: os que vêm com o Syden e os que as pessoas montam. Cada um instala os que
// quiser no próprio soundboard e dá de uma a cinco estrelas, como nas extensões do VS Code.

const MAX_SOUNDS = 40;

/** Um pedido ao servidor que pode devolver o pacote atualizado. */
interface Pedido {
  (): Promise<Pack | undefined>;
}

/** Depois de mexer no pacote: troca o cartão (quando veio o pacote novo) e busca os sons de novo. */
interface AoMudar {
  (atualizado?: Pack): Promise<void>;
}

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

function PackCard({
  pack,
  user,
  meusPacotes,
  onChange,
  aoMover,
}: {
  pack: Pack;
  user: User;
  /** Os pacotes que esta pessoa pode editar: os destinos de "Mover para". */
  meusPacotes: Pack[];
  onChange: (pack: Pack | null) => void;
  /** Um som mudou de pacote: o de destino ganhou um som, e a contagem dele precisa ser buscada. */
  aoMover: () => void;
}) {
  const t = useT();
  const [sounds, setSounds] = useState<Sound[] | null>(null);
  const [editando, setEditando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = pack.createdBy === user.id;
  const podeEditar = (mine || !!user.isAdmin) && !pack.builtin;

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
    if (sounds) {
      setEditando(false);
      return setSounds(null);
    }
    setSounds(await api<Sound[]>(`/api/packs/${pack.id}/sounds`));
  }

  const recarregarSons = async (atualizado?: Pack) => {
    if (atualizado) onChange(atualizado);
    setSounds(await api<Sound[]>(`/api/packs/${pack.id}/sounds`));
    await reloadSounds();
  };

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

        {sounds && editando && (
          <EditorDoPacote
            pack={pack}
            sounds={sounds}
            destinos={meusPacotes.filter((p) => p.id !== pack.id)}
            aoMudar={recarregarSons}
            aoMover={aoMover}
          />
        )}
        {sounds && !editando && (
          <div className="pack-sounds">
            {sounds.map((sound) => (
              <button key={sound.id} className="pack-sound" onClick={() => playSoundboard(sound.id, sound.volume)} title="Ouvir">
                <span>{sound.icon}</span> {sound.name} <Play size={11} />
              </button>
            ))}
            <button className="link-button" onClick={stopAllSounds}>
              {t('Parar')}
            </button>
          </div>
        )}
      </div>
      <div className="pack-actions">
        <button className={pack.installed ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={() => void install()}>
          {pack.installed ? (
            <>
              <X size={14} /> {t('Tirar')}
            </>
          ) : (
            <>
              <Download size={14} /> {t('Instalar')}
            </>
          )}
        </button>
        <button className="link-button" onClick={() => void toggleSounds()}>
          {sounds ? 'Esconder sons' : 'Ouvir os sons'}
        </button>
        {podeEditar && sounds && (
          <button className="link-button" onClick={() => setEditando(!editando)}>
            <Pencil size={14} /> {editando ? t('Pronto') : t('Editar sons')}
          </button>
        )}
        {(mine || user.isAdmin) && !pack.builtin && (
          <button className="link-button danger" disabled={busy} onClick={() => void remove()}>
            <Trash2 size={14} /> Apagar pacote
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Mexer num pacote que já existe (12/10/2026): volume de cada som, mover para outro pacote seu, apagar e
 * acrescentar. Antes só dava para criar e apagar o pacote inteiro — o "Não chora", gravado estourado, estava
 * no Streamer e o único jeito de tirá-lo de lá era apagar.
 */
function EditorDoPacote({
  pack,
  sounds,
  destinos,
  aoMudar,
  aoMover,
}: {
  pack: Pack;
  sounds: Sound[];
  destinos: Pack[];
  aoMudar: AoMudar;
  aoMover: () => void;
}) {
  const t = useT();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // O volume muda na tela enquanto a barra anda, e vai ao servidor só ao soltar.
  const [volumes, setVolumes] = useState<Record<number, number>>({});

  async function fazer(run: Pedido) {
    setErro(null);
    try {
      await aoMudar(await run());
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const salvarVolume = (sound: Sound) => {
    const volume = volumes[sound.id];
    if (volume === undefined || volume === sound.volume) return;
    void fazer(async () => {
      await api(`/api/packs/${pack.id}/sounds/${sound.id}`, { method: 'PATCH', body: { volume } });
      return undefined;
    });
  };

  const mover = (sound: Sound, para: number) =>
    fazer(async () => {
      const atualizado = await api<Pack>(`/api/packs/${pack.id}/sounds/${sound.id}/pacote`, { method: 'PUT', body: { para } });
      aoMover();
      return atualizado;
    });

  const apagar = (sound: Sound) => fazer(() => api<Pack>(`/api/packs/${pack.id}/sounds/${sound.id}`, { method: 'DELETE' }));

  async function acrescentar(files: File[]) {
    setEnviando(true);
    setErro(null);
    const novos: { name: string; icon: string; audio: string }[] = [];
    for (const file of files.slice(0, MAX_SOUNDS - sounds.length)) {
      try {
        novos.push({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 32), icon: '🔊', audio: await prepareSound(file, 1024 * 1024) });
      } catch (e) {
        setErro(`${file.name}: ${(e as Error).message}`);
      }
    }
    if (novos.length) await fazer(() => api<Pack>(`/api/packs/${pack.id}/sounds`, { method: 'POST', body: { sounds: novos } }));
    setEnviando(false);
  }

  return (
    <div className="pack-editor">
      {sounds.map((sound) => {
        const volume = volumes[sound.id] ?? sound.volume;
        return (
          <div key={sound.id} className="pack-editor-row">
            <button className="icon-plain" title={t('Ouvir')} aria-label={`${t('Ouvir')}: ${sound.name}`} onClick={() => playSoundboard(sound.id, volume)}>
              <Play size={14} />
            </button>
            <span className="pack-editor-name">
              {sound.icon} {sound.name}
            </span>
            <label className="pack-editor-volume" title={t('Volume do som, para todo mundo')}>
              <span>{Math.round(volume * 100)}%</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={volume}
                aria-label={`${t('Volume do som, para todo mundo')}: ${sound.name}`}
                onChange={(e) => setVolumes((v) => ({ ...v, [sound.id]: Number(e.target.value) }))}
                onPointerUp={() => salvarVolume(sound)}
                onKeyUp={() => salvarVolume(sound)}
              />
            </label>
            {destinos.length > 0 && (
              <select
                value=""
                aria-label={`${t('Mover para outro pacote')}: ${sound.name}`}
                onChange={(e) => e.target.value && void mover(sound, Number(e.target.value))}
              >
                <option value="">{t('Mover para…')}</option>
                {destinos.map((destino) => (
                  <option key={destino.id} value={destino.id}>
                    {destino.icon} {destino.name}
                  </option>
                ))}
              </select>
            )}
            <button className="icon-plain" title={t('Excluir')} aria-label={`${t('Excluir')}: ${sound.name}`} onClick={() => void apagar(sound)}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      {sounds.length < MAX_SOUNDS && (
        <label className="file-picker btn-secondary">
          <Plus size={16} /> {enviando ? t('Enviando…') : t('Adicionar áudios')}
          <input
            type="file"
            accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp3,.ogg,.wav"
            multiple
            hidden
            disabled={enviando}
            onChange={(e) => e.target.files && void acrescentar([...e.target.files])}
          />
        </label>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

/** Monta um pacote novo: escolhe vários áudios de uma vez e dá nome a cada um. */
function NewPackForm({ onDone }: { onDone: (created: Pack) => void }) {
  const t = useT();
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
          {t('Ícone')}
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
        </label>
        <label className="settings-field">
          {t('Nome do pacote')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Zoeira da turma" maxLength={32} />
        </label>
      </div>
      <label className="settings-field">
        {t('Descrição')}
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('O que tem dentro do pacote')}
          maxLength={200}
        />
      </label>

      <label className="file-picker btn-secondary">
        <Plus size={16} /> {t('Escolher áudios')}
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
  const t = useT();
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
      {!packs && !error && <p className="settings-hint">{t('Carregando…')}</p>}

      <div className="pack-list">
        {packs?.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            user={user}
            meusPacotes={(packs ?? []).filter((p) => !p.builtin && (p.createdBy === user.id || !!user.isAdmin))}
            onChange={replace(pack.id)}
            aoMover={() => void api<Pack[]>('/api/packs').then(setPacks)}
          />
        ))}
      </div>
    </>
  );
}
