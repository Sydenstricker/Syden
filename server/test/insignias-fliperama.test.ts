/**
 * O CATÁLOGO DAS INSÍGNIAS e as insígnias do FLIPERAMA (19/11/2026). As do fliperama contam mini-games DIFERENTES
 * jogados na sala com 2 ou mais pessoas (a regra das conquistas da turma: gente junta). O Solo e a partida de uma pessoa só
 * não contam; os robôs nunca entram em quem jogou. Cada insígnia sai uma vez só.
 */
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
await app.listen({ port: 0, host: '127.0.0.1' });
const endereco = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
const sockets: Socket[] = [];
after(async () => {
  for (const s of sockets) s.disconnect();
  const { _partidas } = await import('../src/minijogos-routes.js');
  for (const p of _partidas.values()) if (p.relogio) clearTimeout(p.relogio);
  await fechar();
});

const db = await import('../src/db.js');
const { conferirFliperama, DEGRAUS_DO_FLIPERAMA } = await import('../src/presentes.js');

// As 25 primeiras contas ganham a dos primeiros: não atrapalha, mas a primeira administra o Syden e fica de fora.
await criarConta(app, 'admin-flip');
const ana = await criarConta(app, 'ana-flip');
const bia = await criarConta(app, 'bia-flip');
const caio = await criarConta(app, 'caio-flip');
const comoAna = comToken(app, ana.token);
const comunidade = (await comoAna('POST', '/api/communities', { name: 'Fliperama' })).json();
for (const c of [bia, caio]) await comToken(app, c.token)('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await comoAna('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;

const JOGOS = ['stop', 'desenho', 'lobisomem', 'gomoku', 'mancala', 'damas', 'naval', 'domino', 'truco', 'tabuleiro', 'festa', 'golfe', 'caca', 'nave', 'briga', 'blocos'];
const temDoFliperama = (userId: number) =>
  db.itensDaPessoa(userId).map((i) => i.code).filter((c) => c.startsWith('fliperama-')).sort();

describe('as insígnias do fliperama', () => {
  it('a partida de uma pessoa só, o Solo e a corrida contra o relógio não contam', () => {
    for (const jogo of JOGOS.slice(0, 6)) db.registrarPartida(jogo, comunidade.id, sala.id, caio.user.id, [caio.user.id]);
    db.registrarCorrida(caio.user.id, 60_000);
    db.registrarPulo(caio.user.id, 30_000);
    assert.equal(db.jogosDiferentesComGente(caio.user.id), 0);
    assert.deepEqual(conferirFliperama(caio.user.id), []);
  });

  it('a partida do Solo, contra o computador, nem vira partida da sala', async () => {
    const comoCaio = comToken(app, caio.token);
    for (const jogo of ['gomoku', 'damas', 'tamanho']) {
      assert.equal((await comoCaio('POST', '/api/minijogo-solo', { jogo })).statusCode, 200, jogo);
      await comoCaio('DELETE', '/api/minijogo-solo');
    }
    assert.equal(db.jogosDiferentesComGente(caio.user.id), 0);
  });

  it('conta jogos DIFERENTES com 2 ou mais pessoas, e repetir o mesmo jogo não soma', () => {
    for (let i = 0; i < 6; i++) db.registrarPartida('stop', comunidade.id, sala.id, ana.user.id, [ana.user.id, bia.user.id]);
    assert.equal(db.jogosDiferentesComGente(ana.user.id), 1);
    for (const jogo of JOGOS.slice(1, 4)) db.registrarPartida(jogo, comunidade.id, sala.id, ana.user.id, [ana.user.id, bia.user.id]);
    assert.equal(db.jogosDiferentesComGente(ana.user.id), 4);
    assert.deepEqual(conferirFliperama(ana.user.id), [], 'com 4, ainda nada');
  });

  it('a Arena e os Bichos são o mesmo jogo da estante', () => {
    db.registrarPartida('bichos', comunidade.id, sala.id, bia.user.id, [bia.user.id, caio.user.id]);
    db.registrarPartida('arena', comunidade.id, sala.id, bia.user.id, [bia.user.id, caio.user.id]);
    assert.equal(db.jogosDiferentesComGente(caio.user.id), 1);
  });

  it('entrega no quinto jogo diferente, e uma vez só', () => {
    db.registrarPartida(JOGOS[4], comunidade.id, sala.id, ana.user.id, [ana.user.id, bia.user.id]);
    assert.deepEqual(conferirFliperama(ana.user.id), ['fliperama-5']);
    assert.deepEqual(conferirFliperama(ana.user.id), [], 'conferir de novo não entrega de novo');
    assert.deepEqual(temDoFliperama(ana.user.id), ['fliperama-5']);
  });

  it('chega a quem jogou antes de as insígnias existirem, ao entrar', async () => {
    // a Bia jogou os mesmos 5 com a Ana, mais os Bichos: 6 jogos, e nunca conferiu
    assert.deepEqual(temDoFliperama(bia.user.id), []);
    const entrada = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: bia.user.username, password: bia.password } });
    assert.equal(entrada.statusCode, 200);
    assert.deepEqual(temDoFliperama(bia.user.id), ['fliperama-5']);
    const fila = (await comToken(app, bia.token)('GET', '/api/me/itens/novidades')).json() as { code: string }[];
    assert.ok(fila.some((i) => i.code === 'fliperama-5'), 'entra na fila da tela de destaque');
  });

  it('os degraus são 5, 15 e 30, e o de 15 chega sozinho com 15', () => {
    assert.deepEqual(DEGRAUS_DO_FLIPERAMA.map((d) => d.jogos), [5, 15, 30]);
    for (const jogo of JOGOS.slice(5, 15)) db.registrarPartida(jogo, comunidade.id, sala.id, ana.user.id, [ana.user.id, bia.user.id]);
    assert.equal(db.jogosDiferentesComGente(ana.user.id), 15);
    assert.deepEqual(conferirFliperama(ana.user.id), ['fliperama-15']);
  });

  it('chega no fim de uma partida de verdade na sala, pelo socket', async () => {
    // O Caio ainda não tem nenhum jogo com gente; põe 4 e joga o quinto de verdade, com a Bia, na sala de voz.
    for (const jogo of JOGOS.slice(10, 14)) db.registrarPartida(jogo, comunidade.id, sala.id, caio.user.id, [caio.user.id, bia.user.id]);
    const ligar = (token: string) =>
      new Promise<Socket>((ok) => {
        const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
        sockets.push(s);
        s.on('connect', () => ok(s));
      });
    const entrarNaVoz = (s: Socket) => new Promise((ok) => s.emit('voice:join', { channelId: sala.id }, ok));
    const doCaio = await ligar(caio.token);
    await entrarNaVoz(doCaio);
    await entrarNaVoz(await ligar(bia.token));
    const chegou = new Promise<{ codigos: string[] }>((ok) => doCaio.on('itens:novos', ok));

    const rota = `/api/channels/${sala.id}/minijogo`;
    const comoCaio = comToken(app, caio.token);
    assert.equal((await comoCaio('POST', rota, { jogo: 'tamanho' })).statusCode, 200);
    assert.deepEqual(temDoFliperama(caio.user.id), [], 'nada durante a partida');
    assert.equal((await comoCaio('DELETE', rota)).statusCode, 200);
    assert.deepEqual((await chegou).codigos, ['fliperama-5']);
  });
});

describe('o catálogo das insígnias', () => {
  it('devolve todas as que existem, com o que a pessoa tem', async () => {
    const resposta = await comToken(app, ana.token)('GET', '/api/me/insignias');
    assert.equal(resposta.statusCode, 200);
    const { insignias, limite, vitrine } = resposta.json() as {
      insignias: { codigo: string; tenho: boolean; desde: string | null }[];
      limite: number;
      vitrine: string[];
    };
    const codigos = insignias.map((i) => i.codigo);
    for (const c of ['primeiros-25', 'ideia-acolhida', 'codigo-secreto', 'fliperama-5', 'fliperama-15', 'fliperama-30']) {
      assert.ok(codigos.includes(c), `o catálogo traz ${c}`);
    }
    const de = (c: string) => insignias.find((i) => i.codigo === c)!;
    assert.equal(de('fliperama-5').tenho, true);
    assert.ok(de('fliperama-5').desde);
    assert.equal(de('fliperama-30').tenho, false);
    assert.equal(de('fliperama-30').desde, null);
    assert.equal(de('codigo-secreto').tenho, false);
    assert.equal(limite, 5);
    assert.ok(Array.isArray(vitrine));
    // nada de contagem nem progresso: só o que a pessoa tem
    assert.deepEqual(Object.keys(de('fliperama-30')).sort(), ['codigo', 'desde', 'tenho']);
  });

  it('a do fliperama vai à vitrine como as outras', async () => {
    const como = comToken(app, ana.token);
    const r = await como('PUT', '/api/me/vitrine', { codigos: ['fliperama-15', 'fliperama-5'] });
    assert.deepEqual(r.json().vitrine, ['fliperama-15', 'fliperama-5'], 'na ordem escolhida');
    const r2 = await como('PUT', '/api/me/vitrine', { codigos: ['fliperama-30'] });
    assert.deepEqual(r2.json().vitrine, [], 'a que não tem não entra');
  });
});
