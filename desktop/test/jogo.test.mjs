import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { emJogo, lerLinha } = require('../src/jogo.js');

// ===================================================================================================
// QUANDO A JANELINHA DA CHAMADA PODE APARECER POR CIMA DE TUDO.
//
// Os números deste arquivo NÃO FORAM INVENTADOS: saíram de uma sonda rodada na máquina do
// Sydenstricker, num monitor de 1536x864, antes de a função existir. São eles que justificam cada
// linha da regra, e é por isso que estão aqui com o nome do programa que os produziu.
//
// A regra decide se uma janela sem borda, sempre no topo e atravessável pelo clique aparece na tela
// de alguém. Errar para mais é pôr um retângulo por cima do trabalho da pessoa; errar para menos é
// esconder quem está falando de quem está no meio de uma partida. Nenhum dos dois dá erro em lugar
// nenhum, e os dois só aparecem para quem está longe do Syden.
// ===================================================================================================

const MEU_PID = 4242;

/** O monitor da medição: 1536x864, começando em 0,0. */
const janela = (nome, dono, esq, topo, dir, base) => ({
  nome,
  dono,
  esq,
  topo,
  dir,
  base,
  telaX: 0,
  telaY: 0,
  telaL: 1536,
  telaA: 864,
});

describe('está em jogo?', () => {
  it('jogo em tela cheia: aparece', () => {
    assert.equal(emJogo(janela('eldenring', 900, 0, 0, 1536, 864), MEU_PID), true);
  });

  // MEDIDO: Firefox maximizado devolveu -6,-6 1549x829. É MAIS LARGO que a tela (as bordas de
  // redimensionar são invisíveis e ficam fora dela) e MAIS BAIXO, porque para na barra de tarefas.
  // Se a regra olhasse só a largura, ou a área, trabalhar no navegador contaria como jogar.
  it('janela maximizada NÃO conta, mesmo sendo mais larga que a tela', () => {
    assert.equal(emJogo(janela('firefox', 900, -6, -6, 1543, 823), MEU_PID), false);
  });

  // MEDIDO: a área de trabalho é uma janela Progman, do explorer, em 0,0 1536x864 — a tela inteira.
  // É o caso exato da reclamação: Syden minimizado, pessoa na área de trabalho, janelinha por cima.
  it('a área de trabalho NÃO conta, apesar de cobrir a tela inteira', () => {
    assert.equal(emJogo(janela('explorer', 1200, 0, 0, 1536, 864), MEU_PID), false);
  });

  it('o menu iniciar e a busca também não contam', () => {
    assert.equal(emJogo(janela('StartMenuExperienceHost', 1300, 0, 0, 1536, 864), MEU_PID), false);
    assert.equal(emJogo(janela('SearchHost', 1400, 0, 0, 1536, 864), MEU_PID), false);
  });

  it('o nome é comparado sem diferenciar maiúsculas', () => {
    assert.equal(emJogo(janela('EXPLORER', 1200, 0, 0, 1536, 864), MEU_PID), false);
  });

  // O próprio Syden em tela cheia já mostra a chamada: a janelinha seria a mesma lista duas vezes.
  it('o próprio Syden em tela cheia não conta', () => {
    assert.equal(emJogo(janela('Syden', MEU_PID, 0, 0, 1536, 864), MEU_PID), false);
  });

  it('janela nenhuma na frente: não aparece', () => {
    assert.equal(emJogo(null, MEU_PID), false);
  });

  it('uma janela que cobre quase tudo, menos um lado, não conta', () => {
    assert.equal(emJogo(janela('jogo', 900, 0, 0, 1536, 860), MEU_PID), false);
    assert.equal(emJogo(janela('jogo', 900, 4, 0, 1536, 864), MEU_PID), false);
  });

  // Dois monitores: o jogo em tela cheia no segundo é medido contra o segundo, e não contra o
  // principal. Sem isto, tela cheia no monitor da direita nunca passaria pela regra.
  it('tela cheia no segundo monitor conta, medida contra o segundo monitor', () => {
    const noSegundo = { ...janela('jogo', 900, 1536, 0, 3456, 1080), telaX: 1536, telaY: 0, telaL: 1920, telaA: 1080 };
    assert.equal(emJogo(noSegundo, MEU_PID), true);
  });
});

describe('ler a linha da sonda', () => {
  it('lê os dez campos', () => {
    assert.deepEqual(lerLinha(['eldenring', '900', '0', '0', '1536', '864', '0', '0', '1536', '864'].join('\t')), {
      nome: 'eldenring',
      dono: 900,
      esq: 0,
      topo: 0,
      dir: 1536,
      base: 864,
      telaX: 0,
      telaY: 0,
      telaL: 1536,
      telaA: 864,
    });
  });

  it('aguenta coordenada negativa, que é o caso do maximizado', () => {
    const lida = lerLinha(['firefox', '900', '-6', '-6', '1543', '823', '0', '0', '1536', '864'].join('\t'));
    assert.equal(lida?.esq, -6);
    assert.equal(emJogo(lida, MEU_PID), false);
  });

  // Linha vazia é o que a sonda escreve quando não há janela nenhuma na frente. Ela não pode virar
  // uma janela de zeros, que cobriria uma tela de tamanho zero e passaria pela regra.
  it('linha vazia não vira janela', () => {
    assert.equal(lerLinha(''), null);
    assert.equal(emJogo(lerLinha(''), MEU_PID), false);
  });

  it('linha torta não vira janela', () => {
    assert.equal(lerLinha('jogo\t900\t0'), null);
    assert.equal(lerLinha(['jogo', 'x', '0', '0', '1536', '864', '0', '0', '1536', '864'].join('\t')), null);
  });

  it('nome com espaço continua inteiro', () => {
    assert.equal(
      lerLinha(['Rocket League', '900', '0', '0', '1536', '864', '0', '0', '1536', '864'].join('\t'))?.nome,
      'Rocket League',
    );
  });
});
