// A ROTA ESTELAR NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre a Rota Estelar pela seção Solo do computador; a cena 3D abre (com WebGL de verdade) e a contagem acaba.
// - Voa um pouco pelas setas, atira (a bala sai), segura o tiro e a carga enche, gira.
// - O piloto automático do site de desenvolvimento (window.estelarPilotoAutomatico) faz a rota inteira até o polvo de lata;
//   os eventos vão ao servidor, que confere cada um, e a tela diz "Vitória!" e "Novo recorde!" com os pontos DELE (iguais
//   aos da tela).
//
// - Desde 24/11/2026 a largada pede a rota: ROTA=gelo voa a rota do gelo (a nave-mãe no fim); sem ele, a do planeta.
//
//   SITE=http://localhost:5307 node e2e/estelar.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').first().screenshot({ path: path.join(FOTOS, `estelar-${nome}.png`) });

// SEM_CORS=1: quando o site de teste roda numa porta que a API de teste não lista em CORS_ORIGIN (agentes em paralelo)
const { browser } = await abrirNavegador({ argsExtras: process.env.SEM_CORS ? ["--disable-web-security"] : [] });
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
  await painel.locator('.jogos-solo button', { hasText: 'Rota Estelar' }).click();
  // a escolha da rota abre fora do painel da estante
  await lia.locator('.corrida-pista-botao', { hasText: process.env.ROTA === 'gelo' ? 'Rota do gelo' : 'Rota do planeta' }).click();
  await lia.locator('.estelar-caixa:not(.escondida)').waitFor({ timeout: 40000 });
  ok('no quarto, sem chamada, a Rota Estelar abriu a cena 3D');
  await lia.waitForFunction(() => (window.estelarDoTeste?.passo ?? -1) > 5, null, { timeout: 15000 });
  await foto(lia, 'largada');

  // voar, atirar, carregar, girar
  const x0 = await lia.evaluate(() => window.estelarDoTeste.nave.x);
  await lia.keyboard.down('ArrowRight');
  await lia.waitForTimeout(600);
  await lia.keyboard.up('ArrowRight');
  const x1 = await lia.evaluate(() => window.estelarDoTeste.nave.x);
  x1 > x0 + 2 ? ok(`a seta leva a nave para o lado (${x0} → ${x1})`) : falhou(`a nave não andou: ${x0} → ${x1}`);
  await lia.keyboard.press('KeyZ');
  await lia.waitForFunction(() => window.estelarDoTeste.disparos > 0, null, { timeout: 3000 });
  ok('Z atira');
  await lia.keyboard.down('KeyZ');
  await lia.waitForTimeout(900);
  await foto(lia, 'carga');
  (await lia.locator('.estelar-carga').count()) > 0 ? ok('segurando o tiro, a carga aparece') : falhou('sem a barra de carga');
  await lia.keyboard.up('KeyZ');
  await lia.keyboard.press('KeyC');
  await lia.waitForFunction(() => window.estelarDoTeste.piruetaAte > window.estelarDoTeste.passo, null, { timeout: 2000 }).then(
    () => ok('C gira (a pirueta)'),
    () => falhou('a pirueta não começou'),
  );
  await lia.waitForTimeout(250);
  await foto(lia, 'pirueta');

  // o piloto automático faz o resto, e as fotos de cada trecho
  await lia.evaluate(() => (window.estelarPilotoAutomatico = true));
  const fotoNoPasso = async (passo, nome) => {
    await lia.waitForFunction((p) => (window.estelarDoTeste?.passo ?? 0) >= p, passo, { timeout: 200_000 });
    await foto(lia, nome);
  };
  await fotoNoPasso(900, 'planeta');
  await fotoNoPasso(2600, 'jipe');
  await fotoNoPasso(3500, 'subida');
  await fotoNoPasso(3640, 'bifurcacao');
  await fotoNoPasso(4400, 'rota');
  await fotoNoPasso(6700, 'chefe');
  await lia.locator('.estelar-fim').waitFor({ timeout: 120_000 });
  const daTela = await lia.evaluate(() => window.estelarDoTeste.ficha.total(0, true));
  const vitoria = await lia.getByText('Vitória!').count();
  vitoria > 0 ? ok('o polvo de lata caiu: "Vitória!"') : falhou('o fim não disse Vitória');
  (await lia.getByText('Novo recorde!').count()) > 0 ? ok('e "Novo recorde!"') : falhou('o fim não disse o recorde');
  const placar = await lia.locator('.estelar-fim').innerText();
  placar.includes(String(daTela)) ? ok(`o servidor conferiu tudo e chegou aos mesmos pontos: ${daTela}`) : falhou(`a tela tinha ${daTela}, e o placar: ${placar}`);
  /Acertos: \d+%/.test(placar) ? ok('a precisão aparece no fim') : falhou('sem a precisão');
  await foto(lia, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'estelar-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('rota estelar');
}
