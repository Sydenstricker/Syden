import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Freio } from '../src/freio.js';

// O relógio entra como parâmetro em todos os métodos, então dá para testar o tempo passando sem esperar.
const AGORA = 1_700_000_000_000;

describe('freio de tentativas', () => {
  it('deixa passar até o limite e segura a partir dali', () => {
    const freio = new Freio(3, 60_000);
    assert.equal(freio.tentar('ana', AGORA), 0);
    assert.equal(freio.tentar('ana', AGORA), 0);
    assert.equal(freio.tentar('ana', AGORA), 0);
    assert.ok(freio.tentar('ana', AGORA) > 0, 'a quarta tentativa deveria ser segurada');
  });

  it('diz quantos segundos faltam, arredondando para cima', () => {
    const freio = new Freio(1, 60_000);
    freio.tentar('ana', AGORA);
    assert.equal(freio.tentar('ana', AGORA + 30_000), 30);
    assert.equal(freio.tentar('ana', AGORA + 59_500), 1, 'meio segundo ainda é espera, não zero');
  });

  it('libera sozinho quando a janela vence', () => {
    const freio = new Freio(2, 60_000);
    freio.tentar('ana', AGORA);
    freio.tentar('ana', AGORA);
    assert.ok(freio.tentar('ana', AGORA) > 0);
    assert.equal(freio.tentar('ana', AGORA + 60_001), 0, 'passada a janela, começa de novo');
  });

  it('segura cada chave por conta própria', () => {
    const freio = new Freio(1, 60_000);
    freio.tentar('ana', AGORA);
    assert.ok(freio.tentar('ana', AGORA) > 0);
    assert.equal(freio.tentar('bia', AGORA), 0, 'o excesso da Ana não pode travar a Bia');
  });

  it('esquece as tentativas de quem acerta', () => {
    const freio = new Freio(2, 60_000);
    freio.tentar('ana', AGORA);
    freio.tentar('ana', AGORA);
    freio.liberar('ana');
    assert.equal(freio.gastas('ana', AGORA), 0);
    assert.equal(freio.tentar('ana', AGORA), 0);
  });

  it('olhar não gasta tentativa', () => {
    const freio = new Freio(2, 60_000);
    freio.tentar('ana', AGORA);
    assert.equal(freio.bloqueado('ana', AGORA), 0);
    assert.equal(freio.bloqueado('ana', AGORA), 0);
    assert.equal(freio.gastas('ana', AGORA), 1, 'consultar três vezes não pode contar como tentativa');
  });

  it('não cresce sem parar na memória', () => {
    const freio = new Freio(1, 1_000);
    for (let i = 0; i < 6_000; i++) freio.tentar('chave-' + i, AGORA);
    // Uma tentativa depois da janela vencida dispara a faxina dos registros velhos.
    freio.tentar('gatilho', AGORA + 2_000);
    assert.equal(freio.gastas('chave-0', AGORA + 2_000), 0);
  });
});
