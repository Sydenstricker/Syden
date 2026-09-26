// Item 5: a vila é desenhada de trás para a frente, e a estátua troca de coelho.
//
// A ordem é conferida pelo próprio navegador: para cada coisa desenhada, onde ela PISA no chão (o fundo
// da caixa dela) tem que vir depois de quem está mais atrás. E os coelhos, que andam, entram na mesma
// fila — o que mexe no DOM a cada passo, então o teste também confere se eles continuam DESLIZANDO.

import { CONVITE, SITE, abrirNavegador, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
vigiar(page);

const s = Date.now().toString().slice(-5);
await page.goto(SITE);
await page.getByText('Cadastre-se').click();
await page.getByLabel('Nome de usuário').fill('vila' + s);
await page.getByLabel('Senha').fill('segredo123');
await page.getByLabel('Código de convite').fill(CONVITE);
await page.getByRole('button', { name: 'Cadastrar' }).click();
await page.locator('.vila').waitFor({ timeout: 25000 });
await dispensarPresentes(page);
await page.waitForTimeout(1200);

// ---------- 1. ninguém desenhado antes pisa na frente de quem vem depois ----------
const fora = await page.evaluate(() => {
  const cenario = document.querySelector('svg.vila-art .v-cenario');
  // Os coelhos ficam DE FORA desta conferência de propósito. O cenário é ordenado uma vez, na montagem;
  // eles andam o tempo todo, e reordenar o desenho a cada passo cortaria a animação do caminhar. Por isso
  // eles são sempre desenhados por cima — o que também quer dizer que um coelho atrás de uma casa aparece
  // na frente dela. Enquanto os coelhos andarem só no gramado da frente, ninguém vê; se um dia passearem
  // atrás das casas, isto vira um defeito de verdade e aparece aqui.
  const emPe = [...cenario.children].filter(
    (el) => el.getBoundingClientRect().height > 0 && !el.classList.contains('v-coelho'),
  );
  const base = (el) => el.getBoundingClientRect().bottom;
  const problemas = [];
  for (let i = 1; i < emPe.length; i++) {
    const anterior = base(emPe[i - 1]);
    const agora = base(emPe[i]);
    // 8px de folga: sombras e o balanço dos coelhos mexem o pé por alguns pixels.
    if (agora + 8 < anterior) {
      problemas.push({ antes: emPe[i - 1].outerHTML.slice(0, 60), depois: emPe[i].outerHTML.slice(0, 60), de: Math.round(anterior), para: Math.round(agora) });
    }
  }
  return { total: emPe.length, problemas };
});
console.log(`  ${fora.total} coisas em pé na cena`);
fora.problemas.length === 0
  ? ok('cada coisa é desenhada depois de quem está atrás dela')
  : falhou('fora de ordem: ' + JSON.stringify(fora.problemas.slice(0, 3), null, 1));

// ---------- 2. a estátua troca de coelho ----------
const estatua = page.locator('.v-estatua');
await estatua.waitFor({ timeout: 5000 });
(await page.locator('.v-estatua .v-gordo').count()) === 0 ? ok('a estátua começa com o OurBunny') : falhou('começou gorda');

await estatua.hover({ force: true });
await page.waitForTimeout(400);
const dica = await page.locator('.v-estatua-dica').evaluate((el) => ({ opacidade: getComputedStyle(el).opacity, texto: el.textContent }));
console.log('  a dica diz:', JSON.stringify(dica));
Number(dica.opacidade) > 0.9 && dica.texto.includes('BigChunkus')
  ? ok('passando o mouse, ela convida a trocar pelo BigChunkus')
  : falhou('a dica não apareceu: ' + JSON.stringify(dica));

await estatua.click({ force: true });
await page.waitForTimeout(400);
(await page.locator('.v-estatua .v-gordo').count()) === 1 ? ok('clicando, o BigChunkus assume o pedestal') : falhou('não trocou');
await page.screenshot({ path: 'e2e/fotos/vila-bigchunkus.png' });

const guardado = await page.evaluate(() => localStorage.getItem('syden.coelho'));
guardado === 'big' ? ok('a escolha fica guardada neste computador') : falhou('guardou: ' + guardado);

await page.reload();
await page.locator('.vila').waitFor({ timeout: 25000 });
await dispensarPresentes(page);
await page.waitForTimeout(800);
(await page.locator('.v-estatua .v-gordo').count()) === 1 ? ok('e continua lá depois de recarregar') : falhou('voltou ao OurBunny sozinho');

await page.locator('.v-estatua').click({ force: true });
await page.waitForTimeout(300);
(await page.locator('.v-estatua .v-gordo').count()) === 0 ? ok('e dá para voltar ao OurBunny') : falhou('não voltou');

// ---------- 3. plantar continua funcionando com o cenário desenhado por cima do gramado ----------
// O cenário não recebe clique (pointer-events: none), então clicar perto de uma árvore ainda planta.
const alvo = await page.evaluate(() => {
  const svg = document.querySelector('svg.vila-art');
  const chao = svg.querySelector('.v-chao-clicavel');
  const ctm = svg.getScreenCTM();
  // Pontos dentro da ilha, incluindo um em cima da fonte: como o cenário não recebe clique, TODOS
  // deveriam cair na grama. Só um coelho passando na hora pode roubar um deles.
  for (const [x, y] of [
    [600, 380],
    [520, 400],
    [700, 380],
    [640, 340],
  ]) {
    const p = svg.createSVGPoint();
    p.x = x;
    p.y = y;
    const tela = p.matrixTransform(ctm);
    if (document.elementFromPoint(tela.x, tela.y) === chao) return { x: tela.x, y: tela.y, emCima: true };
  }
  return { emCima: false };
});
alvo.emCima ? ok('o clique na grama chega na grama, mesmo com o cenário por cima') : falhou('algo do cenário está roubando o clique');
if (alvo.emCima) await page.mouse.click(alvo.x, alvo.y);
await page.waitForTimeout(200);
(await page.locator('.v-cenoura').count()) === 1 ? ok('e planta uma cenoura') : falhou('não plantou');

// ---------- 4. e a turma vai até ela DESLIZANDO, não pulando ----------
// Um coelho que teletransporta aparece em dois lugares e pronto; um coelho que anda passa por dezenas de
// posições no meio do caminho. É isso que se conta aqui — a troca de ordem no DOM, a cada passo, poderia
// ter quebrado a transição do CSS.
const paradas = await page.evaluate(async () => {
  const vistas = new Map();
  for (let i = 0; i < 25; i++) {
    for (const el of document.querySelectorAll('.v-coelho')) {
      const r = el.getBoundingClientRect();
      const lugares = vistas.get(el) ?? new Set();
      lugares.add(`${Math.round(r.x)},${Math.round(r.y)}`);
      vistas.set(el, lugares);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return [...vistas.values()].map((lugares) => lugares.size).sort((a, b) => b - a);
});
console.log('  posições diferentes por coelho em 2,5 s:', JSON.stringify(paradas));
paradas.some((n) => n >= 5)
  ? ok('os coelhos deslizam até a cenoura (a nova ordem não quebrou a caminhada)')
  : falhou('os coelhos estão aparecendo no destino de uma vez: ' + JSON.stringify(paradas));

await browser.close();
resumo('vila-ordem');
