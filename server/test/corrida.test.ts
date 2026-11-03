import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { validarCorrida } = await import('../src/corrida.js');
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
 * Uma corrida de mentira, mas coerente: 3 voltas de `porVolta` passos, num círculo que passa pela linha de chegada da
 * horta-1 (250, 190), com o centro em (500, 500): ~2500 unidades por volta, mais que os 70% da pista que se exige.
 */
function corrida(porVolta: number) {
  const voltas = [porVolta, porVolta * 2, porVolta * 3];
  const r = Math.hypot(250 - 500, 190 - 500), a0 = Math.atan2(190 - 500, 250 - 500);
  const amostras: number[] = [];
  for (let p = 1; p <= voltas[2]; p += 4) {
    const a = a0 + (2 * Math.PI * (p - 1)) / porVolta;
    amostras.push(Math.round((500 + Math.cos(a) * r) * 10), Math.round((500 + Math.sin(a) * r) * 10), Math.round(a * 1000));
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
