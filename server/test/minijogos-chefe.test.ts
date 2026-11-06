/**
 * O CHEFE DA TURMA (minijogo-chefe.ts, a regra em chefe/motor.ts): a toupeira é do servidor, num passo de 20 por segundo; quem
 * acerta manda o acerto, e o servidor confere pelo passado dela; quem leva tem a folga. O relógio e o passo são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-chefe.js');
const { criarChefeComBanco, PASSO_MS, GRACA_MS, TORRAO, BOMBA, VIDAS, vidaPorFase, FIM_MS } = mod;
after(fechar);

let agora = 5_000_000;
const ana = await criarConta(app, 'ana-chefe');
const bia = await criarConta(app, 'bia-chefe');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do chefe' })).json() as { id: number };

interface Chefe {
  x: number;
  y: number;
  estado: string;
  ate: number;
  hp: number;
  fase: number;
}
interface Jog {
  x: number;
  y: number;
  vidas: number;
  pontos: number;
  segura: boolean;
  bomba: boolean;
  estado: string;
  livreAte: number;
  invulAte: number;
}
interface Interno {
  _passo: () => void;
  _chefe: Chefe;
  _jogadores: Map<number, Jog>;
  _marcas: Map<number, Record<string, unknown>>;
  _noChao: Map<number, { id: number; x: number; y: number; ate: number }>;
  _motivo: () => string | null;
}

function comecar(naSala = [anaId, biaId], comunidadeId = comunidade.id) {
  let terminou = false;
  const quadros: Record<string, unknown>[] = [];
  const relogio: { ms: number; depois: () => void }[] = [];
  let sala = [...naSala];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => sala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidadeId,
    solo: comunidadeId === 0,
    difundir: (d: unknown) => quadros.push(d as Record<string, unknown>),
  };
  let passo: (() => void) | null = null;
  const jogo = criarChefeComBanco({ agora: () => agora, aleatorio: () => 0.5, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala,
    criadaPor: naSala[0],
    corpo: {},
  });
  assert.ok(typeof jogo !== 'string');
  const i = jogo as unknown as Interno;
  const m = {
    jogo,
    i,
    quadros,
    terminou: () => terminou,
    sair: (id: number) => (sala = sala.filter((s) => s !== id)),
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
    /** Põe a pessoa num lugar (o teste não espera o coelho andar até lá). */
    por(id: number, x: number, y: number) {
      i._jogadores.get(id)!.livreAte = agora + 1000;
      jogo.tempoReal!(id, { tipo: 'pos', x, y, lado: 1, acao: 0, ta: 0 });
    },
    /** A toupeira parada num lugar, em pé (ou no estado dado), sem golpe por um bom tempo. */
    chefeEm(x: number, y: number, estado = 'parada') {
      Object.assign(i._chefe, { x, y, estado, ate: agora + 600_000 });
      m.andar(1000);
    },
    /** Um torrão frio no chão. */
    torrao(id: number, x: number, y: number) {
      i._noChao.set(id, { id, x, y, ate: agora + 5000 });
    },
  };
  return m;
}

test('o passo é do servidor: 20 por segundo, o quadro leva a toupeira, as marcas e os coelhos', () => {
  const m = comecar();
  m.andar(2000);
  assert.ok(m.quadros.length >= 39);
  const q = m.quadros.at(-1)! as { c: number[]; j: number[][]; f: string };
  assert.equal(q.f, 'lutando');
  assert.equal(q.c.length, 9);
  assert.equal(q.j.length, 2);
  assert.equal(q.j[0][6], VIDAS);
  m.jogo.parar!();
});

test('quem fica no círculo da pedra leva; quem sai dentro da folga escapa', () => {
  const m = comecar();
  m.chefeEm(240, 120);
  m.por(anaId, 100, 200);
  m.por(biaId, 300, 200);
  m.andar(2500);
  const imp = agora + 300;
  for (const [id, x, y] of [[901, 100, 200], [902, 300, 200]]) {
    m.i._marcas.set(id, { id, tipo: 'pedra', x, y, r: 16, x2: 0, y2: 0, inicio: agora, impacto: imp, frio: false, resolvida: false });
  }
  // a Ana fica; a Bia sai pouco depois do impacto (a folga cobre)
  for (let t = 0; t < 700; t += 50) {
    m.por(anaId, 100, 200);
    m.por(biaId, agora > imp + 60 ? 340 : 300, 200);
    m.andar(50);
  }
  assert.equal(m.i._jogadores.get(anaId)!.vidas, VIDAS - 1, 'a Ana levou');
  assert.equal(m.i._jogadores.get(biaId)!.vidas, VIDAS, 'a Bia escapou');
  m.jogo.parar!();
});

test('o torrão frio: só de perto, e o primeiro que pega leva', () => {
  const m = comecar();
  m.chefeEm(240, 120);
  m.por(anaId, 100, 200);
  m.por(biaId, 104, 200);
  m.torrao(77, 160, 200);
  assert.equal(m.manda(anaId, { tipo: 'pegar', torrao: 77 }), 'longe do torrão');
  m.torrao(78, 108, 200);
  assert.equal(m.manda(anaId, { tipo: 'pegar', torrao: 78 }), null);
  assert.equal(m.i._jogadores.get(anaId)!.segura, true);
  assert.equal(m.manda(biaId, { tipo: 'pegar', torrao: 78 }), 'torrão fora', 'a Ana pegou primeiro');
  m.jogo.parar!();
});

test('o tiro: só com torrão, com número, e o acerto confere o caminho pelo passado da toupeira', () => {
  const m = comecar();
  m.chefeEm(240, 120);
  m.por(anaId, 100, 120);
  assert.equal(m.manda(anaId, { tipo: 'atirar', n: 1, x: 100, y: 120, dx: 1, dy: 0 }), 'sem torrão');
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1 }), 'tiro que não saiu');
  // um tiro para cima: passa longe dela
  m.torrao(1, 100, 120);
  m.manda(anaId, { tipo: 'pegar', torrao: 1 });
  assert.equal(m.manda(anaId, { tipo: 'atirar', n: 1, x: 100, y: 120, dx: 0, dy: -1 }), null);
  m.andar(400);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1 }), 'longe da toupeira');
  // agora na direção dela, e cedo demais (o torrão ainda não chegou lá)
  m.torrao(2, 100, 120);
  m.manda(anaId, { tipo: 'pegar', torrao: 2 });
  m.manda(anaId, { tipo: 'atirar', n: 2, x: 100, y: 120, dx: 1, dy: 0 });
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2 }), 'longe da toupeira', 'cedo demais');
  m.andar(450);
  const hp = m.i._chefe.hp;
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2 }), null);
  assert.equal(m.i._chefe.hp, hp - TORRAO.dano);
  assert.equal(m.i._jogadores.get(anaId)!.pontos, TORRAO.dano);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2 }), 'tiro que não saiu', 'um tiro acerta uma vez');
  // o mesmo número não sai duas vezes
  m.torrao(3, 100, 120);
  m.manda(anaId, { tipo: 'pegar', torrao: 3 });
  assert.equal(m.manda(anaId, { tipo: 'atirar', n: 2, x: 100, y: 120, dx: 1, dy: 0 }), 'número');
  m.jogo.parar!();
});

test('tonta, ela leva o dobro; embaixo da terra, nada pega', () => {
  const m = comecar();
  m.chefeEm(240, 120, 'tonta');
  m.por(anaId, 100, 120);
  m.torrao(1, 100, 120);
  m.manda(anaId, { tipo: 'pegar', torrao: 1 });
  m.manda(anaId, { tipo: 'atirar', n: 1, x: 100, y: 120, dx: 1, dy: 0 });
  m.andar(450);
  const hp = m.i._chefe.hp;
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1 }), null);
  assert.equal(hp - m.i._chefe.hp, TORRAO.dano * 2);
  m.chefeEm(240, 120, 'embaixo');
  Object.assign(m.i._chefe, { ate: agora + 600_000 });
  m.torrao(2, 100, 120);
  m.manda(anaId, { tipo: 'pegar', torrao: 2 });
  m.manda(anaId, { tipo: 'atirar', n: 2, x: 100, y: 120, dx: 1, dy: 0 });
  m.andar(450);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2 }), 'longe da toupeira');
  m.jogo.parar!();
});

test('a bomba de semente: uma por fase, a explosão é do servidor', () => {
  const m = comecar();
  m.chefeEm(200, 150);
  m.por(anaId, 120, 150);
  const hp = m.i._chefe.hp;
  assert.equal(m.manda(anaId, { tipo: 'bomba', x: 200, y: 150 }), null);
  assert.equal(m.manda(anaId, { tipo: 'bomba', x: 200, y: 150 }), 'sem bomba');
  m.andar(BOMBA.voo + 100);
  assert.equal(hp - m.i._chefe.hp, BOMBA.dano);
  // a da Bia, longe dela: explode e não pega
  m.por(biaId, 420, 240);
  m.manda(biaId, { tipo: 'bomba', x: 420, y: 240 });
  m.andar(BOMBA.voo + 100);
  assert.equal(hp - m.i._chefe.hp, BOMBA.dano);
  m.jogo.parar!();
});

test('ninguém anda mais rápido que o coelho', () => {
  const m = comecar();
  m.andar(1500);
  const j = m.i._jogadores.get(anaId)!;
  const x0 = j.x;
  m.manda(anaId, { tipo: 'pos', x: x0 + 200, y: j.y, lado: 1, acao: 0, ta: 0 });
  assert.ok(j.x - x0 <= 20, `andou ${j.x - x0}`);
  m.jogo.parar!();
});

/** Tira a vida da fase de uma vez: bombas e torrões até a fase cair. */
function derrubarFase(m: ReturnType<typeof comecar>, quem: number, n0: number) {
  let n = n0;
  m.chefeEm(240, 120);
  while (m.i._chefe.estado !== 'fase' && m.i._chefe.estado !== 'caida') {
    m.chefeEm(240, 120);
    m.por(quem, 100, 120);
    m.torrao(1000 + n, 100, 120);
    m.manda(quem, { tipo: 'pegar', torrao: 1000 + n });
    m.manda(quem, { tipo: 'atirar', n, x: 100, y: 120, dx: 1, dy: 0 });
    m.andar(450);
    m.manda(quem, { tipo: 'acerto', n });
    n++;
    m.andar(500);
  }
  return n;
}

test('três fases; a toupeira cai e a turma ganha; o pódio vai à estante com o dano', async () => {
  const antes = ((await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string }[]).filter((t) => t.pista === 'chefe').length;
  const m = comecar();
  assert.equal(m.i._chefe.hp, vidaPorFase(2, false));
  let n = derrubarFase(m, anaId, 1);
  assert.equal(m.i._chefe.estado, 'fase');
  assert.equal(m.i._chefe.fase, 1);
  // a Bia dá um pouco de dano também
  m.chefeEm(240, 120);
  m.por(biaId, 120, 150);
  m.manda(biaId, { tipo: 'bomba', x: 240, y: 120 });
  m.andar(BOMBA.voo + 100);
  n = derrubarFase(m, anaId, n);
  derrubarFase(m, anaId, n);
  assert.equal((m.quadros.at(-1) as { f: string }).f, 'vitoria');
  m.disparar();
  assert.equal(m.terminou(), true);
  const pub = m.jogo.publico(anaId) as { venceu: boolean; danoDaTurma: number; resultado: { userId: number; pontos: number; posicao: number }[] };
  assert.equal(pub.venceu, true);
  assert.equal(pub.danoDaTurma, vidaPorFase(2, false) * 3);
  assert.equal(pub.resultado[0].userId, anaId);
  const depois = ((await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number; pontos: number }[]).filter(
    (t) => t.pista === 'chefe',
  );
  assert.equal(depois.length, antes + 1);
  assert.equal(depois[0].posicao, 1);
  assert.equal(depois[0].pontos, pub.resultado[0].pontos);
  const daBia = ((await comToken(app, bia.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number }[]).filter((t) => t.pista === 'chefe');
  assert.equal(daBia[0]?.posicao, 2);
});

test('no Solo a toupeira é mais fraca e não há troféu', async () => {
  const antes = ((await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string }[]).filter((t) => t.pista === 'chefe').length;
  const m = comecar([anaId], 0);
  assert.equal(m.i._chefe.hp, vidaPorFase(1, true));
  assert.ok(vidaPorFase(1, true) < vidaPorFase(2, false));
  let n = derrubarFase(m, anaId, 1);
  n = derrubarFase(m, anaId, n);
  derrubarFase(m, anaId, n);
  m.disparar();
  assert.equal((m.jogo.publico(anaId) as { venceu: boolean }).venceu, true);
  const depois = ((await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string }[]).filter((t) => t.pista === 'chefe').length;
  assert.equal(depois, antes);
});

test('todos sem vidas: a turma perde; a sala vazia acaba a luta', () => {
  const m = comecar();
  m.chefeEm(240, 120);
  for (const j of m.i._jogadores.values()) j.vidas = 1;
  m.por(anaId, 100, 200);
  m.por(biaId, 300, 200);
  m.andar(2500);
  for (const [id, x, y] of [[901, 100, 200], [902, 300, 200]]) {
    m.i._marcas.set(id, { id, tipo: 'pedra', x, y, r: 16, x2: 0, y2: 0, inicio: agora, impacto: agora + 100, frio: false, resolvida: false });
  }
  for (let t = 0; t < 600; t += 50) {
    m.por(anaId, 100, 200);
    m.por(biaId, 300, 200);
    m.andar(50);
  }
  assert.equal((m.quadros.at(-1) as { f: string }).f, 'derrota');
  m.disparar();
  assert.equal((m.jogo.publico(anaId) as { venceu: boolean }).venceu, false);

  const v = comecar();
  v.andar(500);
  v.sair(anaId);
  v.sair(biaId);
  v.andar(100);
  assert.equal((v.quadros.at(-1) as { f: string }).f, 'derrota');
  assert.ok(GRACA_MS > 0 && FIM_MS > 0);
});
