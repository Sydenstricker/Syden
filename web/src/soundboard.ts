import { mediaUrl } from './api';
import { getSettings } from './settings';

// Toca um som do soundboard neste computador. Cada pessoa da sala toca o próprio áudio ao receber o
// aviso pelo canal de dados do LiveKit; o som não passa pelo microfone de ninguém.
export function playSoundboard(soundId: number) {
  const settings = getSettings();
  const audio = new Audio(mediaUrl.sound(soundId));
  audio.volume = settings.soundboardVolume;
  // Sai pelo mesmo alto-falante/fone escolhido para a chamada.
  if (settings.audioOutput && 'setSinkId' in audio) {
    void (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(settings.audioOutput).catch(() => {});
  }
  void audio.play().catch(() => {});
}
