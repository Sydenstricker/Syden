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
    case 'golfe3d':
      return <CapaGolfe3D />;
    case 'futebol':
      return <CapaFutebol />;
    case 'tocas':
      return <CapaTocas />;
    case 'caca':
      return <CapaCaca />;
    case 'transito':
      return <CapaTransito />;
    case 'ponte':
      return <CapaPonte />;
    case 'nave':
      return <CapaNave />;
    case 'balao':
      return <CapaBalao />;
    case 'jato':
      return <CapaJato />;
    case 'barco':
      return <CapaBarco />;
    case 'carrinhos':
      return <CapaCarrinhos />;
    case 'chefe':
      return <CapaChefe />;
    case 'duelo':
      return <CapaDuelo />;
    case 'torre':
      return <CapaTorre />;
    case 'cozinha':
      return <CapaCozinha />;
    case 'skate':
      return <CapaSkate />;
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
    case 'domino':
      return <CapaDomino />;
    case 'truco':
      return <CapaTruco />;
    case 'damas':
      return <CapaDamas />;
    case 'naval':
      return <CapaNaval />;
    case 'xadrez':
      return <CapaXadrez />;
    case 'partida-de-xadrez':
      return <CapaPartidaDeXadrez />;
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

/** A partida de xadrez: o tabuleiro de lado, com o rei e a dama de cada cor frente a frente. */
function CapaPartidaDeXadrez() {
  const lado = 15;
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#2b2430" />
      {Array.from({ length: 64 }, (_, i) => {
        const c = i % 8;
        const l = Math.floor(i / 8);
        return <rect key={i} x={20 + c * lado} y={0 + l * lado} width={lado} height={lado} fill={(c + l) % 2 ? '#a5734f' : '#ecd5b0'} />;
      })}
      {(['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'] as const).map((p, c) => (
        <text key={'p' + c} x={20 + c * lado + lado / 2} y={lado - 3} fontSize="13" textAnchor="middle" fill="#2a2024">
          {p + '︎'}
        </text>
      ))}
      {(['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'] as const).map((p, c) => (
        <text key={'b' + c} x={20 + c * lado + lado / 2} y={8 * lado - 3} fontSize="13" textAnchor="middle" fill="#fffaf0" stroke="#2a2024" strokeWidth="0.6">
          {p + '︎'}
        </text>
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
/** Os pontos de uma metade da pedra de dominó (0 a 6), num quadrado de lado `l` com o canto em (x, y). */
function pontosDoDomino(n: number, x: number, y: number, l: number, chave: string) {
  const posicoes: Record<number, [number, number][]> = {
    0: [],
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return posicoes[n].map(([i, j], k) => (
    <circle key={`${chave}${k}`} cx={x + (l * (i + 1)) / 4} cy={y + (l * (j + 1)) / 4} r={l / 11} fill="#1d2433" />
  ));
}

/**
 * O Dominó (refeita em 05/11/2026, pedido dele, no jeito da mesa 3D): o feltro com a borda de madeira em perspectiva, as
 * pedras com espessura (a lateral mais escura) e sombra, uma carroça atravessada, e duas pedras em pé, de quem joga.
 */
function CapaDomino() {
  const l = 18;
  const pedra = (x: number, y: number, a: number, b: number, deitada: boolean, chave: string) => {
    const w = deitada ? l * 2 : l, h = deitada ? l : l * 2;
    return (
      <g key={chave}>
        <rect x={x + 2} y={y + 5} width={w} height={h} rx="3" fill="rgba(0,0,0,0.3)" />
        <rect x={x} y={y + 3} width={w} height={h} rx="3" fill="#c9bfa6" />
        <rect x={x} y={y} width={w} height={h} rx="3" fill="#fbf6ea" stroke="#d8cdb2" strokeWidth="0.8" />
        {deitada ? (
          <line x1={x + l} y1={y + 3} x2={x + l} y2={y + l - 3} stroke="#c9bfa6" strokeWidth="1.2" />
        ) : (
          <line x1={x + 3} y1={y + l} x2={x + l - 3} y2={y + l} stroke="#c9bfa6" strokeWidth="1.2" />
        )}
        {pontosDoDomino(a, x, y, l, `${chave}a`)}
        {pontosDoDomino(b, deitada ? x + l : x, deitada ? y : y + l, l, `${chave}b`)}
      </g>
    );
  };
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#3a2616" />
      <path d="M14 8 H146 L158 112 H2 Z" fill="#5a3b22" />
      <path d="M20 14 H140 L150 106 H10 Z" fill="#2a6e46" />
      <path d="M20 14 H140 L142 30 H18 Z" fill="#2f7a4f" opacity="0.6" />
      {pedra(14, 44, 2, 5, true, 'p1')}
      {pedra(52, 35, 5, 5, false, 'p2')}
      {pedra(72, 44, 5, 3, true, 'p3')}
      {pedra(112, 44, 3, 6, true, 'p4')}
      {/* as minhas, em pé na frente */}
      <g transform="rotate(-6 58 96)">{pedra(46, 82, 6, 1, false, 'm1')}</g>
      <g transform="rotate(5 86 96)">{pedra(74, 82, 4, 4, false, 'm2')}</g>
    </svg>
  );
}

/** O Truco: o feltro, três cartas abertas em leque e o baralho atravessado, com o grito de truco em cima. */
function CapaTruco() {
  const carta = (x: number, y: number, giro: number, valor: string, naipe: string, cor: string, chave: string) => (
    <g key={chave} transform={`rotate(${giro} ${x + 15} ${y + 44})`}>
      <rect x={x} y={y} width="30" height="44" rx="3.5" fill="#fbf8f0" stroke="#cfc7b3" strokeWidth="1" />
      <text x={x + 4} y={y + 11} fontSize="9" fontWeight="700" fill={cor}>
        {valor}
      </text>
      <text x={x + 15} y={y + 30} fontSize="16" textAnchor="middle" fill={cor}>
        {naipe}
      </text>
    </g>
  );
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#8c2f2a" />
      <ellipse cx="80" cy="64" rx="74" ry="50" fill="#a23a33" />
      <g transform="rotate(90 36 58)">
        <rect x="22" y="40" width="28" height="40" rx="3" fill="#2f4d8f" stroke="#e7dcc2" strokeWidth="1.5" />
        <path d="M27 45 L45 75 M45 45 L27 75" stroke="#e7dcc2" strokeWidth="1" opacity="0.6" />
      </g>
      {carta(64, 46, -18, '7', '♦', '#c0392b', 'c1')}
      {carta(80, 40, 0, 'A', '♠', '#1d2433', 'c2')}
      {carta(96, 46, 18, '4', '♣', '#1d2433', 'c3')}
      <text x="118" y="28" fontSize="16" fontWeight="800" fill="#ffd66b" textAnchor="middle" transform="rotate(-8 118 28)">
        3!
      </text>
    </svg>
  );
}

/** As Damas: um pedaço do tabuleiro, peças claras e escuras, e uma dama (com a coroa). */
function CapaDamas() {
  const casas = [];
  for (let l = 0; l < 6; l++) {
    for (let c = 0; c < 8; c++) {
      casas.push(<rect key={`${l}-${c}`} x={c * 20} y={l * 20} width="20" height="20" fill={(l + c) % 2 ? '#7a4f2c' : '#e8d3ae'} />);
    }
  }
  const peca = (c: number, l: number, clara: boolean, dama = false) => {
    const cx = c * 20 + 10;
    const cy = l * 20 + 10;
    return (
      <g key={`p${c}-${l}`}>
        <circle cx={cx} cy={cy + 1.5} r="8" fill="rgba(0,0,0,0.35)" />
        <circle cx={cx} cy={cy} r="8" fill={clara ? '#f4ecdc' : '#2b2230'} stroke={clara ? '#c9b98f' : '#14101a'} strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r="5" fill="none" stroke={clara ? '#d8c9a3' : '#463a4f'} strokeWidth="1" />
        {dama && (
          <path
            d={`M${cx - 4} ${cy + 2} L${cx - 4} ${cy - 3} L${cx - 2} ${cy} L${cx} ${cy - 4} L${cx + 2} ${cy} L${cx + 4} ${cy - 3} L${cx + 4} ${cy + 2} Z`}
            fill="#e5b53b"
          />
        )}
      </g>
    );
  };
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      {casas}
      {peca(1, 0, false)}
      {peca(3, 0, false)}
      {peca(0, 1, false)}
      {peca(4, 1, false)}
      {peca(3, 2, false)}
      {peca(2, 3, true, true)}
      {peca(5, 4, true)}
      {peca(1, 4, true)}
      {peca(7, 4, true)}
      {peca(6, 5, true)}
    </svg>
  );
}

/**
 * A Batalha naval (refeita em 05/11/2026, pedido dele, no jeito do mar 3D com os navios do Pirate Kit): o mar em grade com
 * as ondas, um galeão de velas brancas atingido (o fogo e a fumaça), o respingo de um tiro na água e a mira.
 */
function CapaNaval() {
  const grade = [];
  for (let i = 1; i < 8; i++) grade.push(<line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="120" stroke="#cfeefa" strokeWidth="0.6" opacity="0.45" />);
  for (let j = 1; j < 6; j++) grade.push(<line key={`h${j}`} x1="0" y1={j * 20} x2="160" y2={j * 20} stroke="#cfeefa" strokeWidth="0.6" opacity="0.45" />);
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#3a9bd0" />
      {grade}
      {[18, 46, 74, 102].map((y, k) => (
        <path key={y} d={`M${k % 2 ? 8 : 0} ${y} q6 -4 12 0 t12 0 t12 0`} fill="none" stroke="#e8f8ff" strokeWidth="1.2" opacity="0.5" />
      ))}
      {/* o galeão: o casco de madeira, o castelo de popa, os mastros e as velas */}
      <ellipse cx="62" cy="86" rx="40" ry="7" fill="#1f6f9c" opacity="0.6" />
      <path d="M24 72 L100 72 L92 88 L32 88 Z" fill="#a8683a" />
      <path d="M24 72 L100 72 L98 76 L26 76 Z" fill="#c98a52" />
      <path d="M78 64 H100 V72 H78 Z" fill="#8a5430" />
      <rect x="36" y="78" width="4" height="3" fill="#3a2616" />
      <rect x="50" y="78" width="4" height="3" fill="#3a2616" />
      <rect x="64" y="78" width="4" height="3" fill="#3a2616" />
      <rect x="44" y="30" width="2.4" height="42" fill="#6a4428" />
      <rect x="66" y="24" width="2.4" height="48" fill="#6a4428" />
      <path d="M32 36 Q45 30 58 36 L56 54 Q45 50 34 54 Z" fill="#f6f1e6" />
      <path d="M54 30 Q67 24 80 30 L78 52 Q67 48 56 52 Z" fill="#fbf8f0" />
      <path d="M67 18 L78 21 L67 24 Z" fill="#e3453a" />
      {/* o acerto: fogo e fumaça */}
      <circle cx="40" cy="70" r="7" fill="#ff8a2a" opacity="0.9" />
      <circle cx="40" cy="68" r="4" fill="#ffd66b" />
      <circle cx="36" cy="58" r="5" fill="#5d6670" opacity="0.6" />
      <circle cx="31" cy="50" r="4" fill="#5d6670" opacity="0.4" />
      {/* o tiro na água: o respingo */}
      <g fill="#ffffff">
        <ellipse cx="128" cy="96" rx="9" ry="2.6" opacity="0.7" />
        <path d="M122 96 L124 84 L127 95 L129 80 L131 95 L134 86 L135 96 Z" opacity="0.9" />
      </g>
      <g stroke="#ff4d4d" strokeWidth="2" fill="none">
        <circle cx="130" cy="34" r="9" />
        <path d="M118 34 H142 M130 22 V46" />
      </g>
    </svg>
  );
}

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
 * A Caça às pragas da horta: o céu sobre a cerca e a horta, um corvo de asas abertas no meio da mira, e um gafanhoto pulando.
 */
/** O rolê do coelho: o skate no ar sobre a rampa, as rodinhas para cima, e o rastro do pulo. */
function CapaSkate() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#bfe4f2" />
      <rect y="92" width="160" height="28" fill="#8a8f9e" />
      <path d="M0 92 L0 52 Q0 92 52 92 Z" fill="#6f7385" />
      <rect x="0" y="48" width="6" height="44" fill="#e8743a" />
      <path d="M38 70 Q70 18 112 40" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" />
      <g transform="rotate(-24 112 44)">
        <rect x="88" y="40" width="48" height="7" rx="3.5" fill="#d9774f" />
        <rect x="92" y="47" width="40" height="2" fill="#7a4a30" />
        <circle cx="96" cy="52" r="3.5" fill="#f4ecdc" />
        <circle cx="128" cy="52" r="3.5" fill="#f4ecdc" />
      </g>
      <rect x="60" y="96" width="70" height="4" rx="2" fill="#3a6fc4" />
      <rect x="66" y="100" width="3" height="8" fill="#3a6fc4" />
      <rect x="121" y="100" width="3" height="8" fill="#3a6fc4" />
    </svg>
  );
}

/** A cozinha da toca: o fogão com a frigideira e o hambúrguer, a chama embaixo e o vapor subindo. */
function CapaCozinha() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#f3e3c4" />
      <rect y="78" width="160" height="42" fill="#2fae8f" />
      <rect y="76" width="160" height="6" fill="#d9774f" />
      <rect x="40" y="58" width="80" height="20" rx="3" fill="#b9b4ae" />
      <rect x="46" y="62" width="10" height="4" rx="1" fill="#e3453a" />
      <ellipse cx="80" cy="56" rx="30" ry="6" fill="#3d3540" />
      <rect x="108" y="52" width="26" height="5" rx="2" fill="#3d3540" />
      <ellipse cx="80" cy="50" rx="18" ry="5" fill="#c98a4a" />
      <ellipse cx="80" cy="47" rx="18" ry="5" fill="#8a4a2a" />
      <ellipse cx="80" cy="43" rx="18" ry="6" fill="#e9a94a" />
      <circle cx="74" cy="41" r="1.2" fill="#fff3d0" />
      <circle cx="84" cy="40" r="1.2" fill="#fff3d0" />
      {[66, 80, 94].map((x, k) => (
        <path key={x} d={`M${x} 30 q -5 -7 0 -14 q 5 -7 0 -14`} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity={0.75 - k * 0.12} />
      ))}
    </svg>
  );
}

/** A torre do celeiro: o celeiro vermelho por dentro, tábuas e fardos subindo, o coelho pulando e o cata-vento lá no alto. */
function CapaTorre() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#8fc6e8" />
      <path d="M30 120 V30 L80 6 L130 30 V120 Z" fill="#b8423a" />
      <path d="M40 120 V36 L80 16 L120 36 V120 Z" fill="#6e3a2a" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="40" y={40 + i * 14} width="80" height="1.5" fill="#5a2e22" />
      ))}
      {/* as tábuas e o fardo */}
      <rect x="46" y="104" width="36" height="5" fill="#d9a05a" />
      <rect x="84" y="86" width="30" height="5" fill="#d9a05a" />
      <rect x="50" y="66" width="18" height="12" fill="#e8c35a" stroke="#b8902e" strokeWidth="1" />
      <rect x="76" y="50" width="32" height="5" fill="#d9a05a" />
      {/* a pá caindo, com a marca embaixo */}
      <g transform="translate(100 62) rotate(20)">
        <rect x="-1" y="-10" width="2" height="12" fill="#8a6a44" />
        <path d="M-4 2 H4 L3 8 H-3 Z" fill="#9aa4b0" />
      </g>
      <rect x="90" y="84" width="16" height="2" fill="#ffd34d" opacity="0.8" />
      {/* o coelho pulando */}
      <g transform="translate(64 92)">
        <ellipse cx="0" cy="6" rx="6" ry="5" fill="#3f74d8" />
        <circle cx="0" cy="-1" r="5" fill="#f2ecf7" />
        <path d="M-2 -5 L-4 -13 M2 -5 L4 -13" stroke="#f2ecf7" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      {/* o cata-vento */}
      <rect x="79" y="-2" width="2" height="12" fill="#3a3a3a" />
      <path d="M80 2 L92 0 L92 5 Z M80 2 L68 0 L68 5 Z" fill="#3a3a3a" />
      <circle cx="80" cy="2" r="2" fill="#f0c93a" />
    </svg>
  );
}

/** O Duelo de aviõezinhos: a horta de cima, dois teco-tecos se cruzando, a cenoura teleguiada com o rastro curvo e uma ervilha. */
function CapaDuelo() {
  const aviao = (x: number, y: number, giro: number, cor: string) => (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <rect x="-16" y="-3" width="32" height="7" rx="2" fill={cor} />
      <path d="M0 -12 L4 -4 L3 12 L-3 12 L-4 -4 Z" fill="#f2ecf7" stroke="#8a7a8a" strokeWidth="0.8" />
      <rect x="-7" y="10" width="14" height="3" fill={cor} />
      <circle cx="0" cy="-3" r="2.6" fill="#f6efe4" />
      <path d="M-1.5 -5 L-2.5 -10 M1.5 -5 L2.5 -10" stroke="#f6efe4" strokeWidth="1.6" />
    </g>
  );
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#86b862" />
      <rect x="0" y="56" width="160" height="10" fill="#cfa86a" />
      <rect x="74" y="0" width="10" height="120" fill="#cfa86a" />
      {[[10, 8], [96, 8], [10, 74], [96, 74]].map(([x, y]) => (
        <rect key={x + ',' + y} x={x} y={y} width="52" height="38" fill="#7a5236" />
      ))}
      {[[14, 12], [100, 12], [14, 78], [100, 78]].map(([x, y]) =>
        [0, 1, 2, 3].map((j) => <rect key={x + ',' + y + ',' + j} x={x} y={y + j * 9} width="44" height="2" fill="#4f9a3a" />),
      )}
      {/* o rastro curvo da cenoura e a cenoura */}
      <path d="M44 92 Q60 40 104 44" fill="none" stroke="#fff3e0" strokeWidth="2" strokeDasharray="3 4" />
      <g transform="translate(104 44) rotate(80)">
        <path d="M0 -8 L3 4 L-3 4 Z" fill="#ec7f2b" />
        <path d="M-2 4 L0 8 L2 4" fill="#4f9a3a" />
      </g>
      <circle cx="70" cy="30" r="3" fill="#7cc34a" stroke="#3f7a2a" strokeWidth="1" />
      {aviao(122, 34, 60, '#d8483c')}
      {aviao(40, 96, -30, '#3f74d8')}
    </svg>
  );
}

/** O chefe da turma: a toupeira-rei de capacete saindo da toca, as marcas do ataque no chão e dois coelhos com torrões. */
function CapaChefe() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#8fbf5e" />
      {[0, 20, 40, 60, 80, 100].map((y) => (
        <rect key={y} y={y} width="160" height="10" fill="#86b657" />
      ))}
      <ellipse cx="80" cy="56" rx="34" ry="12" fill="#5a3a22" />
      {/* a toupeira-rei */}
      <g transform="translate(80 40)">
        <ellipse cx="0" cy="14" rx="26" ry="18" fill="#4a4048" />
        <ellipse cx="0" cy="2" rx="20" ry="16" fill="#5a4e58" />
        <path d="M-18 -6 Q0 -26 18 -6 Z" fill="#f0c93a" />
        <rect x="-18" y="-7" width="36" height="5" fill="#d9a62a" />
        <circle cx="0" cy="-14" r="4" fill="#fff6c8" />
        <circle cx="-7" cy="3" r="2.5" fill="#1d1a22" />
        <circle cx="7" cy="3" r="2.5" fill="#1d1a22" />
        <ellipse cx="0" cy="10" rx="6" ry="4" fill="#f2a1b4" />
        <path d="M-24 18 l-10 4 M-24 22 l-10 0 M24 18 l10 4 M24 22 l10 0" stroke="#f2d0b8" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* as marcas do ataque */}
      {[[30, 92], [128, 86], [62, 104]].map(([x, y]) => (
        <ellipse key={x} cx={x} cy={y} rx="13" ry="5" fill="none" stroke="#e5564c" strokeWidth="2" strokeDasharray="4 3" />
      ))}
      {/* os coelhos com os torrões */}
      {[[44, 84, '#3f74d8'], [112, 98, '#e2a03a']].map(([x, y, cor]) => (
        <g key={String(x)} transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="8" rx="7" ry="6" fill={String(cor)} />
          <circle cx="0" cy="0" r="5" fill="#f2ecf7" />
          <path d="M-2 -4 L-3 -12 M2 -4 L3 -12" stroke="#f2ecf7" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="8" cy="-6" r="4" fill="#8ab8e0" stroke="#4f7fa8" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}

/** A Regata da toca: o riacho em perspectiva entre as margens de junco, a argola laranja e o barquinho com a esteira. */
function CapaBarco() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#7fb8e6" />
      <ellipse cx="40" cy="18" rx="18" ry="6" fill="#ffffff" />
      <ellipse cx="118" cy="24" rx="22" ry="7" fill="#ffffff" />
      <rect y="40" width="160" height="10" fill="#3f7f3a" />
      <rect y="48" width="160" height="72" fill="#79b856" />
      <path d="M62 50 L98 50 L156 120 L4 120 Z" fill="#2f7f8f" />
      <path d="M62 50 L4 120 L0 120 L0 112 L58 50 Z M98 50 L156 120 L160 120 L160 112 L102 50 Z" fill="#8a6a44" />
      {[[70, 62, 18], [88, 74, 26], [60, 90, 34], [96, 100, 30]].map(([x, y, w]) => (
        <rect key={x + ',' + y} x={x} y={y} width={w} height="2" fill="#bfe6ee" opacity="0.6" />
      ))}
      {[[24, 70], [16, 84], [136, 72], [146, 88], [32, 60], [128, 60]].map(([x, y]) => (
        <g key={x + ',' + y}>
          <rect x={x} y={y - 14} width="2" height="16" fill="#4f8a30" />
          <rect x={x - 1} y={y - 18} width="4" height="6" rx="2" fill="#7a4a2a" />
        </g>
      ))}
      {/* a argola */}
      <g transform="translate(80 66)">
        <ellipse rx="14" ry="6" fill="none" stroke="#f07a2a" strokeWidth="4" />
        <ellipse rx="14" ry="6" fill="none" stroke="#fff3e0" strokeWidth="4" strokeDasharray="6 8" />
      </g>
      {/* o barquinho com a esteira */}
      <path d="M70 112 L80 98 L90 112" fill="none" stroke="#e8f6f8" strokeWidth="2" opacity="0.8" />
      <g transform="translate(80 98)">
        <path d="M-12 0 L12 0 L8 8 L-8 8 Z" fill="#a8683a" />
        <rect x="-3" y="5" width="6" height="5" fill="#f07a2a" />
        <circle cx="0" cy="-5" r="4.5" fill="#f2ecf7" />
        <path d="M-2 -9 L-3 -17 M2 -9 L3 -17" stroke="#f2ecf7" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Os Carrinhos da toca: a pista de brinquedo de quatro faixas no chão de tábuas, com as zebras e dois carrinhos. */
function CapaCarrinhos() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#c79b6e" />
      {[14, 34, 54, 74, 94, 114].map((y) => (
        <rect key={y} y={y} width="160" height="1.5" fill="#b48a5f" />
      ))}
      <rect x="10" y="12" width="140" height="96" rx="10" fill="#5f8c6a" />
      <rect x="20" y="22" width="120" height="76" rx="36" fill="none" stroke="#e9f1f5" strokeWidth="30" />
      <rect x="20" y="22" width="120" height="76" rx="36" fill="none" stroke="#5d6577" strokeWidth="26" />
      <rect x="20" y="22" width="120" height="76" rx="36" fill="none" stroke="#e9f1f5" strokeWidth="1" />
      {[-6.5, 6.5].map((d) => (
        <rect key={d} x={20 - d} y={22 - d} width={120 + 2 * d} height={76 + 2 * d} rx={36 + d} fill="none" stroke="#c9cfdb" strokeWidth="0.8" strokeDasharray="4 4" />
      ))}
      <rect x="7" y="9" width="146" height="102" rx="49" fill="none" stroke="#e2463a" strokeWidth="2.5" strokeDasharray="5 5" />
      <rect x="33" y="35" width="94" height="50" rx="23" fill="none" stroke="#e2463a" strokeWidth="2.5" strokeDasharray="5 5" />
      <rect x="76" y="98" width="3" height="13" fill="#ffffff" />
      <rect x="79" y="98" width="3" height="13" fill="#2a2a2a" />
      <g transform="translate(56 102)">
        <rect x="-8" y="-3.5" width="16" height="7" rx="3" fill="#e2463a" />
        <circle cx="1" cy="0" r="2.6" fill="#f2ecf7" />
      </g>
      <g transform="translate(112 92) rotate(-28)">
        <rect x="-8" y="-3.5" width="16" height="7" rx="3" fill="#3d7fd6" />
        <circle cx="1" cy="0" r="2.6" fill="#ffd9a8" />
      </g>
    </svg>
  );
}

/** Os Coelhos a jato: a cidade à noite, a pista suspensa em perspectiva com as bordas de energia e a nave-cenoura com o rastro. */
function CapaJato() {
  const predios = [
    [0, 20, 30], [16, 14, 40], [28, 18, 24], [44, 12, 46], [54, 20, 34], [72, 14, 52], [84, 18, 28], [100, 12, 44], [110, 20, 36],
    [128, 14, 48], [140, 20, 30],
  ];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#1b1533" />
      <rect y="30" width="160" height="34" fill="#2a1f47" />
      {[[12, 8], [40, 16], [70, 6], [96, 12], [124, 4], [150, 14], [58, 22], [140, 26]].map(([x, y]) => (
        <rect key={x + ',' + y} x={x} y={y} width="1.5" height="1.5" fill="#fff6d8" />
      ))}
      {predios.map(([x, w, h]) => (
        <g key={x}>
          <rect x={x} y={64 - h} width={w} height={h} fill="#130f26" />
          {Array.from({ length: Math.floor(h / 7) }, (_, j) => (
            <rect key={j} x={x + 3} y={64 - h + 4 + j * 7} width={w - 6} height="2" fill={j % 3 ? '#f6c14a' : '#7a6a9a'} opacity="0.75" />
          ))}
        </g>
      ))}
      <rect y="64" width="160" height="56" fill="#3a2a55" />
      {/* a pista em perspectiva, com as bordas de energia */}
      <path d="M68 64 L92 64 L150 120 L10 120 Z" fill="#3b3f52" />
      <path d="M68 64 L10 120 L4 120 L66 64 Z" fill="#ff5fb8" />
      <path d="M92 64 L150 120 L156 120 L94 64 Z" fill="#4fe0ff" />
      <path d="M79 70 L81 70 L82 78 L78 78 Z M77 86 L83 86 L84 98 L76 98 Z" fill="#c9cfe0" opacity="0.7" />
      <path d="M40 92 H120" stroke="#4fe0ff" strokeWidth="1.5" opacity="0.8" />
      {/* a faixa de recarga */}
      <path d="M58 76 L102 76 L106 80 L54 80 Z" fill="#ff9bd8" opacity="0.6" />
      {/* a nave-cenoura, com o rastro */}
      <g transform="translate(80 104)">
        <path d="M-6 6 L6 6 L10 16 L-10 16 Z" fill="#4fe0ff" opacity="0.45" />
        <path d="M-16 2 L-4 -4 L4 -4 L16 2 L10 6 L-10 6 Z" fill="#4f9a3a" />
        <path d="M0 -14 L7 -2 L5 6 L-5 6 L-7 -2 Z" fill="#ec7f2b" />
        <path d="M-4 -2 H4 M-5 2 H5" stroke="#c45f1c" strokeWidth="1" />
        <circle cx="0" cy="-8" r="3.5" fill="#f6efe4" />
        <path d="M-2 -11 L-3 -18 M2 -11 L3 -18" stroke="#f6efe4" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* os riscos de vento */}
      <path d="M22 100 L34 90 M136 98 L126 88 M28 112 L42 100" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/** O Estoura-balão: a arena de terra cercada de feno, dois karts com os balões presos atrás, e um balão estourando. */
function CapaBalao() {
  const balao = (x: number, y: number, cor: string) => (
    <g key={x + ',' + y}>
      <path d={`M${x} ${y + 9} q 2 6 -1 12`} stroke="#f3ecdc" strokeWidth="1" fill="none" />
      <ellipse cx={x} cy={y} rx="6" ry="7.5" fill={cor} />
      <ellipse cx={x - 2} cy={y - 3} rx="1.6" ry="2.4" fill="#ffffff" opacity="0.6" />
      <path d={`M${x - 1.5} ${y + 7.5} h3 l-1.5 2 z`} fill={cor} />
    </g>
  );
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#9fd0ea" />
      <rect y="40" width="160" height="80" fill="#c99c62" />
      <path d="M0 40 H160 V48 H0 Z" fill="#7fb36a" />
      {[8, 34, 60, 86, 112, 138].map((x) => (
        <rect key={x} x={x} y="34" width="18" height="10" rx="2" fill="#e8c35a" stroke="#b8902e" strokeWidth="1" />
      ))}
      <ellipse cx="80" cy="84" rx="60" ry="22" fill="#b98a52" />
      {/* o kart azul, à esquerda, com dois balões */}
      <g transform="translate(46 88)">
        <rect x="-16" y="-6" width="32" height="12" rx="4" fill="#3f74d8" />
        <circle cx="-10" cy="7" r="4" fill="#2c2a33" />
        <circle cx="10" cy="7" r="4" fill="#2c2a33" />
        <circle cx="0" cy="-10" r="6" fill="#f2ecf7" />
        <path d="M-3 -15 l-2 -10 l3 0 z M3 -15 l2 -10 l-3 0 z" fill="#f2ecf7" />
      </g>
      {balao(30, 56, '#e2604c')}
      {balao(22, 64, '#f0c93a')}
      {/* o kart vermelho, à direita, com um balão e um estourando */}
      <g transform="translate(116 82)">
        <rect x="-16" y="-6" width="32" height="12" rx="4" fill="#d8483c" />
        <circle cx="-10" cy="7" r="4" fill="#2c2a33" />
        <circle cx="10" cy="7" r="4" fill="#2c2a33" />
        <circle cx="0" cy="-10" r="6" fill="#d9c2a0" />
        <path d="M-3 -15 l-2 -10 l3 0 z M3 -15 l2 -10 l-3 0 z" fill="#d9c2a0" />
      </g>
      {balao(134, 52, '#5bb35a')}
      <g transform="translate(140 66)" stroke="#fff3c4" strokeWidth="2" strokeLinecap="round">
        <path d="M0 -8 V-4 M0 4 V8 M-8 0 H-4 M4 0 H8 M-6 -6 L-3 -3 M3 3 L6 6 M6 -6 L3 -3 M-3 3 L-6 6" />
      </g>
      {/* o repolho rolando */}
      <circle cx="84" cy="96" r="6" fill="#6fae4a" />
      <path d="M80 94 q4 -3 8 0 M80 98 q4 3 8 0" stroke="#4a8a30" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/** A Esquadrilha da toca: a horta vista de cima, o aviãozinho de cenoura atirando, um corvo e o espantalho lá no alto. */
function CapaNave() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#86b862" />
      <rect y="52" width="160" height="9" fill="#cfa86a" />
      {[
        [14, 70, 44, 34],
        [104, 66, 42, 40],
        [16, 6, 34, 30],
      ].map(([x, y, w, h]) => (
        <g key={x + ',' + y}>
          <rect x={x} y={y} width={w} height={h} fill="#7a5236" />
          {Array.from({ length: Math.floor(w / 8) }, (_, i) =>
            Array.from({ length: Math.floor(h / 8) }, (_, j) => <rect key={i + '-' + j} x={x + 3 + i * 8} y={y + 3 + j * 8} width="3" height="3" fill={j % 2 ? '#4f9a3a' : '#e07a2a'} />),
          )}
        </g>
      ))}
      <circle cx="132" cy="22" r="11" fill="#4c8f3e" />
      <circle cx="129" cy="19" r="6" fill="#62a74f" />
      {/* a nuvem e a sombra dela */}
      <ellipse cx="74" cy="44" rx="22" ry="8" fill="#2f4a2a" opacity="0.25" />
      <g fill="#f4f6f8">
        <circle cx="62" cy="34" r="9" />
        <circle cx="74" cy="30" r="11" />
        <circle cx="86" cy="35" r="8" />
      </g>
      {/* o espantalho, de chapéu, no alto */}
      <g transform="translate(80 12)">
        <rect x="-14" y="-2" width="28" height="3" fill="#d9a64a" />
        <rect x="-7" y="-8" width="14" height="7" fill="#e3b65a" />
        <rect x="-5" y="1" width="10" height="8" fill="#f1d9b0" />
        <rect x="-3" y="3" width="2" height="2" fill="#d23c3c" />
        <rect x="1" y="3" width="2" height="2" fill="#d23c3c" />
      </g>
      {/* o corvo */}
      <g transform="translate(112 46)">
        <path d="M-2 0 L-12 -7 L-1 3 Z" fill="#2c2a33" />
        <path d="M2 0 L12 -7 L1 3 Z" fill="#3d3a47" />
        <ellipse cx="0" cy="1" rx="5" ry="7" fill="#2c2a33" />
        <path d="M-1 8 L0 11 L1 8 Z" fill="#e8a33a" />
      </g>
      {/* os tiros */}
      {[66, 76, 86, 96].map((y, k) => (
        <rect key={y} x={k % 2 ? 83 : 75} y={y - 20} width="2" height="6" fill="#ffd34d" />
      ))}
      {/* o aviãozinho de cenoura */}
      <g transform="translate(80 98)">
        <path d="M0 -14 L5 -4 L4 10 L-4 10 L-5 -4 Z" fill="#ec7f2b" />
        <path d="M-1 -14 L1 -14 L0 -18 Z" fill="#4f9a3a" />
        <rect x="-20" y="-2" width="40" height="6" rx="2" fill="#f2a24a" />
        <rect x="-8" y="9" width="16" height="3" fill="#f2a24a" />
        <circle cx="0" cy="-4" r="3" fill="#f6efe4" />
        <path d="M-2 -7 L-3 -12 M2 -7 L3 -12" stroke="#f6efe4" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** O trânsito da toca: o cruzamento em isométrico, com prédios nos cantos, dois carros esperando e um passando. */
/** A Ponte da toca: o vão com o rio, a treliça de madeira com o banzo de aço, e a carroça do coelho atravessando. */
function CapaPonte() {
  // a ponte vai de x = 30 a x = 130, com a pista em y = 64
  const nos = [30, 50, 70, 90, 110, 130];
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#9fd0e8" />
      <circle cx="132" cy="20" r="9" fill="#fff3c8" />
      <path d="M0 70 Q40 44 80 62 T160 56 V120 H0 Z" fill="#a9cf98" />
      <rect x="30" y="88" width="100" height="32" fill="#4f9fc4" />
      <path d="M36 96 h12 M70 104 h14 M104 94 h12" stroke="#d6eef8" strokeWidth="2" strokeLinecap="round" />
      <rect x="0" y="64" width="30" height="56" fill="#a77a4f" />
      <rect x="130" y="64" width="30" height="56" fill="#a77a4f" />
      <rect x="0" y="61" width="30" height="5" fill="#79b35a" />
      <rect x="130" y="61" width="30" height="5" fill="#79b35a" />
      {/* a treliça: as diagonais de madeira e o banzo de cima de aço */}
      <g stroke="#5d3a1f" strokeWidth="1">
        {nos.slice(0, -1).map((x) => (
          <g key={x}>
            <line x1={x} y1="64" x2={x + 10} y2="44" stroke="#c08a50" strokeWidth="3.5" />
            <line x1={x + 10} y1="44" x2={x + 20} y2="64" stroke="#c08a50" strokeWidth="3.5" />
          </g>
        ))}
        <line x1="40" y1="44" x2="120" y2="44" stroke="#8796a5" strokeWidth="3.5" />
      </g>
      <rect x="30" y="62" width="100" height="5" fill="#9a6438" stroke="#4e2f18" strokeWidth="1" />
      {nos.map((x) => (
        <circle key={x} cx={x} cy="64.5" r="2" fill={x === 30 || x === 130 ? '#d0524c' : '#3a3530'} />
      ))}
      {/* a carroça com o coelho */}
      <g transform="translate(78 62)">
        <rect x="-11" y="-11" width="18" height="6" fill="#b4773f" stroke="#3a2a1c" strokeWidth="0.8" />
        <path d="M-8 -11 l1.5 -4 l1.5 4 M-3 -11 l1.5 -4 l1.5 4" fill="#ee8a2c" />
        <ellipse cx="5" cy="-19" rx="1.3" ry="4" fill="#f7f3ec" />
        <ellipse cx="7.5" cy="-19.5" rx="1.3" ry="4" fill="#f7f3ec" />
        <circle cx="6" cy="-13" r="3.4" fill="#f7f3ec" stroke="#3a2a1c" strokeWidth="0.6" />
        <circle cx="7.6" cy="-13.6" r="0.6" fill="#2b2622" />
        <circle cx="-6" cy="-3.5" r="3.4" fill="#3a3530" />
        <circle cx="4" cy="-3.5" r="3.4" fill="#3a3530" />
      </g>
    </svg>
  );
}

function CapaTransito() {
  // a grade isométrica da capa: (x, y) da cidade → o ponto da tela
  const p = (x: number, y: number): [number, number] => [80 + (x - y) * 15, 14 + (x + y) * 7.5];
  const pts = (l: [number, number][]) => l.map(([a, b]) => `${a},${b}`).join(' ');
  const quad = (x0: number, y0: number, x1: number, y1: number) => pts([p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)]);
  const acima = ([a, b]: [number, number], h: number): [number, number] => [a, b - h];
  const predio = (x: number, y: number, cor: string, h: number) => {
    const a = p(x, y + 1.6);
    const b = p(x + 1.6, y + 1.6);
    const c = p(x + 1.6, y);
    return (
      <g key={`${x}-${y}`}>
        <polygon points={pts([a, b, acima(b, h), acima(a, h)])} fill={cor} />
        <polygon points={pts([b, c, acima(c, h), acima(b, h)])} fill={cor} opacity="0.75" />
        <polygon points={pts([acima(p(x, y), h), acima(c, h), acima(b, h), acima(a, h)])} fill="#ddd8c4" />
      </g>
    );
  };
  const carro = (x: number, y: number, cor: string) => {
    const [cx, cy] = p(x, y);
    return (
      <g transform={`translate(${cx} ${cy})`}>
        <ellipse cx="0" cy="2" rx="9" ry="4" fill="#2a2c33" opacity="0.25" />
        <path d="M-9 -3 L0 -7.5 L9 -3 L9 0 L0 4.5 L-9 0 Z" fill={cor} />
        <path d="M-5 -7 L0 -9.5 L5 -7 L5 -4 L0 -1.5 L-5 -4 Z" fill="#9fd1ef" />
        <circle cx="-5" cy="2" r="1.6" fill="#2a2c33" />
        <circle cx="5" cy="2" r="1.6" fill="#2a2c33" />
      </g>
    );
  };
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#a9d3ea" />
      <polygon points={pts([p(0, 7), p(7, 7), p(7, 0), acima(p(7, 0), -8), acima(p(7, 7), -8), acima(p(0, 7), -8)])} fill="#a77d53" />
      <polygon points={quad(0, 0, 7, 7)} fill="#cfcab6" />
      <polygon points={quad(0, 3, 7, 4)} fill="#5d6169" />
      <polygon points={quad(3, 0, 4, 7)} fill="#5d6169" />
      {[0.15, 0.45, 0.75].map((a) => (
        <g key={a} fill="#e9e5d8">
          <polygon points={quad(2.82, 3 + a, 2.96, 3.14 + a)} />
          <polygon points={quad(3 + a, 2.82, 3.14 + a, 2.96)} />
          <polygon points={quad(4.04, 3 + a, 4.18, 3.14 + a)} />
          <polygon points={quad(3 + a, 4.04, 3.14 + a, 4.18)} />
        </g>
      ))}
      {predio(0.8, 0.8, '#b8524c', 16)}
      {predio(4.8, 0.8, '#c9b98a', 12)}
      {predio(0.8, 4.8, '#8f6a4a', 12)}
      {carro(2.3, 3.75, '#d0524c')}
      {carro(3.25, 2.3, '#f2b632')}
      {carro(4.9, 3.75, '#4a79c8')}
      {predio(5.2, 5.2, '#a84b46', 10)}
      {/* a seta de quem vai virar */}
      <path d="M90 42 l9 -2 l-4 8 Z" fill="#ffb02e" stroke="#3a2a10" strokeWidth="1" />
    </svg>
  );
}

function CapaCaca() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#a9d3ea" />
      <rect y="0" width="160" height="40" fill="#8fc2e2" />
      <circle cx="136" cy="20" r="9" fill="#fff3c4" />
      <path d="M0 86 Q40 70 80 82 T160 78 V96 H0 Z" fill="#7fb36a" />
      <rect y="88" width="160" height="3" fill="#b98a5a" />
      <rect y="94" width="160" height="3" fill="#b98a5a" />
      {[6, 30, 54, 78, 102, 126, 150].map((x) => (
        <rect key={x} x={x} y="84" width="4" height="16" fill="#a77a4c" />
      ))}
      <rect y="100" width="160" height="20" fill="#7a5236" />
      {[12, 36, 60, 84, 108, 132].map((x) => (
        <g key={x}>
          <rect x={x} y="106" width="4" height="5" fill="#e07a2a" />
          <rect x={x - 1} y="101" width="2" height="5" fill="#4f9a3a" />
          <rect x={x + 3} y="100" width="2" height="6" fill="#4f9a3a" />
        </g>
      ))}
      {/* o corvo, de asas abertas */}
      <g transform="translate(78 46)">
        <path d="M-4 -2 L-22 -16 L-2 2 Z" fill="#2c2a33" />
        <path d="M2 -2 L18 -18 L6 2 Z" fill="#3d3a47" />
        <ellipse cx="0" cy="0" rx="13" ry="7" fill="#2c2a33" />
        <path d="M-11 -2 L-19 -6 L-19 5 L-11 3 Z" fill="#2c2a33" />
        <circle cx="11" cy="-3" r="5.5" fill="#2c2a33" />
        <path d="M15 -5 L22 -2 L15 0 Z" fill="#e8a33a" />
        <rect x="11" y="-6" width="2" height="2" fill="#f5f2e8" />
      </g>
      {/* a mira */}
      <g stroke="#fff3e0" strokeWidth="2" fill="none">
        <circle cx="80" cy="46" r="17" />
        <path d="M53 46 H70 M90 46 H107 M80 19 V36 M80 56 V73" />
      </g>
      {/* o gafanhoto */}
      <g transform="translate(124 70)">
        <ellipse cx="0" cy="0" rx="9" ry="4" fill="#5f9e2f" />
        <circle cx="8" cy="-2" r="3.5" fill="#7cbf45" />
        <path d="M-3 0 L-9 -8 L-6 6" stroke="#4a8526" strokeWidth="2" fill="none" />
        <path d="M9 -5 L15 -12 M8 -5 L12 -13" stroke="#3f6f1f" strokeWidth="1" />
      </g>
    </svg>
  );
}

/**
 * O Minigolfe da toca: a grama em faixas vista de cima, a borda de madeira, um cogumelo, o buraco com a bandeira e a bola
 * chegando, com o rastro pontilhado da tacada.
 */
/** O Minigolfe 3D: uma pista em perspectiva, com as paredes iluminadas de um lado, a rampa, a bandeira no buraco e a bola. */
function CapaGolfe3D() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#bfe4f2" />
      <rect y="76" width="160" height="44" fill="#8fc46a" />
      <path d="M20 104 L62 58 L138 58 L118 104 Z" fill="#4fae5a" />
      <path d="M20 104 L62 58 L62 64 L24 108 Z" fill="#e8dcc0" />
      <path d="M24 108 L20 104 L118 104 L122 108 Z" fill="#c9b48a" />
      <path d="M118 104 L138 58 L142 60 L122 108 Z" fill="#b39c72" />
      <path d="M62 58 L138 58 L138 54 L62 54 Z" fill="#f0e6cc" />
      <path d="M40 98 L58 78 L80 78 L66 98 Z" fill="#3e9450" />
      <path d="M40 98 L66 98 L66 92 L44 92 Z" fill="#2f7a40" opacity="0.6" />
      <ellipse cx="112" cy="66" rx="6" ry="2.6" fill="#22301e" />
      <rect x="111" y="40" width="2" height="26" fill="#f4ecdc" />
      <path d="M113 40 L128 45 L113 50 Z" fill="#e3453a" />
      <circle cx="54" cy="88" r="4" fill="#fffaf0" />
      <ellipse cx="54" cy="92" rx="4" ry="1.2" fill="#1e3a20" opacity="0.35" />
    </svg>
  );
}

/** Tocas e Torres: a vila no morro com a torre e a bandeira azul, a muralha com o portão, a catapulta e a pedra voando. */
function CapaTocas() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#bfe4f2" />
      <path d="M0 70 Q40 52 90 62 T160 58 V120 H0 Z" fill="#7fbf5a" />
      <path d="M0 96 Q60 84 160 92 V120 H0 Z" fill="#6aa84c" />
      {/* a muralha com o portão */}
      <rect x="8" y="74" width="62" height="14" fill="#b9a58c" />
      {[8, 18, 28, 48, 58].map((x) => (
        <rect key={x} x={x} y="70" width="6" height="5" fill="#b9a58c" />
      ))}
      <path d="M33 88 V80 Q38 74 43 80 V88 Z" fill="#6a4428" />
      {/* a torre com o telhado e a bandeira */}
      <rect x="86" y="38" width="20" height="40" fill="#d8c9b0" />
      <rect x="86" y="38" width="20" height="4" fill="#bfae94" />
      <path d="M82 38 L96 20 L110 38 Z" fill="#c4553a" />
      <rect x="95" y="8" width="1.6" height="14" fill="#5a3b22" />
      <path d="M96.6 8 L108 12 L96.6 16 Z" fill="#3a6fc4" />
      <rect x="93" y="50" width="6" height="8" rx="3" fill="#5a3b22" />
      {/* uma casinha */}
      <rect x="116" y="62" width="18" height="14" fill="#e8dcc4" />
      <path d="M113 62 L125 52 L137 62 Z" fill="#c4553a" />
      {/* a catapulta e a pedra */}
      <rect x="22" y="100" width="22" height="5" fill="#8a5a36" />
      <circle cx="25" cy="106" r="3" fill="#5a3b22" />
      <circle cx="41" cy="106" r="3" fill="#5a3b22" />
      <path d="M33 100 L47 88" stroke="#8a5a36" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 84 Q68 56 80 50" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="80" cy="50" r="3.4" fill="#7d7a78" />
    </svg>
  );
}

/** O Futebol dos coelhos: o campo visto de cima, o círculo do meio, a rede e a bola rolando ao gol, com um coelho de orelhas. */
function CapaFutebol() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <rect width="160" height="120" fill="#3fa457" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 20} width="10" height="120" fill="#47b05f" />
      ))}
      <rect x="6" y="6" width="148" height="108" fill="none" stroke="#f4f8f0" strokeWidth="2" />
      <line x1="80" y1="6" x2="80" y2="114" stroke="#f4f8f0" strokeWidth="2" />
      <circle cx="80" cy="60" r="16" fill="none" stroke="#f4f8f0" strokeWidth="2" />
      <rect x="132" y="38" width="22" height="44" fill="none" stroke="#f4f8f0" strokeWidth="2" />
      <rect x="154" y="48" width="6" height="24" fill="#e8eef0" />
      {[50, 54, 58, 62, 66, 70].map((y) => (
        <line key={y} x1="154" y1={y} x2="160" y2={y} stroke="#9aa6aa" strokeWidth="0.8" />
      ))}
      <g transform="translate(56 66)">
        <ellipse cx="0" cy="0" rx="9" ry="7" fill="#3a6fc4" />
        <circle cx="0" cy="0" r="5" fill="#f4e7d6" />
        <path d="M-3 -4 L-6 -16 L-1 -5 Z" fill="#f4e7d6" />
        <path d="M3 -4 L6 -16 L1 -5 Z" fill="#f4e7d6" />
        <path d="M-3.5 -6 L-5 -13 L-2 -6 Z" fill="#e8a0b4" />
        <path d="M3.5 -6 L5 -13 L2 -6 Z" fill="#e8a0b4" />
      </g>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={74 + i * 9} cy={64 - i * 0.5} r="1.3" fill="#ffffff" opacity={0.3 + i * 0.12} />
      ))}
      <circle cx="122" cy="61" r="5" fill="#ffffff" />
      <path d="M120 59 L124 59 L123 63 L121 63 Z" fill="#1e1e22" />
    </svg>
  );
}

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
