import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeStats, nitidezNaTela, taxaRedonda } from '../src/streamStats.js';

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

// ===================================================================================================
// O NÚMERO SOZINHO NÃO RESPONDE "ESTÁ RUIM?".
//
// "Diz que estou a 576p mas a qualidade está agradável. O número dá uma sensação de falta de
// qualidade." O número não está errado — é o que o navegador decodificou. Errado é ele aparecer sem
// o tamanho em que a imagem está sendo desenhada.
//
// Com adaptiveStream, o Syden PEDE a camada que cabe no quadro. Janela menor, número menor, e isso é
// o sistema funcionando. O mesmo 576p está sobrando num quadro de 540 e faltando em tela cheia num
// monitor 4K: número igual, resposta oposta. Por isso a conta é de RAZÃO.
// ===================================================================================================

/** Um elemento de mentira: só a altura importa, que é o que o navegador usa para escolher a camada. */
const quadro = (altura: number) => ({ clientHeight: altura }) as HTMLElement;

describe('nítida para o tamanho em que aparece', () => {
  it('576p num quadro de 540 está nítida — foi o caso do relato', () => {
    assert.equal(nitidezNaTela(stats(576, 30), quadro(540))?.nitida, true);
  });

  it('268p num quadro pequeno também está', () => {
    assert.equal(nitidezNaTela(stats(268, 30), quadro(270))?.nitida, true);
  });

  it('o MESMO 576p em tela cheia não está', () => {
    assert.equal(nitidezNaTela(stats(576, 30), quadro(1080))?.nitida, false);
  });

  it('a folga é de dez por cento, e nem um pouco mais', () => {
    assert.equal(nitidezNaTela(stats(900, 30), quadro(1000))?.nitida, true, '90% passa');
    assert.equal(nitidezNaTela(stats(880, 30), quadro(1000))?.nitida, false, '88% não passa');
  });

  it('sem imagem ou sem quadro, não há o que dizer', () => {
    assert.equal(nitidezNaTela(stats(0, 0), quadro(500)), null);
    assert.equal(nitidezNaTela(stats(720, 30), null), null);
    assert.equal(nitidezNaTela(null, quadro(500)), null);
    assert.equal(nitidezNaTela(stats(720, 30), quadro(0)), null, 'quadro ainda não medido');
  });

  it('diz de quantos pixels o quadro precisa, e não quantos ele tem de CSS', () => {
    assert.equal(nitidezNaTela(stats(720, 30), quadro(540))?.precisa, 540);
  });
});
