// Ponte da janelinha que fica por cima do jogo. Ela só RECEBE — não manda nada de volta, não tem
// botão, não tem clique (o Electron a deixa atravessável). Uma função só, e é o suficiente.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sydenSobreposicao', {
  /** Recebe a lista de quem está na chamada: [{ nome, falando, mudo }]. */
  aoReceber: (callback) => {
    ipcRenderer.on('sobreposicao:lista', (_evento, pessoas) => callback(pessoas));
  },
});
