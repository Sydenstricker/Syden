import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import type { Efeito } from '../somDosJogos';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { FilaDaTurma, useEntrar } from './lote4-comum';

/**
 * O TAMBOR DA TURMA (05/11/2026, server/src/festa/tambor.ts): ouça a batida, repita na mesma ordem e no mesmo ritmo, e
 * acrescente uma no fim. Teclas 1, 2 e 3 (ou ← ↓ →, ou A S D), ou tocar nos tambores. O ritmo é medido aqui, e a vez vai inteira.
 * Só os efeitos dos tambores; música, nunca.
 */

// Os mesmos números do servidor.
const OUVIR_ANTES_MS = 500;

interface Batida {
  tambor: number;
  gap: number;
}
interface Vista {
  etapa?: 'juntando' | 'ouvir' | 'tocar' | 'fim';
  batida?: Batida[];
  turma?: { voltas: number; fora: boolean }[];
  vez?: number;
  n?: number;
  eu?: number;
  restaMs?: number;
  etapaMs?: number;
}

const CORES = ['#d9534f', '#5b8fc9', '#f2c046'];
const SONS: Efeito[] = ['soco', 'carta', 'tacada'];
const TECLAS: Record<string, number> = { '1': 0, '2': 1, '3': 2, arrowleft: 0, arrowdown: 1, arrowright: 2, a: 0, s: 1, d: 2 };

function Tambor({ cor, batendo }: { cor: string; batendo: boolean }) {
  const s = batendo ? 1.12 : 1;
  return (
    <g transform={`scale(${s})`}>
      <path d="M-30 -8 L-30 22 Q0 34 30 22 L30 -8 Z" fill={cor} stroke="#3a2e2a" strokeWidth="2" />
      <path d="M-30 4 L-15 22 L0 4 L15 22 L30 4" stroke="#f6efdc" strokeWidth="2" fill="none" />
      <ellipse cx="0" cy="-8" rx="30" ry="10" fill={batendo ? '#fffbe8' : '#f6efdc'} stroke="#3a2e2a" strokeWidth="2" />
    </g>
  );
}

function TamborDaTurma({ dados, inicio, ativo, lance }: PropsDoMicro<Vista>) {
  const t = useT();
  const etapa = dados.etapa ?? 'juntando';
  const batida = dados.batida ?? [];
  const turma = dados.turma ?? [];
  const vez = dados.vez ?? -1;
  const n = dados.n ?? 0;
  const eu = dados.eu ?? -1;
  const agora = useRelogio(ativo);
  useEntrar(ativo, inicio, agora, lance);
  const minhaVez = ativo && etapa === 'tocar' && vez >= 0 && vez === eu;

  // a etapa, a partir de quando chegou aqui (o "ouvir" toca alinhado por ela)
  const [desde, setDesde] = useState({ n: -1, comeco: 0, ms: 0 });
  useEffect(() => {
    setDesde({ n, comeco: Date.now() - Math.max(0, (dados.etapaMs ?? 0) - (dados.restaMs ?? 0)), ms: dados.etapaMs ?? 0 });
    tocadasRef.current = [];
    setTocadas([]);
    ouvidas.current = 0;
    if (etapa === 'tocar' && vez === eu && eu >= 0) tocar('vez');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  const naEtapa = desde.n === n ? agora - desde.comeco : 0;

  // o "ouvir": as batidas tocam na hora de cada uma
  const instantes = batida.reduce<number[]>((l, b, k) => [...l, (k ? l[k - 1] : OUVIR_ANTES_MS) + b.gap], []);
  const ouvidas = useRef(0);
  const [batendo, setBatendo] = useState<{ tambor: number; em: number } | null>(null);
  useEffect(() => {
    if (etapa !== 'ouvir' || desde.n !== n) return;
    while (ouvidas.current < instantes.length && naEtapa >= instantes[ouvidas.current]) {
      const b = batida[ouvidas.current];
      // uma batida que passou há muito (a aba voltou do fundo) não toca
      if (naEtapa - instantes[ouvidas.current] < 250) {
        tocar(SONS[b.tambor]);
        setBatendo({ tambor: b.tambor, em: Date.now() });
      }
      ouvidas.current++;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  // a minha vez: o que já toquei
  const tocadasRef = useRef<{ tambor: number; ms: number }[]>([]);
  const [tocadas, setTocadas] = useState<{ tambor: number; ms: number }[]>([]);
  const base = useRef(0);
  const [mandei, setMandei] = useState(-1);
  const bater = (tambor: number) => {
    if (!minhaVez || mandei === n) return;
    const agoraMs = Date.now();
    if (tocadasRef.current.length === 0) base.current = agoraMs;
    const k = tocadasRef.current.length;
    const lista = [...tocadasRef.current, { tambor, ms: Math.round(agoraMs - base.current) }];
    tocadasRef.current = lista;
    setTocadas(lista);
    setBatendo({ tambor, em: agoraMs });
    const errou = k < batida.length && batida[k].tambor !== tambor;
    tocar(errou ? 'erro' : SONS[tambor]);
    // a vez vai inteira quando acaba, ou na hora em que errou o tambor
    if (errou || lista.length === batida.length + 1) {
      setMandei(n);
      lance({ n, batidas: lista });
    }
  };
  useTeclas(ativo, (ev) => {
    const d = TECLAS[ev.key.toLowerCase()];
    if (d === undefined) return false;
    bater(d);
    return true;
  });

  // quem está fora: o som de quem saiu
  const foraAntes = useRef(0);
  useEffect(() => {
    const fora = turma.filter((p) => p.fora).length;
    if (fora > foraAntes.current) tocar('queda');
    foraAntes.current = fora;
  }, [turma]);

  const fracaoDaVez = etapa === 'tocar' && desde.ms ? 1 - naEtapa / desde.ms : 0;
  const tocandoAgora = etapa === 'ouvir' ? ouvidas.current - 1 : minhaVez ? tocadas.length - 1 : -1;
  const meus = eu >= 0 ? turma[eu] : undefined;

  return (
    <Moldura placar={`🥁 × ${meus?.voltas ?? 0}`} fracao={etapa === 'ouvir' || etapa === 'tocar' ? Math.max(0, Math.min(1, naEtapa / Math.max(1, desde.ms))) : 0}>
      <FilaDaTurma
        turma={turma.map((p, k) => ({ texto: p.fora ? '✖' : `🥁${p.voltas}`, apagado: p.fora, vez: k === vez }))}
        eu={eu}
        fracaoDaVez={fracaoDaVez}
      />
      <svg viewBox="0 0 300 150" role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)', touchAction: 'none' }}>
        <rect x="0" y="0" width="300" height="150" rx="12" fill={minhaVez ? '#f6e3b8' : '#e8d6b6'} />
        {/* a batida: uma bolinha por toque, da cor do tambor; a nova (a que eu acrescento) tracejada */}
        {[...batida, ...(minhaVez ? [null] : [])].map((b, k, l) => {
          const x = 150 + (k - (l.length - 1) / 2) * Math.min(22, 280 / Math.max(1, l.length));
          const feita = minhaVez && k < tocadas.length;
          const cor = b ? CORES[b.tambor] : feita ? CORES[tocadas[k].tambor] : 'none';
          return (
            <circle
              key={k}
              cx={x}
              cy={20}
              r={k === tocandoAgora ? 9 : 7}
              fill={minhaVez && !feita && b ? '#8a7a6a44' : cor}
              stroke={b ? '#3a2e2a' : '#8a7a6a'}
              strokeWidth="1.5"
              strokeDasharray={b ? undefined : '3 2'}
            />
          );
        })}
        {[0, 1, 2].map((d) => (
          <g
            key={d}
            transform={`translate(${60 + d * 90} 92)`}
            style={{ cursor: minhaVez ? 'pointer' : 'default' }}
            onPointerDown={(ev) => {
              ev.preventDefault();
              bater(d);
            }}
          >
            <Tambor cor={CORES[d]} batendo={!!batendo && batendo.tambor === d && Date.now() - batendo.em < 120} />
            <text x="0" y="50" textAnchor="middle" fontSize="11" fill="#5a4636" aria-hidden="true">
              {d + 1}
            </text>
            <rect x="-38" y="-24" width="76" height="62" fill="transparent" />
          </g>
        ))}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Tambor da turma');

export default microjogoDaTela({
  id: 'tambor',
  nome: NOME,
  dica: chave('Ouça, repita a batida no mesmo ritmo e acrescente uma no fim.'),
  Tela: TamborDaTurma,
  valor: (v) => `🥁 × ${v}`,
  errouComValor: true,
});
