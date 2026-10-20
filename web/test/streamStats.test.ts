import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APERTO_INICIAL, describeStats, proximaParada, proximoAperto, proximoFluido, resumoDoAperto, taxaRedonda } from '../src/streamStats.js';

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

// O Fluido que não aguenta os 60 cai para 30 sozinho — antes era um aviso com botão, e o problema
// (que só quem assiste vê) ficava por conta de quem transmite.
describe('o Fluido cai para 30 quando não aguenta', () => {
  const inicio = { apertos: 0, em30: false };
  const apertado = { fps: 38, limitedBy: 'cpu' as const };

  it('três medições apertadas seguidas derrubam; duas não', () => {
    const duas = proximoFluido(proximoFluido(inicio, apertado), apertado);
    assert.equal(duas.em30, false);
    assert.equal(proximoFluido(duas, apertado).em30, true);
  });

  it('uma medição boa no meio zera a conta: um soluço não derruba', () => {
    const duas = proximoFluido(proximoFluido(inicio, apertado), apertado);
    const folga = proximoFluido(duas, { fps: 58, limitedBy: 'none' });
    assert.deepEqual(folga, inicio);
  });

  it('quadros baixos SEM aperto não derrubam: é tela parada, não máquina fraca', () => {
    let estado = inicio;
    for (let i = 0; i < 5; i++) estado = proximoFluido(estado, { fps: 12, limitedBy: 'none' });
    assert.equal(estado.em30, false);
  });

  it('depois de cair, não volta a subir', () => {
    const caiu = { apertos: 3, em30: true };
    assert.equal(proximoFluido(caiu, { fps: 60, limitedBy: 'none' }).em30, true);
  });
});

// A tela parada pede nitidez (a pendência "Texto borrado"): site e planilha legíveis, sem ninguém
// precisar escolher um modo. O que importa aqui é a folga — sem ela, um jogo com pausa ficaria
// alternando entre nítido e fluido o tempo todo.
describe('a tela parada pede nitidez', () => {
  const inicio = { paradas: 0, nitida: false };
  const nitida = { paradas: 2, nitida: true };

  it('duas medições paradas seguidas ligam a nitidez; uma não', () => {
    const uma = proximaParada(inicio, 1);
    assert.equal(uma.nitida, false, 'uma pausa curta num jogo não troca nada');
    assert.equal(proximaParada(uma, 0).nitida, true);
  });

  it('tela totalmente parada (zero quadros) também conta como parada', () => {
    assert.equal(proximaParada(proximaParada(inicio, 0), 0).nitida, true);
  });

  it('sem medida (ninguém assistindo, primeira medição) não muda nada', () => {
    assert.deepEqual(proximaParada(inicio, null), inicio);
    assert.deepEqual(proximaParada(nitida, null), nitida);
  });

  it('voltar ao movimento é na hora: uma medição com quadros basta', () => {
    assert.deepEqual(proximaParada(nitida, 25), inicio);
  });

  it('entre parada e movimento, quem está nítido continua nítido (a folga)', () => {
    assert.deepEqual(proximaParada(nitida, 8), nitida);
  });

  it('aperto conta como movimento: um jogo estrangulado não fica preso na nitidez', () => {
    assert.deepEqual(proximaParada(nitida, 6, true), inicio);
    assert.equal(proximaParada(proximaParada(inicio, 2, true), 2, true).nitida, false);
  });
});

// ===================================================================================================
// A TRANSMISSÃO APERTADA VAI PARA O DIÁRIO (20/10/2026): "está toda embaçada" sem os números de quem transmitia
// não tinha como ser respondido. Três medições apertadas seguidas, pelo mesmo motivo, dão UMA linha; o mesmo motivo
// não se repete na mesma transmissão, e tela sem ninguém assistindo (nada codificando) não conta.
// ===================================================================================================
describe('o aperto registrado', () => {
  const contar = (amostras: [string, boolean][]) => {
    let a = APERTO_INICIAL;
    const registros: string[] = [];
    for (const [motivo, codificando] of amostras) {
      const r = proximoAperto(a, motivo as 'cpu' | 'bandwidth' | 'none', codificando);
      a = r.aperto;
      if (r.registrar) registros.push(a.motivo!);
    }
    return registros;
  };

  it('três medições apertadas seguidas dão uma linha, e só uma', () => {
    assert.deepEqual(contar([['bandwidth', true], ['bandwidth', true], ['bandwidth', true], ['bandwidth', true], ['bandwidth', true]]), ['bandwidth']);
  });
  it('um soluço não registra; voltar ao normal zera a conta', () => {
    assert.deepEqual(contar([['bandwidth', true], ['bandwidth', true], ['none', true], ['bandwidth', true], ['bandwidth', true]]), []);
  });
  it('trocar de motivo recomeça a conta, e o outro motivo também é registrado', () => {
    assert.deepEqual(contar([['cpu', true], ['cpu', true], ['cpu', true], ['bandwidth', true], ['bandwidth', true], ['bandwidth', true]]), ['cpu', 'bandwidth']);
  });
  it('sem ninguém assistindo, nada conta', () => {
    assert.deepEqual(contar([['bandwidth', false], ['bandwidth', false], ['bandwidth', false]]), []);
  });
  it('a linha diz o motivo, o tamanho, a taxa, a estimativa e o codec, e cabe nos 200', () => {
    const linha = resumoDoAperto({ motivo: 'bandwidth', segundos: 12, largura: 640, altura: 360, fps: 29.4, kbps: 610, estimativaKbps: 900, codec: 'VP8', naPlaca: false, modo: 'Padrão' });
    assert.equal(linha, 'apertada há 12 s pela internet · sai 640×360 a 29 fps, 610 kbps (a internet estima 900) · VP8 pelo processador · Padrão');
    assert.ok(linha.length <= 200);
  });
});
