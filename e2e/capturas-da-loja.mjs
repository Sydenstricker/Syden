// As capturas de tela da página do Syden na Microsoft Store, nos três idiomas.
//
// POR QUE UM SCRIPT, e não a tecla PrintScreen: a Store pede quatro imagens por idioma, todas do
// mesmo tamanho exato. São doze no total, e elas precisam ser refeitas toda vez que a aparência do
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
//   Um idioma só:  IDIOMAS=en node e2e/capturas-da-loja.mjs
//
// Sai em e2e/fotos/loja/<idioma>/1-inicio.png … 4-voz.png
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { dispensarPresentes } from './ajuda.mjs';

const SITE = process.env.SITE ?? 'https://syden.chat';
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
 * Os três idiomas que o Syden REALMENTE fala.
 *
 * O app lista 74 na tela de configurações, mas só estes três têm dicionário; os outros aparecem em
 * português. Fazer captura de um idioma sem tradução seria prometer na Store o que o app não
 * entrega — e a pessoa que baixasse por isso desinstalaria na primeira tela.
 *
 * `nome` é como o idioma aparece escrito na lista de Configurações → Idioma, que é por onde o script
 * clica. `lang` é o que a página passa a declarar, e serve de conferência.
 */
const IDIOMAS_POSSIVEIS = [
  { pasta: 'pt-BR', nome: null, lang: 'pt-BR' }, // o padrão: não precisa trocar nada
  { pasta: 'en', nome: 'English', lang: 'en' },
  { pasta: 'es', nome: 'Español', lang: 'es' },
];

const pedidos = (process.env.IDIOMAS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const IDIOMAS = pedidos.length ? IDIOMAS_POSSIVEIS.filter((i) => pedidos.includes(i.pasta)) : IDIOMAS_POSSIVEIS;

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

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const contexto = await browser.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  // Sem isto o Chrome captura no tamanho lógico, e numa tela de alta densidade a imagem sai com
  // metade dos pixels — aí a Store recusa por tamanho.
  deviceScaleFactor: 1,
  locale: 'pt-BR',
});
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
    await page.waitForTimeout(800);
    return true;
  }
  console.log(`    (não achei a comunidade "${COMUNIDADE}" — rode scripts/comunidade-de-demonstracao.mjs)`);
  return false;
}

/** Abre Configurações. Serve para trocar o idioma e é o mesmo caminho em qualquer língua. */
async function abrirConfiguracoes() {
  await page.locator('button[aria-label="Configurações"], button[aria-label="Settings"], button[aria-label="Ajustes"]').first().click();
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
  // A aba se chama "Idioma", "Language" ou "Idioma" (espanhol): pega pela que estiver lá.
  await page.locator('.settings-tab').filter({ hasText: /Idioma|Language/ }).first().click();
  await page.locator('.idiomas').waitFor({ timeout: 10_000 });
  await page.locator('.idioma', { hasText: idioma.nome }).first().click();
  await page.waitForTimeout(900);

  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== idioma.lang) console.log(`    (aviso: a página diz lang="${lang}", esperava "${idioma.lang}")`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}

console.log(`Abrindo ${SITE} em ${LARGURA}x${ALTURA}\n`);

await page.goto(SITE, { waitUntil: 'networkidle', timeout: 45_000 });
await page.getByLabel('Nome de usuário').fill(USUARIO);
await page.getByLabel('Senha').fill(SENHA);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();

await page.locator('.vila').waitFor({ timeout: 45_000 });
console.log('Entrou como ' + USUARIO);

// A conta de teste cai entre as 25 primeiras, então o diálogo da insígnia cobre o Syden logo na
// entrada. Sem dispensá-lo, ele fica na frente de tudo e nenhum clique chega ao que está embaixo —
// foi assim que a primeira versão deste script morreu, esperando um botão que o próprio Playwright
// dizia estar "visível, habilitado e estável" e que tinha um diálogo por cima. O revisor da
// Microsoft vai ver essa mesma tela, e tudo bem: é o Syden dando as boas-vindas. Só não serve para
// a foto.
await dispensarPresentes(page);
console.log('Presentes dispensados');

// ---------- O aviso de privacidade ----------
//
// O script não sabe distinguir a comunidade de demonstração da comunidade dos amigos. Mas sabe
// contar quanta gente está à vista — e desconfiar em voz alta custa seis segundos, enquanto o erro
// contrário não tem desfazer.
await abrirAComunidade();
const quantos = await page.locator('.member-name').count().catch(() => 0);
if (quantos > 4) {
  console.log(`\n  ATENÇÃO: esta comunidade tem ${quantos} pessoas à vista.`);
  console.log('  As capturas vão para uma página PÚBLICA. Se esta for a comunidade dos seus amigos,');
  console.log('  pare agora (Ctrl+C) e use uma comunidade feita para demonstração.');
  await page.waitForTimeout(6000);
}

for (const idioma of IDIOMAS) {
  console.log(`\n── ${idioma.pasta} ──`);
  pasta = `${RAIZ}/${idioma.pasta}`;
  mkdirSync(pasta, { recursive: true });

  if (idioma.nome) {
    await trocarIdioma(idioma);
    console.log(`  idioma trocado para ${idioma.nome}`);
  }

  // Volta para a tela inicial antes de cada rodada, para as quatro fotos saírem sempre da mesma
  // sequência de cliques — em qualquer idioma.
  await page.locator('.rail-home, .rail-item').first().click().catch(() => {});
  await page.locator('.vila').waitFor({ timeout: 20_000 }).catch(() => {});

  // 1. A vila. Vem primeiro porque é o que o Syden tem que os outros não têm: é a imagem que faz
  //    alguém parar de rolar a lista de aplicativos.
  console.log('  1. A vila');
  await foto('1-inicio', 2500);

  // 2. A loja. Antes das conversas de propósito: é a única tela que não mostra mensagem de
  //    ninguém, então é a única em que não há nada a conferir depois.
  console.log('  2. A loja de enfeites');
  const loja = page.getByText(/^(Loja|Shop|Tienda)$/).first();
  if (await loja.isVisible().catch(() => false)) {
    await loja.click();
    await foto('2-loja', 1800);
    await page.getByRole('button', { name: /Voltar|Back|Volver/ }).first().click().catch(() => {});
    await page.locator('.vila').waitFor({ timeout: 10_000 }).catch(() => {});
  } else {
    console.log('    (não achei a Loja na tela inicial — pulei)');
  }

  // 3. Um canal de texto.
  console.log('  3. Um canal de texto');
  await abrirAComunidade();
  const canal = page.locator('.channel-name').first();
  if (await canal.isVisible().catch(() => false)) {
    await canal.click();
    await foto('3-conversa', 2000);
  } else {
    console.log('    (não achei um canal de texto — tire esta à mão)');
  }

  // 4. Uma sala de voz.
  //
  //    O script NÃO entra na sala: entrar abriria o microfone e poria a conta de demonstração
  //    dentro de uma chamada de verdade, possivelmente com gente lá. Ele fotografa a antessala, que
  //    já mostra quem está dentro e o botão de entrar.
  console.log('  4. Uma sala de voz');
  const salaDeVoz = page.locator('.channel-item').filter({ has: page.locator('.channel-voice, [class*="volume"]') }).first();
  const alvo = (await salaDeVoz.isVisible().catch(() => false)) ? salaDeVoz : page.locator('.channel-name').nth(1);
  if (await alvo.isVisible().catch(() => false)) {
    await alvo.click();
    await foto('4-voz', 2000);
  } else {
    console.log('    (não achei uma sala de voz — tire esta à mão)');
  }
}

// Devolve o Syden ao português: a conta fica como estava, e o revisor da Microsoft (que entra com
// ela) vê o idioma padrão em vez do último que este script deixou.
if (IDIOMAS.some((i) => i.nome)) {
  await trocarIdioma({ nome: 'Português', lang: 'pt-BR' }).catch(() => {});
  console.log('\nIdioma devolvido ao português.');
}

await browser.close();

console.log(`\nPronto. As imagens estão em ${RAIZ}/`);
console.log('Confira UMA POR UMA antes de enviar: nenhuma pode ter nome ou mensagem de pessoa real.');
