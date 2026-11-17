// BICHOS DA TOCA NO SOLO (16/11/2026), pelo computador do quarto, sem chamada.
//
// - A pessoa abre os Bichos da Toca pela seção Solo do computador e escolhe o primeiro bicho (o Bolhim).
// - Anda pelo campo pelas setas até o mato baixo, e anda no mato até um bicho aparecer (quem sorteia é o servidor).
// - Ganha a primeira luta pelos botões dos golpes: "Vitória!", e o bicho ganhou experiência.
// - Na próxima, cansa o bicho com a Investida e oferece a cenoura até ele virar amigo (sem cenoura, volta à porta de casa para
//   encher a cesta). A equipe fica com dois, e recarregar a página traz a aventura de volta: ela mora no servidor.
//
//   node e2e/bichos.mjs   (API de teste e site de desenvolvimento; SITE=... para outra porta; não precisa do LiveKit)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);
const foto = (pagina, nome) => pagina.locator('.bichos').first().screenshot({ path: path.join(FOTOS, `bichos-${nome}.png`) });

// o mapa vem das regras (uma cópia só para o caminho do teste)
const regras = fs.readFileSync(new URL('../web/src/bichos/regras.ts', import.meta.url), 'utf8');
const MAPA = [...regras.match(/export const MAPA = \[([\s\S]*?)\];/)[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
const andavel = (x, y) => y >= 0 && y < MAPA.length && x >= 0 && x < MAPA[0].length && !'Tr~HC'.includes(MAPA[y][x]);
const TECLA = { c: 'ArrowUp', b: 'ArrowDown', e: 'ArrowLeft', d: 'ArrowRight' };
const PASSO = { c: [0, -1], b: [0, 1], e: [-1, 0], d: [1, 0] };

/** O caminho mais curto (sem pisar no mato nem nas portas, a não ser o destino). */
function caminho(de, ate) {
  const chave = (x, y) => `${x},${y}`;
  const veio = new Map([[chave(de.x, de.y), null]]);
  const fila = [[de.x, de.y]];
  while (fila.length) {
    const [x, y] = fila.shift();
    if (x === ate.x && y === ate.y) break;
    for (const [d, [dx, dy]] of Object.entries(PASSO)) {
      const nx = x + dx, ny = y + dy;
      const destino = nx === ate.x && ny === ate.y;
      if (!andavel(nx, ny) || veio.has(chave(nx, ny))) continue;
      if (!destino && '";hc'.includes(MAPA[ny][nx])) continue;
      veio.set(chave(nx, ny), [x, y, d]);
      fila.push([nx, ny]);
    }
  }
  const dirs = [];
  let k = chave(ate.x, ate.y);
  while (veio.get(k)) {
    const [x, y, d] = veio.get(k);
    dirs.unshift(d);
    k = chave(x, y);
  }
  return dirs;
}

const { browser } = await abrirNavegador();
try {
  const eu = vigiar(await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage());
  await cadastrar(eu, 'bicho' + s);
  await dispensarPresentes(eu);
  const abrir = async () => {
    await eu.locator('.rail-logo').click();
    const quarto = await (await eu.waitForSelector('.quarto-novo iframe', { timeout: 30000 })).contentFrame();
    await quarto.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 60000 });
    await eu.waitForTimeout(1000);
    await quarto.evaluate(() => parent.postMessage({ syden: 'quarto', acao: 'computador' }, location.origin));
    await eu.locator('.area-de-trabalho [data-icone="mini-games"]').click();
    const painel = eu.locator('.jogos-painel');
    await painel.waitFor();
    await painel.locator('.jogos-solo button', { hasText: 'Bichos da Toca' }).click();
  };
  await abrir();
  await eu.locator('.bichos-inicial').waitFor({ timeout: 15000 });
  ok('o computador do quarto abriu os Bichos da Toca na escolha do primeiro bicho');
  await eu.waitForTimeout(1500);
  await foto(eu, 'inicial');
  await eu.locator('.bichos-inicial-cartao', { hasText: 'Bolhim' }).click();
  await eu.locator('.bichos-tela-campo').waitFor({ timeout: 10000 });
  ok('escolheu o Bolhim, e o campo apareceu');
  await eu.waitForTimeout(800);
  await foto(eu, 'campo');

  const estado = () => eu.evaluate(() => window.bichosEstado);
  const ondeEstou = () => eu.evaluate(() => window.bichosDoTeste);

  /** Um passo pela tecla, esperando o servidor responder (ou a luta começar). */
  async function passo(d) {
    const antes = await ondeEstou();
    await eu.keyboard.press(TECLA[d]);
    await eu.waitForFunction(
      ([x, y]) => window.bichosEstado?.fase === 'batalha' || (window.bichosDoTeste && window.bichosDoTeste.fila === 0 && (window.bichosDoTeste.x !== x || window.bichosDoTeste.y !== y)),
      [antes.x, antes.y],
      { timeout: 5000 },
    );
    await eu.waitForTimeout(160);
    return (await estado()).fase === 'batalha';
  }

  async function irPara(x, y) {
    const agora = await ondeEstou();
    for (const d of caminho(agora, { x, y })) if (await passo(d)) return true;
    return false;
  }

  /** Anda no mato baixo, de um lado para o outro, até um bicho aparecer. */
  async function acharBicho() {
    if (await irPara(6, 11)) return;
    for (let i = 0; i < 120; i++) if (await passo(i % 2 ? 'e' : 'd')) return;
    const e = await estado();
    throw new Error(`nenhum bicho apareceu em 120 passos no mato (em ${e.x},${e.y}; na tela ${JSON.stringify(await ondeEstou())})`);
  }

  /** Espera a narração acabar e os botões voltarem. */
  const esperarVez = () => eu.waitForSelector('.bichos-golpes, .bichos-acoes .btn-primary, .bichos-troca', { timeout: 15000 });

  // ---- a primeira luta: vencer
  await acharBicho();
  await eu.locator('.bichos-tela-luta').waitFor();
  const quem = (await estado()).luta.outro.equipe[0].especie;
  ok(`andando pelas setas no mato, apareceu um bicho (${quem})`);
  await eu.waitForTimeout(1200);
  await foto(eu, 'luta');
  const xpAntes = (await estado()).equipe[0].xpDoNivel;
  for (let i = 0; i < 20; i++) {
    await esperarVez();
    const e = await estado();
    if (e.luta?.acabou) break;
    if (e.luta.meu.precisaTrocar) throw new Error('o Bolhim dormiu na primeira luta');
    await eu.locator('.bichos-golpe').nth(1).click();
    await eu.waitForTimeout(300);
  }
  await eu.locator('.bichos-acoes .btn-primary').waitFor({ timeout: 20000 });
  const fim = await estado();
  fim.luta.acabou === 'vitoria' ? ok('a luta acabou em vitória, pelos botões dos golpes') : falhou(`a luta acabou em "${fim.luta.acabou}"`);
  fim.equipe[0].xpDoNivel > xpAntes || fim.equipe[0].nivel > 5 ? ok('o Bolhim ganhou experiência') : falhou('sem experiência');
  await foto(eu, 'vitoria');
  await eu.locator('.bichos-acoes .btn-primary').click();
  await eu.locator('.bichos-tela-campo').waitFor();

  // ---- a amizade
  let amigo = null;
  for (let tentativa = 0; tentativa < 12 && !amigo; tentativa++) {
    if ((await estado()).cenouras <= 0) {
      // a cesta enche na porta de casa
      await irPara(3, 13);
      ok('sem cenoura, voltou à porta de casa para encher a cesta');
    }
    if ((await estado()).equipe[0].pv < 10) await irPara(3, 13);
    await acharBicho();
    for (let i = 0; i < 20; i++) {
      await esperarVez();
      const e = await estado();
      if (e.luta?.acabou) {
        if (e.luta.acabou === 'amigo') amigo = e.luta.outro.equipe[0].especie;
        break;
      }
      if (e.luta.meu.precisaTrocar) {
        await eu.locator('.bichos-troca button:not([disabled])').first().click();
        continue;
      }
      const outro = e.luta.outro.equipe[0];
      if (outro.pv / outro.pvMax <= 0.6 && e.cenouras > 0) await eu.locator('.bichos-cenoura').click();
      else if (outro.pv / outro.pvMax > 0.6) await eu.locator('.bichos-golpe').nth(0).click(); // a Investida, a mais fraca
      else await eu.locator('.bichos-acoes button', { hasText: 'Fugir' }).click();
      await eu.waitForTimeout(300);
    }
    await eu.locator('.bichos-acoes .btn-primary').waitFor({ timeout: 20000 });
    if (amigo) await foto(eu, 'amigo');
    await eu.locator('.bichos-acoes .btn-primary').click();
    await eu.locator('.bichos-tela-campo').waitFor();
  }
  if (!amigo) throw new Error('nenhuma amizade em 12 lutas');
  ok(`ofereceu a cenoura e o ${amigo} virou amigo`);
  const depois = await estado();
  depois.equipe.length === 2 && depois.equipe[1].especie === amigo ? ok('a equipe ficou com dois bichos') : falhou(`a equipe: ${depois.equipe.map((b) => b.especie)}`);
  await eu.waitForTimeout(600);
  await foto(eu, 'equipe');

  // ---- a aventura mora no servidor: recarregar e abrir de novo traz a mesma equipe
  await eu.reload();
  await dispensarPresentes(eu).catch(() => {});
  await abrir();
  await eu.locator('.bichos-tela-campo').waitFor({ timeout: 15000 });
  const volta = await estado();
  volta.equipe.length === 2 ? ok('depois de recarregar, a aventura voltou com os dois bichos') : falhou(`voltou com ${volta.equipe.length}`);
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('bichos da toca');
}
