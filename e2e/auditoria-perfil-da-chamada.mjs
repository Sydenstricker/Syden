// O PERFIL DA CHAMADA SÓ DE VOZ, SEM FOCO (14/11/2026, a segunda parte da auditoria de desempenho): o que a página de quem
// joga faz durante 20 s, função por função (o Profiler do Chrome), com um amigo falando na sala e o microfone com ruído
// de quarto. Imprime as funções que mais gastam (tempo próprio) e se a supressão de ruído está rodando.
//   node e2e/auditoria-perfil-da-chamada.mjs   (API 3099, site 5174, LiveKit local)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, vigiar } from './ajuda.mjs';

const s = Date.now().toString().slice(-5);
function wav() {
  const taxa = 48000, n = taxa * 30, d = Buffer.alloc(n * 2);
  let m = 0;
  for (let i = 0; i < n; i++) {
    m = m * 0.98 + (Math.random() * 2 - 1) * 0.02;
    const t = i / taxa, voz = Math.sin(2 * Math.PI * 0.7 * t) > 0.2 ? 0.12 * Math.sin(2 * Math.PI * 200 * t) : 0;
    d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m * 0.5 + voz)) * 32767), i * 2);
  }
  const c = Buffer.alloc(44);
  c.write('RIFF', 0); c.writeUInt32LE(36 + d.length, 4); c.write('WAVEfmt ', 8); c.writeUInt32LE(16, 16); c.writeUInt16LE(1, 20);
  c.writeUInt16LE(1, 22); c.writeUInt32LE(taxa, 24); c.writeUInt32LE(taxa * 2, 28); c.writeUInt16LE(2, 32); c.writeUInt16LE(16, 34);
  c.write('data', 36); c.writeUInt32LE(d.length, 40);
  const f = join(tmpdir(), `syden-perfil-${s}.wav`);
  writeFileSync(f, Buffer.concat([c, d]));
  return f;
}
const SEM_FOCO = () => { const hf = Document.prototype.hasFocus; window.__semFoco = false; Document.prototype.hasFocus = function () { return window.__semFoco ? false : hf.call(this); }; };
const arq = wav();
const navs = [];
try {
  async function entrar(nome) {
    const { browser, contexto } = await abrirNavegador({ permissoes: ['microphone'], audioFalso: arq });
    navs.push(browser);
    const p = vigiar(await contexto.newPage());
    await p.addInitScript(SEM_FOCO);
    await cadastrar(p, nome);
    await dispensarPresentes(p);
    await p.locator('.rail-item:not(.rail-action)').first().click();
    await p.locator('.channel-name', { hasText: /^Sala 2$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
    return { p, browser };
  }
  await entrar('amigo' + s);
  const { p: eu, browser } = await entrar('perfil' + s);
  await eu.waitForTimeout(8000);
  for (const f of eu.frames()) await f.evaluate(() => { window.__semFoco = true; window.dispatchEvent(new Event('blur')); }).catch(() => {});
  await eu.waitForTimeout(5000);
  console.log('supressão:', JSON.stringify(await eu.evaluate(() => window.sydenSupressao ?? null)));
  const cdp = await eu.context().newCDPSession(eu);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await eu.waitForTimeout(20000);
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync('e2e/fotos/perfil-da-chamada.cpuprofile', JSON.stringify(profile));
  const dt = {};
  for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] ?? 0) + (profile.timeDeltas[i] ?? 0);
  const porNo = new Map(profile.nodes.map((n) => [n.id, n]));
  const proprio = {};
  for (const [id, us] of Object.entries(dt)) {
    const n = porNo.get(Number(id)), cf = n.callFrame;
    const nome = `${cf.functionName || '(anônima)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
    proprio[nome] = (proprio[nome] ?? 0) + us;
  }
  const total = Object.values(proprio).reduce((a, b) => a + b, 0);
  const ocupado = Object.entries(proprio).filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  console.log(`linha principal ocupada: ${(ocupado / total * 100).toFixed(1)}% dos 20 s; (program) ${((proprio['(program) :0'] ?? 0) / total * 100).toFixed(1)}%, GC ${((proprio['(garbage collector) :0'] ?? 0) / total * 100).toFixed(1)}%`);
  for (const [k, v] of Object.entries(proprio).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`);
  console.log('supressão (fim):', JSON.stringify(await eu.evaluate(() => window.sydenSupressao ?? null)));
} catch (e) {
  console.log('PAROU:', String(e?.stack ?? e).slice(0, 500));
} finally {
  for (const b of navs) await b.close().catch(() => {});
}
