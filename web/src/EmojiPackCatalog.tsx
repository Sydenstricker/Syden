import { Check, Download, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, mediaUrl } from './api';
import type { Community, EmojiPack, EmojiPackItem, User } from './types';
import { prepareImage } from './upload';

// Catálogo de pacotes de emoji. A diferença para o de sons: som cada um instala no seu soundboard, emoji
// entra na COMUNIDADE inteira — só faz sentido se todo mundo na conversa enxergar o mesmo desenho. Por
// isso quem instala é quem administra, e o pacote vale para todos de uma vez.

const MAX_EMOJIS = 60;
const KB = 1024;

/** Nome de emoji a partir do arquivo: "Pepe Triste.png" vira "pepe_triste". */
function nomeDoArquivo(arquivo: string): string {
  return arquivo
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
}

function Stars({ pack, onRate }: { pack: EmojiPack; onRate: (stars: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || pack.myStars || Math.round(pack.stars ?? 0);

  return (
    <div className="pack-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={`pack-star${n <= shown ? ' on' : ''}${pack.myStars ? ' mine' : ''}`}
          title={`Dar ${n} de 5`}
          aria-label={`Dar ${n} de 5 estrelas para ${pack.name}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onRate(n)}
        >
          <Star size={15} />
        </button>
      ))}
      <span className="pack-stars-count">{pack.stars === null ? 'sem notas ainda' : `${pack.stars.toFixed(1)} (${pack.ratings})`}</span>
    </div>
  );
}

function PackCard({
  pack,
  user,
  community,
  podeInstalar,
  onChange,
}: {
  pack: EmojiPack;
  user: User;
  community: Community;
  podeInstalar: boolean;
  onChange: (pack: EmojiPack | null) => void;
}) {
  const [emojis, setEmojis] = useState<EmojiPackItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meu = pack.createdBy === user.id;

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

  const recarregar = async () => {
    const lista = await api<EmojiPack[]>(`/api/emoji-packs?communityId=${community.id}`);
    onChange(lista.find((p) => p.id === pack.id) ?? null);
  };

  const instalar = () =>
    act(async () => {
      if (pack.installed) {
        const r = await api<{ removed: number }>(`/api/emoji-packs/${pack.id}/install?communityId=${community.id}`, { method: 'DELETE' });
        setAviso(`${r.removed} ${r.removed === 1 ? 'emoji saiu' : 'emojis saíram'} de ${community.name}.`);
      } else {
        const r = await api<{ added: number; skipped: string[] }>(`/api/emoji-packs/${pack.id}/install`, {
          method: 'POST',
          body: { communityId: community.id },
        });
        setAviso(
          r.skipped.length > 0
            ? `${r.added} ${r.added === 1 ? 'emoji entrou' : 'emojis entraram'}. Ficaram de fora, porque a comunidade já tem esses nomes: ${r.skipped.map((n) => `:${n}:`).join(', ')}`
            : `Pronto: ${r.added} ${r.added === 1 ? 'emoji entrou' : 'emojis entraram'} em ${community.name}.`,
        );
      }
      await recarregar();
    });

  const avaliar = (stars: number) =>
    act(async () => {
      await api(`/api/emoji-packs/${pack.id}/rating`, { method: 'PUT', body: { stars } });
      await recarregar();
    });

  const apagar = () =>
    act(async () => {
      await api(`/api/emoji-packs/${pack.id}`, { method: 'DELETE' });
      onChange(null);
    });

  async function verEmojis() {
    if (emojis) return setEmojis(null);
    setEmojis(await api<EmojiPackItem[]>(`/api/emoji-packs/${pack.id}/emojis`));
  }

  /** Acrescenta desenhos ao pacote. Quem já instalou recebe os novos na hora, sem reinstalar. */
  const acrescentar = (arquivos: File[]) =>
    act(async () => {
      const novos: { name: string; image: string }[] = [];
      for (const arquivo of arquivos.slice(0, MAX_EMOJIS)) {
        novos.push({ name: nomeDoArquivo(arquivo.name), image: await prepareImage(arquivo, { size: 128, fit: 'contain', maxBytes: 512 * KB }) });
      }
      const atualizado = await api<EmojiPack>(`/api/emoji-packs/${pack.id}/emojis`, { method: 'POST', body: { emojis: novos } });
      setEmojis(await api<EmojiPackItem[]>(`/api/emoji-packs/${pack.id}/emojis`));
      setAviso(
        pack.installs > 0
          ? `${novos.length === 1 ? 'Emoji acrescentado' : `${novos.length} emojis acrescentados`} — quem já tem o pacote recebeu na hora.`
          : `${novos.length === 1 ? 'Emoji acrescentado' : `${novos.length} emojis acrescentados`} ao pacote.`,
      );
      onChange({ ...atualizado, installed: pack.installed });
    });

  const tirarDoPacote = (item: EmojiPackItem) =>
    act(async () => {
      const atualizado = await api<EmojiPack>(`/api/emoji-packs/${pack.id}/emojis/${item.id}`, { method: 'DELETE' });
      setEmojis((lista) => (lista ?? []).filter((x) => x.id !== item.id));
      setAviso(`:${item.name}: saiu do pacote${pack.installs > 0 ? ' e das comunidades que o usam' : ''}.`);
      onChange({ ...atualizado, installed: pack.installed });
    });

  return (
    <div className="pack-card">
      <div className="pack-icon">{pack.icon}</div>
      <div className="pack-body">
        <div className="pack-head">
          <h4>{pack.name}</h4>
          {pack.installed && (
            <span className="pack-badge">
              <Check size={12} /> em {community.name}
            </span>
          )}
        </div>
        <p className="pack-description">{pack.description || 'Sem descrição.'}</p>
        <p className="pack-meta">
          Feito por {pack.authorName ?? 'alguém que saiu'} · {pack.emojiCount} {pack.emojiCount === 1 ? 'emoji' : 'emojis'} ·{' '}
          {pack.installs} {pack.installs === 1 ? 'comunidade usa' : 'comunidades usam'}
        </p>
        <Stars pack={pack} onRate={(stars) => void avaliar(stars)} />
        {aviso && <p className="settings-hint">{aviso}</p>}
        {error && <p className="form-error small">{error}</p>}

        {emojis && (
          <div className="emoji-pack-grid">
            {emojis.map((item) => (
              <figure key={item.id}>
                <img src={mediaUrl.emojiDoPacote(item.id)} alt={`:${item.name}:`} />
                <figcaption>:{item.name}:</figcaption>
                {meu && (
                  <button
                    className="icon-plain emoji-pack-tirar"
                    title={`Tirar :${item.name}: do pacote`}
                    aria-label={`Tirar :${item.name}: do pacote`}
                    disabled={busy}
                    onClick={() => void tirarDoPacote(item)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </figure>
            ))}
            {meu && (
              <label className="file-picker btn-secondary small">
                <Plus size={14} /> Acrescentar
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  hidden
                  onChange={(e) => e.target.files && void acrescentar([...e.target.files])}
                />
              </label>
            )}
          </div>
        )}
      </div>
      <div className="pack-actions">
        <button
          className={pack.installed ? 'btn-secondary' : 'btn-primary'}
          disabled={busy || !podeInstalar}
          title={podeInstalar ? undefined : 'Só quem administra a comunidade pode mexer nos emojis dela'}
          onClick={() => void instalar()}
        >
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
        <button className="link-button" onClick={() => void verEmojis()}>
          {emojis ? 'Esconder os emojis' : meu ? 'Ver e mexer nos emojis' : 'Ver os emojis'}
        </button>
        {(meu || user.isAdmin) && (
          <button className="link-button danger" disabled={busy} onClick={() => void apagar()}>
            <Trash2 size={14} /> Apagar pacote
          </button>
        )}
      </div>
    </div>
  );
}

/** Monta um pacote novo com imagens escolhidas do computador. */
function NovoPacote({ onDone }: { onDone: (created: EmojiPack) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('😀');
  const [emojis, setEmojis] = useState<{ name: string; image: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function adicionar(arquivos: File[]) {
    setError(null);
    const novos: { name: string; image: string }[] = [];
    for (const arquivo of arquivos.slice(0, MAX_EMOJIS)) {
      try {
        novos.push({ name: nomeDoArquivo(arquivo.name), image: await prepareImage(arquivo, { size: 128, fit: 'contain', maxBytes: 512 * KB }) });
      } catch (e) {
        setError(`${arquivo.name}: ${(e as Error).message}`);
      }
    }
    setEmojis((lista) => [...lista, ...novos].slice(0, MAX_EMOJIS));
  }

  async function criar() {
    setBusy(true);
    setError(null);
    try {
      onDone(await api<EmojiPack>('/api/emoji-packs', { method: 'POST', body: { name, description, icon, emojis } }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const nomesRepetidos = new Set(emojis.map((e) => e.name)).size !== emojis.length;

  return (
    <div className="settings-card pack-form">
      <div className="upload-row">
        <label className="settings-field icon-field">
          Ícone
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
        </label>
        <label className="settings-field">
          Nome do pacote
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Caras da turma" maxLength={32} />
        </label>
      </div>
      <label className="settings-field">
        Descrição
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que tem dentro" maxLength={140} />
      </label>

      <label className="file-picker btn-secondary">
        <Plus size={16} /> Escolher imagens
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => e.target.files && void adicionar([...e.target.files])} />
      </label>
      <p className="settings-hint">
        PNG, JPG, GIF ou WEBP; cada um vira um quadradinho de 128 pixels. No máximo {MAX_EMOJIS} emojis por pacote.
      </p>

      <div className="emoji-pack-novos">
        {emojis.map((emoji, index) => (
          <div key={index} className="emoji-pack-novo">
            <img src={emoji.image} alt="" />
            <input
              value={emoji.name}
              maxLength={32}
              aria-label={`Nome do emoji ${index + 1}`}
              onChange={(e) => setEmojis((lista) => lista.map((x, i) => (i === index ? { ...x, name: nomeDoArquivo(e.target.value) } : x)))}
            />
            <button className="icon-plain" aria-label={`Tirar ${emoji.name}`} onClick={() => setEmojis((lista) => lista.filter((_, i) => i !== index))}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {nomesRepetidos && <p className="form-error">Dois emojis com o mesmo nome: cada um precisa do seu.</p>}
      {error && <p className="form-error">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy || name.trim().length < 2 || emojis.length === 0 || emojis.some((e) => e.name.length < 2) || nomesRepetidos}
        onClick={() => void criar()}
      >
        {busy ? 'Enviando…' : `Criar pacote com ${emojis.length} ${emojis.length === 1 ? 'emoji' : 'emojis'}`}
      </button>
    </div>
  );
}

/** Publica os emojis que a comunidade já tem, para outras comunidades poderem instalar. */
function PublicarDaComunidade({ community, onDone }: { community: Community; onDone: (created: EmojiPack) => void }) {
  const [name, setName] = useState(`Emojis de ${community.name}`.slice(0, 32));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publicar() {
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api<EmojiPack>('/api/emoji-packs/from-community', {
          method: 'POST',
          body: { communityId: community.id, name, description: `Os emojis de ${community.name}`, icon: '😀' },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="settings-card pack-form">
      <label className="settings-field">
        Nome do pacote
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
      </label>
      <p className="settings-hint">
        Junta todos os emojis que <strong>{community.name}</strong> tem hoje num pacote só, para as suas outras comunidades (ou
        as dos seus amigos) instalarem de uma vez.
      </p>
      {error && <p className="form-error">{error}</p>}
      <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={() => void publicar()}>
        {busy ? 'Publicando…' : 'Publicar os emojis desta comunidade'}
      </button>
    </div>
  );
}

export function EmojiPackCatalog({ user, community, podeInstalar }: { user: User; community: Community; podeInstalar: boolean }) {
  const [packs, setPacks] = useState<EmojiPack[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPacks(null);
    api<EmojiPack[]>(`/api/emoji-packs?communityId=${community.id}`).then(setPacks, (e) => setError((e as Error).message));
  }, [community.id]);

  const trocar = (id: number) => (pack: EmojiPack | null) =>
    setPacks((lista) => (lista ?? []).flatMap((p) => (p.id === id ? (pack ? [pack] : []) : [p])));

  return (
    <>
      <div className="section-head">
        <h3>{packs ? `${packs.length} ${packs.length === 1 ? 'pacote' : 'pacotes'}` : 'Pacotes de emoji'}</h3>
        <div className="section-head-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              setCriando(!criando);
              setPublicando(false);
            }}
          >
            <Plus size={16} /> {criando ? 'Cancelar' : 'Criar pacote'}
          </button>
          {podeInstalar && (
            <button
              className="btn-secondary"
              onClick={() => {
                setPublicando(!publicando);
                setCriando(false);
              }}
            >
              <Upload size={16} /> {publicando ? 'Cancelar' : 'Publicar os daqui'}
            </button>
          )}
        </div>
      </div>
      <p className="settings-hint">
        Um pacote instalado entra para <strong>toda a comunidade</strong>: os emojis dele passam a valer nas mensagens de todo
        mundo. {podeInstalar ? '' : 'Só quem administra pode instalar ou tirar.'}
      </p>

      {criando && <NovoPacote onDone={(pack) => {
        setCriando(false);
        setPacks((lista) => [pack, ...(lista ?? [])]);
      }} />}
      {publicando && <PublicarDaComunidade community={community} onDone={(pack) => {
        setPublicando(false);
        setPacks((lista) => [pack, ...(lista ?? [])]);
      }} />}

      {error && <p className="form-error">{error}</p>}
      {packs?.length === 0 && !criando && !publicando && (
        <p className="settings-hint">
          Nenhum pacote ainda. Monte o primeiro com imagens suas, ou publique os emojis que esta comunidade já tem.
        </p>
      )}
      {packs?.map((pack) => (
        <PackCard key={pack.id} pack={pack} user={user} community={community} podeInstalar={podeInstalar} onChange={trocar(pack.id)} />
      ))}
    </>
  );
}
