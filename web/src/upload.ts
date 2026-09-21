// Prepara arquivos escolhidos pelo usuário antes de enviar: reduz imagens no próprio navegador
// (o envio fica leve) e confere o tamanho e a duração dos sons.

const KB = 1024;

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Imagem → data URL WEBP de `size`×`size`. `cover` recorta o centro (avatar); `contain` encaixa
 * sem cortar, com fundo transparente (emoji). GIF animado vai como está para não perder a animação.
 */
export async function prepareImage(file: File, options: { size: number; fit: 'cover' | 'contain'; maxBytes: number }) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.type === 'image/gif') {
    if (file.size > options.maxBytes) {
      throw new Error(`GIFs animados podem ter até ${Math.round(options.maxBytes / KB)} KB.`);
    }
    return readAsDataUrl(file);
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível abrir essa imagem.');
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = options.size;
  const ctx = canvas.getContext('2d')!;
  const scale =
    options.fit === 'cover'
      ? options.size / Math.min(bitmap.width, bitmap.height)
      : options.size / Math.max(bitmap.width, bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (options.size - w) / 2, (options.size - h) / 2, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('Não foi possível processar essa imagem.');
  return readAsDataUrl(blob);
}

/**
 * Imagem que veio de um Ctrl+C: tanto de um evento de colar quanto do botão "Colar imagem", que lê a área
 * de transferência direto (o navegador pede permissão na primeira vez).
 */
export function imageFromClipboardEvent(event: ClipboardEvent): File | null {
  for (const item of event.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) return item.getAsFile();
  }
  return null;
}

export async function imageFromClipboard(): Promise<File> {
  if (!navigator.clipboard?.read) throw new Error('Este navegador não deixa colar imagem por botão. Use Ctrl+V.');
  const items = await navigator.clipboard.read().catch(() => {
    throw new Error('Não foi possível ler a área de transferência. Autorize o acesso ou use Ctrl+V.');
  });
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) {
      const blob = await item.getType(type);
      return new File([blob], 'colado.png', { type });
    }
  }
  throw new Error('Não há imagem copiada. Copie uma imagem (Ctrl+C) e tente de novo.');
}

export const MAX_SOUND_SECONDS = 7;

export async function prepareSound(file: File, maxBytes: number) {
  if (!file.type.startsWith('audio/')) throw new Error('Escolha um arquivo de áudio (MP3, OGG ou WAV).');
  if (file.size > maxBytes) throw new Error(`O som pode ter até ${Math.round(maxBytes / KB)} KB.`);
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error('Não foi possível abrir esse áudio.'));
      audio.src = url;
    });
    if (duration > MAX_SOUND_SECONDS + 0.5) {
      throw new Error(`O som pode ter até ${MAX_SOUND_SECONDS} segundos (esse tem ${Math.round(duration)}).`);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return readAsDataUrl(file);
}

const MB = 1024 * KB;
/** O mesmo teto do servidor. */
export const MAX_ATTACHMENT_BYTES = 8 * MB;
/** Acima disso a imagem é reduzida antes de subir: ninguém precisa de 6000 pixels numa conversa. */
const MAX_IMAGE_SIDE = 1920;

export interface PreparedFile {
  name: string;
  /** O arquivo em data URL, pronto para ir no JSON. */
  data: string;
  size: number;
  mime: string;
  width: number | null;
  height: number | null;
}

export function formatBytes(bytes: number) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} bytes`;
}

/** Tamanho real de um data URL base64, sem contar o cabeçalho. */
function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

/**
 * Arquivo escolhido no chat: fotos grandes encolhem aqui mesmo (sobe rápido e ocupa menos no servidor);
 * GIFs e os demais arquivos vão como estão, respeitando o limite.
 */
export async function prepareAttachment(file: File): Promise<PreparedFile> {
  const isShrinkable = file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml';
  if (!isShrinkable) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`"${file.name}" tem ${formatBytes(file.size)}: o limite é ${formatBytes(MAX_ATTACHMENT_BYTES)} por arquivo.`);
    }
    const data = await readAsDataUrl(file);
    const size = { width: null as number | null, height: null as number | null };
    if (file.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (bitmap) {
        size.width = bitmap.width;
        size.height = bitmap.height;
        bitmap.close();
      }
    }
    return { name: file.name, data, size: file.size, mime: file.type, ...size };
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`Não foi possível abrir "${file.name}".`);
  });
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  // Se a conversão não ajudou (imagem já pequena e bem comprimida), manda a original.
  if (!blob || blob.size >= file.size) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`"${file.name}" tem ${formatBytes(file.size)}: o limite é ${formatBytes(MAX_ATTACHMENT_BYTES)} por arquivo.`);
    }
    return { name: file.name, data: await readAsDataUrl(file), size: file.size, mime: file.type, width, height };
  }
  if (blob.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" continua com ${formatBytes(blob.size)} depois de reduzida: o limite é ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
  }
  const data = await readAsDataUrl(blob);
  return {
    name: file.name.replace(/\.[^.]+$/, '') + '.webp',
    data,
    size: dataUrlBytes(data),
    mime: 'image/webp',
    width,
    height,
  };
}

/** "Coração Feliz.png" → "coracao_feliz" (o mesmo formato que o servidor aceita). */
export function emojiNameFromFile(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}
