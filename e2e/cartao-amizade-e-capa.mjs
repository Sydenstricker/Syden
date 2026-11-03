// TRÊS PEDIDOS DE 02/11/2026, conferidos na tela:
//   1. o cartão de perfil (clicar em alguém) tem "Pedir amizade"; do outro lado, "Aceitar o pedido de amizade"; e, aceito,
//      o botão some dos dois cartões;
//   2. quem administra clica na capa da comunidade e cai nas Configurações → Comunidade, rolada até a capa; quem é só
//      membro clica e não acontece nada;
//   3. a câmera ao lado do microfone, na barra de baixo, só aparece dentro de uma chamada (sem o LiveKit, só o "fora").
//
// Fotos em FOTOS (padrão: e2e/fotos/cartao-*.png).
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, novaPessoa, ok, resumo } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });

const { browser } = await abrirNavegador();
try {
  const ana = await novaPessoa(browser);
  const nomeDaAna = await criarConta(ana, 'ana');
  await dispensarPresentes(ana);
  // A ana cria a comunidade: assim ela administra (a capa) e as duas ficam na mesma, sem depender do banco.
  await ana.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await ana.getByText('Criar a minha').click();
  await ana.getByLabel('Nome da comunidade').fill('Cartão ' + Date.now().toString().slice(-5));
  await ana.locator('.dialog .btn-primary').click();
  await ana.locator('.channel-list').waitFor({ timeout: 20000 });

  // ---------- a capa, para quem administra ----------
  const cabecalho = ana.locator('.sidebar-header.capa-editavel');
  // Esperando: logo depois de criar, a barra pode ainda mostrar a comunidade anterior por um instante.
  await cabecalho.waitFor({ timeout: 10000 }).then(
    () => ok('a capa é clicável para quem administra'),
    () => falhou('a capa não ficou clicável para a dona'),
  );
  await ana.screenshot({ path: path.join(FOTOS, 'cartao-capa-lapis.png'), clip: (await ana.locator('.sidebar-header').boundingBox()) ?? undefined });
  await cabecalho.click({ position: { x: 60, y: 30 } });
  const titulo = ana.locator('#capa-da-comunidade');
  await titulo.waitFor({ timeout: 8000 });
  await ana.waitForTimeout(300);
  const naVista = await titulo.evaluate((el) => {
    const caixa = el.getBoundingClientRect();
    return caixa.top >= 0 && caixa.bottom <= window.innerHeight;
  });
  naVista ? ok('as configurações abrem roladas até a capa') : falhou('as configurações abriram, mas a capa ficou fora da vista');
  await ana.screenshot({ path: path.join(FOTOS, 'cartao-capa-configuracoes.png') });

  // O convite, para a bia entrar.
  await ana.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
  const convite = (await ana.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.locator('.invite-row code').first().innerText());
  await ana.keyboard.press('Escape');

  // ---------- a câmera, fora da chamada ----------
  (await ana.locator('.sidebar button[aria-label="Ligar câmera"]').count()) === 0
    ? ok('fora de chamada, a barra de baixo não mostra a câmera')
    : falhou('a câmera apareceu na barra de baixo sem chamada');

  const bia = await novaPessoa(browser);
  const nomeDaBia = await criarConta(bia, 'bia');
  await dispensarPresentes(bia);
  await bia.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await bia.getByText('Entrar com um convite').click();
  await bia.getByLabel('Código de convite').fill(convite.trim());
  await bia.locator('.dialog .btn-primary').click();
  await bia.locator('.channel-list').waitFor({ timeout: 20000 });

  // Na comunidade da ana, a bia é membro: a capa é só desenho.
  (await bia.locator('.sidebar-header.capa-editavel, .capa-lapis').count()) === 0
    ? ok('para quem é só membro, a capa não é clicável')
    : falhou('a capa ficou clicável para quem não administra');

  // ---------- o pedido, pelo cartão ----------
  await bia.locator('.channel-name', { hasText: 'geral' }).first().click();
  const anaNaLista = bia.locator('.members .member', { hasText: nomeDaAna }).first();
  await anaNaLista.waitFor({ timeout: 15000 });
  await anaNaLista.click();
  const cartaoDaBia = bia.locator('.perfil-cartao');
  const pedir = cartaoDaBia.getByRole('button', { name: 'Pedir amizade' });
  await pedir.waitFor({ timeout: 8000 }).then(
    () => ok('o cartão de alguém tem "Pedir amizade"'),
    () => falhou('o cartão não mostrou "Pedir amizade"'),
  );
  await pedir.click();
  await cartaoDaBia
    .getByText('Pedido de amizade enviado')
    .waitFor({ timeout: 8000 })
    .then(
      () => ok('depois do clique, o cartão diz que o pedido foi enviado'),
      () => falhou('o cartão não mudou depois de pedir'),
    );
  await bia.screenshot({ path: path.join(FOTOS, 'cartao-pedido-enviado.png'), clip: (await cartaoDaBia.boundingBox()) ?? undefined });
  await bia.keyboard.press('Escape');

  // A ana abre o cartão da bia e aceita.
  await ana.locator('.channel-name', { hasText: 'geral' }).first().click();
  const biaNaLista = ana.locator('.members .member', { hasText: nomeDaBia }).first();
  await biaNaLista.waitFor({ timeout: 15000 });
  await biaNaLista.click();
  const cartaoDaAna = ana.locator('.perfil-cartao');
  const aceitar = cartaoDaAna.getByRole('button', { name: 'Aceitar o pedido de amizade' });
  await aceitar.waitFor({ timeout: 8000 }).then(
    () => ok('do outro lado, o cartão oferece aceitar'),
    () => falhou('o cartão de quem recebeu não ofereceu aceitar'),
  );
  await ana.screenshot({ path: path.join(FOTOS, 'cartao-aceitar.png'), clip: (await cartaoDaAna.boundingBox()) ?? undefined });
  await aceitar.click();
  await ana
    .waitForFunction(() => !document.querySelector('.perfil-cartao .perfil-acao-sutil, .perfil-cartao .perfil-amizade-enviada'), null, { timeout: 8000 })
    .then(
      () => ok('aceito, o botão some do cartão'),
      () => falhou('o botão continuou no cartão depois de aceitar'),
    );
  await ana.keyboard.press('Escape');

  // Do lado da bia, o cartão da ana já não oferece nada (amigas).
  await anaNaLista.click();
  await cartaoDaBia.waitFor({ timeout: 5000 });
  await bia.waitForTimeout(1500);
  (await cartaoDaBia.locator('.perfil-acao-sutil, .perfil-amizade-enviada').count()) === 0
    ? ok('entre amigas, o cartão não mostra botão de amizade')
    : falhou('o cartão ainda mostra o botão de amizade entre amigas');
} catch (erro) {
  falhou(String(erro));
} finally {
  await browser.close();
  resumo('cartão: amizade, capa e câmera');
}
