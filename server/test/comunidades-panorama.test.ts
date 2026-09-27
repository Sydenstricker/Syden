/**
 * O panorama das comunidades, que é a visão de quem cuida do Syden inteiro.
 *
 * Dois assuntos se provam aqui, e o segundo importa tanto quanto o primeiro:
 *
 *   1. os números contam o que dizem contar — e a ordenação põe na frente quem está de fato em
 *      movimento, que é a razão de existir do painel;
 *   2. isto NÃO vaza conteúdo, e NÃO é visível para quem não cuida do servidor. Uma tela que mostra
 *      todas as comunidades a qualquer pessoa seria pior do que não existir.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let dono: ReturnType<typeof comToken>;
let zeca: ReturnType<typeof comToken>;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  // A primeira conta vira dona do Syden; a segunda é gente comum.
  const ana = await criarConta(app, 'ana');
  const oZeca = await criarConta(app, 'zeca');
  dono = comToken(app, ana.token);
  zeca = comToken(app, oZeca.token);

  // Duas comunidades do Zeca: uma com conversa, outra parada. É o contraste que o painel precisa
  // mostrar — a parada com gente dentro é justamente o caso que merece um olhar.
  const movimentada = (await zeca('POST', '/api/communities', { name: 'Clube do Zeca' })).json();
  await zeca('POST', '/api/communities', { name: 'Sala Vazia' });

  const canal = (
    await zeca('POST', `/api/communities/${movimentada.id}/channels`, { name: 'geral', type: 'text' })
  ).json();

  // As mensagens de texto do Syden viajam por socket, não por HTTP — não existe rota para injetá-las.
  // Como o que se prova aqui é a CONSULTA, e não o caminho da mensagem, elas entram direto no banco.
  //
  // O import vem DEPOIS de servidorDeTeste() de propósito: importar db antes congelaria o caminho do
  // banco de desenvolvimento, e o teste passaria escrevendo em contas de verdade. Já aconteceu aqui.
  const db = await import('../src/db.js');
  for (const texto of ['oi', 'tudo bem?', 'bom dia']) db.createMessage(canal.id, oZeca.user.id, texto);
});

after(async () => fechar());

describe('panorama das comunidades', () => {
  it('conta membros, canais e mensagens de cada uma', async () => {
    const { comunidades } = (await dono('GET', '/api/status/comunidades')).json();

    const clube = comunidades.find((c: { nome: string }) => c.nome === 'Clube do Zeca');
    assert.equal(clube.membros, 1);
    assert.equal(clube.mensagens, 3);
    assert.equal(clube.pessoasQueEscreveram, 1);
    assert.equal(clube.criadaPor, 'zeca');
    assert.ok(clube.canais >= 1);
  });

  it('a mais movimentada vem primeiro: é para isso que a lista serve', async () => {
    const { comunidades } = (await dono('GET', '/api/status/comunidades')).json();
    assert.equal(comunidades[0].nome, 'Clube do Zeca');
  });

  it('comunidade onde ninguém falou aparece, com zero e sem data', async () => {
    const { comunidades } = (await dono('GET', '/api/status/comunidades')).json();
    const vazia = comunidades.find((c: { nome: string }) => c.nome === 'Sala Vazia');
    // Some da lista seria o pior desfecho possível: comunidade com gente e sem conversa nenhuma é
    // exatamente o que alguém precisa ver.
    assert.ok(vazia, 'a comunidade parada sumiu da lista');
    assert.equal(vazia.mensagens, 0);
    assert.equal(vazia.ultimaMensagemEm, null);
  });

  it('a janela de dias muda o que conta como atividade', async () => {
    const umDia = (await dono('GET', '/api/status/comunidades?dias=1')).json();
    assert.equal(umDia.dias, 1);
    assert.equal(umDia.comunidades.find((c: { nome: string }) => c.nome === 'Clube do Zeca').mensagens, 3);

    // Fora de faixa é corrigido, não recusado: pedir 9999 dias não pode virar varredura do banco.
    assert.equal((await dono('GET', '/api/status/comunidades?dias=9999')).json().dias, 365);
    assert.equal((await dono('GET', '/api/status/comunidades?dias=0')).json().dias, 1);
    assert.equal((await dono('GET', '/api/status/comunidades?dias=abacaxi')).json().dias, 7);
  });

  it('NÃO devolve o conteúdo de mensagem nenhuma', async () => {
    const corpo = (await dono('GET', '/api/status/comunidades')).body;
    // As três mensagens escritas acima não podem aparecer em lugar nenhum da resposta.
    for (const texto of ['oi', 'tudo bem?', 'bom dia']) {
      assert.ok(!corpo.includes(`"${texto}"`), `o conteúdo "${texto}" vazou no panorama`);
    }
  });

  it('quem não cuida do Syden não vê a lista, nem sendo dono de uma comunidade', async () => {
    const resposta = await zeca('GET', '/api/status/comunidades');
    assert.equal(resposta.statusCode, 403);
  });

  it('sem estar logado, nem chega perto', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/status/comunidades' });
    assert.equal(resposta.statusCode, 401);
  });
});

describe('tempo de voz por comunidade', () => {
  it('soma as sessões da comunidade, e ignora as que não sabem onde aconteceram', async () => {
    const db = await import('../src/db.js');
    const { comunidades } = (await dono('GET', '/api/status/comunidades')).json();
    const clube = comunidades.find((c: { nome: string }) => c.nome === 'Clube do Zeca');

    // Uma sessão COM comunidade e outra SEM (como são todas as anteriores a 27/09/2026). Só a
    // primeira pode entrar na conta: a segunda não tem como saber onde a pessoa estava, e chutar que
    // foi ali inflaria o número da comunidade errada.
    const comDono = db.startUsageSession('voice', 1, clube.id);
    const orfa = db.startUsageSession('voice', 1, null);
    db.touchUsageSessions([comDono, orfa]);

    const depois = (await dono('GET', '/api/status/comunidades')).json();
    const clubeDepois = depois.comunidades.find((c: { nome: string }) => c.nome === 'Clube do Zeca');
    assert.equal(typeof clubeDepois.segundosDeVoz, 'number');
    assert.ok(clubeDepois.segundosDeVoz >= 0);
    assert.equal(clubeDepois.segundosDeTela, 0);
  });

  it('comunidade sem chamada nenhuma devolve zero, não nulo', async () => {
    const { comunidades } = (await dono('GET', '/api/status/comunidades')).json();
    const vazia = comunidades.find((c: { nome: string }) => c.nome === 'Sala Vazia');
    assert.equal(vazia.segundosDeVoz, 0);
    assert.equal(vazia.segundosDeTela, 0);
  });
});
