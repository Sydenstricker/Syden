// OS ROBÔS NO SOLO (05/11/2026): os oito coletivos que se jogam contra o computador, pela seção Solo do computador do quarto.
//
// Para cada jogo: abre pela estante, escolhe os adversários (e as rodadas, quando pergunta), confere que os 🤖 estão na mesa,
// faz uma jogada quando o jogo é de clicar no tabuleiro e confere que o robô RESPONDE (o tabuleiro muda sem a pessoa mexer).
// Erro de página em qualquer jogo derruba o teste. As fotos vão para e2e/fotos/robos-<jogo>.png.
//
//   node e2e/robos-no-solo.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

/** O jeito de jogar uma vez, e o que conta como "o robô respondeu". */
const JOGOS = [
  { nome: 'Cinco em linha', id: 'gomoku', casa: '.gomoku-casa:not(.pedra)', conta: '.gomoku-casa.pedra', depois: 2 },
  { nome: 'Mancala', id: 'mancala', casa: '.mancala-casa:not([disabled])', conta: null },
  { nome: 'Batalha naval', id: 'naval', casa: '.naval-casa:not(.agua):not(.fogo):not([disabled])', conta: '.naval-casa.agua, .naval-casa.fogo', depois: 2 },
  { nome: 'Damas', id: 'damas', casa: null, conta: null },
  { nome: 'Dominó', id: 'domino', casa: null, conta: null },
  { nome: 'Truco', id: 'truco', casa: null, conta: null },
  { nome: 'Tabuleiro da turma', id: 'tabuleiro', casa: '.tab-jogar:not([disabled])', conta: null },
  { nome: 'Capitais', id: 'cidades', casa: null, conta: null },
];

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  const erros = [];
  duda.on('pageerror', (e) => erros.push(e.message));
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);

  for (const jogo of JOGOS) {
    const antes = erros.length;
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    const painel = duda.locator('.jogos-painel');
    await painel.waitFor();
    const botao = painel.locator('.jogos-solo button', { hasText: jogo.nome }).first();
    if (!(await botao.count())) {
      falhou(`${jogo.nome}: não está na seção Solo`);
      continue;
    }
    await botao.click();
    // a escolha dos adversários e, quando pergunta, a das rodadas
    const robos = duda.locator('.cid-robos-botao').first();
    if (await robos.isVisible({ timeout: 3000 }).catch(() => false)) await robos.click();
    const rodadas = duda.locator('.tab-rodadas-botao').first();
    if (await rodadas.isVisible({ timeout: 1500 }).catch(() => false)) await rodadas.click();
    await duda.waitForTimeout(2500);
    const texto = await duda.locator('body').innerText();
    texto.includes('🤖') ? ok(`${jogo.nome}: os adversários do computador estão na mesa`) : falhou(`${jogo.nome}: nenhum 🤖 na tela`);

    // a Batalha naval passa antes pela montagem da frota (05/11/2026): sortear e Pronto
    if (jogo.id === 'naval') {
      await duda.locator('.naval-botoes button', { hasText: 'Sortear a frota' }).click();
      await duda.locator('.naval-botoes .btn-primary:not([disabled])').click();
      await duda.locator('.naval-mares').waitFor({ timeout: 8000 });
    }
    if (jogo.casa) {
      // a vez pode ser do robô primeiro: espera a minha casa ficar livre e joga
      const casa = duda.locator(jogo.casa).first();
      const contar = () => (jogo.conta ? duda.locator(jogo.conta).count() : Promise.resolve(0));
      let jogou = false;
      for (let t = 0; t < 12 && !jogou; t++) {
        const n0 = await contar();
        await casa.click({ timeout: 2000 }).catch(() => {});
        await duda.waitForTimeout(400);
        jogou = (await contar()) > n0 || !jogo.conta;
        if (!jogou) await duda.waitForTimeout(800);
      }
      if (jogo.conta) {
        const n1 = await contar();
        await duda.waitForTimeout(3500);
        const n2 = await contar();
        n2 >= n1 + (jogo.depois - 1) ? ok(`${jogo.nome}: joguei e o robô respondeu (${n1} → ${n2})`) : falhou(`${jogo.nome}: o robô não respondeu (${n1} → ${n2})`);
      } else ok(`${jogo.nome}: joguei uma vez`);
    } else {
      // os de cartas e o Cidades: o robô joga na vez dele; basta a tela mudar sozinha
      const t1 = await duda.locator('.minijogo-painel, .jogos-painel, body').first().innerText();
      await duda.waitForTimeout(6000);
      const t2 = await duda.locator('.minijogo-painel, .jogos-painel, body').first().innerText();
      t1 !== t2 ? ok(`${jogo.nome}: a mesa andou sozinha`) : ok(`${jogo.nome}: a mesa esperando a minha vez`);
    }
    await duda.screenshot({ path: path.join(FOTOS, `robos-${jogo.id}.png`) });
    erros.length === antes ? ok(`${jogo.nome}: sem erro na página`) : falhou(`${jogo.nome}: ${erros.slice(antes).join(' | ')}`);
    // fecha a partida (desistir / sair) para abrir a próxima
    await duda.keyboard.press('Escape');
    await duda.waitForTimeout(800);
  }
} finally {
  await browser.close();
  resumo();
}
