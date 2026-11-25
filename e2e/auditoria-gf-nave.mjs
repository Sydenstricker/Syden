// AUDITORIA DE GAME FEEL: A ESQUADRILHA DA TOCA, 25/11/2026. Só olha: não mexe no jogo.
//
// A Duda abre a Esquadrilha pelo computador do quarto (Solo, fase escolhida por FASE=, de fábrica a Horta) e liga o piloto
// automático (window.navePilotoAutomatico). As folhas saem dos momentos que o placar da tela denuncia:
//   - pontos: "Pontos: n" sobe (inimigo derrubado, item, raspão); `salto`: sobe 500 ou mais de uma vez (o chefe)
//   - levou: uma vida a menos;  bomba: uma bomba a menos (o piloto solta quando fica encurralado)
//   - fim: a tela do fim aparece (a folha é o que veio antes: o chefe caindo)
// Mais um trecho seguido. Fotos em e2e/fotos/auditoria-gf/nave-*.png.
//
//   node e2e/auditoria-gf-nave.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { abrirNoSolo, FOTOS, momentos, salvar, trecho } from './auditoria-gf-comum.mjs';

const FASE = process.env.FASE ?? 'Horta';
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'gfnave' + s);
  await dispensarPresentes(duda);
  await abrirNoSolo(duda, 'Esquadrilha da toca');
  await duda.locator('.corrida-pista-botao', { has: duda.locator('strong', { hasText: new RegExp(`^${FASE}$`) }) }).click();
  await duda.locator('.nave-tela').waitFor({ timeout: 15000 });
  await duda.evaluate(() => (window.navePilotoAutomatico = true));
  ok(`a Esquadrilha abriu no Solo (${FASE}), com o piloto`);
  await duda.waitForTimeout(6000);
  salvar('nave-trecho.png', await trecho(duda, { canvas: '.nave-tela', escala: 2, colunas: 8, n: 24, passo: 100 }));
  const r = await momentos(duda, {
    canvas: '.nave-tela',
    escala: 2,
    colunas: 8,
    antes: 8,
    depois: 20,
    ms: 300000,
    gatilhos: [
      { nome: 'pontos', sel: '.nave-topo .golfe-tacadas', modo: 'numero', sinal: 1, vezes: [2, 10] },
      { nome: 'salto', sel: '.nave-topo .golfe-tacadas', modo: 'numero', sinal: 1, minimo: 500, vezes: [1] },
      { nome: 'levou', sel: '.nave-vida', modo: 'contar', sinal: -1, vezes: [1] },
      { nome: 'bomba', sel: '.nave-bomba-icone', modo: 'contar', sinal: -1, vezes: [1] },
      { nome: 'fim', sel: '.nave-fim', modo: 'existe', sinal: 1, vezes: [1] },
      // a barra de vida do chefe no alto da tela (o canto escuro dela em 29,5): aparece quando ele entra, some quando cai
      { nome: 'chefe-entra', sel: '.nave-tela', modo: 'pixel', x: 29, y: 5, cor: [0x2b, 0x26, 0x33], sinal: 1, vezes: [1] },
      { nome: 'chefe-sai', sel: '.nave-tela', modo: 'pixel', x: 29, y: 5, cor: [0x2b, 0x26, 0x33], sinal: -1, vezes: [1, 2, 3, 4] },
    ],
  });
  for (const f of r.prontas) {
    salvar(`nave-${f.nome}-${f.vez}.png`, f.png);
    ok(`${f.nome} #${f.vez}: ${f.antesDele} → ${f.valor} (${f.n} quadros)`);
  }
  console.log('contagem em', r.segundos, 's:', JSON.stringify(r.conta));
  if (await duda.locator('.nave-fim').count()) await duda.locator('.nave-fim').screenshot({ path: path.join(FOTOS, 'nave-fim.png') });
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('auditoria game feel: esquadrilha');
}
