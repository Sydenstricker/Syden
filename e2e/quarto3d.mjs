// O QUARTO 3D NO APP (06/11/2026): o quarto abre em pixel art, o botão do canto vai ao 3D, as funções abrem pelos objetos do
// 3D (o coelho anda até lá antes) NOS DOIS TEMAS (o clássico e o colorido, pelo botão dos móveis), o botão volta ao pixel art, e
// as escolhas ficam guardadas. O 3D desenha a ARRUMAÇÃO DO PIXEL (a do servidor): a cama mudada de lugar e a planta em L
// aparecem lá. Mede o custo do quadro e confere que sem foco ele não desenha. Por último, sem WebGL, quem escolheu o 3D vê o
// pixel art (e não uma tela preta).
//
//   node e2e/quarto3d.mjs   (API de teste na 3099 e site de desenvolvimento na 5174; API=, SITE= trocam; FOTOS=pasta das fotos)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
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
// deitado EM CIMA do colchão (a caixa do corpo dentro da da cama), acima do chão e com a cabeça do lado da cabeceira
const naCama = (m) => m.naCama?.dentro && m.naCama.acimaDoChao && m.naCama.naCabeceira;
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
  const funcoes = async (tema) => {
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
  await foto(p, tema + '-3-fone-salas');
  await p.locator('.vila-painel-fechar').first().click();

  et = await clicar('computador');
  await p.locator('.jogos-painel').waitFor({ timeout: 12_000 }).then(
    () => ok(`a mesa (${et}) abre os Mini-games`),
    () => falhou('a mesa não abriu os Mini-games'),
  );
  const pose = await p.evaluate(() => window.quarto3dDoTeste.medida());
  if (pose.pose === 'sentado' && pose.animacao === 'computador' && pose.em === 'cadeira') ok(`${tema}: o coelho sentou na cadeira antes da função`);
  else falhou('pose no computador: ' + JSON.stringify(pose));
  await foto(p, tema + '-4-mesa-minigames');
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
  await foto(p, tema + '-5-3d-depois-do-abajur');

  // o quadro leva aos Amigos (sai da home) e o guarda-roupa abre as Configurações (uma janela por cima)
  await clicar('quadro');
  await p.locator('.quarto3d').waitFor({ state: 'detached', timeout: 12_000 }).then(
    () => ok('o quadro leva aos Amigos'),
    () => falhou('o quadro não levou aos Amigos'),
  );
  await foto(p, tema + '-6-quadro-amigos');
  await p.getByRole('button', { name: /Voltar/ }).first().click();
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
  await p.waitForTimeout(800);
  await clicar('gavetas');
  await p.locator('[role="dialog"]').first().waitFor({ timeout: 12_000 }).then(
    () => ok('o guarda-roupa abre o Guarda-roupa'),
    () => falhou('o guarda-roupa não abriu'),
  );
  await foto(p, tema + '-6-guarda-roupa');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  if (await p.locator('[role="dialog"]').count()) await p.getByRole('button', { name: 'Fechar' }).first().click().catch(() => {});

  // 6. O estado de verdade: ausente, ele dorme na cama
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 20_000 });
  await p.evaluate(() => window.quarto3dDoTeste.definirEstado('ausente'));
  await p.waitForTimeout(7000);
  const deitado = await p.evaluate(() => window.quarto3dDoTeste.medida());
  if (deitado.pose === 'deitado' && deitado.em === 'cama') ok(`${tema}: ausente, dorme na cama`);
  else falhou('ausente: ' + JSON.stringify(deitado));
  // EM CIMA do colchão, e não na beira (06/11/2026: o ponto de deitar era o do pé do pixel, e não o da cama do pacote)
  if (naCama(deitado)) ok(`${tema}: deitado em cima da cama, com a cabeça na cabeceira`);
  else falhou(`${tema}: deitado fora da cama: ` + JSON.stringify(deitado.naCama));
  await foto(p, tema + '-7-ausente');
  await p.evaluate(() => window.quarto3dDoTeste.definirEstado('atoa'));
  };
  await funcoes('classico');

  // 6b. O TEMA: o botão dos móveis troca o clássico pelo colorido (a mesma arrumação), guardado no aparelho
  const tema = p.locator('.quarto-tema-botao');
  if ((await p.evaluate(() => window.quarto3dDoTeste.medida().tema)) === 'classico' && (await tema.count())) ok('de fábrica, o tema clássico, e o botão dos móveis está lá');
  else falhou('o tema de fábrica não é o clássico');
  const antes = await p.evaluate(() => window.quarto3dDoTeste.medida().moveis);
  await tema.click();
  await p.waitForFunction(() => window.quarto3dDoTeste?.medida().tema === 'colorido' && window.quarto3dDoTeste.desenhados > 3, null, { timeout: 30_000 }).then(
    () => ok('o botão troca para o tema colorido (Tiny Treats), sem recarregar'),
    () => falhou('o tema não trocou'),
  );
  // (os primeiros quadros do tema novo montam os shaders: a média vale depois de uns segundos)
  await p.waitForTimeout(3000);
  const depois = await p.evaluate(() => window.quarto3dDoTeste.medida());
  const mesmos = antes.every((m) => depois.moveis.some((d) => d.id === m.id && Math.abs(d.rumo - m.rumo) < 0.01));
  if (mesmos && antes.length === depois.moveis.length) ok(`os mesmos ${antes.length} móveis nos mesmos giros, nos dois temas`);
  else falhou('os móveis mudaram com o tema: ' + JSON.stringify({ antes, depois: depois.moveis }));
  console.log(`   colorido: ${depois.ms.toFixed(2)} ms por quadro · ${depois.chamadas} chamadas · ${depois.triangulos} triângulos · ${depois.juntas} malha(s) juntada(s)`);
  if ((await p.evaluate(() => localStorage.getItem('syden:quarto3d-tema'))) === 'colorido') ok('o tema ficou guardado no aparelho');
  else falhou('o tema não foi guardado');
  await p.waitForTimeout(800);
  await foto(p, 'colorido-0');
  await funcoes('colorido');

  // 6c. A ARRUMAÇÃO É A DO PIXEL: a cama noutro lugar e a planta em L, guardadas no servidor, aparecem no 3D
  const token = await p.evaluate(() => localStorage.getItem('janja.token'));
  const r = await fetch(API + '/api/quarto', {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ moveis: { cama: { c: [6, 6.5], lado: 2 } }, planta: 'l', guardados: ['poltrona'] }),
  });
  if (!r.ok) falhou('não guardou a arrumação de teste: ' + r.status);
  await p.reload();
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
  await p.waitForTimeout(1200);
  const l = await p.evaluate(() => window.quarto3dDoTeste.medida());
  const cama = l.moveis.find((m) => m.id === 'cama');
  // no pixel, (u, v) = (6, 6,5) e o lado 2; no 3D, x = v e z = u, e o lado 2 olha para −z
  if (l.planta === 'l' && cama && Math.abs(cama.x - 6.5) < 0.6 && Math.abs(cama.z - 6) < 0.8 && Math.abs(Math.abs(cama.rumo) - Math.PI) < 0.01) ok(`a arrumação do pixel no 3D: a planta em L e a cama em (${cama.x}, ${cama.z}), virada`);
  else falhou('a arrumação do pixel não veio: ' + JSON.stringify({ planta: l.planta, cama }));
  await foto(p, 'colorido-l');
  // a cama virada, noutro lugar: ele deita nela do mesmo jeito
  const conferirL = async (t) => {
    await p.evaluate(() => window.quarto3dDoTeste.definirEstado('ausente'));
    await p.waitForTimeout(7000);
    const m = await p.evaluate(() => window.quarto3dDoTeste.medida());
    if (m.em === 'cama' && naCama(m)) ok(`${t}: na planta em L, com a cama virada, deita em cima dela`);
    else falhou(`${t}: na L, fora da cama: ` + JSON.stringify({ em: m.em, naCama: m.naCama }));
    await foto(p, t + '-l-ausente');
    await p.evaluate(() => window.quarto3dDoTeste.definirEstado('atoa'));
  };
  await conferirL('colorido');
  await p.locator('.quarto-tema-botao').click();
  await p.waitForFunction(() => window.quarto3dDoTeste?.medida().tema === 'classico', null, { timeout: 30_000 });
  await p.waitForTimeout(800);
  await foto(p, 'classico-l');
  await conferirL('classico');

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
