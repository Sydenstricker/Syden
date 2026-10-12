// Cargos automáticos (pacote MEE6, 12/10/2026): a dona marca o cargo de quem entra e publica um painel de cargo por
// reação pelas configurações; a Bia entra já com o cargo de entrada, clica no 🎮 do painel e ganha o outro.
//
//   SITE=http://localhost:5174/app/ node e2e/cargos-automaticos.mjs   (API de teste na 3099)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const API = 'http://localhost:3099';

async function entrar(nome) {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage());
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  return page;
}
const chamar = (page, metodo, rota, corpo) =>
  page.evaluate(
    async ({ API, metodo, rota, corpo }) => {
      const r = await fetch(API + rota, {
        method: metodo,
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), ...(corpo && { 'content-type': 'application/json' }) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return r.json();
    },
    { API, metodo, rota, corpo },
  );

try {
  const dona = await entrar('dona' + s);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Clã ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const comunidade = (await chamar(dona, 'GET', '/api/communities')).find((c) => c.name.startsWith('Clã'));
  const artista = await chamar(dona, 'POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Artista', cor: '#e5484d' });
  const jogador = await chamar(dona, 'POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Jogador', cor: '#4f7df5' });

  await dona.locator('button[aria-label="Configurações"]').first().click();
  await dona.locator('.settings-tab', { hasText: /Cargos automáticos/ }).first().click();
  await dona.locator('.cargo-separado', { hasText: 'Artista' }).locator('input').check();
  await dona.getByLabel('Texto do painel').fill('Escolha os seus cargos!');
  await dona.getByLabel('Emoji 1').fill('🎮');
  await dona.getByLabel('Cargo 1').selectOption(String(jogador.id));
  await dona.getByRole('button', { name: 'Publicar o painel' }).click();
  await dona.locator('.tickets-lista li', { hasText: '🎮 Jogador' }).waitFor({ timeout: 5000 });
  ok('a dona marcou o cargo de entrada e publicou o painel');
  await dona.locator('.settings-content').first().screenshot({ path: path.join(FOTOS, 'cargos-automaticos.png') });

  const bia = await entrar('bia' + s);
  await chamar(bia, 'POST', '/api/communities/join', { code: comunidade.inviteCode });
  await bia.reload();
  await dispensarPresentes(bia);
  await bia.locator('.rail-item', { hasText: /^C\d$/ }).first().click();
  await bia.locator('.channel-name', { hasText: /^geral$/ }).first().click();
  const membros = async () => (await chamar(bia, 'GET', `/api/communities/${comunidade.id}/members`)).find((m) => m.username === 'bia' + s).cargos;
  ((await membros()).includes(artista.id) ? ok : falhou)('a Bia entrou e já chegou com o cargo Artista');

  const painel = bia.locator('.message', { hasText: 'Escolha os seus cargos!' }).first();
  await painel.waitFor({ timeout: 10000 });
  await painel.locator('.reaction-pill', { hasText: '🎮' }).first().click();
  await bia.waitForTimeout(800);
  ((await membros()).includes(jogador.id) ? ok : falhou)('a Bia clicou no 🎮 do painel e ganhou o cargo Jogador');
  await painel.screenshot({ path: path.join(FOTOS, 'painel-de-cargo.png') });
} catch (e) {
  falhou(String(e).slice(0, 300));
} finally {
  await browser.close();
}
resumo('Cargos automáticos');
