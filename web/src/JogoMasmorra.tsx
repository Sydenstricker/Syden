import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { desenhoDoCoelho, desenharCoelho, folhaDe } from './briga/desenho';
import { marcaDoLugar } from './briga/regras';
import { carregarFolhas, desenharBichoDaFolha } from './briga/sprites';
import type { TipoDeInimigo } from './briga/fases';
import type { EstadoDoInimigo } from './briga/regras';
import { useT } from './i18n';
import { tempoLegivel } from './corrida/fisica';
import {
  AVISOS,
  desenharBloco,
  desenharCenoura,
  desenharChave,
  desenharCoracao,
  desenharEfeito,
  desenharGolpe,
  desenharMapa,
  desenharSala,
  desenharTiro,
  H,
  sombra,
  W,
  type Efeito,
  desenharBomba,
  desenharSemente,
  desenharVaso,
  desenharGancho,
  desenharCorda,
} from './masmorra/desenho';
import {
  ACOES,
  apanhar,
  BICHOS,
  CENOURA,
  centro,
  comandosVazios,
  CORACOES,
  DIRS,
  ehQuadro,
  ESTADOS,
  mundoDoQuadro,
  novoCoelho,
  PA,
  passoDaCenoura,
  passoDoCoelho,
  piloto,
  SALAS,
  TIPOS,
  type Acao,
  type Cenoura,
  type Comandos,
  type Quadro,
  coisaAFrente,
  ehChefe,
  MASMORRAS,
  type Masmorra,
} from './masmorra/regras';
import type { Partida } from './minijogos';
import { criarImpacto } from './impacto';
import { tocar } from './somDosJogos';
import './masmorra.css';

/**
 * A MASMORRA DA TOCA (16/11/2026, server/src/minijogo-masmorra.ts): aventura de masmorra vista de cima, com a turma. Só a
 * mecânica do gênero; o mapa, as salas e os itens são daqui (masmorra/regras.ts, a mesma cópia do servidor), o desenho é por
 * código (masmorra/desenho.ts), e o coelho e os bichos são as folhas da Briga na horta.
 *
 * A REDE É A DA BRIGA: o MEU coelho anda aqui, na hora (passoDoCoelho), e a posição vai ao servidor ~15 vezes por segundo. Os
 * bichos, os outros coelhos e o mundo (portas, botões, bloco, baú, ponte) chegam no quadro do servidor (20 por segundo),
 * desenhados ~100 ms atrás, interpolados. O MEU golpe que encosta num bicho COMO ELE ESTÁ NA MINHA TELA vai ao servidor, que
 * confere; o que me acerta, o servidor decide (com folga) e avisa.
 */

export interface EstadoMasmorra {
  fase: 'jogando' | 'vitoria' | 'derrota' | 'fim';
  sala: number;
  venceu: boolean;
  jogadores: {
    userId: number;
    username: string;
    avatar: number | string | null;
    pontos: number;
  }[];
  resultado:
    | {
        userId: number;
        username: string;
        pontos: number;
        acertos: number;
        nocautes: number;
        quedas: number;
        posicao: number | null;
      }[]
    | null;
  /** No Solo (19/11/2026): o tempo da masmorra vencida e o recorde de antes (a tabela comum). */
  /** Qual masmorra (19/11/2026): a toca de sempre, ou a mina dos postes. */
  masmorra?: Masmorra;
  /** O heroico (21/11/2026): bichos mais fortes, menos corações. */
  heroico?: boolean;
  /** Os achados (21/11/2026): [quantos a turma achou, quantos há] dos baús e dos segredos. */
  achados?: { baus: [number, number]; segredos: [number, number] };
  recorde?: {
    tempoMs: number | null;
    antes: number | null;
    novo: boolean;
  } | null;
  partidaId: string;
}

declare global {
  interface Window {
    /** Só no desenvolvimento: o coelho anda, bate e resolve a masmorra sozinho (e2e/masmorra.mjs). */
    masmorraPilotoAutomatico?: boolean;
    /** Só no desenvolvimento: o que o e2e confere. */
    masmorraDoTeste?: {
      sala: number;
      x: number;
      y: number;
      servidor: number[];
      tp: number;
      hp: number;
      cenoura: boolean;
      chaves: number;
      ponte: boolean;
      bichos: number;
      fase: string;
    };
  }
}

const ENVIO_MS = 66;
const ATRASO_MS = 100;
const PASSO_MS = 50;

/** A linha do tempo dos quadros: a tela desenha um pouco atrás do mais novo, interpolando (a mesma ideia da Briga). */
class Linha {
  quadros: Quadro[] = [];
  private base = Infinity;
  chegou(q: Quadro, agora: number) {
    const ultimo = this.quadros.at(-1);
    if (ultimo && q.n <= ultimo.n) return;
    // trocou de sala: os quadros da sala de antes não se misturam com os desta
    if (ultimo && ultimo.s !== q.s) this.quadros = [];
    this.quadros.push(q);
    if (this.quadros.length > 40) this.quadros.shift();
    this.base = Math.min(this.base + 0.5, agora - q.n * PASSO_MS);
  }
  emVolta(agora: number): { a: Quadro; b: Quadro; k: number } | null {
    const p = (agora - this.base - ATRASO_MS) / PASSO_MS;
    const qs = this.quadros;
    if (!qs.length) return null;
    if (p <= qs[0].n) return { a: qs[0], b: qs[0], k: 0 };
    for (let i = qs.length - 1; i >= 0; i--) {
      if (qs[i].n <= p) {
        const b = qs[i + 1] ?? qs[i];
        const k = b === qs[i] ? 0 : (p - qs[i].n) / (b.n - qs[i].n);
        return { a: qs[i], b, k: Math.max(0, Math.min(1, k)) };
      }
    }
    return { a: qs[0], b: qs[0], k: 0 };
  }
  ultimo() {
    return this.quadros.at(-1) ?? null;
  }
}

/** Entre duas linhas do quadro (o mesmo id na coluna 0): as colunas dadas andam, o resto é o do mais novo. */
function misturar<T extends unknown[]>(a: T[], b: T[], k: number, colunas: number[]): T[] {
  const antes = new Map(a.map((l) => [l[0], l]));
  return b.map((l) => {
    const v = antes.get(l[0]);
    if (!v) return l;
    const r = [...l] as T;
    for (const c of colunas) r[c] = (v[c] as number) + ((l[c] as number) - (v[c] as number)) * k;
    return r;
  });
}

/** O desenho do coelho na folha da Briga, pela ação daqui. */
const acaoDaFolha = (acao: Acao) => (acao === 'pa' ? 'soco2' : acao === 'cenoura' ? 'soco1' : acao);

/** O teclado: setas ou WASD andam, X/J/Espaço bate com a pá, C/L joga a cenoura, Z/K/Shift é a arrancada. */
function useTeclado(ativo: boolean, cmd: Comandos) {
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
      else if (k === 'x' || k === 'j' || k === ' ') {
        if (apertada && !e.repeat) cmd.golpe = true;
      } else if (k === 'c' || k === 'l') {
        if (apertada && !e.repeat) cmd.item = true;
      } else if (k === 'z' || k === 'k' || k === 'shift') {
        if (apertada && !e.repeat) cmd.arrancada = true;
      } else if (k === 'b' || k === 'v' || k === 'q') {
        // a bomba de semente (19/11/2026)
        if (apertada && !e.repeat) cmd.bomba = true;
      } else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
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

/** O heroico escolhido da última vez, lembrado no aparelho. */
const HEROICO_GUARDADO = 'syden:masmorra-heroico';

/**
 * A ESCOLHA DA MASMORRA (19/11/2026): a toca de sempre, ou a mina dos postes (com o gancho). Desde 21/11/2026, o HEROICO: a
 * masmorra vai como "toca-heroico" ou "mina-heroico" (o servidor entende, e o "Jogar de novo" manda o mesmo de volta).
 */
export function EscolhaDaMasmorra({ aoEscolher, aoVoltar }: { aoEscolher: (m: string) => void; aoVoltar: () => void }) {
  const t = useT();
  const [heroico, setHeroico] = useState(() => {
    try {
      return localStorage.getItem(HEROICO_GUARDADO) === '1';
    } catch {
      return false;
    }
  });
  const escolher = (m: Masmorra) => {
    try {
      localStorage.setItem(HEROICO_GUARDADO, heroico ? '1' : '0');
    } catch {
      // sem armazenamento: só não lembra
    }
    aoEscolher(heroico ? `${m}-heroico` : m);
  };
  const opcoes: { id: Masmorra; nome: string; cor: string }[] = [
    { id: 'toca', nome: t('Toca do rei-cogumelo'), cor: '#5e4e46' },
    { id: 'mina', nome: t('Mina dos postes'), cor: '#7b4f2e' },
  ];
  return (
    <div className="corrida-escolha">
      <fieldset className="mesa-grupo">
        <legend>{t('Dificuldade')}</legend>
        <div className="mesa-botoes">
          {([false, true] as const).map((h) => (
            <button
              key={String(h)}
              type="button"
              className={`tab-rodadas-botao${heroico === h ? ' escolhida' : ''}`}
              aria-pressed={heroico === h}
              onClick={() => {
                tocar('clique');
                setHeroico(h);
              }}
            >
              {h ? t('Heroico') : t('Normal')}
            </button>
          ))}
        </div>
      </fieldset>
      <ul className="corrida-pistas">
        {opcoes.map((o) => (
          <li key={o.id}>
            <button type="button" className="corrida-pista-botao" onClick={() => escolher(o.id)}>
              <span className="masmorra-escolha-cor" style={{ background: o.cor }} aria-hidden="true" />
              <strong>{o.nome}</strong>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}

export function JogoMasmorra({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoMasmorra & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const doServidor = estado.resultado;
    const linhas = doServidor
      ? doServidor
      : estado.jogadores.map((j) => ({
          ...j,
          posicao: 1 + estado.jogadores.filter((o) => o.pontos > j.pontos).length,
        }));
    const regra = {
      venceu: !!doServidor && estado.venceu,
      solo: estado.solo === true,
      ficaram: linhas.filter((l) => l.posicao !== null).length,
    };
    return (
      <div className="masmorra">
        <p className="briga-desfecho">{estado.venceu ? t('Vitória!') : t('Derrota')}</p>
        {estado.achados && (
          <p className="minijogo-situacao masmorra-achados">
            <span>{t('Baús: {n}/{total}', { n: estado.achados.baus[0], total: estado.achados.baus[1] })}</span>{' '}
            <span>{t('Segredos: {n}/{total}', { n: estado.achados.segredos[0], total: estado.achados.segredos[1] })}</span>
          </p>
        )}
        {estado.recorde?.tempoMs != null && (
          <p className="minijogo-situacao">
            {estado.recorde.novo ? t('Novo recorde!') : null} <span className="corrida-relogio">{tempoLegivel(estado.recorde.tempoMs)}</span>
          </p>
        )}
        {estado.recorde && !estado.recorde.novo && estado.recorde.antes !== null && (
          <p className="settings-hint">
            {t('Seu recorde: {tempo}', {
              tempo: tempoLegivel(estado.recorde.antes),
            })}
          </p>
        )}
        <div className="minijogo-fim">
          <p className="minijogo-fim-titulo">
            <Trophy size={20} aria-hidden="true" /> {t('Fim de jogo!')}
          </p>
          <ol className="minijogo-placar">
            {linhas.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha">{marcaDoLugar(l.posicao ?? null, l.pontos, regra)}</span>
                <span className="minijogo-nome">{l.username}</span>
                <span className="minijogo-pontos">{l.pontos}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }
  return (
    <Palco key={estado.partidaId} estado={estado} eu={eu} jogador={jogador && estado.jogadores.some((j) => j.userId === eu)} socket={socket} channelId={channelId} />
  );
}

interface Hud {
  linhas: {
    userId: number;
    hp: number;
    hpMax: number;
    pontos: number;
    estado: number;
    doeu: boolean;
  }[];
  fase: Quadro['f'] | null;
  meuEstado: number;
  voltaEm: number;
}

function Palco({ estado, eu, jogador, socket, channelId }: { estado: EstadoMasmorra & Partida; eu: number; jogador: boolean; socket: Socket | null; channelId: number }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cmd] = useState(comandosVazios);
  const [hud, setHud] = useState<Hud>({
    linhas: [],
    fase: null,
    meuEstado: 0,
    voltaEm: 0,
  });
  const [agora, setAgora] = useState(Date.now);
  const solo = estado.solo === true;
  useTeclado(jogador, cmd);
  const pessoas = useRef(new Map<number, { nome: string; avatar: number | string | null }>());
  for (const j of estado.jogadores) pessoas.current.set(j.userId, { nome: j.username, avatar: j.avatar });

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g || !socket) return;
    g.imageSmoothingEnabled = false;
    // o golem-rei é a folha do golem, em dobro (21/11/2026)
    carregarFolhas(['cogumelo', 'cacto', 'sapo', 'rei-cogumelo', 'abelha', 'fantasma', 'golem'] as TipoDeInimigo[]);
    const folha = new Image();
    folha.src = `${import.meta.env.BASE_URL}briga/coelho.png`;
    const linha = new Linha();
    const eu_ = novoCoelho(0, 0);
    const efeitos: Efeito[] = [];
    const vistos = new Set<number>();
    const piscando = new Map<number, number>();
    const apanhouEm = new Map<number, number>();
    let tp = -1;
    let voltaEm = 0;
    let ultimoEnvio = 0;
    let ultimoHud = 0;
    let anterior = performance.now();
    let sobra = 0;
    let quadroId = 0;
    let golpe: { id: number; g: string } | null = null;
    const acertados = new Set<number>();
    let cenoura: Cenoura | null = null;
    let ultimaPorta = 0;
    let trocaEm = 0;
    // o tremor da bomba e do golpe levado (só desenho: impacto.ts), e as moitas já cortadas neste golpe
    const impacto = criarImpacto({ pixelsPorForca: 5 });
    const cortadas = new Set<string>();
    let corda: { quem: number; x: number; y: number; ate: number } | null = null;

    const enviar = (dados: unknown) => (solo ? socket.emit('minijogo-solo:tempo-real', { dados }) : socket.emit('minijogo:tempo-real', { channelId, dados }));
    const mandarPosicao = (ataque?: { id: number; g: string }) => {
      ultimoEnvio = performance.now();
      enviar({
        tipo: 'pos',
        x: Math.round(eu_.x * 10) / 10,
        y: Math.round(eu_.y * 10) / 10,
        dir: eu_.dir,
        acao: ACOES.indexOf(eu_.acao),
        ta: Math.round(eu_.t),
        tp,
        ...(ataque ? { ataque } : {}),
      });
    };

    const aoQuadro = (m: { channelId?: number; dados?: unknown }) => {
      if (!solo && m.channelId !== channelId) return;
      const q = m.dados;
      if (!ehQuadro(q)) return;
      const agoraMs = performance.now();
      const antes = linha.ultimo();
      linha.chegou(q, agoraMs);
      if (antes && antes.s !== q.s) trocaEm = agoraMs;
      const meu = q.j.find((l) => l[0] === eu);
      if (meu && meu[11] !== tp) {
        // o servidor me pôs noutro lugar (a sala nova, a volta depois de cair): o coelho começa dali
        tp = meu[11] as number;
        eu_.x = meu[1] as number;
        eu_.y = meu[2] as number;
        eu_.acao = 'parado';
        cenoura = null;
      }
      for (const e of q.e) {
        const [id, tipo, ...r] = e as [number, string, ...unknown[]];
        if (vistos.has(id)) continue;
        vistos.add(id);
        if (vistos.size > 500) vistos.delete(vistos.values().next().value as number);
        if (tipo === 'h') {
          piscando.set(r[0] as number, agoraMs + 160);
          if (r[1] !== eu)
            efeitos.push({
              tipo: 'faisca',
              x: r[2] as number,
              y: (r[3] as number) - 14,
              em: agoraMs + 100,
            });
        } else if (tipo === 'x') {
          efeitos.push({
            tipo: 'puf',
            x: r[1] as number,
            y: r[2] as number,
            em: agoraMs + 100,
          });
          tocar('quebra');
        } else if (tipo === 'p') {
          apanhouEm.set(r[0] as number, agoraMs);
          if (r[0] === eu) {
            apanhar(eu_, r[2] as number, r[3] as number);
            tocar('dano');
            impacto.acerto({ forca: 0.45, pausaMs: 50 });
          }
        } else if (tipo === 'k' && r[0] === eu) {
          voltaEm = Date.now() + 3000;
          tocar('queda');
        } else if (tipo === 'b') {
          const quem = q.j.find((l) => l[0] === r[1]);
          if (quem)
            efeitos.push({
              tipo: 'item',
              x: quem[1] as number,
              y: quem[2] as number,
              em: agoraMs,
              item: r[0] as 'cenoura' | 'chave' | 'gancho',
            });
          tocar('bandeira');
        } else if (tipo === 'a') tocar('encaixe');
        else if (tipo === 'c') tocar('cura');
        // os vasos, as moitas, a bomba e o coração grande (19/11/2026)
        else if (tipo === 'q') {
          efeitos.push({
            tipo: 'puf',
            x: r[0] as number,
            y: r[1] as number,
            em: agoraMs,
          });
          tocar('quebra');
        } else if (tipo === 'e') {
          efeitos.push({
            tipo: 'puf',
            x: r[0] as number,
            y: r[1] as number,
            em: agoraMs,
          });
          efeitos.push({
            tipo: 'estrelas',
            x: r[0] as number,
            y: r[1] as number,
            em: agoraMs,
          });
          tocar('explosao');
          impacto.tremer(0.9, 350);
        } else if (tipo === 'v') tocar('encaixe');
        else if (tipo === 'sm') tocar('item');
        else if (tipo === 'g') tocar('medalha');
        else if (tipo === 'tk') {
          // a couraça do golem-rei: o golpe tine
          efeitos.push({ tipo: 'faisca', x: r[2] as number, y: (r[3] as number) - 24, em: agoraMs });
          tocar('erro');
        } else if (tipo === 'gb') {
          // o gancho pegou o golem-rei: a corda dele até a pessoa, e o tranco
          corda = { quem: r[0] as number, x: r[1] as number, y: (r[2] as number) + 10, ate: agoraMs + 320 };
          tocar('impacto');
          impacto.tremer(0.6, 250);
        } else if (tipo === 'gh') {
          // o gancho puxou alguém: a corda aparece um instante, do poste até a pessoa
          corda = { quem: r[0] as number, x: r[1] as number, y: r[2] as number, ate: agoraMs + 260 };
          tocar('desliza');
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
      if (!ultimo) return;
      const sala = SALAS[ultimo.s];
      const mundo = mundoDoQuadro(ultimo);
      const meuEstado = (ultimo.j.find((l) => l[0] === eu)?.[7] as number | undefined) ?? 0;
      const jogando = jogador && ultimo.f === 'jogando' && meuEstado === 0 && tp >= 0;
      const temCenoura = ultimo.it[0] === 1;

      const volta = linha.emVolta(agoraMs);
      const bichos = volta ? misturar(volta.a.i, volta.b.i, volta.k, [2, 3, 4]) : [];
      const outros = volta ? misturar(volta.a.j, volta.b.j, volta.k, [1, 2]) : [];
      const tiros = volta ? misturar(volta.a.t, volta.b.t, volta.k, [1, 2]) : [];
      const blocos = volta ? misturar(volta.a.b, volta.b.b, volta.k, [1, 2]) : [];
      const naTela = bichos.map((l) => ({
        id: l[0],
        tipo: TIPOS[l[1]] ?? 'cogumelo',
        x: l[2],
        y: l[3],
        z: l[4],
        estado: ESTADOS[l[5]] ?? 'parado',
      }));

      // O MEU COELHO: passos fixos de 1/60 s
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        if (!jogando) continue;
        if (import.meta.env.DEV && window.masmorraPilotoAutomatico) {
          piloto(
            {
              sala,
              m: mundo,
              eu: eu_,
              temCenoura,
              temGancho: ultimo.it[3] === 1,
              chaves: ultimo.it[1],
              placasResolvidas: ultimo.pr === 1,
              bauAberto: ultimo.bau === 2,
              bichos: naTela,
            },
            cmd,
          );
        }
        // O VASO E A BOMBA (19/11/2026): bater com o vaso na cabeça joga; de frente para um vaso, bater o levanta
        const meuQuadro = ultimo.j.find((l) => l[0] === eu);
        const carrego = meuQuadro?.[12] === 1;
        if (cmd.golpe && carrego) {
          cmd.golpe = false;
          enviar({ tipo: 'jogar' });
          tocar('empurrao');
        } else if (cmd.golpe && eu_.acao !== 'pa') {
          const vaso = coisaAFrente(sala, mundo, eu_.x, eu_.y, eu_.dir, 'V');
          if (vaso) {
            cmd.golpe = false;
            enviar({ tipo: 'levantar', c: vaso[0], l: vaso[1] });
          }
        }
        // o gancho (a mina): o item puxa até o poste da frente; o servidor acha o poste e põe o coelho lá
        if (cmd.item && ultimo.it[3] === 1) {
          cmd.item = false;
          enviar({ tipo: 'gancho', dir: eu_.dir });
          tocar('tiro');
        }
        if (cmd.bomba) {
          cmd.bomba = false;
          if ((ultimo.it[2] ?? 0) > 0) enviar({ tipo: 'bomba' });
          else tocar('erro');
        }
        const nov = passoDoCoelho(sala, mundo, eu_, cmd, 1 / 60, temCenoura);
        if (nov.comecou) {
          golpe = nov.comecou;
          acertados.clear();
          cortadas.clear();
          mandarPosicao(nov.comecou);
          if (nov.comecou.g === 'cenoura') {
            const [dx, dy] = DIRS[eu_.dir];
            cenoura = {
              id: nov.comecou.id,
              x: eu_.x,
              y: eu_.y,
              dx,
              dy,
              andou: 0,
              volta: false,
              t: 0,
            };
            tocar('tiro');
          } else tocar('soco');
        }
        if (nov.arrancou) mandarPosicao();
        if (nov.empurrar !== undefined) {
          enviar({ tipo: 'empurrar', dir: nov.empurrar });
          tocar('empurrao');
        }
        if (nov.porta && agoraMs - ultimaPorta > 300) {
          ultimaPorta = agoraMs;
          enviar({ tipo: 'porta', lado: nov.porta });
        }
        // o golpe da pá, no tempo dele: o que encosta na minha tela vai ao servidor
        if (golpe?.g === 'pa' && eu_.acao === 'pa' && eu_.t >= PA.de && eu_.t <= PA.ate) {
          const [dx, dy] = DIRS[eu_.dir];
          // a moita na frente: o servidor confere e sorteia o que sai dela
          const moita = coisaAFrente(sala, mundo, eu_.x, eu_.y, eu_.dir, 'M');
          if (moita && !cortadas.has(`${moita[0]},${moita[1]}`)) {
            cortadas.add(`${moita[0]},${moita[1]}`);
            enviar({ tipo: 'cortar', a: golpe.id, c: moita[0], l: moita[1] });
          }
          for (const b of naTela) {
            if (acertados.has(b.id) || b.estado === 'morto' || b.estado === 'sumido' || b.z > 12) continue;
            if (Math.hypot(b.x - (eu_.x + dx * PA.frente), b.y - (eu_.y + dy * PA.frente)) > PA.raio + BICHOS[b.tipo].raio) continue;
            acertados.add(b.id);
            enviar({
              tipo: 'golpe',
              a: golpe.id,
              inimigo: b.id,
              x: Math.round(eu_.x),
              y: Math.round(eu_.y),
            });
            efeitos.push({ tipo: 'faisca', x: b.x, y: b.y - 14, em: agoraMs });
            piscando.set(b.id, agoraMs + 160);
            tocar('acerto');
          }
        }
        if (cenoura) {
          const r = passoDaCenoura(sala, mundo, cenoura, eu_, 1 / 60);
          if (r.bateu && sala.grade[r.bateu[1]]?.[r.bateu[0]] === 'K')
            enviar({
              tipo: 'cristal',
              a: cenoura.id,
              x: Math.round(cenoura.x),
              y: Math.round(cenoura.y),
            });
          for (const b of naTela) {
            if (acertados.has(b.id) || b.estado === 'morto' || b.estado === 'sumido') continue;
            if (Math.hypot(b.x - cenoura.x, b.y - cenoura.y) > CENOURA.raio + BICHOS[b.tipo].raio) continue;
            acertados.add(b.id);
            enviar({
              tipo: 'golpe',
              a: cenoura.id,
              inimigo: b.id,
              x: Math.round(cenoura.x),
              y: Math.round(cenoura.y),
            });
            efeitos.push({ tipo: 'estrelas', x: b.x, y: b.y, em: agoraMs });
            tocar('acerto');
          }
          if (r.fim) cenoura = null;
        }
      }
      if (jogando && agoraMs - ultimoEnvio >= ENVIO_MS) mandarPosicao();
      if (import.meta.env.DEV) {
        window.masmorraDoTeste = {
          sala: ultimo.s,
          x: eu_.x,
          y: eu_.y,
          // onde o servidor me vê (a posição que ele aceitou)
          servidor: (ultimo.j.find((l) => l[0] === eu) ?? []).slice(1, 3) as number[],
          tp,
          hp: (ultimo.j.find((l) => l[0] === eu)?.[6] as number) ?? 0,
          cenoura: temCenoura,
          chaves: ultimo.it[1],
          ponte: ultimo.ponte === 1,
          bichos: ultimo.i.length,
          fase: ultimo.f,
        };
      }

      // SEM FOCO, NADA SE DESENHA: o coelho e o envio acima continuam, para a turma não perder ninguém
      if ((document.hidden || !document.hasFocus()) && !(import.meta.env.DEV && window.masmorraPilotoAutomatico)) {
        if (efeitos.length > 40) efeitos.splice(0, efeitos.length - 40);
        return;
      }

      const tremor = impacto.quadro();
      g.save();
      g.translate(tremor.dx, tremor.dy);
      desenharSala(g, sala, { ...mundo, blocos: [] }, ultimo.p, ultimo.pl, ultimo.bau, agoraMs, ultimo.cg === 1);
      // as sementes no chão e as bombas
      for (const sm of ultimo.sm ?? []) desenharSemente(g, sm[1], sm[2]);
      for (const b of ultimo.bs ?? []) desenharBomba(g, b[1], b[2], b[3]);
      // os corações no chão
      for (const c_ of ultimo.c) desenharCoracao(g, c_[1], c_[2] + Math.sin(agoraMs / 200) * 2, true);
      // o que fica de pé, do fundo para a frente
      const coisas: { y: number; desenhar: () => void }[] = [];
      for (const b of blocos) {
        const [bx, by] = centro(b[1], b[2]);
        coisas.push({ y: by + 18, desenhar: () => desenharBloco(g, bx, by) });
      }
      for (const l of bichos) {
        const tipo = TIPOS[l[1]] ?? 'cogumelo';
        const est = ESTADOS[l[5]] ?? 'parado';
        const raio = BICHOS[tipo].raio;
        const pe = l[3] + raio * 0.6;
        coisas.push({
          y: pe,
          desenhar: () => {
            // o aviso antes do golpe: a mira do cacto, o lugar onde o sapo cai, a direção da investida do rei
            if (est === 'mirando' && tipo === 'cacto') {
              g.strokeStyle = Math.floor(agoraMs / 90) % 2 ? AVISOS.mira[0] : AVISOS.mira[1];
              g.lineWidth = 2;
              g.setLineDash([6, 6]);
              g.beginPath();
              g.moveTo(l[2], l[3]);
              g.lineTo(l[2] + (l[9] - l[2]) * 6, l[3] + (l[10] - l[3]) * 6);
              g.stroke();
              g.setLineDash([]);
            }
            if ((est === 'mirando' || est === 'saltando') && tipo === 'sapo') {
              g.strokeStyle = Math.floor(agoraMs / 100) % 2 ? AVISOS.pulo[0] : AVISOS.pulo[1];
              g.lineWidth = 3;
              g.beginPath();
              g.ellipse(l[9], l[10] + 6, 24, 10, 0, 0, Math.PI * 2);
              g.stroke();
            }
            // o mergulho da abelha: a faixa por onde ela vai passar
            if (est === 'mirando' && tipo === 'abelha') {
              g.fillStyle = Math.floor(agoraMs / 90) % 2 ? AVISOS.investida[0] : AVISOS.investida[1];
              g.save();
              g.translate(l[2], l[3]);
              g.rotate(Math.atan2(l[10] - l[3], l[9] - l[2]));
              g.fillRect(0, -16, 150, 32);
              g.restore();
            }
            if (est === 'prep-investida') {
              g.fillStyle = Math.floor(agoraMs / 90) % 2 ? AVISOS.investida[0] : AVISOS.investida[1];
              g.save();
              g.translate(l[2], l[3]);
              g.rotate(Math.atan2(l[10] - l[3], l[9] - l[2]));
              g.fillRect(0, -26, 160, 52);
              g.restore();
            }
            if (est !== 'morto') sombra(g, l[2], pe, raio * 2.2);
            const doBicho = {
              tipo: (tipo === 'golem-rei' ? 'golem' : tipo) as TipoDeInimigo,
              estado: (est === 'sumido' ? 'parado' : est) as EstadoDoInimigo,
              lado: l[6],
              ms: l[8],
              piscando: (piscando.get(l[0]) ?? 0) > agoraMs,
            };
            g.save();
            // o fantasma sumido: quase transparente (sumido, nada o acerta)
            if (tipo === 'fantasma') g.globalAlpha = est === 'sumido' ? 0.18 : 0.85;
            if (tipo === 'golem-rei') {
              // o golem-rei: a folha do golem em dobro; com a couraça fechada, o brilho de pedra em volta
              if (est !== 'atordoado' && est !== 'morto') {
                g.strokeStyle = Math.floor(agoraMs / 200) % 2 ? 'rgba(200, 210, 225, 0.55)' : 'rgba(150, 160, 180, 0.45)';
                g.lineWidth = 3;
                g.beginPath();
                g.ellipse(l[2], pe - 28, 34, 36, 0, 0, Math.PI * 2);
                g.stroke();
              }
              g.translate(l[2], pe - l[4]);
              g.scale(2, 2);
              desenharBichoDaFolha(g, doBicho, 0, 0, agoraMs);
            } else desenharBichoDaFolha(g, doBicho, l[2], pe - l[4], agoraMs);
            g.restore();
            if (est === 'atordoado')
              desenharEfeito(
                g,
                {
                  tipo: 'estrelas',
                  x: l[2],
                  y: pe - l[4] - 4,
                  em: agoraMs - 1,
                },
                agoraMs,
              );
            if (est === 'cansado' || (est === 'atordoado' && tipo === 'golem-rei')) desenharEfeito(g, { tipo: 'estrelas', x: l[2], y: pe - 50, em: agoraMs - 1 }, agoraMs);
            if (!ehChefe(tipo) && l[7] < 100 && est !== 'morto' && est !== 'sumido') {
              g.fillStyle = '#2a1e1a';
              g.fillRect(l[2] - 12, pe - 50, 24, 4);
              g.fillStyle = '#e2574a';
              g.fillRect(l[2] - 11, pe - 49, Math.round((22 * l[7]) / 100), 2);
            }
          },
        });
      }
      for (const tr of tiros)
        coisas.push({
          y: tr[2] + 10,
          desenhar: () => desenharTiro(g, tr[1], tr[2], agoraMs),
        });
      // os vasos voando (o servidor os anda)
      for (const a of ultimo.r ?? [])
        coisas.push({
          y: a[2] + 14,
          desenhar: () => desenharVaso(g, a[1], a[2] - 6),
        });
      // o vaso na cabeça de quem carrega
      for (const l of outros) {
        if (l[12] !== 1 || l[7] !== 0) continue;
        const souEu = l[0] === eu && jogador;
        const x = souEu ? eu_.x : (l[1] as number);
        const y = souEu ? eu_.y : (l[2] as number);
        coisas.push({
          y: y + 12.02,
          desenhar: () => desenharVaso(g, x, y - 44),
        });
      }
      const imagem = folhaDe(folha, null);
      for (const l of outros) {
        if (l[0] === eu && jogador) continue;
        if (l[7] !== 0) continue;
        const pessoa = pessoas.current.get(l[0] as number);
        const acao = (ACOES[l[4] as number] ?? 'parado') as Acao;
        const x = l[1] as number;
        const y = l[2] as number;
        const dir = l[3] as number;
        const lado = dir === 2 ? -1 : 1;
        coisas.push({
          y: y + 12,
          desenhar: () => {
            sombra(g, x, y + 12, 26);
            desenharCoelho(g, folhaDe(folha, pessoa?.avatar ?? null) ?? imagem, x, y + 12, lado, desenhoDoCoelho(acaoDaFolha(acao), l[5] as number, false), {
              nome: pessoa?.nome,
              piscando: agoraMs - (apanhouEm.get(l[0] as number) ?? -1e9) < 900,
            });
            if (acao === 'pa' && (l[5] as number) < PA.dura) desenharGolpe(g, x, y - 8, dir, l[5] as number);
          },
        });
      }
      if (jogando || (jogador && meuEstado === 0)) {
        coisas.push({
          y: eu_.y + 12.01,
          desenhar: () => {
            sombra(g, eu_.x, eu_.y + 12, 26);
            const f = folhaDe(folha, pessoas.current.get(eu)?.avatar ?? null);
            desenharCoelho(g, f, eu_.x, eu_.y + 12, eu_.lado, desenhoDoCoelho(acaoDaFolha(eu_.acao), eu_.t, false), {
              nome: outros.length > 1 ? pessoas.current.get(eu)?.nome : undefined,
              eu: true,
              piscando: eu_.relogio < eu_.piscandoAte,
            });
            if (eu_.acao === 'pa') desenharGolpe(g, eu_.x, eu_.y - 8, eu_.dir, eu_.t);
          },
        });
      }
      coisas.sort((a, b) => a.y - b.y).forEach((x) => x.desenhar());
      if (cenoura) desenharCenoura(g, cenoura.x, cenoura.y - 8, agoraMs / 50);
      for (let k = efeitos.length - 1; k >= 0; k--) if (!desenharEfeito(g, efeitos[k], agoraMs)) efeitos.splice(k, 1);
      if (corda && agoraMs < corda.ate) {
        const quem = corda.quem === eu && jogador ? { x: eu_.x, y: eu_.y } : outros.find((l) => l[0] === corda!.quem);
        if (quem) {
          const qx = Array.isArray(quem) ? (quem[1] as number) : quem.x;
          const qy = Array.isArray(quem) ? (quem[2] as number) : quem.y;
          desenharCorda(g, corda.x, corda.y - 10, qx, qy - 10);
        }
      }
      g.restore();

      // o HUD do canvas: os meus corações, os itens da turma, a vida do rei e o mapa
      if (jogador) {
        const hp = (ultimo.j.find((l) => l[0] === eu)?.[6] as number) ?? 0;
        // o máximo pode crescer: o coração grande da sala secreta
        const max = (ultimo.j.find((l) => l[0] === eu)?.[13] as number | undefined) ?? CORACOES;
        g.fillStyle = AVISOS.fundo;
        g.fillRect(4, 4, max * 24 + 8, 26);
        for (let k = 0; k < max; k++) desenharCoracao(g, 20 + k * 24, 17, k < hp);
      }
      let ix = 8;
      if (temCenoura) {
        g.fillStyle = AVISOS.fundo;
        g.fillRect(4, 34, 34, 30);
        desenharCenoura(g, 21, 49, -0.7, 1.1);
        ix = 44;
      }
      for (let k = 0; k < ultimo.it[1]; k++) {
        g.fillStyle = AVISOS.fundo;
        g.fillRect(ix - 4, 34, 34, 30);
        desenharChave(g, ix + 11, 50);
        ix += 38;
      }
      // o gancho da turma (a mina)
      if (ultimo.it[3] === 1) {
        g.fillStyle = AVISOS.fundo;
        g.fillRect(ix - 4, 34, 34, 30);
        desenharGancho(g, ix + 12, 52);
        ix += 38;
      }
      // as sementes da turma (as bombas)
      for (let k = 0; k < (ultimo.it[2] ?? 0); k++) {
        g.fillStyle = AVISOS.fundo;
        g.fillRect(ix - 4, 34, 26, 30);
        desenharSemente(g, ix + 9, 50);
        ix += 30;
      }
      const rei = bichos.find((l) => ehChefe(TIPOS[l[1]] ?? 'cogumelo'));
      if (rei) {
        g.fillStyle = '#2a1e1a';
        g.fillRect(W / 2 - 122, 10, 244, 14);
        g.fillStyle = '#c94a3a';
        g.fillRect(W / 2 - 120, 12, Math.round((240 * rei[7]) / 100), 10);
      }
      desenharMapa(
        g,
        ultimo.s,
        ultimo.v,
        outros
          .filter((l) => l[7] === 0)
          .map((l) => ({
            x: l[0] === eu && jogador ? eu_.x : (l[1] as number),
            y: l[0] === eu && jogador ? eu_.y : (l[2] as number),
            eu: l[0] === eu,
          })),
        MASMORRAS[estado.masmorra ?? 'toca'].chefe,
      );
      // a troca de sala: um escurecer rápido
      const desde = agoraMs - trocaEm;
      if (desde < 350) {
        g.fillStyle = `rgba(20, 14, 12, ${1 - desde / 350})`;
        g.fillRect(0, 0, W, H);
      }

      if (agoraMs - ultimoHud > 200) {
        ultimoHud = agoraMs;
        setHud({
          linhas: ultimo.j.map((l) => ({
            userId: l[0] as number,
            hp: l[6] as number,
            hpMax: (l[13] as number | undefined) ?? CORACOES,
            pontos: l[8] as number,
            estado: l[7] as number,
            doeu: agoraMs - (apanhouEm.get(l[0] as number) ?? -1e9) < 450,
          })),
          fase: ultimo.f,
          meuEstado,
          voltaEm,
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
  const aviso =
    hud.fase === 'vitoria'
      ? t('Vitória!')
      : hud.fase === 'derrota'
        ? t('Derrota')
        : jogador && hud.meuEstado === 1 && hud.voltaEm > 0
          ? t('Você volta em {n}…', {
              n: Math.max(1, Math.ceil((hud.voltaEm - agora) / 1000)),
            })
          : null;

  return (
    <div className="masmorra">
      {hud.linhas.length > 1 && (
        <ul className="briga-hud" aria-live="off">
          {hud.linhas.map((l) => (
            <li key={l.userId} className={[l.userId === eu ? 'eu' : '', l.doeu ? 'doeu' : ''].filter(Boolean).join(' ') || undefined}>
              <span className="minijogo-nome">{nome(l.userId)}</span>
              <span className="briga-vidas" aria-hidden="true">
                {'♥'.repeat(Math.max(0, l.hp))}
                <span className="masmorra-vazio">{'♥'.repeat(Math.max(0, l.hpMax - l.hp))}</span>
              </span>
              <strong>{l.pontos}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className="masmorra-tela">
        <canvas ref={canvas} width={W} height={H} />
        {aviso && <p className="briga-aviso">{aviso}</p>}
      </div>
      {jogador && <Toque cmd={cmd} />}
      {jogador && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas', 'wasd'], rotulo: t('Andar') },
            { teclas: ['x'], rotulo: t('Bater') },
            { teclas: ['c'], rotulo: t('Usar o item') },
            { teclas: ['z'], rotulo: t('Arrancada') },
            { teclas: ['q'], rotulo: t('Bomba') },
          ]}
        />
      )}
    </div>
  );
}

/** Os botões da tela de toque: o direcional à esquerda; bater, o item e a arrancada à direita. */
function Toque({ cmd }: { cmd: Comandos }) {
  const t = useT();
  const segurar = (k: 'esquerda' | 'direita' | 'cima' | 'baixo') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cmd[k] = true;
    },
    onPointerUp: () => (cmd[k] = false),
    onPointerCancel: () => (cmd[k] = false),
    onPointerLeave: () => (cmd[k] = false),
  });
  const apertar = (k: 'golpe' | 'item' | 'arrancada' | 'bomba') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cmd[k] = true;
    },
  });
  return (
    <div className="briga-toque">
      <div className="briga-direcional" role="group" aria-label={t('Andar')}>
        <button type="button" className="briga-cima" aria-hidden="true" tabIndex={-1} {...segurar('cima')}>
          ▲
        </button>
        <button type="button" className="briga-esq" aria-hidden="true" tabIndex={-1} {...segurar('esquerda')}>
          ◀
        </button>
        <button type="button" className="briga-dir" aria-hidden="true" tabIndex={-1} {...segurar('direita')}>
          ▶
        </button>
        <button type="button" className="briga-baixo" aria-hidden="true" tabIndex={-1} {...segurar('baixo')}>
          ▼
        </button>
      </div>
      <div className="briga-botoes">
        <button type="button" aria-label={t('Bomba')} {...apertar('bomba')}>
          ●
        </button>
        <button type="button" aria-label={t('Arrancada')} {...apertar('arrancada')}>
          »
        </button>
        <button type="button" aria-label={t('Usar o item')} {...apertar('item')}>
          🥕
        </button>
        <button type="button" aria-label={t('Bater')} {...apertar('golpe')}>
          ✊
        </button>
      </div>
    </div>
  );
}
