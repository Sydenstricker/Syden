// AS BANDEIRAS DO QUIZ DE PAÍSES (o modo Bandeira, 20/11/2026). A arte é a do flag-icons, de Panayiotis Lipiridis
// (github.com/lipis/flag-icons, LICENÇA MIT: pode copiar e redistribuir, com o aviso da licença junto). Bandeira
// nacional em geral não tem direito autoral, mas o DESENHO em SVG é obra de quem desenhou, e é por isso que vale a licença
// do conjunto, e não "bandeira é livre". A licença vai ao lado dos arquivos (LICENCA-flag-icons.txt).
//
// Ficam em server/assets/quiz/bandeiras/, e NÃO em web/public: o nome do arquivo seria o código do país ("br.svg"), e a
// bandeira da rodada é a resposta. O servidor a entrega por uma ficha sorteada a cada rodada (minijogo-quiz.ts), e por isso
// o SVG também perde o que diz o país: o id da raiz ("flag-icons-br") e o código na frente dos ids e das classes
// de dentro ("br-a" vira "q-a").
//
// Só as dos 193 países do quiz (server/assets/quiz/paises.json), na proporção 4:3 (todas do mesmo tamanho, para a grade
// que se revela aos poucos). O navegador de quem joga nunca fala com o npm nem com o GitHub.
//
//   node server/scripts/quiz-bandeiras.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const VERSAO = '7.5.0';
const PACOTE = `https://registry.npmjs.org/flag-icons/-/flag-icons-${VERSAO}.tgz`;
// O que o npm publica para a versão (npm view flag-icons@7.5.0 dist.integrity): o pacote baixado tem de bater.
const INTEGRIDADE = 'sha512-kd+MNXviFIg5hijH766tt+3x76ele1AXlo4zDdCxIvqWZhKt4T83bOtxUOOMlTx/EcFdUMH5yvQgYlFh1EqqFg==';
const SAIDA = new URL('../assets/quiz/bandeiras/', import.meta.url);

const paises = JSON.parse(readFileSync(new URL('../assets/quiz/paises.json', import.meta.url), 'utf8')).map((p) => p.id);

const bruto = Buffer.from(await (await fetch(PACOTE)).arrayBuffer());
const conferido = `sha512-${createHash('sha512').update(bruto).digest('base64')}`;
if (conferido !== INTEGRIDADE) throw new Error(`o pacote do npm não bate com a versão ${VERSAO}: ${conferido}`);

/** Os arquivos do .tar (cabeçalhos de 512 bytes: o nome nos 100 primeiros, o tamanho em octal no 124). */
function lerTar(tar) {
  const arquivos = new Map();
  for (let i = 0; i + 512 <= tar.length; ) {
    const nome = tar.toString('utf8', i, i + 100).replace(/\0.*$/s, '');
    if (!nome) break;
    const tamanho = parseInt(tar.toString('utf8', i + 124, i + 136).replace(/\0.*$/s, '').trim() || '0', 8);
    arquivos.set(nome, tar.subarray(i + 512, i + 512 + tamanho));
    i += 512 + Math.ceil(tamanho / 512) * 512;
  }
  return arquivos;
}
const arquivos = lerTar(gunzipSync(bruto));

/**
 * O SVG sem nada que diga o país: sem o id da raiz ("flag-icons-br"), e com o prefixo do código que o flag-icons põe nos
 * ids e nas classes de dentro ("br-a", ".bo-fil1") trocado por "q-". Só onde é nome (depois de espaço, aspas, "#", "." ou
 * "("): no meio do desenho, "zm-4" é coordenada.
 */
function semONome(svg, codigo) {
  const nome = () => new RegExp(`(?<=[\\s"'#.(])${codigo}-`, 'gi');
  const s = svg.replace(/\s+id="flag-icons-[a-z-]+"/, '').replace(nome(), 'q-');
  if (nome().test(s) || /flag-icons/i.test(s)) throw new Error(`${codigo}: sobrou o código no SVG`);
  return `${s.trim()}\n`;
}

rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(SAIDA, { recursive: true });
let total = 0;
for (const pais of paises) {
  const codigo = pais.toLowerCase();
  const svg = arquivos.get(`package/flags/4x3/${codigo}.svg`);
  if (!svg) throw new Error(`o flag-icons não tem ${pais}`);
  const limpo = semONome(svg.toString('utf8'), codigo);
  writeFileSync(new URL(`${codigo}.svg`, SAIDA), limpo);
  total += limpo.length;
}
writeFileSync(new URL('LICENCA-flag-icons.txt', SAIDA), arquivos.get('package/LICENSE'));
writeFileSync(
  new URL('LEIAME.txt', SAIDA),
  `As bandeiras do quiz de países (modo Bandeira).\n\n` +
    `Arte: flag-icons ${VERSAO}, de Panayiotis Lipiridis (https://github.com/lipis/flag-icons), licença MIT\n` +
    `(o texto completo em LICENCA-flag-icons.txt). Só as dos 193 países do quiz, na proporção 4:3.\n\n` +
    `Mudança nossa: o código do país na frente dos ids e das classes de dentro do SVG virou "q-", e o id da\n` +
    `raiz saiu, para o arquivo não dizer a resposta. Refeito por server/scripts/quiz-bandeiras.mjs.\n`,
);
console.log(`${paises.length} bandeiras, ${Math.round(total / 1024)} KB, em ${SAIDA.pathname}`);
