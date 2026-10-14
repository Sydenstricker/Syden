// O APELIDO NA COMUNIDADE (13/10/2026, "ficou faltando essa customização de nick no servidor"): o "Alterar
// apelido" do menu da pessoa troca o nome que aparece SÓ naquela comunidade — na lista de membros, nas mensagens
// e no cartão (com o nome da conta embaixo). Vazio volta ao nome da conta.
//
// Fotos em FOTOS (padrão: e2e/fotos/apelido-*.png).
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const APELIDO = 'Capitão Fernando';

const { browser } = await abrirNavegador();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
try {
  const nome = await criarConta(page, 'apelido');
  await dispensarPresentes(page);
  await page.locator('.channel-name', { hasText: 'geral' }).first().click();
  const naLista = page.locator('.members .member', { hasText: nome }).first();
  await naLista.waitFor({ timeout: 15_000 });

  await naLista.click({ button: 'right' });
  const menu = page.locator('.person-menu');
  await menu.getByRole('menuitem', { name: 'Alterar apelido' }).click();
  const campo = menu.getByRole('textbox', { name: 'Apelido nesta comunidade' });
  await campo.fill(APELIDO);
  await page.screenshot({ path: path.join(FOTOS, 'apelido-menu.png'), clip: (await menu.boundingBox()) ?? undefined });
  await campo.press('Enter');

  await page
    .locator('.members .member', { hasText: APELIDO })
    .first()
    .waitFor({ timeout: 8000 })
    .then(
      () => ok('a lista de membros mostra o apelido'),
      () => falhou('o apelido não apareceu na lista de membros'),
    );

  await page.locator('.composer textarea, textarea').first().fill('oi com apelido');
  await page.keyboard.press('Enter');
  await page
    .locator('.message-author', { hasText: APELIDO })
    .first()
    .waitFor({ timeout: 8000 })
    .then(
      () => ok('a mensagem sai com o apelido'),
      () => falhou('a mensagem não mostra o apelido'),
    );

  await page.locator('.members .member', { hasText: APELIDO }).first().click();
  const cartao = page.locator('.perfil-cartao');
  await cartao.waitFor({ timeout: 5000 });
  (await cartao.locator('.perfil-nome').innerText()).includes(APELIDO) ? ok('o cartão mostra o apelido grande') : falhou('o cartão não mostra o apelido');
  (await cartao.locator('.perfil-conta').innerText()).trim() === nome ? ok('e o nome da conta embaixo') : falhou('o nome da conta não aparece embaixo');
  await page.screenshot({ path: path.join(FOTOS, 'apelido-cartao.png'), clip: (await cartao.boundingBox()) ?? undefined });
  await page.keyboard.press('Escape');

  // Vazio volta ao nome da conta.
  await page.locator('.members .member', { hasText: APELIDO }).first().click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Alterar apelido' }).click();
  await menu.getByRole('textbox', { name: 'Apelido nesta comunidade' }).fill('');
  await menu.getByRole('textbox', { name: 'Apelido nesta comunidade' }).press('Enter');
  await page
    .waitForFunction((a) => ![...document.querySelectorAll('.members .member')].some((m) => m.textContent?.includes(a)), APELIDO, { timeout: 8000 })
    .then(
      () => ok('apelido vazio volta ao nome da conta'),
      () => falhou('apagar o apelido não voltou ao nome da conta'),
    );
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('apelido na comunidade');
}
