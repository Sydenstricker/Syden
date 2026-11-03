/**
 * A corrida ao vivo na sala (minijogo-corrida.ts): a largada é do servidor, a posição só é repassada, e a classificação é
 * pelo tempo de cada um (em passos desde o próprio sinal verde), e não pela ordem em que as chegadas chegam.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarCorrida, FOLGA_MS } = await import('../src/minijogo-corrida.js');
/** O relógio da corrida, na mão: cada teste anda com ele. */
let agora = 1_000_000;
const corrida = criarCorrida(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-corrida');
const bia = await criarConta(app, 'bia-corrida');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do kart' })).json() as { id: number };

/** Como em corrida.test.ts: um círculo que passa pela linha de chegada da horta-1. */
function corridaDe(porVolta: number) {
  const voltas = [porVolta, porVolta * 2, porVolta * 3];
  const r = Math.hypot(250 - 500, 190 - 500), a0 = Math.atan2(190 - 500, 250 - 500);
  const amostras: number[] = [];
  for (let p = 1; p <= voltas[2]; p += 4) {
    const a = a0 + (2 * Math.PI * (p - 1)) / porVolta;
    amostras.push(Math.round((500 + Math.cos(a) * r) * 10), Math.round((500 + Math.sin(a) * r) * 10), Math.round(a * 1000));
  }
  return { tipo: 'chegada', voltas, amostras };
}

/** Um círculo que passa pela linha de chegada de outra pista (o centro em (520, 520), o raio até a linha). */
function corridaPela(linha: [number, number]) {
  return (porVolta: number) => {
    const voltas = [porVolta, porVolta * 2, porVolta * 3];
    const r = Math.hypot(linha[0] - 520, linha[1] - 520), a0 = Math.atan2(linha[1] - 520, linha[0] - 520);
    const amostras: number[] = [];
    for (let p = 1; p <= voltas[2]; p += 4) {
      const a = a0 + (2 * Math.PI * (p - 1)) / porVolta;
      amostras.push(Math.round((520 + Math.cos(a) * r) * 10), Math.round((520 + Math.sin(a) * r) * 10), Math.round(a * 1000));
    }
    return { tipo: 'chegada', voltas, amostras };
  };
}
const corridaNoPomar = corridaPela([220, 300]);
const corridaNaPraia = corridaPela([230, 230]);

/** O motor de mentira: o relógio é chamado na mão. */
function contexto(naSala: number[], comunidade = 0) {
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
      nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
      comunidade,
    },
  };
}

test('antes do verde não se chega; quem chega por último na rede, mas com tempo menor, ganha', () => {
  const m = contexto([anaId, biaId]);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.publico(anaId).fase, 'largada');
  assert.ok(jogo.acao(anaId, corridaDe(1300)), 'chegar durante a contagem é recusado');
  m.relogio[0].depois();
  assert.equal(jogo.publico(anaId).fase, 'correndo');
  // o fantasma guardado, mandado pelo console 1 s depois do verde (revisão de 03/11/2026): o relógio não deixa
  agora += 1000;
  assert.ok(jogo.acao(anaId, corridaDe(1300)), 'chegar em 1:05 com 1 s de corrida é recusado');
  assert.equal(m.relogio[0].ms, 5 * 60_000, 'e não abre o prazo de ninguém');

  agora += 64_000 - FOLGA_MS;
  assert.equal(jogo.acao(anaId, corridaDe(1300)), null, 'a Ana chega primeiro, com 1:05');
  assert.equal(m.relogio[0].ms, 30_000, 'e abre o prazo de 30 s');
  assert.equal(m.terminou(), false);
  assert.equal(jogo.acao(biaId, corridaDe(1250)), null, 'a Bia chega depois, mas com 1:02,5');
  assert.equal(m.terminou(), true, 'todo mundo chegou: acabou');
  const pilotos = jogo.publico(anaId).pilotos as { userId: number; tempoMs: number }[];
  assert.deepEqual(pilotos.map((p) => p.userId), [biaId, anaId], 'a Bia em primeiro, pelo tempo');
});

test('fantasma que não fecha é recusado; quem não chega fica atrás, pelo quanto andou', () => {
  const m = contexto([anaId, biaId]);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  m.relogio[0].depois();
  agora += 120_000;
  const torta = corridaDe(1300);
  torta.amostras[30] += 5000;
  assert.ok(jogo.acao(anaId, torta), 'o salto de posição é recusado');
  assert.equal(jogo.tempoReal!(biaId, { x: 2000, y: 1, a: 0, n: 1, andou: 1 }), null, 'posição fora do mapa não é repassada');
  assert.equal(jogo.tempoReal!(biaId, { x: 10, y: 20, a: 0, n: 2, andou: 3.5 }), null, 'nem quem diz ter andado mais que a corrida');
  assert.deepEqual(jogo.tempoReal!(biaId, { x: 10, y: 20, a: 0.5, n: 40, andou: 1.4 }), { userId: biaId, x: 10, y: 20, a: 0.5, n: 40, andou: 1.4 });
  jogo.tempoReal!(anaId, { x: 10, y: 20, a: 0.5, n: 40, andou: 0.8 });
  m.relogio[0].depois(); // a corrida passou de 5 min
  assert.equal(m.terminou(), true);
  const pilotos = jogo.publico(anaId).pilotos as { userId: number; tempoMs: number | null }[];
  assert.deepEqual(pilotos.map((p) => [p.userId, p.tempoMs]), [[biaId, null], [anaId, null]], 'a Bia andou mais');
});


test('a corrida avulsa dá o troféu do pódio, com contra quem, e não vira recorde (tem itens)', async () => {
  const m = contexto([anaId, biaId], comunidade.id);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { pista: 'pomar-1' } });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.publico(anaId).pista, 'pomar-1');
  m.relogio[0].depois();
  agora += 120_000;
  assert.ok(jogo.acao(anaId, corridaDe(1200)), 'o fantasma da Horta não fecha no Pomar (a linha de chegada é outra)');
  assert.equal(jogo.acao(anaId, corridaNoPomar(1200)), null);
  assert.equal(jogo.acao(biaId, corridaNoPomar(1300)), null);
  assert.equal(m.terminou(), true);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.ok(daAna.length >= 1);
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].tempoMs], ['pomar-1', 1, 60_000]);
  assert.deepEqual(daAna[0].rivais.map((r: { userId: number }) => r.userId), [biaId], 'contra a Bia');
  const daBia = (await comToken(app, bia.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.equal(daBia[0].posicao, 2);
  assert.deepEqual((await comToken(app, ana.token)('GET', '/api/corrida/pomar-1')).json().recordes, [], 'a corrida com itens não é recorde');
});

test('a Copa da Cenoura: três pistas, pontos por posição, o troféu da copa e a copa da turma', async () => {
  const { copasDaComunidade } = await import('../src/db.js');
  const m = contexto([anaId, biaId], comunidade.id);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { pista: 'copa-da-cenoura' } });
  assert.ok(typeof jogo !== 'string');
  const correr = (pista: string, tempoAna: number, tempoBia: number) => {
    assert.equal(jogo.publico(anaId).pista, pista);
    m.relogio[0].depois(); // o verde
    agora += 200_000;
    const de = pista === 'horta-1' ? corridaDe : pista === 'pomar-1' ? corridaNoPomar : corridaNaPraia;
    assert.equal(jogo.acao(anaId, de(tempoAna)), null);
    assert.equal(jogo.acao(biaId, de(tempoBia)), null);
  };
  correr('horta-1', 1200, 1300);
  assert.equal(jogo.publico(anaId).fase, 'intervalo');
  assert.equal(m.relogio[0].ms, 10_000);
  m.relogio[0].depois(); // o fim do intervalo: a próxima largada
  correr('pomar-1', 1400, 1250);
  m.relogio[0].depois();
  correr('praia-1', 1250, 1300);
  assert.equal(m.terminou(), true);
  const placar = jogo.publico(anaId).placarDaCopa as { userId: number; pontos: number }[];
  assert.deepEqual(placar.map((l) => [l.userId, l.pontos]), [[anaId, 28], [biaId, 26]]);
  const daAna = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus;
  assert.deepEqual([daAna[0].pista, daAna[0].posicao, daAna[0].pontos], ['copa-da-cenoura', 1, 28]);
  assert.equal(copasDaComunidade(comunidade.id), 1, 'a copa da turma conta na comunidade');
});

test('os itens: o servidor carimba o dono, e não deixa usar mais do que as caixas dão', () => {
  const m = contexto([anaId, biaId], comunidade.id);
  const jogo = corrida.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.tempoReal!(anaId, { tipo: 'repolho', n: 10, s: 100, lado: 3 }), null, 'antes do verde, não');
  m.relogio[0].depois();
  const r = jogo.tempoReal!(anaId, { tipo: 'repolho', n: 300, s: 100, lado: 3, dono: biaId });
  assert.deepEqual(r, { tipo: 'repolho', id: `${anaId}-300`, dono: anaId, n: 300, s: 100, lado: 3 }, 'o dono é quem mandou');
  assert.equal(jogo.tempoReal!(anaId, { tipo: 'lama', n: 310, x: 10, y: 10 }), null, 'dois no mesmo segundo, não');
  let usados = 1;
  for (let i = 0; i < 20; i++) {
    agora += 2000;
    if (jogo.tempoReal!(anaId, { tipo: 'lama', n: 400 + i, x: 10, y: 10 })) usados++;
  }
  assert.equal(usados, 7, 'duas fileiras de caixas por volta, três voltas, e uma de folga');
  assert.equal(jogo.tempoReal!(biaId, { tipo: 'acertou', id: 'x; DROP' }), null);
  assert.deepEqual(jogo.tempoReal!(biaId, { tipo: 'acertou', id: `${anaId}-300` }), { tipo: 'acertou', id: `${anaId}-300` });
});
