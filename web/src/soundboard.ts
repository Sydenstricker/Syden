import { mediaUrl } from './api';
import { comTeto } from './limitador';
import { estaSurdo } from './sounds';
import { getSettings } from './settings';

// Toca um som do soundboard neste computador. Cada pessoa da sala toca o próprio áudio ao receber o
// aviso pelo canal de dados do LiveKit; o som não passa pelo microfone de ninguém.

// O que está tocando agora neste computador, para o botão "Parar" poder calar tudo de uma vez —
// alguns sons de pacote passam de meio minuto.
const playing = new Map<number, HTMLAudioElement>();

export function stopAllSounds() {
  for (const audio of playing.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
  playing.clear();
}

export function playSoundboard(soundId: number) {
  // Som de outra pessoa: cala quando quem ouve ensurdeceu. A conferência mora aqui, e não em quem
  // chama, pela mesma razão explicada em sounds.ts.
  if (estaSurdo()) return;
  const settings = getSettings();
  // O mesmo som tocado de novo recomeça em vez de empilhar: dois cliques seguidos num som de trinta
  // segundos viravam um coro que ninguém conseguia parar.
  const tocando = playing.get(soundId);
  if (tocando) {
    tocando.pause();
    tocando.currentTime = 0;
  }
  const audio = new Audio();
  // Precisa ser pedido COMO ANÔNIMO para o som poder passar pelo limitador: sem isto o navegador
  // deixa tocar mas não deixa o app olhar as amostras, e o caminho do Web Audio sai mudo.
  audio.crossOrigin = 'anonymous';
  audio.src = mediaUrl.sound(soundId);
  playing.set(soundId, audio);
  audio.addEventListener('ended', () => {
    if (playing.get(soundId) === audio) playing.delete(soundId);
  });
  audio.volume = settings.soundboardVolume;
  // Um som de soundboard é um arquivo que qualquer pessoa da comunidade enviou, e vem como veio: um
  // meme gravado estourado toca muito mais alto que todo o resto do app. Passando pelo limitador, o
  // pico é achatado e o susto some — sem mexer no volume dos sons normais.
  const pelaCadeia = porOndeTocar(audio);

  // Sai pelo mesmo alto-falante/fone escolhido para a chamada.
  //
  // QUEM MANDA NA SAÍDA MUDA conforme o som passe ou não pelo limitador: indo pela cadeia do Web
  // Audio, o elemento deixa de decidir para onde toca e quem decide é o contexto. Pedir ao elemento
  // não daria erro — simplesmente não faria nada, e o som sairia no alto-falante errado sem explicação.
  if (settings.audioOutput) {
    if (pelaCadeia) {
      const ctx = contexto as (AudioContext & { setSinkId?(id: string): Promise<void> }) | null;
      void ctx?.setSinkId?.(settings.audioOutput).catch(() => {});
    } else if ('setSinkId' in audio) {
      void (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(settings.audioOutput).catch(() => {});
    }
  }
  void audio.play().catch(() => {});
}

/**
 * Liga este som ao limitador, para um arquivo estourado não virar um susto.
 *
 * O caminho do Web Audio precisa que o arquivo tenha sido pedido como anônimo E que o servidor libere a
 * leitura. Se qualquer uma das duas coisas faltar, `createMediaElementSource` deixa o elemento MUDO em
 * vez de dar erro — então aqui, na dúvida, desfaz-se a ligação e o som toca pelo caminho simples. Alto
 * demais é ruim; mudo é pior.
 */
/** Devolve true quando o som foi mesmo ligado ao limitador. */
function porOndeTocar(audio: HTMLAudioElement): boolean {
  try {
    contexto ??= new AudioContext();
    void contexto.resume().catch(() => {});
    const teto = comTeto(contexto);
    if (!teto) return false;
    contexto.createMediaElementSource(audio).connect(teto);
    return true;
  } catch {
    // Navegador sem Web Audio, ou som que já estava ligado a um contexto: toca do jeito simples.
    return false;
  }
}

/**
 * Um contexto só para todos os sons. Criar um por som estouraria o limite do navegador (uns poucos por
 * página) depois de algumas dezenas de cliques, e aí o soundboard simplesmente pararia de tocar.
 */
let contexto: AudioContext | null = null;
