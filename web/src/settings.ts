import { useSyncExternalStore } from 'react';
import type { Paleta, Theme } from './theme';
import { guardarEmBreve } from './preferencias';

// Preferências de cada pessoa. Ficam neste computador E sobem para o servidor, para seguirem com
// ela ao trocar de navegador — menos os ids de microfone, alto-falante e câmera, que identificam um
// APARELHO e não fariam sentido na outra máquina. A separação está em preferencias.ts.

/**
 * Dois modos, e não três. O "Leve" saiu em 11/10/2026: a tela dizia "para internet mais fraca", mas o
 * que ele fazia era segurar a nitidez e sacrificar os quadros — quem jogava com internet fraca escolhia
 * o Leve e transmitia uma sequência de fotos, sem nada avisar. Quem o tinha guardado vira Padrão (ver
 * converterPreferenciasAntigas).
 */
export type ScreenQuality = 'standard' | 'smooth';

export interface Settings {
  /** Ids de dispositivo; '' = o padrão do sistema. */
  audioInput: string;
  audioOutput: string;
  videoInput: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  screenQuality: ScreenQuality;
  /** Cores do app: escuro (padrão) ou claro. */
  theme: Theme;
  /** A paleta do tema escuro, escolhida em Aparência (ver theme.ts). */
  paleta: Paleta;
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
  /** No palco da call: os cartões de quem está sem câmera (botão direito num quadro, como no Discord). */
  mostrarSemVideo: boolean;
  /** No palco da call: o quadro da sua própria câmera. */
  mostrarMinhaCamera: boolean;
}

const DEFAULTS: Settings = {
  audioInput: '',
  audioOutput: '',
  videoInput: '',
  noiseSuppression: true,
  echoCancellation: true,
  screenQuality: 'standard',
  theme: 'dark',
  paleta: 'd4',
  startMuted: false,
  startDeafened: false,
  showMembers: true,
  abrirTransmissaoSozinha: false,
  sounds: true,
  soundboardVolume: 0.6,
  efeitosVisuais: true,
  mostrarSemVideo: true,
  mostrarMinhaCamera: true,
  notifications: true,
  corDeDestaque: null,
  escalaDoTexto: 1,
};

const STORAGE_KEY = 'janja.settings';

/**
 * Ajustes de quem JÁ USAVA o Syden, para uma mudança valer também para eles.
 *
 * Roda em TODA leitura, e não uma vez só: as preferências também descem do servidor ao entrar (ver
 * preferencias.ts), e a cópia de lá é tão antiga quanto a daqui. A lição veio do codec: uma marca de
 * "já converti" guardada só nesta máquina foi desfeita pela cópia do servidor, e a conversão nunca
 * mais aconteceu. Por isso isto é uma função pura, que dá o mesmo resultado quantas vezes rodar.
 *
 * O que ela tira são escolhas que saíram da tela (11/10/2026), e que guardadas fariam o Syden
 * transmitir de um jeito que ninguém pode mais ver nem mudar.
 */
export function converterPreferenciasAntigas(guardado: Record<string, unknown>): Record<string, unknown> {
  const { screenCodec: _codec, codecEscolhidoAMao: _aMao, qualidadeQueRecebo: _teto, ...resto } = guardado;
  // O modo "Leve" não existe mais: quem o tinha guardado passa ao Padrão.
  if (resto.screenQuality === 'light') resto.screenQuality = 'standard';
  return resto;
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
