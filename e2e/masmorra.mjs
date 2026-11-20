// A MASMORRA DA TOCA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - O Leo abre a Masmorra pela seção Solo do computador: a sala de entrada, com o coelho e os corações.
// - Anda com as setas (o coelho sai do lugar, e o servidor aceita a posição: o quadro a devolve) e bate com a pá.
// - O piloto automático do site de desenvolvimento (window.masmorraPilotoAutomatico) atravessa a masmorra contra o servidor:
//   o salão, o baú com a cenoura, os botões com o bloco, o cristal que levanta a ponte, a chave, a porta trancada e o rei.
// - No fim, "Vitória!" e o placar.
//
//   SITE=http://localhost:5302 node e2e/masmorra.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.masmorra').first().screenshot({ path: path.join(FOTOS, `masmorra-${nome}.png`) });
const teste = (pagina) => pagina.evaluate(() => window.masmorraDoTeste ?? null);

const { browser } = await abrirNavegador();
try {
  const leo = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(leo, 'leo' + s);
  await dispensarPresentes(leo);
  await leo.locator('.rail-logo').click();
  const quarto = await (await leo.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await leo.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await leo.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = leo.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Masmorra da Toca' }).click();
  // Desde 19/11/2026, a escolha da masmorra vem antes da partida: a toca de sempre (este teste anda por ela).
  await leo.locator('.corrida-pista-botao', { hasText: 'Toca do rei-cogumelo' }).click();
  await leo.locator('.masmorra-tela canvas').waitFor({ timeout: 15000 });
  await leo.waitForFunction(() => window.masmorraDoTeste?.fase === 'jogando', null, { timeout: 15000 });
  const inicio = await teste(leo);
  inicio.sala === 0 && inicio.hp === 5 ? ok('no quarto, sem chamada, a masmorra abriu na entrada, com os cinco corações') : falhou(`começo: ${JSON.stringify(inicio)}`);
  await leo.waitForTimeout(800);
  await foto(leo, 'entrada');

  // andar e bater
  await leo.keyboard.down('ArrowUp');
  await leo.waitForTimeout(600);
  await leo.keyboard.up('ArrowUp');
  await leo.keyboard.down('ArrowRight');
  await leo.waitForTimeout(300);
  await leo.keyboard.up('ArrowRight');
  await leo.keyboard.press('x');
  await leo.waitForTimeout(120);
  await foto(leo, 'golpe');
  const andou = await teste(leo);
  andou.y < inicio.y - 50 && andou.x > inicio.x + 20 ? ok(`as setas andam (${Math.round(inicio.x)},${Math.round(inicio.y)} → ${Math.round(andou.x)},${Math.round(andou.y)})`) : falhou(`não andou: ${JSON.stringify(andou)}`);

  // o piloto atravessa a masmorra
  const doServidor = await teste(leo);
  Math.hypot(doServidor.servidor[0] - doServidor.x, doServidor.servidor[1] - doServidor.y) < 30
    ? ok('o servidor aceitou a posição do coelho')
    : falhou(`o servidor vê o coelho noutro lugar: ${JSON.stringify(doServidor)}`);
  await leo.evaluate(() => (window.masmorraPilotoAutomatico = true));
  await leo.waitForFunction(() => window.masmorraDoTeste?.sala !== 0, null, { timeout: 30000 }).catch(async () => {
    throw new Error(`o piloto não saiu da entrada: ${JSON.stringify(await teste(leo))}`);
  });
  const fotos = new Set();
  const vistos = new Set([0]);
  const limite = Date.now() + 6 * 60_000;
  let ultimo = null;
  while (Date.now() < limite) {
    ultimo = await teste(leo);
    if (!ultimo || ultimo.fase !== 'jogando') break;
    vistos.add(ultimo.sala);
    // uma foto de cada sala, com os bichos ainda de pé quando houver
    if (!fotos.has(ultimo.sala) && (ultimo.bichos > 0 || [2, 4].includes(ultimo.sala))) {
      fotos.add(ultimo.sala);
      await leo.waitForTimeout(700);
      await foto(leo, `sala-${ultimo.sala}`);
    }
    if (ultimo.sala === 4 && ultimo.ponte && !fotos.has('ponte')) {
      fotos.add('ponte');
      await foto(leo, 'ponte');
    }
    await leo.waitForTimeout(250);
  }
  [0, 1, 2, 3, 4, 5, 6].every((k) => vistos.has(k)) ? ok(`o piloto passou pelas sete salas (${[...vistos].join(', ')})`) : falhou(`salas: ${[...vistos].join(', ')}; agora ${JSON.stringify(ultimo)}`);
  ultimo?.cenoura && ultimo?.ponte ? ok('achou a cenoura no baú e levantou a ponte com ela') : falhou(`itens: ${JSON.stringify(ultimo)}`);
  ultimo?.fase === 'vitoria' ? ok('o rei-cogumelo caiu: vitória, decidida pelo servidor') : falhou(`fim: ${JSON.stringify(ultimo)}`);
  await foto(leo, 'vitoria');
  await leo.locator('.minijogo-fim').waitFor({ timeout: 15000 });
  (await leo.getByText('Vitória!').count()) > 0 ? ok('no fim, "Vitória!" e o placar') : falhou('o fim não disse a vitória');
  await foto(leo, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'masmorra-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('masmorra da toca');
}
