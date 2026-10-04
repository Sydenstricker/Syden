import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import { connectVoiceEffect, type VoiceEffectId } from './voiceEffects';

/*
 * O CAMINHO DO MICROFONE: supressão de ruído primeiro, modificador de voz depois.
 *
 * O LiveKit aceita UM processador por faixa, então os dois moram no mesmo — senão ligar o efeito de
 * voz desligaria a supressão, e vice-versa.
 *
 * A SUPRESSÃO É O GTCRN (ver web/public/ruido/ORIGEM.txt), escolhido em 04/10/2026 depois de medir quatro
 * modelos na gravação real de um ventilador. Notas DNSMOS (geral, 1 a 5): o Chrome sozinho 2,52; o
 * GTCRN por cima do Chrome 3,08. Ele roda por cima da supressão do próprio navegador, que continua
 * ligada: medido, os dois juntos limparam um pouco mais do que o GTCRN sozinho (3,08 contra 3,01), e
 * se o modelo falhar, a do navegador já está lá — a pessoa não fica sem nada.
 *
 * EM JAVASCRIPT PURO, SEM WEBASSEMBLY, e isso é decisão de segurança, não de gosto: WebAssembly exigiria
 * 'wasm-unsafe-eval' na política do site, e o Sydenstricker decidiu não dar essa permissão. O modelo
 * custa uns 2 ms a cada 16 ms de áudio (13% de um núcleo de um Ryzen 7 3700X, medido).
 *
 * O GTCRN trabalha a 16 kHz: o caminho inteiro roda num AudioContext próprio de 16 kHz, e o navegador
 * converte na entrada e na saída. Voz em 16 kHz é a de chamada de boa qualidade — o Opus da sala manda
 * isso mesmo para voz.
 */

const BASE = import.meta.env.BASE_URL + 'ruido/';

let modelo: Promise<{ grafo: unknown; pesos: ArrayBuffer }> | null = null;

/** Baixa o modelo uma vez por visita (345 KB, guardados pelo cache do navegador depois). */
function carregarModelo() {
  modelo ??= Promise.all([
    fetch(BASE + 'gtcrn.json').then((r) => {
      if (!r.ok) throw new Error(`gtcrn.json: ${r.status}`);
      return r.json() as Promise<unknown>;
    }),
    fetch(BASE + 'gtcrn.bin').then((r) => {
      if (!r.ok) throw new Error(`gtcrn.bin: ${r.status}`);
      return r.arrayBuffer();
    }),
  ])
    .then(([grafo, pesos]) => ({ grafo, pesos }))
    .catch((e) => {
      modelo = null; // deixa tentar de novo na próxima vez, em vez de lembrar o erro para sempre
      throw e;
    });
  return modelo;
}

/** O navegador consegue rodar a supressão do Syden? (AudioWorklet existe em todo navegador atual.) */
export function supressaoDisponivel(): boolean {
  return typeof AudioWorkletNode !== 'undefined';
}

function comCuidado(fn: () => void) {
  try {
    fn();
  } catch {
    // Já parado ou já solto: era isso que se queria.
  }
}

export interface OpcoesDoMicrofone {
  efeito: VoiceEffectId;
  supressao: boolean;
  /** Recebe, de tempos em tempos, quanto cada quadro de 16 ms custou na thread de áudio. */
  aoMedirCusto?: (msPorQuadro: number) => void;
}

export class ProcessadorDoMicrofone implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = 'syden-microfone';
  processedTrack?: MediaStreamTrack;
  private contexto?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private supressor?: AudioWorkletNode;
  private destination?: MediaStreamAudioDestinationNode;
  private pararEfeito: () => void = () => {};
  private geracao = 0;

  constructor(private readonly opcoes: OpcoesDoMicrofone) {}

  async init(options: AudioProcessorOptions) {
    await this.montar(options);
  }

  async restart(options: AudioProcessorOptions) {
    await this.montar(options);
  }

  async destroy() {
    this.geracao++;
    this.desmontar();
    this.processedTrack = undefined;
  }

  private async montar(options: AudioProcessorOptions) {
    // Desmonta antes de montar: `init` e `restart` podem vir sem `destroy` no meio (trocar de
    // microfone, por exemplo), e sem isto ficariam dois caminhos de som vivos ao mesmo tempo.
    const minha = ++this.geracao;
    this.desmontar();

    let ctx: AudioContext = options.audioContext;
    let entrada: AudioNode;
    if (this.opcoes.supressao) {
      const { grafo, pesos } = await carregarModelo();
      if (minha !== this.geracao) return; // desmontado enquanto baixava
      ctx = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
      this.contexto = ctx;
      await ctx.audioWorklet.addModule(BASE + 'gtcrn.worklet.js');
      await ctx.resume().catch(() => {});
      if (minha !== this.geracao) return;
      this.source = ctx.createMediaStreamSource(new MediaStream([options.track]));
      this.supressor = new AudioWorkletNode(ctx, 'syden-gtcrn', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        processorOptions: { grafo, pesos },
      });
      this.supressor.port.onmessage = (e) => {
        const custo = (e.data as { custoMsPorQuadro?: number })?.custoMsPorQuadro;
        if (typeof custo === 'number') this.opcoes.aoMedirCusto?.(custo);
      };
      this.source.connect(this.supressor);
      entrada = this.supressor;
    } else {
      this.source = ctx.createMediaStreamSource(new MediaStream([options.track]));
      entrada = this.source;
    }

    this.destination = ctx.createMediaStreamDestination();
    this.pararEfeito = connectVoiceEffect(ctx, this.opcoes.efeito, entrada, this.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }

  private desmontar() {
    comCuidado(() => this.pararEfeito());
    this.pararEfeito = () => {};
    comCuidado(() => this.source?.disconnect());
    comCuidado(() => this.supressor?.disconnect());
    comCuidado(() => this.supressor?.port.close());
    comCuidado(() => this.destination?.disconnect());
    // O som processado sai por uma faixa própria, criada aqui. Sem encerrá-la, cada troca deixa mais
    // uma faixa viva presa ao contexto de áudio.
    for (const faixa of this.destination?.stream.getTracks() ?? []) comCuidado(() => faixa.stop());
    // O contexto de 16 kHz é nosso (o do LiveKit não se fecha aqui): fechá-lo para a thread de áudio.
    if (this.contexto) void this.contexto.close().catch(() => {});
    this.contexto = undefined;
    this.source = undefined;
    this.supressor = undefined;
    this.destination = undefined;
  }
}
