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
import { Cliente, comandosVazios, INVUL_MS, marcaDoLugar, type Quadro } from '../src/chefe/regras';

const ler = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

test('as contas do chefe são duas cópias iguais byte a byte (servidor e site)', () => {
  assert.equal(ler('../src/chefe/conta.ts'), ler('../../server/src/chefe/conta.ts'));
});

test('as medidas do site que não moram nas contas são as do servidor', async () => {
  const s = await import('../../server/src/chefe/motor.ts');
  assert.equal(INVUL_MS, s.INVUL_MS);
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
async function partida(ids: number[], IDA = 100, sementeInicial = 7) {
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
    corpo: {},
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
