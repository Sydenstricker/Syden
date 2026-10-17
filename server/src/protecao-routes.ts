/**
 * As rotas da proteção de crianças e adolescentes e do banimento geral. As regras moram em protecao.ts; aqui está quem
 * pode pedir o quê. Ver "Adolescentes no Syden" no CLAUDE.md.
 */
import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { barreiraDe, dataValida, DIAS_PARA_LIGAR_RESPONSAVEL, ehMenor, faixaDe, hojeEmBrasilia, podeMudarRegras, regrasDe } from './protecao.js';
import { aplicarBarreira, emitToUser } from './realtime.js';
import { requireUser } from './routes.js';

/** O código que o menor manda ao responsável: 8 letras e números sem os que se confundem (0/O, 1/I). */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const novoCodigo = () => Array.from({ length: 8 }, () => LETRAS[randomInt(LETRAS.length)]).join('');
const CODIGO_VALE_MS = DIAS_PARA_LIGAR_RESPONSAVEL * 86_400_000;

/** O limite diário que o responsável pode pôr: de 15 minutos a 24 horas, ou nenhum. */
function lerLimite(valor: unknown): number | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 15 && n <= 1440 ? n : undefined;
}

function lerRegras(corpo: Record<string, unknown> | undefined) {
  const regras: Parameters<typeof db.ajustarSupervisao>[1] = {};
  for (const chave of ['dmSoAmigos', 'transmitirSoAmigos', 'assistirSoAmigos'] as const) {
    if (typeof corpo?.[chave] === 'boolean') regras[chave] = corpo[chave] as boolean;
  }
  if (corpo && 'limiteMinutos' in corpo) {
    const limite = lerLimite(corpo.limiteMinutos);
    if (limite === undefined) return null;
    regras.limiteMinutos = limite;
  }
  return regras;
}

/** O que o responsável vê de um menor (art. 18): a faixa, as regras, o tempo de uso e os adultos com quem ele fala. */
function painelDoMenor(menorId: number) {
  const menor = db.findUserById(menorId);
  const regras = regrasDe(menorId);
  if (!menor || !regras) return null;
  const hoje = hojeEmBrasilia();
  const seteDiasAtras = hojeEmBrasilia(new Date(Date.now() - 6 * 86_400_000));
  const amigos = new Set(db.idsDosAmigos(menorId));
  const conversas = new Set(db.parceirosDeConversa(menorId));
  const contatos = [...new Set([...amigos, ...conversas])];
  const nascimentos = db.nascimentosDe(contatos);
  const adultos = contatos
    // adulto, ou de idade que o Syden ainda não sabe (conta que não informou): os dois aparecem para o responsável
    .filter((id) => {
      const faixa = faixaDe(nascimentos.get(id));
      return faixa === 'adulto' || faixa === null;
    })
    .map((id) => ({
      id,
      username: db.findUserById(id)?.username ?? '?',
      amigo: amigos.has(id),
      conversa: conversas.has(id),
      idadeConhecida: faixaDe(nascimentos.get(id)) !== null,
    }));
  return {
    menorId,
    username: menor.username,
    faixa: regras.faixa,
    regras: {
      dmSoAmigos: regras.dmSoAmigos,
      transmitirSoAmigos: regras.transmitirSoAmigos,
      assistirSoAmigos: regras.assistirSoAmigos,
      limiteMinutos: regras.limiteMinutos,
    },
    usoHoje: db.usoDoDia(menorId, hoje),
    usoSemana: db.usoDosDias(menorId, seteDiasAtras),
    adultos,
  };
}

export function registerProtecaoRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    // ---------- A própria pessoa ----------

    authed.get('/api/me/protecao', async (request) => {
      const eu = request.user.id;
      const faixa = faixaDe(db.protecaoDe(eu)?.nascimento);
      const regras = regrasDe(eu);
      const sup = regras ? db.supervisaoDe(eu) : undefined;
      const codigoValido = sup?.codigo && sup.codigoEm && Date.now() - Date.parse(sup.codigoEm) < CODIGO_VALE_MS;
      return {
        faixa,
        barreira: barreiraDe(eu),
        regras: regras && {
          dmSoAmigos: regras.dmSoAmigos,
          transmitirSoAmigos: regras.transmitirSoAmigos,
          assistirSoAmigos: regras.assistirSoAmigos,
          limiteMinutos: regras.limiteMinutos,
        },
        podeMudarRegras: podeMudarRegras(eu, eu),
        responsavel: sup?.responsavelId ? { username: db.findUserById(sup.responsavelId)?.username ?? '?' } : null,
        responsavelObrigatorio: faixa === '13-15',
        // até quando dá para usar sem o responsável (de 13 a 15 anos; depois, a barreira)
        prazoResponsavel:
          faixa === '13-15' && !sup?.responsavelId
            ? new Date((Date.parse(db.protecaoDe(eu)?.nascimentoEm ?? '') || Date.now()) + DIAS_PARA_LIGAR_RESPONSAVEL * 86_400_000).toISOString()
            : null,
        codigo: codigoValido ? { codigo: sup!.codigo, ate: new Date(Date.parse(sup!.codigoEm!) + CODIGO_VALE_MS).toISOString() } : null,
        usoHoje: regras ? db.usoDoDia(eu, hojeEmBrasilia()) : null,
        // a lista que o app usa para as permissões do vídeo (só amigos recebem a tela de um menor)
        amigos: regras ? db.idsDosAmigos(eu) : [],
        // quem eu supervisiono (o painel do responsável aparece só para quem tem)
        responsavelPor: db.menoresDe(eu).length,
      };
    });

    /**
     * A DATA DE NASCIMENTO de quem ainda não informou (conta antiga, conta criada pelo Google ou pela Steam). Uma vez só:
     * depois, corrigir é com quem cuida do Syden, senão o menor trocaria a data para virar adulto.
     */
    authed.put<{ Body: { nascimento?: string } }>('/api/me/nascimento', async (request, reply) => {
      const eu = request.user.id;
      const nascimento = request.body?.nascimento;
      if (!dataValida(nascimento) || Date.parse(nascimento) > Date.now()) {
        return reply.code(400).send({ error: 'Escreva a sua data de nascimento.' });
      }
      if (db.protecaoDe(eu)?.nascimento) {
        return reply.code(409).send({ error: 'A sua data de nascimento já foi informada. Para corrigir, escreva para contato@syden.chat.' });
      }
      db.guardarNascimento(eu, nascimento, 'declarada');
      if (faixaDe(nascimento) === 'crianca') {
        // Abaixo de 13, a conta fica suspensa, com recurso (para quem errou a data). Não é apagada na hora: a pessoa pode
        // levar os dados ou excluir a conta pela tela da barreira.
        db.suspenderPorIdade(eu, 'O Syden é para quem tem 13 anos ou mais.');
      }
      return { faixa: faixaDe(nascimento), barreira: barreiraDe(eu) };
    });

    /** O RECURSO (art. 30; art. 24 para a idade): quem foi banido ou suspenso explica, e quem cuida do Syden lê. */
    authed.post<{ Body: { texto?: string } }>('/api/me/recurso', async (request, reply) => {
      const barreira = barreiraDe(request.user.id);
      if (barreira?.tipo !== 'banido' && barreira?.tipo !== 'suspensa') {
        return reply.code(409).send({ error: 'Não há nada a recorrer nesta conta.' });
      }
      const texto = String(request.body?.texto ?? '').trim();
      if (texto.length < 10 || texto.length > 2000) {
        return reply.code(400).send({ error: 'Conte em poucas palavras por que a decisão deve mudar (de 10 a 2000 caracteres).' });
      }
      db.guardarRecurso(request.user.id, texto);
      for (const admin of db.listAdmins()) emitToUser(io, admin.id, 'recurso:novo', { username: request.user.username });
      return { ok: true, barreira: barreiraDe(request.user.id) };
    });

    /** O código que o menor manda ao responsável (vale 7 dias; pedir de novo troca). */
    authed.post('/api/me/responsavel/codigo', async (request, reply) => {
      const eu = request.user.id;
      if (!ehMenor(faixaDe(db.protecaoDe(eu)?.nascimento))) {
        return reply.code(409).send({ error: 'Só contas de menores de idade se ligam a um responsável.' });
      }
      if (db.supervisaoDe(eu).responsavelId) return reply.code(409).send({ error: 'A sua conta já está ligada a um responsável.' });
      const codigo = novoCodigo();
      db.guardarCodigoDoResponsavel(eu, codigo);
      return { codigo, ate: new Date(Date.now() + CODIGO_VALE_MS).toISOString() };
    });

    /** As regras mudadas pela própria pessoa: só de 16 e 17 anos (de 13 a 15, só o responsável). */
    authed.put<{ Body: Record<string, unknown> }>('/api/me/regras', async (request, reply) => {
      const eu = request.user.id;
      if (!podeMudarRegras(eu, eu)) return reply.code(403).send({ error: 'Quem muda estas regras é o seu responsável.' });
      const regras = lerRegras(request.body);
      if (!regras) return reply.code(400).send({ error: 'Limite inválido: de 15 minutos a 24 horas.' });
      db.ajustarSupervisao(eu, regras);
      return painelDoMenor(eu);
    });

    // ---------- O responsável ----------

    /**
     * LIGAR AS CONTAS: o responsável, adulto, digita o código que o menor mandou e declara ser o pai, a mãe ou o
     * responsável legal. A declaração é a camada que existe hoje; quando o gov.br der o token de idade, o adulto também
     * será confirmado por ele (o compromisso nos termos de uso).
     */
    authed.post<{ Body: { codigo?: string; declaro?: boolean } }>('/api/responsavel/ligar', async (request, reply) => {
      const eu = request.user.id;
      if (faixaDe(db.protecaoDe(eu)?.nascimento) !== 'adulto') {
        return reply.code(403).send({ error: 'Só um adulto pode ser o responsável por outra conta.' });
      }
      if (request.body?.declaro !== true) {
        return reply.code(400).send({ error: 'Confirme que você é o pai, a mãe ou o responsável legal.' });
      }
      const codigo = String(request.body?.codigo ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sup = codigo ? db.supervisaoPeloCodigo(codigo) : undefined;
      if (!sup || !sup.codigoEm || Date.now() - Date.parse(sup.codigoEm) > CODIGO_VALE_MS) {
        return reply.code(404).send({ error: 'Código não encontrado ou vencido. Peça um novo.' });
      }
      if (sup.menorId === eu) return reply.code(400).send({ error: 'Você não pode ser o seu próprio responsável.' });
      if (sup.responsavelId) return reply.code(409).send({ error: 'Esta conta já está ligada a um responsável.' });
      db.ligarResponsavel(sup.menorId, eu);
      emitToUser(io, sup.menorId, 'protecao:mudou', {});
      return painelDoMenor(sup.menorId);
    });

    authed.get('/api/responsavel/menores', async (request) => ({
      menores: db.menoresDe(request.user.id).map((m) => painelDoMenor(m.menorId)).filter(Boolean),
    }));

    authed.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/responsavel/menores/:id/regras', async (request, reply) => {
      const menorId = Number(request.params.id);
      if (regrasDe(menorId)?.responsavelId !== request.user.id) return reply.code(404).send({ error: 'Conta não encontrada.' });
      const regras = lerRegras(request.body);
      if (!regras) return reply.code(400).send({ error: 'Limite inválido: de 15 minutos a 24 horas.' });
      db.ajustarSupervisao(menorId, regras);
      emitToUser(io, menorId, 'protecao:mudou', {});
      // apertou o limite abaixo do que já foi usado hoje: vale na hora
      const barreira = barreiraDe(menorId);
      if (barreira) void aplicarBarreira(io, menorId, barreira);
      return painelDoMenor(menorId);
    });

    authed.delete<{ Params: { id: string } }>('/api/responsavel/menores/:id', async (request, reply) => {
      const menorId = Number(request.params.id);
      if (regrasDe(menorId)?.responsavelId !== request.user.id) return reply.code(404).send({ error: 'Conta não encontrada.' });
      db.desligarResponsavel(menorId);
      emitToUser(io, menorId, 'protecao:mudou', {});
      const barreira = barreiraDe(menorId);
      if (barreira) void aplicarBarreira(io, menorId, barreira);
      return { ok: true };
    });

    // ---------- Quem cuida do Syden: banir e suspender por idade ----------

    const alvoValido = (request: { user: db.User }, alvo: number) => {
      const pessoa = db.findUserById(alvo);
      if (!pessoa) return 'Pessoa não encontrada.';
      if (pessoa.id === request.user.id) return 'Você não pode fazer isto com a sua própria conta.';
      if (pessoa.isOwner) return 'A conta de quem é dono do Syden não pode ser barrada.';
      return null;
    };

    authed.get('/api/admin/barrados', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só quem cuida do Syden vê isto.' });
      return { barrados: db.listarBarrados() };
    });

    for (const [rota, acao] of [
      ['/api/admin/banir', 'banir'],
      ['/api/admin/suspender-idade', 'suspender'],
    ] as const) {
      authed.post<{ Body: { userId?: number; username?: string; motivo?: string } }>(rota, async (request, reply) => {
        if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só quem cuida do Syden faz isto.' });
        // pelo número (o painel de denúncias) ou pelo nome (o formulário do painel)
        const alvo = request.body?.username ? (db.findUserByName(String(request.body.username).trim())?.id ?? 0) : Number(request.body?.userId);
        const erro = alvoValido(request, alvo);
        if (erro) return reply.code(404).send({ error: erro });
        // O MOTIVO É OBRIGATÓRIO (art. 30): a pessoa lê na tela dela, e é dele que ela recorre.
        const motivo = String(request.body?.motivo ?? '').trim().slice(0, 1000);
        if (motivo.length < 5) return reply.code(400).send({ error: 'Escreva o motivo: é o que a pessoa vai ler.' });
        if (acao === 'banir') db.banir(alvo, motivo);
        else db.suspenderPorIdade(alvo, motivo);
        db.registrarAuditoria({
          actor: request.user,
          action: acao === 'banir' ? 'conta.banida' : 'conta.suspensa-por-idade',
          target: db.findUserById(alvo)?.username ?? String(alvo),
          detail: motivo,
        });
        const barreira = barreiraDe(alvo);
        if (barreira) await aplicarBarreira(io, alvo, barreira);
        return { ok: true };
      });
    }

    for (const [rota, acao] of [
      ['/api/admin/desbanir', 'desbanir'],
      ['/api/admin/levantar-suspensao', 'levantar'],
    ] as const) {
      authed.post<{ Body: { userId?: number } }>(rota, async (request, reply) => {
        if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só quem cuida do Syden faz isto.' });
        const alvo = Number(request.body?.userId);
        if (!db.findUserById(alvo)) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
        if (acao === 'desbanir') db.desbanir(alvo);
        else db.levantarSuspensao(alvo);
        db.registrarAuditoria({
          actor: request.user,
          action: acao === 'desbanir' ? 'conta.desbanida' : 'conta.suspensao-levantada',
          target: db.findUserById(alvo)?.username ?? String(alvo),
        });
        return { ok: true };
      });
    }
  });
}
