import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { emJogo, lerLinha } = require('../src/jogo.js');

// ===================================================================================================
// QUANDO A JANELINHA DA CHAMADA PODE APARECER POR CIMA DE TUDO.
//
// A primeira versão desta regra media TELA CHEIA, e a aproximação cobrou: "tela cheia prejudica o VS
// Code" — o editor em tela cheia virava jogo e a janelinha aparecia por cima do trabalho.
//
// Quem responde agora é o próprio Windows. A Barra de Jogos mantém, em
// HKCU\System\GameConfigStore\Children, a lista do que ELA reconhece como jogo — a mesma que decide
// se o Win+G aparece. Medida na máquina do Sydenstricker: 75 executáveis, ZERO falsos positivos, e
// 19 deles fora de Steam e Epic (Riot, Blizzard, EA, um Ragnarok solto em F:\).
//
// A regra decide se uma janela sem borda, sempre no topo e atravessável pelo clique aparece na tela
// de alguém. Errar para mais é pôr um retângulo por cima do trabalho da pessoa; errar para menos é
// esconder quem está falando de quem está no meio de uma partida. Nenhum dos dois dá erro em lugar
// nenhum, e os dois só aparecem para quem está longe do Syden.
// ===================================================================================================

const MEU_PID = 4242;

const janela = (nome, dono, conhecido, caminho = `C:\\${nome}.exe`) => ({ nome, dono, conhecido, caminho });

describe('está em jogo?', () => {
  it('jogo que o Windows conhece: aparece', () => {
    assert.equal(emJogo(janela('eldenring', 900, true), MEU_PID), true);
  });

  // O CASO DA RECLAMAÇÃO. Antes, bastava estar em tela cheia; agora não basta nem isso.
  it('o VS Code NÃO conta, nem em tela cheia', () => {
    assert.equal(emJogo(janela('Code', 900, false), MEU_PID), false);
  });

  it('programa que o Windows não reconhece como jogo não conta', () => {
    assert.equal(emJogo(janela('firefox', 900, false), MEU_PID), false);
    assert.equal(emJogo(janela('WINWORD', 900, false), MEU_PID), false);
  });

  // JOGO EM JANELA PASSOU A VALER, e é o ganho que a lista traz de graça: a regra antiga perdia
  // exatamente este caso.
  it('jogo em janela também conta, porque a regra não olha mais o tamanho', () => {
    assert.equal(emJogo(janela('rocketleague', 900, true), MEU_PID), true);
  });

  // As duas guardas que ficam POR CIMA da lista, porque uma lista pode conter o que não deveria.
  it('o próprio Syden não conta, mesmo que entrasse na lista', () => {
    assert.equal(emJogo(janela('Syden', MEU_PID, true), MEU_PID), false);
  });

  it('a área de trabalho não conta, mesmo que entrasse na lista', () => {
    assert.equal(emJogo(janela('explorer', 1200, true), MEU_PID), false);
    assert.equal(emJogo(janela('EXPLORER', 1200, true), MEU_PID), false, 'o nome é comparado sem maiúsculas');
  });

  it('janela nenhuma na frente: não aparece', () => {
    assert.equal(emJogo(null, MEU_PID), false);
  });
});

describe('ler a linha da sonda', () => {
  it('lê os quatro campos', () => {
    assert.deepEqual(lerLinha(['eldenring', '900', '1', 'F:\\Steam\\eldenring.exe'].join('\t')), {
      nome: 'eldenring',
      dono: 900,
      conhecido: true,
      caminho: 'F:\\Steam\\eldenring.exe',
    });
  });

  it('conhecido 0 vira false', () => {
    assert.equal(lerLinha(['Code', '900', '0', 'C:\\Code.exe'].join('\t'))?.conhecido, false);
  });

  // Processo elevado (anticheat) recusa o caminho: ele vem vazio, não casa com a lista, e o lado
  // seguro é não aparecer. O que não pode é a linha virar lixo.
  it('caminho vazio continua sendo uma linha válida, e não é jogo', () => {
    const lida = lerLinha(['algo', '900', '0', ''].join('\t'));
    assert.equal(lida?.caminho, '');
    assert.equal(emJogo(lida, MEU_PID), false);
  });

  // Linha vazia é o que a sonda escreve quando não há janela nenhuma na frente.
  it('linha vazia não vira janela', () => {
    assert.equal(lerLinha(''), null);
    assert.equal(emJogo(lerLinha(''), MEU_PID), false);
  });

  it('linha torta não vira janela', () => {
    assert.equal(lerLinha('jogo\t900'), null);
    assert.equal(lerLinha(['jogo', 'x', '1', 'C:\\a.exe'].join('\t')), null, 'dono que não é número');
    assert.equal(lerLinha(['jogo', '900', '2', 'C:\\a.exe'].join('\t')), null, 'conhecido só pode ser 0 ou 1');
  });

  it('nome com espaço continua inteiro', () => {
    assert.equal(lerLinha(['Rocket League', '900', '1', 'C:\\a.exe'].join('\t'))?.nome, 'Rocket League');
  });
});
