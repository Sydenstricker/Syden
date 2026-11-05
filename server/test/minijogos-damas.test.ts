/**
 * As Damas (minijogo-damas.ts): a geração dos lances direto nas regras puras (comer obrigatório, lei da maioria, a dama
 * que voa, a coroa só no fim do lance), e a mesa (a vez, o que cada um vê, o lance velho) por um contexto de mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAMA_CLARA,
  DAMA_ESCURA,
  LANCES_PARA_EMPATE,
  PEDRA_CLARA,
  PEDRA_ESCURA,
  aplicar,
  lancesDe,
  posicaoInicial,
  regrasDasDamas,
  type EstadoDasDamas,
  type Lance,
} from '../src/minijogo-damas.js';
import { duelo } from '../src/minijogo-tabuleiro.js';

/** A casa pela notação: "a1" é o canto escuro de baixo, à esquerda de quem joga de claras. */
const q = (nome: string) => (8 - Number(nome[1])) * 8 + (nome.charCodeAt(0) - 97);
const tabuleiro = (pecas: Record<string, number>) => {
  const casas = new Array<number>(64).fill(0);
  for (const [nome, p] of Object.entries(pecas)) {
    assert.equal((Math.floor(q(nome) / 8) + (q(nome) % 8)) % 2, 1, `${nome} é casa escura`);
    casas[q(nome)] = p;
  }
  return casas;
};
const fim = (l: Lance) => l.caminho[l.caminho.length - 1];
const ordem = (xs: number[]) => [...xs].sort((a, b) => a - b);

test('a posição inicial: 12 de cada lado nas casas escuras, e as claras abrem com 7 lances', () => {
  const casas = posicaoInicial();
  assert.equal(casas.filter((p) => p === PEDRA_CLARA).length, 12);
  assert.equal(casas.filter((p) => p === PEDRA_ESCURA).length, 12);
  assert.equal(casas[q('a1')], PEDRA_CLARA);
  assert.equal(casas[q('h8')], PEDRA_ESCURA);
  casas.forEach((p, i) => p && assert.equal((Math.floor(i / 8) + (i % 8)) % 2, 1, 'só nas escuras'));
  const lances = lancesDe(casas, 0);
  assert.equal(lances.length, 7);
  assert.ok(lances.every((l) => l.comidas.length === 0 && l.caminho.length === 1));
  assert.ok(lances.every((l) => Math.floor(fim(l) / 8) === 4), 'para a frente, uma casa');
  assert.equal(lancesDe(casas, 1).length, 7);
});

test('comer é obrigatório: havendo captura, os lances simples somem', () => {
  const casas = tabuleiro({ c3: PEDRA_CLARA, d4: PEDRA_ESCURA, g3: PEDRA_CLARA });
  assert.deepEqual(lancesDe(casas, 0), [{ de: q('c3'), caminho: [q('e5')], comidas: [q('d4')] }]);
});

test('a pedra come para trás', () => {
  const casas = tabuleiro({ d4: PEDRA_CLARA, c3: PEDRA_ESCURA });
  assert.deepEqual(lancesDe(casas, 0), [{ de: q('d4'), caminho: [q('b2')], comidas: [q('c3')] }]);
});

test('lei da maioria: vale só a cadeia que come mais, e as empatadas valem todas', () => {
  // A pedra de h2 come só g3 (uma); a de e3 come d4 e depois d6 (duas), e só essa vale.
  const casas = tabuleiro({ h2: PEDRA_CLARA, g3: PEDRA_ESCURA, e3: PEDRA_CLARA, d4: PEDRA_ESCURA, d6: PEDRA_ESCURA });
  assert.deepEqual(lancesDe(casas, 0), [{ de: q('e3'), caminho: [q('c5'), q('e7')], comidas: [q('d4'), q('d6')] }]);
  // Duas capturas de uma peça cada: as duas valem.
  const empate = lancesDe(tabuleiro({ c3: PEDRA_CLARA, b4: PEDRA_ESCURA, d4: PEDRA_ESCURA }), 0);
  assert.deepEqual(ordem(empate.map(fim)), ordem([q('a5'), q('e5')]));
});

test('a dama voa: come à distância e pousa em qualquer casa vazia depois', () => {
  const lances = lancesDe(tabuleiro({ a1: DAMA_CLARA, d4: PEDRA_ESCURA }), 0);
  assert.deepEqual(ordem(lances.map(fim)), ordem([q('e5'), q('f6'), q('g7'), q('h8')]));
  assert.ok(lances.every((l) => l.comidas.length === 1 && l.comidas[0] === q('d4')));
  // Sem nada para comer, ela anda a diagonal inteira.
  assert.equal(lancesDe(tabuleiro({ a1: DAMA_CLARA }), 0).length, 7);
});

test('a dama tem de pousar onde continua comendo (a lei da maioria vale na dama)', () => {
  // Depois de c3, só o pouso em e5 enxerga f4; e depois de f4 ela pousa em g3 ou em h2.
  const lances = lancesDe(tabuleiro({ a1: DAMA_CLARA, c3: PEDRA_ESCURA, f4: PEDRA_ESCURA }), 0);
  assert.deepEqual(
    lances.map((l) => l.caminho),
    [
      [q('e5'), q('g3')],
      [q('e5'), q('h2')],
    ],
  );
  assert.ok(lances.every((l) => l.comidas.join() === [q('c3'), q('f4')].join()));
});

test('a peça comida não é comida de novo, e continua bloqueando até o fim do lance', () => {
  // A dama em c3 come d4 e só pode pousar em e5 (f6 é dela). De lá, voltando pela diagonal, ela passaria por d4 e
  // pela casa de onde saiu, e comeria b2: não pode, porque d4 ainda está no tabuleiro.
  const casas = tabuleiro({ c3: DAMA_CLARA, d4: PEDRA_ESCURA, f6: PEDRA_CLARA, b2: PEDRA_ESCURA });
  const lances = lancesDe(casas, 0);
  assert.ok(lances.every((l) => l.comidas.length === 1), 'nenhuma cadeia de duas');
  assert.deepEqual(ordem(lances.map(fim)), ordem([q('a1'), q('e5')]));
  // E sem a de b2: comida d4, a dama não volta para comê-la de novo.
  const uma = lancesDe(tabuleiro({ a1: DAMA_CLARA, c3: PEDRA_ESCURA }), 0);
  assert.ok(uma.every((l) => l.comidas.length === 1));
});

test('a pedra que termina o lance na última fileira vira dama', () => {
  const casas = tabuleiro({ c7: PEDRA_CLARA, h2: PEDRA_ESCURA });
  const lance = lancesDe(casas, 0).find((l) => fim(l) === q('b8'))!;
  aplicar(casas, lance);
  assert.equal(casas[q('b8')], DAMA_CLARA);
  // As escuras coroam na fileira 1.
  const esc = tabuleiro({ b2: PEDRA_ESCURA, h8: PEDRA_CLARA });
  aplicar(esc, lancesDe(esc, 1)[0]);
  assert.ok(esc.includes(DAMA_ESCURA));
});

test('a pedra que passa pela última fileira no meio da cadeia continua pedra', () => {
  // b6 come c7 e chega a d8 (a última), mas de lá ainda come e7, e o lance termina em f6.
  const casas = tabuleiro({ b6: PEDRA_CLARA, c7: PEDRA_ESCURA, e7: PEDRA_ESCURA });
  const lances = lancesDe(casas, 0);
  assert.deepEqual(lances, [{ de: q('b6'), caminho: [q('d8'), q('f6')], comidas: [q('c7'), q('e7')] }]);
  aplicar(casas, lances[0]);
  assert.equal(casas[q('f6')], PEDRA_CLARA, 'não virou dama');
  assert.equal(casas[q('c7')], 0, 'as comidas saem no fim');
  assert.equal(casas[q('e7')], 0);
});

// --- A mesa ----------------------------------------------------------------------------------------

function mesa(sorteio: number) {
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => {},
    naSala: () => [1, 2, 3],
    nome: (id: number) => ['', 'ana', 'bia', 'caio'][id],
  };
  const jogo = duelo(regrasDasDamas, () => sorteio).comecar(ctx, { naSala: [1, 2, 3], criadaPor: 1, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { jogo, ver: (quem: number) => jogo.publico(quem) as Record<string, any> };
}

test('a mesa: quem abre fica com as claras, a vez alterna, e só quem tem a vez recebe os lances', () => {
  const { jogo, ver } = mesa(0.9); // o sorteio dá a vez ao lado 1 (bia), que fica com as claras
  assert.deepEqual(ver(1).lances, [], 'esperando, ninguém tem lance');
  assert.equal(ver(1).casas.length, 64);
  assert.equal(jogo.acao(2, { tipo: 'sentar' }), null);
  assert.equal(ver(1).claras, 1);
  assert.equal(ver(2).lances.length, 7);
  assert.deepEqual(ver(1).lances, []);
  assert.deepEqual(ver(3).lances, [], 'quem assiste não recebe lances');
  assert.equal(ver(3).casas.length, 64, 'mas vê o tabuleiro');
  assert.equal(jogo.acao(1, { tipo: 'jogada', lance: 0 }), 'Espere a sua vez.');
  assert.equal(jogo.acao(3, { tipo: 'jogada', lance: 0 }), 'Você está assistindo esta partida.');
  assert.equal(jogo.acao(2, { tipo: 'jogada', lance: 99 }), 'Esse lance não vale.');
  assert.equal(jogo.acao(2, { tipo: 'jogada', lance: 'x' }), 'Esse lance não vale.');
  const l = ver(2).lances[0] as Lance;
  assert.equal(jogo.acao(2, { tipo: 'jogada', lance: 0, de: l.de + 1, caminho: l.caminho }), 'Esse lance não vale mais.');
  assert.equal(jogo.acao(2, { tipo: 'jogada', lance: 0, de: l.de, caminho: l.caminho }), null);
  assert.deepEqual(ver(2).ultimo, l);
  assert.equal(ver(1).vez, 0);
  assert.equal(ver(1).lances.length, 7);
  assert.deepEqual(ver(2).lances, []);
  assert.deepEqual(ver(1).restam, [12, 12]);
  // A lista que bia viu é velha agora: na vez de ana, o mesmo lance dela não serve.
  assert.equal(jogo.acao(1, { tipo: 'jogada', lance: 0, de: l.de, caminho: l.caminho }), 'Esse lance não vale mais.');
});

function estadoCom(casas: number[]): EstadoDasDamas {
  return { casas, claras: 0, vezDaCor: 0, comecou: true, lances: lancesDe(casas, 0), ultimo: null, semCaptura: 0 };
}

test('quem fica sem lance perde: sem peças, ou com todas presas', () => {
  const comeTudo = estadoCom(tabuleiro({ c3: PEDRA_CLARA, d4: PEDRA_ESCURA }));
  assert.deepEqual(regrasDasDamas.jogar(comeTudo, 0, { lance: 0 }), { proximo: 1, vencedor: 0 });
  // A escura de a7 está presa: b6 ocupada, e comê-la pediria c5 vazia.
  const presa = estadoCom(tabuleiro({ a7: PEDRA_ESCURA, b6: PEDRA_CLARA, c5: PEDRA_CLARA, h2: PEDRA_CLARA }));
  const n = presa.lances.findIndex((l) => l.de === q('h2'));
  assert.deepEqual(regrasDasDamas.jogar(presa, 0, { lance: n }), { proximo: 1, vencedor: 0 });
});

test('empate: 20 lances seguidos só de dama, sem comer', () => {
  const e = estadoCom(tabuleiro({ a1: DAMA_CLARA, h2: DAMA_ESCURA }));
  const vaiEVolta: Record<number, number> = { [q('a1')]: q('b2'), [q('b2')]: q('a1'), [q('h2')]: q('g1'), [q('g1')]: q('h2') };
  const jogar = (lado: 0 | 1) => regrasDasDamas.jogar(e, lado, { lance: e.lances.findIndex((l) => fim(l) === vaiEVolta[l.de]) });
  for (let k = 0; k < LANCES_PARA_EMPATE - 1; k++) assert.deepEqual(jogar((k % 2) as 0 | 1), { proximo: (k + 1) % 2 }, `lance ${k + 1}`);
  assert.equal(e.semCaptura, LANCES_PARA_EMPATE - 1);
  assert.deepEqual(jogar(1), { proximo: 0, vencedor: 'empate' });
});

test('lance de pedra zera a contagem do empate', () => {
  const e = estadoCom(tabuleiro({ a1: DAMA_CLARA, g3: PEDRA_CLARA, h2: DAMA_ESCURA }));
  e.semCaptura = 15;
  regrasDasDamas.jogar(e, 0, { lance: e.lances.findIndex((l) => l.de === q('g3')) });
  assert.equal(e.semCaptura, 0);
});
