// A PORTA DE ENTRADA DO SALÃO (aprovada por ele em 20/10/2026, dívida de arte do CLAUDE.md): o membro novo chega por ela, e
// o coelho do balcão acena. Gerada AVULSA (sem parede), como os outros objetos da parede do salão, com a porta do banheiro
// (parede-salao/porta/avulso-1.png) de referência do ângulo e do tamanho: a mesma parede, a mesma inclinação.
//
//   node e2e/pixel-art/quarto/novo/quarto/parede/entrada.mjs fechada      → parede-salao/entrada/fechada-<n>.png
//   node e2e/pixel-art/quarto/novo/quarto/parede/entrada.mjs aberta <n>   → parede-salao/entrada/aberta-<m>.png (da fechada n)
//
// Cada pedido vai para e2e/pixel-art/custos.jsonl, com o saldo antes e depois.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const D = path.join(AQUI, '..', 'parede-salao', 'entrada');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const img = (arq) => ({ type: 'base64', base64: fs.readFileSync(arq).toString('base64'), format: 'png' });
// 72 × 148 com a porta do banheiro no meio, com folga: no quadro justo (56 × 148) a porta nova enchia tudo e saía cortada
const W = 72, H = 148;
const ESTILO = 'cozy warm isometric pixel art, dark warm brown outline, clean pixel clusters, isolated on a transparent background, NO wall and NO bricks drawn behind or around it';

async function gerar(descricao, ref, uso) {
  const r = await fetch(API + '/generate-image-v2', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ description: descricao, image_size: { width: W, height: H }, no_background: true, reference_images: [{ image: img(ref), size: { width: W, height: H }, usage_description: uso }] }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 400));
  let j = JSON.parse(t);
  const trabalho = j.background_job_id;
  for (let i = 0; trabalho && !['completed', 'succeeded'].includes(j.status); i++) {
    if (i > 150) throw new Error('demorou demais');
    await new Promise((ok) => setTimeout(ok, 4000));
    j = await (await fetch(API + '/background-jobs/' + trabalho, { headers: cab })).json();
    if (['failed', 'error'].includes(j.status)) throw new Error(JSON.stringify(j).slice(0, 400));
  }
  usado += j.usage?.generations ?? 0;
  return (j.last_response?.images ?? j.images ?? []).map((q) => (typeof q === 'string' ? q : q.base64));
}

fs.mkdirSync(D, { recursive: true });
const [modo, n] = process.argv.slice(2);
const antes = await saldo();
let lista, usado = 0;
if (modo === 'fechada') {
  lista = await gerar(
    `ONLY ONE closed front entrance door of a cozy cafe, warm honey wooden door with a small arched window of four glass panes at the top, a round brass knob, a small brass mail slot, a thick light wooden door frame, standing on the floor, the whole door and frame fit inside the image with empty margin around, no text, no signs, ${ESTILO}`,
    path.join(D, 'ref-margem.png'),
    'A door at this exact isometric angle, size and position in the image: draw a DIFFERENT door (the entrance), same angle and the same frame size',
  );
} else if (modo === 'aberta') {
  lista = await gerar(
    `ONLY the SAME front entrance door frame, now the door is OPEN: the wooden door leaf swung outward and seen edge-on inside the doorway, the doorway shows a bright warm outdoor light, a sunny garden path, the same thick light wooden door frame, standing on the floor, ${ESTILO}`,
    path.join(D, `fechada-${n}.png`),
    'This exact door frame at this exact angle, size and position: keep the frame identical, only the door opens',
  );
} else throw new Error('uso: entrada.mjs fechada | aberta <n>');
lista.forEach((b, i) => fs.writeFileSync(path.join(D, `${modo}-${i + 1}.png`), Buffer.from(b, 'base64')));
await new Promise((ok) => setTimeout(ok, 8000)); // o débito chega uns segundos depois do fim
const depois = await saldo();
fs.appendFileSync(path.join(AQUI, '..', '..', '..', '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `salao/porta-de-entrada/${modo}`, geracoes: usado || +(antes - depois).toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(lista.length, 'opções', modo, '; custou', usado, 'restam', depois);
