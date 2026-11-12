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
// A PERGUNTA MENTE NA NVIDIA (medido em 12/11/2026, relato dele com uma RTX 3070: "Recomendado: Padrão, a placa não
// codifica 60 quadros"). No Chrome e no Edge 157, `encodingInfo` responde `powerEfficient: false` para TUDO (H.264,
// VP9, AV1, até 720p), com ou sem captura aberta, e a transmissão de verdade sai pela placa ("NVIDIA H.264 Encoder MFT",
// `powerEfficientEncoder: true` nas estatísticas). Quem tinha NVIDIA transmitia em VP8 pelo processador. Por isso, quando
// ela diz não, pergunta-se também ao WebCodecs (`VideoEncoder.isConfigSupported` com `prefer-hardware`), que
// acertou nas quatro (H.264 sim; VP9, AV1 e VP8 não, que é o que a RTX 3070 faz). Os dois são caminhos diferentes dentro
// do navegador; se um dia o WebCodecs disser sim e o WebRTC codificar por software, o H.264 por software custa perto
// do VP8, e o diário mostra.
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

/** A segunda pergunta, ao WebCodecs: este codificador existe NA PLACA? */
export type PerguntaAoCodificador = (config: Record<string, unknown>) => Promise<{ supported?: boolean }>;

const doWebCodecs: PerguntaAoCodificador | undefined =
  typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function'
    ? (config) => VideoEncoder.isConfigSupported(config as unknown as VideoEncoderConfig)
    : undefined;

/** O nome do codec no WebCodecs. O H.264 vai no perfil alto, no nível que cabe o tamanho e a taxa (4.2 para 1080p60). */
function codecDoWebCodecs(contentType: string, largura: number, altura: number, quadrosPorSegundo: number) {
  if (contentType === 'video/VP9') return 'vp09.00.40.08';
  const macroblocosPorSegundo = Math.ceil(largura / 16) * Math.ceil(altura / 16) * quadrosPorSegundo;
  return macroblocosPorSegundo > 522_240 ? 'avc1.640033' : macroblocosPorSegundo > 245_760 ? 'avc1.64002A' : 'avc1.640028';
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
  capacidades: Perguntavel | undefined,
  codificador: PerguntaAoCodificador | undefined,
  contentType: string,
  largura: number,
  altura: number,
  quadrosPorSegundo: number,
  extra: Record<string, unknown> = {},
) {
  if (capacidades) {
    const resposta = await capacidades
      .encodingInfo({
        // 'webrtc' e não 'record': o que interessa é o codificador de chamada ao vivo, que é outro
        // caminho dentro do navegador e pode ter outra resposta.
        type: 'webrtc',
        video: { contentType, width: largura, height: altura, bitrate: 3_000_000, framerate: quadrosPorSegundo, ...extra },
      })
      // Sem a segunda pergunta, o erro sobe (e vira "não deu para perguntar"); com ela, quem responde é ela.
      .catch((erro: unknown) => {
        if (!codificador) throw erro;
        return null;
      });
    if (resposta?.supported && resposta?.powerEfficient) return true;
  }
  if (!codificador) return false;
  const resposta = await codificador({
    codec: codecDoWebCodecs(contentType, largura, altura, quadrosPorSegundo),
    width: largura,
    height: altura,
    framerate: quadrosPorSegundo,
    bitrate: 3_000_000,
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'realtime',
    ...extra,
  }).catch(() => null);
  return Boolean(resposta?.supported);
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
  codificador: PerguntaAoCodificador | undefined = doWebCodecs,
): Promise<EscolhaDeCodec> {
  const temEncodingInfo = Boolean(capacidades && typeof capacidades.encodingInfo === 'function');
  if (!temEncodingInfo && !codificador) {
    return { codec: 'vp8', motivo: 'nao-deu-para-perguntar' };
  }
  const perguntavel = temEncodingInfo ? capacidades : undefined;
  try {
    // A do VP9 pode falhar sozinha (navegador que não conhece scalabilityMode): aí só ela não vale.
    const vp9 = await saiPelaPlaca(perguntavel, codificador, 'video/VP9', largura, altura, quadrosPorSegundo, {
      scalabilityMode: 'L1T3',
    }).catch(() => false);
    if (vp9) return { codec: 'vp9', motivo: 'placa' };
    if (await saiPelaPlaca(perguntavel, codificador, 'video/H264', largura, altura, quadrosPorSegundo)) {
      return { codec: 'h264', motivo: 'placa' };
    }
    return { codec: 'vp8', motivo: 'processador' };
  } catch {
    // Navegador que não conhece o tipo 'webrtc' recusa a pergunta inteira. Não é erro de ninguém.
    return { codec: 'vp8', motivo: 'nao-deu-para-perguntar' };
  }
}
