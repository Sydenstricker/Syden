/** Abóboras ladeira abaixo (festa/ladeira.ts): um contra três. Quem a abóbora pega é a conta de ladeira-sim.ts, refeita aqui. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { jogadaHonestaDoLote6 } from './festa-lote6-ajuda.js';
import { aboborasPara, LADEIRA_MS, type VistaLadeira } from '../src/festa/ladeira.js';
import { ERGUIDA_MS, faixaInicial, subir } from '../src/festa/ladeira-sim.js';

const rede = new Map([[1, 200], [2, 300], [3, 250], [4, 220]]);
type R = ReturnType<typeof rodadaAoVivo>;
const vista = (r: R, quem: number) => r.rodada.publico(quem).dados as VistaLadeira;
const ate = (r: R, ms: number) => r.passos(Math.max(0, Math.ceil((ms - r.passou()) / 50)));
const subidaDe = (v: VistaLadeira, id: number, t: number) => subir(v.aboboras, v.trocas[id] ?? [], t, faixaInicial(v.grupo.indexOf(id)), v.grupo.length);

test('ladeira: a conta mora em duas cópias iguais, byte a byte', () => {
  const a = readFileSync(new URL('../src/festa/ladeira-sim.ts', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../../web/src/festa/ladeira-sim.ts', import.meta.url), 'utf8');
  assert.equal(a, b);
});

test('ladeira: com 200 a 300 ms de rede, quem desvia sobe, quem fica leva a abóbora, e o grupo ganha junto', () => {
  const r = rodadaAoVivo('ladeira', { rede });
  const { solo, grupo } = vista(r, 1);
  const [ana, bia, caio] = grupo;
  // três abóboras na faixa do meio (a da Ana) e uma na da Bia; a Ana vê cada uma erguida (uns 250 ms depois, na tela dela),
  // troca de faixa, e volta quando ela passou
  const eventos: [number, () => void][] = [];
  for (const [t, faixa] of [[1000, 1], [3000, 0], [5000, 1], [7000, 1]] as const) eventos.push([t - 100, () => r.mandar(solo, { faixa })]);
  for (const [t, faixa] of [[1250, 2], [3600, 1], [5250, 2], [9800, 1]] as const) eventos.push([t + 100, () => r.mandar(ana, { faixa, t })]);
  for (const [t, f] of eventos.sort((a, b) => a[0] - b[0])) {
    ate(r, t);
    f();
  }
  ate(r, LADEIRA_MS - 3000);
  const v = vista(r, 1);
  assert.equal(v.aboboras.length, 4);
  assert.equal(subidaDe(v, ana, LADEIRA_MS).batidas, 0, 'a Ana desviou de todas');
  assert.equal(subidaDe(v, bia, LADEIRA_MS).batidas, 1, 'a Bia, parada, levou a dela');
  assert.equal(subidaDe(v, caio, LADEIRA_MS).batidas, 0);
  ate(r, LADEIRA_MS + 100);
  for (const id of [solo, ...grupo]) r.rodada.acao(id, { tipo: 'resultado' });
  for (const id of grupo) assert.equal(r.linhaDe(id).posicao, 1);
  assert.equal(r.linhaDe(solo).pontos, 0);
});

test('ladeira: a trapaça óbvia não vale', () => {
  const r = rodadaAoVivo('ladeira', { rede: new Map([[1, 200], [2, 300]]) });
  const { solo, grupo } = vista(r, 1);
  const [ana] = grupo;
  ate(r, 2000);
  r.mandar(solo, { faixa: 1 });
  // a troca com o instante de 1,5 s atrás (depois de ver a abóbora passar) não vale; nem a faixa que não existe, nem pular duas
  ate(r, 2000 + ERGUIDA_MS + 2500);
  r.mandar(ana, { faixa: 0, t: 2000 + ERGUIDA_MS + 800 });
  r.mandar(ana, { faixa: 5, t: r.passou() - 50 });
  // o grupo não solta abóbora; o solitário não solta duas encostadas, nem mais do que tem
  r.mandar(ana, { faixa: 1 });
  ate(r, 6000);
  r.mandar(solo, { faixa: 0 });
  r.mandar(solo, { faixa: 2 });
  ate(r, 6500);
  let v = vista(r, 1);
  assert.equal(v.aboboras.length, 2);
  assert.equal(v.trocas[ana], undefined, 'nenhuma troca valeu');
  assert.equal(subidaDe(v, ana, 6000).batidas, 1);
  for (let k = 0; k < 40; k++) {
    ate(r, 6500 + k * 360);
    r.mandar(solo, { faixa: k % 3 });
  }
  v = vista(r, 1);
  assert.equal(v.aboboras.length, aboborasPara(1));
  // o fim mandado cedo não vale
  r.rodada.acao(ana, { tipo: 'resultado' });
  r.ateRevelar();
  assert.equal(r.fase(), 'revelando');
});

test('ladeira: com robôs, o robô faz qualquer papel, desvia e mira, e o resultado de todos bate', () => {
  let robosGanham = 0;
  for (let s = 1; s <= 10; s++) {
    const r = rodadaAoVivo('ladeira', { rede: new Map([[1, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(s) });
    const d = vista(r, 1);
    ate(r, LADEIRA_MS + 100);
    r.rodada.acao(1, { tipo: 'resultado' });
    const v = vista(r, 1);
    if (d.solo !== 1) assert.ok(v.aboboras.length >= 10, `${s}: o robô soltou abóboras (${v.aboboras.length})`);
    const ganhadores = r.linhas().filter((l) => l.posicao === 1).map((l) => l.userId);
    const equipe = ganhadores.includes(d.solo) ? [d.solo] : d.grupo;
    assert.deepEqual(ganhadores.sort(), [...equipe].sort(), `${s}: ganha uma equipe inteira`);
    if (!ganhadores.includes(1)) robosGanham++;
  }
  // quem fica parado (a pessoa, aqui) perde quase sempre
  assert.ok(robosGanham >= 5, `os robôs ganharam ${robosGanham} de 10`);
});

test('ladeira e onda: a jogada honesta do lote ganha de quem não faz nada, nos dois papéis', () => {
  for (const id of ['onda', 'ladeira']) {
    const papeis = new Set<string>();
    for (let s = 1; s <= 16; s++) {
      const r = rodadaDeTeste(id, { aleatorio: sorteioFixo(s) });
      const d = r.rodada.publico(1).dados as { solo: number };
      papeis.add(d.solo === 1 ? 'solo' : 'grupo');
      assert.equal(jogadaHonestaDoLote6(id, r.rodada, 1, { andar: () => r.andar(), avancar: (ms) => r.avancar(ms) }), true);
      r.ateRevelar();
      assert.equal(r.linhaDe(1).posicao, 1, `${id} ${s}: ${JSON.stringify(r.linhas())}`);
      assert.equal(r.linhaDe(2).motivo, 'nada');
    }
    assert.equal(papeis.size, 2, `${id}: os dois papéis`);
  }
  assert.equal(jogadaHonestaDoLote6('praga', { publico: () => ({}), acao: () => null }, 1, { andar() {}, avancar() {} }), false);
});
