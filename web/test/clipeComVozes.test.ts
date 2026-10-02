import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// ===================================================================================================
// O DEFEITO ERA UMA DEPENDÊNCIA QUE FALTAVA, E ELE NÃO APARECE EM TESTE DE COMPORTAMENTO.
//
// A caixinha "Juntar as vozes da sala" só existe quando o clipe tem a segunda trilha. Ela nunca
// existiu, e a causa era de uma linha: a gravação em rolagem lia o fluxo de vozes de um `ref`, e o
// efeito que a inicia dependia só de `[stream]`.
//
// A ORDEM, QUE É O PONTO: quando a transmissão aparece, `stream` deixa de ser nulo e o efeito roda.
// No mesmo instante, o gancho das vozes ainda está criando o destino do Web Audio — ele termina
// chamando `setVozes`, que só se torna visível no RENDER SEGUINTE, e um `ref` se atualiza durante o
// render, não durante o efeito. A gravação começava com `null` no lugar das vozes e nunca mais
// recomeçava, porque a dependência não mudava.
//
// POR QUE ESTE TESTE LÊ O ARQUIVO COMO TEXTO em vez de rodar o gancho: não há React nos testes deste
// pacote, e montar um só para isto custaria mais do que o defeito. O que dá para fixar com honestidade
// é a linha exata que estava errada — e ela é curta, estável e fácil de reconhecer.
//
// Se um dia o React entrar nos testes, este arquivo deve sair e dar lugar à medição de verdade.
// ===================================================================================================

const fonte = readFileSync(new URL('../src/ClipButton.tsx', import.meta.url), 'utf8');

describe('a gravação em rolagem enxerga as vozes da sala', () => {
  it('o efeito depende do fluxo de vozes, e não só da transmissão', () => {
    assert.ok(
      /\}, \[stream, vozes\]\);/.test(fonte),
      'o efeito da gravação em rolagem precisa depender de [stream, vozes].\n' +
        '  Só com `stream`, ele começa antes de o fluxo de vozes existir e a segunda trilha nunca é\n' +
        '  gravada — o sintoma é a caixinha "Juntar as vozes da sala" não aparecer nunca.',
    );
  });

  it('as vozes chegam ao gravador direto, e não por um ref que se atualiza tarde demais', () => {
    assert.ok(
      fonte.includes('gravarEmRolagem(stream, vozes ?? null)'),
      'gravarEmRolagem tem de receber `vozes` direto.',
    );
    assert.ok(
      !fonte.includes('vozesRef'),
      'o ref das vozes voltou: ele se atualiza durante o render, e o efeito roda antes disso.',
    );
  });

  // A caixinha é condicional, e tem de continuar sendo: oferecer "juntar as vozes" quando não há voz
  // nenhuma gravada seria um botão que não faz nada.
  it('a caixinha só aparece quando há vozes gravadas', () => {
    assert.ok(fonte.includes('{vozesDaSala && ('), 'a caixinha das vozes deixou de ser condicional');
  });
});
