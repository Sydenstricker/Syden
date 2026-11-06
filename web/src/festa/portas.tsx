import { useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { Bicho, type NomeDoBicho } from './lote1-bichos';

/**
 * QUEM ESTÁ EM QUAL TOCA? (05/11/2026, server/src/festa/portas.ts): quatro bichos entram nas três tocas do barranco, saem, correm e
 * entram noutra; no fim aparece um deles, e escolhe-se a toca em que ele está.
 */

// Os mesmos números do servidor.
const MOSTRA_MS = 700;
const FORA = -1;
const BICHOS: NomeDoBicho[] = ['coelho', 'raposa', 'corvo', 'sapo', 'ourico', 'toupeira'];
const NOME = chave('Quem está em qual toca?');

const TOCA_X = [60, 150, 240];
const CHAO = 158;
const BOCA = 128;

interface Dados {
  bichos?: number[];
  passeios?: { b: number; de: number; para: number }[];
  passos?: number[];
  pergunta?: number;
}

const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

function Portas({ dados, inicio, ativo, enviar, resposta }: PropsDoMicro<Dados>) {
  const t = useT();
  const bichos = dados.bichos ?? [];
  const passeios = dados.passeios ?? [];
  const passos = dados.passos ?? [];
  const pergunta = dados.pergunta ?? -1;
  const fim = MOSTRA_MS + passos.reduce((a, b) => a + b, 0) + 300;
  const revelando = resposta !== null;
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const agora = useRelogio(!revelando && (ativo || Date.now() < inicio + fim));
  const e = revelando ? Infinity : agora - inicio;

  const podeEscolher = ativo && pergunta >= 0 && escolhida === null;
  const escolher = (toca: number) => {
    if (!podeEscolher) return;
    setEscolhida(toca);
    tocar('clique');
    enviar({ toca, t: Math.round(Date.now() - inicio) });
  };
  useTeclas(podeEscolher, (ev) => {
    const toca = { '1': 0, '2': 1, '3': 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 }[ev.key];
    if (toca === undefined) return false;
    escolher(toca);
    return true;
  });

  // o passeio que está andando agora (um de cada vez)
  let andando: { k: number; p: number } | null = null;
  let tempo = MOSTRA_MS;
  for (let k = 0; k < passeios.length; k++) {
    if (e < tempo) break;
    if (e < tempo + passos[k]) {
      andando = { k, p: (e - tempo) / passos[k] };
      break;
    }
    tempo += passos[k];
  }
  const ondeX = (lugar: number, saindo: boolean) => (lugar === FORA ? (saindo ? 330 : -30) : TOCA_X[lugar]);
  let figura: { b: number; x: number; y: number; escala: number; virado: boolean } | null = null;
  if (andando) {
    const { b, de, para } = passeios[andando.k];
    const p = andando.p;
    const xDe = ondeX(de, false);
    const xPara = ondeX(para, true);
    const virado = xPara < xDe;
    if (p < 0.22) {
      // sai da toca (cresce na boca e desce ao caminho) ou entra pela esquerda
      const q = suave(p / 0.22);
      figura = de === FORA ? { b, x: -30 + q * 30, y: CHAO, escala: 0.9, virado } : { b, x: xDe, y: BOCA + (CHAO - BOCA) * q, escala: 0.4 + 0.5 * q, virado };
    } else if (p < 0.78) {
      const q = suave((p - 0.22) / 0.56);
      const x0 = de === FORA ? 0 : xDe;
      const x1 = para === FORA ? 300 : xPara;
      figura = { b, x: x0 + (x1 - x0) * q, y: CHAO - Math.abs(Math.sin(q * Math.PI * 5)) * 4, escala: 0.9, virado };
    } else {
      const q = suave((p - 0.78) / 0.22);
      figura = para === FORA ? { b, x: 300 + q * 30, y: CHAO, escala: 0.9, virado } : { b, x: xPara, y: CHAO - (CHAO - BOCA) * q, escala: 0.9 - 0.5 * q, virado };
    }
  }

  const perguntado = pergunta >= 0 ? bichos[pergunta] : -1;
  return (
    <svg viewBox="0 0 300 200" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'manipulation' }}>
      <rect x="0" y="0" width="300" height="200" rx="12" fill="#bfe0f0" />
      {/* o barranco com as três tocas, e o caminho na frente */}
      <path d="M0 140 Q20 60 150 56 Q280 60 300 140 Z" fill="#7cb85a" />
      <path d="M0 140 Q22 74 150 70 Q278 74 300 140 Z" fill="#8a6548" />
      <rect x="0" y="138" width="300" height="62" fill="#c9a77c" />
      {TOCA_X.map((x, toca) => {
        const marcada = escolhida === toca;
        const certa = revelando && resposta === toca;
        return (
          <g
            key={toca}
            style={{ cursor: podeEscolher ? 'pointer' : 'default' }}
            onPointerDown={(ev) => {
              ev.preventDefault();
              escolher(toca);
            }}
          >
            <path d={`M${x - 30} ${BOCA + 10} Q${x - 30} ${BOCA - 40} ${x} ${BOCA - 42} Q${x + 30} ${BOCA - 40} ${x + 30} ${BOCA + 10} Z`} fill="#3e2a1e" />
            <path
              d={`M${x - 30} ${BOCA + 10} Q${x - 30} ${BOCA - 40} ${x} ${BOCA - 42} Q${x + 30} ${BOCA - 40} ${x + 30} ${BOCA + 10}`}
              fill="none"
              stroke={certa ? '#7cb85a' : marcada ? '#f2c46a' : podeEscolher ? '#e8d2b0' : '#a37b58'}
              strokeWidth={certa || marcada ? 6 : 4}
            />
            {/* no fim, o bicho perguntado espia da toca certa */}
            {certa && perguntado >= 0 && (
              <g clipPath={`url(#portas-boca-${toca})`}>
                <Bicho nome={BICHOS[perguntado] ?? 'coelho'} x={x} y={BOCA + 26} escala={0.95} />
              </g>
            )}
            <clipPath id={`portas-boca-${toca}`}>
              <rect x={x - 30} y={BOCA - 44} width="60" height="54" />
            </clipPath>
            {/* a placa com o número (o teclado) */}
            <rect x={x - 9} y={176} width="18" height="16" rx="3" fill="#a97c50" />
            <text x={x} y={188} textAnchor="middle" fontSize="11" fontWeight="700" fill="#f4ede2">
              {toca + 1}
            </text>
            <rect x={x - 40} y={BOCA - 50} width="80" height="120" fill="transparent" />
          </g>
        );
      })}
      {figura && (
        <g transform={`translate(${figura.x} ${figura.y}) scale(${figura.virado ? -1 : 1} 1)`}>
          <Bicho nome={BICHOS[bichos[figura.b]] ?? 'coelho'} escala={figura.escala} />
        </g>
      )}
      {/* a pergunta: o bicho num balão, em cima */}
      {perguntado >= 0 && (
        <g transform="translate(150 6)">
          <rect x="-30" y="0" width="60" height="50" rx="12" fill="#f4ede2" stroke="#a97c50" strokeWidth="2" />
          <path d="M-6 50 L0 60 L6 50 Z" fill="#f4ede2" stroke="#a97c50" strokeWidth="2" />
          <rect x="-7" y="47" width="14" height="5" fill="#f4ede2" />
          <Bicho nome={BICHOS[perguntado] ?? 'coelho'} y={46} escala={0.7} />
          <text x="22" y="14" fontSize="13" fontWeight="700" fill="#b0465a" textAnchor="middle">
            ?
          </text>
        </g>
      )}
    </svg>
  );
}

export default microjogoDaTela({
  id: 'portas',
  nome: NOME,
  dica: chave('Siga os bichos de toca em toca. No fim, aponte onde está o do balão.'),
  Tela: Portas,
  valor: (v, f) => f.ms.format(v),
  naRevelacao: true,
});
