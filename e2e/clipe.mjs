// A TESOURA: duas pessoas, uma transmitindo, e a outra clipando de verdade.
//
// Isto existe porque a tesoura foi dada como consertada duas vezes e continuou não fazendo nada. Os
// dois consertos eram reais — uma corrida dentro de clips.ts e o menu que se fechava ao clique — e
// nenhum dos dois foi medido CONTRA UMA TRANSMISSÃO DE VERDADE. Clipe é a única função do Syden que
// precisa de duas pessoas, de uma tela compartilhada e de trinta segundos passando: nada disso cabe
// num teste de unidade, e foi por isso que o defeito sobreviveu a dois consertos.
//
// A tela transmitida é um CANVAS que se mexe, nunca a tela real de quem roda o teste.
//
// Precisa do LiveKit no ar:  npm run dev:livekit
//
//   node e2e/clipe.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

/** No lugar da tela real: um canvas que muda a cada quadro, para haver vídeo de verdade para gravar. */
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
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `hsl(${(n * 7 + i * 11) % 360} 80% 60%)`;
        ctx.fillRect((n * 17 + i * 151) % 1240, (i * 97 + n * 5) % 680, 90, 60);
      }
    }, 1000 / 30);
    return canvas.captureStream(30);
  };
};

const { browser } = await abrirNavegador();

async function entrar(prefixo) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  vigiar(page);
  page.on('pageerror', (e) => console.log(`  [${prefixo} erro]`, String(e).slice(0, 200)));
  await page.addInitScript(TELA_FALSA);
  const usuario = await criarConta(page, prefixo);
  await dispensarPresentes(page);
  return { page, usuario };
}

const ana = await entrar('ana');
// A ana cria a comunidade para as duas estarem na MESMA, sem depender do estado do banco.
await ana.page.getByRole('button', { name: 'Adicionar comunidade' }).click();
await ana.page.getByText('Criar a minha').click();
await ana.page.getByLabel('Nome da comunidade').fill('Clipe ' + Date.now().toString().slice(-5));
await ana.page.locator('.dialog .btn-primary').click();
await ana.page.locator('.channel-list').waitFor({ timeout: 20000 });

await ana.page.locator('button[aria-label="Configurações"]').first().click();
await ana.page.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
await ana.page.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
const convite = (await ana.page.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.page.locator('.invite-row code').first().innerText());
await ana.page.keyboard.press('Escape');
ok(`a ana criou a comunidade (convite ${convite})`);

const bia = await entrar('bia');
// A bia entra na comunidade da ana pelo código — é o caminho de verdade, e deixa as duas na mesma
// sala sem o teste depender do que já existe no banco.
await bia.page.getByRole('button', { name: 'Adicionar comunidade' }).click();
await bia.page.getByText('Entrar com um convite').click();
await bia.page.getByLabel('Código de convite').fill(convite.trim());
await bia.page.locator('.dialog .btn-primary').click();
await bia.page.locator('.channel-list').waitFor({ timeout: 20000 });
ok('a bia entrou na mesma comunidade');

for (const quem of [ana, bia]) {
  await quem.page.locator('.rail-list .rail-item').last().click();
  await quem.page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await quem.page.locator('.stage-controls').waitFor({ timeout: 30000 });
}
ok('as duas estão na mesma sala de voz');

// ---------- a ana transmite ----------
await ana.page.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
await ana.page.locator('.screenshare-option').first().click();
await ana.page.locator('.stage-main video').first().waitFor({ timeout: 25000 });
ok('a ana está transmitindo');

// ---------- a bia abre a transmissão ----------
const convite_ = bia.page.locator('.stream-invite');
if ((await convite_.count()) > 0) {
  await convite_.getByRole('button').first().click();
}
await bia.page.locator('.stage-main video, .stage video').first().waitFor({ timeout: 25000 });
ok('a bia abriu a transmissão e está vendo');

// ---------- clicar CEDO DEMAIS tem de dizer alguma coisa ----------
//
// Este é o caminho que mais se parece com "cliquei e não aconteceu nada": antes, a tesoura ficava
// desabilitada enquanto a gravação juntava os primeiros segundos, e botão apagado é a forma mais
// educada de não responder. O aviso precisa estar VISÍVEL, e não só existir — a primeira versão
// dele era um parágrafo solto no fim do body, desenhado fora da tela.
await bia.page.locator('.mais-anchor > button').first().click();
await bia.page.waitForTimeout(300);
const cedo = bia.page.locator('.mais-menu button[aria-label*="Clipar"], .mais-menu button[aria-label*="Gravando"]').first();
if ((await cedo.count()) > 0 && !(await cedo.isDisabled())) {
  await cedo.click();
  await bia.page.waitForTimeout(600);
  const quantos = await bia.page.locator('.clipe-aviso').count();
  const visivel = quantos ? await bia.page.locator('.clipe-aviso').first().isVisible() : false;
  const texto = quantos ? await bia.page.locator('.clipe-aviso').first().innerText() : '';
  quantos && visivel
    ? ok(`clicar cedo demais mostra um aviso visível: ${JSON.stringify(texto)}`)
    : falhou('clicar cedo demais não mostrou nada — é o sintoma de novo');
  await bia.page.screenshot({ path: 'e2e/fotos/clipe-aviso-cedo.png' });
} else {
  console.log('  (a tesoura já estava pronta; o caminho do aviso não foi exercitado)');
}
await bia.page.keyboard.press('Escape');

// A gravação em rolagem precisa de alguns segundos guardados antes de o botão acender.
await bia.page.waitForTimeout(8000);

// ---------- a bia clipa ----------
await bia.page.locator('.mais-anchor > button').first().click();
await bia.page.waitForTimeout(500);

const tesoura = bia.page.locator('.mais-menu button[aria-label*="Clipar"], .mais-menu button[aria-label*="Gravando"]').first();
if ((await tesoura.count()) === 0) {
  falhou('a tesoura não apareceu no menu — sem ela não há o que clicar');
} else {
  const rotulo = await tesoura.getAttribute('aria-label');
  const desligada = await tesoura.isDisabled();
  console.log(`  tesoura: "${rotulo}" ${desligada ? '(DESABILITADA)' : '(clicável)'}`);

  // ESTE É O PONTO. Uma tesoura desabilitada não faz nada ao clique, e não dá explicação nenhuma —
  // é indistinguível de um botão quebrado para quem está do outro lado.
  !desligada
    ? ok('depois de oito segundos de transmissão, a tesoura está clicável')
    : falhou('a tesoura continua desabilitada: clicar nela não faz nada e não diz por quê');

  if (!desligada) {
    await tesoura.click();
    await bia.page.waitForTimeout(4000);

    const dialogo = await bia.page.locator('.clipe-dialog').count();
    const erro = await bia.page.locator('.clipe-erro').count();
    const textoDoErro = erro ? await bia.page.locator('.clipe-erro').first().innerText() : '';
    console.log(`  depois do clique: diálogo=${dialogo} erro=${erro} ${textoDoErro}`);

    dialogo === 1 ? ok('a prévia do clipe abriu') : falhou(`a prévia não abriu${textoDoErro ? ` — disse: ${textoDoErro}` : ' e não disse nada'}`);

    if (dialogo === 1) {
      const video = await bia.page.locator('.clipe-video').count();
      video === 1 ? ok('e tem vídeo dentro dela') : falhou('a prévia abriu sem vídeo');
      await bia.page.screenshot({ path: 'e2e/fotos/clipe-previa.png' });
    }
  }
}

await bia.page.screenshot({ path: 'e2e/fotos/clipe-menu.png' });
await browser.close();
resumo('a tesoura, com transmissão de verdade');
