/**
 * O Tabuleiro da turma, o que entrou em 19/11/2026 (minijogo-tabuleiro-da-turma.ts): as bifurcações, os itens e a loja, o
 * escudo, o duelo, o formato do microjogo pela cor das casas, a reta final, os prêmios bônus e os robôs usando tudo isso. O
 * relógio e o sorteio aqui são de mão, como em minijogos-tabuleiro-da-turma.test.ts.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const mod = await import('../src/minijogo-tabuleiro-da-turma.js');
const festa = await import('../src/minijogo-festa.js');
const { criarTabuleiro, CASAS, CENOURAS_INICIAIS } = mod;
after(fechar);

let agora = 19_000_000;
let sorte = 0.5;
const aleatorio = () => sorte;

const ana = await criarConta(app, 'ana-tab2');
const bia = await criarConta(app, 'bia-tab2');
const caio = await criarConta(app, 'caio-tab2');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do tabuleiro 2' })).json() as { id: number };

type Participante = { userId: number; pos: number; cenouras: number; douradas: number; itens: string[] };
type Estado = {
  fase: string;
  rodada: number;
  vez: number | null;
  dourada: number;
  retaFinal: boolean;
  participantes: Participante[];
  ultimo: { dado: number; dados: number[]; escolhido: boolean; caminho: number[]; efeito: { tipo: string; valor?: number } | null } | null;
  usado: { userId: number; item: string; alvo?: number; casa?: number } | null;
  compra: string | null;
  duelo: { de: number; contra: number | null; vencedor: number | null; valor: number } | null;
  premios: { tipo: string; ganhadores: number[]; valor: number }[] | null;
  mini: { fase: string; microjogo: string; inscritos: number[]; formato: string; equipes: number[][] | null } | null;
};

function comecar(opcoes: Parameters<typeof criarTabuleiro>[0] = {}, inicio = [anaId, biaId], corpo: Record<string, unknown> = {}, solo = false) {
  const sala = { ids: [...inicio] };
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => sala.ids,
    nome: (id: number) => String(id),
    comunidade: comunidade.id,
    solo,
  };
  const jogo = criarTabuleiro({ agora: () => agora, aleatorio, ...opcoes }).comecar(ctx as never, { naSala: inicio, criadaPor: inicio[0], corpo });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    sala,
    estado: (quem = anaId) => jogo.publico(quem) as unknown as Estado,
    andar() {
      const r = relogio[0];
      agora += r.ms;
      r.depois();
    },
  };
}
const de = (e: Estado, id: number) => e.participantes.find((p) => p.userId === id)!;

test('as bifurcações: as casas dos ramais vêm depois da volta, e cada ramal volta à volta', () => {
  const { RAMAIS, VOLTA, TODAS_AS_CASAS, INICIO_DOS_RAMAIS, proximaCasa, distancia } = mod;
  assert.equal(VOLTA, 30);
  assert.equal(TODAS_AS_CASAS.length, VOLTA + RAMAIS.reduce((s, r) => s + r.casas.length, 0));
  for (const [k, r] of RAMAIS.entries()) {
    // o ramal tem o tamanho do trecho que ele pula
    assert.equal(r.casas.length, r.ate - r.de - 1);
    assert.equal(proximaCasa(r.de), r.de + 1);
    assert.equal(proximaCasa(r.de, true), INICIO_DOS_RAMAIS[k]);
    assert.equal(proximaCasa(INICIO_DOS_RAMAIS[k] + r.casas.length - 1), r.ate);
    assert.equal(distancia(r.de, r.ate, true), distancia(r.de, r.ate, false));
  }
  assert.equal(proximaCasa(VOLTA - 1), 0);
  assert.ok(CASAS.includes('$') && CASAS.includes('d'), 'a loja e o duelo estão na volta');
});

test('na bifurcação, quem anda escolhe o caminho; sem resposta, segue a volta', () => {
  sorte = 0.5;
  const m = comecar({ itensIniciais: ['escolhido'], dourada: 20 });
  assert.equal(m.jogo.acao(anaId, { tipo: 'usar', item: 'escolhido', valor: 7 }), 'Escolha de 1 a 6.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'usar', item: 'escolhido', valor: 6 }), null);
  let e = m.estado();
  assert.equal(e.fase, 'caminho');
  assert.equal(de(e, anaId).pos, 5);
  assert.equal(e.ultimo!.escolhido, true);
  assert.equal(m.jogo.acao(biaId, { tipo: 'caminho', ramal: true }), 'Espere a sua vez.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'caminho', ramal: true }), null);
  e = m.estado();
  assert.equal(de(e, anaId).pos, mod.INICIO_DOS_RAMAIS[0], 'entrou no ramal');
  assert.deepEqual(e.ultimo!.caminho, [5, mod.INICIO_DOS_RAMAIS[0]]);
  assert.deepEqual(de(e, anaId).itens, [], 'o item foi gasto');
  // sem resposta: segue a volta
  const m2 = comecar({ itensIniciais: ['escolhido'], dourada: 20 });
  m2.jogo.acao(anaId, { tipo: 'usar', item: 'escolhido', valor: 6 });
  m2.andar();
  assert.equal(de(m2.estado(), anaId).pos, 6);
});

test('o escudo segura a perda da casa de −3, e não se usa à mão', () => {
  sorte = 0.5;
  const m = comecar({ itensIniciais: ['escolhido', 'escudo'], dourada: 20 });
  assert.equal(m.jogo.acao(anaId, { tipo: 'item', item: 'escudo' }), 'A partida não está em andamento.', 'fora da loja não se compra');
  assert.equal(m.jogo.acao(anaId, { tipo: 'usar', item: 'escudo' }), 'O escudo funciona sozinho.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'usar', item: 'ima' }), 'Você não tem esse item.');
  m.jogo.acao(anaId, { tipo: 'usar', item: 'escolhido', valor: 3 });
  const e = m.estado();
  assert.deepEqual(e.ultimo!.efeito, { tipo: 'escudo' });
  assert.equal(de(e, anaId).cenouras, CENOURAS_INICIAIS);
  assert.deepEqual(de(e, anaId).itens, []);
});

test('a loja de itens: parar nela deixa comprar (gasta cenouras); sem resposta, não compra', () => {
  sorte = 0.5;
  const m = comecar({ itensIniciais: ['escolhido'], dourada: 20, cenourasIniciais: 30 });
  m.jogo.acao(anaId, { tipo: 'usar', item: 'escolhido', valor: 6 });
  m.jogo.acao(anaId, { tipo: 'caminho', ramal: false }); // na casa 6 (+3)
  m.andar();
  m.jogo.acao(biaId, { tipo: 'dado' });
  while (m.estado().fase !== 'vez') m.andar();
  const antes = de(m.estado(), anaId).cenouras;
  sorte = 0.01; // o dado 1: 6 → 7, a loja
  m.jogo.acao(anaId, { tipo: 'dado' });
  sorte = 0.5;
  let e = m.estado();
  assert.equal(CASAS[7], '$');
  assert.equal(de(e, anaId).pos, 7);
  assert.equal(e.fase, 'itens');
  assert.equal(m.jogo.acao(biaId, { tipo: 'item', item: 'ima' }), 'Espere a sua vez.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'item', item: 'ima' }), null);
  e = m.estado();
  assert.equal(e.compra, 'ima');
  assert.deepEqual(de(e, anaId).itens, ['ima']);
  assert.equal(de(e, anaId).cenouras, antes - mod.PRECOS_DOS_ITENS.ima);
  assert.equal(m.jogo.acao(anaId, { tipo: 'item', item: 'duplo' }), 'A partida não está em andamento.', 'uma compra só');
});

test('os itens na vez: o ímã, o dado duplo e a troca de lugar (um por vez)', () => {
  sorte = 0.5;
  const m = comecar({ itensIniciais: ['duplo', 'ima'], dourada: 20 });
  assert.equal(m.jogo.acao(anaId, { tipo: 'usar', item: 'ima' }), null);
  let e = m.estado();
  assert.equal(e.dourada, mod.IMA_CASAS, 'a dourada veio para 4 casas à frente');
  assert.equal(e.usado!.item, 'ima');
  assert.equal(m.jogo.acao(anaId, { tipo: 'usar', item: 'duplo' }), 'Um item por vez.');
  const m2 = comecar({ itensIniciais: ['troca', 'duplo'], dourada: 20 });
  m2.jogo.acao(anaId, { tipo: 'usar', item: 'duplo' }); // 4 + 4: para na bifurcação
  e = m2.estado();
  assert.deepEqual(e.ultimo!.dados, [4, 4]);
  assert.equal(e.ultimo!.dado, 8);
  m2.jogo.acao(anaId, { tipo: 'caminho', ramal: false });
  assert.equal(de(m2.estado(), anaId).pos, 8);
  m2.andar();
  assert.equal(m2.jogo.acao(biaId, { tipo: 'usar', item: 'troca', alvo: biaId }), 'Escolha com quem trocar.');
  assert.equal(m2.jogo.acao(biaId, { tipo: 'usar', item: 'troca', alvo: anaId }), null);
  e = m2.estado();
  assert.equal(de(e, biaId).pos, 8);
  assert.equal(de(e, anaId).pos, 0);
  assert.equal(e.fase, 'vez', 'e ainda joga o dado');
});

test('o duelo: quem para escolhe alguém, os dois jogam um microjogo de dois, e quem ganha leva cenouras do outro', () => {
  sorte = 0.5;
  const m = comecar({ itensIniciais: ['duplo'], dourada: 20, duelos: ['relogio'] }, [anaId, biaId, caioId]);
  assert.equal(m.estado().vez, anaId);
  sorte = 0.99; // 6 + 6 = 12, a casa do duelo
  m.jogo.acao(anaId, { tipo: 'usar', item: 'duplo' });
  m.jogo.acao(anaId, { tipo: 'caminho', ramal: false });
  sorte = 0.5;
  let e = m.estado();
  assert.equal(de(e, anaId).pos, 12);
  assert.equal(CASAS[12], 'd');
  assert.equal(e.fase, 'duelo');
  assert.equal(m.jogo.acao(anaId, { tipo: 'duelo', contra: anaId }), 'Escolha alguém da partida.');
  assert.equal(m.jogo.acao(anaId, { tipo: 'duelo', contra: biaId }), null);
  e = m.estado();
  assert.equal(e.fase, 'duelo-jogo');
  assert.deepEqual(e.mini!.inscritos, [anaId, biaId]);
  assert.equal(e.mini!.microjogo, 'relogio');
  assert.equal(m.jogo.acao(caioId, { tipo: 'resultado', t: 10_000 }), 'Você está assistindo esta partida.', 'o Caio só assiste');
  m.andar(); // começa
  agora += 10_000;
  m.jogo.acao(anaId, { tipo: 'resultado', t: 10_000 });
  m.jogo.acao(biaId, { tipo: 'resultado', t: 2000 }); // não vale
  e = m.estado();
  assert.equal(e.duelo!.vencedor, anaId);
  assert.equal(e.duelo!.valor, mod.DUELO);
  assert.equal(de(e, biaId).cenouras, CENOURAS_INICIAIS - mod.DUELO);
  assert.equal(de(e, anaId).cenouras, CENOURAS_INICIAIS + mod.DUELO);
  m.andar(); // a revelação acaba: a vez passa
  e = m.estado();
  assert.equal(e.fase, 'vez');
  assert.notEqual(e.vez, anaId);
});

test('o formato do microjogo pela cor das casas: 2 contra 2, 1 contra 3 ou todos contra todos', () => {
  const { formatoDaRodada, MICROJOGOS_2X2, MICROJOGOS_1X3 } = mod;
  assert.deepEqual(formatoDaRodada([1, 2, 3, 4], [0, 1, 0, 1]), { formato: '2x2', equipes: [[1, 3], [2, 4]] });
  assert.deepEqual(formatoDaRodada([1, 2, 3, 4], [1, 1, 0, 1]), { formato: '1x3', equipes: [[3], [1, 2, 4]] });
  assert.deepEqual(formatoDaRodada([1, 2, 3, 4], [0, 0, 1, 0]), { formato: '1x3', equipes: [[3], [1, 2, 4]] });
  assert.equal(formatoDaRodada([1, 2, 3, 4], [0, 0, 0, 0]).formato, 'todos');
  assert.equal(formatoDaRodada([1, 2, 3], [0, 1, 0]).formato, 'todos');
  for (const id of [...MICROJOGOS_2X2, ...MICROJOGOS_1X3]) assert.ok(festa.microjogoDe(id).equipes, `${id} é de equipe`);
  // as equipes impostas valem na rodada
  const r = festa.rodadaDeFesta({
    ctx: { agendar: () => {}, avisar: () => {}, naSala: () => [1, 2, 3, 4], nome: (id) => `p${id}` },
    microjogo: 'colheita',
    inscritos: [1, 2, 3, 4],
    agora: () => 0,
    aleatorio: () => 0.5,
    pontos: [10, 6, 4, 2],
    aoAcabar: () => {},
    equipes: [[1, 3], [2, 4]],
  });
  assert.deepEqual(r.publico(1).equipes, [[1, 3], [2, 4]]);
  r.parar();
});

test('a reta final: o aviso antes, e as casas valem o dobro nas 3 últimas rodadas; os prêmios bônus no fim', () => {
  sorte = 0.5;
  const m = comecar({ dourada: 25, microjogos: Array(10).fill('relogio') }, [anaId, biaId], { rodadas: 5 });
  let viuReta = false;
  let dobro = false;
  let premios = false;
  let voltas = 0;
  while (m.estado().fase !== 'fim' && voltas++ < 800) {
    const e = m.estado();
    if (e.fase === 'reta') {
      assert.equal(e.rodada, 3);
      assert.equal(e.retaFinal, true);
      viuReta = true;
    }
    if (e.rodada < 3) assert.equal(e.retaFinal, false);
    const ef = e.ultimo?.efeito;
    if (e.retaFinal && e.fase === 'andando' && ef && ef.tipo === 'mais') {
      assert.equal(ef.valor, mod.GANHO * 2);
      dobro = true;
    }
    if (e.fase === 'minijogo' && e.mini!.fase === 'jogando' && e.mini!.microjogo === 'relogio') {
      // a Ana ganha todos os microjogos
      agora += 10_000;
      m.jogo.acao(anaId, { tipo: 'resultado', t: 10_000 });
      m.jogo.acao(biaId, { tipo: 'resultado', t: 1 });
      continue;
    }
    if (e.fase === 'premios' && !premios) {
      assert.equal(e.premios!.length, 3);
      const micro = e.premios!.find((p) => p.tipo === 'microjogos')!;
      assert.deepEqual(micro.ganhadores, [anaId]);
      assert.equal(micro.valor, 5);
      premios = true;
    }
    m.andar();
  }
  const e = m.estado();
  assert.equal(e.fase, 'fim');
  assert.ok(viuReta, 'o aviso da reta final');
  assert.ok(dobro, 'uma casa de ganhar valeu o dobro');
  assert.ok(premios, 'os prêmios apareceram');
  assert.ok(de(e, anaId).douradas >= 1, 'a Ana levou pelo menos o prêmio dos microjogos');
});

test('no Solo, os robôs jogam a partida inteira (itens, caminhos, loja, duelos), sem troféu', async () => {
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  let s = 7;
  const sorteio = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const m = comecar({ aleatorio: sorteio, cenourasIniciais: 30, itensIniciais: ['duplo', 'ima', 'escolhido'] }, [anaId], { rodadas: 5, robos: 3 }, true);
  assert.equal(m.estado().participantes.length, 4);
  let voltas = 0;
  const viu = new Set<string>();
  while (m.estado().fase !== 'fim' && voltas++ < 4000) {
    const e = m.estado();
    viu.add(e.fase);
    if (e.mini?.formato) viu.add(`formato:${e.mini.formato}`);
    if (e.usado && e.usado.userId < 0) viu.add(`robo-usou:${e.usado.item}`);
    if (e.fase === 'vez' && e.vez === anaId) m.jogo.acao(anaId, { tipo: 'dado' });
    else m.andar();
  }
  const e = m.estado();
  assert.equal(e.fase, 'fim', [...viu].join(', '));
  assert.ok(viu.has('caminho'), [...viu].join(', '));
  assert.ok([...viu].some((v) => v.startsWith('robo-usou:')), 'algum robô usou um item: ' + [...viu].join(', '));
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes, 'contra o computador não há troféu');
});
