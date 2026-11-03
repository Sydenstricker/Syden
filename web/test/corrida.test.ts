import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMOSTRA, amostrar, fantasmaEm, novoKart, passo, passosEmMs, pilotoAutomatico, tempoLegivel } from '../src/corrida/fisica';
import { Chao, chaoEm, HORTA, montarPista } from '../src/corrida/pista';

const pista = montarPista(HORTA);

/** Um piloto automático: mira um ponto da linha do meio um pouco à frente e acelera. */
function pilotar(derrapar: boolean) {
  const k = novoKart(pista);
  const caminho: number[] = [];
  while (!k.terminou && k.passos < 60 * 60 * 5) {
    const c = pilotoAutomatico(k, pista, derrapar);
    const antes = k.terminou;
    passo(k, c, pista);
    if (!antes) amostrar(k, caminho);
  }
  return { k, caminho };
}

test('a largada é no asfalto, e a pista tem árvores longe dele', () => {
  assert.equal(chaoEm(pista, pista.largada.x, pista.largada.y), Chao.Asfalto);
  const arvores = pista.objetos.filter((o) => o.tipo === 'arvore');
  assert.ok(arvores.length > 30, `${arvores.length} árvores`);
  for (const a of arvores) assert.notEqual(chaoEm(pista, a.x, a.y), Chao.Asfalto);
});

test('o piloto automático fecha as 3 voltas, e o fantasma tem o formato que o servidor confere', () => {
  const { k, caminho } = pilotar(false);
  assert.equal(k.terminou, true, 'não terminou');
  assert.equal(k.voltas.length, 3);
  const passos = k.voltas[2];
  assert.equal(caminho.length, 3 * (Math.floor((passos - 1) / AMOSTRA) + 1), 'uma amostra a cada 4 passos, até a chegada');
  for (let i = 0; i < 3; i++) assert.ok(k.voltas[i] - (i ? k.voltas[i - 1] : 0) >= 8 * 60, 'volta com menos de 8 s');
  for (let i = 3; i < caminho.length; i += 3) {
    assert.ok(Math.hypot(caminho[i] - caminho[i - 3], caminho[i + 1] - caminho[i - 2]) <= 160, 'salto maior do que o servidor aceita');
  }
  console.log('tempo do piloto automático:', tempoLegivel(passosEmMs(passos)), k.voltas.map((v, i) => tempoLegivel(passosEmMs(v - (i ? k.voltas[i - 1] : 0)))));
  const meio = fantasmaEm(caminho, 401);
  assert.ok(meio && Math.abs(meio.x) > 0, 'o fantasma se acha no meio do caminho');
  assert.equal(fantasmaEm(caminho, passos + 10), null, 'e some depois da chegada');
});

test('o mesmo piloto dá sempre o mesmo tempo (o tempo é de passos, não do relógio)', () => {
  assert.equal(pilotar(true).k.voltas[2], pilotar(true).k.voltas[2]);
});

test('dar ré na linha de chegada não conta volta', () => {
  const k = novoKart(pista);
  for (let i = 0; i < 90; i++) passo(k, { acelera: true, freia: false, vira: 0, derrapa: false }, pista);
  for (let i = 0; i < 300; i++) passo(k, { acelera: false, freia: true, vira: 0, derrapa: false }, pista);
  for (let i = 0; i < 300; i++) passo(k, { acelera: true, freia: false, vira: 0, derrapa: false }, pista);
  assert.equal(k.volta, 0);
});

test('o fantasma do piloto automático passa na conferência do servidor, e as medidas da pista batem', async () => {
  const { PISTAS, validarCorrida } = await import('../../server/src/corrida.ts');
  const def = PISTAS[HORTA.id];
  assert.ok(def, 'a pista existe no servidor');
  assert.ok(Math.abs(def.comprimento - pista.comprimento) < 2, `comprimento: servidor ${def.comprimento}, site ${pista.comprimento}`);
  assert.deepEqual(def.linha, [Math.round(pista.lx[0]), Math.round(pista.ly[0])]);
  assert.equal(def.voltas, HORTA.voltas);
  for (const derrapar of [false, true]) {
    const { k, caminho } = pilotar(derrapar);
    const v = validarCorrida(HORTA.id, { voltas: k.voltas, amostras: caminho });
    assert.ok('ok' in v, `o servidor recusou a corrida honesta (derrapando: ${derrapar})`);
  }
});
