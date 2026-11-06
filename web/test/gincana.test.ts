import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sim from '../src/gincana/sim.ts';
import { planejar } from '../src/gincana/piloto.ts';

/** A Gincana da toca: a regra (gincana/sim.ts), que é a mesma do servidor, os percursos e o piloto automático. */

const planos = new Map<string, number[]>();
const plano = (id: string) => {
  if (!planos.has(id)) {
    const p = planejar(sim.PERCURSOS[id]);
    assert.ok(p, `o piloto automático fecha ${id}`);
    planos.set(id, p!);
  }
  return planos.get(id)!;
};
const gravar = (comandos: number[]) => {
  const g = sim.gravador();
  for (const e of comandos) g.anotar(e);
  return g.entradas;
};

test('a regra é o MESMO arquivo no site e no servidor, byte a byte, e sem trigonometria na simulação', () => {
  const site = readFileSync(new URL('../src/gincana/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/gincana-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'mexeu num, copie no outro');
  const codigo = site.toString('utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /Math\.(sin|cos|tan|atan2?|hypot|pow|exp|log)\b|\*\*/);
});

test('a tabela do giro fecha a volta (720 meios graus voltam ao começo)', () => {
  const v: sim.Varredor = { cx: 0, cz: 0, y: 0, braco: 1, giro: 1, fase: 0, bracos: 2, modelo: '' };
  const a = sim.bracoEm(v, 0), q = sim.bracoEm(v, 180), m = sim.bracoEm(v, 360);
  assert.ok(Math.abs(a.dx - 1) < 1e-12 && Math.abs(a.dz) < 1e-12);
  assert.ok(Math.abs(q.dx) < 1e-9 && Math.abs(q.dz - 1) < 1e-9, 'um quarto de volta');
  assert.ok(Math.abs(m.dx + 1) < 1e-9, 'meia volta');
  assert.equal(sim.indiceDoGiro({ ...v, giro: -3 }, 1), 717);
});

test('os percursos: os modelos estão em web/public/gincana, as bandeiras em ordem, e a chegada no fim', () => {
  for (const [id, p] of Object.entries(sim.PERCURSOS)) {
    const modelos = new Set([...p.caixas.map((c) => c.modelo).filter(Boolean), ...p.rampas.map((r) => r.modelo), ...p.varredores.map((v) => v.modelo), ...p.enfeites.map((e) => e.modelo), 'pillar_2x2x8', 'sawblade', 'cannon_bullet']);
    for (const m of modelos) assert.ok(existsSync(new URL(`../public/gincana/${m}.gltf`, import.meta.url)), `${id}: falta ${m}`);
    for (let k = 1; k < p.postos.length; k++) assert.ok(p.postos[k].z > p.postos[k - 1].z, `${id}: bandeira ${k}`);
    assert.ok(p.chegada.z > p.postos[p.postos.length - 1].z);
    assert.ok(p.postos.length >= 2, `${id}: ao menos uma bandeira no meio`);
  }
  assert.ok(existsSync(new URL('../public/gincana/License.txt', import.meta.url)), 'a licença da KayKit ao lado dos modelos');
  assert.match(readFileSync(new URL('../public/gincana/License.txt', import.meta.url), 'utf8'), /Creative Commons Zero, CC0/);
});

test('o piloto automático completa cada percurso sem cair, entre ~25 s e ~60 s (gente leva mais)', () => {
  for (const id of sim.IDS_DOS_PERCURSOS) {
    const p = sim.PERCURSOS[id];
    const c = sim.refazer(p, gravar(plano(id)));
    assert.ok(c.chegou, id);
    assert.equal(c.quedas, 0, id);
    assert.equal(c.posto, p.postos.length - 1, `${id}: passou por todas as bandeiras`);
    assert.ok(c.chegouEm > 25 * 60 && c.chegouEm < 60 * 60, `${id}: ${c.chegouEm / 60} s`);
  }
});

test('determinismo: refazer os mesmos comandos dá o mesmo coelho, passo a passo', () => {
  const id = sim.IDS_DOS_PERCURSOS[1];
  const p = sim.PERCURSOS[id];
  const e = gravar(plano(id));
  const a = sim.refazer(p, e), b = sim.refazer(p, e);
  assert.deepEqual({ ...a }, { ...b });
  // o fantasma (o leitor) dá os mesmos comandos que o gravador guardou
  const ler = sim.leitor(e);
  assert.deepEqual(plano(id).map(() => ler()), plano(id));
});

test('cair do mapa volta à última bandeira, parado e piscando; a serra também manda de volta', () => {
  const p = sim.PERCURSOS['prado-1'];
  // até a primeira bandeira com o plano, e depois para o lado até cair
  const c = sim.novoCoelho(p);
  for (const e of plano('prado-1')) {
    sim.passo(c, e, p);
    if (c.posto === 1 && c.noChao) break;
  }
  assert.equal(c.posto, 1);
  let ev: sim.Evento = null;
  for (let i = 0; i < 600 && ev !== 'queda'; i++) ev = sim.passo(c, sim.ESQUERDA, p);
  assert.equal(ev, 'queda');
  assert.equal(c.quedas, 1);
  assert.equal(c.z, p.postos[1].zVolta);
  assert.equal(c.vx, 0);
  assert.equal(c.pisca, sim.PISCA_PASSOS);
  // a serra: um coelho posto no caminho dela
  const s = p.serras[0];
  const k = sim.novoCoelho(p);
  let pegou = false;
  for (let i = 0; i < 400 && !pegou; i++) {
    k.x = 0;
    k.z = s.cz;
    k.y = s.y - 0.15;
    k.vy = 0;
    k.noChao = true;
    pegou = sim.passo(k, 0, p) === 'machucou';
  }
  assert.ok(pegou, 'a serra pega quem fica no caminho');
});

test('a esteira leva para trás, a plataforma que anda leva junto, e o bloco vermelho cai depois de pisado e volta', () => {
  const p = sim.PERCURSOS['prado-1'];
  const est = p.caixas.find((c) => c.tipo === 'esteira')!;
  const c = sim.novoCoelho(p);
  Object.assign(c, { x: 0, z: est.z0 + 4, y: est.y1, noChao: true, sobre: est.i });
  for (let i = 0; i < 60; i++) sim.passo(c, 0, p);
  assert.ok(c.z < est.z0 + 4 - 2, 'parado na esteira, ele volta');

  const anda = p.caixas.find((b) => b.mov && b.mov.ax !== 0)!;
  const k = sim.novoCoelho(p);
  const d0 = sim.deslocamento(anda.mov, 0);
  Object.assign(k, { x: anda.x0 + d0.dx + 2, z: anda.z0 + 2, y: anda.y1, noChao: true, sobre: anda.i });
  for (let i = 0; i < 30; i++) sim.passo(k, 0, p);
  const d30 = sim.deslocamento(anda.mov, 30);
  assert.ok(Math.abs(k.x - (anda.x0 + d30.dx + 2)) < 1e-6, 'em cima da plataforma, anda com ela');

  const p2 = sim.PERCURSOS['ponte-2'];
  const bloco = p2.caixas.find((b) => b.tipo === 'cai')!;
  const q = sim.novoCoelho(p2);
  Object.assign(q, { x: (bloco.x0 + bloco.x1) / 2, z: (bloco.z0 + bloco.z1) / 2, y: bloco.y1, noChao: true });
  sim.passo(q, 0, p2);
  assert.ok(q.cai[bloco.k] > 0, 'pisou, marcou');
  for (let i = 0; i < sim.TREME_PASSOS + 30; i++) sim.passo(q, 0, p2);
  assert.ok(q.y < bloco.y1 - 1, 'o bloco caiu, e ele junto');
  assert.ok(!sim.caixaAtiva(q, bloco, q.passo));
  const r = sim.novoCoelho(p2);
  r.cai[bloco.k] = 0;
  for (let i = 0; i < sim.TREME_PASSOS + sim.VOLTA_DO_BLOCO + 2; i++) sim.passo(r, 0, p2);
  assert.equal(r.cai[bloco.k], -1, 'e volta inteiro');
});

test('a conferência das posições ao vivo: andar passa, teleportar para a frente não, e voltar a uma bandeira alcançada passa', () => {
  const p = sim.PERCURSOS['torre-3'];
  const inicio = { n: 0, x: 0, y: 0, z: p.postos[0].zVolta, posto: 0 };
  assert.equal(sim.posicaoPossivel(p, inicio, { n: 4, x: 0, y: 0, z: 2.4 }), 0);
  assert.equal(sim.posicaoPossivel(p, inicio, { n: 4, x: 0, y: 0, z: 40 }), -1, 'longe demais em 4 passos');
  assert.equal(sim.posicaoPossivel(p, inicio, { n: 0, x: 0, y: 0, z: 2 }), -1, 'o passo não anda');
  assert.equal(sim.posicaoPossivel(p, inicio, { n: 4, x: NaN, y: 0, z: 2 }), -1);
  const b2 = p.postos[2];
  const longe = { n: 2000, x: 1, y: b2.y, z: b2.z + 10, posto: 2 };
  assert.equal(sim.posicaoPossivel(p, longe, { n: 2004, x: b2.x, y: b2.y, z: b2.zVolta }), 2, 'a volta à bandeira alcançada');
  const b3 = p.postos[3];
  assert.equal(sim.posicaoPossivel(p, longe, { n: 2004, x: b3.x, y: b3.y, z: b3.zVolta }), -1, 'uma bandeira ainda não alcançada não');
});

test('as entradas: só inteiros, comandos de 0 a 31 e o total dentro de 10 minutos', () => {
  assert.ok(sim.entradasValidas([3, sim.FRENTE | sim.PULO]));
  assert.ok(!sim.entradasValidas([]));
  assert.ok(!sim.entradasValidas([1]));
  assert.ok(!sim.entradasValidas([1, 32]));
  assert.ok(!sim.entradasValidas([0, 1]));
  assert.ok(!sim.entradasValidas([1.5, 1]));
  assert.ok(!sim.entradasValidas([sim.PASSOS_MAXIMOS + 1, 1]));
});
