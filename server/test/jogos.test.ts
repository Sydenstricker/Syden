import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { lerServidor, TETO_POR_COMUNIDADE } from '../src/jogos.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

// A primeira conta cria a comunidade inicial e é dona dela; a segunda entra pelo mesmo convite e é
// membro comum. É essa diferença que separa quem mexe na lista de quem só lê.
const dona = comToken(app, (await criarConta(app, 'dona')).token);
const amiga = comToken(app, (await criarConta(app, 'amiga')).token);
const comunidade = (await dona('GET', '/api/communities')).json()[0].id;

const SURVIVAL = { nome: 'O survival do Léo', jogo: 'Minecraft', endereco: 'mc.exemplo.com:25565', observacao: 'Versão 1.21' };

test('o formulário recusa o que não dá para usar, com explicação', () => {
  assert.ok('erro' in lerServidor({ jogo: 'Minecraft', endereco: 'x.y' }), 'sem nome');
  assert.ok('erro' in lerServidor({ nome: 'Casa', endereco: 'x.y' }), 'sem jogo');
  assert.ok('erro' in lerServidor({ nome: 'Casa', jogo: 'Minecraft' }), 'sem endereço');
  assert.ok('erro' in lerServidor({ ...SURVIVAL, nome: 'a'.repeat(61) }), 'nome quilométrico');
  assert.ok('aviso' in lerServidor({}) === false);
  assert.ok('servidor' in lerServidor(SURVIVAL));
});

// O endereço aparece numa tela e é copiável com um clique: quebra de linha no meio dele é o começo de
// todo truque de colar coisa escondida.
test('endereço com caractere de controle é recusado', () => {
  assert.ok('erro' in lerServidor({ ...SURVIVAL, endereco: 'mc.exemplo.com\n\rmaldade' }));
});

test('senha e observação são opcionais e viram null quando vazias', () => {
  const lido = lerServidor({ nome: 'Casa', jogo: 'Valheim', endereco: '1.2.3.4:2456' });
  assert.ok('servidor' in lido);
  assert.equal(lido.servidor.senha, null);
  assert.equal(lido.servidor.observacao, null);
});

test('quem administra a comunidade põe servidor na lista', async () => {
  const criado = await dona('POST', `/api/communities/${comunidade}/jogos`, SURVIVAL);
  assert.equal(criado.statusCode, 200);
  assert.equal(criado.json().nome, SURVIVAL.nome);
  assert.equal(criado.json().communityId, comunidade);
});

test('membro comum lê a lista, mas não mexe nela', async () => {
  const leitura = await amiga('GET', `/api/communities/${comunidade}/jogos`);
  assert.equal(leitura.statusCode, 200);
  assert.equal(leitura.json().length, 1, 'o endereço é para a turma ver, esse é o ponto');

  const tentativa = await amiga('POST', `/api/communities/${comunidade}/jogos`, SURVIVAL);
  assert.equal(tentativa.statusCode, 403);
});

test('quem não é da comunidade não vê a lista', async () => {
  // A amiga é membro da comunidade inicial, e de nenhuma outra. Um endereço de servidor com senha é
  // coisa de dentro: quem não é de lá não lê, nem sabendo o número da comunidade.
  const soDaDona = (await dona('POST', '/api/communities', { name: 'Só minha' })).json();
  const resposta = await amiga('GET', `/api/communities/${soDaDona.id}/jogos`);
  assert.equal(resposta.statusCode, 403);
});

// Sem esta conferência, quem administra a sua comunidade editaria, pelo número, o servidor de qualquer
// outra — inclusive trocando o endereço por um que não é dela.
test('não dá para mexer, pelo número, no servidor de outra comunidade', async () => {
  const outra = (await dona('POST', '/api/communities', { name: 'Outra turma' })).json();
  const laFora = (await dona('POST', `/api/communities/${outra.id}/jogos`, SURVIVAL)).json();

  const tentativa = await dona('PUT', `/api/communities/${comunidade}/jogos/${laFora.id}`, {
    ...SURVIVAL,
    endereco: 'servidor-do-invasor.com',
  });
  assert.equal(tentativa.statusCode, 404);
  assert.equal(
    (await dona('GET', `/api/communities/${outra.id}/jogos`)).json()[0].endereco,
    SURVIVAL.endereco,
    'o endereço da outra comunidade tem que ter ficado intacto',
  );
});

test('editar e apagar funcionam para quem administra', async () => {
  const lista = (await dona('GET', `/api/communities/${comunidade}/jogos`)).json();
  const alvo = lista[0];

  const editado = await dona('PUT', `/api/communities/${comunidade}/jogos/${alvo.id}`, { ...SURVIVAL, jogo: 'Palworld' });
  assert.equal(editado.statusCode, 200);
  assert.equal(editado.json().jogo, 'Palworld');

  assert.equal((await dona('DELETE', `/api/communities/${comunidade}/jogos/${alvo.id}`)).statusCode, 200);
  assert.equal((await dona('GET', `/api/communities/${comunidade}/jogos`)).json().length, 0);
});

test('a lista tem teto: uma comunidade não vira uma tela que ninguém usa', async () => {
  for (let i = 0; i < TETO_POR_COMUNIDADE; i++) {
    const r = await dona('POST', `/api/communities/${comunidade}/jogos`, { ...SURVIVAL, nome: `Servidor ${i}` });
    assert.equal(r.statusCode, 200, `o de número ${i} devia ter entrado`);
  }
  const passou = await dona('POST', `/api/communities/${comunidade}/jogos`, { ...SURVIVAL, nome: 'O que não cabe' });
  assert.equal(passou.statusCode, 409);
});
