import { useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, menosMovimento, microjogoDaTela, useFormatos, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/forca.ts).
const FORCA_MS = 8000;

const valorDaForca = (periodoMs: number, t: number) => {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 100 * (1 - Math.abs(fase * 2 - 1));
};

/** A torre: onde ela começa e quanto mede (no desenho). */
const TORRE_TOPO = 26;
const TORRE_BASE = 122;

/**
 * A CENA DA FORÇA (19/11/2026, pedido dele: "dar cena"): a torre de feira com o sino no alto. Enquanto a barra corre, o peso
 * sobe e desce na torre e o coelho segura o martelo no alto; no aperto, o martelo desce e o peso fica onde a barra parou.
 * De 95% para cima, o sino toca e o coelho comemora; abaixo de 60%, ele murcha as orelhas. Só desenho: o tempo do aperto é o
 * mesmo de antes.
 */
function Forca({ dados, inicio, ativo, enviar }: PropsDoMicro<{ periodoMs?: number }>) {
  const t = useT();
  const f = useFormatos();
  const [parado, setParado] = useState<number | null>(null);
  const agora = useRelogio(ativo && parado === null);
  const periodo = dados.periodoMs ?? 1400;
  const tempo = Math.min(FORCA_MS, Math.max(0, agora - inicio));
  const valor = parado ?? (agora < inicio ? 0 : valorDaForca(periodo, tempo));
  // os 8 s da barra acabaram: ela para, e o aperto já não conta (o servidor espera um pouco mais só pela rede)
  const acabou = agora - inicio >= FORCA_MS;
  const parar = () => {
    if (!ativo || parado !== null || Date.now() < inicio || Date.now() - inicio > FORCA_MS) return;
    const ms = Date.now() - inicio;
    const v = valorDaForca(periodo, ms);
    setParado(v);
    enviar({ t: Math.round(ms) });
    tocar('soco');
    if (v >= 95) setTimeout(() => tocar('acerto'), 120);
    else if (v < 60) setTimeout(() => tocar('erro'), 120);
  };
  useTeclas(ativo && parado === null && !acabou, (e) => {
    if (!ehAperto(e)) return false;
    parar();
    return true;
  });
  const sino = parado !== null && parado >= 95;
  const fraco = parado !== null && parado < 60;
  const calmo = menosMovimento();
  const pesoY = TORRE_BASE - 12 - ((TORRE_BASE - TORRE_TOPO - 22) * valor) / 100;
  return (
    <div className="festa-forca">
      <svg viewBox="0 0 200 140" width="100%" style={{ maxWidth: 320 }} aria-hidden="true">
        <rect x="0" y="122" width="200" height="18" fill="#8fb86a" />
        {/* a torre, com as faixas de cor e a marca dos 95% */}
        <rect x="124" y={TORRE_TOPO} width="22" height={TORRE_BASE - TORRE_TOPO} fill="#8e6a52" />
        <rect x="130" y={TORRE_TOPO + 10} width="10" height={TORRE_BASE - TORRE_TOPO - 14} fill="#f3ead8" />
        {[0, 1, 2, 3, 4].map((k) => (
          <rect key={k} x="130" y={TORRE_TOPO + 10 + k * 18} width="10" height="9" fill={['#c94a3a', '#e07a2e', '#f2c46a', '#7fae5a', '#5f8fa8'][k]} opacity="0.55" />
        ))}
        <rect x="122" y={TORRE_BASE - 12 - (TORRE_BASE - TORRE_TOPO - 22) * 0.95} width="26" height="2" fill="#4f8f3f" />
        {/* o sino */}
        <g transform={sino && !calmo ? 'rotate(-14 135 18)' : undefined}>
          <path d="M123 26 Q123 8 135 8 Q147 8 147 26 Z" fill="#f2c46a" />
          <circle cx="135" cy="27" r="3" fill="#b8741e" />
        </g>
        {sino && (
          <g stroke="#f2c46a" strokeWidth="3" strokeLinecap="round">
            <line x1="110" y1="10" x2="102" y2="4" />
            <line x1="160" y1="10" x2="168" y2="4" />
            <line x1="108" y1="22" x2="98" y2="22" />
            <line x1="162" y1="22" x2="172" y2="22" />
          </g>
        )}
        {/* o peso que sobe */}
        <rect x="127" y={pesoY} width="16" height="10" rx="2" fill="#5a3a2a" />
        {/* a base de bater */}
        <rect x="114" y="116" width="42" height="8" fill="#a89276" />
        {/* o coelho com o martelo: no alto antes, embaixo depois do aperto */}
        <g transform={sino && !calmo ? 'translate(0 -5)' : undefined}>
          <g transform={`rotate(${fraco ? 45 : 0} 46 52)`}>
            <ellipse cx="40" cy="40" rx="5" ry="16" fill="#e8dccb" />
          </g>
          <g transform={`rotate(${fraco ? -45 : 0} 58 52)`}>
            <ellipse cx="56" cy="40" rx="5" ry="16" fill="#e8dccb" />
          </g>
          <circle cx="48" cy="70" r="20" fill="#e8dccb" />
          <ellipse cx="48" cy="108" rx="18" ry="16" fill="#7d93c4" />
          <circle cx="41" cy="68" r="2.5" fill="#3a2e2a" />
          <circle cx="55" cy="68" r="2.5" fill="#3a2e2a" />
          <circle cx="48" cy="75" r="2" fill="#d98a8a" />
        </g>
        <g transform={`rotate(${parado === null ? -70 : 25} 64 100)`}>
          <rect x="62" y="56" width="5" height="46" rx="2" fill="#8e6a52" />
          <rect x="52" y="48" width="26" height="14" rx="3" fill="#c94a3a" />
        </g>
      </svg>
      <div className="festa-forca-lado">
        <span className="festa-mostrador">{f.pct.format((parado ?? valor) / 100)}</span>
        <button type="button" className="btn-primary" disabled={!ativo || parado !== null || acabou} onPointerDown={(e) => (e.preventDefault(), parar())}>
          {t('Parar')}
        </button>
      </div>
    </div>
  );
}

export default microjogoDaTela({
  id: 'forca',
  nome: chave('Medidor de força'),
  dica: chave('Pare a barra o mais perto possível de 100%.'),
  Tela: Forca,
  valor: (v, f) => f.pct.format(v / 100),
});
