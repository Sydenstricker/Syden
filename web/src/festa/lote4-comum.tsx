import { useEffect, useRef } from 'react';
import { CoelhoDeFrente } from './comum';

/**
 * O QUE AS TELAS DE TURNO E DE EQUIPE DO LOTE 4 USAM (05/11/2026): entrar na turma, a fila da turma e as cores. NÃO é um
 * microjogo (o registro não o lista). A regra do lado do servidor está em server/src/festa/lote4-turma.ts.
 *
 * A tela não sabe o nome de ninguém (o microjogo só recebe os dados): a turma aparece como coelhos de cores diferentes, na
 * ordem das vezes, e o MEU com a estrela em cima.
 */

/** As cores da turma, na ordem das vezes (ou das equipes). */
export const COR_DA_TURMA = ['#e07a2e', '#5b8fc9', '#6fa356', '#c95b9a', '#c9a35b', '#7a5bc9', '#5bc9b8', '#c95b5b'];

/** Manda o `{ entrar: 1 }` assim que o jogo começa nesta tela (uma vez; de novo se a tela for remontada, o que não faz mal). */
export function useEntrar(ativo: boolean, inicio: number, agora: number, lance: (corpo: Record<string, unknown>) => void) {
  const entrou = useRef(false);
  const comecou = agora >= inicio;
  useEffect(() => {
    if (ativo && comecou && !entrou.current) {
      entrou.current = true;
      lance({ entrar: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, comecou]);
}

/**
 * A CONTAGEM AO VIVO (o Cabo e a Torta): o total de apertos válidos desta tela, mandado a cada 200 ms se mudou, com o instante
 * do último (`{ n, t }`, ver `contar` no servidor). Devolve a função de somar um aperto e o total.
 */
export function useContagem(ativo: boolean, inicio: number, lance: (corpo: Record<string, unknown>) => void) {
  const total = useRef({ n: 0, t: 0, mandado: 0 });
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => {
      const c = total.current;
      if (c.n === c.mandado) return;
      c.mandado = c.n;
      lance({ n: c.n, t: c.t });
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);
  const somar = () => {
    total.current.n++;
    total.current.t = Math.round(Date.now() - inicio);
    return total.current.n;
  };
  return { somar, total: () => total.current.n };
}

/** Um coelho pequeno, com a cor da turma no lenço do pescoço. */
export function CoelhoDaTurma({ x, y, cor, escala = 0.6, apagado = false }: { x: number; y: number; cor: string; escala?: number; apagado?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={apagado ? 0.35 : 1}>
      <CoelhoDeFrente escala={escala} />
      <path d={`M${-8 * escala} ${-1 * escala} L${8 * escala} ${-1 * escala} L0 ${7 * escala} Z`} fill={cor} />
    </g>
  );
}

/**
 * A FILA DA TURMA: um coelho por pessoa, na ordem das vezes, com um texto curto embaixo (as cenouras, o 🦊…); a vez marcada
 * pela seta e pela barra do tempo dela, e o meu pela estrela.
 */
export function FilaDaTurma({
  turma,
  eu,
  fracaoDaVez = 0,
}: {
  turma: { texto: string; apagado?: boolean; vez?: boolean }[];
  eu: number;
  fracaoDaVez?: number;
}) {
  const passo = 300 / Math.max(4, turma.length);
  return (
    <svg viewBox="0 0 300 62" aria-hidden="true" style={{ width: 'min(92vw, 460px)' }}>
      {turma.map((p, k) => {
        const x = passo * k + passo / 2;
        return (
          <g key={k}>
            {p.vez && <rect x={x - passo / 2 + 3} y="2" width={passo - 6} height="58" rx="8" fill="#f2c46a33" stroke="#f2c46a" strokeWidth="2" />}
            {p.vez && (
              <rect x={x - passo / 2 + 8} y="55" width={Math.max(0, Math.min(1, fracaoDaVez)) * (passo - 16)} height="3" rx="1.5" fill="#f2c46a" />
            )}
            {k === eu && <path transform={`translate(${x + 14} 12)`} d="M0 -6 L1.8 -1.8 L6 -1.8 L2.6 1 L3.8 5.4 L0 2.8 L-3.8 5.4 L-2.6 1 L-6 -1.8 L-1.8 -1.8 Z" fill="#f2c46a" stroke="#a87b1e" strokeWidth="0.8" />}
            <CoelhoDaTurma x={x} y={36} cor={COR_DA_TURMA[k % COR_DA_TURMA.length]} apagado={p.apagado} />
            <text x={x} y="51" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">
              {p.texto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
