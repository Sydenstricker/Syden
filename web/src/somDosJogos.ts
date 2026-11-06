import { estaSurdo } from './sounds';

/**
 * OS EFEITOS SONOROS DOS MINI-GAMES (05/11/2026, pedido dele: "seria interessante ter música e SFX nos mini-games, com opção de
 * silenciar caso o usuário prefira"). Sintetizados na hora pela Web Audio, sem arquivo nenhum, como os avisos da chamada
 * (sounds.ts) e como ficou decidido para a Corrida dos coelhos ("sai com efeitos sintetizados").
 *
 * A MÚSICA NÃO É FEITA AQUI, e não será: "nunca fazer a nossa" (CLAUDE.md). Ela entra quando houver uma trilha de terceiro com
 * licença que permita tocar dentro do Syden; o botão de silenciar já vale para ela.
 *
 * Silenciar é do aparelho ('syden:somDosJogos'), vale para todos os jogos e é lembrado. "Desativar áudio" na chamada também
 * cala os jogos (estaSurdo): quem ensurdeceu não quer bipe nenhum.
 */

export type Efeito =
  | 'clique'
  | 'vez'
  | 'pulo'
  | 'mola'
  | 'queda'
  | 'moeda'
  | 'acerto'
  | 'erro'
  | 'dado'
  | 'carta'
  | 'tacada'
  | 'buraco'
  | 'agua'
  | 'tiro'
  | 'soco'
  | 'combo'
  | 'chegada'
  | 'derrapa'
  | 'serra'
  | 'empurrao'
  | 'bandeira'
  | 'encaixe'
  | 'rangido'
  | 'quebra'
  | 'chiado'
  | 'fim';

const CHAVE = 'syden:somDosJogos';
let mudo = (() => {
  try {
    return localStorage.getItem(CHAVE) === 'mudo';
  } catch {
    return false;
  }
})();
const ouvintes = new Set<(mudo: boolean) => void>();

export function somDosJogosMudo(): boolean {
  return mudo;
}
export function silenciarJogos(valor: boolean) {
  mudo = valor;
  try {
    localStorage.setItem(CHAVE, valor ? 'mudo' : 'ligado');
  } catch {
    /* só nesta visita */
  }
  for (const f of ouvintes) f(valor);
}
export function aoMudarSomDosJogos(f: (mudo: boolean) => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

let ctx: AudioContext | null = null;
let saida: GainNode | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      saida = ctx.createGain();
      saida.gain.value = 0.16;
      saida.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** Uma nota: onda, frequência de início e de fim, duração, volume e atraso (segundos). */
function nota(a: AudioContext, onda: OscillatorType, de: number, para: number, dur: number, vol = 1, atraso = 0) {
  const t = a.currentTime + atraso;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = onda;
  o.frequency.setValueAtTime(de, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, para), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(saida!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Um chiado curto (tiro, água, soco), com o filtro dando a cor. */
function ruido(a: AudioContext, dur: number, freq: number, vol = 1, atraso = 0, tipo: BiquadFilterType = 'lowpass') {
  const t = a.currentTime + atraso;
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(saida!);
  s.start(t);
}

const ultimo = new Map<Efeito, number>();

/** Toca um efeito (se o som dos jogos estiver ligado). O mesmo efeito não repete em menos de 40 ms. */
export function tocar(efeito: Efeito) {
  if (mudo || estaSurdo()) return;
  const agora = performance.now();
  if ((ultimo.get(efeito) ?? 0) > agora - 40) return;
  ultimo.set(efeito, agora);
  const a = audio();
  if (!a || !saida) return;
  switch (efeito) {
    case 'clique':
      nota(a, 'triangle', 660, 520, 0.06, 0.5);
      break;
    case 'vez':
      nota(a, 'sine', 660, 660, 0.12, 0.6);
      nota(a, 'sine', 880, 880, 0.18, 0.6, 0.1);
      break;
    case 'pulo':
      nota(a, 'square', 300, 640, 0.12, 0.25);
      break;
    case 'mola':
      nota(a, 'square', 220, 900, 0.22, 0.25);
      break;
    case 'queda':
      nota(a, 'triangle', 520, 110, 0.4, 0.6);
      break;
    case 'moeda':
      nota(a, 'square', 990, 990, 0.06, 0.25);
      nota(a, 'square', 1320, 1320, 0.16, 0.25, 0.06);
      break;
    case 'acerto':
      nota(a, 'triangle', 520, 1040, 0.14, 0.6);
      break;
    case 'erro':
      nota(a, 'sawtooth', 180, 120, 0.22, 0.3);
      break;
    case 'dado':
      for (let i = 0; i < 4; i++) ruido(a, 0.035, 2500, 0.5, i * 0.06, 'bandpass');
      break;
    case 'carta':
      ruido(a, 0.07, 3500, 0.5, 0, 'highpass');
      break;
    case 'tacada':
      nota(a, 'sine', 900, 300, 0.07, 0.7);
      ruido(a, 0.03, 4000, 0.4, 0, 'highpass');
      break;
    case 'buraco':
      nota(a, 'sine', 400, 200, 0.12, 0.6);
      nota(a, 'triangle', 660, 660, 0.12, 0.5, 0.18);
      nota(a, 'triangle', 990, 990, 0.25, 0.5, 0.3);
      break;
    case 'agua':
      ruido(a, 0.35, 900, 0.7);
      nota(a, 'sine', 600, 200, 0.25, 0.3);
      break;
    case 'tiro':
      ruido(a, 0.12, 1800, 0.8);
      break;
    case 'soco':
      ruido(a, 0.06, 700, 0.9);
      nota(a, 'sine', 160, 70, 0.08, 0.7);
      break;
    case 'combo':
      [660, 880, 1100].forEach((f, i) => nota(a, 'triangle', f, f, 0.1, 0.45, i * 0.06));
      break;
    case 'chegada':
      [523, 659, 784, 1047].forEach((f, i) => nota(a, 'square', f, f, 0.14, 0.22, i * 0.09));
      break;
    case 'derrapa':
      ruido(a, 0.16, 2600, 0.35, 0, 'bandpass');
      nota(a, 'sawtooth', 1500, 1100, 0.14, 0.08);
      break;
    // a Gincana da toca (06/11/2026): a serra que pega (o zunido metálico), o empurrão do varredor ou da bala (o tum de borracha)
    // e a bandeira alcançada (duas notas subindo)
    case 'serra':
      nota(a, 'sawtooth', 1800, 900, 0.18, 0.12);
      ruido(a, 0.12, 5000, 0.35, 0, 'highpass');
      nota(a, 'triangle', 420, 120, 0.3, 0.45, 0.06);
      break;
    case 'empurrao':
      nota(a, 'sine', 240, 90, 0.16, 0.8);
      ruido(a, 0.05, 900, 0.5);
      break;
    case 'bandeira':
      nota(a, 'triangle', 784, 784, 0.1, 0.45);
      nota(a, 'triangle', 1175, 1175, 0.22, 0.45, 0.09);
      break;
    // a Ponte da toca (06/11/2026): a peça que encaixa (um toc de madeira), a ponte que range sob o peso e a que quebra
    case 'encaixe':
      nota(a, 'sine', 420, 260, 0.07, 0.7);
      ruido(a, 0.025, 1800, 0.5, 0, 'bandpass');
      break;
    case 'rangido':
      nota(a, 'sawtooth', 95, 70, 0.32, 0.14);
      nota(a, 'sawtooth', 101, 82, 0.28, 0.1, 0.05);
      break;
    case 'quebra':
      ruido(a, 0.09, 3200, 0.9, 0, 'highpass');
      ruido(a, 0.25, 500, 0.7, 0.02);
      nota(a, 'triangle', 200, 60, 0.25, 0.5);
      break;
    // a Cozinha da toca (06/11/2026): o que passou do ponto e está queimando na chapa
    case 'chiado':
      ruido(a, 0.45, 5200, 0.35, 0, 'highpass');
      ruido(a, 0.3, 2400, 0.25, 0.12, 'bandpass');
      break;
    case 'fim':
      [784, 659, 784, 1047].forEach((f, i) => nota(a, 'triangle', f, f, i === 3 ? 0.4 : 0.14, 0.45, i * 0.13));
      break;
  }
}

/**
 * O MOTOR (os Carrinhos da toca, 06/11/2026): um zumbido contínuo, o motorzinho elétrico do carrinho, cuja altura e volume
 * acompanham a rapidez (de 0 a 1). Quem chama ajusta a cada quadro e para ao sair; mudo (ou sem foco, quem chama passa 0), cala.
 */
export function criarMotor() {
  const a = audio();
  if (!a || !saida) return { ajustar: (_rapidez: number) => {}, parar: () => {} };
  const o = a.createOscillator();
  const o2 = a.createOscillator();
  const filtro = a.createBiquadFilter();
  const g = a.createGain();
  o.type = 'sawtooth';
  o2.type = 'square';
  filtro.type = 'lowpass';
  filtro.frequency.value = 900;
  g.gain.value = 0;
  o.connect(filtro);
  o2.connect(filtro);
  filtro.connect(g).connect(saida);
  o.start();
  o2.start();
  let parado = false;
  return {
    ajustar(rapidez: number) {
      if (parado) return;
      const r = Math.max(0, Math.min(1, rapidez));
      const t = a.currentTime;
      o.frequency.setTargetAtTime(70 + r * 260, t, 0.05);
      o2.frequency.setTargetAtTime(35 + r * 130, t, 0.05);
      g.gain.setTargetAtTime(mudo || estaSurdo() ? 0 : r > 0.01 ? 0.08 + r * 0.22 : 0, t, 0.06);
    },
    parar() {
      if (parado) return;
      parado = true;
      g.gain.setTargetAtTime(0, a.currentTime, 0.03);
      o.stop(a.currentTime + 0.2);
      o2.stop(a.currentTime + 0.2);
    },
  };
}
