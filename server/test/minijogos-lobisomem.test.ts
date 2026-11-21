/**
 * O LOBISOMEM (minijogo-lobisomem.ts) com o relógio de mão (19/11/2026): o preparo de quem começa, a Armadilha, o Caldeirão,
 * a defesa e o julgamento, a conversa dos lobos e a história do fim. O que cada pessoa vê continua escondido dos outros.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ajustar, composicaoPadrao, criarLobisomem, lobosMax, papeisPara, type Papel } from '../src/minijogo-lobisomem.js';
import type { Contexto, Jogo } from '../src/minijogo-motor.js';

function semente(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function montar(n: number, s = 1) {
  const naSala = Array.from({ length: n }, (_, i) => i + 1);
  let relogio: (() => void) | null = null;
  let terminou = false;
  let t = 0;
  const ctx: Contexto = {
    agendar: (_ms, depois) => (relogio = depois),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id) => `p${id}`,
    comunidade: 7,
  };
  const jogo = criarLobisomem({ aleatorio: semente(s), agora: () => (t += 1000) }).comecar(ctx, { naSala, criadaPor: 1, corpo: {} }) as Jogo;
  assert.equal(typeof jogo, 'object');
  const ver = (quem: number) => jogo.publico(quem) as Record<string, any>;
  const papelDe = (id: number) => ver(id).meuPapel as Papel;
  const com = (p: Papel) => naSala.filter((id) => papelDe(id) === p);
  return {
    jogo,
    naSala,
    ver,
    papelDe,
    com,
    tique: () => {
      const r = relogio;
      relogio = null;
      r?.();
    },
    terminou: () => terminou,
  };
}

test('papeisPara de fábrica continua como antes, e o ajuste respeita os limites', () => {
  assert.deepEqual(papeisPara(4), ['lobisomem', 'vidente', 'aldeao', 'aldeao']);
  assert.deepEqual(papeisPara(5), ['lobisomem', 'vidente', 'anjo', 'aldeao', 'aldeao']);
  assert.equal(lobosMax(4), 1);
  assert.equal(lobosMax(9), 4);
  const c = ajustar(4, { lobos: 3, especiais: ['caldeirao', 'vidente', 'anjo', 'armadilha', 'xx'], noiteMs: 1, diaMs: 999_999 });
  assert.equal(c.lobos, 1, 'em 4, um lobo só');
  assert.deepEqual(c.especiais, ['vidente', 'anjo', 'armadilha'], 'cabem 3 papéis; o que não existe sai');
  assert.equal(c.noiteMs, 30_000);
  assert.equal(c.diaMs, 300_000);
  assert.deepEqual(papeisPara(6, ajustar(6, { lobos: 2, especiais: ['armadilha', 'caldeirao'] })).sort(), ['aldeao', 'aldeao', 'armadilha', 'caldeirao', 'lobisomem', 'lobisomem']);
  assert.deepEqual(composicaoPadrao(8).lobos, 2);
});

test('o preparo: só quem começou ajusta, todos veem a composição, e ninguém tem papel antes da largada', () => {
  const m = montar(6);
  assert.equal(m.ver(2).fase, 'preparo');
  assert.equal(m.ver(2).meuPapel, null);
  assert.equal(m.jogo.acao(2, { tipo: 'ajustes', lobos: 2 }), 'Só quem começou a partida escolhe.');
  assert.equal(m.jogo.acao(1, { tipo: 'ajustes', lobos: 2, especiais: ['vidente', 'armadilha', 'caldeirao'], noiteMs: 60_000 }), null);
  const v = m.ver(3);
  assert.deepEqual(v.composicao, { lobos: 2, especiais: ['vidente', 'armadilha', 'caldeirao'], noiteMs: 60_000, diaMs: 150_000 });
  assert.equal(m.jogo.acao(3, { tipo: 'noite', alvo: 1 }), 'Agora não dá.');
  assert.equal(m.jogo.acao(1, { tipo: 'comecar' }), null);
  assert.equal(m.ver(1).fase, 'noite');
  assert.equal(m.ver(1).duracao, 60_000);
  const papeis = m.naSala.map(m.papelDe).sort();
  assert.deepEqual(papeis, ['aldeao', 'armadilha', 'caldeirao', 'lobisomem', 'lobisomem', 'vidente']);
  // o segredo: cada um vê o próprio papel; o lobo vê o outro lobo
  for (const id of m.naSala) {
    const visiveis = m.ver(id).jogadores.filter((j: { papel: string | null }) => j.papel).length;
    assert.equal(visiveis, m.papelDe(id) === 'lobisomem' ? 2 : 1);
  }
});

test('o tempo do preparo acaba: começa com o que estava escolhido', () => {
  const m = montar(4);
  m.tique();
  assert.equal(m.ver(1).fase, 'noite');
});

function comecar(n: number, especiais: string[], s = 1, lobos = 1) {
  for (let k = s; k < s + 200; k++) {
    const m = montar(n, k);
    m.jogo.acao(1, { tipo: 'ajustes', lobos, especiais });
    m.jogo.acao(1, { tipo: 'comecar' });
    return m;
  }
  throw new Error('sem partida');
}

test('a conversa dos lobos: só eles mandam e leem, e ela some no amanhecer', () => {
  const m = comecar(6, ['vidente'], 3, 2);
  const [a, b] = m.com('lobisomem');
  const outro = m.naSala.find((id) => m.papelDe(id) !== 'lobisomem')!;
  assert.equal(m.jogo.acao(outro, { tipo: 'conversa', texto: 'oi' }), 'Agora não dá.');
  assert.equal(m.jogo.acao(a, { tipo: 'conversa', texto: '  vamos   no p3  ' }), null);
  assert.equal(m.jogo.acao(a, { tipo: 'conversa', texto: '' }), 'Agora não dá.');
  assert.equal(m.jogo.acao(b, { tipo: 'conversa', texto: 'x'.repeat(500) }), null);
  assert.deepEqual(m.ver(b).conversa.map((c: { texto: string }) => c.texto.length), [11, 200]);
  assert.equal(m.ver(b).conversa[0].texto, 'vamos no p3');
  assert.equal(m.ver(outro).conversa, null, 'quem não é lobo não vê nada');
  m.tique(); // a noite acaba
  assert.notEqual(m.ver(a).fase, 'noite');
  assert.equal(m.ver(a).conversa, null);
  // na noite seguinte, a conversa começa vazia
  for (let k = 0; k < 10 && m.ver(a).fase !== 'noite' && !m.terminou(); k++) m.tique();
  if (m.ver(a).fase === 'noite' && m.ver(a).vivo) assert.deepEqual(m.ver(a).conversa, []);
});

test('o Caldeirão: vê o alvo dos lobos só na etapa dele, cura uma vez, envenena uma vez; os outros não veem nada', () => {
  const m = comecar(5, ['caldeirao'], 2);
  const lobo = m.com('lobisomem')[0];
  const cal = m.com('caldeirao')[0];
  const vitima = m.naSala.find((id) => m.papelDe(id) === 'aldeao')!;
  assert.equal(m.ver(cal).alvoDosLobos, null);
  assert.equal(m.jogo.acao(cal, { tipo: 'pocao', curar: true }), 'Agora não dá.', 'antes dos lobos, não');
  m.jogo.acao(lobo, { tipo: 'noite', alvo: vitima });
  // a etapa das poções: para todos é "noite"
  assert.equal(m.ver(vitima).fase, 'noite');
  assert.equal(m.ver(vitima).etapa, null);
  assert.equal(m.ver(vitima).pocoes, null);
  assert.equal(m.ver(cal).etapa, 'pocao');
  assert.equal(m.ver(cal).alvoDosLobos, vitima);
  assert.equal(m.ver(lobo).alvoDosLobos, null);
  const outro = m.naSala.find((id) => id !== vitima && id !== cal && id !== lobo)!;
  assert.equal(m.jogo.acao(cal, { tipo: 'pocao', curar: true, veneno: outro }), null);
  let v = m.ver(cal);
  assert.equal(v.fase, 'amanhecer');
  assert.deepEqual(v.mortosDaNoite, [outro], 'a cura salvou a vítima; o veneno levou outro');
  assert.deepEqual({ cura: v.pocoes.cura, veneno: v.pocoes.veneno }, { cura: false, veneno: false });
  // na noite seguinte, sem poções, a etapa dele passa sozinha e não aceita mais nada
  m.tique(); // dia
  if (m.terminou()) return;
  m.tique(); // fim do dia, ninguém votou: ninguém sai
  m.tique(); // veredito → noite
  v = m.ver(cal);
  if (v.fase !== 'noite' || !v.vivo) return;
  m.jogo.acao(lobo, { tipo: 'noite', alvo: cal });
  assert.equal(m.ver(cal).etapa, 'pocao');
  assert.equal(m.jogo.acao(cal, { tipo: 'pocao', curar: true }), 'Agora não dá.');
});

test('a Armadilha: quem cai leva alguém junto, e o fim só é conferido depois', () => {
  const m = comecar(6, ['armadilha'], 4);
  const lobo = m.com('lobisomem')[0];
  const arm = m.com('armadilha')[0];
  m.jogo.acao(lobo, { tipo: 'noite', alvo: arm });
  assert.equal(m.ver(arm).fase, 'amanhecer');
  assert.deepEqual(m.ver(arm).mortosDaNoite, [arm]);
  m.tique();
  assert.equal(m.ver(1).fase, 'armadilha');
  assert.equal(m.ver(1).armadilha.quem, arm);
  assert.equal(m.jogo.acao(lobo, { tipo: 'armadilha', alvo: arm }), 'Agora não dá.', 'só quem caiu escolhe');
  assert.equal(m.jogo.acao(arm, { tipo: 'armadilha', alvo: arm }), 'Escolha alguém que ainda está no jogo.');
  assert.equal(m.jogo.acao(arm, { tipo: 'armadilha', alvo: lobo }), null);
  const v = m.ver(1);
  assert.equal(v.fase, 'fim', 'levou o único lobo: a vila venceu');
  assert.equal(v.vencedor, 'vila');
  assert.ok(v.historia.some((l: { tipo: string; de: number; alvo: number }) => l.tipo === 'armadilha' && l.de === arm && l.alvo === lobo));
});

test('a defesa e o julgamento: o mais votado fala, a turma decide no sim ou não, e empate fica', () => {
  const m = comecar(6, ['vidente'], 5);
  const lobo = m.com('lobisomem')[0];
  const vid = m.com('vidente')[0];
  const aldeoes = m.com('aldeao');
  m.jogo.acao(vid, { tipo: 'noite', alvo: lobo });
  m.jogo.acao(lobo, { tipo: 'noite', alvo: aldeoes[0] });
  m.tique(); // amanhecer → dia
  assert.equal(m.ver(1).fase, 'dia');
  const vivos = m.naSala.filter((id) => m.ver(id).vivo);
  const acusado = aldeoes[1];
  for (const id of vivos) m.jogo.acao(id, { tipo: 'voto', alvo: id === acusado ? lobo : acusado });
  let v = m.ver(1);
  assert.equal(v.fase, 'defesa');
  assert.equal(v.acusado, acusado);
  assert.equal(m.jogo.acao(lobo, { tipo: 'pronto' }), 'Agora não dá.', 'só o acusado termina a defesa');
  assert.equal(m.jogo.acao(acusado, { tipo: 'pronto' }), null);
  assert.equal(m.ver(1).fase, 'julgamento');
  assert.equal(m.jogo.acao(acusado, { tipo: 'julgamento', sim: false }), 'Quem está sendo julgado não vota.');
  const juizes = vivos.filter((id) => id !== acusado);
  // empate: metade sim, metade não (4 juízes)
  juizes.forEach((id, k) => m.jogo.acao(id, { tipo: 'julgamento', sim: k % 2 === 0 }));
  v = m.ver(1);
  assert.equal(v.fase, 'veredito');
  assert.equal(v.eliminado, null, 'empate: fica');
  assert.ok(m.ver(acusado).vivo);
  assert.equal(Object.keys(v.julgamento).length, juizes.length, 'no veredito, o sim e o não aparecem');
});

test('o julgamento esconde o voto até o veredito, e a maioria do sim tira', () => {
  const m = comecar(5, [], 6);
  const lobo = m.com('lobisomem')[0];
  const alvo = m.naSala.find((id) => id !== lobo)!;
  m.jogo.acao(lobo, { tipo: 'noite', alvo });
  m.tique();
  const vivos = m.naSala.filter((id) => m.ver(id).vivo);
  for (const id of vivos) m.jogo.acao(id, { tipo: 'voto', alvo: id === lobo ? vivos.find((x) => x !== lobo)! : lobo });
  assert.equal(m.ver(1).acusado, lobo);
  m.tique(); // a defesa acaba no tempo
  const juizes = vivos.filter((id) => id !== lobo);
  m.jogo.acao(juizes[0], { tipo: 'julgamento', sim: true });
  assert.equal(m.ver(juizes[1]).julgamento, null);
  assert.deepEqual(m.ver(juizes[1]).julgou, [juizes[0]]);
  assert.equal(m.ver(juizes[0]).meuJulgamento, true);
  for (const id of juizes.slice(1)) m.jogo.acao(id, { tipo: 'julgamento', sim: true });
  const v = m.ver(1);
  assert.equal(v.fase, 'fim');
  assert.equal(v.vencedor, 'vila');
  assert.equal(v.eliminado, lobo);
});

test('a história só aparece no fim, para todos, com o ataque, a proteção, a visão e o julgamento', () => {
  const m = comecar(6, ['vidente', 'anjo'], 7);
  const lobo = m.com('lobisomem')[0];
  const vid = m.com('vidente')[0];
  const anjo = m.com('anjo')[0];
  const alvo = m.com('aldeao')[0];
  m.jogo.acao(vid, { tipo: 'noite', alvo: lobo });
  m.jogo.acao(anjo, { tipo: 'noite', alvo });
  assert.equal(m.ver(1).historia, null);
  m.jogo.acao(lobo, { tipo: 'noite', alvo });
  assert.deepEqual(m.ver(1).mortosDaNoite, [], 'o anjo salvou');
  m.tique();
  const vivos = m.naSala.filter((id) => m.ver(id).vivo);
  for (const id of vivos) m.jogo.acao(id, { tipo: 'voto', alvo: id === lobo ? vid : lobo });
  m.jogo.acao(lobo, { tipo: 'pronto' });
  for (const id of vivos) if (id !== lobo) m.jogo.acao(id, { tipo: 'julgamento', sim: true });
  const v = m.ver(alvo);
  assert.equal(v.fase, 'fim');
  const tipos = v.historia.map((l: { tipo: string }) => l.tipo);
  for (const t of ['visao', 'ataque', 'protecao', 'mortes', 'acusado', 'julgamento']) assert.ok(tipos.includes(t), `falta ${t}`);
  assert.equal(v.historia.find((l: { tipo: string }) => l.tipo === 'ataque').salvo, true);
  assert.ok(v.jogadores.every((j: { papel: string | null }) => j.papel), 'no fim, todos os papéis aparecem');
});

/** Leva a partida de um dia ao julgamento de `acusado`, com todos os vivos votando nele e dizendo sim. */
function julgar(m: ReturnType<typeof montar>, acusado: number) {
  const vivos = m.naSala.filter((id) => m.ver(id).vivo);
  const outro = vivos.find((x) => x !== acusado)!;
  for (const id of vivos) m.jogo.acao(id, { tipo: 'voto', alvo: id === acusado ? outro : acusado });
  assert.equal(m.ver(1).acusado, acusado);
  m.jogo.acao(acusado, { tipo: 'pronto' });
  for (const id of vivos) if (id !== acusado) m.jogo.acao(id, { tipo: 'julgamento', sim: true });
}

test('os papéis novos de 21/11/2026 entram no preparo e no sorteio', () => {
  const c = ajustar(8, { lobos: 2, especiais: ['mascara', 'amuleto', 'carapaca'] });
  assert.deepEqual(c.especiais, ['amuleto', 'carapaca', 'mascara']);
  assert.deepEqual(papeisPara(6, ajustar(6, { lobos: 1, especiais: ['amuleto', 'carapaca', 'mascara'] })).sort(), ['aldeao', 'aldeao', 'amuleto', 'carapaca', 'lobisomem', 'mascara']);
});

test('a Carapaça aguenta o primeiro ataque calada, e o segundo leva', () => {
  const m = comecar(6, ['carapaca'], 8);
  const lobo = m.com('lobisomem')[0];
  const car = m.com('carapaca')[0];
  m.jogo.acao(lobo, { tipo: 'noite', alvo: car });
  assert.deepEqual(m.ver(1).mortosDaNoite, [], 'ninguém morreu');
  assert.ok(m.ver(car).vivo);
  assert.equal(m.ver(lobo).jogadores.find((j: { userId: number }) => j.userId === car).papel, null, 'o papel continua escondido');
  m.tique(); // dia
  m.tique(); // ninguém votou
  m.tique(); // veredito → noite 2
  assert.equal(m.ver(1).fase, 'noite');
  m.jogo.acao(lobo, { tipo: 'noite', alvo: car });
  assert.deepEqual(m.ver(1).mortosDaNoite, [car]);
});

test('o Amuleto: a primeira vez que a vila o tira, ele quebra, a pessoa fica e o papel abre; a segunda vez, sai', () => {
  const m = comecar(7, ['amuleto'], 9);
  const lobo = m.com('lobisomem')[0];
  const am = m.com('amuleto')[0];
  const vitima = m.com('aldeao')[0];
  m.jogo.acao(lobo, { tipo: 'noite', alvo: vitima });
  m.tique(); // dia
  julgar(m, am);
  let v = m.ver(lobo);
  assert.equal(v.fase, 'veredito');
  assert.equal(v.eliminado, null);
  assert.equal(v.amuletoQuebrou, am);
  assert.ok(m.ver(am).vivo);
  assert.equal(v.jogadores.find((j: { userId: number }) => j.userId === am).papel, 'amuleto', 'todos veem o papel');
  m.tique(); // noite 2
  const outra = m.com('aldeao').find((id) => m.ver(id).vivo)!;
  m.jogo.acao(lobo, { tipo: 'noite', alvo: outra });
  m.tique(); // dia 2
  if (m.terminou()) return;
  julgar(m, am);
  v = m.ver(lobo);
  assert.equal(v.eliminado, am, 'quebrado, não salva mais');
});

test('a Máscara tirada pela vila vence e a partida acaba; atacada de noite, só sai', () => {
  const m = comecar(6, ['mascara'], 10);
  const lobo = m.com('lobisomem')[0];
  const mas = m.com('mascara')[0];
  const vitima = m.com('aldeao')[0];
  m.jogo.acao(lobo, { tipo: 'noite', alvo: vitima });
  m.tique(); // dia
  julgar(m, mas);
  const v = m.ver(lobo);
  assert.equal(v.fase, 'fim');
  assert.equal(v.vencedor, 'mascara');
  assert.equal(v.eliminado, mas);
  assert.ok(m.terminou());

  const m2 = comecar(6, ['mascara'], 11);
  const lobo2 = m2.com('lobisomem')[0];
  const mas2 = m2.com('mascara')[0];
  m2.jogo.acao(lobo2, { tipo: 'noite', alvo: mas2 });
  assert.deepEqual(m2.ver(1).mortosDaNoite, [mas2]);
  assert.equal(m2.ver(1).vencedor, null);
});
