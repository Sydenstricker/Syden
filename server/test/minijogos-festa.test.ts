/**
 * A Festa dos coelhos (minijogo-festa.ts): cada um joga na própria tela, e o servidor confere o resultado pelo relógio dele
 * e pelas respostas que só ele sorteou. O relógio e o sorteio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const festaMod = await import('../src/minijogo-festa.js');
const { criarFesta, PREPARO_MS, REVELACAO_MS, copoFinal, animacaoDosCopos, valorDaForca, minimoDaSiga, FOLGA_SAQUE } = festaMod;
type Microjogo = (typeof festaMod.MICROJOGOS)[number];
after(fechar);

let agora = 5_000_000;
/** Um sorteio fixo (sempre o meio): as esperas e os dados são previsíveis. */
const meio = () => 0.5;

const ana = await criarConta(app, 'ana-festa');
const bia = await criarConta(app, 'bia-festa');
const caio = await criarConta(app, 'caio-festa');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da festa' })).json() as { id: number };

function contexto(naSala: number[], comunidadeId = 0) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    /** Dispara o relógio marcado, andando o tempo junto. */
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
    ctx: {
      agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala: () => naSala,
      nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
      comunidade: comunidadeId,
    },
  };
}

function comecar(ordem: Microjogo[], naSala = [anaId, biaId], comunidadeId = 0) {
  const m = contexto(naSala, comunidadeId);
  const jogo = criarFesta({ agora: () => agora, aleatorio: meio, ordem }).comecar(m.ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return { ...m, jogo };
}

type Linha = { userId: number; posicao: number | null; pontos: number; motivo: string | null; valor: number | null };

test('o saque: quem aperta antes do sinal é desclassificado, e a reação mais rápida ganha', () => {
  const { jogo, relogio, andar } = comecar(['saque']);
  assert.equal(jogo.publico(anaId).fase, 'preparando');
  assert.equal(relogio[0].ms, PREPARO_MS);
  assert.ok(jogo.acao(anaId, { tipo: 'resultado', reacaoMs: 200 }), 'no "prepare-se" ainda não vale');
  andar();
  assert.equal(jogo.publico(anaId).fase, 'jogando');
  assert.equal(jogo.publico(anaId).sinal, false, 'o sinal não vai antes de sair');
  assert.equal(relogio[0].ms, 3500, 'a espera sorteada (entre 2 e 5 s)');
  // a Bia aperta antes do sinal (o site manda "cedo"); mesmo sem o aviso, o servidor sabe que o sinal não saiu
  assert.equal(jogo.acao(biaId, { tipo: 'resultado', reacaoMs: 250 }), null);
  assert.equal((jogo.publico(biaId).meu as { motivo: string }).motivo, 'cedo');
  andar(); // o sinal
  assert.equal(jogo.publico(anaId).sinal, true);
  agora += 400;
  assert.equal(jogo.acao(anaId, { tipo: 'resultado', reacaoMs: 300 }), null);
  assert.equal(jogo.publico(anaId).fase, 'revelando', 'todo mundo respondeu: revela na hora');
  const linhas = jogo.publico(anaId).linhas as Linha[];
  assert.deepEqual(linhas.map((l) => [l.userId, l.posicao, l.pontos, l.motivo]), [
    [anaId, 1, 10, null],
    [biaId, null, 0, 'cedo'],
  ]);
});

test('o saque: reação abaixo de 100 ms é chute, e a reação declarada não fica muito abaixo do relógio do servidor', () => {
  const { jogo, andar } = comecar(['saque'], [anaId, biaId, caioId]);
  andar();
  andar(); // o sinal
  agora += 3000;
  assert.equal(jogo.acao(anaId, { tipo: 'resultado', reacaoMs: 120 }), null, 'a Ana diz 120 ms, mas o servidor viu 3 s');
  assert.equal(jogo.acao(biaId, { tipo: 'resultado', reacaoMs: 60 }), null);
  assert.equal(jogo.acao(caioId, { tipo: 'resultado', reacaoMs: 2000 }), null);
  const linhas = jogo.publico(anaId).linhas as Linha[];
  const daAna = linhas.find((l) => l.userId === anaId)!;
  assert.equal(daAna.valor, 3000 - FOLGA_SAQUE, 'a reação sobe ao que o relógio permite');
  assert.equal(linhas.find((l) => l.userId === biaId)!.motivo, 'cedo', '60 ms não é reação');
  assert.equal(linhas[0].userId, anaId);
  assert.equal(linhas[1].userId, caioId);
});

test('os copos: o servidor sabe onde está a cenoura, e quem erra não pontua', () => {
  const { jogo, andar } = comecar(['copos']);
  const dados = jogo.publico(anaId).dados as { inicial: number; trocas: [number, number][]; passos: number[] };
  assert.ok(dados.trocas.length >= 8);
  assert.equal(jogo.publico(anaId).resposta, null, 'a resposta não vai antes da revelação');
  const certo = copoFinal(dados);
  andar();
  assert.equal(jogo.acao(anaId, { tipo: 'resultado', copo: certo, ms: 500 }), null, 'antes de os copos pararem…');
  assert.equal((jogo.publico(anaId).meu as { motivo: string }).motivo, 'invalido', '…não vale');
  // outra rodada, do zero: a Bia erra, a Ana acerta depois de os copos pararem
  const outra = comecar(['copos']);
  const d2 = outra.jogo.publico(anaId).dados as typeof dados;
  outra.andar();
  agora += animacaoDosCopos(d2) + 800;
  assert.equal(outra.jogo.acao(biaId, { tipo: 'resultado', copo: (copoFinal(d2) + 1) % 3, ms: 300 }), null);
  assert.equal(outra.jogo.acao(anaId, { tipo: 'resultado', copo: copoFinal(d2), ms: 700 }), null);
  assert.equal(outra.jogo.publico(anaId).resposta, copoFinal(d2));
  const linhas = outra.jogo.publico(anaId).linhas as Linha[];
  assert.deepEqual(linhas.map((l) => [l.userId, l.pontos, l.motivo]), [
    [anaId, 10, null],
    [biaId, 0, 'errou'],
  ]);
});

test('siga o coelho: as setas batem com as do servidor, e houve tempo de vê-las', () => {
  const { jogo, andar } = comecar(['siga']);
  const setas = (jogo.publico(anaId).dados as { setas: number[] }).setas;
  andar();
  agora += minimoDaSiga(3) + 3000;
  assert.equal(jogo.acao(anaId, { tipo: 'resultado', acertos: 3, setas: setas.slice(0, 3).concat((setas[3] + 1) % 4), ms: 9000 }), null);
  // a Bia diz que acertou 12, mas não houve tempo nem de ver 12
  assert.equal(jogo.acao(biaId, { tipo: 'resultado', acertos: 12, setas, ms: 9000 }), null);
  const linhas = jogo.publico(anaId).linhas as Linha[];
  assert.deepEqual(linhas.map((l) => [l.userId, l.valor, l.pontos, l.motivo]), [
    [anaId, 3, 10, null],
    [biaId, null, 0, 'invalido'],
  ]);
  // setas que não batem
  const outra = comecar(['siga']);
  const s2 = (outra.jogo.publico(anaId).dados as { setas: number[] }).setas;
  outra.andar();
  agora += 30_000;
  const trocadas = s2.slice(0, 4).map((s, i) => (i === 2 ? (s + 1) % 4 : s));
  outra.jogo.acao(anaId, { tipo: 'resultado', acertos: 4, setas: trocadas });
  assert.equal((outra.jogo.publico(anaId).meu as { motivo: string }).motivo, 'invalido');
});

test('a força e o relógio: o servidor calcula a partir do tempo, e empatados dividem a posição', () => {
  const { jogo, andar } = comecar(['forca', 'relogio'], [anaId, biaId, caioId]);
  const periodo = (jogo.publico(anaId).dados as { periodoMs: number }).periodoMs;
  andar();
  const largou = agora;
  // no meio do período a barra está em 100 (cada um manda na hora em que parou)
  agora = largou + periodo / 2;
  assert.equal(jogo.acao(anaId, { tipo: 'resultado', t: periodo / 2 }), null);
  agora = largou + periodo * 1.5;
  assert.equal(jogo.acao(biaId, { tipo: 'resultado', t: periodo * 1.5 }), null);
  agora = largou + 7950;
  assert.equal(jogo.acao(caioId, { tipo: 'resultado', t: 7900 }), null);
  let linhas = jogo.publico(anaId).linhas as Linha[];
  assert.deepEqual(linhas.slice(0, 2).map((l) => [l.valor, l.posicao, l.pontos]), [
    [100, 1, 10],
    [100, 1, 10],
  ]);
  assert.equal(linhas[2].posicao, 3, 'o terceiro é o 3º, não o 2º');
  assert.equal(linhas[2].pontos, 6);
  assert.equal(linhas[2].valor, Math.round(valorDaForca(periodo, 7900) * 10) / 10);

  andar(); // a revelação acaba: o relógio
  assert.equal(jogo.publico(anaId).microjogo, 'relogio');
  andar();
  agora += 2000;
  assert.equal(jogo.acao(anaId, { tipo: 'resultado', t: 10_000 }), null, 'parar em 10 s com só 2 s de jogo…');
  assert.equal((jogo.publico(anaId).meu as { motivo: string }).motivo, 'invalido', '…não vale');
  agora += 8050;
  jogo.acao(biaId, { tipo: 'resultado', t: 10_050 });
  jogo.acao(caioId, { tipo: 'resultado', t: 9_800 });
  linhas = jogo.publico(anaId).linhas as Linha[];
  assert.deepEqual(linhas.map((l) => [l.userId, l.pontos]), [
    [biaId, 10],
    [caioId, 8],
    [anaId, 0],
  ]);
});

test('tiro ao alvo: cada acerto vale se o alvo estava na tela naquela hora, no relógio do servidor', () => {
  const { jogo, andar } = comecar(['alvo']);
  const alvos = (jogo.publico(anaId).dados as { alvos: { t: number; casa: number }[] }).alvos;
  assert.ok(alvos.length >= 20);
  andar();
  const largou = agora;
  // a Ana acerta os três primeiros, cada um na hora em que está na tela
  for (const i of [0, 1, 2]) {
    agora = largou + alvos[i].t + 200;
    jogo.acao(anaId, { tipo: 'acerto', i });
  }
  // a Bia, pelo console, "acerta" todos de uma vez agora (só valem os que estão na tela neste momento)
  for (let i = 0; i < alvos.length; i++) jogo.acao(biaId, { tipo: 'acerto', i });
  agora = largou + 20_500;
  assert.equal(jogo.acao(anaId, { tipo: 'resultado' }), null);
  assert.equal(jogo.acao(biaId, { tipo: 'resultado' }), null);
  const linhas = jogo.publico(anaId).linhas as Linha[];
  const daAna = linhas.find((l) => l.userId === anaId)!;
  const daBia = linhas.find((l) => l.userId === biaId)!;
  assert.equal(daAna.valor, 3);
  assert.ok((daBia.valor ?? 0) <= 6 && alvos.length > 15, `a lista inteira mandada de uma vez vale só o que estava na tela: ${daBia.valor} de ${alvos.length}`);
});

test('quem fica sozinho na sala não ganha o pódio "com a turma"', async () => {
  let naSala = [anaId, biaId];
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => naSala,
    nome: (id: number) => `p${id}`,
    comunidade: comunidade.id,
  };
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  const jogo = criarFesta({ agora: () => agora, ordem: ['relogio', 'relogio', 'relogio', 'relogio', 'relogio'] }).comecar(ctx, {
    naSala: [anaId, biaId],
    criadaPor: anaId,
    corpo: {},
  });
  assert.ok(typeof jogo !== 'string');
  for (let r = 1; r <= 5; r++) {
    relogio[0].depois(); // começa
    if (r === 2) naSala = [anaId]; // a Bia sai depois da primeira rodada
    agora += 10_000;
    jogo.acao(anaId, { tipo: 'resultado', t: 10_000 });
    if (jogo.publico(anaId).fase === 'jogando') relogio[0].depois();
    relogio[0].depois(); // a revelação acaba
  }
  assert.equal(jogo.publico(anaId).fase, 'fim');
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes, 'sem troféu');
});

test('a partida inteira: 5 rodadas sem repetir, o placar somado, e o troféu do pódio', async () => {
  const m = contexto([anaId, biaId], comunidade.id);
  const jogo = criarFesta({ agora: () => agora, aleatorio: Math.random }).comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const vistos = new Set<string>();
  for (let r = 1; r <= 5; r++) {
    const p = jogo.publico(anaId);
    assert.equal(p.rodada, r);
    vistos.add(p.microjogo as string);
    m.andar(); // começa
    // a Ana faz algo que vale em cada um; a Bia não responde
    const micro = jogo.publico(anaId).microjogo;
    const d = jogo.publico(anaId).dados as never;
    if (micro === 'saque') {
      m.andar(); // o sinal
      agora += 300;
      jogo.acao(anaId, { tipo: 'resultado', reacaoMs: 250 });
    } else if (micro === 'forca') {
      agora += 1000;
      jogo.acao(anaId, { tipo: 'resultado', t: 1000 });
    } else if (micro === 'relogio') {
      agora += 10_200;
      jogo.acao(anaId, { tipo: 'resultado', t: 10_000 });
    } else if (micro === 'copos') {
      agora += animacaoDosCopos(d) + 500;
      jogo.acao(anaId, { tipo: 'resultado', copo: copoFinal(d), ms: 400 });
    } else if (micro === 'siga') {
      agora += 5000;
      jogo.acao(anaId, { tipo: 'resultado', acertos: 1, setas: [(d as { setas: number[] }).setas[0]] });
    } else {
      agora += (d as { alvos: { t: number }[] }).alvos[0].t + 100;
      jogo.acao(anaId, { tipo: 'acerto', i: 0 });
      jogo.acao(anaId, { tipo: 'resultado' });
    }
    // a Bia não respondeu: o relógio fecha a rodada
    if (jogo.publico(anaId).fase === 'jogando') m.andar();
    assert.equal(jogo.publico(anaId).fase, 'revelando');
    assert.equal(m.relogio[0].ms, REVELACAO_MS);
    const linhas = jogo.publico(anaId).linhas as Linha[];
    assert.equal(linhas.find((l) => l.userId === biaId)!.motivo, 'nada', 'quem não respondeu aparece, com zero');
    m.andar();
  }
  assert.equal(vistos.size, 5, 'nenhum microjogo repetido');
  assert.equal(m.terminou(), true);
  assert.equal(jogo.publico(anaId).fase, 'fim');
  const placar = jogo.publico(anaId).placar as { userId: number; pontos: number }[];
  assert.deepEqual(placar.map((l) => [l.userId, l.pontos]), [
    [anaId, 50],
    [biaId, 0],
  ]);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].pontos, daAna[0].tempoMs], ['festa', 1, 50, null]);
  assert.deepEqual(daAna[0].rivais.map((r: { userId: number }) => r.userId), [biaId]);
  const daBia = (await comToken(app, bia.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daBia.filter((t: { pista: string }) => t.pista === 'festa').length, 0, 'sem ponto, sem troféu');
});

test('sozinho: a festa começa pela rota do Solo, e sem pódio', async () => {
  const comAna = comToken(app, ana.token);
  const r = await comAna('POST', '/api/minijogo-solo', { jogo: 'festa' });
  assert.equal(r.statusCode, 200, r.body);
  const p = r.json().partida;
  assert.equal(p.jogo, 'festa');
  assert.equal(p.fase, 'preparando');
  assert.equal(p.rodadas, 5);
  await comAna('DELETE', '/api/minijogo-solo');
});
