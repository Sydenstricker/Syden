import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  CHAO,
  desenharArrancada,
  desenharAviso,
  desenharBarraDoChefe,
  desenharBarraDoEspecial,
  desenharBicho,
  desenharCoelho,
  desenharEfeito,
  desenharGiro,
  desenharOndas,
  desenharRastro,
  desenharSeta,
  desenhoDoCoelho,
  folhaDe,
  H,
  naTela,
  sombra,
  W,
  type Efeito,
} from './briga/desenho';
import { desenharCenario } from './briga/cenarios';
import { bicho, CAMPANHA, CORPO, FASES_DA_BRIGA, pistaDaBriga, type TipoDeInimigo } from './briga/fases';
import { alturaDoBicho, carregarFolhas, desenhaPelaFolha, desenharBichoDaFolha, desenharTiro } from './briga/sprites';
import { nomeDaPistaEm } from './corrida/nomes';
import {
  acaoAtiva,
  ACOES,
  apanhar,
  apanhavel,
  ARENA_L,
  cargaDoEspecial,
  comandosVazios,
  contarDesde,
  encosta,
  ESTADOS,
  ehQuadro,
  golpeAtivo,
  LinhaDoTempo,
  marcaDoLugar,
  misturar,
  novoCoelho,
  ONDAS_X,
  passoDoCoelho,
  pilotoAutomatico,
  TIPOS,
  ToqueDuplo,
  type Acao,
  type Comandos,
  type InimigoNaTela,
  type Quadro,
} from './briga/regras';
import { Trophy } from 'lucide-react';
import { useT } from './i18n';
import type { EstadoBriga, Partida } from './minijogos';

/**
 * A BRIGA NA HORTA (03/11/2026, server/src/minijogo-briga.ts): briga de rua de lado, com a turma, contra os bichos de cada
 * fase. Só a mecânica dos fliperamas de quatro jogadores do começo dos anos 90; o cenário é daqui (briga/desenho.ts,
 * cenarios.ts), os bichos são os monstros da Quaternius renderizados de lado (briga/sprites.ts) e o coelho é o mascote 3D.
 *
 * O MEU COELHO ANDA AQUI, NA HORA (briga/regras.ts, passoDoCoelho), e a posição vai ao servidor ~15 vezes por segundo. Os
 * inimigos e os outros coelhos chegam no quadro do servidor (20 por segundo) e são desenhados ~100 ms atrás, interpolados.
 * Quando o MEU golpe encosta num inimigo COMO ELE ESTÁ NA MINHA TELA, o acerto vai ao servidor, que confere. O que me acerta,
 * o servidor decide (com uma folga: ver o topo do minijogo-briga.ts) e avisa; aí o coelho vai para trás.
 */

const FIM_DA_FASE = ONDAS_X[ONDAS_X.length - 1] + ARENA_L;
const ENVIO_MS = 66;

declare global {
  interface Window {
    /** Só no desenvolvimento: o coelho anda e bate sozinho (e2e/briga.mjs). */
    brigaPilotoAutomatico?: boolean;
  }
}

/**
 * O teclado: setas ou WASD andam (as duas iguais em tudo, inclusive no toque duplo da arrancada), X/J bate, Z/K/Espaço pula,
 * C/L é o especial.
 */
function useTeclado(ativo: boolean, cmd: Comandos) {
  useEffect(() => {
    if (!ativo) return;
    const duplo = new ToqueDuplo();
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (apertada && (e.ctrlKey || e.metaKey || e.altKey)) return;
      const k = e.key.toLowerCase();
      let usou = true;
      // o aperto NOVO de um lado (não o repetido de quem segura) conta para o toque duplo: o segundo é a arrancada
      const lado = k === 'arrowleft' || k === 'a' ? -1 : k === 'arrowright' || k === 'd' ? 1 : 0;
      if (lado && apertada && !e.repeat && duplo.apertou(lado, performance.now())) cmd.arrancada = lado;
      if (lado < 0) cmd.esquerda = apertada;
      else if (lado > 0) cmd.direita = apertada;
      else if (k === 'arrowup' || k === 'w') cmd.cima = apertada;
      else if (k === 'arrowdown' || k === 's') cmd.baixo = apertada;
      else if (k === 'x' || k === 'j') {
        if (apertada && !e.repeat) cmd.soco = true;
      } else if (k === 'z' || k === 'k' || k === ' ') {
        if (apertada && !e.repeat) cmd.pulo = true;
      } else if (k === 'c' || k === 'l') {
        if (apertada && !e.repeat) cmd.especial = true;
      } else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    // trocou de janela com a tecla apertada: o "soltar" vai para a outra janela, e o coelho seguiria andando
    const soltar = () => Object.assign(cmd, comandosVazios());
    const escondeu = () => document.hidden && soltar();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
      document.removeEventListener('visibilitychange', escondeu);
      soltar();
    };
  }, [ativo, cmd]);
}

interface Hud {
  linhas: { userId: number; hp: number; vidas: number; pontos: number; estado: number; doeu: boolean }[];
  fase: Quadro['f'] | null;
  meuEstado: number;
  voltaEm: number;
  /** A fase que está na tela (o índice em FASES_DA_BRIGA), e desde quando (o nome dela aparece no começo). */
  cenario: number;
  cenarioDesde: number;
}

/** O que aparece no fim: a horta tem as frases dela; as outras fases e a campanha, vitória ou derrota. */
const desfecho = (t: (s: string) => string, categoria: string | undefined, venceu: boolean) =>
  !categoria || categoria === 'horta' ? (venceu ? t('A horta está salva!') : t('A horta caiu.')) : venceu ? t('Vitória!') : t('Derrota');

/** O nome de uma fase, ou da campanha, já traduzido (os das pistas da estante de troféus: "Floresta", "Neve"...). */
export const nomeDaFaseDaBriga = (t: (s: string) => string, id: string) => (id === 'horta' ? nomeDaPistaEm(t, 'horta-1') : nomeDaPistaEm(t, pistaDaBriga(id)));

export function JogoBriga({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoBriga & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    // A POSIÇÃO É A DO SERVIDOR (só entre quem ficou até o fim; empatados dividem; null para quem saiu), e a medalha só sai
    // quando o troféu também sai (marcaDoLugar). Sem o resultado (a partida caiu antes), a ordem dos pontos, sem medalha.
    const doServidor = estado.resultado as (NonNullable<EstadoBriga['resultado']>[number] & { posicao?: number | null })[] | null;
    const linhas = doServidor
      ? doServidor.map((l) => ({ ...l, posicao: l.posicao ?? null }))
      : estado.jogadores.map((j) => ({ ...j, posicao: 1 + estado.jogadores.filter((o) => o.pontos > j.pontos).length }));
    const regra = { venceu: !!doServidor && estado.venceu, solo: estado.solo === true, ficaram: linhas.filter((l) => l.posicao !== null).length };
    return (
      <div className="briga">
        <p className="briga-desfecho">{desfecho(t, (estado as { categoria?: string }).categoria, estado.venceu)}</p>
        <div className="minijogo-fim">
          <p className="minijogo-fim-titulo">
            <Trophy size={20} aria-hidden="true" /> {t('Fim de jogo!')}
          </p>
          <ol className="minijogo-placar">
            {linhas.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha">{marcaDoLugar(l.posicao, l.pontos, regra)}</span>
                <span className="minijogo-nome">{l.username}</span>
                <span className="minijogo-pontos">{l.pontos}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }
  // uma partida nova é um palco novo (a linha do tempo e o meu coelho recomeçam: o "Jogar de novo" mantém o socket)
  return <Palco key={estado.partidaId} estado={estado} eu={eu} jogador={jogador && estado.jogadores.some((j) => j.userId === eu)} socket={socket} channelId={channelId} />;
}

function Palco({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoBriga & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cmd] = useState(comandosVazios);
  const [hud, setHud] = useState<Hud>({ linhas: [], fase: null, meuEstado: 0, voltaEm: 0, cenario: -1, cenarioDesde: 0 });
  const [agora, setAgora] = useState(Date.now);
  const solo = estado.solo === true;
  useTeclado(jogador, cmd);

  // os nomes e os avatares vêm do estado (o quadro só tem números)
  const pessoas = useRef(new Map<number, { nome: string; avatar: number | null }>());
  for (const j of estado.jogadores) pessoas.current.set(j.userId, { nome: j.username, avatar: j.avatar });

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g || !socket) return;
    g.imageSmoothingEnabled = false;
    const folha = new Image();
    folha.src = `${import.meta.env.BASE_URL}briga/coelho.png`;
    const linha = new LinhaDoTempo();
    const eu_ = novoCoelho(40, 20);
    const efeitos: Efeito[] = [];
    const vistos = new Set<number>();
    const piscandoOutros = new Map<number, number>();
    const piscandoInimigo = new Map<number, number>();
    // quando cada um apanhou por último: a barra de vida do placar fica vermelha um instante
    const apanhouEm = new Map<number, number>();
    let voltaEm = 0;
    let ultimoEnvio = 0;
    let ultimoHud = 0;
    let anterior = performance.now();
    let sobra = 0;
    let quadroId = 0;
    let camX = 0;
    let posicionado = false;
    let cenario = -1;
    let cenarioDesde = 0;

    const enviar = (dados: unknown) =>
      solo ? socket.emit('minijogo-solo:tempo-real', { dados }) : socket.emit('minijogo:tempo-real', { channelId, dados });
    const mandarPosicao = (ataque?: { id: number; golpe: string }) => {
      ultimoEnvio = performance.now();
      enviar({
        tipo: 'pos',
        x: Math.round(eu_.x * 10) / 10,
        y: Math.round(eu_.y * 10) / 10,
        z: Math.round(eu_.z * 10) / 10,
        lado: eu_.lado,
        acao: ACOES.indexOf(eu_.acao),
        ta: Math.round(eu_.t),
        ...(ataque ? { ataque: { id: ataque.id, g: ataque.golpe } } : {}),
      });
    };

    const aoQuadro = (m: { channelId?: number; dados?: unknown }) => {
      if (!solo && m.channelId !== channelId) return;
      const q = m.dados;
      if (!ehQuadro(q)) return;
      const agoraMs = performance.now();
      linha.chegou(q, agoraMs);
      const meu = q.j.find((l) => l[0] === eu);
      if (meu) {
        eu_.hp = meu[7];
        // a conta dos golpes continua da do servidor (a página recarregada recomeçava do 1, e nada valia)
        contarDesde(eu_, meu[12]);
        // a primeira vez: o coelho começa onde o servidor o pôs
        if (!posicionado) {
          posicionado = true;
          eu_.x = meu[1];
          eu_.y = meu[2];
        }
      }
      for (const e of q.e) {
        const [id, tipo, ...r] = e as [number, string, ...number[]];
        if (vistos.has(id)) continue;
        vistos.add(id);
        if (vistos.size > 500) vistos.delete(vistos.values().next().value as number);
        if (tipo === 'h') {
          const [ini, quem, , x, y, z] = r as unknown as number[];
          piscandoInimigo.set(ini, agoraMs + 140);
          // o meu acerto eu já mostrei na hora
          if (quem !== eu) efeitos.push({ tipo: 'faisca', x, y, z, em: agoraMs + 100 });
        } else if (tipo === 'p' && r[0] === eu) {
          apanhar(eu_, r[2] === 1, r[3]);
          apanhouEm.set(eu, agoraMs);
          efeitos.push({ tipo: 'faisca', x: eu_.x, y: eu_.y, z: eu_.z, em: agoraMs });
        } else if (tipo === 'p') {
          piscandoOutros.set(r[0], agoraMs + 400);
          apanhouEm.set(r[0], agoraMs);
          const outro = q.j.find((l) => l[0] === r[0]);
          if (outro) efeitos.push({ tipo: 'faisca', x: outro[1], y: outro[2], z: outro[3], em: agoraMs + 100 });
        } else if (tipo === 'k' && r[0] === eu) {
          eu_.hp = 0;
          eu_.acao = 'caido';
          eu_.t = 0;
          voltaEm = r[1] > 0 ? Date.now() + 3000 : 0;
        } else if (tipo === 'r' && r[0] === eu) {
          // a barra do especial continua de onde estava (o servidor também guarda o último giro)
          Object.assign(eu_, novoCoelho(r[1], r[2]), { ataque: eu_.ataque, relogio: eu_.relogio, ultimoEspecial: eu_.ultimoEspecial });
          eu_.piscandoAte = eu_.relogio + 2000;
        } else if (tipo === 'x') {
          const ini = q.i.find((l) => l[0] === r[0]);
          if (ini) efeitos.push({ tipo: 'poeira', x: ini[2], y: ini[3], z: 0, em: agoraMs + 100 });
        }
      }
    };
    const evento = solo ? 'minijogo-solo:tempo-real' : 'minijogo:tempo-real';
    socket.on(evento, aoQuadro);

    const quadro = () => {
      quadroId = requestAnimationFrame(quadro);
      const agoraMs = performance.now();
      const dt = Math.min(0.1, (agoraMs - anterior) / 1000);
      anterior = agoraMs;
      const ultimo = linha.ultimo();
      const arena: [number, number] = ultimo ? ultimo.a : [0, ARENA_L];
      const fase = ultimo?.f ?? null;
      const meuEstado = ultimo?.j.find((l) => l[0] === eu)?.[10] ?? 0;
      const jogando = jogador && (fase === 'lutando' || fase === 'avancando') && meuEstado === 0;

      // o que está na tela agora: os inimigos e os outros, interpolados
      const volta = linha.emVolta(linha.passoNaTela(agoraMs));
      const inimigos = volta ? misturar(volta.a.i, volta.b.i, volta.k, [2, 3, 4]) : [];
      const outros = volta ? misturar(volta.a.j, volta.b.j, volta.k, [1, 2, 3]) : [];
      const naTelaAgora: InimigoNaTela[] = inimigos.map((l) => ({
        id: l[0],
        tipo: TIPOS[l[1]] ?? 'raposa',
        x: l[2],
        y: l[3],
        z: l[4],
        estado: ESTADOS[l[5]] ?? 'andando',
        faixa: l[9],
        alvoX: l[10],
      }));
      // os tiros no ar, interpolados como os bichos: [id, tipo, x, y, lado]
      const tiros = volta ? misturar(volta.a.t ?? [], volta.b.t ?? [], volta.k, [2]) : [];
      // a fase na tela: as folhas dos bichos dela já pedidas, e o nome dela aparece quando muda
      const fs = ultimo?.fs ?? 0;
      if (ultimo && fs !== cenario) {
        cenario = fs;
        cenarioDesde = agoraMs;
        const f = FASES_DA_BRIGA[fs];
        if (f) carregarFolhas([f.chefe, ...f.ondas.flatMap((o) => Object.keys(o) as TipoDeInimigo[])]);
        ultimoHud = 0;
      }

      // O MEU COELHO: passos fixos de 1/60 s
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        if (!jogando) continue;
        if (import.meta.env.DEV && window.brigaPilotoAutomatico) pilotoAutomatico(eu_, naTelaAgora, cmd, eu_.relogio, tiros.map((l) => ({ x: l[2], y: l[3], lado: l[4] })));
        const novo = passoDoCoelho(eu_, cmd, 1 / 60, arena);
        if (novo.comecou) {
          // o golpe que começou vai na hora, antes de qualquer acerto dele
          mandarPosicao(novo.comecou);
          tocar(novo.comecou.golpe === 'especial' ? 'combo' : 'soco');
        }
        // a arrancada também vai na hora: o servidor dá a folga de distância dela a partir dessa posição
        if (novo.arrancou) mandarPosicao();
        if (golpeAtivo(eu_) && eu_.golpe) {
          for (const i of naTelaAgora) {
            if (eu_.acertados.has(i.id) || !apanhavel(i, eu_.golpe) || !encosta(eu_.golpe, eu_.x, eu_.y, eu_.z, eu_.lado, i)) continue;
            eu_.acertados.add(i.id);
            // no giro, a volta (`v`) vai junto: cada volta pega cada inimigo uma vez, e o servidor confere a hora dela
            enviar({
              tipo: 'golpe',
              a: eu_.ataque,
              inimigo: i.id,
              x: Math.round(eu_.x * 10) / 10,
              y: Math.round(eu_.y * 10) / 10,
              z: Math.round(eu_.z),
              ...(eu_.golpe === 'especial' ? { v: eu_.volta } : {}),
            });
            efeitos.push({ tipo: 'faisca', x: i.x, y: i.y, z: i.z, em: agoraMs });
            piscandoInimigo.set(i.id, agoraMs + 140);
          }
        }
      }
      if (jogando && agoraMs - ultimoEnvio >= ENVIO_MS) mandarPosicao();

      // A CÂMERA: a arena da onda; com a seta, segue quem joga (ou a turma, para quem assiste)
      const vivos = outros.filter((l) => l[10] === 0);
      const foco = jogador ? eu_.x : vivos.length ? vivos.reduce((s, l) => s + l[1], 0) / vivos.length : arena[0] + ARENA_L / 2;
      const alvoCam = Math.max(arena[0], Math.min(arena[1] - ARENA_L, foco - ARENA_L / 2));
      camX += (alvoCam - camX) * Math.min(1, dt * 6);
      const cam = Math.round(camX);

      // O DESENHO, do fundo para a frente (quem está mais à frente na faixa é desenhado por cima)
      desenharCenario(g, fs, cam, FIM_DA_FASE, agoraMs);
      const coisas: { y: number; desenhar: () => void }[] = [];
      for (const l of inimigos) {
        const tipo = TIPOS[l[1]] ?? 'raposa';
        const est = ESTADOS[l[5]] ?? 'andando';
        const { sx, sy } = naTela(cam, l[2], l[3], l[4]);
        const chao = CHAO + Math.round(l[3]);
        const comp = bicho(tipo).comp;
        const daFolha = desenhaPelaFolha(tipo);
        coisas.push({
          y: l[3],
          desenhar: () => {
            sombra(g, sx, chao, tipo === 'texugo' ? 36 : tipo === 'corvo' ? 12 : tipo === 'raposa' ? 18 : CORPO[tipo] * 2, l[4]);
            const queda = comp === 'pulo' ? Math.round((l[10] ?? l[2]) - cam) : undefined;
            desenharAviso(g, tipo, est, sx, CHAO + Math.round(comp !== 'soco' ? l[9] ?? l[3] : l[3]), l[6], agoraMs, chao, queda);
            const piscando = (piscandoInimigo.get(l[0]) ?? 0) > agoraMs;
            if (daFolha) desenharBichoDaFolha(g, { tipo, estado: est, lado: l[6], ms: l[8] * 50, piscando }, sx, sy, agoraMs);
            else desenharBicho(g, { tipo, estado: est, lado: l[6], passos: l[8], hp: l[7], piscando }, sx, sy, agoraMs);
            if (comp !== 'chefe' && l[7] < 100 && est !== 'morto') {
              const alto = daFolha ? alturaDoBicho(tipo) + 5 : tipo === 'corvo' ? 22 : 54;
              g.fillStyle = '#2a1e1a';
              g.fillRect(sx - 8, sy - alto, 16, 3);
              g.fillStyle = '#e2574a';
              g.fillRect(sx - 7, sy - alto + 1, Math.round((14 * l[7]) / 100), 1);
            }
          },
        });
      }
      for (const l of tiros) {
        const tipo = TIPOS[l[1]] ?? 'dino';
        const { sx, sy } = naTela(cam, l[2], l[3], 12);
        coisas.push({
          y: l[3],
          desenhar: () => {
            sombra(g, sx, CHAO + Math.round(l[3]), 6, 12);
            desenharTiro(g, tipo, sx, sy, l[4], agoraMs);
          },
        });
      }
      const imagem = folhaDe(folha, null);
      for (const l of outros) {
        if (l[0] === eu && jogador) continue;
        if (l[10] === 2) continue;
        const pessoa = pessoas.current.get(l[0]);
        const acao: Acao = ACOES[l[5]] ?? 'parado';
        const { sx, sy } = naTela(cam, l[1], l[2], l[3]);
        const girando = l[10] === 0 && acao === 'especial';
        coisas.push({
          y: l[2],
          desenhar: () => {
            sombra(g, sx, CHAO + Math.round(l[2]), 18, l[3]);
            if (girando) desenharGiro(g, sx, sy, agoraMs, false);
            if (l[10] === 0 && acao === 'arrancada') desenharArrancada(g, sx, sy, l[4], l[6]);
            const f = folhaDe(folha, pessoa?.avatar ?? (l[11] || null)) ?? imagem;
            desenharCoelho(g, f, sx, sy, l[4], desenhoDoCoelho(l[10] === 1 ? 'caido' : acao, l[10] === 1 ? 999 : l[6], l[3] > 0 && l[6] < 280), {
              nome: pessoa?.nome,
              piscando: (piscandoOutros.get(l[0]) ?? 0) > agoraMs,
            });
            if (l[10] === 0 && acaoAtiva(acao, l[6])) desenharRastro(g, sx, sy, l[4], acao);
            if (girando) desenharGiro(g, sx, sy, agoraMs, true);
          },
        });
      }
      if (jogador) {
        const { sx, sy } = naTela(cam, eu_.x, eu_.y, eu_.z);
        const f = folhaDe(folha, pessoas.current.get(eu)?.avatar ?? null);
        coisas.push({
          y: eu_.y + 0.01,
          desenhar: () => {
            sombra(g, sx, CHAO + Math.round(eu_.y), 18, eu_.z);
            const acao: Acao = meuEstado !== 0 ? 'caido' : eu_.acao;
            if (acao === 'especial') desenharGiro(g, sx, sy, agoraMs, false);
            if (acao === 'arrancada') desenharArrancada(g, sx, sy, eu_.lado, eu_.t);
            desenharCoelho(g, f, sx, sy, eu_.lado, desenhoDoCoelho(acao, meuEstado !== 0 ? 999 : eu_.t, eu_.vz > 0), {
              nome: outros.length > 1 ? pessoas.current.get(eu)?.nome : undefined,
              eu: true,
              piscando: eu_.relogio < eu_.piscandoAte,
            });
            if (meuEstado === 0 && golpeAtivo(eu_)) desenharRastro(g, sx, sy, eu_.lado, eu_.acao);
            if (acao === 'especial') desenharGiro(g, sx, sy, agoraMs, true);
          },
        });
      }
      coisas.sort((a, b) => a.y - b.y).forEach((c_) => c_.desenhar());
      for (let k = efeitos.length - 1; k >= 0; k--) if (!desenharEfeito(g, efeitos[k], cam, agoraMs)) efeitos.splice(k, 1);
      const chefe = inimigos.find((l) => bicho(TIPOS[l[1]] ?? 'raposa').comp === 'chefe');
      if (chefe) desenharBarraDoChefe(g, chefe[7]);
      if (ultimo) desenharOndas(g, ultimo.o, ONDAS_X.length);
      if (fase === 'avancando') desenharSeta(g, agoraMs);
      // a barra do especial de quem joga: enche com a recarga, e cheia ele sai
      if (jogador && meuEstado === 0) desenharBarraDoEspecial(g, cargaDoEspecial(eu_), agoraMs);

      // o placar de cima, umas 5 vezes por segundo
      if (agoraMs - ultimoHud > 200 && ultimo) {
        ultimoHud = agoraMs;
        setHud({
          linhas: ultimo.j.map((l) => ({ userId: l[0], hp: l[7], vidas: l[8], pontos: l[9], estado: l[10], doeu: agoraMs - (apanhouEm.get(l[0]) ?? -1e9) < 450 })),
          fase,
          meuEstado,
          voltaEm,
          cenario,
          cenarioDesde: Date.now() - (agoraMs - cenarioDesde),
        });
        setAgora(Date.now());
      }
    };
    quadroId = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(quadroId);
      socket.off(evento, aoQuadro);
      Object.assign(cmd, comandosVazios());
    };
  }, [socket, channelId, solo, eu, jogador, cmd]);

  const nome = (id: number) => pessoas.current.get(id)?.nome ?? '';
  const categoria = (estado as { categoria?: string }).categoria;
  const aviso =
    hud.fase === 'vitoria' || hud.fase === 'derrota'
      ? desfecho(t, categoria, hud.fase === 'vitoria')
      : jogador && hud.meuEstado === 2
          ? t('Sem vidas.')
          : jogador && hud.meuEstado === 1 && hud.voltaEm > 0
            ? t('Você volta em {n}…', { n: Math.max(1, Math.ceil((hud.voltaEm - agora) / 1000)) })
            : null;

  return (
    <div className="briga">
      <ul className="briga-hud" aria-live="off">
        {hud.linhas.map((l) => (
          <li key={l.userId} className={[l.userId === eu ? 'eu' : '', l.doeu ? 'doeu' : ''].filter(Boolean).join(' ') || undefined}>
            <span className="minijogo-nome">{nome(l.userId)}</span>
            <span className="briga-vida" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, l.hp))}%` }} />
            </span>
            <span className="briga-vidas" aria-hidden="true">
              {'♥'.repeat(Math.max(0, l.vidas))}
            </span>
            <strong>{l.pontos}</strong>
          </li>
        ))}
      </ul>
      <div className="briga-tela">
        <canvas ref={canvas} width={W} height={H} />
        {aviso && <p className="briga-aviso">{aviso}</p>}
        {/* o nome da fase, no começo dela (na campanha, a cada fase nova) */}
        {!aviso && hud.cenario >= 0 && agora - hud.cenarioDesde < 2500 && (
          <p className="briga-aviso briga-titulo">{nomeDaFaseDaBriga(t, FASES_DA_BRIGA[hud.cenario]?.id ?? 'horta')}</p>
        )}
      </div>
      {jogador && <Toque cmd={cmd} />}
      {jogador && (
        <ComandosDoJogo
          itens={[
            // as setas e o WASD fazem o mesmo (pedido dele, 09/11/2026: "os comandos WASD deveriam ter ícones")
            { teclas: ['setas', 'wasd'], rotulo: t('Andar') },
            // dois toques para o mesmo lado (as duas figuras dizem "duas vezes"; A/D também)
            { teclas: ['setas-lado', 'setas-lado'], rotulo: t('Arrancada') },
            { teclas: ['z'], rotulo: t('Pular') },
            { teclas: ['x'], rotulo: t('Bater') },
            { teclas: ['c'], rotulo: t('Especial') },
          ]}
        />
      )}
    </div>
  );
}

/** Os botões da tela de toque: o direcional à esquerda, e bater, pular e o especial à direita. */
function Toque({ cmd }: { cmd: Comandos }) {
  const t = useT();
  const [duplo] = useState(() => new ToqueDuplo());
  const segurar = (k: 'esquerda' | 'direita' | 'cima' | 'baixo') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cmd[k] = true;
      // dois toques no mesmo lado do direcional: a arrancada, como no teclado
      const lado = k === 'esquerda' ? -1 : k === 'direita' ? 1 : 0;
      if (lado && duplo.apertou(lado, performance.now())) cmd.arrancada = lado;
    },
    onPointerUp: () => (cmd[k] = false),
    onPointerCancel: () => (cmd[k] = false),
    onPointerLeave: () => (cmd[k] = false),
  });
  const apertar = (k: 'soco' | 'pulo' | 'especial') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cmd[k] = true;
    },
  });
  return (
    <div className="briga-toque">
      <div className="briga-direcional" role="group" aria-label={t('Andar')}>
        <button type="button" className="briga-cima" aria-hidden="true" tabIndex={-1} {...segurar('cima')}>▲</button>
        <button type="button" className="briga-esq" aria-hidden="true" tabIndex={-1} {...segurar('esquerda')}>◀</button>
        <button type="button" className="briga-dir" aria-hidden="true" tabIndex={-1} {...segurar('direita')}>▶</button>
        <button type="button" className="briga-baixo" aria-hidden="true" tabIndex={-1} {...segurar('baixo')}>▼</button>
      </div>
      <div className="briga-botoes">
        <button type="button" aria-label={t('Especial')} {...apertar('especial')}>✸</button>
        <button type="button" aria-label={t('Pular')} {...apertar('pulo')}>⤒</button>
        <button type="button" aria-label={t('Bater')} {...apertar('soco')}>✊</button>
      </div>
    </div>
  );
}

/** A MINIATURA de uma fase na escolha: o cenário dela, desenhado uma vez (de novo quando as camadas da floresta chegam). */
function MiniaturaDaFase({ indice }: { indice: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    let vezes = 0;
    const desenhar = () => desenharCenario(g, indice, 40, 99_999, 0);
    desenhar();
    // as imagens da floresta chegam depois: desenha de novo algumas vezes, e para
    const h = setInterval(() => {
      desenhar();
      if (++vezes >= 6) clearInterval(h);
    }, 300);
    return () => clearInterval(h);
  }, [indice]);
  return <canvas ref={ref} width={W} height={H} aria-hidden="true" className="briga-miniatura" />;
}

/**
 * A ESCOLHA DA FASE (06/11/2026): no Solo e na sala, quem começa escolhe uma fase ou a campanha (todas seguidas). Todas
 * abertas de fábrica, sem progressão obrigatória, como o resto do Syden.
 */
export function EscolhaDaBriga({ aoEscolher, aoVoltar }: { aoEscolher: (fase: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="corrida-escolha">
      <ul className="corrida-pistas">
        {FASES_DA_BRIGA.map((f, k) => (
          <li key={f.id}>
            <button type="button" className="corrida-pista-botao" onClick={() => aoEscolher(f.id)}>
              <MiniaturaDaFase indice={k} />
              <strong>{nomeDaFaseDaBriga(t, f.id)}</strong>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="corrida-pista-botao copa" onClick={() => aoEscolher(CAMPANHA)}>
            <span className="corrida-copa-mapas" aria-hidden="true">
              <Trophy size={28} />
            </span>
            <strong>{nomeDaFaseDaBriga(t, CAMPANHA)}</strong>
            <small>{FASES_DA_BRIGA.map((f) => nomeDaFaseDaBriga(t, f.id)).join(' · ')}</small>
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
