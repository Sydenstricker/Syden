// Prova que a janela destacada abre, copia o estilo e mostra o vídeo ao vivo.
//
// POR QUE UM TESTE PRÓPRIO. A Document Picture-in-Picture API é nova, abre uma JANELA DE VERDADE e não
// dá para conferi-la olhando a página: o conteúdo vive noutro documento. Os três jeitos de ela falhar
// são silenciosos — a janela abre vazia porque o estilo não foi junto; abre com o vídeo preto porque o
// MediaStream não passou; ou nem abre porque o navegador exige um gesto da pessoa e o clique não contou.
//
// O vídeo aqui é falso (um canvas pintando quadrados), e isso é de propósito: um teste que precisasse de
// uma chamada de verdade dependeria de servidor, de conta e de outra pessoa do outro lado.
//
//   node e2e/janela-destacada.mjs
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const PAGINA = `
<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<style>.marca-do-syden { color: rgb(88, 101, 242); }</style>
</head><body>
  <video id="fonte" autoplay muted playsinline></video>
  <button id="abrir">destacar</button>
  <script type="module">
    // Um vídeo falso: canvas pintando, virado em MediaStream. Serve igual para o navegador.
    const tela = document.createElement('canvas');
    tela.width = 320; tela.height = 180;
    const ctx = tela.getContext('2d');
    let n = 0;
    setInterval(() => {
      ctx.fillStyle = n++ % 2 ? '#e8730c' : '#5865f2';
      ctx.fillRect(0, 0, 320, 180);
    }, 100);
    document.getElementById('fonte').srcObject = tela.captureStream(10);

    window.abriu = null;
    document.getElementById('abrir').onclick = async () => {
      const origem = document.getElementById('fonte');
      const janela = await window.documentPictureInPicture.requestWindow({ width: 320, height: 180 });

      for (const folha of Array.from(document.styleSheets)) {
        try {
          const estilo = janela.document.createElement('style');
          estilo.textContent = Array.from(folha.cssRules).map((r) => r.cssText).join('\\n');
          janela.document.head.append(estilo);
        } catch {}
      }
      janela.document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme'));

      const v = janela.document.createElement('video');
      v.autoplay = true; v.muted = true; v.playsInline = true;
      v.srcObject = origem.srcObject;
      const nome = janela.document.createElement('span');
      nome.className = 'marca-do-syden';
      nome.textContent = 'helena';
      janela.document.body.append(v, nome);
      await v.play().catch(() => {});
      window.abriu = janela;
    };
  </script>
</body></html>`;

const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const problemas = [];
page.on('pageerror', (e) => problemas.push('erro de JS: ' + e.message));

// SERVIDO POR localhost, E NÃO POR data: — descoberto por este teste falhando.
// A Document Picture-in-Picture API só existe em contexto seguro, e um data: URL tem origem opaca, que
// não conta como seguro. O sintoma foi enganoso: a API simplesmente não estava lá, como se o navegador
// não a tivesse. localhost conta como seguro por definição, sem precisar de certificado.
const servidor = createServer((_pedido, resposta) => {
  resposta.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  resposta.end(PAGINA);
});
await new Promise((pronto) => servidor.listen(4322, pronto));

await page.goto('http://localhost:4322/');
await page.waitForTimeout(600);

const temApi = await page.evaluate(() => typeof window.documentPictureInPicture?.requestWindow === 'function');
console.log('');
console.log(`  ${temApi ? 'OK ' : 'XX '} o navegador tem a Document Picture-in-Picture API`);
if (!temApi) {
  problemas.push('sem a API: o botão não apareceria neste navegador (é o comportamento certo, mas não dá para testar o resto)');
} else {
  // O clique de verdade importa: a API exige gesto da pessoa, e chamar por script é justamente o que
  // ela recusa. Clicar pelo Playwright conta como gesto.
  await page.click('#abrir');
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const j = window.abriu;
    if (!j) return null;
    const v = j.document.querySelector('video');
    const nome = j.document.querySelector('.marca-do-syden');
    return {
      temVideo: Boolean(v),
      largura: v?.videoWidth ?? 0,
      altura: v?.videoHeight ?? 0,
      tocando: v ? !v.paused && v.readyState >= 2 : false,
      // Se o estilo tivesse ficado para trás, a cor seria o preto padrão do navegador.
      corDoNome: nome ? j.getComputedStyle(nome).color : '',
      tema: j.document.documentElement.getAttribute('data-theme'),
      // Mesmo MediaStream nos dois documentos, sem reconectar nada.
      mesmoFluxo: v?.srcObject === document.getElementById('fonte').srcObject,
    };
  });

  if (!m) {
    problemas.push('a janela não abriu');
    console.log('  XX  a janela abriu');
  } else {
    const checa = (ok, texto, detalhe = '') => {
      console.log(`  ${ok ? 'OK ' : 'XX '} ${texto}${detalhe ? '   ' + detalhe : ''}`);
      if (!ok) problemas.push(texto);
    };
    checa(m.temVideo, 'a janela abriu com um vídeo dentro');
    checa(m.largura > 0 && m.altura > 0, 'o vídeo tem imagem', `${m.largura}x${m.altura}`);
    checa(m.tocando, 'o vídeo está tocando, e não parado num quadro');
    checa(m.mesmoFluxo, 'é o MESMO fluxo da janela principal — nada foi reconectado');
    checa(m.corDoNome === 'rgb(88, 101, 242)', 'o CSS do Syden foi junto', m.corDoNome);
    checa(m.tema === 'dark', 'o tema escolhido foi junto', String(m.tema));
  }
}

await browser.close();
servidor.close();

console.log('');
if (problemas.length) {
  console.log('PROBLEMAS:');
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log('A janela destacada abre com estilo, tema e vídeo ao vivo.');
