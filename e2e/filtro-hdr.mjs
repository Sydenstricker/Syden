// A CORREÇÃO DE HDR DA TRANSMISSÃO (27/11/2026): passa a imagem que CHEGOU a quem assistia a uma transmissão com o HDR ligado (a
// captura que ele mandou) pelo processador de faixa de verdade, no navegador (faixa de entrada -> shader de WebGL2 -> faixa de
// saída), e confere:
//   - o shader dá o mesmo que a conta em JavaScript (corrigirPixel), pixel a pixel, e a imagem não vem de cabeça para baixo;
//   - desligado, o quadro passa sem mudar; o branco continua branco;
//   - a dica de conteúdo (movimento ou detalhe) que a otimização da transmissão muda na origem chega à faixa de saída;
//   - a intensidade muda na hora, sem reiniciar o processador.
// Grava em e2e/fotos/hdr/ a imagem de antes e a de depois, para olhar.
//
//   node e2e/filtro-hdr.mjs [caminho da imagem]   (site de teste na 5174)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { abrirNavegador, falhou, ok, resumo } from './ajuda.mjs';

const imagem = process.argv[2] ?? 'e2e/hdr/transmissao.png';
mkdirSync('e2e/fotos/hdr', { recursive: true });
const { browser } = await abrirNavegador();
const page = await browser.newPage();
try {
  await page.goto('http://localhost:5174/app/');
  const b64 = readFileSync(imagem).toString('base64');
  const r = await page.evaluate(async (b64) => {
    const { ProcessadorDoHdr, corrigirPixel, kDaIntensidade } = await import('/app/src/correcaoHdr.ts');
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const origem = new OffscreenCanvas(img.width, img.height);
    const octx = origem.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    const original = octx.getImageData(0, 0, img.width, img.height);

    // a faixa de entrada: um canvas que repete a imagem, como a captura de tela entrega quadros
    const tela = document.createElement('canvas');
    tela.width = img.width;
    tela.height = img.height;
    tela.getContext('2d').drawImage(img, 0, 0);
    const faixa = tela.captureStream(30).getVideoTracks()[0];
    const repetir = setInterval(() => tela.getContext('2d').drawImage(img, 0, 0), 33);

    let filtro = { ligado: true, intensidade: 0.4 };
    const proc = new ProcessadorDoHdr(() => filtro);
    await proc.init({ track: faixa, kind: 'video' });
    const leitor = new MediaStreamTrackProcessor({ track: proc.processedTrack }).readable.getReader();

    const lerQuadro = async () => {
      // descarta os primeiros (o filtro pode ter ligado depois) e fica com um que já saiu com a configuração de agora
      let quadro;
      for (let i = 0; i < 4; i++) {
        quadro?.close();
        const { value } = await leitor.read();
        quadro = value;
      }
      const c = new OffscreenCanvas(quadro.displayWidth, quadro.displayHeight);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(quadro, 0, 0);
      const largura = quadro.displayWidth;
      const altura = quadro.displayHeight;
      quadro.close();
      return { dados: g.getImageData(0, 0, largura, altura), largura, altura, canvas: c };
    };
    // Compara a saída com a conta só nas ÁREAS PLANAS da imagem (a vizinhança 5 × 5 da origem não muda): a faixa de saída é
    // codificada em YUV 4:2:0, e nas bordas de cor a subamostragem do croma borra o que o shader fez certo.
    const comparar = (saida, k) => {
      const L = saida.largura, A = saida.altura;
      const plano = (x, y) => {
        const c = (y * L + x) * 4;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const o = ((y + dy) * L + (x + dx)) * 4;
          if (Math.abs(original.data[o] - original.data[c]) > 2 || Math.abs(original.data[o + 1] - original.data[c + 1]) > 2 || Math.abs(original.data[o + 2] - original.data[c + 2]) > 2) return false;
        }
        return true;
      };
      let maior = 0, fora = 0, n = 0, soma = 0, bordas = 0;
      const hist = { 'até 1': 0, 'até 3': 0, 'mais de 3': 0 };
      for (let y = 4; y < A - 4; y += 3) for (let x = 4; x < L - 4; x += 5) {
        if (!plano(x, y)) { bordas++; continue; }
        const p = (y * L + x) * 4;
        const e = corrigirPixel([original.data[p], original.data[p + 1], original.data[p + 2]], k);
        const d = Math.max(Math.abs(saida.dados.data[p] - e[0]), Math.abs(saida.dados.data[p + 1] - e[1]), Math.abs(saida.dados.data[p + 2] - e[2]));
        maior = Math.max(maior, d);
        soma += d;
        if (d > 3) fora++;
        hist[d <= 1 ? 'até 1' : d <= 3 ? 'até 3' : 'mais de 3']++;
        n++;
      }
      return { maior, foraDoLimite: fora, amostras: n, mediaDaDiferenca: +(soma / n).toFixed(2), hist, pixelsDeBorda: bordas };
    };
    const estatisticas = (dados) => {
      let luz = 0, estourado = 0, n = 0;
      for (let i = 0; i < dados.data.length; i += 4 * 7) {
        const R = dados.data[i], G = dados.data[i + 1], B = dados.data[i + 2];
        luz += 0.2126 * R + 0.7152 * G + 0.0722 * B;
        if (Math.min(R, G, B) >= 250) estourado++;
        n++;
      }
      return { luminanciaMedia: Math.round(luz / n), pctEstourado: +((100 * estourado) / n).toFixed(1) };
    };
    const png = async (canvas) => {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    };

    const saida = {};
    // 1. ligado, 40% (o padrão)
    const a = await lerQuadro();
    saida.padrao = { tamanho: [a.largura, a.altura], ...comparar(a, kDaIntensidade(0.4)), antes: estatisticas(original), depois: estatisticas(a.dados) };
    saida.pngPadrao = await png(a.canvas);
    // 2. a intensidade muda na hora
    filtro = { ligado: true, intensidade: 1 };
    const b = await lerQuadro();
    saida.maxima = { ...comparar(b, kDaIntensidade(1)), depois: estatisticas(b.dados) };
    saida.pngMaxima = await png(b.canvas);
    // 3. desligado: o quadro passa como veio
    filtro = { ligado: false, intensidade: 0.4 };
    const c = await lerQuadro();
    saida.desligado = comparar(c, 1);
    // 4. a dica de conteúdo da origem chega à saída
    faixa.contentHint = 'detail';
    await lerQuadro();
    saida.dicaNaSaida = proc.processedTrack.contentHint;
    faixa.contentHint = 'motion';
    await lerQuadro();
    saida.dicaDepois = proc.processedTrack.contentHint;

    clearInterval(repetir);
    await proc.destroy();
    faixa.stop();
    return saida;
  }, b64);

  writeFileSync('e2e/fotos/hdr/depois-40.png', Buffer.from(r.pngPadrao, 'base64'));
  writeFileSync('e2e/fotos/hdr/depois-100.png', Buffer.from(r.pngMaxima, 'base64'));
  writeFileSync('e2e/fotos/hdr/antes.png', readFileSync(imagem));
  console.log(JSON.stringify({ padrao: r.padrao, maxima: r.maxima, desligado: r.desligado }, null, 1));

  r.padrao.foraDoLimite <= r.padrao.amostras * 0.01 && r.padrao.mediaDaDiferenca < 1.5 ? ok(`o shader dá o mesmo que a conta nas áreas planas (diferença média ${r.padrao.mediaDaDiferenca}, maior ${r.padrao.maior}, em ${r.padrao.amostras} pixels)`) : falhou(`o shader difere da conta: média ${r.padrao.mediaDaDiferenca}, maior ${r.padrao.maior}, ${r.padrao.foraDoLimite} de ${r.padrao.amostras} fora`);
  r.maxima.foraDoLimite <= r.maxima.amostras * 0.01 && r.maxima.mediaDaDiferenca < 1.5 ? ok('a intensidade nova vale na hora, sem reiniciar') : falhou('a intensidade não mudou');
  r.desligado.foraDoLimite <= r.desligado.amostras * 0.01 ? ok('desligado, o quadro passa como veio') : falhou(`desligado mudou o quadro (maior diferença ${r.desligado.maior})`);
  r.padrao.depois.luminanciaMedia < r.padrao.antes.luminanciaMedia ? ok(`a luminância média caiu de ${r.padrao.antes.luminanciaMedia} para ${r.padrao.depois.luminanciaMedia}`) : falhou('a luminância não caiu');
  r.dicaNaSaida === 'detail' && r.dicaDepois === 'motion' ? ok('a dica de conteúdo da origem chega à faixa de saída') : falhou(`dica na saída: ${r.dicaNaSaida} / ${r.dicaDepois}`);
} catch (e) {
  falhou('exceção: ' + e.message);
} finally {
  await browser.close();
  resumo();
}
