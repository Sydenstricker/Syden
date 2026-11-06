/** Corrida de cavalinho (festa/cavalinho.ts): os passos chegam em lotes, e o servidor refaz a corrida com o fôlego. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { CAVALINHO_MS, correr, LOTE_MS, META } from '../src/festa/cavalinho.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** Passos alternados a cada `intervalo` ms. */
const ritmo = (intervalo: number, ate = CAVALINHO_MS): [number, number][] => {
  const p: [number, number][] = [];
  for (let k = 0; k * intervalo <= ate; k++) p.push([k * intervalo, k % 2]);
  return p;
};

test('cavalinho: no ritmo chega bem; afobado esgota e chega depois (ou não chega); o mesmo lado não anda', () => {
  const noRitmo = correr(ritmo(180));
  assert.ok(noRitmo.chegada !== null && noRitmo.chegada < 13000, `no ritmo: ${noRitmo.chegada}`);
  const afobado = correr(ritmo(60));
  assert.ok(afobado.chegada === null || afobado.chegada > noRitmo.chegada!, 'apertar o mais rápido possível não ganha');
  const devagar = correr(ritmo(400));
  assert.ok(devagar.chegada === null || devagar.chegada > noRitmo.chegada!);
  // só uma tecla: um passo e nada mais
  assert.equal(correr(ritmo(180).map(([t]) => [t, 0] as [number, number])).andou, 1);
});

/** Manda os passos em lotes a cada 250 ms, chegando `rede / 2` depois, como a tela faz. */
function correrNaRodada(r: ReturnType<typeof rodadaDeTeste>, quem: number, passos: [number, number][], rede: number) {
  const lotes: { chega: number; p: [number, number][] }[] = [];
  for (let ini = 0; ini <= CAVALINHO_MS; ini += 250) {
    const p = passos.filter(([t]) => t >= ini && t < ini + 250);
    if (p.length) lotes.push({ chega: ini + 250 + rede / 2, p });
  }
  return lotes.map((l) => ({ ...l, quem }));
}

test('cavalinho: com 200 e 300 ms de rede, quem corre no ritmo ganha de quem se afoba', () => {
  const r = rodadaDeTeste('cavalinho');
  const daAna = ritmo(180);
  const daBia = ritmo(70);
  const lotes = [...correrNaRodada(r, ANA, daAna, 200), ...correrNaRodada(r, BIA, daBia, 300)].sort((a, b) => a.chega - b.chega);
  for (const l of lotes) {
    r.em(l.chega);
    r.rodada.acao(l.quem, { tipo: 'acerto', p: l.p });
  }
  r.em(CAVALINHO_MS + 400);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, correr(daAna).chegada, 'o servidor viu a mesma corrida que a tela');
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('cavalinho: o lote mandado de uma vez no fim, e os passos colados demais, não valem', () => {
  const r = rodadaDeTeste('cavalinho');
  // a Ana, pelo console, manda a corrida perfeita inteira de uma vez, no fim: os instantes já passaram
  r.em(CAVALINHO_MS);
  r.rodada.acao(ANA, { tipo: 'acerto', p: ritmo(180).slice(0, 40) });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.ok((r.rodada.publico(ANA).meu?.valor ?? 0) <= 1 + Math.ceil((LOTE_MS + 500) / 180), 'só os passos recentes contam');
  // a Bia manda passos a cada 10 ms, na hora: só um a cada INTERVALO_MINIMO entra, e o fôlego acaba
  const s = rodadaDeTeste('cavalinho');
  for (let t = 0; t < 6000; t += 100) {
    s.em(t + 100 + 150);
    const lote: [number, number][] = [];
    for (let k = 0; k < 10; k++) lote.push([t + k * 10, k % 2]);
    s.rodada.acao(BIA, { tipo: 'acerto', p: lote });
  }
  s.rodada.acao(BIA, { tipo: 'resultado' });
  assert.ok((s.rodada.publico(BIA).meu?.valor ?? 0) < META);
});

test('cavalinho: o robô não chega antes do tempo que passou', () => {
  const r = rodadaDeTeste('cavalinho');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 50; k++) {
    const rob = resultadoDoRobo('cavalinho', dados, Math.random, 9_000);
    assert.ok((rob.valor ?? 0) < META, 'em 9 s ninguém chega');
    const fim = resultadoDoRobo('cavalinho', dados, Math.random, CAVALINHO_MS);
    assert.ok((fim.valor ?? 0) >= 11_000);
  }
});
