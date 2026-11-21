/**
 * O Trânsito da toca (web/src/transito/sim.ts): a regra é a mesma do servidor (server/src/transito-sim.ts), que refaz a partida a
 * partir da semente e das liberações. Aqui: as duas cópias iguais, o piloto automático jogando o minuto sem batida, a mesma
 * semente dando o mesmo resultado, e o que pune (a batida, a fila cheia).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { escolhaDoPiloto } from '../src/transito/piloto';
import { CAMINHOS, liberar, MAPA, novaPartida, passo, refazer, sortearChegadas, PASSOS_DA_PARTIDA, manobraPermitida, MEDIDAS, PRAZO_DA_AMBULANCIA, PENA_DA_AMBULANCIA, PASSOS_DO_TETO, ritmoDaChegada, velocidade, valorDaAmbulancia, type Estado, type Opcoes } from '../src/transito/sim';
import { PREDIOS, VEICULOS } from '../src/transito/atlas.gerado';

function jogarComPiloto(semente: number, opcoes: Opcoes = {}, ate = Infinity): { e: Estado; lista: number[] } {
  const e = novaPartida(semente, opcoes);
  const lista: number[] = [];
  while (!e.terminou && e.passo < ate) {
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
      { passo: 90, entrada: 1, manobra: 'reto', tipo: 'carro', pele: 1 },
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

  // ===== 19/11/2026: o "até bater", o mapa em T, o caminhão e a moto =====

  it('o caminhão e a moto chegam, cada um com as medidas dele, e o piloto continua sem batida', () => {
    const tipos = new Set(sortearChegadas(7).map((c) => c.tipo));
    assert.ok(tipos.has('caminhao') && tipos.has('moto') && tipos.has('ambulancia') && tipos.has('carro'));
    assert.ok(MEDIDAS.caminhao.comprimento > MEDIDAS.carro.comprimento && MEDIDAS.caminhao.rapidez < 1);
    assert.ok(MEDIDAS.moto.comprimento < MEDIDAS.carro.comprimento && MEDIDAS.moto.rapidez > 1);
  });

  it('o mapa em T: ninguém vem de baixo nem vai para baixo, e o piloto joga o minuto sem batida', () => {
    for (const semente of [3, 77, 4040]) {
      const ch = sortearChegadas(semente, 't');
      assert.ok(ch.every((c) => c.entrada !== 3 && manobraPermitida('t', c.entrada, c.manobra)), `semente ${semente}`);
      const { e } = jogarComPiloto(semente, { mapa: 't' });
      assert.equal(e.passo, PASSOS_DA_PARTIDA);
      assert.equal(e.batidas, 0, `semente ${semente}`);
      assert.ok(e.atravessaram >= 30, `semente ${semente}: só ${e.atravessaram}`);
    }
  });

  it('"até bater": passa do minuto com o piloto, e acaba na primeira batida (refeita igual)', () => {
    const { e, lista } = jogarComPiloto(9, { modo: 'ate-bater' }, 2 * PASSOS_DA_PARTIDA);
    assert.ok(e.passo >= 2 * PASSOS_DA_PARTIDA || e.terminou, 'o piloto aguenta');
    assert.equal(e.terminou, false, 'o piloto aguenta dois minutos sem bater');
    // soltar tudo de uma vez bate cedo, e a partida acaba ali
    const cego: number[] = [];
    for (let p = 0; p < 2000; p += 6) for (let r = 0; r < 4; r++) cego.push(p, r);
    const b = refazer(9, cego, { modo: 'ate-bater' });
    assert.equal(b.terminou, true);
    assert.equal(b.batidas, 1);
    assert.ok(b.passo < 2000);
    // não soltar ninguém: a terceira fila que transborda acaba
    const parado = refazer(9, [], { modo: 'ate-bater' });
    assert.equal(parado.buzinas, 3);
    assert.ok(parado.passo < 60 * 60);
    assert.ok(lista.length > 0);
  });

  // ===== 20/11/2026: o "até bater" aperta até os 5 minutos, e a ambulância com pressa =====

  it('o minuto é o de sempre, e o "até bater" continua apertando devagar até os 5 minutos', () => {
    for (let p = 0; p <= PASSOS_DA_PARTIDA; p += 50) assert.equal(ritmoDaChegada(p), 1.6 - 1.05 * Math.min(1, p / 3000));
    assert.ok(ritmoDaChegada(3 * PASSOS_DA_PARTIDA) < ritmoDaChegada(PASSOS_DA_PARTIDA));
    assert.ok(ritmoDaChegada(PASSOS_DO_TETO) < ritmoDaChegada(3 * PASSOS_DA_PARTIDA));
    assert.equal(ritmoDaChegada(PASSOS_DO_TETO + 999), ritmoDaChegada(PASSOS_DO_TETO));
    assert.ok(velocidade(4 * PASSOS_DA_PARTIDA) > velocidade(2 * PASSOS_DA_PARTIDA));
    assert.equal(velocidade(PASSOS_DO_TETO + 999), velocidade(PASSOS_DO_TETO));
    // o piloto aguenta os 5 minutos
    const { e } = jogarComPiloto(42, { modo: 'ate-bater' }, PASSOS_DO_TETO);
    assert.equal(e.terminou, false);
    assert.equal(e.batidas, 0);
  });

  it('a ambulância: solta rápido vale 3, demorando vale menos, e passado o prazo custa pontos', () => {
    assert.deepEqual([0, 240, 241, 420, 421, 600, 601].map(valorDaAmbulancia), [3, 3, 2, 2, 1, 1, 0]);
    const valorAoSoltar = (espera: number) => {
      const e = novaPartida(1);
      e.chegadas = [{ passo: 0, entrada: 0, manobra: 'reto', tipo: 'ambulancia', pele: 0 }];
      for (let i = 0; i < espera; i++) passo(e);
      const pontosAntes = e.pontos;
      assert.ok(liberar(e, 0));
      let n = 0;
      while (e.atravessaram === 0 && n++ < 600) passo(e);
      return { ganhou: e.pontos - pontosAntes, antes: pontosAntes, e };
    };
    assert.equal(valorAoSoltar(200).ganhou, 3);
    assert.equal(valorAoSoltar(400).ganhou, 2);
    assert.equal(valorAoSoltar(550).ganhou, 1);
    // o prazo: os pontos caem ali mesmo, e ela não vale nada depois
    const e = novaPartida(1);
    e.chegadas = [
      { passo: 0, entrada: 1, manobra: 'reto', tipo: 'caminhao', pele: 0 },
      { passo: 0, entrada: 0, manobra: 'reto', tipo: 'ambulancia', pele: 0 },
    ];
    for (let i = 0; i < 200; i++) passo(e);
    assert.ok(liberar(e, 1));
    while (e.passo < PRAZO_DA_AMBULANCIA) passo(e);
    assert.equal(e.atravessaram, 1, 'o caminhão passou antes do prazo');
    const antes = e.pontos;
    passo(e);
    assert.ok(e.eventos.some((v) => v.tipo === 'atrasou'));
    assert.equal(e.pontos, antes - PENA_DA_AMBULANCIA);
    assert.ok(liberar(e, 0));
    while (e.atravessaram === 1) passo(e);
    assert.equal(e.pontos, antes - PENA_DA_AMBULANCIA);
  });
});
