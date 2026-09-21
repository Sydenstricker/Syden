import { statfsSync } from 'node:fs';
import { cpus, freemem, loadavg, totalmem } from 'node:os';
import { config } from './config.js';
import * as db from './db.js';
import { readInterfaceBytes } from './traffic.js';

// Saúde do servidor: uma amostra por minuto (processador, memória, disco, rede, servidor de voz e erros)
// e um diário de acontecimentos (reinícios, voz fora do ar, rajadas de erro). Serve para o administrador
// saber se houve instabilidade sem precisar abrir o terminal.

const SAMPLE_MS = 60_000;
const KEEP_DAYS = 7;
/** A partir daqui a amostra vira aviso no diário: 20 erros em um minuto não é coisa normal. */
const ERROR_BURST = 20;

const startedAt = new Date();
let errorsSinceSample = 0;
let livekitOk: boolean | null = null;
/** Contadores de rede da amostra anterior, para calcular a velocidade entre uma e outra. */
let lastNetwork: { at: number; received: number; sent: number } | null = null;

/** Velocidade de rede desde a última amostra, em bits por segundo. */
function networkRate() {
  const counters = readInterfaceBytes();
  const now = Date.now();
  if (!counters) return { in: null, out: null };
  const previous = lastNetwork;
  lastNetwork = { at: now, ...counters };
  if (!previous || now <= previous.at) return { in: null, out: null };
  const seconds = (now - previous.at) / 1000;
  const rate = (current: number, before: number) => (current >= before ? Math.round(((current - before) * 8) / seconds) : null);
  return { in: rate(counters.received, previous.received), out: rate(counters.sent, previous.sent) };
}

/**
 * Erro que aconteceu no app de alguém (microfone bloqueado, conexão de voz barrada). O servidor não tem como
 * ver isso sozinho, então o próprio app conta, e o diário guarda para o administrador.
 */
export function recordClientError(username: string, kind: string, message: string) {
  db.addHealthEvent(`app:${kind}`, `${username}: ${message}`);
}

/** Contabiliza uma resposta com erro do servidor (5xx). */
export function countServerError() {
  errorsSinceSample++;
}

/** Fração de processador em uso (0 a 1), pela média de carga do último minuto. */
function cpuLoad() {
  return Math.min(1, loadavg()[0] / Math.max(1, cpus().length));
}

function memoryUsed() {
  return 1 - freemem() / totalmem();
}

function disk() {
  try {
    const stat = statfsSync('/');
    return { free: stat.bfree * stat.bsize, total: stat.blocks * stat.bsize };
  } catch {
    return null; // fora do Linux
  }
}

/** O servidor de voz responde? É o que quebra primeiro numa instabilidade. */
async function checkLivekit(): Promise<boolean> {
  const url = config.livekit.url.replace(/^ws/, 'http');
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function sample() {
  const errors = errorsSinceSample;
  errorsSinceSample = 0;
  const wasOk = livekitOk;
  livekitOk = await checkLivekit();
  const space = disk();
  const network = networkRate();

  db.addHealthSample({
    at: new Date().toISOString(),
    cpu: cpuLoad(),
    memory: memoryUsed(),
    diskFree: space?.free ?? null,
    diskTotal: space?.total ?? null,
    livekitOk,
    errors,
    networkIn: network.in,
    networkOut: network.out,
  });

  if (wasOk !== null && wasOk !== livekitOk) {
    db.addHealthEvent(livekitOk ? 'livekit_up' : 'livekit_down', livekitOk ? 'Servidor de voz voltou.' : 'Servidor de voz parou de responder.');
  }
  if (errors >= ERROR_BURST) {
    db.addHealthEvent('errors', `${errors} erros do servidor em um minuto.`);
  }
  db.pruneHealth(new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
}

export function startHealthSampling() {
  db.addHealthEvent('start', 'O servidor foi iniciado (atualização ou reinício).');
  void sample();
  setInterval(() => void sample(), SAMPLE_MS).unref();
}

export interface HealthReport {
  startedAt: string;
  uptimeSeconds: number;
  livekitOk: boolean | null;
  cpu: number;
  memory: number;
  diskFree: number | null;
  diskTotal: number | null;
  /** Erros do servidor desde a última amostra, mais o que já está registrado nas últimas 24 h. */
  errorsNow: number;
  errors24h: number;
  samples: db.HealthSample[];
  events: db.HealthEvent[];
}

export function healthReport(): HealthReport {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const samples = db.listHealthSamples(since);
  const space = disk();
  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    livekitOk,
    cpu: cpuLoad(),
    memory: memoryUsed(),
    diskFree: space?.free ?? null,
    diskTotal: space?.total ?? null,
    errorsNow: errorsSinceSample,
    errors24h: samples.reduce((sum, s) => sum + s.errors, 0) + errorsSinceSample,
    samples,
    events: db.listHealthEvents(30),
  };
}
