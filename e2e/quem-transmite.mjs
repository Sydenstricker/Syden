// OS AJUSTES DA TRANSMISSÃO DE 23/11/2026 (sugestões de quem usa):
//   1. com várias telas ao mesmo tempo, cada uma diz DE QUEM é ("ana · Tela falsa"), e não só o nome da janela;
//   2. o botão direito EM CIMA DA TRANSMISSÃO começa pelo som dela (a régua, calar, parar de assistir), e calar ali é o
//      mesmo volume do alto-falante de cima;
//   3. com uma tela em destaque, a faixa de rostos embaixo fica mais baixa;
//   4. o botão "Canais" do cabeçalho recolhe a coluna da esquerda, e a escolha volta ao recarregar.
//
// A ana transmite (um canvas com um tom, NUNCA a tela real) e a bia assiste.
//   node e2e/quem-transmite.mjs   (API de teste na 3099, site na 5174 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador({ argsExtras: ['--autoplay-policy=no-user-gesture-required'] });
const s = Date.now().toString().slice(-5);

/** No lugar da tela real: um canvas que mexe, com um tom de som (para a transmissão vir com áudio). */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = `hsl(${(n += 5) % 360} 60% 35%)`;
      ctx.fillRect(0, 0, 1280, 720);
    }, 1000 / 15);
    const stream = canvas.captureStream(15);
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const destino = ac.createMediaStreamDestination();
    osc.connect(destino);
    osc.start();
    stream.addTrack(destino.stream.getAudioTracks()[0]);
    return stream;
  };
};

async function entrar(nome) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'] });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await cadastrar(page, nome);
  await dispensarPresentes(page);
  await page.locator('.rail-list .rail-item').first().click();
  await page.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  return page;
}

const quadroGrande = (page) => page.locator('.stage-focus > .stage-main');

try {
  const ana = await entrar('ana' + s);
  const bia = await entrar('bia' + s);

  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  const convite = bia.locator('.stream-invite', { hasText: 'ana' + s });
  await convite.waitFor({ timeout: 20000 });
  ok('a ana transmite com a captura pedida antes do codec (o caminho do Safari)');
  await convite.getByRole('button', { name: 'Assistir' }).click();
  await quadroGrande(bia).locator('video[data-lk-source="screen_share"]').waitFor({ timeout: 20000 });

  // 1. De quem é a tela.
  const etiqueta = (await quadroGrande(bia).locator('.stream-etiqueta').innerText().catch(() => '')).trim();
  etiqueta.startsWith('ana' + s)
    ? ok(`a transmissão diz de quem é: "${etiqueta.replace(/\s+/g, ' ')}"`)
    : falhou(`a etiqueta da transmissão não começa pelo nome de quem transmite: "${etiqueta}"`);
  const nomeNaFaixa = await bia.evaluate(() =>
    [...document.querySelectorAll('.tile-name')].map((el) => el.textContent?.trim()).filter(Boolean),
  );
  ok(`nomes nos quadros: ${JSON.stringify(nomeNaFaixa)}`);

  // 3. A faixa compacta com a tela em destaque.
  const faixa = await bia.evaluate(() => {
    const f = document.querySelector('.stage-faixa');
    const strip = document.querySelector('.stage-strip');
    return f ? { compacta: f.classList.contains('compacta'), altura: Math.round(strip?.getBoundingClientRect().height ?? 0) } : null;
  });
  faixa?.compacta && faixa.altura <= 80
    ? ok(`com a tela em destaque, a faixa de rostos fica compacta (${faixa.altura}px)`)
    : falhou(`a faixa não ficou compacta: ${JSON.stringify(faixa)}`);
  await bia.screenshot({ path: 'e2e/fotos/quem-transmite-palco.png' });

  // 2. O botão direito em cima da transmissão.
  await quadroGrande(bia).click({ button: 'right' });
  const menu = bia.locator('.person-menu');
  await menu.waitFor({ timeout: 5000 });
  const regua = menu.locator('input[type="range"][aria-label="Volume da transmissão"]');
  (await regua.count()) === 1 ? ok('o menu da transmissão tem a régua do som dela') : falhou('o menu da transmissão não tem a régua do som');
  const calar = menu.getByText('Calar esta transmissão');
  (await calar.count()) === 1 ? ok('e o "Calar esta transmissão"') : falhou('o menu da transmissão não tem o calar');
  (await menu.getByText('Parar de assistir esta transmissão').count()) === 1
    ? ok('e o "Parar de assistir"')
    : falhou('o menu da transmissão não tem o parar de assistir');
  const ordem = await menu.evaluate((m) => {
    const txt = m.innerText;
    return { som: txt.indexOf('Som da transmissão'), perfil: txt.indexOf('Perfil') };
  });
  ordem.som >= 0 && (ordem.perfil < 0 || ordem.som < ordem.perfil)
    ? ok('o som da transmissão vem antes do menu da pessoa')
    : falhou(`ordem no menu: ${JSON.stringify(ordem)}`);
  await bia.screenshot({ path: 'e2e/fotos/quem-transmite-menu.png' });
  await calar.click();
  await bia.waitForTimeout(300);
  const calado = await bia.evaluate(() => {
    const b = document.querySelector('.stage-focus .stream-audio .stream-info-button');
    const audios = [...document.querySelectorAll('audio')].filter((a) => a.srcObject);
    return { pressionado: b?.getAttribute('aria-pressed'), rotulo: b?.getAttribute('aria-label'), volumes: audios.map((a) => a.volume) };
  });
  calado.pressionado === 'true'
    ? ok(`calar pelo menu acende o alto-falante de cima ("${calado.rotulo}")`)
    : falhou(`o alto-falante de cima não acompanhou o calar do menu: ${JSON.stringify(calado)}`);

  // E o caminho de volta, pelo botão de cima: o menu reaberto diz "Ouvir de novo" e depois "Calar".
  await bia.keyboard.press('Escape');
  await quadroGrande(bia).hover();
  await bia.locator('.stage-focus .stream-audio .stream-info-button').click();
  await quadroGrande(bia).click({ button: 'right' });
  await menu.waitFor({ timeout: 5000 });
  (await menu.getByText('Calar esta transmissão').count()) === 1
    ? ok('ouvir de novo pelo botão de cima volta o menu a "Calar"')
    : falhou('o menu não acompanhou o botão de cima');
  await bia.keyboard.press('Escape');

  // O botão direito em cima da PESSOA (um quadro sem tela) continua sem o som da transmissão.
  const quadroDaPessoa = bia.locator('.stage-strip .tile').filter({ hasNot: bia.locator('video[data-lk-source="screen_share"]') }).first();
  if (await quadroDaPessoa.count()) {
    await quadroDaPessoa.click({ button: 'right' });
    await menu.waitFor({ timeout: 5000 });
    (await menu.locator('input[aria-label="Volume da transmissão"]').count()) === 0
      ? ok('no quadro da pessoa, o menu é só o dela (sem o som da transmissão)')
      : falhou('o menu da pessoa mostrou o som da transmissão');
    await bia.keyboard.press('Escape');
  }

  // 4. Recolher os canais.
  const botaoCanais = bia.locator('.botao-dos-canais:visible').first();
  await botaoCanais.waitFor({ timeout: 5000 });
  const larguraAntes = await quadroGrande(bia).evaluate((el) => Math.round(el.getBoundingClientRect().width));
  await botaoCanais.click();
  const escondida = await bia.evaluate(() => {
    const s = document.querySelector('.app > .sidebar');
    return s ? getComputedStyle(s).display === 'none' : null;
  });
  await bia.waitForTimeout(300);
  const larguraDepois = await quadroGrande(bia).evaluate((el) => Math.round(el.getBoundingClientRect().width));
  escondida
    ? ok(`"Canais" recolhe a coluna da esquerda, e a tela cresce (${larguraAntes} → ${larguraDepois}px)`)
    : falhou(`a coluna dos canais não sumiu: ${escondida}`);
  (await bia.locator('.rail-list .rail-item').first().isVisible())
    ? ok('os ícones das comunidades continuam à mão')
    : falhou('os ícones das comunidades sumiram junto');
  await bia.screenshot({ path: 'e2e/fotos/quem-transmite-sem-canais.png' });
  // Recarregado, o Syden abre no quarto: lá não há o botão, e a coluna não pode ficar recolhida sem volta.
  await bia.reload();
  await bia.locator('.rail-list .rail-item').first().waitFor({ timeout: 30000 });
  await bia.waitForTimeout(1500);
  const noQuarto = await bia.evaluate(() => document.querySelector('.app')?.classList.contains('canais-escondidos'));
  noQuarto ? falhou('no quarto, a coluna ficou recolhida sem botão de volta') : ok('no quarto (sem o botão), a coluna não se recolhe');
  await bia.locator('.rail-list .rail-item').first().click();
  // Se a comunidade abrir no salão, a coluna aparece e se escolhe a sala; se abrir na sala, ela já vem recolhida.
  await bia.locator('.channel-name:visible', { hasText: /^Sala 2$/ }).first().click({ timeout: 4000 }).catch(() => {});
  await bia.locator('.botao-dos-canais:visible').first().waitFor({ timeout: 15000 });
  const continua = await bia.evaluate(() => document.querySelector('.app')?.classList.contains('canais-escondidos'));
  continua ? ok('de volta à sala, a escolha de recolher continua guardada') : falhou('recarregado, a escolha de recolher se perdeu');
  await bia.locator('.botao-dos-canais:visible').first().click();
  const voltou = await bia.evaluate(() => getComputedStyle(document.querySelector('.app > .sidebar')).display !== 'none');
  voltou ? ok('e o mesmo botão traz a coluna de volta') : falhou('o botão não trouxe a coluna de volta');

  // Num celular, o botão do computador não aparece.
  await bia.setViewportSize({ width: 390, height: 800 });
  await bia.waitForTimeout(300);
  (await bia.locator('.botao-dos-canais').first().isVisible())
    ? falhou('o botão "Canais" aparece na tela estreita')
    : ok('na tela estreita, o botão "Canais" fica escondido');
} catch (erro) {
  falhou(String(erro?.stack ?? erro));
} finally {
  await browser.close();
  resumo('quem transmite');
}
