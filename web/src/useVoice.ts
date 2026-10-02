import {
  ConnectionState,
  type LocalParticipant,
  type Participant,
  type RemoteParticipant,
  Room,
  RoomEvent,
  AudioPresets,
  ScreenSharePresets,
  Track,
  type TrackPublication,
  VideoPreset,
  VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { getDirectory } from './directory';
import { type ScreenQuality, getSettings, updateSettings } from './settings';
import { playSoundboard, stopAllSounds } from './soundboard';
import { nomeDaTransmissao } from './streamName';
import { aplicarTetoEmTodas } from './qualidadeQueRecebo';
import { applyAllVolumes, idsComVolumeAjustado } from './voiceVolumes';
import { type Fonte, lembrarFalantes, quemOuvir, queroEstaFaixa } from './quemOuvir';
import { SCALE_STEPS, type AutoQuality, type StreamStats, nextQuality } from './streamStats';
import { filaUltimaVale } from './fila';
import { desktopBridge } from './desktop';
import { escolherCodecDaTela } from './escolherCodec';
import { ehEfeitoVisual, type EfeitoVisualId } from './efeitosVisuais';
import type { DisparoVisual } from './CamadaDeEfeitos';
import { VoiceEffectProcessor, type VoiceEffectId } from './voiceEffects';
import { type AppAudio, captureAppAudio } from './screenAudio';
import { definirSurdez, sounds } from './sounds';

export interface LocalMedia {
  muted: boolean;
  video: boolean;
  screen: boolean;
}

function readLocalMedia(lp: LocalParticipant): LocalMedia {
  return { muted: !lp.isMicrophoneEnabled, video: lp.isCameraEnabled, screen: lp.isScreenShareEnabled };
}

// Qualidade do compartilhamento de tela escolhida nas configurações.
export const SCREEN_PRESETS: Record<ScreenQuality, VideoPreset> = {
  light: ScreenSharePresets.h720fps30, // até 2 Mbps
  standard: ScreenSharePresets.h1080fps30, // até 5 Mbps
  smooth: new VideoPreset(1920, 1080, 8_000_000, 60), // jogos; até 8 Mbps
};

/**
 * Quando falta banda ou processador, o navegador precisa escolher o que sacrificar: nitidez ou fluidez.
 *
 * O PADRÃO ESCOLHIA NITIDEZ, e era a escolha errada para o que as pessoas fazem aqui. Com "balanced" e
 * "detail", um jogo apertado virava 804p a 7 QUADROS POR SEGUNDO — uma sequência de fotos nítidas, que
 * é a pior forma possível de assistir alguém jogar. O mesmo aperto com "maintain-framerate" dá 720p ou
 * 540p a 30 fps, que é fluido e continua perfeitamente legível.
 *
 * Nitidez acima de tudo continua existindo, mas onde ela faz sentido: em "Leve", que é a opção de quem
 * está mostrando planilha, slide ou código, onde ler a letra importa mais do que o movimento.
 */
const SCREEN_HINTS: Record<ScreenQuality, { contentHint: 'motion' | 'detail'; degradation: RTCDegradationPreference }> = {
  light: { contentHint: 'detail', degradation: 'maintain-resolution' },
  standard: { contentHint: 'motion', degradation: 'maintain-framerate' },
  smooth: { contentHint: 'motion', degradation: 'maintain-framerate' },
};

/**
 * Camadas da transmissão de tela ("simulcast"): a mesma tela sai em dois ou três tamanhos ao mesmo tempo, e
 * o servidor entrega a cada pessoa só o tamanho que ela está de fato mostrando na tela — quem tem a
 * transmissão numa miniatura da fileira de baixo pede a pequena, quem está em tela cheia pede a grande.
 *
 * Sem isso existe uma camada só, a maior, e aí o adaptiveStream/dynacast não têm o que escolher: todo mundo
 * baixa e decodifica 1080p para ver um quadradinho de 200 pixels. As camadas que ninguém pede não são nem
 * codificadas, então elas não custam processador de graça para quem transmite.
 */
/**
 * As camadas extras que cada qualidade publica, além da principal.
 *
 * CADA CAMADA É UMA CODIFICAÇÃO A MAIS NA MÁQUINA DE QUEM TRANSMITE, e é aí que está o preço. O
 * servidor não recodifica nada (é o que o mantém barato): se quem assiste vai poder escolher entre
 * três tamanhos, quem transmite tem de mandar os três. Em software, três codificações de 1080p60 é
 * mais do que muita máquina aguenta — e o sintoma aparece do lado errado, na tela de quem assiste,
 * enquanto o jogo continua liso para quem joga.
 *
 * NO MODO FLUIDO NÃO HÁ CAMADA NENHUMA, e essa é a mudança: quem escolhe "para jogos, 60 quadros"
 * está dizendo que a máquina é o gargalo. Cobrar dela mais duas codificações para dar opção aos
 * outros é cobrar do lado errado. Ali vai uma imagem só, a melhor, e quem assiste recebe o que ela é.
 *
 * Nos outros dois modos as camadas ficam: no Padrão elas são o que permite a alguém no celular pagar
 * menos internet sem estragar a transmissão de quem está no computador, e a conta cabe. No Leve, a
 * única camada extra é pequena de propósito — é o modo de quem já tem pouca máquina.
 */
const SCREEN_LAYERS: Record<ScreenQuality, VideoPreset[]> = {
  light: [new VideoPreset(640, 360, 400_000, 15)],
  standard: [new VideoPreset(640, 360, 400_000, 15), new VideoPreset(1280, 720, 2_000_000, 30)],
  smooth: [],
};

// De quanto em quanto tempo a otimização dinâmica confere como a transmissão está indo.
const SCREEN_CHECK_MS = 4000;

const SOUNDBOARD_TOPIC = 'soundboard';
/** Avisos do karaokê: começar e parar a música, para todos ao mesmo tempo. */
const KARAOKE_TOPIC = 'karaoke';
// Confete, fogos e corações. Vão pelo mesmo caminho do soundboard: aviso pequeno, cada um desenha o seu.
const EFEITO_TOPIC = 'efeito-visual';
const SEND_COOLDOWN_MS = 1500;
const RECEIVE_COOLDOWN_MS = 1000;
const SOUND_BADGE_MS = 2500;

function isCancelledPicker(error: unknown) {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

/**
 * Conta ao servidor um problema que só acontece no computador da pessoa (microfone bloqueado, voz barrada
 * pela rede). Vira uma linha no diário da aba de saúde, e é assim que o administrador descobre o que houve
 * sem precisar perguntar. Falhar aqui não pode atrapalhar nada, então o erro é engolido.
 */
function reportProblem(kind: 'microfone' | 'câmera' | 'conexão' | 'efeito de voz', message: string) {
  void api('/api/client-errors', { method: 'POST', body: { kind, message } }).catch(() => {});
}

/**
 * O navegador diz por que o microfone (ou a câmera) não abriu, e cada motivo tem uma saída diferente.
 * Sem isso, todo problema virava "libere a permissão", o que não ajuda quem tem o aparelho ocupado por
 * outro programa, por exemplo.
 */
function deviceErrorMessage(error: unknown, device: 'microfone' | 'câmera') {
  const name = error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Sem acesso ao ${device}: o navegador bloqueou. Clique no cadeado na barra de endereço, permita o ${device} e tente de novo.`;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `Nenhum ${device} encontrado. Ligue o aparelho e confira se ele aparece em Configurações → Voz e vídeo.`;
    case 'NotReadableError':
    case 'AbortError':
      return `O ${device} está ocupado por outro programa (jogo, Discord, OBS). Feche o outro programa ou escolha outro aparelho em Configurações → Voz e vídeo.`;
    default:
      return `Não foi possível usar o ${device}. Tente escolher outro aparelho em Configurações → Voz e vídeo.`;
  }
}

export type Voice = ReturnType<typeof useVoice>;

/**
 * Mantém uma única conexão com o LiveKit que sobrevive à navegação entre canais (como no Discord),
 * e espelha o estado local (mudo, câmera, tela) no servidor para a barra lateral de todos.
 */
export function useVoice(socket: Socket | null) {
  const [room] = useState(() => {
    const settings = getSettings();
    return new Room({
      adaptiveStream: true, // só baixa a resolução que o elemento de vídeo realmente mostra
      dynacast: true, // pausa camadas de vídeo que ninguém está assistindo
      audioCaptureDefaults: {
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: true,
        deviceId: settings.audioInput || undefined,
      },
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution, deviceId: settings.videoInput || undefined },
      audioOutput: settings.audioOutput ? { deviceId: settings.audioOutput } : undefined,
      publishDefaults: {
        screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
        screenShareSimulcastLayers: SCREEN_LAYERS[settings.screenQuality],
        dtx: true,
        red: true,
      },
    });
  });
  const [channelId, setChannelId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  // O que está sendo transmitido agora, em palavras ("League of Legends"), para os outros verem.
  const nomeDaTelaRef = useRef<string | null>(null);
  const [media, setMedia] = useState<LocalMedia>({ muted: false, video: false, screen: false });
  // A transmissão está levando as vozes da chamada junto? Quando sim, a tela avisa quem transmite.
  const [ecoNaTransmissao, setEcoNaTransmissao] = useState(false);
  // O que foi escolhido da última vez (tela, janela, aba). Serve para o aviso de "saiu sem som"
  // poder abrir o seletor de novo na mesma opção, em vez de mandar a pessoa procurar o menu.
  const [telaCompartilhada, setTelaCompartilhada] = useState<'monitor' | 'window' | 'browser' | null>(null);
  // O último efeito visual pedido na sala, por quem quer que seja. A tela desenha e ele fica: a
  // chave é o que faz o MESMO efeito, clicado duas vezes seguidas, valer as duas.
  const [disparoVisual, setDisparoVisual] = useState<DisparoVisual | null>(null);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // O modificador de voz vale SÓ NA CHAMADA EM QUE FOI ESCOLHIDO. Antes ele ficava guardado, e a
  // pessoa entrava na sala seguinte com a voz de esquilo de ontem sem lembrar que tinha ligado — e
  // sem entender por que estava saindo assim. Ao entrar, é sempre a voz da pessoa.
  const [voiceEffect, setVoiceEffectState] = useState<VoiceEffectId>('none');
  // Dá para silenciar antes de entrar numa sala: a escolha fica guardada e vale ao entrar na próxima.
  const [wantMuted, setWantMuted] = useState(() => getSettings().startMuted);
  const [wantDeafened, setWantDeafened] = useState(() => getSettings().startDeafened);
  // "Você está silenciado!": true por alguns segundos quando a pessoa fala com o microfone mudo.
  const [mutedWarning, setMutedWarning] = useState(false);

  // Refs para os handlers de eventos lerem o valor atual sem precisar se reinscrever.
  const channelRef = useRef<number | null>(null);
  // O efeito que escuta o LiveKit é montado uma vez só; esta ref deixa ele chamar a versão atual.
  const stopAppAudioRef = useRef<() => void>(() => {});
  const deafenedRef = useRef(false);
  const socketRef = useRef(socket);
  socketRef.current = socket;

  useEffect(() => {
    const lp = room.localParticipant;
    const sync = () => {
      const next = readLocalMedia(lp);
      // A transmissão pode acabar por fora (barra do Windows, botão do navegador): o som vai junto.
      if (!next.screen) {
        stopAppAudioRef.current();
        nomeDaTelaRef.current = null;
        setEcoNaTransmissao(false);
      }
      setMedia(next);
      if (channelRef.current !== null) {
        socketRef.current?.emit('voice:update', { ...next, screenName: next.screen ? nomeDaTelaRef.current : null });
      }
    };
    const syncIfLocal = (_: TrackPublication, participant: Participant) => {
      if (participant === lp) sync();
    };
    const onDisconnected = () => {
      stopAllSounds(); // som de soundboard é da sala: não acompanha quem saiu
      if (channelRef.current !== null) socketRef.current?.emit('voice:leave');
      channelRef.current = null;
      deafenedRef.current = false;
      definirSurdez(false);
      setAssistindo(new Set()); // transmissão aberta é coisa daquela sala
      setChannelId(null);
      setDeafened(false);
      setMedia(readLocalMedia(lp));
    };

    room
      .on(RoomEvent.LocalTrackPublished, sync)
      .on(RoomEvent.LocalTrackUnpublished, sync)
      .on(RoomEvent.TrackMuted, syncIfLocal)
      .on(RoomEvent.TrackUnmuted, syncIfLocal)
      .on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room
        .off(RoomEvent.LocalTrackPublished, sync)
        .off(RoomEvent.LocalTrackUnpublished, sync)
        .off(RoomEvent.TrackMuted, syncIfLocal)
        .off(RoomEvent.TrackUnmuted, syncIfLocal)
        .off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  // Volume que você escolheu para cada pessoa, e o teto de qualidade que você escolheu receber, valem
  // de novo sempre que alguém chega, volta a falar ou começa a transmitir.
  useEffect(() => {
    const restore = () => {
      applyAllVolumes(room);
      aplicarTetoEmTodas(room);
    };
    room
      .on(RoomEvent.ParticipantConnected, restore)
      .on(RoomEvent.TrackSubscribed, restore)
      .on(RoomEvent.Connected, restore);
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, restore)
        .off(RoomEvent.TrackSubscribed, restore)
        .off(RoomEvent.Connected, restore);
    };
  }, [room]);

  // Sons de aviso, como no Discord: alguém entrou, saiu ou começou a compartilhar a tela.
  useEffect(() => {
    // Ao sairmos, o LiveKit remove os outros participantes da memória; isso não é "alguém saiu".
    const onParticipantLeft = () => {
      if (room.state === ConnectionState.Connected) sounds.userLeave();
    };
    const onPublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) sounds.screenShareStart();
    };
    room
      .on(RoomEvent.ParticipantConnected, sounds.userJoin)
      .on(RoomEvent.ParticipantDisconnected, onParticipantLeft)
      .on(RoomEvent.TrackPublished, onPublished)
      .on(RoomEvent.LocalTrackPublished, onPublished);
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, sounds.userJoin)
        .off(RoomEvent.ParticipantDisconnected, onParticipantLeft)
        .off(RoomEvent.TrackPublished, onPublished)
        .off(RoomEvent.LocalTrackPublished, onPublished);
    };
  }, [room]);

  // Soundboard: o ícone do som aparece por alguns segundos no quadro de quem tocou.
  const [recentSounds, setRecentSounds] = useState<Map<string, { icon: string; key: number }>>(new Map());
  // O karaokê tocando agora na sala: a música, quem pôs e quando começou. O áudio não viaja pela
  // chamada — cada computador toca a própria cópia, como o soundboard.
  const [karaoke, setKaraoke] = useState<{ songId: number; quem: string; comecouEm: number } | null>(null);
  const lastSentRef = useRef(0);
  const lastHeardRef = useRef(new Map<string, number>());

  const showSound = useCallback((identity: string, icon: string) => {
    const key = Date.now() + Math.random();
    setRecentSounds((map) => new Map(map).set(identity, { icon, key }));
    setTimeout(() => {
      setRecentSounds((map) => {
        if (map.get(identity)?.key !== key) return map; // já foi substituído por um som mais novo
        const next = new Map(map);
        next.delete(identity);
        return next;
      });
    }, SOUND_BADGE_MS);
  }, []);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic === KARAOKE_TOPIC && participant) {
        try {
          const aviso = JSON.parse(new TextDecoder().decode(payload));
          if (aviso?.acao === 'tocar' && Number.isInteger(aviso.songId)) {
            // "comecouEm" é o relógio de QUEM RECEBE: o aviso chega em poucos milissegundos, e quem
            // demorar a carregar o áudio adianta a música nesse tanto para todo mundo cantar junto.
            setKaraoke({ songId: aviso.songId, quem: participant.name || participant.identity, comecouEm: Date.now() });
          }
          if (aviso?.acao === 'parar') setKaraoke(null);
        } catch {
          // aviso torto: ignora
        }
        return;
      }
      if (topic === EFEITO_TOPIC && participant) {
        // Mesmo freio do soundboard: clique repetido de uma pessoa só não vira chuva sem fim.
        const quando = Date.now();
        if (quando - (lastHeardRef.current.get(participant.identity) ?? 0) < RECEIVE_COOLDOWN_MS) return;
        lastHeardRef.current.set(participant.identity, quando);
        try {
          const aviso = JSON.parse(new TextDecoder().decode(payload));
          if (ehEfeitoVisual(aviso?.efeito)) setDisparoVisual({ id: aviso.efeito, chave: quando + Math.random() });
        } catch {
          // aviso torto: ignora
        }
        return;
      }
      if (topic !== SOUNDBOARD_TOPIC || !participant) return;
      let aviso: { soundId?: unknown; acao?: unknown };
      try {
        aviso = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      // PARAR VEM ANTES DO FREIO, DE PROPÓSITO. O freio de um segundo por pessoa existe para clique
      // repetido não virar coro — mas quem aperta "parar" logo depois de tocar está justamente
      // dentro dessa janela, e o pedido mais urgente que existe seria o único a ser engolido.
      if (aviso?.acao === 'parar') {
        stopAllSounds();
        return;
      }
      const soundId: unknown = aviso?.soundId;
      const sound = getDirectory().sounds.find((s) => s.id === soundId);
      if (!sound) return;
      // Ignora repetição rápida da mesma pessoa (clique duplo, cliente modificado).
      const now = Date.now();
      if (now - (lastHeardRef.current.get(participant.identity) ?? 0) < RECEIVE_COOLDOWN_MS) return;
      lastHeardRef.current.set(participant.identity, now);
      if (!deafenedRef.current) playSoundboard(sound.id);
      showSound(participant.identity, sound.icon);
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, showSound]);

  const playSound = useCallback(
    async (soundId: number) => {
      const sound = getDirectory().sounds.find((s) => s.id === soundId);
      if (!sound || channelRef.current === null) return;
      const now = Date.now();
      if (now - lastSentRef.current < SEND_COOLDOWN_MS) return;
      lastSentRef.current = now;
      if (!deafenedRef.current) playSoundboard(sound.id);
      showSound(room.localParticipant.identity, sound.icon);
      await room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify({ soundId })), { reliable: true, topic: SOUNDBOARD_TOPIC })
        .catch(console.error);
    },
    [room, showSound],
  );

  /**
   * Cala o soundboard NA SALA INTEIRA, e não só neste computador.
   *
   * ANTES ISTO NÃO EXISTIA, e é o defeito que o relato "não tem como parar o som" descreve. Havia um
   * botão "Parar", mas ele só silenciava quem o apertasse: quem disparasse um som de trinta segundos
   * não tinha como voltar atrás, e cada uma das outras pessoas precisava abrir o painel do soundboard
   * e parar por conta própria. Um erro de clique custava meio minuto de todo mundo.
   *
   * Qualquer pessoa da sala pode parar, que é a mesma regra já tomada para o karaokê: a sala é de
   * todos, e quem está incomodado com o barulho é justamente quem precisa do botão.
   *
   * NÃO PASSA PELO FREIO DE ENVIO. O freio de um segundo e meio serve para clique repetido não virar
   * coro; aplicá-lo aqui faria o "parar" logo depois do "tocar" ser descartado — exatamente o caso
   * em que ele mais importa.
   */
  const stopSounds = useCallback(async () => {
    stopAllSounds();
    if (channelRef.current === null) return;
    await room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ acao: 'parar' })), { reliable: true, topic: SOUNDBOARD_TOPIC })
      .catch(console.error);
  }, [room]);

  /**
   * Manda um efeito visual para a sala. Quem mandou também vê, na hora, sem esperar a volta da rede.
   *
   * Não passa pelo servidor nem fica guardado em lugar nenhum: é enfeite de momento, e some em
   * segundos. Fora de uma sala não faz nada.
   */
  const mandarEfeitoVisual = useCallback(
    async (efeito: EfeitoVisualId) => {
      if (channelRef.current === null) return;
      const agora = Date.now();
      if (agora - lastSentRef.current < SEND_COOLDOWN_MS) return;
      lastSentRef.current = agora;
      setDisparoVisual({ id: efeito, chave: agora + Math.random() });
      await room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify({ efeito })), { reliable: true, topic: EFEITO_TOPIC })
        .catch(console.error);
    },
    [room],
  );

  /** Põe uma música para a sala inteira, ou para o que estiver tocando. */
  const comandarKaraoke = useCallback(
    async (songId: number | null) => {
      if (channelRef.current === null) return;
      const aviso = songId === null ? { acao: 'parar' } : { acao: 'tocar', songId };
      setKaraoke(
        songId === null
          ? null
          : { songId, quem: room.localParticipant.name || room.localParticipant.identity, comecouEm: Date.now() },
      );
      await room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(aviso)), { reliable: true, topic: KARAOKE_TOPIC })
        .catch(console.error);
    },
    [room],
  );

  // Saiu da sala: o karaokê morre junto.
  useEffect(() => {
    if (channelId === null) setKaraoke(null);
  }, [channelId]);

  // Se o socket cair e voltar (ou o servidor reiniciar), reanuncia em qual sala estamos.
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      if (channelRef.current === null) return;
      socket.emit('voice:join', { channelId: channelRef.current });
      socket.emit('voice:update', { ...readLocalMedia(room.localParticipant), deafened: deafenedRef.current });
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, room]);

  // Sai da chamada ao fechar a página e também quando a tela principal desmonta (ex.: sessão expirada
  // manda de volta ao login); senão a conexão ficaria aberta por trás, com o microfone ligado.
  useEffect(() => {
    const leaveOnClose = () => void room.disconnect();
    window.addEventListener('pagehide', leaveOnClose);
    return () => {
      window.removeEventListener('pagehide', leaveOnClose);
      void room.disconnect();
    };
  }, [room]);

  /**
   * Encaixa o modificador de voz no microfone que já está na chamada. O som continua saindo do mesmo
   * microfone: o efeito só entra no meio do caminho, antes de virar o que os outros ouvem.
   */
  const applyVoiceEffect = useCallback(
    async (effect: VoiceEffectId) => {
      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
      if (!track) return;
      await room.startAudio().catch(() => {}); // sem o áudio ligado, o navegador não deixa processar
      if (effect === 'none') await track.stopProcessor();
      else await track.setProcessor(new VoiceEffectProcessor(effect));
    },
    [room],
  );

  /**
   * Escolhe o efeito de voz. Vale na hora e até o fim desta chamada — não é lembrado na próxima.
   *
   * As trocas são postas NUMA FILA, uma de cada vez. Trocar o efeito desmonta o caminho do microfone e
   * monta outro; duas trocas ao mesmo tempo se atropelam — a segunda monta o caminho novo e a primeira,
   * que ainda estava terminando, o desmonta em seguida. O resultado é o microfone mudo para os outros,
   * sem erro nenhum na tela. É o que acontece quando alguém fica experimentando os efeitos em sequência.
   *
   * E vale sempre a ÚLTIMA escolha: se três trocas entram na fila, as do meio são puladas em vez de
   * serem montadas e desmontadas à toa.
   */
  const enfileirarEfeito = useRef(filaUltimaVale()).current;

  const setVoiceEffect = useCallback(
    async (effect: VoiceEffectId) => {
      setVoiceEffectState(effect);

      await enfileirarEfeito(async () => {
        try {
          await applyVoiceEffect(effect);
        } catch (e) {
          console.error(e);
          setError('Não foi possível aplicar o efeito de voz. Sua voz continua saindo normal.');
          // Sem isto, a falha morria no computador de quem estava falando e não chegava a lugar nenhum:
          // não havia como o administrador saber que alguém teve problema com os efeitos.
          reportProblem('efeito de voz', `Falhou ao aplicar "${effect}": ${e instanceof Error ? e.message : String(e)}`);
        }
      });
    },
    [applyVoiceEffect, enfileirarEfeito],
  );

  const setDeafenedState = useCallback((value: boolean) => {
    deafenedRef.current = value;
    definirSurdez(value);
    setDeafened(value);
    socketRef.current?.emit('voice:update', { deafened: value });
  }, []);

  const join = useCallback(
    async (id: number) => {
      if (channelRef.current === id || connecting || !socketRef.current) return;
      setError(null);
      setConnecting(true);
      // Chamado dentro do clique, para o navegador liberar a reprodução de áudio.
      void room.startAudio();
      /*
       * ENTRAR NUMA SALA SÃO DOIS PEDIDOS A DOIS SERVIDORES DIFERENTES, e por muito tempo os dois
       * falharam com a mesma frase.
       *
       * Primeiro o Syden é quem dá a senha de entrada (`/voice-token`); só depois o LiveKit é quem
       * aceita a conexão. Quando qualquer um dos dois falhava, a tela dizia "desative o bloqueador de
       * anúncios" — um palpite que só faz sentido para o SEGUNDO. Se o Syden está reiniciando por
       * causa de um deploy, ou a sessão venceu, a frase manda a pessoa mexer no antivírus por nada, e
       * o diário do administrador registrava o mesmo palpite em vez do motivo.
       *
       * Esta marca diz onde parou. É um booleano e não um estado: ninguém redesenha por causa dela.
       */
      let pedindoSenha = true;
      try {
        if (room.state !== ConnectionState.Disconnected) await room.disconnect();
        const { url, token } = await api<{ url: string; token: string }>(`/api/channels/${id}/voice-token`, {
          method: 'POST',
        });
        pedindoSenha = false;
        // autoSubscribe: false — quem decide o que baixar é o Syden, logo abaixo (aplicarInscricoes).
        // Antes o servidor empurrava TODAS as faixas de todos ao entrar, transmissões de tela incluídas:
        // numa sala com quatro telas ligadas o computador decodificava quatro vídeos que ninguém pediu.
        await room.connect(url, token, { autoSubscribe: false });
        channelRef.current = id;
        setChannelId(id);
        socketRef.current.emit('voice:join', { channelId: id });
        sounds.selfJoin();
      } catch (e) {
        console.error(e);
        const motivo = e instanceof Error ? e.message : String(e);
        if (pedindoSenha) {
          // O SYDEN NÃO RESPONDEU, e ele já sabe dizer por quê: sessão vencida, sem acesso ao canal,
          // servidor fora do ar, prazo estourado. A mensagem do ApiError já vem traduzida (ver
          // api.ts), então repeti-la é mais honesto — e mais útil — do que qualquer palpite nosso.
          setError(motivo);
        } else {
          // Aqui sim o palpite vale: o endereço do servidor de voz está em listas de bloqueio, e é a
          // causa mais comum de a conexão morrer DEPOIS de o Syden já ter dado a senha.
          setError('Não foi possível conectar à sala de voz. Se você usa bloqueador de anúncios (uBlock, AdGuard), antivírus com proteção web ou VPN, desative para este site e tente de novo.');
        }
        // E O DIÁRIO DO ADMINISTRADOR PASSA A RECEBER O MOTIVO, não o palpite. Antes ele gravava
        // sempre a mesma frase, então a aba de saúde não distinguia um deploy de um bloqueador.
        reportProblem('conexão', `${pedindoSenha ? 'senha de voz' : 'LiveKit'}: ${motivo}`);
        setConnecting(false);
        return;
      }
      setConnecting(false);
      try {
        const settings = getSettings();
        if (settings.startDeafened) setDeafenedState(true);
        await room.localParticipant.setMicrophoneEnabled(!settings.startMuted && !settings.startDeafened);
        // Entrando mudo, o LiveKit não publica faixa nenhuma e nenhum evento avisa a tela: o estado
        // precisa ser dito na mão, senão o botão mostraria o microfone ligado com ele desligado.
        const estado = readLocalMedia(room.localParticipant);
        setMedia(estado);
        socketRef.current?.emit('voice:update', { ...estado, deafened: deafenedRef.current });
        // Entrando, é a voz da pessoa. Se ela estava com um efeito na sala anterior, ele fica para trás:
        // o caminho do microfone é montado do zero aqui, então basta não reaplicar nada e zerar a tela.
        setVoiceEffectState('none');
      } catch (e) {
        console.error(e);
        const message = deviceErrorMessage(e, 'microfone');
        setError(message);
        reportProblem('microfone', message);
      }
    },
    [room, connecting, applyVoiceEffect, setDeafenedState],
  );

  /**
   * Quais transmissões de tela esta pessoa mandou abrir, pelo identificador de quem transmite. Voz e câmera
   * chegam sempre; tela, só depois de clicar em "Assistir". É o que faz entrar numa sala com várias
   * transmissões ligadas custar o mesmo que entrar numa sala sem nenhuma.
   */
  const [assistindo, setAssistindo] = useState<ReadonlySet<string>>(() => new Set());
  // Os eventos do LiveKit são presos uma vez só; a ref deixa eles lerem a escolha atual.
  const assistindoRef = useRef<ReadonlySet<string>>(assistindo);
  assistindoRef.current = assistindo;

  /**
   * Quem falou, do mais recente para o mais antigo. É a memória que a regra de sala grande usa.
   *
   * Fica numa ref e não num estado porque muda a cada fala de cada pessoa: virar estado redesenharia a
   * tela toda vez que alguém abre a boca, e ninguém veria diferença nenhuma no desenho.
   */
  const falantesRef = useRef<string[]>([]);

  /** Traduz a fonte do LiveKit para o nome que a regra usa, para a regra não depender da biblioteca. */
  const fonteDa = (publicacao: TrackPublication): Fonte => {
    if (publicacao.source === Track.Source.ScreenShare) return 'tela';
    if (publicacao.source === Track.Source.ScreenShareAudio) return 'som-da-tela';
    if (publicacao.source === Track.Source.Microphone) return 'microfone';
    if (publicacao.source === Track.Source.Camera) return 'camera';
    return 'outra';
  };

  /**
   * Diz ao servidor, faixa por faixa, o que este computador quer receber. Chamado a cada mudança (alguém
   * chegou, alguém começou a transmitir, alguém falou, você abriu ou fechou uma transmissão), porque só o
   * servidor pode parar de mandar — recusar o vídeo depois de baixado não economizaria nem internet nem
   * processador.
   */
  const aplicarInscricoes = useCallback(() => {
    /**
     * EM SALA GRANDE, O ÁUDIO DE QUEM ESTÁ CALADO NÃO É BAIXADO.
     *
     * Esta é a conta que decidia se o Syden escala: um SFU repassa em vez de misturar, então todo mundo
     * baixando todo mundo dá N×(N−1) fluxos. Dez pessoas são 90 e ninguém sente; cinquenta são 2.450 e o
     * servidor cai. A regra inteira — com os porquês de cada linha — está em quemOuvir.ts, e o mais
     * importante dela é o que ela NÃO faz: abaixo de doze pessoas, nada muda.
     */
    const todos = [...room.remoteParticipants.values()].map((pessoa) => ({ id: pessoa.identity }));
    // Quem a pessoa escolheu ouvir vence a regra automática: quem ela está assistindo (se abriu a tela de
    // alguém, quer a voz dessa pessoa) e de quem ela mexeu no volume.
    const preferidos = new Set<string>([...assistindoRef.current, ...idsComVolumeAjustado()]);
    const vozesQueridas = quemOuvir(todos, falantesRef.current, preferidos);

    for (const pessoa of room.remoteParticipants.values()) {
      for (const publicacao of pessoa.trackPublications.values()) {
        const querido = queroEstaFaixa(fonteDa(publicacao), pessoa.identity, vozesQueridas, assistindoRef.current);
        if (publicacao.isDesired !== querido) publicacao.setSubscribed(querido);
      }
    }
  }, [room]);

  useEffect(() => {
    aplicarInscricoes();
    /** Quem tem "abrir sozinho" ligado volta ao jeito antigo: a transmissão nova já entra assistida. */
    const aoPublicar = (publicacao: TrackPublication, participante: RemoteParticipant) => {
      if (publicacao.source === Track.Source.ScreenShare && getSettings().abrirTransmissaoSozinha) {
        setAssistindo((atual) => new Set(atual).add(participante.identity));
      }
      aplicarInscricoes();
    };
    /**
     * Quem tem "abrir sozinho" ligado também quer ver as transmissões que JÁ estavam no ar quando entrou.
     * Elas não passam pelo evento acima: chegam prontas na resposta de entrada da sala.
     */
    const aoConectar = () => {
      if (getSettings().abrirTransmissaoSozinha) {
        const transmitindo = [...room.remoteParticipants.values()]
          .filter((pessoa) => pessoa.getTrackPublication(Track.Source.ScreenShare))
          .map((pessoa) => pessoa.identity);
        if (transmitindo.length > 0) setAssistindo((atual) => new Set([...atual, ...transmitindo]));
      }
      aplicarInscricoes();
    };
    /**
     * Quem está falando agora entra na memória, e a inscrição é refeita.
     *
     * O servidor avisa quem fala mesmo de quem NÃO se está baixando — é um aviso de controle, não o áudio.
     * Sem isso a regra não funcionaria: ninguém que estivesse fora da lista conseguiria entrar nela.
     */
    const aoFalar = (falando: Participant[]) => {
      const agora = falando.filter((p) => p !== room.localParticipant).map((p) => p.identity);
      falantesRef.current = lembrarFalantes(falantesRef.current, agora);
      aplicarInscricoes();
    };
    /** Quem saiu não precisa continuar na memória de falantes para sempre. */
    const aoSair = (participante: RemoteParticipant) => {
      falantesRef.current = falantesRef.current.filter((id) => id !== participante.identity);
      aplicarInscricoes();
    };
    room
      .on(RoomEvent.Connected, aoConectar)
      .on(RoomEvent.Reconnected, aoConectar)
      .on(RoomEvent.ParticipantConnected, aplicarInscricoes)
      .on(RoomEvent.ParticipantDisconnected, aoSair)
      .on(RoomEvent.ActiveSpeakersChanged, aoFalar)
      .on(RoomEvent.TrackPublished, aoPublicar)
      .on(RoomEvent.TrackUnpublished, aplicarInscricoes);
    return () => {
      room
        .off(RoomEvent.Connected, aoConectar)
        .off(RoomEvent.Reconnected, aoConectar)
        .off(RoomEvent.ParticipantConnected, aplicarInscricoes)
        .off(RoomEvent.ParticipantDisconnected, aoSair)
        .off(RoomEvent.ActiveSpeakersChanged, aoFalar)
        .off(RoomEvent.TrackPublished, aoPublicar)
        .off(RoomEvent.TrackUnpublished, aplicarInscricoes);
    };
  }, [room, aplicarInscricoes, assistindo]);

  /**
   * Abre ou fecha a transmissão de alguém. Fechar corta o download na hora. A escolha vale enquanto você
   * está na sala: se a pessoa parar e voltar a transmitir, volta aberta — você já tinha dito que quer ver.
   */
  const assistir = useCallback((identity: string, abrir: boolean) => {
    setAssistindo((atual) => {
      if (atual.has(identity) === abrir) return atual;
      const proximo = new Set(atual);
      if (abrir) proximo.add(identity);
      else proximo.delete(identity);
      return proximo;
    });
  }, []);

  /**
   * Troca a qualidade da transmissão em andamento sem pedir para escolher a tela de novo: mexe direto nos
   * parâmetros de envio (quadros por segundo e taxa) do que já está sendo enviado.
   */
  const setScreenQuality = useCallback(
    async (quality: ScreenQuality) => {
      updateSettings({ screenQuality: quality });
      const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
      const sender = track?.sender;
      if (!track || !sender) return;

      const preset = SCREEN_PRESETS[quality];
      const hints = SCREEN_HINTS[quality];
      track.mediaStreamTrack.contentHint = hints.contentHint;
      const parameters = sender.getParameters();
      parameters.degradationPreference = hints.degradation;
      for (const encoding of parameters.encodings) {
        // Com camadas, as menores mantêm a proporção de taxa que já tinham.
        const share = encoding.maxBitrate ? encoding.maxBitrate / Math.max(...parameters.encodings.map((e) => e.maxBitrate ?? 1)) : 1;
        encoding.maxFramerate = preset.encoding.maxFramerate;
        encoding.maxBitrate = Math.round(preset.encoding.maxBitrate * share);
      }
      await sender.setParameters(parameters).catch(console.error);
    },
    [room],
  );

  const leave = useCallback(() => {
    if (channelRef.current !== null) sounds.selfLeave();
    setVoiceEffectState('none');
    void room.disconnect();
  }, [room]);

  const toggleMute = useCallback(async () => {
    // Fora de uma sala não há microfone ligado: aqui só se guarda a escolha, que vale ao entrar.
    if (channelRef.current === null) {
      const next = !getSettings().startMuted;
      updateSettings({ startMuted: next });
      setWantMuted(next);
      (next ? sounds.mute : sounds.unmute)();
      return;
    }
    const lp = room.localParticipant;
    const enable = !lp.isMicrophoneEnabled;
    try {
      await lp.setMicrophoneEnabled(enable);
      updateSettings({ startMuted: !enable });
      setWantMuted(!enable);
      if (enable && deafenedRef.current) setDeafenedState(false); // falar implica ouvir, como no Discord
      (enable ? sounds.unmute : sounds.mute)();
    } catch (e) {
      console.error(e);
      const message = deviceErrorMessage(e, 'microfone');
      setError(message);
      reportProblem('microfone', message);
    }
  }, [room, setDeafenedState]);

  const toggleDeafen = useCallback(async () => {
    if (channelRef.current === null) {
      const next = !getSettings().startDeafened;
      updateSettings({ startDeafened: next, startMuted: next || getSettings().startMuted });
      setWantDeafened(next);
      setWantMuted(next || getSettings().startMuted);
      (next ? sounds.deafen : sounds.undeafen)();
      return;
    }
    const next = !deafenedRef.current;
    setDeafenedState(next);
    updateSettings({ startDeafened: next });
    setWantDeafened(next);
    (next ? sounds.deafen : sounds.undeafen)();
    await room.localParticipant.setMicrophoneEnabled(!next).catch(console.error);
  }, [room, setDeafenedState]);

  const toggleCamera = useCallback(async () => {
    const lp = room.localParticipant;
    try {
      await lp.setCameraEnabled(!lp.isCameraEnabled);
    } catch (e) {
      console.error(e);
      const message = deviceErrorMessage(e, 'câmera');
      setError(message);
      reportProblem('câmera', message);
    }
  }, [room]);

  /**
   * Som da transmissão pelo caminho do app de desktop: o Windows entrega o som do computador sem o do
   * próprio Syden, então as vozes da chamada não voltam como eco. Vai como uma faixa à parte, do tipo que
   * o LiveKit reserva para o áudio de tela — é assim que quem assiste ouve junto com a imagem.
   */
  const appAudioRef = useRef<AppAudio | null>(null);

  const stopAppAudio = useCallback(() => {
    const current = appAudioRef.current;
    if (!current) return;
    appAudioRef.current = null;
    void room.localParticipant.unpublishTrack(current.track).catch(console.error);
    current.stop();
  }, [room]);

  stopAppAudioRef.current = stopAppAudio;

  const startAppAudio = useCallback(async () => {
    if (appAudioRef.current) return;
    const audio = await captureAppAudio();
    if (!audio) return; // no navegador, ou sem o módulo nativo: segue o caminho antigo
    try {
      await room.localParticipant.publishTrack(audio.track, {
        source: Track.Source.ScreenShareAudio,
        // Som de jogo e de música não é voz: nada de cortar silêncio nem de mono.
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
        red: false,
        forceStereo: true,
      });
      appAudioRef.current = audio;
    } catch (e) {
      console.error(e);
      audio.stop();
    }
  }, [room]);

  /**
   * Começa (ou troca) a transmissão. `surface` decide o que o seletor do navegador abre primeiro:
   * tela inteira, uma janela/app específico ou uma aba — janela e aba tendem a vir com áudio só daquele
   * programa; tela inteira traz o som do sistema inteiro junto (o que inclui a própria chamada, se ela
   * estiver tocando pelo alto-falante). Chamar já compartilhando troca para a tela nova.
   */
  const shareScreen = useCallback(
    async (surface: 'monitor' | 'window' | 'browser') => {
      const lp = room.localParticipant;
      const quality = getSettings().screenQuality;
      const preset = SCREEN_PRESETS[quality];
      const hints = SCREEN_HINTS[quality];
      const escolhido = getSettings().screenCodec;
      const codec =
        escolhido === 'auto'
          ? (
              await escolherCodecDaTela(
                preset.width,
                preset.height,
                preset.encoding.maxFramerate ?? 30,
              )
            ).codec
          : escolhido;
      try {
        setTelaCompartilhada(surface);
        if (lp.isScreenShareEnabled) await lp.setScreenShareEnabled(false);
        await lp.setScreenShareEnabled(
          true,
          {
            contentHint: hints.contentHint,
            // "restrictOwnAudio" tira da captura o som que o PRÓPRIO Syden está tocando — as vozes da
            // chamada. ELE VAI DENTRO DE `audio`, porque é uma restrição da FAIXA de som, não uma opção
            // solta do getDisplayMedia. Estava no lugar errado, o navegador ignorava calado, e o som da
            // chamada voltava para dentro da transmissão: todo mundo se ouvia. Logo abaixo, o app
            // confere se a opção pegou de verdade, em vez de confiar.
            audio: { restrictOwnAudio: true },
            systemAudio: 'include',
            selfBrowserSurface: 'exclude',
            video: { displaySurface: surface },
            preferCurrentTab: false,
            surfaceSwitching: 'include', // deixa trocar o que está sendo mostrado sem parar o compartilhamento
            resolution: preset.resolution,
          } as Parameters<typeof lp.setScreenShareEnabled>[1],
          {
            screenShareEncoding: preset.encoding,
            degradationPreference: hints.degradation,
            // Escolhido nas configurações, ou MEDIDO quando está em automático: a pergunta é se o
            // H.264 sai pela placa de vídeo nesta máquina e neste tamanho (ver escolherCodec.ts).
            // Continua dando para fixar um dos dois à mão e comparar numa chamada de verdade, que é o
            // único lugar onde a diferença aparece — num teste isolado os números não se repetem.
            videoCodec: codec,
            screenShareSimulcastLayers: SCREEN_LAYERS[quality],
          },
        );
        // O navegador diz, na própria faixa, se conseguiu tirar o som da chamada da captura. Quando não
        // conseguiu (navegador antigo, ou o tipo de tela escolhido não tem som de sistema), quem está
        // transmitindo precisa saber — senão a sala inteira se ouve e ninguém entende por quê.
        const faixaDeSom = lp.getTrackPublication(Track.Source.ScreenShareAudio)?.audioTrack?.mediaStreamTrack;
        const ajuste = faixaDeSom?.getSettings() as (MediaTrackSettings & { restrictOwnAudio?: boolean }) | undefined;
        setEcoNaTransmissao(Boolean(faixaDeSom) && ajuste?.restrictOwnAudio !== true);

        // De onde sai "League of Legends" na lista dos outros.
        //
        // No APP, do seletor: só o processo principal do Electron conhece o título da janela, e ele o
        // manda por fora (ver desktop/src/preload.js). No NAVEGADOR isso não existe, e não é falha de
        // ninguém: o rótulo da faixa é um código interno de propósito, para uma página não conseguir
        // descobrir que programas a pessoa tem abertos. Lá sobra o tipo — "a tela", "uma janela".
        const doSeletor = desktopBridge?.telaEscolhida?.();
        const capturado = lp.getTrackPublication(Track.Source.ScreenShare)?.videoTrack?.mediaStreamTrack?.label;
        nomeDaTelaRef.current = nomeDaTransmissao(doSeletor || capturado, surface);
        if (channelRef.current !== null) {
          socketRef.current?.emit('voice:update', { ...readLocalMedia(lp), screenName: nomeDaTelaRef.current });
        }
        await startAppAudio();
      } catch (e) {
        // Fechar o seletor de tela sem escolher nada não é erro.
        if (!isCancelledPicker(e)) {
          console.error(e);
          setError('Não foi possível compartilhar a tela neste navegador.');
        }
      }
    },
    [room, startAppAudio],
  );

  /**
   * Troca o codec da transmissão.
   *
   * Precisa RECOMEÇAR a transmissão: o codec é escolhido no momento em que a faixa é publicada, e não
   * dá para trocar com ela no ar. Quem assiste vê a imagem sumir e voltar em um ou dois segundos.
   *
   * Já transmitindo, o seletor de tela abre de novo — não há como recomeçar sem pedir a tela outra vez,
   * porque a permissão de captura morre junto com a faixa. É por isso que isto não acontece sozinho:
   * quem decide é a pessoa, clicando no conselho.
   */
  const setScreenCodec = useCallback(
    (codec: 'vp8' | 'h264') => {
      updateSettings({ screenCodec: codec });
      const tela = telaCompartilhada;
      if (room.localParticipant.isScreenShareEnabled && tela) void shareScreen(tela);
    },
    [room, shareScreen, telaCompartilhada],
  );

  const stopScreen = useCallback(async () => {
    stopAppAudio();
    await room.localParticipant.setScreenShareEnabled(false).catch(console.error);
  }, [room, stopAppAudio]);

  /** Troca microfone, alto-falante ou câmera; vale na hora e fica salvo para as próximas vezes. */
  const switchDevice = useCallback(
    async (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => {
      const key = { audioinput: 'audioInput', audiooutput: 'audioOutput', videoinput: 'videoInput' } as const;
      updateSettings({ [key[kind]]: deviceId });
      try {
        if (deviceId || kind !== 'videoinput') {
          // 'default' é o dispositivo padrão do sistema para microfone e alto-falante.
          await room.switchActiveDevice(kind, deviceId || 'default', false);
        } else {
          room.options.videoCaptureDefaults = { ...room.options.videoCaptureDefaults, deviceId: undefined };
        }
      } catch (e) {
        console.error(e);
        setError('Não foi possível trocar o dispositivo.');
      }
    },
    [room],
  );

  /** Liga ou desliga supressão de ruído e cancelamento de eco, reiniciando o microfone se ele estiver em uso. */
  const setAudioProcessing = useCallback(
    async (patch: { noiseSuppression?: boolean; echoCancellation?: boolean }) => {
      updateSettings(patch);
      room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...patch };
      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
      if (!track) return;
      const wasMuted = track.isMuted;
      try {
        await track.restartTrack(room.options.audioCaptureDefaults);
        if (wasMuted) await track.mute();
      } catch (e) {
        console.error(e);
        setError('Não foi possível aplicar a configuração do microfone.');
      }
    },
    [room],
  );

  /**
   * Otimização dinâmica da transmissão. Quando falta processador ou banda, o navegador sozinho costuma
   * segurar o tamanho da imagem e deixar os quadros despencarem — o contrário do que quem assiste a um
   * jogo quer. Este efeito mede a transmissão de quatro em quatro segundos e, pela regra de nextQuality,
   * encolhe a imagem para segurar a fluidez (ou devolve a nitidez quando sobra folga).
   *
   * Não vale para a qualidade "Leve", onde a pessoa pediu nitidez de propósito.
   */
  useEffect(() => {
    if (!media.screen || getSettings().screenQuality === 'light') return;
    let quality: AutoQuality = { step: 0, comfortable: 0 };
    let base: (number | undefined)[] | null = null;
    let busy = false;

    const check = async () => {
      if (busy) return;
      const sender = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack?.sender;
      if (!sender) return;
      busy = true;
      try {
        let fps = 0;
        let limitedBy: StreamStats['limitedBy'] = 'none';
        (await sender.getStats()).forEach((entry: Record<string, unknown>) => {
          if (entry.type !== 'outbound-rtp' || entry.kind !== 'video') return;
          fps = Math.max(fps, Number(entry.framesPerSecond ?? 0));
          const reason = String(entry.qualityLimitationReason ?? 'none');
          if (reason === 'cpu' || reason === 'bandwidth') limitedBy = reason;
        });

        const next = nextQuality(quality, { fps, limitedBy });
        if (next.step !== quality.step) {
          const parameters = sender.getParameters();
          // Guarda a proporção original de cada camada: com simulcast elas já nascem em tamanhos diferentes.
          base ??= parameters.encodings.map((encoding) => encoding.scaleResolutionDownBy);
          parameters.degradationPreference = 'maintain-framerate';
          parameters.encodings.forEach((encoding, index) => {
            encoding.scaleResolutionDownBy = (base?.[index] ?? 1) * SCALE_STEPS[next.step];
          });
          await sender.setParameters(parameters).catch(console.error);
        }
        quality = next;
      } finally {
        busy = false;
      }
    };

    const timer = setInterval(() => void check(), SCREEN_CHECK_MS);
    return () => clearInterval(timer);
  }, [media.screen, room]);

  // Avisa "Você está silenciado!" quando a pessoa fala com o microfone mudo, como no Discord. O LiveKit
  // para de mandar áudio ao mutar, então isto ouve um microfone à parte, só para medir o volume da voz —
  // não é o mesmo fluxo que vai para a chamada.
  const MUTED_TALK_THRESHOLD = 0.045;
  const MUTED_TALK_SUSTAIN_MS = 250;
  const MUTED_TALK_COOLDOWN_MS = 4000;
  const MUTED_TALK_BANNER_MS = 3500;
  useEffect(() => {
    if (channelId === null || !media.muted) {
      setMutedWarning(false);
      return;
    }
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let aboveSince: number | null = null;
    let lastWarnAt = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: getSettings().audioInput || undefined, echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) {
            const d = v - 128;
            sum += d * d;
          }
          const level = Math.sqrt(sum / data.length) / 128;
          const now = Date.now();
          if (level > MUTED_TALK_THRESHOLD) {
            aboveSince ??= now;
            if (now - aboveSince > MUTED_TALK_SUSTAIN_MS && now - lastWarnAt > MUTED_TALK_COOLDOWN_MS) {
              lastWarnAt = now;
              setMutedWarning(true);
              clearTimeout(hideTimer);
              hideTimer = setTimeout(() => setMutedWarning(false), MUTED_TALK_BANNER_MS);
            }
          } else {
            aboveSince = null;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        // Sem acesso a um segundo fluxo do microfone aqui: só não há como avisar, nada quebra.
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [channelId, media.muted]);

  return {
    room,
    channelId,
    connecting,
    // Fora de uma sala, o que vale é a escolha guardada (a pessoa pode se silenciar antes de entrar).
    media: channelId === null ? { ...media, muted: wantMuted } : media,
    deafened: channelId === null ? wantDeafened : deafened,
    error,
    mutedWarning,
    clearError: () => setError(null),
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    shareScreen,
    stopScreen,
    setScreenQuality,
    switchDevice,
    setAudioProcessing,
    ecoNaTransmissao,
    telaCompartilhada,
    setScreenCodec,
    disparoVisual,
    mandarEfeitoVisual,
    assistindo,
    assistir,
    recentSounds,
    playSound,
    stopSounds,
    karaoke,
    comandarKaraoke,
    voiceEffect,
    setVoiceEffect,
  };
}
