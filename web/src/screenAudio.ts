import { desktopBridge } from './desktop';
import { comTeto } from './limitador';

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
 *
 * `aoProblema` recebe, em poucas palavras, cada coisa que deixa a transmissão sem som (16/10/2026, relato dele: "a
 * stream foi em tela cheia, com som, mas saiu sem som"). Antes, cada etapa desistia calada e não havia como saber qual
 * falhou: agora o motivo vai para o diário da aba de saúde, e o VIGIA conta, durante a transmissão, se o som do Windows
 * continua chegando (a queixa de 15/10, "o som cai depois de 1 s", também cai aqui).
 */
export async function captureAppAudio(aoProblema: (motivo: string) => void = () => {}): Promise<AppAudio | null> {
  const bridge = desktopBridge?.screenAudio;
  if (!bridge) return null;

  let started: { ok: boolean } | undefined;
  try {
    started = await bridge.start();
  } catch (e) {
    aoProblema('a captura do Windows deu erro ao ligar: ' + String(e).slice(0, 60));
    return null;
  }
  if (!started?.ok) {
    aoProblema('a captura do Windows não ligou');
    return null;
  }

  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  // O contexto pode nascer parado (a captura começa longe do clique que abriu o seletor de tela).
  await context.resume().catch(() => {});
  try {
    await context.audioWorklet.addModule(WORKLET_URL);
  } catch (error) {
    console.error(error);
    aoProblema('o tocador do som não carregou: ' + String(error).slice(0, 60));
    bridge.stop();
    void context.close();
    return null;
  }

  const player = new AudioWorkletNode(context, 'syden-pcm', { outputChannelCount: [2] });
  const destination = context.createMediaStreamDestination();
  // O teto vai AQUI, antes de sair para a sala, e não em cada ouvinte: o som do computador de quem
  // transmite chega cru, com o volume que o jogo estiver, e uma explosão no jogo vira um estouro no
  // ouvido de todo mundo ao mesmo tempo. Consertar na origem conserta para a sala inteira.
  const teto = comTeto(context, destination);
  player.connect(teto ?? destination);
  // O VIGIA: quantos pedaços chegaram do Windows e o maior volume deles, conferidos a cada 4 s. Avisa uma vez de cada
  // coisa: nada chegou, o som parou de chegar (depois de quanto tempo), o contexto de áudio parado.
  let pedacos = 0, pico = 0;
  const unsubscribe = bridge.onChunk((pcm) => {
    pedacos++;
    for (let i = 0; i < pcm.length; i += 16) { const v = Math.abs(pcm[i]); if (v > pico) pico = v; }
    player.port.postMessage(pcm, [pcm.buffer]);
  });
  // O app conta quando a captura do Windows morre no meio e o que fez (religou ou desistiu): vai direto ao diário.
  const largarAviso = bridge.onAviso?.((motivo) => aoProblema(motivo)) ?? (() => {});
  const inicio = performance.now(), avisado = new Set<string>();
  const avisar = (chave: string, motivo: string) => { if (!avisado.has(chave)) { avisado.add(chave); aoProblema(motivo); } };
  let antes = 0;
  const vigia = setInterval(() => {
    const s = Math.round((performance.now() - inicio) / 1000);
    if (context.state !== 'running') avisar('contexto', `o contexto de áudio está "${context.state}" (${s} s)`);
    if (pedacos === 0) avisar('nada', `nenhum som chegou do Windows em ${s} s`);
    // (em silêncio o Windows pode parar de mandar pedaços: por isso o "voltou", que separa PC calado de captura morta)
    else if (pedacos === antes) avisar('parou', `o Windows parou de mandar som depois de ${s} s (${pedacos} pedaços; pode ser só o PC em silêncio)`);
    else if (avisado.has('parou')) avisar('voltou', `o som do Windows voltou a chegar (${s} s)`);
    // mudo de verdade (zeros) por 20 s seguidos com a captura viva: o jogo calado, ou a captura do lugar errado
    if (pedacos > 0 && pico === 0 && s >= 20) avisar('mudo', `o som chega do Windows, mas em silêncio absoluto (${s} s)`);
    antes = pedacos;
  }, 4000);

  const track = destination.stream.getAudioTracks()[0];
  return {
    track,
    stop: () => {
      clearInterval(vigia);
      unsubscribe();
      largarAviso();
      bridge.stop();
      player.disconnect();
      teto?.disconnect();
      track.stop();
      void context.close();
    },
  };
}
