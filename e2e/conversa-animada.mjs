// A CONVERSA DO SITE, ANIMADA E LONGA (pedido de 10/10/2026: "gifs também nessa imagem, simulando uma conversa real
// com emojis e os gifs nossos; uma animação longa, para não ficar repetitivo").
//
// É uma conversa DE VERDADE no Syden local (API + Vite), no #ranked do squad de demonstração: cada pessoa entra pelo
// socket como o app entra, aparece "digitando", manda a mensagem, reage com emoji e manda os nossos GIFs em pixel art
// (pixel-art/demonstracao/gifs/, de gifs.mjs) pela mesma rota de anexo de qualquer pessoa. A tela do rafa é gravada
// pelo navegador, e o trecho vira WebP animado; no fim, a imagem dissolve de volta ao primeiro quadro, para o laço
// recomeçar sem salto.
//
// O #ranked é ESVAZIADO e refeito: começa com as três primeiras mensagens e termina com a conversa inteira.
//
// Escreve em web/site/capturas/pt-BR/: squad.webp (animada) e squad-parada.webp (o primeiro quadro, para quem pediu
// menos movimento — o <picture> de index.html). Precisa do ffmpeg no PATH.
//
//   API=http://localhost:3099 APP=http://localhost:5174/ SENHA_DEMO=... node e2e/conversa-animada.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';
import { abrirNavegador, dispensarPresentes } from './ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = process.env.API ?? 'http://localhost:3099';
const APP = process.env.APP ?? 'http://localhost:5174/';
const SENHA = process.env.SENHA_DEMO;
if (!SENHA) {
  console.error('Falta SENHA_DEMO (a senha das contas da demonstração).');
  process.exit(1);
}
const GIFS = path.join(AQUI, 'pixel-art', 'demonstracao', 'gifs');
const DESTINO = path.join(AQUI, '..', 'web', 'site', 'capturas', 'pt-BR');
const COMUNIDADE = 'Squad das Sextas';
const QUEM_ASSISTE = 'rafa';

/** O que já estava no canal quando a imagem começa. */
const HISTORIA = [
  ['kai', 'sexta chegou :bora: quem cola na call?'],
  ['helena', 'eu! acabei o trampo agora'],
  ['rafa', 'tô dentro. hoje eu carrego vocês'],
];
/**
 * O roteiro, em segundos desde o começo da imagem. `digita` é o intervalo em que a pessoa aparece digitando antes de
 * mandar; `reage` põe um emoji na mensagem de `em` (o índice da mensagem, contando a história).
 */
const ROTEIRO = [
  { t: 2.6, quem: 'bento', digita: 1.6, texto: ':kkkk: falou o mesmo semana passada' },
  { t: 3.6, quem: 'rafa', reage: '😅', em: 3 },
  { t: 6.6, quem: 'clara', digita: 2.2, texto: 'gravei o clipe daquela jogada de ontem 👀', gif: 'clipe.gif' },
  { t: 8.0, quem: 'tom', reage: '🔥', em: 4 },
  { t: 8.6, quem: 'helena', reage: '🔥', em: 4 },
  { t: 9.2, quem: 'kai', reage: '🔥', em: 4 },
  { t: 11.0, quem: 'tom', digita: 1.4, texto: ':fogo: :fogo: :fogo:' },
  { t: 13.4, quem: 'helena', digita: 1.6, texto: ':gg: insano' },
  { t: 16.0, quem: 'kai', digita: 1.8, texto: 'o rafa agora:', gif: 'celular.gif' },
  { t: 16.4, quem: 'bento', reage: '😂', em: 7 },
  { t: 18.2, quem: 'rafa', texto: 'kkkkk respeito', gif: 'respeito.gif' },
  { t: 21.6, quem: 'kai', digita: 2.0, texto: 'call de sexta aberta, entra todo mundo' },
  { t: 22.6, quem: 'helena', reage: '✅', em: 9 },
  { t: 23.1, quem: 'clara', reage: '✅', em: 9 },
  { t: 23.6, quem: 'bento', reage: '✅', em: 9 },
  { t: 25.6, quem: 'tom', digita: 1.4, texto: 'valeu, kai', gif: 'valeu.gif' },
];
const FIM = 31;
const DISSOLVE = 0.8;

async function chamar(token, metodo, rota, corpo) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { ...(corpo ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`${metodo} ${rota}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// ---------- quem é quem, e o canal ----------
const pessoas = {};
for (const nome of ['kai', 'helena', 'rafa', 'bento', 'clara', 'tom']) {
  const { token, user } = await chamar(null, 'POST', '/api/auth/login', { username: nome, password: SENHA });
  const socket = io(API, { auth: { token }, transports: ['websocket'] });
  await new Promise((ok) => socket.on('connect', ok));
  pessoas[nome] = { token, id: user.id, socket };
}
const kai = pessoas.kai;
const comunidades = await chamar(kai.token, 'GET', '/api/communities');
const comunidade = (comunidades.communities ?? comunidades).find((c) => c.name === COMUNIDADE);
if (!comunidade) throw new Error(`não achei a comunidade ${COMUNIDADE}: rode e2e/caprichar-demonstracao.mjs antes`);
const canais = await chamar(kai.token, 'GET', `/api/communities/${comunidade.id}/channels`);
const canal = (canais.channels ?? canais).find((c) => c.name === 'ranked' && c.type === 'text');

// ---------- o canal volta ao começo ----------
const porId = Object.fromEntries(Object.values(pessoas).map((p) => [p.id, p]));
const antigas = await chamar(kai.token, 'GET', `/api/channels/${canal.id}/messages`);
for (const m of antigas.messages ?? antigas) await chamar((porId[m.author?.id ?? m.authorId] ?? kai).token, 'DELETE', `/api/messages/${m.id}`);

/** Os ids das mensagens, na ordem em que chegam ao canal: é por eles que as reações acham a mensagem certa. */
const ids = [];
let chegou = () => {};
kai.socket.on('message:new', (m) => {
  if (m.channelId !== canal.id) return;
  ids.push(m.id);
  chegou();
});
/** Manda e espera a mensagem voltar pelo canal (texto pelo socket, como o app; GIF pela rota de anexo). */
const mandar = ({ quem, texto, gif }) => {
  const volta = new Promise((ok) => (chegou = ok));
  const ida = gif
    ? chamar(pessoas[quem].token, 'POST', `/api/channels/${canal.id}/messages`, {
        content: texto ?? '',
        files: [{ name: gif, data: 'data:image/gif;base64,' + fs.readFileSync(path.join(GIFS, gif)).toString('base64') }],
      })
    : new Promise((ok, falhou) =>
        pessoas[quem].socket.emit('message:send', { channelId: canal.id, content: texto }, (r) => (r?.ok ? ok() : falhou(new Error(r?.error ?? 'a mensagem não foi')))),
      );
  return Promise.all([ida, volta]);
};
for (const [quem, texto] of HISTORIA) await mandar({ quem, texto });

// ---------- a tela de quem assiste, gravada ----------
const { browser } = await abrirNavegador();
const videos = fs.mkdtempSync(path.join(os.tmpdir(), 'conversa-'));
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR', recordVideo: { dir: videos, size: { width: 1600, height: 900 } } });
await ctx.addInitScript((t) => {
  localStorage.setItem('janja.token', t);
  localStorage.setItem('syden.idioma', 'pt-BR');
}, pessoas[QUEM_ASSISTE].token);
const comecouAGravar = Date.now();
const tela = await ctx.newPage();
await tela.goto(APP, { waitUntil: 'networkidle' });
await tela.waitForTimeout(1200);
await dispensarPresentes(tela).catch(() => {});
await tela.locator('.rail-item').filter({ hasNot: tela.locator('.rail-action') }).nth(1).click().catch(() => {});
await tela.waitForTimeout(600);
await tela.getByText('ranked', { exact: true }).first().click();
await tela.waitForTimeout(2500);

// ---------- o roteiro, no relógio ----------
const inicio = (Date.now() - comecouAGravar) / 1000;
const t0 = Date.now();
const ate = (s) => new Promise((ok) => setTimeout(ok, Math.max(0, t0 + s * 1000 - Date.now())));
const digitando = (quem, de, por) =>
  (async () => {
    // O app mostra "digitando" por alguns segundos a cada aviso: avisa de novo enquanto a pessoa "escreve".
    for (let s = de; s < de + por; s += 0.9) {
      await ate(s);
      pessoas[quem].socket.emit('typing', { channelId: canal.id });
    }
  })();
const tarefas = [];
for (const passo of ROTEIRO) {
  if (passo.digita) tarefas.push(digitando(passo.quem, passo.t - passo.digita, passo.digita - 0.2));
  tarefas.push(
    (async () => {
      await ate(passo.t);
      if (passo.reage) await chamar(pessoas[passo.quem].token, 'POST', `/api/messages/${ids[passo.em]}/reactions`, { emoji: passo.reage });
      else await mandar(passo);
    })(),
  );
  // As mensagens precisam sair na ordem do roteiro, para os índices das reações baterem.
  if (!passo.reage) await tarefas.at(-1);
}
await Promise.all(tarefas);
await ate(FIM);
const video = tela.video();
await ctx.close();
const arquivo = await video.path();
await browser.close();
for (const p of Object.values(pessoas)) p.socket.close();

// ---------- o vídeo vira a imagem ----------
fs.mkdirSync(DESTINO, { recursive: true });
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'conversa-q-'));
const primeiro = path.join(pasta, 'primeiro.png');
ffmpeg('-ss', inicio.toFixed(2), '-i', arquivo, '-frames:v', '1', primeiro);
// O trecho, e no fim o dissolve até o primeiro quadro: o laço recomeça de onde a imagem começou.
ffmpeg(
  '-ss', inicio.toFixed(2), '-t', String(FIM), '-i', arquivo,
  '-loop', '1', '-t', String(DISSOLVE + 0.2), '-i', primeiro,
  '-filter_complex', `[0:v]fps=8,format=yuv420p,setsar=1[a];[1:v]fps=8,format=yuv420p,setsar=1[b];[a][b]xfade=transition=fade:duration=${DISSOLVE}:offset=${(FIM - DISSOLVE).toFixed(2)},scale=1000:-2:flags=lanczos`,
  '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '50', '-loop', '0', path.join(DESTINO, 'squad.webp'),
);
// A parada é a conversa INTEIRA (o último quadro antes do dissolve): quem não vê o movimento vê tudo o que aconteceu.
ffmpeg('-ss', (inicio + FIM - DISSOLVE - 0.3).toFixed(2), '-i', arquivo, '-frames:v', '1', '-vf', 'scale=1600:-2:flags=lanczos', '-c:v', 'libwebp', '-q:v', '88', path.join(DESTINO, 'squad-parada.webp'));
fs.rmSync(pasta, { recursive: true });
fs.rmSync(videos, { recursive: true, force: true });
for (const nome of ['squad.webp', 'squad-parada.webp']) console.log(`${nome}: ${(fs.statSync(path.join(DESTINO, nome)).size / 1024).toFixed(0)} KB`);
