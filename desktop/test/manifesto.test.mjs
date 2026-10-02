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

  it('o fundo do ladrilho é transparente, e os ícones têm canal alfa para isso valer', () => {
    // O QUE ELE VIU: o coelho num quadrado preto, na barra de tarefas e no ladrilho. Não era defeito
    // de desenho — era `backgroundColor: "#1e1f22"`, que o Windows pinta ATRÁS do ícone. Os PNGs já
    // têm fundo transparente (tipo 6 = RGBA no cabeçalho), então quem estava pondo o preto era esta
    // linha, e só ela.
    assert.equal(
      pacote.build.appx.backgroundColor,
      'transparent',
      'o fundo do ladrilho voltou a ser uma cor sólida; ela aparece como quadrado atrás do coelho',
    );

    // Transparência pedida com ícone sem canal alfa não dá erro: dá o fundo da imagem, que é branco.
    for (const nome of ['Square44x44Logo', 'Square150x150Logo', 'Square310x310Logo', 'Square71x71Logo', 'StoreLogo', 'Wide310x150Logo']) {
      const png = readFileSync(new URL(`../build/appx/${nome}.png`, import.meta.url));
      assert.equal(png.readUInt32BE(0), 0x89504e47, `${nome}.png não é PNG`);
      assert.equal(png[25], 6, `${nome}.png não tem canal alfa (tipo de cor ${png[25]}), então o fundo transparente não vale`);
    }
  });

  it('os ícones SEM PLACA existem, nos quatro tamanhos que o Windows pede', () => {
    // `backgroundColor: "transparent"` resolve o LADRILHO e NÃO resolve a barra de tarefas. Ali o
    // Windows procura uma variante com o sufixo `_altform-unplated`; não achando, desenha o ícone
    // comum sobre uma placa opaca — o quadrado preto ao lado de apps cujos ícones flutuam.
    //
    // Estes arquivos são gerados por `node scripts/ladrilhos-da-loja.mjs`. Um apagado por engano não
    // quebra build nenhuma: volta a placa, e só se descobre com o pacote já publicado.
    for (const tamanho of [16, 24, 32, 48]) {
      const caminho = new URL(`../build/appx/Square44x44Logo.targetsize-${tamanho}_altform-unplated.png`, import.meta.url);
      const png = readFileSync(caminho);
      assert.equal(png.readUInt32BE(16), tamanho, `o ícone sem placa de ${tamanho} px está com outra largura`);
      assert.equal(png[25], 6, `o ícone sem placa de ${tamanho} px não tem canal alfa — ele existe justamente para ser transparente`);
    }
  });
});
