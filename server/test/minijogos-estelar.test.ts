/**
 * A Rota Estelar (minijogo-estelar.ts): os eventos vão pelo tempo real, e cada um passa pela ficha do piloto (estelar-sim.ts,
 * a mesma conta do site). Aqui o site é o próprio mundo do site com o piloto automático (web/src/estelar), e o relógio é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarEstelar, FOLGA_PASSOS } = await import('../src/minijogo-estelar.js');
const sim = await import('../src/estelar-sim.js');
const { Mundo } = await import('../../web/src/estelar/mundo.ts');
const { pilotar } = await import('../../web/src/estelar/piloto.ts');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-estelar');
const bia = await criarConta(app, 'bia-estelar');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

interface Estado {
  fase: string;
  semente: number;
  jogadores: { userId: number; pontos: number; vidas: number; chefe: boolean; posicao: number | null; precisao: number }[];
  esquadrilha: number;
  meu: { vidas: number; escudo: number; ramo: number; mortos: number[] } | null;
  recorde: { antes: number | null; novo: boolean } | null;
}

function comecar(naSala: number[], comunidade = 0, corpo: Record<string, unknown> = {}) {
  let relogio: { depois: () => void; em: number } | null = null;
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => (relogio = { depois, em: agora + ms }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
  };
  let semente = 17;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const jogo = criarEstelar({ agora: () => agora, aleatorio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo });
  assert.ok(typeof jogo !== 'string');
  let inicio = 0;
  return {
    jogo,
    estado: (id: number) => jogo.publico(id) as unknown as Estado,
    terminou: () => terminou,
    andar() {
      const r = relogio!;
      relogio = null;
      agora = Math.max(agora, r.em);
      r.depois();
      if ((jogo.publico(naSala[0]) as unknown as Estado).fase === 'jogando' && inicio === 0) inicio = agora;
    },
    irAoPasso(n: number) {
      agora = inicio + Math.ceil((n * 1000) / sim.PASSOS_POR_S);
      const r = relogio as { em: number; depois: () => void } | null;
      if (r && r.em <= agora) {
        relogio = null;
        r.depois();
      }
    },
  };
}

test('as duas cópias da regra são iguais (o site joga com a mesma conta que o servidor confere)', async () => {
  const { readFileSync } = await import('node:fs');
  const servidor = readFileSync(new URL('../src/estelar-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../../web/src/estelar/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/estelar-sim.ts e web/src/estelar/sim.ts mudaram separados: copie uma sobre a outra');
});

/** Joga com o piloto automático; a cada 6 passos, o lote vai ao servidor. */
function jogar(p: ReturnType<typeof comecar>, quem: number) {
  const e = p.estado(quem) as Estado & { rota?: number };
  const m = new Mundo(e.semente, true, e.rota ?? 0);
  for (let n = 0; n <= sim.FIM && !p.terminou(); n++) {
    m.avancar(pilotar(m));
    if (n % 6 === 0 || m.ficha.acabou) {
      p.irAoPasso(m.passo);
      p.jogo.tempoReal!(quem, { p: m.passo, x: m.nave.x, y: m.nave.y, ds: m.disparos, ev: m.eventos.splice(0) });
    }
    if (m.ficha.acabou && !m.eventos.length) break;
  }
  return m;
}

test('no Solo, a rota inteira com o piloto: o servidor aceita tudo, chega aos mesmos pontos, e a partida vira o recorde', () => {
  const p = comecar([anaId]);
  assert.equal(p.estado(anaId).fase, 'preparando');
  p.andar();
  const m = jogar(p, anaId);
  assert.ok(m.ficha.chefeEm !== null, 'o piloto derruba o polvo de lata');
  p.andar();
  assert.ok(p.terminou());
  const fim = p.estado(anaId);
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.jogadores[0].pontos, m.ficha.total(sim.FIM, true), 'os pontos do servidor são os da tela');
  assert.equal(fim.jogadores[0].chefe, true);
  assert.equal(fim.meu?.ramo, m.ficha.ramo, 'a rota escolhida na bifurcação');
  assert.ok(fim.jogadores[0].precisao > 0 && fim.jogadores[0].precisao <= 100);
  assert.equal(fim.recorde?.novo, true);
  assert.equal(db.recordeEstelar(anaId), fim.jogadores[0].pontos);
  assert.ok(!db.trofeusDe(anaId).some((t) => t.pista === 'estelar'), 'o Solo não dá troféu');
});

test('com a turma: a Ana pilota, a Bia fica parada até acabar o tempo; o pódio vai para a estante', () => {
  const p = comecar([anaId, biaId], 1);
  p.andar();
  const m = jogar(p, anaId);
  assert.equal(p.terminou(), false);
  p.andar();
  assert.ok(p.terminou());
  const fim = p.estado(biaId);
  assert.equal(fim.jogadores[0].userId, anaId);
  assert.equal(fim.jogadores[0].pontos, m.ficha.total(sim.FIM, true));
  assert.equal(fim.jogadores[1].pontos, sim.POR_VIDA * sim.VIDAS, 'a Bia não derrubou nada e não caiu');
  assert.equal(fim.esquadrilha, fim.jogadores[0].pontos + fim.jogadores[1].pontos);
  assert.ok(db.trofeusDe(anaId).some((t) => t.pista === 'estelar' && t.posicao === 1));
  assert.ok(db.trofeusDe(biaId).some((t) => t.pista === 'estelar' && t.posicao === 2));
});

test('o servidor recusa a trapaça: o acerto no futuro, fora da cadência, a nave teleportada, o tiro travado sem carga, a rota fora de hora', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const r = sim.roteiro(p.estado(anaId).semente);
  const i = r.inimigos.findIndex((x) => x.tipo === 'drone' && x.rel);
  const e = r.inimigos[i];
  // um disparo honesto: a nave alinhada com o drone, no passo da cadência, e a bala até ele
  let disparo = e.t + 60;
  while (disparo % sim.CADENCIA !== 0) disparo++;
  let q = disparo;
  let x = 0;
  let y = 0;
  for (; q < disparo + sim.VIDA_BALA; q++) {
    const a = sim.posicaoInimigo(e, q)!;
    x = Math.round(a.x * 100) / 100;
    y = Math.round(a.y * 100) / 100;
    const bala = sim.posicaoBala(disparo, x, y, 0, 0, q)!;
    if (sim.balaEncosta(sim.posicaoInimigo(e, q)!, bala, sim.RAIO.drone)) break;
  }
  // a bala sai da nave alinhada com o drone no passo do acerto; como ele cruza devagar, refaz pelo lugar no disparo
  const noDisparo = { x, y };
  const pontos = () => p.estado(anaId).jogadores.find((l) => l.userId === anaId)!.pontos;

  p.irAoPasso(q - FOLGA_PASSOS - 20);
  p.jogo.tempoReal!(anaId, { ev: [['a', q, i, disparo, noDisparo.x, noDisparo.y, 0, 0]] });
  assert.equal(pontos(), 0, 'o acerto dito no futuro não vale');
  p.irAoPasso(q + 2);
  p.jogo.tempoReal!(anaId, {
    ev: [
      ['a', q, i, disparo + 1, noDisparo.x, noDisparo.y, 0, 0],
      ['a', q, i, disparo, noDisparo.x, noDisparo.y, 1, 0],
      ['t', q, i, disparo - 1, noDisparo.x, noDisparo.y],
      ['v', q, -5, 0],
    ],
  });
  assert.equal(pontos(), 0, 'nada disso vale');
  assert.equal(p.estado(anaId).meu?.ramo, 0, 'a rota só na bifurcação');

  // na outra partida: a nave dita longe e depois perto do drone, rápido demais, não vale; o honesto vale uma vez só
  const p2 = comecar([anaId, biaId]);
  p2.andar();
  p2.irAoPasso(q + 2);
  p2.jogo.tempoReal!(anaId, { p: disparo - 2, x: -sim.LIM_X, y: -sim.LIM_Y, ev: [] });
  p2.jogo.tempoReal!(anaId, { ev: [['a', q, i, disparo, noDisparo.x, noDisparo.y, 0, 0]] });
  assert.equal(p2.estado(anaId).meu?.mortos.length, 0, 'a nave não chega lá a tempo');
  const p3 = comecar([anaId, biaId]);
  p3.andar();
  p3.irAoPasso(q + 2);
  const resp = p3.jogo.tempoReal!(anaId, { p: q, x: noDisparo.x, y: noDisparo.y, ev: [['a', q, i, disparo, noDisparo.x, noDisparo.y, 0, 0], ['a', q, i, disparo, noDisparo.x, noDisparo.y, 0, 0]] }) as { m?: number[] };
  assert.deepEqual(resp.m, [i], 'o drone caiu, e a turma fica sabendo');
  assert.equal(p3.estado(anaId).jogadores.find((l) => l.userId === anaId)!.pontos, sim.PONTOS.drone);
  // um golpe de tamanho inventado não conta, e o evento velho também não
  p3.irAoPasso(q + 2000);
  p3.jogo.tempoReal!(anaId, { ev: [['b', q + 10, noDisparo.x, noDisparo.y], ['d', q + 1990, noDisparo.x, noDisparo.y, 1]] });
  assert.equal(p3.estado(anaId).meu?.escudo, sim.ESCUDO_MAX);
  assert.equal(p3.jogo.tempoReal!(999, { p: q, x: 0, y: 0 }), null, 'quem não joga não manda nada');
});

test('o escudo acaba duas vezes: a partida acaba para quem caiu', () => {
  const p = comecar([biaId]);
  p.andar();
  let n = 100;
  for (let k = 0; k < 10; k++) {
    p.irAoPasso(n + 1);
    p.jogo.tempoReal!(biaId, { ev: [['d', n, sim.NASCER.x, sim.NASCER.y, 20]] });
    n += sim.INVUL_MORTE + 5;
  }
  assert.equal(p.estado(biaId).meu?.vidas, 0);
  p.andar();
  assert.ok(p.terminou(), 'sem ninguém no ar, a partida fecha');
  assert.equal(p.estado(biaId).jogadores[0].pontos, 0);
});

test('a rota do gelo (24/11/2026): escolhida na largada, a mesma conta nas duas pontas, e o recorde à parte na tabela comum', () => {
  const doPlaneta = db.recordeEstelar(biaId);
  const p = comecar([biaId], 0, { rota: sim.ROTA_DO_GELO });
  assert.equal((p.estado(biaId) as unknown as { rota: number }).rota, sim.ROTA_DO_GELO);
  p.andar();
  const m = jogar(p, biaId);
  assert.equal(m.r.rota, sim.ROTA_DO_GELO);
  assert.ok(m.ficha.chefeEm !== null, 'o piloto derruba a nave-mãe');
  p.andar();
  assert.ok(p.terminou());
  const fim = p.estado(biaId);
  assert.equal(fim.jogadores[0].pontos, m.ficha.total(sim.FIM, true), 'os pontos do servidor são os da tela');
  assert.equal(fim.recorde?.novo, true);
  assert.equal(db.recordeDoSolo(biaId, 'estelar', 'gelo')?.valor, fim.jogadores[0].pontos);
  assert.equal(db.recordeEstelar(biaId), doPlaneta, 'o recorde da rota do planeta não mudou');
  // rota que não existe vira a do planeta
  const q = comecar([biaId], 0, { rota: 9 });
  assert.equal((q.estado(biaId) as unknown as { rota: number }).rota, sim.ROTA_DO_PLANETA);
});
