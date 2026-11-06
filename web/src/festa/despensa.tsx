import { useEffect, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * ARRUME A DESPENSA (05/11/2026, server/src/festa/despensa.ts): a prateleira aparece cheia, os potes caem e se embaralham
 * embaixo, e cada um os põe de volta: tocar um pote do monte o leva ao primeiro lugar vazio da prateleira (da esquerda para a
 * direita); tocar um da prateleira o devolve. Com os seis no lugar, a resposta vai sozinha.
 */

// Os mesmos números do servidor.
const MOSTRA_MS = 4000;
const QUEDA_MS = 1200;
const RESPOSTA_MS = 15000;
const POTES = 6;

const X = Array.from({ length: POTES }, (_, i) => 32 + i * 47);
const Y_PRATELEIRA = 74;
const Y_MONTE = 172;

/** Os oito potes: a cor do vidro, a tampa e o desenho do rótulo, todos diferentes (nenhuma letra). */
const POTE = [
  { vidro: '#e07a2e', tampa: '#b0563a' }, // cenoura
  { vidro: '#d9534f', tampa: '#f2efe6' }, // morango
  { vidro: '#7cb85a', tampa: '#4f7d3a' }, // ervilha
  { vidro: '#f2c46a', tampa: '#a97c50' }, // mel
  { vidro: '#b0465a', tampa: '#6fa356' }, // beterraba
  { vidro: '#8e6bb8', tampa: '#5d4a82' }, // uva
  { vidro: '#e9d36a', tampa: '#6fa356' }, // milho
  { vidro: '#6aa7c8', tampa: '#3e6f8c' }, // água
];

function Rotulo({ tipo }: { tipo: number }) {
  switch (tipo) {
    case 0:
      return (
        <>
          <path d="M-5 -2 L5 -2 L0 10 Z" fill="#e07a2e" stroke="#7a3a1a" strokeWidth="0.8" />
          <path d="M-2 -2 L-4 -7 M0 -2 L0 -8 M2 -2 L4 -7" stroke="#4f7d3a" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case 1:
      return (
        <>
          <path d="M-5 0 Q0 -5 5 0 Q4 8 0 10 Q-4 8 -5 0 Z" fill="#d9534f" />
          <path d="M-3 -3 L0 -6 L3 -3" stroke="#4f7d3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      );
    case 2:
      return <path d="M-6 4 Q0 -4 6 4 Q0 9 -6 4 Z" fill="#7cb85a" stroke="#4f7d3a" strokeWidth="0.8" />;
    case 3:
      return <path d="M0 -6 Q6 2 0 9 Q-6 2 0 -6 Z" fill="#e0a83a" stroke="#8a5a1a" strokeWidth="0.8" />;
    case 4:
      return (
        <>
          <circle cx="0" cy="3" r="5.5" fill="#b0465a" />
          <path d="M0 -2 L-3 -8 M0 -2 L3 -8" stroke="#6fa356" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case 5:
      return (
        <>
          {[[-3, -2], [3, -2], [0, 3], [-3, 7], [3, 7], [0, -6]].map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r="2.6" fill="#8e6bb8" stroke="#5d4a82" strokeWidth="0.6" />
          ))}
        </>
      );
    case 6:
      return (
        <>
          <ellipse cx="0" cy="2" rx="3.6" ry="7" fill="#e9c13a" />
          <path d="M-4 9 Q-6 0 -1 -5 M4 9 Q6 0 1 -5" stroke="#6fa356" strokeWidth="1.8" fill="none" />
        </>
      );
    default:
      return <path d="M0 -6 Q5 2 3 6 Q0 9 -3 6 Q-5 2 0 -6 Z" fill="#6aa7c8" stroke="#3e6f8c" strokeWidth="0.8" />;
  }
}

/** Um pote, com o fundo em (0, 0). */
function Pote({ tipo, marcado }: { tipo: number; marcado?: boolean }) {
  const c = POTE[tipo] ?? POTE[0];
  return (
    <g>
      <rect x="-16" y="-38" width="32" height="38" rx="7" fill={c.vidro} stroke={marcado ? '#fff7e0' : '#3a2e2a'} strokeWidth={marcado ? 3 : 1.5} />
      <rect x="-12" y="-34" width="5" height="24" rx="2.5" fill="rgba(255,255,255,0.35)" />
      <rect x="-18" y="-46" width="36" height="9" rx="3" fill={c.tampa} stroke="#3a2e2a" strokeWidth="1.5" />
      <rect x="-10" y="-29" width="20" height="20" rx="4" fill="#f2efe6" />
      <g transform="translate(0 -19)">
        <Rotulo tipo={tipo} />
      </g>
    </g>
  );
}

function Despensa({ dados, inicio, ativo, enviar }: PropsDoMicro<{ prateleira?: number[]; monte?: number[] }>) {
  const t = useT();
  const prateleira = dados.prateleira ?? [];
  const monte = dados.monte ?? [];
  /** O que está em cada lugar da prateleira: o índice do pote no monte, ou null. */
  const [lugares, setLugares] = useState<(number | null)[]>(() => Array(POTES).fill(null));
  const [mandou, setMandou] = useState(false);
  const agora = useRelogio(ativo || Date.now() < inicio + MOSTRA_MS + QUEDA_MS);
  const e = agora - inicio;
  const arrumando = e >= MOSTRA_MS + QUEDA_MS;
  const podeMexer = ativo && arrumando && !mandou;

  const mandar = (l: (number | null)[]) => {
    if (mandou) return;
    setMandou(true);
    // o que faltou vai na ordem do monte (o tempo acabou)
    const sobra = monte.map((_, i) => i).filter((i) => !l.includes(i));
    const ordem = l.map((i) => monte[i ?? sobra.shift()!]);
    enviar({ ordem, ms: Math.max(0, Math.round(Date.now() - (inicio + MOSTRA_MS + QUEDA_MS))) });
  };
  const pegar = (i: number) => {
    if (!podeMexer || lugares.includes(i)) return;
    const vazio = lugares.indexOf(null);
    if (vazio < 0) return;
    const novos = [...lugares];
    novos[vazio] = i;
    setLugares(novos);
    tocar('clique');
    if (!novos.includes(null)) {
      tocar('acerto');
      mandar(novos);
    }
  };
  const devolver = (lugar: number) => {
    if (!podeMexer || lugares[lugar] === null) return;
    const novos = [...lugares];
    novos[lugar] = null;
    setLugares(novos);
    tocar('carta');
  };
  // o tempo acabou: vai o que estiver na prateleira
  useEffect(() => {
    if (ativo && !mandou && e >= MOSTRA_MS + QUEDA_MS + RESPOSTA_MS) mandar(lugares);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= MOSTRA_MS + QUEDA_MS + RESPOSTA_MS]);
  useEffect(() => {
    if (ativo && e >= MOSTRA_MS && e < MOSTRA_MS + 100) tocar('queda');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e >= MOSTRA_MS]);
  useTeclas(podeMexer, (ev) => {
    if (ev.key === 'Backspace') {
      const ultimo = lugares.map((l, i) => (l === null ? -1 : i)).filter((i) => i >= 0).pop();
      if (ultimo !== undefined) devolver(ultimo);
      return true;
    }
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > POTES) return false;
    pegar(n - 1);
    return true;
  });

  /** Onde o pote i do monte está: na prateleira (antes da queda, no lugar certo; depois, onde a pessoa o pôs) ou no monte. */
  const ondeEsta = (i: number) => {
    const certo = prateleira.indexOf(monte[i]);
    const noMonte = { x: X[i], y: Y_MONTE };
    if (e < MOSTRA_MS) return { x: X[certo], y: Y_PRATELEIRA };
    if (e < MOSTRA_MS + QUEDA_MS) {
      // cai da prateleira para o monte, com um quiquezinho no fim
      const p = (e - MOSTRA_MS) / QUEDA_MS;
      const q = Math.min(1, p * 1.25);
      const quique = p > 0.8 ? Math.sin(((p - 0.8) / 0.2) * Math.PI) * 6 : 0;
      return { x: X[certo] + (noMonte.x - X[certo]) * q, y: Y_PRATELEIRA + (Y_MONTE - Y_PRATELEIRA) * q * q - quique };
    }
    const lugar = lugares.indexOf(i);
    return lugar >= 0 ? { x: X[lugar], y: Y_PRATELEIRA } : noMonte;
  };
  const fracao = arrumando ? (e - MOSTRA_MS - QUEDA_MS) / RESPOSTA_MS : 0;

  return (
    <Moldura placar={`🫙 × ${lugares.filter((l) => l !== null).length}`} fracao={fracao}>
      <svg viewBox="0 0 300 200" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'none' }}>
        {/* a parede da despensa e a prateleira, com os lugares marcados depois da queda */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#e9dcc4" />
        <rect x="0" y="120" width="300" height="80" rx="12" fill="#b88a5e" />
        <rect x="0" y="120" width="300" height="8" fill="#9a6e48" />
        <rect x="6" y={Y_PRATELEIRA} width="288" height="10" rx="2" fill="#a97c50" stroke="#5a3a2a" strokeWidth="1.5" />
        <path d={`M30 ${Y_PRATELEIRA + 10} l8 18 M262 ${Y_PRATELEIRA + 10} l-8 18`} stroke="#5a3a2a" strokeWidth="4" strokeLinecap="round" />
        {arrumando &&
          X.map((x, lugar) => (
            <g
              key={lugar}
              onPointerDown={(ev) => {
                ev.preventDefault();
                devolver(lugar);
              }}
            >
              <rect x={x - 19} y={Y_PRATELEIRA - 48} width="38" height="48" rx="7" fill="rgba(90,58,42,0.08)" stroke="#a97c50" strokeWidth="1.5" strokeDasharray="4 4" />
            </g>
          ))}
        {monte.map((tipo, i) => {
          const { x, y } = ondeEsta(i);
          const naPrateleira = arrumando && lugares.includes(i);
          return (
            <g
              key={i}
              transform={`translate(${x} ${y})`}
              style={{ cursor: podeMexer ? 'pointer' : 'default' }}
              onPointerDown={(ev) => {
                ev.preventDefault();
                if (naPrateleira) devolver(lugares.indexOf(i));
                else pegar(i);
              }}
            >
              <Pote tipo={tipo} />
            </g>
          );
        })}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Arrume a despensa');

export default microjogoDaTela({
  id: 'despensa',
  nome: NOME,
  dica: chave('Guarde onde fica cada pote e ponha todos de volta no lugar.'),
  Tela: Despensa,
  valor: (v) => `🫙 × ${v}`,
});
