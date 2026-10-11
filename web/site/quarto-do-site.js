// O quarto do topo da página de apresentação é o menu dela (ver o comentário em index.html).
//
// SEM ESTE ARQUIVO A PÁGINA FUNCIONA: os objetos são links para as seções (#salas, #amigos…). Com ele —
// como na home do app (web/src/Quarto.tsx) — O CLIQUE ACERTA O DESENHO, NÃO A CAIXA: cada objeto tem uma
// máscara, e o pixel sob o ponteiro decide. O contorno, o balão do nome e a mãozinha do cursor só
// aparecem em cima do objeto de verdade, e só um de cada vez. O clique rola até a seção daquele objeto.
//
// Ele roda no <head> só para marcar "com-js" antes do primeiro desenho; o resto espera a página existir.
document.documentElement.classList.add('com-js');

document.addEventListener('DOMContentLoaded', () => {
  const quarto = document.getElementById('quarto');
  if (!quarto) return;

  /** O tamanho da pintura, em pixels do quarto. */
  const W = 313;
  const H = 314;

  const caixaDe = (el) => el.dataset.caixa.split(',').map(Number);
  const dentro = ([x0, y0, x1, y1], x, y) => x >= x0 && y >= y0 && x < x1 && y < y1;

  // As máscaras moram ao lado da folha de estilo (quarto/mascara-<objeto>.png; a do coelho é o próprio
  // desenho, quarto/coelho.png), e o endereço sai dela: vale igual na raiz e em /ja/.
  const folha = document.querySelector('link[rel="stylesheet"][href*="site.css"]');
  const base = folha ? folha.href : location.href;
  const mascaraDe = (el) =>
    el.dataset.mascara ? `quarto/${el.dataset.mascara}.png` : `quarto/mascara-${el.className.match(/obj-([\w-]+)/)[1]}.png`;

  // Do menor para o maior: onde duas caixas se sobrepõem, o menor ganha.
  const objetos = [...quarto.querySelectorAll('.obj[data-caixa]')]
    .map((el) => {
      const caixa = caixaDe(el);
      return { el, caixa, mascara: mascaraDe(el), area: (caixa[2] - caixa[0]) * (caixa[3] - caixa[1]) };
    })
    .sort((a, b) => a.area - b.area);
  // Os vivos que não são objeto (o gato): só pulam quando cutucados.
  const soVivos = [...quarto.querySelectorAll('.quarto-vivo[data-caixa]:not(.obj)')].map((el) => ({ el, caixa: caixaDe(el) }));

  /** As máscaras viram matrizes de "tem objeto aqui?". Até chegar (ou se não chegar), vale a caixa. */
  const cheio = new Map();
  for (const o of objetos) {
    const imagem = new Image();
    imagem.onload = () => {
      const tela = document.createElement('canvas');
      tela.width = imagem.width;
      tela.height = imagem.height;
      const contexto = tela.getContext('2d');
      if (!contexto) return;
      contexto.drawImage(imagem, 0, 0);
      cheio.set(o, { w: imagem.width, a: contexto.getImageData(0, 0, imagem.width, imagem.height).data });
    };
    imagem.src = new URL(o.mascara, base).href;
  }

  /** O pixel do quarto sob o ponteiro. */
  function ponto(evento) {
    const r = quarto.getBoundingClientRect();
    return [Math.floor(((evento.clientX - r.left) / r.width) * W), Math.floor(((evento.clientY - r.top) / r.height) * H)];
  }

  function objetoSob(x, y) {
    for (const o of objetos) {
      if (!dentro(o.caixa, x, y)) continue;
      const m = cheio.get(o);
      if (!m || m.a[((y - o.caixa[1]) * m.w + (x - o.caixa[0])) * 4 + 3]) return o;
    }
    return null;
  }

  const vivoSob = (x, y) => soVivos.find((v) => dentro(v.caixa, x, y)) ?? null;

  function cutucar(el) {
    el.classList.remove('cutucado');
    requestAnimationFrame(() => el.classList.add('cutucado'));
  }

  for (const el of quarto.querySelectorAll('.quarto-vivo')) {
    el.addEventListener('animationend', (evento) => {
      if (evento.animationName === 'quarto-pulo') el.classList.remove('cutucado');
    });
  }

  // O abajur acende e apaga o quarto: o dia é a segunda pintura do mesmo quarto. Os dois rótulos moram
  // no HTML (aria-label e data-apagar), para serem traduzidos com a página.
  const abajur = objetos.find((o) => o.el.classList.contains('obj-abajur'));
  const acender = abajur?.el.getAttribute('aria-label');
  function alternarLuz() {
    const deDia = quarto.classList.toggle('de-dia');
    abajur.el.setAttribute('aria-pressed', String(deDia));
    abajur.el.setAttribute('aria-label', deDia ? abajur.el.dataset.apagar || acender : acender);
  }

  /** Leva à seção do objeto, e a faz piscar de leve para o olho achar onde chegou. */
  function irPara(objeto) {
    const href = objeto.el.getAttribute('href');
    // Link para outra página (o vaso leva a contribuir.html): vai, como um link comum.
    if (!href.startsWith('#')) {
      location.href = objeto.el.href;
      return;
    }
    const id = href.slice(1);
    const alvo = document.getElementById(id);
    if (!alvo) return;
    if (objeto.el.classList.contains('quarto-vivo')) cutucar(objeto.el);
    const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'center' });
    history.replaceState(null, '', '#' + id);
    alvo.classList.remove('chegou');
    requestAnimationFrame(() => alvo.classList.add('chegou'));
    alvo.addEventListener('animationend', () => alvo.classList.remove('chegou'), { once: true });
  }

  function ativar(objeto) {
    quarto.classList.add('explorado');
    if (objeto === abajur) alternarLuz();
    else irPara(objeto);
  }

  // ---------- o ponteiro: acende o que está embaixo dele, e só ele ----------

  let aceso = null;
  function acenderObjeto(objeto) {
    if (objeto === aceso) return;
    aceso?.el.classList.remove('aceso');
    objeto?.el.classList.add('aceso');
    aceso = objeto;
  }

  quarto.addEventListener('pointermove', (evento) => {
    const [x, y] = ponto(evento);
    const objeto = objetoSob(x, y);
    acenderObjeto(objeto);
    quarto.classList.toggle('na-mira', Boolean(objeto || vivoSob(x, y)));
  });

  quarto.addEventListener('pointerleave', () => {
    acenderObjeto(null);
    quarto.classList.remove('na-mira');
  });

  quarto.addEventListener('click', (evento) => {
    // O clique de teclado (Enter num objeto focado) vem com detail 0 e já foi tratado pelo próprio objeto.
    if (evento.detail === 0) return;
    const [x, y] = ponto(evento);
    const objeto = objetoSob(x, y);
    if (objeto) ativar(objeto);
    else {
      const vivo = vivoSob(x, y);
      if (vivo) cutucar(vivo.el);
    }
  });

  // Quem usa o teclado: cada objeto é um link (ou botão) focável, e o Enter faz o mesmo que o clique.
  for (const o of objetos) {
    o.el.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (evento.detail === 0) ativar(o);
    });
  }
});
