// A TESOURA: duas pessoas, uma transmitindo, e a outra clipando de verdade.
//
// Isto existe porque a tesoura foi dada como consertada duas vezes e continuou não fazendo nada. Os
// dois consertos eram reais — uma corrida dentro de clips.ts e o menu que se fechava ao clique — e
// nenhum dos dois foi medido CONTRA UMA TRANSMISSÃO DE VERDADE. Clipe é a única função do Syden que
// precisa de duas pessoas, de uma tela compartilhada e de trinta segundos passando: nada disso cabe
// num teste de unidade, e foi por isso que o defeito sobreviveu a dois consertos.
//
// A tela transmitida é um CANVAS que se mexe, nunca a tela real de quem roda o teste.
//
// Precisa do LiveKit no ar:  npm run dev:livekit
//
//   node e2e/clipe.mjs
//   O gravador é o sem recodificar (clipeCru/gravador.ts, ligado de fábrica desde 16/11/2026).
//   CLIPE_ANTIGO=1 node e2e/clipe.mjs   o gravador de antes ('syden.clipeCru' = 'nao' na Bia)
//   NO_APP=1 node e2e/clipe.mjs         a Bia é o APP (o Electron do desktop/, apontado ao site de teste): confere que a
//                                       cifra vai pelo RTCRtpScriptTransform e que o pedido de quadro-chave segura o clipe
//                                       perto dos 30 s (use ESPERA_DO_CLIPE=50000)
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

/** No lugar da tela real: um canvas que muda a cada quadro, para haver vídeo de verdade para gravar. */
const TELA_FALSA = (pesada) => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${n % 360} 60% 25%)`;
      ctx.fillRect(0, 0, 1280, 720);
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `hsl(${(n * 7 + i * 11) % 360} 80% 60%)`;
        ctx.fillRect((n * 17 + i * 151) % 1240, (i * 97 + n * 5) % 680, 90, 60);
      }
      // TELA_PESADA=1: ruído que o codificador não comprime, para a transmissão ir à taxa de cima (o clipe de 30 s
      // sem recodificar passa dos 8 MB do chat, e o envio precisa encolhê-lo)
      if (pesada) {
        // oito quadros de ruído feitos uma vez (sortear a cada quadro pesava demais na página da Ana)
        window.__ruidos ??= Array.from({ length: 8 }, () => {
          const img = ctx.createImageData(640, 360);
          for (let k = 0; k < img.data.length; k += 4) {
            const v = (Math.random() * 255) | 0;
            img.data[k] = v;
            img.data[k + 1] = (v * 7) & 255;
            img.data[k + 2] = 255 - v;
            img.data[k + 3] = 255;
          }
          return img;
        });
        ctx.putImageData(window.__ruidos[n % 8], (n * 13) % 640, (n * 7) % 360);
      }
    }, 1000 / 30);
    return canvas.captureStream(30);
  };
};

/**
 * Guarda cada arquivo que um MediaRecorder da página produz, para o teste medir o SOM de cada etapa
 * (a gravação das vozes e o clipe final) em vez de só conferir que um arquivo existe. Foi assim que o
 * "marquei juntar as vozes e o clipe saiu sem elas" escapou: o teste via o vídeo e nunca ouvia.
 */
const GUARDAR_GRAVACOES = () => {
  window.__gravacoes = [];
  const Original = window.MediaRecorder;
  window.MediaRecorder = class extends Original {
    constructor(...args) {
      super(...args);
      const partes = [];
      this.addEventListener('dataavailable', (e) => e.data.size > 0 && partes.push(e.data));
      this.addEventListener('stop', () => window.__gravacoes.push({ tipo: this.mimeType, blob: new Blob(partes) }));
    }
  };
};

/**
 * Quantos quadros de vídeo o arquivo tem, contados pelo ffprobe. Zero é o "saiu no chat mas não tem
 * vídeo nenhum": arquivo que existe, tem som, e nenhuma imagem.
 */
function quadrosDeVideo(arquivo) {
  const { stdout } = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', arquivo],
    { encoding: 'utf8' },
  );
  return Number(stdout.trim()) || 0;
}

/** Volume médio do som de um arquivo, em dB, pelo ffmpeg. -91 é silêncio digital. */
function volumeMedio(arquivo) {
  // O ffmpeg escreve a medição na saída de ERRO, mesmo quando dá certo.
  const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-i', arquivo, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number(/mean_volume: (-?[\d.]+) dB/.exec(stderr ?? '')?.[1] ?? NaN);
}

const { browser } = await abrirNavegador();
const NO_APP = !!process.env.NO_APP;
let app = null;

/** As conexões da página, para conferir por qual caminho a cifra foi montada. */
const GUARDAR_CONEXOES = () => {
  window.__conexoes = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
};

async function entrar(prefixo) {
  let ctx, page;
  if (NO_APP && prefixo === 'bia') {
    const env = { ...process.env, SYDEN_URL: 'http://localhost:5174/app/', SYDEN_PASTA_DE_DADOS: mkdtempSync(join(tmpdir(), 'syden-app-clipe-')) };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({
      executablePath: resolve('node_modules/electron/dist/electron.exe'),
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', resolve('desktop')],
      env,
    });
    console.log('  a bia é o APP: Electron ' + (await app.evaluate(() => process.versions.electron)));
    ctx = app.context();
    page = await app.firstWindow();
    await ctx.addInitScript(GUARDAR_CONEXOES);
  } else {
    ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
    page = await ctx.newPage();
    if (prefixo === 'bia') await page.addInitScript(GUARDAR_CONEXOES);
  }
  const alvo = NO_APP && prefixo === 'bia' ? ctx : page;
  vigiar(page);
  page.on('pageerror', (e) => console.log(`  [${prefixo} erro]`, String(e).slice(0, 200)));
  page.on('console', (m) => (m.text().startsWith('[corte]') || m.text().includes('montarClipe') || m.text().includes('caberNoChat')) && console.log(`  [${prefixo}]`, m.text().slice(0, 300)));
  await alvo.addInitScript(TELA_FALSA, !!process.env.TELA_PESADA);
  // CODEC=h264 ou vp9: a placa "diz" que codifica só esse, para a transmissão sair nele (como em clipe-sem-recodificar.mjs)
  if (process.env.CODEC && prefixo === 'ana') {
    await alvo.addInitScript((codec) => {
      const tipo = { vp9: 'video/VP9', h264: 'video/H264' }[codec];
      const original = navigator.mediaCapabilities.encodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.encodingInfo = async (c) => (c?.video?.contentType === tipo ? { supported: true, smooth: true, powerEfficient: true } : c?.video?.contentType === 'video/VP9' || c?.video?.contentType === 'video/H264' ? { supported: true, smooth: true, powerEfficient: false } : original(c));
      if (window.VideoEncoder?.isConfigSupported) VideoEncoder.isConfigSupported = async (c) => ({ supported: false, config: c });
    }, process.env.CODEC);
  }
  await alvo.addInitScript(GUARDAR_GRAVACOES);
  if (process.env.CLIPE_ANTIGO) await alvo.addInitScript(() => localStorage.setItem('syden.clipeCru', 'nao'));
  let usuario;
  if (NO_APP && prefixo === 'bia') {
    // o app abre na tela de entrar, sem o link do convite: a conta nasce pela API e o token vai para a janela
    usuario = prefixo + Date.now().toString().slice(-6);
    const api = (rota, corpo) => fetch('http://localhost:3099' + rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then((r) => r.json());
    await api('/api/auth/register', { username: usuario, password: 'segredo123', email: usuario + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
    const { token } = await api('/api/auth/login', { username: usuario, password: 'segredo123' });
    await ctx.addInitScript((tk) => localStorage.setItem('janja.token', tk), token);
    await page.waitForLoadState('domcontentloaded');
    await page.reload();
    await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').waitFor({ timeout: 60000 });
  } else usuario = await criarConta(page, prefixo);
  await dispensarPresentes(page);
  return { page, usuario };
}

const ana = await entrar('ana');
// A ana cria a comunidade para as duas estarem na MESMA, sem depender do estado do banco.
await ana.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await ana.page.getByText('Criar a minha').click();
await ana.page.getByLabel('Nome da comunidade').fill('Clipe ' + Date.now().toString().slice(-5));
await ana.page.locator('.dialog .btn-primary').click();
await ana.page.locator('.channel-list').waitFor({ timeout: 20000 });

await ana.page.locator('button[aria-label="Configurações"]').first().click();
await ana.page.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
await ana.page.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
const convite = (await ana.page.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.page.locator('.invite-row code').first().innerText());
await ana.page.keyboard.press('Escape');
ok(`a ana criou a comunidade (convite ${convite})`);

const bia = await entrar('bia');
// A bia entra na comunidade da ana pelo código — é o caminho de verdade, e deixa as duas na mesma
// sala sem o teste depender do que já existe no banco.
await bia.page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await bia.page.getByText('Entrar com um convite').click();
await bia.page.getByLabel('Código de convite').fill(convite.trim());
await bia.page.locator('.dialog .btn-primary').click();
await bia.page.locator('.channel-list').waitFor({ timeout: 20000 });
ok('a bia entrou na mesma comunidade');

for (const quem of [ana, bia]) {
  await quem.page.locator('.rail-list .rail-item').last().click();
  await quem.page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await quem.page.locator('.stage-controls').waitFor({ timeout: 30000 });
}
ok('as duas estão na mesma sala de voz');

// ---------- a ana transmite ----------
await ana.page.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
await ana.page.locator('.screenshare-option').first().click();
await ana.page.locator('.stage-main video').first().waitFor({ timeout: 25000 });
ok('a ana está transmitindo');

// ---------- a bia abre a transmissão ----------
const convite_ = bia.page.locator('.stream-invite');
if ((await convite_.count()) > 0) {
  await convite_.getByRole('button').first().click();
}
await bia.page.locator('.stage-main video, .stage video').first().waitFor({ timeout: 25000 });
ok('a bia abriu a transmissão e está vendo');

// A BIA FICA EM SILÊNCIO, para o som das vozes no clipe só poder vir da ANA, pela rede. Com as duas
// falando, o bipe da própria Bia bastaria para o teste passar — e a voz que vem de longe é justamente a
// que o Chrome é conhecido por entregar muda a um contexto de áudio.
await bia.page.locator('.stage-controls button[aria-label="Silenciar"]').click();
await bia.page.locator('.stage-controls button[aria-label="Ativar microfone"]').waitFor({ timeout: 5000 });
ok('a bia se silenciou: o que soar nas vozes é a ana');

// ---------- clicar CEDO DEMAIS tem de dizer alguma coisa ----------
//
// Este é o caminho que mais se parece com "cliquei e não aconteceu nada": antes, a tesoura ficava
// desabilitada enquanto a gravação juntava os primeiros segundos, e botão apagado é a forma mais
// educada de não responder. O aviso precisa estar VISÍVEL, e não só existir — a primeira versão
// dele era um parágrafo solto no fim do body, desenhado fora da tela.
await bia.page.locator('.mais-anchor > button').first().click();
await bia.page.waitForTimeout(300);
const cedo = bia.page.locator('.mais-menu button[aria-label*="Clipar"], .mais-menu button[aria-label*="Gravando"]').first();
if ((await cedo.count()) > 0 && !(await cedo.isDisabled())) {
  await cedo.click();
  await bia.page.waitForTimeout(600);
  const quantos = await bia.page.locator('.clipe-aviso').count();
  const visivel = quantos ? await bia.page.locator('.clipe-aviso').first().isVisible() : false;
  const texto = quantos ? await bia.page.locator('.clipe-aviso').first().innerText() : '';
  quantos && visivel
    ? ok(`clicar cedo demais mostra um aviso visível: ${JSON.stringify(texto)}`)
    : falhou('clicar cedo demais não mostrou nada — é o sintoma de novo');
  await bia.page.screenshot({ path: 'e2e/fotos/clipe-aviso-cedo.png' });
} else {
  console.log('  (a tesoura já estava pronta; o caminho do aviso não foi exercitado)');
}
await bia.page.keyboard.press('Escape');

// A gravação em rolagem precisa de alguns segundos guardados antes de o botão acender.
await bia.page.waitForTimeout(Number(process.env.ESPERA_DO_CLIPE ?? 8000));

// ---------- a bia clipa ----------
await bia.page.locator('.mais-anchor > button').first().click();
await bia.page.waitForTimeout(500);

const tesoura = bia.page.locator('.mais-menu button[aria-label*="Clipar"], .mais-menu button[aria-label*="Gravando"]').first();
if ((await tesoura.count()) === 0) {
  falhou('a tesoura não apareceu no menu — sem ela não há o que clicar');
} else {
  const rotulo = await tesoura.getAttribute('aria-label');
  const desligada = await tesoura.isDisabled();
  console.log(`  tesoura: "${rotulo}" ${desligada ? '(DESABILITADA)' : '(clicável)'}`);

  // ESTE É O PONTO. Uma tesoura desabilitada não faz nada ao clique, e não dá explicação nenhuma —
  // é indistinguível de um botão quebrado para quem está do outro lado.
  !desligada
    ? ok('depois de oito segundos de transmissão, a tesoura está clicável')
    : falhou('a tesoura continua desabilitada: clicar nela não faz nada e não diz por quê');

  if (!desligada) {
    await tesoura.click();
    await bia.page.waitForTimeout(4000);

    const dialogo = await bia.page.locator('.clipe-dialog').count();
    const erro = await bia.page.locator('.clipe-aviso').count();
    const textoDoErro = erro ? await bia.page.locator('.clipe-aviso').first().innerText() : '';
    console.log(`  depois do clique: diálogo=${dialogo} erro=${erro} ${textoDoErro}`);

    if (!process.env.CLIPE_ANTIGO) {
      // no caminho sem recodificar, nenhum MediaRecorder de VÍDEO pode ter rodado na Bia até aqui
      const deVideo = await bia.page.evaluate(() => window.__gravacoes.filter((g) => g.tipo.startsWith('video')).length);
      const mb = await bia.page.evaluate(async () => { const v = document.querySelector('.clipe-video'); return v ? (await (await fetch(v.src)).blob()).size / 1048576 : 0; });
      console.log('  o clipe sem recodificar tem ' + mb.toFixed(1) + ' MB');
      const cru = await bia.page.evaluate(async () => { const b = await (await fetch(document.querySelector('.clipe-video').src)).blob(); const l = new FileReader(); return await new Promise((r) => { l.onload = () => r(String(l.result).split(',')[1] ?? ''); l.readAsDataURL(b); }); });
      // fora do repositório (passa de 15 MB), para conferir com o ffprobe à mão
      writeFileSync(join(tmpdir(), 'syden-clipe-cru.bin'), Buffer.from(cru, 'base64'));
      deVideo === 0 ? ok('sem recodificar: nenhum gravador de vídeo rodou na Bia') : falhou(`sem recodificar: ${deVideo} gravação(ões) de vídeo na Bia`);
      // o caminho da cifra: no app, o RTCRtpScriptTransform (o desvio de vite.config.ts); no navegador, o de sempre
      const caminho = await bia.page.evaluate(() => ({
        marca: globalThis.__sydenScriptTransform === true,
        script: window.__conexoes.flatMap((pc) => pc.getReceivers()).filter((r) => r.transform).length,
        recebendo: window.__conexoes.flatMap((pc) => pc.getReceivers()).filter((r) => r.track?.readyState === 'live').length,
      }));
      console.log('  a cifra na bia: ' + JSON.stringify(caminho));
      if (NO_APP) caminho.marca && caminho.script > 0 ? ok(`no app, a cifra vai pelo RTCRtpScriptTransform (${caminho.script} faixa(s))`) : falhou('no app, a cifra NÃO foi pelo RTCRtpScriptTransform');
      else !caminho.marca && caminho.script === 0 ? ok('no navegador, a cifra continua no caminho de sempre') : falhou('no navegador, a cifra mudou de caminho');
      // a duração do arquivo e onde o editor abriu a seleção
      const regua = await bia.page.evaluate(() => {
        const r = [...document.querySelectorAll('.clipe-dialog input[type="range"]')].map((i) => +i.value);
        return { duracao: document.querySelector('.clipe-video')?.duration, inicio: r[0], fim: r[1] };
      });
      console.log('  o arquivo e a seleção: ' + JSON.stringify(regua));
      const espera = Number(process.env.ESPERA_DO_CLIPE ?? 8000) / 1000;
      if (NO_APP && espera > 40) {
        // com o pedido de quadro-chave a cada 20 s, o arquivo não passa de ~30 + 20 s
        regua.duracao < 52 ? ok(`com o pedido de quadro-chave, o clipe tem ${regua.duracao.toFixed(1)} s`) : falhou(`o clipe tem ${regua.duracao} s: o pedido de quadro-chave não segurou`);
      }
      if (regua.duracao > 38 + 0.5) regua.fim - regua.inicio <= 31 ? ok('o arquivo longo abre com os últimos 30 s escolhidos') : falhou('o arquivo longo abriu com tudo escolhido');
    }
    dialogo === 1 ? ok('a prévia do clipe abriu') : falhou(`a prévia não abriu${textoDoErro ? ` — disse: ${textoDoErro}` : ' e não disse nada'}`);

    if (dialogo === 1) {
      const video = await bia.page.locator('.clipe-video').count();
      video === 1 ? ok('e tem vídeo dentro dela') : falhou('a prévia abriu sem vídeo');
      await bia.page.screenshot({ path: 'e2e/fotos/clipe-previa.png' });

      // ---------- AS VOZES: medidas no SOM, e não na existência de um arquivo ----------
      const caixinha = bia.page.locator('.clipe-vozes input');
      if ((await caixinha.count()) === 0) {
        falhou('a caixinha "Juntar as vozes da sala" não apareceu');
      } else {
        (await caixinha.isChecked()) ? ok('a caixinha das vozes aparece, já marcada') : await caixinha.check();

        // A PRÉVIA TEM DE TER AS VOZES TAMBÉM: era ela que dizia "a caixinha não funciona" a quem
        // apertava play e ouvia só o jogo.
        //
        // O QUE ESTE TESTE NÃO CONSEGUE MEDIR: a sincronia. No Chrome sem tela dos testes, o vídeo da
        // prévia fica parado no zero mesmo "tocando" — com ou sem vozes, medido em 03/10/2026 —, então
        // comparar os dois relógios aqui mediria a limitação do Chrome, não o Syden. O que se confere é
        // que as vozes ESTÃO na prévia e abrem como áudio de verdade.
        const naPrevia = await bia.page.evaluate(async () => {
          const a = document.querySelector('.clipe-dialog audio');
          if (!a) return { achou: false };
          if (a.readyState < 1) await new Promise((r) => { a.onloadedmetadata = r; setTimeout(r, 5000); });
          return { achou: true, pronto: a.readyState };
        });
        naPrevia.achou && naPrevia.pronto >= 1
          ? ok('a prévia carrega as vozes junto com o vídeo')
          : falhou('a prévia não tem as vozes: ' + JSON.stringify(naPrevia));
        // E A SINCRONIA, quando o vídeo da prévia anda: os dois relógios juntos.
        const relogios = await bia.page.evaluate(async () => {
          const v = document.querySelector('.clipe-video');
          const a = document.querySelector('.clipe-dialog audio');
          // a seleção pode não começar no zero (o clipe longo do gravador sem recodificar): conta quanto o vídeo ANDOU
          await v.play().catch(() => {});
          await new Promise((r) => setTimeout(r, 300));
          const t0 = v.currentTime;
          for (let i = 0; i < 80 && v.currentTime - t0 < 2; i++) await new Promise((r) => setTimeout(r, 100));
          const r = { video: v.currentTime, andou: v.currentTime - t0, vozes: a.currentTime, vozesTocando: !a.paused };
          v.pause();
          await new Promise((r) => setTimeout(r, 300));
          return { ...r, vozesParamJunto: a.paused };
        });
        if (relogios.andou < 1) {
          console.log('  (o vídeo da prévia não andou neste Chrome; a sincronia não foi medida)', JSON.stringify(relogios));
        } else {
          relogios.vozesTocando && Math.abs(relogios.video - relogios.vozes) < 0.5
            ? ok(`na prévia, as vozes tocam junto (vídeo ${relogios.video.toFixed(1)} s, vozes ${relogios.vozes.toFixed(1)} s)`)
            : falhou('na prévia, as vozes não acompanham o vídeo: ' + JSON.stringify(relogios));
          relogios.vozesParamJunto ? ok('e param quando o vídeo pausa') : falhou('o vídeo pausou e as vozes continuaram');
        }
        // Desmarcada, elas saem da prévia — o que se ouve é o que vai sair.
        await caixinha.uncheck();
        (await bia.page.locator('.clipe-dialog audio').count()) === 0
          ? ok('desmarcando a caixinha, as vozes saem da prévia')
          : falhou('desmarcada a caixinha, as vozes continuam na prévia');
        await caixinha.check();
        // Com as vozes marcadas o corte nunca é "vazio" (ver corteVazio), então isto passa pelo caminho
        // que REGRAVA — que é onde as vozes são juntadas.
        // CORTAR_COMECO=5: tira os primeiros segundos, que é o caminho que obriga a RECODIFICAR o vídeo
        // (copiar quadro por quadro só funciona começando num quadro-chave).
        const cortarComeco = Number(process.env.CORTAR_COMECO ?? 0);
        if (cortarComeco > 0) {
          await bia.page.getByLabel('Começo').fill(String(cortarComeco));
          await bia.page.waitForTimeout(300);
        }
        const baixou = bia.page.waitForEvent('download', { timeout: 90000 }).catch(() => null);
        await bia.page.getByRole('button', { name: /Guardar no computador/ }).click();
        // ESCONDER_NO_CORTE=1: a pessoa troca de janela enquanto espera, que é o normal com uma espera
        // de trinta segundos. Uma aba nova na frente esconde a da Bia, como outra janela por cima.
        const inicioDoCorte = Date.now();
        let outraAba = null;
        if (process.env.ESCONDER_NO_CORTE) {
          outraAba = await bia.page.context().newPage();
          await outraAba.bringToFront();
          console.log('  (a página da Bia ficou escondida durante o corte:', await bia.page.evaluate(() => document.visibilityState), ')');
        }
        const vigia = setInterval(async () => {
          const estado = await bia.page.evaluate(() => ({
            barra: document.querySelector('.clipe-andamento div')?.style.width ?? null,
            erro: document.querySelector('.clipe-dialog .form-error')?.textContent ?? null,
          })).catch(() => null);
          console.log('  corte:', JSON.stringify(estado));
        }, 10000);
        const download = await baixou;
        clearInterval(vigia);
        const gravacoes = await bia.page.evaluate(async () =>
          Promise.all(
            window.__gravacoes.map(async (g) => ({
              tipo: g.tipo,
              base64: await new Promise((r) => { const l = new FileReader(); l.onload = () => r(String(l.result).split(",")[1] ?? ""); l.readAsDataURL(g.blob); }),
            })),
          ),
        );
        const deVoz = gravacoes.filter((g) => g.tipo.startsWith('audio/'));
        console.log('  gravações na página:', gravacoes.map((g) => g.tipo.split(';')[0]).join(', '));
        if (deVoz.length === 0) {
          falhou('nenhuma gravação só de áudio: a trilha das vozes nem foi gravada');
        } else {
          writeFileSync('e2e/fotos/clipe-vozes.webm', Buffer.from(deVoz.at(-1).base64, 'base64'));
          const db = volumeMedio('e2e/fotos/clipe-vozes.webm');
          db > -60 ? ok(`a gravação das vozes tem som (${db} dB)`) : falhou(`a gravação das vozes está muda (${db} dB)`);
        }
        if (!download) {
          falhou('o "Guardar no computador" não entregou arquivo nenhum');
        } else {
          await download.saveAs('e2e/fotos/clipe-final.webm');
          const db = volumeMedio('e2e/fotos/clipe-final.webm');
          db > -60 ? ok(`o clipe final tem som (${db} dB)`) : falhou(`o clipe final saiu mudo (${db} dB), mesmo com as vozes marcadas`);
          const quadros = quadrosDeVideo('e2e/fotos/clipe-final.webm');
          quadros > 30 ? ok(`e tem vídeo: ${quadros} quadros`) : falhou(`o clipe final saiu SEM VÍDEO (${quadros} quadros)`);
          console.log(`  o corte levou ${((Date.now() - inicioDoCorte) / 1000).toFixed(1)} s`);
          const { stdout: dur } = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'e2e/fotos/clipe-final.webm'], { encoding: 'utf8' });
          console.log(`  duração do clipe final: ${Number(dur).toFixed(1)} s`);
        }
      }
    }
  }
}

// ---------- O CAMINHO QUE A PESSOA USA: "Mandar na conversa", e o clipe tocando no chat ----------
//
// "Saiu no chat mas não tem vídeo nenhum." Baixar o arquivo e medir não basta: o que se vê é o
// player do chat, do lado de QUEM RECEBE. Então a Ana abre o canal e o teste confere o que ela vê.
if ((await bia.page.locator('.clipe-dialog').count()) === 1) {
  const mandar = bia.page.getByRole('button', { name: /Mandar na conversa/ });
  if ((await mandar.count()) === 0) {
    falhou('não há "Mandar na conversa" no diálogo do clipe');
  } else {
    const inicioDoEnvio = Date.now();
    await mandar.click();
    // o que o diálogo mostra durante o envio (no app, o "Mandado!" chegou a não aparecer para o teste)
    let ultimo = '';
    while (Date.now() - inicioDoEnvio < 90_000) {
      const agora = await bia.page.evaluate(() => (document.querySelector('.clipe-dialog') ? [...document.querySelectorAll('.clipe-dialog button')].map((x) => x.textContent?.trim()).filter(Boolean).join(' | ') + ' ' + (document.querySelector('.clipe-dialog progress, .clipe-dialog [role=progressbar]')?.getAttribute('value') ?? '') : '(diálogo fechado)')).catch((e) => 'erro: ' + e.message);
      if (agora !== ultimo) console.log(`  ${((Date.now() - inicioDoEnvio) / 1000).toFixed(1)} s: ${agora.slice(0, 160)}`);
      ultimo = agora;
      if (/Mandado!|diálogo fechado/.test(agora)) break;
      await bia.page.waitForTimeout(500);
    }
    const segundos = (Date.now() - inicioDoEnvio) / 1000;
    const erroNoEnvio = await bia.page.locator('.clipe-dialog .form-error').textContent().catch(() => null);
    erroNoEnvio
      ? falhou(`o envio deu erro: ${erroNoEnvio}`)
      : segundos < 15
        ? ok(`"Mandar na conversa" terminou em ${segundos.toFixed(1)} s`)
        : falhou(`"Mandar na conversa" levou ${segundos.toFixed(1)} s`);

    await ana.page.locator('.channel-name', { hasText: /^geral$/ }).first().click();
    const noChat = ana.page.locator('.attachment-video').last();
    await noChat.waitFor({ timeout: 20000 }).catch(() => {});
    if ((await noChat.count()) === 0) {
      falhou('o clipe não apareceu como vídeo no chat de quem recebe');
    } else {
      const player = await noChat.evaluate(async (v) => {
        if (v.readyState < 1) await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 10000); });
        await new Promise((r) => setTimeout(r, 1500)); // a correção de duração mexe no tempo ao carregar
        const antes = { largura: v.videoWidth, altura: v.videoHeight, duracao: v.duration };
        v.muted = true;
        await v.play().catch(() => {});
        for (let i = 0; i < 50 && v.currentTime < 1; i++) await new Promise((r) => setTimeout(r, 100));
        const andou = v.currentTime;
        v.pause();
        return { ...antes, andou, src: v.currentSrc };
      });
      console.log('  player no chat da Ana:', JSON.stringify({ ...player, src: undefined }));
      player.largura > 0 ? ok(`no chat, o vídeo tem imagem (${player.largura}×${player.altura})`) : falhou('no chat, o player não tem imagem (0×0)');
      Number.isFinite(player.duracao) && player.duracao > 1
        ? ok(`e duração conhecida (${player.duracao.toFixed(1)} s)`)
        : falhou(`a duração no chat é ${player.duracao}`);
      player.andou >= 0.5 ? ok('e toca') : falhou(`o vídeo no chat não anda (${player.andou} s)`);

      const resposta = await fetch(player.src);
      writeFileSync('e2e/fotos/clipe-no-chat.webm', Buffer.from(await resposta.arrayBuffer()));
      const quadros = quadrosDeVideo('e2e/fotos/clipe-no-chat.webm');
      const db = volumeMedio('e2e/fotos/clipe-no-chat.webm');
      quadros > 30 ? ok(`o arquivo que chegou tem ${quadros} quadros`) : falhou(`o arquivo que chegou não tem vídeo (${quadros} quadros)`);
      db > -60 ? ok(`e som (${db} dB)`) : falhou(`e está mudo (${db} dB)`);
      await noChat.scrollIntoViewIfNeeded();
      await ana.page.screenshot({ path: 'e2e/fotos/clipe-no-chat.png' });
    }
  }
}

await bia.page.screenshot({ path: 'e2e/fotos/clipe-menu.png' });
await app?.close();
await browser.close();
resumo('a tesoura, com transmissão de verdade');
