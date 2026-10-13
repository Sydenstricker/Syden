// O SALÃO DA COMUNIDADE (12/10/2026): o início da comunidade é o salão em pixel art, e ele enche com quem está na call.
//
// - Sem ninguém na call, o salão fica vazio (só o coelho do balcão) — a tela não finge movimento.
// - O Edu e a Fabi entram na Sala 1: dois lugares do salão se ocupam, na tela da Duda, sem recarregar.
// - O Edu escolheu um coelho pronto de avatar: aparece COM ELE no salão; a Fabi (sem pronto) com um coelho do salão.
//   Os dois com o nome em cima (13/10/2026).
// - O balcão não leva mais ao guarda-roupa.
// - Passar o mouse na TV mostra o que ela faz; o fliperama leva à sala de voz com a estante de jogos aberta.
// - A TV AO VIVO: o Edu e a Fabi transmitem a tela; a TV da Duda mostra "Ao vivo" e quem, as setas trocam de canal, e
//   clicar na TV leva a Duda para a sala já assistindo (a watch party).
// - Quem dá o recado: a Duda escolhe um coelho pronto no editor, e ele aparece animado no salão.
//
//   node e2e/salao-da-comunidade.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador();
// O navegador de teste não tem tela para compartilhar: uma tela falsa, pintada num canvas (como em tela-parada.mjs).
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${(n += 7) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 640, 360);
    }, 1000 / 15);
    return canvas.captureStream(15);
  };
};
const pessoa = async () => {
  const page = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
  await page.addInitScript(TELA_FALSA);
  return page;
};

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Salão ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Salão'))?.inviteCode;
  });

  await duda.locator('.inicio-link').first().click();
  const salao = duda.locator('.salao');
  await salao.waitFor({ timeout: 10000 });
  const vazio = await salao.locator('.salao-peca.na-call').count();
  vazio === 0 ? ok('sem ninguém na call, o salão fica vazio (só o coelho do balcão)') : falhou(`o salão vazio tem ${vazio} pessoas`);
  await duda.locator('.bv').screenshot({ path: path.join(FOTOS, 'salao-vazio.png') });

  const naCall = [];
  for (const nome of ['edu', 'fabi']) {
    const p = await pessoa();
    naCall.push(p);
    await cadastrar(p, nome + s);
    await dispensarPresentes(p);
    await p.evaluate(
      async (codigo) =>
        fetch('http://localhost:3099/api/communities/join', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
          body: JSON.stringify({ code: codigo }),
        }),
      convite,
    );
    if (nome === 'edu')
      await p.evaluate(async () =>
        fetch('http://localhost:3099/api/me/avatar-pronto', {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
          body: JSON.stringify({ numero: 3 }),
        }),
      );
    await p.reload();
    await dispensarPresentes(p);
    // As iniciais de "Salão 12345" são S1…S9; "SY" é a comunidade do Syden, onde todo mundo entra.
    await p.locator('.rail-item', { hasText: /^S\d$/ }).first().click();
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  await duda.waitForFunction(() => document.querySelectorAll('.salao .salao-peca.na-call').length === 2, null, { timeout: 10000 });
  ok('o Edu e a Fabi entraram na call, e o salão da Duda encheu sozinho');
  const nomes = await salao.locator('.salao-peca.na-call').evaluateAll((els) => els.map((e) => e.title));
  nomes.length === 2 ? ok(`quem está na call tem nome no salão: ${nomes.join(', ')}`) : falhou(`nomes: ${nomes.join(', ')}`);
  const etiquetas = await salao.locator('.salao-nome').allInnerTexts();
  etiquetas.includes('edu' + s) && etiquetas.includes('fabi' + s) ? ok('os dois têm o nome em cima') : falhou(`etiquetas: ${etiquetas.join(', ')}`);
  const busto = await salao.locator('.salao-busto').getAttribute('style');
  busto?.includes('coelho-03') ? ok('o Edu aparece com o coelho que ele escolheu') : falhou(`o coelho do Edu: ${busto}`);
  (await duda.getByRole('button', { name: /Guarda-roupa/ }).count()) === 0 ? ok('o balcão não leva mais ao guarda-roupa') : falhou('o guarda-roupa ainda está no salão');

  await duda.getByRole('button', { name: /^Entrar na voz/ }).first().hover();
  await duda.locator('.salao-rotulo').waitFor({ timeout: 3000 });
  ((await duda.locator('.salao-rotulo').innerText()).includes('2 na chamada agora') ? ok : falhou)('a TV diz quantos estão na chamada');
  await duda.locator('.bv').screenshot({ path: path.join(FOTOS, 'salao-com-gente.png') });

  // A TV ao vivo: os dois transmitem.
  for (const p of naCall) {
    await p.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
    await p.locator('.screenshare-option').first().click();
  }
  await duda.locator('.salao-tv-ao-vivo').waitFor({ timeout: 15000 });
  const primeiro = (await duda.locator('.salao-tv-ao-vivo strong').innerText()).trim();
  ok(`alguém transmitindo: a TV mostra "Ao vivo" e ${primeiro}`);
  await duda
    .waitForFunction(() => document.querySelectorAll('.salao-tv-seta').length === 2, null, { timeout: 15000 })
    .then(
      () => ok('com duas transmissões, as setas de trocar de canal aparecem'),
      () => falhou('faltam as setas da TV'),
    );
  await duda.locator('.salao-tv-seta').last().click();
  const segundo = (await duda.locator('.salao-tv-ao-vivo strong').innerText()).trim();
  segundo !== primeiro ? ok(`a seta trocou de canal: ${primeiro} → ${segundo}`) : falhou('a seta não trocou de canal');
  await duda.locator('.bv').screenshot({ path: path.join(FOTOS, 'salao-tv-ao-vivo.png') });
  await duda.getByRole('button', { name: /^Assistir transmissão/ }).first().click();
  await duda.locator('.stage-main video').first().waitFor({ timeout: 30000 });
  ok(`clicar na TV levou a Duda para a sala, já assistindo ${segundo}`);
  await duda.locator('.inicio-link').first().click();
  await duda.locator('.salao').waitFor({ timeout: 10000 });

  // Quem dá o recado: o coelho é escolhido no editor, e todos têm animação.
  (await duda.locator('.bv-guia-coelho').getAttribute('style'))?.includes('coelho-do-recado')
    ? ok('sem escolha, quem dá o recado é o coelho do salão, animado')
    : falhou('o coelho do recado não é o do salão');
  await duda.getByRole('button', { name: /^Montar esta tela/ }).last().click();
  await duda.locator('.bv-coelho-opcao').nth(5).waitFor({ timeout: 10000 });
  (await duda.locator('.bv-coelho-opcao').count()) === 17 ? ok('o editor oferece 17 coelhos para dar o recado') : falhou('faltam opções de coelho');
  await duda.locator('.bv-editor input').first().fill('Chegou!');
  await duda.locator('.bv-coelho-opcao').nth(5).click();
  await duda.locator('.bv-editor').screenshot({ path: path.join(FOTOS, 'recado-editor.png') });
  await duda.locator('.bv-editor .btn-primary').click();
  await duda.locator('.bv-editor .form-success').waitFor({ timeout: 10000 });
  await duda.keyboard.press('Escape');
  await duda.locator('.inicio-link').first().click();
  await duda.locator('.salao').waitFor({ timeout: 10000 });
  await duda
    .waitForFunction(() => document.querySelector('.bv-guia-coelho')?.getAttribute('style')?.includes('coelho-05-falando'), null, { timeout: 10000 })
    .then(
      () => ok('o coelho escolhido dá o recado no salão, falando'),
      () => falhou('o coelho escolhido não apareceu no salão'),
    );
  await duda.locator('.bv-guia').screenshot({ path: path.join(FOTOS, 'recado-coelho.png') });

  await duda.getByRole('button', { name: /^Mini-games/ }).first().click();
  await duda.locator('.minijogo-estante').waitFor({ timeout: 30000 });
  ok('o fliperama levou a Duda para a sala de voz, com a estante de jogos aberta');
} finally {
  await browser.close();
}
resumo('Salão da comunidade');
