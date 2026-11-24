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

test('a física e a pista são as MESMAS do servidor, byte a byte (ele refaz a sessão, 06/11/2026)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const nome of ['fisica.ts', 'pista.ts']) {
    const site = readFileSync(new URL(`../src/skate/${nome}`, import.meta.url));
    const servidor = readFileSync(new URL(`../../server/src/skate/${nome}`, import.meta.url));
    assert.ok(site.equals(servidor), `web/src/skate/${nome} e server/src/skate/${nome} são diferentes: copie um no outro`);
  }
});

test('o que se grava refaz a mesma sessão (os comandos em bits, em trechos)', async () => {
  const f = await import('../src/skate/fisica');
  const k = novoSkatista();
  const piloto = criarPiloto();
  const g = f.gravador();
  while (!k.terminou) {
    const c = piloto(k);
    g.anotar(c);
    passo(k, c);
  }
  assert.ok(f.entradasValidas(g.entradas));
  // os trechos juntam os passos iguais: bem menos números que passos
  assert.ok(g.entradas.length < k.passo, `${g.entradas.length} números para ${k.passo} passos`);
  const r = f.refazer(g.entradas);
  assert.equal(r.passos, k.passo);
  assert.equal(r.k.passo, k.passo);
  assert.equal(r.k.pontos, k.pontos);
  assert.equal(r.k.melhorCombo, k.melhorCombo);
  for (let b = 0; b <= f.COMANDO_MAXIMO; b++) assert.equal(f.emBits(f.deBits(b)), b);
  assert.equal(f.entradasValidas([1, 256]), false);
  assert.equal(f.entradasValidas([0, 1]), false);
  assert.equal(f.entradasValidas([f.PASSOS_MAXIMOS + 1, 0]), false);
  assert.equal(f.entradasValidas([1.5, 0]), false);
});

// ---------------------------------------------------------------------------------------------------------------------
// 19/11/2026: os objetivos, a barra de especial, as variações de flip e grab, e a segunda pista
// ---------------------------------------------------------------------------------------------------------------------

/** Põe o skatista em (x, z), andando para (rx, rz) a `vel`, e roda `n` passos com o comando que `cmd(i)` der. */
async function rodarDe(pista: number, x: number, z: number, rx: number, rz: number, vel: number, n: number, cmd: (i: number) => Partial<Comandos> = () => ({})) {
  const f = await import('../src/skate/fisica');
  const k = f.novoSkatista(pista);
  for (let j = 0; j < 2; j++) {
    Object.assign(k, { x, z, rx, rz, cx: rx, cz: rz, vel });
    if (!j) f.passo(k, f.NADA);
  }
  const nomes: string[] = [];
  for (let i = 0; i < n; i++) {
    f.passo(k, { ...f.NADA, ...cmd(i) });
    for (const e of k.eventos) if (e.tipo === 'manobra') nomes.push(e.nome);
  }
  return { k, nomes };
}

test('a segunda pista (a praça) e as duas pistas no mesmo arquivo: ids diferentes, e o parque é o de sempre', async () => {
  const p = await import('../src/skate/pista');
  assert.deepEqual(p.IDS_DAS_PISTAS.slice(0, 2), ['parque-1', 'praca-1']);
  assert.notDeepEqual(p.PISTAS[1].trilhos.length, 0);
  assert.ok(p.PISTAS[1].objetivos.saltos.length >= 2 && p.PISTAS[0].objetivos.letras.length === p.PALAVRA.length);
  // o piloto automático do parque continua fazendo a sessão inteira na praça sem travar (os objetivos dela ficam para quem joga)
  const f = await import('../src/skate/fisica');
  const k = f.novoSkatista(1);
  const piloto = criarPiloto();
  while (!k.terminou) f.passo(k, piloto(k));
  assert.ok(k.pontos > 0);
  p.usarPista(0);
});

test('os saltos com nome: a pirâmide da praça e a caixa do parque (contam no combo e no objetivo)', async () => {
  const f = await import('../src/skate/fisica');
  const a = await rodarDe(1, 6, 13, 0, -1, 4.2, 150);
  assert.ok(a.nomes.includes('gap:piramide'), a.nomes.join(','));
  assert.ok(f.objetivos(a.k).find((o) => o.id === 'gap:piramide')!.feito);
  const n = Math.hypot(0.4, 1);
  const b = await rodarDe(0, 6, 2.6, 0.4 / n, 1 / n, 5.5, 150);
  assert.ok(b.nomes.includes('gap:caixa'), b.nomes.join(','));
  // e quem só rola pela pirâmide devagar, sem voar até o outro lado, não faz o salto
  const c = await rodarDe(1, 6, 13, 0, -1, 1.5, 300);
  assert.ok(!c.nomes.includes('gap:piramide'));
});

test('as letras e a fita: pega passando perto (a fita só no vert embalado, no canto do quarter)', async () => {
  const f = await import('../src/skate/fisica');
  const devagar = await rodarDe(0, 11.2, 14, 0, 1, 4.2, 200);
  assert.ok(!devagar.k.fita, 'devagar, o vert não chega à fita');
  const rapido = await rodarDe(0, 11.2, 14, 0, 1, 6.5, 200);
  assert.ok(rapido.k.fita);
  assert.ok(f.objetivos(rapido.k).find((o) => o.id === 'fita')!.feito);
  const vert = await rodarDe(0, 6, 4, 0, -1, 5.5, 200);
  assert.ok(vert.k.letras & 4, 'o C no alto do quarter');
  const o = f.objetivos(vert.k).find((x) => x.id === 'letras')!;
  assert.ok(!o.feito && (o.valor ?? 0) >= 1);
});

test('as variações (seta na hora de apertar) e a barra de especial: cheia, o flip vira o duplo; cair esvazia', async () => {
  // um ollie embalado, e no ar ↑ + Z (Heelflip) e ← + X (Melon)
  const v = await rodarDe(0, 6, 9, 0, -1, 4, 60, (i) => ({ pulo: i < 8, frente: i >= 12 && i < 16, flip: i >= 12 && i < 14, esquerda: i >= 18 && i < 20, grab: i >= 18 && i < 34 }));
  assert.ok(v.nomes.includes('Heelflip'), v.nomes.join(','));
  assert.ok(v.nomes.includes('Melon'), v.nomes.join(','));
  // a barra cheia: o Z puro vira o Double Kickflip
  const f = await import('../src/skate/fisica');
  const k = f.novoSkatista(0);
  Object.assign(k, { x: 6, z: 9, rx: 0, rz: -1, cx: 0, cz: -1, vel: 4, especial: 1 });
  const nomes: string[] = [];
  for (let i = 0; i < 30; i++) {
    f.passo(k, { ...f.NADA, pulo: i < 8, flip: i >= 10 && i < 12 });
    for (const e of k.eventos) if (e.tipo === 'manobra') nomes.push(e.nome);
  }
  assert.ok(nomes.includes('Double Kickflip'), nomes.join(','));
  // cair (pousar de lado) esvazia a barra
  const q = f.novoSkatista(0);
  Object.assign(q, { x: 6, z: 9, rx: 0, rz: -1, cx: 0, cz: -1, vel: 4, especial: 0.8 });
  for (let i = 0; i < 80; i++) f.passo(q, { ...f.NADA, pulo: i < 8, esquerda: i >= 10 && i < 22 });
  assert.equal(q.especial, 0);
});

test('o servidor refaz os objetivos: a mesma sessão dá os mesmos objetivos nas duas cópias', async () => {
  const f = await import('../src/skate/fisica');
  const s = await import('../../server/src/skate/fisica');
  const g = f.gravador();
  const k = f.novoSkatista(1);
  const piloto = criarPiloto();
  while (!k.terminou) {
    const c = piloto(k);
    g.anotar(c);
    f.passo(k, c);
  }
  const r = s.refazer(g.entradas, 1);
  assert.equal(r.k.pontos, k.pontos);
  assert.deepEqual(s.objetivos(r.k), f.objetivos(k));
});

// ---------------- O segundo conjunto de objetivos (21/11/2026) ----------------

/** Como rodarDe, com o conjunto de objetivos da sessão. */
async function rodarNoConjunto(conjunto: number, pista: number, x: number, z: number, rx: number, rz: number, vel: number, n: number) {
  const f = await import('../src/skate/fisica');
  const k = f.novoSkatista(pista, conjunto);
  for (let j = 0; j < 2; j++) {
    Object.assign(k, { x, z, rx, rz, cx: rx, cz: rz, vel });
    if (!j) f.passo(k, f.NADA);
  }
  for (let i = 0; i < n; i++) f.passo(k, f.NADA);
  return k;
}

test('o segundo conjunto: outra palavra e outra fita, as mesmas peças; os pontos de uma sessão são os mesmos nos dois', async () => {
  const p = await import('../src/skate/pista');
  const f = await import('../src/skate/fisica');
  const s = await import('../../server/src/skate/fisica');
  assert.deepEqual([...p.PALAVRAS], ['TOCA', 'PULO']);
  for (const q of p.PISTAS) {
    assert.equal(q.segundo.letras.length, p.PALAVRA_2.length);
    assert.equal(q.segundo.saltos.length, 0, 'os saltos (e os pontos deles) são os do primeiro conjunto');
    assert.ok(q.segundo.pontos > q.objetivos.pontos && q.segundo.combo > q.objetivos.combo);
  }
  for (const pista of [0, 1, 2]) {
    const um = f.novoSkatista(pista, 0);
    const dois = f.novoSkatista(pista, 1);
    const g = f.gravador();
    const piloto = criarPiloto();
    while (!um.terminou) {
      const c = piloto(um);
      g.anotar(c);
      f.passo(um, c);
    }
    for (let i = 0; i < g.entradas.length; i += 2) for (let j = 0; j < g.entradas[i]; j++) if (!dois.terminou) f.passo(dois, f.deBits(g.entradas[i + 1]));
    assert.equal(dois.pontos, um.pontos, 'os pontos não mudam com o conjunto');
    const objs = f.objetivos(dois);
    assert.deepEqual(
      objs.map((o) => o.id),
      ['letras', 'pontos', 'combo', 'fita', 'giro', 'manual'],
    );
    // o servidor refaz no mesmo conjunto
    const r = s.refazer(g.entradas, pista, 1);
    assert.deepEqual(s.objetivos(r.k), objs);
    // e o primeiro conjunto continua o de antes
    assert.deepEqual(s.objetivos(s.refazer(g.entradas, pista, 0).k), f.objetivos(um));
  }
});

test('o segundo conjunto: o L no alto do quarter de cá e a fita no canto do quarter de lá (o vert embalado)', async () => {
  const f = await import('../src/skate/fisica');
  const vert = await rodarNoConjunto(1, 0, 6, 14, 0, 1, 5.5, 200);
  assert.ok(vert.letras & 4, 'o L no alto do quarter de cá');
  const rapido = await rodarNoConjunto(1, 0, 0.8, 4, 0, -1, 6.5, 200);
  assert.ok(rapido.fita, 'a fita do segundo conjunto');
  assert.ok(f.objetivos(rapido).find((o) => o.id === 'fita')!.feito);
  // no primeiro conjunto, ali não há fita
  assert.ok(!(await rodarNoConjunto(0, 0, 0.8, 4, 0, -1, 6.5, 200)).fita);
});

test('o segundo conjunto: as manobras (o maior giro e o manual mais longo) contam pela sessão', async () => {
  const f = await import('../src/skate/fisica');
  const k = f.novoSkatista(0, 1);
  assert.ok(!f.objetivos(k).find((o) => o.id === 'giro')!.feito);
  k.maiorGiro = 540;
  k.maiorManual = 3.2;
  assert.ok(f.objetivos(k).find((o) => o.id === 'giro')!.feito);
  assert.ok(f.objetivos(k).find((o) => o.id === 'manual')!.feito);
});

// ---------------- A terceira pista, a Quadra (24/11/2026) ----------------

test('a Quadra (a terceira pista): id novo no fim, os três saltos com nome e as letras dos dois conjuntos alcançáveis', async () => {
  const p = await import('../src/skate/pista');
  const f = await import('../src/skate/fisica');
  assert.equal(p.IDS_DAS_PISTAS[2], 'quadra-1');
  const q = p.PISTAS[2];
  assert.deepEqual(q.objetivos.saltos.map((s) => s.id), ['caixote', 'corrimao', 'caixa']);
  // por cima da caixa de través (pega o T no caminho)
  const a = await rodarDe(2, 6, 17, 0, -1, 5.5, 200);
  assert.ok(a.nomes.includes('gap:caixote'), a.nomes.join(','));
  assert.ok(a.k.letras & 1, 'o T acima da caixa de través');
  // do kicker da esquerda ao corrimão comprido, e do da direita à caixa comprida (o O e o A no caminho)
  const b = await rodarDe(2, 2.5, 1.9, 0, 1, 5.5, 150);
  assert.ok(b.nomes.includes('gap:corrimao') && b.nomes.includes('Grind'), b.nomes.join(','));
  assert.ok(b.k.letras & 2, 'o O acima do corrimão');
  const c = await rodarDe(2, 9.5, 1.9, 0, 1, 5.5, 150);
  assert.ok(c.nomes.includes('gap:caixa') && c.nomes.includes('Grind'), c.nomes.join(','));
  assert.ok(c.k.letras & 8, 'o A no fim da caixa comprida');
  // o C no alto do quarter de lá, e a fita no canto (o vert embalado)
  assert.ok((await rodarDe(2, 9, 14, 0, 1, 5.5, 200)).k.letras & 4);
  assert.ok((await rodarDe(2, 0.7, 14, 0, 1, 6.5, 200)).k.fita);
  // o segundo conjunto: o L no quarter de cá e a fita no outro canto
  assert.ok((await rodarNoConjunto(1, 2, 3, 4, 0, -1, 5.5, 200)).letras & 4);
  assert.ok((await rodarNoConjunto(1, 2, 11.3, 4, 0, -1, 6.5, 200)).fita);
  // o piloto automático do parque faz a sessão inteira nela sem travar, e o servidor a refaz igual
  const s = await import('../../server/src/skate/fisica');
  const g = f.gravador();
  const k = f.novoSkatista(2);
  const piloto = criarPiloto();
  while (!k.terminou) {
    const cmd = piloto(k);
    g.anotar(cmd);
    f.passo(k, cmd);
  }
  assert.ok(k.pontos > 0);
  const r = s.refazer(g.entradas, 2);
  assert.equal(r.k.pontos, k.pontos);
  assert.deepEqual(s.objetivos(r.k), f.objetivos(k));
  p.usarPista(0);
});

test('a Quadra, o segundo conjunto: o P, o U e o O nas linhas', async () => {
  const f = await import('../src/skate/fisica');
  const rodar = (x: number, z: number, rz: number, vel: number, n: number) => {
    const k = f.novoSkatista(2, 1);
    for (let j = 0; j < 2; j++) {
      Object.assign(k, { x, z, rx: 0, rz, cx: 0, cz: rz, vel });
      if (!j) f.passo(k, f.NADA);
    }
    for (let i = 0; i < n; i++) f.passo(k, f.NADA);
    return k;
  };
  assert.ok(rodar(6, 17, -1, 5.5, 200).letras & 1, 'o P');
  assert.ok(rodar(2.5, 1.9, 1, 5.5, 150).letras & 2, 'o U');
  assert.ok(rodar(9.5, 1.9, 1, 5.5, 150).letras & 8, 'o O');
  (await import('../src/skate/pista')).usarPista(0);
});
