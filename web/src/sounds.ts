import { getSettings } from './settings';

// Sons de aviso da chamada, sintetizados na hora pela Web Audio API (sem arquivos de áudio).
// Toca só para quem está no computador; nada disso é transmitido para a sala.

interface Note {
  /** Frequência em Hz. */
  freq: number;
  /** Início, em segundos a partir do disparo. */
  at: number;
  /** Duração até o som sumir, em segundos. */
  dur: number;
}

const VOLUME = 0.12;

let context: AudioContext | null = null;

function audioContext() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function play(notes: Note[]) {
  if (!getSettings().sounds) return;
  try {
    const ac = audioContext();
    const start = ac.currentTime + 0.01;
    const master = ac.createGain();
    master.gain.value = VOLUME;
    master.connect(ac.destination);

    for (const note of notes) {
      const t = start + note.at;
      // Senoide com um harmônico suave por cima: soa como um sininho, não como um apito.
      for (const [multiple, level] of [
        [1, 1],
        [2, 0.18],
      ]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = note.freq * multiple;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(level, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + note.dur + 0.05);
      }
    }
  } catch {
    // Sem saída de áudio disponível: os avisos sonoros são só um extra.
  }
}

// Notas (Hz)
const G4 = 392;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;

export const sounds = {
  selfJoin: () => play([{ freq: C5, at: 0, dur: 0.22 }, { freq: G5, at: 0.09, dur: 0.4 }]),
  selfLeave: () =>
    play([
      { freq: G5, at: 0, dur: 0.18 },
      { freq: E5, at: 0.08, dur: 0.18 },
      { freq: C5, at: 0.16, dur: 0.35 },
    ]),
  userJoin: () => play([{ freq: E5, at: 0, dur: 0.2 }, { freq: A5, at: 0.08, dur: 0.35 }]),
  userLeave: () => play([{ freq: A5, at: 0, dur: 0.2 }, { freq: E5, at: 0.08, dur: 0.35 }]),
  mute: () => play([{ freq: G5, at: 0, dur: 0.09 }, { freq: D5, at: 0.05, dur: 0.14 }]),
  unmute: () => play([{ freq: D5, at: 0, dur: 0.09 }, { freq: G5, at: 0.05, dur: 0.14 }]),
  deafen: () => play([{ freq: E5, at: 0, dur: 0.1 }, { freq: G4, at: 0.06, dur: 0.18 }]),
  undeafen: () => play([{ freq: G4, at: 0, dur: 0.1 }, { freq: E5, at: 0.06, dur: 0.18 }]),
  /** Coelho cutucado na tela inicial: dois pulinhos curtos, bem discretos. */
  bunny: () => play([{ freq: A5, at: 0, dur: 0.08 }, { freq: C6, at: 0.06, dur: 0.12 }]),
  screenShareStart: () =>
    play([
      { freq: C5, at: 0, dur: 0.12 },
      { freq: E5, at: 0.07, dur: 0.12 },
      { freq: C6, at: 0.14, dur: 0.3 },
    ]),
};
