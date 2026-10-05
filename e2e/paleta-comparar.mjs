// Fotografa o Syden de verdade em duas paletas, lado a lado, para decidir as cores do app depois do
// rebrand de 05/10/2026: a de hoje (cinza e azul) e a dos protótipos do D4 (azul-noite, creme e âmbar,
// com Bricolage Grotesque nos títulos e Instrument Sans no texto).
//
// A proposta entra como CSS POR CIMA do app, só nesta captura: troca as variáveis de cor do styles.css
// e a fonte. Nada muda no código do app até a decisão.
//
//   SITE=http://localhost:5174/app/ node e2e/paleta-comparar.mjs
//   → e2e/fotos/paleta-atual-x-d4.png
import { abrirNavegador, cadastrar, dispensarPresentes, novaAba, ok, resumo } from './ajuda.mjs';

const D4 = `
:root {
  --bg-darkest: #11141a;
  --bg-rail: #11141a;
  --bg-float: #11141a;
  --bg-sidebar: #171b23;
  --bg-secondary: #171b23;
  --bg-main: #1c212b;
  --bg-input: #262c38;
  --bg-raised: #262c38;
  --bg-raised-hover: #2f3644;
  --bg-hover: rgba(243, 235, 216, 0.05);
  --bg-active: rgba(243, 235, 216, 0.1);
  --text: #e8eaf0;
  --text-strong: #f5f6fa;
  --text-muted: #9aa1b1;
  --accent: #f5b83d;
  --accent-hover: #ffd27a;
  --green: #2fbf71;
  --red: #e5534b;
  --amber: #e8a93a;
  --border: rgba(243, 235, 216, 0.08);
}
body, button, input, textarea, select {
  font-family: 'Syden Instrument Sans', 'Segoe UI', var(--fonte-idioma), system-ui, sans-serif !important;
}
h1, h2, h3, .channel-name, .sidebar-header, .home h2 {
  font-family: 'Syden Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif !important;
  letter-spacing: -0.01em;
}
/* No âmbar, texto branco não se lê: os botões principais passam a escrever em azul-noite. */
.btn-primary, .btn-primary:hover { color: #14161b !important; }
`;

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
async function fotografar(tema) {
  await ana.evaluate((css) => {
    document.getElementById('paleta-d4')?.remove();
    if (!css) return;
    const el = document.createElement('style');
    el.id = 'paleta-d4';
    el.textContent = css;
    document.head.append(el);
  }, tema === 'd4' ? D4 : '');
  await ana.evaluate(() => document.fonts.ready);
  await ana.waitForTimeout(500);
  // Canal
  await ana.locator('.rail-list button').first().click();
  await ana.getByText('geral', { exact: true }).first().click();
  await ana.waitForTimeout(500);
  fotos[tema + '-canal'] = (await ana.screenshot()).toString('base64');
  // Início (vila)
  await ana.locator('.rail-logo').click();
  await ana.locator('.vila').waitFor();
  await ana.waitForTimeout(800);
  fotos[tema + '-inicio'] = (await ana.screenshot()).toString('base64');
}
await fotografar('atual');
await fotografar('d4');
ok('as quatro fotos foram tiradas');

// A folha: duas colunas (hoje | proposta), duas linhas (canal | início).
const folha = await novaAba(contexto);
await folha.setViewportSize({ width: 1400, height: 900 });
await folha.setContent(`
<body style="margin:0;padding:32px;background:#0b0d11;color:#e8eaf0;font-family:'Segoe UI',sans-serif">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;width:2760px">
    <h1 style="margin:0;font-size:40px">Hoje</h1>
    <h1 style="margin:0;font-size:40px">Proposta D4 <span style="font-weight:400;color:#9aa1b1;font-size:26px">— azul-noite, creme e âmbar · Bricolage Grotesque + Instrument Sans</span></h1>
    ${['canal', 'inicio']
      .map((tela) =>
        ['atual', 'd4'].map((t) => `<img style="width:1360px;border-radius:12px;display:block" src="data:image/png;base64,${fotos[t + '-' + tela]}">`).join(''),
      )
      .join('')}
  </div>
</body>`);
await folha.locator('img').last().evaluate((img) => img.decode());
await folha.screenshot({ path: 'e2e/fotos/paleta-atual-x-d4.png', fullPage: true });
ok('folha em e2e/fotos/paleta-atual-x-d4.png');

await browser.close();
resumo('A comparação de paletas');
