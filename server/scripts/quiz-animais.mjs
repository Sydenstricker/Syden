// OS ANIMAIS DO QUIZ (21/11/2026, o lote D da segunda auditoria dos mini-games). A lista e as colunas são NOSSAS (escritas para
// o Syden): bichos selvagens conhecidos, com o que os livros de divulgação dizem de cada um — é fato de zoologia, não obra de
// ninguém. Ficaram de fora os domésticos (cachorro, vaca, galinha): o continente deles é o mundo inteiro. Os NOMES em cada
// idioma vêm do Wikidata (CC0), pelo artigo da Wikipédia em inglês de cada espécie.
//
// As colunas (server/src/minijogo-quiz.ts, o tema "animais"):
// - classe: mamifero, ave, reptil, anfibio, peixe, inseto, aracnideo, crustaceo, molusco.
// - dieta: carnivoro, herbivoro, onivoro, insetivoro.
// - habitat: floresta, savana, campo, deserto, montanha, gelo, oceano, rio (água doce), pantano — de CONJUNTO.
// - continentes: onde vive solto, sem contar onde foi levado: africa, americas, asia, europa, oceania, antartida — de CONJUNTO.
// - peso: em kg, o típico do adulto (as fontes variam; vale a ordem de grandeza) — de ORDEM.
//
//   node server/scripts/quiz-animais.mjs
import { writeFileSync } from 'node:fs';
import { codigosNoWikidata, entidades, jsonDoQuiz, nomesDe, qidsDaWikipedia } from './quiz-wikidata.mjs';

const SAIDA = new URL('../assets/quiz/animais.json', import.meta.url);
const AM = 'americas';
const AF = 'africa';
const AS = 'asia';
const EU = 'europa';
const OC = 'oceania';
const AN = 'antartida';
const MUNDO = [AF, AM, AS, EU, OC];

// [artigo da Wikipédia em inglês, classe, dieta, habitats, continentes, peso (kg)]
const ANIMAIS = [
  // mamíferos
  ['Lion', 'mamifero', 'carnivoro', ['savana'], [AF, AS], 190],
  ['Tiger', 'mamifero', 'carnivoro', ['floresta'], [AS], 200],
  ['Jaguar', 'mamifero', 'carnivoro', ['floresta', 'pantano'], [AM], 90],
  ['Leopard', 'mamifero', 'carnivoro', ['savana', 'floresta'], [AF, AS], 60],
  ['Cheetah', 'mamifero', 'carnivoro', ['savana'], [AF], 50],
  ['Snow leopard', 'mamifero', 'carnivoro', ['montanha'], [AS], 45],
  ['Wolf', 'mamifero', 'carnivoro', ['floresta', 'montanha', 'campo'], [AM, EU, AS], 40],
  ['Red fox', 'mamifero', 'onivoro', ['floresta', 'campo'], [AM, EU, AS, AF], 6],
  ['Arctic fox', 'mamifero', 'carnivoro', ['gelo'], [AM, EU, AS], 4],
  ['Maned wolf', 'mamifero', 'onivoro', ['campo', 'savana'], [AM], 23],
  ['Spotted hyena', 'mamifero', 'carnivoro', ['savana'], [AF], 60],
  ['Polar bear', 'mamifero', 'carnivoro', ['gelo'], [AM, EU, AS], 450],
  ['Brown bear', 'mamifero', 'onivoro', ['floresta', 'montanha'], [AM, EU, AS], 300],
  ['Giant panda', 'mamifero', 'herbivoro', ['floresta', 'montanha'], [AS], 100],
  ['Red panda', 'mamifero', 'herbivoro', ['floresta', 'montanha'], [AS], 5],
  ['African bush elephant', 'mamifero', 'herbivoro', ['savana', 'floresta'], [AF], 6000],
  ['Giraffe', 'mamifero', 'herbivoro', ['savana'], [AF], 1200],
  ['Plains zebra', 'mamifero', 'herbivoro', ['savana'], [AF], 350],
  ['Hippopotamus', 'mamifero', 'herbivoro', ['rio', 'savana'], [AF], 1500],
  ['White rhinoceros', 'mamifero', 'herbivoro', ['savana'], [AF], 2300],
  ['Gorilla', 'mamifero', 'herbivoro', ['floresta'], [AF], 160],
  ['Chimpanzee', 'mamifero', 'onivoro', ['floresta', 'savana'], [AF], 50],
  ['Orangutan', 'mamifero', 'herbivoro', ['floresta'], [AS], 75],
  ['Ring-tailed lemur', 'mamifero', 'onivoro', ['floresta'], [AF], 2.2],
  ['Meerkat', 'mamifero', 'insetivoro', ['deserto', 'savana'], [AF], 0.75],
  ['Dromedary', 'mamifero', 'herbivoro', ['deserto'], [AF, AS], 500],
  ['Red kangaroo', 'mamifero', 'herbivoro', ['campo', 'deserto'], [OC], 85],
  ['Koala', 'mamifero', 'herbivoro', ['floresta'], [OC], 9],
  ['Platypus', 'mamifero', 'carnivoro', ['rio'], [OC], 1.5],
  ['Llama', 'mamifero', 'herbivoro', ['montanha'], [AM], 150],
  ['Capybara', 'mamifero', 'herbivoro', ['rio', 'pantano'], [AM], 50],
  ['Brown-throated sloth', 'mamifero', 'herbivoro', ['floresta'], [AM], 4],
  ['Giant anteater', 'mamifero', 'insetivoro', ['savana', 'floresta', 'campo'], [AM], 33],
  ['Nine-banded armadillo', 'mamifero', 'insetivoro', ['campo', 'floresta'], [AM], 5],
  ['South American tapir', 'mamifero', 'herbivoro', ['floresta', 'rio'], [AM], 250],
  ['Golden lion tamarin', 'mamifero', 'onivoro', ['floresta'], [AM], 0.6],
  ['Amazon river dolphin', 'mamifero', 'carnivoro', ['rio'], [AM], 150],
  ['Amazonian manatee', 'mamifero', 'herbivoro', ['rio'], [AM], 400],
  ['Moose', 'mamifero', 'herbivoro', ['floresta'], [AM, EU, AS], 500],
  ['Reindeer', 'mamifero', 'herbivoro', ['gelo', 'campo'], [AM, EU, AS], 120],
  ['American bison', 'mamifero', 'herbivoro', ['campo'], [AM], 700],
  ['Common raccoon', 'mamifero', 'onivoro', ['floresta'], [AM], 7],
  ['Red squirrel', 'mamifero', 'herbivoro', ['floresta'], [EU, AS], 0.3],
  ['European hedgehog', 'mamifero', 'insetivoro', ['floresta', 'campo'], [EU], 0.8],
  ['Blue whale', 'mamifero', 'carnivoro', ['oceano'], [...MUNDO, AN], 150000],
  ['Common bottlenose dolphin', 'mamifero', 'carnivoro', ['oceano'], MUNDO, 300],
  ['Orca', 'mamifero', 'carnivoro', ['oceano'], [...MUNDO, AN], 5000],
  ['Walrus', 'mamifero', 'carnivoro', ['gelo', 'oceano'], [AM, EU, AS], 1200],
  // aves
  ['Toco toucan', 'ave', 'onivoro', ['floresta'], [AM], 0.6],
  ['Scarlet macaw', 'ave', 'herbivoro', ['floresta'], [AM], 1],
  ['Harpy eagle', 'ave', 'carnivoro', ['floresta'], [AM], 6],
  ['Bald eagle', 'ave', 'carnivoro', ['rio', 'floresta'], [AM], 5],
  ['Common ostrich', 'ave', 'onivoro', ['savana', 'deserto'], [AF], 110],
  ['Greater rhea', 'ave', 'onivoro', ['campo'], [AM], 25],
  ['Emu', 'ave', 'onivoro', ['campo'], [OC], 40],
  ['Emperor penguin', 'ave', 'carnivoro', ['gelo', 'oceano'], [AN], 30],
  ['Greater flamingo', 'ave', 'onivoro', ['pantano'], [AF, EU, AS], 3],
  ['Western barn owl', 'ave', 'carnivoro', ['campo'], MUNDO, 0.5],
  ['Ruby-throated hummingbird', 'ave', 'herbivoro', ['floresta'], [AM], 0.003],
  ['Indian peafowl', 'ave', 'onivoro', ['floresta'], [AS], 5],
  ['Kiwi (bird)', 'ave', 'onivoro', ['floresta'], [OC], 2.5],
  // répteis
  ['Nile crocodile', 'reptil', 'carnivoro', ['rio'], [AF], 400],
  ['American alligator', 'reptil', 'carnivoro', ['pantano', 'rio'], [AM], 360],
  ['Green sea turtle', 'reptil', 'herbivoro', ['oceano'], [AF, AM, AS, OC], 150],
  ['Galápagos tortoise', 'reptil', 'herbivoro', ['campo'], [AM], 250],
  ['Komodo dragon', 'reptil', 'carnivoro', ['floresta', 'savana'], [AS], 70],
  ['Green anaconda', 'reptil', 'carnivoro', ['rio', 'pantano'], [AM], 70],
  ['King cobra', 'reptil', 'carnivoro', ['floresta'], [AS], 6],
  ['Panther chameleon', 'reptil', 'insetivoro', ['floresta'], [AF], 0.15],
  ['Green iguana', 'reptil', 'herbivoro', ['floresta'], [AM], 5],
  // anfíbios
  ['Golden poison frog', 'anfibio', 'insetivoro', ['floresta'], [AM], 0.03],
  ['Axolotl', 'anfibio', 'carnivoro', ['rio'], [AM], 0.1],
  ['Fire salamander', 'anfibio', 'carnivoro', ['floresta'], [EU], 0.04],
  // peixes
  ['Great white shark', 'peixe', 'carnivoro', ['oceano'], MUNDO, 1100],
  ['Whale shark', 'peixe', 'carnivoro', ['oceano'], [AF, AM, AS, OC], 19000],
  ['Ocellaris clownfish', 'peixe', 'onivoro', ['oceano'], [AS, OC], 0.025],
  ['Red-bellied piranha', 'peixe', 'carnivoro', ['rio'], [AM], 1],
  ['Arapaima', 'peixe', 'carnivoro', ['rio'], [AM], 200],
  ['Atlantic salmon', 'peixe', 'carnivoro', ['rio', 'oceano'], [AM, EU], 5],
  // insetos, aracnídeos, crustáceos e moluscos
  ['Monarch butterfly', 'inseto', 'herbivoro', ['campo'], [AM], 0.0005],
  ['Western honey bee', 'inseto', 'herbivoro', ['campo', 'floresta'], [AF, EU, AS], 0.0001],
  ['Coccinella septempunctata', 'inseto', 'carnivoro', ['campo'], [EU, AS, AF], 0.00003],
  ['European mantis', 'inseto', 'carnivoro', ['campo'], [EU, AS, AF], 0.003],
  ['Goliath birdeater', 'aracnideo', 'carnivoro', ['floresta'], [AM], 0.17],
  ['American lobster', 'crustaceo', 'onivoro', ['oceano'], [AM], 1],
  ['Atlantic blue crab', 'crustaceo', 'onivoro', ['oceano', 'rio'], [AM], 0.4],
  ['Common octopus', 'molusco', 'carnivoro', ['oceano'], [EU, AF, AS, AM], 5],
  ['Giant squid', 'molusco', 'carnivoro', ['oceano'], MUNDO, 275],
];

const CLASSES = new Set(['mamifero', 'ave', 'reptil', 'anfibio', 'peixe', 'inseto', 'aracnideo', 'crustaceo', 'molusco']);
const DIETAS = new Set(['carnivoro', 'herbivoro', 'onivoro', 'insetivoro']);
const HABITATS = new Set(['floresta', 'savana', 'campo', 'deserto', 'montanha', 'gelo', 'oceano', 'rio', 'pantano']);
const CONTINENTES = new Set([AF, AM, AS, EU, OC, AN]);
for (const [titulo, classe, dieta, habitats, continentes, kg] of ANIMAIS) {
  if (!CLASSES.has(classe) || !DIETAS.has(dieta) || !(kg > 0)) throw new Error(titulo);
  for (const h of habitats) if (!HABITATS.has(h)) throw new Error(`${titulo}: ${h}`);
  for (const c of continentes) if (!CONTINENTES.has(c)) throw new Error(`${titulo}: ${c}`);
}

/**
 * O NOME COMUM. Em muitas línguas o rótulo do Wikidata de uma espécie é o nome científico ("Acinonyx jubatus"): aí vale o "nome
 * comum do táxon" (P1843) daquela língua, se houver. Os que nem assim têm nome comum em português do Brasil vão à mão.
 */
const BINOMIO = /^\p{Lu}\p{Ll}+( \p{Ll}+){1,2}$/u;
const A_MAO = {
  Q23907: 'Guepardo',
  Q178089: 'Hiena-malhada',
  Q245305: 'Zebra-da-planície',
  Q185385: 'Lêmure-de-cauda-anelada',
  Q104831614: 'Canguru-vermelho',
  Q39624: 'Rena',
  Q127216: 'Águia-careca',
  Q161829: 'Pinguim-imperador',
  Q179863: 'Flamingo-comum',
  Q963997: 'Rã-dourada-venenosa',
  Q22718: 'Axolote',
  Q1126155: 'Peixe-palhaço',
  Q212398: 'Borboleta-monarca',
  Q30034: 'Abelha-europeia',
  Q159543: 'Joaninha-de-sete-pintas',
  Q268319: 'Louva-a-deus',
  Q37668: 'Lagosta-americana',
  Q651361: 'Polvo-comum',
  Q13537131: 'Lula-gigante',
  Q36611: 'Gorila',
};
// o inglês é a reserva de quem não tem nome na própria língua: também nunca o científico
const EM_INGLES = { Q104831614: 'Red kangaroo', Q30034: 'Western honey bee', Q43642: 'Kiwi' };
function nomeComum(e) {
  const nome = nomesDe(e);
  const cientifico = e.claims.P225?.[0]?.mainsnak.datavalue?.value;
  const comuns = (e.claims.P1843 ?? []).map((c) => c.mainsnak.datavalue?.value).filter(Boolean);
  for (const [idioma, n] of Object.entries(nome)) {
    if (n !== cientifico && !(idioma !== 'en' && BINOMIO.test(n) && n === nome.en)) continue;
    const codigos = codigosNoWikidata(idioma);
    const comum = comuns.find((c) => codigos.includes(c.language));
    if (comum) nome[idioma] = comum.text.charAt(0).toUpperCase() + comum.text.slice(1);
  }
  if (A_MAO[e.id]) nome['pt-BR'] = A_MAO[e.id];
  if (EM_INGLES[e.id]) nome.en = EM_INGLES[e.id];
  return nome;
}

const qids = await qidsDaWikipedia(ANIMAIS.map((a) => a[0]));
const es = await entidades([...new Set(qids.values())]);
const itens = ANIMAIS.map(([titulo, classe, dieta, habitat, continentes, peso]) => {
  const e = es.get(qids.get(titulo));
  return { id: e.id, nome: nomeComum(e), classe, dieta, habitat, continentes, peso, sobre: e.descriptions.en?.value ?? '' };
});
if (new Set(itens.map((i) => i.id)).size !== itens.length) throw new Error('dois artigos deram no mesmo item');
// "sobre" só serve para conferir à mão que o artigo é o certo; não vai para o jogo.
for (const a of itens) console.log(`${a.id.padEnd(10)} ${a.nome.en.padEnd(26)} ${(a.nome['pt-BR'] ?? '—').padEnd(28)} ${a.nome.ja ?? '—'} | ${a.sobre}`);
writeFileSync(SAIDA, jsonDoQuiz(itens.map(({ sobre, ...resto }) => resto)));
console.log(`${itens.length} animais em ${SAIDA.pathname}`);
