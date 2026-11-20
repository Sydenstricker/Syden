/**
 * Tocas e Torres, o 2×2 e quem assiste (20/11/2026): quem convida escolhe 1×1 ou 2×2; no 2×2 os ROBÔS completam os lugares que
 * faltam e jogam DENTRO da simulação (cada computador anda a mesma IA no mesmo passo), e quem está na sala sem jogar recebe os
 * mesmos turnos e anda a mesma partida, sem mandar nada. O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const { criarTocas, ATRASO_TURNOS, HASH_CADA_TURNOS, PASSOS_POR_TURNO, AUSENCIA_MS, NIVEL_DOS_ROBOS } = await import('../src/minijogo-tocas.js');
const S = await import('../src/tocas/sim.js');
const { criarIA, PERFIS } = await import('../src/tocas/ia.js');
const db = await import('../src/db.js');

const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const ana = await idDe((await criarConta(app, 'ana-2x2')).token);
const bia = await idDe((await criarConta(app, 'bia-2x2')).token);
const cai = await idDe((await criarConta(app, 'cai-2x2')).token);
const dai = await idDe((await criarConta(app, 'dai-2x2')).token);
const NOMES: Record<number, string> = { [ana]: 'ana', [bia]: 'bia', [cai]: 'cai', [dai]: 'dai' };

type Jogo = { publico(q: number): Record<string, any>; acao(q: number, c: Record<string, unknown>): string | null; tempoReal?(q: number, d: unknown): unknown; conferir?(): void };

function comecar(naSala: number[], corpo: Record<string, unknown>, sorteio = () => 0.25) {
  let agora = 5_000_000;
  const difundido: Record<string, unknown>[] = [];
  let presentes = naSala;
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => {},
    naSala: () => presentes,
    nome: (id: number) => NOMES[id] ?? '?',
    comunidade: 1,
    solo: false,
    difundir: (d: unknown) => difundido.push(d as Record<string, unknown>),
  };
  const jogo = criarTocas({ agora: () => agora, sorteio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo });
  return {
    jogo: jogo as Jogo | string,
    j: () => jogo as Jogo,
    estado: (q = naSala[0]) => (jogo as Jogo).publico(q),
    passar: (ms: number) => (agora += ms),
    difundido,
    sair: (id: number) => (presentes = presentes.filter((x) => x !== id)),
  };
}

/**
 * Um computador da sala, como o do site (JogoTocas.tsx): a sua cópia da partida, os robôs andando dentro dela antes de cada
 * passo, e o piloto automático pela pessoa (`dono`); sem dono, é QUEM ASSISTE: anda os turnos que chegam e não manda nada.
 */
function cliente(dono: S.Dono | null, estado: Record<string, any>) {
  const sim = S.novaPartida(estado.semente, { mapa: estado.mapa, quatro: estado.formato === '2x2' });
  const robos = (estado.jogadores as { robo: boolean }[]).map((j, d) => (j.robo ? criarIA(d as S.Dono, PERFIS[NIVEL_DOS_ROBOS]) : null));
  const piloto = dono === null ? null : criarIA(dono, PERFIS.piloto);
  const recebidos = new Map<number, S.Comando[][]>();
  let k = 0;
  let pendentes: S.Comando[] = [];
  return {
    sim,
    recebidos,
    /** Anda um turno, se já tem; devolve a parte que mandaria ao servidor (null para quem assiste, ou esperando). */
    andar(): Record<string, unknown> | null {
      if (sim.vencedor !== null || (k >= ATRASO_TURNOS && !recebidos.has(k))) return null;
      const manda: Record<string, unknown> = { k: k + ATRASO_TURNOS, c: pendentes };
      if (k % HASH_CADA_TURNOS === 0) Object.assign(manda, { h: S.assinatura(sim), hk: k });
      pendentes = [];
      const t = recebidos.get(k);
      recebidos.delete(k);
      for (let i = 0; i < PASSOS_POR_TURNO && sim.vencedor === null; i++) {
        if (piloto) {
          piloto(sim);
          // o que o piloto mandou não vale já: vai ao servidor e volta no turno k + 3
          pendentes.push(...sim.fila.map((f) => f.c));
          sim.fila = [];
        }
        if (i === 0)
          t?.forEach((cs, d) => {
            for (const c of cs) S.comandar(sim, d as S.Dono, c);
          });
        for (const r of robos) r?.(sim);
        S.passo(sim);
      }
      k++;
      return dono === null ? null : manda;
    },
  };
}

function difundir(d: Record<string, unknown>[], ...cs: ReturnType<typeof cliente>[]) {
  for (const m of d.splice(0)) if (m.tocas === 'turno') for (const c of cs) c.recebidos.set(m.k as number, m.c as S.Comando[][]);
}

test('o convite escolhe o formato: sem pedir, é o 1×1 (as duas primeiras jogam, a terceira assiste); no 2×2 os robôs completam', () => {
  const um = comecar([ana, bia, cai], {});
  assert.equal(um.estado().formato, '1x1');
  assert.equal(um.estado().jogadores.length, 2);
  assert.equal(um.estado(cai).eu, null);
  assert.equal(um.j().acao(cai, { tipo: 'desistir' }), 'Você está assistindo esta partida.');

  const p = comecar([ana, bia, cai], { formato: '2x2' });
  const e = p.estado();
  assert.equal(e.formato, '2x2');
  assert.equal(e.jogadores.length, 4);
  assert.deepEqual(
    e.jogadores.map((j: { robo: boolean }) => j.robo),
    [false, false, false, true],
  );
  assert.ok(e.jogadores[3].userId < 0 && e.jogadores[3].username.startsWith('🤖'));
  assert.deepEqual([ana, bia, cai].map((id) => p.estado(id).eu), [0, 1, 2]);
  // as equipes: 0 e 2 contra 1 e 3 (a ana e a cai juntas, a bia com o robô)
  assert.ok(S.aliados(0, 2) && S.aliados(1, 3) && !S.aliados(0, 1) && !S.aliados(2, 3));
  // o turno espera as três pessoas, e o do robô vai vazio
  p.j().tempoReal!(ana, { k: ATRASO_TURNOS, c: [] });
  p.j().tempoReal!(bia, { k: ATRASO_TURNOS, c: [] });
  assert.equal(p.estado().resolvido, ATRASO_TURNOS);
  p.j().tempoReal!(cai, { k: ATRASO_TURNOS, c: [{ t: 'parar', ids: [1] }] });
  assert.equal(p.estado().resolvido, ATRASO_TURNOS + 1);
  const t = p.difundido.find((m) => m.tocas === 'turno')!;
  assert.deepEqual(t.c, [[], [], [{ t: 'parar', ids: [1] }], []]);
  // o robô não manda nada pela rede, e não tem "eu"
  assert.equal(p.j().tempoReal!(e.jogadores[3].userId, { k: ATRASO_TURNOS, c: [] }), null);
  assert.equal(p.estado(e.jogadores[3].userId).eu, null);
});

test('o mapa do 2×2: quatro bases iguais nos cantos, e de cada uma se chega às outras três (em muitas sementes, nos quatro tipos)', () => {
  for (const mapa of S.MAPAS)
    for (const semente of [1, 7, 99, 2024, 31337]) {
      const sim = S.novaPartida(semente, { mapa, quatro: true });
      assert.equal(sim.jogadores.length, 4);
      const centros = sim.predios.filter((p) => p.tipo === 'centro');
      assert.equal(centros.length, 4);
      assert.equal(sim.unidades.length, 12);
      // o espelho nos dois eixos: o que há numa casa há nas outras três
      for (const f of sim.fontes) {
        for (const [x, y] of [[S.TAMANHO - 1 - f.gx, f.gy], [f.gx, S.TAMANHO - 1 - f.gy]]) assert.notEqual(sim.grade[S.ind(x, y)], 0, `${mapa} ${semente}: sem o espelho de ${f.gx},${f.gy}`);
      }
      for (const a of S.donos(sim))
        for (const b of S.donos(sim)) {
          if (a === b) continue;
          const ca = sim.centros[a];
          const cb = sim.centros[b];
          const saida = ca.gy > S.TAMANHO / 2 ? ca.gy - 1 : ca.gy + 3;
          assert.ok(S.alcancavel(sim, a, ca.gx + 1.5, saida + 0.5, cb.gx, cb.gy, cb.gx + 2, cb.gy + 2), `${mapa} ${semente}: ${a} não chega a ${b}`);
        }
    }
});

test('o 2×2 inteiro em lockstep, com dois robôs: os dois computadores, quem assiste e o servidor terminam iguais; o pódio vai a quem jogou', () => {
  const p = comecar([ana, bia], { formato: '2x2', mapa: 'campo' });
  const e0 = p.estado();
  const a = cliente(0, e0);
  const b = cliente(1, e0);
  // a dai está na sala e não joga: assiste
  const v = cliente(null, p.estado(dai));
  assert.equal(p.estado(dai).eu, null);
  for (let volta = 0; volta < 20000 && p.estado().fase === 'jogando'; volta++) {
    p.passar(200);
    for (const [c, id] of [[a, ana], [b, bia]] as const) {
      const m = c.andar();
      if (m) p.j().tempoReal!(id, m);
    }
    v.andar();
    difundir(p.difundido, a, b, v);
    if (volta % 20 === 0) p.j().conferir!();
  }
  for (let i = 0; i < 10; i++) for (const c of [a, b, v]) c.andar();
  const e = p.estado();
  assert.equal(e.fase, 'fim');
  assert.notEqual(e.resultado.vencedor, null);
  assert.equal(a.sim.vencedor, e.resultado.vencedor);
  assert.equal(S.assinatura(a.sim), S.assinatura(b.sim), 'os dois computadores iguais');
  assert.equal(S.assinatura(a.sim), S.assinatura(v.sim), 'quem assiste vê a mesma partida');
  assert.equal(e.resultado.passos, a.sim.passo);
  assert.ok(!p.difundido.some((m) => m.tocas === 'ressincronizar'), 'nenhuma dessincronia');
  assert.equal(p.estado(ana).resultado.venceu, e.resultado.vencedor === 0);
  assert.equal(p.estado(bia).resultado.venceu, e.resultado.vencedor === 1);
  assert.equal(p.estado(dai).resultado.venceu, false);
  // os robôs jogaram de verdade: as bases deles cresceram
  assert.ok(a.sim.historico.at(-1)!.colhido[2] > 500 && a.sim.historico.at(-1)!.colhido[3] > 500);
  const trofeus = [...db.trofeusDe(ana), ...db.trofeusDe(bia)].filter((t) => t.pista === 'tocas');
  assert.equal(trofeus.length, 2);
  assert.deepEqual(trofeus.map((t) => t.posicao).sort(), [1, 2]);
  assert.equal(db.trofeusDe(dai).length, 0);
});

test('quem chega no meio para assistir refaz a partida pelos turnos guardados, e alcança quem joga', () => {
  const p = comecar([ana, bia], { formato: '1x1', mapa: 'floresta' });
  const a = cliente(0, p.estado());
  const b = cliente(1, p.estado(bia));
  for (let volta = 0; volta < 400; volta++) {
    p.passar(200);
    for (const [c, id] of [[a, ana], [b, bia]] as const) {
      const m = c.andar();
      if (m) p.j().tempoReal!(id, m);
    }
    difundir(p.difundido, a, b);
  }
  // a dai abre o painel agora: o estado traz os turnos com comando, e ela anda até onde o servidor resolveu
  const e = p.estado(dai);
  assert.equal(e.eu, null);
  assert.ok(e.turnos.length > 0);
  const v = cliente(null, e);
  for (const [k, ...cs] of e.turnos as [number, ...S.Comando[][]][]) v.recebidos.set(k, cs);
  for (let k = 0; k < e.resolvido; k++) {
    if (!v.recebidos.has(k)) v.recebidos.set(k, [[], []]);
    v.andar();
  }
  for (const c of [a, b]) while (c.andar());
  assert.equal(v.sim.passo, a.sim.passo);
  assert.equal(S.assinatura(v.sim), S.assinatura(a.sim));
  // quem assiste não manda nada
  assert.equal(p.j().tempoReal!(dai, { k: ATRASO_TURNOS, c: [] }), null);
});

test('no 2×2, quem sai da sala com a aliada de pé deixa a base parada e a partida segue; sem ninguém pela equipe, ela perde', () => {
  const p = comecar([ana, bia, cai], { formato: '2x2' });
  p.sair(cai);
  p.j().conferir!();
  p.passar(AUSENCIA_MS + 1000);
  p.j().conferir!();
  assert.equal(p.estado().fase, 'jogando');
  assert.deepEqual(p.difundido.find((m) => m.tocas === 'largou'), { tocas: 'largou', dono: 2 });
  assert.equal(p.estado(cai).largou, true);
  assert.equal(p.estado(cai).meuProximo, null);
  // o turno anda só com a ana e a bia (a parte da cai vai vazia)
  p.j().tempoReal!(ana, { k: ATRASO_TURNOS, c: [] });
  p.j().tempoReal!(bia, { k: ATRASO_TURNOS, c: [] });
  assert.equal(p.estado().resolvido, ATRASO_TURNOS + 1);
  assert.equal(p.j().tempoReal!(cai, { k: ATRASO_TURNOS + 1, c: [] }), null);
  // a ana desiste: a equipe dela fica sem ninguém, e a da bia ganha
  assert.equal(p.j().acao(ana, { tipo: 'desistir' }), null);
  assert.equal(p.estado().resultado.motivo, 'desistiu');
  assert.equal(p.estado().resultado.vencedor, 1);
  assert.equal(p.estado(bia).resultado.venceu, true);
  assert.equal(p.estado(cai).resultado.venceu, false);
});
