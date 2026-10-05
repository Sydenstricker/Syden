// Fotografa o Syden de verdade para decidir cores, lado a lado.
//
// A primeira rodada (05/10/2026) comparou a paleta antiga com a D4 escura, e a D4 foi escolhida e
// implementada. Esta rodada é a do MODO DE DIA: o D4 não veio com versão clara, então a proposta abaixo
// deriva das mesmas cores — fundo creme, texto azul-noite e um âmbar mais fechado, porque o âmbar dos
// protótipos some sobre o claro (2:1 de contraste). Medido: texto 12:1, texto apagado 5,6:1, destaque
// como texto 4,6:1.
//
// A proposta entra como CSS POR CIMA do app, só nesta captura. Nada muda no código até a decisão.
//
//   SITE=http://localhost:5174/app/ node e2e/paleta-comparar.mjs
//   → e2e/fotos/paleta-dia.png   (noite D4 | dia de hoje | dia D4 proposto)
import { abrirNavegador, cadastrar, dispensarPresentes, novaAba, ok, resumo } from './ajuda.mjs';

const DIA_D4 = `
:root[data-theme='light'] {
  --bg-darkest: #e8e0cf;
  --bg-rail: #e8e0cf;
  --bg-sidebar: #f3ede0;
  --bg-secondary: #f3ede0;
  --bg-main: #fbf8f1;
  --bg-input: #efe8da;
  --bg-raised: #ebe3d3;
  --bg-raised-hover: #e2d8c4;
  --bg-float: #fffdf8;
  --bg-hover: rgba(30, 37, 51, 0.05);
  --bg-active: rgba(30, 37, 51, 0.09);
  --text: #2a3142;
  --text-strong: #1e2533;
  --text-muted: #5c6475;
  --accent: #9a6608;
  --accent-hover: #7f5405;
  --accent-texto: #ffffff;
  --link: #8a5a00;
  --green: #1b7a48;
  --red: #c8423b;
  --amber: #a8730a;
  --border: rgba(30, 37, 51, 0.12);
  --shadow: rgba(30, 37, 51, 0.14);
}`;

const { browser, contexto } = await abrirNavegador({ viewport: { width: 1360, height: 820 } });
const s = Date.now().toString().slice(-5);

const ana = await novaAba(contexto);
await cadastrar(ana, 'marina' + s);
await dispensarPresentes(ana);
const kenji = await novaAba(await browser.newContext({ viewport: { width: 1360, height: 820 } }));
await cadastrar(kenji, 'kenji' + s);
await dispensarPresentes(kenji);

// Uma conversa curta no #geral, para a tela de canal ter o que mostrar.
async function falar(page, texto) {
  const caixa = page.locator('textarea, [contenteditable="true"]').last();
  await caixa.click();
  await caixa.fill(texto);
  await caixa.press('Enter');
  await page.waitForTimeout(400);
}
for (const page of [ana, kenji]) {
  await page.locator('.rail-list button').first().click();
  await page.getByText('geral', { exact: true }).first().click();
}
await falar(kenji, 'Alguém topa entrar na sala de voz hoje à noite?');
await falar(ana, 'Eu topo! Levo o karaokê.');
await falar(kenji, 'Fechado, às 21h na Sala 1.');
await ana.waitForTimeout(800);

const fotos = {};
async function fotografar(nome, tema, css) {
  await ana.evaluate(
    ([tema, css]) => {
      document.documentElement.dataset.theme = tema;
      document.getElementById('paleta-proposta')?.remove();
      if (!css) return;
      const el = document.createElement('style');
      el.id = 'paleta-proposta';
      el.textContent = css;
      document.head.append(el);
    },
    [tema, css],
  );
  await ana.evaluate(() => document.fonts.ready);
  await ana.locator('.rail-list button').first().click();
  await ana.getByText('geral', { exact: true }).first().click();
  await ana.waitForTimeout(500);
  fotos[nome + '-canal'] = (await ana.screenshot()).toString('base64');
  // Configurações: é a tela com mais botões, abas e interruptores — onde o destaque mais aparece.
  await ana.locator('button[aria-label="Configurações"]').first().click();
  await ana.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  await ana.waitForTimeout(500);
  fotos[nome + '-config'] = (await ana.screenshot()).toString('base64');
  await ana.keyboard.press('Escape');
  await ana.waitForTimeout(300);
}
await fotografar('noite', 'dark', '');
await fotografar('hoje', 'light', '');
await fotografar('proposta', 'light', DIA_D4);
ok('as seis fotos foram tiradas');

const COLUNAS = [
  ['noite', 'Noite D4', 'já implementado'],
  ['hoje', 'Dia, hoje', 'o claro de antes'],
  ['proposta', 'Dia D4', 'proposta: creme, azul-noite e âmbar fechado'],
];
const folha = await novaAba(contexto);
await folha.setContent(`
<body style="margin:0;padding:32px;background:#0b0d11;color:#e8eaf0;font-family:'Segoe UI',sans-serif">
  <div style="display:grid;grid-template-columns:repeat(3,1360px);gap:24px">
    ${COLUNAS.map(([, t, sub]) => `<h1 style="margin:0;font-size:44px">${t} <span style="font-weight:400;color:#9aa1b1;font-size:28px">— ${sub}</span></h1>`).join('')}
    ${['canal', 'config']
      .map((tela) => COLUNAS.map(([n]) => `<img style="width:1360px;border-radius:12px;display:block" src="data:image/png;base64,${fotos[n + '-' + tela]}">`).join(''))
      .join('')}
  </div>
</body>`);
for (const img of await folha.locator('img').all()) await img.evaluate((i) => i.decode());
await folha.screenshot({ path: 'e2e/fotos/paleta-dia.png', fullPage: true });
ok('folha em e2e/fotos/paleta-dia.png');

await browser.close();
resumo('A comparação de paletas');
