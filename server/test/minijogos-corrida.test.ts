/**
 * A corrida ao vivo na sala (minijogo-corrida.ts): a largada é do servidor, a posição só é repassada, e a classificação é
 * pelo tempo de cada um (em passos desde o próprio sinal verde), e não pela ordem em que as chegadas chegam.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarCorrida, FOLGA_MS } = await import('../src/minijogo-corrida.js');
/** O relógio da corrida, na mão: cada teste anda com ele. */
let agora = 1_000_000;
const corrida = criarCorrida(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-corrida');
const bia = await criarConta(app, 'bia-corrida');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

/** Como em corrida.test.ts: um círculo que passa pela linha de chegada da horta-1. */
function corridaDe(porVolta: number) {
  const voltas = [porVolta, porVolta * 2, porVolta * 3];
  const r = Math.hypot(250 - 500, 190 - 500), a0 = Math.atan2(190 - 500, 250 - 500);
  const amostras: number[] = [];
  for (let p = 1; p <= voltas[2]; p += 4) {
    const a = a0 + (2 * Math.PI * (p - 1)) / porVolta;
    amostras.push(Math.round((500 + Math.cos(a) * r) * 10), Math.round((500 + Math.sin(a) * r) * 10), Math.round(a * 1000));
  }
  return { tipo: 'chegada', voltas, amostras };
}

/** O motor de mentira: o relógio é chamado na mão. */
function contexto(naSala: number[]) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    ctx: {
      agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala: () => naSala,
      nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    },
  };
}

test('antes do verde não se chega; quem chega por último na rede, mas com tempo menor, ganha', () => {
  const m = contexto([anaId, biaId]);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.publico(anaId).fase, 'largada');
  assert.ok(jogo.acao(anaId, corridaDe(1300)), 'chegar durante a contagem é recusado');
  m.relogio[0].depois();
  assert.equal(jogo.publico(anaId).fase, 'correndo');
  // o fantasma guardado, mandado pelo console 1 s depois do verde (revisão de 03/11/2026): o relógio não deixa
  agora += 1000;
  assert.ok(jogo.acao(anaId, corridaDe(1300)), 'chegar em 1:05 com 1 s de corrida é recusado');
  assert.equal(m.relogio[0].ms, 5 * 60_000, 'e não abre o prazo de ninguém');

  agora += 64_000 - FOLGA_MS;
  assert.equal(jogo.acao(anaId, corridaDe(1300)), null, 'a Ana chega primeiro, com 1:05');
  assert.equal(m.relogio[0].ms, 30_000, 'e abre o prazo de 30 s');
  assert.equal(m.terminou(), false);
  assert.equal(jogo.acao(biaId, corridaDe(1250)), null, 'a Bia chega depois, mas com 1:02,5');
  assert.equal(m.terminou(), true, 'todo mundo chegou: acabou');
  const pilotos = jogo.publico(anaId).pilotos as { userId: number; tempoMs: number }[];
  assert.deepEqual(pilotos.map((p) => p.userId), [biaId, anaId], 'a Bia em primeiro, pelo tempo');
});

test('fantasma que não fecha é recusado; quem não chega fica atrás, pelo quanto andou', () => {
  const m = contexto([anaId, biaId]);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  m.relogio[0].depois();
  agora += 120_000;
  const torta = corridaDe(1300);
  torta.amostras[30] += 5000;
  assert.ok(jogo.acao(anaId, torta), 'o salto de posição é recusado');
  assert.equal(jogo.tempoReal!(biaId, { x: 2000, y: 1, a: 0, n: 1, andou: 1 }), null, 'posição fora do mapa não é repassada');
  assert.equal(jogo.tempoReal!(biaId, { x: 10, y: 20, a: 0, n: 2, andou: 3.5 }), null, 'nem quem diz ter andado mais que a corrida');
  assert.deepEqual(jogo.tempoReal!(biaId, { x: 10, y: 20, a: 0.5, n: 40, andou: 1.4 }), { userId: biaId, x: 10, y: 20, a: 0.5, n: 40, andou: 1.4 });
  jogo.tempoReal!(anaId, { x: 10, y: 20, a: 0.5, n: 40, andou: 0.8 });
  m.relogio[0].depois(); // a corrida passou de 5 min
  assert.equal(m.terminou(), true);
  const pilotos = jogo.publico(anaId).pilotos as { userId: number; tempoMs: number | null }[];
  assert.deepEqual(pilotos.map((p) => [p.userId, p.tempoMs]), [[biaId, null], [anaId, null]], 'a Bia andou mais');
});

test('a corrida da sala que bate o recorde vira o recorde', async () => {
  const m = contexto([anaId, biaId]);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  m.relogio[0].depois();
  agora += 120_000;
  assert.equal(jogo.acao(anaId, corridaDe(1200)), null);
  const recordes = (await comToken(app, ana.token)('GET', '/api/corrida/horta-1')).json().recordes;
  assert.equal(recordes[0].tempoMs, 60_000);
});
