// O PILOTO DO PIXELFX NA BRIGA (25/11/2026): o golpe forte e a fumaça do bicho vêm da biblioteca pixelfx.
//
// - A Duda abre a Briga pelo computador do quarto (Solo, sem chamada), na Horta, e liga o piloto automático.
// - Enquanto ele bate, a página copia o canvas (320 × 180) a cada 50 ms e monta UMA FOLHA POR EFEITO, só com os quadros em
//   que ele está vivo, cada um com a hora desde o começo dele (e2e/fotos/briga-pixelfx-forte.png e -fumaca.png): é a foto da
//   AUDITORIA, para ver cada efeito no tamanho e na luz da fase, e quanto ele dura.
// - Depois, com os efeitos de antes (localStorage 'syden.brigaPixelfx' = 'nao'), a folha briga-pixelfx-antigo.png, para
//   comparar. Confere: os dois efeitos aparecem, somem sozinhos (não acumulam) e, desligado, a camada não existe.
//
//   node e2e/briga-pixelfx.mjs   (API de teste na 3099 e site na 5174; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

/**
 * Copia o canvas do jogo por até `ms`. Com `tipos`, uma folha por tipo: do começo de UM efeito daquele tipo até ele sumir,
 * com a hora no canto de cada quadro. Sem `tipos` (null), 24 quadros seguidos.
 */
const folhas = (pagina, ms, tipos) =>
  pagina.evaluate(
    ({ ms, tipos }) =>
      new Promise((pronto) => {
        const c = document.querySelector('.briga-tela canvas');
        const COL = 4, MAX = 24, K = 2, PASSO = 50;
        const nova = () => {
          const f = document.createElement('canvas');
          f.width = c.width * K * COL;
          f.height = c.height * K * Math.ceil(MAX / COL);
          const g = f.getContext('2d');
          g.imageSmoothingEnabled = false;
          g.fillStyle = '#111';
          g.fillRect(0, 0, f.width, f.height);
          return { f, g, n: 0, desde: 0, fechada: false, duracao: 0 };
        };
        const por = Object.fromEntries((tipos ?? ['todos']).map((t) => [t, nova()]));
        let pico = 0;
        const fim = performance.now() + ms;
        const tick = setInterval(() => {
          const vivos = window.brigaFxVivos?.() ?? null;
          if (vivos) pico = Math.max(pico, vivos.length);
          const agora = performance.now();
          for (const [t, fo] of Object.entries(por)) {
            if (fo.fechada) continue;
            const vivo = t === 'todos' || (vivos ?? []).includes(t);
            if (!vivo) {
              if (fo.n > 0) {
                fo.fechada = true; // o efeito sumiu: a folha dele está completa
                fo.duracao = Math.round(agora - fo.desde);
              }
              continue;
            }
            if (fo.n === 0) fo.desde = agora;
            // efeito longo: um quadro a cada dois depois dos 8 primeiros, para caber do começo ao fim
            const idade = agora - fo.desde;
            if (fo.n >= MAX || (fo.n >= 8 && Math.round(idade / PASSO) % 2)) continue;
            const x = (fo.n % COL) * c.width * K, y = Math.floor(fo.n / COL) * c.height * K;
            fo.g.drawImage(c, x, y, c.width * K, c.height * K);
            fo.g.fillStyle = '#000a';
            fo.g.fillRect(x, y + c.height * K - 22, 80, 22);
            fo.g.fillStyle = '#fff';
            fo.g.font = '16px monospace';
            fo.g.fillText(`${Math.round(idade)} ms`, x + 4, y + c.height * K - 6);
            fo.n++;
          }
          const todas = Object.values(por).every((fo) => fo.fechada || (tipos === null && fo.n >= MAX));
          if (agora > fim || todas) {
            clearInterval(tick);
            pronto({
              pico,
              folhas: Object.fromEntries(
                Object.entries(por).map(([t, fo]) => [t, { png: fo.f.toDataURL('image/png'), n: fo.n, completa: fo.fechada, duracao: fo.duracao }]),
              ),
            });
          }
        }, PASSO);
      }),
    { ms, tipos },
  );

const salvar = (nome, dataUrl) => fs.writeFileSync(path.join(FOTOS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'));

const abrirBriga = async (duda) => {
  await duda.locator('.rail-logo').click();
  const quarto = await (await duda.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await duda.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await duda.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = duda.locator('.jogos-painel');
  await painel.waitFor();
  // o fichário de gêneros fica por cima da estante no monitor do quarto: o clique vai direto ao botão
  await painel.locator('.jogos-solo button', { hasText: 'Briga na horta' }).dispatchEvent('click');
  await duda.locator('.corrida-escolha').waitFor({ timeout: 10000 });
  await duda.locator('.corrida-pista-botao', { has: duda.locator('strong', { hasText: /^Horta$/ }) }).click();
  const comecar = duda.getByRole('button', { name: /^Começar$/ });
  if (await comecar.count()) await comecar.first().click().catch(() => {});
  await duda.locator('.briga-tela canvas').waitFor({ timeout: 10000 });
  await duda.evaluate(() => (window.brigaPilotoAutomatico = true));
  await duda.waitForTimeout(2000);
};

const { browser } = await abrirNavegador();
try {
  const duda = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(duda, 'duda' + s);
  await dispensarPresentes(duda);

  // COM O PIXELFX
  await duda.evaluate(() => localStorage.removeItem('syden.brigaPixelfx'));
  await abrirBriga(duda);
  const r = await folhas(duda, 60000, ['acerto-forte', 'fumaca']);
  for (const [tipo, fo] of Object.entries(r.folhas)) {
    salvar(`briga-pixelfx-${tipo === 'acerto-forte' ? 'forte' : tipo}.png`, fo.png);
    fo.n > 0 ? ok(`${tipo}: apareceu (${fo.n} quadros fotografados)`) : falhou(`${tipo}: não apareceu em 60 s`);
    if (fo.n > 0) fo.completa ? ok(`${tipo}: sumiu sozinho em ~${fo.duracao} ms`) : falhou(`${tipo}: não sumiu durante a foto`);
  }
  r.pico <= 24 ? ok(`os efeitos não acumulam (no máximo ${r.pico} vivos)`) : falhou(`efeitos acumulando: ${r.pico}`);
  // (que cada um some sozinho, a folha dele prova acima; parar o piloto não serve: os bichos seguem batendo no coelho)
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();

  // SEM (os de antes), para comparar
  await duda.evaluate(() => localStorage.setItem('syden.brigaPixelfx', 'nao'));
  await duda.reload();
  await duda.locator('.rail-logo').waitFor({ timeout: 30000 });
  await abrirBriga(duda);
  const v = await duda.evaluate(() => window.brigaFxVivos?.() ?? null);
  v === null ? ok('desligado, a Briga usa os efeitos de antes') : falhou(`desligado, mas a camada existe (${v})`);
  await duda.waitForTimeout(4000);
  const a = await folhas(duda, 2000, null);
  salvar('briga-pixelfx-antigo.png', a.folhas.todos.png);
  await duda.getByRole('button', { name: 'Encerrar partida' }).click();
  await duda.evaluate(() => localStorage.removeItem('syden.brigaPixelfx'));
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('briga-pixelfx');
}
