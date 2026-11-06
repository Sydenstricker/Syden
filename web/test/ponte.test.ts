/**
 * A Ponte da toca (web/src/ponte/sim.ts): a regra é a mesma do servidor (server/src/ponte-sim.ts), que refaz a simulação a partir
 * da lista de peças. Aqui: as duas cópias iguais e sem trigonometria, o determinismo, a ponte de referência de cada fase passando e
 * a fraca caindo, a conferência da lista e a ordem do placar.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ACO,
  comparar,
  conferir,
  custo,
  faseDe,
  FASES,
  MADEIRA,
  montar,
  passo,
  PASSO,
  PISTA,
  pontePronta,
  SAIDA,
  semSoltas,
  simular,
} from '../src/ponte/sim';
import { Fila, filaInicial, fimDaFila, naFila } from '../src/ponte/fila';
import { MODELOS_DA_PONTE } from '../src/ponte/vista';

/** Só a pista, de margem a margem: sem estrutura nenhuma. */
function soPista(largura: number): number[] {
  const p: number[] = [];
  for (let x = 0; x < largura; x += 2) p.push(x, 0, x + 2, 0, PISTA);
  return p;
}

describe('ponte da toca', () => {
  it('as duas cópias da regra são iguais, e a regra não usa seno, cosseno nem o relógio', () => {
    const site = readFileSync(new URL('../src/ponte/sim.ts', import.meta.url));
    const servidor = readFileSync(new URL('../../server/src/ponte-sim.ts', import.meta.url));
    assert.ok(site.equals(servidor), 'web/src/ponte/sim.ts e server/src/ponte-sim.ts mudaram separados: copie uma sobre a outra');
    const texto = site.toString();
    for (const proibido of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.exp', 'Math.log', 'Math.pow', 'Math.random', 'Date.now', 'performance'])
      assert.ok(!texto.includes(proibido), proibido);
  });

  it('a ponte de referência de cada fase é válida e PASSA; só a pista, sem estrutura, cai', () => {
    for (const f of FASES) {
      const boa = pontePronta(f);
      assert.equal(conferir(f, boa), null, f.id);
      const r = simular(f, boa);
      assert.equal(r.passou, true, `${f.id}: a de referência não passou`);
      assert.equal(r.progresso, 1000);
      assert.equal(r.custo, custo(boa));
      const fraca = simular(f, soPista(f.largura));
      assert.equal(fraca.passou, false, `${f.id}: só a pista passou`);
      assert.ok(fraca.progresso < 1000);
    }
  });

  it('a mesma lista dá sempre o mesmo resultado, passo a passo', () => {
    const f = faseDe('ravina')!;
    // a de referência com madeira no lugar do aço: ela quebra no meio, e a quebra também tem de ser a mesma
    const lista = pontePronta(f).map((v, i) => (i % 5 === 4 && v === ACO ? MADEIRA : v));
    const valida = semSoltas(f, lista);
    const a = montar(f, valida);
    const b = montar(f, valida);
    while (!a.terminou) {
      passo(a);
      passo(b);
    }
    assert.equal(b.terminou, true);
    assert.equal(a.passo, b.passo);
    assert.equal(a.passou, b.passou);
    assert.equal(a.progresso, b.progresso);
    for (let i = 0; i < a.nos.length; i++) {
      assert.equal(a.nos[i].x, b.nos[i].x);
      assert.equal(a.nos[i].y, b.nos[i].y);
    }
    assert.deepEqual(
      a.barras.map((x) => x.inteira),
      b.barras.map((x) => x.inteira),
    );
  });

  it('a madeira sozinha não segura os vãos grandes: o caminhão pede aço', () => {
    const f = faseDe('pedra')!;
    const soMadeira: number[] = [];
    const boa = pontePronta(f);
    for (let i = 0; i < boa.length; i += 5) {
      const peca = boa.slice(i, i + 5);
      if (peca[4] === ACO && conferir(f, [...soMadeira, peca[0], peca[1], peca[2], peca[3], MADEIRA]) !== null) continue;
      soMadeira.push(peca[0], peca[1], peca[2], peca[3], peca[4] === ACO ? MADEIRA : peca[4]);
    }
    const r = simular(f, semSoltas(f, soMadeira));
    assert.equal(r.passou, false);
  });

  it('a conferência recusa o que está fora da regra', () => {
    const f = faseDe('riacho')!;
    assert.equal(conferir(f, []), null, 'a ponte vazia é válida (e cai)');
    assert.equal(conferir(f, [0, 0, 2, 0, PISTA]), null);
    assert.equal(conferir(f, [0, 0, 2, 0]), 'formato');
    assert.equal(conferir(f, [0, 0, 2, 0, 9]), 'tipo');
    assert.equal(conferir(f, [0, 0, -1, 0, MADEIRA]), 'fora-da-grade');
    assert.equal(conferir(f, [0, 0, 0, 1, MADEIRA]), 'fora-da-grade', 'a coluna da margem só tem as âncoras');
    assert.equal(conferir(f, [0, 0, 3, 0, PISTA]), 'comprimento');
    assert.equal(conferir(f, [0, 0, 1, 2, PISTA]), 'comprimento', 'a pista não passa de 45°');
    assert.equal(conferir(f, [0, 0, 1, 2, MADEIRA]), null, 'a madeira pode');
    assert.equal(conferir(f, [0, 0, 3, 2, ACO]), null, 'o aço vai mais longe');
    assert.equal(conferir(f, [0, 0, 2, 0, PISTA, 2, 0, 0, 0, MADEIRA]), 'repetida');
    assert.equal(conferir(f, [2, 1, 3, 1, MADEIRA]), 'solta');
    assert.equal(conferir(f, [0, 0, 1, 1, MADEIRA, 3, 1, 4, 1, MADEIRA]), 'solta');
  });

  it('o que fica solto cai junto (a montagem tira)', () => {
    const f = faseDe('riacho')!;
    const lista = [0, 0, 1, 1, MADEIRA, 1, 1, 2, 1, MADEIRA, 4, 1, 5, 1, MADEIRA];
    assert.deepEqual(semSoltas(f, lista), [0, 0, 1, 1, MADEIRA, 1, 1, 2, 1, MADEIRA]);
  });

  it('o custo é o preço × o comprimento, e o placar põe quem passou na frente, pelo menor custo', () => {
    assert.equal(custo([0, 0, 2, 0, PISTA]), 300);
    assert.equal(custo([0, 0, 1, 1, MADEIRA]), 141);
    assert.equal(custo([0, 0, 3, 2, ACO]), 1082);
    const a = { passou: true, progresso: 1000, custo: 3000 };
    const b = { passou: true, progresso: 1000, custo: 2500 };
    const c = { passou: false, progresso: 800, custo: 900 };
    const d = { passou: false, progresso: 300, custo: 100 };
    assert.deepEqual([a, c, d, b].sort(comparar), [b, a, c, d]);
  });
  it('a fila do desenho: o tráfego espera na ordem, encostado, e chega à saída antes de a regra soltar cada um (nada pula)', () => {
    for (const f of FASES) {
      const x = filaInicial(f);
      assert.equal(x.length, f.trafego.length);
      assert.equal(x[0], SAIDA, `${f.id}: o primeiro espera na saída`);
      for (let i = 1; i < x.length; i++) assert.ok(x[i] < x[i - 1], `${f.id}: o ${i}º atrás do da frente`);
      assert.ok(fimDaFila(f) < x[x.length - 1]);
      const s = montar(f, pontePronta(f));
      const fila = new Fila(f);
      let antes = fila.atualizar(s, 0).slice();
      while (!s.terminou) {
        const eraFila = s.veiculos.map((_, i) => naFila(s, i));
        passo(s);
        const agora = fila.atualizar(s, PASSO).slice();
        s.veiculos.forEach((v, i) => {
          // quem a regra acabou de soltar já estava na saída, e ninguém anda para trás
          if (eraFila[i] && !naFila(s, i)) assert.ok(Math.abs(antes[i] - SAIDA) < 1e-9, `${f.id}: o ${i}º pulou de ${antes[i]} para ${v.x}`);
          assert.ok(agora[i] >= antes[i] - 1e-9, `${f.id}: o ${i}º andou para trás`);
        });
        antes = agora;
      }
    }
  });

  it('os veículos 3D estão em web/public/ponte, com as texturas e as licenças', () => {
    const pasta = new URL('../public/ponte/', import.meta.url);
    for (const m of MODELOS_DA_PONTE) {
      assert.ok(existsSync(new URL(m, pasta)), `falta ${m}`);
      let json: { images?: { uri?: string }[]; buffers?: { uri?: string }[] };
      const b = readFileSync(new URL(m, pasta));
      if (m.endsWith('.glb')) json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
      else json = JSON.parse(b.toString());
      for (const u of [...(json.images ?? []), ...(json.buffers ?? [])].map((i) => i.uri).filter(Boolean) as string[])
        assert.ok(existsSync(new URL(u, pasta)), `${m} pede ${u}`);
    }
    for (const l of ['LICENCA-Kenney-Car-Kit.txt', 'LICENCA-KayKit-Halloween-Bits.txt'])
      assert.match(readFileSync(new URL(l, pasta), 'utf8'), /Creative Commons Zero, CC0/, l);
  });
});
