/**
 * A correção de HDR da transmissão (web/src/correcaoHdr.ts): a conta, os limites e a CALIBRAÇÃO, gravada aqui com os pares de
 * cor medidos em 27/11/2026 numa transmissão real com o HDR do Windows ligado (a tela de quem jogava e a imagem que chegou).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corrigirPixel, filtroHdrValido, INTENSIDADE_PADRAO, K_MAXIMO, kDaIntensidade } from '../src/correcaoHdr';

type Rgb = [number, number, number];

/** [nome, a cor na tela de quem jogava, a cor que chegou na transmissão] — o HUD do jogo, que é o mesmo nas duas imagens. */
const PARES: [string, Rgb, Rgb][] = [
  ['rosa', [255, 64, 184], [248, 70, 254]],
  ['laranja', [255, 140, 38], [248, 231, 71]],
  ['amarelo', [255, 210, 63], [252, 253, 48]],
  ['quadra', [71, 152, 244], [81, 252, 254]],
];

const distancia = (a: Rgb, b: Rgb) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
const media = (lista: number[]) => lista.reduce((a, b) => a + b, 0) / lista.length;

test('a intensidade vira o ganho: 0 não muda nada, 100% é o máximo, o padrão é o melhor ajuste', () => {
  assert.equal(kDaIntensidade(0), 1);
  assert.equal(kDaIntensidade(1), K_MAXIMO);
  assert.equal(kDaIntensidade(-5), 1);
  assert.equal(kDaIntensidade(9), K_MAXIMO);
  assert.ok(Math.abs(kDaIntensidade(INTENSIDADE_PADRAO) - 1.48) < 0.01);
});

test('com o ganho 1, o pixel não muda', () => {
  for (const rgb of [[0, 0, 0], [10, 200, 90], [255, 255, 255], [128, 128, 128], [81, 252, 254]] as Rgb[]) {
    assert.deepEqual(corrigirPixel(rgb, 1), rgb);
  }
});

test('preto e branco ficam onde estão, em qualquer intensidade', () => {
  for (const k of [1.2, 1.48, 1.8, K_MAXIMO]) {
    assert.deepEqual(corrigirPixel([0, 0, 0], k), [0, 0, 0]);
    assert.deepEqual(corrigirPixel([255, 255, 255], k), [255, 255, 255]);
    // o quase-branco (as nuvens, o texto branco) também
    const nuvem = corrigirPixel([245, 248, 252], k);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(nuvem[c] - [245, 248, 252][c]) <= 6, `a nuvem mudou demais com k = ${k}: ${nuvem}`);
  }
});

test('só escurece: nenhum canal sobe, e a luminância cai nos pixels saturados', () => {
  for (const [, , chegou] of PARES) {
    const c = corrigirPixel(chegou, 1.48);
    for (let i = 0; i < 3; i++) assert.ok(c[i] <= chegou[i], `um canal subiu: ${chegou} -> ${c}`);
    assert.ok(c[0] + c[1] + c[2] < chegou[0] + chegou[1] + chegou[2]);
  }
});

test('cinzas neutros continuam neutros (o filtro não pode tingir)', () => {
  for (const v of [16, 64, 128, 192, 230]) {
    const c = corrigirPixel([v, v, v], 1.48);
    assert.equal(c[0], c[1]);
    assert.equal(c[1], c[2]);
  }
});

test('é monotônico: um canal mais claro nunca sai mais escuro que um mais escuro', () => {
  let anterior = -1;
  for (let v = 0; v <= 255; v++) {
    const c = corrigirPixel([v, 60, 60], 1.48)[0];
    assert.ok(c >= anterior, `o canal voltou atrás em ${v}`);
    anterior = c;
  }
});

test('a calibração: no ganho padrão a cor fica mais perto da tela original do que sem o filtro', () => {
  const sem = PARES.map(([, tela, chegou]) => distancia(chegou, tela));
  const com = PARES.map(([, tela, chegou]) => distancia(corrigirPixel(chegou, kDaIntensidade(INTENSIDADE_PADRAO)), tela));
  // medido: ~53 sem o filtro e ~42 com ele (uns 20% mais perto)
  assert.ok(media(com) < media(sem) * 0.88, `média sem ${media(sem).toFixed(1)}, com ${media(com).toFixed(1)}`);
  // e nenhuma das quatro cores piora de forma relevante
  PARES.forEach(([nome], i) => assert.ok(com[i] <= sem[i] * 1.2, `${nome} piorou: ${sem[i].toFixed(0)} -> ${com[i].toFixed(0)}`));
  // a quadra, o caso que mais se vê (o azul que chegou ciano), é o que mais melhora
  assert.ok(com[3] < sem[3] * 0.8);
});

test('ler as preferências guardadas não confia em nada', () => {
  assert.deepEqual(filtroHdrValido(undefined), { ligado: false, intensidade: INTENSIDADE_PADRAO });
  assert.deepEqual(filtroHdrValido({ ligado: true, intensidade: 0.7 }), { ligado: true, intensidade: 0.7 });
  assert.deepEqual(filtroHdrValido({ ligado: 'sim', intensidade: 'muito' }), { ligado: false, intensidade: INTENSIDADE_PADRAO });
  assert.equal(filtroHdrValido({ ligado: true, intensidade: 5 }).intensidade, 1);
  assert.equal(filtroHdrValido({ ligado: true, intensidade: -1 }).intensidade, 0);
  assert.equal(filtroHdrValido({ ligado: true, intensidade: NaN }).intensidade, INTENSIDADE_PADRAO);
});
