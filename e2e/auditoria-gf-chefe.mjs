// AUDITORIA DE GAME FEEL: O CHEFE DA TURMA (a toupeira-rei), 25/11/2026. Só olha: não mexe no jogo.
//
// A Duda abre o Chefe pelo computador do quarto (Solo, Normal, Toupeira-rei) e liga o piloto automático
// (window.chefePilotoAutomatico). As folhas saem dos momentos que o placar da tela denuncia:
//   - acerto: "Dano da turma" sobe (o torrão bateu na toupeira; o número vem do servidor ~ATRASO depois)
//   - levou: um coração a menos no placar (o coelho levou um golpe)
//   - fase: "Fase n de 3" muda (a toupeira trocou de fase: o clarão, o tremor)
//   - bomba: "Bomba de semente pronta" some (a bomba saiu)
//   - fim: o aviso de vitória/derrota aparece na tela
// Mais um trecho de 3 s seguido. Fotos em e2e/fotos/auditoria-gf/chefe-*.png.
//
//   node e2e/auditoria-gf-chefe.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { abrirNoSolo, momentos, salvar, trecho } from './auditoria-gf-comum.mjs';

const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'gfchefe' + s);
  await dispensarPresentes(duda);
  await duda.evaluate(() => localStorage.setItem('syden:chefe-dificil', '0'));
  await abrirNoSolo(duda, 'O chefe da turma');
  await duda.locator('.corrida-pista-botao', { has: duda.locator('strong', { hasText: /^Toupeira-rei$/ }) }).click();
  await duda.locator('.chefe-tela canvas').waitFor({ timeout: 15000 });
  await duda.evaluate(() => (window.chefePilotoAutomatico = true));
  ok('o Chefe abriu no Solo, com o piloto');
  await duda.waitForTimeout(3000);
  salvar('chefe-trecho.png', await trecho(duda, { canvas: '.chefe-tela canvas', n: 24, passo: 130 }));
  const r = await momentos(duda, {
    canvas: '.chefe-tela canvas',
    escala: 1,
    colunas: 4,
    antes: 8,
    depois: 16,
    ms: 150000,
    gatilhos: [
      { nome: 'acerto', sel: '.chefe-topo strong', modo: 'numero', sinal: 1, vezes: [1, 4] },
      { nome: 'levou', sel: '.briga-hud li.eu .briga-vidas', modo: 'comprimento', sinal: -1, vezes: [1] },
      { nome: 'fase', sel: '.chefe-topo > span:first-child', modo: 'numero', sinal: 1, vezes: [1] },
      { nome: 'bomba', sel: '.chefe-mao', modo: 'texto-inclui', texto: 'Bomba de semente', sinal: -1, vezes: [1] },
      // o aviso grande na tela (vitória ou derrota): a folha mostra a toupeira caindo
      { nome: 'fim', sel: '.briga-aviso', modo: 'existe', sinal: 1, vezes: [1] },
    ],
  });
  for (const f of r.prontas) {
    salvar(`chefe-${f.nome}-${f.vez}.png`, f.png);
    ok(`${f.nome} #${f.vez}: ${f.antesDele} → ${f.valor} (${f.n} quadros)`);
  }
  console.log('contagem dos momentos em', r.segundos, 's:', JSON.stringify(r.conta));
  await duda.waitForTimeout(500);
  await duda.locator('.briga.chefe').first().screenshot({ path: 'e2e/fotos/auditoria-gf/chefe-tela.png' });
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('auditoria game feel: chefe');
}
