/**
 * O Pinball da horta (minijogo-pinball.ts, pinball-sim.ts): o servidor REFAZ a partida pelos comandos de cada passo, mandados em
 * trechos; o Solo (o recorde, que os amigos aceitos veem) e a sala (o verde, a ordem pelos pontos refeitos, o pódio). E o que
 * não passa: trechos inválidos, passos à frente do relógio, pontos que o site inventa.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarPinball, LARGADA_MS, PASSOS_DA_SALA, PASSOS_A_FRENTE } = await import('../src/minijogo-pinball.js');
const sim = await import('../src/pinball-sim.js');
const db = await import('../src/db.js');
let agora = 1_000_000;
const pinball = criarPinball({ agora: () => agora });
after(fechar);

const ana = await criarConta(app, 'ana-pinball');
const bia = await criarConta(app, 'bia-pinball');
const caio = await criarConta(app, 'caio-pinball');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do pinball' })).json() as { id: number };

/** Uma partida honesta: o piloto automático, passo a passo, com a força da mola variando pela semente. */
function partida(semente: number, limite = sim.PASSOS_MAXIMOS) {
  const k = sim.novaMesa(limite);
  const comandos: number[] = [];
  while (!k.terminou) {
    let c = sim.pilotoAutomatico(k);
    if (k.bolas.some((b) => b.naMola && !b.auto)) c = k.carga < 28 + ((semente * 13 + k.bola * 7) % 23) ? sim.MOLA : 0;
    comandos.push(c);
    sim.passo(k, c);
  }
  return { comandos, pontos: k.pontos, passos: k.passo };
}

function contexto(naSala: number[], { comunidadeId = 0, solo = false } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    ctx: {
      agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala: () => naSala,
      nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
      comunidade: comunidadeId,
      solo,
    },
  };
}

/** Manda a partida em trechos de 1 s, com o relógio andando junto (a rede chegando no tempo dela). */
function mandar(jogo: { acao: (q: number, c: Record<string, unknown>) => string | null }, quem: number, comandos: number[], de = 0) {
  for (let i = de; i < comandos.length; i += 60) {
    agora += 1000;
    const erro = jogo.acao(quem, { tipo: 'trecho', de: i, entradas: sim.compactar(comandos, i, Math.min(comandos.length, i + 60)) });
    assert.equal(erro, null);
  }
}

test('a regra: o piloto automático joga as três bolas, pontua, e a mesma partida refeita dá os mesmos pontos', () => {
  const p = partida(1);
  assert.ok(p.pontos > 0, 'pontuou');
  const k = sim.novaMesa();
  sim.aplicar(k, sim.compactar(p.comandos), 0);
  assert.ok(k.terminou);
  assert.equal(k.pontos, p.pontos);
  assert.equal(k.passo, p.passos);
});

test('o tranco: sacudir demais trava a mesa (as palhetas não sobem), e a bola travada não marca bônus', () => {
  const k = sim.novaMesa();
  // lança a bola
  for (let i = 0; i < 40; i++) sim.passo(k, sim.MOLA);
  sim.passo(k, 0);
  let tilt = false;
  for (let i = 0; i < 12 && !tilt; i++) {
    sim.passo(k, sim.SACUDIR);
    tilt ||= k.eventos.some((e) => e.tipo === 'tilt');
    sim.passo(k, 0);
  }
  assert.ok(tilt && k.tilt, 'a mesa travou');
  for (let i = 0; i < 30; i++) sim.passo(k, sim.ESQ | sim.DIR);
  assert.equal(k.esq, 0);
  assert.equal(k.dir, 0);
  let bonus = -1;
  while (bonus < 0 && !k.terminou) {
    sim.passo(k, 0);
    for (const e of k.eventos) if (e.tipo === 'perdeu') bonus = e.bonus;
  }
  assert.equal(bonus, 0);
  assert.equal(k.tilt, false, 'a bola seguinte começa destravada');
});

test('o Solo: a partida em trechos vira recorde com os pontos DO SERVIDOR; repetir trechos não conta dobrado', () => {
  const { ctx } = contexto([anaId], { solo: true });
  const jogo = pinball.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.equal(jogo.acao(anaId, { tipo: 'jogar' }), null);
  const p = partida(2);
  // o começo, mandado duas vezes (a resposta se perdeu): o servidor pula o que já leu
  mandar(jogo, anaId, p.comandos.slice(0, 600));
  assert.equal(jogo.acao(anaId, { tipo: 'trecho', de: 300, entradas: sim.compactar(p.comandos, 300, 660) }), null);
  assert.equal((jogo.publico(anaId).meu as { passo: number }).passo, 660);
  mandar(jogo, anaId, p.comandos, 660);
  const e = jogo.publico(anaId) as { fase: string; resultado: { pontos: number; recorde: boolean }; recordes: { userId: number; pontos: number }[] };
  assert.equal(e.fase, 'resultado');
  assert.equal(e.resultado.pontos, p.pontos);
  assert.ok(e.resultado.recorde);
  assert.equal(db.recordeDoPinball(anaId), p.pontos);
  assert.ok(e.recordes.some((r) => r.userId === anaId && r.pontos === p.pontos));
});

test('o que não passa: trecho inválido, passos à frente do relógio, um trecho que pula passos', () => {
  const { ctx } = contexto([biaId], { solo: true });
  const jogo = pinball.comecar(ctx, { naSala: [biaId], criadaPor: biaId, corpo: {} });
  jogo.acao(biaId, { tipo: 'jogar' });
  assert.equal(jogo.acao(biaId, { tipo: 'trecho', de: 0, entradas: [0, 1] }), 'Partida inválida.');
  assert.equal(jogo.acao(biaId, { tipo: 'trecho', de: 0, entradas: [10, 99] }), 'Partida inválida.');
  assert.equal(jogo.acao(biaId, { tipo: 'trecho', de: 0, entradas: [sim.PASSOS_POR_TRECHO + 1, 0] }), 'Partida inválida.');
  // à frente do relógio: com o relógio parado, só a folga anda
  assert.equal(jogo.acao(biaId, { tipo: 'trecho', de: 0, entradas: [1000, 0] }), null);
  assert.equal((jogo.publico(biaId).meu as { passo: number }).passo, PASSOS_A_FRENTE);
  // um trecho que começa depois do que o servidor tem: ignorado
  assert.equal(jogo.acao(biaId, { tipo: 'trecho', de: 500, entradas: [10, 0] }), null);
  assert.equal((jogo.publico(biaId).meu as { passo: number }).passo, PASSOS_A_FRENTE);
  // o que o site diz dos pontos não entra: só os comandos
  jogo.acao(biaId, { tipo: 'trecho', de: PASSOS_A_FRENTE, entradas: [10, 0], pontos: 99_999_999 });
  assert.ok((jogo.publico(biaId).meu as { pontos: number }).pontos < 1000);
  assert.equal(jogo.acao(caioId, { tipo: 'trecho', de: 0, entradas: [1, 0] }), 'Você está assistindo esta partida.');
});

test('os recordes: os amigos aceitos veem, quem não é amigo não', async () => {
  const anaApi = comToken(app, ana.token);
  const caioApi = comToken(app, caio.token);
  await anaApi('POST', '/api/amigos', { username: 'caio-pinball' });
  assert.equal((await caioApi('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  const deCaio = db.recordesDoPinball(caioId).map((r) => r.userId);
  const deBia = db.recordesDoPinball(biaId).map((r) => r.userId);
  assert.ok(deCaio.includes(anaId), 'o Caio é amigo: vê o recorde da Ana');
  assert.ok(!deBia.includes(anaId), 'a Bia não é amiga da Ana');
});

test('na sala: o verde, a ordem pelos pontos refeitos, o fim quando todos acabam, o pódio na estante', () => {
  const { ctx, relogio, terminou } = contexto([anaId, biaId, caioId], { comunidadeId: comunidade.id });
  const jogo = pinball.comecar(ctx, { naSala: [anaId, biaId, caioId], criadaPor: anaId, corpo: {} });
  assert.equal(jogo.publico(anaId).fase, 'largada');
  assert.equal(relogio[0].ms, LARGADA_MS);
  relogio[0].depois();
  assert.equal(jogo.publico(anaId).fase, 'jogando');
  const partidas = [partida(3, PASSOS_DA_SALA), partida(4, PASSOS_DA_SALA), partida(5, PASSOS_DA_SALA)];
  const inicio = agora;
  [anaId, biaId, caioId].forEach((id, i) => {
    agora = inicio;
    mandar(jogo, id, partidas[i].comandos);
  });
  assert.ok(terminou(), 'todos acabaram: a partida fechou');
  const placar = jogo.publico(anaId).placar as { userId: number; pontos: number; posicao: number }[];
  assert.deepEqual(
    placar.map((l) => l.pontos),
    partidas.map((p) => p.pontos).sort((a, b) => b - a),
  );
  assert.equal(placar[0].posicao, 1);
  const vencedor = placar[0].userId;
  const trofeus = db.trofeusParaLevar(vencedor) as { pista: string }[];
  assert.ok(trofeus.some((t) => t.pista === 'pinball'));
});
