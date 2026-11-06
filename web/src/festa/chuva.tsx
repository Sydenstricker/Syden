import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, microjogoDaTela, Moldura, useRelogio, type PropsDoMicro } from './comum';
import { Cenoura, piscando, useDirecao } from './lote2comum';

/**
 * CHUVA DE CENOURAS (05/11/2026, server/src/festa/chuva.ts): o coelho desce da árvore pendurado numa folha, de um lado para o
 * outro, pegando cenouras e fugindo das pedras. O chão sobe na tela (é ele que desce). Cada cenoura vai na hora, com onde ele
 * estava; a pedra é desta tela (quem leva diz).
 */

// Os mesmos números do servidor.
const CHUVA_MS = 20000;
const CHUVA_VX = 150;
const X0 = 22;
const X1 = 278;
const CUSTO_DA_PEDRA = 2;
const PEDRA = 2;
const DOURADA = 1;
const VALOR = [1, 3, 0];
/** Só na tela: onde o coelho fica, quanto o mundo sobe por segundo, e de quão perto se pega (menos que o servidor aceita). */
const Y_DO_COELHO = 70;
const SOBE = 95;
const PEGA_X = 16;
const PEGA_MS = 110;
const TONTO_MS = 700;

interface Item {
  t: number;
  x: number;
  tipo: number;
}

function Pedra() {
  return (
    <g>
      <path d="M-9 4 L-7 -6 L1 -9 L9 -4 L8 6 L-2 9 Z" fill="#8d8478" stroke="#5c554d" strokeWidth="1.5" />
      <path d="M-4 -4 L2 -6" stroke="#b5ab9e" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function Chuva({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ itens?: Item[] }>) {
  const t = useT();
  const itens = dados.itens ?? [];
  const { svg, ponteiro, ler } = useDirecao(ativo);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const coelho = useRef({ x: 150, antes: 0, tonto: 0 });
  const [pegos, setPegos] = useState<number[]>([]);
  const [pedras, setPedras] = useState<number[]>([]);
  const fim = useRef(false);

  useEffect(() => {
    if (!ativo || fim.current) return;
    const c = coelho.current;
    const dt = Math.min(0.05, Math.max(0, (agora - (c.antes || agora)) / 1000));
    c.antes = agora;
    if (e < 0) return;
    if (e >= CHUVA_MS) {
      fim.current = true;
      tocar('fim');
      enviar({});
      return;
    }
    if (e >= c.tonto) {
      const [dx] = ler([c.x, Y_DO_COELHO], 3);
      c.x = Math.min(X1, Math.max(X0, c.x + dx * CHUVA_VX * dt));
    }
    const ms = Math.round(e);
    itens.forEach((it, i) => {
      if (Math.abs(it.t - e) > PEGA_MS || Math.abs(it.x - c.x) > PEGA_X || pegos.includes(i) || pedras.includes(i)) return;
      if (it.tipo === PEDRA) {
        if (e < c.tonto) return;
        // a pedra: quem leva diz
        c.tonto = e + TONTO_MS;
        setPedras((l) => [...l, i]);
        tocar('queda');
        lance({ i, t: ms, pedra: true });
        return;
      }
      setPegos((l) => (l.includes(i) ? l : [...l, i]));
      tocar(it.tipo === DOURADA ? 'combo' : 'moeda');
      lance({ i, t: ms, x: Math.round(c.x * 10) / 10 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  const c = coelho.current;
  const pontos = Math.max(0, pegos.reduce((s, i) => s + VALOR[itens[i].tipo], 0) - CUSTO_DA_PEDRA * pedras.length);
  // o tronco da árvore passa pelos lados, subindo: as listras andam com o mundo
  const desce = (e * SOBE) / 1000;
  return (
    <Moldura placar={`🥕 × ${pontos}`} fracao={e / CHUVA_MS}>
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="img"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'ew-resize' : 'default' }}
        {...ponteiro}
      >
        <defs>
          <linearGradient id="chuva-ceu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8d4ee" />
            <stop offset="1" stopColor="#d9eef5" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="200" rx="12" fill="url(#chuva-ceu)" />
        {/* as folhas da árvore dos dois lados, subindo */}
        {Array.from({ length: 8 }, (_, k) => {
          const y = ((k * 60 - desce) % 240 + 240) % 240 - 20;
          const lado = k % 2 ? 300 : 0;
          return <ellipse key={k} cx={lado} cy={y} rx="26" ry="14" fill={k % 3 ? '#7cb85a' : '#6aa64c'} opacity="0.8" />;
        })}
        {/* as nuvenzinhas ao longe */}
        {[0, 1, 2].map((k) => {
          const y = ((k * 90 - desce * 0.4) % 270 + 270) % 270 - 30;
          return <ellipse key={k} cx={70 + k * 80} cy={y} rx="22" ry="7" fill="#fff" opacity="0.6" />;
        })}
        {itens.map((it, i) => {
          if (pegos.includes(i) || pedras.includes(i)) return null;
          const y = Y_DO_COELHO + ((it.t - e) * SOBE) / 1000;
          if (y < -15 || y > 215) return null;
          return (
            <g key={i} transform={`translate(${it.x} ${y})`}>
              {it.tipo === PEDRA ? <Pedra /> : <Cenoura escala={it.tipo === DOURADA ? 1.15 : 0.9} dourada={it.tipo === DOURADA} />}
            </g>
          );
        })}
        {/* o coelho pendurado na folha */}
        {!piscando(e, c.tonto) && (
          <g transform={`translate(${c.x} ${Y_DO_COELHO}) rotate(${e < c.tonto ? Math.sin(e / 40) * 15 : 0})`}>
            <path d="M-22 -30 Q0 -48 22 -30 Q0 -36 -22 -30 Z" fill="#6fb34e" stroke="#3f7a32" strokeWidth="1.5" />
            <path d="M0 -44 L0 -30" stroke="#3f7a32" strokeWidth="1.5" />
            <path d="M-14 -31 L-4 -10 M14 -31 L4 -10" stroke="#7a5238" strokeWidth="1.2" />
            <ellipse cx="0" cy="6" rx="8" ry="7" fill="#e8dccb" />
            <CoelhoDeFrente y={2} escala={0.75} olhos={e < c.tonto ? 'tontos' : 'abertos'} />
          </g>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Chuva de cenouras');

export default microjogoDaTela({
  id: 'chuva',
  nome: NOME,
  dica: chave('Desça pegando as cenouras. Das pedras, fuja!'),
  Tela: Chuva,
  valor: (v) => `🥕 × ${v}`,
  errouComValor: true,
});
