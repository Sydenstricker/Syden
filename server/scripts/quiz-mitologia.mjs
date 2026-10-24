// AS FIGURAS DA MITOLOGIA DO QUIZ. A lista e as colunas são NOSSAS (escritas para o Syden, como as palavras do desenha e
// adivinha): mitologias e figuras são domínio público, e o que cada uma governa é fato de manual, não obra de ninguém.
// Os NOMES em cada idioma vêm do Wikidata (CC0: copia-se sem pedir nem creditar), pelo artigo da Wikipédia em inglês de
// cada figura: "Zeus" vira Ζεύς no grego, ゼウス no japonês, e "Shango" vira Xangô no português.
//
// As colunas (server/src/minijogo-quiz.ts):
// - mitologia: "grega europa" — o primeiro termo é a mitologia, o segundo o continente. A coluna é de PARTES: a mesma
//   mitologia é verde, outra do mesmo continente é amarelo.
// - tipo: divindade, heroi (herói ou heroína) ou criatura.
// - forma: humana, hibrida (cabeça ou corpo de bicho: Anúbis, Ganesha, a sereia) ou animal.
// - dominios: o que a figura governa ou representa, de uma lista fixa (DOMINIOS), de 1 a 3.
//
// O navegador de quem joga nunca fala com o Wikidata: a lista sai daqui para server/assets/quiz/.
//
//   node server/scripts/quiz-mitologia.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SAIDA = new URL('../assets/quiz/mitologia.json', import.meta.url);

const DOMINIOS = new Set([
  'ceu', 'trovao', 'agua', 'vento', 'terra', 'sol', 'lua', 'fogo', 'submundo', 'morte', 'guerra', 'forca', 'sabedoria',
  'magia', 'trapaca', 'amor', 'familia', 'fertilidade', 'colheita', 'caca', 'animais', 'cura', 'artes', 'oficios', 'viagem',
  'justica', 'protecao', 'festa', 'riqueza', 'criacao', 'tempo', 'caos',
]);

// [artigo da Wikipédia em inglês, mitologia, tipo, forma, domínios]
const FIGURAS = [
  // Grega
  ['Zeus', 'grega europa', 'divindade', 'humana', ['ceu', 'trovao', 'justica']],
  ['Hera', 'grega europa', 'divindade', 'humana', ['familia']],
  ['Poseidon', 'grega europa', 'divindade', 'humana', ['agua']],
  ['Hades', 'grega europa', 'divindade', 'humana', ['submundo', 'riqueza']],
  ['Athena', 'grega europa', 'divindade', 'humana', ['sabedoria', 'guerra', 'oficios']],
  ['Apollo', 'grega europa', 'divindade', 'humana', ['sol', 'artes', 'cura']],
  ['Artemis', 'grega europa', 'divindade', 'humana', ['caca', 'lua', 'animais']],
  ['Ares', 'grega europa', 'divindade', 'humana', ['guerra']],
  ['Aphrodite', 'grega europa', 'divindade', 'humana', ['amor']],
  ['Hermes', 'grega europa', 'divindade', 'humana', ['viagem', 'trapaca']],
  ['Hephaestus', 'grega europa', 'divindade', 'humana', ['fogo', 'oficios']],
  ['Dionysus', 'grega europa', 'divindade', 'humana', ['festa', 'fertilidade']],
  ['Demeter', 'grega europa', 'divindade', 'humana', ['colheita']],
  ['Persephone', 'grega europa', 'divindade', 'humana', ['submundo', 'colheita']],
  ['Hestia', 'grega europa', 'divindade', 'humana', ['familia', 'fogo']],
  ['Gaia', 'grega europa', 'divindade', 'humana', ['terra', 'criacao']],
  ['Cronus', 'grega europa', 'divindade', 'humana', ['tempo', 'colheita']],
  ['Prometheus', 'grega europa', 'divindade', 'humana', ['fogo', 'trapaca']],
  ['Heracles', 'grega europa', 'heroi', 'humana', ['forca']],
  ['Achilles', 'grega europa', 'heroi', 'humana', ['guerra']],
  ['Perseus', 'grega europa', 'heroi', 'humana', ['guerra', 'viagem']],
  ['Odysseus', 'grega europa', 'heroi', 'humana', ['viagem', 'trapaca']],
  ['Medusa', 'grega europa', 'criatura', 'hibrida', ['magia', 'morte']],
  ['Minotaur', 'grega europa', 'criatura', 'hibrida', ['forca']],
  ['Pegasus', 'grega europa', 'criatura', 'animal', ['ceu', 'viagem']],
  ['Cerberus', 'grega europa', 'criatura', 'animal', ['submundo', 'protecao']],
  ['Lernaean Hydra', 'grega europa', 'criatura', 'animal', ['agua', 'morte']],
  // Nórdica
  ['Odin', 'nordica europa', 'divindade', 'humana', ['sabedoria', 'guerra', 'magia']],
  ['Thor', 'nordica europa', 'divindade', 'humana', ['trovao', 'forca', 'protecao']],
  ['Loki', 'nordica europa', 'divindade', 'humana', ['trapaca', 'magia', 'caos']],
  ['Freyja', 'nordica europa', 'divindade', 'humana', ['amor', 'fertilidade', 'magia']],
  ['Frigg', 'nordica europa', 'divindade', 'humana', ['familia', 'sabedoria']],
  ['Baldr', 'nordica europa', 'divindade', 'humana', ['sol']],
  ['Týr', 'nordica europa', 'divindade', 'humana', ['guerra', 'justica']],
  ['Heimdall', 'nordica europa', 'divindade', 'humana', ['protecao']],
  ['Hel (mythological being)', 'nordica europa', 'divindade', 'humana', ['submundo', 'morte']],
  ['Freyr', 'nordica europa', 'divindade', 'humana', ['fertilidade', 'colheita', 'sol']],
  ['Njörðr', 'nordica europa', 'divindade', 'humana', ['agua', 'vento', 'riqueza']],
  ['Fenrir', 'nordica europa', 'criatura', 'animal', ['forca', 'caos']],
  ['Jörmungandr', 'nordica europa', 'criatura', 'animal', ['agua', 'caos']],
  ['Sleipnir', 'nordica europa', 'criatura', 'animal', ['viagem']],
  ['Sigurd', 'nordica europa', 'heroi', 'humana', ['guerra']],
  // Celta
  ['The Dagda', 'celta europa', 'divindade', 'humana', ['sabedoria', 'colheita', 'fertilidade']],
  ['Brigid', 'celta europa', 'divindade', 'humana', ['fogo', 'cura', 'artes']],
  ['Lugh', 'celta europa', 'divindade', 'humana', ['oficios', 'artes', 'guerra']],
  ['The Morrígan', 'celta europa', 'divindade', 'humana', ['guerra', 'morte', 'magia']],
  ['Cernunnos', 'celta europa', 'divindade', 'hibrida', ['animais', 'fertilidade']],
  ['Cú Chulainn', 'celta europa', 'heroi', 'humana', ['guerra']],
  // Egípcia
  ['Ra', 'egipcia africa', 'divindade', 'hibrida', ['sol', 'ceu', 'criacao']],
  ['Osiris', 'egipcia africa', 'divindade', 'humana', ['submundo', 'colheita']],
  ['Isis', 'egipcia africa', 'divindade', 'humana', ['magia', 'cura', 'familia']],
  ['Horus', 'egipcia africa', 'divindade', 'hibrida', ['ceu', 'protecao']],
  ['Anubis', 'egipcia africa', 'divindade', 'hibrida', ['morte', 'submundo']],
  ['Set (deity)', 'egipcia africa', 'divindade', 'hibrida', ['caos', 'trovao', 'guerra']],
  ['Thoth', 'egipcia africa', 'divindade', 'hibrida', ['sabedoria', 'magia', 'lua']],
  ['Bastet', 'egipcia africa', 'divindade', 'hibrida', ['protecao', 'familia', 'animais']],
  ['Sekhmet', 'egipcia africa', 'divindade', 'hibrida', ['guerra', 'cura']],
  ['Hathor', 'egipcia africa', 'divindade', 'humana', ['amor', 'festa', 'artes']],
  ['Ptah', 'egipcia africa', 'divindade', 'humana', ['oficios', 'criacao']],
  ['Sobek', 'egipcia africa', 'divindade', 'hibrida', ['agua', 'forca']],
  ['Maat', 'egipcia africa', 'divindade', 'humana', ['justica']],
  ['Apep', 'egipcia africa', 'criatura', 'animal', ['caos']],
  // Iorubá (os orixás, que vieram para o Brasil com o candomblé e a umbanda)
  ['Ogun', 'ioruba africa', 'divindade', 'humana', ['guerra', 'oficios']],
  ['Shango', 'ioruba africa', 'divindade', 'humana', ['trovao', 'justica', 'fogo']],
  ['Yemọja', 'ioruba africa', 'divindade', 'humana', ['agua', 'familia']],
  ['Oshun', 'ioruba africa', 'divindade', 'humana', ['amor', 'agua', 'fertilidade']],
  ['Ọṣọọsi', 'ioruba africa', 'divindade', 'humana', ['caca']],
  ['Oya', 'ioruba africa', 'divindade', 'humana', ['vento', 'trovao', 'morte']],
  ['Eshu', 'ioruba africa', 'divindade', 'humana', ['viagem', 'trapaca']],
  ['Babalú-Ayé', 'ioruba africa', 'divindade', 'humana', ['cura']],
  ['Obatala', 'ioruba africa', 'divindade', 'humana', ['criacao', 'sabedoria']],
  ['Orunmila', 'ioruba africa', 'divindade', 'humana', ['sabedoria']],
  // Hindu
  ['Brahma', 'hindu asia', 'divindade', 'humana', ['criacao']],
  ['Vishnu', 'hindu asia', 'divindade', 'humana', ['protecao']],
  ['Shiva', 'hindu asia', 'divindade', 'humana', ['caos', 'artes']],
  ['Ganesha', 'hindu asia', 'divindade', 'hibrida', ['sabedoria']],
  ['Lakshmi', 'hindu asia', 'divindade', 'humana', ['riqueza']],
  ['Saraswati', 'hindu asia', 'divindade', 'humana', ['sabedoria', 'artes']],
  ['Durga', 'hindu asia', 'divindade', 'humana', ['guerra', 'protecao']],
  ['Kali', 'hindu asia', 'divindade', 'humana', ['morte', 'tempo']],
  ['Hanuman', 'hindu asia', 'divindade', 'hibrida', ['forca']],
  ['Agni', 'hindu asia', 'divindade', 'humana', ['fogo']],
  ['Indra', 'hindu asia', 'divindade', 'humana', ['trovao', 'ceu', 'guerra']],
  ['Yama', 'hindu asia', 'divindade', 'humana', ['morte', 'submundo', 'justica']],
  ['Krishna', 'hindu asia', 'divindade', 'humana', ['amor', 'artes']],
  // Japonesa
  ['Amaterasu', 'japonesa asia', 'divindade', 'humana', ['sol']],
  ['Susanoo-no-Mikoto', 'japonesa asia', 'divindade', 'humana', ['agua', 'trovao']],
  ['Tsukuyomi-no-Mikoto', 'japonesa asia', 'divindade', 'humana', ['lua']],
  ['Raijin', 'japonesa asia', 'divindade', 'humana', ['trovao']],
  ['Fūjin', 'japonesa asia', 'divindade', 'humana', ['vento']],
  ['Inari Ōkami', 'japonesa asia', 'divindade', 'humana', ['colheita', 'riqueza', 'animais']],
  ['Izanagi', 'japonesa asia', 'divindade', 'humana', ['criacao']],
  ['Izanami', 'japonesa asia', 'divindade', 'humana', ['criacao', 'morte']],
  ['Hachiman', 'japonesa asia', 'divindade', 'humana', ['guerra']],
  ['Kitsune', 'japonesa asia', 'criatura', 'animal', ['magia', 'trapaca']],
  ['Kappa (folklore)', 'japonesa asia', 'criatura', 'hibrida', ['agua']],
  // Chinesa
  ['Jade Emperor', 'chinesa asia', 'divindade', 'humana', ['ceu', 'justica']],
  ["Chang'e", 'chinesa asia', 'divindade', 'humana', ['lua']],
  ['Nüwa', 'chinesa asia', 'divindade', 'hibrida', ['criacao']],
  ['Pangu', 'chinesa asia', 'divindade', 'humana', ['criacao']],
  ['Sun Wukong', 'chinesa asia', 'heroi', 'animal', ['forca', 'trapaca', 'magia']],
  ['Guan Yu', 'chinesa asia', 'heroi', 'humana', ['guerra']],
  ['Chinese dragon', 'chinesa asia', 'criatura', 'animal', ['agua', 'ceu']],
  // Mesopotâmica
  ['Inanna', 'mesopotamica asia', 'divindade', 'humana', ['amor', 'guerra', 'fertilidade']],
  ['Enki', 'mesopotamica asia', 'divindade', 'humana', ['agua', 'sabedoria', 'magia']],
  ['Marduk', 'mesopotamica asia', 'divindade', 'humana', ['justica']],
  ['Enlil', 'mesopotamica asia', 'divindade', 'humana', ['vento', 'ceu']],
  ['Ereshkigal', 'mesopotamica asia', 'divindade', 'humana', ['submundo', 'morte']],
  ['Tiamat', 'mesopotamica asia', 'divindade', 'animal', ['agua', 'caos']],
  ['Gilgamesh', 'mesopotamica asia', 'heroi', 'humana', ['forca', 'viagem']],
  // Asteca
  ['Quetzalcoatl', 'asteca americas', 'divindade', 'animal', ['vento', 'sabedoria', 'criacao']],
  ['Huitzilopochtli', 'asteca americas', 'divindade', 'humana', ['sol', 'guerra']],
  ['Tlaloc', 'asteca americas', 'divindade', 'humana', ['agua', 'trovao', 'fertilidade']],
  ['Tezcatlipoca', 'asteca americas', 'divindade', 'humana', ['magia', 'trapaca']],
  ['Xipe Totec', 'asteca americas', 'divindade', 'humana', ['colheita', 'fertilidade']],
  ['Mictlantecuhtli', 'asteca americas', 'divindade', 'humana', ['morte', 'submundo']],
  ['Coatlicue', 'asteca americas', 'divindade', 'hibrida', ['terra', 'fertilidade']],
  // Brasileira (tupi-guarani e o folclore). A Cuca ficou de fora: o artigo dela leva ao "Coco" ibérico, e o nome em
  // português sairia "Coca".
  ['Tupã (mythology)', 'brasileira americas', 'divindade', 'humana', ['trovao', 'ceu', 'criacao']],
  ['Saci (Brazilian folklore)', 'brasileira americas', 'criatura', 'humana', ['trapaca', 'vento']],
  ['Curupira', 'brasileira americas', 'criatura', 'humana', ['protecao', 'animais']],
  ['Iara (mythology)', 'brasileira americas', 'criatura', 'hibrida', ['agua', 'amor']],
  ['Boitatá', 'brasileira americas', 'criatura', 'animal', ['fogo', 'protecao']],
  ['Mapinguari', 'brasileira americas', 'criatura', 'animal', ['forca']],
  ['Headless Mule', 'brasileira americas', 'criatura', 'animal', ['fogo']],
];

// Os idiomas do Syden (web/src/i18n/idiomas.ts) e o código de cada um no Wikidata.
const fonte = readFileSync(new URL('../../web/src/i18n/idiomas.ts', import.meta.url), 'utf8');
const IDIOMAS = [...fonte.matchAll(/codigo: '([^']+)'/g)].map((m) => m[1]);
// O "mul" só vale para as línguas de escrita latina: em grego ou japonês, "Vishnu" em letra latina seria pior que a reserva.
const ESCRITA = Object.fromEntries([...fonte.matchAll(/codigo: '([^']+)'[^}]*?escrita: '([^']+)'/g)].map((m) => [m[1], m[2]]));
const NO_WIKIDATA = { 'pt-BR': ['pt-br', 'pt'], 'zh-CN': ['zh-hans', 'zh-cn', 'zh'], no: ['nb', 'no'], cnr: ['sh', 'sr-el', 'hr'], tet: ['tet'] };

const AGENTE = { headers: { 'user-agent': 'Syden (syden.chat) quiz-mitologia' } };
/** Pede e lê o JSON; se a API pedir calma ("too many requests"), espera e tenta de novo. */
async function pedir(url) {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(url, AGENTE);
    const texto = await r.text();
    if (r.ok && texto.startsWith('{')) return JSON.parse(texto);
    if (tentativa >= 6) throw new Error(`${r.status}: ${texto.slice(0, 120)}`);
    await new Promise((pronto) => setTimeout(pronto, 15_000 * tentativa));
  }
}
const itens = [];
for (let i = 0; i < FIGURAS.length; i += 40) {
  const lote = FIGURAS.slice(i, i + 40);
  // 1) O artigo da Wikipédia (seguindo os redirecionamentos) diz qual é o item do Wikidata.
  const wp = await pedir(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(lote.map((f) => f[0]).join('|'))}`,
  );
  const destino = new Map(lote.map((f) => [f[0], f[0]]));
  for (const { from, to } of [...(wp.query.normalized ?? []), ...(wp.query.redirects ?? [])]) {
    for (const [titulo, atual] of destino) if (atual === from) destino.set(titulo, to);
  }
  const qid = new Map(Object.values(wp.query.pages).map((p) => [p.title, p.pageprops?.wikibase_item]));
  // 2) O Wikidata dá o nome em cada língua.
  const ids = lote.map((f) => qid.get(destino.get(f[0])));
  const faltando = lote.filter((_, j) => !ids[j]).map((f) => f[0]);
  if (faltando.length) throw new Error(`a Wikipédia não achou: ${faltando.join(', ')}`);
  const { entities } = await pedir(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions&ids=${ids.join('|')}`);
  lote.forEach(([titulo, mitologia, tipo, forma, dominios], j) => {
    for (const d of dominios) if (!DOMINIOS.has(d)) throw new Error(`domínio desconhecido: ${d} (${titulo})`);
    const e = entities[ids[j]];
    const nome = {};
    for (const idioma of IDIOMAS) {
      for (const codigo of NO_WIKIDATA[idioma] ?? [idioma.toLowerCase()]) {
        if (e.labels[codigo]) {
          nome[idioma] = e.labels[codigo].value;
          break;
        }
      }
    }
    // O Wikidata guarda o nome que é igual em quase toda língua uma vez só, como "mul" (multilíngue): é a reserva.
    for (const idioma of IDIOMAS) if (!nome[idioma] && e.labels.mul && /^(latina)$/.test(ESCRITA[idioma] ?? '')) nome[idioma] = e.labels.mul.value;
    nome.en ??= e.labels.mul?.value;
    // "kitsune", "mapinguari": o Wikidata escreve o nome comum em minúscula, e na lista ele é nome próprio.
    for (const [idioma, texto] of Object.entries(nome)) nome[idioma] = texto.charAt(0).toLocaleUpperCase(idioma) + texto.slice(1);
    if (!nome.en) throw new Error(`sem nome em inglês: ${titulo}`);
    // O id é o do Wikidata: estável, e não muda quando a Wikipédia renomeia o artigo.
    itens.push({ id: e.id, nome, mitologia, tipo, forma, dominios, sobre: e.descriptions.en?.value ?? '' });
  });
}
// "sobre" (a descrição do Wikidata) só serve para conferir à mão que o artigo é o certo; não vai para o jogo.
for (const item of itens) console.log(`${item.id.padEnd(9)} ${item.nome.en.padEnd(24)} ${item.nome['pt-BR'] ?? '—'} | ${item.sobre}`);
writeFileSync(SAIDA, `${JSON.stringify(itens.map(({ sobre, ...resto }) => resto)).replace(/\},\{"id"/g, '},\n{"id"')}\n`);
console.log(`${itens.length} figuras em ${SAIDA.pathname}`);
