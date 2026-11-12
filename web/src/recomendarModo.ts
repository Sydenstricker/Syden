// QUAL MODO DE TRANSMISSÃO, PADRÃO OU FLUIDO, SERVE A ESTE COMPUTADOR (12/11/2026, pedido dele: "o Syden recomenda qual
// formato através de um botão").
//
// A escolha continua nas Configurações; o botão "Recomendar para este computador" mede e escolhe por ela. Não roda sozinho:
// a medida manda uns 16 MB à Alemanha e pergunta à placa de vídeo, e isso só se faz quando a pessoa pede.
//
// O Fluido (1080p a 60 quadros, até 8 Mbps, mais a versão de 540p a 1,8) pede três coisas, e cada uma é medida:
//   1. INTERNET: uns 12 Mbps de envio até o servidor (os ~10 das duas versões e folga). Medido mandando pedaços de 1 MB
//      pelo mesmo caminho que a transmissão faz (`/api/medir-envio`); vale a mediana dos últimos, com a conexão já quente.
//   2. PLACA: 1080p a 60 quadros pela placa de vídeo, perguntado como a escolha do codec pergunta (escolherCodec.ts). Pelo
//      processador, o Fluido disputa a máquina com o jogo, que é o que ele não pode fazer.
//   3. O QUE JÁ ACONTECEU: o Fluido da última transmissão caiu para 30 (proximoFluido)? Isso vale mais que qualquer
//      medida, porque foi a transmissão de verdade, com o jogo de verdade rodando. Fica guardado no aparelho.
//
// Sem conseguir medir a internet, não recomenda nada: a tela não afirma o que não sabe.
import { API_URL, loadToken } from './api';
import { escolherCodecDaTela } from './escolherCodec';
import type { ScreenQuality } from './settings';

/** Envio, em Mbps, a partir do qual o Fluido cabe (8 + 1,8 das duas versões, e folga). */
export const ENVIO_DO_FLUIDO_MBPS = 12;

export type MotivoDaRecomendacao = 'cabe' | 'internet' | 'placa' | 'caiu';

export interface Recomendacao {
  modo: ScreenQuality;
  motivo: MotivoDaRecomendacao;
  envioMbps: number;
}

/** A regra, sem medir nada: o que já aconteceu, depois a placa, depois a internet. */
export function recomendar(m: { envioMbps: number; placaDa60: boolean; ultimoFluido: 'caiu' | 'aguentou' | null }): Recomendacao {
  const base = { envioMbps: m.envioMbps };
  if (m.ultimoFluido === 'caiu') return { ...base, modo: 'standard', motivo: 'caiu' };
  if (!m.placaDa60) return { ...base, modo: 'standard', motivo: 'placa' };
  if (m.envioMbps < ENVIO_DO_FLUIDO_MBPS) return { ...base, modo: 'standard', motivo: 'internet' };
  return { ...base, modo: 'smooth', motivo: 'cabe' };
}

// ---------- O que já aconteceu ----------

const CHAVE = 'syden:ultimo-fluido';
/** Depois disto, o que aconteceu já não diz muito (outra máquina, outra internet, outro jogo). */
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

/** Guarda como foi o Fluido desta transmissão: 'caiu' para 30, ou 'aguentou' um minuto inteiro. */
export function lembrarDoFluido(resultado: 'caiu' | 'aguentou') {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ resultado, quando: Date.now() }));
  } catch {
    // sem armazenamento, a recomendação fica só com as medidas
  }
}

export function ultimoFluido(agora = Date.now()): 'caiu' | 'aguentou' | null {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as { resultado?: string; quando?: number } | null;
    if (!guardado || typeof guardado.quando !== 'number' || agora - guardado.quando > VALIDADE_MS) return null;
    return guardado.resultado === 'caiu' || guardado.resultado === 'aguentou' ? guardado.resultado : null;
  } catch {
    return null;
  }
}

// ---------- A internet ----------

const PEDACO = 1024 * 1024;
const PEDACOS_NO_MAXIMO = 16;
const TEMPO_MAXIMO_MS = 8000;

/**
 * A mediana das taxas dos pedaços, sem os primeiros (a conexão ainda esquentando). Internet lenta manda poucos pedaços no
 * tempo da medida, e dois já dizem o bastante: cada um levou segundos.
 */
export function taxaDoEnvio(taxasMbps: number[]): number | null {
  const quentes = taxasMbps.length >= 5 ? taxasMbps.slice(2) : taxasMbps.length >= 3 ? taxasMbps.slice(1) : taxasMbps;
  if (quentes.length < 2) return null;
  const ordenadas = [...quentes].sort((a, b) => a - b);
  return ordenadas[Math.floor(ordenadas.length / 2)];
}

function enviar(corpo: Uint8Array<ArrayBuffer>, sinal?: AbortSignal) {
  return fetch(`${API_URL}/api/medir-envio`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', ...(loadToken() && { authorization: `Bearer ${loadToken()}` }) },
    body: corpo,
    signal: sinal,
  }).then(
    (r) => r.ok,
    () => false,
  );
}

/**
 * Manda pedaços de 1 MB ao servidor, um depois do outro, e devolve quantos Mbps a internet envia. Null se não deu.
 *
 * Cada pedido paga uma ida e volta até a Alemanha (~200 ms do Brasil), que não é envio: numa internet de 12 Mbps, 1 MB leva
 * 0,7 s, e a ida e volta tiraria 20% da conta. Por isso dois pedidos de 1 byte medem a ida e volta antes, e ela é descontada.
 */
export async function medirEnvio(sinal?: AbortSignal): Promise<number | null> {
  const pedaco = new Uint8Array(PEDACO);
  // Bytes que não se comprimem: um proxy no caminho que comprimisse zeros daria um número de mentira.
  for (let i = 0; i < PEDACO; i += 65536) crypto.getRandomValues(pedaco.subarray(i, i + 65536));
  let idaEVolta = Infinity;
  for (let i = 0; i < 2; i++) {
    const antes = performance.now();
    if (!(await enviar(new Uint8Array(1), sinal))) return null;
    idaEVolta = Math.min(idaEVolta, performance.now() - antes);
  }
  const taxas: number[] = [];
  const comeco = performance.now();
  for (let i = 0; i < PEDACOS_NO_MAXIMO && performance.now() - comeco < TEMPO_MAXIMO_MS; i++) {
    const antes = performance.now();
    if (!(await enviar(pedaco, sinal))) break;
    const segundos = Math.max(performance.now() - antes - idaEVolta, 1) / 1000;
    taxas.push((PEDACO * 8) / segundos / 1_000_000);
  }
  return taxaDoEnvio(taxas);
}

/** Mede tudo e recomenda. Null quando a internet não pôde ser medida. */
export async function recomendarParaEsteComputador(sinal?: AbortSignal): Promise<Recomendacao | null> {
  const [envioMbps, codec] = await Promise.all([medirEnvio(sinal), escolherCodecDaTela(1920, 1080, 60)]);
  if (envioMbps === null) return null;
  return recomendar({ envioMbps, placaDa60: codec.motivo === 'placa', ultimoFluido: ultimoFluido() });
}
