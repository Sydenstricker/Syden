/** A roda da feira (festa/rodafeira.ts): o aperto freia a roda, e o prêmio é o da fatia onde ela para. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { paradaDaRoda, premioEm, RODA_GIRO_MS, RODA_VEZ_MS, RODA_VEZES, type DadosRoda } from '../src/festa/rodafeira.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
/** O primeiro instante do giro em que apertar dá o prêmio pedido. */
const horaDo = (d: DadosRoda, vez: number, premio: number) => {
  for (let ms = 0; ms <= RODA_GIRO_MS; ms++) if (premioEm(d.giros[vez].fatias, paradaDaRoda(d.giros[vez].v, ms)) === premio) return ms;
  return -1;
};

test('roda: as fatias cobrem a volta inteira, e o 10 sai em todo giro, numa janela curta', () => {
  for (let s = 1; s <= 10; s++) {
    const d = rodadaDeTeste('rodafeira', { aleatorio: sorteioFixo(s) }).rodada.publico(ANA).dados as DadosRoda;
    for (let v = 0; v < RODA_VEZES; v++) {
      const f = d.giros[v].fatias;
      assert.equal(f[0].de, 0);
      assert.equal(f[f.length - 1].ate, 1);
      for (let i = 1; i < f.length; i++) assert.equal(f[i].de, f[i - 1].ate);
      assert.ok(horaDo(d, v, 10) >= 0);
      let janela = 0;
      for (let ms = 0; ms < 1000 / d.giros[v].v; ms++) if (premioEm(f, paradaDaRoda(d.giros[v].v, ms)) === 10) janela++;
      assert.ok(janela > 30 && janela < 90, `o 10 fica ${janela} ms embaixo da seta`);
    }
  }
});

test('roda: com 200 e 300 ms de rede, quem acerta o 10 ganha; o segundo aperto do giro não conta', () => {
  const r = rodadaDeTeste('rodafeira', { aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(ANA).dados as DadosRoda;
  const eventos: [number, number, number][] = [];
  for (let v = 0; v < RODA_VEZES; v++) {
    const dez = v * RODA_VEZ_MS + horaDo(d, v, 10) + 3;
    const um = v * RODA_VEZ_MS + horaDo(d, v, 1) + 3;
    eventos.push([dez + 100, ANA, dez]);
    eventos.push([um + 150, BIA, um]);
    eventos.push([um + 1000 + 150, BIA, um + 1000]);
  }
  for (const [chega, quem, t] of eventos.sort((x, y) => x[0] - y[0])) {
    r.em(chega);
    r.rodada.acao(quem, { tipo: 'acerto', t });
  }
  r.em(RODA_VEZES * RODA_VEZ_MS);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, 30);
  assert.equal(r.linhaDe(BIA).valor, 3);
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('roda: o aperto perfeito mandado depois da hora não vale, nem o de depois que a roda passou', () => {
  const r = rodadaDeTeste('rodafeira', { aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(ANA).dados as DadosRoda;
  r.em(horaDo(d, 0, 10) + 1500);
  r.rodada.acao(ANA, { tipo: 'acerto', t: horaDo(d, 0, 10) });
  r.em(RODA_GIRO_MS + 200 + 100);
  r.rodada.acao(ANA, { tipo: 'acerto', t: RODA_GIRO_MS + 200 });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('roda: o robô não ganha num giro que ainda não parou', () => {
  const d = rodadaDeTeste('rodafeira').rodada.publico(ANA).dados;
  for (let k = 0; k < 50; k++) {
    assert.equal(resultadoDoRobo('rodafeira', d, Math.random, 1000).motivo, 'errou');
    assert.ok((resultadoDoRobo('rodafeira', d, Math.random, RODA_VEZ_MS + 100).valor ?? 0) <= 10);
  }
});
