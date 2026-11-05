/**
 * OS COMANDOS DOS MINI-GAMES, EM FIGURAS (05/11/2026, pedido dele: "use os input prompts nos mini-games para o usuário saber o
 * que precisa clicar"). As teclas, o mouse e os gestos de toque são os Input Prompts da Kenney (CC0,
 * web/src/comandos/License.txt; o crédito nos termos, seção 10), em vetor, com as cores do tema. Com mouse e teclado aparecem as teclas e o mouse; na tela de toque, os gestos (e o que não tem
 * gesto some: lá os botões da tela já são os comandos).
 */

export type Figura =
  | 'setas'
  | 'setas-lado'
  | 'espaco'
  | 'z'
  | 'x'
  | 'c'
  | 'e'
  | 'q'
  | 'mouse-clique'
  | 'mouse-arrastar'
  | 'toque'
  | 'toque-arrastar'
  | 'toque-segurar';

const ARQUIVO: Record<Figura, string> = {
  setas: 'keyboard_arrows',
  'setas-lado': 'keyboard_arrows_horizontal',
  espaco: 'keyboard_space',
  z: 'keyboard_z',
  x: 'keyboard_x',
  c: 'keyboard_c',
  e: 'keyboard_e',
  q: 'keyboard_q',
  'mouse-clique': 'mouse_left',
  'mouse-arrastar': 'mouse_move',
  toque: 'touch_tap',
  'toque-arrastar': 'touch_swipe_move',
  'toque-segurar': 'touch_tap_hold',
};

export interface Comando {
  /** As figuras do teclado e do mouse (mais de uma: "Z ou Espaço"). */
  teclas: Figura[];
  /** O gesto na tela de toque; sem ele, o comando não aparece lá. */
  toque?: Figura;
  rotulo: string;
}

/**
 * As figuras vêm no pacote do site, como texto (import.meta.glob), e entram na página como SVG: o branco da Kenney vira a cor do
 * texto do tema, e o vermelho (a tecla ou o botão que se usa) vira a cor de destaque. Como imagem ou máscara, o destaque sumia.
 */
const SVGS = import.meta.glob('./comandos/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const pintado = new Map<Figura, string>();
function svgDe(f: Figura): string {
  let s = pintado.get(f);
  if (s === undefined) {
    s = (SVGS['./comandos/' + ARQUIVO[f] + '.svg'] ?? '')
      .replace(/fill="#FFFFFF"/gi, 'style="fill:var(--text-strong)"')
      .replace(/fill="#E73246"/gi, 'style="fill:var(--accent)"')
      .replace(/<svg width="64" height="64"/, '<svg viewBox="0 0 64 64" width="100%" height="100%"');
    pintado.set(f, s);
  }
  return s;
}

function Icone({ f }: { f: Figura }) {
  return <span className={'jogo-comando-icone' + (f === 'espaco' || f === 'setas' || f === 'setas-lado' ? ' largo' : '')} dangerouslySetInnerHTML={{ __html: svgDe(f) }} />;
}

export function ComandosDoJogo({ itens }: { itens: Comando[] }) {
  const toque = itens.filter((c) => c.toque);
  return (
    <div className="jogo-comandos" aria-hidden="true">
      <ul className="jogo-comandos-teclado">
        {itens.map((c) => (
          <li key={c.rotulo}>
            <span className="jogo-comando-figuras">
              {c.teclas.map((f) => (
                <Icone key={f} f={f} />
              ))}
            </span>
            <span className="jogo-comando-rotulo">{c.rotulo}</span>
          </li>
        ))}
      </ul>
      {toque.length > 0 && (
        <ul className="jogo-comandos-toque">
          {toque.map((c) => (
            <li key={c.rotulo}>
              <span className="jogo-comando-figuras">
                <Icone f={c.toque!} />
              </span>
              <span className="jogo-comando-rotulo">{c.rotulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
