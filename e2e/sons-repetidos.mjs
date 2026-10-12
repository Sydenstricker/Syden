// A FAXINA DOS SONS REPETIDOS (11/10/2026): quem administra procura, nas configurações do soundboard, os sons que
// parecem o mesmo e já estão lá — o "Por favor, me ajuda" ao lado de "Me ajuda (de novo)", que entraram antes do
// aviso existir. O teste sobe dois arquivos diferentes do mesmo som e um som diferente, e confere:
//
// - os dois parecidos aparecem juntos num grupo, e o diferente não;
// - excluir um deles desfaz o grupo, e a tela diz que não há mais repetidos.
//
//   node e2e/sons-repetidos.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar, wavDeTeste } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const GRITO = [0.2, 0.9, 1, 0.6, 0.1, 0.8, 0.3, 0.05, 0.7, 0.4, 0.9, 0.2];
const OUTRO = [1, 0.1, 0.1, 0.9, 0.2, 0.2, 1, 0.1, 0.5, 0.9, 0.1, 0.6];
const SONS = [
  ['Por favor, me ajuda ' + s, wavDeTeste(GRITO)],
  ['Me ajuda (de novo) ' + s, wavDeTeste(GRITO, { taxa: 16000, ganho: 0.5, silencio: 0.4 })],
  ['Buzina ' + s, wavDeTeste(OUTRO)],
].map(([nome, dados]) => [nome, dados.toString('base64')]);

const { browser } = await abrirNavegador();
try {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage());
  await cadastrar(page, 'faxina' + s);
  await dispensarPresentes(page);

  // Uma comunidade dela, onde ela administra.
  await page.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await page.locator('.community-choice-option').first().click();
  await page.locator('form.dialog input').first().fill('Faxina ' + s);
  await page.locator('form.dialog .btn-primary').click();
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });

  const enviados = await page.evaluate(
    async ({ api, nomeDaComunidade, sons }) => {
      const cabecalho = { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' };
      const comunidades = await (await fetch(api + '/api/communities', { headers: cabecalho })).json();
      const comunidade = comunidades.find((c) => c.name === nomeDaComunidade);
      let certos = 0;
      for (const [nome, audio] of sons) {
        const r = await fetch(api + `/api/communities/${comunidade.id}/sounds`, {
          method: 'POST',
          headers: cabecalho,
          body: JSON.stringify({ name: nome, icon: '🔊', audio: 'data:audio/wav;base64,' + audio }),
        });
        if (r.ok) certos += 1;
      }
      return certos;
    },
    { api: API, nomeDaComunidade: 'Faxina ' + s, sons: SONS },
  );
  enviados === 3 ? ok('três sons enviados: dois arquivos do mesmo som e um diferente') : falhou(`só ${enviados} sons entraram`);

  // RECARREGAR É PRECISO: os envios saem logo depois de criar a comunidade, e a página ainda não entrou na
  // sala dela para receber o "sound:created" — perdia um dos três e a faxina comparava só dois.
  await page.reload();
  await dispensarPresentes(page);
  await page.locator('.rail-item', { hasText: /^F/ }).first().click().catch(() => {});
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });

  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /^\s*Soundboard\s*$/ }).first().click();
  await page.getByRole('button', { name: 'Procurar sons repetidos' }).click();

  const grupo = page.locator('.sons-repetidos-grupo');
  await grupo.first().waitFor({ timeout: 20000 });
  const nomes = await grupo.first().locator('.expression-name').allInnerTexts();
  (await grupo.count()) === 1 && nomes.length === 2 && nomes.includes(SONS[0][0]) && nomes.includes(SONS[1][0])
    ? ok('os dois arquivos do mesmo som aparecem juntos, num grupo')
    : falhou('grupos: ' + JSON.stringify(nomes));
  !nomes.includes(SONS[2][0]) ? ok('e o som diferente fica de fora') : falhou('o som diferente entrou no grupo');
  await page.locator('.sons-repetidos').screenshot({ path: path.join(FOTOS, 'sons-repetidos.png') });

  await grupo.first().getByRole('button', { name: 'Excluir ' + SONS[1][0] }).click();
  await page
    .getByText('Nenhum som repetido.')
    .waitFor({ timeout: 10000 })
    .then(
      () => ok('excluído o repetido, o grupo some e a tela diz que não há mais'),
      () => falhou('o grupo continuou depois de excluir'),
    );
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('sons repetidos');
}
