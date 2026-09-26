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
  /** O codec em uso ("H264", "VP8"…): é o que permite comparar um contra o outro na prática. */
  codec: string | null;
  /** Nome do codificador que o navegador escolheu; serve para saber se é a placa de vídeo. */
  encoder: string | null;
  /** O navegador diz que este codificador é o econômico (normalmente, o da placa de vídeo). */
  naPlaca: boolean | null;
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
    // O nome do codec vive numa entrada à parte do relatório, apontada por codecId.
    const codecs = new Map<string, string>();
    report.forEach((entry: Record<string, unknown>) => {
      if (entry.type === 'codec' && typeof entry.mimeType === 'string') {
        codecs.set(String(entry.id), entry.mimeType.replace(/^video\//i, '').toUpperCase());
      }
    });
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
        codec: codecs.get(String(entry.codecId ?? '')) ?? null,
        encoder: typeof entry.encoderImplementation === 'string' ? entry.encoderImplementation : null,
        naPlaca: typeof entry.powerEfficientEncoder === 'boolean' ? entry.powerEfficientEncoder : null,
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

// ---------- Otimização dinâmica da transmissão ----------

/** Piso de quadros por segundo abaixo do qual a imagem visivelmente engasga. */
export const FPS_FLOOR = 20;
/** Acima disto, e com folga, dá para tentar devolver a nitidez. */
export const FPS_COMFORT = 27;
/** Degraus de redução da imagem: 1 = tamanho cheio, 2 = metade da largura e da altura. */
export const SCALE_STEPS = [1, 1.5, 2, 3];
/** Quantas medições folgadas seguidas antes de subir de novo (evita ficar subindo e descendo). */
const PATIENCE = 3;

export interface AutoQuality {
  /** Posição em SCALE_STEPS. */
  step: number;
  /** Medições folgadas seguidas até agora. */
  comfortable: number;
}

/**
 * Decide o próximo degrau de qualidade a partir da última medição. Regra: quem assiste sente mais a
 * imagem travando do que a imagem menor, então, quando falta processador ou banda, encolhe-se a imagem
 * para segurar os quadros; a nitidez só volta depois de um tempo bom com folga.
 */
export function nextQuality(current: AutoQuality, sample: { fps: number; limitedBy: StreamStats['limitedBy'] }): AutoQuality {
  if (sample.fps <= 0) return current; // ainda medindo, ou ninguém assistindo
  const struggling = sample.fps < FPS_FLOOR && (sample.limitedBy === 'cpu' || sample.limitedBy === 'bandwidth');

  if (struggling) {
    return { step: Math.min(current.step + 1, SCALE_STEPS.length - 1), comfortable: 0 };
  }
  if (current.step > 0 && sample.fps >= FPS_COMFORT && sample.limitedBy === 'none') {
    const comfortable = current.comfortable + 1;
    return comfortable >= PATIENCE ? { step: current.step - 1, comfortable: 0 } : { step: current.step, comfortable };
  }
  return { step: current.step, comfortable: 0 };
}
