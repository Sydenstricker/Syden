/**
 * LENDAS DA TOCA (lendas-regras.ts): a aventura inteira com o relógio de mão. Os robôs fecham o caminho, o combo junta dois
 * heróis, o espólio veste, quem sai da sala joga pelo robô, e o troféu só vai para quem é gente, com 2 ou mais até o fim.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarLendas, ROTA, type Heroi } from '../src/lendas-regras.js';
import type { Contexto, Jogo } from '../src/minijogo-motor.js';

/** Um sorteio repetível (mulberry32). */
function semente(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Montagem {
  jogo: Jogo & { _herois: Map<number, Heroi> };
  ver: (quem?: number) => Record<string, any>;
  tique: () => void;
  terminou: () => boolean;
  sala: number[];
  trofeus: { userId: number; posicao: number; pontos: number | null; rivais: number[]; pista: string }[];
}

function montar(naSala: number[], { solo = false, s = 1 } = {}): Montagem {
  let terminou = false;
  let relogio: (() => void) | null = null;
  const sala = [...naSala];
  const trofeus: Montagem['trofeus'] = [];
  const ctx: Contexto = {
    agendar: (_ms, depois) => (relogio = depois),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => sala,
    nome: (id) => `p${id}`,
    comunidade: solo ? 0 : 7,
    solo,
  };
  let t = 1_000;
  const def = criarLendas({ agora: () => t++, aleatorio: semente(s), servicos: { avatarDe: () => null, guardarTrofeu: (x) => trofeus.push(x) } });
  const jogo = def.comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.equal(typeof jogo, 'object');
  return {
    jogo: jogo as Montagem['jogo'],
    ver: (quem = naSala[0]) => (jogo as Jogo).publico(quem) as Record<string, any>,
    tique: () => {
      const r = relogio;
      relogio = null;
      r?.();
    },
    terminou: () => terminou,
    sala,
    trofeus,
  };
}

/** Deixa o relógio correr até o fim (quem é gente não escolhe nada: o robô joga por todos). */
function correr(m: Montagem, limite = 2000) {
  for (let k = 0; k < limite && !m.terminou(); k++) m.tique();
}

test('a turma de quatro: quem é gente e os robôs, uma classe para cada', () => {
  const m = montar([1, 2]);
  const v = m.ver();
  assert.equal(v.fase, 'classes');
  assert.equal(v.herois.length, 4);
  assert.deepEqual(v.herois.map((h: { robo: boolean }) => h.robo), [false, false, true, true]);
  assert.equal(m.jogo.acao(1, { tipo: 'classe', classe: 'faisca' }), null);
  assert.equal(m.jogo.acao(1, { tipo: 'classe', classe: 'mago' }), 'Agora não dá.');
  assert.equal(m.jogo.acao(-1, { tipo: 'classe', classe: 'erva' }), 'Você está assistindo esta partida.');
  assert.equal(m.jogo.acao(2, { tipo: 'classe', classe: 'faisca' }), null);
  const depois = m.ver();
  assert.equal(depois.fase, 'mapa', 'todos escolheram: segue sem esperar o relógio');
  const classes = depois.herois.map((h: { classe: string }) => h.classe);
  assert.deepEqual(classes.slice(0, 2), ['faisca', 'faisca']);
  assert.deepEqual(new Set(classes.slice(2)), new Set(['escudo', 'erva']), 'os robôs pegam as classes que faltam');
});

test('os robôs fecham a aventura quase sempre, e o caminho passa por todas as paradas', () => {
  let vitorias = 0;
  const N = 60;
  for (let s = 1; s <= N; s++) {
    const m = montar([1], { solo: true, s });
    const paradas = new Set<number>();
    for (let k = 0; k < 3000 && !m.terminou(); k++) {
      paradas.add(m.ver().parada);
      m.tique();
    }
    assert.ok(m.terminou(), `semente ${s}: a aventura acabou`);
    const v = m.ver();
    assert.equal(v.fase, 'fim');
    if (v.venceu) {
      vitorias++;
      assert.equal(paradas.size, ROTA.length, 'passou pelas cinco paradas');
    }
  }
  // o equilíbrio: a turma de robôs vence a maioria (quem joga de verdade, com combo e sem perder vez, vence mais)
  assert.ok(vitorias >= N * 0.6, `os robôs venceram ${vitorias} de ${N}`);
  assert.ok(vitorias <= N * 0.98, `os robôs venceram ${vitorias} de ${N}: fácil demais`);
});

test('a rodada: a escolha de quem é gente, o combo com o robô de par, e a resolução na hora', () => {
  const m = montar([1], { s: 3 });
  m.jogo.acao(1, { tipo: 'classe', classe: 'flecha' });
  assert.equal(m.ver().fase, 'mapa');
  m.tique(); // entra na floresta
  let v = m.ver();
  assert.equal(v.fase, 'escolha');
  assert.equal(v.inimigos.length, 3);
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'atacar', alvo: 9 }), 'Agora não dá.', 'sem alvo que exista');
  // o combo: um robô vira o par, e a rodada resolve na hora (todos escolheram)
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'combo', alvo: 0 }), null);
  v = m.ver();
  assert.equal(v.fase, 'acao');
  const combo = v.eventos.find((e: { tipo: string }) => e.tipo === 'combo');
  assert.ok(combo, 'houve combo');
  assert.ok(combo.membros.includes(1) && combo.membros.length >= 2, 'eu e um robô juntos');
  assert.ok(combo.alvos[0].dano > 20, `o combo bate forte: ${combo.alvos[0].dano}`);
  const eu = v.herois.find((h: { userId: number }) => h.userId === 1);
  assert.equal(eu.en, eu.enMax - 2 + 1, 'o combo custou 2 de energia, e a rodada devolveu 1');
});

test('sem energia não há habilidade, e sozinho no combo o herói só ataca', () => {
  const m = montar([1, 2], { s: 5 });
  m.jogo.acao(1, { tipo: 'classe', classe: 'faisca' });
  m.jogo.acao(2, { tipo: 'classe', classe: 'erva' });
  m.tique();
  const h = m.jogo._herois.get(1)!;
  h.en = 0;
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade' }), 'Sem energia.');
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'combo', alvo: 0 }), 'Sem energia.');
  h.en = 5;
  // os robôs (Escudo e Flecha) não têm combo de gente para atender se a Erva não pede; a Faísca chama, e um robô atende
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'defender' }), null);
  assert.equal(m.ver().fase, 'escolha', 'ainda falta a Erva');
  assert.equal(m.jogo.acao(2, { tipo: 'acao', acao: 'atacar', alvo: 1 }), null);
  const v = m.ver();
  assert.equal(v.fase, 'acao');
  assert.ok(v.eventos.some((e: { tipo: string; de: { h?: number } }) => e.tipo === 'defender' && e.de.h === 1));
});

test('quem sai da sala joga pelo robô, e o tempo que acaba também', () => {
  const m = montar([1, 2], { s: 8 });
  m.jogo.acao(1, { tipo: 'classe', classe: 'escudo' });
  // a 2 saiu antes de escolher: o robô escolhe a classe dela na conferência
  m.sala.splice(m.sala.indexOf(2), 1);
  m.jogo.conferir!();
  assert.equal(m.ver().fase, 'mapa');
  m.tique();
  assert.equal(m.ver().fase, 'escolha');
  const dois = m.ver().herois.find((h: { userId: number }) => h.userId === 2);
  assert.equal(dois.escolheu, true, 'quem saiu já escolheu pelo robô');
  assert.equal(dois.peloRobo, true);
  // a 1 não escolhe: o tempo acaba, e a rodada resolve
  m.tique();
  assert.equal(m.ver().fase, 'acao');
});

test('o espólio: cada um decide se veste; o robô veste o que é melhor', () => {
  const m = montar([1], { s: 11 });
  m.jogo.acao(1, { tipo: 'classe', classe: 'escudo' });
  m.tique();
  // a luta corre sozinha até o espólio (o relógio da escolha acaba e o robô joga por mim)
  for (let k = 0; k < 400 && m.ver().fase !== 'espolio' && !m.terminou(); k++) m.tique();
  const v = m.ver();
  assert.equal(v.fase, 'espolio');
  assert.ok(v.meuEspolio.item, 'tenho uma peça');
  const { peca, valor } = v.meuEspolio.item;
  assert.equal(m.jogo.acao(1, { tipo: 'espolio', equipar: true }), null);
  const depois = m.ver();
  assert.equal(depois.fase, 'mapa', 'todos decidiram: segue');
  assert.equal(depois.herois[0].equip[peca], valor);
  assert.equal(depois.parada, 1);
});

test('o troféu: só com o dragão vencido, só quem é gente, e com 2 ou mais até o fim', () => {
  let comTrofeu: Montagem | null = null;
  for (let s = 1; s < 40 && !comTrofeu; s++) {
    const m = montar([1, 2], { s });
    correr(m);
    if (m.ver().venceu) comTrofeu = m;
    else assert.equal(m.trofeus.length, 0, 'derrota não dá troféu');
  }
  assert.ok(comTrofeu, 'alguma semente venceu');
  const t = comTrofeu!.trofeus;
  assert.equal(t.length, 2);
  assert.ok(t.every((x) => x.pista === 'lendas' && x.userId > 0 && x.rivais.length === 1));
  const res = comTrofeu!.ver().resultado as { userId: number; posicao: number | null }[];
  assert.ok(res.filter((r) => r.userId < 0).every((r) => r.posicao === null), 'robô não tem posição');

  // no Solo, nada
  for (let s = 1; s < 20; s++) {
    const m = montar([1], { solo: true, s });
    correr(m);
    assert.equal(m.trofeus.length, 0);
  }
});
