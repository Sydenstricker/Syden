import { Room } from 'livekit-client';
import { AudioLines, Bell, CircleUser, Hash, LogOut, Mic, Play, ShieldOff, ShieldPlus, Smile, Trash2, UserX, Users, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { api, mediaUrl } from './api';
import { type ScreenQuality, updateSettings, useSettings } from './settings';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { SHORTCUT_LABELS, desktopBridge } from './desktop';
import { useDirectory } from './directory';
import { playSoundboard } from './soundboard';
import { sounds } from './sounds';
import type { Community, CommunityMember, Emoji, Role, Sound, User } from './types';
import { MAX_SOUND_SECONDS, emojiNameFromFile, prepareImage, prepareSound } from './upload';
import type { Voice } from './useVoice';

type Section = 'account' | 'voice' | 'sounds' | 'community' | 'members' | 'emojis' | 'soundboard';

const USER_SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'account', label: 'Minha conta', icon: <CircleUser size={18} /> },
  { id: 'voice', label: 'Voz e vídeo', icon: <Mic size={18} /> },
  { id: 'sounds', label: 'Notificações', icon: <Bell size={18} /> },
];

const COMMUNITY_SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'community', label: 'Comunidade', icon: <Hash size={18} /> },
  { id: 'members', label: 'Membros', icon: <Users size={18} /> },
  { id: 'emojis', label: 'Emojis', icon: <Smile size={18} /> },
  { id: 'soundboard', label: 'Soundboard', icon: <AudioLines size={18} /> },
];

const KB = 1024;

export function SettingsModal({
  user,
  community,
  voice,
  onClose,
  onLogout,
  onCommunityChanged,
}: {
  user: User;
  community: Community | undefined;
  voice: Voice;
  onClose: () => void;
  onLogout: () => void;
  onCommunityChanged: () => void;
}) {
  const [section, setSection] = useState<Section>('account');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="settings" role="dialog" aria-modal="true" aria-label="Configurações">
      <nav className="settings-nav">
        <div className="settings-nav-inner">
          <h4>Configurações do usuário</h4>
          {USER_SECTIONS.map((s) => (
            <button key={s.id} className={`settings-tab${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
              {s.icon} {s.label}
            </button>
          ))}
          {community && (
            <>
              <hr />
              <h4 title={community.name}>{community.name}</h4>
              {COMMUNITY_SECTIONS.map((s) => (
                <button key={s.id} className={`settings-tab${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
                  {s.icon} {s.label}
                </button>
              ))}
            </>
          )}
          <hr />
          <button className="settings-tab danger" onClick={onLogout}>
            <LogOut size={18} /> Sair da conta
          </button>
        </div>
      </nav>

      <main className="settings-content">
        <div className="settings-content-inner">
          {section === 'account' && <AccountSection user={user} onDeleted={onLogout} />}
          {section === 'voice' && <VoiceSection voice={voice} />}
          {section === 'sounds' && <SoundsSection />}
          {community && section === 'community' && (
            <CommunitySection
              community={community}
              onChanged={onCommunityChanged}
              onLeft={() => {
                onCommunityChanged();
                onClose();
              }}
            />
          )}
          {community && section === 'members' && <MembersSection user={user} community={community} />}
          {community && section === 'emojis' && <EmojisSection user={user} community={community} />}
          {community && section === 'soundboard' && <SoundboardSection user={user} community={community} />}
        </div>
        <button className="settings-close" onClick={onClose} aria-label="Fechar configurações">
          <span className="settings-close-circle">
            <X size={18} />
          </span>
          ESC
        </button>
      </main>
    </div>
  );
}

// ---------- Minha conta ----------

function AccountSection({ user, onDeleted }: { user: User; onDeleted: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) return setMessage({ ok: false, text: 'A confirmação não bate com a nova senha.' });
    setBusy(true);
    try {
      await api('/api/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setMessage({ ok: true, text: 'Senha alterada.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <>
      <h2>Minha conta</h2>
      <AvatarEditor user={user} />

      <h3>Trocar senha</h3>
      <form className="settings-form" onSubmit={submit}>
        <label>
          Senha atual
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          Nova senha
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        <label>
          Confirmar nova senha
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>

      <DeleteAccount onDeleted={onDeleted} />

      <p className="settings-legal">
        <a href="privacidade.html" target="_blank" rel="noreferrer">
          Política de privacidade
        </a>
        {' · '}
        <a href="termos.html" target="_blank" rel="noreferrer">
          Termos de uso
        </a>
      </p>
    </>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/me/delete', { method: 'POST', body: { password } });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <h3>Excluir conta</h3>
      <div className="settings-card danger-zone">
        <p>
          Apaga a sua conta, as suas mensagens e o seu avatar. Os canais, emojis e sons que você criou continuam no
          servidor para os outros. <strong>Não dá para desfazer.</strong>
        </p>
        {open ? (
          <form className="settings-form" onSubmit={submit}>
            <label>
              Digite sua senha para confirmar
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="danger-actions">
              <button type="button" className="link-button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="btn-danger" disabled={busy || !password}>
                {busy ? 'Excluindo…' : 'Excluir minha conta para sempre'}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn-danger" onClick={() => setOpen(true)}>
            Excluir minha conta
          </button>
        )}
      </div>
    </>
  );
}

// ---------- A comunidade em si ----------

function CommunitySection({
  community,
  onChanged,
  onLeft,
}: {
  community: Community;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const [name, setName] = useState(community.name);
  const [invite, setInvite] = useState(community.inviteCode);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = community.role === 'owner';
  const manages = isOwner || community.role === 'admin';

  async function rename(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/communities/${community.id}`, { method: 'PATCH', body: { name } });
      setMessage({ ok: true, text: 'Nome alterado.' });
      onChanged();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  async function newInvite() {
    setBusy(true);
    try {
      const { inviteCode } = await api<{ inviteCode: string }>(`/api/communities/${community.id}/invite`, { method: 'POST' });
      setInvite(inviteCode);
      setMessage({ ok: true, text: 'Código novo criado. O anterior parou de funcionar.' });
      onChanged();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  async function confirm() {
    setBusy(true);
    try {
      if (confirming === 'leave') await api(`/api/communities/${community.id}/leave`, { method: 'POST' });
      else await api(`/api/communities/${community.id}`, { method: 'DELETE' });
      setConfirming(null);
      onLeft();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <h2>Comunidade</h2>
      <p className="settings-lead">
        {community.memberCount} {community.memberCount === 1 ? 'pessoa participa' : 'pessoas participam'} de {community.name}.
      </p>

      {manages && (
        <>
          <h3>Convite</h3>
          <div className="settings-card">
            <p className="settings-hint">
              Quem tiver este código entra na comunidade: pela tela de cadastro, se ainda não tem conta, ou pelo botão de
              entrar, se já usa o Syden.
            </p>
            <div className="invite-row">
              <code className="invite-code">{invite}</code>
              <button
                className="btn-secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(invite ?? '');
                  setMessage({ ok: true, text: 'Código copiado.' });
                }}
              >
                Copiar
              </button>
              <button className="link-button" onClick={newInvite} disabled={busy}>
                Gerar outro
              </button>
            </div>
          </div>

          <h3>Nome</h3>
          <form className="settings-form" onSubmit={rename}>
            <label>
              Nome da comunidade
              <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
            </label>
            <button className="btn-primary" disabled={busy || name === community.name}>
              Salvar nome
            </button>
          </form>
        </>
      )}
      {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}

      <h3>{isOwner ? 'Apagar comunidade' : 'Sair da comunidade'}</h3>
      <div className="settings-card danger-zone">
        <p>
          {isOwner
            ? 'Apaga a comunidade para todo mundo, com os canais, as mensagens, os emojis e os sons dela. Não dá para desfazer.'
            : 'Você perde o acesso aos canais desta comunidade. Para voltar, vai precisar de um convite novo.'}
        </p>
        <div className="danger-actions">
          <button className="btn-danger" onClick={() => setConfirming(isOwner ? 'delete' : 'leave')}>
            {isOwner ? 'Apagar comunidade' : 'Sair da comunidade'}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'delete' ? 'Apagar comunidade' : 'Sair da comunidade'}
          confirmLabel={confirming === 'delete' ? 'Apagar' : 'Sair'}
          busy={busy}
          error={error}
          onConfirm={confirm}
          onCancel={() => {
            setConfirming(null);
            setError(null);
          }}
        >
          {confirming === 'delete' ? (
            <>
              Apagar <strong>{community.name}</strong> para todos os {community.memberCount} membros? Os canais, as
              mensagens, os emojis e os sons somem junto.
            </>
          ) : (
            <>
              Sair de <strong>{community.name}</strong>? As suas mensagens continuam lá para quem ficou.
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

// ---------- Membros da comunidade ----------

function RoleBadge({ role }: { role: Role }) {
  if (role === 'owner') return <span className="badge badge-owner">Dono</span>;
  if (role === 'admin') return <span className="badge">Administrador</span>;
  return null;
}

function MembersSection({ user, community }: { user: User; community: Community }) {
  const { members: directory } = useDirectory();
  const [removing, setRemoving] = useState<CommunityMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const rank = (m: CommunityMember) => (m.role === 'owner' ? 2 : m.role === 'admin' ? 1 : 0);
  const members = [...directory.values()].sort((a, b) => rank(b) - rank(a) || a.username.localeCompare(b.username));
  const isOwner = community.role === 'owner';
  const manages = isOwner || community.role === 'admin';

  // Mesmas regras do servidor: administrador remove membro comum; outro administrador, só o dono; o dono, ninguém.
  const canRemove = (member: CommunityMember) =>
    member.id !== user.id && member.role !== 'owner' && (isOwner || (manages && member.role !== 'admin'));

  async function toggleAdmin(member: CommunityMember) {
    setRoleError(null);
    try {
      await api(`/api/communities/${community.id}/members/${member.id}`, {
        method: 'PUT',
        body: { role: member.role === 'admin' ? 'member' : 'admin' },
      });
    } catch (e) {
      setRoleError((e as Error).message);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/api/communities/${community.id}/members/${removing.id}`, { method: 'DELETE' });
      setRemoving(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <h2>Membros</h2>
      <p className="settings-lead">
        {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'} em {community.name}.
        {isOwner
          ? ' Como dono, você escolhe quem administra e pode remover qualquer pessoa.'
          : manages && ' Como administrador, você pode remover membros que não são administradores.'}
      </p>
      <p className="settings-hint">
        Administradores podem apagar mensagens de qualquer pessoa, gerenciar todos os canais, emojis e sons desta
        comunidade e remover membros. Só o dono dá e tira esse cargo.
      </p>
      {roleError && <p className="form-error">{roleError}</p>}
      <div className="expression-list">
        {members.map((member) => (
          <div key={member.id} className="expression-row">
            <Avatar name={member.username} userId={member.id} size={32} />
            <span className="expression-name">{member.username}</span>
            <RoleBadge role={member.role} />
            {member.id === user.id && <span className="expression-author">você</span>}
            {isOwner && member.role !== 'owner' && (
              <button
                className="icon-plain expression-play"
                title={member.role === 'admin' ? `Tirar o cargo de administrador de ${member.username}` : `Tornar ${member.username} administrador`}
                aria-label={member.role === 'admin' ? `Tirar o cargo de administrador de ${member.username}` : `Tornar ${member.username} administrador`}
                onClick={() => toggleAdmin(member)}
              >
                {member.role === 'admin' ? <ShieldOff size={16} /> : <ShieldPlus size={16} />}
              </button>
            )}
            {canRemove(member) && (
              <button className="icon-plain expression-delete" title={`Remover ${member.username}`} aria-label={`Remover ${member.username}`} onClick={() => setRemoving(member)}>
                <UserX size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {removing && (
        <ConfirmDialog
          title="Remover membro"
          confirmLabel="Remover"
          busy={busy}
          error={error}
          onConfirm={confirmRemove}
          onCancel={() => {
            setRemoving(null);
            setError(null);
          }}
        >
          Remover <strong>{removing.username}</strong> de {community.name}? A pessoa perde o acesso aos canais e sai de
          qualquer chamada na hora. A conta dela no Syden continua existindo. Para ela não voltar com o mesmo convite,
          troque o código em "Comunidade".
        </ConfirmDialog>
      )}
    </>
  );
}

function AvatarEditor({ user }: { user: User }) {
  const { members } = useDirectory();
  const hasAvatar = (members.get(user.id)?.avatarVersion ?? null) !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const image = await prepareImage(file, { size: 256, fit: 'cover', maxBytes: 2048 * KB });
      await api('/api/me/avatar', { method: 'PUT', body: { image } });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    await api('/api/me/avatar', { method: 'DELETE' }).catch((e) => setError((e as Error).message));
    setBusy(false);
  }

  return (
    <>
      <div className="settings-card account-card">
        <Avatar name={user.username} userId={user.id} size={80} />
        <div className="account-info">
          <div className="account-name">{user.username}</div>
          
        </div>
        <div className="account-actions">
          <FilePicker accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onFile={upload}>
            {busy ? 'Enviando…' : hasAvatar ? 'Trocar avatar' : 'Enviar avatar'}
          </FilePicker>
          {hasAvatar && (
            <button className="link-button" onClick={remove} disabled={busy}>
              Remover
            </button>
          )}
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : <p className="settings-hint">PNG, JPG ou WEBP. GIF animado também vale (até 2 MB).</p>}
    </>
  );
}

/** Botão que abre o seletor de arquivos do sistema. */
function FilePicker({
  accept,
  disabled,
  onFile,
  onFiles,
  secondary,
  children,
}: {
  accept: string;
  disabled?: boolean;
  onFile?: (file: File) => void;
  /** Com esta opção, permite escolher vários arquivos de uma vez. */
  onFiles?: (files: File[]) => void;
  secondary?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`${secondary ? 'btn-secondary' : 'btn-primary'} file-picker${disabled ? ' disabled' : ''}`}>
      {children}
      <input
        type="file"
        accept={accept}
        multiple={!!onFiles}
        disabled={disabled}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ''; // permite escolher os mesmos arquivos de novo
          if (files.length === 0) return;
          if (onFiles) onFiles(files);
          else onFile?.(files[0]);
        }}
      />
    </label>
  );
}

// ---------- Emojis do servidor ----------

function EmojisSection({ user, community }: { user: User; community: Community }) {
  const { emojis, members } = useDirectory();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function choose(chosen: File) {
    setMessage(null);
    try {
      setPreview(await prepareImage(chosen, { size: 128, fit: 'contain', maxBytes: 512 * KB }));
      setFile(chosen);
      setName(emojiNameFromFile(chosen.name));
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!preview) return;
    setBusy(true);
    try {
      const created = await api<Emoji>(`/api/communities/${community.id}/emojis`, { method: 'POST', body: { name, image: preview } });
      setMessage({ ok: true, text: `Pronto! Use :${created.name}: nas mensagens.` });
      setFile(null);
      setPreview(null);
      setName('');
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <>
      <h2>Emojis do servidor</h2>
      <p className="settings-lead">
        Todo mundo do servidor pode usar estes emojis escrevendo <code>:nome:</code> ou pelo botão de emoji do chat. Sem
        assinatura: está tudo liberado.
      </p>

      <form className="settings-card upload-card" onSubmit={submit}>
        <div className="upload-preview">{preview ? <img src={preview} alt="" /> : <Smile size={28} />}</div>
        <div className="upload-fields">
          <FilePicker accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onFile={choose}>
            {file ? 'Trocar imagem' : 'Escolher imagem'}
          </FilePicker>
          <label className="settings-field">
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: gato_feliz" maxLength={32} />
          </label>
          <button className="btn-primary" disabled={!preview || !name || busy}>
            {busy ? 'Enviando…' : 'Adicionar emoji'}
          </button>
        </div>
      </form>
      {message ? (
        <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>
      ) : (
        <p className="settings-hint">PNG, JPG, WEBP ou GIF animado, até 512 KB. A imagem é ajustada para 128×128.</p>
      )}

      <h3>{emojis.length} emojis</h3>
      <div className="expression-list">
        {emojis.map((emoji) => (
          <div key={emoji.id} className="expression-row">
            <img className="expression-emoji" src={mediaUrl.emoji(emoji.id)} alt="" />
            <span className="expression-name">:{emoji.name}:</span>
            <span className="expression-author">{authorLabel(emoji.createdBy, members)}</span>
            {(user.isAdmin || emoji.createdBy === user.id) && (
              <DeleteButton label={`Excluir :${emoji.name}:`} path={`/api/emojis/${emoji.id}`} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Soundboard do servidor ----------

function SoundboardSection({ user, community }: { user: User; community: Community }) {
  const { sounds, members } = useDirectory();
  const settings = useSettings();
  const [audio, setAudio] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🔊');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function choose(file: File) {
    setMessage(null);
    try {
      setAudio(await prepareSound(file, 1024 * KB));
      setFileName(file.name);
      if (!name) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 32));
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!audio) return;
    setBusy(true);
    try {
      await api<Sound>(`/api/communities/${community.id}/sounds`, { method: 'POST', body: { name, icon, audio } });
      setMessage({ ok: true, text: `"${name}" já está no soundboard.` });
      setAudio(null);
      setFileName('');
      setName('');
      setIcon('🔊');
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <>
      <h2>Soundboard do servidor</h2>
      <p className="settings-lead">
        Durante uma chamada, o botão <AudioLines size={14} /> toca estes sons para todos na sala. Sem assinatura: está
        tudo liberado.
      </p>

      <label className="settings-field volume-field">
        Volume do soundboard (só para você): {Math.round(settings.soundboardVolume * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.soundboardVolume}
          onChange={(e) => updateSettings({ soundboardVolume: Number(e.target.value) })}
        />
      </label>

      <h3>Adicionar vários de uma vez</h3>
      <BulkSoundUpload community={community} />

      <h3>Adicionar um som</h3>
      <form className="settings-card upload-card" onSubmit={submit}>
        <div className="upload-preview upload-icon">{icon || '🔊'}</div>
        <div className="upload-fields">
          <FilePicker accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp3,.ogg,.wav" disabled={busy} onFile={choose}>
            {fileName ? 'Trocar áudio' : 'Escolher áudio'}
          </FilePicker>
          {fileName && <span className="settings-hint">{fileName}</span>}
          <div className="upload-row">
            <label className="settings-field icon-field">
              Ícone
              <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
            </label>
            <label className="settings-field">
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Risada" maxLength={32} />
            </label>
          </div>
          <button className="btn-primary" disabled={!audio || !name.trim() || busy}>
            {busy ? 'Enviando…' : 'Adicionar som'}
          </button>
        </div>
      </form>
      {message ? (
        <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>
      ) : (
        <p className="settings-hint">MP3, OGG ou WAV, até {MAX_SOUND_SECONDS} segundos e 1 MB.</p>
      )}

      <h3>{sounds.length} sons</h3>
      <div className="expression-list">
        {sounds.map((sound) => (
          <div key={sound.id} className="expression-row">
            <span className="expression-icon">{sound.icon}</span>
            <span className="expression-name">{sound.name}</span>
            <span className="expression-author">{authorLabel(sound.createdBy, members)}</span>
            <button className="icon-plain expression-play" title="Ouvir" aria-label={`Ouvir ${sound.name}`} onClick={() => playSoundboard(sound.id)}>
              <Play size={16} />
            </button>
            {(user.isAdmin || sound.createdBy === user.id) && (
              <DeleteButton label={`Excluir ${sound.name}`} path={`/api/sounds/${sound.id}`} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Envia vários sons de uma vez. O nome vem do nome do arquivo, e um emoji no começo do nome vira o ícone:
 * "🤡 Errou.mp3" → som "Errou" com ícone 🤡.
 */
function BulkSoundUpload({ community }: { community: Community }) {
  const [results, setResults] = useState<{ file: string; ok: boolean; text: string }[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadAll(files: File[]) {
    setResults([]);
    setProgress({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      const { name, icon } = soundNameFromFile(file.name);
      try {
        const audio = await prepareSound(file, 1024 * KB);
        await api<Sound>(`/api/communities/${community.id}/sounds`, { method: 'POST', body: { name, icon, audio } });
        setResults((list) => [...list, { file: file.name, ok: true, text: `${icon} ${name}` }]);
      } catch (e) {
        setResults((list) => [...list, { file: file.name, ok: false, text: (e as Error).message }]);
      }
      setProgress({ done: index + 1, total: files.length });
    }
  }

  const busy = progress !== null && progress.done < progress.total;
  const failed = results.filter((r) => !r.ok);

  return (
    <div className="settings-card bulk-upload">
      <p className="settings-hint bulk-hint">
        Selecione vários arquivos de áudio. O nome do arquivo vira o nome do som, e um emoji no começo vira o ícone: por
        exemplo, <code>🤡 Errou.mp3</code>.
      </p>
      <FilePicker accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp3,.ogg,.wav" disabled={busy} onFiles={uploadAll}>
        {busy ? `Enviando ${progress.done + 1} de ${progress.total}…` : 'Escolher arquivos'}
      </FilePicker>
      {progress && !busy && (
        <p className={failed.length ? 'form-error' : 'form-success'}>
          {progress.total - failed.length} de {progress.total} sons adicionados.
          {failed.length > 0 && ' Os que não entraram:'}
        </p>
      )}
      {failed.length > 0 && (
        <ul className="bulk-errors">
          {failed.map((r) => (
            <li key={r.file}>
              <strong>{r.file}</strong>: {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic}|️)*)\s*/u;

function soundNameFromFile(fileName: string) {
  let base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  let icon = '🔊';
  const match = LEADING_EMOJI_RE.exec(base);
  if (match) {
    icon = match[1];
    base = base.slice(match[0].length);
  }
  return { name: (base || 'Som').slice(0, 32).trim(), icon };
}

function authorLabel(createdBy: number | null, members: Map<number, { username: string }>) {
  if (createdBy === null) return 'Pacote do Syden';
  return `por ${members.get(createdBy)?.username ?? 'alguém'}`;
}

function DeleteButton({ label, path }: { label: string; path: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="icon-plain expression-delete"
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api(path, { method: 'DELETE' }).catch((e) => alert((e as Error).message));
        setBusy(false);
      }}
    >
      <Trash2 size={16} />
    </button>
  );
}

// ---------- Voz e vídeo ----------

const canChooseOutput = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

function useDevices(kind: MediaDeviceKind) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const load = () =>
      Room.getLocalDevices(kind, false)
        .then((list) => setDevices(list.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')))
        .catch(() => setDevices([]));
    load();
    navigator.mediaDevices?.addEventListener('devicechange', load);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', load);
  }, [kind, version]);

  // Sem permissão, o navegador esconde os nomes dos dispositivos.
  const needsPermission = devices.length > 0 && devices.every((d) => !d.label);
  const requestPermission = () => Room.getLocalDevices(kind, true).finally(() => setVersion((v) => v + 1));
  return { devices, needsPermission, requestPermission };
}

function DeviceSelect({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: MediaDeviceKind;
  value: string;
  onChange: (deviceId: string) => void;
}) {
  const { devices, needsPermission, requestPermission } = useDevices(kind);
  return (
    <label className="settings-field">
      {label}
      {needsPermission ? (
        <button type="button" className="btn-secondary" onClick={() => void requestPermission()}>
          Permitir acesso para ver os dispositivos
        </button>
      ) : (
        <select value={devices.some((d) => d.deviceId === value) ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Padrão do sistema</option>
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Dispositivo ${i + 1}`}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function VoiceSection({ voice }: { voice: Voice }) {
  const settings = useSettings();

  return (
    <>
      <h2>Voz e vídeo</h2>

      <div className="settings-grid">
        <DeviceSelect
          label="Microfone"
          kind="audioinput"
          value={settings.audioInput}
          onChange={(id) => void voice.switchDevice('audioinput', id)}
        />
        {canChooseOutput && (
          <DeviceSelect
            label="Alto-falante ou fone"
            kind="audiooutput"
            value={settings.audioOutput}
            onChange={(id) => void voice.switchDevice('audiooutput', id)}
          />
        )}
      </div>

      <MicTest deviceId={settings.audioInput} />

      {desktopBridge && (
        <>
          <h3>Teclas de atalho</h3>
          <p className="settings-hint shortcuts">
            Funcionam mesmo com o Syden minimizado, durante uma chamada: <kbd>{SHORTCUT_LABELS.mute}</kbd> silencia ou
            ativa o microfone, e <kbd>{SHORTCUT_LABELS.deafen}</kbd> ensurdece ou volta a ouvir.
          </p>
        </>
      )}

      <h3>Processamento de voz</h3>
      <Toggle
        label="Supressão de ruído"
        description="Reduz barulhos de fundo, como teclado, ventilador e trânsito."
        checked={settings.noiseSuppression}
        onChange={(value) => void voice.setAudioProcessing({ noiseSuppression: value })}
      />
      <Toggle
        label="Cancelamento de eco"
        description="Evita que os outros ouçam a própria voz de volta quando você usa caixa de som."
        checked={settings.echoCancellation}
        onChange={(value) => void voice.setAudioProcessing({ echoCancellation: value })}
      />

      <h3>Vídeo</h3>
      <DeviceSelect
        label="Câmera"
        kind="videoinput"
        value={settings.videoInput}
        onChange={(id) => void voice.switchDevice('videoinput', id)}
      />

      <h3>Qualidade do compartilhamento de tela</h3>
      <p className="settings-hint">Vale a partir do próximo compartilhamento.</p>
      <div className="quality-options" role="radiogroup">
        {(
          [
            ['light', 'Leve', '720p · 30 fps', 'Para internet mais fraca.'],
            ['standard', 'Padrão', '1080p · 30 fps', 'Recomendado para a maioria.'],
            ['smooth', 'Fluido', '1080p · 60 fps', 'Para jogos. Usa mais internet.'],
          ] as [ScreenQuality, string, string, string][]
        ).map(([id, title, spec, hint]) => (
          <label key={id} className={`quality-option${settings.screenQuality === id ? ' selected' : ''}`}>
            <input
              type="radio"
              name="screen-quality"
              checked={settings.screenQuality === id}
              onChange={() => updateSettings({ screenQuality: id })}
            />
            <span className="quality-title">{title}</span>
            <span className="quality-spec">{spec}</span>
            <span className="quality-hint">{hint}</span>
          </label>
        ))}
      </div>
    </>
  );
}

/** Mostra o nível do microfone em tempo real, sem transmitir nada. */
function MicTest({ deviceId }: { deviceId: string }) {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const settings = useSettings();

  useEffect(() => {
    if (!testing) return;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame = 0;
    let stopped = false;

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: deviceId || undefined,
          noiseSuppression: settings.noiseSuppression,
          echoCancellation: settings.echoCancellation,
        },
      })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        context = new AudioContext();
        void context.resume(); // pode nascer pausado pela política de reprodução automática
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(s).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
          // Escala aproximada em dB: -60 dB (silêncio) a 0 dB (máximo).
          const level = Math.min(1, Math.max(0, (20 * Math.log10(rms || 1e-6) + 60) / 60));
          if (barRef.current) barRef.current.style.width = `${level * 100}%`;
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        setError('Sem acesso ao microfone. Libere a permissão e tente de novo.');
        setTesting(false);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      void context?.close();
    };
  }, [testing, deviceId, settings.noiseSuppression, settings.echoCancellation]);

  return (
    <div className="mic-test">
      <div className="mic-test-row">
        <button
          type="button"
          className={testing ? 'btn-secondary' : 'btn-primary'}
          onClick={() => {
            setError(null);
            setTesting(!testing);
          }}
        >
          {testing ? 'Parar teste' : 'Testar microfone'}
        </button>
        <div className="mic-meter" aria-hidden="true">
          <span ref={barRef} />
        </div>
      </div>
      <p className="settings-hint">
        {error ?? (testing ? 'Fale algo: a barra deve se mexer com a sua voz.' : 'Veja se o microfone está captando a sua voz.')}
      </p>
    </div>
  );
}

// ---------- Sons ----------

function SoundsSection() {
  const settings = useSettings();
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState(supported ? Notification.permission : 'denied');

  async function toggleNotifications(value: boolean) {
    updateSettings({ notifications: value });
    // No navegador é preciso pedir permissão; no app de desktop ela já vem liberada.
    if (value && supported && Notification.permission === 'default') setPermission(await Notification.requestPermission());
  }

  return (
    <>
      <h2>Notificações</h2>
      <Toggle
        label="Notificações na área de trabalho"
        description="Avisa das mensagens novas quando o Syden está minimizado, em segundo plano ou em outro canal."
        checked={settings.notifications && permission !== 'denied'}
        onChange={(value) => void toggleNotifications(value)}
      />
      {permission === 'denied' && (
        <p className="settings-hint">
          O navegador bloqueou as notificações deste site. Libere no cadeado ao lado do endereço e recarregue a página.
        </p>
      )}
      <Toggle
        label="Sons de aviso"
        description="Toca um som quando alguém entra ou sai da sua sala, quando alguém começa a compartilhar a tela e quando você silencia ou ensurdece."
        checked={settings.sounds}
        onChange={(value) => {
          updateSettings({ sounds: value });
          if (value) sounds.selfJoin();
        }}
      />
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        <span className="toggle-description">{description}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
