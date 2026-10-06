import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// OS CARGOS PERSONALIZADOS (ver cargos-routes.ts e o bloco "OS CARGOS" de db.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona-cargos')).token);
const membro = comToken(app, (await criarConta(app, 'membro-cargos')).token);
const fora = comToken(app, (await criarConta(app, 'fora-cargos')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã dos cargos' })).json();
assert.equal((await membro('POST', '/api/communities/join', { code: comunidade.inviteCode })).statusCode, 200);
const idDe = async (nome: string) =>
  ((await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; username: string }[]).find((m) => m.username === nome)!.id;
const membroId = await idDe('membro-cargos');

let veterano = 0;
let raide = 0;

test('quem administra cria cargos com nome e cor; eles entram no fim da lista', async () => {
  const r1 = await dona('POST', `/api/communities/${comunidade.id}/cargos`, { nome: '  Veterano  ', cor: '#F5B83D', separado: true });
  assert.equal(r1.statusCode, 200, r1.body);
  assert.deepEqual({ ...r1.json(), id: 0 }, { id: 0, communityId: comunidade.id, nome: 'Veterano', cor: '#f5b83d', separado: true, posicao: 0 });
  veterano = r1.json().id;
  const r2 = await dona('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Raide', cor: '#2fbf71' });
  raide = r2.json().id;
  assert.equal(r2.json().posicao, 1);
  assert.equal(r2.json().separado, false);
  const lista = (await membro('GET', `/api/communities/${comunidade.id}/cargos`)).json();
  assert.deepEqual(
    lista.map((c: { nome: string }) => c.nome),
    ['Veterano', 'Raide'],
    'todo membro vê a lista',
  );
});

test('nome vazio ou longo, e cor fora do formato, são recusados', async () => {
  for (const corpo of [{ nome: '', cor: '#ffffff' }, { nome: 'x'.repeat(33), cor: '#ffffff' }, { nome: 'Ok', cor: 'red' }, { nome: 'Ok', cor: '#fff' }]) {
    assert.equal((await dona('POST', `/api/communities/${comunidade.id}/cargos`, corpo)).statusCode, 400, JSON.stringify(corpo));
  }
});

test('membro comum não cria, não edita, não apaga e não dá cargo; quem é de fora nem vê', async () => {
  assert.equal((await membro('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Eu', cor: '#ffffff' })).statusCode, 403);
  assert.equal((await membro('PATCH', `/api/communities/${comunidade.id}/cargos/${veterano}`, { nome: 'Eu' })).statusCode, 403);
  assert.equal((await membro('DELETE', `/api/communities/${comunidade.id}/cargos/${veterano}`)).statusCode, 403);
  assert.equal((await membro('PUT', `/api/communities/${comunidade.id}/members/${membroId}/cargos/${veterano}`)).statusCode, 403);
  assert.equal((await fora('GET', `/api/communities/${comunidade.id}/cargos`)).statusCode, 404);
});

test('dar e tirar cargo aparece na lista de membros, e repetir não estraga', async () => {
  const url = `/api/communities/${comunidade.id}/members/${membroId}/cargos`;
  assert.equal((await dona('PUT', `${url}/${raide}`)).statusCode, 200);
  assert.equal((await dona('PUT', `${url}/${veterano}`)).statusCode, 200);
  const r = await dona('PUT', `${url}/${veterano}`);
  assert.deepEqual(r.json().cargos, [veterano, raide], 'na ordem da lista, sem repetir');
  await dona('DELETE', `${url}/${raide}`);
  const membros = (await membro('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; cargos: number[] }[];
  assert.deepEqual(membros.find((m) => m.id === membroId)!.cargos, [veterano]);
});

test('cargo de outra comunidade não serve aqui', async () => {
  const outra = (await fora('POST', '/api/communities', { name: 'Outra' })).json();
  const alheio = (await fora('POST', `/api/communities/${outra.id}/cargos`, { nome: 'Alheio', cor: '#ffffff' })).json();
  assert.equal((await dona('PUT', `/api/communities/${comunidade.id}/members/${membroId}/cargos/${alheio.id}`)).statusCode, 404);
  assert.equal((await dona('PATCH', `/api/communities/${comunidade.id}/cargos/${alheio.id}`, { nome: 'Meu' })).statusCode, 404);
});

test('editar muda nome, cor, separação e ordem', async () => {
  const r = await dona('PATCH', `/api/communities/${comunidade.id}/cargos/${raide}`, { nome: 'Raide de sexta', posicao: 0, separado: true });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().nome, 'Raide de sexta');
  assert.equal((await dona('PATCH', `/api/communities/${comunidade.id}/cargos/${raide}`, { posicao: -1 })).statusCode, 400);
});

test('apagar o cargo tira de quem tinha; sair da comunidade também tira', async () => {
  assert.equal((await dona('DELETE', `/api/communities/${comunidade.id}/cargos/${veterano}`)).statusCode, 200);
  let membros = (await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; cargos: number[] }[];
  assert.deepEqual(membros.find((m) => m.id === membroId)!.cargos, []);

  await dona('PUT', `/api/communities/${comunidade.id}/members/${membroId}/cargos/${raide}`);
  await dona('DELETE', `/api/communities/${comunidade.id}/members/${membroId}`);
  await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
  membros = (await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; cargos: number[] }[];
  assert.deepEqual(membros.find((m) => m.id === membroId)!.cargos, [], 'quem volta começa sem cargo');
});
