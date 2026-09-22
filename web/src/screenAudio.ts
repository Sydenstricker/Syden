import { desktopBridge } from './desktop';

// Som da transmissão vindo do app de desktop: lá o Windows entrega o som do computador MENOS o do
// próprio Syden, e aqui ele vira uma faixa de áudio comum, que a chamada publica junto com a imagem.
// No navegador isso não existe (página nenhuma pode falar com o Windows desse jeito), e então o som
// continua vindo pelo caminho de sempre — o que o seletor de tela do navegador der.

const SAMPLE_RATE = 48000;
// O tocador de som cru mora em web/public, como arquivo mesmo: o audioWorklet precisa de um endereço de
// verdade para buscar, e um arquivo pequeno embutido no meio do pacote não serve.
const WORKLET_URL = import.meta.env.BASE_URL + 'pcm-player.worklet.js';

export interface AppAudio {
  track: MediaStreamTrack;
  stop: () => void;
}

/** O app consegue mandar o som sem devolver as vozes da chamada junto? */
export async function appAudioSupported(): Promise<boolean> {
  try {
    return (await desktopBridge?.screenAudio?.available()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Liga a captura e devolve a faixa de áudio pronta para publicar (ou null, quando não há como).
 * Chamar de novo sem parar a anterior não faz sentido: pare a antiga primeiro.
 */
export async function captureAppAudio(): Promise<AppAudio | null> {
  const bridge = desktopBridge?.screenAudio;
  if (!bridge) return null;

  let started: { ok: boolean } | undefined;
  try {
    started = await bridge.start();
  } catch {
    return null;
  }
  if (!started?.ok) return null;

  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  // O contexto pode nascer parado (a captura começa longe do clique que abriu o seletor de tela).
  await context.resume().catch(() => {});
  try {
    await context.audioWorklet.addModule(WORKLET_URL);
  } catch (error) {
    console.error(error);
    bridge.stop();
    void context.close();
    return null;
  }

  const player = new AudioWorkletNode(context, 'syden-pcm', { outputChannelCount: [2] });
  const destination = context.createMediaStreamDestination();
  player.connect(destination);
  const unsubscribe = bridge.onChunk((pcm) => player.port.postMessage(pcm, [pcm.buffer]));

  const track = destination.stream.getAudioTracks()[0];
  return {
    track,
    stop: () => {
      unsubscribe();
      bridge.stop();
      player.disconnect();
      track.stop();
      void context.close();
    },
  };
}
