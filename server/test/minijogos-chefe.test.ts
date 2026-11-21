/**
 * O CHEFE DA TURMA (minijogo-chefe.ts, a regra em chefe/motor.ts): a toupeira é do servidor, num passo de 20 por segundo; quem
 * acerta manda o acerto, e o servidor confere pelo passado dela; quem leva tem a folga. O relógio e o passo são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-chefe.js');
const { criarChefeComBanco, PASSO_MS, GRACA_MS, TORRAO, BOMBA, VIDAS, vidaPorFase, FIM_MS, PA, CORPO_CHEFE, AVISO_DIFICIL, varianteDoChefe } = mod;
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

function comecar(naSala = [anaId, biaId], comunidadeId = comunidade.id, corpo: Record<string, unknown> = {}, aleatorio = () => 0.5) {
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
  const jogo = criarChefeComBanco({ agora: () => agora, aleatorio, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala,
    criadaPor: naSala[0],
    corpo,
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
  assert.equal(q.c.length, 11);
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

// ---------------- As melhorias de 19/11/2026 ----------------

test('reviver: quem fica perto do caído por 2 s o traz de volta com uma vida; sair de perto zera a conta', () => {
  const m = comecar();
  m.chefeEm(240, 120);
  const bi = m.i._jogadores.get(biaId)!;
  bi.vidas = 0;
  bi.estado = 'sem-vidas';
  bi.x = 300;
  bi.y = 200;
  // a Ana longe: nada
  m.por(anaId, 100, 200);
  m.andar(2500);
  assert.equal(bi.estado, 'sem-vidas');
  // perto por 1 s, sai, volta: a conta recomeça
  for (let t = 0; t < 1000; t += 50) {
    m.por(anaId, 310, 200);
    m.andar(50);
  }
  const q = m.quadros.at(-1) as { j: number[][] };
  assert.ok(q.j.find((l) => l[0] === biaId)![14] > 0, 'o quadro mostra a conta');
  m.por(anaId, 100, 200);
  m.andar(100);
  assert.equal(bi.estado, 'sem-vidas');
  for (let t = 0; t < mod.REVIVER_MS - 200; t += 50) {
    m.por(anaId, 310, 200);
    m.andar(50);
  }
  assert.equal(bi.estado, 'sem-vidas', 'a conta recomeçou');
  for (let t = 0; t < 500; t += 50) {
    m.por(anaId, 310, 200);
    m.andar(50);
  }
  assert.equal(bi.estado, 'em-pe');
  assert.equal(bi.vidas, 1);
  assert.ok(bi.invulAte > agora);
  assert.ok(m.quadros.slice(-12).some((qq) => ((qq as { e: unknown[][] }).e).some((e) => e[1] === 'v' && e[2] === biaId && e[3] === anaId)));
  m.jogo.parar!();
});

test('a cruz de pedras (o golpe da última fase): quatro linhas a partir da toupeira, e quem fica fora delas escapa', () => {
  const m = comecar();
  m.chefeEm(240, 160);
  m.i._chefe.fase = 2;
  // força a fila da toupeira: a saída com a cruz
  Object.assign(m.i._chefe, { estado: 'parada', ate: agora + 50, fila: ['cruz'] });
  m.andar(150);
  const pedras = [...m.i._marcas.values()].filter((k) => k.tipo === 'pedra');
  assert.ok(pedras.length >= 8, `pedras ${pedras.length}`);
  // todas numa das linhas (em + ou em ×) que passam pela toupeira
  const c = m.i._chefe;
  for (const p of pedras) {
    const dx = (p.x as number) - c.x, dy = ((p.y as number) - c.y) / 0.6;
    const naCruz = Math.abs(dx) < 1 || Math.abs(dy) < 1 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 1;
    assert.ok(naCruz, `fora da cruz: ${dx}, ${dy}`);
  }
  // e quem está fora das linhas não leva (até a última pedra cair)
  const ana_ = m.i._jogadores.get(anaId)!;
  const vidas = ana_.vidas;
  const fim = Math.max(...pedras.map((p) => p.impacto as number)) + 500;
  const [cx, cy] = [c.x, c.y];
  while (agora < fim) {
    m.por(anaId, cx + 60, cy);
    m.andar(50);
  }
  assert.equal(ana_.vidas, vidas);
  m.jogo.parar!();
});

test('o recorde do Solo: o tempo até a toupeira cair, guardado na tabela comum', async () => {
  const db = await import('../src/db.js');
  const m = comecar([anaId], 0);
  const inicio = agora;
  let n = derrubarFase(m, anaId, 1);
  n = derrubarFase(m, anaId, n);
  derrubarFase(m, anaId, n);
  m.disparar();
  const pub = m.jogo.publico(anaId) as { recorde: { ms: number; novo: boolean } | null };
  assert.ok(pub.recorde);
  assert.ok(pub.recorde!.ms > 0 && pub.recorde!.ms <= agora - inicio);
  const r = db.recordeDoSolo(anaId, 'chefe', '');
  assert.ok(r && r.valor <= pub.recorde!.ms);
});

// ---------------- A segunda rodada de 19/11/2026: o yeti ----------------

function comecarYeti(naSala = [anaId, biaId], comunidadeId = comunidade.id) {
  const quadros: Record<string, unknown>[] = [];
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidadeId,
    solo: comunidadeId === 0,
    difundir: (d: unknown) => quadros.push(d as Record<string, unknown>),
  };
  let passo: (() => void) | null = null;
  const jogo = criarChefeComBanco({ agora: () => agora, aleatorio: () => 0.5, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
    naSala,
    criadaPor: naSala[0],
    corpo: { chefe: 'yeti' },
  });
  assert.ok(typeof jogo !== 'string');
  const i = jogo as unknown as Interno & { _bolas: Map<number, { x: number; y: number }> };
  return {
    jogo,
    i,
    quadros,
    andar(ms: number) {
      for (let t = 0; t < ms; t += PASSO_MS) {
        agora += PASSO_MS;
        passo!();
      }
    },
    por(id: number, x: number, y: number) {
      i._jogadores.get(id)!.livreAte = agora + 1000;
      jogo.tempoReal!(id, { tipo: 'pos', x, y, lado: 1, acao: 0, ta: 0 });
    },
  };
}

test('o yeti empurra a bola de neve pela linha: quem fica nela leva, e ela para fria no fim, para devolver', () => {
  // a Bia sem vidas: a bola vai na direção da Ana
  const m = comecarYeti();
  Object.assign(m.i._jogadores.get(biaId)!, { estado: 'sem-vidas', vidas: 0 });
  Object.assign(m.i._chefe, { x: 120, y: 160, estado: 'parada', ate: agora + 600_000 });
  m.andar(1000);
  // a Ana na linha (à direita do yeti), a Bia longe dela
  m.por(anaId, 260, 160);
  m.por(biaId, 120, 240);
  const ana_ = m.i._jogadores.get(anaId)!;
  const bia_ = m.i._jogadores.get(biaId)!;
  ana_.invulAte = 0;
  const vidasAna = ana_.vidas;
  Object.assign(m.i._chefe, { estado: 'parada', ate: agora + 50, fila: ['rolar'] });
  m.andar(150);
  assert.equal(m.i._bolas.size, 1, 'a bola espera o aviso');
  const linha = [...m.i._marcas.values()].find((k) => k.tipo === 'investida');
  assert.ok(linha, 'a linha marcada');
  // a Ana fica parada na linha; a Bia continua longe
  for (let t = 0; t < 4000 && m.i._bolas.size; t += 50) {
    m.por(anaId, 260, 160);
    m.por(biaId, 120, 240);
    m.andar(50);
  }
  m.andar(400);
  assert.equal(m.i._bolas.size, 0, 'parou');
  assert.equal(ana_.vidas, vidasAna - 1, 'quem ficou na linha levou');
  assert.ok([...m.i._noChao.values()].length >= 1, 'a bola ficou no chão, fria');
  const q = m.quadros.at(-1) as { c: number[] };
  assert.equal(q.c[9], 1);
  m.jogo.parar!();
});

test('o recorde do yeti é separado do da toupeira', async () => {
  const db = await import('../src/db.js');
  const m = comecarYeti([anaId], 0);
  const pub = m.jogo.publico(anaId) as { chefe: string; categoria: string };
  assert.equal(pub.chefe, 'yeti');
  assert.equal(pub.categoria, 'yeti');
  assert.equal(db.recordeDoSolo(anaId, 'chefe', 'yeti'), null);
  m.jogo.parar!();
});

// ---------------- A segunda auditoria (20/11/2026): a pá, a maratona e o difícil ----------------

test('o golpe de pá: de perto, 1 de dano, só com ela parada ou tonta, com a recarga, conferido pelo passado', () => {
  const m = comecar();
  m.chefeEm(240, 120);
  // longe: não pega
  m.por(anaId, 150, 120);
  assert.equal(m.manda(anaId, { tipo: 'pa', x: 150, y: 120 }), 'longe do chefe');
  m.andar(PA.recargaMs + 50);
  // colada nela, parada
  const x = 240 - CORPO_CHEFE - PA.alcance + 2;
  m.por(anaId, x, 120);
  const hp = m.i._chefe.hp;
  assert.equal(m.manda(anaId, { tipo: 'pa', x, y: 120 }), null);
  assert.equal(m.i._chefe.hp, hp - PA.dano);
  assert.equal(m.i._jogadores.get(anaId)!.pontos, PA.dano);
  // a recarga
  assert.equal(m.manda(anaId, { tipo: 'pa', x, y: 120 }), 'pá depressa');
  m.andar(PA.recargaMs);
  assert.equal(m.manda(anaId, { tipo: 'pa', x, y: 120 }), null);
  // tonta: continua 1 (sem o dobro)
  m.chefeEm(240, 120, 'tonta');
  m.por(anaId, x, 120);
  const hp2 = m.i._chefe.hp;
  assert.equal(m.manda(anaId, { tipo: 'pa', x, y: 120 }), null);
  assert.equal(hp2 - m.i._chefe.hp, PA.dano);
  // preparando um golpe (nem parada nem tonta no último 0,8 s): não pega
  m.chefeEm(240, 120, 'prep-terremoto');
  m.por(anaId, x, 120);
  assert.equal(m.manda(anaId, { tipo: 'pa', x, y: 120 }), 'longe do chefe');
  // a origem que a pessoa diz só vale perto da que o servidor viu
  m.chefeEm(240, 120);
  m.por(anaId, 120, 200);
  m.andar(PA.recargaMs);
  assert.equal(m.manda(anaId, { tipo: 'pa', x, y: 120 }), 'longe do chefe');
  m.jogo.parar!();
});

test('a maratona (Solo): a toupeira e depois o yeti, seis fases, um recorde à parte', async () => {
  const db = await import('../src/db.js');
  const m = comecar([anaId], 0, { chefe: 'maratona' });
  const ii = m.i as unknown as { _etapa: () => number; _qual: () => string };
  let pub = m.jogo.publico(anaId) as { fases: number; faseDoChefe: number; chefe: string; categoria: string };
  assert.equal(pub.fases, 6);
  assert.equal(pub.chefe, 'toupeira');
  assert.equal(pub.categoria, 'maratona');
  let n = derrubarFase(m, anaId, 1);
  n = derrubarFase(m, anaId, n);
  n = derrubarFase(m, anaId, n);
  // a toupeira caiu, e a luta segue com o yeti
  assert.equal(m.i._chefe.estado, 'fase');
  assert.equal(ii._etapa(), 1);
  assert.equal(ii._qual(), 'yeti');
  pub = m.jogo.publico(anaId) as typeof pub;
  assert.equal(pub.faseDoChefe, 4);
  assert.equal(pub.chefe, 'yeti');
  m.andar(100);
  const q = m.quadros.at(-1) as { c: number[]; f: string };
  assert.equal(q.f, 'lutando');
  assert.equal(q.c[9], 1);
  assert.equal(q.c[10], 1);
  n = derrubarFase(m, anaId, n);
  n = derrubarFase(m, anaId, n);
  derrubarFase(m, anaId, n);
  m.disparar();
  const fim = m.jogo.publico(anaId) as { venceu: boolean; recorde: { ms: number } | null };
  assert.equal(fim.venceu, true);
  assert.ok(fim.recorde);
  assert.ok(db.recordeDoSolo(anaId, 'chefe', 'maratona'));
});

test('a maratona só existe no Solo; na sala, é a toupeira', () => {
  const m = comecar([anaId, biaId], comunidade.id, { chefe: 'maratona', dificil: true });
  const pub = m.jogo.publico(anaId) as { fases: number; categoria: string; dificil: boolean };
  assert.equal(pub.fases, 3);
  assert.equal(pub.categoria, 'toupeira');
  assert.equal(pub.dificil, false);
  assert.equal(m.i._chefe.hp, vidaPorFase(2, false));
  m.jogo.parar!();
});

test('o difícil (Solo): a vida da sala, os avisos mais curtos e o recorde à parte', async () => {
  const db = await import('../src/db.js');
  const m = comecar([anaId], 0, { chefe: 'toupeira', dificil: true });
  const ii = m.i as unknown as { _F: () => { k: number } };
  assert.equal(m.i._chefe.hp, vidaPorFase(1, false));
  assert.ok(Math.abs(ii._F().k - AVISO_DIFICIL) < 1e-9);
  assert.equal((m.jogo.publico(anaId) as { categoria: string }).categoria, 'toupeira-dificil');
  let n = derrubarFase(m, anaId, 1);
  n = derrubarFase(m, anaId, n);
  derrubarFase(m, anaId, n);
  m.disparar();
  assert.ok(db.recordeDoSolo(anaId, 'chefe', 'dificil'));
  // o "Jogar de novo" manda a categoria: "yeti-dificil" é o yeti no difícil
  const m2 = comecar([anaId], 0, { categoria: 'yeti-dificil' });
  const p2 = m2.jogo.publico(anaId) as { chefe: string; dificil: boolean };
  assert.equal(p2.chefe, 'yeti');
  assert.equal(p2.dificil, true);
  m2.jogo.parar!();
  assert.equal(varianteDoChefe('toupeira', false), '');
  assert.equal(varianteDoChefe('yeti', false), 'yeti');
  assert.equal(varianteDoChefe('maratona', true), 'maratona-dificil');
});

// ---------------- O lote D (21/11/2026): a arena que muda e a alpaca-rei ----------------

/** Um sorteio que varia (o de sempre, 0,5, põe todo buraco no mesmo lugar, na toca do meio, e nenhum entra). */
const sorteador = (semente0: number) => {
  let semente = semente0;
  return () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
};
type ComBuracos = Interno & { _buracos: Map<number, { id: number; x: number; y: number; r: number; abre: number; aberto: boolean }> };

test('a arena que muda: a 2ª fase abre buracos marcados antes; quem está dentro quando abre cai, e ninguém fica dentro depois', () => {
  const m = comecar([anaId, biaId], comunidade.id, {}, sorteador(9));
  const i = m.i as unknown as ComBuracos;
  assert.equal(i._buracos.size, 0, 'a 1ª fase tem o chão inteiro');
  derrubarFase(m, anaId, 1);
  assert.equal(i._chefe.fase, 1);
  assert.equal(i._buracos.size, mod.BURACOS_POR_FASE);
  const b = [...i._buracos.values()][0];
  assert.equal(b.aberto, false, 'primeiro, só o aviso');
  for (const [tx, ty] of mod.TOCAS) assert.ok(Math.hypot(b.x - tx, b.y - ty) > b.r + 30, 'longe das tocas');
  const q = m.quadros.at(-1) as { bu: number[][] };
  assert.equal(q.bu.length, mod.BURACOS_POR_FASE);
  assert.ok(q.bu[0][4] > 0, 'o quadro diz quanto falta para abrir');
  // a Ana parada dentro dele; a Bia longe (o chefe parado, para não atrapalhar)
  Object.assign(i._chefe, { estado: 'parada', ate: agora + 600_000, x: 60, y: 100 });
  const ana_ = i._jogadores.get(anaId)!;
  ana_.invulAte = 0;
  const vidas = ana_.vidas;
  for (let t = 0; t < mod.BURACO.aviso + mod.GRACA_MS + 400; t += 50) {
    m.por(anaId, b.x, b.y);
    m.andar(50);
    if (b.aberto) break;
  }
  m.andar(mod.GRACA_MS + 100);
  assert.equal(b.aberto, true);
  assert.equal(ana_.vidas, vidas - 1, 'quem estava dentro caiu');
  assert.ok(m.quadros.some((qq) => (qq as { e: unknown[][] }).e.some((e) => e[1] === 'o')), 'o evento do buraco abrindo');
  // aberto, a posição dentro dele vai para a borda
  m.por(anaId, b.x + 3, b.y);
  assert.ok(Math.hypot(ana_.x - b.x, ana_.y - b.y) >= b.r + mod.CORPO_COELHO - 0.01);
  // a 3ª fase abre mais
  derrubarFase(m, anaId, 500);
  assert.equal(i._buracos.size, 2 * mod.BURACOS_POR_FASE);
  m.jogo.parar!();
});

test('a conta dos buracos (as duas pontas): fora do buraco, nada muda; dentro, a borda mais perto', () => {
  assert.deepEqual(mod.foraDosBuracos(100, 150, [[200, 150, 20]]), [100, 150]);
  const [x, y] = mod.foraDosBuracos(205, 150, [[200, 150, 20]]);
  assert.equal(Math.round(x), 200 + 20 + mod.CORPO_COELHO);
  assert.equal(y, 150);
});

test('a alpaca-rei (o 3º chefe): o leque de faixas na direção de alguém; quem fica numa faixa leva, quem fica entre elas escapa', () => {
  const m = comecar([anaId, biaId], comunidade.id, { chefe: 'alpaca' });
  const pub = m.jogo.publico(anaId) as { chefe: string; categoria: string };
  assert.equal(pub.chefe, 'alpaca');
  assert.equal(pub.categoria, 'alpaca');
  Object.assign(m.i._jogadores.get(biaId)!, { estado: 'sem-vidas', vidas: 0 });
  Object.assign(m.i._chefe, { x: 120, y: 170, estado: 'parada', ate: agora + 600_000 });
  m.andar(1000);
  // a Ana à direita, na faixa do meio (o leque mira nela)
  m.por(anaId, 260, 170);
  const ana_ = m.i._jogadores.get(anaId)!;
  ana_.invulAte = 0;
  const vidas = ana_.vidas;
  Object.assign(m.i._chefe, { estado: 'parada', ate: agora + 50, fila: ['leque'] });
  m.andar(100);
  const faixas = [...m.i._marcas.values()].filter((k) => k.tipo === 'faixa');
  assert.equal(faixas.length, mod.LEQUE.faixas);
  for (let t = 0; t < 2500; t += 50) {
    m.por(anaId, 260, 170);
    m.andar(50);
  }
  assert.equal(ana_.vidas, vidas - 1, 'na faixa do meio, levou');
  // de novo, agora entre a faixa do meio e a de cima (meio passo de ângulo, longe do corpo dela)
  m.andar(3000);
  ana_.invulAte = 0;
  const vidas2 = ana_.vidas;
  Object.assign(m.i._chefe, { x: 120, y: 170, estado: 'parada', ate: agora + 50, fila: ['leque'] });
  m.por(anaId, 260, 170);
  m.andar(100);
  const meio = mod.LEQUE.abertura / (mod.LEQUE.faixas - 1) / 2;
  const [ex, ey] = [120 + Math.cos(-meio) * 140, 170 + Math.sin(-meio) * 140];
  for (let t = 0; t < 2500; t += 50) {
    m.por(anaId, ex, ey);
    m.andar(50);
  }
  assert.equal(ana_.vidas, vidas2, 'entre as faixas, escapou');
  const q = m.quadros.at(-1) as { c: number[] };
  assert.equal(q.c[9], 2, 'o quadro diz que é a alpaca');
  m.jogo.parar!();
});

test('a alpaca na última fase: o leque vem duas vezes, com mais faixas; o recorde dela é à parte', async () => {
  const db = await import('../src/db.js');
  const m = comecar([anaId], 0, { chefe: 'alpaca' });
  m.i._chefe.fase = 2;
  Object.assign(m.i._chefe, { x: 240, y: 170, estado: 'parada', ate: agora + 50, fila: ['leque'] });
  m.andar(100);
  assert.equal([...m.i._marcas.values()].filter((k) => k.tipo === 'faixa').length, 2 * mod.LEQUE.faixasNoFim);
  assert.equal(varianteDoChefe('alpaca', false), 'alpaca');
  assert.equal(varianteDoChefe('alpaca', true), 'alpaca-dificil');
  assert.equal(db.recordeDoSolo(anaId, 'chefe', 'alpaca'), null);
  m.jogo.parar!();
});
