import { mediaUrl } from './api';
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
  const settings = getSettings();
  // O mesmo som tocado de novo recomeça em vez de empilhar: dois cliques seguidos num som de trinta
  // segundos viravam um coro que ninguém conseguia parar.
  const tocando = playing.get(soundId);
  if (tocando) {
    tocando.pause();
    tocando.currentTime = 0;
  }
  const audio = new Audio(mediaUrl.sound(soundId));
  playing.set(soundId, audio);
  audio.addEventListener('ended', () => {
    if (playing.get(soundId) === audio) playing.delete(soundId);
  });
  audio.volume = settings.soundboardVolume;
  // Sai pelo mesmo alto-falante/fone escolhido para a chamada.
  if (settings.audioOutput && 'setSinkId' in audio) {
    void (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(settings.audioOutput).catch(() => {});
  }
  void audio.play().catch(() => {});
}
