import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { baixarImagem, enderecoInterno } from '../src/buscarImagem.js';

// ===================================================================================================
// PEDIR AO SERVIDOR QUE BUSQUE UM ENDEREÇO É DAR A ELE UMA ORDEM DE REDE.
//
// O servidor do Syden alcança coisas que a internet não alcança: o banco, o LiveKit, o endereço de
// metadados da nuvem. Sem as regras deste arquivo, colar `https://127.0.0.1:7880/algo` na caixa da
// capa faria o servidor ir lá buscar — e o resultado viraria a capa de uma comunidade.
//
// NADA AQUI SAI PARA A REDE. Todo caso abaixo é recusado ANTES da conexão, que é justamente o ponto:
// se um deles passar da recusa, o teste já falhou, independentemente do que houvesse do outro lado.
// ===================================================================================================

const LIMITE = 4096 * 1024;

/** Os testes conferem a RECUSA; nenhum endereço daqui é alcançado. */
const recusa = (url: string) => baixarImagem(url, LIMITE);

describe('endereços que o servidor não pode buscar', () => {
  it('a própria máquina, pelos três nomes', async () => {
    for (const url of ['https://127.0.0.1/a.gif', 'https://localhost/a.gif', 'https://[::1]/a.gif']) {
      assert.equal(await recusa(url), 'Esse endereço não pode ser buscado.', url);
    }
  });

  // 169.254.169.254 é o endereço de metadados das nuvens: ele entrega credenciais da máquina a quem
  // perguntar de dentro. É o alvo clássico deste tipo de falha.
  it('o endereço de metadados da nuvem', async () => {
    assert.equal(await recusa('https://169.254.169.254/latest/meta-data/'), 'Esse endereço não pode ser buscado.');
  });

  it('as redes privadas', async () => {
    for (const ip of ['10.0.0.5', '172.16.0.1', '172.31.255.254', '192.168.1.1', '100.64.0.1']) {
      assert.equal(await recusa(`https://${ip}/a.gif`), 'Esse endereço não pode ser buscado.', ip);
    }
  });

  // A PASSAGEM QUE SE ESQUECE: ::ffff:127.0.0.1 É o 127.0.0.1, escrito como IPv6. Sem desembrulhar,
  // ele escapa de todas as regras de IPv4.
  it('IPv4 enfiado dentro de IPv6', async () => {
    assert.equal(await recusa('https://[::ffff:127.0.0.1]/a.gif'), 'Esse endereço não pode ser buscado.');
    assert.equal(await recusa('https://[::ffff:10.0.0.1]/a.gif'), 'Esse endereço não pode ser buscado.');
  });

  it('rede local única e enlace local, em IPv6', async () => {
    for (const ip of ['[fc00::1]', '[fd12:3456::1]', '[fe80::1]']) {
      assert.equal(await recusa(`https://${ip}/a.gif`), 'Esse endereço não pode ser buscado.', ip);
    }
  });

  // RECUSAR DEMAIS TAMBÉM É DEFEITO. Esta conferência é direta, sem rede: feita por uma busca de
  // verdade, cada caso esperaria o tempo-limite, e um teste de vinte segundos é um teste que alguém
  // acaba pulando.
  it('a faixa privada do 172 é só de 16 a 31, e nem um a mais', () => {
    assert.equal(enderecoInterno('172.15.0.1'), false);
    assert.equal(enderecoInterno('172.16.0.1'), true);
    assert.equal(enderecoInterno('172.31.255.254'), true);
    assert.equal(enderecoInterno('172.32.0.1'), false);
  });

  it('endereço público de verdade passa', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '151.101.1.140', '[2606:4700::1]', '[::ffff:8.8.8.8]']) {
      assert.equal(enderecoInterno(ip), false, ip);
    }
  });
});

describe('endereços malformados', () => {
  it('http sem s é recusado: o conteúdo pode ser trocado no caminho', async () => {
    assert.equal(await recusa('http://exemplo.com/a.gif'), 'O endereço precisa começar com https://.');
  });

  it('outros protocolos também', async () => {
    assert.equal(await recusa('file:///etc/passwd'), 'O endereço precisa começar com https://.');
    assert.equal(await recusa('ftp://exemplo.com/a.gif'), 'O endereço precisa começar com https://.');
  });

  // Usuário e senha dentro do endereço servem para confundir quem lê
  // (https://media.giphy.com@malicioso.com/a.gif vai para malicioso.com).
  it('usuário e senha no endereço', async () => {
    assert.equal(await recusa('https://media.giphy.com@127.0.0.1/a.gif'), 'Endereço inválido.');
    assert.equal(await recusa('https://quem:senha@exemplo.com/a.gif'), 'Endereço inválido.');
  });

  it('coisa que não é endereço', async () => {
    for (const lixo of ['', '   ', 'não é endereço', undefined, null, 42, {}]) {
      assert.equal(await baixarImagem(lixo, LIMITE), 'Endereço inválido.', String(lixo));
    }
  });

  // Um nome que não existe não pode virar "pode buscar" por acidente: o DNS falha, e falha fechada.
  it('nome que não resolve é recusado, não aceito', async () => {
    const r = await recusa('https://nao-existe-mesmo-syden-teste.invalid/a.gif');
    assert.equal(r, 'Esse endereço não pode ser buscado.');
  });
});
