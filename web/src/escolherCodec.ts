// Qual codec usar na transmissão de tela, perguntando ao computador em vez de adivinhando.
//
// POR QUE ISTO PRECISOU EXISTIR. O padrão era VP8 para todo mundo, e VP8 quase não tem codificador em
// placa de vídeo nenhuma: ele roda no processador, por software. Numa transmissão em 1080p — ainda por
// cima em três camadas, uma para cada qualidade que quem assiste pode pedir — isso é trabalho demais
// para a máquina de quem está jogando. O sintoma é a imagem travando para quem assiste enquanto o jogo
// continua liso para quem transmite.
//
// H.264 é o contrário: praticamente toda placa de vídeo (e todo processador com gráficos integrados)
// dos últimos dez anos tem um codificador dedicado para ele. Quando existe, a mesma imagem custa uma
// fração do processador.
//
// MAS NEM SEMPRE EXISTE, e aí H.264 vira software também — e software de H.264 costuma ser PIOR que o
// de VP8. Por isso isto não é "usar H.264 sempre": é perguntar, para esta máquina e para este tamanho
// de imagem, se o H.264 sai pela placa. É o que `mediaCapabilities.encodingInfo` responde, com o campo
// `powerEfficient` — o nome do navegador para "não é o processador que vai fazer isso".
//
// O QUE ACONTECE QUANDO NÃO DÁ PARA PERGUNTAR: fica VP8, que é o que sempre foi. Um navegador sem esta
// API não vira cobaia de um palpite.
//
// Isto decide SEMPRE. Escolher o codec à mão existiu nas Configurações e saiu em 11/10/2026 (ver
// "Transmissão: o Syden decide", no CLAUDE.md).

export type CodecDaTela = 'vp8' | 'h264';

/** O que o navegador precisa oferecer para a pergunta poder ser feita. */
interface Perguntavel {
  encodingInfo(config: unknown): Promise<{ supported?: boolean; powerEfficient?: boolean }>;
}

export interface EscolhaDeCodec {
  codec: CodecDaTela;
  /** Para escrever na tela de configurações o que o "Automático" decidiu, e por quê. */
  motivo: 'placa' | 'processador' | 'nao-deu-para-perguntar';
}

/**
 * Pergunta ao navegador se o H.264 sai pela placa neste tamanho de imagem.
 *
 * O tamanho importa: uma placa pode dar conta de 720p e não de 1080p60. Por isso a pergunta leva a
 * resolução e a taxa de quadros que a pessoa escolheu, e não um valor genérico.
 */
export async function escolherCodecDaTela(
  largura: number,
  altura: number,
  quadrosPorSegundo: number,
  capacidades: Perguntavel | undefined = (navigator as Navigator & { mediaCapabilities?: Perguntavel }).mediaCapabilities,
): Promise<EscolhaDeCodec> {
  if (!capacidades || typeof capacidades.encodingInfo !== 'function') {
    return { codec: 'vp8', motivo: 'nao-deu-para-perguntar' };
  }
  try {
    const resposta = await capacidades.encodingInfo({
      // 'webrtc' e não 'record': o que interessa é o codificador de chamada ao vivo, que é outro
      // caminho dentro do navegador e pode ter outra resposta.
      type: 'webrtc',
      video: {
        contentType: 'video/H264',
        width: largura,
        height: altura,
        bitrate: 3_000_000,
        framerate: quadrosPorSegundo,
      },
    });
    if (resposta?.supported && resposta?.powerEfficient) return { codec: 'h264', motivo: 'placa' };
    return { codec: 'vp8', motivo: 'processador' };
  } catch {
    // Navegador que não conhece o tipo 'webrtc' recusa a pergunta inteira. Não é erro de ninguém.
    return { codec: 'vp8', motivo: 'nao-deu-para-perguntar' };
  }
}
