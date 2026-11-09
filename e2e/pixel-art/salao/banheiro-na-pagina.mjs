// O BANHEIRO DO SALÃO EM PIXEL ART (09/11/2026), na página do salão (sem servidor): clicar na porta do banheiro abre a folha
// e a vista passa para o banheiro; o salão (as pessoas, os nomes, o recado) some; o patinho boia (e fica parado com "menos
// movimento" e com a página em pausa); a porta de dentro acende e volta; o botão ‹ e o Esc voltam; pelo teclado, o botão
// escondido "Porta do banheiro" entra e o foco vai e volta. Fotos em salao/fotos/banheiro-*.png.
//   node e2e/pixel-art/salao/banheiro-na-pagina.mjs        (MASCOTE=pixellab para o desenho do PixelLab; SEM_MONTAR=1)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, falhou, ok, resumo } from '../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const FOTOS = path.join(AQUI, 'fotos');
const pagina = path.join(os.tmpdir(), 'syden-salao-banheiro.html');
if (!process.env.SEM_MONTAR) execFileSync(process.execPath, [path.join(AQUI, '..', 'quarto', 'novo', 'quarto', 'montar.mjs'), 'salao'], { env: { ...process.env, SAIDA_DA_PAGINA: pagina }, stdio: 'inherit' });
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador({ viewport: { width: 1100, height: 900 } });
const confere = (c, m) => (c ? ok(m) : falhou(m));
const estado = (p) => p.evaluate(() => window.banheiroDoTeste());

for (const calmo of [false, true]) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: calmo ? 'reduce' : 'no-preference' });
  const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
  await p.goto('file:///' + pagina.replaceAll('\\', '/'));
  await p.waitForFunction(() => window.portaDoBanheiroDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  console.log(calmo ? '— com menos movimento' : '— normal');
  if (!(await estado(p)).meta) { falhou('a página não tem o banheiro (salao/banheiro/pronto/)'); break; }
  // a porta do salão: a câmera até ela, o realce e o clique
  const pt = await p.evaluate(() => window.portaDoBanheiroDoTeste());
  await p.evaluate(([x, y]) => { const c = window.cameraDoTeste(); window.moverCameraDoTeste(x * c.px - 300, y * c.px - 250); document.querySelector('.vista').scrollIntoView({ block: 'end' }); }, pt);
  await p.waitForTimeout(300);
  const noSalao = await p.evaluate(([x, y]) => { const r = document.getElementById('tela').getBoundingClientRect(); return [r.left + (x + 0.5) * r.width / 1024, r.top + (y + 0.5) * r.height / 1024]; }, pt);
  await p.mouse.move(noSalao[0], noSalao[1]); await p.waitForTimeout(300);
  confere(await p.evaluate(() => !document.getElementById('rotulo').hidden && document.getElementById('rotulo').textContent.includes('Porta do banheiro')), 'a porta do salão mostra "Porta do banheiro" ao passar o mouse');
  if (!calmo) await p.locator('.vista').screenshot({ path: path.join(FOTOS, 'banheiro-1-porta.png') });
  await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(120);
  if (!calmo) {
    confere((await estado(p)).portaAbrindo, 'a folha abre antes de a vista passar');
    await p.locator('.vista').screenshot({ path: path.join(FOTOS, 'banheiro-2-abrindo.png') });
  }
  await p.waitForTimeout(600);
  let b = await estado(p);
  confere(b.noBanheiro, 'clicar na porta leva ao banheiro');
  confere(await p.evaluate(() => getComputedStyle(document.querySelector('.mundo')).visibility === 'hidden' && document.getElementById('fora-da-vista').hidden), 'no banheiro, o salão (as pessoas, os nomes, o recado) não aparece');
  confere(await p.evaluate(() => document.getElementById('sair-do-banheiro').getAttribute('aria-label') === 'Fechar'), 'o botão de voltar (aria-label "Fechar")');
  const q0 = b.quadro; await p.waitForTimeout(1200); const q1 = (await estado(p)).quadro;
  confere(calmo ? q1 === q0 : q1 > q0, calmo ? 'com menos movimento, o patinho fica parado' : `o patinho boia (quadro ${q0} → ${q1})`);
  await p.evaluate(() => { window.congelarDoTeste = true; }); const qa = (await estado(p)).quadro; await p.waitForTimeout(700);
  confere((await estado(p)).quadro === qa, 'em pausa (sem foco), o patinho não anda');
  await p.evaluate(() => { window.congelarDoTeste = false; });
  if (!calmo) for (const modo of ['dia', 'noite']) { await p.evaluate((m) => document.getElementById(m).click(), modo); await p.waitForTimeout(250); await p.locator('.vista').screenshot({ path: path.join(FOTOS, `banheiro-3-${modo}.png`) }); }
  // a porta de dentro
  const dentro = await p.evaluate(() => {
    const m = window.banheiroDoTeste().meta, c = m.pecas.porta, r = document.getElementById('banheiro').getBoundingClientRect();
    return [r.left + ((c[0] + c[2]) / 2) * r.width / m.W, r.top + ((c[1] + c[3]) / 2 + 10) * r.height / m.H];
  });
  await p.mouse.move(dentro[0], dentro[1]); await p.waitForTimeout(250);
  confere((await estado(p)).sobreAPorta && (await p.evaluate(() => document.getElementById('rotulo-banheiro').textContent === 'Porta do banheiro')), 'a porta de dentro acende e diz "Porta do banheiro"');
  await p.mouse.click(dentro[0], dentro[1]); await p.waitForTimeout(300);
  confere(!(await estado(p)).noBanheiro, 'clicar na porta de dentro volta ao salão');
  // o Esc e o botão ‹
  await p.evaluate(() => window.irAoBanheiroDoTeste(true)); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  confere(!(await estado(p)).noBanheiro, 'o Esc volta');
  await p.evaluate(() => window.irAoBanheiroDoTeste(true)); await p.click('#sair-do-banheiro'); await p.waitForTimeout(200);
  confere(!(await estado(p)).noBanheiro, 'o botão ‹ volta');
  // pelo teclado
  await p.focus('#entrar-no-banheiro'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  confere((await estado(p)).noBanheiro && (await p.evaluate(() => document.activeElement?.id === 'sair-do-banheiro')), 'pelo teclado: entra, e o foco vai ao voltar');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  confere(!(await estado(p)).noBanheiro && (await p.evaluate(() => document.activeElement?.id === 'entrar-no-banheiro')), 'pelo teclado: volta, e o foco volta à porta');
  confere(!erros.length, erros.length ? 'erros na página: ' + erros.join(' | ') : 'sem erros na página');
  await p.close();
}
await browser.close();
resumo('banheiro na página');
