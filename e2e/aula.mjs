// A AULA, de ponta a ponta (pedido do professor de idiomas, 05/10/2026):
//   1. a professora cria o "Link da aula" da Sala 1 da turma dela;
//   2. uma aluna SEM CONTA abre o link, escreve só o nome e cai na sala, em MODO SALA — sem coluna de
//      comunidades, sem lista de canais, com os controles reduzidos;
//   3. a professora a vê na turma;
//   4. quem JÁ TEM CONTA abre o mesmo link e também cai na sala, e pode sair do modo sala;
//   5. a aluna sai da aula.
//
//   SITE=http://localhost:5174/app/ node e2e/aula.mjs   (API de teste na 3099 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
const novaJanela = async () => vigiar(await (await browser.newContext({ viewport: { width: 1300, height: 850 }, permissions: ['microphone'] })).newPage());

// ---------- 1. a professora e o link ----------
const professora = await novaJanela();
await cadastrar(professora, 'prof' + s);
await dispensarPresentes(professora);
const turma = 'Japonês ' + s;
await professora.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await professora.getByText('Criar a minha').click();
await professora.getByLabel('Nome da comunidade').fill(turma);
await professora.locator('.dialog .btn-primary').click();
await professora.locator(`.rail-list .rail-item[aria-label="${turma}"]`).click();
await professora.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
await professora.locator('.stage-controls').waitFor({ timeout: 30000 });

await professora.locator('button[aria-label="Link da aula"]').first().click();
await professora.getByRole('button', { name: 'Criar link' }).click();
const campo = professora.locator('.link-aula li input').first();
await campo.waitFor({ timeout: 10000 });
const link = await campo.inputValue();
link.includes('?aula=') ? ok('a professora criou o link da aula') : falhou('o link não saiu: ' + link);
await professora.locator('.link-aula').screenshot({ path: 'e2e/fotos/aula-link.png' });

await professora.keyboard.press('Escape');

// ---------- 2. a aluna sem conta ----------
const aluna = await novaJanela();
await aluna.goto(link);
await aluna.locator('.entrada-aula h1', { hasText: 'Sala 1' }).waitFor({ timeout: 20000 });
ok('a aluna abre o link e vê "Aula de Sala 1", sem cadastro');
await aluna.locator('#abertura').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
await aluna.screenshot({ path: 'e2e/fotos/aula-entrada.png' });
await aluna.getByLabel('Seu nome').fill('Maria Clara');
await aluna.getByRole('button', { name: 'Entrar na aula' }).click();

await aluna.locator('.app.modo-sala').waitFor({ timeout: 30000 });
await aluna.locator('.stage-controls').waitFor({ timeout: 30000 });
ok('só com o nome, a aluna caiu na sala, em modo sala');
const faixa = await aluna.locator('.faixa-aula').innerText();
faixa.includes('Sala 1') && faixa.includes(turma) ? ok('a faixa da aula diz a sala e a turma') : falhou('faixa da aula: ' + faixa);
const sobra = await aluna.evaluate(() => ['.rail', '.sidebar', '.members'].filter((sel) => {
  const el = document.querySelector(sel);
  return el && getComputedStyle(el).display !== 'none';
}));
sobra.length === 0 ? ok('sem coluna de comunidades, lista de canais nem de membros') : falhou('ainda aparecem: ' + sobra.join(', '));
(await aluna.locator('.stage-controls button[aria-label="Compartilhar tela"], .stage-controls button[aria-label="Mais"]').count()) === 0
  ? ok('os controles ficaram só com microfone, áudio, câmera e sair')
  : falhou('o modo sala ainda mostra compartilhar tela ou "Mais"');
(await aluna.locator('.sessao-conversa').count()) === 1 ? ok('e a conversa da turma fica ao lado') : falhou('a conversa não está ao lado da chamada');
// A ABERTURA TEM DE TER SAÍDO: ela deixa o clique passar, então o teste clicaria por baixo dela e
// passaria com a aluna olhando só para o coelho da abertura.
await aluna.waitForTimeout(800);
(await aluna.locator('#abertura').count()) === 0 ? ok('a abertura saiu da frente') : falhou('a abertura continua por cima da aula');
await aluna.screenshot({ path: 'e2e/fotos/aula-modo-sala.png' });

// ---------- 3. a professora vê a aluna ----------
await professora
  .locator('.voice-member-name', { hasText: /^Maria\.Clara-\d{3}$/ })
  .first()
  .waitFor({ timeout: 20000 })
  .then(
    () => ok('a professora vê a Maria Clara na sala'),
    () => falhou('a aluna não apareceu na sala para a professora'),
  );

// ---------- 4. quem já tem conta ----------
const colega = await novaJanela();
await cadastrar(colega, 'col' + s);
await dispensarPresentes(colega);
await colega.goto(link);
await colega.locator('.app.modo-sala').waitFor({ timeout: 30000 });
await colega.locator('.stage-controls').waitFor({ timeout: 30000 });
ok('quem já tem conta abre o mesmo link e cai na sala');
await colega.getByRole('button', { name: 'Sair do modo sala' }).click();
await colega.waitForFunction(() => !document.querySelector('.app.modo-sala'), null, { timeout: 5000 }).then(
  () => ok('e pode sair do modo sala para o Syden inteiro'),
  () => falhou('o modo sala não saiu'),
);

// ---------- 5. a aluna sai ----------
await aluna.getByRole('button', { name: 'Sair da aula' }).click();
await aluna.locator('.app.modo-sala').waitFor({ state: 'detached', timeout: 10000 }).then(
  () => ok('a aluna sai da aula'),
  () => falhou('"Sair da aula" não tirou a aluna da aula'),
);

await browser.close();
resumo('A aula');
