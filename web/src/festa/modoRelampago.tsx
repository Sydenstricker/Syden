import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Placar } from '../Minijogo';
import { tocar } from '../somDosJogos';
import './relampago.css';
import { useRelogio, useTeclas } from './comum';
import { CoelhoComemorando } from './moldura';

/**
 * O MODO RELÂMPAGO DA FESTA (19/11/2026, server/src/minijogo-festa-relampago.ts): microjogos de 4 a 5 s, cada vez mais
 * rápidos, com 3 vidas. Cada um joga na própria tela; o servidor sorteia, marca o relógio e confere cada resposta. Tudo
 * desenhado por código e sem texto dentro do jogo: a cenoura para tocar, a seta para repetir, a luz para esperar, a barra para
 * parar na faixa verde, as cenouras para contar. E os oito de 21/11/2026: o monte maior, a cor igual, o nabo entre as cenouras,
 * as batidas no tambor, a pedra que cai, a soma dos dados, a sombra do legume e a toca onde a cenoura estava.
 */

type DadosRelampago =
  | { tipo: 'toque'; casa: number; aparece: number }
  | { tipo: 'lado'; direcao: number; aparece: number }
  | { tipo: 'espere'; aparece: number }
  | { tipo: 'pare'; periodo: number; de: number; ate: number }
  | { tipo: 'conte'; quantas: number; opcoes: number[]; mostra: number; posicoes: number[] }
  | { tipo: 'maior'; esquerda: number; direita: number; aparece: number }
  | { tipo: 'cor'; cor: number; ordem: number[]; aparece: number }
  | { tipo: 'intruso'; casa: number; aparece: number }
  | { tipo: 'toques'; quantas: number; aparece: number }
  | { tipo: 'esquiva'; pista: number; aparece: number }
  | { tipo: 'soma'; a: number; b: number; opcoes: number[]; aparece: number }
  | { tipo: 'sombra'; forma: number; opcoes: number[]; aparece: number }
  | { tipo: 'memoria'; casa: number; mostra: number };

export interface EstadoRelampago {
  modo: 'relampago';
  fase: 'preparando' | 'jogando' | 'intervalo' | 'fim';
  indice: number;
  dados: DadosRelampago | null;
  duracaoMs: number;
  jogandoHaMs: number | null;
  vidas: number;
  jogadores: { userId: number; username: string; avatar: number | string | null; vidas: number; acertos: number; caiu: boolean; agora: boolean | null }[];
  meu: boolean | null;
  classificacao: { userId: number; username: string; pontos: number; posicao: number | null; saiu: boolean }[] | null;
  recebidaEm: number;
  restanteMs: number;
  terminada?: boolean;
  /** O recorde do Solo (20/11/2026): o de antes, e no fim os acertos e se virou recorde. Na sala, ausentes. */
  recordeAntes?: number | null;
  recorde?: { acertos: number; antes: number | null; novo: boolean } | null;
}

/** A cada quantos acertos meus a tela avisa que está acelerando (só desenho e som). */
const AVISO_A_CADA = 5;
const AVISO_MS = 1400;

/** O AVISO DE ACELERAÇÃO (20/11/2026): o raio, as setas para a frente e a cor quente, por cima, sem texto. */
function AvisoDeAceleracao() {
  return (
    <div aria-hidden="true" className="festa-acelera">
      <svg width="64" height="64" viewBox="0 0 16 16" shapeRendering="crispEdges">
        <polygon points="9,0 3,9 7,9 5,16 13,6 9,6 11,0" fill="#f2c46a" stroke="#b5651d" strokeWidth="0.6" />
      </svg>
      <svg width="58" height="40" viewBox="0 0 29 20">
        <path d="M2 2 L12 10 L2 18 M15 2 L25 10 L15 18" fill="none" stroke="#e8742a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** O mesmo do servidor (barraDoPare). */
const barraDoPare = (periodo: number, t: number) => {
  const fase = (((t % periodo) + periodo) % periodo) / periodo;
  return 100 * (1 - Math.abs(fase * 2 - 1));
};

/** As setas (0 cima, 1 direita, 2 baixo, 3 esquerda), as teclas delas. */
const TECLAS_DAS_SETAS: Record<string, number> = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };

function Coracoes({ n, total }: { n: number; total: number }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} width="14" height="13" viewBox="0 0 7 6" shapeRendering="crispEdges">
          <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" fill={i < n ? '#e0604f' : '#8a8a8a'} opacity={i < n ? 1 : 0.4} />
        </svg>
      ))}
    </span>
  );
}

function Cenoura({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <polygon points="-6,-6 6,-6 0,12" fill="#e07a2e" />
      <rect x="-4" y="-12" width="3" height="7" fill="#7fae5a" />
      <rect x="1" y="-12" width="3" height="7" fill="#6a9a4a" />
    </g>
  );
}

/** As cores do 'cor' (fáceis de separar, também para quem não enxerga bem o vermelho e o verde: formas diferentes por dentro). */
const CORES_DO_RELAMPAGO = ['#d9534f', '#f0ad4e', '#5b8fc9', '#6fa356'];
/** O desenho de dentro de cada cor (para não depender só da cor). */
function MarcaDaCor({ cor, x, y }: { cor: number; x: number; y: number }) {
  const s = '#fff';
  if (cor === 0) return <circle cx={x} cy={y} r="5" fill={s} />;
  if (cor === 1) return <rect x={x - 5} y={y - 5} width="10" height="10" fill={s} />;
  if (cor === 2) return <polygon points={`${x},${y - 6} ${x + 6},${y + 5} ${x - 6},${y + 5}`} fill={s} />;
  return <polygon points={`${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`} fill={s} />;
}

/** Um nabo (o intruso entre as cenouras). */
function Nabo({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="2" r="7" fill="#efe6f2" />
      <path d="M-7 0 A7 7 0 0 1 7 0 Z" fill="#9a5fb0" />
      <polygon points="-2,8 2,8 0,13" fill="#efe6f2" />
      <rect x="-4" y="-12" width="3" height="7" fill="#7fae5a" />
      <rect x="1" y="-12" width="3" height="7" fill="#6a9a4a" />
    </g>
  );
}

/** Os legumes da 'sombra' (o mesmo número do servidor, FORMAS_DA_SOMBRA); `sombra`: tudo escuro, só a silhueta. */
function Legume({ forma, x, y, s = 1, sombra = false }: { forma: number; x: number; y: number; s?: number; sombra?: boolean }) {
  const c = (cor: string) => (sombra ? '#3a3330' : cor);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {forma === 0 && (
        <>
          <polygon points="-6,-6 6,-6 0,14" fill={c('#e07a2e')} />
          <rect x="-4" y="-13" width="3" height="8" fill={c('#7fae5a')} />
          <rect x="1" y="-13" width="3" height="8" fill={c('#6a9a4a')} />
        </>
      )}
      {forma === 1 && (
        <>
          <ellipse cx="0" cy="3" rx="13" ry="10" fill={c('#e8913a')} />
          <rect x="-1.5" y="-10" width="3" height="6" fill={c('#6a8a3a')} />
        </>
      )}
      {forma === 2 && (
        <>
          <circle cx="0" cy="2" r="11" fill={c('#7fae5a')} />
          <circle cx="-5" cy="-2" r="6" fill={c('#9ccc72')} />
        </>
      )}
      {forma === 3 && (
        <>
          <rect x="-3" y="0" width="6" height="11" fill={c('#efe3cf')} />
          <path d="M-11 2 A11 10 0 0 1 11 2 Z" fill={c('#c94a3a')} />
        </>
      )}
      {forma === 4 && (
        <>
          <ellipse cx="0" cy="4" rx="5" ry="10" fill={c('#7a3e8e')} />
          <rect x="-2" y="-11" width="4" height="6" fill={c('#6a9a4a')} />
        </>
      )}
    </g>
  );
}

/** Um dado com os pontos. */
function Dado({ n, x, y }: { n: number; x: number; y: number }) {
  const P: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-22" y="-22" width="44" height="44" rx="7" fill="#f3ead8" stroke="#8e6a52" strokeWidth="2" />
      {(P[n] ?? []).map(([a, b], i) => (
        <circle key={i} cx={a * 11} cy={b * 11} r="4.2" fill="#5a3a2a" />
      ))}
    </g>
  );
}

/** As batidas do tambor: conta aqui e manda quando chega ao número. */
function Tambor({ d, t, ativo, barra, responder }: { d: Extract<DadosRelampago, { tipo: 'toques' }>; t: number; ativo: boolean; barra: React.ReactNode; responder: (r?: number) => void }) {
  const [batidas, setBatidas] = useState(0);
  const bater = () => {
    if (!ativo || t < d.aparece) return;
    tocar('clique');
    const n = batidas + 1;
    setBatidas(n);
    if (n >= d.quantas) responder(n);
  };
  useTeclas(ativo, (e) => {
    if (e.key === ' ' || e.key === 'Enter') return (bater(), true);
    return false;
  });
  return (
    <button type="button" className="festa-saque" disabled={!ativo} onPointerDown={(e) => (e.preventDefault(), bater())} style={{ width: '100%', maxWidth: 420 }}>
      <svg viewBox="0 0 240 130" aria-hidden="true">
        {barra}
        {t >= d.aparece &&
          Array.from({ length: d.quantas }, (_, k) => (
            <circle key={k} cx={120 + (k - (d.quantas - 1) / 2) * 22} cy="22" r="7" fill={k < batidas ? '#e07a2e' : '#f3ead8'} stroke="#8e6a52" strokeWidth="2" />
          ))}
        <ellipse cx="120" cy="70" rx="56" ry="14" fill="#c94a3a" />
        <rect x="64" y="70" width="112" height="40" fill="#b5651d" />
        <ellipse cx="120" cy="110" rx="56" ry="14" fill="#8e4a1d" />
        <ellipse cx="120" cy="70" rx="50" ry="11" fill="#f3ead8" />
      </svg>
    </button>
  );
}

/** Um microjogo relâmpago, valendo. `t` é o tempo dele (ms desde o começo, neste relógio). */
function Microjogo({ d, t, fim, ativo, responder }: { d: DadosRelampago; t: number; fim: number; ativo: boolean; responder: (r?: number) => void }) {
  useTeclas(ativo, (e) => {
    const k = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
    if (d.tipo === 'maior') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') return (responder(0), true);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') return (responder(1), true);
      return false;
    }
    if (d.tipo === 'esquiva') {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') return (responder(0), true);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') return (responder(2), true);
      if (k >= 0 && k <= 2) return (responder(k), true);
      return false;
    }
    if (d.tipo === 'cor' && k >= 0 && k <= 3) return (responder(k), true);
    if (d.tipo === 'intruso' && k >= 0 && k <= 5) return (responder(k), true);
    if (d.tipo === 'memoria' && k >= 0 && k <= 3 && t >= d.mostra) return (responder(k), true);
    if ((d.tipo === 'soma' || d.tipo === 'sombra') && k >= 0 && k <= 2) return (responder(d.opcoes[k]), true);
    if (d.tipo === 'lado' && e.key in TECLAS_DAS_SETAS) return (responder(TECLAS_DAS_SETAS[e.key]), true);
    if ((d.tipo === 'espere' || d.tipo === 'pare') && (e.key === ' ' || e.key === 'Enter')) return (responder(), true);
    if (d.tipo === 'toque' && /^[1-9]$/.test(e.key)) return (responder(Number(e.key) - 1), true);
    if (d.tipo === 'conte' && /^[1-3]$/.test(e.key) && t >= d.mostra) return (responder(d.opcoes[Number(e.key) - 1]), true);
    return false;
  });
  const barra = (
    <rect x="0" y="0" width={240 * Math.max(0, 1 - t / fim)} height="5" fill="#f2c46a" />
  );
  const tocavel = (k: number) => ({ onPointerDown: (e: React.PointerEvent) => (e.preventDefault(), responder(k)), style: { cursor: 'pointer' } as const });
  if (d.tipo === 'maior') {
    const monte = (n: number, x0: number) =>
      Array.from({ length: n }, (_, i) => <Cenoura key={i} x={x0 + (i % 3) * 22} y={118 - Math.floor(i / 3) * 26} s={1.1} />);
    return (
      <svg viewBox="0 0 240 150" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {[0, 1].map((lado) => (
          <g key={lado} {...tocavel(lado)}>
            <rect x={lado === 0 ? 10 : 126} y="20" width="104" height="122" rx="8" fill="#9a7556" />
            {t >= d.aparece && monte(lado === 0 ? d.esquerda : d.direita, lado === 0 ? 40 : 156)}
          </g>
        ))}
      </svg>
    );
  }
  if (d.tipo === 'cor')
    return (
      <svg viewBox="0 0 240 150" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {t >= d.aparece && (
          <>
            <circle cx="120" cy="44" r="26" fill={CORES_DO_RELAMPAGO[d.cor]} />
            <MarcaDaCor cor={d.cor} x={120} y={44} />
          </>
        )}
        {d.ordem.map((c, k) => (
          <g key={k} {...tocavel(k)}>
            <circle cx={42 + k * 52} cy="118" r="22" fill={t >= d.aparece ? CORES_DO_RELAMPAGO[c] : '#8a8a8a'} />
            {t >= d.aparece && <MarcaDaCor cor={c} x={42 + k * 52} y={118} />}
          </g>
        ))}
      </svg>
    );
  if (d.tipo === 'intruso')
    return (
      <svg viewBox="0 0 240 150" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {Array.from({ length: 6 }, (_, k) => {
          const x = 50 + (k % 3) * 70;
          const y = 50 + Math.floor(k / 3) * 60;
          return (
            <g key={k} {...tocavel(k)}>
              <rect x={x - 28} y={y - 26} width="56" height="52" rx="6" fill="#9a7556" />
              {t >= d.aparece && (k === d.casa ? <Nabo x={x} y={y} s={1.6} /> : <Cenoura x={x} y={y - 2} s={1.5} />)}
            </g>
          );
        })}
      </svg>
    );
  if (d.tipo === 'toques') return <Tambor d={d} t={t} ativo={ativo} barra={barra} responder={responder} />;
  if (d.tipo === 'esquiva') {
    const queda = t >= d.aparece ? Math.min(1, (t - d.aparece) / 900) : 0;
    return (
      <svg viewBox="0 0 240 150" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {[0, 1, 2].map((p) => (
          <g key={p} {...tocavel(p)}>
            <rect x={6 + p * 78} y="10" width="72" height="136" rx="6" fill={p % 2 ? '#a98a6a' : '#9a7556'} />
          </g>
        ))}
        {t >= d.aparece && (
          <>
            <ellipse cx={42 + d.pista * 78} cy="128" rx={10 + 14 * queda} ry={3 + 3 * queda} fill="rgba(0,0,0,0.35)" pointerEvents="none" />
            <circle cx={42 + d.pista * 78} cy={20 + 90 * queda} r="16" fill="#7d7470" stroke="#5a524e" strokeWidth="2" pointerEvents="none" />
          </>
        )}
        <g pointerEvents="none">
          <Cenoura x={120} y={132} s={0.9} />
        </g>
      </svg>
    );
  }
  if (d.tipo === 'soma')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <svg viewBox="0 0 240 90" width="100%" style={{ maxWidth: 420 }} aria-hidden="true">
          {barra}
          {t >= d.aparece && (
            <>
              <Dado n={d.a} x={80} y={50} />
              <text x="120" y="58" textAnchor="middle" fontSize="24" fontWeight="900" fill="currentColor">
                +
              </text>
              <Dado n={d.b} x={160} y={50} />
            </>
          )}
        </svg>
        <div className="minijogo-acoes">
          {d.opcoes.map((n) => (
            <button key={n} type="button" className="btn-secondary" disabled={!ativo || t < d.aparece} onPointerDown={(e) => (e.preventDefault(), responder(n))}>
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  if (d.tipo === 'sombra')
    return (
      <svg viewBox="0 0 240 150" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {t >= d.aparece && <Legume forma={d.forma} x={120} y={44} s={2} />}
        {d.opcoes.map((f, k) => (
          <g key={k} {...tocavel(f)}>
            <rect x={18 + k * 72} y="84" width="60" height="60" rx="8" fill="#f3ead8" />
            {t >= d.aparece && <Legume forma={f} x={48 + k * 72} y={114} s={1.5} sombra />}
          </g>
        ))}
      </svg>
    );
  if (d.tipo === 'memoria') {
    const mostrando = t < d.mostra;
    return (
      <svg viewBox="0 0 240 120" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {[0, 1, 2, 3].map((k) => (
          <g key={k} {...(mostrando ? {} : tocavel(k))}>
            <ellipse cx={36 + k * 56} cy="82" rx="24" ry="12" fill="#5a3a2a" />
            {mostrando && k === d.casa && <Cenoura x={36 + k * 56} y={62} s={1.4} />}
          </g>
        ))}
      </svg>
    );
  }
  if (d.tipo === 'toque')
    return (
      <svg viewBox="0 0 240 160" width="100%" style={{ maxWidth: 420, touchAction: 'none' }}>
        {barra}
        {Array.from({ length: 9 }, (_, k) => {
          const x = 48 + (k % 3) * 52;
          const y = 14 + Math.floor(k / 3) * 48;
          return (
            <g key={k} onPointerDown={(e) => (e.preventDefault(), responder(k))} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="44" height="42" rx="6" fill="#8e6a52" />
              <rect x={x + 4} y={y + 4} width="36" height="34" rx="4" fill="#9a7556" />
              {t >= d.aparece && k === d.casa && <Cenoura x={x + 22} y={y + 18} s={1.4} />}
            </g>
          );
        })}
      </svg>
    );
  if (d.tipo === 'lado') {
    const giro = d.direcao * 90;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <svg viewBox="0 0 240 120" width="100%" style={{ maxWidth: 420 }} aria-hidden="true">
          {barra}
          {t >= d.aparece && (
            <g transform={`rotate(${giro} 120 64)`}>
              <rect x="110" y="50" width="20" height="50" fill="#7d93c4" />
              <polygon points="120,18 150,56 90,56" fill="#7d93c4" />
            </g>
          )}
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: 4 }}>
          {[
            [null, 0, null],
            [3, 2, 1],
          ].flat().map((dir, i) =>
            dir === null ? (
              <span key={i} />
            ) : (
              <button key={i} type="button" className="btn-secondary" disabled={!ativo} onPointerDown={(e) => (e.preventDefault(), responder(dir))} aria-label={['↑', '→', '↓', '←'][dir]}>
                {['↑', '→', '↓', '←'][dir]}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }
  if (d.tipo === 'espere') {
    const acesa = t >= d.aparece;
    return (
      <button type="button" className="festa-saque" disabled={!ativo} onPointerDown={(e) => (e.preventDefault(), responder())} style={{ width: '100%', maxWidth: 420 }}>
        <svg viewBox="0 0 240 120" aria-hidden="true">
          {barra}
          <rect x="112" y="78" width="16" height="30" fill="#5a3a2a" />
          <circle cx="120" cy="56" r="30" fill={acesa ? '#7fdc6a' : '#5a5a5a'} />
          {acesa && <circle cx="120" cy="56" r="42" fill="#7fdc6a" opacity="0.3" />}
        </svg>
      </button>
    );
  }
  if (d.tipo === 'pare') {
    const v = barraDoPare(d.periodo, t);
    return (
      <button type="button" className="festa-saque" disabled={!ativo} onPointerDown={(e) => (e.preventDefault(), responder())} style={{ width: '100%', maxWidth: 420 }}>
        <svg viewBox="0 0 240 70" aria-hidden="true">
          {barra}
          <rect x="20" y="24" width="200" height="24" rx="4" fill="#f3ead8" />
          <rect x={20 + 2 * d.de} y="24" width={2 * (d.ate - d.de)} height="24" fill="#7fae5a" />
          <rect x={20 + 2 * v - 3} y="16" width="6" height="40" rx="2" fill="#c94a3a" />
        </svg>
      </button>
    );
  }
  // conte: as cenouras piscam até `mostra`; depois, as três opções
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg viewBox="0 0 240 130" width="100%" style={{ maxWidth: 420 }} aria-hidden="true">
        {barra}
        <rect x="20" y="12" width="200" height="112" rx="8" fill="#9a7556" />
        {t < d.mostra && d.posicoes.map((p, i) => <Cenoura key={i} x={45 + (p % 4) * 50} y={34 + Math.floor(p / 4) * 34} s={1.2} />)}
      </svg>
      {t >= d.mostra && (
        <div className="minijogo-acoes">
          {d.opcoes.map((n) => (
            <button key={n} type="button" className="btn-secondary" disabled={!ativo} onPointerDown={(e) => (e.preventDefault(), responder(n))}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function JogoRelampago({
  estado,
  eu,
  jogador,
  agir,
}: {
  estado: EstadoRelampago;
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const inicio = useRef<{ indice: number; em: number } | null>(null);
  const [respondi, setRespondi] = useState(-1);
  if (estado.fase === 'jogando' && inicio.current?.indice !== estado.indice) {
    inicio.current = { indice: estado.indice, em: estado.recebidaEm - (estado.jogandoHaMs ?? 0) };
  }
  const minha = estado.jogadores.find((j) => j.userId === eu);
  const vivo = jogador && !!minha && !minha.caiu;
  const ativo = vivo && estado.fase === 'jogando' && estado.meu === null && respondi !== estado.indice;
  const agora = useRelogio(estado.fase === 'jogando');
  const tempo = inicio.current ? Math.max(0, agora - inicio.current.em) : 0;
  const responder = (r?: number) => {
    if (!ativo) return;
    setRespondi(estado.indice);
    void agir({ tipo: 'acerto', k: estado.indice, t: Math.round(Math.min(tempo, estado.duracaoMs)), r });
  };
  // O AVISO DE ACELERAÇÃO (20/11/2026): a cada 5 acertos meus, o raio e o som do turbo (só tela; o ritmo é do servidor)
  const [avisoAte, setAvisoAte] = useState(0);
  const avisado = useRef(0);
  const meusAcertos = minha?.acertos ?? 0;
  useEffect(() => {
    if (!vivo || meusAcertos <= 0 || meusAcertos % AVISO_A_CADA !== 0 || avisado.current >= meusAcertos) return;
    avisado.current = meusAcertos;
    tocar('turbo');
    const ate = Date.now() + AVISO_MS;
    setAvisoAte(ate);
    const h = setTimeout(() => setAvisoAte((a) => (a === ate ? 0 : a)), AVISO_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meusAcertos]);
  // o som do resultado de cada microjogo
  const ouvido = useRef(-1);
  useEffect(() => {
    if (estado.fase !== 'intervalo' || ouvido.current === estado.indice || !vivo) return;
    ouvido.current = estado.indice;
    tocar(estado.meu ? 'acerto' : 'erro');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase, estado.indice]);

  if (estado.terminada || estado.fase === 'fim') {
    const linhas = estado.classificacao ?? [];
    const comPosicao = linhas.filter((l) => l.posicao !== null);
    return (
      <div className="tabuleiro-jogo">
        {comPosicao.length > 0 ? (
          <Placar eu={eu} linhas={comPosicao.map((l) => ({ ...l, valor: `✓ ${l.pontos}`, posicao: l.posicao ?? undefined }))} />
        ) : (
          <div className="minijogo-fim">
            <CoelhoComemorando avatar={minha?.avatar ?? null} />
            <p className="minijogo-fim-titulo">✓ {minha?.acertos ?? 0}</p>
          </div>
        )}
        {/* o recorde do Solo (20/11/2026): os acertos, contados pelo servidor */}
        {estado.recorde?.novo ? (
          <p className="minijogo-situacao">{t('Novo recorde!')}</p>
        ) : (
          (estado.recorde?.antes ?? estado.recordeAntes ?? null) !== null && (
            <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: `✓ ${estado.recorde?.antes ?? estado.recordeAntes}` })}</p>
          )
        )}
      </div>
    );
  }

  return (
    <div className="festa festa-relampago" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
      {avisoAte > 0 && <AvisoDeAceleracao />}
      <ul className="festa-prontos">
        {estado.jogadores.map((j) => (
          <li key={j.userId} className={j.userId === eu ? 'pronto' : ''} style={{ opacity: j.caiu ? 0.45 : 1 }}>
            <span className="minijogo-nome">{j.username}</span> <Coracoes n={j.vidas} total={estado.vidas} /> <span aria-hidden="true">✓ {j.acertos}</span>
          </li>
        ))}
      </ul>
      {estado.fase === 'preparando' && (
        <div className="festa-preparo">
          <strong className="festa-nome">{t('Relâmpago')}</strong>
          <p>{t('Microjogos rápidos, cada vez mais rápidos. Errou, perde uma vida.')}</p>
          <Coracoes n={estado.vidas} total={estado.vidas} />
        </div>
      )}
      {estado.fase === 'jogando' && estado.dados && vivo && estado.meu === null && respondi !== estado.indice && (
        <Microjogo key={estado.indice} d={estado.dados} t={tempo} fim={estado.duracaoMs} ativo={ativo} responder={responder} />
      )}
      {((estado.fase === 'jogando' && (estado.meu !== null || respondi === estado.indice)) || estado.fase === 'intervalo') && vivo && (
        <span aria-live="polite" style={{ fontSize: 64, fontWeight: 900, color: estado.meu === false || (estado.fase === 'intervalo' && !estado.meu) ? '#c94a3a' : '#4f8f3f' }}>
          {estado.meu === null && estado.fase === 'jogando' ? '…' : estado.meu ? '✓' : '✗'}
        </span>
      )}
      {!vivo && estado.fase !== 'preparando' && <p className="minijogo-situacao">{jogador ? t('Sem vidas: agora é torcer pelos outros.') : t('Relâmpago')}</p>}
    </div>
  );
}
