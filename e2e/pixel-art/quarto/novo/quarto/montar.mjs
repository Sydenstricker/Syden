// Monta quarto.html: o quarto na base sem porta (pl-512-janela-1), com os móveis recortados e a vista atrás do vidro,
// ao lado do conceito, de dia e de noite. A montagem acontece na própria página, num canvas, porque o pufe se arrasta:
//   - de dia, cada móvel é o recorte pintado; o pufe usa a versão pintada mais perto de onde está e só ganha a
//     INTENSIDADE da luz do lugar novo;
//   - de noite, o fundo é a noite montada (noite.mjs) com a luz do abajur pintada (noite-abajur.mjs), e os móveis são a
//     cor do dia vezes a razão noite/dia;
//   - a vista (../janela/) entra nos pixels do vidro, espelhada, e troca com a hora.
//   node e2e/pixel-art/quarto/novo/quarto/montar.mjs   → quarto.html
import fs from 'node:fs';
import path from 'node:path';
import { ler64 } from '../../imagem.mjs';
import { CANTOS, N } from './chao.mjs';
import { FIXOS, PUFES } from './lista.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const png = (arquivo) => 'data:image/png;base64,' + ler64(arquivo);
// A CENA (15/10/2026): o mesmo motor monta o QUARTO e o SALÃO da comunidade (e2e/pixel-art/salao/). O SALÃO É 16 × 16
// (pedido dele, mesmo dia: "4× o tamanho"), numa imagem de 1024 px com a casca de salao/casca16.py: a mesma casa do
// quarto (27 × 14,25 px), o fundo do chão em (512, 253). As peças pintadas no quarto (as janelas, os objetos da parede, o
// tapete) estão nas coordenadas dele e vão para as do salão deslocadas de (DX, DY): o fundo do quarto, (256, 226), cai
// no fundo do salão. Como o fundo fica no meio da imagem nas duas cenas, o espelho de uma parede na outra é x → W − 1 − x.
//   node montar.mjs           → quarto.html
//   node montar.mjs salao     → ../../../salao/salao.html
const CENA = process.argv[2] === 'salao' ? 'salao' : 'quarto';
const SALAO = path.join(AQUI, '..', '..', '..', 'salao');
const DX = CENA === 'salao' ? 256 : 0, DY = CENA === 'salao' ? 27 : 0;
const NC = CENA === 'salao' ? 16 : N, WC = CENA === 'salao' ? 1024 : 512;
const CANTOS_DA_CENA = CENA === 'salao' ? { fundo: [512, 253], esquerda: [80, 481], frente: [512, 709], direita: [944, 481] } : CANTOS;
const IMAGENS = {
  ...Object.fromEntries([1, 2, 3, 4].map((n) => ['vista' + n, png(path.join(AQUI, '..', 'janela', `vista-dia-${n}.png`))])),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => ['noite' + n, png(path.join(AQUI, '..', 'janela', `vista-noite-${n}.png`))])),
  conceitoNoite: png(path.join(AQUI, '..', '..', 'hibrido', 'conceito-unzoom.png')),
  conceitoDia: png(path.join(AQUI, '..', '..', 'hibrido', 'dia.png')),
  // O COELHO PROVISÓRIO (14/10/2026): o do recado do salão, de frente, até o mascote isométrico nascer
  // (e2e/pixel-art/personagem/README.md). Serve para testar a estrutura: pontos, caminhada, ordem e luz.
  coelho: png(path.join(AQUI, '..', '..', '..', '..', '..', 'web', 'src', 'assets', 'salao', 'coelho-do-recado.png')),
};
// O MASCOTE ISOMÉTRICO (personagem/mascote/baixa-120, 14/10/2026): as 4 diagonais, paradas. Os nomes do PixelLab
// (south-east...) viram os do README (sudeste...).
const MASCOTE = path.join(AQUI, '..', '..', '..', 'personagem', 'mascote', 'baixa-120');
// AS ANIMAÇÕES DO MASCOTE (personagem/animar.mjs e estado.mjs): para cada animação, as pastas em ordem de preferência;
// cada direção vem da primeira que a tiver. Uma pasta com <direção>-<n>.png é uma animação; com <direção>.png, uma pose.
const PERS = path.join(AQUI, '..', '..', '..', 'personagem', 'mascote');
const FONTES = {
  andando: ['baixa-120/animacoes/andando-v3', 'baixa-120/animacoes/andando-v3b'],
  parado: ['baixa-120/animacoes/parado', 'baixa-120'],
  falando: ['baixa-120/animacoes/falando'],
  sentado: ['estados/sentado-2', 'estados/sentado'],
  // Na poltrona, afundado e com os braços nos apoios (pedido dele, 14/10/2026).
  'sentado-poltrona': ['estados/sentado-poltrona', 'estados/sentado-2'],
  // Na cadeira do computador: inclinado para a frente, as mãos no teclado (pedido dele, 14/10/2026: a pose da poltrona,
  // largada, ficava ruim ali).
  // Digitando: o corpo PARADO e só as mãos (personagem/maos.py); a do PixelLab balançava o corpo inteiro.
  'no-computador': ['baixa-120/animacoes/digitando-maos', 'estados/no-computador', 'estados/sentado-2'],
  // NO SALÃO (15/10/2026): na banqueta, que é alta, com as pernas penduradas; e de pé no fliperama, com as mãos no
  // controle. Antes eram a pose sentada genérica e a de pé.
  'sentado-banqueta': ['estados/sentado-banqueta', 'estados/sentado-2'],
  'no-fliperama': ['estados/no-fliperama', 'baixa-120/animacoes/parado', 'baixa-120'],
  lendo: ['estados/lendo-deitado', 'estados/lendo'],
  dormindo: ['estados/dormindo'],
  'dormindo-largado': ['estados/dormindo-largado', 'estados/dormindo'],
  // As TRANSIÇÕES (personagem/transicao.mjs): os quadros do meio entre o parado e a pose; ao contrário, levantar.
  // As fluidas (8 quadros, encadeadas por transicao.mjs) primeiro; onde ainda não existem, as de 2 quadros.
  sentar: ['transicoes/sentar-fluido', 'transicoes/sentar'],
  deitar: ['transicoes/deitar-fluido', 'transicoes/deitar'],
  'deitar-lendo': ['transicoes/deitar-lendo-fluido', 'transicoes/deitar-lendo'],
  // Na poltrona, o fim do sentar com os braços indo para os apoios.
  bracos: ['transicoes/bracos'],
};
// As 8 direções do personagem: as diagonais são as de uso; as outras 4 (de frente, de costas, de lado) servem à VIRADA.
const DELES = { sudeste: 'south-east', sudoeste: 'south-west', nordeste: 'north-east', noroeste: 'north-west', sul: 'south', oeste: 'west', norte: 'north', leste: 'east' };
const ANIMACOES = {};
const SO_NO_SALAO = ['sentado-banqueta', 'no-fliperama'];
for (const [nome, pastas] of Object.entries(FONTES)) {
  if (CENA !== 'salao' && SO_NO_SALAO.includes(nome)) continue;
  ANIMACOES[nome] = {};
  for (const [nossa, deles] of Object.entries(DELES)) {
    for (const p of pastas) {
      const dir = path.join(PERS, p);
      if (!fs.existsSync(dir)) continue;
      const quadros = fs.readdirSync(dir).filter((f) => f.startsWith(deles + '-') && /-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/-(\d+)\.png$/)[1]) - Number(b.match(/-(\d+)\.png$/)[1]));
      const lista = quadros.length ? quadros : fs.existsSync(path.join(dir, deles + '.png')) ? [deles + '.png'] : [];
      if (lista.length) { ANIMACOES[nome][nossa] = lista.map((f) => png(path.join(dir, f))); break; }
    }
  }
}
for (const [nosso, deles] of [['sudeste', 'south-east'], ['sudoeste', 'south-west'], ['nordeste', 'north-east'], ['noroeste', 'north-west']]) {
  IMAGENS['mascote-' + nosso] = png(path.join(MASCOTE, deles + '.png'));
}
// AS 4 POSIÇÕES DE CADA MÓVEL (girar.mjs): as 4 diagonais do mesmo móvel, na ordem do botão Girar. Móvel sem as 4
// vistas fica onde foi pintado.
// A mesa vem LIMPA (decisão dele, 15/10/2026: "o móvel deve ser uma coisa, os elementos outra"); a plantinha e os
// livros que chegaram a vir pintados nela (mesa-teclado-enfeitada-giros) são OBJETOS DE CIMA, peças à parte. As plantas
// são o mesmo desenho nas 4 posições (uma planta é igual de todos os lados).
const GIROS = CENA === 'salao'
  // O SALÃO: os móveis escolhidos (salao/moveis/), LIMPOS (sem garrafas, canecas e videogame: o que vai em cima é objeto),
  // mais as plantas do quarto. A banqueta entra duas vezes (o mesmo desenho).
  ? { sofa: 'S:sofa-giros', tv: 'S:tv-limpa-giros', fliperama: 'S:fliperama-giros', balcao: 'S:balcao-limpo-giros', estante: 'S:estante-giros', mesinha: 'S:mesinha-limpa-giros', banqueta: 'S:banqueta-giros', 'banqueta-2': 'S:banqueta-giros', 'planta-alta': 'planta-alta-giros', 'planta-baixa': 'planta-baixa-giros',
    // o 16 × 16: mais um sofá (o mesmo desenho) e as duas poltronas do quarto, sem gerar arte nova
    'sofa-2': 'S:sofa-giros', poltrona: 'poltrona-giros', 'poltrona-2': 'poltrona-giros',
    // os móveis novos do 16 × 16 (escolhidos por ele: a caixa de som 4 e o pufão 1), e as 4 cadeiras da mesa de jogos
    'mesa-jogo': 'S:mesa-jogo-giros', cadeira: 'S:cadeira-giros', 'cadeira-2': 'S:cadeira-giros', 'cadeira-3': 'S:cadeira-giros', 'cadeira-4': 'S:cadeira-giros',
    jukebox: 'S:jukebox-giros', microfone: 'S:microfone-giros', pufao: 'S:pufao-giros' }
  : { poltrona: 'poltrona-giros', abajur: 'criado-mudo-pes-limpo-giros', 'guarda-roupa': 'guarda-roupa-giros', cama: 'cama-casal-giros', mesa: 'mesa-teclado-giros', 'planta-alta': 'planta-alta-giros', 'planta-baixa': 'planta-baixa-giros' };
const ORDEM_DO_GIRO = ['south-west', 'north-west', 'north-east', 'south-east'];
for (const [id, pasta] of Object.entries(GIROS)) {
  const dir = pasta.startsWith('S:') ? path.join(SALAO, 'moveis', pasta.slice(2)) : path.join(AQUI, 'avulsos', pasta);
  if (ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(dir, d + '.png')))) ORDEM_DO_GIRO.forEach((d, l) => { IMAGENS['giro-' + id + l] = png(path.join(dir, d + '.png')); });
}
// A CADEIRA DO COMPUTADOR gira livre (física): as 8 vistas, e a que aparece é a mais perto do ângulo dela.
const OITO = ['south-west', 'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west'];
if (CENA === 'quarto' && OITO.every((d) => fs.existsSync(path.join(AQUI, 'avulsos', 'cadeira-giros', d + '.png')))) for (const d of OITO) IMAGENS['cadeira-' + d] = png(path.join(AQUI, 'avulsos', 'cadeira-giros', d + '.png'));
// OS ESTADOS DE UM MÓVEL (estado.mjs): o mesmo objeto, editado, nas mesmas vistas e no mesmo enquadramento.
const ESTADOS = CENA === 'quarto' ? { 'guarda-roupa': { aberto: 'guarda-roupa-aberto-giros' } } : {};
for (const [id, estados] of Object.entries(ESTADOS)) for (const [nome, pasta] of Object.entries(estados)) {
  const dir = path.join(AQUI, 'avulsos', pasta);
  if (ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(dir, d + '.png')))) ORDEM_DO_GIRO.forEach((d, l) => { IMAGENS['giro-' + id + '-' + nome + l] = png(path.join(dir, d + '.png')); });
}
// A PASSAGEM entre dois estados (animar-estado.mjs): os quadros do meio, das portas abrindo; fechar toca ao avesso.
const PASSAGENS = CENA === 'quarto' ? { 'guarda-roupa': 'guarda-roupa-aberto-passagem' } : {};
for (const [id, pasta] of Object.entries(PASSAGENS)) {
  const dir = path.join(AQUI, 'avulsos', pasta);
  if (ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(dir, d + '-1.png')))) ORDEM_DO_GIRO.forEach((d, l) => { for (const k of [0, 1]) IMAGENS['passagem-' + id + l + '-' + k] = png(path.join(dir, d + '-' + k + '.png')); });
}
// A JANELA MÓVEL (pedido dele, 14–15/10/2026: "mudar a janela de lugar, o tipo de janela, e não só o lado de fora"). O
// quarto sem janela (janelas/sem-janela.py) e cada tipo como peça (janelas/pecas.py), nas coordenadas de onde foi
// pintado; a página a leva para onde ela estiver.
const JAN_DIR = path.join(AQUI, 'janelas');
// As imagens de teste do quadro da comunidade (só na página de teste do salão): o ícone do Syden e a imagem da loja.
if (CENA === 'salao') {
  const WEB = path.join(AQUI, '..', '..', '..', '..', '..', 'web', 'public');
  IMAGENS.iconeDeTeste = png(path.join(WEB, 'icon-512.png'));
  IMAGENS.capaDeTeste = png(path.join(AQUI, '..', '..', '..', 'salao', 'bases', 'tarde-1.png'));
}
for (const q of ['dia', 'noite', 'noite-abajur']) IMAGENS['sem-' + q] = png(CENA === 'salao' ? path.join(SALAO, q === 'dia' ? 'base16.png' : 'noite16.png') : path.join(JAN_DIR, `sem-janela-${q}.png`));
const JANELAS = {};
for (const tipo of ['original', 'arco', 'redonda', 'floreira']) {
  const d = path.join(JAN_DIR, tipo);
  if (!fs.existsSync(path.join(d, 'janela.json'))) continue;
  JANELAS[tipo] = JSON.parse(fs.readFileSync(path.join(d, 'janela.json'), 'utf8'));
  const arqs = ['peca-dia', 'peca-noite', 'vidro', 'luar', ...(JANELAS[tipo].cortina ? ['cortina-dia', 'cortina-noite'] : []), ...(JANELAS[tipo].abre ? ['aberta-dia', 'aberta-vao', 'aberta-vidro'] : [])];
  for (const a of arqs) IMAGENS[`jan-${tipo}-${a}`] = png(path.join(d, a + '.png'));
}
// OS OBJETOS DA PAREDE (parede/itens.mjs e parede/pecas.py): como a janela, peças nas coordenadas de onde foram pintados.
const ITENS_PAREDE = {};
for (const item of ['fone', 'quadro', 'cortica', 'prateleira', 'pintura']) {
  const d = path.join(AQUI, 'parede', item);
  if (!fs.existsSync(path.join(d, 'item.json'))) continue;
  ITENS_PAREDE[item] = JSON.parse(fs.readFileSync(path.join(d, 'item.json'), 'utf8'));
  for (const q of ['dia', 'noite']) IMAGENS['par-' + item + '-' + q] = png(path.join(d, 'peca-' + q + '.png'));
}
const QUADROS = [], ANIMACOES_IDX = {};
{ const indice = new Map();
  for (const [nome, dirs] of Object.entries(ANIMACOES)) {
    ANIMACOES_IDX[nome] = {};
    for (const [d, qs] of Object.entries(dirs)) ANIMACOES_IDX[nome][d] = qs.map((q) => { if (!indice.has(q)) { indice.set(q, QUADROS.length); QUADROS.push(q); } return indice.get(q); });
  } }
// OS OBJETOS DE CIMA (../../../objetos/, escolhidos.json: a opção escolhida de cada um): 4 vistas do mesmo objeto, ou a
// mesma vista nas 4 posições para o que é igual de todos os lados (o copo, a planta).
const OBJ_DIR = path.join(AQUI, '..', '..', '..', 'objetos');
const OBJETOS_DE_CIMA = {};
if (fs.existsSync(path.join(OBJ_DIR, 'escolhidos.json'))) for (const [id, meta] of Object.entries(JSON.parse(fs.readFileSync(path.join(OBJ_DIR, 'escolhidos.json'), 'utf8')))) {
  const giros = path.join(OBJ_DIR, id + '-giros');
  const vistas = ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(giros, d + '.png'))) ? ORDEM_DO_GIRO.map((d) => path.join(giros, d + '.png')) : [0, 1, 2, 3].map(() => path.join(OBJ_DIR, id + '-' + meta.opcao + '.png'));
  if (!vistas.every((f) => fs.existsSync(f))) continue;
  OBJETOS_DE_CIMA[id] = { nome: meta.nome };
  vistas.forEach((f, l) => { IMAGENS['obj-' + id + l] = png(f); });
}
// No salão, dos pintados no quarto só o tapete (descido 27 px na página, como as outras peças do quarto).
const MOVEIS = (CENA === 'salao' ? FIXOS.filter((m) => m.id === 'tapete') : [...FIXOS, ...PUFES]).map((m) => ({ id: m.id, pe: m.pe, alto: m.alto ?? 34, deitado: !!m.deitado, pufe: m.id.startsWith('pufe') }));
for (const m of MOVEIS) {
  IMAGENS[m.id] = png(path.join(AQUI, 'pecas', m.id + '.png'));
  IMAGENS[m.id + '-sombra'] = png(path.join(AQUI, 'pecas', m.id + '-sombra.png'));
}

// O topo da página de teste do salão (a do quarto fica como está, logo abaixo no HTML).
const SALAO_TOPO = `<h1>O salão da comunidade</h1>
<p>O salão isométrico, da turma. <b>Arraste e gire</b> os móveis (no app, só quem administra). Os botões de teste simulam o
que o app manda: <b>Pessoas na call</b> (quem transmite vai para a TV, quem joga para o fliperama, o resto senta no sofá e nas
banquetas), <b>Ao vivo</b> (a TV liga e mostra quem transmite, com as setas de canal), <b>Imagem da comunidade</b> (o ícone ou a
capa no quadro) e <b>Recado</b> (o balão do coelho atrás do balcão; clicar no balcão mostra de novo). Ligue as <b>Funções do
app</b> para ver o nome de cada objeto ao passar o mouse. A arrumação fica guardada neste navegador.</p>`;
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${CENA === 'salao' ? 'Salão da comunidade' : 'Quarto do coelho'}</title>
<style>
  :root { --fundo: #2a2522; --texto: #efe6dc; --suave: #b9ab9c; --botao: #4a3f38; --ativo: #8a6a4a; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1240px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: var(--suave); max-width: 80ch; }
  .barra { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  button { background: var(--botao); color: var(--texto); border: 0; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; }
  button[aria-pressed="true"] { background: var(--ativo); }
  .lado { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 760px) { .lado { grid-template-columns: 1fr; } }
  figure { margin: 0; }
  figcaption { color: var(--suave); font-size: 13px; margin-top: 4px; }
  canvas, .lado img { width: 100%; aspect-ratio: 1; image-rendering: pixelated; display: block; }
  canvas { cursor: grab; touch-action: none; }
  .com-rotulo { position: relative; }
  /* NO APP (?app, dentro do QuartoNovo.tsx): só o quarto, sem nada da página de teste, sobre o fundo do app. */
  /* O mesmo esquema de cor do iframe (styles.css): diferentes, o navegador pinta um fundo branco atrás do quarto. */
  /* A CÂMERA DO SALÃO (16 × 16): a vista recorta, e o mundo (a tela e os nomes em cima dela) anda dentro dela. */
  .vista { position: relative; }
  .mundo { position: relative; }
  body.salao .vista { overflow: hidden; aspect-ratio: 4 / 3; touch-action: none; cursor: grab; }
  body.salao .vista.andando { cursor: grabbing; }
  body.salao .mundo { position: absolute; left: 0; top: 0; will-change: transform; }
  html.app body.salao .vista { aspect-ratio: auto; width: 100vw; height: 100vh; }
  /* QUEM ESTÁ FORA DA VISTA (ideia dele, 15/10/2026): uma marca na borda, na direção das pessoas, com quantas são. */
  #fora-da-vista { position: absolute; inset: 0; pointer-events: none; }
  #fora-da-vista button { position: absolute; transform: translate(-50%, -50%); pointer-events: auto; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 15px; border: 2px solid #ff9a3c; background: rgba(30, 24, 20, 0.82); color: #fff4e6; font: 700 14px/26px system-ui, sans-serif; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  #fora-da-vista button span { font-size: 11px; opacity: 0.85; }
  /* No salão não há conceito ao lado: o salão sozinho, maior. */
  body.salao .lado { grid-template-columns: 1fr; max-width: 900px; }
  body.salao .lado > figure:not(.com-rotulo) { display: none; }
  /* e sem o que é só do quarto: o abajur, a tela do computador, a cortina e a janela que abre, os estados do coelho */
  body.salao #luz, body.salao #tela-pc, body.salao #janela, body.salao #cortina, body.salao #estados, body.salao .so-do-quarto { display: none; }
  html.app { color-scheme: light dark; }
  html.app body { background: transparent; }
  html.app main { padding: 0; max-width: none; }
  html.app main > :not(.lado), html.app .lado > figure:not(.com-rotulo), html.app figcaption { display: none; }
  html.app .lado { display: block; }
  #rotulo { position: absolute; pointer-events: none; transform: translate(-50%, -120%); background: rgba(30, 24, 20, 0.92); color: var(--texto); padding: 4px 10px; border-radius: 8px; font-size: 13px; white-space: nowrap; }
  #rotulo small { display: block; color: var(--suave); font-size: 11px; }
  /* Os nomes de quem está na call, em cima de cada coelho (no salão). */
  #nomes { position: absolute; inset: 0; pointer-events: none; }
  #nomes span { position: absolute; transform: translate(-50%, -100%); background: rgba(30, 24, 20, 0.78); color: #fff4e6; padding: 1px 6px; border-radius: 6px; font-size: 11px; white-space: nowrap; }
  /* A TV AO VIVO (no salão): quem transmite, em cima da TV; as setas trocam de canal. */
  #aovivo { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 4px; background: rgba(30, 24, 20, 0.9); color: #fff4e6; padding: 2px 6px; border-radius: 8px; font-size: 11px; white-space: nowrap; line-height: 1.3; }
  #aovivo .selo { color: #ff8a80; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; }
  #aovivo .selo::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #e53935; animation: piscar 1.2s steps(2) infinite; }
  #aovivo small { display: block; color: var(--suave); font-size: 10px; }
  #aovivo button { background: transparent; color: inherit; padding: 0 3px; font-size: 13px; line-height: 1; }
  @keyframes piscar { 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { #aovivo .selo::before { animation: none; } }
  /* O RECADO de quem administra, no balão do coelho atrás do balcão. */
  #recado { position: absolute; transform: translate(-50%, -100%); max-width: 46%; background: #fff7ea; color: #3a2c22; padding: 5px 9px; border-radius: 10px; font-size: 12px; line-height: 1.35; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25); pointer-events: none; white-space: pre-line; }
  #recado b { display: block; font-size: 12px; }
  #recado::after { content: ''; position: absolute; left: 50%; bottom: -6px; margin-left: -6px; border: 6px solid transparent; border-bottom: 0; border-top-color: #fff7ea; }
</style></head>
<body><main>
${CENA === 'salao' ? SALAO_TOPO : `<h1>O quarto do coelho</h1>
<p>À esquerda, o quarto: a base sem porta do PixelLab, com a cama, o criado-mudo com abajur, o guarda-roupa, o tapete e o
pufe pintados dentro dela e recortados, e a paisagem atrás do vidro. À direita, o conceito do ChatGPT. <b>Arraste qualquer móvel</b>
pelo chão (o pufe usa a versão pintada mais perto e a intensidade da luz do lugar). <b>Girar</b> (ou a tecla R) gira o
último móvel tocado. A arrumação fica guardada neste navegador; <b>Arrumação inicial</b> volta à de fábrica.</p>`}
<div class="barra">
  <button id="dia" aria-pressed="true">Dia</button><button id="noite" aria-pressed="false">Noite</button>
  <button id="grade" aria-pressed="false">Mostrar a grade</button>
  <button id="luz" aria-pressed="true">Luz do abajur à noite: pintada</button>
  <button id="vista" aria-pressed="false">Vista: 1</button>
  <button id="girar">${CENA === 'salao' ? 'Girar' : 'Girar a poltrona'}</button>
  <button id="inicial">Arrumação inicial</button>
  <button id="tela-pc">Tela: automática</button>
  <button id="janela" aria-pressed="false">Janela: fechada</button>
  <button id="cortina" aria-pressed="false">Cortina: aberta</button>
  <button id="tipo-janela">Tipo de janela</button>
  <button id="funcoes" aria-pressed="false">Funções do app: desligadas</button>
  <button id="pessoas-teste" hidden>Pessoas na call: 0</button>
  <button id="aovivo-teste" hidden aria-pressed="false">Ao vivo: ninguém</button>
  <button id="imagem-teste" hidden aria-pressed="false">Imagem da comunidade: nenhuma</button>
  <button id="recado-teste" hidden aria-pressed="false">Recado: nenhum</button>
  <button id="cor-tapete">Cor do tapete</button>
</div>
<div class="barra" id="graficos">
  <button id="graf-particulas">Partículas</button><button id="graf-sombras">Sombras</button><button id="graf-telas">Telas animadas</button>
</div>
<div class="barra" id="enfeites"></div>
<div class="barra" id="objetos-de-cima"></div>
<p id="acao-teste" aria-live="polite"></p>
<p class="so-do-quarto"><b>O coelho</b>: o mascote isométrico, com as animações dele (andando, parado, falando) e as poses (sentado, lendo,
dormindo), todas do mesmo personagem, no mesmo quadro e com a mesma âncora. A sombra vem da janela (de dia) ou do
abajur (de noite). O estado decide o
lugar; <b>clicar num móvel</b> (sem arrastar) o leva até ele; arrastar o pufe ou a poltrona com ele sentado leva o
coelho junto. Ver e2e/pixel-art/personagem/README.md.</p>
<div class="barra" id="estados">
  <button data-estado="atoa" aria-pressed="true">À toa</button>
  <button data-estado="call" aria-pressed="false">Em call</button>
  <button data-estado="ausente" aria-pressed="false">Ausente</button>
  <button id="falando" aria-pressed="false">Falando</button>
</div>
<details id="conta" class="barra"><summary>Conta no servidor (teste) e visitas</summary>
  <p>O quarto de cada pessoa mora no servidor, e qualquer conta pode visitar (decisão dele, 15/10/2026). Aqui, numa API de
  teste: entre com uma conta, e a arrumação passa a ser guardada lá; ponha o número de outra conta para visitar o quarto
  dela (só olhar: nada se arrasta nem se guarda). <span id="quem"></span></p>
  <input id="api" value="http://localhost:3099" aria-label="Endereço da API" size="22">
  <input id="nome" placeholder="nome" aria-label="Nome"> <input id="senha" type="password" placeholder="senha" aria-label="Senha">
  <button id="entrar">Entrar</button>
  <input id="visitar-id" placeholder="número da conta" aria-label="Número da conta a visitar" size="10">
  <button id="visitar">Visitar</button> <button id="voltar" hidden>Voltar ao meu quarto</button>
</details>
<div class="lado">
  <figure class="com-rotulo"><div class="vista"><div class="mundo"><canvas id="tela" width="${WC}" height="${WC}" aria-label="O quarto do coelho"></canvas><div id="rotulo" hidden></div><div id="nomes"></div><div id="aovivo" hidden></div><div id="recado" hidden></div></div><div id="fora-da-vista"></div></div><figcaption id="legenda"></figcaption></figure>
  <figure><img id="conceito" alt="O conceito"><figcaption>Conceito (ChatGPT), convertido para pixel art. A versão de dia é a repintura do quarto híbrido.</figcaption></figure>
</div>
</main>
<script>
const IMAGENS = ${JSON.stringify(IMAGENS)};
const MOVEIS = ${JSON.stringify(MOVEIS)};
const JANELAS = ${JSON.stringify(JANELAS)};
const ITENS_PAREDE = ${JSON.stringify(ITENS_PAREDE)};
const OBJETOS_DE_CIMA = ${JSON.stringify(OBJETOS_DE_CIMA)};
// Cada quadro vai UMA vez (as animações repetem quadros entre si: a pose parada no começo de cada uma, as pastas de
// reserva); as animações guardam o número dele.
const QUADROS_DO_COELHO = ${JSON.stringify(QUADROS)};
const ANIMACOES = Object.fromEntries(Object.entries(${JSON.stringify(ANIMACOES_IDX)}).map(([nome, dirs]) => [nome, Object.fromEntries(Object.entries(dirs).map(([d, qs]) => [d, qs.map((i) => QUADROS_DO_COELHO[i])]))]));
const CANTOS = ${JSON.stringify(CANTOS_DA_CENA)}, N = ${NC};
const CENA = ${JSON.stringify(CENA)}, DX = ${DX}, DY = ${DY};
// O que cada pessoa arrumou fica guardado por cena (o quarto e o salão não se misturam).
const PREFIXO = CENA === 'salao' ? 'syden-salao-' : 'syden-quarto-';
const MOVEIS_GIRADOS = ${JSON.stringify(Object.keys(GIROS))};
const TELAS_MEDIDAS = ${JSON.stringify(CENA === 'salao' ? JSON.parse(fs.readFileSync(path.join(SALAO, 'moveis', 'telas.json'), 'utf8')) : {})};
const W = ${WC};
function ponto(u, v) {
  const a = u / N, b = v / N, { fundo: B, esquerda: L, direita: R, frente: F } = CANTOS;
  return [0, 1].map((k) => B[k] * (1 - a) * (1 - b) + L[k] * a * (1 - b) + R[k] * (1 - a) * b + F[k] * a * b);
}
// O inverso: de um pixel para (u, v), pelo método de Newton na interpolação bilinear.
// A CONTA DIRETA (desempenho, 14/10/2026): o chão é quase um paralelogramo, então a inversa da parte linear já cai a
// menos de um centésimo de casa; dois passos de Newton acertam o resto. O Newton puro, de 12 passos, em cada pixel,
// custava a maior parte dos ~9 s de abertura num processador 4× mais lento.
function uvRapido(x, y) {
  const { fundo: B, esquerda: L, direita: R } = CANTOS;
  const a1 = L[0] - B[0], a2 = L[1] - B[1], b1 = R[0] - B[0], b2 = R[1] - B[1], det = a1 * b2 - b1 * a2;
  const dx = x - B[0], dy = y - B[1];
  let u = ((dx * b2 - b1 * dy) / det) * N, v = ((a1 * dy - dx * a2) / det) * N;
  for (let i = 0; i < 2; i++) {
    const [px, py] = ponto(u, v), e = 0.01;
    const [ax, ay] = ponto(u + e, v), [bx, by] = ponto(u, v + e);
    const j11 = (ax - px) / e, j21 = (ay - py) / e, j12 = (bx - px) / e, j22 = (by - py) / e;
    const d2 = j11 * j22 - j12 * j21, ex = x - px, ey = y - py;
    u += (j22 * ex - j12 * ey) / d2; v += (-j21 * ex + j11 * ey) / d2;
  }
  return [u, v];
}
function uvDe(x, y) {
  let u = N / 2, v = N / 2;
  for (let i = 0; i < 12; i++) {
    const [px, py] = ponto(u, v), e = 0.01;
    const [ax, ay] = ponto(u + e, v), [bx, by] = ponto(u, v + e);
    const j11 = (ax - px) / e, j21 = (ay - py) / e, j12 = (bx - px) / e, j22 = (by - py) / e;
    const det = j11 * j22 - j12 * j21, dx = x - px, dy = y - py;
    u += (j22 * dx - j12 * dy) / det; v += (-j21 * dx + j11 * dy) / det;
  }
  return [u, v];
}
// Leva uma peça pintada no quarto (desenhada em 0, 0) para as coordenadas da cena.
function deslocar(arr) {
  if (!DX && !DY) return arr;
  const out = new Uint8ClampedArray(arr.length);
  for (let y = 0; y + DY < W && y < 512; y++) out.set(arr.subarray(y * W * 4, (y * W + Math.min(512, W - DX)) * 4), ((y + DY) * W + DX) * 4);
  return out;
}
const carregar = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
function dados(im, filtro, w = W, h = W) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (filtro) g.filter = filtro;
  g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data;
}

(async () => {
  const im = {};
  for (const [k, src] of Object.entries(IMAGENS)) im[k] = await carregar(src);
  // A VISITA (15/10/2026): visitando o quarto de outra pessoa, nada se arrasta nem se guarda. E, entrando numa conta, cada
  // mudança vai também para o servidor (enviar, definido lá embaixo, com a conta).
  let soVer = false, enviar = () => {}, comecarPan = () => {};
  // AS OPÇÕES DE GRÁFICOS (pedido dele, 15/10/2026: "as partículas e a sombra deveriam estar num menu para ligar e
  // desligar; aqui está pesando, imagine em PC mais modesto"). Moram no navegador ('syden:graficos'), as mesmas no quarto
  // e no salão; no app, quem as escolhe são as Configurações (Aparência), e a página percebe na hora pelo evento storage
  // (é o mesmo site). TODAS DESLIGADAS DE FÁBRICA (decisão dele, mesmo dia: o uso principal é com um jogo aberto, e quem
  // quiser o enfeite liga); o "ajustar sozinho" saiu, também por decisão dele.
  const GRAFICOS_PADRAO = { particulas: false, sombras: false, telas: false };
  const lerGraficos = () => { try { return { ...GRAFICOS_PADRAO, ...JSON.parse(localStorage.getItem('syden:graficos') ?? '{}') }; } catch { return { ...GRAFICOS_PADRAO }; } };
  let GRAFICOS = lerGraficos();
  const liga = (k) => !!GRAFICOS[k];
  const MODO_APP = new URLSearchParams(location.search).has('app');
  if (CENA === 'salao') document.body.classList.add('salao');
  if (MODO_APP) document.documentElement.classList.add('app');
  // ============================== A JANELA MÓVEL (15/10/2026) ==============================
  // O quarto sem janela, e a janela como peça (o tipo, a parede e quantas casas ela andou). Tudo o que a página usava da
  // pintura com a janela (a base, as noites, o vidro, a cortina, a janela aberta e as luzes borradas) é MONTADO aqui, e
  // montado de novo quando a janela muda. Na janela original, no lugar dela, a montagem dá a pintura de antes.
  const semDia = dados(im['sem-dia']), semNoite = dados(im['sem-noite']), semAbajur = dados(im['sem-noite-abajur']);
  // A repintura do abajur veio numa caixa, e a borda reta dela aparece na parede: perto da borda, mistura com a noite.
  const CAIXA_ABAJUR = [190, 100, 322, 292], FAIXA = 14; // a de noite-abajur.mjs
  for (let k = 0; k < W * W; k++) {
    const x = k % W, y = (k / W) | 0, [x0, y0, x1, y1] = CAIXA_ABAJUR;
    const borda = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    if (borda < 0 || borda >= FAIXA) continue;
    const t = (borda + 1) / (FAIXA + 1);
    for (let c = 0; c < 3; c++) semAbajur[k * 4 + c] = semAbajur[k * 4 + c] * t + semNoite[k * 4 + c] * (1 - t);
  }
  function borrar(arr, px) {
    const a = document.createElement('canvas'); a.width = W; a.height = W;
    a.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(arr), W, W), 0, 0);
    const b = document.createElement('canvas'); b.width = W; b.height = W; const gb = b.getContext('2d');
    gb.filter = 'blur(' + px + 'px)'; gb.drawImage(a, 0, 0); return gb.getImageData(0, 0, W, W).data;
  }
  // A luz de cada lugar, sem a cor das coisas: a peça posta noutro lugar ganha a razão entre a luz de lá e a de onde
  // foi pintada (a parede da direita é mais escura e mais quente que a da esquerda).
  const semDiaL = borrar(semDia, 10), semNoiteL = borrar(semNoite, 10), semAbajurL = borrar(semAbajur, 10);
  const TIPOS_JANELA = {};
  for (const [t, meta] of Object.entries(JANELAS)) {
    const d = (a) => (im['jan-' + t + '-' + a] ? dados(im['jan-' + t + '-' + a]) : null);
    TIPOS_JANELA[t] = { ...meta, dia: d('peca-dia'), noite: d('peca-noite'), vidro: d('vidro'), luar: d('luar'), cortinaDia: d('cortina-dia'), cortinaNoite: d('cortina-noite'), aberta: d('aberta-dia'), vao: d('aberta-vao'), vidroAberto: d('aberta-vidro') };
  }
  const ORDEM_JANELAS = Object.keys(TIPOS_JANELA);
  // No salão, a redonda na parede da direita, acima do lambri (a original, de cortinas até o chão, é a do quarto).
  // No salão, a com floreira (pedido dele, 15/10/2026: a redonda saía cortada e ele não gostou do desenho).
  const JANELA_INICIAL = CENA === 'salao' ? { tipo: 'floreira', parede: 'direita', v: 4.5 } : { tipo: 'original', parede: 'direita', v: 0 };
  let JAN = { ...JANELA_INICIAL };
  try { const gj = JSON.parse(localStorage.getItem(PREFIXO + 'janela') ?? 'null'); if (gj && TIPOS_JANELA[gj.tipo]) JAN = gj; } catch { /* a de fábrica */ }
  // OS OBJETOS DA PAREDE: onde cada um está ({ parede, v, h }: a parede, quantas casas andou e quantos px subiu); o que não
  // está aqui fica guardado. De fábrica, os três com função ficam na parede da esquerda (a da direita é da janela).
  const PAREDE_INICIAL = CENA === 'salao' ? { quadro: { parede: 'esquerda', v: 0.5, h: -22 } } : { quadro: { parede: 'esquerda', v: 0, h: 0 }, fone: { parede: 'esquerda', v: -2.5, h: -6 }, cortica: { parede: 'esquerda', v: 3, h: 0 } };
  let NA_PAREDE = JSON.parse(JSON.stringify(PAREDE_INICIAL));
  try { const gp = JSON.parse(localStorage.getItem(PREFIXO + 'parede') ?? 'null'); if (gp) NA_PAREDE = Object.fromEntries(Object.entries(gp).filter(([id]) => ITENS_PAREDE[id])); } catch { /* a de fábrica */ }
  const guardarParede = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'parede', JSON.stringify(NA_PAREDE)); } catch { /* fica só nesta visita */ } enviar(); };
  const TEXTURAS_PAREDE = {};
  for (const id of Object.keys(ITENS_PAREDE)) TEXTURAS_PAREDE[id] = { dia: dados(im['par-' + id + '-dia']), noite: dados(im['par-' + id + '-noite']) };
  // Até onde um objeto vai na parede: inteiro nela, acima do rodapé (30 px) e até a sombra da cornija (190 px: a parede
  // clara vai a ~176 px do chão, e o recorte traz uns pixels de sombra em volta).
  const prenderNaParede = (id, P) => { const it = ITENS_PAREDE[id]; return { parede: P.parede, v: Math.round(Math.max(-it.ocupa[0], Math.min(N - it.ocupa[1], P.v)) * 10) / 10, h: Math.round(Math.max(30 - it.alto[0], Math.min(190 - it.alto[1], P.h))) }; };
  const mapaDaParede = (P) => { const dx = Math.round(27 * P.v), dy = Math.round(14.25 * P.v) - Math.round(P.h) + DY; return (x, y) => { x += dx + DX; y += dy; if (P.parede === 'esquerda') x = W - 1 - x; return x < 0 || y < 0 || x >= W || y >= W ? -1 : y * W + x; }; };
  const naParede = new Int8Array(W * W);
  const guardarJanela = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'janela', JSON.stringify(JAN)); } catch { /* fica só nesta visita */ } enviar(); };
  // Para onde vai cada pixel da peça: ao longo da parede, o vetor de uma casa em v (27 px, 14,25 px); na outra parede, o
  // espelho (o quarto é simétrico em volta de x = 256).
  const mapaDe = (J) => { const dx = Math.round(27 * J.v), dy = Math.round(14.25 * J.v) + DY; return (x, y) => { x += dx + DX; y += dy; if (J.parede === 'esquerda') x = W - 1 - x; return x < 0 || y < 0 || x >= W || y >= W ? -1 : y * W + x; }; };
  // Onde a janela pode ficar: inteira na parede.
  const limitesDe = (t) => [-TIPOS_JANELA[t].ocupa[0], N - TIPOS_JANELA[t].ocupa[1]];
  const ehChao = new Uint8Array(W * W);
  for (let k = 0; k < W * W; k++) { const [u, v] = uvRapido(k % W + 0.5, ((k / W) | 0) + 0.5); ehChao[k] = u > 0 && u < N && v > 0 && v < N ? 1 : 0; }
  function compor(fundo, peca, Ld, Ls, luar, ganho, mapa) {
    const out = new Uint8ClampedArray(fundo);
    if (luar) for (let k = 0; k < W * W; k++) {
      if (luar[k * 4] < 128) continue;
      const d = mapa(k % W, (k / W) | 0);
      if (d >= 0 && ehChao[d]) for (let c = 0; c < 3; c++) out[d * 4 + c] = fundo[d * 4 + c] * ganho[c];
    }
    if (peca) for (let k = 0; k < W * W; k++) {
      if (peca[k * 4 + 3] < 128) continue;
      const d = mapa(k % W, (k / W) | 0);
      if (d < 0) continue;
      for (let c = 0; c < 3; c++) out[d * 4 + c] = peca[k * 4 + c] * Math.min(2.5, Math.max(0.6, Ld[d * 4 + c] / Math.max(1, Ls[k * 4 + c])));
    }
    return out;
  }
  let base, noite, noiteAbajur, noiteSemLuar, abajurSemLuar, cortinaDia, cortinaNoite, abertaDia, vidro;
  let diaBorrado, diaPouco, noitePouco, diaPe, noiteAbajurPouco, noitePe, noiteAbajurPe;
  const naJanela = new Uint8Array(W * W), noCaixilho = new Uint8Array(W * W), vao = new Uint8Array(W * W), vidroAberto = new Uint8Array(W * W);
  // De onde veio cada pixel de vidro (a vista é posta nas coordenadas da pintura, espelhada, em (330, 105)).
  const origemDoVidro = new Int32Array(W * W).fill(-1);
  let luzDoDia = [420 + DX, 170 + DY];
  const vistasNoite = [1, 2, 3, 4].map((n) => dados(im['noite' + n], null, 128, 160));
  const vistasDia = [1, 2, 3, 4].map((n) => dados(im['vista' + n], null, 128, 160));
  let vista = 0, fechada = false, aberta = false;
  const daVista = (v, k, c) => { const s = origemDoVidro[k], x = s % W, y = (s / W) | 0; return v[((y - 105) * 128 + (127 - (x - 330))) * 4 + c]; };
  let luzPintada = true;
  // O cinza em volta do quarto (o fundo da base) fica transparente.
  // O cinza em volta do quarto fica transparente, preenchido a partir da borda e com folga de cor (só o cinza exato
  // deixava pontinhos claros). Um para cada versão: a noite, feita por edição, tem o contorno 1 ou 2 px diferente.
  function fundoDe(img) {
    const fora = new Uint8Array(W * W), fila = [];
    const parecido = (k) => [0, 1, 2].every((c) => Math.abs(img[k * 4 + c] - img[c]) < 24);
    for (let i = 0; i < W; i++) for (const k of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (!fora[k] && parecido(k)) { fora[k] = 1; fila.push(k); }
    for (let q = 0; q < fila.length; q++) {
      const k = fila[q], x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, b = yy * W + xx;
        if (xx >= 0 && yy >= 0 && xx < W && yy < W && !fora[b] && parecido(b)) { fora[b] = 1; fila.push(b); }
      }
    }
    return fora;
  }
  const foraDia = fundoDe(semDia), foraNoite = fundoDe(semNoite);
  // Dois pixels creme soltos na borda de fora do friso (156,68 e 379,80 na base): a ponta clara da madeira encostada
  // no fundo, que vira um ponto branco sobre a página escura. Pixel claro com 2 ou mais vizinhos de fundo ganha a cor
  // do vizinho mais escuro, que é o contorno.
  function contorno(img, fora) {
    for (let k = 0; k < W * W; k++) {
      if (fora[k] || img[k * 4] + img[k * 4 + 1] + img[k * 4 + 2] <= 360) continue;
      const x = k % W, y = (k / W) | 0, viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (y + dy) * W + x + dx);
      if (viz.filter((n) => fora[n]).length < 2) continue;
      const escuro = viz.filter((n) => !fora[n]).sort((p, q) => img[p * 4] + img[p * 4 + 1] + img[p * 4 + 2] - (img[q * 4] + img[q * 4 + 1] + img[q * 4 + 2]))[0];
      if (escuro !== undefined) for (let c = 0; c < 3; c++) img[k * 4 + c] = img[escuro * 4 + c];
    }
  }
  // O QUADRO DA COMUNIDADE (no salão, 15/10/2026: "o quadro precisa mostrar a imagem da comunidade"). É o quadro de
  // fotos com a imagem no lugar das fotos, por código: a parte de dentro da moldura (medida no recorte, parede/quadro/,
  // nas coordenadas da parede da direita onde foi pintado) é um paralelogramo — colunas em pé, e o alto e o pé subindo
  // com a parede. A imagem é desenhada no plano da parede e cada coluna pega a sua fatia. Na parede da esquerda o recorte
  // é espelhado, e a imagem é espelhada antes, para sair do lado certo. Sem imagem, ficam as fotos dos coelhos.
  const DENTRO_DO_QUADRO = { x0: 352, x1: 397, a: 114 / 216, t: -65, b: -39 };
  let IMAGEM_DA_COMUNIDADE = null, versaoDaImagem = 0; // { w, h, px }: já no tamanho de dentro do quadro
  let cacheDoQuadro = { chave: '', t: null };
  function quadroComImagem(parede) {
    const chave = parede + versaoDaImagem;
    if (cacheDoQuadro.chave === chave) return cacheDoQuadro.t;
    const dia = new Uint8ClampedArray(TEXTURAS_PAREDE.quadro.dia), { x0, x1, a, t, b } = DENTRO_DO_QUADRO, { w, h, px } = IMAGEM_DA_COMUNIDADE;
    for (let x = x0; x <= x1; x++) {
      const ya = Math.round(a * x + t), yb = Math.round(a * x + b);
      const sx = parede === 'esquerda' ? (x1 - x) / (x1 - x0) : (x - x0) / (x1 - x0);
      for (let y = ya; y <= yb; y++) {
        const k = (y * W + x) * 4;
        if (!dia[k + 3]) continue;
        const i = (Math.min(h - 1, Math.floor(((y - ya) / (yb - ya + 1)) * h)) * w + Math.min(w - 1, Math.floor(sx * w))) * 4;
        for (let c = 0; c < 3; c++) dia[k + c] = px[i + c];
      }
    }
    cacheDoQuadro = { chave, t: { ...TEXTURAS_PAREDE.quadro, dia } };
    return cacheDoQuadro.t;
  }
  // A imagem (o endereço que o app manda): desenhada no plano da parede, no tamanho de dentro do quadro, sobre o creme do
  // passe-partout. "cobrir" (a capa, larga) enche e corta; "conter" (o ícone, quadrado) fica inteiro, no meio.
  function carregarImagem(d) {
    if (!d || !d.url || !TEXTURAS_PAREDE.quadro) { IMAGEM_DA_COMUNIDADE = null; versaoDaImagem++; aplicarJanela(); desenhar(); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const { x0, x1, a, t, b } = DENTRO_DO_QUADRO, w = Math.round((x1 - x0 + 1) * Math.hypot(1, a)), h = Math.round(b - t + 1);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g2 = c.getContext('2d');
      g2.fillStyle = '#e8d6b6'; g2.fillRect(0, 0, w, h);
      const esc = d.encaixe === 'cobrir' ? Math.max(w / img.width, h / img.height) : Math.min((w - 4) / img.width, (h - 4) / img.height);
      g2.drawImage(img, (w - img.width * esc) / 2, (h - img.height * esc) / 2, img.width * esc, img.height * esc);
      try { IMAGEM_DA_COMUNIDADE = { w, h, px: g2.getImageData(0, 0, w, h).data }; } catch { IMAGEM_DA_COMUNIDADE = null; } // imagem de outro site sem licença de leitura: ficam as fotos
      versaoDaImagem++; aplicarJanela(); assinaturaCena = ''; desenhar();
    };
    img.onerror = () => { IMAGEM_DA_COMUNIDADE = null; versaoDaImagem++; aplicarJanela(); desenhar(); };
    img.src = d.url;
  }
  // A MONTAGEM da janela onde ela está (rapido: arrastando, sem refazer as luzes borradas, refeitas ao soltar).
  function aplicarJanela(rapido) {
    const T = TIPOS_JANELA[JAN.tipo], mapa = mapaDe(JAN);
    if (!T.cortina) fechada = false;
    if (!T.abre) aberta = false;
    base = compor(semDia, T.dia, semDiaL, semDiaL, null, null, mapa);
    // No salão, a noite das peças é o desenho do dia vezes a noite do salão (a noite pintada delas é a do quarto).
    const pn = CENA === 'salao' ? T.dia : T.noite, Lpn = CENA === 'salao' ? semDiaL : semNoiteL;
    noite = compor(semNoite, pn, semNoiteL, Lpn, T.luar, T.ganho, mapa);
    noiteAbajur = compor(semAbajur, pn, semAbajurL, Lpn, T.luar, T.ganho, mapa);
    // Com a cortina fechada, sem o luar no chão.
    noiteSemLuar = compor(semNoite, CENA === 'salao' ? pn : T.cortinaNoite ?? T.noite, semNoiteL, Lpn, null, null, mapa);
    abajurSemLuar = compor(semAbajur, CENA === 'salao' ? pn : T.cortinaNoite ?? T.noite, semAbajurL, Lpn, null, null, mapa);
    cortinaDia = T.cortinaDia ? compor(semDia, T.cortinaDia, semDiaL, semDiaL, null, null, mapa) : base;
    cortinaNoite = noiteSemLuar;
    abertaDia = T.aberta ? compor(semDia, T.aberta, semDiaL, semDiaL, null, null, mapa) : base;
    // Os objetos da parede, por cima da janela (pendurados na parede, à frente da cortina).
    naParede.fill(0);
    const ids = Object.keys(NA_PAREDE).filter((id) => TEXTURAS_PAREDE[id]);
    ids.forEach((id, i) => {
      const P = NA_PAREDE[id], T2 = id === 'quadro' && CENA === 'salao' && IMAGEM_DA_COMUNIDADE ? quadroComImagem(P.parede) : TEXTURAS_PAREDE[id], mp = mapaDaParede(P);
      base = compor(base, T2.dia, semDiaL, semDiaL, null, null, mp);
      if (T.cortinaDia) cortinaDia = compor(cortinaDia, T2.dia, semDiaL, semDiaL, null, null, mp);
      abertaDia = compor(abertaDia, T2.dia, semDiaL, semDiaL, null, null, mp);
      const p2 = CENA === 'salao' ? T2.dia : T2.noite, L2 = CENA === 'salao' ? semDiaL : semNoiteL;
      for (const nome of ['noite', 'noiteSemLuar']) { const v0 = nome === 'noite' ? noite : noiteSemLuar; const v1 = compor(v0, p2, semNoiteL, L2, null, null, mp); if (nome === 'noite') noite = v1; else noiteSemLuar = v1; }
      noiteAbajur = compor(noiteAbajur, p2, semAbajurL, L2, null, null, mp);
      abajurSemLuar = compor(abajurSemLuar, p2, semAbajurL, L2, null, null, mp);
      for (let k = 0; k < W * W; k++) if (T2.dia[k * 4 + 3] > 127) { const d = mp(k % W, (k / W) | 0); if (d >= 0) naParede[d] = i + 1; }
    });
    ordemDaParede = ids;
    if (!T.cortinaDia) cortinaDia = base;
    cortinaNoite = noiteSemLuar;
    contorno(base, foraDia); contorno(noite, foraNoite); contorno(noiteAbajur, foraNoite);
    vidro = new Uint8ClampedArray(W * W * 4);
    naJanela.fill(0); noCaixilho.fill(0); vao.fill(0); vidroAberto.fill(0); origemDoVidro.fill(-1);
    for (let k = 0; k < W * W; k++) {
      const naPeca = T.dia[k * 4 + 3] > 127 || (T.cortinaDia && T.cortinaDia[k * 4 + 3] > 127);
      const ab = T.aberta && T.aberta[k * 4 + 3] > 127, emVao = T.vao && T.vao[k * 4] > 127, emVA = T.vidroAberto && T.vidroAberto[k * 4] > 127;
      const emVidro = T.vidro[k * 4] > 127;
      if (!naPeca && !ab && !emVao && !emVidro) continue;
      const d = mapa(k % W, (k / W) | 0);
      if (d < 0) continue;
      naJanela[d] = 1;
      if (emVidro) { vidro[d * 4 + 3] = 255; origemDoVidro[d] = k; }
      if (ab || emVao || emVA) noCaixilho[d] = 1;
      if (emVao) { vao[d] = 1; origemDoVidro[d] = k; }
      if (emVA) { vidroAberto[d] = 1; origemDoVidro[d] = k; }
    }
    // A sombra do coelho de dia sai da janela: o ponto de luz anda com ela.
    const pl = mapa(420, 170); luzDoDia = pl >= 0 ? [pl % W, (pl / W) | 0] : [420 + DX, 170 + DY];
    if (!rapido) {
      diaBorrado = borrar(base, 10); diaPouco = borrar(base, 2); noitePouco = borrar(noite, 2); diaPe = borrar(base, 6);
      noiteAbajurPouco = borrar(noiteAbajur, 2); noitePe = borrar(noite, 6); noiteAbajurPe = borrar(noiteAbajur, 6);
    }
    noiteLimpa = null;
  }
  let noiteLimpa = null, ordemDaParede = [];
  aplicarJanela();
  const pecas = {};
  for (const m of MOVEIS) {
    const movel = deslocar(dados(im[m.id])), sombra = deslocar(dados(im[m.id + '-sombra']));
    let x0 = W, y0 = W, x1 = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
    // O centro do alto da peça (no abajur, a cúpula): a média dos x das 8 primeiras linhas.
    let soma = 0, n = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] && ((k / W) | 0) < y0 + 8) { soma += k % W; n++; }
    // A base DESENHADA (para o pufe): o ponto mais baixo da peça é a frente do círculo de baixo; o centro dele fica
    // meio pufe (0,75 casa em u e em v) para trás. A caixa pedida à ferramenta não serve: ela o desenhou deslocado.
    let y1 = 0; for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) y1 = Math.max(y1, (k / W) | 0);
    let sx = 0, nb = 0; for (let x = 0; x < W; x++) for (let y = y1 - 2; y <= y1; y++) if (movel[(y * W + x) * 4 + 3]) { sx += x; nb++; }
    const [cu0, cv0] = [(m.pe[0] + m.pe[1]) / 2, (m.pe[2] + m.pe[3]) / 2];
    const [ax, ay] = ponto(cu0, cv0), [bx, by] = ponto(cu0 + 0.75, cv0 + 0.75);
    const base = [sx / Math.max(1, nb) - (bx - ax), y1 - (by - ay)];
    // O pé de cada coluna: o pixel mais baixo da peça naquela coluna. É onde ela encosta no chão.
    const peColuna = new Int16Array(W).fill(-1);
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0);
    pecas[m.id] = { ...m, movel, sombra, topo: y0, centroX: (x0 + x1) / 2, centroTopo: soma / Math.max(1, n), base, peColuna };
  }
  // ============================== OS MÓVEIS SOLTOS (14/10/2026) ==============================
  // Pedido dele: "quero dar um layout inicial, mas quero permitir o usuário customizar o quarto como achar melhor". Todo
  // móvel se arrasta e gira (4 posições). Cada um tem as 4 vistas do MESMO móvel (girar.mjs), e o TAMANHO NO CHÃO sai do
  // próprio desenho (a cama pedida numa área saiu uma casa menor, e o coelho deitava longe dela): da quina da frente (o
  // ponto mais baixo) até a ponta da direita é o comprimento em u, até a da esquerda, em v (27 px por casa).
  // O layout inicial é o da PINTURA: enquanto um móvel pintado no quarto está no lugar e na posição de origem, é a
  // pintura dele que aparece (com a luz e a sombra de lá); mexido, entra a vista solta, com a intensidade da luz do lugar.
  const KX = (CANTOS.direita[0] - CANTOS.fundo[0]) / N;
  const VAZIA = new Uint8ClampedArray(W * W * 4);
  function pecaDeImagem(img, id) {
    const c = document.createElement('canvas'); c.width = W; c.height = W; const gc = c.getContext('2d'); gc.drawImage(img, 0, 0);
    const movel = gc.getImageData(0, 0, W, W).data;
    // A vista veio com a sombra pintada embaixo (cinza ou marrom chapado): tira-se a cor mais comum das últimas linhas.
    // Todas usam a sombra de contato da página, no formato do pé do móvel.
    let fundo = 0; for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / W) | 0);
    const conta = {};
    for (let y = fundo - 5; y <= fundo; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (movel[k + 3] > 127) { const cor = movel[k] + ',' + movel[k + 1] + ',' + movel[k + 2]; conta[cor] = (conta[cor] || 0) + 1; } }
    const [sombraCor, vezes] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    // Só é sombra a cor que mora no PÉ da imagem: a madeira da mesa e da cama e o contorno preto também são as mais
    // comuns nas últimas linhas, mas aparecem no móvel inteiro (tirá-las deixava a mesa transparente, 14/10/2026).
    const [sr, sg, sb] = sombraCor.split(',').map(Number), parecida = (k) => Math.abs(movel[k * 4] - sr) + Math.abs(movel[k * 4 + 1] - sg) + Math.abs(movel[k * 4 + 2] - sb) < 18;
    let emCima = 0; for (let k = 0; k < (fundo - 25) * W; k++) if (movel[k * 4 + 3] > 127 && parecida(k)) emCima++;
    if (vezes > 12 && emCima <= vezes * 0.1) for (let k = 0; k < W * W; k++) if (parecida(k)) movel[k * 4 + 3] = 0;
    let x0 = W, x1 = 0, y0 = W, y1 = 0;
    for (let k = 0; k < W * W; k++) { if (movel[k * 4 + 3] < 128) { movel[k * 4 + 3] = 0; continue; } const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let sx = 0, nb = 0; for (let x = 0; x < W; x++) for (let y = y1 - 2; y <= y1; y++) if (movel[(y * W + x) * 4 + 3]) { sx += x; nb++; }
    sx /= Math.max(1, nb);
    const peColuna = new Int16Array(W).fill(-1);
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0);
    let soma = 0, n = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] && ((k / W) | 0) < y0 + 8) { soma += k % W; n++; }
    // Da quina da frente (u1, v1): a ponta da DIREITA é (u0, v1), então a distância até ela é o comprimento em u; a da
    // esquerda é (u1, v0), o comprimento em v (x cresce com v e diminui com u).
    const mede = [Math.max(0.6, (x1 + 1 - sx) / KX), Math.max(0.6, (sx - x0) / KX)];
    // O MEIO DA BASE (para a cadeira, que é uma roda no chão): a largura das últimas 12 linhas é o pé de rodinhas; o meio
    // dele fica um quarto dessa largura acima do ponto mais baixo (a projeção 2:1 de um círculo).
    let bx0 = W, bx1 = 0;
    for (let y = y1 - 11; y <= y1; y++) for (let x = 0; x < W; x++) if (y >= 0 && movel[(y * W + x) * 4 + 3]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); }
    const meioDaBase = [(bx0 + bx1 + 1) / 2, y1 - (bx1 - bx0 + 1) / 4];
    return { id, movel, sombra: VAZIA, topo: y0, peColuna, frente: [sx, y1], mede, centroTopo: soma / Math.max(1, n), meioDaBase, caixa: [x0, y0, x1 + 1, y1 + 1] };
  }
  const VISTAS = {};
  for (const id of MOVEIS_GIRADOS) if (im['giro-' + id + '0']) VISTAS[id] = [0, 1, 2, 3].map((l) => pecaDeImagem(im['giro-' + id + l], id));
  // ============================== OS OBJETOS DE CIMA (15/10/2026) ==============================
  // Decisão dele: "o móvel deve ser uma coisa, os elementos outra". O que vai no tampo é peça à parte: mora num móvel,
  // numa posição relativa ao tampo dele (s, t de 0 a 1, no sentido do móvel), e tem a sua posição (lado). A peça do móvel
  // SAI COM OS OBJETOS dentro (comObjetos): arrastar, jogar, girar, a luz e a profundidade do móvel valem para eles.
  const OBJ_VISTAS = {};
  // Na METADE do tamanho em que foram gerados: inteiros, eles saíam 2,5 vezes maiores que de verdade (o copo de suco quase
  // do tamanho da banqueta, relato de 15/10/2026). Metade, pixel a pixel e sem suavizar, ainda se lê.
  const ESCALA_DOS_OBJETOS = 0.5;
  const reduzir = (img) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * ESCALA_DOS_OBJETOS)); c.height = Math.max(1, Math.round(img.height * ESCALA_DOS_OBJETOS)); const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(img, 0, 0, c.width, c.height); return c; };
  for (const id of Object.keys(OBJETOS_DE_CIMA)) OBJ_VISTAS[id] = [0, 1, 2, 3].map((l) => pecaDeImagem(reduzir(im['obj-' + id + l]), id));
  // A altura do tampo de cada móvel que recebe objetos (px acima do chão) e a margem da borda (para nada cair).
  // (o criado-mudo era 50, e a caneca flutuava na altura da cúpula: a "mancha" no abajur, relato de 15/10/2026)
  const TOPOS = { 'mesa-jogo': 34, mesa: 44, abajur: 35, 'guarda-roupa': 136, balcao: 54, mesinha: 22, tv: 30, estante: 122 };
  // A TELA DO COMPUTADOR (pedido dele, 14/10/2026: "o monitor fica desligado; seria legal ele ter variações, como a
  // janela"). A mesa veio com a tela lisa, de um cinza só (estado.mjs, "teclado"); a tela é a maior região ligada dessa
  // cor no alto do desenho, e o CONTEÚDO é desenhado por código, coluna a coluna (a tela é um paralelogramo inclinado):
  // em cada coluna, de cima a baixo da tela, s vai de 0 a 1 na largura e t na altura. Ela brilha sozinha (não escurece
  // de noite) e, de noite, clareia um pouco o que está em volta. Só as vistas de frente têm tela; nas de costas, o
  // monitor mostra a traseira.
  function telaDaVista(peca, recolher = 0) {
    const m = peca.movel, ate = peca.caixa[1] + Math.round((peca.caixa[3] - peca.caixa[1]) * 0.5);
    const conta = new Map();
    for (let y = peca.caixa[1]; y < ate; y++) for (let x = peca.caixa[0]; x < peca.caixa[2]; x++) {
      const k = (y * W + x) * 4; if (!m[k + 3]) continue;
      const r = m[k], g2 = m[k + 1], b = m[k + 2];
      if (Math.max(r, g2, b) - Math.min(r, g2, b) >= 25 || r + g2 + b <= 120) continue;
      const chave = r + ',' + g2 + ',' + b; conta.set(chave, (conta.get(chave) ?? 0) + 1);
    }
    const cor = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split(',').map(Number);
    if (!cor) return null;
    const perto = (k) => m[k * 4 + 3] && Math.abs(m[k * 4] - cor[0]) + Math.abs(m[k * 4 + 1] - cor[1]) + Math.abs(m[k * 4 + 2] - cor[2]) < 14;
    // a maior região ligada
    const visto = new Uint8Array(W * W); let maior = [];
    for (let y = peca.caixa[1]; y < ate; y++) for (let x = peca.caixa[0]; x < peca.caixa[2]; x++) {
      const k0 = y * W + x; if (visto[k0] || !perto(k0)) continue;
      const fila = [k0]; visto[k0] = 1;
      for (let i = 0; i < fila.length; i++) { const k = fila[i]; for (const v of [k - 1, k + 1, k - W, k + W]) if (v >= 0 && v < W * W && !visto[v] && perto(v)) { visto[v] = 1; fila.push(v); } }
      if (fila.length > maior.length) maior = fila;
    }
    if (maior.length < 60) return null;
    // a tela é convexa: em cada coluna, de cima a baixo dela
    let col = new Map();
    for (const k of maior) { const x = k % W, y = (k / W) | 0, c = col.get(x); if (!c) col.set(x, [y, y]); else { c[0] = Math.min(c[0], y); c[1] = Math.max(c[1], y); } }
    // A MOLDURA (o esboço dele, 15/10/2026): a imagem fica RECOLHIDA 3 px dentro do painel, por igual em volta; o painel
    // escuro que sobra é a moldura. (Por dentro do painel, o que o suporte risca entra junto: preenche-se cada coluna.)
    if (recolher) {
      const dentro = new Uint8Array(W * W);
      for (const [x, [ya, yb]] of col) for (let y = ya; y <= yb; y++) dentro[y * W + x] = 1;
      for (let volta = 0; volta < recolher; volta++) {
        const tira = [];
        for (const [x, [ya, yb]] of col) for (let y = ya; y <= yb; y++) { const k = y * W + x; if (dentro[k] && (!dentro[k - 1] || !dentro[k + 1] || !dentro[k - W] || !dentro[k + W])) tira.push(k); }
        for (const k of tira) dentro[k] = 0;
      }
      const novo = new Map();
      for (const [x, [ya, yb]] of col) for (let y = ya; y <= yb; y++) if (dentro[y * W + x]) { const c = novo.get(x); if (!c) novo.set(x, [y, y]); else { c[0] = Math.min(c[0], y); c[1] = Math.max(c[1], y); } }
      if (novo.size > 4) col = novo;
    }
    const xs = [...col.keys()].sort((a, b) => a - b), x0 = xs[0], x1 = xs[xs.length - 1];
    // As bordas de cima e de baixo são RETAS com a mesma inclinação (a tela é um paralelogramo): medidas pela coluna
    // de cada uma, sem o que tapa a tela (o suporte da TV encurtava as colunas de baixo, e a imagem encolhia ali:
    // relato de 15/10/2026, "a TV está com a imagem distorcida"). A inclinação é a mediana entre colunas afastadas; o
    // alto e o pé, a mediana e o máximo de cada borda.
    const med = (v) => { const o = [...v].sort((a, b) => a - b); return o[Math.floor(o.length / 2)] ?? 0; };
    const meio = Math.max(1, Math.floor(xs.length / 2)), incl = [];
    for (let i = 0; i + meio < xs.length; i++) incl.push((col.get(xs[i + meio])[0] - col.get(xs[i])[0]) / (xs[i + meio] - xs[i]));
    const k = med(incl), alto = med(xs.map((x) => col.get(x)[0] - k * x)), pe = Math.max(...xs.map((x) => col.get(x)[1] - k * x));
    const pts = [];
    // A IMAGEM SÓ NO PAINEL (relato de 15/10/2026, com o esboço dele): os pixels são os do próprio painel escuro (de cima a
    // baixo dele em cada coluna, com o que o suporte risca por dentro), e a moldura fica à vista em volta. A reta só decide
    // ONDE na imagem cai cada pixel (t), para ela não entortar onde o suporte encurta a coluna.
    for (const x of xs) { const [ya, yb] = col.get(x), ta = alto + k * x, tb = pe + k * x; for (let y = ya; y <= yb; y++) { const k4 = (y * W + x) * 4; if (m[k4 + 3]) pts.push([x, y, (x - x0) / Math.max(1, x1 - x0), Math.min(1, Math.max(0, (y - ta) / Math.max(1, tb - ta)))]); } }
    return pts;
  }
  const TELAS = VISTAS.mesa ? VISTAS.mesa.map((p, l) => (l === 0 || l === 3 ? telaDaVista(p) : null)) : [];
  // NO SALÃO, A TV E O FLIPERAMA (15/10/2026): as mesmas telas por código, achadas do mesmo jeito (a maior região lisa e
  // apagada no alto do desenho). A TV à toa passa um desenho calmo e, com alguém transmitindo, mostra o AO VIVO (o selo
  // piscando e uma transmissão genérica: a imagem de verdade não vem para cá, decisão dele de 13/10/2026); o fliperama
  // fica sempre ligado no joguinho, como os de verdade.
  const TELAS_DO_MOVEL = { mesa: TELAS };
  // A TELA MEDIDA (salao/moveis/telas.json, 15/10/2026): procurar a tela pela cor falhava nos dois (o vidro do fliperama
  // tem vários tons, e o suporte da TV tem a cor do painel: relatos dele). Os quatro cantos de cada tela foram medidos uma
  // vez; aqui só se enche o quadrilátero, com o recuo de cada um (a moldura da TV fica à vista).
  // E SÓ ONDE É PAINEL (relato de 15/10/2026: "nos cantos está transbordando"): a reta passava da moldura nas pontas.
  // O painel é o maior pedaço da cor dele (a TV) ou do cinza do vidro (o fliperama) dentro do quadrilátero, cheio coluna a
  // coluna (o suporte riscado por dentro entra), e recolhido para a moldura ficar à vista.
  function painelDe(peca, q, P) {
    const m = peca.movel, ok = new Uint8Array(W * W);
    const eh = (k) => { const r = m[k * 4], g2 = m[k * 4 + 1], b = m[k * 4 + 2]; if (!m[k * 4 + 3]) return false;
      if (P.cor) return Math.abs(r - P.cor[0]) + Math.abs(g2 - P.cor[1]) + Math.abs(b - P.cor[2]) < P.tol;
      const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b), l = (r + g2 + b) / 3; return mx - mn < 32 && l > 35 && l < 150; };
    const ys = [q.topo + q.k * q.x0, q.topo + q.k * q.x1, q.pe + q.k * q.x0, q.pe + q.k * q.x1], y0 = Math.floor(Math.min(...ys)) - 2, y1 = Math.ceil(Math.max(...ys)) + 2;
    for (let y = Math.max(0, y0); y <= Math.min(W - 1, y1); y++) for (let x = q.x0; x <= q.x1; x++) if (eh(y * W + x)) ok[y * W + x] = 1;
    // o maior pedaço ligado
    const visto = new Uint8Array(W * W); let maior = [];
    for (let y = Math.max(0, y0); y <= Math.min(W - 1, y1); y++) for (let x = q.x0; x <= q.x1; x++) {
      const k0 = y * W + x; if (!ok[k0] || visto[k0]) continue;
      const fila = [k0]; visto[k0] = 1;
      for (let i = 0; i < fila.length; i++) { const k = fila[i]; for (const v of [k - 1, k + 1, k - W, k + W]) if (ok[v] && !visto[v]) { visto[v] = 1; fila.push(v); } }
      if (fila.length > maior.length) maior = fila;
    }
    const dentro = new Uint8Array(W * W), col = new Map();
    for (const k of maior) { const x = k % W, y = (k / W) | 0, c = col.get(x); if (!c) col.set(x, [y, y]); else { c[0] = Math.min(c[0], y); c[1] = Math.max(c[1], y); } }
    for (const [x, [a, b]] of col) for (let y = a; y <= b; y++) dentro[y * W + x] = 1;
    for (let volta = 0; volta < (P.recolher ?? 0); volta++) {
      const tira = [];
      for (const [x, [a, b]] of col) for (let y = a; y <= b; y++) { const k = y * W + x; if (dentro[k] && (!dentro[k - 1] || !dentro[k + 1] || !dentro[k - W] || !dentro[k + W])) tira.push(k); }
      for (const k of tira) dentro[k] = 0;
    }
    return dentro;
  }
  function telaMedida(peca, q, recuo, P) {
    const [re, rd, rc, rb] = recuo, x0 = q.x0 + re, x1 = q.x1 - rd, pts = [], dentro = P ? painelDe(peca, q, P) : null;
    for (let x = x0; x <= x1; x++) {
      const ta = q.topo + q.k * x + rc, tb = q.pe + q.k * x - rb;
      for (let y = Math.ceil(ta); y <= Math.floor(tb); y++) if (peca.movel[(y * W + x) * 4 + 3] && (!dentro || dentro[y * W + x])) pts.push([x, y, (x - x0) / Math.max(1, x1 - x0), Math.min(1, Math.max(0, (y - ta) / Math.max(1, tb - ta)))]);
    }
    return pts;
  }
  for (const id of ['tv', 'fliperama']) if (VISTAS[id]) TELAS_DO_MOVEL[id] = VISTAS[id].map((p, l) => (l === 0 || l === 3 ? (TELAS_MEDIDAS[id]?.[l] ? telaMedida(p, TELAS_MEDIDAS[id][l], TELAS_MEDIDAS[id].recuo, TELAS_MEDIDAS[id].painel) : telaDaVista(p, id === 'tv' ? 3 : 0)) : null));
  let AO_VIVO = null; // { rotulo, nome, sub, canal, total }: quem transmite agora (o app manda, já traduzido)
  const tipoDaTela = (id) => (id === 'mesa' ? conteudoAgora() : id === 'tv' ? (AO_VIVO ? 'ao-vivo' : 'tv') : 'fliperama');
  const COR_DO_BRILHO = { call: [90, 110, 160], jogo: [120, 170, 210], conversa: [140, 120, 190], tv: [170, 140, 120], 'ao-vivo': [190, 90, 110], fliperama: [160, 110, 210] };
  // O CONTEÚDO: "auto" segue o estado (em call, a chamada; à toa, a conversa; ausente, desligada); o botão escolhe.
  const CONTEUDOS = ['auto', 'call', 'conversa', 'jogo', 'desligada'];
  let conteudo = 'auto';
  const conteudoAgora = () => (conteudo !== 'auto' ? conteudo : estado === 'call' ? 'call' : estado === 'ausente' ? 'desligada' : 'conversa');
  const misturar = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  // A cor de um ponto (s, t) da tela, no instante "q" (quartos de segundo). Pixel art: blocos chapados, poucas cores.
  function corDaTela(s, t, q, tipo) {
    if (tipo === 'call') {
      // A chamada: quatro quadros com as pessoas (a cabeça redonda), a borda verde em quem fala, e a barra embaixo.
      if (t > 0.86) return s > 0.44 && s < 0.56 ? [214, 72, 72] : [28, 30, 44];
      const i = s < 0.5 ? 0 : 1, j = t < 0.43 ? 0 : 1, quem = i + j * 2, fala = Math.floor(q / 6) % 4;
      const ls = (s - i * 0.5) / 0.5, lt = (t - j * 0.43) / 0.43;
      if (ls < 0.06 || ls > 0.94 || lt < 0.07 || lt > 0.93) return quem === fala ? [96, 210, 120] : [28, 30, 44];
      const CORES = [[236, 170, 178], [160, 214, 196], [240, 214, 140], [190, 170, 230]];
      const dx = (ls - 0.5) * 1.6, dy = (lt - 0.48) * 1.1;
      if (dx * dx + dy * dy < 0.12) return CORES[quem];
      if (lt > 0.78 && Math.abs(ls - 0.5) < 0.34) return misturar(CORES[quem], [40, 44, 62], 0.45); // os ombros
      return [48, 52, 74];
    }
    if (tipo === 'conversa') {
      // A conversa do Syden: a barra dos canais à esquerda e as mensagens subindo devagar.
      if (s < 0.22) return t < 0.18 ? [120, 96, 170] : [40, 36, 56];
      const linha = Math.floor(t * 9 + q / 8) % 9;
      const larg = [0.6, 0.85, 0, 0.45, 0.75, 0, 0.9, 0.5, 0][linha];
      const lt = (t * 9 + q / 8) % 1;
      if (larg && lt > 0.3 && lt < 0.8 && (s - 0.28) / 0.66 < larg && s > 0.28) return linha % 3 === 1 ? [200, 190, 240] : [226, 222, 236];
      if (larg && s > 0.24 && s < 0.27 && lt > 0.2 && lt < 0.9) return [236, 170, 178];
      return [58, 54, 78];
    }
    if (tipo === 'tv') {
      // A TV à toa: um desenho calmo, o fim de tarde com o sol e os morros, a grama balançando.
      const morro = 0.64 + Math.sin(s * 8 + q / 6) * 0.04;
      if (t > morro) return t > 0.84 ? [92, 140, 84] : [122, 178, 98];
      if ((s - 0.72) ** 2 * 2.4 + (t - 0.32) ** 2 < 0.014) return [250, 216, 124];
      return t < 0.3 ? [232, 150, 126] : t < 0.5 ? [240, 184, 140] : [246, 208, 158];
    }
    if (tipo === 'ao-vivo') {
      // AO VIVO: o selo vermelho piscando no canto e, no resto, alguém jogando (o joguinho do computador do quarto).
      if (s < 0.32 && t < 0.26) return s > 0.05 && s < 0.27 && t > 0.06 && t < 0.2 ? (q % 4 < 3 ? [228, 64, 64] : [120, 40, 48]) : [24, 22, 34];
      return corDaTela(s, t, q, 'jogo');
    }
    if (tipo === 'fliperama') {
      // O fliperama: os invasores marchando de um lado para o outro, e a navinha atirando embaixo.
      const passo = q % 16 < 8 ? (q % 8) / 8 : 1 - (q % 8) / 8;
      const col = (s - 0.08 - passo * 0.2) / 0.16, lin = (t - 0.1) / 0.16;
      if (col >= 0 && col < 4 && lin >= 0 && lin < 3 && col % 1 > 0.18 && col % 1 < 0.82 && lin % 1 > 0.22 && lin % 1 < 0.78) return [[236, 110, 200], [120, 220, 160], [250, 210, 110]][Math.floor(lin)];
      const nave = 0.5 + Math.sin(q / 4) * 0.3;
      if (t > 0.8 && t < 0.93 && Math.abs(s - nave) < 0.09) return [130, 200, 250];
      const tiro = 0.78 - ((q % 6) / 6) * 0.6;
      if (Math.abs(s - nave) < 0.04 && Math.abs(t - tiro) < 0.05) return [250, 250, 220];
      return [20, 16, 36];
    }
    if (tipo === 'jogo') {
      // Um joguinho de plataforma: céu, nuvem, chão, e o bonequinho pulando.
      const pulo = Math.abs(Math.sin(q / 3)) * 0.25, bx = 0.3 + ((q % 40) / 40) * 0.4;
      if (Math.abs(s - bx) < 0.05 && t > 0.62 - pulo && t < 0.74 - pulo) return [236, 120, 90];
      if (t > 0.74) return t > 0.8 ? [120, 86, 60] : [110, 190, 90];
      if (t > 0.18 && t < 0.28 && ((s + q / 60) % 1) > 0.55 && ((s + q / 60) % 1) < 0.8) return [246, 246, 250];
      return [130, 190, 236];
    }
    return null; // desligada: o cinza do desenho
  }
  let EM_CIMA = {};
  const EM_CIMA_INICIAL = () => {
    const a = {};
    if (CENA === 'salao') {
      if (OBJ_VISTAS.pipoca && VISTAS.mesinha) a.o1 = { tipo: 'pipoca', em: 'mesinha', s: 0.5, t: 0.5, lado: 0 };
      if (OBJ_VISTAS.suco && VISTAS.balcao) a.o2 = { tipo: 'suco', em: 'balcao', s: 0.5, t: 0.3, lado: 0 };
      if (OBJ_VISTAS.refrigerante && VISTAS.balcao) a.o3 = { tipo: 'refrigerante', em: 'balcao', s: 0.5, t: 0.7, lado: 0 };
      if (OBJ_VISTAS.videogame && VISTAS.tv) a.o4 = { tipo: 'videogame', em: 'tv', s: 0.5, t: 0.82, lado: 0 };
      return a;
    }
    if (OBJ_VISTAS.plantinha && VISTAS.mesa) a.o1 = { tipo: 'plantinha', em: 'mesa', s: 0.25, t: 0.82, lado: 0 };
    if (OBJ_VISTAS.livros && VISTAS.mesa) a.o2 = { tipo: 'livros', em: 'mesa', s: 0.7, t: 0.85, lado: 0 };
    if (OBJ_VISTAS.caneca && VISTAS.abajur) a.o3 = { tipo: 'caneca', em: 'abajur', s: 0.2, t: 0.5, lado: 0 };
    return a;
  };
  EM_CIMA = EM_CIMA_INICIAL();
  try { const go = JSON.parse(localStorage.getItem(PREFIXO + 'objetos') ?? 'null'); if (go) EM_CIMA = Object.fromEntries(Object.entries(go).filter(([, o]) => OBJ_VISTAS[o.tipo] && TOPOS[o.em])); } catch { /* os de fábrica */ }
  // O GUARDA-ROUPA ABERTO (pedido dele, 14/10/2026: "precisa de mais estados, como temos na janela"): as portas abertas
  // com as roupas, nas mesmas 4 vistas. Clicar nele leva o coelho até lá e abre; clicar de novo fecha.
  const VISTAS_ABERTO = im['giro-guarda-roupa-aberto0'] ? [0, 1, 2, 3].map((l) => pecaDeImagem(im['giro-guarda-roupa-aberto' + l], 'guarda-roupa')) : null;
  let guardaRoupaAberto = false;
  // As portas ABRINDO (pedido dele, 15/10/2026): os quadros do meio entre o fechado e o aberto. "portas" vai de 0
  // (fechado) a 3 (aberto) e anda um passo a cada dois quadros do relógio na direção de guardaRoupaAberto.
  const PASSAGEM_GR = im['passagem-guarda-roupa0-0'] ? [0, 1, 2, 3].map((l) => [0, 1].map((k) => pecaDeImagem(im['passagem-guarda-roupa' + l + '-' + k], 'guarda-roupa'))) : null;
  let portas = 0;
  window.portasDoTeste = () => ({ aberto: guardaRoupaAberto, portas }); // para o teste
  // Para onde cada móvel olha em cada posição (a ordem das vistas: Girar anda nesta lista).
  const ORIENTA = ['sudoeste', 'noroeste', 'nordeste', 'sudeste'];
  const NOMES = { cadeira: 'a cadeira', pufe: 'o pufe', poltrona: 'a poltrona', abajur: 'o criado-mudo', 'guarda-roupa': 'o guarda-roupa', cama: 'a cama', tapete: 'o tapete', mesa: 'a mesa', 'planta-alta': 'a planta alta', 'planta-baixa': 'a samambaia', sofa: 'o sofá', tv: 'a TV', fliperama: 'o fliperama', balcao: 'o balcão', estante: 'a estante', mesinha: 'a mesinha', banqueta: 'a banqueta', 'banqueta-2': 'a outra banqueta', 'sofa-2': 'o outro sofá', 'poltrona-2': 'a outra poltrona', 'mesa-jogo': 'a mesa de jogos', 'cadeira-2': 'outra cadeira', 'cadeira-3': 'outra cadeira', 'cadeira-4': 'outra cadeira', jukebox: 'a jukebox', microfone: 'o microfone', pufao: 'o pufão' };
  const pufes = MOVEIS.filter((m) => m.pufe);
  const fixos = MOVEIS.filter((m) => !m.pufe);
  const centro = (pe) => [(pe[0] + pe[1]) / 2, (pe[2] + pe[3]) / 2];
  const pintado = (id) => fixos.find((m) => m.id === id);
  // Onde cada móvel foi pintado, e para onde ele olha na pintura (o criado-mudo e o guarda-roupa, de frente para o quarto).
  const LADO_PINTADO = { abajur: 3, 'guarda-roupa': 3, cama: 0, tapete: 0 };
  // O tamanho em casas inteiras, para a grade: o pufe 2 × 2, o tapete 4 × 4, o resto medido no desenho.
  const tamDe = (id, lado) => {
    if (id === 'pufe') return [2, 2];
    if (id === 'tapete') return [4, 4];
    const m = VISTAS[id]?.[lado].mede;
    if (m) return m.map((d) => Math.max(1, Math.ceil(d - 0.25)));
    const pe = pintado(id).pe; return [pe[1] - pe[0], pe[3] - pe[2]];
  };
  const encaixar = (id, u, v, lado) => { const [tu, tv] = tamDe(id, lado); return [Math.round(u - tu / 2) + tu / 2, Math.round(v - tv / 2) + tv / 2]; };
  function arrumacaoInicial() {
    // O SALÃO (o layout combinado com ele, 15/10/2026): a TV encostada na parede da direita e o sofá de frente para ela,
    // a mesinha no meio; o fliperama no fundo, à direita; a estante na parede de tijolo; o balcão com as banquetas no
    // canto da esquerda, com espaço atrás para o coelho do recado; o tapete embaixo do sofá.
    if (CENA === 'salao') {
      const s = {};
      const por = (id, u, v, lado) => { if (VISTAS[id] || pintado(id)) s[id] = { c: VISTAS[id] ? encaixar(id, u, v, lado) : [u, v], lado }; };
      // 16 × 16 (15/10/2026): o canto da TV, o bar e o fliperama perto do fundo, como no 8 × 8, e a frente livre para o
      // que vier (outro sofá, mesas, o karaokê).
      por('tv', 1.2, 6, 0);
      por('sofa', 5.2, 6, 2);
      por('mesinha', 3.4, 6, 0);
      por('fliperama', 0.8, 9, 0);
      por('estante', 2.5, 0.6, 3);
      por('balcao', 7.3, 1.6, 3);
      por('banqueta', 6.6, 2.9, 0);
      por('banqueta-2', 7.9, 2.9, 0);
      por('planta-alta', 0.6, 0.6, 0);
      por('planta-baixa', 15.2, 0.8, 0);
      // o canto do karaokê, na parede da TV: a jukebox e o microfone com a caixa de som
      por('jukebox', 0.8, 12.3, 0);
      por('microfone', 1.6, 14.6, 0);
      // a mesa de jogos, na frente da parede de tijolo, com as quatro cadeiras viradas para ela
      por('mesa-jogo', 13, 3, 0);
      por('cadeira', 11.6, 3, 0);
      por('cadeira-2', 14.4, 3, 2);
      por('cadeira-3', 13, 1.6, 3);
      por('cadeira-4', 13, 4.4, 1);
      // a segunda roda: o outro sofá e as duas poltronas de frente para ele, e o pufão
      por('sofa-2', 13.5, 9.5, 2);
      por('poltrona', 10.2, 8.1, 0);
      por('poltrona-2', 10.2, 10.9, 0);
      por('pufao', 12, 12.6, 1);
      if (pintado('tapete')) s.tapete = { c: [4.3, 6.2], lado: 0 };
      return s;
    }
    const a = { pufe: { c: centro(pintado('tapete') ? MOVEIS.find((m) => m.id === 'pufe-meio').pe : [4, 6, 4, 6]).map(Math.round), lado: 0 }, poltrona: { c: [3, 6], lado: 0 } };
    for (const m of fixos) a[m.id] = { c: centro(m.pe), lado: LADO_PINTADO[m.id] ?? 0 };
    // A cama de casal não foi pintada aqui: começa no canto da cama pintada, encostada na parede da esquerda.
    if (VISTAS.cama) { const [tu, tv] = tamDe('cama', 0); a.cama = { c: [1.5 + tu / 2, tv / 2], lado: 0 }; }
    // A mesa do computador: encostada na parede da janela, no canto da direita, virada para o quarto (como na home); a
    // poltrona vai para o meio.
    if (VISTAS.mesa) { const [tu, tv] = tamDe('mesa', 0); a.mesa = { c: encaixar('mesa', 1 + tu / 2, N - tv / 2, 0), lado: 0 }; a.poltrona = { c: [3, 4], lado: 0 }; }
    // As plantas (15/10/2026): a alta no canto da frente, junto da parede da esquerda; a samambaia ao lado da mesa.
    if (VISTAS['planta-alta']) a['planta-alta'] = { c: encaixar('planta-alta', 7.5, 0.5, 0), lado: 0 };
    if (VISTAS['planta-baixa']) a['planta-baixa'] = { c: encaixar('planta-baixa', 4, 7.5, 0), lado: 0 };
    return a;
  }
  const INICIAL = arrumacaoInicial();
  // A ARRUMAÇÃO DE CADA UM fica no navegador por enquanto (na página de teste); no app, ela vai para o servidor.
  let ARR = JSON.parse(JSON.stringify(INICIAL));
  try {
    const guardada = JSON.parse(localStorage.getItem(PREFIXO + 'arrumacao-2') ?? 'null');
    // Móvel novo (as plantas, 15/10/2026) entra no lugar de fábrica, sem desfazer o resto do que a pessoa arrumou.
    if (guardada) for (const id of Object.keys(INICIAL)) if (guardada[id]?.c) ARR[id] = guardada[id];
  } catch { /* sem guardar: começa da inicial */ }
  window.arrumacaoDoTeste = () => ARR; // para o teste
  const guardar = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'arrumacao-2', JSON.stringify(ARR)); } catch { /* fica só nesta visita */ } enviar(); };
  const ehDeitado = (id) => id === 'tapete';
  // No lugar da pintura? (mesmo centro e mesma posição; a cama de casal nunca, ela não foi pintada aqui)
  const noLugar = (id, c = ARR[id].c, lado = ARR[id].lado) =>
    id !== 'pufe' && id !== 'poltrona' && !(id === 'guarda-roupa' && VISTAS_ABERTO) && !(id === 'abajur' && VISTAS.abajur) && pintado(id) && !(id === 'cama' && VISTAS.cama) && !(id === 'mesa')
    && Math.abs(c[0] - INICIAL[id].c[0]) < 0.01 && Math.abs(c[1] - INICIAL[id].c[1]) < 0.01 && lado === INICIAL[id].lado;
  // O pé na grade (a área que ocupa) e o pé MEDIDO (o do desenho, para a forma e a profundidade).
  const peDe = (id, c = ARR[id].c, lado = ARR[id].lado) => {
    if (noLugar(id, c, lado)) return pintado(id).pe;
    const [tu, tv] = tamDe(id, lado); return [c[0] - tu / 2, c[0] + tu / 2, c[1] - tv / 2, c[1] + tv / 2];
  };
  const peMedidoDe = (id, c = ARR[id].c, lado = ARR[id].lado) => {
    if (noLugar(id, c, lado) || !VISTAS[id]) return peDe(id, c, lado);
    const [du, dv] = VISTAS[id][lado].mede; return [c[0] - du / 2, c[0] + du / 2, c[1] - dv / 2, c[1] + dv / 2];
  };
  const sobrepoe = (a, b) => a[0] < b[1] - 0.01 && a[1] > b[0] + 0.01 && a[2] < b[3] - 0.01 && a[3] > b[2] + 0.01;
  let pegado = null, selecionado = 'poltrona', modo = 'dia', grade = false, arrastando = false, alvo = null;
  // Cabe aqui? Dentro do quarto e sem passar por cima de outro móvel (o tapete fica embaixo de tudo).
  const ocupa = (c, quem = pegado, lado = ARR[quem].lado) => {
    const pe = peDe(quem, c, lado);
    if (pe[0] < -0.01 || pe[2] < -0.01 || pe[1] > N + 0.01 || pe[3] > N + 0.01) return true;
    if (ehDeitado(quem)) return false;
    return Object.keys(ARR).some((id) => id !== quem && !ehDeitado(id) && sobrepoe(peDe(id), pe));
  };
  // ============================== A CADEIRA COM FÍSICA (pedido dele, 14/10/2026) ==============================
  // "Ter física de fato, não o sprite sendo renderizado." Ela é uma roda no chão: posição e velocidade em casas, o
  // atrito das rodinhas, e as batidas nas paredes e nos móveis (um círculo contra o pé de cada um), com quique e um giro
  // quando bate de raspão. O coelho andando também a empurra. O ângulo é contínuo; a vista é a mais perto das 8.
  // Ela é desenhada como o coelho (a cada quadro, só a região dela), nunca na fotografia da cena: remontar a cena a
  // cada quadro custaria um núcleo inteiro num computador modesto.
  const OITO = ['south-west', 'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west'];
  const VISTAS_CADEIRA = im['cadeira-south-west'] ? OITO.map((d) => pecaDeImagem(im['cadeira-' + d], 'cadeira')) : null;
  const R_CADEIRA = 0.38;
  // A altura do assento acima do chão (medida na vista) e quanto o coelho sobe para sentar nela.
  const ASSENTO_CADEIRA = 34, SOBE_CADEIRA = 20, AVANCO_NA_CADEIRA = 0.4;
  const cadeira = { u: 6, v: 6, vu: 0, vv: 0, th: 0, w: 0, presa: false, kin: null, alvo: null };
  window.cadeiraDoTeste = cadeira; // para as fotos e o teste
  // O lugar dela na mesa: S é sentado à mesa (encostado); P0, puxada para trás, de onde se senta. Virada para a mesa.
  function lugarNaMesa() {
    if (!ARR.mesa) return null;
    const olha = ORIENTA[ARR.mesa.lado], [fu, fv] = VET[olha], pe = peDe('mesa'), [cu, cv] = centro(pe);
    const borda = [cu + fu * (pe[1] - pe[0]) / 2, cv + fv * (pe[3] - pe[2]) / 2];
    return { S: [borda[0] + fu * 0.42, borda[1] + fv * 0.42], P0: [borda[0] + fu * 1.15, borda[1] + fv * 1.15], th: Math.atan2(-fv, -fu) };
  }
  // Onde ela começa: onde ficou da última vez, ou puxada na mesa (chamado no fim, quando tudo já existe).
  function iniciarCadeira() {
    let g0 = null;
    try { g0 = JSON.parse(localStorage.getItem(PREFIXO + 'cadeira') ?? 'null'); } catch { /* começa na mesa */ }
    if (g0 && Number.isFinite(g0.u)) Object.assign(cadeira, { u: g0.u, v: g0.v, th: g0.th });
    else { const L = lugarNaMesa(); if (L) Object.assign(cadeira, { u: L.P0[0], v: L.P0[1], th: L.th }); }
  }
  const guardarCadeira = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'cadeira', JSON.stringify({ u: cadeira.u, v: cadeira.v, th: cadeira.th })); } catch { /* fica só nesta visita */ } enviar(); };
  const indiceDaVista = () => (((Math.round(cadeira.th / (Math.PI / 4)) % 8) + 8) % 8);
  // De costas para a tela (o encosto na frente de quem senta): as vistas do norte.
  const cadeiraDeCostas = () => [4, 5, 6].includes(indiceDaVista());
  const ehDeitadoOuNada = (id) => ehDeitado(id);
  function empurrar(nu, nv, pen, quique) {
    cadeira.u += nu * pen; cadeira.v += nv * pen;
    const vn = cadeira.vu * nu + cadeira.vv * nv;
    if (vn < 0) {
      cadeira.vu -= (1 + quique) * vn * nu; cadeira.vv -= (1 + quique) * vn * nv;
      // De raspão, ela gira: a velocidade ao longo da batida vira giro.
      const vt = -cadeira.vu * nv + cadeira.vv * nu;
      cadeira.w = Math.max(-6, Math.min(6, cadeira.w + vt * 0.7)); // e nunca vira pião
    }
  }
  function colidir() {
    const r = R_CADEIRA, Q = 0.45;
    // As paredes: a da janela (u = 0) com a fileira das cortinas, a da esquerda (v = 0), e as bordas da frente.
    const cu = JAN.tipo === 'original' && JAN.parede === 'direita' ? 0.85 : 0, cv = JAN.tipo === 'original' && JAN.parede === 'esquerda' ? 0.85 : 0;
    if (cadeira.u < cu + r) empurrar(1, 0, cu + r - cadeira.u, Q);
    if (cadeira.v < cv + r) empurrar(0, 1, cv + r - cadeira.v, Q);
    if (cadeira.u > N - r) empurrar(-1, 0, cadeira.u - (N - r), Q);
    if (cadeira.v > N - r) empurrar(0, -1, cadeira.v - (N - r), Q);
    // Os móveis: o ponto do pé mais perto do centro dela.
    for (const id of Object.keys(ARR)) {
      if (ehDeitadoOuNada(id)) continue;
      const [u0, u1, v0, v1] = peDe(id);
      const qu = Math.min(u1, Math.max(u0, cadeira.u)), qv = Math.min(v1, Math.max(v0, cadeira.v));
      let du = cadeira.u - qu, dv = cadeira.v - qv, d = Math.hypot(du, dv);
      if (d >= r) continue;
      if (d < 1e-6) { // o centro dentro do móvel: sai pelo lado mais perto
        const saidas = [[cadeira.u - u0, -1, 0], [u1 - cadeira.u, 1, 0], [cadeira.v - v0, 0, -1], [v1 - cadeira.v, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        empurrar(saidas[1], saidas[2], saidas[0] + r, Q);
      } else empurrar(du / d, dv / d, r - d, Q);
    }
  }
  const comeco = { u: 0, v: 0 };
  function passoDaCadeira(dt) {
    if (!VISTAS_CADEIRA) return;
    const c = cadeira;
    if (c.kin) {
      const k = c.kin, f = Math.min(1, (performance.now() - k.t0) / k.dur), e = f * f * (3 - 2 * f);
      c.u = k.de[0] + (k.para[0] - k.de[0]) * e; c.v = k.de[1] + (k.para[1] - k.de[1]) * e;
      let dth = ((k.th - k.th0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      c.th = k.th0 + dth * e; c.vu = c.vv = c.w = 0;
      if (f >= 1) { c.kin = null; guardarCadeira(); k.depois?.(); }
      return;
    }
    if (c.presa && c.alvo) {
      // Arrastando: ela vai até o ponteiro com velocidade (e bate no que estiver no caminho, como empurrada).
      c.vu = Math.max(-12, Math.min(12, (c.alvo[0] - c.u) / Math.max(dt, 0.016)));
      c.vv = Math.max(-12, Math.min(12, (c.alvo[1] - c.v) / Math.max(dt, 0.016)));
    } else {
      const atrito = Math.exp(-2.4 * dt);
      // O giro perde força devagar (o pistão gira solto): rolagem forte dá mais de uma volta, fraca, um tiquinho.
      c.vu *= atrito; c.vv *= atrito; c.w *= Math.exp(-1.6 * dt);
      if (Math.hypot(c.vu, c.vv) < 0.03) c.vu = c.vv = 0;
      if (Math.abs(c.w) < 0.15) c.w = 0;
    }
    const n = Math.max(1, Math.ceil((Math.hypot(c.vu, c.vv) * dt) / 0.08));
    for (let i = 0; i < n; i++) { c.u += (c.vu * dt) / n; c.v += (c.vv * dt) / n; colidir(); }
    c.th += c.w * dt;
  }
  const cadeiraMexendo = () => !!VISTAS_CADEIRA && (cadeira.presa || !!cadeira.kin || Math.hypot(cadeira.vu, cadeira.vv) > 0 || Math.abs(cadeira.w) > 0);
  let rolando = false, tAnterior = 0;
  function rolar(t) {
    const dt = Math.min(0.05, (t - tAnterior) / 1000); tAnterior = t;
    passoDaCadeira(dt);
    passoDoVivo(dt);
    desenhar();
    particulas = particulas.filter((q) => performance.now() - q.t0 < q.vida);
    if (cadeiraMexendo() || (viva && viva.modo !== 'arrasto') || particulas.length) requestAnimationFrame(rolar);
    else { rolando = false; guardarCadeira(); }
  }
  function acordarCadeira() { if (!rolando) { rolando = true; tAnterior = performance.now(); requestAnimationFrame(rolar); } }
  // Ela rola sozinha até um lugar (puxada para a mesa, ou com o coelho sentado), e então chama "depois".
  function levarCadeira(para, th, dur, depois) {
    cadeira.kin = { de: [cadeira.u, cadeira.v], para, th0: cadeira.th, th, t0: performance.now(), dur, depois };
    acordarCadeira();
  }
  // O coelho andando esbarra nela: empurra, com a velocidade dele.
  let coelhoAntes = null;
  function esbarrao(dt) {
    if (!VISTAS_CADEIRA) return;
    const antes = coelhoAntes; coelhoAntes = [coelho.u, coelho.v];
    if (!antes || coelho.destino === 'cadeira' && !coelho.caminho.length || cadeira.kin || cadeira.presa) return;
    const du = cadeira.u - coelho.u, dv = cadeira.v - coelho.v, d = Math.hypot(du, dv), r = R_CADEIRA + 0.22;
    if (d >= r || d < 1e-6) return;
    const vu = (coelho.u - antes[0]) / Math.max(dt, 0.016), vv = (coelho.v - antes[1]) / Math.max(dt, 0.016);
    cadeira.u += (du / d) * (r - d); cadeira.v += (dv / d) * (r - d);
    const vn = vu * (du / d) + vv * (dv / d);
    if (vn > 0) { cadeira.vu += (du / d) * vn * 1.5; cadeira.vv += (dv / d) * vn * 1.5; cadeira.w += (Math.random() - 0.5) * 2; }
    colidir();
    acordarCadeira();
  }
  // ============================== JOGAR OS MÓVEIS (ideia dele, 14/10/2026) ==============================
  // "Uma mecânica dinâmica para todos os objetos, que se aplica mais intensidade a cada objeto específico." O móvel
  // arrastado segue o ponteiro de verdade; soltando em movimento, ele desliza. O PESO decide quanto da velocidade do
  // ponteiro ele leva e quanto atrito ele tem: o pufe desliza mais de uma casa, a poltrona meia, a cama e o guarda-roupa
  // quase nada. Bate nos outros móveis e nas paredes (quica pouco) e, parando, se encaixa na casa livre mais perto.
  const PESO = { pufe: 1.5, poltrona: 3, abajur: 3, tapete: 4, mesa: 6, cama: 14, 'guarda-roupa': 18, 'planta-alta': 2.5, 'planta-baixa': 1.5, sofa: 12, tv: 8, fliperama: 16, balcao: 14, estante: 15, mesinha: 4, banqueta: 1.5, 'banqueta-2': 1.5, 'sofa-2': 12, 'poltrona-2': 3, 'mesa-jogo': 6, 'cadeira-2': 2, 'cadeira-3': 2, 'cadeira-4': 2, jukebox: 14, microfone: 3, pufao: 2 };
  let viva = null; // { id, orig, modo: 'arrasto' | 'deslize' | 'encaixe', vu, vv, de, para, t0 }
  // O "TCHAN" AO COLOCAR (ideia dele, 14/10/2026, como no Hozy): o móvel que assenta solta faíscas de pixel pela borda
  // do pé dele no chão, que sobem um pouco e somem. Enquanto está pego, ele tem um contorno branco.
  let particulas = [];
  function soltarFaiscas(pe) {
    if (!liga('particulas')) return;
    const [u0, u1, v0, v1] = pe, agora0 = performance.now(), borda = [];
    for (let i = 0; i < 34; i++) {
      const t = i / 34, lado = Math.floor(t * 4), f = (t * 4) % 1;
      borda.push(lado === 0 ? [u0 + (u1 - u0) * f, v0] : lado === 1 ? [u1, v0 + (v1 - v0) * f] : lado === 2 ? [u1 - (u1 - u0) * f, v1] : [u0, v1 - (v1 - v0) * f]);
    }
    const [cx, cy] = ponto((u0 + u1) / 2, (v0 + v1) / 2);
    for (const [u, v] of borda) {
      const [x, y] = ponto(u, v), dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy) || 1;
      particulas.push({ x, y, vx: (dx / n) * (10 + Math.random() * 14), vy: (dy / n) * 6 - 18 - Math.random() * 22, t0: agora0 + Math.random() * 160, vida: 900 + Math.random() * 500, grande: Math.random() < 0.5 });
    }
    acordarCadeira();
  }
  function caixaDoVivo(c) { const [tu, tv] = tamDe(viva.id, ARR[viva.id].lado); return [c[0] - tu / 2, c[0] + tu / 2, c[1] - tv / 2, c[1] + tv / 2]; }
  function baterVivo() {
    const id = viva.id, c = ARR[id].c, [tu, tv] = tamDe(id, ARR[id].lado), Q = 0.3;
    // as paredes
    if (c[0] - tu / 2 < 0) { c[0] = tu / 2; viva.vu = Math.abs(viva.vu) * Q; }
    if (c[1] - tv / 2 < 0) { c[1] = tv / 2; viva.vv = Math.abs(viva.vv) * Q; }
    if (c[0] + tu / 2 > N) { c[0] = N - tu / 2; viva.vu = -Math.abs(viva.vu) * Q; }
    if (c[1] + tv / 2 > N) { c[1] = N - tv / 2; viva.vv = -Math.abs(viva.vv) * Q; }
    if (ehDeitado(id)) return;
    // os outros móveis: sai pelo lado em que entrou menos, e a velocidade daquele eixo volta pequena
    for (const o of Object.keys(ARR)) {
      if (o === id || ehDeitado(o)) continue;
      const a = caixaDoVivo(c), b = peDe(o);
      if (!sobrepoe(a, b)) continue;
      const saidas = [[b[1] - a[0], 1, 0], [a[1] - b[0], -1, 0], [b[3] - a[2], 0, 1], [a[3] - b[2], 0, -1]].sort((x, y) => x[0] - y[0])[0];
      c[0] += saidas[1] * (saidas[0] + 0.001); c[1] += saidas[2] * (saidas[0] + 0.001);
      if (saidas[1]) viva.vu = saidas[1] * Math.abs(viva.vu) * Q; else viva.vv = saidas[2] * Math.abs(viva.vv) * Q;
    }
  }
  // Parou: a casa livre mais perto (dentro de duas casas), ou volta de onde veio.
  function encaixarVivo() {
    const id = viva.id, l = ARR[id].lado, [u, v] = ARR[id].c, base = encaixar(id, u, v, l);
    const opcoes = [];
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) opcoes.push([base[0] + di, base[1] + dj]);
    opcoes.sort((a, b) => Math.hypot(a[0] - u, a[1] - v) - Math.hypot(b[0] - u, b[1] - v));
    const para = opcoes.find((c) => !ocupa(c, id, l)) ?? viva.orig;
    viva.modo = 'encaixe'; viva.de = [u, v]; viva.para = para; viva.t0 = performance.now();
    acordarCadeira();
  }
  function passoDoVivo(dt) {
    if (!viva || viva.modo === 'arrasto') return;
    const c = ARR[viva.id].c;
    if (viva.modo === 'deslize') {
      const peso = PESO[viva.id] ?? 5, freio = (5 + peso * 1.5) * dt, vel = Math.hypot(viva.vu, viva.vv);
      if (vel <= freio || vel < 0.3) return encaixarVivo();
      viva.vu *= (vel - freio) / vel; viva.vv *= (vel - freio) / vel;
      const n = Math.max(1, Math.ceil((vel * dt) / 0.1));
      for (let i = 0; i < n; i++) { c[0] += (viva.vu * dt) / n; c[1] += (viva.vv * dt) / n; baterVivo(); }
      colidir(); // a cadeira sai da frente
      return;
    }
    const f = Math.min(1, (performance.now() - viva.t0) / 160), e = f * f * (3 - 2 * f);
    c[0] = viva.de[0] + (viva.para[0] - viva.de[0]) * e; c[1] = viva.de[1] + (viva.para[1] - viva.de[1]) * e;
    if (f >= 1) { const id = viva.id; ARR[id].c = [...viva.para]; viva = null; alvo = null; pegado = null; guardar(); colidir(); decidir(); soltarFaiscas(peDe(id)); }
  }
  // AS CORES DO TAPETE (15/10/2026, "variações de tapete, cor por código"): a matiz de cada pixel gira até a da cor
  // escolhida e a saturação muda, mas a CLARIDADE fica — o desenho (as tramas, as sombras) é o mesmo, só o tom muda. O
  // tapete pintado é sálvia (matiz 0,16, saturação 0,27).
  const CORES_DO_TAPETE = { salvia: { nome: 'sálvia', h: 0.158, s: 1 }, terracota: { nome: 'terracota', h: 0.03, s: 2.1 }, azul: { nome: 'azul', h: 0.58, s: 1.15 }, mostarda: { nome: 'mostarda', h: 0.105, s: 2.4 }, rosa: { nome: 'rosa', h: 0.95, s: 1.05 }, cinza: { nome: 'cinza', h: 0.158, s: 0.2 } };
  let CORES = {};
  try { CORES = JSON.parse(localStorage.getItem(PREFIXO + 'cores') ?? '{}') || {}; } catch { /* as de fábrica */ }
  const guardarCores = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'cores', JSON.stringify(CORES)); } catch { /* fica só nesta visita */ } enviar(); };
  function tingirPixel(r, g, b, alvo) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, d = mx - mn;
    let h = 0, sat = mx ? d / mx : 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
    // Só o que tem a cor do tapete: a borda traz pixels da madeira do chão, que virariam pontinhos coloridos.
    if (sat > 0.06 && Math.abs(h - 0.158) > 0.07) return [r, g, b];
    h = (((h - 0.158 + alvo.h) % 1) + 1) % 1; sat = Math.min(1, sat * alvo.s);
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - sat), q = v * (1 - f * sat), t = v * (1 - (1 - f) * sat);
    const [R, G, B] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return [R * 255, G * 255, B * 255];
  }
  const tingidos = new Map();
  function tingir(p) {
    const cor = CORES.tapete && CORES.tapete !== 'salvia' ? CORES_DO_TAPETE[CORES.tapete] : null;
    if (!cor) return p;
    let porCor = tingidos.get(p);
    if (!porCor) { porCor = {}; tingidos.set(p, porCor); }
    if (porCor[CORES.tapete]) return porCor[CORES.tapete];
    const movel = new Uint8ClampedArray(p.movel);
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) { const [r, g, b] = tingirPixel(movel[k * 4], movel[k * 4 + 1], movel[k * 4 + 2], cor); movel[k * 4] = r; movel[k * 4 + 1] = g; movel[k * 4 + 2] = b; }
    return (porCor[CORES.tapete] = { ...p, movel });
  }
  // O TAPETE MEXIDO: o desenho é levado pelo chão, ponto a ponto (ele é plano, então girar é só girar a textura).
  const cacheDoTapete = new Map();
  function tapeteEm(c, lado) {
    const chave = c.join(',') + '|' + lado;
    if (cacheDoTapete.has(chave)) return cacheDoTapete.get(chave);
    const orig = pecas.tapete, [oc0, oc1] = INICIAL.tapete.c;
    const movel = new Uint8ClampedArray(W * W * 4), peColuna = new Int16Array(W).fill(-1);
    let y0 = W;
    for (let k = 0; k < W * W; k++) {
      if (casa[k] < 0) continue;
      let a = mapaU[k] - c[0], b = mapaV[k] - c[1];
      for (let r = 0; r < lado; r++) [a, b] = [-b, a];
      const [sx, sy] = ponto(oc0 + a, oc1 + b), X = Math.floor(sx), Y = Math.floor(sy);
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const s = (Y * W + X) * 4;
      if (!orig.movel[s + 3]) continue;
      for (let q = 0; q < 4; q++) movel[k * 4 + q] = orig.movel[s + q];
      peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0); y0 = Math.min(y0, (k / W) | 0);
    }
    const p = { id: 'tapete', movel, sombra: VAZIA, topo: y0, peColuna, centroTopo: 0 };
    if (cacheDoTapete.size > 8) cacheDoTapete.clear();
    cacheDoTapete.set(chave, p);
    return p;
  }
  const luz = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return (diaBorrado[i] + diaBorrado[i + 1] + diaBorrado[i + 2]) / 3; };

  // A grade em pixel: a casa de cada pixel do chão; a borda é onde a casa muda.
  const casa = new Int16Array(W * W).fill(-1);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = uvRapido(x + 0.5, y + 0.5);
    if (u >= 0 && v >= 0 && u < N && v < N) casa[y * W + x] = Math.floor(u) * N + Math.floor(v);
  }

  const VISTO = new Uint8Array(W * W); // os pixels que o móvel pego desenhou neste quadro (para o contorno)
  const dono = new Array(W * W).fill(''), donoObj = new Array(W * W).fill(''), baseDonoObj = new Array(W * W).fill('');
  window.ondeEsta = (id) => { let sx = 0, sy = 0, n = 0; for (let k = 0; k < W * W; k++) if (dono[k] === id) { sx += k % W; sy += (k / W) | 0; n++; } return n ? [sx / n, sy / n] : null; }; // para o teste

  // ============================== O COELHO (ver e2e/pixel-art/personagem/README.md) ==============================
  // Provisório: o coelho do recado (faixa de 18 quadros, de frente). O pé é a âncora: o meio da última linha do quadro
  // fica no ponto do chão. Direção nas 4 diagonais da tela; aqui, sem o desenho de cada uma, espelha-se para "oeste"
  // e escurece-se para "de costas", só para VER a direção. A arte de verdade não espelha (a lição da poltrona).
  const QUADROS = 18, fw = im.coelho.width / QUADROS, fh = im.coelho.height;
  const folha = dados(im.coelho, null, im.coelho.width, fh);
  // AS ANIMAÇÕES: cada quadro decodificado uma vez. A ÂNCORA é do PRIMEIRO quadro de cada animação e direção (o meio da
  // última linha com desenho): de pé, é o pé; sentado, é o assento. Fixa na animação inteira, para o coelho não tremer.
  const ANIM = {};
  for (const [nome, porDir] of Object.entries(ANIMACOES)) {
    ANIM[nome] = {};
    for (const [d, srcs] of Object.entries(porDir)) {
      const quadros = [];
      for (const src of srcs) {
        const img = await carregar(src), w = img.width, h = img.height;
        const px = dados(img, null, w, h);
        let cx = 0, cy = 0, nq = 0;
        for (let k = 0; k < w * h; k++) if (px[k * 4 + 3] > 127) { cx += k % w; cy += (k / w) | 0; nq++; }
        quadros.push({ px, w, h, cx: cx / Math.max(1, nq), cy: cy / Math.max(1, nq) });
      }
      const q0 = quadros[0];
      let fundo = 0, sx = 0, n = 0;
      for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / q0.w) | 0);
      for (let x = 0; x < q0.w; x++) for (let y = fundo - 3; y <= fundo; y++) if (q0.px[(y * q0.w + x) * 4 + 3] > 127) { sx += x; n++; }
      let topo = q0.h; for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) { topo = (k / q0.w) | 0; break; }
      ANIM[nome][d] = { quadros, peX: sx / Math.max(1, n), peY: fundo, topo };
      // DEITADO, a âncora é o meio do corpo (ele fica estendido sobre a cama, não de pé num ponto).
      if (nome.startsWith('dormindo') || nome === 'lendo') {
        let x0 = q0.w, x1 = 0, y0 = q0.h, y1 = 0;
        for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) { const x = k % q0.w, y = (k / q0.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        ANIM[nome][d] = { quadros, peX: (x0 + x1) / 2, peY: (y0 + y1) / 2, topo: y0 };
      }
    }
  }
  // A direção que falta numa animação: a do mesmo lado (de frente ↔ de frente), e por fim a pose parada.
  const PAR = { sudeste: 'sudoeste', sudoeste: 'sudeste', nordeste: 'noroeste', noroeste: 'nordeste' };
  function quadrosDe(nome, d) {
    const a = ANIM[nome] ?? {};
    return a[d] ?? a[PAR[d]] ?? (d.startsWith('n') ? a.sudoeste ?? a.sudeste : a.noroeste ?? a.nordeste) ?? ANIM.parado[d] ?? ANIM.parado.sudeste;
  }
  // O mascote: um quadro por direção. O pé é o meio da última linha com desenho (a âncora do README).
  const mascote = {};
  for (const d of ['sudeste', 'sudoeste', 'nordeste', 'noroeste']) {
    const img = im['mascote-' + d], w = img.width, h = img.height, px = dados(img, null, w, h);
    let fundo = 0, sx = 0, n = 0;
    for (let k = 0; k < w * h; k++) if (px[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / w) | 0);
    for (let x = 0; x < w; x++) for (let y = fundo - 3; y <= fundo; y++) if (px[(y * w + x) * 4 + 3] > 127) { sx += x; n++; }
    mascote[d] = { px, w, h, peX: sx / Math.max(1, n), peY: fundo };
  }
  const coelho = { u: 6.5, v: 6.5, dir: 'sudeste', pose: 'parado', caminho: [], destino: null, quadro: 0 };
  let estado = 'atoa', falando = false, semAndar = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A casa ocupada: o pé dos móveis fixos (menos o tapete), e o pufe e a poltrona (2 × 2 em volta do cruzamento).
  const livre = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    // A fileira junto da parede da janela (u = 0) é onde descem as cortinas e o peitoril, pintados na parede: ali o
    // coelho parecia atravessar a cortina (relato de 14/10/2026).
    // (só com a janela original, a de cortinas até o chão, e na parede onde ela estiver)
    if (JAN.tipo === 'original' && (JAN.parede === 'direita' ? i === 0 : j === 0)) return false;
    const cu = i + 0.5, cv = j + 0.5;
    return !Object.keys(ARR).some((id) => { if (ehDeitado(id)) return false; const pe = peDe(id); return cu > pe[0] && cu < pe[1] && cv > pe[2] && cv < pe[3]; });
  };
  const todasAsCasas = () => [...Array(N * N).keys()].map((k) => [Math.floor(k / N), k % N]);
  // OS PONTOS SÃO DO MÓVEL: calculados de onde ele está AGORA (arrastou, o ponto foi junto; girou, o olhar mudou).
  // "ao": as casas do chão de onde se chega; "onde": onde o pé fica (null = fica na casa de chegada); "sobe": quantos px
  // acima do chão (o assento); "frente": a posição na ordem de desenho (logo depois do móvel, por cima dele).
  // No pufe ele senta PERTO DA BORDA do lado para onde olha (no meio, a distância até a beirada virava um salto).
  function assentoNoPufe() {
    // A borda é a do lado por onde ele SUBIU: virar no pufe muda para onde ele olha, não onde está sentado (relato de
    // 14/10/2026: virando para trás, ele pulava para a outra borda).
    const o = coelho.ladoDoPufe ?? coelho.olharNoPufe ?? 'sudeste', vet = { sudoeste: [1, 0], sudeste: [0, 1], nordeste: [-1, 0], noroeste: [0, -1] }[o];
    return [ARR.pufe.c[0] + vet[0] * 0.3, ARR.pufe.c[1] + vet[1] * 0.3];
  }
  // NA CADEIRA DO COMPUTADOR: ele senta com ela puxada para trás (P0) e então ela rola até a mesa com ele. O lugar de
  // chegada (as casas de onde se chega) é o da beirada em P0; sentado, ele vai onde a cadeira for.
  const OLHA_DO_VETOR = { '1,0': 'sudoeste', '0,1': 'sudeste', '-1,0': 'nordeste', '0,-1': 'noroeste' };
  function pontoDaCadeira() {
    const L = lugarNaMesa(), olha = OLHA_DO_VETOR[Math.round(Math.cos(L.th)) + ',' + Math.round(Math.sin(L.th))] ?? 'sudoeste';
    const [fu, fv] = VET[olha], beira = [L.P0[0] + fu * 0.7, L.P0[1] + fv * 0.7];
    const perto = todasAsCasas().filter(([i, j]) => livre(i, j)).sort((a, b) => Math.hypot(a[0] + 0.5 - beira[0], a[1] + 0.5 - beira[1]) - Math.hypot(b[0] + 0.5 - beira[0], b[1] + 0.5 - beira[1]));
    // A pose ao computador é ancorada pelo fim do desenho, e sentado com as pernas para a frente esse ponto não é o meio
    // do assento: ele ficava para trás e fora da cadeira (relato de 14/10/2026). O lugar dele é um pouco à frente do
    // meio dela, para onde ela olha.
    const [ou, ov] = VET[olha];
    return { ao: perto.slice(0, 1), onde: [cadeira.u + ou * AVANCO_NA_CADEIRA, cadeira.v + ov * AVANCO_NA_CADEIRA], sobe: SOBE_CADEIRA, pose: 'sentado', olha, sobre: 'cadeira', atras: olha.startsWith('n') };
  }
  function pontos() {
    const vizinhas = (u0, u1, v0, v1) => {
      const r = [];
      for (let i = Math.floor(u0) - 1; i <= Math.ceil(u1); i++) for (let j = Math.floor(v0) - 1; j <= Math.ceil(v1); j++) {
        const dentro = i + 0.5 > u0 && i + 0.5 < u1 && j + 0.5 > v0 && j + 0.5 < v1;
        if (!dentro && livre(i, j)) r.push([i, j]);
      }
      return r;
    };
    const em2x2 = (c) => vizinhas(c[0] - 1, c[0] + 1, c[1] - 1, c[1] + 1);
    // A CAMA, em qualquer posição: a cabeceira fica do lado oposto ao olhar; ele deita no meio do colchão, a cabeça
    // para a cabeceira, e se prepara no lado comprido que dá para a frente da tela (u ou v maior).
    if (CENA === 'salao') return pontosDoSalao(vizinhas);
    const olhaC = ORIENTA[ARR.cama.lado], [fu, fv] = VET[olhaC], peC = peMedidoDe('cama'), eixoU = fu !== 0;
    const cab = eixoU ? (fu > 0 ? peC[0] : peC[1]) : (fv > 0 ? peC[2] : peC[3]);
    const ondeC = eixoU ? [cab + fu * 1.25, (peC[2] + peC[3]) / 2 - 0.1] : [(peC[0] + peC[1]) / 2 - 0.1, cab + fv * 1.25];
    const beiraC = eixoU ? [ondeC[0], peC[3] + 0.12] : [peC[1] + 0.12, ondeC[1]];
    // O GUARDA-ROUPA: ele para na casa da frente dele, olhando para ele.
    const OPOSTO = { sudoeste: 'nordeste', nordeste: 'sudoeste', sudeste: 'noroeste', noroeste: 'sudeste' };
    const olhaG = ORIENTA[ARR['guarda-roupa'].lado], [gu, gv] = VET[olhaG], peG = peDe('guarda-roupa'), [gcu, gcv] = centro(peG);
    const frenteG = [Math.floor(gcu + gu * ((peG[1] - peG[0]) / 2 + 0.5)), Math.floor(gcv + gv * ((peG[3] - peG[2]) / 2 + 0.5))];
    const olhaP = ORIENTA[ARR.poltrona.lado];
    return {
      // O pufe é redondo: ele senta virado para qualquer um dos 4 lados (sorteado ao chegar) e vira de vez em quando.
      pufe: { ao: em2x2(ARR.pufe.c), onde: assentoNoPufe(), sobe: 26, pose: 'sentado', olha: coelho.olharNoPufe ?? 'sudeste', sobre: 'pufe' },
      // Virada de costas, o encosto fica NA FRENTE do coelho: ele é desenhado antes dela.
      poltrona: { ao: vizinhas(...peDe('poltrona')), onde: [...ARR.poltrona.c], sobe: 8, pose: 'sentado', olha: olhaP, sobre: 'poltrona', atras: olhaP.startsWith('n') },
      // Na cama ele DEITA (lendo ou dormindo), no meio do colchão, a cabeça para a cabeceira (pedido dele, 14/10/2026).
      cama: { ao: vizinhas(...peDe('cama')), onde: ondeC, beira: beiraC, sobe: 40, pose: 'na cama', olha: olhaC, sobre: 'cama' },
      'guarda-roupa': { ao: [frenteG].filter(([i, j]) => livre(i, j)), onde: null, sobe: 0, pose: 'parado', olha: OPOSTO[olhaG] },
      ...(VISTAS_CADEIRA && ARR.mesa ? { cadeira: pontoDaCadeira(), mesa: pontoDaCadeira() } : {}),
    };
  }
  // O RECADO (no salão): o que quem administra escreveu, num balão em cima do coelho do balcão. Como o recado do salão de
  // frente (RecadoDoBalcao): aparece ao chegar, fica o tempo de ler (mais para recado comprido) e some — senão cobria os
  // nomes de quem senta nas banquetas. Clicar no balcão mostra de novo.
  // O tempo de leitura conta de quando o balão APARECE (o coelho pode estar chegando ao balcão).
  let RECADO = null, recadoAberto = true, recadoEm = '', fimDoRecado = 0, contarLeitura = false;
  const abrirRecado = () => { recadoAberto = true; contarLeitura = true; clearTimeout(fimDoRecado); fimDoRecado = 0; posicionarRecado(true); };
  function posicionarRecado(forcar) {
    const e = document.getElementById('recado');
    const mostra = CENA === 'salao' && !!RECADO && recadoAberto && !!ultimaCaixa && coelho.destino === 'balcao' && !coelho.caminho.length;
    const chave = mostra ? JSON.stringify([ultimaCaixa[0], ultimaCaixa[1], ultimaCaixa[2], RECADO]) : '';
    if (!forcar && chave === recadoEm) return;
    recadoEm = chave; e.hidden = !mostra;
    if (!mostra) return;
    if (contarLeitura) {
      contarLeitura = false;
      const leitura = Math.max(4, 3.5 + 0.05 * ((RECADO.titulo ?? '').length + (RECADO.texto ?? '').length));
      fimDoRecado = setTimeout(() => { recadoAberto = false; posicionarRecado(true); }, leitura * 1000);
    }
    const titulo = document.createElement('b'); titulo.textContent = RECADO.titulo || '';
    e.replaceChildren(...(RECADO.titulo ? [titulo] : []), RECADO.texto || '');
    e.style.left = (((ultimaCaixa[0] + ultimaCaixa[2]) / 2) / W) * 100 + '%'; e.style.top = ((ultimaCaixa[1] + 6) / W) * 100 + '%';
  }
  window.recadoDoTeste = () => ({ RECADO, recadoAberto, caixa: ultimaCaixa, destino: coelho.destino, caminho: coelho.caminho.length, visivel: !document.getElementById('recado').hidden }); // para o teste
  // OS PONTOS DO SALÃO: o coelho do recado mora atrás do balcão, de pé, olhando para quem chega.
  window.pontosDoTeste = () => ({ pontos: pontos(), coelho: { u: coelho.u, v: coelho.v, destino: coelho.destino, pose: coelho.pose }, balcao: ARR.balcao && { ...ARR.balcao, pe: peDe('balcao') } }); // para o teste
  function pontosDoSalao(vizinhas) {
    const r = {};
    if (ARR.balcao) {
      const OPOSTO = { sudoeste: 'nordeste', nordeste: 'sudoeste', sudeste: 'noroeste', noroeste: 'sudeste' };
      const olha = ORIENTA[ARR.balcao.lado], [fu, fv] = VET[olha], pe = peDe('balcao'), [cu, cv] = centro(pe);
      const atras = [Math.floor(cu - fu * ((pe[1] - pe[0]) / 2 + 0.5)), Math.floor(cv - fv * ((pe[3] - pe[2]) / 2 + 0.5))];
      r.balcao = { ao: [atras].filter(([i, j]) => livre(i, j)), onde: null, sobe: 0, pose: 'parado', olha, atras: true };
      void OPOSTO; void vizinhas;
    }
    return r;
  }
  // ============================== AS PESSOAS NA CALL (o salão, 15/10/2026) ==============================
  // O salão enche com quem está na call agora (como o Salao.tsx de frente): cada pessoa é um coelho no lugar dela, com o
  // nome em cima. Todos com o MASCOTE BASE por enquanto (decisão dele: os outros mascotes viram isométricos depois). Os
  // lugares saem dos móveis, onde eles estiverem: os assentos do sofá, as banquetas, e o chão em volta da mesinha. Quem
  // TRANSMITE fica de pé na frente da TV, e quem JOGA, no fliperama. Sem ninguém na call, o salão fica vazio (a tela não
  // finge movimento).
  let PESSOAS = []; // [{ id, nome, papel: 'call' | 'transmitindo' | 'jogando' }]
  const DIAGONAL = (du, dv) => (Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 'sudoeste' : 'nordeste') : dv > 0 ? 'sudeste' : 'noroeste');
  // Quantos px o assento da banqueta sobe do chão (a pose da banqueta tem o pé na ponta da perna pendurada).
  const SOBE_NA_BANQUETA = 19; // o assento está a ~34 px; a perna pendurada desce uns 15
  function lugaresDoSalao() {
    const sentar = [], tv = [], fliperama = [], chao = [];
    for (const id of ['sofa', 'sofa-2']) if (ARR[id]) {
      const pe = peDe(id), olha = ORIENTA[ARR[id].lado], [fu, fv] = VET[olha], [cu, cv] = centro(pe);
      // ao longo do lado comprido, um pouco para a frente do meio
      const longoU = fu === 0, n = 3;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const u = longoU ? pe[0] + f * (pe[1] - pe[0]) : cu + fu * 0.15, v = longoU ? cv + fv * 0.15 : pe[2] + f * (pe[3] - pe[2]);
        sentar.push({ u, v, sobe: 16, pose: 'sentado', olha, sobre: id });
      }
    }
    // as cadeiras da mesa de jogos, viradas para a mesa, e o pufão
    for (const id of ['cadeira', 'cadeira-2', 'cadeira-3', 'cadeira-4']) if (ARR[id]) {
      const [u, v] = ARR[id].c, alvo = ARR['mesa-jogo'] ? centro(peDe('mesa-jogo')) : [u + 1, v];
      sentar.push({ u, v, sobe: 18, pose: 'sentado', olha: DIAGONAL(alvo[0] - u, alvo[1] - v), sobre: id });
    }
    if (ARR.pufao) sentar.push({ u: ARR.pufao.c[0], v: ARR.pufao.c[1], sobe: 6, pose: 'sentado', olha: ORIENTA[ARR.pufao.lado], sobre: 'pufao' });
    // as poltronas: um lugar cada, afundado (a pose da poltrona do quarto)
    for (const id of ['poltrona', 'poltrona-2']) if (ARR[id]) sentar.push({ u: ARR[id].c[0], v: ARR[id].c[1], sobe: 8, pose: 'sentado-poltrona', olha: ORIENTA[ARR[id].lado], sobre: id });
    for (const id of ['banqueta', 'banqueta-2']) if (ARR[id]) {
      const [u, v] = ARR[id].c, alvo = ARR.balcao ? centro(peDe('balcao')) : [u, v - 1];
      sentar.push({ u, v, sobe: SOBE_NA_BANQUETA, pose: 'sentado-banqueta', olha: DIAGONAL(alvo[0] - u, alvo[1] - v), sobre: id });
    }
    const naFrente = (id, casas) => {
      if (!ARR[id]) return null;
      const olha = ORIENTA[ARR[id].lado], [fu, fv] = VET[olha], pe = peDe(id), [cu, cv] = centro(pe);
      const u = cu + fu * ((pe[1] - pe[0]) / 2 + casas), v = cv + fv * ((pe[3] - pe[2]) / 2 + casas);
      return { u, v, sobe: 0, pose: 'parado', olha: DIAGONAL(-fu, -fv), sobre: null };
    };
    const t = naFrente('tv', 1.6); if (t) tv.push(t);
    const fl = naFrente('fliperama', 0.7); if (fl) fliperama.push({ ...fl, pose: 'no-fliperama' });
    // o chão: casas livres perto da mesinha (ou do meio), olhando para a TV
    const meio = ARR.mesinha ? centro(peDe('mesinha')) : [N / 2, N / 2], alvoTv = ARR.tv ? centro(peDe('tv')) : [0, N / 2];
    const livres = todasAsCasas().filter(([i, j]) => livre(i, j)).sort((a, b) => Math.hypot(a[0] + 0.5 - meio[0], a[1] + 0.5 - meio[1]) - Math.hypot(b[0] + 0.5 - meio[0], b[1] + 0.5 - meio[1]));
    for (const [i, j] of livres.slice(0, 8)) chao.push({ u: i + 0.5, v: j + 0.5, sobe: 0, pose: 'parado', olha: DIAGONAL(alvoTv[0] - i - 0.5, alvoTv[1] - j - 0.5), sobre: null });
    return { sentar, tv, fliperama, chao };
  }
  function lugaresDasPessoas() {
    const L = lugaresDoSalao(), usados = [];
    const pegar = (lista) => { const x = lista.shift(); if (x) usados.push(x); return x; };
    return PESSOAS.map((pessoa) => ({ pessoa, lugar: (pessoa.papel === 'transmitindo' && pegar(L.tv)) || (pessoa.papel === 'jogando' && pegar(L.fliperama)) || pegar(L.sentar) || pegar(L.chao) || null })).filter((x) => x.lugar);
  }
  // Cada pessoa vira uma PEÇA da cena, como um móvel: o mascote parado naquela pose, com a profundidade do pé dele (e, sentado,
  // desenhado depois do móvel em que senta).
  const pecasDasPessoas = new Map();
  function itensDasPessoas() {
    const itens = [];
    for (const [i, { pessoa, lugar }] of lugaresDasPessoas().entries()) {
      const a = quadrosDe(lugar.pose, lugar.olha), q = a.quadros[0], [px, py] = ponto(lugar.u, lugar.v);
      const X0 = Math.round(px - a.peX), Y0 = Math.round(py - a.peY - 1 - lugar.sobe);
      const chave = [pessoa.id, lugar.pose, lugar.olha, X0, Y0].join('|');
      let p = pecasDasPessoas.get(chave);
      if (!p) {
        const movel = new Uint8ClampedArray(W * W * 4), peColuna = new Int16Array(W).fill(-1);
        for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) {
          const s4 = (y * q.w + x) * 4; if (q.px[s4 + 3] < 128) continue;
          const X = X0 + x, Y = Y0 + y; if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
          const d = (Y * W + X) * 4; for (let c = 0; c < 4; c++) movel[d + c] = q.px[s4 + c];
          peColuna[X] = Math.round(py);
        }
        p = { id: 'pessoa-' + pessoa.id, movel, sombra: VAZIA, topo: Y0 + a.topo, peColuna, caixa: [Math.max(0, X0), Math.max(0, Y0), Math.min(W, X0 + q.w), Math.min(W, Y0 + q.h)] };
        if (pecasDasPessoas.size > 40) pecasDasPessoas.clear();
        pecasDasPessoas.set(chave, p);
      }
      const r = 0.28;
      itens.push({ p, dx: 0, dy: 0, fator: 1, pe: [lugar.u - r, lugar.u + r, lugar.v - r, lugar.v + r], sobre: lugar.sobre, atras: false, nome: pessoa.nome, cabeca: [px, Y0 + a.topo] });
    }
    return itens;
  }
  // A caminhada: busca em largura pela grade, nas 4 direções da grade (que na tela são as 4 diagonais).
  function caminho(de, para) {
    const alvo = new Set(para.map(([i, j]) => i * N + j)), veio = new Map([[de[0] * N + de[1], -1]]), fila = [de[0] * N + de[1]];
    for (let q = 0; q < fila.length; q++) {
      const k = fila[q];
      if (alvo.has(k)) { const r = []; for (let x = k; x !== -1; x = veio.get(x)) r.unshift([Math.floor(x / N), x % N]); return r; }
      const i = Math.floor(k / N), j = k % N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const b = (i + di) * N + j + dj;
        if (!veio.has(b) && livre(i + di, j + dj)) { veio.set(b, k); fila.push(b); }
      }
    }
    return null;
  }
  const DIR = { '1,0': 'sudoeste', '-1,0': 'nordeste', '0,1': 'sudeste', '0,-1': 'noroeste' };
  // De onde o coelho sai: a casa dele, ou (se um móvel foi arrastado para cima dela) a casa livre mais perto.
  function saida() {
    const c = [Math.floor(coelho.u), Math.floor(coelho.v)];
    if (livre(...c)) return c;
    return todasAsCasas().filter(([i, j]) => livre(i, j)).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]))[0];
  }
  function andarAte(c) {
    if (semAndar) { const f = c[c.length - 1]; coelho.u = f[0] + 0.5; coelho.v = f[1] + 0.5; coelho.caminho = []; chegar(); }
    else { coelho.u = c[0][0] + 0.5; coelho.v = c[0][1] + 0.5; coelho.caminho = c.slice(1); if (!coelho.caminho.length) chegar(); }
  }
  function ir(id) {
    const pt = pontos()[id];
    if (!pt || !pt.ao.length) return;
    // Sentado ou deitado: LEVANTA primeiro, e só então anda.
    const atual = coelho.destino && !coelho.caminho.length && !coelho.trans && !coelho.aproximar ? pontos()[coelho.destino] : null;
    if (atual && atual.onde && coelho.destino !== id) return levantar(() => ir(id));
    // Para sentar, ele anda até a casa livre MAIS PERTO DA BEIRADA (a da frente do assento): chegando por outra casa, o
    // último trecho em linha reta atravessava o móvel. No pufe, o lado para onde ele vai olhar é sorteado antes.
    let alvos = pt.ao;
    if (pt.onde) {
      if (id === 'pufe') coelho.olharNoPufe = coelho.ladoDoPufe = window.olharNoPufeDoTeste ?? ['sudeste', 'sudoeste', 'nordeste', 'noroeste'][Math.floor(Math.random() * 4)];
      const ro = roteiro(id, pontos()[id]), d = ([i, j]) => Math.hypot(i + 0.5 - ro.beira[0], j + 0.5 - ro.beira[1]);
      alvos = [[...pt.ao].sort((a, b) => d(a) - d(b))[0]];
    }
    const c = caminho(saida(), alvos);
    if (!c) return;
    if (id === 'mesa') return ir('cadeira');
    if (id === 'cadeira') { const L = lugarNaMesa(); levarCadeira(L.P0, L.th, 900); }
    coelho.pose = 'parado'; coelho.destino = id;
    andarAte(c);
  }
  // A COREOGRAFIA DE SENTAR (relato de 14/10/2026: "ele vai alterando a animação no ar; deveria primeiro chegar no
  // objeto"). Três tempos: (1) anda até a BEIRADA (o ponto do chão logo na frente do assento, ou ao lado da cama),
  // (2) vira de costas para o assento e toca os quadros de sentar ALI, com os pés no chão, (3) no fim, a pose no assento.
  // Levantar é o mesmo ao contrário, e só depois ele anda.
  const VET = { sudoeste: [1, 0], sudeste: [0, 1], nordeste: [-1, 0], noroeste: [0, -1] };
  // A TRANSIÇÃO PELO CENTRO DO CORPO (relato de 14/10/2026: "ele teleporta"). Cada quadro do meio tem outra forma (de pé,
  // agachado, sentado, deitado); posicionado pelo pé, o corpo pulava a cada troca. Agora a transição sabe a pose de SAÍDA
  // (de pé na beirada) e a de CHEGADA (no assento, ou deitado na cama), e o CENTRO do corpo desliza de uma para a outra,
  // com aceleração suave: cada quadro é desenhado com o próprio centro nesse caminho. O pé (para a sombra e a
  // profundidade) e a altura vão juntos.
  const ASSENTO = { pufe: 30, poltrona: 22, cama: 30, cadeira: ASSENTO_CADEIRA }; // a altura de verdade do assento (a linha das pernas)
  // Na cama, a pose sai de "dormindo": para deitar, do estado (ausente dorme); para LEVANTAR, do que ele está fazendo
  // (relato de 14/10/2026: ele dormia e levantava com o livro, porque o estado já tinha virado "à toa").
  function poseDoAssento(id, dormindo) {
    if (id === 'cama') return dormindo ? (coelho.largado || performance.now() - coelho.desde > 20000 ? 'dormindo-largado' : 'dormindo') : 'lendo';
    return id === 'poltrona' ? 'sentado-poltrona' : id === 'cadeira' ? 'no-computador' : 'sentado';
  }
  function roteiro(id, pt, dormindo = estado === 'ausente') {
    let beira, nomeT;
    if (id === 'cama') {
      nomeT = dormindo ? 'deitar' : 'deitar-lendo';
      beira = pt.beira; // encostado na cama, no lado comprido da frente
    } else {
      const [vu, vv] = VET[pt.olha], r = id === 'pufe' ? 0.62 : 0.7; // no pufe, encostado na borda (0,45 do assento) antes de subir
      beira = [pt.onde[0] + vu * r, pt.onde[1] + vv * r];
      nomeT = 'sentar';
    }
    let quadros = [...quadrosDe(nomeT, pt.olha).quadros];
    // NA CAMA, PRIMEIRO SENTA NA BEIRADA (relato de 14/10/2026: "no primeiro quadro ele já está lendo"). O deitar do
    // PixelLab começa sentado, e o deitar-lendo, sentado com o livro aberto. Na frente vão os três primeiros do sentar (de
    // pé, agachando) e, para ler, o sentado SEM livro do deitar: ele senta, abre o livro e só então se deita.
    if (id === 'cama') {
      const sentar = quadrosDe('sentar', pt.olha).quadros.slice(0, 3);
      quadros = [...sentar, ...(nomeT === 'deitar-lendo' ? [quadrosDe('deitar', pt.olha).quadros[0]] : []), ...quadros];
    }
    // Na poltrona de frente, o fim do sentar já abre os braços até os apoios (trecho próprio, sem a poltrona inventada
    // que a primeira tentativa desenhou): os 4 primeiros quadros do sentar e os 2 dos braços.
    if (id === 'poltrona' && ANIM.bracos?.[pt.olha]) quadros = [...quadros.slice(0, 4), ...ANIM.bracos[pt.olha].quadros];
    return { beira, atrasNaBeira: id !== 'cama' && pt.olha.startsWith('n'), quadros, de: { chao: beira, h: 0, anim: 'parado' }, para: { chao: pt.onde, h: pt.sobe, anim: poseDoAssento(id, dormindo) } };
  }
  const DUR_TOTAL = 1500; // a transição inteira (sentar, deitar), com quantos quadros tiver
  function tocar(id, pt, ro, reverso, depois) {
    if (semAndar || !ro.quadros.length) { depois(); return; }
    coelho.trans = {
      quadros: reverso ? [...ro.quadros].reverse() : ro.quadros, de: reverso ? ro.para : ro.de, para: reverso ? ro.de : ro.para,
      reverso, t0: performance.now(), dur: DUR_TOTAL * (ro.quadros.length > 6 ? 1.3 : 1), depois, alvo: id, dir: pt.olha, atrasNaBeira: ro.atrasNaBeira,
    };
  }
  // Onde fica o centro do corpo de uma pose em relação ao ponto do chão embaixo dela (sem a altura do assento).
  function desvioDaPose(pose, dir) {
    const a = quadrosDe(pose.anim, dir), q = a.quadros[0];
    return [q.cx - a.peX, q.cy - a.peY - 1];
  }
  // O último trecho a pé, fora da grade: da casa até a beirada (ou de volta).
  function aproximar(alvo, atras, sobre, depois) {
    if (semAndar) { coelho.u = alvo[0]; coelho.v = alvo[1]; depois(); return; }
    coelho.aproximar = { alvo, atras, sobre, depois };
  }
  function chegar() {
    const pt = coelho.destino && pontos()[coelho.destino];
    if (!pt) { coelho.pose = 'parado'; return; }
    if (!pt.onde) { if (coelho.destino === 'guarda-roupa' && VISTAS_ABERTO) { guardaRoupaAberto = true; if (FUNCOES?.gavetas && !soVer) acao('gavetas'); } return chegarDeVez(); }
    coelho.largado = Math.random() < 0.5; // dormindo rígido ou largado: sorteado antes, a transição já vai para ele
    const id = coelho.destino, p2 = pontos()[id], ro = roteiro(id, p2);
    aproximar(ro.beira, ro.atrasNaBeira, id, () => { coelho.dir = p2.olha; tocar(id, p2, ro, false, () => chegarDeVez()); });
  }
  function levantar(depois) {
    if (coelho.destino === 'cadeira') {
      const L = lugarNaMesa();
      if (Math.hypot(cadeira.u - L.P0[0], cadeira.v - L.P0[1]) > 0.05) {
        coelho.descendo = true;
        levarCadeira(L.P0, L.th, 700, () => { coelho.descendo = false; levantar(depois); });
        return;
      }
    }
    // No pufe, virado para outro lado: primeiro se vira de volta para o lado por onde subiu (a virada suave leva até
    // 400 ms), e só então desce por ele.
    if (coelho.destino === 'pufe' && coelho.ladoDoPufe && coelho.olharNoPufe !== coelho.ladoDoPufe) {
      coelho.olharNoPufe = coelho.ladoDoPufe;
      coelho.descendo = true;
      setTimeout(() => { coelho.descendo = false; levantar(depois); }, 450);
      return;
    }
    const id = coelho.destino, pt = pontos()[id], ro = roteiro(id, pt, coelho.pose === 'dormindo');
    coelho.destino = null; coelho.pose = 'parado';
    tocar(id, pt, ro, true, () => {
      coelho.u = ro.beira[0]; coelho.v = ro.beira[1];
      const c = saida();
      aproximar([c[0] + 0.5, c[1] + 0.5], ro.atrasNaBeira, id, () => depois());
    });
  }
  function chegarDeVez() {
    const pt = coelho.destino && pontos()[coelho.destino];
    if (!pt) { coelho.pose = 'parado'; return; }
    coelho.dir = pt.olha;
    coelho.pose = coelho.destino === 'cama' ? (estado === 'ausente' ? 'dormindo' : 'lendo') : pt.pose;
    if (coelho.destino === 'cadeira') { const L = lugarNaMesa(); coelho.descendo = true; levarCadeira(L.S, L.th, 700, () => { coelho.descendo = false; if (coelho.redecidir) { coelho.redecidir = false; decidir(); } }); }
    // DORMINDO (ideia dele): às vezes rígido, às vezes largado; o rígido relaxa sozinho depois de um tempo.
    coelho.desde = performance.now();
  }
  // O ESTADO REAL DECIDE O LUGAR. Em call, a poltrona faz o papel do computador, que o quarto ainda não tem.
  function decidir() {
    if (coelho.trans || coelho.aproximar || coelho.descendo) { coelho.redecidir = true; return; } // no meio de sentar ou levantar: decide quando terminar
    if (CENA === 'salao') { if (pontos().balcao && coelho.destino !== 'balcao') ir('balcao'); return; } // o recado, atrás do balcão
    if (estado === 'ausente' || (estado === 'atoa' && modo === 'noite')) {
      // Já na cama: só troca entre ler e dormir, sem levantar.
      if (coelho.destino === 'cama' && !coelho.caminho.length) { chegarDeVez(); return; }
      return ir('cama');
    }
    if (estado === 'call') return ir(VISTAS_CADEIRA && ARR.mesa ? 'cadeira' : 'poltrona');
    const atual = coelho.destino && !coelho.caminho.length ? pontos()[coelho.destino] : null;
    if (atual && atual.onde) return levantar(() => {});
    coelho.destino = null; coelho.pose = 'parado';
    const c = caminho(saida(), [saida()]); if (c) andarAte(c);
  }
  // À toa, de dia: de tempos em tempos, uma casa livre qualquer.
  function passear() {
    if (CENA === 'salao') return;
    if (estado !== 'atoa' || modo === 'noite' || coelho.caminho.length || coelho.destino || coelho.trans || coelho.aproximar) return;
    const livres = todasAsCasas().filter(([i, j]) => livre(i, j));
    const c = caminho(saida(), [livres[Math.floor(Math.random() * livres.length)]]);
    if (c) andarAte(c);
  }
  const quadroBuf = new Uint8ClampedArray(W * W * 4), peBuf = new Int16Array(W).fill(-1), semSombra = new Uint8ClampedArray(W * W * 4);
  let ultimaCaixa = null, coelhoPe = null, coelhoTopo = 0, coelhoChave = 0, rotuloDoQuadro = '', coelhoLinha = W, coelhoSobre = null;
  function pecaDoCoelho() {
    const tr = coelho.trans, ap = coelho.aproximar;
    const pt = !tr && !ap && coelho.destino && !coelho.caminho.length ? pontos()[coelho.destino] : null;
    // No ponto, o olhar é o do móvel AGORA: girar a poltrona com ele sentado vira o coelho junto.
    if (pt) coelho.dir = pt.olha;
    let u, v, subida = 0, quadroT = null, sobreT = null, atrasT = false;
    let centroT = null, indiceT = 0;
    if (tr) {
      const f = Math.min(1, (performance.now() - tr.t0) / tr.dur);
      coelho.dir = tr.dir;
      // EM DUAS ETAPAS (relato de 14/10/2026: ele começava longe e deslizava pelo ar até o assento). Na primeira, ele SOBE
      // e o corpo passa da beirada para a BORDA do móvel (meia casa para dentro, no máximo); na segunda, já em cima, se
      // acomoda até o lugar (o meio da cama, o assento). "p" é o quanto ele já está no móvel (0 na beirada, 1 no lugar),
      // nos dois sentidos: ao levantar, ele vai do lugar à borda ainda em cima, e só então desce.
      const p = tr.reverso ? 1 - f : f, liso = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
      const B = tr.reverso ? tr.para : tr.de, S = tr.reverso ? tr.de : tr.para;
      const du = S.chao[0] - B.chao[0], dv = S.chao[1] - B.chao[1], dist = Math.hypot(du, dv) || 1, k = Math.min(1, 0.45 / dist);
      const borda = [B.chao[0] + du * k, B.chao[1] + dv * k];
      // O corpo passa a borda um pouco ANTES de a altura subir: sentado no ar ao lado do móvel era o "flutuar".
      // NO PUFE, UM PULINHO (relato de 14/10/2026: "ainda está deslizando"): o "sentar" do PixelLab é sentar NO CHÃO —
      // cinco quadros de pé e agachando, e só o último sentado. Subindo junto, ele chegava em cima do pufe ainda de pé.
      // Então ele agacha na beirada, com os pés no chão, e sobe de uma vez já sentado; o fim é se ajeitar no assento.
      const pulo = tr.alvo === 'pufe', n = tr.quadros.length;
      const eB = pulo ? liso((p - 0.36) / 0.3) : liso(p / 0.35);
      const e1 = pulo ? liso((p - 0.36) / 0.3) : liso((p - 0.08) / 0.47); // o impulso começa ainda agachado
      const e2 = pulo ? liso((p - 0.7) / 0.3) : liso((p - 0.55) / 0.45);
      const eO = pulo ? liso(p / 0.6) : liso(p);
      const iOrig = pulo ? (p < 0.45 ? Math.min(n - 2, Math.floor((p / 0.45) * (n - 1))) : n - 1) : Math.min(n - 1, Math.floor(p * n));
      indiceT = tr.reverso ? n - 1 - iOrig : iOrig;
      u = e2 > 0 ? borda[0] + (S.chao[0] - borda[0]) * e2 : B.chao[0] + (borda[0] - B.chao[0]) * eB;
      v = e2 > 0 ? borda[1] + (S.chao[1] - borda[1]) * e2 : B.chao[1] + (borda[1] - B.chao[1]) * eB;
      subida = B.h + (S.h - B.h) * e1;
      // O centro do corpo: o ponto do chão, menos a altura, mais o centro da forma (de pé → sentado ou deitado).
      const oB = desvioDaPose(B, tr.dir), oS = desvioDaPose(S, tr.dir), [gx, gy] = ponto(u, v);
      centroT = [gx + oB[0] + (oS[0] - oB[0]) * eO, gy - subida + oB[1] + (oS[1] - oB[1]) * eO];
      quadroT = { a: quadrosDe('parado', tr.dir), q: tr.quadros[indiceT] };
      sobreT = tr.alvo;
      atrasT = subida < 2 ? tr.atrasNaBeira : tr.alvo === 'poltrona' && tr.dir.startsWith('n');
    } else if (ap) { u = coelho.u; v = coelho.v; sobreT = ap.sobre; atrasT = ap.atras; }
    else [u, v] = pt && pt.onde ? pt.onde : [coelho.u, coelho.v];
    const sentado = (pt && pt.onde) || null;
    const [px, py] = ponto(u, v);
    if (ultimaCaixa) {
      const [a, b, c, d] = ultimaCaixa;
      for (let y = b; y < d; y++) for (let x = a; x < c; x++) if (x >= 0 && y >= 0 && x < W && y < W) quadroBuf[(y * W + x) * 4 + 3] = 0;
      peBuf.fill(-1);
    }
    // A ANIMAÇÃO pelo que ele está fazendo: andando, sentado (lendo ou dormindo, na cama), falando de pé, ou parado.
    const nomeAnim = coelho.caminho.length || ap ? 'andando'
      : pt && pt.onde ? (coelho.pose === 'lendo' ? 'lendo' : coelho.pose === 'dormindo' ? (coelho.largado || performance.now() - coelho.desde > 20000 ? 'dormindo-largado' : 'dormindo') : coelho.destino === 'poltrona' ? 'sentado-poltrona' : coelho.destino === 'cadeira' ? 'no-computador' : 'sentado')
      : falando ? 'falando' : 'parado';
    // A VIRADA SUAVE (ideia dele, 14/10/2026): a direção que APARECE anda um passo por quadro no círculo das 8, pelo lado
    // mais curto, até a que ele quer; os passos do meio são a pose dele (de pé ou sentado) naquela direção. 90° = 200 ms.
    const ANEL = ['sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste', 'leste'];
    if (tr || semAndar || !coelho.dirVista) coelho.dirVista = coelho.dir;
    else if (coelho.dirVista !== coelho.dir && coelho.ultimoGiro !== coelho.quadro) {
      const i = ANEL.indexOf(coelho.dirVista), j = ANEL.indexOf(coelho.dir), dif = (j - i + 8) % 8;
      coelho.dirVista = ANEL[(i + (dif <= 4 ? 1 : -1) + 8) % 8];
      coelho.ultimoGiro = coelho.quadro;
    }
    const virando = coelho.dirVista !== coelho.dir;
    const animDaVirada = nomeAnim === 'sentado' || nomeAnim === 'sentado-poltrona' ? 'sentado' : 'parado';
    const a = quadroT ? quadroT.a : virando ? quadrosDe(animDaVirada, coelho.dirVista) : quadrosDe(nomeAnim, coelho.dir);
    // PARADO, a respiração é discreta (relato de 14/10/2026: o ciclo inteiro do PixelLab balançava "como bêbado", 5 px
    // na cabeça e 3 px para o lado). Só os quadros mais parecidos com a pose, devagar, a maior parte do tempo nela.
    const RESPIRA = [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 8, 8, 8];
    // AO COMPUTADOR (pedido dele, 14/10/2026: "digitando devagar e de vez em quando mexendo no mouse"): 12 s de roteiro,
    // a 10 quadros por segundo. Os quadros: 0 a pose, 1 e 2 uma mão descendo (um toque), 3 e 4 o pulso no mouse.
    const DIGITA = [...'0011000220001100000220011002200000110000022000110000000220011000002200000110000'].map(Number);
    const MOUSE = [...'03343343433443340000'].map(Number);
    const NO_PC = [...DIGITA, ...MOUSE, ...DIGITA.slice(0, 20)];
    const iq = nomeAnim === 'parado' && !quadroT ? Math.min(a.quadros.length - 1, RESPIRA[coelho.quadro % RESPIRA.length])
      : nomeAnim === 'no-computador' && !quadroT ? Math.min(a.quadros.length - 1, NO_PC[coelho.quadro % NO_PC.length])
      : coelho.quadro % a.quadros.length;
    const quadro = quadroT ? quadroT.q : virando ? a.quadros[0] : a.quadros[iq];
    rotuloDoQuadro = (quadroT ? 'T' + indiceT + ':' + Math.round(centroT[0]) + ',' + Math.round(centroT[1]) : nomeAnim + iq) + coelho.dirVista + (falando ? Math.floor(coelho.quadro / 3) % 3 : '');
    const sw = quadro.w, sh = quadro.h;
    const altura = tr ? subida : sentado ? pt.sobe : 0;
    if (tr && quadroT && subida === 0) { /* na beirada: os pés do quadro no chão */ }
    // Na transição, pelo CENTRO do corpo; no resto, pelo pé.
    const X0 = Math.round(centroT ? centroT[0] - quadro.cx : px - a.peX), Y0 = Math.round(centroT ? centroT[1] - quadro.cy : py - a.peY - 1 - altura);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const s = (y * quadro.w + x) * 4;
      const fonte = quadro.px;
      if (fonte[s + 3] < 128) continue;
      const X = X0 + x, Y = Y0 + y;
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const d = (Y * W + X) * 4;
      quadroBuf[d] = fonte[s]; quadroBuf[d + 1] = fonte[s + 1]; quadroBuf[d + 2] = fonte[s + 2]; quadroBuf[d + 3] = 255;
      // A luz dele, de noite, é a do chão onde o pé está (como a dos móveis).
      peBuf[X] = Math.round(py);
    }
    ultimaCaixa = [X0, Y0, X0 + sw, Y0 + sh];
    window.caixaDoCoelho = ultimaCaixa; // para as fotos de perto do teste
    // [x, y do chão, altura do assento]: sentado, a sombra sai do assento e cai no chão em volta do móvel.
    coelhoPe = [px, py, altura];
    // A espessura dele na profundidade: de pé, fino; sentado, as pernas à frente; deitado, o corpo inteiro no colchão.
    const deitadoAgora = (pt && pt.onde && coelho.destino === 'cama') || (tr && tr.alvo === 'cama' && subida > 0);
    coelhoChave = py + (deitadoAgora ? 28 : (pt && pt.onde) || (tr && subida > 0) ? 10 : 5);
    // SENTADO OU DEITADO, o que fica abaixo da linha do assento (pernas, pés) está À FRENTE: cada pixel abaixo dela ganha
    // profundidade. Com uma profundidade só, os pés eram cobertos pela frente do assento e pela beirada da cama.
    // A linha das pernas é a altura de VERDADE do assento (na poltrona o desenho fica mais baixo que ele: a perna era cortada).
    const alvoAgora = tr ? tr.alvo : pt && pt.onde ? coelho.destino : null;
    coelhoLinha = altura > 0 ? py - Math.max(altura, ASSENTO[alvoAgora] ?? 0) - 4 : W;
    coelhoSobre = altura > 0 ? alvoAgora : null;
    const p = { id: 'coelho', movel: quadroBuf, sombra: semSombra, topo: Y0, peColuna: peBuf };
    // A ÁREA NO CHÃO: de pé, um quadradinho em volta do pé; sentado ou deitado, ele está SOBRE o móvel.
    const r = 0.3, area = [coelho.u - r, coelho.u + r, coelho.v - r, coelho.v + r];
    coelhoTopo = Y0 + a.topo;
    // Na transição e no trecho até a beirada, a ordem é a do móvel (antes ou depois dele).
    const sobre = sobreT ?? (sentado ? pt.sobre : null);
    return [{ p, dx: 0, dy: 0, fator: 1, pe: area, sobre, atras: sobreT ? atrasT : sentado ? !!pt.atras : false }];
  }
  // O BALÃO DE FALA (ideia dele, como no The Sims): o balão do D4 com os três pontos, que se acendem um de cada vez,
  // acima da cabeça. Desenhado por cima de tudo, em pixel: borda escura, miolo creme, rabicho apontando para a cabeça.
  const BALAO = [
    '..##################..',
    '.#cccccccccccccccccc#.',
    '#cccccccccccccccccccc#',
    '#cccccccccccccccccccc#',
    '#ccc11cccc22cccc33ccc#',
    '#ccc11cccc22cccc33ccc#',
    '#cccccccccccccccccccc#',
    '#cccccccccccccccccccc#',
    '.#cccccccccccccccccc#.',
    '..#####ccc##########..',
    '.......#cc#...........',
    '......#cc#............',
    '......##..............',
  ];
  function balao(px) {
    if (!ultimaCaixa) return;
    const [x0, , x1] = ultimaCaixa, bx = Math.round((x0 + x1) / 2 - 4), by = coelhoTopo - BALAO.length - 2;
    const aceso = Math.floor(coelho.quadro / 3) % 3;
    for (let y = 0; y < BALAO.length; y++) for (let x = 0; x < BALAO[y].length; x++) {
      const ch = BALAO[y][x];
      if (ch === '.') continue;
      const X = bx + x, Y = by + y;
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const cor = ch === '#' ? [58, 40, 34] : ch === 'c' ? [251, 244, 232] : Number(ch) - 1 === aceso ? [58, 40, 34] : [190, 172, 160];
      const k = (Y * W + X) * 4;
      px[k] = cor[0]; px[k + 1] = cor[1]; px[k + 2] = cor[2]; px[k + 3] = 255;
    }
  }

  // ============================== A FORMA DE CADA MÓVEL (o formato para escalar) ==============================
  // Cada móvel declara a sua forma UMA VEZ, em caixas: a fatia da área no chão que ela ocupa e a altura (px). Os lados
  // são relativos para onde o móvel OLHA ("frente", "tras", e os dois "lado"), então as 4 posições saem girando a forma.
  // Com ela, cada pixel do desenho sabe a ALTURA VISÍVEL (a caixa que a linha de visão encontra primeiro, de cima para
  // baixo): daí sai a profundidade (o coelho aparece na frente ou atrás pixel a pixel) e o ponto do chão embaixo dele
  // (a sombra). Móvel novo traz a forma dele; nada de camada recortada à mão (relato de 14/10/2026: a borda reta da
  // camada da frente cortava o coelho).
  const BRACO_POLTRONA = 34; // a altura do tampo dos braços da poltrona
  const FORMAS = {
    poltrona: [{ h: [0, 22] }, { lado: 'tras', fatia: 0.32, h: [0, 62] }, { lado: 'lados', fatia: 0.22, h: [0, BRACO_POLTRONA] }],
    pufe: [{ h: [0, 30] }],
    mesa: [{ h: [0, 42] }],
    // A cama olha para o sudoeste: a cabeceira fica atrás (u pequeno), os pés na frente.
    // A cama de casal (cama-casal-giros): colchão e cabeceira, sem peseira.
    cama: [{ h: [0, 30] }, { lado: 'tras', fatia: 0.1, h: [0, 62] }],
    abajur: [{ h: [0, 78] }],
    'guarda-roupa': [{ h: [0, 135] }],
    'planta-alta': [{ h: [0, 100] }],
    'planta-baixa': [{ h: [0, 50] }],
    // O salão (15/10/2026).
    sofa: [{ h: [0, 20] }, { lado: 'tras', fatia: 0.3, h: [0, 44] }],
    tv: [{ h: [0, 30] }, { lado: 'tras', fatia: 0.35, h: [0, 82] }],
    fliperama: [{ h: [0, 118] }],
    balcao: [{ h: [0, 52] }],
    estante: [{ h: [0, 120] }],
    mesinha: [{ h: [0, 20] }],
    banqueta: [{ h: [0, 40] }],
    'banqueta-2': [{ h: [0, 40] }],
  };
  const OLHA_DE = { cama: 'sudoeste' };
  // O TIPO de cada caixa, guardado por pixel: as pernas do coelho sentado passam à frente do assento, mas nunca do
  // encosto nem da face dos braços (relato de 14/10/2026: o rabo e o quadril apareciam por cima do encosto).
  const TIPO_DE_CAIXA = { base: 1, tras: 2, lados: 3, frente: 4 };
  // As caixas absolutas [u0, u1, v0, v1, h0, h1, tipo] de uma forma numa área, olhando para "olha".
  function caixasDe(area, olha, forma) {
    const [u0, u1, v0, v1] = area, du = u1 - u0, dv = v1 - v0;
    // O eixo do olhar e o sinal: sudoeste = +u, nordeste = -u, sudeste = +v, noroeste = -v.
    const eixoU = olha === 'sudoeste' || olha === 'nordeste', sinal = olha === 'sudoeste' || olha === 'sudeste' ? 1 : -1;
    const caixas = [];
    for (const c of forma) {
      const tipo = TIPO_DE_CAIXA[c.lado ?? 'base'];
      if (!c.lado || !olha) { caixas.push([u0, u1, v0, v1, ...c.h, tipo]); continue; }
      const fat = (lo, hi, f, doAlto) => (doAlto ? [hi - (hi - lo) * f, hi] : [lo, lo + (hi - lo) * f]);
      if (c.lado === 'frente' || c.lado === 'tras') {
        const noAlto = (c.lado === 'frente') === (sinal > 0);
        if (eixoU) caixas.push([...fat(u0, u1, c.fatia, noAlto), v0, v1, ...c.h, tipo]);
        else caixas.push([u0, u1, ...fat(v0, v1, c.fatia, noAlto), ...c.h, tipo]);
      } else for (const noAlto of [false, true]) {
        if (eixoU) caixas.push([u0, u1, ...fat(v0, v1, c.fatia, noAlto), ...c.h, tipo]);
        else caixas.push([...fat(u0, u1, c.fatia, noAlto), v0, v1, ...c.h, tipo]);
      }
    }
    return caixas;
  }
  // A altura visível de cada pixel de uma peça, guardada por posição (o móvel só muda quando é arrastado ou girado).
  const cacheDeAlturas = new Map();
  // SÓ NA CAIXA DA PEÇA (desempenho, 15/10/2026): antes eram duas tabelas do tamanho da imagem inteira por móvel, e o
  // cache de 24 não cabia o salão (30 peças com as pessoas): cada montagem da cena refazia tudo, ~280 ms no 16 × 16, e
  // pegar ou soltar um móvel travava. Agora a tabela é a da caixa (h(k) e tipo(k) leem nela), e o cache cabe o salão.
  function alturasDe(it) {
    const chave = it.p.id + '|' + it.dx + '|' + it.dy + '|' + (it.olha ?? '') + '|' + (it.p.caixa ? it.p.caixa.join(',') : '');
    if (cacheDeAlturas.has(chave)) return cacheDeAlturas.get(chave);
    if (cacheDeAlturas.size > 120) cacheDeAlturas.clear();
    const [bx0, by0, bx1, by1] = caixaDaPeca(it.p), bw = Math.max(0, bx1 - bx0), bh = Math.max(0, by1 - by0);
    const hs = new Float32Array(bw * bh).fill(-1), tipos = new Int8Array(bw * bh), m = it.p.movel, cx = it.caixas ?? [];
    const res = { h: (k) => { const x = (k % W) - bx0, y = ((k / W) | 0) - by0; return x < 0 || y < 0 || x >= bw || y >= bh ? -1 : hs[y * bw + x]; }, tipo: (k) => { const x = (k % W) - bx0, y = ((k / W) | 0) - by0; return x < 0 || y < 0 || x >= bw || y >= bh ? 0 : tipos[y * bw + x]; } };
    const alto = Math.max(0, ...cx.map((c) => c[5]));
    for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
      const k = (yy + by0) * W + xx + bx0, j = yy * bw + xx;
      if (!m[k * 4 + 3]) continue;
      if (it.deitado) { hs[j] = 0; continue; }
      const x = k % W + it.dx, y = ((k / W) | 0) + it.dy;
      // De cima para baixo: a primeira caixa que contém o ponto (chão em (x, y + h), altura h) é a superfície que se vê.
      for (let h = Math.ceil(alto); h >= 0; h--) {
        const Y = y + h;
        if (Y >= W || x < 0 || x >= W) continue;
        const g = Y * W + x, u = mapaU[g], v = mapaV[g];
        const achou = cx.find((c) => u >= c[0] && u <= c[1] && v >= c[2] && v <= c[3] && h >= c[4] && h <= c[5]);
        if (achou) { hs[j] = h; tipos[j] = achou[6]; break; }
      }
    }
    cacheDeAlturas.set(chave, res);
    return res;
  }
  // A caixa de uma peça COM a sombra pintada dela (o tapete traz sombra fora do desenho), guardada.
  const caixasComSombra = new WeakMap();
  function caixaComSombra(p) {
    if (caixasComSombra.has(p)) return caixasComSombra.get(p);
    let [x0, y0, x1, y1] = caixaDaPeca(p);
    if (p.sombra && p.sombra !== VAZIA) for (let k = 0; k < W * W; k++) if (p.sombra[k * 4 + 3]) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
    const c = [x0, y0, x1, y1]; caixasComSombra.set(p, c); return c;
  }
  const chaveDoPixel = new Float32Array(W * W);

  // A ORDEM DE DESENHO NO ISOMÉTRICO (14/10/2026): um número só por peça (a soma da casa da frente) errava com móvel
  // comprido (a cama) e com o coelho AO LADO de um móvel, e não na frente: ele aparecia cortado. O certo é comparar as
  // ÁREAS NO CHÃO: quem está inteiramente mais ao fundo num dos eixos (u ou v menor) é desenhado antes. O que fica
  // deitado (o tapete) vai primeiro; o coelho sentado vai logo depois do móvel (ou logo antes, se ele está de costas).
  function antes(a, b) {
    if (a.porCima !== b.porCima) return !b.porCima ? false : true; // a camada da frente vai por último
    if (a.deitado !== b.deitado) return !!a.deitado;
    if (a.sobre && a.sobre === b.p.id) return a.atras;
    if (b.sobre && b.sobre === a.p.id) return !b.atras;
    const e = 0.001;
    if (a.pe[1] <= b.pe[0] + e || a.pe[3] <= b.pe[2] + e) return true;
    if (b.pe[1] <= a.pe[0] + e || b.pe[3] <= a.pe[2] + e) return false;
    return a.pe[1] + a.pe[3] < b.pe[1] + b.pe[3];
  }
  function ordenar(itens) {
    const resto = [...itens], fila = [];
    while (resto.length) {
      let i = resto.findIndex((x) => !resto.some((y) => y !== x && antes(y, x) && !antes(x, y)));
      if (i < 0) i = 0; // um ciclo (não deve haver): segue na ordem
      fila.push(resto.splice(i, 1)[0]);
    }
    return fila;
  }

  // A SOMBRA DO COELHO (ideia dele, 14/10/2026): a silhueta projetada no chão, para o lado oposto à luz. De dia a luz é
  // a JANELA (o meio do vidro, alto: sombra curta e para a esquerda-frente); de noite, o ABAJUR (baixo e perto: sombra
  // mais comprida, para longe dele). Cada pixel do coelho a uma altura h acima do pé cai no chão a h × alongamento,
  // na direção contrária à da luz. Pixel art: sombra chapada, sem borrão. Só o chão escurece.
  const LUZ_DIA = { x: 420 + DX, y: 170 + DY, alongamento: 0.85, forca: 0.55 };
  const sombraBuf = new Uint8Array(W * W);
  // A ALTURA DO TAMPO de cada peça (onde a sombra cai em cima): o colchão, o tampo do pufe, o assento da poltrona. O que
  // fica acima (a cabeceira, o encosto) é lateral.
  const TAMPO = { cama: 30, pufe: 30, poltrona: 22, abajur: 52, 'guarda-roupa': 135, sofa: 20, tv: 30, fliperama: 118, balcao: 52, estante: 120, mesinha: 20, banqueta: 40, 'banqueta-2': 40 };
  // AS CÓPIAS (o mesmo desenho de outro móvel): a forma e o tampo são os do original.
  const COPIAS = { 'sofa-2': 'sofa', 'poltrona-2': 'poltrona', 'banqueta-2': 'banqueta', 'cadeira-2': 'cadeira', 'cadeira-3': 'cadeira', 'cadeira-4': 'cadeira' };
  for (const [c, o] of Object.entries(COPIAS)) { if (FORMAS[o] && !FORMAS[c]) FORMAS[c] = FORMAS[o]; if (TAMPO[o] && !TAMPO[c]) TAMPO[c] = TAMPO[o]; }
  // O mapa do chão: para cada pixel da tela, a casa (u, v) do ponto do chão ali. Calculado uma vez.
  const mapaU = new Float32Array(W * W), mapaV = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const [u, v] = uvRapido(x + 0.5, y + 0.5); mapaU[y * W + x] = u; mapaV[y * W + x] = v; }
  const dentroDaArea = (k, a) => mapaU[k] >= a[0] && mapaU[k] <= a[1] && mapaV[k] >= a[2] && mapaV[k] <= a[3];
  const chaoPx = new Int32Array(W * W).fill(-2), alturaPx = new Float32Array(W * W), tipoPx = new Int8Array(W * W);

  // A SOMBRA DO COELHO (relatos de 14/10/2026): cada pixel dele, a uma altura h, lança um raio que desce até o chão
  // afastando-se da luz. "alturaDoRaio" guarda, por ponto do chão, o raio mais alto que passa por cima; "forcaDoRaio",
  // quão escura a sombra é ali (mais forte perto dos pés, sumindo na ponta). Um pixel (de chão, de tapete ou de móvel) está
  // na sombra se o raio passa acima dele no ponto do chão que fica embaixo dele. A sombra de contato (embaixo dos pés)
  // entra na mesma camada. No fim, um borrão leve e poucos tons: macia nas bordas, ainda com cara de pixel art.
  const alturaDoRaio = new Float32Array(W * W), forcaDoRaio = new Float32Array(W * W), sombraFinal = new Float32Array(W * W);
  const tmp = new Float32Array(W * W), solido = new Float32Array(W * W);
  let listaAgora = [];
  let forcaDaSombra = 0.55, caixaDaSombra = null;
  function calcularSombra() {
    alturaDoRaio.fill(-1); forcaDoRaio.fill(0); sombraFinal.fill(0);
    caixaDaSombra = null;
    const c = ultimaCaixa, pe = coelhoPe;
    if (!c || !pe || !liga('sombras')) return;
    const lp = lampada(), luz = modo === 'noite' ? { x: lp[0], y: lp[1] + 40, alongamento: 1.0, forca: 0.5 } : { ...LUZ_DIA, x: luzDoDia[0], y: luzDoDia[1] };
    forcaDaSombra = luz.forca;
    let dx = pe[0] - luz.x, dy = (pe[1] - luz.y) * 0.5;
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const [x0, y0, x1, y1] = c;
    let bx0 = W, by0 = W, bx1 = 0, by1 = 0;
    // O SÓLIDO de cada ponto do chão: a altura do tampo do móvel que está em cima dele. O raio que desce até ele PARA ali
    // (a luz foi barrada): sem isso, a sombra atravessava a poltrona e aparecia de novo no chão do outro lado (duas
    // sombras), e cortava no meio do pufe.
    solido.fill(0);
    for (const it of listaAgora) {
      if (!it.caixas || it.deitado) continue;
      for (const c of it.caixas) {
        const cantos = [[c[0], c[2]], [c[1], c[2]], [c[0], c[3]], [c[1], c[3]]].map(([u, v]) => ponto(u, v));
        const xs = cantos.map((q) => q[0]), ys = cantos.map((q) => q[1]);
        for (let yy = Math.max(0, Math.floor(Math.min(...ys))); yy <= Math.min(W - 1, Math.ceil(Math.max(...ys))); yy++)
          for (let xx = Math.max(0, Math.floor(Math.min(...xs))); xx <= Math.min(W - 1, Math.ceil(Math.max(...xs))); xx++) {
            const k = yy * W + xx, u = mapaU[k], v = mapaV[k];
            if (u >= c[0] && u <= c[1] && v >= c[2] && v <= c[3] && c[5] > solido[k]) solido[k] = c[5];
          }
      }
    }
    const marca = (X, Y, h, f) => {
      if (X < 0 || Y < 0 || X >= W || Y >= W) return;
      const k = Y * W + X;
      if (h > alturaDoRaio[k]) alturaDoRaio[k] = h;
      if (f > forcaDoRaio[k]) forcaDoRaio[k] = f;
      bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
    };
    for (let y = Math.max(0, y0); y < Math.min(W, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (!quadroBuf[(y * W + x) * 4 + 3]) continue;
      const alto = Math.max(0, pe[1] - y);
      const comprimento = alto * luz.alongamento, passos = Math.max(1, Math.ceil(comprimento));
      for (let t = 0; t <= passos; t++) {
        const f = t / passos, X = Math.round(x + dx * comprimento * f), Y = Math.round(pe[1] + dy * comprimento * f);
        const h = alto * (1 - f), forca = 1 - 0.6 * (comprimento * f) / 90;
        const k = X >= 0 && Y >= 0 && X < W && Y < W ? Y * W + X : -1;
        if (k >= 0 && t > 1 && solido[k] > 0 && h <= solido[k]) { marca(X, Y, solido[k], forca); break; } // bateu no tampo
        marca(X, Y, h, forca);
      }
    }
    // O contato: uma mancha macia embaixo dos pés (sentado, embaixo do assento, no chão), mais forte no meio.
    for (let yy = -6; yy <= 6; yy++) for (let xx = -16; xx <= 16; xx++) {
      const d = (xx / 16) ** 2 + (yy / 6) ** 2;
      if (d < 1) marca(Math.round(pe[0] + xx), Math.round(pe[1] + yy), 0, 1.1 * (1 - d));
    }
    if (bx1 < bx0) return;
    caixaDaSombra = [Math.max(0, bx0 - 3), Math.max(0, by0 - 140), Math.min(W, bx1 + 4), Math.min(W, by1 + 4)];
    // O teste por pixel, só na caixa da sombra (mais a altura dos móveis acima dela).
    const X0 = Math.max(0, bx0 - 3), X1 = Math.min(W - 1, bx1 + 3), Y0 = Math.max(0, by0 - 140), Y1 = Math.min(W - 1, by1 + 3);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const k = y * W + x;
      if (dono[k] === 'coelho') continue;
      let G = k, h = 0;
      if (chaoPx[k] >= 0) { G = chaoPx[k]; h = alturaPx[k]; }
      else if (chaoPx[k] === -1 || casa[k] < 0) continue;
      if (alturaDoRaio[G] >= 0 && h <= alturaDoRaio[G] + 1) sombraFinal[k] = Math.min(1, forcaDoRaio[G]);
    }
    // Macia: dois borrões 3 × 3, e então poucos tons (quartos), como a luz é desenhada em pixel art.
    for (let passada = 0; passada < 3; passada++) {
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        let soma = 0, n2 = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < W) { soma += sombraFinal[yy * W + xx]; n2++; } }
        tmp[y * W + x] = soma / n2;
      }
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) sombraFinal[y * W + x] = tmp[y * W + x];
    }
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const k = y * W + x;
      sombraFinal[k] = dono[k] === 'coelho' ? 0 : Math.round(sombraFinal[k] * 8) / 8;
    }
  }


  // O relógio: 10 quadros por segundo; o coelho anda 2,5 casas por segundo.
  let ultimo = performance.now(), proximoPasseio = 0, tempoDeDesenho = 0;
  // EM PAUSA COM O JOGO NA FRENTE (pergunta dele, 15/10/2026: "o principal uso envolve jogo concomitante"). O app de
  // desktop desliga o freio do navegador para janela escondida (backgroundThrottling: false, para a chamada não cair),
  // então esta página seguiria desenhando atrás do jogo. Ela para sozinha quando a janela do Syden não está em foco ou
  // está escondida: o relógio passa sem desenhar nada, e o quadro volta ao voltar o foco.
  const emPausa = () => { if (document.hidden) return true; try { return !window.top.document.hasFocus(); } catch { return !document.hasFocus(); } };
  setInterval(() => {
    if (emPausa()) { ultimo = performance.now(); return; }
    const agora = performance.now(), dt = Math.min(0.25, (agora - ultimo) / 1000);
    ultimo = agora;
    coelho.quadro++;
    esbarrao(dt);
    if (VISTAS_ABERTO) {
      const alvoP = guardaRoupaAberto ? 3 : 0;
      if (!PASSAGEM_GR) portas = alvoP;
      else if (portas !== alvoP && coelho.quadro % 2 === 0) portas += Math.sign(alvoP - portas);
    }
    if (coelho.trans && agora - coelho.trans.t0 >= coelho.trans.dur) { const d = coelho.trans.depois; coelho.trans = null; d(); if (coelho.redecidir && !coelho.trans) { coelho.redecidir = false; decidir(); } }
    // No pufe, de vez em quando vira para outro lado (ele é redondo).
    if (!coelho.trans && !coelho.descendo && coelho.destino === 'pufe' && !coelho.caminho.length && agora > (coelho.proximaVirada ?? 0)) {
      if (coelho.proximaVirada) {
        const L = ['sudeste', 'sudoeste', 'noroeste', 'nordeste'], i = L.indexOf(coelho.olharNoPufe ?? 'sudeste');
        coelho.olharNoPufe = L[(i + (Math.random() < 0.5 ? 1 : 3)) % 4];
      }
      coelho.proximaVirada = agora + 9000 + Math.random() * 7000;
    }
    if (coelho.aproximar) {
      const ap = coelho.aproximar, du = ap.alvo[0] - coelho.u, dv = ap.alvo[1] - coelho.v, dist = Math.hypot(du, dv), passo = 2 * dt;
      if (dist > 0.01) coelho.dir = Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 'sudoeste' : 'nordeste') : (dv > 0 ? 'sudeste' : 'noroeste');
      if (dist <= passo) { coelho.u = ap.alvo[0]; coelho.v = ap.alvo[1]; coelho.aproximar = null; ap.depois(); if (coelho.redecidir && !coelho.trans && !coelho.aproximar) { coelho.redecidir = false; decidir(); } }
      else { coelho.u += (du / dist) * passo; coelho.v += (dv / dist) * passo; }
    } else if (coelho.caminho.length) {
      const [i, j] = coelho.caminho[0], au = i + 0.5, av = j + 0.5, du = au - coelho.u, dv = av - coelho.v;
      const dist = Math.hypot(du, dv), passo = 2.5 * dt;
      coelho.dir = DIR[Math.sign(Math.round(du)) + ',' + Math.sign(Math.round(dv))] ?? coelho.dir;
      if (dist <= passo) { coelho.u = au; coelho.v = av; coelho.caminho.shift(); if (!coelho.caminho.length) chegar(); }
      else { coelho.u += (du / dist) * passo; coelho.v += (dv / dist) * passo; }
    } else if (agora > proximoPasseio) { proximoPasseio = agora + 4000 + Math.random() * 3000; passear(); }
    const t0 = performance.now();
    desenhar();
    tempoDeDesenho = performance.now() - t0;
  }, 100);
  for (const b of document.querySelectorAll('[data-estado]')) b.onclick = () => {
    estado = b.dataset.estado;
    // Quem está ausente não está falando (relato de 14/10/2026: o balão aparecia com ele dormindo).
    if (estado === 'ausente' && falando) { falando = false; bf.setAttribute('aria-pressed', 'false'); }
    for (const o of document.querySelectorAll('[data-estado]')) o.setAttribute('aria-pressed', String(o === b));
    decidir();
  };
  const bf = document.getElementById('falando');
  bf.onclick = () => { if (estado === 'ausente') return; falando = !falando; bf.setAttribute('aria-pressed', String(falando)); };


  const tela = document.getElementById('tela'), g = tela.getContext('2d');
  // Visitando, o quarto é só para olhar: o clique e a rodinha param aqui, antes de chegar aos móveis e à janela.
  for (const ev of ['pointerdown', 'wheel']) tela.addEventListener(ev, (e) => {
    if (!soVer) return;
    e.stopImmediatePropagation();
    // No salão, quem só olha ainda clica nas funções (a TV, o fliperama, a estante...).
    if (ev === 'pointerdown' && CENA === 'salao') { const f = funcaoEm(pixelDo(e)); if (f) acao(f); else comecarPan(e); }
  }, { capture: true });
  // ============================== O DESENHO EM DUAS PARTES (desempenho, 14/10/2026) ==============================
  // Medido: redesenhar o quarto inteiro a cada quadro custava ~21 ms aqui e ~92 ms num processador 4× mais lento (um
  // núcleo inteiro). Agora: a CENA (móveis, luz, profundidades) é montada uma vez e só refeita quando algo nela muda
  // (arrastar, girar, dia/noite, janela, cortina, vista, grade); a cada quadro, só a REGIÃO do coelho, da sombra e do
  // balão é recalculada e enviada à tela; e, se nada mudou (sentado parado, dormindo), o quadro nem é desenhado.
  const D = new Float32Array(W * W * 3), fundoNoite = new Float32Array(W * W * 3);
  const eMovel = new Uint8Array(W * W), acesa = new Uint8Array(W * W), peY = new Int16Array(W * W);
  const baseD = new Float32Array(W * W * 3), baseEMovel = new Uint8Array(W * W), basePeY = new Int16Array(W * W);
  const baseDono = new Array(W * W).fill(''), baseChao = new Int32Array(W * W), baseAltura = new Float32Array(W * W), baseTipo = new Int8Array(W * W), baseChave = new Float32Array(W * W);
  let imagem = null, assinaturaCena = '', assinaturaQuadro = '', regiaoAnterior = null, lista = [], variante = null;
  const unir = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const prender = (r) => [Math.max(0, Math.floor(r[0])), Math.max(0, Math.floor(r[1])), Math.min(W, Math.ceil(r[2])), Math.min(W, Math.ceil(r[3]))];
  function restaurar(r) {
    const [x0, y0, x1, y1] = prender(r);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * W + x;
      D[k * 3] = baseD[k * 3]; D[k * 3 + 1] = baseD[k * 3 + 1]; D[k * 3 + 2] = baseD[k * 3 + 2];
      eMovel[k] = baseEMovel[k]; peY[k] = basePeY[k]; dono[k] = baseDono[k]; donoObj[k] = baseDonoObj[k]; chaoPx[k] = baseChao[k]; alturaPx[k] = baseAltura[k]; tipoPx[k] = baseTipo[k]; chaveDoPixel[k] = baseChave[k];
    }
  }

  // O DESENHO DE UM MÓVEL onde ele está agora: a peça, o deslocamento na tela, a luz do lugar, o pé e a forma.
  const varianteDoPufe = () => { if (!ARR.pufe || !pufes.length) return null; const [pu, pv] = ARR.pufe.c; return pufes.reduce((a, b) => { const d = (m) => Math.hypot(centro(m.pe)[0] - pu, centro(m.pe)[1] - pv); return d(a) <= d(b) ? a : b; }); };
  // Onde um objeto está no chão (u, v): a posição dele no tampo, girada com o móvel.
  // O QUE ESTÁ EM PÉ NO TAMPO (relato de 15/10/2026: a caneca atrás do abajur saía pintada na cúpula). O objeto é
  // desenhado por cima do móvel, e visto do alto a cúpula fica sobre a metade de trás do próprio tampo: não há como
  // saber, pelo desenho, o que está na frente. Então o lugar de quem está em pé (o pé do abajur, no meio) não recebe
  // objeto: o que cair ali escorrega para a borda desse círculo. Em s, t do próprio móvel (gira com ele).
  const EM_PE = { abajur: [0.5, 0.5, 0.34] };
  function foraDoQueEstaEmPe(em, s0, t0) {
    const z = EM_PE[em];
    if (!z) return [s0, t0];
    const [zs, zt, r] = z, ds = s0 - zs, dt = t0 - zt, d = Math.hypot(ds, dt);
    if (d >= r) return [s0, t0];
    const [us, ut] = d < 1e-3 ? [Math.SQRT1_2, Math.SQRT1_2] : [ds / d, dt / d]; // no meio exato: para a frente
    return [Math.min(0.9, Math.max(0.1, zs + us * r)), Math.min(0.9, Math.max(0.1, zt + ut * r))];
  }
  function ondeEmCima(o) {
    const pe = peDe(o.em), l = ARR[o.em].lado;
    let [a, b] = foraDoQueEstaEmPe(o.em, o.s, o.t);
    for (let r = 0; r < l; r++) [a, b] = [1 - b, a];
    let u = pe[0] + a * (pe[1] - pe[0]), v = pe[2] + b * (pe[3] - pe[2]);
    // E nada ATRÁS de quem está em pé: a cúpula é larga e cobre, na tela, a metade de trás do tampo inteira. O que ficar
    // atrás da linha do pé dela vem para a frente (u + v cresce para a frente da tela, seja qual for o giro).
    if (EM_PE[o.em]) {
      const [cu, cv] = centro(pe), falta = 0.3 - (u - cu + v - cv);
      if (falta > 0) { u = Math.min(pe[1] - 0.1, u + falta / 2); v = Math.min(pe[3] - 0.1, v + falta / 2); }
    }
    return [u, v];
  }
  const comObjetosCache = new WeakMap();
  // A peça do móvel com os objetos de cima desenhados nela, e um mapa de qual objeto é cada pixel (para pegá-los).
  function itemDe(id) {
    const it = itemSemObjetos(id);
    if (!TOPOS[id] || !ARR[id]) return it;
    const meus = Object.entries(EM_CIMA).filter(([, o]) => o.em === id);
    if (!meus.length) return it;
    // de trás para a frente (o que está mais à frente no chão cobre o de trás)
    const lista = meus.map(([uid, o]) => { const [u, v] = ondeEmCima(o); return { uid, o, u, v }; }).sort((a, b) => a.u + a.v - (b.u + b.v));
    const chave = JSON.stringify([it.dx, it.dy, ARR[id].lado, lista.map((x) => [x.uid, x.o.tipo, x.o.lado, x.u.toFixed(3), x.v.toFixed(3)])]);
    let porPeca = comObjetosCache.get(it.p);
    if (!porPeca) { porPeca = new Map(); comObjetosCache.set(it.p, porPeca); }
    if (!porPeca.has(chave)) {
      if (porPeca.size > 6) porPeca.clear();
      const movel = new Uint8ClampedArray(it.p.movel), objPx = new Array(W * W).fill('');
      let [x0, y0, x1, y1] = caixaDaPeca(it.p);
      for (const { uid, o, u, v } of lista) {
        const vis = OBJ_VISTAS[o.tipo][(ARR[id].lado + o.lado) % 4], [bx, by] = vis.meioDaBase, [sx, sy] = ponto(u, v);
        const ox = Math.round(sx - TOPOS[id] * 0 - it.dx - bx), oy = Math.round(sy - TOPOS[id] - it.dy - by), [c0, r0, c1, r1] = vis.caixa;
        for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) {
          const k = (y * W + x) * 4; if (vis.movel[k + 3] < 128) continue;
          const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
          const d = (Y * W + X) * 4;
          for (let q = 0; q < 4; q++) movel[d + q] = vis.movel[k + q];
          objPx[Y * W + X] = uid;
        }
        x0 = Math.min(x0, c0 + ox); y0 = Math.min(y0, r0 + oy); x1 = Math.max(x1, c1 + ox); y1 = Math.max(y1, r1 + oy);
      }
      porPeca.set(chave, { ...it.p, movel, objPx, caixa: [Math.max(0, x0), Math.max(0, y0), Math.min(W, x1), Math.min(W, y1)] });
    }
    return { ...it, p: porPeca.get(chave) };
  }
  function itemSemObjetos(id) {
    const { c, lado: l } = ARR[id], olha = ORIENTA[l], [mx, my] = ponto(N / 2, N / 2);
    if (id === 'pufe') {
      const [pu, pv] = c, p = pecas[varianteDoPufe().id];
      const [ox, oy] = p.base, [nx, ny] = ponto(pu, pv);
      // Só intensidade: a luz do chão onde ele está, sobre a luz do chão onde ele foi pintado.
      const fator = Math.min(1.3, Math.max(0.75, luz(nx, ny) / luz(ox, oy)));
      return { p: { ...p, id: 'pufe' }, dx: Math.round(nx - ox), dy: Math.round(ny - oy), fator, pe: [pu - 0.75, pu + 0.75, pv - 0.75, pv + 0.75], forma: FORMAS.pufe };
    }
    if (noLugar(id)) { const m = pintado(id); return { p: id === 'tapete' ? tingir(pecas[id]) : pecas[id], dx: 0, dy: 0, fator: 1, pe: m.pe, deitado: m.deitado, forma: FORMAS[id], olha }; }
    if (id === 'tapete') return { p: tingir(tapeteEm(c, l)), dx: 0, dy: 0, fator: 1, pe: peDe(id), deitado: true };
    // A vista solta: a quina da frente do desenho vai para a quina da frente do pé, e a luz é a do lugar.
    const p = VISTAS[id][l], pe = peMedidoDe(id), [fx, fy] = ponto(pe[1], pe[3]), [nx, ny] = ponto(c[0], c[1]);
    const fator = Math.min(1.2, Math.max(0.8, luz(nx, ny) / luz(mx, my)));
    // Aberto: a vista aberta, posta onde a fechada estaria (o mesmo enquadramento).
    const desenho = id === 'guarda-roupa' && VISTAS_ABERTO && portas ? (portas === 3 ? VISTAS_ABERTO[l] : PASSAGEM_GR ? PASSAGEM_GR[l][portas - 1] : p) : p;
    return { p: desenho, dx: Math.round(fx - p.frente[0]), dy: Math.round(fy - p.frente[1]), fator, pe, contatoPe: pe, forma: FORMAS[id], olha };
  }
  // A caixa do desenho de uma peça (as pintadas não a trazem), guardada.
  const caixas = new WeakMap();
  function caixaDaPeca(p) {
    if (p.caixa) return p.caixa;
    if (caixas.has(p.movel)) return caixas.get(p.movel);
    let x0 = W, y0 = W, x1 = 0, y1 = 0;
    for (let k = 0; k < W * W; k++) if (p.movel[k * 4 + 3]) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const c = [x0, y0, x1 + 1, y1 + 1]; caixas.set(p.movel, c); return c;
  }
  // Onde está a lâmpada (o alto do abajur), e se a luz pintada vale: só com o criado-mudo no lugar da pintura.
  let lampadaAgora = [0, 0], telasAgora = [], caixaDaTela = null, regiaoDasFaiscas = null, luzDaJukebox = null;
  const lampada = () => lampadaAgora;
  // O criado-mudo pintado tinha falhas onde a cama antiga o tapava (relato de 14/10/2026, ao tirar a cama): ele é
  // sempre a vista solta, e a luz pintada vale com ele no lugar e na posição de origem.
  const naOrigem = (id) => Math.abs(ARR[id].c[0] - INICIAL[id].c[0]) < 0.01 && Math.abs(ARR[id].c[1] - INICIAL[id].c[1]) < 0.01 && ARR[id].lado === INICIAL[id].lado;
  const luzPintadaAgora = () => CENA === 'quarto' && modo === 'noite' && luzPintada && ARR.abajur && naOrigem('abajur');
  // A pintura da noite sem a silhueta do criado-mudo: o buraco é preenchido com a luz em volta, de fora para dentro
  // (cada pixel vira a média dos vizinhos já preenchidos), feito uma vez.
  function noiteAbajurSemMovel() {
    if (noiteLimpa) return noiteLimpa;
    const img = new Uint8ClampedArray(noiteAbajur), falta = new Uint8Array(W * W), mudou = new Uint8Array(W * W);
    img.mudou = mudou;
    for (let k = 0; k < W * W; k++) if (pecas.abajur.movel[k * 4 + 3]) falta[k] = 1;
    // quatro pixels de folga em volta (a borda do recorte tinha o contorno escuro e o brilho da cúpula)
    for (let volta = 0; volta < 4; volta++) {
      const borda = []; for (let k = W; k < W * W - W; k++) if (!falta[k]) { const x = k % W; if ((x > 0 && falta[k - 1]) || (x < W - 1 && falta[k + 1]) || falta[k - W] || falta[k + W]) borda.push(k); }
      for (const k of borda) falta[k] = 1;
    }
    for (let passada = 0, resta = 1; resta && passada < 80; passada++) {
      resta = 0; const agora = [];
      for (let k = W; k < W * W - W; k++) {
        if (!falta[k]) continue;
        let n = 0; const soma = [0, 0, 0];
        for (const v of [k - 1, k + 1, k - W, k + W]) if (!falta[v]) { n++; for (let c = 0; c < 3; c++) soma[c] += img[v * 4 + c]; }
        if (n) agora.push([k, soma.map((x) => x / n)]); else resta++;
      }
      for (const [k, cor] of agora) { for (let c = 0; c < 3; c++) img[k * 4 + c] = cor[c]; falta[k] = 0; mudou[k] = 1; }
      if (agora.length) resta = 1;
    }
    return (noiteLimpa = img);
  }
  function montarCena() {
    D.fill(0); fundoNoite.fill(0); eMovel.fill(0); acesa.fill(0); peY.fill(0); dono.fill(''); donoObj.fill('');
    const pintada = luzPintadaAgora(), fundoN = pintada ? noiteAbajur : noite;
    for (let k = 0; k < W * W; k++) for (let c = 0; c < 3; c++) { D[k * 3 + c] = base[k * 4 + c]; fundoNoite[k * 3 + c] = fundoN[k * 4 + c]; }
    // A pintura da noite com o abajur traz a silhueta do criado-mudo PINTADO; a vista solta é um pouco menor e deixava
    // um abajur fantasma por cima. Onde ele ficava, entra a noite sem ele.
    if (pintada) { const limpa = noiteAbajurSemMovel(); for (let k = 0; k < W * W; k++) if (limpa.mudou[k]) for (let c = 0; c < 3; c++) fundoNoite[k * 3 + c] = limpa[k * 4 + c]; }
    // A paisagem atrás do vidro, com um véu leve da cor do vidro (de dia, creme; de noite, azul).
    for (let k = 0; k < W * W; k++) if (vidro[k * 4 + 3] > 127) {
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        D[k * 3 + c] = daVista(vistasDia[vista], k, c) * 0.88 + [250, 243, 224][c] * 0.12;
        fundoNoite[k * 3 + c] = daVista(vistasNoite[vista], k, c) * 0.9 + [40, 46, 80][c] * 0.1;
      }
    }
    if (aberta) for (let k = 0; k < W * W; k++) {
      if (!noCaixilho[k]) continue;
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        if (vao[k]) { D[k * 3 + c] = daVista(vistasDia[vista], k, c); fundoNoite[k * 3 + c] = daVista(vistasNoite[vista], k, c); }
        // O vidro da folha aberta: ela abre para DENTRO, então atrás dele está a PAREDE, não a paisagem (relato de
        // 15/10/2026: com a vista de árvores, a folha aparecia salpicada de verde). A parede vista pelo vidro, com o
        // reflexo claro dele.
        else if (vidroAberto[k]) { D[k * 3 + c] = semDia[k * 4 + c] * 0.82 + [250, 243, 224][c] * 0.18; fundoNoite[k * 3 + c] = semNoite[k * 4 + c] * 0.85 + [40, 46, 80][c] * 0.15; }
        else { D[k * 3 + c] = abertaDia[k * 4 + c]; fundoNoite[k * 3 + c] = abertaDia[k * 4 + c] * Math.min(1, noitePe[k * 4 + c] / Math.max(1, diaPe[k * 4 + c])); }
      }
    }
    if (fechada) for (let k = 0; k < W * W; k++) {
      if (naJanela[k]) { for (let c = 0; c < 3; c++) { D[k * 3 + c] = cortinaDia[k * 4 + c]; fundoNoite[k * 3 + c] = cortinaNoite[k * 4 + c]; } }
      else if (casa[k] >= 0) { const sem = pintada ? abajurSemLuar : noiteSemLuar; for (let c = 0; c < 3; c++) fundoNoite[k * 3 + c] = sem[k * 4 + c]; }
    }
    // Os móveis, de trás para a frente (a ordem pela área no chão).
    // O móvel que está sendo arrastado ou deslizando não entra na fotografia: ele é desenhado vivo, a cada quadro.
    variante = varianteDoPufe();
    const lista0 = Object.keys(ARR).filter((id) => !(viva && viva.id === id)).map(itemDe);
    const pessoas = CENA === 'salao' ? itensDasPessoas() : [];
    lista0.push(...pessoas);
    for (const it of lista0) if (it.forma) it.caixas = caixasDe(it.pe, it.olha, it.forma);
    lista = ordenar(lista0);
    listaAgora = lista;
    chaoPx.fill(-2);
    chaveDoPixel.fill(-1);
    for (const it of lista) {
      const { p, dx, dy, fator, contato, raio, contatoPe } = it;
      const hs = alturasDe(it);
      // A sombra de contato de quem não a trouxe pintada (a poltrona): uma elipse no chão, mais escura no meio.
      const [rx, ry] = raio ?? [30, 15];
      if (contato) for (let y = Math.round(contato[1] - ry - 1); y <= contato[1] + ry + 1; y++) for (let x = Math.round(contato[0] - rx - 2); x <= contato[0] + rx + 2; x++) {
        const d = ((x - contato[0]) / rx) ** 2 + ((y - contato[1]) / ry) ** 2, k = y * W + x;
        if (d >= 1 || x < 0 || y < 0 || x >= W || y >= W || casa[k] < 0) continue;
        const f = 0.72 + 0.28 * d;
        for (let c = 0; c < 3; c++) { D[k * 3 + c] *= f; fundoNoite[k * 3 + c] *= f; }
      }
      // A SOMBRA DE CONTATO de quem não a trouxe pintada: o pé do móvel no chão, um pouco maior, mais escura por dentro.
      if (contatoPe) {
        const [u0, u1, v0, v1] = contatoPe, m = 0.14;
        // só na caixa do pé na tela (antes, a imagem inteira por móvel)
        const cs = [[u0 - m, v0 - m], [u1 + m, v0 - m], [u1 + m, v1 + m], [u0 - m, v1 + m]].map(([u, v]) => ponto(u, v));
        const qx0 = Math.max(0, Math.floor(Math.min(...cs.map((q) => q[0]))) - 1), qx1 = Math.min(W, Math.ceil(Math.max(...cs.map((q) => q[0]))) + 1);
        const qy0 = Math.max(0, Math.floor(Math.min(...cs.map((q) => q[1]))) - 1), qy1 = Math.min(W, Math.ceil(Math.max(...cs.map((q) => q[1]))) + 1);
        for (let qy = qy0; qy < qy1; qy++) for (let qx = qx0; qx < qx1; qx++) {
          const k = qy * W + qx;
          if (casa[k] < 0) continue;
          const u = mapaU[k], v = mapaV[k];
          if (u < u0 - m || u > u1 + m || v < v0 - m || v > v1 + m) continue;
          const f = u > u0 && u < u1 && v > v0 && v < v1 ? 0.74 : 0.86;
          for (let c = 0; c < 3; c++) { D[k * 3 + c] *= f; fundoNoite[k * 3 + c] *= f; }
        }
      }
      const [px0, py0, px1, py1] = caixaComSombra(p);
      for (let py = Math.max(0, py0); py < Math.min(W, py1); py++) for (let px = Math.max(0, px0); px < Math.min(W, px1); px++) {
        const k = py * W + px, x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const d = y * W + x, a = p.sombra[k * 4 + 3];
        if (a) { const f = 1 - a / 255; for (let c = 0; c < 3; c++) { D[d * 3 + c] *= f; fundoNoite[d * 3 + c] *= f; } }
        if (p.movel[k * 4 + 3]) {
          for (let c = 0; c < 3; c++) D[d * 3 + c] = p.movel[k * 4 + c] * fator;
          eMovel[d] = 1; peY[d] = p.peColuna[k % W] + dy; dono[d] = p.id; donoObj[d] = p.objPx ? p.objPx[k] : '';
          // A altura visível (da forma) dá o ponto do chão embaixo dele e a profundidade; fora da forma, o pé da coluna.
          const h = hs.h(k);
          // O que fica DEITADO (o tapete) nunca está na frente de nada: com a profundidade do próprio pixel, a borda da
          // frente dele cortava as rodinhas da cadeira (relato de 14/10/2026).
          if (it.deitado) { chaoPx[d] = y * W + x; alturaPx[d] = 0; tipoPx[d] = 0; chaveDoPixel[d] = -1; }
          else if (h >= 0) { chaoPx[d] = (y + h) * W + x; alturaPx[d] = h; tipoPx[d] = hs.tipo(k); chaveDoPixel[d] = y + h; }
          else { const pc = Math.min(W - 1, peY[d]); chaoPx[d] = pc * W + x; alturaPx[d] = pc - y; tipoPx[d] = 0; chaveDoPixel[d] = pc; }
          // A cúpula do abajur é luz: o alto da peça, nas cores claras. O abajur foi pintado APAGADO, e quem acende
          // é o código (na v1 ele veio aceso, com um halo recortado que brigava com esta luz).
          const m4 = k * 4;
          if (p.id === 'abajur' && ((k / W) | 0) < p.topo + 12 && p.movel[m4] + p.movel[m4 + 1] + p.movel[m4 + 2] > 360) acesa[d] = 1;
          // AS LUZES DA JUKEBOX (15/10/2026): os pixels claros e quentes do desenho são lâmpadas, e de noite ficam acesos
          // como estão (acesa = 2: a cor do dia, sem escurecer).
          else if (p.id === 'jukebox' && p.movel[m4] > 200 && p.movel[m4 + 1] > 130 && p.movel[m4] - p.movel[m4 + 2] > 60) acesa[d] = 2;
        }
      }
    }
    // A fotografia da cena, sem o coelho: a cada quadro, a região dele volta a ela.
    baseD.set(D); baseEMovel.set(eMovel); basePeY.set(peY); baseChao.set(chaoPx); baseAltura.set(alturaPx); baseTipo.set(tipoPx); baseChave.set(chaveDoPixel);
    for (let k = 0; k < W * W; k++) { baseDono[k] = dono[k]; baseDonoObj[k] = donoObj[k]; }
    telasAgora = [];
    for (const [id, vs] of Object.entries(TELAS_DO_MOVEL)) {
      const it = lista.find((i) => i.p.id === id);
      if (it && ARR[id] && vs[ARR[id].lado]) telasAgora.push({ id, pts: vs[ARR[id].lado].map(([x, y, s2, t2]) => [x + it.dx, y + it.dy, s2, t2]) });
    }
    caixaDaTela = telasAgora.length ? telasAgora.flatMap((t) => t.pts).reduce((c, [x, y]) => [Math.min(c[0], x - 34), Math.min(c[1], y - 34), Math.max(c[2], x + 35), Math.max(c[3], y + 35)], [W, W, 0, 0]) : null;
    // O AO VIVO, em cima da TV: quem transmite (com as setas, havendo mais de uma transmissão).
    { const e = document.getElementById('aovivo'), tv = lista.find((i) => i.p.id === 'tv');
      e.hidden = !(AO_VIVO && tv);
      if (AO_VIVO && tv) {
        const [x0, y0, x1] = caixaDaPeca(tv.p);
        e.style.left = (((x0 + x1) / 2 + tv.dx) / W) * 100 + '%'; e.style.top = ((y0 + tv.dy - 3) / W) * 100 + '%';
        const seta = (passo, txt) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = () => trocarCanal(passo); return b; };
        const meio = document.createElement('span'), selo = document.createElement('span'), nome = document.createElement('b');
        selo.className = 'selo'; selo.textContent = AO_VIVO.rotulo; nome.textContent = ' ' + AO_VIVO.nome;
        meio.append(selo, nome);
        if (AO_VIVO.sub) { const sm = document.createElement('small'); sm.textContent = AO_VIVO.sub; meio.append(sm); }
        e.replaceChildren(...(AO_VIVO.total > 1 ? [seta(-1, '‹'), meio, seta(1, '›')] : [meio]));
      } }
    { const jb = lista.find((i) => i.p.id === 'jukebox'); if (jb) { const [x0, y0, x1, y1] = caixaDaPeca(jb.p); luzDaJukebox = [(x0 + x1) / 2 + jb.dx, y0 + (y1 - y0) * 0.75 + jb.dy]; } else luzDaJukebox = null; }
    const ab = lista.find((i) => i.p.id === 'abajur');
    lampadaAgora = ab ? [ab.p.centroTopo + ab.dx, ab.p.topo + ab.dy] : [0, 0];
    pessoasNaTela = pessoas.map((it) => ({ x: it.cabeca[0], y: it.cabeca[1] + 30 }));
    if (typeof marcarForaDaVista === 'function') marcarForaDaVista();
    // os nomes, em cima de cada coelho
    { const caixa = document.getElementById('nomes'); caixa.replaceChildren(...pessoas.map((it) => { const e = document.createElement('span'); e.textContent = it.nome; e.style.left = (it.cabeca[0] / W) * 100 + '%'; e.style.top = ((it.cabeca[1] - 2) / W) * 100 + '%'; return e; })); }
    imagem = g.createImageData(W, W);
    sombraFinal.fill(0);
    passeFinal([0, 0, W, W]);
    pintarTela([0, 0, W, W]);
    document.getElementById('conceito').src = modo === 'dia' ? IMAGENS.conceitoDia : IMAGENS.conceitoNoite;
  }

  // A cor final de cada pixel de uma região: a luz da noite, a cortina, a sombra do coelho, a grade e o destino do arraste.
  function passeFinal(r) {
    const [x0, y0, x1, y1] = prender(r);
    const pintada = luzPintadaAgora(), razaoPe = pintada ? noiteAbajurPe : noitePe;
    const [lx, ly0] = lampada(), ly = ly0 + 6;
    const alvoOcupado = alvo ? ocupa(alvo) : false;
    const paAlvo = alvo && pegado && ARR[pegado] ? peDe(pegado, alvo) : null; // uma vez por quadro, e não por pixel
    // A luz da tela, de noite: o centro e a cor média, para clarear em volta.
    const brilhos = [];
    if (modo === 'noite') for (const { id, pts } of telasAgora) {
      const tipoTela = tipoDaTela(id);
      if (tipoTela === 'desligada') continue;
      let sx = 0, sy = 0; for (const [x, y] of pts) { sx += x; sy += y; }
      brilhos.push([sx / pts.length, sy / pts.length, COR_DO_BRILHO[tipoTela] ?? [140, 120, 190]]);
    }
    // a luz da jukebox, onde ela estiver (só de noite; fixa, para não redesenhar a cada quadro)
    if (modo === 'noite' && luzDaJukebox) brilhos.push([luzDaJukebox[0], luzDaJukebox[1], [230, 140, 60], 72]);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * W + x;
      const sombraAqui = sombraFinal[k];
      for (let c = 0; c < 3; c++) {
        let v = D[k * 3 + c];
        if (modo === 'noite') {
          // Com a luz pintada, os móveis só herdam a razão noite/dia (que já traz o abajur). Com a luz por código:
          // quente, caindo com a distância, em faixas como a luz é desenhada em pixel art.
          const brilho = pintada ? 0 : Math.floor(0.85 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.4) ** 2) / (2 * 85 * 85)) * 12) / 12;
          const quente = [1, 0.72, 0.42][c] * brilho;
          if (acesa[k] === 2) { /* a lâmpada da jukebox: a cor do dia */ }
          else if (acesa[k]) v = Math.min(255, v * [1.05, 0.8, 0.5][c] + [34, 14, 0][c]); // a cúpula acesa, laranja como na pintura
          // A luz de um móvel à noite é a do CHÃO no pé daquela coluna, e não a da parede atrás do pixel.
          else if (eMovel[k]) {
            const j = (Math.min(W - 1, peY[k] + 3) * W + x) * 4;
            const perto = pintada ? 0.75 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.3) ** 2) / (2 * 60 * 60)) * [1, 0.7, 0.4][c] : 0;
            v = v * Math.min(pintada ? 1.2 : 0.9, razaoPe[j + c] / Math.max(1, diaPe[j + c])) + v * (quente + perto);
          }
          else v = fundoNoite[k * 3 + c] + base[k * 4 + c] * quente;
        }
        // A luz da janela, coada pelo linho: o quarto inteiro escurece por igual.
        if (fechada && modo === 'dia') v *= 0.86;
        if (sombraAqui) v *= 1 - sombraAqui * (1 - forcaDaSombra - (modo === 'noite' ? 0.12 : 0));
        imagem.data[k * 4 + c] = Math.min(255, v);
      }
      imagem.data[k * 4 + 3] = (modo === 'dia' ? foraDia : foraNoite)[k] && !eMovel[k] ? 0 : 255;
      for (const brilhoTela of brilhos) {
        const d2 = Math.hypot(x - brilhoTela[0], (y - brilhoTela[1]) * 1.3), raio = brilhoTela[3] ?? 34;
        if (d2 < raio) { const f = Math.floor((1 - d2 / raio) * 4) / 4 * 0.32; for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = Math.min(255, imagem.data[k * 4 + c] + brilhoTela[2][c] * f); }
      }
      // O destino do arraste, pintado nas próprias casas (pixel a pixel, sem polígono suavizado).
      if (alvo && casa[k] >= 0 && !eMovel[k]) { // só no chão: por cima, desbotava o próprio móvel pego
        const i = Math.floor(casa[k] / N), j = casa[k] % N;
        const pa = paAlvo;
        if (i + 0.5 > pa[0] && i + 0.5 < pa[1] && j + 0.5 > pa[2] && j + 0.5 < pa[3]) {
          const cor = alvoOcupado ? [220, 80, 60] : [255, 240, 200];
          for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = imagem.data[k * 4 + c] * 0.65 + cor[c] * 0.35;
        }
      }
      if ((grade || alvo) && casa[k] >= 0 && !eMovel[k]) {
        const direita = x + 1 < W ? casa[k + 1] : -1, baixo = y + 1 < W ? casa[k + W] : -1;
        const cima = y > 0 ? casa[k - W] : -1;
        if ((direita !== casa[k] && direita >= 0) || (baixo !== casa[k] && baixo >= 0)) for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = Math.min(255, imagem.data[k * 4 + c] * 1.35 + 18);
        else if (cima >= 0 && cima !== casa[k]) for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] *= 0.7;
      }
    }
  }

  // Pinta o conteúdo da tela por cima da imagem (dentro da região r), só onde o pixel ainda é da mesa.
  function pintarTela(r) {
    const q = liga('telas') ? Math.floor(performance.now() / 250) : 0; // paradas: o primeiro quadro, aceso
    for (const { id, pts } of telasAgora) for (const [x, y, s2, t2] of pts) {
      if (x < r[0] || y < r[1] || x >= r[2] || y >= r[3]) continue;
      const k = y * W + x;
      if (dono[k] !== id) continue;
      const tipo = tipoDaTela(id);
      const cor = corDaTela(s2, t2, q, tipo);
      if (!cor) continue;
      // de dia, a tela é um pouco mais apagada que de noite (o sol na sala)
      const f = modo === 'noite' ? 1 : 0.92;
      for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = cor[c] * f;
    }
  }
  // Os tempos do desenho (para o teste de desempenho): a cena montada de novo, e o quadro inteiro.
  const TEMPOS = { cena: 0, nCena: 0, quadro: 0, nQuadro: 0 };
  window.temposDoTeste = () => ({ ...TEMPOS });
  function desenhar() {
    // A CENA muda? Refaz a fotografia (e a tela inteira).
    const assin = JSON.stringify([modo, luzPintada, vista, aberta, fechada, Object.keys(ARR).map((k) => (viva && viva.id === k ? 'vivo' : ARR[k])), grade, viva ? null : alvo, viva ? null : pegado, portas, CORES, EM_CIMA, PESSOAS, AO_VIVO, versaoDaImagem, viva?.id ?? null]);
    const tq0 = performance.now();
    if (assin !== assinaturaCena) { const tc = performance.now(); montarCena(); TEMPOS.cena += performance.now() - tc; TEMPOS.nCena++; assinaturaCena = assin; assinaturaQuadro = ''; regiaoAnterior = [0, 0, W, W]; }
    // O COELHO deste quadro (enche quadroBuf e a caixa dele). Se nada mudou nele, o quadro não é desenhado.
    pecaDoCoelho();
    if (CENA === 'salao') posicionarRecado();
    const caixaC = ultimaCaixa ? [ultimaCaixa[0], ultimaCaixa[1] - 18, ultimaCaixa[2], ultimaCaixa[3]] : null; // com o balão
    const vc = VISTAS_CADEIRA ? VISTAS_CADEIRA[indiceDaVista()] : null, [cgx, cgy] = ponto(cadeira.u, cadeira.v);
    const cx0 = vc ? Math.round(cgx - vc.meioDaBase[0]) : 0, cy0 = vc ? Math.round(cgy - vc.meioDaBase[1]) : 0;
    const caixaCadeira = vc ? [cx0 + vc.caixa[0] - 18, cy0 + vc.caixa[1], cx0 + vc.caixa[2] + 18, cy0 + vc.caixa[3] + 8] : null;
    const telaMexe = liga('telas') && telasAgora.some((t) => tipoDaTela(t.id) !== 'desligada');
    // O MÓVEL VIVO (arrastado ou deslizando): a peça dele onde ele está agora.
    const iv = viva ? itemDe(viva.id) : null, cxv = iv ? caixaDaPeca(iv.p) : null, contorno = [], desenhados = [];
    const caixaViva = iv ? (() => { const pe = iv.pe, cantos = [ponto(pe[0], pe[2]), ponto(pe[1], pe[2]), ponto(pe[0], pe[3]), ponto(pe[1], pe[3])];
      // EM PIXELS INTEIROS (desempenho, 15/10/2026): com os cantos do pé fracionados, o índice de cada pixel saía
      // fracionado, e o laço da sombra de contato caía no caminho lento do JavaScript (~40% do quadro do arraste) e nem
      // desenhava a sombra.
      const c = unir([cxv[0] + iv.dx - 2, cxv[1] + iv.dy - 2, cxv[2] + iv.dx + 2, cxv[3] + iv.dy + 2], [Math.min(...cantos.map((q) => q[0])) - 6, Math.min(...cantos.map((q) => q[1])) - 4, Math.max(...cantos.map((q) => q[0])) + 6, Math.max(...cantos.map((q) => q[1])) + 4]);
      return [Math.floor(c[0]), Math.floor(c[1]), Math.ceil(c[2]), Math.ceil(c[3])]; })() : null;
    const sig = JSON.stringify([ultimaCaixa, rotuloDoQuadro, coelhoChave, vc ? [cx0, cy0, indiceDaVista()] : 0, telaMexe ? Math.floor(performance.now() / 250) : 0, conteudoAgora(), iv ? [iv.dx, iv.dy, alvo] : 0, particulas.length ? performance.now() : 0]);
    const mexeu = sig !== assinaturaQuadro;
    if (!mexeu && regiaoAnterior && regiaoAnterior[2] - regiaoAnterior[0] < W) { escreverLegenda(); return; }
    // Só limpa a região de antes quando vai redesenhar: limpando e saindo, o coelho e a cadeira sumiam do mapa de quem é
    // cada pixel, e o clique na cadeira parada não a achava.
    if (regiaoAnterior) restaurar(regiaoAnterior);
    assinaturaQuadro = sig;
    if (caixaC) restaurar(caixaC);
    if (caixaCadeira) restaurar(caixaCadeira);
    if (caixaViva) restaurar(caixaViva);
    if (iv) {
      const [u0, u1, v0, v1] = iv.pe, mm = 0.14;
      // a sombra de contato no chão, e então a peça, por profundidade (o meio do pé dela)
      if (!iv.deitado) for (let y = Math.max(0, caixaViva[1]); y < Math.min(W, caixaViva[3]); y++) for (let x = Math.max(0, caixaViva[0]); x < Math.min(W, caixaViva[2]); x++) {
        const k = y * W + x; if (casa[k] < 0 || eMovel[k]) continue;
        const u = mapaU[k], v = mapaV[k];
        if (u < u0 - mm || u > u1 + mm || v < v0 - mm || v > v1 + mm) continue;
        const f = u > u0 && u < u1 && v > v0 && v < v1 ? 0.74 : 0.86; for (let c = 0; c < 3; c++) D[k * 3 + c] *= f;
      }
      const [, gy] = ponto((u0 + u1) / 2, (v0 + v1) / 2), chave = iv.deitado ? -1 : gy + 6;
      for (let y = cxv[1]; y < cxv[3]; y++) for (let x = cxv[0]; x < cxv[2]; x++) {
        const s4 = (y * W + x) * 4; if (!iv.p.movel[s4 + 3]) continue;
        const X = x + iv.dx, Y = y + iv.dy; if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const d = Y * W + X;
        if (iv.deitado ? eMovel[d] : eMovel[d] && chaveDoPixel[d] > chave) continue;
        for (let c = 0; c < 3; c++) D[d * 3 + c] = iv.p.movel[s4 + c] * iv.fator;
        VISTO[d] = 1; desenhados.push(d);
        eMovel[d] = 1; dono[d] = viva.id; donoObj[d] = iv.p.objPx ? iv.p.objPx[y * W + x] : ''; chaveDoPixel[d] = chave; peY[d] = Math.round(gy); chaoPx[d] = -1; tipoPx[d] = 0;
      }
      // O CONTORNO BRANCO do móvel pego: em volta do que APARECE dele, e nunca por cima do que está na frente (relato de
      // 15/10/2026: o contorno da poltrona atravessava a planta à frente dela).
      if (viva.modo === 'arrasto') for (let Y = cxv[1] + iv.dy - 1; Y <= cxv[3] + iv.dy; Y++) for (let X = cxv[0] + iv.dx - 1; X <= cxv[2] + iv.dx; X++) {
        if (X < 1 || Y < 1 || X >= W - 1 || Y >= W - 1) continue;
        const k = Y * W + X;
        if (VISTO[k] || !(VISTO[k - 1] || VISTO[k + 1] || VISTO[k - W] || VISTO[k + W])) continue;
        if (eMovel[k] && (iv.deitado || chaveDoPixel[k] > chave)) continue;
        contorno.push(k);
      }
      for (const d of desenhados) VISTO[d] = 0;
    }
    // A CADEIRA: a sombra de contato embaixo das rodinhas, e então ela, por profundidade (o pé dela no chão).
    if (vc) {
      for (let yy = -7; yy <= 7; yy++) for (let xx = -17; xx <= 17; xx++) {
        const dd = (xx / 17) ** 2 + (yy / 7) ** 2, X = Math.round(cgx + xx), Y = Math.round(cgy + yy);
        if (dd >= 1 || X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const k = Y * W + X;
        if (casa[k] < 0 || eMovel[k]) continue; // só no chão (sobre a mesa, ela a escurecia como se fosse vidro)
        const f = 0.7 + 0.3 * dd; for (let c = 0; c < 3; c++) D[k * 3 + c] *= f;
      }
      const chave = cgy + 4, fator = Math.min(1.2, Math.max(0.8, luz(cgx, cgy) / luz(...ponto(N / 2, N / 2))));
      for (let y = 0; y < vc.caixa[3]; y++) for (let x = vc.caixa[0]; x < vc.caixa[2]; x++) {
        const s4 = (y * W + x) * 4;
        if (!vc.movel[s4 + 3]) continue;
        const X = cx0 + x, Y = cy0 + y;
        if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const d = Y * W + X;
        if (eMovel[d] && chaveDoPixel[d] > chave) continue; // um móvel na frente dela
        for (let c = 0; c < 3; c++) D[d * 3 + c] = vc.movel[s4 + c] * fator;
        eMovel[d] = 1; dono[d] = 'cadeira'; chaveDoPixel[d] = chave; peY[d] = Math.round(cgy); chaoPx[d] = -1; tipoPx[d] = 0;
      }
    }
    // O coelho, por profundidade: o pixel dele aparece onde está mais à frente que o móvel ali.
    if (ultimaCaixa) {
      const [a0, b0, a1, b1] = ultimaCaixa;
      for (let y = Math.max(0, b0); y < Math.min(W, b1); y++) for (let x = Math.max(0, a0); x < Math.min(W, a1); x++) {
        const d = y * W + x, q = d * 4;
        if (!quadroBuf[q + 3]) continue;
        // AS PERNAS À FRENTE valem só sobre o assento e o tampo dos braços (onde ele apoia), nunca sobre o encosto nem a
        // face dos braços (relatos de 14/10/2026: o coelho "por cima do apoio", e o rabo por cima do encosto).
        const tipo = tipoPx[d], doMovel = coelhoSobre && dono[d].startsWith(coelhoSobre);
        const tampoDoBraco = tipo === 3 && alturaPx[d] >= BRACO_POLTRONA - 1;
        const pernas = doMovel && (tipo === 2 || (tipo === 3 && !tampoDoBraco)) ? 0 : Math.max(0, y - coelhoLinha) * 1.5;
        // O TAMPO DO ASSENTO nunca cobre quem está sentado nele: no pufe, de costas, o tampo da frente cortava o quadril.
        const noTampo = doMovel && tipo === 1 && alturaPx[d] >= (ASSENTO[coelhoSobre] ?? 99) - 1;
        if (dono[d] === 'cadeira' && coelhoSobre === 'cadeira') { if (cadeiraDeCostas()) continue; }
        else if (eMovel[d] && !noTampo && chaveDoPixel[d] > coelhoChave + pernas) continue; // o móvel está na frente
        for (let c = 0; c < 3; c++) D[d * 3 + c] = quadroBuf[q + c];
        eMovel[d] = 1; peY[d] = peBuf[x] >= 0 ? peBuf[x] : coelhoPe[1]; dono[d] = 'coelho'; chaoPx[d] = -1;
      }
    }
    calcularSombra();
    let caixaFaiscas = null;
    for (const q of particulas) { const t = Math.max(0, (performance.now() - q.t0) / 1000), x = q.x + q.vx * t, y = q.y + q.vy * t + 20 * t * t; caixaFaiscas = unir(caixaFaiscas, [x - 3, y - 3, x + 4, y + 4]); }
    if (particulas.length && !caixaFaiscas) caixaFaiscas = null;
    // O DESTINO DO ARRASTE (as casas clareadas embaixo do móvel pego) também é pintado aqui: sem a caixa dele na região,
    // o destino que andou deixava pedaços clareados para trás (relato de 15/10/2026, "artefatos estranhos na grade").
    let caixaDoAlvo = null;
    if (alvo && pegado && ARR[pegado]) {
      const pa = peDe(pegado, alvo), cs = [[pa[0], pa[2]], [pa[1], pa[2]], [pa[1], pa[3]], [pa[0], pa[3]]].map(([u, v]) => ponto(Math.max(0, Math.min(N, u)), Math.max(0, Math.min(N, v))));
      caixaDoAlvo = [Math.floor(Math.min(...cs.map((c) => c[0]))) - 2, Math.floor(Math.min(...cs.map((c) => c[1]))) - 2, Math.ceil(Math.max(...cs.map((c) => c[0]))) + 2, Math.ceil(Math.max(...cs.map((c) => c[1]))) + 2];
    }
    const agora = unir(unir(unir(unir(unir(unir(caixaC, caixaDaSombra), caixaCadeira), telaMexe ? caixaDaTela : null), caixaViva), caixaDoAlvo), caixaFaiscas ?? (regiaoDasFaiscas ? regiaoDasFaiscas : null));
    regiaoDasFaiscas = caixaFaiscas;
    const r = prender(unir(agora, regiaoAnterior) ?? [0, 0, W, W]);
    passeFinal(r);
    pintarTela(r);
    // o contorno branco do móvel pego e as faíscas: por cima de tudo, sem a luz da noite
    for (const k of contorno) if (k >= 0 && k < W * W) { imagem.data[k * 4] = 255; imagem.data[k * 4 + 1] = 250; imagem.data[k * 4 + 2] = 240; imagem.data[k * 4 + 3] = 255; }
    const agoraF = performance.now();
    for (const q of particulas) {
      const t = (agoraF - q.t0) / 1000; if (t < 0) continue;
      const vida = Math.min(1, (t * 1000) / q.vida), a = vida < 0.15 ? vida / 0.15 : vida < 0.6 ? 1 : 1 - (vida - 0.6) / 0.4;
      const x = Math.round(q.x + q.vx * t), y = Math.round(q.y + q.vy * t + 20 * t * t);
      for (const [ox, oy] of q.grande ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]]) {
        const X = x + ox, Y = y + oy; if (X < r[0] || Y < r[1] || X >= r[2] || Y >= r[3]) continue;
        const k = (Y * W + X) * 4, cor = ox || oy ? [255, 226, 170] : [255, 252, 240];
        for (let c = 0; c < 3; c++) imagem.data[k + c] = imagem.data[k + c] * (1 - a) + cor[c] * a;
      }
    }
    if (falando) balao(imagem.data); // falando de pé ou sentado
    g.putImageData(imagem, 0, 0, r[0], r[1], r[2] - r[0], r[3] - r[1]);
    regiaoAnterior = agora;
    TEMPOS.quadro += performance.now() - tq0; TEMPOS.nQuadro++;
    escreverLegenda();
  }
  function escreverLegenda() {
    const pf = lista.find((i) => i.p.id === 'pufe');
    document.getElementById('legenda').textContent = (ARR.poltrona ? 'Poltrona olhando para ' + ORIENTA[ARR.poltrona.lado] + '. ' : '') + 'Escolhido: ' + NOMES[selecionado] + '. ' + (variante ? 'Pufe: versão "' + variante.id.replace('pufe-', '') + '"' + (modo === 'dia' && pf ? ', luz do lugar ×' + pf.fator.toFixed(2) : '') + '. ' : '') + ' Coelho: ' + (coelho.caminho.length ? 'andando' : falando && !coelho.destino ? 'falando' : coelho.pose) + ', olhando para ' + coelho.dir + (coelho.destino ? ' (' + coelho.destino + ')' : '') + '. Desenho do quadro: ' + Math.round(tempoDeDesenho) + ' ms.';
  }

  // Arrastar: o centro do pufe salta de cruzamento em cruzamento da grade, e só para onde cabe. A grade aparece
  // enquanto se arrasta.
  const casaDoPonteiro = (e) => {
    const r = tela.getBoundingClientRect();
    const [u, v] = uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height);
    return [Math.round(u), Math.round(v)];
  };
  const pixelDo = (e) => { const r = tela.getBoundingClientRect(); return Math.floor((e.clientY - r.top) * W / r.height) * W + Math.floor((e.clientX - r.left) * W / r.width); };
  const bc = document.getElementById('cortina');
  const trocarCortina = () => { fechada = !fechada; bc.setAttribute('aria-pressed', String(fechada)); bc.textContent = 'Cortina: ' + (fechada ? 'fechada' : 'aberta'); if (!soVer) enviar(); desenhar(); };
  bc.onclick = trocarCortina;
  // Na janela, o clique é da cortina, e a mão aparece; no resto, arrasta o pufe.
  const bj = document.getElementById('janela');
  const trocarJanela = () => { aberta = !aberta; bj.setAttribute('aria-pressed', String(aberta)); bj.textContent = 'Janela: ' + (aberta ? 'aberta' : 'fechada'); if (!soVer) enviar(); desenhar(); };
  bj.onclick = trocarJanela;
  // No vidro, abre e fecha a janela; no resto da janela (as cortinas), abre e fecha as cortinas. Com as cortinas
  // fechadas, o clique é sempre delas.
  // A JANELA SE ARRASTA pelas duas paredes (pedido dele, 15/10/2026): pega-se nela e ela anda de meia em meia casa,
  // passando de uma parede para a outra pelo canto. Clicar sem arrastar faz o de antes. O tipo troca no botão.
  const btj = document.getElementById('tipo-janela');
  const botoesDaJanela = () => {
    const T = TIPOS_JANELA[JAN.tipo];
    btj.textContent = 'Tipo de janela: ' + T.nome;
    bj.disabled = !T.abre; bc.disabled = !T.cortina;
    bj.setAttribute('aria-pressed', String(aberta)); bj.textContent = 'Janela: ' + (aberta ? 'aberta' : 'fechada');
    bc.setAttribute('aria-pressed', String(fechada)); bc.textContent = 'Cortina: ' + (fechada ? 'fechada' : 'aberta');
  };
  const prenderJanela = (J) => { const [a, b] = limitesDe(J.tipo); return { ...J, v: Math.max(a, Math.min(b, J.v)) }; };
  const mudarJanela = (J, rapido) => { JAN = prenderJanela(J); aplicarJanela(rapido); assinaturaCena = ''; botoesDaJanela(); if (!rapido) { guardarJanela(); decidir(); } desenhar(); };
  btj.onclick = () => mudarJanela({ ...JAN, tipo: ORDEM_JANELAS[(ORDEM_JANELAS.indexOf(JAN.tipo) + 1) % ORDEM_JANELAS.length] });
  botoesDaJanela();
  window.janelaDoTeste = () => JAN; // para o teste
  // Em que parede o ponteiro está, e em que casa dela (v, contada do canto do fundo).
  const naParedeDo = (e) => {
    const r = tela.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
    const parede = px < W / 2 ? 'esquerda' : 'direita', x = parede === 'direita' ? px : W - 1 - px;
    return { parede, v: (x - W / 2) / KX };
  };
  let janelaPega = null;
  // ============================== AS FUNÇÕES (15/10/2026) ==============================
  // Cada função da home de hoje (Home.tsx) mora num objeto: o fone abre as salas, o quadro os amigos, a cortiça as ideias,
  // o guarda-roupa o guarda-roupa, a janela o explorar, o abajur o dia e a noite, e o computador os mini-games. No app, quem
  // diz o nome e faz a ação é o app (FUNCOES chega por mensagem); aqui, na página de teste, um botão as liga e o clique só
  // conta o que faria.
  let FUNCOES = null; // { id: { rotulo, sub } }
  const FUNCOES_DE_TESTE = CENA === 'salao'
    ? { tv: { rotulo: 'Entrar na voz', sub: '3 na chamada agora' }, fliperama: { rotulo: 'Mini-games', sub: 'Na sala de voz, com a turma' }, estante: { rotulo: 'Entrar na conversa', sub: '# geral' }, janela: { rotulo: 'Chamar alguém', sub: 'Copia o convite desta comunidade' }, balcao: { rotulo: 'Recado', sub: 'O que quem administra escreveu' }, quadro: { rotulo: 'Mudar esta tela', sub: 'Só quem administra vê este bloco' }, microfone: { rotulo: 'Karaokê', sub: 'Na sala de voz, com a turma' }, jukebox: { rotulo: 'Karaokê', sub: 'Na sala de voz, com a turma' } }
    : { fone: { rotulo: 'Salas', sub: 'Converse e jogue' }, quadro: { rotulo: 'Amigos', sub: 'Quem anda com você' }, cortica: { rotulo: 'Tem uma ideia para o Syden?' }, gavetas: { rotulo: 'Guarda-roupa', sub: 'Enfeites, sons e emojis' }, janela: { rotulo: 'Explorar', sub: 'Entrar em outra comunidade' }, abajur: { rotulo: 'Dia e noite' }, computador: { rotulo: 'Mini-games', sub: 'Jogar com a turma' } };
  // O móvel e a função dele (o guarda-roupa é a função "gavetas" da home: lá eram as gavetas da cama).
  // (no salão, as do Salao.tsx: a TV leva à voz, o fliperama aos mini-games, a estante aos canais, o balcão ao recado)
  const FUNCAO_DO_MOVEL = CENA === 'salao' ? { tv: 'tv', fliperama: 'fliperama', estante: 'estante', balcao: 'balcao', microfone: 'microfone', jukebox: 'jukebox' } : { 'guarda-roupa': 'gavetas', abajur: 'abajur', mesa: 'computador', cadeira: 'computador' };
  const rotulo = document.getElementById('rotulo');
  function funcaoEm(k) {
    // No salão, quem não administra só olha a arrumação, mas USA o salão: as funções valem para todo mundo.
    if (!FUNCOES || (soVer && CENA !== 'salao')) return null;
    const ip = naParede[k];
    if (ip && !dono[k]) { const f = ITENS_PAREDE[ordemDaParede[ip - 1]].funcao; return f && FUNCOES[f] ? f : null; }
    if (dono[k]) { const f = FUNCAO_DO_MOVEL[dono[k]]; return f && FUNCOES[f] ? f : null; }
    if (naJanela[k] && (vidro[k * 4 + 3] > 127 || noCaixilho[k]) && FUNCOES.janela) return 'janela';
    return null;
  }
  function acao(f) {
    // O balcão abre e fecha o recado, aqui mesmo (o balão é da página).
    if (f === 'balcao' && CENA === 'salao' && RECADO) { if (recadoAberto) { recadoAberto = false; contarLeitura = false; clearTimeout(fimDoRecado); posicionarRecado(true); } else abrirRecado(); return; }
    if (window.parent !== window && MODO_APP) { window.parent.postMessage({ syden: 'quarto', acao: f }, location.origin); return; }
    document.getElementById('acao-teste').textContent = 'No app, abriria: ' + FUNCOES[f].rotulo + (FUNCOES[f].sub ? ' (' + FUNCOES[f].sub + ')' : '') + '.';
    if (f === 'abajur') botoes[modo === 'dia' ? 'noite' : 'dia'].click(); // aqui, o próprio quarto troca
  }
  const bFuncoes = document.getElementById('funcoes');
  bFuncoes.onclick = () => { FUNCOES = FUNCOES ? null : FUNCOES_DE_TESTE; bFuncoes.setAttribute('aria-pressed', String(!!FUNCOES)); bFuncoes.textContent = 'Funções do app: ' + (FUNCOES ? 'ligadas' : 'desligadas'); };
  tela.addEventListener('pointermove', (e) => {
    const f = arrastando || paredePega || janelaPega ? null : funcaoEm(pixelDo(e));
    rotulo.hidden = !f;
    if (soVer) tela.style.cursor = f ? 'pointer' : 'default';
    if (f) {
      const r = tela.getBoundingClientRect(), rf = rotulo.parentElement.getBoundingClientRect();
      rotulo.style.left = e.clientX - rf.left + 'px'; rotulo.style.top = e.clientY - rf.top + 'px';
      rotulo.innerHTML = ''; rotulo.append(FUNCOES[f].rotulo);
      if (FUNCOES[f].sub) { const sm = document.createElement('small'); sm.textContent = FUNCOES[f].sub; rotulo.append(sm); }
      void r;
    }
  });
  tela.addEventListener('pointerleave', () => { rotulo.hidden = true; });

  // ============================== OS OBJETOS DE CIMA: pegar, levar, girar, pôr e guardar ==============================
  // Pego, ele vai para o tampo sob o ponteiro (de qualquer móvel que receba objetos); solto fora de todo tampo, ele é
  // guardado. Seguro, a rodinha (ou o R) o gira.
  let objPego = null;
  const guardarObjetos = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'objetos', JSON.stringify(EM_CIMA)); } catch { /* fica só nesta visita */ } enviar(); };
  function tampoDoPonteiro(e, mao = [0, 0]) {
    const r = tela.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width - mao[0], y = (e.clientY - r.top) * W / r.height - mao[1];
    let melhor = null;
    for (const id of Object.keys(TOPOS)) {
      if (!ARR[id]) continue;
      const [u, v] = uvDe(x, y + TOPOS[id]), pe = peDe(id);
      if (u < pe[0] || u > pe[1] || v < pe[2] || v > pe[3]) continue;
      let a = (u - pe[0]) / (pe[1] - pe[0]), b = (v - pe[2]) / (pe[3] - pe[2]);
      for (let k = 0; k < ARR[id].lado; k++) [a, b] = [b, 1 - a]; // o avesso do giro de ondeEmCima
      const [s2, t2] = foraDoQueEstaEmPe(id, Math.min(0.9, Math.max(0.1, a)), Math.min(0.9, Math.max(0.1, b)));
      const cand = { em: id, s: s2, t: t2, alto: TOPOS[id] };
      if (!melhor || cand.alto > melhor.alto) melhor = cand;
    }
    return melhor;
  }
  tela.addEventListener('pointermove', (e) => {
    if (!objPego) return;
    if (!objPego.mexeu && Math.hypot(e.clientX - objPego.x, e.clientY - objPego.y) < 6) return;
    objPego.mexeu = true;
    const tp = tampoDoPonteiro(e, objPego.mao), o = EM_CIMA[objPego.uid];
    objPego.fora = !tp; objPego.k = pixelDo(e);
    if (tp && (tp.em !== o.em || Math.abs(tp.s - o.s) > 0.01 || Math.abs(tp.t - o.t) > 0.01)) { EM_CIMA = { ...EM_CIMA, [objPego.uid]: { ...o, em: tp.em, s: +tp.s.toFixed(3), t: +tp.t.toFixed(3) } }; desenhar(); }
  });
  tela.addEventListener('pointerup', () => {
    if (!objPego) return;
    const { uid, mexeu, fora, antes, k } = objPego;
    objPego = null;
    // Solto fora de qualquer tampo: DENTRO da sala, volta para onde estava (soltar no chão sem querer não some com ele);
    // FORA da sala (no fundo em volta), é guardado.
    if (mexeu && fora) {
      const naSala = k >= 0 && !(modo === 'dia' ? foraDia : foraNoite)[k];
      if (naSala) EM_CIMA = { ...EM_CIMA, [uid]: antes };
      else { const { [uid]: _fora, ...resto } = EM_CIMA; EM_CIMA = resto; }
    }
    guardarObjetos(); desenhar();
  });
  // Pôr um objeto: no último móvel tocado, se ele recebe objetos (senão na mesa), no primeiro lugar livre do tampo.
  function porObjeto(tipo) {
    const em = TOPOS[selecionado] && ARR[selecionado] ? selecionado : Object.keys(TOPOS).find((id) => ARR[id]);
    if (!em) return;
    const outros = Object.values(EM_CIMA).filter((o) => o.em === em);
    let lugar = [0.5, 0.5];
    for (const s2 of [0.25, 0.5, 0.75]) for (const t2 of [0.25, 0.5, 0.75]) if (outros.every((o) => Math.hypot(o.s - s2, o.t - t2) > 0.3)) { lugar = [s2, t2]; break; }
    EM_CIMA = { ...EM_CIMA, ['o' + Date.now().toString(36)]: { tipo, em, s: lugar[0], t: lugar[1], lado: 0 } };
    guardarObjetos(); desenhar();
  }
  {
    const caixa = document.getElementById('objetos-de-cima');
    caixa.replaceChildren(...Object.entries(OBJETOS_DE_CIMA).map(([id, it]) => { const b = document.createElement('button'); b.textContent = 'Pôr ' + it.nome; b.onclick = () => { if (!soVer) porObjeto(id); }; return b; }));
  }
  window.objetosDoTeste = () => EM_CIMA; // para o teste

  // ============================== OS OBJETOS DA PAREDE: arrastar, pôr e guardar ==============================
  // Pegos como a janela, andam pelas duas paredes e também sobem e descem. Clicar sem arrastar faz a função.
  const mudarParede = (id, P, rapido) => { if (P) NA_PAREDE[id] = prenderNaParede(id, P); aplicarJanela(rapido); assinaturaCena = ''; if (!rapido) { guardarParede(); botoesDaParede(); } desenhar(); };
  let paredePega = null;
  tela.addEventListener('pointerdown', (e) => {
    const k = pixelDo(e), ip = naParede[k];
    if (!ip || dono[k]) return;
    const id = ordemDaParede[ip - 1];
    paredePega = { id, k, x: e.clientX, y: e.clientY, mexeu: false, P0: { ...NA_PAREDE[id] }, p0: naParedeDo(e) };
    tela.setPointerCapture(e.pointerId);
    e.stopImmediatePropagation(); // na frente da janela: a janela e os móveis não pegam este clique
  });
  tela.addEventListener('pointermove', (e) => {
    if (!paredePega) return;
    if (!paredePega.mexeu && Math.hypot(e.clientX - paredePega.x, e.clientY - paredePega.y) < 6) return;
    paredePega.mexeu = true;
    const r = tela.getBoundingClientRect(), esc = W / r.height;
    const p = naParedeDo(e), { P0, p0, id } = paredePega, it = ITENS_PAREDE[id], meio = (it.ocupa[0] + it.ocupa[1]) / 2;
    // Ao longo da parede, o que o ponteiro andou; trocando de parede, o meio do objeto vai para o ponteiro.
    const v = p.parede === P0.parede ? P0.v + (p.v - p0.v) : p.v - meio;
    const dv = p.parede === P0.parede ? p.v - p0.v : 0;
    // Subir: o que o ponteiro subiu na tela, menos o que a própria parede sobe ao andar nela (14,25 px por casa).
    const h = P0.h - ((e.clientY - paredePega.y) * esc - 14.25 * dv);
    const novo = prenderNaParede(id, { parede: p.parede, v: Math.round(v * 10) / 10, h: Math.round(h) });
    const atual = NA_PAREDE[id];
    if (novo.parede !== atual.parede || novo.v !== atual.v || novo.h !== atual.h) mudarParede(id, novo, true);
  });
  tela.addEventListener('pointerup', () => {
    if (!paredePega) return;
    const { id, mexeu } = paredePega;
    paredePega = null;
    if (mexeu) { mudarParede(id, NA_PAREDE[id]); return; }
    const f = ITENS_PAREDE[id].funcao;
    if (FUNCOES && f && FUNCOES[f]) acao(f);
  });
  // Pôr e guardar: um botão por objeto. Posto, ele vai para o primeiro lugar livre (sem cobrir outro objeto nem a janela).
  const livreNaParede = (id, P) => {
    const it = ITENS_PAREDE[id], a = [P.v + it.ocupa[0], P.v + it.ocupa[1]], al = [P.h + it.alto[0], P.h + it.alto[1]];
    const cruza = (x, y) => x[0] < y[1] && y[0] < x[1];
    if (JAN.parede === P.parede) { const o = TIPOS_JANELA[JAN.tipo].ocupa; if (cruza(a, [o[0] + JAN.v, o[1] + JAN.v])) return false; }
    return Object.entries(NA_PAREDE).every(([o, Q]) => o === id || Q.parede !== P.parede || !cruza(a, [Q.v + ITENS_PAREDE[o].ocupa[0], Q.v + ITENS_PAREDE[o].ocupa[1]]) || !cruza(al, [Q.h + ITENS_PAREDE[o].alto[0], Q.h + ITENS_PAREDE[o].alto[1]]));
  };
  function botoesDaParede() {
    const caixa = document.getElementById('enfeites');
    caixa.replaceChildren(...Object.entries(ITENS_PAREDE).map(([id, it]) => {
      const b = document.createElement('button');
      b.textContent = (it.nome[0].toUpperCase() + it.nome.slice(1)) + ': ' + (NA_PAREDE[id] ? 'na parede' : 'guardado');
      b.setAttribute('aria-pressed', String(!!NA_PAREDE[id]));
      b.disabled = soVer;
      b.onclick = () => alternarNaParede(id);
      return b;
    }));
  }
  // Pôr e guardar um objeto da parede (os botões daqui e a barra de arrumar do app).
  function alternarNaParede(id) {
    const it = ITENS_PAREDE[id];
    if (NA_PAREDE[id]) { delete NA_PAREDE[id]; mudarParede(id, null); return; }
    let lugar = null;
    // (de cima para baixo e de meia em meia casa: dois objetos baixos cabem um em cima do outro)
    for (const parede of ['esquerda', 'direita']) for (let h = 190 - it.alto[1]; h >= 30 - it.alto[0] && !lugar; h -= 8) for (let v = -it.ocupa[0]; v <= N - it.ocupa[1] && !lugar; v += 0.25) { const P = prenderNaParede(id, { parede, v, h }); if (livreNaParede(id, P)) lugar = P; }
    // Parede cheia: onde ele cobre menos dos outros (e nunca a janela).
    if (!lugar) {
      let menor = Infinity;
      for (const parede of ['esquerda', 'direita']) for (let h = 190 - it.alto[1]; h >= 30 - it.alto[0]; h -= 8) for (let v = -it.ocupa[0]; v <= N - it.ocupa[1]; v += 0.25) {
        const P = prenderNaParede(id, { parede, v, h }), a = [P.v + it.ocupa[0], P.v + it.ocupa[1]], al = [P.h + it.alto[0], P.h + it.alto[1]];
        const sobra = (x, y) => Math.max(0, Math.min(x[1], y[1]) - Math.max(x[0], y[0]));
        if (JAN.parede === parede && sobra(a, TIPOS_JANELA[JAN.tipo].ocupa.map((o) => o + JAN.v)) > 0) continue;
        const custo = Object.entries(NA_PAREDE).reduce((t, [o, Q]) => t + (o === id || Q.parede !== parede ? 0 : sobra(a, [Q.v + ITENS_PAREDE[o].ocupa[0], Q.v + ITENS_PAREDE[o].ocupa[1]]) * sobra(al, [Q.h + ITENS_PAREDE[o].alto[0], Q.h + ITENS_PAREDE[o].alto[1]])), 0);
        if (custo < menor) { menor = custo; lugar = P; }
      }
    }
    mudarParede(id, lugar ?? prenderNaParede(id, { parede: 'esquerda', v: 0, h: 0 }));
  }
  botoesDaParede();
  window.paredeDoTeste = () => NA_PAREDE; // para o teste
  const bct = document.getElementById('cor-tapete'), ORDEM_CORES = Object.keys(CORES_DO_TAPETE);
  const botaoDaCor = () => { bct.textContent = 'Cor do tapete: ' + CORES_DO_TAPETE[CORES.tapete ?? 'salvia'].nome; bct.disabled = soVer; };
  bct.onclick = () => { CORES = { ...CORES, tapete: ORDEM_CORES[(ORDEM_CORES.indexOf(CORES.tapete ?? 'salvia') + 1) % ORDEM_CORES.length] }; guardarCores(); botaoDaCor(); desenhar(); };
  botaoDaCor();
  window.ondeDoMovel = (id) => { let sx = 0, sy = 0, n = 0; for (let k = 0; k < W * W; k++) if (dono[k] === id) { sx += k % W; sy += (k / W) | 0; n++; } return n ? [sx / n, sy / n] : null; }; // para o teste
  window.ondeNaParede = (id) => { const i = ordemDaParede.indexOf(id) + 1; let sx = 0, sy = 0, n = 0; for (let k = 0; k < W * W; k++) if (naParede[k] === i && !dono[k]) { sx += k % W; sy += (k / W) | 0; n++; } return n ? [sx / n, sy / n] : null; }; // para o teste

  tela.addEventListener('pointerdown', (e) => {
    const k = pixelDo(e);
    if (!naJanela[k] || dono[k]) return;
    const T = TIPOS_JANELA[JAN.tipo], meio = (T.ocupa[0] + T.ocupa[1]) / 2, p = naParedeDo(e);
    janelaPega = { k, x: e.clientX, y: e.clientY, mexeu: false, delta: p.parede === JAN.parede ? p.v - (JAN.v + meio) : 0, meio };
    tela.setPointerCapture(e.pointerId);
  });
  tela.addEventListener('pointermove', (e) => {
    if (janelaPega) {
      if (!janelaPega.mexeu && Math.hypot(e.clientX - janelaPega.x, e.clientY - janelaPega.y) < 6) return;
      janelaPega.mexeu = true;
      const p = naParedeDo(e), delta = p.parede === JAN.parede ? janelaPega.delta : 0;
      const nova = prenderJanela({ ...JAN, parede: p.parede, v: Math.round((p.v - delta - janelaPega.meio) * 2) / 2 });
      if (nova.parede !== JAN.parede || nova.v !== JAN.v) { if (nova.parede !== JAN.parede) janelaPega.delta = 0; mudarJanela(nova, true); }
      return;
    }
    if (!arrastando) { const k = pixelDo(e); tela.style.cursor = naJanela[k] && !dono[k] ? 'pointer' : 'grab'; }
  });
  tela.addEventListener('pointerup', () => {
    if (!janelaPega) return;
    const { k, mexeu } = janelaPega, T = TIPOS_JANELA[JAN.tipo];
    janelaPega = null;
    if (mexeu) { mudarJanela(JAN); return; }
    // No vidro, abre e fecha a janela; no resto da janela (as cortinas), abre e fecha as cortinas. Com as cortinas
    // fechadas, o clique é sempre delas.
    if (funcaoEm(k) === 'janela') { acao('janela'); return; }
    if (T.abre && noCaixilho[k] && !fechada) trocarJanela(); else if (T.cortina) trocarCortina();
  });
  // ARRASTA-SE O MÓVEL SOB O PONTEIRO (qualquer um; o tapete por baixo de tudo). O centro anda de casa em casa e só
  // fica onde cabe. Clicar sem arrastar leva o coelho até ele (se ele tiver o que fazer ali).
  const uvDoPonteiro = (e) => { const r = tela.getBoundingClientRect(); return uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height); };
  let pegaDelta = [0, 0], inicioDoArraste = [0, 0], amostras = [];
  // A cadeira saiu da frente do móvel arrastado? (colidir sem acordar à toa)
  const colidirQuieto = () => { const a = [cadeira.u, cadeira.v]; colidir(); return Math.hypot(cadeira.u - a[0], cadeira.v - a[1]) > 1e-4; };
  const bgirar = document.getElementById('girar');
  const escolher = (id) => { selecionado = id; bgirar.textContent = 'Girar ' + NOMES[id]; bgirar.disabled = id === 'pufe'; };
  tela.addEventListener('pointerdown', (e) => {
    // Um OBJETO DE CIMA sob o ponteiro: pega-se ele, e não o móvel embaixo.
    const uo = donoObj[pixelDo(e)];
    if (uo && EM_CIMA[uo]) {
      // A MÃO e a BASE do objeto (relato de 15/10/2026: o suco sumia ao arrastar uns pixels para trás): o tampo é o da
      // base, e a mão pega no meio do copo, acima dela. Guarda-se a distância entre as duas, e ela vale o arraste todo.
      const o = EM_CIMA[uo], [ub, vb] = ondeEmCima(o), [bx, by] = ponto(ub, vb), r = tela.getBoundingClientRect();
      const mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * W / r.height;
      objPego = { uid: uo, x: e.clientX, y: e.clientY, mexeu: false, antes: { ...o }, mao: [mx - bx, my - (by - TOPOS[o.em])] };
      tela.setPointerCapture(e.pointerId); return;
    }
    if (naJanela[pixelDo(e)] && !dono[pixelDo(e)]) return;
    const d = dono[pixelDo(e)];
    if (d === 'cadeira') {
      if (coelho.destino === 'cadeira') return; // com ele sentado (ou indo sentar), ela fica
      const [u, v] = uvDoPonteiro(e);
      cadeira.presa = true; cadeira.kin = null; escolher('cadeira'); pegaDelta = [cadeira.u - u, cadeira.v - v]; cadeira.alvo = [cadeira.u, cadeira.v]; amostras = [[performance.now(), u, v]];
      tela.setPointerCapture(e.pointerId); acordarCadeira();
      return;
    }
    if (!ARR[d] || viva) return;
    pegado = d; escolher(d);
    const [u, v] = uvDoPonteiro(e);
    pegaDelta = [ARR[d].c[0] - u, ARR[d].c[1] - v]; inicioDoArraste = [u, v]; amostras = [[performance.now(), u, v]];
    arrastando = true; tela.setPointerCapture(e.pointerId); alvo = [...ARR[d].c];
    // SEGURAR É POSICIONAR (pedido dele, 15/10/2026): o contorno aparece já, e é só com ele que a rodinha e o R giram.
    // Soltar sem ter andado nem girado é um clique.
    viva = { id: d, orig: [...ARR[d].c], modo: 'arrasto', vu: 0, vv: 0, parado: true };
    desenhar();
  });
  tela.addEventListener('pointermove', (e) => {
    if (cadeira.presa) {
      const [u, v] = uvDoPonteiro(e), agoraT = performance.now();
      // A CADEIRA GIRA COM A FORÇA DO PONTEIRO: puxada pelo encosto (longe do meio) para o lado, ela gira mais; pelo
      // meio, quase nada. É o torque: a distância do meio vezes a velocidade de lado.
      const ant = amostras[amostras.length - 1];
      if (ant) {
        const dtp = Math.max(0.008, (agoraT - ant[0]) / 1000), vu = (u - ant[1]) / dtp, vv = (v - ant[2]) / dtp;
        const ru = u - cadeira.u, rv = v - cadeira.v, torque = ru * vv - rv * vu;
        cadeira.w = Math.max(-14, Math.min(14, cadeira.w * 0.7 + torque * 2.2 * 0.3));
      }
      amostras.push([agoraT, u, v]); amostras = amostras.filter((a) => agoraT - a[0] < 120);
      cadeira.alvo = [u + pegaDelta[0], v + pegaDelta[1]];
      return;
    }
    if (!arrastando) return;
    const [u, v] = uvDoPonteiro(e), agoraT = performance.now();
    amostras.push([agoraT, u, v]); amostras = amostras.filter((a) => agoraT - a[0] < 120);
    // Só vira arraste depois de andar um pouco: um clique leva o coelho até o móvel.
    if (viva?.parado && Math.hypot(u - inicioDoArraste[0], v - inicioDoArraste[1]) < 0.15) return;
    if (!viva) viva = { id: pegado, orig: [...ARR[pegado].c], modo: 'arrasto', vu: 0, vv: 0 };
    viva.parado = false;
    const [tu, tv] = tamDe(pegado, ARR[pegado].lado);
    ARR[pegado].c = [Math.max(tu / 2, Math.min(N - tu / 2, u + pegaDelta[0])), Math.max(tv / 2, Math.min(N - tv / 2, v + pegaDelta[1]))];
    alvo = encaixar(pegado, ...ARR[pegado].c, ARR[pegado].lado);
    if (colidirQuieto()) acordarCadeira(); // empurra a cadeira
    desenhar();
  });
  tela.addEventListener('pointerup', () => {
    // Soltou a cadeira: ela segue com a velocidade que tinha (jogada), e gira um pouco.
    if (cadeira.presa) {
      cadeira.presa = false; cadeira.alvo = null;
      const vel = Math.hypot(cadeira.vu, cadeira.vv), max = 7;
      if (vel > max) { cadeira.vu *= max / vel; cadeira.vv *= max / vel; }
      acordarCadeira();
      return;
    }
    if (!arrastando) return;
    arrastando = false;
    if (viva?.parado && !viva.girou) { viva = null; } // não andou nem girou: um clique
    if (!viva) { // clicou sem arrastar
      const f = FUNCOES && !soVer ? FUNCAO_DO_MOVEL[pegado] : null;
      if (f && FUNCOES[f] && f !== 'gavetas') acao(f); // o guarda-roupa conta a função quando as portas abrem
      if (CENA === 'salao' && f) { alvo = null; pegado = null; desenhar(); return; } // no salão o coelho do recado não sai do balcão
      if (f === 'abajur' && FUNCOES?.abajur) { /* o abajur só troca a luz */ }
      else if (pegado === 'guarda-roupa' && guardaRoupaAberto) guardaRoupaAberto = false;
      else if (pontos()[pegado]) ir(pegado);
      alvo = null; pegado = null; desenhar();
      return;
    }
    // SOLTOU: a velocidade dos últimos instantes do ponteiro, dividida pelo peso.
    const a0 = amostras[0], a1 = amostras[amostras.length - 1], dtp = a1 && a0 ? Math.max(0.016, (a1[0] - a0[0]) / 1000) : 1;
    const vu = a0 ? (a1[1] - a0[1]) / dtp : 0, vv = a0 ? (a1[2] - a0[2]) / dtp : 0, peso = PESO[viva.id] ?? 5, leva = 2 / (1 + peso);
    viva.vu = Math.max(-8, Math.min(8, vu * leva)); viva.vv = Math.max(-8, Math.min(8, vv * leva));
    if (Math.hypot(viva.vu, viva.vv) > 0.6 && !ehDeitado(viva.id)) { viva.modo = 'deslize'; acordarCadeira(); }
    else encaixarVivo();
  });
  // GIRAR o móvel escolhido (o último que se tocou): a próxima das 4 posições. Se ele não couber girado ali, tenta a
  // seguinte; não cabendo em nenhuma, fica como está.
  const girar = () => {
    if (selecionado === 'cadeira') { levarCadeira([cadeira.u, cadeira.v], cadeira.th + Math.PI / 4, 250); return; }
    const id = selecionado;
    if (id === 'pufe') return;
    for (let passo = 1; passo < 4; passo++) {
      const lado = (ARR[id].lado + passo) % 4, c = noLugar(id) ? encaixar(id, ...ARR[id].c, lado) : encaixar(id, ...ARR[id].c, lado);
      if (!ocupa(c, id, lado)) { ARR[id] = { c, lado }; guardar(); decidir(); desenhar(); return; }
    }
  };
  bgirar.onclick = girar;
  let ultimaRodinha = 0;
  // A RODINHA E O R GIRAM SÓ O QUE ESTÁ SEGURO (pedido dele, 15/10/2026: passar por cima e rodar girava o móvel sem
  // querer). O móvel pego gira na hora, ali mesmo, e ao soltar ele encaixa na casa livre mais perto; o objeto de cima
  // gira no tampo; a cadeira segura gira com a força da rodinha.
  window.donoDoPixel = (x, y) => ({ dono: dono[y * W + x], obj: donoObj[y * W + x] }); // para o teste
  window.pixelDe = (id) => { let m = null; for (let k = 0; k < W * W; k++) if (dono[k] === id) { m = k; break; } return m === null ? null : [m % W, ((m / W) | 0) + 4]; }; // para o teste
  window.seguradoDoTeste = () => ({ arrastando, viva: viva && { ...viva }, pegado, objPego }); // para o teste
  function girarSegurado(sentido) {
    if (objPego) { const o = EM_CIMA[objPego.uid]; EM_CIMA = { ...EM_CIMA, [objPego.uid]: { ...o, lado: (o.lado + (sentido > 0 ? 1 : 3)) % 4 } }; objPego.girou = true; guardarObjetos(); desenhar(); return true; }
    if (arrastando && viva && viva.modo === 'arrasto' && viva.id !== 'pufe') {
      const id = viva.id, lado = (ARR[id].lado + (sentido > 0 ? 1 : 3)) % 4;
      ARR[id] = { c: [...ARR[id].c], lado }; alvo = encaixar(id, ...ARR[id].c, lado); viva.girou = true; desenhar(); return true;
    }
    return false;
  }
  tela.addEventListener('wheel', (e) => {
    if (cadeira.presa) { e.preventDefault(); cadeira.kin = null; cadeira.w = Math.max(-18, Math.min(18, cadeira.w - e.deltaY * 0.02)); acordarCadeira(); return; }
    if (!objPego && !(arrastando && viva)) return;
    e.preventDefault();
    if (performance.now() - ultimaRodinha < 180) return;
    ultimaRodinha = performance.now(); girarSegurado(e.deltaY);
  }, { passive: false });
  document.addEventListener('keydown', (e) => { if (!soVer && (e.key === 'r' || e.key === 'R')) girarSegurado(e.shiftKey ? -1 : 1); });
  document.getElementById('inicial').onclick = () => { ARR = JSON.parse(JSON.stringify(INICIAL)); guardar(); NA_PAREDE = JSON.parse(JSON.stringify(PAREDE_INICIAL)); guardarParede(); CORES = {}; guardarCores(); botaoDaCor(); EM_CIMA = EM_CIMA_INICIAL(); guardarObjetos(); botoesDaParede(); mudarJanela({ ...JANELA_INICIAL }); };
  escolher('poltrona');
  const btela = document.getElementById('tela-pc'), NOMES_TELA = { auto: 'automática', call: 'em call', conversa: 'conversa', jogo: 'jogo', desligada: 'desligada' };
  btela.onclick = () => { conteudo = CONTEUDOS[(CONTEUDOS.indexOf(conteudo) + 1) % CONTEUDOS.length]; btela.textContent = 'Tela: ' + NOMES_TELA[conteudo]; assinaturaCena = ''; desenhar(); };
  iniciarCadeira();
  const botoes = { dia: document.getElementById('dia'), noite: document.getElementById('noite') };
  for (const [m, b] of Object.entries(botoes)) b.onclick = () => { modo = m; for (const [n, o] of Object.entries(botoes)) o.setAttribute('aria-pressed', String(n === m)); decidir(); desenhar(); };
  const bg = document.getElementById('grade');
  bg.onclick = () => { grade = !grade; bg.setAttribute('aria-pressed', String(grade)); desenhar(); };
  const bv = document.getElementById('vista');
  bv.onclick = () => { vista = (vista + 1) % 4; bv.textContent = 'Vista: ' + (vista + 1); enviar(); desenhar(); };
  const bl = document.getElementById('luz');
  bl.onclick = () => { luzPintada = !luzPintada; bl.setAttribute('aria-pressed', String(luzPintada)); bl.textContent = 'Luz do abajur à noite: ' + (luzPintada ? 'pintada' : 'por código'); desenhar(); };

  // ============================== A CONTA E A VISITA (15/10/2026) ==============================
  // O que o servidor guarda (server/src/quarto.ts): posições e códigos, nada de desenho.
  const retrato = () => ({
    moveis: Object.fromEntries(Object.entries(ARR).map(([id, m]) => [id, { c: [+m.c[0].toFixed(3), +m.c[1].toFixed(3)], lado: m.lado }])),
    cadeira: { u: +cadeira.u.toFixed(3), v: +cadeira.v.toFixed(3), th: +cadeira.th.toFixed(3) },
    janela: { ...JAN }, cortina: fechada, janelaAberta: aberta, vista,
    cores: { ...CORES },
    emCima: Object.fromEntries(Object.entries(EM_CIMA).map(([uid, o]) => [uid, { tipo: o.tipo, em: o.em, s: +o.s.toFixed(3), t: +o.t.toFixed(3), lado: o.lado }])),
    parede: Object.fromEntries(Object.entries(NA_PAREDE).map(([id, P]) => [id, { parede: P.parede, v: +P.v.toFixed(2), h: Math.round(P.h) }])),
  });
  // Põe no quarto uma arrumação (a guardada, ou a de quem se visita). Móvel que o quarto não conhece fica de fora; o que
  // falta nela fica onde está na de fábrica.
  function vestir(a) {
    const novo = JSON.parse(JSON.stringify(INICIAL));
    for (const [id, m] of Object.entries(a.moveis ?? {})) if (novo[id] && Array.isArray(m.c)) novo[id] = { c: [m.c[0], m.c[1]], lado: m.lado };
    ARR = novo;
    if (a.cadeira) { Object.assign(cadeira, { u: a.cadeira.u, v: a.cadeira.v, th: a.cadeira.th, vu: 0, vv: 0, w: 0, kin: null }); }
    JAN = a.janela && TIPOS_JANELA[a.janela.tipo] ? prenderJanela(a.janela) : { ...JANELA_INICIAL };
    EM_CIMA = a.emCima && typeof a.emCima === 'object' ? Object.fromEntries(Object.entries(a.emCima).filter(([, o]) => OBJ_VISTAS[o.tipo] && TOPOS[o.em] && ARR[o.em])) : EM_CIMA_INICIAL();
    CORES = a.cores && typeof a.cores === 'object' ? Object.fromEntries(Object.entries(a.cores).filter(([id, c]) => id === 'tapete' && CORES_DO_TAPETE[c])) : {};
    botaoDaCor();
    NA_PAREDE = a.parede ? Object.fromEntries(Object.entries(a.parede).filter(([id]) => ITENS_PAREDE[id]).map(([id, P]) => [id, prenderNaParede(id, P)])) : JSON.parse(JSON.stringify(PAREDE_INICIAL));
    aplicarJanela();
    fechada = !!a.cortina && !!TIPOS_JANELA[JAN.tipo].cortina; aberta = !!a.janelaAberta && !!TIPOS_JANELA[JAN.tipo].abre;
    if (Number.isInteger(a.vista)) { vista = a.vista % 4; bv.textContent = 'Vista: ' + (vista + 1); }
    botoesDaJanela(); botoesDaParede();
    assinaturaCena = ''; decidir(); desenhar();
  }
  const campo = (id) => document.getElementById(id);
  let conta = null; // { api, token, nome, id }
  // Onde a arrumação mora: o quarto é de cada um (/api/quarto); o salão, da comunidade (o app manda a rota dela).
  let ROTA = '/api/quarto';
  try { conta = JSON.parse(localStorage.getItem('syden-teste-conta') ?? 'null'); } catch { /* sem conta */ }
  const pedir = async (metodo, rota, corpo) => {
    const r = await fetch(conta.api + rota, { method: metodo, headers: { authorization: 'Bearer ' + conta.token, ...(corpo && { 'content-type': 'application/json' }) }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'erro ' + r.status);
    return j;
  };
  const dizer = (t) => { campo('quem').textContent = t; };
  // Cada mudança vai ao servidor, juntando as que chegam em sequência (arrastar a cadeira guarda a cada parada).
  let esperaDoEnvio = 0;
  enviar = () => {
    relatar();
    if (!conta || soVer) return;
    clearTimeout(esperaDoEnvio);
    esperaDoEnvio = setTimeout(() => { pedir('PUT', ROTA, retrato()).then(() => dizer('Entrou como ' + conta.nome + ' (conta ' + conta.id + '). Guardado no servidor.')).catch((e) => dizer('Não guardou: ' + e.message)); }, 700);
  };
  async function carregarMeu() {
    const { arrumacao } = await pedir('GET', ROTA);
    if (arrumacao) vestir(arrumacao); else enviar(); // ainda não tinha: o que está na tela vira o dele
    dizer('Entrou como ' + conta.nome + ' (conta ' + conta.id + ').');
  }
  campo('entrar').onclick = async () => {
    const api = campo('api').value.replace(/[/]+$/, '');
    try {
      const r = await fetch(api + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: campo('nome').value, password: campo('senha').value }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'erro ' + r.status);
      conta = { api, token: j.token, nome: j.user.username, id: j.user.id };
      try { localStorage.setItem('syden-teste-conta', JSON.stringify(conta)); } catch { /* só nesta visita */ }
      await carregarMeu();
    } catch (e) { dizer('Não entrou: ' + e.message); }
  };
  let meu = null;
  const modoVisita = (dono) => {
    soVer = !!dono;
    botoesDaParede(); botaoDaCor();
    for (const id of ['girar', 'inicial', 'tipo-janela', 'janela', 'cortina', 'vista']) campo(id).disabled = soVer || (id === 'janela' && !TIPOS_JANELA[JAN.tipo].abre) || (id === 'cortina' && !TIPOS_JANELA[JAN.tipo].cortina);
    campo('voltar').hidden = !soVer;
    tela.style.cursor = soVer ? 'default' : 'grab';
    document.body.dataset.visita = soVer ? dono : '';
  };
  campo('visitar').onclick = async () => {
    if (!conta) { dizer('Entre numa conta primeiro.'); return; }
    try {
      const j = await pedir('GET', '/api/quarto/' + encodeURIComponent(campo('visitar-id').value.trim()));
      if (!soVer) meu = retrato();
      modoVisita(j.dono.username); vestir(j.arrumacao); modoVisita(j.dono.username);
      dizer('Visitando o quarto de ' + j.dono.username + ' (só olhar).');
    } catch (e) { dizer('Não deu para visitar: ' + e.message); }
  };
  campo('voltar').onclick = () => { modoVisita(null); if (meu) vestir(meu); meu = null; dizer(conta ? 'De volta ao seu quarto, ' + conta.nome + '.' : ''); };
  window.visitaDoTeste = () => ({ soVer, conta: conta && { nome: conta.nome, id: conta.id }, retrato: retrato(), estado, pose: coelho.pose, destino: coelho.destino }); // para o teste
  if (conta && !MODO_APP) { campo('api').value = conta.api; carregarMeu().catch((e) => dizer('A conta guardada não respondeu: ' + e.message)); }

  // O que a barra de arrumar do app precisa saber para mostrar o que está escolhido.
  function relatar() {
    if (!MODO_APP || window.parent === window) return;
    window.parent.postMessage({ syden: 'quarto', arrumacao: { janela: JAN.tipo, tapete: CORES.tapete ?? 'salvia', parede: Object.fromEntries(Object.keys(ITENS_PAREDE).map((id) => [id, !!NA_PAREDE[id]])) } }, location.origin);
  }
  // As figuras da barra (sem texto, para não pedir tradução): o recorte de cada objeto da parede, e a cor de cada tapete.
  function figurasDaBarra() {
    const miniaturas = {};
    for (const [id, T2] of Object.entries(TEXTURAS_PAREDE)) {
      let x0 = W, y0 = W, x1 = 0, y1 = 0;
      for (let k = 0; k < W * W; k++) if (T2.dia[k * 4 + 3] > 127) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
      const d = new ImageData(c.width, c.height);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = (y * W + x) * 4, j = ((y - y0) * c.width + (x - x0)) * 4; for (let q = 0; q < 4; q++) d.data[j + q] = T2.dia[k + q]; }
      c.getContext('2d').putImageData(d, 0, 0);
      miniaturas[id] = c.toDataURL();
    }
    // a cor média do tapete pintado, tingida em cada uma
    let n = 0; const m = [0, 0, 0];
    for (let k = 0; k < W * W; k++) if (pecas.tapete && pecas.tapete.movel[k * 4 + 3]) { for (let q = 0; q < 3; q++) m[q] += pecas.tapete.movel[k * 4 + q]; n++; }
    const media = m.map((v) => v / Math.max(1, n));
    const cores = Object.fromEntries(Object.entries(CORES_DO_TAPETE).map(([id, cor]) => [id, 'rgb(' + (id === 'salvia' ? media : tingirPixel(media[0], media[1], media[2], cor)).map(Math.round).join(',') + ')']));
    // e o primeiro desenho de cada objeto de cima
    const deCima = {};
    for (const [id, vs] of Object.entries(OBJ_VISTAS)) {
      const v0 = vs[0], [x0, y0, x1, y1] = v0.caixa, c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
      const d = new ImageData(c.width, c.height);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * W + x) * 4, j = ((y - y0) * c.width + (x - x0)) * 4; for (let q = 0; q < 4; q++) d.data[j + q] = v0.movel[k + q]; }
      c.getContext('2d').putImageData(d, 0, 0);
      deCima[id] = c.toDataURL();
    }
    return { miniaturas, cores, ordem: Object.keys(ITENS_PAREDE), deCima };
  }

  // ============================== NO APP (15/10/2026) ==============================
  // Dentro do QuartoNovo.tsx, o app manda por mensagem: as funções (o nome de cada uma, na língua de quem lê), se é noite
  // (o tema do app), o estado de quem mora aqui e a conta (para guardar a arrumação no servidor). O quarto devolve o
  // clique de cada função. Só mensagens da própria origem: o quarto mora no mesmo site que o app.
  if (MODO_APP) {
    conta = null;
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.source !== window.parent || e.data?.syden !== 'quarto') return;
      const d = e.data;
      if (d.funcoes) FUNCOES = d.funcoes;
      if (typeof d.noite === 'boolean' && (modo === 'noite') !== d.noite) botoes[d.noite ? 'noite' : 'dia'].click();
      if (d.estado) document.querySelector('[data-estado="' + d.estado + '"]')?.click();
      if (d.conta && !conta) {
        conta = d.conta;
        // O SALÃO: a arrumação da comunidade, e só quem administra mexe (o servidor confere; aqui é só não deixar tentar).
        if (d.conta.rota) ROTA = d.conta.rota;
        if (d.conta.podeEditar === false) { soVer = true; tela.style.cursor = 'default'; }
        carregarMeu().catch(() => { /* sem servidor: o quarto de fábrica, sem guardar */ });
      }
      // Quem administra mudou o salão (salao:mudou): relê. Não no meio de um arraste.
      if (d.recarregar && conta && !arrastando && !viva) carregarMeu().catch(() => {});
      if ('aoVivo' in d) { AO_VIVO = d.aoVivo || null; desenhar(); }
      if ('imagem' in d) carregarImagem(d.imagem);
      if ('recado' in d) { const antes = JSON.stringify(RECADO); RECADO = d.recado && (d.recado.titulo || d.recado.texto) ? d.recado : null; if (RECADO && JSON.stringify(RECADO) !== antes) abrirRecado(); else posicionarRecado(true); }
      if (d.visitar) campo('visitar-id').value = String(d.visitar), campo('visitar').click();
      // A BARRA DE ARRUMAR do app (QuartoNovo.tsx): os mesmos botões da página de teste.
      if (d.comando === 'girar') girar();
      if (d.comando === 'janela') btj.click();
      if (d.comando === 'tapete' && CORES_DO_TAPETE[d.cor]) { CORES = { ...CORES, tapete: d.cor }; guardarCores(); botaoDaCor(); desenhar(); }
      if (d.comando === 'parede' && ITENS_PAREDE[d.id]) alternarNaParede(d.id);
      if (d.comando === 'inicial') document.getElementById('inicial').click();
      if (d.comando === 'objeto' && OBJ_VISTAS[d.tipo]) porObjeto(d.tipo);
      if (Array.isArray(d.pessoas)) { PESSOAS = d.pessoas.slice(0, 12); desenhar(); }
    });
    window.parent.postMessage({ syden: 'quarto', pronto: true, figuras: figurasDaBarra() }, location.origin);
    relatar();
  }
  // No salão o coelho não passeia: ao abrir, ele JÁ ESTÁ no lugar dele (o recado, atrás do balcão). Atravessar a sala a
  // cada visita seria movimento à toa, e o recado esperaria ele chegar.
  if (CENA === 'salao') { const s0 = semAndar; semAndar = true; decidir(); semAndar = s0; }
  // Na página de teste, gente de mentira na call (o app manda a de verdade: { pessoas }).
  if (CENA === 'salao') {
    const bp = document.getElementById('pessoas-teste'), NOMES_DE_TESTE = ['Ana', 'Zeca', 'Rui', 'Bia', 'Lia', 'Teo', 'Duda', 'Gil'];
    bp.hidden = false;
    bp.onclick = () => {
      const n = (PESSOAS.length + 1) % 9;
      PESSOAS = NOMES_DE_TESTE.slice(0, n).map((nome, i) => ({ id: i + 1, nome, papel: i === 1 ? 'transmitindo' : i === 3 ? 'jogando' : 'call' }));
      bp.textContent = 'Pessoas na call: ' + n; desenhar();
    };
  }
  window.pessoasDoTeste = (lista) => { PESSOAS = lista; desenhar(); }; // para o teste
  // ============================== A CÂMERA (o salão 16 × 16, 15/10/2026) ==============================
  // Decisão dele: "câmera que anda". O salão inteiro não cabe no tamanho de pixel do quarto, então a vista mostra um pedaço
  // e o mundo anda dentro dela: arrastar onde não há nada para pegar (o chão, a parede, o fundo) leva a câmera. Ela abre
  // no canto da TV e do sofá. O pixel acompanha a largura da vista (nunca menor que 1), para o coelho ficar do tamanho de
  // sempre na tela. Só a parte com desenho conta: a câmera não passa da borda da frente do chão.
  const vistaEl = tela.closest('.vista'), mundoEl = tela.closest('.mundo');
  const camera = { x: 0, y: 0, px: 1, ativa: CENA === 'salao' };
  const ALTURA_UTIL = Math.min(W, Math.ceil(CANTOS.frente[1] + 40)); // até a borda da frente
  function prenderCamera() {
    const vw = vistaEl.clientWidth, vh = vistaEl.clientHeight, mw = W * camera.px, mh = ALTURA_UTIL * camera.px;
    camera.x = Math.max(0, Math.min(mw - vw, camera.x)); camera.y = Math.max(0, Math.min(Math.max(0, mh - vh), camera.y));
    mundoEl.style.transform = 'translate(' + -Math.round(camera.x) + 'px, ' + -Math.round(camera.y) + 'px)';
    marcarForaDaVista();
  }
  // AS MARCAS NA BORDA: quem está na call e ficou fora da vista, agrupado pela direção (as 8: os lados e as quinas),
  // com quantos são e uma seta. Clicar leva a câmera até eles.
  let pessoasNaTela = []; // [{ x, y }] da cabeça de cada pessoa, em pixels da cena (montarCena)
  function marcarForaDaVista() {
    const caixa = document.getElementById('fora-da-vista');
    if (!camera.ativa || !caixa) return;
    const vw = vistaEl.clientWidth, vh = vistaEl.clientHeight, px = camera.px, folga = 6;
    const grupos = new Map();
    for (const q of pessoasNaTela) {
      const sx = q.x * px - camera.x, sy = q.y * px - camera.y;
      const gx = sx < folga ? -1 : sx > vw - folga ? 1 : 0, gy = sy < folga ? -1 : sy > vh - folga ? 1 : 0;
      if (!gx && !gy) continue;
      const k = gx + ',' + gy, g = grupos.get(k) ?? { gx, gy, n: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
      g.n++; g.sx += sx; g.sy += sy; g.cx += q.x; g.cy += q.y; grupos.set(k, g);
    }
    const SETA = { '-1,0': '←', '1,0': '→', '0,-1': '↑', '0,1': '↓', '-1,-1': '↖', '1,-1': '↗', '-1,1': '↙', '1,1': '↘' };
    caixa.replaceChildren(...[...grupos.entries()].map(([k, g]) => {
      const b = document.createElement('button'), seta = document.createElement('span');
      b.type = 'button'; seta.textContent = SETA[k]; b.append(String(g.n), seta);
      // na borda, na altura (ou largura) média de quem está daquele lado
      const m = 22, x = g.gx < 0 ? m : g.gx > 0 ? vw - m : Math.max(m, Math.min(vw - m, g.sx / g.n));
      const y = g.gy < 0 ? m : g.gy > 0 ? vh - m : Math.max(m, Math.min(vh - m, g.sy / g.n));
      b.style.left = x + 'px'; b.style.top = y + 'px';
      b.onclick = () => { camera.x = (g.cx / g.n) * px - vw / 2; camera.y = (g.cy / g.n) * px - vh / 2; prenderCamera(); };
      return b;
    }));
  }
  function medirCamera(centrarEm) {
    if (!camera.ativa) return;
    const antes = camera.px, vw = vistaEl.clientWidth;
    camera.px = Math.max(1, vw / 560);
    mundoEl.style.width = W * camera.px + 'px';
    if (centrarEm) { camera.x = centrarEm[0] * camera.px - vw / 2; camera.y = centrarEm[1] * camera.px - vistaEl.clientHeight / 2; }
    else { camera.x *= camera.px / antes; camera.y *= camera.px / antes; }
    prenderCamera();
  }
  window.cameraDoTeste = () => ({ ...camera }); // para o teste
  window.moverCameraDoTeste = (x, y) => { camera.x = x; camera.y = y; prenderCamera(); }; // para o teste
  if (camera.ativa) {
    const ondeAbre = ARR.tv && ARR.sofa ? ponto((ARR.tv.c[0] + ARR.sofa.c[0]) / 2, (ARR.tv.c[1] + ARR.sofa.c[1]) / 2) : ponto(N / 4, N / 4);
    medirCamera([ondeAbre[0], ondeAbre[1] - 40]);
    window.addEventListener('resize', () => medirCamera());
    let pan = null;
    comecarPan = (e) => { pan = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y, id: e.pointerId }; vistaEl.classList.add('andando'); };
    vistaEl.addEventListener('pointerdown', (e) => { if (!tela.hasPointerCapture(e.pointerId) && !pan) comecarPan(e); });
    window.addEventListener('pointermove', (e) => { if (!pan || e.pointerId !== pan.id) return; camera.x = pan.cx - (e.clientX - pan.x); camera.y = pan.cy - (e.clientY - pan.y); prenderCamera(); });
    window.addEventListener('pointerup', (e) => { if (pan && e.pointerId === pan.id) { pan = null; vistaEl.classList.remove('andando'); } });
  }
  // Os gráficos: os botões da página de teste, e o que o app mudar nas Configurações.
  function botoesDosGraficos() {
    for (const [k, nome] of [['particulas', 'Partículas'], ['sombras', 'Sombras'], ['telas', 'Telas animadas']]) {
      const b = document.getElementById('graf-' + k); if (!b) continue;
      b.setAttribute('aria-pressed', String(!!GRAFICOS[k]));
      b.textContent = nome + ': ' + (GRAFICOS[k] ? 'sim' : 'não');
    }
  }
  for (const k of ['particulas', 'sombras', 'telas']) {
    const b = document.getElementById('graf-' + k);
    if (b) b.onclick = () => { GRAFICOS = { ...GRAFICOS, [k]: !GRAFICOS[k] }; try { localStorage.setItem('syden:graficos', JSON.stringify(GRAFICOS)); } catch { /* só nesta visita */ } botoesDosGraficos(); assinaturaCena = ''; desenhar(); };
  }
  window.addEventListener('storage', (e) => { if (e.key === 'syden:graficos') { GRAFICOS = lerGraficos(); botoesDosGraficos(); assinaturaCena = ''; desenhar(); } });
  window.graficosDoTeste = () => ({ ...GRAFICOS }); // para o teste
  botoesDosGraficos();
  // O canal da TV: no app, o app troca (e manda o novo AO_VIVO); aqui, a lista de teste.
  let canaisDeTeste = [];
  function trocarCanal(passo) {
    if (MODO_APP && window.parent !== window) { window.parent.postMessage({ syden: 'quarto', canal: passo }, location.origin); return; }
    if (!canaisDeTeste.length || !AO_VIVO) return;
    const i = (AO_VIVO.canal + passo + canaisDeTeste.length) % canaisDeTeste.length;
    AO_VIVO = { ...canaisDeTeste[i], canal: i, total: canaisDeTeste.length }; desenhar();
  }
  if (CENA === 'salao' && !MODO_APP) {
    const ba = document.getElementById('aovivo-teste'), bi = document.getElementById('imagem-teste'), br = document.getElementById('recado-teste');
    ba.hidden = bi.hidden = br.hidden = false;
    ba.onclick = () => {
      // ninguém → uma transmissão → duas → ninguém
      const n = AO_VIVO ? (AO_VIVO.total === 1 ? 2 : 0) : 1;
      canaisDeTeste = [{ rotulo: 'Ao vivo', nome: 'Zeca', sub: 'Em Sala 1 · Stardew Valley' }, { rotulo: 'Ao vivo', nome: 'Bia', sub: 'Em Sala 2' }].slice(0, n);
      AO_VIVO = n ? { ...canaisDeTeste[0], canal: 0, total: n } : null;
      ba.setAttribute('aria-pressed', String(!!n)); ba.textContent = 'Ao vivo: ' + (n ? n + ' transmissão' + (n > 1 ? 'ões' : '') : 'ninguém'); desenhar();
    };
    let ni = 0;
    bi.onclick = () => {
      // nenhuma → o ícone (contido) → a capa (cobrindo) → nenhuma
      ni = (ni + 1) % 3;
      carregarImagem(ni === 0 ? null : ni === 1 ? { url: IMAGENS.iconeDeTeste, encaixe: 'conter' } : { url: IMAGENS.capaDeTeste, encaixe: 'cobrir' });
      bi.setAttribute('aria-pressed', String(ni > 0)); bi.textContent = 'Imagem da comunidade: ' + ['nenhuma', 'ícone', 'capa'][ni];
    };
    br.onclick = () => {
      RECADO = RECADO ? null : { titulo: 'Bem-vindo!', texto: 'Sexta tem karaokê às 21h. Chega mais!' };
      br.setAttribute('aria-pressed', String(!!RECADO)); br.textContent = 'Recado: ' + (RECADO ? 'escrito' : 'nenhum'); if (RECADO) abrirRecado(); else posicionarRecado(true);
    };
  }
  desenhar();
})();
</script>
</body></html>
`;
const SAIDA = CENA === 'salao' ? path.join(SALAO, 'salao.html') : path.join(AQUI, 'quarto.html');
fs.writeFileSync(SAIDA, html);
console.log(path.basename(SAIDA), Math.round(html.length / 1024), 'KB');
