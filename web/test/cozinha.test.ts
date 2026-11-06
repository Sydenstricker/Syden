import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alvo, espaco, irPara, novaCozinha, passo, progresso, usar, type Cozinha, type Evento } from '../src/cozinha/cozinha';
import { pilotar } from '../src/cozinha/piloto';
import { ESTACOES_DE_FOGO, IDS_DAS_RECEITAS, INGREDIENTES, PONTO, confere, type IdDaReceita, type Item } from '../src/cozinha/receitas';

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
  ev = passo(k, null, DT, nada, k.relogio + p.queima);
  assert.ok(ev.some((e) => e.tipo === 'queimou'));
  // tirar com a mão vazia avisa o servidor
  k.coelho.mao = null;
  const tirou = espaco(k, nada);
  assert.ok(tirou.some((e) => e.tipo === 'fogo' && e.pos === null));
  assert.equal((k.coelho.mao as { item: Item } | null)?.item.estado, 'queimado');
});
