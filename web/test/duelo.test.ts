import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { criarPartida, type EventoDoDuelo, type ResultadoDoSolo } from '../src/duelo/partida';
import {
  ARENA,
  caminhoDoMissil,
  DURACAO_PASSOS,
  ervilhaNoPasso,
  largada,
  naArena,
  noCaminho,
  protegido,
  RAIO_DO_MISSIL,
  VEL_MAX,
  VIDAS,
  voar,
} from '../src/duelo/sim';

/**
 * O Duelo de aviõezinhos no site: as duas cópias da simulação são iguais, o avião não sai da cerca, a cenoura persegue e
 * quebra na cerca, a curva fechada protege, uma partida do Solo inteira (eu no piloto automático contra três do computador)
 * acaba com tiros e acertos, e, com o servidor de verdade e 200 ms de ida e volta, dois pilotos automáticos terminam um
 * duelo em que a tela de cada um concorda com o servidor.
 */

test('as duas cópias da simulação são iguais, e só com + − × ÷ e raiz', () => {
  const site = readFileSync(new URL('../src/duelo/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/duelo-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/duelo/sim.ts e server/src/duelo-sim.ts mudaram separados: copie uma sobre a outra');
  assert.doesNotMatch(site.toString(), /Math\.(sin|cos|tan|atan|atan2|exp|log|pow)\b/);
});

test('o avião voa dentro da cerca, quica nela, e não passa da velocidade máxima', () => {
  const a = largada(0);
  for (let s = 0; s < 3000; s++) {
    const antes = { x: a.x, y: a.y };
    voar(a, { acelera: s % 300 < 200, freia: s % 300 >= 250, vira: s % 500 < 100 ? 1 : 0 });
    assert.ok(naArena(a.x, a.y), `fora da cerca em (${a.x}, ${a.y})`);
    assert.ok(Math.hypot(a.x - antes.x, a.y - antes.y) <= VEL_MAX / 60 + 1e-9);
    assert.ok(Math.abs(Math.hypot(a.hx, a.hy) - 1) < 1e-9);
  }
});

test('a ervilha anda reta e some na cerca; a cenoura persegue o alvo pelas amostras e quebra na cerca', () => {
  const e = { n: 10, x: 160, y: 120, dx: 1, dy: 0 };
  assert.deepEqual(ervilhaNoPasso(e, 10), [160, 120]);
  assert.equal(ervilhaNoPasso(e, 9), null);
  assert.equal(ervilhaNoPasso(e, 10 + 60), null, 'passou da cerca da direita');
  // o alvo parado embaixo, à direita: a cenoura que sai para a direita faz a curva e chega nele
  const amostras = [0, 230, 200, 1, 0];
  const c = caminhoDoMissil({ n: 0, x: 100, y: 120, dx: 1, dy: 0, alvo: 2 }, amostras, 300)!;
  let perto = Infinity;
  for (let k = 0; k < c.length; k += 2) perto = Math.min(perto, Math.hypot(c[k] - 230, c[k + 1] - 200));
  assert.ok(perto < RAIO_DO_MISSIL, `a cenoura passou a ${perto.toFixed(1)} do alvo`);
  // sem amostra, reta, até a cerca
  const reta = caminhoDoMissil({ n: 0, x: 100, y: 120, dx: 1, dy: 0, alvo: 2 }, [], 300)!;
  const ultimo = noCaminho(reta, 0, reta.length / 2 - 1)!;
  assert.ok(ultimo[0] <= ARENA[2] && ultimo[0] > ARENA[2] - 3);
  // o mesmo lançamento, as mesmas amostras: o mesmo caminho
  assert.deepEqual(caminhoDoMissil({ n: 0, x: 100, y: 120, dx: 1, dy: 0, alvo: 2 }, amostras, 300), c);
});

test('a curva fechada na cerca protege por meio segundo; longe dela, não', () => {
  // perto da cerca de cima, virou 90° em 8 passos
  const perto = [100, 100, 20, 1, 0, 108, 104, 22, 0, 1];
  assert.equal(protegido(perto, 108), true);
  assert.equal(protegido(perto, 137), true);
  assert.equal(protegido(perto, 138), false, 'meio segundo depois');
  assert.equal(protegido(perto, 107), false, 'antes da curva');
  const longe = [100, 160, 120, 1, 0, 108, 164, 122, 0, 1];
  assert.equal(protegido(longe, 108), false);
  const devagar = [100, 100, 20, 1, 0, 140, 104, 22, 0, 1];
  assert.equal(protegido(devagar, 140), false, 'virou em mais de 24 passos');
});

test('o Solo inteiro: o piloto automático contra três do computador acaba, com tiros e acertos', () => {
  const soma = { ervilhas: 0, misseis: 0, acertos: 0 };
  for (const semente of [1, 2, 3, 4]) {
    const eventos: EventoDoDuelo[] = [];
    let fim: ResultadoDoSolo | null = null;
    const participantes = [
      { id: 7, nome: 'eu', avatar: 3, largada: 0 },
      { id: -1, nome: 'a', avatar: null, largada: 1 },
      { id: -2, nome: 'b', avatar: null, largada: 2 },
      { id: -3, nome: 'c', avatar: null, largada: 3 },
    ];
    const p = criarPartida({
      comandos: { acelera: false, freia: false, vira: 0, fogo: false },
      eu: 7,
      piloto: true,
      autopiloto: () => true,
      participantes,
      robos: [-1, -2, -3],
      vidas: new Map(participantes.map((q) => [q.id, VIDAS])),
      amostras: new Map(),
      eventos,
      aoFim: (r) => (fim = r),
    });
    // um pouco de sorte diferente por partida
    for (const l of p.locais) if (l.memoria) l.memoria.semente += semente * 977;
    while (!fim && p.n < DURACAO_PASSOS + 10) {
      p.passo();
      for (const l of p.locais) assert.ok(naArena(l.aviao.x, l.aviao.y));
    }
    assert.ok(fim, 'a partida acabou');
    const r = fim as ResultadoDoSolo;
    soma.ervilhas += eventos.filter((e) => e.tipo === 'ervilha').length;
    soma.misseis += eventos.filter((e) => e.tipo === 'missil').length;
    soma.acertos += eventos.filter((e) => e.tipo === 'acerto').length;
    assert.ok(r.posicao >= 1 && r.posicao <= 4);
    assert.ok(r.passos <= DURACAO_PASSOS);
    // o fim confere com as vidas: quem caiu não ganhou
    if (r.vidas === 0) assert.ok(r.posicao > 1);
  }
  assert.ok(soma.ervilhas > 80, `ervilhas: ${soma.ervilhas}`);
  assert.ok(soma.misseis > 0, `cenouras: ${soma.misseis}`);
  assert.ok(soma.acertos > 8, `acertos: ${soma.acertos}`);
});

test('com o servidor de verdade e 200 ms de ida e volta, dois pilotos automáticos terminam o duelo, e as telas concordam com ele', async () => {
  process.env.DATABASE_PATH = join(tmpdir(), `syden-duelo-${process.pid}-${Date.now()}.db`);
  process.env.MEDIA_PATH = process.env.DATABASE_PATH.replace(/\.db$/, '-arquivos');
  const s = await import('../../server/src/minijogo-duelo.ts');
  const db = await import('../../server/src/db.ts');
  let agora = 5_000_000;
  let relogio: { ms: number; depois: () => void } | null = null;
  let terminou = false;
  // contas de verdade num banco em branco (o pódio vai à estante de troféus)
  const ids = ['ana', 'bia', 'caio'].map((nome) => db.createUser(`${nome}-duelo-${Date.now()}`, 'x').id);
  const vivoNoServidor = (id: number) =>
    (jogo.publico(id) as { jogadores: { userId: number; vivo: boolean }[] }).jogadores.find((l) => l.userId === id)?.vivo === true;
  const difundidos: { em: number; d: Record<string, unknown> }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => (relogio = { ms: agora + ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => ids,
    nome: (id: number) => `p${id}`,
    comunidade: 0,
    difundir: (d: unknown) => difundidos.push({ em: agora, d: d as Record<string, unknown> }),
  };
  const jogo = s.criarDueloDeAvioes({ agora: () => agora }).comecar(ctx, { naSala: ids, criadaPor: ids[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const IDA = 100;
  let avisados = 0;
  const participantes = ids.map((id, i) => ({ id, nome: `p${id}`, avatar: null, largada: i }));
  // cada cliente: a partida dele, a fila do que vai ao servidor, e a do que chega
  const clientes = ids.map((id) => {
    const eventos: EventoDoDuelo[] = [];
    const amostras = new Map<number, number[]>();
    const vidas = new Map(ids.map((q) => [q, VIDAS]));
    const saida: { em: number; d: Record<string, unknown> }[] = [];
    const p = criarPartida({
      comandos: { acelera: false, freia: false, vira: 0, fogo: false },
      eu: id,
      piloto: true,
      autopiloto: () => true,
      participantes,
      vidas,
      amostras,
      eventos,
      enviar: (d) => {
        if (d.tipo === 'acertou') avisados++;
        saida.push({ em: agora + IDA, d });
      },
    });
    for (const l of p.locais) l.memoria = null;
    return { id, p, eventos, amostras, vidas, saida, entrada: [] as { em: number; d: Record<string, unknown> }[], recusadas: 0 };
  });
  // a largada
  agora += s.LARGADA_MS;
  relogio!.depois();
  const verde = agora;
  let lidosDifundidos = 0;
  let drenar = 30;
  for (let passo = 1; passo <= 75 * 60 + 200 && (!terminou || drenar-- > 0); passo++) {
    agora = verde + (passo * 1000) / 60;
    // o servidor recebe o que já chegou
    for (const c of clientes) {
      while (c.saida.length && c.saida[0].em <= agora) {
        const { d } = c.saida.shift()!;
        const r = jogo.tempoReal!(c.id, d);
        if (d.tipo === undefined && r === null && !terminou && vivoNoServidor(c.id)) c.recusadas++;
        if (r) for (const o of clientes) if (o.id !== c.id) o.entrada.push({ em: agora + IDA, d: r as Record<string, unknown> });
      }
    }
    for (; lidosDifundidos < difundidos.length; lidosDifundidos++) for (const o of clientes) o.entrada.push({ em: agora + IDA, d: difundidos[lidosDifundidos].d });
    if (passo % 15 === 0) jogo.conferir!();
    // cada cliente recebe e anda um passo
    for (const c of clientes) {
      while (c.entrada.length && c.entrada[0].em <= agora) {
        const { d } = c.entrada.shift()!;
        if (d.tipo === 'ervilha' || d.tipo === 'missil' || d.tipo === 'acerto') {
          if (!c.eventos.some((e) => e.id === d.id && e.tipo === d.tipo)) c.eventos.push(d as unknown as EventoDoDuelo);
        } else if (typeof d.userId === 'number') {
          let a = c.amostras.get(d.userId);
          if (!a) c.amostras.set(d.userId, (a = []));
          a.push(d.n as number, d.x as number, d.y as number, d.hx as number, d.hy as number);
        }
      }
      c.p.passo();
    }
    if (relogio && agora >= (relogio as { ms: number }).ms) (relogio as { depois: () => void }).depois();
  }
  assert.ok(terminou, 'o servidor fechou a partida');
  const linhas = (jogo.publico(ids[0]) as { jogadores: { userId: number; vidas: number; posicao: number | null; acertos: number }[] }).jogadores;
  const acertos = difundidos.filter((x) => x.d.tipo === 'acerto').length;
  assert.ok(acertos >= 2, `acertos no servidor: ${acertos}`);
  // quem levou avisou alguns; os outros o servidor achou sozinho, refazendo o caminho (a ervilha de perto, que chega à tela
  // da vítima depois de já ter passado por ela)
  assert.ok(avisados >= 1, 'ninguém avisou');
  for (const c of clientes) {
    assert.equal(c.recusadas, 0, `posições recusadas de p${c.id}`);
    // a tela dele chegou à verdade do servidor (depois de o último acerto chegar)
    for (const l of linhas) assert.equal(c.p.vidasDe(l.userId), l.vidas, `p${c.id} vê p${l.userId} com ${c.p.vidasDe(l.userId)}, o servidor diz ${l.vidas}`);
  }
  // e quase todo acerto foi avisado por quem levou (o servidor só achou sozinho os de borda)
  assert.equal(linhas[0].posicao, 1);
});
