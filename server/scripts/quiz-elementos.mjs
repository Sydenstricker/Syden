// OS ELEMENTOS QUÍMICOS DO QUIZ (21/11/2026, o lote D da segunda auditoria dos mini-games). A tabela periódica é fato, não obra
// de ninguém: o número, o período, o grupo, a família e o estado de cada um são escritos aqui, à mão, pela tabela da IUPAC. Os
// NOMES em cada idioma vêm do Wikidata (CC0), achados pelo número atômico (P1086).
//
// As colunas (server/src/minijogo-quiz.ts, o tema "elementos"):
// - familia: metal-alcalino, alcalino-terroso, transicao, pos-transicao, semimetal, nao-metal, halogenio, gas-nobre, lantanideo,
//   actinideo. Os superpesados (do 104 em diante) vão pela coluna da tabela, como as tabelas impressas costumam pôr.
// - estado: solido, liquido ou gas, a 25 °C e pressão normal.
// - periodo (1 a 7) e grupo (1 a 18; os lantanídeos e os actinídeos contam como grupo 3, a casa onde a tabela os pendura).
// - numero: o número atômico (com a seta para mais ou menos).
// O nome que aparece leva o símbolo: "Ferro (Fe)".
//
// O navegador de quem joga nunca fala com o Wikidata: a lista sai daqui para server/assets/quiz/.
//
//   node server/scripts/quiz-elementos.mjs
import { writeFileSync } from 'node:fs';
import { entidades, jsonDoQuiz, nomesDe, pedir } from './quiz-wikidata.mjs';

const SAIDA = new URL('../assets/quiz/elementos.json', import.meta.url);

const SIMBOLOS = `H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo
Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At
Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og`.split(/\s+/);
if (SIMBOLOS.length !== 118) throw new Error(`são 118 símbolos, e há ${SIMBOLOS.length}`);

const conjunto = (texto) => new Set(texto.split(' ').map(Number));
const FAMILIAS = {
  'metal-alcalino': conjunto('3 11 19 37 55 87'),
  'alcalino-terroso': conjunto('4 12 20 38 56 88'),
  'nao-metal': conjunto('1 6 7 8 15 16 34'),
  semimetal: conjunto('5 14 32 33 51 52'),
  halogenio: conjunto('9 17 35 53 85 117'),
  'gas-nobre': conjunto('2 10 18 36 54 86 118'),
  'pos-transicao': conjunto('13 31 49 50 81 82 83 84 113 114 115 116'),
};
const GASES = conjunto('1 2 7 8 9 10 17 18 36 54 86');
const LIQUIDOS = conjunto('35 80');

function familiaDe(z) {
  for (const [familia, zs] of Object.entries(FAMILIAS)) if (zs.has(z)) return familia;
  if (z >= 57 && z <= 71) return 'lantanideo';
  if (z >= 89 && z <= 103) return 'actinideo';
  return 'transicao';
}
const INICIOS = [1, 3, 11, 19, 37, 55, 87, 119];
function periodoDe(z) {
  return INICIOS.findIndex((inicio, i) => z >= inicio && z < INICIOS[i + 1]) + 1;
}
function grupoDe(z) {
  const p = periodoDe(z);
  const i = z - INICIOS[p - 1];
  if (p === 1) return z === 1 ? 1 : 18;
  if (p <= 3) return i < 2 ? i + 1 : i + 11;
  if (p <= 5) return i + 1;
  if (i < 2) return i + 1;
  if (i <= 16) return 3; // do lantânio ao lutécio (e do actínio ao laurêncio)
  return i - 13;
}

// O item de cada número atômico, pela consulta do Wikidata (os elementos químicos, Q11344, com o P1086).
const consulta = 'SELECT ?item ?z WHERE { ?item wdt:P31 wd:Q11344; wdt:P1086 ?z . }';
const r = await pedir(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consulta)}`);
const porNumero = new Map();
for (const linha of r.results.bindings) {
  const z = Number(linha.z.value);
  if (Number.isInteger(z) && z >= 1 && z <= 118 && !porNumero.has(z)) porNumero.set(z, linha.item.value.split('/').pop());
}
const faltando = SIMBOLOS.map((_, i) => i + 1).filter((z) => !porNumero.has(z));
if (faltando.length) throw new Error(`o Wikidata não deu os números ${faltando.join(', ')}`);
const es = await entidades(SIMBOLOS.map((_, i) => porNumero.get(i + 1)));

const itens = SIMBOLOS.map((simbolo, i) => {
  const z = i + 1;
  const nome = nomesDe(es.get(porNumero.get(z)));
  for (const idioma of Object.keys(nome)) nome[idioma] = `${nome[idioma]} (${simbolo})`;
  return {
    id: simbolo,
    nome,
    familia: familiaDe(z),
    estado: GASES.has(z) ? 'gas' : LIQUIDOS.has(z) ? 'liquido' : 'solido',
    periodo: periodoDe(z),
    grupo: grupoDe(z),
    numero: z,
  };
});
for (const e of itens) console.log(`${String(e.numero).padStart(3)} ${e.nome.en.padEnd(26)} ${(e.nome['pt-BR'] ?? '—').padEnd(26)} ${e.familia} ${e.estado} p${e.periodo} g${e.grupo}`);
writeFileSync(SAIDA, jsonDoQuiz(itens));
console.log(`${itens.length} elementos em ${SAIDA.pathname}`);
