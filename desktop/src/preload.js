// Ponte mínima entre o site (carregado na janela) e o app de desktop. O site funciona igual sem ela,
// no navegador; com ela, ganha as teclas de atalho globais e consegue trazer a janela para frente.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sydenDesktop', {
  /** Traz a janela para frente (ex.: ao clicar numa notificação). */
  focus: () => ipcRenderer.send('app:focus'),
  /** Recebe 'mute' ou 'deafen' quando a tecla de atalho global é pressionada; devolve a função que desliga. */
  onShortcut: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('app:shortcut', handler);
    return () => ipcRenderer.off('app:shortcut', handler);
  },
});
