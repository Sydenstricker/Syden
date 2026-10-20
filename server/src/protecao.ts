/**
 * A PROTEÇÃO DE CRIANÇAS E ADOLESCENTES (17/10/2026), e o banimento geral. Ver "Adolescentes no Syden" no CLAUDE.md.
 *
 * O caso que motivou: a ANPD suspendeu o vídeo e o compartilhamento de tela do Discord no Brasil (12/08/2026, ECA
 * Digital, Lei 15.211/2025), depois da morte de uma menina de 13 anos induzida numa transmissão. O Syden tem a mesma
 * arquitetura, e a decisão dele foi proteger de verdade em vez de fechar para menores de 18.
 *
 * AS REGRAS, em uma frase cada:
 *   - idade mínima 13; abaixo disso, a conta fica suspensa (com recurso, para quem errou a data);
 *   - de 13 a 15, a conta é ligada a um responsável (art. 24), com 7 dias para isso a partir da data informada;
 *   - todo menor nasce com o mais protetivo (arts. 7 e 17): conversa privada, transmitir e assistir, só com amigos;
 *     de 13 a 15, só o responsável abre; de 16 e 17, a própria pessoa (autonomia progressiva, art. 10);
 *   - o responsável vê o tempo de uso e os adultos com quem o menor fala, e pode pôr um limite diário (art. 18);
 *   - quem cuida do Syden bane (todo mundo) e suspende por suspeita de idade, sempre com o motivo e o recurso (art. 30).
 *
 * A BARREIRA é o mecanismo único: a conta barrada ENTRA (o token vale), mas só as rotas que resolvem a barreira
 * respondem; a tela mostra o porquê e o que fazer. Assim quem foi banido lê o motivo e pode recorrer, em vez de bater
 * numa porta muda.
 */
import * as db from './db.js';

export type Faixa = 'crianca' | '13-15' | '16-17' | 'adulto';

/** Dias para ligar o responsável, de 13 a 15 anos, a contar da data informada. */
export const DIAS_PARA_LIGAR_RESPONSAVEL = 7;

/** O dia de hoje no horário de Brasília (o limite diário vira à meia-noite daqui). */
export function hojeEmBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Uma data AAAA-MM-DD que existe de verdade (31/02 não passa). */
export function dataValida(texto: unknown): texto is string {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d && a >= 1900;
}

export function idade(nascimento: string, hoje = hojeEmBrasilia()): number {
  const [a, m, d] = nascimento.split('-').map(Number);
  const [ha, hm, hd] = hoje.split('-').map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

export function faixaDe(nascimento: string | null | undefined, hoje = hojeEmBrasilia()): Faixa | null {
  if (!nascimento) return null;
  const anos = idade(nascimento, hoje);
  return anos < 13 ? 'crianca' : anos < 16 ? '13-15' : anos < 18 ? '16-17' : 'adulto';
}

export const ehMenor = (faixa: Faixa | null) => faixa === '13-15' || faixa === '16-17';

const FAIXAS: Faixa[] = ['crianca', '13-15', '16-17', 'adulto'];

/**
 * A FAIXA QUE VALE para a conta: a que o Windows VERIFICOU, se houver (desktop/native/src/idade.cpp), e senão a da data
 * informada. É a decisão do CLAUDE.md: "o verificado sobrepõe a data declarada" — nos dois sentidos, porque quem a
 * Microsoft verificou como 13-15 tem as proteções mesmo tendo dito 18, e quem ela verificou adulto não fica preso a um
 * erro de digitação.
 */
export function faixaDaConta(p: { nascimento: string | null; faixaWindows?: string | null } | undefined, hoje = hojeEmBrasilia()): Faixa | null {
  if (!p) return null;
  if (p.faixaWindows && (FAIXAS as string[]).includes(p.faixaWindows)) return p.faixaWindows as Faixa;
  return faixaDe(p.nascimento, hoje);
}

/** A faixa do Windows ({menor, maior}, com maior null em "18 ou mais") na nossa, ou null se não bate com nenhuma. */
export function faixaDoWindows(menor: unknown, maior: unknown): Faixa | null {
  if (typeof menor !== 'number' || !Number.isInteger(menor)) return null;
  if (maior !== null && (typeof maior !== 'number' || !Number.isInteger(maior))) return null;
  if (maior !== null && maior < 13) return 'crianca';
  if (menor >= 18) return 'adulto';
  if (menor === 13 && maior === 15) return '13-15';
  if (menor === 16 && maior === 17) return '16-17';
  return null;
}

export type Barreira =
  | { tipo: 'banido'; motivo: string; em: string; recursoEm: string | null }
  | { tipo: 'suspensa'; motivo: string; em: string; recursoEm: string | null }
  | { tipo: 'nascimento' }
  | { tipo: 'responsavel'; prazoAte: string }
  | { tipo: 'tempo'; limiteMinutos: number };

/** O que trava esta conta agora, ou null. A ordem importa: o mais grave primeiro. */
export function barreiraDe(userId: number, agora = new Date()): Barreira | null {
  const p = db.protecaoDe(userId);
  if (!p) return null;
  if (p.banidoEm) return { tipo: 'banido', motivo: p.banidoMotivo ?? '', em: p.banidoEm, recursoEm: p.recursoEm };
  if (p.suspensaEm) return { tipo: 'suspensa', motivo: p.suspensaMotivo ?? '', em: p.suspensaEm, recursoEm: p.recursoEm };
  // As contas do próprio Syden (a do app, a dos avisos) não têm idade.
  if (db.ehContaDoSistema(userId)) return null;
  // A CONTA DE AULA (temporária, sem nome nem e-mail, criada por um link do professor) só alcança a aula e some no fim
  // dela (ver "A AULA" em db.ts): não pede idade, como a turma também não pede para entrar na sala.
  if (db.findUserById(userId)?.temporarioAte) return null;
  if (!p.nascimento) return { tipo: 'nascimento' };
  const faixa = faixaDaConta(p, hojeEmBrasilia(agora));
  if (!ehMenor(faixa)) return null;
  const sup = db.supervisaoDe(userId);
  if (faixa === '13-15' && !sup.responsavelId) {
    const desde = Date.parse(p.nascimentoEm ?? '') || agora.getTime();
    const prazo = desde + DIAS_PARA_LIGAR_RESPONSAVEL * 86_400_000;
    if (agora.getTime() > prazo) return { tipo: 'responsavel', prazoAte: new Date(prazo).toISOString() };
  }
  if (sup.limiteMinutos !== null && db.usoDoDia(userId, hojeEmBrasilia(agora)) >= sup.limiteMinutos * 60) {
    return { tipo: 'tempo', limiteMinutos: sup.limiteMinutos };
  }
  return null;
}

/** As regras de um menor (ou null, para adulto e para quem ainda não informou a idade). */
export function regrasDe(userId: number): (db.Supervisao & { faixa: Faixa }) | null {
  const faixa = faixaDaConta(db.protecaoDe(userId));
  if (!ehMenor(faixa)) return null;
  return { ...db.supervisaoDe(userId), faixa: faixa! };
}

const saoAmigos = (a: number, b: number) => db.amizadeEntre(a, b)?.situacao === 'aceita';

/**
 * Conversa privada entre duas pessoas: se uma delas é menor com "só amigos", só com amizade aceita. O pedido de
 * amizade continua livre (é ele o portão), e o responsável vê os adultos entre os amigos.
 */
export function podeConversarNoParticular(a: number, b: number): boolean {
  for (const [menor, outro] of [
    [a, b],
    [b, a],
  ]) {
    const regras = regrasDe(menor);
    if (regras?.dmSoAmigos && !saoAmigos(menor, outro)) return false;
  }
  return true;
}

/**
 * Ver o vídeo (tela ou câmera) de alguém numa sala: se quem transmite é menor com "transmitir só para amigos", ou se
 * quem assiste é menor com "assistir só de amigos", só com amizade aceita.
 */
export function podeVerVideo(espectador: number, transmissor: number): boolean {
  if (espectador === transmissor) return true;
  if (regrasDe(transmissor)?.transmitirSoAmigos && !saoAmigos(espectador, transmissor)) return false;
  if (regrasDe(espectador)?.assistirSoAmigos && !saoAmigos(espectador, transmissor)) return false;
  return true;
}

/** Quem pode mexer nas regras deste menor: o responsável sempre; a própria pessoa de 16 e 17 anos. */
export function podeMudarRegras(quem: number, menorId: number): boolean {
  const regras = regrasDe(menorId);
  if (!regras) return false;
  if (regras.responsavelId === quem) return true;
  return quem === menorId && regras.faixa === '16-17';
}
