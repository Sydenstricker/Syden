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
    case 'corrida':
      return <CapaCorrida />;
    case 'festa':
      return <CapaFesta />;
    case 'briga':
      return <CapaBriga />;
    case 'blocos':
      return <CapaBlocos />;
    case 'plataforma':
      return <CapaPlataforma />;
    case 'golfe':
      return <CapaGolfe />;
    case 'tabuleiro':
      return <CapaTabuleiro />;
    case 'cidades':
      return <CapaCidades />;
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
    case 'palavra':
      return <CapaPalavraSecreta />;
    case 'monstros':
      return <CapaMonstros />;
    case 'paises':
      return <CapaPaises />;
    case 'mitologia':
      return <CapaMitologia />;
  }
}

/**
 * A Briga na horta: a cerca, os canteiros, e o coelho (o primeiro desenho do soco da folha web/public/briga/coelho.png)
 * diante de uma raposa desenhada como no jogo.
 */
function CapaBriga() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#ecc9a8" />
      <path d="M0 60 Q40 40 80 56 T160 50 V80 H0 Z" fill="#8e9a6c" />
      <rect y="70" width="160" height="14" fill="#7a8f58" />
      <rect y="73" width="160" height="2" fill="#b08a62" />
      <rect y="79" width="160" height="2" fill="#b08a62" />
      <rect y="84" width="160" height="36" fill="#8a6a4c" />
      <rect y="92" width="160" height="7" fill="#94735a" />
      <rect y="106" width="160" height="7" fill="#7e5f44" />
      <g fill="#cf7440">
        <rect x="104" y="66" width="15" height="22" />
        <rect x="106" y="54" width="14" height="12" />
      </g>
      <rect x="106" y="49" width="4" height="5" fill="#a85a32" />
      <rect x="113" y="49" width="4" height="5" fill="#a85a32" />
      <rect x="110" y="70" width="6" height="14" fill="#f3e6d4" />
      <rect x="99" y="58" width="6" height="5" fill="#cf7440" />
      <rect x="108" y="88" width="3" height="8" fill="#4e3428" />
      <rect x="115" y="88" width="3" height="8" fill="#4e3428" />
      <rect x="117" y="76" width="9" height="5" fill="#a85a32" />
      <path d="M96 60 l4 -4 l1 5 l5 -1 l-4 4 l3 4 l-5 -1 l-2 5 l-1 -5 l-5 0 z" fill="#fff6c8" />
      <svg x="30" y="30" width="76" height="76" viewBox="1040 0 80 80" style={{ imageRendering: 'pixelated' }}>
        <image href={`${import.meta.env.BASE_URL}briga/coelho.png`} width="2560" height="80" />
      </svg>
    </svg>
  );
}

/**
 * A Corrida dos coelhos: a pista em perspectiva, com a zebra, e o próprio coelho no kart (um dos 24 desenhos da folha
 * web/public/corrida/coelho-kart.png, de três quartos).
 */
function CapaCorrida() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#e8b49a" />
      <rect y="34" width="160" height="10" fill="#9c869a" />
      <rect y="40" width="160" height="80" fill="#62964a" />
      <path d="M70 40 L90 40 L150 120 L10 120 Z" fill="#c4463e" />
      <path d="M72 40 L88 40 L140 120 L20 120 Z" fill="#6a626c" />
      <path d="M79.5 44 L80.5 44 L81 52 L79 52 Z M79 60 L81 60 L82 74 L78 74 Z M77.5 86 L82.5 86 L84 108 L76 108 Z" fill="#ded6c4" />
      <svg x="48" y="44" width="72" height="72" viewBox="180 0 60 60" style={{ imageRendering: 'pixelated' }}>
        <image href={`${import.meta.env.BASE_URL}corrida/coelho-kart.png`} width="1440" height="60" />
      </svg>
    </svg>
  );
}

/**
 * A Festa dos coelhos: as bandeirinhas da festa em cima, o alvo de um lado e os três copos do outro, com a cenoura
 * aparecendo debaixo de um deles — três dos microjogos numa capa só.
 */
function CapaFesta() {
  const bandeiras = ['#d9774f', '#e3b45a', '#7fae8a', '#7d93c4', '#c98aa8', '#d9774f', '#e3b45a', '#7fae8a'];
  const confete: [number, number, string][] = [
    [18, 40, '#e3b45a'],
    [70, 30, '#c98aa8'],
    [142, 38, '#7fae8a'],
    [96, 48, '#7d93c4'],
    [30, 104, '#c98aa8'],
    [150, 108, '#e3b45a'],
  ];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#4e4260" />
      <path d="M0 10 Q80 26 160 10" fill="none" stroke="#e8d9c0" strokeWidth="1.5" />
      {bandeiras.map((cor, i) => {
        const x = 6 + i * 20;
        const y = 10 + Math.sin((x / 160) * Math.PI) * 8;
        return <path key={i} d={`M${x} ${y} L${x + 14} ${y + 1} L${x + 7} ${y + 13} Z`} fill={cor} />;
      })}
      {confete.map(([x, y, cor], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" fill={cor} transform={`rotate(${i * 25} ${x + 2} ${y + 2})`} />
      ))}
      <circle cx="46" cy="74" r="26" fill="#e8d9c0" />
      <circle cx="46" cy="74" r="19" fill="#c4463e" />
      <circle cx="46" cy="74" r="12" fill="#e8d9c0" />
      <circle cx="46" cy="74" r="5" fill="#c4463e" />
      <path d="M106 90 L118 90 L112 101 Z" fill="#e07a2e" />
      <path d="M110 90 L107 86 M112 90 L112 85 M114 90 L117 86" stroke="#6fa356" strokeWidth="2" strokeLinecap="round" />
      {[88, 112, 136].map((x, i) => (
        <g key={x} transform={i === 1 ? 'translate(0 -16)' : undefined}>
          <path d={`M${x - 11} 100 L${x - 8} 74 L${x + 8} 74 L${x + 11} 100 Z`} fill="#b8743f" />
          <rect x={x - 12} y="98" width="24" height="4" rx="1" fill="#8e5530" />
          <rect x={x - 8} y="73" width="16" height="3" rx="1" fill="#d39a62" />
        </g>
      ))}
    </svg>
  );
}

/**
 * A Horta em cascata: a pilha de legumes subindo, de alturas diferentes, com a linha nova apagada embaixo e três cenouras
 * alinhadas brilhando (a combinação). As cores são as das peças do jogo (web/src/blocos/desenho.ts).
 */
function CapaBlocos() {
  const fundos = ['#e9b48a', '#a9c99a', '#e39a8e', '#b9a3c9', '#ecd58a', '#e8d6e0'];
  const bordas = ['#b9794e', '#6f9a5e', '#b2604f', '#7f6a96', '#bfa04c', '#b39aa8'];
  // de cima para baixo; -1 é vazio, 9 é a cenoura que brilha
  const pilha = [
    [-1, -1, -1, -1, 1, -1],
    [-1, 3, -1, -1, 5, -1],
    [9, 9, 9, 2, 4, -1],
    [4, 2, 5, 1, 3, 2],
    [1, 5, 3, 4, 0, 1],
    [2, 0, 1, 5, 2, 4],
  ];
  const lado = 18;
  const x0 = 80 - 3 * lado;
  const legume = (t: number, x: number, y: number) => {
    const cx = x + lado / 2;
    const cy = y + lado / 2;
    switch (t) {
      case 0:
        return <path d={`M${cx - 5} ${cy - 3} L${cx + 5} ${cy - 3} L${cx} ${cy + 6} Z`} fill="#e07a2e" />;
      case 1:
        return <circle cx={cx} cy={cy} r={5.5} fill="#8fbf6e" stroke="#4f7d3c" strokeWidth="1" />;
      case 2:
        return <circle cx={cx} cy={cy + 1} r={5} fill="#d0503c" />;
      case 3:
        return <ellipse cx={cx} cy={cy + 1} rx={3.5} ry={6} fill="#7a5296" transform={`rotate(30 ${cx} ${cy})`} />;
      case 4:
        return <ellipse cx={cx} cy={cy} rx={3} ry={6} fill="#f0cf5a" stroke="#8fbf6a" strokeWidth="1.2" />;
      default:
        return <circle cx={cx} cy={cy + 1} r={5} fill="#f6ece2" stroke="#b05a8a" strokeWidth="2" />;
    }
  };
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#2e2630" />
      <rect x={x0} y="0" width={lado * 6} height="120" fill="#352c38" />
      {pilha.map((linha, l) =>
        linha.map((t, c) => {
          if (t < 0) return null;
          const x = x0 + c * lado;
          const y = 4 + l * lado;
          const tipo = t === 9 ? 0 : t;
          return (
            <g key={`${l}-${c}`}>
              <rect x={x + 0.5} y={y + 0.5} width={lado - 1} height={lado - 1} rx="3" fill={fundos[tipo]} stroke={bordas[tipo]} />
              {legume(tipo, x, y)}
              {t === 9 && <rect x={x + 0.5} y={y + 0.5} width={lado - 1} height={lado - 1} rx="3" fill="#fbf3e4" opacity="0.45" />}
            </g>
          );
        }),
      )}
      {[0, 1, 2, 3, 4, 5].map((c) => (
        <rect key={c} x={x0 + c * lado + 0.5} y={4 + 6 * lado + 0.5} width={lado - 1} height={lado - 1} rx="3" fill={fundos[(c * 4 + 1) % 6]} opacity="0.35" />
      ))}
    </svg>
  );
}

/**
 * O Pulo do coelho: o mascote no meio do pulo, entre duas plataformas de grama sobre um buraco, com a mola e as nuvens. O
 * coelho é o quadro de passo largo da folha web/public/plataforma/coelho.png (o terceiro, de 17 x 31).
 */
function CapaPlataforma() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#ecc8a6" />
      <path d="M0 92 Q30 66 64 86 T128 80 T160 84 L160 120 L0 120 Z" fill="#b8a6b8" />
      <rect x="18" y="20" width="22" height="6" rx="3" fill="#f6ead8" />
      <rect x="108" y="14" width="30" height="7" rx="3" fill="#f6ead8" />
      <rect x="0" y="88" width="52" height="32" fill="#8c6248" />
      <rect x="0" y="88" width="52" height="5" fill="#78a85a" />
      <rect x="104" y="72" width="56" height="48" fill="#8c6248" />
      <rect x="104" y="72" width="56" height="5" fill="#78a85a" />
      <rect x="58" y="60" width="34" height="6" fill="#b88a5c" />
      <rect x="58" y="64" width="34" height="2" fill="#8a6040" />
      <rect x="24" y="80" width="14" height="3" fill="#d46a4e" />
      <path d="M26 84 H36 M25 86 H37" stroke="#c8bca8" strokeWidth="1" />
      <path d="M112 66 L116 58 L120 66 Z M122 66 L126 58 L130 66 Z" fill="#d8d0c4" />
      <path d="M66 34 Q74 30 80 34" fill="none" stroke="#f6ead8" strokeWidth="2" strokeDasharray="2 3" />
      <svg x="62" y="16" width="34" height="62" viewBox="34 0 17 31" style={{ imageRendering: 'pixelated' }}>
        <image href={`${import.meta.env.BASE_URL}plataforma/coelho.png`} width="153" height="31" />
      </svg>
    </svg>
  );
}

/**
 * A capa de um jogo de palavra do dia (o Termo, que roda embutido: SiteEmbutido.tsx). Só as peças coloridas, sem
 * letra nenhuma e sem o visual do site: o jogo é dele, e a capa é nossa.
 */
export function CapaPalavraDoDia() {
  const linhas = [
    ['#3a3a3c', '#d3ad69', '#3a3a3c', '#3a3a3c', '#3a3a3c'],
    ['#3aa394', '#3a3a3c', '#d3ad69', '#3a3a3c', '#3aa394'],
    ['#3aa394', '#3aa394', '#3aa394', '#3aa394', '#3aa394'],
  ];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#6e5c62" />
      {linhas.map((linha, l) =>
        linha.map((cor, c) => <rect key={`${l}-${c}`} x={22 + c * 24} y={18 + l * 29} width="20" height="24" rx="3" fill={cor} />),
      )}
    </svg>
  );
}

/**
 * A Palavra secreta: dois quadros lado a lado, cada um com as suas cores (a corrida), e as peças sem letra — o que a
 * sala vê dos outros. Outra cor de fundo que a do Termo, para as duas capas não se confundirem.
 */
function CapaPalavraSecreta() {
  const cor = ['#3a3a3c', '#d3ad69', '#3aa394'];
  const quadros = [
    [
      [0, 1, 0, 0, 0],
      [2, 0, 1, 0, 2],
      [2, 2, 2, 2, 2],
    ],
    [
      [0, 0, 1, 0, 1],
      [1, 2, 0, 0, 2],
      [2, 2, 0, 2, 2],
    ],
  ];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#24304a" />
      {quadros.map((linhas, q) =>
        linhas.map((linha, l) =>
          linha.map((c, i) => <rect key={`${q}-${l}-${i}`} x={12 + q * 72 + i * 13} y={30 + l * 22} width="11" height="18" rx="2" fill={cor[c]} />),
        ),
      )}
      <circle cx="44" cy="17" r="6" fill="#f2c9a0" />
      <circle cx="116" cy="17" r="6" fill="#a0c4f2" />
    </svg>
  );
}

/**
 * Monstros de fantasia (o quiz de adivinhar): a cabeça de um dragão de perfil, nossa e genérica, e embaixo uma linha de
 * chute com as três cores e a seta — o que o jogo é.
 */
function CapaMonstros() {
  const linha = ['#3aa394', '#3aa394', '#c8553d', '#d3ad69', '#3aa394'];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#2b1f3a" />
      <g fill="#7a4fbf">
        <path d="M46 70 Q44 44 66 34 L60 14 L76 30 Q84 27 92 30 L98 12 L100 34 Q118 40 124 54 L120 62 Q110 60 104 64 L98 70 Q80 78 46 70 Z" />
      </g>
      <path d="M104 64 L112 70 L102 72 Z" fill="#f2e6c9" />
      <circle cx="94" cy="44" r="4" fill="#f2c94c" />
      <path d="M94 41 L94 47" stroke="#2b1f3a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M118 56 L124 56" stroke="#2b1f3a" strokeWidth="2" strokeLinecap="round" />
      {linha.map((cor, i) => (
        <rect key={i} x={22 + i * 24} y="86" width="20" height="20" rx="3" fill={cor} />
      ))}
      <path d="M80 102 L80 90 M75 95 L80 90 L85 95" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mitologia: uma coluna de templo com o raio por cima, e a linha de chute. */
function CapaMitologia() {
  const linha = ['#d3ad69', '#3aa394', '#3aa394', '#a8473a'];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#3a2a1c" />
      <g fill="#e8dcc0">
        <rect x="58" y="22" width="44" height="7" rx="1" />
        <rect x="62" y="29" width="36" height="4" />
        <rect x="66" y="33" width="8" height="34" />
        <rect x="86" y="33" width="8" height="34" />
        <rect x="58" y="67" width="44" height="7" rx="1" />
      </g>
      <path d="M112 14 L100 40 L110 40 L102 62 L124 32 L113 32 L120 14 Z" fill="#f2c94c" />
      {linha.map((cor, i) => (
        <rect key={i} x={30 + i * 26} y="86" width="22" height="20" rx="3" fill={cor} />
      ))}
    </svg>
  );
}

/** Países (o Worldle nosso): o globo com os meridianos, e a linha de chute com a seta de direção. */
function CapaPaises() {
  const linha = ['#d3ad69', '#3aa394', '#a8473a', '#3aa394'];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#16324a" />
      <circle cx="80" cy="44" r="32" fill="#2f7fb8" />
      <path d="M62 30 Q70 22 82 26 Q90 30 86 40 Q78 44 74 54 Q66 58 62 48 Q56 40 62 30 Z" fill="#5fb873" />
      <path d="M90 50 Q100 46 104 54 Q102 64 94 66 Q88 60 90 50 Z" fill="#5fb873" />
      <g fill="none" stroke="#bfe0f5" strokeWidth="1" opacity="0.6">
        <ellipse cx="80" cy="44" rx="14" ry="32" />
        <path d="M48 44 H112 M53 28 H107 M53 60 H107" />
      </g>
      {linha.map((cor, i) => (
        <rect key={i} x={30 + i * 26} y="86" width="22" height="20" rx="3" fill={cor} />
      ))}
      <path d="M36 101 L46 91 M40 91 L46 91 L46 97" fill="none" stroke="#1d1d1f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

/**
 * O Tabuleiro da turma: a volta de casas coloridas em cima da grama, o dado no meio e a cenoura dourada numa das casas. Pixels
 * grandes, como o tabuleiro do jogo (JogoTabuleiro.tsx).
 */
function CapaTabuleiro() {
  const cores = ['#8fb86a', '#8fb86a', '#c46a52', '#8fb86a', '#8e7cc3'];
  const casas: [number, number][] = [];
  for (let c = 0; c < 7; c++) casas.push([c, 0]);
  for (let l = 1; l < 4; l++) casas.push([6, l]);
  for (let c = 6; c >= 0; c--) casas.push([c, 4]);
  for (let l = 3; l > 0; l--) casas.push([0, l]);
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true" shapeRendering="crispEdges">
      <rect width="160" height="120" fill="#4a6438" />
      <rect x="10" y="12" width="140" height="100" fill="#62804a" />
      {casas.map(([c, l], i) => (
        <g key={i}>
          <rect x={13 + c * 20} y={15 + l * 20} width="18" height="18" fill="#3e3428" />
          <rect x={14 + c * 20} y={16 + l * 20} width="16" height="14" fill={i === 0 ? '#e8d9c0' : cores[i % cores.length]} />
        </g>
      ))}
      {/* o dado */}
      <rect x="60" y="44" width="34" height="34" fill="#a89276" />
      <rect x="60" y="42" width="34" height="32" fill="#f3ead8" />
      {[
        [66, 48],
        [82, 48],
        [74, 56],
        [66, 64],
        [82, 64],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="6" height="6" fill="#5a3a2a" />
      ))}
      {/* a cenoura dourada, numa casa de cima */}
      <rect x="96" y="2" width="4" height="8" fill="#7fae5a" />
      <rect x="102" y="4" width="4" height="6" fill="#7fae5a" />
      <rect x="92" y="10" width="16" height="6" fill="#f2c46a" />
      <rect x="94" y="16" width="12" height="6" fill="#e3a640" />
      <rect x="96" y="22" width="8" height="4" fill="#d08e2c" />
      <rect x="98" y="26" width="4" height="4" fill="#b8741e" />
      <rect x="94" y="12" width="4" height="2" fill="#fff1c8" />
    </svg>
  );
}

/**
 * Cidades à venda: um pedaço da volta de casas nas cores das regiões, uma delas com a borda do dono e dois prédios, a
 * moeda e os dois dados no meio.
 */
function CapaCidades() {
  const cores = ['#6fa86a', '#3f8a72', '#e0b04a', '#d98448', '#b8743f', '#6d8fc4', '#9a72b8'];
  const casas: [number, number][] = [];
  for (let c = 0; c < 6; c++) casas.push([c, 0]);
  for (let l = 1; l < 4; l++) casas.push([5, l]);
  for (let c = 4; c >= 0; c--) casas.push([c, 3]);
  for (let l = 2; l > 0; l--) casas.push([0, l]);
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true" shapeRendering="crispEdges">
      <rect width="160" height="120" fill="#22382c" />
      <rect x="8" y="8" width="144" height="104" fill="#2f4a3a" />
      {casas.map(([c, l], i) => (
        <rect key={i} x={12 + c * 23} y={12 + l * 24} width="21" height="22" fill={i % 4 === 0 ? '#e8dcc4' : cores[i % cores.length]} />
      ))}
      {/* a cidade com dono e prédios */}
      <rect x="59" y="13" width="19" height="20" fill="none" stroke="#f3ead8" strokeWidth="2" />
      <rect x="62" y="24" width="5" height="5" fill="#f3ead8" />
      <rect x="69" y="24" width="5" height="5" fill="#f3ead8" />
      {/* os dois dados */}
      {[52, 82].map((x, k) => (
        <g key={x}>
          <rect x={x} y="50" width="24" height="24" fill="#a89276" />
          <rect x={x} y="48" width="24" height="23" fill="#f3ead8" />
          {(k === 0 ? [[5, 5], [15, 15]] : [[5, 5], [10, 10], [15, 15]]).map(([dx, dy], i) => (
            <rect key={i} x={x + dx} y={48 + dy} width="4" height="4" fill="#5a3a2a" />
          ))}
        </g>
      ))}
    </svg>
  );
}

/**
 * O Minigolfe da toca: a grama em faixas vista de cima, a borda de madeira, um cogumelo, o buraco com a bandeira e a bola
 * chegando, com o rastro pontilhado da tacada.
 */
function CapaGolfe() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true" shapeRendering="crispEdges">
      <rect width="160" height="120" fill="#55804c" />
      <rect x="10" y="14" width="140" height="92" fill="#d8c49a" />
      <rect x="14" y="18" width="132" height="84" fill="#7fae6a" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={14 + i * 18} y="18" width="9" height="84" fill="#76a462" />
      ))}
      <rect x="40" y="52" width="26" height="22" fill="#dcc38e" />
      <circle cx="122" cy="34" r="7" fill="#c4614e" />
      <rect x="119" y="30" width="3" height="3" fill="#ead9c0" />
      <rect x="124" y="35" width="2" height="2" fill="#ead9c0" />
      <ellipse cx="112" cy="84" rx="7" ry="6" fill="#4a3e34" />
      <ellipse cx="112" cy="84" rx="5" ry="4" fill="#2a2420" />
      <rect x="112" y="50" width="2" height="34" fill="#e8e0d0" />
      <path d="M114 50 L132 56 L114 62 Z" fill="#d9774f" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={34 + i * 10} y={96 - i * 1.5} width="3" height="2" fill="#f4ecdc" opacity={0.45 + i * 0.08} />
      ))}
      <circle cx="98" cy="86" r="4" fill="#f4ecdc" />
      <rect x="96" y="84" width="2" height="2" fill="#fffaf0" />
    </svg>
  );
}
