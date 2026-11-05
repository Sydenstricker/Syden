/**
 * A Esquadrilha da toca (minijogo-nave.ts): os eventos vão pelo tempo real, e cada um passa pela ficha do piloto (nave-sim.ts,
 * a mesma conta do site). Aqui o site é o próprio mundo do site com o piloto automático (web/src/nave), e o relógio é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarNave, PREPARO_MS, FOLGA_PASSOS } = await import('../src/minijogo-nave.js');
const sim = await import('../src/nave-sim.js');
const { Mundo } = await import('../../web/src/nave/mundo.ts');
const { pilotar } = await import('../../web/src/nave/piloto.ts');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-nave');
const bia = await criarConta(app, 'bia-nave');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

interface Estado {
  fase: string;
  semente: number;
  jogadores: { userId: number; pontos: number; vidas: number; chefe: boolean; posicao: number | null }[];
  esquadrilha: number;
  meu: { vidas: number; mortos: number[] } | null;
  recorde: { antes: number | null; novo: boolean } | null;
}

function comecar(naSala: number[], comunidade = 0) {
  let relogio: { ms: number; depois: () => void; em: number } | null = null;
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => (relogio = { ms, depois, em: agora + ms }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
  };
  let semente = 11;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const jogo = criarNave({ agora: () => agora, aleatorio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  let inicio = 0;
  return {
    jogo,
    estado: (id: number) => jogo.publico(id) as unknown as Estado,
    terminou: () => terminou,
    /** Leva o relógio ao que está marcado, e o dispara. */
    andar() {
      const r = relogio!;
      relogio = null;
      agora = Math.max(agora, r.em);
      r.depois();
      if ((jogo.publico(naSala[0]) as unknown as Estado).fase === 'jogando' && inicio === 0) inicio = agora;
    },
    /** O relógio vai até o passo `n` da partida; o que estava marcado para antes, dispara. */
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
  const servidor = readFileSync(new URL('../src/nave-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../../web/src/nave/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/nave-sim.ts e web/src/nave/sim.ts mudaram separados: copie uma sobre a outra');
});

/** Joga com o piloto automático; a cada 6 passos, o lote vai ao servidor. `quem` pilota; os outros só deixam o tempo passar. */
function jogar(p: ReturnType<typeof comecar>, quem: number, ate = sim.FIM) {
  const m = new Mundo(p.estado(quem).semente, true);
  for (let n = 0; n <= ate && !p.terminou(); n++) {
    m.avancar(pilotar(m));
    if (n % 6 === 0 || m.ficha.acabou) {
      p.irAoPasso(m.passo);
      p.jogo.tempoReal!(quem, { p: m.passo, x: m.nave.x, y: m.nave.y, ev: m.eventos.splice(0) });
    }
    if (m.ficha.acabou && !m.eventos.length) break;
  }
  return m;
}

test('no Solo, a partida inteira com o piloto: o servidor aceita tudo, chega aos mesmos pontos, e a partida vira o recorde', () => {
  const p = comecar([anaId]);
  assert.equal(p.estado(anaId).fase, 'preparando');
  p.andar();
  assert.equal(p.estado(anaId).fase, 'jogando');
  const m = jogar(p, anaId);
  assert.ok(m.ficha.chefeEm !== null, 'o piloto derruba o espantalho');
  // todos acabaram: o placar fecha logo, sem esperar o fim do relógio
  p.andar();
  assert.ok(p.terminou());
  const fim = p.estado(anaId);
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.jogadores[0].pontos, m.ficha.total(sim.FIM, true), 'os pontos do servidor são os da tela');
  assert.equal(fim.jogadores[0].chefe, true);
  assert.equal(fim.recorde?.novo, true);
  assert.equal(db.recordeDaNave(anaId), fim.jogadores[0].pontos);
  assert.ok(!db.trofeusDe(anaId).some((t) => t.pista === 'nave'), 'o Solo não dá troféu');
});

test('com a turma: a Ana pilota, a Bia fica parada até acabar o tempo; o pódio vai para a estante', () => {
  const p = comecar([anaId, biaId], 1);
  p.andar();
  const m = jogar(p, anaId);
  // a Bia não mandou nada: a partida espera o relógio do fim
  assert.equal(p.terminou(), false);
  p.andar();
  assert.ok(p.terminou());
  const fim = p.estado(biaId);
  assert.equal(fim.jogadores[0].userId, anaId);
  assert.equal(fim.jogadores[0].posicao, 1);
  assert.equal(fim.jogadores[0].pontos, m.ficha.total(sim.FIM, true));
  // a Bia não morreu (ninguém disse que ela foi atingida): sobreviveu às ondas, e isso vale pontos
  assert.equal(fim.jogadores[1].pontos, sim.SOBREVIVER * sim.ONDAS + sim.POR_VIDA * sim.VIDAS);
  assert.equal(fim.esquadrilha, fim.jogadores[0].pontos + fim.jogadores[1].pontos);
  assert.ok(db.trofeusDe(anaId).some((t) => t.pista === 'nave' && t.posicao === 1));
  assert.ok(db.trofeusDe(biaId).some((t) => t.pista === 'nave' && t.posicao === 2));
});

test('o servidor confere o relógio, a cadência, a arma e o lugar', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const inimigos = sim.roteiro(p.estado(anaId).semente);
  const i = inimigos.findIndex((x) => x.tipo === 'corvo');
  const e = inimigos[i];
  // um disparo honesto: a nave parada logo abaixo do primeiro corvo, no passo da cadência
  let disparo = e.t + Math.round(e.dur / 2);
  while (disparo % sim.CADENCIA !== 0) disparo++;
  const q = disparo + 4;
  const alvo = sim.posicaoInimigo(e, q)!;
  const x = Math.round(alvo.x * 100) / 100;
  const y = Math.round((alvo.y + 26) * 100) / 100;
  const pontos = () => p.estado(anaId).jogadores.find((l) => l.userId === anaId)!.pontos;

  // o acerto dito no futuro (mais adiante que a folga da rede) não vale
  p.irAoPasso(q - FOLGA_PASSOS - 20);
  p.jogo.tempoReal!(anaId, { ev: [['a', q, i, disparo, x, y, 0, 0]] });
  assert.equal(pontos(), 0);
  // fora da cadência, com a arma que ela não tem, ou com a nave teleportada: também não
  p.irAoPasso(q + 2);
  p.jogo.tempoReal!(anaId, { p: 0, x: 10, y: 230, ev: [] });
  p.jogo.tempoReal!(anaId, {
    ev: [
      ['a', q, i, disparo + 1, x, y, 0, 0],
      ['a', q, i, disparo, x, y, 1, 0],
      ['a', q, i, disparo, x, y, 0, 0],
    ],
  });
  if (Math.hypot(x - 10, y - 230) > disparo * sim.VEL_NAVE + 2) assert.equal(pontos(), 0, 'a nave não chega lá a tempo');
  // na segunda partida, sem o lugar falso: o mesmo acerto vale, uma vez só
  const p2 = comecar([anaId, biaId]);
  p2.andar();
  p2.irAoPasso(q + 2);
  const r = p2.jogo.tempoReal!(anaId, { p: q, x, y, ev: [['a', q, i, disparo, x, y, 0, 0], ['a', q, i, disparo, x, y, 0, 0]] }) as { m?: number[] };
  assert.deepEqual(r.m, [i], 'o corvo caiu, e a turma fica sabendo');
  const ganhou = p2.estado(anaId).jogadores.find((l) => l.userId === anaId)!.pontos;
  assert.equal(ganhou, sim.PONTOS.corvo);
  // um evento muito velho (passou da janela) não vale
  p2.irAoPasso(q + 2000);
  p2.jogo.tempoReal!(anaId, { ev: [['b', q + 10, x, y]] });
  assert.equal(p2.estado(anaId).meu?.mortos.length, 1, 'a bomba velha não derrubou ninguém');
  // quem não joga não manda nada
  assert.equal(p2.jogo.tempoReal!(999, { p: q, x, y }), null);
});

test('três golpes tiram as três vidas; a partida acaba para quem caiu e para quem derrubou o chefe', () => {
  const p = comecar([biaId]);
  p.andar();
  let n = 100;
  for (let k = 0; k < 3; k++) {
    p.irAoPasso(n + 1);
    p.jogo.tempoReal!(biaId, { ev: [['d', n, sim.NASCER.x, sim.NASCER.y]] });
    n += sim.INVUL_MORTE + 5;
  }
  assert.equal(p.estado(biaId).meu?.vidas, 0);
  p.andar();
  assert.ok(p.terminou(), 'sem ninguém no ar, a partida fecha');
  assert.equal(p.estado(biaId).jogadores[0].pontos, 0);
});

void PREPARO_MS;
