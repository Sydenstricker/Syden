// OS MONSTROS DO QUIZ, tirados do SRD 5.1 do D&D (o System Reference Document que a Wizards of the Coast liberou em
// CC BY 4.0 em 27/01/2023: pode copiar e adaptar, com o crédito exato que vai no leia-me ao lado e na tela do jogo).
// A lista vem já estruturada da 5e-database (github.com/5e-bits/5e-database, MIT), que é o SRD passado a JSON.
//
// Só os FATOS de cada monstro: nome, tipo, tamanho, nível de desafio, alinhamento e como se desloca. Nem texto de
// regra, nem imagem (as imagens da base não são do SRD). O navegador de quem joga nunca fala com o GitHub: a lista
// sai daqui para server/assets/quiz/ e é servida pelo nosso servidor.
//
// Ficam de fora os que não se adivinham: os de alinhamento "qualquer" (o PNJ genérico: acólito, bandido, guarda),
// que mudam de mesa para mesa, e os enxames, que são o bicho pequeno repetido. Três "qualquer" são famosos demais para
// sair, e o alinhamento deles vai escrito à mão (ESPECIAIS): o lich é mau ("qualquer mau"), o fantasma é "qualquer", e o
// gigante das nuvens, "neutro e bom ou neutro e mau", fica neutro.
//
//   node server/scripts/quiz-monstros.mjs
import { writeFileSync } from 'node:fs';

const ENDERECO = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-Monsters.json';
const SAIDA = new URL('../assets/quiz/monstros.json', import.meta.url);
const TAMANHOS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const MODOS = ['walk', 'fly', 'swim', 'climb', 'burrow'];
const ESPECIAIS = { lich: 'evil', ghost: 'any', 'cloud-giant': 'neutral' };

const lista = await (await fetch(ENDERECO)).json();
const itens = [];
for (const m of lista) {
  const alinhamento = ESPECIAIS[m.index] ?? m.alignment;
  if (/^any |\(/.test(alinhamento) || m.type.startsWith('swarm')) continue;
  if (!TAMANHOS.includes(m.size)) throw new Error(`tamanho novo: ${m.size} (${m.name})`);
  const deslocamento = MODOS.filter((modo) => m.speed[modo] && !/^0/.test(m.speed[modo]));
  itens.push({
    id: m.index,
    nome: m.name,
    tipo: m.type,
    tamanho: TAMANHOS.indexOf(m.size),
    nd: m.challenge_rating,
    alinhamento,
    deslocamento,
  });
}
writeFileSync(SAIDA, `${JSON.stringify(itens, null, 0).replace(/\},\{/g, '},\n{')}\n`);
console.log(`${itens.length} monstros em ${SAIDA.pathname}`);
