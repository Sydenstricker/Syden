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
    assert.deepEqual(
      s.postos,
      f.postos.map((p) => [p.x, p.y]),
    );
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
  const r = {
    nome: 'bia',
    posicoes: [] as {
      n: number;
      x: number;
      y: number;
      j: number;
      andou: number;
    }[],
  };
  const p = (n: number, x: number) => ({ n, x, y: 176, j: 1, andou: 0 });
  guardarPosicaoDoRival(r, p(1, 56));
  guardarPosicaoDoRival(r, p(600, 1200));
  guardarPosicaoDoRival(r, p(596, 1190));
  assert.deepEqual(
    r.posicoes.map((q) => q.n),
    [1, 600],
    'a que chegou fora de ordem, por pouco, fica de fora',
  );
  guardarPosicaoDoRival(r, p(5, 60));
  assert.deepEqual(
    r.posicoes.map((q) => q.n),
    [5],
    'recarregou: a lista recomeça, e o coelho dela não fica congelado',
  );
});

// ---------------- As cenouras e os bichos (19/11/2026) ----------------

test('as cenouras e a dourada do servidor são as mesmas do site, e as copas também', async () => {
  const { CENOURAS_DO_PULO } = await import('../../server/src/plataforma.ts');
  for (const f of FASES) {
    const s = CENOURAS_DO_PULO[f.id];
    assert.ok(s, `${f.id}: as cenouras no servidor`);
    assert.deepEqual(
      s.cenouras,
      f.cenouras.map((c) => [c.x, c.y]),
    );
    assert.deepEqual(s.dourada, f.dourada ? [f.dourada.x, f.dourada.y] : null);
    assert.ok(f.cenouras.length <= 30, `${f.id}: no máximo 30 cenouras (um bit cada)`);
    assert.ok(f.dourada, `${f.id}: tem dourada`);
  }
  assert.deepEqual(COPAS_DO_PULO['copa-dos-bichos'], ['corrego-1', 'mina-1', 'ninho-1']);
});

test('a corrida honesta: o servidor conta pelo menos as cenouras que o coelho pegou', async () => {
  const { contarCenouras } = await import('../src/plataforma/fisica');
  const { cenourasDoCaminho } = await import('../../server/src/plataforma.ts');
  for (const f of FASES) {
    const { k, caminho } = planos.get(f.id)!;
    const n = contarCenouras(k);
    assert.ok(n > 0, `${f.id}: pegou alguma cenoura`);
    const s = cenourasDoCaminho(f.id, caminho);
    assert.ok(s.cenouras >= n, `${f.id}: o servidor viu ${s.cenouras}, o coelho pegou ${n}`);
    if (k.dourada) assert.ok(s.dourada, `${f.id}: o servidor viu a dourada`);
  }
  // um caminho que não sai da largada não pega nada
  const parado: number[] = [];
  for (let i = 0; i < 100; i++) parado.push(56 * 10, 176 * 10, 1);
  assert.deepEqual(cenourasDoCaminho('prado-1', parado), {
    cenouras: 0,
    dourada: false,
  });
});

test('toda dourada se alcança (o piloto acha o caminho até ela), e o servidor a reconhece pelo fantasma', async () => {
  const { cenourasDoCaminho } = await import('../../server/src/plataforma.ts');
  for (const f of FASES) {
    const d = f.dourada!;
    const plano = planejar(f, novoCoelho(f), 500, 5, 60 * 60, {
      x: d.x,
      y: d.y,
      feito: (k) => k.dourada,
    });
    assert.ok(plano, `${f.id}: a dourada não se alcança`);
    const k = novoCoelho(f);
    const caminho: number[] = [];
    for (const c of plano) {
      passo(k, c, f);
      amostrar(k, caminho);
    }
    assert.equal(k.dourada, true, `${f.id}: pegou a dourada`);
    assert.equal(cenourasDoCaminho(f.id, caminho).dourada, true, `${f.id}: o servidor viu`);
  }
});

test('os bichos: pisar por cima dá um pulinho e o tira da fase; encostar de lado volta ao posto', async () => {
  const { bichoEm, BICHO_MEIA, fasePorId } = await import('../src/plataforma/fases');
  const f = fasePorId('corrego-1');
  const b = f.bichos[0];
  // caindo em cima do besouro
  const k = novoCoelho(f);
  for (let i = 0; i < 30; i++) passo(k, { esquerda: false, direita: false, pula: false }, f);
  const n = k.passos + 1;
  const q = bichoEm(b, n);
  k.x = q.x;
  k.y = q.y - BICHO_MEIA.besouro[1] - 1;
  k.vy = 200;
  k.noChao = false;
  passo(k, { esquerda: false, direita: false, pula: false }, f);
  assert.equal(k.pisou, 0, 'pisou');
  assert.ok(k.vy < 0, 'e subiu');
  assert.equal(k.quedas, 0);
  assert.ok(k.pisados & 1);
  // de lado: volta ao posto
  const j = novoCoelho(f);
  for (let i = 0; i < 30; i++) passo(j, { esquerda: false, direita: false, pula: false }, f);
  const r = bichoEm(b, j.passos + 1);
  j.x = r.x - 4;
  j.y = r.y + BICHO_MEIA.besouro[1];
  j.noChao = true;
  passo(j, { esquerda: false, direita: false, pula: false }, f);
  assert.equal(j.quedas, 1, 'encostou de lado');
  assert.equal(j.ferido, 'bicho');
  assert.equal(j.x, f.postos[0].x);
});

test('as medalhas de cada fase: o tempo do piloto automático é o ouro (20/11/2026)', async () => {
  const { TEMPO_DO_PILOTO_DO_PULO, MEDALHAS_DO_PULO } = await import('../src/plataforma/fases');
  const { medalhaPelosPassos } = await import('../src/medalhasDaCorrida');
  for (const f of FASES) {
    const { k } = planos.get(f.id)!;
    assert.equal(TEMPO_DO_PILOTO_DO_PULO[f.id], k.chegouEm, `${f.id}: o tempo do piloto mudou (${k.chegouEm})`);
    assert.equal(medalhaPelosPassos(k.chegouEm, k.chegouEm, MEDALHAS_DO_PULO), 0, 'o tempo do piloto é ouro');
    assert.equal(medalhaPelosPassos(k.chegouEm, Math.round(k.chegouEm * 1.2), MEDALHAS_DO_PULO), 1);
    assert.equal(medalhaPelosPassos(k.chegouEm, Math.round(k.chegouEm * 1.5), MEDALHAS_DO_PULO), 2);
    assert.equal(medalhaPelosPassos(k.chegouEm, k.chegouEm * 2, MEDALHAS_DO_PULO), null);
  }
});

// ---------------- As fases com um elemento novo (21/11/2026) ----------------

test('a corrente de ar sobe o coelho no ar, sem passar de VSOPRO', async () => {
  const { fasePorId } = await import('../src/plataforma/fases');
  const { VSOPRO } = await import('../src/plataforma/fisica');
  const f = fasePorId('vento-1');
  const v = f.ventos[0];
  const k = novoCoelho(f);
  k.x = (v.x0 + v.x1) / 2;
  k.y = 180;
  k.vy = 300;
  k.noChao = false;
  let menor = Infinity;
  for (let i = 0; i < 120; i++) {
    passo(k, { esquerda: false, direita: false, pula: false }, f);
    menor = Math.min(menor, k.vy);
  }
  assert.equal(k.quedas, 0, 'a corrente segurou: não caiu no buraco');
  assert.ok(menor < 0 && menor >= -VSOPRO - 0.001, `subiu (${menor.toFixed(0)}/s)`);
  assert.ok(k.y < 180, 'ficou mais alto do que entrou');
});

test('a pedra que racha: pisada, cai depois de RACHA_TREME passos e volta depois de RACHA_FORA', async () => {
  const { fasePorId } = await import('../src/plataforma/fases');
  const { RACHA_FORA, RACHA_TREME, rachaPresente } = await import('../src/plataforma/fisica');
  const f = fasePorId('caverna-1');
  const i = f.rachas.indexOf(11 * f.colunas + 50); // a ponte comprida
  assert.ok(i >= 0);
  const k = novoCoelho(f);
  k.x = 50 * T + T / 2;
  k.y = 11 * T - 4;
  k.noChao = false;
  const parado: Comandos = { esquerda: false, direita: false, pula: false };
  for (let n = 0; n < 20 && !k.noChao; n++) passo(k, parado, f);
  assert.ok(k.noChao, 'em cima da pedra');
  const pisada = k.racha[i];
  assert.ok(pisada > 0, 'começou a tremer');
  for (let n = 0; n < RACHA_TREME - 4; n++) passo(k, parado, f);
  assert.ok(k.noChao && rachaPresente(k, i), 'ainda segura enquanto treme');
  for (let n = 0; n < 60 && k.quedas === 0; n++) passo(k, parado, f);
  assert.equal(k.quedas, 1, 'caiu com a pedra');
  assert.equal(k.racha[i], 0, 'cair devolve as pedras');
  // sem cair, a pedra volta sozinha
  const j = novoCoelho(f);
  j.racha[i] = 1;
  j.passos = 1 + RACHA_TREME;
  assert.equal(rachaPresente(j, i), false);
  j.passos = RACHA_TREME + RACHA_FORA;
  passo(j, parado, f);
  assert.equal(j.racha[i], 0, 'voltou');
});

test('as tábuas que piscam: a clara e a azul se revezam, e quem fica em cima na troca cai', async () => {
  const { fasePorId, piscaPresente, PISCA_PERIODO } = await import('../src/plataforma/fases');
  assert.equal(piscaPresente(Bloco.PiscaA, 0), true);
  assert.equal(piscaPresente(Bloco.PiscaB, 0), false);
  assert.equal(piscaPresente(Bloco.PiscaA, PISCA_PERIODO), false);
  assert.equal(piscaPresente(Bloco.PiscaB, PISCA_PERIODO), true);
  const f = fasePorId('cachoeira-1');
  assert.equal(blocoEm(f, 23, 10), Bloco.PiscaA);
  const k = novoCoelho(f);
  k.x = 23 * T + T / 2;
  k.y = 10 * T - 3;
  k.noChao = false;
  const parado: Comandos = { esquerda: false, direita: false, pula: false };
  for (let n = 0; n < 20 && !k.noChao; n++) passo(k, parado, f);
  assert.ok(k.noChao, 'em cima da clara');
  for (let n = 0; n < PISCA_PERIODO + 60 && k.quedas === 0; n++) passo(k, parado, f);
  assert.equal(k.quedas, 1, 'a clara sumiu e o coelho caiu');
});

test('a Copa dos Elementos é igual no site e no servidor, e as fases antigas não mudaram', async () => {
  const { COPAS_DO_PULO: NO_SERVIDOR } = await import('../../server/src/plataforma.ts');
  assert.deepEqual(COPAS_DO_PULO['copa-dos-elementos'], ['vento-1', 'caverna-1', 'cachoeira-1']);
  assert.deepEqual(NO_SERVIDOR['copa-dos-elementos'], COPAS_DO_PULO['copa-dos-elementos']);
  for (const f of FASES.slice(0, 6)) assert.equal(f.ventos.length + f.rachas.length, 0, `${f.id}: sem elemento novo`);
});
