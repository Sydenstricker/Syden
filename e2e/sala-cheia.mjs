// Põe as pessoas de mentira numa sala de voz, para a foto da chamada.
//
// POR QUE ISTO EXISTE. Voz é o coração do Syden, e era justamente a tela que não dava para
// fotografar: numa comunidade de demonstração não há ninguém em chamada, e fotografar uma sala com
// gente de verdade publicaria o nome dos amigos dele numa página pública.
//
// Isto não inventa nada que o Syden não faça — as contas entram na sala pelo mesmo caminho que
// qualquer pessoa entra, pelo socket, com token de verdade. A diferença é só quem elas são.
//
// O QUE ELAS NÃO FAZEM: não publicam áudio. Elas aparecem na lista de quem está na sala (que vem do
// socket) mas não produzem som nem imagem, porque isso exigiria um cliente de mídia completo para
// cada uma. Para a foto da antessala e da lista de participantes, é o suficiente.
//
// Ele fica RODANDO até você apertar Ctrl+C: as pessoas só continuam na sala enquanto a conexão
// existir. Deixe esta janela aberta e tire a foto noutra.
//
//   Git Bash:
//     SYDEN_SENHA_DEMO=... node e2e/sala-cheia.mjs
//
//   PowerShell:
//     $env:SYDEN_SENHA_DEMO = Read-Host "Senha das contas de demonstração"
//     node e2e/sala-cheia.mjs
//
// A senha é a que scripts/comunidade-de-demonstracao.mjs mostrou.
import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'https://api.syden.chat';
const SENHA = process.env.SYDEN_SENHA_DEMO;
const COMUNIDADE = process.env.COMUNIDADE ?? 'Sala de Estar';
const SALA = process.env.SALA ?? 'Sala 1';

/** As mesmas de scripts/comunidade-de-demonstracao.mjs. */
const GENTE = ['helena', 'rafa', 'bento', 'clara'];

if (!SENHA) {
  console.error('Faltou a senha das contas de demonstração.\n');
  console.error('  Ela apareceu ao rodar, no servidor:');
  console.error('    docker compose exec api node scripts/comunidade-de-demonstracao.mjs\n');
  console.error('  Git Bash:    SYDEN_SENHA_DEMO=... node e2e/sala-cheia.mjs');
  console.error('  PowerShell:  $env:SYDEN_SENHA_DEMO = Read-Host "Senha"');
  console.error('               node e2e/sala-cheia.mjs\n');
  process.exit(1);
}

async function pedir(caminho, corpo, token) {
  const resposta = await fetch(API + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const lido = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(`${caminho}: ${resposta.status} ${JSON.stringify(lido)}`);
  return lido;
}

// ---------- Acha a sala de voz ----------
//
// Precisa de alguém logado para listar os canais, e a primeira pessoa da lista serve.
console.log(`Entrando como ${GENTE[0]} para achar a sala…`);
// O tamanho, e não o valor: é o que permite ver uma colagem com espaço sobrando sem pôr a senha na
// tela. A impressa pelo servidor tem 16 caracteres.
console.log(`  (a senha recebida tem ${SENHA.length} caracteres)`);

let primeira;
try {
  primeira = await pedir('/api/auth/login', { username: GENTE[0], password: SENHA });
} catch (erro) {
  console.error(`\n${erro.message}\n`);
  console.error('A senha não bate. As causas, em ordem de frequência:\n');
  console.error('  1. O container do servidor não foi reconstruído depois do git pull. Os scripts');
  console.error('     ficam DENTRO da imagem, e o git pull sozinho não os troca:\n');
  console.error('       cd /opt/janja/deploy && docker compose up -d --build --wait');
  console.error('       docker compose exec api node scripts/comunidade-de-demonstracao.mjs\n');
  console.error('     A versão nova imprime uma linha "Senha:" no fim, e confere sozinha se ela');
  console.error('     funciona. Se essa linha não apareceu, é este o caso.\n');
  console.error('  2. A senha veio com espaço ou quebra de linha na colagem. Compare o número de');
  console.error('     caracteres acima com o da senha que o servidor mostrou.\n');
  process.exit(1);
}

const comunidades = await pedir('/api/communities', null, primeira.token);
const comunidade = comunidades.find((c) => c.name === COMUNIDADE);
if (!comunidade) {
  console.error(`Não achei a comunidade "${COMUNIDADE}". Rode scripts/comunidade-de-demonstracao.mjs no servidor.`);
  process.exit(1);
}

const canais = await pedir(`/api/communities/${comunidade.id}/channels`, null, primeira.token);
const sala = canais.find((c) => c.type === 'voice' && c.name === SALA) ?? canais.find((c) => c.type === 'voice');
if (!sala) {
  console.error(`A comunidade "${COMUNIDADE}" não tem sala de voz.`);
  process.exit(1);
}
console.log(`Sala encontrada: "${sala.name}" (#${sala.id})\n`);

// ---------- --chamada: cada pessoa entra DE VERDADE, num navegador ----------
//
// Pelo socket, elas aparecem na lista da sala mas não entram na chamada (o LiveKit), e o palco da foto ficava com um
// quadro só, o de quem fotografa, no meio da tela preta (09/10/2026). Aqui cada uma abre o app num Chrome escondido e
// clica na sala como qualquer pessoa, com o microfone falso do próprio Chrome (um apito) — sem câmera e sem tela:
// transmitir tela pediria capturar a tela de verdade deste computador, e isso não se faz.
if (process.argv.includes('--chamada')) {
  const { chromium } = await import('playwright-core');
  const { dispensarPresentes } = await import('./ajuda.mjs');
  const SITE = process.env.SITE ?? 'https://syden.chat/app/';
  const CHROME = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].filter(Boolean)[0];
  const navegador = await chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  for (const nome of GENTE) {
    const contexto = await navegador.newContext({ locale: 'pt-BR', permissions: ['microphone'] });
    const page = await contexto.newPage();
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByLabel('Nome de usuário').fill(nome);
    await page.getByLabel('Senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.locator('.quarto').waitFor({ timeout: 45_000 });
    await dispensarPresentes(page);
    await page.locator(`.rail-item[title="${COMUNIDADE}"]`).click();
    await page.locator('.channel-name', { hasText: sala.name }).first().click();
    if (!(await page.locator('.voice-panel-status').waitFor({ timeout: 30_000 }).then(() => true, () => false))) {
      console.error(`  ✗ ${nome} não conseguiu entrar na chamada`);
      continue;
    }
    // Uma com o microfone fechado: a foto fica mais parecida com uma chamada de verdade do que quatro iguais.
    if (nome === 'bento') await page.locator('.user-panel').getByRole('button', { name: 'Silenciar', exact: true }).click().catch(() => {});
    console.log(`  ✓ ${nome} está na chamada`);
  }
  console.log(`\nDEIXE ESTA JANELA ABERTA. Noutra, tire a foto:  node e2e/capturas-da-loja.mjs`);
  console.log('Ctrl+C para esvaziar a sala.');
  const sair = async () => { console.log('\nSaindo da sala…'); await navegador.close().catch(() => {}); process.exit(0); };
  process.on('SIGINT', sair);
  process.on('SIGTERM', sair);
  await new Promise(() => {});
}

// ---------- Cada pessoa abre a sua conexão e entra ----------
const conexoes = [];

for (const nome of GENTE) {
  const { token } = nome === GENTE[0] ? primeira : await pedir('/api/auth/login', { username: nome, password: SENHA });

  const socket = io(API, { auth: { token }, transports: ['websocket'] });
  conexoes.push(socket);

  await new Promise((pronto, falhou) => {
    socket.on('connect', () => {
      // O mesmo evento que o app manda quando alguém clica numa sala.
      socket.emit('voice:join', { channelId: sala.id }, (resposta) => {
        if (resposta?.ok) {
          console.log(`  ✓ ${nome} está na sala`);
          // Uma delas com o microfone fechado e outra transmitindo: a foto fica mais parecida com
          // uma chamada de verdade do que quatro pessoas em estados idênticos.
          if (nome === 'bento') socket.emit('voice:update', { muted: true });
          if (nome === 'clara') socket.emit('voice:update', { screen: true, screenName: 'Apresentação' });
          pronto();
        } else {
          falhou(new Error(`${nome} não entrou: ${JSON.stringify(resposta)}`));
        }
      });
    });
    socket.on('connect_error', falhou);
  });
}

console.log(`\n${GENTE.length} pessoas na sala "${sala.name}".`);
console.log('\nDEIXE ESTA JANELA ABERTA. Elas saem da sala assim que a conexão cair.');
console.log('Noutra janela, tire a foto:  node e2e/capturas-da-loja.mjs');
console.log('\nCtrl+C para esvaziar a sala.');

// Sai limpo: sem isto as pessoas ficariam na sala até o servidor perceber a queda, e alguém
// entrando na comunidade veria gente que não está lá.
const sair = () => {
  console.log('\nSaindo da sala…');
  for (const socket of conexoes) {
    socket.emit('voice:leave');
    socket.close();
  }
  process.exit(0);
};
process.on('SIGINT', sair);
process.on('SIGTERM', sair);
