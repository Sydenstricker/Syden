// Tickets (pacote MEE6, 12/10/2026): a dona liga nas configurações; a Bia abre um ticket pelo início da comunidade
// e cai na conversa "Ticket: …"; a dona recebe a mesma conversa e encerra pelas configurações.
//
//   SITE=http://localhost:5174/app/ node e2e/tickets.mjs   (API de teste na 3099)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  return page;
}

try {
  const dona = await entrar('dona' + s);
  await dona.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await dona.locator('.community-choice-option').first().click();
  await dona.locator('form.dialog input').first().fill('Clã ' + s);
  await dona.locator('form.dialog .btn-primary').click();
  await dona.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await dona.evaluate(async () => {
    const r = await fetch('http://localhost:3099/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Clã'))?.inviteCode;
  });

  await dona.locator('button[aria-label="Configurações"]').first().click();
  await dona.locator('.settings-tab', { hasText: /Tickets/ }).first().click();
  await dona.getByLabel('Deixar os membros abrirem tickets').check();
  await dona.waitForTimeout(500);
  ok('a dona ligou os tickets');

  const bia = await entrar('bia' + s);
  await bia.evaluate(
    async (codigo) =>
      fetch('http://localhost:3099/api/communities/join', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: JSON.stringify({ code: codigo }),
      }),
    convite,
  );
  await bia.reload();
  await dispensarPresentes(bia);
  await bia.locator('.rail-item', { hasText: /^C\d$/ }).first().click();
  await bia.locator('.inicio-link').first().click();
  await bia.getByRole('button', { name: 'Falar com a administração' }).click();
  await bia.getByLabel('Assunto do ticket').fill('Quero o cargo de artista');
  await bia.getByRole('button', { name: 'Abrir ticket' }).click();
  await bia.getByText('Ticket: Quero o cargo de artista').first().waitFor({ timeout: 10000 });
  ok('a Bia abriu o ticket pelo início e caiu na conversa');
  await bia.screenshot({ path: path.join(FOTOS, 'ticket-aberto.png') });

  await dona.locator('.tickets-lista li', { hasText: 'Quero o cargo de artista' }).waitFor({ timeout: 10000 }).catch(async () => {
    // A lista da seção é lida ao abrir: reabre a aba para ver o ticket novo.
    await dona.locator('.settings-tab', { hasText: /Comandos/ }).first().click();
    await dona.locator('.settings-tab', { hasText: /Tickets/ }).first().click();
  });
  await dona.locator('.tickets-lista li', { hasText: 'Quero o cargo de artista' }).waitFor({ timeout: 10000 });
  ok('o ticket aparece para a dona nas configurações');
  await dona.locator('.settings-content').first().screenshot({ path: path.join(FOTOS, 'tickets-config.png') });
  await dona.locator('.tickets-lista li', { hasText: 'Quero o cargo de artista' }).getByRole('button', { name: 'Encerrar' }).click();
  await dona.locator('.tickets-lista.encerrados li', { hasText: 'Quero o cargo de artista' }).waitFor({ timeout: 5000 });
  ok('a dona encerrou o ticket');
  await bia.getByText('Encerrado: Quero o cargo de artista').first().waitFor({ timeout: 10000 });
  ok('e a conversa da Bia mudou de nome na hora');
} catch (e) {
  falhou(String(e).slice(0, 300));
} finally {
  await browser.close();
}
resumo('Tickets');
