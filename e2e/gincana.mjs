// A GINCANA DA TOCA NO SOLO (06/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre a Gincana pela seção Solo do computador: a escolha dos três percursos (de lado), escolhe o primeiro e começa.
// - A contagem; anda para o lado até cair do mapa: volta à largada, piscando, e o painel conta a queda.
// - O piloto automático do site de desenvolvimento (window.gincanaPilotoAutomatico) termina o percurso; os comandos vão ao
//   servidor, que refaz o percurso, e a tela diz "Novo recorde!" com o tempo DELE (igual ao da tela).
//
//   SITE=http://localhost:5187 node e2e/gincana.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.gincana').first().screenshot({ path: path.join(FOTOS, `gincana-${nome}.png`) });

const { browser } = await abrirNavegador();
try {
  const lia = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(lia, 'lia' + s);
  await dispensarPresentes(lia);
  await lia.locator('.rail-logo').click();
  const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await lia.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Gincana da toca' }).click();
  await lia.locator('.gincana-escolha').waitFor({ timeout: 10000 });
  (await lia.locator('.gincana-percurso').count()) === 3 ? ok('no quarto, sem chamada, a Gincana abriu na escolha dos três percursos') : falhou('sem os três percursos');
  await foto(lia, 'escolha');
  await lia.getByRole('button', { name: 'Começar' }).click();
  await lia.locator('.gincana-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  ok('o percurso em 3D abriu');
  await lia.waitForTimeout(700);
  await foto(lia, 'largada');
  await lia.waitForFunction(() => (window.gincanaDoTeste?.passo ?? 0) > 0, null, { timeout: 10000 });

  // andar para a frente um pouco, e depois para o lado até cair do mapa
  await lia.keyboard.down('ArrowUp');
  await lia.waitForTimeout(700);
  await foto(lia, 'andando');
  await lia.keyboard.up('ArrowUp');
  await lia.keyboard.down('ArrowLeft');
  await lia.waitForFunction(() => (window.gincanaDoTeste?.y ?? 0) < -2, null, { timeout: 10000 });
  await foto(lia, 'caindo');
  await lia.waitForFunction(() => (window.gincanaDoTeste?.quedas ?? 0) >= 1, null, { timeout: 10000 });
  await lia.keyboard.up('ArrowLeft');
  const volta = await lia.evaluate(() => ({ z: window.gincanaDoTeste.z, pisca: window.gincanaDoTeste.pisca }));
  volta.z === 2 && volta.pisca > 0 ? ok('caiu do mapa e voltou à largada, piscando') : falhou(`depois da queda: ${JSON.stringify(volta)}`);
  await lia.waitForTimeout(250);
  (await lia.locator('.gincana-quedas').count()) > 0 ? ok('o painel conta a queda') : falhou('o painel não mostra a queda');

  await lia.evaluate(() => (window.gincanaPilotoAutomatico = true));
  await lia.waitForFunction(() => (window.gincanaDoTeste?.posto ?? 0) >= 1, null, { timeout: 60000 });
  await foto(lia, 'bandeira');
  await lia.waitForFunction(() => (window.gincanaDoTeste?.z ?? 0) > 70, null, { timeout: 60000 });
  await foto(lia, 'meio');
  await lia.locator('.gincana-fim-solo').waitFor({ timeout: 120_000 });
  const daTela = await lia.evaluate(() => Math.round((window.gincanaDoTeste.chegouEm * 1000) / 60));
  const doServidor = await lia.locator('.gincana-fim-solo .gincana-tempo.grande').innerText();
  const ms = (txt) => {
    const [m, resto] = txt.includes(':') ? txt.split(':') : ['0', txt];
    return Math.round((Number(m) * 60 + Number(resto.replace(',', '.'))) * 1000);
  };
  Math.abs(ms(doServidor) - daTela) < 15 ? ok(`o servidor refez o percurso: ${doServidor}`) : falhou(`a tela tinha ${daTela} ms e o servidor deu ${doServidor}`);
  (await lia.getByText('Novo recorde!').count()) > 0 ? ok('no fim, "Novo recorde!"') : falhou('o fim não disse o recorde');
  (await lia.getByText('Quedas: 1').count()) > 0 ? ok('e conta a queda') : falhou('sem a contagem das quedas');
  await foto(lia, 'fim');
  // de novo, o recorde aparece na escolha
  await lia.getByRole('button', { name: 'Correr contra' }).click();
  await lia.locator('.gincana-escolha').waitFor();
  (await lia.getByText('Seu recorde:').count()) > 0 ? ok('na escolha, o recorde do percurso') : falhou('a escolha não mostra o recorde');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'gincana-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('gincana da toca');
}
