import { useEffect, useRef } from 'react';
import { BARRAS, type Barra, guardarLarguras, lerLarguras } from './larguras';
import { useT } from './i18n';

// A borda que se arrasta para mudar a largura de uma barra.
//
// ELE TAMBÉM FUNCIONA PELO TECLADO, e isso não é enfeite de acessibilidade — é a razão de ele existir.
// A funcionalidade nasceu de um pedido de acessibilidade, e um controle que só responde a arrastar com
// precisão exclui justamente quem mais precisa dele. Com as setas, cada toque move 16px; com Home, volta
// ao padrão.
//
// O papel ARIA é `separator` com `aria-valuenow`: é o que faz o leitor de tela anunciar "separador, 240"
// em vez de "botão", e é o que existe no padrão para exatamente esta coisa.

export function Puxador({ barra, lado }: { barra: Barra; lado: 'direita' | 'esquerda' }) {
  const t = useT();
  const elemento = useRef<HTMLDivElement>(null);
  const arrastando = useRef<{ x: number; largura: number } | null>(null);

  const limites = BARRAS[barra];

  useEffect(() => {
    function mover(evento: PointerEvent) {
      if (!arrastando.current) return;
      const andou = evento.clientX - arrastando.current.x;
      // Puxador do lado esquerdo cresce para o outro lado: sem isto, a lista de pessoas encolheria ao
      // ser puxada para fora.
      const delta = lado === 'direita' ? andou : -andou;
      const larguras = lerLarguras();
      const nova = Math.min(limites.maximo, Math.max(limites.minimo, arrastando.current.largura + delta));
      guardarLarguras({ ...larguras, [barra]: nova });
    }
    function soltar() {
      arrastando.current = null;
      document.body.classList.remove('arrastando-barra');
    }
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [barra, lado, limites]);

  function pegar(evento: React.PointerEvent) {
    arrastando.current = { x: evento.clientX, largura: lerLarguras()[barra] };
    // A classe no body apaga a seleção de texto durante o arrasto. Sem ela, puxar a barra por cima de
    // uma conversa seleciona meia tela de mensagens.
    document.body.classList.add('arrastando-barra');
  }

  function tecla(evento: React.KeyboardEvent) {
    const larguras = lerLarguras();
    const passo = evento.shiftKey ? 48 : 16;
    let nova: number | null = null;
    if (evento.key === 'ArrowRight') nova = larguras[barra] + (lado === 'direita' ? passo : -passo);
    else if (evento.key === 'ArrowLeft') nova = larguras[barra] - (lado === 'direita' ? passo : -passo);
    else if (evento.key === 'Home') nova = limites.padrao;
    if (nova === null) return;
    evento.preventDefault();
    guardarLarguras({ ...larguras, [barra]: Math.min(limites.maximo, Math.max(limites.minimo, nova)) });
  }

  return (
    <div
      ref={elemento}
      className={`puxador puxador-${lado}`}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={t('Mudar a largura de {barra}', { barra: t(limites.nome) })}
      aria-valuenow={lerLarguras()[barra]}
      aria-valuemin={limites.minimo}
      aria-valuemax={limites.maximo}
      onPointerDown={pegar}
      onKeyDown={tecla}
      onDoubleClick={() => guardarLarguras({ ...lerLarguras(), [barra]: limites.padrao })}
      title={t('Arraste para mudar a largura. Dois cliques volta ao padrão.')}
    />
  );
}
