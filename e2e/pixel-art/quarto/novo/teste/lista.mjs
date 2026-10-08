// Os móveis do teste: o pé de cada um nas casas da grade (ver chao.mjs), a altura e o que pedir à ferramenta.
// Usada por moveis.mjs (que pinta) e por montar.mjs (que monta a página).
import { silhueta } from './chao.mjs';

export const ESTILO = 'isometric pixel art matching the room exactly: same outline, same palette, same soft afternoon light from the window on the right wall, a soft contact shadow on the floor';
// Cada móvel tem o PÉ nas casas da grade [u0, u1, v0, v1] (ver chao.mjs) e uma altura em px: a máscara é esse
// prisma, menos o que os móveis anteriores já ocupam. Com uma caixa solta, a ferramenta desenhou móveis em escala
// de verdade, pequenos num quarto grande (falhas/); o prisma diz o tamanho, que é o do conceito, aconchegante.
const GRANDE = 'large, filling the whole masked area';
// A ordem importa: quem é pintado depois não pode invadir quem já está lá. Na v1 (v1/), o criado-mudo veio antes e
// espremeu a cabeceira da cama; a estante, baixa sob a janela, saiu minúscula; e o abajur foi pintado ACESO, com um
// halo recortado que brigava com a luz do código. Agora: a cama primeiro, a estante alta ao lado da janela, e o
// abajur apagado (quem acende é o código). `dica` é o nome curto para a remoção de fundo, que limpa o recorte.
export const FIXOS = [
  { id: 'cama', dica: 'wooden bed with blanket and pillows', pe: [1.5, 4.6, 0.05, 2.7], alto: 72, texto: `${GRANDE}: a single wooden bed with a full wooden headboard, a dark blue plaid blanket and two cream pillows, its long side against the left wall, the headboard at the end toward the back corner, ${ESTILO}` },
  { id: 'abajur', dica: 'wooden nightstand with a table lamp and a mug', pe: [0.15, 1.35, 0.05, 1.25], alto: 78, texto: `${GRANDE}: a wooden nightstand in the back corner of the room, next to the bed headboard, with a table lamp with a cream lampshade that is TURNED OFF (no glow, no light on the wall) and a mug on top, ${ESTILO}` },
  { id: 'estante', dica: 'tall wooden bookshelf with books', pe: [0.05, 1.05, 6.45, 7.95], alto: 125, texto: `${GRANDE}: a tall wooden bookshelf full of colorful books, a small potted plant on the top shelf, standing against the right wall to the right of the window, ${ESTILO}` },
  { id: 'tapete', dica: 'green rug', deitado: true, pe: [2.4, 6.8, 3.2, 7.4], alto: 3, texto: `${GRANDE}: a flat rectangular muted green rug with a thin border lying on the wooden floor, ${ESTILO}` },
].map((m) => ({ ...m, ...silhueta(m.pe, m.alto) }));
export const PUFES = [
  { id: 'pufe-janela', dica: 'round pouf', pe: [1.6, 3.1, 5.6, 7.1] },
  { id: 'pufe-meio', dica: 'round pouf', pe: [4.0, 5.5, 4.2, 5.7], onde: ', standing on the green rug' },
  { id: 'pufe-frente', dica: 'round pouf', pe: [6.2, 7.7, 2.0, 3.5] },
].map((p) => ({ ...p, ...silhueta(p.pe, 34), texto: `${GRANDE}: a round dark grey fabric floor pouf cushion${p.onde ?? ''}, ${ESTILO}` }));
