/**
 * O LOTE D DA SEGUNDA AUDITORIA (21/11/2026), as mesas de xadrez, damas e batalha naval:
 * - Partida de xadrez: os FINAIS DE TREINO no Solo (a posição, a pessoa de brancas e abrindo, o motor defendendo, o recorde em
 *   lances contado pelo servidor) e a REVISÃO no fim (as posições depois de cada lance);
 * - Damas: o tabuleiro de 10 × 10 (as internacionais), escolhido na largada, e o robô que o joga até o fim;
 * - Batalha naval: as ARMAS ESPECIAIS (o tiro em cruz e o sonar, uma vez cada), conferidas no servidor, e o robô que as usa.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Chess } from 'chess.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';
import type { Contexto, Definicao, Jogo } from '../src/minijogo-motor.js';

const { app, fechar } = await servidorDeTeste();
const db = await import('../src/db.js');
const { partidaDeXadrez, FINAIS_DE_TREINO, lanceDoRobo: lanceDoXadrez, nomeDe } = await import('../src/minijogo-partida-de-xadrez.js');
const { desligarRoboDeXadrez } = await import('../src/xadrez-robo.js');
const { damas, posicaoInicial, lancesDe, aplicar, PEDRA_CLARA, PEDRA_ESCURA, DAMA_CLARA, VAZIA } = await import('../src/minijogo-damas.js');
const { criarNaval, casasDaCruz, casasDoSonar, MARES } = await import('../src/minijogo-naval.js');
after(async () => {
  await desligarRoboDeXadrez();
  await fechar();
});

const ana = await criarConta(app, 'ana-lote-d-mesas');
const bia = await criarConta(app, 'bia-lote-d-mesas');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

function semente(s: number) {
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Uma partida com o relógio de mão (guarda só o último agendado, como o motor). */
function partida(def: Definicao, { solo = true, corpo = {} as Record<string, unknown>, naSala = [anaId] } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => naSala,
    nome: (id) => (id === anaId ? 'ana' : id === biaId ? 'bia' : `p${id}`),
    comunidade: solo ? 0 : 7,
    solo,
  };
  const jogo = def.comecar(ctx, { naSala, criadaPor: naSala[0], corpo }) as Jogo;
  assert.notEqual(typeof jogo, 'string');
  return {
    jogo,
    relogio,
    terminou: () => terminou,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ver: (quem = anaId) => jogo.publico(quem) as Record<string, any>,
    andar: () => relogio[0]?.depois(),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// XADREZ: OS FINAIS DE TREINO E A REVISÃO
// ---------------------------------------------------------------------------------------------------------------------------

test('Xadrez, final de treino: a posição do final, a pessoa de brancas e abrindo; na sala, o final é ignorado', () => {
  for (const [id, fen] of Object.entries(FINAIS_DE_TREINO)) {
    // a semente que faria o robô abrir, na partida comum
    const p = partida(partidaDeXadrez, { corpo: { final: id, nivel: 'iniciante' } });
    const v = p.ver();
    assert.equal(v.final, id);
    assert.equal(v.vez, 0, 'a pessoa abre');
    assert.equal(v.brancas, 0, 'de brancas');
    assert.ok(v.lances.length > 0);
    assert.deepEqual(v.casas.join(','), new Chess(fen).board().flat().map((c) => (c ? (c.color === 'w' ? c.type.toUpperCase() : c.type) : '')).join(','));
    assert.equal(v.escolhas.final, id, 'o "Jogar de novo" repete o final');
  }
  const sala = partida(partidaDeXadrez, { solo: false, naSala: [anaId, biaId], corpo: { final: 'dama' } });
  sala.jogo.acao(biaId, { tipo: 'sentar' });
  assert.equal(sala.ver().final, null);
  assert.equal(sala.ver().casas.filter(Boolean).length, 32, 'a partida inteira');
});

test('Xadrez, final de treino: o mate da pessoa vira o recorde em lances (o servidor conta), e a revisão anda pelas posições', async () => {
  for (const id of ['dama', 'torre'] as const) {
    const p = partida(partidaDeXadrez, { corpo: { final: id } });
    const vezDaPessoa = async () => {
      for (let i = 0; i < 500 && !p.terminou() && !(p.ver().vez === 0 && p.ver().lances.length); i++) await new Promise((r) => setTimeout(r, 20));
    };
    // a pessoa joga com o motor no Difícil (o "piloto"); o robô defende no worker
    for (let k = 0; k < 60 && !p.terminou(); k++) {
      await vezDaPessoa();
      if (p.terminou()) break;
      const v = p.ver();
      const jogo = new Chess(FINAIS_DE_TREINO[id]);
      for (const san of v.historico.map((h: { texto: string }) => h.texto)) jogo.move(san);
      const l = lanceDoXadrez(jogo.fen(), semente(k + 1), 'dificil', (jogo.history({ verbose: true }) as { before: string }[]).map((m) => m.before))!;
      assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', de: l.de, para: l.para, promocao: 'q' }), null);
      if (!p.terminou()) p.andar();
    }
    assert.ok(p.terminou(), `o final ${id} acaba`);
    const v = p.ver();
    assert.equal(v.fimPor, 'mate');
    assert.equal(v.vencedor, 0);
    const meus = v.historico.filter((h: { lado: number }) => h.lado === 0).length;
    // o recorde é gravado pelo import tardio do banco
    for (let i = 0; i < 50 && v.resultadoDoFinal?.novo == null; i++) await new Promise((r) => setTimeout(r, 10));
    const r = p.ver().resultadoDoFinal;
    assert.equal(r.lances, meus);
    assert.equal(r.novo, true);
    assert.equal(db.recordeDoSolo(anaId, 'partida-de-xadrez', `final-${id}`)?.valor, meus);
    // a revisão: a posição inicial, uma por lance, e a última é a do mate
    const rev = p.ver().revisao;
    assert.equal(rev.fens.length, v.historico.length + 1);
    assert.equal(rev.fens[0], FINAIS_DE_TREINO[id]);
    assert.ok(new Chess(rev.fens.at(-1)).isCheckmate());
    assert.equal(rev.lances.length, v.historico.length);
    assert.equal(nomeDe(rev.lances[0].de).length, 2);
  }
});

test('Xadrez, final de treino: quem volta o lance dá o mate, mas o recorde não vale (decisão dele, 21/11/2026)', async () => {
  const p = partida(partidaDeXadrez, { corpo: { final: 'torre' } });
  const vezDaPessoa = async () => {
    for (let i = 0; i < 500 && !p.terminou() && !(p.ver().vez === 0 && p.ver().lances.length); i++) await new Promise((r) => setTimeout(r, 20));
  };
  const jogarBem = async (k: number) => {
    await vezDaPessoa();
    if (p.terminou()) return;
    const jogo = new Chess(FINAIS_DE_TREINO.torre);
    for (const san of p.ver().historico.map((h: { texto: string }) => h.texto)) jogo.move(san);
    const l = lanceDoXadrez(jogo.fen(), semente(k + 1), 'dificil', (jogo.history({ verbose: true }) as { before: string }[]).map((m) => m.before))!;
    assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', de: l.de, para: l.para, promocao: 'q' }), null);
    if (!p.terminou()) p.andar();
  };
  await jogarBem(0);
  await vezDaPessoa();
  assert.equal(p.jogo.acao(anaId, { tipo: 'voltar' }), null, 'volta o lance');
  const antes = db.recordeDoSolo(anaId, 'partida-de-xadrez', 'final-torre')?.valor ?? null;
  for (let k = 1; k < 80 && !p.terminou(); k++) await jogarBem(k);
  assert.ok(p.terminou());
  assert.equal(p.ver().fimPor, 'mate');
  const r = p.ver().resultadoDoFinal;
  assert.equal(r.voltou, true);
  assert.equal(r.novo, false);
  await new Promise((res) => setTimeout(res, 100));
  assert.equal(db.recordeDoSolo(anaId, 'partida-de-xadrez', 'final-torre')?.valor ?? null, antes, 'o recorde não mudou');
});

test('Xadrez: a revisão só aparece no fim (desistir também conta)', () => {
  const p = partida(partidaDeXadrez, { solo: false, naSala: [anaId, biaId] });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  assert.equal(p.ver().revisao, undefined);
  const v = p.ver();
  const brancas = v.jogadores[v.brancas].userId as number;
  assert.equal(p.jogo.acao(brancas, { tipo: 'jogada', de: 52, para: 36 }), null); // e2-e4
  assert.equal(p.jogo.acao(anaId, { tipo: 'desistir' }), null);
  const fim = p.ver();
  assert.equal(fim.revisao.fens.length, 2);
  assert.deepEqual(fim.revisao.lances, [{ de: 52, para: 36 }]);
});

// ---------------------------------------------------------------------------------------------------------------------------
// DAMAS 10 × 10
// ---------------------------------------------------------------------------------------------------------------------------

test('Damas 10 × 10: 20 de cada lado nas quatro primeiras fileiras, 9 lances de abertura, e a pedra coroa na fileira 0', () => {
  const casas = posicaoInicial(10);
  assert.equal(casas.length, 100);
  assert.equal(casas.filter((p) => p === PEDRA_CLARA).length, 20);
  assert.equal(casas.filter((p) => p === PEDRA_ESCURA).length, 20);
  casas.forEach((p, i) => p && assert.equal((Math.floor(i / 10) + (i % 10)) % 2, 1, 'só nas escuras'));
  assert.equal(lancesDe(casas, 0).length, 9);
  assert.equal(lancesDe(casas, 1).length, 9);
  // a pedra clara perto do fim: anda e vira dama na linha 0
  const t = new Array<number>(100).fill(VAZIA);
  t[1 * 10 + 2] = PEDRA_CLARA;
  t[9 * 10 + 0] = PEDRA_ESCURA;
  const l = lancesDe(t, 0).find((x) => x.caminho[0] === 1)!;
  aplicar(t, l);
  assert.equal(t[1], DAMA_CLARA);
  // a dama voa a diagonal inteira do de 10 (de 1 até 9 casas)
  assert.equal(lancesDe(t, 0).length, 9, 'uma casa para um lado, oito para o outro');
});

test('Damas 10 × 10: escolhido na largada, volta no público, e o Solo vai até o fim contra o robô nos três níveis', () => {
  for (const nivel of ['facil', 'normal', 'dificil']) {
    const p = partida(damas, { corpo: { tamanho: 10, nivel } });
    assert.equal(p.ver().tamanho, 10);
    assert.equal(p.ver().casas.length, 100);
    assert.equal(p.ver().escolhas.tamanho, 10);
    const sorte = semente(nivel.length);
    for (let k = 0; k < 600 && !p.terminou(); k++) {
      const v = p.ver();
      if (v.vez === 0 && v.lances.length) {
        const i = Math.floor(sorte() * v.lances.length);
        assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', lance: i }), null);
      } else p.andar();
    }
    assert.ok(p.terminou(), `a partida no ${nivel} acaba`);
  }
  // a de fábrica continua a de 8
  const q = partida(damas, {});
  assert.equal(q.ver().tamanho, 8);
  assert.equal(q.ver().casas.length, 64);
});

// ---------------------------------------------------------------------------------------------------------------------------
// BATALHA NAVAL: AS ARMAS ESPECIAIS
// ---------------------------------------------------------------------------------------------------------------------------

/** Uma mesa da naval na sala, com as frotas sorteadas e prontas: devolve quem abre. */
function mesaNaval(corpo: Record<string, unknown>, s = 5) {
  const p = partida(criarNaval(semente(s)), { solo: false, naSala: [anaId, biaId], corpo });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  for (const quem of [anaId, biaId]) {
    assert.equal(p.jogo.acao(quem, { tipo: 'montar', acao: 'sortear' }), null);
    assert.equal(p.jogo.acao(quem, { tipo: 'montar', acao: 'pronto' }), null);
  }
  const v = p.ver();
  const abre = v.jogadores[v.vez].userId as number;
  return { ...p, abre, outro: abre === anaId ? biaId : anaId, ladoQueAbre: v.vez as 0 | 1 };
}

test('Naval: as casas da cruz e do sonar ficam no mar (as do canto são menos)', () => {
  assert.deepEqual(casasDaCruz(0, 10).sort((a, b) => a - b), [0, 1, 10]);
  assert.equal(casasDaCruz(55, 10).length, 5);
  assert.equal(casasDoSonar(0, 10).length, 4);
  assert.equal(casasDoSonar(55, 10).length, 9);
});

test('Naval com armas: o tiro em cruz cai em até 5 casas, passa a vez, e só uma vez por partida', () => {
  const p = mesaNaval({ armas: true });
  assert.equal(p.ver().armas, true);
  const centro = 4 * 10 + 4;
  assert.equal(p.jogo.acao(p.abre, { tipo: 'jogada', arma: 'cruz', casa: centro }), null);
  const v = p.ver(p.abre);
  const outroLado = p.ladoQueAbre === 0 ? 1 : 0;
  const atiradas = v.mares[outroLado].tiros.flatMap((t: number, i: number) => (t ? [i] : []));
  assert.deepEqual(atiradas.sort((a: number, b: number) => a - b), casasDaCruz(centro, 10).sort((a, b) => a - b));
  assert.equal(v.vez, outroLado, 'a vez passa, mesmo acertando');
  assert.equal(v.usadas[p.ladoQueAbre].cruz, true);
  // o outro joga um tiro comum na água ou acerta; depois, a cruz de novo é recusada
  for (let i = 0; i < 100 && p.ver().vez !== p.ladoQueAbre; i++) p.jogo.acao(p.outro, { tipo: 'jogada', casa: i });
  assert.equal(p.jogo.acao(p.abre, { tipo: 'jogada', arma: 'cruz', casa: 0 }), 'Você já usou essa arma.');
  assert.match(p.jogo.acao(p.abre, { tipo: 'jogada', arma: 'bomba', casa: 0 })!, /desconhecida/);
});

test('Naval com armas: o sonar conta os navios da área sem mostrar onde, e quem assiste não vê navio nenhum', () => {
  const p = mesaNaval({ armas: true }, 9);
  const outroLado = p.ladoQueAbre === 0 ? 1 : 0;
  // o mar do outro, como o servidor guarda (o fim revela tudo: aqui, pela vista do dono)
  const navios: number[][] = p.ver(p.outro).mares[outroLado].navios.map((n: { casas: number[] }) => n.casas);
  const centro = 5 * 10 + 5;
  const area = new Set(casasDoSonar(centro, 10));
  const esperado = navios.filter((n) => n.some((c) => area.has(c))).length;
  assert.equal(p.jogo.acao(p.abre, { tipo: 'jogada', arma: 'sonar', casa: centro }), null);
  const v = p.ver(p.abre);
  assert.deepEqual(v.sonares, [{ lado: p.ladoQueAbre, centro, navios: esperado }]);
  assert.equal(v.mares[outroLado].tiros.filter(Boolean).length, 0, 'o sonar não atira');
  assert.equal(v.mares[outroLado].navios.length, 0, 'nem mostra navio');
  assert.equal(v.vez, outroLado, 'gasta a vez');
  const quemAssiste = p.ver(-999);
  assert.ok(quemAssiste.mares.every((m: { navios: unknown[] }) => m.navios.length === 0));
  assert.equal(p.ver().historico.at(-1).texto, `◎F6:${esperado}`);
});

test('Naval: sem a variante, as armas são recusadas; com o salvo, a variante não liga', () => {
  const p = mesaNaval({});
  assert.equal(p.ver().armas, false);
  assert.match(p.jogo.acao(p.abre, { tipo: 'jogada', arma: 'cruz', casa: 0 })!, /não tem armas/);
  const s = partida(criarNaval(semente(2)), { solo: false, naSala: [anaId, biaId], corpo: { armas: true, salvo: true } });
  assert.equal(s.ver().armas, false);
});

test('Naval com armas: o Solo vai até o fim contra o robô, que usa as duas, nos três níveis e nos três mares', () => {
  let usouAsDuas = 0;
  for (const nivel of ['facil', 'normal', 'dificil']) {
    for (const mar of [8, 10, 12]) {
      const p = partida(criarNaval(semente(mar + nivel.length)), { corpo: { armas: true, nivel, mar } });
      assert.equal(p.jogo.acao(anaId, { tipo: 'montar', acao: 'sortear' }), null);
      assert.equal(p.jogo.acao(anaId, { tipo: 'montar', acao: 'pronto' }), null);
      // ana atira devagar (uma linha de cada vez), para o robô ter tempo de usar as armas
      let proxima = 0;
      for (let k = 0; k < 3000 && !p.terminou(); k++) {
        const v = p.ver();
        if (v.vez === 0) {
          while (v.mares[1].tiros[proxima]) proxima++;
          assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', casa: proxima }), null);
        } else p.andar();
      }
      assert.ok(p.terminou(), `acaba (${nivel}, ${mar})`);
      const u = p.ver().usadas[1];
      if (u.cruz && u.sonar) usouAsDuas++;
      assert.equal(p.ver().mares[1].navios.length, MARES[mar].length);
    }
  }
  assert.ok(usouAsDuas >= 5, `o robô usou as duas armas em ${usouAsDuas} de 9`);
});
