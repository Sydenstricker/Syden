// O rebrand de 05/10/2026: do coelho na estrela para o D4 (orelhas, balão e três pontos).
//
// Confere, no app de verdade:
//   1. o botão de início da barra lateral é o D4 desenhado, e não mais uma imagem trocável;
//   2. a vila não tem mais estrela nem bandeira;
//   3. quem não tem foto aparece como o coelho (o mascote), na pose do status: a pessoa muda para
//      "ausente" e quem olha a lista de membros a vê dormindo.
//
//   node e2e/rebrand.mjs        (site em http://localhost:5174, API de teste na 3099)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, novaAba, ok, resumo } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const ana = await novaAba(contexto);
await cadastrar(ana, 'ana' + s);
await dispensarPresentes(ana);

// ---------- 1. o ícone ----------
const logo = ana.locator('.rail-logo svg');
(await logo.count()) === 1 && (await ana.locator('.rail-logo img').count()) === 0
  ? ok('o botão de início é o D4 desenhado')
  : falhou('o botão de início não é o D4');
(await logo.locator('circle').count()) === 3 ? ok('com os três pontos do balão') : falhou('o desenho do logo não é o do D4');

// ---------- 2. a home ----------
// A vila tinha estrela e bandeira do logo antigo, e este trecho conferia que tinham saído. Desde 08/10/2026 a home é
// o quarto do coelho (Quarto.tsx), uma pintura sem logo nenhum: basta ela aparecer.
await ana.locator('.quarto').waitFor({ timeout: 25000 });
ok('a home é o quarto, sem o logo antigo');
await ana.screenshot({ path: 'e2e/fotos/rebrand-home.png' });

// ---------- 3. o avatar com orelhas ----------
const bia = await novaAba(await browser.newContext({ viewport: { width: 1500, height: 950 } }));
await cadastrar(bia, 'bia' + s);
await dispensarPresentes(bia);

const minha = bia.locator('.user-panel .avatar-coelho');
(await minha.getAttribute('data-status')) === 'online'
  ? ok('sem foto, o avatar é o coelho, de orelhas em pé (online)')
  : falhou('o avatar próprio não é o coelho online: ' + (await minha.getAttribute('data-status')));
(await minha.evaluate(async (img) => {
  if (!img.complete) await new Promise((ok) => img.addEventListener('load', ok, { once: true }));
  return img.naturalWidth > 0;
}))
  ? ok('e a imagem do coelho carregou de verdade')
  : falhou('a imagem do avatar não carregou');
(await bia.locator('.user-panel .avatar-status').count()) === 0
  ? ok('e sem a bolinha de status: as orelhas já dizem')
  : falhou('a bolinha de status continua por cima do coelho');

await bia.locator('.user-panel .avatar').click({ button: 'right' });
await bia.getByRole('menuitemradio', { name: /Ausente/ }).click();
await bia.waitForTimeout(800);
(await minha.getAttribute('data-status')) === 'ausente' ? ok('mudando para ausente, ele dorme (orelha caída e os "z")') : falhou('o próprio avatar não mudou');

// Quem olha de fora vê o mesmo: a lista de membros da comunidade em comum.
await ana.locator('.rail-list button').first().click();
const linhaDaBia = ana.locator('.member', { hasText: 'bia' + s });
await linhaDaBia.waitFor({ timeout: 15000 });
await ana.waitForFunction(
  (nome) => [...document.querySelectorAll('.member')].find((m) => m.textContent.includes(nome))?.querySelector('.avatar-coelho')?.dataset.status === 'ausente',
  'bia' + s,
  { timeout: 10000 },
).then(
  () => ok('e quem olha a lista de membros vê a orelha da Bia caída'),
  () => falhou('na lista de membros o status da Bia não chegou às orelhas'),
);
// A Bia fecha o Syden: na lista da Ana ela desce para "Offline", e o coelho dela descansa.
await bia.close();
await ana
  .waitForFunction(
    (nome) => [...document.querySelectorAll('.member.offline')].find((m) => m.textContent.includes(nome))?.querySelector('.avatar-coelho')?.dataset.status === 'offline',
    'bia' + s,
    { timeout: 20000 },
  )
  .then(
    () => ok('quando a Bia sai, o coelho dela descansa: orelhas caídas e cinza'),
    () => falhou('no grupo Offline o coelho da Bia não recolheu as orelhas'),
  );
await ana.locator('.members').screenshot({ path: 'e2e/fotos/rebrand-membros.png' });

await browser.close();
resumo('O rebrand');
