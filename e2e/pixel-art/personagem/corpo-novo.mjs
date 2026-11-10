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
// O que muda em cada corpo mora em CORPOS. `base` (10/11/2026) faz o corpo novo como estado de OUTRO corpo base em vez do
// mascote (a versão feminina da orelha caída sai da orelha caída, e a do musculoso, do musculoso: herdam a orelha e a roupa).
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const idDe = (corpo) => JSON.parse(fs.readFileSync(path.join(AQUI, corpo, 'baixa-120', 'personagem.json'), 'utf8')).id;

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
  // O TIPO DE CORPO FEMININO (pedido dele, 10/11/2026: "no Dark Souls tem uma opção de tipo de corpo, variações feminino e
  // masculino; ela é a variação feminina do nosso mascote principal"). A silhueta muda e a roupa NÃO: o mesmo moletom, para a
  // troca de cor da roupa valer igual. Sem laço nem enfeite: enfeite é acessório, e acessório é camada à parte.
  // A ROUPA DE FÁBRICA DO TIPO FEMININO (decisão dele, 10/11/2026): o moletom comprido. É a primeira tentativa do corpo (a
  // "versão A", que saiu com a silhueta feminina sutil e o moletom do mascote), aproveitada como roupa: pasta mascote-f-moletom.
  'mascote-f-moletom': {
    edicao:
      'the same bunny but with a feminine body type: a slimmer and softer silhouette, narrower shoulders, a slightly narrower waist, slimmer arms and legs, the hoodie a little more fitted to the body, small eyelashes on the eyes; the same head size, the same face, the same long upright ears, the same height, the same standing pose and the same hoodie colors',
  },
  // O TIPO DE CORPO FEMININO DO MASCOTE (escolhido por ele, 10/11/2026, a "versão B", com o moletom curto e o umbigo): a pasta é
  // mascote-f. É a SILHUETA base das próximas variações; o moletom curto é a segunda roupa dele (a de fábrica é o moletom comprido). O umbigo foi pintado
  // à mão nas 3 vistas de frente (ele pediu: "faltou umbigo"); nas poses, o texto da edição pede o umbigo.
  'mascote-f': {
    edicao:
      'the same bunny but clearly with a FEMININE body type, noticeably different from the original: a much slimmer body, narrow shoulders, a visible waist, thin arms and thin legs, a cropped fitted hoodie that ends above the hips with slim fitted pants, long eyelashes on the closed happy eyes, a gentler softer face; the same head size, the same long upright ears, the same height, the same standing pose and the same hoodie colors',
  },
  // O TIPO FEMININO DOS OUTROS CORPOS (10/11/2026): a mesma silhueta feminina do mascote-f-moletom, cada um com a roupa do corpo
  // dele (a orelha caída com o moletom comprido; a forte com a regata, o short e o tênis). Saem do corpo de base, não do mascote.
  'orelha-caida-f-moletom': {
    base: 'orelha-caida',
    edicao:
      'the same bunny but with a feminine body type: a slimmer and softer silhouette, narrower shoulders, a slightly narrower waist, slimmer arms and legs, the hoodie a little more fitted to the body, small eyelashes on the eyes; the same head size, the same face, the same long floppy lop ears hanging down along the sides of the head, the same height, the same standing pose and the same hoodie colors',
  },
  'musculoso-f': {
    base: 'musculoso',
    edicao:
      'the same bunny but with a feminine athletic body type: still strong, with toned shoulders and strong muscular arms, but a clearly narrower waist, curvier hips, a softer feminine silhouette and small eyelashes on the eyes; the same heather grey sleeveless tank top fitted to the body, the same black gym shorts and white sneakers; the same head, the same face, the same long upright ears, the same height and the same standing pose',
  },
  // AS VERSÕES MAIS MARCADAS (pedido dele, 10/11/2026: as duas de cima saíram sutis, "faça uma versão mais marcada para avaliar"),
  // com a força do texto da mascote-f (a versão B que ele escolheu), cada uma com a roupa do corpo dela.
  // APROVADA (10/11/2026): a pasta dela é orelha-caida-f-moletom (a sutil foi para orelha-caida-f-moletom/falhas/sutil)
  'orelha-caida-f-marcada': {
    base: 'orelha-caida',
    edicao:
      'the same bunny but clearly with a FEMININE body type, noticeably different from the original: a much slimmer body, narrow shoulders, a visible waist, thin arms and thin legs, the long hoodie fitted to the body and cinched at the waist, slim fitted pants, long eyelashes on the closed happy eyes, a gentler softer face; the same head size, the same long floppy lop ears hanging down along the sides of the head, the same height, the same standing pose and the same hoodie colors',
  },
  // A FORTE FEMININA, DE NOVO (pedido dele, 10/11/2026: "ela teria um corpo mais feminino e não esses braços gigantes; mulher
  // musculosa não treina a mesma coisa que um homem musculoso, são outros grupos musculares"): o físico de academia feminino,
  // braços finos e definidos, cintura fina, pernas e glúteos fortes. Duas tentativas: do forte e da silhueta feminina do mascote.
  'musculoso-f-fitness': {
    base: 'musculoso',
    edicao:
      'the same bunny but as a FEMININE fitness athlete, completely different arms from the original: slim lean toned arms with only light definition (NOT big, NOT bulky), defined but narrow shoulders, a small narrow waist with toned abs, wide hips, strong thick thighs and strong round glutes, athletic legs, long eyelashes on the closed happy eyes, a gentler softer face; a fitted heather grey sports tank top, black fitted bike shorts and white sneakers; the same head size, the same long upright ears, the same height and the same standing pose',
  },
  // (a de cima foi APROVADA, 10/11/2026: a pasta dela é musculoso-f; a sutil e a marcada de antes foram para musculoso-f/falhas)
  'musculoso-f-fitness-2': {
    base: 'mascote-f',
    edicao:
      'the same feminine bunny but as a fitness athlete who trains at the gym: lean toned arms with light definition, defined shoulders, a small waist with toned abs, wider hips, strong thick thighs and strong round glutes, athletic legs; wearing a fitted heather grey sports tank top, black fitted bike shorts and white sneakers instead of the hoodie and pants; the same head, the same face with eyelashes, the same long upright ears, the same height and the same standing pose',
  },
  // A SEGUNDA VERSÃO DA FORTE FEMININA (pedido dele, 10/11/2026: "merece duas versões; a segunda faça com coxas mais marcadas"):
  // a tentativa 2 refeita, e ela entra como a OUTRA ROUPA da forte feminina (a regata curta), pasta musculoso-f-curta.
  'musculoso-f-curta': {
    base: 'mascote-f',
    edicao:
      'the same feminine bunny but as a fitness athlete who trains legs at the gym: lean toned arms with light definition, defined shoulders, a small waist with toned abs, wider hips, VERY strong thick muscular thighs that are clearly wider than the waist, big strong round glutes, muscular calves; wearing a fitted cropped heather grey sports tank top that shows the toned belly, black fitted bike shorts that end at mid thigh so the thick thighs show, and white sneakers instead of the hoodie and pants; the same head, the same face with eyelashes, the same long upright ears, the same height and the same standing pose',
  },
  'musculoso-f-marcada': {
    base: 'musculoso',
    edicao:
      'the same bunny but clearly with a FEMININE athletic body type, noticeably different from the original: an athletic woman bodybuilder silhouette, toned muscular arms and shoulders but narrower than the original, a clearly defined narrow waist, wider curvy hips, strong legs, long eyelashes on the closed happy eyes, a gentler softer face; a fitted heather grey sports tank top, the same black gym shorts and white sneakers; the same head size, the same long upright ears, the same height and the same standing pose',
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
  body: JSON.stringify({ character_id: idDe(corpo.base || 'mascote'), edit_description: corpo.edicao, state_name: nome, no_background: true, use_color_palette_from_reference: true }),
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
fs.writeFileSync(path.join(pasta, 'personagem.json'), JSON.stringify({ id, vista: 'low top-down', de: idDe(corpo.base || 'mascote'), base: corpo.base || 'mascote', edicao: corpo.edicao, ...det }, null, 2));
let n = 0;
for (const [d, v] of Object.entries(det.rotation_urls ?? {})) {
  const url = typeof v === 'string' ? v : v?.url;
  if (!url) continue;
  // o endereço às vezes devolve um erro 500 em JSON no lugar do PNG (animar.mjs): tenta de novo e avisa
  let b = null;
  for (let t = 0; t < 4 && !b; t++) {
    b = Buffer.from(await (await fetch(url)).arrayBuffer());
    if (b.subarray(1, 4).toString() !== 'PNG') { b = null; await esperar(3000); }
  }
  if (!b) { console.log(`a direção ${d} não veio (erro do PixelLab)`); continue; }
  fs.writeFileSync(path.join(pasta, d + '.png'), b); n++;
}
const g = antes - (await saldo());
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: `personagem/corpo/${nome}`, geracoes: +g.toFixed(1), quando: new Date().toISOString() }) + '\n');
console.log(`${n} direções em ${nome}/baixa-120/; custou ${g.toFixed(1)}`);
