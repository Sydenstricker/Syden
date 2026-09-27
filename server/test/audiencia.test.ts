/**
 * A leitura da resposta da Cloudflare.
 *
 * O que se testa aqui é só a tradução do formato deles para o nosso — a parte que dá para errar sem que
 * ninguém perceba, porque ela erra devolvendo zero em vez de estourar. A consulta em si não se prova com
 * teste: prova-se com `node server/scripts/audiencia.mjs`, que pergunta o esquema à própria Cloudflare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVISAR_A_PARTIR_DE, avisoDaChave, diasAteVencer, lerResposta } from '../src/audiencia.js';

const resposta = (total: unknown[], porDia: unknown[]) => ({ viewer: { accounts: [{ total, porDia }] } });

test('lê os totais e a série por dia', () => {
  const lido = lerResposta(
    resposta(
      [{ count: 40, sum: { visits: 13 }, quantiles: { pageLoadTimeP50: 547, pageLoadTimeP75: 1320 } }],
      [
        { count: 10, sum: { visits: 4 }, dimensions: { date: '2026-09-26' } },
        { count: 30, sum: { visits: 9 }, dimensions: { date: '2026-09-27' } },
      ],
    ),
  );

  assert.equal(lido?.pageviews, 40);
  assert.equal(lido?.visitas, 13);
  assert.equal(lido?.medianaMs, 547);
  assert.equal(lido?.p75Ms, 1320);
  assert.deepEqual(lido?.porDia, [
    { dia: '2026-09-26', visitas: 4, pageviews: 10 },
    { dia: '2026-09-27', visitas: 9, pageviews: 30 },
  ]);
});

test('sem o bloco de total, soma os dias em vez de mostrar zero', () => {
  const lido = lerResposta(
    resposta(
      [],
      [
        { count: 10, sum: { visits: 4 }, dimensions: { date: '2026-09-26' } },
        { count: 30, sum: { visits: 9 }, dimensions: { date: '2026-09-27' } },
      ],
    ),
  );

  assert.equal(lido?.pageviews, 40);
  assert.equal(lido?.visitas, 13);
});

test('tempo ausente vira nulo, não zero — zero diria "abriu instantaneamente"', () => {
  const lido = lerResposta(resposta([{ count: 5, sum: { visits: 2 }, quantiles: {} }], []));
  assert.equal(lido?.medianaMs, null);
  assert.equal(lido?.p75Ms, null);
  assert.equal(lido?.visitas, 2);
});

test('janela sem nenhuma visita devolve nulo, e a seção some da tela', () => {
  assert.equal(lerResposta(resposta([], [])), null);
});

test('resposta sem conta nenhuma não estoura', () => {
  assert.equal(lerResposta({ viewer: { accounts: [] } }), null);
  assert.equal(lerResposta({ viewer: {} }), null);
  assert.equal(lerResposta(null), null);
  assert.equal(lerResposta({}), null);
});

test('dia sem data é descartado: sem data não há onde pôr a barra', () => {
  const lido = lerResposta(
    resposta(
      [{ count: 9, sum: { visits: 3 } }],
      [{ count: 9, sum: { visits: 3 } }, { count: 1, sum: { visits: 1 }, dimensions: { date: '2026-09-27' } }],
    ),
  );
  assert.equal(lido?.porDia.length, 1);
});

test('número quebrado é arredondado, e texto no lugar de número vira zero', () => {
  const lido = lerResposta(
    resposta([{ count: 7.4, sum: { visits: '13' }, quantiles: { pageLoadTimeP50: 546.7 } }], []),
  );
  assert.equal(lido?.pageviews, 7);
  assert.equal(lido?.visitas, 0);
  assert.equal(lido?.medianaMs, 547);
});

// ---------- O aviso de vencimento da chave ----------
//
// Este é o pedido explícito de quem mantém o Syden: a chave vale um ano, e um ano é tempo de sobra
// para esquecer que ela existe. O aviso tem de chegar ANTES, e o alerta de falha não pode ser
// confundido com "o site esvaziou".

const AGORA = new Date('2026-09-27T12:00:00Z');
const EM = (dias: number) => new Date(AGORA.getTime() + dias * 24 * 60 * 60_000).toISOString();

test('chave longe do vencimento não gera aviso nenhum', () => {
  assert.equal(avisoDaChave(EM(200), AGORA), null);
  assert.equal(avisoDaChave(EM(AVISAR_A_PARTIR_DE + 1), AGORA), null);
});

test('a partir de 30 dias o aviso aparece, com tudo ainda funcionando', () => {
  const aviso = avisoDaChave(EM(AVISAR_A_PARTIR_DE), AGORA);
  assert.equal(aviso?.diasAteVencer, AVISAR_A_PARTIR_DE);
});

test('meio dia restante vira "falta 1 dia", não "faltam 0"', () => {
  assert.equal(diasAteVencer(EM(0.5), AGORA), 1);
});

test('chave já vencida dá dias negativos, e o aviso continua existindo', () => {
  assert.equal(diasAteVencer(EM(-3), AGORA), -3);
  assert.equal(avisoDaChave(EM(-3), AGORA)?.diasAteVencer, -3);
});

test('chave sem validade nunca avisa — não há o que avisar', () => {
  assert.equal(diasAteVencer(null, AGORA), null);
  assert.equal(diasAteVencer('', AGORA), null);
  assert.equal(diasAteVencer('não é data', AGORA), null);
  assert.equal(avisoDaChave(null, AGORA), null);
});
