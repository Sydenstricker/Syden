// Leva quem chega à página de apresentação no idioma dela, e guarda a escolha de quem troca.
//
// AS MESMAS REGRAS DO APP (ver web/src/i18n/index.ts e o CLAUDE.md):
//   - pelo navegador (navigator.languages), NUNCA pelo endereço de rede;
//   - a escolha explícita vence e não é sobreposta;
//   - e é A MESMA escolha: o app guarda em localStorage 'syden.idioma', no mesmo syden.chat. Quem
//     escolheu japonês no app abre o site em japonês, e quem escolhe aqui abre o app no idioma escolhido.
//
// Os idiomas disponíveis não estão escritos aqui: saem dos <link rel="alternate"> que a montagem põe na
// página (web/scripts/site-traduzido.mjs). Idioma novo não exige mexer neste arquivo.
(() => {
  const CHAVE = 'syden.idioma';
  const PADRAO = 'pt-BR';

  /** O mesmo que o app trata como sinônimo: bokmål e nynorsk são o norueguês; sérvio de Montenegro é o montenegrino. */
  const APELIDOS = { nb: 'no', nn: 'no' };
  const APELIDOS_POR_MARCA = { 'sr-me': 'cnr', 'sr-latn-me': 'cnr' };

  const enderecos = {};
  for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
    const codigo = link.getAttribute('hreflang');
    if (codigo !== 'x-default') enderecos[codigo] = new URL(link.href).pathname;
  }
  const atual = document.documentElement.lang;

  let guardado = null;
  try {
    guardado = localStorage.getItem(CHAVE);
  } catch {
    // sem armazenamento (janela anônima, site bloqueado): segue pelo navegador
  }

  /** O idioma do navegador que o site tem, como o app escolhe. */
  function peloNavegador() {
    const preferidos = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
    for (const preferido of preferidos) {
      const base = preferido.split('-')[0];
      const raiz = APELIDOS_POR_MARCA[preferido.toLowerCase()] ?? APELIDOS[base] ?? base;
      if (raiz === 'pt') return PADRAO;
      for (const codigo of [preferido, raiz]) if (enderecos[codigo]) return codigo;
    }
    // Uma língua que o Syden ainda não fala: o inglês serve a mais gente do que o português.
    return enderecos.en ? 'en' : PADRAO;
  }

  // O desvio fica parado em dois casos, para não brigar com desviar-para-o-app.js: dentro do app de
  // desktop, e quando o endereço traz algo (?convite=, ?entrada=…) — aí é alguém no meio de uma tarefa.
  const podeDesviar = !window.sydenDesktop && !window.location.search;
  // Sem escolha guardada, o navegador decide só na raiz: quem abriu /en/ por um link, quer o /en/.
  // Escolha guardada que o site ainda não tem (o app fala idiomas que o site pode não falar): na raiz,
  // o inglês, pelo mesmo motivo de quem fala uma língua que o Syden não tem.
  let destino = atual;
  if (guardado && enderecos[guardado]) destino = guardado;
  else if (guardado && atual === PADRAO) destino = enderecos.en ? 'en' : PADRAO;
  else if (!guardado && atual === PADRAO) destino = peloNavegador();

  if (podeDesviar && destino !== atual && enderecos[destino]) {
    window.location.replace(enderecos[destino] + window.location.hash);
    return;
  }

  // A escolha no pé da página vale para o site e para o app.
  document.addEventListener('click', (evento) => {
    const link = evento.target.closest?.('[data-idioma]');
    if (!link) return;
    try {
      localStorage.setItem(CHAVE, link.dataset.idioma);
    } catch {
      // sem armazenamento: o link leva à página do mesmo jeito, só não fica lembrado
    }
  });
})();
