import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alvo, espaco, irPara, novaCozinha, passo, progresso, usar, PRATOS_INICIAIS, TEMPO_DE_LAVAR_MS, VOLTA_DO_PRATO_MS, type Cozinha, type Evento } from '../src/cozinha/cozinha';
import { pilotar } from '../src/cozinha/piloto';
import { ESTACOES_DE_FOGO, FOGO_DAS_PLANTAS, IDS_DAS_RECEITAS, INCENDIO_MS, INGREDIENTES, PLANTAS_DA_COZINHA, PONTO, SABORES, confere, type IdDaReceita, type Item } from '../src/cozinha/receitas';

/**
 * A Cozinha da toca (web/src/cozinha/): as regras da cozinha e o piloto automático, sem desenho. O piloto usa os mesmos
 * comandos do teclado e do clique, então ele fechar cada receita é a prova de que toda receita se faz na cozinha.
 */

const DT = 1 / 60;

/** Roda a cozinha com o piloto até entregar `receita` (ou o tempo acabar). Devolve o prato entregue e quanto levou. */
function cozinhar(receita: IdDaReceita, k: Cozinha = novaCozinha(), limite = 120) {
  let entregue: Item[] | null = null;
  let t = 0;
  while (!entregue && t < limite) {
    pilotar(k, receita);
    const ev: Evento[] = passo(k, null, DT, (itens) => confere(receita, itens));
    for (const e of ev) if (e.tipo === 'entregue') entregue = e.itens;
    t += DT;
  }
  return { entregue, t };
}

for (const id of IDS_DAS_RECEITAS) {
  test(`o piloto faz ${id} pelas regras da cozinha, sem queimar nada`, () => {
    const { entregue, t } = cozinhar(id);
    assert.ok(entregue, `${id} não saiu`);
    assert.ok(confere(id, entregue));
    assert.ok(t < 60, `${id} levou ${t.toFixed(1)} s`);
  });
}

test('vários pedidos seguidos, na mesma cozinha (o que sobrou de um não trava o outro)', () => {
  const k = novaCozinha();
  for (const id of ['x-salada', 'pizza-calabresa', 'sorvete-morango', 'hamburguer', 'pizza-cogumelo', 'salada', 'prato-feito', 'sushi', 'peixe-com-arroz', 'cachorro-quente', 'x-egg', 'pao-com-ovo', 'cafe-da-manha', 'x-bacon', 'bife-com-arroz', 'bife-com-salada'] as IdDaReceita[]) {
    assert.ok(cozinhar(id, k).entregue, id);
  }
});

test('o fogo: a carne fica no ponto e depois queima', () => {
  const k = novaCozinha();
  const fogao = k.estacoes.find((e) => e.tipo === 'fogao')!;
  const carne = k.estacoes.find((e) => e.ing === 'carne')!;
  const nada = () => false;
  irPara(k, carne.id, 'espaco');
  for (let n = 0; n < 200 && k.coelho.destino; n++) passo(k, null, DT, nada);
  assert.equal(k.coelho.mao?.tipo, 'item');
  irPara(k, fogao.id, 'espaco');
  for (let n = 0; n < 300 && k.coelho.destino; n++) passo(k, null, DT, nada);
  assert.equal(fogao.em?.tipo, 'item');
  const item = () => (fogao.em as { item: Item }).item;
  let ev: Evento[] = [];
  for (let ms = 0; ms < PONTO.carne.pronto + 50; ms += 1000 * DT) ev = ev.concat(passo(k, null, DT, nada));
  assert.equal(item().estado, 'cozido');
  assert.ok(ev.some((e) => e.tipo === 'pronto'));
  for (let ms = 0; ms < PONTO.carne.queima - PONTO.carne.pronto + 50; ms += 1000 * DT) passo(k, null, DT, nada);
  assert.equal(item().estado, 'queimado');
});

test('a tábua só pica com o coelho lá; as setas param a faca', () => {
  const k = novaCozinha();
  const nada = () => false;
  const alface = k.estacoes.find((e) => e.ing === 'alface')!;
  const tabua = k.estacoes.find((e) => e.tipo === 'tabua')!;
  irPara(k, alface.id, 'espaco');
  for (let n = 0; n < 300 && k.coelho.destino; n++) passo(k, null, DT, nada);
  irPara(k, tabua.id, 'espaco');
  for (let n = 0; n < 300 && k.coelho.destino; n++) passo(k, null, DT, nada);
  assert.equal(alvo(k), tabua);
  usar(k, nada);
  for (let n = 0; n < 30; n++) passo(k, null, DT, nada);
  passo(k, { x: 0, z: 1 }, DT, nada);
  for (let n = 0; n < 200; n++) passo(k, null, DT, nada);
  assert.equal((tabua.em as { item: Item }).item.estado, 'cru');
  // nada se junta errado: a alface crua não vai na massa, e a janela recusa o prato que não é pedido
  k.coelho.mao = { tipo: 'prato', itens: [{ ing: 'alface', estado: 'cru' }] };
  irPara(k, k.estacoes.find((e) => e.tipo === 'entrega')!.id, 'espaco');
  let ev: Evento[] = [];
  for (let n = 0; n < 300 && k.coelho.destino; n++) ev = ev.concat(passo(k, null, DT, nada));
  assert.ok(ev.some((e) => e.tipo === 'recusado'));
  assert.equal(k.coelho.mao?.tipo, 'prato');
  assert.deepEqual(espaco(k, () => true)[0].tipo, 'entregue');
  assert.equal(k.coelho.mao, null);
});

test('o fogão aceita o que é dele cru, e não o peixe já picado (o do sushi)', () => {
  const k = novaCozinha();
  const nada = () => false;
  const fogao = k.estacoes.find((e) => e.tipo === 'fogao')!;
  const ir = (id: number) => {
    irPara(k, id, 'espaco');
    for (let n = 0; n < 400 && k.coelho.destino; n++) passo(k, null, DT, nada);
  };
  k.coelho.mao = { tipo: 'item', item: { ing: 'peixe', estado: 'picado' } };
  ir(fogao.id);
  assert.equal(fogao.em, null);
  for (const ing of ['salsicha', 'ovo', 'arroz', 'peixe', 'bacon', 'bife'] as const) {
    k.coelho.mao = { tipo: 'item', item: { ing, estado: 'cru' } };
    ir(fogao.id);
    assert.equal((fogao.em as { item: Item } | null)?.item.ing, ing);
    for (let ms = 0; ms < PONTO[ing]!.pronto + 50; ms += 1000 * DT) passo(k, null, DT, nada);
    assert.equal((fogao.em as { item: Item }).item.estado, 'cozido', ing);
    k.coelho.mao = null;
    espaco(k, nada);
    assert.equal(fogao.em, null);
  }
});

test('as estações de fogo que o servidor conhece (ESTACOES_DE_FOGO) são as da planta', () => {
  const k = novaCozinha();
  const daPlanta = Object.fromEntries(k.estacoes.filter((e) => e.tipo === 'fogao' || e.tipo === 'forno').map((e) => [e.id, e.tipo]));
  assert.deepEqual(daPlanta, { ...ESTACOES_DE_FOGO });
  // todo ingrediente tem caixote
  for (const ing of INGREDIENTES) assert.ok(k.estacoes.some((e) => e.tipo === 'caixote' && e.ing === ing), ing);
});

test('o fogo avisa o servidor (pus, tirei) e mede pelo relógio, mesmo sem passo (a janela sem foco)', () => {
  const k = novaCozinha();
  const nada = () => false;
  const fogao = k.estacoes.find((e) => e.tipo === 'fogao')!;
  const ir = (id: number) => {
    irPara(k, id, 'espaco');
    const ev: Evento[] = [];
    for (let n = 0; n < 400 && k.coelho.destino; n++) ev.push(...passo(k, null, DT, nada));
    return ev;
  };
  k.coelho.mao = { tipo: 'item', item: { ing: 'bacon', estado: 'cru' } };
  const pus = ir(fogao.id).find((e) => e.tipo === 'fogo');
  assert.deepEqual(pus, { tipo: 'fogo', estacao: fogao.id, pos: { ing: 'bacon', estado: 'cru', com: undefined } });
  // a janela ficou sem foco: nenhum passo, mas o relógio andou; ao voltar, o bacon queimou
  const p = PONTO.bacon!;
  let ev = passo(k, null, DT, nada, k.relogio + p.pronto);
  assert.ok(ev.some((e) => e.tipo === 'pronto'));
  ev = passo(k, null, DT, nada, k.relogio + (p.queima - p.pronto) * 0.7);
  assert.ok(ev.some((e) => e.tipo === 'queimando'));
  const pr = progresso(fogao);
  assert.equal(pr?.tipo === 'fogo' && pr.fase, 'queimando');
  // (só até queimar: mais INCENDIO_MS que isso, ele pega fogo, e aí só o extintor tira)
  ev = passo(k, null, DT, nada, k.relogio + (p.queima - p.pronto) * 0.5);
  assert.ok(ev.some((e) => e.tipo === 'queimou'));
  // tirar com a mão vazia avisa o servidor
  k.coelho.mao = null;
  const tirou = espaco(k, nada);
  assert.ok(tirou.some((e) => e.tipo === 'fogo' && e.pos === null));
  assert.equal((k.coelho.mao as { item: Item } | null)?.item.estado, 'queimado');
});

// ---------------------------------------------------------------------------------------------------------------------
// 19/11/2026: as plantas, a pia e o fogo esquecido
// ---------------------------------------------------------------------------------------------------------------------

for (const planta of PLANTAS_DA_COZINHA) {
  test(`a planta ${planta}: as estações de fogo batem com as do servidor, e todo ingrediente tem caixote`, () => {
    const k = novaCozinha(planta);
    const daPlanta = Object.fromEntries(k.estacoes.filter((e) => e.tipo === 'fogao' || e.tipo === 'forno').map((e) => [e.id, e.tipo]));
    assert.deepEqual(daPlanta, { ...FOGO_DAS_PLANTAS[planta] });
    for (const ing of INGREDIENTES) assert.ok(k.estacoes.some((e) => e.tipo === 'caixote' && e.ing === ing), `${planta}: ${ing}`);
    for (const tipo of ['pia', 'extintor', 'lixeira', 'pratos', 'entrega'] as const) assert.equal(k.estacoes.filter((e) => e.tipo === tipo).length, 1, `${planta}: ${tipo}`);
    for (const s of SABORES) assert.ok(k.estacoes.some((e) => e.tipo === 'sorvete' && e.sabor === s));
    // nenhuma casa repetida
    assert.equal(new Set(k.estacoes.map((e) => `${e.c},${e.l}`)).size, k.estacoes.length);
  });

  test(`a planta ${planta}: o piloto faz uma fila de pedidos, lavando os pratos que voltam`, () => {
    const k = novaCozinha(planta);
    const pedidos: IdDaReceita[] = ['x-salada', 'pizza-calabresa', 'sushi', 'prato-feito', 'sorvete-morango', 'cafe-da-manha', 'bife-com-arroz', 'hamburguer'];
    for (const id of pedidos) {
      const { entregue, t } = cozinhar(id, k, 90);
      assert.ok(entregue, `${planta}: ${id}`);
      assert.ok(t < 75, `${planta}: ${id} levou ${t.toFixed(1)} s`);
    }
    // nunca entra na bancada do meio
    for (const i of k.ilhas) assert.ok(!(k.coelho.x > i.x0 && k.coelho.x < i.x1 && k.coelho.z > i.z0 && k.coelho.z < i.z1));
  });
}

test('os pratos acabam e voltam sujos da janela; a pia lava um de cada vez', () => {
  const k = novaCozinha('toca');
  const nada = () => true;
  const pratos = k.estacoes.find((e) => e.tipo === 'pratos')!;
  const entrega = k.estacoes.find((e) => e.tipo === 'entrega')!;
  const pia = k.estacoes.find((e) => e.tipo === 'pia')!;
  const ir = (id: number, acao: 'espaco' | 'usar' = 'espaco') => {
    irPara(k, id, acao);
    const ev: Evento[] = [];
    for (let n = 0; n < 400 && k.coelho.destino; n++) ev.push(...passo(k, null, DT, nada));
    return ev;
  };
  for (let n = 0; n < PRATOS_INICIAIS; n++) {
    ir(pratos.id);
    k.coelho.mao = { tipo: 'prato', itens: [{ ing: 'alface', estado: 'picado' }] };
    assert.ok(ir(entrega.id).some((e) => e.tipo === 'entregue'));
  }
  assert.equal(k.pratos, 0);
  ir(pratos.id);
  assert.equal(k.coelho.mao, null, 'sem prato limpo, nada sai da pilha');
  // os sujos chegam à pia depois de VOLTA_DO_PRATO_MS
  let ev: Evento[] = [];
  for (let ms = 0; ms < VOLTA_DO_PRATO_MS + 100; ms += 1000 * DT) ev = ev.concat(passo(k, null, DT, nada));
  assert.equal(pia.sujos, PRATOS_INICIAIS);
  assert.ok(ev.some((e) => e.tipo === 'sujo'));
  ir(pia.id, 'usar');
  for (let ms = 0; ms < TEMPO_DE_LAVAR_MS + 100; ms += 1000 * DT) passo(k, null, DT, nada);
  assert.equal(k.pratos, 1);
  assert.equal(pia.sujos, PRATOS_INICIAIS - 1);
});

test('a frigideira esquecida pega fogo; só o extintor apaga, e avisa o servidor', () => {
  const k = novaCozinha('toca');
  const nada = () => false;
  const fogao = k.estacoes.find((e) => e.tipo === 'fogao')!;
  const extintor = k.estacoes.find((e) => e.tipo === 'extintor')!;
  const ir = (id: number) => {
    irPara(k, id, 'espaco');
    const ev: Evento[] = [];
    for (let n = 0; n < 400 && k.coelho.destino; n++) ev.push(...passo(k, null, DT, nada));
    return ev;
  };
  k.coelho.mao = { tipo: 'item', item: { ing: 'ovo', estado: 'cru' } };
  ir(fogao.id);
  const ev = passo(k, null, DT, nada, k.relogio + PONTO.ovo!.queima + INCENDIO_MS + 10);
  assert.ok(ev.some((e) => e.tipo === 'incendio'));
  assert.ok(fogao.chamas);
  // de mão vazia, nada sai
  assert.equal(espaco(k, nada)[0].tipo, 'nada');
  assert.equal(fogao.em?.tipo, 'item');
  // o extintor não vai para o balcão: só sai do lugar dele e volta para ele
  ir(extintor.id);
  assert.equal(k.coelho.mao?.tipo, 'extintor');
  const apagou = ir(fogao.id);
  assert.ok(apagou.some((e) => e.tipo === 'apagou'));
  assert.ok(apagou.some((e) => e.tipo === 'fogo' && e.extintor && e.estacao === fogao.id));
  assert.equal(fogao.em, null);
  assert.ok(!fogao.chamas);
  // o piloto devolve o extintor ao lugar
  pilotar(k, 'salada');
  for (let n = 0; n < 400 && k.coelho.destino; n++) passo(k, null, DT, nada);
  assert.equal(k.coelho.mao?.tipo !== 'extintor', true);
});

test('o piloto apaga o fogo antes de seguir', () => {
  const k = novaCozinha('andares');
  const fogao = k.estacoes.find((e) => e.tipo === 'fogao')!;
  fogao.em = { tipo: 'item', item: { ing: 'carne', estado: 'cru' } };
  fogao.desde = k.relogio - PONTO.carne!.queima - INCENDIO_MS - 50;
  const { entregue } = cozinhar('x-salada', k, 120);
  assert.ok(entregue);
  assert.ok(!fogao.chamas);
});
