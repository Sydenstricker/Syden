import assert from 'node:assert/strict';
import { test } from 'node:test';

// O QUARTO EM 3D OU EM PIXEL ART (06/11/2026). O botão do quarto e Configurações → Gráficos mexem no MESMO valor, mas o padrão
// do quarto é o pixel art (decisão dele, quando o quarto 3D fosse ao app) e o do Cidades continua o 3D. Um '3d' guardado sem a
// marca de escolha pode ser só o de fábrica, gravado junto quando a pessoa mexeu nas sombras: não leva o quarto ao 3D.
const guardado = new Map<string, string>();
const avisos: string[] = [];
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => guardado.get(k) ?? null,
  setItem: (k: string, v: string) => void guardado.set(k, v),
  removeItem: (k: string) => void guardado.delete(k),
};
(globalThis as { window?: unknown }).window = {
  dispatchEvent: (e: { type: string }) => avisos.push(e.type),
  addEventListener() {},
  removeEventListener() {},
};
const { escolherEstiloVisual, estiloDoQuarto, estiloVisual } = await import('../src/Graficos');
const gravar = (g: object) => guardado.set('syden:graficos', JSON.stringify(g));

test('quem nunca escolheu: o quarto em pixel art, o Cidades em 3D', () => {
  guardado.clear();
  assert.equal(estiloDoQuarto(), '2d');
  assert.equal(estiloVisual(), '3d');
});

test('o 3D de fábrica gravado junto com as sombras não leva o quarto ao 3D', () => {
  gravar({ particulas: false, sombras: true, telas: false, estilo: '3d' });
  assert.equal(estiloDoQuarto(), '2d');
  assert.equal(estiloVisual(), '3d');
});

test('quem escolheu o 2D tem os dois em 2D, e quem escolheu o 3D tem os dois em 3D', () => {
  gravar({ estilo: '2d' });
  assert.equal(estiloDoQuarto(), '2d');
  assert.equal(estiloVisual(), '2d');
  escolherEstiloVisual('3d');
  assert.equal(estiloDoQuarto(), '3d');
  assert.equal(estiloVisual(), '3d');
  assert.equal(JSON.parse(guardado.get('syden:graficos')!).sombras, false, 'o resto das escolhas fica');
  assert.ok(avisos.includes('syden:graficos'), 'quem mostra o quarto fica sabendo na hora');
});

test('o botão do quarto volta ao pixel art e o Cidades vai junto (é a mesma escolha)', () => {
  escolherEstiloVisual('2d');
  assert.equal(estiloDoQuarto(), '2d');
  assert.equal(estiloVisual(), '2d');
});
