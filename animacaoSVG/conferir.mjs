// Confere que TODOS os oito presets desenham alguma coisa.
//
// POR QUE ISTO EXISTE. O defeito que travou o ajuste fino foi justamente invisível: quatro dos cinco
// botões devolviam texto vazio e a tela ficava em branco, sem erro no console. Olhar um preset não
// pega isso — só clicar em todos pega. Então aqui cada um é clicado e o que aparece no palco é
// MEDIDO: quantas formas existem, quantas o navegador está de fato animando, e se o aviso de
// "preset sem desenho" apareceu.
//
// Rode da raiz do projeto (é lá que o playwright-core está instalado):
//
//   node animacaoSVG/conferir.mjs
import { chromium } from 'playwright-core';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const ARQUIVO = new URL('./logo_loading_screen_animations.html', import.meta.url).href;

const NOMES = {
  1: 'Órbita & Pulo',
  2: 'Giro Mágico',
  3: 'Linhas (Draw)',
  4: 'Pulo Progressivo',
  5: 'Minimalista',
  6: 'Sem Internet',
  7: 'Erro 500',
  8: 'Erro 404',
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const problemas = [];
page.on('pageerror', (e) => problemas.push('erro de JS na página: ' + e.message));

await page.goto(ARQUIVO, { waitUntil: 'load' });
// O Tailwind vem de CDN e reescreve as classes; sem esta espera as medidas de tamanho saem zeradas.
await page.waitForTimeout(2000);

for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  await page.click(`#presetBtn${n}`);
  await page.waitForTimeout(400);

  const m = await page.evaluate(() => {
    const palco = document.getElementById('loaderStage');
    const aviso = palco.textContent.includes('não tem desenho');
    const svg = palco.querySelector('svg');
    if (!svg) return { aviso, formas: 0, animadas: 0, largura: 0, altura: 0 };

    const formas = svg.querySelectorAll('path, circle, polygon, rect, ellipse, line, text').length;
    // getAnimations() diz o que o navegador REALMENTE está animando — e não o que o CSS afirma que
    // deveria. Foi assim que as faíscas paradas do preset 7 apareceram: o atributo era animation=
    // em vez de style=, e o navegador ignorava em silêncio.
    let animadas = 0;
    for (const el of svg.querySelectorAll('*')) {
      if (el.getAnimations && el.getAnimations().length > 0) animadas++;
    }
    const caixa = svg.getBoundingClientRect();
    return { aviso, formas, animadas, largura: Math.round(caixa.width), altura: Math.round(caixa.height) };
  });

  const ok = !m.aviso && m.formas >= 3 && m.animadas >= 1 && m.largura > 50;
  console.log(
    `  ${ok ? 'OK ' : 'XX '} ${n}. ${NOMES[n].padEnd(18)} ${String(m.formas).padStart(2)} formas, ` +
      `${String(m.animadas).padStart(2)} animadas, ${m.largura}x${m.altura}px` +
      (m.aviso ? '   <- caiu no aviso de preset sem desenho' : ''),
  );
  if (!ok) problemas.push(`preset ${n} (${NOMES[n]}) não desenhou como esperado`);
}

// O controle de velocidade também é parte do ajuste fino: se ele não muda a duração, não serve de
// nada, e o sintoma seria "mexi no controle e não mudou" — fácil de confundir com impressão.
await page.click('#presetBtn1');
await page.waitForTimeout(300);
const duracao = () =>
  page.evaluate(() => {
    const css = document.querySelector('#loaderStage svg style')?.textContent ?? '';
    const achou = css.match(/bunnyHop ([\d.]+)s/);
    return achou ? Number(achou[1]) : null;
  });

const antes = await duracao();
await page.evaluate(() => {
  const s = document.getElementById('speedSlider');
  s.value = '2.0';
  s.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(300);
const depois = await duracao();

console.log('');
console.log(`  velocidade 1.0x -> pulo de ${antes}s ; 2.0x -> pulo de ${depois}s`);
if (!(antes && depois && depois < antes)) problemas.push('o controle de velocidade não encurtou a duração');

await browser.close();

console.log('');
if (problemas.length) {
  console.log('PROBLEMAS:');
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log('Os oito presets desenham e animam, e o controle de velocidade responde.');
