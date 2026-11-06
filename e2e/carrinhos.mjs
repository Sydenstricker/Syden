// OS CARRINHOS DA TOCA NO SOLO (06/11/2026), pelo computador do quarto, sem chamada.
//
// - A Lia abre os Carrinhos pela seção Solo do computador, escolhe 3 robôs e começa: a pista em 3D, a contagem, os quatro carros.
// - Segura Espaço (acelerador cheio): o carro sai da pista na primeira curva, a tela diz "Saiu da pista!", e ele volta parado.
// - O piloto automático do site de desenvolvimento (window.carrinhosPilotoAutomatico) termina as cinco voltas; o acelerador vai
//   ao servidor, que refaz a corrida, e a tela diz "Novo recorde!" com o tempo DELE (igual ao da tela).
//
//   node e2e/carrinhos.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.carrinhos').first().screenshot({ path: path.join(FOTOS, `carrinhos-${nome}.png`) });

const { browser } = await abrirNavegador();
try {
  const lia = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(lia, 'lia' + s);
  await dispensarPresentes(lia);
  await lia.locator('.rail-logo').click();
  const quarto = await (await lia.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
  await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
  await lia.waitForTimeout(1000);
  await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
  const painel = lia.locator('.jogos-painel');
  await painel.waitFor();
  await painel.locator('.jogos-solo button', { hasText: 'Carrinhos da toca' }).click();
  await lia.locator('.carrinhos-escolha').waitFor({ timeout: 10000 });
  ok('no quarto, sem chamada, os Carrinhos abriram na escolha');
  await foto(lia, 'escolha');
  await lia.locator('.carrinhos-robos button', { hasText: '3' }).click();
  await lia.getByRole('button', { name: 'Começar' }).click();
  await lia.locator('.carrinhos-caixa:not(.escondida)').waitFor({ timeout: 30000 });
  ok('a pista em 3D abriu');
  await lia.waitForTimeout(800);
  await foto(lia, 'largada');

  // o acelerador cheio: sai na curva
  await lia.locator('.carrinhos-moldura').focus().catch(() => {});
  await lia.keyboard.down(' ');
  await lia.waitForFunction(() => (window.carrinhosDoTeste?.saidas ?? 0) >= 1, null, { timeout: 20000 });
  await lia.waitForTimeout(350);
  await foto(lia, 'saiu');
  (await lia.locator('.carrinhos-aviso').count()) > 0 ? ok('acelerando demais, saiu da pista, e a tela diz') : falhou('sem o aviso de saída');
  await lia.keyboard.up(' ');
  await lia.waitForFunction(() => window.carrinhosDoTeste.fora === 0 && window.carrinhosDoTeste.v === 0, null, { timeout: 5000 });
  ok('voltou à pista, parado');

  await lia.evaluate(() => (window.carrinhosPilotoAutomatico = true));
  await lia.waitForTimeout(6000);
  await foto(lia, 'correndo');
  await lia.locator('.carrinhos-fim-solo').waitFor({ timeout: 120_000 });
  const daTela = await lia.evaluate(() => Math.round((window.carrinhosDoTeste.voltas[4] * 1000) / 60));
  const doServidor = await lia.locator('.carrinhos-fim-solo .carrinhos-tempo.grande').innerText();
  const ms = (txt) => {
    const [m, resto] = txt.includes(':') ? txt.split(':') : ['0', txt];
    return Math.round((Number(m) * 60 + Number(resto.replace(',', '.'))) * 1000);
  };
  Math.abs(ms(doServidor) - daTela) < 15 ? ok(`o servidor refez a corrida: ${doServidor}`) : falhou(`a tela tinha ${daTela} ms e o servidor deu ${doServidor}`);
  (await lia.getByText('Novo recorde!').count()) > 0 ? ok('no fim, "Novo recorde!"') : falhou('o fim não disse o recorde');
  (await lia.getByText('Saídas da pista: 1').count()) > 0 ? ok('e conta a saída da pista') : falhou('sem a contagem das saídas');
  await foto(lia, 'fim');
} catch (e) {
  falhou(e.stack ?? String(e));
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(FOTOS, 'carrinhos-erro.png') }).catch(() => {});
} finally {
  await browser.close();
  resumo('carrinhos da toca');
}
