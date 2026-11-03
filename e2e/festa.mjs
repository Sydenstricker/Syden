// A FESTA DOS COELHOS NA SALA (03/11/2026): cinco microjogos, cada um na própria tela.
//
// - A Duda e o Edu estão na Sala 1. A Duda chama a Festa dos coelhos pela aba Coletivo, o Edu aceita, e ela dá a largada.
// - Em cada rodada: o "prepare-se" com o nome, o jogo, e a revelação com a posição e os pontos (sem medalha: só no fim).
//   A Duda joga direito (espera o sinal, acerta o copo pelo estado, caça as cenouras); o Edu aperta o saque antes do sinal
//   (desclassificado) e, no resto, faz o que der.
// - No fim, o placar com as medalhas, e o troféu da festa no quarto de quem ficou no pódio.
// - Depois, a Duda joga sozinha pela aba Solo: o "prepare-se" aparece, sem convite.
//
//   node e2e/festa.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `festa-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());

/** A partida como o servidor a vê (para a Duda saber onde está a cenoura, como quem prestou atenção). */
const estadoDa = (pagina) =>
  pagina.evaluate(async () => {
    const token = localStorage.getItem('janja.token');
    const comunidades = await (await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + token } })).json();
    const festa = comunidades.find((c) => c.name.startsWith('Festa'));
    const canais = await (await fetch(`http://localhost:3099/api/communities/${festa.id}/channels`, { headers: { authorization: 'Bearer ' + token } })).json();
    const sala = canais.find((c) => c.name === 'Sala 1');
    const r = await (await fetch(`http://localhost:3099/api/channels/${sala.id}/minijogo`, { headers: { authorization: 'Bearer ' + token } })).json();
    if (r.partida?.jogo === 'festa') return r.partida;
    // no Solo, a partida é da pessoa
    return (await (await fetch('http://localhost:3099/api/minijogo-solo', { headers: { authorization: 'Bearer ' + token } })).json()).partida;
  });

/** Copia o que os copos fazem: onde a cenoura termina. */
const copoFinal = (d) => {
  let p = d.inicial;
  for (const [a, b] of d.trocas) p = p === a ? b : p === b ? a : p;
  return p;
};

/** Joga uma rodada como der. `bem`: joga direito; senão, de qualquer jeito (e aperta o saque cedo). */
async function jogar(pagina, bem) {
  const palco = pagina.locator('.festa-palco');
  await palco.waitFor({ timeout: 15000 });
  const classe = (await pagina.locator('.festa').getAttribute('class')) ?? '';
  const micro = classe.match(/festa-(saque|forca|relogio|copos|siga|alvo)/)?.[1];
  if (micro === 'saque') {
    if (!bem) return pagina.locator('.festa-saque').dispatchEvent('pointerdown');
    await pagina.locator('.festa-saque.sinal').waitFor({ timeout: 10000 });
    await pagina.waitForTimeout(150);
    await pagina.keyboard.press('Space');
  } else if (micro === 'forca') {
    await pagina.waitForTimeout(bem ? 700 : 300);
    await pagina.keyboard.press('Space');
  } else if (micro === 'relogio') {
    await pagina.waitForTimeout(bem ? 9900 : 6000);
    await pagina.keyboard.press('Space');
  } else if (micro === 'copos') {
    await pagina.locator('.festa-copo.escolhe').first().waitFor({ timeout: 20000 });
    const estado = await estadoDa(pagina);
    const certo = estado?.dados ? copoFinal(estado.dados) : 0;
    await pagina.keyboard.press(String((bem ? certo : (certo + 1) % 3) + 1));
  } else if (micro === 'siga') {
    // a primeira seta, e a errada depois
    const estado = await estadoDa(pagina);
    await pagina.locator('.festa-siga.sua-vez').waitFor({ timeout: 10000 });
    const teclas = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    const primeira = estado?.dados?.setas?.[0] ?? 0;
    await pagina.keyboard.press(teclas[bem ? primeira : (primeira + 1) % 4]);
    if (bem) {
      await pagina.waitForTimeout(2500);
      await pagina.keyboard.press(teclas[(estado.dados.setas[0] + 1) % 4]);
    }
  } else if (micro === 'alvo') {
    const fim = Date.now() + 21000;
    while (Date.now() < fim && (await pagina.locator('.festa-alvo').count())) {
      const cenoura = pagina.locator('.festa-alvo-casa:has(.festa-cenoura)').first();
      if (bem && (await cenoura.count())) await cenoura.dispatchEvent('pointerdown').catch(() => {});
      await pagina.waitForTimeout(120);
    }
  }
  return micro;
}

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Festa ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Festa'))?.inviteCode;
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
    await p.locator('.rail-item', { hasText: /^F/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('as duas estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Festa dos coelhos' }).click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.festa-preparo').waitFor({ timeout: 10000 });
  await edu.locator('.festa-preparo').waitFor({ timeout: 10000 });
  ok('o "prepare-se" veio para as duas');
  await foto(duda, 'preparo');

  const vistos = [];
  for (let rodada = 1; rodada <= 5; rodada++) {
    const [micro] = await Promise.all([jogar(duda, true), jogar(edu, false)]);
    vistos.push(micro);
    await foto(duda, `jogo-${rodada}-${micro}`);
    await duda.locator('.festa-revelacao').waitFor({ timeout: 60000 });
    const linhas = (await duda.locator('.festa-revelacao li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
    linhas.length === 2 && !linhas.some((l) => /🥇|🥈|🥉/.test(l))
      ? ok(`rodada ${rodada} (${micro}): ${linhas.join(' | ')}`)
      : falhou(`revelação da rodada ${rodada}: ${linhas.join(' | ')}`);
    if (micro === 'saque') {
      linhas.some((l) => l.includes('edu' + s) && l.includes('Cedo demais!')) ? ok('o Edu apertou antes do sinal e ficou fora') : falhou('o saque cedo não apareceu');
    }
    await foto(duda, `revelacao-${rodada}`);
    if (rodada < 5) await duda.locator('.festa-preparo').waitFor({ timeout: 15000 });
  }
  new Set(vistos).size === 5 ? ok(`cinco microjogos sem repetir: ${vistos.join(', ')}`) : falhou(`microjogos: ${vistos.join(', ')}`);

  await duda.locator('.minijogo-acoes').waitFor({ timeout: 20000 });
  const final = (await duda.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') ? ok(`o placar final: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'fim');
  const trofeus = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/corrida-trofeus', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).trofeus;
  });
  trofeus.some((t) => t.pista === 'festa' && t.rivais.length === 1)
    ? ok(`o troféu da festa está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);

  // sozinha, pela aba Solo
  await duda.locator('.minijogo-acoes').getByRole('button', { name: 'Outros jogos' }).click();
  await duda.waitForTimeout(800);
  if (!(await duda.locator('.minijogo').count())) await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Festa dos coelhos' }).click();
  await duda.locator('.festa-preparo').waitFor({ timeout: 10000 });
  (await edu.locator('.minijogo-convite').count()) === 0 ? ok('no Solo, a festa começa sem convite') : falhou('o Solo convidou a sala');
  const micro = await jogar(duda, true);
  await duda.locator('.festa-revelacao').waitFor({ timeout: 60000 });
  ok(`no Solo, a primeira rodada (${micro}) revela sozinha`);
  await foto(duda, 'solo');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('festa');
}
