/**
 * O catálogo das insígnias (19/11/2026): toda insígnia que o servidor sabe dar tem arte, nome e a frase de como se ganha
 * no app, e a arte do fliperama (pixel art por código) é uma grade 16 × 16 só com as cores da paleta.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ARTE_DO_FLIPERAMA, _GRADES } from '../src/arteDoFliperama';

const doServidor = readFileSync(new URL('../../server/src/guardaRoupa.ts', import.meta.url), 'utf8');
const doApp = readFileSync(new URL('../src/insignias.ts', import.meta.url), 'utf8');

test('toda insígnia do servidor está no catálogo do app, com a frase de como se ganha', () => {
  const codigos = [...doServidor.matchAll(/codigo: '([^']+)', tipo: 'insignia'/g)].map((m) => m[1]);
  assert.ok(codigos.includes('fliperama-5') && codigos.includes('fliperama-15') && codigos.includes('fliperama-30'));
  for (const codigo of codigos) {
    const ini = doApp.indexOf(`'${codigo}': {`);
    assert.ok(ini >= 0, `o app conhece ${codigo}`);
    const bloco = doApp.slice(ini, doApp.indexOf('\n  },', ini));
    assert.match(bloco, /comoSeGanha: chave\('/, `${codigo} diz como se ganha`);
    // sem contagem nem prazo na frase: a regra das conquistas
    assert.doesNotMatch(bloco, /faltam|ainda faltam|até o dia|antes que acabe/i);
  }
});

test('a arte do fliperama é pixel art 16 × 16, só com as cores da paleta', () => {
  for (const [nome, grade] of Object.entries({ CONTROLE: _GRADES.CONTROLE, ALAVANCA: _GRADES.ALAVANCA, GABINETE: _GRADES.GABINETE })) {
    assert.equal(grade.length, 16, `${nome}: 16 linhas`);
    grade.forEach((linha, y) => {
      assert.equal([...linha].length, 16, `${nome}, linha ${y}: 16 colunas`);
      for (const letra of linha) assert.ok(letra === '.' || letra in _GRADES.CORES, `${nome}, linha ${y}: letra "${letra}" fora da paleta`);
    });
  }
  for (const url of Object.values(ARTE_DO_FLIPERAMA)) assert.ok(url.startsWith('data:image/svg+xml,'));
});
