import { useSyncExternalStore } from 'react';
import type { Theme } from './theme';
import { guardarEmBreve } from './preferencias';

// Preferências de cada pessoa. Ficam neste computador E sobem para o servidor, para seguirem com
// ela ao trocar de navegador — menos os ids de microfone, alto-falante e câmera, que identificam um
// APARELHO e não fariam sentido na outra máquina. A separação está em preferencias.ts.

export type ScreenQuality = 'light' | 'standard' | 'smooth';

/**
 * O teto do que ESTE computador baixa das transmissões dos outros.
 *
 * Não muda nada para quem transmite: a pessoa continua mandando a mesma coisa, e o servidor manda
 * para cá só a camada que cabe. Serve para internet medida, para computador que esquenta e,
 * principalmente, para quem assiste pelo celular — onde a imagem é pequena e os dados são caros.
 *
 * 'auto' é o de sempre: a qualidade acompanha o tamanho do quadro na tela e o que a internet aguenta.
 */
export type QualidadeQueRecebo = 'auto' | 'media' | 'baixa';

export interface Settings {
  /** Ids de dispositivo; '' = o padrão do sistema. */
  audioInput: string;
  audioOutput: string;
  videoInput: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  screenQuality: ScreenQuality;
  /** O teto do que este computador BAIXA das transmissões dos outros. */
  qualidadeQueRecebo: QualidadeQueRecebo;
  /** Cores do app: escuro (padrão) ou claro. */
  theme: Theme;
  /** Microfone e áudio desligados de propósito, valendo já fora da chamada e ao entrar na próxima. */
  startMuted: boolean;
  startDeafened: boolean;
  /** Mostrar a lista de pessoas à direita também dentro das salas de voz. */
  showMembers: boolean;
  /**
   * Abrir a transmissão dos outros sozinho ao entrar na sala. Desligado: a transmissão aparece como convite
   * e só é baixada quando você clica em "Assistir" — o que poupa internet e processador de todo mundo.
   */
  abrirTransmissaoSozinha: boolean;
  /**
   * Codec da transmissão de tela.
   *
   * 'auto' pergunta ao computador, na hora de transmitir, se o H.264 sai pela PLACA DE VÍDEO naquele
   * tamanho de imagem — e só então o usa. É o padrão porque a resposta certa depende da máquina, e
   * ninguém deveria precisar saber o que é um codec para transmitir sem travar. Ver escolherCodec.ts.
   */
  screenCodec: 'auto' | 'vp8' | 'h264';
  /**
   * A pessoa escolheu o codec À MÃO? Enquanto não escolheu, um 'vp8' guardado é só o padrão antigo.
   *
   * ISTO PRECISA VIAJAR JUNTO COM AS PREFERÊNCIAS, e é por isso que mora aqui dentro e não numa marca
   * à parte. A primeira versão usava uma marca local, e ela foi derrotada pelo caminho de volta: a
   * conversão acontecia, o servidor devolvia a cópia antiga na hora de entrar, e a marca local dizia
   * "já converti" — então da segunda vez em diante voltava a VP8 para sempre. Com a marca dentro do
   * pacote, a cópia que vem do servidor também chega com ela, e a conversão sabe o que fazer.
   */
  codecEscolhidoAMao?: boolean;
  /** Sons de entrada, saída, mudo etc. */
  sounds: boolean;
  /** Volume dos sons do soundboard tocados na sala (0 a 1). */
  soundboardVolume: number;
  /** Confete, fogos e corações que qualquer um da sala manda. Desligado, nem vê nem manda. */
  efeitosVisuais: boolean;
  /** Notificação do Windows para mensagens novas quando o Syden não está em primeiro plano. */
  notifications: boolean;
  /**
   * A cor de destaque escolhida pela pessoa, em #rrggbb. null = o azul do Syden.
   *
   * Guardada COMO ESCOLHIDA, e não como vai para a tela: quem aplica escurece o quanto for preciso
   * para o texto branco caber (ver corDeDestaque.ts). Guardando a já escurecida, a pessoa reabriria
   * o seletor e veria uma cor que não foi a que ela escolheu.
   */
  corDeDestaque: string | null;
  /** Acessibilidade → Tamanho do texto. Multiplica todo tamanho de letra do app; 1 é o de sempre. */
  escalaDoTexto: number;
}

const DEFAULTS: Settings = {
  audioInput: '',
  audioOutput: '',
  videoInput: '',
  noiseSuppression: true,
  echoCancellation: true,
  screenQuality: 'standard',
  qualidadeQueRecebo: 'auto',
  theme: 'dark',
  startMuted: false,
  startDeafened: false,
  showMembers: true,
  abrirTransmissaoSozinha: false,
  screenCodec: 'auto',
  codecEscolhidoAMao: false,
  sounds: true,
  soundboardVolume: 0.6,
  efeitosVisuais: true,
  notifications: true,
  corDeDestaque: null,
  escalaDoTexto: 1,
};

const STORAGE_KEY = 'janja.settings';

/**
 * Ajustes de quem JÁ USAVA o Syden, para uma escolha nova valer também para eles.
 *
 * PADRÃO NOVO NÃO ALCANÇA QUEM JÁ TEM PREFERÊNCIA GUARDADA — e isso quase fez o "automático" do codec
 * nascer valendo só para contas novas. Todo mundo que já tinha aberto o Syden tinha 'vp8' salvo, não
 * porque escolheu, mas porque era o padrão da época; o novo padrão passaria por cima dele e não
 * mudaria nada na prática.
 *
 * Só se converte o que era o PADRÃO ANTIGO, e uma vez só (a marca abaixo). Quem tiver escolhido H.264
 * à mão continua com H.264, e quem escolher VP8 depois desta conversão continua com VP8.
 */
/**
 * Ajustes de quem JÁ USAVA o Syden, para uma escolha nova valer também para eles.
 *
 * PADRÃO NOVO NÃO ALCANÇA QUEM JÁ TEM PREFERÊNCIA GUARDADA — e isso quase fez o "automático" do codec
 * nascer valendo só para contas novas. Todo mundo que já tinha aberto o Syden tinha 'vp8' salvo, não
 * porque escolheu, mas porque era o padrão da época.
 *
 * Só se converte o que era o PADRÃO ANTIGO e nunca foi escolhido à mão. Quem escolher VP8 depois
 * disto continua com VP8 — inclusive porque a escolha grava a marca.
 *
 * Roda em TODA leitura, e não uma vez só: as preferências também descem do servidor ao entrar (ver
 * preferencias.ts), e a cópia de lá é tão antiga quanto a daqui.
 */
export function converterPreferenciasAntigas(guardado: Record<string, unknown>): Record<string, unknown> {
  if (guardado.screenCodec !== 'vp8' || guardado.codecEscolhidoAMao === true) return guardado;
  return { ...guardado, screenCodec: 'auto' };
}

function load(): Settings {
  try {
    const guardado = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { ...DEFAULTS, ...converterPreferenciasAntigas(guardado) } as Settings;
  } catch {
    return DEFAULTS;
  }
}

/**
 * Relê o que está no disco. Chamado depois de as preferências descerem do servidor — sem isto, elas
 * ficavam gravadas mas só valiam no próximo carregamento da página.
 */
export function recarregarDoDisco() {
  current = load();
  for (const listener of listeners) listener();
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Sem localStorage: vale só até fechar o app.
  }
  for (const listener of listeners) listener();
  guardarEmBreve();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Para quem precisa reagir a uma mudança fora do React (aplicar algo no documento, por exemplo). */
export const aoMudarAjustes = subscribe;

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
