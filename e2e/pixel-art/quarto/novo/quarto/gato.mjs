// O BICHO DO QUARTO, O GATO (09/11/2026): monta o quarto e fotografa o gato em cada lugar dele (tapete, pés da cama, pufe,
// poltrona, chão e, com a janela ABERTA, diante dela), de dia e de noite; confere que com a janela fechada ele não vai a ela,
// que ele ANDA de um lugar a outro pelo relógio dele, que o clique o espreguiça, e que guardar e pôr (cores.pet) funciona.
//   MASCOTE=pixellab node e2e/pixel-art/quarto/novo/quarto/gato.mjs   → quarto/novo/quarto/fotos/gato-*.png
//   SEM_MONTAR=1 usa a página já montada.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../../../../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const pagina = path.join(os.tmpdir(), 'syden-quarto-gato.html');
if (!process.env.SEM_MONTAR) execFileSync(process.execPath, [path.join(AQUI, 'montar.mjs')], { env: { ...process.env, SAIDA_DA_PAGINA: pagina }, stdio: 'inherit' });
const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });
const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('file:///' + pagina.split(path.sep).join('/'));
await p.waitForFunction(() => window.gatoDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
await p.waitForTimeout(1500);
// o relógio dele anda só pelo gancho (a página sem foco fica em pausa: o laço não anda)
await p.evaluate(() => { window.congelarDoTeste = true; window.passoDoGatoDoTeste(0.1); });
const SAIDA = path.join(AQUI, 'fotos'); fs.mkdirSync(SAIDA, { recursive: true });
const tmp = path.join(os.tmpdir(), 'gato-fotos'); fs.mkdirSync(tmp, { recursive: true });
let falhas = 0;
const conferir = (ok, msg) => { console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); if (!ok) falhas++; };
const foto = async (nome, L = 120) => {
  await p.waitForTimeout(120);
  const b = await p.evaluate((L) => {
    const cx = window.caixaDoMovelDoTeste('gato'); if (!cx) return null;
    const c = document.getElementById('tela'), mx = (cx[0] + cx[2]) / 2, my = (cx[1] + cx[3]) / 2 - 10, o = document.createElement('canvas'); o.width = o.height = L * 3;
    const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, mx - L / 2, my - L / 2, L, L, 0, 0, L * 3, L * 3); return o.toDataURL('image/png').split(',')[1];
  }, L);
  if (!b) { console.log('  (sem gato na tela: ' + nome + ')'); return null; }
  const f = path.join(tmp, nome + '.png'); fs.writeFileSync(f, Buffer.from(b, 'base64')); return f;
};
const folha = (nome, lista) => { const l = lista.filter(Boolean); if (l.length) execFileSync('py', ['-3', '-c', `
import sys
from PIL import Image
fs=sys.argv[2:];ims=[Image.open(f) for f in fs]
s=Image.new('RGB',(sum(i.width+6 for i in ims),max(i.height for i in ims)),(30,30,36));x=0
for i in ims: s.paste(i,(x,0));x+=i.width+6
s.save(sys.argv[1])`, path.join(SAIDA, nome), ...l]); };
const ir = (id) => p.evaluate((id) => { const ok = window.irGatoDoTeste(id); window.passoDoGatoDoTeste(0.01); return ok; }, id);

// 1. CADA LUGAR, de dia e de noite (a poltrona começa guardada: entra no canto de fábrica dela para a foto)
await p.evaluate(() => window.girarDoTeste('poltrona', 0, [7, 5]));
for (const modo of ['dia', 'noite']) {
  await p.click('#' + modo); await p.waitForTimeout(300);
  const fotos = [];
  for (const id of ['tapete', 'cama', 'pufe', 'poltrona', 'chao']) {
    const ok = await ir(id);
    if (!ok) { console.log('  sem lugar: ' + id); continue; }
    const g = await p.evaluate(() => window.gatoDoTeste());
    fotos.push(await foto(`lugar-${id}-${modo}`));
    if (modo === 'dia') console.log('  ' + id, JSON.stringify(g));
  }
  folha(`gato-lugares-${modo}.png`, fotos);
}
await p.click('#dia'); await p.waitForTimeout(200);

// 2. A JANELA: no PEITORIL (fechada ou aberta), olhando para fora; com a cortina fechada, não
const fechadaJ = await ir('janela');
conferir(fechadaJ, 'janela fechada: ele sobe no peitoril (olha pelo vidro)');
const jfotos = [];
if (fechadaJ) { await p.evaluate(() => window.gatoDoTeste({ pose: 'sentado', vaiDormir: false })); await p.evaluate(() => window.passoDoGatoDoTeste(0.01)); jfotos.push(await foto('janela-fechada', 150)); }
const abrir = await p.evaluate(() => window.pixelDaJanelaDoTeste().vidro);
await p.evaluate(() => document.getElementById('tela').scrollIntoView());
const pt = await p.evaluate(([x, y]) => { const t = document.getElementById('tela'), r = t.getBoundingClientRect(); return [r.left + (x + 0.5) * r.width / t.width, r.top + (y + 0.5) * r.height / t.width]; }, abrir);
await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(400);
const abertaJ = await ir('janela');
conferir(abertaJ, 'janela aberta: ele sobe no peitoril');
if (abertaJ) {
  await p.evaluate(() => { window.gatoDoTeste({ pose: 'sentado', vaiDormir: false }); window.passoDoGatoDoTeste(0.01); });
  const g = await p.evaluate(() => window.gatoDoTeste()); console.log('  janela', JSON.stringify(g));
  conferir(g.dir === 'nordeste' || g.dir === 'noroeste', 'no peitoril ele olha para a rua (' + g.dir + ')');
  conferir(g.sobe > 30, 'no peitoril ele está em cima (sobe ' + g.sobe + ')');
  jfotos.push(await foto('janela-aberta-dia', 150));
  await p.evaluate(() => { window.gatoDoTeste({ pose: 'dormindo' }); window.passoDoGatoDoTeste(0.01); }); jfotos.push(await foto('janela-aberta-deitado', 150));
  await p.click('#noite'); await p.waitForTimeout(300); await p.evaluate(() => { window.gatoDoTeste({ pose: 'sentado' }); window.passoDoGatoDoTeste(0.01); }); jfotos.push(await foto('janela-noite', 150)); await p.click('#dia');
}
folha('gato-janela.png', jfotos);
// a cortina fechada (o botão da página de teste): não há peitoril para ele
await p.evaluate(() => document.getElementById('cortina').click()); await p.waitForTimeout(300);
conferir(!(await p.evaluate(() => window.irGatoDoTeste('janela'))), 'cortina fechada: ele não vai ao peitoril');
await p.evaluate(() => document.getElementById('cortina').click()); await p.waitForTimeout(300);

// 3. ELE ANDA: do tapete ao pufe, pelo relógio dele (passos de 0,1 s), e chega sentado
await ir('tapete');
const andar = [];
await p.evaluate(() => { window.gatoDoTeste({ ate: 0 }); });
let viuAndar = false, chegou = null;
for (let i = 0; i < 400; i++) {
  const g = await p.evaluate(() => { window.passoDoGatoDoTeste(0.1); return window.gatoDoTeste(); });
  if (g.andando) viuAndar = true;
  if (i % 12 === 0 && andar.length < 8) andar.push(await foto('andar-' + i));
  if (viuAndar && !g.andando && !g.anim && g.pose !== 'em-pe') { chegou = g; break; }
}
conferir(viuAndar, 'ele andou até outro lugar');
conferir(!!chegou, 'chegou e parou (' + JSON.stringify(chegou) + ')');
folha('gato-andando.png', andar);

// 4. O CLIQUE: dormindo no tapete, o clique o espreguiça
await ir('tapete'); await p.evaluate(() => window.gatoDoTeste({ pose: 'dormindo', vaiDormir: false, ate: 1e9 }));
await p.evaluate(() => window.passoDoGatoDoTeste(0.01));
const pc = await p.evaluate(() => { const t = document.getElementById('tela'); t.scrollIntoView(); const r = t.getBoundingClientRect(), c = window.ondeEsta('gato'); return c && [r.left + c[0] * r.width / t.width, r.top + c[1] * r.height / t.width]; });
if (pc) { await p.mouse.click(pc[0], pc[1]); await p.waitForTimeout(100); }
conferir((await p.evaluate(() => window.gatoDoTeste())).anim === 'acordar', 'o clique o espreguiça');

// 5. GUARDAR E PÔR: cores.pet
await p.evaluate(() => window.alternarPetDoTeste());
const guardado = await p.evaluate(() => { window.passoDoGatoDoTeste(0.01); return [window.gatoDoTeste().pet, window.caixaDoMovelDoTeste('gato'), JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('cores')) ?? '') ?? '{}')]; });
conferir(!guardado[0] && !guardado[1], 'guardado: o gato some da tela');
conferir(guardado[2]?.pet === 'nenhum', 'guardado: cores.pet = nenhum (' + JSON.stringify(guardado[2]) + ')');
await p.evaluate(() => { window.alternarPetDoTeste(); window.passoDoGatoDoTeste(0.01); window.passoDoGatoDoTeste(0.01); });
conferir(!!(await p.evaluate(() => window.caixaDoMovelDoTeste('gato'))), 'posto de volta: o gato aparece');

// 6. O COELHO E O GATO NÃO SE ATRAVESSAM: com o coelho na cama, no pufe ou na poltrona, o gato não vai ao mesmo móvel; e se
// o coelho vai ao móvel em que o gato está, o gato sai. (Por último: o gancho do coelho deixa a página sem caminhada.)
const juntos = [];
for (const id of ['cama', 'pufe', 'poltrona']) {
  await p.evaluate(() => window.coelhoDoTeste({}));
  await ir(id);
  await p.evaluate((id) => window.coelhoDoTeste({ ir: id, anim: id === 'cama' ? 'dormindo' : undefined }), id);
  await p.evaluate(() => { window.passoDoGatoDoTeste(0.01); window.passoDoGatoDoTeste(0.01); });
  const g = await p.evaluate(() => window.gatoDoTeste());
  conferir(g.lugar !== id, `coelho ${id === 'cama' ? 'na cama' : 'no ' + id}: o gato saiu de lá (${g.lugar})`);
  conferir(!(await p.evaluate((id) => window.irGatoDoTeste(id), id)), `coelho no móvel ${id}: o gato não vai a ele`);
  const b = await p.evaluate((id) => { const c = document.getElementById('tela'), cx = window.caixaDoMovelDoTeste(id), L = 170, mx = (cx[0] + cx[2]) / 2, my = (cx[1] + cx[3]) / 2 - 20; const o = document.createElement('canvas'); o.width = o.height = L * 2; const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, mx - L / 2, my - L / 2, L, L, 0, 0, L * 2, L * 2); return o.toDataURL('image/png').split(',')[1]; }, id);
  const f = path.join(tmp, 'juntos-' + id + '.png'); fs.writeFileSync(f, Buffer.from(b, 'base64')); juntos.push(f);
}
folha('gato-e-coelho.png', juntos);
await p.evaluate(() => window.coelhoDoTeste({}));
console.log(erros.length ? 'ERROS NA PÁGINA: ' + erros.join('\n') : 'sem erros na página');
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
