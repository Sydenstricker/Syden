// A GUARDA DO MANIFESTO DO PACOTE DA STORE.
//
// ===================================================================================================
// POR QUE ELA EXISTE. A regra de firewall estava no lugar errado dentro do manifesto, e o resultado
// era o empacotador da Microsoft recusar o manifesto inteiro — **sem gerar .appx nenhum**. A 0.1.5
// não podia ser construída, e ninguém sabia.
//
// E O QUE ESCONDEU ISSO FOI UM AVISO NOSSO, CERTO, NO LUGAR ERRADO: o LEIA.md dizia que "um erro no
// fim da geração é esperado" — e é mesmo, o dos links simbólicos, que é inofensivo. Os dois terminam
// com a tela vermelha. Um aviso que manda ignorar erro ignora o erro errado também.
//
// Construir o pacote de verdade leva minutos e 163 MB, então não dá para ser teste. Mas as duas
// coisas que estavam erradas são LEGÍVEIS NO ARQUIVO, e é isso que esta guarda lê. Ela roda em
// milissegundos e falha com o motivo escrito.
//
//   node --test desktop/test/
// ===================================================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const manifesto = readFileSync(new URL('../build/appxmanifest.xml', import.meta.url), 'utf8');
const pacote = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** O trecho entre <Applications> e </Applications> — tudo o que é do APLICATIVO, e não do pacote. */
const dentroDeApplications = manifesto.slice(
  manifesto.indexOf('<Applications>'),
  manifesto.indexOf('</Applications>') + '</Applications>'.length,
);

describe('o manifesto do pacote da Microsoft Store', () => {
  it('a regra de firewall é filha de <Package>, e não de <Application>', () => {
    // ESTE ERA O DEFEITO. `windows.firewallRules` é extensão DE PACOTE. Dentro de <Application> o
    // manifesto fica inválido e NENHUM .appx é gerado — não é um aviso, é a construção falhando.
    assert.ok(manifesto.includes('windows.firewallRules'), 'a regra de firewall sumiu do manifesto');
    assert.ok(
      !dentroDeApplications.includes('windows.firewallRules'),
      'a regra de firewall voltou para dentro de <Application>. Ali o manifesto é inválido e o\n' +
        '  empacotador da Microsoft recusa com 0x80080204, sem gerar pacote nenhum.',
    );
  });

  it('a regra aponta para o executável DENTRO do pacote', () => {
    // O segundo defeito: dizia "Syden.exe", e o executável mora em "app\Syden.exe". Usar o próprio
    // ${executable} do electron-builder resolve de uma vez — é o mesmo valor que o <Application> usa,
    // então não há como um ficar para trás do outro quando o nome do produto mudar.
    const regra = /<desktop2:FirewallRules\s+Executable="([^"]+)"/.exec(manifesto);
    assert.ok(regra, 'não achei o Executable da regra de firewall');
    assert.equal(
      regra[1],
      '${executable}',
      'o caminho foi escrito à mão. Use ${executable}, que o electron-builder preenche com\n' +
        '  "app\\<Produto>.exe" — o mesmo valor do <Application>.',
    );
  });

  it('o namespace desktop2 é ignorável, para o Windows antigo não recusar o pacote', () => {
    // A MinVersion do pacote é a 10.0.14316 e o desktop2 só existe a partir da 10.0.17763. Sem o
    // IgnorableNamespaces, um Windows entre as duas não sabe o que é o bloco e pode recusar o pacote
    // inteiro; com ele, ignora o bloco e instala — a pessoa só volta a ver a pergunta do firewall.
    assert.match(manifesto, /IgnorableNamespaces="[^"]*desktop2/, 'falta desktop2 em IgnorableNamespaces');
    assert.ok(
      manifesto.includes('xmlns:desktop2="http://schemas.microsoft.com/appx/manifest/desktop/windows10/2"'),
      'falta declarar o namespace desktop2',
    );
  });

  it('o package.json aponta para este arquivo, e não para o modelo de dentro do node_modules', () => {
    assert.equal(
      pacote.build.appx.customManifestPath,
      'appxmanifest.xml',
      'sem isto o electron-builder usa o modelo dele, e a regra de firewall não entra no pacote',
    );
    assert.ok(
      pacote.build.appx.customExtensionsPath === undefined,
      'customExtensionsPath injeta dentro de <Application>, que é onde a regra NÃO pode ficar',
    );
  });

  it('os campos que o electron-builder preenche continuam todos lá', () => {
    // O manifesto é cópia do modelo do electron-builder. Perder um ${…} numa edição futura não daria
    // erro de construção: daria um pacote sem ícone, sem versão ou sem o idioma, e isso só apareceria
    // na certificação da Microsoft, dias depois.
    for (const campo of [
      'identityName',
      'arch',
      'publisher',
      'version',
      'displayName',
      'publisherDisplayName',
      'description',
      'logo',
      'resourceLanguages',
      'minVersion',
      'maxVersionTested',
      'capabilities',
      'applicationId',
      'executable',
      'backgroundColor',
      'square150x150Logo',
      'square44x44Logo',
      'extensions',
    ]) {
      assert.ok(manifesto.includes('${' + campo + '}'), `o campo \${${campo}} sumiu do manifesto`);
    }
  });
});
