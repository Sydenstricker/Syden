/** O esconde-esconde na horta (festa/esconde.ts): as escolhas são simultâneas e secretas, e quem procura só vê onde olhou depois. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { ESCOLHA_MS, RAPOSA, type VistaEsconde } from '../src/festa/esconde.js';
import { JUNTAR_MS } from '../src/festa/lote4-turma.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

const vista = (r: ReturnType<typeof rodadaDeTeste>, quem: number) => r.rodada.publico(quem).dados as VistaEsconde;

function juntar(quem: number[], semente: number) {
  const rede = new Map(quem.map((q, k) => [q, 200 + k * 50]));
  const r = rodadaDeTeste('esconde', { rede, aleatorio: sorteioFixo(semente) });
  r.em(200);
  for (const q of quem) r.rodada.acao(q, { tipo: 'acerto', entrar: 1 });
  r.em(JUNTAR_MS);
  r.andar();
  return r;
}

test('esconde: com três, um procura e dois se escondem; o que um escolhe não aparece para os outros antes da revelação', () => {
  const r = juntar([ANA, BIA, CAIO], 4);
  const turma = vista(r, ANA).turma;
  assert.equal(turma.filter((p) => p.busca).length, 1);
  const busca = [ANA, BIA, CAIO][turma.findIndex((p) => p.busca)];
  const [e1, e2] = [ANA, BIA, CAIO].filter((q) => q !== busca);
  r.avancar(2000);
  r.rodada.acao(e1, { tipo: 'acerto', r: 0, lugar: 1 });
  r.rodada.acao(e2, { tipo: 'acerto', r: 0, lugar: 3 });
  assert.equal(vista(r, e1).minha, 1);
  assert.equal(vista(r, busca).minha, null);
  assert.equal(vista(r, busca).mostra, null, 'nada revelado ainda');
  // quem procura escolhe no último instante, com a rede atrasada: ainda vale
  r.em(JUNTAR_MS + ESCOLHA_MS + 250);
  r.rodada.acao(busca, { tipo: 'acerto', r: 0, lugar: 1 });
  r.andar();
  const m = vista(r, e2).mostra!;
  assert.equal(m.olhou, 1);
  assert.equal(vista(r, ANA).turma[vista(r, e1).eu].achadoEm, 0, 'achado na primeira');
  // as outras rodadas: o que sobrou fica no lugar 3, e quem procura olha no 0
  for (let k = 0; k < 10 && r.rodada.publico(ANA).fase === 'jogando'; k++) {
    if (vista(r, ANA).etapa === 'escolha') r.rodada.acao(busca, { tipo: 'acerto', r: vista(r, ANA).rodada, lugar: 0 });
    r.andar();
  }
  assert.equal(r.rodada.publico(ANA).fase, 'revelando');
  assert.equal(r.linhaDe(e2).valor, 3);
  assert.equal(r.linhaDe(e2).posicao, 1);
  assert.equal(r.linhaDe(busca).valor, 101, 'achou um');
  assert.equal(r.linhaDe(e1).valor, 0);
});

test('esconde: sozinho, quem procura é a raposa, e o lugar dela só aparece na revelação', () => {
  const r = juntar([ANA], 6);
  const v = vista(r, ANA);
  assert.equal(v.turma.length, 1);
  assert.equal(v.turma[0].busca, false);
  assert.ok(!('raposa' in (r.rodada.publico(ANA).dados as object)));
  r.avancar(1000);
  r.rodada.acao(ANA, { tipo: 'acerto', r: 0, lugar: 2 });
  r.andar();
  assert.equal(typeof vista(r, ANA).mostra!.olhou, 'number');
  assert.equal(RAPOSA, -1);
});

test('esconde: escolha fora da rodada, de quem não está na turma, ou de quem já foi achado, não vale', () => {
  const r = juntar([ANA, BIA], 2);
  const busca = vista(r, ANA).turma[0].busca ? ANA : BIA;
  const outro = busca === ANA ? BIA : ANA;
  r.avancar(500);
  r.rodada.acao(outro, { tipo: 'acerto', r: 1, lugar: 2 });
  r.rodada.acao(outro, { tipo: 'acerto', r: 0, lugar: 9 });
  assert.equal(vista(r, outro).minha, null);
  // quem chega depois de os papéis saírem não entra
  r.rodada.acao(CAIO, { tipo: 'acerto', entrar: 1 });
  assert.equal(vista(r, ANA).turma.length, 2);
  // a escolha que chega depois da folga não vale: fica no lugar sorteado
  r.em(JUNTAR_MS + ESCOLHA_MS + 2000);
  r.rodada.acao(outro, { tipo: 'acerto', r: 0, lugar: 2 });
});
