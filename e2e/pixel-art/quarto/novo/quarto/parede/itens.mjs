// OS OBJETOS DA PAREDE (pedido dele, 15/10/2026: "recheio: plantas, quadros e objetos"; e "os objetos com função: fone,
// quadro…"). Como os tipos de janela (janelas/tipos.mjs): cada um é pintado UMA vez na parede da direita do quarto sem
// janela e vira peça pela diferença; a página o põe em qualquer lugar das duas paredes, e em qualquer altura.
//   node e2e/pixel-art/quarto/novo/quarto/parede/itens.mjs [item...]   → parede/<item>/dia.png
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { pintar } from '../pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const naParede = (v, h) => { const x = 256 + 27 * v; return [Math.round(x), Math.round(226 + (x - 256) * (114 / 216) - h)]; };
const area = (v0, v1, h0, h1) => [naParede(v0, h0), naParede(v1, h0), naParede(v1, h1), naParede(v0, h1)];
const ESTILO = 'flat against the plain cream plaster wall, nothing else around it, clean isometric pixel art';
export const ITENS = {
  // Com função (a do quarto da home de hoje, Home.tsx): o fone abre as salas, o quadro os amigos, a cortiça as ideias.
  // O fone e o quadro saíram cortados retos do lado direito na área justa (falhas/): áreas largas, outra semente.
  // O fone saiu grande demais para o quarto (relato dele, 15/10/2026): pequeno, do tamanho de um livro.
  fone: { area: area(3.5, 4.7, 100, 150), semente: 23, texto: `ONLY a SMALL pair of over-ear headphones, about the size of a book, hanging from a tiny wooden wall hook, ${ESTILO}` },
  // As fotos eram de PESSOAS, e o universo é de coelhos (relato dele, 15/10/2026): fotos de coelhos.
  quadro: { area: area(2.9, 5.6, 80, 170), semente: 11, texto: `ONLY a wooden picture frame holding a few small instant photos of cute cartoon bunny rabbit friends (white, brown and grey bunnies, no humans) pinned on a string, ${ESTILO}` },
  cortica: { area: area(3.2, 5.0, 80, 150), texto: `ONLY a small cork board in a wooden frame with a few colorful paper notes pinned on it, ${ESTILO}` },
  // Só enfeite.
  prateleira: { area: area(2.9, 5.3, 95, 165), texto: `ONLY a short wooden wall shelf with a few books, a tiny potted succulent and a small ceramic vase on it, ${ESTILO}` },
  // O SALÃO (escolhas dele, 15/10/2026): a prateleira de bar com o lampião (o conceito dele; garrafas SEM álcool), a de
  // snacks da cozinha, a estante de troféus (as conquistas da turma), o neon (sem texto: não pede tradução), o relógio, o
  // violão perto do karaokê e a porta do banheiro (só enfeite, com a placa).
  // (a primeira saiu minúscula, sem o lampião e com um pedaço do chão; a de snacks e a de troféus, cortadas retas na
  // esquerda: pedidos mais compactos, outra semente)
  'prateleira-bar': { area: area(2.6, 5.8, 70, 190), semente: 3, texto: `ONLY two wide dark wooden wall shelves filling the area, one above the other, with glass jars, mugs, soda bottles and juice bottles on them, and a warm glowing old lantern hanging from a hook at the right end, all well above the floor, ${ESTILO}` },
  'prateleira-snacks': { area: area(2.8, 5.6, 80, 170), semente: 9, texto: `ONLY a SHORT wooden kitchen wall shelf, fully inside the area, with three small glass jars of cookies, popcorn and candy, ${ESTILO}` },
  trofeus: { area: area(2.7, 5.7, 80, 180), semente: 4, texto: `ONLY a SHORT dark wooden display shelf, fully inside the area, with three shiny trophy cups (gold, silver, bronze), ${ESTILO}` },
  neon: { area: area(3.0, 5.4, 100, 175), texto: `ONLY a glowing neon sign shaped like a cute bunny head next to a music note, bright pink and cyan neon tubes, no letters, no text, ${ESTILO}` },
  relogio: { area: area(3.6, 4.7, 120, 165), texto: `ONLY a small round wooden wall clock with a cream face and dark hands, ${ESTILO}` },
  // (no salão, a primeira saiu cortada reta na direita: área mais larga, outra semente)
  violao: { area: area(2.9, 5.5, 60, 186), semente: 17, texto: `ONLY a SMALL wooden acoustic guitar hanging vertically on a small wall hook, CENTERED in the area with empty wall all around it, ${ESTILO}` },
  porta: { area: area(3.0, 5.2, 0, 150), texto: `ONLY a closed dark wooden door with a small round restroom sign on it showing a simple bunny icon, a brass door handle, standing on the floor, set into the plain cream wall, ${ESTILO}` },
  // O PÔSTER DO KARAOKÊ (pedido dele, 15/10/2026: "um pôster de algum rock star de coelho ... até para sinalizar ao
  // usuário que tem essa função"): abre o karaokê, como o microfone e a jukebox. Sem letras: não pede tradução.
  poster: { area: area(3.0, 5.0, 85, 185), semente: 5, texto: `ONLY a tall rectangular rock concert poster taped flat to the wall, showing a cool cartoon bunny rock star with sunglasses singing into a microphone and holding an electric guitar under colorful stage spotlights, bold warm colors, a thin white paper border, no letters, no text, no words, ${ESTILO}` },
  pintura: { area: area(3.3, 4.9, 90, 170), texto: `ONLY a framed landscape painting of green hills and a soft sunset sky, in a thin wooden frame, ${ESTILO}` },
};
// (só quando chamado direto: avulsos.mjs importa a lista daqui)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // O SALÃO (15/10/2026): "itens.mjs salao <item...>" pinta no TIJOLO do salão (salao/base-tijolo.png, 27 px abaixo do
  // quarto), em parede-salao/<item>/: pintado no reboco creme do quarto, o objeto trazia em volta a cor de lá, que no tijolo
  // virava mancha, e às vezes saía cortado (relatos dele).
  const SALAO = process.argv[2] === 'salao';
  const args = process.argv.slice(SALAO ? 3 : 2);
  const base = ler64(SALAO ? path.join(AQUI, '..', '..', '..', '..', 'salao', 'base-tijolo.png') : path.join(AQUI, '..', 'janelas', 'sem-janela-dia.png'));
  const noSalao = (a) => a.map(([x, y]) => [x, y + 27]);
  const deTijolo = (t) => t.replace(/the plain cream plaster wall|the plain cream wall/g, 'the red brick wall');
  for (const item of args.length ? args : Object.keys(ITENS)) {
    const { area: a0, texto: t0, semente } = ITENS[item];
    const a = SALAO ? noSalao(a0) : a0, texto = SALAO ? deTijolo(t0) : t0;
    const pasta = SALAO ? path.join(AQUI, '..', 'parede-salao', item) : path.join(AQUI, item), destino = path.join(pasta, 'dia.png');
    if (fs.existsSync(destino)) { console.log('já existe:', item); continue; }
    fs.mkdirSync(pasta, { recursive: true });
    const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
    gravar64(destino, await pintar(base, { caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], poligonos: [a], texto, semente }, null));
    console.log('parede:', item);
  }
  await fechar();
}
