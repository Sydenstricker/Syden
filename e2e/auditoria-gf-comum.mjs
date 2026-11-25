// A AUDITORIA DE GAME FEEL (25/11/2026): o que os três scripts auditoria-gf-<jogo>.mjs têm em comum.
//
// - abrirNoSolo: a pessoa abre o jogo pelo computador do quarto (Solo, sem chamada), como em e2e/caca.mjs e
//   e2e/briga-pixelfx.mjs, e escolhe o modo/fase/chefe na tela de escolha.
// - momentos: a página copia o canvas a cada 50 ms num ANEL (os últimos `antes` quadros). Cada GATILHO lê um número do
//   placar da própria tela (DOM: o texto "Pontos: n", quantos corações, etc.). Quando ele muda no sentido pedido, a folha
//   daquele momento é o anel (o que veio antes) mais os `depois` quadros seguintes, cada um com a hora relativa ao gatilho
//   (negativa antes). Não mexe em nada do jogo: só lê o DOM e copia o canvas.
import fs from 'node:fs';
import path from 'node:path';

export const FOTOS = path.join('e2e', 'fotos', 'auditoria-gf');
fs.mkdirSync(FOTOS, { recursive: true });

export async function abrirNoSolo(pagina, nomeNaEstante) {
  await pagina.locator('.rail-logo').click();
  const quarto = await (await pagina.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await pagina.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await pagina.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = pagina.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: nomeNaEstante }).first().dispatchEvent('click');
}

export const salvar = (nome, dataUrl) => fs.writeFileSync(path.join(FOTOS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'));

/**
 * gatilhos: [{ nome, sel, modo: 'numero' | 'contar' | 'existe' | 'texto-inclui', texto?, sinal: 1 | -1, minimo?: n, vezes: [1, 3] }]
 *   'numero': os dígitos do texto do primeiro elemento; 'contar': quantos elementos; 'existe': 1 ou 0; 'texto-inclui': 1 se o
 *   texto do elemento inclui `texto`. O momento dispara quando (novo - velho) * sinal >= (minimo ?? 1). `vezes`: quais
 *   ocorrências viram folha (1 = a primeira).
 */
export const momentos = (pagina, { canvas, escala = 1, colunas = 4, antes = 8, depois = 16, ms = 90000, gatilhos, passo = 50 }) =>
  pagina.evaluate(
    ({ canvas, escala, colunas, antes, depois, ms, gatilhos, passo }) =>
      new Promise((pronto) => {
        const ler = (g) => {
          if (g.modo === 'pixel') {
            const cv = document.querySelector(g.sel);
            if (!cv) return 0;
            const d = cv.getContext('2d').getImageData(g.x, g.y, 1, 1).data;
            return g.cor.every((v, i) => Math.abs(v - d[i]) < 12) ? 1 : 0;
          }
          const els = document.querySelectorAll(g.sel);
          if (g.modo === 'contar') return els.length;
          if (g.modo === 'existe') return els.length ? 1 : 0;
          const tx = els[0]?.textContent ?? '';
          if (g.modo === 'texto-inclui') return tx.includes(g.texto) ? 1 : 0;
          if (g.modo === 'comprimento') return els.length ? tx.trim().length : null;
          const n = tx.replace(/[^\d]/g, '');
          return n ? Number(n) : null;
        };
        const anel = [];
        const ativas = [];
        const prontas = [];
        const conta = Object.fromEntries(gatilhos.map((g) => [g.nome, 0]));
        const ultimo = Object.fromEntries(gatilhos.map((g) => [g.nome, null]));
        const inicio = performance.now();
        const montar = (m) => {
          const quadros = m.quadros;
          const w = quadros[0].c.width, h = quadros[0].c.height;
          const f = document.createElement('canvas');
          f.width = w * colunas;
          f.height = h * Math.ceil(quadros.length / colunas);
          const g = f.getContext('2d');
          g.fillStyle = '#111';
          g.fillRect(0, 0, f.width, f.height);
          quadros.forEach((q, i) => {
            const x = (i % colunas) * w, y = Math.floor(i / colunas) * h;
            g.drawImage(q.c, x, y);
            const rot = `#${i} ${Math.round(q.t - m.em)} ms`;
            g.fillStyle = q.t >= m.em ? '#a00d' : '#000b';
            g.fillRect(x, y + h - 20, 120, 20);
            g.fillStyle = '#fff';
            g.font = '14px monospace';
            g.fillText(rot, x + 4, y + h - 6);
            g.strokeStyle = '#555';
            g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
          });
          return { nome: m.nome, vez: m.vez, valor: m.valor, antesDele: m.velho, png: f.toDataURL('image/png'), n: quadros.length };
        };
        const tick = setInterval(() => {
          const agora = performance.now();
          const c = document.querySelector(canvas);
          if (c && c.width) {
            const q = document.createElement('canvas');
            q.width = Math.round(c.width * escala);
            q.height = Math.round(c.height * escala);
            const g = q.getContext('2d');
            g.imageSmoothingEnabled = escala < 1;
            g.drawImage(c, 0, 0, q.width, q.height);
            const quadro = { c: q, t: agora };
            anel.push(quadro);
            if (anel.length > antes) anel.shift();
            for (const m of ativas) if (m.faltam > 0) (m.quadros.push(quadro), m.faltam--);
          } else for (const m of ativas) m.faltam--; // a tela saiu (o fim): a folha fica com o que viu
          for (let k = ativas.length - 1; k >= 0; k--)
            if (ativas[k].faltam <= 0 && ativas[k].quadros.length) {
              prontas.push(montar(ativas[k]));
              ativas.splice(k, 1);
            }
          for (const gt of gatilhos) {
            const v = ler(gt);
            const velho = ultimo[gt.nome];
            ultimo[gt.nome] = v;
            if (v === null || velho === null) continue;
            if ((v - velho) * gt.sinal >= (gt.minimo ?? 1)) {
              conta[gt.nome]++;
              if (gt.vezes.includes(conta[gt.nome]) && anel.length)
                ativas.push({ nome: gt.nome, vez: conta[gt.nome], valor: v, velho, em: agora, quadros: [...anel], faltam: depois });
            }
          }
          const tudo = gatilhos.every((gt) => conta[gt.nome] >= Math.max(...gt.vezes)) && ativas.length === 0;
          if (agora - inicio > ms || tudo) {
            clearInterval(tick);
            for (const m of ativas) if (m.quadros.length) prontas.push(montar(m));
            pronto({ prontas, conta, segundos: Math.round((agora - inicio) / 1000) });
          }
        }, passo);
      }),
    { canvas, escala, colunas, antes, depois, ms, gatilhos, passo },
  );

/** Uma folha de quadros seguidos, sem gatilho (o trecho de 3–4 s com o piloto jogando). */
export const trecho = (pagina, { canvas, escala = 1, colunas = 4, n = 24, passo = 120 }) =>
  pagina.evaluate(
    ({ canvas, escala, colunas, n, passo }) =>
      new Promise((pronto) => {
        const quadros = [];
        const t0 = performance.now();
        const tick = setInterval(() => {
          const c = document.querySelector(canvas);
          if (!c) return;
          const q = document.createElement('canvas');
          q.width = Math.round(c.width * escala);
          q.height = Math.round(c.height * escala);
          const g = q.getContext('2d');
          g.imageSmoothingEnabled = escala < 1;
          g.drawImage(c, 0, 0, q.width, q.height);
          quadros.push({ c: q, t: performance.now() - t0 });
          if (quadros.length >= n) {
            clearInterval(tick);
            const w = q.width, h = q.height;
            const f = document.createElement('canvas');
            f.width = w * colunas;
            f.height = h * Math.ceil(n / colunas);
            const fg = f.getContext('2d');
            quadros.forEach((qq, i) => {
              const x = (i % colunas) * w, y = Math.floor(i / colunas) * h;
              fg.drawImage(qq.c, x, y);
              fg.fillStyle = '#000b';
              fg.fillRect(x, y + h - 20, 110, 20);
              fg.fillStyle = '#fff';
              fg.font = '14px monospace';
              fg.fillText(`#${i} ${Math.round(qq.t)} ms`, x + 4, y + h - 6);
            });
            pronto(f.toDataURL('image/png'));
          }
        }, passo);
      }),
    { canvas, escala, colunas, n, passo },
  );
