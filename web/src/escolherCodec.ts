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

export type CodecDaTela = 'vp8' | 'h264' | 'vp9';

/** O que o navegador precisa oferecer para a pergunta poder ser feita. */
interface Perguntavel {
  encodingInfo(config: unknown): Promise<{ supported?: boolean; powerEfficient?: boolean }>;
}

export interface EscolhaDeCodec {
  codec: CodecDaTela;
  /** Por que o automático decidiu assim (aparece no diário e ajuda a entender um relato). */
  motivo: 'placa' | 'processador' | 'nao-deu-para-perguntar';
}

/**
 * O VP9 VEM PRIMEIRO, MAS SÓ PELA PLACA (11/10/2026). Ele comprime uns 30% melhor que o VP8 e que o
 * H.264 — menos internet para quem manda e para quem assiste —, e é ainda melhor com texto. Por software
 * ele custa 1,5 a 2 vezes o processador do VP8, e quem transmite costuma estar jogando: por isso nunca
 * por software. Na prática é a placa Intel recente que o codifica; NVIDIA e AMD não, e aí segue a pergunta
 * do H.264, como antes. Ninguém escolhe nada: a pergunta é ao computador de quem transmite.
 *
 * A pergunta leva `scalabilityMode: 'L1T3'` porque é ASSIM que o VP9 sai na tela: o LiveKit publica cada
 * camada de tamanho como um VP9 separado, de uma camada só (ver useVoice.ts). Uma placa que codifica VP9
 * mas não desse jeito responde "não", e o Syden não descobre isso no meio da transmissão.
 */
async function saiPelaPlaca(
  capacidades: Perguntavel,
  contentType: string,
  largura: number,
  altura: number,
  quadrosPorSegundo: number,
  extra: Record<string, unknown> = {},
) {
  const resposta = await capacidades.encodingInfo({
    // 'webrtc' e não 'record': o que interessa é o codificador de chamada ao vivo, que é outro
    // caminho dentro do navegador e pode ter outra resposta.
    type: 'webrtc',
    video: { contentType, width: largura, height: altura, bitrate: 3_000_000, framerate: quadrosPorSegundo, ...extra },
  });
  return Boolean(resposta?.supported && resposta?.powerEfficient);
}

/**
 * Pergunta ao navegador qual codec sai pela placa neste tamanho de imagem: VP9, depois H.264.
 *
 * O tamanho importa: uma placa pode dar conta de 720p e não de 1080p60. Por isso a pergunta leva a
 * resolução e a taxa de quadros do modo escolhido, e não um valor genérico.
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
    // A do VP9 pode falhar sozinha (navegador que não conhece scalabilityMode): aí só ela não vale.
    const vp9 = await saiPelaPlaca(capacidades, 'video/VP9', largura, altura, quadrosPorSegundo, { scalabilityMode: 'L1T3' }).catch(
      () => false,
    );
    if (vp9) return { codec: 'vp9', motivo: 'placa' };
    if (await saiPelaPlaca(capacidades, 'video/H264', largura, altura, quadrosPorSegundo)) return { codec: 'h264', motivo: 'placa' };
    return { codec: 'vp8', motivo: 'processador' };
  } catch {
    // Navegador que não conhece o tipo 'webrtc' recusa a pergunta inteira. Não é erro de ninguém.
    return { codec: 'vp8', motivo: 'nao-deu-para-perguntar' };
  }
}
