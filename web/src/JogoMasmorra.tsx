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
} from './masmorra/regras';
import type { Partida } from './minijogos';
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
  jogadores: { userId: number; username: string; avatar: number | string | null; pontos: number }[];
  resultado: { userId: number; username: string; pontos: number; acertos: number; nocautes: number; quedas: number; posicao: number | null }[] | null;
  partidaId: string;
}

declare global {
  interface Window {
    /** Só no desenvolvimento: o coelho anda, bate e resolve a masmorra sozinho (e2e/masmorra.mjs). */
    masmorraPilotoAutomatico?: boolean;
    /** Só no desenvolvimento: o que o e2e confere. */
    masmorraDoTeste?: { sala: number; x: number; y: number; servidor: number[]; tp: number; hp: number; cenoura: boolean; chaves: number; ponte: boolean; bichos: number; fase: string };
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
      : estado.jogadores.map((j) => ({ ...j, posicao: 1 + estado.jogadores.filter((o) => o.pontos > j.pontos).length }));
    const regra = { venceu: !!doServidor && estado.venceu, solo: estado.solo === true, ficaram: linhas.filter((l) => l.posicao !== null).length };
    return (
      <div className="masmorra">
        <p className="briga-desfecho">{estado.venceu ? t('Vitória!') : t('Derrota')}</p>
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
  return <Palco key={estado.partidaId} estado={estado} eu={eu} jogador={jogador && estado.jogadores.some((j) => j.userId === eu)} socket={socket} channelId={channelId} />;
}

interface Hud {
  linhas: { userId: number; hp: number; pontos: number; estado: number; doeu: boolean }[];
  fase: Quadro['f'] | null;
  meuEstado: number;
  voltaEm: number;
}

function Palco({ estado, eu, jogador, socket, channelId }: { estado: EstadoMasmorra & Partida; eu: number; jogador: boolean; socket: Socket | null; channelId: number }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cmd] = useState(comandosVazios);
  const [hud, setHud] = useState<Hud>({ linhas: [], fase: null, meuEstado: 0, voltaEm: 0 });
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
    carregarFolhas(['cogumelo', 'cacto', 'sapo', 'rei-cogumelo'] as TipoDeInimigo[]);
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
          if (r[1] !== eu) efeitos.push({ tipo: 'faisca', x: r[2] as number, y: (r[3] as number) - 14, em: agoraMs + 100 });
        } else if (tipo === 'x') {
          efeitos.push({ tipo: 'puf', x: r[1] as number, y: r[2] as number, em: agoraMs + 100 });
          tocar('quebra');
        } else if (tipo === 'p') {
          apanhouEm.set(r[0] as number, agoraMs);
          if (r[0] === eu) {
            apanhar(eu_, r[2] as number, r[3] as number);
            tocar('erro');
          }
        } else if (tipo === 'k' && r[0] === eu) {
          voltaEm = Date.now() + 3000;
          tocar('queda');
        } else if (tipo === 'b') {
          const quem = q.j.find((l) => l[0] === r[1]);
          if (quem) efeitos.push({ tipo: 'item', x: quem[1] as number, y: quem[2] as number, em: agoraMs, item: r[0] as 'cenoura' | 'chave' });
          tocar('bandeira');
        } else if (tipo === 'a') tocar('encaixe');
        else if (tipo === 'c') tocar('moeda');
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
      const naTela = bichos.map((l) => ({ id: l[0], tipo: TIPOS[l[1]] ?? 'cogumelo', x: l[2], y: l[3], z: l[4], estado: ESTADOS[l[5]] ?? 'parado' }));

      // O MEU COELHO: passos fixos de 1/60 s
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        if (!jogando) continue;
        if (import.meta.env.DEV && window.masmorraPilotoAutomatico) {
          piloto({ sala, m: mundo, eu: eu_, temCenoura, chaves: ultimo.it[1], placasResolvidas: ultimo.pr === 1, bauAberto: ultimo.bau === 2, bichos: naTela }, cmd);
        }
        const nov = passoDoCoelho(sala, mundo, eu_, cmd, 1 / 60, temCenoura);
        if (nov.comecou) {
          golpe = nov.comecou;
          acertados.clear();
          mandarPosicao(nov.comecou);
          if (nov.comecou.g === 'cenoura') {
            const [dx, dy] = DIRS[eu_.dir];
            cenoura = { id: nov.comecou.id, x: eu_.x, y: eu_.y, dx, dy, andou: 0, volta: false, t: 0 };
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
          for (const b of naTela) {
            if (acertados.has(b.id) || b.estado === 'morto' || b.z > 12) continue;
            if (Math.hypot(b.x - (eu_.x + dx * PA.frente), b.y - (eu_.y + dy * PA.frente)) > PA.raio + BICHOS[b.tipo].raio) continue;
            acertados.add(b.id);
            enviar({ tipo: 'golpe', a: golpe.id, inimigo: b.id, x: Math.round(eu_.x), y: Math.round(eu_.y) });
            efeitos.push({ tipo: 'faisca', x: b.x, y: b.y - 14, em: agoraMs });
            piscando.set(b.id, agoraMs + 160);
            tocar('acerto');
          }
        }
        if (cenoura) {
          const r = passoDaCenoura(sala, mundo, cenoura, eu_, 1 / 60);
          if (r.bateu && sala.grade[r.bateu[1]]?.[r.bateu[0]] === 'K') enviar({ tipo: 'cristal', a: cenoura.id, x: Math.round(cenoura.x), y: Math.round(cenoura.y) });
          for (const b of naTela) {
            if (acertados.has(b.id) || b.estado === 'morto') continue;
            if (Math.hypot(b.x - cenoura.x, b.y - cenoura.y) > CENOURA.raio + BICHOS[b.tipo].raio) continue;
            acertados.add(b.id);
            enviar({ tipo: 'golpe', a: cenoura.id, inimigo: b.id, x: Math.round(cenoura.x), y: Math.round(cenoura.y) });
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

      desenharSala(g, sala, { ...mundo, blocos: [] }, ultimo.p, ultimo.pl, ultimo.bau, agoraMs);
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
            if (est === 'prep-investida') {
              g.fillStyle = Math.floor(agoraMs / 90) % 2 ? AVISOS.investida[0] : AVISOS.investida[1];
              g.save();
              g.translate(l[2], l[3]);
              g.rotate(Math.atan2(l[10] - l[3], l[9] - l[2]));
              g.fillRect(0, -26, 160, 52);
              g.restore();
            }
            if (est !== 'morto') sombra(g, l[2], pe, raio * 2.2);
            desenharBichoDaFolha(
              g,
              { tipo: tipo as TipoDeInimigo, estado: est as EstadoDoInimigo, lado: l[6], ms: l[8], piscando: (piscando.get(l[0]) ?? 0) > agoraMs },
              l[2],
              pe - l[4],
              agoraMs,
            );
            if (est === 'atordoado') desenharEfeito(g, { tipo: 'estrelas', x: l[2], y: pe - l[4] - 4, em: agoraMs - 1 }, agoraMs);
            if (est === 'cansado') desenharEfeito(g, { tipo: 'estrelas', x: l[2], y: pe - 50, em: agoraMs - 1 }, agoraMs);
            if (tipo !== 'rei-cogumelo' && l[7] < 100 && est !== 'morto') {
              g.fillStyle = '#2a1e1a';
              g.fillRect(l[2] - 12, pe - 50, 24, 4);
              g.fillStyle = '#e2574a';
              g.fillRect(l[2] - 11, pe - 49, Math.round((22 * l[7]) / 100), 2);
            }
          },
        });
      }
      for (const tr of tiros) coisas.push({ y: tr[2] + 10, desenhar: () => desenharTiro(g, tr[1], tr[2], agoraMs) });
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

      // o HUD do canvas: os meus corações, os itens da turma, a vida do rei e o mapa
      if (jogador) {
        const hp = (ultimo.j.find((l) => l[0] === eu)?.[6] as number) ?? 0;
        g.fillStyle = AVISOS.fundo;
        g.fillRect(4, 4, CORACOES * 24 + 8, 26);
        for (let k = 0; k < CORACOES; k++) desenharCoracao(g, 20 + k * 24, 17, k < hp);
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
      const rei = bichos.find((l) => TIPOS[l[1]] === 'rei-cogumelo');
      if (rei) {
        g.fillStyle = '#2a1e1a';
        g.fillRect(W / 2 - 122, 10, 244, 14);
        g.fillStyle = '#c94a3a';
        g.fillRect(W / 2 - 120, 12, Math.round((240 * rei[7]) / 100), 10);
      }
      desenharMapa(g, ultimo.s, ultimo.v);
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
          ? t('Você volta em {n}…', { n: Math.max(1, Math.ceil((hud.voltaEm - agora) / 1000)) })
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
                <span className="masmorra-vazio">{'♥'.repeat(Math.max(0, CORACOES - l.hp))}</span>
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
  const apertar = (k: 'golpe' | 'item' | 'arrancada') => ({
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
        <button type="button" aria-label={t('Arrancada')} {...apertar('arrancada')}>»</button>
        <button type="button" aria-label={t('Usar o item')} {...apertar('item')}>🥕</button>
        <button type="button" aria-label={t('Bater')} {...apertar('golpe')}>✊</button>
      </div>
    </div>
  );
}
