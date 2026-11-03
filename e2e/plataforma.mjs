// O PULO DO COELHO (03/11/2026): a corrida de plataforma, sozinho contra o fantasma e com a turma na sala.
//
// - A Duda e o Edu ficam amigos e entram na Sala 1. O Edu joga o Prado sozinho (aba Solo, com o piloto automático do site
//   de desenvolvimento) e faz o recorde.
// - A Duda abre o Pulo do coelho no Solo: o recorde do Edu aparece em "Correr contra", já marcado. Ela corre pelo teclado
//   (o relógio anda), e o piloto automático termina: a chegada mostra o tempo e "Novo recorde!".
// - Na sala, a Duda chama o Pulo do coelho pela aba Coletivo e escolhe a Toca; o Edu aceita. Os dois veem o semáforo, a
//   ordem ao vivo no canto, e na chegada a lista com os tempos; as medalhas só no fim, e o troféu no quarto dos dois.
//
//   node e2e/plataforma.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const API = 'http://localhost:3099';
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `plataforma-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
const pedir = (pagina, metodo, caminho, corpo) =>
  pagina.evaluate(
    async ({ API, metodo, caminho, corpo }) => {
      const r = await fetch(API + caminho, {
        method: metodo,
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), ...(corpo && { 'content-type': 'application/json' }) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return r.json();
    },
    { API, metodo, caminho, corpo },
  );

/** Abre a estante pela sala de voz, na aba pedida. */
async function estante(p, aba) {
  if (!(await p.locator('.minijogo').count())) await p.getByRole('button', { name: 'Mini-games' }).click();
  await p.locator('.minijogo-abas').getByRole('tab', { name: aba }).click();
}

async function terminarComPiloto(p) {
  await p.evaluate(() => (window.plataformaPilotoAutomatico = true));
  await p.locator('.corrida-fim').waitFor({ timeout: 120000 });
  await p.evaluate(() => (window.plataformaPilotoAutomatico = false));
}

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Pulo ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = (await pedir(duda, 'GET', '/api/communities')).find((c) => c.name.startsWith('Pulo'))?.inviteCode;
  const edu = await pessoa();
  await cadastrar(edu, 'edu' + s);
  await dispensarPresentes(edu);
  await pedir(edu, 'POST', '/api/communities/join', { code: convite });
  await edu.reload();
  await dispensarPresentes(edu);
  await pedir(duda, 'POST', '/api/amigos', { username: 'edu' + s });
  const dudaId = (await pedir(duda, 'GET', '/api/me')).id;
  await pedir(edu, 'POST', `/api/amigos/${dudaId}/aceitar`);
  for (const p of [duda, edu]) {
    await p.locator('.rail-item', { hasText: /^P/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('a Duda e o Edu são amigos e estão na Sala 1');

  // ---- SOLO: o Edu faz o recorde ----
  await estante(edu, 'Solo');
  await edu.locator('.minijogo-jogo', { hasText: 'Pulo do coelho' }).click();
  await edu.locator('.corrida-largada').waitFor({ timeout: 10000 });
  (await edu.getByText('Nenhum amigo jogou esta fase ainda.').count()) ? ok('sem recorde de amigo, a largada diz isso') : falhou('a largada não disse que ninguém jogou');
  await foto(edu, 'largada-vazia');
  await edu.locator('.corrida-largada .btn-primary').click();
  await edu.locator('.pulo-tela canvas').waitFor();
  await terminarComPiloto(edu);
  await edu.locator('.corrida-recorde').waitFor({ timeout: 10000 });
  const tempoEdu = await edu.locator('.corrida-relogio.grande').innerText();
  ok(`o Edu chegou em ${tempoEdu}, com "Novo recorde!"`);
  await foto(edu, 'chegada');
  await edu.locator('.corrida-fim').getByRole('button', { name: 'Outros jogos' }).click();

  // ---- SOLO: a Duda corre contra o fantasma do Edu ----
  await estante(duda, 'Solo');
  await duda.locator('.minijogo-jogo', { hasText: 'Pulo do coelho' }).click();
  const linha = duda.locator('.corrida-fantasmas li', { hasText: 'edu' + s });
  await linha.waitFor({ timeout: 10000 });
  (await linha.locator('input').isChecked()) ? ok('o fantasma do Edu vem marcado') : falhou('o fantasma do Edu não veio marcado');
  (await linha.innerText()).includes(tempoEdu) ? ok('com o tempo dele') : falhou(`a linha diz ${await linha.innerText()}, e não ${tempoEdu}`);
  await foto(duda, 'largada');
  await duda.locator('.corrida-largada .btn-primary').click();
  await duda.locator('.pulo-tela canvas').waitFor();
  await duda.waitForTimeout(3300);
  await duda.keyboard.down('ArrowRight');
  await duda.waitForTimeout(600);
  await duda.keyboard.down('Space');
  await duda.waitForTimeout(400);
  await foto(duda, 'pulando');
  await duda.keyboard.up('Space');
  await duda.keyboard.up('ArrowRight');
  const relogio = await duda.locator('.pulo-placar .corrida-relogio').innerText();
  relogio !== '0:00.00' ? ok(`o relógio anda (${relogio})`) : falhou('o relógio não andou');
  await terminarComPiloto(duda);
  ok(`a Duda chegou em ${await duda.locator('.corrida-relogio.grande').innerText()}`);
  const recordes = (await pedir(duda, 'GET', '/api/plataforma/prado-1')).recordes;
  recordes.length === 2 ? ok('os dois recordes estão no servidor, e a Duda vê os dois') : falhou(JSON.stringify(recordes));
  await duda.locator('.corrida-fim').getByRole('button', { name: 'Outros jogos' }).click();

  // ---- NA SALA: a Toca, os dois juntos ----
  await estante(duda, 'Coletivo');
  await duda.locator('.minijogo-jogo', { hasText: 'Pulo do coelho' }).click();
  await duda.locator('.corrida-escolha').waitFor({ timeout: 5000 });
  await foto(duda, 'escolha');
  await duda.locator('.corrida-pista-botao', { hasText: 'Toca' }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.pulo-tela canvas').waitFor({ timeout: 10000 });
  await edu.locator('.pulo-tela canvas').waitFor({ timeout: 10000 });
  ok('a largada veio para os dois');
  await duda.evaluate(() => (window.plataformaPilotoAutomatico = true));
  await duda.waitForTimeout(6000);
  await edu.evaluate(() => (window.plataformaPilotoAutomatico = true));
  await duda.waitForTimeout(3000);
  const ordem = await duda.locator('.corrida-ordem li').allInnerTexts();
  ordem.length === 2 ? ok(`a ordem ao vivo, no canto: ${ordem.join(' | ')}`) : falhou(`a ordem ao vivo tem ${ordem.length} linhas`);
  await foto(duda, 'sala-correndo');
  await duda.locator('.corrida-classificacao').waitFor({ timeout: 120000 });
  const parcial = (await duda.locator('.corrida-classificacao li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  parcial.some((l) => l.includes('…')) && !parcial.some((l) => l.includes('🥇'))
    ? ok(`a Duda chegou; a lista espera o Edu, sem medalha: ${parcial.join(' | ')}`)
    : falhou(`lista parcial: ${parcial.join(' | ')}`);
  await duda.locator('.minijogo-acoes').waitFor({ timeout: 120000 });
  const final = (await duda.locator('.corrida-classificacao li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') ? ok(`o placar final: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'sala-fim');
  const trofeus = (await pedir(duda, 'GET', '/api/corrida-trofeus')).trofeus;
  trofeus.some((t) => t.pista === 'toca-1' && t.rivais.length === 1)
    ? ok(`o troféu está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('plataforma');
}
