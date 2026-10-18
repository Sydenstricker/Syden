/**
 * O salão de cada comunidade (salao-routes.ts): a arrumação do salão isométrico, da turma.
 *
 *   1. Todo membro lê o salão igual; quem não é membro não descobre nem que a comunidade existe.
 *   2. Só quem administra guarda; membro comum recebe 403, e o salão não muda.
 *   3. O que entra é validado como o quarto (é desenhado na tela de todo membro).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona-salao')).token);
const membro = comToken(app, (await criarConta(app, 'membro-salao')).token);
const fora = comToken(app, (await criarConta(app, 'fora-salao')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã do salão' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const url = `/api/communities/${comunidade.id}/salao`;

const SALAO = {
  // o salão é 16 × 16: casas além da 8 valem aqui (e não no quarto)
  moveis: { sofa: { c: [12.5, 3], lado: 1 }, tv: { c: [0.5, 3], lado: 0 }, banqueta: { c: [6, 15.5], lado: 0 } },
  janela: { tipo: 'redonda', parede: 'esquerda', v: 1 },
  parede: { pintura: { parede: 'direita', v: 0, h: 0 } },
  emCima: { o1: { tipo: 'refrigerante', em: 'balcao', s: 0.3, t: 0.5, lado: 0 } },
};

test('ninguém mexeu: o salão de fábrica, e o membro sabe se pode arrumar', async () => {
  const d = (await dona('GET', url)).json(), m = (await membro('GET', url)).json();
  assert.equal(d.arrumacao, null);
  assert.equal(d.podeEditar, true);
  assert.equal(m.podeEditar, false);
});

test('quem administra guarda, e TODO MEMBRO vê igual', async () => {
  assert.equal((await dona('PUT', url, SALAO)).statusCode, 200);
  assert.deepEqual((await membro('GET', url)).json().arrumacao, SALAO);
});

test('membro comum NÃO arruma, e o salão fica como estava', async () => {
  const r = await membro('PUT', url, { moveis: {} });
  assert.equal(r.statusCode, 403);
  assert.deepEqual((await dona('GET', url)).json().arrumacao, SALAO);
});

test('quem não participa: 404 para ler e para guardar', async () => {
  assert.equal((await fora('GET', url)).statusCode, 404);
  assert.equal((await fora('PUT', url, SALAO)).statusCode, 404);
  assert.equal((await fora('GET', '/api/communities/999999/salao')).statusCode, 404);
});

test('o que quebraria o salão é recusado', async () => {
  assert.equal((await dona('PUT', url, { moveis: { sofa: { c: [17, 1], lado: 0 } } })).statusCode, 400);
  assert.deepEqual((await membro('GET', url)).json().arrumacao, SALAO);
});

// O CARGO QUE ARRUMA O SALÃO (decisão dele, 18/10/2026): o único poder que um cargo dá. E quem administra desfaz.
test('membro com um cargo marcado "Pode arrumar o salão" arruma; sem a marca, não', async () => {
  const membroId = ((await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; username: string }[]).find(
    (m) => m.username === 'membro-salao',
  )!.id;
  const cargo = (await dona('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Decoração', cor: '#88aa66' })).json();
  assert.equal(cargo.arrumaSalao, false);
  await dona('PUT', `/api/communities/${comunidade.id}/members/${membroId}/cargos/${cargo.id}`);
  // o cargo sozinho é identidade: ainda não arruma
  assert.equal((await membro('GET', url)).json().podeEditar, false);
  assert.equal((await membro('PUT', url, { moveis: {} })).statusCode, 403);
  // só quem administra dá a marca
  assert.equal((await membro('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, { arrumaSalao: true })).statusCode, 403);
  assert.equal((await dona('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, { arrumaSalao: true })).json().arrumaSalao, true);
  assert.equal((await membro('GET', url)).json().podeEditar, true);
  const DELE = { ...SALAO, canalDaTv: 'futebol', desligados: ['jukebox'] };
  assert.equal((await membro('PUT', url, DELE)).statusCode, 200);
  const visto = (await dona('GET', url)).json();
  assert.deepEqual(visto.arrumacao, DELE);
  assert.equal(visto.porUltimo.nome, 'membro-salao');
  // e não ganhou nada além do salão: desfazer é de quem administra
  assert.equal((await membro('POST', `${url}/desfazer`)).statusCode, 403);
  assert.equal((await membro('GET', url)).json().podeDesfazer, false);
});

test('quem administra desfaz o que a última pessoa fez (todas as mudanças dela, não só a última)', async () => {
  assert.equal((await dona('GET', url)).json().podeDesfazer, true);
  // mais uma mudança da mesma pessoa: o ponto de volta continua o de antes dela
  assert.equal((await membro('PUT', url, { ...SALAO, canalDaTv: 'arena' })).statusCode, 200);
  assert.equal((await dona('POST', `${url}/desfazer`)).statusCode, 200);
  assert.deepEqual((await membro('GET', url)).json().arrumacao, SALAO);
  // desfeito, não há mais o que desfazer
  assert.equal((await dona('GET', url)).json().podeDesfazer, false);
  assert.equal((await dona('POST', `${url}/desfazer`)).statusCode, 409);
});

test('o canal e os desligados são validados', async () => {
  assert.equal((await dona('PUT', url, { ...SALAO, canalDaTv: 'Canal <b>' })).statusCode, 400);
  assert.equal((await dona('PUT', url, { ...SALAO, desligados: [1] })).statusCode, 400);
});
