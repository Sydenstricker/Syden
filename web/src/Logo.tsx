import { useId } from 'react';

/** O coelho vermelho do Syden (o mesmo desenho do ícone do app). */
export function Logo({ size = 32 }: { size?: number }) {
  // Id único por instância: dois logos na mesma página não podem dividir o mesmo degradê.
  const gradient = `syden-red-${useId()}`;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5a5a" />
          <stop offset="1" stopColor="#c8102e" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradient})`}>
        <ellipse cx="186" cy="148" rx="54" ry="132" transform="rotate(-11 186 148)" />
        <ellipse cx="326" cy="148" rx="54" ry="132" transform="rotate(11 326 148)" />
      </g>
      <g fill="#ffb3bd" opacity="0.55">
        <ellipse cx="189" cy="160" rx="22" ry="88" transform="rotate(-11 189 160)" />
        <ellipse cx="323" cy="160" rx="22" ry="88" transform="rotate(11 323 160)" />
      </g>
      <ellipse cx="256" cy="340" rx="160" ry="140" fill={`url(#${gradient})`} />
      <g fill="#1e1f22">
        <ellipse cx="200" cy="324" rx="17" ry="21" />
        <ellipse cx="312" cy="324" rx="17" ry="21" />
      </g>
      <path d="M238 372 Q256 360 274 372 Q266 388 256 390 Q246 388 238 372Z" fill="#7a0a1c" />
    </svg>
  );
}
