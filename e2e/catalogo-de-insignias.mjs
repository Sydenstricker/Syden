// O CATÁLOGO DAS INSÍGNIAS (19/11/2026, pedido dele: "traga as duas coisas", vendo as insígnias do Discord).
// - Minha conta mostra TODAS as insígnias: as da pessoa inteiras, as outras esmaecidas com a frase de como se ganham;
// - nada de barra, "faltam", contagem nem raridade na seção;
// - as três do fliperama aparecem (5, 15 e 30 mini-games diferentes com a turma);
// - a da pessoa vai e volta da vitrine pelo clique, e as setas trocam a ordem; "Esconder todas" esvazia;
// - a mesma seção está no Guarda-roupa (Aparência → Avatar → Insígnias).
// A entrega na hora, no fim de uma partida da sala, está no teste do servidor (server/test/insignias-fliperama.test.ts):
// aqui precisaria de duas pessoas na sala de voz com o LiveKit.
//
//   SITE=http://localhost:5174/app/ node e2e/catalogo-de-insignias.mjs   (API de teste; FOTOS= pasta das fotos)
//   ESCRITO, NÃO RODADO (19/11/2026).
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador({ viewport: { width: 1400, height: 950 } });
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'pt-BR' });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'ins' + s);
  await dispensarPresentes(page);

  // Ganha uma insígnia de verdade: o código secreto no teclado (codigoSecreto.ts), e abre a tela de destaque.
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  for (const tecla of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    await page.keyboard.press(tecla);
  }
  await dispensarPresentes(page);

  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('[role="dialog"].settings').waitFor({ timeout: 10_000 });
  await page.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
  const secao = page.locator('.catalogo-de-insignias');
  await secao.waitFor({ timeout: 10_000 });
  await secao.scrollIntoViewIfNeeded();

  const nomes = (await secao.locator('.insignia-escolha strong').allTextContents()).map((x) => x.trim());
  for (const nome of ['Um dos 25 primeiros', 'Ideia acolhida', 'Código secreto', 'Fliperama em turma', 'Fliperama de toda noite', 'Lenda do fliperama']) {
    nomes.includes(nome) ? ok(`o catálogo traz "${nome}"`) : falhou(`falta "${nome}" (veio: ${nomes.join(', ')})`);
  }
  const naoTenho = secao.locator('.insignia-escolha.nao-tenho');
  (await naoTenho.count()) >= 5 ? ok('as que a pessoa não tem aparecem esmaecidas') : falhou('esmaecidas: ' + (await naoTenho.count()));
  const frase = await secao.locator('.insignia-escolha.nao-tenho', { hasText: 'Fliperama em turma' }).locator('small').textContent();
  /mini-games diferentes/.test(frase ?? '') ? ok('com a frase de como se ganha: ' + frase) : falhou('frase: ' + frase);
  const texto = (await secao.textContent()) ?? '';
  /faltam|progresso|raro|\d+\s*\/\s*\d+|%/i.test(texto) ? falhou('a seção tem contagem, progresso ou raridade') : ok('sem contagem, progresso nem raridade');
  (await secao.locator('[role="progressbar"], progress').count()) === 0 ? ok('sem barra') : falhou('tem barra');

  // A do código secreto: tirar e pôr na vitrine.
  const minha = secao.locator('button.insignia-escolha', { hasText: 'Código secreto' });
  (await minha.count()) === 1 ? ok('a insígnia da pessoa é um botão') : falhou('a do código secreto não é clicável');
  const exibindo = async () => (await minha.getAttribute('aria-pressed')) === 'true';
  if (!(await exibindo())) await minha.click();
  (await exibindo()) ? ok('está na vitrine') : falhou('não foi à vitrine');
  (await secao.locator('.insignias-na-vitrine li').count()) >= 1 ? ok('a vitrine aparece na ordem do perfil') : falhou('a vitrine não aparece');
  await page.screenshot({ path: path.join(FOTOS, 'catalogo-de-insignias.png') });
  await secao.getByRole('button', { name: 'Esconder todas' }).click();
  (await exibindo()) ? falhou('"Esconder todas" não tirou') : ok('"Esconder todas" esvazia a vitrine');
  const me = await page.evaluate(async () => {
    const r = await fetch('/api/me', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return r.ok ? r.json() : null;
  });
  if (me) (me.vitrine ?? []).length === 0 ? ok('e o servidor guardou a vitrine vazia') : falhou('o servidor ficou com ' + me.vitrine);
  await minha.click();

  // O mesmo no Guarda-roupa.
  await page.locator('.settings-tab', { hasText: /^\s*Aparência\s*$/ }).first().click();
  await page.locator('.aparencia-fichario-orelhas [role="tab"]', { hasText: 'Avatar' }).click();
  await page.locator('.enfeites-do-perfil .tab', { hasText: 'Insígnias' }).click();
  (await page.locator('.enfeites-do-perfil .catalogo-de-insignias').count()) === 1
    ? ok('o Guarda-roupa mostra o mesmo catálogo')
    : falhou('o Guarda-roupa não mostra o catálogo');
} finally {
  await browser.close();
  resumo('catálogo das insígnias');
}
