// AS TELAS NOVAS DE 20/10/2026 NOS IDIOMAS QUE NINGUÉM DA DUPLA LÊ: o painel de conquistas e o cadeado da chamada (com o
// código de segurança e a frase), medidos e não confiados (regra do CLAUDE.md, "Os idiomas tratam por você"). Para cada
// idioma: a direção do documento, nenhum dos textos novos sobrando em português, e nada estourando a caixa.
//   API de teste: PORT=3099 CORS_ORIGIN=http://localhost:5174 INVITE_CODE=teste FREIO_CADASTROS_POR_DIA=500
//   vite: VITE_API_URL=http://localhost:3099 npx vite --port 5174 --strictPort   (em web/)
//   LiveKit local: npm run dev:livekit (Docker)
//   node e2e/telas-novas-nos-idiomas.mjs            → e2e/fotos/telas-novas-<idioma>.png
//   IDIOMAS=ar,ja node e2e/telas-novas-nos-idiomas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/', FOTOS = path.join(AQUI, 'fotos');
const IDIOMAS = (process.env.IDIOMAS ?? 'ar,he,ja,zh-CN,hi,th,am,dv,ru,de,ha,my').split(',');
fs.mkdirSync(FOTOS, { recursive: true });
const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
await pedir('POST', '/api/auth/register', null, { username: 'idiomas' + sufixo, password: 'segredo123', email: 'idiomas' + sufixo + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const token = (await pedir('POST', '/api/auth/login', null, { username: 'idiomas' + sufixo, password: 'segredo123' })).token;
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Idiomas ' + sufixo });

// Os textos novos, em português: nenhum pode aparecer nas telas de outro idioma. ("Setlist" fica de fora: é a mesma
// palavra no alemão, no inglês e em outras línguas, e lá ela é a tradução certa.)
const NOVOS = [
  'Conquistas da turma', 'O que a turma fez junta. Nada aqui vence nem se perde.', 'Voz e conversa', 'Acolhimento', 'Marcos da comunidade',
  'Horas juntos', 'Roda cheia', 'Sessão de cinema', 'Muitas vozes', 'Mesa de jogo', 'Repertório', 'Vila completa', 'Todo mundo joga',
  'Palco aberto', 'Boas-vindas de verdade', 'Primeira partida', 'Primeira canção', 'A turma cresce', 'Aniversário da comunidade',
  'Encontro marcado', 'Conversa viva', 'Partidas deste jogo em grupo.', 'Pessoas na comunidade.', 'Criptografada de ponta a ponta',
  'Código de segurança', 'Se todos na chamada virem o mesmo código, ninguém está no meio da conversa.',
];

const falhas = [];
const conferir = (ok, oque) => { console.log((ok ? 'ok  ' : 'FALHOU ') + oque); if (!ok) falhas.push(oque); };
const navegador = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

/** O que estoura: um elemento de texto mais largo que a caixa dele (o mesmo critério de configuracoes-traduzidas.mjs). */
const estouros = (page, seletor) =>
  page.evaluate((sel) => {
    const raiz = document.querySelector(sel);
    if (!raiz) return ['(não achei ' + sel + ')'];
    return [...raiz.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible')
      .map((el) => el.textContent.trim().slice(0, 40));
  }, seletor);

// O presente dos primeiros e a revelação da insígnia aparecem UMA vez por conta: fechados aqui, em português, eles não
// voltam nos idiomas de baixo (onde os botões não se acham pelo texto).
{
  const p = await (await navegador.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
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

for (const idioma of IDIOMAS) {
  const contexto = await navegador.newContext({ viewport: { width: 1200, height: 1000 }, permissions: ['microphone'] });
  const p = await contexto.newPage();
  p.on('pageerror', (e) => conferir(false, `${idioma}: erro de JavaScript: ${String(e).slice(0, 120)}`));
  await p.addInitScript(([tk, lang]) => { localStorage.setItem('janja.token', tk); localStorage.setItem('syden.idioma', lang); }, [token, idioma]);
  await p.goto(APP);
  const icone = p.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`);
  await icone.waitFor({ timeout: 60000 });
  // o presente dos primeiros e a revelação da insígnia cobrem a tela, em qualquer idioma: Escape fecha
  for (let i = 0; i < 6; i++) {
    if (await p.locator('.dialog-backdrop').first().isVisible().catch(() => false)) await p.keyboard.press('Escape');
    else if (i > 2) break;
    await p.waitForTimeout(600);
  }
  await icone.click();
  const dir = await p.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction);
  const rtl = ['ar', 'he', 'fa', 'ur', 'dv'].includes(idioma);
  conferir(rtl ? dir === 'rtl' : dir !== 'rtl', `${idioma}: direção ${dir}`);

  // as conquistas, pelo atalho do Início (o troféu), que existe em qualquer idioma
  await p.locator('.inicio-link').click({ timeout: 30000 });
  await p.locator('.bv-atalho:has(svg.lucide-trophy)').click({ timeout: 30000 });
  await p.locator('.conquista').first().waitFor();
  const textoConquistas = await p.locator('.conquistas').textContent();
  const sobrando = NOVOS.filter((pt) => textoConquistas.includes(pt));
  conferir(sobrando.length === 0, `${idioma}: conquistas sem português${sobrando.length ? ' (sobrou: ' + sobrando.join(' | ') + ')' : ''}`);
  const estC = await estouros(p, '.conquistas');
  conferir(estC.length === 0, `${idioma}: conquistas sem estouro${estC.length ? ' (' + estC.join(' | ') + ')' : ''}`);
  await p.locator('.conquistas').screenshot({ path: path.join(FOTOS, `telas-novas-${idioma}-conquistas.png`) });
  await p.keyboard.press('Escape');

  // a chamada: a Sala 1, o cadeado e o código
  // o nome do canal é conteúdo de quem criou (não passa pelo t()): é "Sala 1" em qualquer idioma da tela
  await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  const cadeado = p.locator('.chamada-cifrada');
  await cadeado.waitFor({ timeout: 30000 });
  await cadeado.click();
  await p.locator('.codigo-de-seguranca').waitFor();
  const textoCodigo = (await p.locator('.codigo-de-seguranca').textContent()) + ' ' + (await cadeado.getAttribute('title'));
  const sobrandoC = NOVOS.filter((pt) => textoCodigo.includes(pt));
  conferir(sobrandoC.length === 0, `${idioma}: cadeado e código sem português${sobrandoC.length ? ' (sobrou: ' + sobrandoC.join(' | ') + ')' : ''}`);
  const codigo = (await p.locator('.codigo-de-seguranca code').textContent()).trim();
  conferir(/^\d{4} \d{4} \d{4}$/.test(codigo), `${idioma}: o código sai em algarismos comuns, da esquerda para a direita (${codigo})`);
  const estK = await estouros(p, '.codigo-de-seguranca');
  conferir(estK.length === 0, `${idioma}: código sem estouro${estK.length ? ' (' + estK.join(' | ') + ')' : ''}`);
  await p.locator('.sidebar').screenshot({ path: path.join(FOTOS, `telas-novas-${idioma}-cadeado.png`) });
  await contexto.close();
}

await navegador.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
