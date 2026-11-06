import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, FaixaDasEquipes, menosMovimento, microjogoDaTela, Moldura, useAoVivo, useRelogio, useTeclas, type PropsDoMicro, type TurmaNaTela } from './comum';
import { alturaDaAbobora, ERGUIDA_MS, FAIXAS, faixaInicial, META, PASSO_MS, rolaEm, subir, TOPO, TROCA_MS, type Abobora, type Troca } from './ladeira-sim';

/**
 * ABÓBORAS LADEIRA ABAIXO (lote 6, 05/11/2026, server/src/festa/ladeira.ts): um contra três. O grupo sobe a ladeira sozinho,
 * cada um na sua faixa, e troca de faixa para fugir; o solitário, lá em cima, ergue e solta abóboras. A conta de quem a abóbora
 * pega é ./ladeira-sim.ts, a mesma do servidor: a tela a faz na hora, e o servidor a refaz.
 */

// Os mesmos números do servidor.
const LADEIRA_MS = 20000;
const ENTRE_ABOBORAS = 350;
const PRIMEIRA_ABOBORA = 600;
const aboborasPara = (grupo: number) => (grupo <= 1 ? 20 : grupo === 2 ? 22 : 26);

interface Dados {
  solo?: number;
  grupo?: number[];
  aboboras?: Abobora[];
  trocas?: Record<string, Troca[]>;
  turma?: TurmaNaTela;
}
type Quadro = { aboboras: Abobora[]; trocas: Record<string, Troca[]> };

// O desenho: a ladeira vista de baixo, três faixas, a chegada lá em cima e o solitário acima dela.
const X_FAIXA = [100, 150, 200];
const Y_PE = 188;
const Y_META = 52;
const telaY = (y: number) => Y_PE - ((Y_PE - Y_META) * y) / META;

function AboboraDesenho({ x, y, giro, r = 9 }: { x: number; y: number; giro: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <ellipse cx="0" cy="0" rx={r} ry={r * 0.85} fill="#e8892e" stroke="#a5561a" strokeWidth="1.2" />
      <path d={`M0 ${-r * 0.85} Q${r * 0.5} 0 0 ${r * 0.85} M0 ${-r * 0.85} Q${-r * 0.5} 0 0 ${r * 0.85}`} stroke="#c06a22" strokeWidth="1" fill="none" />
      <path d={`M0 ${-r * 0.8} l1 -4`} stroke="#5d8f47" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

function Seta({ x, y }: { x: number; y: number }) {
  return <path transform={`translate(${x} ${y})`} d="M-5 -7 L5 -7 L0 0 Z" fill="#f2c46a" stroke="#9a6a1e" strokeWidth="1" />;
}

function Ladeira({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const eu = dados.turma?.eu ?? 0;
  const grupo = dados.grupo ?? [];
  const papel = dados.solo === eu ? 'solo' : grupo.includes(eu) ? 'grupo' : null;

  // as abóboras e as trocas: o que veio pelo estado e o que veio pelos quadros ao vivo (o que tiver mais, vale)
  const [doQuadro, setDoQuadro] = useState<Quadro>({ aboboras: [], trocas: {} });
  const mandar = useAoVivo<Quadro>('ladeira', ativo, lance, (q) => setDoQuadro(q.q));
  const doServidor = (dados.aboboras?.length ?? 0) >= doQuadro.aboboras.length ? (dados.aboboras ?? []) : doQuadro.aboboras;
  const trocasDe = (id: number) => {
    const a = dados.trocas?.[id] ?? [];
    const b = doQuadro.trocas[id] ?? [];
    return a.length >= b.length ? a : b;
  };

  // o solitário vê a abóbora erguida na hora (a do servidor, carimbada, a substitui quando chega)
  const [minhas, setMinhas] = useState<Abobora[]>([]);
  const pendentes = minhas.filter((o) => e - o.l < 1500 && !doServidor.some((s) => s.faixa === o.faixa && s.l >= o.l - 50 && s.l - o.l < 1200));
  const aboboras = [...doServidor, ...pendentes];
  const restantes = Math.max(0, aboborasPara(grupo.length) - aboboras.length);

  // quem sobe: eu com as minhas trocas (na hora), os outros um pouco atrás (as trocas deles ainda estão chegando)
  const [meus, setMeus] = useState<Troca[]>([]);
  const subidas = grupo.map((id, k) => subir(aboboras, id === eu ? meus : trocasDe(id), id === eu ? e : Math.max(0, e - 150), faixaInicial(k), grupo.length));
  const minha = papel === 'grupo' ? subidas[grupo.indexOf(eu)] : null;
  const chegaram = subidas.filter((c) => c.chegou !== null).length;

  const batidas = useRef(0);
  useEffect(() => {
    if (minha && minha.batidas > batidas.current) {
      batidas.current = minha.batidas;
      tocar('soco');
    }
  }, [minha?.batidas]);
  const chegou = useRef(false);
  useEffect(() => {
    if (minha?.chegou != null && !chegou.current) {
      chegou.current = true;
      tocar('chegada');
    }
  }, [minha?.chegou]);

  const fim = e >= LADEIRA_MS;
  useEffect(() => {
    if (ativo && fim) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, fim]);

  const podeSoltar = () => {
    if (!ativo || papel !== 'solo' || fim || e < PRIMEIRA_ABOBORA || restantes <= 0 || e + ERGUIDA_MS > LADEIRA_MS - 800) return false;
    const ultima = aboboras.reduce((m, o) => Math.max(m, o.l), -1e9);
    return e - ultima >= ENTRE_ABOBORAS + 50;
  };
  const soltar = (faixa: number) => {
    if (!podeSoltar()) return;
    setMinhas((l) => [...l, { l: e, faixa }]);
    tocar('clique');
    mandar({ faixa });
  };
  const trocar = (lado: -1 | 1) => {
    if (!ativo || papel !== 'grupo' || !minha || fim || minha.chegou !== null) return;
    if (e < minha.tonto || e < minha.trocaAte) return;
    const faixa = minha.faixa + lado;
    if (faixa < 0 || faixa >= FAIXAS) return;
    const tr = { t: Math.round(e), faixa };
    setMeus((l) => [...l, tr]);
    tocar('pulo');
    mandar(tr);
  };
  useTeclas(ativo, (ev) => {
    if (papel === 'solo') {
      const f = { '1': 0, '2': 1, '3': 2, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2, a: 0, s: 1, d: 2 }[ev.key];
      if (f === undefined) return false;
      soltar(f);
      return true;
    }
    if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') return trocar(-1), true;
    if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') return trocar(1), true;
    return false;
  });

  const calmo = menosMovimento();
  const s = Math.floor(e / PASSO_MS);
  const xDe = (c: (typeof subidas)[number]) => {
    // no meio da troca, a meio caminho entre as duas faixas
    const p = c.trocaAte > e ? 1 - (c.trocaAte - e) / TROCA_MS : 1;
    return X_FAIXA[c.veio] + (X_FAIXA[c.faixa] - X_FAIXA[c.veio]) * Math.min(1, Math.max(0, p));
  };

  return (
    <Moldura placar={papel === 'solo' ? `🎃 × ${restantes}` : `🏁 × ${chegaram}`} fracao={e / LADEIRA_MS}>
      <FaixaDasEquipes turma={dados.turma} />
      <svg
        viewBox="0 0 300 200"
        role="group"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          const caixa = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((ev.clientX - caixa.left) / caixa.width) * 300;
          if (papel === 'solo') soltar(x < 125 ? 0 : x < 175 ? 1 : 2);
          else if (papel === 'grupo' && minha) trocar(x < xDe(minha) ? -1 : 1);
        }}
      >
        {/* o céu, a ladeira e as três faixas */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#cfe6ef" />
        <path d="M0 200 L60 30 L240 30 L300 200 Z" fill="#7cae5e" />
        {X_FAIXA.map((x, k) => (
          <g key={k}>
            <path d={`M${x - 22} ${Y_PE + 12} L${x - 18} 30 L${x + 18} 30 L${x + 22} ${Y_PE + 12} Z`} fill={k === 1 ? '#8fbf6c' : '#86b864'} />
            {[0, 1, 2, 3, 4, 5].map((n) => {
              const y = 40 + n * 28 + ((calmo ? 0 : 0) % 28);
              return <path key={n} d={`M${x - 10} ${y} q10 -4 20 0`} stroke="#6f9f52" strokeWidth="1.2" fill="none" />;
            })}
          </g>
        ))}
        {/* a chegada: a cerquinha com a bandeira */}
        <rect x="74" y={Y_META - 3} width="152" height="4" fill="#f4ead8" />
        {[80, 110, 140, 170, 200, 220].map((x) => (
          <rect key={x} x={x} y={Y_META - 9} width="3" height="10" fill="#e8dccb" />
        ))}
        <path d={`M232 ${Y_META} L232 ${Y_META - 24} L248 ${Y_META - 18} L232 ${Y_META - 12}`} fill="#e0604f" stroke="#7a2a1a" strokeWidth="1" />

        {/* o solitário lá em cima, com a pilha de abóboras */}
        <g>
          <CoelhoDeFrente x={262} y={30} escala={0.8} />
          {papel === 'solo' && <Seta x={262} y={-2} />}
          {Array.from({ length: Math.min(6, restantes) }, (_, k) => (
            <AboboraDesenho key={k} x={250 + (k % 3) * 12} y={44 - Math.floor(k / 3) * 9} giro={k * 30} r={6} />
          ))}
        </g>

        {/* as abóboras: erguidas (tremendo um pouco) e rolando */}
        {aboboras.map((a, i) => {
          if (e < a.l) return null;
          const x = X_FAIXA[a.faixa];
          if (s < rolaEm(a)) {
            const treme = calmo ? 0 : Math.sin(e / 30) * 1.5;
            return <AboboraDesenho key={`${a.l}-${i}`} x={x + treme} y={telaY(TOPO) - 4} giro={0} r={10} />;
          }
          const y = alturaDaAbobora(a, s);
          if (y < -12_000) return null;
          return <AboboraDesenho key={`${a.l}-${i}`} x={x} y={telaY(y) - 4} giro={calmo ? 0 : (s - rolaEm(a)) * 9} r={10} />;
        })}

        {/* quem sobe (eu por último, por cima) */}
        {grupo
          .map((id, k) => [id, k] as const)
          .sort((a, b) => (a[0] === eu ? 1 : 0) - (b[0] === eu ? 1 : 0))
          .map(([id, k]) => {
            const c = subidas[k];
            const x = xDe(c);
            const y = telaY(c.y);
            const tonto = e < c.tonto;
            return (
              <g key={id} opacity={id === eu || papel !== 'grupo' ? 1 : 0.8}>
                <ellipse cx={x} cy={y + 1} rx="9" ry="3" fill="rgba(0,0,0,0.18)" />
                <CoelhoDeFrente x={x} y={y - (tonto || calmo ? 0 : Math.abs(Math.sin(e / 90)) * 2)} escala={0.62} olhos={tonto ? 'tontos' : 'abertos'} />
                {id === eu && <Seta x={x} y={y - 28} />}
                {c.chegou !== null && <path transform={`translate(${x} ${y - 30})`} d="M0 -6 L2 -2 L6 -2 L3 1 L4 5 L0 3 L-4 5 L-3 1 L-6 -2 L-2 -2 Z" fill="#f2c46a" />}
              </g>
            );
          })}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Abóboras ladeira abaixo');

export default microjogoDaTela({
  id: 'ladeira',
  nome: NOME,
  dica: chave('Lá de cima rolam abóboras; quem sobe troca de faixa para fugir delas!'),
  Tela: Ladeira,
  valor: (v) => `🏁 × ${v}`,
  errouComValor: true,
});
