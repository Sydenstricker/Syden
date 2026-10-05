import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import { desktopBridge } from './desktop';
import { connectVoiceEffect, type VoiceEffectId } from './voiceEffects';

/*
 * O CAMINHO DO MICROFONE: supressão de ruído primeiro, modificador de voz depois.
 *
 * O LiveKit aceita UM processador por faixa, então os dois moram no mesmo — senão ligar o efeito de
 * voz desligaria a supressão, e vice-versa.
 *
 * A SUPRESSÃO TEM DOIS MOTORES, escolhidos em 04/10/2026 depois de medir seis modelos na gravação real
 * de um ventilador (DNSMOS, nota geral de 1 a 5; o Chrome sozinho, que era o de antes, deu 2,52):
 *
 *   - NO APP DE DESKTOP: o DPDFNet (Ceva, Apache 2.0), nativo, num processo à parte — 3,26. Ver
 *     desktop/src/ruido. O som vai e volta por uma MessagePort ligada direto à thread de áudio
 *     (web/public/ruido/ponte.worklet.js).
 *   - NO SITE (e no app, se o nativo falhar): o GTCRN (MIT), em JavaScript puro — 3,08. Ver
 *     web/public/ruido/ORIGEM.txt.
 *
 * NADA DE WEBASSEMBLY, e isso é decisão de segurança, não de gosto: WebAssembly exigiria
 * 'wasm-unsafe-eval' na política do site, e o Sydenstricker decidiu não dar essa permissão. Provado com
 * e2e/supressao-de-ruido.mjs (COM_CSP=1): a política de hoje não barra nada deste caminho.
 *
 * OS DOIS RODAM POR CIMA DA SUPRESSÃO DO PRÓPRIO NAVEGADOR, que continua ligada: medido, juntos limpam
 * o mesmo ou um pouco mais, e se o modelo falhar a do navegador já está lá.
 *
 * Os dois trabalham a 16 kHz: o caminho inteiro roda num AudioContext próprio de 16 kHz, e o navegador
 * converte na entrada e na saída. Voz em 16 kHz é a de chamada de boa qualidade.
 */

const BASE = import.meta.env.BASE_URL + 'ruido/';

export type MotorDeRuido = 'dpdfnet' | 'gtcrn';

/** O nome que aparece para a pessoa, em Configurações ("Com tecnologia DPDFNet"). */
export const NOME_DO_MOTOR: Record<MotorDeRuido, string> = { dpdfnet: 'DPDFNet', gtcrn: 'GTCRN' };

/*
 * QUAL MOTOR ESTÁ RODANDO AGORA, para Configurações dizer — como o Discord diz que a supressão é do Krisp.
 * Pedido do Sydenstricker (05/10/2026), depois de um amigo reclamar da voz: saber o que está sendo usado
 * ajuda a pessoa a entender a diferença entre o app e o site, e mostra na hora quando o nativo caiu e o
 * GTCRN assumiu. null quando não há chamada.
 */
let motorEmUso: MotorDeRuido | null = null;
const ouvintes = new Set<() => void>();
function definirMotorEmUso(motor: MotorDeRuido | null) {
  if (motorEmUso === motor) return;
  motorEmUso = motor;
  for (const avisar of ouvintes) avisar();
}
export function lerMotorEmUso() {
  return motorEmUso;
}
export function aoMudarMotor(avisar: () => void) {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

/** Sem chamada, o motor que ESTE aparelho usaria: o nativo no app que o tem, o GTCRN no resto. */
export async function motorPrevisto(): Promise<MotorDeRuido> {
  const disponivel = await desktopBridge?.ruido?.disponivel().catch(() => false);
  return disponivel ? 'dpdfnet' : 'gtcrn';
}

let modelo: Promise<{ grafo: unknown; pesos: ArrayBuffer }> | null = null;

/** Baixa o GTCRN uma vez por visita (345 KB, guardados pelo cache do navegador depois). */
function carregarGtcrn() {
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

/**
 * Pede ao app uma porta para a supressão nativa. null no navegador, quando o app diz que não tem
 * (outro sistema, modelo ausente, processo caindo demais) ou quando a porta não chega a tempo.
 */
async function abrirPortaNativa(): Promise<MessagePort | null> {
  const ruido = desktopBridge?.ruido;
  if (!ruido || !(await ruido.disponivel().catch(() => false))) return null;
  return new Promise((pronto) => {
    const aoReceber = (evento: MessageEvent) => {
      if (evento.source !== window || evento.data !== 'syden-ruido-porta' || !evento.ports[0]) return;
      encerrar();
      pronto(evento.ports[0]);
    };
    const prazo = setTimeout(() => {
      encerrar();
      pronto(null);
    }, 3000);
    const encerrar = () => {
      clearTimeout(prazo);
      window.removeEventListener('message', aoReceber);
    };
    window.addEventListener('message', aoReceber);
    ruido.abrir();
  });
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
  /** De tempos em tempos: qual motor está rodando e quanto cada quadro custou. */
  aoMedirCusto?: (medida: { motor: MotorDeRuido; msPorQuadro: number; quadroMs: number; faltas?: number }) => void;
  /** O motor nativo falhou no meio da chamada e o GTCRN assumiu: o motivo, para o diário de saúde. */
  aoTrocarDeMotor?: (motivo: string) => void;
}

export class ProcessadorDoMicrofone implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = 'syden-microfone';
  processedTrack?: MediaStreamTrack;
  private contexto?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private supressor?: AudioWorkletNode;
  /** Onde a supressão entrega e o efeito de voz começa. Trocar de motor é trocar o que liga aqui. */
  private meio?: GainNode;
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
    definirMotorEmUso(null);
    this.processedTrack = undefined;
  }

  private async montar(options: AudioProcessorOptions) {
    // Desmonta antes de montar: `init` e `restart` podem vir sem `destroy` no meio (trocar de
    // microfone, por exemplo), e sem isto ficariam dois caminhos de som vivos ao mesmo tempo.
    const minha = ++this.geracao;
    this.desmontar();

    if (!this.opcoes.supressao) {
      definirMotorEmUso(null);
      const ctx = options.audioContext;
      this.source = ctx.createMediaStreamSource(new MediaStream([options.track]));
      this.destination = ctx.createMediaStreamDestination();
      this.pararEfeito = connectVoiceEffect(ctx, this.opcoes.efeito, this.source, this.destination);
      this.processedTrack = this.destination.stream.getAudioTracks()[0];
      return;
    }

    // O motor nativo primeiro (só existe no app); sem ele, o GTCRN.
    const porta = await abrirPortaNativa();
    if (minha !== this.geracao) {
      porta?.close();
      return;
    }
    const ctx = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
    this.contexto = ctx;
    await ctx.resume().catch(() => {});

    this.source = ctx.createMediaStreamSource(new MediaStream([options.track]));
    this.meio = ctx.createGain();
    this.destination = ctx.createMediaStreamDestination();
    this.pararEfeito = connectVoiceEffect(ctx, this.opcoes.efeito, this.meio, this.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];

    if (porta) {
      try {
        await this.ligarNativo(ctx, porta);
        return;
      } catch (e) {
        porta.close();
        this.opcoes.aoTrocarDeMotor?.(`O nativo não montou: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await this.ligarGtcrn(ctx, minha);
  }

  private async ligarNativo(ctx: AudioContext, porta: MessagePort) {
    await ctx.audioWorklet.addModule(BASE + 'ponte.worklet.js');
    const ponte = new AudioWorkletNode(ctx, 'syden-ponte-ruido', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
    });
    ponte.port.onmessage = (e) => {
      const d = e.data as { custoMsPorQuadro?: number; quadroMs?: number; faltas?: number; falhou?: string };
      if (typeof d?.custoMsPorQuadro === 'number') {
        this.opcoes.aoMedirCusto?.({ motor: 'dpdfnet', msPorQuadro: d.custoMsPorQuadro, quadroMs: d.quadroMs ?? 10, faltas: d.faltas });
      }
      if (d?.falhou) {
        // O processo nativo caiu ou parou de responder: o GTCRN assume no mesmo lugar, e a faixa que
        // o LiveKit está publicando continua a mesma — quem ouve só percebe a troca de timbre.
        this.opcoes.aoTrocarDeMotor?.(d.falhou);
        const geracao = this.geracao;
        void this.ligarGtcrn(ctx, geracao).catch((erro) => this.opcoes.aoTrocarDeMotor?.(`GTCRN também falhou: ${String(erro)}`));
      }
    };
    ponte.port.postMessage({ porta }, [porta]);
    this.trocarSupressor(ponte);
    definirMotorEmUso('dpdfnet');
  }

  private async ligarGtcrn(ctx: AudioContext, geracao: number) {
    const { grafo, pesos } = await carregarGtcrn();
    await ctx.audioWorklet.addModule(BASE + 'gtcrn.worklet.js');
    if (geracao !== this.geracao || ctx.state === 'closed') return;
    const gtcrn = new AudioWorkletNode(ctx, 'syden-gtcrn', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      processorOptions: { grafo, pesos },
    });
    gtcrn.port.onmessage = (e) => {
      const custo = (e.data as { custoMsPorQuadro?: number })?.custoMsPorQuadro;
      if (typeof custo === 'number') this.opcoes.aoMedirCusto?.({ motor: 'gtcrn', msPorQuadro: custo, quadroMs: 16 });
    };
    this.trocarSupressor(gtcrn);
    definirMotorEmUso('gtcrn');
  }

  /** Põe um motor entre o microfone e o efeito de voz, tirando o que estava lá. */
  private trocarSupressor(novo: AudioWorkletNode) {
    if (!this.source || !this.meio) return;
    const antigo = this.supressor;
    this.supressor = novo;
    this.source.connect(novo);
    novo.connect(this.meio);
    if (antigo) {
      comCuidado(() => antigo.port.postMessage({ fechar: true }));
      comCuidado(() => this.source?.disconnect(antigo));
      comCuidado(() => antigo.disconnect());
      comCuidado(() => antigo.port.close());
    }
  }

  private desmontar() {
    comCuidado(() => this.pararEfeito());
    this.pararEfeito = () => {};
    comCuidado(() => this.source?.disconnect());
    comCuidado(() => this.supressor?.port.postMessage({ fechar: true }));
    comCuidado(() => this.supressor?.disconnect());
    comCuidado(() => this.supressor?.port.close());
    comCuidado(() => this.meio?.disconnect());
    comCuidado(() => this.destination?.disconnect());
    // O som processado sai por uma faixa própria, criada aqui. Sem encerrá-la, cada troca deixa mais
    // uma faixa viva presa ao contexto de áudio.
    for (const faixa of this.destination?.stream.getTracks() ?? []) comCuidado(() => faixa.stop());
    // O contexto de 16 kHz é nosso (o do LiveKit não se fecha aqui): fechá-lo solta a thread de áudio
    // e, com ela, a porta da supressão nativa.
    if (this.contexto) void this.contexto.close().catch(() => {});
    this.contexto = undefined;
    this.source = undefined;
    this.supressor = undefined;
    this.meio = undefined;
    this.destination = undefined;
  }
}
