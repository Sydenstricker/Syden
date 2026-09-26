import { AlertOctagon, AlertTriangle, BarChart3, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { PainelAuditoria } from './PainelAuditoria';
import { PainelDenuncias } from './PainelDenuncias';
import { HealthPanel } from './HealthPanel';
import { MobileBackButton } from './MobileBackButton';
import type { Traffic, UsageSummary, VoiceMember } from './types';

const REFRESH_MS = 60_000;
// Tela 1080p30: até 5 Mbps ≈ 2,25 GB por hora para cada pessoa assistindo (telas paradas gastam bem menos).
const SCREEN_GB_PER_VIEWER_HOUR = 2.25;
// Voz: ~48 kbps por pessoa ouvindo ≈ 0,02 GB por hora. É o que faz a tela pesar ~100 vezes mais.
const VOICE_GB_PER_LISTENER_HOUR = 0.02;

/**
 * Divide o tráfego medido entre voz e tela. O servidor mede o total de bytes que saíram, mas não sabe dizer
 * quanto foi de cada coisa; a divisão usa o tempo de cada atividade e o peso típico de cada uma.
 */
function splitTraffic(voiceSeconds: number, screenSeconds: number, totalBytes: number) {
  const voiceWeight = (voiceSeconds / 3600) * VOICE_GB_PER_LISTENER_HOUR;
  const screenWeight = (screenSeconds / 3600) * SCREEN_GB_PER_VIEWER_HOUR;
  const total = voiceWeight + screenWeight;
  if (total === 0) return { voiceBytes: 0, screenBytes: 0, screenShare: 0 };
  const screenShare = screenWeight / total;
  return { voiceBytes: totalBytes * (1 - screenShare), screenBytes: totalBytes * screenShare, screenShare };
}

export function UsageDashboard({
  voiceMembers,
  onMobileBack,
}: {
  voiceMembers: VoiceMember[];
  /** Tela estreita: volta para a lista de canais. */
  onMobileBack: () => void;
}) {
  const [tab, setTab] = useState<'consumo' | 'saude' | 'denuncias' | 'auditoria'>('consumo');
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
        <MobileBackButton onBack={onMobileBack} />
        <BarChart3 size={22} className="muted-icon" /> Uso do servidor
        <div className="tab-row" role="tablist" aria-label="Painéis do servidor">
          <button role="tab" aria-selected={tab === 'consumo'} className={`tab${tab === 'consumo' ? ' active' : ''}`} onClick={() => setTab('consumo')}>
            Consumo
          </button>
          <button role="tab" aria-selected={tab === 'saude'} className={`tab${tab === 'saude' ? ' active' : ''}`} onClick={() => setTab('saude')}>
            Saúde do servidor
          </button>
          <button
            role="tab"
            aria-selected={tab === 'denuncias'}
            className={`tab${tab === 'denuncias' ? ' active' : ''}`}
            onClick={() => setTab('denuncias')}
          >
            Denúncias
          </button>
          <button
            role="tab"
            aria-selected={tab === 'auditoria'}
            className={`tab${tab === 'auditoria' ? ' active' : ''}`}
            onClick={() => setTab('auditoria')}
          >
            Registro
          </button>
        </div>
      </header>

      {tab === 'denuncias' && <PainelDenuncias />}

      {tab === 'auditoria' && <PainelAuditoria />}

      {tab === 'saude' && (
        <div className="usage-body">
          <HealthPanel />
        </div>
      )}

      {/* Ao recarregar, mantém os números anteriores esmaecidos em vez de piscar a tela. */}
      <div className="usage-body" style={{ opacity: loading && usage ? 0.6 : 1, display: tab === 'consumo' ? undefined : 'none' }}>
        {error && !usage && <p className="form-error">{error}</p>}
        {usage && (
          <>
            <p className="usage-period">{formatMonth(usage.monthStart)} · atualiza a cada minuto</p>

            <section className="usage-card">
              <h2>Tráfego de saída este mês</h2>
              <TrafficPanel traffic={usage.traffic} monthStart={usage.monthStart} />
              {usage.traffic.status === 'ok' && (
                <SplitPanel voiceSeconds={totalVoice} screenSeconds={totalScreen} totalBytes={usage.traffic.outgoingBytes} />
              )}
            </section>

            <div className="usage-kpis">
              <StatTile label="Horas em chamada" value={formatDuration(totalVoice)} note="somando todos" kind="voice" />
              <StatTile label="Horas compartilhando tela" value={formatDuration(totalScreen)} note="somando todos" kind="screen" />
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
                      <th scope="col">
                        <span className="legend-dot voice" aria-hidden="true" /> Em chamada
                      </th>
                      <th scope="col">
                        <span className="legend-dot screen" aria-hidden="true" /> Compartilhando tela
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
                              <span className="usage-bar voice" style={{ width: `${(u.voiceSeconds / maxVoice) * 100}%` }} />
                            </div>
                            <span className="num">{formatDuration(u.voiceSeconds)}</span>
                          </div>
                        </td>
                        <td>
                          {/* Na mesma escala da coluna do lado: dá para ver de relance quanto do tempo virou transmissão. */}
                          <div className="usage-bar-cell">
                            <div className="usage-bar-track">
                              <span className="usage-bar screen" style={{ width: `${(u.screenSeconds / maxVoice) * 100}%` }} />
                            </div>
                            <span className="num">{u.screenSeconds > 0 ? formatDuration(u.screenSeconds) : '—'}</span>
                          </div>
                        </td>
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

/** Quanto do tráfego foi voz e quanto foi tela, em cores: azul para a voz, vermelho para a tela. */
function SplitPanel({
  voiceSeconds,
  screenSeconds,
  totalBytes,
}: {
  voiceSeconds: number;
  screenSeconds: number;
  totalBytes: number;
}) {
  const { voiceBytes, screenBytes, screenShare } = splitTraffic(voiceSeconds, screenSeconds, totalBytes);
  if (totalBytes === 0 || voiceSeconds + screenSeconds === 0) return null;

  return (
    <div className="usage-split">
      <div className="usage-split-bar" role="img" aria-label={`${formatPercent(1 - screenShare)} de voz e ${formatPercent(screenShare)} de tela`}>
        <span className="voice" style={{ width: `${(1 - screenShare) * 100}%` }} />
        <span className="screen" style={{ width: `${screenShare * 100}%` }} />
      </div>
      <div className="usage-split-legend">
        <span>
          <span className="legend-dot voice" aria-hidden="true" /> Voz: {formatBytes(voiceBytes)} · {formatDuration(voiceSeconds)}
        </span>
        <span>
          <span className="legend-dot screen" aria-hidden="true" /> Tela: {formatBytes(screenBytes)} ·{' '}
          {formatDuration(screenSeconds)}
        </span>
      </div>
      <p className="usage-muted small">
        A divisão é uma estimativa: o servidor mede o total que saiu, e aqui ele é repartido pelo tempo de cada
        atividade e pelo peso de cada uma (uma hora de tela pesa cerca de cem horas de voz).
      </p>
    </div>
  );
}

function StatTile({ label, value, note, kind }: { label: string; value: string; note?: string; kind?: 'voice' | 'screen' }) {
  return (
    <div className={`stat-tile${kind ? ` ${kind}` : ''}`}>
      <span className="stat-label">
        {kind && <span className={`legend-dot ${kind}`} aria-hidden="true" />}
        {label}
      </span>
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
