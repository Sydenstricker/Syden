import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMOSTRA, amostrar, fantasmaEm, novoKart, passo, passosEmMs, pilotoAutomatico, tempoLegivel } from '../src/corrida/fisica';
import { pontoNaLinha, repolhoEm, sortearItem } from '../src/corrida/laco';
import { Chao, chaoEm, HORTA, montarPista, PISTAS, type Pista } from '../src/corrida/pista';

const pista = montarPista(HORTA);

/** Um piloto automático: mira um ponto da linha do meio um pouco à frente e acelera. */
function pilotar(derrapar: boolean, pista: Pista = montarPista(HORTA)) {
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

test('em cada pista, o fantasma do piloto automático passa na conferência do servidor, e as medidas batem', async () => {
  const { PISTAS: NO_SERVIDOR, validarCorrida } = await import('../../server/src/corrida.ts');
  for (const def of PISTAS) {
    const p = montarPista(def);
    const s = NO_SERVIDOR[def.id];
    assert.ok(s, `${def.id} existe no servidor`);
    assert.ok(Math.abs(s.comprimento - p.comprimento) < 2, `${def.id}: comprimento do servidor ${s.comprimento}, do site ${p.comprimento}`);
    assert.deepEqual(s.linha, [Math.round(p.lx[0]), Math.round(p.ly[0])], `${def.id}: a linha de chegada`);
    assert.equal(s.voltas, def.voltas);
    assert.equal(s.caixas, def.caixas.length, `${def.id}: as fileiras de caixas (o servidor limita os itens por elas)`);
    assert.equal(chaoEm(p, p.largada.x, p.largada.y), Chao.Asfalto, `${def.id}: a largada é no asfalto`);
    // nenhum trecho do asfalto encosta em outro (a pista não passa perto dela mesma)
    const n = p.lx.length;
    for (let i = 0; i < n; i += 3) {
      for (let j = i + 40; j < n && n - j + i >= 40; j += 3) {
        assert.ok(Math.hypot(p.lx[i] - p.lx[j], p.ly[i] - p.ly[j]) > 2 * def.meiaLargura + 20, `${def.id}: trechos ${i} e ${j} encostam`);
      }
    }
    for (const derrapar of [false, true]) {
      const { k, caminho } = pilotar(derrapar, p);
      assert.equal(k.terminou, true, `${def.id}: o piloto automático não terminou`);
      const v = validarCorrida(def.id, { voltas: k.voltas, amostras: caminho });
      assert.ok('ok' in v, `${def.id}: o servidor recusou a corrida honesta (derrapando: ${derrapar})`);
    }
  }
});

test('os itens: o repolho anda pela linha do meio, some depois de 4 s, e o sorteio favorece quem está atrás', () => {
  const comeco = pontoNaLinha(pista, 100);
  const r0 = repolhoEm(pista, { n: 100, s: 100, lado: 0 }, 100)!;
  assert.ok(Math.hypot(r0.x - comeco.x, r0.y - comeco.y) < 0.01, 'no passo em que saiu, está onde saiu');
  const r1 = repolhoEm(pista, { n: 100, s: 100, lado: 0 }, 160)!;
  const depois = pontoNaLinha(pista, 330);
  assert.ok(Math.hypot(r1.x - depois.x, r1.y - depois.y) < 0.01, 'um segundo depois, 230 unidades à frente');
  assert.equal(repolhoEm(pista, { n: 100, s: 100, lado: 0 }, 100 + 4 * 60 + 1), null);
  assert.equal(repolhoEm(pista, { n: 100, s: 100, lado: 0 }, 99), null, 'antes de sair, não está');
  const conta = (posicao: number) => {
    let cenouras = 0;
    for (let i = 0; i < 1000; i++) if (sortearItem(posicao, 4, () => i / 1000) === 'cenoura') cenouras++;
    return cenouras;
  };
  assert.ok(conta(3) > conta(0) * 3, `o último ganha mais cenoura (${conta(3)}) que o primeiro (${conta(0)})`);
});

test('as copas do site e do servidor são as mesmas, e toda pista delas existe', async () => {
  const { COPAS } = await import('../src/corrida/pista');
  const { COPAS: NO_SERVIDOR } = await import('../../server/src/minijogo-corrida.ts');
  assert.deepEqual(COPAS, NO_SERVIDOR);
  for (const pistas of Object.values(COPAS)) for (const id of pistas) assert.ok(PISTAS.some((p) => p.id === id), id);
});
