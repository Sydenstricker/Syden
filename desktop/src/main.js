// @ts-check
const { app, BrowserWindow, Menu, Tray, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, session, shell } = require('electron');
const path = require('node:path');
const config = require('../app.config.json');
const { setupScreenAudio, screenAudioAvailable, stopScreenAudio } = require('./screen-audio');
const { setupRuido, pararRuido } = require('./ruido');
const { anotarQuemAbriu, lerQuemAbriu, mesmaInstalacao, recadoDeDoisSydens } = require('./duas-instalacoes');

// O app carrega o próprio site: melhorias publicadas no GitHub Pages chegam sem reinstalar.
const APP_URL = process.env.SYDEN_URL || process.env.JANJA_URL || (app.isPackaged ? config.url : 'http://localhost:5173');
const APP_ORIGIN = new URL(APP_URL).origin;
const ICON = path.join(__dirname, '..', 'build', 'icon.png');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let quitting = false;

/**
 * De quais endereços o app aceita carregar — e, o que mais importa, para quais ele libera microfone,
 * câmera e compartilhamento de tela.
 *
 * É uma LISTA, e não um endereço só, por uma lição aprendida: quando o site mudou de endereço, a versão
 * instalada continuou liberando o microfone apenas para o endereço antigo. O app abria, carregava a
 * página nova e negava o microfone em silêncio — a pessoa entrava na chamada e ninguém a ouvia, sem
 * nenhuma mensagem dizendo por quê. Com a lista, uma mudança de endereço deixa de ser uma armadilha.
 */
const APP_ORIGINS = new Set([APP_ORIGIN, 'https://syden.chat', 'https://sydenstricker.github.io']);

function isAppOrigin(/** @type {string | undefined} */ url) {
  try {
    return !!url && APP_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

// O app se chamava Janja; mantém a pasta de dados antiga para ninguém perder o login ao atualizar.
// A versão de desenvolvimento usa pasta e identidade próprias: se dividisse com o Syden instalado, abrir um
// desviava para a janela do outro (trava de instância única) e a barra de tarefas os misturava ao fixar.
const DEV = !app.isPackaged;
// A pasta continua chamando "Janja", e isso É DE PROPÓSITO. É onde moram as configurações, a sessão
// aberta e os dados do site dentro do app. Renomear não renomeia nada: cria uma pasta nova e vazia, e
// quem tinha o app instalado é deslogado e perde as escolhas de microfone, volume e tema. Ninguém vê
// este nome — o app, os atalhos e a barra de tarefas dizem "Syden" —, então a troca custaria incômodo
// real a quem usa em troca de nada. Dá para renomear com migração; enquanto não houver, fica.
// SYDEN_PASTA_DE_DADOS: os testes de ponta a ponta abrem o app com uma pasta nova a cada vez — também o
// app EMPACOTADO, que é o que vai para as pessoas. Sem isso, o app voltava logado como a pessoa do teste
// anterior (o cadastro novo batia num 409), e o empacotado abriria com os dados de quem roda o teste.
// Só vale quando alguém define a variável ao abrir o programa; ninguém a define por acidente.
app.setPath('userData', process.env.SYDEN_PASTA_DE_DADOS || path.join(app.getPath('appData'), DEV ? 'Janja-dev' : 'Janja'));
// A identidade do app para o Windows, em domínio ao contrário (syden.chat -> chat.syden). É por ela
// que o sistema agrupa as janelas na barra de tarefas e sabe de quem é cada notificação.
//
// TROCAR ISTO DEPOIS DE PUBLICADO TEM PREÇO: o Windows passa a entender o app como outro programa,
// instala do lado do antigo em vez de atualizar, e os atalhos fixados na barra se soltam. Foi trocado
// em 2026-09-27, quando só uma pessoa tinha o app instalado. Não se troca de novo.
const APP_USER_MODEL_ID = DEV ? 'chat.syden.app.dev' : 'chat.syden.app';

/**
 * Quem este Syden é — versão e de onde foi aberto. Serve para se comparar com um outro Syden instalado
 * no mesmo computador, que é uma situação normal (a Store e o instalador convivem) e que até aqui
 * acontecia em silêncio. O porquê inteiro está em duas-instalacoes.js.
 */
const ESTA_INSTALACAO = { versao: app.getVersion(), caminho: process.execPath };
/** Fica em userData, que é por pasta de dados — então o Syden de desenvolvimento não se mistura com o instalado. */
const ARQUIVO_DE_QUEM_ABRIU = path.join(app.getPath('userData'), 'instancia-aberta.json');

/**
 * O ENDEREÇO syden:// — é por ele que a entrada por Google, Discord, GitHub e Steam volta para o app.
 *
 * POR QUE PRECISA EXISTIR. O site manda a pessoa ao Google; o Google devolve para um endereço nosso.
 * Se esse endereço for https://syden.chat, quem abre é o NAVEGADOR — e o segredo que transforma o
 * comprovante em token ficou guardado na janela do app, não lá. O app espera para sempre e o navegador
 * mostra um erro sem explicação. Era exatamente o que acontecia: entrar com Google não funcionava no
 * app instalado.
 *
 * POR QUE NÃO ABRIR O GOOGLE DENTRO DE UMA JANELA NOSSA, que seria mais simples: o Google recusa OAuth
 * em navegador embutido, por política. O contorno conhecido é mentir o User-Agent, o que é violar a
 * política deles. A norma para aplicativos nativos (RFC 8252) manda justamente isto: navegador de
 * verdade para a parte do provedor, e um endereço próprio para o resultado voltar.
 */
const ESQUEMA = 'syden';

/**
 * Registra o esquema no Windows.
 *
 * Em desenvolvimento precisa do caminho do executável do Electron e do script, senão o Windows
 * registraria "electron.exe" solto e o app nunca receberia nada. Num pacote MSIX o Windows já registra
 * pelo manifesto, e esta chamada é inofensiva.
 */
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(ESQUEMA, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(ESQUEMA);
}

/**
 * Entrega ao site o que veio no endereço syden://.
 *
 * Guarda quando a janela ainda não existe: no Windows, clicar no link com o app fechado ABRE o app, e
 * a URL chega antes de haver qualquer página para recebê-la. Sem guardar, a entrada se perderia
 * justamente no caso mais comum — quem foi entrar é porque ainda não estava dentro.
 */
let voltaPendente = null;

function entregarVolta(url) {
  if (!url || !url.startsWith(ESQUEMA + '://')) return;
  const conteudo = mainWindow?.webContents;
  if (conteudo && !conteudo.isLoading()) conteudo.send('entrada:voltou', url);
  else voltaPendente = url;
  showMainWindow();
}

/** Acha o syden:// no meio dos argumentos da linha de comando (é assim que o Windows entrega). */
function acharNosArgumentos(argv) {
  return argv.find((a) => typeof a === 'string' && a.startsWith(ESQUEMA + '://'));
}

/**
 * A identidade vai na trava, e não só no disco: é assim que o Syden que JÁ ESTÁ ABERTO fica sabendo
 * quem tentou abrir. Um Syden anterior a esta mudança não manda nada — e essa ausência é, ela mesma, a
 * informação de que o outro é de outra versão.
 */
if (!app.requestSingleInstanceLock(ESTA_INSTALACAO)) {
  const jaAberto = lerQuemAbriu(ARQUIVO_DE_QUEM_ABRIU);
  if (mesmaInstalacao(ESTA_INSTALACAO, jaAberto)) {
    // O caso de todo dia: clicar no atalho com o Syden já na bandeja. A janela do outro vem para frente
    // e este sai de cena, que é o certo — é o MESMO app.
    app.quit();
  } else {
    // Outro Syden ficou com a janela. Sair calado aqui foi o que fez alguém testar a versão errada
    // acreditando estar testando esta.
    const comEntrada = Boolean(acharNosArgumentos(process.argv));
    app.whenReady().then(() => {
      const { opcoes } = recadoDeDoisSydens({
        papel: 'naoAbriu',
        daqui: ESTA_INSTALACAO,
        outro: jaAberto,
        comEntrada,
        idiomas: app.getPreferredSystemLanguages?.() ?? [],
      });
      dialog.showMessageBoxSync(opcoes);
      app.quit();
    });
  }
} else {
  anotarQuemAbriu(ARQUIVO_DE_QUEM_ABRIU, ESTA_INSTALACAO);

  // SEGUNDA INSTÂNCIA É COMO O WINDOWS ENTREGA O LINK com o app já aberto: ele tenta abrir o app de
  // novo, passando a URL nos argumentos, e a trava de instância única redireciona para cá.
  app.on('second-instance', (_evento, argv, _pasta, outro) => {
    const url = acharNosArgumentos(argv);
    /**
     * SEM IDENTIDADE, é um Syden anterior a esta conferência: ele saiu de cena sem poder avisar nada, e
     * quem tem de falar é esta janela. Vindo a identidade, o outro lado já avisou — dois avisos para o
     * mesmo fato é pior do que um.
     *
     * O caminho vem dos argumentos porque é o único lugar onde ele existe nesse caso (argv[0] é o
     * executável de quem tentou abrir). A versão fica desconhecida, e o recado não a inventa.
     */
    if (!outro || typeof outro.versao !== 'string') avisarQueTemOutroSyden(argv[0]);
    if (url) entregarVolta(url);
    else showMainWindow();
  });

  // macOS entrega por evento, e não por argumento.
  app.on('open-url', (evento, url) => {
    evento.preventDefault();
    entregarVolta(url);
  });
  app.on('before-quit', () => {
    quitting = true;
    stopScreenAudio();
    pararRuido();
  });
  app.whenReady().then(() => {
    /*
     * INSTALADO PELA MICROSOFT STORE, NÃO SE MEXE NISTO.
     *
     * Num pacote MSIX quem define a identidade é o próprio pacote, e o Windows a registra sozinho
     * (algo como "SydenstrickerLabs.Syden_xxxx!Syden"). Escrever outra por cima não dá erro nenhum —
     * mas as notificações param de aparecer, porque o Windows só entrega notificação para uma
     * identidade que ele mesmo registrou.
     *
     * Seria um defeito calado e difícil de achar: o app abre, a voz funciona, tudo parece certo, e só
     * os avisos de mensagem nunca chegam. A certificação da Store não pegaria isso.
     *
     * `process.windowsStore` é como o Electron conta que está rodando empacotado.
     */
    if (!process.windowsStore) app.setAppUserModelId(APP_USER_MODEL_ID);
    Menu.setApplicationMenu(null);
    setupPermissions();
    setupScreenShare();
    setupScreenAudio();
    setupRuido();
    // O site avisa quando a pessoa troca de tema, para a faixa do Windows acompanhar.
    ipcMain.on('app:title-bar', (_event, cores) => {
      if (!mainWindow || typeof cores?.color !== 'string' || typeof cores?.symbolColor !== 'string') return;
      try {
        mainWindow.setTitleBarOverlay({ color: cores.color, symbolColor: cores.symbolColor, height: 36 });
      } catch {
        // Sistema sem barra de título desenhada pelo app: nada a fazer.
      }
    });
    createMainWindow();
    createTray();
    registerShortcuts();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

/**
 * Conta que existe outro Syden instalado, quando quem tentou abrir era antigo demais para contar.
 *
 * O botão de sair está aqui porque sair é exatamente o que a pessoa precisa fazer para ver o outro — e
 * caçar o ícone na bandeja é o passo em que se desiste e se aceita a versão errada.
 */
function avisarQueTemOutroSyden(caminhoDoOutro) {
  const { opcoes, botaoDeSair } = recadoDeDoisSydens({
    papel: 'jaEstavaAberto',
    daqui: ESTA_INSTALACAO,
    outro: typeof caminhoDoOutro === 'string' && caminhoDoOutro ? { versao: null, caminho: caminhoDoOutro } : null,
    idiomas: app.getPreferredSystemLanguages?.() ?? [],
  });
  // Sem janela, o dialog vai solto: passar `undefined` como janela-mãe não é a mesma coisa que não passar.
  const mostrar = mainWindow ? dialog.showMessageBox(mainWindow, opcoes) : dialog.showMessageBox(opcoes);
  void mostrar.then(({ response }) => {
    if (response === botaoDeSair) app.quit();
  });
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    title: 'Syden',
    icon: ICON,
    backgroundColor: '#313338',
    show: false,
    // Barra de título escura, como o resto do app (o padrão do Windows desenha uma clara). Os botões de
    // minimizar/maximizar/fechar continuam nativos, só a cor muda; quem desenha o texto é o próprio site
    // (ver .desktop-titlebar), numa faixa arrastável do tamanho de "height" aqui embaixo.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#1e1f22', symbolColor: '#dbdee1', height: 36 },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false, // mantém a chamada estável com a janela minimizada
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // A volta que chegou antes de a página existir. 'did-finish-load' e não 'ready-to-show': a janela
  // aparece antes de o JavaScript do site estar de pé, e quem escuta o recado é o site.
  mainWindow.webContents.on('did-finish-load', () => {
    if (!voltaPendente) return;
    mainWindow?.webContents.send('entrada:voltou', voltaPendente);
    voltaPendente = null;
  });
  mainWindow.loadURL(APP_URL);

  const contents = mainWindow.webContents;

  // Sem internet ou servidor fora do ar: mostra uma tela com botão de tentar de novo.
  contents.on('did-fail-load', (_event, _code, _description, url, isMainFrame) => {
    if (isMainFrame && isAppOrigin(url)) {
      mainWindow?.loadFile(path.join(__dirname, 'offline.html'), { query: { url: APP_URL } });
    }
  });

  // Links externos abrem no navegador padrão, nunca dentro do app.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isAppOrigin(url)) return;
    event.preventDefault();
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
  });

  // Atalhos úteis, já que o menu padrão foi removido.
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (ctrl && input.shift && input.key.toLowerCase() === 'i') contents.toggleDevTools();
    else if ((ctrl && input.key.toLowerCase() === 'r') || input.key === 'F5') contents.reload();
    else return;
    event.preventDefault();
  });

  // Fechar a janela só esconde (fica na bandeja), como o Discord. Sair de verdade é pelo menu da bandeja.
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on('closed', () => (mainWindow = null));
}

// Teclas de atalho que funcionam mesmo com o Syden minimizado ou em segundo plano (ex.: durante um jogo).
// Combinações pouco usadas, porque um atalho global vale para o Windows inteiro.
const SHORTCUTS = { 'Control+Alt+M': 'mute', 'Control+Alt+D': 'deafen' };

function registerShortcuts() {
  for (const [accelerator, action] of Object.entries(SHORTCUTS)) {
    // Se outro programa já usa a combinação, o registro falha e o Syden simplesmente não a usa.
    globalShortcut.register(accelerator, () => mainWindow?.webContents.send('app:shortcut', action));
  }
}

/**
 * Abre um endereço no navegador do sistema, a pedido do site.
 *
 * Existe para a entrada social: o site precisa mandar a pessoa ao Google POR FORA do app, e não pode
 * fazer isso sozinho — dentro do app, navegar para fora é bloqueado (ver will-navigate).
 *
 * Só abre https, e nada mais. Sem essa conferência, uma página conseguiria abrir qualquer coisa que o
 * Windows saiba abrir — inclusive um programa.
 */
ipcMain.on('app:abrir-fora', (event, url) => {
  if (mainWindow && event.sender !== mainWindow.webContents) return;
  if (typeof url === 'string' && url.startsWith('https://')) void shell.openExternal(url);
});

ipcMain.on('app:focus', (event) => {
  if (mainWindow && event.sender === mainWindow.webContents) showMainWindow();
});

/**
 * Os idiomas preferidos do sistema, em ordem.
 *
 * É SÍNCRONO de propósito, e é a única coisa aqui que é. O site precisa disto antes de desenhar a
 * primeira tela: se viesse por promessa, a tela apareceria em português e trocaria de idioma um instante
 * depois, na frente da pessoa. A chamada é uma leitura de configuração do sistema, sem disco nem rede.
 *
 * getPreferredSystemLanguages() existe desde o Electron 24; o `?.` cobre versão mais antiga, e aí o site
 * cai em navigator.languages como sempre fez.
 */
ipcMain.on('app:idiomas', (event) => {
  event.returnValue = app.getPreferredSystemLanguages?.() ?? [];
});

/**
 * O número vermelho sobre o ícone da barra de tarefas, como no Discord.
 *
 * No Windows isso é um "overlay icon": uma imagenzinha que o sistema desenha no canto do ícone. Quem
 * desenha o selo é o site, porque lá existe canvas e aqui não — o processo principal só recebe o PNG
 * pronto e o coloca. `app.setBadgeCount` fica junto porque é o caminho no macOS e no Linux.
 */
ipcMain.on('app:badge', (event, { quantas, selo }) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  try {
    if (quantas > 0 && selo) {
      mainWindow.setOverlayIcon(nativeImage.createFromDataURL(selo), `${quantas} ${quantas === 1 ? 'aviso' : 'avisos'}`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
    if (typeof app.setBadgeCount === 'function') app.setBadgeCount(quantas);
  } catch {
    // Sistema que não tem esse recurso: o Syden continua igual, só sem o número no ícone.
  }
});

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Syden');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Syden', click: showMainWindow },
      { type: 'separator' },
      { label: 'Sair do Syden', click: () => app.quit() },
    ]),
  );
  tray.on('click', showMainWindow);
}

const ALLOWED_PERMISSIONS = new Set([
  'media',
  'display-capture',
  'notifications',
  'fullscreen',
  'speaker-selection',
  'clipboard-sanitized-write',
]);

function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isAppOrigin(origin);
  });
}

// No Electron, getDisplayMedia() não tem seletor embutido no Windows: mostramos o nosso.
function setupScreenShare() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isAppOrigin(request.securityOrigin) || !mainWindow) return callback({});
    try {
      const choice = await pickSource(request.audioRequested);
      if (!choice) return callback({});
      // O TÍTULO DA JANELA só existe aqui. O site, do outro lado, só recebe a faixa de vídeo — e o
      // rótulo dela é um código interno ("window:12345:0"), não "League of Legends". Por isso o nome
      // é mandado à parte, agora, enquanto ainda se sabe qual foi a escolha.
      mainWindow.webContents.send('tela:escolhida', choice.source.name || null);
      // Com o módulo nativo, o som vem por fora (sem as vozes da chamada); sem ele, sobra o jeito antigo,
      // que é a mistura do computador inteiro.
      const legacyAudio = choice.audio && !screenAudioAvailable();
      callback({ video: choice.source, ...(legacyAudio && { audio: 'loopback' }) });
    } catch (error) {
      console.error(error);
      callback({});
    }
  });
}

/**
 * @param {boolean} audioRequested
 * @returns {Promise<{ source: Electron.DesktopCapturerSource, audio: boolean } | null>}
 */
async function pickSource(audioRequested) {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  const picker = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 780,
    height: 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Compartilhar tela',
    icon: ICON,
    backgroundColor: '#313338',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'picker-preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  picker.setMenu(null);

  const payload = {
    // Capturar o áudio do sistema só é suportado no Windows.
    audioSupported: audioRequested && process.platform === 'win32',
    // Com o módulo nativo, o som vai sem as vozes da chamada; sem ele, vai a mistura inteira.
    semEco: screenAudioAvailable(),
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail.toDataURL(),
      icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
    })),
  };

  return new Promise((resolve) => {
    let settled = false;
    /** @param {{ source: Electron.DesktopCapturerSource, audio: boolean } | null} result */
    const finish = (result) => {
      if (settled) return;
      settled = true;
      ipcMain.off('picker:choose', onChoose);
      ipcMain.off('picker:cancel', onCancel);
      if (!picker.isDestroyed()) picker.close();
      resolve(result);
    };
    /** @param {Electron.IpcMainEvent} event @param {{ id: string, audio: boolean }} choice */
    const onChoose = (event, choice) => {
      if (event.sender !== picker.webContents) return;
      const source = sources.find((s) => s.id === choice?.id);
      finish(source ? { source, audio: payload.audioSupported && !!choice.audio } : null);
    };
    /** @param {Electron.IpcMainEvent} event */
    const onCancel = (event) => {
      if (event.sender === picker.webContents) finish(null);
    };

    ipcMain.on('picker:choose', onChoose);
    ipcMain.on('picker:cancel', onCancel);
    picker.on('closed', () => finish(null));
    picker.webContents.once('did-finish-load', () => {
      picker.webContents.send('picker:sources', payload);
      picker.show();
    });
    picker.loadFile(path.join(__dirname, 'picker.html'));
  });
}
