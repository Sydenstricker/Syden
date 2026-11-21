import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { algumJogoPausado, ARQUIVOS, criarMaestro, marcarPausaDoJogo, TRILHA_DO_JOGO, VOLUME, volumeDa, type Motor, type Trilha } from '../src/musicaDosJogos';
import { JOGOS } from '../src/minijogos';

/** Um motor falso: guarda o que toca agora e quanto tempo "passou" em cada trilha. */
function motorFalso() {
  const log: string[] = [];
  let tocando: { trilha: Trilha; de: number } | null = null;
  let passou = 0;
  const motor: Motor = {
    tocar(trilha, deS) {
      if (tocando) throw new Error('duas trilhas ao mesmo tempo');
      tocando = { trilha, de: deS };
      passou = 0;
      log.push(`tocar ${trilha} ${deS}`);
    },
    parar() {
      if (!tocando) throw new Error('parar sem tocar');
      const onde = tocando.de + passou;
      log.push(`parar ${tocando.trilha} ${onde}`);
      tocando = null;
      return onde;
    },
  };
  return { motor, log, andar: (s: number) => (passou += s), agora: () => tocando };
}

describe('a música dos jogos', () => {
  it('só toca quando pedida e permitida, e cala no mudo', () => {
    const m = motorFalso();
    let mudo = false;
    const maestro = criarMaestro(m.motor, () => !mudo);
    assert.equal(maestro.tocando(), null);
    maestro.pedir('corrida');
    assert.equal(m.agora()?.trilha, 'corrida');
    mudo = true;
    maestro.conferir();
    assert.equal(m.agora(), null);
    assert.equal(maestro.tocando(), null);
    // pedir de novo no mudo não toca
    maestro.pedir('corrida');
    assert.equal(m.agora(), null);
    mudo = false;
    maestro.conferir();
    assert.equal(m.agora()?.trilha, 'corrida');
  });

  it('uma trilha por vez: pedir outra troca, e o silêncio para', () => {
    const m = motorFalso();
    const maestro = criarMaestro(m.motor, () => true);
    maestro.pedir('corrida');
    maestro.pedir('jato'); // o motor falso lança se as duas tocassem juntas
    assert.equal(m.agora()?.trilha, 'jato');
    maestro.pedir('regata');
    assert.equal(m.agora()?.trilha, 'regata');
    maestro.pedir(null);
    assert.equal(m.agora(), null);
    assert.deepEqual(m.log, ['tocar corrida 0', 'parar corrida 0', 'tocar jato 0', 'parar jato 0', 'tocar regata 0', 'parar regata 0']);
  });

  it('a pausa (e a falta de foco) continua de onde parou; outro jogo começa do começo', () => {
    const m = motorFalso();
    let foco = true;
    const maestro = criarMaestro(m.motor, () => foco);
    maestro.pedir('corrida');
    m.andar(12);
    maestro.pedir(null); // a pausa
    maestro.pedir('corrida');
    assert.equal(m.log.at(-1), 'tocar corrida 12');
    m.andar(3);
    foco = false;
    maestro.conferir();
    foco = true;
    maestro.conferir();
    assert.equal(m.log.at(-1), 'tocar corrida 15');
    maestro.pedir('jato');
    assert.equal(m.log.at(-1), 'tocar jato 0');
    maestro.pedir('corrida');
    assert.equal(m.log.at(-1), 'tocar corrida 0');
  });

  it('a pausa comum dos jogos (20/11/2026): cada pausa aberta cala a música, e só a última fechada a devolve', () => {
    const a = {};
    const b = {};
    assert.equal(algumJogoPausado(), false);
    marcarPausaDoJogo(a, true);
    marcarPausaDoJogo(b, true);
    assert.equal(algumJogoPausado(), true);
    marcarPausaDoJogo(a, false);
    assert.equal(algumJogoPausado(), true, 'a outra continua pausada');
    marcarPausaDoJogo(b, false);
    marcarPausaDoJogo(b, false);
    assert.equal(algumJogoPausado(), false);
  });

  it('conferir sem mudança não mexe no motor', () => {
    const m = motorFalso();
    const maestro = criarMaestro(m.motor, () => true);
    maestro.pedir('jato');
    maestro.conferir();
    maestro.conferir();
    maestro.pedir('jato');
    assert.deepEqual(m.log, ['tocar jato 0']);
  });
});

describe('a trilha de cada jogo', () => {
  const pasta = new URL('../public/', import.meta.url);
  const leiaMe = readFileSync(new URL('musica/LEIA-ME.txt', pasta), 'utf8');

  it('todo arquivo existe e tem a origem no LEIA-ME', () => {
    for (const arquivo of Object.values(ARQUIVOS)) {
      assert.ok(existsSync(new URL(arquivo, pasta)), arquivo);
      assert.ok(leiaMe.includes(arquivo.replace('musica/', '')), `${arquivo} sem origem no LEIA-ME`);
    }
  });

  it('todo jogo da estante tem a sua decisão (trilha ou silêncio), menos os que pedem a deles por dentro', () => {
    const porDentro = new Set(['corrida', 'jato', 'barco', 'golfe']);
    for (const { id } of JOGOS) {
      if (porDentro.has(id)) assert.ok(!(id in TRILHA_DO_JOGO), id);
      else assert.ok(id in TRILHA_DO_JOGO, `${id} sem decisão de música`);
    }
    assert.ok('arena' in TRILHA_DO_JOGO);
  });

  it('onde a conversa é o jogo, silêncio; nas mesas, mais baixo', () => {
    for (const id of ['stop', 'lobisomem', 'desenho', 'palavra', 'truco', 'monstros', 'mitologia', 'paises']) {
      assert.equal(TRILHA_DO_JOGO[id], null, id);
    }
    for (const id of ['gomoku', 'mancala', 'damas', 'partida-de-xadrez', 'naval', 'domino']) {
      const trilha = TRILHA_DO_JOGO[id] as Trilha;
      assert.ok(trilha && volumeDa(trilha) < VOLUME, id);
    }
  });
});
