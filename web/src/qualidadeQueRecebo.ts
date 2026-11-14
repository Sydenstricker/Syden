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
 * O COMPUTADOR DE QUEM ASSISTE ESTÁ APERTADO, SEM FOCO (ver apertoDeQuemAssiste.ts): a tela e as câmeras dos outros
 * descem à versão menor. Mora aqui, e não num parâmetro, porque o teto é reaplicado de vários lugares (alguém chegou,
 * a economia mudou) e todos precisam respeitá-lo.
 */
let apertado = false;
const camerasBaixadas = new WeakSet<RemoteTrackPublication>();
export const apertadoParaAssistir = () => apertado;
export function definirAperto(valor: boolean) {
  apertado = valor;
}

/**
 * Aplica o teto a uma publicação de vídeo.
 *
 * A economia de dados só mexe na TELA: câmera é um quadradinho e já custa pouco em dados, e cortar a qualidade do
 * rosto de alguém para economizar não é uma troca que valha a pena. O aperto mexe nas duas, porque ali o custo é o de
 * DECODIFICAR, que existe também para a câmera (e ninguém está olhando de perto: a janela está sem foco).
 */
export function aplicarTeto(publicacao: RemoteTrackPublication, economizar = economizandoDados()) {
  const tela = publicacao.source === Track.Source.ScreenShare;
  if (!tela && publicacao.source !== Track.Source.Camera) return;
  if (!tela && !apertado && !camerasBaixadas.has(publicacao)) return; // câmera nunca apertada: como sempre foi
  try {
    if (!tela) {
      if (apertado) camerasBaixadas.add(publicacao);
      else camerasBaixadas.delete(publicacao);
    }
    publicacao.setVideoQuality(apertado || (tela && economizar) ? VideoQuality.LOW : maiorQualidade(publicacao));
  } catch (erro) {
    // Um pedido de qualidade que o servidor recusa não pode derrubar a sala: a imagem continua vindo
    // como vinha, que é o pior caso aceitável.
    console.error(erro);
  }
}

/**
 * "SEM TETO" É A MAIOR VERSÃO QUE A TRANSMISSÃO TEM, NÃO "ALTA" (12/11/2026, achado pelo `e2e/versoes-da-tela.mjs`). O LiveKit
 * rotula as versões pela ordem: com duas (540p e 1080p), elas são "baixa" e "média", e não existe "alta". Pedindo "alta"
 * sem camada alta, ele joga fora o tamanho do quadro na tela e pede a maior: quem assistia num quadro de 660 px recebia
 * 1080p, e o celular em pé também. Pedindo a maior que existe, o tamanho do quadro volta a decidir abaixo dela.
 */
export function maiorQualidade(publicacao: Pick<RemoteTrackPublication, 'trackInfo'>): VideoQuality {
  // As camadas vêm com a qualidade do protocolo, que tem os mesmos números (0 baixa, 1 média, 2 alta).
  const qualidades = (publicacao.trackInfo?.layers ?? []).map((c) => Number(c.quality)).filter((q) => q >= VideoQuality.LOW && q <= VideoQuality.HIGH);
  return qualidades.length === 0 ? VideoQuality.HIGH : (Math.max(...qualidades) as VideoQuality);
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
