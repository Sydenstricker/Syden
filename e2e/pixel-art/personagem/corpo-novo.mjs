// UM CORPO BASE NOVO (piloto das camadas, 09/11/2026: "quero que nosso método seja escalável e com qualidade; resolver
// primeiro em 2D"). Corpo novo só existe quando a SILHUETA muda (orelha caída, corpo mais baixo): o pelo é paleta, a
// roupa é outra camada e os acessórios são avulsos.
//
// O CORPO NOVO É UM ESTADO DO MASCOTE (create-character-state), e não um personagem criado do zero. Medido no mesmo dia:
// criado de um conceito repintado (falhas/pelo-conceito/), ele saiu com 57 px de pé contra os 90 do mascote, mais de
// frente e com outra luz — e um acessório não teria como servir aos dois. Como estado, ele herda o tamanho, a vista, a
// paleta e o esqueleto do mascote, e as animações saem pelo mesmo animar.mjs (COELHO=<nome>).
//
//   node e2e/pixel-art/personagem/corpo-novo.mjs <nome>   → <nome>/baixa-120/<direção>.png + personagem.json
//
// O que muda em cada corpo mora em CORPOS.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MASCOTE = JSON.parse(fs.readFileSync(path.join(AQUI, 'mascote', 'baixa-120', 'personagem.json'), 'utf8')).id;

const CORPOS = {
  'orelha-caida': {
    edicao:
      'the same bunny but with long floppy LOP ears: both ears hang down along the sides of the head, down to the shoulders, pink inside, nothing sticking up above the head; everything else exactly the same: same size, same pose, same hoodie, same face',
  },
  // O coelho de academia (pedido dele, 09/11/2026: "uma variação com coelho musculoso de academia e regata"). A silhueta
  // muda (ombros, braços, peito) e a roupa junto: a regata é a roupa DESTE corpo, como o moletom é a do mascote.
  musculoso: {
    edicao:
      'the same bunny but as a muscular gym bunny: broad shoulders, big round biceps and forearms, a strong chest, a slightly bigger torso, wearing a sleeveless athletic tank top in heather grey that shows the arms, black gym shorts and white sneakers instead of the hoodie and pants; the same head, the same face with closed happy eyes, the same long upright ears, the same height and the same standing pose',
  },
};

const [nome] = process.argv.slice(2);
const corpo = CORPOS[nome];
if (!corpo) throw new Error('uso: corpo-novo.mjs <' + Object.keys(CORPOS).join('|') + '>');
const pasta = path.join(AQUI, nome, 'baixa-120');
fs.mkdirSync(pasta, { recursive: true });

const antes = await saldo();
const r = await fetch(API + '/create-character-state', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({ character_id: MASCOTE, edit_description: corpo.edicao, state_name: nome, no_background: true, use_color_palette_from_reference: true }),
});
const t = await r.text();
if (!r.ok) throw new Error(r.status + ': ' + t.slice(0, 600));
const resposta = JSON.parse(t);
const id = resposta.character_id ?? resposta.new_character_id ?? resposta.id;
console.log('corpo', id);
let det;
for (let i = 0; ; i++) {
  if (i > 120) throw new Error('demorou demais');
  await esperar(5000);
  det = await (await fetch(`${API}/characters/${id}`, { headers: cab })).json();
  if (det.status === 'completed') break;
  if (['failed', 'error'].includes(det.status)) throw new Error(JSON.stringify(det).slice(0, 600));
}
fs.writeFileSync(path.join(pasta, 'personagem.json'), JSON.stringify({ id, vista: 'low top-down', de: MASCOTE, ...det }, null, 2));
let n = 0;
for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
  const url = typeof v === 'string' ? v : v?.url;
  if (url) { fs.writeFileSync(path.join(pasta, d + '.png'), Buffer.from(await (await fetch(url)).arrayBuffer())); n++; }
}
const g = antes - (await saldo());
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/corpo/${nome}`, geracoes: +g.toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} direções em ${nome}/baixa-120/; custou ${g.toFixed(1)}`);
