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
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
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

// Fora o que veio de web/site/, os ícones da marca e a pasta do app, nada tem o que fazer na raiz.
const permitidos = new Set([...doSite, ...ICONES_DA_MARCA, 'app']);
const sobras = readdirSync(DIST).filter((nome) => !permitidos.has(nome));
for (const sobra of sobras) {
  rmSync(join(DIST, sobra), { recursive: true, force: true });
  console.log(`  removido da raiz: ${sobra} (sobrou de um build anterior)`);
}

/** Sem estes três, o site publicado está quebrado de um jeito que o build não acusa. */
const OBRIGATORIOS = [
  ['index.html', 'sem ele, syden.chat mostra a lista de arquivos em vez da página inicial'],
  ['CNAME', 'sem ele, o domínio syden.chat para de apontar para o site'],
  ['app/index.html', 'sem ele, syden.chat/app/ não abre o Syden'],
];

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
console.log(`  /          apresentação  (${doSite.length} arquivos de web/site/)`);
console.log(`  /app/      o Syden       (${mb(tamanho(join(DIST, 'app')))})`);
