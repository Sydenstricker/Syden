import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeStats, taxaRedonda } from '../src/streamStats.js';

// ===================================================================================================
// O NÚMERO DE QUADROS NÃO PODE FAZER UMA TRANSMISSÃO SAUDÁVEL PARECER QUEBRADA.
//
// "Esses números quebrados, diferentes de 30/60, são lidos como 'tem algum erro na transmissão'."
// As duas telas que vieram com a reclamação — "360p · 14 fps" e "1080p · 29 fps" — eram as duas
// transmissões PERFEITAS: 14 é a camada de 15 e 29 é a de 30. A tela transformava funcionamento
// normal em suspeita de defeito.
//
// O que não pode acontecer é o contrário: arredondar tanto que um problema de verdade suma. Por isso
// os dois lados estão aqui, e a fronteira entre eles também.
// ===================================================================================================

const stats = (height: number, fps: number) =>
  ({ width: 0, height, fps, limitedBy: 'none', kbps: 0, codec: null, encoder: null, naPlaca: null, semPublico: false }) as const;

describe('a taxa que aparece na tela', () => {
  // Os dois casos exatos das telas que ele mandou.
  it('29 numa transmissão de 30 aparece como 30', () => assert.equal(taxaRedonda(29), 30));
  it('14 numa transmissão de 15 aparece como 15', () => assert.equal(taxaRedonda(14), 15));
  it('57 numa transmissão de 60 aparece como 60', () => assert.equal(taxaRedonda(57), 60));

  it('o número exato continua sendo ele mesmo', () => {
    assert.equal(taxaRedonda(15), 15);
    assert.equal(taxaRedonda(30), 30);
    assert.equal(taxaRedonda(60), 60);
  });

  // A OUTRA METADE, e é ela que impede isto de virar maquiagem: problema de verdade continua à vista.
  it('uma queda de verdade NÃO é arredondada para cima', () => {
    assert.equal(taxaRedonda(22), 22, '22 está longe demais de 30 para ser chamado de 30');
    assert.equal(taxaRedonda(8), 8, '8 está longe demais de 15');
    assert.equal(taxaRedonda(40), 40, '40 não é 60');
  });

  it('a fronteira é 10% abaixo do alvo, e ela é fechada', () => {
    assert.equal(taxaRedonda(27), 30, '27 é exatamente 90% de 30');
    assert.equal(taxaRedonda(26.9), 27, 'abaixo da tolerância, o número cru');
  });

  // Passar do alvo é outra coisa: 33 num alvo de 30 não é "30 com ruído", é medição estranha, e
  // inventar um 30 ali esconderia o que estiver acontecendo.
  it('acima do alvo, mostra o que mediu', () => {
    assert.equal(taxaRedonda(33), 33);
    assert.equal(taxaRedonda(64), 64);
  });
});

describe('a linha do formato', () => {
  it('junta tamanho e taxa já redonda', () => assert.equal(describeStats(stats(1080, 29)), '1080p · 30 fps'));
  it('4K tem nome, não número', () => assert.equal(describeStats(stats(2160, 59)), '4K · 60 fps'));
  // Antes da segunda medição não há taxa nenhuma, e um "0 fps" assustaria mais do que a ausência.
  it('sem taxa ainda, mostra só o tamanho', () => assert.equal(describeStats(stats(720, 0)), '720p'));
  it('sem imagem, não há o que dizer', () => assert.equal(describeStats(stats(0, 30)), null));
});
