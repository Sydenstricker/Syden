// O CRIADOR DE COELHO NA APARÊNCIA → AVATAR (10/11/2026, pedidos dele: "gostei da tela de criação, pode implementar ao Syden?"
// e "usar os 16 avatares como sugestões"). Substitui o e2e do carrossel (avatar-atual.mjs), e confere o que ele conferia:
// - com um GIF de avatar, a aba abre no "Atual", com o GIF animado no avatar do canto, e sem Salvar;
// - as setas do "Coelho" só MOSTRAM (as 16 sugestões): recarregar volta ao GIF, e nada vai para os anteriores;
// - salvar uma sugestão intacta veste o desenho pronto dela, e o GIF vai para os anteriores; clicar nele volta.
// E o que é novo:
// - o palco é o coelho EM CAMADAS (um canvas pintado), que gira e acena ao clique;
// - mexer num traço vira "Personalizado"; salvar faz do coelho montado o avatar (o busto, nas listas);
// - o código copia e cola; "Meus coelhos" guarda na conta.
//
//   SITE=http://localhost:5174 node e2e/criador-de-coelho.mjs   (API de teste; FOTOS= pasta das fotos)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const foto = (p, nome) => p.locator('.criador').first().screenshot({ path: path.join(FOTOS, 'criador-' + nome + '.png') });
const GIF = path.join('e2e', 'pixel-art', 'personagem', 'blender', 'c', 'varrendo.gif');

const { browser, contexto } = await abrirNavegador({ viewport: { width: 1400, height: 1000 } });
try {
  const page = vigiar(await contexto.newPage());
  await criarConta(page, 'criador');
  await dispensarPresentes(page);

  const configuracoes = page.locator('[role="dialog"].settings');
  const valor = () => page.locator('.personagem-linha[aria-label="Coelho"] .personagem-valor strong');
  const texto = async () => (await valor().textContent())?.trim();
  const seta = (qual) => page.locator('.personagem-linha[aria-label="Coelho"] .personagem-seta').nth(qual === '‹' ? 0 : 1);
  const salvar = () => page.locator('.criador-acoes .btn-primary');
  const canto = () => page.locator('.criador-avatar');
  const abrirAvatar = async () => {
    await page.locator('button[aria-label="Configurações"]').first().click();
    await configuracoes.waitFor({ timeout: 10_000 });
    await page.locator('.settings-tab', { hasText: /^\s*Aparência\s*$/ }).first().click();
    await page.locator('.aparencia-fichario').waitFor({ timeout: 10_000 });
    await page.locator('.aparencia-fichario-orelhas [role="tab"]', { hasText: 'Avatar' }).click();
    await valor().waitFor({ timeout: 10_000 });
  };
  /** o palco tem desenho (o canvas não está vazio) */
  const palcoPintado = () =>
    page.waitForFunction(
      () => {
        const c = document.querySelector('.coelho-palco');
        if (!c) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
        return n > 1500;
      },
      null,
      { timeout: 10_000 },
    );

  // 1. o GIF de avatar, pelo "Usar uma foto" da própria aba
  await abrirAvatar();
  await page.locator('.personagem-foto summary').click();
  await page.locator('.personagem-foto input[type=file]').setInputFiles(GIF);
  await page.waitForFunction(() => document.querySelector('.criador-avatar .avatar-foto'), null, { timeout: 10_000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await configuracoes.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});

  // 2. abre no "Atual", com o GIF animado no canto
  await abrirAvatar();
  (await texto()) === 'Atual' ? ok('abre no "Atual"') : falhou('abriu em ' + (await texto()));
  await canto().locator('.avatar-foto').waitFor({ timeout: 10_000 });
  // no canto (56 px) o GIF fica parado e anima sob o mouse, a regra das listas (Avatar.tsx: de 80 px para cima anima sempre)
  await canto().hover();
  await page.waitForFunction(() => document.querySelector('.criador-avatar .avatar-foto')?.tagName === 'IMG', null, { timeout: 5_000 }).then(
    () => ok('o "Atual" é o GIF, e anima com o mouse em cima'),
    () => falhou('o GIF do canto não anima sob o mouse'),
  );
  (await salvar().count()) === 0 ? ok('no atual, nada a salvar') : falhou('o Salvar aparece no atual');
  await palcoPintado().then(
    () => ok('o palco desenha o coelho em camadas'),
    () => falhou('o palco ficou vazio'),
  );
  await page.locator('.criador').scrollIntoViewIfNeeded();
  await foto(page, '1-atual');

  // 3. as setas só mostram as sugestões
  for (let i = 0; i < 3; i++) await seta('›').click();
  (await texto()) === '3 / 16' ? ok('› › › mostra a sugestão 3') : falhou('chegou a ' + (await texto()));
  (await canto().locator('img.avatar-pronto').getAttribute('src'))?.includes('coelho-03')
    ? ok('o avatar do canto é o desenho pronto da 3')
    : falhou('o canto não mostra a 3');
  (await salvar().count()) === 1 ? ok('outra escolha: o Salvar aparece') : falhou('sem o Salvar');
  // a 3 tem a orelha caída: a linha do corpo diz isso
  (await page.locator('.personagem-linha[aria-label="Corpo"] strong').textContent())?.trim() === 'Orelha caída'
    ? ok('a sugestão 3 vem com o corpo de orelha caída')
    : falhou('o corpo da 3 não é o de orelha caída');
  await palcoPintado();
  await foto(page, '2-sugestao-3');

  await page.reload();
  await page.locator('#abertura').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  await dispensarPresentes(page);
  await abrirAvatar();
  (await texto()) === 'Atual' && (await canto().locator('.avatar-foto').count()) === 1
    ? ok('sem Salvar, recarregar volta ao GIF: as setas não trocaram nada')
    : falhou('as setas trocaram o avatar: ' + (await texto()));
  (await page.locator('.avatares-anteriores').count()) === 0 ? ok('e nada foi para os anteriores') : falhou('as setas guardaram um anterior');

  // 4. salvar a sugestão intacta: veste o desenho pronto, e o GIF vai para os anteriores
  for (let i = 0; i < 3; i++) await seta('›').click();
  await salvar().click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === '3 / 16 · Atual', null, { timeout: 10_000 }).then(
    () => ok('o Salvar veste a 3, que vira o "Atual"'),
    () => falhou('o Salvar não vestiu'),
  );
  const anterior = page.locator('.avatares-anteriores .avatar-anterior');
  await anterior.first().waitFor({ timeout: 10_000 });
  (await anterior.count()) === 1 ? ok('o GIF está nos "Avatares anteriores"') : falhou(`anteriores: ${await anterior.count()}`);

  // 5. personalizar: o pelo rosa, o boné azul; vira "Personalizado" e o canto passa ao busto montado
  await page.locator('.criador-cores[aria-label="Pelo"] .criador-cor[aria-label="Rosa"]').click();
  (await texto()) === 'Personalizado' ? ok('mexer no pelo vira "Personalizado"') : falhou('depois do pelo: ' + (await texto()));
  await page.locator('.personagem-linha[aria-label="Cabeça"] .personagem-seta').nth(1).click();
  await page.locator('.criador-cores[aria-label="Boné"] .criador-cor[aria-label="Azul"]').click();
  await canto().locator('img.avatar-coelho-montado').waitFor({ timeout: 10_000 }).then(
    () => ok('o avatar do canto é o busto do coelho montado'),
    () => falhou('o canto não mostra o busto'),
  );
  // girar: de costas, o palco continua pintado
  await page.locator('.criador-girar button').nth(1).click();
  await page.locator('.criador-girar button').nth(1).click();
  (await page.locator('.criador-girar span').textContent())?.trim() === 'De costas' ? ok('girar mostra de costas') : falhou('o giro não chegou às costas');
  await palcoPintado();
  await foto(page, '3-personalizado-de-costas');
  // clicar acena (de frente, com o coração)
  await page.locator('.coelho-palco').click();
  await page.waitForTimeout(500);
  await foto(page, '4-acenando');

  await salvar().click();
  await page.waitForFunction(() => !document.querySelector('.criador-acoes .btn-primary'), null, { timeout: 10_000 }).then(
    () => ok('salvo: o Salvar some'),
    () => falhou('o Salvar não sumiu'),
  );
  const meu = await page.evaluate(async () => {
    const token = Object.entries(localStorage).find(([k]) => /token/i.test(k))?.[1];
    const r = await fetch('http://localhost:3099/api/me', { headers: { authorization: 'Bearer ' + token } }).catch(() => null);
    return r && r.ok ? r.json() : null;
  });
  meu && (meu.coelho?.startsWith('SYD1-') && meu.avatarPronto === null ? ok('no servidor: a receita, sem o pronto') : falhou('no servidor: ' + JSON.stringify({ coelho: meu.coelho, pronto: meu.avatarPronto })));
  if (!meu) falhou('não li /api/me');
  // na prévia do perfil (embaixo), o avatar é o busto
  (await page.locator('.perfil-previa .avatar-coelho-montado').count()) === 1 ? ok('a prévia do perfil usa o busto montado') : falhou('a prévia do perfil não mostra o busto');

  // 6. o código: copiar daqui e colar volta ao mesmo coelho
  await page.locator('.criador-codigo summary').click();
  const codigo = await page.locator('.criador-codigo input[readonly]').inputValue();
  codigo.startsWith('SYD1-') ? ok('o código aparece') : falhou('código: ' + codigo);
  await page.locator('.personagem-linha[aria-label="Corpo"] .personagem-seta').nth(1).click();
  await page.locator('.criador-codigo input:not([readonly])').fill(codigo);
  await page.locator('.criador-codigo form button').click();
  (await page.locator('.criador-codigo input[readonly]').inputValue()) === codigo ? ok('colar o código volta ao mesmo coelho') : falhou('o código colado deu outro coelho');
  await page.locator('.criador-codigo input:not([readonly])').fill('não é código');
  await page.locator('.criador-codigo form button').click();
  (await page.locator('.criador .form-error').count()) === 1 ? ok('código errado avisa') : falhou('código errado passou calado');

  // 7. "Meus coelhos"
  await page.locator('.criador-salvos input').fill('Coelho do CS');
  await page.locator('.criador-salvos form button').click();
  await page.locator('.criador-salvo', { hasText: 'Coelho do CS' }).waitFor({ timeout: 10_000 }).then(
    () => ok('"Meus coelhos" guardou'),
    () => falhou('não guardou em "Meus coelhos"'),
  );
  await foto(page, '5-meus-coelhos');

  // 8. voltar ao GIF pelos anteriores
  await page.locator('.avatares-anteriores .avatar-anterior').first().click();
  await page.waitForFunction(() => document.querySelector('.personagem-linha[aria-label="Coelho"] strong')?.textContent === 'Atual', null, { timeout: 10_000 }).then(
    () => ok('clicar no anterior volta ao GIF'),
    () => falhou('não voltou ao GIF'),
  );
} finally {
  await browser.close();
}
resumo('criador-de-coelho');
