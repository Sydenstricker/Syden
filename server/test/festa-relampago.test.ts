/** Quiz relâmpago (festa/relampago.ts): a certa só sai depois do tempo e da folga da rede, e a resposta que chega depois dela não vale. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { CERTAS, ESPERA_MS, PASSO_MS, PERGUNTA_MS, type DadosRelampago } from '../src/festa/relampago.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

const dadosDe = (r: ReturnType<typeof rodadaDeTeste>, quem = ANA) => r.rodada.publico(quem).dados as DadosRelampago;
const certaDe = (d: DadosRelampago, k: number) => d.perguntas[k].ordem.indexOf(CERTAS[d.perguntas[k].q]);

test('relampago: a lista do site tem as mesmas perguntas que a do servidor, com três opções cada', () => {
  const site = readFileSync(new URL('../../web/src/festa/relampago.tsx', import.meta.url), 'utf8');
  const linhas = [...site.matchAll(/\{ p: chave\('[^']+'\), o: \[chave\('[^']+'\), chave\('[^']+'\), chave\('[^']+'\)\] \}/g)];
  assert.equal(linhas.length, CERTAS.length);
  assert.ok(CERTAS.every((c) => c >= 0 && c <= 2));
  assert.ok(CERTAS.length >= 30);
});

test('relampago: a certa não vai à tela antes de a pergunta fechar (com a folga da rede)', () => {
  const r = rodadaDeTeste('relampago', { aleatorio: sorteioFixo(5) });
  assert.deepEqual(dadosDe(r).certas, [null, null, null, null, null]);
  r.em(PERGUNTA_MS + 100);
  assert.equal(dadosDe(r).certas![0], null, 'fechou, mas a resposta atrasada ainda pode chegar');
  r.andar();
  assert.equal(dadosDe(r).certas![0], certaDe(dadosDe(r), 0));
  assert.equal(dadosDe(r).certas![1], null);
});

test('relampago: quem acerta mais ganha, e no empate o mais rápido (com 200 e 300 ms de rede)', () => {
  const r = rodadaDeTeste('relampago', { aleatorio: sorteioFixo(9) });
  const d = dadosDe(r);
  for (let k = 0; k < d.perguntas.length; k++) {
    const certa = certaDe(d, k);
    // a Ana responde em 1,5 s (chega 200 ms depois); a Bia em 2 s (chega 300 ms depois), e erra a última
    r.em(k * PASSO_MS + 1500 + 200);
    r.rodada.acao(ANA, { tipo: 'acerto', k, opcao: certa, ms: 1500 });
    r.em(k * PASSO_MS + 2000 + 300);
    r.rodada.acao(BIA, { tipo: 'acerto', k, opcao: k === 4 ? (certa + 1) % 3 : certa, ms: 2000 });
    // a segunda resposta à mesma pergunta não troca nada
    r.rodada.acao(BIA, { tipo: 'acerto', k, opcao: certa, ms: 2010 });
  }
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).valor, 5);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).valor, 4);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('relampago: responder depois de a certa sair, ou com um tempo que não cabe, ou rápido demais, não vale', () => {
  const r = rodadaDeTeste('relampago', { aleatorio: sorteioFixo(11) });
  const d = dadosDe(r);
  // a Bia espera a certa sair e responde dizendo que foi no último instante
  r.em(PERGUNTA_MS + ESPERA_MS + 20);
  r.rodada.acao(BIA, { tipo: 'acerto', k: 0, opcao: certaDe(d, 0), ms: PERGUNTA_MS });
  // a Ana diz ter respondido em 3 s quando só passaram 0,5 s
  r.em(PASSO_MS + 500);
  r.rodada.acao(ANA, { tipo: 'acerto', k: 1, opcao: certaDe(d, 1), ms: 3000 });
  // e 40 ms depois de a pergunta aparecer não deu para ler: conta como errada
  r.em(2 * PASSO_MS + 40 + 200);
  r.rodada.acao(ANA, { tipo: 'acerto', k: 2, opcao: certaDe(d, 2), ms: 40 });
  r.ateRevelar();
  assert.equal(r.linhaDe(BIA).motivo, 'nada');
  assert.equal(r.linhaDe(ANA).motivo, 'errou');
});

test('relampago: o robô não responde pergunta que ainda não apareceu', () => {
  const r = rodadaDeTeste('relampago');
  r.ateRevelar();
  const d = dadosDe(r);
  for (let s = 1; s < 40; s++) {
    const rob = resultadoDoRobo('relampago', d, sorteioFixo(s), PASSO_MS + 1000);
    assert.ok((rob.valor ?? 0) <= 1, `em 1 pergunta: ${rob.valor}`);
  }
});
