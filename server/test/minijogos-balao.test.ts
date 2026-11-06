/**
 * O Estoura-balão (minijogo-balao.ts): o servidor confere as posições, limita os itens pelas caixas, carimba o dono, e estoura
 * o balão de quem passa por um item MESMO SEM ELA AVISAR (refaz o caminho que ela mesma mandou contra o repolho e a lama, que
 * são contas iguais nos dois lados: balao-sim.ts). O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarBalao, LARGADA_MS } = await import('../src/minijogo-balao.js');
const sim = await import('../src/balao-sim.js');
const db = await import('../src/db.js');
after(fechar);

const ana = await criarConta(app, 'ana-balao');
const bia = await criarConta(app, 'bia-balao');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

type Item = 'cenoura' | 'repolho' | 'lama' | 'alface';

/** Uma semente em que as primeiras caixas de cada um dão os itens pedidos (o sorteio é o mesmo do site). */
function sementeCom(daAna: Item[], daBia: Item[] = []) {
  for (let i = 1; i < 200_000; i++) {
    const v = i / 200_003;
    const s = Math.floor(v * 2 ** 31);
    if (daAna.every((it, k) => sim.itemDaCaixa(s, anaId, k) === it) && daBia.every((it, k) => sim.itemDaCaixa(s, biaId, k) === it)) return v;
  }
  throw new Error('nenhuma semente');
}

interface Linha {
  userId: number;
  baloes: number;
  estouros: number;
  vivo: boolean;
  posicao: number | null;
}

function comecar(v: number, arena = 'horta', comunidade = 0) {
  let agora = 9_000_000;
  const relogio: { ms: number; depois: () => void }[] = [];
  const difundidos: Record<string, unknown>[] = [];
  let terminou = false;
  const naSala = [anaId, biaId];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
    difundir: (d: unknown) => difundidos.push(d as Record<string, unknown>),
  };
  const jogo = criarBalao({ agora: () => agora, aleatorio: () => v }).comecar(ctx, { naSala, criadaPor: anaId, corpo: { arena } });
  assert.ok(typeof jogo !== 'string');
  // a largada
  assert.equal(relogio[0].ms, LARGADA_MS);
  agora += LARGADA_MS;
  relogio[0].depois();
  const verde = agora;
  let N = 0;
  const a = sim.arenaPorId(arena);
  const pos = new Map<number, { x: number; y: number }>([
    [anaId, { x: a.largadas[0][0], y: a.largadas[0][1] }],
    [biaId, { x: a.largadas[1][0], y: a.largadas[1][1] }],
  ]);
  const alvos = new Map<number, { x: number; y: number }>();
  /** Quanto cada um anda a cada 4 passos: 8 (120 por segundo, abaixo da batida) se não disser outra coisa. */
  const velocidades = new Map<number, number>();
  const calados = new Set<number>();
  const recusadas: number[] = [];
  const t = {
    jogo,
    difundidos,
    pos,
    alvos,
    velocidades,
    calados,
    recusadas,
    terminou: () => terminou,
    get N() {
      return N;
    },
    estado: () => jogo.publico(anaId) as { fase: string; semente: number; jogadores: Linha[] },
    linha: (id: number) => (jogo.publico(anaId) as { jogadores: Linha[] }).jogadores.find((l) => l.userId === id)!,
    /** Anda `passos` passos: cada um vai ao alvo dele (a 2 por passo, ou o que `velocidades` disser) e manda a posição a cada 4. */
    andar(passos: number) {
      for (let i = 0; i < passos; i += 4) {
        N += 4;
        agora = verde + (N * 1000) / 60;
        for (const id of naSala) {
          const p = pos.get(id)!, alvo = alvos.get(id);
          if (alvo) {
            const dx = alvo.x - p.x, dy = alvo.y - p.y, d = Math.hypot(dx, dy);
            const v = velocidades.get(id) ?? 8;
            const k = d > v ? v / d : 1;
            p.x += dx * k;
            p.y += dy * k;
          }
          if (calados.has(id)) continue;
          const r = jogo.tempoReal!(id, { n: N, x: +p.x.toFixed(1), y: +p.y.toFixed(1), a: 0 });
          if (r === null && t.linha(id).vivo) recusadas.push(N);
        }
      }
    },
    /** Até chegar ao alvo. */
    ir(id: number, x: number, y: number) {
      alvos.set(id, { x, y });
      for (let i = 0; i < 400 && Math.hypot(pos.get(id)!.x - x, pos.get(id)!.y - y) > 0.01; i++) t.andar(4);
    },
    mandar: (id: number, dados: Record<string, unknown>) => jogo.tempoReal!(id, dados),
    /** O relógio anda sem posição de ninguém (os calados). */
    esperar(ms: number) {
      agora += ms;
      N = Math.floor(((agora - verde) * 60) / 1000);
    },
  };
  return t;
}

test('as duas cópias da simulação são iguais (o site estoura com a mesma conta que o servidor confere)', async () => {
  const { readFileSync } = await import('node:fs');
  const servidor = readFileSync(new URL('../src/balao-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../../web/src/balao/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/balao-sim.ts e web/src/balao/sim.ts mudaram separados: copie uma sobre a outra');
  const texto = servidor.toString();
  assert.doesNotMatch(texto, /Math\.(sin|cos|tan|atan|atan2|exp|log|pow)\b/, 'só + − × ÷ e Math.sqrt nas contas dos dois lados');
});

test('a posição: só a que o kart alcança, fora das paredes e não à frente do relógio', () => {
  const t = comecar(0.5);
  const { x, y } = t.pos.get(anaId)!;
  // um pulo para o outro lado da arena
  assert.equal(t.mandar(anaId, { n: 4, x: x + 300, y, a: 0 }), null);
  // dentro do canteiro do meio
  assert.equal(t.mandar(anaId, { n: 4, x: 512, y: 512, a: 0 }), null);
  // muito à frente do relógio
  assert.equal(t.mandar(anaId, { n: 600, x: x + 5, y, a: 0 }), null);
  // uma de verdade é repassada, carimbada com quem mandou
  const r = t.mandar(anaId, { n: 4, x: x + 6, y, a: 0.5 }) as Record<string, unknown>;
  assert.equal(r.userId, anaId);
  // e o passo só cresce
  assert.equal(t.mandar(anaId, { n: 4, x: x + 7, y, a: 0 }), null);
  t.jogo.parar?.();
});

test('a caixa dá UM item, o do sorteio; o dono é o servidor que carimba', () => {
  const t = comecar(sementeCom(['repolho']));
  // usar sem ter pegado caixa
  t.andar(8);
  const { x, y } = t.pos.get(anaId)!;
  assert.equal(t.mandar(anaId, { tipo: 'repolho', n: t.N, x, y, dx: 1, dy: 0 }), null);
  // pegar a caixa de longe não vale
  t.mandar(anaId, { tipo: 'caixa', i: 4, n: t.N });
  assert.equal(t.mandar(anaId, { tipo: 'repolho', n: t.N, x, y, dx: 1, dy: 0 }), null);
  // perto da caixa 4 (350, 380)
  t.ir(anaId, 350, 380);
  t.mandar(anaId, { tipo: 'caixa', i: 4, n: t.N });
  // o item errado não sai
  assert.equal(t.mandar(anaId, { tipo: 'lama', n: t.N, x: 350, y: 380 }), null);
  const r = t.mandar(anaId, { tipo: 'repolho', n: t.N, x: 350, y: 380, dx: 1, dy: 0, dono: biaId }) as Record<string, unknown>;
  assert.equal(r.tipo, 'repolho');
  assert.equal(r.dono, anaId, 'o dono é quem mandou, e não o que veio no corpo');
  assert.equal(r.id, `${anaId}-${t.N}`);
  // a mão ficou vazia
  t.andar(40);
  assert.equal(t.mandar(anaId, { tipo: 'repolho', n: t.N, x: 350, y: 380, dx: 1, dy: 0 }), null);
  t.jogo.parar?.();
});

test('quem passa pelo repolho perde o balão MESMO SEM AVISAR; o "acertou" de longe não vale', () => {
  const t = comecar(sementeCom(['repolho']));
  // a Bia espera em (600, 380), no caminho (dando a volta no fardo de feno)
  t.ir(biaId, 700, 380);
  t.ir(biaId, 600, 380);
  t.ir(anaId, 350, 380);
  t.mandar(anaId, { tipo: 'caixa', i: 4, n: t.N });
  const n0 = t.N;
  const r = t.mandar(anaId, { tipo: 'repolho', n: n0, x: 364, y: 380, dx: 1, dy: 0 }) as { id: string };
  // um "acertou" da Bia agora, longe do repolho, é recusado
  t.mandar(biaId, { tipo: 'acertou', id: r.id, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES);
  // o repolho chega nela; ela não avisa nada, só manda as posições
  t.andar(120);
  const estouro = t.difundidos.find((d) => d.tipo === 'estourou');
  assert.ok(estouro, 'o servidor estourou pelo caminho da própria Bia');
  assert.equal(estouro!.alvo, biaId);
  assert.equal(estouro!.dono, anaId);
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1);
  assert.equal(t.linha(anaId).estouros, 1);
  assert.deepEqual(t.recusadas, [], 'nenhuma posição honesta recusada');
  t.jogo.parar?.();
});

test('quem fica calado fica parado onde estava: a lama posta ali pega', () => {
  const t = comecar(sementeCom(['lama']));
  // a caixa 0 (420, 512); a Bia logo ao lado
  t.ir(biaId, 440, 480);
  t.ir(anaId, 420, 512);
  t.mandar(anaId, { tipo: 'caixa', i: 0, n: t.N });
  // a Bia para de mandar posição
  t.calados.add(biaId);
  t.ir(anaId, 436, 490);
  t.mandar(anaId, { tipo: 'lama', n: t.N, x: 440, y: 480 });
  assert.equal(t.linha(biaId).baloes, sim.BALOES);
  t.esperar(2000);
  t.jogo.conferir?.();
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1, 'a lama pegou a Bia parada');
  t.jogo.parar?.();
});

test('o escudo de alface segura um item, e depois de um estouro há 2 s sem perder outro', () => {
  const t = comecar(sementeCom(['lama', 'lama', 'lama'], ['alface']));
  // a Bia pega a alface na caixa 7 (350, 644) e usa
  t.ir(biaId, 350, 644);
  t.mandar(biaId, { tipo: 'caixa', i: 7, n: t.N });
  assert.ok(t.mandar(biaId, { tipo: 'alface', n: t.N }));
  // a Ana pega a lama na caixa 6 (674, 380)... longe: vai até a caixa 7 também, que é dela também
  t.ir(anaId, 350, 644);
  t.mandar(anaId, { tipo: 'caixa', i: 7, n: t.N });
  t.mandar(anaId, { tipo: 'lama', n: t.N, x: 350, y: 644 });
  t.mandar(biaId, { tipo: 'acertou', id: `${anaId}-${t.N}`, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES, 'o escudo segurou');
  assert.ok(t.difundidos.some((d) => d.tipo === 'segurou' && d.alvo === biaId));
  // sem escudo, a lama seguinte estoura
  t.ir(anaId, 350, 380);
  t.ir(biaId, 366, 380);
  t.mandar(anaId, { tipo: 'caixa', i: 4, n: t.N });
  t.mandar(anaId, { tipo: 'lama', n: t.N, x: 366, y: 380 });
  t.mandar(biaId, { tipo: 'acertou', id: `${anaId}-${t.N}`, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1);
  // e a próxima, logo depois, não leva outro (os 2 s), mas a lama continua lá (as duas vão depressa, para caber nos 2 s,
  // e passam a mais de RAIO_DA_BATIDA uma da outra)
  t.velocidades.set(anaId, 12);
  t.velocidades.set(biaId, 12);
  t.ir(anaId, 420, 512);
  t.ir(biaId, 436, 512);
  t.mandar(anaId, { tipo: 'caixa', i: 0, n: t.N });
  const id = `${anaId}-${t.N}`;
  t.mandar(anaId, { tipo: 'lama', n: t.N, x: 436, y: 512 });
  t.mandar(biaId, { tipo: 'acertou', id, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1, 'dentro dos 2 s, nada pega');
  // parada em cima da lama, passados os 2 s, ela pega (pelo caminho que a própria Bia manda)
  t.andar(sim.INVULNERAVEL + 8);
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 2);
  t.jogo.parar?.();
});

test('três estouros: a Bia sai, a partida fecha, e o pódio vai para a estante', () => {
  const t = comecar(sementeCom(['lama', 'lama', 'lama']), 'horta', 1);
  const caixas = [0, 1, 2];
  let ultimo = -Infinity;
  for (const i of caixas) {
    const [cx, cy] = sim.arenaPorId('horta').caixas[i];
    t.ir(anaId, cx, cy);
    t.ir(biaId, cx + 16, cy);
    // passado o tempo sem perder outro balão
    if (t.N < ultimo + sim.INVULNERAVEL + 8) t.andar(sim.INVULNERAVEL + 8);
    t.mandar(anaId, { tipo: 'caixa', i, n: t.N });
    t.andar(24);
    t.mandar(anaId, { tipo: 'lama', n: t.N, x: cx + 16, y: cy });
    // a Bia, honesta, avisa
    t.mandar(biaId, { tipo: 'acertou', id: `${anaId}-${t.N}`, n: t.N });
    ultimo = t.N;
    t.ir(biaId, cx + 40, cy);
  }
  assert.equal(t.linha(biaId).baloes, 0);
  assert.equal(t.terminou(), true);
  const fim = t.estado();
  assert.equal(fim.fase, 'fim');
  assert.equal(t.linha(anaId).posicao, 1);
  assert.equal(t.linha(biaId).posicao, 2);
  const trofeu = db.trofeusDe(anaId).find((x) => x.pista === 'balao');
  assert.ok(trofeu, 'o troféu da Ana');
  assert.equal(trofeu!.posicao, 1);
  // um balão nunca volta: depois do fim, nada muda
  assert.equal(t.mandar(biaId, { n: t.N + 4, x: 500, y: 300, a: 0 }), null);
  t.jogo.parar?.();
});

test('o Solo só guarda o fim que cabe no relógio', () => {
  let agora = 1_000_000;
  let terminou = false;
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => [anaId],
    nome: () => 'ana',
    solo: true,
  };
  const jogo = criarBalao({ agora: () => agora }).comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const est = jogo.publico(anaId) as { robos: { username: string }[] };
  assert.ok(est.robos[0].username.startsWith('🤖'));
  // 2 minutos de partida em 10 s de relógio: não
  agora += 10_000;
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 1, total: 4, baloes: 3, estouros: 9, passos: 7200 }), 'Partida inválida.');
  agora += 120_000;
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 1, total: 9, baloes: 3, estouros: 0, passos: 7200 }), 'Partida inválida.');
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 2, total: 4, baloes: 0, estouros: 2, passos: 7200 }), null);
  assert.equal(terminou, true);
  assert.deepEqual((jogo.publico(anaId) as { resultadoDoSolo: unknown }).resultadoDoSolo, { posicao: 2, total: 4, baloes: 0, estouros: 2 });
});

test('a batida: quem vem no turbo e encosta em quem está parado estoura um balão dele, MESMO SEM ELE AVISAR; uma por contato', () => {
  const t = comecar(0.5);
  t.ir(biaId, 630, 340);
  t.ir(anaId, 560, 340);
  // a Ana passa por cima da Bia a 180 por segundo (12 a cada 4 passos: só o turbo anda assim)
  t.velocidades.set(anaId, 12);
  t.ir(anaId, 700, 340);
  const estouros = t.difundidos.filter((d) => d.tipo === 'estourou');
  assert.equal(estouros.length, 1, JSON.stringify(estouros));
  assert.equal(estouros[0].alvo, biaId);
  assert.equal(estouros[0].dono, anaId);
  assert.match(String(estouros[0].id), /^batida-/);
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1);
  assert.equal(t.linha(anaId).estouros, 1);
  assert.equal(t.linha(anaId).baloes, sim.BALOES, 'quem bate não perde nada');
  assert.deepEqual(t.recusadas, []);
  t.jogo.parar?.();
});

test('a batida: devagar, encostar não estoura nada', () => {
  const t = comecar(0.5);
  t.ir(biaId, 630, 340);
  t.ir(anaId, 560, 340);
  t.ir(anaId, 700, 340);
  assert.equal(t.difundidos.filter((d) => d.tipo === 'estourou').length, 0);
  assert.equal(t.linha(biaId).baloes, sim.BALOES);
  t.jogo.parar?.();
});

test('a batida avisada por quem levou: vale com o outro perto e rápido pelas posições dele; de longe, ou devagar, não', () => {
  const t = comecar(0.5);
  t.ir(biaId, 630, 340);
  t.ir(anaId, 560, 351.5);
  // a Ana longe: o aviso não vale
  t.mandar(biaId, { tipo: 'batida', de: anaId, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES);
  // a Ana chega rápido ao lado da Bia, a 11,5 (perto para o site, um fio longe demais para o servidor ver sozinho)
  t.velocidades.set(anaId, 12);
  t.ir(anaId, 630, 351.5);
  assert.equal(t.linha(biaId).baloes, sim.BALOES, 'o servidor sozinho não viu');
  t.mandar(biaId, { tipo: 'batida', de: anaId, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1);
  const e = t.difundidos.find((d) => d.tipo === 'estourou')!;
  assert.equal(e.dono, anaId);
  // de novo, logo: o mesmo par não bate antes de BATIDA_DE_NOVO
  t.andar(sim.INVULNERAVEL + 8);
  t.mandar(biaId, { tipo: 'batida', de: anaId, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1);
  // e quem avisa contra si mesma, ou contra quem anda devagar, não ganha nada
  t.mandar(biaId, { tipo: 'batida', de: biaId, n: t.N });
  t.velocidades.set(anaId, 8);
  t.ir(anaId, 560, 351.5);
  t.ir(anaId, 630, 351.5);
  t.andar(sim.BATIDA_DE_NOVO);
  t.mandar(biaId, { tipo: 'batida', de: anaId, n: t.N });
  assert.equal(t.linha(biaId).baloes, sim.BALOES - 1);
  t.jogo.parar?.();
});
