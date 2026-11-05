// OS CLÁSSICOS DE MESA (04/11/2026): Damas, Batalha naval, Dominó e Truco, de ponta a ponta, com duas pessoas na sala de voz.
//
// - A Duda cria a comunidade, o Edu entra, os dois vão para a Sala 1.
// - Damas e Batalha naval são de MESA: a Duda começa e senta, o Edu senta do outro lado pelo convite.
// - Dominó e Truco vão pelo convite: o Edu aceita, a Duda dá a largada.
// - Em cada um, os dois jogam algumas vezes de verdade, clicando na tela.
//
//   node e2e/classicos.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `classicos-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async (largura = 1400) =>
  vigiar(await (await browser.newContext({ viewport: { width: largura, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Mesa ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Mesa'))?.inviteCode;
  });

  // O Edu numa tela estreita, como um celular de lado: as mesas precisam caber.
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
  await edu.locator('.rail-item', { hasText: /^M/ }).first().click();
  for (const p of [duda, edu]) {
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os dois estão na Sala 1');

  const comecar = async (nome) => {
    if ((await duda.locator('.minijogo-estante').count()) === 0) await duda.getByRole('button', { name: 'Mini-games' }).click();
    await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
    await duda.locator('.minijogo-jogo', { hasText: nome }).click();
  };
  const encerrar = async () => {
    await duda.getByRole('button', { name: /^(Encerrar partida|Outros jogos)$/ }).click();
    await edu.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
    await duda.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
  };
  const aceitarELargar = async () => {
    await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
    await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
    await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
    await duda.getByRole('button', { name: 'Começar' }).click();
  };
  /** Quem tem a vez agora (o seletor diz "é a minha vez" nesta tela). */
  const daVez = async (seletor, tempo = 10000) => {
    const fim = Date.now() + tempo;
    while (Date.now() < fim) {
      for (const p of [duda, edu]) if ((await p.locator(seletor).count()) > 0) return p;
      await duda.waitForTimeout(150);
    }
    return null;
  };
  /** A tela cabe na largura, sem barra de rolagem de lado dentro do painel. */
  const cabe = async (p, nome) => {
    const estouro = await p.locator('.minijogo').evaluate((el) => el.scrollWidth - el.clientWidth);
    (estouro <= 1 ? ok : falhou)(`${nome}: o painel cabe na largura (${estouro} px de estouro)`);
  };

  // ---- Damas ----
  await comecar('Damas');
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Sentar' }).click();
  await duda.locator('.damas').waitFor({ timeout: 10000 });
  (await duda.locator('.damas-peca').count()) === 24 ? ok('Damas: 24 peças no tabuleiro') : falhou(`Damas: ${await duda.locator('.damas-peca').count()} peças`);
  let lances = 0;
  for (let k = 0; k < 4; k++) {
    const p = await daVez('.duelo-damas .minijogo-situacao.minha-vez');
    if (!p) break;
    const outro = p === duda ? edu : duda;
    // Escolhe uma peça que pode andar (com uma só, ela já vem escolhida) e clica no destino marcado, até a vez passar.
    for (let c = 0; c < 6 && (await p.locator('.duelo-damas .minijogo-situacao.minha-vez').count()) > 0; c++) {
      if ((await p.locator('.damas-casa.destino').count()) > 0) await p.locator('.damas-casa.destino').first().click();
      else await p.locator('.damas button:not([disabled])').first().click();
      await p.waitForTimeout(250);
    }
    await outro.locator('.duelo-damas .minijogo-situacao.minha-vez').waitFor({ timeout: 5000 });
    lances++;
  }
  (lances === 4 ? ok : falhou)(`Damas: ${lances} lances jogados pela tela, a vez alternando`);
  await foto(duda, 'damas');
  await foto(edu, 'damas-edu');
  await cabe(edu, 'Damas');
  await encerrar();

  // ---- Batalha naval ----
  await comecar('Batalha naval');
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Sentar' }).click();
  await duda.locator('.naval-mares').waitFor({ timeout: 10000 });
  const navios = await duda.locator('.naval-mar.meu .naval-navio').count();
  const naviosDoOutro = await duda.locator('.naval-mar.alvo .naval-navio').count();
  navios === 5 && naviosDoOutro === 0 ? ok('Batalha naval: a Duda vê os 5 navios dela e nenhum do Edu') : falhou(`Batalha naval: ${navios} meus, ${naviosDoOutro} do outro à vista`);
  // Quem não tem a vez sorteia a frota de novo.
  const atirador = await daVez('.duelo-naval .minijogo-situacao.minha-vez');
  const quemEspera = atirador === duda ? edu : duda;
  const antes = await quemEspera.locator('.naval-mar.meu').innerHTML();
  await quemEspera.locator('.naval-sortear').click();
  await quemEspera.waitForTimeout(600);
  ((await quemEspera.locator('.naval-mar.meu').innerHTML()) !== antes ? ok : falhou)('Batalha naval: "Sortear de novo" troca a frota antes do primeiro tiro');
  let tiros = 0;
  for (let k = 0; k < 6; k++) {
    const p = await daVez('.duelo-naval .minijogo-situacao.minha-vez');
    if (!p) break;
    await p.locator('.naval-mar.alvo .naval-casa:not([disabled])').nth(k * 7).click();
    await p.locator('.naval-resultado').waitFor({ timeout: 5000 });
    tiros++;
    await p.waitForTimeout(300);
  }
  (tiros === 6 ? ok : falhou)(`Batalha naval: ${tiros} tiros dados pela tela`);
  ((await duda.locator('.naval-casa.agua, .naval-casa.fogo').count()) >= 6 ? ok : falhou)('Batalha naval: os tiros aparecem nos mares');
  await foto(duda, 'naval');
  await foto(edu, 'naval-edu');
  await cabe(edu, 'Batalha naval');
  await encerrar();

  // ---- Dominó ----
  await comecar('Dominó');
  await aceitarELargar();
  await duda.locator('.domino-jogo').waitFor({ timeout: 15000 });
  (await duda.locator('.dom-minha-mao .dom-pedra-botao').count()) === 7 ? ok('Dominó: a Duda tem 7 pedras na mão') : falhou(`Dominó: ${await duda.locator('.dom-minha-mao .dom-pedra-botao').count()} pedras na mão`);
  let jogadas = 0;
  for (let k = 0; k < 8; k++) {
    const p = await daVez('.domino-jogo .dom-pedra-botao.serve, .domino-jogo .minijogo-acoes .btn-primary');
    if (!p) break;
    const comprar = p.locator('.dom-vez .btn-primary', { hasText: 'Comprar' });
    if ((await comprar.count()) > 0) await comprar.click();
    else {
      await p.locator('.dom-pedra-botao.serve').first().click();
      await p.waitForTimeout(200);
      const lado = p.locator('.dom-lados button');
      if ((await lado.count()) > 0) await lado.first().click();
      jogadas++;
    }
    await p.waitForTimeout(500);
  }
  const naMesa = await duda.locator('.dom-na-mesa').count();
  (jogadas >= 4 && naMesa >= 4 ? ok : falhou)(`Dominó: ${jogadas} pedras jogadas pela tela, ${naMesa} na mesa`);
  await foto(duda, 'domino');
  await foto(edu, 'domino-edu');
  await cabe(edu, 'Dominó');
  await encerrar();

  // ---- Truco ----
  await comecar('Truco');
  await aceitarELargar();
  await duda.locator('.truco-mesa').waitFor({ timeout: 15000 });
  (await duda.locator('.truco-mao button').count()) === 3 ? ok('Truco: a Duda tem 3 cartas na mão') : falhou(`Truco: ${await duda.locator('.truco-mao button').count()} cartas`);
  // Quem tem a vez pede truco, e o outro aceita.
  const pede = await daVez('.truco-gritar');
  if (pede) {
    await pede.locator('.truco-gritar').click();
    const responde = pede === duda ? edu : duda;
    await responde.getByRole('button', { name: 'Aceitar' }).click();
    await duda.locator('.truco-valor', { hasText: '3' }).waitFor({ timeout: 5000 });
    ok('Truco: pediu truco, o outro aceitou, e a mão vale 3');
  } else falhou('Truco: ninguém pôde pedir truco');
  await foto(duda, 'truco-pedido');
  let cartas = 0;
  for (let k = 0; k < 6; k++) {
    const p = await daVez('.truco-mao button:not([disabled])');
    if (!p) break;
    await p.locator('.truco-mao button:not([disabled])').first().click();
    cartas++;
    await p.waitForTimeout(400);
  }
  (cartas >= 4 ? ok : falhou)(`Truco: ${cartas} cartas jogadas pela tela`);
  await foto(duda, 'truco');
  await foto(edu, 'truco-edu');
  await cabe(edu, 'Truco');
  await encerrar();
} finally {
  await browser.close();
}
resumo('Clássicos de mesa');
