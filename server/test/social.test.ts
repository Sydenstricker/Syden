import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ehOAuth, ehProvedor, emailDoGithub, lerPerfil, nomeDisponivel, resumo, sortear, steamIdDe } from '../src/social.js';

// Este arquivo não abre banco nem rede: são as regras puras do login social.

test('são quatro provedores, e só eles', () => {
  for (const bom of ['google', 'discord', 'github', 'steam']) assert.ok(ehProvedor(bom), bom);
  assert.equal(ehProvedor('facebook'), false);
  assert.equal(ehProvedor('../../etc/passwd'), false, 'o nome vira caminho de URL: não pode aceitar qualquer texto');
  assert.equal(ehProvedor(null), false);
});

// A Steam segue outro caminho no código inteiro; confundir os dois daria uma chamada de OAuth para
// quem não fala OAuth, e um erro sem explicação na cara de quem só queria entrar.
test('a Steam não é OAuth, e os outros três são', () => {
  assert.equal(ehOAuth('steam'), false);
  for (const oauth of ['google', 'discord', 'github'] as const) assert.ok(ehOAuth(oauth), oauth);
});

test('perfil do GitHub vira o formato de casa, com o id virando texto', () => {
  const perfil = lerPerfil('github', { id: 98765, login: 'sydenstricker', email: 'a@b.com' });
  assert.equal(perfil?.sub, '98765', 'o GitHub manda número; guardar ora número ora texto faria duas contas');
  assert.equal(perfil?.apelido, 'sydenstricker');
  assert.equal(perfil?.emailVerificado, false, "o e-mail do perfil do GitHub não vem com selo; quem confirma é a lista");
});

test('do GitHub só serve o e-mail que é principal E confirmado', () => {
  assert.deepEqual(
    emailDoGithub([{ email: 'antigo@b.com', primary: false, verified: true }, { email: 'Novo@B.com', primary: true, verified: true }]),
    { email: 'novo@b.com', emailVerificado: true },
  );
  assert.equal(emailDoGithub([{ email: 'a@b.com', primary: true, verified: false }]), null, 'não confirmado não junta contas');
  assert.equal(emailDoGithub([]), null);
  assert.equal(emailDoGithub('nada disso'), null);
});

test('perfil da Steam nunca traz e-mail, porque o protocolo dela não tem esse campo', () => {
  const perfil = lerPerfil('steam', { steamid: '76561198000000000', personaname: 'Fulano' });
  assert.equal(perfil?.sub, '76561198000000000');
  assert.equal(perfil?.apelido, 'Fulano');
  assert.equal(perfil?.email, null);
  assert.equal(perfil?.emailVerificado, false);
});

// O número da conta chega escrito na URL. Aceitar qualquer formato seria aceitar crachá feito em casa.
test('só um endereço de Steam de verdade vira número de conta', () => {
  assert.equal(steamIdDe('https://steamcommunity.com/openid/id/76561198000000000'), '76561198000000000');
  assert.equal(steamIdDe('https://steamcommunity.com.br/openid/id/76561198000000000'), null, 'domínio parecido não serve');
  assert.equal(steamIdDe('https://steamcommunity.com/openid/id/123'), null, 'o número tem 17 dígitos');
  assert.equal(steamIdDe('https://steamcommunity.com/openid/id/7656119800000000x'), null);
  assert.equal(steamIdDe(undefined), null);
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
