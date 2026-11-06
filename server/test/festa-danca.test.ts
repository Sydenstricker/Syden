/** Quem dançou em terceiro? (festa/danca.ts): a pergunta só vai quando a cortina fecha, e a resposta conta dali. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { DANCARINOS, fimDaDanca, type DadosDanca } from '../src/festa/danca.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

test('danca: cinco bichos diferentes, e a pergunta escondida até a cortina fechar', () => {
  for (let s = 1; s <= 20; s++) {
    const r = rodadaDeTeste('danca', { aleatorio: sorteioFixo(s) });
    const d = r.rodada.publico(ANA).dados as DadosDanca;
    assert.equal(d.ordem.length, DANCARINOS);
    assert.equal(new Set(d.ordem).size, DANCARINOS);
    assert.equal(d.pergunta, -1, 'jogando, antes de fechar');
    r.andar();
    const depois = r.rodada.publico(ANA).dados as DadosDanca;
    assert.ok(depois.pergunta >= 1 && depois.pergunta < DANCARINOS);
    assert.equal(r.agora() - r.largou, fimDaDanca(d));
  }
});

test('danca: certo e rápido ganha, certo e lento vem depois, errado é zero', () => {
  const r = rodadaDeTeste('danca', { rede: new Map([[ANA, 200], [BIA, 300], [CAIO, 250]]) });
  r.andar();
  const d = r.rodada.publico(ANA).dados as DadosDanca;
  const fim = fimDaDanca(d);
  const certo = d.ordem[d.pergunta];
  const errado = d.ordem[(d.pergunta + 1) % DANCARINOS];
  r.em(fim + 1200 + 200);
  r.rodada.acao(ANA, { tipo: 'resultado', bicho: certo, t: fim + 1200 });
  r.em(fim + 900 + 250);
  r.rodada.acao(CAIO, { tipo: 'resultado', bicho: errado, t: fim + 900 });
  r.em(fim + 2500 + 300);
  r.rodada.acao(BIA, { tipo: 'resultado', bicho: certo, t: fim + 2500 });
  assert.equal(r.rodada.publico(ANA).fase, 'revelando');
  assert.equal(r.rodada.publico(ANA).resposta, certo);
  assert.deepEqual(r.linhas().map((l) => [l.userId, l.posicao, l.valor]), [
    [ANA, 1, 1200],
    [BIA, 2, 2500],
    [CAIO, null, null],
  ]);
});

test('danca: responder antes da pergunta, ou dizer um tempo que o servidor não viu, não vale', () => {
  const r = rodadaDeTeste('danca');
  const d = r.rodada.publico(ANA).dados as DadosDanca;
  // a Ana responde no meio da dança (pelo console: ela não tem a pergunta)
  r.em(2000);
  r.rodada.acao(ANA, { tipo: 'resultado', bicho: d.ordem[2], t: 2000 });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'invalido');
  // a Bia demora 4 s e diz que respondeu na hora
  r.andar();
  const fim = fimDaDanca(d);
  const certo = (r.rodada.publico(BIA).dados as DadosDanca).ordem[(r.rodada.publico(BIA).dados as DadosDanca).pergunta];
  r.em(fim + 4000);
  r.rodada.acao(BIA, { tipo: 'resultado', bicho: certo, t: fim + 150 });
  assert.equal(r.rodada.publico(BIA).meu?.motivo, 'invalido');
});

test('danca: o robô erra às vezes, e quando acerta leva um tempo de gente', () => {
  const r = rodadaDeTeste('danca');
  const dados = r.rodada.publico(ANA).dados;
  let erros = 0;
  for (let k = 0; k < 400; k++) {
    const rob = resultadoDoRobo('danca', dados, Math.random);
    if (rob.motivo === 'errou') erros++;
    else assert.ok((rob.valor ?? 0) >= 500);
  }
  assert.ok(erros > 40 && erros < 200);
});
