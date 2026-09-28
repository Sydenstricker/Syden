/**
 * De quem se baixa o áudio numa sala grande.
 *
 * O que mais importa aqui é a primeira suíte: **sala pequena não pode mudar em nada**. Uma
 * otimização feita para cinquenta pessoas que introduza meio segundo de atraso numa roda de seis
 * amigos teria piorado o Syden para resolver um problema que ele ainda não tem.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMIAR, TETO_DE_VOZES, lembrarFalantes, quemOuvir, queroEstaFaixa } from '../src/quemOuvir.js';

const sala = (quantos: number) => Array.from({ length: quantos }, (_, i) => ({ id: `p${i}` }));
const ids = (conjunto: Set<string>) => [...conjunto].sort();

describe('sala pequena continua exatamente como era', () => {
  it('todo mundo é ouvido, mesmo ninguém tendo falado', () => {
    const gente = sala(6);
    assert.deepEqual(ids(quemOuvir(gente, [])), ids(new Set(gente.map((p) => p.id))));
  });

  it('vale até um a menos que o limiar', () => {
    const gente = sala(LIMIAR - 1);
    assert.equal(quemOuvir(gente, []).size, LIMIAR - 1);
  });

  it('sala vazia não estoura', () => {
    assert.equal(quemOuvir([], []).size, 0);
  });
});

describe('sala grande ouve os que falam', () => {
  const gente = sala(50);

  it('não passa do teto de vozes', () => {
    assert.equal(quemOuvir(gente, ['p30', 'p31', 'p32']).size, TETO_DE_VOZES);
  });

  it('quem falou mais recentemente entra primeiro', () => {
    const ouvidos = quemOuvir(gente, ['p40', 'p41']);
    assert.ok(ouvidos.has('p40'));
    assert.ok(ouvidos.has('p41'));
  });

  it('sala grande e calada: ouve alguém, e não ninguém', () => {
    // Entrar numa sala silenciosa e não ouvir a primeira pessoa que abrir a boca seria pior do que
    // o problema que tudo isto resolve.
    assert.equal(quemOuvir(gente, []).size, TETO_DE_VOZES);
  });

  it('quem já saiu da sala não ocupa vaga', () => {
    const ouvidos = quemOuvir(sala(20), ['fantasma', 'p1']);
    assert.ok(!ouvidos.has('fantasma'));
    assert.ok(ouvidos.has('p1'));
  });
});

describe('a escolha de quem usa vence a regra automática', () => {
  it('um preferido é ouvido mesmo calado numa sala cheia', () => {
    const gente = sala(50);
    const falantes = ['p10', 'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18'];
    const ouvidos = quemOuvir(gente, falantes, new Set(['p49']));
    assert.ok(ouvidos.has('p49'), 'a pessoa escolhida a dedo deixou de ser ouvida');
    assert.equal(ouvidos.size, TETO_DE_VOZES);
  });

  it('preferido que nem está na sala não gasta vaga', () => {
    const ouvidos = quemOuvir(sala(50), ['p1'], new Set(['quem-saiu']));
    assert.ok(!ouvidos.has('quem-saiu'));
    assert.equal(ouvidos.size, TETO_DE_VOZES);
  });
});

describe('a memória de quem falou', () => {
  it('quem fala agora vai para a frente da fila', () => {
    assert.deepEqual(lembrarFalantes(['b', 'c'], ['a']), ['a', 'b', 'c']);
  });

  it('quem volta a falar sobe, sem aparecer duas vezes', () => {
    assert.deepEqual(lembrarFalantes(['a', 'b', 'c'], ['c']), ['c', 'a', 'b']);
  });

  it('a memória tem fim, senão cresceria para sempre', () => {
    const muitos = Array.from({ length: 40 }, (_, i) => `p${i}`);
    assert.equal(lembrarFalantes(muitos, ['novo'], 10).length, 10);
  });

  it('ninguém falando não apaga a memória', () => {
    // É isto que impede a fala cortada na pausa para respirar: silêncio não é motivo para esquecer.
    assert.deepEqual(lembrarFalantes(['a', 'b'], []), ['a', 'b']);
  });
});

describe('qual faixa baixar', () => {
  const vozes = new Set(['10', '11']);
  const assistindo = new Set(['20']);

  it('microfone segue a regra de quem ouvir', () => {
    assert.equal(queroEstaFaixa('microfone', '10', vozes, assistindo), true);
    assert.equal(queroEstaFaixa('microfone', '99', vozes, assistindo), false);
  });

  it('tela e som da tela só descem para quem abriu a transmissão', () => {
    assert.equal(queroEstaFaixa('tela', '20', vozes, assistindo), true);
    assert.equal(queroEstaFaixa('som-da-tela', '20', vozes, assistindo), true);
    assert.equal(queroEstaFaixa('tela', '10', vozes, assistindo), false);
    assert.equal(queroEstaFaixa('som-da-tela', '10', vozes, assistindo), false);
  });

  it('a câmera NÃO é cortada de quem está calado', () => {
    // Cortar a câmera de quem não fala é visível na hora: o rosto da pessoa congela ou apaga no meio
    // da conversa. O adaptiveStream do LiveKit já resolve o custo do vídeo de outra forma.
    assert.equal(queroEstaFaixa('camera', '99', vozes, assistindo), true);
  });

  it('assistir alguém não faz baixar a voz dele por essa via', () => {
    // A voz de quem se assiste desce porque ele entra em "preferidos" na conta de quemOuvir, e não por
    // uma exceção aqui. Duas portas para a mesma coisa é como se esquece de fechar uma delas.
    assert.equal(queroEstaFaixa('microfone', '20', vozes, assistindo), false);
  });
});
