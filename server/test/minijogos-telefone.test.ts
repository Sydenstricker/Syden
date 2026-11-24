/**
 * O telefone sem fio do Desenha e adivinha (24/11/2026, minijogo-telefone.ts): cada um escreve, o próximo desenha, o próximo
 * adivinha; o desenho é segredo até a revelação (o tempo real não é repassado); a frase passa pela moderação da comunidade; no
 * fim, cada corrente inteira.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { desenho } = await import('../src/minijogo-desenho.js');
const { correnteDe, tipoDoPasso } = await import('../src/minijogo-telefone.js');
const textoDoJogo = await import('../src/texto-do-jogo.js');
after(fechar);

const contas = await Promise.all(['ana-tel', 'bia-tel', 'caio-tel'].map((n) => criarConta(app, n)));
const ids = await Promise.all(contas.map(async (c) => (await comToken(app, c.token)('GET', '/api/me')).json().id as number));
const [ana, bia, caio] = ids;
const comunidade = (await comToken(app, contas[0].token)('POST', '/api/communities', { name: 'Turma do telefone' })).json() as {
  id: number;
  inviteCode: string;
};
for (const c of contas.slice(1)) await comToken(app, c.token)('POST', '/api/communities/join', { code: comunidade.inviteCode });

type Passo = { tipo: 'frase' | 'desenho'; autor: number; texto?: string; tracos?: { t: number }[] };
type Estado = {
  modo: string;
  fase: string;
  passo: number;
  passos: number;
  tarefa: string | null;
  anterior: Passo | null;
  meu: { texto: string; tracos: { t: number }[] } | null;
  entregue: boolean;
  jogadores: { userId: number; pronto: boolean }[];
  correntes: { dono: number; passos: Passo[] }[];
};

function comecar(naSala = [ana, bia, caio]) {
  const sala = { ids: [...naSala] };
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => sala.ids,
    nome: (id: number) => String(id),
    comunidade: comunidade.id,
  };
  const jogo = desenho.comecar(ctx as never, { naSala, criadaPor: naSala[0], corpo: { modo: 'telefone', tempoMs: 60_000 } });
  return {
    jogo,
    sala,
    terminou: () => terminou,
    relogio,
    estado: (quem: number) => (typeof jogo === 'string' ? null : (jogo.publico(quem) as unknown as Estado)),
    andar: () => relogio[0].depois(),
  };
}

test('o passo e a corrente: cada corrente passa uma vez por cada pessoa', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(tipoDoPasso), ['escrever', 'desenhar', 'adivinhar', 'desenhar', 'adivinhar']);
  for (const n of [3, 4, 5]) {
    for (let k = 0; k < n; k++) {
      const quem = new Set(Array.from({ length: n }, (_, s) => Array.from({ length: n }, (_, j) => j).find((j) => correnteDe(j, s, n) === k)));
      assert.equal(quem.size, n);
    }
  }
});

test('com 2 pessoas não dá', () => {
  assert.equal(typeof comecar([ana, bia]).jogo, 'string');
});

test('a partida inteira: escrever, desenhar em segredo, adivinhar e ver as correntes no fim', async () => {
  textoDoJogo.prepararModeracao();
  await new Promise((ok) => setTimeout(ok, 200));
  const m = comecar();
  const jogo = m.jogo;
  assert.ok(typeof jogo !== 'string');
  assert.equal(m.estado(ana)!.fase, 'escrevendo');
  assert.equal(m.estado(ana)!.tarefa, 'escrever');
  assert.equal(jogo.acao(ana, { tipo: 'frase', texto: '   ' }), 'Escreva alguma coisa.');
  assert.equal(jogo.acao(ana, { tipo: 'pronto' }), 'Agora não é hora de entregar o desenho.');
  const frases = new Map([
    [ana, 'um gato de chapéu'],
    [bia, 'o sol dormindo'],
    [caio, 'pizza voadora'],
  ]);
  for (const id of ids) assert.equal(jogo.acao(id, { tipo: 'frase', texto: frases.get(id)! }), null);
  // todos entregaram: o passo fecha sozinho
  const e1 = m.estado(ana)!;
  assert.equal(e1.fase, 'desenhando');
  assert.equal(e1.anterior?.tipo, 'frase');
  // a frase que eu recebo é a de outra pessoa, e ninguém vê ainda as correntes
  assert.notEqual(e1.anterior!.autor, ana);
  assert.equal(e1.anterior!.texto, frases.get(e1.anterior!.autor));
  assert.deepEqual(e1.correntes, []);
  // o traço é guardado e NÃO é repassado
  assert.equal(jogo.tempoReal!(ana, { t: 1, i: 0, c: 0, e: 1, p: [10, 10, 50, 60] }), null);
  assert.equal(m.estado(ana)!.meu!.tracos.length, 1);
  assert.equal(m.estado(bia)!.meu, null, 'o rascunho de um não aparece para o outro');
  // desfazer tira o traço; desenhar de novo e entregar
  jogo.acao(ana, { tipo: 'desfazer' });
  assert.equal(m.estado(ana)!.meu!.tracos.length, 0);
  jogo.tempoReal!(ana, { t: 1, i: 0, c: 2, e: 1, p: [100, 100, 200, 200] });
  assert.equal(jogo.acao(ana, { tipo: 'frase', texto: 'oi' }), 'Agora não é hora de escrever.');
  jogo.acao(ana, { tipo: 'pronto' });
  assert.equal(jogo.tempoReal!(ana, { t: 2, i: 0, c: 0, e: 0, p: [1, 1, 2, 2] }), null);
  assert.equal(m.estado(ana)!.meu!.tracos.length, 1, 'depois de entregar, o traço novo não entra');
  assert.equal(m.estado(ana)!.entregue, true);
  // quem não entrega: o relógio fecha o passo (o desenho vazio segue)
  m.andar();
  const e2 = m.estado(bia)!;
  assert.equal(e2.fase, 'adivinhando');
  assert.equal(e2.anterior?.tipo, 'desenho');
  // quem recebe o desenho da Ana o vê inteiro
  const quemViuAna = ids.find((id) => m.estado(id)!.anterior?.autor === ana)!;
  assert.equal(m.estado(quemViuAna)!.anterior!.tracos!.length, 1);
  for (const id of ids) jogo.acao(id, { tipo: 'frase', texto: `palpite de ${id}` });
  const e3 = m.estado(ana)!;
  assert.equal(e3.fase, 'mostrando');
  assert.equal(e3.correntes.length, 1);
  assert.equal(e3.correntes[0].passos.length, 1, 'a revelação começa pelo primeiro passo da primeira corrente');
  // a revelação anda sozinha (e qualquer um passa adiante)
  for (let n = 0; n < 20 && !m.terminou(); n++) {
    if (n % 2) jogo.acao(caio, { tipo: 'proximo' });
    else m.andar();
  }
  assert.ok(m.terminou());
  const fim = m.estado(caio)!;
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.correntes.length, 3);
  for (const c of fim.correntes) {
    assert.deepEqual(
      c.passos.map((p) => p.tipo),
      ['frase', 'desenho', 'frase'],
    );
    assert.equal(c.passos[0].autor, c.dono);
    assert.equal(c.passos[0].texto, frases.get(c.dono));
    assert.equal(new Set(c.passos.map((p) => p.autor)).size, 3, 'cada corrente passou por cada um');
  }
});

test('a frase passa pela moderação da comunidade (quem administra não)', async () => {
  textoDoJogo.prepararModeracao();
  await new Promise((ok) => setTimeout(ok, 200));
  const r = await comToken(app, contas[0].token)('PUT', `/api/communities/${comunidade.id}/moderacao`, { palavras: ['abacaxi'], links: true, flood: false });
  assert.equal(r.statusCode, 200);
  const m = comecar();
  const jogo = m.jogo;
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.acao(bia, { tipo: 'frase', texto: 'um ABACAXI dançando' }), 'Esta comunidade não permite uma das palavras desta mensagem.');
  assert.equal(jogo.acao(bia, { tipo: 'frase', texto: 'veja https://exemplo.com' }), 'Esta comunidade não permite links nas mensagens.');
  assert.equal(m.estado(bia)!.entregue, false);
  assert.equal(jogo.acao(bia, { tipo: 'frase', texto: 'um coqueiro dançando' }), null);
  // a dona da comunidade administra: não passa pelas regras
  assert.equal(jogo.acao(ana, { tipo: 'frase', texto: 'abacaxi' }), null);
  // texto comprido é cortado
  jogo.acao(caio, { tipo: 'frase', texto: 'x'.repeat(300) });
  assert.equal(m.estado(caio)!.fase, 'desenhando');
});

test('quem sai da sala não segura o passo, e com menos de 2 vai à revelação', () => {
  const m = comecar();
  const jogo = m.jogo;
  assert.ok(typeof jogo !== 'string');
  jogo.acao(ana, { tipo: 'frase', texto: 'a' });
  jogo.acao(bia, { tipo: 'frase', texto: 'b' });
  m.sala.ids = [ana, bia];
  jogo.conferir!();
  assert.equal(m.estado(ana)!.fase, 'desenhando');
  m.sala.ids = [ana];
  jogo.conferir!();
  assert.equal(m.estado(ana)!.fase, 'mostrando');
});
