/**
 * O MICROFONE NO LOBISOMEM (20/11/2026, decisão dele: "Lobisomem pode mutar sim"). De noite ninguém da partida fala, quem
 * saiu do jogo só ouve até o fim, e nada deixa alguém mudo para sempre: o fim, o `parar`, o teto e a volta de uma queda.
 * A trava de verdade é a permissão do LiveKit; aqui o cliente dele é de mentira.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { criarLobisomem, type Papel } from '../src/minijogo-lobisomem.js';
import type { Contexto, Jogo } from '../src/minijogo-motor.js';
import {
  _definirRelogio,
  _limpar,
  aplicadorDoLiveKit,
  definirAplicador,
  devolverDepoisDaQueda,
  liberarSala,
  motivoDoSilencio,
  silenciarNaSala,
  TETO_DO_SILENCIO_MS,
  type ClienteDaSala,
} from '../src/silencio-do-jogo.js';

afterEach(() => {
  _limpar();
  definirAplicador(null);
  _definirRelogio(Date.now);
});

function semente(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uma partida de 5 com o `silenciar` anotado (o último mapa mandado). */
function montar() {
  const naSala = [1, 2, 3, 4, 5];
  let relogio: (() => void) | null = null;
  const pedidos: Map<number, 'noite' | 'fora'>[] = [];
  const ctx: Contexto = {
    agendar: (_ms, depois) => (relogio = depois),
    avisar: () => {},
    terminar: () => {},
    naSala: () => naSala,
    nome: (id) => `p${id}`,
    comunidade: 7,
    silenciar: (m) => pedidos.push(new Map(m)),
  };
  let t = 0;
  const jogo = criarLobisomem({ aleatorio: semente(3), agora: () => (t += 1000) }).comecar(ctx, { naSala, criadaPor: 1, corpo: {} }) as Jogo;
  const ver = (quem: number) => jogo.publico(quem) as Record<string, any>;
  const papelDe = (id: number) => ver(id).meuPapel as Papel;
  return {
    jogo,
    naSala,
    ver,
    papelDe,
    ultimo: () => pedidos[pedidos.length - 1] ?? new Map(),
    pedidos,
    tique: () => {
      const r = relogio;
      relogio = null;
      r?.();
    },
  };
}

test('o jogo: ninguém mudo no preparo; de noite todos os jogadores; no amanhecer só quem saiu; no fim e no parar, ninguém', () => {
  const m = montar();
  assert.equal(m.ver(1).microfone, null);
  assert.equal(m.jogo.acao(1, { tipo: 'ajustes', lobos: 1, especiais: ['vidente'] }), null);
  assert.equal(m.ultimo().size, 0, 'o preparo não cala ninguém');

  m.jogo.acao(1, { tipo: 'comecar' });
  assert.equal(m.ver(2).fase, 'noite');
  assert.deepEqual([...m.ultimo()].sort(), m.naSala.map((id) => [id, 'noite']));
  assert.equal(m.ver(3).microfone, 'noite');

  // o lobo ataca alguém da vila; a noite acaba no relógio
  const lobo = m.naSala.find((id) => m.papelDe(id) === 'lobisomem')!;
  const alvo = m.naSala.find((id) => m.papelDe(id) === 'aldeao')!;
  m.jogo.acao(lobo, { tipo: 'noite', alvo });
  while (m.ver(1).fase === 'noite') m.tique();
  assert.equal(m.ver(1).fase, 'amanhecer');
  assert.deepEqual([...m.ultimo()], [[alvo, 'fora']], 'no amanhecer, só quem saiu continua mudo');
  assert.equal(m.ver(alvo).microfone, 'fora');
  assert.equal(m.ver(lobo).microfone, null);

  m.tique(); // o dia
  assert.equal(m.ver(1).fase, 'dia');
  assert.deepEqual([...m.ultimo()], [[alvo, 'fora']]);

  // a partida sai da memória no meio: todos voltam a falar
  m.jogo.parar?.();
  assert.equal(m.ultimo().size, 0);
});

test('o jogo: no fim, todos falam (inclusive quem saiu)', () => {
  const m = montar();
  m.jogo.acao(1, { tipo: 'ajustes', lobos: 1, especiais: ['vidente'] });
  m.jogo.acao(1, { tipo: 'comecar' });
  const lobo = m.naSala.find((id) => m.papelDe(id) === 'lobisomem')!;
  // de dia a vila tira o lobo: a vila vence
  m.jogo.acao(lobo, { tipo: 'noite', alvo: m.naSala.find((id) => id !== lobo)! });
  while (m.ver(1).fase !== 'dia') m.tique();
  const vivos = (m.ver(1).jogadores as { userId: number; vivo: boolean }[]).filter((j) => j.vivo).map((j) => j.userId);
  for (const id of vivos) m.jogo.acao(id, { tipo: 'voto', alvo: lobo });
  assert.equal(m.ver(1).fase, 'defesa');
  m.tique();
  for (const id of vivos) if (id !== lobo) m.jogo.acao(id, { tipo: 'julgamento', sim: true });
  assert.equal(m.ver(1).fase, 'fim');
  assert.equal(m.ultimo().size, 0);
  assert.equal(m.ver(lobo).microfone, null);
});

test('o módulo: só quem mudou vai ao LiveKit, o dono protege, o teto solta e a queda devolve', () => {
  const chamadas: [number, number[]][] = [];
  let kv: string | undefined;
  definirAplicador((canal, ids) => chamadas.push([canal, [...ids].sort()]), { ler: () => kv, gravar: (v) => (kv = v) });
  let agora = 1_000_000;
  _definirRelogio(() => agora);
  const partida = {};
  silenciarNaSala(10, new Map([[1, 'noite'], [2, 'noite'], [3, 'noite']]), partida);
  assert.deepEqual(chamadas.pop(), [10, [1, 2, 3]]);
  assert.equal(motivoDoSilencio(10, 2), 'noite');
  assert.equal(motivoDoSilencio(10, 9), null, 'quem só assiste não é mudo');
  assert.equal(motivoDoSilencio(11, 2), null, 'outra sala, nada');
  assert.deepEqual(JSON.parse(kv!), [[10, [1, 2, 3]]]);

  // amanhecer: o 2 saiu do jogo
  silenciarNaSala(10, new Map([[2, 'fora']]), partida);
  assert.deepEqual(chamadas.pop(), [10, [1, 2, 3]], 'o 1 e o 3 voltam a falar; o 2 muda de motivo');
  silenciarNaSala(10, new Map([[2, 'fora']]), partida);
  assert.equal(chamadas.length, 0, 'sem mudança, nada vai ao LiveKit');

  // outra partida não solta o silêncio desta
  liberarSala(10, {});
  assert.equal(motivoDoSilencio(10, 2), 'fora');
  liberarSala(10, partida);
  assert.equal(motivoDoSilencio(10, 2), null);
  assert.deepEqual(chamadas.pop(), [10, [2]]);
  assert.deepEqual(JSON.parse(kv!), []);

  // o teto: sem renovação, o silêncio acaba sozinho
  silenciarNaSala(10, new Map([[4, 'noite']]), partida);
  chamadas.length = 0;
  agora += TETO_DO_SILENCIO_MS;
  assert.equal(motivoDoSilencio(10, 4), null);
  assert.deepEqual(chamadas.pop(), [10, [4]]);

  // a queda: o servidor voltou com a memória vazia, e o kv diz quem estava mudo
  kv = JSON.stringify([[12, [5, 6]]]);
  devolverDepoisDaQueda();
  assert.deepEqual(chamadas.pop(), [12, [5, 6]]);
  assert.deepEqual(JSON.parse(kv), []);
});

test('o aplicador do LiveKit: a permissão inteira de cada um, a faixa do microfone emudecida, e a falha não quebra nada', async () => {
  const pedidos: unknown[][] = [];
  const cliente: ClienteDaSala = {
    updateParticipant: async (...a) => void pedidos.push(['update', ...a]),
    listParticipants: async () => [{ identity: '1', tracks: [{ sid: 'TR_mic', source: 'MIC' }, { sid: 'TR_cam', source: 'CAM' }] }],
    mutePublishedTrack: async (...a) => void pedidos.push(['mute', ...a]),
  };
  const avisos: number[] = [];
  const permissao = (canal: number, id: number) => ({ canPublishSources: motivoDoSilencio(canal, id) ? ['CAM'] : [], quem: id });
  definirAplicador(aplicadorDoLiveKit({ cliente, sala: (c) => `channel-${c}`, permissao, microfone: 'MIC', depois: (c) => avisos.push(c) }));
  silenciarNaSala(20, new Map([[1, 'noite']]));
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(pedidos, [
    ['update', 'channel-20', '1', undefined, { canPublishSources: ['CAM'], quem: 1 }],
    ['mute', 'channel-20', '1', 'TR_mic', true],
  ]);
  assert.deepEqual(avisos, [20], 'a lista da sala vai de novo');

  pedidos.length = 0;
  liberarSala(20);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(pedidos, [['update', 'channel-20', '1', undefined, { canPublishSources: [], quem: 1 }]], 'ao soltar, só a permissão volta');

  // o LiveKit fora (ou não configurado): o jogo segue, e só uma linha no log
  const logs: string[] = [];
  const quebrado: ClienteDaSala = {
    updateParticipant: async () => {
      throw new Error('connect ECONNREFUSED');
    },
    listParticipants: async () => [],
    mutePublishedTrack: async () => {},
  };
  definirAplicador(aplicadorDoLiveKit({ cliente: quebrado, sala: String, permissao, microfone: 'MIC', log: (m) => logs.push(m) }));
  silenciarNaSala(21, new Map([[1, 'noite'], [2, 'noite']]));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /segue sem mutar/);
  assert.equal(motivoDoSilencio(21, 2), 'noite', 'a tela continua sabendo, e o site cala o próprio microfone');
});
