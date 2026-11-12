// A CORRIDA DOS COELHOS (03/11/2026, degrau 1): contra o relógio, com o fantasma dos amigos, pelo computador do quarto.
//
// - A Bia e a Ana ficam amigas. A Bia corre (com o piloto automático do site de desenvolvimento) e faz o recorde.
// - A Ana abre a corrida: o recorde da Bia aparece em "Correr contra", já marcado. Ela dirige pelo teclado (a tela
//   anda, o relógio corre), e depois o piloto automático termina: a chegada mostra o tempo, as voltas e o recorde.
// - Sem foco na janela, a corrida para (o relógio também).
//
//   node e2e/corrida.mjs   (API de teste na 3099 e site na 5174; o LiveKit não é preciso)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const API = 'http://localhost:3099';

const { browser } = await abrirNavegador();
const pessoa = async () => vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
const pedir = (pagina, metodo, caminho, corpo) =>
  pagina.evaluate(
    async ({ API, metodo, caminho, corpo }) => {
      const r = await fetch(API + caminho, {
        method: metodo,
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), ...(corpo && { 'content-type': 'application/json' }) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return r.json();
    },
    { API, metodo, caminho, corpo },
  );

async function abrirCorrida(p) {
  await p.locator('.rail-logo').click().catch(() => {});
  const quarto = await (await p.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await p.locator('.area-de-trabalho [data-icone="mini-games"]').click(); // a área de trabalho do computador (11/11/2026)
  await p.locator('.jogos-painel .jogos-solo button', { hasText: 'Corrida dos coelhos' }).click();
  await p.locator('.corrida-largada').waitFor({ timeout: 10000 });
}

async function terminarComPiloto(p) {
  await p.evaluate(() => (window.corridaPilotoAutomatico = true));
  await p.locator('.corrida-fim').waitFor({ timeout: 120000 });
  await p.evaluate(() => (window.corridaPilotoAutomatico = false));
}

try {
  const bia = await pessoa();
  await cadastrar(bia, 'bia' + s);
  await dispensarPresentes(bia);
  const ana = await pessoa();
  await cadastrar(ana, 'ana' + s);
  await dispensarPresentes(ana);
  await pedir(ana, 'POST', '/api/amigos', { username: 'bia' + s });
  const anaId = (await pedir(ana, 'GET', '/api/me')).id;
  await pedir(bia, 'POST', `/api/amigos/${anaId}/aceitar`);
  ok('a Ana e a Bia são amigas');

  // ---- A Bia corre e faz o recorde ----
  await abrirCorrida(bia);
  await bia.locator('.corrida-largada').screenshot({ path: path.join(FOTOS, 'corrida-largada-vazia.png') });
  (await bia.getByText('Nenhum amigo correu nesta pista ainda.').count()) ? ok('sem recorde de amigo, a largada diz isso') : falhou('a largada não disse que ninguém correu');
  await bia.locator('.corrida-largada .btn-primary').click();
  await bia.locator('.corrida-tela canvas').waitFor();
  await terminarComPiloto(bia);
  await bia.locator('.corrida-recorde').waitFor({ timeout: 10000 });
  const tempoBia = await bia.locator('.corrida-relogio.grande').innerText();
  ok(`a Bia chegou em ${tempoBia}, com "Novo recorde!"`);
  await bia.locator('.corrida-tela').screenshot({ path: path.join(FOTOS, 'corrida-chegada.png') });

  // ---- A Ana vê o recorde da Bia e corre contra o fantasma ----
  await abrirCorrida(ana);
  const linha = ana.locator('.corrida-fantasmas li', { hasText: 'bia' + s });
  await linha.waitFor({ timeout: 10000 });
  (await linha.locator('input').isChecked()) ? ok('o fantasma da Bia vem marcado') : falhou('o fantasma da Bia não veio marcado');
  (await linha.innerText()).includes(tempoBia) ? ok('com o tempo dela') : falhou(`a linha diz ${await linha.innerText()}, e não ${tempoBia}`);
  await ana.locator('.corrida-largada').screenshot({ path: path.join(FOTOS, 'corrida-largada.png') });
  await ana.locator('.corrida-largada .btn-primary').click();
  await ana.locator('.corrida-tela canvas').waitFor();
  await ana.waitForTimeout(3300);
  await ana.locator('.corrida-tela canvas').screenshot({ path: path.join(FOTOS, 'corrida-largada-semaforo.png') });
  await ana.keyboard.down('ArrowUp');
  await ana.waitForTimeout(2500);
  await ana.keyboard.down('ArrowRight');
  await ana.keyboard.down('Space');
  await ana.waitForTimeout(900);
  await ana.locator('.corrida-tela').screenshot({ path: path.join(FOTOS, 'corrida-derrapando.png') });
  await ana.keyboard.up('Space');
  await ana.keyboard.up('ArrowRight');
  await ana.waitForTimeout(400);
  await ana.locator('.corrida-tela').screenshot({ path: path.join(FOTOS, 'corrida-turbo.png') });
  await ana.keyboard.up('ArrowUp');
  const relogio = await ana.locator('.corrida-placar .corrida-relogio').innerText();
  relogio !== '0:00.00' ? ok(`o relógio anda (${relogio})`) : falhou('o relógio não andou');

  // sem foco, a corrida para
  await bia.bringToFront();
  await ana.evaluate(() => window.dispatchEvent(new Event('blur')));
  const parado1 = await ana.locator('.corrida-placar .corrida-relogio').innerText();
  await ana.waitForTimeout(1200);
  const parado2 = await ana.locator('.corrida-placar .corrida-relogio').innerText();
  const semFoco = await ana.evaluate(() => document.hasFocus());
  if (!semFoco) parado1 === parado2 ? ok('sem foco, o relógio para') : falhou(`sem foco, o relógio andou: ${parado1} → ${parado2}`);
  else ok('(o navegador de teste manteve o foco na aba: a pausa não foi medida)');
  await ana.bringToFront();

  await terminarComPiloto(ana);
  await ana.locator('.corrida-fim .corrida-relogio.grande').waitFor();
  ok(`a Ana chegou em ${await ana.locator('.corrida-relogio.grande').innerText()}`);
  await ana.locator('.corrida-tela').screenshot({ path: path.join(FOTOS, 'corrida-chegada-ana.png') });
  const recordes = (await pedir(ana, 'GET', '/api/corrida/horta-1')).recordes;
  recordes.length === 2 ? ok('os dois recordes estão no servidor, e a Ana vê os dois') : falhou(JSON.stringify(recordes));
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('corrida');
}
