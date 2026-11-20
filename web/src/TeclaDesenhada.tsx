/**
 * UMA TECLA (OU UM GESTO) DESENHADA: a figura dos Input Prompts da Kenney (CC0, web/src/comandos/License.txt; o crédito nos
 * termos, seção 10), a mesma em todo jogo. Saiu de ComandosDosJogos.tsx (20/11/2026) para a moldura da Festa usar as mesmas
 * figuras, no lugar das teclas que ela desenhava por código.
 *
 * Por que o VETOR do pacote e não o PNG: o pacote não tem versão em pixel art, e o PNG de 64 px ampliado ou reduzido em escala
 * não inteira borra. O vetor entra na página como SVG, e o branco da Kenney vira a cor do texto do tema (o vermelho, a tecla
 * que se usa, vira a de destaque): combina com o painel no claro e no escuro, o que o PNG de cor fixa não faz.
 */

export type Figura =
  | 'setas'
  | 'setas-lado'
  /** As letras W, A, S e D no arranjo das setas (montado das teclas da Kenney; pedido dele, 09/11/2026). */
  | 'wasd'
  | 'espaco'
  | 'z'
  | 'x'
  | 'c'
  | 'e'
  | 'q'
  | 'esc'
  | '1'
  | '2'
  | '3'
  | 'mouse-clique'
  | 'mouse-direito'
  | 'mouse-arrastar'
  | 'toque'
  | 'toque-arrastar'
  | 'toque-segurar';

const ARQUIVO: Record<Figura, string> = {
  // a das quatro setas marcadas: a 'keyboard_arrows' do pacote é o arranjo em branco, sem seta nenhuma desenhada
  setas: 'keyboard_arrows_all',
  'setas-lado': 'keyboard_arrows_horizontal',
  wasd: 'keyboard_wasd',
  // a do símbolo ␣, e não a com a palavra SPACE: a figura vale em todo idioma
  espaco: 'keyboard_space_icon',
  z: 'keyboard_z',
  x: 'keyboard_x',
  c: 'keyboard_c',
  e: 'keyboard_e',
  q: 'keyboard_q',
  esc: 'keyboard_escape',
  '1': 'keyboard_1',
  '2': 'keyboard_2',
  '3': 'keyboard_3',
  'mouse-clique': 'mouse_left',
  'mouse-direito': 'mouse_right',
  'mouse-arrastar': 'mouse_move',
  toque: 'touch_tap',
  'toque-arrastar': 'touch_swipe_move',
  'toque-segurar': 'touch_tap_hold',
};

/** As figuras largas (desenhadas maiores, com a margem negativa que as alinha às de uma tecla só). */
const LARGAS = new Set<Figura>(['setas', 'setas-lado', 'wasd']);

/**
 * As figuras vêm no pacote do site, como texto (import.meta.glob), e entram na página como SVG: como imagem ou máscara, o
 * destaque sumia.
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

/**
 * A figura. Sem `rotulo`, é enfeite (aria-hidden: quem a mostra já diz o comando em texto, ou o esconde todo); com ele, vira
 * uma imagem com esse nome para o leitor de tela.
 */
export function TeclaDesenhada({ f, rotulo }: { f: Figura; rotulo?: string }) {
  return (
    <span
      className={'jogo-comando-icone' + (LARGAS.has(f) ? ' largo' : '')}
      {...(rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': true })}
      dangerouslySetInnerHTML={{ __html: svgDe(f) }}
    />
  );
}
