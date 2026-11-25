import { criarImpacto } from '../impacto';
import { tocar } from '../somDosJogos';
import { ALTURA, bichoEm, T, type Fase } from './fases';
import { andarParticulas, barraDoCaminho, desenharParticulas, H, pintar, prepararPintura, semaforo, W, type Figura, type Particula } from './desenho';
import { AMOSTRA, amostrar, contarCenouras, fantasmaEm, novoCoelho, PASSO, passo, progresso, type Coelho, type Comandos } from './fisica';
import { planejar } from './piloto';

/**
 * O LAÇO DO PULO DO COELHO (03/11/2026), como o da corrida de kart (corrida/laco.ts): a física em passos fixos, a câmera e
 * o desenho. Quem chama diz o que muda: a fase, os fantasmas (contra o relógio), os RIVAIS ao vivo (na sala, chegam pelo
 * socket), a contagem da largada e o que fazer na chegada. Com a janela sem foco, o coelho PARA (a física e o relógio
 * também): o tempo de cada um é contado nos passos dele.
 */

let folha: HTMLImageElement | null = null;

async function coelho(): Promise<HTMLImageElement> {
  if (!folha) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}plataforma/coelho.png`;
    await img.decode().catch(() => undefined);
    folha = img;
  }
  return folha;
}

/** Uma posição de um rival, como chegou pelo socket: o passo da corrida DELE em que ele estava ali. */
export interface PosicaoDoRival {
  n: number;
  x: number;
  y: number;
  j: number;
  andou: number;
}

export interface Rival {
  nome: string;
  posicoes: PosicaoDoRival[];
}

/**
 * Guarda a posição que chegou de um rival. A de passo menor que a última fica de fora (chegou velha), MENOS quando o passo
 * volta muito: é a corrida nova dele (revisão independente, 03/11/2026: a página recarregada recomeçava do passo 0, e esta
 * tela descartava tudo dali em diante, com o coelho dele congelado). Aí a lista recomeça. A mesma medida do servidor
 * (RECOMECO_PASSOS, em server/src/minijogo-plataforma.ts).
 */
export function guardarPosicaoDoRival(r: Rival, p: PosicaoDoRival) {
  const ultima = r.posicoes.at(-1);
  if (ultima && p.n < ultima.n - 60) r.posicoes = [];
  else if (ultima && ultima.n >= p.n) return;
  r.posicoes.push(p);
  if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
}

/** Onde um rival estava no passo `n`, entre duas posições; depois da última, a última (sem adivinhar o pulo dele). */
export function rivalEm(posicoes: PosicaoDoRival[], n: number): PosicaoDoRival | null {
  if (posicoes.length === 0) return null;
  let i = posicoes.length - 1;
  while (i > 0 && posicoes[i].n > n) i--;
  const a = posicoes[i];
  const b = posicoes[i + 1];
  if (!b || b.n <= a.n || Math.abs(b.x - a.x) > 40) return a;
  const t = Math.max(0, Math.min(1, (n - a.n) / (b.n - a.n)));
  return {
    n,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    j: a.j,
    andou: a.andou + (b.andou - a.andou) * t,
  };
}

export interface LinhaDaOrdem {
  id: number;
  nome: string;
  eu: boolean;
}

export interface OpcoesDoLaco {
  canvas: HTMLCanvasElement;
  comandos: Comandos;
  fase: Fase;
  /** Sem coelho (quem assiste): a câmera vai atrás de quem está na frente. */
  piloto: boolean;
  eu: number;
  fantasmas?: { amostras: number[] }[];
  rivais?: Map<number, Rival>;
  /** Passos de semáforo antes do verde (3 s = 180). */
  contagem: number;
  /** A pausa do ESC (pausaDosJogos.tsx), só no Solo: lida a cada quadro, como a janela sem foco. */
  pausa?: { readonly ativa: boolean };
  aoPlacar: (p: { ms: number; pausado: boolean; quedas: number; cenouras: number; dourada: boolean }) => void;
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  /** A cada AMOSTRA passos, onde o coelho está (para mandar aos rivais). */
  aoPosicao?: (p: PosicaoDoRival) => void;
  /** Um pouco depois de cruzar a chegada: os passos e o caminho inteiro. */
  aoChegar?: (passos: number, caminho: number[], achados: { cenouras: number; dourada: boolean }) => void;
  /**
   * QUEM JÁ CHEGOU ASSISTE A QUEM AINDA CORRE (pedido dele, 05/11/2026: "quando o jogador terminar, seria legal ele ver a tela do
   * amigo"): a câmera vai para o coelho de `seguir.id` (ou, sem escolha, para quem está mais adiante entre os que correm), e
   * `aoAssistir` diz quem é e quem mais ainda corre (para trocar). Quando ninguém mais corre, volta para o próprio coelho.
   */
  seguir?: { id: number | null };
  aoAssistir?: (alvo: { id: number; nome: string } | null, correndo: { id: number; nome: string }[]) => void;
}

export function rodarFase(o: OpcoesDoLaco): () => void {
  let vivo = true;
  let quadro = 0;
  const p = prepararPintura(o.canvas, o.fase);
  const f = o.fase;

  void (async () => {
    p.coelho = await coelho();
    if (!vivo) return;
    const k: Coelho = novoCoelho(f);
    const caminho: number[] = [];
    let camX = Math.max(0, k.x - 120),
      camY = ALTURA - H;
    let contagem = o.contagem;
    let acumulado = 0;
    let antes = performance.now();
    let fimEm = 0;
    let avisou = false;
    let pausado = false;
    let ordemAntes = '';
    let nAssistindo = 0;
    let assistindoAntes = '';
    // o piloto automático (só no site de desenvolvimento, para o e2e): planeja a fase inteira uma vez
    let plano: Comandos[] | null = null;
    // O QUE É SÓ DESENHO (19/11/2026): a poeira, o estouro do espinho, o brilho da cenoura, o amassa-e-estica e o tremor.
    // Nada disto entra no passo nem no que vai ao servidor.
    const particulas: Particula[] = [];
    const impacto = criarImpacto();
    let escala: [number, number] = [1, 1];
    const poeira = (x: number, y: number, quantas: number, forca = 1) => {
      for (let i = 0; i < quantas; i++) {
        const lado = i % 2 ? 1 : -1;
        particulas.push({
          x: x + lado * 3,
          y: y - 1,
          vx: lado * (20 + ((i * 37) % 30)) * forca,
          vy: -8 - ((i * 13) % 12),
          vida: 0.35,
          total: 0.35,
          cor: '#e8dcc4',
          tam: 3,
        });
      }
    };
    const estouro = (x: number, y: number, cores: string[], quantas: number) => {
      for (let i = 0; i < quantas; i++) {
        const a = (i / quantas) * Math.PI * 2;
        particulas.push({
          x,
          y,
          vx: Math.cos(a) * 70,
          vy: Math.sin(a) * 70 - 60,
          vida: 0.6,
          total: 0.6,
          cor: cores[i % cores.length],
          tam: 2,
          pesa: true,
        });
      }
    };

    const andar = () => {
      if (contagem > 0) {
        contagem--;
        return;
      }
      if (!o.piloto) return;
      const auto = import.meta.env.DEV && (window as { plataformaPilotoAutomatico?: boolean }).plataformaPilotoAutomatico;
      if (auto && !plano) plano = planejar(f, k) ?? [];
      const c = auto && plano ? (plano.shift() ?? { esquerda: false, direita: true, pula: false }) : o.comandos;
      const jaTinha = k.terminou;
      const noChaoAntes = k.noChao;
      const quedasAntes = k.quedas;
      const xA = k.x,
        yA = k.y;
      passo(k, c, f);
      if (k.molou) {
        tocar('mola');
        escala = [0.75, 1.35];
        poeira(k.x, k.y, 6, 1.4);
      } else if (k.pisou >= 0) {
        tocar('impacto');
        const b = f.bichos[k.pisou];
        const q = bichoEm(b, k.passos);
        estouro(q.x, q.y, ['#f4ead8', '#c8c0cc', '#e8dcc4'], 10);
        impacto.acerto({ forca: 0.25, pausaMs: 50 });
        escala = [1.3, 0.75];
      } else if (noChaoAntes && !k.noChao && k.vy < 0) {
        tocar('pulo');
        escala = [0.8, 1.25];
        poeira(xA, yA, 4);
      } else if (!noChaoAntes && k.noChao) {
        escala = [1.3, 0.75];
        poeira(k.x, k.y, 6);
      }
      // pisou numa pedra que racha (21/11/2026): ela range
      if (k.racha.includes(k.passos)) tocar('rangido');
      if (k.pegou === 'cenoura') {
        tocar('moeda');
        estouro(k.x, k.y - 14, ['#f8b878', '#fff4c0'], 5);
      } else if (k.pegou === 'dourada') {
        tocar('medalha');
        estouro(k.x, k.y - 14, ['#f4d060', '#fffbe8', '#fff4c0'], 14);
        impacto.tremer(0.2);
      }
      if (k.quedas > quedasAntes) {
        if (k.ferido === 'buraco') tocar('queda');
        else {
          // o espinho e o bicho: estrelinhas claras e um tremor curto (sem sangue)
          tocar('dano');
          estouro(xA, yA - 12, ['#f4ead8', '#ffd27a', '#c8c0cc'], 12);
          impacto.acerto({ forca: 0.5, pausaMs: 70 });
        }
      }
      if (k.terminou && !jaTinha) tocar('chegada');
      if (!jaTinha) {
        amostrar(k, caminho);
        if ((k.passos - 1) % AMOSTRA === 0) {
          o.aoPosicao?.({
            n: k.passos,
            x: +k.x.toFixed(1),
            y: +k.y.toFixed(1),
            j: k.lado * (k.noChao || k.espera > 0 ? 1 : 2),
            andou: +progresso(k, f).toFixed(3),
          });
        }
      }
    };

    const rivaisEm = (n: number) => {
      const lista: { id: number; nome: string; pos: PosicaoDoRival }[] = [];
      for (const [id, r] of o.rivais ?? []) {
        const pos = rivalEm(r.posicoes, n);
        if (pos) lista.push({ id, nome: r.nome, pos });
      }
      return lista;
    };

    const desenhar = () => {
      // a pausa no acerto: a tela fica no quadro do golpe (a física e o envio seguem; só o desenho para)
      if (impacto.quadro().congelado) return;
      const n = o.piloto ? k.passos : nAssistindo;
      const rivais = rivaisEm(n);
      let foco = { x: k.x, y: k.y };
      if (!o.piloto) {
        const lider = [...rivais].sort((a, b) => b.pos.andou - a.pos.andou)[0];
        foco = lider ? lider.pos : f.largada;
      }
      if (o.piloto && k.terminou && o.rivais && o.aoAssistir) {
        const correndo = rivais.filter((r) => r.pos.andou < 0.999).sort((a, b) => b.pos.andou - a.pos.andou);
        const alvo = correndo.find((r) => r.id === o.seguir?.id) ?? correndo[0];
        if (alvo) foco = alvo.pos;
        if (o.seguir) o.seguir.id = alvo?.id ?? null;
        const chave = (alvo?.id ?? '') + '|' + correndo.map((r) => r.id).join(',');
        if (chave !== assistindoAntes) {
          assistindoAntes = chave;
          o.aoAssistir(
            alvo ? { id: alvo.id, nome: alvo.nome } : null,
            correndo.map((r) => ({ id: r.id, nome: r.nome })),
          );
        }
      }
      // a câmera: o coelho um pouco à esquerda do meio (vê-se o que vem), e no alto só o que a fase tem
      const alvoX = Math.max(0, Math.min(f.colunas * T - W, foco.x - 130));
      const alvoY = Math.max(0, Math.min(ALTURA - H, foco.y - 112));
      camX += (alvoX - camX) * 0.2;
      camY += (alvoY - camY) * 0.12;
      const figuras: Figura[] = [];
      for (const fa of o.fantasmas ?? []) {
        const g = fantasmaEm(fa.amostras, n);
        if (g)
          figuras.push({
            x: g.x,
            y: g.y,
            jeito: g.jeito,
            andado: g.x,
            alpha: 0.4,
          });
      }
      for (const r of rivais)
        figuras.push({
          x: r.pos.x,
          y: r.pos.y,
          jeito: r.pos.j,
          andado: r.pos.x,
          alpha: 0.75,
          nome: r.nome,
        });
      if (o.piloto) {
        figuras.push({
          x: k.x,
          y: k.y,
          jeito: k.lado * (k.noChao || k.espera > 0 ? 1 : 2),
          andado: Math.abs(k.vx) < 6 ? null : k.andado,
          piscando: k.espera > 0 && Math.floor(k.espera / 4) % 2 === 0,
          escala,
        });
      }
      const tremor = impacto.quadro();
      p.ctx.save();
      p.ctx.translate(tremor.dx, tremor.dy);
      pintar(p, camX, camY, n, figuras, o.piloto ? { cenouras: k.cenouras, dourada: k.dourada, pisados: k.pisados, racha: k.racha } : undefined);
      desenharParticulas(p.ctx, particulas, camX, camY);
      p.ctx.restore();
      barraDoCaminho(p.ctx, [
        ...(o.fantasmas ?? []).map((fa) => ({
          andou: ((fantasmaEm(fa.amostras, n)?.x ?? f.chegada) - f.largada.x) / (f.chegada - f.largada.x),
          cor: '#c8c0cc',
        })),
        ...rivais.map((r) => ({ andou: r.pos.andou, cor: '#7ab8ff' })),
        ...(o.piloto ? [{ andou: progresso(k, f), cor: '#ffa24a' }] : []),
      ]);
      if (contagem > 0 || (o.piloto && k.passos < 40)) semaforo(p.ctx, contagem);
      if (pausado && o.piloto) {
        p.ctx.fillStyle = '#140e188c';
        p.ctx.fillRect(0, 0, W, H);
        p.ctx.fillStyle = '#f4ead8';
        p.ctx.fillRect(W / 2 - 12, H / 2 - 14, 8, 28);
        p.ctx.fillRect(W / 2 + 4, H / 2 - 14, 8, 28);
      }
      if (o.rivais && o.aoOrdem) {
        const linhas = rivais.map((r) => ({
          id: r.id,
          nome: r.nome,
          eu: false,
          andou: r.pos.andou,
        }));
        if (o.piloto)
          linhas.push({
            id: o.eu,
            nome: '',
            eu: true,
            andou: k.terminou ? 1 : progresso(k, f),
          });
        for (const [id, r] of o.rivais) if (!linhas.some((l) => l.id === id)) linhas.push({ id, nome: r.nome, eu: false, andou: -1 });
        linhas.sort((a, b) => b.andou - a.andou);
        const chave = linhas.map((l) => l.id).join(',');
        if (chave !== ordemAntes) {
          ordemAntes = chave;
          o.aoOrdem(linhas.map(({ id, nome, eu }) => ({ id, nome, eu })));
        }
      }
    };

    const ciclo = (agora: number) => {
      if (!vivo) return;
      const dt = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      pausado = document.hidden || !document.hasFocus() || !!o.pausa?.ativa;
      if (!pausado || !o.piloto) {
        acumulado += dt;
        while (acumulado >= PASSO) {
          andar();
          if (!o.piloto && contagem === 0) nAssistindo++;
          acumulado -= PASSO;
        }
      }
      // quem assiste não vê o futuro: o passo mostrado não passa do último que chegou de alguém
      if (!o.piloto && o.rivais) {
        const ultimo = Math.max(0, ...[...o.rivais.values()].map((r) => r.posicoes.at(-1)?.n ?? 0));
        nAssistindo = Math.min(Math.max(nAssistindo, ultimo - 12), ultimo);
      }
      if (!pausado) {
        andarParticulas(particulas, dt);
        const solta = Math.min(1, dt * 12);
        escala = [escala[0] + (1 - escala[0]) * solta, escala[1] + (1 - escala[1]) * solta];
      }
      if (!document.hidden) desenhar();
      o.aoPlacar({
        ms: Math.round(((k.terminou ? k.chegouEm : k.passos) * 1000) / 60),
        pausado: pausado && o.piloto,
        quedas: k.quedas,
        cenouras: contarCenouras(k),
        dourada: k.dourada,
      });
      if (k.terminou && !fimEm) fimEm = agora;
      if (fimEm && agora - fimEm > 1200 && !avisou) {
        avisou = true;
        o.aoChegar?.(k.chegouEm, caminho, {
          cenouras: contarCenouras(k),
          dourada: k.dourada,
        });
      }
      quadro = requestAnimationFrame(ciclo);
    };
    quadro = requestAnimationFrame(ciclo);
  })();

  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
  };
}
