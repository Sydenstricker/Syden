import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avancar,
  criarParticulas,
  DURACAO_MS,
  juntar,
  quantasCabem,
  TETO_DE_PARTICULAS,
  type Particula,
} from '../src/efeitosVisuais';

// Um sorteio previsível: sem ele, cada rodada do teste veria números diferentes e uma falha de vez em
// quando seria impossível de reproduzir.
function sorteioFixo(valor = 0.5) {
  return () => valor;
}

/** Roda o efeito até o fim, como o navegador faria, e diz quantos quadros levou. */
function rodarAteAcabar(particulas: Particula[], largura = 1280, altura = 720) {
  let atuais = particulas;
  let quadros = 0;
  // Teto de segurança bem acima do esperado: se estourar, é porque o efeito não termina.
  while (atuais.length > 0 && quadros < 2000) {
    atuais = avancar(atuais, 1 / 60, largura, altura, sorteioFixo(0.3));
    quadros++;
  }
  return { sobraram: atuais.length, quadros };
}

test('todo efeito termina sozinho, e nenhum passa muito do tempo prometido', () => {
  for (const id of ['confete', 'fogos', 'coracoes'] as const) {
    const { sobraram, quadros } = rodarAteAcabar(criarParticulas(id, 1280, 720, 140, sorteioFixo(0.3)));
    assert.equal(sobraram, 0, id + ' nunca terminou: ficaria desenhando por cima da chamada para sempre');
    // Em segundos, com folga: o que não pode é um efeito de cinco segundos durar meio minuto.
    const segundos = quadros / 60;
    assert.ok(segundos <= DURACAO_MS / 1000 + 2, id + ' durou ' + segundos.toFixed(1) + 's, tempo demais');
  }
});

test('o confete cai, e o coração sobe', () => {
  const confete = criarParticulas('confete', 1280, 720, 10, sorteioFixo(0.3));
  const coracoes = criarParticulas('coracoes', 1280, 720, 10, sorteioFixo(0.3));
  assert.ok(confete.every((p) => p.vy > 0), 'confete precisa descer');
  assert.ok(coracoes.every((p) => p.vy < 0), 'coração precisa subir');
});

test('o confete que passa do pé da tela volta pelo alto, para a chuva não acabar antes da hora', () => {
  const [papel] = criarParticulas('confete', 1280, 720, 1, sorteioFixo(0.3));
  const quase = { ...papel, y: 719, vy: 1200 };
  const [depois] = avancar([quase], 1 / 30, 1280, 720, sorteioFixo(0.3));
  assert.ok(depois.y < 0, 'devia ter voltado para cima da tela, e está em ' + depois.y);
});

test('a faísca que sai da tela é jogada fora em vez de ser calculada para sempre', () => {
  const fora: Particula = {
    x: 2000,
    y: 300,
    vx: 400,
    vy: 0,
    giro: 0,
    giroPasso: 0,
    tamanho: 3,
    cor: '#fff',
    formato: 'faisca',
    vida: 50,
    gravidade: 0,
    estouraEm: 0,
  };
  assert.equal(avancar([fora], 1 / 60, 1280, 720, sorteioFixo()).length, 0);
});

test('o foguete vira faíscas e some no lugar delas', () => {
  const [foguete] = criarParticulas('fogos', 1280, 720, 240, sorteioFixo(0.3));
  assert.ok(foguete.estouraEm > 0, 'foguete precisa ter hora de estourar');

  // Um passo grande o bastante para passar da hora do estouro.
  const depois = avancar([foguete], foguete.estouraEm + 0.01, 1280, 720, sorteioFixo(0.3));
  assert.ok(depois.length > 1, 'devia ter virado várias faíscas, e virou ' + depois.length);
  assert.ok(
    depois.every((p) => p.estouraEm === 0),
    'faísca não estoura de novo: seria uma bomba que se multiplica sem fim',
  );
});

test('cinco pessoas clicando junto não passam do teto de partículas', () => {
  let naTela: Particula[] = [];
  for (let pessoa = 0; pessoa < 5; pessoa++) {
    const novas = criarParticulas('confete', 1280, 720, quantasCabem(naTela.length, 140), sorteioFixo(0.3));
    naTela = juntar(naTela, novas);
  }
  assert.ok(naTela.length <= TETO_DE_PARTICULAS, 'passou do teto: ' + naTela.length);
});

test('com a tela cheia, o clique novo entra e o mais velho é quem sai', () => {
  const velhas = criarParticulas('confete', 1280, 720, TETO_DE_PARTICULAS, sorteioFixo(0.3));
  const novas = criarParticulas('coracoes', 1280, 720, quantasCabem(velhas.length, 140), sorteioFixo(0.9));
  const juntas = juntar(velhas, novas);
  assert.equal(juntas.length, TETO_DE_PARTICULAS);
  assert.ok(
    juntas.filter((p) => p.formato === 'coracao').length === novas.length,
    'o efeito de quem clicou por último tem que estar inteiro na tela',
  );
});

test('mesmo com a tela cheia, quem clica vê alguma coisa', () => {
  assert.ok(quantasCabem(TETO_DE_PARTICULAS, 140) >= 12, 'efeito pedido tem que aparecer, nem que seja pequeno');
});
