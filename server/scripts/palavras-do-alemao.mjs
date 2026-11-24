// As palavras que se pode CHUTAR na Palavra secreta em ALEMÃO (server/src/minijogo-palavra.ts), 24/11/2026.
//
// Por que não o corretor, como nas outras línguas: o igerman98/frami do LibreOffice é GPL (ou a licença OASIS, que proíbe
// modificar e só vale para programas de documentos ODF), e não serve a um produto fechado. A fonte é a WORTLISTE do projeto
// Trennmuster (a lista de ~500 mil formas, com as flexões, de onde saem os padrões de hifenização do alemão no TeX), sob a
// licença MIT: https://repo.or.cz/wortliste.git (o arquivo `wortliste`, e o LICENSE.data ao lado).
// O OpenThesaurus (LGPL 2.1+, o th_de_DE_v2.dat do LibreOffice) entra SÓ COMO FILTRO, opcional: o termo que ele marca como
// vulgar ou ofensivo (derb, vulg., abwertend…) e nunca aparece sem a marca fica fora. Nada dele vai para a lista.
//
// Uso (os arquivos baixados numa pasta vazia):
//   node palavras-do-alemao.mjs <wortliste> <saida.txt> <N> [th_de_DE_v2.dat]
// A CHAVE: em minúscula, ä → ae, ö → oe, ü → ue, ß → ss (como nos jogos de palavra em alemão que usam só a-z), os outros
// acentos saem; só a-z, N letras. Sem grafia depois do tab: a tela mostra a chave (BAER), porque a casa é uma por letra.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , wortliste, saida, nTexto, thesaurus] = process.argv;
const N = Number(nTexto ?? 5);
const OFENSAS = new Set(['neger', 'negern', 'nigger', 'kanake', 'kanaken', 'schwuchtel', 'schwuchteln', 'spast', 'spasti',
  'spasten', 'zigeuner', 'judensau', 'fotze', 'fotzen', 'votze', 'wichser', 'hure', 'huren', 'nutte', 'nutten', 'ficken', 'fick',
  'fickt', 'fickte', 'arsch', 'scheisse', 'kacke', 'pisse', 'titte', 'titten', 'schlampe', 'schlampen', 'mongo', 'mongos']);

export function chaveAlema(palavra) {
  return palavra
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// O filtro do thesaurus: as linhas de cabeça ("termo|quantos") são o índice, sem marca; quem decide são as de sinônimos.
const marcados = new Set();
const limpos = new Set();
if (thesaurus) {
  const MARCA = /\((?:[^)]*\b)?(derb|vulg|abwertend|beleidigend|Schimpfwort|diskriminierend)\b[^)]*\)/i;
  for (const linha of readFileSync(thesaurus, 'utf8').split('\n').slice(1)) {
    const partes = linha.split('|');
    if (/^\d+$/.test(partes[1] ?? '')) continue;
    for (const item of partes.slice(1)) {
      const limpo = item.replace(/\([^)]*\)/g, '').trim();
      if (!/^[A-Za-zÄÖÜäöüß]+$/.test(limpo)) continue;
      (MARCA.test(item) ? marcados : limpos).add(chaveAlema(limpo));
    }
  }
}

const chaves = new Set();
for (const linha of readFileSync(wortliste, 'utf8').split('\n')) {
  const palavra = linha.split(';')[0].trim();
  if (!/^[A-Za-zÄÖÜäöüß]+$/.test(palavra)) continue;
  if (palavra.length > 1 && palavra === palavra.toUpperCase()) continue; // sigla
  const k = chaveAlema(palavra);
  if (k.length !== N || !/^[a-z]+$/.test(k) || OFENSAS.has(k)) continue;
  if (marcados.has(k) && !limpos.has(k)) continue;
  chaves.add(k);
}
writeFileSync(saida, [...chaves].sort().join('\n') + '\n');
console.log(chaves.size);
