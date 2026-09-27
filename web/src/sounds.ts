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

/**
 * "Desativar áudio" está ligado?
 *
 * FICA AQUI, e não em cada lugar que toca um som, porque foi exatamente assim que o defeito apareceu:
 * o soundboard conferia e os sons de entrar e sair não conferiam. Quem ensurdecia continuava ouvindo
 * gente chegando na sala. Espalhado por dez lugares, o décimo primeiro esquece — centralizado, o som
 * novo já nasce obedecendo.
 */
let surdo = false;

export function definirSurdez(valor: boolean) {
  surdo = valor;
}

export function estaSurdo() {
  return surdo;
}

/**
 * A regra, separada de tudo o que precisa de navegador, para poder ser testada.
 *
 * Parece pequena demais para virar função. Virou porque o defeito que ela descreve foi real: quem
 * desativava o áudio continuava ouvindo gente entrar e sair da sala.
 */
export function deveTocar(avisosLigados: boolean, dosOutros: boolean, ensurdecido: boolean): boolean {
  if (!avisosLigados) return false;
  return !(dosOutros && ensurdecido);
}

let context: AudioContext | null = null;

function audioContext() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/**
 * `dosOutros` marca o som que vem de OUTRA PESSOA — alguém entrou, saiu, começou a transmitir. Esses
 * calam quando a pessoa ensurdece, porque ensurdecer quer dizer "não quero ouvir a sala".
 *
 * Os que NÃO são dos outros são resposta ao próprio clique: silenciar, ensurdecer, entrar, sair. Esses
 * continuam tocando, senão apertar "desativar áudio" não daria retorno nenhum — e o mais importante
 * deles é justamente o que confirma que o áudio foi desativado.
 */
function play(notes: Note[], dosOutros = false) {
  if (!deveTocar(getSettings().sounds, dosOutros, surdo)) return;
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
  userJoin: () => play([{ freq: E5, at: 0, dur: 0.2 }, { freq: A5, at: 0.08, dur: 0.35 }], true),
  userLeave: () => play([{ freq: A5, at: 0, dur: 0.2 }, { freq: E5, at: 0.08, dur: 0.35 }], true),
  mute: () => play([{ freq: G5, at: 0, dur: 0.09 }, { freq: D5, at: 0.05, dur: 0.14 }]),
  unmute: () => play([{ freq: D5, at: 0, dur: 0.09 }, { freq: G5, at: 0.05, dur: 0.14 }]),
  deafen: () => play([{ freq: E5, at: 0, dur: 0.1 }, { freq: G4, at: 0.06, dur: 0.18 }]),
  undeafen: () => play([{ freq: G4, at: 0, dur: 0.1 }, { freq: E5, at: 0.06, dur: 0.18 }]),
  /** Coelho cutucado na tela inicial: dois pulinhos curtos, bem discretos. */
  bunny: () => play([{ freq: A5, at: 0, dur: 0.08 }, { freq: C6, at: 0.06, dur: 0.12 }]),
  screenShareStart: () =>
    play(
      [
        { freq: C5, at: 0, dur: 0.12 },
        { freq: E5, at: 0.07, dur: 0.12 },
        { freq: C6, at: 0.14, dur: 0.3 },
      ],
      true,
    ),
};
