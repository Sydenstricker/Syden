/**
 * O bolão da comunidade (bolao-routes.ts), no formato de 15/11/2026: uma pergunta com foto, um palpite de dia e hora por
 * pessoa, e ganha quem chegar mais perto da resposta.
 *   1. Qualquer membro cria um bolão (com foto, servida pela chave); quem não participa recebe 404.
 *   2. Os palpites dos outros só aparecem depois de fechar (na hora marcada, na mão ou com a resposta).
 *   3. Só quem criou e quem administra fecham, lançam a resposta e apagam.
 *   4. A classificação: mais perto primeiro; quem empata na menor distância também ganha.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');
const { DatabaseSync } = await import('node:sqlite');
const banco = new DatabaseSync(process.env.DATABASE_PATH!);
const { classificar, aberto } = await import('../src/bolao-routes.js');

const dona = comToken(app, (await criarConta(app, 'dona-bolao')).token);
const ana = comToken(app, (await criarConta(app, 'ana-bolao')).token);
const bia = comToken(app, (await criarConta(app, 'bia-bolao')).token);
const caio = comToken(app, (await criarConta(app, 'caio-bolao')).token);
const fora = comToken(app, (await criarConta(app, 'fora-bolao')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã do bolão' })).json();
for (const quem of [ana, bia, caio]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
const base = `/api/communities/${comunidade.id}/boloes`;
const daqui = (minutos: number) => new Date(Date.now() + minutos * 60000).toISOString();
const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 3)]).toString('base64');

test('a classificação e o "aberto"', () => {
  const r = classificar(
    [
      { nome: 'a', quando: '2026-12-01T12:00:00.000Z', em: '2' },
      { nome: 'b', quando: '2026-12-01T09:00:00.000Z', em: '3' },
      { nome: 'c', quando: '2026-12-01T09:00:00.000Z', em: '1' },
      { nome: 'd', quando: '2026-12-01T10:30:00.000Z', em: '4' },
    ],
    '2026-12-01T10:00:00.000Z',
  );
  // d a 30 min; c e b a 1 h (c palpitou antes); a a 2 h
  assert.deepEqual(
    r.map((p) => p.nome),
    ['d', 'c', 'b', 'a'],
  );
  assert.equal(r[0].diferencaMs, 30 * 60000);
  assert.equal(r[1].diferencaMs, -60 * 60000);
  // só d ganha; empatados na menor distância, os dois ganham
  assert.deepEqual(
    r.map((p) => p.ganhou),
    [true, false, false, false],
  );
  const empate = classificar(
    [
      { quando: '2026-12-01T09:00:00.000Z', em: '2' },
      { quando: '2026-12-01T11:00:00.000Z', em: '1' },
    ],
    '2026-12-01T10:00:00.000Z',
  );
  assert.deepEqual(
    empate.map((p) => p.ganhou),
    [true, true],
  );
  assert.equal(aberto({ fechado: false, resposta: null, fechaEm: null }), true);
  assert.equal(aberto({ fechado: true, resposta: null, fechaEm: null }), false);
  assert.equal(aberto({ fechado: false, resposta: daqui(0), fechaEm: null }), false);
  assert.equal(aberto({ fechado: false, resposta: null, fechaEm: daqui(-1) }), false);
});

test('membro cria, com foto; quem não participa não vê', async () => {
  const r = await ana('POST', base, { pergunta: '  Quando   o Caio chega? ', imagem: png, fechaEm: daqui(60) });
  assert.equal(r.statusCode, 201, r.body);
  const bolao = r.json();
  assert.equal(bolao.pergunta, 'Quando o Caio chega?');
  assert.equal(bolao.aberto, true);
  assert.match(bolao.foto, /^[0-9a-f]{24}$/);
  // a foto: pela chave, e só com ela
  const foto = await app.inject({ method: 'GET', url: `/api/boloes/${bolao.id}/foto/${bolao.foto}` });
  assert.equal(foto.statusCode, 200);
  assert.equal(foto.headers['content-type'], 'image/png');
  assert.equal((await app.inject({ method: 'GET', url: `/api/boloes/${bolao.id}/foto/000000000000000000000000` })).statusCode, 404);

  assert.deepEqual(
    (await bia('GET', base)).json().boloes.map((b: { pergunta: string }) => b.pergunta),
    ['Quando o Caio chega?'],
  );
  assert.equal((await fora('GET', base)).statusCode, 404);
  assert.equal((await fora('POST', base, { pergunta: 'x' })).statusCode, 404);
  assert.equal((await ana('POST', base, { pergunta: '​' })).statusCode, 400);
  assert.equal((await ana('POST', base, { pergunta: 'Ontem?', fechaEm: daqui(-5) })).statusCode, 400);
  // sem foto e sem hora de fechar também vale
  const simples = (await bia('POST', base, { pergunta: 'Quando chove?' })).json();
  assert.equal(simples.foto, null);
  assert.equal(simples.fechaEm, null);
});

test('palpites escondidos até fechar, a resposta e a classificação', async () => {
  const bolao = (await ana('GET', base)).json().boloes.find((b: { pergunta: string }) => b.pergunta.startsWith('Quando o Caio'));
  const b = `${base}/${bolao.id}`;
  assert.equal((await bia('PUT', `${b}/palpite`, { quando: '2026-12-01T09:00:00.000Z' })).statusCode, 200);
  assert.equal((await caio('PUT', `${b}/palpite`, { quando: '2026-12-01T12:00:00.000Z' })).statusCode, 200);
  assert.equal((await ana('PUT', `${b}/palpite`, { quando: '2026-12-01T10:30:00.000Z' })).statusCode, 200);
  // mudar o palpite enquanto está aberto
  assert.equal((await caio('PUT', `${b}/palpite`, { quando: '2026-12-01T11:00:00.000Z' })).statusCode, 200);
  assert.equal((await bia('PUT', `${b}/palpite`, { quando: 'amanhã' })).statusCode, 400);
  assert.equal((await fora('PUT', `${b}/palpite`, { quando: daqui(0) })).statusCode, 404);

  // aberto: cada um vê o seu, e dos outros só quantos
  let visto = (await bia('GET', b)).json();
  assert.equal(visto.podeEditar, false);
  assert.equal(visto.palpites, null);
  assert.equal(visto.bolao.palpites, 3);
  assert.equal(visto.meu, '2026-12-01T09:00:00.000Z');

  // fechar: só quem cuida; fechado, os palpites aparecem e não se palpita mais
  assert.equal((await bia('PUT', `${b}/fechado`, { fechado: true })).statusCode, 403);
  assert.equal((await dona('PUT', `${b}/fechado`, { fechado: true })).statusCode, 200);
  assert.equal((await bia('PUT', `${b}/palpite`, { quando: daqui(0) })).statusCode, 409);
  visto = (await bia('GET', b)).json();
  assert.equal(visto.bolao.aberto, false);
  assert.equal(visto.palpites.length, 3);

  // a resposta: a classificação pela distância
  assert.equal((await bia('PUT', `${b}/resposta`, { resposta: '2026-12-01T10:00:00.000Z' })).statusCode, 403);
  assert.equal((await ana('PUT', `${b}/resposta`, { resposta: '2026-12-01T10:00:00.000Z' })).statusCode, 200);
  visto = (await caio('GET', b)).json();
  assert.equal(visto.bolao.resposta, '2026-12-01T10:00:00.000Z');
  assert.deepEqual(
    visto.palpites.map((p: { nome: string; diferencaMs: number }) => [p.nome, p.diferencaMs / 60000]),
    [
      ['ana-bolao', 30],
      ['bia-bolao', -60],
      ['caio-bolao', 60],
    ],
  );

  // a hora marcada que passou também fecha (reabrir na mão não reabre)
  assert.equal((await ana('PUT', `${b}/resposta`, { resposta: null })).statusCode, 200);
  assert.equal((await dona('PUT', `${b}/fechado`, { fechado: false })).statusCode, 200);
  assert.equal((await caio('GET', b)).json().bolao.aberto, true);
  banco.prepare('UPDATE boloes SET fecha_em = ? WHERE id = ?').run(daqui(-1), bolao.id);
  assert.equal((await caio('GET', b)).json().bolao.aberto, false);

  // os palpites vão no "Levar seus dados"
  assert.equal(db.palpitesDe(visto.palpites[0].userId)[0].pergunta, 'Quando o Caio chega?');

  // apagar: só quem cuida
  assert.equal((await bia('DELETE', b)).statusCode, 403);
  assert.equal((await ana('DELETE', b)).statusCode, 200);
  assert.equal((await ana('GET', b)).statusCode, 404);
});

test('o Shield tira a foto, e a pergunta fica', async () => {
  const bolao = (await dona('POST', base, { pergunta: 'Quem chega primeiro?', imagem: png })).json();
  const { sha } = banco.prepare('SELECT sha FROM boloes WHERE id = ?').get(bolao.id) as { sha: string };
  db.retirarPeloShield(sha);
  const depois = (await dona('GET', `${base}/${bolao.id}`)).json().bolao;
  assert.equal(depois.foto, null);
  assert.equal(depois.pergunta, 'Quem chega primeiro?');
});
