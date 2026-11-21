/**
 * Bichos da Toca (minijogo-bichos.ts, bichos-batalha.ts, bichos-regras.ts): a roda dos elementos, a conta do dano e da amizade,
 * a aventura de cada pessoa guardada no servidor (e levada no "Levar seus dados", e apagada com a conta), e a luta da sala entre
 * duas pessoas jogada pelo computador dos dois lados. O relógio e a sorte aqui são de mão.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarBichos, lerAventura } = await import('../src/minijogo-bichos.js');
const regras = await import('../src/bichos-regras.js');
const luta = await import('../src/bichos-batalha.js');
const db = await import('../src/db.js');
after(fechar);

const ana = await criarConta(app, 'ana-bichos');
const bia = await criarConta(app, 'bia-bichos');
// quem senta do outro lado na sala, sem aventura nenhuma: uma conta de verdade, porque o troféu de quem vence guarda o id dele
const caioConta = await criarConta(app, 'caio-bichos');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caioConta.token);

/** Uma sorte de mão: repete a lista em roda. */
const sorte = (...valores: number[]) => {
  let i = 0;
  return () => valores[i++ % valores.length];
};

function relogio() {
  let marcado: (() => void) | null = null;
  return {
    agendar: (_ms: number, depois: () => void) => (marcado = depois),
    disparar: () => {
      const f = marcado;
      marcado = null;
      f?.();
    },
  };
}

function comecar(ctxExtra: Record<string, unknown>, aleatorio: () => number, criadaPor: number) {
  const r = relogio();
  const fim = { terminou: false };
  const ctx = {
    agendar: r.agendar,
    avisar: () => {},
    terminar: () => (fim.terminou = true),
    naSala: () => [anaId, biaId],
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    ...ctxExtra,
  };
  const jogo = criarBichos({ aleatorio }).comecar(ctx as never, { naSala: [criadaPor], criadaPor, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return { jogo, r, fim, estado: (id: number) => jogo.publico(id) as Record<string, any> };
}

test('as duas cópias das regras são iguais', () => {
  const site = readFileSync(new URL('../../web/src/bichos/regras.ts', import.meta.url));
  const servidor = readFileSync(new URL('../src/bichos-regras.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/bichos/regras.ts e server/src/bichos-regras.ts mudaram separados: copie uma sobre a outra');
});

test('os nomes dos golpes estão marcados para a tradução no site (web/src/bichos/desenho.ts, NOMES_DOS_GOLPES)', () => {
  const desenho = readFileSync(new URL('../../web/src/bichos/desenho.ts', import.meta.url), 'utf8');
  const lista = desenho.match(/NOMES_DOS_GOLPES = \[([\s\S]*?)\];/)![1];
  const marcados = [...lista.matchAll(/chave\('([^']+)'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(marcados, Object.values(regras.GOLPES).map((g) => g.nome).sort());
});

test('a roda dos elementos: cada um vence dois, e quem vence não perde para o mesmo', () => {
  for (const e of regras.ELEMENTOS) {
    assert.equal(regras.VENCE[e].length, 2, e);
    for (const outro of regras.VENCE[e]) {
      assert.equal(regras.eficacia(e, outro), 2);
      assert.equal(regras.eficacia(outro, e), 0.5);
    }
    assert.equal(regras.eficacia(e, e), 1);
    assert.equal(regras.eficacia('nenhum', e), 1);
  }
  // as três do começo fazem um triângulo
  assert.equal(regras.eficacia('folha', 'gota'), 2);
  assert.equal(regras.eficacia('gota', 'brasa'), 2);
  assert.equal(regras.eficacia('brasa', 'folha'), 2);
});

test('os dados batem: golpes, desenhos, evolução e o mapa', () => {
  for (const [id, e] of Object.entries(regras.ESPECIES)) {
    for (const [, g] of e.aprende) assert.ok(regras.GOLPES[g], `${id} aprende ${g}, que não existe`);
    if (e.evolui) assert.ok(regras.ESPECIES[e.evolui.para]);
    assert.ok(regras.golpesDe(id, 1).length >= 1, `${id} não sabe nada no nível 1`);
    assert.ok(regras.golpesDe(id, 50).length <= 4);
  }
  for (const m of Object.values(regras.MATOS)) for (const e of m.especies) assert.ok(regras.ESPECIES[e].taxa > 0, `${e} no mato sem amizade`);
  assert.equal(regras.MAPA.length, regras.ALTURA_DO_MAPA);
  for (const linha of regras.MAPA) assert.equal(linha.length, regras.LARGURA_DO_MAPA);
  assert.ok(regras.andavel(regras.CASA.x, regras.CASA.y));
  assert.equal(regras.MAPA.join('').split('h').length - 1, 1);
  assert.equal(regras.MAPA.join('').split('c').length - 1, 1);
});

test('o dano: o elemento dobra e corta pela metade, e o nível pesa', () => {
  const a = luta.lutador('bolhim', 10);
  const dino = luta.lutador('dinito', 10);
  const cacto = luta.lutador('cardao', 10);
  const naBrasa = regras.dano(a, dino, 'chuva', 1);
  const naFolha = regras.dano(a, cacto, 'chuva', 1);
  assert.ok(naBrasa > naFolha * 2.5, `${naBrasa} contra ${naFolha}`);
  assert.ok(regras.dano(luta.lutador('bolhim', 30), dino, 'chuva', 1) > naBrasa);
  assert.ok(regras.dano(a, dino, 'chuva', 0) < naBrasa, 'a sorte tira até 15%');
});

test('a chance de amizade sobe quando o bicho está cansado, e os da Nena não fazem amizade', () => {
  const cheio = regras.chanceDeAmizade('zunzi', 20, 20);
  const cansado = regras.chanceDeAmizade('zunzi', 1, 20);
  assert.ok(cansado > cheio * 2.5);
  assert.ok(cansado <= 0.95 && cheio >= 0.05);
  assert.equal(regras.chanceDeAmizade('dragolim', 1, 20), 0);
});

test('a luta por turnos: o mais rápido bate primeiro, quem dorme não age, e a troca forçada vem antes do turno seguinte', () => {
  const b = luta.novaBatalha([luta.lutador('tisco', 12), luta.lutador('bolhim', 5)], [luta.lutador('rochim', 3)]);
  const ev = luta.turno(b, [{ tipo: 'golpe', i: 0 }, { tipo: 'golpe', i: 0 }], () => 0.5);
  assert.equal(ev[0].t, 'golpe');
  assert.equal((ev[0] as { lado: number }).lado, 0, 'o Tisco é mais rápido');
  // até o fim, pelo computador dos dois lados
  let voltas = 0;
  while (b.vencedor === null && voltas++ < 200) {
    const e0 = b.lados[0].precisaTrocar || !b.lados[1].precisaTrocar ? luta.escolhaDoRobo(b, 0, Math.random) : null;
    const e1 = b.lados[1].precisaTrocar || !b.lados[0].precisaTrocar ? luta.escolhaDoRobo(b, 1, Math.random) : null;
    luta.turno(b, [e0, e1], Math.random);
  }
  assert.equal(b.vencedor, 0);
  assert.equal(luta.conferirEscolha(b, 0, { tipo: 'trocar', i: 0 }), 'Escolha inválida.', 'trocar para o mesmo não vale');
});

test('a Nena é um desafio: com quatro bichos no nível 11 se ganha, com o primeiro sozinho quase nunca (o computador dos dois lados)', () => {
  const vitorias = (equipe: [string, number][], vezes = 200) => {
    let v = 0;
    for (let k = 0; k < vezes; k++) {
      const b = luta.novaBatalha(equipe.map(([e, n]) => luta.lutador(e, n)), regras.EQUIPE_DO_DESAFIO.map(([e, n]) => luta.lutador(e, n)));
      for (let g = 0; b.vencedor === null && g < 300; g++) {
        const e0 = b.lados[0].precisaTrocar || !b.lados[1].precisaTrocar ? luta.escolhaDoRobo(b, 0, Math.random) : null;
        const e1 = b.lados[1].precisaTrocar || !b.lados[0].precisaTrocar ? luta.escolhaDoRobo(b, 1, Math.random) : null;
        luta.turno(b, [e0, e1], Math.random);
      }
      if (b.vencedor === 0) v++;
    }
    return v / vezes;
  };
  assert.ok(vitorias([['bolhim', 11], ['dinito', 9], ['rochim', 9], ['vultim', 9]]) > 0.8);
  assert.ok(vitorias([['bolhim', 12]]) < 0.25);
});

test('a aventura no Solo: o primeiro bicho, o mato, a vitória com experiência, a amizade e tudo guardado no servidor', () => {
  // sorte 0: o mato sempre dá bicho (o primeiro da lista, no nível mais baixo), o golpe sempre é o primeiro
  const p = comecar({ solo: true, naSala: () => [anaId] }, sorte(0), anaId);
  assert.equal(p.estado(anaId).fase, 'inicial');
  assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: 'c' }), 'Escolha o primeiro bicho.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'inicial', especie: 'dragolim' }), 'Escolha o primeiro bicho.', 'só os três do começo');
  assert.equal(p.jogo.acao(anaId, { tipo: 'inicial', especie: 'bolhim' }), null);
  assert.equal((lerAventura(db.aventuraDosBichos(anaId)) as any).equipe[0].especie, 'bolhim', 'guardado na hora');

  // da frente de casa (3,14) até o mato baixo: três à direita e três para cima, em (6,11)
  for (const d of ['d', 'd', 'd', 'c', 'c', 'c']) assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: d }), null);
  let e = p.estado(anaId);
  assert.equal(e.fase, 'batalha', `no mato (${e.x},${e.y})`);
  assert.equal(e.luta.outro.equipe[0].especie, 'zunzi');
  assert.ok(e.eventos.some((x: any) => x.t === 'apareceu'));
  assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: 'c' }), 'Ação inválida.', 'na luta não se anda');

  // bate até ele dormir
  let n = 0;
  while (!p.estado(anaId).luta.acabou && n++ < 30) assert.equal(p.jogo.acao(anaId, { tipo: 'golpe', i: 1 }), null);
  e = p.estado(anaId);
  assert.equal(e.luta.acabou, 'vitoria');
  assert.ok(e.equipe[0].xpDoNivel > 0, 'ganhou experiência');
  assert.equal(p.jogo.acao(anaId, { tipo: 'continuar' }), null);
  assert.equal(p.estado(anaId).fase, 'mapa');

  // outro bicho, e a cenoura (sorte 0: a amizade sempre dá certo)
  assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: 'd' }), null);
  e = p.estado(anaId);
  assert.equal(e.fase, 'batalha');
  const cenouras = e.cenouras;
  assert.equal(p.jogo.acao(anaId, { tipo: 'cenoura' }), null);
  e = p.estado(anaId);
  assert.equal(e.luta.acabou, 'amigo');
  assert.equal(e.equipe.length, 2);
  assert.equal(e.equipe[1].especie, 'zunzi');
  assert.equal(e.cenouras, cenouras - 1);
  p.jogo.acao(anaId, { tipo: 'continuar' });

  // pôr o novo na frente, e tudo no banco
  assert.equal(p.jogo.acao(anaId, { tipo: 'frente', i: 1 }), null);
  const guardada = lerAventura(db.aventuraDosBichos(anaId))!;
  assert.deepEqual(guardada.equipe.map((b) => b.especie), ['zunzi', 'bolhim']);

  // a partida sai da memória e volta igual
  p.jogo.parar?.();
  const outra = comecar({ solo: true, naSala: () => [anaId] }, sorte(0.99), anaId);
  assert.equal(outra.estado(anaId).fase, 'mapa');
  assert.equal(outra.estado(anaId).equipe.length, 2);
  // a da outra pessoa é outra
  const daBia = comecar({ solo: true, naSala: () => [biaId] }, sorte(0.99), biaId);
  assert.equal(daBia.estado(biaId).fase, 'inicial');
});

test('a cenoura recusada dá a vez ao bicho, e a fuga que não deu também', () => {
  // a aventura volta de onde parou, em (7,11), no mato; um passo para o mato ao lado, e o bicho aparece (0, 0, 0); a cenoura é
  // recusada (0,99) e a fuga também
  const q = comecar({ solo: true, naSala: () => [anaId] }, sorte(0, 0, 0, 0.99), anaId);
  assert.equal(q.jogo.acao(anaId, { tipo: 'andar', dir: 'e' }), null);
  assert.equal(q.estado(anaId).fase, 'batalha');
  assert.equal(q.jogo.acao(anaId, { tipo: 'cenoura' }), null);
  let e = q.estado(anaId);
  assert.ok(e.eventos.some((x: any) => x.t === 'recusou'));
  assert.ok(e.eventos.some((x: any) => x.t === 'golpe' && x.lado === 1), 'o bicho do mato agiu');
  assert.equal(e.luta.acabou, null);
  assert.equal(q.jogo.acao(anaId, { tipo: 'fugir' }), null);
  e = q.estado(anaId);
  assert.ok(e.eventos.some((x: any) => x.t === 'naoFugiu'));
  assert.equal(q.jogo.acao(anaId, { tipo: 'continuar' }), 'A luta ainda não acabou.');
});

test('o "Levar seus dados" leva a aventura, e excluir a conta a apaga', async () => {
  const pacote = (await comToken(app, ana.token)('GET', '/api/me/dados')).json();
  assert.ok(pacote.conta.bichosDaToca, 'a aventura está no arquivo');
  assert.ok(pacote.conta.bichosDaToca.equipe.length >= 1);
  db.deleteAccount(anaId);
  assert.equal(db.aventuraDosBichos(anaId), null);
});

test('na sala: a mesa, a equipe guardada ou a emprestada, os dois escolhendo, e o troféu do vencedor', () => {
  const p = comecar({ solo: false, comunidade: 7 }, Math.random, biaId);
  assert.equal(p.estado(biaId).fase, 'esperando');
  assert.equal(p.jogo.acao(biaId, { tipo: 'golpe', i: 0 }), 'Espere alguém sentar do outro lado.');
  const caio = caioId; // alguém sem aventura nenhuma
  assert.equal(p.jogo.acao(caio, { tipo: 'sentar' }), null);
  let e = p.estado(biaId);
  assert.equal(e.fase, 'escolhendo');
  assert.equal(e.lugares[1].emprestada, true, 'quem não tem bicho luta com a equipe emprestada');
  assert.equal(e.lados[1].equipe.length, 3);
  assert.ok(e.lados[0].equipe[0].golpes, 'quem é dono vê os golpes');
  assert.equal(e.lados[1].equipe[0].golpes, undefined, 'e não os do outro');
  assert.equal(p.jogo.acao(12345, { tipo: 'golpe', i: 0 }), 'Você está assistindo esta partida.');

  // os dois lados pelo computador, até o fim
  let voltas = 0;
  while (p.estado(biaId).fase === 'escolhendo' && voltas++ < 400) {
    // o prazo: quem não escolheu joga pelo computador
    if (voltas % 3 === 0) {
      p.r.disparar();
      continue;
    }
    for (const id of [biaId, caio]) {
      const v = p.estado(id);
      if (v.precisaEscolher) {
        const lado = v.meuLado;
        // escolhe um golpe válido do próprio bicho (ou troca, se precisa)
        const meu = v.lados[lado];
        const escolha = meu.precisaTrocar
          ? { tipo: 'trocar', i: meu.equipe.findIndex((x: any, i: number) => x.pv > 0 && i !== meu.ativo) }
          : { tipo: 'golpe', i: 0 };
        assert.equal(p.jogo.acao(id, escolha), null, JSON.stringify(escolha));
      }
    }
  }
  e = p.estado(biaId);
  assert.equal(e.fase, 'fim');
  assert.ok(p.fim.terminou);
  assert.ok([biaId, caio].includes(e.vencedor));
  assert.ok(db.trofeusDe(e.vencedor).some((t) => t.pista === 'bichos'), 'o troféu é de quem venceu, seja quem for');
});

test('na sala, quem sai no meio perde', () => {
  let naSala = [biaId, anaId];
  const p = comecar({ solo: false, comunidade: 7, naSala: () => naSala }, Math.random, biaId);
  p.jogo.acao(anaId, { tipo: 'sentar' });
  naSala = [biaId];
  p.jogo.conferir?.();
  assert.equal(p.estado(biaId).vencedor, biaId);
});

// ---------------------------------------------------------------- 19/11/2026: efeitos, evolução, mapas, escada, sala igualada
test('a aventura guardada antes de 19/11/2026 carrega: sem mapa, moedas, caderno nem escada, ganha os valores de começo', () => {
  const antiga = {
    v: 1, x: 7, y: 11, cenouras: 4, chas: 2, desafios: 2, proximoId: 4,
    equipe: [{ id: 1, especie: 'bolhim', nivel: 11, xp: 500, pv: 30 }, { id: 2, especie: 'zunzi', nivel: 6, xp: 150, pv: 20 }],
    toca: [{ id: 3, especie: 'rochim', nivel: 4, xp: 64, pv: 10 }],
  };
  const a = lerAventura(antiga)!;
  assert.ok(a);
  assert.equal(a.mapa, 'campo');
  assert.deepEqual([a.x, a.y], [7, 11], 'o lugar continua');
  assert.equal(a.moedas, 0);
  assert.deepEqual(a.escada, [0], 'quem já venceu a Nena tem o primeiro degrau');
  assert.deepEqual([...a.pegos].sort(), ['bolhim', 'rochim', 'zunzi']);
  assert.deepEqual(a.vencidos, []);
  assert.deepEqual(a.volta, { mapa: 'campo', ...regras.CASA });
  assert.equal(a.equipe.length, 2);
  // e um mapa que não existe volta para o campo
  assert.equal(lerAventura({ ...antiga, mapa: 'lua' })!.mapa, 'campo');
});

test('os golpes novos: dois ou três de apoio por elemento, todos aprendidos por alguém, e os dados batem', () => {
  const apoio = Object.entries(regras.GOLPES).filter(([, g]) => g.efeito || g.prioridade || (g.precisao ?? 1) < 1);
  assert.ok(apoio.length >= 12, `${apoio.length} golpes com efeito`);
  for (const el of regras.ELEMENTOS) assert.ok(apoio.filter(([, g]) => g.elemento === el).length >= 2, el);
  const aprendidos = new Set(Object.values(regras.ESPECIES).flatMap((e) => e.aprende.map(([, g]) => g)));
  for (const [id] of apoio) assert.ok(aprendidos.has(id), `${id} ninguém aprende`);
  assert.equal(regras.multDoDegrau(1), 1.5);
  assert.equal(regras.multDoDegrau(-1), 2 / 3);
  assert.equal(regras.multDoDegrau(9), regras.multDoDegrau(3));
});

/** Uma luta de mão: o bicho `a` com `golpesA` contra `b`. */
const lutaDeMao = (a: string, golpesA: string[], b: string, nivel = 20) => {
  const x = luta.lutador(a, nivel);
  x.golpes = golpesA;
  const y = luta.lutador(b, nivel);
  y.golpes = ['investida'];
  return luta.novaBatalha([x], [y]);
};

test('o cochilo: quem cochila não golpeia uma ou duas vezes, e acorda', () => {
  const b = lutaDeMao('ventrolo', ['assobio'], 'rochim');
  // 0: acerta (0 < 0,6) e cochila 2 vezes (0 < 0,5)
  const ev = luta.turno(b, [{ tipo: 'golpe', i: 0 }, { tipo: 'golpe', i: 0 }], () => 0);
  assert.ok(ev.some((e) => e.t === 'efeito' && e.efeito === 'cochilou' && e.lado === 1));
  assert.equal(b.lados[1].equipe[0].estado, 'cochilo');
  // o Ventrolo é mais rápido: o Rochim já cochilou na vez dele deste turno
  assert.ok(ev.some((e) => e.t === 'efeito' && e.efeito === 'cochilando' && e.lado === 1));
  const pv0 = b.lados[0].equipe[0].pv;
  assert.equal(pv0, b.lados[0].equipe[0].pvMax, 'cochilando, não bateu');
  const ev2 = luta.turno(b, [{ tipo: 'golpe', i: 0 }, { tipo: 'golpe', i: 0 }], () => 0);
  assert.ok(ev2.some((e) => e.t === 'efeito' && e.efeito === 'falhou'), 'quem já cochila não cochila de novo');
  assert.ok(ev2.some((e) => e.t === 'efeito' && e.efeito === 'acordou'));
  assert.equal(b.lados[0].equipe[0].pv, pv0, 'na segunda vez também não bateu');
  assert.equal(b.lados[1].equipe[0].estado, null, 'acordou');
  luta.turno(b, [{ tipo: 'golpe', i: 0 }, { tipo: 'golpe', i: 0 }], () => 0.9);
  assert.ok(b.lados[0].equipe[0].pv < pv0, 'acordado, bate');
  // o assobio erra com sorte alta (precisão 0,6)
  const c = lutaDeMao('ventrolo', ['assobio'], 'rochim');
  const ev3 = luta.turno(c, [{ tipo: 'golpe', i: 0 }, null], () => 0.7);
  assert.ok(ev3.some((e) => e.t === 'errou'));
});

test('o veneno tira 1/12 da vida no fim de cada turno inteiro, e pode fazer pegar no sono', () => {
  const b = lutaDeMao('cardao', ['espinho'], 'zunzi', 5);
  luta.turno(b, [{ tipo: 'golpe', i: 0 }, { tipo: 'nada' }], () => 0.5);
  const alvo = b.lados[1].equipe[0];
  assert.equal(alvo.estado, 'veneno');
  const antes = alvo.pv;
  const ev = luta.turno(b, [{ tipo: 'nada' }, { tipo: 'nada' }], () => 0.5);
  assert.ok(ev.find((e) => e.t === 'efeito' && e.efeito === 'veneno'));
  assert.equal(antes - alvo.pv, Math.max(1, Math.floor(alvo.pvMax / 12)));
  // até dormir: e a luta acaba
  for (let k = 0; k < 30 && b.vencedor === null; k++) luta.turno(b, [{ tipo: 'nada' }, { tipo: 'nada' }], () => 0.5);
  assert.equal(b.vencedor, 0);
  // na troca forçada (só um lado escolhe), o veneno não anda
  const c = lutaDeMao('cardao', ['espinho'], 'zunzi', 5);
  luta.turno(c, [{ tipo: 'golpe', i: 0 }, { tipo: 'nada' }], () => 0.5);
  const pv = c.lados[1].equipe[0].pv;
  luta.turno(c, [{ tipo: 'nada' }, null], () => 0.5);
  assert.equal(c.lados[1].equipe[0].pv, pv);
});

test('os degraus mudam o dano, a cura devolve vida, e o golpe que vai primeiro passa o mais rápido', () => {
  // a defesa baixada: o mesmo golpe tira mais
  const semCalor = lutaDeMao('tisco', ['fogo'], 'rochim');
  const d0 = (luta.turno(semCalor, [{ tipo: 'golpe', i: 0 }, { tipo: 'nada' }], () => 1).find((e) => e.t === 'golpe') as { dano: number }).dano;
  const comCalor = lutaDeMao('tisco', ['calor', 'fogo'], 'rochim');
  luta.turno(comCalor, [{ tipo: 'golpe', i: 0 }, { tipo: 'nada' }], () => 1);
  assert.equal(comCalor.lados[1].equipe[0].degraus.def, -1);
  const d1 = (luta.turno(comCalor, [{ tipo: 'golpe', i: 1 }, { tipo: 'nada' }], () => 1).find((e) => e.t === 'golpe') as { dano: number }).dano;
  assert.ok(d1 > d0, `${d1} > ${d0}`);
  // a cura de si
  const cura = lutaDeMao('bolhim', ['orvalho'], 'rochim');
  cura.lados[0].equipe[0].pv = 5;
  luta.turno(cura, [{ tipo: 'golpe', i: 0 }, { tipo: 'nada' }], () => 0.5);
  assert.ok(cura.lados[0].equipe[0].pv > 5 + 10);
  // a rajada (vai primeiro) passa um bicho bem mais rápido
  const r = luta.novaBatalha([Object.assign(luta.lutador('rochim', 20), { golpes: ['rajada'] })], [luta.lutador('ventrolo', 20)]);
  const ev = luta.turno(r, [{ tipo: 'golpe', i: 0 }, { tipo: 'golpe', i: 0 }], () => 0.5);
  assert.equal((ev[0] as { lado: number }).lado, 0, 'o Rochim, lento, bate primeiro com a Rajada');
  // o robô usa a cura com pouca vida
  const robo = lutaDeMao('bolhim', ['chuva', 'orvalho'], 'rochim');
  robo.lados[0].equipe[0].pv = 3;
  assert.deepEqual(luta.escolhaDoRobo(robo, 0, () => 0.3), { tipo: 'golpe', i: 1 });
});

test('a evolução: pelo menos metade das espécies de base cresce, com outra folha ou outra cor, e o caderno anota', () => {
  const crescidas = new Set(Object.values(regras.ESPECIES).map((e) => e.evolui?.para).filter(Boolean));
  const base = Object.keys(regras.ESPECIES).filter((id) => !crescidas.has(id) && regras.ESPECIES[id].taxa > 0);
  const crescem = base.filter((id) => regras.ESPECIES[id].evolui);
  assert.ok(crescem.length * 2 >= base.length, `${crescem.length} de ${base.length}`);
  for (const id of crescem) {
    const de = regras.ESPECIES[id];
    const para = regras.ESPECIES[de.evolui!.para];
    assert.ok(para.desenho !== de.desenho || para.matiz || para.escala, `${id}: a crescida precisa parecer outra`);
    assert.equal(para.elemento, de.elemento);
    assert.ok(para.base.pv > de.base.pv);
    assert.equal(regras.antesDe(de.evolui!.para), id);
  }
  // as folhas existem (as da Briga)
  const folhas = readFileSync(new URL('../../web/src/briga/folhasDosBichos.ts', import.meta.url), 'utf8');
  for (const e of Object.values(regras.ESPECIES)) assert.ok(folhas.includes(`'${e.desenho}'`), e.desenho);
});

test('a evolução na aventura: o Tisco cresce no 16 e vira Fornalho, e o caderno anota o amigo novo', () => {
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 6, y: 12, cenouras: 0, chas: 0, desafios: 0, proximoId: 2,
    equipe: [{ id: 1, especie: 'tisco', nivel: 15, xp: regras.xpDoNivel(16) - 1, pv: 200 }], toca: [],
  });
  // sorte 0: o mato dá o bicho na hora, o primeiro golpe acerta sempre
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0), caioId);
  assert.equal(p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' }), null);
  assert.equal(p.estado(caioId).fase, 'batalha');
  for (let k = 0; k < 20 && !p.estado(caioId).luta.acabou; k++) p.jogo.acao(caioId, { tipo: 'golpe', i: 1 });
  const e = p.estado(caioId);
  assert.ok(e.eventos.some((x: any) => x.t === 'evoluiu' && x.de === 'tisco' && x.para === 'fornalho'));
  assert.equal(e.equipe[0].especie, 'fornalho');
  assert.ok(e.caderno.pegos.includes('fornalho'));
  p.jogo.acao(caioId, { tipo: 'continuar' });
});

test('os mapas: 24 × 16, a passagem pela borda, as pessoas e as portas onde dá para chegar', () => {
  for (const [id, m] of Object.entries(regras.MAPAS)) {
    assert.equal(m.linhas.length, regras.ALTURA_DO_MAPA, id);
    for (const l of m.linhas) assert.equal(l.length, regras.LARGURA_DO_MAPA, id);
    for (const mato of Object.values(m.matos)) for (const e of mato.especies) assert.ok(regras.ESPECIES[e]?.taxa > 0, `${id}: ${e}`);
    for (const p of m.pessoas) for (const [e] of p.equipe) assert.ok(regras.ESPECIES[e], p.id);
    for (const [k, i] of Object.entries(m.portas)) {
      const [x, y] = k.split(',').map(Number);
      assert.equal(m.linhas[y][x], 'c', `${id} ${k}`);
      assert.ok(regras.DESAFIANTES[i]);
    }
  }
  // de casa, dá para chegar a toda porta e achado (de qualquer tela)
  const vistos = new Set(['campo,3,14']);
  const fila = [{ mapa: 'campo', x: 3, y: 14 }];
  while (fila.length) {
    const p = fila.shift()!;
    for (const d of ['c', 'b', 'e', 'd']) {
      const n = regras.passoNoMapa(p.mapa, p.x, p.y, d);
      if (n && !vistos.has(`${n.mapa},${n.x},${n.y}`)) {
        vistos.add(`${n.mapa},${n.x},${n.y}`);
        fila.push(n);
      }
    }
  }
  for (const [id, m] of Object.entries(regras.MAPAS)) {
    m.linhas.forEach((l, y) => [...l].forEach((c, x) => 'hcl'.includes(c) && assert.ok(vistos.has(`${id},${x},${y}`), `${id} ${x},${y}`)));
    for (const a of m.achados) assert.ok(vistos.has(`${id},${a.x},${a.y}`), a.id);
  }
  assert.ok([...vistos].some((k) => k.startsWith('serra,')));
  // a escada chega perto do 30, com a Nena primeiro
  assert.equal(regras.DESAFIANTES[0].nome, 'Nena');
  assert.ok(Math.max(...regras.DESAFIANTES.at(-1)!.equipe.map(([, n]) => n)) >= 28);
  assert.ok(regras.DESAFIANTES.length >= 3);
});

test('a aventura pelas telas novas: o Bosque pela borda, a lojinha, a escada fechada, quem desafia no caminho', () => {
  const caio = caioId;
  // começa no campo, na borda da direita, com moedas
  db.guardarAventuraDosBichos(caio, {
    v: 1, mapa: 'campo', x: 23, y: 13, cenouras: 0, chas: 0, desafios: 0, proximoId: 3, moedas: 20,
    equipe: [{ id: 1, especie: 'aurelho', nivel: 50, xp: regras.xpDoNivel(50), pv: 999 }, { id: 2, especie: 'zunzi', nivel: 5, xp: 100, pv: 20 }],
    toca: [],
  });
  // sorte 0.99: o mato nunca dá bicho
  const p = comecar({ solo: true, naSala: () => [caio] }, sorte(0.99), caio);
  assert.equal(p.jogo.acao(caio, { tipo: 'andar', dir: 'd' }), null);
  let e = p.estado(caio);
  assert.equal(e.mapa, 'bosque');
  assert.deepEqual([e.x, e.y], [0, 13]);
  const ir = (dirs: string) => {
    for (const d of dirs) {
      assert.equal(p.jogo.acao(caio, { tipo: 'andar', dir: d }), null);
      if (p.estado(caio).fase !== 'mapa') return false;
    }
    return true;
  };
  // pela trilha até a frente da lojinha (4,8), e a porta (4,7)
  assert.ok(ir('ddddd'));
  assert.ok(ir('ccccc'));
  assert.ok(ir('e'));
  e = p.estado(caio);
  assert.deepEqual([e.x, e.y], [4, 8]);
  assert.equal(p.jogo.acao(caio, { tipo: 'comprar', item: 'cha' }), 'A lojinha fica longe daqui.');
  assert.ok(ir('c'));
  assert.equal(p.estado(caio).loja, true);
  assert.equal(p.jogo.acao(caio, { tipo: 'comprar', item: 'cha' }), null);
  e = p.estado(caio);
  assert.equal(e.moedas, 20 - regras.PRECOS.cha);
  assert.equal(e.chas, 1);
  assert.equal(p.jogo.acao(caio, { tipo: 'comprar', item: 'cha' }), 'Faltam moedas.');
  // a casa do Bento (17,7) ainda não abre: a Nena não foi vencida
  assert.ok(ir('b'));
  assert.ok(ir('d'.repeat(13))); // (17,8)
  assert.equal(p.jogo.acao(caio, { tipo: 'andar', dir: 'c' }), null);
  e = p.estado(caio);
  assert.deepEqual([e.x, e.y], [17, 8], 'ficou do lado de fora');
  assert.ok(e.eventos.some((x: any) => x.t === 'espera' && x.nome === 'Bento' && x.antes === 'Nena'));
  // o Duda (10,7) olha para a direita: passar em (11,7) começa a luta, e ganhar dá moedas
  assert.ok(ir('eeeeee')); // (11,8)
  p.jogo.acao(caio, { tipo: 'andar', dir: 'c' });
  e = p.estado(caio);
  assert.equal(e.fase, 'batalha');
  assert.equal(e.luta.tipo, 'pessoa');
  assert.equal(p.jogo.acao(caio, { tipo: 'fugir' }), 'Do desafio não se foge.');
  for (let k = 0; k < 20 && !p.estado(caio).luta.acabou; k++) p.jogo.acao(caio, { tipo: 'golpe', i: 0 });
  e = p.estado(caio);
  assert.equal(e.luta.acabou, 'vitoria');
  assert.ok(e.eventos.some((x: any) => x.t === 'moedas' && x.n === 40));
  assert.ok(e.caderno.vistos.includes('pruvi'));
  p.jogo.acao(caio, { tipo: 'continuar' });
  assert.ok(p.estado(caio).vencidos.includes('duda'));
  // passar de novo não desafia
  assert.ok(ir('bc'));
  assert.equal(p.estado(caio).fase, 'mapa');
  // tudo guardado
  const g = lerAventura(db.aventuraDosBichos(caio))!;
  assert.equal(g.mapa, 'bosque');
  assert.ok(g.vencidos.includes('duda'));
});

test('a escada inteira: a porta da Nena dá a revanche em nível alto', () => {
  const caio = caioId;
  db.guardarAventuraDosBichos(caio, {
    v: 1, mapa: 'campo', x: 19, y: 4, cenouras: 0, chas: 0, desafios: 1, proximoId: 2, escada: [0, 1, 2, 3],
    equipe: [{ id: 1, especie: 'aurelho', nivel: 50, xp: regras.xpDoNivel(50), pv: 999 }], toca: [],
  });
  const p = comecar({ solo: true, naSala: () => [caio] }, sorte(0.99), caio);
  assert.equal(p.jogo.acao(caio, { tipo: 'andar', dir: 'c' }), null);
  const e = p.estado(caio);
  assert.equal(e.fase, 'batalha');
  assert.equal(e.luta.tipo, 'desafio');
  assert.ok(Math.min(...e.luta.outro.equipe.map((b: any) => b.nivel)) >= 30, 'a revanche é em nível alto');
  for (let k = 0; k < 60 && !p.estado(caio).luta.acabou; k++) p.jogo.acao(caio, { tipo: 'golpe', i: 0 });
  assert.equal(p.estado(caio).luta.acabou, 'vitoria');
  assert.equal(lerAventura(db.aventuraDosBichos(caio))!.revanches, 1);
});


// ---------------------------------------------------------------- 20/11/2026: lote C da segunda auditoria
/** Um bicho guardado de mão, no nível, com a vida cheia. */
const guardado = (id: number, especie: string, nivel: number, extra: Record<string, unknown> = {}) => ({
  id, especie, nivel, xp: regras.xpDoNivel(nivel), pv: regras.atributos(especie, nivel).pvMax, ...extra,
});

test('na sala (a mesa justa): até 3 bichos escolhidos na largada, todos crescidos e no nível da sala; quem não escolhe vai com os primeiros', () => {
  db.guardarAventuraDosBichos(biaId, {
    v: 1, x: 3, y: 14, cenouras: 0, chas: 0, desafios: 0, proximoId: 5,
    equipe: [{ id: 1, especie: 'brotelao', nivel: 44, xp: regras.xpDoNivel(44), pv: 10 }, { id: 2, especie: 'zunzi', nivel: 3, xp: 36, pv: 1 }],
    toca: [guardado(3, 'rochim', 8), guardado(4, 'picotim', 12)],
  });
  db.guardarAventuraDosBichos(caioId, null); // quem senta sem aventura: a emprestada
  const p = comecar({ solo: false, comunidade: 7, naSala: () => [biaId, caioId] }, Math.random, biaId);
  p.jogo.acao(caioId, { tipo: 'sentar' });
  let e = p.estado(biaId);
  assert.equal(e.fase, 'montando');
  assert.deepEqual(e.opcoes.map((o: any) => o.especie), ['brotelao', 'zunzao', 'rochedo', 'picolosso'], 'a equipe e a toca, crescidos');
  assert.deepEqual(e.montou, [false, true], 'a emprestada vai sem escolha');
  assert.deepEqual(p.estado(caioId).opcoes, [], 'cada um só vê as próprias opções');
  assert.equal(p.jogo.acao(biaId, { tipo: 'golpe', i: 0 }), 'Escolha inválida.');
  assert.equal(p.jogo.acao(biaId, { tipo: 'equipe', ids: [1, 2, 3, 4] }), 'Escolha inválida.', 'no máximo 3');
  assert.equal(p.jogo.acao(biaId, { tipo: 'equipe', ids: [3, 3] }), 'Escolha inválida.');
  assert.equal(p.jogo.acao(biaId, { tipo: 'equipe', ids: [99] }), 'Escolha inválida.');
  assert.equal(p.jogo.acao(biaId, { tipo: 'equipe', ids: [3, 2] }), null);
  e = p.estado(biaId);
  assert.equal(e.fase, 'escolhendo');
  assert.deepEqual(e.lados[0].equipe.map((b: any) => b.especie), ['rochedo', 'zunzao'], 'na ordem escolhida');
  assert.deepEqual(e.lados[1].equipe.map((b: any) => b.especie), ['brotelao', 'fornalho', 'bolhao'], 'a emprestada também cresce');
  for (const lado of e.lados) for (const b of lado.equipe) {
    assert.equal(b.nivel, regras.NIVEL_DA_SALA);
    assert.equal(b.pv, b.pvMax, 'com a vida cheia');
  }
  assert.equal(e.nivel, regras.NIVEL_DA_SALA);

  // o prazo da largada: quem não escolheu leva os primeiros 3
  const q = comecar({ solo: false, comunidade: 7, naSala: () => [biaId, caioId] }, Math.random, biaId);
  q.jogo.acao(caioId, { tipo: 'sentar' });
  q.r.disparar();
  assert.deepEqual(q.estado(biaId).lados[0].equipe.map((b: any) => b.especie), ['brotelao', 'zunzao', 'rochedo']);
});

test('na sala, cada escolha tem 30 s', async () => {
  const m = await import('../src/minijogo-bichos.js');
  assert.equal(m.ESCOLHA_MS, 30_000);
  assert.equal(m.MONTAGEM_MS, 30_000);
  assert.equal(m.BICHOS_NA_MESA, 3);
});

test('a toca tem saída: na porta de casa, levar, guardar, trocar e soltar (o servidor confere)', () => {
  const equipe = [1, 2, 3, 4, 5, 6].map((id) => guardado(id, 'zunzi', 5));
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 3, y: 14, cenouras: 0, chas: 0, desafios: 0, proximoId: 9, equipe,
    toca: [guardado(7, 'rochim', 8, { pv: 0 }), guardado(8, 'miasso', 6)],
  });
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0.99), caioId);
  let e = p.estado(caioId);
  assert.equal(e.naCasa, false);
  assert.deepEqual(e.guardados.map((b: any) => b.especie), ['rochim', 'miasso']);
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'levar', id: 7 }), 'Ação inválida.', 'longe de casa, não');
  assert.equal(p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' }), null); // a porta de casa (3,13)
  e = p.estado(caioId);
  assert.equal(e.naCasa, true);
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'levar', id: 7 }), 'Ação inválida.', 'a equipe está cheia');
  // trocar: o rochim sai da toca descansado, e o da equipe vai para lá
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'trocar', id: 7, i: 0 }), null);
  e = p.estado(caioId);
  assert.equal(e.equipe[0].especie, 'rochim');
  assert.equal(e.equipe[0].pv, e.equipe[0].pvMax);
  assert.deepEqual(e.guardados.map((b: any) => b.id), [1, 8]);
  // guardar e levar
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'guardar', i: 5 }), null);
  assert.equal(p.estado(caioId).equipe.length, 5);
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'levar', id: 8 }), null);
  assert.equal(p.estado(caioId).equipe.at(-1).especie, 'miasso');
  // soltar: só da toca, e não volta
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'soltar', id: 2 }), 'Ação inválida.', 'quem está na equipe não se solta direto');
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'soltar', id: 1 }), null);
  e = p.estado(caioId);
  assert.ok(!e.guardados.some((b: any) => b.id === 1));
  // a equipe nunca fica vazia
  for (let k = 0; k < 10; k++) p.jogo.acao(caioId, { tipo: 'toca', acao: 'guardar', i: 0 });
  assert.equal(p.estado(caioId).equipe.length, 1);
  assert.equal(p.jogo.acao(caioId, { tipo: 'toca', acao: 'pular' }), 'Ação inválida.');
  // tudo guardado
  const g = lerAventura(db.aventuraDosBichos(caioId))!;
  assert.equal(g.equipe.length, 1);
  assert.equal(g.toca.length, 6);
});

test('a experiência repartida: quem entrou na luta divide, e quem ficou na equipe ganha uma parte pequena', () => {
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 6, y: 12, cenouras: 0, chas: 0, desafios: 0, proximoId: 4,
    equipe: [guardado(1, 'bolhim', 10), guardado(2, 'zunzi', 10), guardado(3, 'rochim', 10)], toca: [],
  });
  // sorte 0: o mato dá o zunzi no nível 2 na hora
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0), caioId);
  assert.equal(p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' }), null);
  assert.equal(p.estado(caioId).fase, 'batalha');
  assert.equal(p.jogo.acao(caioId, { tipo: 'trocar', i: 1 }), null); // o zunzi entra: os dois lutaram
  for (let k = 0; k < 20 && !p.estado(caioId).luta.acabou; k++) p.jogo.acao(caioId, { tipo: 'golpe', i: 0 });
  const e = p.estado(caioId);
  assert.equal(e.luta.acabou, 'vitoria');
  const xp = regras.xpGanha('zunzi', 2, false);
  const ganhou = e.equipe.map((b: any) => b.xpDoNivel);
  assert.equal(ganhou[0], Math.ceil(xp / 2), 'o bolhim, que começou');
  assert.equal(ganhou[1], Math.ceil(xp / 2), 'o zunzi, que terminou');
  assert.equal(ganhou[2], Math.floor(xp * 0.2), 'o rochim, que não lutou');
  assert.ok(ganhou[2] > 0 && ganhou[2] < ganhou[0]);
  p.jogo.acao(caioId, { tipo: 'continuar' });
});

test('o golpe novo com 4 sabidos: avisa, e a pessoa escolhe qual esquecer (ou não aprender); guardado por bicho', () => {
  // o tisco no 11 sabe investida, fogo, sopro e vulcão; no 12, aprende calor
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 6, y: 12, cenouras: 0, chas: 0, desafios: 0, proximoId: 2,
    equipe: [{ ...guardado(1, 'tisco', 11), xp: regras.xpDoNivel(12) - 1 }], toca: [],
  });
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0), caioId);
  assert.equal(p.estado(caioId).equipe[0].golpes.length, 4);
  assert.equal(p.jogo.acao(caioId, { tipo: 'esquecer', i: 0 }), 'Ação inválida.', 'nada para aprender ainda');
  p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' });
  for (let k = 0; k < 20 && !p.estado(caioId).luta.acabou; k++) p.jogo.acao(caioId, { tipo: 'golpe', i: 1 });
  let e = p.estado(caioId);
  assert.ok(e.eventos.some((x: any) => x.t === 'querAprender' && x.golpe === 'calor'));
  assert.deepEqual(e.equipe[0].golpes, ['investida', 'fogo', 'sopro', 'vulcao'], 'não apagou nenhum sozinho');
  assert.equal(e.aprender.golpe, 'calor');
  assert.equal(p.jogo.acao(caioId, { tipo: 'esquecer', i: 4 }), 'Ação inválida.');
  assert.equal(p.jogo.acao(caioId, { tipo: 'esquecer', i: 0 }), null);
  e = p.estado(caioId);
  assert.deepEqual(e.equipe[0].golpes, ['calor', 'fogo', 'sopro', 'vulcao']);
  assert.equal(e.aprender, null);
  assert.ok(e.eventos.some((x: any) => x.t === 'esqueceu' && x.antigo === 'investida'));
  assert.deepEqual(lerAventura(db.aventuraDosBichos(caioId))!.equipe[0].golpes, ['calor', 'fogo', 'sopro', 'vulcao'], 'guardado');
  // "não aprender" deixa como está
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 3, y: 14, cenouras: 0, chas: 0, desafios: 0, proximoId: 2,
    equipe: [guardado(1, 'tisco', 12, { golpes: ['investida', 'fogo', 'sopro', 'vulcao'] })], toca: [], aprender: [{ id: 1, golpe: 'calor' }],
  });
  const q = comecar({ solo: true, naSala: () => [caioId] }, sorte(0.99), caioId);
  assert.equal(q.estado(caioId).aprender.golpe, 'calor');
  assert.equal(q.jogo.acao(caioId, { tipo: 'esquecer', i: -1 }), null);
  assert.deepEqual(q.estado(caioId).equipe[0].golpes, ['investida', 'fogo', 'sopro', 'vulcao']);
  // e com menos de 4, aprende sozinho
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 6, y: 12, cenouras: 0, chas: 0, desafios: 0, proximoId: 2,
    equipe: [{ ...guardado(1, 'tisco', 11, { golpes: ['fogo', 'vulcao'] }), xp: regras.xpDoNivel(12) - 1 }], toca: [],
  });
  const r = comecar({ solo: true, naSala: () => [caioId] }, sorte(0), caioId);
  r.jogo.acao(caioId, { tipo: 'andar', dir: 'c' });
  for (let k = 0; k < 20 && !r.estado(caioId).luta.acabou; k++) r.jogo.acao(caioId, { tipo: 'golpe', i: 0 });
  assert.deepEqual(r.estado(caioId).equipe[0].golpes, ['fogo', 'vulcao', 'calor']);
});

test('a aventura de antes de 20/11/2026: sem golpes guardados, os últimos 4; golpe que não existe sai', () => {
  const a = lerAventura({ v: 1, x: 3, y: 14, equipe: [{ id: 1, especie: 'brotelao', nivel: 30 }, { id: 2, especie: 'tisco', nivel: 9, golpes: ['fogo', 'bola-de-fogo'] }], toca: [] })!;
  assert.deepEqual(a.equipe[0].golpes, regras.golpesDe('brotelao', 30));
  assert.deepEqual(a.equipe[1].golpes, ['fogo']);
  assert.deepEqual(a.aprender, []);
  assert.equal(a.chasFortes, 0);
});

test('o caderno fecha: toda espécie é alcançável (o mato, os do começo, o raro, os presentes da revanche e quem cresce deles)', () => {
  assert.deepEqual([...regras.alcancaveis()].sort(), Object.keys(regras.ESPECIES).sort());
  for (const e of regras.PRESENTES_DA_REVANCHE) assert.equal(regras.ESPECIES[e].taxa, 0, 'os da Nena só vêm de presente');
});

test('os do começo não escolhidos aparecem raros no mato da Serra, depois da escada inteira', () => {
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'serra', x: 2, y: 10, cenouras: 0, chas: 0, desafios: 1, proximoId: 2, escada: [0, 1, 2, 3],
    equipe: [guardado(1, 'brotel', 9)], toca: [],
  });
  // o mato dá bicho (0), o nevasco do 17 (0, 0), não é o raro (0.5), é um do começo (0), o primeiro que falta (0)
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0, 0, 0, 0.5, 0, 0), caioId);
  assert.equal(p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' }), null);
  const e = p.estado(caioId);
  assert.equal(e.fase, 'batalha');
  const bicho = e.luta.outro.equipe[0];
  assert.equal(bicho.especie, 'tisco', 'o brotel já é da pessoa: vem o tisco');
  assert.equal(bicho.nivel, 15, 'antes de crescer');
  assert.ok(e.eventos.some((x: any) => x.t === 'raro' && x.especie === 'tisco'));
});

test('a revanche vencida dá um bicho da Nena (o próximo que falta), e o caderno anota', () => {
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 19, y: 4, cenouras: 0, chas: 0, desafios: 1, proximoId: 2, escada: [0, 1, 2, 3],
    equipe: [{ id: 1, especie: 'aurelho', nivel: 50, xp: regras.xpDoNivel(50), pv: 999 }], toca: [],
  });
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0.99), caioId);
  for (const esperado of ['galoca', 'macalu']) {
    assert.equal(p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' }), null);
    for (let k = 0; k < 60 && !p.estado(caioId).luta.acabou; k++) p.jogo.acao(caioId, { tipo: 'golpe', i: 0 });
    const e = p.estado(caioId);
    assert.equal(e.luta.acabou, 'vitoria');
    assert.ok(e.eventos.some((x: any) => x.t === 'presente' && x.especie === esperado && x.nome === 'Nena'), esperado);
    const novo = e.equipe.find((b: any) => b.especie === esperado);
    assert.equal(novo.nivel, regras.NIVEL_DO_PRESENTE);
    assert.ok(e.caderno.pegos.includes(esperado));
    p.jogo.acao(caioId, { tipo: 'continuar' });
    p.jogo.acao(caioId, { tipo: 'andar', dir: 'b' });
  }
});

test('o chá cura uma parte da vida (o forte, mais), e a erva-doce tira o cochilo e o veneno', () => {
  const b = luta.novaBatalha([luta.lutador('brotelao', 40)], [luta.lutador('zunzi', 2)]);
  const eu = b.lados[0].equipe[0];
  eu.pv = 1;
  luta.turno(b, [{ tipo: 'cha' }, { tipo: 'nada' }], () => 0.5);
  assert.equal(eu.pv, 1 + Math.floor(eu.pvMax * regras.CURA_DO_CHA));
  assert.ok(eu.pv > 20, 'mais que os 20 de antes num bicho grande');
  eu.pv = 1;
  luta.turno(b, [{ tipo: 'cha', forte: true }, { tipo: 'nada' }], () => 0.5);
  assert.equal(eu.pv, 1 + Math.floor(eu.pvMax * regras.CURA_DO_CHA_FORTE));
  eu.estado = 'veneno';
  const ev = luta.turno(b, [{ tipo: 'erva' }, { tipo: 'nada' }], () => 0.5);
  assert.equal(eu.estado, null);
  assert.ok(ev.some((x) => x.t === 'erva'));
  assert.equal(luta.conferirEscolha(b, 0, { tipo: 'erva' }), null);
});

test('a cenoura dourada dobra a chance da amizade (no mínimo 1 em 4), e não vale para os da Nena', () => {
  const comum = regras.chanceDeAmizade('cardao', 30, 30);
  assert.equal(regras.chanceDeAmizade('cardao', 30, 30, true), Math.max(0.25, comum * 2));
  assert.ok(regras.chanceDeAmizade('aurelho', 1, 100, true) >= 0.25);
  assert.equal(regras.chanceDeAmizade('dragolim', 1, 30, true), 0);
});

test('a lojinha tem escada: a erva-doce, o chá forte e a cenoura dourada abrem com os desafios vencidos', () => {
  const comEscada = (escada: number[]) => {
    db.guardarAventuraDosBichos(caioId, {
      v: 1, mapa: 'bosque', x: 4, y: 8, cenouras: 0, chas: 0, desafios: 0, proximoId: 2, moedas: 500, escada,
      equipe: [guardado(1, 'zunzi', 5)], toca: [],
    });
    const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0.99), caioId);
    p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' });
    assert.equal(p.estado(caioId).loja, true);
    return p;
  };
  let p = comEscada([]);
  for (const item of ['erva', 'chaForte', 'dourada']) assert.equal(p.jogo.acao(caioId, { tipo: 'comprar', item }), 'Ação inválida.', item);
  assert.equal(p.jogo.acao(caioId, { tipo: 'comprar', item: 'nada' }), 'Ação inválida.');
  p = comEscada([0, 1, 2]);
  for (const item of ['erva', 'chaForte', 'dourada']) assert.equal(p.jogo.acao(caioId, { tipo: 'comprar', item }), null, item);
  const e = p.estado(caioId);
  assert.deepEqual([e.ervas, e.chasFortes, e.douradas], [1, 1, 1]);
  assert.equal(e.moedas, 500 - regras.PRECOS.erva - regras.PRECOS.chaForte - regras.PRECOS.dourada);
});

test('a erva-doce e a cenoura dourada na luta gastam as delas, e a erva só serve com cochilo ou veneno', () => {
  db.guardarAventuraDosBichos(caioId, {
    v: 1, mapa: 'campo', x: 6, y: 12, cenouras: 0, chas: 0, desafios: 0, proximoId: 2, ervas: 1, douradas: 1, chasFortes: 1,
    equipe: [guardado(1, 'bolhim', 10)], toca: [],
  });
  const p = comecar({ solo: true, naSala: () => [caioId] }, sorte(0), caioId);
  p.jogo.acao(caioId, { tipo: 'andar', dir: 'c' });
  assert.equal(p.jogo.acao(caioId, { tipo: 'erva' }), 'Ação inválida.', 'sem estado, não');
  assert.equal(p.jogo.acao(caioId, { tipo: 'cenoura' }), 'Acabaram as cenouras.');
  assert.equal(p.jogo.acao(caioId, { tipo: 'cenoura', dourada: true }), null);
  const e = p.estado(caioId);
  assert.equal(e.luta.acabou, 'amigo');
  assert.equal(e.douradas, 0);
});

test('o mato do Bosque e da Serra é esperto; o do campo, não', () => {
  assert.ok(!regras.MAPAS.campo.esperto);
  assert.equal(regras.MAPAS.bosque.esperto, true);
  assert.equal(regras.MAPAS.serra.esperto, true);
  // o esperto escolhe o golpe que mais tira (contra a pedra, a semente da folha, e não a investida)
  const b = luta.novaBatalha([luta.lutador('rochim', 10)], [Object.assign(luta.lutador('cardao', 10), { golpes: ['investida', 'semente'] })]);
  assert.deepEqual(luta.escolhaDoRobo(b, 1, () => 0.9, true), { tipo: 'golpe', i: 1 });
});

// ---------------------------------------------------------------- 21/11/2026: a Gruta e a Liga da Toca (lote D)
test('a Gruta: depois da Serra pela borda da direita, com bichos que só moram lá, e a porta da Liga onde dá para chegar', () => {
  const g = regras.MAPAS.gruta;
  assert.equal(g.escuro, true);
  assert.equal(regras.MAPAS.serra.vizinhos.d, 'gruta');
  assert.deepEqual(regras.passoNoMapa('serra', 23, 10, 'd'), { mapa: 'gruta', x: 0, y: 10 });
  const [lx, ly] = g.liga!.split(',').map(Number);
  assert.equal(g.linhas[ly][lx], 'c');
  // os do mato da gruta que não aparecem em nenhum outro mato
  const outros = new Set(Object.entries(regras.MAPAS).filter(([id]) => id !== 'gruta').flatMap(([, m]) => Object.values(m.matos).flatMap((x) => x.especies)));
  const proprios = g.matos[';'].especies.filter((e) => !outros.has(e));
  assert.ok(proprios.length >= 3, proprios.join());
  // a Liga: quatro lutas, cada uma mais forte, nomes próprios
  assert.equal(regras.LIGA.length, 4);
  const maior = (k: number) => Math.max(...regras.LIGA[k].equipe.map(([, n]) => n));
  for (let k = 1; k < regras.LIGA.length; k++) assert.ok(maior(k) >= maior(k - 1));
  assert.ok(maior(0) > Math.max(...regras.DESAFIANTES.at(-1)!.equipe.map(([, n]) => n)), 'a Liga vem depois da escada');
  for (const d of regras.LIGA) for (const [e] of d.equipe) assert.ok(regras.ESPECIES[e], e);
});

test('a Liga da Toca: fechada antes da escada; depois, quatro lutas seguidas sem descanso, e a Liga vencida', () => {
  const caio = caioId;
  const [lx, ly] = regras.MAPAS.gruta.liga!.split(',').map(Number);
  // na frente da porta, sem a escada
  db.guardarAventuraDosBichos(caio, {
    v: 1, mapa: 'gruta', x: lx, y: ly + 1, cenouras: 0, chas: 0, desafios: 1, proximoId: 3, escada: [0, 1],
    equipe: [guardado(1, 'aurelho', 50), guardado(2, 'zunzi', 5)], toca: [],
  });
  let p = comecar({ solo: true, naSala: () => [caio] }, sorte(0.99), caio);
  assert.equal(p.jogo.acao(caio, { tipo: 'andar', dir: 'c' }), null);
  let e = p.estado(caio);
  assert.equal(e.fase, 'mapa');
  assert.deepEqual([e.x, e.y], [lx, ly + 1], 'ficou do lado de fora');
  assert.ok(e.eventos.some((x: any) => x.t === 'espera' && x.nome === regras.LIGA[0].nome));
  // com a escada inteira, a Liga
  db.guardarAventuraDosBichos(caio, {
    v: 1, mapa: 'gruta', x: lx, y: ly + 1, cenouras: 0, chas: 0, desafios: 1, proximoId: 3, escada: [0, 1, 2, 3], moedas: 0,
    equipe: [1, 2, 3, 4, 5, 6].map((id) => guardado(id, 'aurelho', 50, { pv: Math.floor(regras.atributos('aurelho', 50).pvMax * 0.8) })), toca: [],
  });
  p = comecar({ solo: true, naSala: () => [caio] }, sorte(0.99), caio);
  assert.equal(p.jogo.acao(caio, { tipo: 'andar', dir: 'c' }), null);
  let vidaAntes: number[] = [];
  for (let k = 0; k < regras.LIGA.length; k++) {
    e = p.estado(caio);
    assert.equal(e.fase, 'batalha', `luta ${k + 1}`);
    assert.deepEqual(e.luta.liga, { n: k + 1, total: regras.LIGA.length });
    assert.ok(e.eventos.some((x: any) => x.t === 'desafio' && x.nome === regras.LIGA[k].nome));
    // sem descanso: a vida que sobrou da luta de antes
    const vida = e.luta.meu.equipe.map((b: any) => b.pv);
    if (k > 0) assert.deepEqual(vida, vidaAntes, 'não descansou no meio');
    assert.ok(vida.every((v: number) => v < regras.atributos('aurelho', 50).pvMax));
    for (let n = 0; n < 200 && !p.estado(caio).luta.acabou; n++) {
      const meu = p.estado(caio).luta.meu;
      const erro = meu.precisaTrocar
        ? p.jogo.acao(caio, { tipo: 'trocar', i: meu.equipe.findIndex((b: any) => b.pv > 0) })
        : p.jogo.acao(caio, { tipo: 'golpe', i: 1 });
      if (erro) assert.fail(`luta ${k + 1}: ${erro} ${JSON.stringify(p.estado(caio).luta.meu)}`);
    }
    assert.equal(p.estado(caio).luta.acabou, 'vitoria', `venceu a luta ${k + 1}`);
    vidaAntes = p.estado(caio).luta.meu.equipe.map((b: any) => b.pv);
    assert.equal(p.jogo.acao(caio, { tipo: 'continuar' }), null);
  }
  e = p.estado(caio);
  assert.equal(e.fase, 'mapa');
  assert.ok(e.eventos.some((x: any) => x.t === 'campeao' && x.n === 1));
  const g = lerAventura(db.aventuraDosBichos(caio))!;
  assert.equal(g.ligas, 1);
  assert.equal(g.moedas, regras.LIGA.reduce((s, d) => s + d.moedas, 0) + regras.MOEDAS_DA_LIGA);
});

test('a Liga perdida volta para casa e recomeça da primeira', () => {
  const caio = caioId;
  const [lx, ly] = regras.MAPAS.gruta.liga!.split(',').map(Number);
  db.guardarAventuraDosBichos(caio, {
    v: 1, mapa: 'gruta', x: lx, y: ly + 1, cenouras: 0, chas: 0, desafios: 1, proximoId: 2, escada: [0, 1, 2, 3],
    equipe: [guardado(1, 'zunzi', 5)], toca: [], volta: { mapa: 'serra', x: 3, y: 13 },
  });
  const p = comecar({ solo: true, naSala: () => [caio] }, sorte(0.5), caio);
  p.jogo.acao(caio, { tipo: 'andar', dir: 'c' });
  for (let n = 0; n < 80 && !p.estado(caio).luta.acabou; n++) p.jogo.acao(caio, { tipo: 'golpe', i: 0 });
  assert.equal(p.estado(caio).luta.acabou, 'derrota');
  p.jogo.acao(caio, { tipo: 'continuar' });
  const e = p.estado(caio);
  assert.equal(e.fase, 'mapa');
  assert.equal(e.mapa, 'serra');
  assert.equal(lerAventura(db.aventuraDosBichos(caio))!.ligas, 0);
});
