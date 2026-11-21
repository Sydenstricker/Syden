/**
 * Tocas e Torres, 21/11/2026 (lote D da segunda auditoria): os DESAFIOS DO SOLO (o servidor refaz a partida com o computador do
 * desafio, e o recorde é o número que ele calcula: os pontos, a vida da Maravilha ou o tempo) e a VELOCIDADE do Solo (a tela anda
 * até 2×; o relógio do servidor deixa, e mais que isso não).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const { criarTocas, PASSOS_MAX } = await import('../src/minijogo-tocas.js');
const S = await import('../src/tocas/sim.js');
const { criarIA, PERFIS, PERFIL_DO_DESAFIO } = await import('../src/tocas/ia.js');
const db = await import('../src/db.js');

const ana = (await comToken(app, (await criarConta(app, 'ana-desafios')).token)('GET', '/api/me')).json().id as number;

type Jogo = { publico(q: number): Record<string, unknown>; acao(q: number, c: Record<string, unknown>): string | null };

function comecar() {
  let agora = 9_000_000;
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => {},
    naSala: () => [ana],
    nome: () => 'ana',
    comunidade: 0,
    solo: true,
    difundir: () => {},
  };
  const jogo = criarTocas({ agora: () => agora, sorteio: () => 0.25 }).comecar(ctx as never, { naSala: [ana], criadaPor: ana, corpo: {} }) as unknown as Jogo;
  return { j: jogo, estado: () => jogo.publico(ana) as Record<string, any>, passar: (ms: number) => (agora += ms) };
}

/** A tela: o piloto automático joga o desafio contra o computador dele, e anota os comandos. */
function jogarNaTela(semente: number, desafio: S.Desafio) {
  const sim = S.novaPartida(semente, { mapa: 'campo', desafio });
  // no relâmpago o exército já vem pronto: o piloto ataca na hora
  const piloto = criarIA(0, desafio === 'relampago' ? { ...PERFIS.piloto, primeiroAtaque: 0, onda: 6 } : PERFIS.piloto);
  const computador = criarIA(1, PERFIL_DO_DESAFIO[desafio]);
  const lote: [number, S.Comando][] = [];
  while (sim.vencedor === null && sim.passo < PASSOS_MAX + 5) {
    piloto(sim);
    for (const f of sim.fila) if (f.dono === 0) lote.push([sim.passo, f.c]);
    computador(sim);
    S.passo(sim);
  }
  return { sim, lote };
}

/** Manda a partida da tela ao servidor em trechos de 600 passos, com o relógio andando `vel` vezes mais devagar que a partida. */
function mandar(p: ReturnType<typeof comecar>, tela: ReturnType<typeof jogarNaTela>, vel: number) {
  const fim = tela.sim.passo;
  for (let de = 0; de < fim; de += 600) {
    const ate = Math.min(fim, de + 600);
    p.passar(((ate - de) / 10 / vel) * 1000);
    assert.equal(p.j.acao(ana, { tipo: 'trecho', de, ate, lote: tela.lote.filter(([q]) => q >= de && q < ate), ...(ate === fim ? { h: S.assinatura(tela.sim) } : {}) }), null);
  }
}

test('sem desafio a partida é a de sempre; o desafio só vale no Solo (no 2×2 é ignorado)', () => {
  const a = S.novaPartida(77, { mapa: 'campo' });
  const b = S.novaPartida(77, { mapa: 'campo', desafio: null });
  assert.equal(S.assinatura(a), S.assinatura(b));
  assert.equal(S.novaPartida(77, { quatro: true, desafio: 'cerco' }).desafio, null);
  assert.equal(S.novaPartida(77, { desafio: 'invencao' as S.Desafio }).desafio, null);
  // o atacar andando passa pela limpeza do comando
  assert.deepEqual(S.limparComando({ t: 'mover', ids: [1], x: 2, y: 3, atacando: true }), { t: 'mover', ids: [1], x: 2, y: 3, atacando: true });
});

test('o desafio da colheita, refeito pelo servidor a 2×: o recorde é o tempo, calculado aqui', () => {
  const p = comecar();
  assert.equal(p.j.acao(ana, { tipo: 'comecar', desafio: 'colheita', mapa: 'campo' }), null);
  assert.equal(p.estado().desafio, 'colheita');
  const tela = jogarNaTela(p.estado().semente, 'colheita');
  assert.equal(tela.sim.vencedor, 0, 'o piloto colhe a meta');
  assert.equal(tela.sim.motivo, 'desafio');
  mandar(p, tela, 2);
  const r = p.estado().resultado;
  assert.equal(r.venceu, true);
  assert.equal(r.motivo, 'desafio');
  assert.equal(r.conferido, true);
  assert.equal(db.recordeDoSolo(ana, 'tocas', 'desafio-colheita')!.valor, tela.sim.passo * 100);
});

test('o relâmpago no campo: o servidor refaz e guarda o tempo da vitória; a 3× o relógio não deixa', () => {
  const p = comecar();
  assert.equal(p.j.acao(ana, { tipo: 'comecar', desafio: 'relampago', mapa: 'campo' }), null);
  assert.equal(p.estado().nivel, 'facil');
  const tela = jogarNaTela(p.estado().semente, 'relampago');
  assert.equal(tela.sim.vencedor, 0, 'o piloto derruba o centro a tempo');
  // 3× mais rápido que o normal: o servidor recusa
  p.passar(10_000);
  assert.equal(p.j.acao(ana, { tipo: 'trecho', de: 0, ate: 300, lote: [] }), 'Sessão inválida.');
  mandar(p, tela, 2);
  const r = p.estado().resultado;
  assert.equal(r.venceu, true);
  assert.deepEqual(r.recorde, { antes: null, novo: true });
  assert.equal(db.recordeDoSolo(ana, 'tocas', 'desafio-relampago')!.valor, tela.sim.passo * 100);
  // o recorde do nível não foi tocado
  assert.equal(db.recordeDoSolo(ana, 'tocas', 'facil'), null);
});

test('o piloto automático passa nos quatro desafios (no campo, em algumas sementes)', () => {
  for (const d of S.LISTA_DE_DESAFIOS)
    for (const semente of [3, 5, 8]) {
      const { sim } = jogarNaTela(semente, d);
      assert.equal(sim.vencedor, 0, `${d}, semente ${semente}`);
      assert.ok(S.valorDoDesafio(sim) > 0);
    }
});
