import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bloco, blocoEm, COPAS_DO_PULO, FASES, LINHAS, T, type Fase } from '../src/plataforma/fases';
import { AMOSTRA, amostrar, fantasmaEm, novoCoelho, passo, passosEmMs, type Comandos } from '../src/plataforma/fisica';
import { planejar } from '../src/plataforma/piloto';

/** O piloto automático planeja e corre a fase; devolve o coelho e o fantasma, como o laço os guarda. */
function correr(f: Fase) {
  const plano = planejar(f, novoCoelho(f));
  assert.ok(plano, `${f.id}: o piloto automático não achou o caminho`);
  const k = novoCoelho(f);
  const caminho: number[] = [];
  for (const c of plano) {
    const antes = k.terminou;
    passo(k, c, f);
    if (!antes) amostrar(k, caminho);
  }
  return { k, caminho };
}

const planos = new Map(FASES.map((f) => [f.id, correr(f)]));

test('toda fase se termina, sem cair, num tempo de fase curta (30 a 60 s)', () => {
  for (const f of FASES) {
    const { k, caminho } = planos.get(f.id)!;
    assert.equal(k.terminou, true, `${f.id}: não terminou`);
    const s = k.chegouEm / 60;
    assert.ok(s >= 25 && s <= 60, `${f.id}: ${s.toFixed(1)} s`);
    assert.equal(caminho.length, 3 * (Math.floor((k.chegouEm - 1) / AMOSTRA) + 1), 'uma amostra a cada 4 passos, até a chegada');
  }
});

test('o fantasma honesto passa no servidor, e as medidas das fases batem com as dele', async () => {
  const { FASES_DO_PULO, COPAS_DO_PULO: NO_SERVIDOR, validarPulo } = await import('../../server/src/plataforma.ts');
  assert.deepEqual(COPAS_DO_PULO, NO_SERVIDOR);
  for (const f of FASES) {
    const s = FASES_DO_PULO[f.id];
    assert.ok(s, `${f.id} existe no servidor`);
    assert.deepEqual(s.largada, [f.largada.x, f.largada.y]);
    assert.equal(s.chegada, f.chegada);
    assert.equal(s.largura, f.colunas * T);
    assert.deepEqual(s.postos, f.postos.map((p) => [p.x, p.y]));
    // os trechos rápidos são os das plataformas que andam de lado
    const deLado = f.moveis.filter((m) => m.x0 !== m.x1).map((m) => [Math.min(m.x0, m.x1), Math.max(m.x0, m.x1) + m.w]);
    assert.deepEqual(s.rapidos, deLado, `${f.id}: os trechos rápidos`);
    const { k, caminho } = planos.get(f.id)!;
    const v = validarPulo(f.id, { passos: k.chegouEm, amostras: caminho });
    assert.ok('ok' in v, `${f.id}: o servidor recusou a corrida honesta`);
    assert.equal(v.ok.tempoMs, passosEmMs(k.chegouEm));
  }
});

test('cair num buraco volta ao posto, e o servidor aceita essa volta', async () => {
  const { validarPulo } = await import('../../server/src/plataforma.ts');
  const f = FASES[0];
  const k = novoCoelho(f);
  const caminho: number[] = [];
  // corre para a direita sem pular: cai no primeiro buraco e volta à largada
  const direita: Comandos = { esquerda: false, direita: true, pula: false };
  for (let i = 0; i < 200 && k.quedas === 0; i++) {
    passo(k, direita, f);
    amostrar(k, caminho);
  }
  assert.equal(k.quedas, 1, 'caiu');
  assert.equal(k.x, f.largada.x, 'e voltou à largada');
  // daí em diante, o plano do piloto automático leva até a chegada
  const plano = planejar(f, k)!;
  assert.ok(plano);
  for (const c of plano) {
    const antes = k.terminou;
    passo(k, c, f);
    if (!antes) amostrar(k, caminho);
  }
  assert.ok(k.terminou);
  assert.ok('ok' in validarPulo(f.id, { passos: k.chegouEm, amostras: caminho }), 'a volta ao posto não é um salto proibido');
});

test('o mesmo plano dá sempre o mesmo tempo (o tempo é de passos, não do relógio)', () => {
  const f = FASES[1];
  assert.equal(correr(f).k.chegouEm, planos.get(f.id)!.k.chegouEm);
});

test('o pulo é mais alto segurando o botão, e a mola leva mais alto que o pulo', () => {
  const f = FASES[0];
  const altura = (segurar: number) => {
    const k = novoCoelho(f);
    let topo = k.y;
    for (let i = 0; i < 60; i++) {
      passo(k, { esquerda: false, direita: false, pula: i < segurar }, f);
      topo = Math.min(topo, k.y);
    }
    return f.largada.y - topo;
  };
  assert.ok(altura(30) > altura(3) * 1.8, `segurando ${altura(30).toFixed(0)}, tocando ${altura(3).toFixed(0)}`);
  // a folga do coiote: pular 4 passos depois de sair da beirada ainda vale
  const k = novoCoelho(f);
  const beirada = 20 * T;
  while (k.x - 5 < beirada) passo(k, { esquerda: false, direita: true, pula: false }, f);
  passo(k, { esquerda: false, direita: true, pula: false }, f);
  passo(k, { esquerda: false, direita: true, pula: false }, f);
  passo(k, { esquerda: false, direita: true, pula: true }, f);
  passo(k, { esquerda: false, direita: true, pula: true }, f);
  assert.ok(k.vy < 0, 'pulou fora da beirada');
  // a mola do prado (coluna 104, em cima do chão de altura 3): cair nela joga para cima, mais alto que o pulo
  const m = novoCoelho(f);
  m.x = 104 * T + T / 2;
  m.y = (LINHAS - 4) * T - 2;
  m.noChao = false;
  for (let i = 0; i < 30 && !m.molou; i++) passo(m, { esquerda: false, direita: false, pula: false }, f);
  assert.equal(m.molou, true, 'bateu na mola');
  let topo = m.y;
  for (let i = 0; i < 60; i++) {
    passo(m, { esquerda: false, direita: false, pula: false }, f);
    topo = Math.min(topo, m.y);
  }
  assert.ok((LINHAS - 4) * T - topo > altura(30) * 2, 'a mola leva bem mais alto');
});

test('o fantasma se acha no meio do caminho, e some depois da chegada', () => {
  const { k, caminho } = planos.get('prado-1')!;
  const meio = fantasmaEm(caminho, 401);
  assert.ok(meio && meio.x > 100);
  assert.equal(fantasmaEm(caminho, k.chegouEm + 10), null);
});

test('a largada e os postos estão em cima de chão', () => {
  for (const f of FASES) {
    for (const p of f.postos) {
      const l = p.y / T;
      assert.ok(l < LINHAS && blocoEm(f, Math.floor(p.x / T), l) === Bloco.Chao, `${f.id}: posto em ${p.x}, ${p.y}`);
    }
  }
});

// ---------------- A revisão independente de 03/11/2026 ----------------

test('as posições de um rival: a velha some, e a corrida nova dele (o passo voltando muito) recomeça a lista', async () => {
  const { guardarPosicaoDoRival } = await import('../src/plataforma/laco');
  const r = { nome: 'bia', posicoes: [] as { n: number; x: number; y: number; j: number; andou: number }[] };
  const p = (n: number, x: number) => ({ n, x, y: 176, j: 1, andou: 0 });
  guardarPosicaoDoRival(r, p(1, 56));
  guardarPosicaoDoRival(r, p(600, 1200));
  guardarPosicaoDoRival(r, p(596, 1190));
  assert.deepEqual(r.posicoes.map((q) => q.n), [1, 600], 'a que chegou fora de ordem, por pouco, fica de fora');
  guardarPosicaoDoRival(r, p(5, 60));
  assert.deepEqual(r.posicoes.map((q) => q.n), [5], 'recarregou: a lista recomeça, e o coelho dela não fica congelado');
});
