/**
 * O MODELO DO RECORTE DE FUNDO (04/11/2026), para o app de desktop: o BiRefNet lite a 512, em meia precisão (MIT,
 * github.com/ZhengPeng7/BiRefNet). O app baixa daqui, e não de um terceiro, quando a pessoa pede "recortar qualquer fundo"
 * numa figurinha; a imagem nunca vem ao servidor (ver desktop/src/recorte/index.js).
 *
 * O ARQUIVO NÃO MORA NO GIT (98 MB): na primeira vez que alguém pede, o servidor o busca na revisão FIXA da conversão que foi
 * medida (e2e/recorte-de-fundo/README.md), confere o sha256 e guarda ao lado do banco. Daí em diante, entrega o dele. Se o
 * sha não bater, não guarda nem entrega nada — e o app confere o sha de novo do lado dele.
 */
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';

export const MODELO_DO_RECORTE = {
  arquivo: 'birefnet-lite-512-fp16.onnx',
  origem: 'https://huggingface.co/shozebDev/birefnet-lite-512-onnx/resolve/a1ef059c89d8982b4b5f801915024d8e2d55ea87/onnx/model_fp16.onnx',
  sha256: 'cdcc278ab17011c8507c83f368935527a7cde826dec4dff7f3dc6e18474f4a81',
  tamanho: 98_451_949,
};

const caminho = () => join(dirname(config.databasePath), 'modelos', MODELO_DO_RECORTE.arquivo);

function jaTem() {
  try {
    return statSync(caminho()).size === MODELO_DO_RECORTE.tamanho;
  } catch {
    return false;
  }
}

let buscando: Promise<void> | null = null;

/** Busca o modelo na origem fixa, uma vez, conferindo o sha256 antes de guardar. */
export function garantirModeloDoRecorte(buscar: typeof fetch = fetch): Promise<void> {
  if (jaTem()) return Promise.resolve();
  buscando ??= (async () => {
    const resposta = await buscar(MODELO_DO_RECORTE.origem, { headers: { 'User-Agent': 'Syden (recorte de fundo)' } });
    if (!resposta.ok) throw new Error(`origem respondeu ${resposta.status}`);
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== MODELO_DO_RECORTE.sha256) throw new Error('o sha256 do modelo não confere');
    mkdirSync(dirname(caminho()), { recursive: true });
    const temporario = caminho() + '.baixando';
    writeFileSync(temporario, bytes);
    renameSync(temporario, caminho());
  })()
    .catch((erro) => {
      rmSync(caminho() + '.baixando', { force: true });
      throw erro;
    })
    .finally(() => {
      buscando = null;
    });
  return buscando;
}

export function registerRecorteRoutes(app: FastifyInstance) {
  // Sem conta: o app baixa antes de qualquer coisa, e o arquivo é público (MIT) e igual para todos.
  app.get('/api/recorte-de-fundo/modelo', async (request, reply) => {
    try {
      await garantirModeloDoRecorte();
    } catch (erro) {
      request.log.error({ erro: String(erro) }, 'recorte de fundo: não consegui o modelo');
      return reply.code(503).send({ error: 'O recorte não está disponível agora. Tente de novo mais tarde.' });
    }
    return reply
      .header('content-type', 'application/octet-stream')
      .header('content-length', String(MODELO_DO_RECORTE.tamanho))
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(createReadStream(caminho()));
  });
}
