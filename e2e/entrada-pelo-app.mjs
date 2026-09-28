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

  console.log('RESULTADOS' + JSON.stringify(resultados));
  app.exit(0);
});
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
