// Prova que o caminho do syden:// existe e entrega a volta ao site, DENTRO do Electron.
//
// POR QUE ISTO PRECISA DE UM TESTE PRÓPRIO. Entrar com Google no app estava quebrado e ninguém
// percebeu, porque o sintoma é silencioso: o navegador abre, a pessoa entra, e o app fica esperando
// para sempre sem mensagem nenhuma. Nada estoura, nada aparece no console.
//
// O que se mede aqui são as três peças que faltavam, cada uma capaz de falhar sozinha:
//   1. o app se registra como dono do esquema syden:// no sistema;
//   2. a ponte oferece ao site o abrirFora e o aoVoltarDaEntrada;
//   3. uma URL syden:// chegando pelo caminho do Windows (segunda instância) é entregue ao site —
//      inclusive quando chega ANTES de a página existir, que é o caso mais comum, porque quem foi
//      entrar é justamente quem ainda não estava dentro.
//
// Roda com o Electron de verdade, sem rede e sem tocar em produção:
//   node e2e/entrada-pelo-app.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

const ELECTRON = 'node_modules/electron/dist/electron.exe';

/** O ambiente sem ELECTRON_RUN_AS_NODE, que este projeto costuma deixar ligado para outros usos. */
function semRodarComoNode(env) {
  const copia = { ...env };
  delete copia.ELECTRON_RUN_AS_NODE;
  return copia;
}
const ROTEIRO = 'e2e-entrada-temp.cjs';

// O roteiro roda DENTRO do Electron: é a única forma de ver a ponte e o registro do esquema.
writeFileSync(
  ROTEIRO,
  `
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const {
  anotarQuemAbriu, lerQuemAbriu, mesmaInstalacao, recadoDeDoisSydens,
} = require(path.join(process.cwd(), 'desktop', 'src', 'duas-instalacoes.js'));

/**
 * PASTA DE DADOS PRÓPRIA, e não a do Syden instalado.
 *
 * A trava de instância única é POR PASTA DE DADOS. Sem isto, este teste disputaria a trava com o Syden
 * que a pessoa tem aberto na bandeja: ele passaria a receber os avisos de segunda instância deste teste,
 * e o teste falharia por não receber o que foi entregue a outro processo.
 */
app.setPath('userData', path.join(os.tmpdir(), 'syden-e2e-entrada'));

const ESTA = { versao: app.getVersion(), caminho: process.execPath };

/**
 * O PAPEL DE SEGUNDA INSTÂNCIA, que é o outro lado do teste.
 *
 * Este mesmo roteiro é aberto de novo com --segundo e um endereço syden://, para reproduzir exatamente o
 * que o Windows faz quando alguém clica no link com o app já aberto: ele ABRE O APP DE NOVO, passando a
 * URL nos argumentos. Quem já está aberto recebe isso pelo evento 'second-instance'.
 */
if (process.argv.includes('--segundo')) {
  app.requestSingleInstanceLock(ESTA);
  app.quit();
} else {

const resultados = [];
const conta = (nome, ok, detalhe) => resultados.push({ nome, ok, detalhe: detalhe ?? '' });

app.whenReady().then(async () => {
  // 1. O app é dono do esquema?
  app.setAsDefaultProtocolClient('syden');
  conta('o app se registra como dono de syden://', app.isDefaultProtocolClient('syden'));

  const janela = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(process.cwd(), 'desktop', 'src', 'preload.js'), contextIsolation: true, sandbox: true },
  });
  await janela.loadURL('data:text/html,<p>x');

  // 2. A ponte oferece as duas funções novas?
  const ponte = await janela.webContents.executeJavaScript(
    'JSON.stringify({ abrirFora: typeof window.sydenDesktop?.abrirFora, aoVoltar: typeof window.sydenDesktop?.aoVoltarDaEntrada })'
  );
  const p = JSON.parse(ponte);
  conta('a ponte oferece abrirFora', p.abrirFora === 'function', p.abrirFora);
  conta('a ponte oferece aoVoltarDaEntrada', p.aoVoltar === 'function', p.aoVoltar);

  // 3. Uma volta entregue pelo processo principal chega ao site?
  await janela.webContents.executeJavaScript(
    'window.__recebido = null; window.__parar = window.sydenDesktop.aoVoltarDaEntrada((url) => { window.__recebido = url; }); "pronto"'
  );
  const ENDERECO = 'syden://entrada?entrada=ok&comprovante=abc123';
  janela.webContents.send('entrada:voltou', ENDERECO);
  await new Promise((r) => setTimeout(r, 400));
  const recebido = await janela.webContents.executeJavaScript('window.__recebido');
  conta('a volta chega ao site pela ponte', recebido === ENDERECO, String(recebido));

  // 4. O site consegue LER os campos daquele endereço? É o que o entradaSocial faz.
  const lido = await janela.webContents.executeJavaScript(
    'JSON.stringify((() => { const u = new URL(window.__recebido); return { entrada: u.searchParams.get("entrada"), comprovante: u.searchParams.get("comprovante") }; })())'
  );
  const campos = JSON.parse(lido);
  conta('o comprovante é legível no endereço', campos.entrada === 'ok' && campos.comprovante === 'abc123', lido);

  // 5. Parar de escutar funciona? Sem isso, uma volta seria processada várias vezes.
  const parou = await janela.webContents.executeJavaScript(
    'window.__conta = 0; const parar = window.sydenDesktop.aoVoltarDaEntrada(() => { window.__conta++; }); parar(); "ok"'
  );
  janela.webContents.send('entrada:voltou', ENDERECO);
  await new Promise((r) => setTimeout(r, 300));
  const vezes = await janela.webContents.executeJavaScript('window.__conta');
  conta('dá para parar de escutar', parou === 'ok' && vezes === 0, 'chamou ' + vezes + ' vez(es) depois de parar');

  /*
   * ---------- A SEGUNDA INSTÂNCIA, que é o caminho real do Windows ----------
   *
   * Até aqui a volta foi entregue à mão, de dentro do processo. O que nunca tinha sido medido é o trecho
   * anterior: a URL chega ao app porque o WINDOWS ABRE O APP DE NOVO com ela nos argumentos, e a trava de
   * instância única a redireciona para quem já estava aberto.
   *
   * Três coisas sobre as quais o aviso de "dois Sydens" foi construído dependem de comportamento do
   * Electron e do sistema, não do nosso código — e se qualquer uma for diferente do que eu suponho, o
   * aviso simplesmente nunca aparece, calado:
   *
   *   - o endereço syden:// aparece nos argumentos de quem abriu depois;
   *   - argv[0] é o EXECUTÁVEL de quem tentou abrir (é por ele que se descobre a outra instalação
   *     quando ela é antiga demais para se apresentar);
   *   - a identidade passada na trava (additionalData) chega ao outro lado.
   */
  const pegouATrava = app.requestSingleInstanceLock(ESTA);
  conta('este processo fica com a trava de instância única', pegouATrava);

  const arquivo = path.join(app.getPath('userData'), 'instancia-aberta.json');
  anotarQuemAbriu(arquivo, ESTA);
  conta('a anotação de quem abriu volta do disco igual', mesmaInstalacao(ESTA, lerQuemAbriu(arquivo)));

  const ENDERECO2 = 'syden://entrada?entrada=ok&comprovante=segunda';
  const chegou = new Promise((pronto) => {
    app.on('second-instance', (_e, argv, _pasta, outro) => pronto({ argv, outro }));
    setTimeout(() => pronto(null), 15000);
  });
  spawn(process.execPath, [process.argv[1], '--segundo', ENDERECO2], { env: process.env, stdio: 'ignore' });
  const segunda = await chegou;

  conta('abrir o app de novo avisa quem já estava aberto', Boolean(segunda));
  conta(
    'o endereço syden:// vem nos argumentos de quem abriu depois',
    Boolean(segunda && segunda.argv.includes(ENDERECO2)),
    segunda ? JSON.stringify(segunda.argv.slice(1)) : 'não chegou',
  );
  conta(
    'argv[0] é o executável de quem tentou abrir',
    Boolean(segunda && String(segunda.argv[0] || '').toLowerCase() === process.execPath.toLowerCase()),
    segunda ? String(segunda.argv[0]) : 'não chegou',
  );
  conta(
    'a identidade passada na trava chega ao outro lado',
    Boolean(segunda && segunda.outro && segunda.outro.versao === ESTA.versao && segunda.outro.caminho === ESTA.caminho),
    segunda ? JSON.stringify(segunda.outro) : 'não chegou',
  );
  // O caso de todo dia — clicar no atalho com o Syden na bandeja — NÃO pode virar aviso. Um aviso que
  // aparece sempre é um aviso que ninguém lê.
  conta('o mesmo Syden reaberto não conta como dois', mesmaInstalacao(ESTA, segunda && segunda.outro));

  // ---------- A decisão de avisar, nos casos que não dá para encenar aqui ----------
  const outraVersao = { versao: '0.0.1', caminho: ESTA.caminho };
  const outroLugar = { versao: ESTA.versao, caminho: 'C:/Outro/Syden.exe' };
  conta('versão diferente no mesmo caminho conta como outro Syden', !mesmaInstalacao(ESTA, outraVersao));
  conta('mesma versão em outro caminho conta como outro Syden', !mesmaInstalacao(ESTA, outroLugar));
  conta('caminho só muda em maiúsculas e barras: é o mesmo', mesmaInstalacao(ESTA, {
    versao: ESTA.versao,
    caminho: ESTA.caminho.replace(/\\\\/g, '/').toUpperCase(),
  }));
  // Não saber quem é o outro é o caso do Syden anterior a esta conferência, que não anota nada. Precisa
  // contar como diferente: era exatamente ele que ficava com a janela sem ninguém saber.
  conta('não saber quem é o outro conta como diferente', !mesmaInstalacao(ESTA, null));

  const recado = recadoDeDoisSydens({ papel: 'naoAbriu', daqui: ESTA, outro: outraVersao, comEntrada: true, idiomas: ['pt-BR'] });
  conta('o recado diz as duas versões', recado.opcoes.detail.includes('0.0.1') && recado.opcoes.detail.includes(ESTA.versao), recado.opcoes.detail.split('\\n')[0]);
  conta('o recado avisa sobre a entrada quando havia uma', recado.opcoes.detail.toLowerCase().includes('google'));
  conta('quem não abriu tem um botão só, e nenhum é o de sair', recado.opcoes.buttons.length === 1 && recado.botaoDeSair === -1);

  const doLado = recadoDeDoisSydens({ papel: 'jaEstavaAberto', daqui: ESTA, outro: { versao: null, caminho: 'C:/Outro/Syden.exe' }, idiomas: ['en'] });
  conta('quem está com a janela oferece sair', doLado.opcoes.buttons.length === 2 && doLado.botaoDeSair === 1);
  conta('sem saber a versão do outro, mostra o caminho e não inventa', doLado.opcoes.detail.includes('C:/Outro/Syden.exe'));
  conta('o recado fala o idioma do sistema', doLado.opcoes.title === 'Two Sydens installed', doLado.opcoes.title);

  console.log('RESULTADOS' + JSON.stringify(resultados));
  app.exit(0);
});

}
`,
);

const processo = spawn(ELECTRON, [ROTEIRO], {
  // A variável precisa ser APAGADA, e não posta em vazio: o Electron olha se ela existe, não o valor.
  // Com ELECTRON_RUN_AS_NODE='' ele ainda sobe como Node puro, e "app" vem indefinido.
  env: semRodarComoNode(process.env),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let saida = '';
processo.stdout.on('data', (d) => (saida += d.toString()));
processo.stderr.on('data', (d) => (saida += d.toString()));

const codigo = await new Promise((pronto) => processo.on('close', pronto));
unlinkSync(ROTEIRO);

const linha = saida.split('\n').find((l) => l.includes('RESULTADOS'));
if (!linha) {
  console.error('O Electron não chegou ao fim. Saída:');
  console.error(saida.slice(-1500));
  process.exit(1);
}

const resultados = JSON.parse(linha.slice(linha.indexOf('RESULTADOS') + 'RESULTADOS'.length));
console.log('');
let ruins = 0;
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK ' : 'XX '} ${r.nome}${r.detalhe && !r.ok ? '   ' + r.detalhe : ''}`);
  if (!r.ok) ruins++;
}

console.log('');
if (ruins || codigo !== 0) {
  console.log(`${ruins} com problema.`);
  process.exit(1);
}
console.log('O caminho do syden:// está de pé: o app é dono do esquema e a volta chega ao site.');
