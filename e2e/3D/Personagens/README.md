# Modelos 3D dos personagens

| arquivo | de onde veio |
|---|---|
| `mascote-t.glb` | Meshy, 30/10/2026, a mesma figura de braços abertos (em T), feita por ele. Veio com o esqueleto e as animações do Meshy (Mixamo), que o script descarta: ver `e2e/pixel-art/personagem/blender/meshy/README.md` |
| `mascote.glb` | Meshy, 30/10/2026, a partir de `e2e/pixel-art/personagem/mascote/conceito.png` (de frente, braços para baixo). Malha única, textura 2048 (cor, rugosidade, normal), sem esqueleto. Animado em `e2e/pixel-art/personagem/blender/meshy/` |
| `musculoso-t.glb` | Meshy, 10/11/2026, o forte masculino de regata e short (o corpo `musculoso` do pixel art), em T. Veio com o esqueleto e as animações do Meshy, que o script descarta. Textura 4096. A conferir: os olhos saíram ABERTOS (o mascote e a feminina têm os olhos fechados), a textura tem manchas em degrau e uns triângulos claros nas costas da regata, e não tem o rabinho |
| `musculoso-f-curta-t.glb` | Meshy, 10/11/2026, a forte feminina de regata curta e short (o corpo `musculoso-f-curta` do pixel art), em T, com o rabinho e o tênis. Esqueleto e animações do Meshy, descartados como nos outros. Textura 4096 |

**Do Meshy, basta o GLB com a textura, SEM o rigging:** a malha é a mesma (conferido na feminina: os mesmos 8.851 vértices),
e os braços abertos vêm da geração, não do rigging. As texturas de 4096 vão a 2048 antes do site, como as do mascote.

Os modelos baixados do Meshy são nossos (licença privada para uso comercial). O esqueleto é sempre o NOSSO, posto pelo
script do Blender: nunca o automático do serviço.
