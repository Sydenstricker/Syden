import { config } from './config.js';
import * as db from './db.js';
import { monthKey, trafficSupported } from './traffic.js';

export type Traffic =
  | { status: 'unavailable'; message: string }
  | {
      status: 'ok';
      /** Só o tráfego de saída conta para a franquia. */
      outgoingBytes: number;
      includedBytes: number;
      /** Estimativa para o mês inteiro no ritmo medido; null enquanto há poucos dias de medição. */
      projectedBytes: number | null;
      /** Quando a medição começou neste mês (depois do dia 1 se o servidor foi instalado no meio do mês). */
      measuringSince: string;
    };

export interface UsageSummary {
  monthStart: string;
  /** Fração do mês já passada (0 a 1). */
  monthProgress: number;
  traffic: Traffic;
  users: db.UsageByUser[];
}

const MIN_DAYS_FOR_PROJECTION = 2;
const DAY_MS = 86_400_000;

function monthBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, progress: (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) };
}

function currentTraffic(now: Date, start: Date, end: Date): Traffic {
  if (!trafficSupported) {
    return { status: 'unavailable', message: 'O tráfego é medido no servidor Linux; aparece aqui depois da publicação.' };
  }
  const since = new Date(Math.max(start.getTime(), Date.parse(db.getKv('traffic.since') ?? now.toISOString())));
  const measuredMs = now.getTime() - since.getTime();
  const outgoing = db.trafficForMonth(monthKey(now));
  return {
    status: 'ok',
    outgoingBytes: outgoing,
    includedBytes: config.trafficAllowanceGb * 1e9,
    projectedBytes:
      measuredMs >= MIN_DAYS_FOR_PROJECTION * DAY_MS
        ? Math.round((outgoing / measuredMs) * (end.getTime() - start.getTime()))
        : null,
    measuringSince: since.toISOString(),
  };
}

export function usageSummary(): UsageSummary {
  const now = new Date();
  const { start, end, progress } = monthBounds(now);
  return {
    monthStart: start.toISOString(),
    monthProgress: progress,
    traffic: currentTraffic(now, start, end),
    users: db.usageSince(start.toISOString()),
  };
}
