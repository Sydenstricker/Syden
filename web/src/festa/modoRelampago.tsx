import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Placar } from '../Minijogo';
import { tocar } from '../somDosJogos';
import { useRelogio, useTeclas } from './comum';
import { CoelhoComemorando } from './moldura';

/**
 * O MODO RELÂMPAGO DA FESTA (19/11/2026, server/src/minijogo-festa-relampago.ts): microjogos de 4 a 5 s, cada vez mais
 * rápidos, com 3 vidas. Cada um joga na própria tela; o servidor sorteia, marca o relógio e confere cada resposta. Tudo
 * desenhado por código e sem texto dentro do jogo: a cenoura para tocar, a seta para repetir, a luz para esperar, a barra para
 * parar na faixa verde, as cenouras para contar.
 */

type DadosRelampago =
  | { tipo: 'toque'; casa: number; aparece: number }
  | { tipo: 'lado'; direcao: number; aparece: number }
  | { tipo: 'espere'; aparece: number }
  | { tipo: 'pare'; periodo: number; de: number; ate: number }
  | { tipo: 'conte'; quantas: number; opcoes: number[]; mostra: number; posicoes: number[] };

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

/** Um microjogo relâmpago, valendo. `t` é o tempo dele (ms desde o começo, neste relógio). */
function Microjogo({ d, t, fim, ativo, responder }: { d: DadosRelampago; t: number; fim: number; ativo: boolean; responder: (r?: number) => void }) {
  useTeclas(ativo, (e) => {
    if (d.tipo === 'lado' && e.key in TECLAS_DAS_SETAS) return (responder(TECLAS_DAS_SETAS[e.key]), true);
    if ((d.tipo === 'espere' || d.tipo === 'pare') && (e.key === ' ' || e.key === 'Enter')) return (responder(), true);
    if (d.tipo === 'toque' && /^[1-9]$/.test(e.key)) return (responder(Number(e.key) - 1), true);
    if (d.tipo === 'conte' && /^[1-3]$/.test(e.key) && t >= d.mostra) return (responder(d.opcoes[Number(e.key) - 1]), true);
    return false;
  });
  const barra = (
    <rect x="0" y="0" width={240 * Math.max(0, 1 - t / fim)} height="5" fill="#f2c46a" />
  );
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
      </div>
    );
  }

  return (
    <div className="festa festa-relampago" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
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
