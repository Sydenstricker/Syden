/**
 * O REGISTRO DOS MICROJOGOS DA FESTA (festa/registro.ts): todo microjogo cumpre o contrato, e o site tem a tela de cada um.
 * Microjogo novo passa por aqui sem mexer neste arquivo.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import * as registro from '../src/festa/registro.js';
import { MICROJOGOS, resultadoDoRobo } from '../src/festa/rodada.js';

const ids = (texto: string) => [...texto.matchAll(/^export \{ default as (\w+) \} from '\.\/(\w+)(?:\.js)?';$/gm)].map((m) => [m[1], m[2]]);

test('cada microjogo tem o id do nome dele, e o site registra os mesmos', () => {
  for (const [nome, m] of Object.entries(registro)) assert.equal(m.id, nome, `o export ${nome} tem o id ${m.id}`);
  assert.ok(MICROJOGOS.every((id) => /^[a-z0-9]+$/.test(id)));
  // o registro e os lotes (export * from './loteN'), dos dois lados
  const lerTudo = (pasta: string) =>
    ['registro', 1, 2, 3, 4, 5, 6]
      .map((n) => (n === 'registro' ? 'registro.ts' : `lote${n}.ts`))
      .map((arq) => readFileSync(new URL(pasta + arq, import.meta.url), 'utf8'))
      .join('\n');
  const doServidor = ids(lerTudo('../src/festa/'));
  const doSite = ids(lerTudo('../../web/src/festa/'));
  for (const [nome, arquivo] of [...doServidor, ...doSite]) assert.equal(nome, arquivo, `${nome} mora em ${nome}.ts(x)`);
  assert.deepEqual(doSite.map(([n]) => n).sort(), doServidor.map(([n]) => n).sort(), 'os dois registros têm os mesmos microjogos');
  assert.deepEqual([...MICROJOGOS].sort(), doServidor.map(([n]) => n).sort());
});

test('cada microjogo: o sorteio é repetível, a duração cabe numa rodada, e o robô dá um resultado de verdade', () => {
  for (const id of MICROJOGOS) {
    const m = registro[id as keyof typeof registro];
    const a = JSON.stringify(m.gerar(sorteioFixo(42)));
    assert.equal(JSON.stringify(m.gerar(sorteioFixo(42))), a, `${id}: o mesmo sorteio dá os mesmos dados`);
    for (let s = 1; s <= 20; s++) {
      const dados = m.gerar(sorteioFixo(s)) as never;
      const ms = m.duracao(dados);
      assert.ok(Number.isFinite(ms) && ms >= 3_000 && ms <= 60_000, `${id}: dura ${ms} ms`);
      for (const passou of [ms, ms / 3]) {
        const r = resultadoDoRobo(id, dados, sorteioFixo(s * 7), passou);
        assert.ok(r.motivo === null || ['cedo', 'errou', 'invalido'].includes(r.motivo), `${id}: motivo ${r.motivo}`);
        assert.ok(Array.isArray(r.chave) && r.chave.every(Number.isFinite), `${id}: chave ${JSON.stringify(r.chave)}`);
        if (r.motivo === null) assert.ok(r.chave.length > 0 && (r.valor === null || Number.isFinite(r.valor)), `${id}: ${JSON.stringify(r)}`);
      }
    }
  }
});

test('cada microjogo: a rodada anda sozinha até a revelação, sem ninguém responder, e o robô aparece nela', () => {
  for (const id of MICROJOGOS) {
    const r = rodadaDeTeste(id, { rede: new Map([[1, 200]]), robos: [-1], aleatorio: sorteioFixo(3) });
    r.ateRevelar();
    assert.equal(r.rodada.publico(1).fase, 'revelando', id);
    assert.ok(r.linhas().some((l) => l.userId === -1), `${id}: o robô está na revelação`);
    assert.equal(r.linhaDe(1).motivo, 'nada', `${id}: quem não respondeu aparece com zero`);
  }
});
