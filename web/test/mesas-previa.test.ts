import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lancesDoOware, semear, semearOware } from '../../server/src/minijogo-tabuleiro';
import { previaDaSemeadura } from '../src/mancalaPrevia';
import { faltamDo, FORCA_DAS_MANILHAS, FORCA_DOS_VALORES, reguaDaForca } from '../src/contasDasMesas';
import { forca, NAIPES, VALORES } from '../../server/src/minijogo-truco';

/** Um gerador simples com semente, para as partidas sorteadas se repetirem. */
function sorteio(semente: number) {
  let s = semente >>> 0;
  return (n: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % n;
  };
}

const casasDe = (lado: 0 | 1) => (lado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);

for (const variante of ['kalah', 'oware'] as const) {
  test(`a prévia da semeadura bate com o servidor (${variante})`, () => {
    let conferidos = 0;
    let capturas = 0;
    let deNovo = 0;
    for (let partida = 0; partida < 200; partida++) {
      const r = sorteio(partida + 1);
      const sementes = 3 + r(4);
      let casas = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : sementes));
      let lado: 0 | 1 = 0;
      for (let lance = 0; lance < 200; lance++) {
        const opcoes = variante === 'oware' ? lancesDoOware(casas, lado) : casasDe(lado).filter((c) => casas[c] > 0);
        if (!opcoes.length) break;
        const casa = opcoes[r(opcoes.length)];
        const previa = previaDaSemeadura(casas, lado, casa, variante);
        assert.ok(previa);
        const depois = casas.slice();
        const meu = lado === 0 ? 6 : 13;
        const antesNoDeposito = depois[meu];
        const res = variante === 'oware' ? semearOware(depois, lado, casa) : semear(depois, lado, casa);
        if (res.acabou) break;
        // jogar de novo
        assert.equal(previa.deNovo, res.proximo === lado, `de novo, partida ${partida}`);
        // a captura: o que entrou no depósito além das sementes que caíram nele pelo caminho (no Oware, nenhuma)
        let peloCaminho = 0;
        if (variante === 'kalah') {
          const outro = lado === 0 ? 13 : 6;
          let i = casa;
          for (let mao = casas[casa]; mao > 0; ) {
            i = (i + 1) % 14;
            if (i === outro) continue;
            if (i === meu) peloCaminho++;
            mao--;
          }
          assert.equal(previa.ultima, i, `última casa, partida ${partida}`);
        }
        assert.equal(previa.captura, depois[meu] - antesNoDeposito - peloCaminho, `captura, partida ${partida}`);
        if (previa.captura) capturas++;
        if (previa.deNovo) deNovo++;
        conferidos++;
        casas = depois;
        lado = res.proximo;
      }
    }
    assert.ok(conferidos > 1000);
    assert.ok(capturas > 10, 'houve capturas');
    if (variante === 'kalah') assert.ok(deNovo > 10, 'houve lances de jogar de novo');
  });
}

test('a prévia na casa vazia é nada', () => {
  assert.equal(previaDaSemeadura([0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], 0, 0), null);
});

// As outras contas pequenas das mesas (contasDasMesas.ts)

test('a régua do Truco segue a força do servidor', () => {
  assert.deepEqual([...FORCA_DOS_VALORES], [...VALORES]);
  assert.deepEqual([...FORCA_DAS_MANILHAS], [...NAIPES]);
  for (const manilha of VALORES) {
    const { valores, manilhas } = reguaDaForca(manilha);
    const cartas = [...valores.map((v) => `${v}o`), ...manilhas];
    assert.equal(cartas.length, 13);
    for (let k = 1; k < cartas.length; k++) assert.ok(forca(cartas[k], manilha) > forca(cartas[k - 1], manilha), `${cartas[k - 1]} < ${cartas[k]} com manilha ${manilha}`);
  }
});

test('o Sudoku conta quantos faltam de cada número, sem os errados', () => {
  const tabuleiro = Array(81).fill(0);
  for (let k = 0; k < 9; k++) tabuleiro[k * 9] = 5;
  tabuleiro[1] = 3;
  assert.equal(faltamDo(tabuleiro, [], 5), 0);
  assert.equal(faltamDo(tabuleiro, [9], 5), 1);
  assert.equal(faltamDo(tabuleiro, [], 3), 8);
  assert.equal(faltamDo(tabuleiro, [], 7), 9);
});
