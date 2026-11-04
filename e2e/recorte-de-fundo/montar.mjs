// A página de comparação (resultados/comparar.html), a partir de medidas.json. medir.mjs a chama no fim; para remontar
// sem medir de novo: node e2e/recorte-de-fundo/montar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, 'resultados');

export function montar(IMAGENS, TODOS, medidas) {
  const { nucleos } = medidas;
  const temPlaca = medidas.temPlaca;
  // só os modelos que rodaram em algum provedor viram coluna; os que falharam vão numa nota
  const MODELOS = TODOS.filter(([id]) => Object.values(medidas.modelos[id].provedores).some((p) => !p.erro));
  const falharam = TODOS.filter((m) => !MODELOS.includes(m)).map(([, nome]) => nome);
  // A comparação: uma linha por imagem, uma coluna por jeito de recortar.
  const xadrez = 'background:repeating-conic-gradient(#d8d8d8 0 25%,#fff 0 50%) 0 0/16px 16px';
  const celula = (src) => `<td><div class="f" style="${xadrez}"><img src="${src}"></div></td>`;
  const cabecalho = ['Original', 'Passo 1 (só código)', ...MODELOS.map(([id, nome]) => {
    const p = medidas.modelos[id].provedores;
    const tempo = (q) => (p[q]?.medianaMs != null ? `${q === 'webgpu' ? 'placa' : 'processador'} ~${p[q].medianaMs} ms` : '');
    return `${nome}<br><small>${medidas.modelos[id].megas} MB · ${['webgpu', 'wasm'].map(tempo).filter(Boolean).join(' · ')}</small>`;
  })];
  const linhas = IMAGENS.map(([arquivo, rotulo]) => `<tr><th>${rotulo}</th>${celula(`../imagens/${arquivo}`)}${celula(`${arquivo}.passo1.png`)}${MODELOS.map(([id]) => celula(`${arquivo}.${id}.png`)).join('')}</tr>`);
  writeFileSync(join(SAIDA, 'comparar.html'), `<!doctype html><meta charset="utf-8"><title>Recorte de fundo</title>
  <style>body{font:14px system-ui;margin:16px;background:#1e1f22;color:#eee}table{border-collapse:collapse}th,td{padding:6px;vertical-align:middle}
  thead th{font-weight:600}tbody th{text-align:left;width:110px}.f{width:230px;height:190px;display:flex;align-items:center;justify-content:center;border-radius:6px}
  .f img{max-width:220px;max-height:180px}</style>
  <h1>Recorte de fundo: os três modelos</h1><p>${falharam.length ? `Não rodaram aqui: ${falharam.join(', ')}. ` : ''}${nucleos} núcleos (${medidas.threads} usados) · placa de vídeo: ${temPlaca ? 'sim' : 'não'}. Tempo = a mediana por imagem, depois de aberto o modelo.</p>
  <table><thead><tr><th></th>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table>`);
  
  
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { IMAGENS, MODELOS } = await import('./lista.mjs');
  montar(IMAGENS, MODELOS, JSON.parse(readFileSync(join(SAIDA, 'medidas.json'), 'utf8')));
}
