import { useEffect, useRef, useState, type ReactNode } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { menosMovimento, microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { COR_DA_TURMA, CoelhoDaTurma, useContagem, useEntrar } from './lote4-comum';

/**
 * O REVEZAMENTO DO RIACHO (05/11/2026, server/src/festa/revezamento.ts): um desce sozinho (o barco de cima), os outros em
 * revezamento (o de baixo), um trecho cada. Rema-se alternando ◀ e ▶ (as setas, A e L, ou os botões), e só com o remo na mão.
 */

// Os mesmos números do servidor.
const REVEZA_MS = 30000;
const TRECHOS = 3;
const REMADAS_POR_TRECHO = 30;
const TOTAL = TRECHOS * REMADAS_POR_TRECHO;

interface Vista {
  etapa?: 'juntando' | 'remando' | 'fim';
  sozinho?: { remadas: number; chegou: number | null; raposa: boolean };
  equipe?: { remadas: number; chegou: number | null; tamanho: number; trecho: number; vez: number };
  papel?: 'sozinho' | 'equipe' | null;
  posicao?: number;
  remando?: boolean;
}

const ESQUERDA = new Set(['arrowleft', 'a', 'z']);
const DIREITA = new Set(['arrowright', 'l', 'm']);
const X0 = 30;
const X1 = 270;

function Barco({ x, y, children, meu }: { x: number; y: number; children: ReactNode; meu: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {children}
      <path d="M-24 0 L24 0 L16 12 L-16 12 Z" fill="#a8693c" stroke={meu ? '#f2c46a' : '#6e4422'} strokeWidth={meu ? 3 : 2} />
    </g>
  );
}

function Revezamento({ dados, inicio, ativo, lance }: PropsDoMicro<Vista>) {
  const t = useT();
  const sozinho = dados.sozinho ?? { remadas: 0, chegou: null, raposa: false };
  const equipe = dados.equipe ?? { remadas: 0, chegou: null, tamanho: 0, trecho: 0, vez: 0 };
  const papel = dados.papel ?? null;
  const remando = ativo && !!dados.remando;
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  useEntrar(ativo, inicio, agora, lance);
  const { somar, total } = useContagem(ativo, inicio, lance);
  const [ultimo, setUltimo] = useState<0 | 1 | null>(null);
  const [minhas, setMinhas] = useState(0);
  const calmo = menosMovimento();

  // o remo chegou na minha mão
  const tinha = useRef(false);
  useEffect(() => {
    if (remando && !tinha.current) tocar('vez');
    tinha.current = remando;
  }, [remando]);
  const chegou = papel === 'sozinho' ? sozinho.chegou : papel === 'equipe' ? equipe.chegou : null;
  const ouvido = useRef(false);
  useEffect(() => {
    if (chegou !== null && !ouvido.current) {
      ouvido.current = true;
      tocar('chegada');
    }
  }, [chegou]);

  const remar = (qual: 0 | 1) => {
    if (!remando || e > REVEZA_MS || ultimo === qual) return;
    setUltimo(qual);
    somar();
    setMinhas(total());
    tocar('agua');
  };
  useTeclas(ativo, (ev) => {
    const k = ev.key.toLowerCase();
    if (ESQUERDA.has(k)) remar(0);
    else if (DIREITA.has(k)) remar(1);
    else return false;
    return true;
  });

  const xDe = (remadas: number) => X0 + (Math.min(TOTAL, remadas) / TOTAL) * (X1 - X0);
  const balanca = !calmo && minhas % 2 ? 1.5 : 0;
  const vezNaEquipe = equipe.tamanho ? equipe.trecho % equipe.tamanho : 0;

  return (
    <Moldura placar={`🚣 × ${minhas}`} fracao={e / REVEZA_MS}>
      <svg viewBox="0 0 300 150" role="group" aria-label={t(NOME)} style={{ width: 'min(92vw, 460px)' }}>
        <rect x="0" y="0" width="300" height="150" rx="12" fill="#6fa356" />
        <rect x="0" y="22" width="300" height="106" fill="#4f8fc0" />
        <path d="M0 75 L300 75" stroke="#8cc0e6" strokeWidth="2" strokeDasharray="6 6" />
        {/* as marcas dos trechos (onde o remo passa) e a chegada */}
        {Array.from({ length: TRECHOS - 1 }, (_, k) => {
          const x = X0 + ((k + 1) / TRECHOS) * (X1 - X0);
          return <path key={k} d={`M${x} 80 L${x} 128`} stroke="#f6efdc" strokeWidth="2" strokeDasharray="3 3" />;
        })}
        <rect x={X1 + 4} y="22" width="6" height="106" fill="#f6efdc" />
        {/* o barco de quem vai sozinho (ou a raposa) */}
        <Barco x={xDe(sozinho.remadas) + (papel === 'sozinho' ? balanca : 0)} y={52} meu={papel === 'sozinho'}>
          {sozinho.raposa ? (
            <text x="0" y="-2" textAnchor="middle" fontSize="20">
              🦊
            </text>
          ) : (
            <CoelhoDaTurma x={0} y={4} cor={COR_DA_TURMA[4]} escala={0.6} />
          )}
        </Barco>
        {/* o barco da equipe, com quem está com o remo */}
        <Barco x={xDe(equipe.remadas) + (papel === 'equipe' ? balanca : 0)} y={104} meu={papel === 'equipe'}>
          <CoelhoDaTurma x={0} y={4} cor={COR_DA_TURMA[vezNaEquipe % COR_DA_TURMA.length]} escala={0.6} />
        </Barco>
        {/* quem espera o remo, na margem de baixo, em cada marca */}
        {Array.from({ length: equipe.tamanho }, (_, k) => {
          // o próximo trecho desta pessoa, se ainda houver
          let trecho = equipe.trecho + 1;
          while (trecho < TRECHOS && trecho % equipe.tamanho !== k) trecho++;
          if (k === vezNaEquipe || trecho >= TRECHOS || equipe.chegou !== null) return null;
          const x = X0 + (trecho / TRECHOS) * (X1 - X0);
          return <CoelhoDaTurma key={k} x={Math.min(X1, x)} y={146} cor={COR_DA_TURMA[k % COR_DA_TURMA.length]} escala={0.45} />;
        })}
        {/* a estrela: onde estou */}
        {papel && (
          <circle cx={12} cy={papel === 'sozinho' ? 52 : 104} r="5" fill="#f2c46a" stroke="#a87b1e" />
        )}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {([0, 1] as const).map((qual) => (
          <button
            key={qual}
            type="button"
            className="festa-alvo-casa"
            disabled={!remando}
            style={{ height: 60, fontSize: '1.6em', opacity: remando ? 1 : 0.4, outline: remando && ultimo !== null && ultimo !== qual ? '3px solid #f2c46a' : undefined }}
            onPointerDown={(ev) => {
              ev.preventDefault();
              remar(qual);
            }}
          >
            {qual === 0 ? '◀' : '▶'}
          </button>
        ))}
      </div>
    </Moldura>
  );
}

const NOME = chave('Revezamento do riacho');

export default microjogoDaTela({
  id: 'revezamento',
  nome: NOME,
  dica: chave('Reme alternando ◀ e ▶ quando o remo estiver com você.'),
  Tela: Revezamento,
  valor: (v) => `🚣 × ${v}`,
  errouComValor: true,
});
