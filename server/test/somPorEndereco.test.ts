import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arquivoDoMyInstants, baixarSom, nomeDoSom } from '../src/buscarImagem.js';

// Este arquivo não abre banco nenhum e não sai para a rede: as recusas acontecem antes da conexão.

describe('som colado como endereço', () => {
  it('a página do MyInstants vira o endereço do arquivo, que é o que a Cloudflare deixa passar', () => {
    assert.equal(
      arquivoDoMyInstants('https://www.myinstants.com/pt/instant/acabou-49530/'),
      'https://www.myinstants.com/media/sounds/acabou.mp3',
    );
    assert.equal(
      arquivoDoMyInstants('https://myinstants.com/en/instant/vamo-sim-po-claro-12345'),
      'https://www.myinstants.com/media/sounds/vamo-sim-po-claro.mp3',
    );
  });

  it('o link do arquivo, e endereço de outro site, seguem como estão', () => {
    assert.equal(arquivoDoMyInstants('https://www.myinstants.com/media/sounds/rimshot.mp3'), null);
    assert.equal(arquivoDoMyInstants('https://exemplo.com/instant/acabou-1/'), null);
    // Nome parecido não é o site: só o domínio e os subdomínios dele.
    assert.equal(arquivoDoMyInstants('https://myinstants.com.golpe.net/instant/acabou-1/'), null);
  });

  it('o nome sugerido sai do endereço, sem extensão, número de página ou sufixo de repetido', () => {
    assert.equal(nomeDoSom('https://www.myinstants.com/media/sounds/vamo-sim-po-claro.mp3'), 'vamo sim po claro');
    assert.equal(nomeDoSom('https://www.myinstants.com/media/sounds/vinheta-xaropinho-rapaz_dx3f4Be.mp3'), 'vinheta xaropinho rapaz');
    assert.equal(nomeDoSom('https://www.myinstants.com/pt/instant/acabou-49530/'), 'acabou');
    assert.equal(nomeDoSom('não é endereço'), '');
  });

  it('as mesmas recusas da capa: sem http, sem a própria máquina', async () => {
    assert.equal(await baixarSom('http://www.myinstants.com/media/sounds/a.mp3', 1024), 'O endereço precisa começar com https://.');
    assert.equal(await baixarSom('https://127.0.0.1/som.mp3', 1024), 'Esse endereço não pode ser buscado.');
    assert.equal(await baixarSom('', 1024), 'Endereço inválido.');
  });
});
