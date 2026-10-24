// OS PAÍSES DO QUIZ (o Worldle sem anúncio): os 193 membros da ONU — a mesma lista e pelo mesmo motivo de
// web/src/i18n/paises.ts (um conjunto objetivo, e não uma opinião nossa sobre quem é país) — com o que a Natural Earth
// diz de cada um (naturalearthdata.com, DOMÍNIO PÚBLICO): o ponto onde o nome vai no mapa, a sub-região da ONU e a
// população estimada. Os nomes não ficam aqui: saem do Intl.DisplayNames, em qualquer idioma (minijogo-quiz.ts).
//
// O navegador de quem joga nunca fala com a Natural Earth: a lista sai daqui para server/assets/quiz/.
//
//   node server/scripts/quiz-paises.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ENDERECO = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const SAIDA = new URL('../assets/quiz/paises.json', import.meta.url);

// As regiões e os países, lidos do arquivo do site (é TypeScript; basta achar cada bloco de região).
const fonte = readFileSync(new URL('../../web/src/i18n/paises.ts', import.meta.url), 'utf8');
const regiaoDe = new Map();
for (const [, id, lista] of fonte.matchAll(/id: '(\w+)',\s*m49: '\d+',\s*paises: \[([^\]]*)\]/g)) {
  for (const [, pais] of lista.matchAll(/'([A-Z]{2})'/g)) regiaoDe.set(pais, id);
}
if (regiaoDe.size !== 193) throw new Error(`esperava 193 países, achei ${regiaoDe.size}`);

const { features } = await (await fetch(ENDERECO)).json();
const itens = [];
for (const [pais, regiao] of regiaoDe) {
  // ISO_A2_EH é o código "mesmo assim" (França e Noruega vêm com -99 no ISO_A2, por causa dos territórios).
  const candidatos = features.filter((f) => f.properties.ISO_A2_EH === pais || f.properties.ISO_A2 === pais);
  // Mais de um (o país e um território dele com o mesmo código): vale o que não é dependência, o mais populoso.
  const f = candidatos.sort((a, b) => (a.properties.TYPE === 'Dependency') - (b.properties.TYPE === 'Dependency') || b.properties.POP_EST - a.properties.POP_EST)[0];
  if (!f) throw new Error(`a Natural Earth não tem ${pais}`);
  const p = f.properties;
  itens.push({
    id: pais,
    regiao,
    subregiao: p.SUBREGION,
    populacao: Math.round(p.POP_EST),
    local: [Math.round(p.LABEL_Y * 100) / 100, Math.round(p.LABEL_X * 100) / 100],
  });
}
itens.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(SAIDA, `${JSON.stringify(itens).replace(/\},\{/g, '},\n{')}\n`);
console.log(`${itens.length} países em ${SAIDA.pathname}`);
