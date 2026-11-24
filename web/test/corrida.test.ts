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

test('o turbo da largada: no tempo certo sai com turbo, cedo demais patina, e quem segurava desde antes não ganha nada', async () => {
  const { largada, LARGADA_BOA, LARGADA_CEDO } = await import('../src/corrida/fisica');
  const anda = (segurou: number) => {
    const k = novoKart(pista);
    const r = largada(k, segurou, 180);
    for (let i = 0; i < 60; i++) passo(k, { acelera: true, freia: false, vira: 0, derrapa: false }, pista);
    return { r, v: k.v };
  };
  const bom = anda(LARGADA_BOA[0] + 5), nada = anda(0), cedo = anda(LARGADA_CEDO + 10), tela = anda(180), meio = anda(LARGADA_BOA[1] + 5);
  assert.equal(bom.r, 'turbo');
  assert.equal(cedo.r, 'patina');
  assert.equal(tela.r, null, 'a tela de toque acelera desde antes do semáforo');
  assert.equal(meio.r, null);
  assert.ok(bom.v > nada.v + 5, `o turbo sai na frente (${bom.v} contra ${nada.v})`);
  assert.ok(cedo.v < nada.v - 5, `quem patina fica para trás (${cedo.v} contra ${nada.v})`);
  // e o fantasma de quem largou com turbo continua passando na conferência do servidor
  const { validarCorrida } = await import('../../server/src/corrida.ts');
  const k = novoKart(pista);
  largada(k, 20, 180);
  const caminho: number[] = [];
  while (!k.terminou && k.passos < 60 * 60 * 5) {
    passo(k, pilotoAutomatico(k, pista, true), pista);
    if (!k.terminou || caminho.length < 3 * (Math.floor((k.passos - 1) / AMOSTRA) + 1)) amostrar(k, caminho);
  }
  const v = validarCorrida(HORTA.id, { voltas: k.voltas, amostras: caminho });
  assert.ok('ok' in v, `o servidor recusou: ${JSON.stringify(v)}`);
});

test('os robôs: largam da grade, fecham as voltas nas três dificuldades, o difícil chega antes do fácil, e a classe rápida é mais rápida', async () => {
  const { andarRobo, criarRobos, largadaDoRobo, ordemDaCorrida, progressoDoRobo, somarPontos, PONTOS_DA_COPA } = await import('../src/corrida/robos');
  const correr = (dificuldade: 'facil' | 'medio' | 'dificil', classe = 1) => {
    const robos = criarRobos(pista, 7, dificuldade, classe);
    for (const r of robos) {
      assert.equal(chaoEm(pista, r.kart.x, r.kart.y), Chao.Asfalto, 'a casa da grade é no asfalto');
      largadaDoRobo(r, dificuldade, 180);
    }
    for (let n = 0; n < 60 * 60 * 6 && robos.some((r) => !r.kart.terminou); n++) for (const r of robos) andarRobo(r, pista);
    return robos;
  };
  const media = (rs: { chegada: number }[]) => rs.reduce((s, r) => s + r.chegada, 0) / rs.length;
  const facil = correr('facil'), medio = correr('medio'), dificil = correr('dificil'), rapida = correr('medio', 1.25);
  for (const rs of [facil, medio, dificil, rapida]) for (const r of rs) assert.ok(r.kart.terminou && r.chegada > 0, `${r.nome} não terminou`);
  assert.ok(media(dificil) < media(medio) && media(medio) < media(facil), `difícil ${media(dificil)}, médio ${media(medio)}, fácil ${media(facil)}`);
  assert.ok(media(rapida) < media(medio), `a classe rápida ${media(rapida)} contra ${media(medio)}`);
  console.log('robôs (média da chegada):', [facil, medio, dificil, rapida].map((rs) => tempoLegivel(passosEmMs(media(rs)))));
  // a ordem: quem chegou, pela chegada; depois pelo quanto andou
  const ordem = ordemDaCorrida([
    { id: 1, chegada: 0, andou: 2.9 },
    { id: 2, chegada: 5000, andou: 3 },
    { id: 3, chegada: 4900, andou: 3 },
    { id: 4, chegada: 0, andou: 2.95 },
  ]);
  assert.deepEqual(ordem.map((l) => l.id), [3, 2, 4, 1]);
  assert.ok(progressoDoRobo(facil[0], pista) === 3);
  // os pontos da copa somam pela posição, e o empate fica com quem já estava na frente
  let pontos = somarPontos([], [{ id: 1, nome: 'a', eu: true }, { id: 2, nome: 'b', eu: false }]);
  assert.deepEqual(pontos.map((l) => [l.id, l.pontos]), [[1, PONTOS_DA_COPA[0]], [2, PONTOS_DA_COPA[1]]]);
  pontos = somarPontos(pontos, [{ id: 2, nome: 'b', eu: false }, { id: 1, nome: 'a', eu: true }]);
  assert.deepEqual(pontos.map((l) => l.id), [1, 2]);
});

test('o espelho: a mesma pista virada, com a largada no asfalto, o mesmo comprimento, e um id que o servidor não conhece', async () => {
  const { espelhar } = await import('../src/corrida/pista');
  const { PISTAS: NO_SERVIDOR } = await import('../../server/src/corrida.ts');
  for (const def of PISTAS) {
    const e = espelhar(def);
    assert.notEqual(e.id, def.id);
    assert.equal(NO_SERVIDOR[e.id], undefined, 'o recorde nunca se mistura');
    assert.equal(espelhar(e), e, 'espelhar duas vezes não vira outra pista');
    const p = montarPista(e);
    assert.equal(chaoEm(p, p.largada.x, p.largada.y), Chao.Asfalto, `${e.id}: a largada`);
    assert.ok(Math.abs(p.comprimento - montarPista(def).comprimento) < 1, `${e.id}: o comprimento`);
    const { k } = pilotar(false, p);
    assert.equal(k.terminou, true, `${e.id}: o piloto automático fecha as voltas`);
  }
});

test('as medalhas: o tempo do ouro de cada pista é o do piloto automático derrapando', async () => {
  const { TEMPO_DO_PILOTO, medalhaDaCorrida } = await import('../src/corrida/parciais');
  for (const def of PISTAS) {
    const { k } = pilotar(true, montarPista(def));
    assert.equal(TEMPO_DO_PILOTO[def.id], k.voltas[2], `${def.id}: o piloto fez ${k.voltas[2]} passos`);
    assert.equal(medalhaDaCorrida(def.id, k.voltas[2]), 0);
    assert.equal(medalhaDaCorrida(def.id, Math.round(k.voltas[2] * 1.05)), 1);
    assert.equal(medalhaDaCorrida(def.id, Math.round(k.voltas[2] * 1.15)), 2);
    assert.equal(medalhaDaCorrida(def.id, Math.round(k.voltas[2] * 1.3)), null);
  }
});

test('as parciais: o fantasma cruza todos os marcos em ordem, e contra ele mesmo a diferença é zero', async () => {
  const { criarParciais, diferencaLegivel, parciaisDoFantasma, PARCIAIS_POR_VOLTA } = await import('../src/corrida/parciais');
  for (const derrapar of [false, true]) {
    const { k, caminho } = pilotar(derrapar);
    const marcos = parciaisDoFantasma(pista, 3, caminho);
    const total = 3 * PARCIAIS_POR_VOLTA - 1;
    for (let i = 1; i <= total; i++) assert.ok(marcos[i] > (marcos[i - 1] ?? 0), `o marco ${i}: ${marcos[i]}`);
    // o fim de cada volta é um marco: perto do passo em que a volta acabou (as amostras são de 4 em 4)
    for (const v of [1, 2]) assert.ok(Math.abs(marcos[v * PARCIAIS_POR_VOLTA] - k.voltas[v - 1]) <= 8, `volta ${v}: ${k.voltas[v - 1]}, marco ${marcos[v * PARCIAIS_POR_VOLTA]}`);
    assert.equal(marcos[total + 1], undefined, 'a chegada não é marco');
    // o mesmo kart, seguido pelas posições a cada AMOSTRA passos como a tela faz, passa na mesma hora do fantasma
    const seguir = criarParciais(pista, 3);
    for (let j = 0; j * 3 < caminho.length; j++) {
      for (const m of seguir.andar(caminho[j * 3] / 10, caminho[j * 3 + 1] / 10)) assert.equal(1 + j * AMOSTRA - marcos[m], 0);
    }
  }
  assert.equal(diferencaLegivel(-420), '−0.42');
  assert.equal(diferencaLegivel(1100), '+1.10');
});

test('o mestre: mais rápido que o difícil e que o piloto automático, e o empurrão só vale para quem vem atrás', async () => {
  const { andarRobo, criarRobos, largadaDoRobo, MESTRE_CLASSE, MESTRE_EMPURRAO } = await import('../src/corrida/robos');
  const correr = (dificuldade: 'dificil' | 'mestre', quemJoga?: number) => {
    const robos = criarRobos(pista, 7, dificuldade);
    for (const r of robos) largadaDoRobo(r, dificuldade, 180);
    for (let n = 0; n < 60 * 60 * 6 && robos.some((r) => !r.kart.terminou); n++) for (const r of robos) andarRobo(r, pista, quemJoga);
    return robos.reduce((s, r) => s + r.chegada, 0) / robos.length;
  };
  const piloto = pilotar(true).k.voltas[2];
  const dificil = correr('dificil'), mestre = correr('mestre');
  console.log('difícil', tempoLegivel(passosEmMs(dificil)), 'mestre', tempoLegivel(passosEmMs(mestre)), 'piloto', tempoLegivel(passosEmMs(piloto)));
  assert.ok(mestre < dificil && mestre < piloto, `mestre ${mestre}, difícil ${dificil}, piloto ${piloto}`);
  // o empurrão: com quem joga muito à frente, o teto sobe até o máximo; com quem joga atrás, fica o do mestre
  const [r] = criarRobos(pista, 1, 'mestre');
  andarRobo(r, pista, 5);
  assert.ok(Math.abs(r.kart.classe - MESTRE_CLASSE * (1 + MESTRE_EMPURRAO)) < 1e-9);
  andarRobo(r, pista, -5);
  assert.ok(Math.abs(r.kart.classe - MESTRE_CLASSE) < 1e-9);
  // fora do mestre, nada muda
  const [d] = criarRobos(pista, 1, 'dificil');
  andarRobo(d, pista, 5);
  assert.equal(d.kart.classe, 1);
});

test('a Fazenda (21/11/2026): a porteira fechada é parede pelo passo, sempre deixa uma metade aberta, e os robôs a passam', async () => {
  const { FAZENDA, ladoFechado, porteiraEm, CICLO_DA_PORTEIRA } = await import('../src/corrida/pista');
  const p = montarPista(FAZENDA);
  assert.equal(p.porteiras?.length, 2);
  // a mesma porteira, no mesmo passo, é a mesma em qualquer computador; e nunca as duas folhas fechadas
  for (const por of p.porteiras!) {
    let fechados = 0;
    for (let n = 0; n < CICLO_DA_PORTEIRA; n++) {
      const l = ladoFechado(por, n);
      if (l !== 0) fechados++;
      assert.equal(l, ladoFechado(por, n + 7 * CICLO_DA_PORTEIRA), 'o ciclo se repete');
    }
    assert.ok(fechados > CICLO_DA_PORTEIRA * 0.8, 'quase sempre uma folha fechada');
    // fechada de um lado, aberta do outro
    const n = [...Array(CICLO_DA_PORTEIRA).keys()].find((i) => ladoFechado(por, i) === 1)!;
    const nx = -por.ty, ny = por.tx;
    assert.ok(porteiraEm(p, por.x + nx * 15, por.y + ny * 15, n), 'a folha +1 fechada');
    assert.equal(porteiraEm(p, por.x - nx * 15, por.y - ny * 15, n), null, 'a outra aberta');
  }
  // um kart mirando o lado fechado bate e para; do lado aberto passa
  const por = p.porteiras![0];
  const n0 = [...Array(CICLO_DA_PORTEIRA).keys()].find((i) => ladoFechado(por, i) === 1 && ladoFechado(por, i + 60) === 1)!;
  const contra = (lado: number) => {
    const k = novoKart(p);
    const nx = -por.ty, ny = por.tx;
    Object.assign(k, { x: por.x - por.tx * 30 + nx * 15 * lado, y: por.y - por.ty * 30 + ny * 15 * lado, angulo: Math.atan2(por.ty, por.tx), rumo: Math.atan2(por.ty, por.tx), v: 140, passos: n0 });
    for (let i = 0; i < 40; i++) passo(k, { acelera: true, freia: false, vira: 0, derrapa: false }, p);
    return (k.x - por.x) * por.tx + (k.y - por.y) * por.ty;
  };
  assert.ok(contra(1) < 0, 'a folha fechada segura o kart');
  assert.ok(contra(-1) > 20, 'pelo lado aberto, passa');
  // o piloto automático sem desviar perde tempo nas porteiras; desviando, quase não bate
  const { andarRobo, criarRobos, largadaDoRobo } = await import('../src/corrida/robos');
  for (const dificuldade of ['facil', 'dificil'] as const) {
    const robos = criarRobos(p, 7, dificuldade);
    for (const r of robos) largadaDoRobo(r, dificuldade, 180);
    for (let n = 0; n < 60 * 60 * 6 && robos.some((r) => !r.kart.terminou); n++) for (const r of robos) andarRobo(r, p);
    for (const r of robos) assert.ok(r.kart.terminou, `${dificuldade}: ${r.nome} não terminou a Fazenda`);
  }
});

test('os robôs na sala (24/11/2026): quem larga na última fila da grade passa na conferência do servidor em toda pista', async () => {
  const { validarCorrida, PISTAS: DO_SERVIDOR } = await import('../../server/src/corrida.ts');
  const { CASA_DE_QUEM_JOGA, porNaGrade, criarRobos, andarRobo } = await import('../src/corrida/robos');
  for (const def of PISTAS) {
    const p = montarPista(def);
    const k = novoKart(p);
    porNaGrade(k, p, CASA_DE_QUEM_JOGA);
    // a primeira posição ao vivo: perto da linha (o servidor aceita até 60 mais o que o kart anda) e na volta 0
    const linha = DO_SERVIDOR[def.id].linha;
    assert.ok(Math.hypot(k.x - linha[0], k.y - linha[1]) < 60 + 30, `${def.id}: a última fila longe da linha (o servidor aceita 60 + 30 com robôs)`);
    assert.equal(Math.floor(progresso(k, p)), 0, `${def.id}: a largada é da volta 0`);
    const caminho: number[] = [];
    while (!k.terminou && k.passos < 60 * 60 * 5) {
      passo(k, pilotoAutomatico(k, p, true), p);
      if (!k.terminou || caminho.length < 3 * (Math.floor((k.passos - 1) / AMOSTRA) + 1)) amostrar(k, caminho);
    }
    const v = validarCorrida(def.id, { voltas: k.voltas, amostras: caminho });
    assert.ok('ok' in v, `${def.id}: o servidor recusou: ${JSON.stringify(v)}`);
    // os mesmos robôs (a mesma conta) em dois computadores: passo a passo, o mesmo lugar
    const a = criarRobos(p, 7, 'medio'), b = criarRobos(p, 7, 'medio');
    for (let n = 0; n < 600; n++) {
      for (const r of a) andarRobo(r, p);
      for (const r of b) andarRobo(r, p);
    }
    a.forEach((r, i) => assert.ok(r.kart.x === b[i].kart.x && r.kart.y === b[i].kart.y, `${def.id}: o robô ${i} se separou`));
  }
});
