/**
 * O Trânsito da toca (web/src/transito/sim.ts): a regra é a mesma do servidor (server/src/transito-sim.ts), que refaz a partida a
 * partir da semente e das liberações. Aqui: as duas cópias iguais, o piloto automático jogando o minuto sem batida, a mesma
 * semente dando o mesmo resultado, e o que pune (a batida, a fila cheia).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { escolhaDoPiloto } from '../src/transito/piloto';
import { CAMINHOS, liberar, MAPA, novaPartida, passo, refazer, sortearChegadas, PASSOS_DA_PARTIDA, type Estado } from '../src/transito/sim';
import { PREDIOS, VEICULOS } from '../src/transito/atlas.gerado';

function jogarComPiloto(semente: number): { e: Estado; lista: number[] } {
  const e = novaPartida(semente);
  const lista: number[] = [];
  while (!e.terminou) {
    if (e.passo % 6 === 0) {
      const q = escolhaDoPiloto(e);
      if (q >= 0 && liberar(e, q)) lista.push(e.passo, q);
    }
    passo(e);
  }
  return { e, lista };
}

describe('trânsito da toca', () => {
  it('as duas cópias da regra são iguais (o servidor refaz com a mesma conta)', () => {
    const site = readFileSync(new URL('../src/transito/sim.ts', import.meta.url));
    const servidor = readFileSync(new URL('../../server/src/transito-sim.ts', import.meta.url));
    assert.ok(site.equals(servidor), 'web/src/transito/sim.ts e server/src/transito-sim.ts mudaram separados: copie uma sobre a outra');
  });

  it('o piloto automático joga o minuto inteiro sem batida e solta dezenas de carros', () => {
    for (const semente of [1, 7, 2024, 99999]) {
      const { e } = jogarComPiloto(semente);
      assert.equal(e.passo, PASSOS_DA_PARTIDA);
      assert.equal(e.batidas, 0, `semente ${semente}`);
      assert.ok(e.atravessaram >= 45, `semente ${semente}: só ${e.atravessaram}`);
      assert.ok(e.pontos >= e.atravessaram, 'os pontos contam os carros e os bônus');
    }
  });

  it('a mesma semente e as mesmas liberações dão o mesmo resultado (o que o servidor refaz)', () => {
    const { e, lista } = jogarComPiloto(31337);
    const de_novo = refazer(31337, lista);
    assert.deepEqual(
      [de_novo.pontos, de_novo.atravessaram, de_novo.batidas, de_novo.buzinas, de_novo.melhorSequencia],
      [e.pontos, e.atravessaram, e.batidas, e.buzinas, e.melhorSequencia],
    );
    assert.deepEqual(sortearChegadas(5), sortearChegadas(5));
    assert.notDeepEqual(sortearChegadas(5), sortearChegadas(6));
  });

  it('soltar tudo sem olhar bate, e não soltar nada enche as filas', () => {
    let batidas = 0;
    for (const semente of [1, 2, 4, 12345]) {
      const lista: number[] = [];
      for (let p = 0; p < PASSOS_DA_PARTIDA; p += 6) for (let r = 0; r < 4; r++) lista.push(p, r);
      batidas += refazer(semente, lista).batidas;
    }
    assert.ok(batidas >= 8, `soltar às cegas deveria bater (bateu ${batidas})`);
    const parado = refazer(1, []);
    assert.equal(parado.pontos, 0);
    assert.ok(parado.buzinas > 20, 'quem só espera ouve buzina');
  });

  it('a batida trava o cruzamento: ninguém sai até o guincho', () => {
    const e = novaPartida(1);
    e.chegadas = [
      { passo: 0, entrada: 0, manobra: 'reto', tipo: 'carro', pele: 0 },
      { passo: 0, entrada: 1, manobra: 'reto', tipo: 'carro', pele: 1 },
      { passo: 0, entrada: 2, manobra: 'reto', tipo: 'carro', pele: 2 },
    ];
    for (let i = 0; i < 300; i++) passo(e);
    // a 1 chega mais longe do ponto em que as duas ruas se cruzam: sai antes, e a 0 logo depois
    assert.ok(liberar(e, 1));
    for (let i = 0; i < 4; i++) passo(e);
    assert.ok(liberar(e, 0));
    let n = 0;
    while (e.batidas === 0 && n++ < 200) passo(e);
    assert.equal(e.batidas, 1);
    assert.equal(liberar(e, 2), false, 'travado');
    for (let i = 0; i < 121; i++) passo(e);
    assert.ok(e.carros.every((c) => !c.batido), 'o guincho levou os batidos');
    assert.ok(liberar(e, 2), 'destravou');
  });

  it('os caminhos começam e acabam fora do mapa, e as folhas têm todas as peças', () => {
    for (const c of CAMINHOS) {
      const n = c.pts.length;
      const fora = (x: number, y: number) => x < 0 || y < 0 || x > MAPA || y > MAPA;
      assert.ok(fora(c.pts[0], c.pts[1]) && fora(c.pts[n - 2], c.pts[n - 1]));
      assert.ok(c.parada > 2 && c.parada < c.entra);
    }
    assert.equal(VEICULOS.length, 9);
    assert.ok(VEICULOS.every((v) => v.length === 4));
    assert.ok(PREDIOS.length >= 10);
  });
});
