import {
  isTrackReference,
  ParticipantTile,
  StartAudio,
  type TrackReferenceOrPlaceholder,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useParticipantTracks,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { type LocalTrackPublication, type Participant, type Room, RoomEvent, Track, type TrackPublication } from 'livekit-client';
import {
  AudioLines,
  HeadphoneOff,
  Headphones,
  Info,
  LayoutGrid,
  Maximize,
  Minimize,
  MonitorPlay,
  Mic,
  MicOff,
  Music,
  MonitorOff,
  PhoneOff,
  Play,
  Plus,
  Popcorn,
  Square,
  Star,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Eye,
  X,
} from 'lucide-react';
import { useMemo, type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { api, mediaUrl } from './api';
import { Avatar } from './Avatar';
import { desktopBridge } from './desktop';
import { PersonMenu, usePersonMenu } from './PersonMenu';
import { ProfileCard } from './ProfileCard';
import { nomeNaComunidade, reloadSounds, useDirectory } from './directory';
import { buscarSons, contarToque, toquesDosSons } from './buscaDeSons';
import { somParecidoCom } from './somParecido';
import { chave, idiomaAtual, useT } from './i18n';
import { DURACAO_DO_TESTE_MS, ligarCodificacaoParaTestar } from './testarCodificacao';
import { IconButton } from './IconButton';
import { MobileBackButton } from './MobileBackButton';
import { ClipButton, PreviaDoClipe, useClipe } from './ClipButton';
import type { Socket } from 'socket.io-client';
import { BotaoDestacar } from './BotaoDestacar';
import { BotaoApresentacao, FaixaDoPalco, usarPalco } from './Palco';
import { quemAssiste } from './assistindo';
import { Karaoke, pegarPedidoDeKaraoke } from './Karaoke';
import { ScreenShareButton } from './ScreenShareButton';
import { BotaoMinijogo, ConviteDoMinijogo, PainelDoMinijogo } from './Minijogo';
import { SiteNoPalco } from './SiteEmbutido';
import { convitePendente, pegarPedidoDeAbrir, souJogador, usarMinijogo } from './minijogos';
import { CamadaDeEfeitos } from './CamadaDeEfeitos';
import { EfeitoVisualButton } from './EfeitoVisualButton';
import { MaisNaChamada } from './MaisNaChamada';
import { VoiceEffectButton } from './VoiceEffectButton';
import { updateSettings, useSettings } from './settings';
import { describeStats, useStreamStats } from './streamStats';
import { prepareSound } from './upload';

import { alternarMudoDaTela, getScreenVolume, setScreenVolume, TETO_DA_TRANSMISSAO } from './voiceVolumes';
import type { Channel, Sound, VoiceMember } from './types';
import type { Voice } from './useVoice';
import { SomPorEndereco } from './SomPorEndereco';

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

/** O quadro de agora de um vídeo, em JPEG (no máximo 1280 de largura), ou null se ele ainda não tem imagem. */
function quadroDoVideo(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const escala = Math.min(1, 1280 / video.videoWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(video.videoWidth * escala);
  c.height = Math.round(video.videoHeight * escala);
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(video, 0, 0, c.width, c.height);
  try {
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

export function VoiceStage({
  channel,
  voice,
  members,
  canaisDeTexto,
  onMobileBack,
  membersOpen,
  onToggleMembers,
  sessao,
  aoAlternarSessao,
  socket,
  aoAbrirVozEVideo,
  simples = false,
  canais = [],
  aoMandarMensagem,
  aoEditarPerfil,
}: {
  channel: Channel;
  voice: Voice;
  members: VoiceMember[];
  /** Para onde o clipe pode ser mandado. */
  canaisDeTexto: Channel[];
  /** Tela estreita: volta para a lista de canais. */
  onMobileBack: () => void;
  /** A lista de pessoas da comunidade está aberta à direita? */
  membersOpen: boolean;
  onToggleMembers: () => void;
  /** Modo sessão: assistir junto, com o vídeo grande e a conversa ao lado. */
  sessao: boolean;
  aoAlternarSessao: () => void;
  /** Abre as Configurações em "Voz e vídeo": é lá que se troca o microfone. */
  aoAbrirVozEVideo?: () => void;
  /** Por onde chegam os avisos de quem ganhou ou perdeu a palavra na apresentação. */
  socket: Socket | null;
  /** Modo sala (aula): o cabeçalho e os controles ficam só com o que a aula precisa. */
  simples?: boolean;
  /** Todos os canais da comunidade: o menu do botão direito move gente para outra sala. */
  canais?: Channel[];
  /** "Enviar mensagem", no menu do botão direito de um quadro. */
  aoMandarMensagem?: (userId: number) => void;
  /** O lápis do seu cartão de perfil, aberto pelo "Perfil" do menu. */
  aoEditarPerfil?: () => void;
}) {
  const t = useT();
  const { estado: palco } = usarPalco(channel.type === 'voice' ? channel.id : null, socket);
  const inThisRoom = voice.channelId === channel.id;
  const alguemTransmitindo = members.some((m) => m.screen);

  return (
    <div className="voice-stage">
      <header className="main-header">
        <MobileBackButton onBack={onMobileBack} />
        <Volume2 size={22} className="muted-icon" /> {channel.name}
        {/* Transmissão ocupa a tela toda; por isso dá para esconder a lista de pessoas e trazer de volta. */}
        {!simples && (
        <button
          className={`header-toggle${membersOpen ? ' active' : ''}`}
          title={membersOpen ? t('Esconder a lista de pessoas') : t('Mostrar a lista de pessoas')}
          aria-label={membersOpen ? t('Esconder a lista de pessoas') : t('Mostrar a lista de pessoas')}
          aria-pressed={membersOpen}
          onClick={onToggleMembers}
        >
          <Users size={20} />
        </button>
        )}
        {/*
          O botão da sessão só existe quando ALGUÉM ESTÁ TRANSMITINDO. Sem transmissão não há o que
          assistir junto, e um "Assistir junto" que não faz nada ensina a ignorar o botão.
        */}
        {/* Apresentar só faz sentido para quem administra, e só numa sala de voz. */}
        {palco?.souApresentador && !simples && <BotaoApresentacao channelId={channel.id} estado={palco} />}
        {inThisRoom && alguemTransmitindo && !simples && (
          <button
            className={`header-toggle${sessao ? ' active' : ''}`}
            title={sessao ? t('Sair do modo sessão') : t('Assistir junto: vídeo grande e conversa ao lado')}
            aria-label={sessao ? t('Sair do modo sessão') : t('Assistir junto')}
            aria-pressed={sessao}
            onClick={aoAlternarSessao}
          >
            <Popcorn size={20} />
          </button>
        )}
      </header>
      {palco?.apresentacao && <FaixaDoPalco channelId={channel.id} estado={palco} />}
      {/* Sala de voz sempre pertence a uma comunidade (conversa privada não tem voz por enquanto). */}
      {inThisRoom ? (
        <Stage
          voice={voice}
          members={members}
          channelId={channel.id}
          socket={socket}
          communityId={channel.communityId ?? 0}
          canaisDeTexto={canaisDeTexto}
          aoAbrirVozEVideo={aoAbrirVozEVideo}
          simples={simples}
          canais={canais}
          aoMandarMensagem={aoMandarMensagem}
          aoEditarPerfil={aoEditarPerfil}
        />
      ) : (
        <div className="voice-lobby">
          <div className="voice-lobby-avatars">
            {members.map((m) => (
              <Avatar key={m.userId} name={nomeNaComunidade(m.userId, m.username)} userId={m.userId} size={64} />
            ))}
          </div>
          <h2>{channel.name}</h2>
          <p>{members.length === 0 ? t('Ninguém na sala ainda.') : t('{quem} na sala.', { quem: members.map((m) => nomeNaComunidade(m.userId, m.username)).join(', ') })}</p>
          <button className="btn-primary" disabled={voice.connecting} onClick={() => voice.join(channel.id)}>
            {voice.connecting ? t('Conectando…') : t('Entrar na sala')}
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
  musica,
  assistindo,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  member?: VoiceMember;
  avatarSize: number;
  /** Tem música do karaokê tocando nesta chamada: o coelho aparece de fone. */
  musica?: boolean;
  /** Está na plateia de uma transmissão desta sala: o coelho aparece com a pipoca. */
  assistindo?: boolean;
  /** Som do soundboard que a pessoa acabou de tocar. */
  sound?: { icon: string; key: number };
}) {
  const speaking = useIsSpeaking(trackRef.participant);
  const cameraMuted = useIsMuted(trackRef);
  useDirectory(); // redesenha quando o apelido muda
  const name = nomeNaComunidade(Number(trackRef.participant.identity), trackRef.participant.name || trackRef.participant.identity);

  const hasVideo = isTrackReference(trackRef) && !cameraMuted;

  return (
    <ParticipantTile trackRef={trackRef}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="tile-avatar">
          <Avatar name={name} userId={Number(trackRef.participant.identity)} size={avatarSize} speaking={speaking} musica={musica} assistindo={assistindo} />
        </div>
      )}
      {/* Mesma informação de formato da transmissão, só que discreta: aparece ao passar o mouse. */}
      {hasVideo && (
        <div className="tile-info">
          <StreamInfoBadge publication={trackRef.publication} local={trackRef.participant.isLocal} />
        </div>
      )}
      {/* Destacar só faz sentido com imagem, e só para a de OUTRA pessoa: pôr a própria câmera numa
          janela à parte é olhar para si mesmo em dobro. */}
      {hasVideo && !trackRef.participant.isLocal && <BotaoDestacar nome={name} />}
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

/** Um som de pacote que a pessoa ainda não instalou: o que a busca mostra com o botão de instalar. */
interface SomQueFalta {
  id: number;
  name: string;
  icon: string;
  packId: number;
  packName: string;
  volume: number;
}

/** Painel do soundboard: clicar num som toca para todos na sala. */
/**
 * Painel do soundboard dentro da chamada. Com os pacotes, a lista ficou grande: por isso os favoritos de
 * cada um vêm na frente (como as figurinhas preferidas do WhatsApp), o resto fica separado por pacote e
 * há uma busca por nome.
 */
function Soundboard({ voice, communityId, onClose }: { voice: Voice; communityId: number; onClose: () => void }) {
  const t = useT();
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

  // Buscando, a lista é UMA SÓ, do mais provável para o menos provável (ver buscaDeSons.ts); os grupos
  // por pacote só fazem sentido quando se está olhando tudo.
  const term = search.trim();
  const found = term ? buscarSons(sounds, term, toquesDosSons()) : sounds;
  const favorites = term ? [] : found.filter((s) => s.favorite);

  /*
   * O QUE ESTÁ NOS PACOTES QUE VOCÊ AINDA NÃO TEM. A busca respondia "nenhum som" quando o som existia, só
   * que num pacote não instalado. Agora ela mostra esses também, depois dos seus, com o botão de instalar:
   * instalado, o pacote entra no soundboard e o som passa a tocar. Carrega uma vez, na primeira busca.
   */
  const [faltam, setFaltam] = useState<SomQueFalta[] | null>(null);
  const [instalando, setInstalando] = useState<number | null>(null);
  const buscando = term.length > 0;
  useEffect(() => {
    if (!buscando || faltam) return;
    api<SomQueFalta[]>('/api/packs/sons-que-faltam')
      .then(setFaltam)
      .catch(() => setFaltam([])); // sem a lista, a busca continua com os seus sons
  }, [buscando, faltam]);
  const nosPacotes = term && faltam ? buscarSons(faltam, term).slice(0, 6) : [];

  /*
   * OUVIR ANTES DE INSTALAR, e só aqui. O som do pacote toca neste computador, no volume do soundboard, e não
   * vai para a sala: ninguém mais escuta a pessoa escolhendo. Clicar de novo para; fechar o painel também.
   */
  const [ouvindo, setOuvindo] = useState<number | null>(null);
  const previa = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => previa.current?.pause(), []);
  // A barra de volume vale também para a prévia que já está tocando.
  useEffect(() => {
    if (previa.current) previa.current.volume = settings.soundboardVolume * Number(previa.current.dataset.volumeDoSom ?? 1);
  }, [settings.soundboardVolume]);
  function ouvir(id: number, volumeDoSom = 1) {
    previa.current?.pause();
    if (ouvindo === id) {
      setOuvindo(null);
      return;
    }
    const audio = new Audio(mediaUrl.sound(id));
    audio.dataset.volumeDoSom = String(volumeDoSom);
    audio.volume = settings.soundboardVolume * volumeDoSom;
    audio.addEventListener('ended', () => setOuvindo((atual) => (atual === id ? null : atual)));
    void audio.play().catch(() => setOuvindo(null));
    previa.current = audio;
    setOuvindo(id);
  }

  async function instalar(packId: number) {
    setInstalando(packId);
    try {
      await api(`/api/packs/${packId}/install`, { method: 'POST' });
      await reloadSounds();
      setFaltam((lista) => lista?.filter((s) => s.packId !== packId) ?? null);
    } catch (e) {
      console.error(e);
    }
    setInstalando(null);
  }
  const groups = new Map<string, Sound[]>();
  for (const sound of term ? [] : found.filter((s) => !s.favorite)) {
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

  function tocar(sound: Sound) {
    contarToque(sound.id);
    void voice.playSound(sound.id);
  }

  const grid = (list: Sound[]) => (
    <div className="soundboard-grid">
      {list.map((sound) => (
        <div key={sound.id} className="soundboard-item">
          <button className="soundboard-sound" onClick={() => tocar(sound)}>
            <span className="soundboard-icon">{sound.icon}</span>
            <span className="soundboard-name">{sound.name}</span>
          </button>
          <button
            className={`soundboard-star${sound.favorite ? ' on' : ''}`}
            title={sound.favorite ? t('Tirar dos favoritos') : t('Marcar como favorito')}
            aria-label={sound.favorite ? t('Tirar {nome} dos favoritos', { nome: sound.name }) : t('Marcar {nome} como favorito', { nome: sound.name })}
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
        <button className="soundboard-stop" onClick={() => void voice.stopSounds()} title={t('Parar o som para todos na sala')}>
          <Square size={12} /> {t('Parar')}
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
          aria-label={t('Volume do soundboard')}
          onChange={(e) => updateSettings({ soundboardVolume: Number(e.target.value) })}
        />
      </label>

      {/* SEMPRE À VISTA: desde que a busca também acha sons nos pacotes que você não tem, quem tem poucos
          sons é justamente quem mais precisa dela. Antes ela só aparecia com mais de oito. */}
      <input
        className="soundboard-search"
        value={search}
        placeholder={t('Procurar som')}
        aria-label={t('Procurar som')}
        onChange={(e) => setSearch(e.target.value)}
        // Enter toca o primeiro da lista: digitar "ajdua" e Enter, sem tirar a mão do teclado no meio da partida.
        onKeyDown={(e) => {
          if (e.key === 'Enter' && term && found[0]) tocar(found[0]);
        }}
      />

      {sounds.length === 0 && !adding && (
        <p className="soundboard-empty">
          {t('Nenhum som ainda. Adicione um abaixo, ou instale um pacote em Configurações → Soundboard.')}
        </p>
      )}
      {sounds.length > 0 && found.length === 0 && nosPacotes.length === 0 && <p className="soundboard-empty">{t('Nenhum som com esse nome.')}</p>}

      {term && found.length > 0 && grid(found)}

      {nosPacotes.length > 0 && (
        <>
          <div className="soundboard-group">{t('Pacotes')}</div>
          <div className="soundboard-faltam">
            {nosPacotes.map((som) => (
              <div key={som.id} className="soundboard-falta">
                <span className="soundboard-icon">{som.icon}</span>
                <span className="soundboard-falta-texto">
                  <span className="soundboard-name">{som.name}</span>
                  <small>{som.packName}</small>
                </span>
                <button
                  type="button"
                  className={`icon-plain soundboard-ouvir${ouvindo === som.id ? ' on' : ''}`}
                  aria-label={t('Ouvir')}
                  title={t('Ouvir')}
                  aria-pressed={ouvindo === som.id}
                  onClick={() => ouvir(som.id, som.volume)}
                >
                  {ouvindo === som.id ? <Square size={14} /> : <Play size={14} />}
                </button>
                <button type="button" className="btn-secondary" disabled={instalando !== null} onClick={() => void instalar(som.packId)}>
                  {t('Instalar')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

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
        <button className="soundboard-sound soundboard-add" onClick={() => setAdding(true)} title={t('Adicionar som')}>
          <span className="soundboard-icon">
            <Plus size={20} />
          </span>
          <span className="soundboard-name">{t('Adicionar som')}</span>
        </button>
      )}
      {adding && <SoundboardAddForm communityId={communityId} onDone={() => setAdding(false)} />}
    </div>
  );
}

/** Formulário compacto para gravar um som novo sem sair da chamada, direto no painel do soundboard. */
function SoundboardAddForm({ communityId, onDone }: { communityId: number; onDone: () => void }) {
  const t = useT();
  const { sounds } = useDirectory();
  const [file, setFile] = useState<File | null>(null);
  // O nome de um som que já está no soundboard e parece o mesmo deste (ver somParecido.ts). Só avisa.
  const [parecido, setParecido] = useState<string | null>(null);
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
      setParecido(null);
      void somParecidoCom(chosen, sounds, mediaUrl.sound).then(setParecido);
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
      <SomPorEndereco aoBaixar={(arquivo) => void choose(arquivo)} desligado={busy} />
      <div className="soundboard-add-row">
        <input className="soundboard-add-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} aria-label={t('Ícone')} />
        <input
          className="soundboard-add-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Nome do som')}
          aria-label={t('Nome do som')}
          maxLength={32}
        />
      </div>
      {parecido && <p className="soundboard-parecido">{t('Parece o mesmo som que «{nome}».', { nome: parecido })}</p>}
      {error && <p className="form-error small">{error}</p>}
      <div className="soundboard-add-actions">
        <button className="link-button" onClick={onDone}>
          {t('Cancelar')}
        </button>
        <button className="btn-primary" disabled={!audio || !name.trim() || busy} onClick={() => void submit()}>
          {busy ? 'Enviando…' : 'Enviar som'}
        </button>
      </div>
    </div>
  );
}

/**
 * O "i" no canto da SUA transmissão: em que formato ela está saindo de verdade (não o que foi escolhido
 * nas configurações, mas o que o navegador conseguiu entregar), e quem está segurando a qualidade.
 *
 * QUEM ASSISTE NÃO TEM MAIS "i" (11/10/2026). Ali só restava o "Baixar até" (Automático, Média, Baixa),
 * e ele saiu: para internet ruim o automático já desce de camada sozinho, "Média" e "Baixa" não diziam
 * nada a ninguém, e no Fluido não havia camada para escolher. O único caso real — dados contados no
 * celular — o Syden resolve pelo modo de economia de dados do aparelho (ver qualidadeQueRecebo.ts).
 *
 * ABRE AO PASSAR O MOUSE, igual ao do volume — e o que permitiu isso foi trocar a listinha de opções
 * por botões. Uma listinha (<select>) abre como janela do SISTEMA: enquanto ela está aberta o ponteiro
 * está tecnicamente fora do cartão, que se fecha levando a escolha junto. Botões ficam dentro do
 * cartão, onde o ponteiro alcança — a mesma razão pela qual a régua de volume sempre pôde ser assim.
 * (O vão entre o botão e o cartão, que era o outro motivo de ele fugir, está consertado no CSS.)
 *
 * O QUE ELE NÃO MOSTRA MAIS: o nome do codificador por dentro ("SimulcastEncoderAdapter (libvpx,
 * libvpx, libvpx)"). Isso é informação de quem programa, não de quem assiste. Ficou o que a pessoa
 * reconhece e sobre o que ela pode fazer algo — o formato que chega, se o vídeo passa pela placa ou
 * pelo processador (que é uma escolha nas configurações), e quem está segurando a qualidade.
 */
function StreamInfoBadge({ publication, local }: { publication: TrackPublication | undefined; local: boolean }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  // Sem "i" para quem assiste, nada é medido do lado dele: o cartão não mostraria nada.
  const stats = useStreamStats(publication, { local, active: local });
  const formato = describeStats(stats);
  /*
   * QUEM ASSISTE NÃO RECEBE COMENTÁRIO SOBRE A IMAGEM: nem o número, nem o veredito.
   *
   * O número saiu primeiro ("576p dá sensação de falta de qualidade"). O veredito que entrou no lugar
   * ("Menor que o espaço onde está sendo mostrada. Numa janela menor, fica nítida.") saiu em 05/10/2026:
   * "essa mensagem é inconveniente — não podemos apenas transmitir?". As duas tentativas erraram do
   * mesmo jeito: comentar a imagem para quem não pode fazer nada sobre ela. Para quem assiste o cartão
   * ficava só com o que ele PODE mudar, o teto do que baixar — e quando o teto saiu, o "i" saiu junto.
   * Os números e o diagnóstico seguem para quem transmite, que pode agir sobre eles.
   */
  if (!local) return null;

  return (
    <div className="stream-info" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      <button className="stream-info-button" aria-label={t('Informações da transmissão')} aria-expanded={aberto}>
        <Info size={16} />
      </button>
      {aberto && (
        <div className="stream-info-card" role="tooltip">
          {formato ? (
            <>
              {/*
               * O NÚMERO SAIU DAQUI PARA QUEM ASSISTE, e esta é a terceira volta no mesmo assunto.
               *
               * Primeiro os quadros quebrados ("29 fps" numa transmissão perfeita de 30). Depois a
               * altura solta ("576p, mas está agradável"). Agora: "760p dá impressão de qualidade
               * ruim, pois é resolução de celular — e em tela cheia não virou 1080p. Os usuários
               * acham que está bugado quando vem um número baixo de p."
               *
               * Três relatos, a mesma causa: o número é VERDADEIRO e MUDO. Ele mostra o preço de uma
               * escolha sem nunca mostrar o que ela comprou. O Syden pede ao navegador
               * `maintain-framerate` de propósito (ver SCREEN_HINTS, em useVoice.ts): quando falta
               * banda ou processador, SACRIFICA-SE RESOLUÇÃO PARA SEGURAR OS 30 QUADROS, porque
               * 804p a 7 fps é a pior forma de assistir alguém jogar. "576p · 30 fps" é esse acordo
               * sendo cumprido — e a tela o anunciava como se fosse defeito.
               *
               * Para quem ASSISTE o número não muda decisão nenhuma: o que ele pode fazer é mudar o
               * teto ali embaixo, e para isso o que importa é se a imagem está nítida NO TAMANHO em
               * que ele a vê. É essa a frase que ficou. (O comentário antigo dizia que um seletor
               * sem o número do lado era um chute; estava certo quanto a precisar de referência, e
               * errado quanto a qual — a referência útil é a comparação, não a altura crua.)
               *
               * Para quem TRANSMITE o número continua, porque ali ele é acionável e vem com o
               * diagnóstico do lado.
               */}
              {local && <strong>{formato}</strong>}
              {/* QUEM TRANSMITE VÊ O DIAGNÓSTICO, porque para ele cada linha é acionável — a
                  primeira desfaz uma ambiguidade real (o número é o que sai daqui, não o que os
                  outros recebem depois da adaptação), e a segunda responde a pergunta que fez o
                  automático de codec existir: está pegando a placa de vídeo ou não? */}
              {local && <span>{t('é o que você está enviando')}</span>}
              {local && stats?.codec && (
                <span>
                  {stats.codec}
                  {stats.naPlaca === true
                    ? ' · ' + t('pela placa de vídeo')
                    : stats.naPlaca === false
                      ? ' · ' + t('pelo processador')
                      : ''}
                </span>
              )}
              {local && stats?.limitedBy === 'cpu' && <span className="stream-info-warn">{t('Seu computador está segurando a qualidade.')}</span>}
              {local && stats?.limitedBy === 'bandwidth' && <span className="stream-info-warn">{t('Sua internet está segurando a qualidade.')}</span>}
            </>
          ) : stats?.semPublico ? (
            /* NÃO ESTÁ QUEBRADO, ESTÁ ECONOMIZANDO — mas quem transmite sozinho precisa conseguir
               testar mesmo assim. O botão liga a codificação por quinze segundos: gasto deliberado,
               com hora para acabar, em troca de uma resposta que não existia. */
            <>
              <span>{t('Ninguém abriu a sua transmissão ainda. O Syden só codifica a imagem quando alguém assiste — por isso não há números aqui.')}</span>
              {local && <BotaoDeTeste publication={publication} />}
            </>
          ) : local ? (
            <span>{t('Medindo…')}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * O botão que liga a codificação por um tempo, para quem transmite sozinho conseguir medir.
 *
 * Ele não pergunta nada e não some sozinho no meio: liga, conta os segundos, desliga. Enquanto está
 * ligado, os números aparecem no cartão como se houvesse alguém assistindo — porque, do ponto de
 * vista do computador, há: ele está codificando de verdade. Ver testarCodificacao.ts.
 */
function BotaoDeTeste({ publication }: { publication: TrackPublication | undefined }) {
  const t = useT();
  const [testando, setTestando] = useState(false);
  const desfazer = useRef<(() => void) | null>(null);

  // Sair da tela no meio do teste não pode deixar a codificação ligada: seria um gasto sem dono.
  useEffect(() => () => desfazer.current?.(), []);

  if (testando) return <span>{t('Testando… os números aparecem em instantes.')}</span>;

  return (
    <button
      className="btn-secondary stream-audio-retry"
      onClick={() => {
        setTestando(true);
        desfazer.current = ligarCodificacaoParaTestar(publication as LocalTrackPublication | undefined);
        setTimeout(() => {
          desfazer.current?.();
          desfazer.current = null;
          setTestando(false);
        }, DURACAO_DO_TESTE_MS);
      }}
    >
      {t('Testar a transmissão')}
    </button>
  );
}

/**
 * Som da transmissão: volume próprio, separado da voz da pessoa. Quando a transmissão vem sem som, explica
 * por quê — quase sempre é a caixinha "compartilhar áudio", que passa despercebida na hora de escolher a tela.
 */
function StreamAudio({ voice, publisher }: { voice: Voice; publisher: Participant }) {
  const t = useT();
  /**
   * AQUI É POR PASSAR O MOUSE, e não por clique — ao contrário do cartão do "i".
   *
   * A diferença é o que tem dentro: aqui é uma régua, que o ponteiro alcança sem nada abrir por fora;
   * lá é uma listinha de opções, que abre como janela do sistema e fechava o cartão ao ser clicada.
   * Um botão a mais só para abrir a régua foi tentado e ficou pior: sobrava um meio-círculo solto
   * embaixo da fileira de botões, e o que a pessoa quer ali é mexer no volume, não administrar
   * janelinhas. O que fazia a régua fugir era o VÃO entre o botão e o cartão (ver styles.css).
   */
  const [aberto, setAberto] = useState(false);
  const userId = Number(publisher.identity);
  const [volume, setVolume] = useState(() => getScreenVolume(userId));
  // Reavalia quando o participante publica ou tira faixas (o som pode chegar depois da imagem).
  useParticipantTracks([Track.Source.ScreenShareAudio], publisher.identity);

  /**
   * "TEM SOM" É A PUBLICAÇÃO EXISTIR, e não a faixa já ter chegado. A diferença apareceu com duas
   * transmissões ao mesmo tempo: o som de quem não está sendo assistido não é baixado (ver
   * quemOuvir.ts), então a faixa não existe deste lado — e a tela dizia "esta transmissão está sem
   * som", que é falso, e escondia o controle de volume, que era o que a pessoa queria.
   *
   * Quem publica som é quem sabe se tem som. O resto é o caminho até aqui.
   */
  const publicacaoDeSom = publisher.getTrackPublication(Track.Source.ScreenShareAudio);
  const comSom = Boolean(publicacaoDeSom);
  const somAindaVindo = comSom && !publicacaoDeSom?.track;

  if (publisher.isLocal) {
    if (!comSom) {
      // Sem som é o caso mais comum de todos, e o mais chato: quem transmite não percebe, porque do
      // lado dele o som continua tocando normalmente. Por isso o aviso não é só texto — ele resolve.
      return (
        <div className="stream-audio">
          <span className="stream-audio-warn">
            {/* A FRASE INTEIRA NUMA CHAVE SÓ. Ela estava partida: metade em t() e metade cravada em
                português, porque texto que se mistura com <strong> escapa da busca por texto cravado.
                O negrito no meio custava a outra metade da tradução, e o ícone já dá a ênfase. */}
            <VolumeX size={16} />{' '}
            {t('Sua transmissão está sem som. O navegador só manda o som se você marcar “compartilhar áudio” na janelinha de escolher a tela.')}
          </span>
          {voice.telaCompartilhada && (
            // Janela pelo navegador nunca tem som (nem a caixinha): escolher de novo vai para a tela inteira.
            <button
              className="btn-secondary stream-audio-retry"
              onClick={() => void voice.shareScreen(voice.telaCompartilhada === 'window' && !desktopBridge ? 'monitor' : voice.telaCompartilhada!)}
            >
              {t('Escolher de novo, marcando o som')}
            </button>
          )}
        </div>
      );
    }
    // O navegador não conseguiu tirar as vozes da chamada do som capturado: a sala vai se ouvir.
    if (voice.ecoNaTransmissao) {
      return (
        <div className="stream-audio">
          <span className="stream-audio-warn">
            <VolumeX size={16} /> As vozes desta chamada estão indo junto no som da transmissão. Compartilhe só uma
            aba, ou use o app do Syden, que separa o som do jogo das vozes.
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="stream-audio" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      {/*
        DUAS AÇÕES, DOIS BOTÕES — e o principal é calar.

        Clicar no alto-falante e não acontecer nada é contra o que todo mundo já sabe: num tocador, no
        navegador, no sistema, clicar no alto-falante muda. Aqui ele calava nada: só abria um cartão,
        que ainda por cima fugia do ponteiro. Agora clicar CALA (e o clique seguinte devolve o volume
        que estava, não um 100% no ouvido de quem estava em 40%), e a setinha do lado abre a régua.
      */}
      <button
        className="stream-info-button"
        aria-label={volume > 0 ? t('Calar esta transmissão') : t('Ouvir esta transmissão de novo')}
        aria-pressed={volume === 0}
        onClick={(e) => {
          e.stopPropagation();
          setVolume(alternarMudoDaTela(voice.room, userId));
        }}
      >
        {comSom && volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      {aberto && (
        <div className="stream-info-card">
          {comSom ? (
            <label className="stream-audio-volume">
              {t('Som da transmissão')}: {Math.round(volume * 100)}%
              <input
                type="range"
                min={0}
                /* Até 200%, como em qualquer programa de conversa: som de jogo capturado costuma
                   chegar baixo, e 100% é o som cru, sem reforço nenhum. O caminho que faz isso
                   acontecer de verdade — com um teto antes, para não virar estouro no ouvido — está
                   em voiceVolumes.ts. */
                max={TETO_DA_TRANSMISSAO}
                step={0.05}
                value={volume}
                aria-label={t('Volume da transmissão')}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setVolume(value);
                  setScreenVolume(voice.room, userId, value);
                }}
              />
              {/* O som só é baixado de quem está sendo assistido. Dizer isso é melhor do que um
                  controle que parece não responder. */}
              {somAindaVindo && <small>{t('O som chega quando você abre esta transmissão.')}</small>}
            </label>
          ) : (
            <span>{t('Esta transmissão está sem som. Quem transmite precisa marcar “compartilhar áudio” ao escolher a tela.')}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A transmissão de alguém que você ainda não abriu. Fica como convite de propósito: enquanto ninguém clica,
 * o computador não baixa nem decodifica nada desta tela. Numa sala de cinco pessoas com três transmitindo,
 * é a diferença entre decodificar três vídeos e decodificar nenhum.
 */
function ConviteDeTransmissao({
  trackRef,
  membro,
  onAssistir,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  membro?: VoiceMember;
  onAssistir: () => void;
}) {
  const t = useT();
  useDirectory();
  const nome = nomeNaComunidade(Number(trackRef.participant.identity), trackRef.participant.name || trackRef.participant.identity);
  const oQue = membro?.screenName;

  return (
    <div className="stream-invite">
      <Avatar name={nome} userId={Number(trackRef.participant.identity)} size={44} />
      <strong className="stream-invite-name">{nome}</strong>
      <span className="stream-invite-what">{oQue ? t('está transmitindo {oque}', { oque: oQue }) : t('está transmitindo')}</span>
      <button
        className="btn-primary stream-invite-button"
        title={t('Nada é baixado enquanto você não abrir')}
        onClick={onAssistir}
      >
        <Play size={16} /> {t('Assistir')}
      </button>
    </div>
  );
}

/**
 * O botão de tela cheia — que também SAI da tela cheia.
 *
 * Antes ele só sabia entrar: já em tela cheia, clicar nele chamava `requestFullscreen` de novo, que
 * não faz nada. Quem não conhecia o Esc ficava preso numa tela sem saída visível, com o único botão
 * da tela parecendo quebrado. Um botão que liga precisa desligar.
 *
 * O estado vem do EVENTO do navegador, e não do nosso clique: sair pelo Esc, pelo F11 ou pelo gesto
 * do sistema também tem de trocar o ícone, e nenhum deles passa por aqui.
 */
function BotaoTelaCheia({ alvo }: { alvo: RefObject<HTMLDivElement | null> }) {
  const t = useT();
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    const conferir = () => setCheia(document.fullscreenElement === alvo.current);
    document.addEventListener('fullscreenchange', conferir);
    conferir();
    return () => document.removeEventListener('fullscreenchange', conferir);
  }, [alvo]);

  return (
    <button
      className="fullscreen-button"
      title={cheia ? t('Sair da tela cheia') : t('Tela cheia')}
      aria-label={cheia ? t('Sair da tela cheia') : t('Tela cheia')}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void alvo.current?.requestFullscreen();
      }}
    >
      {cheia ? <Minimize size={18} /> : <Maximize size={18} />}
    </button>
  );
}

/**
 * O QUADRO DE UMA TRANSMISSÃO DE TELA.
 *
 * ===================================================================================================
 * ELE EXISTE POR CAUSA DE UM `?? ` DENTRO DA BIBLIOTECA, e o sintoma foi: "no canto inferior direito
 * tem esse ícone, ele serve pra quê?" — três barrinhas que ninguém no Syden tinha decidido mostrar.
 *
 * O `ParticipantTile` do LiveKit desenha `{children ?? (layout padrão dele)}`. A câmera sempre
 * passou filhos (PersonTile), então o padrão nunca apareceu. A transmissão de tela era
 * `<ParticipantTile trackRef={ref} />`, SEM FILHOS — e aí entrava o layout da biblioteca inteiro:
 *
 *   - o ConnectionQualityIndicator, que são as três barrinhas do canto;
 *   - e `<ParticipantName>'s screen</ParticipantName>`, com o "'s screen" CRAVADO EM INGLÊS dentro
 *     do pacote. Uma tela em português, árabe ou japonês mostrava "crono's screen".
 *
 * Esse segundo é o pior dos dois, e a auditoria de tradução nunca o acharia: ela varre o código do
 * Syden, e esse texto não está nele.
 * ===================================================================================================
 */
function ScreenTile({ trackRef, membro, plateia }: { trackRef: TrackReferenceOrPlaceholder; membro?: VoiceMember; plateia: VoiceMember[] }) {
  useDirectory();
  return (
    <ParticipantTile trackRef={trackRef}>
      {/* A guarda estreita o tipo: um quadro pode ser um lugar reservado, ainda sem faixa. */}
      {isTrackReference(trackRef) && <VideoTrack trackRef={trackRef} />}
      <div className="tile-info">
        <StreamInfoBadge publication={trackRef.publication} local={trackRef.participant.isLocal} />
      </div>
      {/* O nome vem do Syden e é o que ESTÁ SENDO TRANSMITIDO ("Bloodstained"), não um rótulo fixo —
          e, quando ele ainda não chegou, fica o nome de quem transmite. */}
      <div className="tile-name">
        <MonitorPlay size={14} />
        <span>{membro?.screenName || nomeNaComunidade(Number(trackRef.participant.identity), trackRef.participant.name || trackRef.participant.identity)}</span>
        <ContagemDePlateia plateia={plateia} />
      </div>
    </ParticipantTile>
  );
}

/**
 * QUANTAS PESSOAS ESTÃO ASSISTINDO: um olho e o número, ao lado do nome da transmissão; os nomes, ao
 * passar o mouse. Conta quem ABRIU a transmissão (ver o efeito de "assistindo" em useVoice.ts), e não
 * quem só está na sala. Ninguém assistindo, nada aparece: um "0" ao lado da tela de alguém soaria como
 * recado.
 */
function ContagemDePlateia({ plateia }: { plateia: VoiceMember[] }) {
  const t = useT();
  if (plateia.length === 0) return null;
  const rotulo = t('Assistindo: {n}', { n: new Intl.NumberFormat(idiomaAtual()).format(plateia.length) });
  return (
    <span className="contagem-de-plateia" title={`${rotulo}
${plateia.map((m) => nomeNaComunidade(m.userId, m.username)).join(', ')}`} aria-label={rotulo}>
      <Eye size={13} aria-hidden="true" />
      {plateia.length}
    </span>
  );
}

/**
 * Um quadro grande da tela (o que está em foco, ou cada uma quando a tela está dividida): o vídeo,
 * os controles da transmissão e o botão de tela cheia deste quadro.
 */
function FocusPane({
  trackRef,
  voice,
  membro,
  children,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  voice: Voice;
  /** Quem está transmitindo, para saber O QUE está sendo transmitido ("Sea of Thieves"). */
  membro?: VoiceMember;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="stage-main" ref={ref}>
      {children}
      {/*
        O QUE ESTÁ SENDO TRANSMITIDO, escrito em cima da transmissão.
        
        O nome já existia e só aparecia na lista de pessoas, do outro lado da tela — quem chega no meio
        e olha para a imagem não descobre o que está vendo sem procurar. Aqui ele fica onde a pessoa
        está olhando.

        O ÍCONE É NOSSO, e não o do programa transmitido. O do programa existe (o seletor de tela do app
        já o recebe do Windows), mas mandá-lo para a sala inteira seria abrir um caminho de imagem que
        não passa pela conferência de conteúdo — a única imagem no Syden que chegaria à tela de todo
        mundo sem ser checada. Um desenho genérico custa nada e não abre porta nenhuma.
      */}
      {trackRef.source === Track.Source.ScreenShare && (
        <div className="stream-controls">
          <StreamInfoBadge publication={trackRef.publication} local={trackRef.participant.isLocal} />
          <StreamAudio voice={voice} publisher={trackRef.participant} />
          {/* Fechar corta o download na hora: dá para continuar na conversa sem gastar internet com a tela. */}
          {!trackRef.participant.isLocal && (
            <button
              className="stream-info-button"
              title={t('Parar de assistir esta transmissão')}
              aria-label={t('Parar de assistir esta transmissão')}
              onClick={(e) => {
                e.stopPropagation();
                voice.assistir(trackRef.participant.identity, false);
              }}
            >
              <MonitorOff size={16} />
            </button>
          )}
          {/*
            A ETIQUETA MORA DENTRO DA FILEIRA DOS BOTÕES, e não num canto por conta própria.

            Ela tinha `top: 10px; left: 10px` e os botões, `top: 12px; left: 12px` — dois elementos
            mirando o mesmo canto. O resultado foi o nome do jogo aparecendo ATRÁS dos ícones, ilegível,
            e só apareceu quando alguém transmitiu de verdade.

            Sendo item do mesmo flex, a conta de onde ela começa é do navegador, e ela continua certa
            com dois botões (quem transmite) ou três (quem assiste) — que é justamente a diferença que
            um número cravado não sabe acompanhar.
          */}
          {membro?.screenName && (
            <div className="stream-etiqueta">
              <MonitorPlay size={14} />
              <span>{membro.screenName}</span>
            </div>
          )}
        </div>
      )}
      <BotaoTelaCheia alvo={ref} />
    </div>
  );
}

/**
 * AS VOZES DA SALA, MISTURADAS NUMA FAIXA SÓ — para o clipe poder levar a galera junto.
 *
 * POR QUE ELAS NÃO VÊM DE GRAÇA NA TRANSMISSÃO. Quem compartilha a tela captura o som do sistema com
 * `restrictOwnAudio: true`, que tira da captura justamente o que o Syden está tocando — ou seja, as
 * vozes. Isso existe para a sala não se ouvir em eco, e está certo. O efeito colateral é que o clipe
 * só tinha o som do jogo, e metade da graça de um clipe é a reação de quem estava junto.
 *
 * Aqui elas são recolhidas de novo, SÓ PARA A GRAVAÇÃO: nada disto é tocado de volta na chamada, a
 * cadeia termina num destino de gravação e não em `ctx.destination`. Sem alto-falante no caminho, não
 * há eco possível.
 *
 * O MICROFONE DE QUEM CLIPA ENTRA TAMBÉM. Ele não sai pelos alto-falantes de ninguém (o LiveKit não
 * devolve a própria voz), então sem isto o clipe teria todo mundo menos quem gravou — que é o avesso
 * do que se quer.
 */
function useVozesDaSala(room: Room, ligado: boolean): MediaStream | null {
  const [vozes, setVozes] = useState<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!ligado) {
      setVozes(null);
      return;
    }
    const ctx = (ctxRef.current ??= new AudioContext());
    const destino = ctx.createMediaStreamDestination();
    // Guarda quem já está ligado, para não ligar a mesma faixa duas vezes quando um evento repetir.
    const ligadas = new Map<string, MediaStreamAudioSourceNode>();

    const recolher = () => {
      const agora = new Map<string, MediaStreamTrack>();
      for (const pessoa of [room.localParticipant, ...room.remoteParticipants.values()]) {
        const faixa = pessoa.getTrackPublication(Track.Source.Microphone)?.audioTrack?.mediaStreamTrack;
        if (faixa && faixa.readyState === 'live') agora.set(`${pessoa.identity}:${faixa.id}`, faixa);
      }
      for (const [chave, no] of ligadas) {
        if (agora.has(chave)) continue;
        no.disconnect();
        ligadas.delete(chave);
      }
      for (const [chave, faixa] of agora) {
        if (ligadas.has(chave)) continue;
        try {
          const no = ctx.createMediaStreamSource(new MediaStream([faixa]));
          no.connect(destino);
          ligadas.set(chave, no);
        } catch {
          // faixa que o contexto recusou: segue sem ela, o clipe não pode cair por causa disso
        }
      }
    };

    recolher();
    setVozes(destino.stream);
    // Gente entrando, saindo, ligando e desligando o microfone: a lista é refeita a cada mudança.
    const eventos = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
    ] as const;
    for (const evento of eventos) room.on(evento, recolher);
    return () => {
      for (const evento of eventos) room.off(evento, recolher);
      for (const no of ligadas.values()) no.disconnect();
      ligadas.clear();
    };
  }, [room, ligado]);

  useEffect(
    () => () => {
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    },
    [],
  );

  return vozes;
}

/**
 * A transmissão que está na tela, imagem e som no mesmo pacote — é o que o clipe grava. Sem transmissão,
 * devolve null e o botão de clipe nem aparece.
 */
function useTransmissaoNaTela(screen: TrackReferenceOrPlaceholder | undefined) {
  const identity = screen?.participant.identity ?? '';
  const sons = useParticipantTracks([Track.Source.ScreenShareAudio], identity);
  const video = screen && isTrackReference(screen) ? screen.publication.track?.mediaStreamTrack : undefined;
  const somReferencia = sons[0];
  const audio = somReferencia && isTrackReference(somReferencia) ? somReferencia.publication.track?.mediaStreamTrack : undefined;
  return useMemo(() => {
    if (!video) return null;
    return new MediaStream(audio ? [video, audio] : [video]);
  }, [video, audio]);
}

function Stage({
  voice,
  members,
  channelId,
  socket,
  communityId,
  canaisDeTexto,
  aoAbrirVozEVideo,
  simples = false,
  canais,
  aoMandarMensagem,
  aoEditarPerfil,
}: {
  voice: Voice;
  members: VoiceMember[];
  channelId: number;
  /** Por onde chega o aviso de que a partida do mini-game mudou. */
  socket: Socket | null;
  communityId: number;
  canaisDeTexto: Channel[];
  aoAbrirVozEVideo?: () => void;
  /** Modo sala (aula): só microfone, áudio, câmera e sair — o resto do Syden fica de fora. */
  simples?: boolean;
  canais: Channel[];
  aoMandarMensagem?: (userId: number) => void;
  aoEditarPerfil?: () => void;
}) {
  const t = useT();
  const plateia = quemAssiste(members);
  // O MENU DO BOTÃO DIREITO NUM QUADRO (13/10/2026, como no Discord): o mesmo da lista de pessoas, com a parte
  // do palco — a janela flutuante daquele vídeo, e o que o palco mostra.
  const menu = usePersonMenu();
  const [videoDoMenu, setVideoDoMenu] = useState<HTMLVideoElement | null>(null);
  const [perfil, setPerfil] = useState<{ userId: number; x: number; y: number } | null>(null);
  const ajustes = useSettings();
  const { members: daComunidade } = useDirectory();
  const todasAsFaixas = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  // O que o palco mostra (as duas escolhas do menu): sem elas, os cartões de quem está sem câmera e o da sua.
  const tracks = todasAsFaixas.filter((ref) => {
    if (ref.source !== Track.Source.Camera) return true;
    if (!ajustes.mostrarMinhaCamera && ref.participant.isLocal) return false;
    if (!ajustes.mostrarSemVideo && (!ref.publication || ref.publication.isMuted)) return false;
    return true;
  });
  const [pinned, setPinned] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  // O karaokê abre sozinho para todo mundo quando alguém põe uma música.
  const [karaokeOpen, setKaraokeOpen] = useState(false);
  // O mini-game: o painel abre sozinho para quem JOGA (quem começou, quem aceitou o convite) e fecha quando a partida
  // acaba. Quem não respondeu recebe o convite pequeno; quem não joga pode abrir pelo botão e assistir.
  const minijogo = usarMinijogo(channelId, socket);
  const eu = Number(useLocalParticipant().localParticipant.identity);
  const [minijogoAberto, setMinijogoAberto] = useState(false);
  /** O jogo de parceiro (o Termo) aberto no palco, no lugar dos cartões e das transmissões: só para mim. */
  const [siteNoPalco, setSiteNoPalco] = useState<{ nome: string; endereco: string } | null>(null);
  const temPartida = minijogo.partida !== null;
  const participo = souJogador(minijogo.partida);
  useEffect(() => setMinijogoAberto(participo), [participo, temPartida]);
  // Veio da home (o computador do quarto → escolher a sala): a estante de jogos abre assim que entra.
  useEffect(() => {
    if (pegarPedidoDeAbrir(channelId)) setMinijogoAberto(true);
    if (pegarPedidoDeKaraoke(channelId)) setKaraokeOpen(true);
  }, [channelId]);

  const screens = tracks.filter((t) => t.source === Track.Source.ScreenShare);
  /** A sua própria tela você sempre vê; a dos outros, só depois de abrir. */
  const aberta = (ref: TrackReferenceOrPlaceholder) =>
    ref.participant.isLocal || voice.assistindo.has(ref.participant.identity);
  const abertas = screens.filter(aberta);
  // Só faz sentido dividir a tela quando há mais de uma transmissão aberta.
  const splitting = split && abertas.length > 1;

  // Foco: o que o usuário fixou; senão, a primeira transmissão ABERTA. Sem nenhuma aberta não há foco, e a
  // sala fica na grade de cartões — é lá que o convite de cada transmissão aparece.
  const focused = splitting ? undefined : (tracks.find((t) => trackKey(t) === pinned && aberta(t)) ?? abertas[0]);
  const others = splitting ? tracks.filter((t) => !abertas.includes(t)) : focused ? tracks.filter((t) => t !== focused) : tracks;
  const card = cardSize(tracks.length);
  // O clipe segue o que está grande na tela; com a tela dividida, a primeira transmissão.
  const paraClipar = (focused?.source === Track.Source.ScreenShare ? focused : undefined) ?? abertas[0];
  const transmissaoNaTela = useTransmissaoNaTela(paraClipar);
  const quemTransmite = paraClipar ? paraClipar.participant.name || paraClipar.participant.identity : '';
  // A GRAVAÇÃO DO CLIPE MORA AQUI, e não no botão. O botão vive dentro do menu "...", que abre e
  // fecha; a gravação precisa durar enquanto a transmissão existir — é a premissa da função, que é
  // poder clipar uma jogada que JÁ aconteceu. Ver web/src/ClipButton.tsx.
  // As vozes só são recolhidas quando há transmissão para clipar: sem clipe, não há o que gravar.
  const vozesDaSala = useVozesDaSala(voice.room, transmissaoNaTela !== null);
  const clipe = useClipe(transmissaoNaTela, vozesDaSala);

  /** Clicar num quadro fixa ou solta o foco; no modo dividido, volta para o foco naquela tela. */
  const togglePin = (ref: TrackReferenceOrPlaceholder) => {
    if (splitting) {
      setSplit(false);
      setPinned(trackKey(ref));
      return;
    }
    setPinned(focused && trackKey(focused) === trackKey(ref) ? null : trackKey(ref));
  };

  const abrirMenu = (e: React.MouseEvent<HTMLDivElement>, ref: TrackReferenceOrPlaceholder) => {
    const userId = Number(ref.participant.identity);
    if (!Number.isFinite(userId)) return;
    setVideoDoMenu(e.currentTarget.querySelector('video'));
    menu.open(e, userId, ref.participant.name || ref.participant.identity);
  };

  const tile = (ref: TrackReferenceOrPlaceholder, avatarSize: number, naFaixa = false) => {
    // Transmissão que você ainda não abriu vira convite, e clicar nele abre (não fixa).
    if (ref.source === Track.Source.ScreenShare && !aberta(ref)) {
      return (
        <div
          key={trackKey(ref)}
          className="tile"
          onClick={() => voice.assistir(ref.participant.identity, true)}
          onContextMenu={(e) => abrirMenu(e, ref)}
        >
          <ConviteDeTransmissao
            trackRef={ref}
            membro={members.find((m) => String(m.userId) === ref.participant.identity)}
            onAssistir={() => voice.assistir(ref.participant.identity, true)}
          />
        </div>
      );
    }
    return (
    <div key={trackKey(ref)} className="tile" onClick={() => togglePin(ref)} onContextMenu={(e) => abrirMenu(e, ref)}>
      {ref.source === Track.Source.Camera ? (
        <PersonTile
          trackRef={ref}
          member={members.find((m) => String(m.userId) === ref.participant.identity)}
          avatarSize={avatarSize}
          sound={voice.recentSounds.get(ref.participant.identity)}
          musica={voice.karaoke !== null}
          assistindo={plateia.has(Number(ref.participant.identity))}
        />
      ) : (
        <ScreenTile
          trackRef={ref}
          membro={members.find((m) => String(m.userId) === ref.participant.identity)}
          plateia={members.filter((m) => m.assistindo?.includes(Number(ref.participant.identity)))}
        />
      )}
      {/* NA FAIXA DE BAIXO, A TRANSMISSÃO ABERTA TEM UM X. Pedido de 08/10/2026: quem abria uma segunda tela
          via a primeira continuar rodando pequena, baixando vídeo, e o único jeito de fechá-la era trazê-la
          para o quadro grande. O X faz o mesmo que o botão de lá: para de assistir e corta o download. */}
      {naFaixa && ref.source === Track.Source.ScreenShare && !ref.participant.isLocal && (
        <button
          type="button"
          className="tile-fechar"
          title={t('Parar de assistir esta transmissão')}
          aria-label={t('Parar de assistir esta transmissão')}
          onClick={(e) => {
            e.stopPropagation();
            voice.assistir(ref.participant.identity, false);
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
    );
  };

  return (
    <div className="stage" data-lk-theme="default">
      {siteNoPalco ? (
        <SiteNoPalco nome={siteNoPalco.nome} endereco={siteNoPalco.endereco} aoFechar={() => setSiteNoPalco(null)} />
      ) : splitting ? (
        // Todas as transmissões do mesmo tamanho, lado a lado.
        <div className="stage-focus">
          <div className="stage-split">
            {abertas.map((ref) => (
              <FocusPane
                key={trackKey(ref)}
                trackRef={ref}
                voice={voice}
                membro={members.find((m) => String(m.userId) === ref.participant.identity)}
              >
                {tile(ref, 80)}
              </FocusPane>
            ))}
          </div>
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48, true))}</div>}
        </div>
      ) : focused ? (
        <div className="stage-focus">
          <FocusPane
            trackRef={focused}
            voice={voice}
            membro={members.find((m) => String(m.userId) === focused.participant.identity)}
          >
            {tile(focused, 80)}
          </FocusPane>
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48, true))}</div>}
        </div>
      ) : (
        // Sem tela compartilhada: cartões de tamanho fixo, centralizados, como no Discord.
        <div className="stage-cards" style={{ '--card-width': `${card.width}px` } as CSSProperties}>
          {tracks.map((ref) => tile(ref, card.avatar))}
        </div>
      )}

      <CamadaDeEfeitos disparo={voice.disparoVisual} />


      {/* O microfone aberto que manda silêncio (ver microfoneSemSom, em useVoice). Clicar leva direto
          para onde se troca o microfone — o aviso sem caminho só aumentaria a aflição. */}
      {/* O MICROFONE BLOQUEADO NÃO SOME COM UM CLIQUE, ao contrário da faixa de erro comum: enquanto
          ele existir, a pessoa está falando para o nada. Sai sozinho quando o microfone volta. */}
      {voice.microfoneBloqueado && (
        <div className="microfone-bloqueado" role="alert">
          <MicOff size={20} aria-hidden="true" />
          <div className="microfone-bloqueado-texto">
            <strong>{t('Seu microfone está bloqueado: ninguém está te ouvindo.')}</strong>
            <span>
              {voice.microfoneBloqueado === 'sistema'
                ? t('Quem bloqueia é o Windows. Abra Configurações do Windows → Privacidade e segurança → Microfone e ligue o acesso para o navegador.')
                : t('Clique no ícone à esquerda do endereço do site, ative o Microfone, e o Syden liga sozinho.')}
            </span>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void voice.tentarMicrofoneDeNovo()}>
            {t('Tentar de novo')}
          </button>
        </div>
      )}

      {voice.microfoneSemSom && !voice.mutedWarning && !voice.microfoneBloqueado && (
        <button type="button" className="muted-warning microfone-sem-som" role="status" onClick={aoAbrirVozEVideo}>
          <MicOff size={16} /> {t('Seu microfone não está mandando som: ninguém está te ouvindo. Clique para escolher outro.')}
        </button>
      )}

      {voice.mutedWarning && (
        <div className="muted-warning" role="status">
          <MicOff size={16} /> {t('Você está silenciado!')}
        </div>
      )}

      <StartAudio label={t('Clique para ativar o áudio')} className="start-audio" />

      <div className="stage-controls">
        <IconButton
          label={voice.media.muted ? t('Ativar microfone') : t('Silenciar')}
          danger={voice.media.muted}
          onClick={voice.toggleMute}
        >
          {voice.media.muted ? <MicOff /> : <Mic />}
        </IconButton>
        <IconButton label={voice.deafened ? t('Ativar áudio') : t('Desativar áudio')} danger={voice.deafened} onClick={voice.toggleDeafen}>
          {voice.deafened ? <HeadphoneOff /> : <Headphones />}
        </IconButton>
        <IconButton label={voice.media.video ? t('Desligar câmera') : t('Ligar câmera')} active={voice.media.video} onClick={voice.toggleCamera}>
          {voice.media.video ? <Video /> : <VideoOff />}
        </IconButton>
        {!simples && <ScreenShareButton voice={voice} />}
        {!simples && <BotaoMinijogo partida={minijogo.partida} aberto={minijogoAberto} aoAlternar={() => setMinijogoAberto(!minijogoAberto)} />}
        {/*
          Ver lado a lado fica FORA do menu: só aparece quando há mais de uma transmissão aberta, e
          nesse momento é exatamente o que a pessoa quer fazer. Botão que só existe quando é útil não
          polui nada.
        */}
        {!simples && abertas.length > 1 && (
          <IconButton
            label={split ? t('Focar em uma transmissão') : t('Ver as {n} transmissões lado a lado', { n: abertas.length })}
            active={split}
            onClick={() => setSplit(!split)}
          >
            <LayoutGrid />
          </IconButton>
        )}

        {!simples && (
        <MaisNaChamada quantosAtivos={voice.voiceEffect !== 'none' ? 1 : 0}>
          <VoiceEffectButton voice={voice} />
          <EfeitoVisualButton voice={voice} />
          <ClipButton clipe={clipe} />
          <div className="soundboard-anchor">
            <IconButton
              label="Karaokê"
              active={karaokeOpen || voice.karaoke !== null}
              onClick={() => setKaraokeOpen(!karaokeOpen)}
            >
              <Music />
            </IconButton>
          </div>
        <div className="soundboard-anchor">
          <IconButton label="Soundboard" active={soundboardOpen} onClick={() => setSoundboardOpen(!soundboardOpen)}>
            <AudioLines />
          </IconButton>
          </div>
        </MaisNaChamada>
        )}

        {/*
          Os painéis do karaokê e do soundboard ficam FORA do menu "Mais", mesmo sendo abertos por
          botões que estão dentro dele: assim nada do que eles mostram depende de o menu continuar
          aberto. A prévia do clipe faltava nesta lista, e era a razão de a tesoura não fazer nada —
          ela abria dentro do menu, que naquela época se fechava a qualquer clique e a levava junto.
          Hoje o menu não se fecha mais sozinho (ver MaisNaChamada.tsx), e mesmo assim o lugar certo
          destes três é aqui: o que abre uma tela não deve viver dentro de uma gaveta.
        */}
        {(karaokeOpen || voice.karaoke !== null) && (
          <Karaoke voice={voice} communityId={communityId} onClose={() => setKaraokeOpen(false)} />
        )}
        {soundboardOpen && <Soundboard voice={voice} communityId={communityId} onClose={() => setSoundboardOpen(false)} />}
        {!minijogoAberto && minijogo.partida && convitePendente(minijogo.partida) && (
          <ConviteDoMinijogo
            partida={minijogo.partida}
            aoResponder={minijogo.responder}
            aoAgir={minijogo.agir}
            aoAbrir={() => setMinijogoAberto(true)}
          />
        )}
        {minijogoAberto && (
          <PainelDoMinijogo
            partida={minijogo.partida}
            eu={eu}
            podeEncerrar={minijogo.partida?.criadaPor === eu}
            aoComecar={minijogo.comecar}
            aoAgir={minijogo.agir}
            aoEncerrar={minijogo.encerrar}
            aoResponder={minijogo.responder}
            aoLargar={minijogo.largar}
            aoFechar={() => setMinijogoAberto(false)}
            socket={socket}
            channelId={channelId}
            aoAbrirSite={(site) => {
              setSiteNoPalco(site);
              setMinijogoAberto(false);
            }}
          />
        )}
        <PreviaDoClipe clipe={clipe} de={quemTransmite} canais={canaisDeTexto} />

        <button className="leave-button" title={t('Desconectar')} onClick={voice.leave}>
          <PhoneOff />
        </button>
      </div>
      {menu.target && (
        <PersonMenu
          target={menu.target}
          onClose={menu.close}
          voice={voice}
          role={daComunidade.get(eu)?.role ?? 'member'}
          channelId={voice.channelId}
          communityId={communityId}
          channels={canais}
          inVoiceChannel={channelId}
          targetScreen={members.find((m) => m.userId === menu.target!.userId)?.screen ?? false}
          targetRole={daComunidade.get(menu.target.userId)?.role ?? 'member'}
          isSelf={menu.target.userId === eu}
          onWatchStream={(_, userId) => voice.assistir(String(userId), true)}
          onSendMessage={(userId) => aoMandarMensagem?.(userId)}
          onOpenProfile={(userId, x, y) => setPerfil({ userId, x, y })}
          palco={{
            aoJanelaFlutuante:
              videoDoMenu && document.pictureInPictureEnabled ? () => void videoDoMenu.requestPictureInPicture().catch(() => {}) : undefined,
            semVideo: ajustes.mostrarSemVideo,
            aoAlternarSemVideo: () => updateSettings({ mostrarSemVideo: !ajustes.mostrarSemVideo }),
            minhaCamera: ajustes.mostrarMinhaCamera,
            aoAlternarMinhaCamera: () => updateSettings({ mostrarMinhaCamera: !ajustes.mostrarMinhaCamera }),
            // A imagem do momento, para a denúncia de transmissão: o quadro que quem denuncia está vendo agora.
            quadroDoVideo: videoDoMenu ? () => quadroDoVideo(videoDoMenu) : undefined,
          }}
        />
      )}
      {perfil && daComunidade.get(perfil.userId) && (
        <ProfileCard
          membro={daComunidade.get(perfil.userId)!}
          status={undefined}
          x={perfil.x}
          y={perfil.y}
          isSelf={perfil.userId === eu}
          onClose={() => setPerfil(null)}
          onSendMessage={(userId) => aoMandarMensagem?.(userId)}
          aoEditar={aoEditarPerfil}
        />
      )}
    </div>
  );
}
