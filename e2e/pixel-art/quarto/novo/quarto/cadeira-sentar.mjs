// SENTAR NA CADEIRA COMO GENTE (relato dele, 18/10/2026: "ele atravessa a cadeira e senta nela; o correto seria ele
// rotacionar nela, sentar e então se aproximar do PC"). Na página de teste do quarto, põe o coelho em call e confere:
//   (1) andando, ele nunca entra no espaço da cadeira (não a atravessa);
//   (2) as fases vêm na ordem: a cadeira virada para o quarto → ele senta → girando com ele → na mesa;
//   (3) girando, ele passa por direções do meio (acompanha a cadeira), e na mesa olha para o computador;
//   (4) à toa de novo, o contrário: sai da mesa, gira para o quarto, e só então levanta e anda (sem atravessar).
// E grava a sequência num GIF (fotos/cadeira-sentar.gif), recortado em volta da mesa.
//   node e2e/pixel-art/quarto/novo/quarto/cadeira-sentar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar } from '../../../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const p = await abrir();
const erros = []; p.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
await p.setViewportSize({ width: 1240, height: 1000 });
await p.goto('file:///' + path.join(AQUI, 'quarto.html').replaceAll(String.fromCharCode(92), '/'));
await p.waitForFunction(() => window.coelhoNaCadeiraDoTeste && window.cadeiraDoTeste, null, { timeout: 60000 });
await p.waitForTimeout(2000);

let falhas = 0;
const conferir = (ok, o) => { console.log((ok ? 'ok  ' : 'FALHOU ') + o); if (!ok) falhas++; };
const quadros = [];
const fotografar = async () => quadros.push(await p.evaluate(() => {
  const c = document.getElementById('tela'), [x, y] = window.ondeEsta('mesa') ?? [200, 200], o = document.createElement('canvas');
  o.width = 220; o.height = 180; const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, x - 60, y - 90, 220, 180, 0, 0, 220, 180); return o.toDataURL('image/png');
}));

async function acompanhar(ms) {
  const visto = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const e = await p.evaluate(() => ({ ...window.coelhoNaCadeiraDoTeste(), cu: window.cadeiraDoTeste.u, cv: window.cadeiraDoTeste.v }));
    visto.push(e);
    if (visto.length % 2 === 0) await fotografar();
    await p.waitForTimeout(80);
  }
  return visto;
}

// EM CALL: vai sentar
await p.click('[data-estado="call"]');
const ida = await acompanhar(9000);
const dentro = ida.filter((e) => e.andando && Math.hypot(e.u - e.cu, e.v - e.cv) < 0.42);
conferir(dentro.length === 0, 'andando até a cadeira, ele não entra nela (mais perto: ' + Math.min(...ida.filter((e) => e.andando).map((e) => Math.hypot(e.u - e.cu, e.v - e.cv))).toFixed(2) + ' casa)');
const fases = ida.map((e) => e.fase).filter((f, i, a) => f !== a[i - 1]);
conferir(JSON.stringify(fases.filter(Boolean)) === JSON.stringify(['sentar', 'girando', 'mesa']), 'as fases na ordem: ' + JSON.stringify(fases));
const dirsGirando = [...new Set(ida.filter((e) => e.fase === 'girando').map((e) => e.dir))];
conferir(dirsGirando.length >= 3, 'girando, ele acompanha a cadeira por ' + dirsGirando.length + ' direções: ' + dirsGirando.join(', '));
const fim = ida[ida.length - 1];
conferir(fim.fase === 'mesa' && fim.dir.startsWith('n'), 'na mesa, de costas para nós, olhando o computador (' + fim.dir + ')');

// À TOA: levanta
await p.click('[data-estado="atoa"]');
const volta = await acompanhar(9000);
const fasesV = volta.map((e) => e.fase).filter((f, i, a) => f !== a[i - 1]);
conferir(JSON.stringify(fasesV) === JSON.stringify(['mesa', 'girando', 'sentar', null]) || JSON.stringify(fasesV) === JSON.stringify(['girando', 'sentar', null]), 'levantando, o contrário: ' + JSON.stringify(fasesV));
const dentroV = volta.filter((e) => e.andando && e.fase === null && Math.hypot(e.u - e.cu, e.v - e.cv) < 0.42);
conferir(dentroV.length === 0, 'saindo da cadeira, ele não a atravessa');
conferir(!erros.length, 'sem erros na página ' + erros.join(' | '));

// o GIF da sequência (Pillow, pelo python que já está no PC)
const pasta = path.join(AQUI, 'fotos', 'cadeira-sentar'); fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
quadros.forEach((q, i) => fs.writeFileSync(path.join(pasta, String(i).padStart(3, '0') + '.png'), Buffer.from(q.split(',')[1], 'base64')));
await fechar();
console.log(quadros.length, 'quadros em', pasta);
process.exit(falhas ? 1 : 0);
