// O rebrand de 05/10/2026: do coelho na estrela para o D4 (orelhas, balão e três pontos).
//
// Confere, no app de verdade:
//   1. o botão de início da barra lateral é o D4 desenhado, e não mais uma imagem trocável;
//   2. a vila não tem mais estrela nem bandeira;
//   3. quem não tem foto aparece como o coelho, e as orelhas acompanham o status: a pessoa muda para
//      "ausente" e quem olha a lista de membros vê a orelha dela cair.
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

// ---------- 2. a vila ----------
await ana.locator('.vila').waitFor({ timeout: 25000 });
const sobras = await ana.locator('.vila .v-estrela, .vila .v-bandeira, .vila .v-pano').count();
sobras === 0 ? ok('a vila não tem estrela nem bandeira') : falhou(`ainda há ${sobras} estrela(s) ou bandeira(s) na vila`);
await ana.screenshot({ path: 'e2e/fotos/rebrand-vila.png' });

// ---------- 3. o avatar com orelhas ----------
const bia = await novaAba(await browser.newContext({ viewport: { width: 1500, height: 950 } }));
await cadastrar(bia, 'bia' + s);
await dispensarPresentes(bia);

const minha = bia.locator('.user-panel .avatar-coelho');
(await minha.getAttribute('data-status')) === 'online'
  ? ok('sem foto, o avatar é o coelho, de orelhas em pé (online)')
  : falhou('o avatar próprio não é o coelho online: ' + (await minha.getAttribute('data-status')));
(await bia.locator('.user-panel .avatar-status').count()) === 0
  ? ok('e sem a bolinha de status: as orelhas já dizem')
  : falhou('a bolinha de status continua por cima do coelho');

await bia.locator('.user-panel .avatar').click({ button: 'right' });
await bia.getByRole('menuitemradio', { name: /Ausente/ }).click();
await bia.waitForTimeout(800);
(await minha.getAttribute('data-status')) === 'away' ? ok('mudando para ausente, a orelha cai') : falhou('o próprio avatar não mudou');

// Quem olha de fora vê o mesmo: a lista de membros da comunidade em comum.
await ana.locator('.rail-list button').first().click();
const linhaDaBia = ana.locator('.member', { hasText: 'bia' + s });
await linhaDaBia.waitFor({ timeout: 15000 });
await ana.waitForFunction(
  (nome) => [...document.querySelectorAll('.member')].find((m) => m.textContent.includes(nome))?.querySelector('.avatar-coelho')?.dataset.status === 'away',
  'bia' + s,
  { timeout: 10000 },
).then(
  () => ok('e quem olha a lista de membros vê a orelha da Bia caída'),
  () => falhou('na lista de membros o status da Bia não chegou às orelhas'),
);
// A Bia fecha o Syden: na lista da Ana ela desce para "Offline", e o coelho recolhe as orelhas.
await bia.close();
await ana
  .waitForFunction(
    (nome) => [...document.querySelectorAll('.member.offline')].find((m) => m.textContent.includes(nome))?.querySelector('.avatar-coelho')?.dataset.status === 'offline',
    'bia' + s,
    { timeout: 20000 },
  )
  .then(
    () => ok('quando a Bia sai, o coelho dela recolhe as orelhas e fica cinza'),
    () => falhou('no grupo Offline o coelho da Bia não recolheu as orelhas'),
  );
await ana.locator('.members').screenshot({ path: 'e2e/fotos/rebrand-membros.png' });

await browser.close();
resumo('O rebrand');
