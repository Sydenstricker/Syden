/**
 * O Minigolfe 3D (minijogo-golfe3d.ts): cada tacada vai ao servidor na hora, e ele a simula com a mesma física do site
 * (golfe3d-fisica.ts). O relógio aqui é de mão. (O jogo-irmão, o Minigolfe da toca, tem o teste dele.)
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const golfeMod = await import('../src/minijogo-golfe3d.js');
const fisica = await import('../src/golfe3d-fisica.js');
const { criarGolfe3D, PREPARO_MS, PLACAR_ENTRE_MS, BURACO_MS, DEPOIS_DE_PARAR_MS, ATRASO_MAX_MS } = golfeMod;
const { BURACOS, TACADAS_MAX, novaBola, bater, rolarAteParar, melhorTacada, mapaDeDistancia } = fisica;
type Bola = ReturnType<typeof novaBola>;
after(fechar);

let agora = 9_000_000;
const passoDeAgora = (inicio: number) => Math.floor(((agora - inicio) * 60) / 1000);

const ana = await criarConta(app, 'ana-golfe3d');
const bia = await criarConta(app, 'bia-golfe3d');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const cris = await criarConta(app, 'cris-golfe3d');
const crisId = await idDe(cris.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do golfe 3D' })).json() as { id: number };

function comecar(naSala: number[] | (() => number[]), comunidadeId = 0) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const sala = typeof naSala === 'function' ? naSala : () => naSala;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: sala,
    nome: (id: number) => (id === anaId ? 'ana' : id === crisId ? 'cris' : 'bia'),
    comunidade: comunidadeId,
  };
  const jogo = criarGolfe3D({ agora: () => agora }).comecar(ctx, { naSala: sala(), criadaPor: sala()[0], corpo: {} });
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
  assert.ok(m.jogo.acao(anaId, { tipo: 'tacada', passo: 0, dx: 1000, dz: 0 }), 'no "prepare-se" não vale');
  m.andar();
  assert.equal(m.jogo.publico(anaId).fase, 'jogando');
  assert.equal(m.relogio[0].ms, BURACO_MS);
  agora += 500;
  const t = { passo: passoDeAgora(m.inicio()), dx: 50, dz: 600 };
  // o site não decide: campos a mais ("dentro", "x") são ignorados
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', ...t, dentro: true, x: 0, z: 4 }), null);
  const esperado = novaBola(BURACOS[0]);
  bater(esperado, t);
  rolarAteParar(BURACOS[0], esperado);
  const daAna = meu(m.jogo, anaId);
  assert.deepEqual([daAna.x, daAna.z, daAna.tacadas, daAna.dentro, daAna.passo], [esperado.x, esperado.z, 1, esperado.dentro, esperado.passo]);
  assert.equal(daAna.andando, false, 'o servidor simula a tacada inteira ao recebê-la');
});

test('a tacada não vale com a bola andando, no futuro, muito no passado, forte demais ou fraca demais', () => {
  const m = comecar([anaId, biaId]);
  m.andar();
  agora += 1000;
  const p = passoDeAgora(m.inicio());
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p + 60, dx: 500, dz: 0 }), 'Tacada inválida.', '1 s no futuro');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 1001, dz: 0 }), 'Tacada inválida.', 'força demais');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 10, dz: 0 }), 'Tacada inválida.', 'força de menos');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 500.5, dz: 0 }), 'Tacada inválida.', 'só inteiros');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: 'x', dx: 500, dz: 0 }), 'Tacada inválida.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 0, dz: 300, dy: '9' }), 'Tacada inválida.', 'o alto, só número');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 0, dz: 300, dy: 900 }), 'Tacada inválida.', 'alto demais');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p, dx: 0, dz: 300 }), null);
  const parou = meu(m.jogo, anaId).passo;
  assert.ok(parou > p + 10, 'a bola rola uns passos');
  // a tacada seguinte, antes de a bola parar (no passo dela ou no relógio do servidor)
  agora += 300;
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p + 5, dx: 0, dz: 300 }), 'Tacada inválida.', 'antes do passo em que parou');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: parou, dx: 0, dz: 300 }), 'Tacada inválida.', 'o servidor ainda não viu a bola parar');
  agora = m.inicio() + (parou * 1000) / 60 + 4000;
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: parou, dx: 0, dz: 300 }), 'Tacada inválida.', '4 s no passado');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: passoDeAgora(m.inicio()), dx: 0, dz: 300 }), null);
  assert.equal(meu(m.jogo, anaId).tacadas, 2);
  // quem não joga
  assert.equal(m.jogo.acao(999, { tipo: 'tacada', passo: passoDeAgora(m.inicio()), dx: 0, dz: 300 }), 'Você está assistindo esta partida.');
});

test('a janela para trás do passo cobre a rede, e não mais que isso', () => {
  assert.ok(ATRASO_MAX_MS >= 500 && ATRASO_MAX_MS <= 1000, 'cobre a rede (~200 ms) com folga, e só');
  const m = comecar([anaId, biaId]);
  m.andar();
  agora += 3000;
  const p = passoDeAgora(m.inicio());
  // 0,7 s atrás ainda vale (a rede); 0,9 s atrás, não
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p - 54, dx: 0, dz: 300 }), 'Tacada inválida.', '0,9 s atrás');
  assert.equal(m.jogo.acao(anaId, { tipo: 'tacada', passo: p - 42, dx: 0, dz: 300 }), null, '0,7 s atrás');
});

test('cair no buraco do chão devolve a bola para onde estava, com uma tacada a mais', () => {
  const b = BURACOS.find((x) => x.casas.some(([peca]) => peca === 'lacuna'))!;
  const [, cx, cz] = b.casas.find(([peca]) => peca === 'lacuna')!;
  const bola = novaBola(b);
  // a bola parada logo antes do buraco do chão, e uma tacada fraca para dentro dele
  bola.x = cx;
  bola.z = cz - 0.4;
  bater(bola, { passo: 0, dx: 0, dz: 200 });
  rolarAteParar(b, bola);
  assert.deepEqual([bola.x, bola.z, bola.tacadas, bola.dentro], [cx, cz - 0.4, 2, false]);
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
    assert.equal(m.jogo.acao(biaId, { tipo: 'tacada', passo: passoDeAgora(m.inicio()), dx: 0, dz: 40 }), null);
  }
  assert.equal(m.jogo.acao(biaId, { tipo: 'tacada', passo: passoDeAgora(m.inicio()) + 30, dx: 0, dz: 40 }), 'Esta rodada já acabou.');
  assert.equal(m.jogo.publico(biaId).fechando, true, 'a tela sabe que já não dá para bater');
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

test('a partida inteira: todos os buracos, menos tacadas ganha, e o troféu do pódio só para quem acertou', async () => {
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
  assert.equal(placar[1].pontos, BURACOS.length * 7, 'todos os buracos com 7');
  assert.ok(placar[0].pontos < BURACOS.length * 7);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].pontos, daAna[0].tempoMs], ['golfe3d', 1, placar[0].pontos, null]);
  const daBia = (await comToken(app, bia.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daBia.filter((t: { pista: string }) => t.pista === 'golfe3d').length, 0, 'sem acertar nenhum buraco, sem troféu');
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

test('o placar final classifica só quem ficou até o fim, como o troféu; quem saiu aparece sem posição', async () => {
  let naSala = [anaId, biaId, crisId];
  const m = comecar(() => naSala, comunidade.id);
  for (let i = 0; i < BURACOS.length; i++) {
    m.andar();
    if (i === 0) jogarBuraco(m, crisId); // a Cris joga bem o primeiro buraco...
    if (i === 1) naSala = [anaId, biaId]; // ...e sai no segundo
    jogarBuraco(m, anaId);
    // a Bia não joga: fica com 7 em todos
    while (m.jogo.publico(anaId).fase === 'jogando') m.andar();
    if (i < BURACOS.length - 1) m.andar();
  }
  assert.equal(m.jogo.publico(anaId).fase, 'fim');
  const placar = m.jogo.publico(anaId).placar as { userId: number; pontos: number; posicao: number | null }[];
  const da = (id: number) => placar.find((l) => l.userId === id)!;
  assert.ok(da(crisId).pontos < da(biaId).pontos, 'a Cris, que saiu, tem menos tacadas que a Bia');
  assert.deepEqual(
    placar.map((l) => [l.userId, l.posicao]),
    [
      [anaId, 1],
      [biaId, 2],
      [crisId, null],
    ],
    'quem saiu vem depois, sem posição',
  );
  const daCris = (await comToken(app, cris.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daCris.filter((t: { pista: string }) => t.pista === 'golfe3d').length, 0, 'quem saiu não ganha troféu');
});

test('empatados dividem a posição no placar', () => {
  const m = comecar([anaId, biaId]);
  m.andar();
  m.andar(); // o tempo acaba: as duas com 7
  const placar = m.jogo.publico(anaId).placar as { posicao: number | null }[];
  assert.deepEqual(placar.map((l) => l.posicao), [1, 1]);
});

test('a bola dos outros: só números dentro do buraco, carimbados, e não mais que 20 por segundo', () => {
  const m = comecar([anaId, biaId]);
  const tempoReal = m.jogo.tempoReal!;
  assert.equal(tempoReal(anaId, { x: 0, z: 1 }), null, 'no "prepare-se" não');
  m.andar();
  assert.deepEqual(tempoReal(anaId, { x: 0.12345, z: 2, userId: biaId }), { userId: anaId, buraco: 0, x: 0.123, z: 2 });
  assert.equal(tempoReal(anaId, { x: 0.1, z: 2.1 }), null, 'logo em seguida');
  agora += 60;
  assert.equal(tempoReal(anaId, { x: 50, z: 2 }), null, 'fora do buraco');
  assert.equal(tempoReal(anaId, { x: 'a', z: 2 }), null);
  assert.equal(tempoReal(999, { x: 0, z: 1 }), null, 'quem não joga');
});

test('sozinho: mais tempo no buraco, e sem pódio', async () => {
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  const m = comecar([anaId], comunidade.id);
  assert.equal(m.jogo.publico(anaId).rodadas, BURACOS.length);
  m.andar();
  assert.equal(m.jogo.publico(anaId).duracaoMs, golfeMod.BURACO_SOLO_MS);
  for (let i = 0; i < BURACOS.length; i++) {
    if (i > 0) m.andar();
    jogarBuraco(m, anaId);
    while (m.jogo.publico(anaId).fase === 'jogando') m.andar();
    if (i < BURACOS.length - 1) m.andar();
  }
  assert.equal(m.terminou(), true);
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes, 'sem troféu');
});
