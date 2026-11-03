// A LIGAÇÃO NA CONVERSA PRIVADA (pedido dele, 02/11/2026), num Chrome de verdade e com o LiveKit no ar:
//   1. a Ana liga pela conversa; a Bia vê o cartão "está ligando" e atende;
//   2. as duas ficam na mesma chamada, com o palco em cima da conversa e o painel "Voz conectada" na barra;
//   3. a Ana liga a câmera e a Bia vê o vídeo; a Ana transmite a tela e a Bia abre e vê;
//   4. a Bia desliga; a Ana liga de novo, a Bia recusa, e a Ana recebe o aviso.
// Sem mini-game, karaokê e soundboard na chamada privada (são coisas de comunidade).
//
// Precisa do LiveKit no ar (npm run dev:livekit). Fotos em FOTOS (padrão: e2e/fotos/chamada-*.png).
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });

/** A tela compartilhada é um canvas animado: nunca a tela de verdade de quem roda o teste. */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${n % 360} 60% 25%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 30);
    return canvas.captureStream(30);
  };
};

const { browser } = await abrirNavegador();

async function entrar(prefixo) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  const nome = await criarConta(page, prefixo);
  await dispensarPresentes(page);
  return { page, nome };
}

try {
  const ana = await entrar('ana');
  await ana.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await ana.page.getByText('Criar a minha').click();
  await ana.page.getByLabel('Nome da comunidade').fill('Ligação ' + Date.now().toString().slice(-5));
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

  // A Ana abre a conversa com a Bia pelo cartão dela.
  await ana.page.locator('.channel-name', { hasText: 'geral' }).first().click();
  const biaNaLista = ana.page.locator('.members .member', { hasText: bia.nome }).first();
  await biaNaLista.waitFor({ timeout: 15000 });
  await biaNaLista.click();
  await ana.page.locator('.perfil-cartao').getByRole('button', { name: 'Mandar mensagem' }).click();
  // A caixa DA CONVERSA (o placeholder diz com quem): a do #geral continua na tela até a conversa abrir, e escrever nela
  // mandaria a mensagem para o canal.
  const caixa = ana.page.getByPlaceholder(new RegExp(`Conversar com .{0,2}${bia.nome}`));
  await caixa.waitFor({ timeout: 15000 });
  await caixa.fill('oi, vou te ligar');
  await caixa.press('Enter');
  await ana.page.locator('.message', { hasText: 'oi, vou te ligar' }).first().waitFor({ timeout: 10000 }).then(
    () => ok('a Ana mandou a mensagem na conversa'),
    () => falhou('a mensagem da Ana não apareceu na conversa dela'),
  );

  // ---------- 1. ligar e atender ----------
  await ana.page.getByRole('button', { name: 'Iniciar chamada', exact: true }).click();
  await ana.page.locator('.chamada-da-conversa .stage-controls').waitFor({ timeout: 30000 });
  ok('a Ana ligou: o palco aparece em cima da conversa');
  const cartao = bia.page.locator('.chamada-recebida');
  await cartao.waitFor({ timeout: 10000 }).then(
    () => ok('a Bia recebe o cartão de quem está ligando'),
    () => falhou('o toque não chegou à Bia'),
  );
  await bia.page.screenshot({ path: path.join(FOTOS, 'chamada-tocando.png'), clip: (await cartao.boundingBox()) ?? undefined });
  await cartao.getByRole('button', { name: 'Atender' }).click();
  await bia.page.locator('.chamada-da-conversa .stage-controls').waitFor({ timeout: 30000 });
  ok('a Bia atendeu: a conversa abre com o palco');
  await bia.page.locator('.message', { hasText: 'oi, vou te ligar' }).first().waitFor({ timeout: 10000 }).then(
    () => ok('embaixo do palco, a Bia vê a conversa com a mensagem da Ana'),
    () => falhou('a conversa da Bia, embaixo do palco, não tem a mensagem da Ana'),
  );
  (await bia.page.locator('.user-panel-name').innerText()).trim().length > 1
    ? ok('na chamada, o nome continua na barra de baixo')
    : falhou('o nome sumiu da barra de baixo');

  // ---------- 2. as duas na chamada ----------
  const quadros = (p) => p.locator('.chamada-da-conversa .lk-participant-tile').count();
  await ana.page.waitForFunction(() => document.querySelectorAll('.chamada-da-conversa .lk-participant-tile').length >= 2, null, { timeout: 20000 }).then(
    () => ok('a Ana vê as duas na chamada'),
    async () => falhou(`a Ana vê ${await quadros(ana.page)} quadro(s)`),
  );
  (await bia.page.locator('.voice-panel', { hasText: 'Voz conectada' }).count()) > 0
    ? ok('a barra lateral mostra "Voz conectada"')
    : falhou('a barra lateral não mostra a chamada');
  const semComunidade = await ana.page.evaluate(() => ({
    minijogo: !!document.querySelector('.chamada-da-conversa .stage-controls [aria-label*="ini-game" i]'),
  }));
  !semComunidade.minijogo ? ok('sem botão de mini-game na chamada privada') : falhou('o mini-game apareceu na chamada privada');
  (await cartao.count()) === 0 ? ok('o cartão do toque sumiu ao atender') : falhou('o cartão do toque continuou depois de atender');

  // ---------- 3. câmera e tela ----------
  await ana.page.locator('.chamada-da-conversa .stage-controls button[aria-label="Ligar câmera"]').click();
  await bia.page.waitForFunction(() => [...document.querySelectorAll('.chamada-da-conversa video')].some((v) => v.videoWidth > 0), null, { timeout: 25000 }).then(
    () => ok('a Bia vê a câmera da Ana'),
    () => falhou('a câmera da Ana não chegou à Bia'),
  );
  await ana.page.locator('.chamada-da-conversa .stage-controls button[aria-label="Ligar câmera"], .chamada-da-conversa .stage-controls button[aria-label="Desligar câmera"]').first().click();
  await ana.page.locator('.chamada-da-conversa .stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.page.locator('.screenshare-option').first().click();
  await ana.page.locator('.chamada-da-conversa .stage-main video').first().waitFor({ timeout: 25000 });
  const assistir = bia.page.locator('.chamada-da-conversa .stream-invite');
  await assistir.first().waitFor({ timeout: 15000 }).catch(() => {});
  if ((await assistir.count()) > 0) await assistir.getByRole('button').first().click();
  await bia.page.waitForFunction(() => [...document.querySelectorAll('.chamada-da-conversa .stage-main video, .chamada-da-conversa video')].some((v) => v.videoWidth >= 640), null, { timeout: 25000 }).then(
    () => ok('a Ana transmite a tela e a Bia vê'),
    () => falhou('a transmissão da Ana não chegou à Bia'),
  );
  await bia.page.screenshot({ path: path.join(FOTOS, 'chamada-na-conversa.png') });

  // ---------- 4. desligar, ligar de novo, recusar ----------
  await bia.page.locator('.chamada-da-conversa .leave-button').click();
  await bia.page.locator('.chamada-da-conversa').waitFor({ state: 'detached', timeout: 10000 });
  await ana.page.locator('.chamada-da-conversa .leave-button').click();
  await ana.page.locator('.chamada-da-conversa').waitFor({ state: 'detached', timeout: 10000 });
  ok('desligar tira o palco da conversa');
  // A conversa da Bia está aberta: ela vê o "Entrar na chamada" quando a Ana liga de novo.
  await ana.page.waitForTimeout(21_000); // o freio do toque: um a cada 20 s por pessoa e conversa
  await ana.page.getByRole('button', { name: 'Iniciar chamada', exact: true }).click();
  await ana.page.locator('.chamada-da-conversa .stage-controls').waitFor({ timeout: 30000 });
  await bia.page.getByRole('button', { name: 'Entrar na chamada' }).waitFor({ timeout: 10000 }).then(
    () => ok('com a chamada aberta, a conversa da Bia mostra "Entrar na chamada"'),
    () => falhou('o "Entrar na chamada" não apareceu'),
  );
  await bia.page.locator('.chamada-recebida').getByRole('button', { name: 'Recusar chamada' }).click();
  // O nome vem entre os caracteres invisíveis de isolamento bidirecional (ver tituloDoCanal, em ajuda.mjs).
  await ana.page.getByText(new RegExp(`${bia.nome}.{0,2} recusou a chamada`)).waitFor({ timeout: 10000 }).then(
    () => ok('a Ana fica sabendo que a Bia recusou'),
    () => falhou('a recusa não chegou à Ana'),
  );
  await ana.page.locator('.chamada-da-conversa .leave-button').click();
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('ligação na conversa privada');
}
