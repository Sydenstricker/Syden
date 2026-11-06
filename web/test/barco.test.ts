/**
 * A Regata da toca (web/src/barco/): as medidas das pistas iguais às do servidor, o piloto automático fechando as voltas com
 * o fantasma aceito pelo servidor, e o que faz ser barco (a inércia, a derrapagem, a margem que segura, a correnteza, a boia).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMOSTRA, amostrar, novoBarco, passo, pilotoAutomatico, progresso, rapidez, TEMPO_DO_TURBO, VCRUZEIRO, type ComandosDoBarco } from '../src/barco/fisica';
import { aguaEm, marcosDoBarco, montarPistaDoBarco, naLinha, PISTAS_DO_BARCO, pontoNaLinha, type PistaDoBarco } from '../src/barco/pista';
import { PASSO_MAXIMO, PISTAS_DO_BARCO as NO_SERVIDOR, validarBarco, VOLTA_MINIMA } from '../../server/src/barco.ts';

const pistas = new Map(PISTAS_DO_BARCO.map((def) => [def.id, montarPistaDoBarco(def)]));
const nada: ComandosDoBarco = { acelera: false, freia: false, vira: 0 };

function pilotar(p: PistaDoBarco) {
  const b = novoBarco(p);
  const caminho: number[] = [];
  let maiorSalto = 0;
  while (!b.terminou && b.passos < 60 * 60 * 5) {
    passo(b, pilotoAutomatico(b, p), p);
    amostrar(b, caminho);
  }
  for (let i = 3; i < caminho.length; i += 3) maiorSalto = Math.max(maiorSalto, Math.hypot(caminho[i] - caminho[i - 3], caminho[i + 1] - caminho[i - 2]));
  return { b, caminho, maiorSalto };
}

test('as medidas de cada pista são as do servidor, e a pista não passa perto dela mesma', () => {
  for (const def of PISTAS_DO_BARCO) {
    const p = pistas.get(def.id)!;
    const s = NO_SERVIDOR[def.id];
    assert.ok(s, `${def.id} existe no servidor`);
    assert.ok(Math.abs(s.comprimento - p.comprimento) < 2, `${def.id}: comprimento ${s.comprimento} contra ${p.comprimento}`);
    assert.deepEqual(s.linha, [Math.round(p.lx[0]), Math.round(p.ly[0])], `${def.id}: a linha de chegada`);
    assert.ok(Math.hypot(s.largada[0] - p.largada.x, s.largada[1] - p.largada.y) < 0.2, `${def.id}: a largada`);
    assert.equal(s.voltas, def.voltas);
    assert.equal(s.meiaLargura, def.meiaLargura);
    marcosDoBarco(def, s.marcos.length).forEach(([x, y], i) => {
      assert.ok(Math.hypot(s.marcos[i][0] - x, s.marcos[i][1] - y) < 1.5, `${def.id}: o marco ${i}`);
    });
    const n = p.lx.length;
    for (let i = 0; i < n; i += 3) {
      for (let j = i + 40; j < n && n - j + i >= 40; j += 3) {
        assert.ok(Math.hypot(p.lx[i] - p.lx[j], p.ly[i] - p.ly[j]) > 2 * def.meiaLargura + 20, `${def.id}: trechos ${i} e ${j} encostam`);
      }
    }
    // a linha do meio inteira é água, e as argolas de turbo estão na água
    for (let i = 0; i < n; i += 5) assert.ok(aguaEm(p, p.lx[i], p.ly[i]) !== 0, `${def.id}: o meio da pista é água`);
    for (const a of p.argolas) assert.ok(aguaEm(p, a.x, a.y) !== 0, `${def.id}: a argola está na água`);
  }
});

test('em cada pista, o piloto automático fecha as voltas, e o fantasma passa na conferência do servidor', () => {
  for (const def of PISTAS_DO_BARCO) {
    const p = pistas.get(def.id)!;
    const { b, caminho, maiorSalto } = pilotar(p);
    assert.equal(b.terminou, true, `${def.id}: não terminou`);
    assert.equal(b.voltas.length, def.voltas);
    const passos = b.voltas[def.voltas - 1];
    assert.equal(caminho.length, 3 * (Math.floor((passos - 1) / AMOSTRA) + 1), 'uma amostra a cada 4 passos, até a chegada');
    for (let i = 0; i < def.voltas; i++) assert.ok(b.voltas[i] - (i ? b.voltas[i - 1] : 0) >= VOLTA_MINIMA, `${def.id}: volta mais curta que o mínimo`);
    assert.ok(maiorSalto <= PASSO_MAXIMO * 0.75, `${def.id}: salto de ${maiorSalto}`);
    const v = validarBarco(def.id, { voltas: b.voltas, amostras: caminho });
    assert.ok('ok' in v, `${def.id}: o servidor recusou a corrida honesta`);
    console.log(def.id, 'piloto automático:', (passos / 60).toFixed(2), 's; maior salto', maiorSalto.toFixed(0));
  }
});

test('o mesmo piloto dá sempre o mesmo tempo (o tempo é de passos, não do relógio)', () => {
  const p = pistas.get('riacho-1')!;
  assert.equal(pilotar(p).b.voltas.at(-1), pilotar(p).b.voltas.at(-1));
});

test('a água tem inércia: sem motor o barco continua deslizando, e a curva rápida derrapa', () => {
  const p = pistas.get('lago-1')!;
  // o piloto automático só segura o leme (para não ir de encontro à margem); o motor é do teste
  const leme = (b: ReturnType<typeof novoBarco>) => pilotoAutomatico(b, p).vira;
  const b = novoBarco(p);
  for (let i = 0; i < 180; i++) passo(b, { ...nada, acelera: true, vira: leme(b) }, p);
  const cruzeiro = rapidez(b);
  assert.ok(cruzeiro > VCRUZEIRO * 0.85, `chegou perto do cruzeiro (${cruzeiro.toFixed(0)})`);
  // solta o acelerador: meio segundo depois, ainda anda mais da metade
  for (let i = 0; i < 30; i++) passo(b, { ...nada, vira: leme(b) }, p);
  assert.ok(rapidez(b) > cruzeiro * 0.5, 'desliza');
  // a toda, virando de uma vez: a velocidade fica para trás do nariz (derrapa de lado)
  const c = novoBarco(p);
  for (let i = 0; i < 180; i++) passo(c, { ...nada, acelera: true, vira: leme(c) }, p);
  let maiorLado = 0;
  for (let i = 0; i < 25; i++) {
    passo(c, { ...nada, acelera: true, vira: 1 }, p);
    maiorLado = Math.max(maiorLado, Math.abs(c.lateral));
  }
  assert.ok(maiorLado > 40, `derrapou (${maiorLado.toFixed(0)} de lado)`);
});

test('a margem segura o barco, freia e empurra de volta', () => {
  for (const def of PISTAS_DO_BARCO) {
    const p = pistas.get(def.id)!;
    const b = novoBarco(p);
    let bateu = 0;
    for (let i = 0; i < 3000; i++) {
      passo(b, { ...nada, acelera: true, vira: i % 140 < 70 ? 1 : -0.3 }, p);
      if (b.bateu) bateu++;
      const l = naLinha(p, b.x, b.y, b.indice);
      assert.ok(Math.abs(l.lado) <= def.meiaLargura + 1, `${def.id}: o barco não sai da água`);
    }
    assert.ok(bateu > 0, `${def.id}: bateu na margem`);
  }
  // de frente contra a margem, a toda: a velocidade que ia para fora volta para dentro
  const p = pistas.get('lago-1')!;
  const q = pontoNaLinha(p, 400);
  const b = novoBarco(p);
  const nx = -q.dy, ny = q.dx;
  Object.assign(b, { x: q.x, y: q.y, indice: q.indice, angulo: Math.atan2(ny, nx), vx: nx * 160, vy: ny * 160 });
  let bateu = false;
  for (let i = 0; i < 40 && !bateu; i++) {
    passo(b, nada, p);
    bateu = b.bateu;
  }
  assert.ok(bateu, 'bateu');
  assert.ok(b.vx * nx + b.vy * ny < 0, 'a margem empurrou de volta');
  assert.ok(rapidez(b) < 100, 'e freou');
});

test('a correnteza leva o barco parado; a argola de turbo dá o empurrão', () => {
  const p = pistas.get('riacho-1')!;
  const [a, z, forca] = p.def.correntezas[0];
  const q = pontoNaLinha(p, ((a + z) / 2) * p.comprimento);
  const b = novoBarco(p);
  Object.assign(b, { x: q.x, y: q.y, indice: q.indice, angulo: Math.atan2(q.dy, q.dx) });
  for (let i = 0; i < 60; i++) passo(b, nada, p);
  const andou = (b.x - q.x) * q.dx + (b.y - q.y) * q.dy;
  assert.ok(forca > 0 && andou > forca * 0.4, `a favor da corrida, andou ${andou.toFixed(0)} sem motor`);
  const argola = p.argolas[0];
  const c = novoBarco(p);
  const antes = pontoNaLinha(p, p.def.boias[0][0] * p.comprimento - 20);
  Object.assign(c, { x: argola.x - Math.cos(argola.angulo) * 20, y: argola.y - Math.sin(argola.angulo) * 20, angulo: argola.angulo, indice: antes.indice });
  c.vx = Math.cos(argola.angulo) * 120;
  c.vy = Math.sin(argola.angulo) * 120;
  let pegou = false;
  for (let i = 0; i < 30; i++) {
    passo(c, { ...nada, acelera: true }, p);
    if (c.boia) pegou = true;
  }
  assert.ok(pegou && c.turbo > 0 && c.turbo <= TEMPO_DO_TURBO, 'passou pela argola e ganhou o turbo');
});

test('na sala, toda posição do piloto automático honesto passa na conferência do servidor', async () => {
  const { criarBarco } = await import('../../server/src/minijogo-barco.ts');
  for (const def of PISTAS_DO_BARCO) {
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
    const jogo = criarBarco(() => agora).comecar(ctx, { naSala: [1, 2], criadaPor: 1, corpo: { pista: def.id } });
    assert.ok(typeof jogo !== 'string');
    relogio[0]();
    agora += 500;
    const p = pistas.get(def.id)!;
    const b = novoBarco(p);
    let recusadas = 0, mandadas = 0;
    while (!b.terminou && b.passos < 60 * 60 * 5) {
      passo(b, pilotoAutomatico(b, p), p);
      agora += 1000 / 60;
      if (!b.terminou && (b.passos - 1) % AMOSTRA === 0) {
        mandadas++;
        const pos = { n: b.passos, x: +b.x.toFixed(1), y: +b.y.toFixed(1), a: +b.angulo.toFixed(3), andou: +progresso(b, p).toFixed(3), b: 0, v: 100 };
        if (jogo.tempoReal!(1, pos) === null) recusadas++;
      }
    }
    assert.equal(recusadas, 0, `${def.id}: ${recusadas} de ${mandadas} posições recusadas`);
  }
});
