/**
 * AS EQUIPES IMPOSTAS nos microjogos que montavam os lados sozinhos (20/11/2026): o Cabo, a Torta, o Revezamento e o
 * Esconde-esconde jogam com o 2 contra 2 e o 1 contra 3 do Tabuleiro da turma (`OpcoesDaRodada.equipes`), robôs inclusive.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import type { VistaCabo } from '../src/festa/cabo.js';
import type { VistaTorta } from '../src/festa/torta.js';
import type { VistaRevezamento } from '../src/festa/revezamento.js';
import type { VistaEsconde } from '../src/festa/esconde.js';
import { JUNTAR_MS } from '../src/festa/lote4-turma.js';
import { MICROJOGOS_1X3, MICROJOGOS_2X2 } from '../src/minijogo-tabuleiro-da-turma.js';
import { microjogoDe } from '../src/festa/rodada.js';

type R = ReturnType<typeof rodadaDeTeste>;
const REDE4 = new Map([[1, 200], [2, 300], [3, 250], [4, 220]]);

function entrar(r: R, quem: number[]) {
  r.em(100);
  for (const q of quem) r.rodada.acao(q, { tipo: 'acerto', entrar: 1 });
}

/** Anda o relógio da rodada passo a passo (os robôs andam nele) e cada pessoa manda o total no ritmo dela, desde `desde`. */
function correr(r: R, ritmos: Map<number, number>, desde = 0, primeiro = [...ritmos.keys()][0] ?? 1) {
  for (let k = 0; k < 400 && r.rodada.publico(primeiro).fase === 'jogando'; k++) {
    r.andar();
    const t = r.agora() - r.largou;
    for (const [q, ritmo] of ritmos) r.rodada.acao(q, { tipo: 'acerto', n: Math.max(0, Math.floor((ritmo * (t - desde)) / 1000)), t });
  }
}

test('as listas do Tabuleiro: cada microjogo tem equipes ou as aceita', () => {
  for (const id of [...MICROJOGOS_2X2, ...MICROJOGOS_1X3]) {
    const m = microjogoDe(id);
    assert.ok(m.equipes || m.aceitaEquipes, id);
  }
});

test('cabo: o lado é a equipe imposta, não a ordem de chegada', () => {
  const r = rodadaDeTeste('cabo', { rede: REDE4, equipes: [[1, 2], [3, 4]] });
  entrar(r, [1, 2, 3, 4]);
  assert.equal((r.rodada.publico(2).dados as VistaCabo).lado, 0, 'pela chegada seria o lado 1');
  assert.equal((r.rodada.publico(3).dados as VistaCabo).lado, 1);
  assert.deepEqual((r.rodada.publico(1).dados as VistaCabo).lados, [2, 2]);
  correr(r, new Map([[1, 8], [2, 7], [3, 3], [4, 3]]));
  r.ateRevelar();
  assert.equal(r.linhaDe(1).posicao, 1);
  assert.equal(r.linhaDe(2).posicao, 1, 'a equipe toda junto');
  assert.equal(r.linhaDe(3).posicao, 2);
});

test('cabo: 1 contra 3 com robôs; pela média, um puxando bem segura três', () => {
  const r = rodadaDeTeste('cabo', { rede: new Map([[1, 200], [2, 300]]), robos: [-1, -2], equipes: [[1], [2, -1, -2]] });
  entrar(r, [1, 2]);
  correr(r, new Map([[1, 8.5], [2, 3]]));
  r.ateRevelar();
  assert.equal(r.linhaDe(1).posicao, 1);
  assert.equal(r.linhaDe(2).posicao, 2);
  const linhas = r.linhas();
  assert.ok(linhas.some((l) => l.userId === -1 && l.posicao === 2), 'o robô tem resultado, e é o do lado dele');
});

test('torta: cada equipe imposta é uma torta do tamanho dela; os robôs comem a deles', () => {
  const r = rodadaDeTeste('torta', { rede: new Map([[1, 200], [2, 300]]), robos: [-1, -2], equipes: [[1, -1], [2, -2]] });
  entrar(r, [1, 2]);
  const v = r.rodada.publico(1).dados as VistaTorta;
  assert.equal(v.minha, 0);
  assert.deepEqual(v.duplas.map((d) => d.tamanho), [2, 2]);
  correr(r, new Map([[1, 10], [2, 3]]));
  r.ateRevelar();
  assert.equal(r.linhaDe(1).posicao, 1);
  assert.equal(r.linhaDe(2).posicao, 2);
  assert.ok(r.linhas().some((l) => l.userId === -1 && l.posicao === 1));
});

test('torta: 1 contra 3, a mesma conta por cabeça', () => {
  const r = rodadaDeTeste('torta', { rede: REDE4, equipes: [[4], [1, 2, 3]] });
  entrar(r, [1, 2, 3, 4]);
  assert.deepEqual((r.rodada.publico(1).dados as VistaTorta).duplas.map((d) => d.tamanho), [1, 3]);
  assert.equal((r.rodada.publico(4).dados as VistaTorta).minha, 0);
  correr(r, new Map([[4, 10], [1, 5], [2, 5], [3, 5]]));
  r.ateRevelar();
  assert.equal(r.linhaDe(4).posicao, 1, 'sozinha a 10 por segundo come 45 antes de três a 5 comerem 135');
  assert.equal(r.linhaDe(2).posicao, 2);
});

test('revezamento: no 1 contra 3, a equipe de um desce sozinha; com robôs revezando, eles remam pelo relógio', () => {
  const r = rodadaDeTeste('revezamento', { rede: new Map([[1, 200]]), robos: [-1, -2, -3], equipes: [[1], [-1, -2, -3]] });
  entrar(r, [1]);
  r.andar(); // os papéis
  const v = r.rodada.publico(1).dados as VistaRevezamento;
  assert.equal(v.papel, 'sozinho');
  assert.equal(v.equipe.tamanho, 3);
  correr(r, new Map([[1, 9]]), JUNTAR_MS);
  r.ateRevelar();
  const fim = r.rodada.publico(1).dados as VistaRevezamento;
  assert.ok(fim.equipe.remadas > 30, 'os robôs passaram o remo');
  assert.equal(r.linhaDe(1).posicao, 1);
  assert.ok(r.linhas().some((l) => l.userId === -2 && l.posicao === 2));
});

test('revezamento: o sozinho é a equipe de um, seja qual for o sorteio', () => {
  const r = rodadaDeTeste('revezamento', { rede: REDE4, equipes: [[3], [1, 2, 4]] });
  entrar(r, [1, 2, 3, 4]);
  r.andar();
  assert.equal((r.rodada.publico(3).dados as VistaRevezamento).papel, 'sozinho');
  assert.equal((r.rodada.publico(1).dados as VistaRevezamento).papel, 'equipe');
  assert.equal((r.rodada.publico(4).dados as VistaRevezamento).posicao, 2);
});

test('esconde: no 1 contra 3, a lanterna é da equipe de um, e os robôs se escondem', () => {
  const r = rodadaDeTeste('esconde', { rede: new Map([[1, 200], [2, 300]]), robos: [-1, -2], equipes: [[2], [1, -1, -2]] });
  entrar(r, [1, 2]);
  r.andar();
  const v = r.rodada.publico(2).dados as VistaEsconde;
  assert.equal(v.turma[v.eu].busca, true);
  assert.equal(v.turma.length, 4);
  assert.equal((r.rodada.publico(1).dados as VistaEsconde).turma[(r.rodada.publico(1).dados as VistaEsconde).eu].busca, false);
  r.ateRevelar();
  const linhas = r.linhas();
  assert.ok(linhas.some((l) => l.userId === -1), 'o robô tem resultado');
  assert.ok(linhas.find((l) => l.userId === 1)!.equipe === 1);
});

test('sem equipes impostas (a Festa), tudo como sempre: o lado pela chegada', () => {
  const r = rodadaDeTeste('cabo', { rede: REDE4 });
  entrar(r, [1, 2, 3, 4]);
  assert.equal((r.rodada.publico(2).dados as VistaCabo).lado, 1);
});
