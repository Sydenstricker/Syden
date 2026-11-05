import { fantasmaEm, passosEmMs, rivalEm } from './util';
import { tocar } from '../somDosJogos';
import { AMOSTRA, amostrar, normal, novaNave, PASSO, passo, pilotoAutomatico, progresso, turboLiberado, VTURBO, type ComandosDoJato, type Nave } from './fisica';
import { coresDoAvatar, coresDoRobo, type CoresDaNave } from './nave';
import { montarPistaDoJato, naLinha, type DefinicaoDoJato, type PistaDoJato } from './pista';
import {
  cameraAtras,
  desenharChao,
  faiscas,
  FOCO,
  H,
  mapaDaPista,
  naveNaTela,
  painel,
  pontoNoMapa,
  postesNaTela,
  prepararDesenho,
  riscosDeVento,
  semaforo,
  W,
  type Figura,
} from './render';
import { criarRobos, roboEm, type Robo } from './robos';

/**
 * O LAÇO DOS COELHOS A JATO (05/11/2026): o que o Solo (contra o relógio) e a sala têm em comum — a física em passos fixos, a
 * câmera, o desenho, as naves do computador e o mapa pequeno. Como o laço do kart (corrida/laco.ts): com a janela sem foco, a
 * nave PARA (a física e o relógio também), e o tempo de cada um é contado nos passos dele, desde o verde dele.
 */

let pistaGuardada: PistaDoJato | null = null;
/** A pista que vai rodar (~250 ms de conta e ~40 MB): fica guardada SÓ A ÚLTIMA, como a do kart. */
export function pistaDoJato(def: DefinicaoDoJato): PistaDoJato {
  if (pistaGuardada?.def.id !== def.id) pistaGuardada = montarPistaDoJato(def);
  return pistaGuardada;
}

/** Uma posição de um rival da sala, como chegou pelo socket: o passo da corrida DELE em que ele estava ali. */
export interface PosicaoNaSala {
  n: number;
  x: number;
  y: number;
  a: number;
  andou: number;
  b?: number;
  t?: boolean;
}

export interface RivalDoJato {
  nome: string;
  avatar?: number | null;
  posicoes: PosicaoNaSala[];
  /** Explodiu (o servidor disse): some da pista. */
  fora?: boolean;
}

export interface LinhaDaOrdem {
  id: number;
  nome: string;
  eu: boolean;
}

export interface OpcoesDoLaco {
  canvas: HTMLCanvasElement;
  comandos: ComandosDoJato;
  pista: DefinicaoDoJato;
  /** Sem nave (quem assiste): a câmera vai atrás de quem está na frente. */
  piloto: boolean;
  meuAvatar?: number | null;
  fantasmas?: { amostras: number[]; avatar: number | null }[];
  rivais?: Map<number, RivalDoJato>;
  /** Quantas naves do computador na pista. */
  robos: number;
  /** Passos de semáforo antes do verde (3 s = 180). */
  contagem: number;
  /** Menos movimento: sem os riscos de vento e sem o tremor. */
  calmo?: boolean;
  aoPlacar: (p: { volta: number; ms: number; pausado: boolean }) => void;
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  aoPosicao?: (p: PosicaoNaSala) => void;
  /** 1,6 s depois da linha de chegada: as voltas (em passos), o caminho inteiro, e a minha posição entre todas as naves. */
  aoChegar?: (voltas: number[], caminho: number[], posicao: number, total: number) => void;
  /** A energia acabou: a nave explodiu (1,2 s depois, para a explosão se ver). */
  aoExplodir?: (posicao: number, total: number) => void;
}

export function rodarJato(o: OpcoesDoLaco): () => void {
  const { comandos } = o;
  let vivo = true;
  let quadro = 0;
  const d = prepararDesenho(o.canvas, o.pista.tema);
  const p = pistaDoJato(o.pista);
  const mapa = mapaDaPista(p, 56);
  const nave: Nave = novaNave(p);
  const caminho: number[] = [];
  const robos: Robo[] = criarRobos(p, o.robos);
  const minhasCores = coresDoAvatar(o.meuAvatar);
  const coresDosRobos: CoresDaNave[] = robos.map((r) => coresDoRobo(r.i));
  let camAngulo = nave.angulo;
  let foco = FOCO;
  let contagem = o.contagem;
  let acumulado = 0;
  let antes = performance.now();
  let fimEm = 0;
  let explodiuEm = 0;
  let avisou = false;
  let tremor = 0;
  let faisca = 0;
  let ladoDaFaisca = 1;
  let pausado = false;
  let ordemAntes = '';
  let nAssistindo = 0;
  let minhaPosicao = 1;
  let totalDeNaves = 1;
  let recargaAntes = false;
  let ultimaLuz = -1;

  const auto = () => import.meta.env.DEV && (window as { jatoPilotoAutomatico?: boolean }).jatoPilotoAutomatico === true;

  const seguir = (alvo: number) => {
    let dif = alvo - camAngulo;
    while (dif > Math.PI) dif -= 2 * Math.PI;
    while (dif < -Math.PI) dif += 2 * Math.PI;
    camAngulo += dif * Math.min(1, 8 * PASSO);
  };

  const andar = () => {
    if (contagem > 0) {
      // o bipe de cada luz do semáforo, e o do verde
      const luz = Math.floor((contagem - 1) / 60);
      if (luz !== ultimaLuz && o.piloto) {
        ultimaLuz = luz;
        tocar('vez');
      }
      contagem--;
      if (contagem === 0 && o.piloto) tocar('mola');
      return;
    }
    if (!o.piloto) return;
    const jaTinhaChegado = nave.terminou || nave.explodiu;
    const c = auto() ? pilotoAutomatico(nave, p) : comandos;
    passo(nave, c, p);
    if (!jaTinhaChegado) {
      amostrar(nave, caminho);
      if ((nave.passos - 1) % AMOSTRA === 0) {
        o.aoPosicao?.({ n: nave.passos, x: +nave.x.toFixed(1), y: +nave.y.toFixed(1), a: +nave.angulo.toFixed(3), andou: +progresso(nave, p).toFixed(3), b: +nave.banco.toFixed(2), t: nave.turbo > 0 });
      }
      if (nave.bateu) {
        tremor = 8;
        faisca = 10;
        ladoDaFaisca = Math.sign(naLinha(p, nave.x, nave.y, nave.indice).lado) || 1;
        tocar('soco');
      }
      if (nave.usouTurbo) tocar('mola');
      if (nave.placa) tocar('pulo');
      if (nave.caindo > 0 && nave.queda === 0) tocar('queda');
      if (nave.recarga && !recargaAntes) tocar('moeda');
      recargaAntes = nave.recarga;
      if (nave.fezVolta && !nave.terminou) tocar('acerto');
      if (nave.terminou) tocar('chegada');
      if (nave.explodiu) tocar('erro');
    }
    // a câmera vai atrás do rumo, puxada um pouco para o nariz (a nave aparece escorregando na curva)
    if (nave.resgate === 0 && nave.caindo === 0) seguir(nave.rumo + normal(nave.angulo - nave.rumo) * 0.4);
    else if (nave.resgate > 0) seguir(nave.angulo);
  };

  /** Os rivais da sala no passo `n`. */
  const rivaisEm = (n: number) => {
    const lista: { id: number; nome: string; avatar: number | null; pos: PosicaoNaSala }[] = [];
    for (const [id, r] of o.rivais ?? []) {
      if (r.fora) continue;
      const pos = rivalEm(r.posicoes, n);
      if (pos) {
        // a inclinação e o turbo são os da última posição que chegou antes deste passo
        const ultima = [...r.posicoes].reverse().find((q) => q.n <= n);
        lista.push({ id, nome: r.nome, avatar: r.avatar ?? null, pos: { ...pos, b: ultima?.b ?? 0, t: ultima?.t ?? false } });
      }
    }
    return lista;
  };

  const desenhar = (tempo: number) => {
    const n = o.piloto ? Math.max(0, nave.passos) : nAssistindo;
    const rivais = rivaisEm(n);
    let foco0 = { x: nave.x, y: nave.y };
    if (!o.piloto) {
      const lider = [...rivais].sort((a, b) => b.pos.andou - a.pos.andou)[0];
      if (lider) {
        foco0 = lider.pos;
        seguir(lider.pos.a);
      } else foco0 = p.largada;
    }
    // A LENTE: abre com a velocidade e mais no turbo (o mundo "estica" para os lados)
    const alvoFoco = FOCO - Math.max(0, nave.v - 200) * 0.09 - (nave.turbo > 0 ? 14 : 0);
    foco += (alvoFoco - foco) * 0.12;
    const cam = cameraAtras(foco0.x, foco0.y, camAngulo, o.piloto ? foco : FOCO);
    desenharChao(d, p, cam);
    const figuras: Figura[] = [];
    postesNaTela(d, p, cam, figuras);
    // as naves do computador
    robos.forEach((r, i) => {
      const q = roboEm(p, r, n);
      const f = naveNaTela(d, p, cam, q.x, q.y, q.angulo, coresDosRobos[i], { banco: q.banco, tempo: tempo + i, turbo: false });
      if (f) figuras.push(f);
    });
    for (const fa of o.fantasmas ?? []) {
      const g = fantasmaEm(fa.amostras, n);
      if (!g) continue;
      const f = naveNaTela(d, p, cam, g.x, g.y, g.angulo, coresDoAvatar(fa.avatar), { fantasma: true, tempo });
      if (f) figuras.push(f);
    }
    for (const r of rivais) {
      const f = naveNaTela(d, p, cam, r.pos.x, r.pos.y, r.pos.a, coresDoAvatar(r.avatar), { nome: r.nome, banco: r.pos.b, turbo: r.pos.t, tempo });
      if (f) figuras.push(f);
    }
    if (o.piloto && !(nave.explodiu && tempo - explodiuEm / 1000 > 0.25)) {
      const minha = naveNaTela(d, p, cam, nave.x, nave.y, nave.angulo, minhasCores, {
        banco: nave.banco,
        queda: nave.queda,
        turbo: nave.turbo > 0,
        tremor: !o.calmo && tremor > 0 ? (tremor % 2 ? 1 : -1) : 0,
        tempo,
      });
      if (minha) figuras.push({ ...minha, z: minha.z - 0.01 });
    }
    figuras.sort((a, b) => b.z - a.z);
    for (const f of figuras) f.desenhar(d.ctx);
    const ctx = d.ctx;
    if (o.piloto && !o.calmo && contagem === 0) riscosDeVento(ctx, nave.v, nave.turbo > 0, tempo);
    if (o.piloto && faisca > 0) faiscas(ctx, ladoDaFaisca, tempo);
    // a explosão: o clarão e os pedaços
    if (o.piloto && nave.explodiu) explosao(ctx, tempo - explodiuEm / 1000);
    // o turbo: a borda da tela esquenta
    if (o.piloto && nave.turbo > 0 && !o.calmo) {
      ctx.fillStyle = '#ffb04a33';
      ctx.fillRect(0, 0, W, 3);
      ctx.fillRect(0, H - 3, W, 3);
      ctx.fillRect(0, 0, 3, H);
      ctx.fillRect(W - 3, 0, 3, H);
    }

    // A ORDEM: eu, os rivais e os robôs, pelo quanto andaram (quem chegou, pela ordem de chegada)
    const robosAgora = robos.map((r) => ({ chegou: n >= r.chegada, chegada: r.chegada, andou: roboEm(p, r, n).andou }));
    const minhaChave = nave.terminou ? 1000 - nave.voltas[nave.voltas.length - 1] / 1e5 : progresso(nave, p);
    const chaves: { id: number; nome: string; eu: boolean; chave: number }[] = [];
    if (o.piloto) chaves.push({ id: -1, nome: '', eu: true, chave: minhaChave });
    for (const r of rivais) chaves.push({ id: r.id, nome: r.nome, eu: false, chave: r.pos.andou });
    for (const [id, r] of o.rivais ?? []) if (!chaves.some((c) => c.id === id)) chaves.push({ id, nome: r.nome, eu: false, chave: r.fora ? -5 : -1 });
    robosAgora.forEach((r, i) => chaves.push({ id: -100 - i, nome: '', eu: false, chave: r.chegou ? 1000 - r.chegada / 1e5 : r.andou }));
    chaves.sort((a, b) => b.chave - a.chave);
    minhaPosicao = Math.max(1, chaves.findIndex((c) => c.eu) + 1);
    totalDeNaves = chaves.length;
    if (o.aoOrdem) {
      const pessoas = chaves.filter((c) => c.id >= -1);
      const chave = pessoas.map((c) => c.id).join(',');
      if (chave !== ordemAntes) {
        ordemAntes = chave;
        o.aoOrdem(pessoas.map(({ id, nome, eu }) => ({ id, nome, eu })));
      }
    }

    // o mapa pequeno: os robôs em cinza, os fantasmas em lilás, os rivais em azul, a pessoa em laranja
    ctx.globalAlpha = 0.85;
    ctx.drawImage(mapa, W - 60, H - 60);
    ctx.globalAlpha = 1;
    for (let i = 0; i < robos.length; i++) {
      const q = roboEm(p, robos[i], n);
      pontoNoMapa(ctx, W - 60, H - 60, 56, q.x, q.y, '#a8a0b8', 2);
    }
    for (const fa of o.fantasmas ?? []) {
      const g = fantasmaEm(fa.amostras, n);
      if (g) pontoNoMapa(ctx, W - 60, H - 60, 56, g.x, g.y, '#d8b8ff');
    }
    for (const r of rivais) pontoNoMapa(ctx, W - 60, H - 60, 56, r.pos.x, r.pos.y, '#7ab8ff');
    if (o.piloto) pontoNoMapa(ctx, W - 60, H - 60, 56, nave.x, nave.y, '#ffa24a');
    if (o.piloto) {
      painel(ctx, {
        energia: nave.energia,
        turboPronto: turboLiberado(nave),
        turboVisto: nave.volta >= 1,
        posicao: minhaPosicao,
        total: totalDeNaves,
        v: nave.v,
        vmax: VTURBO,
        tempo,
        recarga: nave.recarga,
      });
    }
    if (contagem > 0 || (o.piloto && nave.passos < 40)) semaforo(ctx, contagem);
    if (pausado && o.piloto) {
      ctx.fillStyle = '#100a188c';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f4ecff';
      ctx.fillRect(W / 2 - 12, H / 2 - 14, 8, 28);
      ctx.fillRect(W / 2 + 4, H / 2 - 14, 8, 28);
    }
  };

  const ciclo = (agora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.1, (agora - antes) / 1000);
    antes = agora;
    pausado = document.hidden || !document.hasFocus();
    // o piloto automático dos testes roda também sem foco (o navegador sem janela dos testes não tem foco)
    if (auto()) pausado = document.hidden;
    if (!pausado || !o.piloto) {
      acumulado += dt;
      while (acumulado >= PASSO) {
        andar();
        if (!o.piloto && contagem === 0) nAssistindo++;
        acumulado -= PASSO;
        if (tremor > 0) tremor--;
        if (faisca > 0) faisca--;
      }
    }
    if (!o.piloto && o.rivais) {
      const ultimo = Math.max(0, ...[...o.rivais.values()].map((r) => r.posicoes.at(-1)?.n ?? 0));
      nAssistindo = Math.min(Math.max(nAssistindo, ultimo - 12), ultimo);
    }
    if (!document.hidden) desenhar(agora / 1000);
    const volta = Math.min(p.def.voltas, nave.volta + 1);
    const ms = passosEmMs(nave.terminou ? nave.voltas[nave.voltas.length - 1] : nave.passos);
    o.aoPlacar({ volta, ms, pausado: pausado && o.piloto });
    if (nave.terminou && !fimEm) fimEm = agora;
    if (nave.explodiu && !explodiuEm) explodiuEm = agora;
    if (fimEm && agora - fimEm > 1600 && !avisou) {
      avisou = true;
      o.aoChegar?.(nave.voltas.slice(), caminho, minhaPosicao, totalDeNaves);
    }
    if (explodiuEm && agora - explodiuEm > 1200 && !avisou) {
      avisou = true;
      o.aoExplodir?.(minhaPosicao, totalDeNaves);
    }
    quadro = requestAnimationFrame(ciclo);
  };
  quadro = requestAnimationFrame(ciclo);

  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
  };
}

/** A explosão da nave sem energia: o clarão que se abre e os pedaços que voam. */
function explosao(ctx: CanvasRenderingContext2D, t: number) {
  if (t < 0 || t > 1.2) return;
  const cx = W / 2, cy = 140;
  const r = 6 + t * 60;
  ctx.globalAlpha = Math.max(0, 1 - t / 1.2);
  ctx.fillStyle = '#fff4c0';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9a3a';
  for (let i = 0; i < 14; i++) {
    const a = i * 0.45;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.6), 3, 3);
  }
  ctx.globalAlpha = 1;
}
