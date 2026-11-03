/**
 * O Pulo do coelho, contra o relógio (plataforma.ts e plataforma-routes.ts): a conferência do caminho, o recorde que só
 * o melhor substitui, e quem vê o fantasma de quem (só amigos aceitos).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { FASES_DO_PULO, validarPulo } = await import('../src/plataforma.js');
after(fechar);

const ana = await criarConta(app, 'ana-pulo');
const bia = await criarConta(app, 'bia-pulo');
const caio = await criarConta(app, 'caio-pulo');
const comoAna = comToken(app, ana.token);
const comoBia = comToken(app, bia.token);
const comoCaio = comToken(app, caio.token);
const idDe = async (pedir: typeof comoAna) => (await pedir('GET', '/api/me')).json().id as number;
const anaId = await idDe(comoAna);
const biaId = await idDe(comoBia);

/** Uma corrida de mentira, mas coerente: em linha reta da largada até passar da chegada, em `passos` passos. */
function pulo(fase: string, passos: number) {
  const d = FASES_DO_PULO[fase];
  const [x0, y0] = d.largada;
  const x1 = d.chegada + 2;
  const amostras: number[] = [];
  for (let p = 1; p <= passos; p += 4) {
    const x = x0 + ((x1 - x0) * (p - 1)) / (passos - 1);
    amostras.push(Math.round(x * 10), y0 * 10, 1);
  }
  return { passos, amostras };
}

test('a conferência recusa o que não fecha: rápido demais, salto, longe da chegada, volta a posto não alcançado', () => {
  assert.ok('ok' in validarPulo('prado-1', pulo('prado-1', 2100)));
  assert.equal((validarPulo('prado-1', pulo('prado-1', 2100)) as { ok: { tempoMs: number } }).ok.tempoMs, 35000);
  assert.ok('erro' in validarPulo('outra-1', pulo('prado-1', 2100)), 'fase que não existe');
  // em linha reta, mais rápido do que o coelho corre (3336 px em 25 s = 133/s)
  assert.ok('erro' in validarPulo('prado-1', pulo('prado-1', 1500)), 'mais rápido que a corrida');
  const curta = pulo('prado-1', 2100);
  curta.amostras = curta.amostras.slice(0, -30);
  assert.ok('erro' in validarPulo('prado-1', curta), 'o tempo declarado não bate com o fantasma');
  const longe = pulo('prado-1', 2100);
  longe.amostras = longe.amostras.map((v, i) => (i % 3 === 0 ? Math.min(v, 30000) : v));
  assert.ok('erro' in validarPulo('prado-1', longe), 'parou antes da chegada');
  const outraLargada = pulo('prado-1', 2100);
  outraLargada.amostras[0] += 2000;
  assert.ok('erro' in validarPulo('prado-1', outraLargada), 'não começou na largada');
  const voando = pulo('prado-1', 2100);
  voando.amostras[301] -= 800; // 80 px para cima numa amostra
  assert.ok('erro' in validarPulo('prado-1', voando), 'o salto no y');
  // a volta ao posto: para a largada (já alcançada) vale; para o posto da frente, que ainda não se alcançou, não
  const caiu: number[] = [];
  for (let p = 1; p <= 2600; p += 4) {
    const x = p < 401 ? 56 + (p - 1) * 1.5 : 56 + (p - 401) * 1.52;
    caiu.push(Math.round(x * 10), 1760, 1);
  }
  assert.ok('ok' in validarPulo('prado-1', { passos: 2600, amostras: caiu }), 'caiu no passo 400 e voltou à largada');
  const adiante = pulo('prado-1', 2100);
  const [px, py] = FASES_DO_PULO['prado-1'].postos[3];
  adiante.amostras.splice(30, 3, px * 10, py * 10, 1);
  assert.ok('erro' in validarPulo('prado-1', adiante), 'pular para um posto ainda não alcançado');
  assert.ok('erro' in validarPulo('prado-1', { passos: 2100, amostras: pulo('prado-1', 2100).amostras.map((v, i) => (i % 3 === 2 ? 7 : v)) }), 'jeito inventado');
});

test('só o melhor tempo fica, e quem não é amigo não vê o recorde nem o fantasma', async () => {
  let r = (await comoAna('POST', '/api/plataforma/prado-1', pulo('prado-1', 2400))).json();
  assert.deepEqual([r.recorde, r.anterior], [true, null]);
  r = (await comoAna('POST', '/api/plataforma/prado-1', pulo('prado-1', 2500))).json();
  assert.equal(r.recorde, false, 'mais lenta não substitui');
  r = (await comoAna('POST', '/api/plataforma/prado-1', pulo('prado-1', 2160))).json();
  assert.deepEqual([r.recorde, r.anterior], [true, 40000]);
  assert.equal((await comoAna('POST', '/api/plataforma/prado-1', pulo('prado-1', 1000))).statusCode, 400);
  const daAna = (await comoAna('GET', '/api/plataforma/prado-1')).json().recordes;
  assert.deepEqual(daAna.map((l: { tempoMs: number }) => l.tempoMs), [36000]);
  assert.equal((await comoAna('GET', `/api/plataforma/prado-1/fantasma/${anaId}`)).statusCode, 200);
  assert.deepEqual((await comoBia('GET', '/api/plataforma/prado-1')).json().recordes, [], 'a Bia não é amiga');
  assert.equal((await comoBia('GET', `/api/plataforma/prado-1/fantasma/${anaId}`)).statusCode, 404);
  assert.equal((await comoAna('GET', '/api/plataforma/nada-1')).statusCode, 404);
});

test('com a amizade aceita, os dois se veem; e o recorde vai no "Levar seus dados"', async () => {
  await comoAna('POST', '/api/amigos', { username: 'bia-pulo' });
  assert.equal((await comoBia('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  await comoBia('POST', '/api/plataforma/prado-1', pulo('prado-1', 2100));
  const vistos = (await comoAna('GET', '/api/plataforma/prado-1')).json().recordes;
  assert.deepEqual(vistos.map((v: { userId: number }) => v.userId), [biaId, anaId]);
  const f = (await comoAna('GET', `/api/plataforma/prado-1/fantasma/${biaId}`)).json();
  assert.equal(f.amostras.length, pulo('prado-1', 2100).amostras.length);
  assert.deepEqual((await comoCaio('GET', '/api/plataforma/prado-1')).json().recordes, [], 'quem não é amigo continua sem ver');
  const dados = (await comoAna('GET', '/api/me/dados')).json().conta.puloDoCoelho;
  assert.deepEqual([dados[0].fase, dados[0].tempoMs, dados[0].fantasma.length > 0], ['prado-1', 36000, true]);
});
