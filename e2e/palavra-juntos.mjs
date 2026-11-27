// A PALAVRA SECRETA, MODO JUNTOS (27/11/2026): duas pessoas na sala, o quadro é um só.
//
// - A Duda escolhe "Juntos" na largada; o Edu aceita o convite.
// - O chute da Duda aparece no quadro do Edu, com as letras, as cores e o nome dela ao lado da linha.
// - O que o Edu estava escrevendo NÃO some quando o chute da Duda chega.
// - O Edu acerta e a tela diz que a turma acertou; o placar tem os mesmos pontos para os dois.
//
//   node e2e/palavra-juntos.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
//   FOTOS=<pasta>  muda onde as fotos vão; PALAVRA=<texto> é a palavra sorteada, se a conhecer (não precisa)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'palavra-juntos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async (largura = 1400) =>
  vigiar(await (await browser.newContext({ viewport: { width: largura, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Juntos ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Juntos'))?.inviteCode;
  });

  const edu = await pessoa(900);
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
    await p.locator('.rail-item', { hasText: /^J/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os dois estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Palavra secreta' }).click();
  const juntos = duda.locator('.escolha-palavras').getByRole('button', { name: /Juntos/ });
  (await juntos.count()) === 1 ? ok('a largada tem o modo Juntos') : falhou('a largada não tem o modo Juntos');
  await foto(duda, '1-largada');
  await juntos.click();
  await duda.getByRole('button', { name: 'Começar' }).first().click({ timeout: 5000 });
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.palavra-quadro').waitFor({ timeout: 10000 });
  await edu.locator('.palavra-quadro').waitFor({ timeout: 10000 });
  ok('a partida começou para os dois');

  // o Edu começa a escrever "ter", e a Duda manda "fazer"
  await edu.locator('.palavra-teclado').getByRole('button', { name: 'T', exact: true }).click();
  await edu.locator('.palavra-teclado').getByRole('button', { name: 'E', exact: true }).click();
  await edu.locator('.palavra-teclado').getByRole('button', { name: 'R', exact: true }).click();
  for (const k of 'fazer') await duda.locator('.palavra-teclado').getByRole('button', { name: k.toUpperCase(), exact: true }).click();
  await duda.locator('.palavra-teclado').getByRole('button', { name: 'Enviar' }).click();

  await edu.locator('.palavra-linha-autor .palavra-autor', { hasText: 'duda' + s }).waitFor({ timeout: 5000 });
  const linha = (await edu.locator('.palavra-linha-autor .palavra-linha').first().innerText()).replace(/\s/g, '');
  linha === 'FAZER' ? ok('o chute da Duda aparece no quadro do Edu, com o nome dela') : falhou('a linha do Edu diz ' + linha);
  const rascunho = (await edu.locator('.palavra-linha.atual').innerText()).replace(/\s/g, '');
  rascunho === 'TER' ? ok('o que o Edu escrevia continua lá') : falhou('o rascunho do Edu virou "' + rascunho + '"');
  (await duda.locator('.palavra-outros').count()) === 0 ? ok('não há a lista dos quadros dos outros') : falhou('a lista dos outros apareceu no Juntos');
  await foto(edu, '2-chute-da-duda-no-quadro-do-edu');
  await foto(duda, '3-quadro-da-duda');

  // o Edu termina "termo": a linha é dele, com o nome dele
  for (const k of 'mo') await edu.locator('.palavra-teclado').getByRole('button', { name: k.toUpperCase(), exact: true }).click();
  await edu.locator('.palavra-teclado').getByRole('button', { name: 'Enviar' }).click();
  await duda.locator('.palavra-linha-autor .palavra-autor', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  ok('o chute do Edu aparece no quadro da Duda, com o nome dele');
  await foto(duda, '4-dois-chutes');
  console.log('Fotos em ' + FOTOS);
} catch (e) {
  falhou('erro: ' + (e?.message ?? e));
} finally {
  await browser.close();
  resumo();
}
