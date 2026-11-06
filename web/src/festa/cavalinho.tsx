import { useEffect, useRef, useState } from 'react';
import { chave, idiomaAtual, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * CORRIDA DE CAVALINHO DE PAU (05/11/2026, server/src/festa/cavalinho.ts): alternar ← e → (ou os dois botões) para o
 * cavalinho andar, sem esgotar o fôlego. Os passos vão em lotes (a ação 'acerto'), e o servidor refaz a corrida com a mesma
 * conta, abaixo, igual à dele.
 */

// Os mesmos números e as mesmas contas do servidor.
const CAVALINHO_MS = 20000;
const META = 60;
const CENOURAS = [16, 32, 46];
const FOLEGO = 100;
const CUSTO_DO_PASSO = 3;
const CUSTO_DA_PRESSA = 700;
const VOLTA_POR_MS = 0.02;
const FOLEGO_DA_CENOURA = 35;
const FOLEGO_PARA_VOLTAR = 70;
const INTERVALO_MINIMO = 55;
interface Corrida {
  andou: number;
  chegada: number | null;
  folego: number;
  cansado: boolean;
  ultimo: number;
  lado: number;
  passouEm: number | null;
}
const corridaNova = (): Corrida => ({ andou: 0, chegada: null, folego: FOLEGO, cansado: false, ultimo: 0, lado: -1, passouEm: null });
const custoDoPasso = (c: Corrida, t: number) =>
  CUSTO_DO_PASSO + CUSTO_DA_PRESSA / Math.max(INTERVALO_MINIMO, c.passouEm === null ? 1000 : t - c.passouEm);
const folegoEm = (c: Corrida, t: number) => Math.min(FOLEGO, c.folego + (t - c.ultimo) * VOLTA_POR_MS);
function passo(c: Corrida, t: number, lado: number) {
  if (c.chegada !== null) return;
  c.folego = folegoEm(c, t);
  c.ultimo = t;
  if (c.cansado) {
    if (c.folego < FOLEGO_PARA_VOLTAR) return;
    c.cansado = false;
  }
  if (lado === c.lado) return;
  c.lado = lado;
  c.folego -= custoDoPasso(c, t);
  c.passouEm = t;
  if (c.folego <= 0) {
    c.folego = 0;
    c.cansado = true;
    return;
  }
  c.andou++;
  if (CENOURAS.includes(c.andou)) c.folego = Math.min(FOLEGO, c.folego + FOLEGO_DA_CENOURA);
  if (c.andou >= META) c.chegada = t;
}

/** A tela manda os passos juntos, a cada tanto (o servidor aceita um passo de até meio segundo atrás). */
const LOTE_A_CADA_MS = 250;
/** A pista, no desenho. */
const X0 = 30;
const X1 = 280;
const xDoPasso = (n: number) => X0 + ((X1 - X0) * n) / META;

function Cavalinho({ inicio, ativo, enviar, lance }: PropsDoMicro<Record<string, never>>) {
  const t = useT();
  const corrida = useRef(corridaNova());
  const pendentes = useRef<[number, number][]>([]);
  const ultimoAperto = useRef<number | null>(null);
  const [, setDesenho] = useState(0);
  const agora = useRelogio(ativo);
  const e = Math.max(0, agora - inicio);
  const c = corrida.current;

  const mandar = () => {
    if (!pendentes.current.length) return;
    lance({ p: pendentes.current });
    pendentes.current = [];
  };
  // o lote a cada tanto, e o fim: chegou, ou acabou o tempo
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(mandar, LOTE_A_CADA_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  useEffect(() => {
    if (ativo && e >= CAVALINHO_MS) {
      mandar();
      enviar({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= CAVALINHO_MS]);

  const apertar = (lado: number) => {
    if (!ativo || c.chegada !== null) return;
    const ms = Math.round(Date.now() - inicio);
    if (ms < 0 || ms > CAVALINHO_MS) return;
    // o mesmo filtro do servidor: dois apertos colados demais contam como um
    if (ultimoAperto.current !== null && ms < ultimoAperto.current + INTERVALO_MINIMO) return;
    ultimoAperto.current = ms;
    pendentes.current.push([ms, lado]);
    const antes = { andou: c.andou, cansado: c.cansado };
    passo(c, ms, lado);
    if (c.andou > antes.andou) {
      tocar(CENOURAS.includes(c.andou) ? 'moeda' : 'clique');
    } else if (c.cansado && !antes.cansado) tocar('queda');
    if (c.chegada !== null) {
      tocar('chegada');
      mandar();
      enviar({});
    }
    setDesenho((n) => n + 1);
  };
  useTeclas(ativo, (ev) => {
    const k = ev.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') apertar(0);
    else if (k === 'arrowright' || k === 'd') apertar(1);
    else return false;
    return true;
  });

  const folego = c.chegada !== null ? c.folego : folegoEm(c, e);
  const cansado = c.cansado && folego < FOLEGO_PARA_VOLTAR;
  const proximo = c.lado === 0 ? 1 : 0;
  const x = xDoPasso(c.andou);
  // o balanço do cavalinho: um lado e outro a cada passo
  const inclina = c.andou === 0 ? 0 : c.lado === 0 ? -8 : 8;
  const placar = c.chegada !== null ? `🏁 ${(c.chegada / 1000).toLocaleString(idiomaAtual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${c.andou}/${META}`;

  return (
    <Moldura placar={placar} fracao={e / CAVALINHO_MS}>
      <svg viewBox="0 0 300 150" role="img" aria-label={t(NOME)} style={{ width: '100%' }}>
        <rect x="0" y="0" width="300" height="150" rx="12" fill="#a8d08d" />
        {/* a cerca do fundo e a pista de terra */}
        {Array.from({ length: 16 }, (_, k) => (
          <rect key={k} x={6 + k * 19} y="22" width="4" height="22" fill="#c9a57a" />
        ))}
        <rect x="0" y="28" width="300" height="4" fill="#c9a57a" />
        <rect x="0" y="38" width="300" height="4" fill="#c9a57a" />
        <rect x="0" y="62" width="300" height="46" fill="#c99a6b" />
        <rect x="0" y="62" width="300" height="3" fill="#b0845a" />
        {/* a largada e a chegada */}
        <rect x={X0 - 2} y="62" width="3" height="46" fill="#f3ead8" />
        {Array.from({ length: 6 }, (_, k) => (
          <rect key={k} x={X1} y={62 + k * 7.7} width="6" height="7.7" fill={k % 2 ? '#2a1c14' : '#f3ead8'} />
        ))}
        {/* as cenouras que ainda não foram pegas */}
        {CENOURAS.filter((n) => n > c.andou).map((n) => (
          <g key={n} transform={`translate(${xDoPasso(n)} 86)`}>
            <path d="M-4 -4 L4 -4 L0 9 Z" fill="#e07a2e" />
            <path d="M-2 -4 L-4 -9 M0 -4 L0 -10 M2 -4 L4 -9" stroke="#6fa356" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ))}
        {/* o coelho no cavalinho de pau */}
        <g transform={`translate(${x} 104) scale(1.35) rotate(${inclina * (cansado ? 0.2 : 1)})`}>
          <ellipse cx="0" cy="2" rx="16" ry="3" fill="rgba(0,0,0,0.2)" />
          {/* o cabo */}
          <line x1="-16" y1="0" x2="12" y2="-26" stroke="#8a5a3a" strokeWidth="3" strokeLinecap="round" />
          {/* a cabeça do cavalinho */}
          <g transform="translate(14 -30)">
            <ellipse cx="4" cy="0" rx="9" ry="6" fill="#f2c46a" stroke="#a87a2a" strokeWidth="1" />
            <path d="M-3 -5 L-1 -11 L2 -5" fill="#f2c46a" stroke="#a87a2a" strokeWidth="1" />
            <path d="M-5 -4 q-3 4 0 9" stroke="#d9534f" strokeWidth="3" fill="none" />
            <circle cx="6" cy="-1" r="1.3" fill="#3a2e2a" />
          </g>
          {/* o corpo e as patinhas */}
          <ellipse cx="-2" cy="-10" rx="9" ry="8" fill="#e8dccb" />
          <ellipse cx={c.lado === 0 ? -8 : 4} cy="-1" rx="3.5" ry="2.5" fill="#e8dccb" />
          <ellipse cx={c.lado === 0 ? 4 : -8} cy="-3" rx="3.5" ry="2.5" fill="#d8ccbb" />
          <CoelhoDeFrente x={-2} y={-14} escala={0.95} olhos={cansado ? 'tontos' : 'abertos'} />
          {cansado && (
            <g fill="#9cc8e8">
              <path d="M10 -40 q2 4 0 6 q-2 -2 0 -6 Z" />
              <path d="M-14 -36 q2 4 0 6 q-2 -2 0 -6 Z" />
            </g>
          )}
        </g>
        {/* o fôlego: a barra embaixo, que fica vermelha quando acaba */}
        <rect x="30" y="120" width="240" height="12" rx="6" fill="#5a3a2a" />
        <rect
          x="32"
          y="122"
          width={(236 * Math.max(0, folego)) / FOLEGO}
          height="8"
          rx="4"
          fill={cansado ? '#d9534f' : folego < 30 ? '#f2c46a' : '#6fb3d9'}
          opacity={cansado ? 0.6 + 0.4 * Math.abs(Math.sin(agora / 120)) : 1}
        />
        <text x="18" y="130" fontSize="11" textAnchor="middle" aria-hidden="true">
          💨
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
        {[0, 1].map((lado) => (
          <button
            key={lado}
            type="button"
            className={lado === proximo && ativo && !cansado ? 'btn-primary' : 'btn-secondary'}
            style={{ minWidth: 96, minHeight: 56, fontSize: 24, touchAction: 'manipulation' }}
            disabled={!ativo}
            aria-label={lado === 0 ? '←' : '→'}
            onPointerDown={(ev) => {
              ev.preventDefault();
              apertar(lado);
            }}
          >
            {lado === 0 ? '←' : '→'}
          </button>
        ))}
      </div>
    </Moldura>
  );
}

const NOME = chave('Corrida de cavalinho');

export default microjogoDaTela({
  id: 'cavalinho',
  nome: NOME,
  dica: chave('Alterne ← e → no ritmo. Com pressa demais, o fôlego acaba.'),
  Tela: Cavalinho,
  // chegou: o tempo (sempre de 1 s para cima); não chegou: quantos passos andou
  valor: (v, f) => (v >= 1000 ? `🏁 ${f.s.format(v / 1000)}` : `${v}/${META}`),
  errouComValor: true,
});
