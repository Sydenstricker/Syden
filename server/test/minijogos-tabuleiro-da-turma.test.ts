/**
 * O Tabuleiro da turma (minijogo-tabuleiro-da-turma.ts): por turnos, o servidor sorteia o dado e decide as casas; só quem
 * está na vez joga; quem fica parado tem a vez jogada por ele; quem sai é pulado; e o microjogo entre as rodadas é a rodada da
 * Festa, com a mesma conferência. O relógio e o sorteio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-tabuleiro-da-turma.js');
const { criarTabuleiro, CASAS, TEMPO_DA_VEZ, PRECO_DA_DOURADA, CENOURAS_INICIAIS } = mod;
const { PREPARO_MS } = await import('../src/minijogo-festa.js');
after(fechar);

let agora = 9_000_000;
/** O sorteio: 0,5 dá o dado 4 e deixa a ordem como entrou. */
let sorte = 0.5;
const aleatorio = () => sorte;

const ana = await criarConta(app, 'ana-tab');
const bia = await criarConta(app, 'bia-tab');
const caio = await criarConta(app, 'caio-tab');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do tabuleiro' })).json() as { id: number };

type Participante = { userId: number; pos: number; cenouras: number; douradas: number };
type Estado = {
  fase: string;
  rodada: number;
  vez: number | null;
  dourada: number;
  participantes: Participante[];
  ultimo: {
    dado: number;
    caminho: number[];
    efeito: { tipo: string; valor?: number } | null;
    comprou: boolean;
    antes: { dourada: number; pecas: Participante[] };
  } | null;
  mini: { fase: string; microjogo: string; linhas: { userId: number; pontos: number }[] | null } | null;
  classificacao: { userId: number; posicao: number | null; douradas: number }[];
  interrompida: boolean;
};

function comecar(opcoes: Parameters<typeof criarTabuleiro>[0] = {}, inicio = [anaId, biaId], corpo: Record<string, unknown> = {}) {
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
  const jogo = criarTabuleiro({ agora: () => agora, aleatorio, ...opcoes }).comecar(ctx, { naSala: inicio, criadaPor: inicio[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    sala,
    relogio,
    terminou: () => terminou,
    /** O que a partida disse ao terminar: completa (true/omitido) ou interrompida (false). */
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

const de = (e: Estado, id: number) => e.participantes.find((p) => p.userId === id)!;

test('o tabuleiro: 30 casas, a largada na primeira', () => {
  assert.equal(CASAS.length, 30);
  assert.equal(CASAS[0], 'i');
  assert.ok(CASAS.slice(1).every((c) => c === '+' || c === '-' || c === '?'));
});

test('só quem está na vez joga o dado, e quem sorteia é o servidor', () => {
  sorte = 0.5;
  const m = comecar();
  assert.equal(m.estado().fase, 'vez');
  assert.equal(m.estado().vez, anaId);
  assert.equal(m.jogo.acao(biaId, { tipo: 'dado' }), 'Espere a sua vez.');
  assert.equal(m.jogo.acao(caioId, { tipo: 'dado' }), 'Você está assistindo esta partida.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: true }), 'A partida não está em andamento.', 'sem loja, nada de comprar');
  // o dado que o site diz não conta: o servidor sorteia
  assert.equal(m.jogo.acao(anaId, { tipo: 'dado', valor: 6 }), null);
  const e = m.estado();
  assert.equal(e.fase, 'andando');
  assert.equal(e.ultimo!.dado, 4);
  assert.deepEqual(e.ultimo!.caminho, [0, 1, 2, 3, 4]);
  assert.equal(de(e, anaId).pos, 4);
  assert.equal(CASAS[4], '+');
  assert.equal(de(e, anaId).cenouras, CENOURAS_INICIAIS + 3);
  assert.equal(m.jogo.acao(anaId, { tipo: 'dado' }), 'A partida não está em andamento.', 'um dado por vez');
  m.andar(); // o andar na tela acaba
  assert.equal(m.estado().vez, biaId);
});

test('quem fica parado tem o dado jogado por ele, e quem saiu da sala é pulado', () => {
  sorte = 0.5;
  const m = comecar({}, [anaId, biaId, caioId]);
  assert.equal(m.relogio[0].ms, TEMPO_DA_VEZ);
  m.andar(); // a Ana não jogou: o dado sai sozinho
  assert.equal(m.estado().fase, 'andando');
  assert.equal(de(m.estado(), anaId).pos, 4);
  // a ordem da vez é sorteada: a segunda pessoa sai
  const [, segunda, terceira] = m.estado().participantes.map((p) => p.userId);
  m.sala.ids = [anaId, terceira];
  m.andar();
  assert.equal(m.estado().vez, terceira, 'a vez de quem saiu foi pulada');
  // a terceira sai no meio da vez (e a segunda volta): a conferência passa a vez sem esperar os 20 s
  m.sala.ids = [anaId, segunda];
  m.jogo.conferir!();
  assert.equal(m.estado().fase, 'minijogo', 'todo mundo que estava andou: o microjogo');
});

test('com menos de 2 na sala, a partida acaba sem troféu', async () => {
  sorte = 0.5;
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  const m = comecar();
  m.sala.ids = [anaId];
  m.jogo.conferir!();
  assert.equal(m.estado().fase, 'fim');
  assert.equal(m.estado().interrompida, true);
  assert.equal(m.terminou(), true);
  assert.equal(m.completa(), false, 'no painel de uso, a interrompida não conta como completa');
  assert.ok(m.estado().classificacao.every((l) => l.posicao === null), 'na interrompida, ninguém tem posição');
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes);
});

test('a cenoura dourada: passar por ela com 20 cenouras deixa comprar, só quem está na vez, e ela muda de casa', () => {
  sorte = 0.5;
  const m = comecar({ cenourasIniciais: 25, dourada: 2 });
  m.jogo.acao(anaId, { tipo: 'dado' }); // 4: passa pela casa 2
  let e = m.estado();
  assert.equal(e.fase, 'loja');
  assert.equal(de(e, anaId).pos, 2);
  assert.equal(m.jogo.acao(biaId, { tipo: 'comprar', sim: true }), 'Espere a sua vez.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: true }), null);
  e = m.estado();
  assert.equal(de(e, anaId).douradas, 1);
  assert.equal(de(e, anaId).pos, 4, 'e anda o resto');
  assert.equal(de(e, anaId).cenouras, 25 - PRECO_DA_DOURADA + 3);
  assert.notEqual(e.dourada, 2, 'a dourada mudou de casa');
  assert.equal(e.ultimo!.comprou, true);
  assert.equal(m.jogo.acao(anaId, { tipo: 'comprar', sim: true }), 'A partida não está em andamento.', 'uma compra só');
  // a Bia não responde na loja: compra sozinha (o tempo da loja)
  m.andar();
  const m2 = comecar({ cenourasIniciais: 25, dourada: 3 });
  m2.jogo.acao(anaId, { tipo: 'dado' });
  assert.equal(m2.estado().fase, 'loja');
  m2.andar();
  assert.equal(de(m2.estado(), anaId).douradas, 1);
  // sem 20 cenouras, passa direto
  const m3 = comecar({ cenourasIniciais: 5, dourada: 2 });
  m3.jogo.acao(anaId, { tipo: 'dado' });
  assert.equal(m3.estado().fase, 'andando');
  assert.equal(de(m3.estado(), anaId).douradas, 0);
});

test('o microjogo entre as rodadas é a rodada da Festa, com a conferência dela, e a posição dá cenouras', () => {
  sorte = 0.5;
  const m = comecar({ microjogos: ['relogio'] });
  m.jogo.acao(anaId, { tipo: 'dado' });
  m.andar();
  assert.equal(m.jogo.acao(anaId, { tipo: 'resultado', t: 10_000 }), 'Esta rodada já acabou.', 'fora do microjogo, não vale');
  m.jogo.acao(biaId, { tipo: 'dado' });
  m.andar();
  let e = m.estado();
  assert.equal(e.fase, 'minijogo');
  assert.equal(e.mini!.microjogo, 'relogio');
  assert.equal(e.mini!.fase, 'preparando');
  assert.equal(m.relogio[0].ms, PREPARO_MS);
  assert.equal(m.jogo.acao(anaId, { tipo: 'dado' }), 'A partida não está em andamento.');
  m.andar(); // começa
  agora += 10_000;
  // a Ana para em 10 s; a Bia diz 2 s, mas o servidor viu passar 10: não vale
  assert.equal(m.jogo.acao(biaId, { tipo: 'resultado', t: 2000 }), null);
  assert.equal(m.jogo.acao(anaId, { tipo: 'resultado', t: 10_000 }), null);
  e = m.estado();
  assert.equal(e.mini!.fase, 'revelando');
  assert.equal(de(e, anaId).cenouras, CENOURAS_INICIAIS + 3 + 10);
  assert.equal(de(e, biaId).cenouras, CENOURAS_INICIAIS + 3);
  m.andar(); // a revelação acaba: a rodada 2
  e = m.estado();
  assert.equal(e.rodada, 2);
  assert.equal(e.fase, 'vez');
  assert.equal(e.vez, anaId);
});

test('a partida inteira: o pódio pelas douradas vai para a estante, e quem saiu no meio não leva', async () => {
  sorte = 0.5;
  const m = comecar({ cenourasIniciais: 40, dourada: 2 }, [anaId, biaId, caioId], { rodadas: 5 });
  let voltas = 0;
  while (m.estado().fase !== 'fim' && voltas++ < 500) {
    const e = m.estado();
    if (e.rodada === 2 && m.sala.ids.includes(caioId)) m.sala.ids = [anaId, biaId]; // o Caio sai na rodada 2
    if (e.fase === 'vez' && e.vez === anaId) m.jogo.acao(anaId, { tipo: 'dado' });
    else if (e.fase === 'loja' && e.vez === anaId) m.jogo.acao(anaId, { tipo: 'comprar', sim: true });
    else if (e.fase === 'loja' && e.vez === biaId) m.jogo.acao(biaId, { tipo: 'comprar', sim: false });
    else m.andar(); // a Bia e o Caio ficam parados; o microjogo acaba pelo relógio
  }
  const e = m.estado();
  assert.equal(e.fase, 'fim');
  assert.equal(e.rodada, 5);
  assert.equal(e.interrompida, false);
  assert.ok(de(e, anaId).douradas >= 1);
  assert.equal(e.classificacao[0].userId, anaId);
  assert.notEqual(m.completa(), false, 'a partida inteira conta como completa');
  // só quem ficou até o fim tem posição (as mesmas dos troféus); o Caio, que saiu, vem por último sem posição
  assert.deepEqual(e.classificacao.map((l) => l.userId).slice(0, 2).sort(), [anaId, biaId].sort());
  assert.ok(e.classificacao.slice(0, 2).every((l) => l.posicao !== null));
  assert.equal(e.classificacao[2].userId, caioId);
  assert.equal(e.classificacao[2].posicao, null);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].pontos, daAna[0].tempoMs], ['tabuleiro', 1, de(e, anaId).douradas, null]);
  assert.deepEqual(daAna[0].rivais.map((r: { userId: number }) => r.userId), [biaId], 'contra quem ficou até o fim');
  const doCaio = (await comToken(app, caio.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(doCaio.filter((t: { pista: string }) => t.pista === 'tabuleiro').length, 0, 'quem saiu não leva');
});

test('sem pódio por falta de quem ficou: só quem saiu de fato vem marcado como "saiu" (revisão independente, 03/11/2026)', () => {
  sorte = 0.5;
  const m = comecar({}, [anaId, biaId, caioId], { rodadas: 5 });
  let voltas = 0;
  while (m.estado().fase !== 'fim' && voltas++ < 500) {
    const e = m.estado();
    // o Caio sai na rodada 2; na 3, a Bia sai e o Caio volta: sempre dois na sala, mas só a Ana ficou o tempo todo
    if (e.rodada === 2) m.sala.ids = [anaId, biaId];
    if (e.rodada >= 3) m.sala.ids = [anaId, caioId];
    m.andar();
  }
  const e = m.estado() as Estado & { classificacao: { userId: number; posicao: number | null; saiu: boolean }[] };
  assert.equal(e.fase, 'fim');
  assert.equal(e.interrompida, false);
  assert.ok(e.classificacao.every((l) => l.posicao === null), 'sem pódio');
  const saiu = new Map(e.classificacao.map((l) => [l.userId, l.saiu]));
  assert.deepEqual([saiu.get(anaId), saiu.get(biaId), saiu.get(caioId)], [false, true, true]);
});

test('pela rota: o tabuleiro não se joga sozinho', async () => {
  const r = await comToken(app, ana.token)('POST', '/api/minijogo-solo', { jogo: 'tabuleiro' });
  assert.equal(r.statusCode, 400);
});

test('sem cenouras, a casa de −3 não tira nada (e não diz "−0")', () => {
  sorte = 0.4; // o dado 3: a casa 3 é de perder
  assert.equal(CASAS[3], '-');
  const m = comecar({ cenourasIniciais: 0, dourada: 20 });
  const vez = m.estado().vez!;
  m.jogo.acao(vez, { tipo: 'dado' });
  const e = m.estado();
  assert.equal(e.ultimo!.dado, 3);
  assert.deepEqual(e.ultimo!.efeito, { tipo: 'nada' });
  assert.equal(de(e, vez).cenouras, 0);
});

test('o andar guarda o tabuleiro de quando a peça saiu (a tela mostra o resultado só na chegada)', () => {
  sorte = 0.5;
  const m = comecar({ cenourasIniciais: 25, dourada: 2 });
  m.jogo.acao(anaId, { tipo: 'dado' });
  m.jogo.acao(anaId, { tipo: 'comprar', sim: true });
  const e = m.estado();
  assert.equal(e.ultimo!.comprou, true);
  assert.equal(e.ultimo!.efeito!.tipo, 'mais', 'comprou E a casa de chegada agiu');
  // o segundo trecho sai da casa da dourada, já comprada: as contas de antes dele têm a compra, sem o +3 da chegada
  const antesDaAna = e.ultimo!.antes.pecas.find((p) => p.userId === anaId)!;
  assert.equal(antesDaAna.douradas, 1);
  assert.equal(antesDaAna.cenouras, 25 - PRECO_DA_DOURADA);
  assert.equal(de(e, anaId).cenouras, 25 - PRECO_DA_DOURADA + 3);
});
