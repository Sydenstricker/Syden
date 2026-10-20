// Ponte mínima entre o site (carregado na janela) e o app de desktop. O site funciona igual sem ela,
// no navegador; com ela, ganha as teclas de atalho globais e consegue trazer a janela para frente.
const { contextBridge, ipcRenderer } = require('electron');

// O nome da janela escolhida no seletor. Fica guardado aqui, e não entregue por evento, porque quem
// precisa dele (o site) só vai perguntar depois que a transmissão começar — e aí o evento já passou.
let ultimaTelaEscolhida = null;
// A caixinha "compartilhar áudio" do seletor, na mesma escolha. null = app antigo, que não contava.
let ultimoSomEscolhido = null;
// O executável dono da janela escolhida ("dota2.exe"), para o gênero do jogo. null = tela inteira ou app antigo.
let ultimoProgramaEscolhido = null;
ipcRenderer.on('tela:escolhida', (_event, escolha) => {
  // Versões antigas do processo principal mandavam só o nome; este preload vai junto com ele, mas o
  // formato velho não custa nada aceitar.
  if (typeof escolha === 'string' || escolha === null) {
    ultimaTelaEscolhida = escolha;
    ultimoSomEscolhido = null;
    ultimoProgramaEscolhido = null;
    return;
  }
  ultimaTelaEscolhida = escolha.nome ?? null;
  ultimoSomEscolhido = typeof escolha.som === 'boolean' ? escolha.som : null;
  ultimoProgramaEscolhido = typeof escolha.programa === 'string' ? escolha.programa : null;
});

contextBridge.exposeInMainWorld('sydenDesktop', {
  /**
   * O título da janela escolhida da última vez no seletor de tela ("League of Legends").
   *
   * O navegador não entrega isso de jeito nenhum: o rótulo da faixa de vídeo é um código interno, de
   * propósito, para uma página não descobrir que programas você tem abertos. Dentro do app a escolha
   * passa pelo nosso seletor, então o título é sabido — e é só aqui que ele pode vir.
   */
  telaEscolhida: () => ultimaTelaEscolhida,
  /**
   * Se a caixinha "compartilhar áudio" ficou marcada no seletor.
   *
   * Com o módulo de som, o som da transmissão não vem do seletor: o site liga a captura por fora
   * (screenAudio, abaixo). Sem esta resposta o site ligava SEMPRE, e desmarcar a caixinha não tirava
   * o som — que era justamente a saída para não levar as vozes do Discord junto.
   */
  somEscolhido: () => ultimoSomEscolhido,
  /**
   * O programa dono da janela escolhida no seletor ("dota2.exe"), ou null. O site só o usa para achar o GÊNERO do jogo
   * (a TV do salão mostra o nosso desenho dele); o nome do programa não é mandado a ninguém.
   */
  programaEscolhido: () => ultimoProgramaEscolhido,
  /**
   * O que o menu do Syden pediu ("tela inteira" ou "uma janela"), para o seletor abrir nessa aba.
   * Síncrono de propósito: tem de chegar ao processo principal ANTES do pedido de captura.
   */
  prepararSeletor: (tipo) => ipcRenderer.sendSync('tela:tipo', tipo),
  /**
   * Os idiomas preferidos do sistema, em ordem — a mesma coisa que `navigator.languages` no navegador.
   *
   * POR QUE ISTO PRECISOU EXISTIR. No navegador, `navigator.languages` é uma lista ordenada com a
   * preferência inteira da pessoa: ["ja","en-US","en","pt"]. Dentro do Electron ela vem com UM item só
   * — medido: ["pt-BR"]. Então a cadeia de reserva desaparece: alguém com o Windows em japonês que
   * tivesse inglês como segunda escolha acharia inglês no navegador e cairia no português dentro do app,
   * porque o Syden não teria como saber da segunda escolha. Com 74 idiomas na lista, isso ia aparecer.
   *
   * `app.getPreferredSystemLanguages()` é o que devolve a lista de verdade do sistema operacional.
   */
  idiomasDoSistema: () => ipcRenderer.sendSync('app:idiomas'),
  /**
   * Abre um endereço no navegador do sistema. Usado pela entrada social: o Google recusa OAuth dentro
   * de navegador embutido, então essa parte tem de acontecer num navegador de verdade.
   */
  abrirFora: (url) => ipcRenderer.send('app:abrir-fora', url),
  /**
   * Avisa quando a pessoa volta do Google pelo endereço syden://.
   *
   * Devolve a função de parar de escutar. Sem ela, cada vez que a tela de entrada fosse montada de
   * novo sobraria um ouvinte, e uma volta seria processada várias vezes — gastando um comprovante que
   * só serve uma vez.
   */
  aoVoltarDaEntrada: (callback) => {
    const ouvinte = (_evento, url) => callback(url);
    ipcRenderer.on('entrada:voltou', ouvinte);
    // AS CHAVES SÃO OBRIGATÓRIAS. Sem elas a seta devolveria o que removeListener devolve — o próprio
    // ipcRenderer —, e tudo o que atravessa a ponte precisa ser copiável. O erro não aparece aqui:
    // aparece do outro lado, como "An object could not be cloned", longe da causa.
    return () => {
      ipcRenderer.removeListener('entrada:voltou', ouvinte);
    };
  },
  /** Traz a janela para frente (ex.: ao clicar numa notificação). */
  focus: () => ipcRenderer.send('app:focus'),
  /** Põe o número de avisos sobre o ícone na barra de tarefas. selo = PNG pronto (data URL), ou null. */
  setBadge: (quantas, selo) => ipcRenderer.send('app:badge', { quantas, selo }),
  /** Pinta a barra de título (que é do Windows, não do site) com as cores do tema escolhido. */
  setTitleBarTheme: (cores) => ipcRenderer.send('app:title-bar', cores),
  /**
   * A faixa de idade que o Windows informa (13-15, 16-17, 18+…) e se a Microsoft a VERIFICOU. Nunca a data. O site a
   * manda ao Syden só quando verificada (ver web/src/idadeDoWindows.ts).
   */
  faixaDeIdade: () => ipcRenderer.invoke('idade:faixa'),
  /**
   * Som da transmissão sem a própria chamada dentro (só no Windows, com o módulo nativo instalado).
   * start() responde { ok, source }; onChunk entrega pedaços de som (Float32, dois canais, 48 kHz).
   */
  screenAudio: {
    available: () => ipcRenderer.invoke('screen-audio:available'),
    // { porta: true }: os pedaços vão por uma MessagePort direto ao tocador (chega como 'syden-screen-audio-porta',
    // abaixo), e não por onChunk. A resposta diz { porta: true } quando foi assim.
    start: (opcoes) => ipcRenderer.invoke('screen-audio:start', opcoes),
    stop: () => ipcRenderer.send('screen-audio:stop'),
    onChunk: (callback) => {
      const handler = (_event, pcm) => callback(pcm);
      ipcRenderer.on('screen-audio:chunk', handler);
      return () => ipcRenderer.off('screen-audio:chunk', handler);
    },
    /** O que aconteceu com a captura no meio da transmissão (morreu, religou, desistiu), para o diário de saúde. */
    onAviso: (callback) => {
      const handler = (_event, motivo) => callback(String(motivo));
      ipcRenderer.on('screen-audio:aviso', handler);
      return () => ipcRenderer.off('screen-audio:aviso', handler);
    },
  },
  /**
   * Supressão de ruído nativa (DPDFNet), num processo à parte — ver desktop/src/ruido/index.js.
   *
   * abrir() não devolve a porta: uma MessagePort não atravessa a contextBridge. Ela chega à página por
   * window.postMessage, com a mensagem 'syden-ruido-porta' — o caminho que o Electron indica para
   * entregar uma porta do preload ao site. A porta só aceita som; não abre nada além disso.
   */
  ruido: {
    disponivel: () => ipcRenderer.invoke('ruido:disponivel'),
    abrir: () => ipcRenderer.send('ruido:abrir'),
  },
  /** Recebe 'mute' ou 'deafen' quando a tecla de atalho global é pressionada; devolve a função que desliga. */
  onShortcut: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('app:shortcut', handler);
    return () => ipcRenderer.off('app:shortcut', handler);
  },
});

// A porta da supressão de ruído chega aqui e segue para a página (ver `ruido` acima). Só para a própria
// janela, na mesma origem: nenhum quadro de fora a recebe.
ipcRenderer.on('ruido:porta', (event) => {
  window.postMessage('syden-ruido-porta', window.location.origin, event.ports);
});
// A do som da transmissão, do mesmo jeito (ver screenAudio.start).
ipcRenderer.on('screen-audio:porta', (event) => {
  window.postMessage('syden-screen-audio-porta', window.location.origin, event.ports);
});
