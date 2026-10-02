import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initials } from '../src/CommunityIcon.js';
import { grafemas, limiteDoCampo, primeiroEmoji, tamanhoVisivel } from '../src/nomeComEmoji.js';

// ===================================================================================================
// EMOJI NO NOME DA COMUNIDADE.
//
// O defeito que originou este arquivo foi MEDIDO antes de qualquer linha ser escrita: `initials()`
// fazia `nome[0]`, e "🎮 Jogos da firma" devolvia "\ud83cJ" — a primeira METADE do emoji colada num
// jota. Meio caractere não existe em tela nenhuma: o navegador desenha o losango de interrogação.
//
// Não dava erro, não caía teste, e o sintoma só aparecia para quem tivesse posto um emoji no nome.
// O caso está aqui embaixo com o nome exato que o produziu.
// ===================================================================================================

describe('contar caracteres como quem lê os vê', () => {
  it('a bandeira é UM caractere, apesar de ocupar quatro', () => {
    assert.equal('🇧🇷'.length, 4);
    assert.equal(tamanhoVisivel('🇧🇷'), 1);
  });

  it('a família é UM caractere, apesar de ocupar onze', () => {
    assert.equal('👨‍👩‍👧'.length, 8);
    assert.equal(tamanhoVisivel('👨‍👩‍👧'), 1);
  });

  it('o acento não vira caractere a mais', () => {
    assert.equal(tamanhoVisivel('Ação'), 4);
  });

  it('não parte emoji ao meio', () => {
    assert.deepEqual(grafemas('🎮ok'), ['🎮', 'o', 'k']);
  });
});

describe('achar o emoji do nome', () => {
  it('acha no começo', () => assert.equal(primeiroEmoji('🎮 Jogos da firma'), '🎮'));
  it('acha no meio', () => assert.equal(primeiroEmoji('Café ☕ dos Devs'), '☕'));
  it('acha a bandeira inteira, e não meia', () => assert.equal(primeiroEmoji('🇧🇷 Brasil'), '🇧🇷'));

  // A fronteira que importa: escrita NÃO é figura. Se estas passassem por emoji, o ícone de uma
  // comunidade japonesa ou árabe viraria um caractere solto do nome em vez das iniciais.
  it('letra com acento não é emoji', () => assert.equal(primeiroEmoji('Ação é assim'), null));
  it('ideograma não é emoji', () => assert.equal(primeiroEmoji('日本語のサーバー'), null));
  it('letra árabe não é emoji', () => assert.equal(primeiroEmoji('مجتمع عربي'), null));
  it('algarismo não é emoji', () => assert.equal(primeiroEmoji('Sala 1'), null));
});

describe('as iniciais do ícone da comunidade', () => {
  // O caso exato que estava quebrado. Antes: "\ud83cJ".
  it('nome com emoji mostra o emoji, e nunca meio emoji', () => {
    const feito = initials('🎮 Jogos da firma');
    assert.equal(feito, '🎮');
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(feito), `sobrou meio emoji em ${JSON.stringify(feito)}`);
  });

  it('o emoji vale mesmo vindo no meio do nome', () => assert.equal(initials('Café ☕ dos Devs'), '☕'));
  it('bandeira sai inteira', () => assert.equal(initials('🇧🇷 Brasil'), '🇧🇷'));

  // O que já funcionava continua igual: trocar o jeito de contar não podia mudar nome sem emoji.
  it('duas palavras, duas iniciais', () => assert.equal(initials('Time do Valorant'), 'TV'));
  it('uma palavra, duas letras', () => assert.equal(initials('Syden'), 'SY'));
  it('palavra de ligação não vira inicial', () => assert.equal(initials('Casa da Mãe'), 'CM'));
});

describe('o limite do campo', () => {
  // O <input> conta do jeito antigo e não há como pedir outra coisa a ele. Então o atributo é
  // recalculado a cada tecla, de modo que o campo pare no quadragésimo caractere VISÍVEL.
  it('texto sem emoji: o limite é o próprio limite', () => {
    assert.equal(limiteDoCampo('Jogos', 40), 40);
  });

  it('cada bandeira já digitada estica o atributo em três', () => {
    assert.equal(limiteDoCampo('🇧🇷', 40), 4 + 39);
  });

  it('cheio de caracteres visíveis, o campo trava onde está', () => {
    const cheio = '🇧🇷'.repeat(40);
    assert.equal(tamanhoVisivel(cheio), 40);
    assert.equal(limiteDoCampo(cheio, 40), cheio.length);
  });
});
