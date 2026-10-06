// "Fulano está digitando", de ponta a ponta: a Bia escreve no #geral e a Ana, olhando o mesmo canal,
// vê a linha com o nome dela e o coelho virando o balão de três pontos. A Bia manda a mensagem, e a
// linha some na hora — o "digitando" virou a mensagem.
//
//   SITE=http://localhost:5174/app/ node e2e/digitando.mjs   (API de teste na 3099)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, novaAba, ok, resumo, tituloDoCanal } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const ana = await novaAba(contexto);
await cadastrar(ana, 'ana' + s);
await dispensarPresentes(ana);
const bia = await novaAba(await browser.newContext({ viewport: { width: 1500, height: 950 } }));
const nomeDaBia = 'bia' + s;
await cadastrar(bia, nomeDaBia);
await dispensarPresentes(bia);

for (const page of [ana, bia]) {
  await page.locator('.rail-list button').first().click();
  await page.getByText('geral', { exact: true }).first().click();
  await page.getByRole('heading', { name: tituloDoCanal('geral') }).waitFor({ timeout: 15000 }).catch(() => {});
}

const caixa = bia.locator('.composer textarea').first();
await caixa.click();
await caixa.pressSequentially('Oi, Ana! Tudo bem', { delay: 60 });

const linha = ana.locator('.quem-digita');
await linha
  .filter({ hasText: nomeDaBia })
  .waitFor({ timeout: 10000 })
  .then(
    () => ok('a Ana vê "' + nomeDaBia + ' está digitando…"'),
    () => falhou('a linha de quem digita não apareceu para a Ana'),
  );
(await linha.locator('.avatar-coelho[data-status="digitando"]').count()) === 1
  ? ok('com o coelho da Bia virando o balão de três pontos')
  : falhou('o avatar da Bia na linha não está no balão de pontos');
await ana.locator('.text-channel, .chat').first().screenshot({ path: 'e2e/fotos/digitando.png' }).catch(() => ana.screenshot({ path: 'e2e/fotos/digitando.png' }));

(await bia.locator('.quem-digita').filter({ hasText: nomeDaBia }).count()) === 0
  ? ok('a própria Bia não vê o aviso de si mesma')
  : falhou('a Bia está vendo o aviso de que ela mesma digita');

await caixa.press('Enter');
await ana
  .waitForFunction(() => !document.querySelector('.quem-digita')?.textContent?.trim(), null, { timeout: 5000 })
  .then(
    () => ok('a Bia mandou a mensagem e a linha sumiu na hora'),
    () => falhou('a linha continuou depois de a mensagem chegar'),
  );

await browser.close();
resumo('Fulano está digitando');
