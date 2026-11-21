/**
 * O modo Relâmpago da Festa (minijogo-festa-relampago.ts): microjogos curtos que aceleram, com vidas, cada um na própria tela;
 * o servidor confere cada resposta pelo relógio dele e pelos dados que só ele sorteou. O relógio e o sorteio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarFesta, PREPARO_MS } = await import('../src/minijogo-festa.js');
const rel = await import('../src/minijogo-festa-relampago.js');
after(fechar);

let agora = 40_000_000;
const ana = await criarConta(app, 'ana-relampago');
const bia = await criarConta(app, 'bia-relampago');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do relâmpago' })).json() as { id: number };

type Dados = ReturnType<typeof rel.sortearRelampago>;
type Estado = {
  modo: string;
  fase: string;
  indice: number;
  dados: Dados | null;
  jogadores: { userId: number; vidas: number; acertos: number; caiu: boolean }[];
  meu: boolean | null;
  classificacao: { userId: number; posicao: number | null; pontos: number }[] | null;
};

function comecar(naSala = [anaId, biaId], semente = 3, solo = false) {
  let s = semente;
  const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: solo ? 0 : comunidade.id,
    solo,
  };
  const jogo = criarFesta({ agora: () => agora, aleatorio }).comecar(ctx as never, { naSala, criadaPor: naSala[0], corpo: { modo: 'relampago' } });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    relogio,
    terminou: () => terminou,
    estado: (quem = anaId) => jogo.publico(quem) as unknown as Estado,
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
  };
}

/** A resposta honesta e certa para os dados, e o instante dela. */
function respostaCerta(d: Dados): { t: number; r?: number } {
  switch (d.tipo) {
    case 'toque':
      return { t: d.aparece + 250, r: d.casa };
    case 'lado':
      return { t: d.aparece + 250, r: d.direcao };
    case 'espere':
      return { t: d.aparece + 250 };
    case 'pare': {
      // o primeiro instante em que a barra está no meio da faixa
      const alvo = (d.de + d.ate) / 2;
      for (let t = 0; t < 5000; t += 5) if (Math.abs(rel.barraDoPare(d.periodo, t) - alvo) < 2) return { t };
      return { t: 0 };
    }
    default:
      return rel.respostaHonesta(d);
  }
}

test('o modo relâmpago: a largada, os microjogos que aceleram, e o sorteio repetível', () => {
  assert.ok(rel.duracaoRelampago(0) >= 4000 && rel.duracaoRelampago(0) <= 5000);
  assert.ok(rel.duracaoRelampago(10) < rel.duracaoRelampago(0), 'acelera');
  assert.equal(rel.duracaoRelampago(100), rel.RELAMPAGO_MINIMO_MS, 'até um mínimo');
  const a = (s: number) => {
    let x = s;
    return () => (x = (x * 16807) % 2147483647) / 2147483647;
  };
  assert.deepEqual(rel.sortearRelampago(3, a(9)), rel.sortearRelampago(3, a(9)));
  const m = comecar();
  assert.equal(m.estado().modo, 'relampago');
  assert.equal(m.estado().fase, 'preparando');
  assert.equal(m.relogio[0].ms, PREPARO_MS);
  m.andar();
  assert.equal(m.estado().fase, 'jogando');
  assert.equal(m.estado().indice, 0);
  assert.ok(m.estado().dados);
});

test('cada resposta é conferida: a certa na hora vale; a errada, a adiantada e a do console fora da hora perdem a vida', () => {
  const m = comecar();
  m.andar();
  const largou = agora;
  const d = m.estado().dados!;
  const certa = respostaCerta(d);
  // a Bia, pelo console, manda a resposta certa com um tempo que o servidor ainda não viu passar
  agora = largou + 50;
  assert.equal(m.jogo.acao(biaId, { tipo: 'acerto', k: 0, t: certa.t, r: certa.r }), null);
  assert.equal(m.estado(biaId).meu, null, 'não contou');
  // a Ana responde certo, na hora
  agora = largou + certa.t + 120;
  assert.equal(m.jogo.acao(anaId, { tipo: 'acerto', k: 0, t: certa.t, r: certa.r }), null);
  assert.equal(m.estado(anaId).meu, true);
  // outra resposta da Ana não muda nada
  m.jogo.acao(anaId, { tipo: 'acerto', k: 0, t: certa.t + 10, r: 99 });
  assert.equal(m.estado(anaId).meu, true);
  // a Bia não acerta a tempo: no fim do microjogo, perde uma vida
  m.andar();
  const e = m.estado();
  assert.equal(e.fase, 'intervalo');
  const de = (id: number) => e.jogadores.find((j) => j.userId === id)!;
  assert.equal(de(anaId).vidas, rel.VIDAS_RELAMPAGO);
  assert.equal(de(anaId).acertos, 1);
  assert.equal(de(biaId).vidas, rel.VIDAS_RELAMPAGO - 1);
});

test('a resposta errada vale como erro (e não deixa tentar de novo)', () => {
  const m = comecar([anaId, biaId], 11);
  m.andar();
  const largou = agora;
  const d = m.estado().dados!;
  const certa = respostaCerta(d);
  agora = largou + certa.t + 100;
  if (d.tipo === 'espere' || d.tipo === 'pare') {
    // antes do sinal (ou fora da faixa): no 'espere', cedo demais; no 'pare', a ponta da barra (0) fica fora da faixa
    m.jogo.acao(anaId, { tipo: 'acerto', k: 0, t: d.tipo === 'espere' ? Math.max(0, d.aparece - 200) : 0 });
  } else m.jogo.acao(anaId, { tipo: 'acerto', k: 0, t: certa.t, r: rel.respostaErrada(d).r });
  assert.equal(m.estado(anaId).meu, false);
  m.jogo.acao(anaId, { tipo: 'acerto', k: 0, t: certa.t, r: certa.r });
  assert.equal(m.estado(anaId).meu, false, 'não se tenta de novo');
});

test('na sala, acaba quando sobra um; quem acertou mais tempo vence, e o pódio vai para a estante', async () => {
  const m = comecar([anaId, biaId], 5);
  m.andar();
  let voltas = 0;
  while (m.estado().fase !== 'fim' && voltas++ < 200) {
    const e = m.estado();
    if (e.fase === 'jogando') {
      // a Ana acerta sempre; a Bia nunca responde
      const d = e.dados!;
      const c = respostaCerta(d);
      const largou = agora;
      agora = largou + c.t + 100;
      m.jogo.acao(anaId, { tipo: 'acerto', k: e.indice, t: c.t, r: c.r });
      const r = m.relogio[0];
      agora = largou + r.ms;
      r.depois();
      continue;
    }
    m.andar();
  }
  const e = m.estado();
  assert.equal(e.fase, 'fim');
  assert.equal(m.terminou(), true);
  assert.equal(e.indice, rel.VIDAS_RELAMPAGO - 1, 'a Bia caiu no terceiro microjogo, e acabou ali');
  assert.deepEqual(
    e.classificacao!.map((l) => [l.userId, l.posicao, l.pontos]),
    [
      [anaId, 1, rel.VIDAS_RELAMPAGO],
      [biaId, 2, 0],
    ],
  );
  const trofeus = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number }[];
  assert.ok(trofeus.some((t) => t.pista === 'festa-relampago' && t.posicao === 1));
});

test('sozinho: vai até as vidas acabarem, sem pódio', () => {
  const m = comecar([anaId], 8);
  m.andar();
  let voltas = 0;
  let acertou = 0;
  while (m.estado().fase !== 'fim' && voltas++ < 300) {
    const e = m.estado();
    if (e.fase === 'jogando' && acertou < 5) {
      const c = respostaCerta(e.dados!);
      const largou = agora;
      agora = largou + c.t + 100;
      m.jogo.acao(anaId, { tipo: 'acerto', k: e.indice, t: c.t, r: c.r });
      acertou++;
      const r = m.relogio[0];
      agora = largou + r.ms;
      r.depois();
      continue;
    }
    m.andar();
  }
  const e = m.estado();
  assert.equal(e.fase, 'fim');
  assert.equal(e.indice, 5 + rel.VIDAS_RELAMPAGO - 1, 'cinco acertos, depois três erros');
  assert.equal(e.jogadores[0].acertos, 5);
  assert.equal(e.classificacao![0].posicao, null, 'sozinho, sem pódio');
});

test('o recorde do Solo: os acertos contados pelo servidor, na tabela comum (e na sala, nada)', async () => {
  const db = await import('../src/db.js');
  const antes = db.recordeDoSolo(anaId, 'festa-relampago')?.valor ?? null;
  const m = comecar([anaId], 8, true);
  assert.equal((m.estado() as unknown as { recordeAntes: number | null }).recordeAntes, antes);
  m.andar();
  let voltas = 0;
  let acertou = 0;
  while (m.estado().fase !== 'fim' && voltas++ < 300) {
    const e = m.estado();
    if (e.fase === 'jogando' && acertou < 7) {
      const c = respostaCerta(e.dados!);
      const largou = agora;
      agora = largou + c.t + 100;
      m.jogo.acao(anaId, { tipo: 'acerto', k: e.indice, t: c.t, r: c.r });
      acertou++;
      const r = m.relogio[0];
      agora = largou + r.ms;
      r.depois();
      continue;
    }
    m.andar();
  }
  const fim = m.estado() as unknown as { recorde: { acertos: number; novo: boolean } };
  assert.equal(fim.recorde.acertos, 7);
  assert.equal(db.recordeDoSolo(anaId, 'festa-relampago')?.valor, Math.max(antes ?? 0, 7));
  // na sala, o público não tem recorde
  const sala = comecar([anaId, biaId], 9);
  assert.equal('recordeAntes' in sala.estado(), false);
});

test('os oito tipos novos (21/11/2026): todos saem no sorteio, a resposta honesta vale e a errada não, e o tempo é conferido', () => {
  let s = 77;
  const a = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const vistos = new Set<string>();
  let anterior: (typeof rel.TIPOS_RELAMPAGO)[number] | null = null;
  for (let i = 0; i < 400; i++) {
    const d = rel.sortearRelampago(i % 30, a, anterior);
    anterior = d.tipo;
    vistos.add(d.tipo);
    const dur = rel.duracaoRelampago(i % 30);
    const c = rel.respostaHonesta(d);
    assert.ok(c.t <= dur, `${d.tipo}: a honesta cabe no tempo (${c.t} de ${dur})`);
    assert.equal(rel.respostaCerta(d, c.t, c.r), true, `${d.tipo}: a honesta vale`);
    const e = rel.respostaErrada(d);
    assert.equal(rel.respostaCerta(d, e.t, e.r), false, `${d.tipo}: a errada não vale`);
  }
  for (const tipo of rel.TIPOS_RELAMPAGO) assert.ok(vistos.has(tipo), `saiu ${tipo}`);
  // as batidas: mais depressa do que um dedo bate não vale
  const toques = { tipo: 'toques' as const, quantas: 5, aparece: 300 };
  assert.equal(rel.respostaCerta(toques, 300 + 100 + 4 * rel.BATIDA_MINIMA_MS - 1, 5), false);
  assert.equal(rel.respostaCerta(toques, 300 + 100 + 4 * rel.BATIDA_MINIMA_MS, 5), true);
  // a memória: antes de a cenoura se esconder, não
  assert.equal(rel.respostaCerta({ tipo: 'memoria', casa: 2, mostra: 900 }, 800, 2), false);
});
