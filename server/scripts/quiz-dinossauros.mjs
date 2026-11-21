// OS DINOSSAUROS DO QUIZ (21/11/2026, o lote D da segunda auditoria dos mini-games). A lista e as colunas são NOSSAS (escritas
// para o Syden): gêneros conhecidos, com o que os livros de divulgação dizem de cada um — é fato de paleontologia, não obra de
// ninguém. Só DINOSSAUROS: os pterossauros e os répteis marinhos, que muita gente chama de dinossauro, não são. Os NOMES em cada
// idioma vêm do Wikidata (CC0), pelo artigo da Wikipédia em inglês de cada gênero.
//
// As colunas (server/src/minijogo-quiz.ts, o tema "dinossauros"):
// - periodo: 1 Triássico, 2 Jurássico, 3 Cretáceo (de ORDEM: a seta diz se o secreto é mais antigo ou mais novo).
// - dieta: carnivoro, herbivoro ou onivoro.
// - grupo: teropode, sauropode, prossauropode, ornitopode, ceratopsiano, estegossauro, anquilossauro, paquicefalossauro.
// - comprimento: em metros, a estimativa comum para o adulto (as fontes variam; vale a ordem de grandeza).
// - continentes: onde os fósseis foram achados (america-do-norte, america-do-sul, europa, africa, asia, oceania, antartida).
// Os RAROS ficam só para chutar: saem os que alguém já viu num livro ou num filme.
//
//   node server/scripts/quiz-dinossauros.mjs
import { writeFileSync } from 'node:fs';
import { entidades, jsonDoQuiz, nomesDe, qidsDaWikipedia } from './quiz-wikidata.mjs';

const SAIDA = new URL('../assets/quiz/dinossauros.json', import.meta.url);
const AN = 'america-do-norte';
const AS = 'america-do-sul';

// [artigo da Wikipédia em inglês, período, dieta, grupo, comprimento (m), continentes, raro?]
const DINOSSAUROS = [
  ['Tyrannosaurus', 3, 'carnivoro', 'teropode', 12, [AN]],
  ['Triceratops', 3, 'herbivoro', 'ceratopsiano', 9, [AN]],
  ['Velociraptor', 3, 'carnivoro', 'teropode', 2, ['asia']],
  ['Stegosaurus', 2, 'herbivoro', 'estegossauro', 9, [AN, 'europa']],
  ['Brachiosaurus', 2, 'herbivoro', 'sauropode', 22, [AN]],
  ['Diplodocus', 2, 'herbivoro', 'sauropode', 26, [AN]],
  ['Apatosaurus', 2, 'herbivoro', 'sauropode', 22, [AN]],
  ['Brontosaurus', 2, 'herbivoro', 'sauropode', 22, [AN]],
  ['Allosaurus', 2, 'carnivoro', 'teropode', 9.5, [AN, 'europa']],
  ['Spinosaurus', 3, 'carnivoro', 'teropode', 15, ['africa']],
  ['Ankylosaurus', 3, 'herbivoro', 'anquilossauro', 7, [AN]],
  ['Parasaurolophus', 3, 'herbivoro', 'ornitopode', 9.5, [AN]],
  ['Iguanodon', 3, 'herbivoro', 'ornitopode', 10, ['europa']],
  ['Pachycephalosaurus', 3, 'herbivoro', 'paquicefalossauro', 4.5, [AN]],
  ['Carnotaurus', 3, 'carnivoro', 'teropode', 8, [AS]],
  ['Giganotosaurus', 3, 'carnivoro', 'teropode', 12.5, [AS]],
  ['Argentinosaurus', 3, 'herbivoro', 'sauropode', 35, [AS]],
  ['Patagotitan', 3, 'herbivoro', 'sauropode', 37, [AS]],
  ['Oviraptor', 3, 'onivoro', 'teropode', 1.6, ['asia']],
  ['Gallimimus', 3, 'onivoro', 'teropode', 6, ['asia']],
  ['Deinonychus', 3, 'carnivoro', 'teropode', 3.4, [AN]],
  ['Dilophosaurus', 2, 'carnivoro', 'teropode', 7, [AN]],
  ['Coelophysis', 1, 'carnivoro', 'teropode', 3, [AN]],
  ['Herrerasaurus', 1, 'carnivoro', 'teropode', 4.5, [AS]],
  ['Plateosaurus', 1, 'herbivoro', 'prossauropode', 8, ['europa']],
  ['Staurikosaurus', 1, 'carnivoro', 'teropode', 2, [AS], true],
  ['Irritator', 3, 'carnivoro', 'teropode', 7, [AS], true],
  ['Mamenchisaurus', 2, 'herbivoro', 'sauropode', 26, ['asia']],
  ['Therizinosaurus', 3, 'herbivoro', 'teropode', 10, ['asia']],
  ['Baryonyx', 3, 'carnivoro', 'teropode', 9, ['europa']],
  ['Compsognathus', 2, 'carnivoro', 'teropode', 1, ['europa']],
  ['Microraptor', 3, 'carnivoro', 'teropode', 0.8, ['asia']],
  ['Archaeopteryx', 2, 'carnivoro', 'teropode', 0.5, ['europa']],
  ['Utahraptor', 3, 'carnivoro', 'teropode', 6, [AN]],
  ['Albertosaurus', 3, 'carnivoro', 'teropode', 9, [AN]],
  ['Carcharodontosaurus', 3, 'carnivoro', 'teropode', 12, ['africa']],
  ['Protoceratops', 3, 'herbivoro', 'ceratopsiano', 2, ['asia']],
  ['Styracosaurus', 3, 'herbivoro', 'ceratopsiano', 5.5, [AN]],
  ['Edmontosaurus', 3, 'herbivoro', 'ornitopode', 12, [AN]],
  ['Maiasaura', 3, 'herbivoro', 'ornitopode', 9, [AN]],
  ['Kentrosaurus', 2, 'herbivoro', 'estegossauro', 4.5, ['africa']],
  ['Euoplocephalus', 3, 'herbivoro', 'anquilossauro', 5.5, [AN]],
  ['Nodosaurus', 3, 'herbivoro', 'anquilossauro', 5, [AN], true],
  ['Camarasaurus', 2, 'herbivoro', 'sauropode', 18, [AN]],
  ['Dreadnoughtus', 3, 'herbivoro', 'sauropode', 26, [AS]],
  ['Amargasaurus', 3, 'herbivoro', 'sauropode', 10, [AS]],
  ['Ceratosaurus', 2, 'carnivoro', 'teropode', 6, [AN, 'europa']],
  ['Megalosaurus', 2, 'carnivoro', 'teropode', 6, ['europa']],
  ['Torosaurus', 3, 'herbivoro', 'ceratopsiano', 8, [AN], true],
  ['Psittacosaurus', 3, 'herbivoro', 'ceratopsiano', 2, ['asia']],
  ['Hypsilophodon', 3, 'herbivoro', 'ornitopode', 1.8, ['europa'], true],
  ['Troodon', 3, 'onivoro', 'teropode', 2.4, [AN]],
  ['Struthiomimus', 3, 'onivoro', 'teropode', 4.3, [AN], true],
  ['Corythosaurus', 3, 'herbivoro', 'ornitopode', 9, [AN], true],
  ['Lambeosaurus', 3, 'herbivoro', 'ornitopode', 9, [AN], true],
  ['Muttaburrasaurus', 3, 'herbivoro', 'ornitopode', 8, ['oceania'], true],
  ['Australovenator', 3, 'carnivoro', 'teropode', 6, ['oceania'], true],
  ['Cryolophosaurus', 2, 'carnivoro', 'teropode', 6.5, ['antartida']],
  ['Leaellynasaura', 3, 'herbivoro', 'ornitopode', 1, ['oceania'], true],
  ['Minmi (dinosaur)', 3, 'herbivoro', 'anquilossauro', 3, ['oceania'], true],
  ['Abelisaurus', 3, 'carnivoro', 'teropode', 8, [AS], true],
  ['Pycnonemosaurus', 3, 'carnivoro', 'teropode', 9, [AS], true],
  ['Tarbosaurus', 3, 'carnivoro', 'teropode', 10, ['asia']],
  ['Yutyrannus', 3, 'carnivoro', 'teropode', 9, ['asia'], true],
  ['Sinosauropteryx', 3, 'carnivoro', 'teropode', 1, ['asia'], true],
  ['Ouranosaurus', 3, 'herbivoro', 'ornitopode', 8, ['africa'], true],
  ['Suchomimus', 3, 'carnivoro', 'teropode', 10, ['africa']],
  ['Giraffatitan', 2, 'herbivoro', 'sauropode', 22, ['africa']],
  ['Mapusaurus', 3, 'carnivoro', 'teropode', 11, [AS], true],
  ['Saltasaurus', 3, 'herbivoro', 'sauropode', 12, [AS], true],
  ['Europasaurus', 2, 'herbivoro', 'sauropode', 6, ['europa'], true],
  ['Torvosaurus', 2, 'carnivoro', 'teropode', 10, [AN, 'europa'], true],
  ['Majungasaurus', 3, 'carnivoro', 'teropode', 7, ['africa']],
];

const GRUPOS = new Set(['teropode', 'sauropode', 'prossauropode', 'ornitopode', 'ceratopsiano', 'estegossauro', 'anquilossauro', 'paquicefalossauro']);
const CONTINENTES = new Set([AN, AS, 'europa', 'africa', 'asia', 'oceania', 'antartida']);
for (const [titulo, periodo, dieta, grupo, m, continentes] of DINOSSAUROS) {
  if (![1, 2, 3].includes(periodo) || !['carnivoro', 'herbivoro', 'onivoro'].includes(dieta) || !GRUPOS.has(grupo) || !(m > 0)) throw new Error(titulo);
  for (const c of continentes) if (!CONTINENTES.has(c)) throw new Error(`${titulo}: ${c}`);
}

const qids = await qidsDaWikipedia(DINOSSAUROS.map((d) => d[0]));
const es = await entidades([...new Set(qids.values())]);
const itens = DINOSSAUROS.map(([titulo, periodo, dieta, grupo, comprimento, continentes, raro]) => {
  const e = es.get(qids.get(titulo));
  // Alguns artigos são da ESPÉCIE ("Australovenator wintonensis"): na lista vale o gênero, a primeira palavra.
  const nome = Object.fromEntries(Object.entries(nomesDe(e)).map(([idioma, n]) => [idioma, /^\p{Lu}\p{Ll}+ \p{Ll}+$/u.test(n) ? n.split(' ')[0] : n]));
  return { id: e.id, nome, periodo, dieta, grupo, comprimento, continentes, ...(raro ? { raro: true } : {}), sobre: e.descriptions.en?.value ?? '' };
});
if (new Set(itens.map((i) => i.id)).size !== itens.length) throw new Error('dois artigos deram no mesmo item');
// "sobre" só serve para conferir à mão que o artigo é o certo; não vai para o jogo.
for (const d of itens) console.log(`${d.id.padEnd(10)} ${d.nome.en.padEnd(20)} ${(d.nome['pt-BR'] ?? '—').padEnd(20)} ${d.nome.ja ?? '—'} | ${d.sobre}`);
writeFileSync(SAIDA, jsonDoQuiz(itens.map(({ sobre, ...resto }) => resto)));
console.log(`${itens.length} dinossauros em ${SAIDA.pathname}`);
