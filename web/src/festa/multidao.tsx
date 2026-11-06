import { useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import { Bicho, type NomeDoBicho } from './lote1-bichos';

/**
 * QUEM ESTÁ ATRÁS DA TURMA? (05/11/2026, server/src/festa/multidao.ts): uma turma de coelhos de costas esconde um bicho; eles
 * saem um a um, e cada um descobre um pedaço. Escolhe-se uma vez, entre quatro: quanto antes, mais vale; errar é zero.
 */

// Os mesmos números do servidor.
const COLUNAS = 4;
const FILEIRAS = 3;
const MULTIDAO_MS = 13000;
const ESCONDIDOS: NomeDoBicho[] = ['raposa', 'esquilo', 'gato', 'cachorro', 'ourico', 'coruja', 'sapo', 'toupeira'];
const NOME = chave('Quem está atrás da turma?');

/** A área que a turma cobre (o bicho, grande, cabe nela). */
const X0 = 86;
const Y0 = 12;
const LARG = 32;
const ALT = 46;
/** Quanto um coelho leva para sair andando. */
const SAINDO_MS = 450;

interface Dados {
  bicho?: number;
  opcoes?: number[];
  saidas?: number[];
}

/** Um coelho da turma, de costas (o pé em 0, 0). */
function CoelhoDeCostas({ cor }: { cor: string }) {
  return (
    <g>
      <ellipse cx="-7" cy="-58" rx="5" ry="13" fill={cor} />
      <ellipse cx="7" cy="-58" rx="5" ry="13" fill={cor} />
      <ellipse cx="0" cy="-22" rx="19" ry="23" fill={cor} />
      <circle cx="0" cy="-44" r="15" fill={cor} />
      <circle cx="0" cy="-8" r="5" fill="#f4ede2" />
      <path d="M-10 -40 Q0 -30 10 -40" stroke="rgba(0,0,0,0.08)" strokeWidth="3" fill="none" />
    </g>
  );
}
const PELOS = ['#e8dccb', '#d8c9b4', '#c9b08e', '#b7a7a0', '#e2d2bc', '#cfc0aa'];

function Multidao({ dados, inicio, ativo, enviar, resposta }: PropsDoMicro<Dados>) {
  const t = useT();
  const bicho = dados.bicho ?? -1;
  const opcoes = dados.opcoes ?? [];
  const saidas = dados.saidas ?? [];
  const revelando = resposta !== null;
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const agora = useRelogio(!revelando && ativo);
  const e = revelando ? Infinity : agora - inicio;

  const podeEscolher = ativo && bicho >= 0 && escolhido === null && e <= MULTIDAO_MS;
  const escolher = (b: number) => {
    if (!podeEscolher) return;
    setEscolhido(b);
    tocar(b === bicho ? 'acerto' : 'erro');
    enviar({ bicho: b, t: Math.round(Date.now() - inicio) });
  };
  useTeclas(podeEscolher, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > opcoes.length) return false;
    escolher(opcoes[n - 1]);
    return true;
  });

  const quem = revelando ? (resposta ?? -1) : bicho;
  const casa = (c: number) => ({ x: X0 + (c % COLUNAS) * LARG, y: Y0 + Math.floor(c / COLUNAS) * ALT });
  // a turma desenhada de trás para a frente: a fileira de cima primeiro
  const turma = saidas.map((s, c) => ({ c, s })).sort((a, b) => a.c - b.c);
  return (
    <svg viewBox="0 0 300 212" role="group" aria-label={t(NOME)} style={{ width: '100%', touchAction: 'manipulation' }}>
      {/* a horta ao fundo */}
      <rect x="0" y="0" width="300" height="212" rx="12" fill="#a8cf8e" />
      <rect x="0" y="120" width="300" height="34" fill="#8a6548" />
      {[30, 62, 238, 270].map((x) => (
        <g key={x} transform={`translate(${x} 122)`}>
          <path d="M-5 0 L5 0 L0 14 Z" fill="#e07a2e" />
          <path d="M-2 0 L-5 -8 M0 0 L0 -10 M2 0 L5 -8" stroke="#4f7d3a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ))}
      <defs>
        <clipPath id="multidao-descoberto">
          {saidas.map((s, c) =>
            revelando || (bicho >= 0 && e >= s) ? <rect key={c} x={casa(c).x - 1} y={casa(c).y - 1} width={LARG + 2} height={ALT + 2} /> : null,
          )}
        </clipPath>
      </defs>
      {/* o bicho escondido: só os pedaços que a turma já descobriu */}
      {quem >= 0 && (
        <g clipPath={revelando ? undefined : 'url(#multidao-descoberto)'}>
          <Bicho nome={ESCONDIDOS[quem] ?? 'raposa'} x={150} y={148} escala={2.45} />
        </g>
      )}
      {/* a turma: cada um sai andando para o lado mais perto */}
      {!revelando &&
        turma.map(({ c, s }) => {
          const p = Math.max(0, Math.min(1, (e - s) / SAINDO_MS));
          if (p >= 1) return null;
          const { x, y } = casa(c);
          const lado = c % COLUNAS < COLUNAS / 2 ? -1 : 1;
          const passo = p > 0 ? Math.abs(Math.sin(p * Math.PI * 4)) * 4 : 0;
          return (
            <g key={c} transform={`translate(${x + LARG / 2 + lado * p * 140} ${y + ALT + 8 - passo}) scale(0.86)`} opacity={1 - p * 0.6}>
              <CoelhoDeCostas cor={PELOS[c % PELOS.length]} />
            </g>
          );
        })}
      {/* as quatro opções */}
      {opcoes.map((b, j) => {
        const ox = 42 + j * 72;
        const certo = revelando && b === resposta;
        const meu = escolhido === b;
        return (
          <g
            key={b}
            transform={`translate(${ox} 156)`}
            style={{ cursor: podeEscolher ? 'pointer' : 'default' }}
            onPointerDown={(ev) => {
              ev.preventDefault();
              escolher(b);
            }}
          >
            <rect
              x="-32"
              y="0"
              width="64"
              height="52"
              rx="8"
              fill={certo ? '#7cb85a' : meu ? (revelando || b !== bicho ? '#d9534f' : '#7cb85a') : '#f2e2c4'}
              stroke={meu ? '#fff' : '#a97c50'}
              strokeWidth={meu ? 2.5 : 1.5}
              opacity={bicho < 0 && !revelando ? 0.55 : 1}
            />
            <Bicho nome={ESCONDIDOS[b] ?? 'raposa'} y={48} escala={0.75} />
            <text x="-27" y="11" fontSize="8" fill="#6e4f38">
              {j + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default microjogoDaTela({
  id: 'multidao',
  nome: NOME,
  dica: chave('Descubra quem está escondido. Uma chance só: quanto antes, mais vale.'),
  Tela: Multidao,
  valor: (v, f) => f.s.format(v / 1000),
  naRevelacao: true,
});
