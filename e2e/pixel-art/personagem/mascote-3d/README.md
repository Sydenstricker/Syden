# O mascote 3D, nas poses do motor

Gravado em 30/10/2026 a partir de `e2e/3D/Personagens/mascote-t.glb`, pelo `blender/meshy/` (o `poses.py`). As pastas são
as MESMAS do mascote do PixelLab (`../mascote/`), para o motor achar tudo trocando só a raiz. **É o mascote do app desde
30/10/2026:** o `montar.mjs` usa esta pasta; `MASCOTE=pixellab` no ambiente volta ao desenho, numa página à parte
(`quarto-pixellab.html`, `salao-pixellab.html`).

| pasta | o que é | direções | desenhos |
|---|---|---|---|
| `baixa-120/<direção>.png` | parado (o primeiro desenho) | 8 | 1 |
| `baixa-120/animacoes/parado` | respirando | 8 | 16 |
| `baixa-120/animacoes/andando-v3` | andando | 8 | 8 |
| `baixa-120/animacoes/falando` | gesticulando | 8 | 8 |
| `baixa-120/animacoes/varrendo` | varrendo, à toa numa parada a cada três (o motor ancora pelo parado: a palha desce abaixo do pé) | 8 | 8 |
| `baixa-120/animacoes/digitando-maos` | ao computador: 0 a pose, 1–2 um toque, 3–4 o mouse (o roteiro do motor) | 8 | 5 |
| `estados/sentado-2`, `sentado-poltrona`, `sentado-banqueta`, `no-computador`, `no-fliperama` | sentado e de pé com as mãos no controle | 8 | 1 |
| `estados/lendo-deitado`, `dormindo`, `dormindo-largado` | deitado (na câmera do chão, ver abaixo) | 8 | 1 |
| `transicoes/sentar-fluido`, `bracos` | de pé → sentado; sentado → braços nos apoios | 4 | 6, 2 |
| `transicoes/deitar-fluido`, `deitar-lendo-fluido` | de pé → sentado → deitado | 4 | 4 |

`folha.png`: o sudeste de cada uma, para olhar. Refazer: `MODELO=t POSES=1` no `rodar.ps1` (~6 min) e depois no `pos.py`.

**Os deitados usam outra câmera.** A de pé (20° de elevação, 32° nas diagonais) foi escolhida para parecer o desenho do
PixelLab; deitado, nela o corpo some em profundidade e vira uma bola. Deitado é a do chão do salão (32°, diagonais a 45°),
e as transições para deitar passam de uma à outra junto com o corpo.

**O que falta para ficar bom (é o mínimo viável):** o rosto sai apagado (a textura desta malha); deitado, o chibi fica
curto perto do desenho; sentado, as pernas de toco quase não aparecem; e não há variação dentro das poses paradas.
