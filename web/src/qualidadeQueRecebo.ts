// O teto do que ESTE computador baixa das transmissões de tela dos outros.
//
// POR QUE EXISTE. Quem transmite escolhe o que manda; quem assiste não escolhia nada. Numa sala com
// alguém transmitindo em 1080p, todo mundo baixa 1080p — inclusive quem está num celular, olhando um
// quadro de cinco centímetros, pagando por megabyte. A qualidade automática ajuda (ela acompanha o
// tamanho do quadro na tela), mas ela decide pela tela, não pela internet nem pela conta do mês.
//
// COMO FUNCIONA, e por que isto não mexe em quem transmite: o LiveKit publica a mesma transmissão em
// camadas (ver SCREEN_LAYERS em useVoice.ts). Dizer "quero no máximo a do meio" é um pedido ao
// SERVIDOR, que passa a mandar só aquela para cá. Quem transmite não muda nada, e quem assiste do
// lado não é afetado — cada um pede o seu.
//
// O nome é "teto", e não "qualidade": abaixo dele a escolha automática continua valendo. Escolher
// "baixa" numa internet ruim não força nada a subir; só impede de subir demais.
import { RemoteTrackPublication, Track, VideoQuality, type Room } from 'livekit-client';
import { getSettings, type QualidadeQueRecebo } from './settings';

/** O que cada escolha pede ao servidor. 'auto' é o de sempre: sem teto, só a adaptação automática. */
const TETO: Record<QualidadeQueRecebo, VideoQuality> = {
  auto: VideoQuality.HIGH,
  media: VideoQuality.MEDIUM,
  baixa: VideoQuality.LOW,
};

/**
 * Aplica o teto a uma publicação de tela.
 *
 * Só mexe em transmissão de TELA: câmera é um quadradinho e já custa pouco, e cortar a qualidade do
 * rosto de alguém para economizar não é uma troca que valha a pena.
 */
export function aplicarTeto(publicacao: RemoteTrackPublication, escolha = getSettings().qualidadeQueRecebo) {
  if (publicacao.source !== Track.Source.ScreenShare) return;
  try {
    publicacao.setVideoQuality(TETO[escolha] ?? VideoQuality.HIGH);
  } catch (erro) {
    // Um pedido de qualidade que o servidor recusa não pode derrubar a sala: a imagem continua vindo
    // como vinha, que é o pior caso aceitável.
    console.error(erro);
  }
}

/** Aplica o teto em tudo o que já está na sala. Chamado ao escolher, e a cada transmissão nova. */
export function aplicarTetoEmTodas(room: Room, escolha = getSettings().qualidadeQueRecebo) {
  for (const pessoa of room.remoteParticipants.values()) {
    for (const publicacao of pessoa.trackPublications.values()) {
      if (publicacao instanceof RemoteTrackPublication) aplicarTeto(publicacao, escolha);
    }
  }
}
