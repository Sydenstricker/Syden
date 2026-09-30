import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quemMostrar } from '../src/sobreposicao';
import type { VoiceMember } from '../src/types';

// Esta lista vai para uma janela que fica POR CIMA DE TUDO, enquanto a pessoa joga de costas para o
// Syden. Ela não tem como conferir se está certo — então quem confere é isto aqui.

const pessoa = (userId: number, username: string, extra: Partial<VoiceMember> = {}): VoiceMember => ({
  userId,
  username,
  communityId: 1,
  channelId: 10,
  muted: false,
  deafened: false,
  video: false,
  screen: false,
  screenName: null,
  ...extra,
});

const EU = 1;

describe('quem aparece por cima do jogo', () => {
  it('só quem está na MINHA sala', () => {
    // A lista que o site tem é da comunidade inteira. Mostrar gente de outra sala diria que está
    // todo mundo junto quando não está.
    const lista = quemMostrar({
      membros: [pessoa(2, 'Léo'), pessoa(3, 'Rafa', { channelId: 20 })],
      canalAtual: 10,
      eu: EU,
      falando: new Set(),
    });
    assert.deepEqual(lista.map((p) => p.nome), ['Léo']);
  });

  it('EU não apareço', () => {
    const lista = quemMostrar({
      membros: [pessoa(EU, 'Sydenstricker'), pessoa(2, 'Léo')],
      canalAtual: 10,
      eu: EU,
      falando: new Set(),
    });
    assert.deepEqual(lista.map((p) => p.nome), ['Léo']);
  });

  it('sozinho na sala, a janelinha NÃO EXISTE', () => {
    // Uma janela por cima do jogo com o próprio nome dentro atrapalha sem informar nada.
    assert.deepEqual(quemMostrar({ membros: [pessoa(EU, 'Eu')], canalAtual: 10, eu: EU, falando: new Set() }), []);
  });

  it('fora de qualquer chamada, também não', () => {
    assert.deepEqual(
      quemMostrar({ membros: [pessoa(2, 'Léo')], canalAtual: null, eu: EU, falando: new Set() }),
      [],
    );
  });

  it('quem está falando vem primeiro; o resto, em ordem alfabética', () => {
    // Sem uma ordem fixa, a lista se remexeria a cada vez que alguém abrisse a boca — no canto do
    // olho de quem está mirando.
    const lista = quemMostrar({
      membros: [pessoa(2, 'Rafa'), pessoa(3, 'Ana'), pessoa(4, 'Léo')],
      canalAtual: 10,
      eu: EU,
      falando: new Set([4]),
    });
    assert.deepEqual(lista.map((p) => p.nome), ['Léo', 'Ana', 'Rafa']);
  });

  it('calado e surdo aparecem igual: apagados', () => {
    // Nos dois casos a pessoa não vai responder, que é o que quem está jogando precisa saber.
    const lista = quemMostrar({
      membros: [pessoa(2, 'Calado', { muted: true }), pessoa(3, 'Surdo', { deafened: true }), pessoa(4, 'Normal')],
      canalAtual: 10,
      eu: EU,
      falando: new Set(),
    });
    assert.deepEqual(
      lista.map((p) => [p.nome, p.mudo]),
      [
        ['Calado', true],
        ['Normal', false],
        ['Surdo', true],
      ],
    );
  });
});
