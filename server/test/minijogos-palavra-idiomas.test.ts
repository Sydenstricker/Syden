/**
 * A Palavra secreta em outros idiomas (24/11/2026, o lote E da segunda auditoria): inglês e espanhol, com as listas que saem
 * (nossas) conferidas contra o dicionário de cada um, a chave de cada língua (o ñ do espanhol é letra), a escolha na largada
 * e o recorde do Solo à parte por idioma.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Contexto } from '../src/minijogo-motor.js';
import { criarConta, comToken, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');
const { palavra, _teste, chaveDe, valida, idiomaDaPalavra, DICIONARIOS_POR_IDIOMA, IDIOMAS, TAMANHOS } = await import('../src/minijogo-palavra.js');

const ana = await criarConta(app, 'ana-idiomas');
const anaId = (await comToken(app, ana.token)('GET', '/api/me')).json().id as number;

function sala(ids: number[], solo = false) {
  let relogio: (() => void) | null = null;
  let terminou = false;
  const ctx: Contexto = {
    agendar: (_ms, depois) => void (relogio = depois),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => ids,
    nome: (id) => `p${id}`,
    solo,
  };
  return { ctx, disparar: () => relogio?.(), terminou: () => terminou };
}

test('Palavra secreta, idiomas: toda palavra que sai está no dicionário do idioma, sem repetir', () => {
  const letras = { pt: 'a-z', en: 'a-z', es: 'a-zñ', fr: 'a-z', de: 'a-z' } as const;
  for (const idioma of IDIOMAS) {
    for (const n of TAMANHOS) {
      const { sorteio } = DICIONARIOS_POR_IDIOMA[idioma][n];
      assert.ok(sorteio.length >= (n === 5 ? 250 : 100), `${idioma} ${n}: ${sorteio.length}`);
      const chaves = sorteio.map((p) => chaveDe(p, idioma));
      // (o "vovó" e o "vovô" do arquivo de 4 letras dão a mesma chave: a lista do sorteio já sai com uma vez só)
      assert.equal(new Set(chaves).size, chaves.length, `${idioma} ${n}: sem repetidas`);
      for (const [i, k] of chaves.entries()) {
        assert.match(k, new RegExp(`^[${letras[idioma]}]{${n}}$`), `${idioma}: ${sorteio[i]}`);
        assert.ok(valida(k, n, idioma), `${idioma}: ${sorteio[i]} está no dicionário de ${n} letras`);
      }
    }
  }
});

test('Palavra secreta, idiomas: a chave de cada língua', () => {
  assert.equal(chaveDe('Ação', 'pt'), 'acao');
  assert.equal(chaveDe('NIÑO', 'es'), 'niño');
  assert.equal(chaveDe('árbol', 'es'), 'arbol');
  assert.equal(chaveDe('pingüino', 'es'), 'pinguino');
  // o ñ escrito em duas partes (n + til) também é o ñ
  assert.equal(chaveDe('niño', 'es'), 'niño');
  // fora do espanhol, o ñ vira n (e a palavra continua tendo de existir no dicionário)
  assert.equal(chaveDe('niño', 'pt'), 'nino');
  assert.ok(valida('house', 5, 'en') && !valida('house', 5, 'pt') && !valida('house', 5, 'es'));
  assert.ok(valida('niño', 4, 'es') && valida('arbol', 5, 'es'));
  assert.equal(idiomaDaPalavra('en-US'), 'en');
  assert.equal(idiomaDaPalavra('es-419'), 'es');
  assert.equal(idiomaDaPalavra('fr-CA'), 'fr');
  assert.equal(idiomaDaPalavra('de-AT'), 'de');
  assert.equal(idiomaDaPalavra('it'), 'pt');
  // o alemão só com a-z: o trema e o ß viram duas letras
  assert.equal(chaveDe('Bär', 'de'), 'baer');
  assert.equal(chaveDe('Straße', 'de'), 'strasse');
  assert.equal(chaveDe('Käse', 'de'), 'kaese');
  assert.ok(valida('kaese', 5, 'de') && valida('haus', 4, 'de') && !valida('haus', 4, 'pt'));
  assert.ok(valida('katze', 5, 'de') && valida('katzen', 6, 'de'), 'a wortliste traz o plural');
  assert.equal(chaveDe('Garçon', 'fr'), 'garcon');
  assert.equal(chaveDe('forêt', 'fr'), 'foret');
  assert.ok(valida('foret', 5, 'fr') && valida('chien', 5, 'fr') && !valida('chien', 5, 'pt'));
  assert.equal(idiomaDaPalavra(undefined), 'pt');
});

test('Palavra secreta, idiomas: a partida em espanhol confere com o ñ e mostra a grafia', () => {
  _teste.palavras = ['niño', 'baño', 'piña'];
  const s = sala([1, 2]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: { idioma: 'es', letras: 4 } });
  assert.ok(jogo && typeof jogo !== 'string');
  type V = { idioma: string; meu: { texto: string; cores: number[] }[]; acertei: boolean };
  const ver = (id: number) => jogo.publico(id) as V;
  assert.equal(ver(1).idioma, 'es');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'xxxx' }), 'Essa palavra não está na lista.');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'NIÑO' }), null);
  assert.deepEqual(ver(1).meu[0].cores, [2, 2, 2, 2]);
  assert.equal(ver(1).meu[0].texto, 'niño');
  assert.ok(ver(1).acertei);
  // o português, na mesma hora, não aceita a palavra em inglês
  _teste.palavras = ['amor', 'roma', 'mora'];
  const p = sala([1]);
  const pt = palavra.comecar(p.ctx, { naSala: [1], criadaPor: 1, corpo: { letras: 4 } });
  assert.ok(pt && typeof pt !== 'string');
  assert.equal((pt.publico(1) as V).idioma, 'pt');
  assert.equal(pt.acao(1, { tipo: 'chute', texto: 'year' }), 'Essa palavra não está na lista.');
  assert.equal(pt.acao(1, { tipo: 'chute', texto: 'qqqq' }), 'Essa palavra não está na lista.');
  _teste.palavras = null;
});

test('Palavra secreta, idiomas: inglês de fábrica pelo idioma pedido, e o idioma sem dicionário cai no português', () => {
  _teste.palavras = ['house', 'apple', 'tiger'];
  const s = sala([1]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { idioma: 'en-GB' } });
  assert.ok(jogo && typeof jogo !== 'string');
  assert.equal((jogo.publico(1) as { idioma: string }).idioma, 'en');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'mouse' }), null);
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'fazer' }), 'Essa palavra não está na lista.');
  _teste.palavras = null;
  const f = sala([1]);
  const fr = palavra.comecar(f.ctx, { naSala: [1], criadaPor: 1, corpo: { idioma: 'it' } });
  assert.ok(fr && typeof fr !== 'string');
  assert.equal((fr.publico(1) as { idioma: string }).idioma, 'pt');
});

test('Palavra secreta, idiomas: o francês confere sem acento e mostra a grafia', () => {
  _teste.palavras = ['forêt', 'école', 'arbre'];
  const s = sala([1]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { idioma: 'fr' } });
  assert.ok(jogo && typeof jogo !== 'string');
  type V = { idioma: string; meu: { texto: string; cores: number[] }[]; acertei: boolean };
  assert.equal((jogo.publico(1) as V).idioma, 'fr');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'tiger' }), 'Essa palavra não está na lista.');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'FORET' }), null);
  assert.equal((jogo.publico(1) as V).meu[0].texto, 'forêt');
  assert.ok((jogo.publico(1) as V).acertei);
  _teste.palavras = null;
});

test('Palavra secreta: a palavra de duas grafias (vovó, vovô) sai uma vez só e a revelação mostra as duas', () => {
  const { sorteio } = DICIONARIOS_POR_IDIOMA.pt[4];
  assert.equal(sorteio.filter((p) => chaveDe(p) === 'vovo').length, 1);
  _teste.palavras = ['vovô'];
  const s = sala([1], true);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { letras: 4 } });
  assert.ok(jogo && typeof jogo !== 'string');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'vovo' }), null);
  const v = jogo.publico(1) as { palavra: string; palavrasReveladas: string[] };
  assert.equal(v.palavra, 'vovó / vovô');
  assert.deepEqual(v.palavrasReveladas, ['vovó / vovô']);
  _teste.palavras = null;
});

test('Palavra secreta, idiomas: o recorde do Solo é à parte por idioma', async () => {
  _teste.palavras = ['house'];
  const s = sala([anaId], true);
  const jogo = palavra.comecar(s.ctx, { naSala: [anaId], criadaPor: anaId, corpo: { idioma: 'en' } });
  assert.ok(jogo && typeof jogo !== 'string');
  assert.equal(jogo.acao(anaId, { tipo: 'chute', texto: 'house' }), null);
  for (let i = 0; i < 100 && !db.recordeDoSolo(anaId, 'palavra', 'normal~en'); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(db.recordeDoSolo(anaId, 'palavra', 'normal~en')?.valor, 1);
  assert.equal(db.recordeDoSolo(anaId, 'palavra', 'normal'), null, 'o português não ganhou nada');
  _teste.palavras = null;
});

test('Palavra secreta, idiomas: a partida em alemão aceita o Ä do teclado como AE', () => {
  _teste.palavras = ['kaese', 'katze', 'blume'];
  const s = sala([1]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { idioma: 'de' } });
  assert.ok(jogo && typeof jogo !== 'string');
  type V = { idioma: string; meu: { texto: string; cores: number[] }[]; acertei: boolean };
  assert.equal((jogo.publico(1) as V).idioma, 'de');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'Hund' }), 'Escreva uma palavra de 5 letras.');
  // "Käse" tem 4 caracteres, mas a chave KAESE tem 5: vale
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'Käse' }), null);
  assert.equal((jogo.publico(1) as V).meu[0].texto, 'kaese');
  assert.ok((jogo.publico(1) as V).acertei);
  _teste.palavras = null;
});
