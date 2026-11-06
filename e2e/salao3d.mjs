// O SALÃO 3D NO APP (06/11/2026): o salão abre em pixel art, o botão do canto vai ao 3D, quem está na call aparece com o próprio
// coelho (e quem transmite, na frente da TV), as funções abrem pelos objetos do 3D, o recado sai do coelho do balcão, e o custo
// do quadro; sem foco, não desenha. Depois, o NATAL na pré-visualização (?natal, só no site de desenvolvimento): a árvore, o trem
// andando e o coelho do recado sentado na poltrona vermelha.
//
//   API de teste na 3099 (INVITE_CODE=teste, CORS_ORIGIN=http://localhost:5174) e o site de desenvolvimento na 5174
//   (API= e APP= trocam os endereços, para rodar ao lado de outros testes).
//   node e2e/salao3d.mjs   (FOTOS=pasta para as fotos; padrão e2e/fotos/salao3d)
import fs from 'node:fs';
import path from 'node:path';
import { io } from 'socket.io-client';
import { abrirNavegador, falhou, ok, resumo } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const APP = process.env.APP ?? 'http://localhost:5174/app/';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'salao3d');
fs.mkdirSync(FOTOS, { recursive: true });
const sufixo = Date.now().toString(36).slice(-5);
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
async function conta(nome) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}
const dona = await conta('dona' + sufixo);
const vozes = [];
for (const [i, avatar] of [
  [1, 3],
  [2, 7],
  [3, 12],
]) {
  const tk = await conta('voz' + i + sufixo);
  await pedir('PUT', '/api/me/avatar-pronto', tk, { numero: avatar }).catch((e) => console.log('   (avatar pronto: ' + e.message + ')'));
  vozes.push(tk);
}
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Salão ' + sufixo });
for (const t of vozes) await pedir('POST', '/api/communities/join', t, { code: comunidade.inviteCode });
await pedir('PUT', `/api/communities/${comunidade.id}/boas-vindas`, dona, { titulo: 'Bem-vindos!', texto: 'Sexta tem karaokê.' });
const canais = await pedir('GET', `/api/communities/${comunidade.id}/channels`, dona);
const sala = (Array.isArray(canais) ? canais : canais.channels).find((c) => c.type === 'voice');
// três pessoas na voz pelo socket (sem áudio); a segunda "transmite"
const sockets = [];
for (const [i, tk] of vozes.entries()) {
  const s = io(API, { auth: { token: tk }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  await new Promise((r) => s.emit('voice:join', { channelId: sala.id }, r));
  if (i === 1) s.emit('voice:update', { screen: true, screenName: 'Jogo' });
  sockets.push(s);
}

const foto = (p, nome) => p.screenshot({ path: path.join(FOTOS, nome + '.png') });
const { browser } = await abrirNavegador({ viewport: { width: 1300, height: 980 } });
try {
  const abrir = async (endereco, em3d = false) => {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 980 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => {
      const t = String(e.stack ?? e);
      if (/salao3d|SalaoComEstilo|InicioDaComunidade/.test(t)) falhou('erro de JavaScript: ' + t.slice(0, 200));
      else console.log('   (aviso, fora desta parte: ' + String(e).slice(0, 120) + ')');
    });
    await p.addInitScript(
      ([tk, tres]) => {
        localStorage.setItem('janja.token', tk);
        if (tres && !localStorage.getItem('syden:graficos')) localStorage.setItem('syden:graficos', JSON.stringify({ estilo: '3d', estiloEscolhido: true }));
      },
      [dona, em3d],
    );
    await p.goto(endereco);
    await p.getByRole('button', { name: comunidade.name }).first().waitFor({ timeout: 60_000 });
    for (let i = 0; i < 12; i++) {
      const rev = p.locator('.revelacao');
      if (!(await rev.isVisible().catch(() => false))) {
        if (i > 4) break;
        await p.waitForTimeout(700);
        continue;
      }
      const b = rev.getByRole('button').first();
      if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
      else await p.keyboard.press('Escape');
      await p.waitForTimeout(900);
    }
    await p.getByRole('button', { name: comunidade.name }).first().click();
    return p;
  };

  // 1. De fábrica, o pixel art
  const p = await abrir(APP);
  const botao = p.locator('.salao-com-estilo .quarto-estilo-botao');
  await botao.waitFor({ timeout: 30_000 });
  if (/2D$/.test((await botao.getAttribute('aria-label')) ?? '') && (await p.locator('.salao-com-estilo .salao-novo, .salao-com-estilo .salao').count()))
    ok('o salão abre em pixel art');
  else falhou('o salão não abriu em pixel art');
  await p.waitForTimeout(3000);
  await foto(p, '1-pixel');

  // 2. O botão vai ao 3D
  await botao.click();
  await p.locator('.salao3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
  ok('o botão foi ao 3D');
  const g = await p.evaluate(() => JSON.parse(localStorage.getItem('syden:graficos') ?? '{}'));
  if (g.estilo === '3d' && g.estiloEscolhido) ok('a mesma escolha de Gráficos');
  else falhou('preferência: ' + JSON.stringify(g));
  await p.waitForTimeout(2500);
  await foto(p, '2-3d');
  // de dia e de perto, só a cena (para conferir as frestas, a escala e quem senta onde)
  await p.evaluate(() => window.salao3dDoTeste.definirNoite(false));
  await p.waitForTimeout(600);
  await p.locator('.salao3d').screenshot({ path: path.join(FOTOS, '2-3d-dia.png') });

  // 3. Quem está na call
  const m = await p.evaluate(() => window.salao3dDoTeste.medida());
  const nomes = await p.locator('.salao3d-nome').allTextContents();
  if (m.pessoas.length === 3 && nomes.length === 3) ok('as três pessoas da call aparecem, com o nome: ' + nomes.join(', '));
  else falhou('na call: ' + JSON.stringify(m.pessoas) + ' ' + JSON.stringify(nomes));
  if (m.pessoas.some((x) => x.anim === 'falando')) ok('quem transmite está na frente da TV');
  else falhou('ninguém na frente da TV: ' + JSON.stringify(m.pessoas));
  if (m.natal === false) ok('em novembro, o salão comum');
  else falhou('o Natal apareceu fora da época');
  console.log('   as cores do moletom: ' + m.pessoas.map((x) => x.roupa).join(', '));
  console.log(`   ${m.ms.toFixed(2)} ms por quadro · ${m.chamadas} chamadas · ${m.triangulos} triângulos`);

  // 4. Sem foco, não desenha
  await p.evaluate(() => (document.hasFocus = () => false));
  const a = (await p.evaluate(() => window.salao3dDoTeste.medida())).desenhados;
  await p.waitForTimeout(1500);
  const b = (await p.evaluate(() => window.salao3dDoTeste.medida())).desenhados;
  if (b - a <= 1) ok(`sem foco, não desenha (${b - a} quadros em 1,5 s)`);
  else falhou(`sem foco desenhou ${b - a} quadros`);
  await p.evaluate(() => delete document.hasFocus);
  const q0 = (await p.evaluate(() => window.salao3dDoTeste.medida())).desenhados;
  await p.waitForTimeout(2000);
  const q1 = (await p.evaluate(() => window.salao3dDoTeste.medida())).desenhados;
  if ((q1 - q0) / 2 <= 32) ok(`no máximo ~30 quadros por segundo (${((q1 - q0) / 2).toFixed(0)})`);
  else falhou('quadros demais: ' + (q1 - q0) / 2);

  // 4b. O BANHEIRO do canto do fundo: o patinho boia com foco e para sem foco; com a call cheia (12), ninguém cai dentro dele
  const px0 = (await p.evaluate(() => window.salao3dDoTeste.medida())).patinho;
  await p.waitForTimeout(1200);
  const px1 = (await p.evaluate(() => window.salao3dDoTeste.medida())).patinho;
  if (px0 !== null && px1 !== px0) ok(`o patinho boia na banheira (${px0.toFixed(3)} → ${px1.toFixed(3)})`);
  else falhou('o patinho não boiou: ' + px0 + ' ' + px1);
  await p.evaluate(() => (document.hasFocus = () => false));
  const pf0 = (await p.evaluate(() => window.salao3dDoTeste.medida())).patinho;
  await p.waitForTimeout(1000);
  const pf1 = (await p.evaluate(() => window.salao3dDoTeste.medida())).patinho;
  if (pf0 === pf1) ok('sem foco, o patinho para');
  else falhou('sem foco, o patinho mexeu');
  await p.evaluate(() => delete document.hasFocus);
  const cheia = await p.evaluate(() => {
    const s = window.salao3dDoTeste;
    const cores = { pelo: '#f3ede4', roupa: '#5a7d8c' };
    s.definirPessoas(Array.from({ length: 12 }, (_, i) => ({ id: 9000 + i, nome: 'p' + i, papel: i === 0 ? 'transmitindo' : i === 1 ? 'jogando' : 'call', cores })));
    return s.medida().pessoas;
  });
  const noBanheiro = cheia.filter((x) => x.x < 4.35 && x.z < 2.85);
  if (cheia.length === 12 && !noBanheiro.length) ok('com 12 na call, todos acham lugar fora do banheiro');
  else falhou('a call cheia: ' + cheia.length + ' pessoas, ' + noBanheiro.length + ' no banheiro');
  await p.locator('.salao3d').screenshot({ path: path.join(FOTOS, '2-3d-call-cheia.png') });
  await p.evaluate(() => window.salao3dDoTeste.definirNoite(true));
  await p.waitForTimeout(500);
  await p.locator('.salao3d').screenshot({ path: path.join(FOTOS, '2-3d-noite.png') });
  await p.evaluate(() => window.salao3dDoTeste.definirNoite(false));
  // esvazia (a lista de verdade volta quando a call mudar): o resto do teste não depende dela
  await p.evaluate(() => window.salao3dDoTeste.definirPessoas([]));
  await p.waitForTimeout(300);

  // 5. As funções pelos objetos
  const caixa = await p.locator('.salao3d-caixa').boundingBox();
  const clicar = async (id, soPassar = false) => {
    const pt = await p.evaluate((i) => window.salao3dDoTeste.pontoDaFuncao(i), id);
    if (!pt) return falhou('sem o objeto de ' + id);
    await p.mouse.move(caixa.x + pt.x, caixa.y + pt.y);
    await p.waitForTimeout(200);
    const et = await p
      .locator('.salao3d-etiqueta')
      .textContent({ timeout: 500 })
      .catch(() => null);
    if (!soPassar) await p.mouse.click(caixa.x + pt.x, caixa.y + pt.y);
    return et;
  };
  let et = await clicar('balcao');
  await p.locator('.salao3d-recado').waitFor({ timeout: 5000 }).then(
    async () => ok(`o balcão (${et}) abre o recado: "${await p.locator('.salao3d-recado p').textContent()}"`),
    () => falhou('o balcão não abriu o recado'),
  );
  if ((await p.evaluate(() => window.salao3dDoTeste.medida())).recado === 'falando') ok('o coelho do recado fala');
  await foto(p, '3-recado');
  await p.locator('.salao3d-recado-fechar').click();

  et = await clicar('trofeu');
  await p.locator('[role="dialog"]').first().waitFor({ timeout: 8000 }).then(
    () => ok(`o troféu (${et}) abre as Conquistas`),
    () => falhou('o troféu não abriu as Conquistas'),
  );
  await foto(p, '4-conquistas');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  if (await p.locator('.conquistas, [role="dialog"]').count()) await p.getByRole('button', { name: 'Fechar' }).first().click().catch(() => {});
  await p.waitForTimeout(500);

  for (const id of ['tv', 'fliperama', 'estante', 'quadro', 'jukebox']) {
    et = await clicar(id, true);
    if (et) ok(`ao passar o mouse em ${id}: "${et}"`);
    else falhou('sem a etiqueta em ' + id);
  }
  et = await clicar('estante');
  await p.locator('.salao3d').waitFor({ state: 'detached', timeout: 10_000 }).then(
    () => ok('a estante leva à conversa'),
    () => falhou('a estante não levou à conversa'),
  );

  // 6. O NATAL, na pré-visualização do site de desenvolvimento
  const n = await abrir(APP + '?natal', true);
  await n.locator('.salao3d-caixa:not(.escondida) canvas').waitFor({ timeout: 40_000 });
  await n.waitForTimeout(3000);
  const mn = await n.evaluate(() => window.salao3dDoTeste.medida());
  if (mn.natal) ok('?natal mostra o Natal');
  else falhou('?natal não mostrou o Natal');
  if (mn.recado === 'poltrona') ok('o coelho do recado recebe sentado na poltrona');
  else falhou('o coelho do recado: ' + mn.recado);
  const s0 = mn.trem;
  await n.waitForTimeout(1500);
  const s1 = (await n.evaluate(() => window.salao3dDoTeste.medida())).trem;
  if (s1 !== s0) ok(`o trem anda (${s0.toFixed(2)} → ${s1.toFixed(2)})`);
  else falhou('o trem não andou');
  console.log(`   Natal: ${mn.ms.toFixed(2)} ms por quadro · ${mn.chamadas} chamadas · ${mn.triangulos} triângulos`);
  await foto(n, '5-natal');
  await n.evaluate(() => window.salao3dDoTeste.definirNoite(false));
  await n.waitForTimeout(600);
  await n.locator('.salao3d').screenshot({ path: path.join(FOTOS, '5-natal-dia.png') });
  await n.evaluate(() => (document.hasFocus = () => false));
  const t0 = (await n.evaluate(() => window.salao3dDoTeste.medida())).trem;
  await n.waitForTimeout(1200);
  const t1 = (await n.evaluate(() => window.salao3dDoTeste.medida())).trem;
  if (t0 === t1) ok('sem foco, o trem para');
  else falhou('sem foco, o trem andou');
  await n.evaluate(() => delete document.hasFocus);
  const cx = await n.locator('.salao3d-caixa').boundingBox();
  const pt = await n.evaluate(() => window.salao3dDoTeste.pontoDaFuncao('balcao'));
  await n.mouse.click(cx.x + pt.x, cx.y + pt.y + 30);
  await n.locator('.salao3d-recado').waitFor({ timeout: 5000 }).then(
    () => ok('no Natal, o coelho na poltrona abre o recado'),
    () => falhou('no Natal, o recado não abriu pelo coelho'),
  );
  await foto(n, '6-natal-recado');
  // a noite, com as luzes
  await n.evaluate(() => window.salao3dDoTeste.definirNoite(true));
  await n.waitForTimeout(800);
  const mnoite = await n.evaluate(() => window.salao3dDoTeste.medida());
  console.log(`   Natal de noite: ${mnoite.ms.toFixed(2)} ms por quadro · ${mnoite.chamadas} chamadas`);
  await foto(n, '7-natal-noite');
  // com sombras e partículas (a neve)
  await n.evaluate(() => {
    localStorage.setItem('syden:graficos', JSON.stringify({ ...JSON.parse(localStorage.getItem('syden:graficos') ?? '{}'), sombras: true, particulas: true }));
    window.dispatchEvent(new Event('syden:graficos'));
  });
  // as primeiras dezenas de quadros depois de ligar as sombras recompilam os materiais: mede depois
  await n.waitForTimeout(4000);
  const ms = await n.evaluate(() => window.salao3dDoTeste.medida());
  console.log(`   Natal de noite com sombras e neve: ${ms.ms.toFixed(2)} ms por quadro · ${ms.chamadas} chamadas`);
  await foto(n, '8-natal-sombras-neve');

  // 7. Sem WebGL, quem escolheu o 3D vê o pixel art
  const semGL = await abrirNavegador({ viewport: { width: 1300, height: 980 }, argsExtras: ['--disable-webgl', '--disable-3d-apis'] });
  const c2 = await semGL.browser.newContext({ viewport: { width: 1300, height: 980 } });
  const p2 = await c2.newPage();
  await p2.addInitScript((tk) => {
    localStorage.setItem('janja.token', tk);
    localStorage.setItem('syden:graficos', JSON.stringify({ estilo: '3d', estiloEscolhido: true }));
  }, dona);
  await p2.goto(APP);
  await p2.getByRole('button', { name: comunidade.name }).first().click({ timeout: 60_000 });
  await p2.locator('.salao-com-estilo .quarto-estilo-botao').waitFor({ timeout: 30_000 });
  await p2.waitForTimeout(3000);
  if (!(await p2.locator('.salao3d').count()) && (await p2.locator('.salao-com-estilo .salao-novo, .salao-com-estilo .salao').count())) ok('sem WebGL, volta ao pixel art');
  else falhou('sem WebGL, não voltou ao pixel art');
  await semGL.browser.close();
} finally {
  for (const s of sockets) s.close();
  await browser.close();
  resumo('salão 3D no app');
}
