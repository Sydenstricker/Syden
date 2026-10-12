// "PARECE O MESMO SOM QUE «…»" (11/10/2026). O servidor já recusa o mesmo ARQUIVO; este teste prova o aviso para
// o mesmo SOM em outro arquivo — o caso de "Me ajuda (de novo)". Dois WAV gerados aqui com o mesmo ritmo, um
// deles "recodificado" (outra taxa, outro volume, silêncio no começo): o primeiro sobe, o segundo é escolhido
// no formulário, e o aviso tem de aparecer com o nome do primeiro. Um som diferente não pode ter aviso.
//
//   node e2e/som-parecido.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar, wavDeTeste as wav } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const s = Date.now().toString().slice(-5);

const GRITO = [0.2, 0.9, 1, 0.6, 0.1, 0.8, 0.3, 0.05, 0.7, 0.4, 0.9, 0.2];
const OUTRO = [1, 0.1, 0.1, 0.9, 0.2, 0.2, 1, 0.1, 0.5, 0.9, 0.1, 0.6];
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'som-parecido-'));
const recodificado = path.join(pasta, 'me-ajuda-de-novo.wav');
const diferente = path.join(pasta, 'outro-som.wav');
fs.writeFileSync(recodificado, wav(GRITO, { taxa: 16000, ganho: 0.5, silencio: 0.4 }));
fs.writeFileSync(diferente, wav(OUTRO));
const original = wav(GRITO).toString('base64');

const { browser } = await abrirNavegador();
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'parecido' + s);
  await dispensarPresentes(page);
  const nomeOriginal = 'Por favor, me ajuda ' + s;
  const status = await page.evaluate(
    async ({ api, nome, audio }) => {
      const cabecalho = { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' };
      const [comunidade] = await (await fetch(api + '/api/communities', { headers: cabecalho })).json();
      const r = await fetch(api + `/api/communities/${comunidade.id}/sounds`, {
        method: 'POST',
        headers: cabecalho,
        body: JSON.stringify({ name: nome, icon: '🙏', audio: 'data:audio/wav;base64,' + audio }),
      });
      return r.status;
    },
    { api: API, nome: nomeOriginal, audio: original },
  );
  status === 200 ? ok('o som original subiu') : falhou('envio do original: ' + status);

  await page.reload();
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Soundboard' }).click();
  await page.locator('.soundboard-add').click();
  const arquivo = page.locator('.soundboard-add-form input[type="file"]');

  await arquivo.setInputFiles(recodificado);
  await page
    .locator('.soundboard-parecido', { hasText: nomeOriginal })
    .waitFor({ timeout: 15000 })
    .then(
      async () => ok('o mesmo som em outro arquivo: ' + (await page.locator('.soundboard-parecido').innerText())),
      () => falhou('o aviso de som parecido não apareceu'),
    );
  (await page.getByRole('button', { name: 'Enviar som' }).isEnabled())
    ? ok('e o envio continua liberado: é aviso, não bloqueio')
    : falhou('o aviso travou o envio');
  await page.locator('.soundboard').screenshot({ path: path.join(process.env.FOTOS ?? path.join('e2e', 'fotos'), 'som-parecido.png') });

  await arquivo.setInputFiles(diferente);
  await page.waitForTimeout(3000);
  (await page.locator('.soundboard-parecido').count()) === 0
    ? ok('um som diferente não tem aviso')
    : falhou('aviso num som diferente: ' + (await page.locator('.soundboard-parecido').innerText()));
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  fs.rmSync(pasta, { recursive: true, force: true });
  resumo('som parecido');
}
