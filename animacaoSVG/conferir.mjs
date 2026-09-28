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
  9: 'Comendo Cenoura', 10: 'Boas-vindas', 11: 'Buraco Negro',
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

for (const n of [1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8]) {
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

// OS TRÊS ERROS MOSTRAM O CÓDIGO, E NO MESMO LUGAR.
//
// "No mesmo lugar" é o ponto, e é por isso que isto é medido em vez de olhado: um código de erro é
// informação, e informação tem de estar onde o olho já sabe procurar. O 404 tinha três dígitos soltos em
// posições escolhidas para parecer "flutuante", que na tela só pareceram desalinhadas. Se um dia alguém
// mover o código de uma das telas, a diferença aparece aqui em pixels.
const CODIGOS = { 6: 'OFFLINE', 7: '500', 8: '404' };
const alturas = [];
for (const [n, esperado] of Object.entries(CODIGOS)) {
  await page.click(`#presetBtn${n}`);
  await page.waitForTimeout(150);
  const achado = await page.evaluate(() => {
    const texto = document.querySelector('#loaderStage .codigo text');
    if (!texto) return null;
    return { texto: texto.textContent.trim(), y: Number(texto.getAttribute('y')) };
  });
  if (!achado) {
    problemas.push(`preset ${n}: não tem o código do erro na tela`);
    continue;
  }
  if (achado.texto !== esperado) problemas.push(`preset ${n}: código "${achado.texto}", esperado "${esperado}"`);
  alturas.push(achado.y);
}
if (alturas.length && new Set(alturas).size !== 1) {
  problemas.push(`os códigos de erro estão em alturas diferentes: ${alturas.join(', ')}`);
} else if (alturas.length) {
  console.log('');
  console.log(`  os três erros mostram o código, todos na mesma altura (y=${alturas[0]})`);
}

// OS PONTINHOS "..." SÓ APARECEM EM QUEM ESTÁ ESPERANDO ALGO.
//
// Isto é conferido porque foi quase um defeito: o código decidia "é tela de erro" com um
// `currentPreset >= 6`, e ao acrescentar os presets 9, 10 e 11 os três cairiam nessa conta. Um número
// mágico com "maior que" vira mentira na primeira vez que a lista cresce. A tela de boas-vindas também
// não leva pontinhos — ela não espera nada, está cumprimentando.
const PONTINHOS = { 1: true, 2: true, 3: true, 4: true, 5: true, 9: true, 11: true, 10: false, 6: false, 7: false, 8: false };
for (const [n, deveria] of Object.entries(PONTINHOS)) {
  await page.click(`#presetBtn${n}`);
  await page.waitForTimeout(150);
  const tem = (await page.locator('#loaderStage .dot-flashing').count()) > 0;
  if (tem !== deveria) {
    problemas.push(`preset ${n}: ${tem ? 'tem' : 'não tem'} pontinhos, e devia ${deveria ? 'ter' : 'não ter'}`);
  }
}
console.log('');
console.log('  pontinhos "..." só nos presets que estão esperando algo: conferido nos onze');

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
console.log('Os onze presets desenham e animam, e o controle de velocidade responde.');
