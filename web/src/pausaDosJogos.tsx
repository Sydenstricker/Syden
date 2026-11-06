import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { Comando } from './ComandosDosJogos';
import { useT } from './i18n';
import { IconeDeHud } from './iconesDeHud';
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
    return () => window.removeEventListener('keydown', tecla, true);
  }, [ligada, definir]);
  const continuar = useCallback(() => definir(false), [definir]);
  return { pausa: ref.current, pausado, continuar };
}

/**
 * A tela de pausa, por cima do jogo (quem chama a põe dentro da moldura, que precisa de `position: relative`). Sem texto novo:
 * o sinal de pausa e o "Continuar". `icone = false` nos jogos que já desenham o sinal de pausa no próprio canvas.
 */
export function TelaDePausa({ aoContinuar, icone = true }: { aoContinuar: () => void; icone?: boolean }) {
  const t = useT();
  return (
    <div className={`pausa-do-jogo${icone ? '' : ' sem-icone'}`}>
      {icone && (
        <span className="pausa-do-jogo-icone">
          <IconeDeHud nome="pausa" tamanho={64} />
        </span>
      )}
      <button type="button" className="btn-primary" autoFocus onClick={aoContinuar}>
        <Play size={14} aria-hidden="true" /> {t('Continuar')}
      </button>
    </div>
  );
}

/** A linha "Esc · Pausar" nos comandos do jogo (ComandosDosJogos), para quem joga saber que dá. */
export const comandoDaPausa = (t: (chave: string) => string): Comando => ({ teclas: ['esc'], rotulo: t('Pausar') });
