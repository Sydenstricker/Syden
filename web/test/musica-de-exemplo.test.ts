import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lerLetra, letraSemTempo } from '../src/lrc';

// AMOSTRA DE TESTE, E NÃO PRODUTO. Ver CLAUDE.md: o Syden não faz música própria. Este arquivo existe
// só para haver um áudio com letra sincronizada ao mexer no karaokê, e por isso mora em web/test/ e
// não em web/public/ — de web/public/ ele iria para o site publicado.
//
// Estes testes existem para
// uma coisa só: garantir que o arquivo gerado é lido pelo LEITOR DE VERDADE do Syden, e não por uma
// cópia da lógica dentro do teste.
//
// O risco que isto pega é o pior de um karaokê: letra que anda fora do tempo. Ninguém percebe olhando
// o .lrc — percebe cantando, na frente dos amigos.

const PASTA = new URL('./amostras/', import.meta.url);
const lrc = readFileSync(new URL('hoje-e-seu-dia.lrc', PASTA), 'utf8');
const wav = readFileSync(new URL('hoje-e-seu-dia.wav', PASTA));

test('o leitor do Syden entende a letra gerada', () => {
  const linhas = lerLetra(lrc);
  assert.equal(linhas.length, 16, 'as 16 linhas cantadas têm de aparecer');
  // Os cabeçalhos [ti:], [ar:] e [by:] não são letra e não podem virar linha na tela.
  assert.ok(!linhas.some((l) => /^(ti|ar|by):/.test(l.texto)), 'cabeçalho vazou para a letra');
  assert.equal(linhas[0].texto, 'Hoje o dia é seu');
  assert.equal(letraSemTempo(lrc).length, 16);
});

test('cada linha entra depois da anterior, e nenhuma antes da introdução', () => {
  const linhas = lerLetra(lrc);
  // A introdução tem dois compassos: cantar antes disso é cantar sem acompanhamento.
  assert.ok(linhas[0].em >= 3, `a primeira linha entra em ${linhas[0].em}s, antes da introdução acabar`);
  for (let i = 1; i < linhas.length; i++) {
    assert.ok(linhas[i].em > linhas[i - 1].em, `a linha ${i + 1} não vem depois da ${i}`);
  }
});

test('o compasso é regular: toda linha dura o mesmo tanto', () => {
  const linhas = lerLetra(lrc);
  const passos = linhas.slice(1).map((l, i) => l.em - linhas[i].em);
  const menor = Math.min(...passos);
  const maior = Math.max(...passos);
  // A música é escrita em linhas de 6 batidas iguais. Se uma linha destoar, foi erro de conta no
  // gerador — e o efeito seria a letra acendendo torta a partir dali até o fim.
  //
  // A folga é de 2 centésimos por causa do FORMATO, não da música: o .lrc guarda o tempo em
  // centésimos de segundo, e 6 batidas a 108 bpm dão 3,3333s. Ao arredondar, os intervalos alternam
  // entre 3,33 e 3,34. Exigir menos que isso seria exigir precisão que o formato não tem — e 10 ms
  // de diferença ninguém ouve. Erro de conta de verdade dá diferença de batida inteira, meio segundo.
  assert.ok(maior - menor < 0.02, `as linhas variam de ${menor.toFixed(2)}s a ${maior.toFixed(2)}s`);
});

test('a letra acaba antes do áudio, e não sobra silêncio demais no fim', () => {
  const linhas = lerLetra(lrc);
  // Duração real lida do cabeçalho do WAV, e não um número escrito à mão.
  const taxa = wav.readUInt32LE(24);
  const bytesPorAmostra = wav.readUInt16LE(34) / 8;
  const segundos = wav.readUInt32LE(40) / (taxa * bytesPorAmostra);

  const ultima = linhas[linhas.length - 1].em;
  assert.ok(ultima < segundos, `a última linha entra em ${ultima.toFixed(1)}s, depois do fim (${segundos.toFixed(1)}s)`);
  assert.ok(segundos - ultima < 8, `sobram ${(segundos - ultima).toFixed(1)}s de silêncio depois da última linha`);
});

test('o áudio é um WAV que o servidor aceita', () => {
  // server/src/media.ts reconhece áudio pelos bytes, não pela extensão: RIFF no começo e WAVE na
  // posição 8. Um cabeçalho errado só apareceria ao subir a música, com "isto não é um arquivo de áudio".
  assert.equal(wav.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString('latin1'), 'WAVE');
  assert.equal(wav.readUInt16LE(20), 1, 'tem de ser PCM sem compressão');
  assert.equal(wav.readUInt16LE(22), 1, 'mono');
  // O tamanho declarado no cabeçalho tem de bater com o arquivo. Quando não bate, alguns navegadores
  // tocam e outros não — o pior tipo de defeito, porque funciona na máquina de quem testou.
  assert.equal(wav.readUInt32LE(4), wav.length - 8, 'o tamanho no cabeçalho RIFF não bate com o arquivo');
  assert.equal(wav.readUInt32LE(40), wav.length - 44, 'o tamanho do bloco de dados não bate');
});

test('o áudio tem som, e não está saturado', () => {
  // Estas são as duas falhas de síntese que ninguém diagnostica de ouvido. Silêncio soa a "o arquivo
  // não carregou"; saturação soa a "meu fone está ruim". As duas se medem em dois laços.
  let pico = 0;
  let soma = 0;
  let colados = 0;
  const total = (wav.length - 44) / 2;
  for (let i = 0; i < total; i++) {
    const v = Math.abs(wav.readInt16LE(44 + i * 2)) / 32767;
    pico = Math.max(pico, v);
    soma += v * v;
    if (v > 0.995) colados++;
  }
  const rms = Math.sqrt(soma / total);

  assert.ok(rms > 0.02, `o áudio está praticamente silencioso (rms ${rms.toFixed(4)})`);
  assert.ok(pico > 0.5, `o pico é de só ${pico.toFixed(2)}: a música ficaria baixa demais`);
  assert.ok(pico < 1, 'o pico encostou no teto');
  // Amostras coladas no máximo são onde a onda foi cortada. Uma ou outra é arredondamento; muitas
  // são distorção, e distorção não fica mais alta, fica suja.
  assert.ok(colados < total / 10_000, `${colados} amostras cortadas no teto: o som está distorcido`);
});

test('a música caberia no limite de upload do karaokê, se alguém a subisse', () => {
  // O teto de server/src/karaoke-routes.ts é 12 MB. Esta música é servida como arquivo estático e não
  // passa por lá, mas se um dia passar, tem de caber — e a conta muda se alguém trocar a taxa.
  assert.ok(wav.length < 12 * 1024 * 1024, `${(wav.length / 1024 / 1024).toFixed(1)} MB passa do limite`);
});
