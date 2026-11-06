import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, menosMovimento, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { ate, AVISO_MS, CARGA, dePe, afundaEm, inicial, LARGURA, LINHAS, passo, pedraEm, PONTE_MS, type Coelho, type Riacho } from './ponteriacho-sim';

/**
 * A PONTE DO RIACHO (05/11/2026, server/src/festa/ponteriacho.ts): leve as três tábuas da margem até a ponte quebrada, pulando
 * pelas pedras que afundam e voltam. Setas (ou WASD), ou tocar na casa para onde ir. A regra é ./ponteriacho-sim.ts, a mesma do
 * servidor, que refaz cada passo.
 */

const CASA = 45;
const ALTURA = 34;
const TOPO = 22;
const W = (LARGURA + 2) * CASA;
const H = TOPO + LINHAS * ALTURA + 8;
const centro = (x: number, y: number) => ({ cx: x * CASA + CASA / 2, cy: TOPO + y * ALTURA + ALTURA / 2 });

function Tabua({ x, y, giro = 0 }: { x: number; y: number; giro?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <rect x="-15" y="-4" width="30" height="8" rx="2" fill="#b07a45" stroke="#7a5230" strokeWidth="1.2" />
      <path d="M-9 -1 L-3 -1 M3 1 L10 1" stroke="#7a5230" strokeWidth="1" />
    </g>
  );
}

function Ponte({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<Partial<Riacho>>) {
  const t = useT();
  const riacho: Riacho = { pedras: dados.pedras ?? [] };
  const [c, setC] = useState<Coelho>(inicial);
  const ref = useRef(c);
  ref.current = c;
  const [queda, setQueda] = useState<{ x: number; y: number; em: number } | null>(null);
  const agora = useRelogio(ativo);
  const e = Math.max(0, agora - inicio);
  const calmo = menosMovimento();

  // a pedra afundou debaixo do coelho: ele cai (o servidor vê a mesma queda no próximo passo)
  useEffect(() => {
    if (!ativo || riacho.pedras.length === 0) return;
    const depois = ate(riacho, ref.current, Math.round(e));
    if (depois !== ref.current) {
      setQueda({ x: ref.current.x, y: ref.current.y, em: Date.now() });
      ref.current = depois;
      setC(depois);
      tocar('agua');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  useEffect(() => {
    if (ativo && e >= PONTE_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= PONTE_MS]);

  const ir = (dx: number, dy: number) => {
    if (!ativo || riacho.pedras.length === 0) return;
    const antes = ref.current;
    const tempo = Math.round(Date.now() - inicio);
    const x = antes.x + dx;
    const y = antes.y + dy;
    const novo = passo(riacho, antes, x, y, tempo);
    if (!novo) return;
    ref.current = novo;
    setC(novo);
    lance({ x, y, t: tempo });
    if (novo.quedas > antes.quedas) {
      setQueda({ x, y, em: Date.now() });
      tocar('agua');
    } else if (novo.entregues > antes.entregues) {
      tocar(novo.entregues >= CARGA ? 'chegada' : 'acerto');
      if (novo.entregues >= CARGA) enviar({});
    } else if (novo.tabua && !antes.tabua) tocar('moeda');
    else tocar('pulo');
  };

  useTeclas(ativo, (ev) => {
    const k = ev.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') ir(-1, 0);
    else if (k === 'arrowright' || k === 'd') ir(1, 0);
    else if (k === 'arrowup' || k === 'w') ir(0, -1);
    else if (k === 'arrowdown' || k === 's') ir(0, 1);
    else return false;
    return true;
  });

  /** O toque: um passo na direção da casa tocada. */
  const tocarCasa = (x: number, y: number) => {
    const dx = x - ref.current.x;
    const dy = y - ref.current.y;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) >= Math.abs(dy)) ir(Math.sign(dx), 0);
    else ir(0, Math.sign(dy));
  };

  const naPilha = CARGA - c.entregues - (c.tabua ? 1 : 0);
  const eu = centro(c.x, c.y);
  const caindo = queda && Date.now() - queda.em < 500 ? queda : null;

  return (
    <Moldura placar={`🪵 × ${c.entregues}`} fracao={e / PONTE_MS}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)', touchAction: 'none' }}>
        {/* a água e as margens */}
        <rect x="0" y="0" width={W} height={H} rx="12" fill="#4f8fc0" />
        {!calmo &&
          [0, 1, 2, 3].map((k) => (
            <path
              key={k}
              d={`M${CASA + 10 + ((e / 30 + k * 60) % (LARGURA * CASA - 30))} ${TOPO + 18 + k * 42} q6 -4 12 0`}
              stroke="#8cc0e6"
              strokeWidth="2"
              fill="none"
            />
          ))}
        <rect x="0" y="0" width={CASA} height={H} rx="12" fill="#6fa356" />
        <rect x={CASA - 12} y="0" width="12" height={H} fill="#6fa356" />
        <rect x={W - CASA} y="0" width={CASA} height={H} rx="12" fill="#6fa356" />
        <rect x={W - CASA} y="0" width="12" height={H} fill="#6fa356" />
        {/* a pilha de tábuas na margem da esquerda */}
        {Array.from({ length: naPilha }, (_, k) => (
          <Tabua key={k} x={CASA / 2} y={H - 12 - k * 9} />
        ))}
        {/* a ponte quebrada na da direita: um vão por tábua, coberto pelas que chegaram */}
        <rect x={W - CASA + 4} y={TOPO - 18} width={CASA - 8} height="14" rx="3" fill="#5b4632" opacity="0.35" />
        {Array.from({ length: CARGA }, (_, k) => (
          <g key={k}>
            <rect x={W - CASA + 6 + k * 12} y={TOPO - 17} width="9" height="12" rx="2" fill={k < c.entregues ? '#b07a45' : '#2f5f86'} stroke="#7a5230" strokeWidth="1" />
          </g>
        ))}
        {/* as pedras */}
        {Array.from({ length: LINHAS }, (_, y) =>
          Array.from({ length: LARGURA }, (_, i) => {
            const x = i + 1;
            const p = pedraEm(riacho, x, y);
            if (!p) return null;
            const { cx, cy } = centro(x, y);
            const firme = p.p === 0;
            const emPe = dePe(riacho, x, y, Math.round(e));
            const falta = emPe ? afundaEm(riacho, x, y, Math.round(e)) - e : Infinity;
            const treme = !firme && falta < AVISO_MS;
            const dx = treme && !calmo ? (Math.floor(e / 60) % 2 ? 1.5 : -1.5) : 0;
            return emPe ? (
              <g key={`${x}-${y}`} transform={`translate(${cx + dx} ${cy}) scale(${treme ? 0.85 : 1})`}>
                <ellipse cx="0" cy="3" rx="17" ry="9" fill="#2f5f86" opacity="0.5" />
                <ellipse cx="0" cy="0" rx="16" ry="10" fill={firme ? '#7f9a5c' : treme ? '#7d6a62' : '#c2bbb2'} stroke="#6e6760" strokeWidth="1.5" />
                {firme && <path d="M-8 -3 q4 -4 8 0 q4 -4 8 0" stroke="#6fa356" strokeWidth="2.5" fill="none" />}
              </g>
            ) : (
              <ellipse key={`${x}-${y}`} cx={cx} cy={cy + 2} rx="11" ry="5" fill="none" stroke="#8cc0e6" strokeWidth="2" />
            );
          }),
        )}
        {/* o respingo da queda */}
        {caindo && (
          <g transform={`translate(${centro(caindo.x, caindo.y).cx} ${centro(caindo.x, caindo.y).cy})`}>
            <circle r={8 + (Date.now() - caindo.em) / 25} fill="none" stroke="#dff0fb" strokeWidth="3" opacity={1 - (Date.now() - caindo.em) / 500} />
          </g>
        )}
        {/* o coelho, com a tábua em cima da cabeça */}
        <g transform={`translate(${eu.cx} ${eu.cy + 6})`}>
          <CoelhoDeFrente escala={0.75} />
          {c.tabua && <Tabua x={0} y={-36} />}
        </g>
        {c.entregues >= CARGA && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="40" aria-hidden="true">
            ✔
          </text>
        )}
        {/* as casas, para o toque */}
        {Array.from({ length: LINHAS }, (_, y) =>
          Array.from({ length: LARGURA + 2 }, (_, x) => (
            <rect
              key={`t${x}-${y}`}
              x={x * CASA}
              y={TOPO + y * ALTURA}
              width={CASA}
              height={ALTURA}
              fill="transparent"
              onPointerDown={(ev) => {
                ev.preventDefault();
                tocarCasa(x, y);
              }}
            />
          )),
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Ponte do riacho');

export default microjogoDaTela({
  id: 'ponteriacho',
  nome: NOME,
  dica: chave('Leve as três tábuas até a ponte. Cuidado com as pedras que afundam!'),
  Tela: Ponte,
  valor: (v) => `🪵 × ${v}`,
  errouComValor: true,
});
