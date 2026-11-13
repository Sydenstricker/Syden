// O QUARTO FICA GUARDADO ENQUANTO A PESSOA VAI A OUTRA ABA (13/11/2026, CenaGuardada.tsx).
//
// - O quarto abre no início; a pessoa vai à comunidade e o quarto continua montado (o MESMO documento do iframe),
//   escondido, sem receber clique, e a página dele se sabe guardada (é o que a faz parar de desenhar).
// - Voltar ao início é só mostrar: o mesmo documento, sem esperar a cena de novo.
// - Com o prazo encurtado (window.prazoDaCenaGuardada, só no site de desenvolvimento), longe do início a cena é
//   desmontada, e voltar monta uma nova.
//
//   node e2e/cena-guardada.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage());
  await cadastrar(p, 'guarda' + s);
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click();
  const iframe = () => p.$('.quarto-novo-caixa:not(.salao-novo) iframe');
  let quarto = await (await p.waitForSelector('.quarto-novo-caixa:not(.salao-novo) iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await quarto.evaluate(() => (window.marcaDoTeste = 'o mesmo quarto'));
  const guardada = (f) => f.evaluate(() => !window.frameElement.checkVisibility({ visibilityProperty: true }));
  (await guardada(quarto)) ? falhou('o quarto à vista se acha guardado') : ok('à vista, o quarto se sabe à vista');

  // vai à comunidade
  await p.locator('.rail-item:not(.rail-action)').first().click();
  await p.locator('.channel.inicio-link').waitFor({ timeout: 15000 });
  await p.waitForTimeout(800);
  const el = await iframe();
  if (!el) falhou('o quarto foi desmontado ao sair do início');
  else {
    ok('fora do início, o quarto continua montado');
    (await p.locator('.cena-guardada.escondida .quarto-novo-caixa:not(.salao-novo) iframe').count()) === 1
      ? ok('ele está no invólucro escondido')
      : falhou('o quarto não está no invólucro escondido');
    (await guardada(quarto)) ? ok('a página do quarto se sabe guardada (e por isso não desenha)') : falhou('a página do quarto se acha à vista');
    const visivel = await p.locator('.quarto-novo-caixa:not(.salao-novo)').first().isVisible();
    visivel ? falhou('o quarto guardado aparece na tela') : ok('o quarto guardado não aparece na tela');
  }

  // volta ao início: só mostrar
  const t0 = Date.now();
  await p.locator('.rail-logo').click();
  await p.locator('.quarto-novo-caixa:not(.salao-novo) iframe').waitFor({ state: 'visible', timeout: 30000 });
  const ms = Date.now() - t0;
  const marca = await quarto.evaluate(() => window.marcaDoTeste).catch(() => null);
  marca === 'o mesmo quarto' ? ok(`de volta ao início, o mesmo quarto, em ${ms} ms`) : falhou('voltar ao início refez o quarto');
  (await guardada(quarto)) ? falhou('de volta, a página continua se achando guardada') : ok('de volta, a página volta a desenhar');

  // UMA cena guardada só: quarto guardado, abre o salão, sai do salão para um canal → o salão fica, o quarto sai
  await p.locator('.rail-item:not(.rail-action)').first().click();
  await p.locator('.channel.inicio-link').click({ timeout: 15000 });
  const temSalao = await p.waitForSelector('.salao-novo iframe', { timeout: 30000 }).then(() => true, () => false);
  if (!temSalao) console.log('(a comunidade de teste não abriu o salão: a regra de uma cena só não foi conferida)');
  else {
    (await iframe()) ? ok('com o salão à vista, o quarto continua guardado') : falhou('abrir o salão desmontou o quarto');
    await p.locator('.channel-row button.channel').first().click();
    await p.waitForTimeout(800);
    const salaoGuardado = await p.locator('.cena-guardada.escondida .salao-novo iframe').count();
    salaoGuardado === 1 ? ok('saindo do salão para um canal, o salão fica guardado') : falhou('o salão não ficou guardado');    (await iframe()) ? falhou('quarto e salão guardados ao mesmo tempo') : ok('e o quarto sai: uma cena guardada só');
    await p.locator('.rail-logo').click();
    quarto = await (await p.waitForSelector('.quarto-novo-caixa:not(.salao-novo) iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  }

  // com o prazo curto, a cena é liberada
  await p.evaluate(() => (window.prazoDaCenaGuardada = 1500));
  await p.locator('.rail-item:not(.rail-action)').first().click();
  await p.locator('.channel.inicio-link').waitFor({ timeout: 15000 });
  if (temSalao) {
    (await p.locator('.salao-novo iframe').count()) === 0 ? ok('guardando o quarto, o salão guardado sai') : falhou('o salão continua guardado junto com o quarto');
  }
  await p.waitForTimeout(3500);
  (await iframe()) ? falhou('passado o prazo, o quarto continua montado') : ok('passado o prazo, o quarto foi desmontado');
  await p.locator('.rail-logo').click();
  quarto = await (await p.waitForSelector('.quarto-novo-caixa:not(.salao-novo) iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  (await quarto.evaluate(() => window.marcaDoTeste)) ? falhou('o quarto novo traz a marca do antigo') : ok('voltando depois do prazo, um quarto novo');

  // computador com pouca memória (o navegador diz 4 GB): nada é guardado, como antes
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await contexto.addInitScript(() => Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 4 }));
  const q = vigiar(await contexto.newPage());
  await cadastrar(q, 'pouca' + s);
  await dispensarPresentes(q);
  await q.locator('.rail-logo').click();
  const f = await (await q.waitForSelector('.quarto-novo-caixa:not(.salao-novo) iframe', { timeout: 30000 })).contentFrame();
  await f.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await q.locator('.rail-item:not(.rail-action)').first().click();
  await q.locator('.channel.inicio-link').waitFor({ timeout: 15000 });
  await q.waitForTimeout(800);
  (await q.$('.quarto-novo-caixa:not(.salao-novo) iframe')) ? falhou('com 4 GB, o quarto ficou guardado') : ok('com 4 GB, sair do início desmonta o quarto');
} finally {
  await browser.close();
}
resumo('cena-guardada');
