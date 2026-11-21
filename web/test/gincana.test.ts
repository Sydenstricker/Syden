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
  for (const id of sim.IDS_DOS_PERCURSOS) {
    const p = sim.PERCURSOS[id];
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

test('as entradas: só inteiros, comandos de 0 a 63 (o mergulho é o 32) e o total dentro de 10 minutos', () => {
  assert.ok(sim.entradasValidas([3, sim.FRENTE | sim.PULO]));
  assert.ok(sim.entradasValidas([3, sim.FRENTE | sim.MERGULHO]));
  assert.ok(!sim.entradasValidas([]));
  assert.ok(!sim.entradasValidas([1]));
  assert.ok(!sim.entradasValidas([1, 64]));

  assert.ok(!sim.entradasValidas([0, 1]));
  assert.ok(!sim.entradasValidas([1.5, 1]));
  assert.ok(!sim.entradasValidas([sim.PASSOS_MAXIMOS + 1, 1]));
});

// ---------------------------------------------------------------------------------------------------------------------
// 19/11/2026: o mergulho, a sobrevivência (o varredor que acelera) e os coelhos-robô do Solo
// ---------------------------------------------------------------------------------------------------------------------

test('o mergulho: um impulso para a frente, um por pulo; ao pousar, deitado um tico (sem pular nem correr)', () => {
  const p = sim.PERCURSOS['prado-1'];
  const c = sim.novoCoelho(p);
  for (let i = 0; i < 10; i++) sim.passo(c, sim.FRENTE, p);
  const z0 = c.z;
  assert.equal(sim.passo(c, sim.FRENTE | sim.MERGULHO, p), 'mergulho');
  assert.ok(c.mergulho && !c.noChao);
  assert.ok(c.vz > sim.VELOCIDADE, 'mais rápido que correr');
  // segurar não mergulha de novo
  for (let i = 0; i < 5; i++) assert.notEqual(sim.passo(c, sim.FRENTE | sim.MERGULHO, p), 'mergulho');
  let n = 0;
  while (!c.noChao && n++ < 120) sim.passo(c, sim.FRENTE, p);
  assert.ok(c.noChao && !c.mergulho && c.deitado > 0, 'pousou de barriga');
  assert.ok(c.z - z0 > 2, `andou ${c.z - z0}`);
  // deitado: o pulo não sai
  assert.notEqual(sim.passo(c, sim.FRENTE | sim.PULO, p), 'pulo');
  for (let i = 0; i < sim.DEITADO_PASSOS + 2; i++) sim.passo(c, 0, p);
  assert.equal(c.deitado, 0);
  // o mergulho só sai de novo depois de soltar
  sim.passo(c, 0, p);
  assert.equal(sim.passo(c, sim.MERGULHO, p), 'mergulho');
});

test('sem o bit do mergulho, a regra é a de antes: o fantasma guardado continua chegando no mesmo passo', () => {
  // os planos do piloto não usam o mergulho; o teste do piloto acima já confere que eles chegam. Aqui, que o bit 32 muda algo:
  const p = sim.PERCURSOS['prado-1'];
  const e = gravar(plano('prado-1'));
  const com = e.slice();
  com[1] |= sim.MERGULHO;
  assert.notDeepEqual({ ...sim.refazer(p, com) }, { ...sim.refazer(p, e) });
});

test('o varredor que acelera: o giro é a soma das velocidades (inteiros), e o de giro fixo não muda', () => {
  const v: sim.Varredor = { cx: 0, cz: 0, y: 0, braco: 1, giro: 2, fase: 0, bracos: 2, modelo: '', acel: 1 };
  let soma = 0;
  for (let n = 0; n < 3000; n++) {
    assert.equal(sim.indiceDoGiro(v, n), ((Math.floor((n * n) / (2 * sim.ACEL_DIV)) + 2 * n) % 720 + 720) % 720);
    soma += 1;
  }
  assert.ok(sim.giroEm(v, 6000) > 11, 'em 100 s, gira bem mais rápido');
  const parado = { ...v, acel: 0 };
  assert.equal(sim.indiceDoGiro(parado, 1000), 2000 % 720);
  assert.equal(sim.indiceDoGiro({ ...v, giro: -2 }, 600), ((-1200 - 300) % 720 + 720) % 720);
  assert.ok(soma > 0);
});

test('a sobrevivência: cair é sair (sem voltar à bandeira), e quem aguenta até o fim termina no último passo', () => {
  for (const id of sim.IDS_DA_SOBREVIVENCIA) {
    const p = sim.PERCURSOS[id];
    assert.ok(p.sobrevivencia > 0);
    assert.ok(!sim.IDS_DOS_PERCURSOS.includes(id));
    for (const m of new Set(p.caixas.map((c) => c.modelo).filter(Boolean))) assert.ok(existsSync(new URL(`../public/gincana/${m}.gltf`, import.meta.url)), `${id}: falta ${m}`);
    // andar para a esquerda até cair: fora, com o tempo de quando caiu
    const c = sim.novoCoelho(p);
    let ev: sim.Evento = null;
    for (let i = 0; i < 1200 && ev !== 'fora'; i++) ev = sim.passo(c, sim.ESQUERDA, p);
    assert.equal(ev, 'fora');
    assert.ok(c.chegou && c.fora);
    assert.equal(c.chegouEm, c.passo);
    assert.equal(sim.passo(c, 0, p), null, 'fora, não anda mais');
    // ficar parado: o bloco cai debaixo dele
    const q = sim.refazer(p, [600, 0]);
    assert.ok(q.chegou && q.fora && q.chegouEm < 600, `parado cai em ${q.chegouEm}`);
  }
});

test('a sobrevivência: um coelho que foge do varredor e troca de bloco aguenta um bom tempo (o campo não é impossível)', () => {
  // as duas (a segunda, o campo 7 × 7, desde 21/11/2026)
  for (const id of sim.IDS_DA_SOBREVIVENCIA) {
    const p = sim.PERCURSOS[id];
    const meio = p.comprimento / 2;
    // o piloto da sobrevivência do teste: a cada bloco de 6 passos, a ação que deixa o coelho em pé por mais tempo olhando 30
    // passos à frente (sem cair)
    const acoes = [0, sim.FRENTE, sim.TRAS, sim.ESQUERDA, sim.DIREITA, sim.PULO, sim.FRENTE | sim.PULO, sim.TRAS | sim.PULO, sim.ESQUERDA | sim.PULO, sim.DIREITA | sim.PULO];
    const c = sim.novoCoelho(p);
    const g = sim.gravador();
    while (!c.chegou && c.passo < 60 * 40) {
      let melhor = 0, melhorFolga = -1;
      for (const a of acoes) {
        const k = sim.copiarCoelho(c);
        let folga = 0;
        for (let i = 0; i < 36 && !k.chegou; i++) {
          sim.passo(k, i < 6 ? a : 0, p);
          folga++;
        }
        const centro = -Math.abs(k.x) - Math.abs(k.z - meio);
        const nota = folga * 10 + (k.chegou ? 0 : centro);
        if (nota > melhorFolga) {
          melhorFolga = nota;
          melhor = a;
        }
      }
      for (let i = 0; i < 6 && !c.chegou; i++) {
        g.anotar(melhor);
        sim.passo(c, melhor, p);
      }
    }
    assert.ok(c.passo > 60 * 10, `${id}: aguentou ${c.passo / 60} s`);
    // e o servidor refaz igual
    const r = sim.refazer(p, g.entradas.length ? g.entradas : [1, 0]);
    if (c.chegou) assert.equal(r.chegouEm, c.chegouEm);
  }
});

test('os coelhos-robô do Solo: o planejador com erro chega, mais devagar que o piloto, e as entradas são válidas', async () => {
  const { correrRobo } = await import('../src/gincana/piloto.ts');
  const id = 'prado-1';
  const p = sim.PERCURSOS[id];
  const trechos: number[][] = [];
  const comandos = correrRobo(p, 5, (t) => trechos.push(t), 0.8);
  assert.deepEqual(trechos.flat(), comandos, 'os trechos somam os comandos');
  const e = gravar(comandos);
  assert.ok(sim.entradasValidas(e));
  const r = sim.refazer(p, e);
  assert.ok(r.chegou, 'o robô chega');
  assert.ok(r.chegouEm >= sim.refazer(p, gravar(plano(id))).chegouEm, 'e não mais rápido que o piloto sem erro');
});
