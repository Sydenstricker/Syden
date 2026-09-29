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
import { type LocalTrackPublication, type Participant, type Room, Track, type TrackPublication } from 'livekit-client';
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
} from 'lucide-react';
import { useMemo, type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
import { reloadSounds, useDirectory } from './directory';
import { chave, useT } from './i18n';
import { DURACAO_DO_TESTE_MS, ligarCodificacaoParaTestar } from './testarCodificacao';
import { IconButton } from './IconButton';
import { MobileBackButton } from './MobileBackButton';
import { QualityAdvisor } from './QualityAdvisor';
import { ClipButton } from './ClipButton';
import type { Socket } from 'socket.io-client';
import { BotaoDestacar } from './BotaoDestacar';
import { BotaoApresentacao, FaixaDoPalco, usarPalco } from './Palco';
import { Karaoke } from './Karaoke';
import { ScreenShareButton } from './ScreenShareButton';
import { CamadaDeEfeitos } from './CamadaDeEfeitos';
import { EfeitoVisualButton } from './EfeitoVisualButton';
import { MaisNaChamada } from './MaisNaChamada';
import { VoiceEffectButton } from './VoiceEffectButton';
import { type QualidadeQueRecebo, updateSettings, useSettings } from './settings';
import { describeStats, useStreamStats } from './streamStats';
import { prepareSound } from './upload';
import { stopAllSounds } from './soundboard';
import { aplicarTetoEmTodas } from './qualidadeQueRecebo';
import { alternarMudoDaTela, getScreenVolume, setScreenVolume, TETO_DA_TRANSMISSAO } from './voiceVolumes';
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
  canaisDeTexto,
  onMobileBack,
  membersOpen,
  onToggleMembers,
  sessao,
  aoAlternarSessao,
  socket,
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
  /** Por onde chegam os avisos de quem ganhou ou perdeu a palavra na apresentação. */
  socket: Socket | null;
}) {
  const { estado: palco } = usarPalco(channel.type === 'voice' ? channel.id : null, socket);
  const inThisRoom = voice.channelId === channel.id;
  const alguemTransmitindo = members.some((m) => m.screen);

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
        {/*
          O botão da sessão só existe quando ALGUÉM ESTÁ TRANSMITINDO. Sem transmissão não há o que
          assistir junto, e um "Assistir junto" que não faz nada ensina a ignorar o botão.
        */}
        {/* Apresentar só faz sentido para quem administra, e só numa sala de voz. */}
        {palco?.souApresentador && <BotaoApresentacao channelId={channel.id} estado={palco} />}
        {inThisRoom && alguemTransmitindo && (
          <button
            className={`header-toggle${sessao ? ' active' : ''}`}
            title={sessao ? 'Sair do modo sessão' : 'Assistir junto: vídeo grande e conversa ao lado'}
            aria-label={sessao ? 'Sair do modo sessão' : 'Assistir junto'}
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
        <Stage voice={voice} members={members} communityId={channel.communityId ?? 0} canaisDeTexto={canaisDeTexto} />
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
        <button className="soundboard-stop" onClick={stopAllSounds} title={t('Parar o que está tocando aqui')}>
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
      {sounds.length > 0 && found.length === 0 && <p className="soundboard-empty">{t('Nenhum som com esse nome.')}</p>}

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
  const t = useT();
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
 * O "i" no canto da transmissão: em que formato ela está chegando de verdade (não o que foi escolhido
 * nas configurações, mas o que o navegador conseguiu entregar) e até quanto você quer baixar.
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
function StreamInfoBadge({
  publication,
  local,
  voice,
}: {
  publication: TrackPublication | undefined;
  local: boolean;
  /** Só o quadro grande de uma transmissão passa a sala — é onde escolher o teto de qualidade cabe. */
  voice?: Voice;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const stats = useStreamStats(publication, { local });
  const formato = describeStats(stats);

  return (
    <div className="stream-info" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      <button className="stream-info-button" aria-label={t('Informações da transmissão')} aria-expanded={aberto}>
        <Info size={16} />
      </button>
      {aberto && (
        <div className="stream-info-card" role="tooltip">
          {formato ? (
            <>
              <strong>{formato}</strong>
              {/* QUEM ASSISTE VÊ SÓ O NÚMERO: nada ali muda uma decisão de quem está só vendo.
                  QUEM TRANSMITE VÊ O DIAGNÓSTICO, porque para ele cada linha é acionável — a
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
          ) : (
            <span>{t('Medindo…')}</span>
          )}
          {!local && voice && <TetoDeQualidade room={voice.room} />}
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
 * O TETO DO QUE VOCÊ BAIXA — a escolha de quem ASSISTE, que não existia.
 *
 * Quem transmite escolhia o que mandar; quem assiste, nada. Numa sala com alguém transmitindo em
 * 1080p, todo mundo baixa 1080p — inclusive quem está no celular, olhando um quadro pequeno e pagando
 * por megabyte. A qualidade automática acompanha o TAMANHO do quadro na tela, e isso não é a mesma
 * coisa que acompanhar a conta do mês.
 *
 * Fica junto do "i" de propósito: ali ao lado está escrito o que está chegando de verdade
 * ("804p · 29 fps"), então a pessoa escolhe e vê o resultado no mesmo lugar. Um seletor de qualidade
 * sem o número do lado é um chute.
 *
 * A escolha é sua e vale para TODAS as transmissões, agora e nas próximas: é uma preferência do
 * aparelho, não desta sala. Ver qualidadeQueRecebo.ts.
 */
/**
 * As três opções, com o número de cada uma na explicação.
 *
 * "Alta, média e baixa" não diz nada a quem quer decidir: a pergunta real é "quantos megabytes isso
 * me custa" ou "cabe na minha internet?", e a resposta disso é resolução e quadros. Os números saem
 * das camadas que o Syden publica (SCREEN_LAYERS em useVoice.ts) — se elas mudarem lá, mudam aqui.
 *
 * O "até" é literal e importa: quem transmite pode ter publicado menos do que isso (na qualidade
 * Leve só existe a camada de 360p), e aí pedir mais devolve o que existe. Este controle põe um TETO,
 * não um piso.
 */
const OPCOES_DE_QUALIDADE: [QualidadeQueRecebo, string, string][] = [
  ['auto', chave('Automático'), chave('A melhor que couber no tamanho da janela e na sua internet.')],
  ['media', chave('Média'), chave('Até 720p · 30 quadros por segundo.')],
  ['baixa', chave('Baixa'), chave('Até 360p · 15 quadros por segundo. Gasta menos internet.')],
];

function TetoDeQualidade({ room }: { room: Room }) {
  const t = useT();
  const settings = useSettings();

  return (
    <div className="stream-qualidade">
      <span>{t('Baixar até')}</span>
      {/* BOTÕES, E NÃO UMA LISTINHA. Ver o comentário no alto do StreamInfoBadge: listinha abre como
          janela do sistema e fecharia o cartão ao ser clicada. E de quebra as três opções ficam à
          vista, em vez de escondidas atrás de um clique. */}
      <div className="stream-qualidade-opcoes" role="group" aria-label={t('Baixar até')}>
        {OPCOES_DE_QUALIDADE.map(([valor, rotulo, explicacao]) => (
          <button
            key={valor}
            type="button"
            className={settings.qualidadeQueRecebo === valor ? 'escolhida' : ''}
            aria-pressed={settings.qualidadeQueRecebo === valor}
            title={t(explicacao)}
            onClick={() => {
              updateSettings({ qualidadeQueRecebo: valor });
              aplicarTetoEmTodas(room, valor);
            }}
          >
            {t(rotulo)}
          </button>
        ))}
      </div>
    </div>
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
            <button className="btn-secondary stream-audio-retry" onClick={() => void voice.shareScreen(voice.telaCompartilhada!)}>
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
  const nome = trackRef.participant.name || trackRef.participant.identity;
  const oQue = membro?.screenName;

  return (
    <div className="stream-invite">
      <Avatar name={nome} userId={Number(trackRef.participant.identity)} size={44} />
      <strong className="stream-invite-name">{nome}</strong>
      <span className="stream-invite-what">{oQue ? `está transmitindo ${oQue}` : 'está transmitindo'}</span>
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
      {trackRef.source === Track.Source.ScreenShare && membro?.screenName && (
        <div className="stream-etiqueta">
          <MonitorPlay size={14} />
          <span>{membro.screenName}</span>
        </div>
      )}
      {trackRef.source === Track.Source.ScreenShare && (
        <div className="stream-controls">
          <StreamInfoBadge publication={trackRef.publication} local={trackRef.participant.isLocal} voice={voice} />
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
        </div>
      )}
      <BotaoTelaCheia alvo={ref} />
    </div>
  );
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
  communityId,
  canaisDeTexto,
}: {
  voice: Voice;
  members: VoiceMember[];
  communityId: number;
  canaisDeTexto: Channel[];
}) {
  const t = useT();
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
  // O karaokê abre sozinho para todo mundo quando alguém põe uma música.
  const [karaokeOpen, setKaraokeOpen] = useState(false);

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

  /** Clicar num quadro fixa ou solta o foco; no modo dividido, volta para o foco naquela tela. */
  const togglePin = (ref: TrackReferenceOrPlaceholder) => {
    if (splitting) {
      setSplit(false);
      setPinned(trackKey(ref));
      return;
    }
    setPinned(focused && trackKey(focused) === trackKey(ref) ? null : trackKey(ref));
  };

  const tile = (ref: TrackReferenceOrPlaceholder, avatarSize: number) => {
    // Transmissão que você ainda não abriu vira convite, e clicar nele abre (não fixa).
    if (ref.source === Track.Source.ScreenShare && !aberta(ref)) {
      return (
        <div key={trackKey(ref)} className="tile" onClick={() => voice.assistir(ref.participant.identity, true)}>
          <ConviteDeTransmissao
            trackRef={ref}
            membro={members.find((m) => String(m.userId) === ref.participant.identity)}
            onAssistir={() => voice.assistir(ref.participant.identity, true)}
          />
        </div>
      );
    }
    return (
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
  };

  return (
    <div className="stage" data-lk-theme="default">
      {splitting ? (
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
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48))}</div>}
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
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48))}</div>}
        </div>
      ) : (
        // Sem tela compartilhada: cartões de tamanho fixo, centralizados, como no Discord.
        <div className="stage-cards" style={{ '--card-width': `${card.width}px` } as CSSProperties}>
          {tracks.map((ref) => tile(ref, card.avatar))}
        </div>
      )}

      <CamadaDeEfeitos disparo={voice.disparoVisual} />

      <QualityAdvisor voice={voice} />

      {voice.mutedWarning && (
        <div className="muted-warning" role="status">
          <MicOff size={16} /> {t('Você está silenciado!')}
        </div>
      )}

      <StartAudio label="Clique para ativar o áudio" className="start-audio" />

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
        <ScreenShareButton voice={voice} />
        {/*
          Ver lado a lado fica FORA do menu: só aparece quando há mais de uma transmissão aberta, e
          nesse momento é exatamente o que a pessoa quer fazer. Botão que só existe quando é útil não
          polui nada.
        */}
        {abertas.length > 1 && (
          <IconButton
            label={split ? 'Focar em uma transmissão' : `Ver as ${abertas.length} transmissões lado a lado`}
            active={split}
            onClick={() => setSplit(!split)}
          >
            <LayoutGrid />
          </IconButton>
        )}

        <MaisNaChamada quantosAtivos={voice.voiceEffect !== 'none' ? 1 : 0}>
          <VoiceEffectButton voice={voice} />
          <EfeitoVisualButton voice={voice} />
          <ClipButton stream={transmissaoNaTela} de={quemTransmite} canais={canaisDeTexto} />
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

        {/*
          Os painéis do karaokê e do soundboard ficam FORA do menu "Mais", mesmo sendo abertos por
          botões que estão dentro dele. Se ficassem dentro, sumiriam junto com o menu no primeiro
          clique — e o menu se fecha ao clicar em qualquer coisa, que é o comportamento certo para ele.
        */}
        {(karaokeOpen || voice.karaoke !== null) && (
          <Karaoke voice={voice} communityId={communityId} onClose={() => setKaraokeOpen(false)} />
        )}
        {soundboardOpen && <Soundboard voice={voice} communityId={communityId} onClose={() => setSoundboardOpen(false)} />}

        <button className="leave-button" title={t('Desconectar')} onClick={voice.leave}>
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
