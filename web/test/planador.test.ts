import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sim from '../src/planador/sim.ts';

/** O Planador da toca: a regra (planador/sim.ts), que é a mesma do servidor, e o piloto automático. */

const voar = (d: sim.Desafio, piloto: (v: sim.Voo) => number) => {
  const v = sim.novoVoo(d);
  const g = sim.gravador();
  while (!v.fim) {
    const c = piloto(v);
    g.anotar(c);
    sim.passo(v, c);
  }
  return { v, entradas: g.entradas };
};

test('a regra é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/planador/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/planador-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'mexeu num, copie no outro');
});

test('dentro do voo, nada de seno, cosseno, sorteio nem relógio', () => {
  const texto = readFileSync(new URL('../src/planador/sim.ts', import.meta.url), 'utf8');
  for (const proibido of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Date.now', 'performance.now', 'Math.pow']) {
    assert.ok(!texto.includes(proibido), proibido);
  }
});

for (const d of sim.DESAFIOS) {
  test(`${d.id}: o piloto automático passa por todos os anéis e pousa de leve no alvo`, () => {
    const { v } = voar(d, sim.pilotoAutomatico);
    const r = v.fim!;
    assert.equal(r.como, 'pousou', JSON.stringify(r));
    assert.equal(r.aneis, d.aneis.length, 'todos os anéis');
    assert.ok(r.precisao >= 25, `perto do alvo: ${r.distancia} m`);
    assert.ok(r.suavidade > 0, 'de leve');
    assert.equal(r.total, r.pontosAneis + r.precisao + r.suavidade + r.bonus);
  });

  test(`${d.id}: refazer os mesmos comandos dá os mesmos pontos (o fantasma e o servidor)`, () => {
    const { v, entradas } = voar(d, sim.pilotoAutomatico);
    assert.ok(sim.entradasValidas(entradas, d));
    assert.deepEqual(sim.refazer(d, entradas).fim, v.fim);
    const ler = sim.leitor(entradas);
    const f = sim.novoVoo(d);
    while (!f.fim) sim.passo(f, ler());
    assert.deepEqual(f.fim, v.fim);
  });
}

test('a asa mergulhando até o chão bate: só os anéis valem', () => {
  const d = sim.desafioPorId('asa-1')!;
  const { v } = voar(d, () => sim.CIMA);
  assert.equal(v.fim!.como, 'batida');
  assert.equal(v.fim!.total, v.fim!.pontosAneis);
});

test('o salto sem abrir o paraquedas é batida', () => {
  const { v } = voar(sim.desafioPorId('queda-1')!, () => 0);
  assert.equal(v.fim!.como, 'batida');
});

test('a mochila: o combustível acaba, e quem não decola não pousa (o tempo acaba)', () => {
  const d = sim.desafioPorId('mochila-1')!;
  const parado = voar(d, () => 0).v;
  assert.equal(parado.fim!.como, 'tempo');
  assert.equal(parado.h, 0);
  const v = sim.novoVoo(d);
  while (!v.fim && v.combustivel > 0) sim.passo(v, sim.BOTAO | sim.CIMA);
  assert.equal(v.combustivel, 0);
  sim.passo(v, sim.BOTAO);
  assert.equal(v.jato, 0, 'sem combustível, o jato não acende');
  const pulo = sim.novoVoo(d);
  for (let i = 0; i < 180; i++) sim.passo(pulo, sim.BOTAO);
  while (!pulo.fim) sim.passo(pulo, 0);
  assert.equal(pulo.fim!.como, 'batida', 'subiu, soltou o jato e caiu');
});

test('entradas inválidas', () => {
  const d = sim.DESAFIOS[0];
  assert.ok(!sim.entradasValidas([], d));
  assert.ok(!sim.entradasValidas([1, 32], d));
  assert.ok(!sim.entradasValidas([0, 1], d));
  assert.ok(!sim.entradasValidas([1.5, 1], d));
  assert.ok(!sim.entradasValidas([d.passosMaximos + 1, 0], d));
  assert.ok(sim.entradasValidas([10, 31, 5, 0], d));
});

// ---------------------------------------------------------------------------------------------------------------------
// 19/11/2026: mais desafios por veículo, o vento, as térmicas e as medalhas
// ---------------------------------------------------------------------------------------------------------------------

test('3 a 5 desafios por veículo, em escala (o nível sobe), com ids diferentes', () => {
  for (const tipo of ['asa', 'mochila', 'queda'] as const) {
    const lista = sim.DESAFIOS.filter((d) => d.tipo === tipo);
    assert.ok(lista.length >= 3 && lista.length <= 5, tipo);
    assert.deepEqual(lista.map((d) => d.nivel), lista.map((_, i) => i + 1), `${tipo}: os níveis em ordem`);
  }
  assert.equal(new Set(sim.DESAFIOS.map((d) => d.id)).size, sim.DESAFIOS.length);
  // os três de antes continuam sem vento e sem térmica (o recorde deles continua valendo)
  for (const id of ['asa-1', 'mochila-1', 'queda-1']) {
    const d = sim.desafioPorId(id)!;
    assert.deepEqual(d.vento, [0, 0]);
    assert.equal(d.termicas.length, 0);
  }
});

test('a térmica levanta a asa, e o vento a leva de lado (as mesmas contas, só + − × ÷)', () => {
  const d = sim.desafioPorId('asa-2')!;
  const t = d.termicas[0];
  const dentro = sim.novoVoo(d);
  Object.assign(dentro, { x: t.x, y: t.y + 40, hx: 0, hy: -1 });
  const fora = sim.novoVoo({ ...d, termicas: [] });
  Object.assign(fora, { x: t.x, y: t.y + 40, hx: 0, hy: -1 });
  for (let i = 0; i < 300; i++) {
    sim.passo(dentro, 0);
    sim.passo(fora, 0);
  }
  assert.ok(dentro.h > fora.h + 3, `${dentro.h} contra ${fora.h}`);
  assert.equal(sim.subidaEm(d, t.x + t.raio + 1, t.y), 0);
  const ventoso = sim.desafioPorId('queda-2')!;
  const a = sim.novoVoo(ventoso);
  const b = sim.novoVoo({ ...ventoso, vento: [0, 0] });
  for (let i = 0; i < 120; i++) {
    sim.passo(a, 0);
    sim.passo(b, 0);
  }
  assert.ok(Math.abs(a.x - b.x - ventoso.vento[0] * 2) < 0.01, 'em 2 s, o vento leva o salto 2 s de vento');
});

test('as medalhas: bronze, prata e ouro pela fração dos pontos máximos; o piloto honesto ganha ao menos o bronze em todos', () => {
  for (const d of sim.DESAFIOS) {
    const [b, p, o] = sim.limitesDasMedalhas(d);
    assert.ok(b < p && p < o && o <= sim.pontosMaximos(d));
    assert.equal(sim.medalha(d, b - 1), 0);
    assert.equal(sim.medalha(d, b), 1);
    assert.equal(sim.medalha(d, p), 2);
    assert.equal(sim.medalha(d, o), 3);
    const { v } = voar(d, sim.pilotoAutomatico);
    assert.ok(sim.medalha(d, v.fim!.total) >= 1, `${d.id}: ${v.fim!.total}`);
  }
});

// ---------------- A segunda auditoria (20/11/2026): o anel do pouso (só desenho) ----------------

test('o anel do pouso tem a cor do pouso que sairia: o piloto pousa no verde ou no amarelo, e o salto sem paraquedas é vermelho', async () => {
  const { corDoPouso, chaoDebaixo } = await import('../src/planador/render.ts');
  for (const d of sim.DESAFIOS) {
    const v = sim.novoVoo(d);
    let ultima: string | null = null;
    while (!v.fim) {
      const c = sim.pilotoAutomatico(v);
      const antes = { ...v };
      sim.passo(v, c);
      if (!v.fim) ultima = v.h - chaoDebaixo(v) < 30 ? corDoPouso(v) : ultima;
      else if (v.fim.como === 'pousou') {
        // o passo do toque: a cor do passo de antes, para o pouso bom, não é vermelha
        assert.notEqual(corDoPouso(antes as sim.Voo), 'vermelho', `${d.id}: o anel estava vermelho e o pouso foi bom`);
      }
    }
    if (v.fim?.como === 'batida') assert.equal(ultima, 'vermelho', `${d.id}: bateu sem o anel avisar`);
  }
  // no salto, com o paraquedas fechado, sempre vermelho
  const q = sim.novoVoo(sim.DESAFIOS.find((d) => d.tipo === 'queda')!);
  assert.equal(corDoPouso(q), 'vermelho');
});
