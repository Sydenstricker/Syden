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

export async function abrirNavegador({ viewport = { width: 1500, height: 950 }, permissoes = [] } = {}) {
  const executablePath = CAMINHOS_DO_CHROME.find((caminho) => existsSync(caminho));
  if (!executablePath) {
    throw new Error('Não achei o Chrome. Aponte com a variável CHROME_PATH.');
  }
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
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

/** Cadastra alguém novo e espera a tela inicial aparecer. Devolve o nome de usuário criado. */
export async function criarConta(page, prefixo) {
  const username = prefixo + Date.now().toString().slice(-5);
  await page.goto(SITE);
  await page.getByText('Cadastre-se').click();
  await page.getByLabel('Nome de usuário').fill(username);
  await page.getByLabel('Senha').fill('segredo123');
  await page.getByLabel('Código de convite').fill(CONVITE);
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.locator('.vila').waitFor({ timeout: 30_000 });
  return username;
}
