/**
 * O ORÇAMENTO DE PONTOS DO DESENHO (auditoria de 12/11/2026). O limite (PONTOS_POR_DESENHO) só contava a parte NOVA de um
 * traço, mas a parte reenviada era trocada: um programa mandava {t, i} com 1 ponto e depois o mesmo {t, i} com 200, e
 * guardava dezenas de MB por partida, repassadas a todos a cada chute. A conta agora é do que FICA GUARDADO, e apagar ou
 * desfazer devolve o que saiu. O jogo é chamado direto, sem servidor.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PONTOS_POR_DESENHO, desenho } from '../src/minijogo-desenho.js';
import type { Contexto, Jogo } from '../src/minijogo-motor.js';

function partida() {
  const ctx: Contexto = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => {},
    naSala: () => [1, 2],
    nome: (id) => `p${id}`,
  };
  const jogo = desenho.comecar(ctx, { naSala: [1, 2], criadaPor: 1, corpo: {} }) as Jogo;
  const quem = jogo.publico(1).quemDesenha as number;
  const id = (jogo.publico(quem).opcoes as string[])[0];
  assert.equal(jogo.acao(quem, { tipo: 'escolher', id, texto: 'Teste' }), null);
  /** Uma parte de `n` pontos do traço `t`, parte `i`: true se o servidor aceitou. */
  const riscar = (t: number, i: number, n: number) =>
    jogo.tempoReal!(quem, { t, i, c: 0, e: 0, p: Array.from({ length: n * 2 }, (_, k) => k % 1000) }) !== null;
  return { jogo, quem, riscar };
}

test('reenviar a mesma parte troca os pontos dela, e não fura o limite', () => {
  const { riscar } = partida();
  const partes = PONTOS_POR_DESENHO / 200 + 10; // reenviadas com 200 pontos, passam do limite
  for (let i = 0; i < partes; i++) assert.ok(riscar(1, i, 1), 'a parte com 1 ponto entra');
  // O furo: as mesmas partes, reenviadas com 200 pontos. Só cabem as que o limite deixa.
  let aceitas = 0;
  for (let i = 0; i < partes; i++) if (riscar(1, i, 200)) aceitas++;
  assert.ok(aceitas < partes, `o limite segura o reenvio (${aceitas} de ${partes} aceitas)`);
  assert.equal(riscar(2, 0, 200), false, 'cheio, um traço novo não entra');
});

test('desfazer devolve os pontos do traço, e apagar devolve todos', () => {
  const { jogo, quem, riscar } = partida();
  for (let i = 0; i < PONTOS_POR_DESENHO / 200; i++) assert.ok(riscar(1, i, 200));
  assert.equal(riscar(2, 0, 1), false, 'cheio');
  assert.equal(jogo.acao(quem, { tipo: 'desfazer' }), null);
  assert.ok(riscar(3, 0, 200), 'o traço desfeito devolveu os pontos');
  assert.equal(jogo.acao(quem, { tipo: 'limpar' }), null);
  for (let i = 0; i < PONTOS_POR_DESENHO / 200; i++) assert.ok(riscar(4, i, 200), 'apagado, o orçamento é inteiro de novo');
});
