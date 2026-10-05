// Confere o estúdio D4 (animacoes_d4.html) do mesmo jeito que o conferir.mjs confere o primeiro:
// clicando em cada preset e MEDINDO o que aparece, em vez de olhar um ou dois.
//
// O que é conferido:
//   - todo preset desenha (formas) e anima (o que o navegador está de fato animando);
//   - espera e momentos NÃO têm texto; os três erros têm o código, "CÓDIGO — descrição", na mesma altura;
//   - o controle de velocidade encurta as durações;
//   - com "menos movimento", nada anima;
//   - não há erro de JavaScript na página.
// E tira uma foto de cada preset, numa folha só, para quem for revisar o desenho.
//
// Rode da raiz do projeto (é lá que o playwright-core está instalado):
//
//   node animacaoSVG/conferir-d4.mjs              → e a folha em animacaoSVG/folha-d4.png
import { chromium } from 'playwright-core';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const ARQUIVO = new URL('./animacoes_d4.html', import.meta.url).href;
const FOLHA = new URL('./folha-d4.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const NOMES = {
  1: 'Digitando',
  2: 'Orelhas atentas',
  3: 'Traço',
  4: 'Pulo',
  5: 'Minimalista',
  6: 'Entrando na voz',
  7: 'Boas-vindas',
  8: 'Autorizado',
  9: 'Ciclo de status',
  10: 'Sem internet',
  11: 'Erro 500',
  12: 'Erro 404',
  13: 'Mascote: ocioso',
  14: 'Mascote: intro',
  15: 'Digitar (transição)',
  16: 'Falar (transição)',
  17: 'Status (mascote)',
  18: 'Ouvindo música',
  19: 'Karaokê',
  20: 'Assistir junto',
  21: 'Apresentação',
};
const CODIGOS = { 10: 'OFFLINE — Sem conexão', 11: 'ERRO 500 — Problema no servidor', 12: 'ERRO 404 — Página não encontrada' };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problemas = [];
page.on('pageerror', (e) => problemas.push('erro de JS na página: ' + e.message));
await page.goto(ARQUIVO, { waitUntil: 'load' });

const medir = () =>
  page.evaluate(() => {
    const svg = document.querySelector('#loaderStage svg');
    if (!svg) return { formas: 0, animadas: 0, largura: 0, textos: [] };
    let animadas = 0;
    for (const el of svg.querySelectorAll('*')) if (el.getAnimations().length > 0) animadas++;
    return {
      formas: svg.querySelectorAll('path, circle, rect, ellipse, line, polygon').length,
      animadas,
      largura: Math.round(svg.getBoundingClientRect().width),
      textos: [...svg.querySelectorAll('text')].map((t) => ({ texto: t.textContent.trim(), y: t.getAttribute('y') })),
    };
  });

const fotos = [];
const alturas = new Set();
for (const n of Object.keys(NOMES).map(Number)) {
  await page.click(`#presetBtn${n}`);
  await page.waitForTimeout(250);
  const m = await medir();
  const ok = m.formas >= 5 && m.animadas >= 1 && m.largura > 50;
  console.log(`  ${ok ? 'OK ' : 'XX '} ${String(n).padStart(2)}. ${NOMES[n].padEnd(16)} ${String(m.formas).padStart(2)} formas, ${String(m.animadas).padStart(2)} animadas`);
  if (!ok) problemas.push(`preset ${n} (${NOMES[n]}) não desenhou ou não animou`);

  // A ARMADILHA QUE APARECEU TRÊS VEZES: uma propriedade declarada só no ÚLTIMO quadro-chave é
  // interpolada desde o primeiro, a partir do valor de base. "opacity: 0" só no 100% fez orelhas,
  // a barra do karaokê e as barras do quadro irem sumindo desde o começo do ciclo.
  const armadilhas = await page.evaluate(() => {
    const css = document.querySelector('#loaderStage svg style')?.textContent ?? '';
    const ruins = [];
    for (const [, nome, corpo] of css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?\})\s*\}/g)) {
      const pontos = [...corpo.matchAll(/([\d%,\s]+)\{([^}]*)\}/g)];
      if (pontos.length < 2) continue;
      const temNoPrimeiro = /opacity/.test(pontos[0][2]);
      const temEmAlgum = pontos.some((p) => /opacity/.test(p[2]));
      if (temEmAlgum && !temNoPrimeiro && !/step/.test(css.split(nome)[1]?.slice(0, 60) ?? '')) ruins.push(nome);
    }
    return ruins;
  });
  if (armadilhas.length) problemas.push(`preset ${n}: opacidade declarada fora do primeiro quadro-chave em ${armadilhas.join(', ')}`);

  if (CODIGOS[n]) {
    if (m.textos.length !== 1 || m.textos[0].texto !== CODIGOS[n]) problemas.push(`preset ${n}: código ${JSON.stringify(m.textos)}, esperado "${CODIGOS[n]}"`);
    else alturas.add(m.textos[0].y);
  } else if (m.textos.length) {
    problemas.push(`preset ${n} (${NOMES[n]}) tem texto, e tela de espera não leva texto: ${JSON.stringify(m.textos)}`);
  }

  // A foto, no meio da animação: é o momento em que um desenho torto aparece.
  await page.waitForTimeout(700);
  fotos.push({ n, png: (await page.locator('#palco').screenshot()).toString('base64') });
}
if (alturas.size === 1) console.log(`\n  os três erros mostram o código, todos na mesma altura (y=${[...alturas][0]})`);
else problemas.push(`os códigos de erro estão em alturas diferentes: ${[...alturas].join(', ')}`);
console.log('  espera e momentos sem texto nenhum: conferido');

// Velocidade: a primeira duração do CSS do desenho tem de encolher.
await page.click('#presetBtn1');
const duracao = () => page.evaluate(() => Number((document.querySelector('#loaderStage svg style').textContent.match(/animation: \w+ ([\d.]+)s/) ?? [])[1]));
const antes = await duracao();
await page.evaluate(() => {
  const s = document.getElementById('speedSlider');
  s.value = '2.0';
  s.dispatchEvent(new Event('input'));
});
const depois = await duracao();
console.log(`  velocidade 1.0x -> ${antes}s ; 2.0x -> ${depois}s`);
if (!(antes && depois && depois < antes)) problemas.push('o controle de velocidade não encurtou a duração');

// Menos movimento: nada pode estar animando em preset nenhum.
await page.check('#semMovimento');
for (const n of Object.keys(NOMES).map(Number)) {
  await page.click(`#presetBtn${n}`);
  await page.waitForTimeout(100);
  const m = await medir();
  if (m.animadas > 0) problemas.push(`preset ${n}: com menos movimento ainda anima ${m.animadas} elemento(s)`);
}
console.log('  com "menos movimento", tudo parado: conferido');

// A folha com os doze.
const folha = await browser.newPage();
await folha.setContent(`<body style="margin:0;padding:20px;background:#0b0d11;font-family:Segoe UI,sans-serif;color:#e8eaf0">
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;width:1720px">
  ${fotos.map(({ n, png }) => `<figure style="margin:0"><img style="width:100%;border-radius:12px;display:block" src="data:image/png;base64,${png}"><figcaption style="margin-top:6px">${n}. ${NOMES[n]}</figcaption></figure>`).join('')}
  </div></body>`);
await folha.screenshot({ path: FOLHA, fullPage: true });

await browser.close();
console.log('');
if (problemas.length) {
  console.log('PROBLEMAS:');
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log(`Os ${Object.keys(NOMES).length} presets desenham e animam. Folha em ${FOLHA}`);
