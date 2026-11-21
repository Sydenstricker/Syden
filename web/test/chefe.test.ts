/**
 * O CHEFE DA TURMA no site (web/src/chefe/): as contas que os dois lados fazem são o MESMO arquivo, e o piloto automático,
 * usando o MESMO cliente da tela, vence a toupeira contra o servidor de verdade (server/src/chefe/motor.ts) com 100 ms de
 * internet em cada sentido.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as conta from '../src/chefe/conta';
import { pilotoAutomatico } from '../src/chefe/piloto';
import { Cliente, comandosVazios, INVUL_MS, marcaDoLugar, REVIVER_MS, type Quadro } from '../src/chefe/regras';

const ler = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

test('as contas do chefe são duas cópias iguais byte a byte (servidor e site)', () => {
  assert.equal(ler('../src/chefe/conta.ts'), ler('../../server/src/chefe/conta.ts'));
});

test('as medidas do site que não moram nas contas são as do servidor', async () => {
  const s = await import('../../server/src/chefe/motor.ts');
  assert.equal(INVUL_MS, s.INVUL_MS);
  assert.equal(REVIVER_MS, s.REVIVER_MS);
});

test('as contas: o torrão anda em linha e para no alcance; a bomba vai até o alcance; a investida para na borda', () => {
  assert.deepEqual(conta.noTiro(100, 100, 1, 0, 1000), [100 + conta.TORRAO.vel, 100]);
  assert.deepEqual(conta.noTiro(0, 0, 1, 0, 60_000), [conta.TORRAO.alcance, 0]);
  assert.equal(conta.tiroPega(100, 100, 1, 0, 1000, 200, 110, 0), true);
  assert.equal(conta.tiroPega(100, 100, 1, 0, 1000, 200, 160, 0), false, 'longe da linha');
  assert.equal(conta.tiroPega(100, 100, 1, 0, 100, 300, 100, 0), false, 'ainda não chegou');
  const [bx, by] = conta.alvoDaBomba(0, 0, 300, 0);
  assert.equal(bx, conta.BOMBA.alcance);
  assert.equal(by, 0);
  const [fx, fy] = conta.fimDaInvestida(240, 160, 1, 0, 26);
  assert.equal(fx, conta.ARENA.x1 - 26);
  assert.equal(fy, 160);
  assert.equal(conta.vulneravel('embaixo'), false);
  assert.equal(conta.vulneravel('tonta'), true);
});

test('a medalha do fim é a do troféu', () => {
  assert.equal(marcaDoLugar(1, 50, { venceu: true, solo: false, ficaram: 2 }), '🥇');
  assert.equal(marcaDoLugar(1, 50, { venceu: false, solo: false, ficaram: 2 }), '1.');
  assert.equal(marcaDoLugar(1, 50, { venceu: true, solo: true, ficaram: 1 }), '1.');
  assert.equal(marcaDoLugar(null, 50, { venceu: true, solo: false, ficaram: 2 }), '–');
});

/**
 * A partida inteira: o servidor de verdade num relógio de mão (um passo a cada 50 ms), cada pessoa com o cliente da tela e o
 * piloto, e a rede com IDA ms em cada sentido. Devolve o último quadro e o público do fim.
 */
async function partida(ids: number[], IDA = 100, sementeInicial = 7, corpo: Record<string, unknown> = {}) {
  const { criarChefe } = await import('../../server/src/chefe/motor.ts');
  let semente = sementeInicial;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  let agora = 1_000_000;
  let passo: (() => void) | null = null;
  let fim: (() => void) | null = null;
  let terminou = false;
  /** O que está na rede: [quando chega, para quem (0 = servidor), de quem, o quê]. */
  const rede: { em: number; para: number; de: number; dados: unknown }[] = [];
  const ctx = {
    agendar: (_ms: number, depois: () => void) => {
      fim = depois;
    },
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => ids,
    nome: (id: number) => `p${id}`,
    comunidade: ids.length > 1 ? 5 : 0,
    solo: ids.length === 1,
    difundir: (d: unknown) => {
      for (const id of ids) rede.push({ em: agora + IDA, para: id, de: 0, dados: d });
    },
  };
  const jogo = criarChefe({ agora: () => agora, aleatorio, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala: ids,
    criadaPor: ids[0],
    corpo,
  });
  assert.ok(typeof jogo !== 'string');
  const clientes = ids.map((id) => {
    const c = new Cliente(id, (dados) => rede.push({ em: agora + IDA, para: 0, de: id, dados }));
    return { c, cmd: comandosVazios() };
  });
  let ultimo: Quadro | null = null;
  let k = 0;
  for (let ms = 0; ms < 9 * 60_000 && !terminou; ms += 1000 / 60) {
    agora += 1000 / 60;
    if (++k % 3 === 0) passo!();
    // a rede entrega o que chegou
    for (let i = 0; i < rede.length; ) {
      const r = rede[i];
      if (r.em > agora) {
        i++;
        continue;
      }
      rede.splice(i, 1);
      if (r.para === 0) jogo.tempoReal!(r.de, r.dados);
      else {
        clientes[ids.indexOf(r.para)].c.chegou(r.dados as Quadro, agora);
        ultimo = r.dados as Quadro;
      }
    }
    for (const { c, cmd } of clientes) {
      const v = c.vista(agora);
      if (c.jogando()) pilotoAutomatico(c.eu, v, cmd);
      c.passo(cmd, 1 / 60, agora, v);
    }
    if (ultimo && ultimo.f !== 'lutando' && fim) {
      fim();
      break;
    }
  }
  return { ultimo: ultimo!, publico: jogo.publico(ids[0]) as Record<string, unknown>, segundos: (agora - 1_000_000) / 1000 };
}

test('sozinho, com 200 ms de ida e volta, o piloto vence a toupeira (mais fraca no Solo)', async (t) => {
  const { ultimo, publico, segundos } = await partida([7]);
  t.diagnostic(`a luta levou ${Math.round(segundos)} s; vidas: ${ultimo.j[0][6]}; dano: ${ultimo.d}`);
  assert.equal(ultimo.f, 'vitoria', `fase ${ultimo.f}, a toupeira na fase ${ultimo.c[6] + 1} com ${ultimo.c[4]}%`);
  assert.ok(segundos < 4 * 60, 'a luta é curta');
  const r = publico.resultado as { pontos: number }[];
  assert.equal(r[0].pontos, publico.danoDaTurma);
});

test('com quatro, a turma vence junta, e o dano da turma é a soma do de cada um', async (t) => {
  const { ultimo, publico, segundos } = await partida([11, 12, 13, 14], 100, 3);
  t.diagnostic(`a luta levou ${Math.round(segundos)} s; vidas: ${ultimo.j.map((l) => l[6]).join(', ')}; dano: ${ultimo.d}`);
  assert.equal(ultimo.f, 'vitoria');
  const r = publico.resultado as { pontos: number }[];
  assert.equal(
    r.reduce((s, l) => s + l.pontos, 0),
    publico.danoDaTurma,
  );
  assert.ok(r.filter((l) => l.pontos > 0).length >= 3, 'quase todo mundo acertou alguma coisa');
});

test('o yeti (19/11/2026): sozinho, com 200 ms de ida e volta, o piloto vence, devolvendo as bolas de neve', async (t) => {
  const { ultimo, publico, segundos } = await partida([7], 100, 11, { chefe: 'yeti' });
  t.diagnostic(`a luta com o yeti levou ${Math.round(segundos)} s; vidas: ${ultimo.j[0][6]}; dano: ${ultimo.d}`);
  assert.equal(ultimo.c[9], 1, 'o quadro diz que é o yeti');
  assert.equal(ultimo.f, 'vitoria', `fase ${ultimo.f}, o yeti na fase ${ultimo.c[6] + 1} com ${ultimo.c[4]}%`);
  assert.equal(publico.chefe, 'yeti');
});

// ---------------- A segunda auditoria (20/11/2026) ----------------

test('a maratona: sozinho, o piloto vence a toupeira e depois o yeti, seis fases', async (t) => {
  const { ultimo, publico, segundos } = await partida([7], 100, 5, { chefe: 'maratona' });
  t.diagnostic(`a maratona levou ${Math.round(segundos)} s; vidas: ${ultimo.j[0][6]}; dano: ${ultimo.d}`);
  assert.equal(ultimo.f, 'vitoria', `fase ${ultimo.f}, etapa ${ultimo.c[10]}, fase ${ultimo.c[6] + 1} com ${ultimo.c[4]}%`);
  assert.equal(ultimo.c[10], 1, 'acabou no yeti');
  assert.equal(publico.fases, 6);
});

test('o golpe de pá do cliente: só vai ao servidor com o chefe parado ou tonto e colado, e respeita a recarga', () => {
  const enviados: Record<string, unknown>[] = [];
  const c = new Cliente(7, (d) => enviados.push(d as Record<string, unknown>));
  const q = (estado: string, n: number): Quadro => ({
    tipo: 'q', n, f: 'lutando',
    c: [240, 150, conta.ESTADOS.indexOf(estado as conta.EstadoDoChefe), 1, 100, 0, 0, 240, 150, 0, 0],
    m: [], t: [], j: [[7, 240 - conta.CORPO_CHEFE - 10, 150, 1, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0]], p: [], b: [], d: 0, e: [],
  });
  let agora = 1000;
  for (let n = 1; n <= 10; n++) c.chegou(q('parada', n), (agora += 50));
  const cmd = comandosVazios();
  cmd.pa = true;
  c.passo(cmd, 1 / 60, agora, c.vista(agora));
  assert.equal(enviados.filter((d) => d.tipo === 'pa').length, 1);
  assert.equal(cmd.pa, false, 'o aperto é lido uma vez');
  // logo de novo: a recarga
  cmd.pa = true;
  c.passo(cmd, 1 / 60, (agora += 50), c.vista(agora));
  assert.equal(enviados.filter((d) => d.tipo === 'pa').length, 1);
  // preparando um golpe: a pá sai (o coelho mexe), mas nada vai ao servidor
  for (let n = 11; n <= 20; n++) c.chegou(q('prep-terremoto', n), (agora += 50));
  agora += conta.PA.recargaMs;
  cmd.pa = true;
  c.passo(cmd, 1 / 60, agora, c.vista(agora));
  assert.equal(enviados.filter((d) => d.tipo === 'pa').length, 1);
});

// ---------------- O lote D (21/11/2026): a arena que muda e a alpaca-rei ----------------

test('a conta dos buracos: o coelho que anda para dentro de um buraco aberto fica na borda', () => {
  const [x, y] = conta.foraDosBuracos(200, 150, [[200, 150, conta.BURACO.raio]]);
  assert.ok(Math.hypot(x - 200, y - 150) >= conta.BURACO.raio + conta.CORPO_COELHO - 0.001);
  assert.deepEqual(conta.foraDosBuracos(100, 100, [[200, 150, conta.BURACO.raio]]), [100, 100]);
});

test('a alpaca-rei: sozinho, com 200 ms de ida e volta, o piloto vence, desviando do leque e dos buracos', async (t) => {
  const { ultimo, publico, segundos } = await partida([7], 100, 13, { chefe: 'alpaca' });
  t.diagnostic(`a luta com a alpaca levou ${Math.round(segundos)} s; vidas: ${ultimo.j[0][6]}; buracos: ${ultimo.bu?.length ?? 0}`);
  assert.equal(ultimo.c[9], 2, 'o quadro diz que é a alpaca');
  assert.equal(ultimo.f, 'vitoria', `fase ${ultimo.f}, a alpaca na fase ${ultimo.c[6] + 1} com ${ultimo.c[4]}%`);
  assert.equal(publico.chefe, 'alpaca');
  assert.ok((ultimo.bu?.length ?? 0) > 0, 'a arena mudou');
});

test('com quatro, contra a alpaca, a turma vence junta', async (t) => {
  const { ultimo, segundos } = await partida([21, 22, 23, 24], 100, 17, { chefe: 'alpaca' });
  t.diagnostic(`levou ${Math.round(segundos)} s; vidas: ${ultimo.j.map((l) => l[6]).join(', ')}`);
  assert.equal(ultimo.f, 'vitoria');
});
