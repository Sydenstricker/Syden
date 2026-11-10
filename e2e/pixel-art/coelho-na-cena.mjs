// O COELHO DE CADA UM NA CENA (10/11/2026, pedido dele: "um ecossistema integrado"): o coelho que a pessoa monta no criador
// (Aparência → Avatar) aparece no quarto e no salão de pixel art com o corpo, as cores e os acessórios dela. Este teste monta
// as duas páginas (numa pasta temporária, sem mexer nas do git), põe receitas pelos ganchos (window.receitaDoTeste no quarto,
// window.pessoasDoTeste no salão, com { coelho } em cada pessoa) e confere, nos pixels do coelho ANTES da luz da cena
// (pixelsDoCoelhoDoTeste, pixelsDaPessoaDoTeste):
//   - a receita do mascote sem nada é o mascote de sempre, pixel a pixel;
//   - a cor do pelo, da roupa e de cada acessório aparece; o corpo de outra silhueta tem outra silhueta;
//   - deitado, sem acessório (a regra das camadas);
//   - no salão, cada pessoa com o dela, e o coelho do balcão continua o mascote.
// E fotografa (recorte 3×, de dia e de noite) cada receita de pé, sentada, deitada e no sofá, para quem revisa OLHAR.
//
//   node e2e/pixel-art/coelho-na-cena.mjs              → as fotos em <temp>/syden-coelho-na-cena/
//   FOTOS=<pasta> node e2e/pixel-art/coelho-na-cena.mjs
// Antes: py -3 web/scripts/coelho-cena.py (os mapas e os lugares dos acessórios de cada pose).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, falhou, ok, resumo } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const MONTAR = path.join(AQUI, 'quarto', 'novo', 'quarto', 'montar.mjs');
const PAGINAS = path.join(os.tmpdir(), 'syden-coelho-na-cena-paginas');
const FOTOS = process.env.FOTOS || path.join(os.tmpdir(), 'syden-coelho-na-cena');
fs.mkdirSync(PAGINAS, { recursive: true });
fs.mkdirSync(FOTOS, { recursive: true });

const NADA = { pelo: null, roupa: null, cabeca: null, cabecaCor: null, pescoco: null, pescocoCor: null };
const RECEITAS = {
  'orelha-caida-bone-azul': { ...NADA, corpo: 'orelha-caida', cabeca: 'bone', cabecaCor: '#2f6fe0' },
  'musculoso-bandana': { ...NADA, corpo: 'musculoso', roupa: '#3a3a44', pescoco: 'bandana', pescocoCor: '#22b14c' },
  'mascote-rosa': { ...NADA, corpo: 'mascote', pelo: '#ff9ccf', roupa: '#8a2be2' },
  // o tipo de corpo feminino (10/11/2026), com o moletom comprido de fábrica
  'feminino-bone-azul': { ...NADA, corpo: 'mascote-f-moletom', cabeca: 'bone', cabecaCor: '#2f6fe0' },
  // a forte feminina de regata curta (10/11/2026): a roupa trocada (a regata e o short) e a bandana
  'forte-feminina-bandana': { ...NADA, corpo: 'musculoso-f-curta', roupa: '#7a3fb0', pescoco: 'bandana', pescocoCor: '#22b14c' },
};
// O que cada receita tem de mostrar (contado nos pixels do coelho): o azul do boné, o verde da bandana, o rosa do pelo.
const azul = (r, g, b) => b > r + 60 && b > g + 30;
const verde = (r, g, b) => g > r + 50 && g > b + 30;
const rosa = (r, g, b) => r > 200 && r > g + 50 && b > g + 20;
const conta = (o, f) => { let n = 0; for (let i = 0; i < o.px.length; i += 4) if (o.px[i + 3] > 127 && f(o.px[i], o.px[i + 1], o.px[i + 2])) n++; return n; };
const opacos = (o) => conta(o, () => true);
// a silhueta, alinhada pelo canto de baixo do meio (o pé), como conjunto de pixels
function silhueta(o) {
  const s = new Set();
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (o.px[(y * o.w + x) * 4 + 3] > 127) s.add(`${o.caixa[0] + x},${o.caixa[1] + y}`);
  return s;
}
const iou = (a, b) => { let i = 0; for (const k of a) if (b.has(k)) i++; return i / (a.size + b.size - i || 1); };

function montar(cena) {
  const pagina = path.join(PAGINAS, `${cena}.html`);
  execFileSync(process.execPath, [MONTAR, ...(cena === 'salao' ? ['salao'] : [])], { env: { ...process.env, MASCOTE: 'pixellab', SAIDA_DA_PAGINA: pagina }, stdio: ['ignore', 'ignore', 'inherit'] });
  return pagina;
}

const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });
async function abrir(pagina) {
  const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
  await p.goto('file:///' + pagina.replaceAll('\\', '/'));
  await p.waitForFunction(() => window.coelhoDoTeste && window.receitaDoTeste && window.arrumacaoDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
  await p.waitForTimeout(800);
  return { p, erros };
}
async function foto(p, nome, caixas, minimo = 150) {
  const caixa = caixas.filter(Boolean).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const png = await p.evaluate(({ caixa, minimo }) => {
    const c = document.getElementById('tela'), W = c.width, folga = 10, amplia = 3;
    let [x0, y0, x1, y1] = [caixa[0] - folga, caixa[1] - folga, caixa[2] + folga, caixa[3] + folga];
    const lado = Math.max(minimo, x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = Math.round(Math.max(0, Math.min(W - lado, cx - lado / 2))); y0 = Math.round(Math.max(0, Math.min(c.height - lado, cy - lado / 2)));
    const o = document.createElement('canvas'); o.width = o.height = lado * amplia;
    const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(c, x0, y0, lado, lado, 0, 0, lado * amplia, lado * amplia);
    return o.toDataURL('image/png').split(',')[1];
  }, { caixa, minimo });
  fs.writeFileSync(path.join(FOTOS, nome + '.png'), Buffer.from(png, 'base64'));
}

// ============================== O QUARTO ==============================
{
  const { p, erros } = await abrir(montar('quarto'));
  const coelho = (o) => p.evaluate((o) => window.coelhoDoTeste(o), o);
  const pixels = () => p.evaluate(() => window.pixelsDoCoelhoDoTeste());
  const original = await p.evaluate(() => JSON.parse(JSON.stringify(window.arrumacaoDoTeste())));
  // a poltrona começa guardada: entra no canto de fábrica dela para as fotos
  if (!original.poltrona) await p.evaluate(() => window.girarDoTeste('poltrona', 0, [7, 5]));

  // o mascote de sempre, nas poses de referência
  await p.evaluate(() => window.receitaDoTeste(null));
  const POSE = { anim: 'parado', dir: 'sudeste', iq: 0, casa: [4, 4] };
  await coelho(POSE);
  const doMascote = await pixels();
  await p.evaluate(() => window.receitaDoTeste({ corpo: 'mascote', pelo: null, roupa: null, cabeca: null, cabecaCor: null, pescoco: null, pescocoCor: null }));
  await coelho(POSE);
  const mascoteDeReceita = await pixels();
  if (JSON.stringify(mascoteDeReceita) === JSON.stringify(doMascote)) ok('quarto: a receita do mascote sem nada é o mascote de sempre, pixel a pixel');
  else falhou('quarto: a receita do mascote sem nada mudou o desenho');

  for (const [nome, r] of Object.entries(RECEITAS)) {
    await p.evaluate((r) => window.receitaDoTeste(r), r);
    await coelho(POSE);
    const px = await pixels();
    const forma = iou(silhueta(px), silhueta(doMascote));
    if (r.corpo === 'mascote') {
      if (forma > 0.99) ok(`quarto, ${nome}: a mesma silhueta do mascote (${forma.toFixed(3)})`); else falhou(`quarto, ${nome}: a silhueta mudou (${forma.toFixed(3)})`);
    } else if (forma < 0.95) ok(`quarto, ${nome}: o corpo dele, outra silhueta (sobreposição ${forma.toFixed(3)})`);
    // a silhueta feminina do mascote é sutil de propósito (a mesma cabeça, o mesmo moletom): basta não ser o mesmo desenho
    else if (r.corpo.startsWith('mascote-f') && forma < 0.995) ok(`quarto, ${nome}: a silhueta feminina, sutil (sobreposição ${forma.toFixed(3)})`);
    else falhou(`quarto, ${nome}: parece o mascote (sobreposição ${forma.toFixed(3)})`);
    const cor = r.cabeca ? ['boné', azul, 25] : r.pescoco ? ['bandana', verde, 15] : ['pelo', rosa, 300];
    const n = conta(px, cor[1]);
    if (n >= cor[2]) ok(`quarto, ${nome}: ${n} px da cor ${cor[0] === 'pelo' ? 'do pelo' : 'do ' + cor[0]}`); else falhou(`quarto, ${nome}: só ${n} px da cor ${cor[0]} (de ${opacos(px)})`);
    if (cor[0] === 'pelo' && conta(doMascote, rosa) > 0) falhou('quarto: o mascote de sempre já tinha rosa (o teste da cor não diz nada)');

    // deitado, sem acessório
    if (r.cabeca) {
      await coelho({ ir: 'cama', anim: 'dormindo', iq: 0 });
      const d = await pixels(), nd = conta(d, azul);
      if (opacos(d) > 500 && nd < 5) ok(`quarto, ${nome}: dormindo, sem o boné (${nd} px azuis)`); else falhou(`quarto, ${nome}: dormindo com ${nd} px azuis (de ${opacos(d)})`);
    }

    // as fotos: de pé (de frente e de costas), andando, na poltrona, no pufe, lendo e dormindo na cama, de dia e de noite
    for (const modo of ['dia', 'noite']) {
      await p.click('#' + modo);
      await p.waitForTimeout(200);
      const casos = [
        ['de-pe-sudeste', { ...POSE }],
        ['de-pe-noroeste', { ...POSE, dir: 'noroeste' }],
        ['andando-sudoeste', { anim: 'andando', dir: 'sudoeste', iq: 3, casa: [4, 4] }],
        ['poltrona', { ir: 'poltrona' }],
        ['pufe', { ir: 'pufe', olharNoPufe: 'sudeste' }],
        ['cama-lendo', { ir: 'cama', anim: 'lendo', iq: 0 }],
        ['cama-dormindo', { ir: 'cama', anim: 'dormindo', iq: 0 }],
      ];
      for (const [caso, o] of casos) {
        await coelho({});
        const c = await coelho(o);
        const movel = o.ir ? await p.evaluate((id) => window.caixaDoMovelDoTeste(id), o.ir) : null;
        await foto(p, `quarto-${nome}-${caso}-${modo}`, [c.caixa, movel]);
      }
    }
    await p.click('#dia');
  }
  if (erros.length) falhou('quarto: erros na página: ' + erros.join(' | ')); else ok('quarto: nenhum erro na página');
  await p.close();
}

// ============================== O SALÃO ==============================
{
  const { p, erros } = await abrir(montar('salao'));
  const coelho = (o) => p.evaluate((o) => window.coelhoDoTeste(o), o);
  await coelho({ ir: 'balcao', anim: 'parado', iq: 0 });
  const balcaoAntes = await p.evaluate(() => window.pixelsDoCoelhoDoTeste());
  const gente = Object.entries(RECEITAS).map(([nome, coelho], i) => ({ id: 11 + i, nome, papel: 'call', coelho }));
  // e mais um, sem receita (o mascote), e quem transmite, de orelha caída
  const lista = [{ id: 10, nome: 'transmite', papel: 'transmitindo', coelho: RECEITAS['orelha-caida-bone-azul'] }, ...gente, { id: 20, nome: 'sem', papel: 'call' }];
  await p.evaluate((l) => window.pessoasDoTeste(l), lista);
  await p.evaluate(() => window.desenharDoTeste());
  await coelho({ ir: 'balcao', anim: 'parado', iq: 0 });
  const balcao = await p.evaluate(() => window.pixelsDoCoelhoDoTeste());
  if (JSON.stringify(balcao) === JSON.stringify(balcaoAntes)) ok('salão: o coelho do balcão continua o mascote'); else falhou('salão: o coelho do balcão mudou');
  const naTela = await p.evaluate(() => window.pessoasNaTelaDoTeste());
  for (const x of lista) {
    const px = await p.evaluate((id) => window.pixelsDaPessoaDoTeste(id), x.id);
    if (!px || !opacos(px)) { falhou(`salão, ${x.nome}: não apareceu`); continue; }
    const r = x.coelho;
    const [nomeCor, f, minimo] = !r ? ['nada', (a, b, c) => azul(a, b, c) || verde(a, b, c) || rosa(a, b, c), 0] : r.cabeca ? ['boné', azul, 15] : r.pescoco ? ['bandana', verde, 10] : ['pelo', rosa, 200];
    const n = conta(px, f);
    const pose = naTela.find((y) => y.id === x.id);
    // (de costas, a bandana do pescoço quase não aparece: basta um pixel dela)
    if (r?.pescoco && String(pose?.olha).startsWith('n')) { if (n >= 1) ok(`salão, ${x.nome} (${pose?.pose}, de costas): ${n} px da bandana`); else falhou(`salão, ${x.nome}: de costas e sem a bandana`); continue; }
    if (!r) { if (n < 5) ok(`salão, ${x.nome}: o mascote (${pose?.pose})`); else falhou(`salão, ${x.nome}: ${n} px de cor de receita no mascote`); }
    else if (n >= minimo) ok(`salão, ${x.nome} (${pose?.pose}, ${pose?.olha}): ${n} px da cor do ${nomeCor}`);
    else falhou(`salão, ${x.nome} (${pose?.pose}, ${pose?.olha}): só ${n} px da cor do ${nomeCor} (de ${opacos(px)})`);
  }
  // as fotos: cada pessoa onde ficou (sofá, banquetas, chão, a TV), de dia e de noite, e o salão inteiro em volta da TV
  for (const modo of ['dia', 'noite']) {
    await p.click('#' + modo);
    await p.waitForTimeout(300);
    for (const x of await p.evaluate(() => window.pessoasNaTelaDoTeste())) {
      const sobre = x.sobre ? await p.evaluate((id) => window.caixaDoMovelDoTeste(id), x.sobre) : null;
      await foto(p, `salao-${lista.find((y) => y.id === x.id).nome}-${x.pose}${x.sobre ? '-' + x.sobre : ''}-${modo}`, [[x.x - 28, x.y - 70, x.x + 28, x.y + 6], sobre], 130);
    }
    const todos = await p.evaluate(() => window.pessoasNaTelaDoTeste());
    await foto(p, `salao-turma-${modo}`, todos.map((x) => [x.x - 28, x.y - 70, x.x + 28, x.y + 6]), 300);
  }
  // NO SOFÁ, nas 4 posições: duas receitas sentadas (de frente e de costas), chegando (sentar) e assistindo (o relógio das
  // pessoas pelo gancho)
  if (await p.evaluate(() => !!window.pertoDaTvDoTeste)) {
    await p.click('#dia');
    const origSofa = (await p.evaluate(() => JSON.parse(JSON.stringify(window.arrumacaoDoTeste())))).sofa;
    await p.evaluate(() => { window.pertoDaTvDoTeste(99); window.movimentoDoTeste?.(true); });
    for (const [par, dupla] of [['oc-mu', [gente[0], gente[1]]], ['rosa-oc', [gente[2], gente[0]]]]) for (const lado of [0, 1, 2, 3]) {
      let c = null;
      for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) { c = await p.evaluate(([l, cc]) => window.girarDoTeste('sofa', l, cc), [lado, [origSofa.c[0] + a, origSofa.c[1] + b]]); if (c) break; }
      if (!c) continue;
      await p.evaluate(() => window.pessoasDoTeste([]));
      await p.evaluate((l) => window.pessoasDoTeste(l, true), dupla);
      for (const f of [1, 2, 9]) {
        await p.evaluate((n) => window.faseDoTeste(window.faseDoTeste() + n), f);
        const doSofa = (await p.evaluate(() => window.pessoasNaTelaDoTeste())).filter((x) => x.sobre === 'sofa');
        if (!doSofa.length) continue;
        await foto(p, `salao-sofa-${par}-L${lado}-passo${f}`, [...doSofa.map((x) => [x.x - 30, x.y - 80, x.x + 30, x.y + 6]), await p.evaluate(() => window.caixaDoMovelDoTeste('sofa'))], 170);
      }
    }
    await p.evaluate((c) => window.girarDoTeste('sofa', c.lado, c.c), origSofa);
  }
  if (erros.length) falhou('salão: erros na página: ' + erros.join(' | ')); else ok('salão: nenhum erro na página');
  await p.close();
}

await browser.close();
console.log('fotos em', FOTOS);
resumo('o coelho de cada um na cena');
