/**
 * O mascote do Syden: o coelho antigo, sem a estrela (rebrand de 05/10/2026).
 *
 * Divisão de trabalho com o D4: o MASCOTE é o personagem — espera, cumprimenta, canta, apresenta,
 * fica sem internet. O D4 (Logo.tsx) é a marca e a função — ícone, avatar, conversa acontecendo.
 *
 * Cada animação é um SVG em web/public/mascote/, GERADO a partir do estúdio
 * (animacaoSVG/animacoes_d4.html) por animacaoSVG/exportar-mascote.mjs. Para mudar um desenho, mude
 * no estúdio e exporte de novo: o arquivo daqui é sobrescrito.
 *
 * O desenho é 4:3 (o quadro do estúdio, recortado na exportação): `tamanho` é a largura.
 *
 * Vai como <img>, e não escrito dentro da página, de propósito: o <style> de um SVG embutido vale para
 * o documento inteiro, e as classes dele (figura, orelha, nota…) poderiam pegar no app. Como imagem,
 * o estilo fica preso dentro dela. As animações rodam do mesmo jeito, e o próprio SVG para quando a
 * pessoa pediu menos movimento ao sistema.
 */
import { useJanelaComFoco } from './janelaComFoco';

export type NomeDoMascote =
  | 'ocioso'
  | 'introducao'
  | 'digitando'
  | 'falando'
  | 'ciclo-de-status'
  | 'ouvindo-musica'
  | 'karaoke'
  | 'assistir-junto'
  | 'apresentacao'
  | 'sem-internet'
  | 'erro-500'
  | 'erro-404';

export function Mascote({ nome, tamanho = 160, className }: { nome: NomeDoMascote; tamanho?: number; className?: string }) {
  // Sem foco, o mesmo desenho parado (o "-parado.svg", do exportador), como o Avatar: a animação dentro de um SVG em <img>
  // não se pausa de fora, e o "assistir junto" da barra lateral repintava atrás do jogo a partida inteira.
  const comFoco = useJanelaComFoco();
  return (
    <img
      className={className ? `mascote ${className}` : 'mascote'}
      src={`${import.meta.env.BASE_URL}mascote/${nome}${comFoco ? '' : '-parado'}.svg`}
      width={tamanho}
      height={Math.round(tamanho * 0.75)}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
