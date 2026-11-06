import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * A RODA DA FEIRA (05/11/2026, server/src/festa/rodafeira.ts): a roda gira, o aperto a faz frear, e ela sempre desliza o mesmo
 * tanto até parar. Três giros, fixos no relógio. O aperto vai na hora (a ação 'acerto'), e o servidor faz a mesma conta, abaixo,
 * igual à dele. Sem aposta: o prêmio é só ponto da rodada.
 */

// Os mesmos números e as mesmas contas do servidor.
const RODA_VEZES = 3;
const RODA_VEZ_MS = 5500;
const RODA_GIRO_MS = 3500;
const RODA_FREIO_MS = 1600;
interface Fatia {
  de: number;
  ate: number;
  premio: number;
}
type Giro = { v: number; fatias: Fatia[] };
const paradaDaRoda = (v: number, ms: number) => v * (ms / 1000 + RODA_FREIO_MS / 2000);
function premioEm(fatias: Fatia[], voltas: number): number {
  const p = voltas - Math.floor(voltas);
  for (const f of fatias) if (p >= f.de && p < f.ate) return f.premio;
  return fatias[fatias.length - 1].premio;
}

const COR_DO_PREMIO: Record<number, string> = { 10: '#f2c46a', 5: '#d9534f', 3: '#6fb3d9', 2: '#86b35a', 1: '#b25d9a' };
const CX = 150;
const CY = 96;
const R = 74;

/** Quantas voltas a roda deu `ms` depois do começo do giro, tendo apertado em `aperto` (ou não). Só para o desenho. */
function voltasNoDesenho(v: number, ms: number, aperto: number | null): number {
  if (aperto === null) return (v * Math.min(ms, RODA_GIRO_MS + 400)) / 1000;
  const d = Math.min(RODA_FREIO_MS, ms - aperto) / 1000;
  const T = RODA_FREIO_MS / 1000;
  return v * (aperto / 1000) + v * (d - (d * d) / (2 * T));
}

function Roda({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ giros?: Giro[] }>) {
  const t = useT();
  const giros = dados.giros ?? [];
  const apertos = useRef(new Map<number, { ms: number; premio: number }>());
  const [, setDesenho] = useState(0);
  const agora = useRelogio(ativo);
  const e = Math.max(0, agora - inicio);
  const vez = Math.min(RODA_VEZES - 1, Math.floor(e / RODA_VEZ_MS));
  const ms = e - vez * RODA_VEZ_MS;
  const g = giros[vez];
  const dessa = apertos.current.get(vez);
  const passou = !dessa && ms > RODA_GIRO_MS;
  const parou = dessa && ms >= dessa.ms + RODA_FREIO_MS;
  const ultimo = apertos.current.get(RODA_VEZES - 1);
  const acabou = e >= RODA_VEZES * RODA_VEZ_MS || (!!ultimo && e - (RODA_VEZES - 1) * RODA_VEZ_MS > ultimo.ms + RODA_FREIO_MS + 900);

  useEffect(() => {
    if (ativo && acabou) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou]);
  // o tique da roda freando, e o prêmio quando para
  const tocados = useRef(new Set<number>());
  useEffect(() => {
    if (parou && !tocados.current.has(vez)) {
      tocados.current.add(vez);
      tocar(dessa!.premio >= 10 ? 'combo' : dessa!.premio >= 5 ? 'acerto' : 'moeda');
    }
    if (passou && !tocados.current.has(vez)) {
      tocados.current.add(vez);
      tocar('erro');
    }
  }, [parou, passou, vez, dessa]);

  const apertar = () => {
    if (!ativo) return;
    const agoraMs = Math.round(Date.now() - inicio);
    const v = Math.floor(agoraMs / RODA_VEZ_MS);
    const m = agoraMs - v * RODA_VEZ_MS;
    if (agoraMs < 0 || v >= RODA_VEZES || m > RODA_GIRO_MS || apertos.current.has(v)) return;
    const giro = giros[v];
    apertos.current.set(v, { ms: m, premio: premioEm(giro.fatias, paradaDaRoda(giro.v, m)) });
    tocar('clique');
    lance({ t: agoraMs });
    setDesenho((n) => n + 1);
  };
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev)) return false;
    apertar();
    return true;
  });

  const total = [...apertos.current.entries()]
    .filter(([k, a]) => k < vez || e - k * RODA_VEZ_MS >= a.ms + RODA_FREIO_MS)
    .reduce((s, [, a]) => s + a.premio, 0);
  if (!g) return <Moldura placar="🎡" fracao={0}>{null}</Moldura>;
  const voltas = voltasNoDesenho(g.v, ms, dessa?.ms ?? null);
  // a roda gira para que a fração `voltas` da roda fique embaixo da seta (em cima)
  const giro = -360 * (voltas - Math.floor(voltas));
  const ponto = (f: number, r: number) => {
    const a = 2 * Math.PI * f - Math.PI / 2;
    return `${CX + r * Math.cos(a)} ${CY + r * Math.sin(a)}`;
  };

  return (
    <Moldura placar={`🥕 ${total} · ${vez + 1}/${RODA_VEZES}`} fracao={e / (RODA_VEZES * RODA_VEZ_MS)}>
      <svg
        viewBox="0 0 300 190"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          apertar();
        }}
      >
        <rect x="0" y="0" width="300" height="190" rx="12" fill="#f3e2c4" />
        {/* as bandeirinhas da feira */}
        <path d="M0 10 Q150 34 300 10" stroke="#8a5a3a" strokeWidth="1" fill="none" />
        {Array.from({ length: 11 }, (_, k) => {
          const x = 14 + k * 27;
          const y = 10 + 24 * (1 - ((x - 150) / 150) ** 2) * 0.95;
          return <path key={k} d={`M${x - 6} ${y - 1} L${x + 6} ${y - 1} L${x} ${y + 9} Z`} fill={['#d9534f', '#f2c46a', '#6fb3d9', '#86b35a'][k % 4]} />;
        })}
        {/* o pé da roda */}
        <path d={`M${CX - 40} 186 L${CX} ${CY} L${CX + 40} 186`} stroke="#8a5a3a" strokeWidth="6" fill="none" />
        <g transform={`rotate(${giro} ${CX} ${CY})`}>
          <circle cx={CX} cy={CY} r={R + 5} fill="#5a3a2a" />
          {g.fatias.map((f, i) => (
            <g key={i}>
              <path
                d={`M${CX} ${CY} L${ponto(f.de, R)} A${R} ${R} 0 ${f.ate - f.de > 0.5 ? 1 : 0} 1 ${ponto(f.ate, R)} Z`}
                fill={COR_DO_PREMIO[f.premio]}
                stroke="#fff4e6"
                strokeWidth="1"
              />
              <text
                transform={`rotate(${((f.de + f.ate) / 2) * 360} ${CX} ${CY})`}
                x={CX}
                y={CY - R + (f.premio === 10 ? 12 : 16)}
                textAnchor="middle"
                fontSize={f.premio === 10 ? 8 : 12}
                fontWeight="700"
                fill="#2a1c14"
              >
                {f.premio}
              </text>
            </g>
          ))}
          {/* as luzinhas da borda */}
          {Array.from({ length: 16 }, (_, k) => (
            <circle key={k} cx={CX + (R + 2.5) * Math.cos((k / 16) * 2 * Math.PI)} cy={CY + (R + 2.5) * Math.sin((k / 16) * 2 * Math.PI)} r="1.6" fill="#fff4e6" />
          ))}
        </g>
        <circle cx={CX} cy={CY} r="9" fill="#5a3a2a" />
        <circle cx={CX} cy={CY} r="5" fill="#f2c46a" />
        {/* a seta, em cima */}
        <path d={`M${CX - 9} ${CY - R - 14} L${CX + 9} ${CY - R - 14} L${CX} ${CY - R + 4} Z`} fill="#d9534f" stroke="#7a2a24" strokeWidth="1.2" />
        {(parou || passou) && (
          <g>
            <circle cx="262" cy="150" r="22" fill={passou ? '#a8322e' : COR_DO_PREMIO[dessa!.premio]} stroke="#5a3a2a" strokeWidth="2" />
            <text x="262" y="157" textAnchor="middle" fontSize="18" fontWeight="700" fill="#2a1c14">
              {passou ? '✕' : `+${dessa!.premio}`}
            </text>
          </g>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Roda da feira');

export default microjogoDaTela({
  id: 'rodafeira',
  nome: NOME,
  dica: chave('Aperte para a roda frear. Ela sempre desliza um pouco antes de parar.'),
  Tela: Roda,
  valor: (v) => `🥕 ${v}`,
  errouComValor: true,
});
