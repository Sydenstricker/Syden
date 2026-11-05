import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Mundo } from '../src/nave/mundo';
import { pilotar } from '../src/nave/piloto';
import { CHEFE_T, FIM, Ficha, posicaoInimigo, roteiro, tirosDosInimigos, vaivem } from '../src/nave/sim';

test('as duas cópias da regra da navinha são iguais (o site joga com a mesma conta que o servidor confere)', () => {
  const servidor = readFileSync(new URL('../../server/src/nave-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../src/nave/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/nave-sim.ts e web/src/nave/sim.ts mudaram separados: copie uma sobre a outra');
});

test('o roteiro sai da semente: a mesma semente, o mesmo roteiro; outra semente, outro', () => {
  assert.deepEqual(roteiro(42), roteiro(42));
  assert.notDeepEqual(roteiro(42), roteiro(43));
  const r = roteiro(42);
  assert.equal(r.at(-1)?.tipo, 'chefe');
  assert.equal(r.at(-1)?.t, CHEFE_T);
  assert.ok(r.length > 60, `inimigos: ${r.length}`);
  assert.ok(r.filter((e) => e.item).length >= 8, 'dois itens por onda');
  assert.equal(r.find((e) => e.item)?.item, 'duplo', 'o primeiro item é o tiro duplo');
  assert.ok(tirosDosInimigos(r).length > 200);
});

test('o vaivém, sem seno, vai de −1 a 1 e volta', () => {
  assert.equal(vaivem(0), 0);
  assert.equal(vaivem(0.25), 1);
  assert.equal(vaivem(0.75), -1);
  assert.ok(Math.abs(vaivem(0.5)) < 1e-12);
});

/** Uma partida inteira com o piloto automático; cada lote passa pela ficha do "servidor" (outra Ficha, do zero). */
function partida(semente: number) {
  const m = new Mundo(semente, true);
  const servidor = new Ficha(roteiro(semente));
  let recusas = 0;
  for (let n = 0; n <= FIM && !m.ficha.acabou; n++) {
    m.avancar(pilotar(m));
    if (n % 6 === 0) {
      for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
      if (servidor.posicao(m.passo, m.nave.x, m.nave.y) !== null) recusas++;
    }
  }
  for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
  return { m, servidor, recusas };
}

test('o piloto automático joga a partida inteira, e o servidor aceita cada evento e chega aos mesmos pontos', () => {
  for (const semente of [1, 2, 3]) {
    const { m, servidor, recusas } = partida(semente);
    assert.equal(recusas, 0, `semente ${semente}: o servidor recusou ${recusas} eventos honestos`);
    assert.equal(servidor.total(FIM, true), m.ficha.total(FIM, true));
    assert.ok(m.ficha.mortos.size > 50, `semente ${semente}: derrubou ${m.ficha.mortos.size}`);
    assert.ok(m.ficha.chefeEm !== null, `semente ${semente}: o chefe ficou de pé (vidas ${m.ficha.vidas}, morte ${m.ficha.morteFinal})`);
    console.log(`semente ${semente}: ${m.ficha.total(FIM, true)} pontos, ${m.ficha.vidas} vidas, chefe no passo ${m.ficha.chefeEm}, ${m.ficha.pegos.size} itens`);
  }
});

test('a ficha recusa a trapaça óbvia', () => {
  const inimigos = roteiro(5);
  const f = new Ficha(inimigos);
  const i = 0;
  const e = inimigos[i];
  // um passo da cadência em que o corvo está na tela, e a nave logo abaixo dele
  let q = e.t + Math.round(e.dur / 2);
  while (q % 7 !== 0) q++;
  const alvo = posicaoInimigo(e, q + 4)!;
  const x = Math.round(alvo.x * 100) / 100;
  const y = Math.round((alvo.y + 26) * 100) / 100;
  // fora da cadência
  assert.equal(f.acerto(q + 4, i, q + 1, x, y, 0, 0), 'Disparo inválido.');
  // com uma arma que a pessoa não tem
  assert.equal(f.acerto(q + 4, i, q, x, y, 2, 1), 'Disparo inválido.');
  // a bala longe do inimigo
  assert.equal(f.acerto(q + 4, i, q, x + 40, y, 0, 0), 'Acerto inválido.');
  // a nave teleportada: de (90, 210) no passo 0 a cá não dá
  assert.equal(f.posicao(0, 90, 210), null);
  const longe = f.acerto(q + 4, i, q, x, y, 0, 0);
  if (q * 2 + 2 < Math.hypot(x - 90, y - 210)) assert.equal(longe, 'Lugar inválido.');
  // um item que ninguém soltou
  assert.equal(f.pegar(q + 10, 1, x, y), 'Item inválido.');
  // duas bombas na mesma vida
  const g = new Ficha(inimigos);
  assert.equal(g.bomba(200, 90, 210), null);
  assert.equal(g.bomba(210, 90, 210), 'Sem bomba.');
});
