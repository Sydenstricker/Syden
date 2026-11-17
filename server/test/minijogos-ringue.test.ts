/**
 * O Ringue da toca (minijogo-ringue.ts): o site luta e manda os comandos de cada passo em trechos; o servidor refaz o circuito
 * inteiro com a mesma regra (ringue-sim.ts) e a mesma semente, e o resultado é o dele. O relógio aqui é de mão. Os comandos
 * honestos vêm do piloto automático do site (web/src/ringue/piloto.ts), que lê os avisos como quem joga.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarRingue } = await import('../src/minijogo-ringue.js');
const sim = await import('../src/ringue-sim.js');
const { comandoDoPiloto } = await import(new URL('../../web/src/ringue/piloto.ts', import.meta.url).href);
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-ringue');
const bia = await criarConta(app, 'bia-ringue');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

interface Estado {
  fase: string;
  semente: number;
  meu: { vencidas: number; passos: number; dano: number } | null;
  placar: { userId: number; resultado: { vencidas: number } | null; posicao: number | null }[];
  recorde: { antes: unknown; novo: boolean } | null;
}

function comecar(naSala: number[], solo: boolean) {
  let terminou = false;
  const marcados: (() => void)[] = [];
  const ctx = {
    agendar: (_ms: number, f: () => void) => marcados.push(f),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: solo ? 0 : 1,
    solo,
  };
  const jogo = criarRingue({ agora: () => agora, aleatorio: () => 0.3141 }).comecar(ctx as never, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return { jogo, estado: (id: number) => jogo.publico(id) as unknown as Estado, terminou: () => terminou, marcados };
}

/** Uma luta honesta: o piloto lendo os avisos, de vez em quando sem reagir (`erro`), e os comandos em trechos. */
function lutar(semente: number, erro = 0) {
  const l = sim.novaLuta(semente);
  const entradas: number[] = [];
  let x = semente;
  let falha = false;
  while (!l.terminou) {
    if (l.a.estado === 'aviso' && l.a.t === 0) {
      x = (x * 48271) % 2147483647;
      falha = (x % 1000) / 1000 < erro;
    }
    const bits = falha && l.a.estado === 'aviso' ? 0 : comandoDoPiloto(l);
    sim.anotar(entradas, bits);
    sim.passo(l, bits);
  }
  return { entradas, l };
}

test('as duas cópias da regra são iguais (o servidor refaz com a mesma conta do site)', () => {
  const site = readFileSync(new URL('../../web/src/ringue/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../src/ringue-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/ringue/sim.ts e server/src/ringue-sim.ts mudaram separados: copie um sobre o outro');
});

test('no Solo, o circuito honesto é refeito, e o resultado e o recorde são os do servidor', () => {
  const p = comecar([anaId], true);
  const semente = p.estado(anaId).semente;
  const { entradas, l } = lutar(semente);
  assert.equal(l.vencidas, 3, 'o piloto vence o circuito');
  // depressa demais: o relógio do servidor não viu o circuito passar
  agora += 5000;
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', entradas }), 'Sessão inválida.');
  agora += (l.passo / 60) * 1000;
  assert.equal(p.jogo.acao(biaId, { tipo: 'fim', entradas }), 'Você está assistindo esta partida.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', entradas }), null);
  const e = p.estado(anaId);
  assert.deepEqual(e.meu, { vencidas: 3, passos: l.passo, dano: 0 });
  assert.equal(e.recorde?.novo, true);
  assert.ok(p.terminou());
  assert.deepEqual({ ...db.recordeDoRingue(anaId) }, { vencidas: 3, passos: l.passo, dano: 0 });
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', entradas }), 'Esta rodada já acabou.');
});

test('comandos impossíveis ou incompletos são recusados', () => {
  const p = comecar([anaId], true);
  const semente = p.estado(anaId).semente;
  const { entradas } = lutar(semente);
  agora += 30 * 60_000;
  const fim = (e: unknown) => p.jogo.acao(anaId, { tipo: 'fim', entradas: e });
  // um bit que não existe, passos não inteiros, trecho vazio, lista ímpar, nada
  assert.equal(fim([10, 128]), 'Sessão inválida.');
  assert.equal(fim([1.5, 0]), 'Sessão inválida.');
  assert.equal(fim([0, 0]), 'Sessão inválida.');
  assert.equal(fim([10]), 'Sessão inválida.');
  assert.equal(fim([]), 'Sessão inválida.');
  assert.equal(fim('16'), 'Sessão inválida.');
  // além do tamanho máximo
  assert.equal(fim([sim.PASSOS_MAXIMOS + 1, 0]), 'Sessão inválida.');
  // o circuito pela metade (não terminou)
  assert.equal(fim(entradas.slice(0, entradas.length - 2)), 'Sessão inválida.');
  // passos além do fim
  assert.equal(fim([...entradas, 60, 0]), 'Sessão inválida.');
  // os comandos de outra semente não dão o mesmo circuito: com eles a luta não fecha no mesmo passo
  const outra = lutar(semente + 1).entradas;
  assert.equal(fim(outra), 'Sessão inválida.');
  // e o honesto passa
  assert.equal(fim(entradas), null);
});

test('um recorde pior não substitui o melhor', () => {
  const antes = db.recordeDoRingue(anaId);
  const p = comecar([anaId], true);
  const semente = p.estado(anaId).semente;
  // nunca defende: perde cedo
  const { entradas, l } = lutar(semente, 1);
  assert.ok(l.vencidas < 3);
  agora += 30 * 60_000;
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', entradas }), null);
  assert.equal(p.estado(anaId).recorde?.novo, false);
  assert.deepEqual(db.recordeDoRingue(anaId), antes);
});

test('na sala: a mesma semente, quem foi mais longe ganha, e o pódio vai à estante', () => {
  const p = comecar([anaId, biaId], false);
  assert.equal(p.estado(anaId).fase, 'largada');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', entradas: [1, 0] }), 'Esta rodada já acabou.');
  p.marcados.shift()!(); // o verde
  assert.equal(p.estado(anaId).fase, 'jogando');
  const semente = p.estado(anaId).semente;
  assert.equal(p.estado(biaId).semente, semente);
  // o tempo real: só o progresso, carimbado, e não mais que um por 400 ms
  const r = p.jogo.tempoReal!(anaId, { adv: 1, quedas: 2, caido: false, extra: 'x' });
  assert.deepEqual(r, { userId: anaId, adv: 1, quedas: 2, caido: false });
  assert.equal(p.jogo.tempoReal!(anaId, { adv: 1 }), null);
  const boa = lutar(semente);
  const fraca = lutar(semente, 1);
  agora += 30 * 60_000;
  assert.equal(p.jogo.acao(biaId, { tipo: 'fim', entradas: fraca.entradas }), null);
  assert.ok(!p.terminou(), 'espera a outra');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', entradas: boa.entradas }), null);
  assert.ok(p.terminou());
  const placar = p.estado(anaId).placar;
  assert.equal(placar[0].userId, anaId);
  assert.equal(placar[0].posicao, 1);
  assert.equal(placar[1].posicao, 2);
  const trofeu = db.trofeusDe(anaId).find((t) => t.pista === 'ringue');
  assert.ok(trofeu, 'o troféu da ana');
  assert.equal(trofeu!.posicao, 1);
  assert.equal(trofeu!.pontos, 3);
  assert.equal(trofeu!.tempoMs, Math.round((boa.l.passo / 60) * 1000));
});
