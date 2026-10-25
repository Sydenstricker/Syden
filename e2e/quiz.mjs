// O QUIZ DE ADIVINHAR (24/10/2026): "Monstros de fantasia", de ponta a ponta, com duas pessoas na sala.
//
// - A Duda abre a estante, aba Coletivo, e escolhe o quiz; o Edu aceita o convite, e ela dá a largada.
// - A Duda escreve o começo do nome, a lista mostra os monstros, e o Enter chuta o primeiro: vem uma linha com as
//   colunas coloridas, os valores traduzidos e o crédito do SRD embaixo.
// - O Edu vê a linha da Duda só com as cores, sem o nome do monstro.
// - Num painel estreito (celular), a tabela rola dentro dela e a página não ganha rolagem lateral.
//
//   node e2e/quiz.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `quiz-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async (largura = 1400) =>
  vigiar(await (await browser.newContext({ viewport: { width: largura, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Quiz ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', {
      headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') },
    });
    return (await r.json()).find((c) => c.name.startsWith('Quiz'))?.inviteCode;
  });

  const edu = await pessoa(420);
  await cadastrar(edu, 'edu' + s);
  await dispensarPresentes(edu);
  await edu.evaluate(
    async (codigo) =>
      fetch('http://localhost:3099/api/communities/join', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: JSON.stringify({ code: codigo }),
      }),
    convite,
  );
  await edu.reload();
  await dispensarPresentes(edu);
  for (const p of [duda, edu]) {
    await p.locator('.rail-item', { hasText: /^Q/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os dois estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  const capa = duda.locator('.minijogo-jogo', { hasText: 'Monstros de fantasia' });
  (await capa.count()) === 1 ? ok('o quiz está na aba Coletivo') : falhou('o quiz não está na aba Coletivo');
  await foto(duda, 'estante');
  await capa.click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.quiz-busca input').waitFor({ timeout: 10000 });
  ok('a largada veio, e o campo de chute está aberto');

  await duda.locator('.quiz-busca input').fill('adult red');
  await duda.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
  const sugestoes = await duda.locator('.quiz-busca li').allInnerTexts();
  sugestoes[0] === 'Adult Red Dragon' ? ok(`a lista sugere pelo começo do nome: ${sugestoes.join(', ')}`) : falhou(`sugestões: ${sugestoes.join(', ')}`);
  await foto(duda, 'sugestoes');
  await duda.keyboard.press('Enter');
  await duda.locator('.quiz-tabela tbody tr').first().waitFor({ timeout: 5000 });
  const linha = await duda.locator('.quiz-tabela tbody tr').first().innerText();
  /Adult Red Dragon/.test(linha) && /Dragão/.test(linha) && /Enorme/.test(linha) && /Caótico e mau/.test(linha)
    ? ok(`a linha do chute mostra os valores traduzidos: ${linha.replace(/\s+/g, ' ')}`)
    : falhou(`a linha do chute: ${linha}`);
  const cores = await duda.locator('.quiz-tabela tbody tr').first().locator('td.bate, td.em-parte, td.nao-bate').count();
  cores === 5 ? ok('as 5 colunas têm cor') : falhou(`só ${cores} colunas com cor`);
  (await duda.locator('.quiz-credito').innerText()).includes('System Reference Document 5.1') ? ok('o crédito do SRD está na tela') : falhou('sem o crédito do SRD');
  // Mais um chute, para a foto ter duas linhas (a não ser que o dragão vermelho fosse o secreto).
  if (await duda.locator('.quiz-busca input').count()) {
    await duda.locator('.quiz-busca input').fill('lich');
    await duda.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
    await duda.keyboard.press('Enter');
    await duda.locator('.quiz-tabela tbody tr').nth(1).waitFor({ timeout: 5000 });
  }
  await foto(duda, 'chutes');

  const daDuda = edu.locator('.palavra-outros li', { hasText: 'duda' + s });
  await daDuda.locator('.quiz-mini span').first().waitFor({ timeout: 5000 });
  const textoVisto = await daDuda.innerText();
  !/Dragon|Lich/.test(textoVisto) ? ok('o Edu vê as cores da Duda, sem os nomes') : falhou(`o Edu viu: ${textoVisto}`);

  // O Edu (420 px de largura) chuta também: a tabela cabe no painel, ou rola dentro dele.
  await edu.locator('.quiz-busca input').fill('gob');
  await edu.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
  await edu.keyboard.press('Enter');
  await edu.locator('.quiz-tabela tbody tr').first().waitFor({ timeout: 5000 });
  const estouro = await edu.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  estouro <= 0 ? ok('no estreito, a página não ganha rolagem lateral') : falhou(`no estreito, a página estoura ${estouro} px`);
  await foto(edu, 'estreito');

  // ---- Países: o Worldle, com a distância e a direção ----
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();
  await duda.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: /^Países$/ }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.quiz-busca input').fill('alem');
  await duda.locator('.quiz-busca li', { hasText: 'Alemanha' }).waitFor({ timeout: 5000 });
  ok('Países: a lista tem os nomes em português (Alemanha)');
  await duda.keyboard.press('Enter');
  await duda.locator('.quiz-tabela tbody tr').first().waitFor({ timeout: 5000 });
  // Um chute de cada vez: o próximo só sai depois que a linha do anterior chegou (o campo espera o pedido terminar).
  for (const [i, pais] of ['japao', 'brasil'].entries()) {
    if ((await duda.locator('.quiz-busca input').count()) === 0) break;
    await duda.locator('.quiz-busca input').fill(pais);
    await duda.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
    await duda.keyboard.press('Enter');
    await duda.locator('.quiz-tabela tbody tr').nth(i + 1).waitFor({ timeout: 5000 });
  }
  const brasil = await duda.locator('.quiz-tabela tbody tr').first().innerText();
  /km|✓/.test(brasil) && /Américas/.test(brasil) && /América do Sul/.test(brasil)
    ? ok(`Países: a linha tem distância, região e sub-região: ${brasil.replace(/\s+/g, ' ')}`)
    : falhou(`Países: a linha do Brasil: ${brasil}`);
  await foto(duda, 'paises');

  // ---- Mitologia: os nomes vêm do Wikidata, no idioma de quem lê ----
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();
  await duda.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: /^Mitologia$/ }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.quiz-busca input').waitFor({ timeout: 10000 });
  for (const [i, nome] of ['xango', 'zeus', 'anubis'].entries()) {
    // Se um chute era o secreto, a Duda acertou e o campo some: não é falha, é sorte.
    if ((await duda.locator('.quiz-busca input').count()) === 0) break;
    await duda.locator('.quiz-busca input').fill(nome);
    await duda.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
    await duda.keyboard.press('Enter');
    await duda.locator('.quiz-tabela tbody tr').nth(i).waitFor({ timeout: 5000 });
  }
  const xango = await duda.locator('.quiz-tabela tbody tr').last().innerText();
  /Xangô/.test(xango) && /Iorubá/.test(xango) && /Trovão/.test(xango)
    ? ok(`Mitologia: o nome em português e os valores traduzidos: ${xango.replace(/\s+/g, ' ')}`)
    : falhou(`Mitologia: a linha do Xangô: ${xango}`);
  await foto(duda, 'mitologia');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('Quiz');
}
