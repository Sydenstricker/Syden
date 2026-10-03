import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FONTES_DA_COMUNIDADE, pilhaDaFonte } from '../src/fontesDaComunidade.js';

// ===================================================================================================
// A LETRA DO NOME DA COMUNIDADE.
//
// A regra que este arquivo guarda é uma só, e ela não é de gosto: NENHUMA DESTAS FONTES É BAIXADA.
//
// O caminho fácil seria o Google Fonts, e o Syden até o usa — mas só para a Noto, e só quando a
// PESSOA escolhe um idioma de escrita não latina: escolha dela, sobre o aparelho dela. Uma fonte de
// comunidade inverteria isso: quem administra escolhe, e o navegador de TODO MUNDO vai buscar o
// arquivo. Gente que hoje nunca encosta no Google passaria a encostar por decisão de outra pessoa.
//
// E há o lado que quebraria calado: fonte decorativa costuma ter só o alfabeto latino. O nome de uma
// comunidade grega, tailandesa ou árabe viraria quadradinho PARA TODO MUNDO, porque o nome é o mesmo
// para todos — escrito uma vez por quem criou, não traduzido por leitor.
// ===================================================================================================

describe('as letras da comunidade', () => {
  it('nenhuma baixa fonte: sem url(), sem @import, sem endereço', () => {
    for (const { id, pilha } of FONTES_DA_COMUNIDADE) {
      assert.ok(!/url\(|@import|https?:/i.test(pilha), `${id} parece buscar uma fonte de fora`);
    }
  });

  // Pilha que termina num nome próprio deixa o navegador sem saída quando nenhuma das famílias
  // existe — e aí quem decide é o padrão do elemento, que pode não ser nada parecido. Terminar numa
  // família genérica é o que garante um resultado previsível em qualquer sistema.
  it('toda pilha termina numa família genérica', () => {
    const GENERICAS = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
    for (const { id, pilha } of FONTES_DA_COMUNIDADE) {
      if (!pilha) continue; // a padrão não tem pilha: ela é a ausência de escolha
      const ultima = pilha.split(',').pop()!.trim();
      assert.ok(GENERICAS.includes(ultima), `${id} termina em "${ultima}", que não é família genérica`);
    }
  });

  it('a padrão é a ausência de escolha, e não uma pilha', () => {
    assert.equal(FONTES_DA_COMUNIDADE[0].id, 'padrao');
    assert.equal(pilhaDaFonte('padrao'), '');
    assert.equal(pilhaDaFonte(null), '');
    assert.equal(pilhaDaFonte(undefined), '');
  });

  // O servidor pode ser mais novo que o site que a pessoa tem aberto. Código que este site não
  // conhece tem de cair na letra de sempre, nunca virar um font-family inventado.
  it('código desconhecido cai na padrão', () => {
    assert.equal(pilhaDaFonte('gotica-futurista'), '');
    assert.equal(pilhaDaFonte(''), '');
  });

  it('as conhecidas devolvem a pilha', () => {
    assert.match(pilhaDaFonte('serifa'), /serif$/);
    assert.match(pilhaDaFonte('mono'), /monospace$/);
  });

  it('nenhum id repetido', () => {
    const ids = FONTES_DA_COMUNIDADE.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
