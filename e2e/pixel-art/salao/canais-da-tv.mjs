// Os canais da TV do salão e a jukebox, pelo botão direito (pedidos dele, 18/10/2026): fotografa cada canal de perto e confere
// que o ciclo é desenho → futebol → tiro tático → arena → desligada → desenho, e que uma transmissão vem primeiro.
//   node e2e/pixel-art/salao/canais-da-tv.mjs [pasta das fotos]
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar } from '../quarto/imagem.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const S = process.argv[2] || path.join(AQUI, 'fotos'); fs.mkdirSync(S, { recursive: true });
const p = await abrir();
const erros = []; p.on('pageerror', (e) => erros.push(String(e.stack || e).slice(0, 400)));
await p.setViewportSize({ width: 1240, height: 1000 });
await p.goto('file:///' + path.join(AQUI, 'salao.html').replaceAll(String.fromCharCode(92), '/'));
await p.waitForFunction(() => window.ondeEsta && window.ondeEsta('tv'), null, { timeout: 30000 });
await p.waitForTimeout(1500);
let falhas = 0;
const conferir = (ok, o) => { console.log((ok ? 'ok  ' : 'FALHOU ') + o); if (!ok) falhas++; };
// (a TV pode estar fora da vista da câmera: a foto sai do próprio canvas, ampliada 4×, e o clique é um evento direto)
const foto = async (nome) => {
  const url = await p.evaluate(() => {
    const [x, y] = window.ondeEsta('tv'), c = document.getElementById('tela'), o = document.createElement('canvas');
    o.width = 560; o.height = 400; const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(c, x - 70, y - 55, 140, 100, 0, 0, 560, 400); return o.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(S, nome + '.png'), Buffer.from(url.split(',')[1], 'base64'));
};
const direito = async (id = 'tv') => {
  await p.evaluate((id) => {
    const [x, y] = window.ondeEsta(id), c = document.getElementById('tela'), r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + (x / c.width) * r.width, clientY: r.top + ((y - 8) / c.height) * r.height }));
  }, id);
  await p.waitForTimeout(300);
};
const canal = () => p.evaluate(() => (window.estadoDoTeste().telas.includes('tv') ? 'desligada' : window.estadoDoTeste().canalDaTv));
const esperado = ['tv', 'futebol', 'tatico', 'arena', 'desligada', 'tv'];
conferir((await canal()) === 'tv', 'começa no desenho');
await foto('tv-tv');
for (const c of esperado.slice(1)) { await direito(); const agora = await canal(); conferir(agora === c, 'botão direito → ' + c + ' (veio ' + agora + ')'); if (c !== 'tv') await foto('tv-' + c); }
// as telas animadas: a mesma TV mexendo
await p.evaluate(() => { localStorage.setItem('syden:graficos', JSON.stringify({ particulas: false, sombras: false, telas: true })); });
await p.click('#noite'); await p.waitForTimeout(600);
for (const c of ['futebol', 'tatico', 'arena']) { await direito(); await p.waitForTimeout(1300); await foto('tv-' + c + '-noite'); }
// uma transmissão começa: a TV vai a ela, e o ciclo passa a começar por ela
await p.click('#aovivo-teste'); await p.waitForTimeout(400);
conferir((await canal()) === 'ao-vivo', 'transmissão começa → ao vivo');
await direito(); conferir((await canal()) === 'tv', 'do ao vivo → desenho');
for (let i = 0; i < 4; i++) await direito();
conferir((await canal()) === 'desligada', '… → desligada');
await direito(); conferir((await canal()) === 'ao-vivo', 'desligada → ao vivo (o primeiro, havendo transmissão)');
// O AO VIVO COM O GÊNERO do jogo transmitido (18/10/2026): uma foto de cada, de noite e com as telas animadas.
for (const g of ['moba', 'tiro', 'futebol', 'corrida', 'luta', 'aventura', 'construcao', 'fazenda', 'estrategia', 'cartas', 'terror', 'plataforma', 'festa', 'espaco', 'quebracabeca', 'esportes', 'voo', 'turnos', 'historia', 'ritmo']) {
  await p.evaluate((g) => window.generoDoTeste(g), g); await p.waitForTimeout(700);
  await foto('genero-' + g);
}
await p.evaluate(() => window.generoDoTeste(null));
// o que vale para a turma vai com a arrumação (18/10/2026): o canal escolhido e o que está desligado
await direito(); await direito();
conferir((await p.evaluate(() => window.retratoDoTeste().canalDaTv)) === 'futebol', 'o canal escolhido vai com a arrumação');
await direito('jukebox');
conferir((await p.evaluate(() => window.retratoDoTeste().desligados)).includes('jukebox'), 'a jukebox desligada vai com a arrumação');
await foto('jukebox-desligada');
await direito('jukebox');
conferir(!(await p.evaluate(() => window.retratoDoTeste().desligados)).includes('jukebox'), 'e liga de novo');
conferir(!erros.length, 'sem erros na página ' + erros.join(' | '));
await fechar();
process.exit(falhas ? 1 : 0);
