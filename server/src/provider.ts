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

/** Os períodos que o painel oferece, com o passo que dá ~300 pontos em cada um. */
export const PERIODOS_DO_PROVEDOR = { 24: 300, 168: 1800 } as const;
export type PeriodoDoProvedor = keyof typeof PERIODOS_DO_PROVEDOR;

const cache = new Map<PeriodoDoProvedor, { at: number; data: ProviderMetrics | null }>();

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

async function fetchMetrics(horas: PeriodoDoProvedor): Promise<ProviderMetrics | null> {
  const end = new Date();
  const start = new Date(end.getTime() - horas * 3600_000);
  const url = `${API}/servers/${config.hetzner.serverId}/metrics?type=cpu,network,disk&start=${start.toISOString()}&end=${end.toISOString()}&step=${PERIODOS_DO_PROVEDOR[horas]}`;
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
export async function providerMetrics(horas: PeriodoDoProvedor = 24): Promise<ProviderMetrics | null> {
  if (!providerConfigured) return null;
  const guardado = cache.get(horas);
  if (guardado && Date.now() - guardado.at < CACHE_MS) return guardado.data;
  try {
    const data = await fetchMetrics(horas);
    cache.set(horas, { at: Date.now(), data });
    return data;
  } catch (error) {
    console.error('Não foi possível ler os gráficos da Hetzner:', error);
    cache.set(horas, { at: Date.now(), data: null });
    return null;
  }
}

// O histórico de ações do servidor na Hetzner (ligar, desligar, reiniciar, trocar de plano…), o mesmo da aba
// "Activity" do painel deles. É o que diz, depois do fato, se uma queda foi COMANDADA (pelo painel ou pela API,
// por alguém ou por um script) ou se aconteceu sem ação nenhuma, do lado do host — a pergunta do suporte.

export interface ProviderAction {
  id: number;
  /** O nome do comando na API da Hetzner ("reboot_server", "poweroff"…); o painel traduz os conhecidos. */
  command: string;
  status: 'running' | 'success' | 'error';
  started: string;
  finished: string | null;
  error: string | null;
}

type HetznerActions = {
  actions: {
    id: number;
    command: string;
    status: ProviderAction['status'];
    started: string;
    finished: string | null;
    error: { code: string; message: string } | null;
  }[];
};

let cacheDeAcoes: { at: number; data: ProviderAction[] | null } | null = null;

/** As 50 ações mais recentes, da mais nova para a mais antiga; nulo sem token ou se a Hetzner não responder. */
export async function providerActions(): Promise<ProviderAction[] | null> {
  if (!providerConfigured) return null;
  if (cacheDeAcoes && Date.now() - cacheDeAcoes.at < CACHE_MS) return cacheDeAcoes.data;
  try {
    const url = `${API}/servers/${config.hetzner.serverId}/actions?sort=started:desc&per_page=50`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${config.hetzner.token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Hetzner respondeu ${response.status}`);
    const body = (await response.json()) as HetznerActions;
    const data = body.actions.map((a) => ({
      id: a.id,
      command: a.command,
      status: a.status,
      started: a.started,
      finished: a.finished,
      error: a.error ? `${a.error.code}: ${a.error.message}` : null,
    }));
    cacheDeAcoes = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error('Não foi possível ler as ações da Hetzner:', error);
    cacheDeAcoes = { at: Date.now(), data: null };
    return null;
  }
}
