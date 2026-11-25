/**
 * O PILOTO DO PIXELFX NA BRIGA (25/11/2026, pedido dele): dois efeitos da biblioteca pixelfx (MIT, web/src/vendor/pixelfx;
 * crédito nos termos, e a licença servida em web/public/licencas/pixelfx.txt, porque o build tira os comentários) no lugar
 * dos nossos feitos às pressas: a FAÍSCA do golpe forte (hit-spark: o 3º soco, a voadora, o giro e o arremesso) e o bicho
 * que VIRA FUMAÇA (poof). O soco comum e a poeira do caixote continuam os nossos.
 *
 * A AUDITORIA DO PRÓPRIO PILOTO (mesmo dia, um agente que não fez a mudança, pelas folhas do e2e/briga-pixelfx.mjs) mudou
 * a primeira versão: a biblioteca desenha para quadros de 110–140 px, e o coelho tem ~45. A hit-spark no soco comum era do
 * tamanho do coelho, e a blunt-hit (que era o golpe forte) cobria o coelho de bolha e poeira: saiu. Daí a hierarquia de
 * agora: o soco comum pequeno (o nosso), o forte a faísca da biblioteca, o fim do bicho a fumaça. A fumaça de fábrica é
 * lilás e fria; aqui, nas cores quentes da horta. A segunda conferência ainda achou uma nuvem creme do tamanho do coelho: era
 * a LUZ (o brilho de 22 a 38 px de raio), que sobre o céu claro vira mancha. Ela saiu inteira (a composição com luz 0), e a
 * faísca é uma cópia a 60% do tamanho (hit-spark-pequena.js). A fumaça sai onde o bicho está DESENHADO, quando ele some.
 * A terceira conferência achou o estouro BRANCO do começo da fumaça (fixo no código dela, a paleta não o troca) e a faísca
 * no meio do bicho: a fumaça virou uma cópia a 60%, sem o estouro (poof-pequeno.js), e a faísca sai no ponto do contato.
 *
 * SÓ DESENHO, como o impacto.ts: nada entra no passo nem no que vai ao servidor. Os efeitos andam no MUNDO (x pela fase, y
 * pela tela), e a moldura deles anda com a câmera. Na pausa do acerto eles ficam parados junto com o resto. Sem foco, quem
 * chama não desenha (e não chama `quadro`).
 *
 * Para comparar com os de antes: `localStorage['syden.brigaPixelfx'] = 'nao'` (a página relida volta aos nossos).
 */
import { clearFrame, composite, createFrame, createFx, type EfeitoVivo } from '../vendor/pixelfx/core/index.js';
import * as hitSpark from '../vendor/pixelfx/fx/impacts/hit-spark-pequena.js';
import * as poof from '../vendor/pixelfx/fx/spawn/poof-pequeno.js';
import { CHAO, H, W } from './desenho';

export function pixelfxLigado(): boolean {
  try {
    return localStorage.getItem('syden.brigaPixelfx') !== 'nao';
  } catch {
    return true;
  }
}

/** O que o jogo pede: o lugar é o do mundo (x, y da faixa, z da altura), como os efeitos de antes. */
export type PedidoDeEfeito = 'acerto-forte' | 'fumaca';

const TETO = 24;
// A fumaça nas cores da horta (do escuro ao claro), no lugar do lilás de fábrica; as estrelinhas ficam as amarelas.
const FUMACA_QUENTE = ['#4a3328', '#7a5c48', '#a88a70', '#d2b898', '#efe0c6', '#fff8ec'];

export interface CamadaPixelfx {
  /** `lado`: para onde quem bateu está virado (a faísca sai no contato, 10 px antes do meio de quem apanhou). */
  pedir(tipo: PedidoDeEfeito, x: number, y: number, z: number, lado: number): void;
  /** Anda os efeitos `dt` segundos (0 na pausa do acerto) e os desenha em `g`, com a câmera em `camX`. */
  quadro(g: CanvasRenderingContext2D, camX: number, dt: number): void;
  /** Os tipos vivos agora (o e2e fotografa cada um à parte). */
  tipos(): PedidoDeEfeito[];
}

export function criarCamadaPixelfx(): CamadaPixelfx {
  const frame = createFrame(W, H);
  const tela = document.createElement('canvas');
  tela.width = W;
  tela.height = H;
  const tg = tela.getContext('2d')!;
  const imagem = tg.createImageData(W, H);
  const efeitos: { tipo: PedidoDeEfeito; fx: EfeitoVivo }[] = [];
  let semente = 1;
  return {
    pedir(tipo, x, y, z, lado) {
      if (efeitos.length >= TETO) efeitos.shift();
      const base = { x: Math.round(x), y: Math.round(CHAO + y), flip: lado < 0, seed: semente++ };
      // o corpo do coelho chibi tem ~45 px: o golpe pega na altura do peito, ~22 px acima do pé (e da altura do pulo)
      const altura = Math.max(10, Math.round(22 + z));
      const fx =
        tipo === 'acerto-forte'
          ? createFx(hitSpark, { ...base, x: Math.round(x - lado * 10), height: altura, aim: 0.1 })
          : createFx(poof, { ...base, palette: FUMACA_QUENTE });
      efeitos.push({ tipo, fx });
    },
    quadro(g, camX, dt) {
      if (!efeitos.length) return;
      frame.ox = Math.round(camX);
      clearFrame(frame);
      for (let k = efeitos.length - 1; k >= 0; k--) {
        const { fx } = efeitos[k];
        if (dt > 0) fx.update(Math.min(dt, 0.1));
        if (fx.done()) {
          efeitos.splice(k, 1);
          continue;
        }
        fx.draw(frame);
      }
      // luz 0: só a cor (sobre o dia claro, o brilho aditivo vira mancha)
      composite(frame, imagem.data, null, 0);
      tg.putImageData(imagem, 0, 0);
      g.drawImage(tela, 0, 0);
    },
    tipos: () => efeitos.map((e) => e.tipo),
  };
}
