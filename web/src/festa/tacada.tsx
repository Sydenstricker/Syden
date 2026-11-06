import { useEffect, useRef, useState } from 'react';
import { chave, idiomaAtual, useT } from '../i18n';
import { avancar, bater, novaBola, type Bola, type Buraco } from '../golfe/fisica';
import { tocar } from '../somDosJogos';
import { ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * UMA TACADA SÓ (05/11/2026, server/src/festa/tacada.ts): a mesa vem pronta do servidor, e a física é a do Minigolfe da toca
 * (../golfe/fisica). Dois apertos: o primeiro prende a seta da mira, o segundo dá a tacada com a força da barra. A tela refaz a
 * tacada com as MESMAS contas do servidor (abaixo, iguais às de lá) para mostrar a bola rolando sem esperar a rede.
 */

// Os mesmos números e as mesmas contas do servidor.
const TACADA_MS = 12000;
const TACADA_FORCA_MIN = 60;
const TACADA_FORCA_MAX = 990;
const TACADA_MIRA = 0.22;
const TACADA_ENTRE_MS = 150;
const onda = (periodoMs: number, t: number) => {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 1 - Math.abs(fase * 2 - 1);
};
const miraDaTacada = (periodoMs: number, t: number) => TACADA_MIRA * (2 * onda(periodoMs, t + periodoMs / 4) - 1);
function direcaoDaTacada(b: Buraco, u: number) {
  const bx = b.buraco[0] - b.inicio[0];
  const by = b.buraco[1] - b.inicio[1];
  const l = Math.sqrt(bx * bx + by * by);
  const c = (1 - u * u) / (1 + u * u);
  const s = (2 * u) / (1 + u * u);
  return { x: (bx / l) * c - (by / l) * s, y: (bx / l) * s + (by / l) * c };
}
interface DadosTacada {
  mesa?: Buraco;
  periodoMiraMs?: number;
  periodoMs?: number;
}
function vetorDaTacada(d: Required<DadosTacada>, tMira: number, tForca: number) {
  const dir = direcaoDaTacada(d.mesa, miraDaTacada(d.periodoMiraMs, tMira));
  const forca = TACADA_FORCA_MIN + (TACADA_FORCA_MAX - TACADA_FORCA_MIN) * onda(d.periodoMs, tForca - tMira);
  return { dx: Math.round(dir.x * forca), dy: Math.round(dir.y * forca) };
}

/** Um passo da física é 1/60 s. */
const PASSO_MS = 1000 / 60;
const pontos = (p: number[]) => p.join(' ');

function Tacada({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<DadosTacada>) {
  const t = useT();
  const d = dados.mesa && dados.periodoMiraMs && dados.periodoMs ? (dados as Required<DadosTacada>) : null;
  const [mira, setMira] = useState<number | null>(null);
  /** A tacada: quando saiu (no relógio deste computador) e a bola, que anda a cada quadro. */
  const tacada = useRef<{ em: number; bola: Bola; passos: number } | null>(null);
  const [, setDesenho] = useState(0);
  const [parou, setParou] = useState(false);
  const rolando = tacada.current !== null && !parou;
  const agora = useRelogio(ativo || rolando);
  const e = agora - inicio;

  // a bola anda pelo relógio: quantos passos de física cabem desde a tacada
  useEffect(() => {
    const tc = tacada.current;
    if (!tc || parou || !d) return;
    const alvo = Math.floor((agora - tc.em) / PASSO_MS);
    while (tc.passos < alvo && tc.bola.andando) {
      const antes = tc.bola.tacadas;
      avancar(d.mesa, tc.bola);
      tc.passos++;
      if (tc.bola.tacadas > antes) tocar('agua');
    }
    if (!tc.bola.andando) {
      setParou(true);
      tocar(tc.bola.dentro ? 'buraco' : 'fim');
    }
    setDesenho((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const apertar = () => {
    if (!ativo || !d || tacada.current) return;
    const ms = Math.round(Date.now() - inicio);
    if (ms < 0 || ms > TACADA_MS) return;
    if (mira === null) {
      setMira(ms);
      tocar('clique');
      lance({ t: ms });
      return;
    }
    if (ms < mira + TACADA_ENTRE_MS) return;
    const bola = novaBola(d.mesa);
    bater(bola, { passo: 0, ...vetorDaTacada(d, mira, ms) });
    tacada.current = { em: Date.now(), bola, passos: 0 };
    tocar('tacada');
    enviar({ t: ms });
  };
  useTeclas(ativo && !tacada.current, (ev) => {
    if (!ehAperto(ev)) return false;
    apertar();
    return true;
  });

  if (!d) return <Moldura placar="⛳" fracao={0}>{null}</Moldura>;
  const b = d.mesa;
  const bola = tacada.current?.bola ?? novaBola(b);
  // a seta: a mira presa, ou a que vai e volta
  const u = miraDaTacada(d.periodoMiraMs, mira ?? Math.max(0, e));
  const dir = direcaoDaTacada(b, u);
  const forca = mira === null ? 0 : tacada.current ? null : onda(d.periodoMs, Math.max(0, e) - mira);
  const distancia = parou ? (bola.dentro ? 0 : Math.round(Math.sqrt((bola.x - b.buraco[0]) ** 2 + (bola.y - b.buraco[1]) ** 2))) : null;
  const corGrama = b.tema === 'lago' ? '#79ad5e' : b.tema === 'horta' ? '#86b35a' : '#7cb35e';

  return (
    <Moldura placar={distancia === null ? '⛳' : formatarDistancia(distancia)} fracao={tacada.current ? 1 : e / TACADA_MS}>
      <svg
        viewBox="0 0 206 128"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          apertar();
        }}
      >
        <rect x="0" y="0" width="206" height="128" rx="6" fill="#5a3a2a" />
        <polygon points={pontos(b.contorno)} fill={corGrama} stroke="#3e2a1e" strokeWidth="3" strokeLinejoin="round" />
        {/* as listras do gramado cortado */}
        {Array.from({ length: 12 }, (_, k) => (
          <rect key={k} x={12 + k * 14} y="0" width="7" height="128" fill="rgba(255,255,255,0.05)" clipPath="url(#tacada-mesa)" />
        ))}
        <clipPath id="tacada-mesa">
          <polygon points={pontos(b.contorno)} />
        </clipPath>
        {b.areia.map(([x, y, w, h], k) => (
          <rect key={`a${k}`} x={x} y={y} width={w} height={h} rx="5" fill="#e3c98d" stroke="#c9ab6c" strokeWidth="0.8" />
        ))}
        {b.agua.map(([x, y, w, h], k) => (
          <g key={`g${k}`}>
            <rect x={x} y={y} width={w} height={h} rx="4" fill="#4f8fc0" />
            <path d={`M${x + 4} ${y + h / 2} q3 -2 6 0 t6 0 M${x + w / 2 - 4} ${y + h / 3} q3 -2 6 0 t6 0`} stroke="#9cc8e8" strokeWidth="1" fill="none" />
          </g>
        ))}
        {b.pinos.map(([x, y, r], k) => (
          <g key={`p${k}`}>
            <ellipse cx={x} cy={y + 1.5} rx={r} ry={r * 0.8} fill="rgba(0,0,0,0.2)" />
            <circle cx={x} cy={y} r={r} fill="#d9534f" stroke="#7a2a24" strokeWidth="1" />
            <circle cx={x - r * 0.35} cy={y - r * 0.3} r={r * 0.22} fill="#fff4e6" />
            <circle cx={x + r * 0.4} cy={y + r * 0.2} r={r * 0.18} fill="#fff4e6" />
          </g>
        ))}
        {/* a toca e a bandeirinha */}
        <circle cx={b.buraco[0]} cy={b.buraco[1]} r="3.5" fill="#2a1c14" />
        <line x1={b.buraco[0]} y1={b.buraco[1]} x2={b.buraco[0]} y2={b.buraco[1] - 16} stroke="#f3ead8" strokeWidth="1" />
        <path d={`M${b.buraco[0]} ${b.buraco[1] - 16} l9 3 l-9 3 Z`} fill="#e07a2e" />
        {/* o começo */}
        <circle cx={b.inicio[0]} cy={b.inicio[1]} r="4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        {/* a seta da mira, até a tacada sair */}
        {!tacada.current && (
          <g stroke={mira === null ? '#fff4e6' : '#f2c46a'} strokeWidth="2" strokeLinecap="round">
            <line x1={b.inicio[0] + dir.x * 5} y1={b.inicio[1] + dir.y * 5} x2={b.inicio[0] + dir.x * 30} y2={b.inicio[1] + dir.y * 30} />
            <line
              x1={b.inicio[0] + dir.x * 30}
              y1={b.inicio[1] + dir.y * 30}
              x2={b.inicio[0] + dir.x * 24 - dir.y * 4}
              y2={b.inicio[1] + dir.y * 24 + dir.x * 4}
            />
            <line
              x1={b.inicio[0] + dir.x * 30}
              y1={b.inicio[1] + dir.y * 30}
              x2={b.inicio[0] + dir.x * 24 + dir.y * 4}
              y2={b.inicio[1] + dir.y * 24 - dir.x * 4}
            />
          </g>
        )}
        {!bola.dentro && (
          <>
            <ellipse cx={bola.x + 0.8} cy={bola.y + 1.2} rx="2" ry="1.4" fill="rgba(0,0,0,0.25)" />
            <circle cx={bola.x} cy={bola.y} r="2" fill="#fffaf0" stroke="#8a7a66" strokeWidth="0.5" />
          </>
        )}
        {/* a barra de força, do lado: acende depois da mira presa */}
        <rect x="190" y="14" width="10" height="100" rx="3" fill="#2a1c14" opacity={mira === null ? 0.4 : 1} />
        {forca !== null && <rect x="191.5" y={15.5 + 97 * (1 - forca)} width="7" height={97 * forca} rx="2" fill={forca > 0.8 ? '#d9534f' : forca > 0.45 ? '#f2c46a' : '#86b35a'} />}
        {parou && bola.dentro && (
          <path
            transform={`translate(${b.buraco[0]} ${b.buraco[1] - 26})`}
            d="M0 -8 L2.4 -2.4 L8 -2.4 L3.2 1.6 L4.8 7.2 L0 4 L-4.8 7.2 L-3.2 1.6 L-8 -2.4 L-2.4 -2.4 Z"
            fill="#f2c46a"
          />
        )}
      </svg>
    </Moldura>
  );
}

const cm = (() => {
  try {
    return new Intl.NumberFormat(idiomaAtual(), { style: 'unit', unit: 'centimeter', unitDisplay: 'short', maximumFractionDigits: 0 });
  } catch {
    return null;
  }
})();
/** A distância até a toca (as unidades da mesa contam como centímetros), ou a bandeirinha quando entrou. */
const formatarDistancia = (v: number) => (v === 0 ? '⛳ ✓' : cm ? cm.format(v) : String(v));

const NOME = chave('Uma tacada só');

export default microjogoDaTela({
  id: 'tacada',
  nome: NOME,
  dica: chave('Prenda a mira, depois a força. Quem parar mais perto da toca ganha.'),
  Tela: Tacada,
  valor: (v) => formatarDistancia(v),
  naRevelacao: true,
});
