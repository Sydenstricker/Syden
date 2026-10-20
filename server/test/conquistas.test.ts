/**
 * As conquistas da turma (conquistas.ts):
 *   1. "Juntos" é na MESMA sala, com 2 ou mais; sozinho não conta, e duas salas ao mesmo tempo também não.
 *   2. Os novatos (30 dias) contam no acolhimento, e quem acolheu aparece nos bons exemplos.
 *   3. Partidas, karaokê e os marcos saem dos números certos.
 *   4. A rota: todo membro vê, quem não participa recebe 404, e o degrau alcançado fica gravado.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';
import type { DadosDasConquistas } from '../src/db.js';

// O servidor de teste primeiro: ele é quem aponta o banco para o de teste, e conquistas.ts abre o banco ao ser importado.
const { app, fechar } = await servidorDeTeste();
after(fechar);
const { medir, trechos } = await import('../src/conquistas.js');

const H = 3600_000, D = 24 * H;
const AGORA = Date.parse('2026-10-20T12:00:00Z');

function dados(parcial: Partial<DadosDasConquistas>): DadosDasConquistas {
  return {
    sessoes: [],
    membros: [],
    partidas: [],
    cantadas: [],
    cantadasDeQuemSaiu: 0,
    cinema: [],
    criadaEm: AGORA - 400 * D,
    parabens: 0,
    mensagens: 0,
    eventos: [],
    ...parcial,
  };
}
const sessao = (userId: number, channelId: number | null, de: number, ate: number) => ({ userId, channelId, inicio: AGORA - de * H, fim: AGORA - ate * H });

test('juntos é na mesma sala, com 2 ou mais', () => {
  const m = medir(
    dados({
      membros: [1, 2, 3].map((userId) => ({ userId, entrou: AGORA - 100 * D })),
      sessoes: [
        sessao(1, 10, 5, 1), // 1 na sala 10 de 5h atrás até 1h atrás
        sessao(2, 10, 4, 2), // 2 junto dele por 2h
        sessao(3, 11, 5, 1), // 3 sozinho na sala 11: não conta
      ],
    }),
    AGORA,
  );
  assert.equal(m['horas-juntos'].valor, 2);
  assert.equal(m['roda-cheia'].valor, 2);
  assert.equal(m['muitas-vozes'].valor, 2);
  assert.deepEqual(m['horas-juntos'].exemplos, [1, 2]);
});

test('quem sai às 10h e quem entra às 10h não estiveram juntos', () => {
  const t = trechos([sessao(1, 10, 3, 2), sessao(2, 10, 2, 1)]);
  assert.ok(t.every((x) => x.presentes.length === 1));
});

test('novato que conversou conta no acolhimento, e quem o acolheu é o bom exemplo', () => {
  const m = medir(
    dados({
      membros: [
        { userId: 1, entrou: AGORA - 200 * D },
        { userId: 2, entrou: AGORA - 5 * D }, // novato
        { userId: 3, entrou: AGORA - 200 * D },
      ],
      sessoes: [sessao(1, 10, 3, 1), sessao(2, 10, 3, 1), sessao(3, 12, 3, 1)],
      partidas: [{ jogo: 'stop', jogadores: 2, em: AGORA - H, quem: [1, 2] }],
      cantadas: [{ userId: 2, songId: 7, em: AGORA - H }],
    }),
    AGORA,
  );
  assert.equal(m['boas-vindas'].valor, 1);
  assert.deepEqual(m['boas-vindas'].exemplos, [1]);
  assert.equal(m['primeira-partida'].valor, 1);
  assert.equal(m['primeira-cancao'].valor, 1);
});

test('jogos, karaokê e marcos', () => {
  const m = medir(
    dados({
      membros: [1, 2].map((userId) => ({ userId, entrou: AGORA - 100 * D })),
      partidas: [
        { jogo: 'lobisomem', jogadores: 7, em: AGORA - H, quem: [1, 2] },
        { jogo: 'stop', jogadores: 2, em: AGORA - 2 * H, quem: [1, 2] },
        { jogo: 'stop', jogadores: 2, em: AGORA - 40 * D, quem: [2] },
      ],
      cantadas: [
        { userId: 1, songId: 1, em: AGORA - H },
        { userId: 1, songId: 2, em: AGORA - H },
        { userId: 2, songId: 1, em: AGORA - 60 * D },
      ],
      cantadasDeQuemSaiu: 4,
      criadaEm: Date.parse('2024-10-21T00:00:00Z'), // faz 2 anos amanhã: ainda 1
      parabens: 6,
      mensagens: 1500,
    }),
    AGORA,
  );
  assert.equal(m['mesa-de-jogo'].valor, 3);
  assert.equal(m.repertorio.valor, 2);
  assert.equal(m['vila-completa'].valor, 7);
  assert.equal(m['todo-mundo-joga'].valor, 2);
  assert.equal(m['turma-stop'].valor, 2);
  // nos últimos 30 dias, os dois jogaram uma vez cada um de Stop: o empate fica estável
  assert.deepEqual(m['turma-stop'].exemplos, [1, 2]);
  assert.equal(m['palco-aberto'].valor, 7);
  assert.deepEqual(m['palco-aberto'].exemplos, [1]); // a 2 cantou há 60 dias: fora da janela
  assert.equal(m.coral.valor, 2);
  assert.equal(m.setlist.valor, 2);
  assert.equal(m.aniversario.valor, 1);
  assert.equal(m.parabens.valor, 6);
  assert.equal(m['conversa-viva'].valor, 1500);
});

test('encontro marcado: call de 3 ou mais perto da hora', () => {
  const marcado = AGORA - 3 * H;
  const m = medir(
    dados({
      membros: [1, 2, 3].map((userId) => ({ userId, entrou: AGORA - 100 * D })),
      sessoes: [sessao(1, 10, 3.1, 2), sessao(2, 10, 3.1, 2), sessao(3, 10, 2.9, 2)],
      eventos: [marcado, AGORA - 50 * H],
    }),
    AGORA,
  );
  assert.equal(m['encontro-marcado'].valor, 1);
});

test('a rota: membro vê, quem não participa recebe 404, e o degrau fica gravado', async () => {
  const dona = comToken(app, (await criarConta(app, 'dona-conquistas')).token);
  const fora = comToken(app, (await criarConta(app, 'fora-conquistas')).token);
  const comunidade = (await dona('POST', '/api/communities', { name: 'Turma das conquistas' })).json();
  const rota = `/api/communities/${comunidade.id}/conquistas`;
  assert.equal((await fora('GET', rota)).statusCode, 404);
  for (let i = 0; i < 4; i++) {
    const outra = comToken(app, (await criarConta(app, `membro-conquistas-${i}`)).token);
    await outra('POST', '/api/communities/join', { code: comunidade.inviteCode });
  }
  const r = await dona('GET', rota);
  assert.equal(r.statusCode, 200);
  const cresce = r.json().conquistas.find((c: { id: string }) => c.id === 'turma-cresce');
  assert.equal(cresce.valor, 5);
  assert.deepEqual(
    cresce.alcancados.map((a: { degrau: number }) => a.degrau),
    [5],
  );
  assert.equal(r.json().conquistas.length, 28);
});
