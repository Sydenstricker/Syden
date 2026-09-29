import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lugarDaBarra } from '../src/lugarDaBarra';

// A tabela inteira do que ocupa o lugar da barra lateral. Ela existe porque esta regra errou de dois
// jeitos diferentes em dois dias — uma vez dizendo o que não era, outra deixando um buraco que fazia a
// tela saltar —, e os dois foram vistos por quem usa, não por quem escreveu. O porquê de cada caso
// está em web/src/lugarDaBarra.ts.

describe('o que ocupa o lugar da barra lateral', () => {
  it('com a comunidade na tela, é a barra de verdade', () => {
    assert.equal(lugarDaBarra({ comunidadeNaTela: true, listaChegou: true, quantas: 3 }), 'barra');
  });

  it('esperando a LISTA, o espaço fica guardado', () => {
    // Aqui não se sabe nem se existe alguma comunidade. Qualquer afirmação é chute.
    assert.equal(lugarDaBarra({ comunidadeNaTela: false, listaChegou: false, quantas: 0 }), 'esperando');
  });

  it('com a lista na mão e o conteúdo a caminho, o espaço continua guardado', () => {
    // A segunda espera: a comunidade está na lista, mas os canais dela ainda não chegaram.
    assert.equal(lugarDaBarra({ comunidadeNaTela: false, listaChegou: true, quantas: 2 }), 'esperando');
  });

  it('lista chegou e está vazia: aí sim, não há comunidade nenhuma', () => {
    assert.equal(lugarDaBarra({ comunidadeNaTela: false, listaChegou: true, quantas: 0 }), 'sem-comunidades');
  });

  it('NUNCA diz "sem comunidades" enquanto alguma das duas esperas acontece', () => {
    // Foi o primeiro defeito: a frase aparecia por um segundo, logo depois de entrar, e era falsa.
    for (const quantas of [0, 1, 5]) {
      assert.notEqual(
        lugarDaBarra({ comunidadeNaTela: false, listaChegou: false, quantas }),
        'sem-comunidades',
        'antes de a lista chegar não se sabe nada, e chutar aqui é mentir para quem acabou de entrar',
      );
    }
    assert.notEqual(lugarDaBarra({ comunidadeNaTela: false, listaChegou: true, quantas: 1 }), 'sem-comunidades');
  });

  it('NUNCA deixa o espaço sem dono enquanto algo está a caminho', () => {
    // Foi o segundo defeito: sem ninguém ocupando, a barra entrava depois e empurrava a tela inteira.
    // O que importa é que exista SEMPRE uma resposta — a função não tem como devolver "nada", e é
    // justamente isso que este caso protege de alguém acrescentar um `null` amanhã.
    const respostas = [
      lugarDaBarra({ comunidadeNaTela: false, listaChegou: false, quantas: 0 }),
      lugarDaBarra({ comunidadeNaTela: false, listaChegou: true, quantas: 1 }),
    ];
    for (const resposta of respostas) assert.ok(resposta === 'esperando', `ficou "${resposta}"`);
  });
});
