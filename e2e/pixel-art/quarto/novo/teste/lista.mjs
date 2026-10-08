// Os móveis do teste: o pé de cada um nas casas da grade (ver chao.mjs), a altura e o que pedir à ferramenta.
// Usada por moveis.mjs (que pinta) e por montar.mjs (que monta a página).
import { silhueta } from './chao.mjs';

export const ESTILO = 'isometric pixel art matching the room exactly: same outline, same palette, same soft afternoon light from the window on the right wall, a soft contact shadow on the floor';
// Cada móvel tem o PÉ nas casas da grade [u0, u1, v0, v1] (ver chao.mjs) e uma altura em px: a máscara é esse
// prisma, menos o que os móveis anteriores já ocupam. Com uma caixa solta, a ferramenta desenhou móveis em escala
// de verdade, pequenos num quarto grande (falhas/); o prisma diz o tamanho, que é o do conceito, aconchegante.
const GRANDE = 'large, filling the whole masked area';
export const FIXOS = [
  { id: 'abajur', pe: [0.05, 1.25, 0.05, 1.25], alto: 80, texto: `${GRANDE}: a wooden nightstand in the back corner of the room, with a big warm table lamp with a cream lampshade and a mug on top, ${ESTILO}` },
  { id: 'cama', pe: [1.3, 4.6, 0.05, 2.8], alto: 70, texto: `${GRANDE}: a single wooden bed with a dark blue plaid blanket and two cream pillows, its long side against the left wall, headboard toward the nightstand in the back corner, ${ESTILO}` },
  { id: 'estante', pe: [0.05, 1.2, 3.0, 6.2], alto: 40, texto: `${GRANDE}: a low wide wooden bookshelf full of colorful books with a small potted plant on top, against the right wall under the window, ${ESTILO}` },
  { id: 'tapete', deitado: true, pe: [2.4, 6.8, 3.2, 7.4], alto: 3, texto: `${GRANDE}: a flat rectangular muted green rug with a thin border lying on the wooden floor, ${ESTILO}` },
].map((m) => ({ ...m, ...silhueta(m.pe, m.alto) }));
export const PUFES = [
  { id: 'pufe-janela', pe: [1.6, 3.1, 5.6, 7.1] },
  { id: 'pufe-meio', pe: [4.0, 5.5, 4.2, 5.7], onde: ', standing on the green rug' },
  { id: 'pufe-frente', pe: [6.2, 7.7, 2.0, 3.5] },
].map((p) => ({ ...p, ...silhueta(p.pe, 34), texto: `${GRANDE}: a round dark grey fabric floor pouf cushion${p.onde ?? ''}, ${ESTILO}` }));
