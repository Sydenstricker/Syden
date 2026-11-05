/**
 * O Futebol dos coelhos: a simulação (web/src/futebol/sim.ts) existe também no servidor (server/src/futebol-sim.ts), igual byte a
 * byte. Aqui se confere a igualdade, que ela é determinística (o mesmo comando dá o mesmo jogo), que o piloto automático marca
 * gol contra os robôs no Solo, e, com o servidor de verdade e 100 ms de rede para cada lado, que a sala funciona: o meu coelho
 * anda aqui, o chute vai e volta aceito, e o time faz gol.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ClienteDaSala, type Quadro } from '../src/futebol/sala';
import * as sim from '../src/futebol/sim';

test('as duas cópias da simulação (a do site e a do servidor) são iguais, byte a byte', () => {
  const site = readFileSync(new URL('../src/futebol/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/futebol-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/futebol/sim.ts e server/src/futebol-sim.ts diferem: copie uma sobre a outra');
});

test('a simulação não usa seno, cosseno nem sorteio (o mesmo número em qualquer computador)', () => {
  const codigo = readFileSync(new URL('../src/futebol/sim.ts', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n');
  for (const proibido of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Math.pow', 'Math.exp', 'Math.log', 'Date.']) {
    assert.ok(!codigo.includes(proibido), proibido);
  }
  assert.ok(!/^import /m.test(codigo), 'a simulação não importa nada');
});

/** Uma partida inteira só de robôs (a pessoa `1` jogando como robô, com a velocidade de gente). */
function partida(porTime: number, comando?: (m: sim.Mundo, j: sim.Jogador) => sim.Comando) {
  const ids = Array.from({ length: porTime * 2 - 1 }, (_, k) => -(k + 1));
  const m = sim.novoMundo([[1, ...ids.slice(0, porTime - 1)], ids.slice(porTime - 1)]);
  const eventos: string[] = [];
  while (!m.fim) {
    sim.passoDoMundo(m, (j) => (j.id === 1 && comando ? comando(m, j) : sim.comandoDoRobo(m, j)));
    for (const e of m.eventos) eventos.push(e.tipo);
  }
  return { m, eventos };
}

test('determinística: a mesma partida duas vezes dá o mesmo jogo, passo a passo', () => {
  const a = partida(3);
  const b = partida(3);
  assert.deepEqual(a.m, b.m);
  assert.deepEqual(a.eventos, b.eventos);
  assert.equal(a.m.passo, sim.PARTIDA_PASSOS);
  assert.ok(a.m.tempo >= sim.CONTAGEM + sim.PARTIDA_PASSOS);
});

test('no Solo, o piloto automático (o robô com pernas de gente) marca gol contra os robôs', () => {
  for (const n of [1, 2]) {
    const { m, eventos } = partida(n);
    assert.ok(m.placar[0] > 0, `${n} × ${n}: ${m.placar.join(' × ')}`);
    assert.ok(eventos.includes('chute') && eventos.includes('dominio'));
  }
});

test('a bola: quica na parede, para com o atrito, e entra no gol só pela boca', () => {
  const m = sim.novoMundo([[1], [-1]]);
  const b = m.bola;
  // para cima, contra a parede de cima
  Object.assign(b, { x: 200, y: sim.Y0 + 10, vx: 0, vy: -6, dono: 0 });
  for (let k = 0; k < 5; k++) sim.passoDaBola(m, true);
  assert.ok(b.vy > 0, 'voltou');
  // o atrito para a bola
  Object.assign(b, { x: 300, y: 200, vx: 3, vy: 0 });
  for (let k = 0; k < 600; k++) sim.passoDaBola(m, true);
  assert.equal(b.vx, 0);
  // no fundo, fora da boca: parede
  Object.assign(b, { x: sim.X1 - 20, y: sim.CY + sim.GOL_MEIA + 20, vx: 6, vy: 0 });
  let gol = -1;
  for (let k = 0; k < 20 && gol < 0; k++) gol = sim.passoDaBola(m, true);
  assert.equal(gol, -1);
  assert.ok(b.vx < 0);
  // pela boca: gol do time 0 (que ataca a direita)
  Object.assign(b, { x: sim.X1 - 20, y: sim.CY, vx: 6, vy: 0 });
  gol = -1;
  for (let k = 0; k < 20 && gol < 0; k++) gol = sim.passoDaBola(m, true);
  assert.equal(gol, 0);
});

test('na saída, o time que não a dá espera fora do círculo do meio', () => {
  const m = sim.novoMundo([[1], [-1]]);
  const outro = m.jogadores[1];
  outro.x = sim.CX + 5;
  outro.y = sim.CY;
  sim.foraDoCentro(m, outro);
  assert.ok(Math.abs(outro.x - sim.CX) >= sim.RAIO_DO_CENTRO);
});

test('com o servidor de verdade e 100 ms de rede para cada lado, o piloto automático joga na sala: chuta e o time faz gol', async () => {
  const s = await import('../../server/src/minijogo-futebol.ts');
  let agora = 1_000_000;
  let passo: (() => void) | null = null;
  let terminou = false;
  const REDE = 100;
  const paraOSite: { em: number; q: Quadro }[] = [];
  const paraOServidor: { em: number; d: unknown }[] = [];
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => [7],
    nome: () => 'ana',
    comunidade: 0,
    difundir: (d: unknown) => paraOSite.push({ em: agora + REDE, q: d as Quadro }),
  };
  const jogo = s.criarFutebol({ agora: () => agora, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, { naSala: [7], criadaPor: 7, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const pub = jogo.publico(7) as { times: { userId: number; slot: number }[][] };
  let aceitos = 0;
  const cliente = new ClienteDaSala(
    pub.times.map((t) => t.map((p) => p.userId)),
    7,
    (d) => paraOServidor.push({ em: agora + REDE, d }),
    () => {},
  );
  const m = (jogo as unknown as { _mundo: sim.Mundo })._mundo;
  for (let k = 0; !terminou && k < 60 * 60 * 5; k++) {
    agora += 1000 / 60;
    // o servidor anda de 50 em 50 ms e recebe o que chegou
    while (paraOServidor.length && paraOServidor[0].em <= agora) jogo.tempoReal!(7, paraOServidor.shift()!.d);
    if (k % 3 === 0) passo!();
    while (paraOSite.length && paraOSite[0].em <= agora) {
      const q = paraOSite.shift()!.q;
      for (const c of q.c) if (c[0] === 7 && c[2] === 1) aceitos++;
      cliente.receber(q, agora);
    }
    cliente.atualizar(agora);
    if (cliente.eu) cliente.passo(sim.comandoDoRobo(cliente.vista, cliente.eu), agora);
  }
  assert.equal(terminou, true, 'a partida acabou');
  assert.ok(aceitos > 0, 'o servidor aceitou chutes da pessoa');
  assert.ok(m.placar[0] > 0, `o time da pessoa fez gol: ${m.placar.join(' × ')}`);
  const eu = m.jogadores.find((j) => j.id === 7)!;
  assert.ok(cliente.latencia > 60 && cliente.latencia < 160, `a ida medida: ${cliente.latencia}`);
  assert.ok(eu.gols >= 0);
});
