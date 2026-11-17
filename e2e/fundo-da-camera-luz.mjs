// A LUZ QUE ACENDE E APAGA (17/11/2026, pedido dele: "um vídeo alternando, simulando o usuário ligando e desligando a luz, para
// testar se essa troca de modelos vai ser suave").
//
// O app de verdade com a câmera falsa tocando um vídeo que alterna, de PERIODO em PERIODO segundos, entre a luz acesa e o quarto
// escuro (o mesmo escurecer e o mesmo ruído do estudo, e2e/fundo-da-camera/medir-video.mjs). A troca é seca, como um interruptor
// (o pior caso: a webcam de verdade ainda leva um tempo ajustando a exposição). Com o fundo APAGADO, grava cada quadro que vai
// para a chamada em três rodadas:
//   - Automático: o Completo na luz e o Leve no escuro, com a troca de modelo (decisor.js, criarLuz);
//   - Leve sempre e Completo sempre: sem troca de modelo, para separar o que é a TROCA do que é a LUZ mudando.
// Mede, quadro a quadro, quanto da máscara mudou (a grade de 80 × 45 do "é fundo apagado?") e se a pessoa ficou inteira (o meio).
// O que interessa: o pico de mudança no quadro da troca de modelo do Automático, comparado com o pico da luz mudando nas rodadas
// sem troca. Grava um vídeo por rodada com o modelo e a luz no canto, e a página resultados/luz.html com os três lado a lado.
//
//   API de teste na 3099, site na 5174 e LiveKit local; ffmpeg no PATH; o PC parado
//   node e2e/fundo-da-camera-luz.mjs          (PERIODO=5 por padrão; RODADA=automatico só uma)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = 'http://localhost:3099';
const VIDEO = resolve('e2e/fundo-da-camera/videos/mensagem-hackathon.webm');
if (!existsSync(VIDEO)) throw new Error('falta o vídeo de teste: node e2e/fundo-da-camera/baixar.mjs');
const PERIODO = Number(process.env.PERIODO ?? 5);
const DURACAO = PERIODO * 4; // acesa, apagada, acesa, apagada
const SAIDA = resolve('e2e/fundo-da-camera/resultados/luz');
mkdirSync(SAIDA, { recursive: true });

const pasta = mkdtempSync(join(tmpdir(), 'syden-luz-'));
const y4m = join(pasta, 'camera.y4m');
// o escuro do estudo (gama 1,8, teto em 90, o ruído de quem sobe o ganho), só na segunda metade de cada ciclo
const apagada = `gte(mod(t\\,${2 * PERIODO})\\,${PERIODO})`;
const filtro = `fps=15,scale=640:360:force_original_aspect_ratio=increase,crop=640:360,format=rgb24,lutrgb=r='pow(val/255\\,1.8)*90':g='pow(val/255\\,1.8)*90':b='pow(val/255\\,1.8)*90':enable='${apagada}',noise=c0s=22:c1s=14:c2s=14:allf=t:enable='${apagada}'`;
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '3', '-t', String(DURACAO), '-i', VIDEO, '-vf', filtro, '-pix_fmt', 'yuv420p', y4m]);
if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
// o brilho médio da entrada em cada metade, para conferir que cruza os limites do decisor (escuro abaixo de 85, claro acima de 100)
{
  const cru = spawnSync('ffmpeg', ['-v', 'error', '-i', y4m, '-vf', 'scale=64:36', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 28 }).stdout;
  const n = cru.length / (64 * 36);
  const medias = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < 64 * 36; k++) s += cru[i * 64 * 36 + k];
    medias.push(s / (64 * 36));
  }
  const fatia = (a, b) => medias.slice(Math.floor(a * 15) + 2, Math.floor(b * 15) - 2);
  const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`  a entrada: acesa ~${media(fatia(0, PERIODO)).toFixed(0)}, apagada ~${media(fatia(PERIODO, 2 * PERIODO)).toFixed(0)} de brilho médio (o decisor: escuro abaixo de 85, claro acima de 100)`);
}

const pedir = async (metodo, rota, token, corpo) => {
  const res = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(metodo + ' ' + rota + ': ' + res.status + ' ' + JSON.stringify(j));
  return j;
};
const nome = 'luz' + Date.now().toString(36).slice(-6);
await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
const { token } = await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' });
const comunidade = await pedir('POST', '/api/communities', token, { name: 'Luz ' + nome.slice(-4) });

const env = { ...process.env, SYDEN_URL: 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: join(pasta, 'dados') };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  executablePath: resolve('node_modules/electron/dist/electron.exe'),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`, resolve('desktop')],
  env,
});
const page = vigiar(await app.firstWindow());
await app.context().addInitScript((tk) => localStorage.setItem('janja.token', tk), token);
await page.waitForLoadState('domcontentloaded');
await page.reload();
await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click({ timeout: 60000 });
for (let i = 0; i < 6; i++) {
  const f = page.getByRole('button', { name: 'Fechar', exact: true });
  if (await f.first().isVisible().catch(() => false)) await f.first().click();
  else if (i > 2) break;
  await page.waitForTimeout(600);
}
await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
await page.locator('.stage-controls').waitFor({ timeout: 30000 });
await page.locator('.stage-controls button[aria-label="Ligar câmera"]').click();
await page.waitForTimeout(3000);

async function configurar(fundo, recorte) {
  await page.locator('button[aria-label="Configurações"]').first().click();
  await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
  if (fundo) await page.locator('.fundo-da-camera .effect-option', { hasText: new RegExp('^' + fundo + '$') }).click();
  if (recorte) await page.locator('.fundo-da-camera-qualidade .chip-opcao', { hasText: new RegExp('^' + recorte + '$') }).click();
  await page.keyboard.press('Escape');
}
await configurar('Apagado', 'Automático');
await page.waitForTimeout(4000);
ok('na sala, com a câmera ligada e o fundo apagado');

/**
 * Grava, pela página, cada quadro novo do vídeo da própria câmera (requestVideoFrameCallback) por `segundos`: o modelo da vez,
 * a grade do fundo apagado (80 × 45, 1 = cinza do fundo), o brilho da pessoa, e o quadro em JPEG com o modelo e a luz no canto.
 */
const gravar = (segundos, rotulo) =>
  page.evaluate(
    async ({ segundos, rotulo }) => {
      const v = [...document.querySelectorAll('video')].find((x) => x.srcObject?.getVideoTracks?.()[0] && x.videoWidth >= 320);
      const W = v.videoWidth, H = v.videoHeight;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      const p = document.createElement('canvas');
      p.width = 80;
      p.height = 45;
      const gp = p.getContext('2d', { willReadFrequently: true });
      const quadros = [];
      const t0 = performance.now();
      await new Promise((fim) => {
        const um = () => {
          const t = performance.now() - t0;
          if (t > segundos * 1000) return fim();
          g.drawImage(v, 0, 0);
          gp.drawImage(c, 0, 0, 80, 45);
          const d = gp.getImageData(0, 0, 80, 45).data;
          const grade = new Array(80 * 45);
          for (let i = 0; i < grade.length; i++) {
            const [r, gg, b] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
            grade[i] = Math.abs(r - 41) < 10 && Math.abs(gg - 43) < 10 && Math.abs(b - 48) < 10 ? 1 : 0;
          }
          // o meio (a pessoa): o quanto virou fundo, e o brilho dela (que diz se a luz está acesa)
          const m = g.getImageData(Math.round(0.42 * W), Math.round(0.4 * H), Math.round(0.16 * W), Math.round(0.25 * H)).data;
          let fundoNoMeio = 0, brilho = 0;
          for (let i = 0; i < m.length; i += 4) {
            if (Math.abs(m[i] - 41) < 10 && Math.abs(m[i + 1] - 43) < 10 && Math.abs(m[i + 2] - 48) < 10) fundoNoMeio++;
            brilho += (m[i] + m[i + 1] + m[i + 2]) / 3;
          }
          const nivel = globalThis.sydenFundoDaCamera?.nivel ?? '?';
          const modelo = nivel === 'refinado' ? 'Completo' : nivel === 'modesto' ? 'Leve' : nivel;
          g.fillStyle = 'rgba(0,0,0,.7)';
          g.fillRect(6, 6, 300, 44);
          g.fillStyle = nivel === 'refinado' ? '#7fd4ff' : '#ffd27f';
          g.font = 'bold 16px system-ui';
          g.fillText(`${rotulo} → ${modelo}`, 14, 25);
          g.fillStyle = '#fff';
          g.font = '13px system-ui';
          g.fillText(`${(t / 1000).toFixed(1)} s · pessoa com brilho ${(brilho / (m.length / 4)).toFixed(0)}`, 14, 43);
          quadros.push({ t, nivel, grade, fundoNoMeio: fundoNoMeio / (m.length / 4), brilho: brilho / (m.length / 4), jpg: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
          v.requestVideoFrameCallback(um);
        };
        v.requestVideoFrameCallback(um);
      });
      return quadros;
    },
    { segundos, rotulo },
  );

const RODADAS = [
  { id: 'automatico', recorte: 'Automático', rotulo: 'Automático' },
  { id: 'leve', recorte: 'Leve', rotulo: 'Leve sempre' },
  { id: 'completo', recorte: 'Completo', rotulo: 'Completo sempre' },
].filter((x) => !process.env.RODADA || x.id === process.env.RODADA);

const resultados = [];
for (const rodada of RODADAS) {
  await configurar(null, rodada.recorte);
  await page.waitForTimeout(2000);
  const quadros = await gravar(DURACAO + 1, rodada.rotulo);
  // a mudança da máscara de um quadro para o outro (fração da grade que trocou de lado)
  const muda = quadros.map((q, i) => (i ? q.grade.reduce((s, x, k) => s + (x !== quadros[i - 1].grade[k] ? 1 : 0), 0) / q.grade.length : 0));
  // a luz pela pessoa: acesa quando o brilho do meio passa da metade entre o mais escuro e o mais claro da gravação
  const bs = quadros.map((q) => q.brilho);
  const corte = (Math.min(...bs) + Math.max(...bs)) / 2;
  const acesa = bs.map((b) => b > corte);
  const trocasDeLuz = acesa.flatMap((a, i) => (i && a !== acesa[i - 1] ? [i] : []));
  const trocasDeModelo = quadros.flatMap((q, i) => (i && q.nivel !== quadros[i - 1].nivel ? [i] : []));
  const pico = (i) => Math.max(...muda.slice(i, i + 3));
  const longe = muda.filter((_, i) => i > 2 && [...trocasDeLuz, ...trocasDeModelo].every((k) => Math.abs(i - k) > 5));
  const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;
  const pessoaPior = Math.max(...quadros.map((q) => q.fundoNoMeio));
  const res = {
    id: rodada.id,
    rotulo: rodada.rotulo,
    quadros: quadros.length,
    qps: quadros.length / ((quadros.at(-1).t - quadros[0].t) / 1000),
    calmo: { mediana: mediana(longe), p95: p95(longe) },
    luz: trocasDeLuz.map((i) => ({ t: quadros[i].t / 1000, acendeu: acesa[i], pico: pico(i) })),
    modelo: trocasDeModelo.map((i) => {
      const luzAntes = trocasDeLuz.filter((k) => k <= i).at(-1);
      return { t: quadros[i].t / 1000, para: quadros[i].nivel, atrasoDaLuz: luzAntes !== undefined ? (quadros[i].t - quadros[luzAntes].t) / 1000 : null, pico: pico(i) };
    }),
    pessoaPior,
  };
  resultados.push(res);
  console.log(`  ${rodada.rotulo}: ${res.quadros} quadros (${res.qps.toFixed(1)} por segundo); mudança da máscara sem troca nenhuma: mediana ${(res.calmo.mediana * 100).toFixed(2)}%, p95 ${(res.calmo.p95 * 100).toFixed(2)}%`);
  for (const l of res.luz) console.log(`    ${l.t.toFixed(1)} s a luz ${l.acendeu ? 'acendeu' : 'apagou'}: pico de ${(l.pico * 100).toFixed(2)}% da máscara`);
  for (const m of res.modelo) console.log(`    ${m.t.toFixed(1)} s trocou para o ${m.para === 'refinado' ? 'Completo' : 'Leve'} (${m.atrasoDaLuz?.toFixed(1)} s depois da luz): pico de ${(m.pico * 100).toFixed(2)}% da máscara`);
  console.log(`    o pior quadro da pessoa: ${(pessoaPior * 100).toFixed(1)}% do meio virou fundo`);

  // o vídeo da rodada
  const pq = join(pasta, rodada.id);
  mkdirSync(pq, { recursive: true });
  quadros.forEach((q, i) => writeFileSync(join(pq, String(i).padStart(4, '0') + '.jpg'), Buffer.from(q.jpg, 'base64')));
  const qps = Math.round(res.qps);
  const f = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(qps), '-i', join(pq, '%04d.jpg'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(SAIDA, rodada.id + '.mp4')]);
  if (f.status !== 0) console.log('  ffmpeg do vídeo: ' + f.stderr);
  // a linha do tempo: a mudança por quadro, para a página
  res.serie = quadros.map((q, i) => [+(q.t / 1000).toFixed(2), +(muda[i] * 100).toFixed(2), q.nivel === 'refinado' ? 1 : 0, acesa[i] ? 1 : 0]);
}
await configurar(null, 'Automático');
await configurar('Nenhum', null);
await app.close();
rmSync(pasta, { recursive: true, force: true });

// ---- o veredito: a troca de modelo é suave se o pico dela não passa do pico da luz mudando (o que acontece de qualquer jeito)
const auto = resultados.find((x) => x.id === 'automatico');
if (auto) {
  auto.modelo.length ? ok(`o Automático trocou de modelo ${auto.modelo.length} vezes (${auto.modelo.map((m) => (m.para === 'refinado' ? 'Completo' : 'Leve') + ' em ' + m.t.toFixed(1) + ' s').join(', ')})`) : falhou('o Automático não trocou de modelo com a luz');
  const picoLuz = Math.max(...resultados.flatMap((x) => x.luz.map((l) => l.pico)));
  const picoModelo = Math.max(0, ...auto.modelo.map((m) => m.pico));
  console.log(`  o maior pico da LUZ mudando (todas as rodadas): ${(picoLuz * 100).toFixed(2)}%; o maior pico da TROCA de modelo: ${(picoModelo * 100).toFixed(2)}%`);
  picoModelo <= Math.max(picoLuz, 3 * auto.calmo.p95) ? ok('a troca de modelo não sacode a máscara mais do que a própria luz mudando') : falhou('a troca de modelo sacode a máscara mais que a luz');
  // o meio medido pega um pedaço da parede ao lado da pessoa (~19% em qualquer rodada): o que conta é não passar das rodadas sem troca
  const pessoaSemTroca = Math.max(0, ...resultados.filter((x) => x.id !== 'automatico').map((x) => x.pessoaPior));
  auto.pessoaPior <= pessoaSemTroca + 0.03 ? ok(`a pessoa não perde nada na troca (pior quadro: ${(auto.pessoaPior * 100).toFixed(1)}% do meio como fundo, contra ${(pessoaSemTroca * 100).toFixed(1)}% sem troca)`) : falhou(`na troca, ${(auto.pessoaPior * 100).toFixed(1)}% do meio virou fundo, contra ${(pessoaSemTroca * 100).toFixed(1)}% sem troca`);
}

// ---- a página: os vídeos lado a lado e a linha do tempo de cada um
const W = 600, Hs = 90;
const grafico = (x) => {
  const max = Math.max(5, ...x.serie.map((s) => s[1]));
  const T = DURACAO + 1;
  const faixas = x.serie
    .map((s, i) => {
      const prox = x.serie[i + 1]?.[0] ?? s[0];
      const x0 = (s[0] / T) * W, w = Math.max(0.5, ((prox - s[0]) / T) * W);
      return `<rect x="${x0.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="8" fill="${s[3] ? '#f4d27a' : '#444'}"/><rect x="${x0.toFixed(1)}" y="10" width="${w.toFixed(1)}" height="8" fill="${s[2] ? '#7fd4ff' : '#ffb35c'}"/>`;
    })
    .join('');
  const linha = x.serie.map((s) => `${((s[0] / T) * W).toFixed(1)},${(Hs - (s[1] / max) * (Hs - 24)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${Hs}" width="100%"><g>${faixas}</g><polyline points="${linha}" fill="none" stroke="#e66" stroke-width="1.2"/><text x="${W - 4}" y="32" text-anchor="end" fill="#aaa" font-size="10">${max.toFixed(0)}% da máscara mudou</text></svg>`;
};
const html = `<!doctype html><meta charset="utf-8"><title>Luz liga e desliga</title>
<style>body{background:#141518;color:#e8e8e8;font:14px/1.5 system-ui;margin:16px;max-width:1300px}.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px}video{width:100%;display:block}h2{font-size:15px;margin:8px 0}small{color:#aaa}table{border-collapse:collapse;margin:12px 0}td,th{padding:3px 10px;border-bottom:1px solid #333;text-align:left}</style>
<h1>A luz liga e desliga (${PERIODO} s cada)</h1>
<p>O mesmo vídeo, com a luz trocando de repente como um interruptor (o escuro e o ruído do estudo), passado pelo app de verdade com o fundo apagado.
Na linha do tempo: a faixa de cima é a luz (amarela acesa, cinza apagada), a de baixo o modelo (azul Completo, laranja Leve), e a linha vermelha o quanto da máscara mudou de um quadro para o outro.</p>
<table><tr><th>Rodada</th><th>Mudança sem troca (mediana · p95)</th><th>Picos da luz mudando</th><th>Picos da troca de modelo</th><th>Pior quadro da pessoa</th></tr>
${resultados.map((x) => `<tr><td>${x.rotulo}</td><td>${(x.calmo.mediana * 100).toFixed(2)}% · ${(x.calmo.p95 * 100).toFixed(2)}%</td><td>${x.luz.map((l) => (l.pico * 100).toFixed(1) + '%').join(', ')}</td><td>${x.modelo.map((m) => `${(m.pico * 100).toFixed(1)}% (${m.para === 'refinado' ? '→ Completo' : '→ Leve'}, ${m.atrasoDaLuz?.toFixed(1)} s depois da luz)`).join(', ') || '—'}</td><td>${(x.pessoaPior * 100).toFixed(1)}% virou fundo</td></tr>`).join('')}
</table>
<div class="grade">${resultados.map((x) => `<div><h2>${x.rotulo}</h2><video src="luz/${x.id}.mp4" controls loop muted playsinline></video>${grafico(x)}</div>`).join('')}</div>`;
writeFileSync(resolve('e2e/fundo-da-camera/resultados/luz.html'), html);
writeFileSync(join(SAIDA, 'numeros.json'), JSON.stringify(resultados.map(({ serie, ...x }) => x), null, 2));
console.log('  a página: e2e/fundo-da-camera/resultados/luz.html');
resumo('a luz que acende e apaga');
