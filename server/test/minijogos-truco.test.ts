/**
 * Truco paulista (minijogo-truco.ts): o baralho, a vira e as manilhas, quem ganha a rodada e a mão (todas as regras do
 * empate), a coberta, o truco e os aumentos, a mão de onze e a de ferro, o fim aos 12, o relógio que joga por quem demora,
 * quem sai da sala, e o que cada um vê. O relógio e as cartas aqui são de mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baralho,
  criarTruco,
  forca,
  manilhaDa,
  quemGanhaARodada,
  quemLevaAMao,
  PAUSA_DA_MAO,
  PAUSA_DA_RODADA,
  TEMPO_DA_DECISAO,
  TEMPO_DO_AUSENTE,
  type Carta,
} from '../src/minijogo-truco.js';

/** 0,999 deixa a ordem como entrou: o primeiro da lista senta no lugar 0. */
const aleatorio = () => 0.999;

/**
 * Um baralho de teste: as mãos de cada lugar (3 cartas cada), a vira, e o resto do baralho depois (o que sobrar).
 */
function deck(maos: Carta[][], vira: Carta): Carta[] {
  const usadas = [...maos.flat(), vira];
  return [...usadas, ...baralho().filter((c) => !usadas.includes(c))];
}

type Estado = {
  fase: string;
  lugares: { userId: number; time: number; cartas: number; lugar: number }[];
  meuTime: number | null;
  mao: Carta[];
  maoDoParceiro: Carta[] | null;
  vira: Carta;
  manilha: string;
  mesa: { lugar: number; carta: Carta | null; coberta: boolean }[];
  rodadas: (0 | 1 | 'empate')[];
  valor: number;
  pedido: { lugar: number; time: number; valor: number } | null;
  vez: number | null;
  possoPedir: boolean;
  proximoValor: number | null;
  possoResponder: boolean;
  possoAumentar: number | null;
  possoCobrir: boolean;
  decidoOnze: boolean;
  pontos: [number, number];
  vencedor: number | null;
  interrompida: boolean;
  numeroDaMao: number;
  quemComeca: number;
  partidaId: string;
};

function comecar(ids: number[], opcoes: Parameters<typeof criarTruco>[0] = {}) {
  const sala = { ids: [...ids] };
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  let completa: boolean | undefined;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (c?: boolean) => {
      terminou = true;
      completa = c;
    },
    naSala: () => sala.ids,
    nome: (id: number) => `p${id}`,
    comunidade: 7,
  };
  const jogo = criarTruco({ aleatorio, agora: () => 1000, ...opcoes }).comecar(ctx, { naSala: ids, criadaPor: ids[0], corpo: {} });
  assert.ok(typeof jogo !== 'string', String(jogo));
  const r = {
    jogo,
    sala,
    relogio,
    terminou: () => terminou,
    completa: () => completa,
    estado: (quem: number) => jogo.publico(quem) as unknown as Estado,
    acao: (quem: number, corpo: Record<string, unknown>) => jogo.acao(quem, corpo),
    ok(quem: number, corpo: Record<string, unknown>) {
      assert.equal(jogo.acao(quem, corpo), null);
    },
    andar() {
      relogio[0].depois();
    },
    /** Joga a carta (aberta) e, se a rodada fechou sem decidir a mão, passa a pausa. */
    jogar(quem: number, carta: Carta, coberta = false) {
      r.ok(quem, { tipo: 'jogar', carta, coberta });
      if ((jogo.publico(quem) as { fase: string }).fase === 'rodada') r.andar();
    },
  };
  return r;
}

const A = 1;
const B = 2;
const C = 3;
const D = 4;

test('o baralho tem 40 cartas, sem 8, 9 e 10', () => {
  const b = baralho();
  assert.equal(b.length, 40);
  assert.equal(new Set(b).size, 40);
  assert.ok(!b.some((c) => /^(8|9|10)/.test(c)));
});

test('a manilha é o valor seguinte ao da vira, em roda', () => {
  assert.equal(manilhaDa('4o'), '5');
  assert.equal(manilhaDa('7c'), 'Q');
  assert.equal(manilhaDa('Ke'), 'A');
  assert.equal(manilhaDa('3p'), '4');
  assert.equal(manilhaDa('2o'), '3');
});

test('a força: a ordem comum, a manilha acima de tudo, e entre manilhas ouros < espadas < copas < paus', () => {
  const m = '5'; // vira 4
  const ordem = ['4o', '6o', '7o', 'Qo', 'Jo', 'Ko', 'Ao', '2o', '3o', '5o', '5e', '5c', '5p'];
  for (let i = 1; i < ordem.length; i++) assert.ok(forca(ordem[i], m) > forca(ordem[i - 1], m), `${ordem[i]} > ${ordem[i - 1]}`);
  // duas comuns do mesmo valor empatam
  assert.equal(forca('3o', m), forca('3p', m));
  const mesa = (cartas: Carta[], cobertas: boolean[] = []) => cartas.map((carta, lugar) => ({ lugar, carta, coberta: !!cobertas[lugar] }));
  assert.deepEqual(quemGanhaARodada(mesa(['3o', '3p']), m), { resultado: 'empate', lugar: null });
  assert.deepEqual(quemGanhaARodada(mesa(['5o', '3p']), m), { resultado: 0, lugar: 0 });
  assert.deepEqual(quemGanhaARodada(mesa(['5o', '5p']), m), { resultado: 1, lugar: 1 });
  // em quatro: os parceiros (0 e 2) empatados entre si ganham juntos; o primeiro a jogar é quem abre a próxima
  assert.deepEqual(quemGanhaARodada(mesa(['3o', '4e', '3c', 'Ke']), m), { resultado: 0, lugar: 0 });
  // empate entre adversários
  assert.deepEqual(quemGanhaARodada(mesa(['3o', '3e', '4c', 'Ke']), m), { resultado: 'empate', lugar: null });
  // a coberta nunca ganha nem empata
  assert.deepEqual(quemGanhaARodada(mesa(['5p', '4o'], [true]), m), { resultado: 1, lugar: 1 });
  assert.deepEqual(quemGanhaARodada(mesa(['3o', '3p'], [false, true]), m), { resultado: 0, lugar: 0 });
});

test('quem leva a mão: todas as regras do empate', () => {
  assert.equal(quemLevaAMao([0]), null);
  assert.equal(quemLevaAMao([0, 0]), 0);
  assert.equal(quemLevaAMao([0, 'empate']), 0);
  assert.equal(quemLevaAMao(['empate', 1]), 1);
  assert.equal(quemLevaAMao([0, 1]), null);
  assert.equal(quemLevaAMao(['empate', 'empate']), null);
  assert.equal(quemLevaAMao([0, 1, 1]), 1);
  assert.equal(quemLevaAMao([0, 1, 0]), 0);
  assert.equal(quemLevaAMao([0, 1, 'empate']), 0);
  assert.equal(quemLevaAMao([1, 0, 'empate']), 1);
  assert.equal(quemLevaAMao(['empate', 'empate', 1]), 1);
  assert.equal(quemLevaAMao(['empate', 'empate', 'empate']), 'ninguem');
});

test('com 3, o truco não começa', () => {
  const r = criarTruco().comecar(
    { agendar() {}, avisar() {}, terminar() {}, naSala: () => [A, B, C], nome: String },
    { naSala: [A, B, C], criadaPor: A, corpo: {} },
  );
  assert.equal(r, 'O truco é jogado em 2 ou em 4.');
  const d = criarTruco();
  assert.equal(d.minimo, 2);
  assert.equal(d.maximo, 4);
});

test('em quatro: duplas de frente (0 e 2 contra 1 e 3), e ninguém vê a mão dos outros', () => {
  const j = comecar([A, B, C, D], { baralhos: [deck([['4o', '5o', '6o'], ['4e', '5e', '6e'], ['4c', '5c', '6c'], ['4p', '5p', '6p']], 'Ko')] });
  const e = j.estado(A);
  assert.deepEqual(e.lugares.map((l) => [l.userId, l.time]), [[A, 0], [B, 1], [C, 0], [D, 1]]);
  assert.deepEqual(e.mao, ['4o', '5o', '6o']);
  assert.equal(e.vira, 'Ko');
  assert.equal(e.manilha, 'A');
  assert.equal(e.maoDoParceiro, null);
  assert.equal(e.vez, A);
  // nenhuma carta dos outros no estado de ninguém
  for (const quem of [A, B, C, D, 99]) {
    const texto = JSON.stringify(j.estado(quem));
    const minhas = quem === 99 ? [] : j.estado(quem).mao;
    for (const c of ['4o', '5o', '6o', '4e', '5e', '6e', '4c', '5c', '6c', '4p', '5p', '6p'].filter((c) => !minhas.includes(c)))
      assert.ok(!texto.includes(`"${c}"`), `${quem} viu ${c}`);
  }
  // quem assiste não joga
  assert.equal(j.acao(99, { tipo: 'jogar', carta: '4o' }), 'Você está assistindo esta partida.');
});

test('em dois: a sorte dos lugares, e a mão roda a cada mão', () => {
  const j = comecar([A, B], { aleatorio: () => 0 }); // 0 troca os dois
  const e = j.estado(A);
  assert.deepEqual(e.lugares.map((l) => l.userId), [B, A]);
  assert.equal(e.quemComeca, 0);
  assert.equal(e.mao.length, 3);
  assert.equal(e.lugares[1].cartas, 3);
});

test('a mão: quem ganha a rodada abre a próxima; empatada, abre de novo quem abriu; a mão vale 1', () => {
  // vira 4 → manilha 5. A: 3o, Ko, 6o. B: 3p, Ae, 7e
  const j = comecar([A, B], { baralhos: [deck([['3o', 'Ko', '6o'], ['3p', 'Ae', '7e']], '4c')] });
  assert.equal(j.acao(B, { tipo: 'jogar', carta: '3p' }), 'Espere a sua vez.');
  assert.equal(j.acao(A, { tipo: 'jogar', carta: '3p' }), 'Essa carta não está na sua mão.');
  assert.equal(j.acao(A, { tipo: 'jogar', carta: '3o', coberta: true }), 'A carta coberta só vale da segunda rodada em diante.');
  j.ok(A, { tipo: 'jogar', carta: '3o' });
  assert.equal(j.estado(A).vez, B);
  j.ok(B, { tipo: 'jogar', carta: '3p' });
  assert.equal(j.estado(A).fase, 'rodada');
  assert.equal(j.relogio[0].ms, PAUSA_DA_RODADA);
  j.andar();
  assert.deepEqual(j.estado(A).rodadas, ['empate']);
  assert.equal(j.estado(A).vez, A, 'abriu a empatada, abre de novo');
  j.jogar(A, '6o');
  j.jogar(B, 'Ae');
  // B ganhou a 2ª depois do empate: leva a mão
  const e = j.estado(A);
  assert.equal(e.fase, 'resultado');
  assert.deepEqual(e.pontos, [0, 1]);
  j.andar();
  const e2 = j.estado(A);
  assert.equal(e2.numeroDaMao, 2);
  assert.equal(e2.quemComeca, 1);
  assert.equal(e2.vez, B);
});

test('quem ganha a rodada abre a próxima, e a coberta não ganha', () => {
  // vira 4. A: Ko, 4o, 7o. B: Ae, Qe, 6e
  const j = comecar([A, B], { baralhos: [deck([['Ko', '4o', '7o'], ['Ae', 'Qe', '6e']], '4c')] });
  j.jogar(A, 'Ko');
  j.jogar(B, 'Ae'); // B ganha a 1ª
  assert.equal(j.estado(A).vez, B);
  assert.equal(j.estado(B).possoCobrir, true);
  j.jogar(B, 'Qe', true); // coberta
  // A vê a carta coberta escondida; B vê a própria
  assert.deepEqual(j.estado(A).mesa, [{ lugar: 1, carta: null, coberta: true }]);
  assert.deepEqual(j.estado(B).mesa, [{ lugar: 1, carta: 'Qe', coberta: true }]);
  j.jogar(A, '4o'); // o 4 ganha da coberta
  assert.deepEqual(j.estado(A).rodadas, [1, 0]);
  assert.equal(j.estado(A).vez, A);
  j.jogar(A, '7o');
  j.jogar(B, '6e');
  // 1 × 1 e A fez a 3ª
  assert.deepEqual(j.estado(A).pontos, [1, 0]);
  // a coberta nunca aparece para o outro, nem no fim da mão
  assert.ok(!JSON.stringify(j.estado(A)).includes('"Qe"'));
});

test('as três empatadas: ninguém marca', () => {
  const j = comecar([A, B], { baralhos: [deck([['3o', '2o', 'Ko'], ['3e', '2e', 'Ke']], '4c')] });
  j.jogar(A, '3o');
  j.jogar(B, '3e');
  j.jogar(A, '2o');
  j.jogar(B, '2e');
  j.jogar(A, 'Ko');
  j.jogar(B, 'Ke');
  const e = j.estado(A);
  assert.equal(e.fase, 'resultado');
  assert.deepEqual(e.rodadas, ['empate', 'empate', 'empate']);
  assert.deepEqual(e.pontos, [0, 0]);
});

test('o truco: aceitar vale 3, e só quem aceitou aumenta depois', () => {
  const j = comecar([A, B], { baralhos: [deck([['3o', '2o', 'Ko'], ['4e', '6e', '7e']], '4c')] });
  assert.equal(j.estado(A).possoPedir, true);
  assert.equal(j.estado(A).proximoValor, 3);
  assert.equal(j.estado(B).possoPedir, false);
  assert.equal(j.acao(B, { tipo: 'truco' }), 'Espere a sua vez.');
  j.ok(A, { tipo: 'truco' });
  const e = j.estado(B);
  assert.equal(e.fase, 'truco');
  assert.deepEqual(e.pedido, { lugar: 0, userId: A, time: 0, valor: 3 } as never);
  assert.equal(e.possoResponder, true);
  assert.equal(e.possoAumentar, 6);
  assert.equal(j.estado(A).possoResponder, false);
  assert.equal(j.acao(A, { tipo: 'aceitar' }), 'Quem responde é o outro lado.');
  assert.equal(j.acao(A, { tipo: 'jogar', carta: '3o' }), 'Espere a resposta do truco.');
  j.ok(B, { tipo: 'aceitar' });
  assert.equal(j.estado(A).valor, 3);
  assert.equal(j.estado(A).fase, 'jogando');
  // A pediu: agora só B (que aceitou) pode aumentar
  assert.equal(j.estado(A).possoPedir, false);
  assert.equal(j.acao(A, { tipo: 'truco' }), 'Agora não dá para pedir truco.');
  j.jogar(A, '3o');
  assert.equal(j.estado(B).possoPedir, true);
  assert.equal(j.estado(B).proximoValor, 6);
  j.ok(B, { tipo: 'truco' });
  j.ok(A, { tipo: 'aceitar' });
  assert.equal(j.estado(A).valor, 6);
  j.jogar(B, '4e');
  j.jogar(A, '2o');
  j.jogar(B, '6e');
  // A fez duas: marca 6
  assert.deepEqual(j.estado(A).pontos, [6, 0]);
});

test('o truco: aumentar até o doze, e correr dá ao outro lado o valor de antes do pedido', () => {
  const j = comecar([A, B], { baralhos: [deck([['3o', '2o', 'Ko'], ['4e', '6e', '7e']], '4c')] });
  j.ok(A, { tipo: 'truco' }); // 3
  j.ok(B, { tipo: 'aumentar' }); // 6
  assert.equal(j.estado(A).possoResponder, true);
  assert.equal(j.estado(B).possoResponder, false);
  assert.equal(j.estado(A).pedido!.valor, 6);
  j.ok(A, { tipo: 'aumentar' }); // 9
  j.ok(B, { tipo: 'aumentar' }); // 12
  assert.equal(j.estado(A).pedido!.valor, 12);
  assert.equal(j.estado(A).possoAumentar, null);
  assert.equal(j.acao(A, { tipo: 'aumentar' }), 'Não dá para aumentar mais.');
  // A corre do doze: B marca o nove
  j.ok(A, { tipo: 'correr' });
  assert.deepEqual(j.estado(A).pontos, [0, 9]);
  assert.equal(j.estado(A).fase, 'resultado');
});

test('correr do primeiro truco dá 1 a quem pediu', () => {
  const j = comecar([A, B]);
  j.ok(A, { tipo: 'truco' });
  j.ok(B, { tipo: 'correr' });
  assert.deepEqual(j.estado(A).pontos, [1, 0]);
});

test('no doze aceito, ninguém pede mais', () => {
  const j = comecar([A, B], { baralhos: [deck([['3o', '2o', 'Ko'], ['4e', '6e', '7e']], '4c')] });
  j.ok(A, { tipo: 'truco' });
  j.ok(B, { tipo: 'aumentar' });
  j.ok(A, { tipo: 'aumentar' });
  j.ok(B, { tipo: 'aumentar' });
  j.ok(A, { tipo: 'aceitar' });
  assert.equal(j.estado(A).valor, 12);
  assert.equal(j.estado(A).possoPedir, false);
  assert.equal(j.acao(A, { tipo: 'truco' }), 'Agora não dá para pedir truco.');
});

test('em quatro: qualquer um da outra dupla responde, e a primeira resposta vale', () => {
  const j = comecar([A, B, C, D]);
  j.ok(A, { tipo: 'truco' });
  assert.equal(j.estado(B).possoResponder, true);
  assert.equal(j.estado(D).possoResponder, true);
  assert.equal(j.estado(C).possoResponder, false);
  assert.equal(j.acao(C, { tipo: 'aceitar' }), 'Quem responde é o outro lado.');
  j.ok(D, { tipo: 'aceitar' });
  assert.equal(j.acao(B, { tipo: 'correr' }), 'Não há pedido de truco agora.');
  assert.equal(j.estado(A).valor, 3);
});

test('a mão de onze: a dupla com 11 vê as cartas do parceiro, decide, e sem truco', () => {
  const j = comecar([A, B, C, D], {
    pontos: [11, 4],
    baralhos: [deck([['4o', '5o', '6o'], ['4e', '5e', '6e'], ['4c', '5c', '6c'], ['4p', '5p', '6p']], 'Ko'), deck([['3o', '2o', 'Ko'], ['4e', '6e', '7e'], ['3c', '2c', 'Kc'], ['4p', '6p', '7p']], 'Qe')],
  });
  const a = j.estado(A);
  assert.equal(a.fase, 'mao-de-onze');
  assert.equal(a.decidoOnze, true);
  assert.deepEqual(a.maoDoParceiro, ['4c', '5c', '6c']);
  assert.equal(j.estado(B).decidoOnze, false);
  assert.equal(j.estado(B).maoDoParceiro, null);
  assert.ok(!JSON.stringify(j.estado(B)).includes('"6p"'));
  assert.equal(j.acao(B, { tipo: 'onze', jogar: true }), 'Quem decide a mão de onze é quem tem 11.');
  assert.equal(j.acao(A, { tipo: 'jogar', carta: '4o' }), 'A partida não está em andamento.');
  // correr dá 1 aos outros
  j.ok(C, { tipo: 'onze', jogar: false });
  assert.deepEqual(j.estado(A).pontos, [11, 5]);
  j.andar();
  // de novo mão de onze; agora jogam, valendo 3, sem truco
  assert.equal(j.estado(A).fase, 'mao-de-onze');
  j.ok(A, { tipo: 'onze', jogar: true });
  const e = j.estado(B);
  assert.equal(e.fase, 'jogando');
  assert.equal(e.valor, 3);
  assert.equal(e.vez, B);
  assert.equal(e.possoPedir, false);
  assert.equal(j.acao(B, { tipo: 'truco' }), 'Agora não dá para pedir truco.');
  assert.equal(e.maoDoParceiro, null);
});

test('a mão de onze sem resposta: joga; a mão de ferro vale 1, sem truco', () => {
  const j = comecar([A, B], { pontos: [4, 11] });
  assert.equal(j.estado(B).decidoOnze, true);
  assert.equal(j.relogio[0].ms, TEMPO_DA_DECISAO);
  j.andar();
  assert.equal(j.estado(A).fase, 'jogando');
  assert.equal(j.estado(A).valor, 3);

  const f = comecar([A, B], { pontos: [11, 11] });
  const e = f.estado(A);
  assert.equal(e.fase, 'jogando');
  assert.equal(e.valor, 1);
  assert.equal(e.possoPedir, false);
  assert.equal(f.acao(A, { tipo: 'truco' }), 'Agora não dá para pedir truco.');
});

test('o jogo vai a 12: a mão que passa de 12 fecha a partida', () => {
  const j = comecar([A, B], { pontos: [10, 0], baralhos: [deck([['3o', '2o', 'Ko'], ['4e', '6e', '7e']], '4c')] });
  j.ok(A, { tipo: 'truco' });
  j.ok(B, { tipo: 'aceitar' });
  j.jogar(A, '3o');
  j.jogar(B, '4e');
  j.jogar(A, '2o');
  j.jogar(B, '6e');
  const e = j.estado(A);
  assert.equal(e.fase, 'fim');
  assert.deepEqual(e.pontos, [12, 0]);
  assert.equal(e.vencedor, 0);
  assert.equal(j.terminou(), true);
  assert.equal(j.completa(), true);
  assert.equal(j.acao(A, { tipo: 'jogar', carta: 'Ko' }), 'A partida acabou.');
});

test('o tempo: joga a carta mais fraca, corre do truco', () => {
  // vira 4 → manilha 5: o 5o é o mais forte, e o 4o o mais fraco
  const j = comecar([A, B], { baralhos: [deck([['5o', '4o', '3o'], ['Ae', 'Ke', '6e']], '4c')] });
  assert.equal(j.relogio[0].ms, TEMPO_DA_DECISAO);
  j.andar();
  assert.deepEqual(j.estado(A).mesa, [{ lugar: 0, carta: '4o', coberta: false }]);
  assert.deepEqual(j.estado(A).mao, ['5o', '3o']);
  j.ok(B, { tipo: 'truco' });
  assert.equal(j.relogio[0].ms, TEMPO_DA_DECISAO);
  j.andar();
  // A não respondeu: correu, e B marca 1
  assert.deepEqual(j.estado(A).pontos, [0, 1]);
});

test('quem saiu da sala tem a vez jogada em 2 s; uma dupla inteira fora encerra sem vencedor', () => {
  const j = comecar([A, B, C, D]);
  j.sala.ids = [B, C, D];
  j.jogo.conferir!();
  assert.equal(j.relogio[0].ms, TEMPO_DO_AUSENTE);
  j.andar();
  assert.equal(j.estado(B).mesa.length, 1);
  assert.equal(j.estado(B).vez, B);
  assert.equal(j.terminou(), false);
  // C também sai: a dupla de A e C ficou sem ninguém
  j.sala.ids = [B, D];
  j.jogo.conferir!();
  assert.equal(j.terminou(), true);
  assert.equal(j.completa(), false);
  assert.equal(j.estado(B).fase, 'fim');
  assert.equal(j.estado(B).interrompida, true);
  assert.equal(j.estado(B).vencedor, null);
});

test('em dois, um que sai encerra a partida', () => {
  const j = comecar([A, B]);
  j.sala.ids = [A];
  j.jogo.conferir!();
  assert.equal(j.terminou(), true);
  assert.equal(j.completa(), false);
});

test('ações desconhecidas e a partida com id', () => {
  const j = comecar([A, B]);
  assert.equal(j.acao(A, { tipo: 'roubar' }), 'Ação desconhecida.');
  assert.equal(j.acao(A, { tipo: 'aceitar' }), 'Não há pedido de truco agora.');
  assert.equal(j.acao(A, { tipo: 'onze', jogar: true }), 'Não há mão de onze agora.');
  assert.equal(typeof j.estado(A).partidaId, 'string');
  assert.ok(j.estado(A).partidaId.startsWith('truco-'));
  void PAUSA_DA_MAO;
});
