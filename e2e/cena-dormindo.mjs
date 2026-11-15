// A CENA À VISTA DORME SEM FOCO (15/11/2026, cenaDormindo.ts): o quarto e o salão no segundo monitor, com o jogo no
// primeiro. Com o prazo encurtado (window.prazoDaCenaDormir, só no site de desenvolvimento):
//
// - sem foco, a cena vira uma FOTO (não vazia) e o iframe sai; a memória da página do navegador cai (medida pelo Windows);
// - com o foco de volta, o iframe volta, com a foto por cima até a cena dizer que está pronta, e então a foto some;
// - no Editar, a cena não dorme (as mudanças pendentes moram na página).
//
//   node e2e/cena-dormindo.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import { execSync } from 'node:child_process';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const s = Date.now().toString().slice(-5);
const PRAZO = 2500;

/** A memória privada dos processos de página do Chrome do teste, somada, em MB. */
function memoria() {
  const saida = execSync(
    `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object { $_.CommandLine -like '*playwright*' -and $_.CommandLine -like '*--type=renderer*' } | ForEach-Object { $_.PrivatePageCount }"`,
  ).toString();
  return Math.round(saida.trim().split(/\r?\n/).filter(Boolean).reduce((a, b) => a + Number(b), 0) / 1048576);
}
const semFoco = (p, sem) =>
  p.evaluate((sem) => {
    if (sem) document.hasFocus = () => false;
    else delete document.hasFocus;
    window.dispatchEvent(new Event(sem ? 'blur' : 'focus'));
  }, sem);

async function conferirCena(p, cdp, nome, seletor) {
  const caixa = p.locator(seletor);
  const frame = await (await p.waitForSelector(seletor + ' iframe', { timeout: 60000 })).contentFrame();
  await frame.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await p.locator('.editor-carregando').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2000);
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  const antes = memoria();

  await semFoco(p, true);
  await p.waitForTimeout(PRAZO + 2500);
  const temIframe = await caixa.locator('iframe').count();
  const foto = caixa.locator('img.cena-foto');
  conferir(!temIframe && (await foto.count()) === 1, `${nome}: sem foco, a cena virou foto e a página saiu`);
  const naoVazia = await foto.evaluate(async (img) => {
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; const cores = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) cores.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return { cores: cores.size, w: c.width, h: c.height };
  }).catch(() => ({ cores: 0 }));
  conferir(naoVazia.cores > 20, `${nome}: a foto tem a cena (${naoVazia.cores} cores, ${naoVazia.w}×${naoVazia.h})`);
  await p.screenshot({ path: `e2e/fotos/cena-dormindo-${nome}.png` });
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  await p.waitForTimeout(3000);
  const dormindo = memoria();
  console.log(`   ${nome}: memória das páginas ${antes} MB → ${dormindo} MB dormindo (${dormindo - antes} MB)`);
  conferir(dormindo < antes - 100, `${nome}: dormindo, a memória cai (${antes - dormindo} MB a menos)`);

  const t0 = Date.now();
  await semFoco(p, false);
  await caixa.locator('iframe').waitFor({ timeout: 10000 });
  conferir((await foto.count()) === 1, `${nome}: acordando, a foto fica por cima enquanto a cena carrega`);
  conferir(!(await p.locator('.editor-carregando').count()), `${nome}: e o mascote de espera não aparece no lugar dela`);
  await foto.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  conferir(!(await foto.count()), `${nome}: a cena acordou em ${Date.now() - t0} ms, e a foto saiu`);
}

const { browser } = await abrirNavegador();
try {
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await contexto.addInitScript((prazo) => { window.prazoDaCenaDormir = prazo; }, PRAZO);
  const p = vigiar(await contexto.newPage());
  const cdp = await contexto.newCDPSession(p);
  await cadastrar(p, 'dorme' + s);
  await dispensarPresentes(p);
  await p.locator('.rail-logo').click();
  await conferirCena(p, cdp, 'quarto', '.quarto-novo-caixa:not(.salao-novo)');

  // no Editar, não dorme
  await p.locator('.editor-botao').first().click();
  await p.locator('.editor-cena.editando').waitFor({ timeout: 10000 });
  await semFoco(p, true);
  await p.waitForTimeout(PRAZO + 2000);
  conferir((await p.locator('.quarto-novo-caixa iframe').count()) === 1, 'no Editar, a cena não dorme');
  await semFoco(p, false);
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Cancelar' }).click().catch(() => {});

  // o salão
  await p.locator('.rail-item:not(.rail-action)').first().click();
  await p.locator('.channel.inicio-link').click({ timeout: 15000 });
  const temSalao = await p.waitForSelector('.salao-novo iframe', { timeout: 30000 }).then(() => true, () => false);
  if (temSalao) await conferirCena(p, cdp, 'salao', '.quarto-novo-caixa.salao-novo');
  else console.log('(a comunidade de teste não abriu o salão)');
} finally {
  await browser.close();
}
resumo('cena-dormindo');

function conferir(certo, oque) { (certo ? ok : falhou)(oque); }
