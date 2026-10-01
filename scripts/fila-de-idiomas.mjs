// A FILA DOS IDIOMAS QUE FALTAM: qual vem agora, por quê, e o que ele vai quebrar.
//
// ---------------------------------------------------------------------------------------------------
// POR QUE UMA FERRAMENTA, E NÃO UMA LISTA NUM ARQUIVO DE TEXTO.
//
// Uma lista escrita à mão começa certa e envelhece calada: alguém traduz um idioma e esquece de riscar,
// alguém acrescenta outro na lista do app e esquece de pôr aqui, e seis meses depois a fila manda
// traduzir o que já está traduzido. **A fila é DERIVADA** — ela lê a lista de idiomas e o TRADUCOES de
// web/src/i18n/idiomas.ts, que são a fonte da verdade, e não tem como discordar deles.
//
// O QUE É ESCRITO À MÃO AQUI é só o que nenhum código sabe: **a armadilha de cada língua.** Isso não se
// deriva, se aprende — e cada linha dessas custou uma tela errada. O chinês escreve número grande em
// unidade de cem milhões; o turco não tem o i maiúsculo que o resto do mundo tem; o vietnamita usa os
// MESMOS acentos do português e cegou o detector de língua. Nenhuma dessas aparece lendo o código.
//
//   node scripts/fila-de-idiomas.mjs           a fila inteira
//   node scripts/fila-de-idiomas.mjs --proximo só o da vez, com o passo a passo
//   node scripts/fila-de-idiomas.mjs --tudo    inclusive os que já estão prontos
// ---------------------------------------------------------------------------------------------------
import { readFileSync } from 'node:fs';

const FONTE = 'web/src/i18n/idiomas.ts';
const texto = readFileSync(FONTE, 'utf8');

/**
 * Quantos falantes tem cada língua, em milhões — lido de web/src/i18n/paises.ts.
 *
 * É LIDO DE LÁ, e não escrito aqui, porque lá é onde o projeto guarda esse fato. Uma segunda lista
 * neste arquivo começaria igual e discordaria em seis meses, sem ninguém notar: a fila mandaria
 * traduzir na ordem errada e a tela diria outro número.
 */
function falantesPorIdioma() {
  const bruto = readFileSync('web/src/i18n/paises.ts', 'utf8');
  const bloco = bruto.match(/export const FALANTES_EM_MILHOES: Record<string, number> = \{([\s\S]*?)\n\};/);
  if (!bloco) throw new Error('não achei o FALANTES_EM_MILHOES em web/src/i18n/paises.ts');
  return Object.fromEntries([...bloco[1].matchAll(/^\s*['"]?([\w-]+)['"]?:\s*(\d+)\s*,/gm)].map((m) => [m[1], Number(m[2])]));
}
const falantes = falantesPorIdioma();

/** A lista do app, lida do código. Sem importar: isto roda com `node` puro, e o arquivo é TypeScript. */
function todosOsIdiomas() {
  const bloco = texto.match(/export const IDIOMAS: Idioma\[\] = \[([\s\S]*?)\n\];/);
  if (!bloco) throw new Error(`não achei o IDIOMAS em ${FONTE}`);
  const achados = [];
  for (const linha of bloco[1].split('\n')) {
    // AS ASPAS SÃO DOS DOIS TIPOS, e isto já comeu um idioma: o uzbeque se escreve "O'zbek", com
    // apóstrofo dentro, então a linha dele usa aspas duplas. Procurando só por aspas simples, ele
    // sumia da fila — e sumir é o pior jeito de errar, porque não dá erro nenhum.
    const m = /codigo: '([\w-]+)'.*?nativo: (?:'([^']+)'|"([^"]+)").*?nome: '([^']+)'.*?escrita: '(\w+)'(.*?)paises: (\d+)/.exec(linha);
    if (m) {
      achados.push({
        codigo: m[1],
        nativo: m[2] ?? m[3],
        nome: m[4],
        escrita: m[5],
        rtl: /rtl: true/.test(m[6]),
        paises: Number(m[7]),
        falantes: falantes[m[1]] ?? 0,
      });
    }
  }
  return achados;
}

/** Quem já tem dicionário. Lido do TRADUCOES, e não da pasta: é o TRADUCOES que o app usa. */
function jaTraduzidos() {
  const bloco = texto.match(/export const TRADUCOES[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  if (!bloco) throw new Error('não achei o TRADUCOES');
  return new Set([...bloco[1].matchAll(/^\s*['"]?([\w-]+)['"]?\s*:/gm)].map((m) => m[1]));
}

/**
 * O QUE CADA LÍNGUA TRAZ DE NOVO. É a única coisa escrita à mão neste arquivo.
 *
 * Quem for traduzir lê isto ANTES, não depois: todas estas já apareceram como tela errada em algum
 * projeto, e as marcadas com ✔ apareceram neste.
 */
const ESCRITAS = {
  latina: 'Alfabeto latino: a fonte do Syden já desenha. O risco é o DETECTOR — ver abaixo.',
  cirilica: 'Cirílico: fonte de reserva (Noto Sans). O detector de português funciona, nenhuma letra coincide.',
  grega: 'Grego: fonte de reserva. Sigma final (ς) é outra letra que o sigma do meio — não normalizar à toa.',
  arabe: 'ÁRABE, DA DIREITA PARA A ESQUERDA: a página inteira vira. Ver web/src/bidi.ts e a seta ← em vez de →.',
  hebraica: 'HEBRAICO, DA DIREITA PARA A ESQUERDA: mesma família de armadilhas do árabe.',
  thaana: 'THAANA, DA DIREITA PARA A ESQUERDA: escrita rara, conferir a fonte de reserva na tela.',
  devanagari: 'Devanágari: algarismos próprios (०१२३). Todo número na tela tem de passar por Intl.NumberFormat.',
  bengali: 'Bengali: algarismos próprios (০১২৩) ✔ já mordeu uma vez.',
  tamil: 'Tâmil: algarismos próprios e palavras longas; conferir estouro de caixa.',
  telugu: 'Télugo: fonte de reserva própria; conferir que não vira quadradinho.',
  sinhala: 'Cingalês: fonte de reserva própria; letras altas, conferir altura de linha.',
  tailandesa: 'TAILANDÊS: NÃO SEPARA PALAVRA COM ESPAÇO. A quebra de linha se comporta diferente de tudo o que já foi feito, e caixa estreita é onde isso aparece.',
  khmer: 'Khmer: também sem espaço entre palavras, e com sinais empilhados — conferir altura de linha.',
  lao: 'Lao: sem espaço entre palavras, como o tailandês.',
  birmanesa: 'Birmanês: sem espaço entre palavras; fonte de reserva própria.',
  chinesa: 'CHINÊS: número grande se escreve em 亿 (cem milhões) ✔. Sem espaço entre palavras.',
  japonesa: 'JAPONÊS: sem espaço entre palavras; três sistemas de escrita na mesma frase; o registro (です/ます) é escolha a fazer uma vez.',
  coreana: 'COREANO: sem espaço entre todas as palavras; a cortesia mora no VERBO ✔ (해요체, decidido).',
  etiope: 'Amárico: fonte de reserva própria; algarismos próprios pouco usados, mas conferir.',
  georgiana: 'Georgiano: alfabeto sem maiúsculas. Nada de toUpperCase em rótulo.',
  armenia: 'Armênio: pontuação própria (o ponto final é ։). Fonte de reserva.',
};

/** Armadilha específica da língua, quando ela tem uma que a escrita não explica. */
const POR_IDIOMA = {
  tr: 'O I MAIÚSCULO NÃO É O MESMO ✔: "YAZI".toLowerCase() devolve yazi, e em turco o certo é ı. Comparação sem caixa precisa de toLocaleLowerCase("tr").',
  vi: 'Usa os MESMOS acentos do português ✔ (ã, á, ê, ô): o detector por letra cega. Ver e2e/configuracoes-traduzidas.mjs.',
  pl: 'Latino com acentos próprios (ą, ę, ł, ż). O detector de português por letra NÃO serve: usar o das chaves, como o vietnamita.',
  ro: 'Latino com ș e ț (vírgula embaixo, não cedilha). Caso clássico de copiar o caractere errado.',
  cs: 'Latino com háček. O detector por letra não serve; usar o das chaves.',
  sk: 'Igual ao tcheco, e as duas línguas se parecem o bastante para alguém traduzir uma e colar na outra.',
  hu: 'Latino com ő e ű, que não existem em mais nenhuma língua. Palavra composta longa: risco de estourar a caixa, como o alemão.',
  fi: 'Palavra composta MUITO longa — o maior risco de estouro horizontal da lista inteira.',
  is: 'Latino com þ e ð. Fonte de reserva desnecessária, mas conferir que o navegador desenha.',
  ga: 'Irlandês: o artigo muda a primeira letra da palavra seguinte. Frase montada em pedaços sai errada — mais um motivo para a frase ir inteira.',
  mt: 'Maltês: latino com ġ, ħ, ż. Língua semítica em alfabeto latino, da esquerda para a direita.',
  fa: 'Persa: árabe da direita para a esquerda, MAS com algarismos próprios (۱۲۳) diferentes dos árabes.',
  ur: 'Urdu: árabe RTL, e a fonte de reserva comum desenha mal o estilo nastaliq — conferir na tela.',
  he: 'Hebraico RTL. Sem maiúsculas: nada de toUpperCase.',
  sr: 'Sérvio: escreve-se em cirílico E em latino. Escolher um, escrever a escolha, e não misturar.',
  az: 'Azerbaijano: latino, e tem o mesmo i sem ponto do turco.',
  uz: "Uzbeque: latino com o' e g', que são apóstrofos de verdade dentro da palavra — cuidado ao escapar aspas.",
  kk: 'Cazaque: cirílico, e o país está trocando para o latino. Ficar no cirílico, que é o que o navegador manda.',
  ht: 'Crioulo haitiano: ortografia fonética fixa; não "corrigir" para o francês.',
  so: 'Somali: latino com x e c como consoantes guturais. Parece erro de digitação e não é.',
};

const idiomas = todosOsIdiomas();
const prontos = jaTraduzidos();
const ehPadrao = (c) => c === 'pt-BR';

/**
 * A ORDEM DA FILA: **quantos falantes**, do maior para o menor, com o número de países desempatando.
 *
 * NÃO É A ORDEM DA LISTA DO APP, e a diferença importa. A lista do app é ordenada por número de países
 * onde a língua é oficial, porque lá a pergunta é de COBERTURA — quantas cadeiras da ONU o Syden
 * alcança. Aqui a pergunta é outra: **quanta gente passa a poder usar o Syden na língua dela.** Pelo
 * critério de países, o albanês (7 milhões de falantes, 2 países) vinha na frente do urdu (230
 * milhões, 1 país), e isso é a fila certa para a pergunta errada.
 */
const faltando = idiomas
  .filter((i) => !ehPadrao(i.codigo) && !prontos.has(i.codigo))
  .sort((a, b) => b.falantes - a.falantes || b.paises - a.paises || a.nome.localeCompare(b.nome, 'pt-BR'));

const armadilha = (i) => POR_IDIOMA[i.codigo] ?? ESCRITAS[i.escrita] ?? '';

// ---------- só o próximo, com o passo a passo ----------
if (process.argv.includes('--proximo')) {
  const [proximo] = faltando;
  if (!proximo) {
    console.log('Nenhum idioma na fila: os 73 estão traduzidos.');
    process.exit(0);
  }
  console.log(`\nO PRÓXIMO É O ${proximo.nome.toUpperCase()} — ${proximo.nativo} (${proximo.codigo})\n`);
  console.log(`  oficial em ${proximo.paises} país(es) da ONU · escrita ${proximo.escrita}${proximo.rtl ? ' · DA DIREITA PARA A ESQUERDA' : ''}\n`);
  console.log(`  O QUE ELE TRAZ:\n    ${armadilha(proximo)}\n`);

  // OS ALGARISMOS, MEDIDOS E NÃO SUPOSTOS. Duas línguas na mesma escrita podem ter numerações
  // opostas — o urdu escreve 123 e o persa escreve ۱۲۳ —, e quem traduz não tem como adivinhar.
  // Todo número da tela passa pelo Intl, então o que estiver escrito à mão no dicionário tem de
  // combinar com o que aparece aqui. Errar não dá erro: dá duas numerações na mesma frase.
  const mil = new Intl.NumberFormat(proximo.codigo).format(1234567);
  const grande = new Intl.NumberFormat(proximo.codigo, { notation: 'compact' }).format(proximo.falantes * 1_000_000);
  console.log(`  OS ALGARISMOS QUE A TELA VAI DESENHAR (é o Intl quem decide, não você):`);
  console.log(`    1234567 → ${mil}        número grande → ${grande}`);
  console.log(
    /[0-9]/.test(mil)
      ? '    São os latinos. Escreva os números do dicionário com 0-9, como no português.\n'
      : '    NÃO são os latinos. Todo número CONTADO numa frase tem de ser escrito com estes;\n' +
          '    identificador técnico (1080p, 512 KB, 128×128) fica em 0-9, porque é código.\n',
  );
  console.log('  O CAMINHO, na ordem:');
  console.log(`    1. node scripts/idiomas.mjs --novo ${proximo.codigo}`);
  console.log('    2. traduzir, e escrever NO CABEÇALHO do arquivo a decisão de TRATAMENTO e o');
  console.log('       vocabulário fixo (comunidade, canal, sala de voz, senha, lixeira…). O Syden trata');
  console.log('       por "você" em toda língua que tenha essa escolha — ver CLAUDE.md.');
  console.log(`    3. ligar em TRADUCOES (web/src/i18n/idiomas.ts): ${proximo.codigo}: () => import('./${proximo.codigo}'),`);
  console.log(`    4. pôr a lista de países em OFICIAL, em web/src/i18n/paises.ts — há teste que EXIGE`);
  console.log('       (idioma pronto sem lista mostra a grade vazia, dizendo que ele não é oficial em');
  console.log('       lugar nenhum) e outro que confere se o número em idiomas.ts bate com a lista.');
  console.log(`       Os falantes já estão lá: ${proximo.falantes} milhões.`);
  console.log('    5. A TELA DE SEM CONEXÃO TEM DICIONÁRIO PRÓPRIO, e é o passo que se esquece: ela');
  console.log('       mora dentro do pacote do app (desktop/src/offline.js) e não alcança o i18n — se');
  console.log('       houvesse internet para buscar a tradução, ela não estaria aparecendo. São cinco');
  console.log(`       frases. O vietnamita foi esquecido aí, e quem achou foi e2e/tela-sem-conexao.mjs.`);
  if (proximo.rtl) {
    console.log(`       E o ${proximo.codigo} escreve da direita para a esquerda: entra também no`);
    console.log('       DA_DIREITA_PARA_A_ESQUERDA, no mesmo arquivo.');
  }
  console.log('    6. npm test -w web   (campos {assim}, chaves órfãs, países)');
  console.log(`    7. MEDIR NA TELA, que é a regra do CLAUDE.md: pôr ${proximo.codigo} na lista de`);
  console.log('       e2e/configuracoes-traduzidas.mjs e rodar. Sentido da página, nada em português,');
  console.log('       nenhum campo cru, nada estourando — e OLHAR A FOTO que ele tira no fim.');
  console.log('    8. node e2e/tela-sem-conexao.mjs — ele confere que o passo 5 não ficou para trás.');
  if (proximo.escrita === 'latina') {
    console.log('\n  ATENÇÃO: escrita latina com acento. O detector por letra do teste de idiomas NÃO');
    console.log('  serve — use o das chaves do dicionário, como o vietnamita (sobrouPortugues).');
  }
  console.log('');
  process.exit(0);
}

// ---------- a fila ----------
const tudo = process.argv.includes('--tudo');

console.log(`\n${prontos.size + 1} de ${idiomas.length} idiomas prontos. Faltam ${faltando.length}.\n`);

if (tudo) {
  console.log('JÁ PRONTOS:');
  for (const i of idiomas.filter((i) => ehPadrao(i.codigo) || prontos.has(i.codigo))) {
    console.log(`  ✔ ${i.codigo.padEnd(6)} ${i.nativo.padEnd(22)} ${i.nome}`);
  }
  console.log('');
}

console.log('A FILA, do que alcança mais para o que alcança menos:\n');
console.log('   #  código  na própria língua        nome               milhões  países  o que ele traz de novo');
console.log('  ' + '─'.repeat(116));
faltando.forEach((i, n) => {
  const marca = `${String(n + 1).padStart(4)}  ${i.codigo.padEnd(7)} ${i.nativo.padEnd(24)} ${i.nome.padEnd(18)} ${String(i.falantes).padStart(7)}  ${String(i.paises).padStart(5)}`;
  console.log(marca + '   ' + armadilha(i).slice(0, 120));
});

console.log(`
Cada um é ~733 frases. A regra do CLAUDE.md vale para todos: conferir idioma que ninguém da dupla lê
é MEDIR, não confiar — direção do documento, alfabeto certo na tela, nenhum resto em português e zero
de estouro horizontal.

  node scripts/fila-de-idiomas.mjs --proximo    o da vez, com o passo a passo
  node scripts/idiomas.mjs                      quanto falta em cada um dos que já existem
`);
