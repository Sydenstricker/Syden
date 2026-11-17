/**
 * A Masmorra da Toca (web/src/masmorra/regras.ts): o mapa e o andar são uma regra só, e o servidor confere com a CÓPIA dela
 * (server/src/masmorra-regras.ts). Aqui se confere que as duas cópias são iguais e o andar do coelho: as paredes, a quina que
 * escorrega para a porta, o empurrão do bloco e a cenoura que bate no cristal. A masmorra inteira com o piloto automático
 * contra o servidor de verdade mora em server/test/minijogos-masmorra.test.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as R from '../src/masmorra/regras.ts';

const vazio = (m: Partial<R.Mundo> = {}): R.Mundo => ({ blocos: [], bau: false, ponte: false, abertas: [], ...m });
const andar = (s: R.Sala, m: R.Mundo, c: R.Coelho, cmd: Partial<R.Comandos>, ms: number) => {
  const novidades: R.Novidade[] = [];
  for (let t = 0; t < ms; t += 1000 / 60) novidades.push(R.passoDoCoelho(s, m, c, { ...R.comandosVazios(), ...cmd }, 1 / 60, true));
  return novidades;
};

test('as duas cópias das regras são iguais byte a byte', () => {
  const doSite = readFileSync(new URL('../src/masmorra/regras.ts', import.meta.url));
  const doServidor = readFileSync(new URL('../../server/src/masmorra-regras.ts', import.meta.url));
  assert.ok(doSite.equals(doServidor), 'web/src/masmorra/regras.ts e server/src/masmorra-regras.ts diferem');
});

test('a parede segura o coelho, e a porta fechada também', () => {
  const s = R.SALAS[0];
  const c = R.novoCoelho(...R.centro(8, 2));
  andar(s, vazio(), c, { cima: true }, 2000);
  assert.ok(c.y >= R.TILE + R.RAIO - 0.01, `y ${c.y}`);
  const nov = andar(s, vazio(), c, { cima: true }, 100);
  assert.ok(nov.some((n) => n.porta === 'n'), 'apertar contra a porta fechada a pede ao servidor');
});

test('a quina escorrega: andando para cima um pouco ao lado da porta aberta, o coelho entra nela', () => {
  const s = R.SALAS[0];
  const [x] = R.centro(8, 1);
  const c = R.novoCoelho(x + 10, R.centro(8, 1)[1]);
  const nov = andar(s, vazio({ abertas: ['n'] }), c, { cima: true }, 800);
  assert.ok(nov.some((n) => n.porta === 'n'), `não entrou: ${c.x}, ${c.y}`);
});

test('o bloco: encostado e alinhado, apertar contra ele pede o empurrão', () => {
  const s = R.SALAS[2];
  const m = vazio({ blocos: [[8, 6]] });
  const c = R.novoCoelho(...R.centro(9, 6));
  const nov = andar(s, m, c, { esquerda: true }, 600);
  assert.ok(nov.some((n) => n.empurrar === 2));
});

test('a cenoura vai, bate no cristal do outro lado da água, e volta', () => {
  const s = R.SALAS[4];
  const [k] = R.casasDe(s, 'K');
  const dono = { x: R.centro(k[0], 6)[0], y: R.centro(k[0], 6)[1] };
  const cen: R.Cenoura = { id: 1, x: dono.x, y: dono.y, dx: 0, dy: -1, andou: 0, volta: false, t: 0 };
  let bateu: [number, number] | null = null;
  let fim = false;
  for (let t = 0; t < 2000 && !fim; t += 1000 / 60) {
    const r = R.passoDaCenoura(s, vazio(), cen, dono, 1 / 60);
    bateu ??= r.bateu;
    fim = r.fim;
  }
  assert.deepEqual(bateu, k);
  assert.ok(fim, 'voltou');
});
