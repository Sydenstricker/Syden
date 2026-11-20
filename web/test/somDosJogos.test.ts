import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { EFEITOS } from '../src/somDosJogos';
import { AMOSTRAS, arquivosDoEfeito } from '../src/sonsDosJogosAmostras';

/**
 * As amostras dos efeitos dos mini-games: todo efeito tem gravação ou é dos que ficam sintetizados (de propósito, e só esses),
 * todo arquivo que a tabela pede existe em web/public/sons/, nenhum arquivo lá sobra, e cada pacote usado tem a licença ao lado.
 */

const PUBLICO = join(import.meta.dirname, '..', 'public');
const SONS = join(PUBLICO, 'sons');
/** Os que nenhum pacote da Kenney cobre bem: continuam sintetizados (somDosJogos.ts). */
const SO_SINTETIZADOS = ['agua', 'derrapa', 'serra', 'chiado', 'torcida'];

test('todo efeito tem amostra, menos os que ficam sintetizados de propósito', () => {
  const sem = EFEITOS.filter((e) => !AMOSTRAS[e]);
  assert.deepEqual([...sem].sort(), [...SO_SINTETIZADOS].sort());
  for (const chave of Object.keys(AMOSTRAS)) assert.ok((EFEITOS as readonly string[]).includes(chave), `${chave} não é um efeito`);
});

test('todo arquivo da tabela existe, é curto e nenhum sobra na pasta', () => {
  const pedidos = new Set<string>();
  for (const e of EFEITOS) {
    const a = AMOSTRAS[e];
    if (a) {
      assert.ok(a.n >= 1 && a.vol > 0 && a.vol <= 2, `${e}: n ou vol fora do esperado`);
    }
    for (const arq of arquivosDoEfeito(e)) {
      const caminho = join(PUBLICO, arq);
      assert.ok(existsSync(caminho), `falta ${arq} (rodar web/scripts/sons-dos-jogos.mjs)`);
      assert.ok(statSync(caminho).size < 40_000, `${arq} grande demais`);
      pedidos.add(arq.replace(/^sons\//, ''));
    }
  }
  const oggs = readdirSync(SONS).filter((f) => f.endsWith('.ogg'));
  assert.deepEqual(oggs.filter((f) => !pedidos.has(f)), [], 'arquivo sem uso em web/public/sons');
});

test('cada pacote tem a licença CC0 ao lado e a lista das fontes cobre cada arquivo', async () => {
  const { readFileSync } = await import('node:fs');
  const licencas = readdirSync(SONS).filter((f) => f.startsWith('LICENCA-Kenney-'));
  assert.ok(licencas.length > 0);
  for (const l of licencas) assert.match(readFileSync(join(SONS, l), 'utf8'), /CC0/);
  const fontes = readFileSync(join(SONS, 'FONTES.txt'), 'utf8');
  for (const f of readdirSync(SONS).filter((x) => x.endsWith('.ogg'))) assert.ok(fontes.includes(f), `${f} sem fonte`);
});
