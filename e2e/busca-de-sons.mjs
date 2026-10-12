// A BUSCA DO SOUNDBOARD (11/10/2026): "só aparece um som; o correto é aparecer a lista sequencial de sons
// prováveis". Numa chamada de verdade, com o painel aberto:
//
// - um erro de digitação ("ajdua") ainda acha o som, e ele vem PRIMEIRO;
// - a lista traz os outros prováveis atrás, em ordem;
// - Enter toca o primeiro, sem mouse (o sinal é o ícone do som aparecendo no quadro de quem tocou).
//
//   node e2e/busca-de-sons.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

// Nove sons (a busca só aparece com mais de oito), com ícones diferentes para saber qual tocou.
const SONS = [
  ['Por favor, me ajuda ' + s, '🙏'],
  ['Ajudante do Papai Noel ' + s, '🎅'],
  ['Risada ' + s, '😂'],
  ['Aplausos ' + s, '👏'],
  ['Buzina ' + s, '📯'],
  ['Tambor ' + s, '🥁'],
  ['Grito ' + s, '😱'],
  ['Sino ' + s, '🔔'],
  ['Trombeta ' + s, '🎺'],
];

const { browser } = await abrirNavegador();
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'busca' + s);
  await dispensarPresentes(page);

  const enviados = await page.evaluate(
    async ({ api, sons, rodada }) => {
      const cabecalho = { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' };
      const [comunidade] = await (await fetch(api + '/api/communities', { headers: cabecalho })).json();
      let certos = 0;
      for (const [i, [nome, icone]] of sons.entries()) {
        // Diferente por som E por rodada: o mesmo áudio duas vezes a comunidade recusa (é a regra do som repetido).
        const bytes = new Uint8Array([79, 103, 103, 83, i + 1, ...String(rodada).split('').map(Number)]);
        const audio = 'data:audio/ogg;base64,' + btoa(String.fromCharCode(...bytes));
        const r = await fetch(api + `/api/communities/${comunidade.id}/sounds`, {
          method: 'POST',
          headers: cabecalho,
          body: JSON.stringify({ name: nome, icon: icone, audio }),
        });
        if (r.ok) certos += 1;
      }
      return certos;
    },
    { api: API, sons: SONS, rodada: s },
  );
  enviados === SONS.length ? ok(`${enviados} sons enviados`) : falhou(`só ${enviados} sons entraram`);

  await page.reload();
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  // O soundboard mora no menu Mais da chamada.
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Soundboard' }).click();
  const busca = page.getByLabel('Procurar som');
  await busca.waitFor({ timeout: 8000 });

  await busca.fill('ajdua');
  const nomes = await page.locator('.soundboard .soundboard-name').allInnerTexts();
  nomes[0] === SONS[0][0] ? ok('"ajdua" (letras trocadas) acha "Por favor, me ajuda", em primeiro') : falhou('primeiro resultado: ' + nomes[0]);
  nomes.includes(SONS[1][0]) ? ok('e traz o outro provável atrás ("Ajudante…")') : falhou('a lista: ' + JSON.stringify(nomes));
  (await page.locator('.soundboard-group').count()) === 0 ? ok('buscando, é uma lista só, sem os grupos') : falhou('os grupos continuaram na busca');
  await page.locator('.soundboard').screenshot({ path: path.join(FOTOS, 'busca-de-sons.png') });

  await busca.press('Enter');
  await page
    .locator('.tile-sound', { hasText: '🙏' })
    .first()
    .waitFor({ timeout: 5000 })
    .then(
      () => ok('Enter tocou o primeiro da lista'),
      () => falhou('Enter não tocou o primeiro som'),
    );
  const toques = await page.evaluate(() => JSON.parse(localStorage.getItem('syden.sonsTocados') ?? '{}'));
  Object.values(toques).includes(1) ? ok('e o toque ficou contado neste aparelho') : falhou('toques: ' + JSON.stringify(toques));
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('busca do soundboard');
}
