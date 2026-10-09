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

  if (idioma.nome) {
    await trocarIdioma(idioma);
    console.log(`  idioma trocado para ${idioma.nome}`);
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

  /** Abre um objeto do quarto pelo nome e espera a tela trocar. O botão é o do teclado (o mouse clica no desenho):
   *  foco e Enter. Até 08/10/2026 eram os balões da vila. */
  async function abrirBalao(titulo) {
    const objeto = page.getByRole('button', { name: titulo }).first();
    if (!(await objeto.count())) return false;
    await objeto.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    return true;
  }

  /** Volta da tela cheia para a home (o quarto). */
  async function voltarParaAVila() {
    await page.getByRole('button', { name: /Voltar|Back|Volver|←/ }).first().click().catch(() => {});
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
  if (await abrirBalao(/Guarda-roupa|Wardrobe|Guardarropa/)) {
    await foto('3-guarda-roupa', 1800);
    await voltarParaAVila();
  } else {
    console.log('    (não achei o balão do Guarda-roupa na vila — tire esta à mão)');
  }

  // 4. OS AMIGOS.
  //
  //    Antes esta era a antessala de uma sala de voz, e não acrescentava nada: numa comunidade de
  //    demonstração não há ninguém em chamada, então a foto era uma sala vazia com um botão. Voz é
  //    o coração do Syden, mas não dá para simular gente numa chamada — quem está numa sala vive na
  //    memória do servidor, não no banco, e forjar isso seria construir um teatro inteiro para uma
  //    foto.
  //
  //    A tela de amigos, ao contrário, fica cheia sozinha: as pessoas da comunidade de demonstração
  //    aparecem como sugestões, com o motivo escrito ao lado de cada uma.
  // 5. A CHAMADA (só se houver gente na sala).
  //
  //    Depende de e2e/sala-cheia.mjs estar rodando noutra janela: sem ele a sala está vazia e a
  //    foto não diz nada, que era o problema da versão anterior. Quando há gente, a antessala
  //    mostra os avatares e os nomes de quem está dentro.
  console.log('  5. A chamada');
  const salaDeVoz = page.locator('.channel-name').filter({ hasText: /Sala/ }).first();
  if (await salaDeVoz.isVisible().catch(() => false)) {
    await salaDeVoz.click();
    await page.waitForTimeout(1500);
    const naSala = await page.locator('.voice-lobby-avatars img, .voice-lobby-avatars .avatar').count().catch(() => 0);
    if (naSala > 0) {
      await foto('5-chamada', 1500);
    } else {
      console.log('    (a sala está vazia — rode e2e/sala-cheia.mjs noutra janela e refaça só esta)');
    }
  }

  console.log('  4. Os amigos');
  if (await abrirBalao(/Amigos|Friends|Amigos/)) {
    await foto('4-amigos', 1800);
    await voltarParaAVila();
  } else {
    console.log('    (não achei o balão de Amigos na vila — tire esta à mão)');
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
