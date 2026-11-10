// A AUDITORIA DE SOBREPOSIÇÃO (09/11/2026, relato dele, com a foto de um coelho dentro de um móvel do salão: "se eu arrastar
// um móvel para onde já tem um personagem, nada impede que eu cometa essa sobreposição. Seria bom verificar se não existem
// sobreposições ocorrendo que eu não observei. Talvez uma auditoria do quarto e do salão.").
//
// O arraste não é impedido: o móvel ganha, e quem estava ali sai (tirarDeCima e tirarGatoDeCima, em montar.mjs). Este script
// monta o quarto (nas três plantas: a de sempre, o L e o cubículo) e o salão, e pelos ganchos de teste da página:
//   - põe o coelho de pé em CADA casa livre e cobre a casa com CADA móvel, nas 4 posições;
//   - põe o coelho sentado ou deitado em cada móvel dele e arrasta, gira e guarda os móveis;
//   - põe o gato em cada lugar dele (tapete, cama, pufe, poltrona, chão, peitoril) e cobre, arrasta e guarda o móvel;
//   - arruma o cômodo ao acaso muitas vezes, com o coelho, o gato e (no salão) a turma da call de 1 a 12 pessoas,
//     transmitindo e jogando, e com quem acabou de chegar pela porta;
//   - no salão, cobre a casa de cada pessoa que está no chão e a do coelho do recado com cada móvel.
// Depois de cada mudança, os personagens reagem como no relógio (window.reagirDoTeste, com menos movimento: já no lugar novo),
// e window.sobreposicoesDoTeste confere cada personagem contra o pé de cada móvel em pé (menos o dele, onde está sentado),
// quem está "no ar" (o móvel dele saiu de baixo) e dois personagens no mesmo lugar.
//
//   node e2e/pixel-art/auditoria-de-sobreposicao.mjs
//   CENA=salao node e2e/pixel-art/auditoria-de-sobreposicao.mjs      PLANTA=l ...      SORTEIOS=300 ...
//   PAGINAS=<pasta com quarto.html e salao.html já montados> ...      (senão monta numa pasta temporária)
//   SAIDA=<pasta das fotos> ...                                       (senão os-tmp/syden-sobreposicao)
//
// Sai com código 1 se achou alguma sobreposição; cada tipo ganha uma foto (o recorte ampliado em volta do personagem).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const MONTAR = path.join(AQUI, 'quarto', 'novo', 'quarto', 'montar.mjs');
const SAIDA = process.env.SAIDA || path.join(os.tmpdir(), 'syden-sobreposicao');
const PAGINAS = process.env.PAGINAS || path.join(os.tmpdir(), 'syden-sobreposicao-paginas');
const CENAS = process.env.CENA ? [process.env.CENA] : ['quarto', 'salao'];
const PLANTAS_DO_QUARTO = process.env.PLANTA ? [process.env.PLANTA] : ['quadrado', 'l', 'cubiculo'];
const SORTEIOS = Number(process.env.SORTEIOS || 150);
const AMPLIA = 3;

fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });
fs.mkdirSync(PAGINAS, { recursive: true });
const t0 = Date.now();
const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });

// Um sorteio que se repete (a mesma auditoria dá o mesmo resultado).
let semente = 20261109;
const sorte = () => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };
const umDe = (l) => l[Math.floor(sorte() * l.length)];

const achados = []; // { cena, planta, cenario, tipo, quem, movel, ... }
const fotografados = new Set();
let casos = 0;

for (const cena of CENAS) {
  const pagina = path.join(PAGINAS, `${cena}.html`);
  if (!process.env.PAGINAS || !fs.existsSync(pagina)) {
    console.log(`montando ${cena}…`);
    execFileSync(process.execPath, [MONTAR, ...(cena === 'salao' ? ['salao'] : [])], { env: { ...process.env, SAIDA_DA_PAGINA: pagina }, stdio: 'inherit' });
  }
  for (const planta of cena === 'quarto' ? PLANTAS_DO_QUARTO : ['quadrado']) {
    const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
    const erros = []; p.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
    await p.goto('file:///' + pagina.replaceAll('\\', '/'));
    await p.waitForFunction(() => window.sobreposicoesDoTeste && window.arrumacaoDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
    await p.waitForTimeout(1000);
    // o relógio para (nada anda sozinho) e com "menos movimento" quem sai de um lugar já aparece no outro
    await p.evaluate((planta) => {
      window.congelarDoTeste = true; window.movimentoDoTeste(false);
      if (planta !== 'quadrado') window.plantaDoTeste(planta);
      if (window.pessoasDoTeste) window.pessoasDoTeste([]);
      window.passoDoGatoDoTeste(0); // o gato no primeiro lugar dele
    }, planta);
    const original = await p.evaluate(() => JSON.parse(JSON.stringify(window.arrumacaoDoTeste())));
    const moveis = Object.keys(original);
    const emPe = moveis.filter((id) => !/^tapete/.test(id));
    const guardadosDeFabrica = cena === 'quarto' ? ['poltrona', 'ventilador', 'caminha-gato'].filter((id) => !original[id]) : [];
    const tag = cena === 'quarto' ? `quarto-${planta}` : 'salao';
    console.log(`${tag}: ${moveis.length} móveis (${moveis.join(', ')})`);

    const conferir = async (cenario, extra = {}) => {
      casos++;
      // (a cadeira do computador rola até a mesa por 1,7 s depois de ele sentar: confere onde ela PARA)
      const parada = () => { const c = window.cadeiraDoTeste; return !c || (!c.kin && !c.vu && !c.vv && !c.w); };
      for (let k = 0; k < 3; k++) {
        await p.evaluate(() => window.reagirDoTeste());
        if (await p.evaluate(parada)) break;
        await p.waitForFunction(parada, null, { timeout: 8000 }).catch(() => {});
      }
      const r = await p.evaluate(() => { window.reagirDoTeste(); return window.sobreposicoesDoTeste(); });
      for (const a of r) {
        const achado = { cena: tag, cenario, ...a, ...extra };
        achados.push(achado);
        const chave = [tag, a.tipo, String(a.quem).replace(/-\d+$/, ''), a.movel ?? a.outro ?? a.sobre ?? ''].join('|');
        if (fotografados.has(chave)) continue;
        fotografados.add(chave);
        const png = await p.evaluate(({ u, v, amplia }) => {
          window.desenharDoTeste();
          const c = document.getElementById('tela'), [x, y] = window.pontoDoTeste(u, v), lado = 160;
          const x0 = Math.round(Math.max(0, Math.min(c.width - lado, x - lado / 2))), y0 = Math.round(Math.max(0, Math.min(c.height - lado, y - lado * 0.65)));
          const o = document.createElement('canvas'); o.width = o.height = lado * amplia;
          const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
          g.drawImage(c, x0, y0, lado, lado, 0, 0, lado * amplia, lado * amplia);
          return o.toDataURL('image/png').split(',')[1];
        }, { u: a.u, v: a.v, amplia: AMPLIA });
        const arquivo = path.join(SAIDA, `${fotografados.size.toString().padStart(3, '0')}-${tag}-${a.tipo}-${String(a.quem).replace(/[^\w-]/g, '')}${a.movel ? '-' + a.movel : ''}.png`);
        fs.writeFileSync(arquivo, Buffer.from(png, 'base64'));
        achado.foto = arquivo;
      }
      return r;
    };
    const arrumar = (a) => p.evaluate((a) => window.arrumarDoTeste(a), a);
    const cobrir = (id, lado, pt) => p.evaluate(([id, lado, pt]) => window.cobrirDoTeste(id, lado, pt), [id, lado, pt]);
    const livres = () => p.evaluate(() => window.casasLivresDoTeste());
    const coelhoEm = (u, v) => p.evaluate(([u, v]) => window.coelhoEmDoTeste(u, v), [u, v]);

    // 1. O COELHO DE PÉ EM CADA CASA, COBERTO POR CADA MÓVEL EM CADA POSIÇÃO (o caso do relato)
    await arrumar(original);
    const casas = await livres();
    for (const [i, j] of casas) for (const id of [...emPe, ...guardadosDeFabrica]) for (const lado of [0, 1, 2, 3]) {
      await arrumar(original);
      await coelhoEm(i + 0.5, j + 0.5);
      if (!(await cobrir(id, lado, [i + 0.5, j + 0.5]))) continue;
      await conferir('coelho-de-pe-coberto', { movido: id, lado, casa: [i, j] });
    }
    console.log(`  1. coelho de pé coberto: ${casas.length} casas`);

    if (cena === 'quarto') {
      // 2. O COELHO SENTADO OU DEITADO NUM MÓVEL, E OS MÓVEIS MUDANDO (arrastados, girados, guardados)
      for (const destino of ['cama', 'pufe', 'poltrona', 'cadeira', 'guarda-roupa', 'abajur']) {
        for (let k = 0; k < 12; k++) {
          await arrumar({ ...original, ...(destino === 'poltrona' && !original.poltrona ? { poltrona: { c: [5, 2], lado: 3 } } : {}) });
          await p.evaluate((d) => { window.coelhoEmDoTeste(3.5, 3.5); window.irDoTeste(d); }, destino);
          const id = umDe(emPe), lado = Math.floor(sorte() * 4), guardar = k === 11 && destino !== 'cadeira';
          if (guardar) await p.evaluate((d) => window.girarDoTeste(d, null), destino); // guardado com ele em cima
          else if (!(await cobrir(id, lado, [sorte() * 8, sorte() * 8]))) continue;
          await conferir('coelho-sentado', { destino, movido: guardar ? destino + ' (guardado)' : id, lado });
        }
      }
      console.log('  2. coelho sentado ou deitado');
      // 3. O GATO EM CADA LUGAR, E O MÓVEL DELE OU OUTRO EM CIMA DELE
      for (const lugar of ['tapete', 'cama', 'pufe', 'poltrona', 'chao', 'janela']) {
        for (let k = 0; k < 16; k++) {
          await arrumar({ ...original, ...(lugar === 'poltrona' && !original.poltrona ? { poltrona: { c: [5, 2], lado: 3 } } : {}) });
          const pos = await p.evaluate((l) => { window.coelhoEmDoTeste(0.5, 7.5); window.reagirDoTeste(); if (!window.irGatoDoTeste(l)) return null; const g = window.gatoDoTeste(); return [g.u, g.v, g.lugar]; }, lugar);
          if (!pos) break;
          let movido;
          if (k < 8) { movido = umDe(emPe); if (!(await cobrir(movido, k % 4, [pos[0], pos[1]]))) continue; }
          else if (k < 14 && lugar !== 'chao' && lugar !== 'tapete' && lugar !== 'janela') { movido = lugar; if (!(await cobrir(lugar, k % 4, [sorte() * 8, sorte() * 8]))) continue; }
          else if (k === 14 && ['cama', 'pufe', 'poltrona'].includes(lugar)) { movido = lugar + ' (guardado)'; await p.evaluate((l) => window.girarDoTeste(l, null), lugar); }
          else if (k === 15 && lugar === 'janela') { movido = 'janela (andou)'; await p.evaluate(() => { const J = window.janelaDoTeste(); window.moverJanelaDoTeste({ v: J.v > 2 ? 0.5 : 4 }); }); }
          else continue;
          await conferir('gato', { lugar, movido });
        }
      }
      console.log('  3. gato');
    } else {
      // 2. O COELHO DO RECADO: o balcão arrastado e girado (ele volta para trás dele, numa casa livre)
      for (let k = 0; k < 40; k++) {
        await arrumar(original);
        await p.evaluate(() => { window.coelhoEmDoTeste(1.5, 1.5); window.irDoTeste('balcao'); });
        if (!(await cobrir('balcao', k % 4, [1 + sorte() * 14, 1 + sorte() * 14]))) continue;
        await conferir('balcao-arrastado', { lado: k % 4 });
      }
      console.log('  2. balcão arrastado');
      // 3. A TURMA: de 1 a 12 pessoas, transmitindo e jogando, e cada casa dela no chão coberta por cada móvel
      const turma = (n, tv, jogo) => Array.from({ length: n }, (_, k) => ({ id: k + 1, nome: 'P' + (k + 1), papel: k < tv ? 'transmitindo' : k < tv + jogo ? 'jogando' : 'call' }));
      const turmas = [turma(1, 1, 0), turma(3, 1, 1), turma(6, 2, 2), turma(12, 2, 4), turma(12, 0, 0)];
      for (const t of turmas) {
        await arrumar(original);
        await p.evaluate((t) => { window.coelhoEmDoTeste(1.5, 1.5); window.irDoTeste('balcao'); window.pessoasDoTeste(t); }, t);
        await conferir('turma-de-fabrica', { pessoas: t.length });
        const chao = await p.evaluate(() => window.lugaresDasPessoasDoTeste().filter((x) => !x.sobre).map((x) => x.id));
        // a casa de cada pessoa no chão, pedida de novo a cada caso (a arrumação volta à original)
        for (const pid of chao) for (const id of emPe) for (const lado of [0, 1, 2, 3]) {
          await arrumar(original);
          await p.evaluate((t) => window.pessoasDoTeste(t), t);
          const uv = await p.evaluate((pid) => { const q = window.lugaresDasPessoasDoTeste().find((x) => x.id === pid); return q && [q.u, q.v]; }, pid);
          if (!uv || !(await cobrir(id, lado, uv))) continue;
          await conferir('turma-coberta', { pessoas: t.length, pessoa: pid, movido: id, lado });
        }
      }
      // quem chega pela porta, com um móvel na frente dela
      for (const id of emPe) for (const lado of [0, 1, 2, 3]) {
        await arrumar(original);
        const uv = await p.evaluate(() => { window.pessoasDoTeste([]); window.chegouDoTeste('Nova'); const q = window.lugaresDasPessoasDoTeste().find((x) => x.id === 'chegando'); return q && [q.u, q.v]; });
        if (!uv || !(await cobrir(id, lado, uv))) continue;
        await conferir('chegando-pela-porta', { movido: id, lado });
      }
      console.log('  3. a turma');
    }

    // 4. ARRUMAÇÕES AO ACASO: cada móvel posto num lugar e numa posição sorteados (onde couber), com todo mundo dentro
    const N = cena === 'quarto' ? 8 : 16;
    for (let k = 0; k < SORTEIOS; k++) {
      await arrumar(original);
      if (cena === 'quarto') await p.evaluate(([u, v, l]) => { window.coelhoEmDoTeste(u, v); window.reagirDoTeste(); window.irGatoDoTeste(l); }, [0.5 + Math.floor(sorte() * 8), 0.5 + Math.floor(sorte() * 8), umDe(['tapete', 'cama', 'pufe', 'chao', 'janela'])]);
      else await p.evaluate((n) => { window.coelhoEmDoTeste(1.5, 1.5); window.irDoTeste('balcao'); window.pessoasDoTeste(Array.from({ length: n }, (_, k) => ({ id: k + 1, nome: 'P' + (k + 1), papel: k === 0 ? 'transmitindo' : k < 3 ? 'jogando' : 'call' }))); }, 1 + Math.floor(sorte() * 12));
      // (e os que começam guardados, como a poltrona e o ventilador do quarto, postos às vezes)
      for (const id of [...moveis, ...guardadosDeFabrica]) if (sorte() < 0.7) await cobrir(id, Math.floor(sorte() * 4), [sorte() * N, sorte() * N]);
      if (cena === 'quarto' && sorte() < 0.3) await p.evaluate(() => window.irDoTeste(['cama', 'pufe', 'cadeira', 'abajur'][Math.floor(Math.random() * 4)]));
      await conferir('ao-acaso', { k });
    }
    console.log(`  4. ${SORTEIOS} arrumações ao acaso`);
    if (erros.length) { console.log('  ERROS NA PÁGINA:', erros.join(' | ')); achados.push({ cena: tag, tipo: 'erro-na-pagina', erros }); }
    await p.close();
  }
}
await browser.close();

const porTipo = {};
for (const a of achados) { const k = `${a.cena} · ${a.tipo} · ${String(a.quem ?? '').replace(/-\d+$/, '')}${a.movel ? ' em ' + a.movel : ''}${a.outro ? ' com ' + String(a.outro).replace(/-\d+$/, '') : ''} (${a.cenario ?? ''})`; porTipo[k] = (porTipo[k] ?? 0) + 1; }
fs.writeFileSync(path.join(SAIDA, 'achados.json'), JSON.stringify({ quando: new Date().toISOString(), casos, achados }, null, 1));
console.log(`\n${casos} casos em ${Math.round((Date.now() - t0) / 1000)} s; ${achados.length} sobreposições`);
for (const [k, n] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  ${k}`);
if (achados.length) console.log(`fotos e achados.json em ${SAIDA}`);
process.exit(achados.length ? 1 : 0);
