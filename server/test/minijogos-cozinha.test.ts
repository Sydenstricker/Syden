/**
 * A Cozinha da toca (minijogo-cozinha.ts): cada um na própria cozinha, os mesmos pedidos para todos, e o servidor confere o
 * prato entregue contra a receita (cozinha-receitas.ts, a mesma conta da tela). O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarCozinha, PREPARO_MS, INTERVALO_MIN_MS } = await import('../src/minijogo-cozinha.js');
const receitas = await import('../src/cozinha-receitas.js');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-cozinha');
const bia = await criarConta(app, 'bia-cozinha');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

type IdDaReceita = import('../src/cozinha-receitas.js').IdDaReceita;
interface Estado {
  fase: string;
  meu: { fila: { indice: number; receita: IdDaReceita }[]; pratos: number; pontos: number } | null;
  placar: { userId: number; pratos: number; pontos: number; posicao: number | null }[];
  solo: boolean;
}

function comecar(naSala: number[], { comunidade = 0, solo = false } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  let sala = naSala;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => sala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
    solo,
  };
  let semente = 11;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const jogo = criarCozinha({ agora: () => agora, aleatorio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    estado: (id: number) => jogo.publico(id) as unknown as Estado,
    terminou: () => terminou,
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
    sair(id: number) {
      sala = sala.filter((x) => x !== id);
    },
  };
}

/** O prato certo para a receita. */
const pratoDe = (id: IdDaReceita) => receitas.RECEITAS[id].itens.map(receitas.itemDaChave);

/** O fogão e o forno da planta (as estações de fogo que o servidor conhece). */
const FOGAO = Number(Object.entries(receitas.ESTACOES_DE_FOGO).find(([, t]) => t === 'fogao')![0]);
const FORNO = Number(Object.entries(receitas.ESTACOES_DE_FOGO).find(([, t]) => t === 'forno')![0]);

/** Põe no fogo como a tela poria (o item cru, ou a massa aberta), espera `ms` no relógio do servidor e tira. */
function cozinhar(p: ReturnType<typeof comecar>, quem: number, cozido: import('../src/cozinha-receitas.js').Item, ms?: number) {
  const ponto = receitas.PONTO[cozido.ing]!;
  const entra = { ...cozido, estado: cozido.ing === 'massa' ? 'picado' : 'cru' };
  const estacao = cozido.ing === 'massa' ? FORNO : FOGAO;
  const pus = p.jogo.acao(quem, { tipo: 'fogo', estacao, item: entra });
  agora += ms ?? (ponto.pronto + ponto.queima) / 2;
  const tirou = p.jogo.acao(quem, { tipo: 'fogo', estacao, tirou: true });
  return { pus, tirou };
}

/** Entrega o primeiro pedido da fila de `quem`, certo (cozinhando no servidor o que a receita pede cozido). */
function entregarCerto(p: ReturnType<typeof comecar>, quem: number) {
  agora += INTERVALO_MIN_MS;
  const pedido = p.estado(quem).meu!.fila[0];
  for (const i of pratoDe(pedido.receita)) if (i.estado === 'cozido') assert.deepEqual(cozinhar(p, quem, i), { pus: null, tirou: null });
  return { pedido, erro: p.jogo.acao(quem, { tipo: 'entregar', pedido: pedido.indice, prato: pratoDe(pedido.receita) }) };
}

test('as duas cópias das receitas são iguais (a tela monta com a mesma conta que o servidor confere)', async () => {
  const { readFileSync } = await import('node:fs');
  const servidor = readFileSync(new URL('../src/cozinha-receitas.ts', import.meta.url));
  const site = readFileSync(new URL('../../web/src/cozinha/receitas.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/cozinha-receitas.ts e web/src/cozinha/receitas.ts mudaram separados: copie uma sobre a outra');
});

test('as receitas: o prato confere em qualquer ordem, e nem mais nem menos', () => {
  const r = receitas;
  assert.ok(r.confere('x-salada', [...pratoDe('x-salada')].reverse()));
  assert.ok(!r.confere('x-salada', pratoDe('x-burguer')));
  assert.ok(!r.confere('hamburguer', [...pratoDe('hamburguer'), { ing: 'queijo', estado: 'picado' }]));
  // a carne queimada não é a cozida
  assert.ok(!r.confere('hamburguer', [{ ing: 'pao', estado: 'cru' }, { ing: 'carne', estado: 'queimado' }]));
  // as coberturas da pizza, em qualquer ordem
  assert.ok(r.confere('pizza-calabresa', [{ ing: 'massa', estado: 'cozido', com: ['tomate', 'calabresa', 'queijo'] }]));
  assert.ok(!r.confere('pizza-calabresa', [{ ing: 'massa', estado: 'picado', com: ['tomate', 'calabresa', 'queijo'] }]));
  // os pratos do Food Kit: o peixe do sushi é picado, o do peixe com arroz é cozido; o ovo e a salsicha, do fogão
  assert.ok(r.confere('sushi', [{ ing: 'peixe', estado: 'picado' }, { ing: 'arroz', estado: 'cozido' }]));
  assert.ok(!r.confere('sushi', [{ ing: 'peixe', estado: 'cozido' }, { ing: 'arroz', estado: 'cozido' }]));
  assert.ok(!r.confere('sushi', [{ ing: 'peixe', estado: 'picado' }, { ing: 'arroz', estado: 'cru' }]));
  assert.ok(r.confere('cachorro-quente', [{ ing: 'salsicha', estado: 'cozido' }, { ing: 'pao', estado: 'cru' }]));
  assert.ok(!r.confere('cachorro-quente', [{ ing: 'salsicha', estado: 'queimado' }, { ing: 'pao', estado: 'cru' }]));
  assert.ok(r.confere('prato-feito', [...pratoDe('prato-feito')].reverse()));
  assert.ok(!r.confere('x-egg', pratoDe('x-burguer')));
  // tudo o que a receita pede o fogão, a tábua ou o forno sabem fazer
  for (const id of r.IDS_DAS_RECEITAS)
    for (const i of pratoDe(id)) {
      if (i.estado === 'picado') assert.ok(r.PICAVEIS.includes(i.ing), `${id}: ${i.ing} picado`);
      if (i.estado === 'cozido') assert.ok(r.DO_FOGAO.includes(i.ing) || i.ing === 'massa', `${id}: ${i.ing} cozido`);
      if (i.estado === 'cozido') assert.ok(r.PONTO[i.ing], `${id}: o ponto de ${i.ing}`);
    }
  // o que vem de fora é conferido
  assert.equal(r.normalizarPrato('x'), null);
  assert.equal(r.normalizarPrato([]), null);
  assert.equal(r.normalizarPrato([{ ing: 'veneno', estado: 'cru' }]), null);
  assert.equal(r.normalizarPrato([{ ing: 'massa', estado: 'cozido', com: ['tomate', 'tomate'] }]), null);
  assert.equal(r.normalizarPrato([{ ing: 'casquinha', estado: 'cru', com: ['queijo'] }]), null);
  assert.equal(r.normalizarPrato(Array.from({ length: 6 }, () => ({ ing: 'pao', estado: 'cru' }))), null);
  // toda receita tem um prato possível (as chaves voltam ao mesmo texto)
  for (const id of r.IDS_DAS_RECEITAS) {
    const prato = r.normalizarPrato(pratoDe(id));
    assert.ok(prato && r.confere(id, prato), id);
  }
  // a sequência começa pelos rápidos, e nunca três iguais seguidos
  const seq = r.sortearPedidos(Math.random, 300);
  assert.equal(seq.length, 300);
  for (const id of seq.slice(0, 2)) assert.ok(!id.startsWith('pizza') && !id.startsWith('x-'), id);
  for (let k = 2; k < seq.length; k++) assert.ok(!(seq[k] === seq[k - 1] && seq[k] === seq[k - 2]));
});

test('os mesmos pedidos para todos, cada um anda na fila no próprio ritmo', () => {
  const p = comecar([anaId, biaId]);
  assert.equal(p.estado(anaId).fase, 'preparando');
  // antes de valer, nada se entrega
  const cedo = p.estado(anaId).meu!.fila[0];
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: cedo.indice, prato: pratoDe(cedo.receita) }), 'Esta rodada já acabou.');
  p.andar();
  assert.equal(p.estado(anaId).fase, 'jogando');
  assert.deepEqual(p.estado(anaId).meu!.fila, p.estado(biaId).meu!.fila);
  const filaAntes = p.estado(anaId).meu!.fila;
  const { pedido, erro } = entregarCerto(p, anaId);
  assert.equal(erro, null);
  const depois = p.estado(anaId).meu!;
  assert.equal(depois.pratos, 1);
  assert.equal(depois.pontos, receitas.RECEITAS[pedido.receita].pontos);
  assert.ok(!depois.fila.some((f) => f.indice === pedido.indice));
  assert.equal(depois.fila.length, receitas.PEDIDOS_NA_FILA);
  assert.equal(depois.fila[depois.fila.length - 1].indice, receitas.PEDIDOS_NA_FILA);
  // a Bia continua com a fila de antes
  assert.deepEqual(p.estado(biaId).meu!.fila, filaAntes);
  assert.ok(PREPARO_MS > 0);
});

test('o servidor confere o prato, o pedido e o ritmo', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const fila = p.estado(anaId).meu!.fila;
  agora += INTERVALO_MIN_MS;
  // o prato de outra receita
  const outra = receitas.IDS_DAS_RECEITAS.find((id) => id !== fila[0].receita)!;
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: fila[0].indice, prato: pratoDe(outra) }), 'Este prato não é o pedido.');
  // um pedido que não está na fila (o da frente da sequência)
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: 50, prato: pratoDe(fila[0].receita) }), 'Este prato não é o pedido.');
  // lixo
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: fila[0].indice, prato: [{ ing: 'pao', estado: 'x' }] }), 'Este prato não é o pedido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'outra' }), 'Ação desconhecida.');
  // dois pratos de uma vez, não
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: fila[0].indice, prato: pratoDe(fila[0].receita) }), null);
  const seguinte = p.estado(anaId).meu!.fila[0];
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: seguinte.indice, prato: pratoDe(seguinte.receita) }), 'Este prato não é o pedido.');
  assert.equal(p.estado(anaId).meu!.pratos, 1);
  // quem não joga só assiste
  assert.equal(p.jogo.acao(999, { tipo: 'entregar', pedido: 0, prato: [] }), 'Você está assistindo esta partida.');
});

test('três minutos, mais pratos ganha, e o pódio vai para a estante com a turma', () => {
  const p = comecar([anaId, biaId], { comunidade: 1 });
  p.andar();
  for (let k = 0; k < 3; k++) assert.equal(entregarCerto(p, anaId).erro, null);
  assert.equal(entregarCerto(p, biaId).erro, null);
  p.andar(); // o fim dos 3 minutos
  assert.ok(p.terminou());
  assert.equal(p.estado(anaId).fase, 'fim');
  const placar = p.estado(anaId).placar;
  assert.equal(placar[0].userId, anaId);
  assert.equal(placar[0].posicao, 1);
  assert.equal(placar[1].posicao, 2);
  const trofeu = db.trofeusDe(anaId).find((t) => t.pista === 'cozinha')!;
  assert.equal(trofeu.posicao, 1);
  assert.equal(trofeu.pontos, 3);
  assert.equal(trofeu.rivais[0].userId, biaId);
  assert.equal(db.trofeusDe(biaId).find((t) => t.pista === 'cozinha')!.posicao, 2);
});

test('no Solo, sem troféu; e quem saiu da sala não sobe ao pódio', () => {
  const antes = db.trofeusDe(anaId).length;
  const s = comecar([anaId], { solo: true });
  assert.equal(s.estado(anaId).solo, true);
  s.andar();
  assert.equal(entregarCerto(s, anaId).erro, null);
  s.andar();
  assert.ok(s.terminou());
  assert.equal(db.trofeusDe(anaId).length, antes);

  // a Bia saiu: sobra só a Ana, e uma pessoa só não é turma
  const p = comecar([anaId, biaId], { comunidade: 1 });
  p.andar();
  assert.equal(entregarCerto(p, biaId).erro, null);
  p.sair(biaId);
  p.andar();
  const placar = p.estado(anaId).placar;
  assert.equal(placar.find((l) => l.userId === biaId)!.posicao, null);
  assert.equal(db.trofeusDe(anaId).length, antes);
});

test('o ponto é do servidor: pelo relógio dele, com a folga da rede, e o queimado não serve', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const carne = { ing: 'carne' as const, estado: 'cozido' as const };
  const pc = receitas.PONTO.carne!;
  const hamburguer = [{ ing: 'pao' as const, estado: 'cru' as const }, carne];
  const pedidoDe = (quem: number) => p.estado(quem).meu!.fila.find((f) => f.receita === 'hamburguer');
  // a fila precisa de um hambúrguer: troca o primeiro pedido pela conta (a sequência é sorteada), procurando um
  let pedido = pedidoDe(anaId);
  for (let n = 0; !pedido && n < 60; n++) {
    entregarCerto(p, anaId);
    pedido = pedidoDe(anaId);
  }
  assert.ok(pedido, 'nenhum hambúrguer na fila');
  agora += INTERVALO_MIN_MS;
  // sem ter passado pelo fogo do servidor, a carne "cozida" da tela não vale
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: pedido.indice, prato: hamburguer }), 'Este prato não é o pedido.');
  // tirada cedo demais (antes do ponto, além da folga): continua crua para o servidor
  cozinhar(p, anaId, carne, pc.pronto - receitas.FOLGA_DO_FOGO_MS - 100);
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: pedido.indice, prato: hamburguer }), 'Este prato não é o pedido.');
  // tirada depois de queimar (além da folga): queimada
  cozinhar(p, anaId, carne, pc.queima + receitas.FOLGA_DO_FOGO_MS + 100);
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: pedido.indice, prato: hamburguer }), 'Este prato não é o pedido.');
  // um pouco antes do ponto, dentro da folga (a rede atrasou o "pus"): vale
  cozinhar(p, anaId, carne, pc.pronto - receitas.FOLGA_DO_FOGO_MS + 50);
  const antes = p.estado(anaId).meu!.pratos;
  assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: pedido.indice, prato: hamburguer }), null);
  assert.equal(p.estado(anaId).meu!.pratos, antes + 1);
  // a ficha foi gasta: o mesmo prato de novo não passa sem cozinhar outra carne
  const outro = pedidoDe(anaId);
  if (outro) {
    agora += INTERVALO_MIN_MS;
    assert.equal(p.jogo.acao(anaId, { tipo: 'entregar', pedido: outro.indice, prato: hamburguer }), 'Este prato não é o pedido.');
  }
  // a ficha é de quem cozinhou: a Bia não usa a carne da Ana
  cozinhar(p, anaId, carne);
  const daBia = p.estado(biaId).meu!.fila[0];
  agora += INTERVALO_MIN_MS;
  const pratoDaBia = pratoDe(daBia.receita);
  if (pratoDaBia.some((i) => i.estado === 'cozido'))
    assert.equal(p.jogo.acao(biaId, { tipo: 'entregar', pedido: daBia.indice, prato: pratoDaBia }), 'Este prato não é o pedido.');
});

test('o fogo recusa o que não faz sentido: tirar antes de pôr, estação que não é de fogo, o que não vai ao fogo', () => {
  const p = comecar([anaId], { solo: true });
  p.andar();
  const carne = { ing: 'carne', estado: 'cru' };
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, tirou: true }), 'Lance inválido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: 0, item: carne }), 'Lance inválido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: 'x', item: carne }), 'Lance inválido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, item: { ing: 'alface', estado: 'cru' } }), 'Lance inválido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FORNO, item: carne }), 'Lance inválido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FORNO, item: { ing: 'massa', estado: 'cru' } }), 'Lance inválido.');
  // pôr "já cozida" sem a ficha dela, não
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, item: { ing: 'carne', estado: 'cozido' } }), 'Lance inválido.');
  // duas coisas na mesma panela, não
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, item: carne }), null);
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, item: carne }), 'Lance inválido.');
  // tirou no ponto, pôs de novo (gasta a ficha e continua do ponto), e passou: queimou, sem ficha
  agora += receitas.PONTO.carne!.pronto;
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, tirou: true }), null);
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, item: { ing: 'carne', estado: 'cozido' } }), null);
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO + 1, item: { ing: 'carne', estado: 'cozido' } }), 'Lance inválido.');
  agora += receitas.PONTO.carne!.queima;
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, tirou: true }), null);
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FOGAO, item: { ing: 'carne', estado: 'cozido' } }), 'Lance inválido.');
  // o mesmo na pizza: a massa aberta com as coberturas, no forno, e a ficha guarda as coberturas
  const pizza = { ing: 'massa' as const, estado: 'cozido' as const, com: ['queijo', 'tomate'] };
  assert.deepEqual(cozinhar(p, anaId, pizza), { pus: null, tirou: null });
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FORNO, item: { ...pizza, com: ['calabresa', 'queijo', 'tomate'] } }), 'Lance inválido.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fogo', estacao: FORNO, item: pizza }), null);
  // quem assiste não cozinha
  assert.equal(p.jogo.acao(999, { tipo: 'fogo', estacao: FOGAO, item: carne }), 'Você está assistindo esta partida.');
});

test('as receitas novas do fogo: café da manhã, x-bacon e os bifes', () => {
  const r = receitas;
  assert.ok(r.confere('cafe-da-manha', [{ ing: 'bacon', estado: 'cozido' }, { ing: 'ovo', estado: 'cozido' }]));
  assert.ok(!r.confere('cafe-da-manha', [{ ing: 'bacon', estado: 'queimado' }, { ing: 'ovo', estado: 'cozido' }]));
  assert.ok(!r.confere('bife-com-arroz', [{ ing: 'bife', estado: 'cru' }, { ing: 'arroz', estado: 'cozido' }]));
  assert.ok(r.confere('x-bacon', [...pratoDe('x-bacon')].reverse()));
  for (const ing of ['bacon', 'bife'] as const) {
    const p = r.PONTO[ing]!;
    assert.equal(r.estadoNoFogo({ ing, estado: 'cru' }, p.pronto - 1), 'cru');
    assert.equal(r.estadoNoFogo({ ing, estado: 'cru' }, p.pronto), 'cozido');
    assert.equal(r.estadoNoFogo({ ing, estado: 'cru' }, p.queima), 'queimado');
    assert.equal(r.estadoNoFogo({ ing, estado: 'cru' }, p.queima, r.FOLGA_DO_FOGO_MS), 'cozido');
  }
  // a massa aberta continua aberta até o ponto
  assert.equal(r.estadoNoFogo({ ing: 'massa', estado: 'picado', com: ['queijo'] }, 100), 'picado');
});
