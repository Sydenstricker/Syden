/**
 * O TOQUE LONGO É O BOTÃO DIREITO (20/11/2026, relato dele: "no celular a experiência é incompleta"). Os menus do Syden
 * (a pessoa, a comunidade na barra, quem está na voz, o quadro da transmissão, o status) abrem pelo botão direito, e o toque
 * não tem um. O Android dispara o `contextmenu` sozinho ao segurar o dedo; o iPhone não. Aqui, segurar ~550 ms sem mexer
 * dispara um `contextmenu` no lugar do dedo, e os mesmos `onContextMenu` de sempre respondem: nenhum menu precisou mudar.
 *
 * - Se o sistema já disparou o dele (Android), o nosso não sai: o menu não abre duas vezes.
 * - Depois de um menu aberto assim, o clique que o navegador manda ao soltar o dedo é engolido (senão o toque longo num
 *   membro abriria o menu E o cartão de perfil).
 * - Não vale em campos de texto (segurar ali é selecionar e colar) nem dentro dos jogos, que usam o toque como controle.
 */
const ESPERA_MS = 550;
const TOLERANCIA_PX = 10;

let instalado = false;

export function instalarToqueLongo() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inicio: { x: number; y: number; alvo: Element } | null = null;
  let engolirClique = 0;

  const cancelar = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    inicio = null;
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
      cancelar();
      // Um toque novo: o clique pendente da soltura anterior não veio (o iPhone nem sempre o manda), e este é de verdade.
      engolirClique = 0;
      if (e.pointerType !== 'touch' || !(e.target instanceof Element)) return;
      const alvo = e.target;
      if (alvo.closest('input, textarea, select, [contenteditable="true"], canvas, .minijogo')) return;
      inicio = { x: e.clientX, y: e.clientY, alvo };
      timer = setTimeout(() => {
        const agora = inicio;
        cancelar();
        if (!agora || !agora.alvo.isConnected) return;
        const evento = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: agora.x,
          clientY: agora.y,
          button: 2,
        });
        agora.alvo.dispatchEvent(evento);
        // Só quem respondeu (preventDefault) abriu algo: aí o clique da soltura é engolido e o aparelho dá um toque.
        if (evento.defaultPrevented) {
          engolirClique = Date.now() + 1000;
          navigator.vibrate?.(10);
        }
      }, ESPERA_MS);
    },
    { capture: true, passive: true },
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > TOLERANCIA_PX) cancelar();
    },
    { capture: true, passive: true },
  );
  window.addEventListener('pointerup', cancelar, { capture: true, passive: true });
  window.addEventListener('pointercancel', cancelar, { capture: true, passive: true });
  window.addEventListener('scroll', cancelar, { capture: true, passive: true });

  // O do sistema chegou primeiro (Android): o nosso não sai. Mas o menu abriu, então a soltura também não vira clique.
  window.addEventListener(
    'contextmenu',
    (e) => {
      if (!e.isTrusted || !timer) return;
      cancelar();
      engolirClique = Date.now() + 1000;
    },
    { capture: true },
  );

  window.addEventListener(
    'click',
    (e) => {
      if (engolirClique && Date.now() < engolirClique) {
        e.preventDefault();
        e.stopPropagation();
      }
      engolirClique = 0;
    },
    { capture: true },
  );
}
