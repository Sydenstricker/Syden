// O SYDEN NO CELULAR (20/11/2026, relato dele: "não consegui clicar na comunidade para compartilhar o link"). Num iPhone
// simulado (390 × 844, toque, sem botão direito):
//  - o convite está na capa da comunidade, e copia (sem folha de compartilhar no navegador de teste);
//  - "Início" na lista leva ao salão, e não só acende a linha;
//  - o botão de pessoas abre a lista como gaveta, e tocar num membro abre o perfil;
//  - SEGURAR o dedo num membro e no ícone da comunidade abre o menu de botão direito, sem abrir o perfil junto.
//
//   node e2e/celular.mjs   (API de teste na 3099, site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'celular');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['clipboard-read', 'clipboard-write'],
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
// A folha de compartilhar do sistema não existe no teste: guarda o que foi pedido a ela.
await ctx.addInitScript(() => {
  navigator.share = async (dados) => {
    window.__compartilhado = dados;
  };
});
const p = await ctx.newPage();
p.on('pageerror', (e) => falhou('erro na página: ' + e.message));
const foto = (nome) => p.screenshot({ path: path.join(FOTOS, `${nome}.png`) });

/** Segura o dedo num elemento: um toque que não solta por 800 ms (CDP, porque o Playwright só tem o toque rápido). */
async function segurar(locator) {
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await p.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(400);
}

try {
  await cadastrar(p, 'cel' + s);
  await dispensarPresentes(p).catch(() => {});
  await p.getByRole('button', { name: 'Adicionar comunidade' }).tap();
  await p.locator('.community-choice-option').first().tap();
  await p.locator('form.dialog input').first().fill('Turma ' + s);
  await p.locator('form.dialog .btn-primary').tap();
  await p.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });

  // 1. O convite na capa.
  const convite = p.locator('.convite-da-capa');
  await convite.tap();
  await p.waitForTimeout(300);
  const compartilhado = await p.evaluate(() => window.__compartilhado?.url ?? '');
  if (/\?convite=/.test(compartilhado)) ok('o botão da capa abre a folha de compartilhar com o convite: ' + compartilhado);
  else falhou('o botão da capa não compartilhou o convite (' + compartilhado + ')');
  await foto('capa-com-convite');

  // 2. "Início" abre o salão.
  await p.locator('.inicio-link').tap();
  await p.waitForTimeout(1500);
  if (await p.locator('.sidebar').isVisible()) falhou('tocar em Início deixou a lista de canais na tela');
  else ok('tocar em Início abre o salão');
  await foto('inicio-salao');
  await p.getByRole('button', { name: 'Ir para os canais' }).tap();

  // 3. A gaveta das pessoas, num canal de texto.
  await p.waitForTimeout(800);
  if (await p.locator('.sidebar').isVisible()) await p.locator('.channel-name', { hasText: /^geral$/ }).first().tap();
  await p.locator('.pessoas-so-no-celular').tap();
  const gaveta = p.locator('.members.aberta-no-celular');
  await gaveta.waitFor({ timeout: 5000 });
  const caixa = await gaveta.boundingBox();
  if (caixa && caixa.x + caixa.width <= 391 && caixa.width > 200) ok('a lista de pessoas abre como gaveta');
  else falhou('a gaveta não coube: ' + JSON.stringify(caixa));
  await foto('gaveta-de-pessoas');
  const eu = gaveta.locator('.member').first();
  await eu.tap();
  await p.waitForTimeout(500);
  if (await p.locator('.perfil-cartao').first().isVisible().catch(() => false)) ok('tocar num membro abre o perfil');
  else falhou('tocar num membro não abriu o perfil');
  await p.waitForTimeout(800);
  // O cartão abre de dentro da gaveta, mas é desenhado fora dela: precisa ficar POR CIMA (era o defeito da primeira versão).
  const porCima = await p.evaluate(() => {
    const r = document.querySelector('.perfil-cartao').getBoundingClientRect();
    return !!document.elementFromPoint(r.x + r.width / 2, r.y + 40)?.closest('.perfil-cartao');
  });
  if (porCima) ok('o cartão de perfil fica por cima da gaveta');
  else falhou('o cartão de perfil abriu atrás da gaveta');
  await foto('perfil-na-gaveta');
  await p.keyboard.press('Escape');
  await p.mouse.click(5, 5).catch(() => {});
  await p.waitForTimeout(300);

  // 4. Segurar o dedo num membro: o menu da pessoa, e não o perfil.
  if (!(await gaveta.isVisible().catch(() => false))) await p.locator('.pessoas-so-no-celular').tap();
  await segurar(p.locator('.members.aberta-no-celular .member').first());
  const menuAberto = await p.locator('.person-menu').first().isVisible().catch(() => false);
  const perfilAberto = await p.locator('.perfil-cartao').first().isVisible().catch(() => false);
  if (menuAberto && !perfilAberto) ok('segurar num membro abre o menu da pessoa, sem o perfil junto');
  else falhou(`segurar num membro: menu ${menuAberto}, perfil ${perfilAberto}`);
  await foto('segurar-membro');
  await p.locator('.fundo-das-pessoas').tap({ position: { x: 20, y: 400 } }).catch(() => {});
  await p.waitForTimeout(300);
  if (await gaveta.isVisible().catch(() => false)) {
    await p.locator('.fundo-das-pessoas').tap({ position: { x: 20, y: 400 } }).catch(() => {});
    await p.waitForTimeout(300);
  }
  if (await gaveta.isVisible().catch(() => false)) falhou('tocar fora não fechou a gaveta');
  else ok('tocar fora fecha a gaveta');

  // 5. Segurar o dedo no ícone da comunidade: o menu com o link.
  await segurar(p.locator('.rail-item[aria-label^="Turma"]'));
  if (await p.getByRole('menu').getByText('Copiar link de convite').isVisible().catch(() => false)) ok('segurar no ícone da comunidade abre o menu do convite');
  else falhou('segurar no ícone da comunidade não abriu o menu');
  await foto('segurar-comunidade');
} catch (e) {
  falhou(e.message);
  await foto('erro').catch(() => {});
} finally {
  await browser.close();
  resumo('celular');
}
