/** O cabo de guerra de teclas (festa/cabo.ts) e a torta de cenoura (festa/torta.ts): equipes pela ordem de chegada, totais ao vivo conferidos pelo ritmo. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { CABO_MS, MARCA, type VistaCabo } from '../src/festa/cabo.js';
import { MORDIDAS, TORTA_MS, type VistaTorta } from '../src/festa/torta.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;
const DAVI = 4;

type R = ReturnType<typeof rodadaDeTeste>;

/** Cada um aperta no seu ritmo e manda o total a cada 250 ms; o pedido chega `rede` ms depois. */
function apertar(r: R, quem: [number, number, number][], ate: number) {
  const eventos: [number, number, number, number][] = [];
  for (const [id, porSegundo, rede] of quem) {
    for (let t = 250; t <= ate; t += 250) eventos.push([t + rede, id, Math.floor((t * porSegundo) / 1000), t]);
  }
  eventos.sort((a, b) => a[0] - b[0]);
  for (const [chega, id, n, t] of eventos) {
    if (r.rodada.publico(ANA).fase !== 'jogando') break;
    if (chega > r.agora() - r.largou) r.em(chega);
    r.rodada.acao(id, { tipo: 'acerto', n, t });
  }
}

function entrar(r: R, quem: number[]) {
  r.em(100);
  for (const q of quem) r.rodada.acao(q, { tipo: 'acerto', entrar: 1 });
}

test('cabo: dois lados pela ordem de chegada; quem puxa mais leva a fita até a marca, e o lado todo divide a posição', () => {
  const rede = new Map([[ANA, 200], [BIA, 300], [CAIO, 250], [DAVI, 220]]);
  const r = rodadaDeTeste('cabo', { rede });
  entrar(r, [ANA, BIA, CAIO, DAVI]);
  assert.equal((r.rodada.publico(ANA).dados as VistaCabo).lado, 0);
  assert.equal((r.rodada.publico(BIA).dados as VistaCabo).lado, 1);
  assert.equal((r.rodada.publico(CAIO).dados as VistaCabo).lado, 0);
  apertar(r, [[ANA, 7, 200], [CAIO, 6, 250], [BIA, 4, 300], [DAVI, 3, 220]], CABO_MS);
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(CAIO).posicao, 1, 'o lado todo junto');
  assert.equal(r.linhaDe(BIA).posicao, 3);
  assert.ok(r.agora() - r.largou < CABO_MS, 'a fita chegou à marca antes do fim');
});

test('cabo: um total maior do que o ritmo de gente, ou de quem não entrou, não vale', () => {
  const r = rodadaDeTeste('cabo');
  entrar(r, [ANA]);
  r.em(1000);
  r.rodada.acao(ANA, { tipo: 'acerto', n: MARCA * 3, t: 1000 });
  r.rodada.acao(BIA, { tipo: 'acerto', n: 5, t: 900 });
  assert.equal((r.rodada.publico(ANA).dados as VistaCabo).venceu, null);
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).motivo, 'errou', 'nada contou, e as raposas ganharam');
  assert.equal(r.linhaDe(BIA).motivo, 'nada');
});

test('cabo: sozinho, contra as raposas: quem puxa bem ganha', () => {
  const r = rodadaDeTeste('cabo', { rede: new Map([[ANA, 250]]) });
  entrar(r, [ANA]);
  apertar(r, [[ANA, 7, 250]], CABO_MS);
  r.ateRevelar();
  assert.equal((r.rodada.publico(ANA).dados as VistaCabo).venceu, 0);
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('torta: as duplas pela ordem de chegada; a que acaba primeiro ganha, e as duas pessoas dela empatam', () => {
  const rede = new Map([[ANA, 200], [BIA, 300], [CAIO, 250], [DAVI, 220]]);
  const r = rodadaDeTeste('torta', { rede });
  entrar(r, [ANA, BIA, CAIO, DAVI]);
  assert.equal((r.rodada.publico(BIA).dados as VistaTorta).minha, 0);
  assert.equal((r.rodada.publico(CAIO).dados as VistaTorta).minha, 1);
  apertar(r, [[ANA, 8, 200], [BIA, 7, 300], [CAIO, 5, 250], [DAVI, 4, 220]], TORTA_MS);
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 1);
  assert.equal(r.linhaDe(CAIO).posicao, 3);
  const v = r.rodada.publico(ANA).dados as VistaTorta;
  assert.equal(v.duplas[0].comido, 1);
  assert.ok(v.duplas[1].acabou !== null, 'a segunda também acabou, depois');
});

test('torta: mordidas demais de uma vez não valem', () => {
  const r = rodadaDeTeste('torta');
  entrar(r, [ANA, BIA]);
  r.em(1500);
  r.rodada.acao(ANA, { tipo: 'acerto', n: MORDIDAS * 2, t: 1400 });
  assert.equal((r.rodada.publico(ANA).dados as VistaTorta).mordidas, 0);
  // e um total menor que o anterior não desconta
  r.rodada.acao(ANA, { tipo: 'acerto', n: 10, t: 1450 });
  r.em(2000);
  r.rodada.acao(ANA, { tipo: 'acerto', n: 5, t: 1900 });
  assert.equal((r.rodada.publico(ANA).dados as VistaTorta).mordidas, 10);
});
