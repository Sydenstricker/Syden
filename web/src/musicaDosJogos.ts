import { useEffect } from 'react';
import { segurar, soltar } from './audioOcioso';
import { estaSurdo } from './sounds';
import { aoMudarSomDosJogos, somDosJogosMudo } from './somDosJogos';

/**
 * A MÚSICA DOS MINI-GAMES (20/11/2026). NÃO É NOSSA, e não será ("Música: nunca fazer a nossa", no CLAUDE.md): são faixas de
 * terceiros em CC0, com a origem e a licença ao lado de cada arquivo (`web/public/musica/LEIA-ME.txt`). Faixa nova só entra
 * pela mesma regra de origem: autor com histórico conhecido, página própria da faixa com a licença declarada, nada de
 * coletânea de terceiros, nada feito com IA, nada de ShareAlike ou NC.
 *
 * Uma trilha por vez, em laço, baixinha, com a entrada e a saída suaves. Toca só enquanto o jogo pede (a corrida rodando,
 * nunca o menu nem o placar) E é permitido: o som dos jogos ligado (o mesmo alto-falante dos efeitos), sem o "Desativar
 * áudio" da chamada e com a janela com foco e à vista (sem foco, nada se mexe). Sai do permitido, ela some suave e guarda
 * onde parou; voltando, continua dali.
 *
 * Toca pela Web Audio (AudioBufferSourceNode com `loop`), e não por um <audio>: o laço do <audio> engasga na volta, e o do
 * buffer é sem emenda, como o autor fez. O arquivo só é baixado na primeira vez que a trilha é pedida.
 */

export type Trilha = 'corrida' | 'jato' | 'regata';

const ARQUIVOS: Record<Trilha, string> = {
  corrida: 'musica/junkala-level-1.ogg',
  jato: 'musica/junkala-level-2.ogg',
  regata: 'musica/junkala-level-3.ogg',
};

/** O volume da música, abaixo dos efeitos (que saem a 0,16): ela é o fundo. */
export const VOLUME = 0.09;
const ENTRADA_S = 1.2;
const SAIDA_S = 0.6;

/** O que de fato toca o som. Separado para o teste trocar por um falso. */
export interface Motor {
  /** Começa (ou continua) a trilha, do ponto `deS`, com a entrada suave. */
  tocar(trilha: Trilha, deS: number): void;
  /** Some suave e para. Devolve onde a trilha estava (segundos), para continuar dali. */
  parar(): number;
}

export interface Maestro {
  /** O que o jogo quer agora (null = nada). Não toca se não for permitido. */
  pedir(trilha: Trilha | null): void;
  /** Confere de novo o permitido (mudo, surdez, foco) e liga ou desliga. */
  conferir(): void;
  /** A trilha que está tocando (null = silêncio). */
  tocando(): Trilha | null;
}

/** A regra, sem navegador: uma trilha por vez, só quando pedida e permitida, e cada trilha lembra onde parou. */
export function criarMaestro(motor: Motor, permitido: () => boolean): Maestro {
  let pedida: Trilha | null = null;
  let ultima: Trilha | null = null;
  let atual: Trilha | null = null;
  const onde = new Map<Trilha, number>();
  function conferir() {
    const quero = pedida && permitido() ? pedida : null;
    if (quero === atual) return;
    if (atual) onde.set(atual, motor.parar());
    atual = quero;
    if (quero) motor.tocar(quero, onde.get(quero) ?? 0);
  }
  return {
    pedir(trilha) {
      // trilha de outro jogo começa do começo; a mesma (a pausa, a corrida seguinte) continua de onde parou
      if (trilha && trilha !== ultima) {
        onde.delete(trilha);
        ultima = trilha;
      }
      pedida = trilha;
      conferir();
    },
    conferir,
    tocando: () => atual,
  };
}

// ——— o motor de verdade, pela Web Audio ———

let ctx: AudioContext | null = null;
let saida: GainNode | null = null;
const buffers = new Map<Trilha, Promise<AudioBuffer | null>>();

function contexto(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      saida = ctx.createGain();
      saida.gain.value = 0;
      saida.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

function carregar(a: AudioContext, trilha: Trilha): Promise<AudioBuffer | null> {
  let p = buffers.get(trilha);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}${ARQUIVOS[trilha]}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((dados) => a.decodeAudioData(dados))
      .catch(() => {
        buffers.delete(trilha); // tenta de novo na próxima vez
        return null;
      });
    buffers.set(trilha, p);
  }
  return p;
}

interface Tocando {
  fonte: AudioBufferSourceNode | null;
  /** currentTime do contexto em que o ponto 0 do buffer tocaria (para saber onde parou). */
  zero: number;
  duracao: number;
  deS: number;
  cancelado: boolean;
}
let agora: Tocando | null = null;
let segurado = false;

const motorWeb: Motor = {
  tocar(trilha, deS) {
    const a = contexto();
    if (!a || !saida) return;
    if (!segurado) {
      segurar(a);
      segurado = true;
    }
    const este: Tocando = { fonte: null, zero: 0, duracao: 0, deS, cancelado: false };
    agora = este;
    void carregar(a, trilha).then((buf) => {
      if (!buf || este.cancelado || !saida) return;
      const fonte = a.createBufferSource();
      fonte.buffer = buf;
      fonte.loop = true;
      fonte.connect(saida);
      const inicio = a.currentTime + 0.02;
      const de = deS % buf.duration;
      fonte.start(inicio, de);
      este.fonte = fonte;
      este.zero = inicio - de;
      este.duracao = buf.duration;
      const g = saida.gain;
      g.cancelScheduledValues(inicio);
      g.setValueAtTime(0.0001, inicio);
      g.exponentialRampToValueAtTime(VOLUME, inicio + ENTRADA_S);
    });
  },
  parar() {
    const este = agora;
    agora = null;
    if (!este || !ctx || !saida) return 0;
    este.cancelado = true;
    const a = ctx;
    let onde = este.deS;
    if (este.fonte) {
      onde = (a.currentTime - este.zero) % este.duracao;
      const g = saida.gain;
      const t = a.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(0.0001, t + SAIDA_S);
      const fonte = este.fonte;
      fonte.stop(t + SAIDA_S + 0.02);
      fonte.onended = () => fonte.disconnect();
    }
    // solta o contexto (que dorme depois do prazo de audioOcioso) se nada voltou a tocar até a saída acabar
    setTimeout(() => {
      if (!agora && segurado && ctx) {
        segurado = false;
        soltar(ctx);
      }
    }, (SAIDA_S + 0.1) * 1000);
    return onde;
  },
};

function janelaComFocoAgora(): boolean {
  return typeof document !== 'undefined' && !document.hidden && document.hasFocus();
}

const maestro = criarMaestro(motorWeb, () => !somDosJogosMudo() && !estaSurdo() && janelaComFocoAgora());

let vigiando = false;
let relogio: ReturnType<typeof setInterval> | null = null;
function vigiar(ligado: boolean) {
  if (typeof window === 'undefined') return;
  if (!vigiando) {
    vigiando = true;
    aoMudarSomDosJogos(() => maestro.conferir());
    const conferir = () => maestro.conferir();
    window.addEventListener('focus', conferir);
    window.addEventListener('blur', () => setTimeout(conferir, 0));
    document.addEventListener('visibilitychange', conferir);
  }
  // a surdez da chamada não avisa ninguém (sounds.ts) e o foco num iframe também não: uma conferência por segundo,
  // só enquanto algum jogo pede música
  if (ligado && !relogio) relogio = setInterval(() => maestro.conferir(), 1000);
  if (!ligado && relogio) {
    clearInterval(relogio);
    relogio = null;
  }
}

/** Pede a trilha (ou o silêncio, com null). Uma só toca de cada vez: pedir outra troca. */
export function pedirMusica(trilha: Trilha | null) {
  vigiar(trilha !== null);
  maestro.pedir(trilha);
}

/** Toca a trilha enquanto `trilha` não for null e o componente estiver na tela. */
export function useMusicaDoJogo(trilha: Trilha | null) {
  useEffect(() => {
    pedirMusica(trilha);
    return () => pedirMusica(null);
  }, [trilha]);
}

// os testes de navegador leem o que está tocando (só no site de desenvolvimento)
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { musicaDosJogos: () => Trilha | null }).musicaDosJogos = () => maestro.tocando();
}
