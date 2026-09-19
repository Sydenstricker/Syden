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
