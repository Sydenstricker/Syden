// Os arquivos saíram do banco e foram para o disco. Isto prova que eles saíram, que voltam inteiros, e
// que as três coisas que poderiam quebrar em silêncio não quebraram.
//
// O QUE É "QUEBRAR EM SILÊNCIO" AQUI, e é por isso que cada um destes testes existe:
//
//   - A COTA POR PESSOA somava `length(data)`. Com o BLOB vazio, ela passaria a somar ZERO: teto
//     nenhum, nenhum erro, nenhum aviso, até alguém encher o disco da máquina.
//   - O SCRIPT DE MIGRAÇÃO calcula o caminho do arquivo por conta própria, porque é .mjs e não importa
//     o servidor. Se os dois cálculos desencontrarem, um escreve num lugar e o outro procura noutro —
//     e o sintoma é avatar sumido, não erro de programa.
//   - O PEDIDO DE PEDAÇO (Range) é a razão de tudo isto no karaokê. Um Range mal respondido não dá
//     erro: dá áudio que não deixa arrastar a barra, ou arrasta e toca a parte errada.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

const SCRIPT = fileURLToPath(new URL('../scripts/mover-arquivos.mjs', import.meta.url));

/**
 * Escreve uma linha como o Syden de ONTEM escrevia: bytes dentro do BLOB, sem endereço.
 *
 * Vai por uma conexão própria, e não pelas funções do db.ts — justamente porque elas já aprenderam o
 * jeito novo. O que se quer aqui é o estado anterior, que é o que o script vai encontrar na produção.
 */
function comoEraAntes(userId: number, bytes: Buffer) {
  const banco = new DatabaseSync(process.env.DATABASE_PATH!);
  banco
    .prepare(
      `INSERT INTO avatars (user_id, mime, data, sha, bytes) VALUES (?, 'image/png', ?, NULL, NULL)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, sha = NULL, bytes = NULL`,
    )
    .run(userId, bytes);
  banco.close();
}

/** Roda o script de migração de verdade, no processo dele, contra o banco deste teste. */
function rodarMigracao() {
  return execFileSync(process.execPath, [SCRIPT], { env: { ...process.env }, encoding: 'utf8' });
}

/** Um PNG de verdade: o servidor confere a assinatura dos bytes antes de aceitar. */
function png(bytes: number, recheio = 1): Buffer {
  const cabecalho = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([cabecalho, Buffer.alloc(Math.max(0, bytes - 8), recheio)]);
}
const comoDataUrl = (dados: Buffer) => 'data:image/png;base64,' + dados.toString('base64');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('o arquivo vai para o disco', () => {
  it('subir um avatar escreve um arquivo e deixa o BLOB vazio', async () => {
    const db = await import('../src/db.js');
    const { caminhoDe } = await import('../src/arquivos.js');
    const { token } = await criarConta(app, 'quemsobe');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();

    const bytes = png(5000, 3);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(bytes) });

    const linha = db.findAvatar(eu.id)!;
    assert.ok(linha.sha, 'a linha guarda o endereço do arquivo');
    assert.equal(linha.bytes, bytes.length, 'e o tamanho, que a cota precisa');
    assert.equal(linha.data?.byteLength ?? 0, 0, 'o BLOB ficou vazio: os bytes não estão mais no banco');

    assert.ok(existsSync(caminhoDe(linha.sha!)), 'o arquivo existe no disco');
    assert.deepEqual(readFileSync(caminhoDe(linha.sha!)), bytes, 'e é byte a byte o que foi enviado');
  });

  it('o mesmo conteúdo duas vezes é um arquivo só', async () => {
    const db = await import('../src/db.js');
    const iguais = png(4000, 9);

    const a = await criarConta(app, 'gemeaum');
    const b = await criarConta(app, 'gemeadois');
    const euA = (await comToken(app, a.token)('GET', '/api/me')).json();
    const euB = (await comToken(app, b.token)('GET', '/api/me')).json();

    await comToken(app, a.token)('PUT', '/api/me/avatar', { image: comoDataUrl(iguais) });
    await comToken(app, b.token)('PUT', '/api/me/avatar', { image: comoDataUrl(iguais) });

    // O ENDEREÇO É O CONTEÚDO, então duas pessoas com o mesmo avatar apontam para o mesmo arquivo.
    // Não é otimização de enfeite: é o que faz instalar um pacote em dez comunidades não escrever dez
    // vezes a mesma imagem.
    assert.equal(db.findAvatar(euA.id)!.sha, db.findAvatar(euB.id)!.sha);
  });

  it('e a rota devolve o arquivo inteiro, do disco', async () => {
    const { token } = await criarConta(app, 'quembaixa');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();
    const bytes = png(6000, 5);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(bytes) });

    const resposta = await app.inject({ method: 'GET', url: `/api/users/${eu.id}/avatar` });
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.headers['content-type'], 'image/png');
    assert.equal(resposta.headers['accept-ranges'], 'bytes', 'o navegador precisa SABER que pode pedir pedaço');
    assert.deepEqual(resposta.rawPayload, bytes);
  });
});

describe('o pedido de pedaço — é ele que conserta o karaokê', () => {
  it('pedir um trecho devolve 206 e só aquele trecho', async () => {
    const { token } = await criarConta(app, 'quemarrasta');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();
    const bytes = png(10_000, 7);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(bytes) });

    const resposta = await app.inject({
      method: 'GET',
      url: `/api/users/${eu.id}/avatar`,
      headers: { range: 'bytes=1000-1999' },
    });

    assert.equal(resposta.statusCode, 206, 'conteúdo parcial');
    assert.equal(resposta.headers['content-range'], `bytes 1000-1999/${bytes.length}`);
    assert.equal(resposta.headers['content-length'], '1000');
    assert.deepEqual(resposta.rawPayload, bytes.subarray(1000, 2000), 'e é exatamente o pedaço pedido');
  });

  it('`bytes=-500` são os ÚLTIMOS 500, e não os primeiros', async () => {
    const { token } = await criarConta(app, 'quemleofim');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();
    const bytes = png(3000, 11);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(bytes) });

    const resposta = await app.inject({ method: 'GET', url: `/api/users/${eu.id}/avatar`, headers: { range: 'bytes=-500' } });
    assert.equal(resposta.statusCode, 206);
    assert.deepEqual(resposta.rawPayload, bytes.subarray(bytes.length - 500));
  });

  it('pedido sem sentido não vira erro: devolve o arquivo inteiro', async () => {
    const { token } = await criarConta(app, 'quempedetorto');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();
    const bytes = png(2000, 13);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(bytes) });

    for (const range of ['bytes=abc', 'bytes=500-100', 'coisas=0-10']) {
      const resposta = await app.inject({ method: 'GET', url: `/api/users/${eu.id}/avatar`, headers: { range } });
      assert.equal(resposta.statusCode, 200, `${range} devia cair no arquivo inteiro`);
      assert.deepEqual(resposta.rawPayload, bytes);
    }
  });
});

describe('a cota continua contando', () => {
  it('o espaço de uma pessoa não zera quando o arquivo sai do banco', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'quemocupa');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();

    const bytes = png(30_000, 17);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(bytes) });

    // ISTO É A GUARDA DA FALHA SILENCIOSA. Somando `length(data)` daria zero, sem erro nenhum, e o
    // teto por pessoa teria sido desligado por uma migração que "funcionou".
    assert.equal(db.espacoUsado(eu.id), bytes.length);
  });
});

describe('as duas épocas convivem, e o script leva uma para a outra', () => {
  it('linha no formato antigo é servida do banco, como sempre foi', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'quemeantiga');
    const eu = (await comToken(app, token)('GET', '/api/me')).json();

    // Escreve à MÃO uma linha como o Syden de ontem escrevia: bytes no BLOB, sem endereço nenhum.
    // É o estado em que está o servidor de produção neste instante, e é o que o script vai encontrar.
    const bytes = png(8000, 23);
    comoEraAntes(eu.id, bytes);

    const linha = db.findAvatar(eu.id)!;
    assert.equal(linha.sha, null, 'é uma linha da época antiga');

    const resposta = await app.inject({ method: 'GET', url: `/api/users/${eu.id}/avatar` });
    assert.equal(resposta.statusCode, 200, 'e o servidor de hoje a entrega sem reclamar');
    assert.deepEqual(resposta.rawPayload, bytes);
  });

  it('o script move a linha antiga, e ela continua sendo servida — agora do disco', async () => {
    const db = await import('../src/db.js');
    const { caminhoDe } = await import('../src/arquivos.js');
    const { token } = await criarConta(app, 'quemmigra');
    const eu = (await comToken(app, token)('GET', '/api/me')).json();

    const bytes = png(9000, 29);
    comoEraAntes(eu.id, bytes);
    assert.equal(db.findAvatar(eu.id)!.sha, null);

    // O SCRIPT DE VERDADE, no processo dele, com as variáveis deste teste. Não é uma reimplementação
    // do que ele faz: é ele. É a única forma de provar que o comando que vai rodar na produção
    // funciona — e o projeto já aprendeu que teste de unidade não cobre o cenário de verdade.
    rodarMigracao();

    const depois = db.findAvatar(eu.id)!;
    assert.ok(depois.sha, 'ganhou endereço');
    assert.equal(depois.bytes, bytes.length, 'e tamanho, senão a cota zeraria');
    assert.equal(depois.data?.byteLength ?? 0, 0, 'e o BLOB esvaziou');
    assert.ok(existsSync(caminhoDe(depois.sha!)), 'o arquivo está no disco');

    const resposta = await app.inject({ method: 'GET', url: `/api/users/${eu.id}/avatar` });
    assert.equal(resposta.statusCode, 200);
    assert.deepEqual(resposta.rawPayload, bytes, 'byte a byte o mesmo de antes de migrar');

    // E PASSA A ACEITAR PEDIDO DE PEDAÇO, que é o ganho que a pessoa sente no karaokê.
    const pedaco = await app.inject({ method: 'GET', url: `/api/users/${eu.id}/avatar`, headers: { range: 'bytes=100-199' } });
    assert.equal(pedaco.statusCode, 206);
    assert.deepEqual(pedaco.rawPayload, bytes.subarray(100, 200));
  });

  it('rodar duas vezes não estraga nada', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'quemmigraduasvezes');
    const eu = (await comToken(app, token)('GET', '/api/me')).json();
    comoEraAntes(eu.id, png(4000, 31));

    rodarMigracao();
    const primeira = db.findAvatar(eu.id)!;
    rodarMigracao();
    const segunda = db.findAvatar(eu.id)!;

    assert.equal(segunda.sha, primeira.sha);
    assert.equal(segunda.bytes, primeira.bytes);
  });

  it('e o --conferir aprova o que o script deixou', () => {
    const saida = execFileSync(process.execPath, [SCRIPT, '--conferir'], {
      env: { ...process.env },
      encoding: 'utf8',
    });
    assert.match(saida, /todos os arquivos estão no disco/);
  });
});

describe('o script de migração calcula o mesmo caminho que o servidor', () => {
  it('se eles desencontrarem, um escreve onde o outro não procura', async () => {
    // Este é o único jeito de pegar essa divergência: o script é .mjs e não pode importar o servidor,
    // então as três linhas de cálculo são cópia — e cópia desencontra sozinha, com o tempo.
    const servidor = await import('../src/arquivos.js');
    const script = await import('../scripts/mover-arquivos.mjs');

    const sha = 'a'.repeat(64);
    assert.equal(script.PASTA_DOS_ARQUIVOS, servidor.PASTA_DOS_ARQUIVOS);
    assert.equal(script.caminhoDe(sha), servidor.caminhoDe(sha));
    assert.equal(script.shaDeArquivo(Buffer.from('oi')), servidor.shaDeArquivo(Buffer.from('oi')));
  });
});
