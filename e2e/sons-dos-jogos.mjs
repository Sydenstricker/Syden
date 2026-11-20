// OS SONS DOS MINI-GAMES (20/11/2026): a Corrida dos coelhos no Solo, com o piloto automático, baixa as amostras da Kenney
// (web/public/sons/) e nenhuma dá erro (nem no console, nem na rede, nem na decodificação).
//
//   SITE=… API=… node e2e/sons-dos-jogos.mjs
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const { browser } = await abrirNavegador({ argsExtras: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const erros = [];
  p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  p.on('pageerror', (e) => erros.push(String(e)));
  const sons = new Map();
  p.on('response', (r) => r.url().includes('/sons/') && sons.set(r.url().split('/sons/')[1], r.status()));
  // conta cada decodificação de áudio e quantas falham
  await p.addInitScript(() => {
    window.__decod = { ok: 0, falhas: 0 };
    const orig = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (...a) {
      return orig.apply(this, a).then(
        (b) => (window.__decod.ok++, b),
        (e) => {
          window.__decod.falhas++;
          throw e;
        },
      );
    };
  });
  await cadastrar(p, 'sons' + Date.now().toString().slice(-5));
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Corrida dos coelhos' }).click();
  await p.locator('.corrida-largada').waitFor({ timeout: 10000 });
  await p.locator('.corrida-largada .btn-primary').click();
  await p.evaluate(() => (window.corridaPilotoAutomatico = true));
  await p.locator('.corrida-fim').waitFor({ timeout: 150000 });
  await p.waitForTimeout(1500);
  const decod = await p.evaluate(() => window.__decod);
  const baixados = [...sons.entries()];
  console.log('amostras pedidas:', baixados.map(([f, s]) => `${f}=${s}`).join(' '));
  console.log('decodificadas:', JSON.stringify(decod));
  if (!baixados.length) falhou('nenhuma amostra foi pedida');
  else if (baixados.some(([, s]) => s !== 200 && s !== 304)) falhou('amostra com erro de rede');
  else ok(`${baixados.length} amostras baixadas`);
  if (decod.falhas) falhou(`${decod.falhas} amostras não decodificaram`);
  else if (decod.ok) ok(`${decod.ok} amostras decodificadas`);
  else falhou('nenhuma decodificação');
  const relevantes = erros.filter((e) => !/livekit|favicon|WebSocket|ERR_CONNECTION/i.test(e));
  if (relevantes.length) falhou('erros no console: ' + relevantes.join(' | '));
  else ok('nenhum erro no console');
} catch (e) {
  falhou(String(e?.stack ?? e));
} finally {
  await browser.close();
  resumo('sons-dos-jogos');
}
