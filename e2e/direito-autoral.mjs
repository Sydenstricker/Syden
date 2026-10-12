// RETIRADA POR DIREITO AUTORAL (11/10/2026), de ponta a ponta: alguém sobe um som, quem cuida do Syden o acha pelo
// nome no painel, retira dizendo quem reclamou, e quem subiu recebe o aviso numa conversa privada — onde pode
// responder. É o que os termos prometem na seção 4.
//
// PRECISA DE UM BANCO NOVO: a primeira conta cadastrada é quem cuida do Syden, e é ela que este teste usa.
//   (API de teste na 3099 com banco apagado, site na 5174)   node e2e/direito-autoral.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
const novaPagina = async () => (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();

try {
  const dona = await novaPagina();
  await cadastrar(dona, 'dona' + s);
  await dispensarPresentes(dona);
  const quemSobe = await novaPagina();
  await cadastrar(quemSobe, 'sobe' + s);
  await dispensarPresentes(quemSobe);

  // Quem sobe envia um som à comunidade inicial, pela mesma rota que a tela usa.
  const nomeDoSom = 'Hino famoso ' + s;
  const enviado = await quemSobe.evaluate(
    async ({ api, nome }) => {
      const token = localStorage.getItem('janja.token');
      const cabecalho = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
      const [comunidade] = await (await fetch(api + '/api/communities', { headers: cabecalho })).json();
      const bytes = new Uint8Array([79, 103, 103, 83, 1, 2, 3, 4, 5]); // "OggS…"
      const audio = 'data:audio/ogg;base64,' + btoa(String.fromCharCode(...bytes));
      const r = await fetch(api + `/api/communities/${comunidade.id}/sounds`, {
        method: 'POST',
        headers: cabecalho,
        body: JSON.stringify({ name: nome, icon: '🎵', audio }),
      });
      return r.status;
    },
    { api: API, nome: nomeDoSom },
  );
  enviado === 200 ? ok('quem sobe enviou um som') : falhou('envio do som: ' + enviado);

  // Quem cuida do Syden acha pelo nome e retira.
  await dona.locator('.usage-link').click();
  await dona.getByRole('tab', { name: 'Direito autoral' }).click();
  await dona.getByLabel('Procurar conteúdo').fill('Hino famoso');
  await dona.getByRole('button', { name: 'Procurar' }).click();
  const item = dona.locator('.direito-autoral .denuncia-item', { hasText: nomeDoSom });
  await item.waitFor({ timeout: 8000 });
  (await item.innerText()).includes('quem subiu: sobe' + s) ? ok('a busca acha o som e diz quem subiu') : falhou('item: ' + (await item.innerText()));

  await item.getByRole('button', { name: 'Retirar' }).click();
  await item.getByLabel('Quem reclamou').fill('Gravadora Exemplo (juridico@exemplo.test)');
  const aviso = await item.getByLabel('Aviso para quem subiu').inputValue();
  aviso.includes(nomeDoSom) && aviso.includes('Gravadora Exemplo') && aviso.includes('termos.html#direito-autoral')
    ? ok('o aviso vem pronto, com o som, quem reclamou e o link dos termos')
    : falhou('aviso: ' + aviso);
  await dona.locator('.direito-autoral').screenshot({ path: path.join(FOTOS, 'direito-autoral-retirar.png') });

  await item.getByRole('button', { name: 'Retirar e avisar' }).click();
  await dona
    .locator('.direito-autoral-feito')
    .waitFor({ timeout: 8000 })
    .then(
      async () => ok('retirado: ' + (await dona.locator('.direito-autoral-feito').innerText())),
      () => falhou('a retirada não confirmou'),
    );
  (await dona.locator('.direito-autoral .denuncia-item.resolvida', { hasText: nomeDoSom }).count()) === 1
    ? ok('e entrou no histórico de retiradas')
    : falhou('o histórico não mostrou a retirada');
  await dona.locator('.direito-autoral').screenshot({ path: path.join(FOTOS, 'direito-autoral-feito.png') });

  // Quem subiu recebe o aviso numa conversa privada.
  await quemSobe.reload();
  await dispensarPresentes(quemSobe);
  await quemSobe.locator('.rail-item[aria-label*="onversa"], .rail-dm, [aria-label="Conversas"]').first().click().catch(() => {});
  const conversa = quemSobe.getByText('dona' + s).first();
  await conversa.click({ timeout: 8000 }).catch(() => {});
  // Na ÁREA DA CONVERSA, e não na prévia da lista de conversas: a primeira versão deste teste passava
  // achando o texto na prévia, com a conversa ainda vazia na tela.
  await quemSobe
    .locator('[class*="message"]')
    .filter({ hasText: /saiu do Syden porque Gravadora Exemplo/ })
    .first()
    .waitFor({ timeout: 10000 })
    .then(
      () => ok('quem subiu recebeu o aviso na conversa privada'),
      () => falhou('o aviso não apareceu para quem subiu'),
    );
  await quemSobe.screenshot({ path: path.join(FOTOS, 'direito-autoral-aviso.png') });
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('direito autoral');
}
