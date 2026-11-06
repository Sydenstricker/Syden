import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarIA, PERFIS } from '../src/tocas/ia';
import {
  assinatura,
  CAPACIDADE,
  CENTRO_DE,
  FLECHAS_DO_SINO,
  lugarDeColeta,
  ocupantes,
  comandar,
  novaPartida,
  passo,
  PASSOS_MAX,
  PREDIOS,
  podeConstruir,
  UNIDADES,
  type Dono,
  type Sim,
  type TipoUnidade,
} from '../src/tocas/sim';

/** A partida inteira com o piloto automático (o dono 0) contra o computador (o dono 1). */
function partida(semente: number, ate = PASSOS_MAX + 5) {
  const sim = novaPartida(semente);
  const piloto = criarIA(0, PERFIS.piloto);
  const computador = criarIA(1, PERFIS.computador);
  const visto = { ataques1: 0, era: [false, false], quartel1: false, exercito1: 0 };
  while (sim.vencedor === null && sim.passo < ate) {
    piloto(sim);
    computador(sim);
    passo(sim);
    for (const e of sim.eventos) {
      if (e.t === 'era') visto.era[e.dono] = true;
      if (e.t === 'pronto' && e.dono === 1 && e.tipo === 'quartel') visto.quartel1 = true;
      if (e.t === 'golpe' && e.dono === 1) {
        // o computador batendo perto da base do piloto: é ataque, não defesa
        const c = CENTRO_DE[0];
        if (Math.abs(e.x1 - (c.gx + 1.5)) < 12 && Math.abs(e.y1 - (c.gy + 1.5)) < 12) visto.ataques1++;
      }
    }
    visto.exercito1 = Math.max(visto.exercito1, sim.unidades.filter((u) => u.dono === 1 && UNIDADES[u.tipo].combate).length);
  }
  return { sim, visto };
}

const meus = (sim: Sim, dono: Dono, tipo?: TipoUnidade) => sim.unidades.filter((u) => u.dono === dono && (!tipo || u.tipo === tipo));
const centroDe = (sim: Sim, dono: Dono) => sim.predios.find((p) => p.dono === dono && p.tipo === 'centro')!;

test('o mapa nasce espelhado e igual para a mesma semente', () => {
  const a = novaPartida(11);
  const b = novaPartida(11);
  assert.equal(assinatura(a), assinatura(b));
  assert.deepEqual([...a.grade].map((g) => (g === 0 ? 0 : 1)), [...b.grade].map((g) => (g === 0 ? 0 : 1)));
  // o que um tem, o outro tem no espelho
  const T = 44;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) assert.equal(a.grade[y * T + x] === 0, a.grade[(T - 1 - y) * T + (T - 1 - x)] === 0, `casa ${x},${y}`);
  assert.equal(meus(a, 0, 'trabalhador').length, 3);
  assert.equal(meus(a, 1, 'trabalhador').length, 3);
});

test('a simulação é determinística: a mesma partida, passo a passo', () => {
  const rodar = () => {
    const sim = novaPartida(5);
    const a = criarIA(0, PERFIS.piloto);
    const b = criarIA(1, PERFIS.computador);
    const marcas: string[] = [];
    while (sim.passo < 4000) {
      a(sim);
      b(sim);
      passo(sim);
      if (sim.passo % 500 === 0) marcas.push(assinatura(sim));
    }
    return marcas;
  };
  assert.deepEqual(rodar(), rodar());
});

test('coletar enche o estoque: o trabalhador leva a carga ao centro sozinho', () => {
  const sim = novaPartida(3);
  const antes = sim.jogadores[0].recursos.madeira;
  const arvore = sim.fontes.filter((f) => f.tipo === 'arvore').sort((p, q) => Math.abs(p.gx - 7) + Math.abs(p.gy - 35) - (Math.abs(q.gx - 7) + Math.abs(q.gy - 35)))[0];
  const ids = meus(sim, 0, 'trabalhador').map((u) => u.id);
  comandar(sim, 0, { t: 'alvo', ids, alvo: arvore.id });
  let entregas = 0;
  for (let i = 0; i < 900; i++) {
    passo(sim);
    for (const e of sim.eventos) if (e.t === 'entregou' && e.dono === 0) entregas++;
  }
  assert.ok(entregas >= 3, `entregas: ${entregas}`);
  assert.ok(sim.jogadores[0].recursos.madeira >= antes + 30, `madeira: ${sim.jogadores[0].recursos.madeira}`);
});

test('construir e treinar gastam; sem recursos, nada acontece', () => {
  const sim = novaPartida(3);
  const r = sim.jogadores[0].recursos;
  const ids = meus(sim, 0, 'trabalhador').map((u) => u.id);
  const c = centroDe(sim, 0);
  // uma casa ao lado do centro
  let lugar: { gx: number; gy: number } | null = null;
  for (let gy = c.gy - 4; gy < c.gy + 6 && !lugar; gy++) for (let gx = c.gx + 4; gx < c.gx + 9 && !lugar; gx++) if (podeConstruir(sim, 0, 'casa', gx, gy)) lugar = { gx, gy };
  assert.ok(lugar);
  const madeira = r.madeira;
  comandar(sim, 0, { t: 'construir', ids, tipo: 'casa', gx: lugar.gx, gy: lugar.gy });
  passo(sim);
  assert.equal(r.madeira, madeira - PREDIOS.casa.custo.madeira!);
  const casa = sim.predios.find((p) => p.tipo === 'casa' && p.dono === 0)!;
  assert.equal(casa.pronto, false);
  for (let i = 0; i < 400 && !casa.pronto; i++) passo(sim);
  assert.ok(casa.pronto, 'a casa não ficou pronta');
  // treinar um trabalhador gasta a comida; o quinto da fila sem comida não entra
  const comida = r.comida;
  comandar(sim, 0, { t: 'treinar', predio: c.id, unidade: 'trabalhador' });
  passo(sim);
  assert.equal(r.comida, comida - 50);
  r.comida = 0;
  comandar(sim, 0, { t: 'treinar', predio: c.id, unidade: 'trabalhador' });
  passo(sim);
  assert.equal(c.fila.length, 1);
  // o lanceiro não sai do centro, e a catapulta pede a era 2
  r.comida = r.madeira = r.ouro = 1000;
  comandar(sim, 0, { t: 'treinar', predio: c.id, unidade: 'lanceiro' });
  passo(sim);
  assert.equal(c.fila.length, 1);
  assert.equal(podeConstruir(sim, 0, 'maravilha', c.gx + 6, c.gy - 6), false);
  const n = meus(sim, 0, 'trabalhador').length;
  for (let i = 0; i < 120; i++) passo(sim);
  assert.equal(meus(sim, 0, 'trabalhador').length, n + 1);
});

/** Dois grupos iguais em custo, frente a frente, longe das bases: quem sobra? */
function duelo(a: TipoUnidade, b: TipoUnidade, n = 5): Dono | null {
  const sim = novaPartida(1);
  // tira tudo do caminho: um campo limpo no meio
  for (const u of [...sim.unidades]) u.vida = 0;
  passo(sim);
  const criar = (dono: Dono, tipo: TipoUnidade, x: number) => {
    for (let i = 0; i < n; i++) {
      const u = { ...meusModelo(sim), id: sim.proximoId++, tipo, dono, x, y: 18 + i * 0.6, ax: x, ay: 18 + i * 0.6 };
      u.vida = u.vidaMax = UNIDADES[tipo].vida;
      u.ordem = { tipo: 'parado' };
      sim.unidades.push(u);
      sim.porId.set(u.id, u);
    }
  };
  criar(0, a, 19);
  criar(1, b, 25);
  comandar(sim, 0, { t: 'mover', ids: meus(sim, 0).map((u) => u.id), x: 25, y: 19, atacando: true });
  comandar(sim, 1, { t: 'mover', ids: meus(sim, 1).map((u) => u.id), x: 19, y: 19, atacando: true });
  for (let i = 0; i < 1500; i++) {
    passo(sim);
    const vivos0 = meus(sim, 0).length;
    const vivos1 = meus(sim, 1).length;
    if (!vivos0 || !vivos1) return vivos0 ? 0 : vivos1 ? 1 : null;
  }
  return null;
}
function meusModelo(sim: Sim) {
  // uma unidade nova "de fábrica", copiada da forma das que a partida cria
  return {
    id: 0,
    tipo: 'lanceiro' as TipoUnidade,
    dono: 0 as Dono,
    x: 0,
    y: 0,
    ax: 0,
    ay: 0,
    rx: 1,
    ry: 0,
    vida: 1,
    vidaMax: 1,
    ordem: { tipo: 'parado' as const },
    caminho: [] as number[],
    achouEm: -99,
    recarga: 0,
    carga: null,
    trabalho: 0,
    acao: 'parado' as const,
    atacadoPor: 0,
    abrigado: 0,
    antesDoSino: null,
    _sim: sim.passo,
  };
}

test('pedra-papel-tesoura: lanceiro > cavaleiro > arqueiro > lanceiro', () => {
  assert.equal(duelo('lanceiro', 'cavaleiro'), 0, 'o lanceiro perdeu do cavaleiro');
  assert.equal(duelo('cavaleiro', 'arqueiro'), 0, 'o cavaleiro perdeu do arqueiro');
  assert.equal(duelo('arqueiro', 'lanceiro'), 0, 'o arqueiro perdeu do lanceiro');
  // e ao contrário
  assert.equal(duelo('cavaleiro', 'lanceiro'), 1);
  assert.equal(duelo('arqueiro', 'cavaleiro'), 1);
  assert.equal(duelo('lanceiro', 'arqueiro'), 1);
});

test('a catapulta derruba prédio depressa e não acerta quem está colado nela', () => {
  const d = UNIDADES.catapulta;
  assert.ok(d.contraPredio >= 8 * UNIDADES.lanceiro.contraPredio);
  assert.ok(d.alcanceMin > UNIDADES.lanceiro.alcance);
});

test('o computador cresce, avança de era e ataca; o piloto automático joga a partida até o fim', () => {
  const { sim, visto } = partida(7);
  assert.notEqual(sim.vencedor, null, 'a partida não acabou');
  assert.ok(sim.passo <= PASSOS_MAX);
  assert.ok(visto.quartel1, 'o computador não fez o quartel');
  assert.ok(visto.era[1], 'o computador não avançou de era');
  assert.ok(visto.exercito1 >= 6, `exército do computador: ${visto.exercito1}`);
  assert.ok(visto.ataques1 > 0, 'o computador não atacou a base');
  // o piloto ganha esta (semente 7), derrubando o centro
  assert.equal(sim.vencedor, 0);
  assert.equal(sim.motivo, 'centro');
  assert.ok(sim.passo >= 8 * 60 * 10, `ganhou cedo demais: ${sim.passo}`);
});

test('a Maravilha de pé por 2 minutos ganha a partida', () => {
  const sim = novaPartida(9);
  const j = sim.jogadores[0];
  j.era = 2;
  j.recursos = { comida: 5000, madeira: 5000, ouro: 5000 };
  // o dono 0 já viu o mapa todo, para poder construir longe do centro
  j.explorado.fill(1);
  let lugar: { gx: number; gy: number } | null = null;
  for (let gy = 26; gy < 40 && !lugar; gy++) for (let gx = 9; gx < 20 && !lugar; gx++) if (podeConstruir(sim, 0, 'maravilha', gx, gy)) lugar = { gx, gy };
  assert.ok(lugar);
  comandar(sim, 0, { t: 'construir', ids: meus(sim, 0, 'trabalhador').map((u) => u.id), tipo: 'maravilha', gx: lugar.gx, gy: lugar.gy });
  let pronta = false;
  for (let i = 0; i < 3000 && sim.vencedor === null; i++) {
    passo(sim);
    if (sim.eventos.some((e) => e.t === 'maravilha')) pronta = true;
  }
  assert.ok(pronta, 'a maravilha não ficou pronta');
  assert.equal(sim.vencedor, 0);
  assert.equal(sim.motivo, 'maravilha');
});

test('o ponto de reunião: quem nasce no prédio vai sozinho para lá, ou coleta a fonte marcada', () => {
  const sim = novaPartida(11);
  const centro = sim.predios.find((p) => p.dono === 0 && p.tipo === 'centro')!;
  sim.jogadores[0].recursos.comida = 1000;
  // de outro dono, nada muda
  comandar(sim, 1, { t: 'reuniao', predio: centro.id, x: 5, y: 5 });
  passo(sim);
  assert.equal(centro.reuniao, null);
  const fonte = sim.fontes.find((f) => f.tipo === 'arvore')!;
  comandar(sim, 0, { t: 'reuniao', predio: centro.id, x: fonte.gx + 0.5, y: fonte.gy + 0.5, alvo: fonte.id });
  comandar(sim, 0, { t: 'treinar', predio: centro.id, unidade: 'trabalhador' });
  let nasceu: number | null = null;
  for (let k = 0; k < UNIDADES.trabalhador.tempo + 5 && nasceu === null; k++) {
    passo(sim);
    for (const e of sim.eventos) if (e.t === 'treinou' && e.dono === 0) nasceu = e.id;
  }
  assert.ok(nasceu !== null, 'nasceu');
  const u = sim.unidades.find((x) => x.id === nasceu)!;
  assert.equal(u.ordem.tipo, 'coletar');
  assert.equal(u.ordem.alvo, fonte.id);
  // no chão: vai até o lugar
  comandar(sim, 0, { t: 'reuniao', predio: centro.id, x: centro.gx + 6.5, y: centro.gy + 1.5 });
  comandar(sim, 0, { t: 'treinar', predio: centro.id, unidade: 'trabalhador' });
  let outro: number | null = null;
  for (let k = 0; k < UNIDADES.trabalhador.tempo + 5 && outro === null; k++) {
    passo(sim);
    for (const e of sim.eventos) if (e.t === 'treinou' && e.dono === 0) outro = e.id;
  }
  const v = sim.unidades.find((x) => x.id === outro)!;
  assert.equal(v.ordem.tipo, 'mover');
  for (let k = 0; k < 120; k++) passo(sim);
  assert.ok(Math.hypot(v.x - (centro.gx + 6.5), v.y - (centro.gy + 1.5)) < 1.2, `chegou: ${v.x.toFixed(1)}, ${v.y.toFixed(1)}`);
});

/** Mais um trabalhador (ou outra unidade) do dono, copiado de um que a partida criou, parado em (x, y). */
function clonar(sim: Sim, dono: Dono, tipo: TipoUnidade, x: number, y: number) {
  const base = sim.unidades.find((u) => u.dono === dono)!;
  const u = { ...base, id: sim.proximoId++, tipo, x, y, ax: x, ay: y, ordem: { tipo: 'parado' as const }, caminho: [], carga: null, abrigado: 0, antesDoSino: null };
  u.vida = u.vidaMax = UNIDADES[tipo].vida;
  sim.unidades.push(u);
  sim.porId.set(u.id, u);
  return u;
}

/** Uma fazenda pronta do dono 0 ao lado do centro (construída de verdade, e terminada à mão). */
function fazendaPronta(sim: Sim, ids: number[], longe = 4) {
  const c = centroDe(sim, 0);
  sim.jogadores[0].recursos.madeira += 500;
  let lugar: { gx: number; gy: number } | null = null;
  for (let gy = c.gy - 5; gy < c.gy + 6 && !lugar; gy++) for (let gx = c.gx + longe; gx < c.gx + longe + 6 && !lugar; gx++) if (podeConstruir(sim, 0, 'fazenda', gx, gy)) lugar = { gx, gy };
  assert.ok(lugar, 'lugar da fazenda');
  comandar(sim, 0, { t: 'construir', ids, tipo: 'fazenda', gx: lugar.gx, gy: lugar.gy });
  passo(sim);
  const f = sim.predios.filter((p) => p.tipo === 'fazenda' && p.dono === 0).at(-1)!;
  f.progresso = PREDIOS.fazenda.tempo - 1;
  return f;
}

test('a capacidade: a fazenda é de um só trabalhador', () => {
  const sim = novaPartida(3);
  const ids = meus(sim, 0, 'trabalhador').map((u) => u.id);
  const f = fazendaPronta(sim, ids);
  for (let i = 0; i < 200 && !f.pronto; i++) passo(sim);
  assert.ok(f.pronto);
  passo(sim);
  const chave = lugarDeColeta(sim, f.id)!.chave;
  assert.equal(lugarDeColeta(sim, f.id)!.cap, CAPACIDADE.fazenda);
  // os três a construíram; só um ficou colhendo
  assert.equal(ocupantes(sim, 0, chave), 1);
  // os três mandados para ela: um só fica, e a tela é avisada de que estava cheia
  comandar(sim, 0, { t: 'alvo', ids, alvo: f.id });
  passo(sim);
  assert.equal(ocupantes(sim, 0, chave), 1);
  assert.ok(sim.eventos.some((e) => e.t === 'cheio' && e.dono === 0 && e.id === f.id), 'avisou que estava cheia');
  // com uma segunda fazenda perto, quem sobra vai a ela
  const g = fazendaPronta(sim, [ids[1]], 7);
  for (let i = 0; i < 200 && !g.pronto; i++) passo(sim);
  comandar(sim, 0, { t: 'alvo', ids, alvo: f.id });
  passo(sim);
  assert.equal(ocupantes(sim, 0, chave), 1);
  assert.equal(ocupantes(sim, 0, lugarDeColeta(sim, g.id)!.chave), 1);
  // e o computador (o outro dono) tem a vaga dele: a contagem é por dono
  assert.equal(ocupantes(sim, 1, chave), 0);
});

test('a capacidade: a mina é o bloco de ouro inteiro, com 5 vagas por dono', () => {
  const sim = novaPartida(3);
  const ouros = sim.fontes.filter((f) => f.tipo === 'ouro');
  // três minas: a de cada base (2 × 3 casas) e a do meio (2 × 2)
  const minas = new Map<number, number>();
  for (const f of ouros) minas.set(sim.minaDe.get(f.id)!, (minas.get(sim.minaDe.get(f.id)!) ?? 0) + 1);
  assert.deepEqual([...minas.values()].sort(), [4, 6, 6]);
  const casa = ouros.find((f) => f.gx === 13 && f.gy === 29)!;
  const lugar = lugarDeColeta(sim, casa.id)!;
  assert.equal(lugar.cap, CAPACIDADE.mina);
  const c = centroDe(sim, 0);
  while (meus(sim, 0, 'trabalhador').length < 8) clonar(sim, 0, 'trabalhador', c.gx + 4.5, c.gy + 1.5);
  const ids = meus(sim, 0, 'trabalhador').map((u) => u.id);
  comandar(sim, 0, { t: 'alvo', ids, alvo: casa.id });
  passo(sim);
  assert.equal(ocupantes(sim, 0, lugar.chave), 5);
  // os 3 que sobraram foram à mina do meio, a mais perto com vaga
  const meio = lugarDeColeta(sim, ouros.find((f) => f.gx === 21 && f.gy === 21)!.id)!;
  assert.equal(ocupantes(sim, 0, meio.chave), 3);
  // e trabalham de verdade: a mina de casa entrega ouro
  const ouro = sim.jogadores[0].recursos.ouro;
  for (let i = 0; i < 600; i++) passo(sim);
  assert.ok(sim.jogadores[0].recursos.ouro > ouro + 40, `ouro: ${sim.jogadores[0].recursos.ouro}`);
  assert.ok(ocupantes(sim, 0, lugar.chave) <= 5);
});

test('o sino: todos os trabalhadores se abrigam no centro, que atira mais; o segundo toque os devolve ao trabalho', () => {
  const rodar = () => {
    const sim = novaPartida(3);
    const c = centroDe(sim, 0);
    const arvore = sim.fontes.filter((f) => f.tipo === 'arvore').sort((p, q) => Math.abs(p.gx - 7) + Math.abs(p.gy - 35) - (Math.abs(q.gx - 7) + Math.abs(q.gy - 35)))[0];
    while (meus(sim, 0, 'trabalhador').length < 5) clonar(sim, 0, 'trabalhador', c.gx + 4.5, c.gy + 1.5);
    const ids = meus(sim, 0, 'trabalhador').map((u) => u.id);
    comandar(sim, 0, { t: 'alvo', ids, alvo: arvore.id });
    for (let i = 0; i < 150; i++) passo(sim);
    // de outro dono, nada
    comandar(sim, 1, { t: 'sino', predio: c.id });
    passo(sim);
    assert.equal(c.sino, false);
    comandar(sim, 0, { t: 'sino', predio: c.id });
    passo(sim);
    assert.equal(c.sino, true);
    assert.ok(sim.eventos.some((e) => e.t === 'sino' && e.tocado));
    for (let i = 0; i < 300 && meus(sim, 0, 'trabalhador').some((u) => !u.abrigado); i++) passo(sim);
    for (const u of meus(sim, 0, 'trabalhador')) {
      assert.equal(u.abrigado, c.id, 'abrigado');
      assert.equal(u.carga, null, 'a carga ficou no estoque');
    }
    // abrigado não recebe ordem
    comandar(sim, 0, { t: 'mover', ids, x: 20, y: 20 });
    passo(sim);
    assert.ok(meus(sim, 0, 'trabalhador').every((u) => u.abrigado === c.id));
    // três lanceiros do computador na porta: com 5 dentro, cada rajada sai com 1 + 2 flechas
    for (let k = 0; k < 3; k++) clonar(sim, 1, 'lanceiro', c.gx + 1.5 + k * 0.6, c.gy + 4.6);
    let rajada = 0;
    for (let i = 0; i < 40 && !rajada; i++) {
      passo(sim);
      rajada = sim.eventos.filter((e) => e.t === 'golpe' && e.de === c.id).length;
    }
    assert.equal(rajada, 1 + Math.min(FLECHAS_DO_SINO.max, Math.floor(5 / FLECHAS_DO_SINO.cada)));
    // e ninguém de fora acerta quem está dentro
    assert.ok(meus(sim, 0, 'trabalhador').every((u) => u.vida === u.vidaMax));
    for (const u of meus(sim, 1, 'lanceiro')) u.vida = 0;
    passo(sim);
    // o segundo toque: saem pela porta e voltam à árvore
    comandar(sim, 0, { t: 'sino', predio: c.id });
    passo(sim);
    assert.equal(c.sino, false);
    for (const u of meus(sim, 0, 'trabalhador')) {
      assert.equal(u.abrigado, 0);
      assert.equal(u.ordem.tipo, 'coletar', `ordem: ${u.ordem.tipo}`);
      assert.ok(u.x < c.gx || u.x > c.gx + 3 || u.y < c.gy || u.y > c.gy + 3, 'saiu do centro');
    }
    for (let i = 0; i < 300; i++) passo(sim);
    return assinatura(sim);
  };
  // determinístico (pronto para o lockstep): a mesma partida com o sino dá o mesmo resultado
  assert.equal(rodar(), rodar());
});
