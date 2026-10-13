// A PLACA NA LISTA DE PESSOAS (13/10/2026, pedido do Sydenstricker, como as do Discord): o fundo que cada um escolheu
// para o cartão de perfil aparece atrás da linha dela, na lista da direita. Quem não escolheu fundo fica liso, e quem
// está offline também.
//
//   node e2e/placa-na-lista.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const API = 'http://localhost:3099';

const { browser } = await abrirNavegador();
const pessoa = async () => vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage());
const comToken = (page, rota, metodo = 'GET', corpo) =>
  page.evaluate(
    async ({ API, rota, metodo, corpo }) => {
      const r = await fetch(API + rota, {
        method: metodo,
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return r.json();
    },
    { API, rota, metodo, corpo },
  );

try {
  const ana = await pessoa();
  await cadastrar(ana, 'ana' + s);
  await dispensarPresentes(ana);
  await ana.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await ana.locator('.community-choice-option').first().click();
  await ana.locator('form.dialog input').first().fill('Placas ' + s);
  await ana.locator('form.dialog .btn-primary').click();
  await ana.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = (await comToken(ana, '/api/communities')).find((c) => c.name.startsWith('Placas'))?.inviteCode;

  // Cada um com um fundo (os livres), e o Caio sem nenhum.
  const fundos = { ana: 'aurora', bia: 'brasa', caio: null, davi: 'estrelas' };
  await comToken(ana, '/api/me/profile', 'PUT', { banner: fundos.ana });
  const outros = [];
  for (const nome of ['bia', 'caio', 'davi']) {
    const p = await pessoa();
    await cadastrar(p, nome + s);
    await dispensarPresentes(p);
    await comToken(p, '/api/communities/join', 'POST', { code: convite });
    if (fundos[nome]) await comToken(p, '/api/me/profile', 'PUT', { banner: fundos[nome] });
    await p.reload();
    outros.push(p);
  }

  await ana.reload();
  await dispensarPresentes(ana);
  await ana.locator('.rail-item', { hasText: /^P/ }).first().click();
  await ana.locator('.members .member', { hasText: 'davi' + s }).waitFor({ timeout: 15000 });
  await ana.waitForTimeout(800);
  const placas = await ana.locator('.members .member.com-placa').count();
  placas === 3 ? ok('três pessoas com fundo, três placas na lista') : falhou(`placas na lista: ${placas}`);
  (await ana.locator('.members .member', { hasText: 'caio' + s }).locator('.member-placa').count()) === 0
    ? ok('quem não escolheu fundo fica liso')
    : falhou('o Caio, sem fundo, ganhou placa');
  await ana.locator('.members').screenshot({ path: path.join(FOTOS, 'placa-na-lista.png') });
} finally {
  await browser.close();
}
resumo('Placa na lista');
