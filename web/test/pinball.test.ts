import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sim from '../src/pinball/sim.ts';

/** O Pinball da horta: a regra (pinball/sim.ts), que é a mesma do servidor, e o piloto automático. */

/** Uma partida do piloto automático, com a força da mola variando pela semente (sem sorteio). */
function partida(semente: number, limite = sim.PASSOS_MAXIMOS) {
  const k = sim.novaMesa(limite);
  const comandos: number[] = [];
  const eventos: Record<string, number> = {};
  while (!k.terminou) {
    let c = sim.pilotoAutomatico(k);
    if (k.bolas.some((b) => b.naMola && !b.auto)) c = k.carga < 28 + ((semente * 13 + k.bola * 7) % 23) ? sim.MOLA : 0;
    comandos.push(c);
    sim.passo(k, c);
    for (const e of k.eventos) eventos[e.tipo] = (eventos[e.tipo] ?? 0) + 1;
  }
  return { k, comandos, eventos };
}

test('a regra é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/pinball/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/pinball-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'mexeu num, copie no outro');
});

test('a regra não usa seno, cosseno, sorteio nem relógio (o mesmo número em qualquer navegador)', () => {
  const fonte = readFileSync(new URL('../src/pinball/sim.ts', import.meta.url), 'utf8');
  for (const proibido of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Math.hypot', 'Math.pow', 'Date.', 'performance.']) {
    assert.ok(!fonte.includes(proibido), `a regra usa ${proibido}`);
  }
});

test('as tabelas de giro fecham: o arco vai da esquerda à direita, e a palheta vai de 30° abaixo a 25° acima', () => {
  const [ex, ey] = sim.PONTOS_DO_ARCO[0];
  const [dx, dy] = sim.PONTOS_DO_ARCO.at(-1)!;
  assert.ok(Math.abs(ex - (sim.ARCO_X - sim.ARCO_R)) < 1e-9 && Math.abs(ey - sim.ARCO_Y) < 1e-9);
  assert.ok(Math.abs(dx - (sim.ARCO_X + sim.ARCO_R)) < 1e-6 && Math.abs(dy - sim.ARCO_Y) < 1e-6);
  const [ux, uy] = sim.DIRECOES[sim.POSICOES];
  assert.ok(Math.abs(ux - Math.cos((25 * Math.PI) / 180)) < 1e-9 && Math.abs(uy + Math.sin((25 * Math.PI) / 180)) < 1e-9);
});

test('o piloto automático mantém a bola viva, pontua e passa por tudo: repolhos, cenouras, pistas, toca e multibola', () => {
  let segundos = 0;
  let pontos = 0;
  const total: Record<string, number> = {};
  for (let s = 0; s < 8; s++) {
    const { k, eventos } = partida(s);
    assert.ok(k.pontos > 0, `a partida ${s} pontuou`);
    segundos += k.passo / 60;
    pontos += k.pontos;
    for (const [e, n] of Object.entries(eventos)) total[e] = (total[e] ?? 0) + n;
  }
  assert.ok(segundos / 8 > 60, `a bola fica viva um bom tempo (média de ${(segundos / 8).toFixed(0)} s por partida)`);
  for (const e of ['repolho', 'estilingue', 'cenoura', 'colheita', 'pista', 'multiplicador', 'multibola', 'orbita', 'perdeu', 'fim']) {
    assert.ok((total[e] ?? 0) > 0, `nenhum "${e}" em oito partidas`);
  }
  assert.ok(pontos > 0);
});

test('determinismo: os mesmos comandos dão a mesma partida, também em trechos e com trechos repetidos', () => {
  const { k, comandos } = partida(3);
  const inteira = sim.novaMesa();
  sim.aplicar(inteira, sim.compactar(comandos));
  assert.equal(inteira.pontos, k.pontos);
  assert.equal(inteira.passo, k.passo);
  // em trechos de 60 passos, cada um repetindo os 30 anteriores (o que o servidor recebe quando uma resposta se perde)
  const aos = sim.novaMesa();
  for (let de = 0; de < comandos.length; de += 60) {
    const inicio = Math.max(0, de - 30);
    const e = sim.compactar(comandos, inicio, Math.min(comandos.length, de + 60));
    assert.ok(sim.entradasValidas(e));
    sim.aplicar(aos, e, aos.passo - inicio);
  }
  assert.equal(aos.pontos, k.pontos);
  assert.equal(aos.passo, k.passo);
});

test('a mola: fraca, a bola volta para ela; parada 10 s, ela sai sozinha; a bola salva volta pela mola', () => {
  const k = sim.novaMesa();
  for (let i = 0; i < 3; i++) sim.passo(k, sim.MOLA);
  sim.passo(k, 0);
  let voltou = false;
  for (let i = 0; i < 300 && !voltou; i++) {
    sim.passo(k, 0);
    voltou = k.bolas[0].naMola;
  }
  assert.ok(voltou, 'a bola fraca voltou à mola');
  let saiu = false;
  for (let i = 0; i < 700 && !saiu; i++) {
    sim.passo(k, 0);
    saiu = k.eventos.some((e) => e.tipo === 'mola');
  }
  assert.ok(saiu, 'a mola saiu sozinha');
  // sem palheta nenhuma, a bola cai logo: dentro dos 8 s da proteção ela volta pela mola
  const m = sim.novaMesa();
  for (let i = 0; i < 45; i++) sim.passo(m, sim.MOLA);
  let salva = false;
  let perdeu = false;
  while (!perdeu && m.passo < 5000) {
    sim.passo(m, 0);
    salva ||= m.eventos.some((e) => e.tipo === 'salva');
    perdeu = m.eventos.some((e) => e.tipo === 'perdeu');
  }
  assert.ok(perdeu, 'sem palheta, a bola acaba caindo');
  assert.equal(m.bola, 2);
  assert.ok(salva, 'caiu dentro dos 8 s: voltou pela mola, e só a segunda queda acabou a bola');
});

test('o limite da sala: a partida acaba no passo do limite, mesmo com bola em jogo', () => {
  const { k } = partida(1, 600);
  assert.ok(k.terminou);
  assert.ok(k.passo <= 600);
});
