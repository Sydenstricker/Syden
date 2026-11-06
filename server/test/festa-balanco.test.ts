/** O pulo do balanço (festa/balanco.ts): o pulo cai onde a hora de soltar manda, conferido no relógio do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { BALANCO_GIRO_MS, BALANCO_VEZ_MS, BALANCO_VEZES, pulo, type DadosBalanco } from '../src/festa/balanco.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** O primeiro instante da vez em que o pulo cai na folha que vale `valor`. */
function horaDaFolha(d: DadosBalanco, vez: number, valor: number) {
  for (let ms = 0; ms <= BALANCO_GIRO_MS; ms++) if (pulo(d, vez, ms).valor === valor) return ms;
  return -1;
}

test('balanço: as três folhas dão para alcançar em toda vez, a mais longe tem a janela mais curta', () => {
  for (let s = 1; s <= 10; s++) {
    const d = rodadaDeTeste('balanco', { aleatorio: sorteioFixo(s) }).rodada.publico(ANA).dados as DadosBalanco;
    for (let v = 0; v < BALANCO_VEZES; v++) {
      const janela = [1, 2, 3].map((valor) => {
        let n = 0;
        for (let ms = 0; ms < d.periodoMs; ms++) if (pulo(d, v, ms).valor === valor) n++;
        return n;
      });
      assert.ok(janela.every((n) => n > 25), `semente ${s}, vez ${v}: ${janela}`);
      assert.ok(janela[0] > janela[1] && janela[1] > janela[2], `semente ${s}, vez ${v}: ${janela}`);
    }
  }
});

test('balanço: com 200 e 300 ms de rede, quem pula na folha longe ganha; o segundo pulo da vez não conta', () => {
  const r = rodadaDeTeste('balanco', { aleatorio: sorteioFixo(2) });
  const d = r.rodada.publico(ANA).dados as DadosBalanco;
  const eventos: [number, number, number][] = [];
  for (let v = 0; v < BALANCO_VEZES; v++) {
    const longe = v * BALANCO_VEZ_MS + horaDaFolha(d, v, 3) + 5;
    const perto = v * BALANCO_VEZ_MS + horaDaFolha(d, v, 1) + 5;
    eventos.push([longe + 100, ANA, longe]);
    eventos.push([perto + 150, BIA, perto]);
    // e pula de novo, depois: não conta
    eventos.push([perto + 400 + 150, BIA, perto + 400]);
  }
  for (const [chega, quem, t] of eventos.sort((x, y) => x[0] - y[0])) {
    r.em(chega);
    r.rodada.acao(quem, { tipo: 'acerto', t });
  }
  r.em(BALANCO_VEZES * BALANCO_VEZ_MS);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, 9);
  assert.equal(r.linhaDe(BIA).valor, BALANCO_VEZES * pulo(d, 0, horaDaFolha(d, 0, 1) + 5).valor);
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('balanço: o pulo perfeito mandado depois da hora não vale, nem o de depois que o balanço parou', () => {
  const r = rodadaDeTeste('balanco', { aleatorio: sorteioFixo(2) });
  const d = r.rodada.publico(ANA).dados as DadosBalanco;
  const longe = horaDaFolha(d, 0, 3);
  r.em(longe + 1500);
  r.rodada.acao(ANA, { tipo: 'acerto', t: longe });
  r.em(BALANCO_GIRO_MS + 300 + 100);
  r.rodada.acao(ANA, { tipo: 'acerto', t: BALANCO_GIRO_MS + 300 });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('balanço: o robô não pula numa vez que ainda não começou', () => {
  const d = rodadaDeTeste('balanco').rodada.publico(ANA).dados;
  for (let k = 0; k < 50; k++) {
    assert.equal(resultadoDoRobo('balanco', d, Math.random, 1000).motivo, 'errou');
    assert.ok((resultadoDoRobo('balanco', d, Math.random, BALANCO_VEZ_MS + 1000).valor ?? 0) <= 3);
  }
});
