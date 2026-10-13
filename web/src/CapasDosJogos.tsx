import { useId } from 'react';
import { idiomaAtual } from './i18n';
import { tamanhoLegivel, type IdDoJogo } from './minijogos';

/**
 * AS CAPAS DA ESTANTE DE JOGOS (12/10/2026). Uma imagem por jogo, desenhada aqui em SVG: nenhuma arte de
 * terceiro, nada para baixar, e nenhum texto dentro do desenho (o nome do jogo vai embaixo, traduzido).
 * Todas no mesmo formato (4:3) e na mesma família de cor: fundo escuro, uma ou duas cores fortes.
 */
export function CapaDoJogo({ jogo }: { jogo: IdDoJogo }) {
  switch (jogo) {
    case 'tamanho':
      return <CapaQualEMaior />;
    case 'stop':
      return <CapaStop />;
    case 'sudoku':
      return <CapaSudoku />;
    case 'gomoku':
      return <CapaCincoEmLinha />;
    case 'mancala':
      return <CapaMancala />;
    case 'xadrez':
      return <CapaXadrez />;
    case 'lobisomem':
      return <CapaLobisomem />;
    case 'desenho':
      return <CapaDesenho />;
  }
}

/** O desenha e adivinha: o quadro com um gato rabiscado, o lápis, e o balão de chute com "?". */
function CapaDesenho() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#1a1d2b" />
      <rect x="14" y="12" width="98" height="74" rx="4" fill="#fdfcf8" />
      <g fill="none" stroke="#1d1d1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 66 Q40 44 52 40 L50 28 L60 37 Q66 35 72 37 L82 28 L80 40 Q92 44 88 66 Q66 76 44 66 Z" />
        <circle cx="58" cy="50" r="1.6" fill="#1d1d1f" />
        <circle cx="74" cy="50" r="1.6" fill="#1d1d1f" />
        <path d="M63 57 L66 60 L69 57" />
        <path d="M44 56 L32 53 M44 60 L32 62 M88 56 L100 53 M88 60 L100 62" stroke="#4f7df5" />
      </g>
      <path d="M86 70 Q96 74 104 68" fill="none" stroke="#e5484d" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(38 118 66)">
        <rect x="112" y="40" width="9" height="40" rx="1.5" fill="#f2b84b" />
        <rect x="112" y="40" width="9" height="6" fill="#e88ab5" />
        <path d="M112 80 L116.5 90 L121 80 Z" fill="#f0d9b5" />
        <path d="M115 86.5 L116.5 90 L118 86.5 Z" fill="#1d1d1f" />
      </g>
      <path d="M118 88 h30 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-20 l-6 6 v-6 h-4 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6 z" fill="#3fb27f" />
      <text x="134" y="107" fontSize="15" fontWeight="800" textAnchor="middle" fill="#fff">
        ?
      </text>
    </svg>
  );
}

/** O Lobisomem: a lua cheia sobre o morro, o lobo em silhueta uivando e as casas da vila acesas. */
function CapaLobisomem() {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ceu`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a3a" />
          <stop offset="1" stopColor="#2c2350" />
        </linearGradient>
        <filter id={`${id}-sombra`}>
          <feFlood floodColor="#0b0b16" />
          <feComposite in2={ALFA} operator="in" />
        </filter>
      </defs>
      <rect width="160" height="120" fill={`url(#${id}-ceu)`} />
      {[
        [20, 18],
        [48, 30],
        [140, 14],
        [128, 40],
        [70, 12],
        [96, 24],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#e8e4ff" opacity="0.8" />
      ))}
      <circle cx="112" cy="40" r="22" fill="#f4e9c1" />
      <circle cx="104" cy="34" r="4" fill="#e6d8a6" />
      <circle cx="118" cy="48" r="3" fill="#e6d8a6" />
      <path d="M0 96 Q40 70 80 84 T160 80 V120 H0 Z" fill="#0f1024" />
      <text x="62" y="92" fontSize="44" textAnchor="middle" filter={`url(#${id}-sombra)`} transform="scale(-1 1) translate(-124 0)">
        🐺
      </text>
      {[
        [112, 96],
        [134, 100],
      ].map(([x, y]) => (
        <g key={x}>
          <path d={`M${x - 9} ${y} L${x} ${y - 9} L${x + 9} ${y} V${y + 10} H${x - 9} Z`} fill="#1b1a33" />
          <rect x={x - 3} y={y + 2} width="6" height="5" fill="#f2b84b" />
        </g>
      ))}
    </svg>
  );
}

/** Os problemas de xadrez: um canto do tabuleiro com o cavalo no meio do lance e a casa de destino marcada. */
function CapaXadrez() {
  const lado = 20;
  const x0 = 20;
  const y0 = 0;
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#161512" />
      {Array.from({ length: 36 }, (_, i) => {
        const c = i % 6;
        const l = Math.floor(i / 6);
        return <rect key={i} x={x0 + c * lado} y={y0 + l * lado} width={lado} height={lado} fill={(c + l) % 2 ? '#b58863' : '#f0d9b5'} />;
      })}
      <rect x={x0 + 1 * lado} y={y0 + 4 * lado} width={lado} height={lado} fill="#cdd26a" opacity="0.85" />
      <rect x={x0 + 3 * lado} y={y0 + 3 * lado} width={lado} height={lado} fill="#cdd26a" opacity="0.85" />
      <path
        d={`M${x0 + 1.5 * lado} ${y0 + 4.5 * lado} Q${x0 + 2.6 * lado} ${y0 + 4.6 * lado} ${x0 + 3.5 * lado} ${y0 + 3.5 * lado}`}
        fill="none"
        stroke="#3fb27f"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <text x={x0 + 3.5 * lado} y={y0 + 4 * lado - 3} fontSize="19" textAnchor="middle" fill="#fdfdfd" stroke="#222" strokeWidth="0.8">
        {'♞︎'}
      </text>
      <text x={x0 + 4.5 * lado} y={y0 + 2 * lado - 3} fontSize="19" textAnchor="middle" fill="#1d1d1f">
        {'♚︎'}
      </text>
      <text x={x0 + 1.5 * lado} y={y0 + 1 * lado - 3} fontSize="19" textAnchor="middle" fill="#1d1d1f">
        {'♜︎'}
      </text>
    </svg>
  );
}

// O canal de transparência do desenho: o filtro pinta só onde o emoji tem tinta.
const ALFA = 'SourceAlpha';

/**
 * O "Qual é o tamanho?": duas silhuetas lado a lado sobre uma grade, a de referência medida e a outra com "?".
 * As silhuetas são os próprios emojis do jogo pintados de uma cor só (o filtro troca a cor e guarda o
 * contorno).
 */
function CapaQualEMaior() {
  const id = useId().replace(/:/g, '');
  const grade = Array.from({ length: 9 }, (_, i) => 10 + i * 18);
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <defs>
        <filter id={`${id}-azul`}>
          <feFlood floodColor="#4f7df5" />
          <feComposite in2={ALFA} operator="in" />
        </filter>
        <filter id={`${id}-laranja`}>
          <feFlood floodColor="#f2603f" />
          <feComposite in2={ALFA} operator="in" />
        </filter>
      </defs>
      <rect width="160" height="120" fill="#121a16" />
      {grade.map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="120" stroke="#1d2a23" strokeWidth="0.6" />
      ))}
      {grade.slice(0, 7).map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="160" y2={y} stroke="#1d2a23" strokeWidth="0.6" />
      ))}
      <line x1="0" y1="104" x2="160" y2="104" stroke="#5f8f4e" strokeWidth="1" />
      <text x="44" y="103" fontSize="58" textAnchor="middle" filter={`url(#${id}-azul)`}>
        🦒
      </text>
      <text x="117" y="102" fontSize="50" textAnchor="middle" filter={`url(#${id}-laranja)`}>
        🐘
      </text>
      <rect x="90" y="30" width="54" height="74" fill="none" stroke="#e8e6df" strokeWidth="0.8" strokeDasharray="3 2" />
      <rect x="10" y="10" width="44" height="13" rx="2" fill="#e8e6df" />
      <rect x="10" y="10" width="2.5" height="13" fill="#4f7df5" />
      <text x="34" y="20" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#2c4fb0">
        {tamanhoLegivel(550, idiomaAtual())}
      </text>
      <rect x="96" y="10" width="44" height="13" rx="2" fill="#e8e6df" />
      <rect x="96" y="10" width="2.5" height="13" fill="#f2603f" />
      <text x="120" y="20" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#c2401f">
        ???
      </text>
    </svg>
  );
}

/** O Stop: a placa octogonal com a letra sorteada, e uma folha de respostas atrás. */
function CapaStop() {
  const octogono = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 8) * (2 * i + 1);
    return `${108 + 30 * Math.cos(a)},${58 + 30 * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#1a1420" />
      <g transform="rotate(-6 50 64)">
        <rect x="16" y="22" width="68" height="86" rx="4" fill="#efe9dc" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x="24" y={34 + i * 15} width="14" height="4" rx="2" fill="#b9a98c" />
            <rect x="42" y={34 + i * 15} width={22 + ((i * 7) % 13)} height="4" rx="2" fill={i < 3 ? '#5a4a8a' : '#d8cdb8'} />
          </g>
        ))}
      </g>
      <polygon points={octogono} fill="#e5484d" stroke="#f6f1e7" strokeWidth="3" />
      <text x="108" y="70" fontSize="34" fontWeight="800" textAnchor="middle" fill="#f6f1e7">
        A
      </text>
    </svg>
  );
}

/** O Sudoku: um pedaço do tabuleiro, com os números dados e um recém-posto em destaque. */
function CapaSudoku() {
  const numeros: Record<number, [string, string?]> = {
    0: ['5'],
    2: ['3'],
    7: ['7'],
    10: ['9'],
    12: ['1', 'novo'],
    14: ['8'],
    19: ['6'],
    21: ['2'],
    26: ['4'],
    28: ['8', 'novo'],
    31: ['5'],
    33: ['9'],
  };
  const lado = 18;
  const x0 = 26;
  const y0 = 6;
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#10161f" />
      <rect x={x0} y={y0} width={lado * 6} height={lado * 6} rx="3" fill="#e9edf3" />
      <rect x={x0 + lado * 3} y={y0 + lado * 2} width={lado} height={lado} fill="#c9dafc" />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} stroke="#1c2433" strokeWidth={i % 3 === 0 ? 1.8 : 0.5}>
          <line x1={x0 + i * lado} y1={y0} x2={x0 + i * lado} y2={y0 + lado * 6} />
          <line x1={x0} y1={y0 + i * lado} x2={x0 + lado * 6} y2={y0 + i * lado} />
        </g>
      ))}
      {Object.entries(numeros).map(([casa, [n, novo]]) => {
        const c = Number(casa) % 6;
        const l = Math.floor(Number(casa) / 6);
        return (
          <text
            key={casa}
            x={x0 + c * lado + lado / 2}
            y={y0 + l * lado + lado * 0.74}
            fontSize="12"
            fontWeight={novo ? 700 : 600}
            textAnchor="middle"
            fill={novo ? '#3b6fe0' : '#1c2433'}
           
          >
            {n}
          </text>
        );
      })}
    </svg>
  );
}

/** O Cinco em linha: o tabuleiro de madeira, pedras pretas e brancas, e a linha de cinco que venceu. */
function CapaCincoEmLinha() {
  const passo = 13;
  const pedras: [number, number, 'p' | 'b'][] = [
    [2, 6, 'p'],
    [3, 5, 'p'],
    [4, 4, 'p'],
    [5, 3, 'p'],
    [6, 2, 'p'],
    [3, 3, 'b'],
    [4, 5, 'b'],
    [5, 4, 'b'],
    [2, 4, 'b'],
    [6, 4, 'b'],
    [7, 3, 'p'],
  ];
  const x0 = 28;
  const y0 = 8;
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#1b1611" />
      <rect x={x0 - 8} y={y0 - 6} width={passo * 8 + 16} height={passo * 8 + 12} rx="4" fill="#d9b26f" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} stroke="#8a6a3a" strokeWidth="0.6">
          <line x1={x0 + i * passo} y1={y0} x2={x0 + i * passo} y2={y0 + passo * 8} />
          <line x1={x0} y1={y0 + i * passo} x2={x0 + passo * 8} y2={y0 + i * passo} />
        </g>
      ))}
      <line x1={x0 + 2 * passo} y1={y0 + 6 * passo} x2={x0 + 6 * passo} y2={y0 + 2 * passo} stroke="#e5484d" strokeWidth="9" strokeLinecap="round" opacity="0.45" />
      {pedras.map(([c, l, cor]) => (
        <circle
          key={`${c}-${l}`}
          cx={x0 + c * passo}
          cy={y0 + l * passo}
          r="5.4"
          fill={cor === 'p' ? '#1d1d1f' : '#f4f1ea'}
          stroke={cor === 'p' ? '#000' : '#bdb6a6'}
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}

/** A Mancala: o tabuleiro de madeira com as duas fileiras de casas, os depósitos e as sementes. */
function CapaMancala() {
  const sementes = ['#e5484d', '#f2b84b', '#4f7df5', '#3fb27f', '#c86bd9'];
  const casa = (cx: number, cy: number, n: number, chave: string) => (
    <g key={chave}>
      <ellipse cx={cx} cy={cy} rx="6.4" ry="6.4" fill="#6b4423" />
      {Array.from({ length: n }, (_, k) => (
        <circle
          key={k}
          cx={cx + Math.cos(k * 2.4) * (k ? 3 : 0)}
          cy={cy + Math.sin(k * 2.4) * (k ? 3 : 0)}
          r="1.8"
          fill={sementes[(k + Math.round(cx)) % sementes.length]}
        />
      ))}
    </g>
  );
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#17130f" />
      <rect x="8" y="30" width="144" height="60" rx="26" fill="#a9733f" stroke="#7a4f27" strokeWidth="2" />
      <ellipse cx="25" cy="60" rx="10" ry="22" fill="#6b4423" />
      <ellipse cx="135" cy="60" rx="10" ry="22" fill="#6b4423" />
      {[0, 1, 2, 3, 4, 5].map((i) => casa(44 + i * 14.4, 47, [4, 3, 5, 4, 0, 6][i], `a${i}`))}
      {[0, 1, 2, 3, 4, 5].map((i) => casa(44 + i * 14.4, 73, [2, 4, 4, 1, 5, 4][i], `b${i}`))}
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <circle key={k} cx={132 + (k % 2) * 6} cy={46 + k * 4} r="2.3" fill={sementes[k % sementes.length]} />
      ))}
    </svg>
  );
}
