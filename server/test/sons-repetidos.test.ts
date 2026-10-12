/**
 * SOM REPETIDO (11/10/2026, relato: "Por favor, me ajuda" e "Me ajuda (de novo)" lado a lado, o mesmo áudio).
 * O que este arquivo segura:
 *
 *   1. a comunidade não aceita o mesmo áudio duas vezes, e a recusa diz qual som já é esse;
 *   2. o soundboard mostra cada áudio uma vez só, venha de onde vier (comunidade ou pacote);
 *   3. entre as cópias, fica a favoritada — é a que a pessoa procura.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let db: typeof import('../src/db.js');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  db = await import('../src/db.js');
});

after(async () => {
  await fechar();
});

/** Um "áudio" que passa na conferência de formato (começa com OggS) e muda com o número. */
const audio = (n: number) => Buffer.concat([Buffer.from('OggS'), Buffer.from([n, n + 1, n + 2, 9, 9, 9])]);
const comoDataUrl = (dados: Buffer) => 'data:audio/ogg;base64,' + dados.toString('base64');

describe('som repetido', () => {
  it('a comunidade recusa o mesmo áudio duas vezes, dizendo qual é', async () => {
    const dona = await criarConta(app, 'donadossons');
    const pedido = comToken(app, dona.token);
    const comunidade = (await pedido('POST', '/api/communities', { name: 'Sons' })).json();
    const url = `/api/communities/${comunidade.id}/sounds`;

    const primeiro = await pedido('POST', url, { name: 'Por favor, me ajuda', icon: '🙏', audio: comoDataUrl(audio(1)) });
    assert.equal(primeiro.statusCode, 200);

    const repetido = await pedido('POST', url, { name: 'Me ajuda (de novo)', icon: '🙏', audio: comoDataUrl(audio(1)) });
    assert.equal(repetido.statusCode, 409);
    assert.match(repetido.json().error, /Por favor, me ajuda/, 'a recusa diz qual som já tem esse áudio');

    const outro = await pedido('POST', url, { name: 'Outro som', icon: '🔊', audio: comoDataUrl(audio(2)) });
    assert.equal(outro.statusCode, 200, 'áudio diferente entra normalmente');
  });

  it('o soundboard mostra cada áudio uma vez, e fica o favoritado', async () => {
    const pessoa = await criarConta(app, 'quemouve');
    const pedido = comToken(app, pessoa.token);
    const comunidade = (await pedido('POST', '/api/communities', { name: 'Mais sons' })).json();
    const url = `/api/communities/${comunidade.id}/sounds`;
    assert.equal((await pedido('POST', url, { name: 'Da comunidade', icon: '🙏', audio: comoDataUrl(audio(5)) })).statusCode, 200);

    // O mesmo áudio chegando por um pacote instalado.
    const pacote = db.createPack('Memes', 'um pacote', '😂', null, false);
    const doPacote = db.createPackSound(pacote, 'Do pacote', '🙏', 'audio/ogg', audio(5));
    db.installPack(pacote, pessoa.user.id);

    const nomes = () => pedido('GET', url).then((r) => (r.json() as { name: string }[]).map((s) => s.name));
    assert.deepEqual(await nomes(), ['Da comunidade'], 'o mesmo áudio aparece uma vez só');

    assert.equal((await pedido('PUT', `/api/sounds/${doPacote.id}/favorite`, { favorite: true })).statusCode, 200);
    assert.deepEqual(await nomes(), ['Do pacote'], 'favoritada a cópia do pacote, é ela que fica');
  });
});
