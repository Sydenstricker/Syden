/**
 * LENDAS DA TOCA (lendas-regras.ts): a aventura inteira com o relógio de mão. Os robôs fecham o caminho, o combo junta dois
 * heróis, o espólio veste, quem sai da sala joga pelo robô, e o troféu só vai para quem é gente, com 2 ou mais até o fim.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atributos, criarLendas, grupoDaParada, HABILIDADES, INIMIGOS, nomeDoCombo, PARADAS, PASSOS_DA_ROTA, rotaDaSemente, sorteioDaSemente, TRACOS, type Heroi, type Inimigo } from '../src/lendas-regras.js';
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
  jogo: Jogo & { _herois: Map<number, Heroi>; _inimigos: () => Inimigo[]; _caminho: { passos: string[][]; evento: string; grupos: Record<string, { tipo: string; k: number }[]> }; _escolhidas: (string | null)[] };
  ver: (quem?: number) => Record<string, any>;
  tique: () => void;
  terminou: () => boolean;
  sala: number[];
  trofeus: { userId: number; posicao: number; pontos: number | null; rivais: number[]; pista: string }[];
  recordes: { userId: number; rodadas: number; tempoMs: number }[];
}

function montar(naSala: number[], { solo = false, s = 1 } = {}): Montagem {
  let terminou = false;
  let relogio: (() => void) | null = null;
  const sala = [...naSala];
  const trofeus: Montagem['trofeus'] = [];
  const recordes: Montagem['recordes'] = [];
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
  const def = criarLendas({ agora: () => t++, aleatorio: semente(s), servicos: {
      avatarDe: () => null,
      guardarTrofeu: (x) => trofeus.push(x),
      guardarRecorde: (userId, rodadas, extra) => (recordes.push({ userId, rodadas, ...extra }), { antes: null, novo: true }),
    },
  });
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
    recordes,
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
      assert.equal(paradas.size, PASSOS_DA_ROTA, 'passou pelos cinco passos');
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
  assert.ok(v.inimigos.length >= 2 && v.inimigos.length <= 4, 'o grupo sorteado: de 2 a 4');
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
  assert.equal(m.ver().fase, 'espolio', 'falta a melhoria');
  assert.equal(v.meuEspolio.melhorias.length, 2);
  assert.equal(m.jogo.acao(1, { tipo: 'melhoria', escolha: 2 }), 'Agora não dá.');
  assert.equal(m.jogo.acao(1, { tipo: 'melhoria', escolha: 1 }), null);
  const depois = m.ver();
  assert.equal(depois.fase, 'rumo', 'todos decidiram: o próximo passo é uma bifurcação');
  assert.equal(depois.herois[0].nivel, 1);
  assert.deepEqual(depois.herois[0].melhorias, [v.meuEspolio.melhorias[1]]);
  assert.equal(depois.herois[0].habilidades.length, 2, 'o nível 1 libera a segunda habilidade');
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

// ---------------- 19/11/2026: as habilidades, os traços, o nível, o caminho, os combos com nome e o recorde ----------------

/** Anda até a primeira luta (cada pessoa com a classe pedida). */
function ateALuta(m: Montagem, classes: Record<number, string>) {
  for (const [id, c] of Object.entries(classes)) m.jogo.acao(Number(id), { tipo: 'classe', classe: c });
  for (let k = 0; k < 10 && m.ver().fase !== 'escolha'; k++) m.tique();
  assert.equal(m.ver().fase, 'escolha');
}

test('as habilidades: três por classe, a segunda e a terceira só com o nível; a do alvo pede o alvo', () => {
  for (const c of ['escudo', 'faisca', 'erva', 'flecha'] as const) {
    assert.equal(HABILIDADES[c].length, 4);
    assert.deepEqual(HABILIDADES[c].map((h) => h.nivel), [0, 1, 2, 3]);
  }
  const m = montar([1], { s: 21 });
  ateALuta(m, { 1: 'faisca' });
  assert.equal(m.ver().herois[0].habilidades.length, 1, 'no começo, só a primeira');
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 1, alvo: 0 }), 'Agora não dá.', 'o raio ainda não');
  m.jogo._herois.get(1)!.nivel = 2;
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 1 }), 'Agora não dá.', 'o raio pede o alvo');
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 1, alvo: 0 }), null);
  const v = m.ver();
  assert.equal(v.fase, 'acao');
  const raio = v.eventos.find((e: { hab?: string }) => e.hab === 'raio');
  assert.ok(raio && raio.alvos[0].dano > 25, 'o raio bateu forte');
});

test('o Escudo provoca: todos os golpes vão nele', () => {
  const m = montar([1, 2, 3, 4], { s: 4 });
  ateALuta(m, { 1: 'escudo', 2: 'faisca', 3: 'erva', 4: 'flecha' });
  m.jogo._herois.get(1)!.nivel = 2;
  // os inimigos sem traço que mude o golpe
  for (const i of m.jogo._inimigos()) i.traco = 'furia';
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 1 }), null);
  for (const id of [2, 3, 4]) m.jogo.acao(id, { tipo: 'acao', acao: 'defender' });
  const v = m.ver();
  const golpes = v.eventos.filter((e: { tipo: string }) => e.tipo === 'inimigo');
  assert.ok(golpes.length > 0);
  assert.ok(golpes.every((e: { alvos: { quem: { h: number } }[] }) => e.alvos[0].quem.h === 1), 'todo golpe no Escudo');
  assert.ok(v.eventos.some((e: { hab?: string }) => e.hab === 'provocar'));
});

test('os traços: cada inimigo tem um, que vai à tela; o cacto devolve, o golem resiste, a abelha age duas vezes', () => {
  for (const [tipo, d] of Object.entries(INIMIGOS)) assert.ok(TRACOS.includes(d.traco), `${tipo} sem traço`);
  const m = montar([1], { s: 9 });
  // três bichos na primeira parada (o grupo é sorteado pela semente)
  for (const id of ['floresta', 'horta']) m.jogo._caminho.grupos[id] = ['cogumelo', 'sapo', 'abelha'].map((tipo) => ({ tipo, k: 1 }));
  ateALuta(m, { 1: 'escudo' });
  assert.ok(m.ver().inimigos.every((i: { traco: string }) => (TRACOS as readonly string[]).includes(i.traco)));
  const [a, b, c] = m.jogo._inimigos();
  Object.assign(a, { traco: 'espinhos', hp: 500, hpMax: 500, atk: 1, vel: 0, chefe: false });
  Object.assign(b, { traco: 'pedra', hp: 500, hpMax: 500, atk: 1, vel: 0, chefe: false });
  Object.assign(c, { traco: 'ligeiro', hp: 500, hpMax: 500, atk: 1, vel: 1, chefe: false });
  // os robôs só defendem, para a conta ficar só minha
  for (const id of [-1, -2, -3]) m.jogo._herois.get(id)!.escolha = { acao: 'defender', alvo: null };
  m.jogo.acao(1, { tipo: 'acao', acao: 'atacar', alvo: 0 });
  let v = m.ver();
  const volta = v.eventos.find((e: { tipo: string }) => e.tipo === 'espinhos');
  assert.ok(volta && volta.alvos[0].quem.h === 1 && volta.alvos[0].dano > 0, 'o cacto devolveu');
  assert.equal(v.eventos.filter((e: { tipo: string; de: { i?: number } }) => e.tipo === 'inimigo' && e.de.i === 2).length, 2, 'a abelha agiu duas vezes');
  // o golem: o golpe físico quase não entra
  m.tique();
  for (const id of [-1, -2, -3]) m.jogo._herois.get(id)!.escolha = { acao: 'defender', alvo: null };
  m.jogo.acao(1, { tipo: 'acao', acao: 'atacar', alvo: 1 });
  v = m.ver();
  const golpe = v.eventos.find((e: { tipo: string; de: { h?: number } }) => e.tipo === 'ataque' && e.de.h === 1);
  assert.equal(golpe.alvos[0].resistiu, true);
  assert.ok(golpe.alvos[0].dano <= 5, `o golem quase não sentiu: ${golpe.alvos[0].dano}`);
});

test('o veneno da Erva tira vida no fim da rodada, e conta para quem envenenou', () => {
  const m = montar([1], { s: 12 });
  ateALuta(m, { 1: 'erva' });
  const h = m.jogo._herois.get(1)!;
  h.nivel = 1;
  Object.assign(m.jogo._inimigos()[0], { traco: 'furia', hp: 400, hpMax: 400 });
  m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 1, alvo: 0 });
  const v = m.ver();
  const tique = v.eventos.find((e: { tipo: string }) => e.tipo === 'veneno');
  assert.ok(tique, 'houve o veneno no fim da rodada');
  assert.ok(tique.alvos.some((a: { quem: { i?: number }; dano: number }) => a.quem.i === 0 && a.dano === Math.round(atributos(h).mag * 0.8)));
  assert.equal(v.inimigos[0].envenenado, true);
});

test('o caminho: a semente decide, a bifurcação tem duas opções, a turma vota', () => {
  assert.deepEqual(rotaDaSemente(42), rotaDaSemente(42));
  const r = rotaDaSemente(42);
  assert.deepEqual(r.passos.map((p) => p.length), [1, 2, 2, 2, 1]);
  assert.deepEqual(r.passos[4], ['castelo']);
  const vistas = new Set<string>();
  for (let s = 1; s < 40; s++) vistas.add(rotaDaSemente(s).passos.flat().join(','));
  assert.ok(vistas.size > 5, 'os caminhos mudam de partida para partida');

  const m = montar([1, 2], { s: 14 });
  ateALuta(m, { 1: 'escudo', 2: 'erva' });
  for (let k = 0; k < 400 && m.ver().fase !== 'espolio'; k++) m.tique();
  for (const id of [1, 2]) {
    m.jogo.acao(id, { tipo: 'espolio', equipar: false });
    m.jogo.acao(id, { tipo: 'melhoria', escolha: 0 });
  }
  let v = m.ver();
  assert.equal(v.fase, 'rumo');
  assert.equal(v.rumo.opcoes.length, 2);
  assert.equal(m.jogo.acao(1, { tipo: 'rumo', lado: 3 }), 'Agora não dá.');
  m.jogo.acao(1, { tipo: 'rumo', lado: 1 });
  assert.equal(m.ver().fase, 'rumo', 'falta a outra pessoa');
  assert.deepEqual(m.ver(2).rumo.votos, { 1: 1 }, 'o voto é aberto');
  m.jogo.acao(2, { tipo: 'rumo', lado: 1 });
  v = m.ver();
  assert.equal(v.fase, 'mapa');
  assert.equal(v.rota[1].escolhida, v.rota[1].opcoes[1].id, 'a maioria decidiu');
});

test('o caminho: empate no voto, o servidor sorteia (e as duas opções saem)', () => {
  const lados = new Set<string>();
  for (let s = 1; s < 30; s++) {
    const m = montar([1, 2], { s });
    ateALuta(m, { 1: 'escudo', 2: 'erva' });
    for (let k = 0; k < 400 && m.ver().fase !== 'espolio' && !m.terminou(); k++) m.tique();
    if (m.terminou()) continue;
    for (const id of [1, 2]) {
      m.jogo.acao(id, { tipo: 'espolio', equipar: false });
      m.jogo.acao(id, { tipo: 'melhoria', escolha: 0 });
    }
    m.jogo.acao(1, { tipo: 'rumo', lado: 0 });
    m.jogo.acao(2, { tipo: 'rumo', lado: 1 });
    const v = m.ver();
    lados.add(v.rota[1].escolhida === v.rota[1].opcoes[0].id ? 'a' : 'b');
  }
  assert.equal(lados.size, 2);
});

test('a loja: cada um leva uma das três peças (ou nada), e o robô leva a que mais melhora', () => {
  for (let s = 1; s < 200; s++) {
    const m = montar([1], { s, solo: true });
    if (!m.jogo._caminho.passos[2].includes('loja')) continue;
    m.jogo._escolhidas[1] = m.jogo._caminho.passos[1][0];
    m.jogo._escolhidas[2] = 'loja';
    m.jogo.acao(1, { tipo: 'classe', classe: 'flecha' });
    for (let k = 0; k < 3000 && m.ver().fase !== 'loja' && !m.terminou(); k++) m.tique();
    if (m.terminou()) continue;
    const v = m.ver();
    assert.deepEqual(v.minhaLoja.itens.map((x: { peca: string }) => x.peca), ['arma', 'armadura', 'amuleto']);
    assert.equal(m.jogo.acao(1, { tipo: 'loja', item: 5 }), 'Agora não dá.');
    const arma = v.minhaLoja.itens[0].valor;
    assert.equal(m.jogo.acao(1, { tipo: 'loja', item: 0 }), null);
    const depois = m.ver();
    assert.notEqual(depois.fase, 'loja', 'todos decidiram: segue');
    assert.equal(depois.herois[0].equip.arma, arma);
    return;
  }
  assert.fail('nenhuma semente com loja');
});

test('o evento: cada partida sorteia um, e ele age na turma', () => {
  for (let s = 1; s < 200; s++) {
    const m = montar([1], { s, solo: true });
    if (!m.jogo._caminho.passos[2].includes('evento')) continue;
    m.jogo._escolhidas[1] = m.jogo._caminho.passos[1][0];
    m.jogo._escolhidas[2] = 'evento';
    m.jogo.acao(1, { tipo: 'classe', classe: 'erva' });
    for (let k = 0; k < 3000 && m.ver().fase !== 'evento' && !m.terminou(); k++) m.tique();
    if (m.terminou()) continue;
    const v = m.ver();
    assert.ok(['fonte', 'bau', 'treino'].includes(v.evento));
    if (v.evento === 'fonte') assert.ok(v.herois.every((h: { hp: number; hpMax: number }) => h.hp === h.hpMax));
    return;
  }
  assert.fail('nenhuma semente com evento');
});

test('os combos com nome: três classes diferentes ou as quatro', () => {
  assert.equal(nomeDoCombo(['escudo', 'faisca']), null);
  assert.equal(nomeDoCombo(['faisca', 'escudo', 'erva']), 'luz');
  assert.equal(nomeDoCombo(['flecha', 'escudo', 'faisca']), 'tempestade');
  assert.equal(nomeDoCombo(['flecha', 'erva', 'escudo']), 'raiz');
  assert.equal(nomeDoCombo(['flecha', 'erva', 'faisca']), 'polen');
  assert.equal(nomeDoCombo(['flecha', 'erva', 'faisca', 'escudo']), 'coracao');
  assert.equal(nomeDoCombo(['faisca', 'faisca', 'erva']), null, 'duas Faíscas e uma Erva não têm nome');

  const m = montar([1, 2, 3], { s: 31 });
  ateALuta(m, { 1: 'escudo', 2: 'faisca', 3: 'flecha' });
  for (const i of m.jogo._inimigos()) Object.assign(i, { traco: 'furia', hp: 900, hpMax: 900 });
  for (const id of [1, 2, 3]) m.jogo.acao(id, { tipo: 'acao', acao: 'combo', alvo: 0 });
  const v = m.ver();
  const combo = v.eventos.find((e: { tipo: string }) => e.tipo === 'combo');
  assert.ok(combo.membros.length >= 3);
  assert.equal(combo.nome, combo.membros.length === 4 ? 'coracao' : 'tempestade');
});

test('o recorde do Solo: as rodadas contadas pelo servidor, só com o dragão vencido e só no Solo', () => {
  let achou = false;
  for (let s = 1; s < 40 && !achou; s++) {
    const m = montar([1], { solo: true, s });
    correr(m, 6000);
    const v = m.ver();
    if (!v.venceu) {
      assert.equal(m.recordes.length, 0, 'derrota não guarda recorde');
      continue;
    }
    achou = true;
    assert.deepEqual(m.recordes.map((r) => [r.userId, r.rodadas]), [[1, v.rodadasTotais]]);
    assert.equal(v.recorde.valor, v.rodadasTotais);
    assert.equal(v.recorde.novo, true);
  }
  assert.ok(achou);
  for (let s = 1; s < 10; s++) {
    const m = montar([1, 2], { s });
    correr(m, 6000);
    assert.equal(m.recordes.length, 0, 'na sala, nada');
  }
});

// ---------------- 20/11/2026: o grupo sorteado, o botão de acelerar e o golpe final ----------------

test('o grupo de cada parada sai da semente: de 2 a 4 do bando, o chefe sempre, e a força perto da referência', () => {
  assert.deepEqual(rotaDaSemente(77).grupos, rotaDaSemente(77).grupos, 'a mesma semente dá o mesmo grupo');
  const tamanhos = new Set<number>();
  const forca = (g: { tipo: string; k: number }[]) => {
    const sem = g.filter((x) => !INIMIGOS[x.tipo].chefe);
    return sem.reduce((s, x) => s + INIMIGOS[x.tipo].hp * x.k, 0) * sem.reduce((s, x) => s + INIMIGOS[x.tipo].atk * x.k * (INIMIGOS[x.tipo].traco === 'ligeiro' ? 1.6 : 1), 0);
  };
  for (const [id, p] of Object.entries(PARADAS)) {
    if (!p.bando) continue;
    const referencia = forca(p.inimigos.map((tipo) => ({ tipo, k: 1 })));
    for (let s = 1; s < 60; s++) {
      const g = grupoDaParada(p, sorteioDaSemente(s));
      if (p.chefe) {
        assert.equal(g.filter((x) => x.tipo === p.chefe).length, 1, `${id}: o chefe está lá`);
        assert.equal(g[1].tipo, p.chefe, 'o chefe no meio');
        assert.ok(g.length >= 2 && g.length <= 3);
      } else {
        assert.ok(g.length >= 2 && g.length <= 4, `${id}: ${g.length}`);
        tamanhos.add(g.length);
      }
      assert.ok(g.every((x) => p.bando!.includes(x.tipo) || x.tipo === p.chefe), 'só bichos da parada');
      assert.equal(new Set(g.map((x) => x.tipo)).size, g.length, 'sem repetir bicho');
      const f = forca(g) / referencia;
      assert.ok(f > 0.6 && f < 1.4, `${id}: força ${f.toFixed(2)} da referência`);
    }
  }
  assert.deepEqual([...tamanhos].sort(), [2, 3, 4]);
  // a neve continua a parada de luta mais forte (a referência dela é a maior)
  const ref = (id: string) => forca(PARADAS[id].inimigos.map((tipo) => ({ tipo, k: 1 })));
  for (const id of ['floresta', 'horta', 'deserto', 'ruinas']) assert.ok(ref('neve') > ref(id), `a neve mais forte que ${id}`);
  // na partida, os inimigos da parada são os do grupo, com a vida escalada
  const m = montar([1], { s: 5, solo: true });
  ateALuta(m, { 1: 'flecha' });
  const v = m.ver();
  const grupo = m.jogo._caminho.grupos[v.rota[0].escolhida];
  assert.deepEqual(v.inimigos.map((i: { tipo: string }) => i.tipo), grupo.map((x) => x.tipo));
  assert.deepEqual(v.inimigos.map((i: { hpMax: number }) => i.hpMax), grupo.map((x) => Math.round(INIMIGOS[x.tipo].hp * x.k)));
});

test('o botão de acelerar: só no Solo, e a rodada tocada na metade do tempo', () => {
  const tempos: number[] = [];
  const pedir = (solo: boolean, ligar: boolean) => {
    let relogio: (() => void) | null = null;
    let ultimoMs = 0;
    const ctx: Contexto = {
      agendar: (ms, depois) => ((relogio = depois), (ultimoMs = ms)),
      avisar: () => {},
      terminar: () => {},
      naSala: () => [1],
      nome: (id) => `p${id}`,
      comunidade: solo ? 0 : 7,
      solo,
    };
    const jogo = criarLendas({ agora: () => 1, aleatorio: semente(3) }).comecar(ctx, { naSala: [1], criadaPor: 1, corpo: {} }) as Jogo;
    const r = jogo.acao(1, { tipo: 'acelerar', ligado: ligar });
    jogo.acao(1, { tipo: 'classe', classe: 'flecha' });
    const mapa = ultimoMs;
    relogio!();
    jogo.acao(1, { tipo: 'acao', acao: 'defender' });
    tempos.push(mapa, ultimoMs);
    return { r, v: jogo.publico(1) as Record<string, any> };
  };
  const normal = pedir(true, false);
  const [mapaN, acaoN] = tempos.splice(0);
  const rapido = pedir(true, true);
  const [mapaR, acaoR] = tempos.splice(0);
  assert.equal(rapido.r, null);
  assert.equal(rapido.v.acelerado, true);
  assert.equal(rapido.v.ritmo, 0.5);
  assert.equal(normal.v.ritmo, 1);
  assert.equal(mapaR, Math.round(mapaN / 2), 'o mapa na metade');
  assert.ok(Math.abs(acaoR - acaoN / 2) <= 1, `a rodada na metade: ${acaoR} e ${acaoN}`);
  assert.equal(pedir(false, true).r, 'Agora não dá.', 'na sala, não');
});

test('o golpe final: no nível 3 cada classe ganha a quarta habilidade, e cada uma faz o que diz', () => {
  const m = montar([1, 2, 3, 4], { s: 6 });
  for (const id of ['floresta', 'horta']) m.jogo._caminho.grupos[id] = ['cogumelo', 'sapo', 'abelha'].map((tipo) => ({ tipo, k: 1 }));
  ateALuta(m, { 1: 'escudo', 2: 'faisca', 3: 'erva', 4: 'flecha' });
  assert.equal(m.ver().herois[0].habilidades.length, 1);
  assert.equal(m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 3, alvo: 0 }), 'Agora não dá.', 'antes do nível 3, não');
  for (const id of [1, 2, 3, 4]) Object.assign(m.jogo._herois.get(id)!, { nivel: 3, en: 10 });
  assert.equal(m.ver().herois[0].habilidades.length, 4);
  // inimigos que não morrem nem batem, e um fantasma (o tiro final não erra)
  for (const i of m.jogo._inimigos()) Object.assign(i, { traco: 'etereo', hp: 900, hpMax: 900, atk: 1, vel: 0 });
  const erva = m.jogo._herois.get(3)!;
  erva.hp = 1;
  m.jogo._herois.get(2)!.hp = 0; // a Faísca caída: o florescer a levanta
  m.jogo.acao(1, { tipo: 'acao', acao: 'habilidade', hab: 3, alvo: 0 });
  m.jogo.acao(3, { tipo: 'acao', acao: 'habilidade', hab: 3 });
  m.jogo.acao(4, { tipo: 'acao', acao: 'habilidade', hab: 3, alvo: 1 });
  const v = m.ver();
  assert.equal(v.fase, 'acao');
  const ev = (hab: string) => v.eventos.find((e: { hab?: string }) => e.hab === hab);
  assert.ok(ev('investida'), 'a investida do Escudo');
  const flor = ev('florescer');
  assert.ok(flor.alvos.some((a: { quem: { h: number }; volta?: boolean }) => a.quem.h === 2 && a.volta), 'levantou a Faísca');
  assert.ok(v.herois[1].hp >= Math.round(v.herois[1].hpMax * 0.5) - 1, 'com metade da vida');
  const final = ev('final');
  assert.ok(final.alvos[0].dano > 40 && !final.alvos[0].errou, `o tiro final não erra: ${final.alvos[0].dano}`);
  // a investida que acertou deixa tonto
  const inv = ev('investida').alvos[0];
  if (!inv.errou) assert.ok(v.eventos.some((e: { tipo: string; de: { i?: number } }) => e.tipo === 'tonto' && e.de.i === 0) || m.jogo._inimigos()[0].tonto);
  // a Faísca (de pé de novo) chove estrelas na rodada seguinte
  m.tique();
  for (const id of [1, 3, 4]) m.jogo.acao(id, { tipo: 'acao', acao: 'defender' });
  m.jogo._herois.get(2)!.en = 10;
  m.jogo.acao(2, { tipo: 'acao', acao: 'habilidade', hab: 3 });
  const estrelas = m.ver().eventos.find((e: { hab?: string }) => e.hab === 'estrelas');
  assert.ok(estrelas && estrelas.alvos.length === 3, 'as estrelas em todos');
});
