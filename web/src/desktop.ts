// Recursos que só existem quando o site roda dentro do app de desktop (ver desktop/src/preload.js).

interface DesktopBridge {
  focus(): void;
  onShortcut(callback: (action: 'mute' | 'deafen') => void): () => void;
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
