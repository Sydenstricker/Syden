import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useJanelaComFoco } from './janelaComFoco';

/**
 * O QUARTO E O SALÃO FICAM GUARDADOS ENQUANTO A PESSOA VAI A OUTRA ABA (13/11/2026, relato dele: "os tempos de
 * carregamento do quarto e do salão estão consideráveis, notáveis principalmente quando eu mudo de aba para procurar
 * mensagem"). Medido no site de teste: voltar ao início refazia a cena inteira, ~2,5 s TODA VEZ (a página do iframe, as
 * imagens decodificadas, a montagem, a luz na placa e a arrumação pedida ao servidor), mesmo com tudo no cache.
 *
 * Agora quem sai do início ou do salão deixa a cena montada, ESCONDIDA (visibility: hidden, no mesmo tamanho, para a página
 * dela não se redesenhar por mudar de tamanho) e PARADA (a página do quarto e as cenas 3D conferem se estão à vista, e
 * escondidas não desenham nada, como sem foco). Voltar é só mostrar.
 *
 * A GUARDA É MODESTA (mesmo dia, pergunta dele: "estamos guardando quase 2 GB de RAM do usuário por 10 minutos?"):
 * - UMA cena só: a última de onde a pessoa saiu. Sair do salão para um canal com o quarto guardado libera o quarto.
 * - Por PRAZO_MS, o bastante para ir procurar uma mensagem e voltar; sem foco na janela (foi jogar), PRAZO_SEM_FOCO_MS.
 * - Em computador com pouca memória (navigator.deviceMemory abaixo de 8 GB), nada é guardado: como antes, sair desmonta.
 * - A chave (a comunidade do salão) mudou, a cena sai: não se mostra o salão de uma comunidade com os dados de outra.
 *
 * O wrapper é `display: contents` à vista, então a cena continua sendo, para o layout, filha direta de `.main`.
 */
const PRAZO_MS = 3 * 60_000;
const PRAZO_SEM_FOCO_MS = 30_000;

/** Pouca memória: não guarda. O Chrome e o Electron dizem a memória arredondada e com teto de 8; sem a medida, guarda. */
const MEMORIA_BASTA = (() => {
  const gb = (navigator as { deviceMemory?: number }).deviceMemory;
  return typeof gb !== 'number' || gb >= 8;
})();

// qual cena está guardada agora (a última de onde a pessoa saiu); as outras escondidas se desmontam
let guardadaAgora: string | null = null;
const ouvintes = new Set<() => void>();
function guardar(id: string | null) {
  if (guardadaAgora === id) return;
  guardadaAgora = id;
  for (const o of ouvintes) o();
}
const assinar = (o: () => void) => {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
};

export function CenaGuardada({ aVista, chave, lugar, children }: { aVista: boolean; chave: string; lugar: string; children: ReactNode }) {
  const id = lugar + ':' + chave;
  const [guardada, setGuardada] = useState<string | null>(aVista ? chave : null);
  const comFoco = useJanelaComFoco();
  const aVez = useSyncExternalStore(assinar, () => guardadaAgora);
  useEffect(() => {
    if (aVista) {
      setGuardada(chave);
      if (guardadaAgora === id) guardar(null);
      return;
    }
    if (guardada !== chave) return;
    const ms = (import.meta.env.DEV && (window as { prazoDaCenaGuardada?: number }).prazoDaCenaGuardada) || (comFoco ? PRAZO_MS : PRAZO_SEM_FOCO_MS);
    if (!MEMORIA_BASTA && !(import.meta.env.DEV && (window as { cenaGuardadaSempre?: boolean }).cenaGuardadaSempre)) {
      setGuardada(null);
      return;
    }
    guardar(id);
    const prazo = setTimeout(() => {
      setGuardada(null);
      if (guardadaAgora === id) guardar(null);
    }, ms);
    return () => clearTimeout(prazo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aVista, chave, comFoco]);
  // outra cena foi guardada depois desta: esta sai. Lê a vez de agora, não a da renderização: no mesmo instante em que esta
  // some, o efeito de cima acabou de tomar a vez, e a foto da renderização ainda traz a da cena anterior.
  useEffect(() => {
    if (!aVista && guardada === chave && guardadaAgora !== null && guardadaAgora !== id) setGuardada(null);
  }, [aVez, aVista, guardada, chave, id]);
  // desmontada a guarda, a vez fica livre
  useEffect(() => () => {
    if (guardadaAgora === id) guardar(null);
  }, [id]);
  if (!aVista && guardada !== chave) return null;
  return (
    <div className={aVista ? 'cena-guardada' : 'cena-guardada escondida'} inert={!aVista || undefined} aria-hidden={!aVista || undefined}>
      {children}
    </div>
  );
}

/** A cena está à vista? (fora dela, ou guardada pelo CenaGuardada, não desenha). `checkVisibility` olha o visibility herdado. */
export function elementoAVista(el: Element | null | undefined): boolean {
  if (!el || !el.isConnected) return false;
  const conferir = (el as Element & { checkVisibility?: (o?: { visibilityProperty?: boolean }) => boolean }).checkVisibility;
  return conferir ? conferir.call(el, { visibilityProperty: true }) : true;
}
