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
const carla = await criarConta(app, 'carla-blocos');
const carlaId = await idDe(carla.token);
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
    nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'carla'),
    comunidade: comunidade.id,
  };
  const jogo = criarBlocos({ agora: () => agora, aleatorio: () => 0.25 }).comecar(ctx, { naSala: naSala(), criadaPor: naSala()[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return { jogo, relogio, terminou: () => terminou };
}

/** Uma pessoa jogando com o piloto automático: a partida dela, aqui, e os lotes para o servidor. */
function cliente(jogo: { acao: (q: number, c: Record<string, unknown>) => string | null; publico: (q: number) => Record<string, unknown> }, quem: number, ritmo = 8) {
  const p = jogo.publico(quem);
  const s = Sim.simulacao(p.semente as number, p.modo === 'dois-minutos' ? Sim.DOIS_MINUTOS : 0);
  let enviadas = 0;
  return {
    s,
    /** Joga até o passo `ate` (uma jogada a cada `ritmo` passos, se o piloto achar), com os caixotes que o servidor mandou. */
    jogar(ate: number) {
      s.lixos = ((jogo.publico(quem).meu as Meu | null)?.lixos ?? []).slice();
      while (s.e.passo < ate && !s.e.fim) {
        const n = s.e.passo;
        if (n % ritmo === 0) {
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
  // 30 "subir" no mesmo segundo: só 20 entram
  const n = meu(jogo, anaId).passo;
  const rajada = Array.from({ length: 30 }, (_, i) => [n + i, 1, 0, 0]);
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
  const resultado = jogo.publico(anaId).resultado as { userId: number; lugar: number | null }[];
  assert.deepEqual(
    resultado.map((r) => [r.userId, r.lugar]),
    [
      [anaId, 1],
      [biaId, null],
    ],
    'quem saiu vem embaixo, sem posição',
  );
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

test('as trocas: no mínimo 4 passos entre uma e a seguinte (o "subir" não conta)', () => {
  const { jogo, relogio } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  agora += 1000;
  const n = 10;
  const jogadas = [
    [n, 0, 11, 0],
    [n, 0, 11, 2],
    [n + 1, 1, 0, 0],
    [n + 3, 0, 11, 1],
    [n + 4, 0, 11, 3],
    [n + 20, 0, 11, 4],
  ];
  jogo.acao(anaId, { tipo: 'jogadas', de: 0, passo: 40, jogadas });
  assert.deepEqual(
    meu(jogo, anaId).jogadas!.map((j) => j[0]),
    [n, n + 1, n + 4, n + 20],
    'a segunda troca do mesmo passo, e a de 3 passos depois, não valem',
  );
  assert.equal(meu(jogo, anaId).versao, 2);
});

test('a lista aceita vai no estado só enquanto o site não se acertou com ela', () => {
  const { jogo, relogio } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  agora += 1000;
  // uma jogada do futuro é recusada: a lista vai
  jogo.acao(anaId, { tipo: 'jogadas', de: 0, passo: 60, versao: 0, jogadas: [[5000, 0, 11, 0]] });
  assert.equal(meu(jogo, anaId).versao, 1);
  assert.deepEqual(meu(jogo, anaId).jogadas, []);
  // o site refez a partida (versão 1) e manda o lote seguinte: daí em diante, sem a lista
  agora += 500;
  jogo.acao(anaId, { tipo: 'jogadas', de: 1, passo: 90, versao: 1, jogadas: [[70, 0, 11, 0]] });
  assert.equal(meu(jogo, anaId).jogadas, null);
  agora += 500;
  jogo.acao(anaId, { tipo: 'jogadas', de: 2, passo: 120, versao: 1, jogadas: [] });
  assert.equal(meu(jogo, anaId).jogadas, null, 'nem nos lotes seguintes');
  // uma versão que o servidor nunca deu não vale
  jogo.acao(anaId, { tipo: 'jogadas', de: 2, passo: 120, versao: 99, jogadas: [] });
  assert.equal(meu(jogo, anaId).jogadas, null);
  // o painel aberto de novo: a lista volta até o site mandar a versão nova
  jogo.acao(anaId, { tipo: 'sincronizar' });
  assert.deepEqual(meu(jogo, anaId).jogadas, [[70, 0, 11, 0]]);
  jogo.acao(anaId, { tipo: 'jogadas', de: 2, passo: 120, versao: 2, jogadas: [] });
  assert.equal(meu(jogo, anaId).jogadas, null);
});

/** As duas sem jogar, a Bia uns 3 s atrás (sem passar do limite em que o servidor a leva adiante), até a Ana chegar ao topo. */
function ateAAnaChegarAoTopo(jogo: ReturnType<typeof comecar>['jogo']) {
  for (let t = 1; !meu(jogo, anaId).fim && t < 400; t++) {
    agora += 500;
    jogo.acao(anaId, { tipo: 'jogadas', de: 0, passo: t * 30, versao: 0, jogadas: [] });
    jogo.acao(biaId, { tipo: 'jogadas', de: 0, passo: Math.max(0, t * 30 - 180), versao: 0, jogadas: [] });
  }
  assert.equal(meu(jogo, anaId).fim, true, 'a pilha da Ana chegou ao topo');
}

test('as duas últimas: a partida só acaba quando a de trás passou do passo em que a outra chegou ao topo', () => {
  // sem jogar, com a mesma semente e sem caixotes, as duas pilhas chegam ao topo NO MESMO PASSO: um empate
  const { jogo, relogio, terminou } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  ateAAnaChegarAoTopo(jogo);
  const y = meu(jogo, anaId).passo;
  assert.ok(meu(jogo, biaId).passo < y, 'a Bia está atrás');
  assert.equal(terminou(), false, 'ainda não acabou: a Bia pode chegar ao topo antes');
  jogo.conferir!();
  assert.equal(terminou(), false);
  agora += 500;
  jogo.acao(biaId, { tipo: 'jogadas', de: 0, passo: y + 30, versao: 0, jogadas: [] });
  assert.equal(terminou(), true);
  const resultado = jogo.publico(anaId).resultado as { userId: number; lugar: number }[];
  assert.deepEqual(
    resultado.map((r) => r.lugar),
    [1, 1],
    'chegaram ao topo no mesmo passo: empate, e não a de trás na frente',
  );
});

test('as duas últimas: quem para de mandar depois da eliminação da outra é levado adiante, e a partida acaba sozinha', () => {
  const { jogo, relogio, terminou } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  ateAAnaChegarAoTopo(jogo);
  assert.equal(terminou(), false);
  // a Bia some (a internet caiu): o servidor a leva adiante e confere
  for (let k = 0; k < 4 && !terminou(); k++) {
    agora += 4000;
    jogo.conferir!();
  }
  assert.equal(terminou(), true);
});

test('o teto de 8 minutos compara todos no mesmo passo', () => {
  const { jogo, relogio, terminou } = comecar(() => [anaId, biaId]);
  agora += LARGADA_MS;
  relogio[0].depois();
  agora += 4000;
  jogo.acao(anaId, { tipo: 'jogadas', de: 0, passo: 240, versao: 0, jogadas: [] });
  jogo.acao(biaId, { tipo: 'jogadas', de: 0, passo: 60, versao: 0, jogadas: [] });
  relogio[0].depois(); // o teto (chamado cedo, para não esperar 8 minutos)
  assert.equal(terminou(), true);
  const resultado = jogo.publico(anaId).resultado as { userId: number; lugar: number; tempoMs: number }[];
  assert.equal(resultado[0].tempoMs, resultado[1].tempoMs, 'as duas no mesmo passo');
  assert.deepEqual(
    resultado.map((r) => r.lugar),
    [1, 1],
  );
});

test('o placar do fim: a posição é só de quem ficou; quem saiu, mesmo tendo durado mais, vem embaixo e sem posição', async () => {
  let naSala = [anaId, biaId, carlaId];
  const { jogo, relogio, terminou } = comecar(() => naSala);
  agora += LARGADA_MS;
  relogio[0].depois();
  const a = cliente(jogo, anaId);
  const c = cliente(jogo, carlaId, 20);
  // a Bia não joga; a Carla joga e sai da sala logo DEPOIS de a pilha da Bia chegar ao topo: pela ordem de eliminação ela
  // ficaria na frente da Bia, mas não ficou até o fim
  let biaCaiu = false;
  for (let t = 1; t <= 400 && !terminou(); t++) {
    agora += 500;
    a.jogar(t * 30);
    a.lote();
    jogo.acao(biaId, { tipo: 'jogadas', de: 0, passo: t * 30, jogadas: [] });
    if (naSala.length === 3) {
      c.jogar(t * 30);
      c.lote();
    }
    if (naSala.length === 3 && meu(jogo, biaId).fim) {
      assert.equal(meu(jogo, carlaId).fim, false, 'a Carla ainda estava viva quando a Bia caiu');
      assert.ok(meu(jogo, carlaId).passo > meu(jogo, biaId).passo, 'e mais adiante que ela');
      biaCaiu = true;
      naSala = [anaId, biaId];
      jogo.conferir!();
    }
  }
  assert.ok(biaCaiu);
  assert.equal(terminou(), true);
  const resultado = jogo.publico(anaId).resultado as { userId: number; lugar: number | null }[];
  assert.deepEqual(
    resultado.map((r) => [r.userId, r.lugar]),
    [
      [anaId, 1],
      [biaId, 2],
      [carlaId, null],
    ],
  );
  const daCarla = (await comToken(app, carla.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daCarla.length, 0);
});
