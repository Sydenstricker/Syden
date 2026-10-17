import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { CONVITE, comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A PROTEÇÃO DE CRIANÇAS E ADOLESCENTES (ECA Digital, 17/10/2026; ver protecao.ts e "Adolescentes no Syden" no CLAUDE.md).

let app: FastifyInstance;
let fechar: () => Promise<void>;
let db: typeof import('../src/db.js');

/** Uma data de nascimento de quem faz `anos` hoje (com folga de um mês, para não cair no dia do aniversário). */
const comAnos = (anos: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};

let dono: ReturnType<typeof comToken>;
let adulto: { token: string; user: { id: number; username: string } };
let menor: { token: string; user: { id: number; username: string } };
let comoAdulto: ReturnType<typeof comToken>;
let comoMenor: ReturnType<typeof comToken>;
let convite: string;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  db = await import('../src/db.js');
  dono = comToken(app, (await criarConta(app, 'dona')).token); // a primeira conta cuida do Syden
  adulto = await criarConta(app, 'adulto');
  menor = await criarConta(app, 'menor', 'segredo123', comAnos(14));
  comoAdulto = comToken(app, adulto.token);
  comoMenor = comToken(app, menor.token);
  // os dois na mesma comunidade: sem a regra, isso bastaria para conversar no particular
  const comunidade = (await dono('POST', '/api/communities', { name: 'Turma' })).json();
  convite = comunidade.inviteCode;
  await comoAdulto('POST', '/api/communities/join', { code: convite });
  await comoMenor('POST', '/api/communities/join', { code: convite });
});
after(() => fechar());

describe('a idade', () => {
  it('menos de 13 não cria conta', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'crianca', password: 'segredo123', email: 'crianca@exemplo.teste', inviteCode: CONVITE, nascimento: comAnos(11) },
    });
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().idadeMinima, 13);
  });

  it('a faixa vai no /api/me, e a data em si não', async () => {
    const eu = (await comoMenor('GET', '/api/me')).json();
    assert.equal(eu.faixa, '13-15');
    assert.equal(eu.barreira, null, 'ainda dentro dos 7 dias para ligar o responsável');
    assert.equal(eu.nascimento, undefined);
  });

  it('conta sem a data (Google, Steam, antiga) fica barrada até informar, e informa uma vez só', async () => {
    const sem = db.createUserSemSenha('semdata', null);
    const { signSession } = await import('../src/auth.js');
    const como = comToken(app, await signSession(sem, db.sessionVersion(sem.id)));
    const barrada = await como('GET', '/api/communities');
    assert.equal(barrada.statusCode, 403);
    assert.equal(barrada.json().barreira.tipo, 'nascimento');
    assert.equal((await como('GET', '/api/me')).json().barreira.tipo, 'nascimento', 'o /api/me responde, com a barreira');
    assert.equal((await como('PUT', '/api/me/nascimento', { nascimento: '2099-01-01' })).statusCode, 400, 'no futuro, não');
    const feita = (await como('PUT', '/api/me/nascimento', { nascimento: comAnos(30) })).json();
    assert.equal(feita.faixa, 'adulto');
    assert.equal(feita.barreira, null);
    assert.equal((await como('GET', '/api/communities')).statusCode, 200);
    assert.equal((await como('PUT', '/api/me/nascimento', { nascimento: comAnos(40) })).statusCode, 409, 'trocar a data não pode');
  });

  it('quem informa menos de 13 fica suspenso, e pode recorrer', async () => {
    const sem = db.createUserSemSenha('pequeno', null);
    const { signSession } = await import('../src/auth.js');
    const como = comToken(app, await signSession(sem, db.sessionVersion(sem.id)));
    const r = (await como('PUT', '/api/me/nascimento', { nascimento: comAnos(10) })).json();
    assert.equal(r.barreira.tipo, 'suspensa');
    assert.equal((await como('POST', '/api/me/recurso', { texto: 'curto' })).statusCode, 400);
    assert.equal((await como('POST', '/api/me/recurso', { texto: 'Errei o ano, tenho 30 anos.' })).statusCode, 200);
    const barrados = (await dono('GET', '/api/admin/barrados')).json().barrados;
    assert.ok(barrados.some((b: { username: string; recurso: string }) => b.username === 'pequeno' && b.recurso.includes('30 anos')));
    assert.equal((await dono('POST', '/api/admin/levantar-suspensao', { userId: sem.id })).statusCode, 200);
    assert.equal((await como('GET', '/api/me')).json().barreira, null);
  });

  it('de 13 a 15, passados 7 dias sem responsável, a conta para até ligar', async () => {
    const { barreiraDe } = await import('../src/protecao.js');
    const daqui8dias = new Date(Date.now() + 8 * 86_400_000);
    assert.equal(barreiraDe(menor.user.id, daqui8dias)?.tipo, 'responsavel');
    assert.equal(barreiraDe(menor.user.id), null);
  });
});

describe('o fechado por padrão para menor', () => {
  it('conversa privada só com amigos: comunidade em comum não basta', async () => {
    const r = await comoAdulto('POST', '/api/direct', { userIds: [menor.user.id] });
    assert.equal(r.statusCode, 403);
    // a amizade aceita abre
    await comoAdulto('POST', '/api/amigos', { username: 'menor' });
    await comoMenor('POST', `/api/amigos/${adulto.user.id}/aceitar`);
    assert.equal((await comoAdulto('POST', '/api/direct', { userIds: [menor.user.id] })).statusCode, 200);
  });

  it('a prévia das transmissões fica fechada para o menor', async () => {
    const canais = (await comoMenor('GET', '/api/communities')).json();
    const comunidadeId = (canais.communities ?? canais).find((c: { name: string }) => c.name === 'Turma').id;
    const voz = (await dono('POST', `/api/communities/${comunidadeId}/channels`, { name: 'sala', type: 'voice' })).json();
    assert.equal((await comoMenor('POST', `/api/channels/${voz.id}/peek-token`)).statusCode, 403);
  });

  it('de 13 a 15 a própria pessoa não abre as regras; de 16 e 17, abre', async () => {
    assert.equal((await comoMenor('PUT', '/api/me/regras', { dmSoAmigos: false })).statusCode, 403);
    const mais = await criarConta(app, 'dezesseis', 'segredo123', comAnos(16));
    const r = await comToken(app, mais.token)('PUT', '/api/me/regras', { assistirSoAmigos: false });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().regras.assistirSoAmigos, false);
  });
});

describe('o responsável', () => {
  let codigo: string;

  it('o menor pede o código; adulto nenhum pede', async () => {
    assert.equal((await comoAdulto('POST', '/api/me/responsavel/codigo')).statusCode, 409);
    const r = (await comoMenor('POST', '/api/me/responsavel/codigo')).json();
    assert.match(r.codigo, /^[A-Z2-9]{8}$/);
    codigo = r.codigo;
  });

  it('liga só com a declaração, e só adulto liga', async () => {
    assert.equal((await comoAdulto('POST', '/api/responsavel/ligar', { codigo })).statusCode, 400, 'sem declarar');
    const outroMenor = await criarConta(app, 'outromenor', 'segredo123', comAnos(15));
    assert.equal((await comToken(app, outroMenor.token)('POST', '/api/responsavel/ligar', { codigo, declaro: true })).statusCode, 403);
    const painel = await comoAdulto('POST', '/api/responsavel/ligar', { codigo: codigo.toLowerCase(), declaro: true });
    assert.equal(painel.statusCode, 200);
    assert.equal(painel.json().username, 'menor');
    assert.equal((await comoMenor('GET', '/api/me/protecao')).json().responsavel.username, 'adulto');
  });

  it('vê os adultos com quem o menor fala e o tempo de uso, e mexe nas regras', async () => {
    const { menores } = (await comoAdulto('GET', '/api/responsavel/menores')).json();
    assert.equal(menores.length, 1);
    assert.ok(menores[0].adultos.some((a: { username: string; amigo: boolean }) => a.username === 'adulto' && a.amigo));
    const r = await comoAdulto('PUT', `/api/responsavel/menores/${menor.user.id}/regras`, { limiteMinutos: 5 });
    assert.equal(r.statusCode, 400, 'menos de 15 minutos não');
    const ok = await comoAdulto('PUT', `/api/responsavel/menores/${menor.user.id}/regras`, { limiteMinutos: 60 });
    assert.equal(ok.json().regras.limiteMinutos, 60);
    // quem não é o responsável não vê nem mexe
    assert.equal((await dono('PUT', `/api/responsavel/menores/${menor.user.id}/regras`, { limiteMinutos: null })).statusCode, 404);
  });

  it('o limite do dia esgotado barra a conta até a meia-noite', async () => {
    const { hojeEmBrasilia } = await import('../src/protecao.js');
    db.somarUso(menor.user.id, hojeEmBrasilia(), 60 * 60);
    const r = await comoMenor('GET', '/api/communities');
    assert.equal(r.statusCode, 403);
    assert.equal(r.json().barreira.tipo, 'tempo');
    await comoAdulto('PUT', `/api/responsavel/menores/${menor.user.id}/regras`, { limiteMinutos: null });
    assert.equal((await comoMenor('GET', '/api/communities')).statusCode, 200);
  });
});

describe('o banimento', () => {
  it('só quem cuida do Syden bane, sempre com o motivo; quem foi banido lê o motivo e recorre', async () => {
    const alvo = await criarConta(app, 'encrenca');
    const como = comToken(app, alvo.token);
    assert.equal((await comoAdulto('POST', '/api/admin/banir', { userId: alvo.user.id, motivo: 'spam' })).statusCode, 403);
    assert.equal((await dono('POST', '/api/admin/banir', { userId: alvo.user.id, motivo: '' })).statusCode, 400);
    assert.equal((await dono('POST', '/api/admin/banir', { userId: alvo.user.id, motivo: 'ameaças a outra pessoa' })).statusCode, 200);
    const barrada = await como('GET', '/api/communities');
    assert.equal(barrada.json().barreira.tipo, 'banido');
    assert.equal(barrada.json().barreira.motivo, 'ameaças a outra pessoa');
    assert.equal((await como('GET', '/api/me/dados')).statusCode, 200, 'levar os dados continua sendo direito');
    assert.equal((await como('POST', '/api/me/recurso', { texto: 'Foi um mal-entendido, posso explicar.' })).statusCode, 200);
    assert.equal((await dono('POST', '/api/admin/desbanir', { userId: alvo.user.id })).statusCode, 200);
    assert.equal((await como('GET', '/api/communities')).statusCode, 200);
    const auditoria = (await dono('GET', '/api/audit')).json();
    assert.ok(auditoria.some((l: { action: string }) => l.action === 'conta.banida'));
  });

  it('a conta banida continua existindo: o mesmo e-mail não cria outra', async () => {
    const alvo = await criarConta(app, 'reincidente');
    await dono('POST', '/api/admin/banir', { userId: alvo.user.id, motivo: 'reincidência' });
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'reincidente2', password: 'segredo123', email: 'reincidente@exemplo.teste', inviteCode: CONVITE, nascimento: comAnos(30) },
    });
    assert.equal(r.statusCode, 409);
  });
});
