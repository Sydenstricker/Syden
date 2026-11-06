import { fantasmaEm, passosEmMs, rivalEm } from '../jato/util';
import { tocar } from '../somDosJogos';
import { coresDoAvatar } from './barquinho';
import { AMOSTRA, amostrar, DERRAPA, normal, novoBarco, PASSO, passo, pilotoAutomatico, progresso, rapidez, VTURBO, type Barco, type ComandosDoBarco } from './fisica';
import { montarPistaDoBarco, naLinha, type DefinicaoDoBarco, type PistaDoBarco } from './pista';
import {
  argolasNaTela,
  barcoNaTela,
  cameraAtras,
  desenharChao,
  enfeitesNaTela,
  esteiraNaTela,
  FOCO,
  H,
  mapaDaPista,
  marcarEsteira,
  novaEsteira,
  painel,
  pontesNaTela,
  pontoNoMapa,
  prepararDesenho,
  respingo,
  semaforo,
  W,
  type Esteira,
  type Figura,
} from './render';

/**
 * O LAÇO DA REGATA DA TOCA (05/11/2026): o que o Solo (contra o relógio) e a sala têm em comum — a física em passos fixos, a
 * câmera, o desenho e o mapa pequeno. Como o laço do kart e do jato: com a janela sem foco, o barco PARA (a física e o relógio
 * também), e o tempo de cada um é contado nos passos dele, desde o verde dele.
 */

let pistaGuardada: PistaDoBarco | null = null;
/** A pista que vai rodar (~0,6 s de conta e ~60 MB): fica guardada SÓ A ÚLTIMA, como a do kart. */
export function pistaDoBarco(def: DefinicaoDoBarco): PistaDoBarco {
  if (pistaGuardada?.def.id !== def.id) pistaGuardada = montarPistaDoBarco(def);
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
  v?: number;
}

export interface RivalDoBarco {
  nome: string;
  avatar?: number | null;
  posicoes: PosicaoNaSala[];
}

export interface LinhaDaOrdem {
  id: number;
  nome: string;
  eu: boolean;
}

export interface OpcoesDoLaco {
  canvas: HTMLCanvasElement;
  comandos: ComandosDoBarco;
  pista: DefinicaoDoBarco;
  /** Sem barco (quem assiste): a câmera vai atrás de quem está na frente. */
  piloto: boolean;
  meuAvatar?: number | null;
  fantasmas?: { amostras: number[]; avatar: number | null }[];
  rivais?: Map<number, RivalDoBarco>;
  /** Passos de semáforo antes do verde (3 s = 180). */
  contagem: number;
  /** Menos movimento: sem o balanço das ondas e sem o tremor. */
  calmo?: boolean;
  aoPlacar: (p: { volta: number; ms: number; pausado: boolean }) => void;
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  aoPosicao?: (p: PosicaoNaSala) => void;
  /** 1,6 s depois da linha de chegada: as voltas (em passos), o caminho inteiro, e a minha posição entre as pessoas. */
  aoChegar?: (voltas: number[], caminho: number[], posicao: number, total: number) => void;
}

export function rodarBarco(o: OpcoesDoLaco): () => void {
  const { comandos } = o;
  let vivo = true;
  let quadro = 0;
  const p = pistaDoBarco(o.pista);
  const d = prepararDesenho(o.canvas, p);
  const mapa = mapaDaPista(p, 56);
  const barco: Barco = novoBarco(p);
  const caminho: number[] = [];
  const minhasCores = coresDoAvatar(o.meuAvatar);
  const minhaEsteira = novaEsteira();
  const esteiras = new Map<string, Esteira>();
  let camAngulo = barco.angulo;
  let foco = FOCO;
  let contagem = o.contagem;
  let acumulado = 0;
  let antes = performance.now();
  let fimEm = 0;
  let avisou = false;
  let tremor = 0;
  let batida = 0;
  let ladoDaBatida = 1;
  let pausado = false;
  let ordemAntes = '';
  let nAssistindo = 0;
  let minhaPosicao = 1;
  let total = 1;
  let ultimaLuz = -1;
  let derrapaAntes = false;

  const auto = () => import.meta.env.DEV && (window as { barcoPilotoAutomatico?: boolean }).barcoPilotoAutomatico === true;

  const seguir = (alvo: number, forca = 5) => {
    camAngulo += normal(alvo - camAngulo) * Math.min(1, forca * PASSO);
  };

  const andar = () => {
    if (contagem > 0) {
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
    const jaTinhaChegado = barco.terminou;
    const c = auto() ? pilotoAutomatico(barco, p) : comandos;
    passo(barco, c, p);
    if (barco.passos % 2 === 0) marcarEsteira(minhaEsteira, barco.x, barco.y, Math.atan2(barco.vy, barco.vx), rapidez(barco));
    if (!jaTinhaChegado) {
      amostrar(barco, caminho);
      if ((barco.passos - 1) % AMOSTRA === 0) {
        o.aoPosicao?.({ n: barco.passos, x: +barco.x.toFixed(1), y: +barco.y.toFixed(1), a: +barco.angulo.toFixed(3), andou: +progresso(barco, p).toFixed(3), b: +barco.banco.toFixed(2), v: Math.round(rapidez(barco)) });
      }
      if (barco.bateu) {
        tremor = 8;
        batida = 24;
        ladoDaBatida = Math.sign(naLinha(p, barco.x, barco.y, barco.indice).lado) || 1;
        tocar('agua');
      }
      if (barco.boia) tocar('pulo');
      const derrapa = Math.abs(barco.lateral) > DERRAPA && rapidez(barco) > 90;
      if (derrapa && !derrapaAntes) tocar('queda');
      derrapaAntes = derrapa;
      if (barco.fezVolta && !barco.terminou) tocar('acerto');
      if (barco.terminou) tocar('chegada');
    }
    // a câmera vai atrás do nariz, devagar (o barco aparece escorregando na curva)
    seguir(barco.angulo + normal(Math.atan2(barco.vy, barco.vx) - barco.angulo) * (rapidez(barco) > 30 ? 0.35 : 0));
  };

  const rivaisEm = (n: number) => {
    const lista: { id: number; nome: string; avatar: number | null; pos: PosicaoNaSala }[] = [];
    for (const [id, r] of o.rivais ?? []) {
      const pos = rivalEm(r.posicoes, n);
      if (pos) {
        const ultima = [...r.posicoes].reverse().find((q) => q.n <= n);
        lista.push({ id, nome: r.nome, avatar: r.avatar ?? null, pos: { ...pos, b: ultima?.b ?? 0, v: ultima?.v ?? 0 } });
      }
    }
    return lista;
  };

  /** A esteira de um rival ou fantasma, marcada no passo em que ele está (só quando ele andou). */
  const esteiraDe = (chave: string, x: number, y: number, a: number) => {
    let e = esteiras.get(chave);
    if (!e) esteiras.set(chave, (e = novaEsteira()));
    const ultimo = e.pontos.at(-1);
    const dist = ultimo ? Math.hypot(x - ultimo.x, y - ultimo.y) : 0;
    if (!ultimo || dist > 1.5) marcarEsteira(e, x, y, ultimo ? Math.atan2(y - ultimo.y, x - ultimo.x) : a, ultimo ? Math.min(220, dist * 30) : 0);
    return e;
  };

  const desenhar = (tempo: number) => {
    const n = o.piloto ? Math.max(0, barco.passos) : nAssistindo;
    const rivais = rivaisEm(n);
    let foco0 = { x: barco.x, y: barco.y };
    if (!o.piloto) {
      const lider = [...rivais].sort((a, b) => b.pos.andou - a.pos.andou)[0];
      if (lider) {
        foco0 = lider.pos;
        seguir(lider.pos.a, 8);
      } else foco0 = p.largada;
    }
    const v = rapidez(barco);
    const alvoFoco = FOCO - Math.max(0, v - 170) * 0.08;
    foco += (alvoFoco - foco) * 0.1;
    const cam = cameraAtras(foco0.x, foco0.y, camAngulo, o.piloto ? foco : FOCO);
    desenharChao(d, p, cam, o.calmo ? 0 : tempo);
    const figuras: Figura[] = [];
    enfeitesNaTela(d, p, cam, tempo, figuras);
    argolasNaTela(p, cam, tempo, figuras);
    pontesNaTela(p, cam, figuras);
    (o.fantasmas ?? []).forEach((fa, i) => {
      const g = fantasmaEm(fa.amostras, n);
      if (!g) return;
      esteiraNaTela(cam, esteiraDe(`f${i}`, g.x, g.y, g.angulo), figuras, 0.45);
      const f = barcoNaTela(cam, g.x, g.y, g.angulo, coresDoAvatar(fa.avatar), { fantasma: true, tempo, calmo: o.calmo });
      if (f) figuras.push(f);
    });
    for (const r of rivais) {
      esteiraNaTela(cam, esteiraDe(`r${r.id}`, r.pos.x, r.pos.y, r.pos.a), figuras);
      const f = barcoNaTela(cam, r.pos.x, r.pos.y, r.pos.a, coresDoAvatar(r.avatar), { nome: r.nome, banco: r.pos.b, v: r.pos.v, tempo, calmo: o.calmo });
      if (f) figuras.push(f);
    }
    if (o.piloto) {
      esteiraNaTela(cam, minhaEsteira, figuras);
      const derrapa = Math.abs(barco.lateral) > DERRAPA * 0.7 ? barco.lateral / (DERRAPA * 2) : 0;
      const meu = barcoNaTela(cam, barco.x, barco.y, barco.angulo, minhasCores, {
        banco: barco.banco,
        v,
        derrapa: -derrapa,
        tremor: !o.calmo && tremor > 0 ? (tremor % 2 ? 1 : -1) : 0,
        tempo,
        calmo: o.calmo,
      });
      if (meu) figuras.push({ ...meu, z: meu.z - 0.01 });
    }
    figuras.sort((a, b) => b.z - a.z);
    for (const f of figuras) f.desenhar(d.ctx);
    const ctx = d.ctx;
    if (o.piloto && batida > 0) respingo(ctx, ladoDaBatida, tempo, batida / 24);
    // o turbo: a borda da tela esquenta
    if (o.piloto && barco.turbo > 0 && !o.calmo) {
      ctx.fillStyle = '#ffb04a33';
      ctx.fillRect(0, 0, W, 3);
      ctx.fillRect(0, H - 3, W, 3);
      ctx.fillRect(0, 0, 3, H);
      ctx.fillRect(W - 3, 0, 3, H);
    }

    // A ORDEM das pessoas na sala, pelo quanto andaram (quem chegou, pela ordem de chegada)
    const chaves: { id: number; nome: string; eu: boolean; chave: number }[] = [];
    if (o.piloto) chaves.push({ id: -1, nome: '', eu: true, chave: barco.terminou ? 1000 - barco.voltas[barco.voltas.length - 1] / 1e5 : progresso(barco, p) });
    for (const r of rivais) chaves.push({ id: r.id, nome: r.nome, eu: false, chave: r.pos.andou });
    for (const [id, r] of o.rivais ?? []) if (!chaves.some((c) => c.id === id)) chaves.push({ id, nome: r.nome, eu: false, chave: -1 });
    chaves.sort((a, b) => b.chave - a.chave);
    minhaPosicao = Math.max(1, chaves.findIndex((c) => c.eu) + 1);
    total = chaves.length;
    if (o.aoOrdem) {
      const chave = chaves.map((c) => c.id).join(',');
      if (chave !== ordemAntes) {
        ordemAntes = chave;
        o.aoOrdem(chaves.map(({ id, nome, eu }) => ({ id, nome, eu })));
      }
    }

    // o mapa pequeno: os fantasmas em lilás, os rivais em azul, a pessoa em laranja
    ctx.globalAlpha = 0.85;
    ctx.drawImage(mapa, W - 60, H - 60);
    ctx.globalAlpha = 1;
    for (const fa of o.fantasmas ?? []) {
      const g = fantasmaEm(fa.amostras, n);
      if (g) pontoNoMapa(ctx, W - 60, H - 60, 56, g.x, g.y, '#d8b8ff');
    }
    for (const r of rivais) pontoNoMapa(ctx, W - 60, H - 60, 56, r.pos.x, r.pos.y, '#2a6ae0');
    if (o.piloto) pontoNoMapa(ctx, W - 60, H - 60, 56, barco.x, barco.y, '#ff8a2a');
    if (o.piloto) painel(ctx, { posicao: minhaPosicao, total, v, vmax: VTURBO * 0.8, turbo: barco.turbo });
    if (contagem > 0 || (o.piloto && barco.passos < 40)) semaforo(ctx, contagem);
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
        if (batida > 0) batida--;
      }
    }
    if (!o.piloto && o.rivais) {
      const ultimo = Math.max(0, ...[...o.rivais.values()].map((r) => r.posicoes.at(-1)?.n ?? 0));
      nAssistindo = Math.min(Math.max(nAssistindo, ultimo - 12), ultimo);
    }
    if (!document.hidden) desenhar(agora / 1000);
    const volta = Math.min(p.def.voltas, barco.volta + 1);
    const ms = passosEmMs(barco.terminou ? barco.voltas[barco.voltas.length - 1] : barco.passos);
    o.aoPlacar({ volta, ms, pausado: pausado && o.piloto });
    if (barco.terminou && !fimEm) fimEm = agora;
    if (fimEm && agora - fimEm > 1600 && !avisou) {
      avisou = true;
      o.aoChegar?.(barco.voltas.slice(), caminho, minhaPosicao, total);
    }
    quadro = requestAnimationFrame(ciclo);
  };
  quadro = requestAnimationFrame(ciclo);

  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
  };
}
