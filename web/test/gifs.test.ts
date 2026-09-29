import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gifDaMensagem } from '../src/gifs';

// Esta regra decide o que o Syden vai BUSCAR sozinho do navegador de cada pessoa que abrir a conversa.
// Errar para o lado frouxo não deixa a tela feia: entrega o endereço de rede de quem só estava lendo
// a quem colou o link. Por isso a lista de endereços é fechada, e por isso ela tem teste.

describe('o que vira GIF na conversa', () => {
  it('um endereço do GIPHY, sozinho, vira imagem', () => {
    const url = 'https://media3.giphy.com/media/abc123/giphy.gif';
    assert.equal(gifDaMensagem(url), url);
  });

  it('com espaço em volta também, porque é o que acontece ao colar', () => {
    assert.equal(gifDaMensagem('  https://media.giphy.com/media/abc/giphy.webp \n'), 'https://media.giphy.com/media/abc/giphy.webp');
  });

  it('NÃO vira imagem endereço de fora do GIPHY, mesmo acabando em .gif', () => {
    // O caso que importa: um servidor qualquer registra quem baixou, e todo mundo que abriu a conversa
    // baixaria. Continua aparecendo como link, clicável, que é escolha de quem clica.
    for (const url of [
      'https://exemplo.ruim/coisa.gif',
      'https://media.giphy.com.ruim.test/a/giphy.gif',
      'https://giphy.com.atacante.test/x.gif',
      'http://media.giphy.com/media/abc/giphy.gif',
    ]) {
      assert.equal(gifDaMensagem(url), null, url);
    }
  });

  it('NÃO vira imagem endereço no meio de uma frase', () => {
    // Quem escreveu um texto mandou um texto. Trocar o meio da frase por uma figura embaralha o recado.
    assert.equal(gifDaMensagem('olha isso https://media.giphy.com/media/abc/giphy.gif e me diz'), null);
  });

  it('NÃO vira imagem endereço do GIPHY que não é figura', () => {
    // A página do GIF é uma página: abrir é ir até lá, e isso é um link.
    assert.equal(gifDaMensagem('https://giphy.com/gifs/abc123'), null);
    assert.equal(gifDaMensagem('https://media.giphy.com/media/abc/algo.html'), null);
  });

  it('texto comum continua texto', () => {
    assert.equal(gifDaMensagem('bom dia'), null);
    assert.equal(gifDaMensagem(''), null);
  });
});

describe('as duas listas de endereços do GIPHY', () => {
  it('a da CSP e a do que vira figura são a mesma', async () => {
    // A política é DADO, e importá-la não executa nada — foi para isso que ela ganhou arquivo próprio.
    const { CSP } = (await import('../../e2e/politica-de-seguranca.mjs')) as { CSP: string };
    const imgSrc = CSP.split('; ').find((linha) => linha.startsWith('img-src'));
    assert.ok(imgSrc, 'a política não tem img-src');

    const naPolitica = imgSrc.split(/\s+/).filter((parte) => parte.includes('giphy.com'));
    assert.ok(naPolitica.length >= 6, 'a política mal lista o GIPHY: ' + JSON.stringify(naPolitica));

    // Todo endereço liberado na política precisa virar figura, senão se libera o que nunca é usado.
    for (const origem of naPolitica) {
      const url = `${origem}/media/abc123/giphy.gif`;
      assert.equal(gifDaMensagem(url), url, `a política libera ${origem}, mas a conversa não o mostra`);
    }

    // E o contrário: nada que a conversa mostre pode faltar na política, senão o navegador bloqueia a
    // figura em silêncio e sobra um quadrado vazio.
    for (const inventado of ['https://media5.giphy.com', 'https://media99.giphy.com', 'https://cdn.giphy.com']) {
      assert.equal(
        gifDaMensagem(`${inventado}/media/abc/giphy.gif`),
        null,
        `${inventado} viraria figura e a política não o libera: quadrado vazio na conversa`,
      );
    }
  });
});
