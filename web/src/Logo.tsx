/**
 * O ícone do Syden (D4, do rebrand de 05/10/2026): duas orelhas, o balão de conversa e três pontos.
 *
 * É FIXO. O OurBunny e o BigChunkus trocam o coelho da estátua da praça, e só ele: ícone, logo e
 * interface nunca são personalizáveis. Desenhado aqui dentro, e não buscado como imagem, para sair
 * nítido em qualquer tamanho e já estar na tela no primeiro quadro. A fonte de verdade do desenho é
 * web/public/syden-icon.svg (de onde saem os PNGs, por scripts/icone-da-marca.mjs).
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" rx="22" fill="#1E2533" />
      <ellipse cx="38" cy="30" rx="10" ry="18" transform="rotate(-12 38 30)" fill="#F3EBD8" />
      <ellipse cx="38" cy="31" rx="3.6" ry="11" transform="rotate(-12 38 30)" fill="#F5B83D" />
      <ellipse cx="62" cy="30" rx="10" ry="18" transform="rotate(12 62 30)" fill="#F3EBD8" />
      <ellipse cx="62" cy="31" rx="3.6" ry="11" transform="rotate(12 62 30)" fill="#F5B83D" />
      <path
        d="M32 38 H68 A16 16 0 0 1 84 54 V62 A16 16 0 0 1 68 78 H42 L22 88 L28 78 H32 A16 16 0 0 1 16 62 V54 A16 16 0 0 1 32 38 Z"
        fill="#1E2533"
        stroke="#F3EBD8"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="58" r="4.5" fill="#F3EBD8" />
      <circle cx="50" cy="58" r="4.5" fill="#F3EBD8" />
      <circle cx="64" cy="58" r="4.5" fill="#F3EBD8" />
    </svg>
  );
}
