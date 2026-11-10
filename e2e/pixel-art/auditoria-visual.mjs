// A AUDITORIA VISUAL (09/11/2026, pedido dele: "um agente que abre o quarto e o salão de verdade, fotografa cada pose em
// cada móvel, de dia e de noite, e olha as imagens procurando corte, sobreposição errada ou objeto flutuando; rodar depois
// de cada lote novo de arte do PixelLab"). A auditoria das bordas (auditoria-de-bordas.mjs) só pega o desenho cortado na
// borda do QUADRO, pela conta dos pixels; o que só se vê com a cena montada (a ordem de desenho, o coelho flutuando acima do
// assento, a orelha atrás da cabeceira, a perna cortada pela máscara do móvel) pede olhar. Este script monta as páginas,
// põe o coelho em cada lugar e pose pelos ganchos de teste da página (window.coelhoDoTeste, girarDoTeste,
// caixaDoMovelDoTeste e pessoasNaTelaDoTeste, em quarto/novo/quarto/montar.mjs) e grava, para quem revisa:
//   auditoria-visual/<mascote>/<cena>/<grupo>/<caso>.png   recorte ampliado (3×, pixel nítido) em volta do coelho e do móvel
//   auditoria-visual/<mascote>/<cena>/folha-<grupo>-<dia|noite>.png   a folha de contato do grupo, com o nome de cada caso
//   auditoria-visual/<mascote>/<cena>/index.json   a lista dos casos (o rótulo do quadro, a caixa, o que não deu)
//
//   node e2e/pixel-art/auditoria-visual.mjs                        → os dois mascotes, as duas cenas
//   MASCOTE=pixellab CENA=quarto node e2e/pixel-art/auditoria-visual.mjs
//   SO=cama node e2e/pixel-art/auditoria-visual.mjs                 → só os casos com "cama" no nome
//   SEM_MONTAR=1 ...                                                → usa as páginas já montadas (na pasta temporária)
//
// As páginas são montadas numa pasta temporária (SAIDA_DA_PAGINA), sem mexer no quarto.html e no salao.html do git.
// Quem revisa olha as folhas: o script não decide sozinho o que é defeito.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const MONTAR = path.join(AQUI, 'quarto', 'novo', 'quarto', 'montar.mjs');
const SAIDA = path.join(AQUI, 'auditoria-visual');
const PAGINAS = path.join(os.tmpdir(), 'syden-auditoria-visual');
const MASCOTES = process.env.MASCOTE ? [process.env.MASCOTE] : ['pixellab', '3d'];
const CENAS = process.env.CENA ? [process.env.CENA] : ['quarto', 'salao'];
const SO = process.env.SO || '';
const AMPLIA = 3;
// O LADO DO RECORTE por grupo, em px da cena: o mesmo em todo o grupo, para a escala do coelho ser comparável de uma foto
// para outra na folha (com recortes do tamanho de cada caixa, o coelho com a vassoura parecia menor). Cresce só se não couber.
const LADO = { 'de-pe': 150, cama: 190, pessoas: 170, gato: 150, sofa: 200 };
const DIAGONAIS = ['sudeste', 'sudoeste', 'nordeste', 'noroeste'];
const RETAS = ['sul', 'oeste', 'norte', 'leste'];

fs.mkdirSync(PAGINAS, { recursive: true });
const t0 = Date.now();
const { browser } = await abrirNavegador({ viewport: { width: 1240, height: 1000 } });
let total = 0;

for (const mascote of MASCOTES) for (const cena of CENAS) {
  const pagina = path.join(PAGINAS, `${cena}-${mascote}.html`);
  if (!process.env.SEM_MONTAR || !fs.existsSync(pagina)) {
    console.log(`montando ${cena} (${mascote})…`);
    execFileSync(process.execPath, [MONTAR, ...(cena === 'salao' ? ['salao'] : [])], { env: { ...process.env, MASCOTE: mascote === 'pixellab' ? 'pixellab' : '3d', SAIDA_DA_PAGINA: pagina }, stdio: 'inherit' });
  }
  const pasta = path.join(SAIDA, mascote, cena);
  if (!SO) fs.rmSync(pasta, { recursive: true, force: true });
  fs.mkdirSync(pasta, { recursive: true });
  const p = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
  const erros = []; p.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
  await p.goto('file:///' + pagina.replaceAll('\\', '/'));
  await p.waitForFunction(() => window.coelhoDoTeste && window.arrumacaoDoTeste && document.getElementById('tela')?.width > 0, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  if (cena === 'salao') await p.evaluate(() => window.pessoasDoTeste([])); // o salão começa vazio; as pessoas entram no grupo delas
  const casos = [];
  const original = await p.evaluate(() => JSON.parse(JSON.stringify(window.arrumacaoDoTeste())));

  /** Fotografa o recorte em volta das caixas (da cena, [x0, y0, x1, y1]) e grava. */
  async function foto(grupo, nome, modo, caixas, extra = {}) {
    const caso = `${grupo}/${nome}-${modo}`;
    const caixa = caixas.filter(Boolean).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
    const png = await p.evaluate(({ caixa, amplia, minimo }) => {
      const c = document.getElementById('tela'), W = c.width, folga = 10;
      let [x0, y0, x1, y1] = [caixa[0] - folga, caixa[1] - folga, caixa[2] + folga, caixa[3] + folga];
      const lado = Math.max(minimo, x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      x0 = Math.round(Math.max(0, Math.min(W - lado, cx - lado / 2))); y0 = Math.round(Math.max(0, Math.min(c.height - lado, cy - lado / 2)));
      const o = document.createElement('canvas'); o.width = o.height = lado * amplia;
      const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(c, x0, y0, lado, lado, 0, 0, lado * amplia, lado * amplia);
      return o.toDataURL('image/png').split(',')[1];
    }, { caixa, amplia: AMPLIA, minimo: LADO[grupo] ?? 160 });
    const arquivo = path.join(pasta, grupo, `${nome}-${modo}.png`);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, Buffer.from(png, 'base64'));
    casos.push({ caso, grupo, nome, modo, arquivo: path.relative(pasta, arquivo).replaceAll('\\', '/'), ...extra });
    total++;
  }
  const quer = (grupo, nome) => !SO || `${cena}/${grupo}/${nome}`.includes(SO);
  const caixaDe = (id) => p.evaluate((id) => window.caixaDoMovelDoTeste(id), id);
  const coelho = (o) => p.evaluate((o) => window.coelhoDoTeste(o), o);
  const girar = (id, lado, c) => p.evaluate(([id, lado, c]) => window.girarDoTeste(id, lado, c), [id, lado, c ?? null]);
  // (o que começa guardado, como a poltrona do quarto, sai de novo)
  const restaurar = async (id) => { await girar(id, original[id] ? original[id].lado : null, original[id]?.c); };
  const naoDeu = (grupo, nome, modo, porque) => { casos.push({ caso: `${grupo}/${nome}-${modo}`, grupo, nome, modo, naoDeu: porque }); console.log(`  — ${grupo}/${nome}-${modo}: ${porque}`); };

  for (const modo of ['dia', 'noite']) {
    await p.click('#' + modo);
    await p.waitForTimeout(300);

    // O COELHO DE PÉ, numa casa livre do meio: parado, andando, varrendo e falando, nas 4 diagonais (e o parado nas 4
    // direções retas, que são as da virada).
    for (const dir of [...DIAGONAIS, ...RETAS]) {
      const anims = DIAGONAIS.includes(dir) ? ['parado', 'andando', 'varrendo', 'falando'] : ['parado'];
      for (const anim of anims) {
        if (!quer('de-pe', `${anim}-${dir}`)) continue;
        const r0 = await coelho({ anim, dir, iq: 0 });
        if (!r0.quadros) { naoDeu('de-pe', `${anim}-${dir}`, modo, 'sem quadros'); continue; }
        const iqs = anim === 'parado' ? [0] : [...new Set([0, Math.floor(r0.quadros / 3), Math.floor((2 * r0.quadros) / 3)])];
        for (const iq of iqs) {
          const r = await coelho({ anim, dir, iq });
          await foto('de-pe', `${anim}-${dir}-q${iq}`, modo, [r.caixa], { rotulo: r.rotulo, caixa: r.caixa });
        }
      }
    }

    if (cena === 'quarto') {
      // A CAMA nas 4 posições: lendo, dormindo, dormindo largado, e o meio das transições de deitar (com e sem livro).
      for (const lado of [0, 1, 2, 3]) {
        if (!['lendo', 'dormindo', 'largado', 'deitar', 'deitar-lendo'].some((n) => quer('cama', `L${lado}-${n}`))) continue;
        const c = await girar('cama', lado);
        if (!c) { naoDeu('cama', `L${lado}`, modo, 'a cama não coube nessa posição'); continue; }
        for (const [nome, o] of [['lendo', { anim: 'lendo' }], ['dormindo', { anim: 'dormindo' }], ['largado', { anim: 'dormindo-largado' }]]) {
          if (!quer('cama', `L${lado}-${nome}`)) continue;
          const r = await coelho({ ir: 'cama', ...o, iq: 0 });
          await foto('cama', `L${lado}-${nome}`, modo, [r.caixa, await caixaDe('cama')], { rotulo: r.rotulo, caixa: r.caixa, destino: r.destino });
        }
        for (const [nome, dormindo] of [['deitar', true], ['deitar-lendo', false]]) for (const f of [0.15, 0.4, 0.65, 0.9]) {
          if (!quer('cama', `L${lado}-${nome}`)) continue;
          const r = await coelho({ ir: 'cama', transicao: 'cama', dormindo, f });
          await foto('cama', `L${lado}-${nome}-f${Math.round(f * 100)}`, modo, [r.caixa, await caixaDe('cama')], { rotulo: r.rotulo, caixa: r.caixa });
        }
        await coelho({});
      }
      await restaurar('cama');

      // A POLTRONA nas 4 posições: sentado e o meio do sentar.
      for (const lado of [0, 1, 2, 3]) {
        if (!quer('poltrona', `L${lado}`)) continue;
        // a poltrona começa GUARDADA no quarto: entra no canto de fábrica dela (7, 5) para a foto
        const c = original.poltrona ? await girar('poltrona', lado) : await girar('poltrona', lado, [7, 5]);
        if (!c) { naoDeu('poltrona', `L${lado}`, modo, 'não coube'); continue; }
        const r = await coelho({ ir: 'poltrona' });
        await foto('poltrona', `L${lado}-sentado`, modo, [r.caixa, await caixaDe('poltrona')], { rotulo: r.rotulo, caixa: r.caixa });
        for (const f of [0.3, 0.6, 0.85]) {
          const t = await coelho({ ir: 'poltrona', transicao: 'poltrona', f });
          await foto('poltrona', `L${lado}-sentar-f${Math.round(f * 100)}`, modo, [t.caixa, await caixaDe('poltrona')], { rotulo: t.rotulo, caixa: t.caixa });
        }
        await coelho({});
      }
      await restaurar('poltrona');

      // O PUFE é redondo: o olhar nas 4 diagonais, sentado e no pulinho.
      for (const olhar of DIAGONAIS) {
        if (!quer('pufe', olhar)) continue;
        await coelho({});
        const r = await coelho({ ir: 'pufe', olharNoPufe: olhar });
        await foto('pufe', `${olhar}-sentado`, modo, [r.caixa, await caixaDe('pufe')], { rotulo: r.rotulo, caixa: r.caixa });
        for (const f of [0.3, 0.55, 0.8]) {
          const t = await coelho({ ir: 'pufe', olharNoPufe: olhar, transicao: 'pufe', f });
          await foto('pufe', `${olhar}-sentar-f${Math.round(f * 100)}`, modo, [t.caixa, await caixaDe('pufe')], { rotulo: t.rotulo, caixa: t.caixa });
        }
      }
      await coelho({});

      // A MESA com a cadeira do computador, nas 4 posições da mesa: ao computador (a pose e o toque no mouse).
      for (const lado of [0, 1, 2, 3]) {
        if (!quer('mesa', `L${lado}`)) continue;
        await coelho({});
        const c = await girar('mesa', lado);
        if (!c) { naoDeu('mesa', `L${lado}`, modo, 'não coube'); continue; }
        await coelho({ ir: 'cadeira' });
        // a cadeira rola pela física (requestAnimationFrame), e só na mesa ele fica na pose do computador
        try { await p.waitForFunction(() => window.coelhoNaCadeiraDoTeste().fase === 'mesa', null, { timeout: 6000 }); }
        catch { naoDeu('mesa', `L${lado}`, modo, 'a cadeira não chegou à mesa em 6 s'); continue; }
        await p.waitForTimeout(150);
        for (const iq of [0, 3]) {
          const r = await coelho({ ir: 'cadeira', anim: 'no-computador', iq });
          await foto('mesa', `L${lado}-computador-q${iq}`, modo, [r.caixa, await caixaDe('mesa')], { rotulo: r.rotulo, caixa: r.caixa });
        }
      }
      await coelho({});
      await restaurar('mesa');

      // O ABAJUR e o GUARDA-ROUPA: de pé diante deles, nas 4 posições do móvel.
      for (const id of ['abajur', 'guarda-roupa']) for (const lado of [0, 1, 2, 3]) {
        if (!quer(id, `L${lado}`)) continue;
        await coelho({});
        const c = await girar(id, lado);
        if (!c) { naoDeu(id, `L${lado}`, modo, 'não coube'); continue; }
        const r = await coelho({ ir: id });
        await foto(id, `L${lado}-de-pe`, modo, [r.caixa, await caixaDe(id)], { rotulo: r.rotulo, caixa: r.caixa });
        await restaurar(id);
      }
      await coelho({});

      // O GATO (o bicho do quarto, 09/11/2026): em cada lugar dele (tapete, pés da cama, pufe, poltrona, chão), sentado e
      // dormindo; no peitoril da janela com ela fechada e aberta; e JUNTO do coelho (o coelho na cama, no pufe, na poltrona, e
      // de pé ao lado dele no chão), para aparecer qualquer um atravessando o outro. O relógio dele é o gancho
      // (passoDoGatoDoTeste): a página está parada.
      if (await p.evaluate(() => !!window.irGatoDoTeste)) {
        const temPolt = !!original.poltrona;
        if (!temPolt) await girar('poltrona', 0, [7, 5]);
        const gatoEm = async (id, pose) => p.evaluate(([id, pose]) => { const ok = window.irGatoDoTeste(id); if (ok && pose) window.gatoDoTeste({ pose, vaiDormir: false, anim: null }); window.passoDoGatoDoTeste(0.01); return ok; }, [id, pose]);
        const caixaGato = () => caixaDe('gato');
        // (sem caixa nenhuma, o caso não deu: o gato escondido inteiro atrás de um móvel, por exemplo)
        const fotoGato = async (nome, caixas, extra) => { const c = caixas.filter(Boolean); if (!c.length) return naoDeu('gato', nome, modo, 'nada na tela'); await foto('gato', nome, modo, c, extra); };
        for (const id of ['tapete', 'cama', 'pufe', 'poltrona', 'chao']) for (const pose of ['sentado', 'dormindo']) {
          if (!quer('gato', `${id}-${pose}`)) continue;
          await coelho({ casa: [7.5, 7.5] }); // o coelho longe, num canto
          if (!(await gatoEm(id, pose))) { naoDeu('gato', `${id}-${pose}`, modo, 'sem lugar'); continue; }
          await fotoGato(`${id}-${pose}`, [await caixaGato(), id === 'chao' ? null : await caixaDe(id)]);
        }
        for (const [nome, abrir] of [['peitoril-fechada', false], ['peitoril-aberta', true]]) for (const pose of ['sentado', 'dormindo']) {
          if (!quer('gato', `${nome}-${pose}`)) continue;
          const aberta = await p.evaluate(() => document.getElementById('janela').getAttribute('aria-pressed') === 'true');
          if (aberta !== abrir) await p.evaluate(() => document.getElementById('janela').click());
          await coelho({ casa: [7.5, 7.5] });
          if (!(await gatoEm('janela', pose))) { naoDeu('gato', `${nome}-${pose}`, modo, 'sem peitoril'); continue; }
          await fotoGato(`${nome}-${pose}`, [await caixaGato()]);
        }
        if (await p.evaluate(() => document.getElementById('janela').getAttribute('aria-pressed') === 'true')) await p.evaluate(() => document.getElementById('janela').click());
        // juntos: o gato vai ao móvel, e o coelho vem usá-lo (o gato tem de sair); e o coelho de pé colado nele no chão
        for (const id of ['cama', 'pufe', 'poltrona']) {
          if (!quer('gato', `junto-${id}`)) continue;
          await coelho({ casa: [7.5, 7.5] });
          await gatoEm(id);
          const r = await coelho(id === 'cama' ? { ir: 'cama', anim: 'dormindo' } : { ir: id });
          await p.evaluate(() => { window.passoDoGatoDoTeste(0.01); window.passoDoGatoDoTeste(0.01); });
          await fotoGato(`junto-${id}`, [r.caixa, await caixaDe(id), await caixaGato()], { rotulo: r.rotulo });
        }
        for (const dir of DIAGONAIS) {
          if (!quer('gato', `junto-chao-${dir}`)) continue;
          // o gato sentado colado no coelho, do lado para onde o coelho olha (na frente dele, nas 4 diagonais)
          const r = await coelho({ casa: [4.5, 6.5], dir, anim: 'parado', iq: 0 });
          await p.evaluate((dir) => { const [u, v] = window.coelhoOndeDoTeste(), [du, dv] = { sudeste: [0, 1], sudoeste: [1, 0], nordeste: [-1, 0], noroeste: [0, -1] }[dir]; window.gatoDoTeste({ u: u + du * 0.9, v: v + dv * 0.9, sobe: 0, pose: 'sentado', dir: 'sudeste', anim: null, caminho: [], pulo: null, vaiDormir: false, lugar: { id: 'chao' }, ate: 1e9 }); window.passoDoGatoDoTeste(0.01); }, dir);
          await fotoGato(`junto-chao-${dir}`, [r.caixa, await caixaGato()], { rotulo: r.rotulo });
        }
        if (!temPolt) await girar('poltrona', null);
        await coelho({});
      }
    } else {
      // O COELHO DO RECADO, atrás do balcão, nas 4 posições do balcão.
      for (const lado of [0, 1, 2, 3]) {
        if (!quer('balcao', `L${lado}`)) continue;
        const c = await girar('balcao', lado);
        if (!c) { naoDeu('balcao', `L${lado}`, modo, 'não coube'); continue; }
        for (const anim of ['parado', 'falando']) {
          const r = await coelho({ ir: 'balcao', anim, iq: 0 });
          await foto('balcao', `L${lado}-${anim}`, modo, [r.caixa, await caixaDe('balcao')], { rotulo: r.rotulo, caixa: r.caixa });
        }
        await coelho({});
      }
      await restaurar('balcao');

      // AS PESSOAS DA CALL: o salão cheio (quem transmite, quem joga e 30 na call: os assentos longe da TV só enchem depois do chão), e cada móvel de sentar nas 4 posições,
      // um de cada vez, com os outros onde estão. Fotografa as duas primeiras pessoas de cada móvel.
      const lista = [{ id: 1, nome: 'Tela', papel: 'transmitindo' }, { id: 2, nome: 'Jogo', papel: 'jogando' }, ...Array.from({ length: 30 }, (_, i) => ({ id: 3 + i, nome: 'P' + (3 + i), papel: 'call' }))];
      await coelho({ casa: [1, 1] }); // o coelho do recado fora do caminho
      await p.evaluate((l) => window.pessoasDoTeste(l), lista);
      const MOVEIS = ['sofa', 'sofa-2', 'poltrona', 'poltrona-2', 'banqueta', 'banqueta-2', 'cadeira', 'cadeira-2', 'pufao', 'tv', 'fliperama'];
      for (const id of MOVEIS) for (const lado of [0, 1, 2, 3]) {
        if (!original[id] || !quer('pessoas', `${id}-L${lado}`)) continue;
        const c = await girar(id, lado);
        if (!c) { naoDeu('pessoas', `${id}-L${lado}`, modo, 'não coube'); continue; }
        // SÓ A GENTE QUE PRECISA: com o salão cheio a folha vira um bolo de coelhos. Chamadas as pessoas da lista em ordem,
        // fica só até a segunda que senta neste móvel (os lugares enchem do mais perto da TV ao mais longe).
        const dele = (x) => (id === 'tv' ? x.papel === 'transmitindo' : id === 'fliperama' ? x.papel === 'jogando' : x.sobre === id);
        await p.evaluate((l) => window.pessoasDoTeste(l), lista);
        const cheio = await p.evaluate(() => window.pessoasNaTelaDoTeste());
        const ids = cheio.filter(dele).slice(0, 2).map((x) => x.id);
        const n = ids.length ? Math.max(...ids.map((i) => lista.findIndex((x) => x.id === i))) + 1 : lista.length;
        await p.evaluate((l) => window.pessoasDoTeste(l), lista.slice(0, n));
        const delas = (await p.evaluate(() => window.pessoasNaTelaDoTeste())).filter(dele).slice(0, 2);
        if (!delas.length) naoDeu('pessoas', `${id}-L${lado}`, modo, 'ninguém ficou nele');
        const cm = await caixaDe(id);
        for (const [k, x] of delas.entries()) {
          await foto('pessoas', `${id}-L${lado}-${k}`, modo, [cm, [x.x - 28, x.y - 62, x.x + 28, x.y + 6]], { pose: x.pose, olha: x.olha, sobre: x.sobre });
        }
        await restaurar(id);
      }
      // quem senta no chão perto da TV (com o salão na arrumação de fábrica)
      if (quer('pessoas', 'chao')) {
        await p.evaluate((l) => window.pessoasDoTeste(l), lista);
        const chao = (await p.evaluate(() => window.pessoasNaTelaDoTeste())).filter((x) => !x.sobre && x.papel === 'call').slice(0, 3);
        for (const [k, x] of chao.entries()) await foto('pessoas', `chao-${k}`, modo, [[x.x - 28, x.y - 62, x.x + 28, x.y + 6]], { pose: x.pose, olha: x.olha });
      }
      await p.evaluate(() => window.pessoasDoTeste([]));

      // O SOFÁ (o novo, 09/11/2026: "ele deve estar PERFEITO"): nas 4 posições, com 1 e 2 pessoas (as almofadas afundadas e
      // ninguém cortado), quem CHEGA sentando (os 3 passos: de pé, os dois do meio) e quem SAI levantando, e as REAÇÕES (alguém
      // chegou na call, a transmissão começou, alguém pela porta, a risada e as palmas). Os assentos longe da TV entram antes do
      // chão (pertoDaTvDoTeste), para os dois lugares encherem em qualquer posição; o relógio das pessoas é o gancho faseDoTeste.
      if (await p.evaluate(() => !!window.faseDoTeste && !!window.pertoDaTvDoTeste)) {
        const origSofa = original.sofa;
        await p.evaluate(() => { window.pertoDaTvDoTeste(99); window.movimentoDoTeste?.(true); });
        const gente = (n) => Array.from({ length: n }, (_, i) => ({ id: 101 + i, nome: 'S' + i, papel: 'call' }));
        const doSofa = async () => (await p.evaluate(() => window.pessoasNaTelaDoTeste())).filter((x) => x.sobre === 'sofa');
        const fotoSofa = async (nome, extra = {}) => {
          const cs = await caixaDe('sofa'), ps = await doSofa();
          await foto('sofa', nome, modo, [cs, ...ps.map((x) => [x.x - 30, x.y - 80, x.x + 30, x.y + 6])].filter(Boolean), { ocupacao: await p.evaluate(() => window.ocupacaoDoSofaDoTeste('sofa')), ...extra });
        };
        for (const lado of [0, 1, 2, 3]) {
          if (!quer('sofa', `L${lado}`)) continue;
          let c = null;
          for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) { c = await girar('sofa', lado, [origSofa.c[0] + a, origSofa.c[1] + b]); if (c) break; }
          if (!c) { naoDeu('sofa', `L${lado}`, modo, 'não coube'); continue; }
          const f0 = await p.evaluate(() => window.faseDoTeste());
          for (const n of [0, 1, 2]) {
            await p.evaluate((l) => window.pessoasDoTeste(l), gente(n));
            await p.evaluate((f) => window.faseDoTeste(f), f0 + 4);
            await fotoSofa(`L${lado}-${n}-pessoas`);
          }
          // quem chega: de 1 para 2 pessoas, com eventos (a segunda senta nos passos 0, 1 e 2; a primeira acena)
          await p.evaluate((l) => window.pessoasDoTeste(l), gente(1));
          const f1 = await p.evaluate(() => window.faseDoTeste());
          await p.evaluate((l) => window.pessoasDoTeste(l, true), gente(2));
          for (const k of [0, 1, 2, 3, 5]) { await p.evaluate((f) => window.faseDoTeste(f), f1 + k); await fotoSofa(`L${lado}-chega-${k}`); }
          // quem sai: de 2 para 1, levantando
          const f2 = await p.evaluate(() => window.faseDoTeste());
          await p.evaluate((l) => window.pessoasDoTeste(l, true), gente(1));
          for (const k of [0, 1, 2]) { await p.evaluate((f) => window.faseDoTeste(f), f2 + k); await fotoSofa(`L${lado}-sai-${k}`); }
          // as reações, com os dois sentados
          await p.evaluate((l) => window.pessoasDoTeste(l), gente(2));
          for (const ev of ['aoVivo', 'porta', 'chegou']) {
            const f3 = (await p.evaluate(() => window.faseDoTeste())) + 10;
            await p.evaluate(([ev, f]) => { window.faseDoTeste(f); window.eventoDoTeste(ev); }, [ev, f3]);
            for (const k of [3, 6]) { await p.evaluate((f) => window.faseDoTeste(f), f3 + k); await fotoSofa(`L${lado}-${ev}-${k}`); }
          }
        }
        await p.evaluate(() => { window.pertoDaTvDoTeste(5); window.pessoasDoTeste([]); window.movimentoDoTeste?.(false); });
        await girar('sofa', origSofa.lado, origSofa.c);
      }

      // O BANHEIRO (09/11/2026): a porta do salão fechada, com o realce, e aberta (o instante antes de a vista passar); o
      // banheiro inteiro; cada peça ampliada; a porta de dentro com o realce; e o patinho em 6 quadros do ciclo dele.
      const meta = await p.evaluate(() => window.banheiroDoTeste?.().meta ?? null);
      if (meta && quer('banheiro', '')) {
        const pt = await p.evaluate(() => window.portaDoBanheiroDoTeste());
        const cp = pt && [pt[0] - 40, pt[1] - 75, pt[0] + 40, pt[1] + 75];
        if (cp) {
          await foto('banheiro', 'salao-porta', modo, [cp]);
          await p.evaluate(() => window.portaAbertaDoTeste(true));
          await foto('banheiro', 'salao-porta-aberta', modo, [cp]);
          await p.evaluate(() => window.portaAbertaDoTeste(false));
        } else naoDeu('banheiro', 'salao-porta', modo, 'a porta do banheiro não está na parede');
        await p.evaluate(() => window.irAoBanheiroDoTeste(true));
        /** Como foto(), mas da tela do banheiro. */
        const fotoB = async (nome, caixa, amplia = AMPLIA) => {
          const png = await p.evaluate(({ caixa, amplia }) => {
            const c = document.getElementById('banheiro'), [x0, y0, x1, y1] = caixa.map(Math.round), w = x1 - x0, h = y1 - y0;
            const o = document.createElement('canvas'); o.width = w * amplia; o.height = h * amplia;
            const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#2a2522'; g.fillRect(0, 0, o.width, o.height);
            g.drawImage(c, x0, y0, w, h, 0, 0, w * amplia, h * amplia);
            return o.toDataURL('image/png').split(',')[1];
          }, { caixa, amplia });
          const arquivo = path.join(pasta, 'banheiro', `${nome}-${modo}.png`);
          fs.mkdirSync(path.dirname(arquivo), { recursive: true });
          fs.writeFileSync(arquivo, Buffer.from(png, 'base64'));
          casos.push({ caso: `banheiro/${nome}-${modo}`, grupo: 'banheiro', nome, modo, arquivo: path.relative(pasta, arquivo).replaceAll('\\', '/'), caixa });
          total++;
        };
        await p.evaluate(() => window.quadroDoBanheiroDoTeste(0));
        await fotoB('inteiro', [0, 0, meta.W, meta.H], 2);
        for (const [id, c] of Object.entries(meta.pecas)) await fotoB('peca-' + id, [c[0] - 8, c[1] - 8, c[2] + 8, c[3] + 8], 4);
        const cpd = meta.pecas.porta;
        await p.evaluate(() => window.quadroDoBanheiroDoTeste(0, true));
        await fotoB('porta-de-dentro-realce', [cpd[0] - 8, cpd[1] - 8, cpd[2] + 8, cpd[3] + 8], 4);
        const [px, py] = meta.pato.xy;
        for (const n of [0, 6, 12, 21, 42, 63]) {
          await p.evaluate((n) => window.quadroDoBanheiroDoTeste(n), n);
          await fotoB(`pato-q${n}`, [px - 14, py - 12, px + 26, py + 22], 6);
        }
        await p.evaluate(() => window.irAoBanheiroDoTeste(false));
      }
    }
  }
  await p.close();

  // AS FOLHAS DE CONTATO: um grupo por folha, de dia e de noite, 6 por fileira, cada recorte em 240 px com o nome embaixo.
  const folhas = [];
  const grupos = [...new Set(casos.filter((c) => c.arquivo).map((c) => c.grupo))];
  const pf = await browser.newPage({ viewport: { width: 1500, height: 800 } });
  for (const grupo of grupos) for (const modo of ['dia', 'noite']) {
    const doGrupo = casos.filter((c) => c.arquivo && c.grupo === grupo && c.modo === modo);
    if (!doGrupo.length) continue;
    const celulas = doGrupo.map((c) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(pasta, c.arquivo)).toString('base64')}"><figcaption>${c.nome}${c.pose ? ' · ' + c.pose + ' ' + c.olha : ''}</figcaption></figure>`).join('');
    await pf.setContent(`<!doctype html><meta charset="utf-8"><style>
      body{margin:8px;background:#222;color:#eee;font:13px system-ui,sans-serif}h1{font-size:15px;margin:4px 0 8px}
      main{display:grid;grid-template-columns:repeat(6,240px);gap:6px}figure{margin:0;background:#333}
      img{width:240px;height:240px;image-rendering:pixelated;display:block;object-fit:contain}figcaption{padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      </style><h1>${mascote} · ${cena} · ${grupo} · ${modo}</h1><main>${celulas}</main>`);
    const arquivo = path.join(pasta, `folha-${grupo}-${modo}.png`);
    await pf.screenshot({ path: arquivo, fullPage: true });
    folhas.push(path.basename(arquivo));
  }
  await pf.close();
  fs.writeFileSync(path.join(pasta, 'index.json'), JSON.stringify({ mascote, cena, quando: new Date().toISOString(), erros, folhas, casos }, null, 1));
  console.log(`${mascote} · ${cena}: ${casos.filter((c) => c.arquivo).length} fotos, ${casos.filter((c) => c.naoDeu).length} sem foto, ${folhas.length} folhas${erros.length ? ', ERROS NA PÁGINA: ' + erros.join(' | ') : ''}`);
}
await browser.close();
console.log(`\n${total} fotos em ${Math.round((Date.now() - t0) / 1000)} s → ${path.relative(process.cwd(), SAIDA)}`);
