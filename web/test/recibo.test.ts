import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// ===================================================================================================
// A FRASE DO BOT DAS IDEIAS EXISTE EM DOIS ARQUIVOS, E NINGUÉM OS EDITA JUNTO.
//
// O servidor GRAVA a frase dentro da mensagem (server/src/direct-routes.ts); a tela a reconhece para
// poder traduzi-la (web/src/recibo.ts, usada por MessageItem). A ligação entre as duas é o texto ser
// idêntico, letra por letra — e é por isso que ela se parte em silêncio: mexer na do servidor não dá
// erro em lugar nenhum, a mensagem continua chegando, e o único sintoma é a frase voltar ao português
// para quem fala outra língua. Ou seja: o sintoma aparece justamente para quem não vai reclamar em
// português.
//
// OS DOIS LADOS SÃO LIDOS COMO TEXTO, e não importados, pelo mesmo motivo de web/test/loja.test.ts:
// qualquer coisa do site que encoste no i18n arrasta `window` para dentro do Node e o teste morre
// antes de começar.
// ===================================================================================================

const aqui = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), 'utf8');

/** A frase como o SERVIDOR a grava, de dentro do `db.createMessage(…)`. */
function doServidor(): string {
  const achado = /createMessage\(\s*conversa\.id,\s*dono\.id,\s*`([^`]+)`/.exec(aqui('../../server/src/direct-routes.ts'));
  assert.ok(achado, 'não achei a frase do recibo em server/src/direct-routes.ts — ela mudou de forma?');
  return achado[1];
}

/** A frase como a TELA a conhece, de dentro do `chave(…)`. */
function daTela(): string {
  const achado = /export const RECIBO_DA_IDEIA = chave\(\s*'((?:[^'\\]|\\.)*)'/.exec(aqui('../src/recibo.ts'));
  assert.ok(achado, 'não achei RECIBO_DA_IDEIA em web/src/recibo.ts');
  return achado[1].replace(/\\'/g, "'");
}

describe('o recibo automático das ideias', () => {
  it('a frase da tela é exatamente a que o servidor grava', () => {
    assert.equal(
      daTela(),
      doServidor(),
      'a frase do servidor e a da tela se separaram.\n' +
        '  Quem grava a mensagem é o servidor; quem a traduz é a tela, e a ligação é o texto ser igual.\n' +
        '  Separadas, o recibo volta a chegar em português para quem usa o Syden em outra língua.',
    );
  });

  it('a frase é uma chave de tradução de verdade', () => {
    // Sem isto o conserto inteiro não faria NADA e passaria despercebido: `t()` devolve a própria
    // chave quando não conhece o texto, que é exatamente o português de antes.
    const frase = daTela();
    for (const idioma of ['en', 'ja', 'ar']) {
      assert.ok(
        aqui(`../src/i18n/${idioma}.ts`).includes(`'${frase}':`),
        `a frase do recibo não está no dicionário de ${idioma}, então ela nunca vai ser traduzida ali`,
      );
    }
  });
});
