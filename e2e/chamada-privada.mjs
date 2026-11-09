// A LIGAÇÃO NA CONVERSA PRIVADA (pedido dele, 02/11/2026), num Chrome de verdade e com o LiveKit no ar:
//   1. a Ana liga pela conversa; a Bia vê o cartão "está ligando" e atende;
//   2. as duas ficam na mesma chamada, com o palco em cima da conversa e o painel "Voz conectada" na barra;
//   3. a Ana liga a câmera e a Bia vê o vídeo; a Ana transmite a tela e a Bia abre e vê;
//   4. a Bia desliga; a Ana liga de novo, a Bia recusa, e a Ana recebe o aviso.
// E os sons da ligação (09/11/2026): a Bia, com os "Sons de aviso" desligados, ouve o toque mesmo assim; a Ana ouve o
// "chamando" enquanto espera, e ele para quando a Bia atende ou recusa; o pedido de notificação do navegador aparece na
// primeira ligação da Ana e não volta na segunda.
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

/**
 * Os sons são sintetizados (sounds.ts): cada nota é um oscilador. Guarda a frequência de cada um que começa, para saber
 * o que tocou sem depender de alto-falante. O toque tem o Dó agudo (1046,5 Hz; é também o harmônico do som de entrar, por
 * isso só se procura na Bia, que desligou os sons de aviso); o chamando, o Mi grave (329,63 Hz), que é só dele.
 */
const OUVIR_NOTAS = () => {
  window.__notas = [];
  const comecar = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    window.__notas.push(Math.round(this.frequency.value));
    return comecar.apply(this, args);
  };
};
/**
 * O Chrome do teste responde "denied" às notificações sem perguntar; aqui ele fica no "ainda não perguntou" de quem
 * acabou de chegar, e a pergunta do navegador só é contada (nada aparece na tela de quem roda o teste).
 */
const NOTIFICACAO_NAO_PERGUNTADA = () => {
  window.__perguntasDoNavegador = 0;
  Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
  Notification.requestPermission = async () => {
    window.__perguntasDoNavegador++;
    return 'default';
  };
};
const TOQUE = 1047, CHAMANDO = 330;
const contar = (p, freq) => p.evaluate((f) => window.__notas.filter((n) => n === f).length, freq);

const { browser } = await abrirNavegador();

async function entrar(prefixo) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await page.addInitScript(OUVIR_NOTAS);
  await page.addInitScript(NOTIFICACAO_NAO_PERGUNTADA);
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

  // A Bia desliga os sons de aviso: o toque de ligação tem a chave dele, e tem de tocar mesmo assim.
  await bia.page.locator('button[aria-label="Configurações"]').first().click();
  await bia.page.locator('.settings-tab', { hasText: 'Notificações' }).first().click();
  const sonsDeAviso = bia.page.locator('label.toggle-row', { has: bia.page.locator('.toggle-label', { hasText: /^Sons de aviso$/ }) });
  await sonsDeAviso.click();
  (await sonsDeAviso.locator('input').isChecked()) ? falhou('os sons de aviso da Bia não desligaram') : ok('a Bia desligou os sons de aviso');
  await bia.page.keyboard.press('Escape');

  // ---------- 1. ligar e atender ----------
  await ana.page.getByRole('button', { name: 'Iniciar chamada', exact: true }).click();
  await ana.page.locator('.chamada-da-conversa .stage-controls').waitFor({ timeout: 30000 });
  ok('a Ana ligou: o palco aparece em cima da conversa');
  const pedido = ana.page.locator('.pedido-de-aviso');
  await pedido.waitFor({ timeout: 5000 }).then(
    () => ok('na primeira ligação, a Ana vê o pedido de notificação'),
    () => falhou('o pedido de notificação não apareceu na primeira ligação'),
  );
  (await ana.page.evaluate(() => window.__perguntasDoNavegador)) === 0
    ? ok('a pergunta do navegador espera o clique')
    : falhou('a pergunta do navegador saiu sem o clique');
  await ana.page.screenshot({ path: path.join(FOTOS, 'chamada-pedido-de-aviso.png'), clip: (await pedido.boundingBox()) ?? undefined });
  await pedido.getByRole('button', { name: 'Permitir notificações' }).click();
  await pedido.waitFor({ state: 'detached', timeout: 3000 }).then(
    () => ok('"Permitir notificações" fecha o pedido'),
    () => falhou('o pedido de notificação não fechou'),
  );
  (await ana.page.evaluate(() => window.__perguntasDoNavegador)) === 1
    ? ok('e só então o navegador pergunta')
    : falhou('o "Permitir notificações" não chamou a pergunta do navegador');
  const cartao = bia.page.locator('.chamada-recebida');
  await cartao.waitFor({ timeout: 10000 }).then(
    () => ok('a Bia recebe o cartão de quem está ligando'),
    () => falhou('o toque não chegou à Bia'),
  );
  await bia.page.waitForFunction((f) => window.__notas.includes(f), TOQUE, { timeout: 5000 }).then(
    () => ok('com os sons de aviso desligados, a Bia ouve o toque'),
    () => falhou('o toque não tocou para a Bia (sons de aviso desligados)'),
  );
  await ana.page.waitForFunction((f) => window.__notas.includes(f), CHAMANDO, { timeout: 5000 }).then(
    () => ok('a Ana ouve o "chamando" enquanto espera'),
    () => falhou('o "chamando" não tocou para a Ana'),
  );
  await bia.page.screenshot({ path: path.join(FOTOS, 'chamada-tocando.png'), clip: (await cartao.boundingBox()) ?? undefined });
  await cartao.getByRole('button', { name: 'Atender' }).click();
  await bia.page.locator('.chamada-da-conversa .stage-controls').waitFor({ timeout: 30000 });
  ok('a Bia atendeu: a conversa abre com o palco');
  await bia.page.locator('.pedido-de-aviso').getByRole('button', { name: 'Agora não' }).click({ timeout: 5000 }).then(
    () => ok('quem atende a primeira ligação também vê o pedido, e diz "Agora não"'),
    () => falhou('o pedido de notificação não apareceu para quem atendeu'),
  );
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
  {
    const antes = await contar(ana.page, CHAMANDO);
    await ana.page.waitForTimeout(3500); // o chamando se repete a cada 3 s
    (await contar(ana.page, CHAMANDO)) === antes ? ok('o "chamando" para quando a Bia atende') : falhou('o "chamando" continuou depois de a Bia atender');
  }

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
  {
    const antes = await contar(ana.page, CHAMANDO);
    await ana.page.waitForTimeout(3500);
    (await contar(ana.page, CHAMANDO)) === antes ? ok('o "chamando" para quando a Bia recusa') : falhou('o "chamando" continuou depois da recusa');
  }
  (await pedido.count()) === 0 ? ok('o pedido de notificação não volta na segunda ligação') : falhou('o pedido de notificação voltou');
  // A Bia recebeu o pedido ao atender; disse "Agora não" e, ao recusar a segunda, ele não volta.
  (await bia.page.locator('.pedido-de-aviso').count()) === 0
    ? ok('quem disse "Agora não" não é perguntado de novo')
    : falhou('o pedido voltou para a Bia');
  await ana.page.locator('.chamada-da-conversa .leave-button').click();
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('ligação na conversa privada');
}
