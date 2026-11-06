import { useEffect, useRef, useState } from 'react';
import { chave, idiomaAtual, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * O ARREMESSO DO NABO (05/11/2026, server/src/festa/nabo.ts): o coelho gira com o nabo, cada vez mais rápido, e solta no
 * aperto; só vale com o nabo apontando para o campo. Três vezes, fixas no relógio; vale a mais longe. A soltura vai na hora (a
 * ação 'acerto'), e o servidor faz a mesma conta, abaixo, igual à dele.
 */

// Os mesmos números e as mesmas contas do servidor.
const NABO_VEZES = 3;
const NABO_VEZ_MS = 6500;
const NABO_GIRO_MS = 5000;
const NABO_CAMPO = 0;
const NABO_SETOR = 0.125;
type Giro = { v0: number; a: number };
const voltasDoNabo = (g: Giro, ms: number) => {
  const s = ms / 1000;
  return g.v0 * s + (g.a * s * s) / 2;
};
const velocidadeDoNabo = (g: Giro, ms: number) => g.v0 + (g.a * ms) / 1000;
function arremesso(g: Giro, ms: number): number | null {
  if (ms < 0 || ms > NABO_GIRO_MS) return null;
  const v = voltasDoNabo(g, ms);
  const fracao = v - Math.floor(v);
  let desvio = Math.abs(fracao - NABO_CAMPO);
  if (desvio > 0.5) desvio = 1 - desvio;
  if (desvio > NABO_SETOR) return null;
  const q = desvio / NABO_SETOR;
  return Math.round(12 * velocidadeDoNabo(g, ms) * (1 - (q * q) / 3) * 10) / 10;
}

/** O desenho: o coelho no círculo à esquerda, e o campo para a direita, com uma escala em metros. */
const CX = 52;
const CY = 92;
const RAIO = 26;
const X_ZERO = CX + RAIO;
const PX_POR_METRO = 6.4;
const VOO_MS = 900;

function Nabo({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ giros?: Giro[] }>) {
  const t = useT();
  const giros = dados.giros ?? [];
  /** Cada vez já jogada: os metros (null é falta) e quando foi solto (ms desde o começo do jogo). */
  const vezes = useRef(new Map<number, { metros: number | null; em: number }>());
  const [, setDesenho] = useState(0);
  const agora = useRelogio(ativo);
  const e = Math.max(0, agora - inicio);
  const vez = Math.min(NABO_VEZES - 1, Math.floor(e / NABO_VEZ_MS));
  const ms = e - vez * NABO_VEZ_MS;
  const g = giros[vez] ?? { v0: 0.6, a: 0.3 };
  const dessa = vezes.current.get(vez);
  const tonto = !dessa && ms > NABO_GIRO_MS;
  const acabou = e >= NABO_VEZES * NABO_VEZ_MS || (vezes.current.size === NABO_VEZES && e - (vezes.current.get(NABO_VEZES - 1)?.em ?? 0) > VOO_MS + 600);

  useEffect(() => {
    if (ativo && acabou) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou]);
  // a vez que passou sem soltar: o nabo cai (o som, uma vez)
  const avisouTonto = useRef(-1);
  useEffect(() => {
    if (tonto && avisouTonto.current !== vez) {
      avisouTonto.current = vez;
      tocar('queda');
    }
  }, [tonto, vez]);

  const soltar = () => {
    if (!ativo) return;
    const agoraMs = Math.round(Date.now() - inicio);
    const v = Math.floor(agoraMs / NABO_VEZ_MS);
    const m = agoraMs - v * NABO_VEZ_MS;
    if (agoraMs < 0 || v >= NABO_VEZES || m > NABO_GIRO_MS || vezes.current.has(v)) return;
    const metros = arremesso(giros[v], m);
    vezes.current.set(v, { metros, em: agoraMs });
    tocar(metros === null ? 'erro' : 'tiro');
    lance({ t: agoraMs });
    setDesenho((n) => n + 1);
  };
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev)) return false;
    soltar();
    return true;
  });

  const melhor = Math.max(0, ...[...vezes.current.values()].map((v) => v.metros ?? 0));
  // o ângulo do nabo (a fração da volta: 0 aponta para o campo)
  const voltas = dessa ? voltasDoNabo(g, dessa.em - vez * NABO_VEZ_MS) : tonto ? voltasDoNabo(g, NABO_GIRO_MS) : voltasDoNabo(g, ms);
  const ang = 2 * Math.PI * (voltas - Math.floor(voltas));
  const velocidade = velocidadeDoNabo(g, Math.min(ms, NABO_GIRO_MS));
  // o voo: do coelho até o ponto, numa curva
  let nabo: { x: number; y: number; giro: number } | null = null;
  if (!dessa && !tonto) nabo = { x: CX + RAIO * Math.cos(ang), y: CY + RAIO * Math.sin(ang), giro: (ang * 180) / Math.PI };
  else if (dessa) {
    const p = Math.min(1, (e - dessa.em) / VOO_MS);
    const ax = CX + RAIO * Math.cos(ang);
    const ay = CY + RAIO * Math.sin(ang);
    if (dessa.metros === null) {
      // a falta: o nabo sai para o lado errado e some na cerca
      const fx = CX + 70 * Math.cos(ang);
      const fy = CY + 70 * Math.sin(ang);
      nabo = { x: ax + (fx - ax) * p, y: ay + (fy - ay) * p, giro: p * 720 };
    } else {
      const bx = X_ZERO + dessa.metros * PX_POR_METRO;
      nabo = { x: ax + (bx - ax) * p, y: ay + (CY - ay) * p - 50 * 4 * p * (1 - p), giro: p * 900 };
    }
  } else nabo = { x: CX + 14, y: CY + 14, giro: 90 };

  return (
    <Moldura placar={`${melhor.toLocaleString(idiomaAtual(), { maximumFractionDigits: 1 })} m · ${Math.min(NABO_VEZES, vez + 1)}/${NABO_VEZES}`} fracao={e / (NABO_VEZES * NABO_VEZ_MS)}>
      <svg
        viewBox="0 0 300 170"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          soltar();
        }}
      >
        <rect x="0" y="0" width="300" height="170" rx="12" fill="#86b35a" />
        {/* o campo, com as faixas de 5 em 5 metros */}
        <rect x={X_ZERO} y={CY - 34} width={300 - X_ZERO} height="68" fill="#9cc46e" />
        {[5, 10, 15, 20, 25, 30, 35].map((m) => (
          <g key={m}>
            <line x1={X_ZERO + m * PX_POR_METRO} y1={CY - 34} x2={X_ZERO + m * PX_POR_METRO} y2={CY + 34} stroke="#f3ead8" strokeWidth={m % 10 ? 0.6 : 1.4} opacity="0.8" />
            {m % 10 === 0 && (
              <text x={X_ZERO + m * PX_POR_METRO} y={CY + 46} fontSize="9" textAnchor="middle" fill="#2f4a22">
                {m}
              </text>
            )}
          </g>
        ))}
        {/* o setor do campo: a hora de soltar */}
        <path
          d={`M${CX} ${CY} L${CX + 70 * Math.cos(-Math.PI / 4)} ${CY + 70 * Math.sin(-Math.PI / 4)} A70 70 0 0 1 ${CX + 70 * Math.cos(Math.PI / 4)} ${CY + 70 * Math.sin(Math.PI / 4)} Z`}
          fill="rgba(242,196,106,0.28)"
        />
        <circle cx={CX} cy={CY} r={RAIO + 8} fill="#c99a6b" stroke="#a97c50" strokeWidth="2" />
        {/* as marcas das vezes já jogadas */}
        {[...vezes.current.entries()].map(([k, v]) =>
          v.metros === null || (k === vez && e - v.em < VOO_MS) ? null : (
            <g key={k} transform={`translate(${X_ZERO + v.metros * PX_POR_METRO} ${CY - 30 + k * 6})`}>
              <line x1="0" y1="0" x2="0" y2="18" stroke="#5a3a2a" strokeWidth="1.2" />
              <path d="M0 0 l9 3 l-9 3 Z" fill={v.metros === melhor ? '#e07a2e' : '#f3ead8'} />
            </g>
          ),
        )}
        {/* o coelho, girando junto com o nabo (de frente, com o corpo virado para ele) */}
        <g transform={`translate(${CX} ${CY + 10})`}>
          <ellipse cx="0" cy="10" rx="14" ry="4" fill="rgba(0,0,0,0.2)" />
          <ellipse cx="0" cy="-2" rx="10" ry="9" fill="#e8dccb" />
          <CoelhoDeFrente y={-8} escala={1.05} olhos={tonto ? 'tontos' : 'abertos'} />
        </g>
        {/* a rama na mão, e o nabo */}
        {!dessa && !tonto && nabo && <line x1={CX} y1={CY} x2={nabo.x} y2={nabo.y} stroke="#6fa356" strokeWidth="3" strokeLinecap="round" />}
        {nabo && (
          <g transform={`translate(${nabo.x} ${nabo.y}) rotate(${nabo.giro})`}>
            <circle cx="0" cy="0" r="9" fill="#f3e6f0" stroke="#b47aa0" strokeWidth="1.2" />
            <path d="M-9 -1 A9 9 0 0 1 9 -1 Z" fill="#b25d9a" opacity="0.85" />
            <path d="M0 9 L0 14" stroke="#c9b0a0" strokeWidth="1.5" />
          </g>
        )}
        {/* a velocidade do giro: os risquinhos em volta crescem com ela */}
        {!dessa && !tonto && (
          <circle cx={CX} cy={CY} r={RAIO + 3} fill="none" stroke="#fff4e6" strokeWidth="1.5" strokeDasharray={`${4 + velocidade * 6} 10`} opacity={Math.min(0.9, velocidade / 3)} />
        )}
        {dessa && dessa.metros !== null && e - dessa.em >= VOO_MS && e - dessa.em < VOO_MS + 1400 && (
          <text x={X_ZERO + dessa.metros * PX_POR_METRO} y={CY - 40} textAnchor="middle" fontSize="13" fontWeight="700" fill="#2f4a22">
            {dessa.metros.toLocaleString(idiomaAtual(), { maximumFractionDigits: 1 })} m
          </text>
        )}
        {dessa && dessa.metros === null && (
          <text x={CX} y={CY - 44} textAnchor="middle" fontSize="16" fontWeight="700" fill="#a8322e">
            ✕
          </text>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Arremesso do nabo');

export default microjogoDaTela({
  id: 'nabo',
  nome: NOME,
  dica: chave('Solte quando o nabo apontar para o campo. Girando mais rápido, vai mais longe.'),
  Tela: Nabo,
  valor: (v) => `${(Math.round(v * 10) / 10).toLocaleString(idiomaAtual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
  errouComValor: true,
});
