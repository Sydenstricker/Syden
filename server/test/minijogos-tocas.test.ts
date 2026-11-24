/**
 * Tocas e Torres (minijogo-tocas.ts, tocas/sim.ts e tocas/ia.ts, iguais aos do site): no Solo, o servidor REFAZ a partida pelos
 * comandos mandados em trechos (o nível do computador, o fim e o recorde são dele); na sala, o lockstep (o servidor junta a parte
 * de cada um em turnos, difunde, anda a sua cópia, e confere as assinaturas). O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const { criarTocas, ATRASO_TURNOS, HASH_CADA_TURNOS, PASSOS_MAX, PASSOS_POR_TURNO, PRAZO_MS, VITORIA_MIN_PASSOS, AUSENCIA_MS } = await import('../src/minijogo-tocas.js');
const S = await import('../src/tocas/sim.js');
const { criarIA, PERFIS } = await import('../src/tocas/ia.js');
const db = await import('../src/db.js');

const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const ana = await idDe((await criarConta(app, 'ana-tocas')).token);
const bia = await idDe((await criarConta(app, 'bia-tocas')).token);

type Jogo = { publico(q: number): Record<string, unknown>; acao(q: number, c: Record<string, unknown>): string | null; tempoReal?(q: number, d: unknown): unknown; conferir?(): void };

function comecar({ solo = true, naSala = [ana], sorteio = () => 0.25 }: { solo?: boolean; naSala?: number[]; sorteio?: () => number } = {}) {
  let agora = 5_000_000;
  const relogio: { ms: number; depois: () => void }[] = [];
  const difundido: Record<string, unknown>[] = [];
  let terminou: boolean | null = null;
  let presentes = naSala;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (completa = true) => (terminou = completa),
    naSala: () => presentes,
    nome: (id: number) => (id === ana ? 'ana' : 'bia'),
    comunidade: solo ? 0 : 1,
    solo,
    difundir: (d: unknown) => difundido.push(d as Record<string, unknown>),
  };
  const jogo = criarTocas({ agora: () => agora, sorteio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  return {
    jogo: jogo as Jogo | string,
    j: () => jogo as Jogo,
    estado: (q = naSala[0]) => (jogo as Jogo).publico(q) as Record<string, any>,
    passar: (ms: number) => (agora += ms),
    terminou: () => terminou,
    prazo: () => relogio[0].depois(),
    difundido,
    sair: (id: number) => (presentes = presentes.filter((x) => x !== id)),
  };
}

const seg = (n: number) => n * 1000;

test('as regras são as mesmas nos dois lados: tocas/sim.ts e tocas/ia.ts iguais byte a byte aos do site', () => {
  for (const f of ['sim.ts', 'ia.ts']) {
    const servidor = readFileSync(new URL(`../src/tocas/${f}`, import.meta.url), 'utf8');
    const site = readFileSync(new URL(`../../web/src/tocas/${f}`, import.meta.url), 'utf8');
    assert.equal(servidor, site, `tocas/${f} difere`);
  }
});

test('o Solo começa na escolha do nível; o comando de fora é limpo antes de entrar', () => {
  const p = comecar();
  const e = p.estado();
  assert.equal(e.fase, 'escolha');
  assert.ok(Number.isInteger(e.semente) && e.semente > 0);
  assert.equal(p.j().acao(ana, { tipo: 'trecho', de: 0, ate: 10, lote: [] }), 'A partida ainda não começou.');
  assert.equal(p.j().acao(ana, { tipo: 'comecar', nivel: 'dificil', mapa: 'lagos' }), null);
  assert.equal(p.estado().fase, 'jogando');
  assert.equal(p.estado().nivel, 'dificil');
  assert.equal(p.estado().mapa, 'lagos');
  // o comando estranho não passa
  assert.equal(S.limparComando({ t: 'mover', ids: 'tudo', x: 1, y: 2 }), null);
  assert.equal(S.limparComando({ t: 'construir', ids: [1], tipo: 'toString', gx: 1, gy: 1 }), null);
  assert.equal(S.limparComando({ t: 'trocar', predio: 1, de: 'ouro', para: 'diamante' }), null);
  assert.deepEqual(S.limparComando({ t: 'mover', ids: [3, 4], x: 1.5, y: 2, lixo: 9 }), { t: 'mover', ids: [3, 4], x: 1.5, y: 2 });
  assert.deepEqual(S.limparComando({ t: 'melhorar', predio: 9, m: 'machado' }), { t: 'melhorar', predio: 9, m: 'machado' });
});

/** Uma partida do Solo jogada "na tela": o piloto automático pela pessoa, os comandos dela gravados com o passo. */
function jogarNaTela(semente: number, mapa: S.TipoDoMapa, nivel: 'facil' | 'normal' | 'dificil') {
  const sim = S.novaPartida(semente, { mapa });
  const piloto = criarIA(0, PERFIS.piloto);
  const computador = criarIA(1, PERFIS[nivel]);
  const lote: [number, S.Comando][] = [];
  const marcas = new Map<number, string>();
  while (sim.vencedor === null && sim.passo < PASSOS_MAX + 5) {
    piloto(sim);
    for (const f of sim.fila) if (f.dono === 0) lote.push([sim.passo, f.c]);
    computador(sim);
    S.passo(sim);
    if (sim.passo % 600 === 0 || sim.vencedor !== null) marcas.set(sim.passo, S.assinatura(sim));
  }
  return { sim, lote, marcas };
}

test('o Solo: o servidor refaz a partida pelos trechos, o fim e o recorde (o tempo da vitória, pelo nível) são dele', () => {
  const p = comecar();
  const semente = p.estado().semente as number;
  assert.equal(p.j().acao(ana, { tipo: 'comecar', nivel: 'facil', mapa: 'campo' }), null);
  const tela = jogarNaTela(semente, 'campo', 'facil');
  assert.equal(tela.sim.vencedor, 0, 'o piloto ganha do fácil nesta semente');
  const fim = tela.sim.passo;
  // um trecho adiantado em relação ao relógio: não
  assert.equal(p.j().acao(ana, { tipo: 'trecho', de: 0, ate: 600, lote: [] }), 'Sessão inválida.');
  let de = 0;
  while (de < fim) {
    const ate = Math.min(fim, de + 600);
    p.passar(seg(60));
    const lote = tela.lote.filter(([q]) => q >= de && q < ate);
    // um trecho repetido (o de antes) é ignorado sem erro
    if (de > 0) assert.equal(p.j().acao(ana, { tipo: 'trecho', de: de - 600, ate: de, lote: [] }), null);
    assert.equal(p.j().acao(ana, { tipo: 'trecho', de, ate, lote, h: tela.marcas.get(ate) }), null);
    assert.equal(p.estado().confirmado, ate);
    de = ate;
  }
  const r = p.estado().resultado;
  assert.ok(r, 'acabou');
  assert.equal(r.venceu, true);
  assert.equal(r.motivo, tela.sim.motivo);
  assert.equal(r.passos, fim);
  assert.equal(r.conferido, true);
  assert.ok(r.historico.length > 10, 'o gráfico do fim veio');
  assert.deepEqual(r.recorde, { antes: null, novo: true });
  assert.equal(db.recordeDoSolo(ana, 'tocas', 'facil')!.valor, fim * 100);
  assert.equal(p.terminou(), true);
});

test('o Solo: assinatura diferente da do servidor não vale recorde; o fim que só a tela viu vale com o bom senso, sem recorde', () => {
  const p = comecar({ naSala: [bia], sorteio: () => 0.5 });
  const semente = p.estado(bia).semente as number;
  p.j().acao(bia, { tipo: 'comecar', nivel: 'facil', mapa: 'campo' });
  const tela = jogarNaTela(semente, 'campo', 'facil');
  const fim = tela.sim.passo;
  let de = 0;
  while (de < fim) {
    const ate = Math.min(fim, de + 600);
    p.passar(seg(60));
    // a tela "mente" nos comandos de um trecho: some um comando, e a assinatura não bate mais
    const lote = tela.lote.filter(([q]) => q >= de && q < ate && !(q === tela.lote[5][0]));
    p.j().acao(bia, { tipo: 'trecho', de, ate, lote, h: tela.marcas.get(ate), fim: ate === fim ? { venceu: true, motivo: tela.sim.motivo } : undefined });
    de = ate;
    if (p.estado(bia).fase === 'fim') break;
  }
  const r = p.estado(bia).resultado;
  assert.ok(r);
  assert.equal(r.conferido, false);
  assert.equal(r.recorde, null);
  assert.equal(db.recordeDoSolo(bia, 'tocas', 'facil'), null);
});

test('o Solo: desistir, e ninguém volta (o prazo fecha a partida como interrompida)', () => {
  const a = comecar();
  a.j().acao(ana, { tipo: 'comecar', nivel: 'normal' });
  a.passar(seg(30));
  assert.equal(a.j().acao(ana, { tipo: 'desistir', passos: 250 }), null);
  assert.equal(a.estado().resultado.motivo, 'desistiu');
  assert.equal(a.estado().resultado.venceu, false);
  const p = comecar();
  p.passar(PRAZO_MS);
  p.prazo();
  assert.equal(p.estado().fase, 'fim');
  assert.equal(p.terminou(), false);
  assert.ok(VITORIA_MIN_PASSOS > 600);
});

// ---------------------------------------------------------------------------------------------------------------------
// A SALA
// ---------------------------------------------------------------------------------------------------------------------

/** Um computador da sala: a sua cópia da partida, o piloto automático pela pessoa, e o lockstep do site. */
function cliente(dono: S.Dono, semente: number, mapa: S.TipoDoMapa, perfil = PERFIS.piloto, votaAos20 = false) {
  let votou = false;
  // as duas pessoas votam para terminar pelos pontos (como o servidor cria a partida da sala)
  const sim = S.novaPartida(semente, { mapa, votam: [true, true] });
  const piloto = criarIA(dono, perfil);
  const recebidos = new Map<number, [S.Comando[], S.Comando[]]>();
  let k = 0;
  let pendentes: S.Comando[] = [];
  return {
    sim,
    recebidos,
    /** Um comando da pessoa (a votação), que vai no próximo turno mandado. */
    ordenar(c: S.Comando) {
      pendentes.push(c);
    },
    get turno() {
      return k;
    },
    /** Anda um turno, se já tem; devolve a parte que mandaria ao servidor, ou null se está esperando. */
    andar(): Record<string, unknown> | null {
      if (sim.vencedor !== null || (k >= ATRASO_TURNOS && !recebidos.has(k))) return null;
      const manda: Record<string, unknown> = { k: k + ATRASO_TURNOS, c: pendentes };
      if (k % HASH_CADA_TURNOS === 0) Object.assign(manda, { h: S.assinatura(sim), hk: k });
      pendentes = [];
      // passados os 20 minutos, a pessoa aceita terminar pelos pontos (uma vez): a partida só acaba assim (24/11/2026)
      if (votaAos20 && !votou && sim.passo >= S.PASSOS_SUGERIDOS) {
        votou = true;
        (manda.c as S.Comando[]).push({ t: 'pontos', aceita: true });
      }
      const t = recebidos.get(k) ?? [[], []];
      recebidos.delete(k);
      for (let i = 0; i < PASSOS_POR_TURNO && sim.vencedor === null; i++) {
        piloto(sim);
        // o que o piloto mandou não vale já: vai ao servidor e volta no turno k + 3
        pendentes.push(...sim.fila.map((f) => f.c));
        sim.fila = [];
        if (i === 0) {
          for (const c of t[0]) S.comandar(sim, 0, c);
          for (const c of t[1]) S.comandar(sim, 1, c);
        }
        S.passo(sim);
      }
      k++;
      return manda;
    },
  };
}

function turnosDifundidos(d: Record<string, unknown>[], ...cs: ReturnType<typeof cliente>[]) {
  for (const m of d.splice(0)) if (m.tocas === 'turno') for (const c of cs) c.recebidos.set(m.k as number, m.c as [S.Comando[], S.Comando[]]);
}

test('a sala é de duas pessoas, e o turno só anda com a parte das duas', () => {
  assert.equal(typeof comecar({ solo: false, naSala: [ana] }).jogo, 'string');
  const p = comecar({ solo: false, naSala: [ana, bia] });
  const e = p.estado();
  assert.equal(e.sala, true);
  assert.equal(e.eu, 0);
  assert.equal(p.estado(bia).eu, 1);
  assert.equal(e.resolvido, ATRASO_TURNOS);
  // só a ana mandou o turno 3: ninguém anda
  p.j().tempoReal!(ana, { k: ATRASO_TURNOS, c: [] });
  assert.equal(p.estado().resolvido, ATRASO_TURNOS);
  assert.equal(p.difundido.length, 0);
  // o turno fora de ordem não entra
  p.j().tempoReal!(bia, { k: ATRASO_TURNOS + 1, c: [] });
  assert.equal(p.estado(bia).meuProximo, ATRASO_TURNOS);
  // a bia manda o dela: o turno anda e é difundido aos dois
  p.j().tempoReal!(bia, { k: ATRASO_TURNOS, c: [{ t: 'mover', ids: [1], x: 3, y: 3 }, { lixo: 1 }] });
  assert.equal(p.estado().resolvido, ATRASO_TURNOS + 1);
  const t = p.difundido.find((m) => m.tocas === 'turno')!;
  assert.equal(t.k, ATRASO_TURNOS);
  assert.deepEqual(t.c, [[], [{ t: 'mover', ids: [1], x: 3, y: 3 }]]);
});

test('a sala inteira em lockstep: os dois computadores e o servidor terminam iguais, e o pódio vai à estante', () => {
  const p = comecar({ solo: false, naSala: [ana, bia] });
  const { semente, mapa } = p.estado();
  const a = cliente(0, semente, mapa, PERFIS.piloto, true);
  const b = cliente(1, semente, mapa, PERFIS.piloto, true);
  for (let volta = 0; volta < 20000 && p.estado().fase === 'jogando'; volta++) {
    p.passar(200);
    for (const [c, id] of [[a, ana], [b, bia]] as const) {
      const m = c.andar();
      if (m) p.j().tempoReal!(id, m);
    }
    turnosDifundidos(p.difundido, a, b);
    if (volta % 20 === 0) p.j().conferir!();
  }
  // os dois clientes andam o que falta (os últimos turnos já difundidos)
  for (let i = 0; i < 10; i++) {
    a.andar();
    b.andar();
  }
  const e = p.estado();
  assert.equal(e.fase, 'fim');
  assert.notEqual(e.resultado.vencedor, null);
  assert.equal(a.sim.vencedor, e.resultado.vencedor);
  assert.equal(S.assinatura(a.sim), S.assinatura(b.sim), 'os dois computadores iguais');
  assert.equal(e.resultado.passos, a.sim.passo);
  assert.equal(p.estado(ana).resultado.venceu, e.resultado.vencedor === 0);
  assert.equal(p.estado(bia).resultado.venceu, e.resultado.vencedor === 1);
  assert.ok(!p.difundido.some((m) => m.tocas === 'ressincronizar'), 'nenhuma dessincronia');
  const trofeus = [...db.trofeusDe(ana), ...db.trofeusDe(bia)].filter((t) => t.pista === 'tocas');
  assert.equal(trofeus.length, 2);
  assert.deepEqual(trofeus.map((t) => t.posicao).sort(), [1, 2]);
});

test('a sala: a assinatura diferente manda refazer; na segunda, a partida acaba sem troféu', () => {
  const p = comecar({ solo: false, naSala: [ana, bia] });
  const { semente, mapa } = p.estado();
  const a = cliente(0, semente, mapa);
  const b = cliente(1, semente, mapa);
  const rodar = (n: number) => {
    for (let i = 0; i < n; i++) {
      p.passar(200);
      for (const [c, id] of [[a, ana], [b, bia]] as const) {
        const m = c.andar();
        if (m) p.j().tempoReal!(id, m);
      }
      for (const m of p.difundido) if (m.tocas === 'turno') for (const c of [a, b]) c.recebidos.set(m.k as number, m.c as [S.Comando[], S.Comando[]]);
      const outros = p.difundido.filter((m) => m.tocas !== 'turno');
      p.difundido.splice(0, p.difundido.length, ...outros);
    }
  };
  rodar(60);
  assert.ok(!p.difundido.length);
  // o computador da bia se perde (um recurso que não existe no do servidor)
  b.sim.jogadores[1].recursos.ouro += 7;
  rodar(30);
  assert.deepEqual(p.difundido.find((m) => m.tocas === 'ressincronizar'), { tocas: 'ressincronizar', dono: 1 });
  rodar(30);
  assert.equal(p.estado().fase, 'fim');
  assert.equal(p.estado().resultado.motivo, 'desencontro');
  assert.equal(p.estado().resultado.vencedor, null);
});

test('a sala: quem sai por 1 minuto perde (sem troféu); quem desiste perde', () => {
  const p = comecar({ solo: false, naSala: [ana, bia] });
  p.sair(bia);
  p.j().conferir!();
  p.passar(AUSENCIA_MS + 1000);
  p.j().conferir!();
  assert.equal(p.estado().resultado.motivo, 'saiu');
  assert.equal(p.estado().resultado.vencedor, 0);
  assert.equal(p.estado(ana).resultado.venceu, true);
  const q = comecar({ solo: false, naSala: [ana, bia] });
  assert.equal(q.j().acao(ana, { tipo: 'desistir' }), null);
  assert.equal(q.estado(bia).resultado.venceu, true);
  // parada: o servidor diz de quem é a espera
  const r = comecar({ solo: false, naSala: [ana, bia] });
  r.j().tempoReal!(ana, { k: ATRASO_TURNOS, c: [] });
  r.passar(3000);
  r.j().conferir!();
  assert.deepEqual(r.difundido.at(-1), { tocas: 'espera', donos: [1] });
});

// ---------------------------------------------------------------------------------------------------------------------
// OS 20 MINUTOS SÃO UMA SUGESTÃO (24/11/2026)
// ---------------------------------------------------------------------------------------------------------------------

test('o Solo passa dos 20 minutos: a partida segue até a pessoa terminar pelos pontos (o servidor refaz e concorda)', async () => {
  const { PASSOS_SUGERIDOS, MAIOR_TRECHO, VOTAM_NO_SOLO } = await import('../src/minijogo-tocas.js');
  const p = comecar();
  const semente = p.estado().semente as number;
  // o tutorial: o computador não ataca, e a partida chega aos 20 minutos
  assert.equal(p.j().acao(ana, { tipo: 'comecar', tutorial: true }), null);
  const tela = S.novaPartida(semente, { mapa: 'campo', votam: VOTAM_NO_SOLO });
  const computador = criarIA(1, PERFIS.tutorial);
  const lote: [number, S.Comando][] = [];
  const votarEm = PASSOS_SUGERIDOS + 300;
  while (tela.vencedor === null && tela.passo < PASSOS_SUGERIDOS + 1000) {
    if (tela.passo === votarEm) {
      S.comandar(tela, 0, { t: 'pontos', aceita: true });
      lote.push([tela.passo, { t: 'pontos', aceita: true }]);
    }
    if (tela.passo === PASSOS_SUGERIDOS + 5) assert.equal(tela.vencedor, null, 'aos 20 minutos a partida segue');
    computador(tela);
    S.passo(tela);
  }
  assert.equal(tela.motivo, 'pontos');
  assert.equal(tela.passo, votarEm + 1);
  const fim = tela.passo;
  for (let de = 0; de < fim; ) {
    const ate = Math.min(fim, de + MAIOR_TRECHO);
    p.passar(((ate - de) / 10) * 1000);
    assert.equal(p.j().acao(ana, { tipo: 'trecho', de, ate, lote: lote.filter(([q]) => q >= de && q < ate) }), null);
    if (de < PASSOS_SUGERIDOS && ate > PASSOS_SUGERIDOS) assert.equal(p.estado().fase, 'jogando', 'o servidor também segue');
    de = ate;
  }
  const r = p.estado().resultado;
  assert.ok(r, 'acabou');
  assert.equal(r.motivo, 'pontos');
  assert.equal(r.passos, fim);
  assert.equal(r.conferido, true);
  // o fim declarado pela tela, pelos pontos, antes dos 20 minutos: não
  assert.ok(VITORIA_MIN_PASSOS < PASSOS_SUGERIDOS);
});

test('a sala passa dos 20 minutos: a proposta, a recusa que a desfaz, e o fim pelos pontos só com as duas aceitando', async () => {
  const { PASSOS_SUGERIDOS } = await import('../src/minijogo-tocas.js');
  const p = comecar({ solo: false, naSala: [ana, bia] });
  const { semente, mapa } = p.estado();
  const a = cliente(0, semente, mapa, PERFIS.tutorial);
  const b = cliente(1, semente, mapa, PERFIS.tutorial);
  const rodar = (ate: () => boolean) => {
    for (let volta = 0; volta < 40000 && p.estado().fase === 'jogando' && !ate(); volta++) {
      p.passar(200);
      for (const [c, id] of [[a, ana], [b, bia]] as const) {
        const m = c.andar();
        if (m) p.j().tempoReal!(id, m);
      }
      turnosDifundidos(p.difundido, a, b);
      if (volta % 50 === 0) p.j().conferir!();
    }
  };
  rodar(() => a.sim.passo >= PASSOS_SUGERIDOS + 20);
  assert.equal(p.estado().fase, 'jogando', 'aos 20 minutos a sala segue');
  assert.equal(a.sim.vencedor, null);
  // a ana propõe; a bia recusa: a proposta se desfaz
  a.ordenar({ t: 'pontos', aceita: true });
  rodar(() => b.sim.votos !== 0);
  assert.equal(b.sim.votos, 1, 'a proposta chegou ao computador da bia');
  b.ordenar({ t: 'pontos', aceita: false });
  rodar(() => a.sim.votos === 0);
  assert.equal(a.sim.votos, 0, 'a recusa desfez a proposta');
  assert.equal(p.estado().fase, 'jogando');
  // de novo, e agora a bia aceita
  a.ordenar({ t: 'pontos', aceita: true });
  rodar(() => b.sim.votos !== 0);
  b.ordenar({ t: 'pontos', aceita: true });
  rodar(() => false);
  for (let i = 0; i < 10; i++) {
    a.andar();
    b.andar();
  }
  const e = p.estado();
  assert.equal(e.fase, 'fim');
  assert.equal(e.resultado.motivo, 'pontos');
  assert.equal(a.sim.motivo, 'pontos');
  assert.equal(S.assinatura(a.sim), S.assinatura(b.sim));
  assert.equal(e.resultado.passos, a.sim.passo);
});
