// O microfone aberto que manda silêncio: "ninguém me ouve" sem aviso nenhum na tela.
//
// Relato de 03/10/2026: no Chrome, a pessoa falava e os amigos não ouviam, e sair e entrar de novo não
// resolvia. As causas desse tipo são do aparelho (entrada errada, mudo no Windows), então o teste
// fabrica as duas situações no navegador:
//   - a Ana tem um microfone que entrega SILÊNCIO DIGITAL — tem de ver o aviso;
//   - a Bia tem o microfone falso do Chrome, que apita — NÃO pode ver aviso nenhum (falso alarme
//     num app de voz é pior que nenhum alarme).
//
// Precisa do LiveKit no ar:  npm run dev:livekit
//
//   node e2e/microfone-sem-som.mjs
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

/** No lugar do microfone: um fluxo de áudio de verdade, mas só com zeros — o aparelho errado. */
const MICROFONE_MUDO = () => {
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (pedido) => {
    if (!pedido?.audio || pedido.video) return original(pedido);
    const ctx = new AudioContext();
    const oscilador = ctx.createOscillator();
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    const destino = ctx.createMediaStreamDestination();
    oscilador.connect(ganho).connect(destino);
    oscilador.start();
    return destino.stream;
  };
};

const { browser } = await abrirNavegador();

async function entrar(prefixo, mudo) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  vigiar(page);
  if (mudo) await page.addInitScript(MICROFONE_MUDO);
  await criarConta(page, prefixo);
  await dispensarPresentes(page);
  return page;
}

const ana = await entrar('micmudo', true);
await ana.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await ana.getByText('Criar a minha').click();
await ana.getByLabel('Nome da comunidade').fill('Mic ' + Date.now().toString().slice(-5));
await ana.locator('.dialog .btn-primary').click();
await ana.locator('.channel-list').waitFor({ timeout: 20000 });
await ana.locator('button[aria-label="Configurações"]').first().click();
await ana.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
await ana.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
const convite = (await ana.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.locator('.invite-row code').first().innerText());
await ana.keyboard.press('Escape');

const bia = await entrar('micbom', false);
await bia.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await bia.getByText('Entrar com um convite').click();
await bia.getByLabel('Código de convite').fill(convite.trim());
await bia.locator('.dialog .btn-primary').click();
await bia.locator('.channel-list').waitFor({ timeout: 20000 });

for (const page of [ana, bia]) {
  await page.locator('.rail-list .rail-item').last().click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
}
ok('as duas estão na sala, com o microfone aberto');

// O aviso espera 20 s de silêncio absoluto; 30 s dá folga para o relógio de 2 em 2 s.
await ana.locator('.microfone-sem-som').waitFor({ timeout: 35000 }).catch(() => {});
const aviso = ana.locator('.microfone-sem-som');
(await aviso.count()) === 1 && (await aviso.isVisible())
  ? ok(`a Ana, com o microfone mandando silêncio, vê o aviso: "${(await aviso.innerText()).trim()}"`)
  : falhou('a Ana fala para o vazio e a tela não diz nada');
await ana.screenshot({ path: 'e2e/fotos/microfone-sem-som.png' });

// A Bia entrou depois: mais 10 s garantem que ela também passou da janela de 20 s.
await bia.waitForTimeout(10000);
(await bia.locator('.microfone-sem-som').count()) === 0
  ? ok('a Bia, com microfone de verdade, não vê alarme falso')
  : falhou('a Bia tem microfone funcionando e recebeu o aviso — alarme falso');

// Clicar leva aonde se troca o microfone.
if ((await aviso.count()) === 1) {
  await aviso.click();
  await ana.locator('.settings-tab.active, .settings-tab[aria-selected="true"]').first().waitFor({ timeout: 5000 }).catch(() => {});
  const aba = await ana.locator('.settings-modal h2, .settings-content h2').first().innerText().catch(() => '');
  /Voz e vídeo/.test(aba) ? ok('clicar no aviso abre "Voz e vídeo"') : falhou(`clicar no aviso abriu: "${aba}"`);
}

await browser.close();
resumo('o microfone que manda silêncio');
