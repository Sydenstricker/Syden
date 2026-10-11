// O teto do que ESTE computador baixa das transmissões de tela dos outros.
//
// QUEM DECIDE É O SYDEN, NÃO A PESSOA (11/10/2026). Existia um "Baixar até: Automático, Média, Baixa"
// no "i" da transmissão, e ele saiu: para internet ruim, o automático já desce de camada sozinho (o
// servidor acompanha a banda de quem assiste, e o adaptiveStream, o tamanho do quadro na tela); "Média"
// e "Baixa" não diziam nada a quem não sabe o que é 720p; e no Fluido, que manda uma camada só, os
// botões não faziam nada. Manter a transmissão boa é trabalho do aplicativo, não de quem assiste.
//
// O ÚNICO CASO QUE O AUTOMÁTICO NÃO COBRIA: dados contados no celular. Uma internet boa e cara baixa a
// camada maior sem ninguém pedir. Para isso existe um sinal do próprio aparelho — o modo de economia de
// dados (Android, Chrome), que chega à página como `navigator.connection.saveData`. Ligado, o Syden
// baixa a camada menor. É a preferência que a pessoa JÁ configurou no aparelho, como o idioma.
//
// COMO FUNCIONA, e por que isto não mexe em quem transmite: o LiveKit publica a mesma transmissão em
// camadas (ver SCREEN_LAYERS em useVoice.ts). Pedir a menor é um pedido ao SERVIDOR, que passa a mandar
// só aquela para cá. Quem transmite não muda nada, e quem assiste do lado não é afetado.
import { RemoteTrackPublication, Track, VideoQuality, type Room } from 'livekit-client';

interface Conexao extends EventTarget {
  saveData?: boolean;
}

function conexao(): Conexao | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: Conexao }).connection;
}

/** O aparelho está em modo de economia de dados? Onde o navegador não conta (desktop, Firefox), não. */
export function economizandoDados(): boolean {
  return conexao()?.saveData === true;
}

/**
 * Aplica o teto a uma publicação de tela.
 *
 * Só mexe em transmissão de TELA: câmera é um quadradinho e já custa pouco, e cortar a qualidade do
 * rosto de alguém para economizar não é uma troca que valha a pena.
 */
export function aplicarTeto(publicacao: RemoteTrackPublication, economizar = economizandoDados()) {
  if (publicacao.source !== Track.Source.ScreenShare) return;
  try {
    publicacao.setVideoQuality(economizar ? VideoQuality.LOW : VideoQuality.HIGH);
  } catch (erro) {
    // Um pedido de qualidade que o servidor recusa não pode derrubar a sala: a imagem continua vindo
    // como vinha, que é o pior caso aceitável.
    console.error(erro);
  }
}

/** Aplica o teto em tudo o que já está na sala. Chamado a cada transmissão nova. */
export function aplicarTetoEmTodas(room: Room, economizar = economizandoDados()) {
  for (const pessoa of room.remoteParticipants.values()) {
    for (const publicacao of pessoa.trackPublications.values()) {
      if (publicacao instanceof RemoteTrackPublication) aplicarTeto(publicacao, economizar);
    }
  }
}

/**
 * Avisa quando a pessoa liga ou desliga a economia de dados no meio da chamada. Devolve como parar.
 * Onde o navegador não informa a conexão, não há o que escutar.
 */
export function aoMudarEconomia(callback: () => void): () => void {
  const alvo = conexao();
  if (!alvo || typeof alvo.addEventListener !== 'function') return () => {};
  alvo.addEventListener('change', callback);
  return () => alvo.removeEventListener('change', callback);
}
