/**
 * A Caça às pragas da horta (minijogo-caca.ts): cada tiro vai ao servidor com o lugar e o instante, e ele refaz a conta do voo
 * (caca-voo.ts) para saber se a praga estava lá. O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarCaca, PREPARO_MS, PLACAR_ENTRE_MS, ATRASO_MAX_MS } = await import('../src/minijogo-caca.js');
const voo = await import('../src/caca-voo.js');
const db = await import('../src/db.js');
after(fechar);

let agora = 5_000_000;
const ana = await criarConta(app, 'ana-caca');
const bia = await criarConta(app, 'bia-caca');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

type Praga = import('../src/caca-voo.js').Praga;
interface Estado {
  fase: string;
  onda: number;
  pragas: Praga[];
  meu: { pontos: number; municao: number; abatidas: number[]; daOnda: number };
  placar: { userId: number; pontos: number; posicao: number | null }[];
  recorde: { antes: number | null; novo: boolean } | null;
}

function comecar(naSala: number[], comunidade = 0) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
  };
  // o sorteio fixo: as mesmas pragas toda vez
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  const jogo = criarCaca({ agora: () => agora, aleatorio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  let inicio = 0;
  return {
    jogo,
    estado: (id: number) => jogo.publico(id) as unknown as Estado,
    terminou: () => terminou,
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
      if (jogo.publico(naSala[0]).fase === 'jogando') inicio = agora;
    },
    /** O tempo da onda agora (ms desde o começo dela). */
    naOnda: () => agora - inicio,
    /** Leva o relógio a `ms` da onda. */
    irPara(ms: number) {
      agora = inicio + ms;
    },
  };
}

/** Um tiro certeiro na praga `i`, no meio da vida dela. */
function mirar(p: Praga) {
  const ms = p.t + p.vida / 2;
  const pos = voo.posicao(p, ms)!;
  return { ms, x: pos.x, y: pos.y };
}

test('as duas cópias do voo são iguais (o site desenha com a mesma conta que o servidor confere)', async () => {
  const { readFileSync } = await import('node:fs');
  const servidor = readFileSync(new URL('../src/caca-voo.ts', import.meta.url));
  const site = readFileSync(new URL('../../web/src/caca/voo.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/caca-voo.ts e web/src/caca/voo.ts mudaram separados: copie uma sobre a outra');
});

test('o tiro certeiro acerta, o errado gasta a munição, e a mesma praga não conta duas vezes', () => {
  const p = comecar([anaId, biaId]);
  assert.equal(p.estado(anaId).fase, 'preparando');
  p.andar();
  const e = p.estado(anaId);
  assert.equal(e.fase, 'jogando');
  assert.equal(e.meu.municao, voo.municaoDaOnda(1));
  const alvo = e.pragas[0];
  const tiro = mirar(alvo);
  p.irPara(tiro.ms + 100);
  assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', ...tiro }), null);
  const depois = p.estado(anaId);
  assert.deepEqual(depois.meu.abatidas, [0]);
  assert.equal(depois.meu.pontos, voo.pontosDoAcerto(alvo, tiro.ms));
  // a Bia não perdeu nada: cada um abate a sua cópia
  assert.deepEqual(p.estado(biaId).meu.abatidas, []);

  // o mesmo lugar de novo: a praga já caiu, e o tiro só gasta munição
  p.irPara(tiro.ms + 300);
  assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', ...tiro, ms: tiro.ms + 200 }), null);
  assert.equal(p.estado(anaId).meu.abatidas.length, 1);
  assert.equal(p.estado(anaId).meu.municao, voo.municaoDaOnda(1) - 2);

  // no céu vazio: errou
  p.irPara(tiro.ms + 600);
  p.jogo.acao(anaId, { tipo: 'tiro', x: 160, y: 175, ms: tiro.ms + 500 });
  assert.equal(p.estado(anaId).meu.abatidas.length, 1);
});

test('o servidor confere o relógio e a munição', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const alvo = p.estado(anaId).pragas[0];
  const tiro = mirar(alvo);
  // dizer um instante no futuro (mirar onde a praga VAI estar) não vale
  p.irPara(tiro.ms - 1000);
  assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', ...tiro }), 'Tiro inválido.');
  // nem um instante muito antigo (mirar onde ela JÁ esteve, com calma)
  p.irPara(tiro.ms + ATRASO_MAX_MS + 200);
  assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', ...tiro }), 'Tiro inválido.');
  // números estranhos
  assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', x: 'a', y: 1, ms: 1 }), 'Tiro inválido.');
  // a munição acaba
  for (let k = 0; k < voo.municaoDaOnda(1); k++) {
    p.irPara(p.naOnda() + 200);
    p.jogo.acao(anaId, { tipo: 'tiro', x: 160, y: 178, ms: p.naOnda() });
  }
  p.irPara(p.naOnda() + 200);
  assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', x: 160, y: 178, ms: p.naOnda() }), 'Acabou a munição desta onda.');
  // quem não joga só assiste
  assert.equal(p.jogo.acao(999, { tipo: 'tiro', x: 1, y: 1, ms: 1 }), 'Você está assistindo esta partida.');
});

test('as cinco ondas, cada uma mais cheia, e o pódio vai para a estante com a turma', () => {
  const p = comecar([anaId, biaId], 1);
  let pragasVistas = 0;
  for (let n = 1; n <= voo.ONDAS; n++) {
    p.andar(); // preparando → jogando
    const e = p.estado(anaId);
    assert.equal(e.onda, n);
    assert.equal(e.pragas.length, voo.pragasDaOnda(n));
    pragasVistas += e.pragas.length;
    // a Ana acerta a primeira praga de cada onda; a Bia não atira
    const tiro = mirar(e.pragas[0]);
    p.irPara(tiro.ms + 50);
    assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', ...tiro }), null);
    p.andar(); // a onda fecha (as pragas fugiram)
    if (n < voo.ONDAS) {
      assert.equal(p.estado(anaId).fase, 'placar');
      p.andar(); // o placar → a próxima onda
    }
  }
  assert.ok(p.terminou());
  const fim = p.estado(anaId);
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.placar[0].userId, anaId);
  assert.equal(fim.placar[0].posicao, 1);
  assert.ok(pragasVistas > voo.pragasDaOnda(1) * voo.ONDAS, 'as ondas crescem');
  // o troféu: só a Ana, que fez pontos (a Bia, com zero, não sobe ao pódio)
  assert.ok(db.trofeusDe(anaId).some((t) => t.pista === 'caca' && t.posicao === 1), 'a Ana ganhou o troféu');
  assert.ok(!db.trofeusDe(biaId).some((t) => t.pista === 'caca'), 'a Bia, sem pontos, não');
});

test('a onda fecha cedo quando todos acabaram a munição', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  for (const id of [anaId, biaId]) {
    for (let k = 0; k < voo.municaoDaOnda(1); k++) {
      p.irPara(p.naOnda() + 150);
      p.jogo.acao(id, { tipo: 'tiro', x: 160, y: 178, ms: p.naOnda() });
    }
  }
  assert.equal(p.estado(anaId).fase, 'placar');
});

test('no Solo, sem troféu, e a partida pode virar o recorde da pessoa', () => {
  for (let partida = 0; partida < 2; partida++) {
    const p = comecar([biaId]);
    for (let n = 1; n <= voo.ONDAS; n++) {
      p.andar();
      const e = p.estado(biaId);
      // na primeira partida, uma praga por onda; na segunda, nenhuma (pior: não substitui o recorde)
      if (partida === 0) {
        const tiro = mirar(e.pragas[0]);
        p.irPara(tiro.ms + 50);
        p.jogo.acao(biaId, { tipo: 'tiro', ...tiro });
      }
      p.andar();
      if (n < voo.ONDAS) p.andar();
    }
    const fim = p.estado(biaId);
    if (partida === 0) {
      assert.equal(fim.recorde?.antes, null);
      assert.equal(fim.recorde?.novo, true);
    } else {
      assert.equal(fim.recorde?.novo, false);
      assert.ok((fim.recorde?.antes ?? 0) > 0);
    }
  }
  assert.ok((db.recordeDaCaca(biaId) ?? 0) > 0);
});

void PREPARO_MS;
void PLACAR_ENTRE_MS;

// ---------------- As melhorias de 19/11/2026 ----------------

test('o combo: acertos seguidos multiplicam, e um tiro errado zera', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const e = p.estado(anaId);
  // todas as pragas da onda, em ordem de quando aparecem, cada uma no meio da vida
  const ordem = e.pragas.map((pr, i) => ({ i, ...mirar(pr) })).sort((a, b) => a.ms - b.ms);
  let esperado = 0;
  let combo = 0;
  for (const [k, tiro] of ordem.entries()) {
    if (k === 2) {
      // um erro no meio: o combo zera
      p.irPara(Math.max(p.naOnda(), tiro.ms - 400) + 130);
      assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', x: 160, y: 178, ms: p.naOnda() }), null);
      combo = 0;
    }
    p.irPara(Math.max(tiro.ms, p.naOnda() + 130));
    const antes = p.estado(anaId).meu.pontos;
    assert.equal(p.jogo.acao(anaId, { tipo: 'tiro', x: tiro.x, y: tiro.y, ms: tiro.ms }), null);
    const depois = p.estado(anaId).meu as { pontos: number; combo: number };
    if (depois.pontos === antes) continue; // outra praga na frente (raro): não conta
    combo++;
    esperado += voo.pontosDoAcerto(e.pragas[tiro.i], tiro.ms) * voo.multiplicador(combo);
    assert.equal(depois.combo, combo);
  }
  assert.equal(voo.multiplicador(1), 1);
  assert.equal(voo.multiplicador(4), 2);
  assert.equal(voo.multiplicador(8), 3);
  assert.ok(p.estado(anaId).meu.pontos >= esperado);
});

test('a onda perfeita dá o bônus a quem abateu todas', () => {
  const p = comecar([anaId, biaId]);
  p.andar();
  const e = p.estado(anaId);
  const ordem = e.pragas.map((pr, i) => ({ i, ...mirar(pr) })).sort((a, b) => a.ms - b.ms);
  for (const tiro of ordem) {
    p.irPara(Math.max(tiro.ms, p.naOnda() + 130));
    // se outra está na frente, mira de novo nesta, um pouco depois
    p.jogo.acao(anaId, { tipo: 'tiro', x: tiro.x, y: tiro.y, ms: tiro.ms });
  }
  const meu = p.estado(anaId).meu;
  assert.equal(meu.abatidas.length, e.pragas.length, 'todas abatidas');
  const antes = meu.pontos;
  p.andar(); // a onda fecha
  const depois = p.estado(anaId).meu as { pontos: number; perfeita: boolean };
  assert.equal(depois.perfeita, true);
  assert.equal(depois.pontos, antes + voo.BONUS_PERFEITA);
  assert.equal((p.estado(biaId).meu as { perfeita: boolean }).perfeita, false);
});

test('a dourada é rara, mais rápida e vale o triplo; a onda de pares vem de dois em dois, de lados opostos', () => {
  let semente = 3;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
  let douradas = 0;
  for (let k = 0; k < 40; k++) {
    for (let n = 1; n <= voo.ONDAS; n++) {
      const ps = voo.sortearOnda(n, aleatorio);
      const d = ps.filter((pr) => pr.dourada);
      assert.ok(d.length <= 1);
      if (n === 1) assert.equal(d.length, 0, 'a primeira onda não tem dourada');
      douradas += d.length;
      for (const pr of d) {
        assert.equal(voo.pontosDoAcerto(pr, pr.t + pr.vida), voo.PONTOS[pr.tipo] * voo.DOURADA_VEZES);
        assert.ok(pr.vida < (pr.tipo === 'gafanhoto' ? 2600 : 3400));
      }
      if (n === voo.ONDA_DE_PARES) {
        for (let i = 0; i + 1 < ps.length; i += 2) {
          assert.equal(ps[i].t, ps[i + 1].t, 'o par sai junto');
          assert.notEqual(Math.sign(ps[i].vx), Math.sign(ps[i + 1].vx), 'de lados opostos');
        }
      }
    }
  }
  assert.ok(douradas > 40 && douradas < 160, `douradas ${douradas}`);
});
