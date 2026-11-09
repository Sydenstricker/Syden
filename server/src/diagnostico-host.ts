import { lstatSync, readFileSync } from 'node:fs';

const LIMITE_BYTES = 512 * 1024;

export type DiagnosticoHost =
  | { available: false }
  | { available: true; updatedAt: string; content: string };

/** Lê somente o snapshot fixo que o script local do cofre gera; nunca aceita caminho vindo do pedido. */
export function lerDiagnosticoHost(caminho: string): DiagnosticoHost {
  let info;
  try {
    info = lstatSync(caminho);
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT') return { available: false };
    throw erro;
  }

  if (!info.isFile()) throw new Error('O snapshot do diagnóstico não é um arquivo regular.');
  if (info.size > LIMITE_BYTES) throw new Error('O snapshot do diagnóstico excede o limite de leitura.');

  const content = readFileSync(caminho, 'utf8');
  if (Buffer.byteLength(content, 'utf8') > LIMITE_BYTES) {
    throw new Error('O snapshot do diagnóstico excede o limite de leitura.');
  }
  return { available: true, updatedAt: info.mtime.toISOString(), content };
}
