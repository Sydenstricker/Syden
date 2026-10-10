// Põe os arquivos do site de apresentação na raiz do que vai ser publicado.
//
// O Vite constrói o app em dist/app/. Este script copia web/site/ para dist/, e é o que faz syden.chat
// abrir a apresentação e syden.chat/app/ abrir o Syden.
//
// POR QUE É UM SCRIPT, E NÃO UM PASSO DO GITHUB ACTIONS. Porque `npm run build -w web` tem de produzir
// o site COMPLETO na sua máquina, igual ao que vai para o ar. Se metade da montagem morasse no
// workflow, o build local produziria um site sem página inicial, e ninguém descobriria antes de publicar.
//
// POR QUE ELE APAGA O QUE NÃO RECONHECE. O Vite só esvazia dist/app — a raiz de dist/ fica com o que
// sobrou de builds anteriores. Quando o app saiu da raiz e foi para /app/, a primeira montagem deixou
// na raiz o sw.js, o manifest e a pasta assets/ do formato antigo. Publicar isso é pior do que parece:
// um service worker velho na raiz continua atendendo pedidos no navegador de quem já visitou o site,
// servindo arquivos de uma versão que não existe mais. Ninguém vê erro; o Syden simplesmente abre
// errado, e só para quem já tinha visitado.
//
// Então a regra aqui é fechada: **a raiz de dist/ é exatamente web/site/ mais a pasta app/, e nada
// mais.** O que não se encaixa é removido, e o script diz o que removeu.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SITE = join(AQUI, 'site');
const DIST = join(AQUI, 'dist');

if (!existsSync(join(DIST, 'app'))) {
  console.error('dist/app não existe. Rode o build do Vite antes deste script.');
  process.exit(1);
}

const doSite = readdirSync(SITE);
cpSync(SITE, DIST, { recursive: true });

/**
 * Os ícones do Syden são copiados de web/public/ para a raiz, em vez de existirem duas vezes.
 *
 * A página de apresentação precisa deles na raiz: o favicon e a imagem que aparece quando alguém cola o
 * link num grupo (og:image) têm de estar num endereço fixo. Guardar uma segunda cópia dentro de
 * web/site/ funcionaria — e um dia o coelho mudaria só num dos dois lugares, com o site velho e o app
 * novo mostrando desenhos diferentes. Uma fonte, dois destinos.
 */
const ICONES_DA_MARCA = ['icon-192.png', 'icon-512.png'];
for (const icone of ICONES_DA_MARCA) {
  const de = join(AQUI, 'public', icone);
  if (!existsSync(de)) {
    console.error(`${icone} não está em web/public/: a página de apresentação ficaria sem ícone.`);
    process.exit(1);
  }
  cpSync(de, join(DIST, icone));
}

/**
 * O quarto do topo da apresentação é o MESMO da home do app, e pelo mesmo motivo dos ícones: uma fonte,
 * dois destinos. Quando a arte do quarto mudar (hibrido/exportar.mjs), o site muda junto.
 */
const QUARTO = ['noite.png', 'coelho.png', 'gato.png'];
mkdirSync(join(DIST, 'quarto'), { recursive: true });
for (const arquivo of QUARTO) {
  const de = join(AQUI, 'src', 'assets', 'quarto', arquivo);
  if (!existsSync(de)) {
    console.error(`${arquivo} não está em web/src/assets/quarto/: a apresentação ficaria sem o quarto.`);
    process.exit(1);
  }
  cpSync(de, join(DIST, 'quarto', arquivo));
}

/**
 * A PÁGINA DE VOLTA AO APLICATIVO FICA NOS DOIS LUGARES, e isso é de propósito.
 *
 * Quem aponta para ela é o servidor, montando o endereço a partir do SITE_URL dele. Esse SITE_URL pode
 * estar como `https://syden.chat` (como estava) ou `https://syden.chat/app` (como passa a ser), e o
 * arquivo precisa existir nos dois casos — porque um 404 aqui não é uma página quebrada qualquer: é
 * ninguém conseguindo entrar no app de desktop por Google, Discord, GitHub ou Steam, e só se descobre
 * tentando entrar.
 *
 * Duas cópias, UMA FONTE: o arquivo mora em web/site/ e é copiado. Manter duas cópias à mão daria a
 * mesma dor dos ícones da marca, logo acima — um dia só uma delas mudaria.
 */
const TAMBEM_DENTRO_DO_APP = ['voltar-para-o-app.html', 'voltar-para-o-app.js'];
for (const arquivo of TAMBEM_DENTRO_DO_APP) {
  const de = join(SITE, arquivo);
  if (!existsSync(de)) {
    console.error(`${arquivo} não está em web/site/: a entrada social do app de desktop ficaria sem volta.`);
    process.exit(1);
  }
  cpSync(de, join(DIST, 'app', arquivo));
}

// Fora o que veio de web/site/, os ícones da marca, o quarto e a pasta do app, nada tem o que fazer na raiz.
const permitidos = new Set([...doSite, ...ICONES_DA_MARCA, 'quarto', 'app']);
const sobras = readdirSync(DIST).filter((nome) => !permitidos.has(nome));
for (const sobra of sobras) {
  rmSync(join(DIST, sobra), { recursive: true, force: true });
  console.log(`  removido da raiz: ${sobra} (sobrou de um build anterior)`);
}

/**
 * CADA SCRIPT E CADA FOLHA DE ESTILO GANHA A IMPRESSÃO DIGITAL DO PRÓPRIO CONTEÚDO NO ENDEREÇO.
 *
 * POR QUE ISTO PRECISOU EXISTIR, e custou horas em 28/09/2026. O desviar-para-o-app.js é servido com
 * `cache-control: max-age=14400` — QUATRO HORAS no navegador de quem visitou. O nome do arquivo nunca
 * muda, então o navegador não tem como saber que existe versão nova: ele usa a que tem. Uma correção
 * nesse arquivo, que é justamente o que decide para onde vai quem volta do Google e quem clica no link
 * do e-mail, levava quatro horas para chegar em quem mais precisava dela — e no meio disso o defeito
 * "continua acontecendo", sem que o conserto tenha nada de errado.
 *
 * Com a impressão digital no endereço, arquivo novo é endereço novo, e endereço novo o navegador busca.
 * Quem manda passa a ser o HTML, que vive dez minutos de cache — e não quatro horas.
 *
 * A conta é do CONTEÚDO, e não da data: assim o endereço só muda quando o arquivo muda de verdade, e
 * uma publicação que não mexeu em nada não joga fora o cache de ninguém.
 */
const impressaoDigital = (caminho) => createHash('sha256').update(readFileSync(caminho)).digest('hex').slice(0, 8);

function versionarReferencias(pasta, paginas) {
  let versionadas = 0;
  for (const pagina of paginas) {
    const caminho = join(pasta, pagina);
    if (!existsSync(caminho)) continue;
    const antes = readFileSync(caminho, 'utf8');
    // Só endereços relativos e sem busca: o `[^"?:#]` deixa de fora https://... e o que já tem ?v=.
    const depois = antes.replace(/(src|href)="([^"?:#]+\.(?:js|css))"/g, (inteiro, atributo, arquivo) => {
      const alvo = join(pasta, arquivo);
      if (!existsSync(alvo)) return inteiro;
      versionadas++;
      return `${atributo}="${arquivo}?v=${impressaoDigital(alvo)}"`;
    });
    if (depois !== antes) writeFileSync(caminho, depois);
  }
  return versionadas;
}

const versionadas =
  versionarReferencias(DIST, doSite.filter((nome) => nome.endsWith('.html'))) +
  versionarReferencias(join(DIST, 'app'), TAMBEM_DENTRO_DO_APP.filter((nome) => nome.endsWith('.html')));

/** Sem estes três, o site publicado está quebrado de um jeito que o build não acusa. */
const OBRIGATORIOS = [
  ['index.html', 'sem ele, syden.chat mostra a lista de arquivos em vez da página inicial'],
  ['CNAME', 'sem ele, o domínio syden.chat para de apontar para o site'],
  ['app/index.html', 'sem ele, syden.chat/app/ não abre o Syden'],
  ['voltar-para-o-app.html', 'sem ela, entrar com Google no app de desktop não tem como voltar'],
  ['app/voltar-para-o-app.html', 'a mesma página, para quando o SITE_URL do servidor apontar para /app'],
];

/**
 * A página de contribuir sem o Pix é a falha silenciosa clássica: a imagem quebrada não dá erro em
 * build nenhum, e o "copia e cola" vazio só some da tela. Quem vê é quem ia doar, e desiste.
 */
const contribuir = readFileSync(join(DIST, 'contribuir.html'), 'utf8');
if (!existsSync(join(DIST, 'pix.svg')) || /id="copia-e-cola"><\/code>/.test(contribuir)) {
  console.error('contribuir.html está sem o QR ou sem o copia e cola do Pix. Rode: node scripts/qr-do-pix.mjs --chave ...');
  process.exit(1);
}

const faltando = OBRIGATORIOS.filter(([arquivo]) => !existsSync(join(DIST, arquivo)));
if (faltando.length) {
  console.error('O site montado está incompleto:');
  for (const [arquivo, porque] of faltando) console.error(`  ${arquivo} — ${porque}`);
  process.exit(1);
}

const tamanho = (pasta) =>
  readdirSync(pasta, { withFileTypes: true }).reduce((soma, item) => {
    const caminho = join(pasta, item.name);
    return soma + (item.isDirectory() ? tamanho(caminho) : statSync(caminho).size);
  }, 0);

const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' MB';
console.log(`Site montado em dist/ — ${mb(tamanho(DIST))} no total`);
console.log(`  /          apresentação  (${doSite.length} arquivos de web/site/, ${versionadas} com impressão digital)`);
console.log(`  /app/      o Syden       (${mb(tamanho(join(DIST, 'app')))})`);
