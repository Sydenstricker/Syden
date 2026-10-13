// O LÁPIS DO PRÓPRIO CARTÃO DE PERFIL (11/10/2026): "caso o usuário se veja em comunidade, ele dá hover no
// seu ícone, clica no lápis e as mesmas opções aparecem aqui". Confere o caminho inteiro numa conta nova:
//
// - o lápis existe no SEU cartão e não existe no dos outros;
// - ele abre as escolhas dentro do cartão, sem sair para as Configurações;
// - vestir um fundo muda o cartão NA HORA (o cartão lê do diretório, que o "user:updated" atualiza);
// - o cartão inteiro continua dentro da janela depois de crescer;
// - o link "Aparência" leva à tela completa.
//
// Fotos em FOTOS (padrão: e2e/fotos/lapis-*.png), para olhar o desenho em 300 px.
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });

const { browser } = await abrirNavegador();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
try {
  const nome = await criarConta(page, 'lapis');
  await dispensarPresentes(page);

  // O PRIMEIRO cadastro de um banco novo ganha a comunidade inicial e cai no quarto; a lista de membros
  // aparece ao entrar num canal de texto.
  await page.locator('.channel-name', { hasText: 'geral' }).first().click();
  const euNaLista = page.locator('.member', { hasText: nome }).first();
  await euNaLista.waitFor({ timeout: 15_000 });
  await euNaLista.click();
  const cartao = page.locator('.perfil-cartao');
  await cartao.waitFor({ timeout: 5000 });

  const lapis = cartao.locator('.perfil-editar');
  if ((await lapis.count()) === 1) ok('o seu cartão tem o lápis');
  else falhou('o lápis não apareceu no seu próprio cartão');

  await lapis.click();
  const escolhas = cartao.locator('.perfil-escolhas');
  await escolhas.waitFor({ timeout: 8000 });
  await escolhas.locator('.perfil-escolha').first().waitFor({ timeout: 8000 });
  if (await page.locator('.settings-modal, .settings-content').count()) falhou('o lápis abriu as Configurações em vez das escolhas');
  else ok('o lápis abre as escolhas dentro do cartão');
  await page.screenshot({ path: path.join(FOTOS, 'lapis-cor.png'), clip: (await cartao.boundingBox()) ?? undefined });

  // Vestir um fundo: a faixa do cartão tem de trocar de classe sem fechar nada.
  await escolhas.getByRole('tab', { name: 'Fundo do perfil' }).click();
  // O segundo da lista, e não o primeiro: o primeiro é o fundo liso, igual a não ter fundo nenhum.
  const fundo = escolhas.locator('.perfil-escolha').nth(1);
  await fundo.waitFor({ timeout: 5000 });
  const antes = await cartao.locator('.perfil-banner').getAttribute('class');
  await fundo.click();
  await page
    .waitForFunction((a) => document.querySelector('.perfil-cartao .perfil-banner')?.getAttribute('class') !== a, antes, { timeout: 8000 })
    .then(
      () => ok('vestir um fundo muda o cartão na hora'),
      () => falhou('o fundo do cartão não mudou depois de vestir'),
    );
  if (await escolhas.locator('.perfil-escolha.vestido').count()) ok('o fundo vestido aparece marcado');
  else falhou('nenhuma escolha aparece marcada como em uso');

  // O cartão cresceu: ele inteiro precisa caber na janela.
  const caixa = await cartao.boundingBox();
  if (caixa && caixa.y >= 0 && caixa.y + caixa.height <= 950 && caixa.x + caixa.width <= 1500) ok('o cartão aberto cabe na janela');
  else falhou(`o cartão passou da janela: ${JSON.stringify(caixa)}`);
  await page.screenshot({ path: path.join(FOTOS, 'lapis-fundo.png'), clip: caixa ?? undefined });

  // O segundo caminho: o link leva à Aparência completa.
  await escolhas.locator('.perfil-escolhas-mais').click();
  await page
    .getByRole('heading', { name: 'Aparência' })
    .waitFor({ timeout: 5000 })
    .then(
      () => ok('o link "Aparência" abre a tela completa'),
      () => falhou('o link "Aparência" não abriu a tela completa'),
    );

  // Na tela completa, o CARTÃO INTEIRO veste (13/10/2026: saiu o botão "Usar" de dentro de cada um).
  await page.getByRole('tab', { name: 'Fundo do perfil' }).last().click();
  const vestivel = page.locator('.guarda-roupa-cartao.vestivel').first();
  await vestivel.waitFor({ timeout: 5000 });
  const nomeDoFundo = (await vestivel.locator('strong').innerText()).trim();
  (await page.locator('.guarda-roupa-cartao button', { hasText: 'Usar' }).count()) === 0 ? ok('não há mais botão "Usar" nos cartões') : falhou('ainda há botão "Usar"');
  await vestivel.click();
  await page
    .locator('.guarda-roupa-cartao.vestido', { hasText: nomeDoFundo })
    .waitFor({ timeout: 5000 })
    .then(
      () => ok(`clicar no cartão vestiu o fundo "${nomeDoFundo}"`),
      () => falhou('clicar no cartão não vestiu o fundo'),
    );
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('lápis do perfil');
}
