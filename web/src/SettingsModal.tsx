import { Room } from 'livekit-client';
import { Accessibility, Languages,
  AudioLines,
  Bell,
  Check,
  CircleUser,
  ClipboardPaste,
  Hash,
  LogOut,
  Mic,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  ShieldOff,
  ShieldPlus,
  Smile,
  Sparkles,
  Trash2,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatedIcon } from './AnimatedIcon';
import { Aparencia } from './Aparencia';
import { EscolherSelo } from './EscolherSelo';
import { PessoasBloqueadas } from './PessoasBloqueadas';
import { AjusteDasBarras } from './AjusteDasBarras';
import { EditorDeBoasVindas } from './EditorDeBoasVindas';
import { type EscolhaDeCodec, escolherCodecDaTela } from './escolherCodec';
import { algarismos } from './algarismos';
import { isolar } from './bidi';
import { chave, t, useT } from './i18n';
import { MOLDURAS } from './loja';
import { IdiomaSection } from './IdiomaSection';
import { api, mediaUrl, saveToken } from './api';
import { Insignia } from './Medalha';
import { acharInsignia } from './insignias';
import { type ScreenQuality, updateSettings, useSettings } from './settings';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { SHORTCUT_LABELS, desktopBridge } from './desktop';
import { useDirectory } from './directory';
import { CapaDaComunidade } from './CapaDaComunidade';
import { CommunityIcon } from './CommunityIcon';
import { PainelDoSelo } from './PainelDoSelo';
import { LixeiraDeCanais } from './LixeiraDeCanais';
import { ImageCropper } from './ImageCropper';
import { playSoundboard } from './soundboard';
import { sounds } from './sounds';
import type { Community, CommunityMember, Emoji, Role, Sound, User } from './types';
import { MAX_SOUND_SECONDS, emojiNameFromFile, imageFromClipboard, imageFromClipboardEvent, prepareBanner, prepareImage, prepareSound } from './upload';
import { SCREEN_PRESETS, type Voice } from './useVoice';
import { EmojiPackCatalog } from './EmojiPackCatalog';
import { PackCatalog } from './PackCatalog';
import { classeDoFundo, CORES_DE_NOME, corDoNome, FUNDOS } from './profileStyles';
import { EntradasLigadas } from './EntradasLigadas';
import { EFFECT_ICONS } from './VoiceEffectButton';
import { VOICE_EFFECTS, connectVoiceEffect } from './voiceEffects';

export type SettingsSection = Section;

type Section = 'account' | 'aparencia' | 'voice' | 'sounds' | 'acessibilidade' | 'idioma' | 'community' | 'members' | 'emojis' | 'soundboard';

// Os desenhos animados ficam aqui, nos menus: são poucos, aparecem um de cada vez e reagem ao passar
// o mouse, que é onde esse tipo de ícone rende sem competir com os botões da chamada.
const USER_SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'account', label: chave('Minha conta'), icon: <AnimatedIcon name="avatar" size={20} /> },
  // APARÊNCIA FICA LOGO DEPOIS DA CONTA, e é o que sobrou da junção da Loja com os enfeites de
  // perfil: cor do nome, fundo, moldura e insígnias se escolhiam em dois lugares diferentes, e a
  // moldura só num deles. Ver web/src/Aparencia.tsx.
  { id: 'aparencia', label: chave('Aparência'), icon: <Sparkles size={20} /> },
  { id: 'voice', label: chave('Voz e vídeo'), icon: <AnimatedIcon name="microfone" size={20} /> },
  // O despertador sacode forte demais no ritmo original; num menu, meia velocidade basta para dar vida.
  { id: 'sounds', label: chave('Notificações'), icon: <AnimatedIcon name="alarme" size={20} speed={0.5} /> },
  { id: 'acessibilidade', label: chave('Acessibilidade'), icon: <Accessibility size={20} /> },
  { id: 'idioma', label: chave('Idioma'), icon: <Languages size={20} /> },
];

const COMMUNITY_SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  // Comunidade e Membros seguem com os ícones de traço: o desenho de videochamada é colorido demais para
  // o menu, e o de pessoa não aparece direito parado.
  { id: 'community', label: chave('Comunidade'), icon: <Hash size={18} /> },
  { id: 'members', label: chave('Membros'), icon: <Users size={18} /> },
  { id: 'emojis', label: chave('Emojis'), icon: <AnimatedIcon name="emoji" size={20} /> },
  { id: 'soundboard', label: chave('Soundboard'), icon: <AnimatedIcon name="musica" size={20} /> },
];

const KB = 1024;

/** Quem administra a comunidade aberta (dono ou administrador) mexe em tudo o que é dela. */
const manages = (community: Community) => community.role === 'owner' || community.role === 'admin';

export function SettingsModal({
  secaoInicial = 'account',
  user,
  community,
  voice,
  onClose,
  onLogout,
  onCommunityChanged,
}: {
  /** Em que aba a janela abre: a vila manda direto para os pacotes de sons. */
  secaoInicial?: Section;
  user: User;
  community: Community | undefined;
  voice: Voice;
  onClose: () => void;
  onLogout: () => void;
  onCommunityChanged: () => void;
}) {
  const t = useT();
  const [section, setSection] = useState<Section>(secaoInicial);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="settings" role="dialog" aria-modal="true" aria-label={t('Configurações')}>
      <nav className="settings-nav">
        <div className="settings-nav-inner">
          <h4>{t('Configurações do usuário')}</h4>
          {USER_SECTIONS.map((s) => (
            <button key={s.id} className={`settings-tab${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
              {s.icon} {t(s.label)}
            </button>
          ))}
          {community && (
            <>
              <hr />
              <h4 title={community.name}>{community.name}</h4>
              {COMMUNITY_SECTIONS.map((s) => (
                <button key={s.id} className={`settings-tab${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
                  {s.icon} {t(s.label)}
                </button>
              ))}
            </>
          )}
          <hr />
          <button className="settings-tab danger" onClick={onLogout}>
            <LogOut size={18} /> {t('Sair da conta')}
          </button>
        </div>
      </nav>

      <main className="settings-content">
        <div className="settings-content-inner">
          {section === 'account' && (
            <>
              <AccountSection user={user} onDeleted={onLogout} />
              {/* O selo e os bloqueios são escolhas da PESSOA, não da comunidade: por isso moram na
                  aba da conta, junto com o resto do que só diz respeito a ela. */}
              <EscolherSelo />
              <PessoasBloqueadas />
            </>
          )}
          {section === 'aparencia' && <Aparencia user={user} aoAbrirPacotes={() => setSection('soundboard')} />}
          {section === 'voice' && <VoiceSection voice={voice} />}
          {section === 'sounds' && <SoundsSection />}
          {section === 'acessibilidade' && <AcessibilidadeSection />}
          {section === 'idioma' && <IdiomaSection />}
          {community && section === 'community' && (
            <>
              <CommunitySection
                community={community}
                onChanged={onCommunityChanged}
                onLeft={() => {
                  onCommunityChanged();
                  onClose();
                }}
              />
              {/* Depois do nome e do ícone: o selo é a identidade que a comunidade CONQUISTOU, e
                  faz sentido lê-la logo abaixo da que ela simplesmente escolheu. */}
              <PainelDoSelo communityId={community.id} />
              {/* A lixeira vem por último de propósito: ninguém abre esta aba para ver o que apagou, e
                  sim para mexer no nome, no ícone ou no selo. Ela fica onde quem PROCURA por ela
                  encontra — e o diálogo de excluir canal diz o caminho até aqui. */}
              <LixeiraDeCanais communityId={community.id} />
            </>
          )}
          {community && section === 'members' && <MembersSection user={user} community={community} />}
          {community && section === 'emojis' && <EmojisSection user={user} community={community} />}
          {community && section === 'soundboard' && <SoundboardSection user={user} community={community} />}
        </div>
        <button className="settings-close" onClick={onClose} aria-label={t('Fechar configurações')}>
          <span className="settings-close-circle">
            <X size={18} />
          </span>
          {t('ESC')}
        </button>
      </main>
    </div>
  );
}

/**
 * O e-mail da conta. É opcional, e a tela diz para que serve: sem ele, quem esquece a senha perde a conta,
 * porque não há para onde mandar o link. Trocar o endereço pede a senha, já que ele é a chave da
 * recuperação — com o computador destravado, trocar o e-mail seria tomar a conta.
 */
function EmailDaConta() {
  const t = useT();
  const [atual, setAtual] = useState<{ email: string | null; verifiedAt: string | null; envioLigado: boolean } | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void api<{ email: string | null; verifiedAt: string | null; envioLigado: boolean }>('/api/me/email')
      .then((dados) => {
        setAtual(dados);
        setEmail(dados.email ?? '');
      })
      .catch(() => {});
  }, []);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setRecado(null);
    try {
      const r = await api<{ email: string; rascunho: boolean }>('/api/me/email', {
        method: 'PUT',
        body: { email, password: senha },
      });
      setSenha('');
      setAtual({ email: r.email, verifiedAt: null, envioLigado: atual?.envioLigado ?? false });
      setRecado({
        ok: true,
        texto: r.rascunho
          ? t('Endereço guardado. O envio de e-mail ainda não está ligado neste servidor, então o link de confirmação ficou no registro do servidor.')
          : t('Endereço guardado. Confira a sua caixa de entrada para confirmar.'),
      });
    } catch (e) {
      setRecado({ ok: false, texto: (e as Error).message });
    }
    setOcupado(false);
  }

  if (!atual) return null;

  return (
    <>
      <h3>{t('E-mail')}</h3>
      <p className="settings-hint">
        {t('Serve para recuperar a senha e para avisar você se algo acontecer com o Syden. Sem e-mail, uma senha esquecida não tem volta.')}
      </p>
      {atual.email && (
        <p className={atual.verifiedAt ? 'form-success' : 'settings-hint'}>
          {atual.verifiedAt
            ? t('{email} — confirmado', { email: isolar(atual.email) })
            : t('{email} — ainda não confirmado', { email: isolar(atual.email) })}
        </p>
      )}
      <form className="settings-form" onSubmit={salvar}>
        <label>
          {t('Endereço')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          {t('Sua senha, para confirmar que é você')}
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        {recado && <p className={recado.ok ? 'form-success' : 'form-error'}>{recado.texto}</p>}
        <button className="btn-primary" disabled={ocupado}>
          {ocupado ? t('Salvando…') : atual.email ? t('Trocar o e-mail') : t('Salvar o e-mail')}
        </button>
      </form>
    </>
  );
}

/**
 * As insígnias que a pessoa tem, e a escolha de quais exibir no perfil. A escolha é dela: pode mostrar
 * todas, uma só ou nenhuma. A ordem dos cliques é a ordem em que elas aparecem no perfil.
 */
function MinhasInsignias() {
  const t = useT();
  const [itens, setItens] = useState<string[] | null>(null);
  const [vitrine, setVitrine] = useState<string[]>([]);
  const [limite, setLimite] = useState(5);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void api<{ itens: { code: string }[]; vitrine: string[]; limite: number }>('/api/me/itens')
      .then((resposta) => {
        setItens(resposta.itens.map((i) => i.code));
        setVitrine(resposta.vitrine ?? []);
        setLimite(resposta.limite);
      })
      .catch(() => setItens([]));
  }, []);

  function alternar(codigo: string) {
    const nova = vitrine.includes(codigo) ? vitrine.filter((c) => c !== codigo) : [...vitrine, codigo];
    if (nova.length > limite) return setErro(`Dá para exibir no máximo ${limite} insígnias ao mesmo tempo.`);
    setErro(null);
    setVitrine(nova); // a tela responde na hora; se o servidor recusar, a mensagem aparece embaixo
    void api('/api/me/vitrine', { method: 'PUT', body: { codigos: nova } }).catch((e) => setErro((e as Error).message));
  }

  if (itens === null) return null;

  return (
    <>
      <h3>{t('Minhas insígnias')}</h3>
      {itens.length === 0 ? (
        <p className="settings-hint">
          {t('Você ainda não tem nenhuma. Elas chegam como presente ou como recompensa — por exemplo, quando uma ideia sua entra no Syden.')}
        </p>
      ) : (
        <>
          <p className="settings-hint">{t('Clique para escolher quais aparecem no seu perfil (até {limite}).', { limite })}</p>
          <div className="insignias-grade">
            {itens.map((codigo) => {
              const insignia = acharInsignia(codigo);
              if (!insignia) return null;
              const exibindo = vitrine.includes(codigo);
              return (
                <button
                  key={codigo}
                  type="button"
                  className={`insignia-escolha${exibindo ? ' exibindo' : ''}`}
                  onClick={() => alternar(codigo)}
                  aria-pressed={exibindo}
                >
                  <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={40} />
                  <span>
                    <strong>{insignia.nome}</strong>
                    <small>{exibindo ? t('Aparecendo no perfil') : insignia.descricao}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}

/**
 * "Sair dos outros aparelhos". Serve para o dia em que alguém esquece o Syden aberto no computador de
 * outra pessoa, ou perde o celular: sem isto, a sessão de lá continuaria valendo por 30 dias e não
 * haveria nada a fazer a respeito.
 */
function OutrosAparelhos() {
  const t = useT();
  const [feito, setFeito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function sair() {
    setOcupado(true);
    setErro(null);
    try {
      const { token } = await api<{ token: string }>('/api/me/sessions/revoke', { method: 'POST' });
      saveToken(token); // esta janela continua logada, com a sessão nova
      setFeito(true);
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return (
    <>
      <h3>{t('Outros aparelhos')}</h3>
      <p className="settings-hint">
        {t('Desconecta o Syden em todos os outros computadores e celulares. Você continua conectado aqui.')}
      </p>
      {feito ? (
        <p className="form-success">{t('Pronto: só este aparelho continua conectado.')}</p>
      ) : (
        <button type="button" className="btn-secondary" onClick={sair} disabled={ocupado}>
          {ocupado ? t('Desconectando…') : t('Sair dos outros aparelhos')}
        </button>
      )}
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}

// ---------- Minha conta ----------

function AccountSection({ user, onDeleted }: { user: User; onDeleted: () => void }) {
  const t = useT();
  // Conta criada pelo Google/GitHub não tem senha nenhuma. Isso muda dois formulários desta tela: o
  // de senha (que passa a DEFINIR a primeira, sem pedir a atual) e o de excluir (que confirma pelo
  // nome, porque não há senha para digitar).
  const [temSenha, setTemSenha] = useState<boolean | null>(null);

  useEffect(() => {
    void api<{ temSenha: boolean }>('/api/me/social')
      .then((r) => setTemSenha(r.temSenha))
      // Servidor antigo, sem essa rota: segue como sempre foi, pedindo a senha atual.
      .catch(() => setTemSenha(true));
  }, []);

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
      // O servidor devolve um token novo porque trocar a senha derruba as sessões antigas — inclusive a
      // desta janela, se não guardarmos o novo aqui na hora.
      const { token } = await api<{ token: string }>('/api/me/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      saveToken(token);
      setTemSenha(true);
      setMessage({
        ok: true,
        text: temSenha === false ? t('Senha definida. Agora dá para entrar com nome e senha também.') : t('Senha alterada. Os outros aparelhos foram desconectados.'),
      });
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
      <h2>{t('Minha conta')}</h2>
      <AvatarEditor user={user} />

      <h3>{temSenha === false ? t('Definir uma senha') : t('Trocar senha')}</h3>
      <form className="settings-form" onSubmit={submit}>
        {temSenha === false ? (
          <p className="settings-hint">
            {t('Você entrou por um serviço de fora e ainda não tem senha nesta conta. Defina uma aqui: passa a valer como segundo jeito de entrar, e é o que permite desligar aquele serviço depois.')}
          </p>
        ) : (
          <label>
            {t('Senha atual')}
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </label>
        )}
        <label>
          {t('Nova senha')}
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        <label>
          {t('Confirmar nova senha')}
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? t('Salvando…') : temSenha === false ? t('Definir a minha senha') : t('Salvar nova senha')}
        </button>
      </form>

      <EmailDaConta />

      <EntradasLigadas />

      <MinhasInsignias />

      <OutrosAparelhos />

      <DeleteAccount onDeleted={onDeleted} temSenha={temSenha !== false} username={user.username} />

      {/* Com a barra na frente: estas páginas moram na raiz do site, e o Syden mora em /app/. Sem ela
          o navegador procurava /app/privacidade.html, que não existe — ver AuthScreen.tsx. */}
      <p className="settings-legal">
        <a href="/privacidade.html" target="_blank" rel="noreferrer">
          {t('Política de privacidade')}
        </a>
        {' · '}
        <a href="/termos.html" target="_blank" rel="noreferrer">
          {t('Termos de uso')}
        </a>
      </p>
    </>
  );
}

/**
 * Excluir a conta, com uma confirmação deliberada.
 *
 * Quem entrou pelo Google/GitHub **não tem senha para digitar**, e confirma escrevendo o próprio nome
 * — o mesmo caminho que o GitHub usa para apagar repositório. Sem isto, uma conta criada por engano no
 * caminho social ficava impossível de apagar.
 */
function DeleteAccount({ onDeleted, temSenha, username }: { onDeleted: () => void; temSenha: boolean; username: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/me/delete', { method: 'POST', body: { password, confirmacao } });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <h3>{t('Excluir conta')}</h3>
      <div className="settings-card danger-zone">
        <p>
          {t('Apaga a sua conta, as suas mensagens e o seu avatar. Os canais, emojis e sons que você criou continuam no servidor para os outros.')}{' '}
          <strong>{t('Não dá para desfazer.')}</strong>
        </p>
        {open ? (
          <form className="settings-form" onSubmit={submit}>
            {temSenha ? (
              <label>
                {t('Digite sua senha para confirmar')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </label>
            ) : (
              <label>
                {t('Escreva')} <strong>{username}</strong> para confirmar
                <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" autoFocus required />
              </label>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="danger-actions">
              <button type="button" className="link-button" onClick={() => setOpen(false)}>
                {t('Cancelar')}
              </button>
              <button className="btn-danger" disabled={busy || (temSenha ? !password : confirmacao.trim().toLowerCase() !== username.toLowerCase())}>
                {busy ? t('Excluindo…') : t('Excluir minha conta para sempre')}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn-danger" onClick={() => setOpen(true)}>
            {t('Excluir minha conta')}
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
  const t = useT();
  const [name, setName] = useState(community.name);
  const [invite, setInvite] = useState(community.inviteCode);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = community.role === 'owner';
  const canManage = isOwner || community.role === 'admin';

  async function rename(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/communities/${community.id}`, { method: 'PATCH', body: { name } });
      setMessage({ ok: true, text: t('Nome alterado.') });
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
      setMessage({ ok: true, text: t('Código novo criado. O anterior parou de funcionar.') });
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
      <h2>{t('Comunidade')}</h2>
      <p className="settings-lead">
        {community.memberCount === 1
          ? t('1 pessoa participa de {comunidade}.', { comunidade: isolar(community.name) })
          : t('{quantas} pessoas participam de {comunidade}.', {
              quantas: algarismos(community.memberCount),
              comunidade: isolar(community.name),
            })}
      </p>

      {canManage && (
        <>
          <EditorDeBoasVindas community={community} />
          <h3>{t('Imagem')}</h3>
          <CommunityIconEditor community={community} onChanged={onChanged} />
          <CommunityBannerEditor community={community} onChanged={onChanged} />
          <h3>{t('Convite')}</h3>
          <div className="settings-card">
            <p className="settings-hint">
              {t('Quem tiver este código entra na comunidade: pela tela de cadastro, se ainda não tem conta, ou pelo botão de entrar, se já usa o Syden.')}
            </p>
            <div className="invite-row">
              <code className="invite-code">{invite}</code>
              <button
                className="btn-secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(invite ?? '');
                  setMessage({ ok: true, text: t('Código copiado.') });
                }}
              >
                {t('Copiar')}
              </button>
              <button className="link-button" onClick={newInvite} disabled={busy}>
                {t('Gerar outro')}
              </button>
            </div>
          </div>

          <h3>{t('Nome')}</h3>
          <form className="settings-form" onSubmit={rename}>
            <label>
              {t('Nome da comunidade')}
              <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
            </label>
            <button className="btn-primary" disabled={busy || name === community.name}>
              {t('Salvar nome')}
            </button>
          </form>
        </>
      )}
      {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}

      <h3>{isOwner ? t('Apagar comunidade') : t('Sair da comunidade')}</h3>
      <div className="settings-card danger-zone">
        <p>
          {isOwner
            ? t('Apaga a comunidade para todo mundo, com os canais, as mensagens, os emojis e os sons dela. Não dá para desfazer.')
            : t('Você perde o acesso aos canais desta comunidade. Para voltar, vai precisar de um convite novo.')}
        </p>
        <div className="danger-actions">
          <button className="btn-danger" onClick={() => setConfirming(isOwner ? 'delete' : 'leave')}>
            {isOwner ? t('Apagar comunidade') : t('Sair da comunidade')}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'delete' ? t('Apagar comunidade') : t('Sair da comunidade')}
          confirmLabel={confirming === 'delete' ? t('Apagar') : t('Sair')}
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
              {t('Apagar {comunidade} para todos os {quantos} membros? Os canais, as mensagens, os emojis e os sons somem junto.', {
                comunidade: isolar(community.name),
                quantos: algarismos(community.memberCount),
              })}
            </>
          ) : (
            <>
              {t('Sair de {comunidade}? As suas mensagens continuam lá para quem ficou.', { comunidade: isolar(community.name) })}
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

function CommunityIconEditor({ community, onChanged }: { community: Community; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  async function upload(image: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/communities/${community.id}/icon`, { method: 'PUT', body: { image } });
      setCropping(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/communities/${community.id}/icon`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="settings-card account-card">
        <CommunityIcon community={community} size={80} standalone />
        <div className="account-info">
          <div className="account-name">{community.name}</div>
        </div>
        <div className="account-actions">
          <FilePicker accept="image/png,image/jpeg,image/webp" disabled={busy} onFile={setCropping}>
            {busy ? 'Enviando…' : community.iconVersion === null ? t('Enviar imagem') : t('Trocar imagem')}
          </FilePicker>
          <PasteImage onImage={setCropping} onError={setError} />
          {community.iconVersion !== null && (
            <button className="link-button" onClick={remove} disabled={busy}>
              {t('Remover')}
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="form-error">{error}</p>
      ) : (
        <p className="settings-hint">{t('Sem imagem, a comunidade aparece com as iniciais do nome.')}</p>
      )}
      {cropping && (
        <ImageCropper
          file={cropping}
          title={`Imagem de ${community.name}`}
          shape="rounded"
          onCancel={() => setCropping(null)}
          onDone={upload}
        />
      )}
    </>
  );
}

/**
 * A CAPA: a faixa larga no alto da lista de canais.
 *
 * Sem foto, a faixa mostra a ARTE que o dono escolheu para as boas-vindas (um degradê, ver
 * boasVindas.ts) — então nunca há faixa vazia, e pôr uma foto é melhorar o que já existe em vez de
 * preencher um buraco.
 */
function CommunityBannerEditor({ community, onChanged }: { community: Community; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(file: File) {
    setBusy(true);
    setError(null);
    try {
      const image = await prepareBanner(file, 4096 * KB);
      await api(`/api/communities/${community.id}/capa`, { method: 'PUT', body: { image } });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function tirar() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/communities/${community.id}/capa`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <h3>{t('Capa da comunidade')}</h3>
      <CapaDaComunidade community={community} className="capa-previa" />
      <div className="account-actions">
        <FilePicker accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onFile={(f) => void enviar(f)}>
          {busy ? t('Enviando…') : community.bannerVersion ? t('Trocar a capa') : t('Enviar uma capa')}
        </FilePicker>
        {community.bannerVersion ? (
          <button className="link-button" onClick={() => void tirar()} disabled={busy}>
            {t('Tirar a capa')}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="form-error">{error}</p>
      ) : (
        <p className="settings-hint">
          {t('Uma imagem larga, de 1200 por 300 ou parecida. GIF animado vale, e anima de verdade. Sem capa, fica a arte que você escolheu nas boas-vindas.')}
        </p>
      )}
    </>
  );
}

// ---------- Membros da comunidade ----------

function RoleBadge({ role }: { role: Role }) {
  const t = useT();
  if (role === 'owner') return <span className="badge badge-owner">{t('Dono')}</span>;
  if (role === 'admin') return <span className="badge">{t('Administrador')}</span>;
  return null;
}

function MembersSection({ user, community }: { user: User; community: Community }) {
  const t = useT();
  const { members: directory } = useDirectory();
  const [removing, setRemoving] = useState<CommunityMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const rank = (m: CommunityMember) => (m.role === 'owner' ? 2 : m.role === 'admin' ? 1 : 0);
  const members = [...directory.values()].sort((a, b) => rank(b) - rank(a) || a.username.localeCompare(b.username));
  const isOwner = community.role === 'owner';
  const canManage = isOwner || community.role === 'admin';

  // Mesmas regras do servidor: administrador remove membro comum; outro administrador, só o dono; o dono, ninguém.
  const canRemove = (member: CommunityMember) =>
    member.id !== user.id && member.role !== 'owner' && (isOwner || (canManage && member.role !== 'admin'));

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
      <h2>{t('Membros')}</h2>
      <p className="settings-lead">
        {/* A FRASE É INTEIRA EM CADA CASO, e não montada de pedaços. Montar "N" + "pessoas" + "em" +
            nome funciona em português e quebra assim que a ordem das palavras muda: em turco o lugar
            vem antes, em coreano a partícula gruda no nome. Quem traduz precisa receber a frase
            toda. O número passa por algarismos() porque o bengali escreve ০১২৩৪৫৬৭৮৯, e o nome da
            comunidade por isolar() porque ele vem de fora e vai parar no meio de um texto árabe. */}
        {members.length === 1
          ? t('1 pessoa em {comunidade}.', { comunidade: isolar(community.name) })
          : t('{quantas} pessoas em {comunidade}.', { quantas: algarismos(members.length), comunidade: isolar(community.name) })}{' '}
        {isOwner
          ? t('Como dono, você escolhe quem administra e pode remover qualquer pessoa.')
          : canManage && t('Como administrador, você pode remover membros que não são administradores.')}
      </p>
      <p className="settings-hint">
        {t('Administradores podem apagar mensagens de qualquer pessoa, gerenciar todos os canais, emojis e sons desta comunidade e remover membros. Só o dono dá e tira esse cargo.')}
      </p>
      {roleError && <p className="form-error">{roleError}</p>}
      <div className="expression-list">
        {members.map((member) => (
          <div key={member.id} className="expression-row">
            <Avatar name={member.username} userId={member.id} size={32} />
            <span className="expression-name">{member.username}</span>
            <RoleBadge role={member.role} />
            {member.id === user.id && <span className="expression-author">{t('você')}</span>}
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
          title={t('Remover membro')}
          confirmLabel="Remover"
          busy={busy}
          error={error}
          onConfirm={confirmRemove}
          onCancel={() => {
            setRemoving(null);
            setError(null);
          }}
        >
          {t('Remover')} <strong>{removing.username}</strong> de {community.name}? A pessoa perde o acesso aos canais e sai de
          qualquer chamada na hora. A conta dela no Syden continua existindo. Para ela não voltar com o mesmo convite,
          troque o código em "Comunidade".
        </ConfirmDialog>
      )}
    </>
  );
}

/**
 * Os enfeites do perfil: a cor do nome e o fundo do cartão. Muda na hora, sem botão de salvar — cada
 * clique já manda para o servidor, que avisa todo mundo.
 */
function PerfilEditor({ user }: { user: User }) {
  const t = useT();
  const { members } = useDirectory();
  const eu = members.get(user.id);
  const [cor, setCor] = useState(eu?.nameColor ?? 'padrao');
  const [fundo, setFundo] = useState(eu?.banner ?? 'nenhum');
  // A MOLDURA MORAVA SÓ NA LOJA, e esta tela trazia duas das três peças do perfil. Quem procurasse
  // "o anel colorido que fulano tem" nas Configurações não achava nada, porque ele era o único
  // cosmético que não estava aqui — e nada na tela dizia que faltava um.
  const [moldura, setMoldura] = useState(eu?.moldura ?? 'nenhuma');
  const [erro, setErro] = useState<string | null>(null);

  /** Manda só o que mudou; o resto vai como está, porque a rota grava os três de uma vez. */
  async function guardar(mudanca: { cor?: string; fundo?: string; moldura?: string }) {
    const proximaCor = mudanca.cor ?? cor;
    const proximoFundo = mudanca.fundo ?? fundo;
    const proximaMoldura = mudanca.moldura ?? moldura;
    setCor(proximaCor);
    setFundo(proximoFundo);
    setMoldura(proximaMoldura);
    setErro(null);
    try {
      await api('/api/me/profile', {
        method: 'PUT',
        body: {
          nameColor: proximaCor === 'padrao' ? null : proximaCor,
          banner: proximoFundo === 'nenhum' ? null : proximoFundo,
          moldura: proximaMoldura === 'nenhuma' ? null : proximaMoldura,
        },
      });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <h3>{t('Meu perfil')}</h3>
      <p className="settings-hint">{t('É assim que os outros veem você na lista e nas conversas.')}</p>

      <div className={`perfil-previa ${classeDoFundo(fundo)}`}>
        <Avatar name={user.username} userId={user.id} size={56} />
        <strong data-cor={corDoNome(cor)}>{user.username}</strong>
      </div>

      <h4 className="perfil-titulo">{t('Cor do nome')}</h4>
      <div className="perfil-cores">
        {CORES_DE_NOME.map((opcao) => (
          <button
            key={opcao.id}
            className={`perfil-cor${cor === opcao.id ? ' ativa' : ''}`}
            title={t(opcao.label)}
            aria-label={t(opcao.label)}
            aria-pressed={cor === opcao.id}
            data-cor={corDoNome(opcao.id)}
            onClick={() => void guardar({ cor: opcao.id })}
          >
            <span aria-hidden="true">A</span>
          </button>
        ))}
      </div>

      <h4 className="perfil-titulo">{t('Fundo do perfil')}</h4>
      <div className="perfil-fundos">
        {FUNDOS.map((opcao) => (
          <button
            key={opcao.id}
            className={`perfil-fundo ${classeDoFundo(opcao.id)}${fundo === opcao.id ? ' ativo' : ''}`}
            aria-pressed={fundo === opcao.id}
            onClick={() => void guardar({ fundo: opcao.id })}
          >
            <span>{t(opcao.label)}</span>
            {opcao.animado && <small>{t('com movimento')}</small>}
          </button>
        ))}
      </div>

      <h4 className="perfil-titulo">{t('Moldura do avatar')}</h4>
      <div className="perfil-molduras">
        {Object.entries(MOLDURAS).map(([codigo, visual]) => (
          <button
            key={codigo}
            className={`perfil-moldura${moldura === codigo ? ' ativa' : ''}`}
            title={t(visual.nome)}
            aria-label={t(visual.nome)}
            aria-pressed={moldura === codigo}
            onClick={() => void guardar({ moldura: codigo })}
          >
            {/* A mesma marcação do avatar de verdade: o anel mora em .avatar[data-moldura]::after e
                em lugar nenhum mais, então qualquer amostra que não seja um .avatar não mostra nada. */}
            <span className="avatar perfil-moldura-bola" data-moldura={codigo === 'nenhuma' ? undefined : codigo} />
          </button>
        ))}
      </div>
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}

function AvatarEditor({ user }: { user: User }) {
  const t = useT();
  const { members } = useDirectory();
  const hasAvatar = (members.get(user.id)?.avatarVersion ?? null) !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  async function upload(image: string) {
    setBusy(true);
    setError(null);
    try {
      await api('/api/me/avatar', { method: 'PUT', body: { image } });
      setCropping(null);
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
          <FilePicker accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onFile={setCropping}>
            {busy ? 'Enviando…' : hasAvatar ? t('Trocar avatar') : t('Enviar avatar')}
          </FilePicker>
          <PasteImage onImage={setCropping} onError={setError} />
          {hasAvatar && (
            <button className="link-button" onClick={remove} disabled={busy}>
              {t('Remover')}
            </button>
          )}
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : <p className="settings-hint">{t('PNG, JPG ou WEBP, de qualquer tamanho: você escolhe o recorte.')}</p>}
      {cropping && (
        <ImageCropper file={cropping} title={t('Ajustar o avatar')} shape="circle" onCancel={() => setCropping(null)} onDone={upload} />
      )}
    </>
  );
}

/**
 * Botão "Colar imagem" ao lado do de escolher arquivo, e Ctrl+V funcionando na tela toda: serve para quem
 * copiou uma imagem da internet ou recortou algo na tela, sem precisar salvar arquivo antes.
 */
function PasteImage({ onImage, onError }: { onImage: (file: File) => void; onError: (message: string) => void }) {
  const t = useT();
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = imageFromClipboardEvent(event);
      if (file) {
        event.preventDefault();
        onImage(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onImage]);

  return (
    <button
      type="button"
      className="link-button"
      onClick={() => imageFromClipboard().then(onImage, (e: Error) => onError(e.message))}
    >
      <ClipboardPaste size={14} /> {t('Colar imagem')}
    </button>
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

// ---------- Emojis da comunidade ----------

function EmojisSection({ user, community }: { user: User; community: Community }) {
  const t = useT();
  const { emojis, members } = useDirectory();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Emoji | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const canEdit = (emoji: Emoji) => manages(community) || emoji.createdBy === user.id;

  async function rename(emoji: Emoji, newName: string) {
    if (newName === emoji.name) return setEditing(null);
    try {
      await api(`/api/emojis/${emoji.id}`, { method: 'PATCH', body: { name: newName } });
      setEditing(null);
      setMessage(null);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  }

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
      setAdding(false);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <>
      <h2>{t('Emojis da comunidade')}</h2>
      <p className="settings-lead">
        {/* O `:nome:` fica como {campo} e não como <code> no meio da frase: o que importa é a frase
            chegar inteira a quem traduz. */}
        {t('Todo mundo desta comunidade pode usar estes emojis escrevendo {exemplo} ou pelo botão de emoji do chat. Sem assinatura: está tudo liberado.', {
          exemplo: ':nome:',
        })}
      </p>

      <div className="section-head">
        <h3>{emojis.length} emojis</h3>
        <button className="btn-secondary" onClick={() => setAdding(!adding)}>
          <Plus size={16} /> {t('Adicionar emoji')}
        </button>
      </div>

      {adding && (
        <>
          <form className="settings-card upload-card" onSubmit={submit}>
            <div className="upload-preview">{preview ? <img src={preview} alt="" /> : <Smile size={28} />}</div>
            <div className="upload-fields">
              <FilePicker accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onFile={choose}>
                {file ? t('Trocar imagem') : t('Escolher imagem')}
              </FilePicker>
              <label className="settings-field">
                {t('Nome')}
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ex.: gato_feliz')} maxLength={32} />
              </label>
              <button className="btn-primary" disabled={!preview || !name || busy}>
                {busy ? 'Enviando…' : t('Enviar emoji')}
              </button>
            </div>
          </form>
          <p className="settings-hint">{t('PNG, JPG, WEBP ou GIF animado, até 512 KB. A imagem é ajustada para 128×128.')}</p>
        </>
      )}
      {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}

      <div className="expression-list">
        {emojis.map((emoji) => (
          <div key={emoji.id} className="expression-row">
            <img className="expression-emoji" src={mediaUrl.emoji(emoji.id)} alt="" />
            {editing?.id === emoji.id ? (
              <InlineRename
                value={emoji.name}
                label={`Novo nome para :${emoji.name}:`}
                onCancel={() => setEditing(null)}
                onSave={(newName) => rename(emoji, newName)}
              />
            ) : (
              <>
                <span className="expression-name">:{emoji.name}:</span>
                <span className="expression-author">{authorLabel(emoji.createdBy, members)}</span>
                {canEdit(emoji) && (
                  <>
                    <button
                      className="icon-plain expression-play"
                      title={`Renomear :${emoji.name}:`}
                      aria-label={`Renomear :${emoji.name}:`}
                      onClick={() => setEditing(emoji)}
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteButton label={`Excluir :${emoji.name}:`} path={`/api/emojis/${emoji.id}`} />
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <RestorePack community={community} />

      <EmojiPackCatalog user={user} community={community} podeInstalar={manages(community)} />
    </>
  );
}

/** Campo de renomear que aparece no lugar do nome, na própria linha da lista. */
function InlineRename({
  value,
  label,
  onCancel,
  onSave,
}: {
  value: string;
  label: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  return (
    <input
      className="channel-input"
      defaultValue={value}
      aria-label={label}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter') onSave(e.currentTarget.value.trim());
      }}
      onBlur={(e) => onSave(e.currentTarget.value.trim())}
    />
  );
}

/**
 * Traz de volta os emojis e sons que vêm com o Syden, caso alguém tenha apagado. O que a comunidade enviou
 * não é tocado, e nada é duplicado.
 */
function RestorePack({ community }: { community: Community }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!manages(community)) return null;

  async function restore() {
    setBusy(true);
    try {
      const added = await api<{ emojis: number; sounds: number }>(`/api/communities/${community.id}/restore-pack`, { method: 'POST' });
      const parts = [
        added.emojis > 0 && `${added.emojis} ${added.emojis === 1 ? 'emoji' : 'emojis'}`,
        added.sounds > 0 && `${added.sounds} ${added.sounds === 1 ? 'som' : 'sons'}`,
      ].filter(Boolean);
      setMessage(parts.length > 0 ? `De volta: ${parts.join(' e ')}.` : t('Nada faltando: o pacote está completo.'));
    } catch (e) {
      setMessage((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="settings-card restore-card">
      <div>
        <strong>{t('Apagou algo sem querer?')}</strong>
        <p className="settings-hint">
          {t('Traz de volta os emojis e sons que vêm com o Syden. O que vocês enviaram continua como está, e nada vira cópia repetida.')}
        </p>
        {message && <p className="form-success">{message}</p>}
      </div>
      <button className="btn-secondary" onClick={restore} disabled={busy}>
        <RotateCcw size={16} /> {busy ? t('Restaurando…') : t('Restaurar o pacote')}
      </button>
    </div>
  );
}

// ---------- Soundboard da comunidade ----------

function SoundboardSection({ user, community }: { user: User; community: Community }) {
  const t = useT();
  const { sounds, members } = useDirectory();
  const settings = useSettings();
  const [audio, setAudio] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🔊');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Sound | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<'sons' | 'pacotes'>('sons');
  // Aqui só entram os sons enviados para esta comunidade; os de pacote se resolvem na aba ao lado.
  const ownSounds = sounds.filter((sound) => sound.communityId !== null);
  const canEdit = (sound: Sound) => manages(community) || sound.createdBy === user.id;

  async function saveEdit(sound: Sound, values: { name: string; icon: string }) {
    if (values.name === sound.name && values.icon === sound.icon) return setEditing(null);
    try {
      await api(`/api/sounds/${sound.id}`, { method: 'PATCH', body: values });
      setEditing(null);
      setMessage(null);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  }

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
      setAdding(false);
      setIcon('🔊');
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <>
      {/* O título ia cravado enquanto a aba ao lado, com a MESMA chave, já aparecia traduzida: faltou
          só o t(). Palavra sem acento e escrita só com letras do ABC passa por qualquer detector de
          língua — esta só apareceu olhando a foto que o teste de idiomas tira. */}
      <h2>{t('Soundboard')}</h2>
      <p className="settings-lead">
        {/* O ícone fica FORA da frase, antes dela. Enfiá-lo no meio partiria a frase em duas, e a
            segunda metade chegaria a quem traduz sem o começo — foi o que aconteceu aqui. */}
        <AudioLines size={14} />{' '}
        {t('Durante uma chamada, esse botão toca estes sons para todos na sala. Instale pacotes prontos ou envie os seus; o que é seu favorito fica na frente do painel.')}
      </p>

      <div className="settings-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'sons'} className={tab === 'sons' ? 'active' : ''} onClick={() => setTab('sons')}>
          {t('Sons da comunidade')}
        </button>
        <button role="tab" aria-selected={tab === 'pacotes'} className={tab === 'pacotes' ? 'active' : ''} onClick={() => setTab('pacotes')}>
          {t('Pacotes')}
        </button>
      </div>

      {tab === 'pacotes' ? (
        <PackCatalog user={user} />
      ) : (
        <>

      <label className="settings-field volume-field">
        {t('Volume do soundboard (só para você): {quanto}%', { quanto: algarismos(Math.round(settings.soundboardVolume * 100)) })}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.soundboardVolume}
          onChange={(e) => updateSettings({ soundboardVolume: Number(e.target.value) })}
        />
      </label>

      <div className="section-head">
        <h3>
          {ownSounds.length === 1
            ? t('1 som enviado por vocês')
            : t('{quantos} sons enviados por vocês', { quantos: algarismos(ownSounds.length) })}
        </h3>
        <button className="btn-secondary" onClick={() => setAdding(!adding)}>
          <Plus size={16} /> {t('Adicionar som')}
        </button>
      </div>

      {adding && (
        <>
          <form className="settings-card upload-card" onSubmit={submit}>
            <div className="upload-preview upload-icon">{icon || '🔊'}</div>
            <div className="upload-fields">
              <FilePicker accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp3,.ogg,.wav" disabled={busy} onFile={choose}>
                {fileName ? t('Trocar áudio') : t('Escolher áudio')}
              </FilePicker>
              {fileName && <span className="settings-hint">{fileName}</span>}
              <div className="upload-row">
                <label className="settings-field icon-field">
                  {t('Ícone')}
                  <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
                </label>
                <label className="settings-field">
                  {t('Nome')}
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ex.: Risada')} maxLength={32} />
                </label>
              </div>
              <button className="btn-primary" disabled={!audio || !name.trim() || busy}>
                {busy ? 'Enviando…' : t('Enviar som')}
              </button>
            </div>
          </form>
          <p className="settings-hint">MP3, OGG ou WAV, até {MAX_SOUND_SECONDS} segundos e 1 MB.</p>

          <h3>{t('Vários de uma vez')}</h3>
          <BulkSoundUpload community={community} />
        </>
      )}
      {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}

      <div className="expression-list">
        {ownSounds.map((sound) => (
          <div key={sound.id} className="expression-row">
            {editing?.id === sound.id ? (
              <SoundRename sound={sound} onCancel={() => setEditing(null)} onSave={(values) => saveEdit(sound, values)} />
            ) : (
              <>
                <span className="expression-icon">{sound.icon}</span>
                <span className="expression-name">{sound.name}</span>
                <span className="expression-author">{authorLabel(sound.createdBy, members)}</span>
                <button className="icon-plain expression-play" title={t('Ouvir')} aria-label={`Ouvir ${sound.name}`} onClick={() => playSoundboard(sound.id)}>
                  <Play size={16} />
                </button>
                {canEdit(sound) && (
                  <>
                    <button
                      className="icon-plain expression-play"
                      title={`Renomear ${sound.name}`}
                      aria-label={`Renomear ${sound.name}`}
                      onClick={() => setEditing(sound)}
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteButton label={`Excluir ${sound.name}`} path={`/api/sounds/${sound.id}`} />
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <RestorePack community={community} />
        </>
      )}
    </>
  );
}

/** Renomear um som: o ícone e o nome, na própria linha. */
function SoundRename({
  sound,
  onCancel,
  onSave,
}: {
  sound: Sound;
  onCancel: () => void;
  onSave: (values: { name: string; icon: string }) => void;
}) {
  const t = useT();
  const [icon, setIcon] = useState(sound.icon);
  const [name, setName] = useState(sound.name);
  const save = () => onSave({ name: name.trim() || sound.name, icon: icon.trim() || sound.icon });

  return (
    <>
      <input
        className="channel-input icon-input"
        value={icon}
        aria-label={`Ícone de ${sound.name}`}
        maxLength={8}
        onChange={(e) => setIcon(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <input
        className="channel-input"
        value={name}
        aria-label={`Novo nome para ${sound.name}`}
        maxLength={32}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter') save();
        }}
      />
      <button className="icon-plain expression-play" title={t('Salvar')} aria-label={`Salvar ${sound.name}`} onClick={save}>
        <Check size={16} />
      </button>
    </>
  );
}

/**
 * Envia vários sons de uma vez. O nome vem do nome do arquivo, e um emoji no começo do nome vira o ícone:
 * "🤡 Errou.mp3" → som "Errou" com ícone 🤡.
 */
function BulkSoundUpload({ community }: { community: Community }) {
  const t = useT();
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
        {busy ? `Enviando ${progress.done + 1} de ${progress.total}…` : t('Escolher arquivos')}
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
  // FUNÇÃO AUXILIAR, E NÃO COMPONENTE: aqui o t() vem do import, nunca do useT(). Hook fora de
  // componente não dá erro de compilação — dá erro em tempo de execução, na cara da pessoa, e só
  // naquela tela.
  if (createdBy === null) return t('Pacote do Syden');
  return t('por {quem}', { quem: isolar(members.get(createdBy)?.username ?? t('alguém')) });
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
  const t = useT();
  const { devices, needsPermission, requestPermission } = useDevices(kind);
  return (
    <label className="settings-field">
      {label}
      {needsPermission ? (
        <button type="button" className="btn-secondary" onClick={() => void requestPermission()}>
          {t('Permitir acesso para ver os dispositivos')}
        </button>
      ) : (
        <select value={devices.some((d) => d.deviceId === value) ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('Padrão do sistema')}</option>
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
  const t = useT();
  const settings = useSettings();

  return (
    <>
      <h2>{t('Voz e vídeo')}</h2>

      <div className="settings-grid">
        <DeviceSelect
          label={t('Microfone')}
          kind="audioinput"
          value={settings.audioInput}
          onChange={(id) => void voice.switchDevice('audioinput', id)}
        />
        {canChooseOutput && (
          <DeviceSelect
            label={t('Alto-falante ou fone')}
            kind="audiooutput"
            value={settings.audioOutput}
            onChange={(id) => void voice.switchDevice('audiooutput', id)}
          />
        )}
      </div>

      <MicTest deviceId={settings.audioInput} />

      <VoiceEffectPicker voice={voice} />

      {desktopBridge && (
        <>
          <h3>{t('Teclas de atalho')}</h3>
          <p className="settings-hint shortcuts">
            {t('Funcionam mesmo com o Syden minimizado, durante uma chamada:')} <kbd>{SHORTCUT_LABELS.mute}</kbd> silencia ou
            ativa o microfone, e <kbd>{SHORTCUT_LABELS.deafen}</kbd> ensurdece ou volta a ouvir.
          </p>
        </>
      )}

      <h3>{t('Processamento de voz')}</h3>
      <Toggle
        label={t('Supressão de ruído')}
        description={t('Reduz barulhos de fundo, como teclado, ventilador e trânsito.')}
        checked={settings.noiseSuppression}
        onChange={(value) => void voice.setAudioProcessing({ noiseSuppression: value })}
      />
      <Toggle
        label={t('Cancelamento de eco')}
        description={t('Evita que os outros ouçam a própria voz de volta quando você usa caixa de som.')}
        checked={settings.echoCancellation}
        onChange={(value) => void voice.setAudioProcessing({ echoCancellation: value })}
      />

      <h3>{t('Vídeo')}</h3>
      <DeviceSelect
        label={t('Câmera')}
        kind="videoinput"
        value={settings.videoInput}
        onChange={(id) => void voice.switchDevice('videoinput', id)}
      />

      <h3>{t('Transmissões dos outros')}</h3>
      <Toggle
        label={t('Abrir a transmissão sozinha')}
        description={t(
          'Desligado, a transmissão de quem está na sala aparece como convite e só começa a ser baixada quando você clica em Assistir. Isso poupa internet e processador — principalmente em sala cheia.',
        )}
        checked={settings.abrirTransmissaoSozinha}
        onChange={(value) => updateSettings({ abrirTransmissaoSozinha: value })}
      />

      {/* SÓ NO APP. No navegador não existe pôr nada por cima de outro programa, e um ajuste que
          promete o que não pode cumprir é pior do que ajuste nenhum. */}
      {desktopBridge?.sobreposicao && (
        <>
          <h3>{t('Quando você está jogando')}</h3>
          <Toggle
            label={t('Mostrar quem está na chamada por cima do jogo')}
            description={t(
              'Uma janelinha no canto da tela com quem está com você, e quem está falando. O clique atravessa: o tiro vai no jogo. Funciona com o jogo em janela ou em janela sem borda; em tela cheia exclusiva, não aparece.',
            )}
            checked={settings.sobreposicaoNoJogo}
            onChange={(value) => updateSettings({ sobreposicaoNoJogo: value })}
          />
          {settings.sobreposicaoNoJogo && (
            <div className="canto-da-sobreposicao">
              {(
                [
                  ['superior-esquerdo', chave('Em cima, à esquerda')],
                  ['superior-direito', chave('Em cima, à direita')],
                  ['inferior-esquerdo', chave('Embaixo, à esquerda')],
                  ['inferior-direito', chave('Embaixo, à direita')],
                ] as const
              ).map(([id, rotulo]) => (
                <button
                  key={id}
                  className={`btn-sutil${settings.cantoDaSobreposicao === id ? ' escolhido' : ''}`}
                  aria-pressed={settings.cantoDaSobreposicao === id}
                  onClick={() => updateSettings({ cantoDaSobreposicao: id })}
                >
                  {t(rotulo)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <h3>{t('Qualidade do compartilhamento de tela')}</h3>
      <p className="settings-hint">{t('Vale a partir do próximo compartilhamento.')}</p>
      <div className="quality-options" role="radiogroup">
        {(
          [
            ['light', chave('Leve'), '720p · 30 fps', chave('Para internet mais fraca.')],
            ['standard', chave('Padrão'), '1080p · 30 fps', chave('Recomendado para a maioria. Quem assiste pode baixar a qualidade se precisar.')],
            [
              'smooth',
              chave('Fluido'),
              t('1080p · 60 fps'),
              chave('Para jogos. Manda uma imagem só, a melhor: sobra máquina para o jogo, e quem assiste recebe o que ela é.'),
            ],
          ] as [ScreenQuality, string, string, string][]
        ).map(([id, title, spec, hint]) => (
          <label key={id} className={`quality-option${settings.screenQuality === id ? ' selected' : ''}`}>
            <input
              type="radio"
              name="screen-quality"
              checked={settings.screenQuality === id}
              onChange={() => updateSettings({ screenQuality: id })}
            />
            <span className="quality-title">{t(title)}</span>
            <span className="quality-spec">{spec}</span>
            <span className="quality-hint">{t(hint)}</span>
          </label>
        ))}
      </div>

      <h3>{t('Como a imagem é comprimida')}</h3>
      <TesteDeCodec qualidade={settings.screenQuality} />
      <p className="settings-hint">
        {t(
          'No automático o Syden pergunta ao computador, antes de cada transmissão, se o H.264 sai pela placa de vídeo no tamanho escolhido — e só usa quando sai. Deixe assim, a não ser que você queira comparar os dois. Vale a partir do próximo compartilhamento.',
        )}
      </p>
      <div className="quality-options" role="radiogroup">
        {(
          [
            [
              'auto',
              chave('Automático'),
              chave('recomendado'),
              chave('Usa a placa de vídeo quando ela dá conta, e o processador quando não dá.'),
            ],
            ['vp8', 'VP8', chave('o de sempre'), chave('Funciona em tudo. Roda no processador.')],
            ['h264', 'H.264', chave('costuma usar a placa'), chave('Fixa o H.264 mesmo que ele caia no processador.')],
          ] as ['auto' | 'vp8' | 'h264', string, string, string][]
        ).map(([id, title, spec, hint]) => (
          <label key={id} className={`quality-option${settings.screenCodec === id ? ' selected' : ''}`}>
            <input type="radio" name="screen-codec" checked={settings.screenCodec === id} onChange={() => updateSettings({ screenCodec: id, codecEscolhidoAMao: true })} />
            <span className="quality-title">{t(title)}</span>
            <span className="quality-spec">{t(spec)}</span>
            <span className="quality-hint">{t(hint)}</span>
          </label>
        ))}
      </div>
    </>
  );
}

/**
 * O RESULTADO DO TESTE, ESCRITO NA TELA.
 *
 * O "Automático" já escolhia certo, mas escolhia calado: para quem abre as configurações, "automático"
 * não diz o que vai acontecer nem se a máquina dá conta. Aqui a mesma pergunta que o Syden faz antes
 * de transmitir é feita agora, com o tamanho de imagem que está escolhido, e a resposta aparece em
 * português.
 *
 * É a MESMA função de escolherCodec.ts, de propósito: um teste que responde diferente do que o app faz
 * na hora seria pior do que não ter teste. E ela é instantânea — uma pergunta ao navegador, sem
 * transmitir nada e sem pedir a tela.
 */
function TesteDeCodec({ qualidade }: { qualidade: ScreenQuality }) {
  const t = useT();
  const [resultado, setResultado] = useState<EscolhaDeCodec | null>(null);

  useEffect(() => {
    let valeu = true;
    const preset = SCREEN_PRESETS[qualidade];
    void escolherCodecDaTela(preset.width, preset.height, preset.encoding.maxFramerate ?? 30).then((escolha) => {
      if (valeu) setResultado(escolha);
    });
    return () => {
      valeu = false;
    };
  }, [qualidade]);

  if (!resultado) return null;
  const recado =
    resultado.motivo === 'placa'
      ? t('Neste computador, no automático: H.264 pela placa de vídeo. É o que sobra mais processador para o jogo.')
      : resultado.motivo === 'processador'
        ? t('Neste computador, no automático: VP8 pelo processador. A placa de vídeo não codifica H.264 neste tamanho de imagem.')
        : t('Este navegador não responde qual codificador é melhor. No automático fica o VP8, que funciona em tudo.');

  return <p className="settings-hint settings-teste">{recado}</p>;
}

/** Mostra o nível do microfone em tempo real, sem transmitir nada. */
function MicTest({ deviceId }: { deviceId: string }) {
  const t = useT();
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
          {testing ? t('Parar teste') : t('Testar microfone')}
        </button>
        <div className="mic-meter" aria-hidden="true">
          <span ref={barRef} />
        </div>
      </div>
      <p className="settings-hint">
        {error ?? (testing ? t('Fale algo: a barra deve se mexer com a sua voz.') : t('Veja se o microfone está captando a sua voz.'))}
      </p>
    </div>
  );
}

const PREVIEW_MS = 3000;

/**
 * Escolha do modificador de voz, com um teste: grava três segundos e toca de volta já com o efeito.
 * Gravar e só então tocar evita o apito de microfone que daria ao se ouvir ao vivo.
 *
 * A escolha vem da CHAMADA, não das configurações guardadas: o efeito acaba junto com a conversa.
 */
function VoiceEffectPicker({ voice }: { voice: Voice }) {
  const t = useT();
  const settings = useSettings();
  const escolhido = voice.voiceEffect;
  const [stage, setStage] = useState<'idle' | 'recording' | 'playing'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setError(null);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: settings.audioInput || undefined } });
      setStage('recording');
      const pieces: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => pieces.push(event.data);
      const recorded = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, PREVIEW_MS));
      recorder.stop();
      await recorded;
      stream.getTracks().forEach((track) => track.stop());

      const context = new AudioContext();
      const audio = await context.decodeAudioData(await new Blob(pieces).arrayBuffer());
      const source = context.createBufferSource();
      source.buffer = audio;
      const stopEffect = connectVoiceEffect(context, escolhido, source, context.destination);
      setStage('playing');
      source.start();
      source.onended = () => {
        // Um instante a mais para o eco da "caverna" terminar em vez de ser cortado.
        setTimeout(() => {
          stopEffect();
          void context.close();
          setStage('idle');
        }, 800);
      };
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setError('Não foi possível usar o microfone para o teste.');
      setStage('idle');
    }
  }

  return (
    <>
      <h3>{t('Modificador de voz')}</h3>
      <p className="settings-hint">
        {t('Muda como os outros ouvem você na chamada. Vale na hora, dá para trocar durante a conversa — e acaba quando você sai da sala: na próxima você entra com a sua voz.')}
      </p>
      <div className="effect-options" role="radiogroup" aria-label={t('Modificador de voz')}>
        {VOICE_EFFECTS.map((effect) => (
          <label key={effect.id} className={`effect-option${escolhido === effect.id ? ' selected' : ''}`}>
            <input
              type="radio"
              name="voice-effect"
              checked={escolhido === effect.id}
              onChange={() => void voice.setVoiceEffect(effect.id)}
            />
            <span className="effect-option-icon">{EFFECT_ICONS[effect.id]}</span>
            <span className="effect-option-text">
              <strong>{t(effect.name)}</strong>
              <small>{t(effect.hint)}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="mic-test-row">
        <button type="button" className="btn-secondary" disabled={stage !== 'idle'} onClick={() => void preview()}>
          {stage === 'recording' ? t('Gravando… fale algo') : stage === 'playing' ? t('Tocando…') : t('Gravar 3 segundos e ouvir')}
        </button>
        <p className="settings-hint inline">{error ?? t('Grava a sua voz e toca de volta com o efeito, só para você.')}</p>
      </div>
    </>
  );
}

// ---------- Sons ----------

function SoundsSection() {
  const t = useT();
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
      <h2>{t('Notificações')}</h2>
      <Toggle
        label={t('Notificações na área de trabalho')}
        description={t('Avisa das mensagens novas quando o Syden está minimizado, em segundo plano ou em outro canal.')}
        checked={settings.notifications && permission !== 'denied'}
        onChange={(value) => void toggleNotifications(value)}
      />
      {permission === 'denied' && (
        <p className="settings-hint">
          {t('O navegador bloqueou as notificações deste site. Libere no cadeado ao lado do endereço e recarregue a página.')}
        </p>
      )}
      <Toggle
        label={t('Efeitos visuais na chamada')}
        description={t('Confete, fogos e corações que qualquer pessoa da sala pode mandar. Desligue se o seu computador engasgar durante a chamada — desligado, você não vê nem manda.')}
        checked={settings.efeitosVisuais}
        onChange={(value) => updateSettings({ efeitosVisuais: value })}
      />
      <Toggle
        label={t('Sons de aviso')}
        description={t('Toca um som quando alguém entra ou sai da sua sala, quando alguém começa a compartilhar a tela e quando você silencia ou ensurdece.')}
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

/**
 * Acessibilidade.
 *
 * Nasceu com o ajuste das barras, e é aqui que crescem os próximos: é onde quem precisa vai procurar.
 * Uma aba própria, e não um pedaço perdido em "Minha conta", porque quem depende destes controles não
 * deveria ter que caçá-los.
 */
function AcessibilidadeSection() {
  const t = useT();
  return (
    <>
      <h2>{t('Acessibilidade')}</h2>
      <p className="settings-lead">{t('Ajustes de tamanho e de leitura, para o Syden caber do seu jeito.')}</p>
      <AjusteDasBarras />
    </>
  );
}
