import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { COR_DA_TURMA, FilaDaTurma, useEntrar } from './lote4-comum';

/**
 * AS CARTAS DO CELEIRO (05/11/2026, server/src/festa/celeiro.ts): em turnos, cada um vira uma carta (cenoura, a dourada, ou a
 * raposa, que leva tudo e tira do jogo) ou guarda o que juntou. Clique ou toque na carta; no teclado, as setas e Enter, e G para
 * guardar.
 */

interface Vista {
  cartas?: number;
  viradas?: { i: number; tipo: number; quem: number }[];
  turma?: { cenouras: number; fora: 'raposa' | 'guardou' | null }[];
  vez?: number;
  n?: number;
  eu?: number;
  restaMs?: number;
}

const COLUNAS = 4;
const RAPOSA = 0;
/** O tempo de cada vez (o mesmo do servidor). */
const VEZ_MS = 4500;

function Raposa() {
  return (
    <g>
      <path d="M-14 -10 L-8 -22 L-3 -11 Z M14 -10 L8 -22 L3 -11 Z" fill="#d9772e" />
      <path d="M-15 -10 Q0 -16 15 -10 L0 12 Z" fill="#e8873a" />
      <path d="M-9 0 Q0 4 9 0 L0 12 Z" fill="#f5e6d3" />
      <circle cx="-5" cy="-4" r="1.8" fill="#2a2a2a" />
      <circle cx="5" cy="-4" r="1.8" fill="#2a2a2a" />
      <circle cx="0" cy="11" r="2" fill="#2a2a2a" />
    </g>
  );
}

export function Cenoura({ dourada = false, escala = 1 }: { dourada?: boolean; escala?: number }) {
  return (
    <g transform={`scale(${escala})`}>
      <path d="M-7 -6 L7 -6 L0 16 Z" fill={dourada ? '#f2c046' : '#e07a2e'} stroke={dourada ? '#c79a1e' : 'none'} strokeWidth="1" />
      <path d="M-3 -6 L-7 -15 M0 -6 L0 -17 M3 -6 L7 -15" stroke="#6fa356" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Celeiro({ dados, inicio, ativo, lance }: PropsDoMicro<Vista>) {
  const t = useT();
  const cartas = dados.cartas ?? 12;
  const viradas = dados.viradas ?? [];
  const turma = dados.turma ?? [];
  const vez = dados.vez ?? -1;
  const n = dados.n ?? 0;
  const eu = dados.eu ?? -1;
  const minhaVez = ativo && vez >= 0 && vez === eu;
  const [cursor, setCursor] = useState(0);
  const [mandei, setMandei] = useState(-1);
  const agora = useRelogio(ativo);

  // entrar na turma assim que o jogo começa
  useEntrar(ativo, inicio, agora, lance);

  // o relógio da vez, a partir de quando ela chegou aqui
  const [vezDesde, setVezDesde] = useState({ n: -1, em: 0, resta: 0 });
  useEffect(() => {
    setVezDesde({ n, em: Date.now(), resta: dados.restaMs ?? 0 });
    if (minhaVez) tocar('vez');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // o som de cada carta virada
  const ouvidas = useRef(0);
  useEffect(() => {
    if (viradas.length > ouvidas.current) {
      const ultima = viradas[viradas.length - 1];
      tocar(ultima.tipo === RAPOSA ? 'erro' : ultima.tipo > 1 ? 'moeda' : 'carta');
    }
    ouvidas.current = viradas.length;
  }, [viradas]);

  const podeAgir = minhaVez && mandei !== n;
  const virar = (i: number) => {
    if (!podeAgir || viradas.some((v) => v.i === i)) return;
    setMandei(n);
    lance({ vira: i, n });
  };
  const guardar = () => {
    if (!podeAgir) return;
    setMandei(n);
    tocar('clique');
    lance({ guarda: 1, n });
  };

  useTeclas(ativo, (ev) => {
    const k = ev.key.toLowerCase();
    const linhas = Math.ceil(cartas / COLUNAS);
    if (k === 'arrowleft') setCursor((c) => (c + cartas - 1) % cartas);
    else if (k === 'arrowright') setCursor((c) => (c + 1) % cartas);
    else if (k === 'arrowup') setCursor((c) => (c + cartas - COLUNAS) % cartas);
    else if (k === 'arrowdown') setCursor((c) => (c + COLUNAS) % (COLUNAS * linhas) % cartas);
    else if (k === 'enter' || k === ' ') virar(cursor);
    else if (k === 'g' || k === 'backspace') guardar();
    else return false;
    return true;
  });

  const resta = vez >= 0 && vezDesde.n === n ? Math.max(0, vezDesde.resta - (agora - vezDesde.em)) : 0;
  const minhas = eu >= 0 ? turma[eu] : undefined;

  return (
    <div className="festa-alvo">
      <FilaDaTurma
        turma={turma.map((p, k) => ({
          texto: p.fora === 'raposa' ? '🦊' : `🥕${p.cenouras}${p.fora === 'guardou' ? ' 🧺' : ''}`,
          apagado: p.fora === 'raposa',
          vez: k === vez,
        }))}
        eu={eu}
        fracaoDaVez={vez >= 0 ? resta / VEZ_MS : 0}
      />
      <svg viewBox="0 0 300 190" role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)', touchAction: 'none' }}>
        <rect x="0" y="0" width="300" height="190" rx="12" fill="#a8553a" />
        <path d="M0 0 L150 -30 L300 0" fill="none" />
        {/* as tábuas do celeiro */}
        {[38, 76, 114, 152].map((y) => (
          <path key={y} d={`M8 ${y} L292 ${y}`} stroke="#8e432c" strokeWidth="2" />
        ))}
        {Array.from({ length: cartas }, (_, i) => {
          const x = 22 + (i % COLUNAS) * 66;
          const y = 10 + Math.floor(i / COLUNAS) * 60;
          const v = viradas.find((c) => c.i === i);
          const escolhida = podeAgir && cursor === i && !v;
          return (
            <g
              key={i}
              transform={`translate(${x} ${y})`}
              style={{ cursor: podeAgir && !v ? 'pointer' : 'default' }}
              onPointerDown={(ev) => {
                ev.preventDefault();
                setCursor(i);
                virar(i);
              }}
            >
              <rect
                width="58"
                height="52"
                rx="6"
                fill={v ? (v.tipo === RAPOSA ? '#f3d9c4' : '#f6efdc') : '#5b8fc9'}
                stroke={escolhida ? '#f2c46a' : '#2f4f72'}
                strokeWidth={escolhida ? 4 : 2}
              />
              {!v && <path d="M10 10 L48 42 M48 10 L10 42" stroke="#4a78ab" strokeWidth="3" />}
              {v && (
                <g transform="translate(29 28)">
                  {v.tipo === RAPOSA ? (
                    <Raposa />
                  ) : v.tipo > 1 ? (
                    <>
                      <Cenoura dourada escala={1.1} />
                      <text x="16" y="16" fontSize="12" fontWeight="700" fill="#8a6a10">
                        ×{v.tipo}
                      </text>
                    </>
                  ) : (
                    <Cenoura />
                  )}
                </g>
              )}
              {v && (
                <circle cx="52" cy="6" r="6" fill={COR_DA_TURMA[v.quem % COR_DA_TURMA.length]} stroke="#fff" strokeWidth="1.5" />
              )}
            </g>
          );
        })}
      </svg>
      {/* guardar: a cesta com o que juntou */}
      <button
        type="button"
        className="festa-mostrador"
        disabled={!podeAgir}
        onPointerDown={(ev) => {
          ev.preventDefault();
          guardar();
        }}
        style={{ alignSelf: 'center', fontSize: '1.2em', padding: '6px 16px', opacity: podeAgir ? 1 : 0.5, cursor: podeAgir ? 'pointer' : 'default' }}
      >
        🧺 🥕 × {minhas?.cenouras ?? 0}
      </button>
    </div>
  );
}

const NOME = chave('Cartas do celeiro');

export default microjogoDaTela({
  id: 'celeiro',
  nome: NOME,
  dica: chave('Na sua vez, vire uma carta ou guarde as cenouras. A raposa leva tudo!'),
  Tela: Celeiro,
  valor: (v) => `🥕 × ${v}`,
  errouComValor: true,
});
