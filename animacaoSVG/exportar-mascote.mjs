// Exporta as animações do mascote do estúdio (animacoes_d4.html) para dentro do Syden.
//
// O ESTÚDIO É A FONTE. Os arquivos que este script escreve são gerados — mexer neles à mão é perder a
// mudança na próxima exportação. Ajuste no estúdio e rode de novo:
//
//   node animacaoSVG/exportar-mascote.mjs
//
// O que ele escreve:
//   web/public/mascote/<nome>.svg   uma animação por arquivo, para o app usar como imagem (<img>);
//   web/index.html                  a introdução, escrita DENTRO da página da abertura;
//   desktop/src/offline.html        o "sem internet", escrito DENTRO da tela offline do programa.
//
// POR QUE ALGUMAS VÃO ESCRITAS DENTRO DA PÁGINA, e não como imagem: a abertura tem de aparecer no
// primeiro quadro, antes de qualquer arquivo chegar; e a tela offline tem uma política de segurança
// (`default-src 'none'`) que não deixa buscar arquivo nenhum. Escritas dentro da página, as classes e
// animações do SVG valeriam para a página inteira — por isso ganham um prefixo próprio.
//
// O TEXTO DOS ERROS NÃO VAI NO DESENHO. No estúdio o código ("ERRO 404 — …") aparece dentro do SVG
// para visualizar; aqui ele é tirado, e cada tela escreve o código em HTML, no idioma de quem lê.
// Texto preso dentro de um SVG não passaria pela tradução.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ESTUDIO = new URL('./animacoes_d4.html', import.meta.url).href;
const PASTA = RAIZ + 'web/public/mascote/';

/** Os presets que vão para o Syden: o mascote, os modos da sala e os erros. */
const PRESETS = {
  13: 'ocioso',
  14: 'introducao',
  15: 'digitando',
  16: 'falando',
  17: 'ciclo-de-status',
  18: 'ouvindo-musica',
  19: 'karaoke',
  20: 'assistir-junto',
  21: 'apresentacao',
  10: 'sem-internet',
  11: 'erro-500',
  12: 'erro-404',
  22: 'avatar-neutro',
  23: 'avatar-online',
  24: 'avatar-ausente',
  25: 'avatar-ocupado',
  26: 'avatar-offline',
  27: 'avatar-falando',
  28: 'avatar-parou-de-falar',
  29: 'avatar-digitando',
  30: 'avatar-parou-de-digitar',
};

/**
 * O AVATAR É RECORTADO PERTO DA CABEÇA. Ele aparece com 32 px numa lista de membros; com o quadro
 * inteiro, a cabeça teria 12 px. Este quadro (quadrado, de 60 a 340 por 40 a 320) cabe as orelhas em
 * pé, a orelha caída do ausente, os "z", o notebook do ocupado e as orelhas caídas do offline.
 */
const RECORTE_DO_AVATAR = 'viewBox="60 40 280 280"';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find((c) => c && existsSync(c));

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();
await page.goto(ESTUDIO);
// Os padrões do estúdio: velocidade 1x, com movimento, orelha rosa.
await page.evaluate(() => {
  document.getElementById('speedSlider').value = '1';
  document.getElementById('semMovimento').checked = false;
  document.querySelector('input[name="corOrelha"][value="rosa"]').checked = true;
});

/**
 * Presets que também saem no recorte do avatar, com outro nome. O "ouvindo música" é o do karaokê
 * tocando na chamada: todo mundo nela aparece de fone (ver Avatar.tsx). O "assistir junto" é o da
 * sala com transmissão e plateia: quem está assistindo aparece com a pipoca.
 */
const TAMBEM_COMO_AVATAR = { 18: 'avatar-musica', 20: 'avatar-assistindo' };

const svgs = {};
for (const [n, nome] of [...Object.entries(PRESETS), ...Object.entries(TAMBEM_COMO_AVATAR)]) {
  const svg = await page.evaluate((n) => {
    setPreset(Number(n));
    return gerarSVG();
  }, n);
  svgs[nome] = nome.startsWith('avatar-') ? limpar(svg).replace('viewBox="0 30 400 300"', RECORTE_DO_AVATAR) : limpar(svg);
}
await browser.close();

/**
 * Tira o código do erro (vai em HTML) e as linhas em branco que sobram dos trechos opcionais.
 *
 * E CORTA O QUADRO: o estúdio desenha num quadrado de 400, com a faixa do código embaixo. Sem o código,
 * sobravam ~100 de vazio debaixo do coelho, e toda tela ficava com um buraco entre ele e o texto. O
 * recorte (y de 30 a 330) cabe tudo o que os presets do mascote desenham: as pontas das orelhas, os
 * selos de Wi-Fi e servidor, as notas, o balde de pipoca e a barra do karaokê. Fica 4:3.
 */
function limpar(svg) {
  return svg
    .replace('viewBox="0 0 400 400"', 'viewBox="0 30 400 300"')
    .replace(/\s*<g class="codigo">[\s\S]*?<\/g>/, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Prefixa classes e nomes de animação, para o SVG poder morar DENTRO de uma página sem que o estilo
 * dele vaze para ela (no SVG embutido, <style> vale para o documento inteiro).
 */
function prefixar(svg, prefixo) {
  const classes = new Set();
  for (const [, lista] of svg.matchAll(/class="([^"]+)"/g)) for (const c of lista.split(/\s+/)) classes.add(c);
  const animacoes = new Set([...svg.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]));
  const comClasses = svg.replace(/class="([^"]+)"/g, (_, lista) => `class="${lista.split(/\s+/).map((c) => prefixo + c).join(' ')}"`);
  return comClasses.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => {
    const novo = css.replace(/(\.)?(?<![\w-])([a-zA-Z][\w-]*)(?![\w-])/g, (todo, ponto, nome) => {
      if (ponto && classes.has(nome)) return '.' + prefixo + nome;
      if (!ponto && animacoes.has(nome)) return prefixo + nome;
      return todo;
    });
    return `<style>${novo}</style>`;
  });
}

/** Troca o que está entre os marcadores de um arquivo; sem os marcadores, para e diz. */
function trocarEntreMarcadores(arquivo, nome, conteudo) {
  const caminho = RAIZ + arquivo;
  const texto = readFileSync(caminho, 'utf8');
  const ini = `<!-- mascote:${nome} -->`;
  const fim = `<!-- /mascote:${nome} -->`;
  const a = texto.indexOf(ini);
  const b = texto.indexOf(fim);
  if (a < 0 || b < 0) throw new Error(`${arquivo}: faltam os marcadores ${ini} … ${fim}`);
  const recuo = texto.slice(texto.lastIndexOf('\n', a) + 1, a);
  const corpo = conteudo.split('\n').map((l) => recuo + l).join('\n');
  writeFileSync(caminho, texto.slice(0, a + ini.length) + '\n' + corpo + '\n' + recuo + texto.slice(b));
}

const AVISO = '<!-- GERADO por animacaoSVG/exportar-mascote.mjs a partir do estúdio animacoes_d4.html — não edite à mão. -->';

mkdirSync(PASTA, { recursive: true });
for (const [nome, svg] of Object.entries(svgs)) {
  writeFileSync(PASTA + nome + '.svg', svg.replace('<svg ', AVISO + '\n<svg ') + '\n');
  console.log(`  web/public/mascote/${nome}.svg`.padEnd(44) + `${(svg.length / 1024).toFixed(1)} KB`);
}

trocarEntreMarcadores('web/index.html', 'introducao', AVISO + '\n' + prefixar(svgs.introducao, 'ab-'));
console.log('  web/index.html                            a introdução, dentro da abertura');
trocarEntreMarcadores('desktop/src/offline.html', 'sem-internet', AVISO + '\n' + prefixar(svgs['sem-internet'], 'of-'));
console.log('  desktop/src/offline.html                  o sem internet, dentro da tela offline');
