/**
 * Batalha naval (minijogo-naval.ts): a frota sorteada (tamanhos, dentro do mar, nenhum navio encostado, nem na diagonal),
 * sortear de novo só antes do primeiro tiro, água passa a vez e fogo não, afundar, a casa repetida, a vitória, e o que cada
 * um vê — o navio escondido do outro nunca aparece, nem para quem assiste, até o fim. O sorteio e o relógio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASAS_DO_MAR, FROTA, LADO_DO_MAR, criarNaval, sortearFrota, type MarPublico } from '../src/minijogo-naval.js';

/** Um gerador com semente (mulberry32), para o sorteio se repetir. */
function semente(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Vista = {
  fase: string;
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: string | null;
  mares: [MarPublico, MarPublico];
  restam: [number[], number[]];
  ultimo: { lado: number; casa: number; resultado: string } | null;
  podeSortear: boolean;
};

const ANA = 1;
const BIA = 2;
const CAIO = 3;

function comecar(s = 7) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {
      terminou = true;
    },
    naSala: () => [ANA, BIA, CAIO],
    nome: (id: number) => ['', 'ana', 'bia', 'caio'][id],
  };
  const jogo = criarNaval(semente(s)).comecar(ctx, { naSala: [ANA], criadaPor: ANA, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    relogio,
    terminou: () => terminou,
    vista: (quem: number) => jogo.publico(quem) as unknown as Vista,
  };
}

/** Com a mesa cheia: devolve o jogo, quem atira primeiro e o outro. */
function sentados(s = 7) {
  const p = comecar(s);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  const vez = p.vista(ANA).vez;
  const ids = [ANA, BIA];
  return { ...p, primeiro: ids[vez], segundo: ids[1 - vez], ladoDoPrimeiro: vez };
}

function conferirFrota(navios: number[][]) {
  assert.deepEqual(
    navios.map((n) => n.length).sort((a, b) => b - a),
    [...FROTA].sort((a, b) => b - a),
  );
  const dono = new Map<number, number>();
  navios.forEach((casas, i) => {
    for (const c of casas) {
      assert.ok(Number.isInteger(c) && c >= 0 && c < CASAS_DO_MAR, `casa fora do mar: ${c}`);
      assert.ok(!dono.has(c), 'dois navios na mesma casa');
      dono.set(c, i);
    }
    // Reto e contínuo: todas na mesma linha com colunas seguidas, ou na mesma coluna com linhas seguidas.
    const ls = casas.map((c) => Math.floor(c / LADO_DO_MAR));
    const cs = casas.map((c) => c % LADO_DO_MAR);
    const deitado = ls.every((l) => l === ls[0]);
    const empe = cs.every((c) => c === cs[0]);
    assert.ok(deitado || empe, 'navio torto');
    const corre = (deitado ? cs : ls).slice().sort((a, b) => a - b);
    corre.forEach((v, k) => assert.equal(v, corre[0] + k, 'navio com buraco'));
  });
  // Nenhum encostado em outro, nem na diagonal.
  for (const [c, i] of dono) {
    const l = Math.floor(c / LADO_DO_MAR);
    const col = c % LADO_DO_MAR;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        const ll = l + dl;
        const cc = col + dc;
        if (ll < 0 || ll >= LADO_DO_MAR || cc < 0 || cc >= LADO_DO_MAR) continue;
        const vizinho = dono.get(ll * LADO_DO_MAR + cc);
        assert.ok(vizinho === undefined || vizinho === i, 'navios encostados');
      }
    }
  }
}

/** A frota de verdade de um lado: a vista do próprio dono mostra todos os navios. */
const frotaDe = (p: ReturnType<typeof comecar>, quem: number, lado: 0 | 1) => p.vista(quem).mares[lado].navios.map((n) => n.casas);

test('a frota sorteada é sempre válida', () => {
  for (let s = 1; s <= 500; s++) conferirFrota(sortearFrota(semente(s)));
  for (let k = 0; k < 200; k++) conferirFrota(sortearFrota());
});

test('cada um começa com uma frota válida, e quem está sentado vê a própria', () => {
  const p = sentados(3);
  conferirFrota(frotaDe(p, ANA, 0));
  conferirFrota(frotaDe(p, BIA, 1));
  assert.equal(p.vista(ANA).podeSortear, true);
  assert.equal(p.vista(CAIO).podeSortear, false);
});

test('a frota se sorteia de novo, fora da vez, só até o primeiro tiro no seu mar', () => {
  const p = sentados(11);
  const ladoDoSegundo = (1 - p.ladoDoPrimeiro) as 0 | 1;
  const antes = JSON.stringify(frotaDe(p, p.segundo, ladoDoSegundo));
  // Fora da vez, e mais de uma vez.
  assert.equal(p.jogo.acao(p.segundo, { tipo: 'livre', acao: 'sortear' }), null);
  assert.equal(p.jogo.acao(p.segundo, { tipo: 'livre', acao: 'sortear' }), null);
  const depois = frotaDe(p, p.segundo, ladoDoSegundo);
  conferirFrota(depois);
  assert.notEqual(JSON.stringify(depois), antes);
  assert.equal(p.jogo.acao(CAIO, { tipo: 'livre', acao: 'sortear' }), 'Você está assistindo esta partida.');
  assert.equal(p.jogo.acao(p.segundo, { tipo: 'livre', acao: 'outra' }), 'Ação desconhecida.');

  // O primeiro atira no mar do segundo: daí em diante, a frota do segundo fica.
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: 0 }), null);
  assert.equal(p.vista(p.segundo).podeSortear, false);
  assert.equal(p.jogo.acao(p.segundo, { tipo: 'livre', acao: 'sortear' }), 'Já atiraram no seu mar: a frota não muda mais.');
  // E o primeiro, que ainda não levou tiro, continua podendo.
  assert.equal(p.vista(p.primeiro).podeSortear, true);
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'livre', acao: 'sortear' }), null);
});

test('água passa a vez, fogo não, e o navio afunda quando todas as casas levam tiro', () => {
  const p = sentados(5);
  const outro = (1 - p.ladoDoPrimeiro) as 0 | 1;
  const navios = frotaDe(p, p.segundo, outro);
  const ocupadas = new Set(navios.flat());
  const agua = [...Array(CASAS_DO_MAR).keys()].find((c) => !ocupadas.has(c))!;

  // Fogo: a vez fica.
  const menor = navios.find((n) => n.length === 2)!;
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: menor[0] }), null);
  let v = p.vista(p.primeiro);
  assert.equal(v.vez, p.ladoDoPrimeiro);
  assert.deepEqual(v.ultimo, { lado: p.ladoDoPrimeiro, casa: menor[0], resultado: 'acertou' });
  assert.equal(v.mares[outro].tiros[menor[0]], 2);
  // A casa repetida é erro, e não perde a vez.
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: menor[0] }), 'Você já atirou nessa casa.');
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: 100 }), 'Escolha uma casa do mar.');
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: 'B7' }), 'Escolha uma casa do mar.');
  assert.equal(p.vista(p.primeiro).vez, p.ladoDoPrimeiro);

  // Afundou: aparece inteiro, sai dos que restam, e a vez fica.
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: menor[1] }), null);
  v = p.vista(p.primeiro);
  assert.equal(v.ultimo?.resultado, 'afundou');
  assert.equal(v.vez, p.ladoDoPrimeiro);
  assert.deepEqual(v.mares[outro].navios, [{ casas: menor, afundado: true }]);
  assert.deepEqual(v.restam[outro].slice().sort(), [3, 3, 4, 5]);

  // Água: a vez passa.
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: agua }), null);
  v = p.vista(p.primeiro);
  assert.equal(v.ultimo?.resultado, 'agua');
  assert.equal(v.mares[outro].tiros[agua], 1);
  assert.equal(v.vez, outro);
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: 50 }), 'Espere a sua vez.');
  assert.equal(p.jogo.acao(CAIO, { tipo: 'jogada', casa: 50 }), 'Você está assistindo esta partida.');
});

test('o navio escondido do outro nunca aparece, nem para quem assiste; no fim, tudo aparece', () => {
  const p = sentados(9);
  const outro = (1 - p.ladoDoPrimeiro) as 0 | 1;
  const meu = p.ladoDoPrimeiro;
  const alvo = frotaDe(p, p.segundo, outro);
  const minha = frotaDe(p, p.primeiro, meu);

  const semEscondido = () => {
    const doAtirador = p.vista(p.primeiro);
    for (const n of doAtirador.mares[outro].navios) assert.ok(n.afundado, 'navio vivo do outro na vista de quem atira');
    const doOutro = p.vista(p.segundo);
    for (const n of doOutro.mares[meu].navios) assert.ok(n.afundado, 'navio vivo do outro na vista do segundo');
    const plateia = p.vista(CAIO);
    for (const l of [0, 1] as const) for (const n of plateia.mares[l].navios) assert.ok(n.afundado, 'navio vivo na vista de quem assiste');
  };

  semEscondido();
  // Afunda todos menos o último navio, acertando metade dele também.
  const ultimoNavio = alvo[alvo.length - 1];
  for (const navio of alvo.slice(0, -1)) for (const c of navio) assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: c }), null);
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: ultimoNavio[0] }), null);
  semEscondido();
  // Quem assiste não vê a frota do primeiro, que ninguém atingiu.
  assert.deepEqual(p.vista(CAIO).mares[meu].navios, []);
  assert.equal(p.vista(p.primeiro).mares[meu].navios.length, minha.length);

  for (const c of ultimoNavio.slice(1)) assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: c }), null);
  const fim = p.vista(CAIO);
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.vencedor, p.ladoDoPrimeiro);
  assert.equal(fim.motivo, 'jogo');
  assert.ok(p.terminou());
  assert.equal(fim.mares[meu].navios.length, FROTA.length, 'no fim, a frota de quem venceu aparece');
  assert.ok(fim.mares[meu].navios.every((n) => !n.afundado));
  assert.ok(fim.mares[outro].navios.every((n) => n.afundado));
  assert.deepEqual(fim.restam[outro], []);
  assert.equal(p.vista(p.segundo).mares[meu].navios.length, FROTA.length);
  assert.equal(p.jogo.acao(p.primeiro, { tipo: 'jogada', casa: 99 }), 'A partida não está em andamento.');
});

test('quem desiste (ou demora) perde, e os navios aparecem para todos', () => {
  const p = sentados(13);
  assert.equal(p.jogo.acao(CAIO, { tipo: 'desistir' }), 'Você não está jogando.');
  assert.equal(p.jogo.acao(p.segundo, { tipo: 'desistir' }), null);
  const v = p.vista(CAIO);
  assert.equal(v.fase, 'fim');
  assert.equal(v.motivo, 'desistiu');
  assert.equal(v.vencedor, p.ladoDoPrimeiro);
  assert.equal(v.mares[0].navios.length, FROTA.length);
  assert.equal(v.mares[1].navios.length, FROTA.length);

  const q = sentados(17);
  q.relogio[0].depois();
  const w = q.vista(ANA);
  assert.equal(w.motivo, 'tempo');
  assert.equal(w.vencedor, 1 - q.ladoDoPrimeiro);
  assert.equal(w.mares[1 - q.ladoDoPrimeiro].navios.length, FROTA.length);
});

test('a mesa: sentar, cheia, e ninguém atira antes de o outro sentar', () => {
  const p = comecar(21);
  assert.equal(p.vista(ANA).fase, 'esperando');
  assert.equal(p.jogo.acao(ANA, { tipo: 'jogada', casa: 0 }), 'A partida não está em andamento.');
  assert.equal(p.jogo.acao(ANA, { tipo: 'livre', acao: 'sortear' }), 'A partida não está em andamento.');
  assert.equal(p.jogo.acao(ANA, { tipo: 'sentar' }), 'Você já está na mesa.');
  // Esperando, quem está na sala não vê a frota de quem sentou.
  assert.deepEqual(p.vista(BIA).mares[0].navios, []);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  assert.equal(p.jogo.acao(CAIO, { tipo: 'sentar' }), 'A mesa já está cheia.');
  assert.equal(p.vista(ANA).fase, 'jogando');
});
