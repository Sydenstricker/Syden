// A AUDITORIA DE NOITE (10/11/2026, relato dele: "de noite, alguns elementos aparecem com iluminação de dia, como o violão, o
// relógio e a estante; teste todos os itens, se os comportamentos de dia e de noite estão coerentes"). Monta o quarto e o
// salão, põe NA CENA cada peça do catálogo (os móveis, inclusive os guardados de fábrica; os objetos da parede, um de cada
// vez; os objetos de cima, um de cada vez, num móvel com tampo) e mede o brilho médio dos pixels dela de dia e de noite, ao
// lado do brilho do que está em volta dela (o chão e a parede da casca, num anel de 12 px). A peça que de noite escurece
// muito menos que o que está em volta acendeu sozinha: é defeito, a não ser que seja uma luz de verdade (LUZES, abaixo).
//
//   node e2e/pixel-art/auditoria-de-noite.mjs              → as duas cenas
//   CENA=salao node e2e/pixel-art/auditoria-de-noite.mjs   → só uma
//
// Rodar quando entrar peça nova (móvel, objeto da parede ou de cima). Sai com erro se alguma peça acender; a tabela inteira
// fica em auditoria-de-noite.json, na pasta temporária onde as páginas são montadas.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const MONTAR = path.join(AQUI, 'quarto', 'novo', 'quarto', 'montar.mjs');
const PAGINAS = path.join(os.tmpdir(), 'syden-auditoria-de-noite');
const CENAS = process.env.CENA ? [process.env.CENA] : ['quarto', 'salao'];
// As LUZES DE VERDADE: de noite elas ficam acesas de propósito (o abajur, o neon, as telas). A medida é feita com o abajur
// apagado e as telas desligadas, e mesmo assim elas aparecem na tabela sem reprovar (o neon continua aceso).
const LUZES = new Set(['m:abajur', 'p:neon', 'm:tv', 'm:fliperama', 'm:jukebox']);
// A peça reprova quando a razão noite/dia dela passa da do entorno por mais que isto (1 = escureceu igual ao entorno). Medido
// em 10/11/2026: as peças certas ficam entre 0,75 e 1,3; as que acendiam no quarto (a peca-noite igual à do dia) davam ~2,8, e as
// do salão presas a 60% do dia (o piso de compor), de 1,4 a 2.
const LIMITE = 1.4;

fs.mkdirSync(PAGINAS, { recursive: true });
const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });
const tabela = [];
let defeitos = 0;

for (const cena of CENAS) {
  const pagina = path.join(PAGINAS, `${cena}.html`);
  console.log(`montando ${cena}…`);
  execFileSync(process.execPath, [MONTAR, ...(cena === 'salao' ? ['salao'] : [])], { env: { ...process.env, SAIDA_DA_PAGINA: pagina }, stdio: 'inherit' });
  const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
  const erros = []; p.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
  await p.goto('file:///' + pagina.replaceAll('\\', '/'));
  await p.waitForFunction(() => window.catalogoDoTeste && window.vestirDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  // o relógio da página para (sem o coelho andando entre as duas fotos), sem gente no salão e sem o gato no quarto
  await p.evaluate(() => { window.congelarDoTeste = true; window.movimentoDoTeste?.(false); if (window.pessoasDoTeste) window.pessoasDoTeste([]); });
  const cat = await p.evaluate(() => window.catalogoDoTeste());
  const base = await p.evaluate(() => JSON.parse(JSON.stringify(window.retratoDoTeste())));
  base.cores = { ...base.cores, pet: 'nenhum' };
  base.conhecidos = cat.parede;
  // sem as luzes de verdade (o abajur apagado, as telas desligadas): o que sobra aceso de noite acendeu sozinho
  base.abajurApagado = true;
  if (cena === 'salao') base.desligados = ['tv', 'fliperama', 'jukebox'];

  /** Veste a arrumação, fotografa de dia e de noite e devolve, por peça, o brilho dela e o do entorno. */
  async function medir(arrumacao, so) {
    await p.evaluate((a) => window.vestirDoTeste(a), arrumacao);
    const fotos = {};
    for (const modo of ['dia', 'noite']) {
      await p.click('#' + modo);
      await p.waitForTimeout(350);
      fotos[modo] = true;
      await p.evaluate((modo) => { const c = document.getElementById('tela'); window['__foto_' + modo] = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; }, modo);
    }
    return p.evaluate((so) => {
      const c = document.getElementById('tela'), W = c.width, D = window.__foto_dia, N = window.__foto_noite;
      const pecas = window.pixelsDasPecasDoTeste(), ocupado = new Uint8Array(W * W);
      for (const ks of Object.values(pecas)) for (const k of ks) ocupado[k] = 1;
      const lum = (A, k) => 0.299 * A[k * 4] + 0.587 * A[k * 4 + 1] + 0.114 * A[k * 4 + 2];
      const r = {};
      for (const [ch, ks] of Object.entries(pecas)) {
        if (so && !so.includes(ch)) continue;
        if (ks.length < 20) continue;
        // (os pixels quase pretos de dia, o contorno, ficam de fora: eles não têm como escurecer, e na peça pequena e escura
        // puxavam a razão para cima)
        let d = 0, n = 0, q = 0, x0 = W, y0 = W, x1 = 0, y1 = 0;
        for (const k of ks) { const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (lum(D, k) < 25) continue; d += lum(D, k); n += lum(N, k); q++; }
        if (q < 15) continue;
        let vd = 0, vn = 0, vq = 0;
        const F = 12;
        for (let y = Math.max(0, y0 - F); y <= Math.min(W - 1, y1 + F); y++) for (let x = Math.max(0, x0 - F); x <= Math.min(W - 1, x1 + F); x++) {
          const k = y * W + x; if (ocupado[k] || D[k * 4 + 3] < 128) continue;
          vd += lum(D, k); vn += lum(N, k); vq++;
        }
        r[ch] = { px: ks.length, dia: d / q, noite: n / q, entornoDia: vq ? vd / vq : null, entornoNoite: vq ? vn / vq : null };
      }
      return r;
    }, so);
  }

  const vistos = new Map();
  const anotar = (r, como) => { for (const [ch, v] of Object.entries(r)) if (!vistos.has(ch)) vistos.set(ch, { ...v, como }); };
  // 1) a arrumação de fábrica, com todos os móveis (os guardados de fábrica postos no lugar deles)
  base.moveis = { ...cat.inicial, ...base.moveis };
  anotar(await medir({ ...base, guardados: [] }), 'fábrica');
  // 2) cada objeto da parede sozinho, no lugar de fábrica dele (ou no meio da parede da esquerda)
  for (const id of cat.parede) {
    const P = cat.paredeInicial[id] ?? { parede: 'esquerda', v: 0, h: 0 };
    anotar(await medir({ ...base, guardados: [], parede: { [id]: P } }, ['p' + id]), 'sozinho na parede');
  }
  // 3) cada objeto de cima sozinho, no primeiro móvel com tampo
  const tampo = cat.topos.find((id) => base.moveis[id]);
  for (const tipo of cat.deCima) {
    anotar(await medir({ ...base, guardados: [], emCima: { auditoria: { tipo, em: tampo, s: 0.5, t: 0.5, lado: 0 } } }, ['oauditoria']), 'em cima de ' + tampo);
    const v = vistos.get('oauditoria'); if (v) { vistos.delete('oauditoria'); vistos.set('o' + tipo, v); }
  }
  // e os objetos de cima de fábrica (que vêm com uid próprio): pelo tipo
  const ec = base.emCima ?? {};
  for (const [uid, o] of Object.entries(ec)) { const v = vistos.get('o' + uid); if (v) { vistos.delete('o' + uid); if (!vistos.has('o' + o.tipo)) vistos.set('o' + o.tipo, v); } }

  for (const [ch, v] of vistos) {
    const chave = ch[0] + ':' + ch.slice(1);
    const razao = v.noite / Math.max(1, v.dia), razaoEntorno = v.entornoDia ? v.entornoNoite / Math.max(1, v.entornoDia) : null;
    const rel = razaoEntorno ? razao / razaoEntorno : null;
    const luz = LUZES.has(chave);
    const defeito = rel != null && rel > LIMITE && !luz;
    if (defeito) defeitos++;
    tabela.push({ cena, peca: chave, px: v.px, dia: +v.dia.toFixed(1), noite: +v.noite.toFixed(1), razao: +razao.toFixed(2), entorno: razaoEntorno && +razaoEntorno.toFixed(2), relativa: rel && +rel.toFixed(2), luz, defeito, como: v.como });
  }
  // o que o catálogo tem e não apareceu (atrás de outra peça, ou sem desenho)
  const faltam = [...cat.moveis.map((id) => 'm' + id), ...cat.parede.map((id) => 'p' + id), ...cat.deCima.map((id) => 'o' + id)].filter((ch) => !vistos.has(ch));
  if (faltam.length) console.log(`  ${cena}: sem medida (não apareceu na tela): ${faltam.join(', ')}`);
  if (erros.length) console.log(`  ${cena}: erros na página:\n    ${erros.join('\n    ')}`);
  await p.close();
}
await browser.close();

for (const l of tabela.sort((a, b) => (b.relativa ?? 0) - (a.relativa ?? 0))) {
  console.log(`${l.defeito ? '✘' : l.luz ? '☼' : '✔'} ${l.cena.padEnd(6)} ${l.peca.padEnd(24)} dia ${String(l.dia).padStart(5)}  noite ${String(l.noite).padStart(5)}  razão ${String(l.razao).padStart(4)}  entorno ${String(l.entorno).padStart(4)}  relativa ${l.relativa}`);
}
fs.writeFileSync(path.join(PAGINAS, 'auditoria-de-noite.json'), JSON.stringify(tabela, null, 1));
console.log('a tabela inteira: ' + path.join(PAGINAS, 'auditoria-de-noite.json'));
console.log(defeitos ? `\n✘ ${defeitos} peça(s) acesa(s) de noite` : '\n✔ de noite, todas as peças escurecem com o entorno');
if (defeitos) process.exitCode = 1;
