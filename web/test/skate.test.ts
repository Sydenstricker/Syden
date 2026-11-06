import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NADA, novoSkatista, passo, PASSOS_DA_SESSAO, PASSOS_DE_FOLGA, type Comandos, type Skatista } from '../src/skate/fisica';
import { criarPiloto } from '../src/skate/piloto';
import { altura, PECAS, TRILHOS } from '../src/skate/pista';

/** Uma sessão inteira com o piloto automático; devolve o skatista e tudo o que aconteceu. */
function sessao() {
  const k = novoSkatista();
  const piloto = criarPiloto();
  const nomes: string[] = [];
  const grinds = new Set<number>();
  let quedas = 0;
  let combos = 0;
  while (!k.terminou && k.passo < PASSOS_DA_SESSAO + PASSOS_DE_FOLGA + 10) {
    passo(k, piloto(k));
    for (const e of k.eventos) {
      if (e.tipo === 'manobra') nomes.push(e.nome);
      if (e.tipo === 'grind') grinds.add(k.trilho);
      if (e.tipo === 'queda') quedas++;
      if (e.tipo === 'combo' && e.vezes >= 2) combos++;
    }
  }
  return { k, nomes, grinds, quedas, combos };
}

test('o piloto automático anda a sessão inteira: ollie, grind nas duas linhas, kickflip, 180, manual e combos', () => {
  const { k, nomes, grinds, quedas, combos } = sessao();
  assert.ok(k.terminou, 'a sessão não acabou');
  assert.ok(k.passo >= PASSOS_DA_SESSAO && k.passo <= PASSOS_DA_SESSAO + PASSOS_DE_FOLGA + 1);
  for (const m of ['Ollie', 'Grind', 'Kickflip', '180', 'Manual']) assert.ok(nomes.includes(m), `faltou ${m}`);
  assert.ok(grinds.has(0) && grinds.has(1), 'não grindou nas duas linhas do meio');
  assert.equal(quedas, 0);
  assert.ok(combos >= 5);
  assert.ok(k.pontos > 10_000, `pontos: ${k.pontos}`);
  assert.ok(k.melhorCombo > 0 && k.melhorCombo <= k.pontos);
});

test('a física é determinística: a mesma sessão dá os mesmos pontos, passo a passo', () => {
  const a = sessao();
  const b = sessao();
  assert.equal(a.k.pontos, b.k.pontos);
  assert.equal(a.k.passo, b.k.passo);
  assert.deepEqual(a.nomes, b.nomes);
});

/** Anda com um comando fixo (ou uma função do passo) por n passos. */
function andar(k: Skatista, n: number, c: Partial<Comandos> | ((i: number) => Partial<Comandos>)) {
  for (let i = 0; i < n; i++) passo(k, { ...NADA, ...(typeof c === 'function' ? c(i) : c) });
}

test('no quarter, embalado, ele voa (o vert) e volta para a mesma parede, descendo', () => {
  const k = novoSkatista();
  k.x = 2.5;
  k.z = 12;
  let voou = 0;
  let maisAlto = 0;
  for (let i = 0; i < 400 && !(voou && k.modo === 'chao' && k.rz > 0 && k.z > 2); i++) {
    passo(k, { ...NADA, frente: true });
    if (k.modo === 'ar' && k.saida === 'vert') voou++;
    maisAlto = Math.max(maisAlto, k.y);
  }
  assert.ok(voou > 40, `ficou ${voou} passos no ar`);
  assert.ok(maisAlto > 1.4, `subiu só ${maisAlto.toFixed(2)}`);
  assert.equal(k.modo, 'chao');
  assert.ok(k.rz > 0.9, 'não voltou descendo a parede');
  assert.ok(k.vel > 3);
});

test('pousar de lado (90°) é cair, e perde o combo', () => {
  const k = novoSkatista();
  andar(k, 60, { frente: true });
  // ollie carregado e meio giro (12 passos = 90°)
  andar(k, 20, { pulo: true });
  andar(k, 1, {});
  andar(k, 12, { esquerda: true });
  let caiu = false;
  for (let i = 0; i < 120 && !caiu; i++) {
    passo(k, NADA);
    caiu = k.eventos.some((e) => e.tipo === 'queda');
  }
  assert.ok(caiu, 'pousou de lado e não caiu');
  assert.equal(k.combo.length, 0);
  assert.equal(k.pontos, 0);
});

test('bater de frente na caixa devagar faz voltar; o chão das peças bate com o que se desenha', () => {
  const k = novoSkatista();
  k.x = 8.5;
  k.z = 12.5;
  andar(k, 90, (i) => ({ frente: i < 20 }));
  assert.ok(k.z > 11, 'atravessou a caixa');
  // as alturas medidas nos modelos: a rampa no alto (0,3), o patamar do quarter (0,8), a caixa (0,21)
  assert.equal(altura(5.5, 13.2), 0.3);
  assert.equal(altura(3, 0.1), 0.8);
  assert.equal(altura(8.5, 9), 0.21);
  assert.ok(PECAS.length > 30);
});

test('o alto da cerca dos lados se grinda (pedido dele, 06/11/2026), e ao sair ele volta para dentro da pista', () => {
  for (const lado of [0, 1]) {
    const k = novoSkatista();
    k.x = lado === 0 ? 0.2 : 11.8;
    k.z = 6;
    k.modo = 'ar';
    k.y = 0.4;
    k.vy = -0.2;
    k.vx = 0;
    k.vz = 3;
    k.cx = 0;
    k.cz = 1;
    k.noAr = 10;
    let pegou = -1;
    for (let i = 0; i < 20 && pegou < 0; i++) {
      passo(k, NADA);
      if (k.modo === 'grind') pegou = k.trilho;
    }
    assert.ok(pegou >= 2, `não pegou a cerca do lado ${lado}`);
    assert.equal(TRILHOS[pegou].y, 0.35);
    andar(k, 400, (i) => ({ esquerda: k.equilibrio > 0.2 && i % 2 === 0, direita: k.equilibrio < -0.2 && i % 2 === 0 }));
    assert.notEqual(k.modo, 'grind');
    assert.ok(k.x > 0.15 && k.x < 11.85, `ficou fora da pista: x = ${k.x}`);
  }
});

test('a beirada do alto dos quarters (pedido dele, 06/11/2026): o vert com meio giro faz o Stall, e sair dela devolve à rampa', () => {
  for (const [z0, sobe] of [
    [12, -1],
    [6, 1],
  ] as const) {
    for (const lado of ['esquerda', 'direita'] as const) {
      const k = novoSkatista();
      k.x = 2.5;
      k.z = z0;
      k.rz = sobe;
      k.cz = sobe;
      let noAr = 0;
      let stall = -1;
      const nomes: string[] = [];
      let quedas = 0;
      for (let i = 0; i < 700; i++) {
        noAr = k.modo === 'ar' ? noAr + 1 : 0;
        // no vert, 90° de giro (12 passos de 7,5°) põe a prancha ao longo da beirada; no grind, o equilíbrio
        const gira = k.modo === 'ar' && k.saida === 'vert' && noAr <= 12;
        const eq = k.modo === 'grind' ? (k.equilibrio + k.deriva * 10 > 0 ? { esquerda: true } : { direita: true }) : {};
        passo(k, { ...NADA, frente: k.modo === 'chao' && i < 400, [lado]: gira, ...eq });
        if (k.modo === 'grind' && stall < 0) stall = k.trilho;
        for (const e of k.eventos) {
          if (e.tipo === 'manobra') nomes.push(e.nome);
          if (e.tipo === 'queda') quedas++;
        }
      }
      assert.ok(stall >= 0, `não pegou a beirada (${z0}, ${lado})`);
      assert.equal(TRILHOS[stall].nome, 'Stall');
      assert.equal(TRILHOS[stall].y, 0.8);
      assert.ok(nomes.includes('Stall'));
      assert.equal(quedas, 0, 'caiu ao voltar para a rampa');
      // de volta à pista, no chão, longe da cerca de trás
      assert.equal(k.modo, 'chao');
      assert.ok(k.z > 1 && k.z < 17, `ficou preso na ponta: z = ${k.z}`);
      assert.ok(k.y < 0.05);
    }
  }
  // sem o giro, o vert de sempre: sobe, desce e não pega a beirada
  const k = novoSkatista();
  k.x = 2.5;
  k.z = 12;
  for (let i = 0; i < 320; i++) {
    passo(k, { ...NADA, frente: k.modo === 'chao' });
    assert.notEqual(k.modo, 'grind');
  }
});

test('o entorno (06/11/2026) fica todo fora da pista: nada em que o skatista possa bater', async () => {
  const { lugaresDoEntorno, lugaresDosPostes } = await import('../src/skate/entorno');
  const fora = (x: number, z: number) => Math.max(-x, x - 12, -z, z - 18);
  let n = 0;
  for (const [nome, lista] of lugaresDoEntorno())
    for (const l of lista) {
      n++;
      // as árvores, as casas e o resto ficam na grama, além do concreto (2 casas); os bancos e as lixeiras na beira dele
      assert.ok(fora(l.x, l.z) > 2.2, `${nome} em (${l.x.toFixed(1)}, ${l.z.toFixed(1)})`);
    }
  assert.ok(n > 100, `só ${n} coisas`);
  for (const [x, z] of lugaresDosPostes()) assert.ok(fora(x, z) > 1, `poste em (${x}, ${z})`);
});
