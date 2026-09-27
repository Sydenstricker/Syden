// As capturas de tela da página do Syden na Microsoft Store.
//
// POR QUE UM SCRIPT, e não a tecla PrintScreen: a Store pede quatro imagens, todas do mesmo tamanho
// exato, e elas precisam ser refeitas toda vez que a aparência do app mudar. À mão, isso é um
// trabalho chato que sai um pouco diferente a cada vez — janela num tamanho, barra de tarefas
// aparecendo na outra. Aqui saem sempre iguais, em 1920x1080, sem nada em volta.
//
// ATENÇÃO À PRIVACIDADE. Estas imagens vão para uma página PÚBLICA. Se a conta usada aqui participar
// da comunidade dos seus amigos, você estará publicando os nomes e as mensagens deles para o mundo,
// sem que ninguém tenha sido consultado. Use uma comunidade feita para demonstração, com conversa
// inventada — o script avisa se achar que não é o caso.
//
// A SENHA NÃO VAI NA LINHA DE COMANDO: linha de comando fica no histórico do terminal e aparece para
// quem listar os processos da máquina. Ela vem por variável de ambiente.
//
//   SYDEN_USUARIO=microsoft-teste SYDEN_SENHA=... node e2e/capturas-da-loja.mjs
//
// Sai em e2e/fotos/loja/1-inicio.png … 4-loja.png
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SITE = process.env.SITE ?? 'https://syden.chat';
const USUARIO = process.env.SYDEN_USUARIO;
const SENHA = process.env.SYDEN_SENHA;
const PASTA = 'e2e/fotos/loja';

/** O tamanho que a Microsoft Store espera para computador. O mínimo é 1366x768; este é o bonito. */
const LARGURA = 1920;
const ALTURA = 1080;

if (!USUARIO || !SENHA) {
  console.error('Faltou a conta. Rode assim, com a senha na variável e não no comando:\n');
  console.error('  SYDEN_USUARIO=microsoft-teste SYDEN_SENHA=a-senha node e2e/capturas-da-loja.mjs\n');
  process.exit(1);
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

mkdirSync(PASTA, { recursive: true });

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const contexto = await browser.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  // Sem isto o Chrome captura no tamanho lógico e a imagem sai com metade dos pixels numa tela
  // de alta densidade — aí a Store recusa por tamanho.
  deviceScaleFactor: 1,
  locale: 'pt-BR',
});
const page = await contexto.newPage();

/** Tira a foto depois de deixar a tela assentar: animação pela metade vira borrão na loja. */
async function foto(nome, espera = 1200) {
  await page.waitForTimeout(espera);
  const caminho = `${PASTA}/${nome}.png`;
  await page.screenshot({ path: caminho });
  console.log('  ✓ ' + caminho);
}

console.log(`Abrindo ${SITE} em ${LARGURA}x${ALTURA}\n`);

await page.goto(SITE, { waitUntil: 'networkidle', timeout: 45_000 });
await page.getByLabel('Nome de usuário').fill(USUARIO);
await page.getByLabel('Senha').fill(SENHA);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();

// A vila é a tela inicial: quando ela aparece, a conta entrou.
await page.locator('.vila').waitFor({ timeout: 45_000 });
console.log('Entrou como ' + USUARIO + '\n');

// ---------- O aviso de privacidade ----------
//
// Antes de fotografar qualquer conversa, conta quantas pessoas existem na comunidade aberta. Uma
// comunidade de demonstração tem duas ou três; a dos amigos tem muito mais. Não dá para o script
// saber ao certo, mas dá para ele desconfiar em voz alta — e é melhor um aviso à toa do que
// descobrir depois que os nomes dos seus amigos estão na Microsoft Store.
const quantos = await page.locator('.member-name').count().catch(() => 0);
if (quantos > 4) {
  console.log(`  ATENÇÃO: esta comunidade tem ${quantos} pessoas à vista.`);
  console.log('  As capturas vão para uma página PÚBLICA. Se esta for a comunidade dos seus amigos,');
  console.log('  pare agora (Ctrl+C) e use uma comunidade feita para demonstração.\n');
  await page.waitForTimeout(6000);
}

// ---------- 1. A tela inicial ----------
// Vem primeiro porque é o que o Syden tem que os outros não têm: é a imagem que faz alguém parar.
console.log('1. A vila');
await foto('1-inicio', 2500);

// ---------- 2. A loja ----------
// Antes das conversas de propósito: ela não mostra mensagem de ninguém, então nunca há risco aqui.
console.log('2. A loja de enfeites');
const loja = page.getByText('Loja', { exact: true }).first();
if (await loja.isVisible().catch(() => false)) {
  await loja.click();
  await foto('2-loja', 1800);
  await page.getByRole('button', { name: /Voltar/ }).click().catch(() => {});
  await page.locator('.vila').waitFor({ timeout: 10_000 }).catch(() => {});
} else {
  console.log('  (não achei a Loja na tela inicial — pulei)');
}

// ---------- 3. Um canal de texto ----------
console.log('3. Um canal de texto');
const canalDeTexto = page.locator('.channel-item, .sidebar .channel').filter({ hasText: /#|geral/ }).first();
if (await canalDeTexto.isVisible().catch(() => false)) {
  await canalDeTexto.click();
  await foto('3-conversa', 2000);
} else {
  console.log('  (não achei um canal de texto na lista — clique você mesmo e rode de novo)');
}

// ---------- 4. Uma sala de voz ----------
//
// O script NÃO entra na sala: entrar abriria o microfone e poria a conta de demonstração dentro de
// uma chamada de verdade, possivelmente com gente lá. Ele fotografa a antessala, que é onde
// aparecem quem está dentro e o botão de entrar.
console.log('4. Uma sala de voz');
const salaDeVoz = page.locator('.channel-item, .sidebar .channel').filter({ hasText: /voz|Sala|geral/i }).nth(1);
if (await salaDeVoz.isVisible().catch(() => false)) {
  await salaDeVoz.click();
  await foto('4-voz', 2000);
} else {
  console.log('  (não achei uma sala de voz — clique você mesmo e rode de novo)');
}

await browser.close();

console.log(`\nPronto. As imagens estão em ${PASTA}/`);
console.log('Confira UMA POR UMA antes de enviar: nenhuma pode ter nome ou mensagem de pessoa real.');
