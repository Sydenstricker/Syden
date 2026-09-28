/**
 * A conferência de imagens pelo Shield.
 *
 * NÃO TOCA NA REDE DE VERDADE. O `fetch` global é trocado por um falso, e é o certo por dois motivos:
 * mandar imagem de teste para um serviço de combate a abuso infantil a cada `npm test` seria abuso do
 * serviço deles, e um teste que depende da internet falha por motivo errado.
 *
 * O que se mede aqui é a DECISÃO — a parte em que um engano não dá erro nenhum e simplesmente deixa
 * passar o que deveria barrar.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

const fetchDeVerdade = globalThis.fetch;

/** Troca o fetch por um que responde o que o teste mandar, e conta quantas vezes foi chamado. */
function fingirResposta(corpo: unknown, status = 200) {
  const chamadas: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (url: string, opcoes: RequestInit) => {
    chamadas.push({ url: String(url), headers: (opcoes?.headers ?? {}) as Record<string, string> });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => corpo,
    } as Response;
  }) as typeof fetch;
  return chamadas;
}

/** O módulo guarda cache em memória; recarregá-lo a cada teste evita um teste contaminar o outro. */
async function carregarShield() {
  return (await import(`../src/shield.js?v=${Math.random()}`)) as typeof import('../src/shield.js');
}

const IMAGEM = Buffer.from('uma imagem qualquer, para o sha sair diferente a cada teste');

beforeEach(() => {
  process.env.SHIELD_USUARIO = 'syden';
  process.env.SHIELD_SENHA = 'segredo';
});

afterEach(() => {
  globalThis.fetch = fetchDeVerdade;
  delete process.env.SHIELD_USUARIO;
  delete process.env.SHIELD_SENHA;
});

describe('sem credencial', () => {
  it('fica desligado e não chama ninguém', async () => {
    delete process.env.SHIELD_USUARIO;
    delete process.env.SHIELD_SENHA;
    const chamadas = fingirResposta({});
    const shield = await carregarShield();

    const r = await shield.conferir(IMAGEM, 'image/png');
    assert.equal(r.veredito, 'desligado');
    assert.equal(chamadas.length, 0, 'mandou imagem para fora sem credencial configurada');
  });
});

describe('com credencial', () => {
  it('nada conhecido passa', async () => {
    fingirResposta({ classification: 'no-known-match', match_type: null, is_match: false });
    const shield = await carregarShield();
    assert.equal((await shield.conferir(IMAGEM, 'image/png')).veredito, 'limpo');
  });

  it('material conhecido é barrado', async () => {
    fingirResposta({ classification: 'csam', match_type: 'exact', is_match: true });
    const shield = await carregarShield();
    const r = await shield.conferir(IMAGEM, 'image/png');
    assert.equal(r.veredito, 'bloqueado');
    assert.equal(r.classificacao, 'csam');
    assert.equal(r.tipo, 'exact');
  });

  it('a semelhança também barra, e não só a cópia exata', async () => {
    // Recortar ou recomprimir uma imagem muda todos os bytes. Aceitar só o "exact" deixaria passar
    // qualquer versão levemente editada, que é justamente como esse material circula.
    fingirResposta({ classification: 'harmful-abusive-material', match_type: 'near', is_match: true });
    const shield = await carregarShield();
    assert.equal((await shield.conferir(IMAGEM, 'image/png')).veredito, 'bloqueado');
  });

  it('diante de resposta contraditória, barra', async () => {
    // "não conheço" junto com "é correspondência" não deveria existir. Se existir, o lado seguro de
    // errar é barrar — e o lado perigoso é o que uma leitura ingênua de is_match faria.
    fingirResposta({ classification: 'csam', match_type: null, is_match: false });
    const shield = await carregarShield();
    assert.equal((await shield.conferir(IMAGEM, 'image/png')).veredito, 'bloqueado');
  });

  it('manda a credencial em Basic, e para o endereço deles', async () => {
    const chamadas = fingirResposta({ classification: 'no-known-match', is_match: false });
    const shield = await carregarShield();
    await shield.conferir(IMAGEM, 'image/jpeg');

    assert.equal(chamadas[0].url, 'https://shield.projectarachnid.com/v1/media/');
    const esperado = 'Basic ' + Buffer.from('syden:segredo').toString('base64');
    assert.equal(chamadas[0].headers.authorization, esperado);
    assert.equal(chamadas[0].headers['content-type'], 'image/jpeg', 'o tipo tem de ser o real do arquivo');
  });
});

describe('quando o Shield está fora do ar', () => {
  it('erro de rede vira "indisponivel", e não uma exceção', async () => {
    globalThis.fetch = (async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as typeof fetch;
    const shield = await carregarShield();
    // Lançar aqui derrubaria o envio de um avatar por causa de um serviço de terceiro.
    assert.equal((await shield.conferir(IMAGEM, 'image/png')).veredito, 'indisponivel');
  });

  it('resposta 500 também', async () => {
    fingirResposta({}, 500);
    const shield = await carregarShield();
    assert.equal((await shield.conferir(IMAGEM, 'image/png')).veredito, 'indisponivel');
  });
});

describe('o cache', () => {
  it('a mesma imagem só é mandada uma vez', async () => {
    const chamadas = fingirResposta({ classification: 'no-known-match', is_match: false });
    const shield = await carregarShield();

    await shield.conferir(IMAGEM, 'image/png');
    await shield.conferir(IMAGEM, 'image/png');
    await shield.conferir(IMAGEM, 'image/png');

    assert.equal(chamadas.length, 1, 'reenviar a mesma foto a manda de novo para fora');
  });

  it('mas o bloqueio NÃO é respondido de memória', async () => {
    // Bloqueio é evento para registrar e olhar. Responder de cache esconderia a segunda tentativa, que
    // é exatamente a informação que interessa.
    const chamadas = fingirResposta({ classification: 'csam', is_match: true });
    const shield = await carregarShield();

    await shield.conferir(IMAGEM, 'image/png');
    await shield.conferir(IMAGEM, 'image/png');

    assert.equal(chamadas.length, 2);
  });

  it('imagens diferentes têm sha diferente', async () => {
    fingirResposta({ classification: 'no-known-match', is_match: false });
    const shield = await carregarShield();
    const a = await shield.conferir(Buffer.from('aaa'), 'image/png');
    const b = await shield.conferir(Buffer.from('bbb'), 'image/png');
    assert.notEqual(a.sha256, b.sha256);
    assert.equal(a.sha256.length, 64);
  });
});
