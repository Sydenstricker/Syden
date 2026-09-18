import { config } from './config.js';
import * as db from './db.js';

export type Traffic =
  | { status: 'unconfigured' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      /** Só o tráfego de saída conta para a franquia da Hetzner. */
      outgoingBytes: number;
      includedBytes: number;
      /** Estimativa para o fim do mês no ritmo atual; null no começo do mês, quando ainda não diz nada. */
      projectedBytes: number | null;
      serverName: string;
    };

export interface UsageSummary {
  monthStart: string;
  /** Fração do mês já passada (0 a 1). */
  monthProgress: number;
  traffic: Traffic;
  users: db.UsageByUser[];
}

const TRAFFIC_CACHE_MS = 5 * 60_000;
const METADATA_URL = 'http://169.254.169.254/hetzner/v1/metadata/instance-id';

let trafficCache: { at: number; value: Traffic } | null = null;
let detectedServerId: string | null = null;

function monthBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, progress: (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) };
}

async function serverId(): Promise<string> {
  if (config.hetzner.serverId) return config.hetzner.serverId;
  if (detectedServerId) return detectedServerId;
  const response = await fetch(METADATA_URL, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`metadados responderam ${response.status}`);
  detectedServerId = (await response.text()).trim();
  return detectedServerId;
}

async function fetchTraffic(monthProgress: number): Promise<Traffic> {
  if (!config.hetzner.token) return { status: 'unconfigured' };
  try {
    const id = await serverId();
    const response = await fetch(`${config.hetzner.apiUrl}/servers/${id}`, {
      headers: { authorization: `Bearer ${config.hetzner.token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`API da Hetzner respondeu ${response.status}`);
    const { server } = (await response.json()) as {
      server: { name: string; outgoing_traffic: number | null; included_traffic: number };
    };
    const outgoing = server.outgoing_traffic ?? 0;
    return {
      status: 'ok',
      outgoingBytes: outgoing,
      includedBytes: server.included_traffic,
      projectedBytes: monthProgress >= 0.1 ? Math.round(outgoing / monthProgress) : null,
      serverName: server.name,
    };
  } catch (error) {
    console.error('Falha ao consultar o tráfego na Hetzner:', error);
    return { status: 'error', message: 'Não foi possível consultar a Hetzner agora.' };
  }
}

export async function usageSummary(): Promise<UsageSummary> {
  const now = new Date();
  const { start, progress } = monthBounds(now);
  if (!trafficCache || now.getTime() - trafficCache.at > TRAFFIC_CACHE_MS) {
    trafficCache = { at: now.getTime(), value: await fetchTraffic(progress) };
  }
  return {
    monthStart: start.toISOString(),
    monthProgress: progress,
    traffic: trafficCache.value,
    users: db.usageSince(start.toISOString()),
  };
}
