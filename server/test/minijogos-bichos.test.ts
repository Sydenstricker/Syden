/**
 * Bichos da Toca (minijogo-bichos.ts, bichos-batalha.ts, bichos-regras.ts): a roda dos elementos, a conta do dano e da amizade,
 * a aventura de cada pessoa guardada no servidor (e levada no "Levar seus dados", e apagada com a conta), e a luta da sala entre
 * duas pessoas jogada pelo computador dos dois lados. O relógio e a sorte aqui são de mão.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarBichos, lerAventura } = await import('../src/minijogo-bichos.js');
const regras = await import('../src/bichos-regras.js');
const luta = await import('../src/bichos-batalha.js');
const db = await import('../src/db.js');
after(fechar);

const ana = await criarConta(app, 'ana-bichos');
const bia = await criarConta(app, 'bia-bichos');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

/** Uma sorte de mão: repete a lista em roda. */
const sorte = (...valores: number[]) => {
  let i = 0;
  return () => valores[i++ % valores.length];
};

function relogio() {
  let marcado: (() => void) | null = null;
  return {
    agendar: (_ms: number, depois: () => void) => (marcado = depois),
    disparar: () => {
      const f = marcado;
      marcado = null;
      f?.();
    },
  };
}

function comecar(ctxExtra: Record<string, unknown>, aleatorio: () => number, criadaPor: number) {
  const r = relogio();
  const fim = { terminou: false };
  const ctx = {
    agendar: r.agendar,
    avisar: () => {},
    terminar: () => (fim.terminou = true),
    naSala: () => [anaId, biaId],
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    ...ctxExtra,
  };
  const jogo = criarBichos({ aleatorio }).comecar(ctx as never, { naSala: [criadaPor], criadaPor, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return { jogo, r, fim, estado: (id: number) => jogo.publico(id) as Record<string, any> };
}

test('as duas cópias das regras são iguais', () => {
  const site = readFileSync(new URL('../../web/src/bichos/regras.ts', import.meta.url));
  const servidor = readFileSync(new URL('../src/bichos-regras.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/bichos/regras.ts e server/src/bichos-regras.ts mudaram separados: copie uma sobre a outra');
});

test('os nomes dos golpes estão marcados para a tradução no site (web/src/bichos/desenho.ts, NOMES_DOS_GOLPES)', () => {
  const desenho = readFileSync(new URL('../../web/src/bichos/desenho.ts', import.meta.url), 'utf8');
  const lista = desenho.match(/NOMES_DOS_GOLPES = \[([\s\S]*?)\];/)![1];
  const marcados = [...lista.matchAll(/chave\('([^']+)'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(marcados, Object.values(regras.GOLPES).map((g) => g.nome).sort());
});

test('a roda dos elementos: cada um vence dois, e quem vence não perde para o mesmo', () => {
  for (const e of regras.ELEMENTOS) {
    assert.equal(regras.VENCE[e].length, 2, e);
    for (const outro of regras.VENCE[e]) {
      assert.equal(regras.eficacia(e, outro), 2);
      assert.equal(regras.eficacia(outro, e), 0.5);
    }
    assert.equal(regras.eficacia(e, e), 1);
    assert.equal(regras.eficacia('nenhum', e), 1);
  }
  // as três do começo fazem um triângulo
  assert.equal(regras.eficacia('folha', 'gota'), 2);
  assert.equal(regras.eficacia('gota', 'brasa'), 2);
  assert.equal(regras.eficacia('brasa', 'folha'), 2);
});

test('os dados batem: golpes, desenhos, evolução e o mapa', () => {
  for (const [id, e] of Object.entries(regras.ESPECIES)) {
    for (const [, g] of e.aprende) assert.ok(regras.GOLPES[g], `${id} aprende ${g}, que não existe`);
    if (e.evolui) assert.ok(regras.ESPECIES[e.evolui.para]);
    assert.ok(regras.golpesDe(id, 1).length >= 1, `${id} não sabe nada no nível 1`);
    assert.ok(regras.golpesDe(id, 50).length <= 4);
  }
  for (const m of Object.values(regras.MATOS)) for (const e of m.especies) assert.ok(regras.ESPECIES[e].taxa > 0, `${e} no mato sem amizade`);
  assert.equal(regras.MAPA.length, regras.ALTURA_DO_MAPA);
  for (const linha of regras.MAPA) assert.equal(linha.length, regras.LARGURA_DO_MAPA);
  assert.ok(regras.andavel(regras.CASA.x, regras.CASA.y));
  assert.equal(regras.MAPA.join('').split('h').length - 1, 1);
  assert.equal(regras.MAPA.join('').split('c').length - 1, 1);
});

test('o dano: o elemento dobra e corta pela metade, e o nível pesa', () => {
  const a = luta.lutador('bolhim', 10);
  const dino = luta.lutador('dinito', 10);
  const cacto = luta.lutador('cardao', 10);
  const naBrasa = regras.dano(a, dino, 'chuva', 1);
  const naFolha = regras.dano(a, cacto, 'chuva', 1);
  assert.ok(naBrasa > naFolha * 2.5, `${naBrasa} contra ${naFolha}`);
  assert.ok(regras.dano(luta.lutador('bolhim', 30), dino, 'chuva', 1) > naBrasa);
  assert.ok(regras.dano(a, dino, 'chuva', 0) < naBrasa, 'a sorte tira até 15%');
});

test('a chance de amizade sobe quando o bicho está cansado, e os da Nena não fazem amizade', () => {
  const cheio = regras.chanceDeAmizade('zunzi', 20, 20);
  const cansado = regras.chanceDeAmizade('zunzi', 1, 20);
  assert.ok(cansado > cheio * 2.5);
  assert.ok(cansado <= 0.95 && cheio >= 0.05);
  assert.equal(regras.chanceDeAmizade('dragolim', 1, 20), 0);
});

test('a luta por turnos: o mais rápido bate primeiro, quem dorme não age, e a troca forçada vem antes do turno seguinte', () => {
  const b = luta.novaBatalha([luta.lutador('tisco', 12), luta.lutador('bolhim', 5)], [luta.lutador('rochim', 3)]);
  const ev = luta.turno(b, [{ tipo: 'golpe', i: 0 }, { tipo: 'golpe', i: 0 }], () => 0.5);
  assert.equal(ev[0].t, 'golpe');
  assert.equal((ev[0] as { lado: number }).lado, 0, 'o Tisco é mais rápido');
  // até o fim, pelo computador dos dois lados
  let voltas = 0;
  while (b.vencedor === null && voltas++ < 200) {
    const e0 = b.lados[0].precisaTrocar || !b.lados[1].precisaTrocar ? luta.escolhaDoRobo(b, 0, Math.random) : null;
    const e1 = b.lados[1].precisaTrocar || !b.lados[0].precisaTrocar ? luta.escolhaDoRobo(b, 1, Math.random) : null;
    luta.turno(b, [e0, e1], Math.random);
  }
  assert.equal(b.vencedor, 0);
  assert.equal(luta.conferirEscolha(b, 0, { tipo: 'trocar', i: 0 }), 'Escolha inválida.', 'trocar para o mesmo não vale');
});

test('a Nena é um desafio: com quatro bichos no nível 11 se ganha, com o primeiro sozinho quase nunca (o computador dos dois lados)', () => {
  const vitorias = (equipe: [string, number][], vezes = 200) => {
    let v = 0;
    for (let k = 0; k < vezes; k++) {
      const b = luta.novaBatalha(equipe.map(([e, n]) => luta.lutador(e, n)), regras.EQUIPE_DO_DESAFIO.map(([e, n]) => luta.lutador(e, n)));
      for (let g = 0; b.vencedor === null && g < 300; g++) {
        const e0 = b.lados[0].precisaTrocar || !b.lados[1].precisaTrocar ? luta.escolhaDoRobo(b, 0, Math.random) : null;
        const e1 = b.lados[1].precisaTrocar || !b.lados[0].precisaTrocar ? luta.escolhaDoRobo(b, 1, Math.random) : null;
        luta.turno(b, [e0, e1], Math.random);
      }
      if (b.vencedor === 0) v++;
    }
    return v / vezes;
  };
  assert.ok(vitorias([['bolhim', 11], ['dinito', 9], ['rochim', 9], ['vultim', 9]]) > 0.8);
  assert.ok(vitorias([['bolhim', 12]]) < 0.25);
});

test('a aventura no Solo: o primeiro bicho, o mato, a vitória com experiência, a amizade e tudo guardado no servidor', () => {
  // sorte 0: o mato sempre dá bicho (o primeiro da lista, no nível mais baixo), o golpe sempre é o primeiro
  const p = comecar({ solo: true, naSala: () => [anaId] }, sorte(0), anaId);
  assert.equal(p.estado(anaId).fase, 'inicial');
  assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: 'c' }), 'Escolha o primeiro bicho.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'inicial', especie: 'dragolim' }), 'Escolha o primeiro bicho.', 'só os três do começo');
  assert.equal(p.jogo.acao(anaId, { tipo: 'inicial', especie: 'bolhim' }), null);
  assert.equal((lerAventura(db.aventuraDosBichos(anaId)) as any).equipe[0].especie, 'bolhim', 'guardado na hora');

  // da frente de casa (3,14) até o mato baixo: três à direita e três para cima, em (6,11)
  for (const d of ['d', 'd', 'd', 'c', 'c', 'c']) assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: d }), null);
  let e = p.estado(anaId);
  assert.equal(e.fase, 'batalha', `no mato (${e.x},${e.y})`);
  assert.equal(e.luta.outro.equipe[0].especie, 'zunzi');
  assert.ok(e.eventos.some((x: any) => x.t === 'apareceu'));
  assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: 'c' }), 'Ação inválida.', 'na luta não se anda');

  // bate até ele dormir
  let n = 0;
  while (!p.estado(anaId).luta.acabou && n++ < 30) assert.equal(p.jogo.acao(anaId, { tipo: 'golpe', i: 1 }), null);
  e = p.estado(anaId);
  assert.equal(e.luta.acabou, 'vitoria');
  assert.ok(e.equipe[0].xpDoNivel > 0, 'ganhou experiência');
  assert.equal(p.jogo.acao(anaId, { tipo: 'continuar' }), null);
  assert.equal(p.estado(anaId).fase, 'mapa');

  // outro bicho, e a cenoura (sorte 0: a amizade sempre dá certo)
  assert.equal(p.jogo.acao(anaId, { tipo: 'andar', dir: 'd' }), null);
  e = p.estado(anaId);
  assert.equal(e.fase, 'batalha');
  const cenouras = e.cenouras;
  assert.equal(p.jogo.acao(anaId, { tipo: 'cenoura' }), null);
  e = p.estado(anaId);
  assert.equal(e.luta.acabou, 'amigo');
  assert.equal(e.equipe.length, 2);
  assert.equal(e.equipe[1].especie, 'zunzi');
  assert.equal(e.cenouras, cenouras - 1);
  p.jogo.acao(anaId, { tipo: 'continuar' });

  // pôr o novo na frente, e tudo no banco
  assert.equal(p.jogo.acao(anaId, { tipo: 'frente', i: 1 }), null);
  const guardada = lerAventura(db.aventuraDosBichos(anaId))!;
  assert.deepEqual(guardada.equipe.map((b) => b.especie), ['zunzi', 'bolhim']);

  // a partida sai da memória e volta igual
  p.jogo.parar?.();
  const outra = comecar({ solo: true, naSala: () => [anaId] }, sorte(0.99), anaId);
  assert.equal(outra.estado(anaId).fase, 'mapa');
  assert.equal(outra.estado(anaId).equipe.length, 2);
  // a da outra pessoa é outra
  const daBia = comecar({ solo: true, naSala: () => [biaId] }, sorte(0.99), biaId);
  assert.equal(daBia.estado(biaId).fase, 'inicial');
});

test('a cenoura recusada dá a vez ao bicho, e a fuga que não deu também', () => {
  // a aventura volta de onde parou, em (7,11), no mato; um passo para o mato ao lado, e o bicho aparece (0, 0, 0); a cenoura é
  // recusada (0,99) e a fuga também
  const q = comecar({ solo: true, naSala: () => [anaId] }, sorte(0, 0, 0, 0.99), anaId);
  assert.equal(q.jogo.acao(anaId, { tipo: 'andar', dir: 'e' }), null);
  assert.equal(q.estado(anaId).fase, 'batalha');
  assert.equal(q.jogo.acao(anaId, { tipo: 'cenoura' }), null);
  let e = q.estado(anaId);
  assert.ok(e.eventos.some((x: any) => x.t === 'recusou'));
  assert.ok(e.eventos.some((x: any) => x.t === 'golpe' && x.lado === 1), 'o bicho do mato agiu');
  assert.equal(e.luta.acabou, null);
  assert.equal(q.jogo.acao(anaId, { tipo: 'fugir' }), null);
  e = q.estado(anaId);
  assert.ok(e.eventos.some((x: any) => x.t === 'naoFugiu'));
  assert.equal(q.jogo.acao(anaId, { tipo: 'continuar' }), 'A luta ainda não acabou.');
});

test('o "Levar seus dados" leva a aventura, e excluir a conta a apaga', async () => {
  const pacote = (await comToken(app, ana.token)('GET', '/api/me/dados')).json();
  assert.ok(pacote.conta.bichosDaToca, 'a aventura está no arquivo');
  assert.ok(pacote.conta.bichosDaToca.equipe.length >= 1);
  db.deleteAccount(anaId);
  assert.equal(db.aventuraDosBichos(anaId), null);
});

test('na sala: a mesa, a equipe guardada ou a emprestada, os dois escolhendo, e o troféu do vencedor', () => {
  const p = comecar({ solo: false, comunidade: 7 }, Math.random, biaId);
  assert.equal(p.estado(biaId).fase, 'esperando');
  assert.equal(p.jogo.acao(biaId, { tipo: 'golpe', i: 0 }), 'Espere alguém sentar do outro lado.');
  const caio = 999_999; // alguém sem aventura nenhuma
  assert.equal(p.jogo.acao(caio, { tipo: 'sentar' }), null);
  let e = p.estado(biaId);
  assert.equal(e.fase, 'escolhendo');
  assert.equal(e.lugares[1].emprestada, true, 'quem não tem bicho luta com a equipe emprestada');
  assert.equal(e.lados[1].equipe.length, 3);
  assert.ok(e.lados[0].equipe[0].golpes, 'quem é dono vê os golpes');
  assert.equal(e.lados[1].equipe[0].golpes, undefined, 'e não os do outro');
  assert.equal(p.jogo.acao(12345, { tipo: 'golpe', i: 0 }), 'Você está assistindo esta partida.');

  // os dois lados pelo computador, até o fim
  let voltas = 0;
  while (p.estado(biaId).fase === 'escolhendo' && voltas++ < 400) {
    // o prazo: quem não escolheu joga pelo computador
    if (voltas % 3 === 0) {
      p.r.disparar();
      continue;
    }
    for (const id of [biaId, caio]) {
      const v = p.estado(id);
      if (v.precisaEscolher) {
        const lado = v.meuLado;
        // escolhe um golpe válido do próprio bicho (ou troca, se precisa)
        const meu = v.lados[lado];
        const escolha = meu.precisaTrocar
          ? { tipo: 'trocar', i: meu.equipe.findIndex((x: any, i: number) => x.pv > 0 && i !== meu.ativo) }
          : { tipo: 'golpe', i: 0 };
        assert.equal(p.jogo.acao(id, escolha), null, JSON.stringify(escolha));
      }
    }
  }
  e = p.estado(biaId);
  assert.equal(e.fase, 'fim');
  assert.ok(p.fim.terminou);
  assert.ok([biaId, caio].includes(e.vencedor));
  if (e.vencedor === biaId) assert.ok(db.trofeusDe(biaId).some((t) => t.pista === 'bichos'));
});

test('na sala, quem sai no meio perde', () => {
  let naSala = [biaId, anaId];
  const p = comecar({ solo: false, comunidade: 7, naSala: () => naSala }, Math.random, biaId);
  p.jogo.acao(anaId, { tipo: 'sentar' });
  naSala = [biaId];
  p.jogo.conferir?.();
  assert.equal(p.estado(biaId).vencedor, biaId);
});
