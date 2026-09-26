/**
 * O histórico de disponibilidade visto DE FORA, pelo UptimeRobot.
 *
 * Vale dizer o que isto é e o que não é, porque tem um paradoxo óbvio: **se o servidor estiver fora do
 * ar, esta tela não abre.** O aviso de queda continua sendo o e-mail que o UptimeRobot manda — isto aqui
 * é a MEMÓRIA: quanto o Syden ficou no ar nos últimos dias e quando foram as quedas. É o número que
 * responde "o Syden é confiável?" com dado em vez de impressão.
 *
 * Sem chave configurada, não aparece nada na tela — como os gráficos da Hetzner.
 * A chave sai de: uptimerobot.com → My Settings → API → Read-Only API Key.
 */
import { config } from './config.js';

const API = 'https://api.uptimerobot.com/v2/getMonitors';
const CACHE_MS = 60_000;

export interface Disponibilidade {
  nome: string;
  /** O que o mundo de fora vê agora. */
  situacao: 'no ar' | 'fora do ar' | 'pausado' | 'aguardando';
  /** Porcentagem de tempo no ar em 1, 7 e 30 dias. */
  umDia: number | null;
  seteDias: number | null;
  trintaDias: number | null;
  /** As últimas quedas, da mais recente para a mais antiga. */
  quedas: { quando: string; duracaoMin: number }[];
}

export const uptimeConfigurado = Boolean(config.uptimeRobotKey);

let cache: { at: number; data: Disponibilidade | null } | null = null;

/** Os códigos que o UptimeRobot usa para o estado de um monitor. */
const SITUACAO: Record<number, Disponibilidade['situacao']> = {
  0: 'pausado',
  1: 'aguardando',
  2: 'no ar',
  8: 'fora do ar',
  9: 'fora do ar',
};

export async function disponibilidade(): Promise<Disponibilidade | null> {
  if (!uptimeConfigurado) return null;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  try {
    const resposta = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
      body: JSON.stringify({
        api_key: config.uptimeRobotKey,
        format: 'json',
        custom_uptime_ratios: '1-7-30',
        logs: 1,
        logs_limit: 5,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) throw new Error(`respondeu ${resposta.status}`);

    const corpo = (await resposta.json()) as {
      stat?: string;
      monitors?: {
        friendly_name?: string;
        status?: number;
        custom_uptime_ratio?: string;
        logs?: { type?: number; datetime?: number; duration?: number }[];
      }[];
    };

    const monitor = corpo.monitors?.[0];
    if (corpo.stat !== 'ok' || !monitor) throw new Error('resposta sem monitor');

    // Vem como "99.988-99.972-99.981": um dia, sete dias, trinta dias.
    const [umDia, seteDias, trintaDias] = (monitor.custom_uptime_ratio ?? '').split('-').map((n) => {
      const valor = Number(n);
      return Number.isFinite(valor) ? valor : null;
    });

    const data: Disponibilidade = {
      nome: monitor.friendly_name ?? 'Syden',
      situacao: SITUACAO[monitor.status ?? 1] ?? 'aguardando',
      umDia: umDia ?? null,
      seteDias: seteDias ?? null,
      trintaDias: trintaDias ?? null,
      // type 1 = caiu. Os outros tipos são "voltou" e "pausado", que não interessam na lista de quedas.
      quedas: (monitor.logs ?? [])
        .filter((l) => l.type === 1 && l.datetime)
        .map((l) => ({ quando: new Date(l.datetime! * 1000).toISOString(), duracaoMin: Math.round((l.duration ?? 0) / 60) })),
    };

    cache = { at: Date.now(), data };
    return data;
  } catch {
    // Falha ao consultar não é queda do Syden: guarda o vazio por um minuto para não insistir a cada
    // abertura do painel, e a tela simplesmente não mostra a seção.
    cache = { at: Date.now(), data: null };
    return null;
  }
}
