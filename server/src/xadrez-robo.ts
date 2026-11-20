import { Worker } from 'node:worker_threads';
import { lanceDoMotor, NIVEIS_DO_MOTOR, type LanceDoMotor, type NivelDoMotor } from './xadrez-motor.js';

/**
 * O ROBÔ DE XADREZ FORA DA THREAD DO SERVIDOR (20/11/2026, a decisão 2 dele: "o robô de xadrez segura o servidor ~0,8 s por
 * lance"). Um worker só (worker_threads), com uma FILA: cada pedido espera a vez, tem um TEMPO MÁXIMO (o do nível + uma folga),
 * e a resposta nunca falha — se o worker cair, demorar demais ou a fila estiver cheia, o servidor joga sozinho um lance legal
 * curto (a busca de um meio-lance, poucos milissegundos), e a partida nunca trava. O worker sai sozinho depois de uns minutos
 * sem pedido, e não segura o processo aberto enquanto espera.
 *
 * No build (tsc), o worker é `dist/xadrez-robo-worker.js`, ao lado deste; rodando pelo tsx (o `npm run dev` e os testes), é o
 * `.ts`, com o tsx carregado nele.
 */

export interface PedidoDoRobo {
  fen: string;
  /** Os FEN das posições de antes (a repetição conta as da partida). */
  historico: string[];
  nivel: NivelDoMotor;
  semente: number;
}

interface NaFila extends PedidoDoRobo {
  id: number;
  responder: (l: LanceDoMotor | null) => void;
  relogio?: ReturnType<typeof setTimeout>;
}

/** Quanto além do tempo do nível o worker pode demorar antes de ser derrubado. */
export const FOLGA_DO_WORKER_MS = 2_500;
/** Mais que isso na fila, o pedido nem entra: joga o lance curto na hora. */
export const FILA_MAXIMA = 24;
/** Sem pedido por esse tempo, o worker sai (a memória dele volta). */
export const OCIOSO_MS = 3 * 60_000;

let worker: Worker | null = null;
let atual: NaFila | null = null;
const fila: NaFila[] = [];
let proximoId = 1;
let ocioso: ReturnType<typeof setTimeout> | null = null;
/** Quem respondeu (para os testes e o diagnóstico). */
export const contagem = { worker: 0, reserva: 0, quedas: 0 };

/** O lance legal curto, no próprio servidor: a busca de um meio-lance mais as capturas, em poucos milissegundos. */
export function lanceDeReserva(fen: string): LanceDoMotor | null {
  try {
    return lanceDoMotor(fen, { profundidade: 1, tempoMs: 40, ruido: 0, erro: 0 }).lance;
  } catch {
    return null;
  }
}

function abrirWorker(): Worker {
  const aqui = import.meta.url;
  const fonte = aqui.endsWith('.ts');
  const arquivo = new URL(fonte ? './xadrez-robo-worker.ts' : './xadrez-robo-worker.js', aqui);
  const execArgv = fonte && !process.execArgv.some((a) => a.includes('tsx')) ? [...process.execArgv, '--import', 'tsx'] : undefined;
  const w = new Worker(arquivo, execArgv ? { execArgv } : undefined);
  w.on('message', (msg: { id: number; resultado?: { lance: LanceDoMotor | null }; erro?: string }) => {
    if (!atual || msg.id !== atual.id) return;
    const pedido = atual;
    atual = null;
    clearTimeout(pedido.relogio);
    if (msg.resultado && !msg.erro) {
      contagem.worker++;
      pedido.responder(msg.resultado.lance);
    } else responderComReserva(pedido);
    bombear();
  });
  const caiu = () => {
    if (worker !== w) return;
    worker = null;
    contagem.quedas++;
    if (atual) {
      const pedido = atual;
      atual = null;
      clearTimeout(pedido.relogio);
      responderComReserva(pedido);
    }
    bombear();
  };
  w.on('error', caiu);
  w.on('exit', caiu);
  return w;
}

function responderComReserva(pedido: NaFila) {
  contagem.reserva++;
  pedido.responder(lanceDeReserva(pedido.fen));
}

function bombear() {
  if (atual) return;
  const pedido = fila.shift();
  if (!pedido) {
    // nada a fazer: o worker não segura o processo, e sai se ninguém pedir mais nada
    worker?.unref();
    if (ocioso) clearTimeout(ocioso);
    ocioso = setTimeout(() => void desligarRoboDeXadrez(), OCIOSO_MS);
    ocioso.unref();
    return;
  }
  if (ocioso) {
    clearTimeout(ocioso);
    ocioso = null;
  }
  try {
    worker ??= abrirWorker();
  } catch {
    responderComReserva(pedido);
    return bombear();
  }
  worker.ref();
  atual = pedido;
  const limite = (NIVEIS_DO_MOTOR[pedido.nivel] ?? NIVEIS_DO_MOTOR.normal).tempoMs + FOLGA_DO_WORKER_MS;
  pedido.relogio = setTimeout(() => {
    if (atual !== pedido) return;
    // demorou demais: o worker está preso na conta, e sai
    atual = null;
    const w = worker;
    worker = null;
    contagem.quedas++;
    void w?.terminate();
    responderComReserva(pedido);
    bombear();
  }, limite);
  worker.postMessage({ id: pedido.id, fen: pedido.fen, historico: pedido.historico, nivel: pedido.nivel, semente: pedido.semente });
}

/** Pede o lance ao worker. Nunca rejeita: no pior caso, vem o lance de reserva (ou null, sem lance legal). */
export function pensarNoWorker(pedido: PedidoDoRobo): Promise<LanceDoMotor | null> {
  return new Promise((responder) => {
    const item: NaFila = { ...pedido, id: proximoId++, responder };
    if (fila.length >= FILA_MAXIMA) return responderComReserva(item);
    fila.push(item);
    bombear();
  });
}

/** Desliga o worker (o ocioso, e os testes no fim). O que estava na fila é respondido pela reserva. */
export async function desligarRoboDeXadrez() {
  const w = worker;
  worker = null;
  if (ocioso) clearTimeout(ocioso);
  ocioso = null;
  if (atual) {
    clearTimeout(atual.relogio);
    responderComReserva(atual);
    atual = null;
  }
  for (const p of fila.splice(0)) responderComReserva(p);
  await w?.terminate();
}

/** Só para os testes: derruba o worker no meio de uma conta, como se ele tivesse caído. */
export async function derrubarWorkerParaTeste() {
  await worker?.terminate();
}
