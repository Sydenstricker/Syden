/**
 * A capa da Rota Estelar na estante (como as de CapasDosJogos.tsx: SVG nosso, sem texto, 4:3): o planeta laranja embaixo, o
 * céu passando a espaço, a nave branca de bico laranja vista de trás com as orelhas do coelho na cabine, a mira e o polvo de
 * lata lá na frente.
 */
export function CapaEstelar() {
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <defs>
        <linearGradient id="estelar-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="0.55" stopColor="#5b3f8a" />
          <stop offset="1" stopColor="#e8a173" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill="url(#estelar-ceu)" />
      {[
        [12, 10],
        [40, 22],
        [70, 8],
        [130, 14],
        [150, 34],
        [100, 28],
        [22, 40],
      ].map(([x, y]) => (
        <circle key={x + ',' + y} cx={x} cy={y} r="1" fill="#fff" />
      ))}
      {/* o planeta embaixo, em perspectiva */}
      <path d="M0 86 L160 86 L160 120 L0 120 Z" fill="#d9824c" />
      <path d="M0 86 L80 70 L160 86" fill="#c06d3c" />
      <ellipse cx="30" cy="100" rx="9" ry="3" fill="#a9582f" />
      <ellipse cx="128" cy="108" rx="12" ry="4" fill="#a9582f" />
      {/* o polvo de lata, longe */}
      <g transform="translate(80 40)">
        {[-12, -6, 0, 6, 12].map((x) => (
          <path key={x} d={`M${x * 0.6} 4 Q${x} 12 ${x * 1.2} 16`} stroke="#5b3f8a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ))}
        <circle r="9" fill="#8d96a8" />
        <path d="M-9 0 A9 9 0 0 1 9 0 Z" fill="#5b3f8a" />
        <circle cy="2" r="3.5" fill="#f4f4f4" />
        <circle cy="2" r="1.8" fill="#ff3b3b" />
      </g>
      {/* os tiros indo */}
      {[56, 64].map((y) => (
        <rect key={y} x={y === 56 ? 74 : 85} y={y} width="1.6" height="6" fill="#7dff9a" />
      ))}
      {/* a mira */}
      <rect x="72" y="46" width="16" height="16" fill="none" stroke="#8dffb0" strokeWidth="1.2" />
      {/* a nave, de trás */}
      <g transform="translate(80 92)">
        <path d="M-34 4 L-6 -2 L6 -2 L34 4 L6 6 L-6 6 Z" fill="#f3f1ea" />
        <path d="M-36 -6 L-32 6 L-29 5 Z M36 -6 L32 6 L29 5 Z" fill="#f28a2e" />
        <ellipse cy="2" rx="9" ry="9" fill="#f3f1ea" />
        <ellipse cy="-4" rx="6" ry="5" fill="#8fe3ff" opacity="0.8" />
        <path d="M-2.5 -6 L-3.5 -15 L-0.8 -7 Z M2.5 -6 L3.5 -15 L0.8 -7 Z" fill="#efe6ef" />
        <circle cy="7" r="4" fill="#2f3646" />
        <circle cy="7" r="2.4" fill="#ffb35a" />
      </g>
    </svg>
  );
}
