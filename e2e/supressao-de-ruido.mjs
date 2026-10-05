// A supressão de ruído do Syden, de ponta a ponta: o som sai do microfone de uma pessoa, passa pelo GTCRN
// em JavaScript puro (web/public/ruido) e chega pela sala a outra pessoa.
//
// A Ana fala; a Bia entra muda e grava o que ouve. Roda duas vezes:
//   - "syden":     o caminho de hoje — só o GTCRN (a supressão do navegador fica sempre desligada,
//                  decisão de 05/10/2026);
//   - "navegador": sem modelo nenhum. O teste BLOQUEIA o download do modelo, e o Syden tem de seguir sem
//                  supressão: é o que acontece quando o modelo falha, e a voz não pode parar por isso. (Tirar o AudioWorklet da página não serve para simular:
//                  o próprio LiveKit usa, e a publicação do microfone trava.)
//
// O que se confere: o modelo foi baixado, o som chegou à Bia, a thread de áudio deu conta (o quadro
// custa menos que os 16 ms que ele dura) e nenhum erro apareceu. Com uma gravação de voz com ruído, o
// teste também diz o chão de ruído nas pausas, nos dois caminhos — e guarda o que a Bia ouviu, para
// ser julgado de ouvido ou pelo DNSMOS.
//
// Precisa do LiveKit no ar:  npm run dev:livekit
//
//   node e2e/supressao-de-ruido.mjs                    (o bipe do Chrome: só a mecânica)
//   node e2e/supressao-de-ruido.mjs voz-com-ruido.wav  (WAV mono de 48 kHz)
//
// COM_CSP=1 põe na página a política de segurança do site (e2e/politica-de-seguranca.mjs), com os
// endereços de produção trocados pelos locais, e falha com qualquer violação. Precisa do site
// CONSTRUÍDO (vite build + vite preview): o servidor de desenvolvimento usa script embutido, que a
// política barra por conta própria. Foi assim que se provou, em 04/10/2026, que a supressão de ruído
// não exige mudança nenhuma na política que mora na Cloudflare.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';
import { CSP } from './politica-de-seguranca.mjs';

const CSP_LOCAL = process.env.COM_CSP
  ? CSP.replaceAll('https://api.syden.chat', 'http://localhost:3099')
      .replaceAll('wss://api.syden.chat', 'ws://localhost:3099')
      .replaceAll('https://live.syden.chat', 'http://localhost:7880')
      .replaceAll('wss://live.syden.chat', 'ws://localhost:7880')
  : null;

const ARQUIVO = process.argv[2] ? path.resolve(process.argv[2]) : null;
const SEGUNDOS = 24;

/** Grava, na página da Bia, o som que chega da Ana, e devolve as amostras (48 kHz, mono). */
async function gravarOQueChega(page, segundos) {
  return page.evaluate(async (segundos) => {
    const audio = [...document.querySelectorAll('audio')].find((a) => a.srcObject?.getAudioTracks().length);
    if (!audio) return null;
    const ctx = new AudioContext({ sampleRate: 48000 });
    const fonte = ctx.createMediaStreamSource(audio.srcObject);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const pedacos = [];
    proc.onaudioprocess = (e) => pedacos.push(Array.from(e.inputBuffer.getChannelData(0)));
    fonte.connect(proc);
    proc.connect(ctx.destination);
    await new Promise((ok) => setTimeout(ok, segundos * 1000));
    await ctx.close();
    return pedacos.flat();
  }, segundos);
}

/** dB do RMS em quadros de 20 ms: percentil 10 (as pausas) e 90 (a fala). */
function niveis(x) {
  const q = 960, db = [];
  for (let i = 0; i + q <= x.length; i += q) {
    let e = 0;
    for (let j = 0; j < q; j++) e += x[i + j] ** 2;
    db.push(10 * Math.log10(e / q + 1e-12));
  }
  db.sort((a, b) => a - b);
  return { pausa: db[Math.floor(db.length * 0.1)], fala: db[Math.floor(db.length * 0.9)] };
}

function salvarWav(arquivo, x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(96000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(arquivo, b);
}

async function rodada(modo) {
  // Com a política injetada pelo teste, o Chrome passa a tratar a página como "de fora" e barra as
  // chamadas dela para localhost (proteção de rede local) — coisa do teste, que em produção não existe:
  // lá tudo está em domínio de verdade. Desligada só neste navegador de teste.
  const argsExtras = CSP_LOCAL ? ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] : [];
  const { browser } = await abrirNavegador({ audioFalso: ARQUIVO, argsExtras });
  const pessoa = async (prefixo, { semModelo = false, muda = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['microphone'] });
    if (CSP_LOCAL) {
      await ctx.route('**/*', async (rota) => {
        if (rota.request().resourceType() !== 'document') return rota.continue();
        const resposta = await rota.fetch();
        await rota.fulfill({ response: resposta, headers: { ...resposta.headers(), 'content-security-policy': CSP_LOCAL } });
      });
      await ctx.addInitScript(() => {
        window.__violacoes = [];
        document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`));
      });
    }
    const page = vigiar(await ctx.newPage());
    if (semModelo) await page.route('**/ruido/gtcrn.*', (r) => r.abort());
    if (muda) await page.addInitScript(() => localStorage.setItem('janja.settings', JSON.stringify({ startMuted: true })));
    await criarConta(page, prefixo);
    await dispensarPresentes(page);
    return page;
  };

  const ana = await pessoa('ruido' + modo.slice(0, 3), { semModelo: modo === 'navegador' });
  if (process.env.DEPURAR) ana.on('console', (m) => console.log('   [ana]', m.type(), m.text().slice(0, 200)));
  let baixouModelo = false;
  ana.on('requestfinished', (r) => { if (r.url().endsWith('/ruido/gtcrn.bin')) baixouModelo = true; });
  await ana.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await ana.getByText('Criar a minha').click();
  const comunidade = 'Ruído ' + Date.now().toString().slice(-5);
  await ana.getByLabel('Nome da comunidade').fill(comunidade);
  await ana.locator('.dialog .btn-primary').click();
  await ana.locator('.channel-list').waitFor({ timeout: 20000 });
  await ana.locator('button[aria-label="Configurações"]').first().click();
  await ana.locator('.settings-tab', { hasText: /Comunidade/ }).first().click();
  await ana.locator('.invite-row input, .invite-row code').first().waitFor({ timeout: 10000 });
  const convite = (await ana.locator('.invite-row input').first().inputValue().catch(() => null)) ?? (await ana.locator('.invite-row code').first().innerText());
  await ana.keyboard.press('Escape');

  const bia = await pessoa('ouve' + modo.slice(0, 3), { muda: true });
  await bia.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
  await bia.getByText('Entrar com um convite').click();
  await bia.getByLabel('Código de convite').fill(convite.trim());
  await bia.locator('.dialog .btn-primary').click();
  await bia.locator('.channel-list').waitFor({ timeout: 20000 });

  for (const page of [bia, ana]) {
    // PELO NOME, e não "a última da lista": toda conta nova também cai na comunidade inicial do servidor,
    // e a ordem das duas na barra muda. Pela posição, a Bia já entrou numa sala vazia de outra comunidade
    // e o teste acusou a supressão de não deixar o som chegar.
    await page.locator(`.rail-list .rail-item[aria-label="${comunidade}"]`).click();
    await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await page.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  await bia.waitForTimeout(3000); // o som da Ana chegar e a supressão aquecer

  const x = await gravarOQueChega(bia, SEGUNDOS);
  const custo = await ana.evaluate(() => window.sydenSupressao?.msPorQuadro ?? null);
  if (CSP_LOCAL) {
    const violacoes = [...(await ana.evaluate(() => window.__violacoes)), ...(await bia.evaluate(() => window.__violacoes))];
    violacoes.length === 0 ? ok(`${modo}: a política de segurança do site não barrou nada`) : falhou(`${modo}: a política barrou: ${[...new Set(violacoes)].join(' | ')}`);
  }
  await browser.close();
  return { x, custo, baixouModelo };
}

const resultados = {};
for (const modo of (process.env.MODOS ?? 'syden,navegador').split(',')) {
  const { x, custo, baixouModelo } = await rodada(modo);
  if (!x || x.length < 48000 * 5) {
    falhou(`${modo}: a Bia não recebeu o som da Ana`);
    continue;
  }
  const n = niveis(x);
  resultados[modo] = n;
  n.fala > -60 ? ok(`${modo}: o som chegou à Bia (fala ${n.fala.toFixed(1)} dB, pausas ${n.pausa.toFixed(1)} dB)`) : falhou(`${modo}: chegou silêncio à Bia`);
  if (modo === 'syden') {
    baixouModelo ? ok('o modelo foi baixado do próprio site') : falhou('o modelo não foi baixado — a supressão não montou');
    if (custo === null) falhou('a thread de áudio não mediu o custo (a supressão não está rodando)');
    else custo < 16 ? ok(`cada quadro de 16 ms custa ${custo.toFixed(2)} ms na thread de áudio`) : falhou(`o quadro custa ${custo.toFixed(2)} ms — mais do que os 16 ms que ele dura`);
  } else {
    baixouModelo ? falhou('o download do modelo deveria ter sido bloqueado') : ok('sem o modelo, a voz continua saindo (sem supressão nenhuma)');
  }
  if (ARQUIVO) {
    const destino = path.join(os.tmpdir(), `syden-ruido-${modo}.wav`);
    salvarWav(destino, x);
    console.log(`   o que a Bia ouviu: ${destino}`);
  }
}

if (ARQUIVO && resultados.syden && resultados.navegador) {
  const d = resultados.navegador.pausa - resultados.syden.pausa;
  d > 3 ? ok(`nas pausas, o ruído caiu ${d.toFixed(1)} dB em relação a não ter supressão`) : falhou(`nas pausas, o ruído só caiu ${d.toFixed(1)} dB`);
}

resumo('Supressão de ruído');
