import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { HealthEvent, HealthReport, HealthSample } from './types';

const REFRESH_MS = 60_000;

/** Estado do servidor agora e o que aconteceu nas últimas 24 horas. */
export function HealthPanel() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      api<HealthReport>('/api/status')
        .then((data) => {
          if (cancelled) return;
          setHealth(data);
          setError(null);
        })
        .catch((e) => !cancelled && setError((e as Error).message))
        .finally(() => !cancelled && setLoading(false));
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error && !health) return <p className="form-error">{error}</p>;
  if (!health) return <p className="usage-muted">Carregando…</p>;

  const diskUsed = health.diskFree !== null && health.diskTotal ? 1 - health.diskFree / health.diskTotal : null;
  const quedas = health.events.filter((e) => e.kind === 'livekit_down').length;
  const reinicios = health.events.filter((e) => e.kind === 'start').length;

  return (
    <div style={{ opacity: loading ? 0.6 : 1 }}>
      <section className="usage-card">
        <h2>Agora</h2>
        <div className="health-grid">
          <HealthTile
            label="Conversas por voz"
            value={health.livekitOk === false ? 'Fora do ar' : 'Funcionando'}
            status={health.livekitOk === false ? 'critical' : 'good'}
            note={health.livekitOk === null ? 'primeira checagem em instantes' : 'checado a cada minuto'}
          />
          <HealthTile
            label="Chat e login"
            value="Funcionando"
            status={health.errorsNow > 0 ? 'warning' : 'good'}
            note={`no ar há ${formatUptime(health.uptimeSeconds)}`}
          />
          <HealthTile
            label="Processador"
            value={formatPercent(health.cpu)}
            status={health.cpu >= 0.9 ? 'critical' : health.cpu >= 0.7 ? 'warning' : 'good'}
            note="média do último minuto"
          />
          <HealthTile
            label="Memória"
            value={formatPercent(health.memory)}
            status={health.memory >= 0.92 ? 'critical' : health.memory >= 0.8 ? 'warning' : 'good'}
            note="em uso"
          />
          {diskUsed !== null && (
            <HealthTile
              label="Disco"
              value={formatPercent(diskUsed)}
              status={diskUsed >= 0.9 ? 'critical' : diskUsed >= 0.75 ? 'warning' : 'good'}
              note={`${formatBytes(health.diskFree!)} livres`}
            />
          )}
          <HealthTile
            label="Erros do servidor"
            value={String(health.errors24h)}
            status={health.errors24h >= 20 ? 'critical' : health.errors24h > 0 ? 'warning' : 'good'}
            note="nas últimas 24 h"
          />
        </div>
      </section>

      <section className="usage-card">
        <h2>Últimas 24 horas</h2>
        {health.samples.length < 2 ? (
          <p className="usage-muted">
            O histórico começa depois de algumas medições. O servidor tira uma por minuto, e elas ficam
            guardadas por uma semana.
          </p>
        ) : (
          <div className="spark-grid">
            <Sparkline title="Processador" samples={health.samples} pick={(s) => s.cpu} color="#06b6d4" />
            <Sparkline title="Memória" samples={health.samples} pick={(s) => s.memory} color="#8b5cf6" />
            {health.samples.some((s) => s.networkOut !== null) && (
              <Sparkline
                title="Rede enviando"
                samples={health.samples}
                pick={(s) => s.networkOut ?? 0}
                color="#ed4245"
                format={formatBits}
              />
            )}
            {health.samples.some((s) => s.networkIn !== null) && (
              <Sparkline
                title="Rede recebendo"
                samples={health.samples}
                pick={(s) => s.networkIn ?? 0}
                color="#5865f2"
                format={formatBits}
              />
            )}
          </div>
        )}
        <p className="usage-muted small">
          {reinicios > 0 && <>{reinicios === 1 ? 'Um reinício registrado' : `${reinicios} reinícios registrados`}. </>}
          {quedas > 0
            ? `A voz saiu do ar ${quedas === 1 ? 'uma vez' : `${quedas} vezes`} no período guardado.`
            : 'Nenhuma queda da voz no período guardado.'}
        </p>
      </section>

      <section className="usage-card">
        <h2>Acontecimentos</h2>
        {health.events.length === 0 ? (
          <p className="usage-muted">Nada digno de nota até agora.</p>
        ) : (
          <ul className="event-list">
            {health.events.map((event) => (
              <EventRow key={event.at + event.kind} event={event} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Status = 'good' | 'warning' | 'critical';

const STATUS_ICON = { good: CheckCircle2, warning: AlertTriangle, critical: AlertOctagon };

function HealthTile({ label, value, status, note }: { label: string; value: string; status: Status; note?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value health-value">
        {/* Estado nunca é só cor: vem com ícone e texto, para quem não distingue as cores. */}
        <Icon size={18} className={`status-icon ${status}`} aria-hidden="true" />
        {value}
      </span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

/** Linha fina com o histórico de uma medida; o valor exato aparece ao passar o mouse. */
function Sparkline({
  title,
  samples,
  pick,
  color,
  format = formatPercent,
}: {
  title: string;
  samples: HealthSample[];
  pick: (sample: HealthSample) => number;
  color: string;
  /** Como escrever o valor: porcentagem (processador, memória) ou velocidade (rede). */
  format?: (value: number) => string;
}) {
  const [hover, setHover] = useState<HealthSample | null>(null);
  const width = 100;
  const height = 30;
  const values = samples.map(pick);
  const max = Math.max(0.1, ...values);
  const points = values
    .map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - (value / max) * height}`)
    .join(' ');
  const last = values[values.length - 1] ?? 0;

  return (
    <figure className="spark">
      <figcaption>
        {title} <span className="spark-now">{format(hover ? pick(hover) : last)}</span>
        {hover && <span className="spark-when">{formatTime(hover.at)}</span>}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${title}: pico de ${format(max)}`}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        className="spark-hit"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const index = Math.round(((e.clientX - box.left) / box.width) * (samples.length - 1));
          setHover(samples[Math.min(samples.length - 1, Math.max(0, index))] ?? null);
        }}
      />
      <span className="spark-scale">
        pico {format(max)} · {formatTime(samples[0].at)} até agora
      </span>
    </figure>
  );
}

const EVENT_LABEL: Record<string, { text: string; status: Status }> = {
  start: { text: 'Servidor iniciado', status: 'good' },
  livekit_down: { text: 'Voz fora do ar', status: 'critical' },
  livekit_up: { text: 'Voz de volta', status: 'good' },
  errors: { text: 'Rajada de erros', status: 'warning' },
};

function EventRow({ event }: { event: HealthEvent }) {
  // "app:microfone" é um problema no computador de alguém, contado pelo próprio app.
  const fromApp = event.kind.startsWith('app:');
  const known = fromApp
    ? { text: `Problema de ${event.kind.slice(4)}`, status: 'warning' as Status }
    : (EVENT_LABEL[event.kind] ?? { text: event.kind, status: 'warning' as Status });
  const Icon = event.kind === 'start' ? Info : STATUS_ICON[known.status];
  return (
    <li className="event-row">
      <Icon size={16} className={`status-icon ${known.status}`} aria-hidden="true" />
      <span className="event-when">{formatMoment(event.at)}</span>
      <span className="event-text">
        <strong>{known.text}.</strong> {event.detail}
      </span>
    </li>
  );
}

function formatBits(bitsPerSecond: number) {
  if (bitsPerSecond >= 1e9) return `${(bitsPerSecond / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Gbps`;
  if (bitsPerSecond >= 1e6) return `${(bitsPerSecond / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mbps`;
  return `${Math.round(bitsPerSecond / 1e3)} kbps`;
}

function formatPercent(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

const GB = 1e9;

function formatBytes(bytes: number) {
  return `${(bytes / GB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  if (hours > 0) return `${hours} h`;
  return minutes >= 1 ? `${minutes} min` : 'menos de 1 min';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatMoment(iso: string) {
  const date = new Date(iso);
  const hoje = new Date().toDateString() === date.toDateString();
  return hoje
    ? `hoje, ${formatTime(iso)}`
    : `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${formatTime(iso)}`;
}
