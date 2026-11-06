import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, menosMovimento, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * TRÊS FLECHAS NOS BALÕES (05/11/2026, server/src/festa/flecha.ts): o arco corre sozinho embaixo, e a flecha sobe reta e fura
 * todos os balões do caminho. Os balões vêm prontos do servidor; cada flecha vai na hora (a ação 'acerto'), e o servidor faz a
 * mesma conta, abaixo, igual à dele.
 */

// Os mesmos números e as mesmas contas do servidor.
const FLECHA_MS = 15000;
const FLECHAS = 3;
const FLECHA_RECARGA_MS = 1100;
const FLECHA_Y0 = 176;
const FLECHA_VELOCIDADE = 0.34;
const FLECHA_PONTA = 2;
const ARCO_X0 = 24;
const ARCO_X1 = 276;
interface Balao {
  y: number;
  xa: number;
  xb: number;
  periodoMs: number;
  fase: number;
  r: number;
  valor: number;
}
interface DadosFlecha {
  periodoDoArco: number;
  baloes: Balao[];
}
const onda = (periodoMs: number, t: number) => {
  const f = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 1 - Math.abs(f * 2 - 1);
};
const xDoArco = (d: DadosFlecha, t: number) => ARCO_X0 + (ARCO_X1 - ARCO_X0) * onda(d.periodoDoArco, t);
const xDoBalao = (b: Balao, t: number) => b.xa + (b.xb - b.xa) * onda(b.periodoMs, t + b.fase);
function flechada(d: DadosFlecha, t: number, estourados: number[]): number[] {
  const x = xDoArco(d, t);
  const furou: number[] = [];
  for (let i = 0; i < d.baloes.length; i++) {
    if (estourados.includes(i)) continue;
    const b = d.baloes[i];
    const ti = t + (FLECHA_Y0 - b.y) / FLECHA_VELOCIDADE;
    if (Math.abs(x - xDoBalao(b, ti)) <= b.r + FLECHA_PONTA) furou.push(i);
  }
  return furou;
}

const CORES = ['#d9534f', '#6fb3d9', '#86b35a', '#b25d9a', '#f2c46a', '#e07a2e', '#5aa89a'];
/** A flecha sobe até sair da tela. */
const VOO_MS = FLECHA_Y0 / FLECHA_VELOCIDADE;

function Flecha({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<Partial<DadosFlecha>>) {
  const t = useT();
  const d = dados.baloes && dados.periodoDoArco ? (dados as DadosFlecha) : null;
  /** As flechas soltas (o instante) e, de cada balão furado, quando estoura (o instante em que a ponta chega). */
  const flechas = useRef<number[]>([]);
  const estouros = useRef(new Map<number, number>());
  const [, setDesenho] = useState(0);
  const agora = useRelogio(ativo);
  const e = Math.max(0, agora - inicio);
  const quieto = menosMovimento();
  const ultima = flechas.current[flechas.current.length - 1];
  const acabou = e >= FLECHA_MS || (flechas.current.length === FLECHAS && e > ultima + VOO_MS + 300);

  useEffect(() => {
    if (ativo && acabou) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou]);
  // o estouro na hora em que a flecha chega (o som, uma vez cada)
  const tocados = useRef(new Set<number>());
  useEffect(() => {
    for (const [i, em] of estouros.current) {
      if (em <= e && !tocados.current.has(i)) {
        tocados.current.add(i);
        tocar('acerto');
      }
    }
  }, [e]);

  const atirar = () => {
    if (!ativo || !d) return;
    const ms = Math.round(Date.now() - inicio);
    const u = flechas.current[flechas.current.length - 1];
    if (flechas.current.length >= FLECHAS || (u !== undefined && ms < u + FLECHA_RECARGA_MS) || ms < 0 || ms > FLECHA_MS) return;
    flechas.current.push(ms);
    for (const i of flechada(d, ms, [...estouros.current.keys()])) estouros.current.set(i, ms + (FLECHA_Y0 - d.baloes[i].y) / FLECHA_VELOCIDADE);
    tocar('tiro');
    lance({ t: ms });
    setDesenho((n) => n + 1);
  };
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowUp') return false;
    atirar();
    return true;
  });

  if (!d) return <Moldura placar="🎈" fracao={0}>{null}</Moldura>;
  const pontos = [...estouros.current.entries()].filter(([, em]) => em <= e).reduce((s, [i]) => s + d.baloes[i].valor, 0);
  const restam = FLECHAS - flechas.current.length;
  const armando = ultima !== undefined && e < ultima + FLECHA_RECARGA_MS;
  const xa = xDoArco(d, e);

  return (
    <Moldura placar={`🎈 ${pontos} · ${'➶'.repeat(restam)}`} fracao={e / FLECHA_MS}>
      <svg
        viewBox="0 0 300 200"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          atirar();
        }}
      >
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#bfe0f0" />
        {!quieto && (
          <g fill="#f3faff" opacity="0.8">
            <ellipse cx={60 + ((e / 90) % 360) - 40} cy="22" rx="22" ry="7" />
            <ellipse cx={220 - ((e / 120) % 300) + 60} cy="160" rx="26" ry="8" />
          </g>
        )}
        <rect x="0" y="184" width="300" height="16" fill="#7cb35e" />
        {/* os balões que ainda estão no ar (e os que acabaram de estourar, num estalo) */}
        {d.baloes.map((b, i) => {
          const em = estouros.current.get(i);
          const x = xDoBalao(b, em !== undefined && em <= e ? em : e);
          if (em !== undefined && em <= e) {
            return e - em < 300 ? (
              <g key={i} transform={`translate(${x} ${b.y})`} stroke={CORES[i % CORES.length]} strokeWidth="2" strokeLinecap="round">
                {[0, 1, 2, 3, 4, 5].map((k) => (
                  <line key={k} x1={Math.cos(k) * b.r * 0.6} y1={Math.sin(k) * b.r * 0.6} x2={Math.cos(k) * b.r * 1.4} y2={Math.sin(k) * b.r * 1.4} />
                ))}
                <text y="-12" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2a1c14" stroke="none">
                  +{b.valor}
                </text>
              </g>
            ) : null;
          }
          return (
            <g key={i} transform={`translate(${x} ${b.y})`}>
              <path d={`M0 ${b.r} q-3 8 2 16`} stroke="#8a7a66" strokeWidth="0.8" fill="none" />
              <ellipse rx={b.r} ry={b.r * 1.15} fill={b.valor === 3 ? '#f2c46a' : CORES[i % CORES.length]} stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" />
              <ellipse cx={-b.r * 0.35} cy={-b.r * 0.4} rx={b.r * 0.22} ry={b.r * 0.3} fill="rgba(255,255,255,0.55)" />
              {b.valor === 3 && <path d="M-3 0 L3 0 M0 -3 L0 3" stroke="#a87a2a" strokeWidth="1.2" />}
            </g>
          );
        })}
        {/* as flechas no ar */}
        {flechas.current.map((t0, k) => {
          if (e < t0 || e > t0 + VOO_MS) return null;
          const x = xDoArco(d, t0);
          const y = FLECHA_Y0 - (e - t0) * FLECHA_VELOCIDADE;
          return (
            <g key={k}>
              <line x1={x} y1={y} x2={x} y2={y + 22} stroke="#8a5a3a" strokeWidth="1.6" />
              <path d={`M${x - 3} ${y + 4} L${x} ${y - 3} L${x + 3} ${y + 4} Z`} fill="#5a3a2a" />
              <path d={`M${x - 3} ${y + 24} L${x} ${y + 19} L${x + 3} ${y + 24}`} stroke="#d9534f" strokeWidth="1.4" fill="none" />
            </g>
          );
        })}
        {/* o coelho com o arco, correndo embaixo */}
        <g transform={`translate(${xa} 186)`}>
          <ellipse cx="0" cy="0" rx="12" ry="3" fill="rgba(0,0,0,0.2)" />
          <ellipse cx="0" cy="-9" rx="8" ry="8" fill="#e8dccb" />
          <CoelhoDeFrente y={-14} escala={0.85} />
          <path d="M-12 -12 Q0 -26 12 -12" stroke="#8a5a3a" strokeWidth="2.2" fill="none" />
          <line x1="-12" y1="-12" x2="12" y2="-12" stroke="#f3ead8" strokeWidth="0.8" />
          {restam > 0 && !armando && <line x1="0" y1="-10" x2="0" y2="-30" stroke="#8a5a3a" strokeWidth="1.4" opacity="0.8" />}
        </g>
      </svg>
    </Moldura>
  );
}

const NOME = chave('Três flechas');

export default microjogoDaTela({
  id: 'flecha',
  nome: NOME,
  dica: chave('A flecha sobe reta e fura o que encontrar. Os balões pequenos valem mais.'),
  Tela: Flecha,
  valor: (v) => `🎈 ${v}`,
  errouComValor: true,
});
