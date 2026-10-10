// A página de apresentação em cada idioma: syden.chat/en/, syden.chat/ja/…
//
// A FONTE É UMA SÓ: web/site/index.html, em português. Cada idioma é um dicionário em
// web/textos-do-site/<idioma>.json, da forma { "frase em português": "a mesma frase traduzida" } — o mesmo
// formato de e2e/demonstracao/. Na montagem (montar-site.mjs), este módulo troca cada frase da página
// pela tradução e escreve a cópia em dist/<idioma>/index.html.
//
// POR QUE A FRASE INTEIRA, E NÃO PEDAÇOS: "pode <a>contribuir</a> — e isso não desbloqueia nada" é uma
// frase com um link no meio. Traduzida em pedaços, a ordem das palavras do português ficaria presa em
// todos os idiomas. Por isso a unidade é o elemento inteiro (parágrafo, título, item), com as marcas
// dentro, e quem traduz move o link para onde a frase dele pede.
//
// FALTOU FRASE, A MONTAGEM PARA. Uma frase em português no meio da página em japonês é exatamente o resto
// que o CLAUDE.md manda medir ("nenhum resto em português") — e ela aparece sem erro nenhum, quando
// alguém muda o texto em português e esquece os 71 dicionários. Para ver o que falta:
//
//   node web/scripts/site-traduzido.mjs            lista as frases da página
//   node web/scripts/site-traduzido.mjs --faltando quais frases faltam em cada dicionário
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const TEXTOS = join(AQUI, 'textos-do-site');
const PADRAO = 'pt-BR';
/** As páginas que existem em cada idioma. As legais têm só português e inglês (web/site/en/). */
export const PAGINAS = ['index.html', 'contribuir.html'];
const ENDERECO = 'https://syden.chat/';

/** Os idiomas do app (nome nativo e direção), lidos de web/src/i18n/idiomas.ts: uma lista só para os dois. */
export function idiomasDoApp() {
  const fonte = readFileSync(join(AQUI, 'src', 'i18n', 'idiomas.ts'), 'utf8');
  const lista = [];
  for (const linha of fonte.matchAll(/\{ codigo: '([^']+)', nativo: '([^']+)'[^}]*\}/g)) {
    lista.push({ codigo: linha[1], nativo: linha[2], rtl: /rtl: true/.test(linha[0]) });
  }
  return lista;
}

/** Os idiomas que têm dicionário do site, além do português. */
export function idiomasDoSite() {
  if (!existsSync(TEXTOS)) return [];
  return readdirSync(TEXTOS)
    .filter((nome) => nome.endsWith('.json'))
    .map((nome) => nome.slice(0, -5))
    .sort();
}

const normalizar = (texto) => texto.replace(/\s+/g, ' ').trim();
const semMarcas = (texto) => texto.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();

// Os elementos que levam frase. Os que se aninham (um <a> dentro de um <p>) são pegos pelo de fora: a
// busca anda da esquerda para a direita e o <p> começa antes.
const ELEMENTO = /<(title|h1|h2|h3|p|li|a|button|figcaption)\b([^>]*)>([\s\S]*?)<\/\1>/g;
// O que vai em atributo: o texto alternativo das imagens, as descrições do cabeçalho e as respostas do
// botão de copiar o Pix (contribuir.js lê de lá).
const ATRIBUTO =
  /(<img\b[^>]*?\balt="|<meta (?:name="description"|property="og:description") content="|\bdata-(?:copiado|falhou)=")([^"]+)(")/g;

/** Frase que não precisa de tradução: vazia, só a marca, ou marcada translate="no". */
const pular = (atributos, interno) => /translate="no"/.test(atributos) || ['', 'Syden'].includes(semMarcas(interno));

/** As frases da página em português, na ordem em que aparecem. */
export function frasesDaPagina(html) {
  const frases = new Set();
  const limpo = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const [, , atributos, interno] of limpo.matchAll(ELEMENTO)) {
    if (!pular(atributos, interno)) frases.add(normalizar(interno));
  }
  for (const [, , valor] of limpo.matchAll(ATRIBUTO)) frases.add(normalizar(valor));
  return [...frases];
}

const lerPagina = (pagina) => readFileSync(join(AQUI, 'site', pagina), 'utf8');

/** Todas as frases de todas as páginas traduzidas: é o que cada dicionário precisa ter. */
export function frasesDoSite() {
  return [...new Set(PAGINAS.flatMap((pagina) => frasesDaPagina(lerPagina(pagina))))];
}

/**
 * Os endereços relativos da raiz viram "../" dentro de /<idioma>/. As capturas trocam de pasta: cada
 * idioma mostra o app no próprio idioma (sem elas, cai nas do inglês, que é melhor que português).
 */
function reapontar(html, idioma, avisos) {
  return html.replace(/\b(src|href)="([^"]+)"/g, (inteiro, atributo, valor) => {
    // A outra página traduzida fica no mesmo idioma: o "contribuir" de /ja/ é o /ja/contribuir.html.
    if (/^(#|\/|https?:|mailto:|data:)/.test(valor) || valor === './' || PAGINAS.includes(valor)) return inteiro;
    // As páginas legais existem em português e em inglês (web/site/en/). Para quem não lê português, a
    // inglesa serve mais do que o original — e ela mesma aponta para ele, que é o que vale.
    const legal = valor.match(/^(privacidade|termos)\.html(#.*)?$/);
    if (legal) return `${atributo}="../en/${legal[1] === 'privacidade' ? 'privacy' : 'terms'}.html${legal[2] ?? ''}"`;
    const captura = valor.match(/^capturas\/pt-BR\/(.+)$/);
    if (captura) {
      const deste = join(AQUI, 'site', 'capturas', idioma, captura[1]);
      const pasta = existsSync(deste) ? idioma : 'en';
      if (pasta !== idioma) avisos.add(`${idioma}: sem capturas próprias, usa as do inglês`);
      return `${atributo}="../capturas/${pasta}/${captura[1]}"`;
    }
    return `${atributo}="../${valor}"`;
  });
}

/** Os <link rel="alternate">, que dizem ao buscador (e ao idioma-do-site.js) onde está cada versão. */
function alternativas(idiomas, pagina) {
  const arquivo = pagina === 'index.html' ? '' : pagina;
  return [
    `<link rel="alternate" hreflang="x-default" href="${ENDERECO}${arquivo}" />`,
    `<link rel="alternate" hreflang="${PADRAO}" href="${ENDERECO}${arquivo}" />`,
    ...idiomas.map((codigo) => `<link rel="alternate" hreflang="${codigo}" href="${ENDERECO}${codigo}/${arquivo}" />`),
  ].join('\n    ');
}

/** A escolha de idioma, no pé de toda página. Lista de links: funciona sem JavaScript e o buscador a segue. */
function escolhaDeIdioma(atual, idiomas, nomes, prefixo) {
  const itens = [PADRAO, ...idiomas]
    .map((codigo) => {
      const href = codigo === PADRAO ? prefixo || './' : `${prefixo}${codigo}/`;
      const marcado = codigo === atual ? ' aria-current="page"' : '';
      return `<li><a href="${href}" lang="${codigo}" data-idioma="${codigo}"${marcado}>${nomes.get(codigo) ?? codigo}</a></li>`;
    })
    .join('');
  return `<details class="idioma-do-site"><summary><span aria-hidden="true">🌐</span> ${nomes.get(atual) ?? atual}</summary><ul>${itens}</ul></details>`;
}

/** O que toda página da apresentação ganha: alternativas, o script de idioma e a escolha no pé. */
function enfeitar(html, pagina, atual, idiomas, nomes, prefixo) {
  return html
    .replace('</head>', `    ${alternativas(idiomas, pagina)}\n    <script src="${prefixo}idioma-do-site.js"></script>\n  </head>`)
    .replace(/(<footer>[\s\S]*?)(\s*<\/div>\s*<\/footer>)/, (_, antes, depois) => `${antes}\n        ${escolhaDeIdioma(atual, idiomas, nomes, prefixo)}${depois}`);
}

/**
 * Monta todas as versões. Devolve { paginas: Map<caminho relativo, html>, faltando, avisos }; quem chama
 * escreve os arquivos e decide parar quando faltar frase.
 */
export function montarIdiomas() {
  const idiomas = idiomasDoSite();
  const doApp = idiomasDoApp();
  const nomes = new Map(doApp.map((i) => [i.codigo, i.nativo]));
  const frases = frasesDoSite();
  const originais = new Map(PAGINAS.map((pagina) => [pagina, lerPagina(pagina)]));
  const paginas = new Map([...originais].map(([pagina, html]) => [pagina, enfeitar(html, pagina, PADRAO, idiomas, nomes, '')]));
  const faltando = {};
  const avisos = new Set();

  for (const idioma of idiomas) {
    const info = doApp.find((i) => i.codigo === idioma);
    if (!info) {
      faltando[idioma] = ['(este idioma não existe em web/src/i18n/idiomas.ts)'];
      continue;
    }
    const dicionario = JSON.parse(readFileSync(join(TEXTOS, `${idioma}.json`), 'utf8'));
    const falta = frases.filter((frase) => !dicionario[frase]?.trim());
    if (falta.length) {
      faltando[idioma] = falta;
      continue;
    }
    const traduzir = (frase) => dicionario[normalizar(frase)];

    for (const [pagina, original] of originais) {
      let html = original.replace(/<!--[\s\S]*?-->/g, '');
      html = html.replace(ELEMENTO, (inteiro, tag, atributos, interno) =>
        pular(atributos, interno) ? inteiro : `<${tag}${atributos}>${traduzir(interno)}</${tag}>`,
      );
      html = html.replace(ATRIBUTO, (_, antes, valor, depois) => antes + traduzir(valor).replace(/"/g, '&quot;') + depois);
      html = html
        .replace(/<html lang="[^"]*">/, `<html lang="${idioma}"${info.rtl ? ' dir="rtl"' : ''}>`)
        .replace(`<meta property="og:url" content="${ENDERECO}" />`, `<meta property="og:url" content="${ENDERECO}${idioma}/" />`);
      html = reapontar(html, idioma, avisos);
      paginas.set(`${idioma}/${pagina}`, enfeitar(html, pagina, idioma, idiomas, nomes, '../'));
    }
  }

  return { paginas, faltando, avisos: [...avisos] };
}

// Rodado direto: lista as frases (ou o que falta), para quem vai traduzir.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (process.argv.includes('--faltando')) {
    const { faltando } = montarIdiomas();
    const idiomas = Object.keys(faltando);
    console.log(idiomas.length ? JSON.stringify(faltando, null, 2) : 'Nenhuma frase faltando.');
  } else {
    console.log(JSON.stringify(Object.fromEntries(frasesDoSite().map((f) => [f, ''])), null, 2));
  }
}
