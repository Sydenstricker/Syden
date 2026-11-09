// O GUARDA-ROUPA SEPARADO DA APARÊNCIA (09/11/2026, pedido dele: "uma coisa é mudar aparência do aplicativo Syden, outra é
// mudar o nosso avatar"):
// - Configurações → Aparência tem só a cara do app (as paletas e a cor do Syden), sem avatar nem enfeites do perfil;
// - Configurações → Guarda-roupa abre na aba Avatar (a prévia do personagem, a foto e os coelhos prontos), seguida das
//   abas de sempre (Cor do nome, Fundo do perfil, Moldura do avatar, Efeito do nome, Letra do nome, Insígnias, Pacotes);
// - escolher um coelho pronto muda a prévia para o corpo inteiro dele;
// - Minha conta leva ao Guarda-roupa pelo "Trocar avatar";
// - o guarda-roupa do QUARTO (o de pixel art, no iframe, e o 3D) abre o Guarda-roupa.
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
  const abrirConfiguracoes = async () => {
    await page.locator('button[aria-label="Configurações"]').first().click();
    await configuracoes.waitFor({ timeout: 10_000 });
  };
  // o foco pode ter ficado no iframe do quarto (o Esc iria para ele): clica no título antes
  const fechar = async () => {
    await page.locator('.settings-content h2').first().click().catch(() => {});
    await page.keyboard.press('Escape');
    await configuracoes.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
  };

  // 1. A Aparência: só a cara do app
  await abrirConfiguracoes();
  await page.locator('.settings-tab', { hasText: /^\s*Aparência\s*$/ }).first().click();
  await page.locator('.paleta-do-syden').waitFor({ timeout: 10_000 });
  const naAparencia = {
    paletas: await page.locator('.paleta-do-syden [role="radio"]').count(),
    cor: await page.locator('.cor-do-syden').count(),
    previa: await page.locator('.settings-content .perfil-previa').count(),
    abas: await page.locator('.settings-content [role="tab"]').count(),
  };
  if (naAparencia.paletas === 4 && naAparencia.cor === 1) ok('a Aparência tem as paletas e a cor do Syden');
  else falhou('Aparência: ' + JSON.stringify(naAparencia));
  if (naAparencia.previa === 0 && naAparencia.abas === 0) ok('e nada do perfil (nem a prévia, nem as abas de cosmético)');
  else falhou('a Aparência ainda tem coisas do perfil: ' + JSON.stringify(naAparencia));
  await foto(page, 'aparencia');

  // 2. O Guarda-roupa, pela entrada própria (e pelo atalho da Aparência)
  await page.locator('.aparencia-para-o-guarda-roupa').click();
  await page.getByRole('heading', { name: 'Guarda-roupa' }).waitFor({ timeout: 10_000 }).then(
    () => ok('o atalho da Aparência leva ao Guarda-roupa'),
    () => falhou('o atalho da Aparência não levou ao Guarda-roupa'),
  );
  const entrada = page.locator('.settings-tab.active', { hasText: /Guarda-roupa/ });
  (await entrada.count()) ? ok('o Guarda-roupa é uma entrada própria das Configurações') : falhou('sem a entrada Guarda-roupa no menu');
  const abas = (await page.locator('.settings-content [role="tab"]').allTextContents()).map((x) => x.trim());
  const esperadas = ['Avatar', 'Cor do nome', 'Fundo do perfil', 'Moldura do avatar', 'Efeito do nome', 'Letra do nome', 'Insígnias', 'Pacotes'];
  JSON.stringify(abas) === JSON.stringify(esperadas) ? ok('as abas: ' + abas.join(', ')) : falhou('abas: ' + abas.join(', '));
  (await page.locator('.settings-content [role="tab"][aria-selected="true"]').textContent())?.trim() === 'Avatar'
    ? ok('abre na aba Avatar')
    : falhou('não abriu na aba Avatar');
  (await page.locator('.guarda-roupa-personagem').count()) && (await page.locator('.coelhos-prontos-grade button').count()) === 16
    ? ok('a aba Avatar tem a prévia do personagem e os 16 coelhos')
    : falhou('a aba Avatar está incompleta');
  (await page.locator('.settings-content .perfil-previa').count()) ? ok('com a prévia do perfil no alto') : falhou('sem a prévia do perfil');

  // escolher um coelho: a prévia vira o corpo inteiro dele
  await page.locator('.coelhos-prontos-grade button').nth(4).click();
  await page.locator('.guarda-roupa-corpo').waitFor({ timeout: 10_000 }).then(
    async () => {
      const src = await page.locator('.guarda-roupa-corpo').getAttribute('src');
      /coelho-05-corpo\.png$/.test(src ?? '') ? ok('escolher o coelho 5 mostra o corpo inteiro dele') : falhou('corpo errado: ' + src);
    },
    () => falhou('a prévia não mostrou o corpo do coelho'),
  );
  await page.waitForTimeout(500);
  await foto(page, 'avatar');

  // as outras abas continuam vestindo
  await page.getByRole('tab', { name: 'Fundo do perfil' }).click();
  await page.locator('.guarda-roupa-grade .guarda-roupa-cartao').first().waitFor({ timeout: 10_000 }).then(
    () => ok('a aba Fundo do perfil mostra o catálogo'),
    () => falhou('a aba Fundo do perfil está vazia'),
  );
  const vestivel = page.locator('.guarda-roupa-cartao.vestivel').first();
  if (await vestivel.count()) {
    await vestivel.click();
    await page.locator('.guarda-roupa-cartao.vestido').first().waitFor({ timeout: 10_000 }).then(
      () => ok('vestir um fundo continua funcionando'),
      () => falhou('vestir um fundo não marcou "Em uso"'),
    );
  }
  await foto(page, 'fundo');

  // 3. Minha conta leva ao Guarda-roupa
  await page.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
  await page.getByRole('button', { name: /Trocar avatar/ }).click();
  await page.locator('.guarda-roupa-aba-avatar').waitFor({ timeout: 10_000 }).then(
    () => ok('"Trocar avatar" em Minha conta abre o Guarda-roupa'),
    () => falhou('"Trocar avatar" não abriu o Guarda-roupa'),
  );
  await fechar();

  // 4. O guarda-roupa do quarto de pixel art (no iframe) abre o Guarda-roupa
  await page.locator('#abertura').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  const iframe = page.locator('.quarto-novo iframe');
  await iframe.waitFor({ timeout: 30_000 });
  const frame = await (await iframe.elementHandle()).contentFrame();
  await frame.waitForFunction(() => typeof window.caixaDoMovelDoTeste === 'function', null, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  const alvo = await frame.evaluate(() => {
    const caixa = window.caixaDoMovelDoTeste('guarda-roupa');
    const tela = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!caixa || !tela) return null;
    const r = tela.getBoundingClientRect();
    const [x0, y0, x1, y1] = caixa;
    return { x: r.left + (((x0 + x1) / 2) * r.width) / tela.width, y: r.top + (((y0 + y1) / 2) * r.height) / tela.height };
  });
  if (!alvo) falhou('não achei o guarda-roupa no quarto de pixel art');
  else {
    const caixaDoIframe = await iframe.boundingBox();
    await page.mouse.click(caixaDoIframe.x + alvo.x, caixaDoIframe.y + alvo.y);
    await page.locator('.guarda-roupa-aba-avatar').waitFor({ timeout: 15_000 }).then(
      () => ok('o guarda-roupa do quarto (pixel art) abre o Guarda-roupa, na aba Avatar'),
      () => falhou('o guarda-roupa do quarto (pixel art) não abriu o Guarda-roupa'),
    );
    await foto(page, 'quarto-pixel');
    await fechar();
  }

  // 5. E o do quarto 3D
  const botao = page.locator('.quarto-estilo-botao');
  if (await botao.count()) {
    await botao.click();
    const caixa3d = page.locator('.quarto3d-caixa:not(.escondida) canvas');
    const temCanvas = await caixa3d.waitFor({ timeout: 30_000 }).then(() => true, () => false);
    if (!temCanvas) console.log('   (o 3D não abriu neste navegador: sem WebGL?)');
    else {
      await page.waitForTimeout(1500);
      const caixa = await page.locator('.quarto3d-caixa').boundingBox();
      const pt = await page.evaluate(() => window.quarto3dDoTeste?.pontoDaFuncao('gavetas'));
      if (!pt) falhou('sem o guarda-roupa no 3D');
      else {
        await page.mouse.click(caixa.x + pt.x, caixa.y + pt.y);
        await page.locator('.guarda-roupa-aba-avatar').waitFor({ timeout: 15_000 }).then(
          () => ok('o guarda-roupa do quarto 3D abre o Guarda-roupa'),
          () => falhou('o guarda-roupa do quarto 3D não abriu o Guarda-roupa'),
        );
        await foto(page, 'quarto-3d');
        await fechar();
      }
      // volta ao pixel art, para a escolha do aparelho não ficar no 3D
      await botao.click().catch(() => {});
    }
  }
} finally {
  await browser.close();
}
resumo();
