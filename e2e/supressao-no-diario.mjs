// A FALHA DA SUPRESSÃO DE RUÍDO CHEGA AO DIÁRIO DA ABA DE SAÚDE (oferecido em 06/10/2026, feito em 12/10/2026).
//
// O problema que isto tranca: a supressão de ruído roda no computador de cada um, e quando ela cai o Syden segue
// com a voz sem supressão e um aviso só para aquela pessoa. Quem cuida do Syden só fica sabendo pelo diário
// ("app:supressão de ruído" → "Problema de supressão de ruído", na aba Saúde do servidor). Este teste derruba o
// modelo de verdade — o arquivo do GTCRN responde 404 — e confere a linha inteira chegando lá, com quem foi e onde.
//
//   node e2e/supressao-no-diario.mjs   (API de teste na 3099 com BANCO NOVO — a primeira conta administra o Syden —,
//   site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();

try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  // O modelo do GTCRN some: a supressão não tem como montar.
  await ctx.route('**/ruido/gtcrn.bin', (rota) => rota.fulfill({ status: 404, body: 'sumiu' }));
  const page = vigiar(await ctx.newPage());
  const nome = 'adm' + s;
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  const ehAdmin = await page.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/me', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).isAdmin;
  });
  if (!ehAdmin) throw new Error('a conta não administra o Syden: rode com um banco novo (a primeira conta vira administradora)');

  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  ok('entrou na chamada com o modelo de supressão fora do ar');

  await page.locator('.usage-link').click();
  await page.getByRole('tab', { name: 'Saúde do servidor' }).click();
  const linha = page.locator('.event-row', { hasText: 'Problema de supressão de ruído' }).first();
  await linha.waitFor({ timeout: 15000 });
  const texto = await linha.innerText();
  ok(`o diário mostra: "${texto.replace(/\s+/g, ' ').slice(0, 140)}"`);
  texto.includes(nome) ? ok('com o nome de quem teve o problema') : falhou('a linha não diz quem teve o problema');
  /gtcrn\.bin: 404/.test(texto) ? ok('e o motivo de verdade (gtcrn.bin: 404)') : falhou('a linha não traz o motivo');
  await linha.screenshot({ path: path.join(FOTOS, 'supressao-no-diario.png') });
} catch (e) {
  falhou(String(e).slice(0, 300));
} finally {
  await browser.close();
}
resumo('A falha da supressão de ruído no diário');
