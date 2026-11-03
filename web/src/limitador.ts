// Um teto para o som, no caminho de tudo o que não é voz.
//
// POR QUE EXISTE: um amigo levou um estouro no ouvido. Os sons que o Syden sintetiza são baixos (0,12) e
// nenhum controle de volume passa de 100%, então o problema não estava no volume — estava no PICO. Som
// que chega cru (um arquivo de soundboard gravado estourado, o áudio de um jogo com o sistema no talo)
// pode ter picos muito acima do que o resto toca, e aí a diferença entre uma conversa e um grito é de
// vinte vezes.
//
// Um limitador resolve o que o controle de volume não resolve: ele deixa o som normal passar intocado e
// só age quando o pico ultrapassa o teto, achatando o excesso. A pessoa não percebe nada no uso comum, e
// não leva mais susto.
//
// NÃO É COMPRESSÃO DE ESTÚDIO. Os valores abaixo são de "brick wall": corta acima do teto, com ataque
// quase instantâneo, e não fica apertando o som o tempo todo.

/** O teto, em decibéis. -6 dB deixa boa folga do estouro (0 dB) sem espremer o som comum. */
const TETO_DB = -6;

/**
 * Põe um limitador entre `origem` e o destino do contexto, e devolve o nó em que se deve ligar a origem.
 *
 * Devolve `null` quando o navegador não tem o nó (nenhum atual deixa de ter, mas som é um extra: não
 * vale derrubar a reprodução por causa disso).
 */
/**
 * O limitador do REFORÇO (a voz e o som da transmissão acima de 100%, em voiceVolumes.ts), sem ligar em nada: quem monta
 * o caminho é o LiveKit, e o ganho vem DEPOIS destes nós.
 *
 * DOIS NÓS, E NÃO UM (revisão de 02/11/2026, medido no navegador): o compressor do Web Audio aplica sozinho um ganho de
 * compensação (a especificação não deixa desligar), uns +3,4 dB com estes valores. Com ele, passar de 100% para 105% subia
 * o som de uma vez (quase 4 dB), e o pico, dobrado, passava de 0 dB e estourava. O segundo nó desfaz essa compensação,
 * pela mesma conta da especificação: abaixo do teto o som sai como entrou, e o pico sai no teto. O teto é -7 dB para o
 * dobro (o máximo da régua) ainda ficar abaixo de 0 dB.
 */
const TETO_DO_REFORCO_DB = -7;
const RAZAO = 20;
export function criarTeto(ctx: BaseAudioContext): AudioNode[] | null {
  try {
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = TETO_DO_REFORCO_DB;
    limitador.knee.value = 0;
    limitador.ratio.value = RAZAO;
    limitador.attack.value = 0.003;
    limitador.release.value = 0.25;
    // A especificação: makeup = (1 / curva(0 dBFS)) ^ 0,6. Com joelho zero, curva(0 dBFS) = teto + (0 - teto) / razão.
    const curvaEmZeroDb = TETO_DO_REFORCO_DB - TETO_DO_REFORCO_DB / RAZAO;
    const compensacao = ctx.createGain();
    compensacao.gain.value = 10 ** ((0.6 * curvaEmZeroDb) / 20);
    return [limitador, compensacao];
  } catch {
    return null;
  }
}

export function comTeto(ctx: BaseAudioContext, destino: AudioNode = (ctx as AudioContext).destination): AudioNode | null {
  try {
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = TETO_DB;
    // Joelho zero e proporção altíssima: é o que transforma um compressor em muro. Com joelho suave, o
    // som começaria a ser apertado bem antes do teto e tudo soaria abafado.
    limitador.knee.value = 0;
    limitador.ratio.value = 20;
    // Ataque quase instantâneo, para pegar o estalo — que é justamente o que machuca o ouvido.
    limitador.attack.value = 0.003;
    limitador.release.value = 0.25;
    limitador.connect(destino);
    return limitador;
  } catch {
    return null;
  }
}
