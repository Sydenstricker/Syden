// Recursos que só existem quando o site roda dentro do app de desktop (ver desktop/src/preload.js).

interface DesktopBridge {
  focus(): void;
  onShortcut(callback: (action: 'mute' | 'deafen') => void): () => void;
}

export const desktopBridge: DesktopBridge | undefined = (window as unknown as { sydenDesktop?: DesktopBridge }).sydenDesktop;

export const SHORTCUT_LABELS = { mute: 'Ctrl + Alt + M', deafen: 'Ctrl + Alt + D' };
