import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, CORES_DAS_EQUIPES, FaixaDasEquipes, LinhaDoTempo, microjogoDaTela, Moldura, useAoVivo, useRelogio, type PropsDoMicro, type TurmaNaTela } from './comum';

/**
 * COLHEITA EM DUPLA (lote 5, 05/11/2026; server/src/festa/colheita.ts): cada dupla na sua árvore; quem está no galho solta os
 * morangos maduros, e quem está embaixo apanha com a cesta. A tela mostra só a árvore da MINHA dupla, e em cima o placar de
 * todas. Quem apanha decide (a cesta desta tela), e o servidor confere a hora e onde a cesta estava.
 *
 * Teclado: ← → (ou A D) andam; no galho, Espaço solta o morango mais perto. Toque: segurar anda até o dedo; no galho, tocar num
 * morango vai até ele e o solta.
 */

// Os mesmos números do servidor.
const COLHEITA_MS = 25000;
const QUEDA_MS = 1300;
const MIN_X = 20;
const MAX_X = 280;
const VEL_GALHO = 130;
const VEL_CESTA = 150;
const ALCANCE_GALHO = 24;
const ALCANCE_CESTA = 30;
const MADURO_MS = 4000;
const GALHO_Y = 44;
const CESTA_Y = 172;

interface Morango {
  t: number;
  x: number;
  ouro: boolean;
}
interface Dados {
  morangos?: Morango[];
  papeis?: { galho: number | null; cesta: number }[];
  turma?: TurmaNaTela;
}
/** x = [id, x]; f = [morango, equipe, x, t, estado]; c = por equipe, os que saíram do galho; p = pontos por equipe. */
interface Quadro {
  x: [number, number][];
  f: [number, number, number, number, number][];
  c: number[][];
  p: number[];
}

function Moranguinho({ x, y, ouro, escala = 1 }: { x: number; y: number; ouro: boolean; escala?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <path d="M0 9 C-8 4 -8 -4 -5 -6 C-2 -8 2 -8 5 -6 C8 -4 8 4 0 9 Z" fill={ouro ? '#f2c33c' : '#e0453a'} stroke={ouro ? '#b78a10' : '#a82a22'} strokeWidth="1" />
      <path d="M-4 -6 L0 -10 L4 -6 L0 -7 Z" fill="#5d8f47" />
      {[[-2, -1], [2, 1], [-1, 4], [3, -3]].map(([dx, dy], k) => (
        <circle key={k} cx={dx} cy={dy} r="0.7" fill="#fff6c8" />
      ))}
    </g>
  );
}

function Colheita({ dados, inicio, ativo, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const turma = dados.turma;
  const eu = turma?.eu ?? 0;
  const papeis = dados.papeis ?? [];
  const morangos = dados.morangos ?? [];
  const eq = papeis.findIndex((p) => p.galho === eu || p.cesta === eu);
  const papel = papeis[eq];
  const noGalho = papel?.galho === eu;
  const linha = useRef(new LinhaDoTempo<Quadro>()).current;
  const [, setN] = useState(0);
  const mandar = useAoVivo<Quadro>('colheita', ativo, lance, (q) => {
    linha.chegou(q);
    setN((n) => n + 1);
  });
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const ultimo = linha.ultimo()?.q ?? null;

  const meuX = useRef(150);
  const teclas = useRef(new Set<string>());
  const dedo = useRef<number | null>(null);
  const vouSoltar = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const ultimoEnvio = useRef(0);
  const anterior = useRef(agora);
  /** Os que eu soltei, antes de o servidor mostrar (a tela não espera a ida e volta para o morango sair do galho). */
  const solteiAqui = useRef(new Map<number, number>());
  /** Os que a minha cesta já resolveu (apanhei ou deixei cair). */
  const resolvidos = useRef(new Map<number, boolean>());
  const parceiroX = useRef(150);

  const soltavel = () => {
    const colhidos = new Set(ultimo?.c[eq] ?? []);
    let melhor = -1;
    let dist = Infinity;
    morangos.forEach((m, i) => {
      if (m.t > e || e > m.t + MADURO_MS || colhidos.has(i) || solteiAqui.current.has(i)) return;
      const d = Math.abs(m.x - meuX.current);
      if (d < dist) [dist, melhor] = [d, i];
    });
    return dist <= ALCANCE_GALHO - 4 ? melhor : -1;
  };
  const soltar = () => {
    const i = soltavel();
    if (i < 0) return false;
    solteiAqui.current.set(i, e);
    mandar({ tipo: 'solta', i });
    tocar('pulo');
    return true;
  };

  useEffect(() => {
    if (!ativo) return;
    const baixo = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
        teclas.current.add(k);
        ev.preventDefault();
      } else if ((k === ' ' || k === 'enter') && !ev.repeat && noGalho) {
        soltar();
        ev.preventDefault();
      }
    };
    const cima = (ev: KeyboardEvent) => teclas.current.delete(ev.key.toLowerCase());
    window.addEventListener('keydown', baixo);
    window.addEventListener('keyup', cima);
    return () => {
      window.removeEventListener('keydown', baixo);
      window.removeEventListener('keyup', cima);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, noGalho, ultimo]);

  // o passo local: andar, apanhar, mandar a posição
  useEffect(() => {
    const dt = Math.min(0.1, Math.max(0, (agora - anterior.current) / 1000));
    anterior.current = agora;
    if (!ativo || !papel || e < 0 || e > COLHEITA_MS) return;
    let v = 0;
    const k = teclas.current;
    if (k.has('arrowleft') || k.has('a')) v -= 1;
    if (k.has('arrowright') || k.has('d')) v += 1;
    let alvo = dedo.current;
    if (vouSoltar.current !== null) alvo = morangos[vouSoltar.current]?.x ?? null;
    const piloto = import.meta.env.DEV && (window as unknown as { festaPilotoAutomatico?: boolean }).festaPilotoAutomatico;
    if (piloto) {
      if (noGalho) {
        const colhidos = new Set(ultimo?.c[eq] ?? []);
        const i = morangos.findIndex((m, j) => m.t <= e && !colhidos.has(j) && !solteiAqui.current.has(j));
        alvo = i >= 0 ? morangos[i].x : null;
      } else {
        const vindo = (ultimo?.f ?? []).filter((f) => f[1] === eq && f[4] === 0 && !resolvidos.current.has(f[0])).sort((a, b) => a[3] - b[3])[0];
        alvo = vindo ? vindo[2] : null;
      }
    }
    if (alvo !== null && Math.abs(alvo - meuX.current) > 3) v = Math.sign(alvo - meuX.current);
    const vel = noGalho ? VEL_GALHO : VEL_CESTA;
    meuX.current = Math.min(MAX_X, Math.max(MIN_X, meuX.current + v * vel * dt));
    if (noGalho && (vouSoltar.current !== null || piloto) && soltavel() >= 0 && Math.abs((alvo ?? -99) - meuX.current) < 6) {
      soltar();
      vouSoltar.current = null;
    }
    // a minha cesta decide: o morango chegou ao chão NESTA tela, e a cesta estava embaixo?
    if (!noGalho) {
      for (const f of ultimo?.f ?? []) {
        if (f[1] !== eq || resolvidos.current.has(f[0]) || f[4] !== 0) continue;
        if (e < f[3] + QUEDA_MS) continue;
        const pegou = Math.abs(f[2] - meuX.current) <= ALCANCE_CESTA - 6;
        resolvidos.current.set(f[0], pegou);
        if (pegou) {
          mandar({ tipo: 'pego', i: f[0] });
          tocar('moeda');
        } else tocar('erro');
      }
    }
    if (Date.now() - ultimoEnvio.current >= 66) {
      ultimoEnvio.current = Date.now();
      mandar({ tipo: 'p', x: Math.round(meuX.current * 10) / 10 });
    }
    // o parceiro, suavizado até a última posição que veio
    const dele = ultimo?.x.find(([id]) => id === (noGalho ? papel.cesta : papel.galho));
    if (dele) parceiroX.current += (dele[1] - parceiroX.current) * Math.min(1, dt * 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  if (!papel) return <></>;
  const cor = CORES_DAS_EQUIPES[eq % CORES_DAS_EQUIPES.length];
  const colhidos = new Set(ultimo?.c[eq] ?? []);
  const pontos = ultimo?.p ?? papeis.map(() => 0);
  const galhoX = noGalho ? meuX.current : parceiroX.current;
  const cestaX = noGalho ? parceiroX.current : meuX.current;
  // o que cai: o que o servidor diz, e o que eu soltei e ele ainda não mostrou
  const caindo: { i: number; x: number; t: number; estado: number }[] = (ultimo?.f ?? []).filter((f) => f[1] === eq).map((f) => ({ i: f[0], x: f[2], t: f[3], estado: f[4] }));
  for (const [i, te] of solteiAqui.current) if (!caindo.some((c) => c.i === i) && e - te < 800) caindo.push({ i, x: morangos[i].x, t: te + 60, estado: 0 });

  const xDoDedo = (ev: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return ((ev.clientX - r.left) / r.width) * 300;
  };

  return (
    <Moldura placar={`🍓 × ${pontos[eq] ?? 0}`} fracao={e / COLHEITA_MS}>
      <FaixaDasEquipes turma={turma} pontos={pontos} />
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="group"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(ev) => {
          if (!ativo) return;
          ev.preventDefault();
          (ev.target as Element).setPointerCapture?.(ev.pointerId);
          const x = xDoDedo(ev);
          if (noGalho) {
            // tocar num morango maduro: vai até ele e solta
            const i = morangos.findIndex((m, j) => m.t <= e && e <= m.t + MADURO_MS && !colhidos.has(j) && Math.abs(m.x - x) < 16);
            if (i >= 0) {
              vouSoltar.current = i;
              return;
            }
          }
          dedo.current = x;
        }}
        onPointerMove={(ev) => {
          if (dedo.current !== null) dedo.current = xDoDedo(ev);
        }}
        onPointerUp={() => (dedo.current = null)}
        onPointerCancel={() => (dedo.current = null)}
      >
        {/* o céu, a grama, e a árvore da minha dupla com o galho comprido */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#bfe3f2" />
        <rect x="0" y="150" width="300" height="50" fill="#7cb85a" />
        <rect x="140" y="40" width="20" height="112" fill="#8a6548" />
        <ellipse cx="150" cy="24" rx="150" ry="26" fill="#5d8f47" />
        <ellipse cx="80" cy="30" rx="70" ry="18" fill="#6fa356" />
        <ellipse cx="225" cy="28" rx="70" ry="18" fill="#6fa356" />
        <rect x={MIN_X - 6} y={GALHO_Y + 6} width={MAX_X - MIN_X + 12} height="6" rx="3" fill="#7a5236" />
        {/* os maduros pendurados (e o que já vai cair sozinho, tremendo) */}
        {morangos.map((m, i) => {
          if (m.t > e || e > m.t + MADURO_MS || colhidos.has(i) || solteiAqui.current.has(i)) return null;
          const crescer = Math.min(1, (e - m.t) / 300);
          const treme = e > m.t + MADURO_MS - 900 ? (Math.floor(e / 70) % 2 ? 1 : -1) : 0;
          return <Moranguinho key={i} x={m.x + treme} y={GALHO_Y + 18} ouro={m.ouro} escala={0.5 + 0.5 * crescer} />;
        })}
        {caindo.map((c) => {
          if (c.estado !== 0 && e - c.t > QUEDA_MS + 300) return null;
          if (!noGalho && resolvidos.current.get(c.i) === true) return null;
          const k = Math.min(1, Math.max(0, (e - c.t) / QUEDA_MS));
          if (k >= 1 && (c.estado === 1 || resolvidos.current.get(c.i))) return null;
          const y = GALHO_Y + 18 + (CESTA_Y - 6 - GALHO_Y - 18) * k * k;
          return <Moranguinho key={`q${c.i}`} x={c.x} y={Math.min(CESTA_Y + 10, y)} ouro={morangos[c.i]?.ouro ?? false} />;
        })}
        {/* no galho: quem colhe (ou a árvore sozinha, na dupla de um) */}
        {papel.galho !== null && (
          <g transform={`translate(${galhoX} ${GALHO_Y + 6})`}>
            <ellipse cx="0" cy="1" rx="11" ry="4" fill={cor} opacity={noGalho ? 1 : 0.7} stroke={noGalho ? '#fff' : 'none'} strokeWidth="1.5" />
            <CoelhoDeFrente escala={0.8} />
            <text y={-33} textAnchor="middle" fontSize="8" fontWeight={noGalho ? 700 : 400} fill="#3a2e2a" stroke="#fffaf0" strokeWidth="2.5" paintOrder="stroke">
              {turma?.nomes[papel.galho] ?? ''}
            </text>
          </g>
        )}
        {/* embaixo: a cesta */}
        <g transform={`translate(${cestaX} ${CESTA_Y})`}>
          <ellipse cx="0" cy="12" rx="13" ry="4" fill={cor} opacity={noGalho ? 0.7 : 1} stroke={noGalho ? 'none' : '#fff'} strokeWidth="1.5" />
          <CoelhoDeFrente y={10} escala={0.8} />
          <path d={`M-${ALCANCE_CESTA - 8} -6 h${(ALCANCE_CESTA - 8) * 2} l-4 12 h-${(ALCANCE_CESTA - 8) * 2 - 8} Z`} fill="#c49766" stroke="#7a5236" strokeWidth="1.5" />
          <path d={`M-${ALCANCE_CESTA - 12} -2 h${(ALCANCE_CESTA - 12) * 2}`} stroke="#a07448" strokeWidth="1" />
        </g>
      </svg>
    </Moldura>
  );
}

const NOME = chave('Colheita em dupla');

export default microjogoDaTela<Dados>({
  id: 'colheita',
  nome: NOME,
  dica: chave('Em dupla: quem está no galho solta os morangos maduros, e quem está embaixo apanha com a cesta.'),
  Tela: Colheita,
  valor: (v) => `🍓 × ${v}`,
});
