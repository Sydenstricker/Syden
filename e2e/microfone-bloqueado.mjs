// O microfone BLOQUEADO pelo navegador: o caso real de 03/10/2026.
//
// Diário de saúde: "rexpeita4697: Sem acesso ao microfone: o navegador bloqueou." Os amigos o viam na
// sala com o microfone LIGADO e não ouviam nada; ele via uma faixa que sumia com um clique; e liberar a
// permissão não adiantava sem sair e entrar. O teste refaz a noite:
//   - a Ana entra SEM permissão de microfone (o Chrome recusa, como no bloqueio);
//   - ela tem de ver o aviso fixo, e a Bia tem de vê-la como silenciada;
//   - liberada a permissão no meio da chamada, o microfone volta SOZINHO, para as duas.
//
// Precisa do LiveKit no ar:  npm run dev:livekit
//
//   node e2e/microfone-bloqueado.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();

async function entrar(prefixo, permissoes) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: permissoes });
  const page = await ctx.newPage();
  vigiar(page);
  await criarConta(page, prefixo);
  await dispensarPresentes(page);
  return { ctx, page };
}

const ana = await entrar('bloqueada', []);
await ana.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await ana.page.getByText('Criar a minha').click();
await ana.page.getByLabel('Nome da comunidade').fill('Bloq ' + Date.now().toString().slice(-5));
await ana.page.locator('.dialog .btn-primary').click();
await ana.page.locator('.channel-list').waitFor({ timeout: 20000 });
await ana.page.locator('button[aria-label="Configurações"]').first().click();
await ana.page.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
await ana.page.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
const convite = (await ana.page.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.page.locator('.invite-row code').first().innerText());
await ana.page.keyboard.press('Escape');

const bia = await entrar('ouvinte', ['microphone']);
await bia.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await bia.page.getByText('Entrar com um convite').click();
await bia.page.getByLabel('Código de convite').fill(convite.trim());
await bia.page.locator('.dialog .btn-primary').click();
await bia.page.locator('.channel-list').waitFor({ timeout: 20000 });

for (const { page } of [bia, ana]) {
  await page.locator('.rail-list .rail-item').last().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
}
ok('as duas estão na sala; a Ana, sem permissão de microfone');

// ---------- o aviso fixo, do lado dela ----------
const aviso = ana.page.locator('.microfone-bloqueado');
await aviso.waitFor({ timeout: 15000 }).catch(() => {});
(await aviso.count()) === 1 ? ok(`a Ana vê o aviso: "${(await aviso.locator('strong').innerText()).trim()}"`) : falhou('a Ana não vê aviso nenhum de microfone bloqueado');
await ana.page.screenshot({ path: 'e2e/fotos/microfone-bloqueado.png' });
await ana.page.mouse.click(700, 300); // um clique qualquer na tela: a faixa antiga sumia assim
await ana.page.waitForTimeout(500);
(await aviso.count()) === 1 ? ok('e um clique em outro lugar não o faz sumir') : falhou('o aviso sumiu com um clique qualquer');

// ---------- do lado da Bia: a Ana aparece silenciada, e não "ligada" ----------
const anaNaLista = bia.page.locator('.voice-member', { hasText: /bloqueada/ });
// A linha TEM de existir: sem ela, procurar o ícone numa linha ausente dá zero e passaria por engano.
await anaNaLista.first().waitFor({ timeout: 15000 }).catch(() => {});
(await anaNaLista.count()) > 0 ? ok('a Bia vê a Ana na sala') : falhou('a Bia nem vê a Ana na sala');
(await anaNaLista.locator('.muted-icon').count()) > 0
  ? ok('a Bia vê a Ana com o microfone desligado')
  : falhou('a Bia vê a Ana com o microfone LIGADO — é o engano daquela noite');

// ---------- liberou a permissão: volta sozinho ----------
await ana.ctx.grantPermissions(['microphone']);
await aviso.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
(await aviso.count()) === 0 ? ok('liberada a permissão, o aviso some sozinho') : falhou('liberou a permissão e o aviso continua (o Syden não tentou de novo)');
await bia.page.waitForTimeout(2000);
(await anaNaLista.count()) > 0 && (await anaNaLista.locator('.muted-icon').count()) === 0
  ? ok('e a Bia passa a ver o microfone da Ana ligado')
  : falhou('a permissão voltou mas a Ana continua silenciada para a Bia');

await browser.close();
resumo('o microfone bloqueado');
