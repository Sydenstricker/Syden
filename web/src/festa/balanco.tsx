import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, menosMovimento, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * O PULO DO BALANÇO (05/11/2026, server/src/festa/balanco.ts): o coelho vai e vem no balanço e pula no aperto, para cair numa
 * folha do lago. Três vezes, fixas no relógio. O pulo vai na hora (a ação 'acerto'), e o servidor faz a mesma conta, abaixo,
 * igual à dele.
 */

// Os mesmos números e as mesmas contas do servidor.
const BALANCO_VEZES = 3;
const BALANCO_VEZ_MS = 5000;
const BALANCO_GIRO_MS = 4000;
const BALANCO_X = 110;
const BEIRA_DO_LAGO = 128;
const PESO_DA_POSICAO = 26;
const PESO_DA_VELOCIDADE = 150;
function vaivem(fase: number): number {
  const f = fase - Math.floor(fase);
  if (f < 0.5) return 8 * f * (1 - 2 * f);
  const g = f - 0.5;
  return -8 * g * (1 - 2 * g);
}
interface Folha {
  x: number;
  meia: number;
  valor: number;
}
const ondeCai = (periodoMs: number, ms: number) => {
  const fase = ms / periodoMs;
  return BALANCO_X + PESO_DA_POSICAO * vaivem(fase) + PESO_DA_VELOCIDADE * vaivem(fase + 0.25);
};
function pulo(periodoMs: number, folhas: Folha[], ms: number) {
  if (ms < 0 || ms > BALANCO_GIRO_MS) return { x: BALANCO_X, valor: 0 };
  const x = ondeCai(periodoMs, ms);
  for (const f of folhas) if (Math.abs(x - f.x) <= f.meia) return { x, valor: f.valor };
  return { x, valor: 0 };
}

/** O desenho: o galho do balanço, o comprimento da corda, a água. */
const PIVO_Y = 18;
const CORDA = 86;
const AGUA = 150;
const ABERTURA = 0.75;
const VOO_MS = 700;

function Balanco({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ periodoMs?: number; folhas?: Folha[][] }>) {
  const t = useT();
  const periodo = dados.periodoMs ?? 1500;
  const folhasDe = (v: number) => dados.folhas?.[v] ?? [];
  /** Cada vez já jogada: de onde pulou, onde caiu, o que valeu e quando. */
  const pulos = useRef(new Map<number, { de: { x: number; y: number }; x: number; valor: number; em: number }>());
  const [, setDesenho] = useState(0);
  const agora = useRelogio(ativo);
  const e = Math.max(0, agora - inicio);
  const quieto = menosMovimento();
  const vez = Math.min(BALANCO_VEZES - 1, Math.floor(e / BALANCO_VEZ_MS));
  const ms = e - vez * BALANCO_VEZ_MS;
  const dessa = pulos.current.get(vez);
  const parou = !dessa && ms > BALANCO_GIRO_MS;
  const acabou = e >= BALANCO_VEZES * BALANCO_VEZ_MS || (pulos.current.size === BALANCO_VEZES && e - (pulos.current.get(BALANCO_VEZES - 1)?.em ?? 0) > VOO_MS + 700);

  useEffect(() => {
    if (ativo && acabou) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou]);
  // a queda (na folha, na água ou na margem): o som na hora em que chega
  const tocados = useRef(new Set<number>());
  useEffect(() => {
    if (dessa && e - dessa.em >= VOO_MS && !tocados.current.has(vez)) {
      tocados.current.add(vez);
      tocar(dessa.valor > 0 ? (dessa.valor === 3 ? 'combo' : 'moeda') : dessa.x >= BEIRA_DO_LAGO ? 'agua' : 'queda');
    }
  }, [e, dessa, vez]);

  /** Onde o coelho está no balanço, `m` ms depois do começo da vez (o desenho pode usar seno; a conta, não). */
  const noBalanco = (m: number) => {
    const a = ABERTURA * vaivem(Math.min(m, BALANCO_GIRO_MS) / periodo);
    return { x: BALANCO_X + CORDA * Math.sin(a), y: PIVO_Y + CORDA * Math.cos(a), a };
  };

  const pular = () => {
    if (!ativo) return;
    const agoraMs = Math.round(Date.now() - inicio);
    const v = Math.floor(agoraMs / BALANCO_VEZ_MS);
    const m = agoraMs - v * BALANCO_VEZ_MS;
    if (agoraMs < 0 || v >= BALANCO_VEZES || m > BALANCO_GIRO_MS || pulos.current.has(v)) return;
    const r = pulo(periodo, folhasDe(v), m);
    const de = noBalanco(m);
    pulos.current.set(v, { de: { x: de.x, y: de.y }, x: r.x, valor: r.valor, em: agoraMs });
    tocar('pulo');
    lance({ t: agoraMs });
    setDesenho((n) => n + 1);
  };
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowUp') return false;
    pular();
    return true;
  });

  const total = [...pulos.current.values()].reduce((s, p) => s + p.valor, 0);
  const banco = noBalanco(dessa ? dessa.em - vez * BALANCO_VEZ_MS : ms);
  let coelho: { x: number; y: number; molhado: boolean } = { x: banco.x, y: banco.y, molhado: false };
  if (dessa) {
    const p = Math.min(1, (e - dessa.em) / VOO_MS);
    const naMargem = dessa.x < BEIRA_DO_LAGO;
    const chaoY = naMargem ? AGUA - 4 : dessa.valor > 0 ? AGUA - 3 : AGUA + 10;
    coelho = {
      x: dessa.de.x + (dessa.x - dessa.de.x) * p,
      y: dessa.de.y + (chaoY - dessa.de.y) * p - 46 * 4 * p * (1 - p),
      molhado: p >= 1 && !naMargem && dessa.valor === 0,
    };
  }
  const folhas = folhasDe(vez);
  const balancoX = dessa ? noBalanco(dessa.em - vez * BALANCO_VEZ_MS).x : banco.x;
  const balancoY = dessa ? noBalanco(dessa.em - vez * BALANCO_VEZ_MS).y : banco.y;

  return (
    <Moldura placar={`🪷 ${total} · ${Math.min(BALANCO_VEZES, vez + 1)}/${BALANCO_VEZES}`} fracao={e / (BALANCO_VEZES * BALANCO_VEZ_MS)}>
      <svg
        viewBox="0 0 300 180"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          pular();
        }}
      >
        <rect x="0" y="0" width="300" height="180" rx="12" fill="#cfe6f2" />
        {/* o lago e a margem */}
        <rect x={BEIRA_DO_LAGO} y={AGUA} width={300 - BEIRA_DO_LAGO} height={180 - AGUA} fill="#4f8fc0" />
        {!quieto &&
          [0, 1, 2].map((k) => (
            <path key={k} d={`M${110 + k * 60 + ((e / 40) % 30)} ${AGUA + 12 + k * 5} q4 -2 8 0 t8 0`} stroke="#9cc8e8" strokeWidth="1" fill="none" />
          ))}
        <path d={`M0 ${AGUA - 6} L${BEIRA_DO_LAGO + 4} ${AGUA - 6} L${BEIRA_DO_LAGO} 180 L0 180 Z`} fill="#7cb35e" />
        {/* a árvore e o galho do balanço */}
        <rect x="14" y="10" width="14" height={AGUA - 14} fill="#8a5a3a" />
        <rect x="14" y={PIVO_Y - 6} width={BALANCO_X - 2} height="8" rx="4" fill="#8a5a3a" />
        <circle cx="22" cy="16" r="20" fill="#6fa356" />
        {/* as folhas: a mais longe é a menor */}
        {folhas.map((f, i) => (
          <g key={i}>
            <ellipse cx={f.x} cy={AGUA + 1} rx={f.meia + 2} ry="4" fill="#5d8f47" />
            <ellipse cx={f.x} cy={AGUA} rx={f.meia} ry="3" fill="#86b35a" />
            <text x={f.x} y={AGUA + 20} fontSize="9" textAnchor="middle" fill="#f3faff">
              {'★'.repeat(f.valor)}
            </text>
          </g>
        ))}
        {/* as cordas e o assento */}
        <line x1={BALANCO_X} y1={PIVO_Y} x2={balancoX} y2={balancoY} stroke="#c9a57a" strokeWidth="1.6" />
        <rect x={balancoX - 9} y={balancoY - 2} width="18" height="4" rx="1.5" fill="#a97c50" />
        {/* o coelho */}
        <g transform={`translate(${coelho.x} ${coelho.y})`} opacity={coelho.molhado ? 0.55 : 1}>
          <ellipse cx="0" cy="-8" rx="8" ry="8" fill="#e8dccb" />
          <CoelhoDeFrente y={-14} escala={0.85} olhos={coelho.molhado || parou ? 'tontos' : 'abertos'} />
        </g>
        {dessa && e - dessa.em >= VOO_MS && (
          <text x={Math.max(30, Math.min(270, dessa.x))} y={AGUA - 44} textAnchor="middle" fontSize="15" fontWeight="700" fill={dessa.valor ? '#2f6b2a' : '#a8322e'}>
            {dessa.valor ? `+${dessa.valor}` : '✕'}
          </text>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Pulo do balanço');

export default microjogoDaTela({
  id: 'balanco',
  nome: NOME,
  dica: chave('Pule do balanço para cair numa folha. A mais longe vale mais.'),
  Tela: Balanco,
  valor: (v) => `🪷 ${v}`,
  errouComValor: true,
});
