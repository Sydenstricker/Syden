import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APERTO_INICIAL, LEVE_INICIAL, describeStats, motivoDoAperto, nextQuality, proximaParada, proximoAperto, proximoFluido, proximoLeve, reducaoNoLeve, telaEmMovimento, resumoDoAperto, taxaRedonda } from '../src/streamStats.js';

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

// ===================================================================================================
// "BANDA" QUE É O TETO DA VERSÃO (12/11/2026). O Chrome diz 'bandwidth' também quando a versão bate no teto de taxa dela,
// com a internet sobrando. O diário de 11/11 culpava a internet com 26 Mbps estimados, e a otimização dinâmica encolhia a
// imagem e não a devolvia nunca (medido: 540p → 180p → 135p → 90p, e parado lá).
// ===================================================================================================
describe('a banda que é o teto', () => {
  it('com a internet estimada acima da soma dos tetos, o aperto é o teto', () => {
    assert.equal(motivoDoAperto('bandwidth', 26034, 800), 'teto');
    assert.equal(motivoDoAperto('bandwidth', 6800, 6800), 'teto');
  });
  it('abaixo dela, é a internet; e os outros motivos passam como vieram', () => {
    assert.equal(motivoDoAperto('bandwidth', 5397, 7800), 'bandwidth');
    assert.equal(motivoDoAperto('bandwidth', null, 7800), 'bandwidth');
    assert.equal(motivoDoAperto('cpu', 26034, 800), 'cpu');
    assert.equal(motivoDoAperto('none', 26034, 800), 'none');
  });
  it('o teto não encolhe a imagem, e não segura a volta ao tamanho cheio', () => {
    const encolhida = { step: 1, comfortable: 0 };
    assert.deepEqual(nextQuality({ step: 0, comfortable: 0 }, { fps: 15, limitedBy: 'teto' }), { step: 0, comfortable: 0 });
    let q = encolhida;
    for (let i = 0; i < 3; i++) q = nextQuality(q, { fps: 30, limitedBy: 'teto' });
    assert.equal(q.step, 0, 'três medições boas com o teto e a imagem volta');
    assert.equal(nextQuality({ step: 0, comfortable: 0 }, { fps: 15, limitedBy: 'bandwidth' }).step, 1, 'a internet de verdade ainda encolhe');
  });
  it('o diário diz "pelo teto da versão", e é um motivo à parte', () => {
    const linha = resumoDoAperto({ motivo: 'teto', segundos: 12, largura: 427, altura: 240, fps: 29, kbps: 816, estimativaKbps: 26034, codec: 'VP8', naPlaca: false, modo: 'Padrão' });
    assert.ok(linha.startsWith('apertada há 12 s pelo teto da versão · sai 427×240'), linha);
    let a = APERTO_INICIAL;
    const registros: string[] = [];
    for (const m of ['teto', 'teto', 'teto', 'bandwidth', 'bandwidth', 'bandwidth'] as const) {
      const r = proximoAperto(a, m, true);
      a = r.aperto;
      if (r.registrar) registros.push(a.motivo!);
    }
    assert.deepEqual(registros, ['teto', 'bandwidth']);
  });
});

// O DEGRAU LEVE (12/11/2026): o notebook que não dá conta de 1080p a 30 passa a 720p, até 15 quadros, segurando a nitidez.
describe('o degrau leve do Padrão', () => {
  const passos = (motivos: Parameters<typeof proximoLeve>[1][]) => motivos.reduce((l, m) => proximoLeve(l, m, true, false), LEVE_INICIAL);

  it('dois apertos seguidos do processador ligam o leve', () => assert.equal(passos(['cpu', 'cpu']).ligado, true));
  it('a internet apertando também', () => assert.equal(passos(['bandwidth', 'bandwidth']).ligado, true));
  it('um aperto só não liga', () => assert.equal(passos(['cpu', 'none', 'cpu']).ligado, false));
  it('o teto da versão não é falta de máquina: não liga', () => assert.equal(passos(['teto', 'teto', 'teto']).ligado, false));
  it('sem medida (ninguém assistindo), nada muda', () => assert.deepEqual(proximoLeve(LEVE_INICIAL, 'cpu', false, false), LEVE_INICIAL));
  it('seis folgas seguidas desligam', () => assert.equal(passos(['cpu', 'cpu', 'none', 'none', 'none', 'none', 'none', 'none']).ligado, false));
  it('um aperto no meio das folgas recomeça a conta', () =>
    assert.equal(passos(['cpu', 'cpu', 'none', 'none', 'none', 'cpu', 'none', 'none', 'none']).ligado, true));
  it('apertou de novo depois de voltar: fica até o fim', () => {
    const l = passos(['cpu', 'cpu', ...Array(6).fill('none'), 'cpu', 'cpu', ...Array(20).fill('none')]);
    assert.equal(l.ligado, true);
    assert.equal(l.vezes, 2);
  });
  it('a versão de 1080 vai a 720, e a de 540 continua 540', () => {
    assert.equal(1080 / reducaoNoLeve(1, 1080), 720);
    assert.equal(1080 / reducaoNoLeve(2, 1080), 540);
  });
  it('captura de 1440 também chega a 720', () => assert.equal(1440 / reducaoNoLeve(1, 1440), 720));

  // O jogador não é quem o leve ajuda: jogo pesado aperta o processador, mas a tela dele muda o tempo todo.
  const comTela = (medidas: [Parameters<typeof proximoLeve>[1], boolean][]) => medidas.reduce((l, [m, mov]) => proximoLeve(l, m, true, mov), LEVE_INICIAL);
  it('o jogo apertando o processador NÃO liga o leve', () => assert.equal(comTela([['cpu', true], ['cpu', true], ['cpu', true], ['cpu', true]]).ligado, false));
  it('jogo: a tela mudando 30 vezes por segundo é movimento', () => assert.equal(telaEmMovimento(30, false), true));
  it('Configurações com o cursor: 4 mudanças por segundo não é', () => assert.equal(telaEmMovimento(4, false), false));
  it('a janela que o app reconhece como jogo é sempre movimento', () => assert.equal(telaEmMovimento(2, true), true));
  it('dentro do leve a medida bate no teto de 15: 14 já é movimento', () => assert.equal(telaEmMovimento(14, false, true), true));
  it('dentro do leve, o cursor piscando continua parado', () => assert.equal(telaEmMovimento(3, false, true), false));
  it('sem a medida, conta como movimento (na dúvida, o jogador)', () => assert.equal(telaEmMovimento(null, false), true));
  it('uma rolagem no meio dos apertos recomeça a conta', () => assert.equal(comTela([['cpu', false], ['cpu', true], ['cpu', false]]).ligado, false));
  it('abriu o jogo dentro do leve: duas medições em movimento tiram dele', () => {
    const l = comTela([['cpu', false], ['cpu', false], ['cpu', true], ['cpu', true]]);
    assert.equal(l.ligado, false);
  });
  it('uma medição em movimento só (rolou a página) não tira', () => assert.equal(comTela([['cpu', false], ['cpu', false], ['cpu', true], ['cpu', false]]).ligado, true));
  it('o jogo tira até quem já ficaria até o fim', () => {
    const dentro = comTela([['cpu', false], ['cpu', false], ...Array(6).fill(['none', false]), ['cpu', false], ['cpu', false]]);
    assert.equal(dentro.vezes, 2);
    assert.equal(proximoLeve(proximoLeve(dentro, 'cpu', true, true), 'cpu', true, true).ligado, false);
  });
});
