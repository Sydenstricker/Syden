/**
 * O Sudoku pela TÉCNICA e o Sudoku X (20/11/2026, a segunda auditoria): o resolvedor lógico diz o nível do tabuleiro, cada
 * dificuldade sai com a técnica dela (o Difícil não sai só com singles), o gerador respeita o prazo, e no X as diagonais valem.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Contexto } from '../src/minijogo-motor.js';
import { criarConta, comToken, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');
const L = await import('../src/sudoku-logica.js');
const { sudoku } = await import('../src/minijogo-sudoku.js');

/** Um sorteio com semente, para o teste ser o mesmo sempre. */
const semente = (s: number) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

/** Só singles (nus e escondidos): resolve até onde dá e diz se terminou. */
function soComSingles(enigma: number[], x = false): boolean {
  const g = [...enigma];
  for (let andou = true; andou; ) {
    andou = false;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = L.livres(g, i, x);
      if (m && (m & (m - 1)) === 0) {
        g[i] = 31 - Math.clz32(m);
        andou = true;
      }
    }
    for (const u of L.unidadesDe(x))
      for (let d = 1; d <= 9; d++) {
        if (u.some((i) => g[i] === d)) continue;
        const onde = u.filter((i) => !g[i] && L.livres(g, i, x) & (1 << d));
        if (onde.length === 1) {
          g[onde[0]] = d;
          andou = true;
        }
      }
  }
  return g.every((n) => n !== 0);
}

/** A grade cumpre a regra (e as diagonais, no X)? */
function valida(g: number[], x = false) {
  return L.unidadesDe(x).every((u) => new Set(u.map((i) => g[i])).size === 9 && u.every((i) => g[i] >= 1 && g[i] <= 9));
}

for (const x of [false, true]) {
  const nome = x ? 'Sudoku X' : 'clássico';
  test(`${nome}: Fácil, Médio e Difícil saem com a técnica deles, com solução única`, () => {
    const aleatorio = semente(x ? 77 : 41);
    for (const [dificuldade, pedido] of Object.entries(L.PEDIDO)) {
      if (dificuldade === 'extremo') continue;
      const g = L.gerarPelaTecnica(pedido, { x, aleatorio, prazoMs: 5_000 });
      assert.equal(L.distancia(g, pedido), 0, `${dificuldade}: nível ${g.nivel}`);
      assert.equal(L.contarSolucoes([...g.enigma], 2, x), 1);
      assert.ok(valida(g.solucao, x));
      assert.ok(g.enigma.every((n, i) => n === 0 || n === g.solucao[i]));
      assert.ok(g.enigma.filter((n) => n === 0).length >= pedido.vazias, dificuldade);
      // o Difícil NÃO sai só com singles; o Fácil e o Médio saem
      assert.equal(soComSingles(g.enigma, x), dificuldade !== 'dificil', dificuldade);
    }
  });

  test(`${nome}: o Muito difícil pede o X-wing (e não sai sem ele)`, () => {
    const g = L.gerarPelaTecnica(L.PEDIDO.extremo, { x, aleatorio: semente(x ? 5 : 3), prazoMs: 20_000, tentativas: 5_000 });
    assert.equal(g.nivel, L.NIVEL_XWING);
    assert.equal(L.contarSolucoes([...g.enigma], 2, x), 1);
    assert.equal(soComSingles(g.enigma, x), false);
  });
}

test('o resolvedor: tabuleiro cheio é nível 0, e o vazio (muitas soluções) pede chute', () => {
  const g = new Array<number>(81).fill(0);
  L.preencher(g, semente(9));
  assert.equal(L.nivelDoTabuleiro(g), 0);
  assert.equal(L.nivelDoTabuleiro(new Array<number>(81).fill(0)), L.NIVEL_CHUTE);
});

test('o gerador respeita o prazo: sem acertar o Muito difícil, devolve o mais perto, sem pedir chute', () => {
  const t0 = performance.now();
  const g = L.gerarPelaTecnica(L.PEDIDO.extremo, { aleatorio: semente(1234), prazoMs: 60 });
  assert.ok(performance.now() - t0 < 1_000, 'não segura o servidor');
  assert.notEqual(g.nivel, L.NIVEL_CHUTE);
  assert.equal(L.contarSolucoes([...g.enigma]), 1);
});

test('a tentativa aos poucos é a mesma tentativa, parando a cada casa', () => {
  const a = L.tentativa(semente(31), L.PEDIDO.dificil);
  const passos = L.tentativaAosPoucos(semente(31), L.PEDIDO.dificil);
  let paradas = 0;
  let r = passos.next();
  while (!r.done) {
    paradas++;
    r = passos.next();
  }
  assert.deepEqual(r.value, a);
  assert.ok(paradas > 10);
});

test('Sudoku X pela partida: as diagonais valem, e o recorde é à parte', async () => {
  const ana = await criarConta(app, 'ana-sudoku-x');
  const anaId = (await comToken(app, ana.token)('GET', '/api/me')).json().id as number;
  const ctx: Contexto = { agendar: () => {}, avisar: () => {}, terminar: () => {}, naSala: () => [anaId], nome: () => 'ana', solo: true };
  const jogo = sudoku.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: { dificuldade: 'facil', x: true } });
  assert.ok(typeof jogo !== 'string');
  const visto = () => jogo.publico(anaId) as { enigma: number[]; x: boolean; largada: { x: boolean }; corrida: { tempoMs: number | null }[] };
  assert.equal(visto().x, true);
  assert.equal(visto().largada.x, true);
  // a solução (única) que cumpre as diagonais
  const solucao = [...visto().enigma];
  assert.ok(L.preencher(solucao, Math.random, true));
  assert.ok(valida(solucao, true), 'as diagonais têm os nove números');
  for (let i = 0; i < 81; i++) if (visto().enigma[i] === 0) assert.equal(jogo.acao(anaId, { tipo: 'jogada', casa: i, valor: solucao[i] }), null);
  assert.notEqual(visto().corrida[0].tempoMs, null);
  for (let k = 0; k < 100 && !db.recordeDoSolo(anaId, 'sudoku', 'facil:x'); k++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(db.recordeDoSolo(anaId, 'sudoku', 'facil:x'), 'o recorde do X');
  assert.equal(db.recordeDoSolo(anaId, 'sudoku', 'facil'), null, 'o clássico não muda');
});
