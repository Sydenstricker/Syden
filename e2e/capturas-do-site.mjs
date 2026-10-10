// As imagens da página de apresentação (web/site/), recortadas das capturas da Microsoft Store.
//
// POR QUE RECORTAR AS DA STORE, e não fotografar de novo: elas já existem nos 72 idiomas, já usam a
// comunidade de DEMONSTRAÇÃO (gente e conversa inventadas, ver capturas-da-loja.mjs) e são refeitas
// sempre que a aparência do app muda. Fotografar de novo seria uma segunda rotina para envelhecer.
//
// POR QUE RECORTAR: a captura inteira tem 1920x1080, e no site ela aparece com uns 600 px de largura —
// o texto do app vira formiga. O recorte escolhe a parte que conta a história (a conversa, a sala, o
// guarda-roupa) e a mostra num tamanho em que dá para ler.
//
// POR QUE WEBP: o PNG da Store pesa 100–190 KB; o recorte em WebP pesa um terço disso, e o site abre
// no celular de quem recebeu o link num grupo.
//
//   node e2e/capturas-do-site.mjs              só pt-BR
//   IDIOMAS=en,ja node e2e/capturas-do-site.mjs
//
// Lê e2e/fotos/loja/<idioma>/ e escreve web/site/capturas/<idioma>/<nome>.webp
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const ORIGEM = 'e2e/fotos/loja';
const DESTINO = 'web/site/capturas';
const IDIOMAS = (process.env.IDIOMAS ?? 'pt-BR').split(',');

/** [arquivo da Store, nome no site, recorte x, y, largura, altura em pixels da captura, largura final] */
const RECORTES = [
  ['2-conversa.png', 'conversa', 0, 0, 1100, 880, 1100],
  ['4-chamada.png', 'chamada', 68, 270, 1580, 810, 1260],
  ['3-guarda-roupa.png', 'guarda-roupa', 700, 50, 690, 700, 690],
];

const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const pagina = await navegador.newPage();

for (const idioma of IDIOMAS) {
  mkdirSync(`${DESTINO}/${idioma}`, { recursive: true });
  for (const [arquivo, nome, x, y, l, a, final] of RECORTES) {
    const caminho = `${ORIGEM}/${idioma}/${arquivo}`;
    if (!existsSync(caminho)) {
      console.error(`falta ${caminho}: rode e2e/capturas-da-loja.mjs para este idioma`);
      process.exitCode = 1;
      continue;
    }
    const png = 'data:image/png;base64,' + readFileSync(caminho).toString('base64');
    const webp = await pagina.evaluate(
      async ({ png, x, y, l, a, final }) => {
        const img = new Image();
        img.src = png;
        await img.decode();
        const tela = document.createElement('canvas');
        tela.width = final;
        tela.height = Math.round((a * final) / l);
        const ctx = tela.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, l, a, 0, 0, tela.width, tela.height);
        return tela.toDataURL('image/webp', 0.86);
      },
      { png, x, y, l, a, final },
    );
    const bytes = Buffer.from(webp.split(',')[1], 'base64');
    writeFileSync(`${DESTINO}/${idioma}/${nome}.webp`, bytes);
    console.log(`${idioma}/${nome}.webp  ${(bytes.length / 1024).toFixed(0)} KB`);
  }
}

await navegador.close();
