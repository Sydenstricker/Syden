import { Ban,
  AtSign,
  Flag,
  IdCard,
  MessageSquare,
  MicOff,
  MonitorPlay,
  PhoneOff,
  ShieldOff,
  ShieldPlus,
  StickyNote,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { carregarBloqueios, useBloqueados } from './bloqueios';
import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import { DialogoDeDenuncia } from './Denuncia';
import { Vitrine } from './Vitrine';
import { pedirMencao } from './mencao';
import { guardarNota, LIMITE_DA_NOTA, useNota } from './notas';
import { corDoNome, efeitoDoNome, letraDoNome } from './profileStyles';
import { getUserVolume, isLocallyMuted, setLocalMute, setUserVolume } from './voiceVolumes';
import type { Channel, Role } from './types';
import type { Voice } from './useVoice';
import { chave, useT } from './i18n';

/**
 * Menu do botão direito em cima de alguém, como no Discord: abrir o perfil, mencionar, mandar mensagem,
 * anotar um lembrete só seu, mexer no volume dela para os seus ouvidos — e, para quem administra a
 * comunidade, as ações de moderação, separadas embaixo para ninguém clicar sem querer.
 */
export function usePersonMenu() {
  const [target, setTarget] = useState<{ userId: number; username: string; x: number; y: number } | null>(null);

  const open = (event: MouseEvent, userId: number, username: string) => {
    event.preventDefault();
    setTarget({ userId, username, x: event.clientX, y: event.clientY });
  };

  return { target, open, close: () => setTarget(null) };
}

const CARGO: Record<Role, string> = {
  owner: chave('Dono da comunidade'),
  admin: chave('Administra a comunidade'),
  member: chave('Membro'),
};

/** Uma linha do menu. Separada para o teclado poder andar por todas elas do mesmo jeito. */
function Item({
  icone,
  children,
  perigo,
  onClick,
}: {
  icone: ReactNode;
  children: ReactNode;
  perigo?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`person-menu-item${perigo ? ' danger' : ''}`} role="menuitem" onClick={onClick}>
      <span className="person-menu-icone" aria-hidden="true">
        {icone}
      </span>
      <span className="person-menu-texto">{children}</span>
    </button>
  );
}

export function PersonMenu({
  target,
  onClose,
  voice,
  role,
  channelId,
  communityId,
  channels,
  inVoiceChannel,
  targetScreen,
  targetRole,
  isSelf,
  onWatchStream,
  onSendMessage,
  onOpenProfile,
}: {
  target: { userId: number; username: string; x: number; y: number };
  onClose: () => void;
  voice: Voice;
  /** Seu cargo na comunidade: decide o que o menu oferece. */
  role: Role;
  /** A sala em que VOCÊ está (para silenciar e desconectar). */
  channelId: number | null;
  communityId: number;
  channels: Channel[];
  /** A sala em que a PESSOA está, ou null se ela não está em chamada. */
  inVoiceChannel: number | null;
  /** Se a pessoa está transmitindo a tela agora. */
  targetScreen: boolean;
  targetRole: Role;
  isSelf: boolean;
  /** Abre a sala da pessoa na tela E abre a transmissão dela — usado por "Assistir transmissão". */
  onWatchStream: (channelId: number, userId: number) => void;
  /** Abre (ou cria) a conversa privada com a pessoa. */
  onSendMessage: (userId: number) => void;
  /** Abre o cartão de perfil dela, no mesmo lugar em que o menu estava. */
  onOpenProfile?: (userId: number, x: number, y: number) => void;
}) {
  const t = useT();
  const { members } = useDirectory();
  const membro = members.get(target.userId);
  const [volume, setVolume] = useState(() => getUserVolume(target.userId));
  const [muted, setMuted] = useState(() => isLocallyMuted(target.userId));
  const [error, setError] = useState<string | null>(null);
  const nota = useNota(target.userId);
  const [anotando, setAnotando] = useState(false);
  const [denunciando, setDenunciando] = useState(false);

  const bloqueados = useBloqueados();
  const bloqueado = bloqueados.has(target.userId);

  /**
   * Bloquear e desbloquear são o mesmo botão, porque são a mesma decisão vista de dois momentos.
   *
   * Não há confirmação: bloquear é reversível num clique, e uma caixa de "tem certeza?" na frente de
   * uma ação de defesa põe um obstáculo justamente em quem está incomodado agora.
   */
  async function bloquearPessoa() {
    try {
      if (bloqueado) await api(`/api/me/bloqueios/${target.userId}`, { method: 'DELETE' });
      else await api('/api/me/bloqueios', { method: 'POST', body: { userId: target.userId } });
      await carregarBloqueios();
    } catch {
      // Falhou: a lista continua como está, e a pessoa pode tentar de novo.
    }
    onClose();
  }
  const [rascunho, setRascunho] = useState(nota);
  const ref = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ left: target.x, top: target.y });
  const voiceChannels = channels.filter((c) => c.type === 'voice');
  const manages = role === 'owner' || role === 'admin';

  // O menu nasce onde o mouse clicou, mas não pode ficar metade fora da tela. A altura é MEDIDA, porque
  // ela muda conforme o que cada um pode fazer (moderar, mover de sala, anotar…) — antes era um número
  // fixo no código, e o menu do administrador vazava pelo rodapé.
  useLayoutEffect(() => {
    const caixa = ref.current?.getBoundingClientRect();
    if (!caixa) return;
    setLugar({
      left: Math.max(8, Math.min(target.x, window.innerWidth - caixa.width - 8)),
      top: Math.max(8, Math.min(target.y, window.innerHeight - caixa.height - 8)),
    });
  }, [target.x, target.y, anotando]);

  useEffect(() => {
    const fora = () => onClose();
    /** Escape fecha; as setas andam pelas opções, como em qualquer menu. */
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose();
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const itens = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      if (itens.length === 0) return;
      event.preventDefault();
      const atual = itens.indexOf(document.activeElement as HTMLElement);
      const passo = event.key === 'ArrowDown' ? 1 : -1;
      itens[(atual + passo + itens.length) % itens.length].focus();
    };
    window.addEventListener('pointerdown', fora);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('pointerdown', fora);
      window.removeEventListener('keydown', tecla);
    };
  }, [onClose]);

  function changeVolume(value: number) {
    setVolume(value);
    setUserVolume(voice.room, target.userId, value);
  }

  function toggleLocalMute() {
    const next = !muted;
    setMuted(next);
    setLocalMute(voice.room, target.userId, next);
  }

  function salvarNota() {
    guardarNota(target.userId, rascunho);
    setAnotando(false);
    onClose(); // guardou, acabou: o menu sai da frente como em qualquer outra ação daqui
  }

  /** Ação de administrador sobre a pessoa; fecha o menu quando dá certo, mostra o motivo quando não dá. */
  async function act(path: string, body: Record<string, unknown>, method: 'POST' | 'PUT' = 'POST') {
    try {
      await api(path, { method, body: { userId: target.userId, ...body } });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const moderando = manages && !isSelf && (channelId !== null || inVoiceChannel !== null || role === 'owner');

  return createPortal(
    <div
      ref={ref}
      className="person-menu"
      role="menu"
      aria-label={`Opções de ${target.username}`}
      style={{ top: lugar.top, left: lugar.left }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* O topo é a identificação: avatar, nome na cor da pessoa e o cargo dela aqui. */}
      <div className="person-menu-topo">
        <Avatar name={target.username} userId={target.userId} size={36} />
        <div className="person-menu-quem">
          <strong data-cor={corDoNome(membro?.nameColor ?? null)} data-efeito={efeitoDoNome(membro?.nameEffect)} style={{ fontFamily: letraDoNome(membro?.nameFont) }}>{target.username}</strong>
          <small>{t(CARGO[targetRole])}</small>
        </div>
      </div>
      {(membro?.vitrine?.length ?? 0) > 0 && (
        <span className="medalha-linha person-menu-medalha">
          <Vitrine membro={membro!} tamanho={34} />
        </span>
      )}

      {onOpenProfile && (
        <Item
          icone={<IdCard size={16} />}
          onClick={() => {
            onOpenProfile(target.userId, target.x, target.y);
            onClose();
          }}
        >
          Ver perfil
        </Item>
      )}

      {!isSelf && (
        <Item
          icone={<AtSign size={16} />}
          onClick={() => {
            pedirMencao(target.username);
            onClose();
          }}
        >
          Mencionar na conversa
        </Item>
      )}

      {!isSelf && (
        <Item
          icone={<MessageSquare size={16} />}
          onClick={() => {
            onSendMessage(target.userId);
            onClose();
          }}
        >
          {t('Enviar mensagem')}
        </Item>
      )}

      {!isSelf && targetScreen && inVoiceChannel !== null && (
        <Item
          icone={<MonitorPlay size={16} />}
          onClick={() => {
            onWatchStream(inVoiceChannel, target.userId);
            onClose();
          }}
        >
          {t('Assistir transmissão')}
        </Item>
      )}

      {/* A anotação é sua e só sua: fica neste computador e ninguém mais vê. */}
      {!isSelf &&
        (anotando ? (
          <div className="person-menu-nota">
            <textarea
              autoFocus
              rows={2}
              value={rascunho}
              maxLength={LIMITE_DA_NOTA}
              placeholder={`Anotação sobre ${target.username}`}
              aria-label={`Anotação sobre ${target.username}`}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  salvarNota();
                }
              }}
            />
            <div className="person-menu-nota-rodape">
              <span>{t('Só você vê')}</span>
              <button className="link-button" onClick={salvarNota}>
                {t('Guardar')}
              </button>
            </div>
          </div>
        ) : (
          <Item
            icone={<StickyNote size={16} />}
            onClick={() => {
              setRascunho(nota);
              setAnotando(true);
            }}
          >
            {nota ? (
              <>
                {nota}
                <small>{t('Sua anotação — clique para mudar')}</small>
              </>
            ) : (
              <>
                Anotar sobre esta pessoa
                <small>{t('Só você vê')}</small>
              </>
            )}
          </Item>
        ))}

      {!isSelf && (
        <>
          <hr className="person-menu-linha" />
          <label className="person-menu-volume">
            Volume para você: {Math.round(volume * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={`Volume de ${target.username}`}
              onChange={(e) => changeVolume(Number(e.target.value))}
            />
          </label>

          <Item icone={muted ? <Volume2 size={16} /> : <VolumeX size={16} />} onClick={toggleLocalMute}>
            {muted ? 'Ouvir de novo' : 'Silenciar só para mim'}
          </Item>

          {/* Fica disponível para todo mundo, e não só para quem modera: é justamente quem não tem poder
              nenhum que precisa de um caminho para dizer que algo está errado. */}
          <Item icone={<Flag size={16} />} onClick={() => setDenunciando(true)}>
            Denunciar esta pessoa
          </Item>

          {/*
            Bloquear é a única ação desta lista que resolve sozinha, na hora, sem depender de
            ninguém. Denunciar espera alguém ler; silenciar só cala a voz e deixa o texto passar.
            Por isso ela existe: quem está sendo incomodado não pode ficar refém de um administrador
            aparecer.
          */}
          <Item icone={<Ban size={16} />} perigo onClick={() => void bloquearPessoa()}>
            {bloqueado ? 'Desbloquear esta pessoa' : 'Bloquear esta pessoa'}
          </Item>
        </>
      )}

      {denunciando && (
        <DialogoDeDenuncia
          titulo={`Denunciar ${target.username}`}
          corpo={{ tipo: 'pessoa', alvo: target.userId }}
          aoFechar={() => {
            setDenunciando(false);
            onClose();
          }}
        />
      )}

      {moderando && (
        <>
          <hr className="person-menu-linha" />
          <div className="person-menu-grupo">{t('Moderação')}</div>

          {channelId !== null && (
            <>
              <Item icone={<MicOff size={16} />} perigo onClick={() => act(`/api/channels/${channelId}/mute`, { muted: true })}>
                {t('Silenciar microfone para todos')}
              </Item>
              <Item icone={<PhoneOff size={16} />} perigo onClick={() => act(`/api/channels/${channelId}/kick`, {})}>
                Desconectar da chamada
              </Item>
            </>
          )}

          {/* Mover de sala: só faz sentido para quem está em alguma, e só para as outras salas. */}
          {inVoiceChannel !== null && voiceChannels.length > 1 && (
            <label className="person-menu-volume">
              {t('Mover para outra sala')}
              <select
                value=""
                aria-label={`Mover ${target.username} para outra sala`}
                onChange={(e) => act(`/api/channels/${inVoiceChannel}/move`, { toChannelId: Number(e.target.value) })}
              >
                <option value="" disabled>
                  {t('Escolha a sala…')}
                </option>
                {voiceChannels
                  .filter((c) => c.id !== inVoiceChannel)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {role === 'owner' && targetRole !== 'owner' && (
            <Item
              icone={targetRole === 'admin' ? <ShieldOff size={16} /> : <ShieldPlus size={16} />}
              onClick={() =>
                act(`/api/communities/${communityId}/members/${target.userId}`, { role: targetRole === 'admin' ? 'member' : 'admin' }, 'PUT')
              }
            >
              {targetRole === 'admin' ? 'Tirar o cargo de administrador' : 'Tornar administrador'}
            </Item>
          )}
        </>
      )}
      {error && <p className="form-error small">{error}</p>}
    </div>,
    document.body,
  );
}
