/**
 * A CAIXA-PRETA: o que fica de uma conta excluída, por 90 dias.
 *
 * As quatro provas abaixo são as que, falhando caladas, tornariam a função inútil ou perigosa:
 *
 *   1. a prova É GUARDADA. Sem isto, excluir continua apagando tudo e o pedido judicial chega a nada;
 *   2. a SENHA NÃO ENTRA. "Tudo" quer dizer tudo o que serve de prova — um hash não serve, e guardá-lo
 *      é só risco acumulado;
 *   3. ela SOME no prazo. Retenção que não expira não é retenção de 90 dias, é retenção para sempre;
 *   4. NÃO HÁ ROTA para ela. Esta é a que mais importa: no dia em que alguém acrescentar uma, a
 *      caixa-preta vira um diretório de tudo o que todo mundo já apagou, a um `isAdmin` errado de
 *      distância.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

describe('a caixa-preta das contas excluídas', () => {
  let app: FastifyInstance;
  let fechar: () => Promise<void>;
  let banco: string;

  before(async () => {
    const teste = await servidorDeTeste();
    app = teste.app;
    fechar = teste.fechar;
    banco = process.env.DATABASE_PATH!;
  });
  after(() => fechar());

  const caixa = () => {
    const db = new DatabaseSync(banco, { readOnly: true });
    const linhas = db.prepare('SELECT user_id AS id, excluida_em AS quando, dados FROM contas_retidas').all() as {
      id: number;
      quando: string;
      dados: string;
    }[];
    db.close();
    return linhas;
  };

  it('guarda quem era a pessoa e o que ela escreveu', async () => {
    const dono = await criarConta(app, 'donodatudo');
    const reu = await criarConta(app, 'quemsumiu');
    const comoDono = comToken(app, dono.token);

    const antes = caixa().length;
    const apagou = await comoDono('DELETE', `/api/users/${reu.user.id}`);
    assert.equal(apagou.statusCode, 200, apagou.body);

    const depois = caixa();
    assert.equal(depois.length, antes + 1, 'a conta excluída não foi parar na caixa-preta');

    const guardada = depois.find((l) => l.id === reu.user.id);
    assert.ok(guardada, 'a conta excluída não está na caixa-preta');
    const dados = JSON.parse(guardada.dados);
    assert.equal(dados.pessoa.username, 'quemsumiu');
    assert.ok(dados.pessoa.email, 'o e-mail é o que liga a conta a uma pessoa real — tem de estar lá');
    assert.ok(Array.isArray(dados.mensagens), 'faltou a lista de mensagens');
  });

  it('a conta sumiu MESMO do Syden: a caixa-preta não a mantém viva', () => {
    const db = new DatabaseSync(banco, { readOnly: true });
    const ainda = db.prepare('SELECT id FROM users WHERE username = ?').all('quemsumiu');
    db.close();
    assert.equal(ainda.length, 0, 'a conta continua existindo — a exclusão deixou de excluir');
  });

  it('a senha NÃO entra na caixa-preta', () => {
    // O hash não prova nada em juízo e guardá-lo é risco puro. Esta prova existe porque o jeito
    // natural de escrever o retrato seria `SELECT *`, e aí ele entraria sem ninguém decidir isso.
    for (const linha of caixa()) {
      const texto = linha.dados.toLowerCase();
      assert.ok(!texto.includes('password'), 'apareceu campo de senha no retrato');
      assert.ok(!texto.includes('$2a$') && !texto.includes('$2b$'), 'apareceu um hash de senha no retrato');
    }
  });

  it('o que passou dos 90 dias é apagado', async () => {
    const db = new DatabaseSync(banco);
    // Envelhece a linha à mão: esperar noventa dias não é teste.
    db.prepare("UPDATE contas_retidas SET excluida_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-91 days')").run();
    db.close();

    const { limparCaixaPreta } = await import('../src/db.js');
    const quantas = limparCaixaPreta();
    assert.ok(quantas >= 1, 'a limpeza não apagou nada');
    assert.equal(caixa().length, 0, 'sobrou conta vencida na caixa-preta');
  });

  it('NENHUMA rota do servidor toca na tabela — e é isso que a torna uma caixa-preta', () => {
    // A regra é sobre o servidor INTEIRO, não sobre as rotas que eu lembrei de olhar: o arquivo que
    // a escreve (db.ts) é o único que pode citá-la. Qualquer outro é alguém abrindo uma porta.
    const raiz = new URL('../src/', import.meta.url);
    const culpados = readdirSync(raiz)
      .filter((nome) => nome.endsWith('.ts') && nome !== 'db.ts')
      .filter((nome) => readFileSync(new URL(nome, raiz), 'utf8').includes('contas_retidas'));
    assert.deepEqual(
      culpados,
      [],
      'estes arquivos falam com a caixa-preta: ' +
        culpados.join(', ') +
        '\n  Ela não pode ter rota. O conteúdo só sai por scripts/caixa-preta.mjs, rodado DENTRO do\n' +
        '  servidor — o que exige SSH e deixa rastro. Com uma tela, um `isAdmin` errado a transforma\n' +
        '  num diretório de tudo o que todo mundo já apagou.',
    );
  });
});
