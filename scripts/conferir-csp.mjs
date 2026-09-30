// A política de segurança que PROPOMOS bate com a que está no ar?
//
// Elas moram em lugares diferentes e ninguém as edita junto. A nossa está em
// e2e/politica-de-seguranca.mjs; a do ar é uma Transform Rule escrita à mão no painel da Cloudflare,
// porque o site é servido pelo GitHub Pages, que não deixa a gente mandar cabeçalho. Não existe nada
// que ligue as duas.
//
// E CSP ERRADA NÃO AVISA. Ela bloqueia um arquivo em silêncio: a imagem não aparece, o som não toca, e
// a tela fica com cara de defeito de programação. Foi assim que os GIFs entraram no ar em 30/09/2026 —
// o seletor achava tudo e mostrava só o texto alternativo de cada figura, porque o img-src do ar não
// conhecia o GIPHY.
//
//   node scripts/conferir-csp.mjs               confere https://syden.chat/app/
//   node scripts/conferir-csp.mjs --so-imprime  só imprime o que colar, sem ir à internet
//   SITE_CSP=https://outro/ node scripts/conferir-csp.mjs
import { CSP } from '../e2e/politica-de-seguranca.mjs';

const ONDE = process.env.SITE_CSP || 'https://syden.chat/app/';

/** Quebra a política em diretiva → conjunto de fontes. */
function emPartes(texto) {
  const mapa = new Map();
  for (const pedaco of texto.split(';')) {
    const [nome, ...fontes] = pedaco.trim().split(/\s+/);
    if (nome) mapa.set(nome, new Set(fontes));
  }
  return mapa;
}

/** O que dizer quando não bate. Vale para os dois casos: sem cabeçalho e com cabeçalho diferente. */
function comoConsertar() {
  console.log('\nCole isto INTEIRO em Cloudflare → Rules → Transform Rules → Modify Response Header,');
  console.log('no valor do Content-Security-Policy:\n');
  console.log(CSP + '\n');
  console.log('Troque o valor todo, e não só o pedaço que falta: editar no meio de um campo grande é onde se erra.');
  // exitCode, e não process.exit(): com um fetch recém-terminado, sair na marra faz o Node do Windows
  // estourar uma asserção do libuv por cima da mensagem que a pessoa precisa ler.
  process.exitCode = 1;
}

if (process.argv.includes('--so-imprime')) {
  console.log(CSP);
} else {
  const resposta = await fetch(ONDE, { redirect: 'follow' });
  const noAr = resposta.headers.get('content-security-policy');
  console.log(`Comparando com ${ONDE}\n`);

  if (!noAr) {
    console.log('  ✘ este endereço não manda Content-Security-Policy nenhuma.');
    console.log('    A regra da Cloudflare pode ter sido desligada — ou o proxy (nuvem laranja) saiu do DNS,');
    console.log('    e aí ela não chega a rodar.');
    comoConsertar();
  } else {
    const nossa = emPartes(CSP);
    const deles = emPartes(noAr);
    const problemas = [];

    for (const [nome, fontes] of nossa) {
      const la = deles.get(nome);
      if (!la) {
        problemas.push(`falta a diretiva inteira: ${nome}`);
        continue;
      }
      const faltando = [...fontes].filter((f) => !la.has(f));
      if (faltando.length) problemas.push(`${nome}: falta ${faltando.join(' ')}`);
    }

    // O contrário também importa: fonte liberada no ar e não aqui é permissão que ninguém decidiu, ou
    // que alguém decidiu e esqueceu de escrever. Nos dois casos é para olhar.
    for (const [nome, fontes] of deles) {
      const aqui = nossa.get(nome);
      if (!aqui) {
        problemas.push(`o ar tem uma diretiva que não propomos: ${nome}`);
        continue;
      }
      const sobrando = [...fontes].filter((f) => !aqui.has(f));
      if (sobrando.length) problemas.push(`${nome}: o ar libera a mais ${sobrando.join(' ')}`);
    }

    if (problemas.length === 0) {
      console.log('✔ A política do ar é igual à que propomos.');
    } else {
      for (const p of problemas) console.log('  ✘ ' + p);
      comoConsertar();
    }
  }
}
