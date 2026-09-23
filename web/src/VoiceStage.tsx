import {
  isTrackReference,
  ParticipantTile,
  StartAudio,
  type TrackReferenceOrPlaceholder,
  useIsMuted,
  useIsSpeaking,
  useParticipantTracks,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { type Participant, Track, type TrackPublication } from 'livekit-client';
import {
  AudioLines,
  HeadphoneOff,
  Headphones,
  Info,
  LayoutGrid,
  Maximize,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Square,
  Star,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AnimatedIcon } from './AnimatedIcon';
import { Avatar } from './Avatar';
import { reloadSounds, useDirectory } from './directory';
import { IconButton } from './IconButton';
import { MobileBackButton } from './MobileBackButton';
import { QualityAdvisor } from './QualityAdvisor';
import { ScreenShareButton } from './ScreenShareButton';
import { VoiceEffectButton } from './VoiceEffectButton';
import { updateSettings, useSettings } from './settings';
import { describeStats, useStreamStats } from './streamStats';
import { prepareSound } from './upload';
import { stopAllSounds } from './soundboard';
import { getScreenVolume, setScreenVolume } from './voiceVolumes';
import type { Channel, Sound, VoiceMember } from './types';
import type { Voice } from './useVoice';

function trackKey(ref: TrackReferenceOrPlaceholder) {
  return `${ref.participant.identity}:${ref.source}`;
}

/** Cartões menores conforme a sala enche, para caber todo mundo sem rolagem. */
function cardSize(count: number) {
  if (count <= 2) return { width: 360, avatar: 80 };
  if (count <= 4) return { width: 300, avatar: 80 };
  if (count <= 9) return { width: 240, avatar: 64 };
  return { width: 180, avatar: 56 };
}

export function VoiceStage({
  channel,
  voice,
  members,
  onMobileBack,
  membersOpen,
  onToggleMembers,
}: {
  channel: Channel;
  voice: Voice;
  members: VoiceMember[];
  /** Tela estreita: volta para a lista de canais. */
  onMobileBack: () => void;
  /** A lista de pessoas da comunidade está aberta à direita? */
  membersOpen: boolean;
  onToggleMembers: () => void;
}) {
  const inThisRoom = voice.channelId === channel.id;

  return (
    <div className="voice-stage">
      <header className="main-header">
        <MobileBackButton onBack={onMobileBack} />
        <Volume2 size={22} className="muted-icon" /> {channel.name}
        {/* Transmissão ocupa a tela toda; por isso dá para esconder a lista de pessoas e trazer de volta. */}
        <button
          className={`header-toggle${membersOpen ? ' active' : ''}`}
          title={membersOpen ? 'Esconder a lista de pessoas' : 'Mostrar a lista de pessoas'}
          aria-label={membersOpen ? 'Esconder a lista de pessoas' : 'Mostrar a lista de pessoas'}
          aria-pressed={membersOpen}
          onClick={onToggleMembers}
        >
          <Users size={20} />
        </button>
      </header>
      {/* Sala de voz sempre pertence a uma comunidade (conversa privada não tem voz por enquanto). */}
      {inThisRoom ? (
        <Stage voice={voice} members={members} communityId={channel.communityId ?? 0} />
      ) : (
        <div className="voice-lobby">
          <div className="voice-lobby-avatars">
            {members.map((m) => (
              <Avatar key={m.userId} name={m.username} userId={m.userId} size={64} />
            ))}
          </div>
          <h2>{channel.name}</h2>
          <p>{members.length === 0 ? 'Ninguém na sala ainda.' : `${members.map((m) => m.username).join(', ')} na sala.`}</p>
          <button className="btn-primary" disabled={voice.connecting} onClick={() => voice.join(channel.id)}>
            {voice.connecting ? 'Conectando…' : 'Entrar na sala'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Quadro de uma pessoa: o vídeo da câmera quando ela está ligada; senão, o avatar pequeno no centro,
 * como no Discord (a silhueta padrão do LiveKit esticava até ocupar o quadro inteiro).
 */
function PersonTile({
  trackRef,
  member,
  avatarSize,
  sound,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  member?: VoiceMember;
  avatarSize: number;
  /** Som do soundboard que a pessoa acabou de tocar. */
  sound?: { icon: string; key: number };
}) {
  const speaking = useIsSpeaking(trackRef.participant);
  const cameraMuted = useIsMuted(trackRef);
  const name = trackRef.participant.name || trackRef.participant.identity;

  const hasVideo = isTrackReference(trackRef) && !cameraMuted;

  return (
    <ParticipantTile trackRef={trackRef}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="tile-avatar">
          <Avatar name={name} userId={Number(trackRef.participant.identity)} size={avatarSize} speaking={speaking} />
        </div>
      )}
      {/* Mesma informação de formato da transmissão, só que discreta: aparece ao passar o mouse. */}
      {hasVideo && (
        <div className="tile-info">
          <StreamInfoBadge publication={trackRef.publication} local={trackRef.participant.isLocal} />
        </div>
      )}
      <div className="tile-name">
        {member?.deafened ? <HeadphoneOff size={14} /> : member?.muted && <MicOff size={14} />}
        <span>{name}</span>
      </div>
      {sound && (
        <span key={sound.key} className="tile-sound" aria-hidden="true">
          {sound.icon}
        </span>
      )}
    </ParticipantTile>
  );
}

/** Painel do soundboard: clicar num som toca para todos na sala. */
/**
 * Painel do soundboard dentro da chamada. Com os pacotes, a lista ficou grande: por isso os favoritos de
 * cada um vêm na frente (como as figurinhas preferidas do WhatsApp), o resto fica separado por pacote e
 * há uma busca por nome.
 */
function Soundboard({ voice, communityId, onClose }: { voice: Voice; communityId: number; onClose: () => void }) {
  const { sounds } = useDirectory();
  const settings = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !adding && onClose();
    const onPointer = (event: PointerEvent) => {
      // Fecha ao clicar fora (o próprio botão do soundboard fica fora, mas ele mesmo alterna).
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose, adding]);

  const term = search.trim().toLowerCase();
  const found = term ? sounds.filter((s) => s.name.toLowerCase().includes(term)) : sounds;
  const favorites = found.filter((s) => s.favorite);
  const groups = new Map<string, Sound[]>();
  for (const sound of found.filter((s) => !s.favorite)) {
    const group = sound.packName ?? 'Da comunidade';
    const list = groups.get(group);
    if (list) list.push(sound);
    else groups.set(group, [sound]);
  }

  async function toggleFavorite(sound: Sound) {
    try {
      await api(`/api/sounds/${sound.id}/favorite`, { method: 'PUT', body: { favorite: !sound.favorite } });
      await reloadSounds();
    } catch (e) {
      console.error(e);
    }
  }

  const grid = (list: Sound[]) => (
    <div className="soundboard-grid">
      {list.map((sound) => (
        <div key={sound.id} className="soundboard-item">
          <button className="soundboard-sound" onClick={() => void voice.playSound(sound.id)}>
            <span className="soundboard-icon">{sound.icon}</span>
            <span className="soundboard-name">{sound.name}</span>
          </button>
          <button
            className={`soundboard-star${sound.favorite ? ' on' : ''}`}
            title={sound.favorite ? 'Tirar dos favoritos' : 'Marcar como favorito'}
            aria-label={sound.favorite ? `Tirar ${sound.name} dos favoritos` : `Marcar ${sound.name} como favorito`}
            onClick={() => void toggleFavorite(sound)}
          >
            <Star size={12} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="soundboard" ref={ref} role="dialog" aria-label="Soundboard">
      <div className="soundboard-head">
        <div className="soundboard-title">Soundboard</div>
        <button className="soundboard-stop" onClick={stopAllSounds} title="Parar o que está tocando aqui">
          <Square size={12} /> Parar
        </button>
      </div>

      {/* Volume à mão: um som que estoura no ouvido não pode exigir abrir as configurações. */}
      <label className="soundboard-volume">
        Volume: {Math.round(settings.soundboardVolume * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.soundboardVolume}
          aria-label="Volume do soundboard"
          onChange={(e) => updateSettings({ soundboardVolume: Number(e.target.value) })}
        />
      </label>

      {sounds.length > 8 && (
        <input
          className="soundboard-search"
          value={search}
          placeholder="Procurar som"
          aria-label="Procurar som"
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {sounds.length === 0 && !adding && (
        <p className="soundboard-empty">
          Nenhum som ainda. Adicione um abaixo, ou instale um pacote em Configurações → Soundboard.
        </p>
      )}
      {sounds.length > 0 && found.length === 0 && <p className="soundboard-empty">Nenhum som com esse nome.</p>}

      {favorites.length > 0 && (
        <>
          <div className="soundboard-group">⭐ Favoritos</div>
          {grid(favorites)}
        </>
      )}

      {[...groups].map(([group, list]) => (
        <div key={group}>
          <div className="soundboard-group">{group}</div>
          {grid(list)}
        </div>
      ))}

      {!adding && (
        <button className="soundboard-sound soundboard-add" onClick={() => setAdding(true)} title="Adicionar som">
          <span className="soundboard-icon">
            <Plus size={20} />
          </span>
          <span className="soundboard-name">Adicionar som</span>
        </button>
      )}
      {adding && <SoundboardAddForm communityId={communityId} onDone={() => setAdding(false)} />}
    </div>
  );
}

/** Formulário compacto para gravar um som novo sem sair da chamada, direto no painel do soundboard. */
function SoundboardAddForm({ communityId, onDone }: { communityId: number; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🔊');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(chosen: File) {
    setError(null);
    try {
      setAudio(await prepareSound(chosen, 1024 * 1024));
      setFile(chosen);
      if (!name) setName(chosen.name.replace(/\.[^.]+$/, '').slice(0, 32));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!audio || !name.trim()) return;
    setBusy(true);
    try {
      await api(`/api/communities/${communityId}/sounds`, { method: 'POST', body: { name, icon, audio } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="soundboard-add-form">
      <label className="soundboard-file file-picker btn-secondary">
        {file ? file.name : 'Escolher áudio'}
        <input
          type="file"
          accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp3,.ogg,.wav"
          hidden
          onChange={(e) => e.target.files?.[0] && void choose(e.target.files[0])}
        />
      </label>
      <div className="soundboard-add-row">
        <input className="soundboard-add-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} aria-label="Ícone" />
        <input
          className="soundboard-add-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do som"
          aria-label="Nome do som"
          maxLength={32}
        />
      </div>
      {error && <p className="form-error small">{error}</p>}
      <div className="soundboard-add-actions">
        <button className="link-button" onClick={onDone}>
          Cancelar
        </button>
        <button className="btn-primary" disabled={!audio || !name.trim() || busy} onClick={() => void submit()}>
          {busy ? 'Enviando…' : 'Enviar som'}
        </button>
      </div>
    </div>
  );
}

/**
 * O "i" no canto da transmissão: passando o mouse, mostra em que formato ela está chegando de verdade
 * (não o que foi escolhido nas configurações, mas o que o navegador conseguiu entregar).
 */
function StreamInfoBadge({ publication, local }: { publication: TrackPublication | undefined; local: boolean }) {
  const [open, setOpen] = useState(false);
  const stats = useStreamStats(publication, { local });
  const formato = describeStats(stats);

  return (
    <div className="stream-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="stream-info-button" aria-label="Informações da transmissão" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        <Info size={16} />
      </button>
      {open && (
        <div className="stream-info-card" role="tooltip">
          {formato ? (
            <>
              <strong>{formato}</strong>
              <span>{local ? 'é o que você está enviando' : 'é o que está chegando até você'}</span>
              {local && stats?.limitedBy === 'cpu' && <span className="stream-info-warn">Seu computador está segurando a qualidade.</span>}
              {local && stats?.limitedBy === 'bandwidth' && <span className="stream-info-warn">Sua internet está segurando a qualidade.</span>}
            </>
          ) : (
            <span>Medindo…</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Som da transmissão: volume próprio, separado da voz da pessoa. Quando a transmissão vem sem som, explica
 * por quê — quase sempre é a caixinha "compartilhar áudio", que passa despercebida na hora de escolher a tela.
 */
function StreamAudio({ voice, publisher }: { voice: Voice; publisher: Participant }) {
  const [open, setOpen] = useState(false);
  const userId = Number(publisher.identity);
  const [volume, setVolume] = useState(() => getScreenVolume(userId));
  // Reavalia quando o participante publica ou tira faixas (o som pode chegar depois da imagem).
  const tracks = useParticipantTracks([Track.Source.ScreenShareAudio], publisher.identity);
  const comSom = tracks.length > 0;

  if (publisher.isLocal) {
    return comSom ? null : (
      <div className="stream-audio">
        <span className="stream-audio-warn">
          <VolumeX size={16} /> Sua transmissão está sem som: ao escolher a tela, marque "compartilhar áudio".
        </span>
      </div>
    );
  }

  return (
    <div className="stream-audio" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="stream-info-button" aria-label="Som da transmissão" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        {comSom && volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      {open && (
        <div className="stream-info-card">
          {comSom ? (
            <label className="stream-audio-volume">
              Som da transmissão: {Math.round(volume * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                aria-label="Volume da transmissão"
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setVolume(value);
                  setScreenVolume(voice.room, userId, value);
                }}
              />
            </label>
          ) : (
            <span>Esta transmissão está sem som. Quem transmite precisa marcar "compartilhar áudio" ao escolher a tela.</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Um quadro grande da tela (o que está em foco, ou cada uma quando a tela está dividida): o vídeo,
 * os controles da transmissão e o botão de tela cheia deste quadro.
 */
function FocusPane({ trackRef, voice, children }: { trackRef: TrackReferenceOrPlaceholder; voice: Voice; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="stage-main" ref={ref}>
      {children}
      {trackRef.source === Track.Source.ScreenShare && (
        <div className="stream-controls">
          <StreamInfoBadge publication={trackRef.publication} local={trackRef.participant.isLocal} />
          <StreamAudio voice={voice} publisher={trackRef.participant} />
        </div>
      )}
      <button className="fullscreen-button" title="Tela cheia" onClick={() => void ref.current?.requestFullscreen()}>
        <Maximize size={18} />
      </button>
    </div>
  );
}

function Stage({ voice, members, communityId }: { voice: Voice; members: VoiceMember[]; communityId: number }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const [pinned, setPinned] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);

  const screens = tracks.filter((t) => t.source === Track.Source.ScreenShare);
  // Só faz sentido dividir a tela quando há mais de uma transmissão.
  const splitting = split && screens.length > 1;

  // Foco: o que o usuário fixou; senão, a primeira tela compartilhada (como o Discord faz).
  const focused = splitting
    ? undefined
    : (tracks.find((t) => trackKey(t) === pinned) ?? tracks.find((t) => t.source === Track.Source.ScreenShare));
  const others = splitting ? tracks.filter((t) => t.source !== Track.Source.ScreenShare) : focused ? tracks.filter((t) => t !== focused) : tracks;
  const card = cardSize(tracks.length);

  /** Clicar num quadro fixa ou solta o foco; no modo dividido, volta para o foco naquela tela. */
  const togglePin = (ref: TrackReferenceOrPlaceholder) => {
    if (splitting) {
      setSplit(false);
      setPinned(trackKey(ref));
      return;
    }
    setPinned(focused && trackKey(focused) === trackKey(ref) ? null : trackKey(ref));
  };

  const tile = (ref: TrackReferenceOrPlaceholder, avatarSize: number) => (
    <div key={trackKey(ref)} className="tile" onClick={() => togglePin(ref)}>
      {ref.source === Track.Source.Camera ? (
        <PersonTile
          trackRef={ref}
          member={members.find((m) => String(m.userId) === ref.participant.identity)}
          avatarSize={avatarSize}
          sound={voice.recentSounds.get(ref.participant.identity)}
        />
      ) : (
        <ParticipantTile trackRef={ref} />
      )}
    </div>
  );

  return (
    <div className="stage" data-lk-theme="default">
      {splitting ? (
        // Todas as transmissões do mesmo tamanho, lado a lado.
        <div className="stage-focus">
          <div className="stage-split">
            {screens.map((ref) => (
              <FocusPane key={trackKey(ref)} trackRef={ref} voice={voice}>
                {tile(ref, 80)}
              </FocusPane>
            ))}
          </div>
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48))}</div>}
        </div>
      ) : focused ? (
        <div className="stage-focus">
          <FocusPane trackRef={focused} voice={voice}>
            {tile(focused, 80)}
          </FocusPane>
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48))}</div>}
        </div>
      ) : (
        // Sem tela compartilhada: cartões de tamanho fixo, centralizados, como no Discord.
        <div className="stage-cards" style={{ '--card-width': `${card.width}px` } as CSSProperties}>
          {tracks.map((ref) => tile(ref, card.avatar))}
        </div>
      )}

      <QualityAdvisor voice={voice} />

      {voice.mutedWarning && (
        <div className="muted-warning" role="status">
          <MicOff size={16} /> Você está silenciado!
        </div>
      )}

      <StartAudio label="Clique para ativar o áudio" className="start-audio" />

      <div className="stage-controls">
        <IconButton
          label={voice.media.muted ? 'Ativar microfone' : 'Silenciar'}
          danger={voice.media.muted}
          onClick={voice.toggleMute}
        >
          {voice.media.muted ? <MicOff /> : <Mic />}
        </IconButton>
        <IconButton label={voice.deafened ? 'Ativar áudio' : 'Desativar áudio'} danger={voice.deafened} onClick={voice.toggleDeafen}>
          {voice.deafened ? <HeadphoneOff /> : <Headphones />}
        </IconButton>
        <IconButton label={voice.media.video ? 'Desligar câmera' : 'Ligar câmera'} active={voice.media.video} onClick={voice.toggleCamera}>
          {voice.media.video ? <Video /> : <VideoOff />}
        </IconButton>
        <ScreenShareButton voice={voice} />
        <VoiceEffectButton voice={voice} />
        {screens.length > 1 && (
          <IconButton
            label={split ? 'Focar em uma transmissão' : `Ver as ${screens.length} transmissões lado a lado`}
            active={split}
            onClick={() => setSplit(!split)}
          >
            <LayoutGrid />
          </IconButton>
        )}
        <div className="soundboard-anchor">
          <IconButton label="Soundboard" active={soundboardOpen} onClick={() => setSoundboardOpen(!soundboardOpen)}>
            <AnimatedIcon name="musica" size={24} />
          </IconButton>
          {soundboardOpen && <Soundboard voice={voice} communityId={communityId} onClose={() => setSoundboardOpen(false)} />}
        </div>
        <button className="leave-button" title="Desconectar" onClick={voice.leave}>
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
