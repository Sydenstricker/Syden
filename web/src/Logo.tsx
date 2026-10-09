/**
 * O ícone do Syden (D4, do rebrand de 05/10/2026): duas orelhas, o balão de conversa e três pontos.
 *
 * É FIXO. O OurBunny e o BigChunkus trocam o coelho da estátua da praça, e só ele: ícone, logo e
 * interface nunca são personalizáveis. Desenhado aqui dentro, e não buscado como imagem, para sair
 * nítido em qualquer tamanho e já estar na tela no primeiro quadro. A fonte de verdade do desenho é
 * web/public/syden-icon.svg (de onde saem os PNGs, por scripts/icone-da-marca.mjs).
 *
 * As cores vêm do CSS (.logo-fundo, .logo-linha e .logo-balao, em styles.css), por variáveis com as do ícone como
 * padrão. Quem as troca é só o botão de início no tema claro (`.rail-logo`): ladrilho branco e linhas azul-noite,
 * escolha dele em 09/10/2026, porque o ladrilho escuro virava uma mancha na barra clara. Fora dali — a barra de
 * tarefas, o navegador, a tela de entrada — o ícone é a identidade do aplicativo e não acompanha o tema.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" rx="22" className="logo-fundo" />
      <ellipse cx="38" cy="30" rx="10" ry="18" transform="rotate(-12 38 30)" className="logo-linha" />
      <ellipse cx="38" cy="31" rx="3.6" ry="11" transform="rotate(-12 38 30)" fill="#F5B83D" />
      <ellipse cx="62" cy="30" rx="10" ry="18" transform="rotate(12 62 30)" className="logo-linha" />
      <ellipse cx="62" cy="31" rx="3.6" ry="11" transform="rotate(12 62 30)" fill="#F5B83D" />
      <path
        d="M32 38 H68 A16 16 0 0 1 84 54 V62 A16 16 0 0 1 68 78 H42 L22 88 L28 78 H32 A16 16 0 0 1 16 62 V54 A16 16 0 0 1 32 38 Z"
        className="logo-balao"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="58" r="4.5" className="logo-linha" />
      <circle cx="50" cy="58" r="4.5" className="logo-linha" />
      <circle cx="64" cy="58" r="4.5" className="logo-linha" />
    </svg>
  );
}
