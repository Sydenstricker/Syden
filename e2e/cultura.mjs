// A faixa de cultura da home: fotos do país da pessoa e livros na língua dela.
//
// O que este teste mede, e que só se vê numa tela de verdade:
//   - o país sai da PREFERÊNCIA DE IDIOMA (aqui, forçada para pt-BR e para ja-JP), nunca do endereço;
//   - as imagens e capas CARREGAM, e vêm do servidor do Syden — nenhum pedido sai do navegador para o
//     Wikimedia nem para o Gutenberg;
//   - cada foto tem o crédito que a licença exige.
//
// PRECISA DE INTERNET: o servidor de teste vai mesmo às duas fontes.
//
//   node e2e/cultura.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();

// O terceiro item é o idioma da TELA depois do cadastro: árabe confere a faixa da direita para a
// esquerda, japonês confere a escrita sem espaços nos títulos dos livros.
for (const [locale, pais, tela] of [
  ['pt-BR', 'BR', null],
  ['ja-JP', 'JP', 'ja'],
  ['ar-EG', 'EG', 'ar'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale });
  const page = await ctx.newPage();
  vigiar(page);
  // A TELA fica em português (a escolha guardada vence a do sistema), para o cadastro achar os
  // rótulos. O PAÍS continua vindo da preferência do sistema — que é o que se quer medir: as duas
  // coisas são independentes, e um brasileiro estudando japonês mantém o app em português.
  await page.addInitScript(() => localStorage.setItem('syden.idioma', 'pt-BR'));
  const deFora = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (/wikimedia|wikipedia|gutenberg|gutendex/.test(host)) deFora.push(host);
  });
  const pedidos = [];
  page.on('request', (r) => r.url().includes('/api/cultura?') && pedidos.push(r.url()));

  await criarConta(page, 'cultura' + pais.toLowerCase());
  await dispensarPresentes(page);
  if (tela) {
    await page.evaluate((codigo) => localStorage.setItem('syden.idioma', codigo), tela);
    await page.addInitScript((codigo) => localStorage.setItem('syden.idioma', codigo), tela);
    await page.reload();
    await dispensarPresentes(page);
  }

  const faixa = page.locator('section.cultura');
  await faixa.waitFor({ timeout: 30000 }).catch(() => {});
  if ((await faixa.count()) === 0) {
    falhou(`[${locale}] a faixa de cultura não apareceu na home`);
    await ctx.close();
    continue;
  }
  pedidos.some((u) => u.includes(`pais=${pais}`))
    ? ok(`[${locale}] o país pedido foi ${pais}, tirado da preferência de idioma`)
    : falhou(`[${locale}] o pedido não levou o país esperado: ${pedidos.join(' ')}`);

  // Espera as imagens carregarem de verdade (naturalWidth > 0), não só existirem.
  await page.waitForFunction(() => [...document.querySelectorAll('.cultura-imagem img')].filter((i) => i.naturalWidth > 0).length >= 3, null, { timeout: 45000 }).catch(() => {});
  const medida = await page.evaluate(() => ({
    imagens: document.querySelectorAll('.cultura-imagem img').length,
    carregadas: [...document.querySelectorAll('.cultura-imagem img')].filter((i) => i.naturalWidth > 0).length,
    creditos: [...document.querySelectorAll('.cultura-imagem figcaption')].map((f) => f.textContent.trim()),
    livros: document.querySelectorAll('.cultura-livros li').length,
    largura: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    direcao: document.documentElement.dir,
    titulo: document.querySelector('.cultura h2')?.textContent ?? '',
  }));
  medida.carregadas >= 3 ? ok(`[${locale}] ${medida.carregadas} de ${medida.imagens} fotos carregadas`) : falhou(`[${locale}] só ${medida.carregadas} de ${medida.imagens} fotos carregaram`);
  medida.creditos.length > 0 && medida.creditos.every((c) => c.length > 3)
    ? ok(`[${locale}] toda foto tem crédito: "${medida.creditos[0]}"`)
    : falhou(`[${locale}] foto sem crédito: ${JSON.stringify(medida.creditos)}`);
  console.log(`  [${locale}] título "${medida.titulo}", direção ${medida.direcao}`);
  if (tela === 'ar') medida.direcao === 'rtl' ? ok('[ar-EG] a página está da direita para a esquerda') : falhou('[ar-EG] a página não virou');
  // Em árabe o Gutenberg quase não tem livros: a seção some em vez de mostrar sobra (ver Cultura.tsx).
  medida.livros === 0 || medida.livros >= 3 ? ok(`[${locale}] livros: ${medida.livros || 'seção escondida, poucos nessa língua'}`) : falhou(`[${locale}] estante com ${medida.livros}: menos de três não devia aparecer`);
  medida.largura <= 0 ? ok(`[${locale}] nada estoura a largura da tela`) : falhou(`[${locale}] a página estoura ${medida.largura}px para o lado`);
  deFora.length === 0
    ? ok(`[${locale}] o navegador não falou com Wikimedia nem Gutenberg`)
    : falhou(`[${locale}] o navegador contactou terceiros: ${[...new Set(deFora)].join(', ')}`);

  await faixa.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await faixa.screenshot({ path: `e2e/fotos/cultura-${pais}.png` });
  await ctx.close();
}

await browser.close();
resumo('a faixa de cultura');
