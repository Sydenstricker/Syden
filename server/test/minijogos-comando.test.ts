/**
 * O COMANDO CENOURA (minijogo-comando.ts, a regra em comando/motor.ts): os bichos são do servidor, num passo de 20 por
 * segundo; quem atira anuncia o tiro e manda o acerto, e o servidor confere o ritmo da arma e o caminho da bala pelo passado
 * do bicho; quem leva tem a folga. No fim, o piloto automático do site (o MESMO cliente da tela) vence a fase contra o
 * servidor de verdade, com 100 ms de internet em cada sentido.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-comando.js');
const { criarComando, criarComandoComBanco, PASSO_MS, GRACA_MS, VIDA, VIDAS, BICHOS, GRANADA, ONDAS_X, REFENS, ARMA_MS, INTERVALO, TIRO_INIMIGO } = mod;
const site = await import('../../web/src/comando/regras.ts');
const { pilotoAutomatico } = await import('../../web/src/comando/piloto.ts');
after(fechar);

const ler = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

let agora = 7_000_000;
const ana = await criarConta(app, 'ana-comando');
const bia = await criarConta(app, 'bia-comando');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do comando' })).json() as { id: number };

interface Bicho {
  id: number;
  tipo: string;
  x: number;
  h: number;
  hp: number;
  estado: string;
  ate: number;
  proximoAtaque: number;
  historia: { t: number; x: number; h: number }[];
}
interface Jog {
  x: number;
  h: number;
  vidas: number;
  hp: number;
  pontos: number;
  arma: string;
  estado: string;
  livreAte: number;
  invulAte: number;
}
interface Interno {
  _passo: () => void;
  _bichos: Map<number, Bicho>;
  _jogadores: Map<number, Jog>;
  _balas: Record<string, unknown>[];
  _gaiolas: number[];
  _motivo: () => string | null;
  _arena: () => [number, number];
  _fila: () => string[];
}

function comecar(naSala = [anaId, biaId], comunidadeId = comunidade.id) {
  let terminou = false;
  const quadros: Record<string, unknown>[] = [];
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidadeId,
    solo: comunidadeId === 0,
    difundir: (d: unknown) => quadros.push(d as Record<string, unknown>),
  };
  let passo: (() => void) | null = null;
  const jogo = criarComandoComBanco({ agora: () => agora, aleatorio: () => 0.5, intervalo: (p) => ((passo = p), 1), limpar: () => {} }).comecar(ctx, {
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
    /** Põe a pessoa num lugar (o teste não espera o coelho correr até lá). */
    por(id: number, x: number, h = 0) {
      i._jogadores.get(id)!.livreAte = agora + 1000;
      jogo.tempoReal!(id, { tipo: 'pos', x, h, lado: 1, acao: 0, ta: 0, mira: 0 });
    },
    /** Um bicho parado num lugar, sem atacar por um bom tempo. */
    bicho(tipo: string, x: number, h = 0): Bicho {
      i._fila().length = 0;
      const b: Bicho = { id: 900 + i._bichos.size, tipo, x, h, hp: BICHOS[tipo as keyof typeof BICHOS].hp, estado: 'recuperando', ate: agora + 600_000, proximoAtaque: agora + 600_000, historia: [] };
      Object.assign(b, { lado: -1, hpMax: b.hp, desde: agora, alvoX: 0, x0: x, golpes: 0, fogoFalta: 0, fogoEm: 0 });
      i._bichos.set(b.id, b);
      return b;
    },
  };
  return m;
}

test('as contas são duas cópias iguais byte a byte (servidor e site)', () => {
  assert.equal(ler('../src/comando/conta.ts'), ler('../../web/src/comando/conta.ts'));
  assert.equal(site.INVUL_MS, mod.INVUL_MS);
  assert.equal(site.INVUL_VOLTA_MS, mod.INVUL_VOLTA_MS);
});

test('as contas: o leque são três balas, a bala para no alcance, a caixa do bicho pega a bala que passa por ela', () => {
  assert.equal(mod.balasDoTiro(0, 'normal').length, 1);
  const leque = mod.balasDoTiro(0, 'leque');
  assert.equal(leque.length, 3);
  for (const [dx, dh] of leque) assert.ok(Math.abs(Math.sqrt(dx * dx + dh * dh) - 1) < 1e-9);
  assert.equal(mod.andouABala(60_000), mod.BALA.alcance);
  assert.equal(mod.balaNaCaixa(0, 20, 1, 0, 0, 200, 100, 0, 9, 38, 0), true, 'reta, na altura do corpo');
  assert.equal(mod.balaNaCaixa(0, 20, 1, 0, 0, 200, 100, 66, 9, 22, 0), false, 'o voador está no alto');
  assert.equal(mod.balaNaCaixa(0, 20, 0, 1, 0, 200, 0, 66, 9, 22, 0), true, 'para cima pega o voador');
  assert.equal(mod.balaNaCaixa(0, 20, 1, 0, 0, 50, 100, 0, 9, 38, 0), false, 'ainda não chegou');
  assert.equal(mod.pousoEm(140, 45, 36), 38, 'cai na tábua');
  assert.equal(mod.pousoEm(140, 30, 20), null, 'por baixo da tábua, passa');
  assert.equal(mod.apoiado(140, 38), true);
  assert.equal(site.miraDe({ ...site.comandosVazios(), cima: true, direita: true }, 1, false), 1);
  assert.equal(site.miraDe({ ...site.comandosVazios(), baixo: true }, 1, false), 0, 'no chão, para baixo não');
  assert.equal(site.miraDe({ ...site.comandosVazios(), baixo: true }, -1, true), 6, 'no ar, para baixo sim');
});

test('o passo é do servidor: 20 por segundo, o quadro leva os bichos, as gaiolas e os coelhos', () => {
  const m = comecar();
  m.andar(3000);
  assert.ok(m.quadros.length >= 59);
  const q = m.quadros.at(-1)! as { i: number[][]; j: number[][]; f: string; r: number[] };
  assert.equal(q.f, 'lutando');
  assert.ok(q.i.length >= 1, 'os bichos entram');
  assert.equal(q.j.length, 2);
  assert.equal(q.j[0][7], VIDAS);
  assert.deepEqual(q.r, [0, 0, 0]);
  m.jogo.parar!();
});

test('o tiro: com número, no ritmo da arma, de perto de si; o acerto confere o caminho pelo passado do bicho', () => {
  const m = comecar();
  m.por(anaId, 100);
  const b = m.bicho('cogumelo', 300);
  m.andar(200);
  assert.equal(m.manda(anaId, { tipo: 'tiro', n: 1, x: 220, h: 20, dir: 0 }), 'longe de si');
  assert.equal(m.manda(anaId, { tipo: 'tiro', n: 1, x: 112, h: 20, dir: 9 }), 'direção');
  // para cima: passa longe dele
  assert.equal(m.manda(anaId, { tipo: 'tiro', n: 1, x: 112, h: 20, dir: 2 }), null);
  m.andar(300);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 1, k: 0, inimigo: b.id }), 'longe do bicho');
  // reto: cedo demais, e depois sim
  assert.equal(m.manda(anaId, { tipo: 'tiro', n: 2, x: 112, h: 20, dir: 0 }), null);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, inimigo: b.id }), 'longe do bicho', 'cedo demais');
  m.andar(150);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, inimigo: b.id }), 'longe do bicho', 'ainda cedo');
  m.andar(300);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, inimigo: b.id }), null);
  assert.equal(b.hp, BICHOS.cogumelo.hp - 1);
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 0, inimigo: b.id }), 'bala usada', 'uma bala acerta uma vez');
  assert.equal(m.manda(anaId, { tipo: 'acerto', n: 2, k: 1, inimigo: b.id }), 'bala', 'a arma de sempre não tem leque');
  assert.equal(m.manda(anaId, { tipo: 'tiro', n: 2, x: 112, h: 20, dir: 0 }), 'número', 'o mesmo número não sai duas vezes');
  // o ritmo: uma rajada de dez de uma vez não passa
  const motivos = Array.from({ length: 10 }, (_, k) => m.manda(anaId, { tipo: 'tiro', n: 10 + k, x: 112, h: 20, dir: 0 }));
  assert.ok(motivos.includes('depressa demais'), motivos.join(', '));
  assert.ok(motivos.filter((x) => x === null).length <= 4);
  m.jogo.parar!();
});

test('derrubado, o bicho vira fumaça e dá os pontos dele', () => {
  const m = comecar();
  m.por(anaId, 100);
  const b = m.bicho('abelha', 112, 66);
  m.andar(200);
  for (let k = 1; k <= BICHOS.abelha.hp; k++) {
    m.andar(INTERVALO.normal);
    assert.equal(m.manda(anaId, { tipo: 'tiro', n: k, x: 100, h: 30, dir: 2 }), null);
    m.andar(150);
    assert.equal(m.manda(anaId, { tipo: 'acerto', n: k, k: 0, inimigo: b.id }), null);
  }
  assert.equal(b.estado, 'morto');
  const j = m.i._jogadores.get(anaId)!;
  assert.equal(j.pontos, BICHOS.abelha.hp * 10 + BICHOS.abelha.pontos);
  m.jogo.parar!();
});

test('a granada: com recarga, e explode onde cai, no relógio do servidor', () => {
  const m = comecar();
  m.por(anaId, 100);
  const b = m.bicho('dino', 100 + GRANADA.alcance);
  m.andar(200);
  assert.equal(m.manda(anaId, { tipo: 'granada', x: 100, h: 0, lado: 1 }), null);
  assert.equal(m.manda(anaId, { tipo: 'granada', x: 100, h: 0, lado: 1 }), 'recarga');
  assert.equal(b.hp, BICHOS.dino.hp, 'ainda voando');
  m.andar(GRANADA.voo + 100);
  assert.equal(b.estado, 'morto', 'a explosão (5) derruba o atirador (5)');
  m.andar(GRANADA.recarga);
  assert.equal(m.manda(anaId, { tipo: 'granada', x: 100, h: 0, lado: 1 }), null);
  m.jogo.parar!();
});

test('a gaiola: só de perto, uma vez, e dá o reforço por um tempo', () => {
  const m = comecar();
  // a primeira gaiola fica entre a arena 1 e a 2: só se chega com a onda vencida
  m.i._fila().length = 0;
  for (const b of m.i._bichos.values()) b.hp = 0;
  m.i._bichos.clear();
  m.andar(200);
  assert.deepEqual(m.i._arena(), [0, ONDAS_X[1] + 320]);
  m.por(anaId, REFENS[0][0] - 60);
  assert.equal(m.manda(anaId, { tipo: 'soltar', gaiola: 0 }), 'longe da gaiola');
  m.por(anaId, REFENS[0][0] - 5);
  assert.equal(m.manda(anaId, { tipo: 'soltar', gaiola: 0 }), null);
  m.por(biaId, REFENS[0][0]);
  assert.equal(m.manda(biaId, { tipo: 'soltar', gaiola: 0 }), 'já aberta');
  const j = m.i._jogadores.get(anaId)!;
  assert.equal(j.arma, REFENS[0][1]);
  assert.equal(j.pontos, 200);
  assert.deepEqual(m.i._gaiolas, [anaId, 0, 0]);
  m.andar(ARMA_MS + 100);
  assert.equal(j.arma, 'normal', 'o reforço acaba');
  m.jogo.parar!();
});

test('a bala do atirador: quem fica leva; quem pula dentro da folga escapa; três golpes custam uma vida', () => {
  const m = comecar();
  m.por(anaId, 100);
  m.por(biaId, 104);
  m.andar(1600);
  m.i._fila().length = 0;
  m.i._bichos.clear();
  const ja = m.i._balas.length;
  m.i._balas.push({ id: 5000, tipo: 0, x: 140, h: TIRO_INIMIGO.h, vx: -TIRO_INIMIGO.vel, vh: 0, raio: 4, ate: agora + 4000 });
  for (let t = 0; t < 900; t += 50) {
    m.por(anaId, 100);
    // a Bia pula quando a bala está quase nela (o servidor decide 200 ms depois)
    m.por(biaId, 104, t >= 150 && t <= 650 ? 30 : 0);
    m.andar(50);
  }
  void ja;
  assert.equal(m.i._jogadores.get(anaId)!.hp, VIDA - 1, 'a Ana levou');
  assert.equal(m.i._jogadores.get(biaId)!.hp, VIDA, 'a Bia escapou');
  // mais dois e a Ana perde uma vida, e volta piscando
  for (let k = 0; k < 2; k++) {
    m.andar(1500);
    m.i._balas.push({ id: 5001 + k, tipo: 0, x: 130, h: TIRO_INIMIGO.h, vx: -TIRO_INIMIGO.vel, vh: 0, raio: 4, ate: agora + 4000 });
    for (let t = 0; t < 700; t += 50) {
      m.por(anaId, 100);
      m.andar(50);
    }
  }
  const a = m.i._jogadores.get(anaId)!;
  assert.equal(a.vidas, VIDAS - 1);
  assert.equal(a.estado, 'fora');
  m.andar(2200);
  assert.equal(a.estado, 'em-pe');
  assert.equal(a.hp, VIDA);
  assert.ok(a.invulAte > agora);
  void GRACA_MS;
  m.jogo.parar!();
});

test('a posição não corre mais que o coelho, nem sobe mais que o pulo', () => {
  const m = comecar();
  m.andar(1200);
  const j = m.i._jogadores.get(anaId)!;
  const x = j.x;
  m.andar(100);
  m.manda(anaId, { tipo: 'pos', x: x + 200, h: 90, lado: 1, acao: 0, ta: 0, mira: 0 });
  assert.ok(j.x - x < 30, `correu ${j.x - x}`);
  assert.ok(j.h <= 40, `subiu ${j.h}`);
  m.jogo.parar!();
});

test('ninguém da turma na sala: a fase acaba, sem troféu', () => {
  const sala = [anaId, biaId];
  const m = comecar(sala);
  m.andar(500);
  sala.length = 0;
  m.andar(100);
  assert.equal((m.jogo.publico(anaId) as { fase: string }).fase, 'derrota');
  m.disparar();
  assert.equal(m.terminou(), true);
});

/**
 * A fase inteira: o servidor de verdade num relógio de mão, cada pessoa com o cliente da tela e o piloto, e a rede com IDA ms
 * em cada sentido.
 */
async function partida(ids: number[], IDA = 100, sementeInicial = 7) {
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
  const ctx = {
    agendar: (_ms: number, depois: () => void) => {
      fim = depois;
    },
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => ids,
    nome: (id: number) => `p${id}`,
    comunidade: ids.length > 1 ? 5 : 0,
    solo: ids.length === 1,
    difundir: (d: unknown) => {
      for (const id of ids) rede.push({ em: t0 + IDA, para: id, de: 0, dados: d });
    },
  };
  const jogo = criarComando({
    agora: () => t0,
    aleatorio,
    intervalo: (p) => ((passo = p), 1),
    limpar: () => {},
    servicos: { avatarDe: () => null, guardarTrofeu: (t) => trofeus.push(t) },
  }).comecar(ctx, { naSala: ids, criadaPor: ids[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const clientes = ids.map((id) => ({ c: new site.Cliente(id, (dados: unknown) => rede.push({ em: t0 + IDA, para: 0, de: id, dados })), cmd: site.comandosVazios() }));
  let ultimo: import('../../web/src/comando/regras.ts').Quadro | null = null;
  let k = 0;
  const inicio = t0;
  for (let ms = 0; ms < 8 * 60_000 && !terminou; ms += 1000 / 60) {
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
      if (c.jogando()) pilotoAutomatico(c.eu, v, cmd);
      c.passo(cmd, 1 / 60, t0, v);
    }
    if (ultimo && ultimo.f !== 'lutando' && ultimo.f !== 'avancando' && fim) {
      fim();
      break;
    }
  }
  return { ultimo: ultimo!, publico: jogo.publico(ids[0]) as Record<string, unknown>, segundos: (t0 - inicio) / 1000, trofeus };
}

test('sozinho, com 200 ms de ida e volta, o piloto vence a fase e abre as gaiolas', async (t) => {
  const { ultimo, segundos, trofeus } = await partida([7]);
  t.diagnostic(`a fase levou ${Math.round(segundos)} s; vidas ${ultimo.j[0][7]}, pontos ${ultimo.j[0][9]}, onda ${ultimo.o + 1}; gaiolas ${ultimo.r.join(',')}`);
  assert.equal(ultimo.f, 'vitoria', `fase ${ultimo.f} na onda ${ultimo.o + 1}`);
  assert.ok(segundos < 4 * 60, 'a fase é curta');
  assert.ok(ultimo.r.every((g) => g === 7), 'as três gaiolas abertas');
  assert.equal(trofeus.length, 0, 'no Solo, sem troféu');
});

test('com três, a turma vence junta, e o pódio vai à estante', async (t) => {
  const { ultimo, publico, segundos, trofeus } = await partida([11, 12, 13], 100, 3);
  t.diagnostic(`a fase levou ${Math.round(segundos)} s; vidas ${ultimo.j.map((l) => l[7]).join(', ')}; pontos ${ultimo.j.map((l) => l[9]).join(', ')}`);
  assert.equal(ultimo.f, 'vitoria');
  const r = publico.resultado as { pontos: number; posicao: number | null }[];
  assert.ok(r.every((l) => l.pontos > 0), 'todo mundo acertou alguma coisa');
  assert.ok(trofeus.length >= 2 && trofeus.every((x) => x.pista === 'comando' && x.posicao <= 3));
});
