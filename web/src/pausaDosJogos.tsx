import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, Play, RotateCcw } from 'lucide-react';
import type { Comando } from './ComandosDosJogos';
import { useT } from './i18n';
import { IconeDeHud } from './iconesDeHud';
import { desceu, lerControle } from './controleDosJogos';
import { marcarPausaDoJogo } from './musicaDosJogos';
import './pausaDosJogos.css';

/**
 * A PAUSA COM ESC DOS JOGOS SOLO (06/11/2026, pedido dele, depois do Rolê do coelho: "seria legal para outros jogos também").
 *
 * Só onde pausar é honesto: os jogos SOLO de passo fixo cujo relógio é o número de passos do próprio computador (o skate, o
 * contra o relógio do kart, do jato, da regata, do pulo e da torre, o Estoura-balão e o futebol contra o computador). Eles já
 * pausavam com a janela sem foco, e a pausa do ESC entra no mesmo ponto do laço. NA SALA, NÃO: lá o relógio é do servidor e a
 * turma segue; quem chama passa `ligada = false`, e o ESC não faz nada novo. Os jogos cujo relógio é o do servidor mesmo no
 * Solo (a Caça, a Esquadrilha, a Horta em cascata, a Briga, o chefe) ficaram de fora: pausar ali pediria mexer no servidor.
 *
 * O ESC, com o jogo em andamento, é DA PAUSA: ele é ouvido antes de todo mundo (na captura) e não segue adiante, para não fechar
 * nada por baixo. Pausado, ESC de novo (ou o botão) volta.
 */

/** O que o laço do jogo lê a cada quadro. */
export interface Pausa {
  ativa: boolean;
}

export function usePausaComEsc(ligada: boolean) {
  const ref = useRef<Pausa>({ ativa: false });
  const [pausado, setPausado] = useState(false);
  const definir = useCallback((v: boolean) => {
    ref.current.ativa = v;
    setPausado(v);
  }, []);
  useEffect(() => {
    if (!ligada) {
      definir(false);
      return;
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      definir(!ref.current.ativa);
    };
    window.addEventListener('keydown', tecla, true);
    // o START do controle de videogame (20/11/2026) faz o mesmo que o ESC; só se olha o controle enquanto a pausa vale
    let antes = lerControle();
    let quadro = requestAnimationFrame(function olhar() {
      const agora = lerControle();
      if (desceu(antes, agora, 'start')) definir(!ref.current.ativa);
      antes = agora;
      quadro = requestAnimationFrame(olhar);
    });
    return () => {
      window.removeEventListener('keydown', tecla, true);
      cancelAnimationFrame(quadro);
    };
  }, [ligada, definir]);
  // a música dos jogos cala enquanto a pausa está aberta (20/11/2026); o dono é a pausa deste jogo
  useEffect(() => {
    const dono = ref.current;
    marcarPausaDoJogo(dono, pausado);
    return () => marcarPausaDoJogo(dono, false);
  }, [pausado]);
  const continuar = useCallback(() => definir(false), [definir]);
  return { pausa: ref.current, pausado, continuar };
}

/**
 * A tela de pausa, por cima do jogo (quem chama a põe dentro da moldura, que precisa de `position: relative`). Sem texto novo:
 * o sinal de pausa e o "Continuar". `icone = false` nos jogos que já desenham o sinal de pausa no próprio canvas.
 *
 * RECOMEÇAR E SAIR (20/11/2026, a segunda auditoria): quem passa `aoRecomecar` ganha o "Jogar de novo" (com a tecla R, ver
 * `useTeclaDeRecomecar`), e quem passa `aoSair` ganha o "Sair" (de volta à escolha da fase ou da pista). Sem eles, só o
 * "Continuar", como antes: cada jogo liga o que faz sentido nele (o recomeço tem de ser honesto com o relógio do servidor).
 */
export function TelaDePausa({
  aoContinuar,
  aoRecomecar,
  aoSair,
  icone = true,
}: {
  aoContinuar: () => void;
  aoRecomecar?: () => void;
  aoSair?: () => void;
  icone?: boolean;
}) {
  const t = useT();
  return (
    <div className={`pausa-do-jogo${icone ? '' : ' sem-icone'}`}>
      {icone && (
        <span className="pausa-do-jogo-icone">
          <IconeDeHud nome="pausa" tamanho={64} />
        </span>
      )}
      <div className="pausa-do-jogo-botoes">
        <button type="button" className="btn-primary" autoFocus onClick={aoContinuar}>
          <Play size={14} aria-hidden="true" /> {t('Continuar')}
        </button>
        {aoRecomecar && (
          <button type="button" className="btn-secondary" onClick={aoRecomecar}>
            <RotateCcw size={14} aria-hidden="true" /> {t('Jogar de novo')}
            <kbd aria-hidden="true">R</kbd>
          </button>
        )}
        {aoSair && (
          <button type="button" className="btn-secondary" onClick={aoSair}>
            <LogOut size={14} aria-hidden="true" /> {t('Sair')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A TECLA R recomeça na hora (20/11/2026), nos contra o relógio do Solo: com o jogo andando ou pausado. Só enquanto `ligada`
 * (nunca na sala, nunca com o resultado na tela, onde o "Jogar de novo" já está à vista). Ctrl, Alt e Cmd ficam com o navegador.
 */
export function useTeclaDeRecomecar(ligada: boolean, aoRecomecar: () => void) {
  const recomecar = useRef(aoRecomecar);
  recomecar.current = aoRecomecar;
  useEffect(() => {
    if (!ligada) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      e.preventDefault();
      recomecar.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ligada]);
}

/** A linha "Esc · Pausar" nos comandos do jogo (ComandosDosJogos), para quem joga saber que dá. */
export const comandoDaPausa = (t: (chave: string) => string): Comando => ({ teclas: ['esc'], rotulo: t('Pausar') });
