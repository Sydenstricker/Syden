// OS ESTADOS DO BRASIL NO QUIZ (21/11/2026, o lote D da segunda auditoria dos mini-games): as 27 unidades da federação (os 26
// estados e o Distrito Federal), no formato do Worldle. A região, o litoral e a fronteira com outro país são escritos aqui, à
// mão (fato de geografia, do IBGE). Do Wikidata (CC0) vêm o NOME em cada idioma, o ponto do estado (P625), a POPULAÇÃO (P1082,
// a do último censo) e a ÁREA (P2046, em km²).
//
// As colunas (server/src/minijogo-quiz.ts, o tema "estados"):
// - local: [latitude, longitude], para a distância e o rumo até o secreto (como nos países, mas o amarelo é mais perto).
// - regiao: norte, nordeste, centro-oeste, sudeste, sul.
// - populacao e area: de ORDEM.
// - litoral e fronteira: sim ou nao (tem praia? faz fronteira com outro país?).
//
//   node server/scripts/quiz-estados.mjs
import { writeFileSync } from 'node:fs';
import { entidades, jsonDoQuiz, nomesDe, numeroMaisRecente, qidsDaWikipedia } from './quiz-wikidata.mjs';

const SAIDA = new URL('../assets/quiz/estados.json', import.meta.url);

// [sigla, artigo da Wikipédia em inglês, região, litoral, fronteira com outro país]
const ESTADOS = [
  ['AC', 'Acre (state)', 'norte', false, true],
  ['AL', 'Alagoas', 'nordeste', true, false],
  ['AP', 'Amapá', 'norte', true, true],
  ['AM', 'Amazonas (Brazilian state)', 'norte', false, true],
  ['BA', 'Bahia', 'nordeste', true, false],
  ['CE', 'Ceará', 'nordeste', true, false],
  ['DF', 'Federal District (Brazil)', 'centro-oeste', false, false],
  ['ES', 'Espírito Santo', 'sudeste', true, false],
  ['GO', 'Goiás', 'centro-oeste', false, false],
  ['MA', 'Maranhão', 'nordeste', true, false],
  ['MT', 'Mato Grosso', 'centro-oeste', false, true],
  ['MS', 'Mato Grosso do Sul', 'centro-oeste', false, true],
  ['MG', 'Minas Gerais', 'sudeste', false, false],
  ['PA', 'Pará', 'norte', true, true],
  ['PB', 'Paraíba', 'nordeste', true, false],
  ['PR', 'Paraná (state)', 'sul', true, true],
  ['PE', 'Pernambuco', 'nordeste', true, false],
  ['PI', 'Piauí', 'nordeste', true, false],
  ['RJ', 'Rio de Janeiro (state)', 'sudeste', true, false],
  ['RN', 'Rio Grande do Norte', 'nordeste', true, false],
  ['RS', 'Rio Grande do Sul', 'sul', true, true],
  ['RO', 'Rondônia', 'norte', false, true],
  ['RR', 'Roraima', 'norte', false, true],
  ['SC', 'Santa Catarina (state)', 'sul', true, true],
  ['SP', 'São Paulo (state)', 'sudeste', true, false],
  ['SE', 'Sergipe', 'nordeste', true, false],
  ['TO', 'Tocantins', 'norte', false, false],
];

const qids = await qidsDaWikipedia(ESTADOS.map((e) => e[1]));
const es = await entidades([...qids.values()]);
const itens = ESTADOS.map(([sigla, titulo, regiao, litoral, fronteira]) => {
  const e = es.get(qids.get(titulo));
  const ponto = e.claims.P625?.[0]?.mainsnak.datavalue?.value;
  const populacao = numeroMaisRecente(e, 'P1082');
  const area = numeroMaisRecente(e, 'P2046');
  if (!ponto || !populacao || !area) throw new Error(`${sigla}: falta o ponto, a população ou a área no Wikidata`);
  return {
    id: sigla,
    nome: nomesDe(e),
    local: [Math.round(ponto.latitude * 100) / 100, Math.round(ponto.longitude * 100) / 100],
    regiao,
    populacao: Math.round(populacao),
    area: Math.round(area),
    litoral: litoral ? 'sim' : 'nao',
    fronteira: fronteira ? 'sim' : 'nao',
  };
});
for (const u of itens) console.log(`${u.id} ${u.nome['pt-BR'].padEnd(22)} ${(u.nome.ja ?? '—').padEnd(12)} ${u.regiao.padEnd(13)} ${String(u.populacao).padStart(9)} ${String(u.area).padStart(8)} km² ${u.local}`);
writeFileSync(SAIDA, jsonDoQuiz(itens));
console.log(`${itens.length} unidades em ${SAIDA.pathname}`);
