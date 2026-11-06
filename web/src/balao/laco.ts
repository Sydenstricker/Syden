import { PASSO, type Comandos } from '../corrida/fisica';
import type { Rival } from '../corrida/laco';
import { cameraAtras, desenharChao, faiscas, figuraNoChao, H, kartNaTela, prepararDesenho, W, type Desenho, type Figura } from '../corrida/render';
import { arenaPintada, largadaDa, temaDaArena } from './arena';
import { criarPartida, type EventoDoBalao, type Participante, type ResultadoDoSolo } from './partida';
import {
  baloesNaTela,
  corDoBalao,
  estouroNaTela,
  figurasDaArena,
  mapaDaArena,
  meusBaloes,
  pontoNoMapaDaArena,
  quadroDoItem,
  retrovisor,
  semaforo,
} from './render';
import { BALOES, DURACAO_PASSOS, INVULNERAVEL, PASSOS_POR_SEGUNDO, repolhoNoPasso, VIDA_DA_LAMA, type ItemDoBalao } from './sim';

export { TIPOS_DO_BALAO, type EventoDoBalao, type Participante } from './partida';

/**
 * O LAÇO DO ESTOURA-BALÃO (05/11/2026): o relógio e o desenho. A partida em si (os karts, as caixas, os itens, os estouros)
 * mora em partida.ts, sem tela; a câmera, o chão e o coelho no kart são os da corrida (corrida/render.ts).
 *
 * O RELÓGIO É UM SÓ: o passo é contado desde o sinal verde, pelo relógio do computador (o servidor diz quando foi). Na sala,
 * a janela sem foco NÃO pausa (a turma não espera): o volante se solta, o kart para, nada se desenha, e ao voltar o laço
 * anda os passos que faltam. No Solo, contra o computador, a janela sem foco pausa tudo.
 */

export interface OpcoesDoBalao {
  canvas: HTMLCanvasElement;
  comandos: Comandos;
  arena: string;
  eu: number;
  piloto: boolean;
  participantes: Participante[];
  robos?: number[];
  semente: number;
  /** O performance.now() do sinal verde (no futuro, durante a contagem). */
  verdeEm: number;
  baloes: Map<number, number>;
  rivais: Map<number, Rival>;
  eventos: EventoDoBalao[];
  enviar?: (dados: Record<string, unknown>) => void;
  /** O Solo pausa com a janela sem foco; a sala não. */
  pausaSemFoco: boolean;
  /** A pausa do ESC (pausaDosJogos.tsx), só no Solo: lida a cada quadro, como a janela sem foco. */
  pausa?: { readonly ativa: boolean };
  aoItem?: (item: ItemDoBalao | null) => void;
  /** A cada quadro: o tempo que falta (ms) e se está pausado. */
  aoPlacar?: (p: { restanteMs: number; pausado: boolean }) => void;
  aoBaloes?: (b: Map<number, number>) => void;
  aoFim?: (r: ResultadoDoSolo) => void;
}

let coelhoPronto: HTMLImageElement | null = null;
async function coelho(): Promise<HTMLImageElement> {
  if (!coelhoPronto) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}corrida/coelho-kart.png`;
    await img.decode().catch(() => undefined);
    coelhoPronto = img;
  }
  return coelhoPronto;
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o meu kart anda sozinho, com o cérebro dos robôs. */
    balaoPilotoAutomatico?: boolean;
  }
}

export function rodarBalao(o: OpcoesDoBalao): () => void {
  const { comandos } = o;
  let vivo = true;
  let quadro = 0;
  let pararExtra = () => {};
  const d: Desenho = prepararDesenho(o.canvas, temaDaArena(o.arena));
  figurasDaArena(d);

  void (async () => {
    d.coelho = await coelho();
    if (!vivo) return;
    const p = arenaPintada(o.arena);
    const arena = p.arena;
    const mapa = mapaDaArena(arena, 56);
    const porId = new Map(o.participantes.map((q) => [q.id, q]));
    let tremor = 0;
    const estouros: { alvo: number; x: number; y: number; em: number }[] = [];
    const partida = criarPartida({
      arena: p,
      comandos,
      eu: o.eu,
      piloto: o.piloto,
      autopiloto: () => import.meta.env.DEV && window.balaoPilotoAutomatico === true,
      participantes: o.participantes,
      robos: o.robos,
      semente: o.semente,
      baloes: o.baloes,
      rivais: o.rivais,
      eventos: o.eventos,
      enviar: o.enviar,
      aoItem: o.aoItem,
      aoBaloes: o.aoBaloes,
      aoTremor: (q) => (tremor = Math.max(tremor, q)),
      aoEstouro: (alvo, x, y) => estouros.push({ alvo, x, y, em: performance.now() }),
      aoFim: o.aoFim && ((r) => setTimeout(() => vivo && o.aoFim?.(r), 1200)),
    });
    const meu = partida.meu;
    const { temBalao, baloesDe, posicaoDe } = partida;

    let camAngulo = meu ? meu.kart.angulo : largadaDa(arena, 0).angulo;
    let antes = performance.now();
    let pausado = false;
    /** Quem assiste (eu sem kart, ou já sem balão): de quem é a câmera. */
    let assistindo: number | null = null;

    const seguir = (alvo: number, fator = 7 * PASSO) => {
      let dif = alvo - camAngulo;
      while (dif > Math.PI) dif -= 2 * Math.PI;
      while (dif < -Math.PI) dif += 2 * Math.PI;
      camAngulo += dif * Math.min(1, fator);
    };

    const umPasso = () => {
      partida.passo();
      if (meu && temBalao(meu.id)) seguir(meu.kart.rumo + (meu.kart.angulo - meu.kart.rumo) * 0.35);
      if (tremor > 0) tremor--;
    };

    const desenhar = () => {
      const n = partida.n;
      const tempo = performance.now() / 1000;
      const euJogo = !!meu && temBalao(meu.id);
      // quem assiste vê os outros um pouco atrás (o que já chegou), sem adivinhar
      const nVer = euJogo ? n : Math.max(0, n - 6);
      // A CÂMERA: atrás de mim; sem kart ou sem balão, atrás de quem eu escolhi (ou do primeiro com balão)
      let foco: { x: number; y: number; a: number } | null = null;
      if (euJogo) foco = { x: meu!.kart.x, y: meu!.kart.y, a: meu!.kart.angulo };
      else {
        const vivos = o.participantes.filter((q) => q.id !== o.eu && temBalao(q.id));
        if (assistindo === null || !vivos.some((q) => q.id === assistindo)) assistindo = vivos[0]?.id ?? null;
        foco = assistindo !== null ? posicaoDe(assistindo, nVer) : null;
        if (foco) seguir(foco.a, 0.12);
        else if (meu) foco = { x: meu.kart.x, y: meu.kart.y, a: meu.kart.angulo };
      }
      if (!foco) {
        const l = largadaDa(arena, 0);
        foco = { x: l.x, y: l.y, a: l.angulo };
      }
      // OLHAR PARA TRÁS (Q segurado): a câmera vai à frente do kart e olha para trás; só o desenho
      const olhando = euJogo && comandos.olha === true && n > 0;
      const cam = cameraAtras(foco.x, foco.y, camAngulo + (olhando ? Math.PI : 0));
      desenharChao(d, p, cam);

      const figuras: Figura[] = [];
      for (const e of p.enfeites) {
        const f = figuraNoChao(d, cam, e.figura, e.x, e.y, e.tamanho);
        if (f) figuras.push(f);
      }
      // as caixas: as que estão lá para mim (quem assiste vê todas)
      for (let i = 0; i < arena.caixas.length; i++) {
        if (euJogo && meu!.caixaVolta[i] > n) continue;
        const f = figuraNoChao(d, cam, 'caixa', arena.caixas[i][0], arena.caixas[i][1], 1.1 + 0.06 * Math.sin(tempo * 3.8));
        if (f) figuras.push(f);
      }
      // os itens no chão e rolando
      for (const e of o.eventos) {
        if ((e.tipo !== 'repolho' && e.tipo !== 'lama') || partida.gastos.has(e.id)) continue;
        let pos: [number, number] | null = null;
        if (e.tipo === 'repolho') {
          const c = partida.caminhos.get(e.id);
          pos = c ? repolhoNoPasso(c, e.n, nVer) : null;
        } else if (nVer >= e.n && nVer - e.n < VIDA_DA_LAMA) pos = [e.x, e.y];
        if (!pos) continue;
        const f = figuraNoChao(d, cam, e.tipo, pos[0], pos[1], e.tipo === 'lama' ? 1.4 : 1.2);
        if (f) figuras.push(f);
      }
      // os karts, com os balões atrás (piscando nos 2 s depois de perder um) e o escudo em volta
      for (const q of o.participantes) {
        if (!temBalao(q.id)) continue;
        const l = partida.locais.find((k) => k.id === q.id);
        const pos = l ? { x: l.kart.x, y: l.kart.y, a: l.kart.angulo } : posicaoDe(q.id, nVer);
        if (!pos) continue;
        const ehMeu = !!meu && l === meu;
        const kf = kartNaTela(d, cam, pos.x, pos.y, pos.a, l ? l.kart.pulo : 0, {
          nome: ehMeu ? undefined : q.nome,
          avatar: q.avatar,
          tremor: ehMeu && tremor > 0 ? (tremor % 2 ? 1 : -1) : 0,
        });
        if (!kf) continue;
        figuras.push(ehMeu ? { ...kf, z: kf.z - 0.01 } : kf);
        let ultimo = l ? l.ultimoEstouro : -Infinity;
        if (!l) for (const e of o.eventos) if (e.tipo === 'estourou' && e.alvo === q.id) ultimo = e.n;
        figuras.push(...baloesNaTela(cam, pos.x, pos.y, pos.a, baloesDe(q.id), corDoBalao(q.largada), tempo, nVer < ultimo + INVULNERAVEL));
        if (partida.escudoAtivo(q.id, nVer)) {
          const f = figuraNoChao(d, cam, 'escudo', pos.x, pos.y, 1.9);
          if (f) figuras.push({ ...f, z: kf.z - 0.02 });
        }
      }
      // os estouros (meio segundo cada)
      const agora = performance.now();
      for (let i = estouros.length - 1; i >= 0; i--) {
        const t = (agora - estouros[i].em) / 500;
        if (t > 1) {
          estouros.splice(i, 1);
          continue;
        }
        const f = estouroNaTela(cam, estouros[i].x, estouros[i].y, corDoBalao(porId.get(estouros[i].alvo)?.largada ?? 0), t);
        if (f) figuras.push(f);
      }
      figuras.sort((a, b) => b.z - a.z);
      for (const f of figuras) f.desenhar(d.ctx);
      if (euJogo && !olhando && meu!.kart.turbo > 0) faiscas(d.ctx, W / 2, 168, 2, tempo, meu!.kart.deriva);
      if (olhando) retrovisor(d.ctx);
      // o que fica na tela: os meus balões, o item na mão, o mapa pequeno e a contagem
      if (meu) meusBaloes(d.ctx, baloesDe(meu.id), BALOES, corDoBalao(porId.get(meu.id)?.largada ?? 0));
      if (euJogo && n > 0) quadroDoItem(d, meu!.naMao);
      d.ctx.globalAlpha = 0.85;
      d.ctx.drawImage(mapa, W - 60, H - 60);
      d.ctx.globalAlpha = 1;
      for (const q of o.participantes) {
        if (!temBalao(q.id) || (euJogo && q.id === o.eu)) continue;
        const pos = posicaoDe(q.id, nVer);
        if (pos) pontoNoMapaDaArena(d.ctx, arena, W - 60, H - 60, 56, pos.x, pos.y, corDoBalao(q.largada));
      }
      if (euJogo) pontoNoMapaDaArena(d.ctx, arena, W - 60, H - 60, 56, meu!.kart.x, meu!.kart.y, '#fbf3e4');
      if (n <= 40) semaforo(d.ctx, n <= 0 ? Math.round(((o.verdeEm - performance.now()) * PASSOS_POR_SEGUNDO) / 1000) : 0);
      if (pausado) {
        d.ctx.fillStyle = '#140e188c';
        d.ctx.fillRect(0, 0, W, H);
        d.ctx.fillStyle = '#f4ead8';
        d.ctx.fillRect(W / 2 - 12, H / 2 - 14, 8, 28);
        d.ctx.fillRect(W / 2 + 4, H / 2 - 14, 8, 28);
      }
    };

    const ciclo = (agora: number) => {
      if (!vivo) return;
      const dt = Math.min(0.25, (agora - antes) / 1000);
      antes = agora;
      const semFoco = document.hidden || !document.hasFocus();
      // o ESC pausa até a contagem (o verde vai para a frente junto); a janela sem foco, só depois dela
      pausado = o.pausaSemFoco && ((semFoco && partida.n > 0) || !!o.pausa?.ativa) && !partida.acabou;
      // no Solo, a pausa empurra o sinal verde para a frente: o relógio da partida para junto
      if (pausado) o.verdeEm += dt * 1000;
      const alvo = Math.min(DURACAO_PASSOS + 60, Math.floor(((agora - o.verdeEm) * PASSOS_POR_SEGUNDO) / 1000));
      // ao voltar de muito tempo escondida, anda no máximo 20 s de uma vez
      for (let feitos = 0; partida.n < alvo && feitos < 1200; feitos++) umPasso();
      partida.lerEventos();
      if (!document.hidden) desenhar();
      o.aoPlacar?.({ restanteMs: Math.max(0, ((DURACAO_PASSOS - Math.max(0, partida.n)) * 1000) / PASSOS_POR_SEGUNDO), pausado });
      quadro = requestAnimationFrame(ciclo);
    };
    partida.avisarBaloes();
    quadro = requestAnimationFrame(ciclo);

    // quem assiste troca de câmera com ◀ ▶
    const trocar = (e: KeyboardEvent) => {
      if (meu && temBalao(meu.id)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const vivos = o.participantes.filter((q) => q.id !== o.eu && temBalao(q.id));
      if (!vivos.length) return;
      const i = Math.max(0, vivos.findIndex((q) => q.id === assistindo));
      assistindo = vivos[(i + (e.key === 'ArrowRight' ? 1 : vivos.length - 1)) % vivos.length].id;
    };
    window.addEventListener('keydown', trocar);
    pararExtra = () => window.removeEventListener('keydown', trocar);
  })();

  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
    pararExtra();
  };
}
