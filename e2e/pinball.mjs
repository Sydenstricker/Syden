// O PINBALL DA HORTA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre o Pinball pela seção Solo do computador e começa: a mesa em pixel art, a bola na mola.
// - Segura Espaço (a mola) e solta: a bola sobe pela raia. As palhetas sobem com ← e →.
// - O piloto automático do site de desenvolvimento (window.pinballPilotoAutomatico) joga as três bolas; os comandos vão ao
//   servidor em trechos, e a tela do fim mostra os pontos DELE (iguais aos da mesa da tela) e "Novo recorde!".
//
//   SITE=http://localhost:5305 node e2e/pinball.mjs   (API de teste e site de desenvolvimento; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.pinball').first().screenshot({ path: path.join(FOTOS, `pinball-${nome}.png`) });

const { browser } = await abrirNavegador();
let lia = null;
try {
  lia = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(lia, 'lia' + s);
  await dispensarPresentes(lia);
  await lia.locator('.rail-logo').click();
  const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await lia.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  await lia.locator('.area-de-trabalho [data-icone="mini-games"]').click();
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Pinball da Horta' }).click();
  await lia.locator('.pinball-escolha').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, o Pinball abriu');
  await foto(lia, 'escolha');
  await lia.getByRole('button', { name: 'Começar' }).click();
  await lia.locator('.pinball-tela').waitFor({ timeout: 10000 });
  await lia.waitForFunction(() => !!window.pinballDoTeste, null, { timeout: 10000 });
  ok('a mesa abriu');
  await lia.waitForTimeout(500);
  await foto(lia, 'mesa');

  // a mola: segurar carrega, soltar lança
  await lia.locator('.pinball-tela').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await lia.keyboard.down(' ');
  await lia.waitForFunction(() => (window.pinballDoTeste?.carga ?? 0) >= 40, null, { timeout: 5000 });
  await foto(lia, 'mola');
  await lia.keyboard.up(' ');
  await lia.waitForFunction(() => window.pinballDoTeste.bolas.some((b) => !b.naMola && b.y < 200), null, { timeout: 5000 });
  ok('a mola lançou a bola raia acima');
  // as palhetas
  await lia.keyboard.down('ArrowLeft');
  await lia.keyboard.down('ArrowRight');
  await lia.waitForFunction(() => window.pinballDoTeste.esq > 15 && window.pinballDoTeste.dir > 15, null, { timeout: 3000 });
  await foto(lia, 'palhetas');
  await lia.keyboard.up('ArrowLeft');
  await lia.keyboard.up('ArrowRight');
  ok('as palhetas sobem com as setas');

  await lia.evaluate(() => (window.pinballPilotoAutomatico = true));
  await lia.waitForTimeout(8000);
  await foto(lia, 'jogando');
  await lia.waitForFunction(() => window.pinballDoTeste.pontos > 0, null, { timeout: 30000 });
  ok('pontuou');
  // a partida até o fim (o piloto automático joga as três bolas)
  await lia.waitForFunction(() => window.pinballDoTeste.terminou, null, { timeout: 15 * 60_000, polling: 1000 });
  const daTela = await lia.evaluate(() => window.pinballDoTeste.pontos);
  await lia.locator('.pinball-fim-pontos').waitFor({ timeout: 20000 });
  const doServidor = Number((await lia.locator('.pinball-fim-pontos').innerText()).replace(/\D/g, ''));
  doServidor === daTela ? ok(`o servidor refez a partida: ${doServidor} pontos`) : falhou(`a mesa tinha ${daTela} e o servidor deu ${doServidor}`);
  (await lia.getByText('Novo recorde!').count()) > 0 ? ok('no fim, "Novo recorde!"') : falhou('o fim não disse o recorde');
  (await lia.locator('.pinball-recordes li').count()) > 0 ? ok('e a lista de recordes mostra o meu') : falhou('sem a lista de recordes');
  await foto(lia, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  await lia?.screenshot({ path: path.join(FOTOS, 'pinball-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('pinball da horta');
}
