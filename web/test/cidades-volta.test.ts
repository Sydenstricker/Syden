import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lugarDaCasaDasCidades, voltaDasCidades, COR_DO_GRUPO, COR_DO_GRUPO_NO_BRASIL } from '../src/cidadesVolta';

/**
 * Capitais, a volta (20/11/2026): o desenho de reserva e o 3D põem cada casa num lugar só da borda do retângulo — 10 × 8 na de 32
 * casas, 12 × 10 no Brasil inteiro (40) — e cada casa encosta na anterior.
 */
for (const total of [32, 40]) {
  test(`a volta de ${total} casas: cada casa num lugar da borda, sem repetir, e a seguinte ao lado`, () => {
    const { colunas, linhas } = voltaDasCidades(total);
    assert.equal(2 * colunas + 2 * linhas - 4, total);
    const vistos = new Set<string>();
    for (let i = 0; i < total; i++) {
      const { x, y } = lugarDaCasaDasCidades(i, total);
      const c = x / 40;
      const l = y / 40;
      assert.ok(c === 0 || c === colunas - 1 || l === 0 || l === linhas - 1, `casa ${i} fora da borda`);
      assert.ok(c >= 0 && c < colunas && l >= 0 && l < linhas);
      vistos.add(`${c},${l}`);
      const prox = lugarDaCasaDasCidades((i + 1) % total, total);
      assert.equal(Math.abs(prox.x - x) + Math.abs(prox.y - y), 40, `a casa ${i + 1} não encosta na ${i}`);
    }
    assert.equal(vistos.size, total);
  });
}

test('as cores: 7 grupos na de 32, 9 no Brasil inteiro', () => {
  assert.equal(COR_DO_GRUPO.length, 7);
  assert.equal(COR_DO_GRUPO_NO_BRASIL.length, 9);
  // a de 32 continua desenhada como antes
  assert.deepEqual(lugarDaCasaDasCidades(9), { x: 360, y: 0 });
  assert.deepEqual(lugarDaCasaDasCidades(25), { x: 0, y: 280 });
});

test('as Capitais do mundo: cada país do tabuleiro do servidor tem o nome da capital, e nada sobra', async () => {
  const { readFileSync } = await import('node:fs');
  const { CAPITAL_DO_PAIS } = await import('../src/capitaisDoMundo.ts');
  const fonte = readFileSync(new URL('../../server/src/minijogo-cidades.ts', import.meta.url), 'utf8');
  const bloco = fonte.slice(fonte.indexOf('export const PAISES_DO_MUNDO'), fonte.indexOf('const doMundo'));
  const codigos = [...bloco.matchAll(/\['([A-Z]{2})', \d\]/g)].map((m) => m[1]);
  assert.equal(codigos.length, 20);
  assert.deepEqual([...codigos].sort(), Object.keys(CAPITAL_DO_PAIS).sort());
});
