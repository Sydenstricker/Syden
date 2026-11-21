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
  /** O quadro de cada um (o mato: cada time recebe o seu), e o último `fazer`, para pedir o de quem só assiste. */
  const dele = new Map<number, Record<string, unknown>>();
  let fazer: ((quem: number) => unknown) | null = null;
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
    difundirPorPessoa: (f: (quem: number) => unknown) => {
      fazer = f;
      quadros.push(f(naSala[0]) as Record<string, unknown>);
      for (const id of naSala) dele.set(id, f(id) as Record<string, unknown>);
    },
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
    /** A linha de `alvo` no último quadro que `quem` recebeu (null: quem só assiste). */
    linha(quem: number | null, alvo: number) {
      const q = (quem !== null && dele.has(quem) ? dele.get(quem) : fazer!(quem ?? -12345)) as { j: number[][] };
      return q.j.find((l) => l[0] === alvo)!;
    },
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
    // o mato: cada um recebe o quadro do time dele
    difundirPorPessoa: (fazer: (quem: number) => unknown) => {
      for (const id of ids) rede.push({ em: t0 + IDA, para: id, de: 0, dados: fazer(id) });
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

// ---------------------------------------------------------------- 20/11/2026: o mato que esconde
test('o mato: as moitas são simétricas e longe de onde se nasce, dos suprimentos e da zona do meio', () => {
  for (const cenario of mod.CENARIOS) {
    const moitas = mod.MATO[cenario];
    assert.ok(moitas.length >= 4, cenario);
    moitas.forEach(([x, y, r], k) => {
      assert.ok(moitas.some(([a, b, rr]) => a === mod.MUNDO_W - x && b === mod.MUNDO_H - y && rr === r), `${cenario}: a moita (${x}, ${y}) tem a do outro lado`);
      for (const [a, b] of [...mod.NASCER_TIME.flat(), ...mod.NASCER_TODOS, ...mod.PONTOS_DE_SUPRIMENTO]) assert.ok(Math.hypot(a - x, b - y) > r + 30, `${cenario}: a moita (${x}, ${y}) longe de (${a}, ${b})`);
      const z = mod.ZONA_DO_OBJETIVO;
      assert.ok(Math.hypot(z.x - x, z.y - y) > z.raio + r, `${cenario}: fora da zona do meio`);
      assert.equal(mod.moitaEm(cenario, x, y), k);
    });
  }
  assert.equal(mod.moitaEm('grama', 640, 448), -1);
});

test('o mato esconde: o adversário NÃO recebe a posição de quem está escondido; a própria pessoa recebe', () => {
  const [mx, my] = mod.MATO.grama[0];
  const m = comecar();
  m.andar(2100);
  m.por(anaId, mx, my);
  m.por(biaId, 600, 700);
  m.andar(200);
  const paraBia = m.linha(biaId, anaId);
  assert.equal(paraBia[17], 1, 'escondida');
  assert.deepEqual(paraBia.slice(1, 7), [0, 0, 0, 0, 0, 0], 'sem posição, mira nem ação');
  assert.equal(paraBia[8], PV, 'a vida continua (o placar)');
  const paraAna = m.linha(anaId, anaId);
  assert.equal(paraAna[17], 0);
  assert.equal(paraAna[1], mx, 'ela se vê');
  assert.equal(m.linha(null, anaId)[17], 1, 'quem só assiste também não vê');
  assert.equal(m.linha(anaId, biaId)[17], 0, 'a bia, fora do mato, a ana vê');
  m.jogo.parar!();
});

test('o mato: no 3×3 o aliado vê quem está escondido, e o adversário não', () => {
  const [mx, my] = mod.MATO.grama[0];
  const m = comecar([anaId, biaId], { formato: '3x3', cenario: 'grama' });
  m.andar(2100);
  const a = m.l(anaId);
  assert.notEqual(m.l(biaId).time, a.time);
  const aliado = [...m.i._lutadores.values()].find((l) => l.time === a.time && l.id !== anaId)!;
  m.por(anaId, mx, my);
  m.andar(PASSO_MS);
  assert.equal(m.linha(aliado.id, anaId)[17], 0, 'o aliado vê');
  assert.equal(m.linha(aliado.id, anaId)[1], mx);
  // ninguém do outro time chegou perto (nasceram do outro lado)
  assert.ok([...m.i._lutadores.values()].filter((l) => l.time !== a.time).every((l) => Math.hypot(l.x - mx, l.y - my) > mod.PERTO_REVELA));
  assert.equal(m.linha(biaId, anaId)[17], 1, 'o adversário não vê');
  m.jogo.parar!();
});

test('o mato revela: com o adversário perto, na mesma moita, ou depois de golpear (por REVELADO_MS)', () => {
  const [mx, my, mr] = mod.MATO.grama[0];
  const m = comecar();
  m.andar(2100);
  m.por(anaId, mx, my);
  m.por(biaId, mx + mod.PERTO_REVELA - 10, my);
  m.andar(PASSO_MS);
  assert.equal(m.linha(biaId, anaId)[17], 0, 'perto: vê');
  assert.equal(m.linha(biaId, anaId)[1], mx);
  // as duas na mesma moita, a mais de PERTO_REVELA uma da outra
  assert.ok(2 * mr - 8 > mod.PERTO_REVELA);
  m.por(anaId, mx - mr + 4, my);
  m.por(biaId, mx + mr - 4, my);
  m.andar(PASSO_MS);
  assert.equal(m.linha(biaId, anaId)[17], 0, 'na mesma moita: vê');
  assert.equal(m.linha(anaId, biaId)[17], 0, 'e é vista');
  // longe outra vez: some
  m.por(anaId, mx, my);
  m.por(biaId, 600, 700);
  m.andar(PASSO_MS);
  assert.equal(m.linha(biaId, anaId)[17], 1);
  // golpear (para cima, longe dela) revela por um instante
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'b', x: mx, y: my - 16, dx: 0, dy: -1 }), null);
  m.andar(PASSO_MS);
  assert.equal(m.linha(biaId, anaId)[17], 0, 'golpeou: aparece');
  assert.equal(m.linha(biaId, anaId)[1], mx);
  m.andar(mod.REVELADO_MS);
  assert.equal(m.linha(biaId, anaId)[17], 1, 'passou: some de novo');
  m.jogo.parar!();
});

test('o mato: a bala de quem não vê acerta mesmo assim (o servidor confere), e quem leva aparece', () => {
  const [mx, my] = mod.MATO.grama[0];
  const m = comecar();
  m.andar(2100);
  m.por(anaId, mx, my);
  m.por(biaId, mx + 150, my);
  m.andar(PASSO_MS);
  assert.equal(m.linha(biaId, anaId)[17], 1);
  const a = m.l(anaId);
  // a bia atira às cegas no mato; a tela dela nunca manda o acerto
  assert.equal(m.manda(biaId, { tipo: 'golpe', n: 1, tecla: 'b', x: mx + 134, y: my, dx: -1, dy: 0 }), null);
  m.andar(900);
  assert.ok(a.pv < PV, `levou (${a.pv})`);
  assert.equal(m.linha(biaId, anaId)[17], 0, 'quem leva um golpe aparece');
  assert.equal(m.manda(biaId, { tipo: 'acerto', n: 1, k: 0, alvo: anaId }), 'bala usada', 'a bala acerta uma vez só');
  m.jogo.parar!();
});

test('o mato: o robô não mira em quem está escondido, e mira quando ela sai', () => {
  const [mx, my] = mod.MATO.grama[0];
  const m = comecar([anaId], { formato: 'todos', cenario: 'grama', robos: 1 });
  const [robo, outro] = [...m.i._lutadores.values()].filter((l) => l.id < 0) as unknown as { x: number; y: number; ultimoTiro: number; estado: string; ia: { alvo: number | null } }[];
  // fora da sala do teste, cada um por si pede 3: o outro robô fica de fora, para a ana ser a única à vista
  outro.estado = 'sem-vidas';
  m.por(anaId, mx, my);
  for (let k = 0; k < 80; k++) {
    m.manda(anaId, { tipo: 'pos', x: mx, y: my, mx: 1, my: 0, acao: 0, ta: 0 });
    m.andar(PASSO_MS);
    if (Math.hypot(robo.x - mx, robo.y - my) < mod.PERTO_REVELA + 20) break;
    assert.notEqual(robo.ia.alvo, anaId, 'escondida: não é o alvo');
  }
  assert.equal(robo.ultimoTiro, 0, 'nem um golpe');
  assert.equal(m.l(anaId).pv, PV);
  // fora do mato, o robô a vê
  m.por(anaId, 640, 300);
  m.andar(800);
  assert.equal(robo.ia.alvo, anaId);
  m.jogo.parar!();
});

// ---------------------------------------------------------------- 20/11/2026: o fim com pressão, a dificuldade e as vitórias seguidas
/** Uma partida do Solo com o relógio de mão e o banco de mentira (o recorde vai para `recordes`). */
function soloDeMao(corpo: Record<string, unknown>, recordes: Map<string, number>) {
  let t0 = 7_000_000;
  let passo: (() => void) | null = null;
  let fim: (() => void) | null = null;
  const ctx = {
    agendar: (_ms: number, depois: () => void) => (fim = depois),
    avisar: () => {},
    terminar: () => {},
    naSala: () => [70],
    nome: () => 'eu',
    comunidade: 0,
    solo: true,
    difundirPorPessoa: () => {},
  };
  const jogo = criarArena({
    agora: () => t0,
    aleatorio: () => 0.5,
    intervalo: (p) => ((passo = p), 1),
    limpar: () => {},
    servicos: {
      avatarDe: () => null,
      equipeDe: () => [],
      guardarTrofeu: () => {},
      recordeDoSolo: (_u, v) => recordes.get(v) ?? null,
      guardarRecorde: (_u, v, valor) => {
        const antes = recordes.get(v) ?? null;
        if (antes !== null && antes >= valor) return { antes, novo: false };
        recordes.set(v, valor);
        return { antes, novo: true };
      },
    },
  }).comecar(ctx, { naSala: [70], criadaPor: 70, corpo });
  assert.ok(typeof jogo !== 'string');
  const i = jogo as unknown as Interno & { _lutadores: Map<number, Lut & { dif: string }> };
  return {
    jogo,
    i,
    andar(ms: number) {
      for (let t = 0; t < ms; t += PASSO_MS) {
        t0 += PASSO_MS;
        passo!();
      }
    },
    /** Acaba a partida: quem perde fica sem vidas, e o "Vitória!" passa. */
    acabar(venci: boolean) {
      for (const l of i._lutadores.values()) if (venci ? l.id !== 70 : l.id === 70) Object.assign(l, { estado: 'sem-vidas', vidas: 0 });
      t0 += PASSO_MS;
      passo!();
      fim!();
      return jogo.publico(70) as { sequencia: { atual: number; recorde: number | null; novo: boolean }; dificuldade: string; fase: string };
    },
  };
}

test('o fim com pressão: no último minuto, as zonas da arena vêm a cada 3,5 s e maiores', () => {
  const m = soloDeMao({ robos: 1, cenario: 'grama' }, new Map());
  // ninguém cai (para a partida chegar ao último minuto)
  for (const l of m.i._lutadores.values()) l.invulAte = Infinity;
  const marcadas = () => (m.i._zonas as unknown as { id: number; raio: number; bate: number; dono: number }[]).filter((z) => z.dono === 0);
  const vistas = new Map<number, { raio: number; bate: number }>();
  const anotar = () => {
    for (const z of marcadas()) vistas.set(z.id, { raio: z.raio, bate: z.bate });
  };
  for (let s = 0; s < (mod.PARTIDA_MS - mod.ZONA_FINAL.falta) / 1000 - 1; s++) {
    m.andar(1000);
    anotar();
  }
  const antes = [...vistas.values()];
  assert.ok(antes.length >= 20 && antes.every((z) => z.raio === mod.ZONA.raio), `antes do último minuto, as de sempre (${antes.length})`);
  vistas.clear();
  for (let s = 0; s < 30; s++) {
    m.andar(1000);
    anotar();
  }
  const finais = [...vistas.values()].sort((a, b) => a.bate - b.bate);
  assert.ok(finais.length >= 8, `em 30 s do último minuto, ${finais.length} zonas (a cada 3,5 s)`);
  assert.ok(finais.every((z) => z.raio === mod.ZONA_FINAL.raio && z.raio > mod.ZONA.raio), 'maiores');
  for (let k = 1; k < finais.length; k++) assert.ok(finais[k].bate - finais[k - 1].bate <= mod.ZONA_FINAL.cada + PASSO_MS, 'a cada 3,5 s');
});

test('a dificuldade do Solo: só para os robôs adversários, e a sala fica no médio', () => {
  const m = soloDeMao({ robos: 2, cenario: 'grama', dificuldade: 'dificil' }, new Map());
  const robos = [...m.i._lutadores.values()].filter((l) => l.id < 0);
  assert.ok(robos.length === 2 && robos.every((l) => l.dif === 'dificil'));
  assert.equal((m.jogo.publico(70) as { dificuldade: string }).dificuldade, 'dificil');
  // no 3×3 do Solo, os aliados ficam no médio
  const tres = soloDeMao({ formato: '3x3', robos: 5, cenario: 'grama', dificuldade: 'facil' }, new Map());
  const eu = tres.i._lutadores.get(70)!;
  for (const l of tres.i._lutadores.values()) if (l.id < 0) assert.equal(l.dif, l.time === eu.time ? 'medio' : 'facil');
  // valor que não existe: o médio
  assert.ok([...soloDeMao({ robos: 1, dificuldade: 'impossivel' }, new Map()).i._lutadores.values()].every((l) => l.dif === 'medio'));
  // na sala, nada de dificuldade nem de sequência
  const sala = comecar([anaId, biaId], { formato: '3x3', cenario: 'grama', dificuldade: 'dificil' });
  assert.ok([...(sala.i._lutadores as Map<number, Lut & { dif?: string }>).values()].every((l) => l.dif === 'medio'));
  const pub = sala.jogo.publico(anaId) as Record<string, unknown>;
  assert.equal(pub.sequencia, undefined);
  assert.equal(pub.dificuldade, undefined);
});

test('as vitórias seguidas do Solo: vencer soma, perder zera, o recorde é a maior (por dificuldade e adversários), contado pelo servidor', () => {
  mod._sequenciasDaArena.clear();
  const recordes = new Map<string, number>();
  const jogar = (venci: boolean, corpo: Record<string, unknown> = { robos: 1, dificuldade: 'dificil' }) => soloDeMao(corpo, recordes).acabar(venci);
  let p = jogar(true);
  assert.equal(p.fase, 'fim');
  assert.deepEqual(p.sequencia, { atual: 1, recorde: 1, novo: true });
  p = jogar(true);
  assert.deepEqual(p.sequencia, { atual: 2, recorde: 2, novo: true });
  assert.equal(recordes.get('dificil:1'), 2);
  // outra dificuldade, outra sequência
  assert.deepEqual(jogar(true, { robos: 1, dificuldade: 'facil' }).sequencia, { atual: 1, recorde: 1, novo: true });
  // perder zera, e o recorde fica
  p = jogar(false);
  assert.equal(p.sequencia.atual, 0);
  assert.equal(p.sequencia.recorde, 2);
  assert.equal(recordes.get('dificil:1'), 2);
  p = jogar(true);
  assert.deepEqual(p.sequencia, { atual: 1, recorde: 2, novo: false });
  // a sequência é da sessão: 30 minutos parada, recomeça
  for (const v of mod._sequenciasDaArena.values()) v.em -= mod.SESSAO_DA_ARENA_MS + 1000;
  const nova = soloDeMao({ robos: 1, dificuldade: 'dificil' }, recordes);
  assert.equal((nova.jogo.publico(70) as { sequencia: { atual: number } }).sequencia.atual, 0);
});

test('a dificuldade, medida contra o piloto (3 robôs, cada um por si): mais vida sobra no fácil que no difícil', async (t) => {
  const medir = async (dificuldade: string) => {
    let vitorias = 0;
    let sobra = 0;
    for (const s of [14, 27, 40, 53]) {
      const { ultimo, publico } = await partida([81], { robos: 3, cenario: 'grama', dificuldade }, 100, s);
      const eu = ultimo.j.find((l) => l[0] === 81)!;
      if (publico.vencedor === eu[10]) vitorias++;
      sobra += eu[7] * 100 + eu[8];
    }
    t.diagnostic(`${dificuldade}: venceu ${vitorias} de 4, vida que sobrou ${sobra}`);
    return { vitorias, sobra };
  };
  const facil = await medir('facil');
  const dificil = await medir('dificil');
  assert.ok(facil.sobra > dificil.sobra, 'sobra mais vida no fácil');
  assert.ok(facil.vitorias >= dificil.vitorias);
});

// ---------------- 21/11/2026: a marca de cada espécie e as ondas (lote D) ----------------
test('a marca da espécie: o especial muda um pouco com o bicho da frente (forte, seiva, casca, pressa, fôlego), e o servidor decide', () => {
  const conta = mod as unknown as typeof import('../src/arena/conta.js');
  // toda espécie tem uma marca que existe
  for (const e of Object.keys(ESPECIES)) assert.ok(conta.MARCAS.includes(conta.marcaDe(e)), e);
  assert.ok(new Set(Object.keys(ESPECIES).map(conta.marcaDe)).size === conta.MARCAS.length, 'todas as marcas são usadas');
  const m = comecar();
  m.andar(2100);
  const a = m.l(anaId) as Lut & { rapidoAte: number; cascaAte: number };
  const b = m.l(biaId) as Lut & { cascaAte: number };
  m.por(anaId, 300, 380);
  m.por(biaId, 380, 380);
  m.andar(200);
  b.equipe = ['miasso', 'miasso', 'miasso'];
  const vale = (el: string, dano: number) => Math.max(1, Math.round(dano * mod.fatorDaArena(eficacia(el as never, 'faisca'))));
  let n = 0;
  const especial = (especie: string) => {
    a.equipe = [especie, especie, especie];
    a.especial = mod.ESPECIAL_MAX;
    return m.manda(anaId, { tipo: 'golpe', n: ++n, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0 });
  };
  // forte (o dinito, brasa: a roda): mais dano que o do kit
  let pv = b.pv;
  assert.equal(especial('dinito'), null);
  assert.equal(pv - b.pv, vale('brasa', Math.round(KITS.brasa.e.dano * conta.MARCA.forte)));
  // fôlego (o tisco, brasa): o dano do kit, e o especial volta com uma parte
  b.pv = PV;
  pv = b.pv;
  assert.equal(especial('tisco'), null);
  assert.equal(pv - b.pv, vale('brasa', KITS.brasa.e.dano));
  assert.ok(a.especial >= conta.MARCA.folego && a.especial < mod.ESPECIAL_MAX, String(a.especial));
  // seiva (o brotel): quem usa recupera vida
  a.pv = 40;
  assert.equal(especial('brotel'), null);
  assert.equal(a.pv, 40 + conta.MARCA.seiva);
  // pressa (o zunzi): fica rápido
  assert.equal(especial('zunzi'), null);
  assert.ok(a.rapidoAte > 0);
  // casca (o rochim): leva menos dano por um tempo
  assert.equal(especial('rochim'), null);
  assert.ok(a.cascaAte > 0);
  m.jogo.parar!();
});

test('a casca segura o dano: o mesmo golpe dói menos em quem acabou de usar o especial do bicho de pedra', () => {
  const m = comecar();
  m.andar(2100);
  const a = m.l(anaId) as Lut & { cascaAte: number };
  const b = m.l(biaId);
  m.por(anaId, 300, 380);
  m.por(biaId, 380, 380);
  m.andar(200);
  a.equipe = ['tisco', 'tisco', 'tisco'];
  b.equipe = ['rochim', 'rochim', 'rochim'];
  const antes = b.pv;
  a.especial = mod.ESPECIAL_MAX;
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 1, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0 }), null);
  const semCasca = antes - b.pv;
  b.pv = PV;
  b.especial = mod.ESPECIAL_MAX;
  // ela usa o especial (a casca) longe de ana, e leva a mesma roda
  assert.equal(m.manda(biaId, { tipo: 'golpe', n: 1, tecla: 'e', x: 396, y: 380, dx: 1, dy: 0 }), null);
  const comPv = b.pv;
  a.especial = mod.ESPECIAL_MAX;
  m.andar(100);
  assert.equal(m.manda(anaId, { tipo: 'golpe', n: 2, tecla: 'e', x: 316, y: 380, dx: 1, dy: 0 }), null);
  assert.ok(comPv - b.pv < semCasca, `com a casca ${comPv - b.pv}, sem ${semCasca}`);
  m.jogo.parar!();
});

test('as ondas (só no Solo): a primeira com um robô, a próxima depois da pausa, mais robôs e mais espertos; o recorde é a onda alcançada', () => {
  const recordes = new Map<string, number>();
  const s = soloDeMao({ objetivo: 'ondas', cenario: 'grama' }, recordes);
  const lut = () => [...s.i._lutadores.values()] as (Lut & { dif: string })[];
  const daOnda = () => lut().filter((l) => l.time === 1 && l.estado !== 'sem-vidas');
  assert.equal(lut().filter((l) => l.time === 0).length, 1, 'sozinho');
  assert.equal(lut().filter((l) => l.time === 1).length, mod.ONDAS.vagas);
  assert.equal(daOnda().length, 1);
  assert.equal(daOnda()[0].dif, 'facil');
  const limpar = () => {
    for (const l of daOnda()) Object.assign(l, { estado: 'sem-vidas', vidas: 0 });
    s.andar(PASSO_MS);
    s.andar(mod.ONDAS.pausa + PASSO_MS);
  };
  for (let n = 2; n <= 6; n++) {
    limpar();
    const o = mod.onda(n);
    assert.equal(daOnda().length, o.robos, `onda ${n}`);
    assert.ok(daOnda().every((l) => l.dif === o.dif && l.vidas === o.vidas && l.pv === PV));
    assert.equal((s.jogo.publico(70) as { ondas: { onda: number } }).ondas.onda, n);
  }
  assert.ok(mod.onda(9).robos === mod.ONDAS.vagas && mod.onda(9).dif === 'dificil' && mod.onda(9).vidas === 2);
  // a pessoa sem vidas: acabou, e a onda alcançada é o recorde
  const p = s.acabar(false) as unknown as { ondas: { onda: number; recorde: number; novo: boolean }; sequencia: unknown };
  assert.deepEqual(p.ondas, { onda: 6, recorde: 6, novo: true });
  assert.equal(recordes.get('ondas'), 6);
  assert.equal(p.sequencia, null, 'as ondas não mexem nas vitórias seguidas');
  // com o time (dois aliados), o recorde à parte
  const t = soloDeMao({ objetivo: 'ondas', formato: '3x3', cenario: 'grama' }, recordes);
  assert.equal([...t.i._lutadores.values()].filter((l) => l.time === 0).length, 3);
  for (const l of [...t.i._lutadores.values()]) if (l.time === 1 && l.estado !== 'sem-vidas') Object.assign(l, { estado: 'sem-vidas', vidas: 0 });
  t.andar(mod.ONDAS.pausa + 2 * PASSO_MS);
  // o time inteiro fora (com os aliados de pé, a corrida segue)
  for (const l of [...t.i._lutadores.values()]) if (l.time === 0 && l.id !== 70) Object.assign(l, { estado: 'sem-vidas', vidas: 0 });
  t.acabar(false);
  assert.equal(recordes.get('ondas:3x3'), 2);
  // na primeira onda não vencida, nada se guarda; e na sala as ondas não existem
  const r0 = new Map<string, number>();
  soloDeMao({ objetivo: 'ondas' }, r0).acabar(false);
  assert.equal(r0.size, 0);
  const sala = comecar([anaId, biaId], { formato: '1x1', cenario: 'grama', objetivo: 'ondas' });
  assert.equal((sala.jogo.publico(anaId) as { objetivo: string }).objetivo, 'luta');
  sala.jogo.parar!();
});

test('as ondas contra o piloto: com 200 ms de ida e volta, ele passa das primeiras ondas', async (t) => {
  const { publico } = await partida([83], { objetivo: 'ondas', cenario: 'grama' }, 100, 9);
  const o = (publico as { ondas: { onda: number } }).ondas.onda;
  t.diagnostic(`onda alcançada: ${o}`);
  assert.ok(o >= 3, `onda ${o}`);
});
