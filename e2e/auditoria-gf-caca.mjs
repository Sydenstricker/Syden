// AUDITORIA DE GAME FEEL: A CAÇA ÀS PRAGAS DA HORTA, 25/11/2026. Só olha: não mexe no jogo.
//
// A Duda abre a Caça pelo computador do quarto (Solo, "Cinco ondas"), dá um tiro no vazio (o erro), e liga o piloto
// automático (window.cacaPilotoAutomatico). As folhas saem dos momentos que a tela denuncia:
//   - erro: o tiro no céu vazio (o clique do script; a folha é um trecho logo depois dele)
//   - acerto: "Pontos: n" sobe (1º, 6º e 12º acerto: o 4º seguido já é ×2, o 8º ×3)
//   - moita: o placar da onda com o coelho da moita (foto da tela e uma folha do canvas pequeno dele)
// Fotos em e2e/fotos/auditoria-gf/caca-*.png.
//
//   node e2e/auditoria-gf-caca.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { abrirNoSolo, FOTOS, momentos, salvar, trecho } from './auditoria-gf-comum.mjs';

const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'gfcaca' + s);
  await dispensarPresentes(duda);
  await abrirNoSolo(duda, 'Caça às pragas da horta');
  await duda.locator('.corrida-pista-botao', { has: duda.locator('strong', { hasText: /^Cinco ondas$/ }) }).click();
  await duda.locator('.caca-tela').waitFor({ timeout: 15000 });
  ok('a Caça abriu no Solo');
  await duda.waitForTimeout(4500);
  // o erro: um tiro no alto do canto, onde não voa nada; a folha começa no clique
  const caixa = await duda.locator('.caca-tela').boundingBox();
  const folhaErro = trecho(duda, { canvas: '.caca-tela', escala: 0.5, n: 8, passo: 35 });
  await duda.mouse.click(caixa.x + 6, caixa.y + 6);
  salvar('caca-erro.png', await folhaErro);
  await duda.evaluate(() => (window.cacaPilotoAutomatico = true));
  const r = await momentos(duda, {
    canvas: '.caca-tela',
    escala: 0.5,
    colunas: 4,
    antes: 4,
    depois: 20,
    ms: 150000,
    gatilhos: [{ nome: 'acerto', sel: '.caca .golfe-topo .golfe-tacadas', modo: 'numero', sinal: 1, vezes: [1, 6, 12, 25] }],
  });
  for (const f of r.prontas) {
    salvar(`caca-${f.nome}-${f.vez}.png`, f.png);
    ok(`${f.nome} #${f.vez}: ${f.antesDele} → ${f.valor} (${f.n} quadros)`);
  }
  console.log('contagem em', r.segundos, 's:', JSON.stringify(r.conta));
  await duda.locator('.caca-moita').waitFor({ timeout: 90000 });
  salvar('caca-moita.png', await trecho(duda, { canvas: '.caca-moita', escala: 2, n: 16, passo: 150 }));
  await duda.locator('.caca').first().screenshot({ path: path.join(FOTOS, 'caca-placar-da-onda.png') });
  ok('o placar da onda, com o coelho da moita');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('auditoria game feel: caça');
}
