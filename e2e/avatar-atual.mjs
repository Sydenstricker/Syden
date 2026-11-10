// O "ATUAL" NO CARROSSEL DO AVATAR (10/11/2026, relato dele: "durante a alternância entre avatares, eu perdi de novo o meu
// referencial antigo de GIF; se eu não quiser nenhum dos avatares oferecidos, eu queria ter a opção de continuar com o meu
// atual"). O que se confere:
// - com um GIF de avatar, a aba Avatar abre no "Atual", com o GIF animado (IMG, não o canvas parado);
// - as setas só MOSTRAM: o coelho aparece (a foto de frente refinada, nítida), e recarregar volta ao GIF, que nunca saiu;
// - o Salvar veste o coelho, e o GIF aparece nos "Avatares anteriores", animado; clicar nele volta ao GIF.
//
//   SITE=http://localhost:5174 node e2e/avatar-atual.mjs   (API de teste; FOTOS= pasta das fotos)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const foto = (p, nome) => p.screenshot({ path: path.join(FOTOS, 'avatar-atual-' + nome + '.png') });
const GIF = path.join('e2e', 'pixel-art', 'personagem', 'blender', 'c', 'varrendo.gif');

const { browser, contexto } = await abrirNavegador({ viewport: { width: 1400, height: 950 } });
try {
  const page = vigiar(await contexto.newPage());
  await criarConta(page, 'atual');
  await dispensarPresentes(page);

  const configuracoes = page.locator('[role="dialog"].settings');
  const valor = () => page.locator('.personagem-linha[aria-label="Coelho"] .personagem-valor strong');
  const texto = async () => (await valor().textContent())?.trim();
  const seta = (qual) => page.locator('.personagem-linha[aria-label="Coelho"] .personagem-seta').nth(qual === '‹' ? 0 : 1);
  const abrirAvatar = async () => {
    await page.locator('button[aria-label="Configurações"]').first().click();
    await configuracoes.waitFor({ timeout: 10_000 });
    await page.locator('.settings-tab', { hasText: /^\s*Aparência\s*$/ }).first().click();
    await page.locator('.aparencia-fichario').waitFor({ timeout: 10_000 });
    await page.locator('.aparencia-fichario-orelhas [role="tab"]', { hasText: 'Avatar' }).click();
    await valor().waitFor({ timeout: 10_000 });
  };
  const gifNoPalco = () => page.locator('.personagem-palco .avatar .avatar-foto');

  // 1. o GIF de avatar, pelo "Usar uma foto" da própria aba
  await abrirAvatar();
  await page.locator('.personagem-foto summary').click();
  await page.locator('.personagem-foto input[type=file]').setInputFiles(GIF);
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === 'Atual', null, { timeout: 10_000 }).catch(() => {});
  await page.locator('.personagem-foto summary').click();
  await page.keyboard.press('Escape');
  await configuracoes.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});

  // 2. a aba Avatar começa no "Atual", com o GIF animado
  await abrirAvatar();
  (await texto()) === 'Atual' ? ok('o carrossel abre no "Atual"') : falhou('abriu em ' + (await texto()));
  await gifNoPalco().waitFor({ timeout: 10_000 });
  (await gifNoPalco().evaluate((el) => el.tagName)) === 'IMG' ? ok('o "Atual" é o GIF, animado') : falhou('o "Atual" não mostra o GIF animado');
  (await page.locator('.personagem-salvar').count()) === 0 ? ok('no atual, nada a salvar') : falhou('o Salvar aparece no atual');
  await page.locator('.personagem').first().scrollIntoViewIfNeeded();
  await foto(page, '1-atual');

  // 3. as setas só mostram
  for (let i = 0; i < 3; i++) await seta('›').click();
  (await texto()) === '3 / 16' ? ok('› › › mostra o coelho 3') : falhou('chegou a ' + (await texto()));
  await page.waitForFunction(() => {
    const img = document.querySelector('.personagem-coelho');
    return img?.getAttribute('src')?.includes('coelho-03-inteiro') && img.complete && img.naturalWidth > 0 && img.style.width;
  }, null, { timeout: 5_000 }).then(
    () => ok('o coelho 3 é a foto de frente refinada'),
    () => falhou('o coelho 3 não é a foto refinada'),
  );
  const nitido = await page.evaluate(() => {
    const img = document.querySelector('.personagem-coelho');
    return { k: img.width / img.naturalWidth, kh: img.height / img.naturalHeight, r: getComputedStyle(img).imageRendering, w: img.naturalWidth, h: img.naturalHeight };
  });
  Number.isInteger(nitido.k) && nitido.k === nitido.kh && nitido.r === 'pixelated'
    ? ok(`em escala inteira (${nitido.k}×, ${nitido.w} × ${nitido.h}), sem suavizar`)
    : falhou('ampliação: ' + JSON.stringify(nitido));
  (await page.locator('.personagem-salvar button').count()) === 1 ? ok('outro coelho na tela: o Salvar aparece') : falhou('sem o Salvar');
  await foto(page, '2-coelho-refinado');
  // as 16 fotos refinadas carregam (o 16 também, que antes só tinha o busto)
  const faltam = await page.evaluate(async () => {
    const base = document.querySelector('.personagem-coelho').src;
    const r = [];
    for (let n = 1; n <= 16; n++) {
      const carregou = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res(i.naturalWidth > 0);
        i.onerror = () => res(false);
        i.src = base.replace('coelho-03-inteiro', `coelho-${String(n).padStart(2, '0')}-inteiro`);
      });
      if (!carregou) r.push(n);
    }
    return r;
  });
  faltam.length === 0 ? ok('os 16 corpos refinados carregam') : falhou('não carregam: ' + faltam.join(', '));

  await page.reload();
  await page.locator('#abertura').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  await dispensarPresentes(page);
  await abrirAvatar();
  (await texto()) === 'Atual' && (await gifNoPalco().count()) === 1
    ? ok('sem Salvar, recarregar volta ao GIF: as setas não trocaram nada')
    : falhou('as setas trocaram o avatar: ' + (await texto()));
  (await page.locator('.avatares-anteriores').count()) === 0 ? ok('e nada foi para os anteriores') : falhou('as setas guardaram um anterior');

  // 4. salvar o coelho: o GIF vai para os anteriores
  for (let i = 0; i < 3; i++) await seta('›').click();
  await page.locator('.personagem-salvar button').click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === '3 / 16 · Atual', null, { timeout: 10_000 }).then(
    () => ok('o Salvar veste o 3, que vira o "Atual"'),
    () => falhou('o Salvar não vestiu'),
  );
  const anterior = page.locator('.avatares-anteriores .avatar-anterior');
  await anterior.first().waitFor({ timeout: 10_000 });
  (await anterior.count()) === 1 ? ok('o GIF está nos "Avatares anteriores"') : falhou(`anteriores: ${await anterior.count()}`);
  await page.locator('.avatares-anteriores').scrollIntoViewIfNeeded();
  await anterior.first().hover();
  await page.waitForTimeout(300);
  await foto(page, '3-salvo-com-o-gif-nos-anteriores');

  // 5. voltar ao GIF
  await anterior.first().click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === 'Atual', null, { timeout: 10_000 }).then(
    () => ok('clicar no anterior volta ao GIF, que é o "Atual" de novo'),
    () => falhou('não voltou ao GIF'),
  );
  (await gifNoPalco().evaluate((el) => el.tagName).catch(() => null)) === 'IMG' ? ok('e ele anima') : falhou('o GIF de volta não anima');
  await page.locator('.personagem').first().scrollIntoViewIfNeeded();
  await foto(page, '4-de-volta-ao-gif');
} finally {
  await browser.close();
}
resumo('avatar-atual');
