// Arquivos enviados pelos usuários (avatares, emojis, sons) chegam como data URL (base64) no JSON.
// O tipo é decidido pelos primeiros bytes do arquivo, nunca pelo que o navegador declarou.

export type MediaKind = 'image' | 'audio';

export interface Media {
  mime: string;
  data: Buffer;
}

const SIGNATURES: { mime: string; kind: MediaKind; matches: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', kind: 'image', matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', kind: 'image', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', kind: 'image', matches: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  {
    mime: 'image/webp',
    kind: 'image',
    matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    mime: 'audio/wav',
    kind: 'audio',
    matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE',
  },
  { mime: 'audio/ogg', kind: 'audio', matches: (b) => b.subarray(0, 4).toString('latin1') === 'OggS' },
  {
    mime: 'audio/mpeg',
    kind: 'audio',
    matches: (b) => b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  },
  { mime: 'audio/webm', kind: 'audio', matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
];

/** Decodifica e valida um data URL; devolve uma mensagem de erro em português se não servir. */
export function parseMedia(dataUrl: unknown, kind: MediaKind, maxBytes: number): Media | string {
  const match = typeof dataUrl === 'string' ? /^data:[\w/+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match) return 'Arquivo inválido.';
  const data = Buffer.from(match[1], 'base64');
  if (data.length > maxBytes) return `O arquivo passa do limite de ${Math.round(maxBytes / 1024)} KB.`;
  const signature = SIGNATURES.find((s) => s.kind === kind && s.matches(data));
  if (!signature) {
    return kind === 'image' ? 'Use uma imagem PNG, JPG, GIF ou WEBP.' : 'Use um áudio MP3, OGG, WAV ou WEBM.';
  }
  return { mime: signature.mime, data };
}

export function sniffMime(data: Buffer): string | undefined {
  return SIGNATURES.find((s) => s.matches(data))?.mime;
}
