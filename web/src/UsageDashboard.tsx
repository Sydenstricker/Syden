import { AlertOctagon, AlertTriangle, BarChart3, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Traffic, UsageSummary, VoiceMember } from './types';

const REFRESH_MS = 60_000;
// Tela 1080p30: até 5 Mbps ≈ 2,25 GB por hora para cada pessoa assistindo (telas paradas gastam bem menos).
const SCREEN_GB_PER_VIEWER_HOUR = 2.25;

export function UsageDashboard({ voiceMembers }: { voiceMembers: VoiceMember[] }) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      api<UsageSummary>('/api/usage')
        .then((data) => {
          if (cancelled) return;
          setUsage(data);
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

  const inCall = voiceMembers.length;
  const sharing = voiceMembers.filter((m) => m.screen).length;
  const totalVoice = usage?.users.reduce((sum, u) => sum + u.voiceSeconds, 0) ?? 0;
  const totalScreen = usage?.users.reduce((sum, u) => sum + u.screenSeconds, 0) ?? 0;
  const maxVoice = Math.max(1, ...(usage?.users.map((u) => u.voiceSeconds) ?? []));

  return (
    <div className="usage">
      <header className="main-header">
        <BarChart3 size={22} className="muted-icon" /> Uso do servidor
      </header>

      {/* Ao recarregar, mantém os números anteriores esmaecidos em vez de piscar a tela. */}
      <div className="usage-body" style={{ opacity: loading && usage ? 0.6 : 1 }}>
        {error && !usage && <p className="form-error">{error}</p>}
        {usage && (
          <>
            <p className="usage-period">{formatMonth(usage.monthStart)} · atualiza a cada minuto</p>

            <section className="usage-card">
              <h2>Tráfego de saída este mês</h2>
              <TrafficPanel traffic={usage.traffic} monthStart={usage.monthStart} />
            </section>

            <div className="usage-kpis">
              <StatTile label="Horas em chamada" value={formatDuration(totalVoice)} note="somando todos" />
              <StatTile label="Horas compartilhando tela" value={formatDuration(totalScreen)} note="somando todos" />
              <StatTile
                label="Em chamada agora"
                value={String(inCall)}
                note={sharing > 0 ? `${sharing} compartilhando tela` : inCall === 1 ? 'pessoa' : 'pessoas'}
              />
            </div>

            <section className="usage-card">
              <h2>Por pessoa, este mês</h2>
              {usage.users.length === 0 ? (
                <p className="usage-muted">Ninguém entrou em chamada este mês ainda.</p>
              ) : (
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th scope="col">Pessoa</th>
                      <th scope="col">Em chamada</th>
                      <th scope="col" className="num">
                        Compartilhando tela
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.users.map((u) => (
                      <tr key={u.userId}>
                        <td>{u.username}</td>
                        <td>
                          <div className="usage-bar-cell">
                            <div className="usage-bar-track">
                              <span className="usage-bar" style={{ width: `${(u.voiceSeconds / maxVoice) * 100}%` }} />
                            </div>
                            <span className="num">{formatDuration(u.voiceSeconds)}</span>
                          </div>
                        </td>
                        <td className="num">{u.screenSeconds > 0 ? formatDuration(u.screenSeconds) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function TrafficPanel({ traffic, monthStart }: { traffic: Traffic; monthStart: string }) {
  if (traffic.status === 'unavailable') return <p className="usage-muted">{traffic.message}</p>;

  const used = traffic.outgoingBytes / traffic.includedBytes;
  const projected = traffic.projectedBytes === null ? null : traffic.projectedBytes / traffic.includedBytes;
  const level = Math.max(used, projected ?? 0);
  const status = used >= 1 || level > 1 ? 'critical' : level >= 0.8 ? 'warning' : 'good';
  const StatusIcon = { good: CheckCircle2, warning: AlertTriangle, critical: AlertOctagon }[status];
  const statusLabel = {
    good: 'Dentro da franquia',
    warning: 'Perto do limite da franquia',
    critical: used >= 1 ? 'Franquia do mês ultrapassada' : 'No ritmo atual, vai passar da franquia',
  }[status];
  const startedMidMonth = Date.parse(traffic.measuringSince) > Date.parse(monthStart);

  return (
    <>
      <div className="usage-hero">
        <span className="usage-hero-value">{formatBytes(traffic.outgoingBytes)}</span>
        <span className="usage-hero-of">de {formatBytes(traffic.includedBytes)} grátis por mês</span>
      </div>
      <div
        className={`usage-meter ${status}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={traffic.includedBytes}
        aria-valuenow={traffic.outgoingBytes}
        aria-label="Tráfego usado da franquia"
      >
        <span style={{ width: `${Math.min(used, 1) * 100}%` }} />
      </div>
      <div className="usage-status">
        <StatusIcon size={16} className={`status-icon ${status}`} aria-hidden="true" />
        <span>
          {statusLabel} · {formatPercent(used)} usado
          {projected !== null && <> · projeção para o fim do mês: {formatBytes(traffic.projectedBytes!)}</>}
        </span>
      </div>
      <p className="usage-muted small">
        {startedMidMonth && <>Medindo desde {formatDay(traffic.measuringSince)}. </>}
        Compartilhar tela é o que mais consome: até {formatNumber(SCREEN_GB_PER_VIEWER_HOUR)} GB por hora para cada
        pessoa assistindo. Voz quase não pesa.
      </p>
    </>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

// Unidades decimais, como os provedores anunciam a franquia (10 TB = 10 × 1000⁴ bytes).
const TB = 1e12;
const GB = 1e9;
const MB = 1e6;

function formatNumber(value: number, digits = 1) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function formatBytes(bytes: number) {
  if (bytes >= TB) return `${formatNumber(bytes / TB)} TB`;
  if (bytes >= GB) return `${formatNumber(bytes / GB, bytes >= 100 * GB ? 0 : 1)} GB`;
  return `${formatNumber(bytes / MB, 0)} MB`;
}

function formatPercent(fraction: number) {
  return `${formatNumber(fraction * 100, fraction < 0.1 ? 1 : 0)}%`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return seconds > 0 ? 'menos de 1 min' : '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (hours >= 100) return `${hours} h`;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatMonth(iso: string) {
  const text = new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
