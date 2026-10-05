// Baixa as fontes do Syden e gera o que a tela precisa para usá-las.
//
//   node scripts/baixar-fontes.mjs
//
// DE ONDE: o Fontsource (pacotes npm @fontsource/<id>), que é o catálogo do Google Fonts empacotado
// para quem hospeda os próprios arquivos — cada pacote traz a licença, os arquivos separados por
// ESCRITA (latino, cirílico, grego…) e a faixa de caracteres que cada um cobre.
//
// POR QUE BAIXAR E NÃO APONTAR: uma fonte escolhida por quem administra faria o navegador de TODO
// MUNDO ir buscar no Google, por decisão de outra pessoa (ver CLAUDE.md, "Fonte de terceiro"). Os
// arquivos moram em web/public/fontes/ e saem do nosso domínio. Este script roda na máquina de quem
// desenvolve, uma vez; o que ele gera entra no git.
//
// O QUE ELE RECUSA: fonte cuja licença não seja OFL ou Apache. Embutir é REDISTRIBUIR, e esses são
// os dois tipos que permitem. Recusa e PARA — avisar e seguir é como uma fonte proibida entra.
//
// O QUE ELE GERA:
//   web/public/fontes/<id>/<escrita>.woff2   um arquivo por escrita, só o peso escolhido
//   web/public/fontes/<id>/LICENCA.txt       a licença, que a OFL e a Apache exigem ao lado da fonte
//   web/src/fontes.gerado.css                os @font-face, com unicode-range por escrita
//   web/src/fontes.gerado.ts                 o catálogo: família, peso e o que cada fonte cobre

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DESTINO = join(RAIZ, 'web/public/fontes');

/** As escritas que embutimos. CJK, árabe, índicas ficam de fora por ora: são de outras famílias. */
const ESCRITAS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'vietnamese'];

/**
 * As vinte, na ordem em que aparecem para escolher. `id` é o código que o servidor guarda — os quatro
 * primeiros de cada grupo antigo mantêm o código que já estava em uso (estreita, redonda, manuscrita,
 * pixel), para nenhuma comunidade perder a letra que escolheu.
 */
const FONTES = [
  { id: 'estreita', pacote: 'bebas-neue', grupo: 'fortes' },
  { id: 'anton', pacote: 'anton', grupo: 'fortes' },
  { id: 'bungee', pacote: 'bungee', grupo: 'fortes' },
  { id: 'russo', pacote: 'russo-one', grupo: 'fortes' },
  { id: 'manuscrita', pacote: 'lobster', grupo: 'divertidas' },
  { id: 'pacifico', pacote: 'pacifico', grupo: 'divertidas' },
  { id: 'fredoka', pacote: 'fredoka', grupo: 'divertidas' },
  { id: 'bangers', pacote: 'bangers', grupo: 'divertidas' },
  { id: 'luckiest', pacote: 'luckiest-guy', grupo: 'divertidas' },
  { id: 'playfair', pacote: 'playfair-display', grupo: 'elegantes' },
  { id: 'cinzel', pacote: 'cinzel', grupo: 'elegantes' },
  { id: 'abril', pacote: 'abril-fatface', grupo: 'elegantes' },
  { id: 'caveat', pacote: 'caveat', grupo: 'manuscritas' },
  { id: 'marcador', pacote: 'permanent-marker', grupo: 'manuscritas' },
  { id: 'satisfy', pacote: 'satisfy', grupo: 'manuscritas' },
  { id: 'pixel', pacote: 'press-start-2p', grupo: 'retro' },
  { id: 'vt323', pacote: 'vt323', grupo: 'retro' },
  // A Orbitron estava aqui e SAIU: o til dela é um traço inclinado, e "São" se lia "Sào" (medido na tela).
  { id: 'exo', pacote: 'exo-2', grupo: 'retro' },
  { id: 'audiowide', pacote: 'audiowide', grupo: 'retro' },
  { id: 'redonda', pacote: 'comfortaa', grupo: 'arredondadas' },
];

/** O nome aparece em negrito em quase toda tela: o peso mais forte disponível, até 700. */
function pesoEscolhido(pesos) {
  return [700, 600, 400].find((p) => pesos.includes(p)) ?? pesos[0];
}

/** As fontes da MARCA moram na mesma pasta e não são deste script (ver baixar-fontes-da-marca.mjs). */
const DA_MARCA = ['bricolage', 'instrument'];

// Fonte que saiu da lista sai também do disco: sobrar a pasta seria publicar uma fonte que ninguém escolhe.
for (const pasta of readdirSync(DESTINO, { withFileTypes: true })) {
  if (pasta.isDirectory() && !FONTES.some((f) => f.id === pasta.name) && !DA_MARCA.includes(pasta.name)) {
    rmSync(join(DESTINO, pasta.name), { recursive: true });
    console.log('  removida: ' + pasta.name);
  }
}

const temp = mkdtempSync(join(tmpdir(), 'syden-fontes-'));
const catalogo = [];
let css = '';

try {
  for (const fonte of FONTES) {
    execFileSync('npm', ['pack', `@fontsource/${fonte.pacote}`, '--silent', '--pack-destination', temp], {
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: true,
    });
    const tgz = readdirSync(temp).find((n) => n.startsWith(`fontsource-${fonte.pacote}-`) && n.endsWith('.tgz'));
    const pasta = join(temp, fonte.pacote);
    mkdirSync(pasta, { recursive: true });
    // Caminhos RELATIVOS, com cwd: o tar do Git Bash lê 'C:' como endereço de máquina remota.
    execFileSync('tar', ['-xzf', tgz, '-C', fonte.pacote], { cwd: temp });
    rmSync(join(temp, tgz));
    const pacote = join(pasta, 'package');

    const meta = JSON.parse(readFileSync(join(pacote, 'metadata.json'), 'utf8'));
    if (!/^(OFL-1\.1|Apache-2\.0)$/.test(meta.license?.type ?? '')) {
      throw new Error(`${meta.family}: licença ${meta.license?.type} — não permite embutir. Parei.`);
    }
    const faixas = JSON.parse(readFileSync(join(pacote, 'unicode.json'), 'utf8'));
    const peso = pesoEscolhido(meta.weights);
    const escritas = ESCRITAS.filter((e) => meta.subsets.includes(e) && faixas[e]);

    const saida = join(DESTINO, fonte.id);
    rmSync(saida, { recursive: true, force: true });
    mkdirSync(saida, { recursive: true });
    // LICENCA.txt e não OFL.txt: três das vinte são Apache 2.0, que também permite embutir.
    copyFileSync(join(pacote, 'LICENSE'), join(saida, 'LICENCA.txt'));

    const familia = `Syden ${meta.family}`;
    for (const escrita of escritas) {
      copyFileSync(join(pacote, 'files', `${meta.id}-${escrita}-${peso}-normal.woff2`), join(saida, `${escrita}.woff2`));
      css +=
        `@font-face {\n  font-family: '${familia}';\n  src: url('/fontes/${fonte.id}/${escrita}.woff2') format('woff2');\n` +
        `  font-weight: 100 900;\n  font-display: swap;\n  unicode-range: ${faixas[escrita]};\n}\n\n`;
    }

    catalogo.push({
      id: fonte.id,
      nome: meta.family,
      grupo: fonte.grupo,
      familia,
      categoria: meta.category,
      licenca: meta.license.type,
      faixas: escritas.map((e) => faixas[e]).join(','),
    });
    console.log(`  ${meta.family.padEnd(18)} ${meta.license.type}  peso ${peso}  ${escritas.join(', ')}`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const AVISO = '// GERADO por scripts/baixar-fontes.mjs — não edite à mão; rode o script de novo.\n';

writeFileSync(
  join(RAIZ, 'web/src/fontes.gerado.css'),
  AVISO.replace('//', '/*').replace('\n', ' */\n') +
    '/* `font-weight: 100 900` em todos: cada fonte vem num peso só (o mais forte até 700), e isto\n' +
    '   impede o navegador de inventar um negrito por cima dele — o negrito falso borra a letra. */\n\n' +
    css,
);

writeFileSync(
  join(RAIZ, 'web/src/fontes.gerado.ts'),
  AVISO +
    '\nexport interface FonteEmbutida {\n  id: string;\n  nome: string;\n  grupo: string;\n  familia: string;\n' +
    '  categoria: string;\n  licenca: string;\n  /** Os caracteres que a fonte cobre, no formato do unicode-range. */\n  faixas: string;\n}\n\n' +
    `export const FONTES_EMBUTIDAS: FonteEmbutida[] = ${JSON.stringify(catalogo, null, 2)};\n`,
);

console.log(`\n${catalogo.length} fontes em web/public/fontes/, catálogo em web/src/fontes.gerado.ts`);
