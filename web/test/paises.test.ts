import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OFICIAL, REGIOES, TODOS_OS_PAISES, cobertosPor, paisesDoIdioma, porRegiao } from '../src/i18n/paises';
import { IDIOMAS, TRADUCOES } from '../src/i18n/idiomas';

// Esta lista aparece na tela como "57 dos 193 países da ONU". É um número que o Syden AFIRMA, e
// número afirmado precisa de quem o confira — senão vira aquele `paises: 57` digitado à mão que
// ninguém nunca releu.

describe('os 193 da ONU', () => {
  it('são exatamente 193', () => {
    assert.equal(TODOS_OS_PAISES.length, 193);
  });

  it('cada região tem a contagem do geoscheme da ONU', () => {
    const esperado = { africa: 54, asia: 47, europa: 43, americas: 35, oceania: 14 };
    for (const r of REGIOES) {
      assert.equal(r.paises.length, esperado[r.id], `${r.nome} deveria ter ${esperado[r.id]}`);
    }
  });

  it('nenhum país repetido, nem dentro nem entre regiões', () => {
    // Repetição inflaria a grade e o número na tela, sem nada ficar visivelmente errado.
    const vistos = new Set<string>();
    for (const pais of TODOS_OS_PAISES) {
      assert.ok(!vistos.has(pais), `${pais} aparece duas vezes`);
      vistos.add(pais);
    }
  });

  it('todo código tem duas letras maiúsculas', () => {
    for (const pais of TODOS_OS_PAISES) assert.match(pais, /^[A-Z]{2}$/, `código estranho: ${pais}`);
  });
});

describe('onde cada idioma é oficial', () => {
  it('só lista países que existem na ONU', () => {
    // Um código errado (ou um território que não é membro) sumiria da grade em silêncio: o país não
    // acenderia, e o total ficaria menor sem ninguém entender por quê.
    const validos = new Set(TODOS_OS_PAISES);
    for (const [idioma, paises] of Object.entries(OFICIAL)) {
      for (const pais of paises) {
        assert.ok(validos.has(pais), `${idioma} lista ${pais}, que não é membro da ONU nesta lista`);
      }
    }
  });

  it('não repete país dentro do mesmo idioma', () => {
    for (const [idioma, paises] of Object.entries(OFICIAL)) {
      assert.equal(new Set(paises).size, paises.length, `${idioma} tem país repetido`);
    }
  });

  it('TODO idioma já traduzido tem a sua lista', () => {
    // A grade é a tela do idioma. Um idioma pronto sem lista mostraria a grade vazia, dizendo que ele
    // não é oficial em lugar nenhum — que é pior do que não mostrar nada.
    for (const codigo of ['pt-BR', ...Object.keys(TRADUCOES)]) {
      assert.ok(paisesDoIdioma(codigo).length > 0, `${codigo} está traduzido e não tem lista de países`);
    }
  });

  it('o número em idiomas.ts bate com o tamanho da lista', () => {
    // Duas fontes para o mesmo fato desandam caladas. Aqui a lista manda, e o número tem de segui-la.
    for (const idioma of IDIOMAS) {
      const lista = paisesDoIdioma(idioma.codigo);
      if (lista.length === 0) continue; // ainda sem lista: o número é estimativa, e serve para ordenar
      assert.equal(
        idioma.paises,
        lista.length,
        `${idioma.codigo}: idiomas.ts diz ${idioma.paises} países, a lista tem ${lista.length}`,
      );
    }
  });
});

describe('a conta que aparece na tela', () => {
  it('soma por UNIÃO, e não somando as listas', () => {
    // Suíça fala alemão, francês e italiano. Somar daria 3; o certo é 1.
    const juntos = cobertosPor(['de', 'fr', 'it']);
    const somados = paisesDoIdioma('de').length + paisesDoIdioma('fr').length + paisesDoIdioma('it').length;
    assert.ok(juntos < somados, 'a união tem de ser menor que a soma, porque há países repetidos');
    assert.ok(new Set([...paisesDoIdioma('de'), ...paisesDoIdioma('fr')]).has('CH'));
  });

  it('nunca passa de 193', () => {
    assert.ok(cobertosPor(Object.keys(OFICIAL)) <= 193);
  });

  it('a grade de um idioma marca exatamente os países dele', () => {
    const marcados = porRegiao('nl').flatMap((r) => [...r.marcados]);
    assert.deepEqual(marcados.sort(), ['BE', 'NL', 'SR'].sort());
  });

  it('idioma sem lista não marca nada, e não quebra', () => {
    for (const r of porRegiao('xx')) assert.equal(r.marcados.size, 0);
  });
});
