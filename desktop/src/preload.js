// Ponte mínima entre o site (carregado na janela) e o app de desktop. O site funciona igual sem ela,
// no navegador; com ela, ganha as teclas de atalho globais e consegue trazer a janela para frente.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sydenDesktop', {
  /** Traz a janela para frente (ex.: ao clicar numa notificação). */
  focus: () => ipcRenderer.send('app:focus'),
  /** Põe o número de avisos sobre o ícone na barra de tarefas. selo = PNG pronto (data URL), ou null. */
  setBadge: (quantas, selo) => ipcRenderer.send('app:badge', { quantas, selo }),
  /** Pinta a barra de título (que é do Windows, não do site) com as cores do tema escolhido. */
  setTitleBarTheme: (cores) => ipcRenderer.send('app:title-bar', cores),
  /**
   * Som da transmissão sem a própria chamada dentro (só no Windows, com o módulo nativo instalado).
   * start() responde { ok, source }; onChunk entrega pedaços de som (Float32, dois canais, 48 kHz).
   */
  screenAudio: {
    available: () => ipcRenderer.invoke('screen-audio:available'),
    start: () => ipcRenderer.invoke('screen-audio:start'),
    stop: () => ipcRenderer.send('screen-audio:stop'),
    onChunk: (callback) => {
      const handler = (_event, pcm) => callback(pcm);
      ipcRenderer.on('screen-audio:chunk', handler);
      return () => ipcRenderer.off('screen-audio:chunk', handler);
    },
  },
  /** Recebe 'mute' ou 'deafen' quando a tecla de atalho global é pressionada; devolve a função que desliga. */
  onShortcut: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('app:shortcut', handler);
    return () => ipcRenderer.off('app:shortcut', handler);
  },
});
