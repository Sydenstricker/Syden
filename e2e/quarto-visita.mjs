// A ESTANTE DE TROFÉUS E A VISITA AO QUARTO (03/11/2026): a estante é o hub de todos os troféus e conquistas, a pessoa
// escolhe o que fica em destaque, e quem pode entrar no quarto (público, amigos, privado com convidados) vê o destaque.
//
// - A Duda tem um troféu da Festa (posto direto no banco de teste: ganhar um pede uma partida inteira, e isso os testes
//   dos jogos já fazem). Ela abre a estante pelo quarto e põe o troféu em destaque pela estrela.
// - O Edu, que não é amigo, não vê "Visitar o quarto" no cartão dela (o de fábrica é só amigos).
// - Amigos, o botão aparece; a visita abre o quarto dela, e a estante mostra o destaque, com contra quem.
// - Privado: o botão some de novo, até ela convidar o Edu em Minha conta — e o convite chega a ele na hora, num cartão.
//
//   BANCO=<o banco da API de teste> node e2e/quarto-visita.mjs   (API de teste na 3099 e site na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const BANCO = process.env.BANCO;
if (!BANCO || !fs.existsSync(BANCO)) {
  console.error('Diga onde está o banco da API de teste: BANCO=... node e2e/quarto-visita.mjs');
  process.exit(1);
}
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
const pessoa = async () => vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
const pedir = (pagina, metodo, rota, corpo) =>
  pagina.evaluate(
    async ([metodo, rota, corpo]) => {
      const r = await fetch('http://localhost:3099' + rota, {
        method: metodo,
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), ...(corpo && { 'content-type': 'application/json' }) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return { status: r.status, corpo: await r.json().catch(() => null) };
    },
    [metodo, rota, corpo],
  );

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  const edu = await pessoa();
  await cadastrar(edu, 'edu' + s);
  await dispensarPresentes(edu);
  const dudaId = (await pedir(duda, 'GET', '/api/me')).corpo.id ?? (await pedir(duda, 'GET', '/api/me')).corpo.user?.id;
  const eduId = (await pedir(edu, 'GET', '/api/me')).corpo.id ?? (await pedir(edu, 'GET', '/api/me')).corpo.user?.id;

  // A comunidade, para o Edu achar a Duda na lista de membros e abrir o cartão dela.
  const comunidade = (await pedir(duda, 'POST', '/api/communities', { name: 'Visitas ' + s })).corpo;
  await pedir(edu, 'POST', '/api/communities/join', { code: comunidade.inviteCode });

  // O troféu: o pódio de uma Festa, a Duda em 1º, contra o Edu.
  const banco = new DatabaseSync(BANCO);
  banco
    .prepare('INSERT INTO corrida_trofeus (user_id, evento, community_id, pista, posicao, tempo_ms, pontos, rivais) VALUES (?, ?, ?, ?, 1, NULL, 42, ?)')
    .run(dudaId, 'e2e-' + s, comunidade.id, 'festa', JSON.stringify([eduId]));
  banco.close();

  // ---------- a Duda abre a estante pelo quarto e destaca o troféu ----------
  await duda.reload();
  await dispensarPresentes(duda);
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'trofeu' }, location.origin));
  const estante = duda.locator('.dialog.trofeus');
  await estante.waitFor({ timeout: 10000 });
  await estante.locator('h3', { hasText: 'Festa dos coelhos' }).waitFor({ timeout: 10000 }).then(
    () => ok('a estante agrupa os pódios pelo jogo'),
    () => falhou('a estante não mostra a Festa dos coelhos'),
  );
  await estante.getByRole('button', { name: 'Pôr em destaque' }).first().click();
  await estante.locator('.trofeus-destaque').waitFor({ timeout: 5000 });
  const destaque = (await pedir(duda, 'GET', '/api/trofeus')).corpo.destaque;
  destaque.length === 1 ? ok('a estrela pôs o troféu em destaque, e o servidor guardou') : falhou(`o destaque guardado é ${JSON.stringify(destaque)}`);
  await estante.screenshot({ path: path.join(FOTOS, 'quarto-visita-estante.png') });
  await duda.keyboard.press('Escape');

  // ---------- o Edu, sem ser amigo, não tem a porta ----------
  const abrirCartaoDaDuda = async () => {
    await edu.reload();
    await dispensarPresentes(edu);
    await edu.locator('.rail-item', { hasText: /^V/ }).first().click();
    await edu.locator('.channel-name', { hasText: 'geral' }).first().click();
    await edu.locator('.members .member', { hasText: 'duda' + s }).first().click();
    const cartao = edu.locator('.perfil-cartao');
    await cartao.waitFor({ timeout: 8000 });
    await edu.waitForTimeout(1500); // o botão espera a resposta do servidor
    return cartao;
  };
  let cartao = await abrirCartaoDaDuda();
  (await cartao.getByRole('button', { name: 'Visitar o quarto' }).count()) === 0
    ? ok('sem amizade, o cartão não oferece a visita (o de fábrica é só amigos)')
    : falhou('o cartão ofereceu a visita a quem não é amigo');
  await edu.keyboard.press('Escape');

  // ---------- amigos: a visita, e o destaque com contra quem ----------
  await pedir(edu, 'POST', '/api/amigos', { username: 'duda' + s });
  await pedir(duda, 'POST', `/api/amigos/${eduId}/aceitar`);
  cartao = await abrirCartaoDaDuda();
  const visitar = cartao.getByRole('button', { name: 'Visitar o quarto' });
  (await visitar.count()) === 1 ? ok('amigos: o cartão oferece "Visitar o quarto"') : falhou('o amigo não recebeu a visita no cartão');
  await visitar.click();
  const visita = edu.locator('.dialog.visita-quarto');
  await visita.waitFor({ timeout: 10000 });
  const frame = await (await edu.waitForSelector('.visita-quarto iframe', { timeout: 30000 })).contentFrame();
  await frame.waitForFunction(() => window.visitaDoTeste?.().soVer === true, null, { timeout: 60000 }).then(
    () => ok('o quarto da Duda abriu só para olhar'),
    () => falhou('a visita não entrou no modo de só olhar'),
  );
  await edu.waitForTimeout(1500);
  await edu.screenshot({ path: path.join(FOTOS, 'quarto-visita-quarto.png') });
  await frame.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'trofeu' }, location.origin));
  const daDuda = edu.locator('.dialog.trofeus');
  await daDuda.waitFor({ timeout: 10000 });
  await daDuda.locator('.trofeus-destaque li').first().waitFor({ timeout: 10000 });
  const texto = await daDuda.innerText();
  texto.includes('Festa dos coelhos') && texto.includes('edu' + s)
    ? ok('na visita, a estante mostra o destaque da Duda, com contra quem')
    : falhou(`a estante da visita mostrou: ${texto}`);
  (await daDuda.getByRole('button', { name: 'Pôr em destaque' }).count()) === 0
    ? ok('quem visita não mexe no destaque')
    : falhou('quem visita viu a estrela');
  await daDuda.screenshot({ path: path.join(FOTOS, 'quarto-visita-destaque.png') });
  await edu.keyboard.press('Escape');
  await edu.keyboard.press('Escape');

  // ---------- privado: só convidados ----------
  await duda.locator('.rail-logo').click();
  await duda.getByRole('button', { name: /Configurações|Ajustes/ }).first().click();
  const quemVisita = duda.getByLabel('Quem visita o seu quarto');
  await quemVisita.waitFor({ timeout: 10000 });
  await quemVisita.selectOption('privado');
  await duda.waitForTimeout(800);
  cartao = await abrirCartaoDaDuda();
  (await cartao.getByRole('button', { name: 'Visitar o quarto' }).count()) === 0
    ? ok('privado: nem o amigo tem a porta')
    : falhou('no privado, o amigo continuou vendo a visita');
  await edu.keyboard.press('Escape');
  await duda.locator('.quem-visita-lista label', { hasText: 'edu' + s }).locator('input').check();
  // o Edu, com o Syden aberto, recebe o convite na hora: o cartão no canto, com "Visitar o quarto"
  await edu
    .locator('.convite-voz', { hasText: 'duda' + s })
    .getByRole('button', { name: 'Visitar o quarto' })
    .waitFor({ timeout: 10000 })
    .then(
      () => ok('o convidado recebe o cartão do convite na hora'),
      () => falhou('o cartão do convite não chegou ao Edu'),
    );
  await edu.screenshot({ path: path.join(FOTOS, 'quarto-visita-convite.png') });
  const abertos = (await pedir(edu, 'GET', '/api/quartos-abertos')).corpo.quartos;
  abertos.length === 1 && abertos[0].convidou ? ok('e a tela de Amigos sabe do convite') : falhou(`quartos abertos: ${JSON.stringify(abertos)}`);
  // quem estava fora acha o convite na tela de Amigos (o quadro de fotos do quarto), com o botão de visitar
  await edu.locator('.convite-voz').getByRole('button', { name: 'Agora não' }).click();
  await edu.locator('.rail-logo').click();
  const quartoDoEdu = await (await edu.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quartoDoEdu.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await edu.waitForTimeout(1000);
  await quartoDoEdu.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'quadro' }, location.origin));
  const linha = edu.locator('.amigos-lista li', { hasText: 'duda' + s });
  await linha.getByText('Convite para o quarto').waitFor({ timeout: 10000 }).then(
    () => ok('na tela de Amigos, a Duda aparece com o convite para o quarto'),
    () => falhou('a tela de Amigos não mostrou o convite'),
  );
  await edu.locator('.amigos').screenshot({ path: path.join(FOTOS, 'quarto-visita-amigos.png') });
  await linha.getByRole('button', { name: 'Visitar o quarto' }).click();
  await edu.locator('.dialog.visita-quarto').waitFor({ timeout: 10000 }).then(
    () => ok('e o botão de lá abre a visita'),
    () => falhou('o botão da tela de Amigos não abriu a visita'),
  );
  await edu.keyboard.press('Escape');
  await duda.waitForTimeout(800);
  await duda.locator('.quem-visita').screenshot({ path: path.join(FOTOS, 'quarto-visita-privado.png') });
  cartao = await abrirCartaoDaDuda();
  (await cartao.getByRole('button', { name: 'Visitar o quarto' }).count()) === 1
    ? ok('convidado, o amigo volta a ter a porta')
    : falhou('o convite não abriu a porta');
} catch (e) {
  falhou('o teste parou: ' + e.message);
} finally {
  await browser.close();
}
resumo('Visita ao quarto');
