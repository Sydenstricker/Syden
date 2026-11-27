/**
 * Os dados no chat (27/11/2026): a rolagem vira mensagem, a secreta só aparece a quem rolou até ser revelada, não se edita,
 * os sorteios passam pela moderação da comunidade e os atalhos são de cada pessoa.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');

await criarConta(app, 'primeira-dado');
const dona = await criarConta(app, 'dona-dado');
const ana = await criarConta(app, 'ana-dado');
const bia = await criarConta(app, 'bia-dado');
const deDona = comToken(app, dona.token);
const deAna = comToken(app, ana.token);
const deBia = comToken(app, bia.token);

const comunidade = (await deDona('POST', '/api/communities', { name: 'Mesa de RPG' })).json();
for (const quem of [deAna, deBia]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await deDona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const texto = canais.find((c) => c.type === 'text')!;

test('rolar vira uma mensagem com a conta inteira e o resumo no texto', async () => {
  const r = await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'dados', expressao: '2d6+3', rotulo: 'ataque' });
  assert.equal(r.statusCode, 200, r.body);
  const m = r.json();
  assert.equal(m.dado.dado.tipo, 'dados');
  assert.equal(m.dado.dado.expressao, '2d6+3');
  assert.equal(m.dado.rotulo, 'ataque');
  assert.equal(m.content, `🎲 2d6+3 = ${m.dado.dado.total} — ataque`);
  assert.ok(m.dado.dado.total >= 5 && m.dado.dado.total <= 15);
  // quem lê a conversa depois vê o mesmo
  const lida = db.listMessages(texto.id, undefined, bia.user.id).find((x) => x.id === m.id)!;
  assert.equal(lida.dado?.dado?.tipo === 'dados' ? lida.dado.dado.total : -1, m.dado.dado.total);
});

test('expressão ruim e tipo desconhecido dão 400 com o motivo', async () => {
  const ruim = await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'dados', expressao: 'abc' });
  assert.equal(ruim.statusCode, 400);
  assert.match(ruim.json().error, /Não entendi/);
  const outro = await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'bruxaria' });
  assert.equal(outro.statusCode, 400);
});

test('quem não está na comunidade não rola nela', async () => {
  const intrusa = await criarConta(app, 'intrusa-dado');
  const r = await comToken(app, intrusa.token)('POST', `/api/channels/${texto.id}/dados`, { tipo: 'moeda' });
  assert.equal(r.statusCode, 404);
});

test('os sorteios: moeda, número, escolha, ordem, times e iniciativa', async () => {
  const pedir = async (corpo: object) => (await deAna('POST', `/api/channels/${texto.id}/dados`, corpo)).json();
  assert.ok(['cara', 'coroa'].includes((await pedir({ tipo: 'moeda' })).dado.dado.resultado));
  const n = await pedir({ tipo: 'numero', min: 1, max: 10 });
  assert.ok(n.dado.dado.valor >= 1 && n.dado.dado.valor <= 10);
  const e = await pedir({ tipo: 'escolha', opcoes: ['pizza', 'sushi'] });
  assert.ok(['pizza', 'sushi'].includes(e.dado.dado.opcoes[e.dado.dado.escolhida]));
  const o = await pedir({ tipo: 'ordem', opcoes: ['a', 'b', 'c'] });
  assert.deepEqual([...o.dado.dado.itens].sort(), ['a', 'b', 'c']);
  const t = await pedir({ tipo: 'times', nomes: ['a', 'b', 'c', 'd'], quantos: 2 });
  assert.equal(t.dado.dado.times.length, 2);
  const i = await pedir({ tipo: 'iniciativa', entradas: [{ nome: 'ana', mod: 2 }, { nome: 'bia', mod: 0 }] });
  assert.equal(i.dado.dado.entradas.length, 2);
  const ruim = await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'escolha', opcoes: ['só uma'] });
  assert.equal(ruim.statusCode, 400);
});

test('a rolagem secreta: a sala não vê o resultado, quem rolou vê, e revelar abre para todos', async () => {
  const r = await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'dados', expressao: '1d20', secreta: true });
  const m = r.json();
  // quem rolou vê o resultado e que ainda está escondido
  assert.equal(m.dado.secreta, true);
  assert.equal(m.dado.oculta, false);
  assert.equal(m.dado.dado.tipo, 'dados');
  assert.equal(m.content, '🎲 Rolagem secreta');
  // a outra pessoa não vê o resultado, nem no texto nem no dado
  const paraBia = db.listMessages(texto.id, undefined, bia.user.id).find((x) => x.id === m.id)!;
  assert.equal(paraBia.dado?.oculta, true);
  assert.equal(paraBia.dado?.dado, null);
  assert.equal(paraBia.content, '🎲 Rolagem secreta');
  // a difusão à sala também não leva o resultado
  assert.equal(db.dadoDaMensagem(m.id, ana.user.id, -1)?.dado, null);
  // só quem rolou revela
  assert.equal((await deBia('POST', `/api/messages/${m.id}/dado/revelar`)).statusCode, 403);
  const revelada = await deAna('POST', `/api/messages/${m.id}/dado/revelar`);
  assert.equal(revelada.statusCode, 200, revelada.body);
  assert.equal(revelada.json().content, `🎲 1d20 = ${m.dado.dado.total}`);
  const depois = db.listMessages(texto.id, undefined, bia.user.id).find((x) => x.id === m.id)!;
  assert.equal(depois.dado?.oculta, false);
  assert.equal(depois.dado?.revelada, true);
  assert.equal(depois.dado?.dado?.tipo === 'dados' ? depois.dado.dado.total : -1, m.dado.dado.total);
  // não revela duas vezes
  assert.equal((await deAna('POST', `/api/messages/${m.id}/dado/revelar`)).statusCode, 400);
});

test('a mensagem de dado não se edita', async () => {
  const m = (await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'dados', expressao: '1d6' })).json();
  const r = await deAna('PATCH', `/api/messages/${m.id}`, { content: '🎲 1d6 = 6' });
  assert.equal(r.statusCode, 400);
  assert.equal(db.findMessageContent(m.id), m.content);
});

test('a moderação da comunidade vale para o que se escreve num sorteio', async () => {
  const corpo = { tipo: 'escolha', opcoes: ['sim', 'não'], rotulo: 'palavra-proibida-xyz' };
  assert.equal((await deAna('POST', `/api/channels/${texto.id}/dados`, corpo)).statusCode, 200);
  const regras = await deDona('PUT', `/api/communities/${comunidade.id}/moderacao`, { palavras: ['palavra-proibida-xyz'], links: false, flood: false });
  assert.equal(regras.statusCode, 200, regras.body);
  // no rótulo e nas opções
  assert.equal((await deAna('POST', `/api/channels/${texto.id}/dados`, corpo)).statusCode, 400);
  assert.equal((await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'escolha', opcoes: ['palavra-proibida-xyz', 'b'] })).statusCode, 400);
  // quem administra não passa pela moderação, como nas mensagens
  assert.equal((await deDona('POST', `/api/channels/${texto.id}/dados`, corpo)).statusCode, 200);
  await deDona('PUT', `/api/communities/${comunidade.id}/moderacao`, { palavras: [], links: false, flood: false });
});

test('os atalhos são de cada pessoa, validados e com teto', async () => {
  const novo = await deAna('POST', '/api/me/dados-atalhos', { nome: 'Espada', expressao: '1d20+5' });
  assert.equal(novo.statusCode, 200, novo.body);
  assert.equal((await deAna('POST', '/api/me/dados-atalhos', { nome: 'Quebrado', expressao: 'xx' })).statusCode, 400);
  assert.equal((await deAna('POST', '/api/me/dados-atalhos', { nome: '', expressao: '1d6' })).statusCode, 400);
  assert.equal(((await deAna('GET', '/api/me/dados-atalhos')).json() as { atalhos: unknown[] }).atalhos.length, 1);
  assert.equal(((await deBia('GET', '/api/me/dados-atalhos')).json() as { atalhos: unknown[] }).atalhos.length, 0);
  // a outra pessoa não apaga o atalho de ninguém
  assert.equal((await deBia('DELETE', `/api/me/dados-atalhos/${novo.json().id}`)).statusCode, 404);
  assert.equal((await deAna('DELETE', `/api/me/dados-atalhos/${novo.json().id}`)).statusCode, 200);
  for (let i = 0; i < db.MAXIMO_DE_ATALHOS_DE_DADOS; i++) {
    assert.equal((await deAna('POST', '/api/me/dados-atalhos', { nome: `n${i}`, expressao: '1d6' })).statusCode, 200);
  }
  assert.equal((await deAna('POST', '/api/me/dados-atalhos', { nome: 'a mais', expressao: '1d6' })).statusCode, 400);
});

test('o "Levar seus dados" inclui o que a pessoa rolou', () => {
  const minhas = db.rolagensDe(ana.user.id);
  assert.ok(minhas.length >= 5);
  assert.ok(minhas.some((r) => r.secreta));
  assert.equal(db.rolagensDe(bia.user.id).length, 0);
});

test('apagar a mensagem leva a rolagem junto', async () => {
  const m = (await deAna('POST', `/api/channels/${texto.id}/dados`, { tipo: 'moeda' })).json();
  assert.equal((await deAna('DELETE', `/api/messages/${m.id}`)).statusCode, 200);
  assert.equal(db.dadoDaMensagem(m.id, ana.user.id, ana.user.id), null);
});

test('o limite de 20 sorteios por minuto', async () => {
  const cris = await criarConta(app, 'cris-dado');
  const deCris = comToken(app, cris.token);
  await deCris('POST', '/api/communities/join', { code: comunidade.inviteCode });
  let ultimo = 200;
  for (let i = 0; i < 25; i++) ultimo = (await deCris('POST', `/api/channels/${texto.id}/dados`, { tipo: 'moeda' })).statusCode;
  assert.equal(ultimo, 429);
});
