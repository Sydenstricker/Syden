// Prova que a tela de sem conexão desenha, traduz e reage — dentro do Electron, com a CSP dela.
//
// POR QUE ELA MERECE UM TESTE. É a única tela do Syden que ninguém vê durante o desenvolvimento: só
// aparece quando o site não carrega, e quem está desenvolvendo tem internet. Ela pode ficar quebrada
// por meses sem ninguém notar, e o dia em que alguém a vê é justamente o pior dia para ela falhar.
//
// E ela tem uma CSP própria, mais fechada que a do site (`default-src 'none'`, `script-src 'self'`).
// Um erro ali não avisa: a página abre sem texto e com o botão inerte, parecendo só feia.
//
//   node e2e/tela-sem-conexao.mjs
import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const ELECTRON = 'node_modules/electron/dist/electron.exe';
const ROTEIRO = 'e2e-offline-temp.cjs';
const RESULTADO = 'e2e-offline-resultado.json';

/** Sem ELECTRON_RUN_AS_NODE: o Electron olha se a variável existe, não o valor dela. */
function semRodarComoNode(env) {
  const copia = { ...env };
  delete copia.ELECTRON_RUN_AS_NODE;
  return copia;
}

const ROTEIRO_DENTRO = `
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const resultados = [];
const conta = (nome, ok, detalhe) => resultados.push({ nome, ok, detalhe: String(detalhe ?? '') });

app.whenReady().then(async () => {
  const janela = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });

  const violacoes = [];
  janela.webContents.on('console-message', (_e, _n, texto) => {
    if (/Content Security Policy|Refused to/i.test(texto)) violacoes.push(texto);
  });

  // pathToFileURL, e não loadFile com query: no Windows o caminho vem com barras invertidas e o
  // endereço saía como file:///U:\\Repos\\... — que o Chromium recusa com ERR_FAILED, sem dizer por quê.
  const endereco = pathToFileURL(path.join(process.cwd(), 'desktop', 'src', 'offline.html'));
  endereco.searchParams.set('url', 'https://syden.chat/app/');
  await janela.loadURL(endereco.href);
  await new Promise((r) => setTimeout(r, 500));

  const lido = await janela.webContents.executeJavaScript([
    'JSON.stringify({',
    "titulo: document.getElementById('titulo').textContent,",
    "botao: document.getElementById('retry').textContent,",
    "codigo: document.getElementById('codigo').textContent,",
    'lang: document.documentElement.lang,',
    "desenhos: document.querySelectorAll('svg path, svg circle, svg rect, svg polygon').length,",
    "animados: [...document.querySelectorAll('svg *')].filter((e) => e.getAnimations && e.getAnimations().length).length,",
    "destino: new URLSearchParams(location.search).get('url'),",
    // TEXTOS é um const de topo de script clássico: vive no escopo léxico global e dá para lê-lo daqui.
    // É assim que se confere o dicionário inteiro sem fingir o idioma do sistema — e fingir exigia
    // mexer na sessão do Electron, o que fazia o próprio arquivo parar de carregar.
    "idiomas: typeof TEXTOS === 'object' ? Object.keys(TEXTOS) : [],",
    "raizDoSistema: (navigator.language || '').toLowerCase().split('-')[0],",
    "emIngles: typeof TEXTOS === 'object' ? TEXTOS.en.titulo : null,",
    "emEspanhol: typeof TEXTOS === 'object' ? TEXTOS.es.titulo : null,",
    "frases: typeof TEXTOS === 'object' ? TEXTOS : {},",
    "direcao: document.documentElement.dir,",
    '})',
  ].join(''));
  const d = JSON.parse(lido);

  conta('a CSP não barrou nada', violacoes.length === 0, violacoes[0]);
  conta('o coelho foi desenhado', d.desenhos >= 10, d.desenhos + ' formas');
  conta('e ele está animado', d.animados >= 2, d.animados + ' animadas');
  conta('o texto foi escrito', d.titulo.length > 5 && d.botao.length > 3, d.titulo + ' / ' + d.botao);
  conta('o código vem junto da explicação', d.codigo.includes('OFFLINE') && d.codigo.length > 12, d.codigo);
  conta('o endereço de volta chegou', d.destino === 'https://syden.chat/app/', d.destino);
  conta('há dicionário para português, inglês e espanhol', ['pt', 'en', 'es'].every((i) => d.idiomas.includes(i)), d.idiomas.join(','));

  // A GUARDA QUE IMPORTA, e a razão de a lista do site vir de fora: esta tela ficou com três idiomas
  // enquanto o Syden chegava a dezessete. Quem fala coreano via o app inteiro em coreano e, no único
  // momento em que algo dava errado, uma tela em português. Idioma novo no site sem idioma novo aqui
  // volta a abrir essa distância, e ninguém percebe — porque esta tela só aparece sem internet.
  const DO_SITE = IDIOMAS_DO_SITE;
  const faltando = DO_SITE.filter((i) => !d.idiomas.includes(i));
  conta('a tela alcança todos os idiomas do Syden', faltando.length === 0, 'falta: ' + faltando.join(', '));

  // Cinco frases por idioma, nenhuma vazia: um esqueleto com valores em branco deixaria a tela muda,
  // que é pior do que deixá-la em português.
  const incompletos = Object.entries(d.frases)
    .filter(([, f]) => ['titulo', 'explicacao', 'botao', 'tentando', 'codigo'].some((c) => !f[c] || !String(f[c]).trim()))
    .map(([i]) => i);
  conta('nenhum idioma tem frase em branco', incompletos.length === 0, incompletos.join(', '));

  // Todo código começa por OFFLINE, em qualquer língua: é o que a pessoa repete ao pedir ajuda, e
  // traduzi-lo tornaria o pedido de ajuda intraduzível de volta.
  const semCodigo = Object.entries(d.frases)
    .filter(([, f]) => !String(f.codigo).startsWith('OFFLINE'))
    .map(([i]) => i);
  conta('o código OFFLINE não é traduzido em nenhuma língua', semCodigo.length === 0, semCodigo.join(', '));

  conta('a direção da escrita segue o idioma', d.direcao === (d.lang === 'ar' ? 'rtl' : 'ltr'), d.lang + ' -> ' + d.direcao);
  conta('o inglês está escrito', String(d.emIngles).includes("Couldn't"), d.emIngles);
  conta('o espanhol está escrito', String(d.emEspanhol).includes('No fue posible'), d.emEspanhol);
  // Idioma sem dicionário tem de cair no português, e não numa tela vazia.
  const esperado = d.idiomas.includes(d.raizDoSistema) ? d.raizDoSistema : 'pt';
  conta('o idioma desenhado é o certo para este sistema', d.lang === esperado, d.lang + ', sistema ' + d.raizDoSistema);

  fs.writeFileSync(path.join(process.cwd(), 'RESULTADO_AQUI'), JSON.stringify(resultados));
  app.exit(0);
});
`.replace('RESULTADO_AQUI', RESULTADO);

/**
 * Os idiomas que o SITE oferece, lidos de web/src/i18n/idiomas.ts.
 *
 * Eles entram no roteiro como texto porque o roteiro roda noutro processo, dentro do Electron, sem
 * acesso ao repositório. E vêm do arquivo de verdade, e não de uma lista copiada aqui: lista copiada
 * é a própria coisa que este teste existe para impedir.
 *
 * A raiz basta — "zh-CN" entra como "zh" — porque é pela raiz que a tela escolhe o dicionário.
 */
function idiomasDoSite() {
  const fonte = readFileSync('web/src/i18n/idiomas.ts', 'utf8');
  const bloco = fonte.slice(fonte.indexOf('export const TRADUCOES'));
  const codigos = [...bloco.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:\s*\(\)\s*=>/gm)].map((m) => m[1]);
  // O português não está em TRADUCOES: ele é a chave, não a tradução.
  return [...new Set(['pt', ...codigos.map((c) => c.split('-')[0])])];
}

writeFileSync(
  ROTEIRO,
  ROTEIRO_DENTRO.replace('IDIOMAS_DO_SITE', JSON.stringify(idiomasDoSite())),
);

const processo = spawn(ELECTRON, [ROTEIRO], { env: semRodarComoNode(process.env), stdio: ['ignore', 'pipe', 'pipe'] });
let saida = '';
processo.stdout.on('data', (d) => (saida += d));
processo.stderr.on('data', (d) => (saida += d));
const codigo = await new Promise((pronto) => processo.on('close', pronto));
unlinkSync(ROTEIRO);

let resultados;
try {
  // O RESULTADO VEM POR ARQUIVO, e não pelo stdout: no Windows, console.log do processo principal do
  // Electron nem sempre chega a um stdout canalizado, e o teste ficava pendurado esperando uma linha
  // que nunca vinha.
  resultados = JSON.parse(readFileSync(RESULTADO, 'utf8'));
  unlinkSync(RESULTADO);
} catch {
  console.error('O Electron não chegou ao fim. Saída:');
  console.error(saida.slice(-1200));
  process.exit(1);
}

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
console.log('A tela de sem conexão desenha, anima, traduz e sabe para onde voltar.');
