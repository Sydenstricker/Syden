// O MASCOTE DE FRENTE, COM AS ORELHAS AFASTADAS, PARA O MESHY (09/11/2026, decisão dele: "vamos usar um corpo do Meshy feito
// com as orelhas mais afastadas; a qualidade vai ser maior"). No piloto 3D das camadas, o boné não cabia ENTRE as orelhas da
// malha de hoje (mascote-t.glb): elas nascem quase juntas no meio do alto da cabeça, e no desenho 2D são afastadas. Esta é a
// foto de entrada da malha nova: o mesmo mascote, de frente, corpo inteiro, com as orelhas nascendo nos dois lados do alto da
// cabeça e um vão largo entre elas (onde o boné senta).
//
//   node e2e/pixel-art/personagem/mascote-frente.mjs   → blender/camadas/para-meshy/opcoes/mascote-orelhas-afastadas-K.png
import fs from 'node:fs';
import path from 'node:path';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const b64 = (f) => fs.readFileSync(path.join(AQUI, f)).toString('base64');
const imagens = await chamar('/generate-image-v2', {
  description:
    'the full body of the exact same bunny character as the reference, seen straight from the FRONT, standing upright and symmetric, arms relaxed and slightly away from the body, legs slightly apart, both feet visible, white fur, closed happy eyes, a small smile, dark charcoal hoodie and dark pants, CHUBBY chibi proportions exactly like the reference: a big round head, a round soft plump body, short thick arms and short stubby legs, a wide round belly in the hoodie, NOT slim and NOT tall; a SMOOTH bald top of the head (no hair, no tuft, no fringe); the two ears are thick and of medium length (shorter than the head height), standing up from the LEFT and RIGHT sides of the top of the head, set WIDE APART with a clear gap of head between them as wide as one ear, pink inside, not touching each other; the whole character fits inside the frame with empty space above the ear tips and below the feet, fine detailed pixel art with a 1-pixel dark outline, flat even light, no shadow, no background, no text',
  image_size: { width: 128, height: 192 },
  no_background: true,
  reference_images: [
    {
      image: { type: 'base64', base64: b64('mascote/conceito.png'), format: 'png' },
      size: { width: 294, height: 492 },
      usage_description: 'This is the character: keep the face, fur, hoodie, pants and proportions, but set the ears wider apart as described',
    },
    // O estilo do 14 (o das fotos de frente) AFINOU o corpo (09/11/2026, relato dele: "parece magrinho, uma opção feminina
    // do mascote"): só entra com ESTILO=14 no ambiente.
    ...(process.env.ESTILO === '14' ? [{
      image: { type: 'base64', base64: b64('../avatares/frente/coelho-14-1.png'), format: 'png' },
      size: { width: 128, height: 192 },
      usage_description: 'Only the drawing style, level of detail, outline, shading and the size of the character in the frame: match it. Do NOT copy this character, its colors or clothes',
    }] : []),
  ],
});
const pasta = path.join(AQUI, 'blender', 'camadas', 'para-meshy', 'opcoes');
fs.mkdirSync(pasta, { recursive: true });
const ja = fs.readdirSync(pasta).filter((f) => f.startsWith('mascote-orelhas-afastadas-')).length;
imagens.forEach((b, k) => fs.writeFileSync(path.join(pasta, `mascote-orelhas-afastadas-${ja + k + 1}.png`), Buffer.from(b, 'base64')));
console.log(`${imagens.length} opção(ões)`);
