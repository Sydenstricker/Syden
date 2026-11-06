import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { COR_DA_TURMA, CoelhoDaTurma, useContagem, useEntrar } from './lote4-comum';

/**
 * O CABO DE GUERRA DE TECLAS (05/11/2026, server/src/festa/cabo.ts): a seta grande diz qual apertar; a certa puxa a corda para o
 * seu lado, a errada trava um instante. As setas do teclado (ou WASD), ou os quatro botões no toque.
 */

// Os mesmos números do servidor.
const CABO_MS = 15000;
const MARCA = 28;
/** Quanto a seta errada trava. */
const TRAVA_MS = 450;

interface Vista {
  setas?: number[];
  lados?: [number, number];
  fita?: number;
  lado?: number;
  venceu?: number | null;
}

/** A seta: 0 ↑, 1 →, 2 ↓, 3 ←. */
function Seta({ d, cor }: { d: number; cor: string }) {
  return (
    <g transform={`rotate(${d * 90})`}>
      <path d="M0 -22 L18 0 L7 0 L7 20 L-7 20 L-7 0 L-18 0 Z" fill={cor} stroke="#3a2e2a" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

const TECLAS: Record<string, number> = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };

function Cabo({ dados, inicio, ativo, lance }: PropsDoMicro<Vista>) {
  const t = useT();
  const setas = dados.setas ?? [0];
  const lados = dados.lados ?? [0, 0];
  const lado = dados.lado ?? -1;
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  useEntrar(ativo, inicio, agora, lance);
  const { somar } = useContagem(ativo, inicio, lance);
  const [i, setI] = useState(0);
  const [puxoes, setPuxoes] = useState(0);
  const [travado, setTravado] = useState(0);

  // a fita, suavizada entre um estado e outro
  const fitaAlvo = dados.fita ?? 0;
  const fitaVista = useRef(fitaAlvo);
  fitaVista.current += (fitaAlvo - fitaVista.current) * 0.2;
  const fita = fitaVista.current;

  const acabou = dados.venceu !== null && dados.venceu !== undefined;
  const ouvido = useRef(false);
  useEffect(() => {
    if (!acabou || ouvido.current || lado < 0) return;
    ouvido.current = true;
    tocar(dados.venceu === lado ? 'chegada' : 'erro');
  }, [acabou, dados.venceu, lado]);

  const apertar = (d: number) => {
    if (!ativo || acabou || e < 0 || e > CABO_MS || Date.now() < travado || lado < 0) return;
    if (d === setas[i % setas.length]) {
      setI((k) => k + 1);
      setPuxoes(somar());
      tocar('soco');
    } else {
      setTravado(Date.now() + TRAVA_MS);
      tocar('erro');
    }
  };
  useTeclas(ativo, (ev) => {
    const d = TECLAS[ev.key.toLowerCase()];
    if (d === undefined) return false;
    apertar(d);
    return true;
  });

  // a fita positiva puxa para o lado 0 (a esquerda); o meu lado aparece com a estrela
  const meio = 150 - (fita / MARCA) * 110;
  const travadoAgora = Date.now() < travado;
  const raposas = lados[1] === 0;
  const fila = (l: number) => (l === 1 && raposas ? 3 : Math.max(1, Math.min(4, lados[l])));

  return (
    <Moldura placar={`💪 × ${puxoes}`} fracao={e / CABO_MS}>
      <svg viewBox="0 0 300 120" role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)' }}>
        <rect x="0" y="0" width="300" height="120" rx="12" fill="#8cc66d" />
        {/* as marcas de cada lado e o riscado do meio */}
        <rect x="38" y="10" width="4" height="100" fill={COR_DA_TURMA[0]} opacity="0.7" />
        <rect x="258" y="10" width="4" height="100" fill={COR_DA_TURMA[1]} opacity="0.7" />
        <path d="M150 14 L150 106" stroke="#f6efdc" strokeWidth="2" strokeDasharray="4 4" />
        {/* a corda e a fita */}
        <path d={`M10 70 L290 70`} stroke="#b07a45" strokeWidth="5" />
        <rect x={meio - 4} y="58" width="8" height="24" rx="2" fill="#d9534f" />
        {/* as duas equipes, puxando */}
        {[0, 1].map((l) =>
          Array.from({ length: fila(l) }, (_, k) => {
            const x = l === 0 ? meio - 34 - k * 26 : meio + 34 + k * 26;
            if (l === 1 && raposas)
              return (
                <text key={`${l}-${k}`} x={x} y="80" textAnchor="middle" fontSize="24">
                  🦊
                </text>
              );
            return (
              <g key={`${l}-${k}`}>
                <CoelhoDaTurma x={x} y={82} cor={COR_DA_TURMA[l]} escala={0.75} />
                {l === lado && k === 0 && <circle cx={x} cy={30} r="4" fill="#f2c46a" stroke="#a87b1e" />}
              </g>
            );
          }),
        )}
      </svg>
      {/* a seta da vez, e as próximas pequenas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <svg viewBox="-30 -30 60 60" width="84" height="84" aria-hidden="true">
          <rect x="-28" y="-28" width="56" height="56" rx="10" fill={travadoAgora ? '#f3c4c0' : '#f6efdc'} stroke={COR_DA_TURMA[Math.max(0, lado)]} strokeWidth="3" />
          <Seta d={setas[i % setas.length]} cor={travadoAgora ? '#d9534f' : '#f2c46a'} />
        </svg>
        {[1, 2, 3].map((k) => (
          <svg key={k} viewBox="-30 -30 60 60" width={34 - k * 4} height={34 - k * 4} aria-hidden="true" opacity={0.7 - k * 0.15}>
            <Seta d={setas[(i + k) % setas.length]} cor="#e8dccb" />
          </svg>
        ))}
      </div>
      {/* no toque: as quatro setas em cruz */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 6, justifyContent: 'center' }}>
        {[
          [null, 0, null],
          [3, null, 1],
          [null, 2, null],
        ].flatMap((linha, y) =>
          linha.map((d, x) =>
            d === null ? (
              <span key={`${x}-${y}`} />
            ) : (
              <button
                key={`${x}-${y}`}
                type="button"
                className="festa-alvo-casa"
                style={{ height: 48 }}
                disabled={!ativo}
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  apertar(d);
                }}
              >
                <svg viewBox="-30 -30 60 60" width="30" height="30" aria-hidden="true">
                  <Seta d={d} cor="#e8dccb" />
                </svg>
              </button>
            ),
          ),
        )}
      </div>
    </Moldura>
  );
}

const NOME = chave('Cabo de guerra');

export default microjogoDaTela({
  id: 'cabo',
  nome: NOME,
  dica: chave('Aperte a seta que aparecer para puxar a corda. Errar trava!'),
  Tela: Cabo,
  valor: (v) => `💪 × ${v}`,
  errouComValor: true,
});
