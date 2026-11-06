import { useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { menosMovimento, microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { Bicho, type NomeDoBicho } from './lote1-bichos';

/**
 * QUEM DANÇOU EM TERCEIRO? (05/11/2026, server/src/festa/danca.ts): a cortina abre, cinco bichos dançam um de cada vez (a cada um
 * acende uma lâmpada em cima do palco), a cortina fecha, e uma lâmpada ganha o "?": escolhe-se quem dançou naquela vez.
 */

// Os mesmos números do servidor.
const ABERTURA_MS = 600;
const FECHAR_MS = 700;
const BICHOS: NomeDoBicho[] = ['coelho', 'raposa', 'corvo', 'sapo', 'ourico', 'toupeira'];
const NOME = chave('Baile da toca');

interface Dados {
  ordem?: number[];
  porDancarino?: number;
  pergunta?: number;
}

const LAMPADA_X = (k: number, n: number) => 150 + (k - (n - 1) / 2) * 34;

function Danca({ dados, inicio, ativo, enviar, resposta }: PropsDoMicro<Dados>) {
  const t = useT();
  const ordem = dados.ordem ?? [];
  const por = dados.porDancarino ?? 1000;
  const pergunta = dados.pergunta ?? -1;
  const fim = ABERTURA_MS + ordem.length * por + FECHAR_MS;
  const revelando = resposta !== null;
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const agora = useRelogio(!revelando && (ativo || Date.now() < inicio + fim));
  const e = revelando ? Infinity : agora - inicio;
  const quieto = menosMovimento();

  // as opções na ordem dos bichos (nunca na ordem da dança)
  const opcoes = [...ordem].sort((a, b) => a - b);
  const podeEscolher = ativo && pergunta >= 0 && escolhido === null;
  const escolher = (bicho: number) => {
    if (!podeEscolher) return;
    setEscolhido(bicho);
    tocar('clique');
    enviar({ bicho, t: Math.round(Date.now() - inicio) });
  };
  useTeclas(podeEscolher, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > opcoes.length) return false;
    escolher(opcoes[n - 1]);
    return true;
  });

  // a cortina: fechada (1) no começo, abre, e fecha no fim
  const cortina = e < ABERTURA_MS ? 1 - e / ABERTURA_MS : e < fim - FECHAR_MS ? 0 : Math.min(1, (e - (fim - FECHAR_MS)) / FECHAR_MS);
  // quem está no palco agora, e onde
  const k = Math.floor((e - ABERTURA_MS) / por);
  const noPalco = e >= ABERTURA_MS && k >= 0 && k < ordem.length ? k : -1;
  const p = noPalco >= 0 ? (e - ABERTURA_MS - noPalco * por) / por : 0;
  const x = p < 0.2 ? -30 + (180 * p) / 0.2 : p > 0.8 ? 150 + (180 * (p - 0.8)) / 0.2 : 150;
  const danca = p >= 0.2 && p <= 0.8 && !quieto ? (p - 0.2) / 0.6 : 0;
  // cada bicho dança do seu jeito: pula, balança, gira, agacha
  const passo = noPalco >= 0 ? noPalco % 4 : 0;
  const onda = Math.sin(danca * Math.PI * 6);
  const pulo = passo === 0 ? Math.abs(onda) * 18 : passo === 3 ? Math.abs(onda) * 6 : 0;
  const giro = passo === 1 ? onda * 14 : 0;
  const virado = passo === 2 && onda < 0;
  const agacha = passo === 3 ? 1 - Math.abs(onda) * 0.15 : 1;

  const n = ordem.length;
  return (
    <svg viewBox="0 0 300 210" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'manipulation' }}>
      {/* o palco: o fundo, o chão de tábuas e as lâmpadas em cima */}
      <rect x="0" y="0" width="300" height="210" rx="12" fill="#4a3a52" />
      <rect x="10" y="36" width="280" height="96" fill="#2e2438" />
      <ellipse cx="150" cy="128" rx="80" ry="10" fill="#f2c46a" opacity="0.12" />
      <rect x="10" y="128" width="280" height="14" fill="#a97c50" />
      <path d="M10 135 H290" stroke="#8e6a4a" strokeWidth="1" />
      {ordem.map((_, j) => {
        const acesa = j === noPalco;
        const ja = noPalco > j || e >= fim - FECHAR_MS;
        const perguntada = pergunta === j;
        return (
          <g key={j} transform={`translate(${LAMPADA_X(j, n)} 18)`}>
            <line x1="0" y1="-18" x2="0" y2="-9" stroke="#2e2438" strokeWidth="1.5" />
            <circle
              r={perguntada ? 11 : 8}
              fill={perguntada ? '#f2c46a' : acesa ? '#f2c46a' : ja ? '#a9895a' : '#5e4e66'}
              stroke={perguntada ? '#fff' : '#2e2438'}
              strokeWidth={perguntada ? 2.5 : 1.5}
            />
            {acesa && <circle r="14" fill="#f2c46a" opacity="0.25" />}
            <text y="4" textAnchor="middle" fontSize={perguntada ? 13 : 9} fontWeight="700" fill={perguntada ? '#3a2e2a' : '#2e2438'}>
              {perguntada ? '?' : j + 1}
            </text>
          </g>
        );
      })}
      {/* o dançarino da vez */}
      {noPalco >= 0 && (
        <g transform={`translate(${x} ${128 - pulo}) rotate(${giro}) scale(${virado ? -1 : 1} ${agacha})`}>
          <Bicho nome={BICHOS[ordem[noPalco]] ?? 'coelho'} escala={1.25} />
        </g>
      )}
      {/* a cortina vermelha, das duas pontas para o meio */}
      {cortina > 0 && (
        <g>
          <rect x="10" y="36" width={140 * cortina} height="106" fill="#b0465a" />
          <rect x={290 - 140 * cortina} y="36" width={140 * cortina} height="106" fill="#b0465a" />
          {Array.from({ length: 6 }, (_, j) => (
            <g key={j} stroke="#8e3446" strokeWidth="2">
              <line x1={10 + ((j + 0.5) * 140 * cortina) / 6} y1="36" x2={10 + ((j + 0.5) * 140 * cortina) / 6} y2="142" />
              <line x1={290 - ((j + 0.5) * 140 * cortina) / 6} y1="36" x2={290 - ((j + 0.5) * 140 * cortina) / 6} y2="142" />
            </g>
          ))}
        </g>
      )}
      <rect x="6" y="30" width="288" height="10" rx="3" fill="#8e3446" />
      {/* as opções, quando a pergunta chega */}
      {(pergunta >= 0 || revelando) &&
        opcoes.map((bicho, j) => {
          const ox = 30 + j * 60;
          const certo = revelando && bicho === resposta;
          const meu = escolhido === bicho;
          return (
            <g
              key={bicho}
              transform={`translate(${ox} 148)`}
              style={{ cursor: podeEscolher ? 'pointer' : 'default' }}
              onPointerDown={(ev) => {
                ev.preventDefault();
                escolher(bicho);
              }}
            >
              <rect
                x="-27"
                y="0"
                width="54"
                height="58"
                rx="8"
                fill={certo ? '#7cb85a' : meu ? (revelando ? '#d9534f' : '#f2c46a') : '#f2e2c4'}
                stroke={meu ? '#fff' : '#a97c50'}
                strokeWidth={meu ? 2.5 : 1.5}
              />
              <Bicho nome={BICHOS[bicho] ?? 'coelho'} y={52} escala={0.82} />
              <text x="-22" y="11" fontSize="8" fill="#6e4f38">
                {j + 1}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

export default microjogoDaTela({
  id: 'danca',
  nome: NOME,
  dica: chave('Guarde a ordem da dança. No fim, diga quem dançou na lâmpada marcada.'),
  Tela: Danca,
  valor: (v, f) => f.ms.format(v),
  naRevelacao: true,
});
