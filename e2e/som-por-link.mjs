// Som por link: colar o endereço de um som (do MyInstants) em "Adicionar som", ouvir e enviar.
//
// "Adicionar som e o servidor baixa o arquivo." — o que este teste mede, e que só se vê numa tela de
// verdade: que o link colado vira o MESMO envio de quem escolhe um arquivo (nome sugerido, prévia
// tocável, e o som aparecendo na lista), e que o link ruim fala o que houve em vez de não fazer nada.
//
// PRECISA DE INTERNET: o servidor de teste vai mesmo ao MyInstants buscar o arquivo.
//
//   node e2e/som-por-link.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ viewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
vigiar(page);

await criarConta(page, 'somlink');
await dispensarPresentes(page);

// A comunidade própria, pela mesma razão da capa: o teste não pode depender de quem é dono do banco.
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Som ' + Date.now().toString().slice(-5));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-list').waitFor({ timeout: 20000 });
await page.waitForTimeout(1200);

await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab').first().waitFor({ timeout: 10000 });
await page.locator('.settings-tab', { hasText: /Soundboard/ }).first().click();
await page.getByRole('button', { name: 'Adicionar som' }).click();

const campo = page.getByLabel('Link do som');
(await campo.count()) === 1 ? ok('o campo de colar link aparece no formulário de som') : falhou('não achei o campo de link');

// ---------- o link ruim fala ----------
await campo.fill('https://www.myinstants.com/pt/instant/syden-isto-nao-existe-de-jeito-nenhum-1/');
await page.getByRole('button', { name: 'Buscar', exact: true }).click();
const erro = page.locator('.som-por-endereco .form-error');
await erro.waitFor({ timeout: 20000 }).catch(() => {});
const textoDoErro = (await erro.textContent().catch(() => '')) ?? '';
/copie o link do botão de baixar/.test(textoDoErro)
  ? ok(`a página que não existe explica o que fazer: "${textoDoErro}"`)
  : falhou(`o link ruim não deu a instrução certa: "${textoDoErro}"`);

// ---------- a página de verdade ----------
await campo.fill('https://www.myinstants.com/pt/instant/acabou-49530/');
await page.getByRole('button', { name: 'Buscar', exact: true }).click();
const previa = page.locator('.som-por-endereco-previa audio');
await previa.waitFor({ timeout: 20000 }).catch(() => {});
(await previa.count()) === 1 ? ok('veio a prévia para ouvir antes de enviar') : falhou('a prévia não apareceu');

const duracao = await previa.evaluate((a) => new Promise((r) => (a.readyState >= 1 ? r(a.duration) : (a.onloadedmetadata = () => r(a.duration))))).catch(() => 0);
duracao > 0 ? ok(`e ela toca: ${duracao.toFixed(1)} s de áudio`) : falhou('a prévia não carregou o áudio');

const nome = await page.getByPlaceholder('ex.: Risada').inputValue();
nome === 'acabou' ? ok('o nome veio sugerido do link: "acabou"') : falhou(`nome sugerido inesperado: "${nome}"`);
await page.screenshot({ path: 'e2e/fotos/som-por-link-previa.png' });

await page.getByRole('button', { name: 'Enviar som' }).click();
await page.locator('.form-success').waitFor({ timeout: 15000 }).catch(() => {});
const naLista = await page.locator('.expression-name', { hasText: 'acabou' }).count();
naLista > 0 ? ok('o som entrou na lista da comunidade') : falhou('o som não apareceu na lista depois de enviar');

const autor = await page.locator('.expression-row', { hasText: 'acabou' }).locator('.expression-author').textContent().catch(() => '');
console.log('  autor na lista:', JSON.stringify(autor));
await page.screenshot({ path: 'e2e/fotos/som-por-link-enviado.png' });

await browser.close();
resumo('som por link');
