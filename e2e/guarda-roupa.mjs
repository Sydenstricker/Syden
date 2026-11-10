// A APARÊNCIA EM FICHÁRIO (09/11/2026, o desenho dele): uma tela, duas orelhas.
// - Configurações → Aparência abre na orelha Aplicativo (as paletas e a cor do Syden); as orelhas são abas de verdade
//   (role=tab, aria-selected, as setas do teclado trocam);
// - a orelha Avatar: o personagem grande com as setas do coelho pronto (só mostram; o Salvar guarda, e o "Atual" é a 1ª posição), o bicho do quarto com as
//   setas (Gato / Sem bicho) e o nome dele, a foto recolhida e os enfeites do perfil embaixo;
// - o bicho e o nome chegam ao quarto (o gato some e volta; o nome aparece ao passar o mouse nele);
// - Minha conta, o guarda-roupa do quarto (pixel art e 3D) abrem a orelha Avatar; não há mais entrada "Guarda-roupa" no menu.
//
//   SITE=http://localhost:5174/app/ node e2e/guarda-roupa.mjs   (API de teste; FOTOS= pasta das fotos)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const foto = (p, nome) => p.screenshot({ path: path.join(FOTOS, 'guarda-roupa-' + nome + '.png') });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador({ viewport: { width: 1400, height: 950 } });
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'pt-BR' });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'gr' + s);
  await dispensarPresentes(page);

  const configuracoes = page.locator('[role="dialog"].settings');
  const orelha = (nome) => page.locator('.aparencia-fichario-orelhas [role="tab"]', { hasText: nome });
  const orelhaAberta = async () => (await page.locator('.aparencia-fichario-orelhas [role="tab"][aria-selected="true"]').textContent())?.trim();
  const valor = (rotulo) => page.locator(`.personagem-linha[aria-label="${rotulo}"] .personagem-valor strong`);
  const seta = (rotulo, qual) => page.locator(`.personagem-linha[aria-label="${rotulo}"] .personagem-seta`).nth(qual === '‹' ? 0 : 1);
  const abrirAparencia = async () => {
    await page.locator('button[aria-label="Configurações"]').first().click();
    await configuracoes.waitFor({ timeout: 10_000 });
    await page.locator('.settings-tab', { hasText: /^\s*Aparência\s*$/ }).first().click();
    await page.locator('.aparencia-fichario').waitFor({ timeout: 10_000 });
  };
  // o foco pode ter ficado no iframe do quarto (o Esc iria para ele): clica no título antes
  const fechar = async () => {
    await page.locator('.settings-content h2').first().click().catch(() => {});
    await page.keyboard.press('Escape');
    await configuracoes.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
  };

  // 1. As orelhas
  await abrirAparencia();
  (await page.locator('.settings-tab', { hasText: /Guarda-roupa/ }).count()) === 0
    ? ok('não há mais a entrada "Guarda-roupa" no menu (é a orelha do Avatar)')
    : falhou('a entrada "Guarda-roupa" continua no menu');
  const nomes = (await page.locator('.aparencia-fichario-orelhas [role="tab"]').allTextContents()).map((x) => x.trim());
  JSON.stringify(nomes) === '["Aplicativo","Avatar"]' ? ok('as orelhas: Aplicativo e Avatar') : falhou('orelhas: ' + nomes.join(', '));
  (await orelhaAberta()) === 'Aplicativo' ? ok('a Aparência abre no Aplicativo') : falhou('abriu em ' + (await orelhaAberta()));
  (await page.locator('.paleta-do-syden [role="radio"]').count()) === 4 && (await page.locator('.cor-do-syden').count()) === 1
    ? ok('o Aplicativo tem as paletas e a cor do Syden')
    : falhou('o Aplicativo está incompleto');
  (await page.locator('.aparencia-fichario-folha .personagem, .aparencia-fichario-folha .perfil-previa').count()) === 0
    ? ok('e nada do avatar')
    : falhou('o Aplicativo mostra coisas do avatar');
  await foto(page, 'aplicativo');

  await orelha('Aplicativo').focus();
  await page.keyboard.press('ArrowRight');
  (await orelhaAberta()) === 'Avatar' && (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Avatar'
    ? ok('a seta do teclado passa para a orelha Avatar, com o foco')
    : falhou('a seta do teclado não trocou de orelha');
  (await page.locator('[role="tabpanel"]').getAttribute('aria-labelledby')) === 'orelha-avatar' ? ok('a folha diz de que orelha é') : falhou('a folha sem aria-labelledby');

  // 2. O coelho pelas setas
  const coelho = 'Coelho';
  await valor(coelho).waitFor({ timeout: 10_000 });
  const antes = (await valor(coelho).textContent())?.trim();
  (await page.locator('.personagem-palco img[src*="guarda-roupa/mascote"]').count()) && antes === 'Atual'
    ? ok('sem coelho escolhido, o carrossel começa no "Atual", que é o mascote')
    : console.log('   (a conta já começa com avatar: ' + antes + ')');
  await seta(coelho, '›').click();
  await page.waitForFunction(() => document.querySelector('.personagem-coelho')?.getAttribute('src')?.includes('coelho-01-inteiro'), null, { timeout: 5_000 }).then(
    () => ok('› vai ao coelho 1, de corpo inteiro (a foto de frente refinada)'),
    () => falhou('› não mostrou o coelho 1'),
  );
  await seta(coelho, '‹').click();
  (await valor(coelho).textContent())?.trim() === 'Atual' ? ok('‹ volta ao "Atual"') : falhou('‹ deu ' + (await valor(coelho).textContent()));
  await seta(coelho, '‹').click();
  (await valor(coelho).textContent())?.trim() === '16 / 16' ? ok('‹ dá a volta ao 16') : falhou('‹ deu ' + (await valor(coelho).textContent()));
  await page.waitForTimeout(300);
  const nitido = await page.evaluate(() => {
    const img = document.querySelector('.personagem-coelho');
    return img && img.complete ? { w: img.width / img.naturalWidth, h: img.height / img.naturalHeight, r: getComputedStyle(img).imageRendering } : null;
  });
  // o 16 tem a foto de frente refinada (64 × 152) desde 10/11/2026: inteiro para cima ou divisor inteiro para baixo
  const inteiro = (k) => Number.isInteger(k >= 1 ? k : 1 / k);
  nitido && inteiro(nitido.w) && nitido.w === nitido.h && nitido.r === 'pixelated'
    ? ok(`o desenho do 16 vai em escala inteira (${nitido.w}×), sem suavizar`)
    : falhou('ampliação: ' + JSON.stringify(nitido));
  await seta(coelho, '›').click();
  await seta(coelho, '›').click();
  await seta(coelho, '›').click();
  (await valor(coelho).textContent())?.trim() === '2 / 16' ? ok('› › › passa pelo "Atual" e chega ao 2') : falhou('chegou a ' + (await valor(coelho).textContent()));
  // as setas só mostram: o 2 só vale depois do Salvar
  await page.locator('.personagem-salvar button').click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === '2 / 16 · Atual', null, { timeout: 10_000 }).then(
    () => ok('o Salvar veste o 2, que vira o "Atual"'),
    () => falhou('o Salvar não vestiu o 2'),
  );
  (await page.locator('.personagem-salvar').count()) === 0 ? ok('salvo, o botão some') : falhou('o Salvar continua depois de salvar');

  // 3. O bicho e o nome
  const bicho = 'Bicho do quarto';
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Bicho do quarto"] strong')?.textContent === 'Gato', null, { timeout: 10_000 }).then(
    () => ok('o bicho de fábrica é o gato, com o desenho dele'),
    () => falhou('o bicho de fábrica não é o gato'),
  );
  await page.locator('.personagem-nome input').fill('Mimi');
  await page.locator('.personagem-nome button').click();
  await page.locator('.personagem-nome .form-success').waitFor({ timeout: 5_000 }).then(
    () => ok('o nome do bicho é salvo'),
    () => falhou('o nome do bicho não foi salvo'),
  );
  await foto(page, 'avatar');
  await seta(bicho, '›').click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Bicho do quarto"] strong')?.textContent === 'Sem bicho', null, { timeout: 5_000 }).then(
    () => ok('› troca para Sem bicho'),
    () => falhou('› não trocou para Sem bicho'),
  );
  (await page.locator('.personagem-bicho img').count()) === 0 && (await page.locator('.personagem-nome').count()) === 0
    ? ok('sem bicho, sem desenho e sem o campo do nome')
    : falhou('sem bicho, ainda há desenho ou campo');
  await foto(page, 'sem-bicho');

  // os enfeites continuam embaixo do personagem
  await page.getByRole('tab', { name: 'Fundo do perfil' }).click();
  const vestivel = page.locator('.guarda-roupa-cartao.vestivel').first();
  await vestivel.waitFor({ timeout: 10_000 });
  await vestivel.click();
  await page.locator('.guarda-roupa-cartao.vestido').first().waitFor({ timeout: 10_000 }).then(
    () => ok('os enfeites do perfil continuam na folha do Avatar, e vestir funciona'),
    () => falhou('vestir um fundo não marcou "Em uso"'),
  );
  await page.locator('.personagem-foto summary').click();
  (await page.locator('.personagem-foto .file-picker').count()) ? ok('"Usar uma foto" abre o envio de foto') : falhou('sem o envio de foto');
  await page.locator('.personagem-foto summary').click();
  await fechar();

  // 4. O quarto: o gato sumiu; o coelho escolhido ficou guardado
  await page.locator('#abertura').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  const iframe = page.locator('.quarto-novo iframe');
  await iframe.waitFor({ timeout: 30_000 });
  const frame = await (await iframe.elementHandle()).contentFrame();
  await frame.waitForFunction(() => typeof window.gatoDoTeste === 'function', null, { timeout: 30_000 });
  await frame.waitForFunction(() => window.gatoDoTeste().pet === false, null, { timeout: 10_000 }).then(
    () => ok('"Sem bicho" tira o gato do quarto aberto'),
    () => falhou('o gato continua no quarto'),
  );

  await page.reload();
  await page.locator('.rail-list').first().waitFor({ timeout: 20_000 });
  await page.locator('#abertura').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  await abrirAparencia();
  await orelha('Avatar').click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === '2 / 16 · Atual', null, { timeout: 10_000 }).then(
    () => ok('depois de recarregar, o coelho 2 continua escolhido'),
    () => falhou('o coelho escolhido não ficou'),
  );
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Bicho do quarto"] strong')?.textContent === 'Sem bicho', null, { timeout: 10_000 }).then(
    () => ok('e o "Sem bicho" também'),
    () => falhou('o "Sem bicho" não ficou'),
  );
  await seta(bicho, '‹').click();
  await page.locator('.personagem-nome input').waitFor({ timeout: 5_000 });
  (await page.locator('.personagem-nome input').inputValue()) === 'Mimi' ? ok('o gato volta com o nome guardado') : falhou('o nome não voltou');
  await page.waitForTimeout(800);
  await fechar();

  // 5. No quarto: o gato de volta, e o nome ao passar o mouse nele
  const frame2 = await (await page.locator('.quarto-novo iframe').elementHandle()).contentFrame();
  await frame2.waitForFunction(() => typeof window.gatoDoTeste === 'function' && window.gatoDoTeste().pet === true, null, { timeout: 15_000 }).then(
    () => ok('o gato voltou ao quarto'),
    () => falhou('o gato não voltou ao quarto'),
  );
  (await frame2.evaluate(() => window.retratoDoTeste().nomeDoPet)) === 'Mimi' ? ok('a arrumação do quarto tem o nome dele') : falhou('o quarto não tem o nome');
  // parado onde está, para o mouse o achar
  await frame2.evaluate(() => window.gatoDoTeste({ caminho: [], anim: null, pulo: null }));
  await page.waitForTimeout(500);
  const caixaDoIframe = await page.locator('.quarto-novo iframe').boundingBox();
  const pontos = await frame2.evaluate(() => {
    const g = window.gatoDoTeste();
    const p = window.pontoDoTeste(g.u, g.v);
    const tela = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const r = tela.getBoundingClientRect();
    const sx = r.width / tela.width, sy = r.height / tela.height;
    const x0 = Array.isArray(p) ? p[0] : p.x, y0 = Array.isArray(p) ? p[1] : p.y;
    const lista = [];
    for (let dy = -2; dy >= -30; dy -= 3) for (let dx = -8; dx <= 8; dx += 4) lista.push({ x: r.left + (x0 + dx) * sx, y: r.top + (y0 + dy - g.sobe) * sy });
    return lista;
  });
  let achou = false;
  for (const p of pontos) {
    await page.mouse.move(caixaDoIframe.x + p.x, caixaDoIframe.y + p.y);
    await page.waitForTimeout(40);
    const t = await frame2.evaluate(() => {
      const r = document.getElementById('rotulo');
      return r && !r.hidden ? r.textContent : null;
    });
    if (t === 'Mimi') {
      achou = true;
      break;
    }
  }
  achou ? ok('passar o mouse no gato mostra o nome dele') : falhou('o nome não apareceu sobre o gato');
  await foto(page, 'quarto-nome-do-gato');

  // 6. Minha conta e o guarda-roupa do quarto abrem a orelha Avatar
  await abrirAparencia();
  await page.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
  await page.getByRole('button', { name: /Trocar avatar/ }).click();
  await page.locator('.aparencia-fichario .personagem').first().waitFor({ timeout: 10_000 }).then(
    async () => ((await orelhaAberta()) === 'Avatar' ? ok('"Trocar avatar" em Minha conta abre a orelha Avatar') : falhou('abriu em ' + (await orelhaAberta()))),
    () => falhou('"Trocar avatar" não abriu a orelha Avatar'),
  );
  await fechar();

  const alvo = await frame2.evaluate(() => {
    const caixa = window.caixaDoMovelDoTeste('guarda-roupa');
    const tela = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!caixa || !tela) return null;
    const r = tela.getBoundingClientRect();
    const [x0, y0, x1, y1] = caixa;
    return { x: r.left + (((x0 + x1) / 2) * r.width) / tela.width, y: r.top + (((y0 + y1) / 2) * r.height) / tela.height };
  });
  if (!alvo) falhou('não achei o guarda-roupa no quarto de pixel art');
  else {
    await page.mouse.click(caixaDoIframe.x + alvo.x, caixaDoIframe.y + alvo.y);
    await page.locator('.aparencia-fichario .personagem').first().waitFor({ timeout: 15_000 }).then(
      async () => ((await orelhaAberta()) === 'Avatar' ? ok('o guarda-roupa do quarto (pixel art) abre a orelha Avatar') : falhou('abriu em ' + (await orelhaAberta()))),
      () => falhou('o guarda-roupa do quarto (pixel art) não abriu a Aparência'),
    );
    await foto(page, 'quarto-pixel');
    await fechar();
  }

  const botao = page.locator('.quarto-estilo-botao');
  if (await botao.count()) {
    await botao.click();
    const temCanvas = await page.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 }).then(() => true, () => false);
    if (!temCanvas) console.log('   (o 3D não abriu neste navegador: sem WebGL?)');
    else {
      await page.waitForTimeout(1500);
      const caixa = await page.locator('.quarto3d-caixa').boundingBox();
      const pt = await page.evaluate(() => window.quarto3dDoTeste?.pontoDaFuncao('gavetas'));
      if (!pt) falhou('sem o guarda-roupa no 3D');
      else {
        await page.mouse.click(caixa.x + pt.x, caixa.y + pt.y);
        await page.locator('.aparencia-fichario .personagem').first().waitFor({ timeout: 15_000 }).then(
          () => ok('o guarda-roupa do quarto 3D abre a orelha Avatar'),
          () => falhou('o guarda-roupa do quarto 3D não abriu a orelha Avatar'),
        );
        await foto(page, 'quarto-3d');
        await fechar();
      }
      await botao.click().catch(() => {});
    }
  }
} finally {
  await browser.close();
}
resumo();
