/**
 * A Briga na horta (minijogo-briga.ts): os inimigos são do servidor, num passo de 20 por segundo; quem bate manda o acerto,
 * e o servidor confere. O relógio e o passo aqui são de mão: o teste anda o tempo e chama o passo.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-briga.js');
const { criarBriga, GRACA_MS, PASSO_MS, ONDAS, ONDAS_X, VOLTA_MS, CUSTO_ESPECIAL, FIM_MS } = mod;
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-briga');
const bia = await criarConta(app, 'bia-briga');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da briga' })).json() as { id: number };

interface Ini {
  id: number;
  tipo: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  estado: string;
  lado: number;
  historia: { t: number; x: number; y: number; z: number }[];
}
interface Jog {
  x: number;
  y: number;
  z: number;
  hp: number;
  vidas: number;
  pontos: number;
  estado: string;
  invulAte: number;
  lado: number;
  livreAte: number;
}
interface Interno {
  _passo: () => void;
  _inimigos: Map<number, Ini>;
  _jogadores: Map<number, Jog>;
  _motivo: () => string | null;
  _arena: () => [number, number];
}

function comecar(naSala = [anaId, biaId], comunidadeId = comunidade.id, aleatorio = () => 0.5) {
  let passo: (() => void) | null = null;
  let limpo = 0;
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
    difundir: (d: unknown) => quadros.push(d as Record<string, unknown>),
  };
  const jogo = criarBriga({
    agora: () => agora,
    aleatorio,
    intervalo: (p) => {
      passo = p;
      return 1;
    },
    limpar: () => limpo++,
  }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const interno = jogo as unknown as Interno;
  return {
    jogo,
    interno,
    quadros,
    relogio,
    terminou: () => terminou,
    limpo: () => limpo,
    temPasso: () => passo !== null,
    sair: (id: number) => (sala = sala.filter((s) => s !== id)),
    /** Anda o tempo, um passo a cada 50 ms. */
    andar(ms: number) {
      for (let t = 0; t < ms; t += PASSO_MS) {
        agora += PASSO_MS;
        passo!();
      }
    },
    /** O relógio do motor (o fim da fase). */
    disparar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
    pos(id: number, d: Record<string, unknown>) {
      return jogo.tempoReal!(id, { tipo: 'pos', z: 0, lado: 1, acao: 0, ...d });
    },
    golpe(id: number, d: Record<string, unknown>) {
      jogo.tempoReal!(id, { tipo: 'golpe', z: 0, ...d });
      return interno._motivo();
    },
  };
}

/** Espera até haver uma raposa andando na arena, e a devolve. */
function umaRaposa(m: ReturnType<typeof comecar>) {
  for (let k = 0; k < 200; k++) {
    const r = [...m.interno._inimigos.values()].find((i) => i.tipo === 'raposa' && (i.estado === 'andando' || i.estado === 'entrando'));
    if (r) return r;
    m.andar(PASSO_MS);
  }
  throw new Error('nenhuma raposa');
}

/** Põe a pessoa num lugar (o teste não espera o coelho andar até lá). */
function teleportar(m: ReturnType<typeof comecar>, id: number, x: number, y: number) {
  const j = m.interno._jogadores.get(id)!;
  j.livreAte = agora + 1000;
  m.pos(id, { x, y });
}

test('o passo é do servidor: 20 por segundo, o quadro vai a todos, e o relógio para no fim', () => {
  const m = comecar();
  assert.ok(m.temPasso());
  m.andar(2000);
  assert.ok(m.quadros.length >= 39, `quadros: ${m.quadros.length}`);
  const q = m.quadros.at(-1)!;
  assert.equal(q.tipo, 'q');
  assert.ok(Array.isArray(q.i) && (q.i as unknown[]).length > 0, 'os inimigos entraram');
  assert.equal((q.j as unknown[]).length, 2);
  // o quadro é pequeno: números, sem nome
  assert.ok(JSON.stringify(q).length < 1200, `tamanho: ${JSON.stringify(q).length}`);
  m.jogo.parar!();
  assert.equal(m.limpo(), 1, 'o parar do motor desliga o passo');
});

test('a raposa prepara antes de bater; quem fica leva, quem foge na folga escapa', () => {
  const m = comecar([anaId], comunidade.id);
  const r = umaRaposa(m);
  const ana_ = m.interno._jogadores.get(anaId)!;
  ana_.invulAte = 0;
  // a Ana fica parada no meio da arena; a raposa chega e prepara
  let viuPreparar = false;
  for (let k = 0; k < 400 && r.estado !== 'atacando'; k++) {
    teleportar(m, anaId, 160, 28);
    m.andar(PASSO_MS);
    if (r.estado === 'preparando') viuPreparar = true;
  }
  assert.ok(viuPreparar, 'a preparação aparece antes do golpe');
  assert.equal(r.estado, 'atacando');
  // ficou dentro durante a folga: leva
  const antes = ana_.hp;
  for (let k = 0; k < GRACA_MS / PASSO_MS + 1; k++) {
    m.pos(anaId, { x: 160, y: 28 });
    m.andar(PASSO_MS);
  }
  assert.ok(ana_.hp < antes, `levou o golpe: ${JSON.stringify({ r: [r.x, r.y, r.lado, r.estado], j: [ana_.x, ana_.y, ana_.z, ana_.invulAte, ana_.estado], agora })}`);

  // outra raposa, outra vez: agora a Ana foge para o fundo da faixa logo depois do golpe
  ana_.invulAte = 0;
  for (let k = 0; k < 600 && r.estado !== 'atacando'; k++) {
    teleportar(m, anaId, 160, 28);
    m.andar(PASSO_MS);
  }
  if (r.estado === 'atacando') {
    const hp = ana_.hp;
    ana_.invulAte = 0;
    teleportar(m, anaId, 160, 50);
    m.andar(GRACA_MS + PASSO_MS);
    assert.equal(ana_.hp, hp, 'fugiu dentro da folga: não levou');
  }
  m.jogo.parar!();
});

test('o acerto: vale perto do inimigo como ele estava, e o servidor recusa o resto', () => {
  const m = comecar();
  const r = umaRaposa(m);
  m.andar(500);
  teleportar(m, anaId, r.x - 20, r.y);
  // um soco começado (vem na posição) e o acerto logo depois
  m.pos(anaId, { x: r.x - 20, y: r.y, ataque: { id: 1, g: 'soco1' } });
  const hp = r.hp;
  assert.equal(m.golpe(anaId, { a: 1, inimigo: r.id, x: r.x - 20, y: r.y }), null);
  assert.ok(r.hp < hp, 'o dano entrou');
  assert.ok(m.interno._jogadores.get(anaId)!.pontos > 0);
  assert.equal(m.golpe(anaId, { a: 1, inimigo: r.id, x: r.x - 20, y: r.y }), 'já acertou', 'um golpe acerta cada inimigo uma vez');
  assert.equal(m.golpe(anaId, { a: 7, inimigo: r.id, x: r.x - 20, y: r.y }), 'golpe que não começou');
  // longe: do outro lado da tela
  teleportar(m, biaId, r.x - 150, r.y);
  m.pos(biaId, { x: r.x - 150, y: r.y, ataque: { id: 1, g: 'soco1' } });
  assert.equal(m.golpe(biaId, { a: 1, inimigo: r.id, x: r.x - 150, y: r.y }), 'longe do inimigo');
  // dizer que estava perto, mas o servidor a viu longe
  assert.equal(m.golpe(biaId, { a: 1, inimigo: r.id, x: r.x - 20, y: r.y }), 'longe de si');
  // o terceiro soco sem os dois primeiros não começa
  m.pos(biaId, { x: r.x - 150, y: r.y, ataque: { id: 2, g: 'soco3' } });
  assert.equal(m.golpe(biaId, { a: 2, inimigo: r.id, x: r.x - 150, y: r.y }), 'golpe que não começou', 'o combo fora de ordem não vale');
  // velho
  m.andar(1200);
  assert.equal(m.golpe(anaId, { a: 1, inimigo: 999, x: 0, y: 0 }), 'golpe velho');
  m.jogo.parar!();
});

test('o combo inteiro derruba; caído não apanha; rápido demais não começa', () => {
  const m = comecar();
  const r = umaRaposa(m);
  m.andar(400);
  const bater = (id: number, g: string) => {
    teleportar(m, anaId, r.x - 20, r.y);
    m.pos(anaId, { x: r.x - 20, y: r.y, ataque: { id, g } });
    const motivo = m.golpe(anaId, { a: id, inimigo: r.id, x: r.x - 20, y: r.y });
    m.andar(250);
    return motivo;
  };
  assert.equal(bater(1, 'soco1'), null);
  assert.equal(r.estado, 'dor');
  assert.equal(bater(2, 'soco2'), null);
  assert.equal(bater(3, 'soco3'), null);
  assert.equal(r.estado, 'caido', 'o terceiro derruba');
  assert.equal(bater(4, 'soco1'), 'inimigo fora', 'no chão, não apanha');
  // cinco socos no mesmo instante: o balde do combo segura
  const outro = m.interno._jogadores.get(biaId)!;
  outro.livreAte = agora + 1000;
  let comecados = 0;
  for (let k = 1; k <= 8; k++) {
    m.pos(biaId, { x: 100, y: 20, ataque: { id: k, g: 'soco1' } });
    if (m.golpe(biaId, { a: k, inimigo: 999, x: 100, y: 20 }) !== 'golpe que não começou') comecados++;
  }
  assert.ok(comecados <= 3, `começou ${comecados} socos de uma vez`);
  m.jogo.parar!();
});

test('o especial custa vida (o servidor cobra) e não se repete de seguida', () => {
  const m = comecar();
  m.andar(200);
  const j = m.interno._jogadores.get(anaId)!;
  const hp = j.hp;
  m.pos(anaId, { x: j.x, y: j.y, ataque: { id: 1, g: 'especial' } });
  assert.equal(j.hp, hp - CUSTO_ESPECIAL);
  m.pos(anaId, { x: j.x, y: j.y, ataque: { id: 2, g: 'especial' } });
  assert.equal(j.hp, hp - CUSTO_ESPECIAL, 'o segundo, logo depois, não começa');
  m.andar(1000);
  j.hp = CUSTO_ESPECIAL;
  m.pos(anaId, { x: j.x, y: j.y, ataque: { id: 3, g: 'especial' } });
  assert.equal(j.hp, CUSTO_ESPECIAL, 'sem vida para pagar, não sai');
  m.jogo.parar!();
});

test('a posição não anda mais que o coelho', () => {
  const m = comecar();
  m.andar(1500);
  const j = m.interno._jogadores.get(anaId)!;
  m.pos(anaId, { x: j.x, y: j.y });
  const x0 = j.x;
  m.andar(100);
  m.pos(anaId, { x: x0 + 250, y: j.y });
  assert.ok(j.x - x0 < 30, `andou ${j.x - x0} px em 0,1 s`);
  // calado por muito tempo, o salto continua pequeno (não se junta "crédito" de andar)
  const x1 = j.x;
  m.andar(3000);
  m.pos(anaId, { x: x1 + 250, y: j.y });
  assert.ok(j.x - x1 < 45, `andou ${j.x - x1} px de uma vez`);
  m.jogo.parar!();
});

/** Derruba todo inimigo que aparecer, com acertos de verdade. */
function limparOnda(m: ReturnType<typeof comecar>, quem = anaId) {
  let id = (m as unknown as { _id?: number })._id ?? 0;
  for (let k = 0; k < 4000; k++) {
    const vivos = [...m.interno._inimigos.values()].filter((i) => i.hp > 0 && i.estado !== 'caido' && i.estado !== 'levantando' && i.estado !== 'morto');
    const q = m.quadros.at(-1);
    if (q && q.f !== 'lutando') break;
    for (const i of vivos) {
      i.hp = 1;
      if (i.tipo === 'corvo') i.z = 0;
      i.historia.push({ t: agora, x: i.x, y: i.y, z: i.z });
      const j = m.interno._jogadores.get(quem)!;
      j.livreAte = agora + 1000;
      j.lado = 1;
      m.pos(quem, { x: i.x - 20, y: i.y, ataque: { id: ++id, g: 'soco1' } });
      m.golpe(quem, { a: id, inimigo: i.id, x: i.x - 20, y: i.y });
      m.andar(300);
    }
    m.andar(PASSO_MS);
  }
  (m as unknown as { _id?: number })._id = id;
}

test('as ondas: a seta depois de limpar, a câmera anda com quem vai à frente, e o chefe no fim', () => {
  const m = comecar([anaId], comunidade.id);
  for (let o = 0; o < ONDAS.length - 1; o++) {
    limparOnda(m);
    m.andar(PASSO_MS);
    assert.equal(m.quadros.at(-1)!.f, 'avancando', `onda ${o + 1} limpa: a seta`);
    assert.equal(m.interno._arena()[1], ONDAS_X[o + 1] + 320, 'a arena abre para a direita');
    // anda até a próxima arena
    const j = m.interno._jogadores.get(anaId)!;
    while (j.x < ONDAS_X[o + 1] + 100) {
      m.pos(anaId, { x: j.x + 6, y: j.y });
      m.andar(PASSO_MS);
    }
    m.andar(PASSO_MS);
    assert.equal(m.quadros.at(-1)!.o, o + 1, 'a próxima onda');
  }
  // o chefe: o texugo não cai com os socos (ele aguenta firme), e se prepara antes de investir ou bater
  m.andar(1500);
  const tex = [...m.interno._inimigos.values()].find((i) => i.tipo === 'texugo')!;
  assert.ok(tex, 'o texugo entrou');
  const estados = new Set<string>();
  const j = m.interno._jogadores.get(anaId)!;
  for (let k = 0; k < 300; k++) {
    j.invulAte = agora + 10_000;
    teleportar(m, anaId, tex.x - 120, tex.y);
    m.andar(PASSO_MS);
    estados.add(tex.estado);
  }
  assert.ok(estados.has('prep-investida') && estados.has('investida'), [...estados].join(','));
  m.pos(anaId, { x: j.x, y: j.y, ataque: { id: 9000, g: 'soco1' } });
  m.jogo.parar!();
});

test('cai, volta depois de alguns segundos com uma vida a menos, e sem vidas a fase acaba', () => {
  const m = comecar([anaId], 0);
  m.andar(500);
  const j = m.interno._jogadores.get(anaId)!;
  const derrubar = () => {
    const r = umaRaposa(m);
    j.hp = 1;
    j.invulAte = 0;
    for (let k = 0; k < 600 && j.estado === 'em-pe'; k++) {
      teleportar(m, anaId, r.x + (r.lado === 1 ? 20 : -20) * 1, r.y);
      j.invulAte = 0;
      m.andar(PASSO_MS);
    }
  };
  derrubar();
  assert.equal(j.estado, 'fora');
  assert.equal(j.vidas, 2);
  m.andar(VOLTA_MS + PASSO_MS);
  assert.equal(j.estado, 'em-pe', 'voltou');
  assert.equal(j.hp, 100);
  derrubar();
  m.andar(VOLTA_MS + PASSO_MS);
  derrubar();
  assert.equal(j.vidas, 0);
  m.andar(PASSO_MS);
  assert.equal(m.quadros.at(-1)!.f, 'derrota');
  m.disparar();
  assert.equal(m.terminou(), true);
  assert.ok(m.limpo() >= 1, 'o passo desliga no fim');
});

async function trofeus(token: string) {
  return ((await comToken(app, token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number; pontos: number }[]).filter(
    (t) => t.pista === 'briga',
  );
}

/** A fase inteira, vencida (a Ana bate em tudo). `sai` faz a Bia sair no meio. */
function vencer(m: ReturnType<typeof comecar>, sai = false) {
  for (let o = 0; o < ONDAS.length; o++) {
    if (sai && o === 2) m.sair(biaId);
    limparOnda(m);
    if (o === ONDAS.length - 1) break;
    m.andar(PASSO_MS);
    const j = m.interno._jogadores.get(anaId)!;
    while (j.x < ONDAS_X[o + 1] + 100) {
      m.pos(anaId, { x: j.x + 6, y: j.y });
      m.andar(PASSO_MS);
    }
    m.andar(PASSO_MS);
  }
  assert.equal(m.quadros.at(-1)!.f, 'vitoria');
  agora += FIM_MS;
  m.relogio[0].depois();
}

test('a fase vencida com a turma: o pódio vai para a estante, e o passo desliga', async () => {
  const antesAna = (await trofeus(ana.token)).length;
  const antesBia = (await trofeus(bia.token)).length;
  const m = comecar();
  // a Bia também acerta um, para ter ponto
  const r = umaRaposa(m);
  m.andar(300);
  teleportar(m, biaId, r.x - 20, r.y);
  m.pos(biaId, { x: r.x - 20, y: r.y, ataque: { id: 1, g: 'soco1' } });
  assert.equal(m.golpe(biaId, { a: 1, inimigo: r.id, x: r.x - 20, y: r.y }), null);
  vencer(m);
  assert.equal(m.terminou(), true);
  assert.ok(m.limpo() >= 1);
  const daAna = await trofeus(ana.token);
  const daBia = await trofeus(bia.token);
  assert.equal(daAna.length, antesAna + 1);
  assert.equal(daAna[0].posicao, 1);
  assert.equal(daBia.length, antesBia + 1);
  assert.equal(daBia[0].posicao, 2);
  const pub = m.jogo.publico(anaId) as { fase: string; resultado: { userId: number }[]; venceu: boolean };
  assert.equal(pub.fase, 'fim');
  assert.equal(pub.venceu, true);
  assert.equal(pub.resultado[0].userId, anaId);
});

test('quem sai no meio não ganha troféu, e quem fica sozinho também não', async () => {
  const antesAna = (await trofeus(ana.token)).length;
  const antesBia = (await trofeus(bia.token)).length;
  const m = comecar();
  vencer(m, true);
  assert.equal((await trofeus(ana.token)).length, antesAna, 'sozinha no fim: sem o troféu "com a turma"');
  assert.equal((await trofeus(bia.token)).length, antesBia);
});

test('sozinho: começa pela rota do Solo, sem pódio, e encerrar desliga o passo', async () => {
  const comAna = comToken(app, ana.token);
  const r = await comAna('POST', '/api/minijogo-solo', { jogo: 'briga' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().partida.jogo, 'briga');
  assert.equal(r.json().partida.fase, 'lutando');
  await comAna('DELETE', '/api/minijogo-solo');
  assert.equal((await comAna('GET', '/api/minijogo-solo')).json().partida, null);
});
