import { config } from './config.js';

// Gráficos do próprio provedor (Hetzner), os mesmos da aba "Graphs" no painel deles. O servidor busca por
// nós, com um token só de leitura, para o administrador não precisar sair do Syden. Sem token configurado,
// a aba simplesmente não mostra esta parte.

const API = 'https://api.hetzner.cloud/v1';
const CACHE_MS = 60_000;

export interface ProviderSeries {
  /** Nome da série, já em português ("Processador", "Rede enviando"…). */
  label: string;
  /** Como escrever os valores: porcentagem, bits por segundo, operações por segundo. */
  unit: 'percent' | 'bps' | 'iops' | 'pps';
  points: { at: string; value: number }[];
}

export interface ProviderMetrics {
  name: string;
  series: ProviderSeries[];
}

export const providerConfigured = Boolean(config.hetzner.token && config.hetzner.serverId);

let cache: { at: number; data: ProviderMetrics | null } | null = null;

type HetznerMetrics = {
  metrics: {
    start: string;
    end: string;
    step: number;
    time_series: Record<string, { values: [number, string][] }>;
  };
};

/** Cada série que a Hetzner devolve, com o nome que vai aparecer na tela. */
const SERIES: Record<string, { label: string; unit: ProviderSeries['unit']; scale?: number }> = {
  cpu: { label: 'Processador', unit: 'percent', scale: 0.01 },
  'network.0.bandwidth.in': { label: 'Rede recebendo', unit: 'bps', scale: 8 },
  'network.0.bandwidth.out': { label: 'Rede enviando', unit: 'bps', scale: 8 },
  'network.0.pps.in': { label: 'Pacotes recebidos', unit: 'pps' },
  'network.0.pps.out': { label: 'Pacotes enviados', unit: 'pps' },
  'disk.0.iops.read': { label: 'Disco lendo', unit: 'iops' },
  'disk.0.iops.write': { label: 'Disco gravando', unit: 'iops' },
};

async function fetchMetrics(): Promise<ProviderMetrics | null> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600_000);
  const url = `${API}/servers/${config.hetzner.serverId}/metrics?type=cpu,network,disk&start=${start.toISOString()}&end=${end.toISOString()}&step=300`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${config.hetzner.token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Hetzner respondeu ${response.status}`);
  const body = (await response.json()) as HetznerMetrics;

  const series: ProviderSeries[] = [];
  for (const [key, meta] of Object.entries(SERIES)) {
    const values = body.metrics.time_series[key]?.values;
    if (!values) continue;
    series.push({
      label: meta.label,
      unit: meta.unit,
      points: values.map(([seconds, value]) => ({
        at: new Date(seconds * 1000).toISOString(),
        value: Number(value) * (meta.scale ?? 1),
      })),
    });
  }
  return { name: 'Hetzner', series };
}

/** Números do provedor, no máximo um pedido por minuto (a API deles tem limite de chamadas). */
export async function providerMetrics(): Promise<ProviderMetrics | null> {
  if (!providerConfigured) return null;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const data = await fetchMetrics();
    cache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error('Não foi possível ler os gráficos da Hetzner:', error);
    cache = { at: Date.now(), data: null };
    return null;
  }
}
