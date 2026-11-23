/**
 * O CELULAR COMO CÂMERA (23/11/2026, pedido dele, visto no Trivo): quem não tem webcam, ou tem uma ruim, aponta o
 * celular para um QR code no computador, e a câmera do celular vira a câmera dele na chamada.
 *
 * O CELULAR NÃO ENTRA NA CHAMADA. Ele manda a imagem DIRETO ao computador, numa conexão de aparelho para aparelho
 * (WebRTC), e o computador a publica como a câmera dele: a cifra de ponta a ponta continua a de sempre, com uma pessoa
 * e um aparelho por sala, e o celular não ouve nem vê nada da chamada.
 *
 * O servidor só faz duas coisas: emite o par (um id e um token de uso único, que valem 10 minutos para o celular se
 * apresentar) e REPASSA o aperto de mão entre os dois. O QR code leva também um SEGREDO que nunca passa por aqui (vai
 * depois do # do endereço), e cada mensagem do aperto de mão vai assinada com ele: o servidor não consegue trocar a
 * impressão digital da conexão e se pôr no meio (ver web/src/cameraDoCelular.ts).
 *
 * O celular entra pelo namespace /celular, que NÃO é o da conta: lá ele só fala com o computador que o chamou. Tudo mora
 * na memória: o par some com a desconexão de qualquer um dos lados.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Server as IOServer, Socket } from 'socket.io';
import { barreiraDe } from './protecao.js';

/** Quanto o celular tem para se apresentar depois de o QR code aparecer. */
export const VALIDADE_DO_PAR_MS = 10 * 60_000;
/** Uma oferta ou resposta do WebRTC cabe folgada nisso; mais que isso não é aperto de mão. */
const TAMANHO_MAXIMO = 16_384;
/** Mensagens por segundo de cada lado (os candidatos de rede chegam em rajada, umas dezenas). */
const MENSAGENS_POR_SEGUNDO = 40;

interface Par {
  userId: number;
  hashDoToken: Buffer;
  criadoEm: number;
  /** O socket do computador que abriu o par (a conta). */
  computador: string;
  /** O socket do celular, depois que ele se apresentou (o token só vale uma vez). */
  celular: string | null;
}

const pares = new Map<string, Par>();
const hash = (token: string) => createHash('sha256').update(token).digest();

let ioDoServidor: IOServer | null = null;

/** Um par por pessoa: abrir outro QR code fecha o anterior (e solta o celular dele). */
function fecharDaPessoa(userId: number) {
  for (const [id, par] of pares) if (par.userId === userId) fecharPar(id, 'substituido');
}

function fecharPar(id: string, motivo: string) {
  const par = pares.get(id);
  if (!par || !ioDoServidor) return;
  pares.delete(id);
  ioDoServidor.to(par.computador).emit('celular:saiu', { id, motivo });
  if (par.celular) ioDoServidor.of('/celular').sockets.get(par.celular)?.disconnect(true);
}

function freio() {
  let janela = 0;
  let contagem = 0;
  return () => {
    const agora = Math.floor(Date.now() / 1000);
    if (agora !== janela) {
      janela = agora;
      contagem = 0;
    }
    return ++contagem <= MENSAGENS_POR_SEGUNDO;
  };
}

/** O lado do celular: o namespace próprio, com o par no lugar da conta. */
export function ligarCameraDoCelular(io: IOServer) {
  ioDoServidor = io;
  const ns = io.of('/celular');
  ns.use((socket, next) => {
    const id = String(socket.handshake.auth?.id ?? '');
    const token = String(socket.handshake.auth?.token ?? '');
    const par = pares.get(id);
    const valido =
      par !== undefined &&
      par.celular === null &&
      Date.now() - par.criadoEm < VALIDADE_DO_PAR_MS &&
      token.length > 0 &&
      timingSafeEqual(hash(token), par.hashDoToken);
    // A recusa não diz o porquê: quem chuta ids não aprende nada com ela.
    if (!valido || barreiraDe(par.userId)) return next(new Error('par'));
    par.celular = socket.id;
    socket.data.par = id;
    next();
  });
  ns.on('connection', (socket: Socket) => {
    const id = socket.data.par as string;
    const par = pares.get(id);
    if (!par) return socket.disconnect(true);
    io.to(par.computador).emit('celular:chegou', { id });
    const pode = freio();
    socket.on('sinal', (dados: unknown) => {
      const atual = pares.get(id);
      if (!atual || atual.celular !== socket.id || typeof dados !== 'string' || dados.length > TAMANHO_MAXIMO || !pode()) return;
      io.to(atual.computador).emit('celular:sinal', { id, dados });
    });
    socket.on('disconnect', () => {
      const atual = pares.get(id);
      if (atual?.celular === socket.id) fecharPar(id, 'celular');
    });
  });
  // Os pares que ninguém usou somem sozinhos.
  setInterval(() => {
    const agora = Date.now();
    for (const [id, par] of pares) if (par.celular === null && agora - par.criadoEm >= VALIDADE_DO_PAR_MS) fecharPar(id, 'expirou');
  }, 60_000).unref();
}

/** O lado do computador: os eventos no socket da conta. */
export function eventosDaCameraDoCelular(socket: Socket, userId: number) {
  const pode = freio();
  socket.on('celular:abrir', (_: unknown, ack?: (r: { id: string; token: string; validadeMs: number } | { erro: true }) => void) => {
    if (typeof ack !== 'function') return;
    if (barreiraDe(userId)) return ack({ erro: true });
    fecharDaPessoa(userId);
    const id = randomBytes(12).toString('base64url');
    const token = randomBytes(24).toString('base64url');
    pares.set(id, { userId, hashDoToken: hash(token), criadoEm: Date.now(), computador: socket.id, celular: null });
    ack({ id, token, validadeMs: VALIDADE_DO_PAR_MS });
  });
  socket.on('celular:sinal', (payload: { id?: unknown; dados?: unknown }) => {
    const par = pares.get(String(payload?.id ?? ''));
    if (!par || par.computador !== socket.id || !par.celular || !pode()) return;
    if (typeof payload.dados !== 'string' || payload.dados.length > TAMANHO_MAXIMO) return;
    ioDoServidor?.of('/celular').to(par.celular).emit('sinal', payload.dados);
  });
  socket.on('celular:fechar', (payload: { id?: unknown }) => {
    const id = String(payload?.id ?? '');
    if (pares.get(id)?.computador === socket.id) fecharPar(id, 'computador');
  });
  socket.on('disconnect', () => {
    for (const [id, par] of pares) if (par.computador === socket.id) fecharPar(id, 'computador');
  });
}

/** Para os testes. */
export function paresAbertos() {
  return pares.size;
}
