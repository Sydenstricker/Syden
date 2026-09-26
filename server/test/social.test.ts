import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ehProvedor, lerPerfil, nomeDisponivel, resumo, sortear } from '../src/social.js';

// Este arquivo não abre banco nem rede: são as regras puras do login social.

test('só google e discord são provedores', () => {
  assert.ok(ehProvedor('google'));
  assert.ok(ehProvedor('discord'));
  assert.equal(ehProvedor('steam'), false, 'Steam usa OpenID 2.0, que é outro protocolo');
  assert.equal(ehProvedor('../../etc/passwd'), false);
  assert.equal(ehProvedor(null), false);
});

test('o resumo do segredo é estável e o segredo é diferente a cada vez', () => {
  const segredo = sortear();
  assert.equal(resumo(segredo), resumo(segredo));
  assert.notEqual(resumo(segredo), resumo(sortear()));
  // 32 bytes em base64url dão 43 letras. A rota exige esse mínimo: segredo curto seria adivinhável.
  assert.equal(segredo.length, 43);
});

test('perfil do Google vira o formato de casa', () => {
  const perfil = lerPerfil('google', { sub: '12345', email: 'Ana@Exemplo.COM', email_verified: true, given_name: 'Ana' });
  assert.equal(perfil?.sub, '12345');
  assert.equal(perfil?.email, 'ana@exemplo.com', 'e-mail entra sempre em minúsculas');
  assert.equal(perfil?.emailVerificado, true);
  assert.equal(perfil?.apelido, 'Ana');
});

// Se "não confirmado" virasse "confirmado" por descuido, a regra que junta contas perderia o sentido.
test('e-mail não confirmado pelo provedor continua não confirmado aqui', () => {
  assert.equal(lerPerfil('google', { sub: '1', email: 'a@b.com', email_verified: false })?.emailVerificado, false);
  assert.equal(lerPerfil('google', { sub: '1', email: 'a@b.com' })?.emailVerificado, false, 'ausente é não confirmado');
  assert.equal(lerPerfil('discord', { id: '1', email: 'a@b.com' })?.emailVerificado, false);
  assert.equal(lerPerfil('discord', { id: '1', email: 'a@b.com', verified: true })?.emailVerificado, true);
});

test('resposta torta do provedor vira null, e não uma conta sem dono', () => {
  assert.equal(lerPerfil('google', null), null);
  assert.equal(lerPerfil('google', {}), null, 'sem sub não dá para saber de quem é');
  assert.equal(lerPerfil('discord', { email: 'a@b.com' }), null);
  assert.equal(lerPerfil('google', 'vixe'), null);
});

test('o nome de usuário sai limpo do que o provedor mandou', () => {
  const livre = () => false;
  assert.equal(nomeDisponivel('João da Silva', livre), 'JoaodaSilva', 'sem acento e sem espaço');
  assert.equal(nomeDisponivel('ana.paula', livre), 'ana.paula');
  assert.equal(nomeDisponivel('日本語', livre), 'pessoa', 'nome que some inteiro na limpeza vira o padrão');
  assert.ok(nomeDisponivel('umnomeabsurdamentecomprido', livre).length <= 16);
});

// Duas Anas no Google não podem se atropelar: a segunda tem que conseguir entrar.
test('nome já tomado ganha número', () => {
  const tomados = new Set(['Ana', 'Ana2']);
  assert.equal(nomeDisponivel('Ana', (n) => tomados.has(n)), 'Ana3');
});

test('nome curto demais não vira nome de usuário inválido', () => {
  // "Jô" vira "J", que tem uma letra só: não serve, e a função tem que resolver sozinha.
  const nome = nomeDisponivel('Jô', () => false);
  assert.ok(nome.length >= 3, 'saiu "' + nome + '", que é curto demais');
});
