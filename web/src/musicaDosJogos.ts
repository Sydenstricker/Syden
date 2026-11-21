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

/** As trilhas, pelo nome da faixa (uma faixa serve a vários jogos: `TRILHA_DO_JOGO`). */
export const ARQUIVOS = {
  corrida: 'musica/junkala-level-1.ogg',
  jato: 'musica/junkala-level-2.ogg',
  regata: 'musica/junkala-level-3.ogg',
  // ação e arcade
  'stage-1': 'musica/junkala-stage-1.ogg',
  'stage-2': 'musica/junkala-stage-2.ogg',
  'boss-fight': 'musica/junkala-boss-fight.ogg',
  'stage-select': 'musica/junkala-stage-select.ogg',
  ending: 'musica/junkala-ending.ogg',
  'heavy-metal': 'musica/junkala-heavy-metal.ogg',
  'super-action-6': 'musica/junkala-super-action-6.ogg',
  'super-action-7': 'musica/junkala-super-action-7.ogg',
  'super-action-9': 'musica/junkala-super-action-9.ogg',
  'space-upbeat': 'musica/junkala-space-upbeat.ogg',
  // esporte e festa
  'retro-sports-3': 'musica/junkala-retro-sports-3.ogg',
  'retro-sports-final': 'musica/junkala-retro-sports-final.ogg',
  sporty: 'musica/junkala-sporty.ogg',
  bazaar: 'musica/junkala-bazaar.ogg',
  'sunshine-coast': 'musica/junkala-sunshine-coast.ogg',
  'home-town': 'musica/junkala-home-town.ogg',
  'where-time-stands-still': 'musica/junkala-where-time-stands-still.ogg',
  // aventura e estratégia
  grasslands: 'musica/junkala-grasslands.ogg',
  'thael-mines': 'musica/junkala-thael-mines.ogg',
  'tropical-island': 'musica/junkala-tropical-island.ogg',
  'army-approaching': 'musica/junkala-army-approaching.ogg',
  'preparing-for-battle': 'musica/junkala-preparing-for-battle.ogg',
  // calma: quebra-cabeça e mesa
  'summer-memories': 'musica/junkala-summer-memories.ogg',
  'peaceful-days': 'musica/junkala-peaceful-days.ogg',
  'a-place-i-call-home': 'musica/junkala-a-place-i-call-home.ogg',
} as const;

export type Trilha = keyof typeof ARQUIVOS;

/** O volume da música, abaixo dos efeitos (que saem a 0,16): ela é o fundo. */
export const VOLUME = 0.09;
/** Nas mesas e nos quebra-cabeças pensados, ainda mais baixo: ali se pensa e se conversa. */
export const VOLUME_CALMO = 0.055;
const CALMAS: ReadonlySet<Trilha> = new Set<Trilha>(['peaceful-days', 'a-place-i-call-home']);
export function volumeDa(trilha: Trilha): number {
  return CALMAS.has(trilha) ? VOLUME_CALMO : VOLUME;
}

/**
 * A trilha de cada jogo da estante, tocada por `useMusicaDaPartida` (Minijogo.tsx) enquanto a partida corre. Ficam DE FORA
 * (null) os jogos em que a CONVERSA é o jogo: Stop, Lobisomem, Desenha e adivinha, Palavra secreta, os quizzes e o Truco
 * (fala-se "truco"). Corrida, Jato e Regata pedem a deles no próprio componente (a pausa, a largada) e não estão aqui; o
 * Minigolfe da toca (2D) saiu da estante. Jogo que não está aqui fica em silêncio.
 */
export const TRILHA_DO_JOGO: Readonly<Record<string, Trilha | null>> = {
  // ação, arcade, plataforma
  plataforma: 'stage-1',
  gincana: 'stage-2',
  torre: 'ending',
  blocos: 'stage-select',
  chefe: 'boss-fight',
  ringue: 'boss-fight',
  nave: 'super-action-6',
  comando: 'super-action-7',
  transito: 'super-action-7',
  briga: 'super-action-9',
  pinball: 'super-action-9',
  arena: 'heavy-metal',
  duelo: 'heavy-metal',
  balao: 'heavy-metal',
  estelar: 'space-upbeat',
  caca: 'bazaar',
  // esporte e festa
  futebol: 'retro-sports-3',
  carrinhos: 'retro-sports-final',
  skate: 'retro-sports-final',
  festa: 'sporty',
  cozinha: 'sunshine-coast',
  tabuleiro: 'home-town',
  cidades: 'where-time-stands-still',
  planador: 'tropical-island',
  golfe3d: 'tropical-island',
  // RPG, aventura, estratégia
  bichos: 'grasslands',
  masmorra: 'thael-mines',
  lendas: 'army-approaching',
  tocas: 'preparing-for-battle',
  // quebra-cabeça e mesa
  ponte: 'summer-memories',
  tamanho: 'summer-memories',
  sudoku: 'a-place-i-call-home',
  xadrez: 'a-place-i-call-home',
  gomoku: 'peaceful-days',
  mancala: 'peaceful-days',
  damas: 'peaceful-days',
  'partida-de-xadrez': 'peaceful-days',
  naval: 'peaceful-days',
  domino: 'peaceful-days',
  // a conversa é o jogo: sem música, de propósito
  stop: null,
  lobisomem: null,
  desenho: null,
  palavra: null,
  truco: null,
  monstros: null,
  mitologia: null,
  paises: null,
  elementos: null,
  dinossauros: null,
  estados: null,
  animais: null,
};
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
      g.exponentialRampToValueAtTime(volumeDa(trilha), inicio + ENTRADA_S);
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

/**
 * A PAUSA DOS JOGOS (20/11/2026, a segunda auditoria: nos jogos que tocam só pela tabela, a música seguia na pausa do Solo). A
 * pausa comum (`usePausaComEsc`, em pausaDosJogos.tsx) marca aqui cada pausa aberta, e a música cala enquanto houver uma, sem
 * cada Jogo*.tsx precisar saber. Corrida, Jato, Regata e Pulo já calavam a deles pela própria pausa: a marca só confirma.
 */
const pausasAbertas = new Set<object>();
export function marcarPausaDoJogo(dono: object, pausado: boolean) {
  const antes = pausasAbertas.size;
  if (pausado) pausasAbertas.add(dono);
  else pausasAbertas.delete(dono);
  if (pausasAbertas.size !== antes) maestro.conferir();
}
export const algumJogoPausado = () => pausasAbertas.size > 0;

const maestro = criarMaestro(motorWeb, () => !somDosJogosMudo() && !estaSurdo() && janelaComFocoAgora() && !algumJogoPausado());

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

/**
 * A música da partida da estante (Minijogo.tsx): a trilha de `TRILHA_DO_JOGO` enquanto a partida corre (`rodando`: nem o
 * convite, nem o placar do fim). O jogo que não está na tabela (Corrida, Jato e Regata, que pedem a deles por dentro) NÃO é
 * tocado por aqui, nem para pedir silêncio: senão o pedido de fora calaria o de dentro.
 */
export function useMusicaDaPartida(jogo: string | null, rodando: boolean) {
  const naTabela = jogo !== null && Object.prototype.hasOwnProperty.call(TRILHA_DO_JOGO, jogo);
  const trilha = naTabela && rodando ? TRILHA_DO_JOGO[jogo!] : null;
  useEffect(() => {
    if (!naTabela) return;
    pedirMusica(trilha);
    return () => pedirMusica(null);
  }, [naTabela, trilha]);
}

// os testes de navegador leem o que está tocando (só no site de desenvolvimento)
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { musicaDosJogos: () => Trilha | null }).musicaDosJogos = () => maestro.tocando();
}
