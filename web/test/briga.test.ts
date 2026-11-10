import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as regras from '../src/briga/regras';
import {
  apanhar,
  apanhavel,
  comandosVazios,
  encosta,
  ESTADOS,
  golpeAtivo,
  LinhaDoTempo,
  misturar,
  novoCoelho,
  passoDoCoelho,
  pilotoAutomatico,
  TIPOS,
  type Golpe,
  type InimigoNaTela,
  type Quadro,
} from '../src/briga/regras';

const DT = 1 / 60;

test('as medidas do site são as do servidor', async () => {
  const s = await import('../../server/src/minijogo-briga.ts');
  for (const k of ['ARENA_L', 'PROF', 'ONDAS_X', 'VEL_X', 'VEL_Y', 'VIDA', 'GIRO_MS', 'GIRO_TICK_MS', 'RECARGA_ESPECIAL_MS', 'ARRANCADA_MS', 'ARRANCADA_VEL', 'ARRANCADA_RECARGA_MS', 'PASSO_MS', 'GOLPES', 'CORPO', 'TIPOS', 'ESTADOS', 'ACOES'] as const) {
    assert.deepEqual((regras as Record<string, unknown>)[k], (s as Record<string, unknown>)[k], k);
  }
});

test('o combo: três apertos dão soco1, soco2 e soco3, com números seguidos e no ritmo que o servidor aceita', () => {
  const c = novoCoelho(100, 20);
  const cmd = comandosVazios();
  const comecos: { id: number; golpe: Golpe; em: number }[] = [];
  for (let k = 0; k < 120; k++) {
    // aperta a cada 150 ms (o combo fica na fila até o soco de antes acabar)
    if (k % 9 === 0) cmd.soco = true;
    const n = passoDoCoelho(c, cmd, DT, [0, 320]);
    if (n.comecou) comecos.push({ ...n.comecou, em: c.relogio });
  }
  assert.deepEqual(comecos.slice(0, 3).map((x) => [x.id, x.golpe]), [
    [1, 'soco1'],
    [2, 'soco2'],
    [3, 'soco3'],
  ]);
  assert.ok(comecos[1].em - comecos[0].em <= 1000);
  assert.ok(comecos[2].em - comecos[0].em <= 1800);
  assert.equal(comecos[3]?.golpe, 'soco1', 'depois do terceiro, recomeça');
});

test('o pulo: uma voadora por pulo, e o especial só com a barra cheia', () => {
  const c = novoCoelho(100, 20);
  const cmd = comandosVazios();
  cmd.pulo = true;
  passoDoCoelho(c, cmd, DT, [0, 320]);
  assert.equal(c.acao, 'pulo');
  for (let k = 0; k < 6; k++) passoDoCoelho(c, cmd, DT, [0, 320]);
  cmd.soco = true;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 320]).comecou?.golpe, 'voadora');
  cmd.soco = true;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 320]).comecou, undefined, 'a segunda no mesmo pulo não sai');
  for (let k = 0; k < 120 && c.z > 0; k++) passoDoCoelho(c, cmd, DT, [0, 320]);
  assert.equal(c.acao, 'parado');
  c.ultimoEspecial = c.relogio - regras.RECARGA_ESPECIAL_MS / 2;
  assert.ok(Math.abs(regras.cargaDoEspecial(c) - 0.5) < 0.01, 'a barra pela metade');
  cmd.especial = true;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 320]).comecou, undefined, 'sem a barra cheia');
  c.ultimoEspecial = -Infinity;
  const hp = c.hp;
  cmd.especial = true;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 320]).comecou?.golpe, 'especial');
  assert.equal(c.hp, hp, 'não custa vida');
  assert.equal(regras.cargaDoEspecial(c) < 0.01, true, 'a barra esvazia');
  // apanhar derruba e tira o golpe
  apanhar(c, true, -1);
  assert.equal(c.acao, 'caido');
  assert.equal(golpeAtivo(c), false);
});

test('o giro anda, troca de faixa e pega de novo a cada volta', () => {
  const c = novoCoelho(100, 20);
  const cmd = comandosVazios();
  cmd.especial = true;
  passoDoCoelho(c, cmd, DT, [0, 1000]);
  assert.equal(c.acao, 'especial');
  const voltas = new Set<number>();
  cmd.direita = cmd.baixo = true;
  for (let k = 0; k < 60 && c.acao === 'especial'; k++) {
    passoDoCoelho(c, cmd, DT, [0, 1000]);
    assert.equal(golpeAtivo(c), true, 'pega o giro inteiro');
    c.acertados.add(k);
    voltas.add(c.volta);
  }
  assert.ok(c.x > 150, `andou girando: ${c.x}`);
  assert.ok(c.y > 30, `trocou de faixa girando: ${c.y}`);
  assert.equal(c.acao, 'especial', 'um segundo depois, ainda gira');
  for (let k = 0; k < 120 && c.acao === 'especial'; k++) {
    passoDoCoelho(c, cmd, DT, [0, 1000]);
    voltas.add(c.volta);
  }
  assert.deepEqual([...voltas].sort(), [0, 1, 2, 3, 4]);
  assert.equal(c.golpe, null);
});

test('a arrancada: dois toques para o mesmo lado, para frente ou para trás, com recarga', () => {
  const d = new regras.ToqueDuplo();
  assert.equal(d.apertou(1, 0), false);
  assert.equal(d.apertou(1, 180), true, 'o segundo toque logo depois');
  assert.equal(d.apertou(1, 300), false, 'o terceiro recomeça a conta');
  assert.equal(d.apertou(-1, 400), false);
  assert.equal(d.apertou(1, 450), false, 'trocou de lado: não vale');
  assert.equal(d.apertou(1, 900), false, 'devagar demais');

  const c = novoCoelho(200, 20);
  const cmd = comandosVazios();
  cmd.arrancada = -1;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 1000]).arrancou, true);
  assert.equal(c.lado, -1, 'para trás também');
  for (let k = 0; k < 30 && c.acao === 'arrancada'; k++) passoDoCoelho(c, cmd, DT, [0, 1000]);
  const andou = 200 - c.x;
  assert.ok(andou > 40 && andou < 50, `a arrancada andou ${andou} px`);
  cmd.arrancada = 1;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 1000]).arrancou, undefined, 'na recarga, não sai');
  for (let k = 0; k < 40; k++) passoDoCoelho(c, cmd, DT, [0, 1000]);
  cmd.arrancada = 1;
  assert.equal(passoDoCoelho(c, cmd, DT, [0, 1000]).arrancou, true);
  assert.equal(c.lado, 1);
});

test('a caixa do golpe: na frente e na mesma faixa; o especial pega dos dois lados; o corvo no alto, só de voadora', () => {
  const raposa: InimigoNaTela = { id: 1, tipo: 'raposa', x: 120, y: 20, z: 0, estado: 'andando' };
  assert.equal(encosta('soco1', 100, 20, 0, 1, raposa), true);
  assert.equal(encosta('soco1', 100, 20, 0, -1, raposa), false, 'de costas');
  assert.equal(encosta('soco1', 100, 40, 0, 1, raposa), false, 'outra faixa');
  assert.equal(encosta('especial', 140, 20, 0, 1, raposa), true, 'o especial pega atrás');
  const corvo: InimigoNaTela = { id: 2, tipo: 'corvo', x: 120, y: 20, z: 34, estado: 'rondando' };
  assert.equal(apanhavel(corvo, 'soco1'), false);
  assert.equal(apanhavel(corvo, 'voadora'), true);
  assert.equal(apanhavel({ ...raposa, estado: 'caido' }, 'soco1'), false);
});

test('a linha do tempo desenha atrás do quadro mais novo, interpolando', () => {
  const l = new LinhaDoTempo();
  const q = (n: number, x: number): Quadro => ({ n, f: 'lutando', o: 0, a: [0, 320], i: [[1, 0, x, 10, 0, 1, 1, 100, 0, 0]], j: [], e: [] });
  for (let n = 1; n <= 10; n++) l.chegou({ ...q(n, n * 10), tipo: 'q' } as Quadro, 1000 + n * 50);
  const p = l.passoNaTela(1000 + 10 * 50);
  assert.equal(p, 8, '100 ms atrás do mais novo');
  const v = l.emVolta(7.5)!;
  assert.equal(misturar(v.a.i, v.b.i, v.k, [2, 3, 4])[0][2], 75);
});

test('as fases e os bichos: o arquivo do site é o do servidor, byte a byte', async () => {
  const { readFile } = await import('node:fs/promises');
  const site = await readFile(new URL('../src/briga/fases.ts', import.meta.url), 'utf-8');
  const servidor = await readFile(new URL('../../server/src/briga-fases.ts', import.meta.url), 'utf-8');
  assert.equal(site, servidor);
  // todo bicho tem a folha dele (o Blender a fez), a horta também desde 09/11/2026
  const { FOLHAS_DOS_BICHOS } = await import('../src/briga/folhasDosBichos');
  const { FASES_DA_BRIGA } = await import('../src/briga/fases');
  for (const f of FASES_DA_BRIGA) {
    for (const tipo of [f.chefe, ...f.ondas.flatMap((o) => Object.keys(o))]) assert.equal(FOLHAS_DOS_BICHOS[tipo]?.fase, f.id, `${f.id}: ${tipo}`);
  }
});

for (const faseId of ['horta', 'floresta', 'deserto', 'neve', 'castelo']) test(`com o servidor de verdade e 200 ms de atraso, o piloto automático vence a fase sozinho: ${faseId}`, async (t) => {
  const s = await import('../../server/src/minijogo-briga.ts');
  let agora = 1_000_000;
  let passo: (() => void) | null = null;
  const quadros: Quadro[] = [];
  let terminou = false;
  const ctx = {
    agendar: (_ms: number, depois: () => void) => {
      fim = depois;
    },
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => [7],
    nome: () => 'ana',
    comunidade: 0,
    difundir: (d: unknown) => quadros.push(d as Quadro),
  };
  let fim: (() => void) | null = null;
  const jogo = s.criarBriga({ agora: () => agora, aleatorio: Math.random, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala: [7],
    criadaPor: 7,
    corpo: { fase: faseId },
  });
  assert.ok(typeof jogo !== 'string');
  const c = novoCoelho(40, 14);
  const cmd = comandosVazios();
  let ultimoEnvio = 0;
  const mandar = (ataque?: { id: number; golpe: string }) =>
    jogo.tempoReal!(7, { tipo: 'pos', x: c.x, y: c.y, z: c.z, lado: c.lado, acao: 0, ta: 0, ...(ataque ? { ataque: { id: ataque.id, g: ataque.golpe } } : {}) });
  const vistos = new Set<number>();
  let passos = 0;
  for (let ms = 0; ms < 8 * 60_000 && !terminou; ms += 1000 / 60) {
    // o servidor anda de 50 em 50 ms
    agora += 1000 / 60;
    if (++passos % 3 === 0) passo!();
    // o que esta tela vê: o quadro de 200 ms atrás
    const visto = quadros[Math.max(0, quadros.length - 5)];
    if (!visto) continue;
    for (const q of quadros.slice(-5)) {
      for (const e of q.e) {
        const [id, tipo, quem, , derruba, lado] = e as [number, string, number, number, number, number];
        if (vistos.has(id)) continue;
        vistos.add(id);
        if (tipo === 'p' && quem === 7) apanhar(c, derruba === 1, lado);
        if (tipo === 'r' && quem === 7) Object.assign(c, novoCoelho(e[3] as number, e[4] as number), { ataque: c.ataque, relogio: c.relogio });
      }
    }
    const meu = quadros.at(-1)!.j[0];
    c.hp = meu[7];
    if (meu[10] !== 0) continue;
    if (fim && quadros.at(-1)!.f !== 'lutando' && quadros.at(-1)!.f !== 'avancando') break;
    const inimigos: InimigoNaTela[] = visto.i.map((l) => ({ id: l[0], tipo: TIPOS[l[1]], x: l[2], y: l[3], z: l[4], estado: ESTADOS[l[5]], faixa: l[9], alvoX: l[10] }));
    pilotoAutomatico(c, inimigos, cmd, c.relogio, (visto.t ?? []).map((tr) => ({ x: tr[2], y: tr[3], lado: tr[4] })));
    const n = passoDoCoelho(c, cmd, DT, quadros.at(-1)!.a);
    if (n.comecou) mandar(n.comecou);
    if (golpeAtivo(c) && c.golpe) {
      for (const i of inimigos) {
        if (c.acertados.has(i.id) || !apanhavel(i, c.golpe) || !encosta(c.golpe, c.x, c.y, c.z, c.lado, i)) continue;
        c.acertados.add(i.id);
        jogo.tempoReal!(7, { tipo: 'golpe', a: c.ataque, inimigo: i.id, x: c.x, y: c.y, z: c.z });
      }
    }
    if (agora - ultimoEnvio >= 66) {
      ultimoEnvio = agora;
      mandar();
    }
  }
  const ultimo = quadros.at(-1)!;
  assert.equal(ultimo.f, "vitoria", `fase ${ultimo.f}, onda ${ultimo.o + 1}, vidas ${ultimo.j[0][8]}, inimigos ${JSON.stringify(ultimo.i)}`);
  t.diagnostic(`a fase levou ${Math.round((agora - 1_000_000) / 1000)} s`);
  assert.ok(agora - 1_000_000 < 5 * 60_000, 'a fase é curta');
  fim!();
  assert.equal(terminou, true);
  assert.ok((jogo.publico(7) as { resultado: { pontos: number }[] }).resultado[0].pontos > 300);
});

// ---------------- A revisão independente de 03/11/2026 ----------------

test('a página recarregada continua a conta dos golpes do servidor (o quadro leva o último aceito)', () => {
  const c = novoCoelho(40, 20);
  regras.contarDesde(c, 20);
  const cmd = comandosVazios();
  cmd.soco = true;
  const novo = passoDoCoelho(c, cmd, DT, [0, 320]);
  assert.equal(novo.comecou?.id, 21, 'o primeiro golpe depois de recarregar passa do último que o servidor aceitou');
  // e nunca volta para trás (um quadro velho, com o número de antes, não desfaz o que a tela já contou)
  regras.contarDesde(c, 3);
  assert.equal(c.ataque, 21);
});

test('a medalha do fim é a do troféu: fase vencida, fora do Solo, 2 ou mais que ficaram, com ponto', () => {
  const m = regras.marcaDoLugar;
  assert.equal(m(1, 50, { venceu: true, solo: false, ficaram: 2 }), '🥇');
  assert.equal(m(3, 10, { venceu: true, solo: false, ficaram: 4 }), '🥉');
  assert.equal(m(4, 10, { venceu: true, solo: false, ficaram: 4 }), '4.');
  assert.equal(m(1, 50, { venceu: false, solo: false, ficaram: 2 }), '1.', 'perdida: sem medalha');
  assert.equal(m(1, 50, { venceu: true, solo: true, ficaram: 1 }), '1.', 'no Solo: sem medalha');
  assert.equal(m(1, 50, { venceu: true, solo: false, ficaram: 1 }), '1.', 'só um ficou: sem medalha');
  assert.equal(m(2, 0, { venceu: true, solo: false, ficaram: 2 }), '2.', 'sem ponto: sem medalha');
  assert.equal(m(null, 30, { venceu: true, solo: false, ficaram: 2 }), '–', 'quem saiu: sem posição');
});

// ---------------- O relato de 06/11/2026: "tomei vários socos e não pisquei, nem a vida baixou" ----------------

test('parado ao lado da raposa, com o servidor de verdade e 200 ms de atraso: leva o golpe, pisca e a vida baixa', async () => {
  const s = await import('../../server/src/minijogo-briga.ts');
  let agora = 2_000_000;
  let passo: (() => void) | null = null;
  const quadros: Quadro[] = [];
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => {},
    naSala: () => [7],
    nome: () => 'ana',
    comunidade: 0,
    difundir: (d: unknown) => quadros.push(d as Quadro),
  };
  const jogo = s.criarBriga({ agora: () => agora, aleatorio: () => 0.5, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala: [7],
    criadaPor: 7,
    corpo: {},
  });
  assert.ok(typeof jogo !== 'string');
  const c = novoCoelho(160, 28);
  const cmd = comandosVazios();
  const vistos = new Set<number>();
  let ultimoEnvio = 0;
  let passos = 0;
  let levou = 0;
  let piscou = false;
  let menorHp = 100;
  for (let ms = 0; ms < 30_000; ms += 1000 / 60) {
    agora += 1000 / 60;
    if (++passos % 3 === 0) passo!();
    // o quadro chega 100 ms depois (metade da ida e volta)
    const chegados = quadros.slice(0, Math.max(0, quadros.length - 2));
    for (const q of chegados.slice(-3)) {
      for (const e of q.e) {
        const [id, tipo, quem, , derruba, lado] = e as [number, string, number, number, number, number];
        if (vistos.has(id)) continue;
        vistos.add(id);
        if (tipo === 'p' && quem === 7) {
          levou++;
          apanhar(c, derruba === 1, lado);
        }
      }
    }
    const meu = chegados.at(-1)?.j[0];
    if (meu) {
      c.hp = meu[7];
      menorHp = Math.min(menorHp, meu[7]);
    }
    if (meu && meu[10] !== 0) continue;
    // ninguém aperta nada: o coelho fica onde está (só o empurrão do golpe o mexe)
    passoDoCoelho(c, cmd, DT, [0, 320]);
    if (c.relogio < c.piscandoAte) piscou = true;
    if (agora - ultimoEnvio >= 66) {
      ultimoEnvio = agora;
      jogo.tempoReal!(7, { tipo: 'pos', x: c.x, y: c.y, z: c.z, lado: c.lado, acao: 0, ta: 0 });
    }
  }
  jogo.parar!();
  assert.ok(levou > 0, 'o servidor decidiu que o coelho parado levou golpes');
  assert.ok(menorHp < 100, `a vida que o quadro leva baixou: ${menorHp}`);
  assert.ok(piscou, 'quem leva um golpe fica piscando');
});
