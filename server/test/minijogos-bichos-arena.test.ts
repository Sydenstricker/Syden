/**
 * A ARENA DOS COELHOS (minijogo-arena.ts, a regra em arena/motor.ts): cada coelho anda no computador de quem joga e manda a
 * posição, que o servidor confere; quem bate anuncia o golpe e manda o acerto, e o servidor confere a recarga e o caminho da
 * bala pelo passado do alvo; quem apanha tem a folga (as zonas marcadas são decididas GRACA_MS depois). No fim, o piloto
 * automático do site (o MESMO cliente da tela) vence o robô do servidor de verdade, com 100 ms de internet em cada sentido.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-arena.js');
const { criarArena, criarArenaComBanco, montarTimes, equipeDaArena, PASSO_MS, GRACA_MS, KITS, PV, VIDAS, ARRANCADA, VEL, FORMATOS } = mod;
const site = await import('../../web/src/arena/regras.ts');
const { ESPECIES, eficacia } = await import('../src/bichos-regras.js');
const { pilotoAutomatico } = await import('../../web/src/arena/piloto.ts');
after(fechar);

const ler = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

let agora = 5_000_000;
const ana = await criarConta(app, 'ana-arena');
const bia = await criarConta(app, 'bia-arena');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da arena' })).json() as { id: number };

interface Lut {
  id: number;
  x: number;
  y: number;
  pv: number;
  vidas: number;
  estado: string;
  time: number;
  ativo: number;
  equipe: string[];
  especial: number;
  livreAte: number;
  invulAte: number;
  historia: { t: number; x: number; y: number }[];
}
interface Interno {
  _passo: () => void;
  _lutadores: Map<number, Lut>;
  _zonas: { bate: number }[];
  _suprimentos: { id: number; ponto: number; tipo: string }[];
  _motivo: () => string | null;
  _cenario: string;
}

function comecar(naSala = [anaId, biaId], corpo: Record<string, unknown> = { formato: '1x1', cenario: 'grama' }) {
  let terminou = false;
  const quadros: Record<string, unknown>[] = [];
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidade.id,
    solo: false,
    difundir: (d: unknown) => quadros.push(d as Record<string, unknown>),
  };
  let passo: (() => void) | null = null;
  const jogo = criarArenaComBanco({ agora: () => agora, aleatorio: () => 0.5, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala,
    criadaPor: naSala[0],
    corpo,
  });
  assert.ok(typeof jogo !== 'string');
  const i = jogo as unknown as Interno;
  return {
    jogo,
    i,
    quadros,
    terminou: () => terminou,
    andar(ms: number) {
      for (let t = 0; t < ms; t += PASSO_MS) {
        agora += PASSO_MS;
        passo!();
      }
    },
    disparar() {
      agora += relogio[0].ms;
      relogio[0].depois();
    },
    manda(id: number, d: Record<string, unknown>) {
      jogo.tempoReal!(id, d);
      return i._motivo();
    },
    l: (id: number) => i._lutadores.get(id)!,
    /** Põe a pessoa num lugar (o teste não espera o coelho andar até lá). */
    por(id: number, x: number, y: number) {
      i._lutadores.get(id)!.livreAte = agora + 1000;
      jogo.tempoReal!(id, { tipo: 'pos', x, y, mx: 1, my: 0, acao: 0, ta: 0 });
    },
  };
}
test('as contas são duas cópias iguais byte a byte (servidor e site)', () => {
  assert.equal(ler('../src/arena/conta.ts'), ler('../../web/src/arena/conta.ts'));
  assert.equal(ler('../src/bichos-regras.ts'), ler('../../web/src/bichos/regras.ts'));
  assert.equal(site.INVUL_VOLTA_MS, mod.INVUL_VOLTA_MS);
});

test('as contas: o leque são três balas de tamanho 1, a bala para na árvore, a zona fica no alcance', () => {
  const leque = mod.balasDoGolpe(1, 0, KITS.folha.s);
  assert.equal(leque.length, 3);
  for (const [dx, dy] of leque) assert.ok(Math.abs(Math.sqrt(dx * dx + dy * dy) - 1) < 1e-9);
  assert.equal(mod.balasDoGolpe(1, 0, KITS.folha.b).length, 1);
  // a árvore do meio da grama está em (640, 448): a bala que vai até ela para antes
  const livre = mod.alcanceLivre('grama', 500, 448, 1, 0, 300);
  assert.ok(livre > 100 && livre < 120, `parou em ${livre}`);
  assert.equal(mod.alcanceLivre('grama', 500, 200, 1, 0, 100), 100, 'sem nada no caminho, o alcance');
  assert.equal(mod.balaPassaPerto(0, 0, 1, 0, 0, 100, 50, 10, 12), true);
  assert.equal(mod.balaPassaPerto(0, 0, 1, 0, 0, 30, 50, 10, 12), false, 'ainda não chegou');
  const [zx, zy] = mod.alvoDaZona(300, 300, 900, 300, 170);
  assert.equal(Math.round(zx), 470);
  assert.equal(zy, 300);
  assert.equal(mod.fatorDaArena(2), 1.5);
  assert.equal(mod.fatorDaArena(0.5), 0.67);
  // nada atravessa a cerca nem a árvore
  const [x, y] = mod.andar('grama', 640 - 40, 448, 30, 0);
  assert.ok(Math.hypot(x - 640, y - 448) >= 30 + mod.RAIO - 0.01);
  assert.deepEqual(mod.naCerca(-50, 5000), [mod.BORDA + mod.RAIO, mod.MUNDO_H - mod.BORDA - mod.RAIO]);
});

test('os times: 1×1, 3×3 completado com robôs, cada um por si com 3 ou mais; a equipe sem aventura é a emprestada', () => {
  assert.deepEqual(montarTimes([1, 2, 3], '1x1', 0), [[1, 0], [2, 1]]);
  const t33 = montarTimes([1, 2, 3, 4], '3x3', 0);
  assert.equal(t33.length, 6);
  assert.equal(t33.filter(([, t]) => t === 0).length, 3);
  assert.equal(t33.filter(([id]) => id < 0).length, 2, 'dois robôs completam');
  assert.equal(montarTimes([1, 2], 'todos', 0).length, 3);
  assert.equal(montarTimes([1], 'todos', 1, 2).length, 2, 'no Solo, 1 robô é o 1×1');
  assert.equal(montarTimes([1], 'todos', 5, 2).length, 6);
  assert.deepEqual(new Set(montarTimes([1], 'todos', 5, 2).map(([, t]) => t)).size, 6);
  assert.deepEqual(equipeDaArena([]), ['brotel', 'tisco', 'bolhim']);
  assert.deepEqual(equipeDaArena(['zunzi', 'xyz', 'rochim', 'miasso', 'pruvi']), ['zunzi', 'rochim', 'miasso']);
  assert.deepEqual([...FORMATOS], ['1x1', '3x3', 'todos']);
});

test('o passo é do servidor: o quadro leva os coelhos, com a vida, as vidas e o time', () => {
  const m = comecar();
  m.andar(2000);
  const q = m.quadros.at(-1)! as { j: number[][]; f: string };
  assert.equal(q.f, 'lutando');
  assert.equal(q.j.length, 2);
  assert.equal(q.j[0][7], VIDAS);
  assert.equal(q.j[0][8], PV);
  assert.notEqual(q.j[0][10], q.j[1][10]);
  m.jogo.parar!();
});

test('a posição não anda mais que o coelho, nem atravessa a cerca; a arrancada tem crédito à parte e recarga', () => {
  const m = comecar();
  m.andar(1200);
  const a = m.l(anaId);
  const x = a.x;
  m.andar(100);
  assert.equal(m.manda(anaId, { tipo: 'pos', x: x + 200, y: a.y, mx: 1, my: 0, acao: 1, ta: 0 }), null);
  assert.ok(a.x - x < 45, `andou ${a.x - x}`);
  // sem crédito: a arrancada dá mais um tanto
  m.andar(100);
  const x2 = a.x;
  assert.equal(m.manda(anaId, { tipo: 'arrancada' }), null);
  assert.equal(m.manda(anaId, { tipo: 'arrancada' }), 'recarga', 'duas seguidas, não');
  m.manda(anaId, { tipo: 'pos', x: x2 + 200, y: a.y, mx: 1, my: 0, acao: 2, ta: 0 });
  const comArrancada = a.x - x2;
  assert.ok(comArrancada > (ARRANCADA.vel * ARRANCADA.ms) / 1000 && comArrancada < 120, `arrancou ${comArrancada}`);
  // a cerca
  m.por(anaId, 10, -40);
  assert.ok(a.x >= mod.BORDA && a.y >= mod.BORDA);
  void VEL;
  m.jogo.parar!();
});

test('o golpe: com número, na recarga, de perto de si; o acerto confere o caminho pelo passado do alvo', () => {
  const m = comecar();
  m.andar(2100); // passa a proteção do começo
  m.por(anaId, 300, 380);
  m.por(biaId, 450, 380);
  m.andar(200);
  const b = m.l(biaId);
  const kit = KITS[ESPECIES[m.l(anaId).equipe[0]].elemento];
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'b', x: 400, y: 380, dx: 1, dy: 0 }), 'longe de si');
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'x', x: 316, y: 380, dx: 1, dy: 0 }), 'tecla');
  // para cima: passa longe dela
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'b', x: 316, y: 380, dx: 0, dy: -1 }), null);
  m.andar(600);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1, k: 0, alvo: biaId }), 'longe do alvo');
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 2, tecla: 'b', x: 316, y: 380, dx: 1, dy: 0 }), null);
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 3, tecla: 'b', x: 316, y: 380, dx: 1, dy: 0 }), 'recarga', 'antes da recarga, não');
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, alvo: biaId }), 'longe do alvo', 'cedo demais');
  m.andar(450);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, alvo: biaId }), null);
  assert.ok(b.pv < PV && b.pv >= PV - kit.b.dano * 1.5, `vida ${b.pv}`);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, alvo: biaId }), 'bala usada', 'uma bala acerta uma vez');
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 1, alvo: biaId }), 'bala', 'o básico não tem leque');
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 2, tecla: 'b', x: 316, y: 380, dx: 1, dy: 0 }), 'número', 'o mesmo número não sai duas vezes');
  // o especial só cheio
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 10, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0, ax: 450, ay: 380 }), 'recarga');
  m.jogo.parar!();
});

test('o acerto que não bate no passado do alvo é recusado, mesmo com a bala no caminho de agora', () => {
  const m = comecar();
  m.andar(2100);
  m.por(anaId, 300, 380);
  m.por(biaId, 450, 600); // longe do caminho
  m.andar(1000);
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'b', x: 316, y: 380, dx: 1, dy: 0 }), null);
  m.andar(500);
  // ela "teleporta" para o caminho agora: o passado dela não estava lá
  m.l(biaId).x = 450;
  m.l(biaId).y = 380;
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1, k: 0, alvo: biaId }), 'longe do alvo');
  m.jogo.parar!();
});

test('quem apanha tem folga: o golpe forte é marcado, e só é decidido GRACA_MS depois de bater; quem saiu escapa', () => {
  for (const sai of [false, true]) {
    const m = comecar();
    m.andar(2100);
    m.por(anaId, 300, 380);
    m.por(biaId, 420, 380);
    m.andar(300);
    const b = m.l(biaId);
    const g = KITS.folha.q;
    assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'q', x: 316, y: 380, dx: 1, dy: 0, ax: 420, ay: 380 }), null);
    assert.equal(m.manda(anaId, { tipo: 'golpe', n: 2, tecla: 'q', x: 316, y: 380, dx: 1, dy: 0, ax: 420, ay: 380 }), 'recarga');
    assert.equal(m.i._zonas.length, 1, 'a marca no chão');
    // até bater e um pouco depois, ela continua no lugar (ou sai na última hora, dentro da folga)
    for (let t = 0; t < g.aviso + GRACA_MS - 50; t += PASSO_MS) {
      const x = sai && t >= g.aviso - 50 ? 420 + Math.min(80, (t - g.aviso + 100) * 0.7) : 420;
      m.manda(biaId, { tipo: 'pos', x, y: 380, mx: 1, my: 0, acao: 0, ta: 0 });
      m.andar(PASSO_MS);
      if (t === g.aviso - 100) assert.equal(b.pv, PV, 'ainda não bateu');
    }
    m.andar(200);
    if (sai) assert.equal(b.pv, PV, 'saiu da marca dentro da folga: escapou');
    else assert.ok(b.pv < PV, 'ficou: levou');
    m.jogo.parar!();
  }
});

test('a roda: em volta de quem bate, na hora; e o suprimento só de perto', () => {
  const m = comecar();
  m.andar(2100);
  const a = m.l(anaId);
  a.equipe = ['tisco', 'brotel', 'bolhim'];
  a.ativo = 0;
  m.por(anaId, 300, 380);
  m.por(biaId, 340, 380);
  m.andar(200);
  const b = m.l(biaId);
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 's', x: 316, y: 380, dx: 1, dy: 0 }), null);
  assert.ok(b.pv < PV, 'a roda de brasa pegou');
  // trocar o bicho: com recarga
  assert.equal(m.manda(anaId, { tipo: 'trocar', i: 1 }), null);
  assert.equal(a.ativo, 1);
  assert.equal(m.manda(anaId, { tipo: 'trocar', i: 2 }), 'recarga');
  assert.equal(m.manda(anaId, { tipo: 'trocar', i: 9 }), 'bicho');
  // o primeiro suprimento cai
  m.andar(mod.SUPRIMENTO_PRIMEIRO);
  const s = m.i._suprimentos[0];
  assert.ok(s, 'caiu um suprimento');
  const [px, py] = mod.PONTOS_DE_SUPRIMENTO[s.ponto];
  assert.equal(m.manda(anaId, { tipo: 'pegar', id: s.id }), 'longe do suprimento');
  m.por(anaId, px + 10, py);
  assert.equal(m.manda(anaId, { tipo: 'pegar', id: s.id }), null);
  assert.equal(m.i._suprimentos.length, 0);
  m.jogo.parar!();
});

test('a vantagem do elemento: a gota vale mais contra a brasa', () => {
  const m = comecar();
  m.andar(2100);
  m.l(anaId).equipe = ['bolhim', 'brotel', 'tisco'];
  m.l(biaId).equipe = ['tisco', 'brotel', 'bolhim'];
  m.por(anaId, 300, 380);
  m.por(biaId, 420, 380);
  m.andar(300);
  m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'b', x: 316, y: 380, dx: 1, dy: 0 });
  m.andar(450);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1, k: 0, alvo: biaId }), null);
  assert.equal(m.l(biaId).pv, PV - Math.round(KITS.gota.b.dano * 1.5));
  m.jogo.parar!();
});

test('ninguém da turma na sala: a partida acaba, sem troféu', () => {
  const sala = [anaId, biaId];
  const m = comecar(sala);
  m.andar(500);
  sala.length = 0;
  m.andar(100);
  assert.equal((m.jogo.publico(anaId) as { fase: string }).fase, 'vitoria');
  m.disparar();
  assert.equal(m.terminou(), true);
});

/**
 * A partida inteira: o servidor de verdade num relógio de mão, cada pessoa com o cliente da tela e o piloto, e a rede com IDA ms
 * em cada sentido.
 */
async function partida(ids: number[], corpo: Record<string, unknown>, IDA = 100, sementeInicial = 7) {
  let semente = sementeInicial;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  let t0 = 9_000_000;
  let passo: (() => void) | null = null;
  let fim: (() => void) | null = null;
  let terminou = false;
  const trofeus: { userId: number; posicao: number; pista: string }[] = [];
  const rede: { em: number; para: number; de: number; dados: unknown }[] = [];
  const solo = ids.length === 1;
  const ctx = {
    agendar: (_ms: number, depois: () => void) => {
      fim = depois;
    },
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => ids,
    nome: (id: number) => `p${id}`,
    comunidade: solo ? 0 : 5,
    solo,
    difundir: (d: unknown) => {
      for (const id of ids) rede.push({ em: t0 + IDA, para: id, de: 0, dados: d });
    },
  };
  const jogo = criarArena({
    agora: () => t0,
    aleatorio,
    intervalo: (p) => ((passo = p), 1),
    limpar: () => {},
    servicos: { avatarDe: () => null, equipeDe: () => [], guardarTrofeu: (t) => trofeus.push(t) },
  }).comecar(ctx, { naSala: ids, criadaPor: ids[0], corpo });
  assert.ok(typeof jogo !== 'string');
  const pub = jogo.publico(ids[0]) as { cenario: 'grama' | 'praia'; jogadores: { userId: number; equipe: string[] }[] };
  const equipes = new Map(pub.jogadores.map((j) => [j.userId, j.equipe]));
  const clientes = ids.map((id) => ({ c: new site.Cliente(id, pub.cenario, equipes, (dados: unknown) => rede.push({ em: t0 + IDA, para: 0, de: id, dados })), cmd: site.comandosVazios() }));
  let ultimo: import('../../web/src/arena/regras.ts').Quadro | null = null;
  let k = 0;
  const inicio = t0;
  for (let ms = 0; ms < 5 * 60_000 && !terminou; ms += 1000 / 60) {
    t0 += 1000 / 60;
    if (++k % 3 === 0) passo!();
    for (let i = 0; i < rede.length; ) {
      const r = rede[i];
      if (r.em > t0) {
        i++;
        continue;
      }
      rede.splice(i, 1);
      if (r.para === 0) jogo.tempoReal!(r.de, r.dados);
      else {
        clientes[ids.indexOf(r.para)].c.chegou(r.dados as never, t0);
        ultimo = r.dados as typeof ultimo;
      }
    }
    for (const { c, cmd } of clientes) {
      const v = c.vista(t0);
      if (c.jogando()) pilotoAutomatico(c, v, cmd, t0);
      c.passo(cmd, 1 / 60, t0, v);
    }
    if (ultimo && ultimo.f !== 'lutando' && fim) {
      fim();
      break;
    }
  }
  return { ultimo: ultimo!, publico: jogo.publico(ids[0]) as Record<string, unknown>, segundos: (t0 - inicio) / 1000, trofeus };
}

test('no Solo 1×1, com 200 ms de ida e volta, o piloto vence o robô do servidor', async (t) => {
  let vitorias = 0;
  for (const s of [7, 11, 19]) {
    const { ultimo, publico, segundos, trofeus } = await partida([7], { robos: 1, cenario: 'grama' }, 100, s);
    const eu = ultimo.j.find((l) => l[0] === 7)!;
    const robo = ultimo.j.find((l) => l[0] < 0)!;
    t.diagnostic(`semente ${s}: ${Math.round(segundos)} s; eu vidas ${eu[7]} vida ${eu[8]}; robô vidas ${robo[7]}; vencedor ${publico.vencedor}`);
    if (publico.vencedor === eu[10]) vitorias++;
    assert.equal(trofeus.length, 0, 'no Solo, sem troféu');
    assert.ok(segundos < 4 * 60 + 5, 'a partida acaba');
  }
  assert.ok(vitorias >= 2, `venceu ${vitorias} de 3`);
});

test('na sala, 1×1 entre duas pessoas (dois pilotos): a partida acaba e quem venceu vai à estante', async (t) => {
  const { publico, segundos, trofeus } = await partida([21, 22], { formato: '1x1', cenario: 'praia' }, 100, 5);
  t.diagnostic(`${Math.round(segundos)} s; vencedor ${publico.vencedor}`);
  const r = publico.resultado as { userId: number; posicao: number; dano: number }[];
  assert.ok(r.every((l) => l.dano > 0), 'os dois acertaram');
  if (publico.vencedor !== null) {
    assert.equal(trofeus.length, 1);
    assert.equal(trofeus[0].pista, 'bichos-arena');
    assert.equal(trofeus[0].posicao, 1);
  }
});

test('o 3×3 com robôs e o cada um por si do Solo terminam', async (t) => {
  const a = await partida([31, 32], { formato: '3x3', cenario: 'grama' }, 100, 3);
  t.diagnostic(`3×3: ${Math.round(a.segundos)} s; vencedor ${a.publico.vencedor}`);
  assert.equal((a.publico.jogadores as unknown[]).length, 6);
  const b = await partida([41], { robos: 3, formato: 'todos', cenario: 'praia' }, 100, 9);
  t.diagnostic(`cada um por si: ${Math.round(b.segundos)} s; vencedor ${b.publico.vencedor}`);
  assert.equal((b.publico.jogadores as unknown[]).length, 4);
  assert.ok(b.segundos < 4 * 60 + 5);
});

// ---------------------------------------------------------------- 19/11/2026: kits próprios, números do fim, chãos novos, a zona
test('o forte e o especial de cada elemento: o servidor confere a forma de cada um (a roda da brasa, o leque do vento)', () => {
  const m = comecar();
  m.andar(2100);
  const a = m.l(anaId);
  // a brasa: o especial é a roda grande, em volta de quem bate, só com o especial cheio
  a.equipe = ['tisco', 'zunzi', 'brotel'];
  a.ativo = 0;
  m.por(anaId, 300, 380);
  m.por(biaId, 380, 380);
  m.andar(200);
  const b = m.l(biaId);
  // ela com um bicho de faísca (neutro para a brasa)
  b.equipe = ['miasso', 'miasso', 'miasso'];
  const vale = (el: string, dano: number) => Math.max(1, Math.round(dano * mod.fatorDaArena(eficacia(el as never, 'faisca'))));
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0 }), 'recarga', 'vazio, não');
  (a as unknown as { especial: number }).especial = mod.ESPECIAL_MAX;
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0 }), null);
  assert.equal(b.pv, PV - vale('brasa', KITS.brasa.e.dano), 'a roda da brasa (80 px) pegou quem estava a 80 px');
  assert.equal(m.i._zonas.length, 0, 'e não marca nada no chão');
  // o vento: o especial é um leque de três; o acerto da bala do lado é conferido pelo caminho dela
  const pv = b.pv;
  assert.equal(m.manda(anaId, { tipo: 'trocar', i: 1 }), null);
  (a as unknown as { especial: number }).especial = mod.ESPECIAL_MAX;
  m.andar(300);
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 2, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0 }), null);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 3, alvo: biaId }), 'bala', 'o leque tem três balas');
  m.andar(250);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, alvo: biaId }), null);
  assert.equal(b.pv, pv - vale('vento', KITS.vento.e.dano));
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, alvo: biaId }), 'bala usada');
  m.jogo.parar!();
});

test('os números do fim: o dano causado, o levado e os desvios de quem saiu da marca', () => {
  const m = comecar();
  m.andar(2100);
  m.por(anaId, 300, 380);
  m.por(biaId, 420, 380);
  m.andar(300);
  const g = KITS.folha.q;
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'q', x: 316, y: 380, dx: 1, dy: 0, ax: 420, ay: 380 }), null);
  // ela estava dentro e sai antes de bater
  for (let t = 0; t < g.aviso + GRACA_MS + 100; t += PASSO_MS) {
    m.manda(biaId, { tipo: 'pos', x: t > g.aviso / 2 ? 520 : 420, y: 380, mx: 1, my: 0, acao: 0, ta: 0 });
    m.andar(PASSO_MS);
  }
  const b = m.l(biaId) as unknown as { desvios: number; levou: number; pv: number };
  assert.equal(b.pv, PV);
  assert.equal(b.desvios, 1, 'um desvio');
  // agora um básico que acerta: conta o dano dos dois lados
  m.por(biaId, 450, 380);
  m.andar(800);
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 2, tecla: 'b', x: 316, y: 380, dx: 1, dy: 0 }), null);
  m.andar(500);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, alvo: biaId }), null);
  assert.ok(b.levou > 0);
  assert.equal((m.l(anaId) as unknown as { dano: number }).dano, b.levou);
  m.jogo.parar!();
});

test('segurar a zona: um ponto por segundo para quem está sozinho no meio, ninguém fica sem vidas, e quem chega ao fim vence', () => {
  const m = comecar([anaId, biaId], { formato: '1x1', cenario: 'grama', objetivo: 'zona' });
  assert.equal((m.jogo.publico(anaId) as { objetivo: string }).objetivo, 'zona');
  m.andar(2100);
  const z = mod.ZONA_DO_OBJETIVO;
  // fora da árvore do meio (o tiro do teste não pode bater nela)
  m.por(anaId, z.x - 60, z.y + 70);
  m.por(biaId, 200, 200);
  // os dois dentro: disputada, ninguém pontua
  m.andar(3000);
  const q = () => m.quadros.at(-1) as { o?: number[][]; od?: number };
  const pontosDe = (time: number) => q().o?.find(([t]) => t === time)?.[1] ?? 0;
  assert.ok(pontosDe(0) >= 2, `a ana sozinha pontua (${pontosDe(0)})`);
  assert.equal(q().od, 0);
  m.por(biaId, z.x + 60, z.y + 70);
  const antes = pontosDe(0);
  m.andar(2000);
  assert.equal(pontosDe(0), antes, 'disputada: ninguém pontua');
  assert.equal(q().od, -1);
  // quem cai volta, sem perder vida
  const b = m.l(biaId);
  b.pv = 1;
  m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'b', x: z.x - 44, y: z.y + 70, dx: 1, dy: 0 });
  m.andar(400);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1, k: 0, alvo: biaId }), null);
  assert.equal(b.vidas, VIDAS, 'segurando a zona, ninguém perde vida');
  // a ana fica sozinha até o fim (sem levar as marcas da arena no caminho)
  m.l(anaId).invulAte = Infinity;
  m.por(biaId, 200, 200);
  m.andar((mod.PONTOS_DA_ZONA + 5) * 1000);
  assert.equal((m.jogo.publico(anaId) as { vencedor: number }).vencedor, m.l(anaId).time);
  m.disparar();
  const r = (m.jogo.publico(anaId) as { resultado: { userId: number; pontos: number }[] }).resultado;
  assert.equal(r.find((x) => x.userId === anaId)!.pontos, mod.PONTOS_DA_ZONA);
  m.jogo.parar!();
});

test('os chãos novos: na lama a poça segura o robô, no gelo ele escorrega, e as partidas terminam', () => {
  for (const cenario of ['gelo', 'lama'] as const) {
    const m = comecar([anaId], { formato: 'todos', cenario, robos: 2 });
    assert.equal(m.i._cenario, cenario);
    const robos = [...m.i._lutadores.values()].filter((l) => l.id < 0);
    const antes = robos.map((l) => [l.x, l.y]);
    m.andar(3000);
    assert.ok(robos.some((l, k) => Math.hypot(l.x - antes[k][0], l.y - antes[k][1]) > 20), `${cenario}: os robôs andam`);
    m.jogo.parar!();
  }
  // a conta do chão é a mesma do site (as duas cópias de conta.ts)
  const [px, py] = mod.POCAS_DE_LAMA[0];
  assert.equal(mod.velDoChao('lama', px, py), mod.LAMA_SEGURA);
});
