// O MINIGOLFE DA TOCA NA SALA (03/11/2026): seis buracos, todos no mesmo ao mesmo tempo, cada um na própria tela.
//
// - A Duda e o Edu estão na Sala 1. A Duda chama o Minigolfe da toca pela aba Coletivo, o Edu aceita, e ela dá a largada.
// - Os dois jogam com o piloto automático do site de desenvolvimento (window.golfePilotoAutomatico), que dá tacadas de
//   verdade: arrasto nenhum, mas o mesmo caminho até o servidor, que simula cada uma.
// - No primeiro buraco, a Duda dá uma tacada pelo mouse (puxando a bola para trás), e o contador de tacadas sobe.
// - Entre os buracos, o placar com "Neste buraco" e "Total"; no fim, o placar com as medalhas, e o troféu no quarto.
// - Depois, a Duda joga sozinha pela aba Solo: o buraco aparece, sem convite.
//
//   node e2e/golfe.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `golfe-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Golfe ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Golfe'))?.inviteCode;
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
    await p.locator('.rail-item', { hasText: /^G/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('as duas estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Minigolfe da toca' }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.golfe-tela').waitFor({ timeout: 10000 });
  await edu.locator('.golfe-tela').waitFor({ timeout: 10000 });
  ok('o primeiro buraco apareceu para os dois');
  await foto(duda, 'preparo');

  // a tacada pelo mouse: puxar a bola para trás (a saída do buraco 1 é em 34, 64 numa mesa de 192 × 128)
  await duda.locator('.golfe-tacadas').waitFor({ timeout: 10000 });
  await duda.waitForTimeout(3500);
  const caixa = await duda.locator('.golfe-tela').boundingBox();
  const px = (x, y) => [caixa.x + (x * caixa.width) / 192, caixa.y + (y * caixa.height) / 128];
  await duda.mouse.move(...px(34, 64));
  await duda.mouse.down();
  await duda.mouse.move(...px(14, 66), { steps: 6 });
  await foto(duda, 'mira');
  await duda.mouse.up();
  await duda.waitForTimeout(400);
  const contador = await duda.locator('.golfe-tacadas').innerText();
  /1/.test(contador) ? ok(`a tacada pelo mouse contou: "${contador}"`) : falhou(`o contador depois da tacada: "${contador}"`);

  await duda.evaluate(() => (window.golfePilotoAutomatico = true));
  await edu.evaluate(() => (window.golfePilotoAutomatico = true));
  for (let buraco = 1; buraco < 6; buraco++) {
    await duda.locator('.golfe-placar').waitFor({ timeout: 90000 });
    const linhas = (await duda.locator('.golfe-placar tbody tr').allInnerTexts()).map((l) => l.replace(/\s+/g, ' '));
    linhas.length === 2 ? ok(`placar depois do buraco ${buraco}: ${linhas.join(' | ')}`) : falhou(`placar do buraco ${buraco}: ${linhas.join(' | ')}`);
    if (buraco === 1) await foto(duda, 'placar');
    await duda.locator('.golfe-tela').waitFor({ timeout: 15000 });
    if (buraco === 4) await foto(duda, 'porteira');
  }

  await duda.locator('.minijogo-acoes').waitFor({ timeout: 90000 });
  const final = (await duda.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') ? ok(`o placar final: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'fim');
  const trofeus = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/corrida-trofeus', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).trofeus;
  });
  trofeus.some((t) => t.pista === 'golfe' && t.rivais.length === 1)
    ? ok(`o troféu do minigolfe está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º ${t.pontos}`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);

  // sozinha, pela aba Solo
  await duda.locator('.minijogo-acoes').getByRole('button', { name: 'Outros jogos' }).click();
  await duda.waitForTimeout(800);
  if (!(await duda.locator('.minijogo').count())) await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Minigolfe da toca' }).click();
  await duda.locator('.golfe-tela').waitFor({ timeout: 10000 });
  (await edu.locator('.minijogo-convite').count()) === 0 ? ok('no Solo, o minigolfe começa sem convite') : falhou('o Solo convidou a sala');
  await duda.locator('.golfe-placar').waitFor({ timeout: 60000 });
  ok('no Solo, o primeiro buraco fecha sozinho quando a bola entra');
  await foto(duda, 'solo');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('golfe');
}
