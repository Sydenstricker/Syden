import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  CHAO,
  desenharAviso,
  desenharBarraDoChefe,
  desenharBicho,
  desenharCoelho,
  desenharEfeito,
  desenharFundo,
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
import {
  acaoAtiva,
  ACOES,
  apanhar,
  apanhavel,
  ARENA_L,
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
  type Acao,
  type Comandos,
  type InimigoNaTela,
  type Quadro,
} from './briga/regras';
import { Trophy } from 'lucide-react';
import { useT } from './i18n';
import type { EstadoBriga, Partida } from './minijogos';

/**
 * A BRIGA NA HORTA (03/11/2026, server/src/minijogo-briga.ts): briga de rua de lado, com a turma, contra raposas, corvos e um
 * texugo. Só a mecânica dos fliperamas de quatro jogadores do começo dos anos 90; o desenho é todo daqui (briga/desenho.ts)
 * e o coelho é o mascote 3D de lado.
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

/** O teclado: setas ou WASD andam, X/J bate, Z/K/Espaço pula, C/L é o especial. */
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
  linhas: { userId: number; hp: number; vidas: number; pontos: number; estado: number }[];
  fase: Quadro['f'] | null;
  meuEstado: number;
  voltaEm: number;
}

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
        <p className="briga-desfecho">{estado.venceu ? t('A horta está salva!') : t('A horta caiu.')}</p>
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
  return <Palco estado={estado} eu={eu} jogador={jogador && estado.jogadores.some((j) => j.userId === eu)} socket={socket} channelId={channelId} />;
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
  const [hud, setHud] = useState<Hud>({ linhas: [], fase: null, meuEstado: 0, voltaEm: 0 });
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
    let voltaEm = 0;
    let ultimoEnvio = 0;
    let ultimoHud = 0;
    let anterior = performance.now();
    let sobra = 0;
    let quadroId = 0;
    let camX = 0;
    let posicionado = false;

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
        } else if (tipo === 'p') {
          piscandoOutros.set(r[0], agoraMs + 300);
        } else if (tipo === 'k' && r[0] === eu) {
          eu_.hp = 0;
          eu_.acao = 'caido';
          eu_.t = 0;
          voltaEm = r[1] > 0 ? Date.now() + 3000 : 0;
        } else if (tipo === 'r' && r[0] === eu) {
          Object.assign(eu_, novoCoelho(r[1], r[2]), { ataque: eu_.ataque, relogio: eu_.relogio });
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
      }));

      // O MEU COELHO: passos fixos de 1/60 s
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        if (!jogando) continue;
        if (import.meta.env.DEV && window.brigaPilotoAutomatico) pilotoAutomatico(eu_, naTelaAgora, cmd, eu_.relogio);
        const novo = passoDoCoelho(eu_, cmd, 1 / 60, arena);
        if (novo.comecou) {
          // o golpe que começou vai na hora, antes de qualquer acerto dele
          mandarPosicao(novo.comecou);
          tocar(novo.comecou.golpe === 'especial' ? 'combo' : 'soco');
          if (novo.comecou.golpe === 'especial') efeitos.push({ tipo: 'giro', x: eu_.x, y: eu_.y, z: 0, em: agoraMs });
        }
        if (golpeAtivo(eu_) && eu_.golpe) {
          for (const i of naTelaAgora) {
            if (eu_.acertados.has(i.id) || !apanhavel(i, eu_.golpe) || !encosta(eu_.golpe, eu_.x, eu_.y, eu_.z, eu_.lado, i)) continue;
            eu_.acertados.add(i.id);
            enviar({ tipo: 'golpe', a: eu_.ataque, inimigo: i.id, x: Math.round(eu_.x * 10) / 10, y: Math.round(eu_.y * 10) / 10, z: Math.round(eu_.z) });
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
      desenharFundo(g, cam, FIM_DA_FASE);
      const coisas: { y: number; desenhar: () => void }[] = [];
      for (const l of inimigos) {
        const tipo = TIPOS[l[1]] ?? 'raposa';
        const est = ESTADOS[l[5]] ?? 'andando';
        const { sx, sy } = naTela(cam, l[2], l[3], l[4]);
        const chao = CHAO + Math.round(l[3]);
        coisas.push({
          y: l[3],
          desenhar: () => {
            sombra(g, sx, chao, tipo === 'texugo' ? 36 : tipo === 'corvo' ? 12 : 18, l[4]);
            desenharAviso(g, tipo, est, sx, CHAO + Math.round(tipo === 'corvo' || tipo === 'texugo' ? l[9] ?? l[3] : l[3]), l[6], agoraMs, chao);
            desenharBicho(g, { tipo, estado: est, lado: l[6], passos: l[8], hp: l[7], piscando: (piscandoInimigo.get(l[0]) ?? 0) > agoraMs }, sx, sy, agoraMs);
            if (tipo !== 'texugo' && l[7] < 100 && est !== 'morto') {
              g.fillStyle = '#2a1e1a';
              g.fillRect(sx - 8, sy - (tipo === 'corvo' ? 22 : 54), 16, 3);
              g.fillStyle = '#e2574a';
              g.fillRect(sx - 7, sy - (tipo === 'corvo' ? 21 : 53), Math.round((14 * l[7]) / 100), 1);
            }
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
        coisas.push({
          y: l[2],
          desenhar: () => {
            sombra(g, sx, CHAO + Math.round(l[2]), 18, l[3]);
            const f = folhaDe(folha, pessoa?.avatar ?? (l[11] || null)) ?? imagem;
            desenharCoelho(g, f, sx, sy, l[4], desenhoDoCoelho(l[10] === 1 ? 'caido' : acao, l[10] === 1 ? 999 : l[6], l[3] > 0 && l[6] < 280), {
              nome: pessoa?.nome,
              piscando: (piscandoOutros.get(l[0]) ?? 0) > agoraMs,
            });
            if (l[10] === 0 && acaoAtiva(acao, l[6])) desenharRastro(g, sx, sy, l[4], acao);
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
            desenharCoelho(g, f, sx, sy, eu_.lado, desenhoDoCoelho(acao, meuEstado !== 0 ? 999 : eu_.t, eu_.vz > 0), {
              nome: outros.length > 1 ? pessoas.current.get(eu)?.nome : undefined,
              eu: true,
              piscando: eu_.relogio < eu_.piscandoAte,
            });
            if (meuEstado === 0 && golpeAtivo(eu_)) desenharRastro(g, sx, sy, eu_.lado, eu_.acao);
          },
        });
      }
      coisas.sort((a, b) => a.y - b.y).forEach((c_) => c_.desenhar());
      for (let k = efeitos.length - 1; k >= 0; k--) if (!desenharEfeito(g, efeitos[k], cam, agoraMs)) efeitos.splice(k, 1);
      const chefe = inimigos.find((l) => l[1] === 2);
      if (chefe) desenharBarraDoChefe(g, chefe[7]);
      if (ultimo) desenharOndas(g, ultimo.o, ONDAS_X.length);
      if (fase === 'avancando') desenharSeta(g, agoraMs);

      // o placar de cima, umas 5 vezes por segundo
      if (agoraMs - ultimoHud > 200 && ultimo) {
        ultimoHud = agoraMs;
        setHud({
          linhas: ultimo.j.map((l) => ({ userId: l[0], hp: l[7], vidas: l[8], pontos: l[9], estado: l[10] })),
          fase,
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
      ? t('A horta está salva!')
      : hud.fase === 'derrota'
        ? t('A horta caiu.')
        : jogador && hud.meuEstado === 2
          ? t('Sem vidas.')
          : jogador && hud.meuEstado === 1 && hud.voltaEm > 0
            ? t('Você volta em {n}…', { n: Math.max(1, Math.ceil((hud.voltaEm - agora) / 1000)) })
            : null;

  return (
    <div className="briga">
      <ul className="briga-hud" aria-live="off">
        {hud.linhas.map((l) => (
          <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
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
      </div>
      {jogador && <Toque cmd={cmd} />}
      {jogador && <TeclasDaBriga />}
      {jogador && <p className="settings-hint briga-dica">{t('Setas para andar, X para bater (três seguidas é o combo), Z para pular, C para o especial, que gasta um pouco de vida.')}</p>}
    </div>
  );
}

/**
 * AS TECLAS, DESENHADAS (pedido dele, 05/11/2026: "deixe os comandos claros, as setas e ZXC"): cada tecla como uma tecla de
 * verdade, com o que ela faz embaixo, na ordem do teclado (Z, X, C). A frase com os detalhes (o combo, o especial que gasta
 * vida) continua logo abaixo. Na tela de toque não aparece: lá os botões já são os comandos.
 */
function TeclasDaBriga() {
  const t = useT();
  const tecla = (k: string, largo = false) => (
    <kbd className={`briga-tecla${largo ? ' larga' : ''}`} key={k}>
      {k}
    </kbd>
  );
  return (
    <div className="briga-teclas" aria-hidden="true">
      <div className="briga-teclas-grupo">
        <div className="briga-setas">
          <span />
          {tecla('↑')}
          <span />
          {tecla('←')}
          {tecla('↓')}
          {tecla('→')}
        </div>
        <span className="briga-teclas-nome">{t('Andar')}</span>
      </div>
      <div className="briga-teclas-grupo">
        {tecla('Z')}
        <span className="briga-teclas-nome">{t('Pular')}</span>
      </div>
      <div className="briga-teclas-grupo">
        {tecla('X')}
        <span className="briga-teclas-nome">{t('Bater')}</span>
      </div>
      <div className="briga-teclas-grupo">
        {tecla('C')}
        <span className="briga-teclas-nome">{t('Especial')}</span>
      </div>
    </div>
  );
}

/** Os botões da tela de toque: o direcional à esquerda, e bater, pular e o especial à direita. */
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
