/**
 * Os marcos que destravam o selo da comunidade.
 *
 * O ponto de todo este arquivo é UM: **nenhum marco pode cair sozinho**. O selo existe para dizer
 * "este grupo fez alguma coisa junto", e um marco que uma pessoa cumpre com contas falsas diria
 * apenas "alguém teve paciência" — o que é pior do que não ter selo, porque mente para quem vê.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  conferirSelo,
  type FatosDaComunidade,
  MARCOS,
  marcosAlcancados,
  podeUsarSelo,
} from '../src/selos.js';

const nada: FatosDaComunidade = { membros: 0, pessoasQueEscreveram: 0, diasComConversa: 0, segundosDeVoz: 0 };
const fatos = (parcial: Partial<FatosDaComunidade>): FatosDaComunidade => ({ ...nada, ...parcial });

describe('o primeiro marco exige um grupo de verdade', () => {
  it('cinco membros calados NÃO bastam', () => {
    // O caso que se quer barrar: alguém convida gente e ninguém fala. Isso é uma lista, não um grupo.
    assert.equal(podeUsarSelo(fatos({ membros: 5, pessoasQueEscreveram: 1 })), false);
  });

  it('três pessoas conversando, mas comunidade pequena, também não', () => {
    assert.equal(podeUsarSelo(fatos({ membros: 3, pessoasQueEscreveram: 3 })), false);
  });

  it('cinco membros E três pessoas conversando destrava', () => {
    assert.equal(podeUsarSelo(fatos({ membros: 5, pessoasQueEscreveram: 3 })), true);
  });

  it('o progresso é o MENOR dos dois, não a média', () => {
    // Cem membros e ninguém falando tem de mostrar progresso quase zero. Na média daria metade, e
    // meia barra diria "está quase lá" para uma comunidade que não começou.
    const [primeiro] = MARCOS;
    assert.equal(primeiro.progresso(fatos({ membros: 100, pessoasQueEscreveram: 0 })), 0);
    assert.ok(primeiro.progresso(fatos({ membros: 5, pessoasQueEscreveram: 2 })) < 1);
  });
});

describe('os outros marcos', () => {
  it('constância conta DIAS diferentes, não quantidade de mensagem', () => {
    const constancia = MARCOS.find((m) => m.codigo === 'constancia')!;
    // Uma tarde com dez mil mensagens não é constância; dez dias com poucas é.
    assert.equal(constancia.alcancado(fatos({ diasComConversa: 1 })), false);
    assert.equal(constancia.alcancado(fatos({ diasComConversa: 10 })), true);
  });

  it('vozes juntas: cinco horas somadas', () => {
    const vozes = MARCOS.find((m) => m.codigo === 'vozes')!;
    assert.equal(vozes.alcancado(fatos({ segundosDeVoz: 4 * 3600 })), false);
    assert.equal(vozes.alcancado(fatos({ segundosDeVoz: 5 * 3600 })), true);
  });

  it('uma comunidade veterana alcança vários de uma vez', () => {
    const tudo = fatos({ membros: 20, pessoasQueEscreveram: 9, diasComConversa: 40, segundosDeVoz: 30 * 3600 });
    assert.deepEqual(marcosAlcancados(tudo), MARCOS.map((m) => m.codigo));
  });

  it('comunidade recém-criada não alcança nenhum', () => {
    assert.deepEqual(marcosAlcancados(nada), []);
  });

  it('nenhum progresso passa de 1 nem fica negativo — a barra não pode vazar', () => {
    const exagero = fatos({ membros: 9999, pessoasQueEscreveram: 9999, diasComConversa: 9999, segundosDeVoz: 9e9 });
    for (const m of MARCOS) {
      assert.ok(m.progresso(exagero) <= 1, `${m.codigo} passou de 1`);
      assert.ok(m.progresso(nada) >= 0, `${m.codigo} ficou negativo`);
    }
  });
});

describe('o texto do selo', () => {
  const bom = { icone: 'estrela', cor: '#5865f2' };

  it('aceita de 1 a 4 caracteres, com acento e de outros alfabetos', () => {
    for (const texto of ['A', 'ZECA', 'Ação', '日本', 'X1', '#1']) {
      assert.equal(conferirSelo({ ...bom, texto }).ok, true, `recusou "${texto}"`);
    }
  });

  it('recusa mais de 4, vazio, espaço e emoji', () => {
    // O selo fica colado no nome de cada pessoa em cada mensagem: texto maior empurra o nome para
    // fora nas janelas estreitas, e emoji muda de altura conforme o sistema e desalinha a linha.
    for (const texto of ['CINCO', '', '   ', 'A B', '🐰', 'AB🐰']) {
      assert.equal(conferirSelo({ ...bom, texto }).ok, false, `aceitou "${texto}"`);
    }
  });

  it('recusa ícone e cor fora da lista', () => {
    assert.equal(conferirSelo({ texto: 'OK', icone: 'dragao', cor: '#5865f2' }).ok, false);
    assert.equal(conferirSelo({ texto: 'OK', icone: 'estrela', cor: '#000000' }).ok, false);
    // Lista fechada é o que impede o selo de virar espaço de publicidade — e de virar trabalho de
    // moderação, já que ele aparece no chat inteiro do lado do nome das pessoas.
    assert.equal(conferirSelo({ texto: 'OK', icone: 'estrela', cor: 'javascript:alert(1)' }).ok, false);
  });

  it('recusa corpo vazio sem estourar', () => {
    for (const corpo of [null, undefined, {}, 'texto', 42]) {
      assert.equal(conferirSelo(corpo).ok, false);
    }
  });

  it('devolve o texto já sem espaços em volta', () => {
    const r = conferirSelo({ ...bom, texto: '  ZC ' });
    assert.equal(r.ok && r.selo.texto, 'ZC');
  });
});
