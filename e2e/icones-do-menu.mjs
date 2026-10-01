// O menu de Configurações nunca fica sem ícone — nem quando a animação não carrega.
//
// POR QUE ESTE TESTE EXISTE. Num computador, cinco itens do menu apareceram sem ícone nenhum, e eram
// exatamente os cinco animados. A causa nunca foi reproduzida: o arquivo é o mesmo em produção
// (conferido por md5), a política de segurança libera a busca, e o menu desenha certo tanto no
// servidor de desenvolvimento quanto na build de produção. O que dava para consertar sem reproduzir
// era o SINTOMA — e é isso que este teste tranca.
//
// Ele mede duas vezes: com os arquivos no lugar e com eles bloqueados. Nas duas, todo item do menu
// tem de ter um desenho visível. A segunda metade é a que importa: ela é o computador dele.
//
//   node e2e/icones-do-menu.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ viewport: { width: 1400, height: 950 } });

/** Abre as Configurações e devolve, para cada item do menu, se há desenho visível nele. */
async function medir(bloquearOsIcones) {
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await contexto.newPage();
  vigiar(page);
  if (bloquearOsIcones) await page.route('**/icones/*.json', (rota) => rota.abort());

  await criarConta(page, bloquearOsIcones ? 'icox' : 'ico');
  await dispensarPresentes(page);
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab').first().waitFor({ timeout: 10000 });
  // Tempo para a animação carregar (ou desistir) antes de medir.
  await page.waitForTimeout(2500);

  const itens = await page.evaluate(() =>
    [...document.querySelectorAll('.settings-tab')].map((botao) => {
      const texto = (botao.textContent ?? '').trim();
      // Desenho visível é SVG com área e sem transparência — a animação começa invisível de propósito,
      // e contar o elemento em vez do que ele mostra daria o teste por bom justamente no caso ruim.
      let area = 0;
      for (const svg of botao.querySelectorAll('svg')) {
        let opacidade = 1;
        for (let no = svg; no && no !== botao; no = no.parentElement) {
          opacidade *= Number(getComputedStyle(no).opacity || 1);
        }
        if (opacidade < 0.05) continue;
        const caixa = svg.getBoundingClientRect();
        area += caixa.width * caixa.height;
      }
      return { texto, area: Math.round(area) };
    }),
  );
  await page.screenshot({
    path: `e2e/fotos/icones-do-menu${bloquearOsIcones ? '-sem-animacao' : ''}.png`,
    clip: { x: 0, y: 0, width: 420, height: 700 },
  });
  await contexto.close();
  return itens;
}

for (const [bloquear, rotulo] of [
  [false, 'com os arquivos no lugar'],
  [true, 'com os arquivos bloqueados'],
]) {
  const itens = await medir(bloquear);
  const semDesenho = itens.filter((i) => i.area < 100).map((i) => i.texto);
  console.log(`  ${rotulo}: ${itens.map((i) => `${i.texto}=${i.area}`).join('  ')}`);
  semDesenho.length === 0
    ? ok(`${rotulo}: todos os ${itens.length} itens do menu têm ícone`)
    : falhou(`${rotulo}: sem ícone em ${semDesenho.join(', ')}`);
}

await browser.close();
resumo('os ícones do menu de Configurações');
