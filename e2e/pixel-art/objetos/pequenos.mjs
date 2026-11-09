// OS OBJETOS DE CIMA NO TAMANHO FINAL (09/11/2026, dívida de arte do CLAUDE.md: "gerados no TAMANHO FINAL, de 16 a 24 px,
// com silhueta forte e pouco detalhe: vieram 2,5× maiores e reduzir pixel art quebra o contorno"). Os de objetos.mjs nasceram
// em quadros de 40 a 56 px e o motor os mostrava inteiros, grandes demais para os móveis; pela metade, o vizinho mais
// próximo quebrava o contorno. Aqui eles nascem no quadro de 24 px, já na escala do quarto:
//   - OPÇÕES: create-1-direction-object com imagens de ESTILO de 24 px (o pedaço do tampo da mesa do quarto, com o mouse, na
//     escala de verdade): o tamanho do quadro sai da imagem de estilo, e uma chamada dá várias peças, uma descrição por casa
//     (item_descriptions). → pequenos/opcoes/<rodada>-<n>-<id>.png
//   - GIRAR: as 8 vistas do mesmo objeto (create-8-direction-object, a escolhida como referência) para os que têm lado
//     (a caneca tem asa, os livros, o porta-retrato, o videogame). → pequenos/<id>-giros/<direção>.png
//   - O que é igual de todos os lados (o copo, a lata, a planta, as comidas) usa a mesma vista nas 4 posições.
// A escolha de cada um fica em pequenos/escolhidos.json ({ id: "<arquivo da opção>" }); o motor (quarto/novo/quarto/montar.mjs)
// prefere estes aos antigos, e os mostra no tamanho em que nasceram.
//   node e2e/pixel-art/objetos/pequenos.mjs opcoes <rodada> <id> [<id> ...]   (até 8 casas; um id pode repetir)
//   node e2e/pixel-art/objetos/pequenos.mjs girar <id> <arquivo em pequenos/>
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'pequenos');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
// Silhueta forte e pouco detalhe: o objeto tem de se ler com 12 a 20 px.
const COMUM = 'tiny isometric pixel art item seen from above at a 2:1 isometric angle, bold dark outline, strong simple silhouette, very little detail, few flat colors, warm cozy muted palette, small enough to sit on a desk';
export const OBJETOS = {
  caneca: 'a ceramic coffee mug with a handle',
  suco: 'a tall glass of orange juice with a straw',
  refrigerante: 'a red soda can',
  plantinha: 'a tiny green succulent in a small terracotta pot',
  livros: 'a short stack of three colorful books lying flat',
  videogame: 'a small game console box with one controller beside it',
  pipoca: 'a striped bowl full of popcorn',
  retrato: 'a small standing wooden picture frame',
  pizza: 'a whole pepperoni pizza on a round wooden board',
  salgadinho: 'an open bag of potato chips',
  bolo: 'a round chocolate cake with strawberries on top',
};

async function esperarObjeto(id) {
  for (let i = 0; ; i++) {
    if (i > 480) throw new Error(`demorou demais (objeto ${id})`);
    await esperar(5000);
    let det; try { det = await (await fetch(`${API}/objects/${id}`, { headers: cab })).json(); } catch { continue; } // (a rede cai às vezes)
    if (['completed', 'review'].includes(det.status)) return det;
    if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
  }
}
async function baixar(url, arquivo) {
  for (let t = 0; t < 4; t++) {
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    // "too_busy" volta como um PNG quebrado: confere a assinatura e pede de novo
    if (buf.slice(1, 4).toString() === 'PNG' && buf.length > 80) { fs.writeFileSync(arquivo, buf); return true; }
    await esperar(4000);
  }
  return false;
}
const registrar = (peca, usage, antes, depois) => fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca, geracoes: usage?.generations ?? +(antes - depois).toFixed(1), usage: usage ?? null, quando: new Date().toISOString() }) + '\n');

const [modo, ...resto] = process.argv.slice(2);
fs.mkdirSync(path.join(SAIDA, 'opcoes'), { recursive: true });
if (modo === 'opcoes') {
  const [rodada, ...ids] = resto;
  if (!rodada || !ids.length || ids.some((i) => !OBJETOS[i])) throw new Error('opcoes <rodada> <id>...: ' + Object.keys(OBJETOS).join(', '));
  const estilo = fs.readdirSync(path.join(SAIDA, 'estilo')).filter((f) => f.endsWith('.png')).map((f) => ({ type: 'base64', base64: fs.readFileSync(path.join(SAIDA, 'estilo', f)).toString('base64'), format: 'png' }));
  const antes = await saldo();
  const r = await fetch(API + '/create-1-direction-object', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ description: `ONE small object only, ${COMUM}`, view: 'top-down', style_images: estilo, item_descriptions: ids.map((i) => `${OBJETOS[i]}, ${COMUM}`) }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const resp = JSON.parse(t);
  console.log('objeto', resp.object_id, 'casas', resp.n_frames, 'usage', JSON.stringify(resp.usage));
  const det = await esperarObjeto(resp.object_id);
  fs.writeFileSync(path.join(SAIDA, 'opcoes', rodada + '.json'), JSON.stringify({ pedido: ids, resposta: resp, det }, null, 2));
  const urls = det.frame_urls ?? Object.values(det.rotation_urls ?? {}).filter(Boolean);
  let n = 0;
  for (const [i, url] of urls.entries()) if (await baixar(typeof url === 'string' ? url : url.url, path.join(SAIDA, 'opcoes', `${rodada}-${i + 1}-${ids[i] ?? 'extra'}.png`))) n++;
  // as que ficam em revisão saem da fila do PixelLab: o arquivo já está aqui
  if (det.status === 'review') await fetch(`${API}/objects/${resp.object_id}/dismiss-review`, { method: 'POST', headers: cab });
  registrar('objetos/pequenos/opcoes/' + rodada, resp.usage, antes, await saldo());
  console.log(rodada, n, 'casas');
} else if (modo === 'girar') {
  const [id, arquivo] = resto;
  const pasta = path.join(SAIDA, id + '-giros');
  fs.mkdirSync(pasta, { recursive: true });
  const antes = await saldo();
  const r = await fetch(API + '/create-8-direction-object', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ description: `${OBJETOS[id]}, tiny pixel art item, bold dark outline, simple silhouette`, view: 'low top-down', reference_image: { type: 'base64', base64: fs.readFileSync(path.join(SAIDA, arquivo)).toString('base64'), format: 'png' } }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
  const resp = JSON.parse(t);
  const det = await esperarObjeto(resp.object_id);
  fs.writeFileSync(path.join(pasta, 'objeto.json'), JSON.stringify(det, null, 2));
  let k = 0;
  for (const [d, v] of Object.entries(det.rotation_urls ?? {})) { const url = typeof v === 'string' ? v : v?.url; if (url && (await baixar(url, path.join(pasta, d + '.png')))) k++; }
  registrar('objetos/pequenos/giros/' + id, resp.usage, antes, await saldo());
  console.log(id, k, 'vistas, usage', JSON.stringify(resp.usage));
} else throw new Error('modo: opcoes | girar');
