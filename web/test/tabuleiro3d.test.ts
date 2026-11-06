import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASAS } from '../../server/src/minijogo-tabuleiro-da-turma';
import { ANEL, CASAS_DA_VOLTA, HORTA, lotesDaCidade, NUMERO_DE_CASAS, PRACA, RAIO_DA_CASA, TOCA } from '../src/tabuleiro3d/volta';

// O TABULEIRO DA TURMA EM 3D (tabuleiro3d/volta.ts): a forma da volta é só desenho, mas tem de ser a volta do servidor — as
// mesmas 30 casas, na mesma ordem, igualmente espaçadas — e a cidadezinha não pode ficar em cima dela.

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test('a volta tem as casas do servidor, igualmente espaçadas', () => {
  assert.equal(NUMERO_DE_CASAS, CASAS.length);
  assert.equal(CASAS_DA_VOLTA.length, CASAS.length);
  const passos = CASAS_DA_VOLTA.map((c, i) => dist(c, CASAS_DA_VOLTA[(i + 1) % NUMERO_DE_CASAS]));
  const medio = passos.reduce((s, x) => s + x, 0) / passos.length;
  for (const p of passos) assert.ok(Math.abs(p - medio) / medio < 0.05, `passo ${p} longe da média ${medio}`);
  // um disco não encosta no próximo
  assert.ok(Math.min(...passos) > RAIO_DA_CASA * 2.4);
});

test('nenhuma casa da volta encosta numa que não é vizinha (a volta não se cruza)', () => {
  for (let i = 0; i < NUMERO_DE_CASAS; i++)
    for (let j = i + 2; j < NUMERO_DE_CASAS; j++) {
      if (i === 0 && j === NUMERO_DE_CASAS - 1) continue;
      assert.ok(dist(CASAS_DA_VOLTA[i], CASAS_DA_VOLTA[j]) > RAIO_DA_CASA * 4, `casas ${i} e ${j} perto demais`);
    }
});

test('a largada fica no meio da frente, e o lado de fora aponta para fora', () => {
  const c0 = CASAS_DA_VOLTA[0];
  assert.ok(Math.abs(c0.x) < 0.01 && c0.z > 1);
  for (const c of CASAS_DA_VOLTA) {
    assert.ok(Math.abs(Math.hypot(...c.fora) - 1) < 1e-6);
    // fora da volta, um passo para fora fica mais longe do meio do que a casa (a volta é "convexa" o bastante em cada ponto)
    const fora = { x: c.x + c.fora[0] * 0.66, z: c.z + c.fora[1] * 0.66 };
    const vizinhaMaisPerto = Math.min(...CASAS_DA_VOLTA.filter((o) => o !== c).map((o) => dist(o, fora)));
    assert.ok(vizinhaMaisPerto > RAIO_DA_CASA + 0.15, 'a barraca da dourada ficaria em cima de outra casa');
  }
});

test('a cidade não fica em cima da volta, da rua, nem uma casa na outra', () => {
  const lotes = lotesDaCidade();
  assert.ok(lotes.length >= 30);
  for (const l of lotes) {
    for (const c of CASAS_DA_VOLTA) assert.ok(dist(l, c) > 2, `prédio em ${l.x},${l.z} em cima da volta`);
    // por fora do anel (contando a calçada)
    const qx = Math.abs(l.x) - (ANEL.rx - ANEL.canto);
    const qz = Math.abs(l.z) - (ANEL.rz - ANEL.canto);
    const doAnel = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - ANEL.canto;
    assert.ok(doAnel > ANEL.largura / 2 + 0.5, `prédio em ${l.x},${l.z} em cima da rua`);
  }
  for (let i = 0; i < lotes.length; i++) for (let j = i + 1; j < lotes.length; j++) assert.ok(dist(lotes[i], lotes[j]) > 1.45, 'dois prédios no mesmo lugar');
});

test('o miolo (horta, praça e toca) cabe dentro da volta, sem encostar nas casas', () => {
  for (const c of CASAS_DA_VOLTA) {
    const dx = Math.max(HORTA.x0 - c.x, 0, c.x - HORTA.x1);
    const dz = Math.max(HORTA.z0 - c.z, 0, c.z - HORTA.z1);
    assert.ok(Math.hypot(dx, dz) > RAIO_DA_CASA + 0.3);
    assert.ok(dist(c, PRACA) > PRACA.raio + RAIO_DA_CASA + 0.3);
    assert.ok(dist(c, TOCA) > TOCA.raio + RAIO_DA_CASA + 0.3);
  }
});
