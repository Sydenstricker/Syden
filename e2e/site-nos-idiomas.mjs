// A página de apresentação em cada idioma, medida — e não confiada (ver "Conferir idioma que ninguém
// da dupla lê é medir", no CLAUDE.md).
//
// Para cada /<idioma>/: a direção do documento, nenhuma frase do português sobrando na tela, zero
// estouro horizontal no celular, nenhuma violação da política de segurança e nenhum arquivo faltando.
// E as regras do desvio de idioma (web/site/idioma-do-site.js): navegador em inglês vai para /en/, em
// português fica, língua que o site não tem cai no inglês, a escolha guardada vence, e quem chega com
// ?convite= não é desviado para idioma nenhum.
//
//   npm run build -w web
//   node e2e/site-nos-idiomas.mjs            todos os idiomas montados
//   IDIOMAS=ar,ja node e2e/site-nos-idiomas.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { CSP } from './politica-de-seguranca.mjs';
import { PAGINAS, frasesDoSite, idiomasDoApp } from '../web/scripts/site-traduzido.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(RAIZ, 'web', 'dist');
const PORTA = 4323;
const BASE = `http://localhost:${PORTA}`;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const servidor = createServer(async (pedido, resposta) => {
  let caminho = join(DIST, decodeURIComponent(pedido.url.split('?')[0]));
  try {
    if ((await stat(caminho)).isDirectory()) caminho = join(caminho, 'index.html');
    resposta.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream', 'content-security-policy': CSP });
    resposta.end(await readFile(caminho));
  } catch {
    resposta.writeHead(404);
    resposta.end();
  }
}).listen(PORTA);

const codigos = new Set(idiomasDoApp().map((i) => i.codigo));
const montados = readdirSync(DIST, { withFileTypes: true })
  .filter((item) => item.isDirectory() && codigos.has(item.name))
  .map((item) => item.name);
const idiomas = process.env.IDIOMAS ? process.env.IDIOMAS.split(',') : montados;
const rtl = new Set(idiomasDoApp().filter((i) => i.rtl).map((i) => i.codigo));

// As frases em português que são longas o bastante para não coincidirem com outro idioma por acaso.
const frasesPt = frasesDoSite()
  .map((frase) => frase.replace(/<[^>]+>/g, ''))
  .filter((frase) => frase.length > 25);

const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const problemas = [];
const ok = (texto) => console.log(`  OK  ${texto}`);

async function abrir(endereco, { locale = 'en-US', guardado, largura = 390 } = {}) {
  const contexto = await navegador.newContext({ locale, viewport: { width: largura, height: 844 } });
  if (guardado) await contexto.addInitScript((g) => localStorage.setItem('syden.idioma', g), guardado);
  const pagina = await contexto.newPage();
  const bloqueios = [];
  const faltas = [];
  pagina.on('console', (m) => /Content Security Policy|Refused/.test(m.text()) && bloqueios.push(m.text()));
  pagina.on('response', (r) => r.status() >= 400 && faltas.push(`${r.status()} ${r.url()}`));
  await pagina.goto(BASE + endereco, { waitUntil: 'networkidle' });
  return { contexto, pagina, bloqueios, faltas };
}

console.log('O desvio de idioma');
for (const [descricao, endereco, opcoes, esperado] of [
  ['navegador em inglês vai para /en/', '/', { locale: 'en-US' }, '/en/'],
  ['navegador em português fica na raiz', '/', { locale: 'pt-BR' }, '/'],
  ['português de Portugal também fica', '/', { locale: 'pt-PT' }, '/'],
  ['quem abriu /en/ por um link fica no /en/', '/en/', { locale: 'pt-BR' }, '/en/'],
  ['a escolha guardada vence o navegador', '/', { locale: 'en-US', guardado: 'pt-BR' }, '/'],
  ['a escolha guardada leva para fora da raiz', '/', { locale: 'pt-BR', guardado: 'en' }, '/en/'],
  ['?convite= não é desviado por idioma', '/?convite=abc', { locale: 'en-US' }, '/app/'],
  ['o contribuir também segue o navegador', '/contribuir.html', { locale: 'ja-JP' }, '/ja/contribuir.html'],
]) {
  const { contexto, pagina } = await abrir(endereco, opcoes);
  const chegou = new URL(pagina.url()).pathname;
  chegou === esperado ? ok(descricao) : problemas.push(`${descricao}: foi para ${chegou}, esperado ${esperado}`);
  await contexto.close();
}

{
  const { contexto, pagina } = await abrir('/', { locale: 'pt-BR', largura: 1280 });
  await pagina.locator('.idioma-do-site summary').click();
  await pagina.locator('.idioma-do-site a[data-idioma="en"]').click();
  await pagina.waitForURL('**/en/');
  const guardado = await pagina.evaluate(() => localStorage.getItem('syden.idioma'));
  guardado === 'en' ? ok('escolher no pé guarda a escolha (a mesma chave do app)') : problemas.push(`a escolha no pé guardou ${guardado}`);
  await contexto.close();
}

console.log(`\nCada idioma (${idiomas.length})`);
for (const idioma of idiomas) for (const arquivo of PAGINAS) {
  const endereco = `/${idioma}/${arquivo === 'index.html' ? '' : arquivo}`;
  const { contexto, pagina, bloqueios, faltas } = await abrir(endereco, { guardado: idioma });
  const medida = await pagina.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: getComputedStyle(document.documentElement).direction,
    estouro: document.documentElement.scrollWidth - innerWidth,
    texto: document.body.innerText,
  }));
  const sobras = frasesPt.filter((frase) => medida.texto.includes(frase));
  const erros = [
    medida.lang !== idioma && `lang="${medida.lang}"`,
    medida.dir !== (rtl.has(idioma) ? 'rtl' : 'ltr') && `direção ${medida.dir}`,
    medida.estouro > 0 && `estoura ${medida.estouro} px no celular`,
    sobras.length && `${sobras.length} frase(s) em português: "${sobras[0].slice(0, 50)}"`,
    bloqueios.length && `a política barrou: ${bloqueios[0]}`,
    faltas.length && `faltou: ${faltas[0]}`,
  ].filter(Boolean);
  erros.length ? problemas.push(`${endereco}: ${erros.join("; ")}`) : ok(`${endereco}  ${medida.dir}`);
  await contexto.close();
}

await navegador.close();
servidor.close();

if (problemas.length) {
  console.log('\nPROBLEMAS:');
  for (const problema of problemas) console.log(`  - ${problema}`);
  process.exit(1);
}
console.log('\nA apresentação abre certa em todos os idiomas, e o desvio segue as regras.');
