// O TABULEIRO DA TURMA NA SALA (03/11/2026): dado, casas, a cenoura dourada e um microjogo da Festa depois de cada rodada.
//
// - A Duda e o Edu estão na Sala 1. A Duda escolhe o Tabuleiro da turma pela aba Coletivo, com 5 rodadas; o Edu aceita, e
//   ela dá a largada.
// - Cada um joga o dado na sua vez pelo botão. Na loja da cenoura dourada, a Duda compra e o Edu diz "Agora não".
// - Depois de cada rodada, o microjogo: a Duda joga direito, o Edu como der.
// - No fim, o placar com as medalhas, e o troféu do tabuleiro no quarto de quem ficou no pódio.
//
//   node e2e/tabuleiro.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `tabuleiro-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());

/** A partida como o servidor a vê (para saber de quem é a vez, e onde está a cenoura nos copos). */
const estadoDa = (pagina) =>
  pagina.evaluate(async () => {
    const token = localStorage.getItem('janja.token');
    const comunidades = await (await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + token } })).json();
    const turma = comunidades.find((c) => c.name.startsWith('Tabuleiro'));
    const canais = await (await fetch(`http://localhost:3099/api/communities/${turma.id}/channels`, { headers: { authorization: 'Bearer ' + token } })).json();
    const sala = canais.find((c) => c.name === 'Sala 1');
    const r = await (await fetch(`http://localhost:3099/api/channels/${sala.id}/minijogo`, { headers: { authorization: 'Bearer ' + token } })).json();
    return r.partida;
  });
const meuId = (pagina) =>
  pagina.evaluate(async () => (await (await fetch('http://localhost:3099/api/me', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } })).json()).id);

const copoFinal = (d) => {
  let p = d.inicial;
  for (const [a, b] of d.trocas) p = p === a ? b : p === b ? a : p;
  return p;
};

/** Um microjogo da Festa, como der (o mesmo de e2e/festa.mjs, com os dados vindos de `mini`). */
async function jogarMicro(pagina, bem, mini) {
  const micro = mini.microjogo;
  await pagina.locator('.festa-palco').waitFor({ timeout: 15000 });
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
    const certo = copoFinal(mini.dados);
    await pagina.keyboard.press(String((bem ? certo : (certo + 1) % 3) + 1));
  } else if (micro === 'siga') {
    await pagina.locator('.festa-siga.sua-vez').waitFor({ timeout: 10000 });
    const teclas = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    const primeira = mini.dados.setas[0];
    await pagina.keyboard.press(teclas[bem ? primeira : (primeira + 1) % 4]);
    if (bem) {
      await pagina.waitForTimeout(2500);
      await pagina.keyboard.press(teclas[(primeira + 1) % 4]);
    }
  } else if (micro === 'alvo') {
    const fim = Date.now() + 21000;
    while (Date.now() < fim && (await pagina.locator('.festa-alvo').count())) {
      const cenoura = pagina.locator('.festa-alvo-casa:has(.festa-cenoura)').first();
      if (bem && (await cenoura.count())) await cenoura.dispatchEvent('pointerdown').catch(() => {});
      await pagina.waitForTimeout(120);
    }
  }
}

/** Joga a partida inteira por uma pessoa. Devolve o que se viu. */
async function jogarPartida(pagina, bem) {
  const eu = await meuId(pagina);
  const visto = { vezes: 0, compras: 0, micros: [] };
  let microFeito = 0;
  const ate = Date.now() + 15 * 60_000;
  while (Date.now() < ate) {
    const e = await estadoDa(pagina);
    if (!e || e.terminada || e.fase === 'fim') break;
    if (e.fase === 'minijogo' && e.mini?.fase === 'jogando' && microFeito !== e.rodada) {
      microFeito = e.rodada;
      visto.micros.push(e.mini.microjogo);
      await jogarMicro(pagina, bem, e.mini).catch(() => {});
    } else if (e.fase === 'vez' && e.vez === eu) {
      const botao = pagina.getByRole('button', { name: 'Jogar o dado' });
      if (await botao.isEnabled().catch(() => false)) {
        await botao.click();
        visto.vezes++;
      }
    } else if (e.fase === 'loja' && e.vez === eu) {
      const botao = pagina.locator('.tab-vez').getByRole('button', { name: bem ? 'Comprar' : 'Agora não' });
      if (await botao.isEnabled().catch(() => false)) {
        await botao.click();
        if (bem) visto.compras++;
      }
    }
    await pagina.waitForTimeout(300);
  }
  return visto;
}

try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Tabuleiro ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Tabuleiro'))?.inviteCode;
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
    await p.locator('.rail-item', { hasText: /^T/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('as duas estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  (await duda.locator('.minijogo-jogo', { hasText: 'Tabuleiro da turma' }).count()) === 0
    ? ok('o tabuleiro não está na aba Solo')
    : falhou('o tabuleiro apareceu no Solo');
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Tabuleiro da turma' }).click();
  await duda.locator('.tab-rodadas-botao', { hasText: '5' }).first().click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.tab-tabuleiro').waitFor({ timeout: 10000 });
  await edu.locator('.tab-tabuleiro').waitFor({ timeout: 10000 });
  ok('o tabuleiro veio para as duas');
  await foto(duda, 'comeco');
  const rodadas = (await estadoDa(duda)).rodadas;
  rodadas === 5 ? ok('5 rodadas, como escolhido') : falhou(`rodadas: ${rodadas}`);

  const [daDuda, doEdu] = await Promise.all([jogarPartida(duda, true), jogarPartida(edu, false)]);
  daDuda.vezes >= 5 && doEdu.vezes >= 5 ? ok(`cada um jogou o dado (${daDuda.vezes} e ${doEdu.vezes})`) : falhou(`vezes: ${daDuda.vezes} e ${doEdu.vezes}`);
  daDuda.micros.length === 5 ? ok(`cinco microjogos: ${daDuda.micros.join(', ')}`) : falhou(`microjogos: ${daDuda.micros.join(', ')}`);
  ok(`a Duda comprou ${daDuda.compras} cenoura(s) dourada(s)`);

  await duda.locator('.minijogo-placar').waitFor({ timeout: 20000 });
  const final = (await duda.locator('.minijogo-placar li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') ? ok(`o placar final: ${final.join(' | ')}`) : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'fim');
  const trofeus = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/corrida-trofeus', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).trofeus;
  });
  trofeus.some((t) => t.pista === 'tabuleiro' && t.rivais.length === 1)
    ? ok(`o troféu do tabuleiro está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('tabuleiro');
}
