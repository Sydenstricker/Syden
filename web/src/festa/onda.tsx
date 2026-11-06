import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, ehAperto, FaixaDasEquipes, menosMovimento, microjogoDaTela, Moldura, useAoVivo, useRelogio, useTeclas, type PropsDoMicro, type TurmaNaTela } from './comum';

/**
 * ONDA NO AÇUDE (lote 6, 05/11/2026, server/src/festa/onda.ts): um contra três. O solitário, na margem, bate o remo e manda
 * ondas (a pequena é rápida, a grande é lenta); o grupo, na jangada, pula quando a onda passa. Quem não está no ar cai na água.
 * A onda que o solitário manda chega às outras telas pelo servidor, e o tempo de ela atravessar o açude paga a internet.
 */

// Os mesmos números do servidor.
const ONDA_MS = 17000;
const VIAGEM = [1500, 2300];
const PASSAGEM_MS = 120;
const NO_AR_MS = 650;
const RECARGA_MS = 250;
const ULTIMA_CHEGADA = ONDA_MS - 500;
const ENTRE_REMADAS = 300;
const PRIMEIRA_REMADA = 800;
const espacoMs = (grupo: number) => (grupo <= 1 ? 1600 : grupo === 2 ? 1300 : 1000);

interface Onda {
  l: number;
  tipo: number;
}
interface Dados {
  solo?: number;
  grupo?: number[];
  ondas?: Onda[];
  pulos?: Record<string, number[]>;
  turma?: TurmaNaTela;
}

const chegadaDe = (o: Onda) => o.l + VIAGEM[o.tipo];

/** A mesma conta do servidor: a primeira onda que pegou quem pulou assim (só as já passadas até `ate`). */
function derrubadoPor(ondas: Onda[], pulos: number[], ate: number): number | null {
  const ordem = ondas.map((o, i) => [chegadaDe(o), i] as const).sort((a, b) => a[0] - b[0]);
  for (const [a, i] of ordem) {
    if (a + PASSAGEM_MS > ate) break;
    if (!pulos.some((j) => j <= a - PASSAGEM_MS && j + NO_AR_MS >= a + PASSAGEM_MS)) return i;
  }
  return null;
}

// O desenho: a margem à esquerda, o açude, a jangada à direita. A onda sai do remo (X_REMO) e passa pela jangada em X_JANGADA.
const X_REMO = 62;
const X_JANGADA = 255;
const AGUA = 128;
const posicaoDaOnda = (o: Onda, e: number) => X_REMO + ((X_JANGADA - X_REMO) * (e - o.l)) / VIAGEM[o.tipo];
/** A altura do pulo, de 0 a 1, num instante. */
const noAr = (pulo: number, e: number) => {
  const p = (e - pulo) / NO_AR_MS;
  return p <= 0 || p >= 1 ? 0 : 4 * p * (1 - p);
};

function Crista({ x, grande, alfa }: { x: number; grande: boolean; alfa: number }) {
  const a = grande ? 26 : 15;
  const w = grande ? 30 : 22;
  return (
    <g transform={`translate(${x} ${AGUA})`} opacity={alfa}>
      <path d={`M${-w} 2 Q${-w * 0.4} ${-a * 0.2} ${-w * 0.15} ${-a} Q${w * 0.25} ${-a * 1.05} ${w * 0.45} ${-a * 0.5} Q${w * 0.3} ${-a * 0.55} ${w * 0.2} ${-a * 0.35} Q${w * 0.6} ${-a * 0.1} ${w} 2 Z`} fill={grande ? '#3f7fb0' : '#5a9cc8'} />
      <path d={`M${-w * 0.15} ${-a} Q${w * 0.25} ${-a * 1.05} ${w * 0.45} ${-a * 0.5}`} stroke="#e8f4fa" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** O marcador de "este é você": uma setinha em cima. */
function Seta({ x, y }: { x: number; y: number }) {
  return <path transform={`translate(${x} ${y})`} d="M-6 -8 L6 -8 L0 0 Z" fill="#f2c46a" stroke="#9a6a1e" strokeWidth="1" />;
}

function Botao({ x, grande, pode, aperto }: { x: number; grande: boolean; pode: boolean; aperto: () => void }) {
  return (
    <g
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        aperto();
      }}
      style={{ cursor: pode ? 'pointer' : 'default' }}
      opacity={pode ? 1 : 0.4}
    >
      <rect x={x} y="158" width="86" height="36" rx="10" fill="#f4ead8" stroke="#8a6548" strokeWidth="2" />
      <g transform={`translate(${x + 43} ${190}) scale(${grande ? 0.8 : 0.75})`}>
        <path d={grande ? 'M-30 0 Q-12 -6 -5 -30 Q10 -32 18 -14 Q12 -16 8 -10 Q20 -3 30 0 Z' : 'M-24 0 Q-10 -3 -4 -18 Q8 -19 14 -8 Q10 -9 6 -6 Q16 -2 24 0 Z'} fill={grande ? '#3f7fb0' : '#5a9cc8'} />
      </g>
      {/* as setinhas da velocidade: a pequena é rápida */}
      <path d={grande ? `M${x + 10} 168 l6 4 l-6 4` : `M${x + 8} 168 l6 4 l-6 4 M${x + 15} 168 l6 4 l-6 4`} stroke="#8a6548" strokeWidth="2" fill="none" />
      <text x={x + 78} y="174" fontSize="10" textAnchor="end" fill="#8a6548">
        {grande ? '2' : '1'}
      </text>
    </g>
  );
}

function OndaNoAcude({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const eu = dados.turma?.eu ?? 0;
  const grupo = dados.grupo ?? [];
  const papel = dados.solo === eu ? 'solo' : grupo.includes(eu) ? 'grupo' : null;

  // as ondas e os pulos: o que veio pelo estado e o que veio pelos quadros ao vivo (o que tiver mais, vale)
  const [doQuadro, setDoQuadro] = useState<{ ondas: Onda[]; pulos: Record<string, number[]> }>({ ondas: [], pulos: {} });
  const mandar = useAoVivo<{ ondas: Onda[]; pulos: Record<string, number[]> }>('onda', ativo, lance, (q) => setDoQuadro(q.q));
  const ondasDoServidor = (dados.ondas?.length ?? 0) >= doQuadro.ondas.length ? (dados.ondas ?? []) : doQuadro.ondas;
  const pulosDe = (id: number) => {
    const a1 = dados.pulos?.[id] ?? [];
    const a2 = doQuadro.pulos[id] ?? [];
    return a1.length >= a2.length ? a1 : a2;
  };

  // o solitário vê a onda sair na hora (a do servidor, carimbada uns 100 ms depois, a substitui quando chega)
  const [minhas, setMinhas] = useState<Onda[]>([]);
  const [remadaEm, setRemadaEm] = useState(-1e9);
  const pendentes = minhas.filter((o) => e - o.l < 1500 && !ondasDoServidor.some((s) => s.l >= o.l - 50 && s.l - o.l < 1200 && s.tipo === o.tipo));
  const ondas = [...ondasDoServidor, ...pendentes];

  // os meus pulos (os que mandei, na hora) e os dos outros (os que o servidor repassou)
  const [meus, setMeus] = useState<number[]>([]);
  const pulosDoGrupo = grupo.map((id) => (id === eu ? meus : pulosDe(id)));
  // quem caiu: a mesma conta do servidor; para os outros, com uns 400 ms de atraso (o pulo deles ainda pode estar chegando)
  const quedas = grupo.map((id, k) => derrubadoPor(ondas, pulosDoGrupo[k], id === eu ? e : e - 400));
  const minhaQueda = papel === 'grupo' ? quedas[grupo.indexOf(eu)] : null;
  const avisouQueda = useRef(false);
  useEffect(() => {
    if (minhaQueda !== null && !avisouQueda.current) {
      avisouQueda.current = true;
      tocar('agua');
    }
  }, [minhaQueda]);

  const fim = e >= ONDA_MS;
  useEffect(() => {
    if (ativo && fim) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, fim]);

  const podeRemar = (tipo: number) => {
    if (!ativo || papel !== 'solo' || e < PRIMEIRA_REMADA || fim) return false;
    const ultima = ondas.reduce((m, o) => Math.max(m, o.l), -1e9);
    if (e - ultima < ENTRE_REMADAS + 50) return false;
    const a = e + VIAGEM[tipo];
    // com uma folga além da do servidor: a onda carimbada lá sai um pouco depois
    return a <= ULTIMA_CHEGADA - 250 && ondas.every((o) => Math.abs(chegadaDe(o) - a) >= espacoMs(grupo.length) + 200);
  };
  const remar = (tipo: number) => {
    if (!podeRemar(tipo)) return;
    setMinhas((l) => [...l, { l: e, tipo }]);
    setRemadaEm(e);
    tocar('tacada');
    mandar({ onda: tipo });
  };
  const pular = () => {
    if (!ativo || papel !== 'grupo' || minhaQueda !== null || fim) return;
    const ultimo = meus[meus.length - 1];
    if (ultimo !== undefined && e < ultimo + NO_AR_MS + RECARGA_MS) return;
    const tPulo = Math.round(e);
    setMeus((l) => [...l, tPulo]);
    tocar('pulo');
    mandar({ pulo: tPulo });
  };
  useTeclas(ativo, (ev) => {
    if (papel === 'solo') {
      if (ev.key === '1' || ev.key === 'ArrowLeft' || ev.key === 'z' || ev.key === 'Z') return remar(0), true;
      if (ev.key === '2' || ev.key === 'ArrowRight' || ev.key === 'x' || ev.key === 'X') return remar(1), true;
      return false;
    }
    if (ehAperto(ev) || ev.key === 'ArrowUp') return pular(), true;
    return false;
  });

  const calmo = menosMovimento();
  // a jangada: quem é do grupo, eu (se sou) primeiro
  const ordem = papel === 'grupo' ? [eu, ...grupo.filter((id) => id !== eu)] : grupo;
  const jangada = Math.max(1, ordem.length);
  const xs = ordem.map((_, k) => X_JANGADA + (k - (jangada - 1) / 2) * 25);
  const caidos = quedas.filter((c) => c !== null).length;
  const alturaDe = (k: number) => pulosDoGrupo[grupo.indexOf(ordem[k])].reduce((h, j) => Math.max(h, noAr(j, e)), 0);
  const quedaDe = (k: number) => {
    const i = quedas[grupo.indexOf(ordem[k])];
    return i === null || !ondas[i] ? null : chegadaDe(ondas[i]);
  };
  const balanco = calmo ? 0 : Math.sin(e / 400) * 1.5;
  const remando = e - remadaEm < 250;

  return (
    <Moldura placar={`💦 × ${caidos}`} fracao={e / ONDA_MS}>
      <FaixaDasEquipes turma={dados.turma} />
      <svg
        viewBox="0 0 300 200"
        role="group"
        aria-label={t(NOME)}
        style={{ width: '100%', touchAction: 'none', cursor: ativo ? 'pointer' : 'default' }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          if (papel === 'grupo') pular();
        }}
      >
        {/* o céu, o açude e a margem */}
        <rect x="0" y="0" width="300" height="200" rx="12" fill="#cfe6ef" />
        <path d="M0 70 Q60 40 120 64 Q180 36 240 60 Q280 48 300 58 L300 100 L0 100 Z" fill="#9cc58a" />
        <rect x="0" y={AGUA - 4} width="300" height={200 - AGUA + 4} fill="#6fa8cf" />
        {[150, 170, 188].map((y, k) => (
          <path key={k} d={`M${70 + k * 30} ${y} q8 -3 16 0 M${170 + k * 25} ${y + 6} q8 -3 16 0`} stroke="#9cc6e2" strokeWidth="1.5" fill="none" />
        ))}
        <path d="M0 108 Q30 104 52 118 L58 200 L0 200 Z" fill="#7cae5e" />
        <path d="M0 116 Q30 112 50 124 L54 132 Q30 124 0 128 Z" fill="#8a6548" />

        {/* o solitário, na margem, com o remo */}
        <g>
          <CoelhoDeFrente x={30} y={112} escala={1.1} />
          <path d={remando ? 'M38 92 L66 126' : 'M38 92 L52 128'} stroke="#8a6548" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx={remando ? 66 : 53} cy={remando ? 128 : 131} rx="6" ry="3" fill="#a37b58" />
          {papel === 'solo' && <Seta x={30} y={70} />}
        </g>

        {/* as ondas */}
        {ondas.map((o, i) => {
          const x = posicaoDaOnda(o, e);
          if (e < o.l || x > 310) return null;
          return <Crista key={`${o.l}-${i}`} x={x} grande={o.tipo === 1} alfa={x > X_JANGADA + 20 ? Math.max(0, 1 - (x - X_JANGADA - 20) / 30) : 1} />;
        })}

        {/* a jangada e quem está nela */}
        <g transform={`translate(0 ${balanco})`}>
          {xs.map((x, k) => {
            const q = quedaDe(k);
            if (q !== null && e >= q) {
              // na água, na frente da jangada: a cabeça meio afundada e os respingos
              const d = Math.min(1, (e - q) / 300);
              const xa = x + 6 * d;
              const ya = AGUA + 34 + 4 * d;
              return (
                <g key={k}>
                  <CoelhoDeFrente x={xa} y={ya} escala={0.85} olhos="tontos" />
                  <rect x={xa - 16} y={ya - 9} width="32" height="14" fill="#6fa8cf" />
                  <path d={`M${xa - 15} ${ya - 9} q7 -3 15 0 q7 3 15 0`} stroke="#9cc6e2" strokeWidth="1.5" fill="none" />
                  {e - q < 600 && <path transform={`translate(${xa} ${ya - 10})`} d="M-12 0 l-4 -8 M0 -2 l0 -10 M12 0 l4 -8" stroke="#e8f4fa" strokeWidth="2" strokeLinecap="round" />}
                  {ordem[k] === eu && <Seta x={xa} y={ya - 42} />}
                </g>
              );
            }
            const h = alturaDe(k) * 28;
            return (
              <g key={k}>
                <CoelhoDeFrente x={x} y={AGUA - 2 - h} escala={0.85} />
                {ordem[k] === eu && <Seta x={x} y={AGUA - 42 - h} />}
              </g>
            );
          })}
          <rect x={X_JANGADA - 40} y={AGUA - 3} width="80" height="8" rx="3" fill="#a37b58" stroke="#6e4f38" strokeWidth="1.5" />
          {[-26, -13, 0, 13, 26].map((dx) => (
            <path key={dx} d={`M${X_JANGADA + dx} ${AGUA - 3} l0 8`} stroke="#6e4f38" strokeWidth="1" />
          ))}
        </g>

        {/* os botões do remo (só o solitário) */}
        {papel === 'solo' && (
          <>
            <Botao x={66} grande={false} pode={podeRemar(0)} aperto={() => remar(0)} />
            <Botao x={160} grande pode={podeRemar(1)} aperto={() => remar(1)} />
          </>
        )}
      </svg>
    </Moldura>
  );
}

const NOME = chave('Onda no açude');

export default microjogoDaTela({
  id: 'onda',
  nome: NOME,
  dica: chave('Quem está no remo manda ondas; quem está na jangada pula na hora!'),
  Tela: OndaNoAcude,
  valor: (v) => `💦 × ${v}`,
  errouComValor: true,
});
