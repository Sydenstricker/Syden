import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMOSTRA, amostrar, atingir, fantasmaEm, novoKart, passo, passosEmMs, pilotoAutomatico, progresso, TEMPO_DA_TOCA, tempoLegivel } from '../src/corrida/fisica';
import { pontoNaLinha, repolhoEm, roxoAlcancou, roxoEm, sortearItem } from '../src/corrida/laco';
import { Chao, chaoEm, HORTA, marcosDaPista, montarPista, PISTAS, type Pista } from '../src/corrida/pista';
import { PASSO_MAXIMO } from '../../server/src/corrida.ts';

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
    assert.ok(Math.hypot(caminho[i] - caminho[i - 3], caminho[i + 1] - caminho[i - 2]) <= PASSO_MAXIMO, 'salto maior do que o servidor aceita');
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
    assert.equal(s.meiaLargura, def.meiaLargura, `${def.id}: a meia largura`);
    // os marcos que o servidor exige em cada volta são os da linha do meio do site (revisão independente, 03/11/2026)
    const marcos = marcosDaPista(def, s.marcos.length);
    assert.ok(s.marcos.length >= 6 && s.marcos.length <= 10, `${def.id}: ${s.marcos.length} marcos`);
    marcos.forEach(([x, y], i) => {
      assert.ok(Math.hypot(s.marcos[i][0] - x, s.marcos[i][1] - y) < 1.5, `${def.id}: o marco ${i} do servidor ${s.marcos[i]}, do site ${[x, y].map(Math.round)}`);
    });
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
  const sorteados = (posicao: number, total = 4) => {
    const vezes = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const item = sortearItem(posicao, total, () => i / 1000);
      vezes.set(item, (vezes.get(item) ?? 0) + 1);
    }
    return (item: string) => vezes.get(item) ?? 0;
  };
  const primeiro = sorteados(0), ultimo = sorteados(3);
  const turbos = (v: (i: string) => number) => v('cenoura') + v('cenouras');
  assert.ok(turbos(ultimo) > turbos(primeiro) * 3, `o último ganha mais cenoura (${turbos(ultimo)}) que o primeiro (${turbos(primeiro)})`);
  assert.ok(primeiro('lama') + primeiro('alface') > ultimo('lama') + ultimo('alface'), 'o primeiro ganha mais lama e alface');
  assert.equal(primeiro('repolho-roxo'), 0, 'o líder não ganha o roxo: não há ninguém à frente');
  assert.equal(primeiro('regador'), 0, 'nem o regador');
  assert.ok(ultimo('regador') > 0, 'o último ganha o regador');
  assert.equal(sorteados(1, 2)('regador'), 0, 'com dois na corrida, não há regador');
  for (const item of ['cenoura', 'cenouras', 'repolho', 'repolho-roxo', 'lama', 'alface', 'toca', 'regador']) {
    assert.ok(sorteados(1)(item) + sorteados(2)(item) + ultimo(item) + primeiro(item) > 0, `${item} sai de alguma posição`);
  }
});

test('o repolho-roxo vai atrás do alvo pela linha do meio, e o alcança quando andou o quanto ele estava à frente', () => {
  const e = { n: 0, s: 100, lado: 20 };
  assert.equal(roxoAlcancou(pista, e, 60, 500), false, 'em 1 s andou 290: o alvo a 400 ainda não');
  assert.equal(roxoAlcancou(pista, e, 83, 500), true, 'em ~1,4 s, sim');
  assert.equal(roxoAlcancou(pista, e, 200, 500), false, 'muito depois de passar, não (já teria pegado ou sumido)');
  assert.equal(roxoAlcancou(pista, e, 6 * 60 + 1, 100 + 1741), false, 'depois de 6 s, acabou');
  // perto do fim da volta, o alvo já na volta seguinte: a distância dá a volta
  const fim = { n: 0, s: pista.comprimento - 50, lado: 0 };
  assert.equal(roxoAlcancou(pista, fim, 30, 80), true, 'o alvo 130 à frente, do outro lado da linha de chegada');
  const r0 = roxoEm(pista, e, 0)!, r1 = roxoEm(pista, e, 60)!;
  const q0 = pontoNaLinha(pista, 100), q1 = pontoNaLinha(pista, 390);
  assert.ok(Math.hypot(r0.x - q0.x, r0.y - q0.y) > 15, 'sai da faixa de quem soltou');
  assert.ok(Math.hypot(r1.x - q1.x, r1.y - q1.y) < 0.01, 'e em 1 s está no meio da pista');
});

test('a toca passa pela grama sem frear e não é atingida; a chuva faz escorregar', () => {
  const naGrama = (toca: number) => {
    const k = novoKart(pista);
    // um kart na grama, em linha reta
    let x = 0, y = 0;
    for (let yy = 0; yy < 1024 && !x; yy += 4) for (let xx = 0; xx < 1024; xx += 4) if (chaoEm(pista, xx, yy) === Chao.Grama && chaoEm(pista, xx + 40, yy) === Chao.Grama) { x = xx; y = yy; break; }
    Object.assign(k, { x, y, angulo: 0, rumo: 0, v: 100, toca });
    for (let i = 0; i < 20; i++) passo(k, { acelera: true, freia: false, vira: 0, derrapa: false }, pista);
    return k;
  };
  assert.ok(naGrama(TEMPO_DA_TOCA).v > naGrama(0).v + 20, 'na toca a grama não segura');
  const k = naGrama(TEMPO_DA_TOCA);
  atingir(k);
  assert.equal(k.rodando, 0, 'debaixo da terra, nada pega');
  const seco = novoKart(pista), molhado = novoKart(pista);
  molhado.chuva = 3;
  for (const kk of [seco, molhado]) {
    for (let i = 0; i < 120; i++) passo(kk, pilotoAutomatico(kk, pista), pista);
    for (let i = 0; i < 20; i++) passo(kk, { acelera: true, freia: false, vira: 1, derrapa: false }, pista);
  }
  const deriva = (kk: typeof seco) => Math.abs(kk.angulo - kk.rumo);
  assert.ok(deriva(molhado) > deriva(seco) * 2, `na chuva o kart escorrega (${deriva(molhado).toFixed(3)} contra ${deriva(seco).toFixed(3)})`);
});

test('as copas do site e do servidor são as mesmas, e toda pista delas existe', async () => {
  const { COPAS } = await import('../src/corrida/pista');
  const { COPAS: NO_SERVIDOR } = await import('../../server/src/minijogo-corrida.ts');
  assert.deepEqual(COPAS, NO_SERVIDOR);
  for (const pistas of Object.values(COPAS)) for (const id of pistas) assert.ok(PISTAS.some((p) => p.id === id), id);
});

test('na sala, toda posição do piloto automático honesto passa na conferência do servidor, nas seis pistas', async () => {
  // a revisão independente de 03/11/2026 fez o servidor recusar a posição que o kart não alcança: a honesta tem de passar
  const { criarCorrida } = await import('../../server/src/minijogo-corrida.ts');
  for (const def of PISTAS) {
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
    const jogo = criarCorrida(() => agora).comecar(ctx, { naSala: [1, 2], criadaPor: 1, corpo: { pista: def.id } });
    assert.ok(typeof jogo !== 'string');
    relogio[0]();
    agora += 500; // a rede: o verde chega meio segundo depois
    const p = montarPista(def);
    const k = novoKart(p);
    let recusadas = 0, mandadas = 0;
    while (!k.terminou && k.passos < 60 * 60 * 5) {
      passo(k, pilotoAutomatico(k, p, true), p);
      agora += 1000 / 60;
      if (!k.terminou && (k.passos - 1) % AMOSTRA === 0) {
        mandadas++;
        const pos = { n: k.passos, x: +k.x.toFixed(1), y: +k.y.toFixed(1), a: +k.angulo.toFixed(3), andou: +progresso(k, p).toFixed(3) };
        if (jogo.tempoReal!(1, pos) === null) recusadas++;
      }
    }
    assert.equal(recusadas, 0, `${def.id}: ${recusadas} de ${mandadas} posições recusadas`);
  }
});
