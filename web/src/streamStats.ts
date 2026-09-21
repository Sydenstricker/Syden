import type { LocalTrackPublication, RemoteTrackPublication, TrackPublication } from 'livekit-client';
import { useEffect, useState } from 'react';

// Lê do próprio WebRTC como a transmissão está indo: tamanho da imagem, quadros por segundo e, para quem
// transmite, se o navegador está cortando qualidade por falta de processador ou de banda.

const POLL_MS = 3000;

export interface StreamStats {
  width: number;
  height: number;
  fps: number;
  /** Só para quem transmite: 'cpu' (processador), 'bandwidth' (internet) ou 'none'. */
  limitedBy: 'cpu' | 'bandwidth' | 'other' | 'none';
  kbps: number;
}

type Publication = TrackPublication | LocalTrackPublication | RemoteTrackPublication;

/** "1080p · 60 fps" a partir da altura da imagem, como as pessoas falam de qualidade. */
export function describeStats(stats: StreamStats | null) {
  if (!stats || !stats.height) return null;
  const linhas = stats.height >= 2000 ? '4K' : `${stats.height}p`;
  // Os quadros por segundo só aparecem depois da segunda medição; antes disso, mostra só o tamanho.
  return stats.fps >= 1 ? `${linhas} · ${Math.round(stats.fps)} fps` : linhas;
}

async function read(publication: Publication | undefined, local: boolean): Promise<StreamStats | null> {
  const track = publication?.track;
  if (!track) return null;
  try {
    const report = await track.getRTCStatsReport();
    if (!report) return null;
    let stats: StreamStats | null = null;
    report.forEach((entry: Record<string, unknown>) => {
      const type = entry.type as string;
      if (type !== (local ? 'outbound-rtp' : 'inbound-rtp') || entry.kind !== 'video') return;
      const width = Number(entry.frameWidth ?? 0);
      const height = Number(entry.frameHeight ?? 0);
      // Com camadas (simulcast), a maior é a que interessa: é a que aparece em tela cheia.
      if (stats && height <= stats.height) return;
      const reason = String(entry.qualityLimitationReason ?? 'none');
      stats = {
        width,
        height,
        fps: Number(entry.framesPerSecond ?? 0),
        limitedBy: reason === 'cpu' || reason === 'bandwidth' || reason === 'none' ? reason : 'other',
        kbps: 0,
      };
    });
    return stats;
  } catch {
    return null;
  }
}

/** Acompanha uma transmissão e devolve como ela está agora; atualiza a cada 3 segundos. */
export function useStreamStats(publication: Publication | undefined, { local = false, active = true } = {}) {
  const [stats, setStats] = useState<StreamStats | null>(null);

  useEffect(() => {
    if (!active || !publication) {
      setStats(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const next = await read(publication, local);
      if (!cancelled) setStats(next);
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [publication, local, active]);

  return stats;
}
