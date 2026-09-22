import { desktopBridge } from './desktop';
import { Logo } from './Logo';

/**
 * Faixa escura no topo, só dentro do app de desktop: o Windows desenha uma barra de título clara por
 * padrão (ver desktop/src/main.js, titleBarOverlay), e esta faixa é o que aparece no lugar dela — com o
 * mesmo fundo do resto do app. Arrastável, como a barra de título de qualquer janela.
 */
export function DesktopTitleBar() {
  if (!desktopBridge) return null;
  return (
    <div className="desktop-titlebar">
      <Logo size={16} />
      <span>Syden</span>
    </div>
  );
}
