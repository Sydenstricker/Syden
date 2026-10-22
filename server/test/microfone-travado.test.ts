/**
 * O microfone TRAVADO pela moderação (21/10/2026), como o "silenciar no servidor" do Discord: quem administra trava, a
 * pessoa não consegue ligar o próprio microfone, e só quem administra solta. Soltar NÃO liga o microfone de ninguém.
 *
 * Como em palco.test.ts, o que se mede é o TOKEN: é ele que o LiveKit confere, e um cliente modificado não o contorna.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let dona: ReturnType<typeof comToken>;
let ze: ReturnType<typeof comToken>;
let zeId: number;
let salaId: number;
let comunidadeId: number;

function permissoes(jwt: string) {
  const meio = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return meio.video as { canPublish?: boolean; canPublishSources?: string[] };
}

async function tokenDeVoz(quem: ReturnType<typeof comToken>) {
  const resposta = await quem('POST', `/api/channels/${salaId}/voice-token`);
  assert.equal(resposta.statusCode, 200, 'não consegui o token de voz');
  return { ...permissoes(resposta.json().token), travado: resposta.json().microfoneTravado as boolean };
}

/** Sem lista, ou lista vazia, o LiveKit deixa publicar tudo. */
const podeMicrofone = (p: { canPublish?: boolean; canPublishSources?: string[] }) =>
  p.canPublish === true && (!p.canPublishSources?.length || p.canPublishSources.some((f) => /microphone/i.test(String(f))));

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const aDona = await criarConta(app, 'dona');
  const oZe = await criarConta(app, 'ze');
  dona = comToken(app, aDona.token);
  ze = comToken(app, oZe.token);
  zeId = oZe.user.id;
  const comunidade = (await dona('POST', '/api/communities', { name: 'Turma' })).json();
  comunidadeId = comunidade.id;
  await ze('POST', '/api/communities/join', { code: comunidade.inviteCode });
  salaId = (await dona('POST', `/api/communities/${comunidade.id}/channels`, { name: 'geral', type: 'voice' })).json().id;
});

after(async () => fechar());

describe('microfone travado pela moderação', () => {
  it('sem trava, fala normalmente', async () => {
    const dele = await tokenDeVoz(ze);
    assert.ok(podeMicrofone(dele));
    assert.equal(dele.travado, false);
  });

  it('quem não administra não trava ninguém', async () => {
    const r = await ze('POST', `/api/channels/${salaId}/mute`, { userId: (await dona('GET', '/api/me')).json().id, muted: true });
    assert.equal(r.statusCode, 403);
  });

  it('travado, o token não deixa publicar o microfone — e ainda deixa a tela e a câmera', async () => {
    const r = await dona('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: true });
    assert.equal(r.statusCode, 200);
    const dele = await tokenDeVoz(ze);
    assert.equal(podeMicrofone(dele), false, 'sair e voltar da chamada destravaria o microfone');
    assert.equal(dele.canPublish, true, 'a trava é do microfone, não da tela');
    assert.ok(dele.canPublishSources?.length, 'lista vazia libera tudo');
    const fontes = (dele.canPublishSources ?? []).map(String);
    assert.ok(fontes.some((f) => /^(camera|3)$/i.test(f)), 'a câmera continua: ' + fontes);
    // O som da tela sairia pelo console com o microfone dentro (achado da revisão de 21/10/2026).
    assert.ok(!fontes.some((f) => /screen_share_audio|^4$/i.test(f)), 'o som da tela abriria uma porta para a voz: ' + fontes);
    assert.equal(dele.travado, true, 'o app precisa saber, para não tentar abrir o microfone e parecer defeito');
  });

  it('liberar devolve o microfone', async () => {
    assert.equal((await dona('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: false })).statusCode, 200);
    const dele = await tokenDeVoz(ze);
    assert.ok(podeMicrofone(dele));
    assert.equal(dele.travado, false);
  });

  it('quem administra e foi travado não se solta sozinho', async () => {
    await dona('PUT', `/api/communities/${comunidadeId}/members/${zeId}`, { role: 'admin' });
    await dona('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: true });
    const r = await ze('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: false });
    assert.equal(r.statusCode, 403);
    assert.equal(podeMicrofone(await tokenDeVoz(ze)), false);
    await dona('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: false });
    await dona('PUT', `/api/communities/${comunidadeId}/members/${zeId}`, { role: 'member' });
  });

  it('a apresentação desligada não solta a trava', async () => {
    await dona('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: true });
    await dona('PUT', `/api/channels/${salaId}/palco`, { ligado: true });
    await dona('PUT', `/api/channels/${salaId}/palco`, { ligado: false });
    assert.equal(podeMicrofone(await tokenDeVoz(ze)), false);
    await dona('POST', `/api/channels/${salaId}/mute`, { userId: zeId, muted: false });
  });
});
