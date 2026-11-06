import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { menosMovimento, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { COR_DA_TURMA, CoelhoDaTurma, useContagem, useEntrar } from './lote4-comum';

/**
 * A TORTA DE CENOURA, EM DUPLA (05/11/2026, server/src/festa/torta.ts): morda alternando ← e → (ou A e L, ou os dois botões no
 * toque); a mesma tecla duas vezes não morde. As mordidas da dupla vão para a mesma torta, e a primeira dupla a acabar ganha.
 */

// Os mesmos números do servidor.
const TORTA_MS = 20000;
const MORDIDAS = 45;

interface Vista {
  duplas?: { comido: number; acabou: number | null; tamanho: number; raposa?: boolean }[];
  minha?: number;
  mordidas?: number;
}

/** Uma torta, de cima, com o que já foi comido tirado (no sentido do relógio, a partir do alto). */
function Torta({ cx, cy, r, comido }: { cx: number; cy: number; r: number; comido: number }) {
  const resta = 1 - Math.max(0, Math.min(1, comido));
  if (resta <= 0) return <circle cx={cx} cy={cy} r={r * 0.9} fill="#f6efdc" stroke="#d6c7a8" strokeWidth="2" />;
  const ang = (1 - resta) * 2 * Math.PI;
  const x0 = cx + r * Math.sin(ang);
  const y0 = cy - r * Math.cos(ang);
  const grande = resta > 0.5 ? 1 : 0;
  const fatia = resta >= 0.999 ? `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` : `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${grande} 1 ${cx} ${cy - r} Z`;
  return (
    <g>
      {/* o prato */}
      <circle cx={cx} cy={cy} r={r * 1.12} fill="#f6efdc" stroke="#d6c7a8" strokeWidth="2" />
      <path d={fatia} fill="#e0954a" stroke="#b86a2a" strokeWidth="2" />
      {/* a cobertura: as cenourinhas raladas */}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="#f2a95e" opacity={resta >= 0.999 ? 1 : 0} />
    </g>
  );
}

const ESQUERDA = new Set(['arrowleft', 'a', 'z']);
const DIREITA = new Set(['arrowright', 'l', 'm']);

function TortaDeCenoura({ dados, inicio, ativo, lance }: PropsDoMicro<Vista>) {
  const t = useT();
  const duplas = dados.duplas ?? [];
  const minha = dados.minha ?? -1;
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  useEntrar(ativo, inicio, agora, lance);
  const { somar, total } = useContagem(ativo, inicio, lance);
  const [ultimo, setUltimo] = useState<0 | 1 | null>(null);
  const [mordidas, setMordidas] = useState(0);
  const calmo = menosMovimento();

  const eu = minha >= 0 ? duplas[minha] : undefined;
  // a minha torta já com as mordidas que ainda não voltaram do servidor
  const meuComido = eu ? Math.min(1, eu.comido + Math.max(0, mordidas - (dados.mordidas ?? 0)) / (MORDIDAS * Math.max(1, eu.tamanho))) : 0;
  const acabei = !!eu && (eu.acabou !== null || meuComido >= 1);

  const ouvido = useRef(false);
  useEffect(() => {
    if (acabei && !ouvido.current) {
      ouvido.current = true;
      tocar('chegada');
    }
  }, [acabei]);

  const morder = (qual: 0 | 1) => {
    if (!ativo || acabei || e < 0 || e > TORTA_MS || minha < 0) return;
    if (ultimo === qual) return;
    setUltimo(qual);
    somar();
    setMordidas(total());
    tocar(qual ? 'clique' : 'tacada');
  };
  useTeclas(ativo, (ev) => {
    const k = ev.key.toLowerCase();
    if (ESQUERDA.has(k)) morder(0);
    else if (DIREITA.has(k)) morder(1);
    else return false;
    return true;
  });

  const outras = duplas.map((d, k) => ({ d, k })).filter(({ k }) => k !== minha);
  const balanca = !calmo && mordidas % 2 ? 2 : 0;

  return (
    <Moldura placar={`🥧 × ${mordidas}`} fracao={e / TORTA_MS}>
      <svg viewBox="0 0 300 170" role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)' }}>
        <rect x="0" y="0" width="300" height="170" rx="12" fill="#c98e5b" />
        <rect x="8" y="8" width="284" height="154" rx="10" fill="#f0d7b0" />
        {/* a minha torta, grande, com a dupla dos dois lados */}
        {eu && (
          <g>
            <Torta cx={110} cy={92} r={52} comido={meuComido} />
            <CoelhoDaTurma x={40 + balanca} y={130} cor={COR_DA_TURMA[minha % COR_DA_TURMA.length]} escala={0.9} />
            {eu.tamanho > 1 && <CoelhoDaTurma x={180 - balanca} y={130} cor={COR_DA_TURMA[minha % COR_DA_TURMA.length]} escala={0.9} />}
            <circle cx={40 + balanca} cy={88} r="4" fill="#f2c46a" stroke="#a87b1e" />
            {acabei && (
              <text x={110} y={102} textAnchor="middle" fontSize="34" aria-hidden="true">
                ✔
              </text>
            )}
          </g>
        )}
        {/* as outras, pequenas, à direita */}
        {outras.map(({ d, k }, j) => {
          const cx = 240;
          const cy = 34 + j * 46;
          return (
            <g key={k}>
              <Torta cx={cx} cy={cy} r={17} comido={d.comido} />
              {d.raposa ? (
                <text x={cx + 30} y={cy + 8} fontSize="18" textAnchor="middle">
                  🦊
                </text>
              ) : (
                <CoelhoDaTurma x={cx + 30} y={cy + 12} cor={COR_DA_TURMA[k % COR_DA_TURMA.length]} escala={0.45} />
              )}
              {d.acabou !== null && (
                <text x={cx} y={cy + 6} textAnchor="middle" fontSize="16" aria-hidden="true">
                  ✔
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* os dois botões: alternar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {([0, 1] as const).map((qual) => (
          <button
            key={qual}
            type="button"
            className="festa-alvo-casa"
            disabled={!ativo || acabei}
            style={{ height: 64, fontSize: '1.6em', outline: ultimo !== null && ultimo !== qual ? '3px solid #f2c46a' : undefined }}
            onPointerDown={(ev) => {
              ev.preventDefault();
              morder(qual);
            }}
          >
            {qual === 0 ? '◀' : '▶'}
          </button>
        ))}
      </div>
    </Moldura>
  );
}

const NOME = chave('Torta de cenoura');

export default microjogoDaTela({
  id: 'torta',
  nome: NOME,
  dica: chave('Coma a torta com a sua dupla, alternando ◀ e ▶. Quem acabar primeiro ganha!'),
  Tela: TortaDeCenoura,
  valor: (v) => `🥧 × ${v}`,
  errouComValor: true,
});
