import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, CORES_DAS_EQUIPES, FaixaDasEquipes, LinhaDoTempo, menosMovimento, microjogoDaTela, Moldura, useAoVivo, useRelogio, type PropsDoMicro, type TurmaNaTela } from './comum';

/**
 * BALSA A DOIS (lote 5, 05/11/2026; server/src/festa/remada.ts): cada dupla desce o seu riacho numa balsa, um remo de cada lado.
 * A balsa é do servidor (é de dois): cada remada é um pedido, e a balsa responde no quadro seguinte. A tela mostra o riacho da
 * MINHA dupla, e em cima o placar de todas.
 *
 * Teclado: na dupla, Espaço (ou qualquer seta) rema do meu lado. Sozinho na balsa: ← vai para a esquerda (rema na direita),
 * → para a direita. Toque: na dupla, tocar rema; sozinho, tocar à esquerda ou à direita da balsa.
 */

// Os mesmos números do servidor.
const REMADA_MS = 22000;
const MARGEM_ESQ = 40;
const MARGEM_DIR = 260;
const ESPERA_REMADA = 220;
/** Onde a balsa fica na tela (o riacho passa por ela). */
const BALSA_Y = 150;

interface Dados {
  cenouras?: [number, number][];
  lados?: { esq: number; dir: number }[];
  turma?: TurmaNaTela;
}
/** b = por equipe [x, y, vx, pontos, última remada da esquerda, da direita] (ms desde o começo); c = as cenouras pegas. */
interface Quadro {
  b: number[][];
  c: number[][];
}

function Remada({ dados, inicio, ativo, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const turma = dados.turma;
  const eu = turma?.eu ?? 0;
  const lados = dados.lados ?? [];
  const cenouras = dados.cenouras ?? [];
  const eq = lados.findIndex((l) => l.esq === eu || l.dir === eu);
  const meus = lados[eq];
  const so = !!meus && meus.esq === meus.dir;
  const meuLado: 'esq' | 'dir' = meus?.esq === eu ? 'esq' : 'dir';
  const linha = useRef(new LinhaDoTempo<Quadro>()).current;
  const [, setN] = useState(0);
  const mandar = useAoVivo<Quadro>('remada', ativo, lance, (q) => {
    linha.chegou(q);
    setN((n) => n + 1);
  });
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const remei = useRef<Record<'esq' | 'dir', number>>({ esq: -1e9, dir: -1e9 });
  const svg = useRef<SVGSVGElement | null>(null);
  const quieto = menosMovimento();

  const remar = (lado: 'esq' | 'dir') => {
    if (!ativo || e < 0 || e > REMADA_MS || e - remei.current[lado] < ESPERA_REMADA) return;
    remei.current[lado] = e;
    mandar({ tipo: 'rema', lado });
    tocar('agua');
  };
  useEffect(() => {
    if (!ativo) return;
    const baixo = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      const k = ev.key.toLowerCase();
      const seta = ['arrowleft', 'arrowright', 'a', 'd', ' ', 'enter', 'arrowup', 'w'];
      if (!seta.includes(k)) return;
      ev.preventDefault();
      // sozinho: ← vai para a esquerda (rema na direita); → para a direita (rema na esquerda)
      if (so) remar(k === 'arrowleft' || k === 'a' ? 'dir' : k === 'arrowright' || k === 'd' ? 'esq' : Math.random() < 0.5 ? 'esq' : 'dir');
      else remar(meuLado);
    };
    window.addEventListener('keydown', baixo);
    return () => window.removeEventListener('keydown', baixo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, so, meuLado, e > REMADA_MS]);

  // a balsa, um pouco atrás e suavizada
  const volta = linha.em(e - 110);
  const ultimo = linha.ultimo()?.q ?? null;
  const ba = volta?.a.q.b[eq];
  const bb = volta?.b.q.b[eq];
  const k = volta?.k ?? 0;
  const bx = ba && bb ? ba[0] + (bb[0] - ba[0]) * k : 150;
  const by = ba && bb ? ba[1] + (bb[1] - ba[1]) * k : 0;

  // o piloto dos testes: rema para a próxima cenoura
  useEffect(() => {
    const piloto = import.meta.env.DEV && (window as unknown as { festaPilotoAutomatico?: boolean }).festaPilotoAutomatico;
    if (!piloto || !ativo || !meus) return;
    const pegas = new Set(ultimo?.c[eq] ?? []);
    const alvo = cenouras.find(([y], i) => y > by + 30 && !pegas.has(i));
    if (!alvo) return;
    const quer = alvo[1] - (bx + (bb?.[2] ?? 0) * 0.8);
    if (so) {
      if (quer > 10) remar('esq');
      else if (quer < -10) remar('dir');
    } else if ((meuLado === 'esq' && quer > 10) || (meuLado === 'dir' && quer < -10)) remar(meuLado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  if (!meus) return <></>;
  const cor = CORES_DAS_EQUIPES[eq % CORES_DAS_EQUIPES.length];
  const pegas = new Set(ultimo?.c[eq] ?? []);
  const pontos = ultimo?.b.map((b) => b[3]) ?? lados.map(() => 0);
  /** O remo de um lado está na água agora? (a minha remada na hora; a do parceiro quando o quadro chega) */
  const naAgua = (lado: 'esq' | 'dir') => {
    const dele = (ultimo?.b[eq]?.[lado === 'esq' ? 4 : 5] ?? -1e9) as number;
    const meu = (so || lado === meuLado) ? remei.current[lado] : -1e9;
    return e - Math.max(dele, meu) < 250;
  };
  // as ondinhas descem junto com o riacho
  const onda = by % 40;

  return (
    <Moldura placar={`🥕 × ${pontos[eq] ?? 0}`} fracao={e / REMADA_MS}>
      <FaixaDasEquipes turma={turma} pontos={pontos} />
      <svg
        ref={svg}
        viewBox="0 0 300 200"
        role="group"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          if (!so) return remar(meuLado);
          const r = svg.current!.getBoundingClientRect();
          const x = ((ev.clientX - r.left) / r.width) * 300;
          remar(x < bx ? 'dir' : 'esq');
        }}
      >
        {/* as margens de grama e o riacho */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#7cb85a" />
        <rect x={MARGEM_ESQ} y="0" width={MARGEM_DIR - MARGEM_ESQ} height="200" fill="#4f8fb8" />
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M${70 + ((i * 53) % 150)} ${(i * 40 + onda) % 200} q5 -3 10 0 q5 3 10 0`} stroke="#9cc8e0" strokeWidth="1.5" fill="none" />
        ))}
        {Array.from({ length: 8 }, (_, i) => {
          // as moitas da margem descem também (dá a sensação de andar)
          const y = (i * 50 + (by % 50)) % 220 - 10;
          return (
            <g key={i}>
              <circle cx={i % 2 ? 16 : 26} cy={y} r="7" fill="#5d8f47" />
              <circle cx={i % 2 ? 284 : 274} cy={(y + 25) % 220} r="7" fill="#5d8f47" />
            </g>
          );
        })}
        {cenouras.map(([y, x], i) => {
          const sy = BALSA_Y - (y - by);
          if (sy < -12 || sy > 212 || pegas.has(i)) return null;
          const balanca = quieto ? 0 : Math.round(((e / 300 + i) % 2) - 1);
          return (
            <g key={i} transform={`translate(${x} ${sy + balanca}) rotate(90)`}>
              <path d="M-4 -6 L4 -6 L0 9 Z" fill="#e8892a" stroke="#b5641a" strokeWidth="1" />
              <path d="M-1 -6 l-3 -5 M1 -6 l0 -6 M2 -6 l3 -4" stroke="#5d8f47" strokeWidth="2" strokeLinecap="round" />
            </g>
          );
        })}
        {/* a balsa: as toras, os dois coelhos e os remos */}
        <g transform={`translate(${bx} ${BALSA_Y})`}>
          {(['esq', 'dir'] as const).map((lado) => {
            const s = lado === 'esq' ? -1 : 1;
            const agua = naAgua(lado);
            return (
              <path
                key={lado}
                d={agua ? `M${s * 10} -2 L${s * 26} 14` : `M${s * 10} -2 L${s * 28} -6`}
                stroke="#7a5236"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
          {[-12, -4, 4, 12].map((x) => (
            <rect key={x} x={x - 4} y="-10" width="8" height="24" rx="3" fill="#a37b58" stroke="#7a5236" strokeWidth="1" />
          ))}
          <ellipse cx="0" cy="12" rx="18" ry="3" fill={cor} opacity="0.85" />
          {(so ? [0] : [-7, 7]).map((dx, j) => {
            const id = so ? meus.esq : j === 0 ? meus.esq : meus.dir;
            return (
              <g key={j} transform={`translate(${dx} 4)`}>
                <CoelhoDeFrente escala={0.6} />
                <text y={-26} x={so ? 0 : j === 0 ? -3 : 3} textAnchor={so ? 'middle' : j === 0 ? 'end' : 'start'} fontSize="7" fontWeight={id === eu ? 700 : 400} fill="#3a2e2a" stroke="#fffaf0" strokeWidth="2.5" paintOrder="stroke">
                  {turma?.nomes[id] ?? ''}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </Moldura>
  );
}

const NOME = chave('Balsa a dois');

export default microjogoDaTela<Dados>({
  id: 'remada',
  nome: NOME,
  dica: chave('Cada um rema de um lado: a remada empurra a balsa para o outro. Juntos, ela vai para a frente. Peguem as cenouras!'),
  Tela: Remada,
  valor: (v) => `🥕 × ${v}`,
});
