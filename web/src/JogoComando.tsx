import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import { useT } from './i18n';
import type { Partida } from './minijogos';
import { desenharBarraDoChefe, desenharOndas, desenharSeta, folhaDe } from './briga/desenho';
import { carregarFolhas } from './briga/sprites';
import { ACOES, ARMAS, ARMA_MS, GRANADA, W, H } from './comando/conta';
import {
  desenharAvisos,
  desenharBala,
  desenharBalasInimigas,
  desenharBicho,
  desenharComando,
  desenharEfeito,
  desenharFundo,
  desenharGaiolas,
  desenharGranada,
  desenharMinhaMao,
  desenharPlataformas,
} from './comando/desenho';
import { pilotoAutomatico } from './comando/piloto';
import { Cliente, comandosVazios, ehQuadro, marcaDoLugar, type Comandos, type EstadoComando } from './comando/regras';
import './comando/comando.css';

/**
 * O COMANDO CENOURA (16/11/2026, server/src/comando/motor.ts): correr e atirar de lado, em turma de 1 a 4, na floresta. O
 * lança-cenouras mira em oito direções (as setas enquanto se atira), a granada tem recarga, as gaiolas no caminho dão reforço
 * (o leque de três e a rápida), e o dragão espera no fim. O desenho é o da Briga na horta (o coelho, os bichos, a floresta) e o
 * resto por código (comando/desenho.ts).
 *
 * O MEU COELHO CORRE AQUI, na hora (comando/regras.ts, o Cliente), e a posição vai ao servidor ~15 vezes por segundo. Os bichos
 * e os outros chegam no quadro do servidor (20 por segundo) e são desenhados ~100 ms atrás, interpolados. As minhas balas voam
 * aqui, e quando encostam num bicho COMO ELE ESTÁ NA MINHA TELA, o acerto vai ao servidor, que confere.
 */

declare global {
  interface Window {
    /** Só no desenvolvimento: o coelho atira, pula e anda sozinho. */
    comandoPilotoAutomatico?: boolean;
  }
}

/** O teclado: setas ou WASD correm e miram, X/J atira (segurando), Z/K/Espaço pula, C/L solta a granada. */
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
      else if (k === 'x' || k === 'j') cmd.atirar = apertada;
      else if (k === 'z' || k === 'k' || k === ' ') {
        if (apertada && !e.repeat) cmd.pulo = true;
      } else if (k === 'c' || k === 'l') {
        if (apertada && !e.repeat) cmd.granada = true;
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

interface Hud {
  linhas: { userId: number; vidas: number; hp: number; pontos: number; estado: number }[];
  fase: EstadoComando['fase'] | null;
  meuEstado: number;
}

export function JogoComando({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoComando & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const doServidor = estado.resultado;
    const linhas = doServidor ?? estado.jogadores.map((j) => ({ ...j, acertos: 0, derrubados: 0, posicao: 1 + estado.jogadores.filter((o) => o.pontos > j.pontos).length }));
    const regra = { venceu: !!doServidor && estado.venceu, solo: estado.solo === true, ficaram: linhas.filter((l) => l.posicao !== null).length };
    return (
      <div className="briga comando">
        <p className="briga-desfecho">{estado.venceu ? t('Vitória!') : t('Derrota')}</p>
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
  estado: EstadoComando & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cmd] = useState(comandosVazios);
  const [hud, setHud] = useState<Hud>({ linhas: [], fase: null, meuEstado: 0 });
  const solo = estado.solo === true;
  useTeclado(jogador, cmd);

  const pessoas = useRef(new Map<number, { nome: string; avatar: number | string | null }>());
  for (const j of estado.jogadores) pessoas.current.set(j.userId, { nome: j.username, avatar: j.avatar });

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g || !socket) return;
    g.imageSmoothingEnabled = false;
    const folha = new Image();
    folha.src = `${import.meta.env.BASE_URL}briga/coelho.png`;
    carregarFolhas(['cogumelo', 'dino', 'abelha', 'dragao']);
    const enviar = (dados: unknown) =>
      solo ? socket.emit('minijogo-solo:tempo-real', { dados }) : socket.emit('minijogo:tempo-real', { channelId, dados });
    const cliente = new Cliente(eu, enviar);
    let quadroId = 0;
    let anterior = performance.now();
    let sobra = 0;
    let ultimoHud = 0;
    let camX = 0;
    const piloto = () => import.meta.env.DEV && !!window.comandoPilotoAutomatico;
    const menosMovimento = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (import.meta.env.DEV) (window as unknown as { comandoDoTeste?: unknown }).comandoDoTeste = cliente;

    const aoQuadro = (m: { channelId?: number; dados?: unknown }) => {
      if (!solo && m.channelId !== channelId) return;
      if (ehQuadro(m.dados)) cliente.chegou(m.dados, performance.now());
    };
    const evento = solo ? 'minijogo-solo:tempo-real' : 'minijogo:tempo-real';
    socket.on(evento, aoQuadro);

    const quadro = () => {
      quadroId = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - anterior) / 1000);
      anterior = agora;
      // O MEU COELHO: passos fixos de 1/60 s (sem foco, as teclas já foram soltas; o jogo é de turma e segue)
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        if (!jogador) continue;
        const v = cliente.vista(agora);
        if (piloto() && cliente.jogando()) pilotoAutomatico(cliente.eu, v, cmd);
        cliente.passo(cmd, 1 / 60, agora, v);
      }
      for (const s of cliente.sons.splice(0)) tocar(s);
      const v = cliente.vista(agora);

      const ultimo = cliente.linha.ultimo();
      if (agora - ultimoHud > 200 && ultimo) {
        ultimoHud = agora;
        setHud({
          linhas: ultimo.j.map((l) => ({ userId: l[0], vidas: l[7], hp: l[8], pontos: l[9], estado: l[10] })),
          fase: ultimo.f,
          meuEstado: cliente.eu.estado,
        });
      }

      // a janela sem foco não desenha (sem foco nada se mexe)
      if (!piloto() && (document.hidden || !document.hasFocus())) return;
      const tempo = menosMovimento ? Math.floor(agora / 400) * 400 : agora;
      // a câmera: na onda, a arena; avançando, segue o meu coelho (ou quem está mais à frente, para quem assiste)
      const [a0, a1] = v.arena;
      const foco = jogador && cliente.eu.estado === 0 ? cliente.eu.x : Math.max(a0 + W / 2, ...v.coelhos.filter((l) => l[10] === 0).map((l) => l[1]));
      const alvoCam = Math.max(a0, Math.min(a1 - W, foco - W * 0.4));
      camX += (alvoCam - camX) * Math.min(1, dt * 8);
      if (Math.abs(alvoCam - camX) < 0.5) camX = alvoCam;
      const cx = Math.round(camX);

      desenharFundo(g, cx, tempo);
      desenharPlataformas(g, cx);
      desenharGaiolas(g, cx, v.gaiolas, folhaDe(folha, null), tempo);
      desenharAvisos(g, v.bichos, cx, tempo);
      // quem leva bala pisca branco, alternando (com a arma rápida, branco direto apagava o bicho)
      for (const b of v.bichos) desenharBicho(g, b, cx, tempo, (cliente.bichosPiscando.get(b.id) ?? 0) > agora && Math.floor(agora / 50) % 3 === 0);
      for (const l of v.coelhos) {
        if (l[0] === eu && jogador) continue;
        if (l[10] === 1) continue;
        const p = pessoas.current.get(l[0]);
        desenharComando(g, folhaDe(folha, p?.avatar ?? (l[11] || null)), cx, l[1], l[2], l[3], l[10] === 2 ? 'caido' : (ACOES[l[4]] ?? 'parado'), l[5], l[6], {
          nome: p?.nome,
          piscando: l[14] > 0,
          arma: ARMAS[l[12]],
        });
      }
      if (jogador && cliente.eu.estado !== 1) {
        const meu = cliente.eu;
        desenharComando(g, folhaDe(folha, pessoas.current.get(eu)?.avatar ?? null), cx, meu.x, meu.h, meu.lado, meu.estado === 2 ? 'caido' : meu.acao, meu.estado === 2 ? 999 : meu.t, meu.mira, {
          nome: v.coelhos.length > 1 ? pessoas.current.get(eu)?.nome : undefined,
          eu: true,
          piscando: meu.estado === 0 && meu.relogio < meu.piscandoAte,
          subindo: meu.vh > 0,
          arma: meu.arma,
        });
      }
      desenharBalasInimigas(g, v.balas, cx, tempo);
      for (const b of v.balasDosOutros) desenharBala(g, b.x, b.h, b.dx, b.dh, cx, false);
      for (const b of cliente.minhasBalas(agora)) desenharBala(g, b.x, b.h, b.dx, b.dh, cx, true);
      for (const gr of v.granadas) desenharGranada(g, gr.x0, gr.h0, gr.x, Math.max(0, Math.min(1, 1 - gr.resta / GRANADA.voo)), cx);
      for (let k = cliente.efeitos.length - 1; k >= 0; k--) if (!desenharEfeito(g, cliente.efeitos[k], cx, agora)) cliente.efeitos.splice(k, 1);
      const chefe = v.bichos.find((b) => b.tipo === 'dragao' && b.estado !== 'morto');
      if (chefe) desenharBarraDoChefe(g, chefe.hp);
      desenharOndas(g, v.onda + (v.fase === 'avancando' ? 1 : 0), 5);
      if (v.fase === 'avancando') desenharSeta(g, tempo);
      if (jogador && cliente.eu.estado === 0) {
        const resta = cliente.eu.armaAte ? Math.max(0, cliente.eu.armaAte - cliente.eu.relogio) / ARMA_MS : 0;
        desenharMinhaMao(g, cliente.eu.arma, resta, cliente.cargaDaGranada());
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
    hud.fase === 'vitoria' ? t('Vitória!') : hud.fase === 'derrota' ? t('Derrota') : jogador && hud.meuEstado === 2 ? t('Sem vidas.') : null;

  return (
    <div className="briga comando">
      <ul className="briga-hud" aria-live="off">
        {hud.linhas.map((l) => (
          <li key={l.userId} className={(l.userId === eu ? 'eu' : '') + (l.estado === 2 ? ' comando-fora' : '')}>
            <span className="minijogo-nome">{nome(l.userId)}</span>
            <strong>{l.pontos}</strong>
            <span className="briga-vidas" aria-hidden="true">
              {'♥'.repeat(Math.max(0, l.vidas))}
            </span>
            <span className="comando-golpes" aria-hidden="true">
              {'■'.repeat(l.estado === 0 ? Math.max(0, l.hp) : 0)}
            </span>
          </li>
        ))}
      </ul>
      <div className="briga-tela">
        <canvas ref={canvas} width={W} height={H} />
        {aviso && <p className="briga-aviso">{aviso}</p>}
      </div>
      {jogador && <Toque cmd={cmd} />}
      {jogador && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas', 'wasd'], rotulo: t('Andar e mirar') },
            { teclas: ['x'], rotulo: t('Atirar') },
            { teclas: ['z', 'espaco'], rotulo: t('Pular') },
            { teclas: ['c'], rotulo: t('Granada') },
          ]}
        />
      )}
    </div>
  );
}

/** Os botões da tela de toque: o direcional à esquerda (corre e mira), e pular, atirar (segurando) e a granada à direita. */
function Toque({ cmd }: { cmd: Comandos }) {
  const t = useT();
  const segurar = (k: 'esquerda' | 'direita' | 'cima' | 'baixo' | 'atirar') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cmd[k] = true;
    },
    onPointerUp: () => (cmd[k] = false),
    onPointerCancel: () => (cmd[k] = false),
    onPointerLeave: () => (cmd[k] = false),
  });
  const apertar = (k: 'pulo' | 'granada') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cmd[k] = true;
    },
  });
  return (
    <div className="briga-toque">
      <div className="briga-direcional" role="group" aria-label={t('Andar e mirar')}>
        <button type="button" className="briga-cima" aria-hidden="true" tabIndex={-1} {...segurar('cima')}>▲</button>
        <button type="button" className="briga-esq" aria-hidden="true" tabIndex={-1} {...segurar('esquerda')}>◀</button>
        <button type="button" className="briga-dir" aria-hidden="true" tabIndex={-1} {...segurar('direita')}>▶</button>
        <button type="button" className="briga-baixo" aria-hidden="true" tabIndex={-1} {...segurar('baixo')}>▼</button>
      </div>
      <div className="briga-botoes">
        <button type="button" aria-label={t('Granada')} {...apertar('granada')}>✿</button>
        <button type="button" aria-label={t('Pular')} {...apertar('pulo')}>⤒</button>
        <button type="button" aria-label={t('Atirar')} {...segurar('atirar')}>●</button>
      </div>
    </div>
  );
}
