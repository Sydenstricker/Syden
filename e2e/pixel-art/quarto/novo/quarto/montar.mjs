// Monta quarto.html: o quarto na base sem porta (pl-512-janela-1), com os móveis recortados e a vista atrás do vidro,
// ao lado do conceito, de dia e de noite. A montagem acontece na própria página, num canvas, porque o pufe se arrasta:
//   - de dia, cada móvel é o recorte pintado; o pufe usa a versão pintada mais perto de onde está e só ganha a
//     INTENSIDADE da luz do lugar novo;
//   - de noite, o fundo é a noite montada (noite.mjs) com a luz do abajur pintada (noite-abajur.mjs), e os móveis são a
//     cor do dia vezes a razão noite/dia;
//   - a vista (../janela/) entra nos pixels do vidro, espelhada, e troca com a hora.
//   node e2e/pixel-art/quarto/novo/quarto/montar.mjs   → quarto.html
//
// PUBLICAR (o lançamento, 16/10/2026: "o quarto novo substitui para todo mundo, assim como o salão isométrico"): com
//   node montar.mjs [salao] --publicar <pasta da página> <pasta das imagens> <endereço das imagens>
// a página sai para o build do site (web/vite.config.ts) do jeito que a política do site aceita: as imagens em arquivos
// com a impressão digital no nome (o cache longo de /app/assets/, em vez de 3–5 MB de imagem dentro do HTML a cada
// visita), o script num arquivo à parte (script-src 'self' não roda script dentro da página) e sem as imagens que só a
// página de teste usa (o conceito, o ícone e a capa de teste). Sem --publicar, a página de teste de sempre, com tudo
// dentro (aberta como arquivo, o canvas não lê imagem de outro arquivo).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CANTOS, N } from './chao.mjs';
import { FIXOS, PUFES } from './lista.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// (o ler64 daqui, e não o de ../../imagem.mjs: aquele traz junto o Playwright, que o build do site não tem)
const ler64 = (arquivo) => fs.readFileSync(arquivo).toString('base64');
const iPub = process.argv.indexOf('--publicar');
const PUBLICAR = iPub >= 0 ? { pagina: process.argv[iPub + 1], imagens: process.argv[iPub + 2], url: process.argv[iPub + 3] } : null;
if (PUBLICAR && !(PUBLICAR.pagina && PUBLICAR.imagens && PUBLICAR.url)) throw new Error('--publicar <pasta da página> <pasta das imagens> <endereço das imagens>');
const impressao = (dados) => createHash('sha256').update(dados).digest('hex').slice(0, 10);
// O PACOTE (16/10/2026, relato dele: "demorei uns 15 segundos para carregar o salão"): publicadas uma a uma, eram ~435
// imagens, ~435 idas ao servidor na primeira visita. Agora as imagens de cada cena saem num arquivo só, com o índice de
// onde cada uma começa; a página o baixa de uma vez e recorta em blob: (a política do site já aceita img-src blob:).
const PACOTE_ITENS = new Map(); // nome → dados
const png = (arquivo) => {
  if (!PUBLICAR) return 'data:image/png;base64,' + ler64(arquivo);
  const dados = fs.readFileSync(arquivo), nome = impressao(dados);
  if (!PACOTE_ITENS.has(nome)) PACOTE_ITENS.set(nome, dados);
  return 'pacote:' + nome;
};
function fecharPacote() {
  if (!PUBLICAR) return null;
  const indice = {}, partes = [];
  let pos = 0;
  for (const [nome, dados] of PACOTE_ITENS) { indice[nome] = [pos, dados.length]; partes.push(dados); pos += dados.length; }
  const tudo = Buffer.concat(partes), arquivo = 'cena-pacote-' + impressao(tudo) + '.bin';
  fs.mkdirSync(PUBLICAR.imagens, { recursive: true });
  fs.writeFileSync(path.join(PUBLICAR.imagens, arquivo), tudo);
  return { url: PUBLICAR.url + arquivo, indice, bytes: tudo.length };
}
// O que só a página de teste mostra (o conceito ao lado, as imagens de teste do quadro): fora da publicada.
const soNoTeste = (arquivo) => (PUBLICAR ? null : png(arquivo));
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
  conceitoNoite: soNoTeste(path.join(AQUI, '..', '..', 'hibrido', 'conceito-unzoom.png')),
  conceitoDia: soNoTeste(path.join(AQUI, '..', '..', 'hibrido', 'dia.png')),
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
    jukebox: 'S:jukebox-giros', microfone: 'S:microfone-giros', pufao: 'S:pufao-giros', ilha: 'S:ilha-giros', geladeira: 'S:geladeira-giros' }
  : { poltrona: 'poltrona-giros', abajur: 'criado-mudo-pes-limpo-giros', 'guarda-roupa': 'guarda-roupa-giros', cama: 'cama-casal-giros', mesa: 'mesa-teclado-giros', 'planta-alta': 'planta-alta-giros', 'planta-baixa': 'planta-baixa-giros' };
const ORDEM_DO_GIRO = ['south-west', 'north-west', 'north-east', 'south-east'];
for (const [id, pasta] of Object.entries(GIROS)) {
  const dir = pasta.startsWith('S:') ? path.join(SALAO, 'moveis', pasta.slice(2)) : path.join(AQUI, 'avulsos', pasta);
  if (ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(dir, d + '.png')))) ORDEM_DO_GIRO.forEach((d, l) => { IMAGENS['giro-' + id + l] = png(path.join(dir, d + '.png')); });
}
// A MÁSCARA DA TELA (pedido dele, 15/10/2026: "me fala qual o arquivo da TV que eu crio um com máscara"): uma cópia da
// vista de frente com a tela pintada de MAGENTA puro (255, 0, 255), ao lado dela: <vista>-tela.png. Quando existe, ela
// decide quais pixels são tela (no lugar da medida de telas.json e da procura pela cor).
for (const id of ['tv', 'fliperama']) {
  const pasta = GIROS[id]; if (!pasta?.startsWith('S:')) continue;
  for (const l of [0, 3]) { const f = path.join(SALAO, 'moveis', pasta.slice(2), ORDEM_DO_GIRO[l] + '-tela.png'); if (fs.existsSync(f)) IMAGENS['tela-' + id + l] = png(f); }
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
  IMAGENS.iconeDeTeste = soNoTeste(path.join(WEB, 'icon-512.png'));
  IMAGENS.capaDeTeste = soNoTeste(path.join(AQUI, '..', '..', '..', 'salao', 'bases', 'tarde-1.png'));
  // as luzinhas do alto das paredes, à parte (salao/luzes16.py): vão por cima da janela e dos objetos da parede
  IMAGENS.luzes = png(path.join(SALAO, 'luzes16.png'));
}
for (const q of ['dia', 'noite', 'noite-abajur']) IMAGENS['sem-' + q] = png(CENA === 'salao' ? path.join(SALAO, q === 'dia' ? 'base16.png' : 'noite16.png') : path.join(JAN_DIR, `sem-janela-${q}.png`));
const JANELAS = {};
// No salão, a de tijolo primeiro (janelas/avulsa.mjs) e sem a de cortinas: "além de ter mancha, não combina com a estética
// da sala" (relato dele, 15/10/2026).
for (const tipo of CENA === 'salao' ? ['tijolo', 'original', 'arco', 'redonda', 'floreira'] : ['original', 'arco', 'redonda', 'floreira', 'cortinas']) {
  const d = path.join(JAN_DIR, tipo);
  if (!fs.existsSync(path.join(d, 'janela.json'))) continue;
  JANELAS[tipo] = JSON.parse(fs.readFileSync(path.join(d, 'janela.json'), 'utf8'));
  const arqs = ['peca-dia', 'peca-noite', 'vidro', 'luar', ...(JANELAS[tipo].cortina ? ['cortina-dia', 'cortina-noite'] : []), ...(JANELAS[tipo].abre ? ['aberta-dia', 'aberta-vao', 'aberta-vidro', 'luar-aberta'] : [])];
  for (const a of arqs) IMAGENS[`jan-${tipo}-${a}`] = png(path.join(d, a + '.png'));
}
// OS OBJETOS DA PAREDE (parede/itens.mjs e parede/pecas.py): como a janela, peças nas coordenadas de onde foram pintados.
const ITENS_PAREDE = {};
for (const item of ['fone', 'quadro', 'cortica', 'prateleira', 'pintura', 'prateleira-bar', 'prateleira-snacks', 'trofeus', 'neon', 'relogio', 'violao', 'porta', 'poster', 'cafe']) {
  // no salão, a versão pintada no tijolo dele, se houver (parede-salao/). E a GERADA SEM PAREDE (avulsos.py: "avulso" no
  // item.json) vale nos dois: o recorte do quarto, tirado da pintura na parede, trazia pedaços dela e um contorno sujo
  // (relato dele, 17/10/2026: "não estamos usando o asset limpo sem fundo que veio do PixelLab?").
  const ds = path.join(AQUI, 'parede-salao', item), dq = path.join(AQUI, 'parede', item);
  const limpo = fs.existsSync(path.join(ds, 'item.json')) && JSON.parse(fs.readFileSync(path.join(ds, 'item.json'), 'utf8')).avulso != null;
  const d = fs.existsSync(path.join(ds, 'item.json')) && (CENA === 'salao' || (limpo && fs.existsSync(path.join(dq, 'item.json')))) ? ds : dq;
  if (!fs.existsSync(path.join(d, 'item.json'))) continue;
  ITENS_PAREDE[item] = JSON.parse(fs.readFileSync(path.join(d, 'item.json'), 'utf8'));
  for (const q of ['dia', 'noite']) IMAGENS['par-' + item + '-' + q] = png(path.join(d, 'peca-' + q + '.png'));
  // COM TEXTO (o pôster do café, 17/10/2026): a parede da esquerda tem a peça própria, porque o espelho leria o texto ao
  // contrário (ver parede/de-imagem.py).
  if (ITENS_PAREDE[item].texto) for (const q of ['dia', 'noite']) IMAGENS['par-' + item + '-esq-' + q] = png(path.join(d, 'peca-' + q + '-esq.png'));
  // AS OPÇÕES DE UM OBJETO (o pôster, 16/10/2026: "o usuário pode escolher qual pôster usar?"): opcoes/<nome>/, geradas
  // por parede/avulsos.py forçando cada opção. A de fábrica é a do próprio item; a escolha vai em "cores" (como o tapete).
  const dop = path.join(d, 'opcoes');
  if (fs.existsSync(dop)) {
    const ops = fs.readdirSync(dop).map((nome) => ({ ...JSON.parse(fs.readFileSync(path.join(dop, nome, 'item.json'), 'utf8')), nome })).sort((a, b) => a.avulso - b.avulso);
    ITENS_PAREDE[item].opcoes = Object.fromEntries(ops.map((o) => [o.nome, { ocupa: o.ocupa, alto: o.alto }]));
    ITENS_PAREDE[item].fabrica = ops.find((o) => o.avulso === ITENS_PAREDE[item].avulso)?.nome ?? ops[0].nome;
    for (const o of ops) for (const q of ['dia', 'noite']) IMAGENS['par-' + item + '@' + o.nome + '-' + q] = png(path.join(dop, o.nome, 'peca-' + q + '.png'));
  }
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
const PACOTE = fecharPacote();
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
  /* a cena nunca rola dentro do app (relato dele, 16/10/2026: com o mouse no canto, o rótulo saía da página e apareciam
     barras de rolagem, "quebra a imersão") */
  html.app, html.app body { overflow: hidden; }
  /* o escondido fica escondido, mesmo com display próprio (relato dele, 16/10/2026: de dia, uma pílula escura no canto de
     baixo, à esquerda — era a etiqueta do Ao vivo, vazia, com display: flex vencendo o hidden) */
  [hidden] { display: none !important; }
  /* A BARRINHA do que está escolhido no Editar (girar, tirar, opções), em cima dele */
  #barrinha { position: absolute; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: auto; }
  #barrinha .botoes, #barrinha .opcoes { display: flex; gap: 2px; padding: 3px; background: rgba(30, 24, 20, 0.95); border: 1px solid rgba(255, 236, 200, 0.22); border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); }
  #barrinha .opcoes { flex-wrap: wrap; justify-content: center; gap: 4px; padding: 4px; max-width: 280px; }
  #barrinha button { width: 34px; height: 34px; display: grid; place-items: center; margin: 0; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #f3e6d0; cursor: pointer; }
  #barrinha button:hover { background: rgba(255, 236, 200, 0.14); }
  #barrinha button[aria-pressed="true"] { background: rgba(255, 200, 120, 0.28); color: #ffd58a; box-shadow: inset 0 0 0 1px rgba(255, 213, 138, 0.7); }
  #barrinha button:disabled { opacity: 0.35; cursor: default; }
  #barrinha svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  #barrinha .opcoes button { width: auto; min-width: 34px; height: 40px; padding: 2px 5px; }
  #barrinha .opcoes img { height: 34px; width: auto; image-rendering: pixelated; }
  #barrinha .opcoes .cor { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.3); }
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
  <button id="opcao-poster" hidden>Pôster</button>
</div>
<div class="barra" id="graficos">
  <button id="graf-particulas">Partículas</button><button id="graf-sombras">Sombras</button><button id="graf-telas">Telas animadas</button>
</div>
<div class="barra" id="enfeites"></div>
<div class="barra" id="moveis"></div>
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
  <figure class="com-rotulo"><div class="vista"><div class="mundo"><canvas id="tela" width="${WC}" height="${WC}" aria-label="O quarto do coelho"></canvas><div id="rotulo" hidden></div><div id="barrinha" hidden></div><div id="nomes"></div><div id="aovivo" hidden></div><div id="recado" hidden></div></div><div id="fora-da-vista"></div></div><figcaption id="legenda"></figcaption></figure>
  <figure><img id="conceito" alt="O conceito"><figcaption>Conceito (ChatGPT), convertido para pixel art. A versão de dia é a repintura do quarto híbrido.</figcaption></figure>
</div>
</main>
<script>
// AS CÓPIAS (16/10/2026, decisão dele: "tudo pode duplicar"): "cama~2" é a segunda cama, "quadro~3" o terceiro quadro. O
// TIPO é o que vem antes do "~", e as tabelas por tipo (desenho, forma, peso, função, nome…) respondem pela cópia com os
// dados do original (porTipo). O que é do ORIGINAL de propósito continua pelo id: o coelho dorme na cama original, só o
// guarda-roupa original abre, a imagem da comunidade vai no quadro original.
const tipoDe = (id) => { const s = String(id), i = s.indexOf('~'); return i < 0 ? s : s.slice(0, i); };
const ehCopia = (id) => String(id).includes('~');
// (a cópia pode ter o que é SÓ dela, no mapa "proprio": a arte e o tamanho do pôster escolhido para ela)
const porTipo = (o, proprio = null) => new Proxy(o, { get: (t, k) => (typeof k === 'string' && !(k in t) && k.includes('~') ? (proprio && k in proprio ? proprio[k] : t[tipoDe(k)]) : t[k]) });
const TEXTURAS_DA_COPIA = {}, ITENS_DA_COPIA = {};
const IMAGENS = ${JSON.stringify(IMAGENS)};
const PACOTE = ${JSON.stringify(PACOTE && { url: PACOTE.url, indice: PACOTE.indice })};
const MOVEIS = ${JSON.stringify(MOVEIS)};
const JANELAS = ${JSON.stringify(JANELAS)};
const ITENS_PAREDE = porTipo(${JSON.stringify(ITENS_PAREDE)}, ITENS_DA_COPIA);
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
// (sem .map nem desestruturar: é chamada milhões de vezes na abertura — 16/10/2026, o salão levava ~5 s para abrir; a
// conta é a mesma, na mesma ordem, então o resultado é idêntico)
function ponto(u, v) {
  const a = u / N, b = v / N, B = CANTOS.fundo, L = CANTOS.esquerda, R = CANTOS.direita, F = CANTOS.frente;
  return [pontoX(a, b, B, L, R, F), pontoY(a, b, B, L, R, F)];
}
function pontoX(a, b, B, L, R, F) { return B[0] * (1 - a) * (1 - b) + L[0] * a * (1 - b) + R[0] * (1 - a) * b + F[0] * a * b; }
function pontoY(a, b, B, L, R, F) { return B[1] * (1 - a) * (1 - b) + L[1] * a * (1 - b) + R[1] * (1 - a) * b + F[1] * a * b; }
// O inverso: de um pixel para (u, v), pelo método de Newton na interpolação bilinear.
// A CONTA DIRETA (desempenho, 14/10/2026): o chão é quase um paralelogramo, então a inversa da parte linear já cai a
// menos de um centésimo de casa; dois passos de Newton acertam o resto. O Newton puro, de 12 passos, em cada pixel,
// custava a maior parte dos ~9 s de abertura num processador 4× mais lento.
function uvRapido(x, y) {
  const { fundo: B, esquerda: L, direita: R } = CANTOS;
  const a1 = L[0] - B[0], a2 = L[1] - B[1], b1 = R[0] - B[0], b2 = R[1] - B[1], det = a1 * b2 - b1 * a2;
  const dx = x - B[0], dy = y - B[1];
  let u = ((dx * b2 - b1 * dy) / det) * N, v = ((a1 * dy - dx * a2) / det) * N;
  const F = CANTOS.frente;
  for (let i = 0; i < 2; i++) {
    const e = 0.01, a = u / N, b = v / N, ae = (u + e) / N, be = (v + e) / N;
    const px = pontoX(a, b, B, L, R, F), py = pontoY(a, b, B, L, R, F);
    const ax = pontoX(ae, b, B, L, R, F), ay = pontoY(ae, b, B, L, R, F), bx = pontoX(a, be, B, L, R, F), by = pontoY(a, be, B, L, R, F);
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
// Cada imagem uma vez, e TODAS pedidas de uma vez no começo (publicada, são ~430 arquivos: uma de cada vez, pela
// internet, seriam centenas de idas e voltas). A que falhar vira um pixel transparente, em vez de travar a página.
const imagensPedidas = new Map();
// o pacote, baixado uma vez e recortado: "pacote:<nome>" → um endereço blob: de cada imagem
let pacoteAberto = null;
const abrirPacote = () => (pacoteAberto ??= fetch(PACOTE.url).then((r) => r.arrayBuffer()).then((buf) =>
  Object.fromEntries(Object.entries(PACOTE.indice).map(([nome, [ini, tam]]) => [nome, URL.createObjectURL(new Blob([new Uint8Array(buf, ini, tam)], { type: 'image/png' }))]))));
const carregar = (src) => {
  if (!imagensPedidas.has(src)) imagensPedidas.set(src, (src.startsWith('pacote:') ? abrirPacote().then((m) => m[src.slice(7)]) : Promise.resolve(src)).then((url) => new Promise((ok) => {
    const im = new Image();
    // DECODIFICADA EM SEGUNDO PLANO (desempenho, 16/10/2026): a imagem só se descomprimia no primeiro desenho, em
    // sequência e travando a página (~1 s no salão, com as vistas de 1024 × 1024). createImageBitmap descomprime fora da
    // linha principal enquanto as outras ainda chegam; sem ele, fica a imagem como antes.
    im.onload = () => (typeof createImageBitmap === 'function' ? createImageBitmap(im).then(ok, () => ok(im)) : ok(im));
    im.onerror = () => { console.warn('imagem não carregou:', src); const c = document.createElement('canvas'); c.width = c.height = 1; ok(c); };
    im.src = url;
  })).catch(() => { console.warn('o pacote de imagens não veio'); const c = document.createElement('canvas'); c.width = c.height = 1; return c; }));
  return imagensPedidas.get(src);
};
// LER PIXELS SEM PASSAR PELA PLACA (desempenho, 16/10/2026): sem "willReadFrequently", a tela vive na placa de vídeo e
// cada leitura de volta (getImageData) de uma imagem de 1024 × 1024 custava ~15 ms; são mais de cem na abertura do salão.
// Com o desfoque (filter), a placa continua: é ela que o faz rápido.
function dados(im, filtro, w = W, h = W) {
  if (!filtro && (im.width < w || im.height < h)) return dadosPequenos(im, w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', filtro ? undefined : { willReadFrequently: true });
  if (filtro) g.filter = filtro;
  g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data;
}
// A IMAGEM MENOR QUE A CENA (as vistas dos móveis têm 97 a 170 px): desenhada numa tela do tamanho DELA e copiada para
// o canto de um quadro vazio do tamanho da cena. Antes, cada uma ia para uma tela de 1024 × 1024 só para ler de volta
// 4 MB quase todos vazios (~6 ms por vista, 136 vistas no salão). O resultado é o mesmo, byte a byte.
function dadosPequenos(im, w = W, h = W) {
  const iw = Math.min(w, im.width), ih = Math.min(h, im.height), r = new Uint8ClampedArray(w * h * 4);
  if (!iw || !ih) return r;
  const c = document.createElement('canvas'); c.width = iw; c.height = ih; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0); const p = g.getImageData(0, 0, iw, ih).data;
  for (let y = 0; y < ih; y++) r.set(p.subarray(y * iw * 4, (y + 1) * iw * 4), y * w * 4);
  return r;
}

// O MODO APP antes de qualquer imagem (relato dele, 16/10/2026: "aparece isso no início" — a página de teste inteira,
// com os botões e as explicações, durante os segundos em que as imagens baixavam).
if (new URLSearchParams(location.search).has('app')) document.documentElement.classList.add('app');
if (CENA === 'salao') document.body.classList.add('salao');
(async () => {
  const im = {};
  for (const src of [...Object.values(IMAGENS), ...QUADROS_DO_COELHO]) if (src) carregar(src);
  for (const [k, src] of Object.entries(IMAGENS)) if (src) im[k] = await carregar(src);
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
    TIPOS_JANELA[t] = { ...meta, dia: d('peca-dia'), noite: d('peca-noite'), vidro: d('vidro'), luar: d('luar'), cortinaDia: d('cortina-dia'), cortinaNoite: d('cortina-noite'), aberta: d('aberta-dia'), vao: d('aberta-vao'), vidroAberto: d('aberta-vidro'), luarAberto: d('luar-aberta') };
  }
  const ORDEM_JANELAS = Object.keys(TIPOS_JANELA);
  // No salão, a redonda na parede da direita, acima do lambri (a original, de cortinas até o chão, é a do quarto).
  // No salão, a de tijolo (15/10/2026; antes a com cortinas, a com floreira e a redonda, que saía cortada).
  const JANELA_INICIAL = CENA === 'salao' ? { tipo: 'tijolo', parede: 'esquerda', v: 6.6 } : { tipo: 'original', parede: 'direita', v: 0 };
  let JAN = { ...JANELA_INICIAL };
  try { const gj = JSON.parse(localStorage.getItem(PREFIXO + 'janela') ?? 'null'); if (gj && TIPOS_JANELA[gj.tipo]) JAN = gj; } catch { /* a de fábrica */ }
  // OS OBJETOS DA PAREDE: onde cada um está ({ parede, v, h }: a parede, quantas casas andou e quantos px subiu); o que não
  // está aqui fica guardado. De fábrica, os três com função ficam na parede da esquerda (a da direita é da janela).
  // (no salão, nenhum objeto de parede de fábrica: o quadro saiu, pedido dele em 15/10/2026)
  // O salão (15/10/2026, escolhas dele): a porta do banheiro, a prateleira do bar, o neon, os troféus, o relógio, o violão
  // perto do karaokê e a prateleira de snacks na cozinha. (v: quantas casas o objeto anda a partir de onde foi pintado.)
  const PAREDE_INICIAL = CENA === 'salao' ? {
    porta: { parede: 'esquerda', v: 0.4, h: 0 }, 'prateleira-bar': { parede: 'esquerda', v: 3.4, h: 6 }, relogio: { parede: 'esquerda', v: -1.6, h: 30 },
    'prateleira-snacks': { parede: 'esquerda', v: 10.4, h: 0 }, neon: { parede: 'direita', v: 1.8, h: 24 }, trofeus: { parede: 'direita', v: -2.4, h: 10 },
    violao: { parede: 'direita', v: 9.7, h: 0 },
    // o pôster do coelho roqueiro, acima da jukebox: o canto do karaokê se anuncia (pedido dele, 15/10/2026)
    poster: { parede: 'direita', v: 8.6, h: 6 },
    // o pôster "Café & Fofoca" na cozinha, ao lado da prateleira de snacks (dele, 17/10/2026, feito no ChatGPT)
    cafe: { parede: 'esquerda', v: 12.6, h: 6 },
  } : { quadro: { parede: 'esquerda', v: 0, h: 0 }, fone: { parede: 'esquerda', v: -2.5, h: -6 }, cortica: { parede: 'esquerda', v: 3, h: 0 } };
  let NA_PAREDE = JSON.parse(JSON.stringify(PAREDE_INICIAL));
  // OBJETO NOVO ENTRA SOZINHO (relato dele, 16/10/2026: "atualizei a sala mas não vi o pôster"): a arrumação guarda quais
  // objetos da parede a página conhecia ao salvar ("conhecidos"). Um objeto de fábrica que ela não conhecia (veio depois)
  // entra no lugar de fábrica; o que a pessoa tirou de propósito continua fora. A arrumação de antes desta regra não traz a
  // lista: vale como conhecido só o que estava na parede (o tirado antes dela volta, uma vez).
  const comNovos = (parede, conhecidos) => {
    const sabe = new Set(Array.isArray(conhecidos) ? conhecidos : Object.keys(parede));
    for (const [id, P] of Object.entries(PAREDE_INICIAL)) if (ITENS_PAREDE[id] && !sabe.has(id) && !parede[id]) parede[id] = P;
    return parede;
  };
  try {
    const gp = JSON.parse(localStorage.getItem(PREFIXO + 'parede') ?? 'null');
    if (gp) NA_PAREDE = comNovos(Object.fromEntries(Object.entries(gp).filter(([id]) => ITENS_PAREDE[id])), JSON.parse(localStorage.getItem(PREFIXO + 'conhecidos') ?? 'null'));
  } catch { /* a de fábrica */ }
  const guardarParede = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'parede', JSON.stringify(NA_PAREDE)); localStorage.setItem(PREFIXO + 'conhecidos', JSON.stringify(Object.keys(ITENS_PAREDE))); } catch { /* fica só nesta visita */ } enviar(); };
  const TEXTURAS_PAREDE = porTipo({}, TEXTURAS_DA_COPIA);
  const caixasDaParede = {};
  const caixaDoItemDaParede = (id) => { if (caixasDaParede[id]) return caixasDaParede[id]; const T2 = TEXTURAS_PAREDE[id].dia; let x0 = W, y0 = W, x1 = 0, y1 = 0; for (let k = 0; k < W * W; k++) if (T2[k * 4 + 3] > 127) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return (caixasDaParede[id] = [x0, y0, x1 + 1, y1 + 1]); };
  for (const id of Object.keys(ITENS_PAREDE)) TEXTURAS_PAREDE[id] = { dia: dados(im['par-' + id + '-dia']), noite: dados(im['par-' + id + '-noite']), ...(ITENS_PAREDE[id].texto ? { esq: { dia: dados(im['par-' + id + '-esq-dia']), noite: dados(im['par-' + id + '-esq-noite']) } } : {}) };
  // A arte de um objeto da parede onde ele está: na da esquerda, a peça própria quando ele tem texto.
  const texturaNaParede = (id, parede) => (parede === 'esquerda' && TEXTURAS_PAREDE[id].esq) || TEXTURAS_PAREDE[id];
  // A escolha de cor do tapete e de OPÇÃO de um objeto da parede (o pôster): { tapete: 'azul', poster: 'fogo' }.
  let CORES = {};
  try { CORES = JSON.parse(localStorage.getItem(PREFIXO + 'cores') ?? '{}') || {}; } catch { /* as de fábrica */ }
  const guardarCores = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'cores', JSON.stringify(CORES)); } catch { /* fica só nesta visita */ } enviar(); };
  // As opções: a textura e o tamanho de cada uma. Escolher troca o objeto NO LUGAR (TEXTURAS_PAREDE e ITENS_PAREDE), e
  // tudo o que desenha, mede ou encaixa o objeto continua lendo dali.
  const OPCOES_PAREDE = porTipo({});
  for (const [id, it] of Object.entries(ITENS_PAREDE)) if (it.opcoes) {
    OPCOES_PAREDE[id] = Object.fromEntries(Object.entries(it.opcoes).map(([nome, o]) => [nome, { ...o, dia: dados(im['par-' + id + '@' + nome + '-dia']), noite: dados(im['par-' + id + '@' + nome + '-noite']) }]));
  }
  const opcaoDe = (id) => (OPCOES_PAREDE[id]?.[CORES[id]] ? CORES[id] : ITENS_PAREDE[id]?.fabrica);
  function vestirOpcoes() {
    for (const [id, ops] of Object.entries(OPCOES_PAREDE)) {
      const o = ops[opcaoDe(id)];
      TEXTURAS_PAREDE[id] = { dia: o.dia, noite: o.noite };
      ITENS_PAREDE[id].ocupa = o.ocupa; ITENS_PAREDE[id].alto = o.alto;
      delete caixasDaParede[id];
    }
    // as cópias com opção: cada uma com a arte e o tamanho da que foi escolhida para ela
    for (const id of Object.keys(NA_PAREDE)) {
      if (!ehCopia(id) || !OPCOES_PAREDE[tipoDe(id)]) continue;
      const o = OPCOES_PAREDE[tipoDe(id)][opcaoDe(id)];
      if (!o) continue;
      TEXTURAS_DA_COPIA[id] = { dia: o.dia, noite: o.noite };
      ITENS_DA_COPIA[id] = { ...ITENS_PAREDE[tipoDe(id)], ocupa: o.ocupa, alto: o.alto };
      delete caixasDaParede[id];
    }
  }
  vestirOpcoes();
  // Até onde um objeto vai na parede: inteiro nela, acima do rodapé (30 px) e até a sombra da cornija (190 px: a parede
  // clara vai a ~176 px do chão, e o recorte traz uns pixels de sombra em volta).
  // (o que fica no CHÃO, como a porta, não sobe nem desce: só anda ao longo da parede)
  // O QUE FICA NO CHÃO (a porta): o pé dele no chão. A porta do salão foi pintada 17 px acima (relato de 15/10/2026: "a porta
  // do banheiro não consegue encostar no chão"), e desce o que falta.
  const prenderNaParede = (id, P) => { const it = ITENS_PAREDE[id]; return { parede: P.parede, v: Math.round(Math.max(-it.ocupa[0], Math.min(N - it.ocupa[1], P.v)) * 10) / 10, h: it.chao ? -Math.max(0, Math.round(it.alto[0])) : Math.round(Math.max(30 - it.alto[0], Math.min(190 - it.alto[1], P.h))) }; };
  const mapaDaParede = (P) => { const dx = Math.round(27 * P.v), dy = Math.round(14.25 * P.v) - Math.round(P.h) + DY; return (x, y) => { x += dx + DX; y += dy; if (P.parede === 'esquerda') x = W - 1 - x; return x < 0 || y < 0 || x >= W || y >= W ? -1 : y * W + x; }; };
  // a de fábrica e a guardada também passam por aqui (a porta desce até o chão)
  const prenderTudo = (o) => Object.fromEntries(Object.entries(o).map(([id, P]) => [id, prenderNaParede(id, P)]));
  NA_PAREDE = prenderTudo(NA_PAREDE);
  const naParede = new Int8Array(W * W), formaParede = new Int8Array(W * W); // formaParede: o núcleo (ver nucleoDe)
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
  const luarAbertoNoChao = new Uint8Array(W * W);
  window.luarAbertoDoTeste = () => ({ pixels: luarAbertoNoChao.reduce((n, v) => n + v, 0), ganho: ganhoDaJanela }); // para o teste
  let ganhoDaJanela = [1, 1, 1];
  let diaBorrado, diaPouco, noitePouco, diaPe, noiteAbajurPouco, noitePe, noiteAbajurPe;
  const baseDaLuz = new Uint8ClampedArray(W * W * 4); // ver montarCena
  const naJanela = new Uint8Array(W * W), formaJanelaFechada = new Uint8Array(W * W), formaJanelaAberta = new Uint8Array(W * W), noCaixilho = new Uint8Array(W * W), vao = new Uint8Array(W * W), vidroAberto = new Uint8Array(W * W);
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
  // A SILHUETA IDEAL (relato dele, 17/10/2026: "dois artefatos e um certo nível de contornos de média qualidade"). A casca
  // gerada tem a borda torta: de 24 a 28 degraus duplos por lado (a linha pula 2 px de uma coluna para a outra) e pontos
  // claros do fundo que ficavam na beira. As seis retas da silhueta (as quatro diagonais e as duas laterais) são medidas na
  // própria pintura, e o quarto passa a ser recortado por elas, em escada regular. A borda nova é repintada com o contorno
  // escuro que a pintura tinha ali perto (ver contornoLimpo). Vale para todas as versões (dia, noite, abajur…).
  const fora0 = fundoDe(semDia);
  const foraIdeal = (() => {
    const topo = new Int16Array(W).fill(-1), pe = new Int16Array(W).fill(-1);
    for (let x = 0; x < W; x++) for (let y = 0; y < W; y++) if (!fora0[y * W + x]) { if (topo[x] < 0) topo[x] = y; pe[x] = y; }
    let x0 = 0, x1 = W - 1;
    while (x0 < W && topo[x0] < 0) x0++;
    while (x1 > 0 && topo[x1] < 0) x1--;
    let meio = x0; for (let x = x0; x <= x1; x++) if (topo[x] < topo[meio]) meio = x;
    const reta = (arr, a0, a1) => {
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let x = a0; x <= a1; x++) { n++; sx += x; sy += arr[x]; sxx += x * x; sxy += x * arr[x]; }
      const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      return [a, (sy - a * sx) / n];
    };
    const tE = reta(topo, x0 + 3, meio - 4), tD = reta(topo, meio + 4, x1 - 3), pE = reta(pe, x0 + 3, meio - 4), pD = reta(pe, meio + 4, x1 - 3);
    const f = new Uint8Array(W * W).fill(1);
    for (let x = x0; x <= x1; x++) {
      const yt = Math.max(Math.round(tE[0] * x + tE[1]), Math.round(tD[0] * x + tD[1]));
      const yb = Math.min(Math.round(pE[0] * x + pE[1]), Math.round(pD[0] * x + pD[1]));
      for (let y = Math.max(0, yt); y <= Math.min(W - 1, yb); y++) f[y * W + x] = 0;
    }
    return f;
  })();
  // A borda nova: o pixel da beira ganha o mais escuro da pintura original em volta (até 2 px); o que era fundo e passou
  // para dentro ganha a cor do vizinho de dentro mais perto.
  function contornoLimpo(img) {
    const fonte = new Uint8ClampedArray(img);
    const soma = (k) => fonte[k * 4] + fonte[k * 4 + 1] + fonte[k * 4 + 2];
    for (let k = 0; k < W * W; k++) {
      if (foraIdeal[k]) continue;
      const x = k % W, y = (k / W) | 0;
      const beira = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => foraIdeal[(y + dy) * W + x + dx]);
      if (!beira && !fora0[k]) continue;
      let melhor = -1;
      for (let r = 1; r <= 3 && melhor < 0; r++)
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy, n = yy * W + xx;
          // (vale o contorno original que ficou de fora da reta: é dele que vem a cor da borda nova)
          if (xx < 0 || yy < 0 || xx >= W || yy >= W || fora0[n] || (!beira && foraIdeal[n])) continue;
          if (melhor < 0 || (beira ? soma(n) < soma(melhor) : Math.abs(dx) + Math.abs(dy) < Math.abs((melhor % W) - x) + Math.abs(((melhor / W) | 0) - y))) melhor = n;
        }
      if (melhor >= 0) for (let c = 0; c < 3; c++) img[k * 4 + c] = fonte[melhor * 4 + c];
    }
  }
  const foraDia = foraIdeal, foraNoite = foraIdeal;
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
  const LUZES = im.luzes ? (() => { const d = dados(im.luzes), ks = []; for (let k = 0; k < W * W; k++) if (d[k * 4] > 127) ks.push(k); return ks; })() : null;
  // ---- AS FORMAS PARA O CONTORNO (16/10/2026, relato dele: "o contorno no headset e na janela deixam em evidência falhas")
  // Engorda uma máscara R px (em cruz, linha e coluna) — cobre os caixilhos entre os vidros.
  function engordar(e, R) {
    const linha = new Uint8Array(W * W), m = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (e(y * W + x)) for (let d = -R; d <= R; d++) { const X = x + d; if (X >= 0 && X < W) linha[y * W + X] = 1; }
    for (let x = 0; x < W; x++) for (let y = 0; y < W; y++) if (linha[y * W + x]) for (let d = -R; d <= R; d++) { const Y = y + d; if (Y >= 0 && Y < W) m[Y * W + x] = 1; }
    return m;
  }
  // O polígono convexo em volta de uma máscara, cheio.
  function envelope(m) {
    const pts = [];
    for (let y = 0; y < W; y++) { let a = -1, b = -1; for (let x = 0; x < W; x++) if (m[y * W + x]) { if (a < 0) a = x; b = x; } if (a >= 0) { pts.push([a, y]); if (b !== a) pts.push([b, y]); } }
    const r = new Uint8Array(W * W);
    if (pts.length < 3) return m;
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const giro = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const baixo = [], cima = [];
    for (const p of pts) { while (baixo.length >= 2 && giro(baixo[baixo.length - 2], baixo[baixo.length - 1], p) <= 0) baixo.pop(); baixo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (cima.length >= 2 && giro(cima[cima.length - 2], cima[cima.length - 1], p) <= 0) cima.pop(); cima.push(p); }
    const poli = [...baixo.slice(0, -1), ...cima.slice(0, -1)];
    let y0 = W, y1 = 0; for (const p of poli) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    // cada linha: onde as arestas a cruzam (o polígono é convexo: um trecho só)
    for (let y = y0; y <= y1; y++) {
      let a = W, b = -1;
      for (let i = 0; i < poli.length; i++) {
        const p = poli[i], q = poli[(i + 1) % poli.length];
        if ((p[1] - y) * (q[1] - y) > 0) continue;
        if (p[1] === q[1]) { a = Math.min(a, p[0], q[0]); b = Math.max(b, p[0], q[0]); continue; }
        const x = p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]); a = Math.min(a, x); b = Math.max(b, x);
      }
      for (let x = Math.max(0, Math.ceil(a - 0.01)); x <= Math.min(W - 1, Math.floor(b + 0.01)); x++) r[y * W + x] = 1;
    }
    return r;
  }
  // Fecha os furos de uma máscara (o que não se alcança da borda sem passar por ela): o contorno fica só por fora.
  function semFuros(m) {
    const fora = new Uint8Array(W * W), fila = [];
    for (let i = 0; i < W; i++) for (const k of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (!m[k] && !fora[k]) { fora[k] = 1; fila.push(k); }
    for (let q = 0; q < fila.length; q++) { const k = fila[q], x = k % W; for (const n of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) if (n >= 0 && n < W * W && !m[n] && !fora[n]) { fora[n] = 1; fila.push(n); } }
    const r = new Uint8Array(W * W); for (let k = 0; k < W * W; k++) r[k] = fora[k] ? 0 : 1;
    return r;
  }
  // O NÚCLEO de um objeto da parede: o recorte dele traz, por fora da linha do desenho, um pouco da parede e da sombra
  // pintada (no fone, as manchas cor de pele embaixo), e o contorno dava a volta nelas. Sai o que é claro e de tom QUENTE
  // (a parede, a sombra), ligado ao lado de fora e em pedaço pequeno (até 60 px) ou fino (até 2 px): um pedaço grande é o
  // próprio objeto com uma brecha na linha (o corpo do violão). Medido em todos os objetos (scratchpad: nucleo.py).
  function nucleoDe(T2) {
    if (T2.nucleo) return T2.nucleo;
    // (só no retângulo do objeto, com 1 px de folga: na imagem inteira, eram ~0,6 s na abertura do salão)
    const a = T2.dia, nucleo = new Uint8Array(W * W);
    let x0 = W, y0 = W, x1 = -1, y1 = -1;
    for (let k = 0; k < W * W; k++) if (a[k * 4 + 3] > 127) { const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return (T2.nucleo = nucleo);
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(W - 1, y1 + 1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, n = w * h, K = (i) => (y0 + ((i / w) | 0)) * W + x0 + (i % w);
    const peca = new Uint8Array(n), passa = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const k = K(i);
      if (a[k * 4 + 3] <= 127) { passa[i] = 1; continue; }
      peca[i] = 1;
      const r = a[k * 4], g = a[k * 4 + 1], b = a[k * 4 + 2];
      passa[i] = 0.3 * r + 0.59 * g + 0.11 * b >= 130 && r >= g && g >= b - 6 && r - b >= 25 ? 1 : 0;
    }
    const viz = (i, f) => { const x = i % w; if (x > 0) f(i - 1); if (x < w - 1) f(i + 1); if (i >= w) f(i - w); if (i + w < n) f(i + w); };
    // a inundação a partir da borda do retângulo, pelo que é transparente ou de tom de parede
    const fora = new Uint8Array(n), fila = [];
    const entra = (i) => { if (!fora[i] && passa[i]) { fora[i] = 1; fila.push(i); } };
    for (let x = 0; x < w; x++) { entra(x); entra((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { entra(y * w); entra(y * w + w - 1); }
    for (let q = 0; q < fila.length; q++) viz(fila[q], entra);
    const nuc = new Uint8Array(peca), visto = new Uint8Array(n), prof = new Int32Array(n);
    for (let i0 = 0; i0 < n; i0++) {
      if (!peca[i0] || !fora[i0] || visto[i0]) continue;
      const comp = [i0]; visto[i0] = 1;
      for (let q = 0; q < comp.length; q++) viz(comp[q], (j) => { if (peca[j] && fora[j] && !visto[j]) { visto[j] = 1; comp.push(j); } });
      // a espessura: a distância até a borda da peça, dentro do pedaço
      const f2 = [];
      for (const c of comp) { let borda = false; viz(c, (j) => { if (!peca[j]) borda = true; }); if (c % w === 0 || c % w === w - 1 || c < w || c >= n - w) borda = true; if (borda) { prof[c] = 1; f2.push(c); } }
      let fundo = 0;
      for (let q = 0; q < f2.length; q++) { const c = f2[q], d = prof[c]; if (d > fundo) fundo = d; viz(c, (j) => { if (visto[j] && peca[j] && fora[j] && !prof[j]) { prof[j] = d + 1; f2.push(j); } }); }
      if (comp.length <= 60 || fundo <= 2) for (const c of comp) nuc[c] = 0;
    }
    // os furos fechados (o que não se alcança da borda sem passar pelo núcleo) entram
    const fora2 = new Uint8Array(n), fila2 = [];
    const entra2 = (i) => { if (!fora2[i] && !nuc[i]) { fora2[i] = 1; fila2.push(i); } };
    for (let x = 0; x < w; x++) { entra2(x); entra2((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { entra2(y * w); entra2(y * w + w - 1); }
    for (let q = 0; q < fila2.length; q++) viz(fila2[q], entra2);
    for (let i = 0; i < n; i++) if (!fora2[i]) nucleo[K(i)] = 1;
    return (T2.nucleo = nucleo);
  }
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
    // O LUAR DA JANELA ABERTA (relato dele, 17/10/2026: "a sombra da janela aberta é a mesma da janela fechada"): o vão
    // inteiro, sem a grade do meio, projetado no chão (janelas/pecas.py). Vale sobre o chão sem luar.
    luarAbertoNoChao.fill(0);
    if (T.luarAberto) for (let k = 0; k < W * W; k++) {
      if (T.luarAberto[k * 4] < 128) continue;
      const d = mapa(k % W, (k / W) | 0);
      if (d >= 0 && ehChao[d]) luarAbertoNoChao[d] = 1;
    }
    // O ganho MEDIDO na noite com luar contra a noite sem ele (o luar da original é pintado, mais forte que o ganho do
    // json): a média da razão nos pixels do chão que o luar clareia de verdade.
    {
      const soma = [0, 0, 0];
      let n = 0;
      for (let k = 0; k < W * W; k++) {
        if (!ehChao[k]) continue;
        const r = [0, 1, 2].map((c) => noite[k * 4 + c] / Math.max(8, noiteSemLuar[k * 4 + c]));
        if (r[0] + r[1] + r[2] < 3.45) continue;
        for (let c = 0; c < 3; c++) soma[c] += r[c];
        n++;
      }
      ganhoDaJanela = n > 50 ? soma.map((v) => v / n) : T.ganho ?? [1, 1, 1];
    }
    // Os objetos da parede, por cima da janela (pendurados na parede, à frente da cortina).
    naParede.fill(0); formaParede.fill(0); luzesDaParede = [];
    const ids = Object.keys(NA_PAREDE).filter((id) => TEXTURAS_PAREDE[id]);
    ids.forEach((id, i) => {
      const P = NA_PAREDE[id], T2 = id === 'quadro' && CENA === 'salao' && IMAGEM_DA_COMUNIDADE ? quadroComImagem(P.parede) : texturaNaParede(id, P.parede), mp = mapaDaParede(P);
      base = compor(base, T2.dia, semDiaL, semDiaL, null, null, mp);
      if (T.cortinaDia) cortinaDia = compor(cortinaDia, T2.dia, semDiaL, semDiaL, null, null, mp);
      abertaDia = compor(abertaDia, T2.dia, semDiaL, semDiaL, null, null, mp);
      const p2 = CENA === 'salao' ? T2.dia : T2.noite, L2 = CENA === 'salao' ? semDiaL : semNoiteL;
      for (const nome of ['noite', 'noiteSemLuar']) { const v0 = nome === 'noite' ? noite : noiteSemLuar; const v1 = compor(v0, p2, semNoiteL, L2, null, null, mp); if (nome === 'noite') noite = v1; else noiteSemLuar = v1; }
      noiteAbajur = compor(noiteAbajur, p2, semAbajurL, L2, null, null, mp);
      abajurSemLuar = compor(abajurSemLuar, p2, semAbajurL, L2, null, null, mp);
      for (let k = 0; k < W * W; k++) if (T2.dia[k * 4 + 3] > 127) { const d = mp(k % W, (k / W) | 0); if (d >= 0) naParede[d] = i + 1; }
      { const nuc = nucleoDe(T2); for (let k = 0; k < W * W; k++) if (nuc[k]) { const d = mp(k % W, (k / W) | 0); if (d >= 0) formaParede[d] = i + 1; } }
      // O QUE ACENDE (o neon, o lampião da prateleira do bar): de noite, as cores claras dele ficam como de dia, e ele
      // brilha em volta (passeFinal), como a jukebox.
      if (ITENS_PAREDE[id].luz) {
        let sx = 0, sy = 0, n = 0, cr = 0, cg = 0, cb = 0;
        for (let k = 0; k < W * W; k++) {
          const t4 = k * 4, r = T2.dia[t4], g2 = T2.dia[t4 + 1], b = T2.dia[t4 + 2];
          // a cor viva acesa, e também o miolo BRANCO do tubo (antes ficava cinza à noite)
          if (T2.dia[t4 + 3] < 128 || Math.max(r, g2, b) < 190 || (Math.max(r, g2, b) - Math.min(r, g2, b) < 60 && r + g2 + b < 600)) continue;
          const d = mp(k % W, (k / W) | 0); if (d < 0) continue;
          for (const A of [noite, noiteSemLuar, noiteAbajur, abajurSemLuar]) { A[d * 4] = r; A[d * 4 + 1] = g2; A[d * 4 + 2] = b; }
          sx += d % W; sy += (d / W) | 0; n++; cr += r; cg += g2; cb += b;
        }
        if (n) luzesDaParede.push([sx / n, sy / n, [cr / n, cg / n, cb / n].map((c) => c * 0.8), 54]);
      }
    });
    ordemDaParede = ids;
    // AS LUZINHAS NA FRENTE (relato dele, 16/10/2026: "a janela está passando por cima das luzes"): o cordão está
    // pintado na casca, e o que vai na parede era composto por cima dele. Os pixels dele voltam da casca, por cima de tudo.
    if (LUZES) for (const [A, F] of [[base, semDia], [cortinaDia, semDia], [abertaDia, semDia], [noite, semNoite], [noiteSemLuar, semNoite], [noiteAbajur, semAbajur], [abajurSemLuar, semAbajur]])
      for (const k of LUZES) for (let c = 0; c < 3; c++) A[k * 4 + c] = F[k * 4 + c];
    if (!T.cortinaDia) cortinaDia = base;
    cortinaNoite = noiteSemLuar;
    for (const A of new Set([base, noite, noiteAbajur, noiteSemLuar, abajurSemLuar, cortinaDia, abertaDia])) contornoLimpo(A);
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
    // A FORMA DA JANELA para o contorno (o realce e a escolha no Editar). A original traz na peça a parede, a viga e as
    // cortinas: a forma dela é o vidro engordado 4 px (cobre os caixilhos entre os vidros), o fechado ou, aberta, o vão e
    // o vidro das folhas. Os outros tipos são só a janela: a peça, com o vidro de dentro preenchido.
    if (T.cortina) {
      // e o ENVELOPE dele (o polígono convexo em volta): com as folhas abertas, o contorno fazia degraus em volta delas
      formaJanelaFechada.set(envelope(engordar((q) => vidro[q * 4 + 3] > 127, 3)));
      formaJanelaAberta.set(envelope(engordar((q) => vao[q] || vidroAberto[q], 3)));
    } else { const f = semFuros(naJanela); formaJanelaFechada.set(f); formaJanelaAberta.set(f); }
    // A sombra do coelho de dia sai da janela: o ponto de luz anda com ela.
    const pl = mapa(420, 170); luzDoDia = pl >= 0 ? [pl % W, (pl / W) | 0] : [420 + DX, 170 + DY];
    if (!rapido) {
      diaBorrado = borrar(base, 10); diaPouco = borrar(base, 2); noitePouco = borrar(noite, 2); diaPe = borrar(base, 6);
      noiteAbajurPouco = borrar(noiteAbajur, 2); noitePe = borrar(noite, 6); noiteAbajurPe = borrar(noiteAbajur, 6);
    }
    noiteLimpa = null;
  }
  let noiteLimpa = null, ordemDaParede = [], luzesDaParede = [];
  aplicarJanela();
  const pecas = porTipo({});
  for (const m of MOVEIS) {
    const movel = deslocar(dados(im[m.id])), sombra = deslocar(dados(im[m.id + '-sombra']));
    // O TAPETE NO SALÃO (relato de 15/10/2026, "manchas no tapete"): recortado da pintura do quarto, ele traz na borda
    // pontos do chão claro de lá, que no chão escuro do salão viram manchas. Na borda (até 3 px), sai o que tem cor de
    // madeira (laranja: o tapete é verde).
    if (CENA === 'salao' && m.id === 'tapete') for (let volta = 0; volta < 3; volta++) {
      const tira = [];
      for (let k = W; k < W * W - W; k++) {
        if (!movel[k * 4 + 3]) continue;
        if (movel[(k - 1) * 4 + 3] && movel[(k + 1) * 4 + 3] && movel[(k - W) * 4 + 3] && movel[(k + W) * 4 + 3]) continue;
        const r = movel[k * 4], g2 = movel[k * 4 + 1], b = movel[k * 4 + 2];
        if (r > g2 + 12 && r - b > 40) tira.push(k);
      }
      for (const k of tira) movel[k * 4 + 3] = 0;
    }
    // e por DENTRO: as marcas que os móveis pintados em cima dele deixaram no quarto (o pé de um móvel, um claro): o tapete
    // é verde e cinza, e o pixel avermelhado vira a média dos vizinhos que são tapete
    if (CENA === 'salao' && m.id === 'tapete') {
      const mancha = (k) => movel[k * 4 + 3] && movel[k * 4] > movel[k * 4 + 1] + 10;
      for (let volta = 0; volta < 6; volta++) {
        let mudou = 0;
        for (let k = W; k < W * W - W; k++) {
          if (!mancha(k)) continue;
          let n = 0; const soma = [0, 0, 0];
          for (const v of [k - 1, k + 1, k - W, k + W, k - W - 1, k - W + 1, k + W - 1, k + W + 1]) if (movel[v * 4 + 3] && !mancha(v)) { for (let c = 0; c < 3; c++) soma[c] += movel[v * 4 + c]; n++; }
          if (n >= 2) { for (let c = 0; c < 3; c++) movel[k * 4 + c] = soma[c] / n; mudou++; }
        }
        if (!mudou) break;
      }
    }
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
    const movel = dadosPequenos(img);
    // SÓ AS LINHAS ONDE A PEÇA EXISTE (desempenho, 16/10/2026: no salão, de 1024 × 1024, cada passada pela imagem inteira
    // custava ~15 ms, e são umas oito por vista, em ~100 vistas). Fora delas a imagem é transparente: o resultado é o mesmo.
    let ly0 = 0, ly1 = Math.min(W, img.height || W) - 1; // (abaixo da altura da imagem, tudo é vazio)
    const linhaVazia = (y) => { for (let k = y * W * 4 + 3, f = (y + 1) * W * 4; k < f; k += 4) if (movel[k]) return false; return true; };
    while (ly0 < W && linhaVazia(ly0)) ly0++;
    while (ly1 > ly0 && linhaVazia(ly1)) ly1--;
    const K0 = ly0 * W, K1 = Math.min(W, ly1 + 1) * W;
    // A vista veio com a sombra pintada embaixo (cinza ou marrom chapado): tira-se a cor mais comum das últimas linhas.
    // Todas usam a sombra de contato da página, no formato do pé do móvel.
    let fundo = 0; for (let k = K0; k < K1; k++) if (movel[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / W) | 0);
    const conta = {};
    for (let y = fundo - 5; y <= fundo; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (movel[k + 3] > 127) { const cor = movel[k] + ',' + movel[k + 1] + ',' + movel[k + 2]; conta[cor] = (conta[cor] || 0) + 1; } }
    const [sombraCor, vezes] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    // Só é sombra a cor que mora no PÉ da imagem: a madeira da mesa e da cama e o contorno preto também são as mais
    // comuns nas últimas linhas, mas aparecem no móvel inteiro (tirá-las deixava a mesa transparente, 14/10/2026).
    const [sr, sg, sb] = sombraCor.split(',').map(Number), parecida = (k) => Math.abs(movel[k * 4] - sr) + Math.abs(movel[k * 4 + 1] - sg) + Math.abs(movel[k * 4 + 2] - sb) < 18;
    let emCima = 0; for (let k = K0; k < Math.max(K0, (fundo - 25) * W); k++) if (movel[k * 4 + 3] > 127 && parecida(k)) emCima++;
    if (vezes > 12 && emCima <= vezes * 0.1) {
      for (let k = K0; k < K1; k++) if (parecida(k)) movel[k * 4 + 3] = 0;
      // O QUE SOBRA DA SOMBRA, SOLTO (relato dele, 17/10/2026: "a poltrona está com uma mancha na base, parece um pixel
      // perdido"): o pixel da sombra num tom um pouco diferente não sai pela cor, e fica sozinho embaixo do móvel. Pedaço de
      // até 3 pixels, sem vizinho do móvel, sai.
      const visto = new Uint8Array(W * W);
      for (let k = K0; k < K1; k++) {
        if (visto[k] || movel[k * 4 + 3] < 128) continue;
        const grupo = [k]; visto[k] = 1;
        for (let i = 0; i < grupo.length; i++) {
          const q = grupo[i], x = q % W;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const v = q + dy * W + dx; if ((!dx && !dy) || x + dx < 0 || x + dx >= W || v < K0 || v >= K1 || visto[v] || movel[v * 4 + 3] < 128) continue;
            visto[v] = 1; grupo.push(v);
          }
        }
        if (grupo.length <= 3) for (const q of grupo) movel[q * 4 + 3] = 0;
      }
    }
    // A TELA TRANSPARENTE (ele recortou as telas da TV, 15/10/2026): o buraco FECHADO dentro do móvel (o transparente que
    // não se alcança pela borda da imagem) é a tela. Ele vira pixel do móvel, escuro, e a tela por código pinta por cima.
    let buraco = null;
    if (id === 'tv' || id === 'fliperama') {
      const fora = new Uint8Array(W * W), fila = [];
      for (let i = 0; i < W; i++) for (const k of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (movel[k * 4 + 3] < 128 && !fora[k]) { fora[k] = 1; fila.push(k); }
      for (let i = 0; i < fila.length; i++) { const k = fila[i], x = k % W; for (const v of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) if (v >= 0 && v < W * W && !fora[v] && movel[v * 4 + 3] < 128) { fora[v] = 1; fila.push(v); } }
      const ks = [];
      for (let k = K0; k < K1; k++) if (movel[k * 4 + 3] < 128 && !fora[k]) ks.push(k);
      if (ks.length >= 30) { buraco = ks; for (const k of ks) { movel[k * 4] = 22; movel[k * 4 + 1] = 20; movel[k * 4 + 2] = 30; movel[k * 4 + 3] = 255; } }
    }
    let x0 = W, x1 = 0, y0 = W, y1 = 0;
    for (let k = K0; k < K1; k++) { if (movel[k * 4 + 3] < 128) { movel[k * 4 + 3] = 0; continue; } const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let sx = 0, nb = 0; for (let x = 0; x < W; x++) for (let y = y1 - 2; y <= y1; y++) if (movel[(y * W + x) * 4 + 3]) { sx += x; nb++; }
    sx /= Math.max(1, nb);
    const peColuna = new Int16Array(W).fill(-1);
    for (let k = K0; k < K1; k++) if (movel[k * 4 + 3]) peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0);
    let soma = 0, n = 0;
    for (let k = K0; k < K1; k++) if (movel[k * 4 + 3] && ((k / W) | 0) < y0 + 8) { soma += k % W; n++; }
    // Da quina da frente (u1, v1): a ponta da DIREITA é (u0, v1), então a distância até ela é o comprimento em u; a da
    // esquerda é (u1, v0), o comprimento em v (x cresce com v e diminui com u).
    // AS PLANTAS OCUPAM O VASO, não as folhas (relato dele, 16/10/2026: "estou tentando colocar a planta em um espaço que
    // ela cabe, mas fica dando como impossível"): medidas pelas folhas, a monstera dava 2 × 2 casas, com o vaso de uma.
    // A largura vem das últimas 12 linhas (o pé do vaso); as folhas passam por cima dos vizinhos, como planta de verdade.
    let mx0 = x0, mx1 = x1;
    if (id === 'planta-alta' || id === 'planta-baixa') { mx0 = W; mx1 = 0; for (let y = y1 - 11; y <= y1; y++) for (let x = 0; x < W; x++) if (y >= 0 && movel[(y * W + x) * 4 + 3]) { mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); } }
    const mede = [Math.max(0.6, (mx1 + 1 - sx) / KX), Math.max(0.6, (sx - mx0) / KX)];
    // O MEIO DA BASE (para a cadeira, que é uma roda no chão): a largura das últimas 12 linhas é o pé de rodinhas; o meio
    // dele fica um quarto dessa largura acima do ponto mais baixo (a projeção 2:1 de um círculo).
    let bx0 = W, bx1 = 0;
    for (let y = y1 - 11; y <= y1; y++) for (let x = 0; x < W; x++) if (y >= 0 && movel[(y * W + x) * 4 + 3]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); }
    const meioDaBase = [(bx0 + bx1 + 1) / 2, y1 - (bx1 - bx0 + 1) / 4];
    return { id, movel, buraco, sombra: VAZIA, topo: y0, peColuna, frente: [sx, y1], mede, centroTopo: soma / Math.max(1, n), meioDaBase, caixa: [x0, y0, x1 + 1, y1 + 1] };
  }
  const VISTAS = porTipo({});
  for (const id of MOVEIS_GIRADOS) if (im['giro-' + id + '0']) VISTAS[id] = [0, 1, 2, 3].map((l) => pecaDeImagem(im['giro-' + id + l], id));
  // ============================== OS OBJETOS DE CIMA (15/10/2026) ==============================
  // Decisão dele: "o móvel deve ser uma coisa, os elementos outra". O que vai no tampo é peça à parte: mora num móvel,
  // numa posição relativa ao tampo dele (s, t de 0 a 1, no sentido do móvel), e tem a sua posição (lado). A peça do móvel
  // SAI COM OS OBJETOS dentro (comObjetos): arrastar, jogar, girar, a luz e a profundidade do móvel valem para eles.
  const OBJ_VISTAS = {};
  // O TAMANHO: eles foram gerados 2,5 vezes maiores que de verdade (o copo de suco quase do tamanho da banqueta), e de
  // 15/10 a 17/10/2026 eram mostrados pela metade. DESDE 17/10/2026, NO TAMANHO INTEIRO (decisão dele, depois de ver: "pode deixar desse tamanho"). Pela metade, o
  // vizinho mais próximo pulava um pixel a cada dois e quebrava o contorno: os itens viravam "poluição". Inteiros, ficam
  // nítidos e grandes demais para os móveis; o conserto de verdade é gerá-los no tamanho final (dívida de arte, CLAUDE.md).
  const ESCALA_DOS_OBJETOS = 1;
  const reduzir = (img) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * ESCALA_DOS_OBJETOS)); c.height = Math.max(1, Math.round(img.height * ESCALA_DOS_OBJETOS)); const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(img, 0, 0, c.width, c.height); return c; };
  for (const id of Object.keys(OBJETOS_DE_CIMA)) OBJ_VISTAS[id] = [0, 1, 2, 3].map((l) => pecaDeImagem(reduzir(im['obj-' + id + l]), id));
  // A altura do tampo de cada móvel que recebe objetos (px acima do chão) e a margem da borda (para nada cair).
  // (o criado-mudo era 50, e a caneca flutuava na altura da cúpula: a "mancha" no abajur, relato de 15/10/2026)
  const TOPOS = porTipo({ ilha: 42, 'mesa-jogo': 34, mesa: 44, abajur: 35, 'guarda-roupa': 76, balcao: 54, mesinha: 22, tv: 30, estante: 122 });
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
      // o painel só manda nas pontas (onde a reta passava da moldura); no meio, a reta: o desenho do painel tem um dente
      // em cima, que mordia a imagem
      const ponta = x < x0 + 6 || x > x1 - 6;
      for (let y = Math.ceil(ta); y <= Math.floor(tb); y++) if (peca.movel[(y * W + x) * 4 + 3] && (!dentro || !ponta || dentro[y * W + x])) pts.push([x, y, (x - x0) / Math.max(1, x1 - x0), Math.min(1, Math.max(0, (y - ta) / Math.max(1, tb - ta)))]);
    }
    return pts;
  }
  // a tela pela máscara magenta dele: os pixels são os da máscara; s e t pelas retas medidas (para a imagem não entortar
  // onde a máscara faz curva), ou pelo alto e pé de cada coluna da máscara quando não há medida
  function telaDaMascara(img, q) {
    const c = document.createElement('canvas'); c.width = W; c.height = W; const gc = c.getContext('2d'); gc.drawImage(img, 0, 0);
    const m = gc.getImageData(0, 0, W, W).data, ks = [];
    for (let k = 0; k < W * W; k++) if (m[k * 4 + 3] > 127 && m[k * 4] > 200 && m[k * 4 + 2] > 200 && m[k * 4 + 1] < 80) ks.push(k);
    return telaDosPixels(ks, q);
  }
  // os pixels da tela (da máscara ou do buraco) → os pontos com s e t
  function telaDosPixels(ks, q) {
    const col = new Map(), eh = new Uint8Array(W * W);
    for (const k of ks) { eh[k] = 1; const x = k % W, y = (k / W) | 0, cc = col.get(x); if (!cc) col.set(x, [y, y]); else { cc[0] = Math.min(cc[0], y); cc[1] = Math.max(cc[1], y); } }
    if (!col.size) return null;
    const xs = [...col.keys()].sort((a, b) => a - b), x0 = xs[0], x1 = xs[xs.length - 1], pts = [];
    for (const x of xs) {
      const [ya, yb] = col.get(x), ta = q ? q.topo + q.k * x : ya, tb = q ? q.pe + q.k * x : yb;
      for (let y = ya; y <= yb; y++) if (eh[y * W + x]) pts.push([x, y, (x - x0) / Math.max(1, x1 - x0), Math.min(1, Math.max(0, (y - ta) / Math.max(1, tb - ta)))]);
    }
    return pts;
  }
  for (const id of ['tv', 'fliperama']) if (VISTAS[id]) TELAS_DO_MOVEL[id] = VISTAS[id].map((p, l) => (l === 0 || l === 3 ? im['tela-' + id + l] ? telaDaMascara(im['tela-' + id + l], TELAS_MEDIDAS[id]?.[l]) : p.buraco ? telaDosPixels(p.buraco, null) : (TELAS_MEDIDAS[id]?.[l] ? telaMedida(p, TELAS_MEDIDAS[id][l], TELAS_MEDIDAS[id][l].recuo ?? TELAS_MEDIDAS[id].recuo, TELAS_MEDIDAS[id].painel) : telaDaVista(p, id === 'tv' ? 3 : 0)) : null));
  let AO_VIVO = null; // { rotulo, nome, sub, canal, total }: quem transmite agora (o app manda, já traduzido)
  // OS CANAIS DA TV (pedido dele, 18/10/2026: "canais de esporte, de esports… o botão direito alterna entre canais e por
  // fim desliga"): o desenho, futebol, um tiro tático e uma arena de rotas, todos por código e GENÉRICOS (nada de nome,
  // logo ou mapa de jogo de verdade). Nenhum deles tem o selo vermelho: AO VIVO só existe quando alguém transmite de
  // verdade. null é o automático (a transmissão, havendo; senão o desenho); uma transmissão que começa volta a ele.
  const CANAIS_DA_TV = ['tv', 'futebol', 'tatico', 'arena'];
  let canalDaTv = null;
  const canalDaTvAgora = () => (canalDaTv === 'ao-vivo' && !AO_VIVO ? 'tv' : canalDaTv ?? (AO_VIVO ? 'ao-vivo' : 'tv'));
  const tipoDaTela = (id) => (telasDesligadas.has(id) ? 'desligada' : id === 'mesa' ? conteudoAgora() : id === 'tv' ? canalDaTvAgora() : 'fliperama');
  const COR_DO_BRILHO = { call: [90, 110, 160], jogo: [120, 170, 210], conversa: [140, 120, 190], tv: [170, 140, 120], 'ao-vivo': [190, 90, 110], fliperama: [160, 110, 210], futebol: [110, 170, 110], tatico: [180, 160, 120], arena: [100, 140, 120] };
  // O CONTEÚDO: "auto" segue o estado (em call, a chamada; à toa, a conversa; ausente, desligada); o botão escolhe.
  const CONTEUDOS = ['auto', 'call', 'conversa', 'jogo', 'desligada'];
  let conteudo = 'auto';
  // OS ESTADOS DO BOTÃO DIREITO (16/10/2026, pedido dele: "com o botão direito alterne o estado do objeto; com o
  // esquerdo, use a função"). O abajur apagado vai com a arrumação; as telas desligadas valem nesta visita.
  let abajurApagado = false;
  const telasDesligadas = new Set();
  // O FOGÃO (relato dele, 17/10/2026: "o fogão não desliga?"): as bocas ficavam acesas a noite inteira, sem ninguém
  // cozinhando. Agora começa apagado, e o botão direito acende e apaga, nesta visita, como as telas.
  let fogaoAceso = false;
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
    if (tipo === 'futebol') {
      // O futebol: o placar no canto, o campo listrado com as linhas, dois times de cinco e a bola.
      if (t < 0.16 && s < 0.36) return t > 0.04 && t < 0.12 && ((s > 0.04 && s < 0.15) || (s > 0.21 && s < 0.32)) ? (s < 0.18 ? [120, 170, 236] : [240, 200, 90]) : [24, 28, 40];
      const b = [0.5 + Math.sin(q / 7) * 0.3, 0.58 + Math.sin(q / 5) * 0.18];
      if (Math.abs(s - b[0]) < 0.018 && Math.abs(t - b[1]) < 0.03) return [250, 250, 244];
      for (let i = 0; i < 10; i++) {
        const lado = i < 5 ? 0 : 1, j = i % 5;
        const ps = (lado ? 0.62 : 0.14) + [0, 0.1, 0.1, 0.2, 0.2][j] +Math.sin(q / 6 + i * 1.7) * 0.05 + (b[0] - 0.5) * 0.25;
        const pt = 0.26 + [0.36, 0.16, 0.56, 0.26, 0.46][j] * 1.1 + Math.cos(q / 7 + i) * 0.04;
        if (Math.abs(s - ps) < 0.02 && Math.abs(t - pt) < 0.045) return lado ? [240, 200, 90] : [120, 170, 236];
      }
      if (Math.abs(s - 0.5) < 0.012 || Math.abs(t - 0.2) < 0.016 || Math.abs(t - 0.97) < 0.02) return [226, 236, 220];
      if (Math.abs(Math.hypot((s - 0.5) * 1.4, t - 0.58) - 0.13) < 0.016) return [226, 236, 220];
      if ((s < 0.03 || s > 0.97) && t > 0.46 && t < 0.7) return [236, 236, 236];
      return Math.floor(s * 8) % 2 ? [92, 156, 82] : [104, 170, 92];
    }
    if (tipo === 'tatico') {
      // O tiro tático, em primeira pessoa: o placar dos dois times em cima, um corredor de areia com caixas, a mira no
      // meio, a arma no canto; de vez em quando alguém espia da porta do fundo.
      if (t < 0.13) {
        if (t > 0.03 && t < 0.11 && s > 0.35 && s < 0.45) return [110, 160, 230];
        if (t > 0.03 && t < 0.11 && s > 0.55 && s < 0.65) return [230, 170, 90];
        if (t > 0.05 && t < 0.09 && s > 0.47 && s < 0.53) return [220, 220, 220];
        return [22, 24, 32];
      }
      const cs = Math.abs(s - 0.5), ct = Math.abs(t - 0.52);
      if ((cs < 0.012 && ct > 0.03 && ct < 0.09) || (ct < 0.016 && cs > 0.02 && cs < 0.06)) return [140, 240, 140];
      if (t > 0.7 && s > 0.64 && (s - 0.64) * 0.9 + (t - 0.7) > 0.16) return t - 0.7 + (s - 0.64) * 0.9 < 0.2 ? [120, 122, 132] : [62, 64, 72];
      if (q % 24 < 8 && Math.abs(s - 0.5) < 0.03 && t > 0.45 && t < 0.53) return [86, 70, 62];
      if (s > 0.29 && s < 0.43 && t > 0.54 && t < 0.72) return s < 0.31 || t < 0.57 ? [176, 132, 76] : [146, 106, 58];
      if (t > 0.62) return Math.floor((t - 0.62) * 30) % 3 === 0 ? [184, 158, 110] : [198, 172, 122];
      if (s < 0.24) return [170, 144, 104];
      if (s > 0.78) return [154, 128, 92];
      if (t > 0.4) return s > 0.44 && s < 0.56 ? [58, 48, 42] : [204, 180, 134];
      return t < 0.26 ? [138, 182, 222] : [168, 202, 230];
    }
    if (tipo === 'arena') {
      // A arena de rotas, vista de cima: as duas bases nos cantos, o rio na diagonal, as três rotas, as tropas dos dois
      // lados se encontrando no meio, e a barra de habilidades embaixo.
      if (t > 0.86) {
        const k = (s - 0.25) / 0.125, slot = Math.floor(k);
        if (s > 0.25 && s < 0.75 && k % 1 > 0.18 && t > 0.89 && t < 0.97) return [[110, 170, 230], [150, 220, 160], [230, 190, 110], [220, 130, 200]][slot];
        return [26, 24, 36];
      }
      const u = s, v = t / 0.86;
      if (u < 0.14 && v > 0.8) return [90, 140, 220];
      if (u > 0.86 && v < 0.2) return [220, 110, 100];
      for (let i = 0; i < 3; i++) {
        const pa = 0.16 + ((q / 50 + i * 0.07) % 0.3), pb = 0.84 - ((q / 50 + i * 0.07) % 0.3);
        if (Math.abs(u - pa) < 0.022 && Math.abs(v - (1 - pa)) < 0.035) return [130, 180, 250];
        if (Math.abs(u - pb) < 0.022 && Math.abs(v - (1 - pb)) < 0.035) return [250, 130, 120];
      }
      const h = [0.47 + Math.sin(q / 9) * 0.05, 0.47 - Math.sin(q / 9) * 0.05];
      if (Math.abs(u - h[0]) < 0.05 && Math.abs(v - (h[1] - 0.12)) < 0.02) return u < h[0] + 0.02 ? [110, 220, 110] : [40, 40, 40];
      if (Math.abs(u - h[0]) < 0.026 && Math.abs(v - h[1]) < 0.05) return [250, 230, 160];
      if (Math.abs(u + v - 1) < 0.05 || u < 0.07 || v < 0.08 || u > 0.93 || v > 0.92) return [176, 156, 112];
      if (Math.abs(u - v) < 0.06) return [86, 140, 196];
      return Math.sin(u * 41) * Math.sin(v * 33) > 0.55 ? [46, 88, 54] : [70, 118, 70];
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
      if (OBJ_VISTAS.suco && VISTAS.balcao) a.o2 = { tipo: 'suco', em: 'balcao', s: 0.5, t: 0.15, lado: 0 };
      if (OBJ_VISTAS.refrigerante && VISTAS.balcao) a.o3 = { tipo: 'refrigerante', em: 'balcao', s: 0.5, t: 0.42, lado: 0 };
      if (OBJ_VISTAS.videogame && VISTAS.tv) a.o4 = { tipo: 'videogame', em: 'tv', s: 0.5, t: 0.82, lado: 0 };
      // as comidas em cima da ilha
      if (OBJ_VISTAS.pizza && VISTAS.ilha) a.o5 = { tipo: 'pizza', em: 'ilha', s: 0.3, t: 0.3, lado: 0 };
      if (OBJ_VISTAS.bolo && VISTAS.ilha) a.o6 = { tipo: 'bolo', em: 'ilha', s: 0.75, t: 0.3, lado: 0 };
      if (OBJ_VISTAS.salgadinho && VISTAS.ilha) a.o7 = { tipo: 'salgadinho', em: 'ilha', s: 0.5, t: 0.75, lado: 0 };
      return a;
    }
    if (OBJ_VISTAS.plantinha && VISTAS.mesa) a.o1 = { tipo: 'plantinha', em: 'mesa', s: 0.25, t: 0.82, lado: 0 };
    if (OBJ_VISTAS.livros && VISTAS.mesa) a.o2 = { tipo: 'livros', em: 'mesa', s: 0.3, t: 0.85, lado: 0 };
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
  // A FUNÇÃO DEPOIS DA ANIMAÇÃO (pedido dele, 16/10/2026: "deveria esperar a animação de abrir o guarda-roupa, para aí
  // abrir a aba de aparência"): o pedido fica guardado e sai quando as portas terminam de abrir, com uma pausa curta para
  // ver o guarda-roupa aberto. E ao fechar a aba, o app manda fechar as portas (fecharGuardaRoupa).
  let gavetasPedidas = false, gavetasAbertasEm = 0;
  window.portasDoTeste = () => ({ aberto: guardaRoupaAberto, portas }); // para o teste
  // Para onde cada móvel olha em cada posição (a ordem das vistas: Girar anda nesta lista).
  const ORIENTA = ['sudoeste', 'noroeste', 'nordeste', 'sudeste'];
  const NOMES = porTipo({ cadeira: 'a cadeira', pufe: 'o pufe', poltrona: 'a poltrona', abajur: 'o criado-mudo', 'guarda-roupa': 'o guarda-roupa', cama: 'a cama', tapete: 'o tapete', mesa: 'a mesa', 'planta-alta': 'a planta alta', 'planta-baixa': 'a samambaia', sofa: 'o sofá', tv: 'a TV', fliperama: 'o fliperama', balcao: 'o balcão', estante: 'a estante', mesinha: 'a mesinha', banqueta: 'a banqueta', 'banqueta-2': 'a outra banqueta', 'sofa-2': 'o outro sofá', 'poltrona-2': 'a outra poltrona', 'mesa-jogo': 'a mesa de jogos', 'cadeira-2': 'outra cadeira', 'cadeira-3': 'outra cadeira', 'cadeira-4': 'outra cadeira', jukebox: 'a jukebox', microfone: 'o microfone', pufao: 'o pufão', ilha: 'a ilha da cozinha', geladeira: 'a geladeira' });
  const pufes = MOVEIS.filter((m) => m.pufe);
  const fixos = MOVEIS.filter((m) => !m.pufe);
  const centro = (pe) => [(pe[0] + pe[1]) / 2, (pe[2] + pe[3]) / 2];
  const pintado = (id) => fixos.find((m) => m.id === id);
  // Onde cada móvel foi pintado, e para onde ele olha na pintura (o criado-mudo e o guarda-roupa, de frente para o quarto).
  const LADO_PINTADO = { abajur: 3, 'guarda-roupa': 3, cama: 0, tapete: 0 };
  // O tamanho em casas inteiras, para a grade: o pufe 2 × 2, o tapete 4 × 4, o resto medido no desenho.
  const tamDe = (id, lado) => {
    if (tipoDe(id) === 'pufe') return [2, 2];
    if (tipoDe(id) === 'tapete') return [4, 4];
    const m = VISTAS[id]?.[lado].mede;
    if (m) return m.map((d) => Math.max(1, Math.ceil(d - 0.25)));
    const pe = pintado(id).pe; return [pe[1] - pe[0], pe[3] - pe[2]];
  };
  // (preso DENTRO do chão: a planta alta, 2 × 2, pedida em 7,5 arredondava para 8 e ficava com meio vaso fora do quarto,
  // relato de 15/10/2026)
  const encaixar = (id, u, v, lado) => { const [tu, tv] = tamDe(id, lado), dentro = (x, t) => Math.max(t / 2, Math.min(N - t / 2, x)); return [dentro(Math.round(u - tu / 2) + tu / 2, tu), dentro(Math.round(v - tv / 2) + tv / 2, tv)]; };
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
      por('planta-baixa', 10.5, 15.4, 0);
      // o canto do karaokê, na parede da TV: a jukebox e o microfone com a caixa de som
      por('jukebox', 0.8, 12.3, 0);
      por('microfone', 1.6, 14.6, 0);
      // a mesa de jogos, no meio da frente, com as quatro cadeiras viradas para ela
      // (a mesa ocupa 2 × 2 casas e a cadeira 1 × 1: em cata-vento, uma de cada lado, meia casa para o lado, para caber na
      // grade sem cair em cima da mesa)
      por('mesa-jogo', 7, 13, 0);
      por('cadeira', 5.5, 12.5, 0);
      por('cadeira-2', 8.5, 13.5, 2);
      por('cadeira-3', 7.5, 11.5, 3);
      por('cadeira-4', 6.5, 14.5, 1);
      // A COZINHA AMERICANA (15/10/2026), no fim da parede de tijolo da esquerda: a geladeira encostada, e a ilha na frente
      por('geladeira', 15.2, 0.8, 3);
      por('ilha', 13.6, 3.4, 3);
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
    // A ARRUMAÇÃO DE FÁBRICA É A DELE (16/10/2026: "eu quero essa configuração, com exceção da poltrona, como base inicial
    // do quarto para as pessoas"): a mesa e o guarda-roupa na parede da esquerda, as plantas entre eles, a cama e o
    // criado-mudo na da janela, o pufe no tapete. A poltrona começa GUARDADA (GUARDADOS_DE_FABRICA); posta de volta, vai
    // para o canto da frente.
    const DELE = { pufe: [4, 4, 0], poltrona: [7, 5, 0], cama: [1.5, 7, 0], abajur: [0.5, 5.5, 0], 'guarda-roupa': [6, 0.5, 3], tapete: [5, 4, 0], mesa: [1.5, 0.5, 3], 'planta-alta': [4.5, 0.5, 0], 'planta-baixa': [7.5, 0.5, 0] };
    for (const [id, [u, v, lado]] of Object.entries(DELE)) if (a[id]) a[id] = { c: [u, v], lado };
    return a;
  }
  // Onde cada móvel PINTADO no quarto está na pintura: lá, e só lá, aparece a pintura dele (com a luz e a sombra de lá).
  // Antes a comparação era com a arrumação de fábrica, que era a própria pintura; desde que a de fábrica é a dele, não é.
  // (no salão, o tapete pintado vale onde a arrumação de fábrica dele o põe, como sempre foi)
  const PINTURA_NO_QUARTO = Object.fromEntries(fixos.map((m) => [m.id, { c: centro(m.pe), lado: LADO_PINTADO[m.id] ?? 0 }]));
  const origemPintada = (id) => (CENA === 'salao' ? INICIAL[id] : PINTURA_NO_QUARTO[id]);
  const INICIAL = arrumacaoInicial();
  // A ARRUMAÇÃO DE CADA UM fica no navegador por enquanto (na página de teste); no app, ela vai para o servidor.
  let ARR = JSON.parse(JSON.stringify(INICIAL));
  try {
    const guardada = JSON.parse(localStorage.getItem(PREFIXO + 'arrumacao-2') ?? 'null');
    // Móvel novo (as plantas, 15/10/2026) entra no lugar de fábrica, sem desfazer o resto do que a pessoa arrumou.
    if (guardada) for (const id of Object.keys(guardada)) if ((INICIAL[id] || (ehCopia(id) && INICIAL[tipoDe(id)])) && guardada[id]?.c) ARR[id] = guardada[id];
  } catch { /* sem guardar: começa da inicial */ }
  // A planta guardada quando ocupava 2 × 2 (até 16/10/2026) tem o centro no canto de uma casa: volta para dentro de uma.
  const reencaixarPlantas = () => { for (const id of ['planta-alta', 'planta-baixa']) if (ARR[id]) ARR[id].c = encaixar(id, ...ARR[id].c, ARR[id].lado); };
  reencaixarPlantas();
  // GUARDAR E PÔR MÓVEIS (pedido dele, 16/10/2026: "quero diminuir [os móveis] no quarto e não acho a opção"). Guardado, o
  // móvel sai da arrumação e fica numa lista; pôr de volta acha a casa livre mais perto da de fábrica. Móvel com FUNÇÃO
  // (o guarda-roupa, a mesa, a TV…) não se guarda, senão a função some junto; nem a cama do quarto, onde o coelho dorme
  // quando a pessoa está ausente (a tela não mente).
  const SO_COM_FUNCAO = CENA === 'salao' ? ['tv', 'fliperama', 'estante', 'balcao', 'microfone', 'jukebox'] : ['guarda-roupa', 'abajur', 'mesa', 'cama'];
  const podeGuardar = (id) => !!INICIAL[id] && !SO_COM_FUNCAO.includes(id);
  // Os guardados de fábrica (a poltrona, no quarto: decisão dele, 16/10/2026). Quem já tinha arrumado antes da lista
  // existir fica com o que tinha.
  const GUARDADOS_DE_FABRICA = CENA === 'quarto' ? ['poltrona'] : [];
  let GUARDADOS = new Set();
  try {
    const gg = localStorage.getItem(PREFIXO + 'guardados');
    GUARDADOS = new Set((gg !== null ? JSON.parse(gg) || [] : localStorage.getItem(PREFIXO + 'arrumacao-2') ? [] : GUARDADOS_DE_FABRICA).filter(podeGuardar));
  } catch { GUARDADOS = new Set(GUARDADOS_DE_FABRICA.filter(podeGuardar)); }
  for (const id of GUARDADOS) delete ARR[id];
  const guardarGuardados = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'guardados', JSON.stringify([...GUARDADOS])); } catch { /* fica só nesta visita */ } };
  window.arrumacaoDoTeste = () => ARR; // para o teste
  const guardar = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'arrumacao-2', JSON.stringify(ARR)); } catch { /* fica só nesta visita */ } enviar(); };
  const ehDeitado = (id) => tipoDe(id) === 'tapete';
  // No lugar da pintura? (mesmo centro e mesma posição; a cama de casal nunca, ela não foi pintada aqui)
  const noLugar = (id, c = ARR[id].c, lado = ARR[id].lado) =>
    id !== 'pufe' && id !== 'poltrona' && !(id === 'guarda-roupa' && VISTAS_ABERTO) && !(id === 'abajur' && VISTAS.abajur) && pintado(id) && !(id === 'cama' && VISTAS.cama) && !(id === 'mesa')
    && !!origemPintada(id) && Math.abs(c[0] - origemPintada(id).c[0]) < 0.01 && Math.abs(c[1] - origemPintada(id).c[1]) < 0.01 && lado === origemPintada(id).lado;
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
  // O app diz no endereço se é noite (16/10/2026, relato dele: "por um segundo o quarto começa de dia, depois carrega a
  // noite"): a mensagem com o tema só chega depois do "pronto", e o primeiro quadro saía de dia.
  let pegado = null, selecionado = 'poltrona', modo = MODO_APP && new URLSearchParams(location.search).has('noite') ? 'noite' : 'dia', grade = false, arrastando = false, alvo = null;
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
    else naMesa();
    soltarDosMoveis();
  }
  function naMesa() { const L = lugarNaMesa(); if (L) Object.assign(cadeira, { u: L.P0[0], v: L.P0[1], th: L.th, vu: 0, vv: 0, w: 0, kin: null }); }
  // A CADEIRA DENTRO DE UM MÓVEL (relato de 15/10/2026: "a cadeira do PC está atravessando a mesa"): a arrumação mudou
  // (a inicial, ou a de outro computador) e a cadeira guardada ficou onde agora há móvel. A física só a empurra quando ela
  // anda; parada, ela volta para a frente da mesa.
  function soltarDosMoveis() {
    const dentro = Object.keys(ARR).some((id) => { if (ehDeitado(id)) return false; const [u0, u1, v0, v1] = peDe(id); return cadeira.u > u0 && cadeira.u < u1 && cadeira.v > v0 && cadeira.v < v1; });
    if (dentro) naMesa();
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
  const PESO = porTipo({ pufe: 1.5, poltrona: 3, abajur: 3, tapete: 4, mesa: 6, cama: 14, 'guarda-roupa': 18, 'planta-alta': 2.5, 'planta-baixa': 1.5, sofa: 12, tv: 8, fliperama: 16, balcao: 14, estante: 15, mesinha: 4, banqueta: 1.5, 'banqueta-2': 1.5, 'sofa-2': 12, 'poltrona-2': 3, 'mesa-jogo': 6, 'cadeira-2': 2, 'cadeira-3': 2, 'cadeira-4': 2, jukebox: 14, microfone: 3, pufao: 2, ilha: 14, geladeira: 16 });
  let viva = null; // { id, orig, modo: 'arrasto' | 'deslize' | 'encaixe', vu, vv, de, para, t0 }
  // O "TCHAN" AO COLOCAR (ideia dele, 14/10/2026, como no Hozy): o móvel que assenta solta faíscas de pixel pela borda
  // do pé dele no chão, que sobem um pouco e somem. Enquanto está pego, ele tem um contorno branco.
  let particulas = [], notas = [], proximaNota = 0;
  // A notinha em pixel: a colcheia (♪) e, às vezes, duas ligadas (♫).
  const NOTA = ['..##', '..#.#', '..#..', '..#..', '###..', '###..', '.#...'];
  const NOTA_DUPLA = ['.#####', '.#...#', '.#...#', '.#...#', '##..##', '##.###', '#...#.'];
  const ondeEstaANota = (n, agora) => { const t = (agora - n.t0) / 1000; return [Math.round(n.x + n.lado * (t * 5 + Math.sin(t * 3) * 3)), Math.round(n.y - t * 14)]; };
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
  function tingirPixel(r, g, b, alvo) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, d = mx - mn;
    let h = 0, sat = mx ? d / mx : 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
    // A borda traz pixels da madeira do chão (o recorte antigo): eles SAEM, e o chão de verdade aparece no lugar.
    if (sat > 0.2 && (h < 0.12 || h > 0.95)) return null;
    // O CONTORNO E A LISTA DE DENTRO são do tapete, num cinza arroxeado fora do tom da sálvia: ficavam sem tingir e, no
    // tapete azul ou rosa, viravam uma linha de outra cor (relato dele, 17/10/2026). Eles recebem o tom novo direto.
    if (sat > 0.06 && Math.abs(h - 0.158) > 0.07) h = alvo.h;
    else h = (((h - 0.158 + alvo.h) % 1) + 1) % 1;
    sat = Math.min(1, sat * alvo.s);
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
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) {
      const novo = tingirPixel(movel[k * 4], movel[k * 4 + 1], movel[k * 4 + 2], cor);
      if (!novo) { movel[k * 4 + 3] = 0; continue; }
      movel[k * 4] = novo[0]; movel[k * 4 + 1] = novo[1]; movel[k * 4 + 2] = novo[2];
    }
    return (porCor[CORES.tapete] = { ...p, movel });
  }
  // O TAPETE MEXIDO: o desenho é levado pelo chão, ponto a ponto (ele é plano, então girar é só girar a textura).
  const cacheDoTapete = new Map();
  function tapeteEm(c, lado) {
    const chave = c.join(',') + '|' + lado;
    if (cacheDoTapete.has(chave)) return cacheDoTapete.get(chave);
    const orig = pecas.tapete, [oc0, oc1] = origemPintada('tapete').c; // onde ele está na pintura (desde 16/10 a arrumação de fábrica é outra)
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
    const r = {};
    if (ARR.cama) {
    const olhaC = ORIENTA[ARR.cama.lado], [fu, fv] = VET[olhaC], peC = peMedidoDe('cama'), eixoU = fu !== 0;
    const cab = eixoU ? (fu > 0 ? peC[0] : peC[1]) : (fv > 0 ? peC[2] : peC[3]);
    const ondeC = eixoU ? [cab + fu * 1.25, (peC[2] + peC[3]) / 2 - 0.1] : [(peC[0] + peC[1]) / 2 - 0.1, cab + fv * 1.25];
    // O LADO COMPRIDO POR ONDE ELE SOBE: o da frente da tela, se ali há chão livre; senão, o outro (relato dele, 16/10/2026:
    // com a cama encostada na borda da frente, ele tentava subir pelo lado de fora do quarto e atravessava a cama).
    const frenteC = eixoU ? [ondeC[0], peC[3] + 0.12] : [peC[1] + 0.12, ondeC[1]], fundoC = eixoU ? [ondeC[0], peC[2] - 0.12] : [peC[0] - 0.12, ondeC[1]];
    const chaoLivre = ([u, v], [du, dv]) => { const i = Math.floor(u + du * 0.4), j = Math.floor(v + dv * 0.4); return i >= 0 && j >= 0 && i < N && j < N && livre(i, j); };
    const beiraC = chaoLivre(frenteC, eixoU ? [0, 1] : [1, 0]) || !chaoLivre(fundoC, eixoU ? [0, -1] : [-1, 0]) ? frenteC : fundoC;
      // Na cama ele DEITA (lendo ou dormindo), no meio do colchão, a cabeça para a cabeceira (pedido dele, 14/10/2026).
      r.cama = { ao: vizinhas(...peDe('cama')), onde: ondeC, beira: beiraC, sobe: 40, pose: 'na cama', olha: olhaC, sobre: 'cama' };
    }
    // O GUARDA-ROUPA: ele para na casa da frente dele, olhando para ele.
    const OPOSTO = { sudoeste: 'nordeste', nordeste: 'sudoeste', sudeste: 'noroeste', noroeste: 'sudeste' };
    if (ARR['guarda-roupa']) {
      const olhaG = ORIENTA[ARR['guarda-roupa'].lado], [gu, gv] = VET[olhaG], peG = peDe('guarda-roupa'), [gcu, gcv] = centro(peG);
      const frenteG = [Math.floor(gcu + gu * ((peG[1] - peG[0]) / 2 + 0.5)), Math.floor(gcv + gv * ((peG[3] - peG[2]) / 2 + 0.5))];
      r['guarda-roupa'] = { ao: [frenteG].filter(([i, j]) => livre(i, j)), onde: null, sobe: 0, pose: 'parado', olha: OPOSTO[olhaG] };
    }
    // O pufe é redondo: ele senta virado para qualquer um dos 4 lados (sorteado ao chegar) e vira de vez em quando.
    if (ARR.pufe) r.pufe = { ao: em2x2(ARR.pufe.c), onde: assentoNoPufe(), sobe: 26, pose: 'sentado', olha: coelho.olharNoPufe ?? 'sudeste', sobre: 'pufe' };
    // Virada de costas, o encosto fica NA FRENTE do coelho: ele é desenhado antes dela.
    if (ARR.poltrona) { const olhaP = ORIENTA[ARR.poltrona.lado]; r.poltrona = { ao: vizinhas(...peDe('poltrona')), onde: [...ARR.poltrona.c], sobe: 8, pose: 'sentado', olha: olhaP, sobre: 'poltrona', atras: olhaP.startsWith('n') }; }
    if (VISTAS_CADEIRA && ARR.mesa) { r.cadeira = pontoDaCadeira(); r.mesa = pontoDaCadeira(); }
    // O ABAJUR (16/10/2026, para a função vir depois da animação): ele para numa casa ao lado, olhando para o abajur.
    if (ARR.abajur) {
      const pa = peDe('abajur'), [au, av] = centro(pa), du = au - coelho.u, dv = av - coelho.v;
      r.abajur = { ao: vizinhas(...pa), onde: null, sobe: 0, pose: 'parado', olha: Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 'sudoeste' : 'nordeste') : (dv > 0 ? 'sudeste' : 'noroeste') };
    }
    return r;
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
      // ONDE NADA DO TAMPO O COBRE (relato de 17/10/2026: "o refrigerante está atravessando o coelho"): ao longo do balcão,
      // ele fica na casa mais longe dos objetos que estão em cima; empatando, a do meio.
      const aoLongo = fu === 0 ? 0 : 1, [a0, a1] = aoLongo === 0 ? [pe[0], pe[1]] : [pe[2], pe[3]];
      const objs = Object.values(EM_CIMA).filter((o) => o.em === 'balcao').map((o) => ondeEmCima(o)[aoLongo]);
      const casas = [];
      for (let i = Math.floor(a0); i < Math.ceil(a1); i++) { const c = [...atras]; c[aoLongo] = i; if (livre(c[0], c[1])) casas.push(c); }
      const cobrem = (c) => objs.filter((x) => Math.abs(c[aoLongo] + 0.5 - x) < 0.75).length;
      const folga = (c) => Math.min(9, ...objs.map((x) => Math.abs(c[aoLongo] + 0.5 - x)));
      casas.sort((x, y) => cobrem(x) - cobrem(y) || folga(y) - folga(x) || Math.abs(x[aoLongo] - atras[aoLongo]) - Math.abs(y[aoLongo] - atras[aoLongo]));
      r.balcao = { ao: casas.length ? casas.slice(0, 1) : [atras].filter(([i, j]) => livre(i, j)), onde: null, sobe: 0, pose: 'parado', olha, atras: true };
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
  // Até onde um assento conta como "vendo a TV" (casas do centro dela): o sofá da frente cabe, o do outro lado do salão não.
  const PERTO_DA_TV = 5;
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
    // A TURMA DA PARTIDA EM VOLTA (pergunta dele, 17/10/2026: "se tiver mais de uma pessoa jogando mini-game, o que
    // acontece?"): só o primeiro cabia na máquina, e o resto ia para o sofá, como se não estivesse no jogo. Agora quem
    // joga junto (até mais três) fica de pé atrás e dos lados do fliperama, olhando para a tela;
    // quem passa disso volta ao sofá, para a roda não virar um bolo na frente da TV. Na TV, a segunda pessoa transmitindo fica
    // ao lado da primeira.
    const emVolta = (id, lugares) => {
      if (!ARR[id]) return [];
      const [fu, fv] = VET[ORIENTA[ARR[id].lado]], pe = peDe(id), [cu, cv] = centro(pe), meia = Math.abs(fu) ? (pe[1] - pe[0]) / 2 : (pe[3] - pe[2]) / 2;
      const [lu, lv] = [fv, fu]; // o lado (perpendicular à frente, no chão)
      const tela = [cu + fu * meia, cv + fv * meia];
      return lugares.map(([frente, lado]) => [cu + fu * (meia + frente) + lu * lado, cv + fv * (meia + frente) + lv * lado])
        .filter(([u, v]) => u > 0.3 && v > 0.3 && u < N - 0.3 && v < N - 0.3 && livre(Math.floor(u), Math.floor(v)))
        .map(([u, v]) => ({ u, v, sobe: 0, pose: 'parado', olha: DIAGONAL(tela[0] - u, tela[1] - v), sobre: null }));
    };
    // primeiro os lugares do lado de lá da TV (os dois móveis costumam ficar lado a lado, e a turma de um engolia o outro)
    const longeDaTv = (x) => (ARR.tv ? -Math.hypot(x.u - centro(peDe('tv'))[0], x.v - centro(peDe('tv'))[1]) : 0);
    fliperama.push(...emVolta('fliperama', [[1.0, 1.1], [1.0, -1.1], [2.0, 0]]).sort((a, b) => longeDaTv(a) - longeDaTv(b)));
    tv.push(...emVolta('tv', [[1.6, 1], [1.6, -1]]));
    // O CHÃO PERTO DA TV (relato dele, 17/10/2026: "um coelho vendo transmissão foi parar no sofá da sala"): quem está na
    // call está vendo a TV, e quem não cabe no sofá dela fica de pé AO LADO do sofá, na mesma fileira, virado para a tela,
    // e não no outro sofá, do outro lado do salão. Nunca entre o sofá e a TV (taparia a tela e embolaria os nomes).
    // Medido no eixo da TV: "frente" é o quanto a casa está diante da tela, "lado" o quanto está para o lado.
    const alvoTv = ARR.tv ? centro(peDe('tv')) : null;
    if (alvoTv) {
      const [fu, fv] = VET[ORIENTA[ARR.tv.lado]], [lu, lv] = [fv, fu];
      const eixo = (u, v) => [(u - alvoTv[0]) * fu + (v - alvoTv[1]) * fv, (u - alvoTv[0]) * lu + (v - alvoTv[1]) * lv];
      // a fileira do sofá que vê a TV (o mais perto dela); sem sofá, uma fileira a 3 casas
      const sofa = ['sofa', 'sofa-2'].filter((id) => ARR[id]).map((id) => ({ id, c: centro(peDe(id)) })).sort((a, b) => Math.hypot(a.c[0] - alvoTv[0], a.c[1] - alvoTv[1]) - Math.hypot(b.c[0] - alvoTv[0], b.c[1] - alvoTv[1]))[0];
      const [fileira] = sofa ? eixo(...sofa.c) : [3];
      const pe = sofa && peDe(sofa.id), meiaDoSofa = sofa ? Math.max(Math.abs(pe[1] - pe[0]), Math.abs(pe[3] - pe[2])) / 2 + 0.4 : 0.6;
      const lugares = todasAsCasas()
        .filter(([i, j]) => livre(i, j))
        .map(([i, j]) => ({ i, j, e: eixo(i + 0.5, j + 0.5) }))
        .filter(({ e: [frente, lado] }) => frente >= 1.5 && frente <= fileira + 1.5 && !(frente < fileira + 0.6 && Math.abs(lado) < meiaDoSofa))
        .sort((a, b) => Math.abs(a.e[0] - fileira) + 0.5 * Math.abs(a.e[1]) - (Math.abs(b.e[0] - fileira) + 0.5 * Math.abs(b.e[1])));
      for (const { i, j } of lugares.slice(0, 8)) chao.push({ u: i + 0.5, v: j + 0.5, sobe: 0, pose: 'parado', olha: DIAGONAL(alvoTv[0] - i - 0.5, alvoTv[1] - j - 0.5), sobre: null });
    } else {
      const meio = ARR.mesinha ? centro(peDe('mesinha')) : [N / 2, N / 2];
      const livres = todasAsCasas().filter(([i, j]) => livre(i, j)).sort((a, b) => Math.hypot(a[0] + 0.5 - meio[0], a[1] + 0.5 - meio[1]) - Math.hypot(b[0] + 0.5 - meio[0], b[1] + 0.5 - meio[1]));
      for (const [i, j] of livres.slice(0, 8)) chao.push({ u: i + 0.5, v: j + 0.5, sobe: 0, pose: 'parado', olha: 'sudoeste', sobre: null });
    }
    // OS ASSENTOS, DO MAIS PERTO DA TV AO MAIS LONGE; os perto (até PERTO_DA_TV casas) vêm antes do chão, os longe depois
    const dTv = (x) => (alvoTv ? Math.hypot(x.u - alvoTv[0], x.v - alvoTv[1]) : 0);
    sentar.sort((a, b) => dTv(a) - dTv(b));
    const perto = sentar.filter((x) => dTv(x) <= PERTO_DA_TV), longe = sentar.filter((x) => dTv(x) > PERTO_DA_TV);
    return { sentar: perto, tv, fliperama, chao, longe };
  }
  function lugaresDasPessoas() {
    const L = lugaresDoSalao(), usados = [];
    // um lugar DE PÉ a menos de 0,8 casa de outro já tomado é pulado (as rodas da TV e do fliperama se cruzam); os assentos
    // do sofá são mais juntos que isso e valem todos
    const pegar = (lista) => { let x; while ((x = lista.shift()) && !x.sobre && usados.some((y) => Math.hypot(y.u - x.u, y.v - x.v) < 0.8)); if (x) usados.push(x); return x; };
    return PESSOAS.map((pessoa) => ({ pessoa, lugar: (pessoa.papel === 'transmitindo' && pegar(L.tv)) || (pessoa.papel === 'jogando' && pegar(L.fliperama)) || pegar(L.sentar) || pegar(L.chao) || pegar(L.longe) || null })).filter((x) => x.lugar);
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
      itens.push({ p, dx: 0, dy: 0, fator: 1, pe: [lugar.u - r, lugar.u + r, lugar.v - r, lugar.v + r], sobre: lugar.sobre,
        // DE COSTAS PARA QUEM OLHA (relato dele, 16/10/2026: "parece que os coelhos estão flutuando no sofá"): virado para a
        // TV, quem senta tem o encosto do NOSSO lado, e o móvel vai por cima dele, como o coelho na poltrona do quarto
        atras: !!lugar.sobre && String(lugar.olha).startsWith('n'), nome: pessoa.nome, cabeca: [px, Y0 + a.topo] });
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
  // A ANIMAÇÃO ANTES DA FUNÇÃO (pedido dele, 16/10/2026: "todos os móveis que possuem função deveriam primeiro tocar a
  // animação, depois a funcionalidade"): clicado o móvel, o coelho vai até ele e faz o que faz ali (senta ao computador,
  // para diante do abajur), e só então a função abre. O guarda-roupa já era assim (as portas abrem antes da aba).
  let funcaoNaChegada = null; // { destino, f, prazo }
  const destinoDe = (id) => (id === 'mesa' ? 'cadeira' : id);
  function cumprirNaChegada(destino, agora) {
    if (!funcaoNaChegada || (destino && funcaoNaChegada.destino !== destino)) return;
    const { f, prazo } = funcaoNaChegada;
    funcaoNaChegada = null; clearTimeout(prazo);
    if (agora) acao(f); else setTimeout(() => acao(f), 200);
  }
  function pedirNaChegada(id, f) {
    const destino = destinoDe(id);
    if (funcaoNaChegada) clearTimeout(funcaoNaChegada.prazo);
    funcaoNaChegada = null;
    // já está lá (sentado ao computador, parado diante do abajur): a função vem na hora
    if (coelho.destino === destino && !coelho.caminho.length && !coelho.trans && !coelho.aproximar && !coelho.descendo) { acao(f); return; }
    // se algo prender o coelho no caminho, a função não se perde
    funcaoNaChegada = { destino, f, prazo: setTimeout(() => cumprirNaChegada(destino, true), 8000) };
    ir(id);
  }
  function ir(id) {
    // Outro destino (o estado mudou e ele foi para outro lugar): a função pedida não espera mais por ele.
    if (funcaoNaChegada && funcaoNaChegada.destino !== destinoDe(id)) cumprirNaChegada(null, true);
    const pt = pontos()[id];
    if (!pt || !pt.ao.length) return cumprirNaChegada(destinoDe(id), true);
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
    if (!c) return cumprirNaChegada(destinoDe(id), true);
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
    if (!pt.onde) { if (coelho.destino === 'guarda-roupa' && VISTAS_ABERTO) { guardaRoupaAberto = true; if (FUNCOES?.gavetas && !soVer && !EDITANDO) gavetasPedidas = true; } return chegarDeVez(); }
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
    if (coelho.destino === 'cadeira') { const L = lugarNaMesa(); coelho.descendo = true; levarCadeira(L.S, L.th, 700, () => { coelho.descendo = false; cumprirNaChegada('cadeira'); if (coelho.redecidir) { coelho.redecidir = false; decidir(); } }); }
    else cumprirNaChegada(coelho.destino);
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
  let ultimaCaixa = null, coelhoPe = null, coelhoTopo = 0, coelhoChave = 0, rotuloDoQuadro = '', coelhoLinha = W, coelhoSobre = null, coelhoAtras = false;
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
    coelhoAtras = sobreT ? atrasT : sentado ? !!pt.atras : false;
    return [{ p, dx: 0, dy: 0, fator: 1, pe: area, sobre, atras: coelhoAtras }];
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
  const FORMAS = porTipo({
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
  });
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
    if (a.sobre && a.sobre === (b.dono ?? b.p.id)) return a.atras;
    if (b.sobre && b.sobre === (a.dono ?? a.p.id)) return !b.atras;
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
    // AS NOTAS DA JUKEBOX (ideia dele, 15/10/2026): uma notinha a cada ~0,9 s, que sobe balançando e some. É partícula:
    // só com a opção ligada (Gráficos → Partículas), porque animação obriga a redesenhar.
    if (topoDaJukebox && liga('particulas')) {
      const t = performance.now();
      notas = notas.filter((n) => t - n.t0 < n.vida);
      if (notas.length < 4 && t > proximaNota) { proximaNota = t + 700 + Math.random() * 500; notas.push({ x: topoDaJukebox[0] + (Math.random() - 0.5) * 16, y: topoDaJukebox[1], t0: t, vida: 2600 + Math.random() * 800, lado: Math.random() < 0.5 ? -1 : 1, dupla: Math.random() < 0.35, cor: [[255, 214, 120], [255, 170, 110], [250, 150, 190], [170, 220, 255]][Math.floor(Math.random() * 4)] }); }
    } else if (notas.length) notas = [];
    const agora = performance.now(), dt = Math.min(0.25, (agora - ultimo) / 1000);
    ultimo = agora;
    coelho.quadro++;
    esbarrao(dt);
    if (VISTAS_ABERTO) {
      const alvoP = guardaRoupaAberto ? 3 : 0;
      if (!PASSAGEM_GR) portas = alvoP;
      else if (portas !== alvoP && coelho.quadro % 2 === 0) portas += Math.sign(alvoP - portas);
      if (gavetasPedidas && portas === 3) {
        gavetasAbertasEm ||= agora;
        if (agora - gavetasAbertasEm >= 250) { gavetasPedidas = false; gavetasAbertasEm = 0; acao('gavetas'); }
      } else if (!guardaRoupaAberto) { gavetasPedidas = false; gavetasAbertasEm = 0; }
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
    if (tipoDe(id) === 'pufe') {
      const [pu, pv] = c, p = pecas[varianteDoPufe().id];
      const [ox, oy] = p.base, [nx, ny] = ponto(pu, pv);
      // Só intensidade: a luz do chão onde ele está, sobre a luz do chão onde ele foi pintado.
      const fator = Math.min(1.3, Math.max(0.75, luz(nx, ny) / luz(ox, oy)));
      return { p: { ...p, id: 'pufe' }, dx: Math.round(nx - ox), dy: Math.round(ny - oy), fator, pe: [pu - 0.75, pu + 0.75, pv - 0.75, pv + 0.75], forma: FORMAS.pufe };
    }
    if (noLugar(id)) { const m = pintado(id); return { p: id === 'tapete' ? tingir(pecas[id]) : pecas[id], dx: 0, dy: 0, fator: 1, pe: m.pe, deitado: m.deitado, forma: FORMAS[id], olha }; }
    if (tipoDe(id) === 'tapete') return { p: tingir(tapeteEm(c, l)), dx: 0, dy: 0, fator: 1, pe: peDe(id), deitado: true };
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
  let luzDoFogao = null;
  const dentroDoPoligono = (x, y, P) => { let dentro = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro; } return dentro; };
  let lampadaAgora = [0, 0], telasAgora = [], caixaDaTela = null, regiaoDasFaiscas = null, luzDaJukebox = null, topoDaJukebox = null;
  const lampada = () => lampadaAgora;
  // O criado-mudo pintado tinha falhas onde a cama antiga o tapava (relato de 14/10/2026, ao tirar a cama): ele é
  // sempre a vista solta, e a luz pintada vale com ele no lugar e na posição de origem.
  const naOrigem = (id) => !!origemPintada(id) && Math.abs(ARR[id].c[0] - origemPintada(id).c[0]) < 0.01 && Math.abs(ARR[id].c[1] - origemPintada(id).c[1]) < 0.01 && ARR[id].lado === origemPintada(id).lado;
  const luzPintadaAgora = () => CENA === 'quarto' && modo === 'noite' && luzPintada && !abajurApagado && ARR.abajur && naOrigem('abajur');
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
        // VIDRO, E NÃO NÉVOA (relato dele, 17/10/2026: "os vidros ainda estão embaçados"): a parede atrás é creme, e somar o
        // creme do reflexo por cima dava um painel leitoso. Agora a parede passa ESCURECIDA e um pouco azulada (o vidro
        // come luz), e o reflexo é só uma faixa diagonal fina, que é o que o olho lê como vidro.
        else if (vidroAberto[k]) {
          const brilho = (x + y) % 11 < 2 ? 1 : 0;
          D[k * 3 + c] = semDia[k * 4 + c] * 0.7 + [150, 178, 205][c] * 0.12 + brilho * [60, 62, 58][c];
          fundoNoite[k * 3 + c] = semNoite[k * 4 + c] * 0.72 + [40, 52, 90][c] * 0.12 + brilho * [26, 30, 40][c];
        }
        else { D[k * 3 + c] = abertaDia[k * 4 + c]; fundoNoite[k * 3 + c] = abertaDia[k * 4 + c] * Math.min(1, noitePe[k * 4 + c] / Math.max(1, diaPe[k * 4 + c])); }
      }
    }
    // a janela aberta (com a cortina aberta): o chão sem o luar da fechada, mais o luar do vão aberto
    if (aberta && !fechada && luarAbertoNoChao.some(Boolean)) for (let k = 0; k < W * W; k++) {
      if (casa[k] < 0 || naJanela[k]) continue;
      const sem = pintada ? abajurSemLuar : noiteSemLuar;
      for (let c = 0; c < 3; c++) fundoNoite[k * 3 + c] = sem[k * 4 + c] * (luarAbertoNoChao[k] ? ganhoDaJanela[c] : 1);
    }
    if (fechada) for (let k = 0; k < W * W; k++) {
      if (naJanela[k]) { for (let c = 0; c < 3; c++) { D[k * 3 + c] = cortinaDia[k * 4 + c]; fundoNoite[k * 3 + c] = cortinaNoite[k * 4 + c]; } }
      else if (casa[k] >= 0) { const sem = pintada ? abajurSemLuar : noiteSemLuar; for (let c = 0; c < 3; c++) fundoNoite[k * 3 + c] = sem[k * 4 + c]; }
    }
    // O QUE A LUZ DO ABAJUR (por código) ACLARA: a parede como ela está AGORA. A pintura base tem a janela fechada e sem
    // cortina; com a janela aberta, a luz desenhava a grade dela, como um fantasma, por cima da paisagem (relato dele,
    // 16/10/2026). O vão aberto é o lado de fora: o abajur não o alcança.
    baseDaLuz.set(base);
    if (aberta || fechada) for (let k = 0; k < W * W; k++) {
      if (fechada ? !naJanela[k] : !noCaixilho[k]) continue;
      for (let c = 0; c < 3; c++) baseDaLuz[k * 4 + c] = !fechada && vao[k] ? 0 : D[k * 3 + c];
    }
    // Os móveis, de trás para a frente (a ordem pela área no chão).
    // O móvel que está sendo arrastado ou deslizando não entra na fotografia: ele é desenhado vivo, a cada quadro.
    variante = varianteDoPufe();
    const lista0 = Object.keys(ARR).filter((id) => !(viva && viva.id === id)).map((id) => ({ ...itemDe(id), dono: id }));
    const pessoas = CENA === 'salao' ? itensDasPessoas() : [];
    lista0.push(...pessoas);
    for (const it of lista0) if (it.forma) it.caixas = caixasDe(it.pe, it.olha, it.forma);
    lista = ordenar(lista0);
    listaAgora = lista;
    chaoPx.fill(-2);
    chaveDoPixel.fill(-1);
    let tampoDaIlha = null; luzDoFogao = null;
    if (fogaoAceso && ARR.ilha && TOPOS.ilha) {
      const pe = peDe('ilha'), m2 = 0.22;
      tampoDaIlha = [[pe[0] + m2, pe[2] + m2], [pe[1] - m2, pe[2] + m2], [pe[1] - m2, pe[3] - m2], [pe[0] + m2, pe[3] - m2]].map(([u, v]) => { const [x, y] = ponto(u, v); return [x, y - TOPOS.ilha]; });
      const [cu, cv] = centro(pe), [x, y] = ponto(cu, cv); luzDoFogao = [x, y - TOPOS.ilha];
    }
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
          eMovel[d] = 1; peY[d] = p.peColuna[k % W] + dy; dono[d] = it.dono ?? p.id; donoObj[d] = p.objPx ? p.objPx[k] : '';
          // A altura visível (da forma) dá o ponto do chão embaixo dele e a profundidade; fora da forma, o pé da coluna.
          const h = hs.h(k);
          // O que fica DEITADO (o tapete) nunca está na frente de nada: com a profundidade do próprio pixel, a borda da
          // frente dele cortava as rodinhas da cadeira (relato de 14/10/2026).
          if (it.deitado) { chaoPx[d] = y * W + x; alturaPx[d] = 0; tipoPx[d] = 0; chaveDoPixel[d] = -1; }
          else if (h >= 0) { chaoPx[d] = (y + h) * W + x; alturaPx[d] = h; tipoPx[d] = hs.tipo(k); chaveDoPixel[d] = y + h; }
          else { const pc = Math.min(W - 1, peY[d]); chaoPx[d] = pc * W + x; alturaPx[d] = pc - y; tipoPx[d] = 0; chaveDoPixel[d] = pc; }
          // O CHÃO FORA DO QUARTO (relato dele, 16/10/2026: "a folha fora parece ter uma iluminação"): a folha da planta que
          // passa da quina fica numa coluna sem chão (o fundo, ou a faixa escura da espessura da parede), e lá a luz da
          // noite lida era quase a do dia. Fora do piso, vale o chão no meio do pé do próprio móvel.
          if (!it.deitado && it.pe && casa[chaoPx[d]] < 0) { const [gx, gy] = ponto((it.pe[0] + it.pe[1]) / 2, (it.pe[2] + it.pe[3]) / 2); chaoPx[d] = Math.min(W - 1, Math.round(gy)) * W + Math.round(gx); }
          // A cúpula do abajur é luz: o alto da peça, nas cores claras. O abajur foi pintado APAGADO, e quem acende
          // é o código (na v1 ele veio aceso, com um halo recortado que brigava com esta luz).
          const m4 = k * 4;
          if (p.id === 'abajur' && !(abajurApagado && (it.dono ?? 'abajur') === 'abajur') && ((k / W) | 0) < p.topo + 12 && p.movel[m4] + p.movel[m4 + 1] + p.movel[m4 + 2] > 360) acesa[d] = 1;
          // AS LUZES DA JUKEBOX (15/10/2026): os pixels claros e quentes do desenho são lâmpadas, e de noite ficam acesos
          // como estão (acesa = 2: a cor do dia, sem escurecer).
          else if (p.id === 'jukebox' && p.movel[m4] > 200 && p.movel[m4 + 1] > 130 && p.movel[m4] - p.movel[m4 + 2] > 60) acesa[d] = 2;
          // O COOKTOP DA ILHA: o preto que está no tampo dela (dentro do tampo, recolhido, para o contorno não acender)
          else if (p.id === 'ilha' && tampoDaIlha && p.movel[m4] + p.movel[m4 + 1] + p.movel[m4 + 2] < 130 && dentroDoPoligono(x, y, tampoDaIlha)) acesa[d] = 3;
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
    { const jb = lista.find((i) => i.p.id === 'jukebox'); if (jb) { const [x0, y0, x1, y1] = caixaDaPeca(jb.p); luzDaJukebox = [(x0 + x1) / 2 + jb.dx, y0 + (y1 - y0) * 0.75 + jb.dy]; topoDaJukebox = [(x0 + x1) / 2 + jb.dx, y0 + jb.dy + 6]; } else luzDaJukebox = topoDaJukebox = null; }
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
    if (IMAGENS.conceitoDia) document.getElementById('conceito').src = modo === 'dia' ? IMAGENS.conceitoDia : IMAGENS.conceitoNoite;
  }

  // O FOCO de um aparelho: sai da frente dele, na direção para onde está virado, com o alcance e a abertura em casas; e a
  // caixa na tela que ele pode tocar (o chão do leque e, acima, os móveis em pé nele).
  function focoDe(id, cor, alcance, largura, forca) {
    if (!ARR[id]) return null;
    const pe = peDe(id), [cu, cv] = centro(pe), [fu, fv] = VET[ORIENTA[ARR[id].lado]];
    const meio = fu ? (pe[1] - pe[0]) / 2 : (pe[3] - pe[2]) / 2, u0 = cu + fu * meio, v0 = cv + fv * meio;
    const cantos = [[u0 - fv * 0.6, v0 + fu * 0.6], [u0 + fv * 0.6, v0 - fu * 0.6], [u0 + fu * alcance - fv * largura, v0 + fv * alcance + fu * largura], [u0 + fu * alcance + fv * largura, v0 + fv * alcance - fu * largura]].map(([u, v]) => ponto(u, v));
    const caixa = [Math.min(...cantos.map((c) => c[0])) - 4, Math.min(...cantos.map((c) => c[1])) - 70, Math.max(...cantos.map((c) => c[0])) + 4, Math.max(...cantos.map((c) => c[1])) + 4];
    return { u0, v0, fu, fv, cor, alcance, largura, forca, caixa };
  }
  // A cor final de cada pixel de uma região: a luz da noite, a cortina, a sombra do coelho, a grade e o destino do arraste.
  const QUENTE = [1, 0.72, 0.42], BRASA = [120, 26, 16], CUPULA_X = [1.05, 0.8, 0.5], CUPULA_M = [34, 14, 0], PERTO = [1, 0.7, 0.4];
  function passeFinal(r) {
    const tp = performance.now(), P = parametrosDaLuz();
    if (!(GPU && GPU.passe(prender(r), P))) passeFinalCPU(r, P);
    TEMPOS.passe += performance.now() - tp; TEMPOS.nPasse++;
  }
  // O que a luz deste passe precisa, igual para a CPU e a GPU: as fontes (os brilhos em volta e os leques para a frente),
  // a lâmpada do abajur e o destino do arraste.
  function parametrosDaLuz() {
    const pintada = luzPintadaAgora(), razaoPe = pintada ? noiteAbajurPe : noitePe;
    // (apagado, a lâmpada vai para longe: a luz quente some, na placa e no processador, sem mexer na conta)
    const [lx, ly0] = abajurApagado ? [-1e5, -1e5] : lampada(), ly = ly0 + 6;
    const alvoOcupado = alvo ? ocupa(alvo) : false;
    const paAlvo = alvo && pegado && ARR[pegado] ? peDe(pegado, alvo) : null; // uma vez por quadro, e não por pixel
    // A luz da tela, de noite: o centro e a cor média, para clarear em volta.
    const brilhos = [], focos = [], noite = modo === 'noite';
    // A LUZ DE CADA FONTE CONFORME O TIPO DELA (relato de 15/10/2026: "a luz do fliperama e da jukebox são feitas como se
    // fossem lâmpadas"). Tela e painel (a TV, o fliperama, o computador, a jukebox) jogam luz PARA A FRENTE, para onde o
    // aparelho está virado, num leque que se abre pelo chão e pelos móveis da frente (o FOCO), e um halo pequeno em volta
    // da própria tela. A lâmpada e o neon brilham em volta (o círculo). O cooktop acende as bocas e esquenta em volta.
    for (const { id, pts } of telasAgora) {
      const tipoTela = tipoDaTela(id);
      if (tipoTela === 'desligada') continue;
      const cor = COR_DO_BRILHO[tipoTela] ?? [140, 120, 190];
      let sx = 0, sy = 0; for (const [x, y] of pts) { sx += x; sy += y; }
      if (noite) brilhos.push([sx / pts.length, sy / pts.length, cor, 22, 0.28]);
      // (o leque só de noite: de dia ele mal se via e custava a montagem da luz da imagem inteira)
      const f = noite && focoDe(id, cor, id === 'mesa' ? 2 : id === 'tv' ? 5 : 3.2, id === 'tv' ? 2.2 : 1.4, id === 'tv' ? 0.36 : 0.3); if (f) focos.push(f);
    }
    if (luzDaJukebox) {
      if (noite) brilhos.push([luzDaJukebox[0], luzDaJukebox[1] - 14, [230, 140, 60], 26, 0.26]);
      const f = noite && focoDe('jukebox', [235, 150, 70], 2.6, 1.3, 0.32); if (f) focos.push(f);
    }
    if (noite) for (const L of luzesDaParede) brilhos.push(L);
    if (noite && luzDoFogao) brilhos.push([luzDoFogao[0], luzDoFogao[1], [255, 110, 50], 40, 0.3]);
    return { pintada, razaoPe, lx, ly, alvoOcupado, paAlvo, brilhos, focos };
  }
  function passeFinalCPU(r, P) {
    const [x0, y0, x1, y1] = prender(r);
    const { pintada, razaoPe, lx, ly, alvoOcupado, paAlvo, brilhos, focos } = P;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * W + x;
      const sombraAqui = sombraFinal[k];
      // (por pixel, e não por canal: a exponencial do abajur era refeita três vezes por pixel)
      const noiteAqui = modo === 'noite';
      const brilho = noiteAqui && !pintada ? Math.floor(0.85 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.4) ** 2) / (2 * 85 * 85)) * 12) / 12 : 0;
      const pertoBase = noiteAqui && pintada && eMovel[k] ? 0.75 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.3) ** 2) / (2 * 60 * 60)) : 0;
      for (let c = 0; c < 3; c++) {
        let v = D[k * 3 + c];
        if (noiteAqui) {
          // Com a luz pintada, os móveis só herdam a razão noite/dia (que já traz o abajur). Com a luz por código:
          // quente, caindo com a distância, em faixas como a luz é desenhada em pixel art.
          const quente = QUENTE[c] * brilho;
          if (acesa[k] === 2) { /* a lâmpada da jukebox: a cor do dia */ }
          else if (acesa[k] === 3) v = v * 0.7 + BRASA[c] * 0.45; // a boca do cooktop, acesa (brasa, não lâmpada)
          else if (acesa[k]) v = Math.min(255, v * CUPULA_X[c] + CUPULA_M[c]); // a cúpula acesa, laranja como na pintura
          // A luz de um móvel à noite é a do CHÃO no pé daquela coluna, e não a da parede atrás do pixel.
          else if (eMovel[k]) {
            // (o chão de VERDADE embaixo do pixel, pela forma do móvel; sem ela, o pé da coluna. Relato dele, 16/10/2026: a
            // poltrona com uma faixa clara no braço — pelo pé da coluna, a coluna da perna pegava a luz de um chão uns 10 px
            // abaixo das vizinhas, e mudava inteira de brilho)
            // (a coluna também é a do chão: quase sempre a do pixel, e a do pé do móvel quando a coluna dele sai do quarto)
            const gy = chaoPx[k] >= 0 ? (chaoPx[k] / W) | 0 : peY[k], gx = chaoPx[k] >= 0 ? chaoPx[k] % W : x;
            const j = (Math.min(W - 1, gy + 3) * W + gx) * 4;
            const perto = pertoBase * PERTO[c];
            v = v * Math.min(pintada ? 1.2 : 0.9, razaoPe[j + c] / Math.max(1, diaPe[j + c])) + v * (quente + perto);
          }
          else v = fundoNoite[k * 3 + c] + baseDaLuz[k * 4 + c] * quente;
        }
        // A luz da janela, coada pelo linho: o quarto inteiro escurece por igual.
        if (fechada && modo === 'dia') v *= 0.86;
        if (sombraAqui) v *= 1 - sombraAqui * (1 - forcaDaSombra - (modo === 'noite' ? 0.12 : 0));
        imagem.data[k * 4 + c] = Math.min(255, v);
      }
      imagem.data[k * 4 + 3] = (modo === 'dia' ? foraDia : foraNoite)[k] && !eMovel[k] ? 0 : 255;
      for (const brilhoTela of brilhos) {
        const raio = brilhoTela[3] ?? 34;
        if (Math.abs(x - brilhoTela[0]) > raio || Math.abs(y - brilhoTela[1]) * 1.3 > raio) continue; // longe: nem calcula
        const d2 = Math.hypot(x - brilhoTela[0], (y - brilhoTela[1]) * 1.3);
        if (d2 < raio) { const f = Math.floor((1 - d2 / raio) * 4) / 4 * (brilhoTela[4] ?? 0.32); for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = Math.min(255, imagem.data[k * 4 + c] + brilhoTela[2][c] * f); }
      }
      for (const F of focos) {
        if (x < F.caixa[0] || x > F.caixa[2] || y < F.caixa[1] || y > F.caixa[3]) continue;
        // o ponto do chão deste pixel (num móvel, o chão embaixo dele)
        const g2 = eMovel[k] ? chaoPx[k] : casa[k] >= 0 ? k : -1;
        if (g2 < 0) continue;
        // uma MANCHA OVAL de luz na frente da tela, mais forte perto dela e esmaecendo para as bordas (o leque em cone, com
        // a ponta na tela, parecia um farol: relato de 15/10/2026)
        const du = mapaU[g2] - F.u0, dv = mapaV[g2] - F.v0, along = du * F.fu + dv * F.fv;
        if (along < -0.2) continue;
        const lado = -du * F.fv + dv * F.fu, ra = F.alcance * 0.55, ca = F.alcance * 0.4;
        const q = ((along - ca) / ra) ** 2 + (lado / F.largura) ** 2;
        if (q >= 1) continue;
        const perto = Math.max(0.45, 1 - Math.max(0, along) / F.alcance);
        const i = Math.floor((1 - q) * perto * 5) / 5 * F.forca;
        if (i > 0) for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = Math.min(255, imagem.data[k * 4 + c] + F.cor[c] * i);
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

  // ============================== A LUZ NA PLACA DE VÍDEO (WebGL2, 16/10/2026) ==============================
  // Pedido dele: "podemos implementar a solução WebGL agora?". O passe da luz (passeFinalCPU, logo acima) é conta pura,
  // pixel a pixel, sobre os buffers que a montagem já tem: aqui ele roda num shader, com os MESMOS números e a mesma ordem
  // (cada passo grava e arredonda como o Uint8ClampedArray da imagem). Os buffers viram texturas — só a região que mudou
  // sobe a cada quadro (UNPACK_ROW_LENGTH: sem copiar) — e o resultado volta para a mesma "imagem" (readPixels direto
  // nela), então a tela das TVs, o contorno, as faíscas e o balão continuam pintados por cima, como antes. Sem WebGL2, com
  // o shader recusado ou com o contexto perdido, volta a CPU. "?cpu" no endereço força a CPU (para comparar).
  const inicioDaGpu = performance.now();
  const GPU = (() => {
    if (new URLSearchParams(location.search).has('cpu')) return null;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const gl = cv.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const MAX_B = 32, MAX_F = 8;
    const vs = \`#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }\`;
    const fs = \`#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp isampler2D; precision highp usampler2D;
uniform sampler2D tD, tFN, tBase, tRaz, tDiaPe, tSom, tUV;
uniform usampler2D tEM, tAc, tFora;
uniform isampler2D tPeY, tChao, tCasa;
uniform int W, N, noite, pintada, fechadaDia, grade, temAlvo, alvoOcupado, nB, nF;
uniform float lx, ly, forcaSombra; uniform vec4 pa;
uniform vec4 bPos[\${MAX_B}]; uniform vec3 bCor[\${MAX_B}];
uniform vec4 fA[\${MAX_F}]; uniform vec4 fB[\${MAX_F}]; uniform vec4 fCx[\${MAX_F}]; uniform vec3 fCor[\${MAX_F}];
out vec4 cor;
vec3 grava(vec3 v) { return roundEven(clamp(v, 0.0, 255.0)); }
float sq(float a) { return a * a; }
int casaEm(int x, int y) { return (x < 0 || y < 0 || x >= W || y >= W) ? -1 : texelFetch(tCasa, ivec2(x, y), 0).r; }
void main() {
  int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y); ivec2 q = ivec2(x, y);
  float fx = float(x), fy = float(y);
  vec3 d = texelFetch(tD, q, 0).rgb;
  bool em = texelFetch(tEM, q, 0).r != 0u; uint ac = texelFetch(tAc, q, 0).r;
  int peY = texelFetch(tPeY, q, 0).r; float som = texelFetch(tSom, q, 0).r;
  int casa = texelFetch(tCasa, q, 0).r;
  bool nt = noite != 0, pin = pintada != 0;
  float brilho = nt && !pin ? floor(0.85 * exp(-(sq(fx - lx) + sq((fy - ly) * 1.4)) / (2.0 * 85.0 * 85.0)) * 12.0) / 12.0 : 0.0;
  float pertoBase = nt && pin && em ? 0.75 * exp(-(sq(fx - lx) + sq((fy - ly) * 1.3)) / (2.0 * 60.0 * 60.0)) : 0.0;
  vec3 v = d;
  if (nt) {
    vec3 quente = vec3(1.0, 0.72, 0.42) * brilho;
    if (ac == 2u) {}
    else if (ac == 3u) v = v * 0.7 + vec3(120.0, 26.0, 16.0) * 0.45;
    else if (ac != 0u) v = min(vec3(255.0), v * vec3(1.05, 0.8, 0.5) + vec3(34.0, 14.0, 0.0));
    else if (em) {
      int chao = texelFetch(tChao, q, 0).r, gy = chao >= 0 ? chao / W : peY, gx = chao >= 0 ? chao - (chao / W) * W : x;
      ivec2 j = ivec2(gx, min(W - 1, gy + 3));
      vec3 raz = texelFetch(tRaz, j, 0).rgb * 255.0, dia = texelFetch(tDiaPe, j, 0).rgb * 255.0;
      vec3 perto = pertoBase * vec3(1.0, 0.7, 0.4);
      v = v * min(vec3(pin ? 1.2 : 0.9), raz / max(vec3(1.0), dia)) + v * (quente + perto);
    }
    else v = texelFetch(tFN, q, 0).rgb + texelFetch(tBase, q, 0).rgb * 255.0 * quente;
  }
  if (fechadaDia != 0) v *= 0.86;
  if (som != 0.0) v *= 1.0 - som * (1.0 - forcaSombra - (nt ? 0.12 : 0.0));
  vec3 o = grava(v);
  float a = (texelFetch(tFora, q, 0).r != 0u && !em) ? 0.0 : 255.0;
  for (int i = 0; i < nB; i++) {
    vec4 b = bPos[i]; float raio = b.z;
    if (abs(fx - b.x) > raio || abs(fy - b.y) * 1.3 > raio) continue;
    float d2 = length(vec2(fx - b.x, (fy - b.y) * 1.3));
    if (d2 < raio) { float f = floor((1.0 - d2 / raio) * 4.0) / 4.0 * b.w; o = grava(o + bCor[i] * f); }
  }
  for (int i = 0; i < nF; i++) {
    vec4 cx = fCx[i];
    if (fx < cx.x || fx > cx.z || fy < cx.y || fy > cx.w) continue;
    int g2 = em ? texelFetch(tChao, q, 0).r : casa >= 0 ? y * W + x : -1;
    if (g2 < 0) continue;
    vec2 uv = texelFetch(tUV, ivec2(g2 % W, g2 / W), 0).rg;
    vec4 A = fA[i], B = fB[i]; // A: u0 v0 fu fv; B: alcance largura forca -
    float du = uv.x - A.x, dv = uv.y - A.y, along = du * A.z + dv * A.w;
    if (along < -0.2) continue;
    float lado = -du * A.w + dv * A.z, ra = B.x * 0.55, ca = B.x * 0.4;
    float qq = sq((along - ca) / ra) + sq(lado / B.y);
    if (qq >= 1.0) continue;
    float perto = max(0.45, 1.0 - max(0.0, along) / B.x);
    float it = floor((1.0 - qq) * perto * 5.0) / 5.0 * B.z;
    if (it > 0.0) o = grava(o + fCor[i] * it);
  }
  if (temAlvo != 0 && casa >= 0 && !em) {
    float i2 = float(casa / N), j2 = float(casa - (casa / N) * N);
    if (i2 + 0.5 > pa.x && i2 + 0.5 < pa.y && j2 + 0.5 > pa.z && j2 + 0.5 < pa.w) {
      vec3 c2 = alvoOcupado != 0 ? vec3(220.0, 80.0, 60.0) : vec3(255.0, 240.0, 200.0);
      o = grava(o * 0.65 + c2 * 0.35);
    }
  }
  if ((grade != 0 || temAlvo != 0) && casa >= 0 && !em) {
    int dir = x + 1 < W ? casaEm(x + 1, y) : -1, baixo = y + 1 < W ? casaEm(x, y + 1) : -1, cima = y > 0 ? casaEm(x, y - 1) : -1;
    if ((dir != casa && dir >= 0) || (baixo != casa && baixo >= 0)) o = grava(o * 1.35 + 18.0);
    else if (cima >= 0 && cima != casa) o = grava(o * 0.7);
  }
  cor = vec4(o, a) / 255.0;
}\`;
    const sh = (tipo, src) => { const s2 = gl.createShader(tipo); gl.shaderSource(s2, src); gl.compileShader(s2); if (!gl.getShaderParameter(s2, gl.COMPILE_STATUS)) { console.warn('shader da luz:', gl.getShaderInfoLog(s2)); return null; } return s2; };
    const v1 = sh(gl.VERTEX_SHADER, vs), f1 = sh(gl.FRAGMENT_SHADER, fs);
    if (!v1 || !f1) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, v1); gl.attachShader(pr, f1); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn('programa da luz:', gl.getProgramInfoLog(pr)); return null; }
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    const U = {}; const u = (n) => (U[n] ??= gl.getUniformLocation(pr, n));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    // [nome, formato interno, formato, tipo]
    const FORMATOS = {
      tD: [gl.RGB32F, gl.RGB, gl.FLOAT], tFN: [gl.RGB32F, gl.RGB, gl.FLOAT], tBase: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
      tRaz: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], tDiaPe: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], tSom: [gl.R32F, gl.RED, gl.FLOAT],
      tUV: [gl.RG32F, gl.RG, gl.FLOAT], tEM: [gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE], tAc: [gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE],
      tFora: [gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE], tPeY: [gl.R16I, gl.RED_INTEGER, gl.SHORT], tChao: [gl.R32I, gl.RED_INTEGER, gl.INT],
      tCasa: [gl.R16I, gl.RED_INTEGER, gl.SHORT],
    };
    const T = {};
    Object.entries(FORMATOS).forEach(([nome, [interno]], i) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, interno, W, W);
      for (const [k2, v2] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k2, v2);
      gl.uniform1i(u(nome), i); T[nome] = { t, i, dados: null };
    });
    const alvoT = gl.createTexture(); gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, alvoT); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, W);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, alvoT, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    let perdido = false;
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perdido = true; });
    // Sobe a região r de uma textura (ou a imagem inteira), lendo direto do buffer da montagem.
    const subir = (nome, dados, r) => {
      const { t, i } = T[nome], [, formato, tipo] = FORMATOS[nome];
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      const [x0, y0, x1, y1] = r ?? [0, 0, W, W];
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, W); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
      const v = dados instanceof Uint8ClampedArray ? new Uint8Array(dados.buffer, dados.byteOffset, dados.length) : dados;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, formato, tipo, v);
      T[nome].dados = dados;
    };
    let uv = null, sujo = true;
    const passe = (r, P) => {
      if (perdido || gl.isContextLost()) return false;
      const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
      if (w <= 0 || h <= 0) return true;
      const tudo = w === W && h === W;
      // O que muda a cada quadro (o coelho, o móvel vivo, a cadeira, a sombra): só a região deste passe.
      subir('tD', D, r); subir('tEM', eMovel, r); subir('tPeY', peY, r); subir('tSom', sombraFinal, r); subir('tChao', chaoPx, r);
      // O que só muda com a cena montada de novo (ou com a janela): inteiro, quando muda ou no passe da cena.
      // (a noite, o que acende e a razão de luz só são lidos de noite: de dia, ficam para quando a noite chegar)
      if (tudo) sujo = true;
      const noiteAgora = modo === 'noite';
      if (noiteAgora && sujo) { subir('tFN', fundoNoite); subir('tAc', acesa); sujo = false; }
      if (!uv) { uv = new Float32Array(W * W * 2); for (let k = 0; k < W * W; k++) { uv[k * 2] = mapaU[k]; uv[k * 2 + 1] = mapaV[k]; } subir('tUV', uv); subir('tCasa', casa); }
      const fora = modo === 'dia' ? foraDia : foraNoite;
      for (const [nome, dados] of noiteAgora ? [['tBase', baseDaLuz], ['tRaz', P.razaoPe], ['tDiaPe', diaPe], ['tFora', fora]] : [['tFora', fora]]) if (dados && ((tudo && nome !== 'tFora') || T[nome].dados !== dados)) subir(nome, dados);
      gl.uniform1i(u('W'), W); gl.uniform1i(u('N'), N);
      gl.uniform1i(u('noite'), modo === 'noite' ? 1 : 0); gl.uniform1i(u('pintada'), P.pintada ? 1 : 0);
      gl.uniform1i(u('fechadaDia'), fechada && modo === 'dia' ? 1 : 0); gl.uniform1i(u('grade'), grade ? 1 : 0);
      gl.uniform1i(u('temAlvo'), alvo && P.paAlvo ? 1 : 0); gl.uniform1i(u('alvoOcupado'), P.alvoOcupado ? 1 : 0);
      gl.uniform4fv(u('pa'), P.paAlvo ?? [0, 0, 0, 0]);
      gl.uniform1f(u('lx'), P.lx); gl.uniform1f(u('ly'), P.ly); gl.uniform1f(u('forcaSombra'), forcaDaSombra);
      const bs = P.brilhos.slice(0, MAX_B), fs2 = P.focos.slice(0, MAX_F);
      gl.uniform1i(u('nB'), bs.length); gl.uniform1i(u('nF'), fs2.length);
      if (bs.length) {
        gl.uniform4fv(u('bPos[0]'), bs.flatMap((b) => [b[0], b[1], b[3] ?? 34, b[4] ?? 0.32]));
        gl.uniform3fv(u('bCor[0]'), bs.flatMap((b) => b[2]));
      }
      if (fs2.length) {
        gl.uniform4fv(u('fA[0]'), fs2.flatMap((F) => [F.u0, F.v0, F.fu, F.fv]));
        gl.uniform4fv(u('fB[0]'), fs2.flatMap((F) => [F.alcance, F.largura, F.forca, 0]));
        gl.uniform4fv(u('fCx[0]'), fs2.flatMap((F) => F.caixa));
        gl.uniform3fv(u('fCor[0]'), fs2.flatMap((F) => F.cor));
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, W, W); gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // de volta para a imagem, na mesma região (a linha 0 da textura é a linha 0 da imagem)
      gl.pixelStorei(gl.PACK_ROW_LENGTH, W); gl.pixelStorei(gl.PACK_SKIP_PIXELS, x0); gl.pixelStorei(gl.PACK_SKIP_ROWS, y0);
      gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imagem.data.buffer));
      return !gl.isContextLost();
    };
    return { passe };
  })();
  const TEMPO_DA_GPU = performance.now() - inicioDaGpu; // criar o contexto e compilar o shader, ao abrir a página
  window.gpuDoTeste = () => (GPU ? 'webgl2 (abriu em ' + TEMPO_DA_GPU.toFixed(1) + ' ms)' : 'cpu');
  // Para o teste: o passe da imagem inteira nos dois caminhos, e quantos pixels diferem (e por quanto).
  window.compararGpuDoTeste = () => {
    if (!GPU) return null;
    const r = [0, 0, W, W], P = parametrosDaLuz(), antes = new Uint8ClampedArray(imagem.data);
    passeFinalCPU(r, P); const cpu = new Uint8ClampedArray(imagem.data);
    GPU.passe(r, P); const gpu = imagem.data;
    let n = 0, max = 0; for (let i = 0; i < cpu.length; i++) { const d2 = Math.abs(cpu[i] - gpu[i]); if (d2) { n++; max = Math.max(max, d2); } }
    imagem.data.set(antes);
    return { canais: cpu.length, diferentes: n, maior: max };
  };
  // Pinta o conteúdo da tela por cima da imagem (dentro da região r), só onde o pixel ainda é da mesa.
  function pintarTela(r) {
    const q = liga('telas') ? Math.floor(performance.now() / 250) : 0; // paradas: o primeiro quadro, aceso
    for (const { id, pts } of telasAgora) for (const [x, y, s2, t2] of pts) {
      if (x < r[0] || y < r[1] || x >= r[2] || y >= r[3]) continue;
      const k = y * W + x;
      // (o que está em cima do móvel, como o videogame no rack, é da peça dele, mas fica NA FRENTE da tela: relato de
      // 15/10/2026, "a TV está tampando o videogame")
      if (dono[k] !== id || donoObj[k]) continue;
      const tipo = tipoDaTela(id);
      const cor = corDaTela(s2, t2, q, tipo);
      if (!cor) continue;
      // de dia, a tela é um pouco mais apagada que de noite (o sol na sala)
      const f = modo === 'noite' ? 1 : 0.92;
      for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = cor[c] * f;
    }
  }
  // Os tempos do desenho (para o teste de desempenho): a cena montada de novo, e o quadro inteiro.
  let realce = null; // o que tem função sob o ponteiro: { chave, caixa } (ver realcar)
  let selecao = null; // o que está escolhido no Editar: { chave, caixa, cena } (ver selecionar)
  const TEMPOS = { cena: 0, nCena: 0, quadro: 0, nQuadro: 0, passe: 0, nPasse: 0 };
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
    const sig = JSON.stringify([ultimaCaixa, rotuloDoQuadro, coelhoChave, vc ? [cx0, cy0, indiceDaVista()] : 0, telaMexe ? Math.floor(performance.now() / 250) : 0, conteudoAgora(), iv ? [iv.dx, iv.dy, alvo] : 0, particulas.length ? performance.now() : 0, notas.length ? Math.floor(performance.now() / 100) : 0, paredePega?.vivo ? JSON.stringify(paredePega.vivo) : 0, objPego?.vivo ? [Math.round(objPego.vivo.x), Math.round(objPego.vivo.y), objPego.vivo.lado] : 0, realce?.chave ?? 0, EDITANDO && selecao ? selecao.chave : 0]);
    const mexeu = sig !== assinaturaQuadro;
    if (!mexeu && regiaoAnterior && regiaoAnterior[2] - regiaoAnterior[0] < W) { escreverLegenda(); return; }
    if (selecao && !EDITANDO) selecao = null;
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
        // A POLTRONA DE COSTAS para quem olha (relato dele, 16/10/2026: "de costas o coelho atravessa o sofá"): o encosto
        // está sempre na frente de quem senta nela. Só pela profundidade, a folga das pernas do sentado (10 px) passava o
        // coelho à frente do encosto, que fica uns 5 a 8 px mais perto.
        else if (doMovel && coelhoAtras && tipo === 2) continue;
        else if (eMovel[d] && !noTampo && chaveDoPixel[d] > coelhoChave + pernas) continue; // o móvel está na frente
        for (let c = 0; c < 3; c++) D[d * 3 + c] = quadroBuf[q + c];
        eMovel[d] = 1; peY[d] = peBuf[x] >= 0 ? peBuf[x] : coelhoPe[1]; dono[d] = 'coelho'; chaoPx[d] = -1;
      }
    }
    calcularSombra();
    let caixaFaiscas = null;
    { const t = performance.now(); for (const n of notas) { const [x, y] = ondeEstaANota(n, t); caixaFaiscas = unir(caixaFaiscas, [x - 3, y - 11, x + 10, y + 3]); } }
    for (const q of particulas) { const t = Math.max(0, (performance.now() - q.t0) / 1000), x = q.x + q.vx * t, y = q.y + q.vy * t + 20 * t * t; caixaFaiscas = unir(caixaFaiscas, [x - 3, y - 3, x + 4, y + 4]); }
    if (particulas.length && !caixaFaiscas) caixaFaiscas = null;
    // O DESTINO DO ARRASTE (as casas clareadas embaixo do móvel pego) também é pintado aqui: sem a caixa dele na região,
    // o destino que andou deixava pedaços clareados para trás (relato de 15/10/2026, "artefatos estranhos na grade").
    let caixaDoAlvo = null;
    if (alvo && pegado && ARR[pegado]) {
      const pa = peDe(pegado, alvo), cs = [[pa[0], pa[2]], [pa[1], pa[2]], [pa[1], pa[3]], [pa[0], pa[3]]].map(([u, v]) => ponto(Math.max(0, Math.min(N, u)), Math.max(0, Math.min(N, v))));
      caixaDoAlvo = [Math.floor(Math.min(...cs.map((c) => c[0]))) - 2, Math.floor(Math.min(...cs.map((c) => c[1]))) - 2, Math.ceil(Math.max(...cs.map((c) => c[0]))) + 2, Math.ceil(Math.max(...cs.map((c) => c[1]))) + 2];
    }
    // o objeto de parede vivo: os pixels dele levados para onde está agora
    let paredeViva = null;
    if (paredePega?.vivo && TEXTURAS_PAREDE[paredePega.id]) {
      const id = paredePega.id, T2 = texturaNaParede(id, paredePega.vivo.parede), mp = mapaDaParede(paredePega.vivo), cx = caixaDoItemDaParede(id), px = [];
      let bx0 = W, by0 = W, bx1 = 0, by1 = 0;
      const tex = modo === 'noite' && CENA !== 'salao' ? T2.noite : T2.dia, f = modo === 'noite' && CENA === 'salao' ? 0.6 : 1;
      for (let y = cx[1]; y < cx[3]; y++) for (let x = cx[0]; x < cx[2]; x++) {
        const k4 = (y * W + x) * 4; if (T2.dia[k4 + 3] < 128) continue;
        const d = mp(x, y); if (d < 0) continue;
        px.push([d, tex[k4] * f, tex[k4 + 1] * f, tex[k4 + 2] * f]);
        const X = d % W, Y = (d / W) | 0; bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
      }
      if (px.length) paredeViva = { px, caixa: [bx0 - 2, by0 - 2, bx1 + 3, by1 + 3] };
    }
    // o objeto vivo (pego e sendo arrastado): onde ele está agora
    let caixaObjVivo = paredeViva?.caixa ?? null, objVivo = null;
    if (objPego?.vivo && OBJ_VISTAS[objPego.o.tipo]) {
      const vis = OBJ_VISTAS[objPego.o.tipo][objPego.vivo.lado], ox = Math.round(objPego.vivo.x - vis.meioDaBase[0]), oy = Math.round(objPego.vivo.y - vis.meioDaBase[1]);
      objVivo = { vis, ox, oy }; caixaObjVivo = unir(caixaObjVivo, [vis.caixa[0] + ox - 2, vis.caixa[1] + oy - 2, vis.caixa[2] + ox + 2, vis.caixa[3] + oy + 2]);
    }
    // A ESCOLHIDA (no Editar): a caixa dela é medida de novo quando a cena muda (girou, mudou de lugar, trocou de tipo);
    // enquanto algo está na mão, ela some (o pego já tem o contorno dele).
    const ocupado = arrastando || !!viva || !!paredePega?.mexeu || !!janelaPega?.mexeu || !!objPego?.mexeu;
    const sel = selecao && EDITANDO && !ocupado ? selecao : null;
    if (sel && sel.cena !== assinaturaCena) { sel.caixa = caixaDaChave(sel.chave); sel.cena = assinaturaCena; if (!sel.caixa) { selecao = null; montarBarrinha(); } }
    const agora = unir(unir(unir(unir(unir(unir(unir(unir(unir(sel?.caixa ?? null, realce?.caixa ?? null), caixaC), caixaDaSombra), caixaCadeira), telaMexe ? caixaDaTela : null), caixaViva), caixaDoAlvo), caixaObjVivo), caixaFaiscas ?? (regiaoDasFaiscas ? regiaoDasFaiscas : null));
    regiaoDasFaiscas = caixaFaiscas;
    const r = prender(unir(agora, regiaoAnterior) ?? [0, 0, W, W]);
    passeFinal(r);
    pintarTela(r);
    // o contorno branco do móvel pego e as faíscas: por cima de tudo, sem a luz da noite
    if (paredeViva) {
      const meu = new Set();
      for (const [d, r2, g2, b2] of paredeViva.px) { imagem.data[d * 4] = r2; imagem.data[d * 4 + 1] = g2; imagem.data[d * 4 + 2] = b2; meu.add(d); }
      for (const d of meu) for (const n of [d - 1, d + 1, d - W, d + W]) if (n >= 0 && n < W * W && !meu.has(n)) contorno.push(n);
    }
    if (objVivo) {
      // por cima de tudo (está na mão), com a luz do lugar só de leve, e o contorno branco em volta
      const { vis, ox, oy } = objVivo, [c0, r0, c1, r1] = vis.caixa, meu = new Set(), f = modo === 'noite' ? 0.62 : 1;
      for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) {
        const s4 = (y * W + x) * 4; if (vis.movel[s4 + 3] < 128) continue;
        const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const d = Y * W + X; meu.add(d);
        for (let c = 0; c < 3; c++) imagem.data[d * 4 + c] = vis.movel[s4 + c] * f;
      }
      for (const d of meu) for (const n of [d - 1, d + 1, d - W, d + W]) if (n >= 0 && n < W * W && !meu.has(n)) contorno.push(n);
    }
    // o contorno de quem tem função, sob o ponteiro: em volta do que aparece dele, e nunca por cima do que está na frente
    for (const rc of [realce, selecao && sel && sel.caixa ? sel : null]) {
      if (!rc) continue;
      const [x0, y0, x1, y1] = rc.caixa, ch = rc.chave;
      for (let y = Math.max(1, y0); y < Math.min(W - 1, y1); y++) for (let x = Math.max(1, x0); x < Math.min(W - 1, x1); x++) {
        const k = y * W + x; if (doRealce(k, ch)) continue;
        const n = [k - 1, k + 1, k - W, k + W].find((q) => doRealce(q, ch)); if (n === undefined) continue;
        if (eMovel[k] && (ch[0] !== 'm' || chaveDoPixel[k] > chaveDoPixel[n])) continue;
        contorno.push(k);
      }
    }
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
    for (const n of notas) {
      const [x, y] = ondeEstaANota(n, agoraF), vida = (agoraF - n.t0) / n.vida, a = vida < 0.15 ? vida / 0.15 : vida > 0.7 ? Math.max(0, 1 - (vida - 0.7) / 0.3) : 1;
      const forma = n.dupla ? NOTA_DUPLA : NOTA, cheio = (i, j) => forma[j]?.[i] === '#';
      // o contorno escuro (a nota se lê sobre o tijolo) e, por cima, a nota
      for (let j = -1; j <= forma.length; j++) for (let i = -1; i <= 6; i++) {
        const dentro = cheio(i, j), borda = !dentro && (cheio(i - 1, j) || cheio(i + 1, j) || cheio(i, j - 1) || cheio(i, j + 1));
        if (!dentro && !borda) continue;
        const X = x + i, Y = y - forma.length + j; if (X < r[0] || Y < r[1] || X >= r[2] || Y >= r[3]) continue;
        const k = (Y * W + X) * 4, cor = dentro ? n.cor : [44, 26, 22], f = dentro ? a : a * 0.75;
        for (let c = 0; c < 3; c++) imagem.data[k + c] = imagem.data[k + c] * (1 - f) + cor[c] * f;
      }
    }
    if (falando) balao(imagem.data); // falando de pé ou sentado
    g.putImageData(imagem, 0, 0, r[0], r[1], r[2] - r[0], r[3] - r[1]);
    regiaoAnterior = agora;
    posicionarBarrinha(sel);
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
  const trocarCortina = () => { fechada = !fechada; bc.setAttribute('aria-pressed', String(fechada)); bc.textContent = 'Cortina: ' + (fechada ? 'fechada' : 'aberta'); if (!soVer) enviar(); montarBarrinha(); desenhar(); };
  bc.onclick = trocarCortina;
  // Na janela, o clique é da cortina, e a mão aparece; no resto, arrasta o pufe.
  const bj = document.getElementById('janela');
  const trocarJanela = () => { aberta = !aberta; bj.setAttribute('aria-pressed', String(aberta)); bj.textContent = 'Janela: ' + (aberta ? 'aberta' : 'fechada'); if (!soVer) enviar(); montarBarrinha(); desenhar(); };
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
  // um pixel do vidro e um da cortina (o resto da janela), livres de móvel: para o teste clicar
  window.pixelDaJanelaDoTeste = () => { const r = { vidro: null, cortina: null }; for (let k = 0; k < W * W; k++) { if (!naJanela[k] || dono[k]) continue; const q = vidro[k * 4 + 3] > 127 || noCaixilho[k] ? 'vidro' : 'cortina'; r[q] ??= []; r[q].push(k); } for (const q in r) if (r[q]) { const ks = r[q]; const k = ks[ks.length >> 1]; r[q] = [k % W, (k / W) | 0]; } return r; };
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
  // EDITANDO (a barra de arrumar do app em "Editar", 16/10/2026): o clique arruma e não abre a função. Relato dele: "não
  // consigo ajustar a janela (cortina, abrir a janela), pois se eu clico sou direcionado para a função da janela".
  let EDITANDO = false;
  const FUNCOES_DE_TESTE = CENA === 'salao'
    ? { tv: { rotulo: 'Entrar na voz', sub: '3 na chamada agora' }, fliperama: { rotulo: 'Mini-games', sub: 'Na sala de voz, com a turma' }, estante: { rotulo: 'Entrar na conversa', sub: '# geral' }, janela: { rotulo: 'Chamar alguém', sub: 'Copia o convite desta comunidade' }, balcao: { rotulo: 'Recado', sub: 'O que quem administra escreveu' }, quadro: { rotulo: 'Mudar esta tela', sub: 'Só quem administra vê este bloco' }, microfone: { rotulo: 'Karaokê', sub: 'Na sala de voz, com a turma' }, jukebox: { rotulo: 'Karaokê', sub: 'Na sala de voz, com a turma' } }
    : { fone: { rotulo: 'Salas', sub: 'Converse e jogue' }, quadro: { rotulo: 'Amigos', sub: 'Quem anda com você' }, cortica: { rotulo: 'Tem uma ideia para o Syden?' }, gavetas: { rotulo: 'Guarda-roupa', sub: 'Enfeites, sons e emojis' }, janela: { rotulo: 'Explorar', sub: 'Entrar em outra comunidade' }, abajur: { rotulo: 'Dia e noite' }, computador: { rotulo: 'Mini-games', sub: 'Jogar com a turma' } };
  // O móvel e a função dele (o guarda-roupa é a função "gavetas" da home: lá eram as gavetas da cama).
  // (no salão, as do Salao.tsx: a TV leva à voz, o fliperama aos mini-games, a estante aos canais, o balcão ao recado)
  const FUNCAO_DO_MOVEL = porTipo(CENA === 'salao' ? { tv: 'tv', fliperama: 'fliperama', estante: 'estante', balcao: 'balcao', microfone: 'microfone', jukebox: 'jukebox' } : { 'guarda-roupa': 'gavetas', abajur: 'abajur', mesa: 'computador' } /* (os mini-games só na mesa: a cadeira é de arrastar pelo quarto, decisão dele de 16/10/2026) */);
  const rotulo = document.getElementById('rotulo');
  function funcaoEm(k) {
    // No salão, quem não administra só olha a arrumação, mas USA o salão: as funções valem para todo mundo.
    if (!FUNCOES || EDITANDO || (soVer && CENA !== 'salao')) return null;
    const ip = naParede[k];
    if (ip && !dono[k]) { const f = ITENS_PAREDE[ordemDaParede[ip - 1]].funcao; return f && FUNCOES[f] ? f : null; }
    if (dono[k]) { const f = FUNCAO_DO_MOVEL[dono[k]]; return f && FUNCOES[f] ? f : null; }
    if (naJanela[k] && FUNCOES.janela) return 'janela'; // (a janela inteira: a cortina e abrir vão no botão direito)
    return null;
  }
  function acao(f) {
    // O balcão abre e fecha o recado, aqui mesmo (o balão é da página).
    if (f === 'balcao' && CENA === 'salao' && RECADO) { if (recadoAberto) { recadoAberto = false; contarLeitura = false; clearTimeout(fimDoRecado); posicionarRecado(true); } else abrirRecado(); return; }
    if (window.parent !== window && MODO_APP) { window.parent.postMessage({ syden: 'quarto', acao: f }, location.origin); return; }
    document.getElementById('acao-teste').textContent = 'No app, abriria: ' + FUNCOES[f].rotulo + (FUNCOES[f].sub ? ' (' + FUNCOES[f].sub + ')' : '') + '.';
    if (f === 'abajur') botoes[modo === 'dia' ? 'noite' : 'dia'].click(); // aqui, o próprio quarto troca
  }
  // OS DETALHES DE UMA PEÇA (pedido dele, 17/10/2026: "o usuário clica no item e aparecem mais detalhes"). O clique numa
  // peça SEM função conta ao app qual foi, e o app mostra o cartão: a figura, o nome e uma frase, traduzidos lá
  // (web/src/CartaoDaPeca.tsx). A peça com função continua abrindo a função; o cartão dela fica no "i" da barrinha do Editar.
  // Um ouvinte só, na janela e antes de todos (os da parede e de quem visita param o clique na própria cena): clicar é
  // soltar a menos de 6 px de onde apertou, fora do Editar.
  function detalhar(grupo, id) {
    if (window.parent !== window && MODO_APP) { window.parent.postMessage({ syden: 'quarto', detalhe: { grupo, id } }, location.origin); return; }
    document.getElementById('acao-teste').textContent = 'No app, mostraria os detalhes de ' + id + '.';
  }
  const chaveDoDetalhe = (ch) => (!ch || ch[0] === 'j' ? null : ch[0] === 'o' ? (EM_CIMA[ch.slice(1)] ? ['o', EM_CIMA[ch.slice(1)].tipo] : null) : [ch[0], ch.slice(1)]);
  let apertoDoDetalhe = null;
  addEventListener('pointerdown', (e) => { apertoDoDetalhe = e.target === tela && e.button === 0 && !EDITANDO ? { x: e.clientX, y: e.clientY, k: pixelDo(e) } : null; }, true);
  addEventListener('pointerup', (e) => {
    const a = apertoDoDetalhe; apertoDoDetalhe = null;
    if (!a || EDITANDO || Math.hypot(e.clientX - a.x, e.clientY - a.y) >= 6 || funcaoEm(a.k)) return;
    const d = chaveDoDetalhe(escolhaEm(a.k));
    if (d) detalhar(d[0], d[1]);
  }, true);
  window.detalheDoTeste = (x, y) => chaveDoDetalhe(escolhaEm(y * W + x)); // para o teste
  const bFuncoes = document.getElementById('funcoes');
  bFuncoes.onclick = () => { FUNCOES = FUNCOES ? null : FUNCOES_DE_TESTE; bFuncoes.setAttribute('aria-pressed', String(!!FUNCOES)); bFuncoes.textContent = 'Funções do app: ' + (FUNCOES ? 'ligadas' : 'desligadas'); };
  // O CONTORNO DE QUEM TEM FUNÇÃO (pedido dele, 16/10/2026: "quando passo em cima de móvel que tenha função, deveria dar
  // um outline nele"): o móvel, o objeto da parede ou a janela sob o ponteiro ganha a borda clara, como o móvel pego.
  // A caixa dele é medida uma vez, ao entrar; a cada quadro só ela é percorrida.
  // As chaves: 'm' + móvel, 'p' + objeto da parede, 'o' + objeto de cima, 'j' a janela.
  const doRealce = (k, chave) => chave[0] === 'm' ? dono[k] === chave.slice(1) : chave[0] === 'p' ? !!formaParede[k] && !dono[k] && ordemDaParede[formaParede[k] - 1] === chave.slice(1) : chave[0] === 'o' ? donoObj[k] === chave.slice(1) : !!(aberta ? formaJanelaAberta : formaJanelaFechada)[k] && !dono[k];
  const caixaDaChave = (chave) => {
    let x0 = W, y0 = W, x1 = -1, y1 = -1;
    for (let q = 0; q < W * W; q++) if (doRealce(q, chave)) { const x = q % W, y = (q / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : [Math.max(0, x0 - 3), Math.max(0, y0 - 3), Math.min(W, x1 + 4), Math.min(W, y1 + 4)];
  };
  function realcar(k) {
    const f = k === null ? null : funcaoEm(k);
    const chave = !f ? null : dono[k] ? 'm' + dono[k] : naParede[k] ? 'p' + ordemDaParede[naParede[k] - 1] : 'j';
    if ((realce?.chave ?? null) === chave) return;
    realce = null;
    if (chave) { const caixa = caixaDaChave(chave); if (caixa) realce = { chave, caixa }; }
    desenhar();
  }
  tela.addEventListener('pointermove', (e) => {
    const f = arrastando || paredePega || janelaPega ? null : funcaoEm(pixelDo(e));
    realcar(f ? pixelDo(e) : null);
    rotulo.hidden = !f;
    if (soVer) tela.style.cursor = f ? 'pointer' : 'default';
    if (f) {
      const rf = rotulo.parentElement.getBoundingClientRect();
      rotulo.innerHTML = ''; rotulo.append(FUNCOES[f].rotulo);
      if (FUNCOES[f].sub) { const sm = document.createElement('small'); sm.textContent = FUNCOES[f].sub; rotulo.append(sm); }
      // DENTRO DA CENA (relato dele, 16/10/2026: "às vezes o texto fica para fora do quarto"): centrado no ponteiro e acima
      // dele, mas preso às bordas do que se vê; sem espaço em cima, vai para baixo do ponteiro.
      const w = rotulo.offsetWidth, h = rotulo.offsetHeight, M = 6;
      const cx = Math.max(w / 2 + M, Math.min(innerWidth - w / 2 - M, e.clientX));
      const cy = e.clientY - h * 1.2 < M ? e.clientY + h * 1.2 + 18 : e.clientY;
      rotulo.style.left = cx - rf.left + 'px'; rotulo.style.top = Math.min(innerHeight - M + h * 0.2, cy) - rf.top + 'px';
    }
  });
  tela.addEventListener('pointerleave', () => { rotulo.hidden = true; realcar(null); });

  // ============================== OS OBJETOS DE CIMA: pegar, levar, girar, pôr e guardar ==============================
  // Pego, ele vai para o tampo sob o ponteiro (de qualquer móvel que receba objetos); solto fora de todo tampo, ele é
  // guardado. Seguro, a rodinha (ou o R) o gira.
  let objPego = null;
  const guardarObjetos = () => { if (soVer) return; try { localStorage.setItem(PREFIXO + 'objetos', JSON.stringify(EM_CIMA)); } catch { /* fica só nesta visita */ } enviar(); };
  // A FOLGA DA BEIRADA (relato de 17/10/2026: "dificuldade de colocar os objetos pequenos na mesa"): o tampo só valia com
  // a base exatamente dentro do pé do móvel, e soltar um pouco além da beirada devolvia o objeto ao lugar de antes. Sem
  // tampo exato, vale o mais perto até meia casa fora, com o objeto puxado para dentro.
  function tampoDoPonteiro(e, mao = [0, 0]) {
    return tampoEm(e, mao, 0) ?? tampoEm(e, mao, 0.5);
  }
  function tampoEm(e, mao, folga) {
    const r = tela.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width - mao[0], y = (e.clientY - r.top) * W / r.height - mao[1];
    let melhor = null;
    for (const id of Object.keys(TOPOS)) {
      if (!ARR[id]) continue;
      const [u, v] = uvDe(x, y + TOPOS[id]), pe = peDe(id);
      if (u < pe[0] - folga || u > pe[1] + folga || v < pe[2] - folga || v > pe[3] + folga) continue;
      let a = (u - pe[0]) / (pe[1] - pe[0]), b = (v - pe[2]) / (pe[3] - pe[2]);
      for (let k = 0; k < ARR[id].lado; k++) [a, b] = [b, 1 - a]; // o avesso do giro de ondeEmCima
      const [s2, t2] = foraDoQueEstaEmPe(id, Math.min(0.96, Math.max(0.04, a)), Math.min(0.96, Math.max(0.04, b)));
      // O MÓVEL QUE ESTÁ EMBAIXO do ponto de apoio ganha (relato de 15/10/2026: o refrigerante "não lia a mesa" e pulava
      // para um móvel alto atrás dela, como a estante, cujo tampo projetado também cobria o ponto); empatando, o mais alto.
      const k = Math.round(y) * W + Math.round(x), embaixo = k >= 0 && k < W * W && dono[k] === id ? 1 : 0;
      const cand = { em: id, s: s2, t: t2, alto: TOPOS[id], embaixo };
      if (!melhor || cand.embaixo > melhor.embaixo || (cand.embaixo === melhor.embaixo && cand.alto > melhor.alto)) melhor = cand;
    }
    return melhor;
  }
  // O OBJETO VIVO (pedido dele, 15/10/2026: "o bordado para objetos também; a movimentação é muito limitada"): ao
  // arrastar, o objeto SAI do móvel e é desenhado vivo, por cima de tudo, com o contorno branco dos móveis pegos; segue a
  // mão e encaixa no tampo que está embaixo dela. Antes, cada movimento gravava o objeto no tampo e remontava a cena
  // inteira (~80 ms no salão): o objeto andava aos trancos. Agora a cena só é refeita ao pegar e ao soltar.
  function ondeOObjetoVivo(e) {
    const tp = tampoDoPonteiro(e, objPego.mao), o = objPego.o, r = tela.getBoundingClientRect();
    if (tp) { const [u, v] = ondeEmCima({ ...o, em: tp.em, s: tp.s, t: tp.t }), [x, y] = ponto(u, v); return { tp, x, y: y - TOPOS[tp.em], lado: ((ARR[tp.em]?.lado ?? 0) + o.lado) % 4 }; }
    const x = (e.clientX - r.left) * W / r.width - objPego.mao[0], y = (e.clientY - r.top) * W / r.height - objPego.mao[1];
    return { tp: null, x, y, lado: objPego.vivo?.lado ?? ((ARR[o.em]?.lado ?? 0) + o.lado) % 4 };
  }
  tela.addEventListener('pointermove', (e) => {
    if (!objPego) return;
    if (!objPego.mexeu && Math.hypot(e.clientX - objPego.x, e.clientY - objPego.y) < 6) return;
    if (!objPego.mexeu) {
      // sai do móvel (uma montagem da cena) e passa a ser desenhado vivo
      objPego.mexeu = true; objPego.o = { ...EM_CIMA[objPego.uid] };
      const { [objPego.uid]: _pego, ...resto } = EM_CIMA; EM_CIMA = resto;
    }
    const v = ondeOObjetoVivo(e);
    objPego.vivo = v; objPego.fora = !v.tp; objPego.k = pixelDo(e);
    desenhar();
  });
  tela.addEventListener('pointerup', () => {
    if (!objPego) return;
    const { uid, mexeu, fora, antes, k, vivo, o } = objPego;
    objPego = null;
    // Solto num tampo: fica ali. Fora de qualquer tampo, DENTRO da sala, volta para onde estava (soltar no chão sem querer
    // não some com ele); FORA da sala (no fundo em volta), é guardado.
    if (mexeu && vivo && !fora) EM_CIMA = { ...EM_CIMA, [uid]: { ...o, em: vivo.tp.em, s: +vivo.tp.s.toFixed(3), t: +vivo.tp.t.toFixed(3) } };
    else if (mexeu && fora) {
      const naSala = k >= 0 && !(modo === 'dia' ? foraDia : foraNoite)[k];
      if (naSala) EM_CIMA = { ...EM_CIMA, [uid]: { ...antes, lado: o?.lado ?? antes.lado } };
    }
    guardarObjetos(); desenhar();
  });
  // Pôr um objeto: no último móvel tocado, se ele recebe objetos (senão na mesa), no primeiro lugar livre do tampo.
  function porObjeto(tipo) {
    // O servidor guarda até 60 objetos (server/src/quarto.ts): passar disso fazia toda arrumação seguinte ser recusada
    // calada (revisão de 16/10/2026).
    if (Object.keys(EM_CIMA).length >= 60) { dizer('Já há objetos demais em cima dos móveis.'); return; }
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
  window.tampoDoTeste = (x, y) => { const r = tela.getBoundingClientRect(); return tampoDoPonteiro({ clientX: r.left + (x + 0.5) * r.width / W, clientY: r.top + (y + 0.5) * r.height / W }); }; // para o teste

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
    if (!paredePega.mexeu) {
      // VIVO, como os objetos de cima (relato de 15/10/2026: "os objetos da parede estão muito lentos ao arrastar"): sai da
      // parede (uma montagem) e é desenhado na mão, com contorno; cada passo antes remontava a janela, as luzes e a cena.
      paredePega.mexeu = true; paredePega.vivo = { ...NA_PAREDE[paredePega.id] };
      delete NA_PAREDE[paredePega.id]; aplicarJanela(true); assinaturaCena = '';
    }
    const r = tela.getBoundingClientRect(), esc = W / r.height;
    const p = naParedeDo(e), { P0, p0, id } = paredePega, it = ITENS_PAREDE[id], meio = (it.ocupa[0] + it.ocupa[1]) / 2;
    // Ao longo da parede, o que o ponteiro andou; trocando de parede, o meio do objeto vai para o ponteiro.
    const v = p.parede === P0.parede ? P0.v + (p.v - p0.v) : p.v - meio;
    const dv = p.parede === P0.parede ? p.v - p0.v : 0;
    // Subir: o que o ponteiro subiu na tela, menos o que a própria parede sobe ao andar nela (14,25 px por casa).
    const h = P0.h - ((e.clientY - paredePega.y) * esc - 14.25 * dv);
    const novo = prenderNaParede(id, { parede: p.parede, v: Math.round(v * 10) / 10, h: Math.round(h) });
    const atual = paredePega.vivo;
    if (novo.parede !== atual.parede || novo.v !== atual.v || novo.h !== atual.h) { paredePega.vivo = novo; desenhar(); }
  });
  tela.addEventListener('pointerup', () => {
    if (!paredePega) return;
    const { id, mexeu, vivo } = paredePega;
    paredePega = null;
    if (mexeu) { mudarParede(id, vivo); return; }
    const f = ITENS_PAREDE[id].funcao;
    if (FUNCOES && f && FUNCOES[f] && !EDITANDO) acao(f);
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
  // Guardar e pôr um MÓVEL (os botões daqui e a barra de arrumar do app). Guardado, os objetos que estavam em cima dele
  // saem junto. De volta, ele vai para a casa livre mais perto da de fábrica, na posição de fábrica; sem casa livre, não volta.
  function alternarMovel(id) {
    if (soVer || !podeGuardar(id)) return;
    if (ARR[id]) {
      if (viva?.id === id || pegado === id) return;
      delete ARR[id]; GUARDADOS.add(id);
      EM_CIMA = Object.fromEntries(Object.entries(EM_CIMA).filter(([, o]) => o.em !== id)); guardarObjetos();
      if (selecionado === id) escolher(Object.keys(ARR)[0]);
      if (coelho.destino === id) { coelho.destino = null; coelho.pose = 'parado'; }
    } else {
      const { c: c0, lado } = INICIAL[id], base = encaixar(id, ...c0, lado), opcoes = [];
      for (let di = -N; di <= N; di++) for (let dj = -N; dj <= N; dj++) opcoes.push(encaixar(id, base[0] + di, base[1] + dj, lado));
      opcoes.sort((a, b) => Math.hypot(a[0] - base[0], a[1] - base[1]) - Math.hypot(b[0] - base[0], b[1] - base[1]));
      ARR[id] = { c: base, lado };
      const c = opcoes.find((p) => !ocupa(p, id, lado));
      if (!c) { delete ARR[id]; dizer('Não há espaço livre para ' + NOMES[id] + '.'); return; }
      ARR[id] = { c, lado }; GUARDADOS.delete(id); soltarFaiscas(peDe(id));
    }
    guardarGuardados(); guardar(); colidir(); assinaturaCena = ''; botoesDosMoveis(); decidir(); desenhar();
  }
  function botoesDosMoveis() {
    const caixa = document.getElementById('moveis');
    caixa.replaceChildren(...Object.keys(INICIAL).filter(podeGuardar).map((id) => {
      const b = document.createElement('button');
      b.textContent = (NOMES[id] ?? id).replace(/^(o|a|os|as) /, '').replace(/^./, (l) => l.toUpperCase()) + ': ' + (ARR[id] ? 'no lugar' : 'guardado');
      b.setAttribute('aria-pressed', String(!!ARR[id]));
      b.disabled = soVer;
      b.onclick = () => alternarMovel(id);
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
  botoesDaParede(); botoesDosMoveis();
  window.paredeDoTeste = () => NA_PAREDE; // para o teste
  const bct = document.getElementById('cor-tapete'), ORDEM_CORES = Object.keys(CORES_DO_TAPETE);
  const botaoDaCor = () => { bct.textContent = 'Cor do tapete: ' + CORES_DO_TAPETE[CORES.tapete ?? 'salvia'].nome; bct.disabled = soVer; };
  bct.onclick = () => { CORES = { ...CORES, tapete: ORDEM_CORES[(ORDEM_CORES.indexOf(CORES.tapete ?? 'salvia') + 1) % ORDEM_CORES.length] }; guardarCores(); botaoDaCor(); desenhar(); };
  botaoDaCor();
  // A OPÇÃO de um objeto da parede (o pôster): troca o desenho no mesmo lugar, preso de novo à parede (o tamanho muda um
  // pouco de uma opção para outra).
  function escolherOpcao(id, nome) {
    CORES = { ...CORES, [id]: nome }; guardarCores(); vestirOpcoes();
    if (NA_PAREDE[id]) NA_PAREDE[id] = prenderNaParede(id, NA_PAREDE[id]);
    aplicarJanela(); assinaturaCena = ''; botaoDaOpcao(); desenhar();
  }
  const bop = document.getElementById('opcao-poster');
  function botaoDaOpcao() { if (!OPCOES_PAREDE.poster) return; bop.hidden = false; bop.textContent = 'Pôster: ' + opcaoDe('poster'); bop.disabled = soVer; }
  bop.onclick = () => { const ops = Object.keys(OPCOES_PAREDE.poster); escolherOpcao('poster', ops[(ops.indexOf(opcaoDe('poster')) + 1) % ops.length]); };
  botaoDaOpcao();
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
    if (EDITANDO) return; // no Editar, o clique escolhe (a barrinha e o botão direito mexem nela)
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
  const escolher = (id) => { selecionado = id; bgirar.textContent = 'Girar ' + NOMES[id]; bgirar.disabled = tipoDe(id) === 'pufe'; };
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
    // PASSOU DO MEIO, VIRA (pedido dele, 16/10/2026): o quarto é espelhado na diagonal u = v (a parede da esquerda é
    // v = 0, a da direita u = 0). O móvel que atravessa a diagonal troca para a vista espelhada — o que estava de costas
    // para uma parede fica de costas para a outra: sudoeste ↔ sudeste, noroeste ↔ nordeste (lado → 3 − lado). Meia casa
    // de folga, para não ficar virando em cima da linha.
    const qu = u + pegaDelta[0], qv = v + pegaDelta[1];
    if (VISTAS[pegado] && !ehDeitado(pegado)) {
      viva.metade ??= Math.sign(ARR[pegado].c[0] - ARR[pegado].c[1]) || 1;
      if ((qu - qv) * viva.metade < -0.5) { ARR[pegado].lado = 3 - ARR[pegado].lado; viva.metade = -viva.metade; viva.girou = true; }
    }
    const [tu, tv] = tamDe(pegado, ARR[pegado].lado);
    ARR[pegado].c = [Math.max(tu / 2, Math.min(N - tu / 2, qu)), Math.max(tv / 2, Math.min(N - tv / 2, qv))];
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
      // Editando, o clique arruma: a função não abre (relato dele, 16/10/2026).
      const f = FUNCOES && !soVer && !EDITANDO ? FUNCAO_DO_MOVEL[pegado] : null, comFuncao = !!(f && FUNCOES[f]);
      if (CENA === 'salao' && f) { if (comFuncao) acao(f); alvo = null; pegado = null; desenhar(); return; } // no salão o coelho do recado não sai do balcão
      if (funcaoNaChegada) { clearTimeout(funcaoNaChegada.prazo); funcaoNaChegada = null; } // mudou de ideia: a função de antes não abre mais
      if (pegado === 'guarda-roupa' && guardaRoupaAberto) guardaRoupaAberto = false;
      // a animação primeiro, e a função na chegada (o guarda-roupa conta a dele quando as portas abrem)
      else if (comFuncao && f !== 'gavetas') pedirNaChegada(pegado, f);
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
    if (tipoDe(id) === 'pufe' || !ARR[id]) return;
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
  // o pé do tapete na grade e o chão que o desenho dele cobre de verdade (o teste confere que batem)
  window.tapeteDoTeste = () => { let u0 = N, u1 = 0, v0 = N, v1 = 0; for (let k = 0; k < W * W; k++) if (dono[k] === 'tapete' && casa[k] >= 0) { u0 = Math.min(u0, mapaU[k]); u1 = Math.max(u1, mapaU[k]); v0 = Math.min(v0, mapaV[k]); v1 = Math.max(v1, mapaV[k]); } return { pe: ARR.tapete && peDe('tapete'), desenho: [u0, u1, v0, v1] }; };
  window.donoDoPixel = (x, y) => ({ dono: dono[y * W + x], obj: donoObj[y * W + x] }); // para o teste
  window.pixelDe = (id) => { let m = null; for (let k = 0; k < W * W; k++) if (dono[k] === id) { m = k; break; } return m === null ? null : [m % W, ((m / W) | 0) + 4]; }; // para o teste
  window.seguradoDoTeste = () => ({ arrastando, viva: viva && { ...viva }, pegado, objPego }); // para o teste
  function girarSegurado(sentido) {
    if (objPego && objPego.vivo) { objPego.o = { ...objPego.o, lado: (objPego.o.lado + (sentido > 0 ? 1 : 3)) % 4 }; objPego.vivo = { ...objPego.vivo, lado: (objPego.vivo.lado + (sentido > 0 ? 1 : 3)) % 4 }; objPego.girou = true; desenhar(); return true; }
    if (objPego) { const o = EM_CIMA[objPego.uid]; EM_CIMA = { ...EM_CIMA, [objPego.uid]: { ...o, lado: (o.lado + (sentido > 0 ? 1 : 3)) % 4 } }; objPego.girou = true; guardarObjetos(); desenhar(); return true; }
    if (arrastando && viva && viva.modo === 'arrasto' && tipoDe(viva.id) !== 'pufe') {
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
  // OS ATALHOS (o layout dele, 16/10/2026): os de editar valem no Editar, com algo escolhido.
  document.addEventListener('keydown', (e) => {
    if (soVer || e.target?.closest?.('input, textarea')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && !e.shiftKey && k === 'z') { e.preventDefault(); desfazer(); return; }
    if (ctrl && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); refazer(); return; }
    if (ctrl && k === 's' && rascunho !== null) { e.preventDefault(); salvarRascunho(); return; }
    if (EDITANDO && selecao) {
      if (ctrl && k === 'd') { e.preventDefault(); duplicarEscolhido(); return; }
      if (!ctrl && (k === 'delete' || k === 'backspace')) { e.preventDefault(); tirarEscolhido(); return; }
      if (!ctrl && k === 'g') { if (movendo) pararDeMover(); else comecarAMover(); return; }
      if (!ctrl && k === 'e') { opcoesAbertas = !opcoesAbertas; montarBarrinha(); return; }
      if (k === 'escape') { if (movendo) pararDeMover(); else selecionar(null); return; }
      if (!ctrl && k === 'r' && !arrastando && !objPego && selecao.chave[0] === 'm') { escolher(selecao.chave.slice(1)); girar(); return; }
      if (!ctrl && k === 'r' && !objPego && selecao.chave[0] === 'o') { const id = selecao.chave.slice(1), o = EM_CIMA[id]; if (o) { EM_CIMA = { ...EM_CIMA, [id]: { ...o, lado: (o.lado + (e.shiftKey ? 3 : 1)) % 4 } }; guardarObjetos(); desenhar(); } return; }
    }
    if (k === 'r') girarSegurado(e.shiftKey ? -1 : 1);
  });
  document.getElementById('inicial').onclick = () => { ARR = JSON.parse(JSON.stringify(INICIAL)); GUARDADOS = new Set(GUARDADOS_DE_FABRICA.filter(podeGuardar)); for (const id of GUARDADOS) delete ARR[id]; guardarGuardados(); botoesDosMoveis(); naMesa(); guardarCadeira(); guardar(); NA_PAREDE = prenderTudo(PAREDE_INICIAL); guardarParede(); CORES = {}; guardarCores(); botaoDaCor(); vestirOpcoes(); botaoDaOpcao(); EM_CIMA = EM_CIMA_INICIAL(); guardarObjetos(); botoesDaParede(); mudarJanela({ ...JANELA_INICIAL }); };
  escolher(ARR.poltrona ? 'poltrona' : Object.keys(ARR)[0]);
  const btela = document.getElementById('tela-pc'), NOMES_TELA = { auto: 'automática', call: 'em call', conversa: 'conversa', jogo: 'jogo', desligada: 'desligada' };
  btela.onclick = () => { conteudo = CONTEUDOS[(CONTEUDOS.indexOf(conteudo) + 1) % CONTEUDOS.length]; btela.textContent = 'Tela: ' + NOMES_TELA[conteudo]; assinaturaCena = ''; desenhar(); };
  iniciarCadeira();
  const botoes = { dia: document.getElementById('dia'), noite: document.getElementById('noite') };
  for (const [n, o] of Object.entries(botoes)) o.setAttribute('aria-pressed', String(n === modo));
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
    janela: { ...JAN }, cortina: fechada, janelaAberta: aberta, abajurApagado, vista,
    cores: { ...CORES },
    guardados: [...GUARDADOS],
    conhecidos: Object.keys(ITENS_PAREDE),
    emCima: Object.fromEntries(Object.entries(EM_CIMA).map(([uid, o]) => [uid, { tipo: o.tipo, em: o.em, s: +o.s.toFixed(3), t: +o.t.toFixed(3), lado: o.lado }])),
    parede: Object.fromEntries(Object.entries(NA_PAREDE).map(([id, P]) => [id, { parede: P.parede, v: +P.v.toFixed(2), h: Math.round(P.h) }])),
  });
  // Põe no quarto uma arrumação (a guardada, ou a de quem se visita). Móvel que o quarto não conhece fica de fora; o que
  // falta nela fica onde está na de fábrica.
  function vestir(a) {
    const novo = JSON.parse(JSON.stringify(INICIAL));
    for (const [id, m] of Object.entries(a.moveis ?? {})) if ((novo[id] || (ehCopia(id) && INICIAL[tipoDe(id)])) && Array.isArray(m.c)) novo[id] = { c: [m.c[0], m.c[1]], lado: m.lado };
    GUARDADOS = new Set((Array.isArray(a.guardados) ? a.guardados : []).filter(podeGuardar));
    for (const id of GUARDADOS) delete novo[id];
    ARR = novo; reencaixarPlantas();
    if (a.cadeira) { Object.assign(cadeira, { u: a.cadeira.u, v: a.cadeira.v, th: a.cadeira.th, vu: 0, vv: 0, w: 0, kin: null }); soltarDosMoveis(); }
    JAN = a.janela && TIPOS_JANELA[a.janela.tipo] ? prenderJanela(a.janela) : { ...JANELA_INICIAL };
    EM_CIMA = a.emCima && typeof a.emCima === 'object' ? Object.fromEntries(Object.entries(a.emCima).filter(([, o]) => OBJ_VISTAS[o.tipo] && TOPOS[o.em] && ARR[o.em])) : EM_CIMA_INICIAL();
    CORES = a.cores && typeof a.cores === 'object' ? Object.fromEntries(Object.entries(a.cores).filter(([id, c]) => (id === 'tapete' && CORES_DO_TAPETE[c]) || OPCOES_PAREDE[id]?.[c])) : {};
    botaoDaCor(); vestirOpcoes(); botaoDaOpcao();
    NA_PAREDE = a.parede ? prenderTudo(comNovos(Object.fromEntries(Object.entries(a.parede).filter(([id]) => ITENS_PAREDE[id])), a.conhecidos)) : prenderTudo(PAREDE_INICIAL);
    aplicarJanela();
    fechada = !!a.cortina && !!TIPOS_JANELA[JAN.tipo].cortina; aberta = !!a.janelaAberta && !!TIPOS_JANELA[JAN.tipo].abre;
    abajurApagado = !!a.abajurApagado;
    if (Number.isInteger(a.vista)) { vista = a.vista % 4; bv.textContent = 'Vista: ' + (vista + 1); }
    botoesDaJanela(); botoesDaParede(); botoesDosMoveis();
    if (!ARR[selecionado] && selecionado !== 'cadeira') escolher(Object.keys(ARR)[0]);
    assinaturaCena = ''; decidir(); desenhar();
  }
  window.vestirDoTeste = (a) => vestir(a); // para o teste
  window.tiposDoTeste = () => ({ moveis: Object.fromEntries(Object.keys(INICIAL).map((id) => [id, NOMES[id] ?? null])), parede: Object.fromEntries(Object.keys(ITENS_PAREDE).map((id) => [id, ITENS_PAREDE[id].nome ?? null])), deCima: Object.fromEntries(Object.entries(OBJETOS_DE_CIMA).map(([id, o]) => [id, o.nome])), janelas: Object.fromEntries(Object.entries(TIPOS_JANELA).map(([id, j]) => [id, j.nome])) }); // para o teste
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
  let esperaDoEnvio = 0, envioPendente = false;
  // DESFAZER (16/10/2026, da referência de interface dele): toda mudança da arrumação passa por aqui, e o retrato de
  // antes vai para uma pilha; Ctrl+Z (ou o Desfazer da barra do app) volta um passo. Sem "Aplicar": cada mudança já vale
  // ("depois do sim, não pergunte de novo"), e desfazer é o arrependimento.
  // REFAZER (16/10/2026, o layout dele): o que se desfez vai para outra pilha, e uma mudança nova a esvazia.
  const historico = [], refeitos = [];
  let retratoAtual = null, desfazendo = false;
  const marcarBase = () => { retratoAtual = JSON.stringify(retrato()); historico.length = 0; refeitos.length = 0; relatar(); };
  function anotar() {
    if (soVer) return;
    const r = JSON.stringify(retrato());
    if (retratoAtual !== null && r !== retratoAtual && !desfazendo) { historico.push(retratoAtual); if (historico.length > 50) historico.shift(); refeitos.length = 0; }
    retratoAtual = r;
  }
  const ocupadoAgora = () => arrastando || viva || paredePega || janelaPega || objPego;
  function vestirEGuardar(retr) {
    desfazendo = true;
    try {
      vestir(JSON.parse(retr));
      guardarGuardados(); guardarParede(); guardarCores(); guardarObjetos(); guardarJanela(); guardarCadeira(); guardar();
    } finally { desfazendo = false; }
    selecionar(null);
  }
  function desfazer() {
    if (soVer || !historico.length || ocupadoAgora()) return;
    refeitos.push(retratoAtual ?? JSON.stringify(retrato()));
    vestirEGuardar(historico.pop());
  }
  function refazer() {
    if (soVer || !refeitos.length || ocupadoAgora()) return;
    historico.push(retratoAtual ?? JSON.stringify(retrato()));
    vestirEGuardar(refeitos.pop());
  }
  window.desfazerDoTeste = () => historico.length; // para o teste
  window.refazerDoTeste = () => refeitos.length; // para o teste
  // O RASCUNHO DO EDITAR (decisão dele, 16/10/2026: "pendente até Aplicar"). Editando, as mudanças valem na tela e no
  // navegador, mas só vão ao servidor no Salvar ou no Aplicar; Cancelar volta ao que estava ao entrar (ou ao último
  // Salvar). Fora do Editar (arrastar sem entrar nele, a cortina, a cadeira), tudo continua indo na hora.
  let rascunho = null; // o retrato do que está no servidor, enquanto se edita
  const pendente = () => rascunho !== null && JSON.stringify(retrato()) !== rascunho;
  function enviarAgora() {
    clearTimeout(esperaDoEnvio);
    if (!conta || soVer) return;
    envioPendente = true;
    pedir('PUT', ROTA, retrato()).then(() => dizer('Guardado no servidor.')).catch((e) => dizer('Não guardou: ' + e.message)).finally(() => { envioPendente = false; });
  }
  function comecarRascunho() { rascunho = JSON.stringify(retrato()); relatar(); }
  function salvarRascunho() { if (rascunho === null) return; enviarAgora(); rascunho = JSON.stringify(retrato()); relatar(); }
  function aplicarRascunho() { if (rascunho === null) return; if (pendente()) enviarAgora(); rascunho = null; relatar(); }
  function cancelarRascunho() {
    if (rascunho === null) return;
    const volta = rascunho; rascunho = null;
    if (JSON.stringify(retrato()) !== volta) { vestirEGuardar(volta); anotar(); }
    relatar();
  }
  window.rascunhoDoTeste = () => ({ ativo: rascunho !== null, pendente: pendente() }); // para o teste
  // A página só oferece o Duplicar quando o servidor diz que aceita cópias (um servidor antigo recusaria a arrumação
  // inteira). Sem servidor (a página de teste), pode.
  let PODE_COPIAR = !MODO_APP || window.parent === window; // (aberta sozinha, para teste: pode)
  enviar = () => {
    anotar();
    relatar();
    if (!conta || soVer || rascunho !== null) return; // no rascunho, só no Salvar ou no Aplicar
    clearTimeout(esperaDoEnvio);
    envioPendente = true;
    esperaDoEnvio = setTimeout(() => { pedir('PUT', ROTA, retrato()).then(() => dizer('Entrou como ' + conta.nome + ' (conta ' + conta.id + '). Guardado no servidor.')).catch((e) => dizer('Não guardou: ' + e.message)).finally(() => { envioPendente = false; }); }, 700);
  };
  async function carregarMeu() {
    const { arrumacao, copias } = await pedir('GET', ROTA);
    PODE_COPIAR = !!copias;
    if (arrumacao) vestir(arrumacao); else enviar(); // ainda não tinha: o que está na tela vira o dele
    marcarBase(); // desfazer não volta para antes do que veio do servidor
    if (rascunho !== null) rascunho = JSON.stringify(retrato());
    dizer('Entrou como ' + conta.nome + ' (conta ' + conta.id + ').');
  }
  // O SALÃO MUDOU (salao:mudou): relê. O aviso chega também para quem mudou; aí a arrumação lida é a mesma da tela, e o
  // desfazer dele continua valendo.
  async function reler() {
    const { arrumacao } = await pedir('GET', ROTA);
    // (quem está com um rascunho aberto não é atropelado pela mudança de outra pessoa)
    if (!arrumacao || envioPendente || arrastando || viva || rascunho !== null) return;
    vestir(arrumacao);
    if (JSON.stringify(retrato()) !== retratoAtual) marcarBase();
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
    window.parent.postMessage({ syden: 'quarto', arrumacao: { desfazer: historico.length > 0, refazer: refeitos.length > 0, pendente: pendente(), rascunho: rascunho !== null, copias: PODE_COPIAR, presentes: presentes(), selecao: selecao?.chave ?? null, janela: JAN.tipo, tapete: CORES.tapete ?? 'salvia', opcoes: Object.fromEntries(Object.keys(OPCOES_PAREDE).map((id) => [id, opcaoDe(id)])), moveis: Object.fromEntries(Object.keys(INICIAL).filter(podeGuardar).map((id) => [id, !!ARR[id]])), parede: Object.fromEntries(Object.keys(ITENS_PAREDE).map((id) => [id, !!NA_PAREDE[id]])) } }, location.origin);
  }
  // As figuras da barra (sem texto, para não pedir tradução): o recorte de cada objeto da parede, e a cor de cada tapete.
  function figurasDaBarra() {
    const miniaturas = {};
    const recorte = (dia) => {
      let x0 = W, y0 = W, x1 = 0, y1 = 0;
      for (let k = 0; k < W * W; k++) if (dia[k * 4 + 3] > 127) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
      const d = new ImageData(c.width, c.height);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = (y * W + x) * 4, j = ((y - y0) * c.width + (x - x0)) * 4; for (let q = 0; q < 4; q++) d.data[j + q] = dia[k + q]; }
      c.getContext('2d').putImageData(d, 0, 0);
      return c.toDataURL();
    };
    // (só o NÚCLEO do objeto: o recorte traz pedaços da parede e da sombra em volta — o fone parecia "com pedaços da
    // parede" no catálogo, relato dele de 16/10/2026)
    const soNucleo = (T2) => { const nuc = nucleoDe(T2), d = new Uint8ClampedArray(T2.dia); for (let k = 0; k < W * W; k++) if (!nuc[k]) d[k * 4 + 3] = 0; return d; };
    for (const [id, T2] of Object.entries(TEXTURAS_PAREDE)) miniaturas[id] = recorte(soNucleo(T2));
    // a cor média do tapete pintado, tingida em cada uma
    let n = 0; const m = [0, 0, 0];
    for (let k = 0; k < W * W; k++) if (pecas.tapete && pecas.tapete.movel[k * 4 + 3]) { for (let q = 0; q < 3; q++) m[q] += pecas.tapete.movel[k * 4 + q]; n++; }
    const media = m.map((v) => v / Math.max(1, n));
    const cores = Object.fromEntries(Object.entries(CORES_DO_TAPETE).map(([id, cor]) => [id, 'rgb(' + (id === 'salvia' ? media : tingirPixel(media[0], media[1], media[2], cor)).map(Math.round).join(',') + ')']));
    // e o primeiro desenho de cada objeto de cima
    const deCima = {};
    // (do desenho INTEIRO, preparado como na cena: na cena eles vão pela metade, no tamanho de verdade, e ampliados no
    // catálogo pareciam borrados — relato dele de 16/10/2026)
    for (const [id, vs] of Object.entries(OBJ_VISTAS)) {
      const v0 = im['obj-' + id + '0'] ? pecaDeImagem(im['obj-' + id + '0'], id) : vs[0], [x0, y0, x1, y1] = v0.caixa, c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
      const d = new ImageData(c.width, c.height);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * W + x) * 4, j = ((y - y0) * c.width + (x - x0)) * 4; for (let q = 0; q < 4; q++) d.data[j + q] = v0.movel[k + q]; }
      c.getContext('2d').putImageData(d, 0, 0);
      deCima[id] = c.toDataURL();
    }
    // e as opções de cada objeto que tem (o pôster): o recorte de cada uma
    const opcoes = Object.fromEntries(Object.entries(OPCOES_PAREDE).map(([id, ops]) => [id, Object.fromEntries(Object.entries(ops).map(([nome, o]) => [nome, recorte(soNucleo(o))]))]));
    // e cada móvel que se pode guardar: a vista de fábrica dele (ou o recorte da pintura, como o tapete)
    const moveis = {};
    // (todos, desde 16/10/2026: no catálogo do Editar, o que já está no quarto ganha uma cópia; os que se guardam vão
    // também em "guardaveis", a lista de antes)
    for (const id of Object.keys(INICIAL)) { const fonte = VISTAS[id]?.[INICIAL[id].lado]?.movel ?? pecas[id]?.movel ?? (id === 'pufe' ? pecas[(varianteDoPufe() ?? pufes[0])?.id]?.movel : null); if (fonte) moveis[id] = recorte(fonte); } // (o pufe mora nas variantes de luz dele)
    const guardaveis = Object.keys(INICIAL).filter((id) => podeGuardar(id) && moveis[id]);
    // e cada tipo de janela (com a cortina, na que tem): a barra mostra a figura de cada uma, e não um botão que troca às
    // cegas (relato dele, 16/10/2026: o "Janela" trocava o tipo, e só a original tem cortina e abre)
    const janelas = {};
    for (const [t, T2] of Object.entries(TIPOS_JANELA)) {
      if (!T2.dia) continue;
      const d = new Uint8ClampedArray(T2.dia);
      // o vidro vem na cor-máscara (magenta): na figura, um céu claro
      for (let k = 0; k < W * W; k++) if (d[k * 4 + 3] > 127 && ((T2.vidro && T2.vidro[k * 4] > 127) || (d[k * 4] > 200 && d[k * 4 + 1] < 80 && d[k * 4 + 2] > 200))) { d[k * 4] = 168; d[k * 4 + 1] = 206; d[k * 4 + 2] = 232; }
      if (T2.cortinaDia) for (let k = 0; k < W * W; k++) if (T2.cortinaDia[k * 4 + 3] > 127) for (let q = 0; q < 4; q++) d[k * 4 + q] = T2.cortinaDia[k * 4 + q];
      janelas[t] = recorte(d);
    }
    return { miniaturas, cores, ordem: Object.keys(ITENS_PAREDE), deCima, opcoes, moveis, guardaveis, janelas };
  }

  // ============================== A BARRINHA DO QUE ESTÁ ESCOLHIDO (16/10/2026) ==============================
  // Da referência de interface dele: no Editar, o que se toca (o móvel, o objeto da parede, a janela, o objeto de cima)
  // fica ESCOLHIDO, com o contorno claro, e ganha em cima dele uma barrinha com o que se faz com ELE: girar, tirar, as
  // opções (a cor do tapete, a arte do pôster, o tipo de janela) e, na janela, a cortina e abrir. Antes o Girar ficava na
  // barra do app e girava "o último móvel tocado", o que ninguém adivinha. Os nomes (dica e leitor de tela) vêm do app.
  let ROTULOS = { mover: 'Mover', girar: 'Girar', tirar: 'Tirar', duplicar: 'Duplicar', opcoes: 'Opções', cortina: 'Cortina', janela: 'Janela', sobre: 'Sobre' };
  const barrinha = document.getElementById('barrinha');
  let opcoesAbertas = false, FIGURAS = null;
  const figurasCache = () => (FIGURAS ??= figurasDaBarra());
  window.figurasDoTeste = () => figurasCache(); // para o teste
  const ICONES = {
    mover: '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
    duplicar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    girar: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    tirar: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    opcoes: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    cortina: '<path d="M3 3h18"/><path d="M5 3v18c2.5-1.5 4-5 4-9S7.5 4.5 5 3"/><path d="M19 3v18c-2.5-1.5-4-5-4-9s1.5-7.5 4-9"/>',
    janela: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18"/><path d="M4 12h16"/>',
    sobre: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  };
  function escolhaEm(k) {
    const uo = donoObj[k];
    if (uo && EM_CIMA[uo]) return 'o' + uo;
    if (dono[k] === 'cadeira' || ARR[dono[k]]) return 'm' + dono[k];
    if (naParede[k] && !dono[k]) return 'p' + ordemDaParede[naParede[k] - 1];
    if (naJanela[k] && !dono[k]) return 'j';
    return null;
  }
  function selecionar(chave) {
    if ((selecao?.chave ?? null) === (chave ?? null)) return;
    selecao = chave ? { chave, caixa: null, cena: null } : null; opcoesAbertas = false;
    if (chave?.[0] === 'm') escolher(chave.slice(1));
    montarBarrinha(); desenhar();
    relatar(); // os atalhos do editor do app acendem com algo escolhido
  }
  window.selecaoDoTeste = () => selecao && selecao.chave; // para o teste
  window.selecionarDoTeste = (chave) => selecionar(chave); // para o teste
  // No Editar, tocar escolhe (antes de os outros pegarem o clique: o objeto da parede o segura só para ele).
  tela.addEventListener('pointerdown', (e) => { if (EDITANDO && !soVer) selecionar(escolhaEm(pixelDo(e))); }, true);
  const botaoDaBarrinha = (nome, acao, { pressionado, desligado } = {}) => {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONES[nome] + '</svg>';
    b.setAttribute('aria-label', ROTULOS[nome]); b.title = ROTULOS[nome]; b.dataset.acao = nome;
    if (pressionado !== undefined) b.setAttribute('aria-pressed', String(!!pressionado));
    b.disabled = !!desligado;
    b.onclick = (ev) => { ev.stopPropagation(); acao(); };
    return b;
  };
  const figuraDaBarrinha = (conteudo, ligada, acao) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed', String(!!ligada));
    if (typeof conteudo === 'string') { const im = document.createElement('img'); im.src = conteudo; im.alt = ''; b.append(im); } else b.append(conteudo);
    b.onclick = (ev) => { ev.stopPropagation(); acao(); montarBarrinha(); };
    return b;
  };
  function montarBarrinha() {
    const ch = selecao?.chave;
    if (!ch) { barrinha.hidden = true; barrinha.replaceChildren(); return; }
    const tipo = ch[0], id = ch.slice(1), botoesB = [], opcoes = [];
    // mover, girar, tirar, duplicar e "…" (a ordem da referência dele)
    if (tipo !== 'j' && ch !== 'mcadeira') botoesB.push(botaoDaBarrinha('mover', () => (movendo ? pararDeMover() : comecarAMover()), { pressionado: !!movendo }));
    if (tipo === 'm') {
      if (tipoDe(id) !== 'pufe') botoesB.push(botaoDaBarrinha('girar', () => { escolher(id); girar(); }));
      if (podeTirar(ch)) botoesB.push(botaoDaBarrinha('tirar', () => tirarEscolhido()));
      if (podeDuplicar(ch)) botoesB.push(botaoDaBarrinha('duplicar', () => duplicarEscolhido()));
      if (tipoDe(id) === 'tapete') for (const [cor, css] of Object.entries(figurasCache().cores)) {
        const bola = document.createElement('span'); bola.className = 'cor'; bola.style.background = css;
        opcoes.push(figuraDaBarrinha(bola, (CORES.tapete ?? 'salvia') === cor, () => { CORES = { ...CORES, tapete: cor }; guardarCores(); botaoDaCor(); desenhar(); }));
      }
    } else if (tipo === 'p') {
      botoesB.push(botaoDaBarrinha('tirar', () => tirarEscolhido()));
      if (podeDuplicar(ch)) botoesB.push(botaoDaBarrinha('duplicar', () => duplicarEscolhido()));
      if (OPCOES_PAREDE[id] && Object.keys(OPCOES_PAREDE[id]).length > 1) for (const [nome, src] of Object.entries(figurasCache().opcoes[tipoDe(id)] ?? {})) opcoes.push(figuraDaBarrinha(src, opcaoDe(id) === nome, () => escolherOpcao(id, nome)));
    } else if (tipo === 'o') {
      botoesB.push(botaoDaBarrinha('girar', () => { const o = EM_CIMA[id]; if (o) { EM_CIMA = { ...EM_CIMA, [id]: { ...o, lado: (o.lado + 1) % 4 } }; guardarObjetos(); desenhar(); } }));
      botoesB.push(botaoDaBarrinha('tirar', () => tirarEscolhido()));
      if (podeDuplicar(ch)) botoesB.push(botaoDaBarrinha('duplicar', () => duplicarEscolhido()));
    } else if (tipo === 'j') {
      const T = TIPOS_JANELA[JAN.tipo];
      if (T.cortina) botoesB.push(botaoDaBarrinha('cortina', () => trocarCortina(), { pressionado: fechada }));
      // abrir com as cortinas fechadas não se veria: abre-se a cortina antes
      if (T.abre) botoesB.push(botaoDaBarrinha('janela', () => trocarJanela(), { pressionado: aberta, desligado: fechada }));
      const janelas = figurasCache().janelas ?? {};
      if (Object.keys(janelas).length > 1) for (const [t2, src] of Object.entries(janelas)) opcoes.push(figuraDaBarrinha(src, JAN.tipo === t2, () => { mudarJanela({ ...JAN, tipo: t2 }); selecao && (selecao.cena = null); }));
    }
    // o cartão da peça (o mesmo do clique fora do Editar), para as que têm função também
    const dd = chaveDoDetalhe(ch);
    if (dd) botoesB.push(botaoDaBarrinha('sobre', () => detalhar(dd[0], dd[1])));
    if (opcoes.length) botoesB.push(botaoDaBarrinha('opcoes', () => { opcoesAbertas = !opcoesAbertas; montarBarrinha(); }, { pressionado: opcoesAbertas }));
    const linha = document.createElement('div'); linha.className = 'botoes'; linha.append(...botoesB);
    const partes = [linha];
    if (opcoesAbertas && opcoes.length) { const o = document.createElement('div'); o.className = 'opcoes'; o.append(...opcoes); partes.push(o); }
    barrinha.replaceChildren(...partes);
    barrinha.hidden = !botoesB.length;
  }
  // Em cima do escolhido, centrada; sem espaço em cima (o alto da cena), vai para baixo dele.
  function posicionarBarrinha(sel) {
    if (!sel || !sel.caixa || !barrinha.childElementCount) { if (!barrinha.hidden && (!sel || !sel.caixa)) barrinha.style.visibility = 'hidden'; return; }
    barrinha.style.visibility = '';
    const rt = tela.getBoundingClientRect(), rm = barrinha.parentElement.getBoundingClientRect(), esc = rt.width / W, [x0, y0, x1, y1] = sel.caixa;
    const cx = rt.left + ((x0 + x1) / 2) * esc, topo = rt.top + y0 * esc, base = rt.top + y1 * esc, h = barrinha.offsetHeight, w = barrinha.offsetWidth;
    const embaixo = topo - h - 6 < 4;
    const x = Math.max(w / 2 + 4, Math.min(innerWidth - w / 2 - 4, cx));
    barrinha.style.left = x - rm.left + 'px';
    barrinha.style.top = (embaixo ? base + 6 : topo - h - 6) - rm.top + 'px';
    barrinha.style.transform = 'translateX(-50%)';
  }
  addEventListener('resize', () => { if (selecao) desenhar(); });

  // ============================== O ESTADO DE CADA OBJETO, NO BOTÃO DIREITO (16/10/2026) ==============================
  // O esquerdo usa a função (abre o Explorar, o Dia e noite, a Aparência…); o direito muda o objeto: a janela abre,
  // depois fecha a cortina, depois volta; o abajur apaga e acende; o guarda-roupa abre e fecha as portas; o computador,
  // a TV e o fliperama ligam e desligam a tela. No Editar vale igual.
  function alternarEstado(k) {
    const podeArrumar = !soVer;
    if (naJanela[k] && !dono[k]) {
      if (!podeArrumar) return false;
      const T = TIPOS_JANELA[JAN.tipo];
      // (fechada com a cortina aberta → aberta → cortina fechada → de volta)
      if (fechada) trocarCortina();
      else if (aberta) { trocarJanela(); if (T.cortina) trocarCortina(); }
      else if (T.abre) trocarJanela();
      else if (T.cortina) trocarCortina();
      else return false;
      return true;
    }
    const d = dono[k], tipo = d ? tipoDe(d) : '';
    if (tipo === 'abajur' && CENA === 'quarto' && podeArrumar) { abajurApagado = !abajurApagado; assinaturaCena = ''; enviar(); desenhar(); return true; }
    if (d === 'guarda-roupa' && VISTAS_ABERTO && podeArrumar) { guardaRoupaAberto = !guardaRoupaAberto; gavetasPedidas = false; desenhar(); return true; }
    if (d === 'mesa' && CENA === 'quarto') { conteudo = conteudoAgora() === 'desligada' ? 'conversa' : 'desligada'; assinaturaCena = ''; desenhar(); return true; }
    if (d === 'ilha') { fogaoAceso = !fogaoAceso; assinaturaCena = ''; desenhar(); return true; }
    // A TV troca de canal (o ao vivo primeiro, havendo) e, depois do último, desliga; desligada, volta ao primeiro.
    if (d === 'tv') {
      const ciclo = [...(AO_VIVO ? ['ao-vivo'] : []), ...CANAIS_DA_TV], i = ciclo.indexOf(canalDaTvAgora());
      if (telasDesligadas.has('tv')) { telasDesligadas.delete('tv'); canalDaTv = ciclo[0]; }
      else if (i === ciclo.length - 1) telasDesligadas.add('tv');
      else canalDaTv = ciclo[i + 1];
      assinaturaCena = ''; desenhar(); return true;
    }
    if (d === 'fliperama') { if (telasDesligadas.has(d)) telasDesligadas.delete(d); else telasDesligadas.add(d); assinaturaCena = ''; desenhar(); return true; }
    return false;
  }
  window.estadoDoTeste = () => ({ abajurApagado, guardaRoupaAberto, conteudo, telas: [...telasDesligadas], canalDaTv: canalDaTvAgora(), fogaoAceso, cortina: fechada, aberta }); // para o teste
  // (o botão direito não pega, não arrasta nem escolhe: só o menu de contexto, logo abaixo, o atende)
  addEventListener('pointerdown', (e) => { if (e.target === tela && e.button !== 0) e.stopImmediatePropagation(); }, true);
  tela.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // nunca o menu do navegador em cima da cena
    if (movendo || arrastando || objPego || paredePega || janelaPega) return;
    alternarEstado(pixelDo(e));
  });

  // ============================== DUPLICAR, TIRAR, MOVER E PÔR (16/10/2026, o layout dele) ==============================
  // "Tudo pode duplicar" (decisão dele): a cópia de um móvel vai para a casa livre mais perto dele; a de um objeto da
  // parede, para o lado dele na mesma parede; a de um objeto de cima, para perto dele no mesmo tampo. TIRAR a cópia a
  // apaga; tirar o original o guarda (como antes). MOVER (G) leva o escolhido com o ponteiro até o próximo clique.
  const MAX_PECAS = 80; // o servidor aceita até 80 móveis e 80 objetos da parede
  const novoIdDe = (tipo, tem) => { for (let n = 2; ; n++) if (!tem[tipo + '~' + n]) return tipo + '~' + n; };
  const temDesenho = (tipo) => !!VISTAS[tipo] || tipo === 'tapete' || tipo === 'pufe';
  function podeDuplicar(ch) {
    if (!PODE_COPIAR || soVer || !ch) return false;
    const t = ch[0], id = ch.slice(1), tipo = tipoDe(id);
    if (t === 'm') return tipo !== 'cadeira' && !!ARR[id] && temDesenho(tipo) && Object.keys(ARR).length < MAX_PECAS;
    if (t === 'p') return !!NA_PAREDE[id] && Object.keys(NA_PAREDE).length < MAX_PECAS;
    if (t === 'o') return !!EM_CIMA[id] && Object.keys(EM_CIMA).length < 60;
    return false;
  }
  const podeTirar = (ch) => !soVer && !!ch && (ch[0] === 'p' || ch[0] === 'o' || (ch[0] === 'm' && (ehCopia(ch.slice(1)) || podeGuardar(ch.slice(1)))));
  // A casa livre mais perto de c0 (a de fábrica, ou a do original): a mesma busca de pôr um móvel guardado de volta.
  function lugarLivre(id, c0, lado) {
    const base = encaixar(id, ...c0, lado), opcoes = [];
    for (let di = -N; di <= N; di++) for (let dj = -N; dj <= N; dj++) opcoes.push(encaixar(id, base[0] + di, base[1] + dj, lado));
    opcoes.sort((a, b) => Math.hypot(a[0] - base[0], a[1] - base[1]) - Math.hypot(b[0] - base[0], b[1] - base[1]));
    return opcoes.find((p) => !ocupa(p, id, lado)) ?? null;
  }
  function porCopiaDoMovel(tipo, perto) {
    if (!temDesenho(tipo) || Object.keys(ARR).length >= MAX_PECAS) return null;
    const id = novoIdDe(tipo, ARR), lado = (perto && ARR[perto] ? ARR[perto].lado : INICIAL[tipo]?.lado) ?? 0;
    const c0 = perto && ARR[perto] ? ARR[perto].c : INICIAL[tipo]?.c ?? [N / 2, N / 2];
    ARR[id] = { c: [...c0], lado };
    const c = lugarLivre(id, c0, lado);
    if (!c) { delete ARR[id]; dizer('Não há espaço livre para mais um.'); return null; }
    ARR[id] = { c, lado }; soltarFaiscas(peDe(id));
    guardar(); colidir(); assinaturaCena = ''; botoesDosMoveis(); decidir(); desenhar();
    return id;
  }
  function porCopiaNaParede(tipo, perto) {
    if (Object.keys(NA_PAREDE).length >= MAX_PECAS) return null;
    const id = novoIdDe(tipo, NA_PAREDE);
    if (perto && CORES[perto] && OPCOES_PAREDE[tipo]) { CORES = { ...CORES, [id]: CORES[perto] }; guardarCores(); }
    NA_PAREDE[id] = perto && NA_PAREDE[perto] ? { ...NA_PAREDE[perto] } : prenderNaParede(id, { parede: 'esquerda', v: 0, h: 0 });
    vestirOpcoes();
    // ao lado do original, na mesma parede e altura; senão, onde couber
    let lugar = null;
    if (perto && NA_PAREDE[perto]) {
      const it = ITENS_PAREDE[id], larg = it.ocupa[1] - it.ocupa[0] + 0.25;
      for (const dv of [larg, -larg, 2 * larg, -2 * larg, 3 * larg, -3 * larg]) { const P = prenderNaParede(id, { ...NA_PAREDE[perto], v: NA_PAREDE[perto].v + dv }); if (livreNaParede(id, P)) { lugar = P; break; } }
    }
    if (lugar) { mudarParede(id, lugar); botoesDaParede(); } else { delete NA_PAREDE[id]; alternarNaParede(id); }
    return NA_PAREDE[id] ? id : null;
  }
  function copiaDoObjeto(uid) {
    const o = EM_CIMA[uid]; if (!o || Object.keys(EM_CIMA).length >= 60) return null;
    const outros = Object.values(EM_CIMA).filter((x) => x.em === o.em);
    let lugar = [o.s, o.t];
    for (const [ds, dt] of [[0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22], [0.22, 0.22], [-0.22, -0.22]]) {
      const s2 = Math.min(0.9, Math.max(0.1, o.s + ds)), t2 = Math.min(0.9, Math.max(0.1, o.t + dt));
      if (outros.every((x) => Math.hypot(x.s - s2, x.t - t2) > 0.18)) { lugar = [s2, t2]; break; }
    }
    const novo = 'o' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36);
    EM_CIMA = { ...EM_CIMA, [novo]: { ...o, s: lugar[0], t: lugar[1] } };
    guardarObjetos(); desenhar();
    return novo;
  }
  function duplicarEscolhido() {
    if (!selecao || !podeDuplicar(selecao.chave)) return;
    const t = selecao.chave[0], id = selecao.chave.slice(1);
    const novo = t === 'm' ? porCopiaDoMovel(tipoDe(id), id) : t === 'p' ? porCopiaNaParede(tipoDe(id), id) : copiaDoObjeto(id);
    if (novo) selecionar(t + novo);
  }
  function tirarCopiaDoMovel(id) {
    if (!ARR[id] || viva?.id === id || pegado === id) return;
    delete ARR[id];
    EM_CIMA = Object.fromEntries(Object.entries(EM_CIMA).filter(([, o]) => o.em !== id)); guardarObjetos();
    guardar(); colidir(); assinaturaCena = ''; botoesDosMoveis(); desenhar();
  }
  function tirarEscolhido() {
    if (!selecao || !podeTirar(selecao.chave)) return;
    const t = selecao.chave[0], id = selecao.chave.slice(1);
    selecionar(null);
    if (t === 'm') { if (ehCopia(id)) tirarCopiaDoMovel(id); else alternarMovel(id); }
    else if (t === 'p') { alternarNaParede(id); if (ehCopia(id) && CORES[id]) { const { [id]: _fora, ...resto } = CORES; CORES = resto; guardarCores(); } }
    else if (t === 'o') { const { [id]: _fora, ...resto } = EM_CIMA; EM_CIMA = resto; guardarObjetos(); desenhar(); }
  }
  // Pelo catálogo (a lateral do Editar): o original guardado volta; o que já está no quarto ganha uma cópia.
  function porDoCatalogo(grupo, tipo) {
    if (soVer) return;
    let novo = null;
    if (grupo === 'm' && INICIAL[tipo]) {
      if (!ARR[tipo]) { alternarMovel(tipo); novo = ARR[tipo] ? tipo : null; }
      else if (PODE_COPIAR) novo = porCopiaDoMovel(tipo, tipo);
    } else if (grupo === 'p' && ITENS_PAREDE[tipo]) {
      if (!NA_PAREDE[tipo]) { alternarNaParede(tipo); novo = NA_PAREDE[tipo] ? tipo : null; }
      else if (PODE_COPIAR) novo = porCopiaNaParede(tipo, tipo);
    } else if (grupo === 'o' && OBJ_VISTAS[tipo]) {
      const antes = new Set(Object.keys(EM_CIMA)); porObjeto(tipo); novo = Object.keys(EM_CIMA).find((u) => !antes.has(u)) ?? null;
    }
    if (novo && EDITANDO) selecionar(grupo + novo);
  }
  // TIRAR PELO CATÁLOGO (o item marcado sai, como a lixeira): o escolhido, se for desse tipo; senão a última cópia;
  // senão o original, guardado (o que tem função não se guarda: fica).
  function tirarDoCatalogo(grupo, ids) {
    if (soVer || !Array.isArray(ids)) return;
    const doTipo = (id) => ids.includes(tipoDe(id)), sel = selecao?.chave;
    const escolher1 = (todos) => (sel && sel[0] === grupo && todos.includes(sel.slice(1)) ? sel.slice(1) : todos.filter(ehCopia).pop() ?? [...todos].reverse().find((id) => grupo !== 'm' || podeGuardar(id)));
    if (grupo === 'm') {
      const alvo = escolher1(Object.keys(ARR).filter(doTipo)); if (!alvo) return;
      if (selecao && selecao.chave === 'm' + alvo) selecionar(null);
      if (ehCopia(alvo)) tirarCopiaDoMovel(alvo); else alternarMovel(alvo);
    } else if (grupo === 'p') {
      const alvo = escolher1(Object.keys(NA_PAREDE).filter(doTipo)); if (!alvo) return;
      if (selecao && selecao.chave === 'p' + alvo) selecionar(null);
      alternarNaParede(alvo);
      if (ehCopia(alvo) && CORES[alvo]) { const { [alvo]: _fora, ...resto } = CORES; CORES = resto; guardarCores(); }
    } else if (grupo === 'o') {
      const uids = Object.keys(EM_CIMA).filter((u) => ids.includes(EM_CIMA[u].tipo));
      const alvo = sel && sel[0] === 'o' && uids.includes(sel.slice(1)) ? sel.slice(1) : uids.pop(); if (!alvo) return;
      if (selecao && selecao.chave === 'o' + alvo) selecionar(null);
      const { [alvo]: _fora, ...resto } = EM_CIMA; EM_CIMA = resto; guardarObjetos(); desenhar();
    }
  }
  // Quantos de cada tipo estão no quarto (a lateral marca o que está posto, e quantas cópias).
  function presentes() {
    const conta = (ids) => { const r = {}; for (const id of ids) { const t = tipoDe(id); r[t] = (r[t] ?? 0) + 1; } return r; };
    return { m: conta(Object.keys(ARR)), p: conta(Object.keys(NA_PAREDE)), o: conta(Object.values(EM_CIMA).map((o) => o.tipo)) };
  }
  // MOVER: o escolhido segue o ponteiro (de casa em casa, só onde cabe) até o próximo clique.
  let movendo = null;
  function comecarAMover() {
    if (!EDITANDO || soVer || !selecao || movendo) return;
    const t = selecao.chave[0];
    if (t === 'j' || selecao.chave === 'mcadeira') return; // a janela e a cadeira já andam arrastando
    movendo = { chave: selecao.chave }; tela.style.cursor = 'move'; montarBarrinha(); desenhar();
  }
  function pararDeMover() {
    if (!movendo) return;
    const { chave } = movendo, t = chave[0], id = chave.slice(1);
    movendo = null; tela.style.cursor = '';
    if (t === 'm' && ARR[id]) { guardar(); colidir(); decidir(); }
    if (t === 'p' && NA_PAREDE[id]) mudarParede(id, NA_PAREDE[id]);
    if (t === 'o') guardarObjetos();
    assinaturaCena = ''; montarBarrinha(); desenhar();
  }
  window.movendoDoTeste = () => movendo && movendo.chave; // para o teste
  tela.addEventListener('pointermove', (e) => {
    if (!movendo) return;
    const t = movendo.chave[0], id = movendo.chave.slice(1);
    if (t === 'm' && ARR[id]) {
      const [u, v] = uvDoPonteiro(e), { lado } = ARR[id], c = encaixar(id, u, v, lado);
      if ((c[0] !== ARR[id].c[0] || c[1] !== ARR[id].c[1]) && !ocupa(c, id, lado)) { ARR[id] = { c, lado }; assinaturaCena = ''; desenhar(); }
    } else if (t === 'p' && NA_PAREDE[id]) {
      const p = naParedeDo(e), it = ITENS_PAREDE[id], meio = (it.ocupa[0] + it.ocupa[1]) / 2;
      const novo = prenderNaParede(id, { parede: p.parede, v: Math.round((p.v - meio) * 4) / 4, h: NA_PAREDE[id].h });
      if (novo.parede !== NA_PAREDE[id].parede || novo.v !== NA_PAREDE[id].v) mudarParede(id, novo, true);
    } else if (t === 'o' && EM_CIMA[id]) {
      const tp = tampoDoPonteiro(e);
      if (tp && (tp.em !== EM_CIMA[id].em || Math.abs(tp.s - EM_CIMA[id].s) > 0.02 || Math.abs(tp.t - EM_CIMA[id].t) > 0.02)) { EM_CIMA = { ...EM_CIMA, [id]: { ...EM_CIMA[id], em: tp.em, s: +tp.s.toFixed(3), t: +tp.t.toFixed(3) } }; desenhar(); }
    }
  });
  // o clique que solta vem antes de todos os outros (senão ele também escolheria e pegaria o que está embaixo)
  addEventListener('pointerdown', (e) => { if (movendo && e.target === tela) { e.stopImmediatePropagation(); e.preventDefault(); pararDeMover(); } }, true);
  marcarBase(); // o ponto de partida do desfazer (sem servidor: o que está na tela; com, carregarMeu marca de novo)

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
      if (d.fecharGuardaRoupa && guardaRoupaAberto) { guardaRoupaAberto = false; gavetasPedidas = false; }
      if ('editando' in d) {
        const antes = EDITANDO; EDITANDO = !!d.editando; rotulo.hidden = true; realcar(null);
        if (EDITANDO && !antes) comecarRascunho();
        // sair do Editar sem dizer como (o app fechou a barra): o que estava pendente vale, como no Aplicar
        if (!EDITANDO) { selecionar(null); pararDeMover(); if (rascunho !== null) aplicarRascunho(); }
      }
      if (d.comando === 'salvar') salvarRascunho();
      if (d.comando === 'aplicar') aplicarRascunho();
      if (d.comando === 'cancelar') cancelarRascunho();
      if (d.comando === 'refazer') refazer();
      if (d.comando === 'duplicar') duplicarEscolhido();
      if (d.comando === 'tirar') tirarEscolhido();
      if (d.comando === 'mover') comecarAMover();
      if (d.comando === 'opcoes' && selecao) { opcoesAbertas = !opcoesAbertas; montarBarrinha(); }
      if (d.comando === 'por' && typeof d.id === 'string') porDoCatalogo(d.grupo, d.id);
      if (d.comando === 'tirarTipo') tirarDoCatalogo(d.grupo, d.ids);
      if (d.rotulos) { ROTULOS = { ...ROTULOS, ...d.rotulos }; montarBarrinha(); }
      if (d.comando === 'desfazer') desfazer();
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
      if (d.recarregar && conta && !arrastando && !viva && !envioPendente && rascunho === null) reler().catch(() => {});
      if ('aoVivo' in d) { if (!AO_VIVO && d.aoVivo) canalDaTv = null; AO_VIVO = d.aoVivo || null; desenhar(); } // começou uma transmissão: a TV vai a ela
      if ('imagem' in d) carregarImagem(d.imagem);
      if ('recado' in d) { const antes = JSON.stringify(RECADO); RECADO = d.recado && (d.recado.titulo || d.recado.texto) ? d.recado : null; if (RECADO && JSON.stringify(RECADO) !== antes) abrirRecado(); else posicionarRecado(true); }
      if (d.visitar) campo('visitar-id').value = String(d.visitar), campo('visitar').click();
      // A BARRA DE ARRUMAR do app (QuartoNovo.tsx): os mesmos botões da página de teste.
      if (d.comando === 'girar') girar();
      if (d.comando === 'janela') { if (TIPOS_JANELA[d.tipo]) mudarJanela({ ...JAN, tipo: d.tipo }); else btj.click(); }
      if (d.comando === 'tapete' && CORES_DO_TAPETE[d.cor]) { CORES = { ...CORES, tapete: d.cor }; guardarCores(); botaoDaCor(); desenhar(); }
      if (d.comando === 'parede' && ITENS_PAREDE[d.id]) alternarNaParede(d.id);
      if (d.comando === 'movel' && podeGuardar(d.id)) alternarMovel(d.id);
      if (d.comando === 'opcao' && OPCOES_PAREDE[d.id]?.[d.opcao]) escolherOpcao(d.id, d.opcao);
      if (d.comando === 'inicial') document.getElementById('inicial').click();
      if (d.comando === 'objeto' && OBJ_VISTAS[d.tipo]) porObjeto(d.tipo);
      if (Array.isArray(d.pessoas)) { PESSOAS = d.pessoas.slice(0, 12); desenhar(); }
    });
    window.parent.postMessage({ syden: 'quarto', pronto: true, figuras: figurasCache() }, location.origin);
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
    canalDaTv = null; telasDesligadas.delete('tv'); // as setas de cima são das transmissões: a TV vai a elas
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
      if (!AO_VIVO && n) canalDaTv = null;
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
if (PUBLICAR) {
  // o script vai para um arquivo com a impressão digital (é ele que muda a cada versão; o HTML fica pequeno)
  const i0 = html.indexOf('<script>\n'), i1 = html.lastIndexOf('</script>');
  if (i0 < 0 || i1 < i0) throw new Error('não achei o script da página');
  const js = html.slice(i0 + '<script>\n'.length, i1), nomeJs = 'cena-' + impressao(js) + '.js';
  fs.mkdirSync(PUBLICAR.imagens, { recursive: true });
  fs.writeFileSync(path.join(PUBLICAR.imagens, nomeJs), js);
  // A publicada só serve ao app: o modo app (e a classe do salão) já vêm no HTML, valendo antes do script chegar.
  const pagina = (html.slice(0, i0) + '<script src="' + PUBLICAR.url + nomeJs + '"></script>' + html.slice(i1 + '</script>'.length))
    .replace('<html lang="pt-BR">', '<html lang="pt-BR" class="app">')
    .replace('<body>', CENA === 'salao' ? '<body class="salao">' : '<body>');
  fs.mkdirSync(PUBLICAR.pagina, { recursive: true });
  fs.writeFileSync(path.join(PUBLICAR.pagina, 'index.html'), pagina);
  // O que o app baixa em segundo plano, com ele já aberto (web/src/cenaNova.ts): o script e o pacote, relativos à página.
  fs.writeFileSync(path.join(PUBLICAR.pagina, 'precarregar.json'), JSON.stringify([PUBLICAR.url + nomeJs, PACOTE.url]));
  console.log(CENA, 'publicado:', Math.round(pagina.length / 1024), 'KB de página +', Math.round(js.length / 1024), 'KB de script +', Math.round(PACOTE.bytes / 1024), 'KB de imagens num pacote (' + PACOTE_ITENS.size + ')');
} else {
  const SAIDA = CENA === 'salao' ? path.join(SALAO, 'salao.html') : path.join(AQUI, 'quarto.html');
  fs.writeFileSync(SAIDA, html);
  console.log(path.basename(SAIDA), Math.round(html.length / 1024), 'KB');
}
