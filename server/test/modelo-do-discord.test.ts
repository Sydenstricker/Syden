/**
 * Trazer a estrutura de um servidor do Discord pelo MODELO DE SERVIDOR (modelo-do-discord.ts), sem rede: o fetch é trocado
 * por um falso que devolve a forma real da resposta de GET /guilds/templates/{code} (conferida em 23/11/2026 no modelo
 * público "Friends & Family", hgM48av5Q69A).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let contas = 0;
let modulo: typeof import('../src/modelo-do-discord.js');
let pedidos: string[] = [];
let resposta: () => Response;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  modulo = await import('../src/modelo-do-discord.js');
});
after(() => fechar());

function canal(id: number, type: number, name: string, position: number, parent_id: number | null = null) {
  return { id, type, name, position, parent_id, topic: null, permission_overwrites: [] };
}

/** A forma do Discord: categorias, canais em ordem bagunçada, cargos de baixo para cima com o @everyone primeiro. */
const MODELO = {
  code: 'abcDEF123',
  name: 'Modelo',
  serialized_source_guild: {
    name: 'Turma do Valorant',
    roles: [
      { id: 0, name: '@everyone', permissions: '2248329584434769', color: 0 },
      { id: 1, name: 'Membro', permissions: '0', color: 0 },
      { id: 2, name: 'MEE6', permissions: '8', color: 0x5865f2, managed: true },
      { id: 3, name: 'Moderação', permissions: '8', color: 0xe5534b },
    ],
    channels: [
      canal(10, 4, 'Voz', 2),
      canal(11, 2, 'Lounge', 0, 10),
      canal(12, 13, 'Palco', 1, 10),
      canal(20, 4, 'Texto', 1),
      canal(21, 0, 'Geral Dois', 1, 20),
      canal(22, 5, 'avisos', 0, 20),
      canal(23, 2, 'Sala dentro do texto', 0, 20),
      canal(24, 15, 'fórum', 3, 20),
      canal(30, 0, 'regras', 0, null),
      canal(31, 14, 'diretório', 0, null),
    ],
  },
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

function usarResposta(r: () => Response) {
  pedidos = [];
  resposta = r;
  modulo.definirBuscaDoDiscord((async (endereco: string | URL | Request) => {
    pedidos.push(String(endereco));
    return resposta();
  }) as typeof fetch);
}

async function pessoa() {
  return comToken(app, (await criarConta(app, `ana-modelo-${++contas}`)).token);
}

describe('modelo de servidor do Discord', () => {
  it('entende os links e recusa o que não é modelo', () => {
    assert.equal(modulo.codigoDoModelo('https://discord.new/abcDEF123'), 'abcDEF123');
    assert.equal(modulo.codigoDoModelo('discord.new/abcDEF123'), 'abcDEF123');
    assert.equal(modulo.codigoDoModelo('https://discord.com/template/abcDEF123'), 'abcDEF123');
    assert.equal(modulo.codigoDoModelo('https://discordapp.com/template/abcDEF123?x=1'), 'abcDEF123');
    assert.equal(modulo.codigoDoModelo(' abcDEF123 '), 'abcDEF123');
    assert.equal(modulo.codigoDoModelo('https://discord.gg/abcDEF123'), null);
    assert.equal(modulo.codigoDoModelo('https://exemplo.com/template/abc'), null);
    assert.equal(modulo.codigoDoModelo('../../users/@me'), null);
    assert.equal(modulo.codigoDoModelo(''), null);
  });

  it('achata as categorias na ordem do Discord e traz só nome e cor dos cargos', () => {
    const r = modulo.converterModelo(MODELO)!;
    assert.equal(r.nome, 'Turma do Valorant');
    assert.deepEqual(
      r.canais.map((c) => `${c.type}:${c.name}`),
      [
        // sem categoria primeiro; o diretório (14) não vira canal
        'text:regras',
        // a categoria Texto (posição 1): os de texto pela posição, depois os de voz
        'text:avisos',
        'text:geral-dois',
        'text:fórum',
        'voice:Sala dentro do texto',
        // a categoria Voz (posição 2)
        'voice:Lounge',
        'voice:Palco',
      ],
    );
    // De cima para baixo, sem @everyone nem o cargo de robô; sem cor vira o cinza.
    assert.deepEqual(r.cargos, [
      { nome: 'Moderação', cor: '#e5534b' },
      { nome: 'Membro', cor: '#9aa1b1' },
    ]);
    assert.equal(r.cortados, 0);
  });

  it('respeita os limites de nome e de quantidade', () => {
    const muitos = {
      serialized_source_guild: {
        name: 'x'.repeat(80),
        roles: Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `Cargo ${i} ${'y'.repeat(40)}`, color: 1 })),
        channels: Array.from({ length: 130 }, (_, i) => canal(i + 1, 0, `Canal ${i} ${'z'.repeat(80)}`, i)),
      },
    };
    const r = modulo.converterModelo(muitos)!;
    assert.equal(r.canais.length, modulo.MAXIMO_DE_CANAIS);
    assert.equal(r.cargos.length, 50);
    assert.equal(r.cortados, 30 + 10);
    assert.ok(r.canais.every((c) => c.name.length >= 1 && c.name.length <= 50 && !/\s/.test(c.name)));
    assert.ok(r.cargos.every((c) => c.nome.length <= 32));
    assert.equal(r.nome.length, 40);
    assert.equal(modulo.converterModelo({ message: 'nada' }), null);
  });

  it('a prévia e o criar: só o código vai ao Discord, e a comunidade nasce com os canais e os cargos', async () => {
    usarResposta(() => json(MODELO));
    const ana = await pessoa();
    const previa = await ana('POST', '/api/modelo-do-discord', { link: 'https://discord.new/abcDEF123' });
    assert.equal(previa.statusCode, 200);
    assert.equal((previa.json() as { canais: unknown[] }).canais.length, 7);
    assert.deepEqual(pedidos, ['https://discord.com/api/v10/guilds/templates/abcDEF123']);

    const criada = await ana('POST', '/api/communities', {
      name: 'Turma',
      canais: ['general', 'games', 'Room 1', 'Room 2'],
      modeloDoDiscord: 'discord.new/abcDEF123',
    });
    assert.equal(criada.statusCode, 200);
    // Guardado da prévia: criar não pediu de novo.
    assert.equal(pedidos.length, 1);
    const id = (criada.json() as { id: number }).id;
    const canais = (await ana('GET', `/api/communities/${id}/channels`)).json() as { name: string; type: string }[];
    assert.deepEqual(canais.map((c) => `${c.type}:${c.name}`).slice(0, 3), ['text:regras', 'text:avisos', 'text:geral-dois']);
    assert.equal(canais.length, 7);
    const cargos = (await ana('GET', `/api/communities/${id}/cargos`)).json() as { nome: string; cor: string; arrumaSalao: boolean }[];
    assert.deepEqual(
      cargos.map((c) => [c.nome, c.cor, c.arrumaSalao]),
      [
        ['Moderação', '#e5534b', false],
        ['Membro', '#9aa1b1', false],
      ],
    );
  });

  it('sem canal de texto no modelo, a comunidade ganha o primeiro inicial', async () => {
    usarResposta(() =>
      json({ serialized_source_guild: { name: 'Só voz', roles: [], channels: [canal(1, 2, 'Sala', 0)] } }),
    );
    const ana = await pessoa();
    const criada = await ana('POST', '/api/communities', { name: 'Só voz', canais: ['general'], modeloDoDiscord: 'sovoz1' });
    const id = (criada.json() as { id: number }).id;
    const canais = (await ana('GET', `/api/communities/${id}/channels`)).json() as { name: string; type: string }[];
    assert.deepEqual(canais.map((c) => `${c.type}:${c.name}`), ['text:general', 'voice:Sala']);
  });

  it('erros claros: link inválido, modelo que não existe, Discord fora do ar, resposta grande demais', async () => {
    const ana = await pessoa();
    usarResposta(() => json(MODELO));
    const invalido = await ana('POST', '/api/modelo-do-discord', { link: 'https://discord.gg/convite' });
    assert.equal(invalido.statusCode, 400);
    assert.equal((invalido.json() as { error: string }).error, modulo.LINK_INVALIDO);
    assert.equal(pedidos.length, 0);

    usarResposta(() => json({ message: 'Unknown server template', code: 10057 }, 404));
    const inexistente = await ana('POST', '/api/modelo-do-discord', { link: 'discord.new/naoexiste' });
    assert.equal(inexistente.statusCode, 404);
    assert.equal((inexistente.json() as { error: string }).error, modulo.MODELO_INEXISTENTE);

    usarResposta(() => {
      throw new TypeError('fetch failed');
    });
    const fora = await ana('POST', '/api/modelo-do-discord', { link: 'discord.new/foradoar' });
    assert.equal(fora.statusCode, 502);
    assert.equal((fora.json() as { error: string }).error, modulo.DISCORD_FORA);

    const ana2 = await pessoa();
    usarResposta(() => new Response('x'.repeat(3 * 1024 * 1024), { status: 200 }));
    const grande = await ana2('POST', '/api/modelo-do-discord', { link: 'discord.new/grande' });
    assert.equal(grande.statusCode, 502);

    // Com erro do modelo, a comunidade não é criada pela metade.
    usarResposta(() => json({}, 500));
    const antes = ((await ana2('GET', '/api/communities')).json() as unknown[]).length;
    const criada = await ana2('POST', '/api/communities', { name: 'Não nasce', modeloDoDiscord: 'discord.new/quebrado' });
    assert.equal(criada.statusCode, 502);
    assert.equal(((await ana2('GET', '/api/communities')).json() as unknown[]).length, antes);
  });

  it('cada pessoa tem um teto de links por minuto', async () => {
    usarResposta(() => json(MODELO));
    const ana = await pessoa();
    const codigos = Array.from({ length: 6 }, (_, i) => `teto${i}`);
    const status: number[] = [];
    for (const c of codigos) status.push((await ana('POST', '/api/modelo-do-discord', { link: c })).statusCode);
    assert.deepEqual(status, [200, 200, 200, 200, 200, 429]);
  });
});
