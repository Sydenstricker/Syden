// A WEBCAM FALSA DO CHROME (ver README.md, "Vídeo"): confere que um vídeo do Commons, convertido em .y4m, chega à página
// pelo getUserMedia como se fosse a câmera. É o caminho de um e2e futuro do fundo da câmera no app, sem webcam na máquina.
//   node e2e/fundo-da-camera/camera-falsa.mjs      (precisa do ffmpeg e de baixar.mjs antes)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { VIDEOS } from './lista.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const v = VIDEOS[0];
const y4m = join(AQUI, 'resultados', 'video', `${v.id}.y4m`);
mkdirSync(dirname(y4m), { recursive: true });
// 5 s bastam; o Chrome repete o arquivo em laço. O .y4m é cru (~1,4 MB por segundo a 640 × 360 e 15 qps) e é apagado no fim.
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(v.inicio), '-t', '5', '-i', join(AQUI, 'videos', v.arquivo), '-vf', 'fps=15,scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-pix_fmt', 'yuv420p', y4m]);
if (r.status !== 0 || !existsSync(y4m)) throw new Error('ffmpeg: ' + r.stderr);

const navegador = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
});
const pagina = await navegador.newPage();
// o getUserMedia só existe em contexto seguro: uma página https servida pelo próprio playwright, sem rede
await pagina.route('https://camera.teste/', (rota) => rota.fulfill({ contentType: 'text/html', body: '<!doctype html><title>c</title>' }));
await pagina.goto('https://camera.teste/');
const res = await pagina.evaluate(async () => {
  const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
  const faixa = s.getVideoTracks()[0];
  const v = document.createElement('video');
  v.muted = true;
  v.srcObject = s;
  await v.play();
  await new Promise((ok) => setTimeout(ok, 1500));
  // dois quadros com 0,5 s de intervalo: se o vídeo anda, eles diferem; o padrão verde da câmera falsa sem arquivo seria outro
  const c = new OffscreenCanvas(v.videoWidth, v.videoHeight), g = c.getContext('2d');
  const quadro = () => {
    g.drawImage(v, 0, 0);
    return g.getImageData(0, 0, c.width, c.height).data;
  };
  const a = quadro();
  await new Promise((ok) => setTimeout(ok, 500));
  const b = quadro();
  let dif = 0, soma = 0;
  for (let i = 0; i < a.length; i += 4) {
    dif += Math.abs(a[i] - b[i]);
    soma += a[i] + a[i + 1] + a[i + 2];
  }
  return { rotulo: faixa.label, config: faixa.getSettings(), tamanho: [v.videoWidth, v.videoHeight], brilhoMedio: soma / (a.length / 4) / 3, mudancaMedia: dif / (a.length / 4) };
});
await navegador.close();
rmSync(y4m);
console.log(JSON.stringify(res, null, 2));
const ok = res.tamanho[0] === 640 && res.tamanho[1] === 360 && res.mudancaMedia > 0.5;
console.log(ok ? 'a câmera falsa entrega o vídeo' : 'FALHOU: a câmera falsa não entregou o vídeo');
process.exit(ok ? 0 : 1);
