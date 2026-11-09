import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { lerDiagnosticoHost } from '../src/diagnostico-host.js';

let pasta: string;

before(() => {
  pasta = mkdtempSync(join(tmpdir(), 'syden-diagnostico-'));
});
after(() => rmSync(pasta, { recursive: true, force: true }));

describe('diagnóstico do host', () => {
  it('informa quando ainda não existe snapshot', () => {
    assert.deepEqual(lerDiagnosticoHost(join(pasta, 'ausente.log')), { available: false });
  });

  it('lê somente um arquivo regular dentro do limite', () => {
    const caminho = join(pasta, 'diagnostico.log');
    writeFileSync(caminho, 'boot anterior: docker falhou');
    const resultado = lerDiagnosticoHost(caminho);
    assert.equal(resultado.available, true);
    if (resultado.available) {
      assert.equal(resultado.content, 'boot anterior: docker falhou');
      assert.ok(Number.isFinite(Date.parse(resultado.updatedAt)));
    }
  });

  it('recusa snapshots maiores que 512 KiB', () => {
    const caminho = join(pasta, 'grande.log');
    writeFileSync(caminho, Buffer.alloc(512 * 1024 + 1));
    assert.throws(() => lerDiagnosticoHost(caminho), /excede o limite/);
  });

  it('recusa links simbólicos em vez de seguir para fora do diretório de dados', { skip: process.platform === 'win32' }, () => {
    const destino = join(pasta, 'destino.log');
    const link = join(pasta, 'link.log');
    writeFileSync(destino, 'não deve ser seguido');
    symlinkSync(destino, link);
    assert.throws(() => lerDiagnosticoHost(link), /arquivo regular/);
  });
});
