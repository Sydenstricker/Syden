/**
 * Batalha naval (minijogo-naval.ts): a frota sorteada (tamanhos, dentro do mar, nenhum navio encostado, nem na diagonal),
 * sortear de novo só antes do primeiro tiro, água passa a vez e fogo não, afundar, a casa repetida, a vitória, e o que cada
 * um vê — o navio escondido do outro nunca aparece, nem para quem assiste, até o fim — e a montagem (05/11/2026): pôr, girar,
 * mudar de lugar, sortear, "Pronto", o tempo que sorteia o que falta e o robô pronto na hora. O sorteio e o relógio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASAS_DO_MAR, FROTA, LADO_DO_MAR, MONTAGEM_MS, casasDoNavio, criarNaval, encosta, sortearFrota, type MarPublico } from '../src/minijogo-naval.js';
import { JOGADA_MS, JOGADA_SOLO_MS } from '../src/minijogo-tabuleiro.js';

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
  montagem: { navios: (number[] | null)[] | null; prontos: [boolean, boolean] };
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

/** Com a mesa cheia e as duas frotas sorteadas na montagem: devolve o jogo, quem atira primeiro e o outro. */
function sentados(s = 7) {
  const p = comecar(s);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  for (const quem of [ANA, BIA]) {
    assert.equal(p.jogo.acao(quem, { tipo: 'montar', acao: 'sortear' }), null);
    assert.equal(p.jogo.acao(quem, { tipo: 'montar', acao: 'pronto' }), null);
  }
  assert.equal(p.vista(ANA).fase, 'jogando');
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
  assert.equal(p.jogo.acao(p.segundo, { tipo: 'livre', acao: 'sortear' }), 'Já atiraram no seu mar: a frota não muda mais.');
  // E o primeiro, que ainda não levou tiro, continua podendo.
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
  assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'sortear' }), 'A partida não está em andamento.');
  assert.equal(p.jogo.acao(ANA, { tipo: 'sentar' }), 'Você já está na mesa.');
  // Esperando, quem está na sala não vê a frota de quem sentou.
  assert.deepEqual(p.vista(BIA).mares[0].navios, []);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  assert.equal(p.jogo.acao(CAIO, { tipo: 'sentar' }), 'A mesa já está cheia.');
  assert.equal(p.vista(ANA).fase, 'montando', 'com a mesa cheia, cada um põe os navios');
});

// ---- A MONTAGEM (05/11/2026): cada um põe os próprios navios antes do primeiro tiro ----

/** Uma frota posta à mão, dentro da regra: os cinco deitados, em linhas alternadas. */
const FROTA_DE_MAO: { casa: number; deitado: boolean }[] = [
  { casa: 0, deitado: true }, // 5: A1–E1
  { casa: 20, deitado: true }, // 4: A3–D3
  { casa: 40, deitado: true }, // 3: A5–C5
  { casa: 60, deitado: true }, // 3: A7–C7
  { casa: 80, deitado: true }, // 2: A9–B9
];

test('a montagem: pôr, mudar de lugar, girar e tirar navios, dentro da regra', () => {
  const p = comecar(31);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  let v = p.vista(ANA);
  assert.equal(v.fase, 'montando');
  assert.equal(p.relogio[0].ms, MONTAGEM_MS);
  assert.deepEqual(v.montagem.navios, [null, null, null, null, null], 'começa com o mar vazio');
  assert.deepEqual(v.montagem.prontos, [false, false]);
  const montar = (corpo: Record<string, unknown>) => p.jogo.acao(ANA, { tipo: 'montar', ...corpo });

  // o de 5, deitado, em A1
  assert.equal(montar({ acao: 'por', navio: 0, casa: 0, deitado: true }), null);
  assert.deepEqual(p.vista(ANA).montagem.navios![0], [0, 1, 2, 3, 4]);
  // muda de lugar e gira: em pé, a partir de J1
  assert.equal(montar({ acao: 'por', navio: 0, casa: 9, deitado: false }), null);
  assert.deepEqual(p.vista(ANA).montagem.navios![0], [9, 19, 29, 39, 49]);
  // o que não cabe no mar, o que encosta (também na diagonal) e o que cai em cima
  assert.equal(montar({ acao: 'por', navio: 1, casa: 7, deitado: true }), 'O navio não cabe aí.');
  assert.equal(montar({ acao: 'por', navio: 1, casa: 70, deitado: false }), 'O navio não cabe aí.');
  assert.equal(montar({ acao: 'por', navio: 1, casa: -1, deitado: true }), 'O navio não cabe aí.');
  assert.equal(montar({ acao: 'por', navio: 1, casa: 100, deitado: true }), 'O navio não cabe aí.');
  assert.equal(montar({ acao: 'por', navio: 1, casa: 5, deitado: true }), 'Os navios não podem encostar um no outro.');
  assert.equal(montar({ acao: 'por', navio: 1, casa: 55, deitado: true }), 'Os navios não podem encostar um no outro.', 'na diagonal de J5');
  assert.equal(montar({ acao: 'por', navio: 1, casa: 16, deitado: true }), 'Os navios não podem encostar um no outro.', 'em cima');
  assert.equal(montar({ acao: 'por', navio: 5, casa: 0, deitado: true }), 'Escolha um navio.');
  assert.equal(montar({ acao: 'por', navio: 'x', casa: 0, deitado: true }), 'Escolha um navio.');
  assert.equal(montar({ acao: 'qualquer' }), 'Ação desconhecida.');
  // pronto sem todos os navios não vale
  assert.equal(montar({ acao: 'pronto' }), 'Ponha todos os navios antes.');
  // o próprio navio não encosta nele mesmo: mudar uma casa para o lado vale
  assert.equal(montar({ acao: 'por', navio: 0, casa: 8, deitado: false }), null);
  // tirar
  assert.equal(montar({ acao: 'tirar', navio: 0 }), null);
  assert.equal(p.vista(ANA).montagem.navios![0], null);
  // a frota inteira, à mão
  FROTA_DE_MAO.forEach((x, i) => assert.equal(montar({ acao: 'por', navio: i, ...x }), null));
  conferirFrota(p.vista(ANA).montagem.navios as number[][]);
  assert.equal(montar({ acao: 'pronto' }), null);
  v = p.vista(ANA);
  assert.deepEqual(v.montagem.prontos, [true, false]);
  assert.equal(v.fase, 'montando', 'falta a Bia');
  // pronto não mexe mais; os tiros esperam os dois
  assert.equal(montar({ acao: 'por', navio: 0, casa: 9, deitado: false }), 'Sua frota já está pronta.');
  assert.equal(p.jogo.acao(ANA, { tipo: 'jogada', casa: 0 }), 'A partida não está em andamento.');
  assert.equal(p.jogo.acao(CAIO, { tipo: 'montar', acao: 'sortear' }), 'Você está assistindo esta partida.');
});

test('na montagem, ninguém vê a frota do outro, nem quem assiste', () => {
  const p = comecar(33);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  FROTA_DE_MAO.forEach((x, i) => assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'por', navio: i, ...x }), null));
  assert.equal(p.jogo.acao(BIA, { tipo: 'montar', acao: 'sortear' }), null);
  assert.equal(p.jogo.acao(BIA, { tipo: 'montar', acao: 'pronto' }), null);
  const daAna = p.vista(ANA);
  const daBia = p.vista(BIA);
  const doCaio = p.vista(CAIO);
  assert.equal(daAna.mares[0].navios.length, FROTA.length);
  assert.deepEqual(daAna.mares[1].navios, [], 'a Ana não vê a frota da Bia');
  assert.deepEqual(daBia.mares[0].navios, [], 'a Bia não vê a frota da Ana');
  assert.equal(daBia.mares[1].navios.length, FROTA.length);
  assert.deepEqual(doCaio.mares[0].navios, []);
  assert.deepEqual(doCaio.mares[1].navios, []);
  assert.equal(doCaio.montagem.navios, null, 'quem assiste não recebe frota nenhuma');
  // a montagem de cada um traz só a própria frota
  assert.deepEqual(daAna.montagem.navios, FROTA_DE_MAO.map((x, i) => casasDoNavio(x.casa, FROTA[i], x.deitado)));
  assert.deepEqual(daBia.montagem.navios, daBia.mares[1].navios.map((n) => n.casas));
  // e quem ainda não está pronto não fica sabendo de nada além do "pronto" do outro
  assert.deepEqual(daAna.montagem.prontos, [false, true]);
});

test('os dois prontos: os tiros começam, com a frota que cada um pôs', () => {
  const p = comecar(35);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  FROTA_DE_MAO.forEach((x, i) => assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'por', navio: i, ...x }), null));
  assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'pronto' }), null);
  assert.equal(p.jogo.acao(BIA, { tipo: 'montar', acao: 'sortear' }), null);
  assert.equal(p.jogo.acao(BIA, { tipo: 'montar', acao: 'pronto' }), null);
  const v = p.vista(ANA);
  assert.equal(v.fase, 'jogando');
  assert.equal(p.relogio[0].ms, JOGADA_MS, 'o prazo da jogada');
  const minha = FROTA_DE_MAO.map((x, i) => casasDoNavio(x.casa, FROTA[i], x.deitado));
  assert.deepEqual(v.mares[0].navios.map((n) => n.casas), minha);
  assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'sortear' }), 'A partida não está em andamento.');
  // o tiro cai no navio que a Ana pôs: C1 é do de 5
  if (v.vez === 1) {
    assert.equal(p.jogo.acao(BIA, { tipo: 'jogada', casa: 2 }), null);
    assert.equal(p.vista(BIA).mares[0].tiros[2], 2);
  }
});

test('acabou o tempo da montagem: o servidor sorteia o que falta, mantendo o que já foi posto, e começa', () => {
  const p = comecar(37);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  // a Ana pôs dois; a Bia, nenhum
  assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'por', navio: 0, casa: 0, deitado: true }), null);
  assert.equal(p.jogo.acao(ANA, { tipo: 'montar', acao: 'por', navio: 4, casa: 98, deitado: true }), null);
  assert.equal(p.relogio[0].ms, MONTAGEM_MS);
  p.relogio[0].depois();
  const v = p.vista(ANA);
  assert.equal(v.fase, 'jogando');
  assert.deepEqual(v.montagem.prontos, [true, true]);
  const minha = v.mares[0].navios.map((n) => n.casas);
  conferirFrota(minha);
  assert.deepEqual(minha[0], [0, 1, 2, 3, 4]);
  assert.deepEqual(minha[4], [98, 99]);
  conferirFrota(p.vista(BIA).mares[1].navios.map((n) => n.casas));
  assert.equal(p.relogio[0].ms, JOGADA_MS, 'e o prazo da primeira jogada já corre');
});

test('a frota completada em volta dos navios postos é sempre válida', () => {
  for (let s = 1; s <= 300; s++) {
    const r = semente(s);
    const fixos: (number[] | null)[] = FROTA.map(() => null);
    // um ou dois navios postos em lugares sorteados (válidos)
    for (const i of [Math.floor(r() * 5), Math.floor(r() * 5)]) {
      const casas = casasDoNavio(Math.floor(r() * CASAS_DO_MAR), FROTA[i], r() < 0.5);
      if (casas && !encosta(casas, fixos.filter((_, k) => k !== i))) fixos[i] = casas;
    }
    const frota = sortearFrota(r, fixos);
    conferirFrota(frota);
    fixos.forEach((x, i) => x && assert.deepEqual(frota[i], x));
  }
});

test('quem desiste na montagem perde', () => {
  const p = comecar(39);
  assert.equal(p.jogo.acao(BIA, { tipo: 'sentar' }), null);
  assert.equal(p.jogo.acao(BIA, { tipo: 'desistir' }), null);
  const v = p.vista(CAIO);
  assert.equal(v.fase, 'fim');
  assert.equal(v.motivo, 'desistiu');
  assert.equal(v.vencedor, 0);
});

test('no Solo, o computador fica pronto na hora, com a frota sorteada, e espera a pessoa', () => {
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => [ANA],
    nome: () => 'ana',
    solo: true,
  };
  const jogo = criarNaval(semente(41)).comecar(ctx, { naSala: [ANA], criadaPor: ANA, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  let v = jogo.publico(ANA) as unknown as Vista;
  assert.equal(v.fase, 'montando');
  assert.deepEqual(v.montagem.prontos, [false, true]);
  assert.deepEqual(v.mares[1].navios, [], 'a frota do robô não aparece');
  assert.equal(relogio[0].ms, JOGADA_SOLO_MS, 'no Solo, pensar sozinho não tem o prazo da sala');
  assert.equal(jogo.acao(ANA, { tipo: 'montar', acao: 'sortear' }), null);
  assert.equal(jogo.acao(ANA, { tipo: 'montar', acao: 'pronto' }), null);
  v = jogo.publico(ANA) as unknown as Vista;
  assert.equal(v.fase, 'jogando');
});
