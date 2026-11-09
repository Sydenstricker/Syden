// O COELHO NÃO SAI CORTADO (09/11/2026, relato dele: "orelha do coelho está cortando na cama"): nenhum quadro de pose que o
// quarto e o salão usam pode ter desenho encostado no alto ou nos lados do quadro de 120 × 120 — encostado é o que passou
// do quadro e foi cortado reto. A conta mora em e2e/pixel-art/auditoria-de-bordas.mjs (que também roda sozinha).
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
// @ts-expect-error: módulo .mjs sem tipos, de fora do site
import { auditar } from '../../e2e/pixel-art/auditoria-de-bordas.mjs';

for (const pasta of ['mascote-3d', 'mascote']) {
  test(`${pasta}: nenhum quadro de pose cortado na borda`, () => {
    const raiz = fileURLToPath(new URL(`../../e2e/pixel-art/personagem/${pasta}/`, import.meta.url));
    const achados = auditar(raiz) as { arquivo: string; borda: Record<string, number> }[];
    assert.deepEqual(
      achados.map((a) => a.arquivo),
      [],
      'quadros com o desenho cortado (renderizar de novo com mais margem; ver DESCER_DEITADO em blender/meshy/poses.py)',
    );
  });
}
