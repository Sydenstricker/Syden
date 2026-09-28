// Recursos que só existem quando o site roda dentro do app de desktop (ver desktop/src/preload.js).

interface DesktopBridge {
  focus(): void;
  onShortcut(callback: (action: 'mute' | 'deafen') => void): () => void;
  /** Abre um endereço no navegador do sistema, fora do app. */
  abrirFora?(url: string): void;
  /** Avisa quando a pessoa volta do Google pelo endereço syden://. Devolve como parar de escutar. */
  aoVoltarDaEntrada?(callback: (url: string) => void): () => void;
  /** Os idiomas preferidos do sistema, em ordem. No navegador isto não existe: lá vale navigator.languages. */
  idiomasDoSistema?(): string[];
  /** O título da janela escolhida no seletor do app ("League of Legends"), ou null. */
  telaEscolhida?(): string | null;
  /** Pinta a barra de título do app (desenhada pelo Windows) com as cores do tema. */
  setTitleBarTheme?(cores: { color: string; symbolColor: string }): void;
  /**
   * Põe o número vermelho sobre o ícone na barra de tarefas. O desenho vai pronto (data URL) porque
   * quem sabe desenhar é o navegador; o processo principal só o coloca sobre o ícone. `null` limpa.
   */
  setBadge?(quantas: number, selo: string | null): void;
  /** Som do computador sem o do próprio Syden; só existe no Windows, com o módulo nativo. */
  screenAudio?: {
    available(): Promise<boolean>;
    start(): Promise<{ ok: boolean; source: 'native' | 'fake' | null }>;
    stop(): void;
    onChunk(callback: (pcm: Float32Array) => void): () => void;
  };
}

export const desktopBridge: DesktopBridge | undefined = (window as unknown as { sydenDesktop?: DesktopBridge }).sydenDesktop;

export const SHORTCUT_LABELS = { mute: 'Ctrl + Alt + M', deafen: 'Ctrl + Alt + D' };
