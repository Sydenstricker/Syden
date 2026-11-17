// O RINGUE DA TOCA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A Duda abre o Ringue pela seção Solo do computador: o primeiro adversário entra, e o gongo.
// - A seta para a esquerda esquiva, o Z soca (a luta do site responde às teclas).
// - Fotos do aviso com o brilho na luva, e do adversário aberto depois da esquiva.
// - O piloto automático do site de desenvolvimento (window.ringuePilotoAutomatico) lê os avisos e luta o resto do circuito; no
//   fim, os comandos vão ao servidor, que REFAZ o circuito, e a tela diz "Novo recorde!" com as lutas DELE (iguais às da tela).
//
//   node e2e/ringue.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.ringue, .ringue-fim').first().screenshot({ path: path.join(FOTOS, `ringue-${nome}.png`) });

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await duda.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Ringue da Toca' }).click();
  await duda.locator('.ringue-tela').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, o Ringue começou sozinho');
  await duda.waitForTimeout(800);
  await foto(duda, 'apresentacao');

  // o gongo, e as teclas: a seta esquiva, o Z soca
  await duda.waitForFunction(() => window.ringueDoTeste?.fase === 'luta', null, { timeout: 15000 });
  await duda.waitForFunction(() => ['pronto', 'guarda'].includes(window.ringueDoTeste.j.estado), null, { timeout: 5000 });
  await duda.keyboard.press('ArrowLeft');
  (await duda.waitForFunction(() => window.ringueDoTeste.j.estado === 'esquiva' && window.ringueDoTeste.j.lado === -1, null, { timeout: 2000 }).then(() => true, () => false))
    ? ok('a seta para a esquerda esquivou para a esquerda')
    : falhou('a seta não esquivou');
  await duda.waitForFunction(() => window.ringueDoTeste.j.estado === 'pronto', null, { timeout: 3000 });
  await duda.keyboard.press('z');
  (await duda.waitForFunction(() => window.ringueDoTeste.j.estado === 'socando' || window.ringueDoTeste.j.estado === 'atingido', null, { timeout: 2000 }).then(() => true, () => false))
    ? ok('o Z soltou o soco')
    : falhou('o Z não socou');

  // a foto do brilho na luva (sem o piloto, que interromperia o golpe na hora), e o piloto luta o resto
  await duda.waitForFunction(
    () => {
      const a = window.ringueDoTeste.a;
      return a.estado === 'aviso' && a.golpe?.brilho && a.t >= a.golpe.brilho[0] + 1 && a.t <= a.golpe.brilho[1];
    },
    null,
    { timeout: 30000, polling: 16 },
  );
  await foto(duda, 'brilho');
  ok('um aviso com o brilho na luva');
  await duda.evaluate(() => (window.ringuePilotoAutomatico = true));
  await duda.waitForFunction(() => window.ringueDoTeste.a.estado === 'atordoado' || window.ringueDoTeste.a.estado === 'aberto', null, { timeout: 30000, polling: 16 });
  await foto(duda, 'aberto');
  await duda.waitForFunction(() => window.ringueDoTeste.queda === 'adversario' && window.ringueDoTeste.contagem >= 1, null, { timeout: 60000 });
  await foto(duda, 'queda');
  ok('o adversário caiu, e a contagem começou');
  await duda.waitForFunction(() => window.ringueDoTeste.adv >= 1 && window.ringueDoTeste.fase === 'luta', null, { timeout: 90000 });
  await duda.waitForTimeout(1500);
  await foto(duda, 'segundo');
  ok('venceu o primeiro e enfrenta o segundo');
  await duda.waitForFunction(() => window.ringueDoTeste.adv >= 2 && window.ringueDoTeste.fase === 'luta', null, { timeout: 120000 });
  await duda.waitForTimeout(1500);
  await foto(duda, 'terceiro');

  await duda.locator('.ringue-fim').waitFor({ timeout: 180_000 });
  const daTela = await duda.evaluate(() => window.ringueDoTeste.vencidas);
  const texto = await duda.locator('.ringue-fim-lutas').innerText();
  const doServidor = Number(/(\d)\/3/.exec(texto)?.[1]);
  doServidor === daTela && daTela === 3 ? ok(`o servidor refez o circuito: ${texto}`) : falhou(`a tela tinha ${daTela} e o servidor disse "${texto}"`);
  (await duda.getByText('Novo recorde!').count()) > 0 ? ok('no fim, "Novo recorde!"') : falhou('o fim não disse o recorde');
  await foto(duda, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('ringue da toca');
}
