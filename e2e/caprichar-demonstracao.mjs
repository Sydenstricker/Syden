// A comunidade de demonstração CAPRICHADA: a mesma do comunidade-de-demonstracao.mjs, vestida com tudo o
// que o Syden deixa personalizar (pedido de 10/10/2026: "a imagem não demonstra a cara do grupo, mostra um
// espaço genérico; mostrar todo o potencial da customização").
//
// O tema é um squad de jogo, o "Squad das Sextas". A capa e o ícone são pixel art no estilo do quarto
// (e2e/pixel-art/demonstracao/), e cada pessoa veste um guarda-roupa diferente.
//
// SÓ PELAS ROTAS DO APP, como uma pessoa faria: nada de banco direto. Assim o servidor valida tudo (o que é
// de quem, o marco do selo) e o mesmo script roda contra a produção quando for a hora:
//
//   API=http://localhost:3099 DONO=microsoft-teste SENHA_DONO=... SENHA_DEMO=... node e2e/caprichar-demonstracao.mjs
//
// Antes, a comunidade básica: server/scripts/comunidade-de-demonstracao.mjs. Rodar de novo é seguro: o que
// já existe (canal, cargo) é reaproveitado.
import { readFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const API = process.env.API ?? 'http://localhost:3099';
const DONO = process.env.DONO ?? 'microsoft-teste';
const SENHA_DONO = process.env.SENHA_DONO;
const SENHA_DEMO = process.env.SENHA_DEMO;
const NOME_ANTIGO = 'Sala de Estar';
const NOME = 'Squad das Sextas';
const ARTE = new URL('./pixel-art/demonstracao/', import.meta.url);

if (!SENHA_DONO || !SENHA_DEMO) {
  console.error('Faltam SENHA_DONO e SENHA_DEMO.');
  process.exit(1);
}

/** O guarda-roupa de cada um: cada pessoa mostra uma combinação diferente (os códigos do server/src/guardaRoupa.ts). */
const ROUPAS = {
  helena: { nameColor: 'prisma', banner: 'nebulosa', moldura: 'prisma-moldura', nameEffect: 'brilho', nameFont: 'letra-pixel' },
  rafa: { nameColor: 'ouro', banner: 'brasa', moldura: 'ouro-moldura', nameEffect: 'pulso', nameFont: 'letra-bungee' },
  bento: { nameColor: 'menta', banner: 'floresta', moldura: 'esmeralda-moldura', nameEffect: 'sombra', nameFont: 'letra-fredoka' },
  clara: { nameColor: 'rosa', banner: 'estrelas', moldura: 'rubi', nameEffect: 'arco-iris', nameFont: 'letra-pacifico' },
  tom: { nameColor: 'ceu', banner: 'oceano', moldura: 'mar', nameEffect: 'sem-efeito', nameFont: 'letra-audiowide' },
};
/** O rosto de cada um: um dos coelhos prontos (web/public/avatares/coelho-<n>.png), pelo número — assim ele muda
 *  de pose com o estado (dorme ausente, fala na call), como o de qualquer pessoa que escolha um. */
const AVATARES = { DONO: 1, helena: 5, rafa: 2, bento: 3, clara: 12, tom: 4 };
const ROUPA_DO_DONO = { nameColor: 'laranja', banner: 'cosmos', moldura: 'brasa-moldura', nameEffect: 'brilho', nameFont: 'letra-russo' };

/** Os cargos e quem tem cada um. */
const CARGOS = [
  { nome: 'Lenda do ranked', cor: '#f5b83d', quem: ['helena', 'rafa'] },
  { nome: 'Suporte', cor: '#3ccfb8', quem: ['bento'] },
  { nome: 'Mira de ouro', cor: '#e5534b', quem: ['clara'] },
  { nome: 'Novato', cor: '#9aa1b1', quem: ['tom'] },
];

/** A conversa do canal novo, com os emojis da própria comunidade (o pacote inicial: gg, fogo, kkkk, bora…). */
const CONVERSA = [
  ['DONO', 'sexta chegou :bora: quem cola na call?'],
  ['helena', 'eu! acabei o trampo agora'],
  ['rafa', 'tô dentro. hoje eu carrego vocês'],
  ['bento', ':kkkk: falou o mesmo semana passada'],
  ['clara', 'gravei o clipe daquela jogada de ontem, já mando aqui'],
  ['tom', ':fogo: :fogo: :fogo:'],
  ['helena', ':gg: insano'],
  ['DONO', 'call de sexta aberta, entra todo mundo'],
];

async function chamar(token, metodo, rota, corpo) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { ...(corpo === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${rota} → ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

const entrar = async (nome, senha) => {
  const { token, user } = await chamar(null, 'POST', '/api/auth/login', { username: nome, password: senha });
  return { token, id: user.id };
};
const imagem = (arquivo) => 'data:image/png;base64,' + readFileSync(new URL(arquivo, ARTE)).toString('base64');

const dono = await entrar(DONO, SENHA_DONO);
const pessoas = {};
for (const nome of Object.keys(ROUPAS)) pessoas[nome] = await entrar(nome, SENHA_DEMO);
const quem = (nome) => (nome === 'DONO' ? dono : pessoas[nome]);

// ---------- a comunidade ----------
const comunidades = await chamar(dono.token, 'GET', '/api/communities');
const comunidade = (comunidades.communities ?? comunidades).find((c) => c.name === NOME || c.name === NOME_ANTIGO);
if (!comunidade) throw new Error(`Não achei "${NOME_ANTIGO}" nem "${NOME}". Rode comunidade-de-demonstracao.mjs antes.`);
const id = comunidade.id;
const rota = (resto) => `/api/communities/${id}${resto}`;

await chamar(dono.token, 'PATCH', rota(''), { name: NOME });
await chamar(dono.token, 'PUT', rota('/icon'), { image: imagem('icone-13.png') });
await chamar(dono.token, 'PUT', rota('/capa'), { image: imagem('capa-1.png') });
await chamar(dono.token, 'PUT', rota('/fonte'), { fonte: 'vt323', efeito: 'brilho' });
await chamar(dono.token, 'POST', rota('/restore-pack'));
await chamar(dono.token, 'PUT', rota('/boas-vindas'), {
  titulo: 'Bem-vindo ao squad',
  texto: 'Toda sexta tem call aberta a partir das 20h.\nClipe bom vai pro #destaques.\nPerdeu? Sem stress: GG é GG.',
  arte: 'cosmos',
});
console.log(`comunidade "${NOME}": ícone, capa, letra, emojis e boas-vindas`);

// ---------- o canal do squad e a conversa ----------
const canais = await chamar(dono.token, 'GET', rota('/channels'));
const lista = canais.channels ?? canais;
const canal =
  lista.find((c) => c.name === 'ranked' && c.type === 'text') ?? (await chamar(dono.token, 'POST', rota('/channels'), { name: 'ranked', type: 'text' }));
if (!lista.some((c) => c.name === 'call de sexta')) await chamar(dono.token, 'POST', rota('/channels'), { name: 'call de sexta', type: 'voice' });
// Mensagem de texto vai pelo socket, como o app manda (a rota HTTP de mensagens é a de arquivo).
const mandar = (token, texto) =>
  new Promise((ok, falhou) => {
    const s = io(API, { auth: { token }, transports: ['websocket'] });
    s.on('connect_error', (e) => falhou(e));
    s.on('connect', () =>
      s.emit('message:send', { channelId: canal.id, content: texto }, (r) => {
        s.close();
        r?.ok ? ok() : falhou(new Error(r?.error ?? 'a mensagem não foi'));
      }),
    );
  });
// Rodar de novo não repete a conversa: ela só entra num canal vazio.
const jaTem = await chamar(dono.token, 'GET', `/api/channels/${canal.id}/messages`);
if (!(jaTem.messages ?? jaTem).length) {
  for (const [autor, texto] of CONVERSA) await mandar(quem(autor).token, texto);
  console.log(`#ranked com ${CONVERSA.length} mensagens`);
} else console.log('#ranked já tinha a conversa');

// ---------- os guarda-roupas ----------
await chamar(dono.token, 'PUT', '/api/me/profile', ROUPA_DO_DONO);
for (const [nome, roupa] of Object.entries(ROUPAS)) await chamar(pessoas[nome].token, 'PUT', '/api/me/profile', roupa);
for (const [nome, numero] of Object.entries(AVATARES)) await chamar(quem(nome).token, 'PUT', '/api/me/avatar-pronto', { numero });
console.log('cada um vestido, com o próprio avatar');

// ---------- os cargos ----------
const existentes = await chamar(dono.token, 'GET', rota('/cargos'));
for (const c of CARGOS) {
  const cargo =
    (existentes.cargos ?? existentes).find((e) => e.nome === c.nome) ??
    (await chamar(dono.token, 'POST', rota('/cargos'), { nome: c.nome, cor: c.cor, separado: true }));
  for (const nome of c.quem) await chamar(dono.token, 'PUT', rota(`/members/${pessoas[nome].id}/cargos/${cargo.id}`));
}
console.log(`${CARGOS.length} cargos`);

// ---------- o selo (o servidor só deixa depois do primeiro marco: 5 membros e 3 que conversaram) ----------
await chamar(dono.token, 'PUT', rota('/selo'), { texto: 'SDS', icone: 'raio', cor: '#f0b232' });
for (const c of [dono, ...Object.values(pessoas)]) await chamar(c.token, 'PUT', '/api/me/selo', { communityId: id });
console.log('selo SDS, usado por todos');
