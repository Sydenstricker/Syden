import { ComandosDoJogo } from './ComandosDosJogos';
import { tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import { useT } from './i18n';
import type { Partida } from './minijogos';
import { desenharCoelho, desenhoDoCoelho, folhaDe } from './briga/desenho';
import type { Acao } from './briga/regras';
import { ACOES, BOMBA, H, W, type AcaoDoCoelho } from './chefe/conta';
import {
  desenharArena,
  desenharBomba,
  desenharChefe,
  desenharEfeito,
  desenharMarcaNoChao,
  desenharNoAr,
  desenharTorraoNoChao,
  desenharVidaDoChefe,
  sombra,
  torrao,
} from './chefe/desenho';
import { pilotoAutomatico } from './chefe/piloto';
import { Cliente, comandosVazios, ehQuadro, marcaDoLugar, type Comandos, type EstadoChefe } from './chefe/regras';
import './chefe/chefe.css';

/**
 * O CHEFE DA TURMA (05/11/2026, server/src/chefe/motor.ts): a turma inteira contra a toupeira-rei, numa arena da horta vista de
 * cima. Desviar do que cai (os avisos no chão), pegar o torrão frio (azulado) e atirá-lo de volta; uma bomba de semente por
 * fase. O desenho é todo daqui (chefe/desenho.ts); o coelho é o da Briga na horta, com as cores do avatar.
 *
 * O MEU COELHO ANDA AQUI, na hora (chefe/regras.ts, o Cliente), e a posição vai ao servidor ~15 vezes por segundo. A
 * toupeira e os outros chegam no quadro do servidor (20 por segundo) e são desenhados ~100 ms atrás, interpolados. O meu
 * torrão voa aqui, e quando encosta na toupeira COMO ELA ESTÁ NA MINHA TELA, o acerto vai ao servidor, que confere.
 */

declare global {
  interface Window {
    /** Só no desenvolvimento: o coelho desvia, pega e atira sozinho. */
    chefePilotoAutomatico?: boolean;
  }
}

const ACAO_NA_FOLHA: Record<AcaoDoCoelho, Acao> = { parado: 'parado', andando: 'andando', atirando: 'soco1', dor: 'dor', caido: 'caido' };

/** O teclado: setas ou WASD andam, X/J/Espaço atira o torrão, C/L solta a bomba de semente. */
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
        if (apertada && !e.repeat) cmd.atirar = true;
      } else if (k === 'c' || k === 'l') {
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

interface Hud {
  linhas: { userId: number; vidas: number; pontos: number; estado: number }[];
  fase: EstadoChefe['fase'] | null;
  faseDoChefe: number;
  dano: number;
  meuEstado: number;
  segura: boolean;
  bomba: boolean;
}

export function JogoChefe({
  estado,
  eu,
  jogador,
  socket,
  channelId,
}: {
  estado: EstadoChefe & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  if (estado.terminada || estado.fase === 'fim') {
    const doServidor = estado.resultado;
    const linhas = doServidor ?? estado.jogadores.map((j) => ({ ...j, acertos: 0, posicao: 1 + estado.jogadores.filter((o) => o.pontos > j.pontos).length }));
    const regra = { venceu: !!doServidor && estado.venceu, solo: estado.solo === true, ficaram: linhas.filter((l) => l.posicao !== null).length };
    return (
      <div className="briga chefe">
        <p className="briga-desfecho">{estado.venceu ? t('A toupeira-rei caiu!') : t('A turma caiu.')}</p>
        <p className="chefe-dano-final">{t('Dano da turma: {n}', { n: estado.danoDaTurma })}</p>
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
  estado: EstadoChefe & Partida;
  eu: number;
  jogador: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cmd] = useState(comandosVazios);
  const [hud, setHud] = useState<Hud>({ linhas: [], fase: null, faseDoChefe: 1, dano: 0, meuEstado: 0, segura: false, bomba: true });
  const solo = estado.solo === true;
  const fases = estado.fases || 3;
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
    const enviar = (dados: unknown) =>
      solo ? socket.emit('minijogo-solo:tempo-real', { dados }) : socket.emit('minijogo:tempo-real', { channelId, dados });
    const cliente = new Cliente(eu, enviar);
    const piscandoChefe = { ate: 0 };
    let quadroId = 0;
    let anterior = performance.now();
    let sobra = 0;
    let ultimoHud = 0;
    const piloto = () => import.meta.env.DEV && !!window.chefePilotoAutomatico;
    const menosMovimento = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const aoQuadro = (m: { channelId?: number; dados?: unknown }) => {
      if (!solo && m.channelId !== channelId) return;
      if (!ehQuadro(m.dados)) return;
      const antes = cliente.efeitos.length;
      cliente.chegou(m.dados, performance.now());
      // um acerto em quem quer que seja: a toupeira pisca
      if (cliente.efeitos.slice(antes).some((e) => e.tipo === 'acerto')) piscandoChefe.ate = performance.now() + 260;
    };
    const evento = solo ? 'minijogo-solo:tempo-real' : 'minijogo:tempo-real';
    socket.on(evento, aoQuadro);

    const quadro = () => {
      quadroId = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - anterior) / 1000);
      anterior = agora;
      // O MEU COELHO: passos fixos de 1/60 s
      sobra += dt;
      while (sobra >= 1 / 60) {
        sobra -= 1 / 60;
        const v = cliente.vista(agora);
        if (!jogador) continue;
        if (piloto() && cliente.jogando()) pilotoAutomatico(cliente.eu, v, cmd);
        cliente.passo(cmd, 1 / 60, agora, v);
      }
      for (const s of cliente.sons.splice(0)) tocar(s);
      const v = cliente.vista(agora);

      // o placar de cima, umas 5 vezes por segundo
      const ultimo = cliente.linha.ultimo();
      if (agora - ultimoHud > 200 && ultimo) {
        ultimoHud = agora;
        setHud({
          linhas: ultimo.j.map((l) => ({ userId: l[0], vidas: l[6], pontos: l[7], estado: l[8] })),
          fase: ultimo.f,
          faseDoChefe: ultimo.c[6] + 1,
          dano: ultimo.d,
          meuEstado: cliente.eu.estado,
          segura: cliente.eu.segura,
          bomba: cliente.eu.bomba,
        });
      }

      // a janela sem foco não desenha (o jogo segue: é de turma, e a posição continua indo)
      if (!piloto() && (document.hidden || !document.hasFocus())) return;
      const tempo = menosMovimento ? Math.floor(agora / 400) * 400 : agora;
      desenharArena(g);
      for (const m of v.marcas) desenharMarcaNoChao(g, m, tempo);
      for (const tc of v.noChao) desenharTorraoNoChao(g, tc.x, tc.y, tc.resta, tempo);

      // os bichos, de trás para a frente
      const coisas: { y: number; desenhar: () => void }[] = [];
      if (v.chefe) {
        const ch = v.chefe;
        coisas.push({ y: ch.y, desenhar: () => desenharChefe(g, ch, tempo, piscandoChefe.ate > agora) });
      }
      const imagem = folhaDe(folha, null);
      for (const l of v.coelhos) {
        if (l[0] === eu && jogador) continue;
        if (l[8] === 2) {
          // sem vidas: deitado, de lado
          coisas.push({ y: l[2], desenhar: () => desenharCoelho(g, folhaDe(folha, pessoas.current.get(l[0])?.avatar ?? (l[9] || null)) ?? imagem, Math.round(l[1]), Math.round(l[2]), l[3], desenhoDoCoelho('caido', 999, false), { nome: pessoas.current.get(l[0])?.nome }) });
          continue;
        }
        const acao = ACAO_NA_FOLHA[ACOES[l[4]] ?? 'parado'];
        coisas.push({
          y: l[2],
          desenhar: () => {
            sombra(g, l[1], l[2], 9, 3);
            const f = folhaDe(folha, pessoas.current.get(l[0])?.avatar ?? (l[9] || null)) ?? imagem;
            desenharCoelho(g, f, Math.round(l[1]), Math.round(l[2]), l[3], desenhoDoCoelho(acao, l[5], false), {
              nome: pessoas.current.get(l[0])?.nome,
              piscando: (cliente.piscando.get(l[0]) ?? 0) > agora || l[12] > 0,
            });
            if (l[10] === 1) torrao(g, l[1], l[2] - 62, true, tempo);
          },
        });
      }
      if (jogador) {
        const meu = cliente.eu;
        const f = folhaDe(folha, pessoas.current.get(eu)?.avatar ?? null);
        coisas.push({
          y: meu.y + 0.01,
          desenhar: () => {
            sombra(g, meu.x, meu.y, 9, 3);
            const acao = ACAO_NA_FOLHA[meu.estado !== 0 ? 'caido' : meu.acao];
            desenharCoelho(g, f, Math.round(meu.x), Math.round(meu.y), meu.lado, desenhoDoCoelho(acao, meu.estado !== 0 ? 999 : meu.t, false), {
              nome: v.coelhos.length > 1 ? pessoas.current.get(eu)?.nome : undefined,
              eu: true,
              piscando: meu.estado === 0 && meu.relogio < meu.piscandoAte,
            });
            if (meu.segura && meu.estado === 0) torrao(g, meu.x, meu.y - 62, true, tempo);
            // a bomba, quando ainda tem, mostra até onde chega (um círculo fraco no chão, só para mim)
            if (meu.bomba && meu.estado === 0 && v.chefe && v.fase === 'lutando') {
              g.globalAlpha = 0.18;
              g.strokeStyle = '#9cc072';
              g.beginPath();
              g.ellipse(meu.x, meu.y, BOMBA.alcance, BOMBA.alcance * 0.62, 0, 0, Math.PI * 2);
              g.stroke();
              g.globalAlpha = 1;
            }
          },
        });
      }
      coisas.sort((a, b) => a.y - b.y).forEach((k) => k.desenhar());

      // o que está no ar, por cima
      for (const m of v.marcas) desenharNoAr(g, m, tempo);
      for (const s of v.tirosDosOutros) {
        sombra(g, s.x, s.y, 3, 1);
        torrao(g, s.x, s.y - 24, true, tempo);
      }
      for (const s of cliente.meusTiros(agora)) {
        sombra(g, s.x, s.y, 3, 1);
        torrao(g, s.x, s.y - 24, true, tempo);
      }
      for (const b of v.bombas) desenharBomba(g, b.x0, b.y0, b.x, b.y, Math.max(0, Math.min(1, 1 - b.resta / BOMBA.voo)));
      for (let k = cliente.efeitos.length - 1; k >= 0; k--) if (!desenharEfeito(g, cliente.efeitos[k], agora)) cliente.efeitos.splice(k, 1);
      if (v.chefe) desenharVidaDoChefe(g, v.chefe.fase, v.chefe.hp, fases);
    };
    quadroId = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(quadroId);
      socket.off(evento, aoQuadro);
      Object.assign(cmd, comandosVazios());
    };
  }, [socket, channelId, solo, eu, jogador, cmd, fases]);

  const nome = (id: number) => pessoas.current.get(id)?.nome ?? '';
  const aviso =
    hud.fase === 'vitoria'
      ? t('A toupeira-rei caiu!')
      : hud.fase === 'derrota'
        ? t('A turma caiu.')
        : jogador && hud.meuEstado === 2
          ? t('Sem vidas: agora é torcer pela turma.')
          : null;

  return (
    <div className="briga chefe">
      <div className="chefe-topo">
        <span>{t('Fase {n} de {total}', { n: Math.min(fases, hud.faseDoChefe), total: fases })}</span>
        <strong>{t('Dano da turma: {n}', { n: hud.dano })}</strong>
        {jogador && hud.meuEstado === 0 && (
          <span className="chefe-mao" aria-live="polite">
            {hud.segura ? t('Torrão na mão!') : ''} {hud.bomba ? t('Bomba de semente pronta') : ''}
          </span>
        )}
      </div>
      <ul className="briga-hud" aria-live="off">
        {hud.linhas.map((l) => (
          <li key={l.userId} className={(l.userId === eu ? 'eu' : '') + (l.estado === 2 ? ' chefe-fora' : '')}>
            <span className="minijogo-nome">{nome(l.userId)}</span>
            <strong>{l.pontos}</strong>
            <span className="briga-vidas" aria-hidden="true">
              {'♥'.repeat(Math.max(0, l.vidas))}
            </span>
          </li>
        ))}
      </ul>
      <div className="briga-tela chefe-tela">
        <canvas ref={canvas} width={W} height={H} />
        {aviso && <p className="briga-aviso">{aviso}</p>}
      </div>
      {jogador && <Toque cmd={cmd} />}
      {jogador && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], rotulo: t('Andar') },
            { teclas: ['x', 'espaco'], rotulo: t('Atirar o torrão') },
            { teclas: ['c'], rotulo: t('Bomba de semente') },
          ]}
        />
      )}
      {jogador && (
        <p className="settings-hint briga-dica">
          {t('Fuja das marcas no chão. Passe por cima de um torrão azulado para pegá-lo e atire de volta na toupeira; a bomba de semente é uma por fase.')}
        </p>
      )}
    </div>
  );
}

/** Os botões da tela de toque: o direcional à esquerda, atirar e a bomba à direita. */
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
  const apertar = (k: 'atirar' | 'bomba') => ({
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
        <button type="button" aria-label={t('Bomba de semente')} {...apertar('bomba')}>✿</button>
        <button type="button" aria-label={t('Atirar o torrão')} {...apertar('atirar')}>●</button>
      </div>
    </div>
  );
}
