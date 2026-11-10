// OS AVATARES ANTERIORES (09/11/2026, pedido dele: "se eu altero o avatar, não consigo escolher o antigo; no meu caso era um
// GIF"). O que este teste prende: trocar guarda o de antes (o GIF continua animado), até 5, o mais novo primeiro, sem repetir;
// voltar a um põe o de agora no lugar dele; o arquivo só abre com a chave, e a lista e o voltar são só da dona.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const png = (n: number) =>
  'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500 + n, n)]).toString('base64');

type Anterior = { id: number; chave: string; animado: boolean };

test('trocar guarda o anterior, e voltar a ele troca de lugar com o de agora', async () => {
  const conta = await criarConta(app, 'quemvolta');
  const como = comToken(app, conta.token);
  const lista = async () => (await como('GET', '/api/me/avatares-anteriores')).json() as Anterior[];

  assert.equal((await como('PUT', '/api/me/avatar', { image: gif })).statusCode, 200);
  assert.deepEqual(await lista(), [], 'o primeiro avatar não tem anterior');

  await como('PUT', '/api/me/avatar', { image: png(1) });
  let l = await lista();
  assert.equal(l.length, 1);
  assert.equal(l[0].animado, true, 'o GIF guardado continua animado');

  // o arquivo abre pela chave, e só por ela
  assert.equal((await app.inject({ method: 'GET', url: `/api/avatares-anteriores/${l[0].id}/${l[0].chave}` })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/avatares-anteriores/${l[0].id}/errada` })).statusCode, 404);

  // voltar ao GIF: ele é o avatar de novo (animado), e o PNG vai para o histórico
  const voltou = await como('PUT', '/api/me/avatar/anterior', { id: l[0].id });
  assert.equal(voltou.statusCode, 200, voltou.body);
  assert.equal(voltou.json().avatarAnimado, true);
  l = await lista();
  assert.equal(l.length, 1);
  assert.equal(l[0].animado, false);

  // o coelho pronto também guarda a foto de antes
  await como('PUT', '/api/me/avatar-pronto', { numero: 3 });
  assert.equal((await lista()).length, 2);

  // a de outra pessoa não se vê nem se usa
  const outra = comToken(app, (await criarConta(app, 'outrapessoa')).token);
  assert.deepEqual((await outra('GET', '/api/me/avatares-anteriores')).json(), []);
  assert.equal((await outra('PUT', '/api/me/avatar/anterior', { id: l[0].id })).statusCode, 404);
  assert.equal((await outra('DELETE', `/api/me/avatares-anteriores/${l[0].id}`)).statusCode, 404);

  // apagar do histórico
  assert.equal((await como('DELETE', `/api/me/avatares-anteriores/${l[0].id}`)).statusCode, 200);
  assert.equal((await lista()).length, 1);
});

test('o histórico guarda os 5 mais novos, sem repetir a mesma imagem', async () => {
  const como = comToken(app, (await criarConta(app, 'trocamuito')).token);
  for (let i = 1; i <= 8; i++) await como('PUT', '/api/me/avatar', { image: png(i) });
  // a mesma imagem de novo: não vira uma segunda linha, e a que entra sai do histórico (ela é a de agora)
  await como('PUT', '/api/me/avatar', { image: png(5) });
  const l = (await como('GET', '/api/me/avatares-anteriores')).json() as Anterior[];
  assert.equal(l.length, 5);
  assert.equal(new Set(l.map((a) => a.chave)).size, 5);
});

// O RELATO DE 10/11/2026 ("durante a alternância entre avatares, eu perdi de novo o meu referencial antigo de GIF"): o GIF,
// depois de vários coelhos prontos seguidos, continua no histórico, uma vez só e animado, e voltar a ele tira o coelho.
test('o GIF sobrevive a vários coelhos seguidos e volta animado', async () => {
  const como = comToken(app, (await criarConta(app, 'dogif')).token);
  await como('PUT', '/api/me/avatar', { image: gif });
  for (const numero of [1, 2, 3, 16]) assert.equal((await como('PUT', '/api/me/avatar-pronto', { numero })).statusCode, 200);
  const l = (await como('GET', '/api/me/avatares-anteriores')).json() as Anterior[];
  assert.equal(l.length, 1, 'trocar de coelho para coelho não guarda nada novo');
  assert.equal(l[0].animado, true);
  const voltou = await como('PUT', '/api/me/avatar/anterior', { id: l[0].id });
  assert.equal(voltou.statusCode, 200, voltou.body);
  assert.equal(voltou.json().avatarAnimado, true);
  assert.equal(voltou.json().avatarPronto, null);
  assert.deepEqual((await como('GET', '/api/me/avatares-anteriores')).json(), [], 'o coelho não tem arquivo: não vira anterior');
});

// O AVATAR DE ANTES DO DISCO (os bytes ainda na coluna `data`, sem sha) também vai para o histórico, e abre.
test('o avatar guardado no banco, de antes do disco, também vira anterior', async () => {
  const conta = await criarConta(app, 'antigo');
  const como = comToken(app, conta.token);
  const banco = new DatabaseSync(process.env.DATABASE_PATH!);
  const bytes = Buffer.from(gif.split(',')[1], 'base64');
  banco.prepare('INSERT INTO avatars (user_id, mime, data, sha, bytes) VALUES (?, ?, ?, NULL, NULL)').run(conta.user.id, 'image/gif', bytes);
  banco.prepare('UPDATE users SET avatar_version = 1, avatar_animado = 1 WHERE id = ?').run(conta.user.id);
  banco.close();
  await como('PUT', '/api/me/avatar-pronto', { numero: 5 });
  const l = (await como('GET', '/api/me/avatares-anteriores')).json() as Anterior[];
  assert.equal(l.length, 1);
  assert.equal(l[0].animado, true);
  const arquivo = await app.inject({ method: 'GET', url: `/api/avatares-anteriores/${l[0].id}/${l[0].chave}` });
  assert.equal(arquivo.statusCode, 200);
  assert.deepEqual(arquivo.rawPayload, bytes);
});
