import { api, API_URL } from './api';
import { aparar, contornar, type Pixels, type ResultadoDoFundo, tirarFundoLiso } from './figurinhaEfeitos';

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

export interface EfeitosDaFigurinha {
  tirarFundo: boolean;
  contorno: boolean;
  /**
   * O recorte com o modelo (só no app, recorteDeFundo.ts): recebe a imagem esticada a 512 × 512 (RGBA) e devolve a máscara
   * do objeto, 512 × 512. Sem ele, o fundo que sai é só o liso.
   */
  recortar?: (pixels: Uint8Array) => Promise<Uint8Array>;
}

/** 'ia': o modelo recortou; 'ia-falhou': ele falhou, e ficou o recorte do fundo liso no lugar. */
export type FundoDaFigurinha = ResultadoDoFundo | 'ia' | 'ia-falhou';
export type FigurinhaPronta = { image: string; width: number; height: number; fundo: FundoDaFigurinha | null };

/** Passa a máscara do modelo (512 × 512) para a imagem do tamanho dela, multiplicando a transparência. */
function aplicarMascara(pixels: Pixels, mascara: Uint8Array) {
  const quadrada = document.createElement('canvas');
  quadrada.width = quadrada.height = 512;
  const cinza = new ImageData(512, 512);
  for (let p = 0; p < 512 * 512; p++) {
    cinza.data[p * 4] = mascara[p];
    cinza.data[p * 4 + 3] = 255;
  }
  quadrada.getContext('2d')!.putImageData(cinza, 0, 0);
  const doTamanho = document.createElement('canvas');
  doTamanho.width = pixels.width;
  doTamanho.height = pixels.height;
  const ctx = doTamanho.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(quadrada, 0, 0, pixels.width, pixels.height);
  const a = ctx.getImageData(0, 0, pixels.width, pixels.height).data;
  for (let p = 0; p < pixels.width * pixels.height; p++) pixels.data[p * 4 + 3] = Math.round((pixels.data[p * 4 + 3] * a[p * 4]) / 255);
}

/**
 * A imagem escolhida vira a figurinha: reduzida até 512 px no lado maior e em WEBP, com o fundo liso tirado e o contorno
 * branco, se pedidos (figurinhaEfeitos.ts). O fundo transparente que já vier é preservado. GIF passa como veio, sem efeito
 * nenhum (redesenhar no canvas mataria a animação), se couber no limite. `fundo` diz o que aconteceu ao tentar tirar o
 * fundo, para a prévia avisar quando ele não é liso.
 */
export async function prepararFigurinha(
  arquivo: File,
  efeitos: EfeitosDaFigurinha = { tirarFundo: false, contorno: false },
): Promise<FigurinhaPronta | { erro: 'tipo' | 'grande' }> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(arquivo.type)) return { erro: 'tipo' };
  const bitmap = await createImageBitmap(arquivo).catch(() => null);
  if (!bitmap) return { erro: 'tipo' };
  const escala = Math.min(1, LADO_DA_FIGURINHA / Math.max(bitmap.width, bitmap.height));
  let width = Math.max(1, Math.round(bitmap.width * escala));
  let height = Math.max(1, Math.round(bitmap.height * escala));
  if (arquivo.type === 'image/gif') {
    bitmap.close();
    if (arquivo.size > LIMITE_DA_FIGURINHA) return { erro: 'grande' };
    return { image: await lerComoDataUrl(arquivo), width, height, fundo: null };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let fundo: FundoDaFigurinha | null = null;
  if (efeitos.tirarFundo || efeitos.contorno) {
    const lido = ctx.getImageData(0, 0, width, height);
    let pixels: Pixels = { data: lido.data, width, height };
    if (efeitos.tirarFundo && efeitos.recortar) {
      try {
        const quadrada = document.createElement('canvas');
        quadrada.width = quadrada.height = 512;
        const q = quadrada.getContext('2d')!;
        q.imageSmoothingQuality = 'high';
        q.drawImage(canvas, 0, 0, 512, 512);
        const px = q.getImageData(0, 0, 512, 512).data;
        aplicarMascara(pixels, await efeitos.recortar(new Uint8Array(px.buffer, px.byteOffset, px.byteLength)));
        fundo = 'ia';
      } catch {
        // o modelo falhou: fica o recorte do fundo liso, e a prévia DIZ que foi isso
        fundo = 'ia-falhou';
      }
    }
    if (efeitos.tirarFundo) {
      if (fundo !== 'ia') {
        const liso = tirarFundoLiso(pixels);
        if (fundo !== 'ia-falhou') fundo = liso;
      }
      pixels = aparar(pixels) ?? pixels;
    }
    if (efeitos.contorno) pixels = contornar(pixels);
    // O contorno faz a imagem crescer: ela volta para dentro dos 512.
    const encolher = Math.min(1, LADO_DA_FIGURINHA / Math.max(pixels.width, pixels.height));
    const cru = document.createElement('canvas');
    cru.width = pixels.width;
    cru.height = pixels.height;
    cru.getContext('2d')!.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height), 0, 0);
    width = Math.max(1, Math.round(pixels.width * encolher));
    height = Math.max(1, Math.round(pixels.height * encolher));
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cru, 0, 0, width, height);
  }

  const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/webp', 0.9));
  // navegador sem WEBP no canvas devolve PNG (o toBlob cai no padrão); os dois servem
  const final = blob ?? (await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/png')));
  if (!final) return { erro: 'tipo' };
  if (final.size > LIMITE_DA_FIGURINHA) return { erro: 'grande' };
  return { image: await lerComoDataUrl(final), width, height, fundo };
}
