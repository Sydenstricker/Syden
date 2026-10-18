/**
 * A RECONFERÊNCIA DA FILA DO SHIELD (auditoria de 17/10/2026: a fila existia desde 28/09 e ninguém a lia).
 *
 * Como no teste do Shield, NÃO TOCA NA REDE: o `fetch` é trocado por um falso. O caminho é o de verdade: a imagem entra
 * pela rota do avatar com o Shield fora do ar, cai na fila, e a reconferência a pega depois.
 *
 * O que se prova, porque falhando calado seria pior que não ter nada:
 *   1. o positivo SAI DO AR, com as cópias (o mesmo arquivo no avatar de outra pessoa);
 *   2. a prova FICA: a linha da prova e o arquivo no disco;
 *   3. a denúncia nasce GRAVE e SEM a imagem (quem cuida do Syden não deve ver o material);
 *   4. o limpo só sai da fila, e o Shield ainda fora conta uma tentativa e não perde o item;
 *   5. NENHUM arquivo do servidor além de db.ts cita a tabela da prova: ela não pode ter rota.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { after, afterEach, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const fetchDeVerdade = globalThis.fetch;

/** O Shield fingido: responde a mesma coisa até o teste trocar. */
function shield(resposta: { status: number; corpo?: unknown }) {
  globalThis.fetch = (async () =>
    ({ ok: resposta.status >= 200 && resposta.status < 300, status: resposta.status, json: async () => resposta.corpo ?? {} }) as Response) as typeof fetch;
}
const FORA_DO_AR = { status: 503 };
const POSITIVO = { status: 200, corpo: { classification: 'csam', match_type: 'exact', is_match: true } };
const LIMPO = { status: 200, corpo: { classification: 'no-known-match', match_type: null, is_match: false } };

/** Um PNG de verdade (o servidor confere a assinatura e o tamanho do desenho); `recheio` muda o sha. */
function png(recheio: number): string {
  const ihdr = Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex');
  const dados = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ihdr, Buffer.alloc(64, recheio)]);
  return 'data:image/png;base64,' + dados.toString('base64');
}

/** O io de mentira: a reconferência avisa as telas abertas, e aqui não há tela nenhuma. */
const io = { emit() {}, to: () => ({ emit() {} }) } as never;
const log = { info() {}, error() {}, warn() {} } as never;

describe('a reconferência da fila do Shield', () => {
  let app: FastifyInstance;
  let fechar: () => Promise<void>;
  let banco: string;

  before(async () => {
    ({ app, fechar } = await servidorDeTeste());
    banco = process.env.DATABASE_PATH!;
    process.env.SHIELD_USUARIO = 'syden';
    process.env.SHIELD_SENHA = 'segredo';
  });
  after(async () => {
    delete process.env.SHIELD_USUARIO;
    delete process.env.SHIELD_SENHA;
    await fechar();
  });
  afterEach(() => {
    globalThis.fetch = fetchDeVerdade;
  });

  const ler = <T>(sql: string, ...args: (string | number)[]) => {
    const b = new DatabaseSync(banco, { readOnly: true });
    try {
      return b.prepare(sql).all(...args) as T[];
    } finally {
      b.close();
    }
  };

  it('o positivo sai do ar com as cópias, a prova fica e a denúncia nasce grave, sem a imagem', async () => {
    const db = await import('../src/db.js');
    const { arquivoExiste } = await import('../src/arquivos.js');
    const { reconferirFila } = await import('../src/reconferencia.js');
    const ana = await criarConta(app, 'anashield');
    const bia = await criarConta(app, 'biashield');

    // Com o Shield fora do ar, a imagem entra (a política dele) e vai para a fila. A Bia sobe o MESMO arquivo.
    shield(FORA_DO_AR);
    for (const { token } of [ana, bia]) {
      const r = await comToken(app, token)('PUT', '/api/me/avatar', { image: png(7) });
      assert.equal(r.statusCode, 200, r.body);
    }
    const [{ sha }] = ler<{ sha: string }>('SELECT sha FROM avatars WHERE user_id = ?', ana.user.id);
    assert.ok(db.lerFilaDoShield().some((f) => f.sha256 === sha), 'a imagem não foi para a fila');

    shield(POSITIVO);
    const rodada = await reconferirFila(io, log);
    assert.equal(rodada.positivas, 1);

    assert.equal(ler('SELECT 1 FROM avatars WHERE sha = ?', sha).length, 0, 'a imagem continua no ar');
    assert.ok(!db.lerFilaDoShield().some((f) => f.sha256 === sha), 'o item ficou na fila');
    assert.equal(ler('SELECT 1 FROM shield_provas WHERE sha = ?', sha).length, 2, 'a prova não foi guardada, uma por conta que subiu');
    assert.ok(arquivoExiste(sha), 'o arquivo da prova sumiu do disco');

    // Uma denúncia por conta que subiu o arquivo: as duas precisam de revisão.
    const graves = db.listarDenuncias('aberta').filter((d) => d.grave && d.reason.includes('Shield'));
    assert.deepEqual(graves.map((d) => d.targetId).sort(), [ana.user.id, bia.user.id].sort(), 'falta denúncia de quem subiu');
    assert.ok(graves.every((d) => !d.temImagem), 'a denúncia aponta a imagem: o painel a mostraria');
  });

  it('o limpo só sai da fila; com o Shield ainda fora, o item fica e conta a tentativa', async () => {
    const db = await import('../src/db.js');
    const { reconferirFila } = await import('../src/reconferencia.js');
    const cid = await criarConta(app, 'cidshield');
    const como = comToken(app, cid.token);

    shield(FORA_DO_AR);
    await como('PUT', '/api/me/avatar', { image: png(9) });
    const [{ sha }] = ler<{ sha: string }>('SELECT sha FROM avatars WHERE user_id = ?', cid.user.id);

    await reconferirFila(io, log);
    const item = db.lerFilaDoShield().find((f) => f.sha256 === sha);
    assert.ok(item, 'com o Shield fora, o item saiu da fila sem ser conferido');
    assert.equal(item.tentativas, 1);

    shield(LIMPO);
    await reconferirFila(io, log);
    assert.ok(!db.lerFilaDoShield().some((f) => f.sha256 === sha), 'o limpo ficou na fila');
    assert.equal(ler('SELECT 1 FROM avatars WHERE sha = ?', sha).length, 1, 'o limpo saiu do ar');
  });

  it('NENHUM arquivo do servidor além de db.ts cita a tabela da prova', () => {
    const raiz = new URL('../src/', import.meta.url);
    const culpados = readdirSync(raiz)
      .filter((nome) => nome.endsWith('.ts') && nome !== 'db.ts')
      .filter((nome) => readFileSync(new URL(nome, raiz), 'utf8').includes('shield_provas'));
    assert.deepEqual(culpados, [], 'estes arquivos falam com a prova do Shield: ' + culpados.join(', ') + '. Ela não pode ter rota.');
  });
});
