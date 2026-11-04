import { desktopBridge } from './desktop';

/**
 * O RECORTE DE QUALQUER FUNDO NAS FIGURINHAS (04/11/2026): o BiRefNet, que só existe no app de desktop (desktop/src/recorte,
 * por decisão dele: no site ele pediria WebAssembly), com o modelo dentro do app. Aqui é só a ponte. No navegador, e nas
 * versões do app de antes dele, tudo isto diz "não há", e fica o recorte do fundo liso.
 */
const ponte = () => desktopBridge?.recorte;

/** Se este app recorta qualquer fundo (no navegador e nos apps antigos, não). */
export async function recorteDisponivel(): Promise<boolean> {
  const r = ponte();
  if (!r) return false;
  return r.disponivel().catch(() => false);
}

/** Abre o modelo de antemão (uns 8 s), para a primeira imagem não esperar. Falhar aqui não é problema: recortar abre de novo. */
export function prepararRecorte() {
  void ponte()?.preparar().catch(() => {});
}

export function recortarComModelo(pixels: Uint8Array): Promise<Uint8Array> {
  const r = ponte();
  if (!r) return Promise.reject(new Error('sem recorte'));
  return r.recortar(pixels);
}
