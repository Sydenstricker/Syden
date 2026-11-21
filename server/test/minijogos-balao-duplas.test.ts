/**
 * O Estoura-balão, 21/11/2026 (lote D da segunda auditoria): QUEM SAIU CONTINUA (o fantasma manda posição, pega caixa e usa
 * item, mas não é atingido), AS DUPLAS (o item não pega o colega; acaba quando sobra um time, e o troféu é do time) e AS
 * ARENAS NOVAS (largadas e caixas fora das paredes). O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarBalao, LARGADA_MS } = await import('../src/minijogo-balao.js');
const sim = await import('../src/balao-sim.js');
const db = await import('../src/db.js');
after(fechar);

const idDe = async (nome: string) => (await comToken(app, (await criarConta(app, nome)).token)('GET', '/api/me')).json().id as number;
const ana = await idDe('ana-duplas');
const bia = await idDe('bia-duplas');
const cia = await idDe('cia-duplas');
const dani = await idDe('dani-duplas');

interface Linha {
  userId: number;
  equipe: number;
  baloes: number;
  estouros: number;
  vivo: boolean;
  posicao: number | null;
}

/** Uma semente em que as primeiras caixas da Ana dão só lama. */
function sementeDeLama(k: number) {
  for (let i = 1; i < 400_000; i++) {
    const v = i / 400_003;
    const s = Math.floor(v * 2 ** 31);
    if (Array.from({ length: k }, (_, j) => sim.itemDaCaixa(s, ana, j)).every((it) => it === 'lama')) return v;
  }
  throw new Error('nenhuma semente');
}

function comecar(naSala: number[], corpo: Record<string, unknown>, v: number, comunidade = 1) {
  let agora = 7_000_000;
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => String(id),
    comunidade,
    difundir: () => {},
  };
  const jogo = criarBalao({ agora: () => agora, aleatorio: () => v }).comecar(ctx as never, { naSala, criadaPor: naSala[0], corpo: { arena: 'horta', ...corpo } });
  assert.ok(typeof jogo !== 'string');
  agora += LARGADA_MS;
  relogio[0].depois();
  const verde = agora;
  let N = 0;
  const a = sim.arenaPorId('horta');
  const pos = new Map(naSala.map((id, i) => [id, { x: a.largadas[i][0], y: a.largadas[i][1] }]));
  const t = {
    jogo,
    terminou: () => terminou,
    get N() {
      return N;
    },
    linha: (id: number) => (jogo.publico(ana) as { jogadores: Linha[] }).jogadores.find((l) => l.userId === id)!,
    publico: () => jogo.publico(ana) as Record<string, unknown>,
    /** Anda 4 passos: quem tem alvo anda até 8 em direção a ele, e todos mandam a posição. Devolve o que o servidor repassou. */
    passo(alvos: Map<number, { x: number; y: number }>) {
      N += 4;
      agora = verde + (N * 1000) / 60;
      const repassado = new Map<number, unknown>();
      for (const id of naSala) {
        const p = pos.get(id)!, alvo = alvos.get(id);
        if (alvo) {
          const dx = alvo.x - p.x, dy = alvo.y - p.y, d = Math.hypot(dx, dy);
          const k = d > 8 ? 8 / d : 1;
          p.x += dx * k;
          p.y += dy * k;
        }
        repassado.set(id, jogo.tempoReal!(id, { n: N, x: +p.x.toFixed(1), y: +p.y.toFixed(1), a: 0 }));
      }
      return repassado;
    },
    ir(id: number, x: number, y: number) {
      const alvos = new Map([[id, { x, y }]]);
      for (let i = 0; i < 400 && Math.hypot(pos.get(id)!.x - x, pos.get(id)!.y - y) > 0.01; i++) t.passo(alvos);
    },
    esperar(passos: number) {
      for (let i = 0; i < passos; i += 4) t.passo(new Map());
    },
    mandar: (id: number, dados: Record<string, unknown>) => jogo.tempoReal!(id, dados),
  };
  return t;
}

/** A Ana pega a caixa `i` e solta a lama em quem está em (x, y); o alvo avisa que levou. */
function lamaEm(t: ReturnType<typeof comecar>, i: number, alvo: number, x: number, y: number) {
  const [cx, cy] = sim.arenaPorId('horta').caixas[i];
  t.ir(ana, cx, cy);
  t.ir(alvo, x, y);
  t.esperar(sim.INVULNERAVEL + 8);
  assert.equal(t.mandar(ana, { tipo: 'caixa', i, n: t.N }), null);
  t.ir(ana, x - 16, y);
  t.mandar(ana, { tipo: 'lama', n: t.N, x, y });
  t.mandar(alvo, { tipo: 'acertou', id: `${ana}-${t.N}`, n: t.N });
}

test('as arenas novas: as largadas e as caixas ficam fora das paredes, e o repolho quica nelas', () => {
  for (const id of ['pomar', 'canion']) {
    const a = sim.arenaPorId(id);
    assert.equal(a.id, id);
    assert.equal(a.largadas.length, 8);
    for (const [x, y] of a.largadas) assert.ok(!sim.naParede(a, x, y, -sim.MARGEM_DO_KART - 2), `${id}: largada (${x}, ${y}) na parede`);
    for (const [x, y] of a.caixas) assert.ok(!sim.naParede(a, x, y, -sim.MARGEM_DO_KART - 2), `${id}: caixa (${x}, ${y}) na parede`);
    const [cx, cy] = sim.centroDa(a);
    const c = sim.caminhoDoRepolho(a, { n: 0, x: a.largadas[0][0], y: a.largadas[0][1], dx: cx - a.largadas[0][0], dy: cy - a.largadas[0][1] });
    assert.ok(c && c.length > 10);
  }
});

test('quem saiu continua de fantasma: manda posição e solta item, mas não é atingido nem vence', () => {
  const t = comecar([ana, bia, cia], {}, sementeDeLama(5), 0);
  // a Bia perde os três balões na lama da Ana
  for (const i of [0, 1, 2]) {
    const [cx, cy] = sim.arenaPorId('horta').caixas[i];
    lamaEm(t, i, bia, cx + 30, cy);
  }
  assert.equal(t.linha(bia).baloes, 0);
  assert.equal(t.linha(bia).vivo, false);
  assert.equal(t.terminou(), false, 'a Ana e a Cia ainda têm balão');
  // a posição do fantasma é aceita e repassada aos outros
  const r = t.passo(new Map([[bia, { x: 500, y: 300 }]]));
  assert.ok(r.get(bia), 'a posição do fantasma vai aos outros');
  // um "acertou" do fantasma não estoura nada
  const antes = t.linha(bia).estouros;
  lamaEm(t, 3, bia, 380, 650);
  assert.equal(t.linha(bia).baloes, 0);
  assert.equal(t.linha(ana).estouros, 3, 'a lama no fantasma não conta');
  assert.equal(t.linha(bia).estouros, antes);
  t.jogo.parar?.();
});

test('as duplas: o item não pega o colega; sobrou um time, acabou, e o troféu é dos dois que venceram', () => {
  const t = comecar([ana, bia, cia, dani], { duplas: true }, sementeDeLama(7));
  assert.equal(t.publico().duplas, true);
  // os lugares 0 e 2 (Ana e Cia) contra 1 e 3 (Bia e Dani)
  assert.equal(t.linha(ana).equipe, t.linha(cia).equipe);
  assert.equal(t.linha(bia).equipe, t.linha(dani).equipe);
  assert.notEqual(t.linha(ana).equipe, t.linha(bia).equipe);
  // a lama da Ana na Cia (o colega): nada
  const [c0x, c0y] = sim.arenaPorId('horta').caixas[0];
  lamaEm(t, 0, cia, c0x + 30, c0y);
  assert.equal(t.linha(cia).baloes, sim.BALOES);
  // três na Bia e três na Dani: o time delas sai
  for (const i of [1, 2, 3]) {
    const [cx, cy] = sim.arenaPorId('horta').caixas[i];
    lamaEm(t, i, bia, cx + 30, cy);
  }
  assert.equal(t.linha(bia).vivo, false);
  assert.equal(t.terminou(), false, 'a Dani ainda segura o time');
  for (const i of [4, 5, 6]) {
    const [cx, cy] = sim.arenaPorId('horta').caixas[i];
    lamaEm(t, i, dani, cx + 30, cy);
  }
  assert.equal(t.linha(dani).vivo, false);
  assert.equal(t.terminou(), true);
  const tAna = db.trofeusDe(ana).find((x) => x.pista === 'balao');
  const tCia = db.trofeusDe(cia).find((x) => x.pista === 'balao');
  assert.equal(tAna?.posicao, 1);
  assert.equal(tCia?.posicao, 1, 'a Cia, do time que venceu, também em 1º');
  assert.equal(db.trofeusDe(bia).find((x) => x.pista === 'balao'), undefined);
});

test('as duplas só valem com 4, 6 ou 8: com 3, é cada um por si', () => {
  const t = comecar([ana, bia, cia], { duplas: true }, 0.3, 0);
  assert.equal(t.publico().duplas, false);
  t.jogo.parar?.();
});
