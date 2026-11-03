// ABRIR UMA CONVERSA PRIVADA NÃO TIRA DA SALA DE VOZ (relato dele, 02/11/2026: "quando eu vou falar com alguém no chat,
// eu saio da sala em que estou"). A Ana entra numa sala de voz da comunidade, abre a conversa com a Bia pelo cartão e
// manda uma mensagem: continua na sala, com o painel "Voz conectada", e a Bia continua vendo a Ana na sala.
//
// Precisa do LiveKit no ar (npm run dev:livekit).
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
const { browser } = await abrirNavegador();

async function entrar(prefixo) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = vigiar(await ctx.newPage());
  const nome = await criarConta(page, prefixo);
  await dispensarPresentes(page);
  return { page, nome };
}

try {
  const ana = await entrar('ana');
  await ana.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await ana.page.getByText('Criar a minha').click();
  await ana.page.getByLabel('Nome da comunidade').fill('Sala ' + Date.now().toString().slice(-5));
  await ana.page.locator('.dialog .btn-primary').click();
  await ana.page.locator('.channel-list').waitFor({ timeout: 20000 });
  await ana.page.locator('button[aria-label="Configurações"]').first().click();
  await ana.page.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
  await ana.page.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
  const convite = (await ana.page.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.page.locator('.invite-row code').first().innerText());
  await ana.page.keyboard.press('Escape');

  const bia = await entrar('bia');
  await bia.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await bia.page.getByText('Entrar com um convite').click();
  await bia.page.getByLabel('Código de convite').fill(convite.trim());
  await bia.page.locator('.dialog .btn-primary').click();
  await bia.page.locator('.channel-list').waitFor({ timeout: 20000 });

  // A Ana entra na sala de voz.
  await ana.page.locator('.channel-name', { hasText: /Sala/ }).first().click();
  await ana.page.locator('.stage-controls').first().waitFor({ timeout: 30000 });
  await ana.page.locator('.voice-panel', { hasText: 'Voz conectada' }).waitFor({ timeout: 10000 });
  ok('a Ana entrou na sala de voz');

  // Abre a conversa com a Bia pelo cartão (o caminho do relato) e manda uma mensagem.
  await ana.page.locator('.channel-name', { hasText: 'geral' }).first().click();
  const biaNaLista = ana.page.locator('.members .member', { hasText: bia.nome }).first();
  await biaNaLista.waitFor({ timeout: 15000 });
  await biaNaLista.click();
  await ana.page.locator('.perfil-cartao').getByRole('button', { name: 'Mandar mensagem' }).click();
  const caixa = ana.page.getByPlaceholder(new RegExp(`Conversar com .{0,2}${bia.nome}`));
  await caixa.waitFor({ timeout: 15000 });
  await caixa.fill('oi, estou na sala');
  await caixa.press('Enter');
  await ana.page.locator('.message', { hasText: 'oi, estou na sala' }).first().waitFor({ timeout: 10000 });
  await ana.page.waitForTimeout(5000);

  (await ana.page.locator('.voice-panel', { hasText: 'Voz conectada' }).count()) > 0
    ? ok('com a conversa aberta, a Ana continua com "Voz conectada"')
    : falhou('abrir a conversa tirou a Ana da sala');
  // A chamada nunca caía: o que sumia era a sala da tela. Agora o palco dela fica em cima da conversa.
  (await ana.page.locator('.chamada-da-conversa .stage-controls').count()) > 0
    ? ok('o palco da sala fica em cima da conversa')
    : falhou('a conversa aberta escondeu a sala');
  (await ana.page.locator('.chamada-da-conversa .lk-participant-tile').count()) >= 1
    ? ok('com o quadro da Ana no palco')
    : falhou('o palco em cima da conversa está vazio');
  await ana.page.screenshot({ path: path.join(FOTOS, 'conversa-sem-sair-da-sala.png') });

  // O nome da sala, no painel "Voz conectada", leva de volta a ela, sem sair e entrar de novo.
  await ana.page.locator('.voice-panel-ir').click();
  await ana.page.locator('.palco-e-conversa .stage-controls').waitFor({ timeout: 10000 }).then(
    () => ok('o nome da sala no painel leva de volta à sala'),
    () => falhou('clicar no nome da sala não voltou para ela'),
  );
  (await ana.page.locator('.voice-panel', { hasText: 'Voz conectada' }).count()) > 0
    ? ok('e a Ana continua conectada')
    : falhou('voltar pela barra derrubou a chamada');

  // A Bia (na comunidade, fora da sala) continua vendo a Ana na sala.
  await bia.page.locator('.voice-member', { hasText: ana.nome }).first().waitFor({ timeout: 10000 }).then(
    () => ok('a Bia continua vendo a Ana na sala'),
    () => falhou('a Ana sumiu da sala para a Bia'),
  );
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('conversa sem sair da sala');
}
