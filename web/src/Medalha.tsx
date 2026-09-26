import medalhaUrl from './assets/medalha.png';

// A recompensa de quem teve uma ideia acolhida no Syden.
//
// O formato é o dos jogos de celular, como o usuário pediu: um quadro com a arte dentro e uma MOLDURA
// temática em volta. A moldura é desenhada em vetor, e não recortada de uma imagem, por dois motivos:
// ela fica nítida de 32 a 200 pixels, e serve para as próximas medalhas — troca-se a arte de dentro e a
// cor da moldura, e nasce outra insígnia sem desenhar nada de novo.

/** As cores de cada tipo de moldura. Hoje só existe a dourada; prata e bronze já ficam prontas. */
const MOLDURAS = {
  // `painel` é o fundo atrás da arte: escuro, mas puxando para a cor da moldura. Com um preto só, o
  // quadro dourado ficava bem e o verde ficava duro.
  ouro: { clara: '#ffe9a8', media: '#e0b445', escura: '#8a5f1a', gema: '#48c2b0', painel: '#15110d' },
  prata: { clara: '#f2f5f8', media: '#b9c4cf', escura: '#5f6d7a', gema: '#7aa7d8', painel: '#101418' },
  bronze: { clara: '#f5cda4', media: '#c98a4f', escura: '#7a4a1f', gema: '#9ac26b', painel: '#17100a' },
  // Para a insígnia dos 25 primeiros, que é um coelho no mato: moldura da cor da grama.
  esmeralda: { clara: '#c9f5d8', media: '#4fae72', escura: '#1d5636', gema: '#f2c744', painel: '#0b1f16' },
} as const;

export type TipoDeMoldura = keyof typeof MOLDURAS;

/** A moldura, sozinha: quatro cantos trabalhados, um filete interno e as gemas no meio de cada lado. */
function Moldura({ tipo }: { tipo: TipoDeMoldura }) {
  const cor = MOLDURAS[tipo];
  const id = `moldura-${tipo}`;

  return (
    <svg className="medalha-moldura" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={cor.clara} />
          <stop offset="22%" stopColor={cor.media} />
          <stop offset="46%" stopColor={cor.clara} />
          <stop offset="70%" stopColor={cor.media} />
          <stop offset="100%" stopColor={cor.escura} />
        </linearGradient>
        <linearGradient id={`${id}-gema`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="45%" stopColor={cor.gema} />
          <stop offset="100%" stopColor="#0d3b37" />
        </linearGradient>
      </defs>

      {/* o fundo escuro onde a arte se apoia */}
      <rect x="10" y="10" width="80" height="80" fill={cor.painel} />

      {/* a moldura: a faixa de fora, vazada no meio */}
      <path d="M0,0 H100 V100 H0 Z M11,11 V89 H89 V11 Z" fill={`url(#${id}-metal)`} fillRule="evenodd" />
      {/* os dois filetes que dão o relevo: escuro por dentro, claro por fora */}
      <rect x="11" y="11" width="78" height="78" fill="none" stroke={cor.escura} strokeWidth="2" />
      <rect x="1" y="1" width="98" height="98" fill="none" stroke={cor.escura} strokeWidth="1.6" opacity="0.7" />
      <rect x="3.6" y="3.6" width="92.8" height="92.8" fill="none" stroke={cor.clara} strokeWidth="1" opacity="0.75" />

      {/* os cantos trabalhados: a peça que avança sobre a arte, como nos emblemas de jogo */}
      {['', 'rotate(90 50 50)', 'rotate(180 50 50)', 'rotate(270 50 50)'].map((giro, i) => (
        <g key={i} transform={giro}>
          <path d="M0,0 H38 L30,9 H18 L9,18 V30 L0,38 Z" fill={`url(#${id}-metal)`} />
          <path d="M0,0 H38 L30,9 H18 L9,18 V30 L0,38 Z" fill="none" stroke={cor.escura} strokeWidth="1.2" opacity="0.8" />
          {/* a gema pequena do canto */}
          <g transform="translate(9.5 9.5) rotate(45)">
            <rect x="-4.2" y="-4.2" width="8.4" height="8.4" rx="1" fill={cor.escura} />
            <rect x="-3" y="-3" width="6" height="6" rx="0.8" fill={`url(#${id}-gema)`} />
          </g>
        </g>
      ))}

      {/* as gemas grandes: uma no meio de cada lado */}
      {[
        [50, 5.5],
        [94.5, 50],
        [50, 94.5],
        [5.5, 50],
      ].map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx} ${cy}) rotate(45)`}>
          <rect x="-6.4" y="-6.4" width="12.8" height="12.8" rx="1.2" fill={cor.escura} />
          <rect x="-4.8" y="-4.8" width="9.6" height="9.6" rx="1" fill={`url(#${id}-gema)`} />
          <rect x="-4.8" y="-4.8" width="9.6" height="4" rx="1" fill="#fff" opacity="0.35" />
        </g>
      ))}
    </svg>
  );
}

/**
 * A medalha inteira: moldura + arte. `tamanho` é o lado do quadro em pixels — 32 no menu, 88 no perfil,
 * 140 na hora da festa.
 */
/**
 * Uma insígnia qualquer: a arte dentro do quadro, com a moldura da cor que o item pedir. É esta peça que
 * a loja e os presentes reaproveitam — trocam a arte e a cor, e não desenham nada de novo.
 */
export function Insignia({
  arte,
  titulo,
  tamanho = 88,
  moldura = 'ouro',
  quantas = 1,
}: {
  arte: string;
  titulo: string;
  tamanho?: number;
  moldura?: TipoDeMoldura;
  /** Quando a mesma insígnia vale por várias vezes (ex.: 3 ideias acolhidas), o número no canto. */
  quantas?: number;
}) {
  return (
    <span className="medalha insignia" style={{ width: tamanho, height: tamanho }} title={titulo} role="img" aria-label={titulo}>
      <Moldura tipo={moldura} />
      <img className="medalha-arte" src={arte} alt="" aria-hidden="true" />
      {quantas > 1 && <span className="medalha-conta">{quantas}</span>}
    </span>
  );
}

/** A medalha de ideia acolhida. Continua existindo com nome próprio porque é usada em vários lugares. */
export function Medalha({
  quantas = 1,
  tamanho = 88,
  tipo = 'ouro',
}: {
  quantas?: number;
  tamanho?: number;
  tipo?: TipoDeMoldura;
}) {
  const titulo =
    quantas > 1
      ? `Contribuiu com o Syden — ${quantas} ideias suas entraram no app`
      : 'Contribuiu com o Syden — uma ideia sua entrou no app';

  return <Insignia arte={medalhaUrl} titulo={titulo} tamanho={tamanho} moldura={tipo} quantas={quantas} />;
}
