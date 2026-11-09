// A AUDITORIA DAS BORDAS (09/11/2026, relato dele: "orelha do coelho está cortando na cama. Acho que temos que ter um
// agente de auditoria dos assets 2d, para verificar esses problemas de corte"): o coelho mora num quadro FIXO de 120 × 120
// (personagem/README.md), e o que passa do quadro no render ou na geração sai cortado RETO — a ponta da orelha do "lendo
// deitado" do mascote 3D foi o caso. Desenho que encosta no alto, na esquerda ou na direita do quadro é corte; o pé
// encostando embaixo é normal (é onde ele pisa).
//
// Só os quadros de PERSONAGEM entram: os móveis e os objetos são recortados rente ao desenho, e encostar na borda é o
// normal deles. E só as pastas que o quarto e o salão usam (FONTES, em quarto/novo/quarto/montar.mjs): as rodadas antigas
// (alta, baixa de 96, os pedaços -fa/-fb/-fc das transições) ficam de fora.
//
//   node e2e/pixel-art/auditoria-de-bordas.mjs            → as duas pastas do mascote; sai com erro se achar corte
//   node e2e/pixel-art/auditoria-de-bordas.mjs <pasta>    → só essa pasta, sem filtro (para conferir algo novo)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PADRAO = ['personagem/mascote-3d', 'personagem/mascote'].map((p) => path.join(AQUI, p));
const USADAS = /^(baixa-120[\\/]animacoes|estados|transicoes)[\\/][^\\/]+[\\/]/;
const FORA = /folha|check|revisao|comparar|conceito|estilo|fluido-se|[\\/][a-z-]+-f[abc][\\/]|esq-/;

/** Quantos pixels opacos (alfa > 20) encostam em cada borda dos quadros de uma faixa (quadros quadrados lado a lado). */
export function bordasDe(arquivo) {
  const png = PNG.sync.read(fs.readFileSync(arquivo));
  const lado = png.height;
  const quadros = Math.max(1, Math.round(png.width / lado));
  const largura = png.width / quadros;
  const opaco = (x, y) => png.data[(y * png.width + x) * 4 + 3] > 20;
  const borda = { topo: 0, esq: 0, dir: 0 };
  for (let q = 0; q < quadros; q++) {
    const x0 = q * largura;
    for (let y = 0; y < lado; y++) {
      if (opaco(x0, y)) borda.esq++;
      if (opaco(x0 + largura - 1, y)) borda.dir++;
    }
    for (let x = 0; x < largura; x++) if (opaco(x0 + x, 0)) borda.topo++;
  }
  return borda;
}

/** Os quadros cortados de uma pasta: [{ arquivo, borda }]. `filtrar` deixa só as pastas que o motor usa. */
export function auditar(raiz, { filtrar = true } = {}) {
  const achados = [];
  const andar = (pasta) => {
    for (const nome of fs.readdirSync(pasta)) {
      const caminho = path.join(pasta, nome);
      if (fs.statSync(caminho).isDirectory()) andar(caminho);
      else if (nome.endsWith('.png')) {
        const relativo = path.relative(raiz, caminho);
        if (filtrar && (!USADAS.test(relativo) || FORA.test(relativo))) continue;
        const borda = bordasDe(caminho);
        if (borda.topo || borda.esq || borda.dir) achados.push({ arquivo: relativo, borda });
      }
    }
  };
  andar(raiz);
  return achados;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const pedida = process.argv[2];
  const raizes = pedida ? [path.resolve(pedida)] : PADRAO;
  let total = 0;
  for (const raiz of raizes) {
    for (const { arquivo, borda } of auditar(raiz, { filtrar: !pedida })) {
      total++;
      const onde = Object.entries(borda).filter(([, n]) => n).map(([lado, n]) => `${lado}=${n}`).join(' ');
      console.log(`✖ ${path.relative(process.cwd(), path.join(raiz, arquivo))}  ${onde}`);
    }
  }
  console.log(total ? `\n${total} quadro(s) com desenho cortado na borda.` : '✔ nenhum quadro de personagem cortado na borda.');
  process.exitCode = total ? 1 : 0;
}
