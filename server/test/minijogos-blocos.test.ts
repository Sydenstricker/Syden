/**
 * A Horta em cascata (minijogo-blocos.ts): cada um joga na própria tela, e o servidor refaz a partida de cada um com a
 * mesma simulação (blocos-sim.ts), a partir da semente e das jogadas. O relógio aqui é de mão, e quem joga é o piloto
 * automático do site (web/src/blocos/piloto.ts), como se fosse uma pessoa mandando os lotes.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarBlocos, LARGADA_MS, ATRASO_DO_LIXO, FOLGA_FRENTE } = await import('../src/minijogo-blocos.js');
const Sim = await import('../src/blocos-sim.js');
const { escolherJogada } = await import('../../web/src/blocos/piloto.ts');
after(fechar);

let agora = 9_000_000;

const ana = await criarConta(app, 'ana-blocos');
const bia = await criarConta(app, 'bia-blocos');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da horta' })).json() as { id: number };

type Meu = { recebidas: number; versao: number; passo: number; pontos: number; lixos: Sim.Lixo[]; jogadas: Sim.Jogada[] | null; fim: boolean };

function comecar(naSala: () => number[], corpo: Record<string, unknown> = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidade.id,
  };
  const jogo = criarBlocos({ agora: () => agora, aleatorio: () => 0.25 }).comecar(ctx, { naSala: naSala(), criadaPor: naSala()[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return { jogo, relogio, terminou: () => terminou };
}

/** Uma pessoa jogando com o piloto automático: a partida dela, aqui, e os lotes para o servidor. */
function cliente(jogo: { acao: (q: number, c: Record<string, unknown>) => string | null; publico: (q: number) => Record<string, unknown> }, quem: number) {
  const p = jogo.publico(quem);
  const s = Sim.simulacao(p.semente as number, p.modo === 'dois-minutos' ? Sim.DOIS_MINUTOS : 0);
  let enviadas = 0;
  return {
    s,
    /** Joga até o passo `ate` (uma jogada a cada 8 passos, se o piloto achar). */
    jogar(ate: number) {
      while (s.e.passo < ate && !s.e.fim) {
        const n = s.e.passo;
        if (n % 8 === 0) {
          const j = escolherJogada(s.e);
          if (j && Sim.cabeNoRitmo(s.jogadas, n)) s.jogadas.push(j.tipo === 'subir' ? [n, 1, 0, 0] : [n, 0, j.l, j.c]);
        }
        Sim.avancar(s, n + 1);
      }
    },
    lote() {
      const r = jogo.acao(quem, { tipo: 'jogadas', de: enviadas, passo: s.e.passo, jogadas: s.jogadas.slice(enviadas) });
      enviadas = s.jogadas.length;
      return r;
    },
  };
}

const meu = (jogo: { publico: (q: number) => Record<string, unknown> }, quem: number) => jogo.publico(quem).meu as Meu;

test('a largada, e o servidor refaz a partida: os mesmos pontos e a mesma pilha; os caixotes vão para a outra', () => {
  const { jogo, relogio } = comecar(() => [anaId, biaId]);
  assert.equal(jogo.publico(anaId).fase, 'largada');
  assert.equal(relogio[0].ms, LARGADA_MS);
  assert.equal(jogo.acao(anaId, { tipo: 'jogadas', de: 0, passo: 0, jogadas: [] }), 'Esta rodada já acabou.', 'antes da largada não vale');
  agora += LARGADA_MS;
  relogio[0].depois();
  assert.equal(jogo.publico(anaId).fase, 'jogando');
  const a = cliente(jogo, anaId);
  const b = cliente(jogo, biaId);
  let lixosDaBia = 0;
  // 25 s, um lote a cada meio segundo; a Bia manda lotes vazios (e por isso recebe os caixotes sem se defender)
  for (let t = 1; t <= 50; t++) {
    agora += 500;
    a.jogar(t * 30);
    assert.equal(a.lote(), null);
    jogo.acao(biaId, { tipo: 'jogadas', de: 0, passo: t * 30, jogadas: [] });
    const lixos = meu(jogo, biaId).lixos;
    if (lixos.length > lixosDaBia) {
      // cada caixote cai no futuro da Bia, uns 1,5 s adiante do passo em que ela estava
      assert.ok(lixos[lixos.length - 1].n >= t * 30 - 30 + ATRASO_DO_LIXO, `o caixote cai no futuro (${lixos[lixos.length - 1].n})`);
      lixosDaBia = lixos.length;
    }
  }
  const doServidor = jogo.publico(anaId).jogadores as { userId: number; pontos: number; grade: string }[];
  const anaNoServidor = doServidor.find((j) => j.userId === anaId)!;
  assert.ok(a.s.e.pontos > 0, 'o piloto fez pontos');
  assert.equal(anaNoServidor.pontos, a.s.e.pontos, 'os mesmos pontos');
  assert.equal(anaNoServidor.grade, Sim.retrato(a.s.e), 'a mesma pilha');
  assert.equal(meu(jogo, anaId).versao, 0, 'nenhuma jogada recusada');
  assert.ok(lixosDaBia > 0, 'as cadeias e os combos da Ana viraram caixotes para a Bia');
});

test('o relógio e o ritmo: nada à frente do servidor, e no máximo 20 jogadas num segundo', () => {
  const { jogo, relogio } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  agora += 1000; // 60 passos
  // um passo dito muito à frente: o servidor anda só até o relógio dele (+1 s)
  assert.equal(jogo.acao(anaId, { tipo: 'jogadas', de: 0, passo: 100_000, jogadas: [[5000, 0, 11, 0]] }), null);
  assert.equal(meu(jogo, anaId).passo, 60 + FOLGA_FRENTE);
  assert.equal(meu(jogo, anaId).versao, 1, 'a jogada do futuro foi recusada');
  assert.deepEqual(meu(jogo, anaId).jogadas, [], 'e o site recebe a lista aceita para se acertar');
  assert.equal(meu(jogo, anaId).recebidas, 1);
  // uma jogada do passado (antes de onde o servidor já está) também não vale
  agora += 1000;
  jogo.acao(anaId, { tipo: 'jogadas', de: 1, passo: 200, jogadas: [[10, 0, 11, 0]] });
  assert.equal(meu(jogo, anaId).versao, 2);
  // 30 trocas no mesmo segundo: só 20 entram
  const n = meu(jogo, anaId).passo;
  const rajada = Array.from({ length: 30 }, (_, i) => [n + i, 0, 11, i % 5]);
  agora += 1000;
  jogo.acao(anaId, { tipo: 'jogadas', de: 2, passo: n + 40, jogadas: rajada });
  assert.equal(meu(jogo, anaId).jogadas!.length, 20);
  assert.equal(meu(jogo, anaId).versao, 12);
  // o mesmo lote mandado de novo (a resposta se perdeu) não conta duas vezes
  jogo.acao(anaId, { tipo: 'jogadas', de: 2, passo: n + 40, jogadas: rajada });
  assert.equal(meu(jogo, anaId).recebidas, 32);
  assert.equal(meu(jogo, anaId).jogadas!.length, 20);
  // números estranhos
  assert.equal(jogo.acao(anaId, { tipo: 'jogadas', de: -1, passo: 0, jogadas: [] }), 'Ação desconhecida.');
  assert.equal(jogo.acao(anaId, { tipo: 'pontos', pontos: 99999 }), 'Ação desconhecida.');
});

test('o painel aberto de novo no meio pede a lista do que o servidor já leu', () => {
  const { jogo, relogio } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  const a = cliente(jogo, anaId);
  for (let t = 1; t <= 6; t++) {
    agora += 500;
    a.jogar(t * 30);
    a.lote();
  }
  assert.equal(meu(jogo, anaId).jogadas, null, 'sem pedir, a lista não vai (ela cresce a partida inteira)');
  assert.equal(jogo.acao(anaId, { tipo: 'sincronizar' }), null);
  assert.deepEqual(meu(jogo, anaId).jogadas, a.s.jogadas);
  // refeita com ela, a partida é a mesma do servidor
  const r = Sim.simulacao(jogo.publico(anaId).semente as number);
  r.jogadas = meu(jogo, anaId).jogadas!.slice();
  Sim.avancar(r, meu(jogo, anaId).passo);
  assert.equal(Sim.retrato(r.e), (jogo.publico(anaId).jogadores as { userId: number; grade: string }[]).find((j) => j.userId === anaId)!.grade);
});

test('quem para de mandar é levado adiante: a pilha chega ao topo, a outra ganha, e o pódio vai para a estante', async () => {
  const { jogo, relogio, terminou } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  const a = cliente(jogo, anaId);
  // a Bia não manda nada: o servidor a leva adiante, sem jogadas, até a pilha dela chegar ao topo
  for (let t = 1; t <= 240 && !terminou(); t++) {
    agora += 500;
    a.jogar(t * 30);
    a.lote();
  }
  assert.equal(terminou(), true, 'acabou quando sobrou uma');
  const p = jogo.publico(anaId);
  assert.equal(p.fase, 'fim');
  const resultado = p.resultado as { userId: number; lugar: number; pontos: number; tempoMs: number }[];
  assert.deepEqual(resultado.map((r) => [r.userId, r.lugar]), [
    [anaId, 1],
    [biaId, 2],
  ]);
  assert.ok(resultado[1].tempoMs > 20_000 && resultado[1].tempoMs < 60_000, `a pilha parada da Bia aguentou ${resultado[1].tempoMs} ms`);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].pontos], ['blocos', 1, a.s.e.pontos]);
  assert.ok(daAna[0].tempoMs > 0);
  assert.deepEqual(daAna[0].rivais.map((r: { userId: number }) => r.userId), [biaId]);
  const daBia = (await comToken(app, bia.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daBia.filter((t: { pista: string }) => t.pista === 'blocos').length, 0, 'quem não fez nenhuma troca não sobe ao pódio');
});

test('quem sai da sala perde, e quem fica sozinho não ganha o pódio "com a turma"', async () => {
  let naSala = [anaId, biaId];
  const { jogo, relogio, terminou } = comecar(() => naSala);
  agora += LARGADA_MS;
  relogio[0].depois();
  const a = cliente(jogo, anaId);
  const b = cliente(jogo, biaId);
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  for (let t = 1; t <= 10; t++) {
    agora += 500;
    a.jogar(t * 30);
    a.lote();
    b.jogar(t * 30);
    b.lote();
  }
  naSala = [anaId];
  jogo.conferir!();
  assert.equal(terminou(), true);
  const resultado = jogo.publico(anaId).resultado as { userId: number; lugar: number }[];
  assert.equal(resultado[0].userId, anaId);
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes, 'sozinha na sala, sem troféu');
});

test('sozinho: começa pela rota do Solo, no contra o relógio de 2 minutos, e acaba sem pódio', async () => {
  const comAna = comToken(app, ana.token);
  const r = await comAna('POST', '/api/minijogo-solo', { jogo: 'blocos', modo: 'dois-minutos' });
  assert.equal(r.statusCode, 200, r.body);
  const p = r.json().partida;
  assert.equal(p.jogo, 'blocos');
  assert.equal(p.fase, 'largada');
  assert.equal(p.modo, 'dois-minutos');
  await comAna('DELETE', '/api/minijogo-solo');

  // a partida de 2 minutos acaba no passo 7200 da pessoa, mesmo que ela não jogue
  const { jogo, relogio, terminou } = comecar(() => [anaId], { modo: 'dois-minutos' });
  agora += LARGADA_MS;
  relogio[0].depois();
  const a = cliente(jogo, anaId);
  for (let t = 1; t <= 300 && !terminou(); t++) {
    agora += 1000;
    a.jogar(t * 60);
    a.lote();
  }
  assert.equal(terminou(), true);
  assert.ok(a.s.e.fim === 'tempo' ? a.s.e.passo === Sim.DOIS_MINUTOS : a.s.e.fim === 'topo');
  assert.equal(jogo.publico(anaId).modo, 'dois-minutos');
  assert.equal((jogo.publico(anaId).resultado as { pontos: number }[])[0].pontos, a.s.e.pontos);
});
