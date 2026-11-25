import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Socket } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { BarraDeVida, Retrato, Selo } from './JogoBichos';
import { MesaDosRobos, type Figura } from './EscolhaDosRobos';
import { carregarBichos } from './bichos/desenho';
import { ESPECIES, GOLPES } from './bichos/regras';
import { chave, useT } from './i18n';
import { primeiraForma, type Partida } from './minijogos';
import { tocar } from './somDosJogos';
import { criarImpacto } from './impacto';
import { CENARIOS, H, KITS, marcaDe, MATO, moitaEm, MUNDO_H, MUNDO_W, OBSTACULOS, PONTOS_DA_ZONA, PV, TECLAS_DE_GOLPE, W, ZONA_FINAL, type Cenario, type Marca, type TeclaDeGolpe } from './arena/conta';
import { prepararCoelho, quadroDaArena, receitaDoAvatar } from './arena/coelhos';
import {
  chaoDo,
  corDo,
  desenharBala,
  desenharEfeito,
  desenharEtiqueta,
  desenharMarca,
  desenharObstaculo,
  desenharSetaNaBorda,
  desenharSombra,
  desenharSuprimento,
  desenharZona,
  desenharZonaDoObjetivo,
  fileirasDoMato,
  MAO,
} from './arena/desenho';
import { pilotoAutomatico } from './arena/piloto';
import { Cliente, comandosVazios, ehQuadro, marcaDoLugar, type Comandos, type EstadoArena, type FormatoDaArena } from './arena/regras';
import type { Receita } from './coelho/receita';
import './arena/arena.css';

/**
 * A ARENA DOS COELHOS (17/11/2026; o servidor é server/src/arena/motor.ts): o modo de luta em tempo real dos Bichos da Toca, ao
 * lado da mesa de turnos. Vista de cima, a câmera segue quem joga; cada um luta com o PRÓPRIO coelho (a receita do criador), e o
 * bicho da frente da equipe dá o elemento: os golpes, a cor deles e a defesa. Andar (WASD ou setas), mirar com o mouse, o básico
 * no botão esquerdo, o secundário no direito, Q o golpe forte, E o especial (quando enche), Espaço a arrancada e R, 1, 2, 3 a
 * troca do bicho. No toque, o joystick à esquerda e arrastar à direita para mirar e bater.
 *
 * O MEU COELHO ANDA AQUI, na hora (arena/regras.ts, o Cliente), e a posição vai ao servidor ~15 vezes por segundo; os outros
 * chegam no quadro de 20 por segundo, desenhados ~100 ms atrás. As minhas balas andam aqui, e o acerto vai ao servidor, que o
 * confere pelo passado do alvo.
 */

declare global {
  interface Window {
    /** Só no desenvolvimento: o coelho anda, mira e bate sozinho. */
    arenaPilotoAutomatico?: boolean;
    /** Só no desenvolvimento: para onde a mira aponta agora, onde estou e o cenário (o e2e do toque lê). */
    arenaMiraDoTeste?: { alvoX: number | null; alvoY: number | null; x: number; y: number; cenario: string };
  }
}

/** O teclado e o mouse. */
function useControles(ativo: boolean, cmd: Comandos, canvas: React.RefObject<HTMLCanvasElement | null>, mouse: React.MutableRefObject<{ x: number; y: number } | null>) {
  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (apertada && (e.ctrlKey || e.metaKey || e.altKey)) return;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowleft' || k === 'a') cmd.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') cmd.direita = apertada;
      else if (k === 'arrowup' || k === 'w') cmd.cima = apertada;
      else if (k === 'arrowdown' || k === 's') cmd.baixo = apertada;
      else if (k === ' ') {
        if (apertada && !e.repeat) cmd.arrancada = true;
      } else if (k === 'q') {
        if (apertada && !e.repeat) cmd.forte = true;
      } else if (k === 'e') {
        if (apertada && !e.repeat) cmd.especial = true;
      } else if (k === 'r') {
        if (apertada && !e.repeat) cmd.trocar = -1;
      } else if (k === '1' || k === '2' || k === '3') {
        if (apertada && !e.repeat) cmd.trocar = Number(k) - 1;
      } else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => {
      Object.assign(cmd, comandosVazios());
      mouse.current = null;
    };
    const escondeu = () => document.hidden && soltar();
    const c = canvas.current;
    const noCanvas = (e: PointerEvent | MouseEvent) => {
      const r = c!.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') mouse.current = noCanvas(e);
    };
    const aperta = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      mouse.current = noCanvas(e);
      if (e.button === 0) cmd.atacar = true;
      else if (e.button === 2) cmd.secundario = true;
      e.preventDefault();
    };
    const solta = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 0) cmd.atacar = false;
    };
    const semMenu = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    window.addEventListener('pointerup', solta);
    document.addEventListener('visibilitychange', escondeu);
    c?.addEventListener('pointermove', move);
    c?.addEventListener('pointerdown', aperta);
    c?.addEventListener('contextmenu', semMenu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
      window.removeEventListener('pointerup', solta);
      document.removeEventListener('visibilitychange', escondeu);
      c?.removeEventListener('pointermove', move);
      c?.removeEventListener('pointerdown', aperta);
      c?.removeEventListener('contextmenu', semMenu);
      soltar();
    };
  }, [ativo, cmd, canvas, mouse]);
}

interface LinhaDoHud {
  userId: number;
  vidas: number;
  pv: number;
  estado: number;
  time: number;
  ativo: number;
}
interface Hud {
  linhas: LinhaDoHud[];
  resta: number;
  /** As cargas dos meus golpes (0 a 1) e da troca e da arrancada. */
  cargas: Record<TeclaDeGolpe, number>;
  troca: number;
  arrancada: number;
  ativo: number;
  especial: number;
  meuEstado: number;
  fase: string | null;
  /** Segurando a zona: [time, pontos]. */
  zona: [number, number][] | null;
  /** As ondas: a de agora e quanto falta para a próxima (0: lutando). */
  onda: { n: number; proxima: number } | null;
}

/**
 * A MARCA DE CADA ESPÉCIE (21/11/2026, conta.ts): a figura no botão do especial e a frase no título. O servidor decide; a tela
 * só mostra o que o bicho da frente faz.
 */
const MARCAS_NA_TELA: Record<Marca, { emoji: string; texto: string }> = {
  forte: { emoji: '💥', texto: chave('O especial bate mais forte.') },
  seiva: { emoji: '🌱', texto: chave('O especial cura você um pouco.') },
  casca: { emoji: '🛡️', texto: chave('Depois do especial, você leva menos dano por um tempo.') },
  pressa: { emoji: '💨', texto: chave('Depois do especial, você corre mais por um tempo.') },
  folego: { emoji: '⚡', texto: chave('O especial já volta com uma parte cheia.') },
};

export function JogoArena({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoArena & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const linhas = estado.resultado ?? estado.jogadores.map((j) => ({ ...j, dano: 0, quedas: 0, vidas: 0, posicao: null, levou: undefined, desvios: undefined, pontos: undefined }));
    const zona = estado.objetivo === 'zona';
    // os números de cada um (19/11/2026), em ícones com o nome no título: o dano causado, os nocautes, o dano levado e os desvios
    const colunas: [string, string, (l: (typeof linhas)[number]) => number | undefined][] = [
      ...(zona ? [['🚩', t('Pontos'), (l: (typeof linhas)[number]) => l.pontos] as [string, string, (l: (typeof linhas)[number]) => number | undefined]] : []),
      ['⚔️', t('Dano'), (l) => l.dano],
      ['💫', t('Nocautes'), (l) => l.quedas],
      ['🩹', t('Dano levado'), (l) => l.levou],
      ['💨', t('Desvios'), (l) => l.desvios],
    ];
    const meu = estado.jogadores.find((j) => j.userId === eu);
    const pessoas = estado.jogadores.filter((j) => !j.robo).length;
    const regra = { solo: estado.solo, pessoas, maximo: estado.formato === 'todos' ? 3 : 1 };
    return (
      <div className="briga arena">
        {meu && estado.vencedor !== null && <p className="briga-desfecho">{estado.vencedor === meu.time ? t('Vitória!') : t('Derrota')}</p>}
        <div className="minijogo-fim">
          <p className="minijogo-fim-titulo">
            <Trophy size={20} aria-hidden="true" /> {t('Fim de jogo!')}
          </p>
          {estado.solo && estado.ondas && (
            // AS ONDAS (21/11/2026): a onda alcançada, contada pelo servidor
            <p className="arena-sequencia" role="status">
              🌊 {t('Onda {n}', { n: estado.ondas.onda })}
              {estado.ondas.novo ? ` · 🏅 ${t('Novo recorde!')}` : estado.ondas.recorde !== null ? ` · ${t('Seu recorde: {n}', { n: estado.ondas.recorde })}` : ''}
            </p>
          )}
          {estado.solo && estado.sequencia && (
            // AS VITÓRIAS SEGUIDAS DO SOLO (20/11/2026; contadas pelo servidor, só na sessão: sem calendário)
            <p className="arena-sequencia" role="status">
              {t('Vitórias seguidas: {n}', { n: estado.sequencia.atual })}
              {estado.sequencia.novo ? ` · 🏅 ${t('Novo recorde!')}` : estado.sequencia.recorde !== null ? ` · ${t('Seu recorde: {n}', { n: estado.sequencia.recorde })}` : ''}
            </p>
          )}
          <p className="arena-colunas" aria-hidden="true">
            {colunas.map(([icone, nome]) => (
              <span key={icone} title={nome}>
                {icone}
              </span>
            ))}
          </p>
          <ol className="minijogo-placar arena-placar">
            {linhas.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha">{marcaDoLugar(l.posicao, regra)}</span>
                <span className="minijogo-nome">
                  <span className="arena-time" style={{ '--cor': corDoTime(l.time, estado.formato) } as CSSProperties} aria-hidden="true" />
                  {l.username}
                </span>
                {colunas.map(([icone, nome, valor]) => (
                  <span key={icone} className="minijogo-pontos arena-numero" title={nome} aria-label={`${nome}: ${valor(l) ?? 0}`}>
                    {valor(l) ?? 0}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }
  return <Palco estado={estado} eu={eu} jogador={jogador && estado.jogadores.some((j) => j.userId === eu)} socket={socket} channelId={channelId} />;
}

const CORES_DOS_TIMES = ['#4aa3ff', '#ff5a5a', '#6fd47a', '#e6b53f', '#c08af0', '#f08ac4'];
/** A mira do toque: o dedo à direita, relativo ao meio da tela. */
interface MiraDoToque {
  mira: boolean;
  dx: number;
  dy: number;
  /** Quem joga pelo toque (sem mouse): sem dedo mirando, a mira vai sozinha no adversário visível mais perto. */
  usado?: boolean;
  /**
   * O GOLPE FORTE OU O ESPECIAL SEGURADO (20/11/2026, como nas arenas de celular): arrastar a partir do botão mira para onde
   * o dedo foi (a linha aparece na tela), e soltar dispara; tocar sem arrastar mira no adversário mais perto.
   */
  golpe?: { tecla: 'forte' | 'especial'; dx: number; dy: number; arrastou: boolean } | null;
  /** O golpe solto, à espera do próximo quadro (que acerta a mira antes do passo que o usa). */
  disparo?: { tecla: 'forte' | 'especial'; dx: number; dy: number; arrastou: boolean } | null;
}

/** Até onde o arraste do botão vai: este tanto de pixels de dedo é o alcance inteiro do golpe. */
const ARRASTE_DO_GOLPE = 60;

const corDoTime = (time: number, formato: FormatoDaArena) => (formato === 'todos' ? CORES_DOS_TIMES[time % CORES_DOS_TIMES.length] : time === 0 ? CORES_DOS_TIMES[0] : CORES_DOS_TIMES[1]);

function Palco({ estado, eu, jogador, socket, channelId }: { estado: EstadoArena & Partida; eu: number; jogador: boolean; socket: Socket | null; channelId: number }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const toque = useRef<MiraDoToque>({ mira: false, dx: 0, dy: 0 });
  const [cmd] = useState(comandosVazios);
  const [hud, setHud] = useState<Hud | null>(null);
  const solo = estado.solo === true;
  useControles(jogador, cmd, canvas, mouse);

  const pessoas = useRef(new Map<number, { nome: string; receita: Receita; equipe: string[]; time: number }>());
  for (const j of estado.jogadores) pessoas.current.set(j.userId, { nome: j.username, receita: receitaDoAvatar(j.avatar), equipe: j.equipe, time: j.time });
  const minhaEquipe = estado.jogadores.find((j) => j.userId === eu)?.equipe ?? [];

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g || !socket) return;
    g.imageSmoothingEnabled = false;
    for (const p of pessoas.current.values()) {
      prepararCoelho(p.receita);
      carregarBichos(p.equipe);
    }
    const enviar = (dados: unknown) => (solo ? socket.emit('minijogo-solo:tempo-real', { dados }) : socket.emit('minijogo:tempo-real', { channelId, dados }));
    const equipes = new Map([...pessoas.current].map(([id, p]) => [id, p.equipe]));
    const cliente = new Cliente(eu, estado.cenario, equipes, enviar);
    const chao = chaoDo(estado.cenario);
    let quadroId = 0;
    let anterior = performance.now();
    let sobra = 0;
    let ultimoHud = 0;
    let camX = -1, camY = -1;
    // O IMPACTO (25/11/2026, a auditoria de game feel: a Arena não tinha nenhum). Só desenho: a pausa no acerto e o tremor,
    // na hora em que o golpe aparece na tela (o meu acerto no outro chega com o atraso de quem eu vejo)
    const impacto = criarImpacto({ pixelsPorForca: 5 });
    const piloto = () => import.meta.env.DEV && !!window.arenaPilotoAutomatico;
    const menosMovimento = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (import.meta.env.DEV) (window as unknown as { arenaDoTeste?: unknown }).arenaDoTeste = cliente;

    const aoQuadro = (m: { channelId?: number; dados?: unknown }) => {
      if (!solo && m.channelId !== channelId) return;
      if (ehQuadro(m.dados)) cliente.chegou(m.dados, performance.now());
    };
    const evento = solo ? 'minijogo-solo:tempo-real' : 'minijogo:tempo-real';
    socket.on(evento, aoQuadro);

    /** Um coelho na tela: o desenho do criador, a marca do time, a etiqueta. */
    const desenharCoelho = (o: { id: number; x: number; y: number; mx: number; my: number; acao: string; ms: number; pv: number; time: number; ativo: number; piscando: boolean }, agora: number, meu: boolean) => {
      const p = pessoas.current.get(o.id);
      if (!p) return;
      if (o.piscando && Math.floor(agora / 90) % 2) return;
      let x = o.x - camX, y = o.y - camY;
      const f0 = cliente.feridos.get(o.id);
      const ferido = f0 && f0.de <= agora && f0.ate > agora ? f0 : null;
      // o recuo é só dos outros: o meu coelho já recua pela regra
      if (ferido && !meu) {
        x += ferido.dx * 3;
        y += ferido.dy * 3;
      }
      const golpe = o.acao === 'golpe' && o.ms < 320;
      const anim = golpe ? 'acenando' : o.acao === 'andando' || o.acao === 'arrancada' ? 'andando' : 'parado';
      // o golpe: o braço levantado do aceno (os quadros do meio), na hora em que a magia sai da mão
      const ms = golpe ? (2 + Math.min(4, Math.floor(o.ms / 70))) * 83 + 1 : menosMovimento ? 0 : agora + o.id * 97;
      desenharSombra(g, x, y);
      desenharMarca(g, x, y, meu ? 'eu' : o.time === cliente.eu.time && jogador ? 'amigo' : 'outro');
      const q = quadroDaArena(p.receita, anim, o.mx, o.my, ms);
      let topo = y - 90;
      // no mato, eu e quem é do meu time aparecemos meio transparentes: é assim que se sabe que está escondido
      const escondido = (meu || (jogador && o.time === cliente.eu.time)) && moitaEm(estado.cenario, o.x, o.y) >= 0;
      if (q) {
        if (escondido) g.globalAlpha = 0.5;
        if (o.acao === 'arrancada') {
          // o rastro da arrancada: o mesmo desenho, para trás, apagando
          for (let k = 3; k >= 1; k--) {
            g.globalAlpha = 0.12 * (4 - k);
            g.drawImage(q.c, Math.round(x - q.pe[0] - o.mx * 9 * k), Math.round(y - q.pe[1] - o.my * 9 * k));
          }
          g.globalAlpha = 1;
        }
        g.drawImage(q.c, Math.round(x - q.pe[0]), Math.round(y - q.pe[1]));
        g.globalAlpha = 1;
        // o clarão de quem leva: forte nos primeiros 90 ms, depois piscando
        if (ferido && (agora - ferido.de < 90 || Math.floor(agora / 60) % 2 === 0)) {
          g.globalAlpha = agora - ferido.de < 90 ? 0.9 : 0.5;
          g.globalCompositeOperation = 'lighter';
          g.drawImage(q.c, Math.round(x - q.pe[0]), Math.round(y - q.pe[1]));
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 1;
        }
        topo = y - q.pe[1] + 18;
      }
      if (golpe && o.ms < 200) {
        // a magia saindo da mão, na cor do bicho da frente
        const cor = corDo(ESPECIES[p.equipe[o.ativo]]?.elemento);
        g.fillStyle = cor;
        g.globalAlpha = 1 - o.ms / 200;
        g.beginPath();
        g.arc(Math.round(x + o.mx * 16), Math.round(y + o.my * 16 - MAO), 5 + o.ms / 30, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      desenharEtiqueta(g, x, topo, p.nome, o.pv, corDoTime(o.time, estado.formato));
    };

    const quadro = () => {
      quadroId = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - anterior) / 1000);
      anterior = agora;
      // a mira do mouse: a tela (o mouse) mais a câmera
      const m = mouse.current;
      const tq = toque.current;
      // o golpe segurado no botão (ou o que acabou de ser solto): a mira pelo arraste, ou no adversário mais perto
      const doBotao = tq.disparo ?? tq.golpe ?? null;
      const maisPerto = () => {
        if (!jogador) return null;
        const eu0 = cliente.eu;
        let melhor: { x: number; y: number } | null = null;
        let dm = Infinity;
        for (const o of cliente.vista(agora).coelhos) {
          if (o.id === eu || o.time === eu0.time || o.estado !== 0 || o.escondido) continue;
          const d = (o.x - eu0.x) ** 2 + (o.y - eu0.y) ** 2;
          if (d < dm) [dm, melhor] = [d, { x: o.x, y: o.y }];
        }
        return melhor;
      };
      if (doBotao) {
        if (doBotao.arrastou) {
          const alcance = KITS[cliente.meuElemento()]?.[doBotao.tecla === 'forte' ? 'q' : 'e']?.alcance ?? 120;
          cmd.alvoX = cliente.eu.x + doBotao.dx * alcance;
          cmd.alvoY = cliente.eu.y + doBotao.dy * alcance;
        } else {
          const alvo = maisPerto();
          cmd.alvoX = alvo ? alvo.x : null;
          cmd.alvoY = alvo ? alvo.y : null;
        }
        if (tq.disparo) {
          cmd[tq.disparo.tecla] = true;
          tq.disparo = null;
        }
      } else if (tq.mira) {
        cmd.alvoX = cliente.eu.x + tq.dx;
        cmd.alvoY = cliente.eu.y + tq.dy;
      } else if (m && camX >= 0) {
        cmd.alvoX = camX + m.x;
        cmd.alvoY = camY + m.y;
      } else if (tq.usado) {
        // no toque, sem dedo mirando: o adversário visível mais perto (antes, a mira congelava no último ponto)
        const alvo = maisPerto();
        cmd.alvoX = alvo ? alvo.x : null;
        cmd.alvoY = alvo ? alvo.y : null;
      }
      if (import.meta.env.DEV) window.arenaMiraDoTeste = { alvoX: cmd.alvoX, alvoY: cmd.alvoY, x: cliente.eu.x, y: cliente.eu.y, cenario: estado.cenario };
      // O MEU COELHO: passos fixos de 1/60 s
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        if (!jogador) continue;
        const v = cliente.vista(agora);
        if (piloto() && cliente.jogando()) pilotoAutomatico(cliente, v, cmd, agora);
        cliente.passo(cmd, 1 / 60, agora, v);
      }
      for (const s of cliente.sons.splice(0)) tocar(s);
      // os impactos que já aparecem na tela
      for (let k = cliente.impactos.length - 1; k >= 0; k--) {
        const i = cliente.impactos[k];
        if (i.em > agora) continue;
        cliente.impactos.splice(k, 1);
        if (i.tipo === 'acertei') impacto.acerto({ forca: i.forte ? 0.35 : 0.15, pausaMs: i.forte ? 60 : 40 });
        else if (i.tipo === 'levei') impacto.acerto({ forca: i.forte ? 0.7 : 0.45, tremorMs: 220 });
        else impacto.tremer(0.9, 360);
      }
      const v = cliente.vista(agora);

      if (agora - ultimoHud > 200 && v.fase) {
        ultimoHud = agora;
        const meu = cliente.eu;
        setHud({
          linhas: v.coelhos.map((l) => ({ userId: l.id, vidas: l.vidas, pv: l.id === eu ? meu.pv : l.pv, estado: l.estado, time: l.time, ativo: l.id === eu ? meu.ativo : l.ativo })),
          resta: v.resta,
          cargas: Object.fromEntries(TECLAS_DE_GOLPE.map((k) => [k, cliente.carga(k, agora)])) as Record<TeclaDeGolpe, number>,
          troca: cliente.cargaDaTroca(agora),
          arrancada: cliente.cargaDaArrancada(agora),
          ativo: meu.ativo,
          especial: meu.especial,
          meuEstado: meu.estado,
          fase: v.fase,
          zona: v.zona ? [...v.zona.pontos.entries()] : null,
          onda: v.onda ?? null,
        });
      }

      // a janela sem foco não desenha (sem foco nada se mexe)
      if (!piloto() && (document.hidden || !document.hasFocus())) return;
      // a câmera: o meu coelho (ou, para quem assiste ou está fora, o primeiro de pé)
      const foco = jogador && cliente.eu.estado === 0 ? cliente.eu : (v.coelhos.find((o) => o.estado === 0 && !o.escondido) ?? { x: MUNDO_W / 2, y: MUNDO_H / 2 });
      const ax = Math.max(0, Math.min(MUNDO_W - W, foco.x - W / 2));
      const ay = Math.max(0, Math.min(MUNDO_H - H, foco.y - 24 - H / 2));
      if (camX < 0) [camX, camY] = [ax, ay];
      camX += (ax - camX) * Math.min(1, dt * 9);
      camY += (ay - camY) * Math.min(1, dt * 9);
      const cx = Math.round(camX), cy = Math.round(camY);
      const tempo = menosMovimento ? Math.floor(agora / 400) * 400 : agora;
      // a pausa no acerto: a tela fica no quadro do golpe (o meu coelho e o envio acima seguem; só o desenho para)
      const imp = impacto.quadro(agora);
      if (imp.congelado) return;
      g.save();
      g.translate(imp.dx, imp.dy);
      // com o tremor, o chão passa um pouco da tela, para a borda não mostrar o quadro de antes
      g.drawImage(chao, cx - 8, cy - 8, W + 16, H + 16, -8, -8, W + 16, H + 16);
      // o aviso de cada zona, pelo tamanho dela (a da arena, a do especial, a do forte e a pedrada da pedra)
      // segurando a zona: o círculo do meio, na cor de quem o segura sozinho
      if (estado.objetivo === 'zona') desenharZonaDoObjetivo(g, cx, cy, v.zona && v.zona.dono >= 0 ? corDoTime(v.zona.dono, estado.formato) : null, tempo);
      // o aviso de cada zona: o servidor manda quanto ele dura inteiro
      for (const z of v.zonas) desenharZona(g, z, cx, cy, tempo, z.aviso);
      for (const s of v.suprimentos) desenharSuprimento(g, s.tipo, s.x - cx, s.y - cy, tempo);
      // de pé, na ordem do y: os obstáculos e os coelhos
      const dePe: { y: number; desenhar: () => void }[] = OBSTACULOS[estado.cenario].map((o, i) => ({ y: o[1], desenhar: () => desenharObstaculo(g, estado.cenario, i, cx, cy) }));
      // as folhas do mato, fileira por fileira (quem está dentro fica com as pernas atrás das da frente)
      dePe.push(...fileirasDoMato(g, estado.cenario, cx, cy, tempo));
      for (const o of v.coelhos) {
        // quem está no mato fora da minha vista nem tem posição no quadro
        if (o.estado !== 0 || o.escondido || (o.id === eu && jogador)) continue;
        dePe.push({ y: o.y, desenhar: () => desenharCoelho(o, agora, false) });
      }
      if (jogador && cliente.eu.estado === 0) {
        const meu = cliente.eu;
        dePe.push({
          y: meu.y,
          desenhar: () =>
            desenharCoelho({ id: eu, x: meu.x, y: meu.y, mx: meu.mx, my: meu.my, acao: meu.acao, ms: meu.t, pv: meu.pv, time: meu.time, ativo: meu.ativo, piscando: agora < meu.piscandoAte }, agora, true),
        });
      }
      dePe.sort((a, b) => a.y - b.y);
      for (const d of dePe) d.desenhar();
      // as balas, por cima
      for (const b of [...v.balas, ...cliente.minhasBalas(agora)]) desenharBala(g, b.elemento, b.x - cx, b.y - cy, b.dx, b.dy, b.golpe.raio, tempo);
      for (let k = cliente.efeitos.length - 1; k >= 0; k--) if (!desenharEfeito(g, cliente.efeitos[k], cx, cy, agora)) cliente.efeitos.splice(k, 1);
      g.restore();
      // as setas na borda: os suprimentos e os outros fora da tela
      for (const s of v.suprimentos) {
        const sx = s.x - cx, sy = s.y - cy;
        if (sx < 0 || sx > W || sy < 0 || sy > H) desenharSetaNaBorda(g, sx, sy, '#fff6c8', s.tipo);
      }
      for (const o of v.coelhos) {
        if (o.estado !== 0 || o.escondido || o.id === eu) continue;
        const sx = o.x - cx, sy = o.y - cy - 40;
        if (sx < 0 || sx > W || sy < -40 || sy > H) desenharSetaNaBorda(g, sx, sy, corDoTime(o.time, estado.formato));
      }
      // a linha de mira do golpe segurado no botão de toque (do coelho ao ponto que o golpe vai mirar)
      if (jogador && tq.golpe && cliente.eu.estado === 0 && cmd.alvoX !== null && cmd.alvoY !== null) {
        const x0 = Math.round(cliente.eu.x - cx), y0 = Math.round(cliente.eu.y - cy - MAO);
        const x1 = Math.round(cmd.alvoX - cx), y1 = Math.round(cmd.alvoY - cy);
        g.save();
        g.strokeStyle = tq.golpe.tecla === 'especial' ? '#ffd65acc' : '#ffffffcc';
        g.lineWidth = 2;
        g.setLineDash([4, 3]);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.arc(x1, y1, 5, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      // a mira do mouse
      if (jogador && m && !piloto()) {
        g.strokeStyle = '#ffffffcc';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(Math.round(m.x), Math.round(m.y), 5, 0, Math.PI * 2);
        g.moveTo(Math.round(m.x) - 8, Math.round(m.y));
        g.lineTo(Math.round(m.x) - 3, Math.round(m.y));
        g.moveTo(Math.round(m.x) + 3, Math.round(m.y));
        g.lineTo(Math.round(m.x) + 8, Math.round(m.y));
        g.stroke();
      }
    };
    quadroId = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(quadroId);
      socket.off(evento, aoQuadro);
      Object.assign(cmd, comandosVazios());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, channelId, solo, eu, jogador, cmd, estado.cenario, estado.partidaId]);

  const nome = (id: number) => pessoas.current.get(id)?.nome ?? '';
  const meuTime = estado.jogadores.find((j) => j.userId === eu)?.time;
  const aviso = hud?.fase === 'vitoria' ? (meuTime !== undefined && estado.vencedor !== null ? (estado.vencedor === meuTime ? t('Vitória!') : t('Derrota')) : null) : jogador && hud?.meuEstado === 2 ? t('Sem vidas.') : null;
  const kit = KITS[ESPECIES[minhaEquipe[hud?.ativo ?? 0] ?? '']?.elemento ?? 'folha'];
  const minhaMarca = MARCAS_NA_TELA[marcaDe(minhaEquipe[hud?.ativo ?? 0] ?? '')];
  const ondas = estado.objetivo === 'ondas';
  const nomeDoGolpe = (id: string) => primeiraForma(t(GOLPES[id]?.nome ?? ''));
  const segundos = Math.ceil((hud?.resta ?? 0) / 1000);
  // O FIM COM PRESSÃO (20/11/2026): no último minuto, as zonas vêm mais depressa e maiores; a tela avisa (e o relógio fica vermelho)
  const ultimoMinuto = !ondas && !!hud && hud.fase === 'lutando' && hud.resta > 0 && hud.resta <= ZONA_FINAL.falta;
  const avisouFinal = useRef<string | null>(null);
  useEffect(() => {
    if (!ultimoMinuto || avisouFinal.current === estado.partidaId) return;
    avisouFinal.current = estado.partidaId;
    tocar('alarme');
  }, [ultimoMinuto, estado.partidaId]);

  return (
    <div className="briga arena">
      <ul className="briga-hud arena-hud" aria-live="off">
        {(hud?.linhas ?? [])
          // nas ondas, quem está fora da onda (as vagas que ela não usa) não aparece
          .filter((l) => !ondas || l.time === meuTime || l.estado !== 2)
          .map((l) => {
          const p = pessoas.current.get(l.userId);
          const especie = p?.equipe[l.ativo] ?? '';
          return (
            <li key={l.userId} className={(l.userId === eu ? 'eu' : '') + (l.estado === 2 ? ' arena-fora' : '')} style={{ '--cor': corDoTime(l.time, estado.formato) } as CSSProperties}>
              <span className="arena-quem">
                {especie && <Retrato especie={especie} tamanho={28} dormindo={l.estado !== 0} />}
                <span className="minijogo-nome">{nome(l.userId)}</span>
              </span>
              <span className="briga-vidas" aria-hidden="true">
                {'♥'.repeat(Math.max(0, l.vidas))}
              </span>
              <BarraDeVida pv={l.estado === 0 ? l.pv : 0} pvMax={PV} />
            </li>
          );
        })}
      </ul>
      <div className="briga-tela arena-tela">
        <canvas ref={canvas} width={W} height={H} />
        {hud && !ondas && <span className={'arena-relogio' + (ultimoMinuto ? ' final' : '')}>{`${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`}</span>}
        {hud?.onda && (
          // AS ONDAS (21/11/2026): no lugar do relógio, a onda de agora; entre uma e outra, a próxima chegando
          <span className="arena-relogio arena-onda" aria-label={t('Onda {n}', { n: hud.onda.n })}>
            🌊 {hud.onda.n}
          </span>
        )}
        {hud?.onda && hud.onda.proxima > 0 && (
          <p className="arena-ultimo-minuto" role="status">
            <span aria-hidden="true">🌊</span> {t('Onda {n}', { n: hud.onda.n + 1 })}
          </p>
        )}
        {ultimoMinuto && segundos > ZONA_FINAL.falta / 1000 - 4 && (
          <p className="arena-ultimo-minuto" role="status">
            <span aria-hidden="true">⏱️</span> {t('Último minuto!')}
          </p>
        )}
        {hud && estado.objetivo === 'zona' && (
          <span className="arena-placar-da-zona" aria-label={t('Segurar a zona')}>
            🚩
            {[...new Set(estado.jogadores.map((j) => j.time))].map((time) => (
              <span key={time} style={{ '--cor': corDoTime(time, estado.formato) } as CSSProperties}>
                {`${hud.zona?.find(([tm]) => tm === time)?.[1] ?? 0}/${PONTOS_DA_ZONA}`}
              </span>
            ))}
          </span>
        )}
        {aviso && <p className="briga-aviso">{aviso}</p>}
        {jogador && <Toque cmd={cmd} canvas={canvas} toque={toque} />}
      </div>
      {jogador && hud && (
        <div className="arena-minha-barra">
          <div className="arena-bichos" role="group" aria-label={t('Equipe')}>
            {minhaEquipe.map((e, i) => (
              <button
                key={i}
                type="button"
                className={'arena-bicho' + (i === hud.ativo ? ' ativo' : '')}
                aria-pressed={i === hud.ativo}
                aria-label={`${ESPECIES[e]?.nome ?? e} (${i + 1})`}
                title={`${ESPECIES[e]?.nome ?? e} (${i + 1})`}
                disabled={i === hud.ativo || hud.troca < 1}
                onClick={() => (cmd.trocar = i)}
                style={{ '--carga': i === hud.ativo ? 1 : hud.troca } as CSSProperties}
              >
                <Retrato especie={e} tamanho={36} />
                <Selo especie={e} />
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
          <div className="arena-golpes" aria-hidden="true">
            {(
              [
                ['b', '●', nomeDoGolpe(kit.nomes[0])],
                ['s', '◐', t('Habilidade')],
                ['q', 'Q', t('Golpe forte')],
                ['e', 'E', `${minhaMarca.emoji} ${t('Especial')} ${Math.floor(hud.especial)}%`],
              ] as const
            ).map(([k, tecla, rotulo]) => (
              <span key={k} className={'arena-golpe' + (hud.cargas[k] >= 1 ? ' pronto' : '')} style={{ '--carga': hud.cargas[k] } as CSSProperties}>
                <kbd>{tecla}</kbd>
                <span>{rotulo}</span>
              </span>
            ))}
            <span className={'arena-golpe' + (hud.arrancada >= 1 ? ' pronto' : '')} style={{ '--carga': hud.arrancada } as CSSProperties}>
              <kbd>␣</kbd>
              <span>{t('Arrancada')}</span>
            </span>
          </div>
        </div>
      )}
      {jogador && (
        <ComandosDoJogo
          itens={[
            { teclas: ['wasd', 'setas'], rotulo: t('Andar') },
            { teclas: ['mouse-arrastar'], toque: 'toque-arrastar', rotulo: t('Mirar') },
            { teclas: ['mouse-clique'], rotulo: t('Atacar') },
            { teclas: ['mouse-direito'], rotulo: t('Habilidade') },
            { teclas: ['q'], rotulo: t('Golpe forte') },
            { teclas: ['e'], rotulo: t('Especial') },
            { teclas: ['espaco'], rotulo: t('Arrancada') },
          ]}
        />
      )}
    </div>
  );
}

/**
 * O TOQUE: o joystick de 360° à esquerda (onde o dedo encosta, ele nasce), e arrastar à direita para mirar e bater (o básico,
 * enquanto o dedo está lá: a mira vai do meio da tela para o dedo). Os botões do lado direito de baixo: a arrancada, o
 * secundário, o forte, o especial e a troca.
 */
function Toque({ cmd, canvas, toque }: { cmd: Comandos; canvas: React.RefObject<HTMLCanvasElement | null>; toque: React.MutableRefObject<MiraDoToque> }) {
  const t = useT();
  const [manche, setManche] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const dedos = useRef(new Map<number, 'andar' | 'mirar'>());
  const centro = useRef({ x: 0, y: 0 });
  const camada = useRef<HTMLDivElement>(null);
  const mirar = (e: React.PointerEvent) => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dx = ((e.clientX - r.left) * W) / r.width - W / 2;
    const dy = ((e.clientY - r.top) * H) / r.height - (H / 2 - 20);
    if (dx * dx + dy * dy > 16) Object.assign(toque.current, { mira: true, dx, dy });
  };
  const aperta = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    toque.current.usado = true;
    const r = camada.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (x < r.width * 0.45) {
      dedos.current.set(e.pointerId, 'andar');
      centro.current = { x, y };
      setManche({ x, y, dx: 0, dy: 0 });
      cmd.moverX = 0;
      cmd.moverY = 0;
    } else {
      dedos.current.set(e.pointerId, 'mirar');
      toque.current.mira = true;
      mirar(e);
      cmd.atacar = true;
    }
  };
  const move = (e: React.PointerEvent) => {
    const tipo = dedos.current.get(e.pointerId);
    if (tipo === 'mirar') return mirar(e);
    if (tipo !== 'andar') return;
    const r = camada.current!.getBoundingClientRect();
    let dx = e.clientX - r.left - centro.current.x, dy = e.clientY - r.top - centro.current.y;
    const d = Math.hypot(dx, dy);
    const max = 40;
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    cmd.moverX = dx / max;
    cmd.moverY = dy / max;
    setManche({ x: centro.current.x, y: centro.current.y, dx, dy });
  };
  const solta = (e: React.PointerEvent) => {
    const tipo = dedos.current.get(e.pointerId);
    dedos.current.delete(e.pointerId);
    if (tipo === 'andar') {
      cmd.moverX = cmd.moverY = null;
      setManche(null);
    } else if (tipo === 'mirar') {
      cmd.atacar = false;
      Object.assign(toque.current, { mira: false, dx: 0, dy: 0 });
    }
  };
  const apertar = (k: 'arrancada' | 'secundario') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toque.current.usado = true;
      cmd[k] = true;
    },
  });
  /** Q e E: segurar e arrastar mira (a linha na tela), soltar dispara; o toque sem arraste mira no adversário mais perto. */
  const inicio = useRef<{ id: number; x: number; y: number } | null>(null);
  const segurar = (k: 'forte' | 'especial') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.pointerType !== 'mouse') toque.current.usado = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      inicio.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      toque.current.golpe = { tecla: k, dx: 0, dy: 0, arrastou: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const i = inicio.current, g = toque.current.golpe;
      if (!i || i.id !== e.pointerId || !g) return;
      e.stopPropagation();
      const dx = e.clientX - i.x, dy = e.clientY - i.y;
      const d = Math.hypot(dx, dy);
      if (d < 12 && !g.arrastou) return;
      const f = Math.min(1, d / ARRASTE_DO_GOLPE) / (d || 1);
      Object.assign(g, { dx: dx * f, dy: dy * f, arrastou: true });
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const i = inicio.current, g = toque.current.golpe;
      if (!i || i.id !== e.pointerId || !g) return;
      e.stopPropagation();
      inicio.current = null;
      toque.current.golpe = null;
      toque.current.disparo = g;
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (inicio.current?.id !== e.pointerId) return;
      inicio.current = null;
      toque.current.golpe = null;
    },
  });
  return (
    <div ref={camada} className="arena-toque" onPointerDown={aperta} onPointerMove={move} onPointerUp={solta} onPointerCancel={solta}>
      {manche && (
        <span className="arena-manche" style={{ left: manche.x, top: manche.y } as CSSProperties} aria-hidden="true">
          <span style={{ transform: `translate(${manche.dx}px, ${manche.dy}px)` }} />
        </span>
      )}
      <div className="arena-toque-botoes">
        <button type="button" aria-label={t('Arrancada')} {...apertar('arrancada')}>»</button>
        <button type="button" aria-label={t('Habilidade')} {...apertar('secundario')}>◐</button>
        <button type="button" aria-label={t('Golpe forte')} {...segurar('forte')}>Q</button>
        <button type="button" aria-label={t('Especial')} {...segurar('especial')}>E</button>
        <button
          type="button"
          aria-label={t('Trocar')}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            cmd.trocar = -1;
          }}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ A ESCOLHA, NA LARGADA DOS BICHOS
/**
 * A LARGADA DOS BICHOS DA TOCA: a luta por turnos (no Solo, a aventura; na sala, a mesa de duas pessoas) ou a ARENA, com o
 * formato. Os formatos são figuras (você, robôs, os lados), sem texto novo: "1 × 1", "3 × 3" e "1 × 1 × 1" para o leitor de tela.
 */
export interface ModoDosBichos {
  modo: 'turnos' | 'arena';
  corpo: Record<string, unknown>;
}

const OPCOES_DA_SALA: { formato: FormatoDaArena; lados: Figura[][]; rotulo: string }[] = [
  { formato: '1x1', lados: [['eu'], ['eu']], rotulo: '1 × 1' },
  { formato: '3x3', lados: [['eu', 'eu', 'eu'], ['eu', 'eu', 'eu']], rotulo: '3 × 3' },
  { formato: 'todos', lados: [['eu'], ['eu'], ['eu']], rotulo: '1 × 1 × 1' },
];
const OPCOES_DO_SOLO: { formato: FormatoDaArena; robos: number; lados: Figura[][]; rotulo: string }[] = [
  ...[1, 2, 3, 4, 5].map((robos) => ({ formato: 'todos' as const, robos, lados: [['eu'] as Figura[], ...Array.from({ length: robos }, () => ['robo'] as Figura[])], rotulo: robos === 1 ? '1 × 1' : String(robos) })),
  { formato: '3x3', robos: 5, lados: [['eu', 'robo', 'robo'], ['robo', 'robo', 'robo']], rotulo: '3 × 3' },
];

/** AS ONDAS (21/11/2026): sozinho contra as ondas, ou com dois robôs aliados. */
const OPCOES_DAS_ONDAS: { formato: FormatoDaArena; robos: number; lados: Figura[][]; rotulo: string }[] = [
  { formato: 'todos', robos: 1, lados: [['eu'], ['robo', 'robo', 'robo']], rotulo: '1' },
  { formato: '3x3', robos: 5, lados: [['eu', 'robo', 'robo'], ['robo', 'robo', 'robo']], rotulo: '3' },
];

/** A miniatura do cenário na largada: o chão do mundo inteiro, reduzido, com os obstáculos e as moitas por cima. */
function PreviaDoCenario({ cenario }: { cenario: Cenario }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    const k = PREVIA_W / MUNDO_W;
    g.imageSmoothingEnabled = true;
    g.drawImage(chaoDo(cenario), 0, 0, PREVIA_W, PREVIA_H);
    g.fillStyle = 'rgba(30, 40, 20, 0.55)';
    for (const [ox, oy, r] of OBSTACULOS[cenario]) {
      g.beginPath();
      g.arc(ox * k, oy * k, Math.max(2, r * k), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(40, 110, 40, 0.7)';
    for (const [mx, my, mr] of MATO[cenario]) {
      g.beginPath();
      g.arc(mx * k, my * k, Math.max(2, mr * k), 0, Math.PI * 2);
      g.fill();
    }
  }, [cenario]);
  return <canvas ref={ref} className="arena-previa-cenario" width={PREVIA_W} height={PREVIA_H} aria-hidden="true" />;
}
const PREVIA_W = 120;
const PREVIA_H = Math.round((PREVIA_W * MUNDO_H) / MUNDO_W);

/**
 * O CENÁRIO NA LARGADA (20/11/2026): sorteado de fábrica (o "?"), ou um dos quatro pela miniatura. O servidor já aceitava
 * `corpo.cenario` (server/src/arena/motor.ts); sem ele, sorteia.
 */
function EscolhaDoCenario({ cenario, aoMudar }: { cenario: Cenario | null; aoMudar: (c: Cenario | null) => void }) {
  const t = useT();
  return (
    <div className="arena-cenarios" role="radiogroup" aria-label={t('Mapa')}>
      <button type="button" role="radio" aria-checked={cenario === null} className={'arena-cenario' + (cenario === null ? ' escolhido' : '')} onClick={() => aoMudar(null)} title={t('Sorteado')} aria-label={t('Sorteado')}>
        <span className="arena-cenario-sorteio" aria-hidden="true">
          ?
        </span>
      </button>
      {CENARIOS.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={cenario === c}
          className={'arena-cenario' + (cenario === c ? ' escolhido' : '')}
          onClick={() => aoMudar(c)}
          aria-label={`${t('Mapa')} ${i + 1}`}
          title={`${t('Mapa')} ${i + 1}`}
        >
          <PreviaDoCenario cenario={c} />
        </button>
      ))}
    </div>
  );
}

/** A DIFICULDADE DOS ROBÔS NO SOLO (20/11/2026; o servidor: ROBO_DA_ARENA em server/src/arena/motor.ts), lembrada no aparelho. */
const DIFICULDADES = ['facil', 'medio', 'dificil'] as const;
type Dificuldade = (typeof DIFICULDADES)[number];
const NOME_DA_DIFICULDADE: Record<Dificuldade, string> = { facil: chave('Fácil'), medio: chave('Médio'), dificil: chave('Difícil') };
const DIFICULDADE_GUARDADA = 'syden:arenaDificuldade';
function lerDificuldade(): Dificuldade {
  try {
    const g = localStorage.getItem(DIFICULDADE_GUARDADA);
    return (DIFICULDADES as readonly string[]).includes(g ?? '') ? (g as Dificuldade) : 'medio';
  } catch {
    return 'medio';
  }
}

export function EscolhaDosBichos({ solo, aoEscolher, aoVoltar }: { solo: boolean; aoEscolher: (e: ModoDosBichos) => void; aoVoltar: () => void }) {
  const t = useT();
  const [arena, setArena] = useState(false);
  const [dificuldade, setDificuldade] = useState<Dificuldade>(lerDificuldade);
  const escolherDificuldade = (d: Dificuldade) => {
    setDificuldade(d);
    try {
      localStorage.setItem(DIFICULDADE_GUARDADA, d);
    } catch {
      /* sem o aparelho guardar, vale só agora */
    }
  };
  // o modo de objetivo (19/11/2026): segurar a zona do meio, em vez de lutar até sobrar um
  const [zona, setZona] = useState(false);
  // AS ONDAS (21/11/2026), só no Solo: o time contra ondas de robôs cada vez mais fortes
  const [ondas, setOndas] = useState(false);
  const [cenario, setCenario] = useState<Cenario | null>(null);
  if (!arena) {
    return (
      <div className="tab-escolha arena-escolha">
        <ul className="tab-rodadas arena-modos">
          <li>
            <button type="button" className="cid-robos-botao" onClick={() => aoEscolher({ modo: 'turnos', corpo: {} })}>
              <span className="arena-modo-figura" aria-hidden="true">
                <Retrato especie="brotel" tamanho={40} />
                <span className="mesa-dos-robos-contra">×</span>
                <Retrato especie="tisco" tamanho={40} />
              </span>
              <span>{solo ? t('Aventura') : t('Mesa')}</span>
            </button>
          </li>
          <li>
            <button type="button" className="cid-robos-botao" onClick={() => setArena(true)}>
              <span className="arena-modo-figura" aria-hidden="true">
                <MesaDosRobos lados={[['eu'], [solo ? 'robo' : 'eu']]} />
              </span>
              <span>{t('Arena')}</span>
            </button>
          </li>
        </ul>
        <div className="minijogo-acoes">
          <button type="button" className="btn-secondary" onClick={aoVoltar}>
            {t('Outros jogos')}
          </button>
        </div>
      </div>
    );
  }
  const opcoes = solo ? (ondas ? OPCOES_DAS_ONDAS : OPCOES_DO_SOLO) : OPCOES_DA_SALA;
  return (
    <div className="tab-escolha arena-escolha">
      {solo && <p className="minijogo-situacao">{t('Quantos adversários do computador?')}</p>}
      <div className="minijogo-acoes">
        <button type="button" className={zona ? 'btn-primary' : 'btn-secondary'} aria-pressed={zona} onClick={() => (setZona((z) => !z), setOndas(false))}>
          🚩 {t('Segurar a zona')}
        </button>
        {solo && (
          <button type="button" className={ondas ? 'btn-primary' : 'btn-secondary'} aria-pressed={ondas} onClick={() => (setOndas((o) => !o), setZona(false))}>
            🌊 {t('Ondas')}
          </button>
        )}
      </div>
      <EscolhaDoCenario cenario={cenario} aoMudar={setCenario} />
      {solo && !ondas && (
        <div className="minijogo-abas arena-dificuldade" role="radiogroup" aria-label={t('Computador')}>
          {DIFICULDADES.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={dificuldade === d} className={dificuldade === d ? 'ativa' : undefined} onClick={() => escolherDificuldade(d)}>
              {t(NOME_DA_DIFICULDADE[d])}
            </button>
          ))}
        </div>
      )}
      <ul className="tab-rodadas cid-robos">
        {opcoes.map((o) => (
          <li key={o.rotulo}>
            <button
              type="button"
              className="cid-robos-botao"
              aria-label={o.rotulo}
              title={o.rotulo}
              onClick={() => aoEscolher({ modo: 'arena', corpo: { formato: o.formato, ...('robos' in o ? { robos: o.robos } : {}), ...(zona ? { objetivo: 'zona' } : ondas ? { objetivo: 'ondas' } : {}), ...(cenario ? { cenario } : {}), ...(solo ? { dificuldade } : {}) } })}
            >
              <MesaDosRobos lados={o.lados} />
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={() => setArena(false)}>
          {t('Voltar')}
        </button>
      </div>
    </div>
  );
}
