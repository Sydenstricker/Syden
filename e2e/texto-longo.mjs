// O TEXTO LONGO VIRA ARQUIVO, COMO NO DISCORD (12/11/2026; ver textoComoArquivo em web/src/Composer.tsx e TextoAnexado em
// web/src/MessageItem.tsx). Antes, a caixa cortava calada o que passava de 2.000 caracteres. O que o teste prova:
//
// 1. Colar um texto de 3.500 caracteres não o corta: ele vira um .txt na mensagem, e a caixa fica vazia.
// 2. A conversa (de quem manda e de quem recebe) mostra o começo do texto, e o "Ver mais" mostra o resto, inteiro.
// 3. Digitar além do limite mostra a conta em vermelho, e o Enter transforma o texto em arquivo em vez de perdê-lo.
//
//   node e2e/texto-longo.mjs   (API de teste na 3099 e site na 5174)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().click();
  return page;
}

const linhas = Array.from({ length: 70 }, (_, i) => `Linha ${i + 1} do texto longo ${s}: ` + 'é'.repeat(30));
const TEXTO = linhas.join('\n');

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);
  const caixa = ana.locator('.composer textarea');

  await caixa.focus();
  await caixa.evaluate((el, texto) => {
    const dados = new DataTransfer();
    dados.setData('text/plain', texto);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true }));
  }, TEXTO);
  await ana.locator('.composer-file').first().waitFor({ timeout: 5000 });
  const nome = await ana.locator('.composer-file-name').first().textContent();
  (await caixa.inputValue()) === '' && /\.txt$/.test(nome)
    ? ok(`colar ${TEXTO.length} caracteres virou o arquivo ${nome}, sem cortar a caixa`)
    : falhou(`depois de colar: arquivo=${nome}, caixa=${(await caixa.inputValue()).length}`);
  await caixa.press('Enter');

  for (const [quem, page] of [['Ana', ana], ['Bia', bia]]) {
    const previa = page.locator('.attachment-texto').last();
    await previa.locator('.attachment-texto-corpo').waitFor({ timeout: 15000 });
    const antes = await previa.locator('.attachment-texto-corpo').textContent();
    antes.includes('Linha 1 do') && !antes.includes('Linha 70 do')
      ? ok(`${quem} vê o começo do texto na conversa`)
      : falhou(`${quem}: prévia inesperada (${antes.length} caracteres)`);
    await previa.getByRole('button', { name: 'Ver mais' }).click();
    const depois = await previa.locator('.attachment-texto-corpo').textContent();
    depois === TEXTO ? ok(`${quem}: "Ver mais" mostra o texto inteiro, igual ao colado`) : falhou(`${quem}: texto inteiro diferente (${depois.length} de ${TEXTO.length})`);
  }

  await caixa.fill('x'.repeat(2100));
  const conta = ana.locator('.composer-contador');
  (await conta.textContent()) === '2100/2000' && (await conta.getAttribute('class')).includes('passou')
    ? ok('digitar além do limite mostra 2100/2000 em vermelho')
    : falhou(`contador: ${await conta.textContent().catch(() => 'nenhum')}`);
  await caixa.press('Enter');
  await ana.locator('.composer-file').first().waitFor({ timeout: 5000 });
  (await caixa.inputValue()) === '' ? ok('o Enter transformou o texto digitado em arquivo, em vez de perdê-lo') : falhou('o texto ficou na caixa');
  await ana.screenshot({ path: 'e2e/fotos/texto-longo.png' });
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('o texto longo vira arquivo');
}
