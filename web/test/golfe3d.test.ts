import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BURACOS,
  CHAO,
  FORMAS,
  TACADAS_MAX,
  acabouOBuraco,
  bater,
  copiarBola,
  dentroDoPoligono,
  mapaDeDistancia,
  melhorTacada,
  montar,
  novaBola,
  paraOBuraco,
  pontosDoBuraco,
  relevo,
  rolarAteParar,
  tacadaInvalida,
  temChao,
} from '../src/golfe3d/fisica';

test('a física do minigolfe 3D é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/golfe3d/fisica.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/golfe3d-fisica.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/golfe3d/fisica.ts e server/src/golfe3d-fisica.ts divergiram: o servidor simularia outra bola. Copie um no outro.');
});

test('os buracos: um buraco cada, a saída no chão, e o piloto acerta todos em poucas tacadas', () => {
  assert.ok(BURACOS.length >= 6 && BURACOS.length <= 9);
  for (const [i, b] of BURACOS.entries()) {
    const nome = `buraco ${i + 1}`;
    assert.equal(b.casas.filter(([peca]) => FORMAS[peca].buraco).length, 1, `${nome}: um buraco só`);
    const casas = new Set(b.casas.map(([, x, z]) => `${x},${z}`));
    assert.equal(casas.size, b.casas.length, `${nome}: duas peças na mesma casa`);
    assert.ok(temChao(b, b.inicio[0], b.inicio[1]), `${nome}: a saída fora do chão`);
    const d = mapaDeDistancia(b);
    assert.ok(Number.isFinite(d(b.inicio[0], b.inicio[1])), `${nome}: não há caminho da saída ao buraco`);
    const bola = novaBola(b);
    while (!acabouOBuraco(bola)) {
      bater(bola, melhorTacada(b, bola, bola.passo + 20, d));
      rolarAteParar(b, bola);
    }
    assert.equal(bola.dentro, true, `${nome}: o piloto não acertou`);
    assert.ok(pontosDoBuraco(bola) <= b.par + 1, `${nome}: ${pontosDoBuraco(bola)} tacadas, par ${b.par}`);
  }
});

test('nas bordas abertas entre duas casas, o chão tem a mesma altura dos dois lados (nada de degrau escondido)', () => {
  for (const [i, b] of BURACOS.entries()) {
    const m = montar(b);
    for (const [, x, z] of b.casas) {
      for (const [ox, oz] of [
        [1, 0],
        [0, 1],
      ]) {
        if (!b.casas.some(([, x2, z2]) => x2 === x + ox && z2 === z + oz)) continue;
        // pontos ao longo da borda entre as duas casas, um pouco para cada lado
        for (let k = -0.35; k <= 0.35; k += 0.05) {
          const bx = x + ox * 0.5 + oz * k;
          const bz = z + oz * 0.5 + ox * k;
          const dentroDeParede = (px: number, pz: number) => m.paredes.some((p) => dentroDoPoligono(p, px, pz));
          const a = [bx - ox * 0.01, bz - oz * 0.01];
          const c = [bx + ox * 0.01, bz + oz * 0.01];
          if (dentroDeParede(a[0], a[1]) || dentroDeParede(c[0], c[1]) || !temChao(b, a[0], a[1]) || !temChao(b, c[0], c[1])) continue;
          const ha = relevo(b, a[0], a[1])[0];
          const hc = relevo(b, c[0], c[1])[0];
          assert.ok(Math.abs(ha - hc) < 0.01, `buraco ${i + 1}: degrau de ${(hc - ha).toFixed(3)} entre (${x},${z}) e (${x + ox},${z + oz}), em ${bx.toFixed(2)}, ${bz.toFixed(2)}`);
        }
      }
    }
  }
});

test('a borda da pista é fechada: nenhuma tacada sai pelo lado sem parede (só cai quem acha um buraco do chão)', () => {
  // de vários pontos de cada buraco, tacadas fortes em 16 direções: quem sai da pista sem passar por um fosso é parede faltando
  for (const [i, b] of BURACOS.entries()) {
    const m = montar(b);
    const temFosso = b.casas.some(([peca]) => FORMAS[peca].fossos.length > 0);
    if (temFosso) continue;
    for (const [, x, z] of b.casas) {
      if (m.paredes.some((p) => dentroDoPoligono(p, x, z))) continue;
      for (let k = 0; k < 16; k++) {
        const u = -1 + k / 8;
        const den = 1 + u * u;
        const bola = novaBola(b);
        bola.x = x;
        bola.z = z;
        const t = { passo: 0, dx: Math.round(((1 - u * u) / den) * 1000), dz: Math.round(((2 * u) / den) * 1000) };
        if (tacadaInvalida(bola, t)) continue;
        bater(bola, t);
        rolarAteParar(b, bola);
        assert.ok(bola.tacadas === 1, `buraco ${i + 1}: de (${x},${z}), a tacada ${t.dx},${t.dz} saiu da pista`);
      }
    }
  }
});

test('a rampa freia quem sobe e devolve quem não tem força', () => {
  const b = BURACOS.find((x) => x.casas.some(([peca]) => peca === 'rampa-media'))!;
  const [, cx, cz, giro, base] = b.casas.find(([peca]) => peca === 'rampa-media')!;
  // a altura sobe de uma ponta à outra
  const [bx0, bz0] = paraOBuraco(cx, cz, giro, 0, -0.45);
  const [bx1, bz1] = paraOBuraco(cx, cz, giro, 0, 0.45);
  assert.ok(relevo(b, bx1, bz1)[0] > relevo(b, bx0, bz0)[0] + 0.2);
  assert.ok(Math.abs(relevo(b, bx0, bz0)[0] - (CHAO + base + 0.0125)) < 1e-9);
  // uma tacada fraca rampa acima volta para baixo
  const bola = novaBola(b);
  bola.x = bx0;
  bola.z = bz0 - 0.3;
  bater(bola, { passo: 0, dx: 0, dz: 300 });
  rolarAteParar(b, bola);
  assert.ok(bola.z < bz0, `a bola ficou em ${bola.z}`);
});

test('a mesma tacada dá sempre a mesma bola (o servidor refaz a conta e chega no mesmo lugar)', () => {
  for (const b of BURACOS) {
    const a = novaBola(b);
    const c = novaBola(b);
    for (const t of [
      { passo: 13, dx: 402, dz: 731 },
      { passo: 900, dx: -990, dz: 120 },
    ]) {
      if (tacadaInvalida(a, t)) continue;
      bater(a, t);
      rolarAteParar(b, a);
      bater(c, JSON.parse(JSON.stringify(t)));
      rolarAteParar(b, c);
      assert.deepEqual(c, a);
    }
  }
});

test('as regras da tacada, e seis tacadas sem acertar acabam o buraco com 7', () => {
  const b = BURACOS[0];
  const bola = novaBola(b);
  assert.equal(tacadaInvalida(bola, { passo: 0, dx: 1001, dz: 0 }), 'forca');
  assert.equal(tacadaInvalida(bola, { passo: 0, dx: 5, dz: 5 }), 'forca');
  assert.equal(tacadaInvalida(bola, { passo: 0.5, dx: 0, dz: 500 }), 'numeros');
  bater(bola, { passo: 10, dx: 0, dz: 300 });
  assert.equal(tacadaInvalida(bola, { passo: 11, dx: 0, dz: 300 }), 'andando');
  rolarAteParar(b, bola);
  assert.equal(tacadaInvalida(bola, { passo: bola.passo - 1, dx: 0, dz: 300 }), 'cedo');
  const fraca = novaBola(b);
  for (let i = 0; i < TACADAS_MAX; i++) {
    bater(fraca, { passo: fraca.passo, dx: 0, dz: 35 });
    rolarAteParar(b, fraca);
  }
  assert.equal(acabouOBuraco(fraca), true);
  assert.equal(pontosDoBuraco(fraca), TACADAS_MAX + 1);
  const c = copiarBola(fraca);
  c.tacadas = 0;
  assert.equal(fraca.tacadas, TACADAS_MAX);
});
