// O link de uma sala: "Copiar link" ao lado do canal dá o convite da comunidade com o canal junto.
// Quem não participa cria a conta pelo link e cai na sala; quem participa só cai nela. Numa sala de
// voz, cair nela NÃO é entrar na chamada: o microfone só liga quando a pessoa entra.
//
//   SITE=http://localhost:5174/app/ node e2e/link-da-sala.mjs   (API de teste na 3099 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const permissions = ['microphone', 'clipboard-read', 'clipboard-write'];

const ctxAna = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions });
const ana = vigiar(await ctxAna.newPage());
await cadastrar(ana, 'ana' + s);
await dispensarPresentes(ana);
await ana.locator('.rail-list .rail-item').first().click();
await ana.locator('.channel-name', { hasText: /^Sala 2$/ }).first().waitFor({ timeout: 20000 });

async function copiar(nome) {
  const linha = ana.locator('.channel-row', { has: ana.locator('.channel-name', { hasText: new RegExp(`^${nome}$`) }) }).first();
  await linha.hover();
  await linha.getByRole('button', { name: `Copiar link: ${nome}` }).click();
  return ana.evaluate(() => navigator.clipboard.readText());
}

const linkDaSala = await copiar('Sala 2');
/\?convite=[^&]+&canal=\d+$/.test(linkDaSala) ? ok(`o link da sala é o convite com o canal: ${linkDaSala}`) : falhou('link: ' + linkDaSala);

// ---------- quem não participa: cria a conta pelo link e cai na sala ----------
const ctxBia = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
const bia = vigiar(await ctxBia.newPage());
await bia.goto(linkDaSala);
await bia.getByLabel('Nome de usuário').fill('bia' + s);
await bia.getByLabel('E-mail').fill(`bia${s}@exemplo.test`);
await bia.getByLabel('Senha', { exact: true }).fill('segredo123');
await bia.getByRole('button', { name: 'Cadastrar' }).click();
await dispensarPresentes(bia);
await bia
  .locator('.channel.active .channel-name', { hasText: /^Sala 2$/ })
  .waitFor({ timeout: 30000 })
  .then(
    () => ok('a Bia criou a conta pelo link e caiu na Sala 2'),
    async () => falhou('a Bia não caiu na sala; ativo: ' + ((await bia.locator('.channel.active').allTextContents()).join(', ') || 'nenhum')),
  );
await bia.waitForTimeout(2500);
(await bia.locator('.stage-controls').count()) === 0
  ? ok('e está na sala sem ter entrado na chamada: o microfone não ligou sozinho')
  : falhou('o link pôs a Bia na chamada sem ela pedir');
await bia.screenshot({ path: 'e2e/fotos/link-da-sala.png' });

// ---------- quem já participa: só cai no canal ----------
const linkDoCanal = await copiar('jogos');
const outra = vigiar(await ctxAna.newPage());
await outra.goto(linkDoCanal);
await outra
  .locator('.channel.active .channel-name', { hasText: /^jogos$/ })
  .waitFor({ timeout: 30000 })
  .then(
    () => ok('a Ana, que já participava, abriu o link do #jogos e caiu nele'),
    () => falhou('o link do canal de texto não levou ao canal'),
  );
(await outra.getByText(/Você entrou em/).count()) === 0 ? ok('sem aviso de "você entrou" para quem já participava') : falhou('avisou entrada para quem já participava');

await browser.close();
resumo('Link da sala');
