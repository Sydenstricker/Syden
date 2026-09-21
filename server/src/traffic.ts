import { readFileSync } from 'node:fs';
import * as db from './db.js';

// Mede o tráfego de saída da máquina lendo os contadores do Linux. Funciona em qualquer provedor
// (Oracle, Hetzner...), desde que o servidor rode com network_mode: host, como no deploy/.

const SAMPLE_INTERVAL_MS = 60_000;
// Interfaces internas (loopback, Docker, VPN) não são tráfego com a internet.
const IGNORED_INTERFACES = /^(lo|docker\d*|br-|veth|virbr|tun|tailscale|wg)/;

/** Bytes recebidos e transmitidos pelas interfaces de rede externas, ou null fora do Linux. */
export function readInterfaceBytes(): { received: number; sent: number } | null {
  try {
    let received = 0;
    let sent = 0;
    // Formato: "  eth0: <bytes recebidos> <7 campos> <bytes transmitidos> ..."
    for (const line of readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)) {
      const [name, fields] = line.split(':');
      if (!fields || IGNORED_INTERFACES.test(name.trim())) continue;
      const columns = fields.trim().split(/\s+/);
      received += Number(columns[0]);
      sent += Number(columns[8]);
    }
    return { received, sent };
  } catch {
    return null;
  }
}

function readTransmittedBytes(): number | null {
  return readInterfaceBytes()?.sent ?? null;
}

function readBootId(): string | null {
  try {
    return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
  } catch {
    return null;
  }
}

export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export const trafficSupported = readTransmittedBytes() !== null && readBootId() !== null;

/**
 * Soma ao mês atual o que foi enviado desde a última amostra. O último contador fica salvo no banco,
 * então reiniciar o app não perde nada; se a máquina reiniciou (boot_id mudou), o contador do Linux
 * recomeçou do zero e tudo o que ele marca é tráfego novo.
 */
function sample() {
  const counter = readTransmittedBytes();
  const bootId = readBootId();
  if (counter === null || bootId === null) return;

  const now = new Date();
  const lastRaw = db.getKv('traffic.last');
  if (lastRaw) {
    const last = JSON.parse(lastRaw) as { bootId: string; counter: number };
    const delta = last.bootId === bootId && counter >= last.counter ? counter - last.counter : counter;
    if (delta > 0) db.addTraffic(monthKey(now), delta);
  } else {
    // Primeira amostra: o que a máquina enviou antes da instalação não é do Janja.
    db.setKv('traffic.since', now.toISOString());
  }
  db.setKv('traffic.last', JSON.stringify({ bootId, counter }));
}

export function startTrafficSampling() {
  if (!trafficSupported) return;
  sample();
  setInterval(sample, SAMPLE_INTERVAL_MS).unref();
}
