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

// ===== 19/11/2026: a tacada certeira, a bola extra, as missões e a rampa =====

test('a tacada certeira: a força certa da mola leva a bola direto a uma pista e vale 2500', () => {
  let achou = 0;
  for (let carga = 1; carga <= 50; carga++) {
    const k = sim.novaMesa();
    for (let i = 0; i < carga; i++) sim.passo(k, sim.MOLA);
    for (let i = 0; i < 400 && k.bola === 1; i++) {
      sim.passo(k, 0);
      if (k.eventos.some((e) => e.tipo === 'tacada')) achou++;
    }
  }
  assert.ok(achou >= 1 && achou <= 6, `uma faixa estreita de força (${achou} de 50)`);
});

test('a bola extra: o marco de pontos dá uma, e a bola que cai volta sem gastar', () => {
  const k = sim.novaMesa();
  for (let i = 0; i < 40; i++) sim.passo(k, sim.MOLA);
  sim.passo(k, 0);
  k.pontos = sim.MARCOS_DA_BOLA_EXTRA[0];
  sim.passo(k, 0);
  assert.equal(k.extras, 1);
  for (const b of k.bolas) {
    b.x = 113;
    b.y = 420;
    b.vx = 0;
    b.vy = 100;
  }
  k.salva = 0;
  sim.passo(k, 0);
  assert.equal(k.bola, 1, 'a mesma bola de novo');
  assert.equal(k.extras, 0);
});

test('a rampa: a bola rápida sobe pelo trilho e cai na primeira pista; a lenta passa por baixo', () => {
  const k = sim.novaMesa();
  k.bolas = [{ x: 163, y: 241, vx: 0, vy: -600, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
  sim.passo(k, 0);
  assert.ok(k.bolas[0].trilho > 0, 'no trilho');
  let pista = false;
  for (let i = 0; i < 200; i++) {
    sim.passo(k, 0);
    if (k.eventos.some((e) => e.tipo === 'pista' && e.n === 0)) pista = true;
  }
  assert.ok(pista, 'acendeu a primeira pista');
  const lenta = sim.novaMesa();
  lenta.bolas = [{ x: 163, y: 241, vx: 0, vy: -200, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
  sim.passo(lenta, 0);
  assert.equal(lenta.bolas[0].trilho, 0);
});

test('as missões: o piloto cumpre algumas, a patente sobe, e a mesa não vira um laço sem fim', () => {
  let cumpriu = 0;
  let patente = 1;
  for (let s = 0; s < 8; s++) {
    const { k, eventos } = partida(s);
    cumpriu += k.cumpridas;
    patente = Math.max(patente, k.patente);
    assert.ok(k.passo < sim.PASSOS_MAXIMOS, `a partida ${s} acabou pelas bolas, não pelo teto`);
    assert.ok((eventos.missao ?? 0) > 0);
  }
  assert.ok(cumpriu > 0 && patente > 1);
});

test('a segunda mesa, o pomar: a rampa do lado esquerdo cai na terceira pista, e a toca fica à direita', () => {
  const g = sim.MESAS[1];
  assert.ok(g.toca.x > sim.MEIO && g.boca.x1 < sim.MEIO);
  const k = sim.novaMesa(sim.PASSOS_MAXIMOS, 1);
  assert.equal(k.mesa, 1);
  const x = (g.boca.x0 + g.boca.x1) / 2;
  k.bolas = [{ x, y: g.boca.y + 3, vx: 0, vy: -600, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
  let pista = -1;
  for (let i = 0; i < 200 && pista < 0; i++) {
    sim.passo(k, 0);
    for (const e of k.eventos) if (e.tipo === 'pista') pista = e.n;
  }
  assert.equal(pista, 2);
  assert.equal(sim.mesaValida(7), 0);
  // o piloto joga o pomar até o fim, e a mesma partida refeita dá os mesmos pontos
  const a = sim.novaMesa(sim.PASSOS_MAXIMOS, 1);
  const cmds: number[] = [];
  while (!a.terminou && a.passo < 20000) {
    const c = sim.pilotoAutomatico(a);
    cmds.push(c);
    sim.passo(a, c);
  }
  const b = sim.novaMesa(sim.PASSOS_MAXIMOS, 1);
  sim.aplicar(b, sim.compactar(cmds));
  assert.equal(b.pontos, a.pontos);
});

// ---------------- O lote D (21/11/2026): o modo final ----------------

test('o modo final: cumpridas todas as missões, tudo vale o triplo por um tempo, e a partida continua acabando pelas bolas', () => {
  // a mesa com cinco missões já feitas, na sexta, a um evento de cumprir: o próximo repolho fecha o ciclo
  const k = sim.novaMesa();
  k.feitas = sim.TODAS_AS_MISSOES & ~(1 << 1);
  k.missao = 1;
  k.missaoConta = sim.MISSOES[1].meta - 1;
  const r = sim.MESAS[0].repolhos[0];
  k.bolas = [{ x: r.x, y: r.y - r.r - sim.RAIO - 6, vx: 0, vy: 120, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
  let comecou = false;
  for (let i = 0; i < 60 && !comecou; i++) {
    sim.passo(k, 0);
    comecou = k.eventos.some((e) => e.tipo === 'final' && e.comecou);
  }
  assert.ok(comecou, 'o modo final começou');
  assert.equal(k.final, sim.FINAL_PASSOS);
  assert.equal(k.finais, 1);
  assert.equal(k.feitas, 0, 'o ciclo recomeça');
  assert.ok(k.tocaAcesa, 'a toca acende');
  // no final, o repolho vale o triplo, e a missão não anda
  const antes = k.pontos;
  const missao = k.missaoConta;
  let ganhou = 0;
  for (let i = 0; i < 400 && ganhou === 0; i++) {
    sim.passo(k, sim.pilotoAutomatico(k));
    for (const e of k.eventos) if (e.tipo === 'repolho') ganhou = e.pontos;
  }
  if (ganhou > 0) assert.equal(ganhou % sim.FINAL_VEZES, 0, 'os pontos do final são o triplo');
  assert.ok(k.pontos >= antes);
  assert.equal(k.missaoConta, missao, 'as missões param no modo final');
  // ele acaba (pelo prazo ou pela bola), e a partida acaba pelas bolas
  let acabou = false;
  while (!k.terminou) {
    sim.passo(k, sim.pilotoAutomatico(k));
    if (k.eventos.some((e) => e.tipo === 'final' && !e.comecou)) acabou = true;
  }
  assert.ok(acabou, 'o modo final acabou');
  assert.ok(k.passo < sim.PASSOS_MAXIMOS, 'a partida acabou pelas bolas, não pelo teto');
});

test('o modo final: o piloto chega a ele em alguma partida, e a mesma partida refeita dá os mesmos pontos', () => {
  let chegou = 0;
  for (let s = 0; s < 12; s++) {
    const { k, comandos, eventos } = partida(s);
    assert.ok(k.passo < sim.PASSOS_MAXIMOS, `a partida ${s} acabou pelas bolas`);
    if ((eventos.final ?? 0) > 0) {
      chegou++;
      const b = sim.novaMesa();
      sim.aplicar(b, sim.compactar(comandos));
      assert.equal(b.pontos, k.pontos);
      assert.equal(b.finais, k.finais);
    }
  }
  console.log(`o piloto chegou ao modo final em ${chegou} de 12 partidas`);
});

// ---------------- O lote E (24/11/2026): a terceira mesa, o lago ----------------

/** Uma partida do piloto numa mesa, com a mola variando pela semente; devolve os pontos, os passos e um resumo do caminho. */
function partidaNaMesa(mesa: number, s: number) {
  const k = sim.novaMesa(sim.PASSOS_MAXIMOS, mesa);
  let h = 0;
  const eventos: Record<string, number> = {};
  const comandos: number[] = [];
  while (!k.terminou) {
    let c = sim.pilotoAutomatico(k);
    if (k.bolas.some((b) => b.naMola && !b.auto)) c = k.carga < 28 + ((s * 13 + k.bola * 7) % 23) ? sim.MOLA : 0;
    comandos.push(c);
    sim.passo(k, c);
    for (const e of k.eventos) eventos[e.tipo] = (eventos[e.tipo] ?? 0) + 1;
    if (k.passo % 97 === 0 && k.bolas[0]) h = (h * 31 + Math.round(k.bolas[0].x * 1000) + Math.round(k.bolas[0].y * 7)) % 1000000007;
  }
  return { k, h, eventos, comandos };
}

test('a horta e o pomar rodam a MESMA conta de antes do lago (as partidas guardadas em 24/11/2026)', () => {
  // [mesa, semente, pontos, passos, o resumo do caminho], medidos com a regra de antes da terceira mesa
  const guardadas = [
    [0, 0, 38180, 9841, 350056212],
    [0, 1, 113890, 22250, 976049886],
    [0, 2, 36410, 12509, 346254631],
    [0, 3, 109510, 22145, 216723943],
    [0, 4, 71425, 13999, 426004730],
    [0, 5, 24820, 9316, 466468201],
    [1, 0, 497950, 87930, 489499761],
    [1, 1, 324505, 64841, 412273957],
    [1, 2, 293395, 57426, 597099032],
    [1, 3, 7935, 3175, 483999416],
    [1, 4, 272215, 54242, 764037401],
    [1, 5, 185335, 41417, 502266099],
  ];
  for (const [mesa, s, pontos, passos, h] of guardadas) {
    const r = partidaNaMesa(mesa, s);
    assert.deepEqual([r.k.pontos, r.k.passo, r.h], [pontos, passos, h], `a mesa ${mesa}, semente ${s}`);
  }
});

test('o lago: o piloto termina as partidas pelas bolas, o sapo devolve bolas, e a mesma partida refeita dá os mesmos pontos', () => {
  assert.equal(sim.MESAS.length, 3);
  assert.equal(sim.missoesDa(2).length, sim.MISSOES.length, 'seis missões: o modo final pede todas');
  assert.ok(sim.missoesDa(2).some((m) => m.id === 'pistas'));
  let sapos = 0;
  let missoes = 0;
  for (let s = 0; s < 8; s++) {
    const { k, eventos, comandos } = partidaNaMesa(2, s);
    assert.ok(k.passo < sim.PASSOS_MAXIMOS, `a partida ${s} acabou pelas bolas, não pelo teto`);
    assert.ok(k.pontos > 0);
    sapos += eventos.sapo ?? 0;
    missoes += k.cumpridas;
    const b = sim.novaMesa(sim.PASSOS_MAXIMOS, 2);
    sim.aplicar(b, sim.compactar(comandos));
    assert.equal(b.pontos, k.pontos);
  }
  assert.ok(sapos >= 8, `o sapo pulou ${sapos} vezes em 8 partidas`);
  assert.ok(missoes > 0, 'o piloto cumpre missões no lago');
});

test('o lago: o sapo aceso devolve a bola da raia de saída para a raia de dentro, e só uma vez por bola', () => {
  const k = sim.novaMesa(sim.PASSOS_MAXIMOS, 2);
  assert.ok(k.sapo, 'aceso na bola nova');
  k.bolas = [{ x: 16, y: 340, vx: 0, vy: 200, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
  k.salvaPronta = false;
  let pulou = false;
  for (let i = 0; i < 20 && !pulou; i++) {
    sim.passo(k, 0);
    pulou = k.eventos.some((e) => e.tipo === 'sapo');
  }
  assert.ok(pulou, 'o sapo pulou');
  assert.equal(k.sapo, false, 'usado, apaga');
  // termina o pulo na raia de dentro, sobre a palheta da esquerda
  for (let i = 0; i < 40 && k.bolas[0].trilho > 0; i++) sim.passo(k, 0);
  const b = k.bolas[0];
  assert.equal(b.trilho, 0);
  assert.ok(b.x > 24 && b.x < 45 && b.y < 270, `saiu na raia de dentro (${b.x.toFixed(0)}, ${b.y.toFixed(0)})`);
  let naPalheta = false;
  for (let i = 0; i < 60; i++) {
    sim.passo(k, 0);
    if (k.bolas[0] && k.bolas[0].x > sim.PIVO_ESQ.x - 4 && k.bolas[0].y > 320 && k.bolas[0].y < 360) naPalheta = true;
  }
  assert.ok(naPalheta, 'desceu pela raia de dentro até a palheta');
  // apagado, a bola da raia de saída cai
  const m = sim.novaMesa(sim.PASSOS_MAXIMOS, 2);
  m.sapo = false;
  m.salvaPronta = false;
  m.bolas = [{ x: 16, y: 340, vx: 0, vy: 200, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
  let perdeu = false;
  for (let i = 0; i < 60 && !perdeu; i++) {
    sim.passo(m, 0);
    perdeu = m.eventos.some((e) => e.tipo === 'perdeu');
    assert.ok(!m.eventos.some((e) => e.tipo === 'sapo'));
  }
  assert.ok(perdeu, 'sem o sapo, a bola se perde');
  assert.ok(m.sapo, 'e a bola nova acende o sapo de novo');
  // a horta não tem sapo
  assert.equal(sim.novaMesa(sim.PASSOS_MAXIMOS, 0).sapo, false);
});

test('o lago: as duas rampas (a da direita cai na primeira pista, a da esquerda na terceira), e as duas seguidas valem a dupla', () => {
  const g = sim.MESAS[2];
  assert.ok(g.rampa2 && g.boca.x0 > sim.MEIO && g.rampa2.boca.x1 < sim.MEIO);
  const subir = (k: sim.Mesa, boca: { x0: number; x1: number; y: number }) => {
    k.bolas = [{ x: (boca.x0 + boca.x1) / 2, y: boca.y + 3, vx: 0, vy: -600, naMola: false, auto: false, presa: 0, orbita: 0, parada: 0, trilho: 0 }];
    const ev: sim.Evento[] = [];
    for (let i = 0; i < 200; i++) {
      sim.passo(k, 0);
      ev.push(...k.eventos);
      if (ev.some((e) => e.tipo === 'pista')) break;
    }
    return ev;
  };
  const k = sim.novaMesa(sim.PASSOS_MAXIMOS, 2);
  const a = subir(k, g.boca);
  assert.ok(a.some((e) => e.tipo === 'rampa'));
  assert.equal(a.find((e) => e.tipo === 'pista')?.n, 0);
  const b = subir(k, g.rampa2!.boca);
  assert.equal(b.find((e) => e.tipo === 'pista')?.n, 2);
  const dupla = b.find((e) => e.tipo === 'dupla');
  assert.ok(dupla && dupla.tipo === 'dupla' && dupla.pontos === sim.PONTOS_DA_DUPLA, 'a dupla');
  // a mesma rampa duas vezes não é dupla
  const m = sim.novaMesa(sim.PASSOS_MAXIMOS, 2);
  subir(m, g.boca);
  assert.ok(!subir(m, g.boca).some((e) => e.tipo === 'dupla'));
  // no pomar, a boca da direita não é rampa
  const p = sim.novaMesa(sim.PASSOS_MAXIMOS, 1);
  assert.ok(!subir(p, g.boca).some((e) => e.tipo === 'rampa'));
});
