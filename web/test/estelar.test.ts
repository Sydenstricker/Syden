import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Mundo } from '../src/estelar/mundo';
import { pilotar } from '../src/estelar/piloto';
import { BIFURCA, CHEFE_T, FIM, Ficha, ROTA_DO_GELO, ROTA_DO_PLANETA, SUBCHEFE_T, posicaoInimigo, roteiro, rotaValida, vaivem, zNave } from '../src/estelar/sim';

/** A Rota Estelar (estelar/sim.ts ↔ server/src/estelar-sim.ts): o roteiro determinístico e o piloto automático. */

test('as duas cópias da regra da Rota Estelar são iguais (o site joga com a mesma conta que o servidor confere)', () => {
  const servidor = readFileSync(new URL('../../server/src/estelar-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../src/estelar/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/estelar-sim.ts e web/src/estelar/sim.ts mudaram separados: copie uma sobre a outra');
});

test('o roteiro sai da semente: a mesma semente, o mesmo roteiro; outra semente, outro', () => {
  assert.deepEqual(roteiro(42), roteiro(42));
  assert.notDeepEqual(roteiro(42), roteiro(43));
  const r = roteiro(42);
  assert.equal(r.inimigos.at(-1)?.tipo, 'chefe');
  assert.equal(r.inimigos.at(-1)?.t, CHEFE_T);
  assert.ok(r.inimigos.some((e) => e.tipo === 'subchefe' && e.t === SUBCHEFE_T));
  assert.ok(r.inimigos.some((e) => e.ramo === 1) && r.inimigos.some((e) => e.ramo === 2), 'as duas rotas têm inimigos');
  assert.ok(r.inimigos.every((e) => e.ramo === 0 || e.t > BIFURCA), 'nada de uma rota antes da bifurcação');
  assert.ok(r.aneis.length >= 6 && r.aneis.some((a) => a.ouro));
  assert.ok(r.obstaculos.length > 10);
  assert.equal(r.inimigos.find((e) => e.item)?.item, 'duplo', 'o primeiro item é o laser duplo');
  // o mesmo caminho em qualquer passo (conta pura)
  const e = r.inimigos[5];
  assert.deepEqual(posicaoInimigo(e, e.t + 40), posicaoInimigo(e, e.t + 40));
  assert.equal(zNave(120), 60);
});

test('o vaivém, sem seno, vai de −1 a 1 e volta', () => {
  assert.equal(vaivem(0), 0);
  assert.equal(vaivem(0.25), 1);
  assert.equal(vaivem(0.75), -1);
});

/** Uma partida inteira com o piloto automático; cada lote passa pela ficha do "servidor" (outra Ficha, do zero). */
function partida(semente: number) {
  const m = new Mundo(semente, true);
  const servidor = new Ficha(roteiro(semente));
  let recusas = 0;
  for (let n = 0; n <= FIM && !m.ficha.acabou; n++) {
    m.avancar(pilotar(m));
    if (n % 6 === 0) {
      for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
      if (servidor.posicao(m.passo, m.nave.x, m.nave.y) !== null) recusas++;
    }
  }
  for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
  return { m, servidor, recusas };
}

test('o piloto automático termina a rota (as duas rotas), e o servidor aceita cada evento e chega aos mesmos pontos', () => {
  for (const semente of [1, 2, 3, 4]) {
    const { m, servidor, recusas } = partida(semente);
    assert.equal(recusas, 0, `semente ${semente}: o servidor recusou ${recusas} eventos`);
    assert.ok(m.ficha.chefeEm !== null, `semente ${semente}: o chefe não caiu (vidas ${m.ficha.vidas}, escudo ${m.ficha.escudo}, passo ${m.passo})`);
    assert.equal(servidor.ramo, semente % 2 ? 1 : 2, 'a rota pelo lado da nave na bifurcação');
    assert.equal(servidor.total(FIM, true), m.ficha.total(FIM, true));
    assert.equal(servidor.chefeEm, m.ficha.chefeEm);
    assert.ok(servidor.acertos > 100);
  }
});

test('a ficha recusa o acerto inventado, o tiro fora da cadência, o inimigo da outra rota e a nave que salta', () => {
  const r = roteiro(5);
  const f = new Ficha(r);
  const i = r.inimigos.findIndex((e) => e.tipo === 'drone');
  const e = r.inimigos[i];
  const q = e.t + 50;
  const a = posicaoInimigo(e, q)!;
  // a bala saiu da nave alinhada com ele, no passo certo para chegar
  const p = q - Math.round((a.z - zNave(q) - 1.5) / 2.5) - 1;
  assert.notEqual(f.acerto(q, i, p + (p % 6 === 0 ? 1 : 0), a.x, a.y, 0, 0), null, 'fora da cadência');
  assert.notEqual(f.acerto(q, i, 12, 13, -7, 0, 0), null, 'bala longe do alvo');
  const outra = r.inimigos.findIndex((x) => x.ramo === 2);
  const fo = new Ficha(r);
  fo.ramo = 1;
  const eo = r.inimigos[outra];
  const ao = posicaoInimigo(eo, eo.t + 40)!;
  assert.equal(fo.travado(eo.t + 40, outra, eo.t, ao.x, ao.y), 'Acerto inválido.', 'inimigo da outra rota');
  assert.equal(f.posicao(100, 0, 0), null);
  assert.equal(f.posicao(110, 12, 0), 'Lugar inválido.', 'a nave não anda 12 em 10 passos');
  assert.equal(f.atingida(200, 0, 0, 99), 'Evento inválido.', 'golpe de tamanho que não existe');
  assert.equal(f.rota(BIFURCA + 1, 0, 0), 'Evento inválido.', 'a rota só no passo da bifurcação');
});

// ---------------- O lote E (24/11/2026): a segunda rota, a do gelo ----------------

test('a rota do planeta não mudou com a do gelo: a mesma semente dá o mesmo roteiro de antes (o resumo guardado em 24/11/2026)', async () => {
  const { createHash } = await import('node:crypto');
  const guardados: [number, string][] = [
    [1, '43e4ac0d781971d2'],
    [2, '294175d908dc725f'],
    [3, '2fc679dfc51d7790'],
    [42, 'c44487186ba09ed0'],
  ];
  for (const [s, h] of guardados) {
    const { rota, inimigos, aneis, obstaculos } = roteiro(s);
    assert.equal(rota, ROTA_DO_PLANETA);
    assert.equal(createHash('sha256').update(JSON.stringify({ inimigos, aneis, obstaculos })).digest('hex').slice(0, 16), h, `semente ${s}`);
    assert.deepEqual(roteiro(s, 0), roteiro(s));
  }
  assert.equal(rotaValida(7), ROTA_DO_PLANETA);
  assert.equal(rotaValida('1'), ROTA_DO_PLANETA);
  assert.equal(rotaValida(1), ROTA_DO_GELO);
});

test('a rota do gelo: o roteiro dela (minas, cristais, arcos, portas, a sentinela e a nave-mãe no fim), outro da mesma semente', () => {
  const r = roteiro(42, ROTA_DO_GELO);
  assert.equal(r.rota, ROTA_DO_GELO);
  assert.deepEqual(r, roteiro(42, ROTA_DO_GELO));
  assert.notDeepEqual(r.inimigos, roteiro(42).inimigos);
  assert.equal(r.inimigos.at(-1)?.tipo, 'mae', 'a nave-mãe é a última');
  assert.equal(r.inimigos.at(-1)?.t, CHEFE_T);
  assert.ok(r.inimigos.some((e) => e.tipo === 'sentinela' && e.t === SUBCHEFE_T));
  assert.ok(!r.inimigos.some((e) => e.tipo === 'chefe' || e.tipo === 'subchefe'), 'nenhum chefe da outra rota');
  assert.ok(r.inimigos.some((e) => e.tipo === 'mina' && e.ramo === 0) && r.inimigos.some((e) => e.tipo === 'mina' && e.ramo === 1));
  assert.ok(r.inimigos.some((e) => e.tipo === 'rocha' && e.ramo === 2), 'o anel de gelo tem rochas');
  assert.ok(r.inimigos.some((e) => e.tipo === 'drone' && e.t > CHEFE_T), 'a nave-mãe solta escoltas');
  assert.ok(r.inimigos.every((e) => e.ramo === 0 || e.t > BIFURCA));
  assert.ok(r.obstaculos.some((o) => o.modelo === 'cristal') && r.obstaculos.some((o) => o.modelo === 'arco' && o.ramo === 0) && r.obstaculos.some((o) => o.modelo === 'arco' && o.ramo === 2));
  assert.equal(r.inimigos.find((e) => e.item)?.item, 'duplo', 'o primeiro item é o laser duplo');
  // a porta tem vão: as duas lajes do mesmo z deixam espaço para a nave
  const portas = r.obstaculos.filter((o) => o.modelo === 'arco' && o.ramo === 2);
  for (let i = 0; i + 1 < portas.length; i += 2) assert.ok(portas[i].y0 - portas[i + 1].y1 >= 5, 'o vão da porta');
});

test('a rota do gelo: o piloto termina as duas rotas dela derrubando a nave-mãe, e o servidor aceita cada evento', () => {
  for (const semente of [1, 2, 3, 4]) {
    const m = new Mundo(semente, true, ROTA_DO_GELO);
    const servidor = new Ficha(roteiro(semente, ROTA_DO_GELO));
    let recusas = 0;
    for (let n = 0; n <= FIM && !m.ficha.acabou; n++) {
      m.avancar(pilotar(m));
      if (n % 6 === 0) {
        for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
        if (servidor.posicao(m.passo, m.nave.x, m.nave.y) !== null) recusas++;
      }
    }
    for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
    assert.equal(recusas, 0, `semente ${semente}: o servidor recusou ${recusas} eventos`);
    assert.ok(m.ficha.chefeEm !== null, `semente ${semente}: a nave-mãe não caiu`);
    assert.equal(servidor.ramo, semente % 2 ? 1 : 2);
    assert.equal(servidor.total(FIM, true), m.ficha.total(FIM, true));
    assert.ok([...servidor.mortos.keys()].some((i) => servidor.inimigos[i].tipo === 'sentinela'), 'a sentinela caiu');
  }
});
