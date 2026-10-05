// Baixa as duas fontes da marca do Syden (rebrand de 05/10/2026) e gera os @font-face delas.
//
//   node scripts/baixar-fontes-da-marca.mjs
//
// Bricolage Grotesque para títulos e Instrument Sans para texto, as dos protótipos do rebrand. Ambas
// OFL. As mesmas regras de scripts/baixar-fontes.mjs (ver CLAUDE.md, "Fonte de terceiro"): os arquivos
// moram no nosso domínio, com a licença ao lado, e o script recusa e PARA se a licença não permitir
// embutir.
//
// POR QUE UM SCRIPT À PARTE. As fontes da comunidade são um catálogo para escolher, num peso só cada;
// estas não se escolhem, e precisam de vários pesos. Por isso vêm do pacote VARIÁVEL do Fontsource
// (@fontsource-variable/<id>): um arquivo por escrita cobre todos os pesos de uma vez.
//
// Declarar @font-face não baixa nada: o navegador só busca o arquivo quando alguma coisa na tela usa
// a família. Escritas que elas não têm (cirílico, árabe…) caem na pilha de reserva de quem as usar.
//
// O QUE ELE GERA:
//   web/public/fontes/<id>/<escrita>.woff2   um arquivo variável por escrita
//   web/public/fontes/<id>/LICENCA.txt       a licença, que a OFL exige ao lado da fonte
//   web/src/fontesDaMarca.gerado.css         os @font-face, com unicode-range por escrita

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DESTINO = join(RAIZ, 'web/public/fontes');

/** `id` é a pasta; scripts/baixar-fontes.mjs sabe que estas duas não são dele e não as apaga. */
const FONTES_DA_MARCA = [
  { id: 'bricolage', pacote: 'bricolage-grotesque' },
  { id: 'instrument', pacote: 'instrument-sans' },
];

const ESCRITAS = ['latin', 'latin-ext', 'vietnamese'];

{
  const temp = mkdtempSync(join(tmpdir(), 'syden-fontes-marca-'));
  let css = '';
  try {
    for (const fonte of FONTES_DA_MARCA) {
      execFileSync('npm', ['pack', `@fontsource-variable/${fonte.pacote}`, '--silent', '--pack-destination', temp], {
        stdio: ['ignore', 'pipe', 'inherit'],
        shell: true,
      });
      const tgz = readdirSync(temp).find((n) => n.startsWith(`fontsource-variable-${fonte.pacote}-`) && n.endsWith('.tgz'));
      mkdirSync(join(temp, fonte.pacote), { recursive: true });
      // Caminhos RELATIVOS, com cwd: o tar do Git Bash lê 'C:' como endereço de máquina remota.
      execFileSync('tar', ['-xzf', tgz, '-C', fonte.pacote], { cwd: temp });
      const pacote = join(temp, fonte.pacote, 'package');

      const meta = JSON.parse(readFileSync(join(pacote, 'metadata.json'), 'utf8'));
      if (meta.license?.type !== 'OFL-1.1') {
        throw new Error(`${meta.family}: licença ${meta.license?.type} — não é a OFL que se esperava. Parei.`);
      }
      const faixas = JSON.parse(readFileSync(join(pacote, 'unicode.json'), 'utf8'));
      const { min, max } = meta.variable.wght;
      const escritas = ESCRITAS.filter((e) => meta.subsets.includes(e) && faixas[e]);

      const saida = join(DESTINO, fonte.id);
      rmSync(saida, { recursive: true, force: true });
      mkdirSync(saida, { recursive: true });
      copyFileSync(join(pacote, 'LICENSE'), join(saida, 'LICENCA.txt'));

      for (const escrita of escritas) {
        copyFileSync(join(pacote, 'files', `${meta.id}-${escrita}-wght-normal.woff2`), join(saida, `${escrita}.woff2`));
        css +=
          `@font-face {\n  font-family: 'Syden ${meta.family}';\n  src: url('/fontes/${fonte.id}/${escrita}.woff2') format('woff2');\n` +
          `  font-weight: ${min} ${max};\n  font-display: swap;\n  unicode-range: ${faixas[escrita]};\n}\n\n`;
      }
      console.log(`  ${meta.family.padEnd(20)} ${meta.license.type}  pesos ${min}–${max}  ${escritas.join(', ')}`);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  writeFileSync(
    join(RAIZ, 'web/src/fontesDaMarca.gerado.css'),
    '/* GERADO por scripts/baixar-fontes-da-marca.mjs — não edite à mão; rode o script de novo. */\n' +
      '/* As fontes da marca: Bricolage Grotesque (títulos) e Instrument Sans (texto). Variáveis: um arquivo\n' +
      '   por escrita cobre todos os pesos. */\n\n' +
      css,
  );
  console.log('\nPronto: web/public/fontes/{bricolage,instrument}/ e web/src/fontesDaMarca.gerado.css');
}
