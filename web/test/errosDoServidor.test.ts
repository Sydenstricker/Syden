import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// ===================================================================================================
// AS MENSAGENS DE ERRO TRADUZIDAS TÊM DE CONTINUAR EXISTINDO NO SERVIDOR, palavra por palavra.
//
// A ligação entre as duas pontas é o TEXTO: o servidor manda "A senha está incorreta.", e é essa
// frase que serve de chave no dicionário. Reescrevê-la no servidor — trocar um ponto, tirar um
// acento — não dá erro em lugar nenhum: a mensagem continua chegando, o `t()` não a reconhece mais e
// devolve o próprio texto. O sintoma é a tela voltar ao português SÓ para quem fala outra língua.
//
// É o mesmo arranjo de web/test/recibo.test.ts, pela mesma razão: o que não é conferido por ninguém
// se separa em silêncio.
//
// Ler como TEXTO, e não importar: qualquer coisa do site que encoste no i18n arrasta `window` para
// dentro do Node.
// ===================================================================================================

const raizDoServidor = new URL('../../server/src/', import.meta.url);

/** Todo o código do servidor junto, que é onde as mensagens moram. */
const servidor = readdirSync(raizDoServidor)
  .filter((nome) => nome.endsWith('.ts'))
  .map((nome) => readFileSync(new URL(nome, raizDoServidor), 'utf8'))
  .join('\n');

/** As frases declaradas em web/src/errosDoServidor.ts, lidas de dentro dos `chave(…)`. */
function declaradas(): string[] {
  const inteiro = readFileSync(new URL('../src/errosDoServidor.ts', import.meta.url), 'utf8');
  // SÓ A PRIMEIRA LISTA. A segunda (ERROS_DO_SITE) são mensagens que o próprio site lança quando a
  // rede falha — procurá-las em server/src daria falha para sempre, e foi assim que elas foram
  // descobertas: este teste as acusou de "não existirem mais no servidor". Nunca estiveram lá.
  const corte = inteiro.indexOf('export const ERROS_DO_SITE');
  const texto = corte < 0 ? inteiro : inteiro.slice(0, corte);
  const CHAVE = new RegExp("chave\\('((?:[^'\\\\]|\\\\.)*)'\\)", 'g');
  return [...texto.matchAll(CHAVE)].map((m) => m[1].replace(/\\'/g, "'"));
}

describe('as mensagens de erro do servidor que já foram traduzidas', () => {
  it('há mensagens declaradas', () => {
    // 18, que são as do servidor; as duas do site moram na outra lista. A marca existe para a lista
    // não ENCOLHER sem ninguém ver: tirar uma frase daqui sem tirar a tradução dos 25 dicionários
    // devolveria as órfãs que este arquivo foi criado para evitar.
    assert.ok(declaradas().length >= 18, 'a lista encolheu — alguém apagou traduções que existiam?');
  });

  it('cada uma ainda existe, palavra por palavra, em server/src', () => {
    const sumidas = declaradas().filter((frase) => !servidor.includes(`'${frase.replace(/'/g, "\\'")}'`));
    assert.deepEqual(
      sumidas,
      [],
      'estas frases foram traduzidas mas não existem mais no servidor:\n  ' +
        sumidas.join('\n  ') +
        '\n  Ou a mensagem foi reescrita (e aí a tradução precisa acompanhar), ou ela sumiu\n' +
        '  (e aí a tradução tem de sair dos 25 dicionários).',
    );
  });

  it('nenhuma repetida', () => {
    const lista = declaradas();
    assert.equal(new Set(lista).size, lista.length, 'há frase declarada duas vezes');
  });
});
