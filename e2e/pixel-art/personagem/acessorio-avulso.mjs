// O ACESSÓRIO SOZINHO, GRANDE, PARA O MESHY (09/11/2026, pedido dele: "esse boné vermelho não pode ser melhorado para eu gerar a
// malha 3D? melhorar a qualidade um pouco"). A entrada do Meshy era o boné recortado do sprite: uns 28 px, ampliados, quase
// sem forma. Aqui ele é gerado SOZINHO, num quadro grande (192), em 3/4 e sem fundo, com a camada 2D de referência para o
// desenho ser o mesmo (a cor, a aba, o tamanho da copa); o detalhe que o sprite não tinha (os gomos, o botão, a espessura da
// aba) é o que o Meshy precisa para a forma.
//
//   node e2e/pixel-art/personagem/acessorio-avulso.mjs <acessório>
//   → blender/camadas/para-meshy/opcoes/<acessório>-K.png   (as opções; a escolhida é copiada para para-meshy/<acessório>.png)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const ACESSORIOS = {
  bone: {
    referencia: 'mascote/acessorios/bone/parado/south-east-0.png',
    descricao:
      'a single red baseball cap on its own, seen in three-quarter view from the front-left and slightly above: a rounded six-panel crown with the panel seams visible, a small button on top, a short curved visor with visible thickness, the same red as the reference, darker red in the shadows and a soft highlight, clean shapes, centered in the frame with empty space around it, nothing else in the image',
  },
  bandana: {
    referencia: 'mascote/acessorios/bandana/parado/south-east-0.png',
    descricao:
      'a single rust red bandana neckerchief on its own, as if tied around an invisible neck, seen in three-quarter view from the front and slightly above: a ring of folded cloth with a triangle of cloth hanging down in front and a small knot at the back, soft folds, the same rust red as the reference, centered in the frame with empty space around it, nothing else in the image',
  },
};

const [nome] = process.argv.slice(2);
const acc = ACESSORIOS[nome];
if (!acc) throw new Error('uso: acessorio-avulso.mjs <' + Object.keys(ACESSORIOS).join('|') + '>');

// a referência: só a camada, recortada e ampliada 4× (o PixelLab entende melhor o desenho maior)
const cam = PNG.sync.read(fs.readFileSync(path.join(AQUI, acc.referencia)));
let x0 = cam.width, y0 = cam.height, x1 = 0, y1 = 0;
for (let y = 0; y < cam.height; y++) for (let x = 0; x < cam.width; x++) if (cam.data[(y * cam.width + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const E = 4, w = (x1 - x0 + 1) * E, h = (y1 - y0 + 1) * E;
const ref = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = ((y0 + Math.floor(y / E)) * cam.width + x0 + Math.floor(x / E)) * 4;
  ref.data.set(cam.data.subarray(i, i + 4), (y * w + x) * 4);
}

const imagens = await chamar('/generate-image-v2', {
  description: acc.descricao + ', fine detailed pixel art with a 1-pixel dark outline, flat even light, no shadow on the ground, no background, no text',
  image_size: { width: 192, height: 192 },
  no_background: true,
  reference_images: [{
    image: { type: 'base64', base64: PNG.sync.write(ref).toString('base64'), format: 'png' },
    size: { width: w, height: h },
    usage_description: 'This is the accessory as it looks on the character: keep its design, color and proportions, and draw it bigger and alone, with more detail',
  }],
});
const pasta = path.join(AQUI, 'blender', 'camadas', 'para-meshy', 'opcoes');
fs.mkdirSync(pasta, { recursive: true });
const ja = fs.readdirSync(pasta).filter((f) => f.startsWith(nome + '-')).length;
imagens.forEach((b, k) => fs.writeFileSync(path.join(pasta, `${nome}-${ja + k + 1}.png`), Buffer.from(b, 'base64')));
console.log(`${imagens.length} opção(ões) em para-meshy/opcoes/`);
