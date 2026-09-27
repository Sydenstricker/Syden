import { Track } from 'livekit-client';
import { Gauge, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type ScreenQuality, useSettings } from './settings';
import { useStreamStats } from './streamStats';
import type { Voice } from './useVoice';

// Conselho automático de qualidade para quem está transmitindo. Duas situações valem um aviso:
// travando por falta de processador ou de internet (melhor baixar), e transmissão folgada em 30 fps
// (jogo fica bem melhor em 60). Três medições seguidas antes de falar, para não avisar por um soluço.
const STREAK = 3;

interface Advice {
  /** A chave do aviso, que também serve para não repetir o mesmo conselho depois de dispensado. */
  id: string;
  text: string;
  action: string;
  /** Trocar a qualidade, quando é disso que se trata. */
  to?: ScreenQuality;
  /**
   * Trocar o codec.
   *
   * Existe porque nem todo travamento se resolve baixando a qualidade: quando o computador está no
   * limite E não está usando a placa de vídeo, o conserto é trocar o codec — a mesma imagem passa a
   * custar uma fração do processador. Baixar a qualidade aí seria pagar em nitidez por um problema
   * que tem solução de graça.
   */
  codec?: 'vp8' | 'h264';
}

/** Abaixo disto a transmissão não é mais "um pouco travada": é uma sequência de fotos. */
const FPS_RUIM = 20;

function advise(quality: ScreenQuality, fps: number, limitedBy: string, naPlaca: boolean | null): Advice | null {
  if (quality === 'smooth' && (limitedBy === 'cpu' || limitedBy === 'bandwidth') && fps < 45) {
    return {
      id: 'smooth-pesado',
      to: 'standard',
      text:
        limitedBy === 'cpu'
          ? 'Seu computador não está dando conta dos 60 quadros: a imagem está travando para quem assiste.'
          : 'Sua internet não está dando conta dos 60 quadros: a imagem está travando para quem assiste.',
      action: 'Mudar para 30 fps',
    };
  }

  /*
   * O caso que faltava, e é o mais comum de todos: a qualidade PADRÃO travando.
   *
   * Antes o conselheiro só abria a boca na de 60 fps. Quem estava no padrão podia transmitir a 7
   * quadros por segundo a tarde inteira sem ninguém avisar — e quem transmite não vê o problema, porque
   * do lado dele o jogo está liso. Quem sofre é quem assiste, e quem assiste raramente reclama.
   */
  if (quality === 'standard' && fps > 0 && fps < FPS_RUIM && limitedBy !== 'none') {
    if (limitedBy === 'cpu' && naPlaca === false) {
      return {
        id: 'usar-h264',
        codec: 'h264',
        text:
          'Seu computador está no limite codificando a imagem, e não está usando a placa de vídeo para isso. ' +
          'Trocar o codec para H.264 costuma resolver: normalmente ele usa a placa, e sobra processador.',
        action: 'Usar H.264',
      };
    }
    return {
      id: 'padrao-pesado',
      to: 'light',
      text:
        limitedBy === 'cpu'
          ? 'Seu computador não está dando conta: quem assiste está vendo a imagem aos trancos.'
          : 'Sua internet não está dando conta: quem assiste está vendo a imagem aos trancos.',
      action: 'Baixar a qualidade',
    };
  }
  if (quality === 'standard' && limitedBy === 'none' && fps >= 28) {
    return {
      id: 'tem-folga',
      to: 'smooth',
      text: 'Está sobrando folga na sua transmissão. Se você está jogando, 60 quadros por segundo deixam bem mais fluido.',
      action: 'Mudar para 60 fps',
    };
  }
  return null;
}

export function QualityAdvisor({ voice }: { voice: Voice }) {
  const { screenQuality } = useSettings();
  const publication = voice.room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
  const stats = useStreamStats(publication, { local: true, active: voice.media.screen });
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const streak = useRef<{ id: string; count: number } | null>(null);

  useEffect(() => {
    if (!stats || !voice.media.screen) return;
    const next = advise(screenQuality, stats.fps, stats.limitedBy, stats.naPlaca);
    if (!next) {
      streak.current = null;
      return;
    }
    streak.current = streak.current?.id === next.id ? { id: next.id, count: streak.current.count + 1 } : { id: next.id, count: 1 };
    if (streak.current.count >= STREAK && dismissed !== next.id) setAdvice(next);
  }, [stats, screenQuality, voice.media.screen, dismissed]);

  // Parou de transmitir: o conselho perde o sentido.
  useEffect(() => {
    if (!voice.media.screen) {
      setAdvice(null);
      streak.current = null;
    }
  }, [voice.media.screen]);

  if (!advice || !voice.media.screen) return null;

  return (
    <div className="advisor" role="status">
      <Gauge size={18} className="muted-icon" aria-hidden="true" />
      <span className="advisor-text">{advice.text}</span>
      <button
        className="btn-secondary"
        onClick={() => {
          if (advice.codec) voice.setScreenCodec(advice.codec);
          if (advice.to) void voice.setScreenQuality(advice.to);
          setAdvice(null);
          streak.current = null;
        }}
      >
        {advice.action}
      </button>
      <button
        className="icon-plain"
        aria-label="Dispensar o aviso"
        onClick={() => {
          setDismissed(advice.id);
          setAdvice(null);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
