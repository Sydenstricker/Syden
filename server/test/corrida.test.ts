import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { PISTAS, validarCorrida } = await import('../src/corrida.js');
after(fechar);

const ana = await criarConta(app, 'ana');
const bia = await criarConta(app, 'bia');
const caio = await criarConta(app, 'caio');
const comoAna = comToken(app, ana.token);
const comoBia = comToken(app, bia.token);
const comoCaio = comToken(app, caio.token);
const idDe = async (pedir: typeof comoAna) => (await pedir('GET', '/api/me')).json().id as number;
const anaId = await idDe(comoAna);
const biaId = await idDe(comoBia);

/**
 * Uma corrida de mentira, mas coerente: 3 voltas de `porVolta` passos pelo polígono da linha de chegada e dos marcos da
 * pista (o que o servidor confere: andar 70% da pista, acabar na linha, passar pelos marcos em ordem).
 */
function corrida(porVolta: number, pista = 'horta-1') {
  const { linha, marcos } = PISTAS[pista];
  const pontos = [linha, ...marcos];
  const trechos = pontos.map((a, i) => {
    const b = pontos[(i + 1) % pontos.length];
    return { a, b, l: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  const total = trechos.reduce((s, t) => s + t.l, 0);
  const voltas = [porVolta, porVolta * 2, porVolta * 3];
  const amostras: number[] = [];
  for (let p = 1; p <= voltas[2]; p += 4) {
    let s = (((p - 1) % porVolta) / porVolta) * total;
    let t = trechos[0];
    for (t of trechos) {
      if (s <= t.l) break;
      s -= t.l;
    }
    const f = s / t.l;
    amostras.push(Math.round((t.a[0] + (t.b[0] - t.a[0]) * f) * 10), Math.round((t.a[1] + (t.b[1] - t.a[1]) * f) * 10), Math.round(Math.atan2(t.b[1] - t.a[1], t.b[0] - t.a[0]) * 1000));
  }
  return { voltas, amostras };
}

test('a conferência recusa o que não fecha: tempo sem caminho, volta curta demais, salto de posição', () => {
  assert.ok('ok' in validarCorrida('horta-1', corrida(1200)));
  assert.ok('erro' in validarCorrida('outra', corrida(1200)), 'pista que não existe');
  assert.ok('erro' in validarCorrida('horta-1', corrida(200)), 'volta de 3 s');
  const curta = corrida(1200);
  curta.amostras = curta.amostras.slice(0, -30);
  assert.ok('erro' in validarCorrida('horta-1', curta), 'o tempo declarado é maior que o fantasma');
  const salto = corrida(1200);
  salto.amostras[30] += 5000;
  assert.ok('erro' in validarCorrida('horta-1', salto), 'o kart pulou 500 unidades');
  assert.equal((validarCorrida('horta-1', corrida(1200)) as { ok: { tempoMs: number } }).ok.tempoMs, 60000, '3600 passos = 1 min');
  // o kart parado (revisão de 03/11/2026): as amostras no mesmo lugar, com voltas de 8 s, viravam recorde de 0:24
  const parado = { voltas: [480, 960, 1440], amostras: Array.from({ length: 361 }, () => [5000, 5000, 0]).flat() };
  assert.ok('erro' in validarCorrida('horta-1', parado), 'o kart que não anda não fecha volta');
  // a volta que anda, mas termina longe da linha de chegada
  const longe = corrida(1200);
  longe.amostras = longe.amostras.map((v, i) => (i % 3 === 0 ? v + 800 : v));
  assert.ok('erro' in validarCorrida('horta-1', longe), 'o fim da volta tem de cair na linha');
});

test('o fantasma em zigue-zague sobre a linha de chegada não vira recorde (revisão independente, 03/11/2026)', () => {
  // ±6 unidades para lá e para cá, em cima da linha: anda os 70% da pista em ~12 s por volta, sem ir a lugar nenhum
  const porVolta = 720;
  const voltas = [porVolta, porVolta * 2, porVolta * 3];
  const amostras: number[] = [];
  for (let p = 1, i = 0; p <= voltas[2]; p += 4, i++) amostras.push((250 + (i % 2 ? 6 : -6)) * 10, 190 * 10, 0);
  const sem = validarCorrida('horta-1', { voltas, amostras });
  assert.ok('erro' in sem, 'sem passar pelos marcos da pista, não fecha volta');
  // todas as pistas aceitam o polígono dos próprios marcos
  for (const id of Object.keys(PISTAS)) assert.ok('ok' in validarCorrida(id, corrida(1300, id)), id);
});

test('só o melhor tempo fica, e quem não é amigo não vê o recorde nem o fantasma', async () => {
  let r = (await comoAna('POST', '/api/corrida/horta-1', corrida(1300))).json();
  assert.equal(r.recorde, true);
  assert.equal(r.anterior, null);
  r = (await comoAna('POST', '/api/corrida/horta-1', corrida(1400))).json();
  assert.equal(r.recorde, false, 'mais lenta não substitui');
  r = (await comoAna('POST', '/api/corrida/horta-1', corrida(1250))).json();
  assert.equal(r.recorde, true);
  assert.equal(r.anterior, 65000);

  const daAna = (await comoAna('GET', '/api/corrida/horta-1')).json().recordes;
  assert.equal(daAna.length, 1);
  assert.equal(daAna[0].tempoMs, 62500);
  assert.equal((await comoAna('GET', `/api/corrida/horta-1/fantasma/${anaId}`)).statusCode, 200);

  assert.deepEqual((await comoBia('GET', '/api/corrida/horta-1')).json().recordes, [], 'a Bia não é amiga');
  assert.equal((await comoBia('GET', `/api/corrida/horta-1/fantasma/${anaId}`)).statusCode, 404);
});

test('com a amizade aceita, os dois se veem, do mais rápido ao mais lento', async () => {
  await comoAna('POST', '/api/amigos', { username: 'bia' });
  assert.equal((await comoBia('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  await comoBia('POST', '/api/corrida/horta-1', corrida(1200));
  const vistos = (await comoAna('GET', '/api/corrida/horta-1')).json().recordes;
  assert.deepEqual(vistos.map((v: { username: string }) => v.username), ['bia', 'ana']);
  const f = (await comoAna('GET', `/api/corrida/horta-1/fantasma/${biaId}`)).json();
  assert.equal(f.amostras.length, corrida(1200).amostras.length);
  assert.deepEqual((await comoCaio('GET', '/api/corrida/horta-1')).json().recordes, [], 'e quem não é amigo de ninguém continua sem ver');
  assert.equal((await comoAna('GET', '/api/me/dados')).json().conta.corrida[0].tempoMs, 62500, 'e vai no "Levar seus dados"');
});
