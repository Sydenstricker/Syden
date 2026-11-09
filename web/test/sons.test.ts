import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deveTocar, deveTocarLigacao } from '../src/sounds';

// Quem desativa o áudio não pode continuar ouvindo a sala. O defeito era esse, e era parcial: o
// soundboard obedecia e os sons de entrar e sair não — então a pessoa ensurdecia e continuava ouvindo
// gente chegando, sem entender por quê.

test('ensurdecido, o som de outra pessoa não toca', () => {
  assert.equal(deveTocar(true, true, true), false);
});

// O contrário disto é pior do que parece: quem aperta "desativar áudio" e não ouve nada em resposta não
// sabe se o clique pegou — e o som que confirma isso é justamente o que estaria sendo calado.
test('ensurdecido, a resposta ao próprio clique continua tocando', () => {
  assert.equal(deveTocar(true, false, true), true);
});

test('ouvindo normalmente, tudo toca', () => {
  assert.equal(deveTocar(true, true, false), true);
  assert.equal(deveTocar(true, false, false), true);
});

test('avisos desligados nas configurações calam tudo, inclusive o próprio clique', () => {
  for (const dosOutros of [true, false]) {
    for (const surdo of [true, false]) {
      assert.equal(deveTocar(false, dosOutros, surdo), false);
    }
  }
});

// AS LIGAÇÕES (09/11/2026). O toque contava como som "dos outros": quem desligava os sons de aviso, ou ensurdecia, via a
// ligação chegar calada — e ligação que não toca ninguém atende. Agora só a chave dele o cala.
test('o toque de ligação toca com os sons de aviso desligados e ensurdecido', () => {
  for (const sounds of [true, false]) {
    for (const surdo of [true, false]) {
      assert.equal(deveTocarLigacao('toque', { sounds, toqueDeLigacao: true }, surdo), true);
      assert.equal(deveTocarLigacao('toque', { sounds, toqueDeLigacao: false }, surdo), false);
    }
  }
});

// O chamando é o som da chamada em que EU estou: cala como o resto dela.
test('o chamando de quem liga obedece aos sons de aviso e ao "Desativar áudio"', () => {
  assert.equal(deveTocarLigacao('chamando', { sounds: true, toqueDeLigacao: false }, false), true);
  assert.equal(deveTocarLigacao('chamando', { sounds: true, toqueDeLigacao: true }, true), false);
  assert.equal(deveTocarLigacao('chamando', { sounds: false, toqueDeLigacao: true }, false), false);
});
