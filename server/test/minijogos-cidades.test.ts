/**
 * Cidades à venda (minijogo-cidades.ts): por turnos, o servidor sorteia os dados e decide as casas; a casa age quando a peça
 * chega; compra, leilão, aluguel, construção, hipoteca, troca, a falência que o Syden resolve sozinho, quem sai, e o fim pelas
 * rodadas ou por sobrar um. O relógio e o sorteio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-cidades.js');
const { criarCidades, CASAS, DINHEIRO_INICIAL, TEMPO_DA_VEZ, TEMPO_DA_COMPRA, TEMPO_APOS_LANCE, TEMPO_DA_TROCA, SALARIO, MULTIPLICADOR } = mod;
after(fechar);

let agora = 5_000_000;
/** O sorteio: 0,5 dá os dados 4 e 4 (oito casas) e deixa a ordem como entrou. */
let sorte = 0.5;
const aleatorio = () => sorte;

const ana = await criarConta(app, 'ana-cid');
const bia = await criarConta(app, 'bia-cid');
const caio = await criarConta(app, 'caio-cid');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma das cidades' })).json() as { id: number };

type Jogador = { userId: number; pos: number; dinheiro: number; patrimonio: number; falido: boolean; parado: number };
type Estado = {
  fase: string;
  rodada: number;
  vez: number | null;
  jogadores: Jogador[];
  posses: { casa: number; dono: number; predios: number; hipotecada: boolean; aluguel: number }[];
  ultimo: { dados: [number, number] | null; caminho: number[] } | null;
  leilao: { casa: number; lance: number; lider: number | null } | null;
  troca: { de: number; para: number } | null;
  historico: { tipo: string; [k: string]: unknown }[];
  classificacao: { userId: number; posicao: number | null; patrimonio: number; falido: boolean }[];
  interrompida: boolean;
};

function comecar(opcoes: Parameters<typeof criarCidades>[0] = {}, inicio = [anaId, biaId], corpo: Record<string, unknown> = {}) {
  const sala = { ids: [...inicio] };
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  let completa: boolean | undefined;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (c?: boolean) => {
      terminou = true;
      completa = c;
    },
    naSala: () => sala.ids,
    nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
    comunidade: comunidade.id,
  };
  const jogo = criarCidades({ agora: () => agora, aleatorio, ...opcoes }).comecar(ctx, { naSala: inicio, criadaPor: inicio[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    sala,
    relogio,
    terminou: () => terminou,
    completa: () => completa,
    estado: (quem = anaId) => jogo.publico(quem) as unknown as Estado,
    /** Dispara o relógio marcado, andando o tempo junto. */
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
  };
}

const de = (e: Estado, id: number) => e.jogadores.find((j) => j.userId === id)!;
const posse = (e: Estado, casa: number) => e.posses.find((p) => p.casa === casa);

test('o tabuleiro: 32 casas, a largada na primeira, 20 cidades em 7 grupos e 4 transportes', () => {
  assert.equal(CASAS.length, 32);
  assert.equal(CASAS[0].tipo, 'largada');
  const cidades = CASAS.filter((c) => c.tipo === 'cidade');
  assert.equal(cidades.length, 20);
  assert.deepEqual([...new Set(cidades.map((c) => c.grupo))].sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(CASAS.filter((c) => c.tipo === 'transporte').length, 4);
  // os preços sobem com a volta, e cada cidade tem aluguel e prédio
  for (const c of cidades) assert.ok(c.preco! > 0 && c.aluguel! > 0 && c.custo! > 0);
  const precos = cidades.map((c) => c.preco!);
  assert.deepEqual(precos, [...precos].sort((a, b) => a - b));
});

test('só quem está na vez joga os dados, quem sorteia é o servidor, e a casa só age quando a peça chega', () => {
  sorte = 0.5;
  const m = comecar();
  assert.equal(m.estado().fase, 'vez');
  assert.equal(m.estado().vez, anaId);
  assert.equal(m.jogo.acao(biaId, { tipo: 'dados' }), 'Espere a sua vez.');
  assert.equal(m.jogo.acao(caioId, { tipo: 'dados' }), 'Você está assistindo esta partida.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'dados', valor: 12 }), null);
  const e = m.estado();
  assert.equal(e.fase, 'andando');
  assert.deepEqual(e.ultimo!.dados, [4, 4]);
  assert.equal(de(e, anaId).pos, 8);
  assert.equal(CASAS[8].nome, 'Belém');
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: true }), 'A partida não está em andamento.', 'antes de a peça chegar, nada');
  m.andar();
  assert.equal(m.estado().fase, 'compra');
  assert.equal(m.relogio[0].ms, TEMPO_DA_COMPRA);
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: true }), null);
  const depois = m.estado();
  assert.equal(posse(depois, 8)?.dono, anaId);
  assert.equal(de(depois, anaId).dinheiro, DINHEIRO_INICIAL - CASAS[8].preco!);
  assert.equal(de(depois, anaId).patrimonio, DINHEIRO_INICIAL, 'comprar troca dinheiro por cidade: o patrimônio fica');
  assert.equal(depois.fase, 'acoes');
  assert.equal(m.jogo.acao(anaId, { tipo: 'terminar' }), null);
  assert.equal(m.estado().vez, biaId);
});

test('quem para na cidade de outro paga o aluguel, e o grupo inteiro dobra', () => {
  sorte = 0.5;
  const m = comecar({ posses: [[8, anaId]] });
  m.andar(); // a vez da Ana: os dados saem sozinhos
  m.andar(); // chegou na própria cidade
  assert.equal(m.estado().fase, 'acoes');
  assert.equal(de(m.estado(), anaId).dinheiro, DINHEIRO_INICIAL, 'na própria cidade, nada');
  m.andar(); // as ações acabam sozinhas
  m.jogo.acao(biaId, { tipo: 'dados' });
  m.andar();
  const e = m.estado();
  const aluguel = CASAS[8].aluguel!;
  assert.equal(de(e, biaId).dinheiro, DINHEIRO_INICIAL - aluguel);
  assert.equal(de(e, anaId).dinheiro, DINHEIRO_INICIAL + aluguel);
  assert.ok(e.historico.some((o) => o.tipo === 'aluguel' && o.valor === aluguel));

  const g = comecar({ posses: [[6, anaId], [7, anaId], [8, anaId]] });
  assert.equal(posse(g.estado(), 8)?.aluguel, CASAS[8].aluguel! * 2);
});

test('quem não compra põe a cidade em leilão: o maior lance leva, e sem lance ela fica com o banco', () => {
  sorte = 0.5;
  const m = comecar();
  m.andar();
  m.andar();
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: false }), null);
  assert.equal(m.estado().fase, 'leilao');
  assert.equal(m.jogo.acao(biaId, { tipo: 'lance', valor: 5 }), 'O lance precisa ser maior que o atual.');
  assert.equal(m.jogo.acao(biaId, { tipo: 'lance', valor: 10 }), null);
  assert.equal(m.relogio[0].ms, TEMPO_APOS_LANCE, 'cada lance devolve o prazo');
  assert.equal(m.jogo.acao(anaId, { tipo: 'lance', valor: 15 }), 'O lance precisa ser maior que o atual.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'lance', valor: 60 }), null);
  assert.equal(m.jogo.acao(biaId, { tipo: 'lance', valor: 999_999 }), 'Dinheiro insuficiente.');
  m.andar();
  const e = m.estado();
  assert.equal(posse(e, 8)?.dono, anaId);
  assert.equal(de(e, anaId).dinheiro, DINHEIRO_INICIAL - 60);
  assert.equal(de(e, biaId).dinheiro, DINHEIRO_INICIAL);
  assert.equal(e.fase, 'acoes');

  // a compra sem resposta vai a leilão, e o leilão sem lance acaba sem dono
  const n = comecar();
  n.andar();
  n.andar();
  n.andar();
  assert.equal(n.estado().fase, 'leilao');
  n.andar();
  assert.equal(posse(n.estado(), 8), undefined);
  assert.equal(de(n.estado(), anaId).dinheiro, DINHEIRO_INICIAL);
});

test('construir pede o grupo inteiro; o prédio multiplica o aluguel; hipotecar pede o grupo sem prédios', () => {
  sorte = 0.5;
  const m = comecar({ posses: [[6, anaId], [7, anaId], [8, anaId], [1, anaId]] });
  m.andar();
  m.andar(); // a Ana, na própria Belém: as ações
  assert.equal(m.jogo.acao(anaId, { tipo: 'construir', casa: 1 }), 'Para construir, é preciso ter todas as cidades do grupo.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'construir', casa: 5 }), 'Essa cidade não é sua.');
  assert.equal(m.jogo.acao(biaId, { tipo: 'construir', casa: 8 }), 'Espere a sua vez.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'construir', casa: 8 }), null);
  assert.equal(m.jogo.acao(anaId, { tipo: 'construir', casa: 8 }), null);
  let e = m.estado();
  assert.equal(posse(e, 8)?.predios, 2);
  assert.equal(posse(e, 8)?.aluguel, CASAS[8].aluguel! * MULTIPLICADOR[2]);
  assert.equal(de(e, anaId).dinheiro, DINHEIRO_INICIAL - 2 * CASAS[8].custo!);
  assert.equal(m.jogo.acao(anaId, { tipo: 'hipotecar', casa: 6 }), 'Venda os prédios do grupo antes de hipotecar.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'vender', casa: 8 }), null);
  assert.equal(m.jogo.acao(anaId, { tipo: 'vender', casa: 8 }), null);
  assert.equal(de(m.estado(), anaId).dinheiro, DINHEIRO_INICIAL - CASAS[8].custo!, 'o prédio vendido volta pela metade');
  assert.equal(m.jogo.acao(anaId, { tipo: 'hipotecar', casa: 6 }), null);
  e = m.estado();
  assert.equal(posse(e, 6)?.hipotecada, true);
  assert.equal(posse(e, 6)?.aluguel, 0, 'hipotecada não cobra');
  assert.equal(m.jogo.acao(anaId, { tipo: 'construir', casa: 8 }), 'Resgate as cidades hipotecadas do grupo antes de construir.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'resgatar', casa: 6 }), null);
  assert.equal(de(m.estado(), anaId).dinheiro, DINHEIRO_INICIAL - CASAS[8].custo! + CASAS[6].preco! / 2 - Math.ceil((CASAS[6].preco! / 2) * 1.1));
});

test('a troca: quem está na vez propõe, a outra pessoa aceita ou recusa, e sem resposta é recusada', () => {
  sorte = 0.5;
  const m = comecar({ posses: [[1, anaId], [3, biaId]] });
  m.andar();
  m.andar();
  m.andar(); // ninguém comprou Belém: leilão
  m.andar(); // sem lance
  assert.equal(m.estado().fase, 'acoes');
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId }), 'A troca está vazia.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId, darCasas: [3] }), 'Essa cidade não é de quem a troca diz.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: anaId, darCasas: [1] }), 'Escolha alguém que ainda está no jogo.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId, pedirCasas: [3], darDinheiro: 50 }), null);
  assert.equal(m.estado().fase, 'troca');
  assert.equal(m.relogio[0].ms, TEMPO_DA_TROCA);
  assert.equal(m.jogo.acao(anaId, { tipo: 'responder', sim: true }), 'Essa troca não é com você.');
  assert.equal(m.jogo.acao(biaId, { tipo: 'responder', sim: true }), null);
  let e = m.estado();
  assert.equal(posse(e, 3)?.dono, anaId);
  assert.equal(de(e, anaId).dinheiro, DINHEIRO_INICIAL - 50);
  assert.equal(de(e, biaId).dinheiro, DINHEIRO_INICIAL + 50);
  assert.equal(e.fase, 'acoes');
  // agora a Ana tem o grupo 0 inteiro
  assert.equal(m.jogo.acao(anaId, { tipo: 'construir', casa: 1 }), null);
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId, darCasas: [3] }), 'Venda os prédios do grupo antes de trocar.');
  // a troca sem resposta: recusada
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId, pedirDinheiro: 10 }), null);
  m.andar();
  e = m.estado();
  assert.equal(e.fase, 'acoes');
  assert.ok(e.historico.some((o) => o.tipo === 'troca' && o.aceita === false));
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId, pedirDinheiro: 10 }), null);
  assert.equal(m.jogo.acao(biaId, { tipo: 'responder', sim: false }), null);
  assert.equal(m.jogo.acao(anaId, { tipo: 'propor', para: biaId, pedirDinheiro: 10 }), 'Chega de trocas nesta vez.');
});

test('as notícias: a carta tirada age, e a que move leva a peça (o engarrafamento faz perder a próxima vez)', () => {
  // com 0, os dados dão 1 e 1 (a casa 2, uma notícia), e a ordem se inverte
  sorte = 0;
  const m = comecar({ cartas: ['quadrilha', 'chuva'] });
  const primeira = m.estado().vez!;
  const segunda = primeira === anaId ? biaId : anaId;
  m.andar();
  m.andar();
  assert.equal(CASAS[2].tipo, 'noticia');
  assert.equal(de(m.estado(), primeira).dinheiro, DINHEIRO_INICIAL + 100);
  m.andar(); // as ações acabam
  m.andar(); // a segunda: os dados
  m.andar(); // chegou na notícia: a chuva
  let e = m.estado();
  assert.equal(e.fase, 'andando');
  assert.deepEqual(e.ultimo!.caminho, [2, 9]);
  m.andar();
  e = m.estado();
  assert.equal(de(e, segunda).pos, 9);
  assert.equal(de(e, segunda).parado, 1);
  assert.equal(de(e, segunda).dinheiro, DINHEIRO_INICIAL, 'sem passar pela largada, sem salário');
  m.andar(); // as ações acabam: a primeira joga de novo
  assert.equal(m.estado().vez, primeira);
  m.andar();
  m.andar(); // a casa 4, o pedágio
  m.andar(); // as ações acabam: a segunda perde a vez
  e = m.estado();
  assert.equal(e.vez, primeira);
  assert.equal(de(e, segunda).parado, 0);
  assert.ok(e.historico.some((o) => o.tipo === 'perdeu-vez' && o.userId === segunda));
});

test('quem não pode pagar: o Syden vende os prédios e hipoteca; não cobrindo, a pessoa fale e o que tinha vai ao credor', async () => {
  sorte = 0.5;
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  // A Bia tem Macapá e pouco dinheiro; a Ana tem o grupo de Belém com 4 prédios
  const m = comecar({ dinheiroInicial: 30, posses: [[6, anaId, 4], [7, anaId, 4], [8, anaId, 4], [3, biaId]] });
  m.andar();
  m.andar();
  m.andar(); // a Ana não faz nada
  m.andar();
  m.andar(); // a Bia chega a Belém: deve muito mais do que tem
  const e = m.estado();
  assert.equal(de(e, biaId).falido, true);
  assert.equal(posse(e, 3)?.dono, anaId, 'Macapá vai para a credora');
  assert.equal(posse(e, 3)?.hipotecada, true, 'hipotecada para tentar pagar');
  assert.equal(e.fase, 'fim', 'sobrou uma: acabou');
  assert.equal(m.completa(), true);
  assert.equal(e.classificacao[0].userId, anaId);
  assert.equal(e.classificacao[0].posicao, 1);
  assert.equal(e.classificacao[1].falido, true);
  const trofeus = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number }[];
  assert.equal(trofeus.length, antes + 1);
  assert.equal(trofeus.at(-1)?.pista ?? trofeus[0].pista, 'cidades');
});

test('quem sai é pulado; com menos de 2 na sala, a partida acaba sem troféu', () => {
  sorte = 0.5;
  const m = comecar({}, [anaId, biaId, caioId]);
  assert.equal(m.relogio[0].ms, TEMPO_DA_VEZ);
  const [, segunda, terceira] = m.estado().jogadores.map((j) => j.userId);
  m.sala.ids = [anaId, terceira];
  m.andar();
  m.andar();
  m.andar(); // compra sem resposta: leilão
  m.andar(); // sem lance
  m.andar(); // as ações acabam
  assert.equal(m.estado().vez, terceira, 'a vez de quem saiu foi pulada');
  void segunda;
  m.sala.ids = [anaId];
  m.jogo.conferir!();
  const e = m.estado();
  assert.equal(e.fase, 'fim');
  assert.equal(e.interrompida, true);
  assert.equal(m.completa(), false);
  assert.ok(e.classificacao.every((l) => l.posicao === null));
});

test('com rodadas fixas, a partida acaba sozinha e ganha o maior patrimônio', () => {
  sorte = 0.5;
  const m = comecar({}, [anaId, biaId], { modo: 'rodadas', rodadas: 10 });
  for (let k = 0; k < 2000 && !m.terminou(); k++) m.andar();
  const e = m.estado();
  assert.equal(e.fase, 'fim');
  assert.equal(e.rodada, 10);
  assert.equal(m.completa(), true);
  const [a, b] = e.classificacao;
  assert.ok(a.patrimonio >= b.patrimonio);
  // a volta tem 32 casas e cada um anda 8: em 10 rodadas, passou pela largada 2 vezes
  assert.ok(e.historico.some((o) => o.tipo === 'salario' && o.valor === SALARIO) || e.jogadores.every((j) => j.patrimonio >= DINHEIRO_INICIAL));
});
