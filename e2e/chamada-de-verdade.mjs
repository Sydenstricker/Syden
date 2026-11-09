// A CHAMADA DE VERDADE (09/11/2026): o que o commit dos relatos da turma consertou, conferido numa sala de voz com o
// LiveKit, três pessoas e o DOM real — e não no estado do React.
//
//   a) O mudo da live: a Bia assiste à tela da Ana (com som) e cala a transmissão. O <audio> que carrega o som da tela
//      vai a 0; ela fecha e abre de novo (o som é baixado de novo, num elemento novo) e ele CONTINUA a 0 enquanto o botão
//      diz "calada" — era aqui o defeito (o LiveKit só reaplica o volume `if (this.elementVolume)`, e 0 é falso). Depois
//      volta. E pelo caminho do reforço (acima de 100%, Web Audio): o ganho de verdade vai a 0 e volta.
//   b) Esconder os outros quadros: a faixa de baixo some, o quadro em foco cresce, e volta.
//   c) O avatar animado (GIF enviado e WEBP animado, que é o que o link do GIPHY traz): parado na lista de membros e na
//      lista da sala, anima com o mouse na linha; num celular (toque), o toque não o deixa animando.
//   d) Os botões da chamada: redondos (largura = altura) e dentro da tela, a 1400 e a 390 px.
//
// A tela compartilhada é um canvas com um tom (o truque do sob-demanda.mjs): o Chrome sem janela não tem tela para dar.
//
//   node e2e/chamada-de-verdade.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880; ver e2e/LEIA.md)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const foto = (page, nome) => page.screenshot({ path: path.join(FOTOS, `chamada-de-verdade-${nome}.png`) });
const API = process.env.API ?? 'http://localhost:3099';
const GIF = path.join('e2e', 'pixel-art', 'personagem', 'blender', 'c', 'varrendo.gif');
const s = Date.now().toString().slice(-5);

/** A tela falsa: um canvas que mexe e um tom de 440 Hz, para a transmissão ter faixa de som. */
const TELA_FALSA = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => {
      n++;
      ctx.fillStyle = `hsl(${n % 360} 60% 30%)`;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#fff';
      ctx.fillRect((n * 9) % 1200, 300, 80, 80);
    }, 1000 / 30);
    const stream = canvas.captureStream(30);
    const ctxAudio = new AudioContext();
    const osc = ctxAudio.createOscillator();
    const destino = ctxAudio.createMediaStreamDestination();
    const ganho = ctxAudio.createGain();
    ganho.gain.value = 0.2;
    osc.connect(ganho).connect(destino);
    osc.start();
    stream.addTrack(destino.stream.getAudioTracks()[0]);
    return stream;
  };
};

/** Guarda os nós de ganho criados, para ler o ganho de verdade do caminho de Web Audio (o reforço acima de 100%). */
const ESPIAO_DE_GANHO = () => {
  window.__ganhos = [];
  const original = BaseAudioContext.prototype.createGain;
  BaseAudioContext.prototype.createGain = function (...args) {
    const no = original.apply(this, args);
    window.__ganhos.push(no);
    return no;
  };
};

const { browser } = await abrirNavegador();
const pessoa = async (opcoes = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone', 'camera'], ...opcoes });
  const page = vigiar(await ctx.newPage());
  await page.addInitScript(TELA_FALSA);
  await page.addInitScript(ESPIAO_DE_GANHO);
  return page;
};
const token = (page) => page.evaluate(() => localStorage.getItem('janja.token'));
const entrarNaComunidade = async (page, convite) => {
  await page.evaluate(
    async ({ api, codigo }) =>
      fetch(api + '/api/communities/join', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: JSON.stringify({ code: codigo }),
      }),
    { api: API, codigo: convite },
  );
  await page.reload();
  await dispensarPresentes(page);
  await page.locator('.rail-item', { hasText: /^V/ }).first().click();
  await page.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
};
const entrarNaSala = async (page) => {
  await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await page.locator('.stage-controls').waitFor({ timeout: 30000 });
};

/** Os <audio> da página que tocam uma faixa viva: o id da faixa, o volume e o mudo do elemento. */
const audios = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('audio')]
      .map((el) => {
        const faixa = el.srcObject instanceof MediaStream ? el.srcObject.getAudioTracks()[0] : null;
        if (!faixa || faixa.readyState !== 'live') return null;
        el.__visto ??= Math.random().toString(36).slice(2, 8);
        return { id: faixa.id, elemento: el.__visto, volume: el.volume, muted: el.muted, paused: el.paused };
      })
      .filter(Boolean),
  );
/** Espera aparecer um <audio> com uma faixa que não estava em `conhecidas`. */
async function audioNovo(page, conhecidas, tempo = 20000) {
  const fim = Date.now() + tempo;
  while (Date.now() < fim) {
    const novo = (await audios(page)).find((a) => !conhecidas.has(a.elemento));
    if (novo) return novo;
    await page.waitForTimeout(150);
  }
  return null;
}
const doAudio = async (page, elemento) => (await audios(page)).find((a) => a.elemento === elemento) ?? null;

/** Um WEBP ANIMADO, montado aqui: os quadros saem do codificador WEBP do Chrome (um VP8 parado cada) e vão em ANMF. */
async function webpAnimado(page) {
  const quadros = await page.evaluate(async () => {
    const saida = [];
    for (const cor of ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f']) {
      const c = Object.assign(document.createElement('canvas'), { width: 96, height: 96 });
      const g = c.getContext('2d');
      g.fillStyle = cor;
      g.fillRect(0, 0, 96, 96);
      g.fillStyle = '#222';
      g.fillRect(20, 20, 56, 56);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.9));
      saida.push([...new Uint8Array(await blob.arrayBuffer())]);
    }
    return saida;
  });
  const pedaco = (tipo, dados) => {
    const cab = Buffer.alloc(8);
    cab.write(tipo, 0, 'latin1');
    cab.writeUInt32LE(dados.length, 4);
    return Buffer.concat([cab, dados, dados.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const u24 = (v) => Buffer.from([v & 255, (v >> 8) & 255, (v >> 16) & 255]);
  const anmf = quadros.map((bytes) => {
    const b = Buffer.from(bytes);
    // os pedaços de imagem do arquivo parado (ALPH, se houver, e o VP8/VP8L), copiados como estão
    const imagem = [];
    for (let em = 12; em + 8 <= b.length; ) {
      const tipo = b.subarray(em, em + 4).toString('latin1');
      const tam = b.readUInt32LE(em + 4);
      if (tipo === 'ALPH' || tipo === 'VP8 ' || tipo === 'VP8L') imagem.push(b.subarray(em, em + 8 + tam + (tam % 2)));
      em += 8 + tam + (tam % 2);
    }
    const cab = Buffer.concat([u24(0), u24(0), u24(95), u24(95), u24(200), Buffer.from([0])]);
    return pedaco('ANMF', Buffer.concat([cab, ...imagem]));
  });
  const vp8x = pedaco('VP8X', Buffer.concat([Buffer.from([0x02, 0, 0, 0]), u24(95), u24(95)]));
  const anim = pedaco('ANIM', Buffer.from([0, 0, 0, 0, 0, 0]));
  const corpo = Buffer.concat([Buffer.from('WEBP', 'latin1'), vp8x, anim, ...anmf]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(corpo.length, 4);
  return Buffer.concat([riff, corpo]);
}

try {
  // ================= as três pessoas, na mesma comunidade =================
  const ana = await pessoa();
  await cadastrar(ana, 'ana' + s);
  await dispensarPresentes(ana);
  await ana.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await ana.locator('.community-choice-option').first().click();
  await ana.locator('form.dialog input').first().fill('Voz ' + s);
  await ana.locator('form.dialog .btn-primary').click();
  await ana.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const convite = await ana.evaluate(async (api) => {
    const r = await fetch(api + '/api/communities', { headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token') } });
    return (await r.json()).find((c) => c.name.startsWith('Voz'))?.inviteCode;
  }, API);

  const bia = await pessoa();
  await cadastrar(bia, 'bia' + s);
  await dispensarPresentes(bia);
  await entrarNaComunidade(bia, convite);

  // a Ana manda uma mensagem (para o avatar aparecer na conversa do celular, em c)
  await ana.locator('.composer textarea, textarea').first().fill('oi turma');
  await ana.keyboard.press('Enter');

  await entrarNaSala(ana);
  await entrarNaSala(bia);
  ok('a Ana e a Bia estão na Sala 1');

  // ================= a) o mudo da live, no <audio> de verdade =================
  await ana.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await ana.locator('.screenshare-option').first().click();
  await ana.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  const convidando = bia.locator('.stream-invite', { hasText: 'ana' + s });
  await convidando.waitFor({ timeout: 20000 });
  ok('a Ana transmite a tela (com som)');

  const antesDeAssistir = new Set((await audios(bia)).map((a) => a.elemento));
  console.log(`  antes de assistir, a Bia tem ${antesDeAssistir.size} <audio> vivo(s) (a voz da Ana)`);
  await convidando.getByRole('button', { name: 'Assistir' }).click();
  await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
  const somDaTela = await audioNovo(bia, antesDeAssistir);
  if (!somDaTela) throw new Error('o som da tela não chegou à Bia como um <audio> (a faixa ScreenShareAudio foi publicada?)');
  console.log(`  o som da tela chegou: <audio> da faixa ${somDaTela.id.slice(0, 14)}…, volume ${somDaTela.volume}, muted ${somDaTela.muted}`);
  somDaTela.volume === 1 && !somDaTela.muted ? ok('assistindo, o som da tela toca a 100%') : falhou(`o som da tela começou em ${somDaTela.volume} (muted ${somDaTela.muted})`);

  const quadro = bia.locator('.stage-main', { has: bia.locator('.stream-controls') }).first();
  const botaoMudo = () => quadro.locator('.stream-audio > button.stream-info-button');
  const clicarMudo = async () => {
    await quadro.hover();
    await botaoMudo().click();
    await bia.waitForTimeout(400);
  };
  await clicarMudo();
  const calado = await doAudio(bia, somDaTela.elemento);
  const pressionado = await botaoMudo().getAttribute('aria-pressed');
  console.log(`  depois do clique: volume ${calado?.volume}, aria-pressed ${pressionado}`);
  calado?.volume === 0 && pressionado === 'true' ? ok('o clique no alto-falante leva o <audio> do som da tela a 0') : falhou(`calar deu volume ${calado?.volume}, aria-pressed ${pressionado}`);
  const vozDaAna = (await audios(bia)).filter((a) => antesDeAssistir.has(a.elemento));
  vozDaAna.every((a) => a.volume === 1) ? ok('a voz da Ana continua a 100% (o mudo é só da transmissão)') : falhou(`a voz da Ana mudou: ${JSON.stringify(vozDaAna)}`);

  // fechar e abrir de novo: o som é baixado de novo, numa faixa e num <audio> novos
  for (let volta = 1; volta <= 2; volta++) {
    await quadro.hover();
    await bia.locator('button[aria-label="Parar de assistir esta transmissão"]').first().click();
    await convidando.waitFor({ timeout: 15000 });
    // o som da tela deixa de ser baixado: o <audio> dele sai da página
    const saiu = await bia
      .waitForFunction((marca) => ![...document.querySelectorAll('audio')].some((el) => el.__visto === marca && el.isConnected && el.srcObject?.getAudioTracks?.()[0]?.readyState === 'live'), somDaTela.elemento, { timeout: 15000 })
      .then(() => true, () => false);
    console.log(`  volta ${volta}: ao fechar, o <audio> do som da tela ${saiu ? 'saiu da página' : 'CONTINUOU na página'}`);
    saiu ? ok(`volta ${volta}: fechar a transmissão tira o <audio> do som dela`) : falhou(`volta ${volta}: o <audio> do som continuou depois de fechar`);
    const conhecidas = new Set((await audios(bia)).map((a) => a.elemento));
    await convidando.getByRole('button', { name: 'Assistir' }).click();
    await bia.locator('.stage-main video').first().waitFor({ timeout: 20000 });
    const deNovo = await audioNovo(bia, conhecidas);
    if (!deNovo) {
      falhou(`volta ${volta}: o som da tela não voltou como <audio> novo`);
      continue;
    }
    // medir algumas vezes ao longo de 2 s: o defeito era o elemento NASCER a 100% (e assim ficar)
    const medidas = [];
    for (let i = 0; i < 5; i++) {
      await bia.waitForTimeout(400);
      medidas.push((await doAudio(bia, deNovo.elemento))?.volume);
    }
    await quadro.hover();
    const ainda = await botaoMudo().getAttribute('aria-pressed');
    const rotulo = await botaoMudo().getAttribute('aria-label');
    console.log(`  volta ${volta}: <audio> novo (${deNovo.elemento}, faixa ${deNovo.id === somDaTela.id ? 'com o mesmo id do LiveKit' : 'de id novo'}), volumes ${medidas.join(', ')}, aria-pressed ${ainda} ("${rotulo}")`);
    medidas.every((v) => v === 0) && ainda === 'true'
      ? ok(`volta ${volta}: fechou e abriu de novo, e o <audio> novo continua a 0 com o botão "calada"`)
      : falhou(`volta ${volta}: o <audio> novo tocou (volumes ${medidas.join(', ')}) com o botão aria-pressed ${ainda}`);
    Object.assign(somDaTela, deNovo);
  }
  await foto(bia, 'mudo');

  await clicarMudo();
  const devolvido = await doAudio(bia, somDaTela.elemento);
  (devolvido?.volume ?? 0) > 0 && (await botaoMudo().getAttribute('aria-pressed')) === 'false'
    ? ok(`o segundo clique devolve o som (volume ${devolvido.volume})`)
    : falhou(`o segundo clique deixou o volume em ${devolvido?.volume}`);

  // ---------- o caminho do reforço: acima de 100% o som passa por Web Audio, e o mudo é o GANHO ----------
  await quadro.locator('.stream-audio').hover();
  const regua = quadro.locator('input[aria-label="Volume da transmissão"]');
  await regua.waitFor({ timeout: 5000 });
  const ganhosAntes = await bia.evaluate(() => window.__ganhos.length);
  await regua.evaluate((el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.5');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await bia.waitForTimeout(1200);
  const ganhoDoReforco = await bia.evaluate((de) => {
    // o último ganho criado depois de mexer na régua é o do LiveKit (o teto do limitador vem antes dele)
    const novos = window.__ganhos.slice(de);
    const g = novos[novos.length - 1];
    return g ? { valor: g.gain.value, estado: g.context.state, novos: novos.length } : null;
  }, ganhosAntes);
  const elementoNoReforco = await doAudio(bia, somDaTela.elemento);
  console.log(`  reforço a 150%: ${JSON.stringify(ganhoDoReforco)}; o <audio> ficou com volume ${elementoNoReforco?.volume}, muted ${elementoNoReforco?.muted}, paused ${elementoNoReforco?.paused}`);
  // No reforço o som sai pelo Web Audio; o <audio> fica só como fonte (o LiveKit o cala quando liga já com o contexto). Se
  // ele continuar tocando, o som sai DUAS vezes (100% pelo elemento + 150% pelo ganho), e calar (ganho 0) deixa 100% tocando.
  const somPorFora = (a) => a && !a.paused && !a.muted && a.volume > 0;
  !somPorFora(elementoNoReforco) ? ok('no reforço, o <audio> não toca por fora do ganho') : falhou('no reforço, o <audio> continua tocando a ' + elementoNoReforco.volume + ' por fora do ganho (o som sai em dobro)');
  if (!ganhoDoReforco) falhou('a régua a 150% não ligou o caminho de Web Audio');
  else {
    Math.abs(ganhoDoReforco.valor - 1.5) < 0.05 ? ok(`a 150%, o ganho de verdade é ${ganhoDoReforco.valor.toFixed(2)}`) : falhou(`a 150%, o ganho é ${ganhoDoReforco.valor}`);
    const lerGanho = () => bia.evaluate((de) => window.__ganhos.slice(de).at(-1).gain.value, ganhosAntes);
    await clicarMudo();
    await bia.waitForTimeout(800);
    const ganhoCalado = await lerGanho();
    ganhoCalado < 0.01 ? ok(`calado no reforço, o ganho vai a ${ganhoCalado.toFixed(4)}`) : falhou(`calado no reforço, o ganho ficou em ${ganhoCalado}`);
    const elementoCalado = await doAudio(bia, somDaTela.elemento);
    !somPorFora(elementoCalado) ? ok('calado no reforço, nada toca pelo <audio>') : falhou(`calado no reforço, o <audio> continua tocando (volume ${elementoCalado.volume}, muted ${elementoCalado.muted})`);
    await clicarMudo();
    await bia.waitForTimeout(800);
    const ganhoDeVolta = await lerGanho();
    Math.abs(ganhoDeVolta - 1.5) < 0.05 ? ok(`e volta a ${ganhoDeVolta.toFixed(2)}`) : falhou(`depois de descalar no reforço, o ganho ficou em ${ganhoDeVolta}`);
  }
  // volta a régua a 100%, para o resto do teste
  await quadro.locator('.stream-audio').hover();
  await regua.evaluate((el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ================= b) esconder os outros quadros =================
  // Duas transmissões e as câmeras: a Bia também transmite e liga a câmera; o foco fica na tela da Ana.
  await bia.locator('.stage-controls button[aria-label="Compartilhar tela"]').click();
  await bia.locator('.screenshare-option').first().click();
  await bia.locator('.stage-controls button[aria-label="Ligar câmera"], .stage-controls button[aria-label="Ativar câmera"]').first().click().catch(() => {});
  await bia.waitForTimeout(2500);
  const telaDaAna = bia.locator('.stage-main', { hasText: 'ana' + s }).first();
  // se o palco se dividiu com as duas telas, um clique na da Ana volta ao destaque com ela
  if ((await bia.locator('.stage-focus .stage-main').count()) > 1) await telaDaAna.locator('video').first().click().catch(() => {});
  await bia.waitForTimeout(800);
  const nafaixa = await bia.locator('.stage-strip .tile').count();
  console.log(`  quadros na faixa de baixo: ${nafaixa}`);
  nafaixa >= 2 ? ok(`a faixa de baixo tem ${nafaixa} quadros`) : falhou(`a faixa de baixo tem só ${nafaixa} quadro(s)`);
  const emFoco = bia.locator('.stage-focus > .stage-main, .stage-focus .stage-main').first();
  const caixa = async () => {
    const b = await emFoco.boundingBox();
    return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const antes = await caixa();
  await foto(bia, 'faixa-visivel');
  const botaoFaixa = bia.locator('.stage-faixa-botao');
  const rotuloAntes = await botaoFaixa.getAttribute('aria-label');
  await botaoFaixa.click();
  await bia.waitForTimeout(600);
  const depois = await caixa();
  const faixaVisivel = await bia.locator('.stage-strip').isVisible().catch(() => false);
  const rotuloDepois = await botaoFaixa.getAttribute('aria-label');
  console.log(`  quadro em foco: ${JSON.stringify(antes)} → ${JSON.stringify(depois)}; botão "${rotuloAntes}" → "${rotuloDepois}"`);
  !faixaVisivel ? ok('esconder: a faixa de baixo não está mais na tela') : falhou('a faixa continuou visível');
  depois && antes && depois.h > antes.h + 40 ? ok(`o quadro em foco cresceu ${depois.h - antes.h} px de altura`) : falhou(`o quadro em foco não cresceu: ${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);
  rotuloDepois === 'Mostrar os outros quadros' && (await botaoFaixa.isVisible()) ? ok('o botão continua lá, agora "Mostrar os outros quadros"') : falhou(`o botão ficou "${rotuloDepois}"`);
  await foto(bia, 'faixa-escondida');
  await botaoFaixa.click();
  await bia.waitForTimeout(600);
  const deVolta = await caixa();
  (await bia.locator('.stage-strip').isVisible()) && (await bia.locator('.stage-strip .tile').count()) === nafaixa && deVolta?.h === antes?.h
    ? ok(`mostrar: a faixa volta com os ${nafaixa} quadros e o foco volta a ${deVolta.h} px`)
    : falhou(`mostrar de novo deu faixa visível ${await bia.locator('.stage-strip').isVisible()}, foco ${JSON.stringify(deVolta)}`);

  // ================= d) os botões da chamada, redondos e dentro da tela =================
  const conferirBotoes = async (page, largura) => {
    await page.setViewportSize({ width: largura, height: largura < 500 ? 844 : 900 });
    await page.waitForTimeout(800);
    const medidas = await page.evaluate(() =>
      [...document.querySelectorAll('.stage-controls .icon-button, .stage-controls .leave-button, .stage-controls button')]
        .filter((b) => b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden')
        .filter((b) => b.closest('.stage-controls') && b.parentElement.closest('[role="menu"]') === null)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { rotulo: b.getAttribute('aria-label') ?? b.className, w: +r.width.toFixed(1), h: +r.height.toFixed(1), esq: +r.left.toFixed(1), dir: +r.right.toFixed(1) };
        }),
    );
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    const tortos = medidas.filter((m) => Math.abs(m.w - m.h) > 1);
    const fora = medidas.filter((m) => m.esq < 0 || m.dir > vw + 0.5);
    console.log(`  a ${largura} px: ${medidas.length} botões, tamanhos ${[...new Set(medidas.map((m) => `${m.w}×${m.h}`))].join(', ')}`);
    medidas.length >= 4 ? ok(`a ${largura} px, ${medidas.length} botões na fileira`) : falhou(`a ${largura} px, só ${medidas.length} botões visíveis na fileira`);
    tortos.length === 0 ? ok(`a ${largura} px, todos redondos (largura = altura)`) : falhou(`a ${largura} px, ovais: ${JSON.stringify(tortos)}`);
    fora.length === 0 ? ok(`a ${largura} px, nenhum passa da borda (${vw} px)`) : falhou(`a ${largura} px, fora da tela: ${JSON.stringify(fora)}`);
    await page.locator('.stage-controls').first().screenshot({ path: path.join(FOTOS, `chamada-de-verdade-botoes-${largura}.png`) }).catch(() => {});
  };
  await conferirBotoes(bia, 1400);
  await conferirBotoes(bia, 390);
  await foto(bia, 'celular-390');
  await bia.setViewportSize({ width: 1400, height: 900 });
  await bia.waitForTimeout(500);

  // ================= c) o avatar animado =================
  // A Ana cala o microfone: o bipe do microfone falso a deixaria "falando", e falando o GIF anima de propósito.
  await ana.locator('.stage-controls button[aria-label="Silenciar"]').click();
  await ana.locator('button[aria-label="Configurações"]').first().click();
  await ana.locator('.settings-tab', { hasText: /Minha conta/ }).first().click();
  await ana.locator('.account-actions input[type=file]').setInputFiles(GIF);
  await ana.locator('.account-card .avatar img.avatar-foto').waitFor({ timeout: 15000 });
  await ana.keyboard.press('Escape');
  ok('a Ana pôs um GIF animado de avatar');

  const linhaDaAna = (page, onde) => page.locator(onde, { hasText: 'ana' + s }).first();
  const tagDoAvatar = (page, onde) => linhaDaAna(page, onde).locator('.avatar .avatar-foto').first().evaluate((el) => el.tagName).catch(() => '(nenhum)');
  const conferirAvatar = async (page, nome) => {
    for (const [onde, lugar] of [
      ['.member', 'na lista de membros'],
      ['.voice-member', 'na lista da sala'],
    ]) {
      await page.mouse.move(700, 5);
      await linhaDaAna(page, onde).locator('.avatar .avatar-foto').first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      const parado = await tagDoAvatar(page, onde);
      parado === 'CANVAS' ? ok(`${nome}, ${lugar}: parado sem o mouse (canvas)`) : falhou(`${nome}, ${lugar}: sem o mouse o avatar é ${parado}`);
      if (parado === 'CANVAS') {
        const png = await linhaDaAna(page, onde).locator('canvas.avatar-foto').screenshot();
        png.length > 600 ? ok(`${nome}, ${lugar}: o quadro parado tem desenho (${png.length} bytes)`) : falhou(`${nome}, ${lugar}: o quadro parado parece vazio (${png.length} bytes)`);
      }
      await linhaDaAna(page, onde).hover();
      await page.waitForTimeout(400);
      const comMouse = await tagDoAvatar(page, onde);
      comMouse === 'IMG' ? ok(`${nome}, ${lugar}: com o mouse na linha, anima (img)`) : falhou(`${nome}, ${lugar}: com o mouse, o avatar é ${comMouse}`);
      await page.mouse.move(700, 5);
      await page.waitForTimeout(400);
      const saiu = await tagDoAvatar(page, onde);
      saiu === 'CANVAS' ? ok(`${nome}, ${lugar}: o mouse saiu e parou de novo`) : falhou(`${nome}, ${lugar}: depois do mouse sair, ${saiu}`);
    }
  };
  await bia.waitForTimeout(1500);
  await conferirAvatar(bia, 'GIF');
  await foto(bia, 'avatar-gif');

  // ---------- o WEBP animado (o que o link do GIPHY traz), pela mesma rota que guarda o avatar ----------
  // A rota do link (/api/me/avatar/endereco) não alcança um servidor local (o DNS conferido recusa endereço interno, e é
  // de propósito); o que ela faz depois de baixar é o mesmo PUT /api/me/avatar, com os bytes como vieram.
  const webp = await webpAnimado(ana);
  fs.writeFileSync(path.join(FOTOS, 'chamada-de-verdade-animado.webp'), webp);
  const resposta = await ana.evaluate(
    async ({ api, dados }) => {
      const r = await fetch(api + '/api/me/avatar', {
        method: 'PUT',
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/webp;base64,' + dados }),
      });
      return { status: r.status, corpo: await r.json() };
    },
    { api: API, dados: webp.toString('base64') },
  );
  console.log(`  PUT do WEBP animado (${webp.length} bytes): ${resposta.status}, avatarAnimado ${resposta.corpo.avatarAnimado}`);
  resposta.status === 200 && resposta.corpo.avatarAnimado === true ? ok('o servidor marcou o WEBP animado como animado (pelos bytes)') : falhou(`o WEBP animado: ${JSON.stringify(resposta).slice(0, 200)}`);
  // a Bia recebe o user:updated: espera o avatar novo (outro ?v=) chegar ao hover
  await bia.waitForFunction(
    (v) => {
      const linha = [...document.querySelectorAll('.member')].find((el) => el.textContent.includes(v.nome));
      return linha && linha.querySelector('.avatar .avatar-foto');
    },
    { nome: 'ana' + s },
    { timeout: 10000 },
  );
  await bia.waitForTimeout(1500);
  await conferirAvatar(bia, 'WEBP');
  const srcNoHover = await (async () => {
    await linhaDaAna(bia, '.member').hover();
    await bia.waitForTimeout(400);
    return linhaDaAna(bia, '.member').locator('img.avatar-foto').evaluate((el) => ({ src: el.getAttribute('src'), w: el.naturalWidth })).catch(() => null);
  })();
  srcNoHover?.src?.includes('v=' + resposta.corpo.avatarVersion) && srcNoHover.w > 0
    ? ok(`no hover, a Bia vê o WEBP novo (${srcNoHover.w} px de largura)`)
    : falhou(`no hover, o avatar não é o WEBP novo: ${JSON.stringify(srcNoHover)} (versão ${resposta.corpo.avatarVersion})`);
  await bia.mouse.move(700, 5);

  // ---------- no celular: o toque não deixa o avatar animando ----------
  const caio = await pessoa({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await cadastrar(caio, 'caio' + s);
  await dispensarPresentes(caio);
  await entrarNaComunidade(caio, convite);
  await caio.locator('.channel-name', { hasText: /^geral$/ }).first().tap();
  const mensagem = caio.locator('.message', { hasText: 'oi turma' }).first();
  await mensagem.waitFor({ timeout: 15000 });
  const naMensagem = () => mensagem.locator('.avatar .avatar-foto').first().evaluate((el) => el.tagName).catch(() => '(nenhum)');
  await caio.waitForTimeout(800);
  const antesDoToque = await naMensagem();
  antesDoToque === 'CANVAS' ? ok('no celular, na mensagem: parado') : falhou(`no celular, na mensagem, antes do toque: ${antesDoToque}`);
  await mensagem.tap();
  const depoisDoToque = [];
  for (let i = 0; i < 4; i++) {
    await caio.waitForTimeout(400);
    depoisDoToque.push(await naMensagem());
  }
  console.log(`  no celular, depois do toque na mensagem: ${depoisDoToque.join(', ')}`);
  depoisDoToque.every((t) => t === 'CANVAS') ? ok('no celular, o toque na mensagem não deixa o avatar animando') : falhou(`no celular, depois do toque: ${depoisDoToque.join(', ')}`);
  // o toque na linha da pessoa (um botão) também: ele foca a linha, e o foco do toque não é o do teclado
  await caio.locator('.avatar', { has: caio.locator('.avatar-foto') }).first().waitFor({ timeout: 5000 }).catch(() => {});
  await foto(caio, 'celular-avatar');
} catch (erro) {
  falhou('parou no meio: ' + String(erro?.message ?? erro).split('\n')[0]);
} finally {
  await browser.close();
}
resumo('chamada de verdade');
