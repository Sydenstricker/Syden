// AS TELAS DE 23/11/2026 NOS 79 IDIOMAS, medidas e não confiadas (regra do CLAUDE.md, "Os idiomas tratam por você"): a
// janela do QR code do "celular como câmera", a página do celular (ao vivo e com o código já usado) e a parte do Discord
// em "Criar comunidade" (a explicação e o erro de link). Para cada idioma: a direção do documento, letras do alfabeto
// certo, nenhum texto novo sobrando em português e nada estourando a caixa (e, no celular, a página inteira de lado).
//   API de teste na 3099, site na 5174, LiveKit local.
//   node e2e/celular-e-discord-nos-idiomas.mjs           → e2e/fotos/idiomas-23-11/<idioma>-*.png
//   IDIOMAS=ar,ja node e2e/celular-e-discord-nos-idiomas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/', FOTOS = path.join(AQUI, 'fotos', 'idiomas-23-11');
const TODOS = fs
  .readdirSync(path.join(AQUI, '..', 'web', 'src', 'i18n'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((f) => !['index', 'idiomas', 'paises'].includes(f));
const IDIOMAS = process.env.IDIOMAS ? process.env.IDIOMAS.split(',') : TODOS;
fs.mkdirSync(FOTOS, { recursive: true });

/** O alfabeto de cada idioma de escrita própria: a tela precisa ter letras dele. Os outros são de escrita latina. */
const ESCRITA = {
  ar: /[\u0600-\u06FF]/, fa: /[\u0600-\u06FF]/, ur: /[\u0600-\u06FF]/, he: /[\u0590-\u05FF]/, dv: /[\u0780-\u07BF]/,
  ru: /[\u0400-\u04FF]/, uk: /[\u0400-\u04FF]/, bg: /[\u0400-\u04FF]/, mk: /[\u0400-\u04FF]/, sr: /[\u0400-\u04FF]/,
  kk: /[\u0400-\u04FF]/, mn: /[\u0400-\u04FF]/, tg: /[\u0400-\u04FF]/, el: /[\u0370-\u03FF]/, hy: /[\u0530-\u058F]/,
  ka: /[\u10A0-\u10FF]/, hi: /[\u0900-\u097F]/, ne: /[\u0900-\u097F]/, bn: /[\u0980-\u09FF]/, ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/, si: /[\u0D80-\u0DFF]/, th: /[\u0E00-\u0E7F]/, lo: /[\u0E80-\u0EFF]/, km: /[\u1780-\u17FF]/,
  my: /[\u1000-\u109F]/, am: /[\u1200-\u137F]/, dz: /[\u0F00-\u0FFF]/, ja: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  'zh-CN': /[\u4E00-\u9FFF]/, ko: /[\uAC00-\uD7AF]/,
};
const RTL = ['ar', 'he', 'fa', 'ur', 'dv'];

// Os textos novos, em português, que não podem aparecer em outro idioma. (Wi-Fi, Discord e o código do link ficam de fora.)
const NOVOS = [
  'Usar o celular como câmera', 'Aponte a câmera do celular para o código e abra o endereço que aparecer.',
  'O celular e o computador precisam estar na mesma rede Wi-Fi.', 'Ligando o celular ao computador…',
  'A câmera do celular está na chamada.', 'O celular saiu.', 'Abrindo a câmera…', 'Este código já foi usado ou venceu. Peça outro no computador.',
  'Pronto. Pode fechar esta página.', 'Trazer de um servidor do Discord', 'Link do modelo do servidor', 'Ver o que vem',
  'Esse link não é de um modelo de servidor do Discord.', 'Mensagens fixadas', 'Nenhuma mensagem fixada.',
  // (Parar, Fechar e Cancelar ficam de fora: são a mesma palavra em espanhol e em outras línguas.)
];

const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
await pedir('POST', '/api/auth/register', null, { username: 'idi' + sufixo, password: 'segredo123', email: 'idi' + sufixo + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const token = (await pedir('POST', '/api/auth/login', null, { username: 'idi' + sufixo, password: 'segredo123' })).token;
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Idiomas ' + sufixo });

const falhas = [];
const conferir = (ok, oque) => {
  if (!ok || process.env.VERBOSO) console.log((ok ? 'ok  ' : 'FALHOU ') + oque);
  if (!ok) falhas.push(oque);
};
const navegador = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

/** Elementos de texto mais largos que a caixa (o critério de telas-novas-nos-idiomas.mjs). */
const estouros = (page, seletor) =>
  page.evaluate((sel) => {
    const raiz = document.querySelector(sel);
    if (!raiz) return ['(não achei ' + sel + ')'];
    return [...raiz.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible')
      .map((el) => el.textContent.trim().slice(0, 40));
  }, seletor);

/** As três medidas de um pedaço de tela: português que sobrou, alfabeto certo e estouro. */
async function medir(page, idioma, seletor, nome) {
  const texto = (await page.locator(seletor).first().innerText()).trim();
  const sobrou = idioma === 'pt-BR' ? [] : NOVOS.filter((pt) => texto.includes(pt));
  conferir(sobrou.length === 0, `${idioma}: ${nome} sem português${sobrou.length ? ' (sobrou: ' + sobrou.join(' | ') + ')' : ''}`);
  if (ESCRITA[idioma]) conferir(ESCRITA[idioma].test(texto), `${idioma}: ${nome} com o alfabeto do idioma ("${texto.slice(0, 60)}")`);
  const est = await estouros(page, seletor);
  conferir(est.length === 0, `${idioma}: ${nome} sem estouro${est.length ? ' (' + est.join(' | ') + ')' : ''}`);
  return texto;
}

// O presente dos primeiros aparece uma vez por conta: fechado aqui, ele não cobre as telas de baixo.
{
  const p = await (await navegador.newContext({ viewport: { width: 1300, height: 950 } })).newPage();
  await p.addInitScript((tk) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden.idioma', 'pt-BR'); }, token);
  await p.goto(APP);
  await p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).waitFor({ timeout: 60000 });
  for (let i = 0; i < 8; i++) {
    const r = p.getByRole('button', { name: 'Resgatar' }), f = p.getByRole('button', { name: 'Fechar', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    else if (await f.first().isVisible().catch(() => false)) await f.first().click();
    else if (i > 2) break;
    await p.waitForTimeout(800);
  }
  await p.context().close();
}

let feitos = 0;
for (const idioma of IDIOMAS) {
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1300, height: 950 }, permissions: ['microphone', 'camera'] });
    const p = await contexto.newPage();
    p.on('pageerror', (e) => conferir(false, `${idioma}: erro de JavaScript: ${String(e).slice(0, 120)}`));
    await p.addInitScript(([tk, lang]) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden.idioma', lang); }, [token, idioma]);
    await p.goto(APP);
    const icone = p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`);
    await icone.waitFor({ timeout: 60000 });
    for (let i = 0; i < 6; i++) {
      if (await p.locator('.dialog-backdrop').first().isVisible().catch(() => false)) await p.keyboard.press('Escape');
      else if (i > 2) break;
      await p.waitForTimeout(500);
    }
    const dir = await p.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction);
    conferir(RTL.includes(idioma) ? dir === 'rtl' : dir !== 'rtl', `${idioma}: direção ${dir}`);

    // 1. Criar comunidade → Trazer de um servidor do Discord, e um link que não é de modelo.
    await p.locator('.rail-item.rail-action:has(svg.lucide-plus)').first().click();
    await p.locator('.community-choice-option').first().click();
    await p.locator('form.dialog button.link-button').first().click();
    const campo = p.locator('form.dialog input[inputmode="url"]');
    await campo.fill('https://example.com/nada');
    await campo.press('Enter');
    await p.locator('form.dialog .form-error').waitFor({ timeout: 10000 });
    await medir(p, idioma, 'form.dialog', 'Discord em Criar comunidade');
    await p.locator('form.dialog').screenshot({ path: path.join(FOTOS, `${idioma}-discord.png`) });
    await p.keyboard.press('Escape');
    if (await p.locator('form.dialog').isVisible().catch(() => false)) await p.locator('.dialog-backdrop').first().click({ position: { x: 5, y: 5 } });

    // 1b. O painel das mensagens fixadas (o alfinete do cabeçalho), vazio, no canal de texto.
    await icone.click();
    await p.locator('.channel-name').first().click();
    await p.locator('.fixadas-botao').click();
    await p.locator('.fixadas-painel .fixadas-vazio').waitFor({ timeout: 10000 });
    await medir(p, idioma, '.fixadas-painel', 'painel das fixadas');
    await p.keyboard.press('Escape');

    // 2. A chamada, o Mais e o QR code.
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
    await p.locator('.stage-controls .mais-anchor > button').first().click();
    await p.locator('button:has(svg.lucide-smartphone)').click();
    const qr = p.locator('.celular-como-camera svg.celular-qr');
    await qr.waitFor({ timeout: 10000 });
    await medir(p, idioma, '.celular-como-camera', 'janela do QR code');
    await p.locator('.celular-como-camera').screenshot({ path: path.join(FOTOS, `${idioma}-qr.png`) });
    const endereco = await qr.getAttribute('aria-label');

    // 3. O celular, no mesmo idioma (pelo navegador dele, como uma pessoa de verdade).
    const ctxCel = await navegador.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, locale: idioma, permissions: ['camera'] });
    await ctxCel.addInitScript((lang) => localStorage.setItem('syden.idioma', lang), idioma);
    const cel = await ctxCel.newPage();
    await cel.goto(endereco);
    await cel.locator('.camera-do-celular-estado.ao-vivo').waitFor({ timeout: 20000 });
    await cel.waitForTimeout(2300); // a abertura (o coelho) segura 2 s
    await medir(cel, idioma, '.camera-do-celular', 'página do celular ao vivo');
    const deLado = await cel.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    conferir(!deLado, `${idioma}: a página do celular não rola de lado`);
    await cel.screenshot({ path: path.join(FOTOS, `${idioma}-celular.png`) });
    // o mesmo código de novo: a frase do código já usado
    const cel2 = await ctxCel.newPage();
    await cel2.goto(endereco);
    await cel2.locator('.camera-do-celular-estado').waitFor({ timeout: 10000 });
    await cel2.waitForFunction(() => !/…$/.test(document.querySelector('.camera-do-celular-estado')?.textContent ?? '…'), null, { timeout: 10000 });
    await medir(cel2, idioma, '.camera-do-celular', 'página do celular com o código usado');
    await ctxCel.close();
    await contexto.close();
    feitos++;
  } catch (e) {
    conferir(false, `${idioma}: o teste parou: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
  }
}

await navegador.close();
console.log(`\n${feitos} de ${IDIOMAS.length} idiomas medidos`);
console.log(falhas.length ? `${falhas.length} falha(s)` : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
