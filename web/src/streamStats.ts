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
  /**
   * A transmissão está publicada mas NADA está sendo codificado, porque ninguém abriu.
   *
   * O Syden pausa as camadas que ninguém está assistindo (dynacast), e uma camada pausada não produz
   * quadro nenhum — logo, não há tamanho, nem taxa, nem codec para medir. Sem este aviso o cartão
   * ficava em "Medindo…" para sempre, e quem transmitia sozinho concluía que estava quebrado. Está
   * tudo certo: é o Syden não gastando processador à toa.
   */
  semPublico: boolean;
}

type Publication = TrackPublication | LocalTrackPublication | RemoteTrackPublication;

/**
 * As taxas que o Syden de fato publica (ver SCREEN_LAYERS, em useVoice.ts). Não existe camada de 29
 * nem de 14: todo número que aparece é uma dessas três, medida com ruído.
 */
const TAXAS = [15, 30, 60];

/**
 * QUANTO ABAIXO DO ALVO AINDA É O ALVO.
 *
 * Um codificador de vídeo nunca entrega o número redondo. Ele perde um quadro aqui e outro ali, e a
 * medição ainda cai numa janela de três segundos que raramente começa junto com um quadro. O
 * resultado normal de uma transmissão SAUDÁVEL de 30 é 29; de 15 é 14.
 */
const TOLERANCIA = 0.9;

/**
 * O número que o olho lê, e não o que o contador mediu.
 *
 * O RELATO QUE MOTIVOU ISTO: "esses números quebrados, diferentes de 30/60, são lidos como 'tem
 * algum erro na transmissão'". E ele está certo — as duas telas que ele mandou, "360p · 14 fps" e
 * "1080p · 29 fps", eram as DUAS transmissões perfeitas: 14 é a camada de 15 e 29 é a de 30. A tela
 * estava transformando funcionamento normal em suspeita de defeito.
 *
 * Então a taxa volta para o alvo quando está dentro da tolerância, e só mostra o número cru quando
 * ele está mesmo longe — que é quando o número é informação, e não ruído. Nessa hora o conselheiro
 * de qualidade (QualityAdvisor) já está falando, e aí os dois dizem a mesma coisa.
 *
 * Isto NÃO é esconder problema: 22 fps continua aparecendo como 22.
 */
export function taxaRedonda(fps: number): number {
  const alvo = TAXAS.find((taxa) => fps >= taxa * TOLERANCIA && fps <= taxa);
  return alvo ?? Math.round(fps);
}

/**
 * A IMAGEM QUE CHEGA É NÍTIDA PARA O TAMANHO EM QUE ELA ESTÁ SENDO MOSTRADA?
 *
 * ===================================================================================================
 * O RELATO: "diz que estou a 576p mas a qualidade está agradável. O número dá uma sensação de falta
 * de qualidade." E antes disso, um 268p que também estava bom.
 *
 * O NÚMERO NÃO ESTÁ ERRADO — ele é o que o navegador decodificou. O que está errado é ele aparecer
 * SOZINHO, porque sozinho ele não responde à pergunta que a pessoa está fazendo, que é "está ruim?".
 *
 * Com `adaptiveStream` ligado (ver useVoice.ts), o Syden pede de propósito a camada que CABE no
 * quadro em que o vídeo está sendo desenhado. Janela menor, número menor — e isso é o sistema
 * funcionando, não degradando. Um 576p num quadro de 540 pixels de altura está sobrando resolução;
 * o mesmo 576p em tela cheia num monitor 4K está faltando. O número é o mesmo e a resposta é oposta.
 *
 * Por isso a conta é de RAZÃO, e não de altura: quantos pixels chegam para cada pixel de tela.
 * ===================================================================================================
 */
export interface Nitidez {
  /** Altura, em pixels de verdade, do espaço onde o vídeo está sendo desenhado. */
  precisa: number;
  /** Chega pelo menos o que a tela mostra? */
  nitida: boolean;
}

/**
 * NOVENTA POR CENTO, e não cem.
 *
 * A altura do quadro quase nunca bate exatamente com a da camada, e exigir igualdade faria quase
 * tudo cair em "abaixo" por causa de uma dúzia de pixels. Dez por cento de folga é menos do que o
 * olho percebe numa imagem em movimento.
 */
const FOLGA = 0.9;

export function nitidezNaTela(stats: StreamStats | null, elemento: HTMLElement | null | undefined): Nitidez | null {
  if (!stats?.height || !elemento) return null;
  const naTela = elemento.clientHeight;
  if (naTela <= 0) return null;
  // DEVICE PIXEL RATIO IMPORTA. Num monitor comum, um pixel de CSS é um pixel de verdade; numa tela
  // de retina ou num Windows a 150%, cada pixel de CSS são 1,5 ou 2 pixels. Sem multiplicar, uma
  // tela densa seria sempre declarada nítida quando não está.
  const precisa = Math.round(naTela * (globalThis.devicePixelRatio || 1));
  return { precisa, nitida: stats.height >= precisa * FOLGA };
}

/** "1080p · 60 fps" a partir da altura da imagem, como as pessoas falam de qualidade. */
export function describeStats(stats: StreamStats | null) {
  if (!stats || !stats.height) return null;
  const linhas = stats.height >= 2000 ? '4K' : `${stats.height}p`;
  // Os quadros por segundo só aparecem depois da segunda medição; antes disso, mostra só o tamanho.
  return stats.fps >= 1 ? `${linhas} · ${taxaRedonda(stats.fps)} fps` : linhas;
}

async function read(publication: Publication | undefined, local: boolean): Promise<StreamStats | null> {
  const track = publication?.track;
  if (!track) return null;
  try {
    const report = await track.getRTCStatsReport();
    if (!report) return null;
    let stats: StreamStats | null = null;
    let vistas = 0;
    let pausadas = 0;
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
      // 'active' é o próprio navegador dizendo que aquela camada está pausada.
      if (entry.active === false) pausadas += 1;
      vistas += 1;
      stats = {
        width,
        height,
        fps: Number(entry.framesPerSecond ?? 0),
        limitedBy: reason === 'cpu' || reason === 'bandwidth' || reason === 'none' ? reason : 'other',
        kbps: 0,
        codec: codecs.get(String(entry.codecId ?? '')) ?? null,
        encoder: typeof entry.encoderImplementation === 'string' ? entry.encoderImplementation : null,
        naPlaca: typeof entry.powerEfficientEncoder === 'boolean' ? entry.powerEfficientEncoder : null,
        semPublico: false,
      };
    });
    // Só vale a pena dizer "ninguém assistindo" quando existem camadas E nenhuma delas está correndo:
    // no primeiro segundo depois de começar, ainda não há relatório, e aí o certo é "medindo".
    // O `as` é por causa do estreitamento do TypeScript dentro do forEach: ele conclui que `stats`
    // continua nulo, porque não sabe que o callback já rodou. O valor é o que foi escrito ali dentro.
    const medido = stats as StreamStats | null;
    if (medido && vistas > 0 && pausadas === vistas) medido.semPublico = true;
    return medido;
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
