// EDITAR PACOTE DE SOM E VOLUME DO SOM (12/10/2026). Dois relatos do mesmo dia: o "Não chora", gravado
// estourado, estava no pacote Streamer e não no Estourado; e o "faaaaah" de uma comunidade tocava alto do
// começo ao fim, o que o limitador (só achata picos) não pega. O teste confere:
//
// - quem é dono de dois pacotes move um som de um para o outro pela tela;
// - o volume de um som de pacote baixa pela barra e fica guardado;
// - o som da comunidade ganha a barra de volume no próprio formulário de editar.
//
//   node e2e/editar-pacote-de-som.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar, wavDeTeste } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const audio = (forma) => 'data:audio/wav;base64,' + wavDeTeste(forma).toString('base64');

const { browser } = await abrirNavegador();
try {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage());
  await cadastrar(page, 'pacotes' + s);
  await dispensarPresentes(page);

  await page.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await page.locator('.community-choice-option').first().click();
  await page.locator('form.dialog input').first().fill('Pacotes ' + s);
  await page.locator('form.dialog .btn-primary').click();
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });

  // Dois pacotes dela e um som na comunidade, pela API (o que se testa é a edição, não a criação).
  const ids = await page.evaluate(
    async ({ api, nome, sons }) => {
      const cabecalho = { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' };
      const criar = async (pacote, som) =>
        (
          await (
            await fetch(api + '/api/packs', {
              method: 'POST',
              headers: cabecalho,
              body: JSON.stringify({ name: pacote, description: 'teste', icon: '📦', sounds: [{ name: som, icon: '🔊', audio: sons[pacote] }] }),
            })
          ).json()
        ).id;
      const streamer = await criar('Streamer ' + nome, 'Não chora');
      const estourado = await criar('Estourado ' + nome, 'Rojão');
      const comunidade = (await (await fetch(api + '/api/communities', { headers: cabecalho })).json()).find((c) => c.name === 'Pacotes ' + nome);
      await fetch(api + `/api/communities/${comunidade.id}/sounds`, {
        method: 'POST',
        headers: cabecalho,
        body: JSON.stringify({ name: 'Faaaaah', icon: '😱', audio: sons.faah }),
      });
      return { streamer, estourado };
    },
    {
      api: API,
      nome: s,
      sons: { ['Streamer ' + s]: audio([1, 0.2, 0.9, 0.1]), ['Estourado ' + s]: audio([0.3, 1, 0.3, 1]), faah: audio([0.9, 0.9, 0.9, 0.9]) },
    },
  );
  ids.streamer && ids.estourado ? ok('dois pacotes dela, um som em cada') : falhou('os pacotes não saíram: ' + JSON.stringify(ids));

  await page.reload();
  await dispensarPresentes(page);
  await page.locator('.rail-item', { hasText: /^P/ }).first().click().catch(() => {});
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /^\s*Soundboard\s*$/ }).first().click();

  // ---------- O som da comunidade: a barra de volume no formulário de editar ----------
  await page.getByRole('button', { name: 'Renomear Faaaaah' }).click();
  const barraDaComunidade = page.getByLabel('Volume do som, para todo mundo: Faaaaah');
  await barraDaComunidade.fill('0.3');
  await page.getByRole('button', { name: 'Salvar Faaaaah' }).click();
  await page.waitForTimeout(800);
  const daComunidade = await page.evaluate(async ({ api }) => {
    const cabecalho = { authorization: 'Bearer ' + localStorage.getItem('janja.token') };
    const comunidades = await (await fetch(api + '/api/communities', { headers: cabecalho })).json();
    for (const c of comunidades) {
      const sons = await (await fetch(api + `/api/communities/${c.id}/sounds`, { headers: cabecalho })).json();
      const faah = sons.find((x) => x.name === 'Faaaaah');
      if (faah) return faah.volume;
    }
    return null;
  }, { api: API });
  daComunidade === 0.3 ? ok('o "Faaaaah" da comunidade ficou em 30%') : falhou('volume do som da comunidade: ' + daComunidade);

  // ---------- O pacote: mover o "Não chora" e baixar o volume ----------
  await page.getByRole('tab', { name: 'Pacotes' }).click();
  const cartao = page.locator('.pack-card', { hasText: 'Streamer ' + s });
  await cartao.getByRole('button', { name: 'Ouvir os sons' }).click();
  await cartao.getByRole('button', { name: 'Editar sons' }).click();
  await cartao.locator('.pack-editor-row').first().waitFor();
  await page.locator('.pack-editor').screenshot({ path: path.join(FOTOS, 'editar-pacote.png') });

  const barra = cartao.getByLabel('Volume do som, para todo mundo: Não chora');
  await barra.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(800);
  await cartao.getByLabel('Mover para outro pacote: Não chora').selectOption({ label: '📦 Estourado ' + s });
  await page.waitForTimeout(1200);

  const depois = await page.evaluate(async ({ api, ids }) => {
    const cabecalho = { authorization: 'Bearer ' + localStorage.getItem('janja.token') };
    const sons = async (id) => (await fetch(api + `/api/packs/${id}/sounds`, { headers: cabecalho })).json();
    return { streamer: await sons(ids.streamer), estourado: await sons(ids.estourado) };
  }, { api: API, ids });
  const chora = depois.estourado.find((x) => x.name === 'Não chora');
  chora && depois.streamer.length === 0 ? ok('o "Não chora" saiu do Streamer e foi para o Estourado') : falhou('depois de mover: ' + JSON.stringify(depois));
  chora && chora.volume === 0.8 ? ok('e levou o volume baixado (80%)') : falhou('volume do som do pacote: ' + chora?.volume);
  (await cartao.locator('.pack-meta').innerText()).includes('0 sons') ? ok('o cartão do Streamer conta 0 sons') : falhou('o cartão não atualizou');
} finally {
  await browser.close();
}
resumo('Editar pacote de som');
