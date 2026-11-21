import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Mundo, comandosDoJogador, reancorar, type Toque } from '../src/nave/mundo';
import { pilotar } from '../src/nave/piloto';
import { CHEFE_T, FIM, Ficha, posicaoInimigo, roteiro, tirosDosInimigos, vaivem } from '../src/nave/sim';

test('as duas cópias da regra da navinha são iguais (o site joga com a mesma conta que o servidor confere)', () => {
  const servidor = readFileSync(new URL('../../server/src/nave-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../src/nave/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/nave-sim.ts e web/src/nave/sim.ts mudaram separados: copie uma sobre a outra');
});

test('o roteiro sai da semente: a mesma semente, o mesmo roteiro; outra semente, outro', () => {
  assert.deepEqual(roteiro(42), roteiro(42));
  assert.notDeepEqual(roteiro(42), roteiro(43));
  const r = roteiro(42);
  assert.equal(r.at(-1)?.tipo, 'chefe');
  assert.equal(r.at(-1)?.t, CHEFE_T);
  assert.ok(r.length > 60, `inimigos: ${r.length}`);
  assert.ok(r.filter((e) => e.item).length >= 8, 'dois itens por onda');
  assert.equal(r.find((e) => e.item)?.item, 'duplo', 'o primeiro item é o tiro duplo');
  assert.ok(tirosDosInimigos(r).length > 200);
});

test('o vaivém, sem seno, vai de −1 a 1 e volta', () => {
  assert.equal(vaivem(0), 0);
  assert.equal(vaivem(0.25), 1);
  assert.equal(vaivem(0.75), -1);
  assert.ok(Math.abs(vaivem(0.5)) < 1e-12);
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

test('o piloto automático joga a partida inteira, e o servidor aceita cada evento e chega aos mesmos pontos', () => {
  for (const semente of [1, 2, 3]) {
    const { m, servidor, recusas } = partida(semente);
    assert.equal(recusas, 0, `semente ${semente}: o servidor recusou ${recusas} eventos honestos`);
    assert.equal(servidor.total(FIM, true), m.ficha.total(FIM, true));
    assert.ok(m.ficha.mortos.size > 50, `semente ${semente}: derrubou ${m.ficha.mortos.size}`);
    assert.ok(m.ficha.chefeEm !== null, `semente ${semente}: o chefe ficou de pé (vidas ${m.ficha.vidas}, morte ${m.ficha.morteFinal})`);
    console.log(`semente ${semente}: ${m.ficha.total(FIM, true)} pontos, ${m.ficha.vidas} vidas, chefe no passo ${m.ficha.chefeEm}, ${m.ficha.pegos.size} itens`);
  }
});

test('a ficha recusa a trapaça óbvia', () => {
  const inimigos = roteiro(5);
  const f = new Ficha(inimigos);
  const i = 0;
  const e = inimigos[i];
  // um passo da cadência em que o corvo está na tela, e a nave logo abaixo dele
  let q = e.t + Math.round(e.dur / 2);
  while (q % 7 !== 0) q++;
  const alvo = posicaoInimigo(e, q + 4)!;
  const x = Math.round(alvo.x * 100) / 100;
  const y = Math.round((alvo.y + 26) * 100) / 100;
  // fora da cadência
  assert.equal(f.acerto(q + 4, i, q + 1, x, y, 0, 0), 'Disparo inválido.');
  // com uma arma que a pessoa não tem
  assert.equal(f.acerto(q + 4, i, q, x, y, 2, 1), 'Disparo inválido.');
  // a bala longe do inimigo
  assert.equal(f.acerto(q + 4, i, q, x + 40, y, 0, 0), 'Acerto inválido.');
  // a nave teleportada: de (90, 210) no passo 0 a cá não dá
  assert.equal(f.posicao(0, 90, 210), null);
  const longe = f.acerto(q + 4, i, q, x, y, 0, 0);
  if (q * 2 + 2 < Math.hypot(x - 90, y - 210)) assert.equal(longe, 'Lugar inválido.');
  // um item que ninguém soltou
  assert.equal(f.pegar(q + 10, 1, x, y), 'Item inválido.');
  // duas bombas na mesma vida
  const g = new Ficha(inimigos);
  assert.equal(g.bomba(200, 90, 210), null);
  assert.equal(g.bomba(210, 90, 210), 'Sem bomba.');
});

test('atirar andando: as setas com o fogo seguram os dois, e o clique do mouse não prende a nave (relato de 06/11/2026)', () => {
  const solto = {
    esquerda: false,
    direita: false,
    cima: false,
    baixo: false,
    fogo: false,
    bomba: false,
  };
  // o teclado: seta e fogo juntos dão os dois
  const c = comandosDoJogador({ ...solto, direita: true, cima: true, fogo: true }, null);
  assert.deepEqual([c.dx, c.dy, c.fogo, c.alvo], [1, -1, true, null]);
  // o mouse apertado atira; com a seta segurada, ela anda (o alvo do clique não prende a nave)
  const dedo: Toque = {
    id: 1,
    dedoX: 50,
    dedoY: 50,
    naveX: 90,
    naveY: 210,
    ultimoX: 50,
    ultimoY: 50,
    alvo: { x: 90, y: 210 },
  };
  const m = comandosDoJogador({ ...solto, esquerda: true }, dedo);
  assert.deepEqual([m.dx, m.fogo, m.alvo], [-1, true, null]);
  // sem seta, o arraste volta a mandar, a partir de onde a nave parou
  reancorar(dedo, { x: 70, y: 210 });
  assert.deepEqual(comandosDoJogador(solto, dedo).alvo, { x: 70, y: 210 });

  // no mundo: a nave em zigue-zague, sempre atirando, dispara a cada cadência, anda, e o servidor aceita os acertos em movimento
  const semente = 7;
  const mundo = new Mundo(semente, true);
  const servidor = new Ficha(roteiro(semente));
  const xs = new Set<number>();
  let disparos = 0;
  let recusas = 0;
  for (let n = 0; n < 1500 && !mundo.ficha.acabou; n++) {
    const lado = Math.floor(n / 40) % 2 === 0;
    const o = mundo.avancar(
      comandosDoJogador(
        {
          ...solto,
          direita: lado,
          esquerda: !lado,
          cima: n % 160 < 20,
          fogo: true,
        },
        null,
      ),
    );
    if (o.disparou) {
      disparos++;
      xs.add(mundo.nave.x);
    }
    if (n % 6 === 0) {
      for (const ev of mundo.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
      if (servidor.posicao(mundo.passo, mundo.nave.x, mundo.nave.y) !== null) recusas++;
    }
  }
  assert.ok(disparos >= 150, `disparos andando: ${disparos}`);
  assert.ok(xs.size > 20, `os disparos saíram de ${xs.size} lugares diferentes`);
  assert.equal(recusas, 0, 'o servidor recusou um acerto feito em movimento');
  assert.ok(servidor.mortos.size > 0, 'nenhum acerto andando');
  assert.equal(servidor.pontos, mundo.ficha.pontos);
});

// ---------------- O nível da arma, o loop e as fases (19/11/2026) ----------------

test('pegar a mesma arma de novo sobe o nível (até 3), e o nível bate mais forte', async () => {
  const sim = await import('../src/nave/sim');
  const inimigos = roteiro(5);
  const f = new Ficha(inimigos);
  // três itens de tiro duplo, de mentira: o primeiro dá o nível 1, os outros sobem
  f.armas.push([10, 1, 1]);
  assert.equal(f.nivelEm(10), 1);
  // a regra da pegada, pelo caminho de verdade
  const g = new Ficha(
    inimigos.map((e) => ({
      ...e,
      item: e.tipo === 'chefe' ? null : ('duplo' as const),
    })),
  );
  const meio = (i: number) => g.inimigos[i].t + Math.floor(g.inimigos[i].dur / 2);
  const caem = g.inimigos
    .map((_, i) => i)
    .filter((i) => g.inimigos[i].tipo === 'corvo')
    .slice(0, 4)
    .sort((a, b) => meio(a) - meio(b));
  let q = 0;
  for (const i of caem) {
    q = Math.max(q + 1, meio(i));
    g.mortos.set(i, q);
    const item = sim.posicaoItem(g.inimigos[i], q, q)!;
    g.posicoes = [];
    assert.equal(g.pegar(q, i, item.x, item.y), null);
  }
  assert.equal(g.armaEm(q), 1);
  assert.equal(g.nivelEm(q), 3, 'quatro pegadas: o nível para no 3');
  assert.equal(sim.DANO_DO_NIVEL[3], 2);
  // perder a vida volta ao tiro simples, nível 1
  g.posicoes = [];
  assert.equal(g.atingida(q + 1, 90, 200), null);
  assert.equal(g.armaEm(q + 1), 0);
  assert.equal(g.nivelEm(q + 1), 1);
});

test('o loop: só depois da recarga, invulnerável no meio, e sem atirar durante a volta', async () => {
  const sim = await import('../src/nave/sim');
  const f = new Ficha(roteiro(7));
  assert.equal(f.loop(100, 90, 200), null);
  assert.equal(f.loop(100 + sim.LOOP_RECARGA - 1, 90, 200), 'Loop inválido.', 'antes da recarga');
  assert.equal(f.invulNoLoop(100 + sim.LOOP_INVUL[0]), true);
  assert.equal(f.invulNoLoop(100 + sim.LOOP_INVUL[1]), false);
  // atingida no meio do loop: nada acontece
  assert.equal(f.atingida(100 + 10, 90, 200 - 2), null);
  assert.equal(f.vidas, sim.VIDAS);
  // o disparo no meio do loop não vale
  const e = f.inimigos.findIndex((i) => i.tipo === 'corvo');
  assert.equal(f.acerto(112, e, 105, 90, 200, 0, 0), 'Disparo inválido.');
  assert.equal(f.loop(100 + sim.LOOP_RECARGA, 90, 200), null, 'depois da recarga');
});

test('as fases curtas: duas ondas e um chefe novo, e o piloto automático vence com o servidor aceitando tudo', async () => {
  const sim = await import('../src/nave/sim');
  for (const fase of ['pomar', 'celeiro'] as const) {
    const r = roteiro(3, fase);
    const tempos = sim.temposDaFase(fase);
    assert.equal(r.at(-1)?.t, tempos.chefeT);
    assert.deepEqual(r.at(-1)?.rota, [sim.FASES_DA_NAVE[fase].chefe]);
    assert.ok(tempos.fim < FIM, 'mais curta que a horta');
    const m = new Mundo(3, true, fase);
    const servidor = new Ficha(roteiro(3, fase), fase);
    let recusas = 0;
    for (let n = 0; n <= tempos.fim && !m.ficha.acabou; n++) {
      m.avancar(pilotar(m));
      if (n % 6 === 0) for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
    }
    for (const ev of m.eventos.splice(0)) if (servidor.aplicar(ev) !== null) recusas++;
    assert.equal(recusas, 0, `${fase}: o servidor recusou eventos honestos`);
    assert.equal(servidor.total(tempos.fim, true), m.ficha.total(tempos.fim, true));
    console.log(`${fase}: ${m.ficha.total(tempos.fim, true)} pontos, ${m.ficha.vidas} vidas, chefe ${m.ficha.chefeEm}, loops ${m.ficha.loops.length}`);
  }
  // a horta continua a mesma: o roteiro de sempre
  assert.deepEqual(roteiro(42), roteiro(42, 'horta'));
});

// ---------------- A segunda auditoria (20/11/2026): o raspão ----------------

test('o raspão: o piloto ganha alguns na partida, e o servidor aceita cada um e chega aos mesmos pontos', () => {
  let total = 0;
  for (const semente of [1, 2]) {
    const { m, servidor, recusas } = partida(semente);
    assert.equal(recusas, 0);
    assert.equal(servidor.raspados.size, m.ficha.raspados.size);
    total += servidor.raspados.size;
  }
  assert.ok(total > 0, 'o piloto passa de raspão por algum tiro');
});

test('o raspão: a ficha recusa o tiro longe, o que acerta, o repetido, o que ainda não saiu e o de quem já caiu', async () => {
  const sim = await import('../src/nave/sim');
  const inimigos = roteiro(5);
  const tiros = tirosDosInimigos(inimigos);
  // um tiro que desce (vy > 0) e, uns passos depois de sair, a nave logo ACIMA dele: ele já passou e se afasta
  const j = tiros.findIndex((t) => t.vy > 0.5 && Math.abs(t.vx) < 0.01);
  assert.ok(j >= 0);
  const tiro = tiros[j];
  const q = tiro.t + 20;
  const b = sim.posicaoTiro(tiro, q)!;
  const x = Math.round(b.x * 100) / 100;
  const yPerto = Math.round((b.y - 7) * 100) / 100;
  // nada antes do tiro sair
  const f0 = new Ficha(inimigos);
  assert.equal(f0.raspao(tiro.t - 1, j, x, yPerto), 'Raspão inválido.');
  // longe demais
  const f1 = new Ficha(inimigos);
  assert.equal(f1.raspao(q, j, x, b.y - 30), 'Raspão inválido.');
  // perto demais é golpe, não raspão
  assert.equal(f1.raspao(q, j, x, b.y - 2), 'Raspão inválido.');
  // a nave ABAIXO do tiro: ele ainda vem (não passou)
  assert.equal(f1.raspao(q, j, x, b.y + 7), 'Raspão inválido.');
  // o raspão de verdade, uma vez só
  const antes = f1.pontos;
  assert.equal(f1.raspao(q, j, x, yPerto), null);
  assert.equal(f1.pontos, antes + sim.RASPAO_PONTOS);
  assert.equal(f1.raspao(q + 1, j, x, yPerto - 1), 'Raspão inválido.');
  // o dono caiu antes de atirar: o tiro nunca saiu
  const f2 = new Ficha(inimigos);
  f2.mortos.set(tiro.dono, tiro.t - 5);
  assert.equal(f2.raspao(q, j, x, yPerto), 'Raspão inválido.');
  // a bomba limpou o tiro
  const f3 = new Ficha(inimigos);
  f3.bombasEm.push(tiro.t + 5);
  assert.equal(f3.raspao(q, j, x, yPerto), 'Raspão inválido.');
  // no meio do loop não conta
  const f4 = new Ficha(inimigos);
  f4.loops.push(q - 10);
  assert.equal(f4.raspao(q, j, x, yPerto), 'Raspão inválido.');
});
