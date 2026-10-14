import { Check, Download, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, mediaUrl } from './api';
import type { Community, EmojiPack, EmojiPackItem, User } from './types';
import { prepareImage } from './upload';
import { useT } from './i18n';

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
  const t = useT();
  const [hover, setHover] = useState(0);
  const shown = hover || pack.myStars || Math.round(pack.stars ?? 0);

  return (
    <div className="pack-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={`pack-star${n <= shown ? ' on' : ''}${pack.myStars ? ' mine' : ''}`}
          title={t('Dar {n} de 5', { n })}
          aria-label={t('Dar {n} de 5 estrelas para {pacote}', { n, pacote: pack.name })}
          onMouseEnter={() => setHover(n)}
          onClick={() => onRate(n)}
        >
          <Star size={15} />
        </button>
      ))}
      <span className="pack-stars-count">{pack.stars === null ? t('sem notas ainda') : `${pack.stars.toFixed(1)} (${pack.ratings})`}</span>
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
  const t = useT();
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
        setAviso(
          r.removed === 1
            ? t('1 emoji saiu de {comunidade}.', { comunidade: community.name })
            : t('{n} emojis saíram de {comunidade}.', { n: r.removed, comunidade: community.name }),
        );
      } else {
        const r = await api<{ added: number; skipped: string[] }>(`/api/emoji-packs/${pack.id}/install`, {
          method: 'POST',
          body: { communityId: community.id },
        });
        setAviso(
          r.skipped.length > 0
            ? r.added === 1
              ? t('1 emoji entrou. Ficaram de fora, porque a comunidade já tem esses nomes: {nomes}', { nomes: r.skipped.map((n) => `:${n}:`).join(', ') })
              : t('{n} emojis entraram. Ficaram de fora, porque a comunidade já tem esses nomes: {nomes}', {
                  n: r.added,
                  nomes: r.skipped.map((n) => `:${n}:`).join(', '),
                })
            : r.added === 1
              ? t('Pronto: 1 emoji entrou em {comunidade}.', { comunidade: community.name })
              : t('Pronto: {n} emojis entraram em {comunidade}.', { n: r.added, comunidade: community.name }),
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
          ? novos.length === 1
            ? t('Emoji acrescentado — quem já tem o pacote recebeu na hora.')
            : t('{n} emojis acrescentados — quem já tem o pacote recebeu na hora.', { n: novos.length })
          : novos.length === 1
            ? t('Emoji acrescentado ao pacote.')
            : t('{n} emojis acrescentados ao pacote.', { n: novos.length }),
      );
      onChange({ ...atualizado, installed: pack.installed });
    });

  const tirarDoPacote = (item: EmojiPackItem) =>
    act(async () => {
      const atualizado = await api<EmojiPack>(`/api/emoji-packs/${pack.id}/emojis/${item.id}`, { method: 'DELETE' });
      setEmojis((lista) => (lista ?? []).filter((x) => x.id !== item.id));
      setAviso(
        pack.installs > 0
          ? t(':{nome}: saiu do pacote e das comunidades que o usam.', { nome: item.name })
          : t(':{nome}: saiu do pacote.', { nome: item.name }),
      );
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
              <Check size={12} /> {t('em {comunidade}', { comunidade: community.name })}
            </span>
          )}
        </div>
        <p className="pack-description">{pack.description || t('Sem descrição.')}</p>
        <p className="pack-meta">
          {t('Feito por {pessoa}', { pessoa: pack.authorName ?? t('alguém que saiu') })} ·{' '}
          {pack.emojiCount === 1 ? t('1 emoji') : t('{n} emojis', { n: pack.emojiCount })} ·{' '}
          {pack.installs === 1 ? t('1 comunidade usa') : t('{n} comunidades usam', { n: pack.installs })}
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
                    title={t('Tirar :{nome}: do pacote', { nome: item.name })}
                    aria-label={t('Tirar :{nome}: do pacote', { nome: item.name })}
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
                <Plus size={14} /> {t('Acrescentar')}
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
          title={podeInstalar ? undefined : t('Só quem administra a comunidade pode mexer nos emojis dela')}
          onClick={() => void instalar()}
        >
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
        <button className="link-button" onClick={() => void verEmojis()}>
          {emojis ? t('Esconder os emojis') : meu ? t('Ver e mexer nos emojis') : t('Ver os emojis')}
        </button>
        {(meu || user.isAdmin) && (
          <button className="link-button danger" disabled={busy} onClick={() => void apagar()}>
            <Trash2 size={14} /> {t('Apagar pacote')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Monta um pacote novo com imagens escolhidas do computador. */
function NovoPacote({ onDone }: { onDone: (created: EmojiPack) => void }) {
  const t = useT();
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
          {t('Ícone')}
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
        </label>
        <label className="settings-field">
          {t('Nome do pacote')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ex.: Caras da turma')} maxLength={32} />
        </label>
      </div>
      <label className="settings-field">
        {t('Descrição')}
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('O que tem dentro')} maxLength={140} />
      </label>

      <label className="file-picker btn-secondary">
        <Plus size={16} /> {t('Escolher imagens')}
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => e.target.files && void adicionar([...e.target.files])} />
      </label>
      <p className="settings-hint">
        {t('PNG, JPG, GIF ou WEBP; cada um vira um quadradinho de 128 pixels. No máximo {n} emojis por pacote.', { n: MAX_EMOJIS })}
      </p>

      <div className="emoji-pack-novos">
        {emojis.map((emoji, index) => (
          <div key={index} className="emoji-pack-novo">
            <img src={emoji.image} alt="" />
            <input
              value={emoji.name}
              maxLength={32}
              aria-label={t('Nome do emoji {n}', { n: index + 1 })}
              onChange={(e) => setEmojis((lista) => lista.map((x, i) => (i === index ? { ...x, name: nomeDoArquivo(e.target.value) } : x)))}
            />
            <button className="icon-plain" aria-label={t('Tirar {nome}', { nome: emoji.name })} onClick={() => setEmojis((lista) => lista.filter((_, i) => i !== index))}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {nomesRepetidos && <p className="form-error">{t('Dois emojis com o mesmo nome: cada um precisa do seu.')}</p>}
      {error && <p className="form-error">{error}</p>}
      <button
        className="btn-primary"
        disabled={busy || name.trim().length < 2 || emojis.length === 0 || emojis.some((e) => e.name.length < 2) || nomesRepetidos}
        onClick={() => void criar()}
      >
        {busy
          ? t('Enviando…')
          : emojis.length === 1
            ? t('Criar pacote com 1 emoji')
            : t('Criar pacote com {n} emojis', { n: emojis.length })}
      </button>
    </div>
  );
}

/** Publica os emojis que a comunidade já tem, para outras comunidades poderem instalar. */
function PublicarDaComunidade({ community, onDone }: { community: Community; onDone: (created: EmojiPack) => void }) {
  const t = useT();
  const [name, setName] = useState(t('Emojis de {comunidade}', { comunidade: community.name }).slice(0, 32));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A frase é uma chave só; o nome entra em negrito no lugar de {comunidade}.
  const [antesDoNome, depoisDoNome = ''] = t(
    'Junta todos os emojis que {comunidade} tem hoje num pacote só, para as suas outras comunidades (ou as dos seus amigos) instalarem de uma vez.',
  )
    .split('{comunidade}')
    .map((pedaco) => pedaco.trim());

  async function publicar() {
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api<EmojiPack>('/api/emoji-packs/from-community', {
          method: 'POST',
          body: { communityId: community.id, name, description: t('Os emojis de {comunidade}', { comunidade: community.name }), icon: '😀' },
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
        {t('Nome do pacote')}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
      </label>
      <p className="settings-hint">
        {antesDoNome} <strong>{community.name}</strong> {depoisDoNome}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={() => void publicar()}>
        {busy ? t('Publicando…') : t('Publicar os emojis desta comunidade')}
      </button>
    </div>
  );
}

export function EmojiPackCatalog({ user, community, podeInstalar }: { user: User; community: Community; podeInstalar: boolean }) {
  const t = useT();
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
        <h3>{packs ? (packs.length === 1 ? t('1 pacote') : t('{n} pacotes', { n: packs.length })) : t('Pacotes de emoji')}</h3>
        <div className="section-head-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              setCriando(!criando);
              setPublicando(false);
            }}
          >
            <Plus size={16} /> {criando ? t('Cancelar') : t('Criar pacote')}
          </button>
          {podeInstalar && (
            <button
              className="btn-secondary"
              onClick={() => {
                setPublicando(!publicando);
                setCriando(false);
              }}
            >
              <Upload size={16} /> {publicando ? t('Cancelar') : t('Publicar os daqui')}
            </button>
          )}
        </div>
      </div>
      <p className="settings-hint">
        {t('Um pacote instalado entra para toda a comunidade: os emojis dele passam a valer nas mensagens de todo mundo.')}{' '}
        {podeInstalar ? '' : t('Só quem administra pode instalar ou tirar.')}
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
          {t('Nenhum pacote ainda. Monte o primeiro com imagens suas, ou publique os emojis que esta comunidade já tem.')}
        </p>
      )}
      {packs?.map((pack) => (
        <PackCard key={pack.id} pack={pack} user={user} community={community} podeInstalar={podeInstalar} onChange={trocar(pack.id)} />
      ))}
    </>
  );
}
