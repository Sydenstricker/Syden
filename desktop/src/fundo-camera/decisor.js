// @ts-check
/**
 * QUAL MODELO RODA AGORA: o modesto (no processador, para todos) ou o refinado (pela placa, quando ela pode). Ninguém escolhe
 * qualidade (a regra de 11/10/2026: "o Syden decide, quem usa não administra"); a troca é sozinha, sem aviso e sem piscar (a
 * máscara nova entra pela mesma média que se adapta, em segmentador.js).
 *
 * O refinado só roda com as três coisas a favor:
 * - a PLACA PRONTA: o DirectML abriu e o modelo coube em LIMITE_DA_ABERTURA_MS, medido ao abrir com quadros seguidos (`placa`);
 * - NENHUM JOGO NA FRENTE (`jogo`, que o processo principal diz pela janela da frente; ver jogo.js): a placa é do jogo. Saiu o
 *   jogo, volta depois de FOLGA_DO_JOGO_MS;
 * - SEM APERTO: o quadro do refinado passando de LIMITE_MS cinco vezes seguidas (a placa ocupada por outra coisa, um jogo que o
 *   Windows não conhece, um vídeo) desce. O limite em uso é o tempo do QUADRO (66 ms a 15 por segundo), e não o da abertura:
 *   medido em 17/11/2026, com a placa à toa entre um quadro e outro a NVIDIA baixa o relógio dela (P5, 345 MHz), e o mesmo
 *   modelo que leva 5–7 ms em quadros seguidos leva 25–50 ms a 15 por segundo. Isso não é aperto (a placa está folgada), e a
 *   página espera a máscara antes do quadro seguinte, que sai no mínimo 66 ms depois do anterior; volta com FOLGA_DO_APERTO_MS de folga, UMA vez; apertou de novo, fica no modesto até
 *   o processo sair (um minuto sem câmera). É a forma do degrau leve da transmissão (proximoLeve, web/src/streamStats.ts).
 *
 * Funções puras sobre o estado, para o teste (desktop/test/fundo-camera.test.mjs) andar o relógio sem placa nenhuma.
 */

/** Acima disto, o quadro do refinado não cabe mais no ritmo de 15 por segundo (66 ms entre um e outro): está apertado. */
const LIMITE_MS = 60;
/** Ao abrir, com quadros seguidos (a placa no relógio alto): a placa capaz roda o refinado bem abaixo disto. */
const LIMITE_DA_ABERTURA_MS = 33;
const LENTOS_PARA_DESCER = 5;
const FOLGA_DO_JOGO_MS = 5_000;
const FOLGA_DO_APERTO_MS = 24_000;

/**
 * @typedef {{
 *   placa: boolean,
 *   jogo: boolean,
 *   lentos: number,
 *   apertos: number,
 *   espera: number,
 *   motivo: 'placa' | 'jogo' | 'aperto' | null,
 * }} Decisor
 * `espera`: a hora (ms) antes da qual o refinado não volta. `motivo`: por que está no modesto (null: no refinado, ou sem placa
 * ainda, que não é uma descida).
 */

/** @returns {Decisor} */
function decisorInicial() {
  return { placa: false, jogo: false, lentos: 0, apertos: 0, espera: 0, motivo: 'placa' };
}

/**
 * @param {Decisor} d
 * @param {number} agora
 * @returns {'refinado' | 'modesto'}
 */
function nivelAgora(d, agora) {
  if (!d.placa || d.jogo || d.apertos >= 2 || agora < d.espera) return 'modesto';
  return 'refinado';
}

/** @param {Decisor} d @param {boolean} pronta */
function comPlaca(d, pronta) {
  return { ...d, placa: pronta, motivo: pronta ? null : /** @type {const} */ ('placa') };
}

/** @param {Decisor} d @param {boolean} ativo @param {number} agora */
function comJogo(d, ativo, agora) {
  if (ativo === d.jogo) return d;
  if (ativo) return { ...d, jogo: true, lentos: 0, motivo: /** @type {const} */ ('jogo') };
  // saiu o jogo: espera a folga (o jogo fechando ainda solta a placa aos poucos)
  return { ...d, jogo: false, espera: Math.max(d.espera, agora + FOLGA_DO_JOGO_MS) };
}

/**
 * O tempo de um quadro do refinado (só o modelo). Devolve o estado novo e se desceu AGORA (para o diário).
 * @param {Decisor} d @param {number} ms @param {number} agora
 */
function comTempo(d, ms, agora) {
  if (ms <= LIMITE_MS) return { decisor: d.lentos ? { ...d, lentos: 0 } : d, desceu: false };
  const lentos = d.lentos + 1;
  if (lentos < LENTOS_PARA_DESCER) return { decisor: { ...d, lentos }, desceu: false };
  return { decisor: { ...d, lentos: 0, apertos: d.apertos + 1, espera: agora + FOLGA_DO_APERTO_MS, motivo: /** @type {const} */ ('aperto') }, desceu: true };
}

/**
 * O nível de UMA câmera, com a escolha da pessoa (Configurações → Voz e vídeo). Escolha manual é RESPEITADA: com 'leve' ou
 * 'completo', nem jogo nem aperto trocam o modelo (decisão dele, 17/11/2026, pelo caso do Mundial: uma leitura automática
 * errada não pode deixar a pessoa sem saída). A única exceção é o Completo que não roda de jeito nenhum (sem placa capaz):
 * a câmera não fica sem efeito, vai o Leve, e a tela diz que o Completo está indisponível.
 * @param {Decisor} d @param {number} agora @param {'automatico' | 'leve' | 'completo'} preferencia
 * @returns {'refinado' | 'modesto'}
 */
function nivelDaCamera(d, agora, preferencia, escuro = false) {
  if (preferencia === 'leve') return 'modesto';
  if (preferencia === 'completo') return d.placa ? 'refinado' : 'modesto';
  // POUCA LUZ (17/11/2026, medido nos vídeos do estudo escurecidos): o refinado, um modelo de RECORTE, se perde no quarto escuro
  // (a máscara troca de lado 4× mais que a do modesto, e em dois dos três vídeos fica 72–85% parecida com a dele mesmo na
  // luz), e o modesto segura. No Automático, câmera escura é o Leve
  if (escuro) return 'modesto';
  return nivelAgora(d, agora);
}

/** O brilho médio do quadro (0 a 255) abaixo do qual a câmera conta como ESCURA, e acima do qual volta a contar como clara. */
const ESCURO_ABAIXO = 85;
const CLARO_ACIMA = 100;

/**
 * Uma câmera: o brilho médio, amaciado entre quadros (o fator de 0,8 leva ~1 s a 15 por segundo), com a folga entre os dois
 * limites, para a troca não ir e voltar numa luz no meio do caminho.
 */
function criarLuz() {
  let media = /** @type {number | null} */ (null);
  let escuro = false;
  /** @param {Uint8Array} px RGBA @returns {boolean} se a câmera está escura agora */
  return function medir(px) {
    let soma = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 16) {
      soma += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      n++;
    }
    const agora = n ? soma / n : 128;
    media = media === null ? agora : 0.8 * media + 0.2 * agora;
    if (escuro && media > CLARO_ACIMA) escuro = false;
    else if (!escuro && media < ESCURO_ABAIXO) escuro = true;
    return escuro;
  };
}

module.exports = { decisorInicial, nivelAgora, nivelDaCamera, criarLuz, ESCURO_ABAIXO, CLARO_ACIMA, comPlaca, comJogo, comTempo, LIMITE_MS, LIMITE_DA_ABERTURA_MS, LENTOS_PARA_DESCER, FOLGA_DO_JOGO_MS, FOLGA_DO_APERTO_MS };
