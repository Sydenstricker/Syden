// O CLIPE SEM RECODIFICAR (15/11/2026): o teste de VIABILIDADE de trocar o gravador de clipes.
//
// Hoje (web/src/clips.ts) quem ASSISTE mantém um MediaRecorder recodificando em VP8 a transmissão o tempo todo,
// para guardar os últimos 30 s. Medido: ~0,3 núcleo de quem assiste, que muitas vezes está jogando. A ideia
// testada aqui: GUARDAR OS QUADROS JÁ CODIFICADOS como chegam da rede, logo DEPOIS de a cifra de ponta a ponta os
// decifrar, num anel, e só montar o arquivo quando a pessoa pede o clipe. Nada de web/src muda: o teste embrulha o
// worker de cifra do LiveKit (a rota do Playwright põe um gancho na frente do arquivo dele) e mede.
//
// O que se mede, e o que cada medida decide:
//   1. o gancho pega cada quadro de vídeo decifrado (o caminho que o LiveKit usa no Chrome, e se é cifrado mesmo);
//   2. quantos quadros-chave chegam sozinhos em ~60 s, e se quem assiste PROVOCA um (três jeitos), em quanto tempo;
//   3. os quadros guardados decodificam (VideoDecoder) e viram um WebM sem recodificar (webm-muxer, MIT, carregado
//      SÓ NESTA PÁGINA DE TESTE pelo unpkg, versão fixa) que toca com a duração certa;
//   4. o processador de quem assiste: gravador do app + cópia, só a cópia, nada (fases alternadas de 20 s), e os MB do anel;
//   5. o codec da transmissão (CODEC=vp8|vp9|h264 força o que a placa de quem transmite "diz" que codifica).
//
// Cada pessoa num Chrome SEPARADO, para o processador de quem assiste ser só dela.
//
//   API de teste na 3099, site na 5174 e LiveKit local (npm run dev:livekit)
//   node e2e/clipe-sem-recodificar.mjs            (CODEC=vp9 ou CODEC=h264 para os outros; RAPIDO=1 encurta as esperas)
//
// NO_APP=1 (16/11/2026): quem assiste é o APP (o Electron do desktop/, apontado ao site de teste), e não o Chrome. Com
// TRANSFORM=script, mede se o pedido limpo de quadro-chave (sendKeyFrameRequest) funciona dentro do app.
//
// MEDIDO NO APP (16/11/2026, Electron 44.4.3 / Chromium 152, NO_APP=1 TRANSFORM=script RAPIDO=1, VP8):
//   - o caminho do RTCRtpScriptTransform FUNCIONA no app (as duas faixas, sem o InvalidState que fez o LiveKit desligá-lo no
//     Chrome; o LiveKit 2.24.1 ainda o desliga em todo Chromium, pelo userAgent);
//   - o sendKeyFrameRequest trouxe o quadro-chave em 58 ms (estragar um quadro: 395 ms; trocar de camada: ~200 ms; soltar
//     um quadro: 3 s). Pedido na faixa de áudio dá InvalidStateError ("not video"): pedir só no vídeo;
//   - o gravador de hoje custa ~1,0 núcleo na página do APP (no Chrome tinham sido ~0,3); a cópia, ~0 (0,4 ms por segundo);
//   - 1099 quadros guardados decodificaram sem erro e viraram um WebM de 38,6 s que toca.
// O gravador que usa isto é web/src/clipeCru/ (desligado de fábrica). A decisão que falta: como pedir quadro-chave no
// Chromium, onde o LiveKit não usa o caminho do pedido limpo.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright-core';
import { abrirNavegador, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = 'http://localhost:3099', APP = 'http://localhost:5174/app/';
const CODEC = (process.env.CODEC ?? 'vp8').toLowerCase();
const RAPIDO = !!process.env.RAPIDO;
const OBSERVAR_S = RAPIDO ? 20 : 60, FASE_S = RAPIDO ? 8 : 20;
const WEBM_MUXER = 'https://unpkg.com/webm-muxer@5.1.4/build/webm-muxer.mjs';
const sufixo = Date.now().toString(36).slice(-5);

const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, { method: metodo, headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
async function conta(nome) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: 'teste', nascimento: '1990-01-01' });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}

// ---------------------------------------------------------------------------------------------------------------
// O GANCHO, posto NA FRENTE do worker de cifra do LiveKit (livekit-client.e2ee.worker.mjs). No Chrome o LiveKit usa
// createEncodedStreams: a página manda ao worker {kind:'decode', data:{readableStream, writableStream, ...}} e o
// worker decifra lendo de um e escrevendo no outro. O gancho troca o writableStream por um TransformStream nosso que
// COPIA o quadro já decifrado e o repassa ao original. Para isso ele toma o lugar do `onmessage` (o worker do LiveKit
// faz `onmessage = ev => ...`, que cai no acessor nosso) e entrega cada mensagem ao handler dele depois de trocar o
// stream. Fala com a página por um BroadcastChannel, para não se meter nas mensagens do LiveKit.
// ---------------------------------------------------------------------------------------------------------------
const GANCHO = () => {
  const canal = new BroadcastChannel('clipe-sem-recodificar');
  const anel = []; // { t, tipo, rtp, w, h, mime, ssrc, dados }
  const chaves = []; // { t, w, h, bytes, motivo }
  const estado = { copiar: true, caminho: null, faixas: 0, quadros: 0, audio: 0, bytes: 0, custoMs: 0, pedido: null, estragados: 0, soltos: 0, ultimaDim: null };
  const LIMITE = 200 * 1024 * 1024;
  let guardados = 0;
  let handler = null;
  Object.defineProperty(self, 'onmessage', { configurable: true, get: () => handler, set: (f) => { handler = f; } });

  function embrulhar(original) {
    const ts = new TransformStream({
      transform(quadro, controle) {
        // RTCEncodedVideoFrame tem `type` ('key' | 'delta' | 'empty'); o de áudio não.
        if (typeof quadro.type !== 'string') {
          estado.audio++;
          controle.enqueue(quadro);
          return;
        }
        const agora = performance.now();
        // Provocar um quadro-chave do lado de quem assiste: estragar um quadro (o decodificador do Chrome falha e pede
        // um quadro-chave na hora) ou soltar um (falta a referência, e o Chrome pede depois de esperar).
        if (estado.pedido && quadro.type === 'delta' && !estado.pedido.feito) {
          estado.pedido.feito = true;
          if (estado.pedido.como === 'soltar') {
            estado.soltos++;
            return;
          }
          if (estado.pedido.como === 'estragar') {
            const d = new Uint8Array(quadro.data);
            const lixo = new Uint8Array(Math.min(d.length, 40));
            lixo.set(d.subarray(0, Math.min(d.length, 10)));
            for (let i = 10; i < lixo.length; i++) lixo[i] = (i * 73) & 0xff;
            quadro.data = lixo.buffer;
            estado.estragados++;
            controle.enqueue(quadro);
            return;
          }
        }
        if (estado.copiar) {
          const m = quadro.getMetadata();
          const dados = quadro.data.slice(0);
          estado.quadros++;
          estado.bytes += dados.byteLength;
          const item = { t: agora, tipo: quadro.type, rtp: m.rtpTimestamp ?? quadro.timestamp, w: m.width, h: m.height, mime: m.mimeType, ssrc: m.synchronizationSource, dados };
          anel.push(item);
          guardados += dados.byteLength;
          while (guardados > LIMITE) guardados -= anel.shift().dados.byteLength;
          if (quadro.type === 'key') {
            const motivo = estado.pedido && !estado.pedido.chegou ? estado.pedido.como : 'sozinho';
            if (estado.pedido && !estado.pedido.chegou) {
              estado.pedido.chegou = agora;
              estado.pedido.ms = Math.round(agora - estado.pedido.t);
            }
            chaves.push({ t: agora, w: m.width, h: m.height, bytes: dados.byteLength, motivo });
          }
          estado.custoMs += performance.now() - agora;
        } else if (quadro.type === 'key') {
          const m = quadro.getMetadata();
          if (estado.pedido && !estado.pedido.chegou) {
            estado.pedido.chegou = agora;
            estado.pedido.ms = Math.round(agora - estado.pedido.t);
          }
          chaves.push({ t: agora, w: m.width, h: m.height, bytes: 0, motivo: 'sem-copia' });
        }
        controle.enqueue(quadro);
      },
    });
    ts.readable.pipeTo(original).catch(() => {});
    return ts.writable;
  }

  self.addEventListener('message', (ev) => {
    const d = ev.data;
    if (d && d.kind === 'decode' && d.data?.writableStream) {
      estado.caminho = 'createEncodedStreams (mensagem decode)';
      estado.faixas++;
      d.data.writableStream = embrulhar(d.data.writableStream);
    }
    handler?.call(self, ev);
  });
  // O outro caminho (RTCRtpScriptTransform), que o LiveKit usa fora do Chromium: embrulhado do mesmo jeito.
  let porTransform = null;
  const transformadores = [];
  Object.defineProperty(self, 'onrtctransform', {
    configurable: true,
    get: () => porTransform,
    set: (f) => {
      porTransform = (event) => {
        if (event.transformer.options?.kind === 'decode') {
          estado.caminho = 'RTCRtpScriptTransform (rtctransform)';
          estado.faixas++;
          const t = event.transformer;
          transformadores.push(t);
          const writable = embrulhar(t.writable);
          return f({ transformer: { options: t.options, readable: t.readable, writable, sendKeyFrameRequest: () => t.sendKeyFrameRequest() } });
        }
        return f(event);
      };
      // a propriedade nossa esconde a do navegador: o evento só chega por um ouvinte de verdade
      self.addEventListener('rtctransform', (event) => porTransform(event));
    },
  });

  canal.onmessage = (ev) => {
    const p = ev.data;
    // O React em desenvolvimento cria o worker DUAS vezes (o useState do useVoice roda o inicializador duas vezes), e só
    // um recebe faixas: o outro fica calado.
    if (!p?.pergunta || estado.faixas === 0) return;
    const responder = (dados) => canal.postMessage({ resposta: p.id, ...dados });
    if (p.pergunta === 'estado') {
      const agora = performance.now();
      const em30 = anel.filter((q) => q.t >= agora - 30000);
      responder({
        ...estado,
        pedido: estado.pedido && { como: estado.pedido.como, ms: estado.pedido.ms ?? null },
        agora,
        chaves,
        noAnel: anel.length,
        mbNoAnel: guardados / 1048576,
        mb30s: em30.reduce((s, q) => s + q.dados.byteLength, 0) / 1048576,
        quadros30s: em30.length,
        ultimo: anel.length ? { w: anel.at(-1).w, h: anel.at(-1).h, mime: anel.at(-1).mime } : null,
        scriptTransformNoWorker: typeof self.RTCTransformEvent !== 'undefined',
      });
    } else if (p.pergunta === 'copiar') {
      estado.copiar = p.valor;
      responder({ copiar: estado.copiar });
    } else if (p.pergunta === 'provocar') {
      estado.pedido = { como: p.como, t: performance.now(), feito: p.como === 'externo' || p.como === 'pedir', chegou: 0 };
      // O jeito limpo, só no caminho do RTCRtpScriptTransform: o próprio receptor pede o quadro-chave (RTCP PLI/FIR).
      if (p.como === 'pedir') {
        estado.respostasDoPedido = [];
        for (const t of transformadores) Promise.resolve().then(() => t.sendKeyFrameRequest()).then(() => estado.respostasDoPedido.push('ok'), (e) => estado.respostasDoPedido.push(String(e).slice(0, 80)));
      }
      responder({ ok: true });
    } else if (p.pergunta === 'anel') {
      const agora = performance.now();
      responder({ agora, quadros: anel.filter((q) => q.t >= agora - p.segundos * 1000 - 120000) });
    }
  };
};

/** No lugar da tela real: um canvas 1080p que muda a cada quadro, e a placa "dizendo" que codifica o CODEC pedido. */
const PREPARO_DA_ANA = (codec) => {
  window.__conexoes = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
  const tipo = { vp9: 'video/VP9', h264: 'video/H264' }[codec];
  const perguntaOriginal = navigator.mediaCapabilities.encodingInfo.bind(navigator.mediaCapabilities);
  navigator.mediaCapabilities.encodingInfo = async (config) => {
    const ct = config?.video?.contentType;
    if (tipo && ct === tipo) return { supported: true, smooth: true, powerEfficient: true };
    if (ct === 'video/VP9' || ct === 'video/H264') return { supported: true, smooth: true, powerEfficient: false };
    return perguntaOriginal(config);
  };
  // O WebCodecs é a segunda pergunta (escolherCodec.ts): responde "não pela placa", para só o CODEC pedido ganhar.
  if (window.VideoEncoder?.isConfigSupported) {
    VideoEncoder.isConfigSupported = async (c) => ({ supported: false, config: c });
  }
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1920, height: 1080 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${n % 360} 60% 25%)`;
      ctx.fillRect(0, 0, 1920, 1080);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = `hsl(${(n * 7 + i * 11) % 360} 80% 60%)`;
        ctx.fillRect((n * 17 + i * 151) % 1840, (i * 97 + n * 5) % 1000, 120, 80);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '48px sans-serif';
      ctx.fillText('quadro ' + n, 60, 120);
    }, 1000 / 30);
    return canvas.captureStream(30);
  };
};

/** Quem assiste: as conexões à mão, e o MediaRecorder do app com um interruptor (__semGravador) só para o teste. */
const PREPARO_DA_BIA = (fingirOutroNavegador) => {
  // TRANSFORM=script: o LiveKit só usa o RTCRtpScriptTransform fora do Chromium (isScriptTransformSupportedForWorker,
  // "o Chrome às vezes dá InvalidState"); um userAgent sem "chrom" o leva a esse caminho, para medir o sendKeyFrameRequest.
  if (fingirOutroNavegador) {
    const ua = navigator.userAgent.replace(/(Headless)?Chrome\/[\d.]+ /, '');
    Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua });
  }
  window.__conexoes = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new Original(...args);
    window.__conexoes.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Original);
  window.__gravadores = [];
  window.__semGravador = false;
  const Gravador = window.MediaRecorder;
  window.MediaRecorder = class extends Gravador {
    constructor(...args) {
      super(...args);
      window.__gravadores.push(this);
    }
    start(...args) {
      if (window.__semGravador) return; // fica 'inactive': o clips.ts acha que não há o que fechar e tenta de novo depois
      return super.start(...args);
    }
  };
  window.__desligarGravador = () => {
    window.__semGravador = true;
    for (const g of window.__gravadores) if (g.state !== 'inactive') g.stop();
  };
};

// ---------------------------------------------------------------------------------------------------------------

const dona = await conta('ana' + sufixo), amiga = await conta('bia' + sufixo);
const comunidade = await pedir('POST', '/api/communities', dona, { name: 'Clipe cru ' + sufixo });
await pedir('POST', '/api/communities/join', amiga, { code: comunidade.inviteCode });

const navAna = await abrirNavegador({ permissoes: ['microphone'] });
const NO_APP = !!process.env.NO_APP;
let appBia = null;
if (NO_APP) {
  const env = { ...process.env, SYDEN_URL: APP, SYDEN_PASTA_DE_DADOS: mkdtempSync(join(tmpdir(), 'syden-app-clipe-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  appBia = await _electron.launch({
    executablePath: resolve('node_modules/electron/dist/electron.exe'),
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', resolve('desktop')],
    env,
  });
  console.log('  quem assiste é o APP: Electron ' + (await appBia.evaluate(() => process.versions.electron)) + ', Chromium ' + (await appBia.evaluate(() => process.versions.chrome)));
}
const navBia = NO_APP ? { contexto: appBia.context(), browser: null } : await abrirNavegador({ permissoes: ['microphone'] });

// O gancho entra pela rede: o arquivo do worker de cifra é baixado e servido com o gancho na frente.
let ganchoServido = 0;
await navBia.contexto.route(/livekit-client\.e2ee\.worker\.mjs/, async (rota) => {
  const resposta = await rota.fetch();
  const corpo = await resposta.text();
  ganchoServido++;
  await rota.fulfill({ response: resposta, body: `(${GANCHO.toString()})();\n` + corpo, headers: { ...Object.fromEntries(Object.entries(resposta.headers()).filter(([k]) => k !== 'content-length')), 'content-type': 'text/javascript' } });
});

async function naSala(contexto, token, preparo, arg, janelaDoApp = null) {
  const page = vigiar(janelaDoApp ?? (await contexto.newPage()));
  page.on('console', (m) => m.type() === 'error' && /e2ee|worker|decode/i.test(m.text()) && console.log('  [console]', m.text().slice(0, 200)));
  // no app, a janela já existe: os scripts vão no contexto e a página recarrega com eles
  const alvo = janelaDoApp ? contexto : page;
  await alvo.addInitScript(preparo, arg);
  await alvo.addInitScript((tk) => { localStorage.setItem('janja.token', tk); }, token);
  if (janelaDoApp) {
    await page.waitForLoadState('domcontentloaded');
    await page.reload();
  } else await page.goto(APP);
  await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).waitFor({ timeout: 60000 });
  for (let i = 0; i < 6; i++) {
    const r = page.getByRole('button', { name: 'Resgatar' }), f = page.getByRole('button', { name: 'Fechar', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    else if (await f.first().isVisible().catch(() => false)) await f.first().click();
    else if (i > 2) break;
    await page.waitForTimeout(800);
  }
  return page;
}
const entrarNaSala = async (page) => {
  await page.locator(`.rail-list .rail-item[aria-label="${comunidade.name}"]`).click();
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
};

const A = await naSala(navAna.contexto, dona, PREPARO_DA_ANA, CODEC);
const B = await naSala(navBia.contexto, amiga, PREPARO_DA_BIA, process.env.TRANSFORM === 'script', NO_APP ? await appBia.firstWindow() : null);

// A biblioteca do LiveKit da página da Bia (o mesmo módulo do app, pelo mesmo endereço), para guardar as publicações
// que ela assina: é por elas que se pede outra camada (setVideoQuality).
await B.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\.vite\/deps\/livekit-client\.js/.test(n));
  const lk = await import(url);
  window.__lk = lk;
  window.__publicacoes = new Set();
  const setTrack = lk.RemoteTrackPublication.prototype.setTrack;
  lk.RemoteTrackPublication.prototype.setTrack = function (...a) {
    window.__publicacoes.add(this);
    return setTrack.apply(this, a);
  };
});

await entrarNaSala(A);
await entrarNaSala(B);
ok('as duas estão na Sala 1, cada uma num Chrome');

/** Pergunta ao gancho, dentro do worker, pelo BroadcastChannel. */
const aoGancho = (pergunta) =>
  B.evaluate(
    (p) =>
      new Promise((pronto, erro) => {
        const canal = new BroadcastChannel('clipe-sem-recodificar');
        const id = Math.random().toString(36).slice(2);
        const prazo = setTimeout(() => erro(new Error('o gancho não respondeu: ' + p.pergunta)), 15000);
        canal.onmessage = (ev) => {
          if (ev.data?.resposta !== id) return;
          clearTimeout(prazo);
          canal.close();
          const { resposta, ...resto } = ev.data;
          pronto(resto);
        };
        canal.postMessage({ ...p, id });
      }),
    pergunta,
  );

// ---------- a Ana transmite, a Bia assiste ----------
await A.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
await A.locator('.screenshare-option').first().click();
await A.locator('.stage-main video').first().waitFor({ timeout: 25000 });
const convite = B.locator('.stream-invite');
await convite.waitFor({ timeout: 15000 }).catch(() => {});
if ((await convite.count()) > 0) await convite.getByRole('button').first().click();
await B.locator('.stage-main video, .stage video').first().waitFor({ timeout: 25000 });
ok('a Ana transmite e a Bia assiste');
const t0 = Date.now();

/** O codec de vídeo que sai (Ana) ou chega (Bia), pelo getStats. */
const codecs = (page, tipo) =>
  page.evaluate(async (tipo) => {
    const achados = new Set();
    for (const pc of window.__conexoes) {
      if (pc.connectionState === 'closed') continue;
      const r = await pc.getStats();
      r.forEach((s) => {
        if (s.type === tipo && s.kind === 'video' && (s.framesEncoded || s.framesDecoded) && s.codecId) achados.add(`${r.get(s.codecId)?.mimeType} ${s.frameWidth}x${s.frameHeight}${s.encoderImplementation ? ' ' + s.encoderImplementation : ''}${s.decoderImplementation ? ' ' + s.decoderImplementation : ''}`);
      });
    }
    return [...achados];
  }, tipo);

// ---------- 1. o gancho pega os quadros decifrados ----------
await B.waitForTimeout(5000);
let e = await aoGancho({ pergunta: 'estado' });
console.log(`  worker servido com o gancho: ${ganchoServido}x; caminho: ${e.caminho}; faixas embrulhadas: ${e.faixas}; RTCRtpScriptTransform na página: ${await B.evaluate(() => typeof RTCRtpScriptTransform !== 'undefined')}, RTCTransformEvent no worker: ${e.scriptTransformNoWorker}`);
e.quadros > 0 ? ok(`1. o gancho no worker pega os quadros de vídeo: ${e.quadros} em ~5 s, ${e.audio} de áudio passaram ao lado, último ${e.ultimo?.w}x${e.ultimo?.h} ${e.ultimo?.mime}`) : falhou('1. nenhum quadro de vídeo passou pelo gancho');
const faixasCifradas = await B.evaluate(() => {
  const pubs = [...window.__publicacoes].filter((p) => p.kind === 'video');
  return pubs.map((p) => ({ fonte: p.source, cifra: p.encryptionType ?? p.trackInfo?.encryption }));
});
console.log('  publicações de vídeo que a Bia assina:', JSON.stringify(faixasCifradas));
faixasCifradas.some((p) => p.cifra && p.cifra !== 0) ? ok('   a transmissão está cifrada de ponta a ponta (o LiveKit só repassa ruído)') : falhou('   a transmissão não está cifrada: o teste não mede o caso real');
console.log('  codec que SAI da Ana:', (await codecs(A, 'outbound-rtp')).join(' | '));
console.log('  codec que CHEGA à Bia:', (await codecs(B, 'inbound-rtp')).join(' | '));
const gravando = await B.evaluate(() => window.__gravadores.filter((g) => g.state === 'recording').map((g) => g.mimeType));
gravando.length ? ok(`   o gravador de clipes do app está rodando na Bia (${gravando.join(', ')})`) : falhou('   o gravador de clipes do app não está rodando na Bia');

// ---------- 2. os quadros-chave que chegam sozinhos ----------
const tObservar = performance.now();
const chavesAntes = e.chaves.length;
await B.waitForTimeout(OBSERVAR_S * 1000);
e = await aoGancho({ pergunta: 'estado' });
const chavesNaJanela = e.chaves.slice(chavesAntes);
const quadrosPorSeg = e.quadros / ((Date.now() - t0) / 1000);
console.log(`  ${OBSERVAR_S} s olhando: ${chavesNaJanela.length} quadro(s)-chave chegaram sozinhos ${JSON.stringify(chavesNaJanela.map((c) => ({ s: +((c.t - e.agora) / 1000).toFixed(1), dim: c.w + 'x' + c.h, kB: Math.round(c.bytes / 1024) })))}`);
console.log(`  desde o começo: ${e.chaves.length} chave(s) em ${((Date.now() - t0) / 1000).toFixed(0)} s, ~${quadrosPorSeg.toFixed(1)} quadros/s, ${(e.bytes / 1048576).toFixed(1)} MB`);
ok(`2a. quadros-chave sozinhos: ${chavesNaJanela.length} em ${OBSERVAR_S} s (sem pedido, o WebRTC quase não manda)`);
void tObservar;

// 2b. provocar um quadro-chave do lado de quem assiste, de três jeitos.
async function provocar(como, agir) {
  await aoGancho({ pergunta: 'provocar', como });
  if (agir) await agir();
  for (let i = 0; i < 50; i++) {
    await B.waitForTimeout(100);
    const s = await aoGancho({ pergunta: 'estado' });
    if (s.pedido?.ms != null) return s.pedido.ms;
  }
  return null;
}
const espaco = () => B.waitForTimeout(3000);
const medidas = {};
await espaco();
medidas.estragar = await provocar('estragar');
await espaco();
medidas.soltar = await provocar('soltar');
await espaco();
// Pedir a camada menor (o LiveKit troca de camada e o servidor pede um quadro-chave dela) e depois a maior de volta.
const trocar = (qualidade) =>
  B.evaluate((q) => {
    const pub = [...window.__publicacoes].find((p) => p.kind === 'video' && p.source === 'screen_share');
    pub.setVideoQuality(window.__lk.VideoQuality[q]);
  }, qualidade);
medidas.camadaMenor = await provocar('externo', () => trocar('LOW'));
await espaco();
medidas.camadaMaior = await provocar('externo', () => trocar('HIGH'));
if (process.env.TRANSFORM === 'script') {
  await espaco();
  medidas.sendKeyFrameRequest = await provocar('pedir');
  console.log('  respostas do sendKeyFrameRequest:', JSON.stringify((await aoGancho({ pergunta: 'estado' })).respostasDoPedido));
}
await espaco();
for (const [como, ms] of Object.entries(medidas)) {
  ms != null ? ok(`2b. provocado por "${como}": o quadro-chave chegou em ${ms} ms`) : falhou(`2b. provocado por "${como}": nenhum quadro-chave em 5 s`);
}
e = await aoGancho({ pergunta: 'estado' });
console.log('  as chaves provocadas:', JSON.stringify(e.chaves.slice(-6).map((c) => ({ motivo: c.motivo, dim: c.w + 'x' + c.h, kB: Math.round(c.bytes / 1024) }))));

// ---------- 3. os quadros guardados servem ----------
// Garante ~30 s de anel depois de um quadro-chave provocado: espera, e monta a partir da chave mais antiga da janela.
await B.waitForTimeout(RAPIDO ? 8000 : 25000);
const montagem = await B.evaluate(
  async ({ muxer, codec }) => {
    const canal = new BroadcastChannel('clipe-sem-recodificar');
    const id = 'anel';
    const r = await new Promise((pronto) => {
      canal.onmessage = (ev) => ev.data?.resposta === id && pronto(ev.data);
      canal.postMessage({ pergunta: 'anel', segundos: 30, id });
    });
    canal.close();
    const fim = r.agora;
    const todos = r.quadros;
    // a janela de 30 s, começando no quadro-chave mais perto ANTES do começo (ou o primeiro depois dele)
    let inicio = todos.findIndex((q) => q.t >= fim - 30000);
    let k = inicio;
    while (k > 0 && todos[k].tipo !== 'key') k--;
    if (todos[k]?.tipo !== 'key') k = todos.findIndex((q, i) => i >= inicio && q.tipo === 'key');
    const janela = todos.slice(k);
    const mime = janela[0].mime ?? { vp8: 'video/VP8', vp9: 'video/VP9', h264: 'video/H264' }[codec];
    // o tempo pelo carimbo RTP (90 kHz), desembrulhado
    let base = janela[0].rtp, acum = 0, anterior = base, fora = 0;
    const us = janela.map((q) => {
      let d = (q.rtp - anterior) >>> 0;
      if (d > 0x7fffffff) { fora++; d = 0; }
      acum += d;
      anterior = q.rtp;
      return Math.round((acum * 1e6) / 90000);
    });
    void base;
    const codecWebCodecs = { 'video/VP8': 'vp8', 'video/VP9': 'vp09.00.10.08', 'video/H264': 'avc1.42001f' }[mime];
    let decodificados = 0, erros = [];
    const dims = new Set();
    const t0 = performance.now();
    const dec = new VideoDecoder({ output: (f) => { decodificados++; dims.add(f.codedWidth + 'x' + f.codedHeight); f.close(); }, error: (e) => erros.push(String(e)) });
    dec.configure({ codec: codecWebCodecs, hardwareAcceleration: 'prefer-software' });
    for (let i = 0; i < janela.length; i++) {
      if (dec.state === 'closed') break;
      dec.decode(new EncodedVideoChunk({ type: janela[i].tipo === 'key' ? 'key' : 'delta', timestamp: us[i], data: janela[i].dados }));
      if (dec.decodeQueueSize > 30) await new Promise((p) => setTimeout(p, 5));
    }
    if (dec.state !== 'closed') await dec.flush().catch((e) => erros.push(String(e)));
    const msDecodificar = performance.now() - t0;
    const resultado = {
      mime, quadros: janela.length, chavesNaJanela: janela.filter((q) => q.tipo === 'key').length, segundos: us.at(-1) / 1e6,
      comecoAntes: (fim - janela[0].t) / 1000, decodificados, erros: erros.slice(0, 3), dims: [...dims], msDecodificar: Math.round(msDecodificar), voltas: fora,
      mb: janela.reduce((s, q) => s + q.dados.byteLength, 0) / 1048576,
    };
    // o WebM, sem recodificar
    if (mime === 'video/H264') {
      resultado.webm = 'pulado: H.264 não entra em WebM (pede MP4 ou Matroska, com o avcC tirado do SPS/PPS)';
      return resultado;
    }
    const { Muxer, ArrayBufferTarget } = await import(muxer);
    const t1 = performance.now();
    const maior = janela.reduce((m, q) => (q.w * q.h > m.w * m.h ? q : m), janela[0]);
    const mux = new Muxer({ target: new ArrayBufferTarget(), video: { codec: mime === 'video/VP9' ? 'V_VP9' : 'V_VP8', width: maior.w, height: maior.h, frameRate: 30 }, firstTimestampBehavior: 'offset' });
    for (let i = 0; i < janela.length; i++) mux.addVideoChunkRaw(new Uint8Array(janela[i].dados), janela[i].tipo === 'key' ? 'key' : 'delta', us[i]);
    mux.finalize();
    const buffer = mux.target.buffer;
    resultado.msMontar = Math.round(performance.now() - t1);
    resultado.mbArquivo = buffer.byteLength / 1048576;
    // toca?
    const url = URL.createObjectURL(new Blob([buffer], { type: 'video/webm' }));
    const v = Object.assign(document.createElement('video'), { muted: true, src: url });
    document.body.append(v);
    await new Promise((p, e) => { v.onloadedmetadata = p; v.onerror = () => e(new Error('o <video> recusou: ' + v.error?.message)); }).catch((e) => (resultado.erroVideo = String(e)));
    resultado.duracaoNoVideo = v.duration;
    resultado.videoDim = v.videoWidth + 'x' + v.videoHeight;
    if (!resultado.erroVideo) {
      v.currentTime = Math.max(0, v.duration - 1);
      await new Promise((p) => { v.onseeked = p; setTimeout(p, 3000); });
      resultado.pulouAteFim = v.currentTime;
      v.currentTime = 0;
      await new Promise((p) => { v.onseeked = p; setTimeout(p, 3000); });
      await v.play().catch(() => {});
      await new Promise((p) => setTimeout(p, 2000));
      resultado.tocou = v.currentTime;
      resultado.quadrosMostrados = v.getVideoPlaybackQuality?.().totalVideoFrames;
    }
    v.remove();
    // o arquivo, para o ffprobe
    let bin = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    resultado.base64 = btoa(bin);
    return resultado;
  },
  { muxer: WEBM_MUXER, codec: CODEC },
);
const { base64, ...semArquivo } = montagem;
console.log('  montagem:', JSON.stringify(semArquivo));
montagem.decodificados > 0 && montagem.decodificados >= montagem.quadros - 2 && !montagem.erros.length
  ? ok(`3a. o VideoDecoder decodificou ${montagem.decodificados} de ${montagem.quadros} quadros guardados (${montagem.segundos.toFixed(1)} s, ${montagem.dims.join(', ')}) sem erro, em ${montagem.msDecodificar} ms`)
  : falhou(`3a. decodificou ${montagem.decodificados} de ${montagem.quadros}, erros: ${montagem.erros.join(' | ')}`);
if (base64) {
  const pasta = join(tmpdir(), 'syden-clipe-sem-recodificar');
  mkdirSync(pasta, { recursive: true });
  const arquivo = join(pasta, `clipe-${CODEC}.webm`);
  writeFileSync(arquivo, Buffer.from(base64, 'base64'));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,width,height,nb_read_frames:format=duration', '-of', 'json', arquivo], { encoding: 'utf8' });
  console.log(`  arquivo: ${arquivo}`);
  console.log('  ffprobe:', (probe.stdout || probe.stderr || '(sem ffprobe)').replace(/\s+/g, ' ').slice(0, 400));
  const certo = Math.abs(montagem.duracaoNoVideo - montagem.segundos) < 1.5 && montagem.tocou > 0.5 && !montagem.erroVideo;
  certo
    ? ok(`3b. o WebM montado sem recodificar toca: ${montagem.mbArquivo.toFixed(1)} MB em ${montagem.msMontar} ms, duração ${montagem.duracaoNoVideo.toFixed(1)} s no <video>, ${montagem.videoDim}, pulou até ${montagem.pulouAteFim?.toFixed(1)} s, tocou ${montagem.tocou?.toFixed(1)} s`)
    : falhou(`3b. o WebM não tocou direito: ${JSON.stringify({ d: montagem.duracaoNoVideo, tocou: montagem.tocou, erro: montagem.erroVideo })}`);
} else console.log('  ' + montagem.webm);

// ---------- 4. o processador de quem assiste ----------
// Por tipo de processo do Chrome da Bia (o MediaRecorder codifica no processo da página, o "renderer"). As fases se
// alternam (gravador+cópia, só cópia, de novo as duas, nada), porque a imagem que chega muda de tamanho sozinha (a
// Ana, sem placa no teste, encolhe a transmissão quando aperta) e uma fase só mediria a variação, não o gravador.
const cdp = NO_APP ? null : await navBia.browser.newBrowserCDPSession();
const cpuPorTipo = async () => {
  const r = {};
  if (NO_APP) {
    // no app, pelo próprio Electron: o tempo de processador acumulado (s) de cada processo; a página é o 'Tab'
    for (const m of await appBia.evaluate(({ app }) => app.getAppMetrics().map((x) => ({ type: x.type, cpu: x.cpu.cumulativeCPUUsage ?? 0 })))) {
      const tipo = m.type === 'Tab' ? 'renderer' : m.type.toLowerCase();
      r[tipo] = (r[tipo] ?? 0) + m.cpu;
    }
    r.total = Object.values(r).reduce((a, b) => a + b, 0);
    return r;
  }
  for (const p of (await cdp.send('SystemInfo.getProcessInfo')).processInfo) r[p.type] = (r[p.type] ?? 0) + p.cpuTime;
  r.total = Object.values(r).reduce((a, b) => a + b, 0);
  return r;
};
const chegando = () =>
  B.evaluate(async () => {
    for (const pc of window.__conexoes) {
      if (pc.connectionState === 'closed') continue;
      let achado = null;
      (await pc.getStats()).forEach((s) => {
        if (s.type === 'inbound-rtp' && s.kind === 'video' && s.framesDecoded) achado = `${s.frameWidth}x${s.frameHeight}@${Math.round(s.framesPerSecond ?? 0)}`;
      });
      if (achado) return achado;
    }
    return '?';
  });
async function fase(nome) {
  const c0 = await cpuPorTipo(), t = Date.now(), antes = await chegando();
  await B.waitForTimeout(FASE_S * 1000);
  const c1 = await cpuPorTipo(), s = (Date.now() - t) / 1000;
  const n = Object.fromEntries(Object.keys(c1).map((k) => [k, (c1[k] - (c0[k] ?? 0)) / s]));
  console.log(`  ${nome}: página ${n.renderer.toFixed(2)} · total ${n.total.toFixed(2)} núcleo (${Object.entries(n).filter(([k]) => k !== 'total' && k !== 'renderer').map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ')}) · chegando ${antes} → ${await chegando()}`);
  return n;
}
const ligarGravador = () =>
  B.evaluate(() => {
    window.__semGravador = false;
    // os dois últimos que o clips.ts criou (o do vídeo e o das vozes) são os que ele usa: começam de novo
    const ultimos = new Map();
    for (const g of window.__gravadores) ultimos.set(g.mimeType.startsWith('audio') ? 'a' : 'v', g);
    for (const g of ultimos.values()) if (g.state === 'inactive') g.start();
  });
const rodando = () => B.evaluate(() => window.__gravadores.filter((g) => g.state === 'recording').length);
const fases = { comGravador: [], soCopia: [], nada: [] };
for (let volta = 0; volta < 2; volta++) {
  if (volta) await ligarGravador();
  await B.waitForTimeout(1500);
  if (!(await rodando())) falhou('   o gravador do app não voltou a gravar');
  fases.comGravador.push(await fase('gravador do app + cópia'));
  await B.evaluate(() => window.__desligarGravador());
  await B.waitForTimeout(1500);
  const restam = await rodando();
  if (restam) falhou(`   ainda há ${restam} gravador(es) rodando`);
  fases.soCopia.push(await fase('só a cópia'));
}
const s1 = await aoGancho({ pergunta: 'estado' });
await aoGancho({ pergunta: 'copiar', valor: false });
fases.nada.push(await fase('nada (sem gravador e sem cópia)'));
await aoGancho({ pergunta: 'copiar', valor: true });
fases.soCopia.push(await fase('só a cópia, de novo'));
const s3 = await aoGancho({ pergunta: 'estado' });
const media = (l, k) => l.reduce((a, n) => a + n[k], 0) / l.length;
const custoMsPorSeg = (s3.custoMs - s1.custoMs) / ((s3.agora - s1.agora) / 1000);
for (const k of ['renderer', 'total']) {
  console.log(`  média (${k}): gravador+cópia ${media(fases.comGravador, k).toFixed(2)}, só cópia ${media(fases.soCopia, k).toFixed(2)}, nada ${media(fases.nada, k).toFixed(2)}`);
}
ok(`4a. processador de quem assiste (página): o gravador do app ≈ ${(media(fases.comGravador, 'renderer') - media(fases.soCopia, 'renderer')).toFixed(2)} núcleo; a cópia ≈ ${(media(fases.soCopia, 'renderer') - media(fases.nada, 'renderer')).toFixed(2)} núcleo pela diferença, e ${custoMsPorSeg.toFixed(1)} ms por segundo (${(custoMsPorSeg / 1000).toFixed(4)} núcleo) medidos dentro do worker`);
ok(`4b. o anel de 30 s ocupa ${s3.mb30s.toFixed(1)} MB (${s3.quadros30s} quadros; ${((s3.mb30s * 8) / 30).toFixed(2)} Mbps chegando)`);

await navAna.browser.close();
await (NO_APP ? appBia.close() : navBia.browser.close());
resumo(`clipe-sem-recodificar (${CODEC})`);
