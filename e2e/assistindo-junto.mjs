// Assistindo junto, percebido pelo Syden: a Ana compartilha a tela, a Bia está na sala com ela — e a
// sala, na lista de canais, troca o alto-falante pelo mascote com a pipoca. Ninguém ligou modo nenhum.
// Quando a Ana para de transmitir, volta o alto-falante.
//
// A tela compartilhada é um canvas no lugar do getDisplayMedia (o mesmo truque do sob-demanda.mjs):
// o Chrome sem janela não tem tela para oferecer.
//
//   SITE=http://localhost:5174/app/ node e2e/assistindo-junto.mjs   (API de teste na 3099 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${(n += 7) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 640, 360);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

const ana = await entrar('ana' + s);
const bia = await entrar('bia' + s);
ok('as duas entraram na Sala 1');

const pipocaNaSala = (page) => page.locator('.canal-assistindo img.mascote[src$="/mascote/assistir-junto.svg"]');
(await pipocaNaSala(bia).count()) === 0 ? ok('antes da transmissão, a sala tem o alto-falante') : falhou('a pipoca apareceu sem ninguém transmitir');

await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
await ana.locator('.screenshare-option').first().click();
await pipocaNaSala(bia)
  .first()
  .waitFor({ timeout: 20000 })
  .then(
    () => ok('a Ana transmite e a Bia está junto: a sala vira "assistindo junto", com a pipoca'),
    () => falhou('a sala não marcou que estão assistindo junto'),
  );
const rotulo = await bia.locator('.canal-assistindo .so-para-leitor').first().textContent();
rotulo === 'Assistindo junto' ? ok('e quem usa leitor de tela ouve "Assistindo junto"') : falhou('rótulo para leitor de tela: ' + rotulo);
await bia.locator('.sidebar').screenshot({ path: 'e2e/fotos/assistindo-junto.png' });

// Parar fica dentro das opções da transmissão: o botão de compartilhar vira 'Opções da transmissão'.
await ana.locator('.stage-controls button[aria-label="Opções da transmissão"]').click();
await ana.getByRole('menuitem', { name: /Parar de compartilhar/ }).click();
await bia
  .waitForFunction(() => !document.querySelector('.canal-assistindo'), null, { timeout: 20000 })
  .then(
    () => ok('a transmissão acabou e a sala voltou ao alto-falante'),
    () => falhou('a pipoca ficou depois de a transmissão acabar'),
  );

await browser.close();
resumo('Assistindo junto');
