// As capturas de tela da página do Syden na Microsoft Store, em cada idioma que o app fala.
//
// POR QUE UM SCRIPT, e não a tecla PrintScreen: a Store pede quatro imagens por idioma, todas do
// mesmo tamanho exato. São centenas no total, e elas precisam ser refeitas toda vez que a aparência do
// app mudar. À mão isso é um trabalho chato que sai um pouco diferente a cada vez — janela num
// tamanho, barra de tarefas aparecendo numa e não na outra. Aqui saem sempre iguais, em 1920x1080.
//
// ATENÇÃO À PRIVACIDADE. Estas imagens vão para uma página PÚBLICA. Se a conta usada aqui participar
// da comunidade dos seus amigos, você estará publicando os nomes e as mensagens deles para o mundo,
// sem que ninguém tenha sido consultado, e sem desfazer. Use uma comunidade feita para demonstração,
// com conversa inventada — o script conta quantas pessoas vê e para para avisar quando parecem
// muitas.
//
// A SENHA NÃO VAI NA LINHA DE COMANDO: ela fica no histórico do terminal e aparece para quem listar
// os processos da máquina. Vem por variável de ambiente.
//
//   Git Bash:
//     SYDEN_USUARIO=microsoft-teste SYDEN_SENHA=... node e2e/capturas-da-loja.mjs
//
//   PowerShell (o Read-Host não guarda no histórico):
//     $env:SYDEN_USUARIO = "microsoft-teste"
//     $env:SYDEN_SENHA = Read-Host "Senha"
//     node e2e/capturas-da-loja.mjs
//
//   Só alguns:  IDIOMAS=en,ja node e2e/capturas-da-loja.mjs
//
// Sai em e2e/fotos/loja/<idioma>/1-inicio.png … 4-voz.png
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { dispensarPresentes } from './ajuda.mjs';

// O app, e não a raiz: desde que syden.chat virou a página de apresentação, o app mora em /app/.
const SITE = process.env.SITE ?? 'https://syden.chat/app/';
const USUARIO = process.env.SYDEN_USUARIO;
const SENHA = process.env.SYDEN_SENHA;
const RAIZ = 'e2e/fotos/loja';

/**
 * A comunidade fotografada.
 *
 * Aponta para a de DEMONSTRAÇÃO, e não para a primeira da lista. As imagens vão para uma página
 * pública e sem desfazer: a de demonstração tem gente e conversa inventadas, então o que a foto
 * mostra é o Syden, e não pessoas de verdade. Crie-a com:
 *
 *   docker compose exec api node scripts/comunidade-de-demonstracao.mjs
 */
const COMUNIDADE = process.env.COMUNIDADE ?? 'Sala de Estar';

/** O tamanho que a Microsoft Store espera para computador. O mínimo é 1366x768; este é o bonito. */
const LARGURA = 1920;
const ALTURA = 1080;

/**
 * Os idiomas que o Syden REALMENTE fala: os que têm dicionário em web/src/i18n/.
 *
 * Fazer captura de um idioma sem tradução seria prometer na Store o que o app não entrega — e a
 * pessoa que baixasse por isso desinstalaria na primeira tela. Por isso a lista sai dos próprios
 * dicionários, e não de uma lista escrita aqui (eram três até 09/10/2026, com 71 já traduzidos).
 *
 * Os dicionários servem também para achar os botões: o script clica em "Configurações", "Idioma",
 * "Guarda-roupa" e "Amigos" escritos na língua que está na tela. O idioma em si é escolhido pela
 * marca `lang` do botão, que não depende de língua nenhuma.
 */
const PASTA_I18N = new URL('../web/src/i18n/', import.meta.url);
const DICIONARIOS = { 'pt-BR': {} };
for (const arquivo of readdirSync(PASTA_I18N).filter((a) => a.endsWith('.ts')).sort()) {
  // idiomas.ts e index.ts importam sem extensão, o que só o Vite resolve: no Node eles falham, e não são dicionário.
  const dicionario = await import(new URL(arquivo, PASTA_I18N).href).then((m) => m.default, () => null);
  // Só os dicionários de interface têm a chave 'Amigos'; paises.ts e afins ficam de fora.
  if (dicionario && typeof dicionario === 'object' && 'Amigos' in dicionario) DICIONARIOS[arquivo.slice(0, -3)] = dicionario;
}
/** O texto como a tela o mostra em `codigo` (o que falta no dicionário aparece em português, como no app). */
const tr = (codigo, chave) => DICIONARIOS[codigo]?.[chave] ?? chave;

const IDIOMAS_POSSIVEIS = Object.keys(DICIONARIOS).map((codigo) => ({ pasta: codigo, lang: codigo }));

const pedidos = (process.env.IDIOMAS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const IDIOMAS = pedidos.length ? IDIOMAS_POSSIVEIS.filter((i) => pedidos.includes(i.pasta)) : IDIOMAS_POSSIVEIS;
/** O idioma que está na tela agora. A conta começa em português (o script a devolve assim no fim). */
let idiomaNaTela = 'pt-BR';

if (!USUARIO || !SENHA) {
  console.error('Faltou a conta. A senha vai numa variável, não no comando:\n');
  console.error('  Git Bash:    SYDEN_USUARIO=microsoft-teste SYDEN_SENHA=... node e2e/capturas-da-loja.mjs');
  console.error('  PowerShell:  $env:SYDEN_USUARIO = "microsoft-teste"');
  console.error('               $env:SYDEN_SENHA = Read-Host "Senha"');
  console.error('               node e2e/capturas-da-loja.mjs\n');
  process.exit(1);
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

// OS BOTS VÊM JUNTO quando a senha deles está na variável SYDEN_SENHA_DEMO: o script liga o
// `e2e/sala-cheia.mjs --chamada` sozinho, espera os quatro entrarem e desliga no fim. Eram duas janelas, uma presa
// à outra, e um Ctrl+C que não derrubava o processo dos bots (09/10/2026).
let bots = null;
if (process.env.SYDEN_SENHA_DEMO) {
  console.log('Ligando as pessoas da demonstração na chamada (uns 30 s)…');
  bots = spawn(process.execPath, ['e2e/sala-cheia.mjs', '--chamada'], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const prontos = await new Promise((resolver) => {
    let texto = '';
    const ler = (pedaco) => {
      texto += pedaco;
      for (const linha of String(pedaco).split('\n')) if (/✓|✗|Faltou|não bate|Não achei/.test(linha)) console.log('  ' + linha.trim());
      if (texto.includes('DEIXE ESTA JANELA ABERTA')) resolver(true);
    };
    bots.stdout.on('data', ler);
    bots.stderr.on('data', ler);
    bots.on('exit', () => resolver(false));
    setTimeout(() => resolver(false), 180_000);
  });
  if (!prontos) console.log('  (as pessoas da demonstração não entraram: a foto da chamada vai ser pulada)');
}
const desligarBots = () => { if (bots && bots.exitCode === null) bots.kill(); };
process.on('exit', desligarBots);
process.on('SIGINT', () => { desligarBots(); process.exit(130); });

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const contexto = await browser.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  // Sem isto o Chrome captura no tamanho lógico, e numa tela de alta densidade a imagem sai com
  // metade dos pixels — aí a Store recusa por tamanho.
  deviceScaleFactor: 1,
  locale: 'pt-BR',
});
// A CONTA DE TESTE TAMBÉM ESTÁ NUMA COMUNIDADE DE VERDADE, e a home a mostrava: a faixa "Agora nas suas comunidades"
// saiu na foto com o nome dela e de quem estava em chamada (09/10/2026). Escondido aqui, em toda página que abrir:
// na barra, toda comunidade que não seja a de demonstração; na faixa, todo item que não seja dela (com o
// e2e/sala-cheia.mjs rodando, sobra a de demonstração com gente em chamada). Sem item nenhum, a faixa some inteira.
await contexto.addInitScript((comunidade) => {
  const css = `.rail-item:not(.rail-action):not([title=${JSON.stringify(comunidade)}]) { display: none !important; }`;
  const filtrar = () => {
    for (const farol of document.querySelectorAll('.farol')) {
      let sobrou = 0;
      for (const li of farol.querySelectorAll('li')) {
        const dela = li.querySelector('strong')?.textContent?.trim() === comunidade;
        li.style.setProperty('display', dela ? '' : 'none', 'important');
        if (dela) sobrou++;
      }
      farol.style.setProperty('display', sobrou ? '' : 'none', 'important');
    }
  };
  const por = () => {
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    filtrar();
    new MutationObserver(filtrar).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) por(); else document.addEventListener('DOMContentLoaded', por);
}, COMUNIDADE);
const page = await contexto.newPage();

let pasta = RAIZ;

/** Tira a foto depois de deixar a tela assentar: animação pela metade vira borrão na loja. */
async function foto(nome, espera = 1200) {
  await page.waitForTimeout(espera);
  const caminho = `${pasta}/${nome}.png`;
  await page.screenshot({ path: caminho });
  console.log('    ✓ ' + caminho);
}

/**
 * Entra na comunidade de demonstração, procurando pelo NOME na barra lateral.
 *
 * Pegar "a primeira da lista" era o que o script fazia antes, e foi assim que as primeiras fotos
 * saíram com os nomes e as mensagens de gente de verdade. A barra guarda o nome de cada comunidade
 * no atributo do botão, então dá para escolher a certa sem depender da ordem.
 */
async function abrirAComunidade() {
  const botao = page.locator(`.rail-item[title="${COMUNIDADE}"]`);
  if (await botao.isVisible().catch(() => false)) {
    await botao.click();
    await page.waitForTimeout(1200);
    return true;
  }

  // Quando não acha, DIZ O QUE ACHOU. "Não encontrei" sozinho não ajuda ninguém a descobrir se o
  // nome está diferente, se a conta não participa da comunidade, ou se a barra nem carregou.
  const titulos = await page.locator('.rail-item').evaluateAll((itens) =>
    itens.map((i) => i.getAttribute('title')).filter(Boolean),
  );
  console.log(`    (não achei "${COMUNIDADE}". A barra mostra: ${JSON.stringify(titulos)})`);
  return false;
}

/** Em qual comunidade a tela está agora, segundo o cabeçalho da barra lateral. */
async function comunidadeAberta() {
  return (await page.locator('.sidebar-brand').first().innerText().catch(() => '')).trim();
}

/** Abre Configurações. Serve para trocar o idioma e é o mesmo caminho em qualquer língua. */
async function abrirConfiguracoes() {
  await page.locator(`button[aria-label="${tr(idiomaNaTela, 'Configurações')}"]`).first().click();
  await page.locator('.settings-nav').waitFor({ timeout: 10_000 });
}

/**
 * Troca o idioma pela tela de Configurações, e não escrevendo no armazenamento do navegador.
 *
 * Tentar pelo atalho não funcionaria: desde que as preferências passaram a morar no servidor, o que
 * está guardado lá vence o que está aqui assim que a conta entra. Pela tela, a escolha sobe junto e
 * as duas pontas concordam.
 */
async function trocarIdioma(idioma) {
  await abrirConfiguracoes();
  // Pelo texto EXATO: em alemão, "Sprache" (Idioma) também está dentro de "Sprache und Video" (Voz e vídeo), e o
  // primeiro que contivesse a palavra era a aba errada (a rodada de 09/10/2026 parou no divehi por isso).
  const abas = page.locator('.settings-tab');
  const textos = await abas.evaluateAll((els) => els.map((e) => e.textContent.trim()));
  const indice = textos.indexOf(tr(idiomaNaTela, 'Idioma'));
  if (indice < 0) throw new Error(`não achei a aba "${tr(idiomaNaTela, 'Idioma')}" entre: ${textos.join(' | ')}`);
  await abas.nth(indice).click();
  await page.locator('.idiomas').waitFor({ timeout: 10_000 });
  await page.locator(`.idioma[lang="${idioma.lang}"]`).first().click();
  // Escrita nova (tâmil, amárico, khmer...) baixa a fonte Noto na hora: espera a letra chegar.
  await page.waitForFunction((lang) => document.documentElement.lang === lang, idioma.lang, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);

  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== idioma.lang) console.log(`    (aviso: a página diz lang="${lang}", esperava "${idioma.lang}")`);
  else idiomaNaTela = idioma.lang;

  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}

console.log(`Abrindo ${SITE} em ${LARGURA}x${ALTURA}\n`);

/**
 * Quando algo não aparece, MOSTRA O QUE ESTAVA NA TELA.
 *
 * "Timeout esperando .vila" descreve o que o script queria e não diz nada sobre o que havia — e o
 * que havia é a única informação útil. Uma foto e as primeiras linhas de texto respondem em dois
 * segundos o que a mensagem de erro sozinha custa meia hora.
 */
async function desistir(motivo) {
  const caminho = `${RAIZ}/erro.png`;
  mkdirSync(RAIZ, { recursive: true });
  await page.screenshot({ path: caminho }).catch(() => {});
  const visivel = (await page.locator('body').innerText().catch(() => '')).split('\n').filter(Boolean).slice(0, 12);
  console.error(`\nPAREI: ${motivo}\n`);
  console.error('O que estava escrito na tela:');
  for (const linha of visivel) console.error('  ' + linha);
  console.error(`\nA tela inteira está em ${caminho}\n`);
  await browser.close();
  process.exit(1);
}

// `domcontentloaded` e não `networkidle`. O Syden nunca fica com a rede em silêncio — há sempre
// alguma coisa conversando com o servidor —, então esperar silêncio é esperar o que não vem. O que
// interessa é o campo de entrada existir, e é isso que se espera logo abaixo.
await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 45_000 });

const campoDeNome = page.getByLabel('Nome de usuário');
if (!(await campoDeNome.waitFor({ timeout: 30_000 }).then(() => true, () => false))) {
  await desistir('a tela de entrada não apareceu.');
}

await campoDeNome.fill(USUARIO);
await page.getByLabel('Senha').fill(SENHA);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();

if (!(await page.locator('.quarto').waitFor({ timeout: 45_000 }).then(() => true, () => false))) {
  await desistir(`entrei como "${USUARIO}" e a tela inicial não apareceu. Senha errada, provavelmente.`);
}
console.log('Entrou como ' + USUARIO);

// A conta de teste cai entre as 25 primeiras, então o diálogo da insígnia cobre o Syden logo na
// entrada. Sem dispensá-lo, ele fica na frente de tudo e nenhum clique chega ao que está embaixo —
// foi assim que a primeira versão deste script morreu, esperando um botão que o próprio Playwright
// dizia estar "visível, habilitado e estável" e que tinha um diálogo por cima. O revisor da
// Microsoft vai ver essa mesma tela, e tudo bem: é o Syden dando as boas-vindas. Só não serve para
// a foto.
await dispensarPresentes(page);
console.log('Presentes dispensados');

// ---------- A trava de privacidade ----------
//
// ELE PARA, e não apenas avisa.
//
// A primeira versão avisava e seguia em frente, o que na prática é a mesma coisa que não avisar: a
// comunidade que ele fotografaria em seguida seria justamente a dos amigos. Um aviso que não impede
// nada é só um jeito de dizer depois "mas eu tinha avisado".
//
// Aqui o padrão é o seguro: sem a comunidade de demonstração, nenhuma foto é tirada.
if (!(await abrirAComunidade())) {
  console.error(`\nPAREI. Não achei a comunidade "${COMUNIDADE}".`);
  console.error('\nSem ela, as fotos sairiam com nomes e mensagens de pessoas de verdade — e elas vão');
  console.error('para uma página pública, sem desfazer. No servidor, crie a comunidade de mentira:\n');
  console.error('  docker compose exec api node scripts/comunidade-de-demonstracao.mjs\n');
  console.error('Se ela já existe com outro nome, diga qual:  COMUNIDADE="O Nome" node e2e/capturas-da-loja.mjs\n');
  await browser.close();
  process.exit(1);
}

// Mesmo dentro da comunidade certa, conta quanta gente aparece. A de demonstração tem seis; se
// aparecerem muitas, é sinal de que se entrou na comunidade errada apesar de tudo.
// A conferência é pelo NOME que a tela mostra, e não pela suposição de que o clique funcionou.
// Clicar num botão e seguir em frente sem olhar onde se chegou foi o que deixou as fotos saírem da
// comunidade errada duas vezes.
const aberta = await comunidadeAberta();
const quantos = await page.locator('.member-name').count().catch(() => 0);

if (aberta !== COMUNIDADE) {
  console.error(`\nPAREI. Cliquei em "${COMUNIDADE}", mas a tela está mostrando "${aberta}".`);
  console.error('Nenhuma foto foi tirada. Sem isto, elas sairiam com gente de verdade.\n');
  await browser.close();
  process.exit(1);
}

if (quantos > 8) {
  console.error(`\nPAREI. A comunidade "${COMUNIDADE}" tem ${quantos} pessoas à vista.`);
  console.error('A de demonstração deveria ter seis. Confira em qual comunidade o script entrou.\n');
  await browser.close();
  process.exit(1);
}

console.log(`Na comunidade "${aberta}", com ${quantos} pessoas à vista.`);

for (const idioma of IDIOMAS) {
  console.log(`\n── ${idioma.pasta} ──`);
  pasta = `${RAIZ}/${idioma.pasta}`;
  mkdirSync(pasta, { recursive: true });

  if (idioma.lang !== idiomaNaTela) {
    await trocarIdioma(idioma);
    if (idiomaNaTela !== idioma.lang) { console.log('    (não consegui trocar o idioma — pulei este)'); continue; }
    console.log(`  idioma trocado para ${idioma.lang}`);
  }

  // Volta para a TELA INICIAL antes de cada rodada.
  //
  // O botão de início da barra se chama .rail-logo. Antes estava escrito .rail-home, que não existe
  // — e como o seletor tinha ".rail-item" como alternativa, o clique caía na primeira COMUNIDADE da
  // lista. O app nunca chegava à vila, a primeira foto saía errada e o guarda-roupa "não era encontrado",
  // porque o balão dela só existe na tela inicial. Um seletor errado que casa com outra coisa é
  // pior do que um que não casa com nada: este não deu erro, só fez a coisa errada em silêncio.
  await page.locator('.rail-logo').click();
  await page.locator('.quarto').waitFor({ timeout: 20_000 });

  // 1. A VILA. Vem primeiro porque é o que o Syden tem que os outros não têm: é a imagem que faz
  //    alguém parar de rolar a lista de aplicativos.
  console.log('  1. A tela inicial');
  await foto('1-inicio', 2500);

  /** Abre um objeto do quarto pelo nome (a chave em português, traduzida para a língua da tela) e espera a tela
   *  trocar. O botão é o do teclado (o mouse clica no desenho): foco e Enter. Até 08/10/2026 eram os balões da vila. */
  async function abrirBalao(chave) {
    const rotulo = tr(idiomaNaTela, chave).replaceAll('"', '\\"');
    const objeto = page.locator(`.quarto-alvo[aria-label="${rotulo}"], .quarto-alvo[aria-label^="${rotulo} — "]`).first();
    if (!(await objeto.count())) return false;
    await objeto.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    return true;
  }

  /** Volta da tela cheia para a home (o quarto). */
  async function voltarParaAVila() {
    // O guarda-roupa abre nas Configurações, um diálogo por cima de tudo: sem fechá-lo, o clique seguinte bate nele
    // e o script trava 30 s esperando (foi o que aconteceu na primeira rodada com os 72 idiomas).
    if (await page.locator('.settings[role="dialog"]').isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.locator('.settings[role="dialog"]').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
    await page.locator('.rail-logo').click().catch(() => {});
    await page.locator('.quarto').waitFor({ timeout: 10_000 }).catch(() => {});
  }

  // 2. A CONVERSA. É o que mais gente reconhece à primeira vista, e é onde o Syden se parece com o
  //    que a pessoa já sabe usar.
  console.log('  2. A conversa');
  await abrirAComunidade();
  const ondeEstou = await comunidadeAberta();
  if (ondeEstou !== COMUNIDADE) {
    console.error(`\nPAREI antes da foto da conversa: a tela está em "${ondeEstou}", não em "${COMUNIDADE}".\n`);
    await browser.close();
    process.exit(1);
  }
  const canal = page.locator('.channel-name').first();
  if (await canal.isVisible().catch(() => false)) {
    await canal.click();
    await foto('2-conversa', 2000);
  } else {
    console.log('    (não achei um canal de texto — tire esta à mão)');
  }

  // 3. O GUARDA-ROUPA. Mostra o que o Syden tem de diferente no modelo: tudo de graça, nada travado.
  console.log('  3. O guarda-roupa de enfeites');
  await page.locator('.rail-logo').click();
  await page.locator('.quarto').waitFor({ timeout: 20_000 }).catch(() => {});
  if (await abrirBalao('Guarda-roupa')) {
    await foto('3-guarda-roupa', 1800);
    await voltarParaAVila();
  } else {
    console.log('    (não achei o balão do Guarda-roupa na vila — tire esta à mão)');
  }

  // 4. A CHAMADA.
  //
  //    Depende de `node e2e/sala-cheia.mjs --chamada` rodando noutra janela: com ele, as pessoas da demonstração
  //    entram DE VERDADE na chamada (cada uma num navegador), e o palco mostra um quadro por pessoa. Sem o --chamada
  //    elas só aparecem na lista, e o palco ficava com um quadro só — o de quem fotografa — no meio da tela preta.
  console.log('  4. A chamada');
  const salaDeVoz = page.locator('.channel-name').filter({ hasText: /Sala/ }).first();
  if (await salaDeVoz.isVisible().catch(() => false)) {
    await salaDeVoz.click();
    await page.locator('.stage .tile').nth(2).waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const quadros = await page.locator('.stage .tile').count().catch(() => 0);
    if (quadros >= 3) {
      await foto('4-chamada', 1500);
    } else {
      console.log(`    (só ${quadros} quadro(s) no palco — rode \`node e2e/sala-cheia.mjs --chamada\` noutra janela e refaça)`);
    }
  }

  // A foto de Amigos SAIU em 09/10/2026: a conta de teste não tem amigos, e a tela dizia "Você ainda não tem amigos
  // no Syden" — numa vitrine, isso vende o contrário do app.
}

// Devolve o Syden ao português: a conta fica como estava, e o revisor da Microsoft (que entra com
// ela) vê o idioma padrão em vez do último que este script deixou.
if (idiomaNaTela !== 'pt-BR') {
  await trocarIdioma({ lang: 'pt-BR' }).catch(() => {});
  console.log('\nIdioma devolvido ao português.');
}

await browser.close();
desligarBots();

console.log(`\nPronto. As imagens estão em ${RAIZ}/`);
console.log('Confira UMA POR UMA antes de enviar: nenhuma pode ter nome ou mensagem de pessoa real.');
