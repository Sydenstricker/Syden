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
  /** Os atalhos do Tocas e Torres (06/11/2026): o centro da vila, o trabalhador parado e o exército. */
  casa: 'home',
  peao: 'figurine',
  punho: 'fightFist',
  /** Os cursores do Tocas e Torres (o ícone vira o ponteiro, com contorno: ver `cursorDeHud`). */
  mao: 'pointer',
  cesta: 'shoppingBasket',
  mira: 'target',
  chave: 'wrench',
  bandeira: 'flag',
} as const;

export type NomeDoIconeDeHud = keyof typeof ARQUIVO;

/**
 * O ícone como CURSOR do mouse (o valor do `cursor` do CSS, ou null se a imagem não carregou): o PNG branco num quadrado de 32 px
 * (o tamanho que todo navegador aceita), com um contorno escuro em volta para se ver sobre a grama e sobre a neve. O ponto que
 * clica é o meio. Feito uma vez por ícone, no próprio navegador.
 */
const cursores = new Map<NomeDoIconeDeHud, Promise<string | null>>();
export function cursorDeHud(nome: NomeDoIconeDeHud): Promise<string | null> {
  let p = cursores.get(nome);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const L = 32;
          const borda = 2;
          const dentro = L - borda * 2 - 2;
          const sombra = document.createElement('canvas');
          sombra.width = sombra.height = L;
          const gs = sombra.getContext('2d')!;
          gs.drawImage(img, (L - dentro) / 2, (L - dentro) / 2, dentro, dentro);
          gs.globalCompositeOperation = 'source-in';
          gs.fillStyle = '#1b1f27';
          gs.fillRect(0, 0, L, L);
          const tela = document.createElement('canvas');
          tela.width = tela.height = L;
          const g = tela.getContext('2d')!;
          for (let dy = -borda; dy <= borda; dy++) for (let dx = -borda; dx <= borda; dx++) if (dx || dy) g.drawImage(sombra, dx, dy);
          g.drawImage(img, (L - dentro) / 2, (L - dentro) / 2, dentro, dentro);
          resolve(`url(${tela.toDataURL('image/png')}) ${L / 2} ${L / 2}, auto`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = `${import.meta.env.BASE_URL}icones-hud/${ARQUIVO[nome]}.png`;
    });
    cursores.set(nome, p);
  }
  return p;
}

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
