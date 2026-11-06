// O QUARTO 3D NO APP (06/11/2026): o quarto abre em pixel art, o botão do canto vai ao 3D, as funções abrem pelos objetos do
// 3D (o coelho anda até lá antes), o botão volta ao pixel art, e a escolha fica guardada. Mede o custo do quadro e confere que
// sem foco ele não desenha. Por último, sem WebGL, quem escolheu o 3D vê o pixel art (e não uma tela preta).
//
//   node e2e/quarto3d.mjs   (API de teste na 3099 e site de desenvolvimento na 5174; FOTOS=pasta para as fotos)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'quarto3d');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
// Erro de JavaScript: conta só o que é desta parte (o quarto de pixel art, num iframe, é de outro trabalho e só é avisado).
const vigiar = (p) => {
  p.on('pageerror', (e) => {
    const t = String(e.stack ?? e);
    if (/quarto3d|QuartoComEstilo|Graficos|Home.tsx/.test(t)) falhou('erro de JavaScript: ' + t.slice(0, 200));
    else console.log('   (aviso, fora desta parte: ' + String(e).slice(0, 120) + ')');
  });
  return p;
};
const foto = (p, nome) => p.screenshot({ path: path.join(FOTOS, nome + '.png') });

const { browser } = await abrirNavegador({ viewport: { width: 1300, height: 950 } });
try {
  const contexto = await browser.newContext({ viewport: { width: 1300, height: 950 } });
  const p = vigiar(await contexto.newPage());
  const erros = [];
  p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && erros.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && r.url().includes('/quarto3d/') && erros.push(`${r.status()} ${r.url()}`));
  await cadastrar(p, 'q3d' + s);
  await dispensarPresentes(p);

  // 1. De fábrica, o pixel art (o padrão é decisão dele)
  const botao = p.locator('.quarto-estilo-botao');
  await botao.waitFor({ timeout: 30_000 });
  const rotulo = await botao.getAttribute('aria-label');
  if (/2D$/.test(rotulo ?? '') && (await p.locator('.quarto-novo iframe, .quarto').count())) ok(`abre em pixel art (${rotulo})`);
  else falhou('não abriu em pixel art: ' + rotulo);
  await p.waitForTimeout(2500);
  await foto(p, '1-pixel');

  // 2. O botão vai ao 3D, sem recarregar
  const marca = await p.evaluate(() => ((window.marcaDoTeste = 1), 1));
  await botao.click();
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
  if ((await p.evaluate(() => window.marcaDoTeste)) === marca) ok('foi ao 3D sem recarregar a página');
  else falhou('a página recarregou');
  if (!(await p.locator('.quarto-novo iframe').count())) ok('o iframe do pixel art saiu');
  else falhou('o iframe do pixel art continua');
  const g = await p.evaluate(() => JSON.parse(localStorage.getItem('syden:graficos') ?? '{}'));
  if (g.estilo === '3d' && g.estiloEscolhido) ok('a escolha foi guardada na mesma preferência de Gráficos');
  else falhou('preferência: ' + JSON.stringify(g));
  await p.waitForTimeout(1500);
  await foto(p, '2-3d-dia');

  // 3. O custo: a média dos quadros desenhados, as chamadas e os triângulos
  await p.waitForTimeout(2000);
  const m1 = await p.evaluate(() => window.quarto3dDoTeste.medida());
  console.log(`   dia: ${m1.ms.toFixed(2)} ms por quadro · ${m1.chamadas} chamadas · ${m1.triangulos} triângulos`);
  const q0 = m1.desenhados;
  await p.waitForTimeout(2000);
  const q1 = (await p.evaluate(() => window.quarto3dDoTeste.medida())).desenhados;
  console.log(`   ${((q1 - q0) / 2).toFixed(0)} quadros por segundo com a janela à vista`);
  if ((q1 - q0) / 2 <= 32) ok('no máximo ~30 quadros por segundo');
  else falhou('quadros demais: ' + (q1 - q0) / 2);

  // 4. Sem foco, não desenha
  await p.evaluate(() => (document.hasFocus = () => false));
  const a = (await p.evaluate(() => window.quarto3dDoTeste.medida())).desenhados;
  await p.waitForTimeout(1500);
  const b = (await p.evaluate(() => window.quarto3dDoTeste.medida())).desenhados;
  if (b - a <= 1) ok(`sem foco, não desenha (${b - a} quadros em 1,5 s)`);
  else falhou(`sem foco desenhou ${b - a} quadros`);
  await p.evaluate(() => delete document.hasFocus);

  // 5. As funções pelos objetos: hover dá o nome; o clique leva o coelho e abre a função
  const caixa = await p.locator('.quarto3d-caixa').boundingBox();
  const clicar = async (id) => {
    const pt = await p.evaluate((i) => window.quarto3dDoTeste.pontoDaFuncao(i), id);
    if (!pt) return falhou('sem o objeto de ' + id);
    await p.mouse.move(caixa.x + pt.x, caixa.y + pt.y);
    await p.waitForTimeout(150);
    const etiqueta = await p.locator('.quarto3d-etiqueta').textContent().catch(() => null);
    await p.mouse.click(caixa.x + pt.x, caixa.y + pt.y);
    return etiqueta;
  };
  let et = await clicar('fone');
  if (et) ok(`ao passar o mouse no fone: "${et}"`);
  else falhou('sem a etiqueta no fone');
  await p.waitForTimeout(400);
  const cedo = await p.locator('.vila-painel[aria-label="Salas de voz"]').count();
  await p.locator('.vila-painel[aria-label="Salas de voz"]').waitFor({ timeout: 10_000 }).then(
    () => ok(`o fone abre as Salas${cedo ? '' : ', depois de o coelho chegar'}`),
    () => falhou('o fone não abriu as Salas'),
  );
  await foto(p, '3-fone-salas');
  await p.locator('.vila-painel-fechar').first().click();

  et = await clicar('computador');
  await p.locator('.jogos-painel').waitFor({ timeout: 12_000 }).then(
    () => ok(`a mesa (${et}) abre os Mini-games`),
    () => falhou('a mesa não abriu os Mini-games'),
  );
  const pose = await p.evaluate(() => window.quarto3dDoTeste.medida());
  if (pose.pose === 'sentado' && pose.animacao === 'computador') ok('o coelho sentou ao computador antes da função');
  else falhou('pose no computador: ' + JSON.stringify(pose));
  await foto(p, '4-mesa-minigames');
  await p.locator('.jogos-painel .vila-painel-fechar').click();

  const temaAntes = await p.evaluate(() => document.documentElement.dataset.theme ?? document.documentElement.className);
  await clicar('abajur');
  await p
    .waitForFunction((t) => (document.documentElement.dataset.theme ?? document.documentElement.className) !== t, temaAntes, { timeout: 12_000 })
    .then(
      () => ok('o abajur troca o dia e a noite'),
      () => falhou('o abajur não trocou o tema'),
    );
  await p.waitForTimeout(1500);
  const m2 = await p.evaluate(() => window.quarto3dDoTeste.medida());
  console.log(`   depois do abajur: ${m2.ms.toFixed(2)} ms por quadro · ${m2.chamadas} chamadas`);
  await foto(p, '5-3d-depois-do-abajur');

  // o quadro leva aos Amigos (sai da home) e o guarda-roupa abre as Configurações (uma janela por cima)
  await clicar('quadro');
  await p.locator('.quarto3d').waitFor({ state: 'detached', timeout: 12_000 }).then(
    () => ok('o quadro leva aos Amigos'),
    () => falhou('o quadro não levou aos Amigos'),
  );
  await foto(p, '6-quadro-amigos');
  await p.getByRole('button', { name: /Voltar/ }).first().click();
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
  await p.waitForTimeout(800);
  await clicar('gavetas');
  await p.locator('[role="dialog"]').first().waitFor({ timeout: 12_000 }).then(
    () => ok('o guarda-roupa abre o Guarda-roupa'),
    () => falhou('o guarda-roupa não abriu'),
  );
  await foto(p, '6-guarda-roupa');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  if (await p.locator('[role="dialog"]').count()) await p.getByRole('button', { name: 'Fechar' }).first().click().catch(() => {});

  // 6. O estado de verdade: ausente, ele dorme na cama
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 20_000 });
  await p.evaluate(() => window.quarto3dDoTeste.definirEstado('ausente'));
  await p.waitForTimeout(7000);
  const deitado = await p.evaluate(() => window.quarto3dDoTeste.medida());
  if (deitado.pose === 'deitado') ok('ausente: dorme na cama');
  else falhou('ausente: ' + JSON.stringify(deitado));
  await foto(p, '7-ausente');

  // 7. Volta ao pixel art, e a escolha persiste ao recarregar
  await p.locator('.quarto-estilo-botao').click();
  await p.locator('.quarto-novo iframe, .quarto').first().waitFor({ timeout: 20_000 });
  if (!(await p.locator('.quarto3d').count())) ok('o botão voltou ao pixel art');
  else falhou('o 3D continua');
  await p.reload();
  await p.locator('.quarto-estilo-botao').waitFor({ timeout: 30_000 });
  if (/2D$/.test((await p.locator('.quarto-estilo-botao').getAttribute('aria-label')) ?? '')) ok('recarregado, continua em pixel art');
  else falhou('não guardou o pixel art');
  await p.locator('.quarto-estilo-botao').click();
  await p.reload();
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 }).then(
    () => ok('recarregado, continua em 3D'),
    () => falhou('não guardou o 3D'),
  );
  if (erros.length) falhou('erros no console: ' + erros.slice(0, 5).join(' | '));

  // 8. Sem WebGL, quem escolheu o 3D vê o pixel art
  const estado = await contexto.storageState();
  const semGL = await abrirNavegador({ viewport: { width: 1300, height: 950 }, argsExtras: ['--disable-webgl', '--disable-3d-apis'] });
  const c2 = await semGL.browser.newContext({ viewport: { width: 1300, height: 950 }, storageState: estado });
  const p2 = vigiar(await c2.newPage());
  await p2.goto(p.url());
  await p2.locator('.quarto-estilo-botao').waitFor({ timeout: 30_000 });
  await p2.waitForTimeout(2000);
  if ((await p2.locator('.quarto-novo iframe, .quarto').count()) && !(await p2.locator('.quarto3d').count())) ok('sem WebGL, volta ao pixel art sozinho');
  else falhou('sem WebGL, não voltou ao pixel art');
  await foto(p2, '8-sem-webgl');
  await semGL.browser.close();
} finally {
  await browser.close();
  resumo('quarto 3D no app');
}
