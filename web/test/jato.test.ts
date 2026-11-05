import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMOSTRA, amostrar, CUSTO_DO_TURBO, ENERGIA_MAXIMA, novaNave, passo, pilotoAutomatico, progresso, turboLiberado, type ComandosDoJato } from '../src/jato/fisica';
import { marcosDoJato, montarPistaDoJato, naLinha, PISTAS_DO_JATO, pontoNaLinha, type PistaDoJato } from '../src/jato/pista';
import { criarRobos, roboEm } from '../src/jato/robos';
import { PASSO_MAXIMO, PISTAS_DO_JATO as NO_SERVIDOR, validarJato, VOLTA_MINIMA } from '../../server/src/jato.ts';

const pistas = new Map(PISTAS_DO_JATO.map((def) => [def.id, montarPistaDoJato(def)]));

function pilotar(p: PistaDoJato) {
  const n = novaNave(p);
  const caminho: number[] = [];
  let maiorSalto = 0;
  while (!n.terminou && !n.explodiu && n.passos < 60 * 60 * 4) {
    passo(n, pilotoAutomatico(n, p), p);
    amostrar(n, caminho);
  }
  for (let i = 3; i < caminho.length; i += 3) maiorSalto = Math.max(maiorSalto, Math.hypot(caminho[i] - caminho[i - 3], caminho[i + 1] - caminho[i - 2]));
  return { n, caminho, maiorSalto };
}

const nada: ComandosDoJato = { acelera: false, freia: false, vira: 0, turbo: false, freioDeAr: false };

test('as medidas de cada pista são as do servidor, e a pista não passa perto dela mesma', () => {
  for (const def of PISTAS_DO_JATO) {
    const p = pistas.get(def.id)!;
    const s = NO_SERVIDOR[def.id];
    assert.ok(s, `${def.id} existe no servidor`);
    assert.ok(Math.abs(s.comprimento - p.comprimento) < 2, `${def.id}: comprimento ${s.comprimento} contra ${p.comprimento}`);
    assert.deepEqual(s.linha, [Math.round(p.lx[0]), Math.round(p.ly[0])], `${def.id}: a linha de chegada`);
    assert.ok(Math.hypot(s.largada[0] - p.largada.x, s.largada[1] - p.largada.y) < 0.2, `${def.id}: a largada`);
    assert.equal(s.voltas, def.voltas);
    assert.ok(def.voltas >= 3 && def.voltas <= 5);
    assert.equal(s.meiaLargura, def.meiaLargura);
    marcosDoJato(def, s.marcos.length).forEach(([x, y], i) => {
      assert.ok(Math.hypot(s.marcos[i][0] - x, s.marcos[i][1] - y) < 1.5, `${def.id}: o marco ${i}`);
    });
    const n = p.lx.length;
    for (let i = 0; i < n; i += 3) {
      for (let j = i + 40; j < n && n - j + i >= 40; j += 3) {
        assert.ok(Math.hypot(p.lx[i] - p.lx[j], p.ly[i] - p.ly[j]) > 2 * def.meiaLargura + 20, `${def.id}: trechos ${i} e ${j} encostam`);
      }
    }
  }
});

test('em cada pista, o piloto automático fecha as voltas sem explodir, e o fantasma passa na conferência do servidor', () => {
  for (const def of PISTAS_DO_JATO) {
    const p = pistas.get(def.id)!;
    const { n, caminho, maiorSalto } = pilotar(p);
    assert.equal(n.terminou, true, `${def.id}: não terminou`);
    assert.equal(n.voltas.length, def.voltas);
    const passos = n.voltas[def.voltas - 1];
    assert.equal(caminho.length, 3 * (Math.floor((passos - 1) / AMOSTRA) + 1), 'uma amostra a cada 4 passos, até a chegada');
    for (let i = 0; i < def.voltas; i++) assert.ok(n.voltas[i] - (i ? n.voltas[i - 1] : 0) >= VOLTA_MINIMA, `${def.id}: volta mais curta que o mínimo`);
    assert.ok(maiorSalto <= PASSO_MAXIMO, `${def.id}: salto de ${maiorSalto}`);
    const v = validarJato(def.id, { voltas: n.voltas, amostras: caminho });
    assert.ok('ok' in v, `${def.id}: o servidor recusou a corrida honesta`);
    console.log(def.id, 'piloto automático:', (passos / 60).toFixed(2), 's; maior salto', maiorSalto.toFixed(0));
  }
});

test('o mesmo piloto dá sempre o mesmo tempo (o tempo é de passos, não do relógio)', () => {
  const p = pistas.get('cidade-1')!;
  assert.equal(pilotar(p).n.voltas.at(-1), pilotar(p).n.voltas.at(-1));
});

test('a borda de energia segura a nave e cobra energia; sem energia, a nave explode', () => {
  const p = pistas.get('cidade-1')!;
  const n = novaNave(p);
  for (let i = 0; i < 60; i++) passo(n, { ...nada, acelera: true }, p);
  for (let i = 0; i < 2000 && !n.explodiu; i++) {
    passo(n, { ...nada, acelera: true, vira: i % 90 < 45 ? 1 : -1 }, p);
    const l = naLinha(p, n.x, n.y, n.indice);
    assert.ok(Math.abs(l.lado) <= p.def.meiaLargura + 1 || l.aberto || n.caindo > 0 || n.resgate > 0, 'a nave não atravessa a borda');
  }
  assert.ok(n.energia < ENERGIA_MAXIMA, 'bater gastou energia');
  const m = novaNave(p);
  m.energia = 1;
  for (let i = 0; i < 600 && !m.explodiu; i++) passo(m, { ...nada, acelera: true, vira: 1 }, p);
  assert.equal(m.explodiu, true, 'com 1 de energia, a primeira batida explode a nave');
  const v = m.passos;
  passo(m, { ...nada, acelera: true }, p);
  assert.equal(m.passos, v, 'explodida, a nave não anda mais');
});

test('num trecho aberto, quem sai da pista cai e o trilho a devolve ao meio, com perda de tempo', () => {
  const p = pistas.get('cidade-1')!;
  const [a] = p.def.abertos[0];
  const q = pontoNaLinha(p, a * p.comprimento + 20);
  const n = novaNave(p);
  Object.assign(n, { x: q.x, y: q.y, angulo: Math.atan2(q.dy, q.dx) + 1.2, v: 200, indice: q.indice, seguro: a * p.comprimento });
  n.rumo = n.angulo;
  let caiu = false;
  let passos = 0;
  for (let i = 0; i < 240; i++) {
    passo(n, { ...nada, acelera: true }, p);
    passos++;
    if (n.caindo > 0) caiu = true;
    if (caiu && n.caindo === 0 && n.resgate === 0) break;
  }
  assert.ok(caiu, 'caiu');
  const l = naLinha(p, n.x, n.y, n.indice);
  assert.ok(Math.abs(l.lado) < 2, `voltou ao meio da pista (lado ${l.lado.toFixed(1)})`);
  assert.ok(n.v < 100, 'e recomeça devagar');
  assert.ok(passos > 60, 'depois de mais de um segundo');
  assert.equal(n.explodiu, false);
});

test('uma corrida com queda (o resgate pelo trilho) continua valendo no servidor, ao vivo e na chegada', async () => {
  const { criarJato } = await import('../../server/src/minijogo-jato.ts');
  const p = pistas.get('orbita-1')!;
  let agora = 1_000_000;
  const relogio: (() => void)[] = [];
  const ctx = { agendar: (_ms: number, d: () => void) => relogio.splice(0, 1, d), avisar: () => {}, terminar: () => {}, naSala: () => [1, 2], nome: () => 'x', comunidade: 0 };
  const jogo = criarJato(() => agora).comecar(ctx, { naSala: [1, 2], criadaPor: 1, corpo: { pista: p.def.id } });
  assert.ok(typeof jogo !== 'string');
  relogio[0]();
  const n = novaNave(p);
  const caminho: number[] = [];
  let quedas = 0, recusadas = 0;
  const [a, b] = p.def.abertos[0];
  while (!n.terminou && n.passos < 60 * 60 * 4) {
    const f = p.la[n.indice] / p.comprimento;
    // no primeiro trecho aberto da segunda volta, vira para fora de propósito
    const c = n.volta === 1 && f > a && f < b && quedas === 0 ? { ...nada, acelera: true, vira: 1 } : pilotoAutomatico(n, p);
    const antes = n.caindo;
    passo(n, c, p);
    if (n.caindo > 0 && antes === 0) quedas++;
    amostrar(n, caminho);
    agora += 1000 / 60;
    if (!n.terminou && (n.passos - 1) % AMOSTRA === 0) {
      const pos = { n: n.passos, x: +n.x.toFixed(1), y: +n.y.toFixed(1), a: +n.angulo.toFixed(3), andou: +progresso(n, p).toFixed(3) };
      if (jogo.tempoReal!(1, pos) === null) recusadas++;
    }
  }
  assert.equal(quedas, 1, 'caiu uma vez');
  assert.equal(n.terminou, true);
  assert.equal(recusadas, 0, 'nenhuma posição recusada');
  assert.ok('ok' in validarJato(p.def.id, { voltas: n.voltas, amostras: caminho }), 'e a chegada vale');
});

test('o turbo só da segunda volta em diante, e custa energia; a recarga devolve', () => {
  const p = pistas.get('nuvens-1')!;
  const n = novaNave(p);
  for (let i = 0; i < 30; i++) passo(n, { ...nada, acelera: true, turbo: i % 2 === 0 }, p);
  assert.equal(n.energia, ENERGIA_MAXIMA, 'na primeira volta, o botão não faz nada');
  n.volta = 1;
  assert.equal(turboLiberado(n), true);
  passo(n, { ...nada, acelera: true, turbo: false }, p);
  passo(n, { ...nada, acelera: true, turbo: true }, p);
  assert.equal(n.usouTurbo, true);
  assert.ok(Math.abs(n.energia - (ENERGIA_MAXIMA - CUSTO_DO_TURBO)) < 0.01);
  const [ra, rb] = p.def.recargas[0];
  const q = pontoNaLinha(p, ((ra + rb) / 2) * p.comprimento);
  const m = novaNave(p);
  Object.assign(m, { x: q.x, y: q.y, angulo: Math.atan2(q.dy, q.dx), v: 60, indice: q.indice, energia: 50 });
  m.rumo = m.angulo;
  passo(m, { ...nada, acelera: true }, p);
  assert.ok(m.recarga && m.energia > 50, 'na faixa de recarga, a energia volta');
});

test('as naves do computador: o mesmo caminho em todo computador, todas chegam, e o piloto automático ganha da maioria', () => {
  for (const def of PISTAS_DO_JATO) {
    const p = pistas.get(def.id)!;
    const robos = criarRobos(p, 11);
    const outra = criarRobos(p, 11);
    assert.deepEqual(robos.map((r) => r.chegada), outra.map((r) => r.chegada), `${def.id}: o caminho é o mesmo`);
    assert.ok(robos.every((r) => r.chegada < 60 * 60 * 4), `${def.id}: todas chegam`);
    const meu = pilotar(p).n.voltas.at(-1)!;
    const atras = robos.filter((r) => r.chegada > meu).length;
    assert.ok(atras >= 8, `${def.id}: o piloto automático ganhou de ${atras} de 11`);
    // na largada, ficam na grade entre a nave de quem joga e a linha
    const minha = progresso(novaNave(p), p);
    for (const r of robos) {
      const q = roboEm(p, r, 0);
      assert.ok(q.andou < 0 && q.andou > minha - 0.001, `${def.id}: o robô ${r.i} na grade`);
    }
  }
});

test('na sala, toda posição do piloto automático honesto passa na conferência do servidor', async () => {
  const { criarJato } = await import('../../server/src/minijogo-jato.ts');
  for (const def of PISTAS_DO_JATO) {
    let agora = 1_000_000;
    const relogio: (() => void)[] = [];
    const ctx = {
      agendar: (_ms: number, depois: () => void) => relogio.splice(0, relogio.length, depois),
      avisar: () => {},
      terminar: () => {},
      naSala: () => [1, 2],
      nome: (id: number) => `p${id}`,
      comunidade: 0,
    };
    const jogo = criarJato(() => agora).comecar(ctx, { naSala: [1, 2], criadaPor: 1, corpo: { pista: def.id } });
    assert.ok(typeof jogo !== 'string');
    relogio[0]();
    agora += 500;
    const p = pistas.get(def.id)!;
    const n = novaNave(p);
    let recusadas = 0, mandadas = 0;
    while (!n.terminou && n.passos < 60 * 60 * 4) {
      passo(n, pilotoAutomatico(n, p), p);
      agora += 1000 / 60;
      if (!n.terminou && (n.passos - 1) % AMOSTRA === 0) {
        mandadas++;
        const pos = { n: n.passos, x: +n.x.toFixed(1), y: +n.y.toFixed(1), a: +n.angulo.toFixed(3), andou: +progresso(n, p).toFixed(3), b: 0, t: false };
        if (jogo.tempoReal!(1, pos) === null) recusadas++;
      }
    }
    assert.equal(recusadas, 0, `${def.id}: ${recusadas} de ${mandadas} posições recusadas`);
  }
});
