// Peças comuns dos testes de ponta a ponta: abrir o navegador, relatar o que passou e o que falhou, e
// criar uma conta. Cada teste cuida só do que ele quer provar.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

/** Onde o site de teste está servindo. Trocável: SITE=http://localhost:5173 node e2e/coelhos.mjs */
export const SITE = process.env.SITE ?? 'http://localhost:5174';

/** O código de convite usado para criar as contas de teste. */
export const CONVITE = process.env.CONVITE ?? 'teste';

// Usamos o Chrome já instalado na máquina em vez de baixar o navegador do Playwright (uns 150 MB por
// versão). CHROME_PATH manda em tudo; sem ela, procuramos nos lugares de sempre do Windows e do Linux.
const CAMINHOS_DO_CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

let falhas = 0;

export const ok = (mensagem) => console.log('✔', mensagem);

export const falhou = (mensagem) => {
  falhas += 1;
  console.log('✘', mensagem);
  process.exitCode = 1;
};

/** Conta o resultado no fim do arquivo. */
export const resumo = (nome) => {
  console.log(falhas === 0 ? `\n✔ ${nome}: tudo certo` : `\n✘ ${nome}: ${falhas} problema(s)`);
};

export async function abrirNavegador({ viewport = { width: 1500, height: 950 }, permissoes = [], audioFalso = null, argsExtras = [] } = {}) {
  const executablePath = CAMINHOS_DO_CHROME.find((caminho) => existsSync(caminho));
  if (!executablePath) {
    throw new Error('Não achei o Chrome. Aponte com a variável CHROME_PATH.');
  }
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      // O MICROFONE FALSO, que toca um bipe conhecido. Sem isto o Chrome dos testes abria o microfone
      // DE VERDADE da máquina (medido: "High Definition Audio Device") — gravava a sala de quem roda o
      // teste, e media o silêncio dela em vez de um som que se sabe que existe. Foi assim que "as
      // vozes do clipe saem mudas" parecia ser culpa do Syden sem dar para saber.
      // MICROFONE_REAL=1 desliga o falso, para o raro teste que precisa do aparelho de verdade (medir
      // alarme falso com um microfone real numa sala quieta, por exemplo). Nunca por padrão.
      ...(process.env.MICROFONE_REAL ? [] : ['--use-fake-device-for-media-stream']),
      // No lugar do bipe, um arquivo WAV de verdade (voz com ruído, para medir a supressão).
      ...(audioFalso ? [`--use-file-for-fake-audio-capture=${audioFalso}`] : []),
      ...argsExtras,
    ],
  });
  const contexto = await browser.newContext({ viewport, permissions: permissoes });
  return { browser, contexto };
}

/** Erro de JavaScript na tela é falha do teste, mesmo que o resto da verificação passe. */
export function vigiar(page) {
  page.on('pageerror', (e) => falhou('erro de JavaScript na tela: ' + String(e).slice(0, 180)));
  return page;
}

/** Abre uma aba já vigiada dentro de um contexto que já existe. */
export async function novaAba(contexto) {
  return vigiar(await contexto.newPage());
}

/**
 * Uma PESSOA nova: contexto próprio, ou seja, sessão e localStorage separados. É o que os testes com mais
 * de um participante precisam — duas abas do mesmo contexto entram com a mesma conta, sem perguntar nada.
 */
export async function novaPessoa(browser, { viewport = { width: 1500, height: 950 }, permissoes = [] } = {}) {
  const contexto = await browser.newContext({ viewport, permissions: permissoes });
  return vigiar(await contexto.newPage());
}

/**
 * Conta nova cai entre as 25 primeiras, então a tela de destaque do presente cobre o Syden logo na
 * entrada. É o comportamento certo — e atrapalha todo teste que não é sobre ela. Aqui o presente é
 * resgatado e a tela sai da frente. Quem testa a própria tela de destaque (insignias.mjs) não chama isto.
 */
export async function dispensarPresentes(page) {
  for (let i = 0; i < 4; i++) {
    const tela = page.locator('.revelacao');
    // Espera curta: o presente chega logo depois da tela inicial, ou não existe para esta conta.
    const apareceu = await tela.waitFor({ timeout: i === 0 ? 4000 : 1200 }).then(
      () => true,
      () => false,
    );
    if (!apareceu) return;
    await page.getByRole('button', { name: /Resgatar/ }).click();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await tela.waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
  }
}

/**
 * Cadastra alguém novo e espera a tela inicial aparecer. Devolve o nome de usuário criado.
 *
 * ESTE AJUDANTE ESTAVA VELHO e ninguém tinha notado, porque cada teste escrevia o cadastro na mão. Ele
 * preenchia um "Código de convite" que saiu da tela de cadastro (o código passou a chegar pelo LINK,
 * ou a ser digitado dentro do app em "Adicionar comunidade") e não preenchia o e-mail, que virou
 * obrigatório. Chamá-lo falhava com um tempo esgotado esperando um campo que não existe mais.
 *
 * O `exact` no rótulo da senha também é necessário: a dica embaixo do e-mail fala em recuperar a
 * SENHA, então "Senha" sem exact casa com os dois campos.
 *
 * Conta nova não entra em comunidade nenhuma: quem se cadastra cai na vila, sozinho. Para pôr duas
 * pessoas na mesma comunidade, uma cria e passa o código para a outra (ver e2e/lixeira.mjs).
 */
export async function criarConta(page, prefixo) {
  return cadastrar(page, prefixo + Date.now().toString().slice(-6));
}

/**
 * O mesmo cadastro, com o nome de usuário EXATO que o teste pedir.
 *
 * ---------------------------------------------------------------------------------------------------
 * POR QUE ELE PASSOU A EXISTIR: **sete testes tinham a própria cópia destas sete linhas**, e todas
 * tinham apodrecido junto, do mesmo jeito. Eles não chamavam o criarConta porque precisam escolher o
 * nome — e o criarConta inventa o dele —, então cada um copiou o bloco e o bloco envelheceu sete vezes.
 *
 * O estrago era pior do que "teste falhando": eles falhavam na PRIMEIRA linha, antes de medir coisa
 * alguma, e com um erro de seletor que parece problema do teste. A tela de insígnias, a ordem da vila,
 * a troca de idioma e o aviso no ícone estavam sem medição nenhuma, e nada avisava.
 * ---------------------------------------------------------------------------------------------------
 */
export async function cadastrar(page, username) {
  // O CÓDIGO VAI NO LINK, e não num campo. O servidor recusa cadastro sem convite (403), e a tela já
  // não tem onde digitá-lo: quem convida manda um link com ?convite=… e o campo desapareceu de
  // propósito, para o cadastro ter três campos em vez de quatro. Um teste que abre o site pelado bate
  // no 403 e fica esperando uma tela que nunca vem.
  await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'convite=' + encodeURIComponent(CONVITE));
  await page.getByLabel('Nome de usuário').fill(username);
  await page.getByLabel('E-mail').fill(username + '@exemplo.test');
  // O `exact` é obrigatório: a dica embaixo do e-mail fala em recuperar a SENHA, então "Senha" sem ele
  // casa com dois campos e o Playwright recusa a jogada inteira.
  await page.getByLabel('Senha', { exact: true }).fill('segredo123');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  // DUAS CHEGADAS POSSÍVEIS, e esperar só uma trava o teste por meio minuto sem dizer por quê. Quem
  // entra sem convite para comunidade nenhuma cai na vila. Mas o PRIMEIRO cadastro do banco inteiro
  // ganha a comunidade inicial do Syden e cai dentro dela — e num banco de teste recém-criado o
  // primeiro cadastro é sempre o do teste.
  await page.locator('.vila, .channel-name').first().waitFor({ timeout: 30_000 });
  return username;
}

/**
 * O título "Bem-vindo a #geral!", do jeito que ele existe na tela de verdade.
 *
 * NÃO DÁ PARA PROCURAR A FRASE INTEIRA COMO TEXTO SOLTO, e isto não é capricho do teste: o nome do
 * canal vem embrulhado em dois caracteres de isolamento bidirecional (U+2068 e U+2069), que é o que
 * impede `#combinados` de virar `combinados#` em árabe (ver web/src/bidi.ts). Eles são invisíveis e
 * sem largura, mas estão no texto — então `getByText('Bem-vindo a #geral!')` não acha nada e o teste
 * espera meio minuto por uma tela que está ali na frente.
 */
export const tituloDoCanal = (nome) => new RegExp('Bem-vindo a .{0,2}#' + nome);
