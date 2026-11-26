// Monta a página de comparação num arquivo só: node e2e/sprite-stacking/montar.mjs <saída.html>
// A RESOLUÇÃO (teste de 26/11/2026): a tela da corrida é de constantes (W, H, HORIZONTE, FOCO em render.ts). Para testar
// telas maiores sem mexer no jogo, este script reescreve essas linhas SÓ no pacote da página, multiplicando por
// globalThis.__RES (1, 1,5 ou 2, lido do #res-… do endereço). O mundo (a pista, a câmera, os tamanhos) não muda.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const aqui = fileURLToPath(new URL('.', import.meta.url));
const F = 'const F = (globalThis as { __RES?: number }).__RES ?? 1;\n';
const trocas = {
  'render.ts': [
    ['export const W = 320;', 'export const W = Math.round(320 * F);'],
    ['export const H = 180;', 'export const H = Math.round(180 * F);'],
    ['export const HORIZONTE = 58;', 'export const HORIZONTE = Math.round(58 * F);'],
    ['const FOCO = 172;', 'const FOCO = 172 * F;'],
    ['escala: ATRAS / z, z', 'escala: (ATRAS * F) / z, z'],
  ],
  'caixaEmFatias.ts': [['const FOCO = 172;', 'const FOCO = 172 * F;']],
  'fatias.ts': [
    ['export const FOCO = 172;', 'export const FOCO = 172 * F;'],
    ['(tamanho * atras) / FOCO', '(tamanho * atras) / 172'],
  ],
};
const resolucao = {
  name: 'resolucao',
  setup(b) {
    b.onLoad({ filter: /(render|caixaEmFatias|fatias)\.ts$/ }, (a) => {
      const nome = a.path.split(/[\\/]/).pop();
      let src = readFileSync(a.path, 'utf8');
      for (const [de, para] of trocas[nome] ?? []) {
        if (!src.includes(de)) throw new Error(`${nome}: não achei "${de}"`);
        src = src.split(de).join(para);
      }
      return { contents: (trocas[nome] ? F : '') + src, loader: 'ts' };
    });
  },
};
const r = await build({ entryPoints: [aqui + 'main.ts'], bundle: true, format: 'iife', loader: { '.png': 'dataurl' }, minify: true, write: false, plugins: [resolucao] });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\/script');
const html = readFileSync(aqui + 'pagina.html', 'utf8').replace('/*APP*/', () => js);
writeFileSync(process.argv[2] ?? aqui + 'saida.html', html);
