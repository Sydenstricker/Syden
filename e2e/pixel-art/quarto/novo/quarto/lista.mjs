// Os móveis do quarto na base sem porta (pl-512-janela-1): o pé de cada um nas casas da grade (ver chao.mjs), a altura
// e o que pedir à ferramenta. Usada por moveis.mjs (que pinta) e por montar.mjs (que monta a página).
// A parede da direita é quase toda janela (o vidro vai de v 3,5 a 6,3, e as cortinas de 2,3 a 7,3); a da esquerda é
// inteira livre. Por isso a cama e o guarda-roupa ficam na esquerda, e o criado-mudo no canto do fundo.
import { silhueta } from './chao.mjs';

export const ESTILO = 'isometric pixel art matching the room exactly: same outline, same palette, same soft afternoon light from the window on the right wall, a soft contact shadow on the floor';
// A máscara é o PRISMA do móvel (o pé erguido até a altura): com uma caixa solta, a ferramenta desenhou móveis
// pequenos num quarto grande. A ordem importa: quem é pintado depois não invade quem já está lá (ver ../teste/).
const GRANDE = 'large, filling the whole masked area';
// `dica` é o nome curto para a remoção de fundo, que limpa o recorte.
export const FIXOS = [
  // A primeira cama saiu pequena e com um banquinho ao lado (falhas/): outra semente, e só a cama no pedido.
  { id: 'cama', semente: 7, dica: 'wooden bed with blanket and pillows', pe: [1.5, 4.6, 0.05, 2.7], alto: 72, texto: `ONLY ONE large bed and nothing else, the bed filling the whole masked area: a single wooden bed with a full wooden headboard, a dark blue plaid blanket and two cream pillows, its long side against the left wall, the headboard at the end toward the back corner, ${ESTILO}` },
  { id: 'abajur', dica: 'wooden nightstand with a table lamp and a mug', pe: [0.15, 1.35, 0.05, 1.25], alto: 78, texto: `${GRANDE}: a wooden nightstand in the back corner of the room, next to the bed headboard, with a table lamp with a cream lampshade that is TURNED OFF (no glow, no light on the wall) and a mug on top, ${ESTILO}` },
  // A estante saiu embutida na parede duas vezes (falhas/, a segunda um nicho arredondado). Ele pediu para consertar ou
  // trocar (08/10/2026): no lugar, o GUARDA-ROUPA, que é da lista de móveis pela função (a aba "Guarda-roupa").
  { id: 'guarda-roupa', semente: 7, dica: 'tall wooden wardrobe', pe: [4.9, 6.9, 0.05, 1.35], alto: 135, texto: `${GRANDE}: a tall FREESTANDING wooden wardrobe with two doors and small round knobs, a deep piece of furniture standing on the floor in front of the left wall (not built into the wall), ${ESTILO}` },
  // Pintado aqui, o tapete veio DUAS vezes com um quarto em miniatura em cima (falhas/), e só uma vez limpo. O limpo
  // ficou guardado (prontas/tapete.png, da mesma base e do mesmo lugar) e é usado direto, sem pintar de novo.
  { id: 'tapete', deitado: true, pronto: 'prontas/tapete', pe: [2.6, 6.8, 3.0, 7.0], alto: 3 },
].map((m) => ({ ...m, ...silhueta(m.pe, m.alto) }));
// O pufe: a versão do meio é pintada primeiro; as outras duas PARTEM dela (o mesmo pufe posto no lugar e repintado só
// na forma dele, para ganhar a luz de lá). No teste, pintadas soltas, as três saíram de tamanhos diferentes.
export const PUFES = [
  // Pintado aqui, ele saiu DUAS vezes como um quarto em miniatura em cima do tapete (falhas/): a máscara em cubo parece
  // um quarto. Nem repintado só na forma ele escapou (a terceira em falhas/): o pedido falava em "the room". Então ele
  // vem do teste, posto no lugar SEM repintura (a luz dos dois quartos é parecida); as outras duas partem dele.
  { id: 'pufe-meio', dica: 'round pouf', pe: [4.25, 5.75, 4.25, 5.75], doArquivo: '../teste/pecas/pufe-meio' },
  { id: 'pufe-janela', dica: 'round pouf', pe: [1.75, 3.25, 5.25, 6.75], de: 'pufe-meio' },
  { id: 'pufe-frente', dica: 'round pouf', pe: [6.25, 7.75, 1.75, 3.25], de: 'pufe-meio' },
].map((p) => ({
  ...p, ...silhueta(p.pe, 34),
  texto: p.de
    // Sem a palavra "room": nesta base, ela fazia a ferramenta desenhar um quarto em miniatura.
    ? 'one round dark grey fabric floor pouf, exactly the same size, shape and seams, only its light and shading redrawn, soft afternoon daylight from the right, a soft contact shadow, clean isometric pixel art'
    : `${GRANDE}: a round dark grey fabric floor pouf cushion${p.onde ?? ''}, ${ESTILO}`,
}));
