import { CORES_DOS_AVATARES, MOLETOM_DO_MASCOTE, PELO_DO_MASCOTE } from '../corrida/coresDosAvatares';
import { lerCodigo } from './receita';

/**
 * O COELHO DE ALGUÉM NOS JOGOS (10/11/2026, pedido dele: "integrar os avatares da seleção de coelhos com os do Syden e os dos
 * mini games; quero um ecossistema integrado"). O servidor manda, no lugar do número do coelho pronto, o `avatarDoJogo`
 * (server/src/db.ts): a RECEITA do criador quando a pessoa montou o coelho dela, senão o número do pronto, senão null. Os
 * jogos pintam o mascote com o pelo e a roupa daqui, como já faziam com as cores medidas dos 16 prontos.
 */
export type AvatarDoJogo = number | string | null | undefined;
type Rgb = [number, number, number];

const rgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** As cores do pelo e da roupa; undefined = o mascote como é (sem receita, ou a receita com as duas cores originais). */
export function coresDoJogador(avatar: AvatarDoJogo): { pelo: Rgb; roupa: Rgb } | undefined {
  if (typeof avatar === 'number') return CORES_DOS_AVATARES[avatar];
  const r = lerCodigo(avatar);
  if (!r || (!r.pelo && !r.roupa)) return undefined;
  // a cor que ficou "original" é a do próprio mascote (o tom do meio do pelo e do moletom)
  return { pelo: r.pelo ? rgb(r.pelo) : PELO_DO_MASCOTE[0], roupa: r.roupa ? rgb(r.roupa) : MOLETOM_DO_MASCOTE[0] };
}
