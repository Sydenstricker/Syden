import { API_URL } from './api';
import { desktopBridge } from './desktop';

/**
 * O RECORTE DE QUALQUER FUNDO NAS FIGURINHAS (04/11/2026): o BiRefNet, que só existe no app de desktop (desktop/src/recorte,
 * por decisão dele: no site ele pediria WebAssembly). Aqui é só a ponte: saber se dá, baixar o modelo quando a pessoa pede,
 * e recortar. No navegador, e nas versões do app de antes dele, tudo isto diz "não há", e fica o recorte do fundo liso.
 */
const ponte = () => desktopBridge?.recorte;

export interface EstadoDoRecorte {
  baixado: boolean;
  /** O tamanho do download, em bytes, para dizer antes de baixar. */
  tamanho: number;
}

/** null: não há recorte com o modelo aqui (navegador, app antigo, sistema que não o roda). */
export async function estadoDoRecorte(): Promise<EstadoDoRecorte | null> {
  const r = ponte();
  if (!r) return null;
  const estado = await r.estado().catch(() => null);
  if (!estado?.disponivel) return null;
  return { baixado: estado.baixado, tamanho: estado.tamanho };
}

/** Baixa o modelo do servidor do Syden (o app confere o sha256), avisando o andamento de 0 a 1. */
export async function baixarRecorte(aoAndar: (fracao: number) => void): Promise<void> {
  const r = ponte();
  if (!r) throw new Error('sem recorte');
  const desligar = r.onProgresso(aoAndar);
  try {
    await r.baixar(`${API_URL}/api/recorte-de-fundo/modelo`);
  } finally {
    desligar();
  }
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
