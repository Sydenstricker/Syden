// Compila o módulo de som (desktop/native) para a mesma versão do Electron que o app usa — um módulo
// nativo só carrega se tiver sido feito para o Node de dentro do Electron, que não é o Node do sistema.
//
// Uso: npm run build:native -w desktop (precisa das Ferramentas de Build do Visual Studio, com C++).
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const electronVersion = require('electron/package.json').version;
const nativeDir = path.join(__dirname, '..', 'native');

console.log(`Compilando o módulo de som para o Electron ${electronVersion}…`);
execFileSync(
  process.execPath,
  [
    require.resolve('node-gyp/bin/node-gyp.js'),
    'rebuild',
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
    '--arch=x64',
  ],
  { cwd: nativeDir, stdio: 'inherit' },
);
console.log('Pronto: native/build/Release/syden_audio.node');
