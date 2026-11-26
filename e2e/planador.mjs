// O PLANADOR DA TOCA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre o Planador pela seção Solo do computador, escolhe a asa-delta e começa: o chão em perspectiva, a contagem.
// - Segura ↑ (mergulho) até o chão: bate, a tela diz "Pouso forte demais!", e o servidor confirma a batida (só os anéis).
// - De novo, com o piloto automático do site de desenvolvimento (window.planadorPilotoAutomatico): passa pelos anéis e pousa
//   no alvo; os comandos vão ao servidor, que refaz o voo, e a tela diz "Novo recorde!" com os pontos DELE (iguais aos da tela).
// - Depois a mochila a jato e o paraquedas, também com o piloto automático, cada um com o seu recorde.
//
//   node e2e/planador.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.planador').first().screenshot({ path: path.join(FOTOS, `planador-${nome}.png`) });

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
  await lia.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Planador da toca' }).click();
  await lia.locator('.planador-desafios').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, o Planador abriu na escolha do desafio');
  await lia.locator('.planador-desafio', { hasText: 'Asa-delta' }).first().click(); // cinco níveis de asa desde 19/11
  await foto(lia, 'escolha');
  await lia.getByRole('button', { name: /Começar/ }).click();
  await lia.locator('.planador-tela').waitFor({ timeout: 10000 });
  await lia.waitForTimeout(1500);
  await foto(lia, 'largada');
  ok('a asa-delta abriu, com a contagem');

  // o mergulho até o chão: batida
  await lia.waitForFunction(() => (window.planadorDoTeste?.passo ?? 0) > 0, null, { timeout: 10000 });
  await lia.keyboard.down('ArrowUp');
  await lia.waitForTimeout(2500);
  await foto(lia, 'mergulho');
  await lia.waitForFunction(() => window.planadorDoTeste?.fim, null, { timeout: 60000 });
  await lia.keyboard.up('ArrowUp');
  await lia.locator('.planador-fim').waitFor({ timeout: 10000 });
  (await lia.locator('.planador-aviso-fim').count()) > 0 ? ok('mergulhando até o chão, bateu, e a tela diz') : falhou('sem o aviso da batida');
  (await lia.getByText('Novo recorde!').count()) === 0 ? ok('a batida sem anel não vira recorde') : falhou('a batida de zero pontos virou recorde');
  await foto(lia, 'batida');

  // de novo, com o piloto automático: os anéis e o alvo
  for (const [nome, rotulo] of [
    ['asa', 'Asa-delta'],
    ['mochila', 'Mochila a jato'],
    ['queda', 'Paraquedas'],
  ]) {
    if (nome === 'asa') await lia.getByRole('button', { name: 'Jogar de novo' }).click();
    else {
      await lia.getByRole('button', { name: 'Correr contra' }).click();
      await lia.locator('.planador-desafio', { hasText: rotulo }).first().click();
      await lia.getByRole('button', { name: /Começar/ }).click();
    }
    await lia.evaluate(() => (window.planadorPilotoAutomatico = true));
    await lia.waitForFunction(() => window.planadorDoTeste && !window.planadorDoTeste.fim && window.planadorDoTeste.passo > 0, null, { timeout: 15000 });
    await lia.waitForTimeout(nome === 'queda' ? 2500 : 9000);
    await foto(lia, `${nome}-voando`);
    if (nome === 'queda') {
      await lia.waitForFunction(() => window.planadorDoTeste.aberto, null, { timeout: 60000 });
      await lia.waitForTimeout(1500);
      await foto(lia, 'queda-aberto');
    }
    await lia.locator('.planador-fim').waitFor({ timeout: 200_000 });
    const daTela = await lia.evaluate(() => window.planadorDoTeste.fim.total);
    const doServidor = Number((await lia.locator('.planador-pontos dd.total').innerText()).split('/')[0]); // "110 / 140" desde as medalhas
    doServidor === daTela ? ok(`${rotulo}: o servidor refez o voo, ${doServidor} pontos`) : falhou(`${rotulo}: a tela tinha ${daTela} e o servidor deu ${doServidor}`);
    const aneis = await lia.evaluate(() => window.planadorDoTeste.pegos === window.planadorDoTeste.d.aneis.length);
    aneis ? ok(`${rotulo}: passou por todos os anéis`) : falhou(`${rotulo}: faltou anel`);
    (await lia.getByText('Novo recorde!').count()) > 0 ? ok(`${rotulo}: "Novo recorde!"`) : falhou(`${rotulo}: o fim não disse o recorde`);
    await foto(lia, `${nome}-fim`);
    await lia.evaluate(() => (window.planadorPilotoAutomatico = false));
  }
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'planador-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('planador da toca');
}
