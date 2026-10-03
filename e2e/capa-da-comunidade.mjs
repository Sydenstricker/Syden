// A capa da comunidade: foto de verdade na faixa do alto, e o degradê quando não há foto.
//
// "Quero foto de verdade para a comunidade, como mostrei no Midjourney. Vai ficar marcante."
//
// O que este teste mede, e que não se vê olhando uma vez: que a faixa NUNCA fica vazia. Ela tem dois
// estados e os dois têm de desenhar alguma coisa — sem foto, o degradê que o dono escolheu para as
// boas-vindas; com foto, a imagem. E que a versão entra no endereço, senão trocar a capa não muda
// nada na tela de quem já está com o Syden aberto.
//
//   node e2e/capa-da-comunidade.mjs
import { deflateSync } from 'node:zlib';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

/**
 * Um PNG de verdade, montado aqui, para o teste mandar um ARQUIVO pelo seletor em vez de simular.
 *
 * Trinta linhas de codificador em vez de um arquivo no repositório: um .png guardado junto do teste
 * é um binário que ninguém revisa e que fica para sempre. Isto se lê.
 */
function pngDeTeste(largura, altura, [r, g, b]) {
  const bruto = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const linha = y * (largura * 3 + 1);
    bruto[linha] = 0; // filtro "nenhum"
    for (let x = 0; x < largura; x++) {
      bruto[linha + 1 + x * 3] = r;
      bruto[linha + 2 + x * 3] = g;
      bruto[linha + 3 + x * 3] = b;
    }
  }

  const pedaco = (tipo, dados) => {
    const comprimento = Buffer.alloc(4);
    comprimento.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corpo) >>> 0);
    return Buffer.concat([comprimento, corpo, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // cor verdadeira, sem alfa

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(bruto)),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

/** CRC-32, como o PNG pede. Tabela montada na hora; são 256 entradas. */
function crc32(buffer) {
  let c;
  const tabela = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = tabela[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc ^ 0xffffffff;
}

const { browser } = await abrirNavegador({ viewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
vigiar(page);

await criarConta(page, 'capa');
await dispensarPresentes(page);

// O TESTE CRIA A PRÓPRIA COMUNIDADE, e isto não é cerimônia: a capa só pode ser trocada por quem
// administra, e uma conta nova entra nas comunidades dos outros como membro comum. Rodando contra um
// banco já usado, a conta não seria dona de nada e a aba inteira não apareceria — o teste reprovaria
// por causa do banco, que é o pior tipo de reprovação.
await page.getByRole('button', { name: 'Adicionar comunidade' }).click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill('Capa ' + Date.now().toString().slice(-5));
await page.locator('.dialog .btn-primary').click();
await page.locator('.channel-list').waitFor({ timeout: 20000 });
await page.waitForTimeout(1200);

// ---------- sem foto: o degradê ----------
const semFoto = await page.evaluate(() => {
  const capa = document.querySelector('.sidebar-header .capa');
  if (!capa) return null;
  const e = getComputedStyle(capa);
  return { comFoto: capa.classList.contains('com-foto'), fundo: e.backgroundImage.slice(0, 40), altura: Math.round(capa.getBoundingClientRect().height) };
});
if (!semFoto) {
  falhou('não achei a capa no cabeçalho da barra lateral');
} else {
  !semFoto.comFoto ? ok('sem foto, a faixa usa o degradê das boas-vindas') : falhou('a faixa diz ter foto antes de alguém mandar uma');
  semFoto.fundo.startsWith('linear-gradient') ? ok(`e o degradê está pintado (${semFoto.fundo}…)`) : falhou(`fundo inesperado: ${semFoto.fundo}`);
  semFoto.altura >= 80 ? ok(`a faixa tem altura de faixa: ${semFoto.altura}px`) : falhou(`a faixa ficou com ${semFoto.altura}px — é uma listra`);
}
await page.screenshot({ path: 'e2e/fotos/capa-sem-foto.png', clip: { x: 0, y: 0, width: 420, height: 330 } });

// ---------- manda uma capa de verdade ----------
// O caminho de verdade é pela tela: Configurações → Comunidade → Enviar uma capa. Mandar pela API
// daqui pularia justamente o que se quer medir, que é o botão existir e funcionar.
await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab').first().waitFor({ timeout: 10000 });
const abaComunidade = page.locator('.settings-tab', { hasText: /Comunidade/ });
if ((await abaComunidade.count()) === 0) {
  falhou('não achei a aba Comunidade (a conta pode não administrar nenhuma)');
} else {
  await abaComunidade.first().click();
  await page.waitForTimeout(800);

  const temEditor = await page.locator('.capa-previa').count();
  temEditor === 1 ? ok('a prévia da capa aparece nas Configurações da comunidade') : falhou('não achei a prévia da capa');

  const botao = page.getByText(/Enviar uma capa|Trocar a capa/).first();
  (await botao.count()) > 0 ? ok('e o botão de enviar está lá') : falhou('não achei o botão de enviar a capa');

  // O ENVIO DE VERDADE. O seseletor de arquivo do Syden esconde um <input type="file">; é nele que
  // o Playwright põe o arquivo, que é o mesmo que a pessoa faz ao escolher no disco.
  const entrada = page.locator('.capa-previa-caixa ~ .account-actions input[type="file"]').first();
  await entrada.setInputFiles({ name: 'capa.png', mimeType: 'image/png', buffer: pngDeTeste(600, 150, [122, 31, 162]) });
  await page.waitForTimeout(3000);

  const depoisDoEnvio = await page.evaluate(() => {
    const capa = document.querySelector('.sidebar-header .capa');
    return capa ? { comFoto: capa.classList.contains('com-foto'), fundo: getComputedStyle(capa).backgroundImage.slice(0, 60) } : null;
  });
  console.log('  faixa depois do envio:', JSON.stringify(depoisDoEnvio));

  depoisDoEnvio?.comFoto
    ? ok('a capa enviada virou a faixa da barra lateral')
    : falhou('a faixa não trocou para a foto depois do envio');

  // A VERSÃO TEM DE ESTAR NO ENDEREÇO: sem ela, trocar a capa não mudaria nada para quem já está
  // com o Syden aberto — o navegador serviria a antiga do cache, e para sempre.
  /\?v=\d+/.test(depoisDoEnvio?.fundo ?? '')
    ? ok('e o endereço traz a versão, para o navegador buscar a nova')
    : falhou(`sem versão no endereço: ${depoisDoEnvio?.fundo}`);

  await page.screenshot({ path: 'e2e/fotos/capa-configuracoes.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/fotos/capa-na-barra.png', clip: { x: 0, y: 0, width: 420, height: 330 } });
}

await browser.close();
resumo('a capa da comunidade');
