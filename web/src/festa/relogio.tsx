import { useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, menosMovimento, microjogoDaTela, useFormatos, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/relogio.ts).
const RELOGIO_MS = 15000;
const RELOGIO_SOME_MS = 3000;
const ALVO = 10000;

/** Na mosca, perto, ou longe (a reação do coelho). */
const reacaoDe = (ms: number) => (Math.abs(ms - ALVO) <= 150 ? 'mosca' : Math.abs(ms - ALVO) <= 600 ? 'perto' : 'longe');

/**
 * A CENA DO RELÓGIO (19/11/2026, pedido dele: "dar cena"): o coelho segura o cronômetro; o ponteiro dá uma volta a cada 10 s
 * e, depois de 3 s, um pano cobre o mostrador (a graça é contar de cabeça). Parou: o pano sai, o ponteiro mostra onde parou
 * contra a marca verde dos 10 s, e o coelho comemora (na mosca), dá de ombros (perto) ou murcha as orelhas (longe).
 * Só desenho: o que vai ao servidor é o mesmo tempo de antes.
 */
function Relogio({ inicio, ativo, enviar }: PropsDoMicro) {
  const t = useT();
  const f = useFormatos();
  const [parado, setParado] = useState<number | null>(null);
  const agora = useRelogio(ativo && parado === null);
  const tempo = parado ?? Math.min(RELOGIO_MS, Math.max(0, agora - inicio));
  const escondido = parado === null && tempo >= RELOGIO_SOME_MS;
  const parar = () => {
    if (!ativo || parado !== null || Date.now() < inicio) return;
    const ms = Math.min(RELOGIO_MS, Date.now() - inicio);
    setParado(ms);
    enviar({ t: Math.round(ms) });
    const r = reacaoDe(ms);
    tocar(r === 'mosca' ? 'acerto' : r === 'perto' ? 'clique' : 'erro');
  };
  useTeclas(ativo && parado === null, (e) => {
    if (!ehAperto(e)) return false;
    parar();
    return true;
  });
  const reacao = parado === null ? null : reacaoDe(parado);
  // o ponteiro: uma volta a cada 10 s, a partir do alto (os 10 s caem no alto também)
  const giro = ((tempo % ALVO) / ALVO) * 360;
  const calmo = menosMovimento();
  const orelha = reacao === 'longe' ? 'rotate(50 ' : 'rotate(0 ';
  return (
    <div className="festa-relogio">
      <svg viewBox="0 0 220 140" width="100%" style={{ maxWidth: 360 }} aria-hidden="true">
        {/* o chão */}
        <rect x="0" y="122" width="220" height="18" fill="#8fb86a" />
        {/* o coelho, à esquerda, com o braço no cronômetro */}
        <g transform={reacao === 'mosca' && !calmo ? 'translate(0 -6)' : undefined}>
          <g transform={`${orelha}52 52)`}>
            <ellipse cx="46" cy="40" rx="5" ry="16" fill="#e8dccb" />
          </g>
          <g transform={`${reacao === 'longe' ? 'rotate(-50 ' : 'rotate(0 '}64 52)`}>
            <ellipse cx="62" cy="40" rx="5" ry="16" fill="#e8dccb" />
          </g>
          <circle cx="54" cy="70" r="20" fill="#e8dccb" />
          <ellipse cx="54" cy="108" rx="18" ry="16" fill="#d9774f" />
          {reacao === 'mosca' ? (
            <>
              <rect x="44" y="66" width="6" height="2" fill="#3a2e2a" />
              <rect x="58" y="66" width="6" height="2" fill="#3a2e2a" />
              <ellipse cx="54" cy="77" rx="4" ry="3" fill="#a8504a" />
            </>
          ) : (
            <>
              <circle cx="47" cy="68" r="2.5" fill="#3a2e2a" />
              <circle cx="61" cy="68" r="2.5" fill="#3a2e2a" />
              <circle cx="54" cy="75" r="2" fill="#d98a8a" />
            </>
          )}
          {/* o braço até o cronômetro */}
          <rect x="66" y="96" width="40" height="7" rx="3" fill="#d9774f" />
        </g>
        {/* o cronômetro */}
        <rect x="134" y="22" width="12" height="10" rx="2" fill="#8e8e96" />
        <circle cx="140" cy="76" r="46" fill="#5a3a2a" />
        <circle cx="140" cy="76" r="40" fill="#f3ead8" />
        {Array.from({ length: 10 }, (_, k) => {
          const a = (k / 10) * Math.PI * 2;
          return <rect key={k} x={140 + Math.sin(a) * 34 - 1.5} y={76 - Math.cos(a) * 34 - 1.5} width="3" height="3" fill="#a89276" />;
        })}
        {/* a marca dos 10 s, no alto */}
        <rect x="136" y="38" width="8" height="6" fill="#7fae5a" />
        {!escondido && (
          <g transform={`rotate(${giro} 140 76)`}>
            <rect x="138.5" y="42" width="3" height="36" rx="1.5" fill={reacao === 'mosca' ? '#4f8f3f' : '#c94a3a'} />
          </g>
        )}
        <circle cx="140" cy="76" r="4" fill="#5a3a2a" />
        {/* o pano que cobre o mostrador depois de 3 s */}
        {escondido && (
          <g>
            <path d="M96 60 Q140 20 184 60 L184 98 Q140 128 96 98 Z" fill="#8e7cc3" />
            <text x="140" y="90" fontSize="36" fontWeight="900" textAnchor="middle" fill="#ffe9a0" fontFamily="system-ui, sans-serif">
              ?
            </text>
          </g>
        )}
        {/* as estrelinhas na mosca */}
        {reacao === 'mosca' &&
          [
            [100, 20],
            [196, 28],
            [20, 30],
            [200, 110],
          ].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} fill="#f2c46a" />)}
      </svg>
      <span className={`festa-mostrador grande${escondido ? ' escondido' : ''}`}>{escondido ? '?' : f.numero.format(tempo / 1000)}</span>
      <span className="festa-meta" aria-hidden="true">
        {f.numero.format(10)}
      </span>
      <button type="button" className="btn-primary" disabled={!ativo || parado !== null} onPointerDown={(e) => (e.preventDefault(), parar())}>
        {t('Parar')}
      </button>
    </div>
  );
}

export default microjogoDaTela({
  id: 'relogio',
  nome: chave('Parar o relógio'),
  dica: chave('Pare o relógio em 10 segundos exatos. Os números somem depois de 3.'),
  Tela: Relogio,
  valor: (v, f) => f.s.format(v / 1000),
});
