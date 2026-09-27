/**
 * A divisão entre o que segue a pessoa e o que fica no aparelho.
 *
 * É a parte que erra calada. Subir um id de microfone não dá erro nenhum: a pessoa entra no outro
 * computador, o Syden tenta usar um dispositivo que não existe, e ela fica muda sem entender por quê.
 * E, do outro lado, esquecer uma chave faz a preferência simplesmente não viajar — também sem erro.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CHAVES_QUE_FICAM, CHAVES_QUE_SOBEM, aplicar, montar } from '../src/preferencias.js';

/** Um armazenamento de mentira, para os testes não dependerem de navegador. */
function armazenamento(inicial: Record<string, unknown> = {}) {
  const dados: Record<string, unknown> = { ...inicial };
  return {
    dados,
    ler: (chave: string) => dados[chave],
    escrever: (chave: string, valor: unknown) => {
      dados[chave] = valor;
    },
  };
}

describe('o que sobe e o que fica', () => {
  it('os ids de microfone, alto-falante e câmera NÃO sobem', () => {
    const { ler } = armazenamento({
      'janja.settings': { theme: 'light', audioInput: 'mic-desta-maquina', audioOutput: 'saida-1', videoInput: 'cam-3' },
    });
    const pacote = montar(ler) as { 'janja.settings': Record<string, unknown> };

    assert.equal(pacote['janja.settings'].theme, 'light');
    assert.equal(pacote['janja.settings'].audioInput, undefined);
    assert.equal(pacote['janja.settings'].audioOutput, undefined);
    assert.equal(pacote['janja.settings'].videoInput, undefined);
  });

  it('o que é estado desta máquina não entra no pacote', () => {
    const { ler } = armazenamento({
      'syden.coelho': 'big',
      'syden.community': 7,
      'syden.lidas': { 1: 99 },
      'syden.cenouras': 12,
    });
    const pacote = montar(ler);

    assert.equal(pacote['syden.coelho'], 'big');
    for (const chave of ['syden.community', 'syden.lidas', 'syden.cenouras']) {
      assert.equal(pacote[chave], undefined, `${chave} não devia subir`);
    }
  });

  it('nenhuma chave está nas duas listas ao mesmo tempo', () => {
    for (const chave of CHAVES_QUE_SOBEM) {
      assert.ok(!(CHAVES_QUE_FICAM as readonly string[]).includes(chave), `${chave} está nas duas listas`);
    }
  });

  it('ao aplicar, o dispositivo DESTA máquina é preservado', () => {
    // É o caso que justifica a regra: a pessoa acabou de escolher o microfone neste computador, e o
    // servidor manda um pacote feito em outro. O tema tem de vir; o microfone, não pode ir embora.
    const { ler, escrever, dados } = armazenamento({
      'janja.settings': { theme: 'dark', audioInput: 'mic-daqui', sounds: false },
    });

    aplicar({ 'janja.settings': { theme: 'light', sounds: true } }, ler, escrever);

    const agora = dados['janja.settings'] as Record<string, unknown>;
    assert.equal(agora.theme, 'light', 'o tema do servidor devia ter vindo');
    assert.equal(agora.sounds, true);
    assert.equal(agora.audioInput, 'mic-daqui', 'o microfone desta máquina foi apagado');
  });

  it('o que o servidor não manda não é apagado daqui', () => {
    const { ler, escrever, dados } = armazenamento({ 'syden.coelho': 'big', 'syden.idioma': 'en' });
    aplicar({ 'syden.idioma': 'es' }, ler, escrever);

    assert.equal(dados['syden.idioma'], 'es');
    assert.equal(dados['syden.coelho'], 'big', 'sumiu uma preferência que o servidor nem mencionou');
  });

  it('conta que nunca guardou nada não zera o que já existe aqui', () => {
    const { ler, escrever, dados } = armazenamento({ 'syden.coelho': 'big' });
    aplicar({}, ler, escrever);
    assert.equal(dados['syden.coelho'], 'big');
  });

  it('as anotações sobem: foi decisão, e o teste existe para ela ser deliberada', () => {
    // Se alguém remover 'syden.notas' da lista, este teste falha e obriga a decidir de novo — em vez
    // de a mudança passar como detalhe. O contrário também vale: enquanto isto sobe, a política de
    // privacidade tem de dizer que sobe.
    assert.ok((CHAVES_QUE_SOBEM as readonly string[]).includes('syden.notas'));
  });
});
