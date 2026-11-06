import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { idiomaAtual } from '../i18n';

/**
 * O QUE TODA TELA DE MICROJOGO DA FESTA USA (05/11/2026): o contrato `MicrojogoDaTela`, o relógio, as teclas e os formatos.
 * O guia de como fazer um microjogo novo está no topo de server/src/festa/registro.ts; o registro do site é ./registro.ts.
 */

export interface PropsDoMicro<D = Record<string, unknown>> {
  /** Os dados prontos do microjogo, como o servidor os manda (iguais para todos). */
  dados: D;
  /** Quando o jogo começa, no relógio deste computador (Date.now). Tudo o que se mede é "ms desde o começo". */
  inicio: number;
  /** Valendo: sou jogador, a rodada está correndo e ainda não mandei o resultado. */
  ativo: boolean;
  /** O resultado, uma vez só (o primeiro é o que vale). */
  enviar: (corpo: Record<string, unknown>) => void;
  /** Uma ação AO VIVO (cada acerto, cada pulo), na hora: o servidor confere no relógio dele. */
  lance: (corpo: Record<string, unknown>) => void;
  /** O sinal saiu (o saque). */
  sinal: boolean;
  /** A resposta certa, só na revelação (os copos). */
  resposta: number | null;
}

export interface MicrojogoDaTela<D = Record<string, unknown>> {
  /** O id, o mesmo do servidor (server/src/festa/<id>.ts). */
  id: string;
  /** O nome e a dica do "prepare-se", com chave(): UMA frase curta, sem marcar o gênero de quem lê. */
  nome: string;
  dica: string;
  /** A tela do jogo. */
  Tela: (props: PropsDoMicro<D>) => ReactElement;
  /** O valor da revelação, formatado (a reação em ms, "🥕 × 3"…). */
  valor: (v: number, f: Formatos) => string;
  /** 'errou' mostra o valor (zero acertos) em vez de "Errou". */
  errouComValor?: boolean;
  /** A tela continua na revelação (os copos mostram onde estava a cenoura). */
  naRevelacao?: boolean;
}

/** Ajuda a escrever uma tela com os tipos certos. */
export const microjogoDaTela = <D,>(m: MicrojogoDaTela<D>): MicrojogoDaTela<D> => m;

/** O relógio da tela, a cada quadro, enquanto ligado (com a janela escondida, o navegador não dá quadros: não desenha). */
export function useRelogio(ligado: boolean) {
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    if (!ligado) return;
    let id = 0;
    const passo = () => {
      setAgora(Date.now());
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [ligado]);
  return agora;
}

/** As teclas enquanto o jogo está valendo (fora dos campos de texto, sem a repetição da tecla segurada). */
export function useTeclas(ligado: boolean, aoApertar: (e: KeyboardEvent) => boolean) {
  const ref = useRef(aoApertar);
  ref.current = aoApertar;
  useEffect(() => {
    if (!ligado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ligado]);
}

export const ehAperto = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

/** Prefere menos movimento (o sistema pede): as animações de enfeite param; o jogo continua. */
export const menosMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useFormatos() {
  const idioma = idiomaAtual();
  const [f] = useState(() => ({
    ms: new Intl.NumberFormat(idioma, { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 0 }),
    s: new Intl.NumberFormat(idioma, { style: 'unit', unit: 'second', unitDisplay: 'short', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    numero: new Intl.NumberFormat(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: new Intl.NumberFormat(idioma, { style: 'percent', maximumFractionDigits: 1 }),
    inteiro: new Intl.NumberFormat(idioma, { maximumFractionDigits: 0 }),
  }));
  return f;
}
export type Formatos = ReturnType<typeof useFormatos>;

/**
 * A MOLDURA dos microjogos de 05/11: em cima, o placar de quem joga e a barra do tempo que falta (as classes do Tiro ao alvo);
 * embaixo, o jogo. `fracao` é o que já passou, de 0 a 1.
 */
export function Moldura({ placar, fracao, children }: { placar: string; fracao: number; children: ReactNode }) {
  return (
    <div className="festa-alvo">
      <div className="festa-alvo-topo">
        <span className="festa-mostrador">{placar}</span>
        <span className="festa-alvo-tempo" aria-hidden="true">
          <span style={{ width: `${(1 - Math.min(1, Math.max(0, fracao))) * 100}%` }} />
        </span>
      </div>
      {children}
    </div>
  );
}

/** O coelho da festa, de frente (o mesmo desenho dos microjogos de 03/11), num <g> para pôr onde quiser. */
export function CoelhoDeFrente({ x = 0, y = 0, escala = 1, olhos = 'abertos' }: { x?: number; y?: number; escala?: number; olhos?: 'abertos' | 'tontos' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <ellipse cx="-6" cy="-30" rx="3.5" ry="9" fill="#e8dccb" />
      <ellipse cx="6" cy="-30" rx="3.5" ry="9" fill="#e8dccb" />
      <ellipse cx="-6" cy="-29" rx="1.5" ry="6" fill="#e4b5b0" />
      <ellipse cx="6" cy="-29" rx="1.5" ry="6" fill="#e4b5b0" />
      <circle cx="0" cy="-12" r="12" fill="#e8dccb" />
      {olhos === 'abertos' ? (
        <>
          <circle cx="-4" cy="-13" r="1.8" fill="#3a2e2a" />
          <circle cx="4" cy="-13" r="1.8" fill="#3a2e2a" />
        </>
      ) : (
        <path d="M-6 -15 L-2 -11 M-2 -15 L-6 -11 M2 -15 L6 -11 M6 -15 L2 -11" stroke="#3a2e2a" strokeWidth="1.4" strokeLinecap="round" />
      )}
      <circle cx="0" cy="-9" r="1.5" fill="#d98a8a" />
    </g>
  );
}
