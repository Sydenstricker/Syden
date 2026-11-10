import { getSettings } from './settings';
import type { Toque } from './toquesDeLigacao';

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

/**
 * A regra das LIGAÇÕES (09/11/2026), à parte da dos avisos.
 *
 * O TOQUE (alguém ligando para mim) não obedece aos "Sons de aviso": eles existem para não ouvir a SALA, e o toque é
 * justamente o que precisa chegar. Ele tem a chave dele ("Toque de ligação"), e o "Não perturbe" o cala antes de chegar aqui
 * (ver ChamadaRecebida.tsx). O "DESATIVAR ÁUDIO" O CALA DE FÁBRICA (decisão dele, mesmo dia: "se é desativar áudio, por
 * padrão ele desativa áudio"): o cartão da ligação aparece e a barra de tarefas pisca do mesmo jeito. Quem prefere ouvir
 * liga "Tocar ligações com o áudio desativado" (toqueComAudioDesativado).
 *
 * O CHAMANDO (eu ligando, esperando atenderem) é o som da chamada em que eu estou: obedece aos sons de aviso e cala
 * com o "Desativar áudio", como o resto do que eu ouço nela.
 */
export function deveTocarLigacao(
  tipo: 'toque' | 'chamando',
  ajustes: { sounds: boolean; toqueDeLigacao: boolean; toqueComAudioDesativado: boolean },
  ensurdecido: boolean,
): boolean {
  if (tipo === 'toque') return ajustes.toqueDeLigacao && (!ensurdecido || ajustes.toqueComAudioDesativado);
  return ajustes.sounds && !ensurdecido;
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
  tocarNotas(notes, VOLUME);
}

function tocarNotas(notes: Note[], volume: number) {
  try {
    const ac = audioContext();
    const start = ac.currentTime + 0.01;
    const master = ac.createGain();
    master.gain.value = volume;
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
const E4 = 329.63;
const G4 = 392;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const A4 = 440;
const F5 = 698.46;
const B5 = 987.77;
const E6 = 1318.51;

/**
 * AS FRASES DE CADA TOQUE (09/11/2026, os toques por pessoa e por grupo, toquesDeLigacao.ts). Curtas, repetidas a cada
 * 2,5 s pela tela da ligação; nenhuma passa de ~1,3 s, para não emendar na repetição. O 'padrao' é o toque de sempre.
 */
const FRASES: Record<Exclude<Toque, 'silencio'>, { notas: Note[]; volume: number }> = {
  padrao: {
    notas: [
      { freq: E5, at: 0, dur: 0.18 },
      { freq: G5, at: 0.12, dur: 0.18 },
      { freq: C6, at: 0.24, dur: 0.32 },
      { freq: E5, at: 0.7, dur: 0.18 },
      { freq: G5, at: 0.82, dur: 0.18 },
      { freq: C6, at: 0.94, dur: 0.32 },
    ],
    volume: 1,
  },
  // dois toques de sino agudo, como a campainha de uma loja
  sininho: {
    notas: [
      { freq: E6, at: 0, dur: 0.5 },
      { freq: B5, at: 0.14, dur: 0.6 },
      { freq: E6, at: 0.62, dur: 0.5 },
      { freq: B5, at: 0.76, dur: 0.6 },
    ],
    volume: 0.8,
  },
  // subindo de uma vez, alegre
  arpejo: {
    notas: [
      { freq: C5, at: 0, dur: 0.16 },
      { freq: E5, at: 0.09, dur: 0.16 },
      { freq: G5, at: 0.18, dur: 0.16 },
      { freq: C6, at: 0.27, dur: 0.22 },
      { freq: E6, at: 0.36, dur: 0.4 },
    ],
    volume: 0.9,
  },
  // grave e lento, para quem não quer susto
  suave: {
    notas: [
      { freq: A4, at: 0, dur: 0.7 },
      { freq: C5, at: 0.35, dur: 0.7 },
      { freq: F5, at: 0.7, dur: 0.9 },
    ],
    volume: 0.7,
  },
  // o bipe curto de telefone, três vezes
  bipe: {
    notas: [
      { freq: A5, at: 0, dur: 0.12 },
      { freq: A5, at: 0.2, dur: 0.12 },
      { freq: A5, at: 0.4, dur: 0.12 },
    ],
    volume: 0.8,
  },
};

/** Toca a frase de um toque, sem regra nenhuma: para ouvir antes de escolher (Configurações, o menu da pessoa). */
export function ouvirToque(toque: Toque) {
  if (toque === 'silencio') return;
  const f = FRASES[toque];
  tocarNotas(f.notas, VOLUME * f.volume);
}

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
  /**
   * O TOQUE de alguém ligando numa conversa privada: uma frase curta, repetida pela tela que mostra a chamada (ver
   * ChamadaRecebida.tsx) até atender, recusar ou desistirem. Tem a regra dele (deveTocarLigacao): toca mesmo com os sons
   * de aviso desligados, e só o "Toque de ligação" o desliga.
   */
  toque: (toque: Toque = 'padrao') => {
    if (!deveTocarLigacao('toque', getSettings(), surdo)) return;
    ouvirToque(toque);
  },
  /**
   * O CHAMANDO de quem liga, enquanto o outro lado não atende (09/11/2026): duas notas graves e longas, mais baixas e
   * mais devagar que o toque — é espera, não alarme, e não pode ser confundido com alguém ligando para mim. Repetido
   * por Shell.tsx a cada 3 s, só depois de o servidor dizer que tocou para alguém ('chamada:chamando').
   */
  chamando: () => {
    if (!deveTocarLigacao('chamando', getSettings(), surdo)) return;
    tocarNotas(
      [
        { freq: E4, at: 0, dur: 0.6 },
        { freq: G4, at: 0.4, dur: 0.9 },
      ],
      VOLUME * 0.6,
    );
  },
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
