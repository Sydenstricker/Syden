/**
 * O CÓDIGO DO LAYOUT (pedido dele, 10/11/2026: "na aba de editar deveria ter código para compartilhar o layout, como já ocorre na
 * configuração dos coelhos"). O retrato da arrumação (o mesmo que vai ao servidor, com a cena: quarto ou salão) vira um texto
 * para copiar e colar: "SYDL1-" + o JSON comprimido (deflate) em base64url. Comprimido, um salão cheio cabe em ~1 KB de texto.
 * Quem cola não confia no código: a página veste só o que conhece (vestir em montar.mjs) e o servidor confere ao guardar.
 */
const PREFIXO = 'SYDL1-';
const MAXIMO = 40_000;

const paraBase64Url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deBase64Url = (texto: string) => {
  const b = atob(texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function passar(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const saida = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}

export async function codigoDoLayout(layout: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(layout));
  return PREFIXO + paraBase64Url(await passar(bytes, new CompressionStream('deflate-raw')));
}

/** O layout de um código, ou null se não é um código de layout do Syden. */
export async function lerCodigoDoLayout(texto: string): Promise<Record<string, unknown> | null> {
  const t = texto.trim();
  if (!t.startsWith(PREFIXO) || t.length > MAXIMO) return null;
  try {
    const json = new TextDecoder().decode(await passar(deBase64Url(t.slice(PREFIXO.length)), new DecompressionStream('deflate-raw')));
    const l = JSON.parse(json) as unknown;
    return l && typeof l === 'object' && typeof (l as { cena?: unknown }).cena === 'string' ? (l as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
