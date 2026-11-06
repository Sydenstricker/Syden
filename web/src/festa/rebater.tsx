import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * REBATER O RABANETE (05/11/2026, server/src/festa/rebater.ts): a raposa arremessa, o coelho rebate no aperto. Os arremessos
 * vêm prontos do servidor; cada tacada vai na hora (a ação 'acerto'), e o servidor faz a mesma conta, abaixo, igual à dele.
 */

// Os mesmos números e as mesmas contas do servidor.
const REBATER_ANTES = 350;
const REBATER_DEPOIS = 250;
const REBATER_DEGRAUS: [number, number][] = [
  [35, 100],
  [75, 70],
  [120, 45],
  [180, 20],
];
type Arremesso = { sai: number; voo: number; tipo: 0 | 1 | 2 };
const chegadaDoRabanete = (a: { sai: number; voo: number }) => a.sai + a.voo;
function tacadaNoRabanete(arremessos: Arremesso[], t: number) {
  for (let k = 0; k < arremessos.length; k++) {
    const erro = t - chegadaDoRabanete(arremessos[k]);
    if (erro < -REBATER_ANTES || erro > REBATER_DEPOIS) continue;
    let metros = 0;
    for (const [ate, m] of REBATER_DEGRAUS) {
      if (Math.abs(erro) <= ate) {
        metros = m;
        break;
      }
    }
    return { k, erro, metros };
  }
  return { k: -1, erro: 0, metros: 0 };
}

/** O desenho: a mão da raposa, a base onde o rabanete chega, e o chão. */
const MAO = { x: 236, y: 104 };
const BASE = { x: 72, y: 124 };
const CHAO = 138;
const PX_POR_METRO = 2.1;
const VOO_DA_REBATIDA_MS = 1100;
const BALANCO_MS = 160;

/** Onde o rabanete está, `p` (0 a 1) do caminho da mão à base, pelo jeito do arremesso. */
function noCaminho(tipo: number, p: number) {
  const x = MAO.x + (BASE.x - MAO.x) * p;
  const reto = MAO.y + (BASE.y - MAO.y) * p;
  if (tipo === 1) return { x, y: reto - 60 * 4 * p * (1 - p) };
  if (tipo === 2) {
    // quicando: desce até o chão no meio, e sobe de novo até a base
    if (p < 0.5) {
      const q = p / 0.5;
      return { x, y: MAO.y + (CHAO - 4 - MAO.y) * q * q };
    }
    const q = (p - 0.5) / 0.5;
    return { x, y: CHAO - 4 + (BASE.y - (CHAO - 4)) * q - 30 * 4 * q * (1 - q) };
  }
  return { x, y: reto - 10 * 4 * p * (1 - p) };
}

function Rebater({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ arremessos?: Arremesso[] }>) {
  const t = useT();
  const arremessos = dados.arremessos ?? [];
  const fim = arremessos.length ? chegadaDoRabanete(arremessos[arremessos.length - 1]) + REBATER_DEPOIS : 0;
  /** O que cada arremesso deu: os metros, o erro e quando foi rebatido. */
  const rebatidas = useRef(new Map<number, { metros: number; erro: number; em: number }>());
  const [balanco, setBalanco] = useState<number | null>(null);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const acabou = arremessos.length > 0 && e > fim + VOO_DA_REBATIDA_MS;

  useEffect(() => {
    if (ativo && acabou) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, acabou]);

  const rebater = () => {
    if (!ativo) return;
    const ms = Math.round(Date.now() - inicio);
    if (ms < 0 || ms > fim) return;
    // o taco só balança de novo depois de voltar
    if (balanco !== null && ms - balanco < BALANCO_MS * 2) return;
    setBalanco(ms);
    const { k, erro, metros } = tacadaNoRabanete(arremessos, ms);
    if (k < 0 || rebatidas.current.has(k)) {
      tocar('clique');
      return;
    }
    rebatidas.current.set(k, { metros, erro, em: ms });
    tocar(metros >= 100 ? 'combo' : metros > 0 ? 'soco' : 'erro');
    lance({ t: ms });
  };
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev)) return false;
    rebater();
    return true;
  });

  const total = [...rebatidas.current.values()].reduce((a, r) => a + r.metros, 0);
  // o arremesso da vez: o primeiro que ainda não acabou de passar
  const k = arremessos.findIndex((a, i) => {
    const r = rebatidas.current.get(i);
    return r ? e - r.em < VOO_DA_REBATIDA_MS : e < chegadaDoRabanete(a) + 500;
  });
  const a = k >= 0 ? arremessos[k] : null;
  const r = k >= 0 ? rebatidas.current.get(k) : undefined;
  let rabanete: { x: number; y: number } | null = null;
  if (a && r && r.metros > 0) {
    // rebatido: volta por cima da raposa, mais alto quanto mais na hora, e cai nos metros dele
    const p = Math.min(1, (e - r.em) / VOO_DA_REBATIDA_MS);
    const ate = BASE.x + r.metros * PX_POR_METRO;
    rabanete = { x: BASE.x + (ate - BASE.x) * p, y: BASE.y + (CHAO - BASE.y) * p - (30 + r.metros * 0.7) * 4 * p * (1 - p) };
  } else if (a && e >= a.sai) {
    // no caminho; e passando da base, se ninguém acertou
    const p = (e - a.sai) / a.voo;
    rabanete = p <= 1 ? noCaminho(a.tipo, p) : { x: BASE.x - (p - 1) * 160, y: BASE.y + (p - 1) * 20 };
  }
  // a raposa: o braço sobe pouco antes de soltar
  const preparando = a && !r && e < a.sai && e > a.sai - 400;
  const giro = balanco !== null && e - balanco < BALANCO_MS * 2 ? Math.min(1, (e - balanco) / BALANCO_MS) : 0;
  const ultima = [...rebatidas.current.entries()].filter(([, v]) => e - v.em < VOO_DA_REBATIDA_MS + 600).pop();

  return (
    <Moldura placar={`${total} m`} fracao={fim ? e / fim : 0}>
      <svg
        viewBox="0 0 300 170"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          rebater();
        }}
      >
        <rect x="0" y="0" width="300" height="170" rx="12" fill="#cfe6f2" />
        <rect x="0" y={CHAO} width="300" height={170 - CHAO} fill="#7cb35e" />
        {/* as marcas dos metros, no chão */}
        {[25, 50, 75, 100].map((m) => (
          <g key={m}>
            <line x1={BASE.x + m * PX_POR_METRO} y1={CHAO} x2={BASE.x + m * PX_POR_METRO} y2={CHAO + 6} stroke="#f3ead8" strokeWidth="1.5" />
            <text x={BASE.x + m * PX_POR_METRO} y={CHAO + 18} fontSize="9" textAnchor="middle" fill="#2f4a22">
              {m}
            </text>
          </g>
        ))}
        {/* o montinho da raposa, e a raposa */}
        <ellipse cx="250" cy={CHAO} rx="30" ry="6" fill="#c99a6b" />
        <g transform={`translate(250 ${CHAO - 2})`}>
          <ellipse cx="0" cy="-14" rx="10" ry="12" fill="#e07a2e" />
          <ellipse cx="0" cy="-10" rx="6" ry="7" fill="#f3ead8" />
          <circle cx="0" cy="-34" r="10" fill="#e07a2e" />
          <path d="M-9 -39 L-7 -52 L-1 -42 Z M9 -39 L7 -52 L1 -42 Z" fill="#e07a2e" />
          <path d="M-6 -32 Q0 -24 6 -32 L0 -27 Z" fill="#f3ead8" />
          <circle cx="-4" cy="-36" r="1.5" fill="#3a2e2a" />
          <circle cx="4" cy="-36" r="1.5" fill="#3a2e2a" />
          <circle cx="0" cy="-30" r="1.4" fill="#3a2e2a" />
          <path d={preparando ? 'M-8 -18 L-18 -40' : 'M-8 -18 L-16 -6'} stroke="#e07a2e" strokeWidth="4" strokeLinecap="round" />
          <path d="M10 -6 Q26 -10 22 -22" stroke="#e07a2e" strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
        {/* a base */}
        <path d={`M${BASE.x - 8} ${CHAO} l8 -3 l8 3 Z`} fill="#f3ead8" />
        {/* o coelho e o taco */}
        <g transform={`translate(${BASE.x - 26} ${CHAO - 4})`}>
          <ellipse cx="0" cy="2" rx="14" ry="3" fill="rgba(0,0,0,0.2)" />
          <ellipse cx="0" cy="-12" rx="10" ry="12" fill="#e8dccb" />
          <CoelhoDeFrente y={-20} escala={1.1} />
          <g transform={`translate(8 -14) rotate(${-80 + giro * 125})`}>
            <rect x="0" y="-2.5" width="34" height="5" rx="2.5" fill="#a97c50" stroke="#5a3a2a" strokeWidth="0.8" />
          </g>
        </g>
        {/* o rabanete */}
        {rabanete && (
          <g transform={`translate(${rabanete.x} ${rabanete.y})`}>
            <circle r="5" fill="#d9466f" />
            <path d="M-1 -5 L-4 -11 M1 -5 L3 -11" stroke="#6fa356" strokeWidth="2" strokeLinecap="round" />
            <path d="M0 5 L0 9" stroke="#f3e6f0" strokeWidth="1.2" />
          </g>
        )}
        {/* o que a última rebatida deu */}
        {ultima && (
          <text x="150" y="40" textAnchor="middle" fontSize="18" fontWeight="700" fill={ultima[1].metros > 0 ? '#2f6b2a' : '#a8322e'}>
            {ultima[1].metros >= 100 ? '★ 100 m ★' : ultima[1].metros > 0 ? `${ultima[1].metros} m` : '✕'}
          </text>
        )}
        {/* os arremessos que faltam */}
        {arremessos.map((_, i) => (
          <circle key={i} cx={232 + i * 12} cy="16" r="4" fill={rebatidas.current.has(i) ? (rebatidas.current.get(i)!.metros ? '#2f6b2a' : '#a8322e') : '#d9466f'} opacity={rebatidas.current.has(i) || i >= k ? 1 : 0.3} />
        ))}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Rebater o rabanete');

export default microjogoDaTela({
  id: 'rebater',
  nome: NOME,
  dica: chave('Rebata quando o rabanete chegar à base. Bem na hora, vai mais longe.'),
  Tela: Rebater,
  valor: (v) => `${v} m`,
  errouComValor: true,
});
