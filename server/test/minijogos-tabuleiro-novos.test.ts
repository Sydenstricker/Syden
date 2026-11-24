/**
 * Os tabuleiros novos do Tabuleiro da turma (24/11/2026, minijogo-tabuleiro-da-turma.ts): o rio (a correnteza e a cheia) e a
 * serra (o escorrega e o teleférico), escolhidos na largada; a horta continua a de fábrica; os robôs jogam os dois até o fim.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-tabuleiro-da-turma.js');
const { criarTabuleiro, tracadoDe, CENOURAS_INICIAIS, CORRENTEZA, ESCORREGA, CHEIA } = mod;
after(fechar);

let agora = 24_000_000;
let sorte = 0.5;
const aleatorio = () => sorte;

const ana = await criarConta(app, 'ana-tab3');
const bia = await criarConta(app, 'bia-tab3');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do tabuleiro 3' })).json() as { id: number };

type Participante = { userId: number; pos: number; cenouras: number };
type Estado = {
  fase: string;
  tabuleiro: string;
  casas: string[];
  volta: number;
  vez: number | null;
  participantes: Participante[];
  ultimo: { caminho: number[]; efeito: { tipo: string; valor?: number } | null } | null;
};

function comecar(opcoes: Parameters<typeof criarTabuleiro>[0], corpo: Record<string, unknown>, inicio = [anaId, biaId], solo = false) {
  const sala = { ids: [...inicio] };
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => sala.ids,
    nome: (id: number) => String(id),
    comunidade: comunidade.id,
    solo,
  };
  const jogo = criarTabuleiro({ agora: () => agora, aleatorio, ...opcoes }).comecar(ctx as never, { naSala: inicio, criadaPor: inicio[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    estado: (quem = anaId) => jogo.publico(quem) as unknown as Estado,
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
  };
}
const de = (e: Estado, id: number) => e.participantes.find((p) => p.userId === id)!;

test('a largada escolhe o tabuleiro; sem escolha, ou com um desconhecido, é a horta', () => {
  sorte = 0.5;
  assert.equal(comecar({ dourada: 20 }, {}).estado().tabuleiro, 'horta');
  assert.equal(comecar({ dourada: 20 }, { tabuleiro: 'lua' }).estado().tabuleiro, 'horta');
  const rio = comecar({ dourada: 20 }, { tabuleiro: 'rio' }).estado();
  assert.equal(rio.tabuleiro, 'rio');
  assert.equal(rio.volta, 32);
  assert.equal(rio.casas.length, tracadoDe('rio').todas.length);
  assert.equal(comecar({ dourada: 20 }, { tabuleiro: 'serra' }).estado().volta, 28);
});

test('cada tabuleiro: a largada na casa 0, os ramais do tamanho do trecho que pulam, e a casa de trás desfaz a da frente', () => {
  for (const id of ['horta', 'rio', 'serra']) {
    const T = tracadoDe(id);
    assert.equal(T.casas[0], 'i', id);
    assert.equal(T.casas.filter((c) => c === 'i').length, 1, id);
    for (const r of T.ramais) {
      assert.equal(r.casas.length, (r.ate - r.de - 1 + T.volta) % T.volta, id);
      assert.equal(T.distancia(r.de, r.ate, true), T.distancia(r.de, r.ate, false), id);
    }
    for (let p = 0; p < T.todas.length; p++) {
      const k = T.inicio.findLastIndex((i) => p >= i);
      // (a primeira casa do ramal volta à bifurcação; o resto, à casa de onde veio)
      if (p < T.volta || p > T.inicio[k]) assert.equal(T.proximaCasa(T.casaAnterior(p)), p, `${id}: ${p}`);
      else assert.equal(T.casaAnterior(p), T.ramais[k].de, `${id}: ${p}`);
    }
  }
});

test('o rio: a correnteza leva a peça adiante, e a casa onde ela fica não age', () => {
  sorte = 0.5;
  const m = comecar({ dourada: 20, itensIniciais: ['escolhido'] }, { tabuleiro: 'rio' });
  const quem = m.estado().vez!;
  assert.equal(tracadoDe('rio').casas[3], 'c');
  assert.equal(m.jogo.acao(quem, { tipo: 'usar', item: 'escolhido', valor: 3 }), null);
  const e = m.estado();
  assert.deepEqual(e.ultimo!.efeito, { tipo: 'correnteza', valor: CORRENTEZA });
  assert.deepEqual(e.ultimo!.caminho, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(de(e, quem).pos, 3 + CORRENTEZA);
  assert.equal(de(e, quem).cenouras, CENOURAS_INICIAIS, 'a casa −3 de chegada não agiu');
});

test('o rio: a cheia leva todo mundo da sala CHEIA casas adiante', () => {
  // o sorteio do evento (7 eventos): 0.9 dá o sétimo, a cheia
  sorte = 0.9;
  const m = comecar({ dourada: 20, itensIniciais: ['escolhido'] }, { tabuleiro: 'rio' });
  const quem = m.estado().vez!;
  const outro = quem === anaId ? biaId : anaId;
  assert.equal(tracadoDe('rio').casas[5], '?');
  assert.equal(m.jogo.acao(quem, { tipo: 'usar', item: 'escolhido', valor: 5 }), null);
  const e = m.estado();
  assert.deepEqual(e.ultimo!.efeito, { tipo: 'cheia', valor: CHEIA });
  assert.equal(de(e, quem).pos, 5 + CHEIA);
  assert.equal(de(e, outro).pos, CHEIA);
});

test('a serra: o escorrega devolve a peça, depois da bifurcação', () => {
  sorte = 0.5;
  const m = comecar({ dourada: 20, itensIniciais: ['escolhido'] }, { tabuleiro: 'serra' });
  const quem = m.estado().vez!;
  assert.equal(tracadoDe('serra').casas[5], 'e');
  assert.equal(m.jogo.acao(quem, { tipo: 'usar', item: 'escolhido', valor: 5 }), null);
  assert.equal(m.estado().fase, 'caminho', 'para na bifurcação da casa 3');
  m.jogo.acao(quem, { tipo: 'caminho', ramal: false });
  const e = m.estado();
  assert.deepEqual(e.ultimo!.efeito, { tipo: 'escorrega', valor: ESCORREGA });
  assert.deepEqual(e.ultimo!.caminho, [3, 4, 5, 4, 3, 2]);
  assert.equal(de(e, quem).pos, 5 - ESCORREGA);
});

test('a serra: o teleférico leva a peça à casa antes da cenoura dourada', () => {
  sorte = 0.9;
  const m = comecar({ dourada: 20, itensIniciais: ['escolhido'] }, { tabuleiro: 'serra' });
  const quem = m.estado().vez!;
  assert.equal(tracadoDe('serra').casas[2], '?');
  assert.equal(m.jogo.acao(quem, { tipo: 'usar', item: 'escolhido', valor: 2 }), null);
  const e = m.estado();
  assert.deepEqual(e.ultimo!.efeito, { tipo: 'teleferico' });
  assert.equal(de(e, quem).pos, 19);
});

test('no Solo, os robôs jogam o rio e a serra inteiros, passando pelas casas novas', () => {
  for (const tabuleiro of ['rio', 'serra']) {
    let s = 11;
    const sorteio = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const m = comecar({ aleatorio: sorteio, cenourasIniciais: 30 }, { rodadas: 10, robos: 3, tabuleiro }, [anaId], true);
    let voltas = 0;
    const viu = new Set<string>();
    while (m.estado().fase !== 'fim' && voltas++ < 8000) {
      const e = m.estado();
      if (e.ultimo?.efeito) viu.add(e.ultimo.efeito.tipo);
      if (e.fase === 'vez' && e.vez === anaId) m.jogo.acao(anaId, { tipo: 'dado' });
      else m.andar();
    }
    assert.equal(m.estado().fase, 'fim', tabuleiro);
    assert.ok(viu.has(tabuleiro === 'rio' ? 'correnteza' : 'escorrega'), `${tabuleiro}: ${[...viu].join(', ')}`);
  }
});
