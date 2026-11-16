// A MONTAGEM DO CLIPE SEM RECODIFICAR (16/11/2026): os quadros copiados pelo gancho (ganchoDaCifra.ts) viram um arquivo,
// como vieram da rede, pela Mediabunny (MPL-2.0, já usada em clips.ts). VP8, VP9 e AV1 vão em WebM; o H.264 vai em MP4
// (o WebM não o aceita, e o Firefox não o tocaria lá). O som do jogo (Opus) vai junto, também sem recodificar.
//
// O RELÓGIO. Cada faixa traz o carimbo RTP dela (90 kHz no vídeo, 48 kHz no Opus), com um começo sorteado por quem
// transmite: os dois não se comparam. Os dois se comparam pela HORA DA CHEGADA, que treme com a rede. Por isso cada
// faixa ganha uma régua só: o carimbo RTP (que não treme) mais o menor (chegada − carimbo) da janela, que é o quadro
// que chegou mais depressa. O vídeo e o som ficam juntos a menos que a diferença de atraso entre as duas faixas.
import type { QuadroCru } from './ganchoDaCifra';

export interface Janela {
  video: QuadroCru[];
  /** A hora (ms, a mesma régua da chegada) de cada quadro de vídeo. */
  tempoDoVideo: number[];
  audio: QuadroCru[];
  tempoDoAudio: number[];
  /** O começo do clipe: a hora do quadro-chave que o abre. */
  inicio: number;
  /** O fim: a hora do último quadro de vídeo. */
  fim: number;
}

/** A hora de cada quadro pela régua da faixa (ver o alto do arquivo). `hz` é o relógio do RTP. */
export function regua(quadros: QuadroCru[], hz: number): number[] {
  if (!quadros.length) return [];
  let acumulado = 0;
  let anterior = quadros[0].rtp >>> 0;
  const desdeOPrimeiro = quadros.map((q) => {
    const atual = q.rtp >>> 0;
    let passo = (atual - anterior) >>> 0;
    // um carimbo que anda para trás (reordenação, ou a volta dos 32 bits ao contrário) conta como zero
    if (passo > 0x7fffffff) passo = 0;
    acumulado += passo;
    anterior = atual;
    return (acumulado * 1000) / hz;
  });
  let deslocamento = Infinity;
  for (let i = 0; i < quadros.length; i++) deslocamento = Math.min(deslocamento, quadros[i].t - desdeOPrimeiro[i]);
  return desdeOPrimeiro.map((ms) => ms + deslocamento);
}

/**
 * A janela de `segundos` que termina no último quadro de vídeo, começando no quadro-chave mais perto ANTES do começo
 * pedido (ou, sem nenhum antes, no primeiro depois dele). Null quando não há quadro-chave nenhum.
 */
export function escolherJanela(video: QuadroCru[], audio: QuadroCru[], segundos = 30): Janela | null {
  if (!video.length) return null;
  const alvo = video[video.length - 1].t - segundos * 1000;
  let k = -1;
  for (let i = video.length - 1; i >= 0; i--) {
    if (video[i].tipo === 'key' && video[i].t <= alvo) {
      k = i;
      break;
    }
  }
  if (k < 0) k = video.findIndex((q) => q.tipo === 'key');
  if (k < 0) return null;
  const v = video.slice(k);
  const tempoDoVideo = regua(v, 90_000);
  const inicio = tempoDoVideo[0];
  const fim = tempoDoVideo[tempoDoVideo.length - 1];
  const todoAudio = regua(audio, 48_000);
  const a: QuadroCru[] = [];
  const tempoDoAudio: number[] = [];
  for (let i = 0; i < audio.length; i++) {
    if (todoAudio[i] >= inicio && todoAudio[i] <= fim + 20) {
      a.push(audio[i]);
      tempoDoAudio.push(todoAudio[i]);
    }
  }
  return { video: v, tempoDoVideo, audio: a, tempoDoAudio, inicio, fim };
}

/** O codec do vídeo para a Mediabunny e para o WebCodecs, pelo tipo que o WebRTC diz. */
export function codecDoVideo(mime: string | undefined): { codec: 'vp8' | 'vp9' | 'av1' | 'avc'; config: string; mp4: boolean } | null {
  switch ((mime ?? '').toLowerCase()) {
    case 'video/vp8':
      return { codec: 'vp8', config: 'vp8', mp4: false };
    case 'video/vp9':
      return { codec: 'vp9', config: 'vp09.00.10.08', mp4: false };
    case 'video/av1':
      return { codec: 'av1', config: 'av01.0.04M.08', mp4: false };
    case 'video/h264':
      return { codec: 'avc', config: 'avc1.42001f', mp4: true };
    default:
      return null;
  }
}

export interface ArquivoCru {
  blob: Blob;
  segundos: number;
  /** 'video/webm' ou 'video/mp4' (sem os codecs no nome: com eles o envio ganha ponto e vírgula e o servidor recusa). */
  tipo: 'video/webm' | 'video/mp4';
}

/** Monta o arquivo da janela, sem recodificar nada. */
export async function montarArquivo(j: Janela): Promise<ArquivoCru> {
  const mb = await import('mediabunny');
  const primeiro = j.video[0];
  const qual = codecDoVideo(primeiro.mime ?? j.video.find((q) => q.mime)?.mime);
  if (!qual) throw new Error('codec de vídeo desconhecido: ' + primeiro.mime);
  const largura = primeiro.w || Math.max(...j.video.map((q) => q.w ?? 0)) || 1920;
  const altura = primeiro.h || Math.max(...j.video.map((q) => q.h ?? 0)) || 1080;

  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: qual.mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
    target,
  });
  const fonteDoVideo = new mb.EncodedVideoPacketSource(qual.codec);
  output.addVideoTrack(fonteDoVideo);
  const fonteDoSom = j.audio.length ? new mb.EncodedAudioPacketSource('opus') : null;
  if (fonteDoSom) output.addAudioTrack(fonteDoSom);
  await output.start();

  // vídeo e som entram intercalados pela hora, como o arquivo os guarda
  const s = (ms: number) => Math.max(0, (ms - j.inicio) / 1000);
  let iv = 0;
  let ia = 0;
  let primeiroVideo = true;
  let primeiroSom = true;
  while (iv < j.video.length || ia < j.audio.length) {
    const vezDoVideo = ia >= j.audio.length || (iv < j.video.length && j.tempoDoVideo[iv] <= j.tempoDoAudio[ia]);
    if (vezDoVideo) {
      const q = j.video[iv];
      const t = s(j.tempoDoVideo[iv]);
      const proximo = iv + 1 < j.video.length ? s(j.tempoDoVideo[iv + 1]) : t + 1 / 30;
      const pacote = new mb.EncodedPacket(new Uint8Array(q.dados), q.tipo === 'key' ? 'key' : 'delta', t, Math.max(0, proximo - t));
      await fonteDoVideo.add(pacote, primeiroVideo ? { decoderConfig: { codec: qual.config, codedWidth: largura, codedHeight: altura } } : undefined);
      primeiroVideo = false;
      iv++;
    } else {
      const q = j.audio[ia];
      const t = s(j.tempoDoAudio[ia]);
      await fonteDoSom!.add(
        new mb.EncodedPacket(new Uint8Array(q.dados), 'key', t, 0.02),
        primeiroSom ? { decoderConfig: { codec: 'opus', sampleRate: 48_000, numberOfChannels: 2 } } : undefined,
      );
      primeiroSom = false;
      ia++;
    }
  }
  await output.finalize();
  if (!target.buffer) throw new Error('O clipe saiu vazio.');
  const tipo = qual.mp4 ? 'video/mp4' : 'video/webm';
  return { blob: new Blob([target.buffer], { type: tipo }), segundos: (j.fim - j.inicio) / 1000, tipo };
}
