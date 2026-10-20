// Gera as declarações C++/WinRT que o módulo nativo usa para LER A FAIXA DE IDADE DO WINDOWS (native/src/idade.cpp).
//
// POR QUE GERAR, E NÃO GUARDAR NO REPOSITÓRIO. As funções (User.GetUserAgeRangeAsync e GetAgeVerificationStatusAsync)
// são novas: em 20/10/2026 não estavam em nenhum SDK do Windows instalável (o mais novo, 10.0.26100, não as tem), só na
// descrição que o PRÓPRIO Windows dos Insiders traz (C:\Windows\System32\WinMetadata). O cppwinrt do SDK gera as
// declarações a partir dela — 85 MB de cabeçalhos, que não cabem no git e saem iguais de novo em segundos.
//
// SEM AS FUNÇÕES NESTA MÁQUINA (Windows mais velho, ou sem o cppwinrt), o módulo compila do mesmo jeito, com a leitura
// desligada: idade-disponivel.h diz SYDEN_IDADE 0 e a função responde "sem-api". Nada quebra; só não lê.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const saida = path.join(__dirname, '..', 'native', 'gerado');
const marca = path.join(saida, 'idade-disponivel.h');
const metadados = 'C:\\Windows\\System32\\WinMetadata\\Windows.System.winmd';

function escrever(disponivel, porque) {
  fs.mkdirSync(saida, { recursive: true });
  fs.writeFileSync(marca, `// Gerado por desktop/scripts/gerar-winrt.js: ${porque}\n#define SYDEN_IDADE ${disponivel ? 1 : 0}\n`);
  console.log(`Idade pelo Windows: ${disponivel ? 'ligada' : 'desligada'} (${porque}).`);
}

/** O cppwinrt.exe do SDK mais novo instalado (o SDK pode morar fora do C:, como nesta máquina, no F:). */
function acharCppwinrt() {
  try {
    const raiz = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows Kits\\Installed Roots', '/v', 'KitsRoot10'], { encoding: 'utf8' })
      .match(/KitsRoot10\s+REG_SZ\s+(.+)/)?.[1]
      ?.trim();
    if (!raiz) return null;
    const bin = path.join(raiz, 'bin');
    const versoes = fs.readdirSync(bin).filter((v) => /^10\./.test(v)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const v of versoes.reverse()) {
      const exe = path.join(bin, v, 'x64', 'cppwinrt.exe');
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    // sem SDK no registro
  }
  return null;
}

if (!fs.existsSync(metadados) || !fs.readFileSync(metadados).includes('GetUserAgeRangeAsync')) {
  escrever(false, 'este Windows ainda não tem GetUserAgeRangeAsync');
} else {
  const cppwinrt = acharCppwinrt();
  if (!cppwinrt) {
    escrever(false, 'não achei o cppwinrt.exe do SDK do Windows');
  } else {
    fs.rmSync(path.join(saida, 'winrt'), { recursive: true, force: true });
    execFileSync(cppwinrt, ['-input', 'local', '-output', saida], { stdio: 'inherit' });
    escrever(true, 'gerado da descrição deste Windows, com o cppwinrt do SDK ' + path.basename(path.dirname(path.dirname(cppwinrt))));
  }
}
