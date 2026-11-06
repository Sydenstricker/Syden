import './iconesDeHud.css';

/**
 * OS ÍCONES DE HUD DOS JOGOS (06/11/2026, pedido dele: "ícones para HUDs, pode ser útil para no início o jogador escolher se
 * quer contra jogador ou máquina"). São do Game Icons da Kenney e da expansão dele (CC0, web/public/icones-hud/license.txt; o
 * crédito nos termos, seção 10), os PNG brancos de 100 px, usados como MÁSCARA: a figura pega a cor do texto (`currentColor`),
 * então segue o tema e o destaque do botão sem uma versão por cor.
 *
 * Só o que o lucide do resto do Syden não diz bem: quem joga sozinho, a turma, o computador e o sinal grande de pausa. Ícone
 * novo é uma linha em ARQUIVO e o PNG copiado para a pasta (PNG pede `git add -f`).
 */
const ARQUIVO = {
  /** Uma pessoa: quem joga (a aba Solo, "você" na mesa contra o computador). */
  singleplayer: 'singleplayer',
  /** A turma (a aba Coletivo). */
  multiplayer: 'multiplayer',
  /** Um adversário do computador. */
  robo: 'userRobot',
  pausa: 'pause',
  /** De volta ao último posto (as quedas da Gincana da toca). */
  voltar: 'return',
} as const;

export type NomeDoIconeDeHud = keyof typeof ARQUIVO;

export function IconeDeHud({ nome, tamanho = 16, className = '' }: { nome: NomeDoIconeDeHud; tamanho?: number; className?: string }) {
  const url = `url(${import.meta.env.BASE_URL}icones-hud/${ARQUIVO[nome]}.png)`;
  return (
    <span
      aria-hidden="true"
      className={`icone-hud${className ? ' ' + className : ''}`}
      style={{ width: tamanho, height: tamanho, WebkitMaskImage: url, maskImage: url }}
    />
  );
}
