// AS FOLHAS DE QUADROS DA AUDITORIA DE GAME FEEL (25/11/2026) do Comando, da Masmorra e da Arena
// (e2e/auditoria-gf-{comando,masmorra,arena}.mjs). O auditoria-gf-comum.mjs é de outra auditoria, ao mesmo tempo.
//
// O padrão é o de e2e/briga-pixelfx.mjs: a página copia o canvas do jogo a cada 50 ms numa FOLHA por tipo de momento, do
// começo de UM momento daquele tipo até ele acabar, com a hora no canto de cada quadro (e uns quadros de ANTES, para ver o
// golpe sair). Só olha: não mexe em nada do jogo.
import fs from 'node:fs';
import path from 'node:path';

export const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'auditoria-gf');
fs.mkdirSync(FOTOS, { recursive: true });

export const salvar = (nome, dataUrl) => fs.writeFileSync(path.join(FOTOS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'));

/** Abre o computador do quarto e a lista de mini-games (Solo, sem chamada). */
export async function abrirComputador(pagina) {
  await pagina.locator('.rail-logo').click();
  const quarto = await (await pagina.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await pagina.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await pagina.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = pagina.locator('.jogos-painel');
  await painel.waitFor();
  return painel;
}

/**
 * Para o jogo cujos efeitos moram numa lista fechada dentro do componente (a Masmorra): anota cada objeto com `tipo` e `em`
 * empurrado numa lista, e o considera vivo enquanto a lista ainda o tiver. Instalar ANTES de o jogo abrir (addInitScript).
 */
export const GANCHO_DOS_EFEITOS = () => {
  const empurrar = Array.prototype.push;
  window.__gfEfeitos = [];
  Array.prototype.push = function (...itens) {
    for (const o of itens)
      if (o && typeof o === 'object' && typeof o.tipo === 'string' && typeof o.em === 'number' && 'x' in o)
        empurrar.call(window.__gfEfeitos, { o, lista: this });
    if (window.__gfEfeitos.length > 400) window.__gfEfeitos.splice(0, 200);
    return empurrar.apply(this, itens);
  };
};

/**
 * Copia o canvas por até `ms`, numa folha por tipo de momento. `vivos` é o código (texto de uma função, rodada na página)
 * que devolve os tipos vivos neste instante. `pre` quadros de antes entram no começo de cada folha (com a hora negativa).
 */
export const folhas = (pagina, { canvas, vivos, tipos, ms, K = 1, pre = 3, max = 24, col = 4 }) =>
  pagina.evaluate(
    ({ canvas, vivos, tipos, ms, K, pre, max, col }) =>
      new Promise((pronto) => {
        const c = document.querySelector(canvas);
        const lerVivos = new Function(`return (${vivos})();`);
        const PASSO = 50;
        const nova = () => {
          const f = document.createElement('canvas');
          f.width = c.width * K * col;
          f.height = c.height * K * Math.ceil(max / col);
          const g = f.getContext('2d');
          g.imageSmoothingEnabled = false;
          g.fillStyle = '#111';
          g.fillRect(0, 0, f.width, f.height);
          return { f, g, n: 0, desde: 0, fechada: false, duracao: 0 };
        };
        const por = Object.fromEntries(tipos.map((t) => [t, nova()]));
        const anteriores = [];
        const fim = performance.now() + ms;
        const colar = (fo, origem, rotulo) => {
          const x = (fo.n % col) * c.width * K, y = Math.floor(fo.n / col) * c.height * K;
          fo.g.drawImage(origem, x, y, c.width * K, c.height * K);
          fo.g.fillStyle = '#000a';
          fo.g.fillRect(x, y + c.height * K - 22, 96, 22);
          fo.g.fillStyle = '#fff';
          fo.g.font = '16px monospace';
          fo.g.fillText(rotulo, x + 4, y + c.height * K - 6);
          fo.n++;
        };
        const tick = setInterval(() => {
          let vivosAgora = [];
          try {
            vivosAgora = lerVivos() ?? [];
          } catch {
            /* o jogo ainda não montou */
          }
          const agora = performance.now();
          for (const [t, fo] of Object.entries(por)) {
            if (fo.fechada) continue;
            const vivo = vivosAgora.includes(t);
            if (!vivo) {
              if (fo.n > 0) {
                fo.fechada = true;
                fo.duracao = Math.round(agora - fo.desde);
              }
              continue;
            }
            if (fo.n === 0) {
              fo.desde = agora;
              for (const a of anteriores.slice(-pre)) colar(fo, a.copia, `${Math.round(a.em - agora)} ms`);
            }
            const idade = agora - fo.desde;
            if (fo.n >= max || (fo.n >= 8 + pre && Math.round(idade / PASSO) % 2)) continue;
            colar(fo, c, `${Math.round(idade)} ms`);
          }
          const copia = document.createElement('canvas');
          copia.width = c.width;
          copia.height = c.height;
          copia.getContext('2d').drawImage(c, 0, 0);
          anteriores.push({ copia, em: agora });
          if (anteriores.length > pre) anteriores.shift();
          if (agora > fim || Object.values(por).every((fo) => fo.fechada)) {
            clearInterval(tick);
            pronto(
              Object.fromEntries(
                Object.entries(por).map(([t, fo]) => [t, { png: fo.f.toDataURL('image/png'), n: fo.n, completa: fo.fechada, duracao: fo.duracao }]),
              ),
            );
          }
        }, PASSO);
      }),
    { canvas, vivos, tipos, ms, K, pre, max, col },
  );

/** Um trecho seguido (sem gancho de momento): `n` quadros a cada `passo` ms. */
export const trecho = (pagina, { canvas, n = 24, passo = 100, K = 1, col = 4 }) =>
  pagina.evaluate(
    ({ canvas, n, passo, K, col }) =>
      new Promise((pronto) => {
        const c = document.querySelector(canvas);
        const f = document.createElement('canvas');
        f.width = c.width * K * col;
        f.height = c.height * K * Math.ceil(n / col);
        const g = f.getContext('2d');
        g.imageSmoothingEnabled = false;
        let k = 0;
        const t0 = performance.now();
        const tick = setInterval(() => {
          const x = (k % col) * c.width * K, y = Math.floor(k / col) * c.height * K;
          g.drawImage(c, x, y, c.width * K, c.height * K);
          g.fillStyle = '#000a';
          g.fillRect(x, y + c.height * K - 22, 96, 22);
          g.fillStyle = '#fff';
          g.font = '16px monospace';
          g.fillText(`${Math.round(performance.now() - t0)} ms`, x + 4, y + c.height * K - 6);
          if (++k >= n) {
            clearInterval(tick);
            pronto(f.toDataURL('image/png'));
          }
        }, passo);
      }),
    { canvas, n, passo, K, col },
  );
