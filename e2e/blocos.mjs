// A HORTA EM CASCATA NA SALA (03/11/2026): trocar e combinar, cada um com a sua pilha, e os caixotes indo para o outro.
//
// - A Duda e o Edu estão na Sala 1. A Duda chama a Horta em cascata pela aba Coletivo, o Edu aceita, e ela dá a largada.
// - A Duda joga com o piloto automático (window.blocosPilotoAutomatico, só no site de desenvolvimento), que faz trios e às
//   vezes cadeias e combos; o Edu não toca em nada, e a pilha dele sobe até o topo (com os caixotes que a Duda manda).
// - O servidor refaz as duas partidas: a pilha pequena do Edu aparece na tela da Duda, e quando a dele chega ao topo a
//   partida acaba com a Duda em 1º (as medalhas só no placar final), e o troféu da horta no quarto dela; o Edu, que não
//   trocou nada, fica sem.
// - Depois, a Duda joga sozinha pela aba Solo, nos 2 minutos: a escolha do modo aparece, sem convite.
//
//   node e2e/blocos.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `blocos-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Horta ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Horta'))?.inviteCode;
  });
  const edu = await pessoa();
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
    await p.locator('.rail-item', { hasText: /^H/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('as duas estão na Sala 1');

  // o piloto automático da Duda (só existe no site de desenvolvimento)
  await duda.evaluate(() => {
    window.blocosPilotoAutomatico = true;
  });
  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Horta em cascata' }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.blocos-tela').waitFor({ timeout: 10000 });
  await edu.locator('.blocos-tela').waitFor({ timeout: 10000 });
  ok('a pilha apareceu para os dois');
  (await duda.locator('.blocos-outros li', { hasText: 'edu' + s }).count()) === 1 ? ok('a pilha pequena do Edu está ao lado da da Duda') : falhou('sem a pilha do Edu');
  // o piloto automático pode levar uns segundos para achar a primeira combinação (com o intervalo mínimo entre trocas)
  let pontos = 0;
  for (let i = 0; i < 25 && pontos === 0; i++) {
    await duda.waitForTimeout(1000);
    pontos = Number((await duda.locator('.blocos-topo strong').first().innerText()).replace(/\D/g, ''));
  }
  await foto(duda, 'jogando');
  pontos > 0 ? ok(`a Duda já fez ${pontos} pontos`) : falhou('o piloto não fez ponto nenhum em 25 s');

  // o Edu não joga: a pilha dele sobe até o topo (uns 35 s, menos com os caixotes)
  // (a frase "Sua pilha chegou ao topo." do Edu dura só até o servidor ver o mesmo: com um vivo só, a partida acaba)
  await duda.locator('.minijogo-placar').waitFor({ timeout: 120000 });
  ok('a pilha do Edu chegou ao topo, e a partida acabou');
  const final = (await duda.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') && final[0].includes('duda' + s)
    ? ok(`o placar final: ${final.join(' | ')}`)
    : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'fim');
  const trofeusDe = (pagina) =>
    pagina.evaluate(async () => {
      const r = await fetch('http://localhost:3099/api/corrida-trofeus', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
      return (await r.json()).trofeus;
    });
  const trofeus = await trofeusDe(duda);
  trofeus.some((t) => t.pista === 'blocos' && t.posicao === 1 && t.rivais.length === 1 && t.pontos > 0)
    ? ok(`o troféu da horta está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);
  (await trofeusDe(edu)).some((t) => t.pista === 'blocos') ? falhou('o Edu, que não trocou nada, ganhou troféu') : ok('quem não jogou não sobe ao pódio');

  // sozinha, pela aba Solo, nos 2 minutos
  await duda.locator('.minijogo-acoes').getByRole('button', { name: 'Outros jogos' }).click();
  await duda.waitForTimeout(800);
  if (!(await duda.locator('.minijogo').count())) await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Horta em cascata' }).click();
  await duda.locator('.blocos-modos').getByRole('button', { name: '2 minutos' }).click();
  await duda.locator('.blocos-tela').waitFor({ timeout: 10000 });
  (await edu.locator('.minijogo-convite').count()) === 0 ? ok('no Solo, a horta começa sem convite') : falhou('o Solo convidou a sala');
  await duda.waitForTimeout(7000);
  const relogio = await duda.locator('.blocos-relogio').innerText();
  /^1:5\d$/.test(relogio) ? ok(`o relógio dos 2 minutos anda: ${relogio}`) : falhou(`relógio do Solo: ${relogio}`);
  await foto(duda, 'solo');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('blocos');
}
