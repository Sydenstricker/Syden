// A MÚSICA DOS JOGOS (20/11/2026): na Corrida dos coelhos (Solo), a trilha só toca com a corrida rodando, nunca na largada,
// para na pausa (Esc) e no silenciar do cabeçalho, e o arquivo só é baixado quando a corrida começa. Sem erro no console.
//
//   API=http://localhost:3112 SITE=http://localhost:5212 node e2e/musica-dos-jogos.mjs
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
const contexto = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const p = vigiar(await contexto.newPage());
const erros = [];
p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
p.on('pageerror', (e) => erros.push(String(e)));
const baixadas = [];
p.on('request', (r) => r.url().includes('/musica/') && baixadas.push(r.url()));
const tocando = () => p.evaluate(() => (window.musicaDosJogos ? window.musicaDosJogos() : 'sem-sonda'));
const esperar = async (quero, ms = 4000) => {
  const ate = Date.now() + ms;
  let v;
  while (Date.now() < ate) {
    v = await tocando();
    if (v === quero) return v;
    await p.waitForTimeout(150);
  }
  return v;
};

try {
  await cadastrar(p, 'musica' + s);
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Corrida dos coelhos' }).click();
  await p.locator('.corrida-largada').waitFor({ timeout: 10000 });

  const foco = await p.evaluate(() => document.hasFocus());
  (await tocando()) === null ? ok('na largada, nenhuma música') : falhou(`na largada tocava: ${await tocando()}`);
  baixadas.length === 0 ? ok('e o arquivo ainda não foi baixado') : falhou(`baixou antes: ${baixadas}`);

  await p.locator('.corrida-largada .btn-primary').click();
  await p.locator('.corrida-tela canvas').waitFor();
  if (!foco) ok('(o navegador de teste está sem foco: a música não pode tocar, só a regra foi conferida)');
  else {
    (await esperar('corrida')) === 'corrida' ? ok('com a corrida rodando, toca a trilha da corrida') : falhou(`na corrida: ${await tocando()}`);
    baixadas.some((u) => u.endsWith('junkala-level-1.ogg')) ? ok('o arquivo foi baixado ao começar') : falhou(`baixadas: ${baixadas}`);
    await p.waitForTimeout(1500);

    await p.keyboard.press('Escape');
    (await esperar(null)) === null ? ok('na pausa, ela para') : falhou(`na pausa: ${await tocando()}`);
    await p.keyboard.press('Escape');
    (await esperar('corrida')) === 'corrida' ? ok('e volta ao continuar') : falhou(`depois da pausa: ${await tocando()}`);

    const silenciar = p.locator('button[aria-pressed][aria-label="Silenciar"]');
    if (await silenciar.count()) {
      await silenciar.first().click();
      (await esperar(null)) === null ? ok('o silenciar do cabeçalho cala a música') : falhou(`no mudo: ${await tocando()}`);
      await silenciar.first().click();
      (await esperar('corrida')) === 'corrida' ? ok('e ligar de novo a traz de volta') : falhou(`depois do mudo: ${await tocando()}`);
    } else ok('(sem o botão de silenciar neste painel)');
  }

  await p.evaluate(() => (window.corridaPilotoAutomatico = true));
  await p.locator('.corrida-fim').waitFor({ timeout: 120000 });
  (await esperar(null)) === null ? ok('no placar da chegada, nenhuma música') : falhou(`no placar: ${await tocando()}`);

  const deVerdade = erros.filter((e) => !/favicon|ERR_ABORTED|livekit/i.test(e));
  deVerdade.length === 0 ? ok('sem erro no console') : falhou('erros no console:\n' + deVerdade.join('\n'));
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('musica-dos-jogos');
}
