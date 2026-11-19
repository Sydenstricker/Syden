/**
 * A Masmorra da Toca (minijogo-masmorra.ts): o mundo é do servidor, cada coelho anda no computador de quem joga. Aqui o
 * relógio é de mão, e um "site" de mentira roda o piloto automático (masmorra-regras.ts, o mesmo do e2e) com o passo do
 * coelho do site, mandando ao servidor de verdade só o que o site manda: a posição, o golpe, o acerto, o empurrão e a porta.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarMasmorra, PASSO_MS, FIM_MS, VOLTA_MS } = await import('../src/minijogo-masmorra.js');
const R = await import('../src/masmorra-regras.js');
after(fechar);

let agora = 5_000_000;
const ana = await criarConta(app, 'ana-masmorra');
const bia = await criarConta(app, 'bia-masmorra');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (
  await comToken(app, ana.token)('POST', '/api/communities', {
    name: 'Turma da masmorra',
  })
).json() as { id: number };

interface Interno {
  _passo: () => void;
  _bichos: Map<
    number,
    {
      id: number;
      tipo: string;
      x: number;
      y: number;
      estado: string;
      hp: number;
      historia: unknown[];
    }
  >;
  _jogadores: Map<
    number,
    {
      x: number;
      y: number;
      hp: number;
      estado: string;
      livreAte: number;
      pontos: number;
    }
  >;
  _motivo: () => string | null;
  _sala: () => number;
}

function comecar(naSala: number[], comunidadeId: number, aleatorio = () => 0.5, corpo: Record<string, unknown> = {}) {
  const quadros: import('../src/masmorra-regras.js').Quadro[] = [];
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  let passo: (() => void) | null = null;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {
      terminou = true;
    },
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidadeId,
    difundir: (d: unknown) => quadros.push(d as import('../src/masmorra-regras.js').Quadro),
  };
  const jogo = criarMasmorra({
    agora: () => agora,
    aleatorio,
    intervalo: (p) => {
      passo = p;
      return 1;
    },
    limpar: () => {},
  }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    interno: jogo as unknown as Interno,
    quadros,
    relogio,
    terminou: () => terminou,
    passo: () => {
      agora += PASSO_MS;
      passo!();
    },
    mandar: (id: number, d: Record<string, unknown>) => {
      jogo.tempoReal!(id, d);
      return (jogo as unknown as Interno)._motivo();
    },
  };
}

/**
 * O SITE DE MENTIRA de uma pessoa: o coelho dela anda pelo passo do site (60 por segundo), o piloto aperta as teclas, e o que o
 * site mandaria vai ao servidor.
 */
function site(m: ReturnType<typeof comecar>, eu: number) {
  const c = R.novoCoelho(0, 0);
  const cmd = R.comandosVazios();
  let tp = -1;
  let golpeAtual: { id: number; g: string } | null = null;
  const acertados = new Set<number>();
  let cenoura: import('../src/masmorra-regras.js').Cenoura | null = null;
  const vistos = new Set<number>();
  let portaEm = -1e9;
  return {
    c,
    passo() {
      const q = m.quadros.at(-1);
      if (!q || q.f !== 'jogando') return;
      const meu = q.j.find((l) => l[0] === eu)!;
      if (meu[11] !== tp) {
        tp = meu[11] as number;
        c.x = meu[1] as number;
        c.y = meu[2] as number;
        cenoura = null;
      }
      for (const e of q.e) {
        const [id, tipo, quem, , deX, deY] = e as [number, string, number, number, number, number];
        if (vistos.has(id)) continue;
        vistos.add(id);
        if (tipo === 'p' && quem === eu) R.apanhar(c, deX, deY);
      }
      if (meu[7] !== 0) return;
      const sala = R.SALAS[q.s];
      const mundo = R.mundoDoQuadro(q);
      const bichos = q.i.map((l) => ({
        id: l[0],
        tipo: R.TIPOS[l[1]],
        x: l[2],
        y: l[3],
        z: l[4],
        estado: R.ESTADOS[l[5]],
      }));
      R.piloto(
        {
          sala,
          m: mundo,
          eu: c,
          temCenoura: q.it[0] === 1,
          chaves: q.it[1],
          placasResolvidas: q.pr === 1,
          bauAberto: q.bau === 2,
          bichos,
        },
        cmd,
      );
      for (let k = 0; k < 3; k++) {
        const nov = R.passoDoCoelho(sala, mundo, c, cmd, 1 / 60, q.it[0] === 1);
        if (nov.comecou) {
          golpeAtual = nov.comecou;
          acertados.clear();
          m.mandar(eu, {
            tipo: 'pos',
            x: c.x,
            y: c.y,
            dir: c.dir,
            acao: R.ACOES.indexOf(c.acao),
            ta: 0,
            tp,
            ataque: nov.comecou,
          });
          if (nov.comecou.g === 'cenoura') {
            const [dx, dy] = R.DIRS[c.dir];
            cenoura = {
              id: nov.comecou.id,
              x: c.x,
              y: c.y,
              dx,
              dy,
              andou: 0,
              volta: false,
              t: 0,
            };
          }
        }
        if (nov.empurrar !== undefined) m.mandar(eu, { tipo: 'empurrar', dir: nov.empurrar });
        if (nov.porta && agora - portaEm > 300) {
          portaEm = agora;
          m.mandar(eu, { tipo: 'porta', lado: nov.porta });
        }
        // o golpe da pá: no tempo dele, o que encosta vai ao servidor
        if (golpeAtual?.g === 'pa' && c.acao === 'pa' && c.t >= R.PA.de && c.t <= R.PA.ate) {
          const [dx, dy] = R.DIRS[c.dir];
          for (const b of bichos) {
            if (acertados.has(b.id) || b.estado === 'morto' || b.z > 12) continue;
            if (Math.hypot(b.x - (c.x + dx * R.PA.frente), b.y - (c.y + dy * R.PA.frente)) > R.PA.raio + R.BICHOS[b.tipo].raio) continue;
            acertados.add(b.id);
            m.mandar(eu, {
              tipo: 'golpe',
              a: golpeAtual.id,
              inimigo: b.id,
              x: c.x,
              y: c.y,
            });
          }
        }
        if (cenoura) {
          const r = R.passoDaCenoura(sala, mundo, cenoura, c, 1 / 60);
          if (r.bateu && sala.grade[r.bateu[1]]?.[r.bateu[0]] === 'K')
            m.mandar(eu, {
              tipo: 'cristal',
              a: cenoura.id,
              x: cenoura.x,
              y: cenoura.y,
            });
          for (const b of bichos) {
            if (acertados.has(b.id) || b.estado === 'morto') continue;
            if (Math.hypot(b.x - cenoura.x, b.y - cenoura.y) > R.CENOURA.raio + R.BICHOS[b.tipo].raio) continue;
            acertados.add(b.id);
            m.mandar(eu, {
              tipo: 'golpe',
              a: cenoura.id,
              inimigo: b.id,
              x: cenoura.x,
              y: cenoura.y,
            });
          }
          if (r.fim) cenoura = null;
        }
      }
      m.mandar(eu, {
        tipo: 'pos',
        x: c.x,
        y: c.y,
        dir: c.dir,
        acao: R.ACOES.indexOf(c.acao),
        ta: Math.round(c.t),
        tp,
      });
    },
  };
}

test('as duas cópias das regras são iguais byte a byte', () => {
  const doServidor = readFileSync(new URL('../src/masmorra-regras.ts', import.meta.url));
  const doSite = readFileSync(new URL('../../web/src/masmorra/regras.ts', import.meta.url));
  assert.ok(doServidor.equals(doSite), 'server/src/masmorra-regras.ts e web/src/masmorra/regras.ts diferem');
});

test('as salas: 17 × 11, bordas de parede, e as portas ligam dos dois lados', () => {
  for (const s of R.SALAS) {
    assert.equal(s.grade.length, R.LINHAS, `sala ${s.id}`);
    for (const linha of s.grade) assert.equal(linha.length, R.COLS, `sala ${s.id}: ${linha}`);
    for (const [lado, p] of Object.entries(s.portas)) {
      const volta = R.SALAS[p!.para].portas[R.OPOSTO[lado as 'n']];
      assert.equal(volta?.para, s.id, `a porta ${lado} da sala ${s.id} não tem volta`);
      // a chegada de cada lado é chão
      const [x, y] = R.CHEGADA[lado as 'n'];
      for (const k of R.AO_LADO) {
        const vertical = lado === 'n' || lado === 's';
        assert.ok(
          R.livre(s, { blocos: [], bau: true, ponte: false, abertas: [] }, x + (vertical ? k : 0), y + (vertical ? 0 : k), R.RAIO, 'coelho'),
          `chegada ${lado} da sala ${s.id}`,
        );
      }
    }
  }
});

test('SOZINHO, o piloto atravessa a masmorra inteira contra o servidor de verdade: bichos, baú, botões com o bloco, cristal, chave e o chefe', () => {
  const m = comecar([anaId], 0);
  const ana_ = site(m, anaId);
  const salas = new Set<number>();
  for (let k = 0; k < 20 * 60 * 20 && m.quadros.at(-1)?.f !== 'vitoria'; k++) {
    ana_.passo();
    m.passo();
    salas.add(m.interno._sala());
  }
  const q = m.quadros.at(-1)!;
  assert.equal(q.f, 'vitoria', `parou na sala ${q.s} (visitou ${[...salas].join(',')}); itens ${q.it}`);
  assert.deepEqual([...salas].sort(), [0, 1, 2, 3, 4, 5, 6]);
  agora += FIM_MS;
  m.relogio[0].depois();
  assert.equal(m.terminou(), true);
  const pub = m.jogo.publico(anaId) as {
    fase: string;
    venceu: boolean;
    resultado: { pontos: number }[];
  };
  assert.equal(pub.fase, 'fim');
  assert.equal(pub.venceu, true);
  assert.ok(pub.resultado[0].pontos > 0);
});

async function trofeus(token: string) {
  return ((await comToken(app, token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number }[]).filter((t) => t.pista === 'masmorra');
}

test('COM A TURMA, os dois pilotos terminam juntos, e o pódio vai para a estante', async () => {
  const antes = (await trofeus(ana.token)).length + (await trofeus(bia.token)).length;
  const m = comecar([anaId, biaId], comunidade.id);
  const a = site(m, anaId);
  const b = site(m, biaId);
  for (let k = 0; k < 20 * 60 * 20 && m.quadros.at(-1)?.f !== 'vitoria'; k++) {
    a.passo();
    b.passo();
    m.passo();
  }
  assert.equal(m.quadros.at(-1)!.f, 'vitoria', `parou na sala ${m.quadros.at(-1)!.s}`);
  agora += FIM_MS;
  m.relogio[0].depois();
  const depois = (await trofeus(ana.token)).length + (await trofeus(bia.token)).length;
  assert.ok(depois >= antes + 2, `troféus: ${antes} → ${depois}`);
});

test('os botões pedem os dois ao mesmo tempo: duas pessoas abrem a porta do norte', () => {
  const m = comecar([anaId, biaId], comunidade.id);
  // até a encruzilhada, à mão: a entrada e o salão limpo
  const j = (id: number) => m.interno._jogadores.get(id)!;
  const por = (id: number, x: number, y: number) => {
    j(id).livreAte = agora + 1000;
    m.mandar(id, {
      tipo: 'pos',
      x,
      y,
      dir: 1,
      acao: 0,
      ta: 0,
      tp: (j(id) as unknown as { tp: number }).tp,
    });
  };
  por(anaId, ...R.centro(8, 2));
  assert.equal(m.mandar(anaId, { tipo: 'porta', lado: 'n' }), 'longe');
  por(anaId, ...R.centro(8, 0));
  assert.equal(m.mandar(anaId, { tipo: 'porta', lado: 'n' }), null);
  assert.equal(m.interno._sala(), 1);
  // o salão fecha até ficar limpo
  m.passo();
  // a oeste, a parede rachada da sala secreta (19/11/2026): 4
  assert.deepEqual(m.quadros.at(-1)!.p, [2, 2, 4, 0]);
  por(anaId, ...R.centro(8, 1));
  assert.equal(m.mandar(anaId, { tipo: 'porta', lado: 'n' }), 'fechada');
  for (const b of m.interno._bichos.values()) b.hp = 0;
  m.interno._bichos.clear();
  m.passo();
  assert.deepEqual(m.quadros.at(-1)!.p, [1, 1, 4, 0]);
  por(anaId, ...R.centro(8, 0));
  m.mandar(anaId, { tipo: 'porta', lado: 'n' });
  assert.equal(m.interno._sala(), 2);
  m.passo();
  assert.deepEqual(m.quadros.at(-1)!.p.slice(0, 1), [2], 'o norte começa fechado');
  // uma pessoa num botão só não abre
  m.passo();
  por(anaId, ...R.centro(5, 3));
  m.passo();
  assert.deepEqual(m.quadros.at(-1)!.pl, [1, 0]);
  assert.equal(m.quadros.at(-1)!.pr, 0);
  // as duas: abre, e fica aberta quando saem
  por(biaId, ...R.centro(11, 3));
  m.passo();
  assert.equal(m.quadros.at(-1)!.pr, 1);
  por(anaId, ...R.centro(8, 5));
  por(biaId, ...R.centro(8, 5));
  m.passo();
  assert.equal(m.quadros.at(-1)!.p[0], 1, 'o norte abriu para sempre');
  m.jogo.parar!();
});

test('quem bate tem razão, mas dentro do que a tela mostrou: longe, sem golpe, ou do outro lado da sala não vale', () => {
  const m = comecar([anaId], 0);
  const j = m.interno._jogadores.get(anaId)!;
  const por = (x: number, y: number, extra: Record<string, unknown> = {}) => {
    j.livreAte = agora + 1000;
    m.mandar(anaId, {
      tipo: 'pos',
      x,
      y,
      dir: 3,
      acao: 0,
      ta: 0,
      tp: (j as unknown as { tp: number }).tp,
      ...extra,
    });
  };
  por(...R.centro(8, 0));
  m.mandar(anaId, { tipo: 'porta', lado: 'n' });
  for (let k = 0; k < 20; k++) m.passo();
  const b = [...m.interno._bichos.values()].find((x) => x.tipo === 'cogumelo')!;
  // sem golpe anunciado
  assert.equal(
    m.mandar(anaId, {
      tipo: 'golpe',
      a: 1,
      inimigo: b.id,
      x: b.x - 30,
      y: b.y,
    }),
    'golpe que não começou',
  );
  // anunciado, mas longe de onde o servidor me viu
  por(...R.centro(14, 9), { ataque: { id: 1, g: 'pa' } });
  assert.equal(
    m.mandar(anaId, {
      tipo: 'golpe',
      a: 1,
      inimigo: b.id,
      x: b.x - 30,
      y: b.y,
    }),
    'longe de si',
  );
  // perto de mim, mas o bicho estava longe do golpe
  assert.equal(
    m.mandar(anaId, {
      tipo: 'golpe',
      a: 1,
      inimigo: b.id,
      x: R.centro(14, 9)[0],
      y: R.centro(14, 9)[1],
    }),
    'longe do bicho',
  );
  // perto dele: vale, e só uma vez por golpe
  por(b.x - 34, b.y, { ataque: { id: 2, g: 'pa' } });
  assert.equal(
    m.mandar(anaId, {
      tipo: 'golpe',
      a: 2,
      inimigo: b.id,
      x: b.x - 34,
      y: b.y,
    }),
    null,
  );
  assert.equal(
    m.mandar(anaId, {
      tipo: 'golpe',
      a: 2,
      inimigo: b.id,
      x: b.x - 34,
      y: b.y,
    }),
    'já acertou',
  );
  // a cenoura sem ter achado o baú não começa
  por(b.x - 34, b.y, { ataque: { id: 3, g: 'cenoura' } });
  assert.equal(m.mandar(anaId, { tipo: 'golpe', a: 3, inimigo: b.id, x: b.x, y: b.y }), 'golpe que não começou');
  m.jogo.parar!();
});

test('não se atravessa parede, e quem fica sem corações volta na porta de entrada', () => {
  const m = comecar([anaId], 0);
  const j = m.interno._jogadores.get(anaId)!;
  const [x0, y0] = [j.x, j.y];
  // um pilar da entrada (4, 3): a posição dentro dele não é aceita
  j.livreAte = agora + 1000;
  m.mandar(anaId, {
    tipo: 'pos',
    x: R.centro(4, 3)[0],
    y: R.centro(4, 3)[1],
    dir: 1,
    acao: 0,
    ta: 0,
    tp: (j as unknown as { tp: number }).tp,
  });
  assert.deepEqual([j.x, j.y], [x0, y0]);
  // longe demais de uma vez: só anda o que dá
  j.livreAte = 0;
  agora += 200;
  m.mandar(anaId, {
    tipo: 'pos',
    x: x0,
    y: y0 - 300,
    dir: 1,
    acao: 0,
    ta: 0,
    tp: (j as unknown as { tp: number }).tp,
  });
  assert.ok(y0 - j.y < 60, `andou ${y0 - j.y}`);
  // sem corações: fora, e volta cheio na entrada
  j.hp = 0;
  j.estado = 'fora';
  (j as unknown as { voltaEm: number }).voltaEm = agora + VOLTA_MS;
  for (let k = 0; k < VOLTA_MS / PASSO_MS + 2; k++) m.passo();
  assert.equal(j.estado, 'em-pe');
  assert.equal(j.hp, R.CORACOES);
  assert.ok(Math.abs(j.y - R.CHEGADA.s[1]) < 1);
  m.jogo.parar!();
});

test('sozinho: começa pela rota do Solo, e encerrar desliga', async () => {
  const comAna = comToken(app, ana.token);
  const r = await comAna('POST', '/api/minijogo-solo', { jogo: 'masmorra' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().partida.jogo, 'masmorra');
  assert.equal(r.json().partida.fase, 'jogando');
  await comAna('DELETE', '/api/minijogo-solo');
  assert.equal((await comAna('GET', '/api/minijogo-solo')).json().partida, null);
});

// ---------------- Os vasos, as moitas, a bomba e a sala secreta (19/11/2026) ----------------

test('o vaso se levanta e se joga (o servidor anda o vaso e acerta o bicho); a moita a pá corta e solta o que o servidor sorteia', () => {
  const m = comecar([anaId, biaId], comunidade.id, () => 0.1);
  const i = m.interno as unknown as Interno & {
    _entrar: (d: number, l: null) => void;
    _coracoes: unknown[];
    _sementes: () => number;
  };
  const j = i._jogadores.get(anaId)! as unknown as {
    x: number;
    y: number;
    dir: number;
    livreAte: number;
    tp: number;
    carrega: boolean;
    ultimoAtaque: number;
  };
  const por = (x: number, y: number, dir: number, extra: Record<string, unknown> = {}) => {
    j.livreAte = agora + 1000;
    m.mandar(anaId, {
      tipo: 'pos',
      x,
      y,
      dir,
      acao: 0,
      ta: 0,
      tp: j.tp,
      ...extra,
    });
  };
  m.passo();
  // a entrada tem um vaso em (2, 7): longe não levanta; perto, sim
  assert.equal(m.mandar(anaId, { tipo: 'levantar', c: 2, l: 7 }), 'longe');
  por(...R.centro(3, 7), 2);
  assert.equal(m.mandar(anaId, { tipo: 'levantar', c: 2, l: 7 }), null);
  assert.equal(j.carrega, true);
  assert.equal(m.mandar(anaId, { tipo: 'levantar', c: 14, l: 7 }), 'já carrega');
  m.passo();
  assert.deepEqual(m.quadros.at(-1)!.o, [[2, 7]], 'o vaso saiu da sala');
  assert.equal(m.quadros.at(-1)!.j.find((l) => l[0] === anaId)![12], 1, 'e vai na cabeça');
  // jogado para a direita, ele voa e quebra no fim do alcance; com o sorteio em 0,1, sai um coração
  por(...R.centro(3, 7), 3);
  assert.equal(m.mandar(anaId, { tipo: 'jogar' }), null);
  for (let k = 0; k < 20; k++) m.passo();
  assert.equal(m.quadros.at(-1)!.r!.length, 0, 'o vaso já caiu');
  assert.equal(i._coracoes.length, 1, 'e soltou um coração');
  // a moita (2, 2): sem golpe, não corta; com a pá, sim
  por(...R.centro(3, 2), 2);
  assert.equal(m.mandar(anaId, { tipo: 'cortar', a: 99, c: 2, l: 2 }), 'sem golpe');
  por(...R.centro(3, 2), 2, { ataque: { id: j.ultimoAtaque + 1, g: 'pa' } });
  assert.equal(m.mandar(anaId, { tipo: 'cortar', a: j.ultimoAtaque, c: 2, l: 2 }), null);
  assert.equal(m.mandar(anaId, { tipo: 'cortar', a: j.ultimoAtaque, c: 2, l: 2 }), 'sem moita', 'uma vez só');
});

test('a bomba de semente abre a parede rachada do salão; a sala secreta tem o coração grande, um coração a mais para a turma', () => {
  const m = comecar([anaId, biaId], comunidade.id, () => 0.9);
  const i = m.interno as unknown as Interno & {
    _entrar: (d: number, l: 'n' | 's' | 'o' | 'l' | null) => void;
    _sementes: () => number;
  };
  const j = i._jogadores.get(anaId)! as unknown as {
    x: number;
    y: number;
    livreAte: number;
    tp: number;
    hp: number;
    hpMax: number;
  };
  const por = (x: number, y: number) => {
    j.livreAte = agora + 1000;
    m.mandar(anaId, { tipo: 'pos', x, y, dir: 2, acao: 0, ta: 0, tp: j.tp });
  };
  i._entrar(1, 's');
  for (const b of i._bichos.values()) b.hp = 0;
  i._bichos.clear();
  m.passo();
  // a porta oeste é a parede rachada: andar contra ela não abre
  por(...R.centro(1, 5));
  assert.equal(m.mandar(anaId, { tipo: 'porta', lado: 'o' }), 'fechada');
  assert.equal(i._sementes(), R.BOMBA.inicio);
  assert.equal(m.mandar(anaId, { tipo: 'bomba' }), null);
  assert.equal(i._sementes(), R.BOMBA.inicio - 1);
  // a ana sai de perto antes de estourar
  por(...R.centro(4, 5));
  por(...R.centro(7, 5));
  for (let k = 0; k < Math.ceil(R.BOMBA.pavio / PASSO_MS) + 6; k++) {
    if (k % 3 === 0) por(...R.centro(7, 5));
    m.passo();
  }
  assert.equal(m.quadros.at(-1)!.p[2], 1, 'a parede rachada abriu');
  assert.equal(j.hp, R.CORACOES, 'quem saiu de perto não levou');
  por(...R.centro(1, 5));
  por(...R.centro(0, 5));
  assert.equal(m.mandar(anaId, { tipo: 'porta', lado: 'o' }), null);
  assert.equal(i._sala(), R.SALA_SECRETA);
  // o coração grande
  const [hx, hy] = R.centro(...R.casasDe(R.SALAS[R.SALA_SECRETA], 'H')[0]);
  m.passo();
  for (let k = 0; k < 12; k++) {
    const [x0, y0] = [j.x, j.y];
    por(x0 + (hx - x0) * 0.3, y0 + (hy - y0) * 0.3);
    m.passo();
  }
  por(hx, hy);
  m.passo();
  assert.equal(j.hpMax, R.CORACOES + R.CORACAO_GRANDE);
  assert.equal((i._jogadores.get(biaId) as unknown as { hpMax: number }).hpMax, R.CORACOES + R.CORACAO_GRANDE, 'para a turma toda');
  assert.equal(m.quadros.at(-1)!.cg, 1);
});

test('no Solo, a masmorra vencida vira o recorde de tempo da pessoa (a tabela comum, pelo relógio do servidor)', async () => {
  const db = await import('../src/db.js');
  const m = comecar([anaId], 0);
  const i = m.interno as unknown as Interno & {
    _entrar: (d: number, l: 'n' | 's' | null) => void;
  };
  agora += 90_000;
  i._entrar(R.SALA_DO_CHEFE, 's');
  i._bichos.clear();
  m.passo();
  assert.equal(m.relogio.length, 1, 'a vitória marca o fim');
  m.relogio[0].depois();
  assert.ok(m.terminou());
  const r = db.recordeDoSolo(anaId, 'masmorra');
  assert.ok(r && r.valor >= 90_000 && r.valor < 100_000, `o tempo: ${r?.valor}`);
  const pub = m.jogo.publico(anaId) as {
    recorde: { tempoMs: number; novo: boolean };
  };
  assert.equal(pub.recorde.novo, true);
  assert.equal(pub.recorde.tempoMs, r!.valor);
});

// ---------------- A segunda masmorra: a mina dos postes (19/11/2026) ----------------

test('a mina dos postes: começa na entrada dela, ramificada; o gancho do baú do oeste atravessa o lago do leste até o poste', () => {
  const m = comecar([anaId, biaId], comunidade.id, () => 0.9, { masmorra: 'mina' });
  const i = m.interno as unknown as Interno & { _entrar: (d: number, l: 'n' | 's' | 'o' | 'l' | null) => void };
  assert.equal(i._sala(), R.MASMORRAS.mina.inicio);
  assert.equal((m.jogo.publico(anaId) as { masmorra: string }).masmorra, 'mina');
  const j = i._jogadores.get(anaId)! as unknown as { x: number; y: number; dir: number; livreAte: number; tp: number };
  const por = (x: number, y: number, dir: number) => {
    j.livreAte = agora + 1000;
    m.mandar(anaId, { tipo: 'pos', x, y, dir, acao: 0, ta: 0, tp: j.tp });
  };
  // a encruzilhada tem o norte trancado (a chave está do outro lado do lago)
  i._entrar(9, 's');
  i._bichos.clear();
  m.passo();
  assert.equal(m.quadros.at(-1)!.p[0], 3, 'o norte trancado');
  // o lago do leste, sem o gancho: não atravessa
  i._entrar(11, 'o');
  i._bichos.clear();
  m.passo();
  por(...R.centro(6, 3), 3);
  assert.equal(m.mandar(anaId, { tipo: 'gancho', dir: 3 }), 'sem gancho');
  // o oeste: limpa a sala, o baú aparece e dá o gancho
  i._entrar(10, 'l');
  i._bichos.clear();
  m.passo();
  const [bx, by] = R.centro(...R.casasDe(R.SALAS[10], 'C')[0]);
  por(bx, by + R.TILE, 1);
  m.passo();
  assert.equal(m.quadros.at(-1)!.it[3], 1, 'a turma tem o gancho');
  // de volta ao lago: o gancho puxa até a casa antes do poste do norte
  i._entrar(11, 'o');
  i._bichos.clear();
  m.passo();
  por(...R.centro(6, 3), 3);
  const tpAntes = j.tp;
  assert.equal(m.mandar(anaId, { tipo: 'gancho', dir: 0 }), 'sem poste', 'olhando para baixo não há poste');
  assert.equal(m.mandar(anaId, { tipo: 'gancho', dir: 3 }), null);
  assert.deepEqual([j.x, j.y], R.centro(9, 3), 'do outro lado da água');
  assert.equal(j.tp, tpAntes + 1, 'o teleporte é contado (a posição velha não volta)');
  // o baú da chave, e o poste de volta
  const [cx, cy] = R.centro(...R.casasDe(R.SALAS[11], 'C')[0]);
  por(...R.centro(10, 4), 3);
  por(cx, cy + R.TILE, 1);
  m.passo();
  assert.equal(m.quadros.at(-1)!.it[1], 1, 'pegou a chave');
  por(...R.centro(10, 6), 1);
  por(...R.centro(9, 7), 2);
  assert.equal(m.mandar(anaId, { tipo: 'gancho', dir: 2 }), null);
  assert.deepEqual([j.x, j.y], R.centro(6, 7), 'e voltou');
});

test('o gancho, a conta das duas pontas: alcance, parede no meio, poste encostado', () => {
  const s = R.SALAS[11];
  const m: import('../src/masmorra-regras.js').Mundo = { blocos: [], bau: true, ponte: false, abertas: [] };
  assert.deepEqual(R.alvoDoGancho(s, m, ...R.centro(6, 3), 3)?.para, R.centro(9, 3));
  assert.equal(R.alvoDoGancho(s, m, ...R.centro(6, 1), 3), null, 'na linha sem poste, a parede (longe demais) para');
  assert.equal(R.alvoDoGancho(s, m, ...R.centro(9, 3), 3), null, 'encostado no poste, não puxa');
  assert.deepEqual(R.alvoDoGancho(s, m, ...R.centro(4, 3), 3)?.para, R.centro(9, 3), 'de mais longe também');
  assert.equal(R.alvoDoGancho(s, m, ...R.centro(6, 3), 0), null, 'para baixo, a parede');
});

test('a mina no Solo: o recorde de tempo vai à variante dela, sem misturar com a toca', async () => {
  const db = await import('../src/db.js');
  const antes = db.recordeDoSolo(anaId, 'masmorra')?.valor ?? null;
  const m = comecar([anaId], 0, () => 0.5, { masmorra: 'mina' });
  const i = m.interno as unknown as Interno & { _entrar: (d: number, l: 'n' | 's' | null) => void };
  agora += 50_000;
  i._entrar(R.MASMORRAS.mina.chefe, 's');
  i._bichos.clear();
  m.passo();
  m.relogio[0].depois();
  assert.ok(m.terminou());
  assert.ok((db.recordeDoSolo(anaId, 'masmorra', 'mina')?.valor ?? 0) >= 50_000);
  assert.equal(db.recordeDoSolo(anaId, 'masmorra')?.valor ?? null, antes, 'a toca não mudou');
});
