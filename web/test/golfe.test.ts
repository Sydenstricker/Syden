import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BURACOS,
  RAIO_BOLA,
  TACADAS_MAX,
  acabouOBuraco,
  bater,
  copiarBola,
  dentroDoPoligono,
  mapaDeDistancia,
  melhorTacada,
  movelEm,
  novaBola,
  pontosDoBuraco,
  rolarAteParar,
  tacadaInvalida,
} from '../src/golfe/fisica';

test('a física do minigolfe é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/golfe/fisica.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/golfe-fisica.ts', import.meta.url));
  assert.ok(
    site.equals(servidor),
    'web/src/golfe/fisica.ts e server/src/golfe-fisica.ts divergiram: o servidor simularia outra bola. Copie um no outro.',
  );
});

test('os seis buracos: a saída e o buraco dentro da mesa, e o piloto acerta todos dentro do limite', () => {
  assert.equal(BURACOS.length, 6);
  for (const [i, b] of BURACOS.entries()) {
    for (const [x, y] of [b.inicio, b.buraco]) {
      assert.ok(dentroDoPoligono(b.contorno, x, y), `buraco ${i + 1}: ponto fora da mesa`);
      assert.ok(!b.blocos.some((p) => dentroDoPoligono(p, x, y)), `buraco ${i + 1}: ponto dentro de uma ilha`);
    }
    const d = mapaDeDistancia(b);
    assert.ok(Number.isFinite(d(b.inicio[0], b.inicio[1])), `buraco ${i + 1}: não há caminho da saída ao buraco`);
    const bola = novaBola(b);
    while (!acabouOBuraco(bola)) {
      bater(bola, melhorTacada(b, bola, bola.passo + 20, d));
      rolarAteParar(b, bola);
    }
    assert.equal(bola.dentro, true, `buraco ${i + 1}: o piloto não acertou`);
    assert.ok(pontosDoBuraco(bola) <= b.par + 1, `buraco ${i + 1}: ${pontosDoBuraco(bola)} tacadas, par ${b.par}`);
  }
});

test('a mesma tacada dá sempre a mesma bola (o servidor refaz a conta e chega no mesmo lugar)', () => {
  for (const b of BURACOS) {
    const a = novaBola(b);
    const c = novaBola(b);
    for (const t of [
      { passo: 13, dx: 731, dy: -402 },
      { passo: 500, dx: -120, dy: 990 },
    ]) {
      if (tacadaInvalida(a, t)) continue;
      bater(a, t);
      rolarAteParar(b, a);
      // a outra ponta recebe a tacada pelo JSON (o -0 vira 0, os números voltam iguais)
      const pelaRede = JSON.parse(JSON.stringify(t));
      bater(c, pelaRede);
      rolarAteParar(b, c);
      assert.deepEqual(c, a);
    }
  }
});

test('as regras da tacada: só com a bola parada, a força dentro do limite, e nunca antes de onde ela parou', () => {
  const b = BURACOS[0];
  const bola = novaBola(b);
  assert.equal(tacadaInvalida(bola, { passo: 0, dx: 1001, dy: 0 }), 'forca');
  assert.equal(tacadaInvalida(bola, { passo: 0, dx: 5, dy: 5 }), 'forca');
  assert.equal(tacadaInvalida(bola, { passo: 0.5, dx: 500, dy: 0 }), 'numeros');
  bater(bola, { passo: 10, dx: 400, dy: 0 });
  assert.equal(tacadaInvalida(bola, { passo: 11, dx: 400, dy: 0 }), 'andando');
  rolarAteParar(b, bola);
  assert.equal(tacadaInvalida(bola, { passo: bola.passo - 1, dx: 400, dy: 0 }), 'cedo');
  assert.equal(tacadaInvalida(bola, { passo: bola.passo, dx: 400, dy: 0 }), null);
});

test('a água devolve a bola e conta uma tacada; seis tacadas sem acertar acabam o buraco com 7', () => {
  const lago = BURACOS.find((b) => b.tema === 'lago')!;
  const bola = novaBola(lago);
  bater(bola, { passo: 0, dx: 1000, dy: 0 });
  rolarAteParar(lago, bola);
  assert.deepEqual([bola.x, bola.y, bola.tacadas], [lago.inicio[0], lago.inicio[1], 2]);
  const b = BURACOS[0];
  const fraca = novaBola(b);
  for (let i = 0; i < TACADAS_MAX; i++) {
    bater(fraca, { passo: fraca.passo, dx: 0, dy: 35 });
    rolarAteParar(b, fraca);
  }
  assert.equal(acabouOBuraco(fraca), true);
  assert.equal(pontosDoBuraco(fraca), TACADAS_MAX + 1);
});

test('a porteira: a tábua anda pelo passo, e a bola nunca para no caminho dela', () => {
  const b = BURACOS.find((x) => x.movel)!;
  const m = b.movel!;
  assert.deepEqual(movelEm(m, 0), { x: m.x, y: m.y });
  assert.deepEqual(movelEm(m, m.periodo / 2), { x: m.x + m.dx, y: m.y + m.dy });
  // tacadas fracas em direção à tábua, em vários momentos dela: a bola para fora do caminho
  for (let passo = 0; passo < m.periodo; passo += 7) {
    for (const forca of [200, 300, 420]) {
      const bola = novaBola(b);
      bater(bola, { passo, dx: forca, dy: 0 });
      rolarAteParar(b, bola);
      const dentroDoCaminho = bola.x > m.x - RAIO_BOLA && bola.x < m.x + m.w + RAIO_BOLA && bola.y > m.y - RAIO_BOLA && bola.y < m.y + m.h + m.dy + RAIO_BOLA;
      assert.ok(!dentroDoCaminho, `passo ${passo}, força ${forca}: parou em ${bola.x}, ${bola.y}`);
      assert.ok(dentroDoPoligono(b.contorno, bola.x, bola.y));
    }
  }
});

test('copiarBola não divide nada com a original', () => {
  const a = novaBola(BURACOS[0]);
  const c = copiarBola(a);
  bater(c, { passo: 0, dx: 500, dy: 0 });
  assert.equal(a.tacadas, 0);
});
