/**
 * O Minigolfe da toca (minijogo-golfe.ts): cada tacada vai ao servidor na hora, e ele a simula com a mesma física do site
 * (golfe-fisica.ts). O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const golfeMod = await import('../src/minijogo-golfe.js');
const fisica = await import('../src/golfe-fisica.js');
const { criarGolfe, PREPARO_MS, PLACAR_ENTRE_MS, BURACO_MS, DEPOIS_DE_PARAR_MS } = golfeMod;
const { BURACOS, TACADAS_MAX, novaBola, bater, rolarAteParar, melhorTacada, mapaDeDistancia } = fisica;
type Bola = ReturnType<typeof novaBola>;
after(fechar);

let agora = 9_000_000;
const passoDeAgora = (inicio: number) => Math.floor(((agora - inicio) * 60) / 1000);

const ana = await criarConta(app, 'ana-golfe');
const bia = await criarConta(app, 'bia-golfe');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do golfe' })).json() as { id: number };

function comecar(naSala: number[] | (() => number[]), comunidadeId = 0) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const sala = typeof naSala === 'function' ? naSala : () => naSala;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: sala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: comunidadeId,
  };
  const jogo = criarGolfe({ agora: () => agora }).comecar(ctx, { naSala: sala(), criadaPor: sala()[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  let inicio = 0;
  return {
    jogo,
    relogio,
    terminou: () => terminou,
    /** Dispara o relógio marcado, andando o tempo junto. */
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
      if (jogo.publico(sala()[0]).fase === 'jogando' && jogo.publico(sala()[0]).decorridoMs === 0) inicio = agora;
    },
    inicio: () => inicio,
  };
}

const meu = (jogo: { publico(q: number): Record<string, unknown> }, id: number) => jogo.publico(id).meu as Bola;

/** Joga o buraco até o fim com o piloto, tacada por tacada, no relógio certo. Devolve as tacadas. */
function jogarBuraco(m: ReturnType<typeof comecar>, id: number) {
  const b = BURACOS[m.jogo.publico(id).buraco as number];
  const d = mapaDeDistancia(b);
  while (!meu(m.jogo, id).dentro && meu(m.jogo, id).tacadas < TACADAS_MAX) {
    const bola = meu(m.jogo, id);
    // espera a bola parar no relógio do servidor
    const parada = m.inicio() + (bola.passo * 1000) / 60;
    if (agora < parada) agora = Math.ceil(parada) + 20;
    agora += 200;
    const t = melhorTacada(b, bola, Math.max(bola.passo, passoDeAgora(m.inicio())), d);
    assert.equal(m.jogo.acao(id, { tipo: 'tacada', ...t }), null);
    if (m.jogo.publico(id).fase !== 'jogando') break;
  }
}

test('a tacada é simulada no servidor: o resultado é o da física, e não o que o site diz', () => {
  const m = comecar([anaId, biaId]);
  assert.equal(m.jogo.publico(anaId).fase, 'preparando');
  assert.equal(m.relogio[0].ms, PREPARO_MS);
  assert.ok(m.jogo.acao(anaId, { tipo: 'tacada', passo: 0, dx: 1000, dy: 0 }), 'no "prepare-se" não vale');
  m.andar();
  assert.equal(m.jogo.publico(anaId).fase, 'jogando');
  assert.equal(m.relogio[0].ms, BURACO_MS);
  agora += 500;
  const t = { passo: passoDeAgora(m.inicio()), dx: 900, dy: 50 };
  // o site não decide: campos a mais ("dentro", "x") são ignorados
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', ...t, dentro: true, x: 160, y: 64 }), null);
  const esperado = novaBola(BURACOS[0]);
  bater(esperado, t);
  rolarAteParar(BURACOS[0], esperado);
  const daAna = meu(m.jogo, anaId);
  assert.deepEqual([daAna.x, daAna.y, daAna.tacadas, daAna.dentro, daAna.passo], [esperado.x, esperado.y, 1, esperado.dentro, esperado.passo]);
  assert.equal(daAna.andando, false, 'o servidor simula a tacada inteira ao recebê-la');
});

test('a tacada não vale com a bola andando, no futuro, muito no passado, forte demais ou fraca demais', () => {
  const m = comecar([anaId, biaId]);
  m.andar();
  agora += 1000;
  const p = passoDeAgora(m.inicio());
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p + 60, dx: 500, dy: 0 }), 'Tacada inválida.', '1 s no futuro');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 1001, dy: 0 }), 'Tacada inválida.', 'força demais');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 10, dy: 0 }), 'Tacada inválida.', 'força de menos');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 500.5, dy: 0 }), 'Tacada inválida.', 'só inteiros');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: 'x', dx: 500, dy: 0 }), 'Tacada inválida.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 300, dy: 0 }), null);
  const parou = meu(m.jogo, anaId).passo;
  assert.ok(parou > p + 10, 'a bola rola uns passos');
  // a tacada seguinte, antes de a bola parar (no passo dela ou no relógio do servidor)
  agora += 300;
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p + 5, dx: 300, dy: 0 }), 'Tacada inválida.', 'antes do passo em que parou');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: parou, dx: 300, dy: 0 }), 'Tacada inválida.', 'o servidor ainda não viu a bola parar');
  agora = m.inicio() + (parou * 1000) / 60 + 4000;
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: parou, dx: 300, dy: 0 }), 'Tacada inválida.', '4 s no passado: escolheria a tábua depois');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: passoDeAgora(m.inicio()), dx: 300, dy: 0 }), null);
  assert.equal(meu(m.jogo, anaId).tacadas, 2);
  // quem não joga
  assert.equal(m.jogo.acao(999, { tipo: 'tacada', passo: passoDeAgora(m.inicio()), dx: 300, dy: 0 }), 'Você está assistindo esta partida.');
});

test('a água devolve a bola para onde estava, com uma tacada a mais', () => {
  const b = BURACOS[3];
  assert.equal(b.tema, 'lago');
  const bola = novaBola(b);
  // reto para a direita, direto no lago
  bater(bola, { passo: 0, dx: 1000, dy: 0 });
  rolarAteParar(b, bola);
  assert.deepEqual([bola.x, bola.y, bola.tacadas, bola.dentro], [b.inicio[0], b.inicio[1], 2, false]);
});

test('o buraco fecha quando todo mundo terminou, só depois de a última bola parar, e quem não acertou fica com 7', () => {
  const m = comecar([anaId, biaId]);
  m.andar();
  jogarBuraco(m, anaId);
  assert.equal(meu(m.jogo, anaId).dentro, true);
  assert.equal(m.jogo.publico(anaId).fase, 'jogando', 'a Bia ainda joga');
  // a Bia dá seis tacadas fracas e não acerta
  for (let i = 0; i < TACADAS_MAX; i++) {
    const bola = meu(m.jogo, biaId);
    agora = Math.max(agora, m.inicio() + (bola.passo * 1000) / 60) + 300;
    assert.equal(m.jogo.acao(biaId, { tipo: 'tacada', passo: passoDeAgora(m.inicio()), dx: 0, dy: 40 }), null);
  }
  assert.equal(m.jogo.acao(biaId, { tipo: 'tacada', passo: passoDeAgora(m.inicio()) + 30, dx: 0, dy: 40 }), 'Esta rodada já acabou.');
  assert.equal(m.jogo.publico(anaId).fase, 'jogando', 'a última bola ainda rola na tela de quem bateu');
  assert.ok(m.relogio[0].ms <= 2000 && m.relogio[0].ms >= DEPOIS_DE_PARAR_MS - 400, `fecha em ${m.relogio[0].ms} ms`);
  m.andar();
  assert.equal(m.jogo.publico(anaId).fase, 'placar');
  const placar = m.jogo.publico(anaId).placar as { userId: number; pontos: number; buraco: number }[];
  assert.equal(placar[0].userId, anaId, 'menos tacadas na frente');
  assert.equal(placar[1].buraco, TACADAS_MAX + 1);
  assert.equal(m.relogio[0].ms, PLACAR_ENTRE_MS);
});

test('o tempo do buraco acaba: quem não terminou fica com 7', () => {
  const m = comecar([anaId, biaId]);
  m.andar();
  m.andar(); // o tempo acabou, ninguém bateu
  assert.equal(m.jogo.publico(anaId).fase, 'placar');
  const placar = m.jogo.publico(anaId).placar as { pontos: number }[];
  assert.deepEqual(placar.map((l) => l.pontos), [7, 7]);
});

test('a partida inteira: seis buracos, menos tacadas ganha, e o troféu do pódio só para quem acertou', async () => {
  const m = comecar([anaId, biaId], comunidade.id);
  for (let i = 0; i < BURACOS.length; i++) {
    assert.equal(m.jogo.publico(anaId).rodada, i + 1);
    m.andar(); // começa
    jogarBuraco(m, anaId);
    // a Bia não joga: o tempo fecha
    while (m.jogo.publico(anaId).fase === 'jogando') m.andar();
    if (i < BURACOS.length - 1) {
      assert.equal(m.jogo.publico(anaId).fase, 'placar');
      m.andar();
    }
  }
  assert.equal(m.terminou(), true);
  assert.equal(m.jogo.publico(anaId).fase, 'fim');
  const placar = m.jogo.publico(anaId).placar as { userId: number; pontos: number }[];
  assert.equal(placar[0].userId, anaId);
  assert.equal(placar[1].pontos, 42, 'seis buracos de 7');
  assert.ok(placar[0].pontos < 42);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].pontos, daAna[0].tempoMs], ['golfe', 1, placar[0].pontos, null]);
  const daBia = (await comToken(app, bia.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daBia.filter((t: { pista: string }) => t.pista === 'golfe').length, 0, 'sem acertar nenhum buraco, sem troféu');
});

test('quem fica sozinho na sala não ganha o pódio "com a turma"', async () => {
  let naSala = [anaId, biaId];
  const m = comecar(() => naSala, comunidade.id);
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  for (let i = 0; i < BURACOS.length; i++) {
    m.andar();
    if (i === 1) naSala = [anaId]; // a Bia sai no segundo buraco
    jogarBuraco(m, anaId);
    while (m.jogo.publico(anaId).fase === 'jogando') m.andar();
    if (i < BURACOS.length - 1) m.andar();
  }
  assert.equal(m.jogo.publico(anaId).fase, 'fim');
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes, 'sem troféu');
});

test('o pontinho dos outros: só números dentro da mesa, carimbados, e não mais que 20 por segundo', () => {
  const m = comecar([anaId, biaId]);
  const tempoReal = m.jogo.tempoReal!;
  assert.equal(tempoReal(anaId, { x: 10, y: 10 }), null, 'no "prepare-se" não');
  m.andar();
  assert.deepEqual(tempoReal(anaId, { x: 40.123, y: 60, userId: biaId }), { userId: anaId, buraco: 0, x: 40.1, y: 60 });
  assert.equal(tempoReal(anaId, { x: 41, y: 60 }), null, 'logo em seguida');
  agora += 60;
  assert.equal(tempoReal(anaId, { x: 5000, y: 60 }), null, 'fora da mesa');
  assert.equal(tempoReal(anaId, { x: 'a', y: 60 }), null);
  assert.equal(tempoReal(999, { x: 10, y: 10 }), null, 'quem não joga');
});

test('sozinho: o golfe começa pela rota do Solo, com mais tempo, e sem pódio', async () => {
  const comAna = comToken(app, ana.token);
  const r = await comAna('POST', '/api/minijogo-solo', { jogo: 'golfe' });
  assert.equal(r.statusCode, 200, r.body);
  const p = r.json().partida;
  assert.equal(p.jogo, 'golfe');
  assert.equal(p.fase, 'preparando');
  assert.equal(p.rodadas, 6);
  assert.equal(p.duracaoMs, golfeMod.BURACO_SOLO_MS);
  await comAna('DELETE', '/api/minijogo-solo');
});
