import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A primeira conta do Syden nasce administradora; a segunda, não. É nisso que este arquivo se apoia
// para separar quem pode escrever o recado de quem não pode.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona')).token);
const amiga = comToken(app, (await criarConta(app, 'amiga')).token);

const RECADO = { texto: 'Manutenção hoje às 22h, umas duas horas fora do ar.', tom: 'manutencao' };

test('só quem administra escreve o recado', async () => {
  assert.equal((await amiga('PUT', '/api/aviso', RECADO)).statusCode, 403);
  assert.equal((await amiga('GET', '/api/aviso')).statusCode, 403, 'nem ler o rascunho: é texto que ainda não foi publicado');
});

test('sem entrar, ninguém escreve', async () => {
  assert.equal((await app.inject({ method: 'PUT', url: '/api/aviso', payload: RECADO })).statusCode, 401);
});

// É o ponto todo do recado: ele precisa chegar em quem NÃO CONSEGUE ENTRAR.
test('o recado aparece para quem nem conta tem', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/inicio' })).json().aviso, null, 'sem recado, não vem nada');

  assert.equal((await dona('PUT', '/api/aviso', RECADO)).statusCode, 200);

  const inicio = await app.inject({ method: 'GET', url: '/api/inicio' });
  assert.equal(inicio.statusCode, 200);
  assert.equal(inicio.json().aviso.texto, RECADO.texto);
  assert.equal(inicio.json().aviso.tom, 'manutencao');
});

test('recado torto é recusado com uma explicação, e não com erro do servidor', async () => {
  const resposta = await dona('PUT', '/api/aviso', { texto: 'oi', tom: 'manutencao' });
  assert.equal(resposta.statusCode, 400);
  assert.ok(resposta.json().error.length > 0);
});

test('quem administra vê o rascunho para poder editar', async () => {
  const leitura = await dona('GET', '/api/aviso');
  assert.equal(leitura.statusCode, 200);
  assert.equal(leitura.json().aviso.texto, RECADO.texto);
  assert.equal(leitura.json().valendo, true);
});

test('apagar tira o recado da tela de quem nem entrou', async () => {
  assert.equal((await dona('DELETE', '/api/aviso')).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/inicio' })).json().aviso, null);
});

test('escrever e apagar ficam registrados na auditoria', async () => {
  await dona('PUT', '/api/aviso', RECADO);
  await dona('DELETE', '/api/aviso');

  const registro = await dona('GET', '/api/audit');
  assert.equal(registro.statusCode, 200);
  const acoes = JSON.stringify(registro.json());
  assert.ok(acoes.includes('aviso.escrito'), 'escrever o recado é uso de poder e tem que ficar registrado');
  assert.ok(acoes.includes('aviso.apagado'));
});

// A FOTO DO RECADO (04/11/2026): sobe pelo funil das imagens, vai no recado pelo sha, e chega a quem nem conta tem — mas
// a rota pública só abre a foto do recado, e nenhum outro arquivo.
const png = (recheio: number) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600, recheio)]);
const comoDataUrl = (dados: Buffer) => 'data:image/png;base64,' + dados.toString('base64');

test('só quem administra sobe a foto do recado', async () => {
  assert.equal((await amiga('PUT', '/api/aviso/imagem', { image: comoDataUrl(png(7)) })).statusCode, 403);
  assert.equal((await dona('PUT', '/api/aviso/imagem', { image: 'data:image/png;base64,aGVsbG8=' })).statusCode, 400, 'o que não é imagem não sobe');
});

test('a foto vai no recado e chega a quem nem conta tem', async () => {
  const subida = await dona('PUT', '/api/aviso/imagem', { image: comoDataUrl(png(8)) });
  assert.equal(subida.statusCode, 200);
  const { sha } = subida.json().imagem as { sha: string };
  assert.match(sha, /^[0-9a-f]{64}$/);

  // antes de entrar no recado, a foto não é de ninguém: a rota pública não a entrega
  assert.equal((await app.inject({ method: 'GET', url: `/api/aviso/imagem/${sha}` })).statusCode, 404);

  assert.equal((await dona('PUT', '/api/aviso', { ...RECADO, imagem: sha })).statusCode, 200);
  const inicio = (await app.inject({ method: 'GET', url: '/api/inicio' })).json();
  assert.deepEqual(inicio.aviso.imagem, { sha, mime: 'image/png' });

  const foto = await app.inject({ method: 'GET', url: `/api/aviso/imagem/${sha}` });
  assert.equal(foto.statusCode, 200);
  assert.equal(foto.headers['content-type'], 'image/png');
  assert.equal(foto.headers['x-content-type-options'], 'nosniff');
});

test('a rota pública não abre outro arquivo do disco', async () => {
  // um arquivo que existe (o avatar de alguém), mas não é a foto do recado
  const avatar = png(9);
  await amiga('PUT', '/api/me/avatar', { image: comoDataUrl(avatar) });
  const { shaDeArquivo } = await import('../src/arquivos.js');
  assert.equal((await app.inject({ method: 'GET', url: `/api/aviso/imagem/${shaDeArquivo(avatar)}` })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/aviso/imagem/..%2F..%2Fbanco' })).statusCode, 404);
});

test('o recado não aceita foto que não subiu, nem arquivo que não é imagem', async () => {
  assert.equal((await dona('PUT', '/api/aviso', { ...RECADO, imagem: 'a'.repeat(64) })).statusCode, 400);
  assert.equal((await dona('PUT', '/api/aviso', { ...RECADO, imagem: '../x' })).statusCode, 400);
  const { guardarArquivo } = await import('../src/arquivos.js');
  const { sha: pdf } = guardarArquivo(Buffer.from('%PDF-1.4 um anexo qualquer'));
  assert.equal((await dona('PUT', '/api/aviso', { ...RECADO, imagem: pdf })).statusCode, 400);
});

test('tirar a foto deixa o texto, e a foto antiga para de abrir', async () => {
  const { sha } = (await dona('PUT', '/api/aviso/imagem', { image: comoDataUrl(png(10)) })).json().imagem as { sha: string };
  await dona('PUT', '/api/aviso', { ...RECADO, imagem: sha });
  assert.equal((await dona('PUT', '/api/aviso', { ...RECADO, imagem: null })).statusCode, 200);
  const inicio = (await app.inject({ method: 'GET', url: '/api/inicio' })).json();
  assert.equal(inicio.aviso.texto, RECADO.texto);
  assert.equal(inicio.aviso.imagem, null);
  assert.equal((await app.inject({ method: 'GET', url: `/api/aviso/imagem/${sha}` })).statusCode, 404);
});

test('o Shield que reconhece a foto depois a tira do recado', async () => {
  const { sha } = (await dona('PUT', '/api/aviso/imagem', { image: comoDataUrl(png(11)) })).json().imagem as { sha: string };
  await dona('PUT', '/api/aviso', { ...RECADO, imagem: sha });
  const { tirarImagemDoAviso, avisoGuardado } = await import('../src/aviso.js');
  assert.equal(tirarImagemDoAviso(sha), true);
  assert.equal(avisoGuardado()?.imagem, null);
  assert.equal(avisoGuardado()?.texto, RECADO.texto);
});
