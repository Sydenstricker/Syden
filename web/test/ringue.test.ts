/**
 * O Ringue da toca (web/src/ringue/sim.ts): a regra é a mesma do servidor (server/src/ringue-sim.ts), que refaz o circuito pela
 * semente e pelos comandos. Aqui: as duas cópias iguais, a mesma semente e os mesmos comandos dando a mesma luta, o piloto
 * automático lendo os avisos e vencendo o circuito, e o que pune quem não lê (sem defesa, cai).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { comandoDoPiloto } from '../src/ringue/piloto';
import { ADVERSARIOS, anotar, BAIXO, comparar, ESQ, novaLuta, passo, refazer, resultadoDe, SOCO_E, type Luta } from '../src/ringue/sim';

/** O piloto, que deixa de reagir a uma parte dos avisos (`erro`, de 0 a 1), e os comandos em trechos. */
function lutar(semente: number, erro = 0, comando: (l: Luta) => number = comandoDoPiloto) {
  const l = novaLuta(semente);
  const entradas: number[] = [];
  let x = semente;
  let falha = false;
  const eventos: Record<string, number> = {};
  while (!l.terminou) {
    if (l.a.estado === 'aviso' && l.a.t === 0) {
      x = (x * 48271) % 2147483647;
      falha = (x % 1000) / 1000 < erro;
    }
    const bits = falha && l.a.estado === 'aviso' ? 0 : comando(l);
    anotar(entradas, bits);
    passo(l, bits);
    for (const e of l.eventos) eventos[e.tipo] = (eventos[e.tipo] ?? 0) + 1;
  }
  return { l, entradas, eventos };
}

describe('ringue da toca', () => {
  it('as duas cópias da regra são iguais (o servidor refaz com a mesma conta)', () => {
    const site = readFileSync(new URL('../src/ringue/sim.ts', import.meta.url));
    const servidor = readFileSync(new URL('../../server/src/ringue-sim.ts', import.meta.url));
    assert.ok(site.equals(servidor), 'web/src/ringue/sim.ts e server/src/ringue-sim.ts mudaram separados: copie um sobre o outro');
  });

  it('a regra não usa seno, cosseno nem sorteio de fora (o servidor precisa da mesma conta)', () => {
    const fonte = readFileSync(new URL('../src/ringue/sim.ts', import.meta.url), 'utf8');
    for (const proibido of ['Math.sin', 'Math.cos', 'Math.random', 'Date.', 'performance.']) assert.ok(!fonte.includes(proibido), proibido);
    assert.ok(!/^import /m.test(fonte), 'sem import');
  });

  it('o piloto lê os avisos e vence o circuito, por nocaute, nas sementes todas', () => {
    for (const semente of [1, 7, 42, 2024, 99999, 1234567]) {
      const { l, eventos } = lutar(semente);
      assert.equal(l.vencidas, ADVERSARIOS.length, `semente ${semente}`);
      assert.ok((eventos.interrompeu ?? 0) > 0, 'interrompeu golpes no brilho');
      assert.ok((eventos.esquivou ?? 0) > 5, 'esquivou');
      assert.ok((eventos.estrela ?? 0) > 0 && (eventos.queda ?? 0) >= 6, 'ganhou estrelas e derrubou');
      // um circuito perfeito leva uns 2 minutos, longe do máximo
      assert.ok(l.passo < 60 * 60 * 4, `semente ${semente}: ${l.passo} passos`);
    }
  });

  it('a mesma semente e os mesmos comandos dão a mesma luta (o que o servidor refaz)', () => {
    for (const semente of [3, 77]) {
      const { l, entradas } = lutar(semente, 0.4);
      const { l: r, passos } = refazer(semente, entradas);
      assert.equal(passos, l.passo);
      assert.ok(r.terminou);
      assert.deepEqual(resultadoDe(r), resultadoDe(l));
      assert.equal(r.danoRecebido, l.danoRecebido);
    }
  });

  it('quem não defende leva e cai, e quem lê vai mais longe', () => {
    let pior = 0;
    for (const semente of [5, 11, 19]) {
      const bom = lutar(semente);
      const ruim = lutar(semente, 1);
      assert.ok(ruim.l.vencidas < ADVERSARIOS.length, `semente ${semente}: sem defesa e venceu tudo`);
      assert.ok((ruim.eventos.atingido ?? 0) > 5);
      assert.ok(comparar(resultadoDe(bom.l), resultadoDe(ruim.l)) < 0);
      pior += ruim.l.vencidas;
    }
    assert.ok(pior <= 3, 'sem defesa não passa do primeiro adversário quase nunca');
  });

  it('cada adversário tem o seu jeito: o pesado dói mais e avisa mais devagar, o trapaceiro finge', () => {
    const [ligeiro, pesado, trapaceiro] = ADVERSARIOS;
    const maior = (a: typeof ligeiro, f: (g: { aviso: number; dano: number }) => number) => Math.max(...a.acoes.flatMap((x) => x.golpes ?? []).map(f));
    assert.ok(maior(pesado, (g) => g.dano) > maior(ligeiro, (g) => g.dano));
    assert.ok(maior(pesado, (g) => g.aviso) > maior(ligeiro, (g) => g.aviso));
    assert.ok(trapaceiro.acoes.some((x) => x.finta) && trapaceiro.fintas.every((g) => g.brilho === null), 'a finta nunca brilha');
  });

  it('caído, levanta apertando; parado, a contagem chega a 10', () => {
    // ninguém se mexe: o ligeiro derruba, e sem apertar nada a luta acaba no nocaute
    const parado = lutar(8, 0, () => 0);
    assert.equal(parado.l.vencidas, 0);
    assert.ok(parado.l.nocaute);
    // apertar só para levantar (e esquivar sempre para o mesmo lado): levanta da primeira queda
    let levantou = 0;
    const l = novaLuta(8);
    let k = 0;
    while (!l.terminou && l.passo < 60 * 60 * 3) {
      k++;
      const bits = l.queda === 'jogador' ? (k % 4 < 2 ? SOCO_E : 0) : k % 90 === 0 ? ESQ : k % 90 === 45 ? BAIXO : 0;
      passo(l, bits);
      for (const e of l.eventos) if (e.tipo === 'levantou' && e.quem === 'jogador') levantou++;
    }
    assert.ok(levantou >= 1, 'levantou apertando');
  });

  it('o adversário que muda: abaixo de 1/3 da vida (ou no 3º round) entra na fúria, com golpes novos e menos espera', () => {
    for (const A of ADVERSARIOS) {
      assert.ok(A.furia.acoes.length > 0, `${A.bicho}: a fúria traz golpe novo`);
      assert.ok(A.furia.espera[1] < A.espera[1], `${A.bicho}: e espera menos`);
    }
    // o piloto que bate: cada luta passa pela fúria quando a vida do adversário cai abaixo de um terço
    const { l, eventos } = lutar(42);
    assert.equal(l.vencidas, ADVERSARIOS.length);
    assert.ok((eventos.furia ?? 0) >= ADVERSARIOS.length, `fúrias: ${eventos.furia}`);
    // no 3º round, mesmo com a vida cheia: quem só defende chega lá e vê a fúria
    const parado = novaLuta(5);
    let viu = false;
    while (!parado.terminou && !viu) {
      passo(parado, 0);
      if (parado.eventos.some((e) => e.tipo === 'furia')) {
        viu = true;
        assert.ok(parado.round === 3 || parado.a.vida * 3 < ADVERSARIOS[parado.adv].vida);
        assert.equal(parado.a.furia, true);
      }
    }
    // (quem não defende cai antes do 3º round: aí a fúria não precisa aparecer)
    if (!viu) assert.ok(parado.terminou);
  });
});
