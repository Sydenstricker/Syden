// A CORRIDA DOS COELHOS NA SALA (03/11/2026, degraus 2 e 3): a turma corre junto, ao vivo, a Copa da Cenoura inteira.
//
// - A Duda, o Edu e o Caio estão na Sala 1. A Duda chama a corrida pela aba Coletivo e escolhe a Copa da Cenoura; o Edu
//   aceita, o Caio diz "Agora não" (ele assiste).
// - Na largada, os dois veem o semáforo do servidor; durante a corrida, cada um vê o kart do outro com o nome em cima e a
//   ordem ao vivo no canto, e o Caio vê a corrida pela câmera de quem está na frente.
// - O Edu larga 2 s atrasado: a Duda chega primeiro e vê a lista com o tempo dela e "…" para o Edu; quando o Edu chega,
//   a corrida acaba; entre uma corrida e outra, o placar da copa. As três pistas, com os itens (o piloto automático usa o
//   item assim que pega), e no fim o placar com as medalhas e o troféu da copa no quarto dos dois.
//
//   node e2e/corrida-na-sala.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
//   SO_HORTA=1 node e2e/corrida-na-sala.mjs   (uma corrida só, na Horta, sem a copa: ~2 min em vez de ~5)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const SO_HORTA = process.env.SO_HORTA === '1';
const foto = (pagina, nome) => pagina.locator('.minijogo').screenshot({ path: path.join(FOTOS, `corrida-sala-${nome}.png`) });

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['microphone', 'camera'] })).newPage());
try {
  const duda = await pessoa();
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);
  await duda.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await duda.locator('.community-choice-option').first().click();
  await duda.locator('form.dialog input').first().fill('Kart ' + s);
  await duda.locator('form.dialog .btn-primary').click();
  await duda.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Kart'))?.inviteCode;
  });
  const entrar = async (nome) => {
    const p = await pessoa();
    await cadastrar(p, nome + s);
    await dispensarPresentes(p);
    await p.evaluate(
      async (codigo) =>
        fetch('http://localhost:3099/api/communities/join', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
          body: JSON.stringify({ code: codigo }),
        }),
      convite,
    );
    await p.reload();
    await dispensarPresentes(p);
    return p;
  };
  const edu = await entrar('edu');
  const caio = await entrar('caio');
  for (const p of [duda, edu, caio]) {
    await p.locator('.rail-item', { hasText: /^K/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('os três estão na Sala 1');

  await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Coletivo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Corrida dos coelhos' }).click();
  await duda.locator('.corrida-escolha').waitFor({ timeout: 5000 });
  await foto(duda, 'escolha');
  await duda.locator(SO_HORTA ? '.corrida-pista-botao:not(.copa)' : '.corrida-pista-botao.copa').first().click();
  await edu.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await edu.locator('.minijogo-convite').getByRole('button', { name: 'Jogar' }).click();
  await caio.locator('.minijogo-convite').waitFor({ timeout: 10000 });
  await caio.locator('.minijogo-convite').getByRole('button', { name: 'Agora não' }).click();
  await duda.locator('.minijogo-espera-lista li', { hasText: 'edu' + s }).waitFor({ timeout: 5000 });
  await duda.getByRole('button', { name: 'Começar' }).click();
  await duda.locator('.corrida-tela canvas').waitFor({ timeout: 10000 });
  await edu.locator('.corrida-tela canvas').waitFor({ timeout: 10000 });
  ok('a largada veio para os dois');

  // a Duda vai com o piloto automático desde o verde; o Edu, 2 s depois
  await duda.evaluate(() => (window.corridaPilotoAutomatico = true));
  await duda.waitForTimeout(6000);
  await edu.evaluate(() => (window.corridaPilotoAutomatico = true));
  await duda.waitForTimeout(3000);
  const ordem = await duda.locator('.corrida-ordem li').allInnerTexts();
  ordem.length === 2 ? ok(`a ordem ao vivo, no canto: ${ordem.join(' | ')}`) : falhou(`a ordem ao vivo tem ${ordem.length} linhas`);
  await foto(duda, 'correndo-duda');
  await foto(edu, 'correndo-edu');
  // o Caio assiste: abre os Mini-games e cai na corrida, pela câmera de quem está na frente
  await caio.getByRole('button', { name: 'Mini-games' }).click().catch(() => {});
  await caio.locator('.corrida-tela canvas').waitFor({ timeout: 10000 });
  await caio.waitForTimeout(1500);
  await foto(caio, 'assistindo');
  (await caio.locator('.corrida-ordem li').count()) === 2 ? ok('quem assiste vê a corrida e a ordem') : falhou('quem assiste não vê a ordem');

  await duda.locator('.corrida-classificacao').waitFor({ timeout: 120000 });
  const parcial = await duda.locator('.corrida-classificacao li').allInnerTexts();
  parcial.some((l) => l.includes('…')) ? ok(`a Duda chegou; a lista espera o Edu: ${parcial.join(' | ').replace(/\n/g, ' ')}`) : falhou(`lista parcial: ${parcial.join(' | ')}`);
  await foto(duda, 'esperando');
  if (!SO_HORTA) {
  // o intervalo da copa: o placar somado
  await duda.locator('.corrida-placar-da-copa').waitFor({ timeout: 60000 });
  const placar1 = (await duda.locator('.corrida-placar-da-copa .corrida-classificacao li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  placar1.length === 2 && /\b(10|8)\b/.test(placar1[0]) ? ok(`o intervalo mostra o placar da copa: ${placar1.join(' | ')}`) : falhou(`placar da copa: ${placar1.join(' | ')}`);
  await foto(duda, 'intervalo');
  // a segunda pista
  await duda.locator('.corrida-copa-topo', { hasText: 'Pomar' }).waitFor({ timeout: 30000 });
  await duda.locator('.corrida-tela canvas').waitFor({ timeout: 10000 });
  await duda.waitForTimeout(9000);
  await foto(duda, 'pomar');
  ok('a segunda corrida da copa é no Pomar');
  await duda.locator('.corrida-copa-topo', { hasText: 'Praia' }).waitFor({ timeout: 200000 });
  await duda.waitForTimeout(9000);
  await foto(duda, 'praia');
  ok('a terceira é na Praia');
  }

  await edu.locator('.minijogo-acoes').waitFor({ timeout: 200000 });
  await duda.locator('.minijogo-acoes').waitFor({ timeout: 10000 });
  const final = (await duda.locator('.corrida-classificacao li').allInnerTexts()).map((l) => l.replace(/\n/g, ' '));
  final.length === 2 && final[0].includes('🥇') && final[1].includes('🥈')
    ? ok(`o placar final da copa: ${final.join(' | ')}`)
    : falhou(`placar final: ${final.join(' | ')}`);
  await foto(duda, 'fim');
  // os troféus: a copa, no quarto dos dois (e a Duda abre a estante pelo Solo da corrida)
  const trofeus = await duda.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/corrida-trofeus', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).trofeus;
  });
  trofeus.some((t) => t.pista === (SO_HORTA ? 'horta-1' : 'copa-da-cenoura') && t.rivais.length === 1)
    ? ok(`o troféu da copa está no quarto da Duda: ${trofeus.map((t) => `${t.pista} ${t.posicao}º`).join(', ')}`)
    : falhou(`troféus da Duda: ${JSON.stringify(trofeus)}`);
  await duda.locator('.minijogo-acoes').getByRole('button', { name: 'Outros jogos' }).click();
  // (sair do placar fecha o painel, como em todo jogo da sala: abre de novo)
  await duda.waitForTimeout(800);
  if (!(await duda.locator('.minijogo').count())) await duda.getByRole('button', { name: 'Mini-games' }).click();
  await duda.locator('.minijogo-abas').getByRole('tab', { name: 'Solo' }).click();
  await duda.locator('.minijogo-jogo', { hasText: 'Corrida dos coelhos' }).click();
  await duda.locator('.corrida-largada').getByRole('button', { name: 'Troféus' }).click();
  await duda.locator('.trofeus-lista li').first().waitFor({ timeout: 10000 });
  await duda.locator('.dialog.trofeus').screenshot({ path: path.join(FOTOS, 'corrida-sala-trofeus.png') });
  const linhaDoTrofeu = await duda.locator('.trofeus-lista li').first().innerText();
  linhaDoTrofeu.includes(SO_HORTA ? 'Horta' : 'Copa da Cenoura') && linhaDoTrofeu.includes('edu' + s) ? ok('a estante mostra a copa, contra o Edu') : falhou(`troféu: ${linhaDoTrofeu}`);
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('corrida-na-sala');
}
