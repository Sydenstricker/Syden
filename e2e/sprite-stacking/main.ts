// A página de comparação: a corrida de verdade (a pista, a física e o piloto automático de web/src/corrida), desenhada duas
// vezes no mesmo quadro: com as figuras de hoje e com as fatias. E a vitrine: um objeto só, com a câmera dando a volta nele.
import { ATRAS, W, H, desenharChao, figuraNoChao, kartNaTela, prepararDesenho, type Camera, type Desenho, type Figura } from '../../web/src/corrida/render';
import { montarPista, pistaPorId, type Pista } from '../../web/src/corrida/pista';
import { novoKart, passo, pilotoAutomatico, type Kart } from '../../web/src/corrida/fisica';
import { cubo, pilhaNoChao, pilhaAssada, tornear, contagem, cacheInfo, type Pilha } from './fatias';
import { ajustarCaixa, caixaNoChao } from '../../web/src/corrida/caixaEmFatias';
import coelhoUrl from '../../web/public/corrida/coelho-kart.png';

const TORNEADAS = ['arvore', 'laranjeira', 'pinheiro', 'pinheiro-neve', 'cenoura', 'flor'];
type Modo = 'atual' | 'fatias';

const $ = (id: string) => document.getElementById(id)!;
const coelho = new Image();
coelho.src = coelhoUrl;

let pista: Pista, kart: Kart, camAng = 0;
let telas: Record<Modo, Desenho>, vitrine: Record<Modo, Desenho>;
let pilhas: Record<string, Pilha> = {};
let caixas: { x: number; y: number; giro: number }[] = [];
let rodando = true, velocidade = 1, contorno = true, assadas = true, resto = false;

function pontoNaLinha(p: Pista, s: number) {
  const n = p.lx.length;
  const sv = ((s % p.comprimento) + p.comprimento) % p.comprimento;
  let i = 0;
  while (i < n - 1 && p.la[i + 1] <= sv) i++;
  const j = (i + 1) % n, dx = p.lx[j] - p.lx[i], dy = p.ly[j] - p.ly[i], l = Math.hypot(dx, dy) || 1;
  return { x: p.lx[i], y: p.ly[i], dx: dx / l, dy: dy / l };
}

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * Math.PI * 2;
};

function carregar(id: string) {
  pista = montarPista(pistaPorId(id));
  kart = novoKart(pista);
  camAng = kart.angulo;
  const tema = pista.def.tema;
  telas = { atual: prepararDesenho($('atual') as HTMLCanvasElement, tema), fatias: prepararDesenho($('fatias') as HTMLCanvasElement, tema) };
  vitrine = { atual: prepararDesenho($('v-atual') as HTMLCanvasElement, tema), fatias: prepararDesenho($('v-fatias') as HTMLCanvasElement, tema) };
  for (const d of [...Object.values(telas), ...Object.values(vitrine)]) d.coelho = coelho;
  const f = telas.atual.figuras;
  pilhas = {};
  for (const t of TORNEADAS) pilhas[t] = tornear(f[t]);
  pilhas.caixa = cubo(f.caixa);
  caixas = pista.def.caixas.flatMap((fr) => {
    const q = pontoNaLinha(pista, fr * pista.comprimento);
    return [-18, -6, 6, 18].map((lado) => ({ x: q.x - q.dy * lado, y: q.y + q.dx * lado, giro: Math.atan2(q.dy, q.dx) }));
  });
  // na vitrine, um exemplar de cada: a árvore da pista e uma cenoura de verdade, e uma caixa da fileira
  const arv = pista.objetos.find((o) => o.raio > 0)!;
  const cen = pista.objetos.find((o) => o.tipo === 'cenoura') ?? arv;
  alvos = { arvore: { ...arv, tipo: arv.tipo, tam: 2.6 }, cenoura: { x: cen.x, y: cen.y, tipo: 'cenoura', tam: 1 }, caixa: { ...caixas[1], tipo: 'caixa', tam: 1.1 } };
}
let alvos: Record<string, { x: number; y: number; tipo: string; tam: number; giro?: number }> = {};

/** Uma figura: a de hoje, ou a pilha quando a peça tem fatias. */
function peca(d: Desenho, cam: Camera, modo: Modo, tipo: string, x: number, y: number, tam: number, giro: number): Figura | null {
  // a caixa em fatias é a do JOGO (web/src/corrida/caixaEmFatias.ts), com o tamanho e o miolo da página
  if (modo === 'fatias' && tipo === 'caixa') return caixaNoChao(d, cam, x, y, tam, giro);
  if (modo === 'fatias' && resto && pilhas[tipo]) return assadas ? pilhaAssada(cam, pilhas[tipo], tipo, x, y, tam, giro, ATRAS, contorno) : pilhaNoChao(cam, pilhas[tipo], x, y, tam, giro, ATRAS, contorno);
  return figuraNoChao(d, cam, tipo, x, y, tam);
}

const medidas: Record<Modo, { ms: number; chamadas: number; total: number }> = { atual: { ms: 0, chamadas: 0, total: 0 }, fatias: { ms: 0, chamadas: 0, total: 0 } };

function quadro(d: Desenho, cam: Camera, modo: Modo) {
  const tq = performance.now();
  desenharChao(d, pista, cam);
  const t0 = performance.now();
  contagem.chamadas = 0;
  const montando0 = cacheInfo.msMontando;
  const figuras: Figura[] = [];
  for (const ob of pista.objetos) {
    const tam = ob.raio > 0 ? 2.6 : ob.tipo === 'cenoura' ? 1 : 0.8;
    const f = peca(d, cam, modo, ob.tipo, ob.x, ob.y, tam, ob.raio > 0 ? 0 : hash(ob.x, ob.y));
    if (f) figuras.push(f);
  }
  for (const c of caixas) {
    const f = peca(d, cam, modo, 'caixa', c.x, c.y, 1.1, c.giro);
    if (f) figuras.push(f);
  }
  const k = kartNaTela(d, cam, kart.x, kart.y, kart.angulo, kart.pulo);
  if (k) figuras.push({ ...k, z: k.z - 0.01 });
  figuras.sort((a, b) => b.z - a.z);
  for (const f of figuras) f.desenhar(d.ctx);
  const m = medidas[modo];
  m.ms = m.ms * 0.95 + (performance.now() - t0 - (modo === 'fatias' ? cacheInfo.msMontando - montando0 : 0)) * 0.05;
  m.total = m.total * 0.95 + (performance.now() - tq) * 0.05;
  m.chamadas = modo === 'fatias' ? contagem.chamadas : figuras.length;
}

let ang = 0;
function vitrineQuadro() {
  const alvo = alvos[($('objeto') as HTMLSelectElement).value];
  const dist = Number(($('dist') as HTMLInputElement).value);
  if (rodando) ang += 0.008 * velocidade;
  const cam: Camera = { x: alvo.x - Math.cos(ang) * dist, y: alvo.y - Math.sin(ang) * dist, angulo: ang };
  for (const modo of ['atual', 'fatias'] as Modo[]) {
    const d = vitrine[modo];
    desenharChao(d, pista, cam);
    const f = peca(d, cam, modo, alvo.tipo, alvo.x, alvo.y, alvo.tam, alvo.giro ?? 0);
    f?.desenhar(d.ctx);
  }
}

let acumulado = 0, antes = performance.now(), ultimoTexto = 0;
function laco(agora: number) {
  const dt = Math.min(0.1, (agora - antes) / 1000);
  antes = agora;
  if (rodando) {
    acumulado += dt * velocidade;
    while (acumulado >= 1 / 60) {
      passo(kart, pilotoAutomatico(kart, pista, true), pista);
      let dif = kart.angulo - camAng;
      while (dif > Math.PI) dif -= 2 * Math.PI;
      while (dif < -Math.PI) dif += 2 * Math.PI;
      camAng += dif * 0.12;
      acumulado -= 1 / 60;
    }
  }
  const cam: Camera = { x: kart.x - Math.cos(camAng) * ATRAS, y: kart.y - Math.sin(camAng) * ATRAS, angulo: camAng };
  quadro(telas.atual, cam, 'atual');
  quadro(telas.fatias, cam, 'fatias');
  vitrineQuadro();
  if (agora - ultimoTexto > 400) {
    ultimoTexto = agora;
    $('ms-atual').textContent = `quadro ${medidas.atual.total.toFixed(1)} ms · peças ${medidas.atual.ms.toFixed(2)} ms`;
    $('ms-fatias').textContent = `quadro ${medidas.fatias.total.toFixed(1)} ms · peças ${medidas.fatias.ms.toFixed(2)} ms`;
  }
  requestAnimationFrame(laco);
}

function iniciar() {
  carregar('horta-1');
  ($('pista') as HTMLSelectElement).onchange = (e) => carregar((e.target as HTMLSelectElement).value);
  $('pausa').onclick = () => {
    rodando = !rodando;
    $('pausa').textContent = rodando ? 'Pausar' : 'Continuar';
    $('pausa').setAttribute('aria-pressed', String(!rodando));
  };
  ($('vel') as HTMLSelectElement).onchange = (e) => (velocidade = Number((e.target as HTMLSelectElement).value));
  ($('contorno') as HTMLInputElement).onchange = (e) => (contorno = (e.target as HTMLInputElement).checked);
  ($('assadas') as HTMLSelectElement).onchange = (e) => { assadas = (e.target as HTMLSelectElement).value === 'sim'; medidas.fatias.ms = 0; };
  const escala = $('escala') as HTMLInputElement;
  const longe = $('longe') as HTMLInputElement;
  const res = $('res') as HTMLSelectElement;
  res.value = String((globalThis as { __RES?: number }).__RES ?? 1);
  res.onchange = () => { location.hash = 'res-' + res.value; location.reload(); };
  const aplicar = () => {
    ajustarCaixa({ escala: Number(escala.value), miolo: ($('miolo') as HTMLInputElement).checked, tampoLiso: ($('tampo') as HTMLInputElement).checked, longe: Number(longe.value) });
    $('longe-valor').textContent = Number(longe.value) ? '+' + Math.round(Number(longe.value) * 100) + '%' : 'nenhum';
    $('escala-valor').textContent = '×' + Number(escala.value).toFixed(2).replace('.', ',');
  };
  escala.oninput = aplicar;
  longe.oninput = aplicar;
  ($('miolo') as HTMLInputElement).onchange = aplicar;
  ($('tampo') as HTMLInputElement).onchange = aplicar;
  aplicar();
  ($('resto') as HTMLInputElement).onchange = (e) => (resto = (e.target as HTMLInputElement).checked);
  $('parar').onclick = () => {
    // o kart a 34 de distância da primeira fileira, olhando a pista, e a corrida parada
    const q = pontoNaLinha(pista, pista.def.caixas[0] * pista.comprimento - 34);
    kart.x = q.x; kart.y = q.y; kart.angulo = Math.atan2(q.dy, q.dx); kart.rumo = kart.angulo; kart.v = 0;
    let melhor = 0;
    for (let i = 0; i < pista.lx.length; i++) if (Math.hypot(pista.lx[i] - q.x, pista.ly[i] - q.y) < Math.hypot(pista.lx[melhor] - q.x, pista.ly[melhor] - q.y)) melhor = i;
    kart.indice = melhor;
    camAng = kart.angulo;
    rodando = false;
    $('pausa').textContent = 'Continuar';
  };
  void W, H;
  requestAnimationFrame(laco);
}
coelho.complete ? iniciar() : (coelho.onload = iniciar);
