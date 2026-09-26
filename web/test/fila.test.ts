import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filaUltimaVale } from '../src/fila.js';

const espera = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

describe('fila de uma tarefa por vez', () => {
  it('nunca deixa duas tarefas correndo juntas', async () => {
    // É este o defeito que a fila existe para impedir: duas trocas de efeito ao mesmo tempo desmontam
    // o caminho do microfone uma da outra e deixam a pessoa muda para os outros.
    const enfileirar = filaUltimaVale();
    let correndo = 0;
    let piorSobreposicao = 0;

    const tarefa = async () => {
      correndo += 1;
      piorSobreposicao = Math.max(piorSobreposicao, correndo);
      await espera(20);
      correndo -= 1;
    };

    await Promise.all([enfileirar(tarefa), enfileirar(tarefa), enfileirar(tarefa)]);
    assert.equal(piorSobreposicao, 1);
  });

  it('das que se acumulam, só a última roda', async () => {
    const enfileirar = filaUltimaVale();
    const rodaram: string[] = [];
    const tarefa = (nome: string) => async () => {
      rodaram.push(nome);
      await espera(10);
    };

    // Cinco escolhas rápidas, como quem experimenta um efeito atrás do outro.
    const tudo = ['a', 'b', 'c', 'd', 'e'].map((nome) => enfileirar(tarefa(nome)));
    await Promise.all(tudo);

    // Nenhuma chegou a começar antes de as cinco entrarem na fila, então só a última roda — que é
    // exatamente o que se quer: montar e desmontar o caminho do microfone cinco vezes não serve a ninguém.
    assert.deepEqual(rodaram, ['e']);
  });

  it('uma tarefa que falha não trava a fila', async () => {
    const enfileirar = filaUltimaVale();
    const rodaram: string[] = [];

    const quebrada = enfileirar(async () => {
      rodaram.push('quebrada');
      throw new Error('falhou');
    });
    await assert.rejects(quebrada);

    await enfileirar(async () => {
      rodaram.push('depois');
    });
    assert.deepEqual(rodaram, ['quebrada', 'depois'], 'a fila tem que seguir andando');
  });

  it('em sequência, sem pressa, todas rodam', async () => {
    const enfileirar = filaUltimaVale();
    const rodaram: number[] = [];
    for (const n of [1, 2, 3]) await enfileirar(async () => void rodaram.push(n));
    assert.deepEqual(rodaram, [1, 2, 3]);
  });
});
