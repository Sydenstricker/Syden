// O CELULAR, O CONVITE E A QUEDA (09/11/2026, relatos da turma):
// - Numa tela de celular, a lista de canais cabe ao lado da coluna de comunidades (antes passava da borda).
// - O link de convite PERGUNTA antes de entrar, e a comunidade aparece na lista na hora.
// - A tela do servidor fora do ar: com a API inalcançável (simulada pelo navegador), aparece o 503.
//
//   node e2e/celular-e-convite.mjs   (API de teste na 3099, site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const SITE = process.env.SITE ?? 'http://localhost:5174';

const { browser } = await abrirNavegador();
const pessoa = async (viewport) => vigiar(await (await browser.newContext({ viewport, hasTouch: viewport.width < 500 })).newPage());
try {
  const dona = await pessoa({ width: 1400, height: 900 });
  await cadastrar(dona, 'dona' + s);
  await dispensarPresentes(dona);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Turma ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await dona.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Turma'))?.inviteCode;
  });

  // Quem recebe o link, num celular.
  const amigo = await pessoa({ width: 390, height: 844 });
  await cadastrar(amigo, 'amigo' + s);
  await dispensarPresentes(amigo);
  await amigo.goto(`${SITE}/app/?convite=${convite}`);
  const dialogo = amigo.locator('.convite-comunidade, [role="dialog"]', { hasText: 'Turma ' + s }).first();
  await dialogo.waitFor({ timeout: 20000 });
  await amigo.screenshot({ path: path.join(FOTOS, 'celular-convite.png') });
  ok('o convite pergunta antes de entrar');
  await amigo.getByRole('button', { name: 'Entrar na comunidade' }).click();
  await amigo.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  ok('entrou e a comunidade apareceu');

  // A lista de canais cabe na tela: nada passa da borda direita.
  const lista = amigo.locator('.sidebar').first();
  if ((await lista.count()) && (await lista.isVisible())) {
    const caixa = await lista.boundingBox();
    const largura = amigo.viewportSize().width;
    if (caixa && caixa.x + caixa.width <= largura + 1) ok(`a lista de canais cabe (${Math.round(caixa.x + caixa.width)} de ${largura} px)`);
    else falhou(`a lista de canais passa da borda: ${caixa && Math.round(caixa.x + caixa.width)} de ${largura} px`);
  }
  const rolagem = await amigo.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (rolagem <= 1) ok('sem rolagem horizontal no celular');
  else falhou(`rolagem horizontal de ${rolagem} px`);
  await amigo.screenshot({ path: path.join(FOTOS, 'celular-canais.png') });

  // A queda: a API some (o navegador recusa os pedidos a ela) e o site continua respondendo.
  await amigo.route('http://localhost:3099/**', (rota) => rota.abort('connectionrefused'));
  await amigo.evaluate(() => window.dispatchEvent(new Event('syden:api-falhou')));
  await amigo.locator('.servidor-fora-do-ar').waitFor({ timeout: 20000 });
  const texto = await amigo.locator('.servidor-fora-do-ar').innerText();
  if (texto.includes('503')) ok('a tela da queda diz 503 (o site responde, a API não)');
  else falhou('a tela da queda não diz 503: ' + texto.slice(0, 80));
  await amigo.screenshot({ path: path.join(FOTOS, 'celular-queda.png') });
  await amigo.unroute('http://localhost:3099/**');
  await amigo.getByRole('button', { name: 'Tentar de novo' }).click();
  await amigo.locator('.servidor-fora-do-ar').waitFor({ state: 'detached', timeout: 20000 });
  ok('o servidor voltou e a tela sumiu');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo();
}
