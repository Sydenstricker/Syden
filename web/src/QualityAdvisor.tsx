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
  to: ScreenQuality;
  text: string;
  action: string;
}

function advise(quality: ScreenQuality, fps: number, limitedBy: string): Advice | null {
  if (quality === 'smooth' && (limitedBy === 'cpu' || limitedBy === 'bandwidth') && fps < 45) {
    return {
      to: 'standard',
      text:
        limitedBy === 'cpu'
          ? 'Seu computador não está dando conta dos 60 quadros: a imagem está travando para quem assiste.'
          : 'Sua internet não está dando conta dos 60 quadros: a imagem está travando para quem assiste.',
      action: 'Mudar para 30 fps',
    };
  }
  if (quality === 'standard' && limitedBy === 'none' && fps >= 28) {
    return {
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
  const [dismissed, setDismissed] = useState<ScreenQuality | null>(null);
  const streak = useRef<{ to: ScreenQuality; count: number } | null>(null);

  useEffect(() => {
    if (!stats || !voice.media.screen) return;
    const next = advise(screenQuality, stats.fps, stats.limitedBy);
    if (!next) {
      streak.current = null;
      return;
    }
    streak.current = streak.current?.to === next.to ? { to: next.to, count: streak.current.count + 1 } : { to: next.to, count: 1 };
    if (streak.current.count >= STREAK && dismissed !== next.to) setAdvice(next);
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
          void voice.setScreenQuality(advice.to);
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
          setDismissed(advice.to);
          setAdvice(null);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
