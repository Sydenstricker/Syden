/**
 * O Rolê do coelho (minijogo-skate.ts, skate/fisica.ts): o site manda os comandos de cada passo, e o servidor REFAZ a sessão
 * (os pontos são os dele). O Solo (o recorde), a sala de 2 a 8 (o verde, as posições ao vivo conferidas, o placar refeito, o
 * pódio e o recorde que vem da sala) e o relógio, que é de mão aqui.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarSkate, PASSOS_DA_SESSAO, DURACAO_MS, PRAZO_MS, LARGADA_MS, PRAZO_DA_SALA_MS } = await import('../src/minijogo-skate.js');
const fisica = await import('../src/skate/fisica.js');
const { criarPiloto } = await import('../../web/src/skate/piloto.ts');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-skate');
const bia = await criarConta(app, 'bia-skate');
const caio = await criarConta(app, 'caio-skate');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do skate' })).json() as { id: number };

interface Estado {
  fase: string;
  solo: boolean;
  meu: { pontos: number | null; melhorCombo: number | null } | null;
  placar: { userId: number; pontos: number | null; melhorCombo: number | null; posicao: number | null }[];
  recorde: { antes: number | null; novo: boolean } | null;
}

/**
 * Uma sessão honesta, gravada como o site grava: o piloto automático, depois de `parado` passos sem fazer nada (para as
 * sessões da turma darem pontos diferentes). `nada` = só ficar parado o minuto inteiro.
 */
function sessao({ parado = 0, nada = false } = {}) {
  const k = fisica.novoSkatista();
  const piloto = criarPiloto();
  const g = fisica.gravador();
  const posicoes: { n: number; x: number; y: number; z: number; cx: number; cz: number }[] = [];
  while (!k.terminou) {
    const c = nada || k.passo < parado ? fisica.NADA : piloto(k);
    g.anotar(c);
    fisica.passo(k, c);
    if (k.passo % 4 === 0) posicoes.push({ n: k.passo, x: k.x, y: k.y, z: k.z, cx: k.cx, cz: k.cz });
  }
  return { entradas: g.entradas, pontos: k.pontos, melhorCombo: k.melhorCombo, passos: k.passo, posicoes };
}
const honesta = sessao();
const atrasada = sessao({ parado: 400 });
const parada = sessao({ nada: true });

function comecar(naSala: number[], { comunidadeId = 0, solo = false } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou: boolean | null = null;
  let sala = [...naSala];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (completa = true) => (terminou = completa),
    naSala: () => sala,
    nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
    comunidade: comunidadeId,
    solo,
  };
  const jogo = criarSkate({ agora: () => agora }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    estado: (id: number) => jogo.publico(id) as unknown as Estado,
    terminou: () => terminou,
    sair: (id: number) => (sala = sala.filter((x) => x !== id)),
    /** Passa o relógio marcado (a largada, o prazo) e o dispara. */
    relogio: () => {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
  };
}

const fim = (s: { entradas: number[] }) => ({ tipo: 'fim', entradas: s.entradas });

test('a regra: refazer os mesmos comandos dá os mesmos pontos, e o piloto faz uma sessão de verdade', () => {
  assert.ok(honesta.pontos > 10_000, `pontos: ${honesta.pontos}`);
  assert.ok(honesta.passos >= PASSOS_DA_SESSAO);
  for (let i = 0; i < 2; i++) {
    const r = fisica.refazer(honesta.entradas);
    assert.equal(r.k.pontos, honesta.pontos);
    assert.equal(r.k.melhorCombo, honesta.melhorCombo);
    assert.equal(r.k.passo, honesta.passos);
  }
  assert.notEqual(atrasada.pontos, honesta.pontos);
  assert.equal(parada.pontos, 0);
});

test('no Solo, o servidor refaz a sessão: os pontos são os dele, e a pior não substitui o recorde', () => {
  const p = comecar([anaId], { solo: true });
  assert.equal(p.estado(anaId).solo, true);
  assert.equal(p.estado(anaId).recorde?.antes, null);
  // antes de passar o minuto no relógio do servidor, não dá para ter andado a sessão inteira
  agora += 30_000;
  assert.equal(p.jogo.acao(anaId, fim(honesta)), 'Sessão inválida.');
  agora += DURACAO_MS;
  // o site dizer outros pontos não muda nada: valem os refeitos
  assert.equal(p.jogo.acao(anaId, { ...fim(honesta), pontos: 99_999_999 }), null);
  assert.equal(p.terminou(), true);
  const e = p.estado(anaId);
  assert.equal(e.fase, 'fim');
  assert.equal(e.meu?.pontos, honesta.pontos);
  assert.equal(e.meu?.melhorCombo, honesta.melhorCombo);
  assert.deepEqual(e.recorde, { antes: null, novo: true });
  assert.equal(db.recordeDoSkate(anaId), honesta.pontos);
  // uma vez só
  assert.equal(p.jogo.acao(anaId, fim(honesta)), 'Esta rodada já acabou.');

  const q = comecar([anaId], { solo: true });
  agora += DURACAO_MS + 5000;
  assert.equal(q.jogo.acao(anaId, fim(atrasada)), null);
  assert.deepEqual(q.estado(anaId).recorde, { antes: honesta.pontos, novo: false });
  assert.equal(db.recordeDoSkate(anaId), honesta.pontos);
});

test('o servidor recusa comandos inválidos, a sessão pela metade e a que passa do fim', () => {
  const p = comecar([biaId], { solo: true });
  agora += DURACAO_MS + 60_000;
  const invalidas: unknown[] = [
    undefined,
    'abc',
    [],
    [1],
    [1, 256],
    [1, -1],
    [0, 3],
    [1.5, 3],
    [1, '3'],
    [fisica.PASSOS_MAXIMOS + 1, 0],
    // a sessão pela metade (não terminou)
    honesta.entradas.slice(0, Math.floor(honesta.entradas.length / 2) * 2 - 2),
    // passos depois do fim
    [...honesta.entradas, 30, 0],
  ];
  for (const entradas of invalidas) assert.equal(p.jogo.acao(biaId, { tipo: 'fim', entradas }), 'Sessão inválida.', JSON.stringify(entradas)?.slice(0, 40));
  // o formato antigo (os pontos ditos pelo site) não vale mais
  assert.equal(p.jogo.acao(biaId, { tipo: 'fim', pontos: 100, passos: PASSOS_DA_SESSAO, melhorCombo: 0 }), 'Sessão inválida.');
  assert.equal(p.jogo.acao(biaId, { tipo: 'manobra' }), 'Ação desconhecida.');
  assert.equal(p.jogo.acao(999, fim(honesta)), 'Você está assistindo esta partida.');
  assert.equal(p.jogo.acao(biaId, fim(parada)), null);
  // sem pontos, não vira recorde
  assert.equal(db.recordeDoSkate(biaId), null);
});

test('na sala de 3: o verde, as posições ao vivo conferidas, o placar refeito, o pódio e o recorde que vem da sala', () => {
  const p = comecar([anaId, biaId, caioId], { comunidadeId: comunidade.id });
  assert.equal(p.estado(anaId).solo, false);
  assert.equal(p.estado(anaId).fase, 'largada');
  // antes do verde, nada vale
  assert.equal(p.jogo.acao(anaId, fim(honesta)), 'Esta rodada já acabou.');
  assert.equal(p.jogo.tempoReal!(anaId, { n: 4, x: 6, y: 0, z: 9, cx: 0, cz: -1 }), null);
  p.relogio();
  assert.ok(LARGADA_MS > 0);
  assert.equal(p.estado(anaId).fase, 'jogando');

  // AS POSIÇÕES: a primeira volta carimbada com quem mandou; à frente do relógio, fora da pista ou num salto, não
  agora += 2000;
  const a = honesta.posicoes[0];
  const r = p.jogo.tempoReal!(anaId, { ...a, e: 0, b: 1, f: 0, p: 0 }) as Record<string, number>;
  assert.equal(r.userId, anaId);
  assert.equal(r.n, a.n);
  assert.equal(p.jogo.tempoReal!(anaId, { ...honesta.posicoes[1], n: 100 * 60 }), null, 'à frente do relógio');
  assert.equal(p.jogo.tempoReal!(anaId, { ...honesta.posicoes[1], x: 40 }), null, 'fora da pista');
  assert.equal(p.jogo.tempoReal!(anaId, { ...honesta.posicoes[1], x: a.x + 5 }), null, 'salto');
  assert.equal(p.jogo.tempoReal!(anaId, { ...a }), null, 'o mesmo passo de novo');
  assert.ok(p.jogo.tempoReal!(anaId, honesta.posicoes[1]));
  assert.equal(p.jogo.tempoReal!(999, honesta.posicoes[1]), null, 'quem não joga');

  // A SESSÃO MAIS LONGA QUE O RELÓGIO: dois segundos depois do verde, ninguém andou um minuto
  assert.equal(p.jogo.acao(anaId, fim(honesta)), 'Sessão inválida.');
  agora += DURACAO_MS + 8000;
  assert.equal(p.jogo.acao(anaId, fim(honesta)), null);
  assert.equal(p.jogo.acao(biaId, fim(atrasada)), null);
  // falta o Caio: a partida espera, e o placar mostra quem já mandou (sem posição até o fim, para quem ainda anda)
  assert.equal(p.terminou(), null);
  assert.equal(p.estado(caioId).placar.find((l) => l.userId === caioId)?.pontos, null);
  assert.equal(p.jogo.acao(caioId, fim(parada)), null);
  assert.equal(p.terminou(), true);
  const placar = p.estado(anaId).placar;
  const ordem = [
    [anaId, honesta.pontos],
    [biaId, atrasada.pontos],
    [caioId, 0],
  ].sort((x, y) => y[1] - x[1]);
  assert.deepEqual(
    placar.map((l) => [l.userId, l.pontos]),
    ordem,
  );
  assert.deepEqual(
    placar.map((l) => l.posicao),
    [1, 2, 3],
  );
  // o recorde: a Bia nunca tinha andado (só a sessão parada, sem pontos), e a sala virou o recorde dela
  assert.equal(db.recordeDoSkate(biaId), atrasada.pontos);
  assert.deepEqual(p.estado(biaId).recorde, { antes: null, novo: true });
  // O PÓDIO: os que pontuaram vão para a estante, com a pista 'skate' (quem ficou com zero, não)
  for (const [id, pts] of ordem) {
    const t = db.trofeusDe(id).filter((x) => x.pista === 'skate');
    const lugar = ordem.filter(([, q]) => q > 0).findIndex(([o]) => o === id) + 1;
    if (pts > 0) assert.deepEqual(t.map((x) => [x.posicao, x.pontos]), [[lugar, pts]]);
    else assert.equal(t.length, 0);
  }
});

test('na sala, quem sai não segura a partida, e o prazo fecha quem pausou', () => {
  const p = comecar([anaId, biaId], { comunidadeId: comunidade.id });
  p.relogio();
  agora += DURACAO_MS + 3000;
  assert.equal(p.jogo.acao(anaId, fim(atrasada)), null);
  p.sair(biaId);
  p.jogo.conferir!();
  assert.equal(p.terminou(), true);
  // quem saiu não tem posição
  assert.equal(p.estado(anaId).placar.find((l) => l.userId === biaId)?.posicao, null);

  const q = comecar([anaId, biaId], { comunidadeId: comunidade.id });
  q.relogio();
  q.relogio();
  assert.ok(PRAZO_DA_SALA_MS > DURACAO_MS && PRAZO_MS > DURACAO_MS);
  // ninguém mandou: a partida acaba como interrompida
  assert.equal(q.terminou(), false);
});
