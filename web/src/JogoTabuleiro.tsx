import { useEffect, useRef, useState } from 'react';
import { coresDoJogador, type AvatarDoJogo } from './coelho/cores';
import { BotoesDosRobos, cadaUmPorSi } from './EscolhaDosRobos';
import { chave, useT } from './i18n';
import { RodadaDaFesta } from './JogoFesta';
import { Placar, Relogio } from './Minijogo';
import type { EfeitoDaCasa, EstadoTabuleiro, Partida } from './minijogos';
import { tocar } from './somDosJogos';
import type { DadosDoTabuleiro3D } from './tabuleiro3d/cena';
import { TabuleiroDaTurma3D } from './tabuleiro3d/TabuleiroDaTurma3D';
import { Bifurcacao, EscolhaDoDuelo, ItensDe, Loja, NOME_DO_ITEM, PremiosBonus, UsarItens } from './TabuleiroPaineis';
import type { IdDoTabuleiro, ItemDoTabuleiro } from './minijogos';

/**
 * O TABULEIRO DA TURMA (03/11/2026, server/src/minijogo-tabuleiro-da-turma.ts): o tabuleiro de festa, só a mecânica, desenhado
 * aqui por código — uma volta de 30 casas em volta de uma horta, vista de cima, com cara de 16 bits. Cada um, na sua vez, pede
 * o dado (quem sorteia é o servidor) e a peça anda casa a casa na tela; depois que todo mundo andou, a turma joga um microjogo
 * da Festa (a mesma tela: RodadaDaFesta).
 */

// Os mesmos números do servidor.
const PASSO_MS = 280;
const TEMPO_DA_VEZ = 20_000;
const TEMPO_DA_LOJA = 12_000;
const TEMPO_DO_CAMINHO = 10_000;
const TEMPO_DOS_ITENS = 12_000;
const TEMPO_DO_DUELO = 12_000;
const PREMIO_MS = 2500;
const PREMIOS_TOTAL_MS = 3 * PREMIO_MS + 2000;
/** As fases em que a peça de quem jogou anda na tela. */
const FASES_DO_ANDAR = ['andando', 'loja', 'caminho', 'itens', 'duelo'];
import { BORDA, CASA, lugarDaCasa, MEDIDAS_2D, RAMAIS_PADRAO } from './tabuleiroLugares';
export { lugarDaCasa, MEDIDAS_2D };

const COR_DA_CASA: Record<string, [string, string]> = {
  i: ['#e8d9c0', '#a89276'],
  '+': ['#8fb86a', '#5e8a44'],
  '-': ['#c46a52', '#8e4434'],
  '?': ['#8e7cc3', '#5f5290'],
  // 19/11/2026: a loja de itens e o duelo
  $: ['#5fb8b0', '#3e8a84'],
  d: ['#f0a04a', '#b8702e'],
  // 24/11/2026: a correnteza do rio e o escorrega da serra
  c: ['#4f9fd6', '#356f9a'],
  e: ['#b08a5c', '#7a5c3a'],
};

/** As cores de quem não tem avatar pronto: uma por lugar na ordem. */
const CORES_SEM_AVATAR = ['#d9774f', '#7d93c4', '#7fae8a', '#c98aa8', '#e3b45a', '#5fa8a0', '#b8743f', '#9c86c0'];
const hex = ([r, g, b]: [number, number, number]) => 'rgb(' + [r, g, b].join(',') + ')';
export function coresDe(avatar: number | string | null, i: number) {
  const a = coresDoJogador(avatar);
  return a ? { pelo: hex(a.pelo), roupa: hex(a.roupa) } : { pelo: '#e8dccb', roupa: CORES_SEM_AVATAR[i % CORES_SEM_AVATAR.length] };
}

/** As cores do coelho 3D: as do avatar pronto; sem ele, o pelo do mascote e a roupa do lugar na ordem (para as peças não ficarem iguais). */
export function coresDe3D(avatar: number | string | null, i: number): { pelo: string | null; roupa: string } {
  const a = coresDoJogador(avatar);
  return a ? { pelo: hex(a.pelo), roupa: hex(a.roupa) } : { pelo: null, roupa: CORES_SEM_AVATAR[i % CORES_SEM_AVATAR.length] };
}

/** O que a casa fez, para subir em cima das peças na cena 3D (só números: nada a traduzir). */
function efeitosNaCena(ultimo: EstadoTabuleiro['ultimo'], participantes: EstadoTabuleiro['participantes']): DadosDoTabuleiro3D['efeitos'] {
  const e = ultimo?.efeito;
  if (!ultimo || !e) return [];
  const um = (userId: number, texto: string, bom: boolean) => ({ id: `${ultimo.id}-${userId}`, userId, texto, bom });
  switch (e.tipo) {
    case 'mais':
    case 'achado':
      return [um(ultimo.userId, `+${e.valor} 🥕`, true)];
    case 'menos':
    case 'praga':
      return e.valor ? [um(ultimo.userId, `−${e.valor} 🥕`, false)] : [];
    case 'chuva':
      return participantes.map((p) => um(p.userId, `+${e.valor} 🥕`, true));
    case 'mutirao':
      return participantes.map((p) => um(p.userId, `= ${e.valor} 🥕`, true));
    case 'escudo':
      return [um(ultimo.userId, '🛡', true)];
    // os tabuleiros novos (24/11/2026)
    case 'correnteza':
      return [um(ultimo.userId, `🌊 +${e.valor}`, true)];
    case 'escorrega':
      return [um(ultimo.userId, `↩ −${e.valor}`, false)];
    case 'cheia':
      return participantes.filter((p) => p.presente).map((p) => um(p.userId, `🌊 +${e.valor}`, true));
    case 'teleferico':
      return [um(ultimo.userId, '🚡', true)];
    default:
      return [];
  }
}

/**
 * Os sons do andar (somDosJogos.ts, os efeitos que já existem): o dado quando sai, um pulo por casa, e ao chegar a moeda (ganhou)
 * ou o erro (perdeu); comprar a dourada é o acerto. Só o que acontece com a tela aberta: o estado de quando ela abriu fica calado.
 */
function useSonsDoAndar(ultimo: EstadoTabuleiro['ultimo'], passo: number, chegou: boolean) {
  const visto = useRef<{ id: number | null; passo: number; chegou: boolean } | null>(null);
  useEffect(() => {
    const id = ultimo?.id ?? null;
    const antes = visto.current;
    visto.current = { id, passo, chegou };
    if (!antes || !ultimo) return;
    if (id !== antes.id) {
      tocar('dado');
      return;
    }
    if (passo > antes.passo && passo > 0) tocar('pulo');
    if (chegou && !antes.chegou) {
      const e = ultimo.efeito;
      if (ultimo.comprou) tocar('acerto');
      else if (e && (e.tipo === 'mais' || e.tipo === 'achado' || e.tipo === 'chuva')) tocar('moeda');
      else if (e && e.tipo === 'menos' && e.valor) tocar('erro');
      else if (e && (e.tipo === 'correnteza' || e.tipo === 'cheia')) tocar('agua');
      else if (e && e.tipo === 'escorrega') tocar('desliza');
      else if (e && e.tipo === 'teleferico') tocar('mola');
    }
  }, [ultimo, passo, chegou]);
}

/** O item usado na vez (a figura dele). */
function IconeDoUsado({ item }: { item: ItemDoTabuleiro }) {
  return <ItensDe itens={[item]} />;
}

/** A peça: um coelho de frente, de pixels grandes, com a roupa embaixo. */
export function Peca({ pelo, roupa, x, y, vez }: { pelo: string; roupa: string; x: number; y: number; vez: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={vez ? 'tab-peca vez' : 'tab-peca'}>
      <rect x="-6" y="7" width="12" height="3" fill="#2e2620" opacity="0.35" />
      <rect x="-5" y="1" width="10" height="7" fill={roupa} />
      <rect x="-5" y="-6" width="10" height="8" fill={pelo} />
      <rect x="-4" y="-13" width="3" height="8" fill={pelo} />
      <rect x="1" y="-13" width="3" height="8" fill={pelo} />
      <rect x="-3" y="-12" width="1" height="5" fill="#d98a8a" />
      <rect x="2" y="-12" width="1" height="5" fill="#d98a8a" />
      <rect x="-3" y="-3" width="2" height="2" fill="#3a2e2a" />
      <rect x="1" y="-3" width="2" height="2" fill="#3a2e2a" />
      <rect x="-1" y="0" width="2" height="1" fill="#d98a8a" />
      </g>
    </g>
  );
}

/** A cenoura dourada (no tabuleiro e no placar). */
export function CenouraDourada({ tamanho = 16, x, y }: { tamanho?: number; x?: number; y?: number }) {
  return (
    <svg className="tab-dourada-icone" x={x} y={y} width={tamanho} height={tamanho} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="6" y="1" width="2" height="4" fill="#7fae5a" />
      <rect x="9" y="2" width="2" height="3" fill="#7fae5a" />
      <rect x="4" y="5" width="8" height="3" fill="#f2c46a" />
      <rect x="5" y="8" width="6" height="3" fill="#e3a640" />
      <rect x="6" y="11" width="4" height="2" fill="#d08e2c" />
      <rect x="7" y="13" width="2" height="2" fill="#b8741e" />
      <rect x="5" y="6" width="2" height="1" fill="#fff1c8" />
    </svg>
  );
}

/** A face do dado, com os pontos. */
export function Dado({ n, tamanho = 40 }: { n: number; tamanho?: number }) {
  const pontos: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
    6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
  };
  return (
    <svg className="tab-dado" width={tamanho} height={tamanho} viewBox="0 0 20 20" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="1" y="2" width="18" height="17" fill="#a89276" />
      <rect x="1" y="1" width="18" height="16" fill="#f3ead8" />
      {(pontos[n] ?? []).map(([c, l], i) => (
        <rect key={i} x={c * 5 - 1} y={l * 4 - 1} width="3" height="3" fill="#5a3a2a" />
      ))}
    </svg>
  );
}

/** O relógio da tela, a cada quadro, enquanto ligado. */
export function useAgora(ligado: boolean) {
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    if (!ligado) return;
    let id = 0;
    let ultimo = 0;
    const passo = () => {
      // Sem foco, 4 vezes por segundo em vez de a cada quadro (auditoria de 12/11/2026): é o React redesenhando a tela
      // inteira, atrás do jogo de quem tem o Syden aberto ao lado. Não para de vez porque o relógio também fecha a vez.
      const agora = Date.now();
      if (agora - ultimo >= 250 || (!document.hidden && document.hasFocus())) {
        ultimo = agora;
        setAgora(agora);
      }
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [ligado]);
  return agora;
}

/** O miolo da horta (o tabuleiro de sempre): a grama, os canteiros, a toca e o lago. */
function MioloDaHorta() {
  return (
    <>
      <rect width={BORDA * 2 + 11 * CASA} height={BORDA * 2 + 6 * CASA} fill="#62804a" />
      <rect x={BORDA + CASA} y={BORDA + CASA} width={CASA * 9} height={CASA * 4} fill="#7a9a5a" />
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={`g${i}`} x={BORDA + CASA + 6 + ((i * 37) % 244)} y={BORDA + CASA + 6 + ((i * 53) % 98)} width="2" height="2" fill="#8eae6a" />
      ))}
      {/* os canteiros de cenoura, à esquerda */}
      {[0, 1, 2].map((f) => (
        <g key={`c${f}`}>
          <rect x={BORDA + CASA + 10} y={BORDA + CASA + 12 + f * 28} width="84" height="12" fill="#8e6a52" />
          {Array.from({ length: 7 }, (_, k) => (
            <g key={k}>
              <rect x={BORDA + CASA + 14 + k * 12} y={BORDA + CASA + 8 + f * 28} width="2" height="5" fill="#7fae5a" />
              <rect x={BORDA + CASA + 17 + k * 12} y={BORDA + CASA + 9 + f * 28} width="2" height="4" fill="#6a9a4a" />
              <rect x={BORDA + CASA + 15 + k * 12} y={BORDA + CASA + 13 + f * 28} width="3" height="3" fill="#e07a2e" />
            </g>
          ))}
        </g>
      ))}
      {/* a toca, no meio */}
      <rect x={BORDA + CASA * 4.6} y={BORDA + CASA * 2.3} width="48" height="22" fill="#8e7a5a" />
      <rect x={BORDA + CASA * 4.6 + 4} y={BORDA + CASA * 2.3 - 4} width="40" height="6" fill="#a08a66" />
      <rect x={BORDA + CASA * 4.6 + 12} y={BORDA + CASA * 2.3 + 6} width="24" height="16" fill="#3a2c22" />
      <rect x={BORDA + CASA * 4.6 + 16} y={BORDA + CASA * 2.3 + 2} width="16" height="4" fill="#3a2c22" />
      {/* o lago, à direita */}
      <rect x={BORDA + CASA * 7} y={BORDA + CASA * 2.2} width="60" height="40" fill="#5f8fa8" />
      <rect x={BORDA + CASA * 7 - 4} y={BORDA + CASA * 2.2 + 6} width="68" height="28" fill="#5f8fa8" />
      <rect x={BORDA + CASA * 7 + 8} y={BORDA + CASA * 2.2 + 8} width="14" height="2" fill="#9cc2d2" />
      <rect x={BORDA + CASA * 7 + 30} y={BORDA + CASA * 2.2 + 22} width="18" height="2" fill="#9cc2d2" />
    </>
  );
}

/** O miolo do rio (24/11/2026): a grama da margem e o rio atravessando o meio, com a ponte e os peixes. */
function MioloDoRio({ largura, altura }: { largura: number; altura: number }) {
  const x0 = BORDA + CASA;
  const y0 = BORDA + CASA;
  const w = largura - 2 * (BORDA + CASA);
  const h = altura - 2 * (BORDA + CASA);
  const meio = y0 + h / 2;
  return (
    <>
      <rect width={largura} height={altura} fill="#5c8a52" />
      <rect x={x0} y={y0} width={w} height={h} fill="#78a466" />
      {/* o rio, em degraus (cara de 16 bits) */}
      {Array.from({ length: Math.ceil(w / 8) }, (_, k) => {
        const dy = [0, 2, 4, 4, 2, 0, -2, -4, -4, -2][k % 10];
        return (
          <g key={k}>
            <rect x={x0 + k * 8} y={meio - 14 + dy} width="8" height="28" fill="#c9b48f" />
            <rect x={x0 + k * 8} y={meio - 12 + dy} width="8" height="24" fill="#4f8fc8" />
            {k % 3 === 0 && <rect x={x0 + k * 8 + 2} y={meio - 6 + dy} width="5" height="2" fill="#9cc8e6" />}
            {k % 4 === 2 && <rect x={x0 + k * 8} y={meio + 5 + dy} width="6" height="2" fill="#9cc8e6" />}
          </g>
        );
      })}
      {/* a ponte de tábuas no meio */}
      <rect x={x0 + w / 2 - 14} y={meio - 18} width="28" height="36" fill="#8e6a4a" />
      {Array.from({ length: 6 }, (_, k) => (
        <rect key={k} x={x0 + w / 2 - 14} y={meio - 17 + k * 6} width="28" height="1" fill="#6a4a32" />
      ))}
      <rect x={x0 + w / 2 - 16} y={meio - 18} width="2" height="36" fill="#5a3a2a" />
      <rect x={x0 + w / 2 + 14} y={meio - 18} width="2" height="36" fill="#5a3a2a" />
      {/* juncos e um peixe */}
      {[0.12, 0.3, 0.72, 0.88].map((f, k) => (
        <g key={`j${k}`}>
          <rect x={x0 + w * f} y={meio - 20} width="2" height="7" fill="#4f7a3a" />
          <rect x={x0 + w * f + 3} y={meio - 18} width="2" height="5" fill="#6a9a4a" />
        </g>
      ))}
      <rect x={x0 + w * 0.22} y={meio + 2} width="6" height="3" fill="#e3a640" />
      <rect x={x0 + w * 0.22 - 2} y={meio + 1} width="2" height="5" fill="#e3a640" />
    </>
  );
}

/** O miolo da serra (24/11/2026): os morros em degraus, com neve no pico, e as pedras. */
function MioloDaSerra({ largura, altura }: { largura: number; altura: number }) {
  const x0 = BORDA + CASA;
  const y0 = BORDA + CASA;
  const w = largura - 2 * (BORDA + CASA);
  const h = altura - 2 * (BORDA + CASA);
  const morro = (cx: number, base: number, alto: number, cor: string, neve: boolean) =>
    Array.from({ length: Math.floor(alto / 6) }, (_, k) => {
      const meia = ((alto - k * 6) * 1.1) | 0;
      return (
        <g key={`${cx}-${k}`}>
          <rect x={cx - meia} y={base - (k + 1) * 6} width={meia * 2} height="6" fill={cor} />
          {neve && k >= Math.floor(alto / 6) - 2 && <rect x={cx - meia} y={base - (k + 1) * 6} width={meia * 2} height="3" fill="#f3ead8" />}
        </g>
      );
    });
  return (
    <>
      <rect width={largura} height={altura} fill="#7a8a5a" />
      <rect x={x0} y={y0} width={w} height={h} fill="#93a46e" />
      <g>{morro(x0 + w * 0.3, y0 + h - 6, 54, '#8a8478', false)}</g>
      <g>{morro(x0 + w * 0.62, y0 + h - 4, 72, '#7c766b', true)}</g>
      <g>{morro(x0 + w * 0.85, y0 + h - 8, 36, '#958f83', false)}</g>
      {[0.08, 0.18, 0.45, 0.76, 0.93].map((f, k) => (
        <g key={`p${k}`}>
          <rect x={x0 + w * f} y={y0 + h - 10 - (k % 2) * 4} width="8" height="5" fill="#a39d90" />
          <rect x={x0 + w * f + 1} y={y0 + h - 11 - (k % 2) * 4} width="5" height="2" fill="#bdb6a8" />
        </g>
      ))}
    </>
  );
}

/** O desenho do tabuleiro: a horta no meio, a volta de casas, a dourada e as peças. */
function Tabuleiro({ estado, posDe }: { estado: EstadoTabuleiro; posDe: (userId: number) => number }) {
  const ramais = estado.ramais ?? RAMAIS_PADRAO;
  const tabuleiro = estado.tabuleiro ?? 'horta';
  const medidas = MEDIDAS_2D[tabuleiro] ?? MEDIDAS_2D.horta;
  const lugar = (i: number) => lugarDaCasa(i, ramais, medidas);
  const largura = BORDA * 2 + medidas.colunas * CASA;
  const altura = BORDA * 2 + medidas.linhas * CASA;
  // quantas peças em cada casa, para não ficarem uma em cima da outra
  const porCasa = new Map<number, number[]>();
  estado.participantes.forEach((p) => porCasa.set(posDe(p.userId), [...(porCasa.get(posDe(p.userId)) ?? []), p.userId]));
  const deslocamento = (userId: number) => {
    const ids = porCasa.get(posDe(userId)) ?? [userId];
    const i = ids.indexOf(userId);
    if (ids.length === 1) return { dx: 0, dy: 0 };
    const col = i % 4;
    const lin = Math.floor(i / 4);
    return { dx: (col - (Math.min(ids.length, 4) - 1) / 2) * 6, dy: lin * 5 - 2 };
  };
  const dourada = lugar(estado.dourada);
  return (
    <svg className="tab-tabuleiro" viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true" shapeRendering="crispEdges">
      {tabuleiro === 'rio' && <MioloDoRio largura={largura} altura={altura} />}
      {tabuleiro === 'serra' && <MioloDaSerra largura={largura} altura={altura} />}
      {tabuleiro === 'horta' && <MioloDaHorta />}
      {/* as casas */}
      {estado.casas.map((tipo, i) => {
        const { x, y } = lugar(i);
        const [cor, sombra] = COR_DA_CASA[tipo] ?? COR_DA_CASA.i;
        const cx = x + CASA / 2;
        const cy = y + CASA / 2;
        return (
          <g key={i}>
            <rect x={x + 1} y={y + 1} width={CASA - 2} height={CASA - 2} fill={sombra} />
            <rect x={x + 2} y={y + 2} width={CASA - 4} height={CASA - 6} fill={cor} />
            {tipo === '+' && (
              <>
                <rect x={cx - 5} y={cy - 3} width="10" height="2" fill="#f3ead8" />
                <rect x={cx - 1} y={cy - 7} width="2" height="10" fill="#f3ead8" />
              </>
            )}
            {tipo === '-' && <rect x={cx - 5} y={cy - 3} width="10" height="2" fill="#f3ead8" />}
            {tipo === '?' && (
              <>
                <rect x={cx - 1} y={cy - 8} width="2" height="12" fill="#f3ead8" />
                <rect x={cx - 6} y={cy - 3} width="12" height="2" fill="#f3ead8" />
                <rect x={cx - 3} y={cy - 5} width="6" height="6" fill="#f2c46a" />
              </>
            )}
            {tipo === '$' && (
              <>
                {/* a sacola da loja */}
                <rect x={cx - 3} y={cy - 8} width="6" height="2" fill="#f3ead8" />
                <rect x={cx - 4} y={cy - 7} width="2" height="3" fill="#f3ead8" />
                <rect x={cx + 2} y={cy - 7} width="2" height="3" fill="#f3ead8" />
                <rect x={cx - 6} y={cy - 4} width="12" height="9" fill="#f3ead8" />
                <rect x={cx - 2} y={cy - 1} width="4" height="3" fill="#f2c46a" />
              </>
            )}
            {tipo === 'd' && (
              <>
                {/* o duelo: duas cenouras cruzadas */}
                {[-1, 1].map((lado) => (
                  <g key={lado}>
                    {[0, 1, 2, 3, 4].map((k) => (
                      <rect key={k} x={lado > 0 ? cx - 7 + k * 3 : cx + 4 - k * 3} y={cy - 8 + k * 3} width="3" height="3" fill={k === 0 ? '#7fae5a' : '#f3ead8'} />
                    ))}
                  </g>
                ))}
              </>
            )}
            {tipo === 'c' && (
              <>
                {/* a correnteza: duas ondas */}
                {[-4, 2].map((dy) => (
                  <g key={dy}>
                    <rect x={cx - 7} y={cy + dy} width="4" height="2" fill="#f3ead8" />
                    <rect x={cx - 3} y={cy + dy - 2} width="4" height="2" fill="#f3ead8" />
                    <rect x={cx + 1} y={cy + dy} width="4" height="2" fill="#f3ead8" />
                    <rect x={cx + 5} y={cy + dy - 2} width="3" height="2" fill="#f3ead8" />
                  </g>
                ))}
              </>
            )}
            {tipo === 'e' && (
              <>
                {/* o escorrega: a seta para trás */}
                <rect x={cx - 4} y={cy - 6} width="10" height="2" fill="#f3ead8" />
                <rect x={cx + 4} y={cy - 6} width="2" height="8" fill="#f3ead8" />
                <rect x={cx - 4} y={cy + 1} width="10" height="2" fill="#f3ead8" />
                <rect x={cx - 7} y={cy} width="3" height="4" fill="#f3ead8" />
                <rect x={cx - 5} y={cy - 1} width="2" height="6" fill="#f3ead8" />
              </>
            )}
            {tipo === 'i' && (
              <>
                <rect x={cx - 6} y={cy - 9} width="2" height="14" fill="#5a3a2a" />
                <rect x={cx - 4} y={cy - 9} width="9" height="6" fill="#d9774f" />
              </>
            )}
          </g>
        );
      })}
      {/* a cenoura dourada, em cima da casa dela */}
      <g className="tab-dourada" transform={`translate(${dourada.x + 4} ${dourada.y + 1})`}>
        <rect x="0" y="0" width="20" height="22" fill="#f2c46a" opacity="0.35" />
        <CenouraDourada tamanho={20} x={0} y={0} />
      </g>
      {/* as peças: quem está na vez por cima */}
      {[...estado.participantes]
        .map((p, i) => ({ p, i }))
        .sort((a, b) => Number(a.p.userId === estado.vez) - Number(b.p.userId === estado.vez))
        .map(({ p, i }) => {
          const { x, y } = lugar(posDe(p.userId));
          const { dx, dy } = deslocamento(p.userId);
          const cores = coresDe(p.avatar, i);
          return (
            <g key={p.userId} opacity={p.presente ? 1 : 0.45}>
              <Peca pelo={cores.pelo} roupa={cores.roupa} x={x + CASA / 2 + dx} y={y + CASA / 2 + 2 + dy} vez={p.userId === estado.vez} />
            </g>
          );
        })}
    </svg>
  );
}

/** O que a casa fez, numa frase (ou só o número). */
function textoDoEfeito(efeito: EfeitoDaCasa | null, nome: string, nomeDe: (id: number) => string, t: ReturnType<typeof useT>): string | null {
  if (!efeito) return null;
  switch (efeito.tipo) {
    case 'mais':
      return `+${efeito.valor} 🥕`;
    case 'menos':
      return efeito.valor ? `−${efeito.valor} 🥕` : null;
    case 'chuva':
      return t('Chuva na horta: todo mundo ganha {n} cenouras.', { n: efeito.valor });
    case 'achado':
      return t('{nome} achou {n} cenouras escondidas.', { nome, n: efeito.valor });
    case 'troca':
      return t('{nome} trocou de lugar com {outro}.', { nome, outro: nomeDe(efeito.com) });
    case 'praga':
      return t('Praga na horta: {nome} perde {n} cenouras.', { nome, n: efeito.valor });
    case 'vento':
      return t('O vento levou a cenoura dourada para outra casa.');
    case 'mutirao':
      return t('Mutirão: a turma dividiu as cenouras, {n} para cada.', { n: efeito.valor });
    case 'brinde':
      return t('{nome} ganhou um item: {item}.', { nome, item: t(NOME_DO_ITEM[efeito.item]) });
    case 'escudo':
      return t('O escudo segurou a perda.');
    // os tabuleiros novos (24/11/2026)
    case 'correnteza':
      return t('A correnteza levou {nome} {n} casas adiante.', { nome, n: efeito.valor });
    case 'escorrega':
      return t('{nome} escorregou {n} casas para trás.', { nome, n: efeito.valor });
    case 'cheia':
      return t('O rio encheu: todo mundo andou {n} casas.', { n: efeito.valor });
    case 'teleferico':
      return t('{nome} subiu de teleférico até perto da cenoura dourada.', { nome });
    default:
      return null;
  }
}

export function JogoTabuleiro({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoTabuleiro & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const nomeDe = (id: number) => estado.participantes.find((p) => p.userId === id)?.username ?? '';
  // O ANDAR NA TELA: a peça de quem jogou passa casa a casa pelo caminho, a partir de quando o estado chegou aqui.
  const andando = useRef<{ id: number; em: number } | null>(null);
  const [pedido, setPedido] = useState('');
  const [usando, setUsando] = useState<ItemDoTabuleiro | null>(null);
  const ultimo = estado.ultimo;
  const noAndar = FASES_DO_ANDAR.includes(estado.fase);
  if (ultimo && noAndar && andando.current?.id !== ultimo.id) {
    andando.current = { id: ultimo.id, em: estado.recebidaEm };
  }
  const duracao = ultimo ? (ultimo.caminho.length - 1) * PASSO_MS : 0;
  const inicio = andando.current && ultimo && andando.current.id === ultimo.id ? andando.current.em : null;
  const animando = inicio !== null && Date.now() - inicio < duracao;
  const agora = useAgora(animando);
  // fora da animação, a peça já chegou (inclusive o andar de zero casas, o resto depois da loja)
  const passo = animando ? Math.floor((Math.max(agora, inicio) - inicio) / PASSO_MS) : Infinity;
  const chegou = !ultimo || passo >= ultimo.caminho.length - 1;
  // ENQUANTO A PEÇA ANDA, o tabuleiro é o de quando ela saiu: as contas, as outras peças e a dourada só mudam quando ela chega
  const antes = ultimo && !chegou ? new Map(ultimo.antes.pecas.map((p) => [p.userId, p])) : null;
  const vista: EstadoTabuleiro & Partida = antes
    ? {
        ...estado,
        dourada: ultimo!.antes.dourada,
        participantes: estado.participantes.map((p) => {
          const a = antes.get(p.userId);
          return a ? { ...p, pos: a.pos, cenouras: a.cenouras, douradas: a.douradas } : p;
        }),
      }
    : estado;
  const posDe = (userId: number) => {
    const p = vista.participantes.find((x) => x.userId === userId)!;
    if (ultimo && ultimo.userId === userId && !chegou) return ultimo.caminho[Math.max(0, passo)];
    return p.pos;
  };
  useSonsDoAndar(ultimo, animando ? passo : -1, chegou && noAndar);
  // os prêmios bônus: um a cada PREMIO_MS, a partir de quando a fase começou (pelo relógio da partida)
  const agoraDosPremios = useAgora(estado.fase === 'premios');
  const premiosMostrados =
    estado.fase === 'premios'
      ? Math.min(3, Math.floor((PREMIOS_TOTAL_MS - Math.max(0, estado.restanteMs - (agoraDosPremios - estado.recebidaEm))) / PREMIO_MS) + 1)
      : estado.premios
        ? 3
        : 0;
  const premiosAntes = useRef(0);
  useEffect(() => {
    if (premiosMostrados > premiosAntes.current && estado.fase === 'premios') tocar('medalha');
    premiosAntes.current = premiosMostrados;
  }, [premiosMostrados, estado.fase]);

  if (estado.terminada || estado.fase === 'fim') {
    // Só quem ficou até o fim tem posição e medalha (as mesmas dos troféus); quem saiu vem depois, sem posição. Na partida
    // interrompida, ninguém: nem medalha, nem "Fim de jogo!".
    // `saiu` vem por linha do servidor (revisão independente, 03/11/2026: sem pódio, a tela dizia "Saiu antes do fim" de todo
    // mundo, inclusive de quem nunca saiu). O tipo de minijogos.ts ainda não tem o campo: vai aqui até ele ganhar.
    const classificacao = estado.classificacao as (EstadoTabuleiro['classificacao'][number] & { saiu?: boolean })[];
    const valor = (l: { douradas: number; cenouras: number }) => `★ ${l.douradas} · 🥕 ${l.cenouras}`;
    const comPosicao = estado.interrompida ? [] : classificacao.filter((l) => l.posicao !== null);
    const semPosicao = classificacao.filter((l) => !comPosicao.includes(l));
    return (
      <div className="tabuleiro-jogo">
        {estado.interrompida && <p className="minijogo-situacao">{t('Faltou gente: a partida acabou antes do fim, sem troféus.')}</p>}
        {!estado.interrompida && comPosicao.length === 0 && (
          <p className="minijogo-situacao">{t('Menos de duas pessoas ficaram até o fim: desta vez, sem pódio.')}</p>
        )}
        {comPosicao.length > 0 && <Placar eu={eu} linhas={comPosicao.map((l) => ({ ...l, posicao: l.posicao ?? undefined, valor: valor(l) }))} />}
        {!estado.interrompida && estado.premios && <PremiosBonus premios={estado.premios} mostrados={3} nomeDe={nomeDe} eu={eu} />}
        {semPosicao.length > 0 && (
          <ol className="minijogo-placar tabuleiro-sem-posicao">
            {semPosicao.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha" aria-hidden="true" />
                <span className="minijogo-nome">{l.username}</span>
                {!estado.interrompida && l.saiu && <span className="tabuleiro-saiu">{t('Saiu antes do fim')}</span>}
                <span className="minijogo-pontos">{valor(l)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const minhaVez = jogador && estado.vez === eu;
  const meus: ItemDoTabuleiro[] = estado.participantes.find((p) => p.userId === eu)?.itens ?? [];
  // o pedido já foi (o segundo clique não manda de novo, e a tela não pisca um erro)
  const chaveDaVez = `${estado.rodada}-${estado.vez}-${estado.fase}-${ultimo?.id ?? 0}`;
  const pedir = (corpo: Record<string, unknown>) => {
    if (pedido === chaveDaVez) return;
    setPedido(chaveDaVez);
    void agir(corpo);
  };
  const quemJoga = estado.vez !== null ? nomeDe(estado.vez) : '';
  const placar = (
    <ol className="tab-placar">
      {vista.participantes.map((p, i) => {
        const cores = coresDe(p.avatar, i);
        return (
          <li key={p.userId} className={`${p.userId === eu ? 'eu' : ''}${p.userId === estado.vez ? ' vez' : ''}${p.presente ? '' : ' fora'}`}>
            <span className="tab-placar-cor" style={{ background: cores.roupa, borderColor: cores.pelo }} aria-hidden="true" />
            <span className="minijogo-nome">{p.username}</span>
            <span className="tab-placar-conta">
              <CenouraDourada tamanho={14} /> {p.douradas}
            </span>
            <span className="tab-placar-conta">🥕 {p.cenouras}</span>
            <ItensDe itens={p.itens ?? []} />
          </li>
        );
      })}
    </ol>
  );

  if ((estado.fase === 'minijogo' || estado.fase === 'duelo-jogo') && estado.mini) {
    const mini = estado.mini;
    const inscritos = mini.inscritos ?? estado.participantes.map((p) => p.userId);
    const duelo = estado.fase === 'duelo-jogo' ? estado.duelo : null;
    return (
      <div className="tabuleiro-jogo">
        {placar}
        {duelo && duelo.contra !== null && (
          <p className="minijogo-situacao tab-duelo-titulo">{t('{nome} desafiou {outro}!', { nome: nomeDe(duelo.de), outro: nomeDe(duelo.contra) })}</p>
        )}
        {!duelo && mini.formato !== 'todos' && (
          <p className="minijogo-situacao tab-formato">{mini.formato === '2x2' ? t('2 contra 2') : t('1 contra 3')}</p>
        )}
        {duelo && mini.fase === 'revelando' && (
          <p className="minijogo-situacao tab-efeito">
            {duelo.vencedor !== null
              ? t('{nome} levou {n} cenouras de {outro}.', {
                  nome: nomeDe(duelo.vencedor),
                  n: duelo.valor,
                  outro: nomeDe(duelo.vencedor === duelo.de ? (duelo.contra ?? 0) : duelo.de),
                })
              : t('Empate: ninguém leva nada.')}
          </p>
        )}
        <div className={`festa festa-jogo-${mini.microjogo}`}>
          <RodadaDaFesta
            key={`${estado.partidaId}-${mini.rodada}`}
            estado={{
              ...mini,
              jogadores: estado.participantes
                .filter((p) => inscritos.includes(p.userId))
                .map((p) => ({ userId: p.userId, username: p.username, avatar: p.avatar })),
              recebidaEm: estado.recebidaEm,
              restanteMs: estado.restanteMs,
            }}
            eu={eu}
            jogador={jogador}
            restante={restante}
            agir={agir}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tabuleiro-jogo">
      {placar}
      <TabuleiroDaTurma3D
        dados={{
          casas: vista.casas,
          pecas: vista.participantes.map((p, i) => ({ userId: p.userId, pos: posDe(p.userId), ...coresDe3D(p.avatar, i), vez: p.userId === estado.vez, presente: p.presente })),
          dourada: vista.dourada,
          andando: ultimo && noAndar ? { id: ultimo.id, userId: ultimo.userId, dado: ultimo.dado } : null,
          efeitos: [
            ...(chegou && estado.fase === 'andando' ? efeitosNaCena(ultimo, estado.participantes) : []),
            // os prêmios bônus: a estrela sobe de quem ganhou, um prêmio de cada vez
            ...(estado.premios ?? []).slice(0, premiosMostrados).flatMap((p, k) =>
              p.ganhadores.map((userId) => ({ id: `premio-${estado.partidaId}-${k}-${userId}`, userId, texto: '+1 ★', bom: true })),
            ),
          ],
        }}
        reserva={<Tabuleiro estado={vista} posDe={posDe} />}
        tabuleiro={estado.tabuleiro ?? 'horta'}
      />
      <div className="tab-vez" aria-live="polite">
        {estado.retaFinal && estado.fase !== 'reta' && estado.fase !== 'premios' && <span className="tab-reta-selo">{t('Reta final: as casas valem o dobro.')}</span>}
        {estado.fase === 'reta' && (
          <div className="tab-reta">
            <strong>{t('Reta final!')}</strong>
            <span>{t('Reta final: as casas valem o dobro.')}</span>
          </div>
        )}
        {estado.fase === 'premios' && estado.premios && <PremiosBonus premios={estado.premios} mostrados={premiosMostrados} nomeDe={nomeDe} eu={eu} />}
        {estado.fase === 'vez' && (
          <>
            <p className="minijogo-situacao">{minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: quemJoga })}</p>
            {estado.usado && (
              <p className="minijogo-situacao tab-efeito">
                <IconeDoUsado item={estado.usado.item} /> {t('{nome} usou: {item}.', { nome: nomeDe(estado.usado.userId), item: t(NOME_DO_ITEM[estado.usado.item]) })}
              </p>
            )}
            {minhaVez && (
              <button type="button" className="btn-primary tab-jogar" disabled={pedido === chaveDaVez} onClick={() => pedir({ tipo: 'dado' })}>
                <Dado n={5} tamanho={24} /> {t('Jogar o dado')}
              </button>
            )}
            {minhaVez && !estado.usado && (
              <UsarItens
                itens={meus}
                outros={vista.participantes.filter((p) => p.userId !== eu && p.presente)}
                escolhendo={usando}
                setEscolhendo={setUsando}
                pedir={(corpo) => {
                  setUsando(null);
                  pedir(corpo);
                }}
                desligado={pedido === chaveDaVez}
              />
            )}
            <Relogio restante={restante} total={TEMPO_DA_VEZ} />
          </>
        )}
        {noAndar && ultimo && (
          <div className="tab-jogada">
            {(ultimo.dados ?? [ultimo.dado]).map((d, k) => (
              <Dado key={k} n={d} />
            ))}
            {ultimo.dados && ultimo.dados.length > 1 && <strong>= {ultimo.dado}</strong>}
            <span className="minijogo-nome">{nomeDe(ultimo.userId)}</span>
            {estado.fase === 'andando' && chegou && (
              <>
                {/* comprou E parou numa casa que age: as duas coisas aconteceram, e a tela diz as duas */}
                {ultimo.comprou && <strong className="tab-efeito">{t('{nome} comprou a cenoura dourada!', { nome: nomeDe(ultimo.userId) })}</strong>}
                {textoDoEfeito(ultimo.efeito, nomeDe(ultimo.userId), nomeDe, t) && (
                  <strong className="tab-efeito">{textoDoEfeito(ultimo.efeito, nomeDe(ultimo.userId), nomeDe, t)}</strong>
                )}
                {estado.compra && <strong className="tab-efeito">{t('{nome} comprou: {item}.', { nome: nomeDe(ultimo.userId), item: t(NOME_DO_ITEM[estado.compra]) })}</strong>}
              </>
            )}
          </div>
        )}
        {estado.fase === 'caminho' && chegou && (
          <>
            {minhaVez ? <Bifurcacao pedir={pedir} desligado={pedido === chaveDaVez} /> : <p className="minijogo-situacao">{t('{nome} está escolhendo o caminho.', { nome: quemJoga })}</p>}
            <Relogio restante={restante} total={TEMPO_DO_CAMINHO + duracao + PASSO_MS} />
          </>
        )}
        {estado.fase === 'itens' && chegou && (
          <>
            {minhaVez ? (
              <Loja cenouras={eu === estado.vez ? (estado.participantes.find((p) => p.userId === eu)?.cenouras ?? 0) : 0} precos={estado.precos} pedir={pedir} desligado={pedido === chaveDaVez} />
            ) : (
              <p className="minijogo-situacao">{t('{nome} está na loja.', { nome: quemJoga })}</p>
            )}
            <Relogio restante={restante} total={TEMPO_DOS_ITENS + duracao + PASSO_MS} />
          </>
        )}
        {estado.fase === 'duelo' && chegou && (
          <>
            {minhaVez ? (
              <EscolhaDoDuelo outros={estado.participantes.filter((p) => p.userId !== eu && p.presente)} pedir={pedir} desligado={pedido === chaveDaVez} />
            ) : (
              <p className="minijogo-situacao">{t('{nome} vai escolher quem enfrentar.', { nome: quemJoga })}</p>
            )}
            <Relogio restante={restante} total={TEMPO_DO_DUELO + duracao + PASSO_MS} />
          </>
        )}
        {estado.fase === 'loja' && chegou && (
          <>
            {minhaVez ? (
              <>
                <p className="minijogo-situacao">
                  <CenouraDourada /> {t('Comprar a cenoura dourada por {preco} cenouras?', { preco: estado.preco })}
                </p>
                <div className="minijogo-acoes">
                  <button type="button" className="btn-primary" disabled={pedido === chaveDaVez} onClick={() => pedir({ tipo: 'comprar', sim: true })}>
                    {t('Comprar')}
                  </button>
                  <button type="button" className="btn-secondary" disabled={pedido === chaveDaVez} onClick={() => pedir({ tipo: 'comprar', sim: false })}>
                    {t('Agora não')}
                  </button>
                </div>
              </>
            ) : (
              <p className="minijogo-situacao">{t('{nome} chegou à cenoura dourada.', { nome: quemJoga })}</p>
            )}
            <Relogio restante={restante} total={TEMPO_DA_LOJA + duracao + PASSO_MS} />
          </>
        )}
      </div>
    </div>
  );
}

/** Os tabuleiros da largada, na ordem (24/11/2026). */
const TABULEIROS_DA_ESCOLHA: { id: IdDoTabuleiro; nome: string }[] = [
  { id: 'horta', nome: chave('Horta') },
  { id: 'rio', nome: chave('Rio') },
  { id: 'serra', nome: chave('Serra') },
];

/** A figura de cada tabuleiro no botão da largada, de pixels grandes (16 × 16). */
function FiguraDoTabuleiro({ id }: { id: IdDoTabuleiro }) {
  return (
    <svg className="tab-tabuleiro-figura" width="32" height="32" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
      {id === 'horta' && (
        <>
          <rect x="0" y="10" width="16" height="6" fill="#8e6a52" />
          <rect x="0" y="0" width="16" height="10" fill="#9cd0e6" />
          {[2, 7, 12].map((x) => (
            <g key={x}>
              <rect x={x} y="6" width="1" height="4" fill="#7fae5a" />
              <rect x={x + 1} y="7" width="1" height="3" fill="#6a9a4a" />
              <rect x={x} y="10" width="2" height="3" fill="#e07a2e" />
            </g>
          ))}
        </>
      )}
      {id === 'rio' && (
        <>
          <rect x="0" y="0" width="16" height="16" fill="#78a466" />
          <rect x="0" y="5" width="16" height="6" fill="#4f8fc8" />
          <rect x="2" y="7" width="4" height="1" fill="#9cc8e6" />
          <rect x="9" y="9" width="5" height="1" fill="#9cc8e6" />
          <rect x="6" y="4" width="4" height="8" fill="#8e6a4a" />
          <rect x="6" y="6" width="4" height="1" fill="#6a4a32" />
          <rect x="6" y="9" width="4" height="1" fill="#6a4a32" />
        </>
      )}
      {id === 'serra' && (
        <>
          <rect x="0" y="0" width="16" height="16" fill="#cfe3ee" />
          <rect x="7" y="3" width="2" height="2" fill="#f3ead8" />
          <rect x="5" y="5" width="6" height="2" fill="#8a8478" />
          <rect x="6" y="5" width="4" height="1" fill="#f3ead8" />
          <rect x="3" y="7" width="10" height="3" fill="#7c766b" />
          <rect x="1" y="10" width="14" height="3" fill="#8a8478" />
          <rect x="0" y="13" width="16" height="3" fill="#93a46e" />
        </>
      )}
    </svg>
  );
}

/** Antes do convite: o tabuleiro e quantas rodadas (5, 10 ou 15). */
export function EscolhaDasRodadas({
  solo = false,
  aoEscolher,
  aoVoltar,
}: {
  /** No Solo, antes das rodadas, quantos adversários do computador (pedido dele, 05/11/2026). */
  solo?: boolean;
  aoEscolher: (rodadas: number, robos: number | undefined, tabuleiro: IdDoTabuleiro) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  const [robos, setRobos] = useState(3);
  const [tabuleiro, setTabuleiro] = useState<IdDoTabuleiro>('horta');
  return (
    <div className="tab-escolha">
      {solo && <BotoesDosRobos opcoes={[1, 2, 3, 4, 5].map(cadaUmPorSi)} escolhida={robos} aoEscolher={setRobos} />}
      {/* o tabuleiro (24/11/2026): a horta de sempre, o rio ou a serra */}
      <ul className="tab-rodadas tab-tabuleiros" aria-label={t('Tabuleiro')}>
        {TABULEIROS_DA_ESCOLHA.map(({ id, nome }) => (
          <li key={id}>
            <button
              type="button"
              className={`tab-tabuleiro-botao${tabuleiro === id ? ' escolhida' : ''}`}
              aria-pressed={tabuleiro === id}
              onClick={() => setTabuleiro(id)}
            >
              <FiguraDoTabuleiro id={id} />
              <strong>{t(nome)}</strong>
            </button>
          </li>
        ))}
      </ul>
      <p className="minijogo-situacao">{t('Quantas rodadas?')}</p>
      <ul className="tab-rodadas">
        {[5, 10, 15].map((n) => (
          <li key={n}>
            <button type="button" className="tab-rodadas-botao" onClick={() => aoEscolher(n, solo ? robos : undefined, tabuleiro)}>
              <span className="tab-rodadas-dados" aria-hidden="true">
                {Array.from({ length: n / 5 }, (_, i) => (
                  <Dado key={i} n={6 - i * 2} tamanho={26} />
                ))}
              </span>
              <strong>{n}</strong>
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
