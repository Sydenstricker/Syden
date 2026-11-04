import { api, API_URL } from './api';

/**
 * AS FIGURINHAS (04/11/2026, server/src/figurinhas-routes.ts): a coleção de cada pessoa, como no WhatsApp. Este arquivo é a
 * conversa com o servidor e o preparo da imagem; o seletor mora em SeletorDeFigurinhas.tsx, e a figurinha na conversa em
 * MessageItem.tsx (o anexo marcado).
 */
export interface Figurinha {
  id: number;
  key: string;
  mime: string;
  width: number | null;
  height: number | null;
}

/** O lado maior da figurinha guardada (o do WhatsApp). Aparece a 160 px na conversa: 512 sobra para tela de alta densidade. */
export const LADO_DA_FIGURINHA = 512;
/** O mesmo teto do servidor. */
export const LIMITE_DA_FIGURINHA = 1024 * 1024;

export const urlDaFigurinha = (f: Pick<Figurinha, 'id' | 'key'>) => `${API_URL}/api/figurinhas/${f.id}/${f.key}`;

export const listarFigurinhas = () => api<{ figurinhas: Figurinha[]; maximo: number }>('/api/figurinhas');
export const criarFigurinha = (corpo: { image: string; width: number; height: number }) => api<Figurinha>('/api/figurinhas', { method: 'POST', body: corpo });
export const tirarFigurinha = (id: number) => api(`/api/figurinhas/${id}`, { method: 'DELETE' });
export const salvarFigurinha = (anexoId: number, key: string) => api<Figurinha>('/api/figurinhas/salvar', { method: 'POST', body: { anexoId, key } });
export const mandarFigurinha = (channelId: number, figurinhaId: number, threadId: number | null, replyTo: number | null) =>
  api(`/api/channels/${channelId}/figurinha`, { method: 'POST', body: { figurinhaId, threadId, replyTo } });

const lerComoDataUrl = (arquivo: Blob) =>
  new Promise<string>((resolver, falhar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => falhar(leitor.error);
    leitor.readAsDataURL(arquivo);
  });

/**
 * A imagem escolhida vira a figurinha: inteira, sem recorte, com o fundo transparente preservado, reduzida até 512 px no
 * lado maior e em WEBP. GIF passa como veio (reduzir no canvas mataria a animação), se couber no limite.
 */
export async function prepararFigurinha(arquivo: File): Promise<{ image: string; width: number; height: number } | { erro: 'tipo' | 'grande' }> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(arquivo.type)) return { erro: 'tipo' };
  const bitmap = await createImageBitmap(arquivo).catch(() => null);
  if (!bitmap) return { erro: 'tipo' };
  const escala = Math.min(1, LADO_DA_FIGURINHA / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * escala));
  const height = Math.max(1, Math.round(bitmap.height * escala));
  if (arquivo.type === 'image/gif') {
    bitmap.close();
    if (arquivo.size > LIMITE_DA_FIGURINHA) return { erro: 'grande' };
    return { image: await lerComoDataUrl(arquivo), width, height };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/webp', 0.9));
  // navegador sem WEBP no canvas devolve PNG (o toBlob cai no padrão); os dois servem
  const final = blob ?? (await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/png')));
  if (!final) return { erro: 'tipo' };
  if (final.size > LIMITE_DA_FIGURINHA) return { erro: 'grande' };
  return { image: await lerComoDataUrl(final), width, height };
}
