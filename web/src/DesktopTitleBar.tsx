import { desktopBridge } from './desktop';

/**
 * Faixa escura no topo, só dentro do app de desktop: o Windows desenha uma barra de título clara por
 * padrão (ver desktop/src/main.js, titleBarOverlay), e esta faixa é o que aparece no lugar dela — com o
 * mesmo fundo do resto do app. Arrastável, como a barra de título de qualquer janela.
 */
export function DesktopTitleBar({ minimal }: { minimal?: boolean }) {
  if (!desktopBridge) return null;
  return (
    <div className="desktop-titlebar">
      {/* Só o nome: o coelho já está logo abaixo, no botão de início, e repetido aqui ficava poluído.
          Durante a animação de abertura nem o nome aparece — a faixa continua servindo para arrastar. */}
      {!minimal && <span>Syden</span>}
    </div>
  );
}
