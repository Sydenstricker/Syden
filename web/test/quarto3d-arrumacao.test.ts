// O QUARTO 3D DESENHA A ARRUMAÇÃO DO PIXEL (06/11/2026): a tradução (arrumacao.ts) e os temas (temas.ts). Confere que todo tema
// tem um modelo para cada peça do pixel, que os números copiados da página do quarto batem com ela, e as contas de eixo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FABRICA, ITENS_DA_PAREDE, JANELAS, noMundo, PLANTAS, TAMANHOS } from '../src/quarto3d/arrumacao';
import { ORDEM_DOS_TEMAS, TEMAS } from '../src/quarto3d/temas';

const PAGINA = new URL('../../e2e/pixel-art/quarto/novo/quarto/', import.meta.url);
const montar = readFileSync(new URL('montar.mjs', PAGINA), 'utf8');
const html = readFileSync(new URL('quarto.html', PAGINA), 'utf8');
/** Um objeto literal da página ({ pufe: [4, 4, 0], 'planta-alta': … }) como JSON. */
const literal = (texto: string) => JSON.parse(texto.replace(/'/g, '"').replace(/([{,]\s*)([a-z][\w-]*)\s*:/gi, '$1"$2":'));
const OBJETOS_DE_CIMA = ['caneca', 'suco', 'refrigerante', 'plantinha', 'livros', 'videogame', 'pipoca', 'retrato', 'salgadinho', 'bolo'];

test('todo tema tem um modelo para cada peça do pixel', () => {
  assert.deepEqual([...ORDEM_DOS_TEMAS].sort(), Object.keys(TEMAS).sort());
  for (const tema of Object.values(TEMAS)) {
    for (const tipo of Object.keys(TAMANHOS)) assert.ok(tema.moveis[tipo]?.arquivo, `${tema.id}: o móvel ${tipo}`);
    for (const tipo of Object.keys(ITENS_DA_PAREDE)) assert.ok(tema.naParede[tipo]?.arquivo, `${tema.id}: o objeto da parede ${tipo}`);
    for (const tipo of OBJETOS_DE_CIMA) assert.ok(tema.deCima[tipo]?.arquivo, `${tema.id}: o objeto de cima ${tipo}`);
    assert.ok(tema.cadeira.arquivo && tema.parede.reta && tema.parede.janela);
  }
});

test('os modelos dos temas existem em web/public/quarto3d/', () => {
  const pasta = new URL('../public/quarto3d/', import.meta.url);
  for (const tema of Object.values(TEMAS)) {
    const arquivos = new Set<string>([tema.parede.reta, tema.parede.janela, ...(tema.parede.janelaTres ?? []), tema.cadeira.arquivo]);
    if (tema.chao.arquivo) arquivos.add(tema.chao.arquivo);
    for (const p of [...Object.values(tema.moveis), ...Object.values(tema.naParede), tema.cadeira]) {
      arquivos.add(p.arquivo);
      for (const c of p.partes ?? []) arquivos.add(c.arquivo);
    }
    for (const o of Object.values(tema.deCima)) arquivos.add(o.arquivo);
    for (const a of arquivos) {
      if (a.startsWith('codigo:')) continue;
      const ext = a.startsWith('kenney/') || a.startsWith('comida/') ? '.glb' : '.gltf';
      assert.doesNotThrow(() => readFileSync(new URL(a + ext, pasta)), `${tema.id}: falta ${a}${ext}`);
    }
  }
});

test('os objetos da parede, as janelas e os objetos de cima batem com a página do quarto', () => {
  const ini = html.indexOf('const ITENS_PAREDE = porTipo(') + 'const ITENS_PAREDE = porTipo('.length;
  const itens = JSON.parse(html.slice(ini, html.indexOf(', ITENS_DA_COPIA)', ini)));
  assert.deepEqual(Object.keys(ITENS_DA_PAREDE).sort(), Object.keys(itens).sort());
  for (const [id, it] of Object.entries(ITENS_DA_PAREDE)) {
    assert.deepEqual(it.ocupa, itens[id].ocupa, id);
    assert.deepEqual(it.alto, itens[id].alto, id);
  }
  const j = html.indexOf('const JANELAS = ') + 'const JANELAS = '.length;
  const janelas = JSON.parse(html.slice(j, html.indexOf(';\n', j)));
  assert.deepEqual(Object.keys(JANELAS).sort(), Object.keys(janelas).sort());
  for (const [id, o] of Object.entries(JANELAS)) assert.deepEqual(o.ocupa, janelas[id].ocupa, id);
  const c = html.indexOf('const OBJETOS_DE_CIMA = ') + 'const OBJETOS_DE_CIMA = '.length;
  assert.deepEqual(Object.keys(JSON.parse(html.slice(c, html.indexOf(';\n', c)))).sort(), [...OBJETOS_DE_CIMA].sort());
});

test('a arrumação de fábrica de cada planta é a da página do quarto', () => {
  const dele = literal(/const DELE = (\{[^\n]*\});/.exec(montar)![1]);
  for (const [id, [u, v, lado]] of Object.entries(dele) as [string, number[]][]) assert.deepEqual(FABRICA.quadrado.moveis[id], { c: [u, v], lado }, id);
  for (const pl of ['l', 'cubiculo']) {
    const pos = literal(new RegExp(`INICIAIS\\.${pl} = de\\((\\{[^\\n]*\\})\\);`).exec(montar)![1]);
    for (const [id, [u, v, lado]] of Object.entries(pos) as [string, number[]][]) assert.deepEqual(FABRICA[pl].moveis[id], { c: [u, v], lado }, `${pl}: ${id}`);
  }
  assert.deepEqual(Object.keys(PLANTAS).sort(), ['cubiculo', 'l', 'quadrado']);
});

test('sem arrumação, a de fábrica: a poltrona guardada, e os eixos do pixel no 3D (x = v, z = u)', () => {
  const q = noMundo(null);
  assert.equal(q.planta, 'quadrado');
  assert.ok(!q.moveis.some((m) => m.id === 'poltrona'), 'a poltrona começa guardada');
  assert.ok(!q.moveis.some((m) => m.id === 'ventilador'), 'o ventilador começa guardado');
  // o móvel novo chega guardado para quem já arrumou (sem lugar na arrumação dele), e aparece onde a pessoa o pôs
  assert.ok(!noMundo({ moveis: { cama: { c: [1.5, 7], lado: 0 } }, guardados: [] }).moveis.some((m) => m.id === 'ventilador'));
  // a caminha do gato vem posta no quarto novo, e chega guardada no quarto já arrumado (09/11/2026)
  assert.ok(q.moveis.some((m) => m.id === 'caminha-gato'), 'a caminha começa posta');
  assert.ok(!noMundo({ moveis: { cama: { c: [1.5, 7], lado: 0 } }, guardados: [] }).moveis.some((m) => m.id === 'caminha-gato'));
  assert.deepEqual(noMundo({ moveis: { ventilador: { c: [5.5, 6.5], lado: 2 } }, guardados: [] }).moveis.find((m) => m.id === 'ventilador')?.pe, { x0: 6, x1: 7, z0: 5, z1: 6 });
  const cama = q.moveis.find((m) => m.id === 'cama')!;
  // (u, v) = (1,5, 7), o lado 0, e o pé de 3 ao longo de u por 2 ao longo de v
  assert.deepEqual([cama.x, cama.z, cama.lado], [7, 1.5, 0]);
  assert.deepEqual(cama.pe, { x0: 6, x1: 8, z0: 0, z1: 3 });
  assert.deepEqual([cama.largura, cama.fundo], [2, 3]);
  const mesa = q.moveis.find((m) => m.id === 'mesa')!;
  // a mesa no lado 3 (olha para +v, o +x do 3D): o pé girado
  assert.deepEqual(mesa.pe, { x0: 0, x1: 1, z0: 0, z1: 3 });
  assert.deepEqual([mesa.largura, mesa.fundo], [3, 1]);
  // a janela grande na parede da direita do pixel (a do fundo do 3D), no vão do vidro
  assert.equal(q.janela.parede, 'fundo');
  assert.equal(q.janela.a, 3.2);
  assert.equal(q.cadeira.x, 2.15);
  assert.equal(q.naParede.find((o) => o.id === 'quadro')!.parede, 'esquerda');
});

test('a arrumação guardada: cópias, guardados, o que não existe, o L e a janela que não cabe', () => {
  const q = noMundo({
    planta: 'l',
    moveis: { 'cama~2': { c: [6, 6], lado: 1 }, foguete: { c: [1, 1], lado: 0 }, 'foguete~2': { c: [1, 1], lado: 0 } },
    guardados: ['pufe', 'cama', 'mesa'],
    janela: { tipo: 'original', parede: 'direita', v: 0 },
    parede: { quadro: { parede: 'direita', v: -1, h: 10 }, 'pintura~2': { parede: 'esquerda', v: 0, h: 0 }, nave: { parede: 'direita', v: 0, h: 0 } },
    conhecidos: Object.keys(ITENS_DA_PAREDE),
    emCima: { a: { tipo: 'caneca', em: 'mesa', s: 0, t: 0, lado: 0 }, b: { tipo: 'caneca', em: 'pufe', s: 0, t: 0, lado: 0 } },
    cores: { tapete: 'rosa', parede: 'xadrez' },
  });
  const ids = q.moveis.map((m) => m.id).sort();
  assert.ok(ids.includes('cama~2') && !ids.some((id) => id.startsWith('foguete')));
  // a cama e a mesa (com função) não se guardam; o pufe, sim
  assert.ok(ids.includes('cama') && ids.includes('mesa') && !ids.includes('pufe'));
  // o L: o canto do fundo não é chão, e são quatro trechos de parede
  assert.equal(q.chao(1, 1), false);
  assert.equal(q.chao(5, 1), true);
  assert.equal(q.trechos.length, 4);
  // a grande não cabe em trecho nenhum do L: fica a de fábrica dele
  assert.equal(q.janela.tipo, 'cortinas');
  assert.deepEqual(q.naParede.map((o) => o.id).sort(), ['pintura~2', 'quadro']);
  assert.deepEqual(q.deCima.map((o) => o.id), ['a']);
  assert.equal(q.cores.tapete, '#d99ba3');
  assert.equal(q.cores.parede, undefined);
});
