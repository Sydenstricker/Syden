import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';

// Modificador de voz: o som do microfone passa por uma cadeia de efeitos do próprio navegador antes de
// sair para a chamada. Não custa nada (roda no computador de quem fala) e não depende de servidor.

export type VoiceEffectId = 'none' | 'female' | 'male' | 'radio' | 'helicopter' | 'robot' | 'deep' | 'chipmunk' | 'cave';

export const VOICE_EFFECTS: { id: VoiceEffectId; name: string; hint: string }[] = [
  { id: 'none', name: 'Sua voz', hint: 'Sem efeito nenhum.' },
  { id: 'female', name: 'Voz feminina', hint: 'Tom mais alto e mais claro.' },
  { id: 'male', name: 'Voz masculina', hint: 'Tom mais baixo e mais encorpado.' },
  { id: 'radio', name: 'Rádio de avião', hint: 'Voz espremida e chiada, como a do piloto no rádio.' },
  { id: 'helicopter', name: 'Helicóptero', hint: 'Corta a voz em batidas, como as pás girando.' },
  { id: 'robot', name: 'Robô', hint: 'Voz metálica de robô de filme antigo.' },
  { id: 'deep', name: 'Monstro', hint: 'Voz bem mais grave e pesada.' },
  { id: 'chipmunk', name: 'Esquilo', hint: 'Voz fininha, de desenho animado.' },
  { id: 'cave', name: 'Caverna', hint: 'Eco de lugar grande e vazio.' },
];

export function voiceEffectName(id: VoiceEffectId): string {
  return VOICE_EFFECTS.find((e) => e.id === id)?.name ?? 'Sua voz';
}

/** Saturação suave: o que dá o "chiado" do rádio e o peso do monstro, sem estourar o som. */
function saturation(drive: number): Float32Array<ArrayBuffer> {
  const points = 1024;
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i * 2) / (points - 1) - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.9, gain = 0): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  node.gain.value = gain;
  return node;
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

/** Faz o que pode e não deixa um erro impedir o resto da limpeza. */
function comCuidado(fn: () => void) {
  try {
    fn();
  } catch {
    // Nó já parado ou já solto: era isso que se queria mesmo.
  }
}

/** Liga uma fila de nós em sequência, do primeiro ao último. */
function chain(...nodes: AudioNode[]) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

/**
 * Muda o tom da voz (mais grave ou mais agudo) sem mudar a velocidade da fala.
 *
 * O truque, clássico: o som passa por um atraso que cresce (ou encolhe) o tempo todo — como quem se afasta
 * de uma sirene, o tom cai. Quando o atraso chega ao fim do seu percurso ele precisa voltar ao começo, e esse
 * salto daria um estalo; por isso são duas linhas iguais, defasadas pela metade, e o volume de cada uma sobe
 * e desce em cruz, de modo que sempre se ouve a que está longe do salto.
 */
function pitchShift(ctx: BaseAudioContext, input: AudioNode, output: AudioNode, ratio: number): () => void {
  const grain = 0.09; // duração de cada "pedaço" de som, em segundos
  const span = grain * Math.abs(1 - ratio); // o quanto o atraso varia dentro de um pedaço
  const length = Math.round(grain * ctx.sampleRate);

  // Rampa do atraso: sobe para deixar a voz grave, desce para deixá-la aguda.
  const ramp = ctx.createBuffer(1, length, ctx.sampleRate);
  const rampData = ramp.getChannelData(0);
  // Envelope de volume: vale zero nas pontas, que é justo onde a rampa salta.
  const fade = ctx.createBuffer(1, length, ctx.sampleRate);
  const fadeData = fade.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    rampData[i] = ratio < 1 ? t : 1 - t;
    fadeData[i] = Math.sin(Math.PI * t);
  }

  const sources: AudioBufferSourceNode[] = [];
  const start = ctx.currentTime + 0.02;
  for (const offset of [0, grain / 2]) {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0;

    const rampSource = ctx.createBufferSource();
    rampSource.buffer = ramp;
    rampSource.loop = true;
    const rampDepth = gain(ctx, span);
    rampSource.connect(rampDepth).connect(delay.delayTime);

    const window = gain(ctx, 0);
    const fadeSource = ctx.createBufferSource();
    fadeSource.buffer = fade;
    fadeSource.loop = true;
    fadeSource.connect(window.gain);

    chain(input, delay, window, output);
    rampSource.start(start + offset);
    fadeSource.start(start + offset);
    sources.push(rampSource, fadeSource);
  }

  // Cada um para por conta própria: se um falhasse no meio, os outros continuariam tocando para sempre,
  // gastando processador a cada troca de efeito até a chamada começar a engasgar.
  return () => sources.forEach((source) => comCuidado(() => source.stop()));
}

/**
 * Monta o efeito escolhido entre `input` e `output` e devolve a função que o desliga.
 *
 * Regra de ouro daqui: todo efeito é filtro ou multiplicação do som que entra — nenhum deles produz som
 * sozinho. Assim, com o microfone mudo, o que sai continua sendo silêncio.
 */
export function connectVoiceEffect(ctx: BaseAudioContext, effect: VoiceEffectId, input: AudioNode, output: AudioNode): () => void {
  switch (effect) {
    case 'female': {
      // Voz feminina: o tom sobe um pouco (bem menos que o esquilo) e o brilho dos agudos aumenta, que é
      // o que o ouvido usa para reconhecer uma voz mais fina. Fica convincente em voz grave; em voz que já
      // é aguda, soa só um pouco mais clara.
      const body = filter(ctx, 'highpass', 160, 0.7);
      const stop = pitchShift(ctx, input, body, 1.26);
      chain(body, filter(ctx, 'peaking', 3800, 1.1, 5), filter(ctx, 'highshelf', 6000, 0.7, 3), gain(ctx, 0.74), output);
      return stop;
    }

    case 'male': {
      // Voz masculina: o caminho contrário — tom um pouco abaixo e mais corpo nos graves.
      const body = filter(ctx, 'lowpass', 5000, 0.7);
      const stop = pitchShift(ctx, input, body, 0.8);
      chain(body, filter(ctx, 'lowshelf', 260, 0.7, 5), filter(ctx, 'peaking', 700, 1, 2), gain(ctx, 0.81), output);
      return stop;
    }

    case 'radio': {
      // Faixa estreita de rádio (nada de grave nem de agudo) + saturação, que é o que dá o chiado.
      const drive = ctx.createWaveShaper();
      drive.curve = saturation(5);
      drive.oversample = '2x';
      chain(input, filter(ctx, 'highpass', 700, 0.8), filter(ctx, 'lowpass', 2600, 0.8), drive);
      chain(drive, filter(ctx, 'peaking', 1700, 1.2, 6), filter(ctx, 'lowpass', 3000, 0.7), gain(ctx, 0.4), output);
      return () => {};
    }

    case 'helicopter': {
      // A voz passa por um volume que abre e fecha nove vezes por segundo: as pás.
      const chop = gain(ctx, 0.5);
      const blades = ctx.createOscillator();
      blades.frequency.value = 9;
      blades.connect(gain(ctx, 0.5)).connect(chop.gain);
      blades.start();

      const drive = ctx.createWaveShaper();
      drive.curve = saturation(2.5);
      chain(input, filter(ctx, 'highpass', 400, 0.8), filter(ctx, 'lowpass', 2600, 0.8), drive, chop);
      chain(chop, gain(ctx, 1.1), output);
      return () => comCuidado(() => blades.stop());
    }

    case 'robot': {
      // Multiplicar a voz por um tom grave quebra ela em faixas metálicas — o robô de filme antigo.
      const ring = gain(ctx, 0);
      const carrier = ctx.createOscillator();
      carrier.frequency.value = 42;
      carrier.connect(ring.gain);
      carrier.start();

      chain(input, filter(ctx, 'highpass', 200, 0.7), ring);
      chain(ring, filter(ctx, 'peaking', 1200, 1.5, 6), gain(ctx, 1.3), output);
      return () => comCuidado(() => carrier.stop());
    }

    case 'deep': {
      // Tom bem mais baixo e menos agudo, para a voz ficar pesada.
      const body = filter(ctx, 'lowpass', 2400, 0.7);
      const stop = pitchShift(ctx, input, body, 0.72);
      chain(body, filter(ctx, 'peaking', 180, 1, 5), gain(ctx, 0.78), output);
      return stop;
    }

    case 'chipmunk': {
      const body = filter(ctx, 'highpass', 250, 0.7);
      const stop = pitchShift(ctx, input, body, 1.5);
      chain(body, gain(ctx, 0.72), output);
      return stop;
    }

    case 'cave': {
      // Repete o som cada vez mais baixo e mais abafado, como eco batendo na parede.
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.22;
      const feedback = gain(ctx, 0.4);
      chain(delay, filter(ctx, 'lowpass', 2000, 0.7), feedback, delay);
      chain(input, delay, gain(ctx, 0.65), output);
      chain(input, gain(ctx, 0.85), output);
      return () => comCuidado(() => feedback.disconnect());
    }

    default:
      input.connect(output);
      return () => {};
  }
}

/**
 * Encaixa o efeito no microfone que já está indo para a chamada (o LiveKit troca o áudio enviado pelo
 * daqui). O `restart` é chamado quando o microfone reinicia — ao trocar de aparelho, por exemplo.
 */
export class VoiceEffectProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = 'syden-voice-effect';
  processedTrack?: MediaStreamTrack;
  private source?: MediaStreamAudioSourceNode;
  private destination?: MediaStreamAudioDestinationNode;
  private stopEffect: () => void = () => {};

  constructor(private readonly effect: VoiceEffectId) {}

  async init(options: AudioProcessorOptions) {
    // Desmonta antes de montar: `init` pode ser chamado de novo sem `destroy` no meio (ao trocar de
    // microfone, por exemplo), e sem isto ficariam dois caminhos de som vivos ao mesmo tempo.
    this.teardown();
    this.build(options.audioContext, options.track);
  }

  async restart(options: AudioProcessorOptions) {
    this.teardown();
    this.build(options.audioContext, options.track);
  }

  async destroy() {
    this.teardown();
    this.processedTrack = undefined;
  }

  private build(ctx: AudioContext, track: MediaStreamTrack) {
    this.source = ctx.createMediaStreamSource(new MediaStream([track]));
    this.destination = ctx.createMediaStreamDestination();
    this.stopEffect = connectVoiceEffect(ctx, this.effect, this.source, this.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }

  private teardown() {
    try {
      this.stopEffect();
    } catch {
      // Já parado: nada a fazer.
    }
    this.stopEffect = () => {};
    comCuidado(() => this.source?.disconnect());
    comCuidado(() => this.destination?.disconnect());
    // O som processado sai por uma faixa própria, criada aqui. Sem encerrá-la, cada troca de efeito
    // deixa mais uma faixa viva presa ao contexto de áudio.
    for (const faixa of this.destination?.stream.getTracks() ?? []) comCuidado(() => faixa.stop());
    this.source = undefined;
    this.destination = undefined;
  }
}
