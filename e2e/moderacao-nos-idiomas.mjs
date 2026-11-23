// AS TELAS DA MODERAÇÃO DE 23/11/2026 NOS 79 IDIOMAS, medidas e não confiadas (regra do CLAUDE.md, "Os idiomas tratam por
// você"): a nota do canal de avisos e a caixa de editar (vistas por quem não administra), o "(editada)", a janela do
// "Configurar convite", o registro de moderação e o menu do status da sala (vistos pela dona). Para cada idioma: a
// direção do documento, letras do alfabeto certo, nenhum texto novo sobrando em português e nada estourando a caixa.
//   API de teste na 3099, site na 5174, LiveKit local.
//   node e2e/moderacao-nos-idiomas.mjs           → e2e/fotos/idiomas-moderacao/<idioma>-*.png
//   IDIOMAS=ar,ja node e2e/moderacao-nos-idiomas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/', FOTOS = path.join(AQUI, 'fotos', 'idiomas-moderacao');
const TODOS = fs
  .readdirSync(path.join(AQUI, '..', 'web', 'src', 'i18n'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((f) => !['index', 'idiomas', 'paises'].includes(f));
const IDIOMAS = process.env.IDIOMAS ? process.env.IDIOMAS.split(',') : TODOS;
fs.mkdirSync(FOTOS, { recursive: true });

/** O alfabeto de cada idioma de escrita própria (o mesmo de celular-e-discord-nos-idiomas.mjs). */
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

// Os textos novos, em português, que não podem aparecer em outro idioma (os curtos que são iguais em espanhol ficam de fora).
const NOVOS = [
  '(editada)', 'Editar mensagem', 'Canal de avisos: só quem administra escreve aqui.', 'Configurar convite',
  'Um link a mais, que vence e se gasta como você escolher.', 'Limite de usos', 'Gerar link', 'Seus convites', 'Nenhum convite ativo.',
  'fez de', 'pôs o modo lento', 'Definir status da sala', 'Some quando a sala esvazia', 'Ex.: ranqueada, não chamar',
];

const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
async function conta(nome) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}
const dona = await conta('mdona' + sufixo);
const bia = await conta('mbia' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Moderação ' + sufixo });
await pedir('POST', '/api/communities/join', bia, { code: comunidade.inviteCode });
const canais = await pedir('GET', `/api/communities/${comunidade.id}/channels`, dona);
const textos = canais.filter((c) => c.type === 'text');
const [avisos, conversa] = textos;
await pedir('PUT', `/api/channels/${avisos.id}/avisos`, dona, { ligado: true });
await pedir('PUT', `/api/channels/${avisos.id}/modo-lento`, dona, { segundos: 30 });

const falhas = [];
const conferir = (ok, oque) => {
  if (!ok || process.env.VERBOSO) console.log((ok ? 'ok  ' : 'FALHOU ') + oque);
  if (!ok) falhas.push(oque);
};
const navegador = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

const estouros = (page, seletor) =>
  page.evaluate((sel) => {
    const raiz = document.querySelector(sel);
    if (!raiz) return ['(não achei ' + sel + ')'];
    return [...raiz.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible')
      .map((el) => el.textContent.trim().slice(0, 40));
  }, seletor);

async function medir(page, idioma, seletor, nome) {
  const texto = (await page.locator(seletor).first().innerText()).trim();
  const sobrou = NOVOS.filter((pt) => texto.includes(pt));
  conferir(sobrou.length === 0, `${idioma}: ${nome} sem português${sobrou.length ? ' (sobrou: ' + sobrou.join(' | ') + ')' : ''}`);
  if (ESCRITA[idioma]) conferir(ESCRITA[idioma].test(texto), `${idioma}: ${nome} com o alfabeto do idioma ("${texto.slice(0, 60)}")`);
  const est = await estouros(page, seletor);
  conferir(est.length === 0, `${idioma}: ${nome} sem estouro${est.length ? ' (' + est.join(' | ') + ')' : ''}`);
}

/** Abre o app no idioma e fecha o que aparecer por cima (presentes, novidades). */
async function abrir(token, idioma) {
  const contexto = await navegador.newContext({ viewport: { width: 1300, height: 950 }, permissions: ['microphone', 'camera'] });
  const p = await contexto.newPage();
  p.on('pageerror', (e) => conferir(false, `${idioma}: erro de JavaScript: ${String(e).slice(0, 120)}`));
  await p.addInitScript(([tk, lang]) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden.idioma', lang); }, [token, idioma]);
  await p.goto(APP);
  await p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).waitFor({ timeout: 60000 });
  for (let i = 0; i < 8; i++) {
    const r = p.locator('.dialog-backdrop').first();
    if (await r.isVisible().catch(() => false)) await p.keyboard.press('Escape');
    else if (i > 2) break;
    await p.waitForTimeout(500);
  }
  return p;
}

// Os presentes dos primeiros aparecem uma vez por conta: resgatados aqui, em português, não cobrem as telas de baixo.
for (const tk of [dona, bia]) {
  const p = await (await navegador.newContext({ viewport: { width: 1300, height: 950 } })).newPage();
  await p.addInitScript((t) => { localStorage.setItem('janja.token', t); localStorage.setItem('syden.idioma', 'pt-BR'); }, tk);
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
    // ---------- a Bia (não administra) ----------
    const b = await abrir(bia, idioma);
    const dir = await b.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction);
    conferir(RTL.includes(idioma) ? dir === 'rtl' : dir !== 'rtl', `${idioma}: direção ${dir}`);
    await b.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click();
    await b.locator('.channel-name', { hasText: new RegExp('^' + avisos.name + '$') }).first().click();
    await b.locator('.canal-de-avisos-nota').waitFor({ timeout: 10000 });
    await medir(b, idioma, '.canal-de-avisos-nota', 'nota do canal de avisos');
    await b.locator('.canal-de-avisos-nota').screenshot({ path: path.join(FOTOS, `${idioma}-avisos.png`) });

    await b.locator('.channel-name', { hasText: new RegExp('^' + conversa.name + '$') }).first().click();
    const caixa = b.locator('.composer textarea').first();
    await caixa.waitFor({ timeout: 10000 });
    const marca = `m${idioma}${sufixo}`;
    await caixa.fill(marca);
    await b.keyboard.press('Enter');
    const minha = b.locator('.message', { hasText: marca }).last();
    await minha.waitFor({ timeout: 10000 });
    await minha.hover();
    await minha.locator('button:has(svg.lucide-pencil)').click();
    await b.locator('.mensagem-edicao textarea').fill(marca + ' 2');
    await medir(b, idioma, '.mensagem-edicao', 'caixa de editar');
    await b.keyboard.press('Enter');
    await minha.locator('.mensagem-editada').waitFor({ timeout: 10000 });
    await medir(b, idioma, `.message[data-mensagem="${await minha.getAttribute('data-mensagem')}"]`, 'mensagem editada');
    await b.context().close();

    // ---------- a dona ----------
    const d = await abrir(dona, idioma);
    const icone = d.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`);
    await icone.click({ button: 'right' });
    await d.locator('.person-menu button:has(svg.lucide-sliders-horizontal)').click();
    await d.locator('.dialog:has(select)').waitFor({ timeout: 10000 });
    await medir(d, idioma, '.dialog:has(select)', 'janela do Configurar convite');
    await d.locator('.dialog:has(select)').screenshot({ path: path.join(FOTOS, `${idioma}-convite.png`) });
    await d.keyboard.press('Escape');
    if (await d.locator('.dialog:has(select)').isVisible().catch(() => false)) await d.locator('.dialog-backdrop').first().click({ position: { x: 5, y: 5 } });

    await icone.click();
    await d.locator('.channel-name').first().waitFor({ timeout: 10000 });
    await d.locator('.user-bar button:has(svg.lucide-settings), button:has(svg.lucide-settings)').last().click();
    await d.locator('.settings').waitFor({ timeout: 10000 });
    if (!(await d.locator('.settings-tab:has(svg.lucide-scroll-text)').count())) await d.locator('.settings-tab.settings-grupo').first().click();
    await d.locator('.settings-tab:has(svg.lucide-scroll-text)').click();
    await d.locator('.registro-linha').first().waitFor({ timeout: 10000 });
    await medir(d, idioma, '.settings-content', 'registro de moderação');
    await d.locator('.settings-content').screenshot({ path: path.join(FOTOS, `${idioma}-registro.png`) });
    await d.keyboard.press('Escape');

    await d.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await d.locator('.stage-controls').waitFor({ timeout: 30000 });
    await d.locator('.lapis-do-status').click();
    await d.locator('.person-menu input').waitFor({ timeout: 10000 });
    await medir(d, idioma, '.person-menu', 'menu do status da sala');
    await d.locator('.person-menu').screenshot({ path: path.join(FOTOS, `${idioma}-status.png`) });
    await d.context().close();
    feitos++;
  } catch (e) {
    conferir(false, `${idioma}: o teste parou: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
  }
}

await navegador.close();
console.log(`\n${feitos} de ${IDIOMAS.length} idiomas medidos`);
console.log(falhas.length ? `${falhas.length} falha(s)` : 'tudo certo');
process.exit(falhas.length ? 1 : 0);
