import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buscarSons, normalizar } from '../src/buscaDeSons';

// A busca do soundboard. O relato que a fez existir: "só aparece um som; o correto é aparecer a lista
// sequencial de sons prováveis". Cada caso abaixo é um jeito real de digitar rápido numa chamada.

const sons = [
  { id: 1, name: 'Por favor, me ajuda', packName: null },
  { id: 2, name: 'Música de suspense', packName: 'Memes' },
  { id: 3, name: 'Ajudante do Papai Noel', packName: null },
  { id: 4, name: 'Risada', packName: 'Memes' },
  { id: 5, name: 'Aplausos', packName: 'Futebol' },
  { id: 6, name: 'Ai que delícia', packName: null },
];
const nomes = (busca: string) => buscarSons(sons, busca).map((s) => s.name);

describe('a busca do soundboard', () => {
  it('ignora acento e maiúscula', () => {
    assert.equal(normalizar('Música, Já!'), 'musica ja');
    assert.deepEqual(nomes('musica'), ['Música de suspense']);
  });

  it('acha com as palavras fora de ordem', () => {
    assert.equal(nomes('ajuda me')[0], 'Por favor, me ajuda');
  });

  it('perdoa um erro de digitação', () => {
    assert.equal(nomes('ajdua')[0], 'Por favor, me ajuda', 'letras trocadas');
    assert.equal(nomes('aplauso')[0], 'Aplausos', 'letra faltando');
  });

  it('traz uma LISTA de prováveis, na ordem: palavra inteira antes de começo de palavra', () => {
    // "ajuda" é palavra inteira em "me ajuda" e começo de "Ajudante": os dois aparecem, nessa ordem.
    assert.deepEqual(nomes('ajuda'), ['Por favor, me ajuda', 'Ajudante do Papai Noel']);
  });

  it('o nome do pacote conta, mas menos que o nome do som', () => {
    const lista = nomes('meme');
    assert.deepEqual(new Set(lista), new Set(['Música de suspense', 'Risada']));
  });

  it('palavra curta não casa por erro de digitação: "ai" não traz meio soundboard', () => {
    assert.deepEqual(nomes('ai'), ['Ai que delícia']);
  });

  it('o que não casa com nada não aparece', () => {
    assert.deepEqual(nomes('xyzw'), []);
    assert.deepEqual(nomes('   '), []);
  });
});

describe('o que você mais toca desempata', () => {
  const parecidos = [
    { id: 1, name: 'Risada alta', packName: null },
    { id: 2, name: 'Risada baixa', packName: null },
  ];
  it('sem histórico, empate vai pelo nome', () => {
    assert.deepEqual(buscarSons(parecidos, 'risada').map((s) => s.id), [1, 2]);
  });
  it('o que você toca mais vem antes, entre os parecidos', () => {
    assert.deepEqual(buscarSons(parecidos, 'risada', { 2: 5 }).map((s) => s.id), [2, 1]);
  });
  it('mas o hábito não passa por cima do que foi digitado', () => {
    // "alta" é palavra inteira só no 1; tocar o 2 mil vezes não o põe na frente.
    assert.deepEqual(buscarSons(parecidos, 'risada alta', { 2: 1000 }).map((s) => s.id), [1, 2]);
  });
});
