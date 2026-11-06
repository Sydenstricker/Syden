import { useEffect, useRef, useState, type ReactElement } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ehAperto, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * TRINCA DA HORTA (05/11/2026, server/src/festa/trinca.ts): três rolos de figuras da horta giram; três apertos param um de cada
 * vez, da esquerda para a direita. Três iguais é uma trinca. Sem aposta nenhuma: não há ficha nem prêmio, é um jogo de tempo.
 * Cada parada vai na hora, e o servidor refaz a mesma conta da figura na janela.
 */

// Os mesmos números e as mesmas contas do servidor.
const ROLOS = 3;
const TRINCA_MS = 20000;
const ENTRE_PARADAS_MS = 120;
const PAUSA_MS = 700;
const REACAO_MINIMA = 100;
type Rolo = { figuras: number[]; passo: number };
const posicaoNoRolo = (rolo: Rolo, t: number) => Math.floor((t + rolo.passo / 2) / rolo.passo) % rolo.figuras.length;
function podeParar(paradas: number[], t: number): boolean {
  if (t < REACAO_MINIMA || t > TRINCA_MS) return false;
  const ultima = paradas[paradas.length - 1];
  if (ultima === undefined) return true;
  return t >= ultima + (paradas.length % ROLOS === 0 ? PAUSA_MS : ENTRE_PARADAS_MS);
}

const NOME = chave('Trinca da horta');
const ROLO_X = [78, 150, 222];
const MEIO = 92;
/** A distância entre duas figuras no rolo. */
const PASSO_Y = 46;

/** As seis figuras (o pé do desenho no meio, uns 34 de altura). */
const FIGURA: (() => ReactElement)[] = [
  () => (
    <g>
      <path d="M-8 -6 L8 -6 L0 18 Z" fill="#e07a2e" />
      <path d="M-3 0 L3 1 M-2 6 L2 7" stroke="#b85a1e" strokeWidth="1.5" />
      <path d="M-3 -6 L-7 -16 M0 -6 L0 -18 M3 -6 L7 -16" stroke="#6fa356" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  () => (
    <g>
      <circle cx="0" cy="2" r="15" fill="#7cb85a" />
      <path d="M-10 -4 Q0 6 10 -4 M-12 6 Q0 14 12 6 M0 -13 L0 16" stroke="#4f7d3a" strokeWidth="1.8" fill="none" />
      <circle cx="0" cy="2" r="6" fill="#c9e3a0" />
    </g>
  ),
  () => (
    <g>
      <circle cx="0" cy="4" r="11" fill="#d94a6a" />
      <path d="M0 15 L0 20" stroke="#f4ede2" strokeWidth="2" strokeLinecap="round" />
      <path d="M-2 -6 Q-10 -14 -8 -18 Q-2 -14 -1 -7 M2 -6 Q10 -14 8 -18 Q2 -14 1 -7" fill="#6fa356" />
      <ellipse cx="-4" cy="0" rx="2.5" ry="4" fill="#f08aa0" opacity="0.7" />
    </g>
  ),
  () => (
    <g>
      <path d="M-12 -4 Q0 -10 12 -4 Q10 12 0 18 Q-10 12 -12 -4 Z" fill="#d9534f" />
      {[[-5, 2], [4, 1], [0, 8], [-3, 12], [5, 9]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r="1" fill="#f2c46a" />
      ))}
      <path d="M-8 -6 L0 -2 L8 -6 L4 -10 L0 -7 L-4 -10 Z" fill="#4f7d3a" />
    </g>
  ),
  () => (
    <g>
      <rect x="-4" y="2" width="8" height="15" rx="3" fill="#f2e2c4" />
      <path d="M-16 4 Q-14 -14 0 -14 Q14 -14 16 4 Z" fill="#c0392b" />
      <circle cx="-7" cy="-5" r="2.5" fill="#f4ede2" />
      <circle cx="5" cy="-8" r="2" fill="#f4ede2" />
      <circle cx="9" cy="-1" r="1.8" fill="#f4ede2" />
    </g>
  ),
  () => (
    <g>
      <path d="M-6 18 Q-14 0 -6 -16 Q0 -20 6 -16 Q14 0 6 18 Z" fill="#f2c46a" />
      <path d="M-3 -12 L-3 14 M2 -14 L2 15 M-6 -4 L6 -4 M-6 4 L6 4" stroke="#d9a63a" strokeWidth="1.2" />
      <path d="M-6 18 Q-16 4 -12 -8 Q-8 6 -2 14 Z M6 18 Q16 4 12 -8 Q8 6 2 14 Z" fill="#7cb85a" />
    </g>
  ),
];

function Trinca({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ rolos?: Rolo[] }>) {
  const t = useT();
  const rolos = dados.rolos ?? [];
  const paradas = useRef<number[]>([]);
  const [, setParou] = useState(0);
  const [trincas, setTrincas] = useState(0);
  const [brilho, setBrilho] = useState<{ em: number; tipo: 'trinca' | 'par' | 'nada' } | null>(null);
  const agora = useRelogio(ativo);
  const e = Math.min(agora - inicio, TRINCA_MS);

  const parar = () => {
    if (!ativo || rolos.length < ROLOS) return;
    const ms = Math.round(Date.now() - inicio);
    if (!podeParar(paradas.current, ms)) return;
    paradas.current.push(ms);
    setParou((n) => n + 1);
    // cada parada vai na hora: o servidor refaz a figura na janela naquele instante
    lance({ t: ms });
    const n = paradas.current.length;
    if (n % ROLOS !== 0) {
      tocar('clique');
      return;
    }
    const ultimas = paradas.current.slice(-ROLOS);
    const [a, b, c] = ultimas.map((p, r) => rolos[r].figuras[posicaoNoRolo(rolos[r], p)]);
    const tipo = a === b && b === c ? 'trinca' : a === b || b === c || a === c ? 'par' : 'nada';
    if (tipo === 'trinca') setTrincas((x) => x + 1);
    setBrilho({ em: Date.now(), tipo });
    tocar(tipo === 'trinca' ? 'combo' : tipo === 'par' ? 'moeda' : 'clique');
  };
  useEffect(() => {
    if (ativo && agora - inicio >= TRINCA_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, agora - inicio >= TRINCA_MS]);
  useTeclas(ativo, (ev) => {
    if (!ehAperto(ev) && ev.key !== 'ArrowDown' && ev.key.toLowerCase() !== 's') return false;
    parar();
    return true;
  });

  // os rolos parados na tentativa de agora (ou na que acabou, enquanto dura a pausa)
  const n = paradas.current.length;
  const ultima = paradas.current[n - 1];
  const naPausa = n > 0 && n % ROLOS === 0 && e < ultima + PAUSA_MS;
  const daTentativa = naPausa ? paradas.current.slice(n - ROLOS) : paradas.current.slice(n - (n % ROLOS));
  const daVez = naPausa ? -1 : n % ROLOS;
  const brilhando = brilho && naPausa ? brilho.tipo : null;

  return (
    <Moldura placar={`★ × ${trincas}`} fracao={e / TRINCA_MS}>
      <svg
        viewBox="0 0 300 190"
        role="button"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          parar();
        }}
      >
        <rect x="0" y="0" width="300" height="190" rx="12" fill="#6fa356" />
        {/* o caixote de madeira com as três janelas */}
        <rect x="28" y="26" width="244" height="132" rx="10" fill="#a97c50" stroke="#6e4f38" strokeWidth="3" />
        <path d="M28 40 H272 M28 144 H272" stroke="#8e6a4a" strokeWidth="2" />
        <defs>
          <clipPath id="trinca-janela">
            <rect x="-30" y={MEIO - 54} width="60" height="108" rx="6" />
          </clipPath>
        </defs>
        {rolos.slice(0, ROLOS).map((rolo, r) => {
          const parada = daTentativa[r];
          // a figura que conta fica no meio; o rolo que gira anda para baixo
          const s = parada !== undefined ? Math.round(parada / rolo.passo) : Math.max(0, e) / rolo.passo;
          const base = Math.floor(s);
          const nFig = rolo.figuras.length;
          const desenho = [];
          for (let d = -2; d <= 2; d++) {
            const j = base + d;
            const y = MEIO + (s - j) * PASSO_Y;
            const tipo = rolo.figuras[((j % nFig) + nFig) % nFig];
            const Fig = FIGURA[tipo] ?? FIGURA[0];
            desenho.push(
              <g key={j} transform={`translate(0 ${y})`}>
                <Fig />
              </g>,
            );
          }
          const daVezAgora = r === daVez;
          return (
            <g key={r} transform={`translate(${ROLO_X[r]} 0)`}>
              <rect
                x="-31"
                y={MEIO - 55}
                width="62"
                height="110"
                rx="7"
                fill="#f4ede2"
                stroke={brilhando === 'trinca' ? '#f2c46a' : daVezAgora ? '#d9534f' : '#6e4f38'}
                strokeWidth={brilhando === 'trinca' || daVezAgora ? 4 : 2}
              />
              <g clipPath="url(#trinca-janela)">{desenho}</g>
              {/* a sombra de cima e de baixo, para o meio se destacar */}
              <rect x="-30" y={MEIO - 54} width="60" height="26" fill="#3a2e2a" opacity="0.18" />
              <rect x="-30" y={MEIO + 28} width="60" height="26" fill="#3a2e2a" opacity="0.18" />
              {parada !== undefined && <path d="M-30 64 H30 M-30 120 H30" stroke="#6e4f38" strokeWidth="1" opacity="0.5" />}
            </g>
          );
        })}
        {/* a faixa do meio, e as setas da linha que conta */}
        <path d="M30 92 l-8 -7 v14 Z M270 92 l8 -7 v14 Z" fill="#d9534f" />
        {brilhando === 'trinca' && (
          <g transform="translate(150 176)">
            {[-40, 0, 40].map((x) => (
              <path key={x} transform={`translate(${x} 0)`} d="M0 -10 L3 -3 L10 -3 L4 2 L6 9 L0 5 L-6 9 L-4 2 L-10 -3 L-3 -3 Z" fill="#f2c46a" />
            ))}
          </g>
        )}
      </svg>
    </Moldura>
  );
}

export default microjogoDaTela({
  id: 'trinca',
  nome: NOME,
  dica: chave('Pare os três rolos na mesma figura. Cada trinca vale um ponto.'),
  Tela: Trinca,
  valor: (v) => `★ × ${v}`,
  errouComValor: true,
});
